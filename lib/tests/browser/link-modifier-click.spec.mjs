import { test, expect } from '@playwright/test';

// DEF-1927: with Open on click off, a plain click selects the link for editing and
// Ctrl/⌘+click opens it in a new tab, as the field's description promises.
test.beforeEach(async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await context.route('https://files.test/**', route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'opened' }));
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

async function editor(page, overrides = {}) {
  await page.evaluate(overrides => {
    first.h.instance.data.teardownEditor('link click test uses its own editor');
    window.ed = makeHarness('second', { ext_link: true, initialContent: '<p>See <a href="https://files.test/a.pdf">a.pdf</a> here</p>', ...overrides });
  }, overrides);
  await page.waitForFunction(() => ed.h.states.is_ready);
}

async function clickLink(page, context, modifiers = []) {
  const before = context.pages().length;
  await page.locator('#second .tiptap a').click({ modifiers });
  await page.waitForTimeout(500);
  const opened = context.pages().slice(before);
  const urls = opened.map(p => p.url());
  for (const p of opened) await p.close();
  return { urls, inLink: await page.evaluate(() => ed.h.instance.data.editor.isActive('link')) };
}

test('Open on click off: a plain click selects the link and opens nothing', async ({ page, context }) => {
  await editor(page);
  expect(await clickLink(page, context)).toEqual({ urls: [], inLink: true });
});

test('Open on click off: Ctrl/⌘+click opens the link in a new tab', async ({ page, context }) => {
  await editor(page);
  const r = await clickLink(page, context, ['ControlOrMeta']);
  expect(r.urls).toEqual(['https://files.test/a.pdf']);
  expect(page.url()).toContain('fixture.html');
});

test('Open on click on: a plain click still opens the link once', async ({ page, context }) => {
  await editor(page, { link_openOnClick: true });
  const r = await clickLink(page, context);
  expect(r.urls).toEqual(['https://files.test/a.pdf']);
});

test('Ctrl/⌘+click on plain text does nothing', async ({ page, context }) => {
  await editor(page);
  const before = context.pages().length;
  await page.locator('#second .tiptap p').click({ modifiers: ['ControlOrMeta'], position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
  expect(context.pages().length).toBe(before);
});

test('read-only editor: Ctrl/⌘+click opens the link once (the browser does it)', async ({ page, context }) => {
  await editor(page, { isEditable: false });
  const before = context.pages().length;
  await page.locator('#second .tiptap a').click({ modifiers: ['ControlOrMeta'] });
  await page.waitForTimeout(800);
  const opened = context.pages().slice(before);
  expect(opened.length).toBe(1);
  for (const p of opened) await p.close();
});

test('a mention chip is left to the browser: Ctrl/⌘+click opens one tab at most', async ({ page, context }) => {
  await editor(page, { initialContent: '<p>Hi <span data-type="mention" data-id="ada" data-label="Ada Lovelace"></span> there</p>' });
  const chip = page.locator('#second .tiptap .mention, #second .tiptap [data-type="mention"]').first();
  await expect(chip).toBeVisible();
  const before = context.pages().length;
  await chip.click({ modifiers: ['ControlOrMeta'] });
  await page.waitForTimeout(800);
  const opened = context.pages().slice(before);
  expect(opened.length).toBeLessThanOrEqual(1);
  for (const p of opened) await p.close();
});
