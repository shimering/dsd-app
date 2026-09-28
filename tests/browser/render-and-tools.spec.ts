import { test, expect, type Page } from '@playwright/test';

async function upload(page: Page) {
  await page.goto('/');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#bf8272';
    ctx.fillRect(0, 0, 1200, 800);
    const blob = await new Promise<Blob>((r) =>
      c.toBlob((b) => r(b!), 'image/png'),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .locator('input[type=file][multiple]')
    .setInputFiles({
      name: 'Fictional fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(bytes),
    });
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
}
async function point(page: Page, x: number, y: number) {
  const r = (await page.getByTestId('canvas-surface').boundingBox())!;
  const s = Math.min((r.width - 32) / 1200, (r.height - 32) / 800);
  const p = {
    x: r.x + r.width / 2 + (x - 600) * s,
    y: r.y + r.height / 2 + (y - 400) * s,
  };
  await page.mouse.click(p.x, p.y);
  return p;
}

for (const theme of ['light', 'dark'])
  test(`phone ${theme}: all manual stages and measurement tools remain usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await upload(page);
    if (theme === 'dark')
      await page
        .getByRole('button', { name: 'Switch theme', exact: true })
        .click();
    await page.getByRole('button', { name: '2 Measure', exact: true }).click();
    await page
      .getByRole('button', { name: 'Multi-point length', exact: true })
      .click();
    await point(page, 200, 200);
    await point(page, 500, 200);
    await point(page, 500, 500);
    await page
      .getByRole('button', { name: 'Finish length', exact: true })
      .click();
    await expect(page.locator('.measurement-list button')).toHaveCount(1);
    await page.getByRole('button', { name: 'Angle', exact: true }).click();
    await point(page, 800, 200);
    await point(page, 800, 500);
    await point(page, 1100, 500);
    await expect(page.locator('.measurement-list button')).toHaveCount(2);
    await expect(page.locator('.measurement-list strong').nth(1)).toContainText(
      '90.',
    );
    await page
      .getByRole('button', { name: 'Reference line', exact: true })
      .click();
    await point(page, 100, 650);
    await point(page, 1100, 650);
    await expect(page.locator('.measurement-list button')).toHaveCount(3);
    await page.getByRole('button', { name: 'Freehand', exact: true }).click();
    const p = await point(page, 600, 350);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 15, p.y + 12, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('.measurement-list button')).toHaveCount(4);
    await page
      .getByRole('button', { name: '3 Lip outline', exact: true })
      .click();
    for (const [x, y] of [
      [250, 300],
      [600, 250],
      [950, 300],
      [950, 600],
      [600, 650],
      [250, 600],
    ])
      await point(page, x, y);
    await page
      .getByRole('button', { name: 'Confirm outline', exact: true })
      .click();
    await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
    await page
      .getByRole('button', { name: 'Place ten upper teeth', exact: true })
      .click();
    await page.getByRole('button', { name: '14', exact: true }).click();
    await page.getByLabel('Tooth rotation °', { exact: true }).fill('5');
    await page.getByLabel('Show tooth 14', { exact: true }).uncheck();
    await page.getByLabel('Show tooth 14', { exact: true }).check();
    await page.getByRole('button', { name: '5 Compare', exact: true }).click();
    await page.getByLabel('Comparison position', { exact: true }).fill('0.4');
    const downloaded = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Export simulation', exact: true })
      .click();
    expect((await downloaded).suggestedFilename()).toContain('simulation');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `test-results/phone-workflow-${theme}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });

test('lip clipping and comparison exports preserve identical pixels outside the opening', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { newPhoto, seededTeeth, activeDesign, replaceDesign } = await import(
      '/src/domain.ts'
    );
    const { drawMockup, exportImage } = await import('/src/render.ts');
    const { loadToothLibrary } = await import('/src/assets.ts');
    await loadToothLibrary();
    let photo = newPhoto('Fixture', '', 1200, 800, 'image/png');
    photo.lip = {
      points: [
        { x: 250, y: 300 },
        { x: 950, y: 300 },
        { x: 950, y: 600 },
        { x: 250, y: 600 },
      ],
      closed: true,
      smoothing: 0,
    };
    photo = replaceDesign(photo, {
      ...activeDesign(photo),
      teeth: seededTeeth(photo),
    });
    const original = document.createElement('canvas');
    original.width = 1200;
    original.height = 800;
    const source = original.getContext('2d')!;
    const gradient = source.createLinearGradient(0, 0, 1200, 800);
    gradient.addColorStop(0, '#b97863');
    gradient.addColorStop(1, '#422629');
    source.fillStyle = gradient;
    source.fillRect(0, 0, 1200, 800);
    const edited = document.createElement('canvas');
    edited.width = 1200;
    edited.height = 800;
    const ctx = edited.getContext('2d')!;
    ctx.drawImage(original, 0, 0);
    drawMockup(ctx, photo);
    const a = source.getImageData(0, 0, 1200, 800).data,
      b = ctx.getImageData(0, 0, 1200, 800).data;
    let outsideChanges = 0,
      insideChanges = 0;
    for (let y = 0; y < 800; y++)
      for (let x = 0; x < 1200; x++) {
        const i = (y * 1200 + x) * 4;
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
          if (x >= 250 && x < 950 && y >= 300 && y < 600) insideChanges++;
          else outsideChanges++;
        }
      }
    const blob = await exportImage(photo, original, true, 0.5),
      url = URL.createObjectURL(blob),
      image = new Image();
    image.src = url;
    await image.decode();
    const output = document.createElement('canvas');
    output.width = image.width;
    output.height = image.height;
    const oc = output.getContext('2d')!;
    oc.drawImage(image, 0, 0);
    const c = oc.getImageData(0, 0, 1200, 800).data;
    let beforeChanges = 0,
      preservedChanges = 0,
      labelChanges = 0;
    for (let y = 0; y < 800; y++)
      for (let x = 0; x < 1200; x++) {
        const i = (y * 1200 + x) * 4,
          changed =
            a[i] !== c[i] || a[i + 1] !== c[i + 1] || a[i + 2] !== c[i + 2];
        if (!changed) continue;
        if (y > 740 && x < 420) {
          labelChanges++;
          continue;
        }
        if (x < 595) beforeChanges++;
        if (x > 605 && (x < 250 || x > 950 || y < 300 || y > 600))
          preservedChanges++;
      }
    photo.lip.closed = false;
    ctx.clearRect(0, 0, 1200, 800);
    drawMockup(ctx, photo);
    const draftPainted = ctx
      .getImageData(0, 0, 1200, 800)
      .data.some((v, i) => i % 4 === 3 && v > 0);
    URL.revokeObjectURL(url);
    return {
      outsideChanges,
      insideChanges,
      beforeChanges,
      preservedChanges,
      labelChanges,
      draftPainted,
      width: image.width,
      height: image.height,
      type: blob.type,
    };
  });
  expect(result.outsideChanges).toBe(0);
  expect(result.insideChanges).toBeGreaterThan(1000);
  expect(result.beforeChanges).toBe(0);
  expect(result.preservedChanges).toBe(0);
  expect(result.labelChanges).toBeGreaterThan(500);
  expect(result.draftPainted).toBe(false);
  expect(result.type).toBe('image/png');
  expect([result.width, result.height]).toEqual([1200, 800]);
});
