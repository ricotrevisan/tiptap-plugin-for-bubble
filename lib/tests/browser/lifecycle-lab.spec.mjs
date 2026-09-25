import { test, expect } from '@playwright/test';
import { Server } from '@hocuspocus/server';

// WTF-256 lifecycle lab. Each test is one case of docs/wtf-256/lifecycle-lab.md.

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  page.expectedDebugger = [];
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/lib/tests/browser/lab.html');
  await page.waitForFunction(() => window.ready);
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => debuggerMessages)).toEqual(page.expectedDebugger);
  expect(page.errors).toEqual([]);
});

const make = async (page, name, overrides = {}) => {
  await page.evaluate(([name, overrides]) => { makeEditor(name, overrides); }, [name, overrides]);
  await page.waitForFunction(name => editors[name].h.states.is_ready, name);
};
const bubble = (id, extra = {}) => ({ ext_bubblemenu: true, bubbleMenu: id, ...extra });
const floating = (id, extra = {}) => ({ ext_floatingmenu: true, floatingMenu: id, ...extra });
const menu = (page, id, scope = 'body') => page.locator(`${scope} #${id}`).first();

// What a real pointer at the centre of the menu's first button would reach.
const probe = (page, selector) => page.evaluate(selector => {
  const node = document.querySelector(selector);
  const button = node.querySelector('button');
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const hit = document.elementFromPoint(x, y);
  const style = getComputedStyle(node);
  return {
    x, y, inViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
    hitsMenu: !!hit && node.contains(hit), hitsButton: hit === button,
    hit: hit ? hit.id || hit.tagName : null,
    visible: style.visibility === 'visible' && style.opacity === '1',
  };
}, selector);
const diagnose = page => page.evaluate(() => JSON.stringify({
  active: document.activeElement?.closest('[id]')?.id,
  selection: getSelection().toString(),
  editors: Object.fromEntries(Object.entries(editors).map(([name, { h }]) => {
    const editor = h.instance.data.editor;
    return [name, editor && { focus: editor.view.hasFocus(), from: editor.state.selection.from, to: editor.state.selection.to }];
  })),
}));
const expectHidden = async (page, selector) => {
  // Bubble Menu hides after Tiptap's selection update delay.
  try {
    await expect.poll(async () => (await probe(page, selector)).visible).toBe(false);
  } catch (error) {
    throw new Error(`${selector} did not hide: ${await diagnose(page)}`);
  }
  const result = await probe(page, selector);
  expect(result.hitsMenu, `${selector} must not intercept the pointer (hit ${result.hit})`).toBe(false);
};
const expectShown = async (page, selector) => {
  try {
    await expect.poll(async () => (await probe(page, selector)).visible).toBe(true);
  } catch (error) {
    throw new Error(`${selector} did not show: ${await diagnose(page)}`);
  }
  // Floating UI positions asynchronously; wait until the button is reachable.
  await expect.poll(async () => (await probe(page, selector)).hitsButton, { message: `${selector} paints above the editor` }).toBe(true);
};
// Element actions refocus the editor on the next animation frame.
const focused = (page, name) => expect.poll(() => page.evaluate(name => editors[name].h.instance.data.editor.view.hasFocus(), name)).toBe(true);
// After a menu action, Tiptap's deferred focus() restores the selection on the
// next animation frame; a key pressed before that is overwritten.
const collapseSelection = async (page, name) => {
  await focused(page, name);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.keyboard.press('End');
  await expect.poll(() => page.evaluate(name => editors[name].h.instance.data.editor.state.selection.empty, name)).toBe(true);
};
// ProseMirror applies a click's selection just after mouseup, so keys pressed
// immediately can be overwritten. Select with one gesture, or let the click settle.
const selectParagraph = async (page, name) => {
  await page.locator(`#host-${name} .tiptap > *`).first().click({ clickCount: 3 });
  await expect.poll(() => page.evaluate(name => editors[name].h.instance.data.editor.state.selection.empty, name)).toBe(false);
};
const emptyLine = async (page, name) => {
  const block = page.locator(`#host-${name} .tiptap > *`).last();
  await block.click();
  await focused(page, name);
  const atEnd = () => page.evaluate(name => {
    const { $from, empty } = editors[name].h.instance.data.editor.state.selection;
    return empty && $from.parentOffset === $from.parent.content.size && $from.parent === editors[name].h.instance.data.editor.state.doc.lastChild;
  }, name);
  // Retry End until the caret is really at the end of the last block.
  await expect.poll(async () => {
    await page.keyboard.press('End');
    await page.waitForTimeout(50);
    return atEnd();
  }).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(name => editors[name].h.instance.data.editor.state.selection.$from.parent.content.size, name)).toBe(0);
};
const clickMenuButton = async (page, selector) => {
  const { x, y } = await probe(page, selector);
  await page.mouse.click(x, y);
};
const counts = page => page.evaluate(() => ({ ...actionCounts }));
const resources = page => page.evaluate(() => labResources());
const headings = (page, name, level = 1) => page.locator(`#host-${name} .tiptap h${level}`).count();


const bubbleOwnedStylesRestored = page => page.evaluate(() => menuHomes.map(home => ({
  id: home.node.id,
  editor: home.node.querySelector('button').dataset.editor,
  home: home.node.parentNode === home.parent && home.node.nextSibling === home.next,
  style: home.node.getAttribute('style') === home.style,
  tabindex: home.node.getAttribute('tabindex') === home.tabindex,
})).filter(result => !result.home || !result.style || !result.tabindex));
const own = name => `[id="dup-menu"]:has([data-editor="${name}"])`;

test('L1 hidden menus never intercept the pointer: before first show, after hide, resize and scroll', async ({ page }) => {
  await make(page, 'a', { ...bubble('bm-a'), ...floating('fm-a') });
  await make(page, 's', floating('fm-s'));
  const all = ['#bm-a', '#fm-a', '#fm-s'];
  for (const selector of all) await expectHidden(page, selector);

  // Show then hide each menu the way a user does.
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  await page.keyboard.press('End');
  await expectHidden(page, '#bm-a');
  await emptyLine(page, 'a');
  await expectShown(page, '#fm-a');
  await page.keyboard.type('Now not empty');
  await expectHidden(page, '#fm-a');
  await emptyLine(page, 's');
  await expectShown(page, '#fm-s');
  await page.keyboard.type('Filled');
  await expectHidden(page, '#fm-s');

  // Floating UI repositions on resize/scroll; hidden menus must stay inert (#20).
  for (const size of [{ width: 900, height: 700 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    for (const selector of all) await expectHidden(page, selector);
  }
  await page.locator('#scroller').evaluate(node => { node.scrollTop = 60; });
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(150);
  for (const selector of all) await expectHidden(page, selector);
  expect(await counts(page)).toEqual({});
});

test('L2 a visible menu paints above its editor and one click runs one action on that editor only', async ({ page }) => {
  await make(page, 'a', bubble('bm-a'));
  await make(page, 'b', bubble('bm-b'));
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  await expectHidden(page, '#bm-b');
  await clickMenuButton(page, '#bm-a');
  await expect.poll(() => headings(page, 'a')).toBe(1);
  expect(await headings(page, 'b')).toBe(0);
  expect(await counts(page)).toEqual({ 'a:h1': 1 });

  await selectParagraph(page, 'b');
  await expectShown(page, '#bm-b');
  await expectHidden(page, '#bm-a');
  await clickMenuButton(page, '#bm-b');
  await expect.poll(() => headings(page, 'b')).toBe(1);
  expect(await headings(page, 'a')).toBe(1);
  expect(await counts(page)).toEqual({ 'a:h1': 1, 'b:h1': 1 });
});

test('L3 menus of editors inside a floating group and a popup paint above that container', async ({ page }) => {
  await make(page, 'f', bubble('bm-f'));
  await selectParagraph(page, 'f');
  await expectShown(page, '#bm-f');
  await clickMenuButton(page, '#bm-f');
  await expect.poll(() => headings(page, 'f')).toBe(1);

  await page.evaluate(() => { document.getElementById('popup').style.display = 'block'; });
  await make(page, 'p', bubble('bm-p'));
  await selectParagraph(page, 'p');
  await expectShown(page, '#bm-p');
  await clickMenuButton(page, '#bm-p');
  await expect.poll(() => headings(page, 'p')).toBe(1);
  expect(await counts(page)).toEqual({ 'f:h1': 1, 'p:h1': 1 });

  // Closing the popup blurs its editor; the menu must not linger as a hit box.
  await page.evaluate(() => { document.getElementById('popup').style.display = 'none'; });
  await page.locator('#host-a').click();
  await expectHidden(page, '#bm-p');
});

test('L4 a modal opened after a menu is shown covers the menu; closing it restores the menu', async ({ page }) => {
  await make(page, 'a', bubble('bm-a'));
  // Open and close the popup first: Bubble then keeps it in <body> as
  // display:none with its z-index.
  await page.evaluate(() => { document.getElementById('popup').style.display = 'block'; });
  await expect(page.locator('#popup')).toBeVisible();
  await page.evaluate(() => { document.getElementById('popup').style.display = 'none'; });
  await expect(page.locator('#popup')).toBeHidden();
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  const before = await probe(page, '#bm-a');
  await page.evaluate(() => { document.getElementById('modal').style.display = 'block'; });
  const covered = await probe(page, '#bm-a');
  expect(covered.hitsMenu, `modal must be above the menu (hit ${covered.hit})`).toBe(false);
  expect(covered.hit).toBe('modal');
  await page.mouse.click(before.x, before.y);
  expect(await counts(page)).toEqual({});
  expect(await headings(page, 'a')).toBe(0);
  await page.evaluate(() => { document.getElementById('modal').style.display = 'none'; });
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  await clickMenuButton(page, '#bm-a');
  await expect.poll(() => headings(page, 'a')).toBe(1);
  expect(await counts(page)).toEqual({ 'a:h1': 1 });
});

test('L5 two copies of a reusable with the same menu ID each use their own menu', async ({ page }) => {
  await make(page, 'r1', bubble('dup-menu'));
  await make(page, 'r2', bubble('dup-menu'));
  expect(await page.evaluate(() => ['r1', 'r2'].map(name => editors[name].h.instance.data._menuLeases[0].node.querySelector('button').dataset.editor)))
    .toEqual(['r1', 'r2']);
  await selectParagraph(page, 'r2');
  await expectShown(page, own('r2'));
  await expectHidden(page, own('r1'));
  await clickMenuButton(page, own('r2'));
  await expect.poll(() => headings(page, 'r2')).toBe(1);
  expect(await headings(page, 'r1')).toBe(0);
  await selectParagraph(page, 'r1');
  await expectShown(page, own('r1'));
  await expectHidden(page, own('r2'));
  await clickMenuButton(page, own('r1'));
  await expect.poll(() => headings(page, 'r1')).toBe(1);
  expect(await counts(page)).toEqual({ 'r1:h1': 1, 'r2:h1': 1 });
});

test('L6 a menu ID already owned by another editor is reported and never shared', async ({ page }) => {
  await make(page, 'a', bubble('bm-a'));
  await make(page, 'b', bubble('bm-a'));
  page.expectedDebugger = ['b: BubbleMenu: Group "bm-a" is already owned by another editor or menu.'];
  expect(await page.evaluate(() => editors.b.h.instance.data._menuLeases.length)).toBe(0);
  await selectParagraph(page, 'b');
  // Longer than Tiptap's 250 ms show delay, so a wrongly shared menu would show.
  await page.waitForTimeout(500);
  await expectHidden(page, '#bm-a');
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  await clickMenuButton(page, '#bm-a');
  await expect.poll(() => headings(page, 'a')).toBe(1);
  expect(await headings(page, 'b')).toBe(0);
  expect(await counts(page)).toEqual({ 'a:h1': 1 });
});

test('L7 destroy/recreate and configuration rebuilds keep menus working and leak nothing', async ({ page }) => {
  await make(page, 'a', { ...bubble('bm-a'), ...floating('fm-a'), ext_table_of_contents: false });
  await make(page, 'b', bubble('bm-b'));
  const ready = () => page.waitForFunction(() => editors.a.h.states.is_ready);
  const change = async values => {
    await page.evaluate(values => { Object.assign(editors.a.properties, values); editors.a.h.update(editors.a.properties); }, values);
    await ready();
  };
  const useMenu = async expected => {
    await selectParagraph(page, 'a');
    await expectShown(page, '#bm-a');
    await clickMenuButton(page, '#bm-a');
    await expect.poll(() => counts(page)).toEqual({ 'a:h1': expected });
    await collapseSelection(page, 'a');
    await expectHidden(page, '#bm-a');
  };
  await useMenu(1);
  const baseline = await resources(page);
  expect(baseline).toMatchObject({ editors: 2, menuPlaceholders: 3, openSockets: 0 });
  let clicks = 1;
  for (let cycle = 0; cycle < 3; cycle++) {
    // Destroy and recreate, as Bubble does when an element is hidden and shown.
    await page.evaluate(() => editors.a.h.instance.data.teardownEditor('lab destroy'));
    expect(await resources(page)).toMatchObject({ editors: 1, menuPlaceholders: 1 });
    expect((await bubbleOwnedStylesRestored(page)).filter(r => r.editor === 'a')).toEqual([]);
    await change({});
    await useMenu(++clicks);
    // Configuration rebuilds: a construction-time extension is switched on and off.
    await change({ ext_table_of_contents: true });
    await useMenu(++clicks);
    await change({ ext_table_of_contents: false });
    await useMenu(++clicks);
    // Menu rebuild: the Floating Menu is switched off and on again.
    await change({ ext_floatingmenu: false });
    expect(await resources(page)).toMatchObject({ menuPlaceholders: 2 });
    await change({ ext_floatingmenu: true });
    await useMenu(++clicks);
    expect(await resources(page), `cycle ${cycle}: ${JSON.stringify(await page.evaluate(() => labListeners()))}`).toEqual(baseline);
  }
  expect(await headings(page, 'b')).toBe(0);
  for (const name of ['a', 'b']) await page.evaluate(name => editors[name].h.instance.data.teardownEditor('lab done'), name);
  expect(await resources(page)).toMatchObject({ editors: 0, menuPlaceholders: 0, bodyChildren: baseline.bodyChildren });
  expect(await bubbleOwnedStylesRestored(page)).toEqual([]);
});

test('L8 moving focus to another editor or an input hides the first editor\'s menus', async ({ page }) => {
  await make(page, 'a', { ...bubble('bm-a'), ...floating('fm-a') });
  await make(page, 'b', bubble('bm-b'));
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  // Focus moves straight into editor B (a focusable target, not empty space).
  await selectParagraph(page, 'b');
  await expectShown(page, '#bm-b');
  await expectHidden(page, '#bm-a');
  await page.locator('#lab-input').click();
  await expectHidden(page, '#bm-b');
  await emptyLine(page, 'a');
  await expectShown(page, '#fm-a');
  await page.locator('#lab-input').click();
  await expectHidden(page, '#fm-a');
  // Clicking a menu button (focusable) must still keep that menu usable.
  await selectParagraph(page, 'b');
  await expectShown(page, '#bm-b');
  await clickMenuButton(page, '#bm-b');
  await expect.poll(() => headings(page, 'b')).toBe(1);
  expect(await counts(page)).toEqual({ 'b:h1': 1 });
  // A non-focusable Bubble-style div button runs its action and keeps the menu.
  await focused(page, 'b');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('#bm-b .div-button').click();
  await expect.poll(() => page.locator('#host-b .tiptap strong').count()).toBe(1);
  expect(await counts(page)).toEqual({ 'b:h1': 1, 'b:bold': 1 });
  await expectShown(page, '#bm-b');
  // Focus moving into an input inside the menu keeps the menu open. Focus it
  // without a mousedown first: that path reaches Tiptap's "focus moved into
  // the menu" blur check (a click sets preventHide and skips it).
  await page.locator('#host-b .tiptap').focus();
  await page.locator('#bm-b .menu-input').evaluate(node => node.focus());
  await page.waitForTimeout(400);
  await expectShown(page, '#bm-b');
  await page.locator('#bm-b .menu-input').click();
  await page.keyboard.type('https://example.com');
  await expect(page.locator('#bm-b .menu-input')).toHaveValue('https://example.com');
  await page.waitForTimeout(400);
  await expectShown(page, '#bm-b');
});

test('L9 collaboration setup, document switches and teardown release their connection', async ({ page }) => {
  const server = new Server({ port: 0, address: '127.0.0.1', quiet: true });
  await server.listen();
  try {
    const collab = doc => ({ collab_active: true, collabProvider: 'custom', collab_url: `ws://127.0.0.1:${server.address.port}`,
      collab_app_id: 'lab', collab_doc_id: doc, collab_jwt: 'lab-token', collab_user_name: 'Ada', collab_cursor_color: '#123456' });
    await make(page, 'a', { ...bubble('bm-a'), ...collab('lab-1') });
    await page.waitForFunction(() => editors.a.h.states.collab_synced);
    const change = async values => {
      await page.evaluate(values => { Object.assign(editors.a.properties, values); editors.a.h.update(editors.a.properties); }, values);
      await page.waitForFunction(() => editors.a.h.states.is_ready && (!editors.a.properties.collab_active || editors.a.h.states.collab_synced));
    };
    const useMenu = async expected => {
      await selectParagraph(page, 'a');
      await expectShown(page, '#bm-a');
      await clickMenuButton(page, '#bm-a');
      await expect.poll(() => counts(page)).toEqual({ 'a:h1': expected });
      await collapseSelection(page, 'a');
      await expectHidden(page, '#bm-a');
    };
    await useMenu(1);
    await expect.poll(async () => (await resources(page)).openSockets).toBe(1);
    const baseline = await resources(page);
    let clicks = 1;
    for (const doc of ['lab-2', 'lab-3', 'lab-1']) {
      await change({ collab_doc_id: doc });
      await useMenu(++clicks);
      await expect.poll(async () => (await resources(page)).openSockets, { message: `one connection after switching to ${doc}` }).toBe(1);
    }
    await change({ collab_active: false });
    await expect.poll(async () => (await resources(page)).openSockets).toBe(0);
    await useMenu(++clicks);
    await change({ collab_active: true });
    await expect.poll(async () => (await resources(page)).openSockets).toBe(1);
    expect(await resources(page)).toEqual(baseline);
    await page.evaluate(() => editors.a.h.instance.data.teardownEditor('lab done'));
    await expect.poll(async () => (await resources(page)).openSockets).toBe(0);
    expect(await resources(page)).toMatchObject({ editors: 0, menuPlaceholders: 0 });
    expect(await bubbleOwnedStylesRestored(page)).toEqual([]);
  } finally {
    await server.destroy();
  }
});

test('L10 leaving a menu\'s own input for another editor or empty space hides the menu', async ({ page }) => {
  await make(page, 'a', bubble('bm-a'));
  await make(page, 'b', bubble('bm-b'));
  for (const leave of ['other editor', 'empty space']) {
    await selectParagraph(page, 'b');
    await expectShown(page, '#bm-b');
    await page.locator('#bm-b .menu-input').click();
    await page.keyboard.type('x');
    await page.waitForTimeout(400);
    await expectShown(page, '#bm-b');
    if (leave === 'other editor') await selectParagraph(page, 'a');
    else await page.mouse.click(1000, 700);
    await expectHidden(page, '#bm-b');
    if (leave === 'other editor') await expectShown(page, '#bm-a');
  }
  // Returning from the input to its own editor keeps the menu.
  await selectParagraph(page, 'b');
  await expectShown(page, '#bm-b');
  await page.locator('#bm-b .menu-input').click();
  await page.locator('#host-b .tiptap').focus();
  await page.waitForTimeout(400);
  await expectShown(page, '#bm-b');
  expect(await counts(page)).toEqual({});
});

// ── Autobinding (WTF-260 contract, docs/wtf-260/README.md) ─────────────────
const bound = (page, name, options) => page.evaluate(([name, options]) => {
  const delays = options.writeDelays;
  makeBoundEditor(name, { ...options, writeDelay: delays ? n => delays[n % delays.length] : undefined });
}, [name, options]).then(() => page.waitForFunction(name => editors[name].h.states.is_ready, name));
const store = (page, name) => page.evaluate(name => {
  const { records, current, writes } = editors[name].store;
  return { records, current, writes: writes.map(({ record, value, done }) => ({ record, value, done })), pending: editors[name].store.pending() };
}, name);
const html = (page, name) => page.evaluate(name => editors[name].h.instance.data.editor.getHTML(), name);
// Wait until no write is in flight and nothing new is published for a while.
const settled = async (page, name, quiet = 1500) => {
  let last = -1;
  await expect.poll(async () => {
    const { writes, pending } = await store(page, name);
    const stable = pending === 0 && writes.length === last;
    last = writes.length;
    return stable;
  }, { intervals: [quiet], timeout: 20000 }).toBe(true);
};
const typeAtEnd = async (page, name, text) => {
  await page.locator(`#host-${name} .tiptap`).click();
  await focused(page, name);
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
};

test('L11 autobinding converges with out-of-order writes, survives reload, and a menu action saves once', async ({ page }) => {
  test.slow();
  // Earlier writes finish later: completion order differs from send order.
  await bound(page, 'a', { records: { A: '<p>Alpha</p>', B: '<p>Bravo</p>' }, current: 'A', writeDelays: [900, 100, 500],
    overrides: bubble('bm-a') });
  for (const burst of [' one', ' two', ' three']) {
    await typeAtEnd(page, 'a', burst);
    await page.waitForTimeout(450);
  }
  await settled(page, 'a');
  const editorHtml = await html(page, 'a');
  expect(editorHtml).toBe('<p>Alpha one two three</p>');
  let saved = await store(page, 'a');
  expect(saved.records.A, 'the stored record matches the editor after writes finish out of order').toBe(editorHtml);
  expect(saved.records.B).toBe('<p>Bravo</p>');
  expect(saved.writes.every(write => write.record === 'A')).toBe(true);

  // A Bubble Menu action on the bound editor is saved, once, to the same record.
  const before = saved.writes.length;
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  await clickMenuButton(page, '#bm-a');
  await expect.poll(() => headings(page, 'a')).toBe(1);
  await settled(page, 'a');
  saved = await store(page, 'a');
  expect(saved.records.A).toBe('<h1>Alpha one two three</h1>');
  expect(saved.writes.slice(before).filter(write => write.value === '<h1>Alpha one two three</h1>')).toHaveLength(1);
  expect(await counts(page)).toEqual({ 'a:h1': 1 });

  // Reload: a fresh editor bound to the stored record shows the same content.
  await page.evaluate(() => editors.a.h.instance.data.teardownEditor('lab reload'));
  await page.evaluate(() => {
    const { records } = editors.a.store;
    makeBoundEditor('a', { records, current: 'A', overrides: { ext_bubblemenu: true, bubbleMenu: 'bm-a' } });
  });
  await page.waitForFunction(() => editors.a.h.states.is_ready);
  expect(await html(page, 'a')).toBe('<h1>Alpha one two three</h1>');
  await page.waitForTimeout(800);
  expect((await store(page, 'a')).writes, 'loading a record does not save it').toHaveLength(0);
});

test('L12 autobinding: a record switch cancels the unsent edit, blur flushes once, external content is not saved back', async ({ page }) => {
  test.slow();
  await bound(page, 'a', { records: { A: '<p>Alpha</p>', B: '<p>Bravo</p>' }, current: 'A', overrides: { autobinding_save_delay: 1500 } });
  // Unsent edit, then the data source switches to B before the save delay ends.
  await typeAtEnd(page, 'a', ' unsent');
  await page.evaluate(() => editors.a.store.bind('B'));
  await expect.poll(() => html(page, 'a')).toBe('<p>Bravo</p>');
  await page.waitForTimeout(2000);
  let saved = await store(page, 'a');
  expect(saved.records).toEqual({ A: '<p>Alpha</p>', B: '<p>Bravo</p>' });
  expect(saved.writes).toEqual([]);

  // A dirty blur submits the pending edit once, to the bound record.
  await typeAtEnd(page, 'a', ' edited');
  await page.locator('#lab-input').click();
  await expect.poll(async () => (await store(page, 'a')).writes.length).toBe(1);
  await page.waitForTimeout(2000);
  saved = await store(page, 'a');
  expect(saved.writes).toEqual([{ record: 'B', value: '<p>Bravo edited</p>', done: true }]);
  expect(saved.records.B).toBe('<p>Bravo edited</p>');
  // A clean blur writes nothing.
  await page.locator('#host-a .tiptap').click();
  await page.locator('#lab-input').click();
  await page.waitForTimeout(2000);
  expect((await store(page, 'a')).writes).toHaveLength(1);

  // Someone else saves B: the editor shows it and does not save it back.
  await page.evaluate(() => editors.a.store.external('<p>From another user</p>'));
  await expect.poll(() => html(page, 'a')).toBe('<p>From another user</p>');
  await page.waitForTimeout(2000);
  expect((await store(page, 'a')).writes).toHaveLength(1);
  // External content also cancels a pending local edit.
  await typeAtEnd(page, 'a', ' local');
  await page.evaluate(() => editors.a.store.external('<p>Newer remote</p>'));
  await expect.poll(() => html(page, 'a')).toBe('<p>Newer remote</p>');
  await page.locator('#lab-input').click();
  await page.waitForTimeout(2500);
  saved = await store(page, 'a');
  expect(saved.writes).toHaveLength(1);
  expect(saved.records.B).toBe('<p>Newer remote</p>');
});

// ── Collaboration ───────────────────────────────────────────────────────────
test('L13 Liveblocks: two editors share a room, room switches leave the old room once, teardown leaves nothing', async ({ page }) => {
  const liveblocks = room => ({ collab_active: true, collabProvider: 'liveblocks', liveblocksPublicApiKey: 'pk_lab', collab_doc_id: room, collab_jwt: '' });
  await make(page, 'a', { ...bubble('bm-a'), ...liveblocks('room-1'), collab_user_name: 'Ada' });
  await page.waitForFunction(() => editors.a.h.states.collab_synced);
  await make(page, 'b', { ...bubble('bm-b'), ...liveblocks('room-1'), collab_user_name: 'Grace' });
  await page.waitForFunction(() => editors.b.h.states.collab_synced);
  const live = () => page.evaluate(() => ({
    sessions: liveblocks.history.filter(session => !session.left).map(session => session.roomId).sort(),
    entered: liveblocks.history.length, left: liveblocks.history.filter(session => session.left).length,
  }));
  expect((await live()).sessions).toEqual(['pk_lab/room-1', 'pk_lab/room-1']);
  await expect.poll(() => page.evaluate(() => [editors.a.h.states.collab_connected_users, editors.b.h.states.collab_connected_users])).toEqual([2, 2]);
  // Edits reach the other editor, and a menu action in A applies to the shared document.
  await typeAtEnd(page, 'a', ' shared');
  await expect(page.locator('#host-b .tiptap')).toContainText('shared');
  await selectParagraph(page, 'a');
  await expectShown(page, '#bm-a');
  await expectHidden(page, '#bm-b');
  await clickMenuButton(page, '#bm-a');
  await expect(page.locator('#host-b .tiptap h1')).toHaveCount(1);
  expect(await counts(page)).toEqual({ 'a:h1': 1 });

  // Switch A through two rooms and back: one live session for A at every step.
  for (const room of ['room-2', 'room-3', 'room-1']) {
    await page.evaluate(room => { Object.assign(editors.a.properties, { collab_doc_id: room }); editors.a.h.update(editors.a.properties); }, room);
    await page.waitForFunction(() => editors.a.h.states.is_ready && editors.a.h.states.collab_synced);
    expect((await live()).sessions).toEqual([`pk_lab/${room}`, 'pk_lab/room-1'].sort());
  }
  await expect(page.locator('#host-a .tiptap h1')).toHaveCount(1);
  const { entered, left } = await live();
  expect(entered - left).toBe(2);
  for (const name of ['a', 'b']) await page.evaluate(name => editors[name].h.instance.data.teardownEditor('lab done'), name);
  expect(await live()).toMatchObject({ sessions: [] });
  expect(await resources(page)).toMatchObject({ editors: 0, menuPlaceholders: 0 });
  expect(await bubbleOwnedStylesRestored(page)).toEqual([]);
});

test('L14 a rejected collaboration token gives up after five attempts, releases everything, and recovers with a valid token', async ({ page }) => {
  test.setTimeout(90000);
  const server = new Server({ port: 0, address: '127.0.0.1', quiet: true, async onAuthenticate({ token }) {
    if (token !== 'good-token') throw new Error('rejected');
  } });
  await server.listen();
  try {
    const collab = token => ({ collab_active: true, collabProvider: 'custom', collab_url: `ws://127.0.0.1:${server.address.port}`,
      collab_app_id: 'lab', collab_doc_id: 'auth', collab_jwt: token, collab_user_name: 'Ada', collab_cursor_color: '#123456' });
    page.expectedDebugger = ['a: Custom collab authentication failed after 5 attempts. Giving up. Please check your JWT token configuration.'];
    await page.evaluate(values => { makeEditor('a', values); }, { ...bubble('bm-a'), ...collab('bad-token') });
    // Backoff is 1 + 2 + 4 + 8 seconds between the five attempts.
    await page.waitForFunction(() => editors.a.h.states.collab_status === 'failed', null, { timeout: 40000 });
    expect(await page.evaluate(() => editors.a.h.states.is_ready)).toBe(false);
    await expect.poll(async () => (await resources(page)).openSockets).toBe(0);
    expect(await resources(page)).toMatchObject({ editors: 0, menuPlaceholders: 0 });
    expect(await bubbleOwnedStylesRestored(page)).toEqual([]);
    // An unchanged Bubble update does not start another attempt.
    await page.evaluate(() => editors.a.h.update(editors.a.properties));
    await page.waitForTimeout(1500);
    expect(await resources(page)).toMatchObject({ editors: 0, openSockets: 0 });
    // A corrected token recovers, and the menu works.
    await page.evaluate(() => { editors.a.properties.collab_jwt = 'good-token'; editors.a.h.update(editors.a.properties); });
    await page.waitForFunction(() => editors.a.h.states.is_ready && editors.a.h.states.collab_synced, null, { timeout: 15000 });
    await expect.poll(async () => (await resources(page)).openSockets).toBe(1);
    await selectParagraph(page, 'a');
    await expectShown(page, '#bm-a');
    await clickMenuButton(page, '#bm-a');
    await expect.poll(() => headings(page, 'a')).toBe(1);
    expect(await counts(page)).toEqual({ 'a:h1': 1 });
    await page.evaluate(() => editors.a.h.instance.data.teardownEditor('lab done'));
    await expect.poll(async () => (await resources(page)).openSockets).toBe(0);
  } finally {
    await server.destroy();
  }
});
