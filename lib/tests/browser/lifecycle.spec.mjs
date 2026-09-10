import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
  expect(page.errors).toEqual([]);
});

test('typing publishes coherent event snapshots and repeated update preserves editor/content', async ({ page }) => {
  const editor = page.locator('#first .tiptap');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' local draft');
  await expect.poll(() => page.evaluate(() => first.h.states.contentText)).toContain('local draft');
  await expect.poll(() => page.evaluate(() => first.h.events.filter(e => e.name === 'contentUpdated').at(-1)?.states.contentText)).toContain('local draft');
  expect(await page.evaluate(() => first.autobindings.at(-1))).toContain('local draft');
  const result = await page.evaluate(() => {
    const { h, properties } = first;
    const before = h.instance.data.editor;
    h.update({ ...properties }); h.update({ ...properties });
    return { same: before === h.instance.data.editor, events: h.events.filter(e => e.name === 'contentUpdated') };
  });
  expect(result.same).toBe(true);
  expect(result.events.at(-1).states.contentText).toContain('local draft');
  await expect(editor).toContainText('local draft');
});

test('actual update and set-content action refresh table of contents', async ({ page }) => {
  await page.evaluate(() => { first.properties.initialContent = '<h1>Beta</h1><p>Two</p>'; first.h.update(first.properties); });
  await expect(page.locator('#first .tiptap h1')).toHaveText('Beta');
  expect(await page.evaluate(() => JSON.parse(first.h.states.table_of_contents).map(e => e.textContent))).toEqual(['Beta']);
  await page.evaluate(() => first.h.action('setContent', { content: '<h1>Gamma</h1><p>Three</p>', is_json: false, parseOptions_preserveWhitespace: 'false' }));
  await expect(page.locator('#first .tiptap h1')).toHaveText('Gamma');
  const entries = await page.evaluate(() => JSON.parse(first.h.states.table_of_contents));
  expect(entries.map(e => e.textContent)).toEqual(['Gamma']);
});

test('extension rebuild preserves draft; reset tears down and update remounts independently', async ({ page }) => {
  await page.evaluate(() => { window.second = makeHarness('second', { initialContent: '<p>Independent</p>' }); });
  await expect(page.locator('#second .tiptap')).toHaveText('Independent');
  await page.locator('#first .tiptap').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' unsaved');
  await page.evaluate(() => {
    window.oldEditor = first.h.instance.data.editor;
    first.properties.ext_table_of_contents = false;
    first.h.update(first.properties);
  });
  await page.waitForFunction(() => first.h.states.is_ready);
  expect(await page.evaluate(() => oldEditor.isDestroyed)).toBe(true);
  await expect(page.locator('#first .tiptap')).toContainText('unsaved');
  expect(await page.evaluate(() => first.h.states.table_of_contents)).toBe('[]');
  await page.evaluate(() => first.h.reset());
  expect(await page.evaluate(() => first.h.states.is_ready)).toBe(false);
  await expect(page.locator('#first .tiptap')).toHaveCount(0);
  await page.evaluate(() => first.h.update(first.properties));
  await page.waitForFunction(() => first.h.states.is_ready);
  await expect(page.locator('#first .tiptap')).toHaveCount(1);
  await expect(page.locator('#second .tiptap')).toHaveText('Independent');
});

test('mention keyboard interaction consumes shared Bubble list and Thing helpers', async ({ page }) => {
  await page.locator('#first .tiptap').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' @Ada');
  await expect(page.locator('.tippy-content')).toContainText('Ada Lovelace');
  await page.keyboard.press('Enter');
  await expect(page.locator('#first [data-type="mention"]')).toHaveAttribute('data-id', 'ada');
  await expect.poll(() => page.evaluate(() => first.h.states.contentHTML)).toContain('data-id="ada"');
});
