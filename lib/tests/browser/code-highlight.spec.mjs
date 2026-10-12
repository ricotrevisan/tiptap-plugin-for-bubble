import { test, expect } from '@playwright/test';

// DEF-1927: Syntax highlighting for code blocks. Off by default; on uses lowlight (highlight.js
// common languages) with a chosen theme. Colouring is decorations only: the saved HTML, and
// so Bubble, emails and collaboration, are unchanged.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

const JS = '<pre><code class="language-javascript">const answer = 42; // done</code></pre><p>after</p>';

async function editor(page, overrides = {}) {
  await page.evaluate(overrides => {
    for (const h of [window.first, window.ed]) if (h && h.h.instance.data.editor) h.h.instance.data.teardownEditor('code highlight test uses its own editor');
    document.getElementById('second').replaceChildren();
    window.ed = makeHarness('second', { ext_codeblock: true, initialContent: overrides.initialContent || '<p>x</p>', ...overrides });
  }, overrides);
  await page.waitForFunction(() => ed.h.states.is_ready);
}

const tokens = page => page.evaluate(() => [...document.querySelectorAll('#second pre [class^="hljs-"]')].map(s => s.className));
const style = (page, sel, prop) => page.evaluate(([sel, prop]) => {
  const el = document.querySelector('#second ' + sel);
  return el ? getComputedStyle(el)[prop] : null;
}, [sel, prop]);

test('off by default: code blocks are not coloured', async ({ page }) => {
  await editor(page, { initialContent: JS });
  expect(await tokens(page)).toEqual([]);
});

test('on: code is coloured with the GitHub theme by default; saved HTML is unchanged', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true });
  const t = await tokens(page);
  expect(t).toContain('hljs-keyword');
  expect(t).toContain('hljs-number');
  expect(t).toContain('hljs-comment');
  expect(await style(page, '.hljs-keyword', 'color')).toBe('rgb(215, 58, 73)');   // GitHub keyword red
  const html = await page.evaluate(() => ed.h.instance.data.editor.getHTML());
  expect(html).toBe('<pre><code class="language-javascript">const answer = 42; // done</code></pre><p>after</p>');
});

test('typing ``` with a language starts a highlighted block', async ({ page }) => {
  await editor(page, { initialContent: '<p></p>', code_highlight: true });
  await page.locator('#second .tiptap').click();
  await page.keyboard.type('```python ');
  await page.keyboard.type('def f(): return None');
  expect(await page.evaluate(() => document.querySelector('#second pre code').className)).toContain('language-python');
  expect(await tokens(page)).toContain('hljs-keyword');
});

test('a block without a language is auto-detected', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code>function add(a, b) {\n  return a + b;\n}</code></pre>', code_highlight: true });
  expect((await tokens(page)).length).toBeGreaterThan(0);
});

test('the theme dropdown switches colours; None leaves styling to the app', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: 'GitHub Dark' });
  expect(await style(page, '.ProseMirror pre', 'backgroundColor')).toBe('rgb(13, 17, 23)');
  expect(await style(page, '.hljs-keyword', 'color')).toBe('rgb(255, 123, 114)');
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: 'Monokai' });
  expect(await style(page, '.ProseMirror pre', 'backgroundColor')).toBe('rgb(39, 40, 34)');
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: 'None' });
  expect(await tokens(page)).toContain('hljs-keyword');
  expect(await style(page, '.hljs-keyword', 'color')).toBe(await style(page, '.ProseMirror pre code', 'color'));
});

test('every theme in the dropdown has styles', async ({ page }) => {
  const themes = await page.evaluate(() => Object.keys(window.tiptap.codeThemes));
  expect(themes).toEqual(['GitHub', 'GitHub Dark', 'Atom One Light', 'Atom One Dark', 'Monokai', 'Nord', 'Stack Overflow Light', 'Tokyo Night Dark']);
  for (const theme of themes) {
    await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: theme });
    const kw = await style(page, '.hljs-keyword', 'color');
    expect(kw, theme).not.toBe(await style(page, '.ProseMirror pre code', 'color'));
  }
});

test('the theme stays inside its editor', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: 'Monokai' });
  const outside = await page.evaluate(() => {
    const pre = document.createElement('pre'); const span = document.createElement('span'); span.className = 'hljs-keyword'; span.textContent = 'const';
    pre.appendChild(span); document.body.appendChild(pre);
    const r = [getComputedStyle(pre).backgroundColor, getComputedStyle(span).color]; pre.remove(); return r;
  });
  expect(outside[0]).not.toBe('rgb(39, 40, 34)');
});

test('Code highlighting CSS override wins over the theme', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_adv: '.hljs-keyword { color: rgb(1, 2, 3); }' });
  expect(await style(page, '.hljs-keyword', 'color')).toBe('rgb(1, 2, 3)');
});

test('the override can style the code block itself', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: 'GitHub Dark', code_highlight_adv: '& { background: rgb(4, 5, 6); }' });
  expect(await style(page, '.ProseMirror pre', 'backgroundColor')).toBe('rgb(4, 5, 6)');
});

test('the GitHub theme block is visible on a white editor and padded', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true });
  expect(await style(page, '.ProseMirror pre', 'backgroundColor')).toBe('rgb(246, 248, 250)');
  expect(await style(page, '.ProseMirror pre', 'paddingLeft')).not.toBe('0px');
});

test('Code block CSS override still wins over the theme', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_theme: 'Monokai', codeblock_adv: 'background: rgb(7, 8, 9);' });
  expect(await style(page, '.ProseMirror pre', 'backgroundColor')).toBe('rgb(7, 8, 9)');
});
