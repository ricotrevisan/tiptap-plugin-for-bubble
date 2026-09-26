// WTF-256: real-Bubble check of Bubble Menu focus and stacking on tiptap-demo.
// Not part of CI: it needs network access and runs whatever plugin version the
// Bubble version uses. From lib/:
//   node tests/browser/check-demo-menu-lifecycle.mjs [--local-initialize=<git ref>] [url]
// Default URL: the development version of tiptap-demo. Exits non-zero on failure.
// --local-initialize is described in real-bubble.mjs.
import { menuState, openBubble, parseArgs } from './real-bubble.mjs';

const { url, localRef } = parseArgs('https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo');
const { page, load, check, finish } = await openBubble({ url, localRef, minEditors: 10 });
try {
  await load();
  // The Notion-style demo editor owns #notionBubbleMenu.
  const notion = await page.evaluate(() => [...document.querySelectorAll('.tiptap')].findIndex(editor => editor.textContent.includes('Select this sentence for the bubble menu')));
  if (notion < 1) throw new Error('Notion demo editor not found');
  const menu = () => menuState(page, 'notionBubbleMenu');
  const select = async index => {
    const paragraph = page.locator('.tiptap').nth(index).locator('p:not(.is-empty)').first();
    await paragraph.scrollIntoViewIfNeeded();
    await paragraph.click({ clickCount: 3 });
    await page.waitForTimeout(800);
  };

  await select(notion);
  let state = await menu();
  check('selecting text shows the menu above the editor', state.visible && state.hitsMenu, state);
  await select(notion - 1);
  state = await menu();
  check('moving to another editor hides the menu', !state.visible && state.pointerEvents === 'none', state);

  // Fresh page, so the previous check cannot leave the menu in a stale state.
  await load();
  await page.getByText('Write a comment', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  // The popup this button opened: the one that is displayed now.
  const popupZ = await page.evaluate(() => {
    const open = [...document.querySelectorAll('.bubble-element.Popup')].find(popup => getComputedStyle(popup).display !== 'none');
    if (!open) throw new Error('"Write a comment" did not open a popup');
    return Number(getComputedStyle(open).zIndex);
  });
  await page.getByText('Close', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await select(notion);
  state = await menu();
  check('a closed popup does not lift the menu above that popup', state.visible && state.hitsMenu && state.zIndex < popupZ, { ...state, closedPopupZIndex: popupZ });
} catch (error) {
  check(`script error: ${error.message}`, false, {});
} finally {
  await finish();
}
