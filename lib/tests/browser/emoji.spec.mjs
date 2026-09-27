import { test, expect } from '@playwright/test';

// WTF-236: real keyboard insertion, Bubble workflow action and live toggle.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

const nodes = page => page.evaluate(() => {
  const found = [];
  emoji.h.instance.data.editor.state.doc.descendants(node => {
    if (node.type.name === 'emoji') found.push(node.attrs.name);
  });
  return found;
});

async function emojiEditor(page, overrides = {}) {
  await page.evaluate(overrides => {
    first.h.instance.data.teardownEditor('emoji test uses its own editor');
    window.emoji = makeHarness('second', { ext_emoji: true, initialContent: '<p></p>', ...overrides });
  }, overrides);
  await page.waitForFunction(() => emoji.h.states.is_ready);
}

test('typing a shortcode and Bubble Insert emoji create inline nodes; HTML and JSON reload', async ({ page }) => {
  await emojiEditor(page);
  await page.locator('#second .tiptap').click();
  await page.keyboard.type('Hello :smile: ');
  expect(await nodes(page)).toEqual(['smile']);
  await page.evaluate(() => emoji.h.action('insertEmoji', { emoji_name: ':heart:' }));
  expect(await nodes(page)).toEqual(['smile', 'heart']);
  const saved = await page.evaluate(() => {
    const editor = emoji.h.instance.data.editor;
    return { html: editor.getHTML(), json: editor.getJSON() };
  });
  expect(saved.html).toContain('data-type="emoji"');
  await page.evaluate(({ html }) => emoji.h.action('setContent', { content: html, is_json: false }), saved);
  expect(await nodes(page)).toEqual(['smile', 'heart']);
  await page.evaluate(({ json }) => emoji.h.action('setContent', { content: JSON.stringify(json), is_json: true }), saved);
  expect(await nodes(page)).toEqual(['smile', 'heart']);
  await page.evaluate(() => { emoji.properties.ext_emoji = false; emoji.h.update(emoji.properties); });
  await page.waitForFunction(() => emoji.h.instance.data.editor_is_ready && !emoji.h.instance.data.editor.schema.nodes.emoji);
  expect(await page.locator('#second .tiptap').innerText()).toContain('😄');
  expect(await page.locator('#second .tiptap').innerText()).toContain('❤');
});

test('pasting a known shortcode makes an emoji node', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'headless clipboard permissions are Chromium-only');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await emojiEditor(page);
  await page.locator('#second .tiptap').click();
  await page.evaluate(() => navigator.clipboard.writeText('Say :smile: now'));
  await page.keyboard.press('ControlOrMeta+V');
  expect(await nodes(page)).toEqual(['smile']);
  await expect(page.locator('#second .tiptap')).toContainText('Say 😄 now');
});

test('off by default and read-only emoji content renders', async ({ page }) => {
  expect(await page.evaluate(() => first.h.instance.data.editor.schema.nodes.emoji)).toBeUndefined();
  await emojiEditor(page, { isEditable: false,
    initialContent: '<p>Hi <span data-type="emoji" data-name="smile">😄</span></p>' });
  expect(await nodes(page)).toEqual(['smile']);
  await expect(page.locator('#second span[data-type="emoji"]')).toBeVisible();
  expect(await page.evaluate(() => emoji.h.instance.data.editor.isEditable)).toBe(false);
});
