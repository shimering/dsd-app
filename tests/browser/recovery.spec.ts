import { openUtilities } from './frame-fixtures';
import { test, expect, type Page } from '@playwright/test';
async function fixture(page: Page, color = '#ba8371') {
  const bytes = await page.evaluate(async (color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#282328';
    ctx.beginPath();
    ctx.ellipse(600, 480, 270, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    return Array.from(
      new Uint8Array(
        await (
          await new Promise<Blob>((r) =>
            canvas.toBlob((b) => r(b!), 'image/png'),
          )
        ).arrayBuffer(),
      ),
    );
  }, color);
  return {
    name: 'Fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  };
}
async function start(page: Page) {
  await page.goto('/');
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  const file = await fixture(page);
  await page.locator('input[type=file][multiple]').setInputFiles(file);
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  return file;
}
async function place(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('canvas-surface').boundingBox())!,
    s = Math.min((box.width - 32) / 1200, (box.height - 32) / 800);
  const p = {
    x: box.x + box.width / 2 + (x - 600) * s,
    y: box.y + box.height / 2 + (y - 400) * s,
  };
  await page.mouse.click(p.x, p.y);
  return p;
}
async function addDistance(page: Page, waitForSave = true) {
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await page.getByRole('button', { name: 'Distance', exact: true }).click();
  await place(page, 350, 600);
  await place(page, 700, 600);
  await expect(page.locator('.measurement-list button')).toHaveCount(1);
  await page.getByLabel('Point X', { exact: true }).fill('350');
  await page.getByLabel('Point Y', { exact: true }).fill('600');
  await page.getByLabel('Selected point', { exact: true }).selectOption('1');
  await page.getByLabel('Point X', { exact: true }).fill('700');
  await page.getByLabel('Point Y', { exact: true }).fill('600');
  await expect(page.getByText('350.0 px', { exact: true })).toBeVisible();
  if (waitForSave)
    await expect(
      page.getByText('Saved on this device', { exact: true }),
    ).toBeVisible();
}
test('multiple photos, source rotation, point movement, cancellation, and undo/redo', async ({
  page,
}) => {
  const file = await start(page);
  await page.locator('input[type=file][multiple]').setInputFiles([
    { ...file, name: 'Second.png' },
    { ...file, name: 'Third.png' },
  ]);
  await expect(page.locator('.photo-chip')).toHaveCount(3);
  await addDistance(page);
  await page
    .getByRole('button', { name: 'Select and move', exact: true })
    .click();
  const p = await place(page, 700, 600);
  await page.getByLabel('Point X', { exact: true }).fill('750');
  await expect(page.getByText('400.0 px', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('350.0 px', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByText('400.0 px', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 35, p.y);
  await page.getByTestId('canvas-surface').dispatchEvent('pointercancel', {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: p.x + 35,
    clientY: p.y,
  });
  await page.mouse.up();
  await expect(page.getByText('350.0 px', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '1 Photos', exact: true }).click();
  await page.getByRole('button', { name: '+90°', exact: true }).click();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await expect(page.getByText('350.0 px', { exact: true })).toBeVisible();
});
test('offline edits save and backup restores geometry and exact original media', async ({
  page,
  context,
}) => {
  await start(page);
  await context.setOffline(true);
  await addDistance(page);
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export backup', exact: true })
    .click();
  const backup = await download,
    path = test.info().outputPath('backup.json');
  await backup.saveAs(path);
  await page.getByRole('button', { name: 'New case', exact: true }).click();
  await page
    .locator('input[type=file][accept="application/json,.json"]')
    .setInputFiles(path);
  await expect(page.getByRole('status')).toContainText('Backup imported');
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await expect(page.getByText('350.0 px', { exact: true })).toBeVisible();
  await expect(page.locator('.canvas-message')).toHaveCount(0);
});
test('missing media rejects a different original with the same dimensions', async ({
  page,
}) => {
  const original = await start(page);
  await addDistance(page);
  await page.evaluate(async () => {
    const { loadWorkspaces, removeMedia } = await import('/src/storage.ts');
    const cases = await loadWorkspaces('guest');
    await removeMedia(cases[0].photos[0].mediaKey);
  });
  await page.reload();
  await expect(
    page.getByText('The original photo is missing on this device.', {
      exact: false,
    }),
  ).toBeVisible();
  const wrong = await fixture(page, '#408897');
  await page
    .locator('input[type=file][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles(wrong);
  await expect(page.getByRole('alert')).toContainText('fingerprint');
  await page
    .locator('input[type=file][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles(original);
  await expect(page.locator('.canvas-message')).toHaveCount(0);
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await expect(page.getByText('350.0 px', { exact: true })).toBeVisible();
});
test('storage failures are visible and current geometry can still be backed up', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (typeof key === 'string' && key.startsWith('cases:'))
        throw new DOMException('Test storage full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await addDistance(page, false);
  await expect(
    page.getByText('Save failed · back up now', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Local save failed');
  const d = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export backup', exact: true })
    .click();
  expect((await d).suggestedFilename()).toContain('backup');
});
test('synthetic pen and two-finger gestures keep navigation separate from editing', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await openUtilities(page);
  await page.getByRole('button', { name: 'Distance', exact: true }).click();
  await page.evaluate(() => {
    const host = document.querySelector(
      '[data-testid=canvas-surface]',
    ) as HTMLElement;
    host.setPointerCapture = () => {};
  });
  const surface = page.getByTestId('canvas-surface'),
    box = (await surface.boundingBox())!;
  const send = async (
    type: string,
    id: number,
    kind: string,
    x: number,
    y: number,
  ) =>
    surface.dispatchEvent(type, {
      pointerId: id,
      pointerType: kind,
      clientX: box.x + x,
      clientY: box.y + y,
      button: 0,
      buttons: 1,
      isPrimary: id === 10,
    });
  await send('pointerdown', 10, 'pen', box.width * 0.35, box.height * 0.6);
  await send('pointerup', 10, 'pen', box.width * 0.35, box.height * 0.6);
  await send('pointerdown', 11, 'pen', box.width * 0.65, box.height * 0.6);
  await send('pointerup', 11, 'pen', box.width * 0.65, box.height * 0.6);
  await expect(page.locator('.measurement-list button')).toHaveCount(1);
  const before = await page.locator('.measurement-list strong').innerText();
  await page.getByLabel('Finger edit mode', { exact: true }).check();
  await send('pointerdown', 20, 'touch', box.width * 0.3, box.height * 0.4);
  await send('pointerdown', 21, 'touch', box.width * 0.7, box.height * 0.4);
  await send('pointermove', 20, 'touch', box.width * 0.2, box.height * 0.4);
  await send('pointermove', 21, 'touch', box.width * 0.8, box.height * 0.4);
  await send('pointerup', 20, 'touch', box.width * 0.2, box.height * 0.4);
  await send('pointerup', 21, 'touch', box.width * 0.8, box.height * 0.4);
  await expect(page.locator('.measurement-list strong')).toHaveText(before);
  await expect(page.locator('.zoom-value')).not.toHaveText('100%');
  await page
    .getByRole('button', { name: '3 Lip outline', exact: true })
    .click();
  await send('pointerdown', 30, 'touch', box.width * 0.3, box.height * 0.4);
  await send('pointerdown', 31, 'touch', box.width * 0.7, box.height * 0.4);
  await send('pointerup', 30, 'touch', box.width * 0.3, box.height * 0.4);
  await send('pointerup', 31, 'touch', box.width * 0.7, box.height * 0.4);
  await expect(page.getByText('0 points', { exact: true })).toBeVisible();
});
for (const size of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'phone', width: 390, height: 844 },
])
  for (const theme of ['light', 'dark'])
    test(`${size.name} ${theme}: workflow fits without horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await start(page);
      if (theme === 'dark')
        await page
          .getByRole('button', { name: 'Switch theme', exact: true })
          .click();
      await page
        .getByRole('button', { name: '2 Measure', exact: true })
        .click();
      await expect(
        page.getByRole('heading', {
          name: 'Every detail, considered.',
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `test-results/${size.name}-${theme}-${test.info().project.name}.png`,
        fullPage: true,
      });
    });
