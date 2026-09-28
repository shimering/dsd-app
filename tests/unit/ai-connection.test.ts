import { expect, it, vi } from "vitest";
import { createHandler } from "../../supabase/functions/smile-ai/handler";

const env = {
  get: (name: string) =>
    (
      ({
        SUPABASE_URL: "https://project.test",
        SUPABASE_ANON_KEY: "public-test",
        GEMINI_API_KEY: "private-provider-key",
      }) as Record<string, string>
    )[name],
};
const request = (
  input = { operation: "connection_check" },
  authenticated = true,
) =>
  new Request("https://example.test/smile-ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: "Bearer session" } : {}),
    },
    body: JSON.stringify(input),
  });

it("requires a registered account and rejects any case/media input before provider access", async () => {
  const fetcher = vi.fn();
  expect(
    (await createHandler(env, fetcher)(request(undefined, false))).status,
  ).toBe(401);
  expect(
    (
      await createHandler(
        env,
        fetcher,
      )(
        request({
          operation: "connection_check",
          media: "private-image",
        } as any),
      )
    ).status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(
    Response.json({ id: "anonymous", is_anonymous: true }),
  );
  expect((await createHandler(env, fetcher)(request())).status).toBe(401);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("checks the key with fixed nonclinical text and reports image metadata access separately", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id: "clinician" });
    if (url.endsWith(":generateContent"))
      return Response.json({
        candidates: [{ content: { parts: [{ text: "READY" }] } }],
      });
    return Response.json({ name: "models/gemini-3.1-flash-image" });
  });
  const response = await createHandler(env, fetcher as any)(request()),
    output = await response.json();
  expect(response.status).toBe(200);
  expect(output.text.status).toBe("ready");
  expect(output.image.status).toBe("available");
  expect(output.image.generationTested).toBe(false);
  expect(JSON.stringify(output)).not.toContain("private-provider-key");
  expect(fetcher).toHaveBeenCalledTimes(3);
  const [, options] = fetcher.mock.calls.find(([url]) =>
    url.endsWith(":generateContent"),
  )! as any;
  const body = JSON.parse(options.body);
  expect(body.contents[0].parts[0].text).toContain("No patient information");
  expect(body).not.toHaveProperty("clinicalContext");
  expect(fetcher.mock.calls.map(([url]) => url)).not.toContain(
    "https://project.test/rest/v1/dsd_cases",
  );
});

it("reports a missing secret without calling Google", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: "clinician" }));
  const missing = {
    get: (name: string) =>
      name === "GEMINI_API_KEY" ? undefined : env.get(name),
  };
  expect((await createHandler(missing, fetcher)(request())).status).toBe(503);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("reports quota and denied model access without exposing provider error bodies", async () => {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/auth/v1/user")
      ? Response.json({ id: "clinician" })
      : new Response("private-provider-key", {
          status: url.endsWith(":generateContent") ? 429 : 403,
        }),
  );
  const output = await (
    await createHandler(env, fetcher as any)(request())
  ).json();
  expect(output.text.status).toBe("error");
  expect(output.text.message).toContain("quota");
  expect(output.image.status).toBe("error");
  expect(output.image.message).toContain("denied");
  expect(JSON.stringify(output)).not.toContain("private-provider-key");
});

it("does not claim successful generation when a response has no usable text", async () => {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/auth/v1/user")
      ? Response.json({ id: "clinician" })
      : url.endsWith(":generateContent")
        ? Response.json({ candidates: [] })
        : Response.json({ name: "models/gemini-3.1-flash-image" }),
  );
  const output = await (
    await createHandler(env, fetcher as any)(request())
  ).json();
  expect(output.text.status).toBe("error");
  expect(output.image.generationTested).toBe(false);
});
