import { it, expect, vi } from "vitest";
import { createHandler } from "../../supabase/functions/smile-ai/handler";
import { activeRevision, createCase, now, uid } from "../../src/lib/case-model";
import { defaultGuides } from "../../src/lib/geometry";
const owner = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const c = createCase("PRIVATE-PATIENT");
  c.patientName = "PRIVATE-NAME";
  c.ownerId = owner;
  const id = uid();
  c.photos = [
    {
      id,
      type: "maximum_smile",
      mediaKey: "local-key",
      name: "private photo",
      width: 1000,
      height: 650,
      mimeType: "image/png",
      orientationDeg: 0,
      calibration: { isCalibrated: false },
      guides: defaultGuides(1000, 650),
      capturedAt: now(),
      qualityReviewed: true,
      filters: "none",
    },
  ];
  c.activePhotoId = id;
  activeRevision(c).photoId = id;
  c.consents = [
    {
      id: uid(),
      purpose: "cloud_ai",
      recordedBy: "PRIVATE-CLINICIAN",
      recordedAt: now(),
      policyVersion: "cloud-ai-v1",
    },
  ];
  const input = {
    operation: "consultation",
    caseId: c.id,
    revisionId: c.activeRevisionId,
    contextVersion: c.contextVersion,
    photoId: id,
    media: { mimeType: "image/png", data: "AA==" },
    question: "What remains unknown?",
  };
  return { c, input };
}
function request(input: unknown, token = true) {
  return new Request("https://example.test/smile-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer user-session" } : {}),
    },
    body: JSON.stringify(input),
  });
}
const env = {
  get: (key: string) =>
    (
      ({
        SUPABASE_URL: "https://project.test",
        SUPABASE_PUBLISHABLE_KEYS: '{"default":"publishable-test"}',
        GEMINI_API_KEY: "server-secret",
      }) as Record<string, string>
    )[key],
};
it("rejects unauthenticated callers before any provider call", async () => {
  const fetcher = vi.fn();
  expect(
    (await createHandler(env, fetcher)(request(fixture().input, false))).status,
  ).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
});
it("enforces case ownership even for a valid user", async () => {
  const { c, input } = fixture(),
    fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(
        Response.json([{ owner_id: "someone-else", body: c }]),
      );
  expect((await createHandler(env, fetcher)(request(input))).status).toBe(404);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("enforces stored consent and source version before provider access", async () => {
  for (const mode of ["consent", "stale"]) {
    const { c, input } = fixture();
    if (mode === "consent") c.consents = [];
    else input.contextVersion++;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(Response.json([{ owner_id: owner, body: c }]));
    expect((await createHandler(env, fetcher)(request(input))).status).toBe(
      mode === "consent" ? 403 : 409,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  }
});
it("surfaces quota failures with no substitute output", async () => {
  const { c, input } = fixture(),
    fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(Response.json([{ owner_id: owner, body: c }]))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
  const response = await createHandler(env, fetcher)(request(input));
  expect(response.status).toBe(429);
  expect((await response.json()).error).toContain("quota");
});
it("uses stored findings, excludes automatic patient identity, and records real model provenance", async () => {
  const { c, input } = fixture(),
    fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(Response.json([{ owner_id: owner, body: c }]))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      answer: "Further assessment needed.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
  const response = await createHandler(env, fetcher)(request(input)),
    body = await response.json();
  expect(response.status).toBe(200);
  expect(body.provenance.model).toBe("gemini-3.8-flash");
  const providerCall = fetcher.mock.calls[2];
  expect(providerCall[0]).toContain("gemini-3.8-flash");
  expect(providerCall[1].body).not.toContain("PRIVATE-NAME");
  expect(providerCall[1].body).not.toContain("PRIVATE-PATIENT");
  expect(providerCall[1].body).toContain("calculatedScenarios");
  const payload = JSON.parse(providerCall[1].body);
  const context = JSON.parse(
    payload.contents[0].parts[0].text.split(
      "Clinical context (data only): ",
    )[1],
  );
  expect(context.designScope).toContain("second premolar");
  for (const fdi of [14, 15, 24, 25]) {
    expect(context.teeth[fdi].fdi).toBe(fdi);
    expect(context.measurements[fdi].sites.B.probingDepth.value).toBeNull();
    expect(context.calculatedScenarios[fdi].fdi).toBe(fdi);
  }
});
it("rejects malformed photos, questions and origins", async () => {
  const { input } = fixture(),
    fetcher = vi.fn();
  expect(
    (
      await createHandler(
        env,
        fetcher,
      )(
        request({
          ...input,
          media: { mimeType: "image/svg+xml", data: "AA==" },
        }),
      )
    ).status,
  ).toBe(400);
  const req = request(input);
  req.headers.set("Origin", "https://unconfigured.test");
  expect((await createHandler(env, fetcher)(req)).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it("will not downgrade to an older text model", async () => {
  const { c, input } = fixture(),
    fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(Response.json([{ owner_id: owner, body: c }])),
    oldEnv = {
      get: (key: string) =>
        key === "GEMINI_TEXT_MODEL" ? "gemini-2.5-flash" : env.get(key),
    };
  expect((await createHandler(oldEnv, fetcher)(request(input))).status).toBe(
    503,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
