import { test, expect, Page } from "@playwright/test";
async function localCase(page: Page) {
  return page.evaluate(async () => {
    const { get } = await import("/node_modules/.vite/deps/idb-keyval.js");
    return (await get("dsd_cases_v2_local"))?.[0];
  });
}
test("mouse editing commits once, pointer cancellation discards a draft and resize preserves geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  await expect
    .poll(async () => (await localCase(page))?.contextVersion)
    .toBe(1);
  const selected = page.locator('.canvas-viewport > svg [data-fdi="11"]'),
    box = (await selected.boundingBox())!,
    before = await localCase(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 25,
    box.y + box.height / 2 + 15,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await localCase(page))?.contextVersion)
    .toBe(2);
  const committed = await localCase(page);
  const old = before.revisions.find(
      (r: any) => r.id === before.activeRevisionId,
    ).teeth[11],
    changed = committed.revisions.find(
      (r: any) => r.id === committed.activeRevisionId,
    ).teeth[11];
  expect(changed.x).toBeGreaterThan(old.x);
  expect(changed.y).toBeGreaterThan(old.y);
  expect(committed.revisions.length - before.revisions.length).toBe(1);
  const nextBox = (await selected.boundingBox())!;
  await page.mouse.move(
    nextBox.x + nextBox.width / 2,
    nextBox.y + nextBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    nextBox.x + nextBox.width / 2 + 30,
    nextBox.y + nextBox.height / 2,
  );
  await page
    .locator(".canvas-viewport > svg")
    .dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse" });
  await page.mouse.up();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Expand editing panel" }).click();
  await expect(
    page.getByRole("spinbutton", { name: /Horizontal position/ }),
  ).toHaveValue(String(Math.round(changed.x)));
  const resized = await localCase(page);
  expect(resized.activeRevisionId).toBe(committed.activeRevisionId);
});

test("touch pinch and pen input preserve original geometry and ignore palm events", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Trusted pen/two-finger input uses the Chromium DevTools input API. Hardware verification remains separate.",
  );
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  await expect
    .poll(async () => (await localCase(page))?.contextVersion)
    .toBe(1);
  const original = await localCase(page),
    cdp = await page.context().newCDPSession(page),
    box = (await page.locator(".canvas-viewport").boundingBox())!,
    cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 30, y: cy, id: 0 },
      { x: cx + 30, y: cy, id: 1 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 70, y: cy, id: 0 },
      { x: cx + 70, y: cy, id: 1 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByText(/233% zoom/)).toBeVisible();
  expect((await localCase(page)).activeRevisionId).toBe(
    original.activeRevisionId,
  );
  await page.getByRole("button", { name: "Fit photo to canvas" }).click();
  const tooth = (await page
      .locator('.canvas-viewport > svg [data-fdi="11"]')
      .boundingBox())!,
    x = tooth.x + tooth.width / 2,
    y = tooth.y + tooth.height / 2;
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
    pointerType: "pen",
  });
  await page
    .locator(".canvas-viewport > svg")
    .dispatchEvent("pointerdown", {
      pointerId: 700,
      pointerType: "touch",
      clientX: cx,
      clientY: cy,
      bubbles: true,
    });
  await page
    .locator(".canvas-viewport > svg")
    .dispatchEvent("pointercancel", { pointerId: 700, pointerType: "touch" });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: x + 20,
    y: y + 10,
    button: "left",
    buttons: 1,
    pointerType: "pen",
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: x + 20,
    y: y + 10,
    button: "left",
    buttons: 0,
    clickCount: 1,
    pointerType: "pen",
  });
  await expect
    .poll(async () => (await localCase(page))?.contextVersion)
    .toBe(original.contextVersion + 1);
});

test("backup restores local media, revokes imported consent and clears missing-media states", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for a natural smile." }),
  ).toBeVisible();
  await expect.poll(async () => (await localCase(page))?.photos.length).toBe(1);
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Clinician recording consent" })
    .fill("Test Clinician");
  await page
    .getByRole("checkbox", { name: /documented the patient's consent/ })
    .check();
  await page.getByRole("button", { name: "Record patient consent" }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect
    .poll(async () => (await localCase(page))?.consents.length)
    .toBe(1);
  await page.getByRole("button", { name: "Account and local backup" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export local backup" }).click();
  const backup = await download,
    backupPath = await backup.path();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const old = await localCase(page);
  await page.evaluate(async (key) => {
    const { del } = await import("/node_modules/.vite/deps/idb-keyval.js");
    await del(key);
  }, old.photos[0].mediaKey);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Photo unavailable on this device" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Account and local backup" }).click();
  await page
    .getByLabel("Import local backup", { exact: true })
    .setInputFiles(backupPath!);
  await expect(page.getByText(/Backup restored/)).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByText("Illustrated demo · upload patient photo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Record patient consent" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request alternatives" }),
  ).toBeDisabled();
});
