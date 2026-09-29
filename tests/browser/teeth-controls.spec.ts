import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#b7806f';
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#3c2625';
    ctx.fillRect(250, 300, 700, 300);
    for (let i = 0; i < 10; i++) {
      const x = 270 + i * 66;
      const g = ctx.createLinearGradient(x, 320, x, 550);
      g.addColorStop(0, '#938979');
      g.addColorStop(0.45, '#c8bcab');
      g.addColorStop(1, '#bbb3a9');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, 320, 64, 230, [12, 12, 22, 22]);
      ctx.fill();
    }
    const blob = await new Promise<Blob>((r) =>
      c.toBlob((b) => r(b!), 'image/png'),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'Lighting fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  });
  await page
    .getByRole('button', { name: '3 Lip outline', exact: true })
    .click();
  const box = (await page.getByTestId('canvas-surface').boundingBox())!;
  const s = Math.min((box.width - 32) / 1200, (box.height - 32) / 800);
  for (const [x, y] of [
    [250, 300],
    [950, 300],
    [950, 600],
    [250, 600],
  ])
    await page.mouse.click(
      box.x + box.width / 2 + (x - 600) * s,
      box.y + box.height / 2 + (y - 400) * s,
    );
  await page
    .getByRole('button', { name: 'Confirm outline', exact: true })
    .click();
  await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
  await page
    .getByRole('button', { name: 'Place ten upper teeth', exact: true })
    .click();
  await page.getByRole('button', { name: '11', exact: true }).click();
  await page.evaluate(() => {
    (
      document.querySelector('[data-testid=canvas-surface]') as HTMLElement
    ).setPointerCapture = () => {};
  });
}
test('natural proportions can repair one tooth or the arch and undo as one edit', async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel('Height px', { exact: true }).fill('350');
  await page.getByRole('button', { name: '14', exact: true }).click();
  await page.getByLabel('Height px', { exact: true }).fill('250');
  await page.getByRole('button', { name: '11', exact: true }).click();
  await page
    .getByRole('button', { name: 'Restore natural proportions', exact: true })
    .click();
  const selected = (await savedPhoto(page)).designs[0].teeth;
  const central = selected.find((t) => t.fdi === 11)!;
  expect(central.width / central.height).toBeCloseTo(0.82);
  expect(selected.find((t) => t.fdi === 14)!.height).toBe(250);
  await page
    .getByLabel('Move and style the whole smile', { exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Restore natural proportions', exact: true })
    .click();
  const normalized = (await savedPhoto(page)).designs[0].teeth;
  const premolar = normalized.find((t) => t.fdi === 14)!;
  expect(premolar.width / premolar.height).toBeCloseTo(0.74);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await savedPhoto(page)).designs[0].teeth)
    .toEqual(selected);
});
async function savedPhoto(page: Page) {
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  return page.evaluate(async () => {
    const { loadWorkspaces } = await import('/src/storage.ts');
    return (await loadWorkspaces('guest'))[0].photos[0];
  });
}
async function gesture(
  page: Page,
  scale: number,
  angle: number,
  finish = 'pointerup',
  third = false,
) {
  const surface = page.getByTestId('canvas-surface'),
    box = (await surface.boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2,
    radius = 65;
  const a = (angle * Math.PI) / 180;
  const send = (type: string, id: number, x: number, y: number) =>
    surface.dispatchEvent(type, {
      pointerId: id,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
    });
  await send('pointerdown', 20, cx - radius, cy);
  await send('pointerdown', 21, cx + radius, cy);
  await send(
    'pointermove',
    20,
    cx - radius * scale * Math.cos(a),
    cy - radius * scale * Math.sin(a),
  );
  if (third) {
    await send('pointerdown', 22, cx, cy - 100);
    await send('pointerup', 22, cx, cy - 100);
  }
  await send(
    'pointermove',
    21,
    cx + radius * scale * Math.cos(a),
    cy + radius * scale * Math.sin(a),
  );
  await send(
    finish,
    20,
    cx - radius * scale * Math.cos(a),
    cy - radius * scale * Math.sin(a),
  );
  await send(
    'pointerup',
    21,
    cx + radius * scale * Math.cos(a),
    cy + radius * scale * Math.sin(a),
  );
}
test('two fingers rotate and scale the selected tooth, preserve photo zoom, and undo in one step', async ({
  page,
}) => {
  await setup(page);
  const before = await savedPhoto(page),
    original = before.designs[0].teeth;
  await gesture(page, 1.2, 23.7, 'pointerup', true);
  await expect(
    page.getByLabel('Tooth rotation °', { exact: true }),
  ).toHaveValue('23.7');
  const after = (await savedPhoto(page)).designs[0].teeth;
  const i = after.findIndex((t) => t.fdi === 11);
  expect(after[i].width / original[i].width).toBeCloseTo(1.2);
  expect(after[i].height / original[i].height).toBeCloseTo(1.2);
  after.forEach((t, j) => {
    if (j !== i) expect(t).toEqual(original[j]);
  });
  await expect(page.locator('.zoom-value')).toHaveText('100%');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await savedPhoto(page)).designs[0].teeth).toEqual(original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await savedPhoto(page)).designs[0].teeth)
    .toEqual(after);
});
test('whole smile gestures honor optional snapping and keep proportional spacing', async ({
  page,
}) => {
  await setup(page);
  await page
    .getByLabel('Move and style the whole smile', { exact: true })
    .check();
  await page.getByLabel('Apply snapping', { exact: true }).check();
  const before = (await savedPhoto(page)).designs[0].teeth;
  await gesture(page, 1.107, 14.3);
  const after = (await savedPhoto(page)).designs[0].teeth;
  after.forEach((t, i) => {
    expect(t.rotation - before[i].rotation).toBeCloseTo(15);
    expect(t.width / before[i].width).toBeCloseTo(1.1);
  });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByLabel('Apply snapping', { exact: true }).uncheck();
  await gesture(page, 1.107, 14.3);
  const free = (await savedPhoto(page)).designs[0].teeth;
  free.forEach((t, i) => {
    expect(t.rotation - before[i].rotation).toBeCloseTo(14.3);
    expect(t.width / before[i].width).toBeCloseTo(1.107);
  });
  await page.reload();
  await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
  await expect(
    page.getByLabel('Apply snapping', { exact: true }),
  ).not.toBeChecked();
});
test('cancelled and interrupted tooth gestures discard previews; Pan retains photo navigation', async ({
  page,
}) => {
  await setup(page);
  const before = (await savedPhoto(page)).designs[0].teeth;
  for (const cancellation of ['pointercancel', 'lostpointercapture']) {
    await gesture(page, 1.25, 35, cancellation);
    expect((await savedPhoto(page)).designs[0].teeth).toEqual(before);
  }
  await page.getByRole('button', { name: 'Pan', exact: true }).click();
  await gesture(page, 1.25, 15);
  await expect(page.locator('.zoom-value')).toHaveText('125%');
  expect((await savedPhoto(page)).designs[0].teeth).toEqual(before);
});
test('lighting controls and Match photo persist, reset, and restore through a backup', async ({
  page,
}) => {
  await setup(page);
  await page.getByRole('button', { name: 'Match photo', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Lighting matched');
  const matched = (await savedPhoto(page)).designs[0].lighting!;
  expect(matched.brightness).toBeLessThan(0);
  expect(matched.lipShadow).toBeGreaterThan(0);
  expect(matched.posteriorShadow).toBeGreaterThan(0);
  await page.getByLabel('Brightness', { exact: true }).fill('-18');
  await page.getByLabel('Warmth', { exact: true }).fill('12');
  await page.getByLabel('Upper lip shadow', { exact: true }).fill('42');
  const lighting = (await savedPhoto(page)).designs[0].lighting!;
  expect(lighting).toMatchObject({
    brightness: -18,
    warmth: 12,
    lipShadow: 42,
  });
  await page
    .getByRole('button', { name: 'Reset lighting', exact: true })
    .click();
  await expect(page.getByLabel('Brightness', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Brightness', { exact: true })).toHaveValue(
    '-18',
  );
  await expect
    .poll(async () => (await savedPhoto(page)).designs[0].lighting)
    .toEqual(lighting);
  await page.reload();
  await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
  await expect(
    page.getByLabel('Upper lip shadow', { exact: true }),
  ).toHaveValue('42');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export backup', exact: true })
    .click();
  const path = test.info().outputPath('lighting-backup.json');
  await (await download).saveAs(path);
  await page.getByRole('button', { name: 'New case', exact: true }).click();
  await page
    .locator('input[type=file][accept="application/json,.json"]')
    .setInputFiles(path);
  await expect(page.getByRole('status')).toContainText('Backup imported');
  await page.getByRole('button', { name: '4 Teeth', exact: true }).click();
  await expect(page.getByLabel('Brightness', { exact: true })).toHaveValue(
    '-18',
  );
  await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('12');
});
test('lighting preserves the lip mask and exports the exact edited tooth appearance', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const {
      newPhoto,
      seededTeeth,
      activeDesign,
      replaceDesign,
      DEFAULT_LIGHTING,
      photoSchema,
    } = await import('/src/domain.ts');
    const { loadToothLibrary } = await import('/src/assets.ts');
    const { drawMockup, exportImage } = await import('/src/render.ts');
    const { matchPhotoLighting } = await import('/src/lighting.ts');
    await loadToothLibrary();
    let photo = newPhoto('Fixture', '', 1200, 800, 'image/png');
    photo.lip = {
      points: [
        { x: 250, y: 300 },
        { x: 600, y: 350 },
        { x: 950, y: 300 },
        { x: 950, y: 600 },
        { x: 250, y: 600 },
      ],
      closed: true,
      smoothing: 0.35,
    };
    photo = replaceDesign(photo, {
      ...activeDesign(photo),
      teeth: seededTeeth(photo),
      lighting: {
        ...DEFAULT_LIGHTING,
        brightness: -18,
        warmth: 12,
        highlights: 50,
        lipShadow: 55,
        posteriorShadow: 38,
      },
    });
    const original = document.createElement('canvas');
    original.width = 1200;
    original.height = 800;
    const source = original.getContext('2d')!;
    source.fillStyle = '#bb7566';
    source.fillRect(0, 0, 1200, 800);
    const edited = document.createElement('canvas');
    edited.width = 1200;
    edited.height = 800;
    const ctx = edited.getContext('2d')!;
    ctx.drawImage(original, 0, 0);
    drawMockup(ctx, photo);
    const mask = document.createElement('canvas');
    mask.width = 1200;
    mask.height = 800;
    const { lipPath } = await import('/src/geometry.ts');
    mask.getContext('2d')!.fill(new Path2D(lipPath(photo.lip)));
    const a = source.getImageData(0, 0, 1200, 800).data,
      b = ctx.getImageData(0, 0, 1200, 800).data,
      m = mask.getContext('2d')!.getImageData(0, 0, 1200, 800).data;
    let outside = 0,
      inside = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2])
        continue;
      if (!m[i + 3]) outside++;
      else inside++;
    }
    const blob = await exportImage(photo, original, false),
      image = await createImageBitmap(blob);
    const output = document.createElement('canvas');
    output.width = 1200;
    output.height = 800;
    output.getContext('2d')!.drawImage(image, 0, 0);
    const c = output.getContext('2d')!.getImageData(250, 300, 700, 300).data;
    const preview = ctx.getImageData(250, 300, 700, 300).data;
    let mismatches = 0;
    for (let i = 0; i < c.length; i++) if (c[i] !== preview[i]) mismatches++;
    let rejectsRed = false;
    try {
      matchPhotoLighting(original, photo);
    } catch {
      rejectsRed = true;
    }
    const legacy = {
      ...photo,
      designs: photo.designs.map(
        ({ lighting: _lighting, ...design }) => design,
      ),
    };
    const legacyLoads = photoSchema.safeParse(legacy).success;
    return { outside, inside, mismatches, rejectsRed, legacyLoads };
  });
  expect(result).toMatchObject({
    outside: 0,
    mismatches: 0,
    rejectsRed: true,
    legacyLoads: true,
  });
  expect(result.inside).toBeGreaterThan(1000);
});

test('shadow controls follow a curved upper lip, shade the back teeth, and preserve enamel alpha', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const {
      newPhoto,
      activeDesign,
      replaceDesign,
      DEFAULT_LIGHTING,
      seededTeeth,
    } = await import('/src/domain.ts');
    const { shadeTeeth } = await import('/src/lighting.ts');
    let photo = newPhoto('Light test', '', 400, 200, 'image/png');
    photo.lip = {
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 50 },
        { x: 400, y: 0 },
        { x: 400, y: 200 },
        { x: 0, y: 200 },
      ],
      closed: true,
      smoothing: 0,
    };
    photo = replaceDesign(photo, {
      ...activeDesign(photo),
      teeth: seededTeeth(photo),
    });
    const render = (values: Partial<typeof DEFAULT_LIGHTING>) => {
      const layer = document.createElement('canvas');
      layer.width = 400;
      layer.height = 200;
      const ctx = layer.getContext('2d')!;
      ctx.fillStyle = 'rgba(235,225,210,.8)';
      ctx.fillRect(0, 0, 400, 200);
      shadeTeeth(
        layer,
        replaceDesign(photo, {
          ...activeDesign(photo),
          lighting: { ...DEFAULT_LIGHTING, ...values },
        }),
        { x: 0, y: 0, scale: 1 },
      );
      return ctx.getImageData(0, 0, 400, 200).data;
    };
    const neutral = render({}),
      lip = render({ lipShadow: 60 }),
      posterior = render({ posteriorShadow: 60 }),
      directional = render({ lightBalance: 60 }),
      warm = render({ warmth: 35 }),
      soft = render({ highlights: 100 });
    const sample = (
      data: Uint8ClampedArray,
      x: number,
      y: number,
      channel = 0,
    ) => data[(y * 400 + x) * 4 + channel];
    return {
      followsLip: sample(lip, 200, 53) < sample(lip, 200, 110),
      leavesAboveLip: sample(lip, 200, 20) === sample(neutral, 200, 20),
      shadowsBack: sample(posterior, 50, 130) < sample(posterior, 200, 130),
      directional: sample(directional, 50, 130) > sample(directional, 350, 130),
      warm:
        sample(warm, 200, 130) - sample(warm, 200, 130, 2) >
        sample(neutral, 200, 130) - sample(neutral, 200, 130, 2),
      soft: sample(soft, 200, 130) < sample(neutral, 200, 130),
      alphaPreserved: [lip, posterior, directional, warm, soft].every((data) =>
        data.every((v, i) => i % 4 !== 3 || v === neutral[i]),
      ),
    };
  });
  expect(Object.values(result).every(Boolean), JSON.stringify(result)).toBe(
    true,
  );
});
