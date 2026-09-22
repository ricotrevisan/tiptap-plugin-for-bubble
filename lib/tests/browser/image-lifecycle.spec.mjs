import { test, expect } from '@playwright/test';
const imageURL = 'https://example.test/forum645.png';

test('Insert image exposes URLs; keyboard deletion publishes removed URLs before its event', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://example.test/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="blue"/></svg>' }));
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
  await page.evaluate(() => {
    window.second = makeHarness('second', { ext_image: true, initialContent: '<p>Image test</p>' });
  });
  await page.waitForFunction(() => second.h.states.is_ready);
  await page.evaluate(url => second.h.action('insertImage', { insert_image: url, alt_text: 'Test image' }), imageURL);
  expect(await page.evaluate(() => second.h.states.fileUploadUrls)).toEqual([imageURL]);
  expect(await page.evaluate(() => second.h.events.filter(e => e.name === 'fileUploaded').length)).toBe(0);
  // Start the deletion scenario from loaded content, so undo targets deletion
  // rather than grouping the just-inserted image into the same history event.
  await page.evaluate(url => {
    second.h.instance.data.teardownEditor('deletion scenario');
    window.second = makeHarness('second', { ext_image: true, initialContent: `<p>Before</p><img src="${url}"><p>After</p>` });
  }, imageURL);
  await page.waitForFunction(() => second.h.states.is_ready);
  const image = page.locator('#second .tiptap img');
  await expect(image).toHaveCount(1);
  await image.click();
  await page.keyboard.press('Backspace');
  await expect(image).toHaveCount(0);
  expect(await page.evaluate(() => second.h.events.filter(e => e.name === 'image_deleted').at(-1)?.states.removed_image_urls)).toEqual([imageURL]);
  // Undo restores the image; redo reports removal again. No stored file is deleted.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(image).toHaveCount(1);
  expect(await page.evaluate(() => second.h.events.filter(e => e.name === 'image_deleted').length)).toBe(1);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(image).toHaveCount(0);
  expect(await page.evaluate(() => second.h.events.filter(e => e.name === 'image_deleted').length)).toBe(2);
  // Replacing a document that contains images is not a file-deletion signal.
  await page.evaluate(url => second.h.action('setContent', { content: `<p>Loaded</p><img src="${url}"><p>Tail</p>`, is_json: false }), imageURL);
  await expect(image).toHaveCount(1);
  await page.evaluate(() => second.h.action('setContent', { content: '<p>Another document</p>', is_json: false }));
  await expect(image).toHaveCount(0);
  expect(await page.evaluate(() => second.h.events.filter(e => e.name === 'image_deleted').length)).toBe(2);
  expect(await page.evaluate(() => second.h.states.removed_image_urls)).toEqual([]);
  expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
  expect(errors).toEqual([]);
});
