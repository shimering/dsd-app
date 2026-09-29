import { test, expect, type Page } from '@playwright/test';
async function openPhoto(page: Page) {
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
    ctx.fillRect(430, 380, 330, 100);
    return Array.from(
      new Uint8Array(
        await (
          await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
        ).arrayBuffer(),
      ),
    );
  });
  await page.locator('input[type=file][multiple]').setInputFiles({
    name: 'DSD fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  });
  await expect(page.getByTestId('canvas-surface')).toBeVisible();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
}
async function point(page: Page, x: number, y: number) {
  await page.getByTestId('canvas-surface').scrollIntoViewIfNeeded();
  const r = (await page.getByTestId('canvas-surface').boundingBox())!;
  const s = Math.min((r.width - 32) / 1200, (r.height - 32) / 800);
  await page.mouse.click(
    r.x + r.width / 2 + (x - 600) * s,
    r.y + r.height / 2 + (y - 400) * s,
  );
}
async function dimensions(page: Page) {
  const group = page.locator('.dsd-checklist details').filter({
    has: page.locator('summary', { hasText: 'Tooth dimensions & axes' }),
  });
  if (!(await group.evaluate((el) => (el as HTMLDetailsElement).open)))
    await group.locator('summary').click();
}
test('guided crown measurements calculate proportions, redraw, undo, and survive reopening before lip outline', async ({
  page,
}) => {
  await openPhoto(page);
  await dimensions(page);
  await page
    .getByRole('button', { name: 'Measure 11 crown width', exact: true })
    .click();
  await point(page, 510, 430);
  await point(page, 590, 430);
  await page
    .getByRole('button', { name: 'Measure 11 crown height', exact: true })
    .click();
  await point(page, 550, 380);
  await point(page, 550, 480);
  await expect(page.locator('.dsd-results')).toContainText('11 width / height');
  const ratio = page
    .locator('.dsd-results dl div')
    .filter({ hasText: '11 width / height' })
    .locator('dd');
  const original = (await ratio.textContent())!;
  // Native WebKit mouse coordinates round to screen pixels; the unit suite
  // verifies exact source-coordinate math independently of pointer rounding.
  expect(Math.abs(parseFloat(original) - 80)).toBeLessThan(2);
  await page
    .getByRole('button', { name: 'Review 11 crown width', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Redraw this measurement', exact: true })
    .click();
  await point(page, 510, 430);
  await point(page, 580, 430);
  await expect
    .poll(async () => Math.abs(parseFloat((await ratio.textContent())!) - 70))
    .toBeLessThan(2);
  const redrawn = (await ratio.textContent())!;
  await expect(page.locator('.dsd-progress')).toContainText('2 of');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(ratio).toHaveText(original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(ratio).toHaveText(redrawn);
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await expect(ratio).toHaveText(redrawn);
  await page
    .getByRole('button', { name: 'Continue to Lip outline', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Point by point.' }),
  ).toBeVisible();
});
test('switching named measurements cancels a draft even when the tool stays the same', async ({
  page,
}) => {
  await openPhoto(page);
  await dimensions(page);
  await page
    .getByRole('button', { name: 'Measure 11 crown width', exact: true })
    .click();
  await point(page, 510, 430);
  await page
    .getByRole('button', { name: 'Measure 21 crown width', exact: true })
    .click();
  await point(page, 600, 430);
  await point(page, 700, 430);
  const width = page
    .getByRole('button', { name: 'Review 21 crown width', exact: true })
    .locator('strong');
  expect(Math.abs(parseFloat((await width.textContent())!) - 100)).toBeLessThan(
    2,
  );
  await expect(width).toContainText('px');
  await expect(
    page.getByRole('button', { name: 'Measure 11 crown width', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.dsd-progress')).toContainText('1 of');
  await page.getByRole('button', { name: 'Calibrate', exact: true }).click();
  await point(page, 100, 200);
  await point(page, 300, 200);
  await page.getByLabel('Known reference length (mm)').fill('10');
  await page
    .getByRole('button', { name: 'Confirm calibration', exact: true })
    .click();
  await expect(width).toContainText('mm');
  expect(Math.abs(parseFloat((await width.textContent())!) - 5)).toBeLessThan(
    0.15,
  );
});
test('unavailable anatomy and resting-view measurements persist, with sign-in required for Gemini', async ({
  page,
}) => {
  await openPhoto(page);
  await page
    .getByRole('button', {
      name: 'Measure Facial horizontal / interpupillary line',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', {
      name: 'Mark not visible in this photo',
      exact: true,
    })
    .click();
  await expect(page.locator('.dsd-progress')).toContainText('1 unavailable');
  await page.getByRole('button', { name: 'Restore item', exact: true }).click();
  await expect(page.locator('.dsd-progress')).toContainText('0 unavailable');
  await page.getByLabel('Assessment photo view').selectOption('rest');
  await expect(
    page.getByRole('button', {
      name: 'Measure 11 incisor display at rest',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Measure Smile width', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Measure 11 incisor display at rest',
      exact: true,
    })
    .click();
  await point(page, 540, 450);
  await point(page, 540, 480);
  await expect(
    page.getByText('Saved on this device', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '2 Measure', exact: true }).click();
  await expect(page.getByLabel('Assessment photo view')).toHaveValue('rest');
  const rest = page
    .getByRole('button', {
      name: 'Review 11 incisor display at rest',
      exact: true,
    })
    .locator('strong');
  expect(Math.abs(parseFloat((await rest.textContent())!) - 30)).toBeLessThan(
    2,
  );
  await expect(rest).toContainText('px');
  await page
    .getByRole('button', {
      name: 'Assist this assessment with Gemini',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Your account' }),
  ).toBeVisible();
});
test('smile curves need three points and coexist with a manual smile-arc assessment on a small screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPhoto(page);
  await page
    .locator('.dsd-checklist summary')
    .filter({ hasText: 'Smile & lip relationships' })
    .click();
  await page
    .getByRole('button', {
      name: 'Measure Upper incisal smile arc',
      exact: true,
    })
    .click();
  await point(page, 430, 445);
  await point(page, 590, 480);
  await expect(
    page.getByRole('button', { name: 'Finish length', exact: true }),
  ).toBeDisabled();
  await point(page, 760, 445);
  await page
    .getByRole('button', { name: 'Finish length', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Review Upper incisal smile arc',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Smile arc assessment').selectOption('consonant');
  await page.getByLabel('Show all DSD overlays').check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/dsd-phone-' + test.info().project.name + '.png',
    fullPage: true,
  });
});
