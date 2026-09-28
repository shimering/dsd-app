import { test, expect } from "@playwright/test";
test("dialog traps keyboard focus, restores the launcher and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Assistant", exact: true });
  await launcher.click();
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest("[role=dialog]"),
    ),
  ).toBe(true);
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest("[role=dialog]"),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
  expect(await page.locator("#root").getAttribute("inert")).toBeNull();
});
test("editing survives portrait/landscape and a smaller keyboard viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand editing panel" }).click();
  await page.getByRole("spinbutton", { name: /Rotation/ }).fill("25");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("spinbutton", { name: /Rotation/ })).toHaveValue(
    "25",
  );
  await page.setViewportSize({ width: 390, height: 400 });
  await page.getByRole("spinbutton", { name: /Vertical position/ }).fill("375");
  await expect(page.getByRole("spinbutton", { name: /Rotation/ })).toHaveValue(
    "25",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("spinbutton", { name: /Vertical position/ }),
  ).toHaveValue("375");
});
