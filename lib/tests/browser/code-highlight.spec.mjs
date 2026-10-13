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

test('code changed while the cursor is elsewhere is re-coloured', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code class="language-javascript">let a = 1;</code></pre><p>after</p>', code_highlight: true });
  await page.evaluate(() => {
    const ed2 = ed.h.instance.data.editor;
    ed2.commands.setTextSelection(ed2.state.doc.content.size - 2);  // in the paragraph
    ed2.view.dispatch(ed2.state.tr.insertText(' return "hi";', 11));  // end of the code line; the cursor stays put
    if (ed2.state.selection.$head.parent.type.name === 'codeBlock') throw new Error('cursor moved into the code block');
  });
  const texts = await page.evaluate(() => [...document.querySelectorAll('#second pre [class^="hljs-"]')].map(s => s.className + ':' + s.textContent));
  expect(texts).toContain('hljs-keyword:return');
  expect(texts).toContain('hljs-string:"hi"');
});

test('typing outside code blocks does not re-run highlighting', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code>' + 'function f(a) { return a + 1; }\n'.repeat(100) + '</code></pre><p>x</p>', code_highlight: true });
  const calls = await page.evaluate(() => {
    const ll = window.tiptap.lowlight; let n = 0;
    const auto = ll.highlightAuto, hl = ll.highlight;
    ll.highlightAuto = (...a) => { n++; return auto.apply(ll, a); };
    ll.highlight = (...a) => { n++; return hl.apply(ll, a); };
    const ed2 = ed.h.instance.data.editor;
    for (let i = 0; i < 20; i++) ed2.commands.insertContentAt(ed2.state.doc.content.size - 1, 'y');
    ll.highlightAuto = auto; ll.highlight = hl;
    return n;
  });
  expect(calls).toBe(0);
});

test('a very large block without a language is left plain', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code>' + 'function f(a) { return a + 1; }\n'.repeat(70) + '</code></pre>', code_highlight: true });
  expect(await tokens(page)).toEqual([]);
});

test('an override with unbalanced braces is ignored and does not leak out of the editor', async ({ page }) => {
  await editor(page, { initialContent: JS, code_highlight: true, code_highlight_adv: '.hljs-keyword { color: red; } } body { background: rgb(1, 1, 1); }' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(1, 1, 1)');
  expect(await tokens(page)).toContain('hljs-keyword');
});

test('a block with an unknown language is left plain', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code class="language-mermaid">graph TD; A-->B; function f() { return 1; }</code></pre>', code_highlight: true });
  expect(await tokens(page)).toEqual([]);
});

test('changing a block language re-colours it', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code class="language-mermaid">const answer = 42;</code></pre><p>x</p>', code_highlight: true });
  expect(await tokens(page)).toEqual([]);
  await page.evaluate(() => { const e = ed.h.instance.data.editor; e.view.dispatch(e.state.tr.setNodeAttribute(0, 'language', 'javascript')); });
  expect(await tokens(page)).toContain('hljs-keyword');
});

test('a moved code block keeps its colours', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code class="language-javascript">const answer = 42;</code></pre><p>one</p><p>two</p>', code_highlight: true });
  await page.evaluate(() => {
    const e = ed.h.instance.data.editor; const node = e.state.doc.child(0);
    const tr = e.state.tr.delete(0, node.nodeSize); tr.insert(tr.doc.content.size, node); e.view.dispatch(tr);
  });
  expect(await page.evaluate(() => ed.h.instance.data.editor.state.doc.lastChild.type.name)).toBe('codeBlock');
  expect(await tokens(page)).toContain('hljs-keyword');
});

test('typing outside code blocks keeps the existing colouring', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code class="language-javascript">const a = 1;</code></pre><pre><code class="language-javascript">let b = 2;</code></pre><p>x</p>', code_highlight: true });
  const same = await page.evaluate(() => {
    const e = ed.h.instance.data.editor;
    const key = e.state.plugins.find(pl => pl.key.startsWith('codeHighlight$')).spec.key;
    const before = key.getState(e.state).find(1, 12)[0].type;  // find() copies decorations; the type is shared
    e.commands.insertContentAt(e.state.doc.content.size - 1, 'y');
    const after = key.getState(e.state).find(1, 12)[0].type;  // find() copies decorations; the type is shared
    return before === after;
  });
  expect(same).toBe(true);
});

test('editing one code block keeps the colouring of the others', async ({ page }) => {
  await editor(page, { initialContent: '<pre><code class="language-javascript">const a = 1;</code></pre><pre><code class="language-javascript">let b = 2;</code></pre><p>x</p>', code_highlight: true });
  const r = await page.evaluate(() => {
    const e = ed.h.instance.data.editor;
    const key = e.state.plugins.find(pl => pl.key.startsWith('codeHighlight$')).spec.key;
    const before = key.getState(e.state).find(1, 12)[0].type;  // find() copies decorations; the type is shared
    const second = e.state.doc.child(0).nodeSize;
    e.view.dispatch(e.state.tr.insertText(' return b;', second + 1 + 10));
    const after = key.getState(e.state).find(1, 12)[0].type;  // find() copies decorations; the type is shared
    return { same: before === after };
  });
  expect(r.same).toBe(true);
  expect(await tokens(page)).toContain('hljs-keyword');
  const texts = await page.evaluate(() => [...document.querySelectorAll('#second pre [class^="hljs-"]')].map(s => s.textContent));
  expect(texts).toContain('return');
});
