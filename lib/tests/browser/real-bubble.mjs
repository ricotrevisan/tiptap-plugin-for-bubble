// Shared helpers for the real-Bubble checks (not Playwright tests, not in CI).
// Run the checks from lib/.
//
// --local-initialize=<ref> previews an unpushed initialize.js in real Bubble:
// in Bubble's served app script it replaces the element's initialize body,
// which must equal src/elements/tiptap-AAC/initialize.js at <ref> (the pushed
// version), with this checkout's file. Nothing in Bubble is changed.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function parseArgs(defaultUrl) {
  const args = process.argv.slice(2);
  return {
    localRef: args.find(arg => arg.startsWith('--local-initialize='))?.slice('--local-initialize='.length),
    url: args.find(arg => !arg.startsWith('--')) || defaultUrl,
  };
}

export async function openBubble({ url, localRef, minEditors }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ httpCredentials: { username: 'tippy', password: 'tappy' }, viewport: { width: 1280, height: 900 } });
  let replaced = 0;
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
    // Bubble run-mode loads are occasionally slow.
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    if (localRef && replaced !== 1) throw new Error(`initialize.js at ${localRef} was found ${replaced} times in the served app script; expected once`);
    await page.waitForFunction(min => document.querySelectorAll('.tiptap').length >= min, minEditors, { timeout: 60000 });
    await page.waitForTimeout(2000);
  };
  const failures = [];
  const check = (name, ok, detail) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
    if (!ok) failures.push(name);
  };
  const finish = async () => {
    await browser.close();
    if (failures.length) {
      console.error(`${failures.length} check(s) failed on ${url}`);
      process.exit(1);
    }
    console.log(`All checks passed on ${url}`);
  };
  return { browser, page, load, check, finish };
}

// Visibility, z-index and what a pointer at the menu's first button reaches.
export const menuState = (page, id) => page.evaluate(id => {
  const node = document.getElementById(id);
  const style = getComputedStyle(node);
  const target = node.querySelector('button, .clickable-element, input') || node;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    visible: style.visibility === 'visible', pointerEvents: style.pointerEvents, zIndex: Number(node.style.zIndex) || 0,
    hitsMenu: !!hit && node.contains(hit), x, y, inViewport: y > 0 && y < innerHeight && x > 0 && x < innerWidth,
  };
}, id);
