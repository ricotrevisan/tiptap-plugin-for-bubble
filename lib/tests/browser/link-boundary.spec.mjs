import { test, expect } from '@playwright/test';

// WTF-262: text typed at a link's right edge is plain text, whether the link
// came from the Set link action (Bubble toolbar) or from autolink. Editing
// inside a link, Remove link and HTML/JSON round trips keep working.
// Contract: docs/wtf-262/link-boundary-contract.md.

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
  await page.evaluate(() => {
    first.h.instance.data.teardownEditor('link boundary test uses its own editor');
    window.link = makeHarness('second', { ext_link: true, initialContent: '<p>Read the docs today</p>' });
    // A real button outside the editor, like a Bubble toolbar button: clicking
    // it takes focus away from the editor before the action runs.
    for (const [id, run] of [
      ['set-link', () => link.h.action('setLink', { url: 'https://example.com' })],
      ['remove-link', () => link.h.action('removeLink', {})],
    ]) {
      const button = document.createElement('button');
      button.id = id; button.textContent = id; button.onclick = run;
      document.body.appendChild(button);
    }
  });
  await page.waitForFunction(() => link.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
  expect(page.errors).toEqual([]);
});

const editor = page => page.locator('#second .tiptap');
const html = page => page.evaluate(() => link.h.instance.data.editor.getHTML());
const selection = page => page.evaluate(() => {
  const { from, to } = link.h.instance.data.editor.state.selection;
  return { from, to };
});

// Wait until ProseMirror has read a caret move made with the mouse or keyboard.
const caretAt = (page, pos) => expect.poll(() => selection(page)).toEqual({ from: pos, to: pos });
const hasFocus = page => expect.poll(() => page.evaluate(() => link.h.instance.data.editor.view.hasFocus())).toBe(true);

// Tiptap focuses on the next frame; wait so typing doesn't start before focus lands.
async function focusAt(page, pos) {
  await page.evaluate(pos => link.h.instance.data.editor.commands.focus(pos), pos);
  await hasFocus(page);
  await caretAt(page, pos);
}

// Focus the editor and select one word, as a user would before pressing a
// toolbar link button. The selection is setup, not behavior under test.
async function selectWord(page, word) {
  await focusAt(page, 1);
  const from = await page.evaluate(word => {
    const editor = link.h.instance.data.editor;
    const from = editor.getText().indexOf(word) + 1;
    editor.commands.setTextSelection({ from, to: from + word.length });
    return from;
  }, word);
  await expect.poll(() => selection(page)).toEqual({ from, to: from + word.length });
}

async function linkFromToolbar(page, word) {
  await selectWord(page, word);
  const selected = await selection(page);
  await page.locator('#set-link').click();
  expect(await selection(page), 'Set link keeps the selection').toEqual(selected);
  await expect(editor(page).locator('a')).toHaveText(word);
  await expect.poll(() => page.evaluate(() => link.h.states.link)).toBe(true);
}

// A real click just past the link's right edge puts the caret there.
async function clickRightEdge(page) {
  const box = await editor(page).locator('a').boundingBox();
  await page.mouse.click(box.x + box.width + 1, box.y + box.height / 2);
  await caretAt(page, await page.evaluate(() => {
    const { state } = link.h.instance.data.editor;
    let end = 0;
    state.doc.descendants((node, pos) => { if (node.marks.some(m => m.type.name === 'link')) end = pos + node.nodeSize; });
    return end;
  }));
}

const LINKED_DOCS = '<p>Read the <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">docs</a> today</p>';

test('typing right after a link set from the toolbar is plain text', async ({ page }) => {
  await linkFromToolbar(page, 'docs');
  expect(await html(page)).toBe(LINKED_DOCS);
  await clickRightEdge(page);
  await page.keyboard.type(' now');
  expect(await html(page)).toBe('<p>Read the <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">docs</a> now today</p>');
  await expect(editor(page).locator('a')).toHaveText('docs');
  await expect.poll(() => page.evaluate(() => link.h.states.link)).toBe(false);
});

test('typing after a link at the end of a line is plain text', async ({ page }) => {
  await linkFromToolbar(page, 'today');
  await clickRightEdge(page);
  await page.keyboard.type('!');
  expect(await html(page)).toBe('<p>Read the docs <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">today</a>!</p>');
});

test('typing inside a link extends it; typing at its left edge does not', async ({ page }) => {
  await linkFromToolbar(page, 'docs');
  await clickRightEdge(page);
  await page.keyboard.press('ArrowLeft');
  await caretAt(page, 13);
  await page.keyboard.type('X');
  await expect(editor(page).locator('a')).toHaveText('docXs');
  for (let i = 0; i < 'docX'.length; i++) await page.keyboard.press('ArrowLeft');
  await caretAt(page, 10);
  await page.keyboard.type('Y');
  expect(await html(page)).toBe('<p>Read the Y<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">docXs</a> today</p>');
});

test('Set link with nothing selected links the text typed next, until the caret moves', async ({ page }) => {
  // Caret between "docs" and " today". The action runs while the editor keeps
  // focus, as from a keyboard-shortcut workflow; a toolbar click would blur it.
  await focusAt(page, 14);
  await page.evaluate(() => link.h.action('setLink', { url: 'https://example.com' }));
  await page.keyboard.type(' guide');
  await expect(editor(page).locator('a')).toHaveText(' guide');
  // Moving the caret away and back ends the link: more text is plain.
  await page.keyboard.press('ArrowRight');
  await caretAt(page, 21);
  await page.keyboard.press('ArrowLeft');
  await caretAt(page, 20);
  await page.keyboard.type(' now');
  expect(await html(page)).toBe('<p>Read the docs<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com"> guide</a> now today</p>');
});

test('Backspace while typing a new link keeps it; ArrowRight at the end of a line ends it', async ({ page }) => {
  await focusAt(page, 20);
  await page.evaluate(() => link.h.action('setLink', { url: 'https://example.com' }));
  await page.keyboard.type(' guidd');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('e');
  await expect(editor(page).locator('a')).toHaveText(' guide');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(' now');
  expect(await html(page)).toBe('<p>Read the docs today<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com"> guide</a> now</p>');
});

test('ArrowRight at the end of a paragraph with more text after it ends the link and moves on', async ({ page }) => {
  await page.evaluate(() => link.h.action('setContent', { content: '<p>one</p><p>two</p>', is_json: false, parseOptions_preserveWhitespace: 'false' }));
  await focusAt(page, 4);
  await page.evaluate(() => link.h.action('setLink', { url: 'https://example.com' }));
  await page.keyboard.type(' x');
  await page.keyboard.press('ArrowRight');
  await caretAt(page, 8);
  await page.keyboard.type('Y');
  expect(await html(page)).toBe('<p>one<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com"> x</a></p><p>Ytwo</p>');
});

test('IME composition at a link\'s right edge is plain text', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'IME input is driven through the Chrome DevTools Protocol');
  await linkFromToolbar(page, 'docs');
  await clickRightEdge(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ね', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: 'ねこ', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.insertText', { text: '猫' });
  await expect.poll(() => html(page)).toBe(LINKED_DOCS.replace('</a> today', '</a>猫 today'));
});

test('retyping a selected link keeps the new text linked', async ({ page }) => {
  await linkFromToolbar(page, 'docs');
  await selectWord(page, 'docs');
  await page.keyboard.type('guide');
  expect(await html(page)).toBe('<p>Read the <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">guide</a> today</p>');
  await page.keyboard.type(' more', { delay: 0 });
  await expect(editor(page).locator('a')).toHaveText('guide more');
});

test('pasting over a selected link does not turn the pasted text into a link', async ({ page }) => {
  await linkFromToolbar(page, 'docs');
  await selectWord(page, 'docs');
  await page.evaluate(() => link.h.instance.data.editor.view.pasteText('guide'));
  expect(await html(page)).toBe('<p>Read the guide today</p>');
});

test('Remove link removes the link on purpose and keeps the text', async ({ page }) => {
  await linkFromToolbar(page, 'docs');
  await page.locator('#remove-link').click();
  expect(await html(page)).toBe('<p>Read the docs today</p>');
});

test('autolinked URLs stop at the space the user typed', async ({ page }) => {
  await focusAt(page, 1);
  await page.keyboard.type('see example.com and ');
  expect(await html(page)).toBe('<p>see <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">example.com</a> and Read the docs today</p>');
});

test('links survive HTML and JSON round trips unchanged', async ({ page }) => {
  await linkFromToolbar(page, 'docs');
  const result = await page.evaluate(() => {
    const editor = link.h.instance.data.editor;
    const html = editor.getHTML(), json = JSON.stringify(editor.getJSON());
    link.h.action('setContent', { content: html, is_json: false, parseOptions_preserveWhitespace: 'false' });
    const fromHtml = editor.getHTML();
    link.h.action('setContent', { content: json, is_json: true, parseOptions_preserveWhitespace: 'false' });
    return { html, json, fromHtml, fromJson: JSON.stringify(editor.getJSON()) };
  });
  expect(result.fromHtml).toBe(result.html);
  expect(result.fromJson).toBe(result.json);
});
