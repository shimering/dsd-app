import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [390, 844],
  [1180, 820],
])
  test(`upgrades an existing six-tooth case and edits premolars at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Make room for a natural smile." }),
    ).toBeVisible();
    await expect(
      page.getByText("Saved locally", { exact: true }),
    ).toBeVisible();
    const original = await page.evaluate(async () => {
      const { createCase, activeRevision, now, selectPhoto, uid } =
        await import("/src/lib/case-model.ts");
      const { defaultGuides } = await import("/src/lib/geometry.ts");
      const { saveCases, saveMedia } = await import("/src/lib/storage.ts");
      const canvas = document.createElement("canvas");
      canvas.width = 1800;
      canvas.height = 1200;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#d5bfaa";
      ctx.fillRect(0, 0, 1800, 1200);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png"),
      );
      let c = createCase("EXISTING-SIX");
      const photoId = uid();
      c.photos = [
        {
          id: photoId,
          type: "maximum_smile",
          name: "Original record",
          mediaKey: await saveMedia(blob),
          width: 1800,
          height: 1200,
          mimeType: "image/png",
          orientationDeg: 0,
          calibration: {
            isCalibrated: true,
            pixelsPerMm: 10,
            realDistanceMm: 10,
            p1: { x: 400, y: 500 },
            p2: { x: 500, y: 500 },
          },
          guides: defaultGuides(1800, 1200),
          capturedAt: now(),
          qualityReviewed: true,
          filters: "none",
        },
      ];
      c = selectPhoto(c, photoId);
      for (const fdi of [14, 15, 24, 25]) {
        delete c.measurements[fdi];
        for (const revision of c.revisions) delete revision.teeth[fdi];
      }
      activeRevision(c).teeth[11].x = 742;
      activeRevision(c).teeth[11].rotation = 17;
      await saveCases([c]);
      return c;
    });
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Active patient" }),
    ).toHaveValue(original.id);
    await expect(page.locator(".canvas-viewport > svg [data-fdi]")).toHaveCount(
      10,
    );
    if (width < 1024)
      await page.getByRole("button", { name: "Expand editing panel" }).click();
    const picker = page.getByRole("group", {
      name: "Select tooth by FDI number",
    });
    for (const fdi of [15, 25]) {
      const button = picker.getByRole("button", {
        name: String(fdi),
        exact: true,
      });
      await button.click();
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await page
        .getByRole("spinbutton", { name: /Rotation/ })
        .fill(fdi === 15 ? "-9" : "9");
    }
    const saved = async () =>
      page.evaluate(async () => {
        const { get } = await import("/node_modules/.vite/deps/idb-keyval.js");
        return (await get("dsd_cases_v2_local"))[0];
      });
    await expect
      .poll(async () => {
        const c = await saved();
        return c.revisions.find((r: any) => r.id === c.activeRevisionId)
          .teeth[25]?.rotation;
      })
      .toBe(9);
    const upgraded = await saved(),
      active = upgraded.revisions.find(
        (r: any) => r.id === upgraded.activeRevisionId,
      );
    expect(active.teeth[15].rotation).toBe(-9);
    expect(active.teeth[11]).toEqual(
      original.revisions.find((r: any) => r.id === original.activeRevisionId)!
        .teeth[11],
    );
    expect(upgraded.photos[0].calibration).toEqual(
      original.photos[0].calibration,
    );
    expect(upgraded.photos[0].mediaKey).toBe(original.photos[0].mediaKey);
    expect(upgraded.measurements[25].sites.B.boneSounding.value).toBeNull();
    expect(upgraded.revisions.slice(0, original.revisions.length)).toEqual(
      original.revisions,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.locator(".canvas-viewport > svg [data-fdi]")).toHaveCount(
      10,
    );
  });
