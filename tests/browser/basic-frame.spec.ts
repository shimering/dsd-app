import { test, expect, type Page } from '@playwright/test';
async function start(page: Page) {
  await page.goto('/');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ad8068';
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#f4ead1';
    ctx.fillRect(350, 380, 500, 100);
    const blob = await new Promise<Blob>((r) =>
      c.toBlob((b) => r(b!), 'image/png'),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'Frame fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  });
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
}
async function savedPhoto(page: Page) {
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  return page.evaluate(
    async () =>
      (await (await import('/src/storage.ts')).loadWorkspaces('guest'))[0]
        .photos[0],
  );
}
async function screenPoint(page: Page, x: number, y: number) {
  const surface = page.getByTestId('canvas-surface');
  await surface.scrollIntoViewIfNeeded();
  const r = (await surface.boundingBox())!,
    s = Math.min((r.width - 32) / 1200, (r.height - 32) / 800);
  return {
    x: r.x + r.width / 2 + (x - 600) * s,
    y: r.y + r.height / 2 + (y - 400) * s,
  };
}
test('exactly six templates cover both second premolars and retain hidden landmark identities', async ({
  page,
}) => {
  await start(page);
  await expect(page.locator('.basic-tool-cards button')).toHaveCount(6);
  await expect(page.locator('.dsd-checklist')).toHaveCount(0);
  await page.getByTestId('basic-tool-gingival-curve').click();
  await page.locator('.basic-landmarks summary').click();
  await expect(
    page.getByLabel('gingival 15 visible', { exact: true }),
  ).toBeChecked();
  await page.getByLabel('gingival 25 visible', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Confirm guide', exact: true })
    .click();
  const t = (await savedPhoto(page)).dsd!.basicFrame!.templates[0];
  expect(t.paths[0].anchors).toHaveLength(10);
  expect(t.paths[0].anchors.at(-1)).toMatchObject({
    key: '25',
    point: null,
    reason: 'Not visible in this photo.',
  });
  await page.getByTestId('basic-tool-papilla-curve').click();
  const p = await savedPhoto(page);
  expect(
    p.dsd!.basicFrame!.templates.find((t) => t.id === 'papilla-curve')!.paths[0]
      .anchors,
  ).toHaveLength(9);
});
test('target changes, transforms, undo and reload leave tooth layers unchanged', async ({
  page,
}) => {
  await start(page);
  await page.getByTestId('basic-tool-interdental-proportion').click();
  await page.getByLabel('Lateral / central width %').fill('70');
  await page.getByLabel('Second premolar / first premolar width %').fill('85');
  await page
    .getByRole('button', { name: 'Confirm guide', exact: true })
    .click();
  await expect(page.locator('.dsd-progress')).toContainText(
    '1 of 6 guides set',
  );
  const before = await savedPhoto(page);
  await page.getByRole('button', { name: 'Smaller −5%', exact: true }).click();
  await expect(page.locator('.dsd-progress')).toContainText('0 of 6');
  const smaller = await savedPhoto(page);
  expect(
    smaller.dsd!.basicFrame!.templates[0].placement!.centralWidth,
  ).toBeCloseTo(
    before.dsd!.basicFrame!.templates[0].placement!.centralWidth * 0.95,
  );
  expect(smaller.designs).toEqual(before.designs);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.dsd-progress')).toContainText('1 of 6');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate +5°', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm guide', exact: true })
    .click();
  await savedPhoto(page);
  await page.reload();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await page.getByTestId('basic-tool-interdental-proportion').click();
  await expect(page.getByLabel('Lateral / central width %')).toHaveValue('70');
  await expect(
    page.getByLabel('Second premolar / first premolar width %'),
  ).toHaveValue('85');
  await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
  await expect(page.getByLabel('Show confirmed smile guides')).toBeChecked();
  await page.getByLabel('Show confirmed smile guides').uncheck();
});
test('point drags commit once, cancelled gestures retain geometry, and photo rotation preserves guides', async ({
  page,
}) => {
  await start(page);
  await page.getByTestId('basic-tool-smile-curve').click();
  const original = await savedPhoto(page),
    a = original.dsd!.basicFrame!.templates[0].paths[0].anchors[0].point!;
  const q = await screenPoint(page, a.x, a.y);
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 10, q.y + 8);
  await page.mouse.up();
  const moved = await savedPhoto(page);
  expect(moved.revision).toBe(original.revision + 1);
  expect(
    moved.dsd!.basicFrame!.templates[0].paths[0].anchors[0].point,
  ).not.toEqual(a);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 10, q.y + 8);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await savedPhoto(page)).dsd!.basicFrame).toEqual(
    original.dsd!.basicFrame,
  );
  await page.getByRole('button', { name: '1 Photos', exact: true }).click();
  await page.getByRole('button', { name: '+90°', exact: true }).click();
  expect((await savedPhoto(page)).dsd!.basicFrame).toEqual(
    original.dsd!.basicFrame,
  );
});
test('backup imports preserve the six-tool frame and legacy measurements stay collapsed', async ({
  page,
}) => {
  await start(page);
  await page.getByTestId('basic-tool-central-incisor-proportion').click();
  await page.getByLabel('Central incisor width / height %').fill('79');
  await page
    .getByRole('button', { name: 'Confirm guide', exact: true })
    .click();
  const original = await savedPhoto(page),
    download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export backup', exact: true })
    .click();
  const path = test.info().outputPath('frame-backup.json');
  await (await download).saveAs(path);
  await page.getByRole('button', { name: 'New case', exact: true }).click();
  await page
    .locator('input[type=file][accept="application/json,.json"]')
    .setInputFiles(path);
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await page.getByTestId('basic-tool-central-incisor-proportion').click();
  await expect(page.getByLabel('Central incisor width / height %')).toHaveValue(
    '79',
  );
  expect(
    await page
      .locator('.saved-annotations')
      .evaluate((e) => (e as HTMLDetailsElement).open),
  ).toBe(false);
  expect(original.dsd!.basicFrame!.templates[0].status).toBe('confirmed');
});
test('six cards and ten-tooth controls fit a phone screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.getByTestId('basic-tool-interdental-proportion').click();
  await expect(
    page.getByLabel('Second premolar / first premolar width %'),
  ).toBeVisible();
  await page.getByTestId('basic-tool-smile-curve').click();
  await page.getByLabel('Smile arc assessment').selectOption('consonant');
  await page.getByLabel('Show all guides').check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('basic-frame-phone.png'),
    fullPage: true,
  });
});

test('older cases keep all named measurements in a collapsed annotations section', async ({
  page,
}) => {
  await start(page);
  await savedPhoto(page);
  await page.evaluate(async () => {
    const { loadWorkspaces, saveWorkspaces } = await import('/src/storage.ts');
    const { DSD_MEASUREMENTS } = await import('/src/dsdCatalog.ts');
    const cases = await loadWorkspaces('guest');
    cases[0].photos[0].measurements = DSD_MEASUREMENTS.map((d) => ({
      id: d.id,
      assessmentId: d.id,
      label: d.label,
      kind: d.kind,
      points:
        d.kind === 'polyline'
          ? [
              { x: 400, y: 400 },
              { x: 500, y: 410 },
              { x: 600, y: 400 },
            ]
          : [
              { x: 400, y: 400 },
              { x: 500, y: 400 },
            ],
    }));
    await saveWorkspaces('guest', cases);
  });
  await page.reload();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await expect(page.locator('.basic-tool-cards button')).toHaveCount(6);
  await expect(page.locator('.saved-annotations')).toContainText('69');
  expect(
    await page
      .locator('.saved-annotations')
      .evaluate((e) => (e as HTMLDetailsElement).open),
  ).toBe(false);
  await page.getByTestId('basic-tool-central-incisor-proportion').click();
  expect((await savedPhoto(page)).measurements).toHaveLength(69);
});

test('canvas move, resize and rotate handles preserve configured proportion targets', async ({
  page,
}) => {
  await start(page);
  await page.getByTestId('basic-tool-interdental-proportion').click();
  const original = await savedPhoto(page),
    initial = original.dsd!.basicFrame!.templates[0];
  const handles = async () => {
    const surface = page.getByTestId('canvas-surface');
    await surface.scrollIntoViewIfNeeded();
    const r = (await surface.boundingBox())!,
      s = Math.min((r.width - 32) / 1200, (r.height - 32) / 800);
    return page.evaluate(async (scale) => {
      const { frameHandles } = await import('/src/frameCanvas.ts');
      const { templateBounds } = await import('/src/basicFrame.ts');
      const { loadWorkspaces } = await import('/src/storage.ts');
      const t = (await loadWorkspaces('guest'))[0].photos[0].dsd!.basicFrame!
        .templates[0];
      return { ...frameHandles(t, scale)!, center: templateBounds(t)!.center };
    }, s);
  };
  const drag = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const a = await screenPoint(page, from.x, from.y),
      b = await screenPoint(page, to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    return (await savedPhoto(page)).dsd!.basicFrame!.templates[0];
  };
  let h = await handles();
  const moved = await drag(h.move, { x: h.move.x + 30, y: h.move.y + 10 });
  expect(
    Math.abs(moved.placement!.center.x - initial.placement!.center.x - 30),
  ).toBeLessThan(3);
  h = await handles();
  const resized = await drag(h.scale, {
    x: h.center.x + (h.scale.x - h.center.x) * 0.95,
    y: h.center.y + (h.scale.y - h.center.y) * 0.95,
  });
  expect(
    Math.abs(
      resized.placement!.centralWidth / moved.placement!.centralWidth - 0.95,
    ),
  ).toBeLessThan(0.02);
  h = await handles();
  const dx = h.rotate.x - h.center.x,
    dy = h.rotate.y - h.center.y,
    angle = (8 * Math.PI) / 180;
  const rotated = await drag(h.rotate, {
    x: h.center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: h.center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  });
  expect(Math.abs(rotated.placement!.rotation - 8)).toBeLessThan(2);
  expect(rotated.targets).toEqual(initial.targets);
});
