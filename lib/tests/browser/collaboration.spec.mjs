import { test, expect } from '@playwright/test';
import { Server } from '@hocuspocus/server';

test('two browsers keep collaborator names and edits through runtime reconfiguration', async ({ browser }) => {
  const server = new Server({ port: 0, address: '127.0.0.1', quiet: true });
  await server.listen();
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const errors = [];
  const change = (page, values) => page.evaluate(values => {
    Object.assign(first.properties, values);
    first.h.update(first.properties);
  }, values);
  const editor = page => page.locator('#first .tiptap');
  try {
    for (const [index, page] of pages.entries()) {
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/lib/tests/browser/fixture.html');
      await page.waitForFunction(() => window.ready && first.h.states.is_ready);
      await change(page, { collab_active: true, collabProvider: 'custom', collab_url: `ws://127.0.0.1:${server.address.port}`,
        collab_app_id: 'fixture', collab_doc_id: 'shared', collab_jwt: 'fixture-token',
        collab_user_name: index === 0 ? 'Ada' : 'Grace', collab_cursor_color: index === 0 ? '#123456' : '#654321' });
      await page.waitForFunction(() => first.h.states.collab_synced);
    }
    const [ada, grace] = pages;
    // Actual input and visible remote caret labels, in independent sessions.
    await editor(ada).click();
    await ada.keyboard.press('ControlOrMeta+End');
    await ada.keyboard.type(' shared draft');
    await expect(editor(grace)).toContainText('shared draft');
    await expect(grace.locator('.collaboration-carets__label')).toHaveText('Ada');
    await editor(grace).click();
    await grace.keyboard.press('ControlOrMeta+End');
    await grace.keyboard.type(' from Grace');
    await expect(editor(ada)).toContainText('from Grace');
    await expect(ada.locator('.collaboration-carets__label')).toHaveText('Grace');
    await ada.evaluate(() => { window.before = first.h.instance.data.editor; });
    await change(ada, { collab_user_name: 'Ada Lovelace', collab_cursor_color: '#abcdef' });
    await expect.poll(() => grace.evaluate(() => first.h.instance.data.editor.storage.collaborationCaret.users.map(user => user.name))).toContain('Ada Lovelace');
    await expect(grace.locator('.collaboration-carets__label')).toHaveText('Ada Lovelace');
    await expect(grace.locator('.collaboration-carets__label')).toHaveCSS('background-color', 'rgb(171, 205, 239)');
    expect(await ada.evaluate(() => before === first.h.instance.data.editor)).toBe(true);
    await change(ada, { collab_jwt: 'renewed-token' });
    await ada.waitForFunction(() => first.h.states.collab_synced);
    await expect(editor(ada)).toContainText('shared draft');
    await editor(ada).click();
    await expect(grace.locator('.collaboration-carets__label')).toHaveCount(1);
    await expect(grace.locator('.collaboration-carets__label')).toHaveText('Ada Lovelace');
    await change(ada, { collab_active: false });
    await expect(editor(ada)).toContainText('from Grace');
    await expect(grace.locator('.collaboration-carets__label')).toHaveCount(0);
    await editor(ada).click();
    await ada.keyboard.press('ControlOrMeta+End');
    await ada.keyboard.type(' local only');
    await expect(editor(ada)).toContainText('local only');
    await expect(editor(grace)).not.toContainText('local only');
    // An existing remote document wins over local seeding on re-entry.
    await change(ada, { collab_active: true });
    await ada.waitForFunction(() => first.h.states.collab_synced);
    await expect(editor(ada)).not.toContainText('local only');
    await change(ada, { collab_doc_id: 'separate' });
    await ada.waitForFunction(() => first.h.states.collab_synced);
    await expect(editor(ada)).not.toContainText('shared draft');
    expect(await ada.evaluate(() => first.h.events.filter(event => event.name === 'collab_doc_changed').length)).toBe(1);
    expect(errors).toEqual([]);
    for (const page of pages) expect(await page.evaluate(() => debuggerMessages)).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await server.destroy();
  }
});
