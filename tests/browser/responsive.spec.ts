import { test, expect } from "@playwright/test";
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
async function nav(page: any, label: string) {
  const buttons = page.getByRole("button", {
    name: new RegExp(`^${label}(?: \\d+)?$`),
  });
  for (const b of await buttons.all())
    if (await b.isVisible()) {
      await b.click();
      return;
    }
  throw new Error(`Missing navigation: ${label}`);
}
async function noOverflow(page: any) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
for (const [width, height] of sizes)
  for (const theme of ["light", "dark"])
    test(`${width}x${height} ${theme} responsive workflow`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(
        (t) => localStorage.setItem("dsd_theme", t),
        theme,
      );
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Make room for a natural smile." }),
      ).toBeVisible();
      await noOverflow(page);
      const panels = await page.locator(".canvas-shell").boundingBox();
      await expect(
        page.locator(".canvas-viewport > svg [data-fdi]"),
      ).toHaveCount(10);
      expect(panels?.height).toBeGreaterThan(120);
      const mode = await page.evaluate(
        () => document.documentElement.dataset.theme,
      );
      expect(mode).toBe(theme);
      if (width < 1024) {
        await page.getByRole("button", { name: "Open editing panel" }).click();
        await expect(
          page.getByRole("button", { name: "Oval", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Expand editing panel" })
          .click();
        await expect(
          page
            .getByRole("group", { name: "Select tooth by FDI number" })
            .getByRole("button"),
        ).toHaveCount(10);
        await page
          .getByRole("group", { name: "Select tooth by FDI number" })
          .getByRole("button", { name: "15", exact: true })
          .click();
        await page.getByRole("spinbutton", { name: /Rotation/ }).fill("8");
        await page
          .getByRole("group", { name: "Select tooth by FDI number" })
          .getByRole("button", { name: "25", exact: true })
          .click();
        await page.getByRole("spinbutton", { name: /Rotation/ }).fill("12");
        await page
          .getByRole("button", { name: "Return to split editing" })
          .click();
        await page
          .getByRole("button", { name: "Collapse editing panel" })
          .click();
      } else {
        await expect(
          page.getByRole("button", { name: "Oval", exact: true }),
        ).toBeVisible();
        const picker = page.getByRole("group", {
          name: "Select tooth by FDI number",
        });
        await expect(picker.getByRole("button")).toHaveCount(10);
        await picker.getByRole("button", { name: "15", exact: true }).click();
        await page.getByRole("spinbutton", { name: /Rotation/ }).fill("8");
        await picker.getByRole("button", { name: "25", exact: true }).click();
        await page.getByRole("spinbutton", { name: /Rotation/ }).fill("12");
      }
      await noOverflow(page);
      if ((width === 1440 || width === 390) && info.project.name === "chromium")
        await page.screenshot({ path: info.outputPath("design.png") });
      await nav(page, "Capture");
      await expect(
        page.getByRole("heading", { name: "Capture the complete picture." }),
      ).toBeVisible();
      await noOverflow(page);
      await nav(page, "Assess");
      if (width < 1024)
        await page
          .getByRole("button", { name: "Expand editing panel" })
          .click();
      await expect(page.getByLabel("Clinical site")).toBeVisible();
      await noOverflow(page);
      await nav(page, "Plan");
      await expect(
        page.getByRole("heading", { name: "A plan grounded in the findings." }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Create treatment draft", exact: true })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Patient goals", exact: true }),
      ).toBeVisible();
      await noOverflow(page);
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export PDF" }).click();
      expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
      await nav(page, "Preview");
      await expect(
        page.getByRole("dialog", { name: "Simulated treatment preview" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Generate patient preview" }),
      ).toBeDisabled();
      await noOverflow(page);
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Assistant", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Gemini smile assistant" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Request alternatives" }),
      ).toBeDisabled();
      await noOverflow(page);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
test("theme follows system and persists a manual override", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("combobox", { name: "Appearance" })
    .selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.locator("meta[name=viewport]").getAttribute("content"),
  ).not.toContain("user-scalable=no");
});
test("uploads original media, preserves calibration through resize and supports undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create patient case" }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1800;
    c.height = 1200;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#dac5ad";
    ctx.fillRect(0, 0, 1800, 1200);
    ctx.fillStyle = "#fff";
    ctx.fillRect(750, 550, 150, 200);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Upload Maximum smile", { exact: true }).setInputFiles({
    name: "synthetic-patient.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(
    page.getByRole("button", { name: "Use for design" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to design" }).click();
  await page.getByRole("button", { name: "Scale", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: /Point 1 horizontal/ })
    .fill("400");
  await page
    .getByRole("spinbutton", { name: /Point 2 horizontal/ })
    .fill("500");
  await page
    .getByRole("spinbutton", { name: /Clinically measured reference distance/ })
    .fill("10");
  await page
    .getByRole("textbox", { name: "Reference measurement method" })
    .fill("Caliper");
  await page
    .getByRole("textbox", { name: "Reference tooth / site / plane" })
    .fill("FDI 11 frontal width");
  await page.getByRole("button", { name: "Confirm photo scale" }).click();
  await expect(
    page.getByText("Photo scale confirmed · projected dimensions"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo design change" }).click();
  await expect(
    page.getByText("Photo scale pending · relative design"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Redo design change" }).click();
  async function localCase() {
    return page.evaluate(async () => {
      const { get } = await import("/node_modules/.vite/deps/idb-keyval.js");
      const cases = await get("dsd_cases_v2_local");
      return cases?.find((c: any) => !c.isDemo);
    });
  }
  await expect
    .poll(async () => (await localCase())?.photos[0].calibration.pixelsPerMm)
    .toBe(10);
  const before = await localCase();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Expand editing panel" }).click();
  await page
    .locator(".inspector-tabs")
    .getByRole("button", { name: "Design", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: /Projected width/ }),
  ).toBeVisible();
  await page.getByRole("spinbutton", { name: /Rotation/ }).fill("19");
  await expect
    .poll(async () => (await localCase())?.contextVersion)
    .toBeGreaterThan(before.contextVersion);
  const after = await localCase();
  expect(after.photos[0].calibration.pixelsPerMm).toBe(10);
  expect(after.photos[0].width).toBe(1800);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  await expect(
    page.getByText("Photo scale confirmed · projected dimensions"),
  ).toBeVisible();
});
