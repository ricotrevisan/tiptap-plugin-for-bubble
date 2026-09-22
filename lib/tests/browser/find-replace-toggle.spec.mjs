import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
  expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
});

test('real Find & Replace actions work after toggling on and preserve the draft', async ({ page }) => {
  const editor = page.locator('#first .tiptap');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' cat cat draft');
  await page.evaluate(() => {
    window.oldEditor = first.h.instance.data.editor;
    first.properties.ext_find_replace = true;
    first.h.update(first.properties);
  });
  await page.waitForFunction(() => first.h.states.is_ready);
  expect(await page.evaluate(() => oldEditor.isDestroyed)).toBe(true);
  await expect(editor).toContainText('cat cat draft');
  expect(await page.evaluate(() => !!window.tiptap.FindAndReplace)).toBe(true);
  await page.evaluate(() => first.h.action('find', { search_term: 'cat', whole_word: true }));
  await expect.poll(() => page.evaluate(() => JSON.parse(first.h.states.find_replace_state).matchCount)).toBe(2);
  await page.evaluate(() => first.h.action('replace', { replacement: 'dog' }));
  await expect(editor).toContainText('dog cat draft');
  await page.evaluate(() => first.h.action('replaceAll', { replacement: 'fox' }));
  await expect(editor).toContainText('dog fox draft');
  await page.evaluate(() => { first.properties.ext_find_replace = false; first.h.update(first.properties); });
  await page.waitForFunction(() => first.h.states.is_ready);
  await expect(editor).toContainText('dog fox draft');
  expect(await page.evaluate(() => JSON.parse(first.h.states.find_replace_state).matchCount)).toBe(0);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' still editable');
  await expect(editor).toContainText('still editable');
});

test('Find & Replace enabled at startup works with JSON content', async ({ page }) => {
  await page.evaluate(() => {
    window.second = makeHarness('second', {
      ext_find_replace: true,
      content_is_json: true,
      initialContent: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alpha alpha alphabet' }] }] }),
    });
  });
  await page.waitForFunction(() => second.h.states.is_ready);
  await page.evaluate(() => second.h.action('find', { search_term: 'alpha', whole_word: true, case_sensitive: true }));
  expect(await page.evaluate(() => JSON.parse(second.h.states.find_replace_state).matchCount)).toBe(1);
  await page.evaluate(() => second.h.action('replaceAll', { replacement: '' }));
  await expect(page.locator('#second .tiptap')).toHaveText('Alpha  alphabet');
});
