import { test, expect, Page } from "@playwright/test";
const owner = "11111111-1111-4111-8111-111111111111";
const sizes = [
  [320, 568],
  [390, 844],
  [430, 932],
  [1024, 768],
  [1180, 820],
  [1366, 1024],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];
async function navigate(page: Page, name: string) {
  for (const b of await page.getByRole("button", { name, exact: true }).all())
    if (await b.isVisible()) {
      await b.click();
      return;
    }
  throw Error(`Missing ${name}`);
}
async function setup(page: Page) {
  // Test-only provider and Supabase responses. No account or email is created.
  const rows = new Map<string, any>(),
    calls: any[] = [];
  let fail = false;
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (url.pathname.includes("/auth/")) {
      await route.fulfill({
        json: {
          id: owner,
          email: "clinician@example.test",
          role: "authenticated",
          app_metadata: { provider: "email" },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
      return;
    }
    if (url.pathname.includes("/rest/v1/dsd_cases")) {
      if (req.method() === "GET") {
        await route.fulfill({ json: [...rows.values()] });
        return;
      }
      const row = req.postDataJSON();
      rows.set(row.id, row);
      await route.fulfill({ json: { updated_at: row.updated_at } });
      return;
    }
    if (url.pathname.includes("/functions/v1/smile-ai")) {
      const input = req.postDataJSON();
      calls.push(input);
      if (fail) {
        await route.fulfill({
          status: 429,
          json: {
            error:
              "Gemini quota or rate limit reached. Check API billing/quota and retry later.",
          },
        });
        return;
      }
      if (input.operation === "connection_check") {
        await route.fulfill({
          json: {
            keyConfigured: true,
            checkedAt: new Date().toISOString(),
            text: {
              model: "gemini-3.8-flash",
              status: "ready",
              message:
                "A live text response was received. No patient data were sent.",
            },
            image: {
              model: "gemini-3.1-flash-image",
              status: "available",
              message:
                "Image model access confirmed. Image generation has not been tested.",
              generationTested: false,
            },
          },
        });
        return;
      }
      const provenance = {
        caseId: input.caseId,
        revisionId: input.revisionId,
        contextVersion: input.contextVersion,
        photoId: input.photoId,
        model:
          input.operation === "simulation"
            ? "gemini-3.1-flash-image"
            : "gemini-3.8-flash",
        promptVersion: "explicit-browser-test",
        createdAt: new Date().toISOString(),
      };
      if (input.operation === "consultation") {
        await route.fulfill({
          json: {
            answer:
              "Confirm same-site findings and individualized criteria before considering a procedure.",
            provenance,
          },
        });
        return;
      }
      if (input.operation === "simulation") {
        await route.fulfill({ json: { image: input.designMedia, provenance } });
        return;
      }
      await route.fulfill({
        json: {
          suggestions: ["oval", "square", "tapered"].map((form, i) => ({
            id: `test-${i}`,
            styleName: `Alternative ${i + 1}`,
            toothTemplate: form,
            recommendedShade: "A1",
            facialProportionRationale:
              "Editable preference; review facial relationships.",
            smileArcAlignment: "Review the arc with the patient.",
            lipLineDynamics: "Review video and rest/smile records.",
            dentitionNotes: "Clinical findings remain incomplete.",
          })),
          sequence: ["Review clinical findings."],
          perioSummary: "Further assessment needed.",
          provenance,
        },
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { error: "Unexpected test route" },
    });
  });
  await page.addInitScript(
    ({ owner }) => {
      const encode = (v: any) => btoa(JSON.stringify(v));
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, exp, role: "authenticated" })}.test`;
      localStorage.setItem(
        "sb-ievxqrnqeahljepcjhfp-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: exp,
          user: {
            id: owner,
            email: "clinician@example.test",
            role: "authenticated",
            app_metadata: { provider: "email" },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    { owner },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  // Wait for the account scope before creating a case.
  await page.getByRole("button", { name: "Account and local backup" }).click();
  await expect(
    page.getByText(/Signed in · clinician@example.test/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Create patient case" }).click();
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 600;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#b8987a";
    ctx.fillRect(0, 0, 900, 600);
    ctx.fillStyle = "#fff";
    ctx.fillRect(300, 260, 300, 80);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Upload Maximum smile", { exact: true }).setInputFiles({
    name: "synthetic-record.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Use for design" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to design" }).click();
  return {
    calls,
    rows,
    quota: () => {
      fail = true;
    },
  };
}
for (const [width, height] of sizes)
  test(`complete consented clinical workflow at ${width}×${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    const mock = await setup(page);
    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Request alternatives" }),
    ).toBeDisabled();
    expect(mock.calls).toHaveLength(0);
    await page
      .getByRole("textbox", { name: "Clinician recording consent" })
      .fill("Test Clinician");
    await page
      .getByRole("checkbox", { name: /documented the patient's consent/ })
      .check();
    await page.getByRole("button", { name: "Record patient consent" }).click();
    await page.getByRole("button", { name: "Request alternatives" }).click();
    await expect(
      page.getByRole("heading", { name: "Alternative 1" }),
    ).toBeVisible();
    expect(mock.calls[0].media.mimeType).toBe("image/jpeg");
    await page
      .getByRole("button", { name: "Apply upper-ten form" })
      .first()
      .click();
    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    await expect(page.getByText(/earlier case revision/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply upper-ten form" }).first(),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Clinical consultation", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Ask about this case" })
      .fill("Which findings require confirmation?");
    await page.getByRole("button", { name: "Send to Gemini" }).click();
    await expect(
      page.getByText(
        "Confirm same-site findings and individualized criteria before considering a procedure.",
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await navigate(page, "Assess");
    if (width < 1024)
      await page.getByRole("button", { name: "Expand editing panel" }).click();
    await page
      .getByRole("group", { name: "Select tooth by FDI number" })
      .getByRole("button", { name: "25", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Clinical display assessment" })
      .selectOption("soft_tissue");
    await page
      .getByRole("textbox", { name: "Reviewing clinician", exact: true })
      .fill("Test Clinician");
    await page
      .getByRole("checkbox", { name: /reviewed the examination/ })
      .check();
    await page
      .getByRole("spinbutton", {
        name: "Planned finish-line depth",
        exact: false,
      })
      .fill("0");
    await navigate(page, "Plan");
    await expect(page.locator(".plan-teeth article")).toHaveCount(10);
    await expect(
      page.getByRole("heading", { name: "FDI 15", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "FDI 25", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create treatment draft", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Patient goals", exact: true })
      .fill("Discuss aesthetic options and clinically confirmed feasibility.");
    await page
      .getByRole("checkbox", { name: /reviewed clinical findings, function/ })
      .check();
    await page
      .getByRole("button", { name: "Approve clinical plan revision" })
      .click();
    await expect(
      page.getByText("Clinician approved", { exact: true }).first(),
    ).toBeVisible();
    const pdfPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const pdf = await pdfPromise;
    await pdf.saveAs(info.outputPath("treatment-plan.pdf"));
    await navigate(page, "Preview");
    await page.getByRole("checkbox", { name: /reviewed this mask/ }).check();
    await page
      .getByRole("button", { name: "Generate patient preview" })
      .click();
    await expect(
      page.getByRole("img", { name: "AI simulated smile requiring review" }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: /reviewed tooth count/ }).check();
    await page
      .getByRole("button", { name: "Accept aesthetic preview" })
      .click();
    await expect(
      page.getByText("aesthetic accepted", { exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export image" }).click();
    await (await download).saveAs(info.outputPath("review-image.png"));
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await navigate(page, "Design");
    if (
      width < 1024 &&
      (await page
        .getByRole("button", { name: "Expand editing panel" })
        .isVisible())
    ) {
      await page.getByRole("button", { name: "Expand editing panel" }).click();
    }
    await page.getByRole("spinbutton", { name: /Rotation/ }).fill("17");
    await expect(
      page.getByText("Clinical draft", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    mock.quota();
    await page.getByRole("button", { name: "Refresh alternatives" }).click();
    await expect(
      page.getByText(/Gemini quota or rate limit reached/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revoke for future requests" })
      .click();
    await expect(
      page.getByRole("button", { name: "Refresh alternatives" }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    for (const row of mock.rows.values()) {
      expect(JSON.stringify(row.body)).not.toMatch(/data:image|blob:/);
      const active = row.body.revisions.find(
        (r: any) => r.id === row.body.activeRevisionId,
      );
      expect(Object.keys(active.teeth)).toHaveLength(10);
      expect(active.teeth[15].form).toBe("oval");
      expect(active.teeth[25].form).toBe("oval");
    }
  });

test("checks server AI access without sending case data and distinguishes image access from generation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await setup(page);
  await page.getByRole("button", { name: "Account and local backup" }).click();
  await page.getByRole("button", { name: "Check AI connection" }).click();
  await expect(page.getByText("Text AI: Ready", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Image AI: Available", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Image generation has not been tested/),
  ).toBeVisible();
  expect(mock.calls).toEqual([{ operation: "connection_check" }]);
  mock.quota();
  await page.getByRole("button", { name: "Check AI connection" }).click();
  await expect(
    page.getByText(/Gemini quota or rate limit reached/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("preserves every pixel outside the reviewed mask and rejects changed framing", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { compositeSimulation, loadImage } = await import(
      "/src/lib/media.ts"
    );
    const { imageFrame } = await import(
      "/supabase/functions/_shared/image-frame.ts"
    );
    const canvas = document.createElement("canvas");
    canvas.width = 90;
    canvas.height = 65;
    const ctx = canvas.getContext("2d")!;
    for (let y = 0; y < 65; y++)
      for (let x = 0; x < 90; x++) {
        ctx.fillStyle = `rgb(${x * 2},${y * 3},${x + y})`;
        ctx.fillRect(x, y, 1, 1);
      }
    const original = ctx.getImageData(0, 0, 90, 65).data,
      url = canvas.toDataURL();
    const f = imageFrame(90, 65),
      generated = document.createElement("canvas");
    generated.width = f.width;
    generated.height = f.height;
    const gc = generated.getContext("2d")!;
    gc.fillStyle = "red";
    gc.fillRect(0, 0, generated.width, generated.height);
    const blob = await compositeSimulation(
      { url, width: 90, height: 65 } as any,
      generated.toDataURL(),
      { left: 0.2, top: 0.3, right: 0.8, bottom: 0.7 },
    );
    const image = await loadImage(URL.createObjectURL(blob));
    ctx.drawImage(image, 0, 0);
    const output = ctx.getImageData(0, 0, 90, 65).data;
    let differentOutside = 0,
      changedInside = 0;
    for (let y = 0; y < 65; y++)
      for (let x = 0; x < 90; x++) {
        const inside =
          ((x + 0.5 - 45) / 27) ** 2 + ((y + 0.5 - 32.5) / 13) ** 2 <= 1;
        const i = (y * 90 + x) * 4,
          different = [0, 1, 2, 3].some(
            (n) => original[i + n] !== output[i + n],
          );
        if (!inside && different) differentOutside++;
        if (inside && different) changedInside++;
      }
    generated.width = 40;
    generated.height = 40;
    let rejected = false;
    try {
      await compositeSimulation(
        { url, width: 90, height: 65 } as any,
        generated.toDataURL(),
        { left: 0.2, top: 0.3, right: 0.8, bottom: 0.7 },
      );
    } catch {
      rejected = true;
    }
    return { differentOutside, changedInside, rejected };
  });
  expect(result.differentOutside).toBe(0);
  expect(result.changedInside).toBeGreaterThan(500);
  expect(result.rejected).toBe(true);
});
