import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// WTF-234: Mathematics with real mouse and keyboard, and real KaTeX CSS/fonts.
// The pinned jsDelivr files are served from node_modules/katex (the same bytes,
// so SRI still applies). Contract: docs/wtf-234/math-contract.md.

const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.29/dist/';
const MATH_HTML = '<p>Area <span data-type="inline-math" data-latex="\\pi r^2"></span> here</p>'
  + '<div data-type="block-math" data-latex="\\sum_{i=1}^n i"></div><p>Bad <span data-type="inline-math" data-latex="\\frac{"></span></p>';
const types = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  page.katexRequests = [];
  await page.route(KATEX + '**', async route => {
    const file = new URL(route.request().url()).pathname.split('/dist/')[1];
    page.katexRequests.push(file);
    const body = await readFile(resolve('node_modules/katex/dist', file));
    await route.fulfill({ body, headers: { 'Content-Type': types[file.slice(file.lastIndexOf('.'))], 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
  expect(page.errors).toEqual([]);
});

async function mathEditor(page, overrides = {}) {
  await page.evaluate(overrides => {
    first.h.instance.data.teardownEditor('math test uses its own editor');
    window.math = makeHarness('second', { ext_math: true, initialContent: overrides.html, ...overrides });
  }, { html: MATH_HTML, ...overrides });
  await page.waitForFunction(() => math.h.states.is_ready);
}
const clicks = page => page.evaluate(() => math.h.events.filter(event => event.name === 'math_clicked')
  .map(event => [event.states.selected_math_latex, event.states.selected_math_type]));
const mathStates = page => page.evaluate(() => [math.h.states.selected_math_latex, math.h.states.selected_math_type]);
const formulas = page => page.evaluate(() => {
  const found = [];
  math.h.instance.data.editor.state.doc.descendants(node => {
    if (/Math$/.test(node.type.name)) found.push([node.type.name, node.attrs.latex]);
  });
  return found;
});

test('toggle off loads no KaTeX files', async ({ page }) => {
  await page.evaluate(() => { window.plain = makeHarness('second', { initialContent: '<p>No math</p>' }); });
  await page.waitForFunction(() => plain.h.states.is_ready);
  expect(page.katexRequests).toEqual([]);
  expect(await page.locator('[data-tiptap-katex]').count()).toBe(0);
});

test('formulas render with KaTeX fonts; invalid LaTeX is red', async ({ page }) => {
  await mathEditor(page);
  const inline = page.locator('#second .tiptap-mathematics-render').first();
  await expect(inline.locator('.katex')).toBeVisible();
  await expect(page.locator('#second .katex-display')).toBeVisible();
  expect(await inline.locator('.katex').evaluate(element => getComputedStyle(element).fontFamily)).toMatch(/KaTeX_Main/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px KaTeX_Main'))).toBe(true);
  expect(page.katexRequests).toEqual(expect.arrayContaining(['katex.min.css', 'katex.min.js']));
  expect(page.katexRequests.some(file => /^fonts\/KaTeX_Main/.test(file))).toBe(true);
  const invalid = page.locator('#second .katex-error');
  await expect(invalid).toHaveText('\\frac{');
  expect(await invalid.evaluate(element => getComputedStyle(element).color)).toBe('rgb(204, 0, 0)');
});

test('a click selects a formula and fires Math clicked once, after the states', async ({ page }) => {
  await mathEditor(page);
  await page.locator('#second .tiptap-mathematics-render').first().click();
  await expect.poll(() => clicks(page)).toEqual([['\\pi r^2', 'inline']]);
  expect(await page.evaluate(() => math.h.instance.data.editor.state.selection.node?.type.name)).toBe('inlineMath');
  await expect(page.locator('#second .ProseMirror-selectednode')).toHaveCount(1);
  await page.locator('#second .katex-display').click();
  await expect.poll(() => clicks(page)).toEqual([['\\pi r^2', 'inline'], ['\\sum_{i=1}^n i', 'block']]);

  // A Bubble popup: an input outside the editor, then Update math.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'popup-latex';
    document.body.appendChild(input);
  });
  await page.locator('#popup-latex').fill('\\int_0^1 x\\,dx');
  await page.evaluate(() => math.h.action('updateMath', { latex: document.getElementById('popup-latex').value }));
  expect(await formulas(page)).toEqual([['inlineMath', '\\pi r^2'], ['blockMath', '\\int_0^1 x\\,dx'], ['inlineMath', '\\frac{']]);
  expect(await mathStates(page)).toEqual(['\\int_0^1 x\\,dx', 'block']);
  await page.evaluate(() => math.h.action('deleteMath', {}));
  expect((await formulas(page)).length).toBe(2);
  expect(await mathStates(page)).toEqual(['', '']);
});

test('arrow keys select a formula without firing Math clicked', async ({ page }) => {
  await mathEditor(page);
  // Caret just before the inline formula ("Area |"); placing it is setup.
  await page.evaluate(() => math.h.instance.data.editor.commands.focus(6));
  await expect.poll(() => page.evaluate(() => math.h.instance.data.editor.view.hasFocus())).toBe(true);
  await expect.poll(() => page.evaluate(() => math.h.instance.data.editor.state.selection.from)).toBe(6);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => mathStates(page)).toEqual(['\\pi r^2', 'inline']);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => mathStates(page)).toEqual(['', '']);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => mathStates(page)).toEqual(['\\pi r^2', 'inline']);
  expect(await clicks(page)).toEqual([]);
});

test('typing $$…$$ and $$$…$$$ makes formulas; currency stays text', async ({ page }) => {
  await mathEditor(page, { html: '<p></p>' });
  await page.locator('#second .tiptap').click();
  await page.keyboard.type('It costs $5 or $10. ');
  await page.keyboard.type('$$x^2$$');
  await page.keyboard.press('Enter');
  await page.keyboard.type('$$$y_1$$$');
  expect(await formulas(page)).toEqual([['inlineMath', 'x^2'], ['blockMath', 'y_1']]);
  expect(await page.evaluate(() => math.h.instance.data.editor.getText())).toMatch(/^It costs \$5 or \$10\. /);
  await expect(page.locator('#second .katex')).toHaveCount(2);
});

test('read-only: a click does nothing', async ({ page }) => {
  await mathEditor(page, { isEditable: false });
  const before = await page.evaluate(() => math.h.instance.data.editor.state.selection.toJSON());
  await page.locator('#second .tiptap-mathematics-render').first().click();
  await page.waitForTimeout(100);
  expect(await clicks(page)).toEqual([]);
  expect(await mathStates(page)).toEqual(['', '']);
  expect(await page.evaluate(() => math.h.instance.data.editor.state.selection.toJSON())).toEqual(before);
});
