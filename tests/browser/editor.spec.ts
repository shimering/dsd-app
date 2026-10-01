import { openUtilities } from './frame-fixtures';
import { test, expect, type Page } from '@playwright/test';
const photoSVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#a97763"/><ellipse cx="600" cy="460" rx="295" ry="110" fill="#602e35"/><ellipse cx="600" cy="455" rx="245" ry="66" fill="#242326"/><path d="M390 425H810V455H390z" fill="#eadcba"/></svg>';
async function upload(page: Page) {
  const bytes = await page.evaluate(async (svg) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + btoa(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return Array.from(
      new Uint8Array(
        await (
          await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
        ).arrayBuffer(),
      ),
    );
  }, photoSVG);
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'Test smile.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  });
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
}
async function point(page: Page, x: number, y: number) {
  const surface = page.getByTestId('canvas-surface'),
    r = (await surface.boundingBox())!;
  const s = Math.min((r.width - 32) / 1200, (r.height - 32) / 800);
  await page.mouse.click(
    r.x + r.width / 2 + (x - 600) * s,
    r.y + r.height / 2 + (y - 400) * s,
  );
}
test('corrected library has ten crowns, rounded cervical caps and single premolar cusps', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Tooth library', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Tooth library review' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector(
          '.review-canvas canvas',
        ) as HTMLCanvasElement;
        return c
          .getContext('2d')!
          .getImageData(0, 0, 1200, 420)
          .data.some((v, i) => i % 4 === 3 && v > 0);
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: 'test-results/tooth-review-' + test.info().project.name + '.png',
  });
  const shapes = await page.evaluate(async () => {
    const { toothSprite, loadToothLibrary } = await import('/src/assets.ts');
    const { seededTeeth, newPhoto } = await import('/src/domain.ts');
    await loadToothLibrary();
    return ['oval', 'square', 'tapered', 'rounded'].flatMap((form) =>
      ['smooth', 'natural', 'detailed'].flatMap((texture) =>
        seededTeeth(newPhoto('', '', 1200, 800, 'image/png'))
          .slice(0, 5)
          .map((t) => {
            const c = toothSprite({ ...t, form, texture })!,
              ctx = c.getContext('2d')!,
              d = ctx.getImageData(0, 0, c.width, c.height).data;
            const top = (fraction: number) => {
              const x = Math.floor((c.width - 1) * fraction);
              for (let y = 0; y < c.height; y++)
                if (d[(y * c.width + x) * 4 + 3] > 150) return y;
              return c.height;
            };
            return {
              form,
              texture,
              fdi: t.fdi,
              rounded: top(0.5) < Math.min(top(0.15), top(0.85)),
              cusp:
                t.fdi === 14 || t.fdi === 15
                  ? (() => {
                      const bottom = (f: number) => {
                        const x = Math.floor((c.width - 1) * f);
                        for (let y = c.height - 1; y >= 0; y--)
                          if (d[(y * c.width + x) * 4 + 3] > 150) return y;
                        return 0;
                      };
                      return bottom(0.5) > Math.max(bottom(0.15), bottom(0.85));
                    })()
                  : true,
            };
          }),
      ),
    );
  });
  for (const shape of shapes) {
    expect(shape.rounded, JSON.stringify(shape)).toBe(true);
    expect(shape.cusp, JSON.stringify(shape)).toBe(true);
  }
});
test('photo, calibration, measurements, lip mask, all ten teeth, compare and local reopening', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  await upload(page);
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await page.getByRole('button', { name: 'Calibrate', exact: true }).click();
  await point(page, 300, 200);
  await point(page, 500, 200);
  await page.getByLabel('Known reference length (mm)').fill('10');
  await page
    .getByRole('button', { name: 'Confirm calibration', exact: true })
    .click();
  await page.getByRole('button', { name: 'Distance', exact: true }).click();
  await point(page, 600, 600);
  await point(page, 900, 600);
  await expect(page.getByText('15.00 mm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByText('15.00 mm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit photo', exact: true }).click();
  await page
    .getByRole('button', { name: '3 Lip outline', exact: true })
    .click();
  for (const [x, y] of [
    [345, 425],
    [600, 395],
    [855, 425],
    [855, 475],
    [600, 515],
    [345, 475],
  ])
    await point(page, x, y);
  await page
    .getByRole('button', { name: 'Confirm outline', exact: true })
    .click();
  await expect(
    page.getByText('Outline confirmed', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
  await page
    .getByRole('button', { name: 'Place ten upper teeth', exact: true })
    .click();
  for (const fdi of [15, 14, 13, 12, 11, 21, 22, 23, 24, 25])
    await expect(
      page.getByRole('button', { name: String(fdi), exact: true }),
    ).toBeVisible();
  await page.getByRole('button', { name: '5 Compare', exact: true }).click();
  await page.getByLabel('Comparison position', { exact: true }).fill('0.7');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export comparison', exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain('comparison');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await expect(page.getByText('15.00 mm', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'test-results/workspace-' + test.info().project.name + '.png',
  });
});
