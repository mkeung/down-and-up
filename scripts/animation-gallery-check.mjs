import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const gallery = new URL('../OfficialAssets/Animations/01e/', import.meta.url);
const actions = JSON.parse(
  await readFile(new URL('manifest.json', gallery), 'utf8'),
).animations;
const reactions = JSON.parse(
  await readFile(new URL('reactions/manifest.json', gallery), 'utf8'),
).animations;
assert.equal(actions.length, 5);
assert.deepEqual(
  reactions.map((reaction) => reaction.value),
  Array.from({ length: 10 }, (_, i) => i + 1),
);
const browser = await chromium.launch({
  executablePath: process.env.ANIMATION_GALLERY_BROWSER || undefined,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
    reducedMotion: 'reduce',
  });
  const errors = [],
    network = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  await page.goto(new URL('index.html', gallery).href);
  await page.waitForFunction(() =>
    [...document.images].every(
      (img) => img.complete && img.naturalWidth === 512,
    ),
  );
  await expect(page.locator('#everyday article')).toHaveCount(5);
  await expect(page.locator('#reactions article')).toHaveCount(10);
  for (const action of actions)
    await expect(page.locator(`[data-id="${action.id}"] .counter`)).toHaveText(
      '1 / 8',
    );
  for (const reaction of reactions) {
    const card = page.locator(`[data-id="${reaction.id}"]`);
    await expect(card.locator('.counter')).toHaveText('8 / 8');
    await expect(card.locator('img')).toHaveAttribute(
      'src',
      'reactions/' + reaction.frames[7],
    );
    await page
      .locator(`.keypad button[data-value="${reaction.value}"]`)
      .click();
    await expect(page.locator('#demo-player img')).toHaveAttribute(
      'src',
      'reactions/' + reaction.frames[7],
    );
    await expect(
      page.locator('.keypad button[aria-pressed="true"]'),
    ).toHaveText(String(reaction.value));
    await expect(card.locator('.downloads a').first()).toHaveAttribute(
      'href',
      'reactions/' + reaction.gif,
    );
  }
  // Manual playback remains available with Reduce Motion; one-shot reactions hold.
  await page.locator('#speed').selectOption('2');
  await page.locator('#play-all').click();
  await expect(page.locator('[data-id="reaction-10"] .counter')).toHaveText(
    '8 / 8',
  );
  await expect(page.locator('[data-id="reaction-10"] .toggle')).toHaveText(
    'Play',
  );
  await expect(page.locator('[data-id="walking"] .toggle')).toHaveText('Pause');
  await expect(page.locator('[data-id="food-can"] .toggle')).toHaveText('Play');
  await page.locator('#pause-all').click();
  for (const button of await page.locator('.toggle').all())
    await expect(button).toHaveText('Play');
  const reaction = page.locator('[data-id="reaction-05"]');
  await reaction.locator('.scrub').fill('3');
  await expect(reaction.locator('img')).toHaveAttribute(
    'src',
    'reactions/reaction-05/frames/03.png',
  );
  await page.locator('#final-poses').click();
  await expect(reaction.locator('.counter')).toHaveText('8 / 8');
  await expect(page.locator('#demo-player .counter')).toHaveText('8 / 8');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.keypad button[data-value="10"]').click();
  await expect(page.locator('#demo-player img')).toHaveAttribute(
    'src',
    'reactions/reaction-10/frames/01.png',
  );
  await page.locator('.keypad button[data-value="3"]').click();
  await expect(page.locator('#demo-player img')).toHaveAttribute(
    'src',
    'reactions/reaction-03/frames/08.png',
  );
  await expect(page.locator('#demo-player .toggle')).toHaveText('Play');
  await page.locator('#background').selectOption('dark');
  await expect(page.locator('body')).toHaveAttribute('data-background', 'dark');
  await page.locator('#background').selectOption('ivory');
  if (process.env.ANIMATION_GALLERY_SCREENSHOTS) {
    await mkdir(process.env.ANIMATION_GALLERY_SCREENSHOTS, { recursive: true });
    await page.locator('#reactions').screenshot({
      path: path.join(
        process.env.ANIMATION_GALLERY_SCREENSHOTS,
        'reactions.png',
      ),
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert(
    await page.locator('.keypad button').evaluateAll((keys) =>
      keys.every((key) => {
        const { width, height } = key.getBoundingClientRect();
        return width >= 64 && height >= 64;
      }),
    ),
  );
  if (process.env.ANIMATION_GALLERY_SCREENSHOTS)
    await page.locator('.demo').screenshot({
      path: path.join(
        process.env.ANIMATION_GALLERY_SCREENSHOTS,
        'mobile-keypad.png',
      ),
    });
  await page.reload();
  await expect(page.locator('[data-id="walking"] .toggle')).toHaveText('Pause');
  await expect(page.locator('[data-id="reaction-01"] .toggle')).toHaveText(
    'Play',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-id="walking"] .toggle')).toHaveText('Play');
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  console.log(
    'Gallery verified: fifteen previews, ten keypad mappings, shared controls, one-shot holds, Reduce Motion, offline loading, and mobile layout.',
  );
} finally {
  await browser.close();
}
