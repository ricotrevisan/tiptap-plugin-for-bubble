import { test, expect } from '@playwright/test';

// Submit on Enter (chat composers), with the real keyboard: a plain Enter
// fires Enter pressed once and adds no new line. Shift+Enter, code blocks,
// list items, an open mention list and IME composition keep Enter's usual
// meaning. Off by default.

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
  await page.evaluate(() => first.h.instance.data.teardownEditor('submit on Enter test uses its own editor'));
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
  expect(page.errors).toEqual([]);
});

async function composer(page, overrides = {}) {
  await page.evaluate(overrides => {
    window.composer = makeHarness('second', {
      initialContent: '<p></p>', submit_on_enter: true,
      ext_codeblock: true, ext_bulletlist: true, ...overrides,
    });
  }, overrides);
  await page.waitForFunction(() => composer.h.states.is_ready);
  await page.locator('#second .tiptap').click();
  await expect.poll(() => page.evaluate(() => composer.h.instance.data.editor.view.hasFocus())).toBe(true);
}

const html = page => page.evaluate(() => composer.h.instance.data.editor.getHTML());
// The text Content (Plain Text) held when each Enter pressed fired.
const pressed = page => page.evaluate(() => composer.h.events.filter(e => e.name === 'enter_pressed').map(e => e.states.contentText));

test('Enter fires Enter pressed once with the typed text and adds no line', async ({ page }) => {
  await composer(page);
  await page.keyboard.type('Hello there');
  await page.keyboard.press('Enter');
  expect(await pressed(page)).toEqual(['Hello there']);
  expect(await html(page)).toBe('<p>Hello there</p>');
  // Pending edits are submitted first, as on blur: Content updated precedes it.
  const names = await page.evaluate(() => composer.h.events.map(e => e.name));
  expect(names.indexOf('contentUpdated')).toBeGreaterThanOrEqual(0);
  expect(names.indexOf('contentUpdated')).toBeLessThan(names.indexOf('enter_pressed'));
  // Mid-sentence, the paragraph is not split.
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await pressed(page)).toEqual(['Hello there', 'Hello there']);
  expect(await html(page)).toBe('<p>Hello there</p>');
});

test('Shift+Enter adds a line break with Hard Break on', async ({ page }) => {
  await composer(page, { ext_hardbreak: true });
  await page.keyboard.type('one');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('two');
  expect(await html(page)).toBe('<p>one<br>two</p>');
  expect(await pressed(page)).toEqual([]);
  await page.keyboard.press('Enter');
  expect(await pressed(page)).toEqual(['one\ntwo']);
});

test('Shift+Enter starts a new paragraph with Hard Break off', async ({ page }) => {
  await composer(page, { ext_hardbreak: false });
  await page.keyboard.type('one');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('two');
  expect(await html(page)).toBe('<p>one</p><p>two</p>');
  expect(await pressed(page)).toEqual([]);
});

test('Enter keeps its meaning in a code block', async ({ page }) => {
  await composer(page);
  await page.keyboard.type('``` '); // the code block input rule
  await page.keyboard.type('const a = 1;');
  await page.keyboard.press('Enter');
  await page.keyboard.type('const b = 2;');
  expect(await html(page)).toBe('<pre><code>const a = 1;\nconst b = 2;</code></pre>');
  expect(await pressed(page)).toEqual([]);
});

test('Enter adds list items; Enter on an empty item leaves the list, the next one sends', async ({ page }) => {
  await composer(page);
  await page.keyboard.type('- one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  expect(await html(page)).toBe('<ul><li><p>one</p></li><li><p>two</p></li></ul>');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  expect(await html(page)).toBe('<ul><li><p>one</p></li><li><p>two</p></li></ul><p></p>');
  expect(await pressed(page)).toEqual([]);
  await page.keyboard.press('Enter');
  expect(await pressed(page)).toHaveLength(1);
});

test('an open mention list takes Enter; once it closes, Enter sends', async ({ page }) => {
  await composer(page);
  await page.keyboard.type('Hi @Ada');
  await expect(page.locator('.tippy-content')).toContainText('Ada Lovelace');
  await page.keyboard.press('Enter');
  await expect(page.locator('#second [data-type="mention"]')).toHaveAttribute('data-id', 'ada');
  expect(await pressed(page)).toEqual([]);
  await page.keyboard.press('Enter');
  await expect.poll(() => pressed(page)).toHaveLength(1);
});

test('Enter that confirms IME composition does not send', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'IME input is driven through the Chrome DevTools Protocol');
  await composer(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ね', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: 'ねこ', selectionStart: 2, selectionEnd: 2 });
  // The Enter keydown that commits a composition reaches the page while composing.
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 });
  await cdp.send('Input.insertText', { text: '猫' });
  await expect.poll(() => html(page)).toBe('<p>猫</p>');
  expect(await pressed(page)).toEqual([]);
  // After composition, a plain Enter sends.
  await page.keyboard.press('Enter');
  expect(await pressed(page)).toEqual(['猫']);
});

test('off (the default): Enter starts a new paragraph and fires nothing; turning it on needs no rebuild', async ({ page }) => {
  await composer(page, { submit_on_enter: undefined });
  await page.keyboard.type('one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  expect(await html(page)).toBe('<p>one</p><p>two</p>');
  expect(await pressed(page)).toEqual([]);
  const same = await page.evaluate(() => {
    const before = composer.h.instance.data.editor;
    composer.h.update({ ...composer.properties, submit_on_enter: true });
    return composer.h.instance.data.editor === before;
  });
  expect(same).toBe(true);
  await page.keyboard.press('Enter');
  expect(await pressed(page)).toEqual(['one\n\ntwo']);
  expect(await html(page)).toBe('<p>one</p><p>two</p>');
});
