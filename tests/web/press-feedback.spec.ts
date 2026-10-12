import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`button feedback respects ${reducedMotion} for pointer and keyboard presses`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const button = page.getByRole('button', { name: 'View', exact: true });
    const transform =
      reducedMotion === 'reduce' ? 'none' : 'matrix(1, 0, 0, 1, 0, 2)';
    await expect(button).toHaveCSS('opacity', '1');
    const bounds = await button.boundingBox();
    if (!bounds) throw new Error('Button is not visible');
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await expect(button).toHaveCSS('transform', transform);
    await expect(button).toHaveCSS('opacity', '0.78');
    await page.screenshot({
      path: `test-results/button-pressed-${reducedMotion}.png`,
    });
    // Release outside the button so the press is canceled.
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await expect(button).toHaveCSS('transform', 'none');
    await expect(button).toHaveCSS('opacity', '1');
    await button.focus();
    await page.keyboard.down('Space');
    await expect(button).toHaveCSS('transform', transform);
    await expect(button).toHaveCSS('opacity', '0.78');
    await page.keyboard.up('Space');
    await expect(button).toHaveCSS('opacity', '1');
    await expect(button).toHaveCSS('transform', 'none');
    await expect(page).toHaveURL('/');
  });
}

test('a pending disabled button has no press animation', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/session', async (route) => {
    await pending;
    await route.fulfill({ status: 401, body: '{}' });
  });
  await page.goto('/');
  await page.getByLabel('Enter your ID').fill('000000000000');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const button = page.getByRole('button', { name: 'Opening…', exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveCSS('opacity', '0.5');
  const bounds = await button.boundingBox();
  if (!bounds) throw new Error('Button is not visible');
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await expect(button).toHaveCSS('transform', 'none');
  await expect(button).toHaveCSS('opacity', '0.5');
  await page.mouse.up();
  release();
  await expect(
    page.getByRole('button', { name: 'View', exact: true }),
  ).toBeEnabled();
});
