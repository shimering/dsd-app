import type { Page } from '@playwright/test';
export async function openUtilities(page: Page) {
  for (const selector of ['.annotation-tools', '.saved-annotations']) {
    const details = page.locator(selector);
    if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
      await details.locator('summary').click();
  }
}
