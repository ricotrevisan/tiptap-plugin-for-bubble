// WTF-256: real-Bubble check of Bubble Menu focus and stacking on tiptap-demo.
// Not part of CI: it needs network access and runs whatever plugin version the
// Bubble version uses. From lib/:
//   node tests/browser/check-demo-menu-lifecycle.mjs [--local-initialize=<git ref>] [url]
// Default URL: the development version of tiptap-demo. Exits non-zero on failure.
//
// --local-initialize=<ref> previews an unpushed initialize.js in real Bubble:
// in Bubble's served app script it replaces the element's initialize body,
// which must equal src/elements/tiptap-AAC/initialize.js at <ref> (the pushed
// version), with this checkout's file. Nothing in Bubble is changed.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const localRef = args.find(arg => arg.startsWith('--local-initialize='))?.slice('--local-initialize='.length);
const url = args.find(arg => !arg.startsWith('--')) || 'https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo';
const browser = await chromium.launch();
const failures = [];
let replaced = 0;
try {
  const page = await browser.newPage({ httpCredentials: { username: 'tippy', password: 'tappy' }, viewport: { width: 1280, height: 900 } });
  if (localRef) {
    const path = 'src/elements/tiptap-AAC/initialize.js';
    const escaped = body => JSON.stringify(body).slice(1, -1);
    const deployed = escaped(execFileSync('git', ['show', `${localRef}:${path}`], { cwd: '..', encoding: 'utf8' }));
    const local = escaped(readFileSync(`../${path}`, 'utf8'));
    // Routing disables the HTTP cache, so every load is patched.
    await page.route('**/package/static_js/**', async route => {
      const response = await route.fetch();
      const text = await response.text();
      const count = text.split(deployed).length - 1;
      replaced += count;
      await route.fulfill({ response, body: count ? text.split(deployed).join(local) : text });
    });
    console.log(`Serving local initialize.js in place of ${localRef}`);
  }
  const load = async () => {
    replaced = 0;
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (localRef && replaced !== 1) throw new Error(`initialize.js at ${localRef} was found ${replaced} times in the served app script; expected once`);
    await page.waitForFunction(() => document.querySelectorAll('.tiptap').length >= 10, null, { timeout: 60000 });
    await page.waitForTimeout(2000);
  };
  await load();
  // The Notion-style demo editor owns #notionBubbleMenu.
  const notion = await page.evaluate(() => [...document.querySelectorAll('.tiptap')].findIndex(editor => editor.textContent.includes('Select this sentence for the bubble menu')));
  if (notion < 1) throw new Error('Notion demo editor not found');
  const menu = () => page.evaluate(() => {
    const node = document.getElementById('notionBubbleMenu');
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return { visible: style.visibility === 'visible', pointerEvents: style.pointerEvents, zIndex: Number(node.style.zIndex) || 0, hitsMenu: !!hit && node.contains(hit) };
  });
  const select = async index => {
    const paragraph = page.locator('.tiptap').nth(index).locator('p:not(.is-empty)').first();
    await paragraph.scrollIntoViewIfNeeded();
    await paragraph.click({ clickCount: 3 });
    await page.waitForTimeout(800);
  };
  const check = (name, ok, detail) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
    if (!ok) failures.push(name);
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
  const popupZ = await page.evaluate(() => Number(getComputedStyle([...document.querySelectorAll('.bubble-element.Popup')]
    .find(popup => getComputedStyle(popup).display !== 'none')).zIndex));
  await page.getByText('Close', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await select(notion);
  state = await menu();
  check('a closed popup does not lift the menu above that popup', state.visible && state.hitsMenu && state.zIndex < popupZ, { ...state, closedPopupZIndex: popupZ });
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length} check(s) failed on ${url}`);
  process.exit(1);
}
console.log(`All checks passed on ${url}`);
