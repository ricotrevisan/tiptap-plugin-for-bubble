// WTF-256: real-Bubble lifecycle lab on the tiptap-plugin app's lifecycle-lab
// page (Bubble branch wtf-256-lab until it is merged into test). Checks what
// only real Bubble shows: its page, popup and floating-group layers, reusable
// copies, workflows and counters. Not part of CI. From lib/:
//   node tests/browser/check-bubble-lab.mjs [--local-initialize=<git ref>] [url]
// --local-initialize is described in real-bubble.mjs. Exits non-zero on failure.
import { menuState, openBubble, parseArgs } from './real-bubble.mjs';

const { url, localRef } = parseArgs('https://tiptap-plugin.bubbleapps.io/version-73kof/lifecycle-lab');
const { page, load, check, finish } = await openBubble({ url, localRef, minEditors: 6 });
const menus = ['labMenuA', 'labFloatA', 'labMenuB', 'labFloatS', 'labMenuF'];
const editor = name => page.locator(`.tiptap:has-text("${name}")`).first();
const select = async name => {
  const block = editor(name).locator('> *').first();
  await block.scrollIntoViewIfNeeded();
  await block.click({ clickCount: 3 });
  await page.waitForTimeout(800);
};
const counter = id => page.locator(`#${id}`).textContent();
const clickMenu = async id => {
  const { x, y } = await menuState(page, id);
  await page.mouse.click(x, y);
  await page.waitForTimeout(1200);
};
const hiddenEverywhere = async (label, ids = menus) => {
  const states = await Promise.all(ids.map(id => menuState(page, id)));
  const bad = ids.filter((id, index) => states[index].visible || states[index].hitsMenu);
  check(`${label}: hidden menus don't intercept the pointer`, bad.length === 0, { bad });
};
try {
  await load();
  await hiddenEverywhere('on load');

  // One click on a visible menu runs one workflow, on that editor only.
  await select('Editor A.');
  let a = await menuState(page, 'labMenuA');
  check('menu A shows above its editor', a.visible && a.hitsMenu, a);
  await clickMenu('labMenuA');
  check('one click runs H1 once on editor A', await counter('lab-count-a-h1') === 'A H1: 1' && await editor('Editor A.').locator('h1').count() === 1
    && await editor('Editor B.').locator('h1').count() === 0, { a: await counter('lab-count-a-h1'), b: await counter('lab-count-b-h1') });

  // Focus moving to another editor hides the first editor's menu.
  await select('Editor B.');
  a = await menuState(page, 'labMenuA');
  const b = await menuState(page, 'labMenuB');
  check('moving to editor B hides menu A and shows menu B', !a.visible && !a.hitsMenu && b.visible && b.hitsMenu, { a, b });

  // Leaving the menu's own input for another editor hides the menu.
  await select('Editor A.');
  await page.locator('#lab-menu-a-input').click();
  await page.keyboard.type('https://example.com');
  await page.waitForTimeout(600);
  a = await menuState(page, 'labMenuA');
  check('typing in the menu input keeps menu A open', a.visible, a);
  await select('Editor B.');
  a = await menuState(page, 'labMenuA');
  check('leaving the menu input for editor B hides menu A', !a.visible && !a.hitsMenu, a);

  // Resizing and scrolling never turn hidden menus into hit boxes.
  await page.locator('#lab-input').click();
  await page.waitForTimeout(600);
  for (const size of [{ width: 900, height: 700 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(400);
    await hiddenEverywhere(`after resize to ${size.width}px`);
  }
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  await hiddenEverywhere('after page scroll');
  await page.evaluate(() => window.scrollTo(0, 0));

  // Editor inside a floating group: its menu paints above the group.
  await select('Floating group editor');
  const f = await menuState(page, 'labMenuF');
  check('menu of an editor in a floating group paints above the group', f.visible && f.hitsMenu, f);
  await clickMenu('labMenuF');
  check('floating-group menu click runs once', await counter('lab-count-f-h1') === 'F H1: 1', { f: await counter('lab-count-f-h1') });

  // Two copies of a reusable with the same menu ID each use their own menu.
  const copies = page.locator('.tiptap:has-text("Reusable copy")');
  await copies.nth(1).locator('> *').first().scrollIntoViewIfNeeded();
  await copies.nth(1).locator('> *').first().click({ clickCount: 3 });
  await page.waitForTimeout(800);
  const dup = await page.evaluate(() => [...document.querySelectorAll('[id="labDupMenu"]')].map(node => getComputedStyle(node).visibility));
  check('only the focused copy shows its menu', dup.filter(v => v === 'visible').length === 1, { dup });
  const visibleCopy = await page.evaluate(() => {
    const node = [...document.querySelectorAll('[id="labDupMenu"]')].find(n => getComputedStyle(n).visibility === 'visible');
    const r = node.querySelector('button, .clickable-element').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(visibleCopy.x, visibleCopy.y);
  await page.waitForTimeout(1200);
  const copyCounts = await page.locator('text=/^Copy H1: \\d+$/').allTextContents();
  const copyHeadings = [await copies.nth(0).locator('h1').count(), await copies.nth(1).locator('h1').count()];
  check('the copy menu runs H1 once, on its own copy', JSON.stringify(copyHeadings) === '[0,1]' && copyCounts.filter(t => t === 'Copy H1: 1').length === 1, { copyCounts, copyHeadings });

  // Popup: the editor's menu paints above the popup; after the popup closes,
  // later menus stay below its z-index.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#lab-open-popup').scrollIntoViewIfNeeded();
  await page.locator('#lab-open-popup').click();
  await page.waitForFunction(() => document.querySelectorAll('.tiptap').length >= 7, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const popupZ = await page.evaluate(() => Number(getComputedStyle([...document.querySelectorAll('.bubble-element.Popup')].find(p => getComputedStyle(p).display !== 'none')).zIndex));
  await select('Popup editor');
  const p = await menuState(page, 'labMenuP');
  check('menu of an editor in a popup paints above the popup', p.visible && p.hitsMenu && p.zIndex > popupZ, { ...p, popupZ });
  await clickMenu('labMenuP');
  check('popup menu click runs once', await counter('lab-count-p-h1') === 'P H1: 1', { p: await counter('lab-count-p-h1') });
  await page.locator('#lab-close-popup').click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await select('Editor A.');
  a = await menuState(page, 'labMenuA');
  check('after the popup closes, menu A stays below the popup layer', a.visible && a.hitsMenu && a.zIndex < popupZ, { ...a, popupZ });

  // Floating Menu inside a scrolling group.
  const empty = editor('Scroll area').locator('p').last();
  await empty.scrollIntoViewIfNeeded();
  await empty.click();
  await page.waitForTimeout(300);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const s = await menuState(page, 'labFloatS');
  check('floating menu shows on an empty line inside the scroll group, below the closed popup layer', s.visible && s.hitsMenu && s.zIndex < popupZ, { ...s, popupZ });
  await clickMenu('labFloatS');
  check('scroll-group floating menu click runs H2 once', await counter('lab-count-s-h2') === 'S H2: 1', { s: await counter('lab-count-s-h2') });
  await page.keyboard.type('filled');
  await page.waitForTimeout(800);
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);
  await hiddenEverywhere('after typing and scrolling the scroll group', ['labFloatS']);
} catch (error) {
  check(`script error: ${error.message}`, false, {});
} finally {
  await finish();
}
