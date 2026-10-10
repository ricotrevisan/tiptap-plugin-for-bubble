import { test, expect } from '@playwright/test';

// DEF-1927: the drag handle is styled (its rule used to sit inside .ProseMirror, which the
// handle is not in) and centred on the first line of the hovered block, so it lines up
// with paragraphs and headings and stays on the first line of a long list item.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
  await page.evaluate(() => {
    first.h.instance.data.teardownEditor('drag handle test uses its own editor');
    window.dh = makeHarness('second', {
      ext_draghandle: true, ext_bulletlist: true, ext_listkeymap: true, ext_tasklist: true,
      initialContent: '<p>Short paragraph</p><h3>Heading three</h3><h1>Big heading</h1>'
        + '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task one</p></li></ul>'
        + '<ul><li><p>' + 'A long bullet item that wraps over several lines. '.repeat(6) + '</p></li></ul><p></p>',
    });
  });
  await page.waitForFunction(() => dh.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

// Hover a block, wait for the handle to settle, return the handle's and first glyph's geometry.
async function hover(page, selector) {
  const block = page.locator(`#second .tiptap > ${selector}`).first();
  const box = await block.boundingBox();
  await page.mouse.move(box.x + 40, box.y + box.height - 4);
  await page.waitForFunction(sel => {
    const h = document.querySelector('#second .tiptap-drag-handle');
    if (!h || h.style.visibility === 'hidden' || !h.style.top) return false;
    const key = h.style.top + h.style.left + sel;
    if (window.__dhLast === key) return true;
    window.__dhLast = key;
    return false;
  }, selector, { polling: 100 });
  return page.evaluate(sel => {
    const block = document.querySelector(`#second .tiptap > ${sel}`);
    const handle = document.querySelector('#second .tiptap-drag-handle').getBoundingClientRect();
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.pmViewDesc && n.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
    const text = walker.nextNode();
    let glyph = null;
    if (text) {
      const range = document.createRange();
      range.setStart(text, 0); range.setEnd(text, 1);
      glyph = range.getBoundingClientRect();
    }
    const b = block.getBoundingClientRect();
    return { handleMid: handle.top + handle.height / 2, handleRight: handle.right, handleH: handle.height,
      glyphMid: glyph && glyph.top + glyph.height / 2, blockTop: b.top, blockMid: b.top + b.height / 2, blockLeft: b.left, blockH: b.height };
  }, selector);
}

test('the handle is styled and centred on the first line of each block', async ({ page }) => {
  const style = await page.evaluate(() => {
    const h = document.querySelector('#second .tiptap-drag-handle');
    const s = getComputedStyle(h);
    return { cursor: s.cursor, display: s.display, width: h.getBoundingClientRect().width };
  });
  expect(style).toEqual({ cursor: 'grab', display: 'flex', width: 14 });

  for (const selector of ['p', 'h3', 'h1', 'ul[data-type="taskList"]']) {
    const g = await hover(page, selector);
    expect(Math.abs(g.handleMid - g.glyphMid), selector).toBeLessThanOrEqual(1.5);
    expect(g.handleRight, selector).toBeLessThanOrEqual(g.blockLeft);
  }

  // Tiptap's default (left-start) aligns the handle's top with the block's top; on a large
  // heading that is visibly above the text.
  const h1 = await hover(page, 'h1');
  expect(h1.handleMid - (h1.blockTop + h1.handleH / 2)).toBeGreaterThan(5);

  const li = await hover(page, 'ul:not([data-type])');
  expect(li.blockH).toBeGreaterThan(3 * li.handleH);  // really wraps
  expect(Math.abs(li.handleMid - li.glyphMid)).toBeLessThanOrEqual(1.5);
  expect(li.handleMid).toBeLessThan(li.blockMid - li.handleH);  // on the first line, not the middle
});

test('an empty paragraph gets the handle on its line', async ({ page }) => {
  const g = await hover(page, 'p:last-child');
  expect(g.glyphMid).toBeNull();
  expect(Math.abs(g.handleMid - (g.blockTop + g.blockH / 2))).toBeLessThanOrEqual(2);
});

test('dragging by the handle still moves the block', async ({ page }) => {
  await hover(page, 'h3');
  const handle = await page.locator('#second .tiptap-drag-handle').boundingBox();
  const target = await page.locator('#second .tiptap > p').first().boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 30, target.y + 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => dh.h.instance.data.editor.getJSON().content[0].type)).toBe('heading');
});

test('Drag handle CSS override also wins on hover', async ({ page }) => {
  await page.evaluate(() => {
    dh.properties.draghandle_adv = '&:hover { background: rgb(255, 0, 0); }';
    dh.h.update(dh.properties);
  });
  await hover(page, 'p');
  await page.locator('#second .tiptap-drag-handle').hover();
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.querySelector('#second .tiptap-drag-handle')).backgroundColor)).toBe('rgb(255, 0, 0)');
});
