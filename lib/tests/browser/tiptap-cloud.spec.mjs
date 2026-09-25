import { test, expect } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';

// WTF-256: the plugin's Tiptap Cloud provider against the real Tiptap Cloud.
// Skipped unless credentials are provided (CI has none). From lib/:
//   TIPTAP_CLOUD_APP_ID=$(op read op://Dev/tiptap-cloud/server_id) \
//   TIPTAP_CLOUD_SECRET=$(op read op://Dev/tiptap-cloud/server_secret) \
//   TIPTAP_CLOUD_API_TOKEN=$(op read op://Dev/tiptap-cloud/api_token) \
//   npx playwright test tests/browser/tiptap-cloud.spec.mjs --project=chromium
// Each run uses its own document, deleted afterwards through the REST API.

const appId = process.env.TIPTAP_CLOUD_APP_ID;
const secret = process.env.TIPTAP_CLOUD_SECRET;
const apiToken = process.env.TIPTAP_CLOUD_API_TOKEN;
// All three are required: without the API token the test documents could not be deleted.
test.skip(!appId || !secret || !apiToken, 'Set TIPTAP_CLOUD_APP_ID, TIPTAP_CLOUD_SECRET and TIPTAP_CLOUD_API_TOKEN to run against Tiptap Cloud');
// Signed tokens are passed into the page; keep them out of failure traces.
test.use({ trace: 'off' });

const base64url = value => Buffer.from(value).toString('base64url');
// A short-lived token for one document, signed like the plugin's
// "generate auth token" server action.
const jwt = (document, key = secret) => {
  const now = Math.floor(Date.now() / 1000);
  const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iat: now, exp: now + 900, allowedDocumentNames: [document] }))}`;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
};

const properties = (document, token, name) => ({
  collab_active: true, collabProvider: 'tiptap', collab_app_id: appId, collab_doc_id: document, collab_jwt: token,
  collab_user_name: name, collab_cursor_color: name === 'Ada' ? '#123456' : '#654321',
  ext_bubblemenu: true, bubbleMenu: 'bm-a',
});
const open = async (browser, document, token, name, errors) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/lib/tests/browser/lab.html');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(values => { makeEditor('a', values); }, properties(document, token, name));
  return { context, page };
};
const cleanup = async document => {
  const response = await fetch(`https://${appId}.collab.tiptap.cloud/api/documents/${encodeURIComponent(document)}`, {
    method: 'DELETE', headers: { Authorization: apiToken },
  }).catch(error => ({ ok: false, status: error.message }));
  if (!response.ok) console.warn(`Could not delete Tiptap Cloud document ${document}: ${response.status}`);
};

test('C1 two sessions share a real Tiptap Cloud document; menus act on it; teardown closes the connection', async ({ browser }) => {
  test.setTimeout(90000);
  const document = `wtf256-lab-${randomUUID()}`;
  const errors = [];
  const sessions = [];
  try {
    for (const name of ['Ada', 'Grace']) {
      const session = await open(browser, document, jwt(document), name, errors);
      sessions.push(session);
      await session.page.waitForFunction(() => editors.a.h.states.collab_synced, null, { timeout: 30000 });
    }
    const [ada, grace] = sessions.map(session => session.page);
    await expect.poll(() => ada.evaluate(() => labResources().openSockets)).toBe(1);
    // Typing in one session reaches the other, with the remote caret label.
    await ada.locator('#host-a .tiptap').click();
    await ada.keyboard.press('ControlOrMeta+End');
    await ada.keyboard.type(' from Ada');
    await expect(grace.locator('#host-a .tiptap')).toContainText('from Ada', { timeout: 15000 });
    await expect(grace.locator('.collaboration-carets__label')).toHaveText('Ada');
    // A Bubble Menu action in one session changes the shared document once.
    await ada.locator('#host-a .tiptap > *').first().click({ clickCount: 3 });
    await expect.poll(() => ada.evaluate(() => getComputedStyle(document.getElementById('bm-a')).visibility)).toBe('visible');
    const button = await ada.evaluate(() => {
      const rect = document.querySelector('#bm-a button').getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await ada.mouse.click(button.x, button.y);
    await expect(grace.locator('#host-a .tiptap h1')).toHaveCount(1, { timeout: 15000 });
    expect(await ada.evaluate(() => actionCounts)).toEqual({ 'a:h1': 1 });
    // Teardown closes the connection and releases the menu.
    await ada.evaluate(() => editors.a.h.instance.data.teardownEditor('lab done'));
    await expect.poll(() => ada.evaluate(() => labResources().openSockets)).toBe(0);
    expect(await ada.evaluate(() => labResources())).toMatchObject({ editors: 0, menuPlaceholders: 0 });
    expect(errors).toEqual([]);
  } finally {
    for (const session of sessions) await session.context.close();
    await cleanup(document);
  }
});

test('C2 a token Tiptap Cloud rejects gives up after five attempts and recovers with a valid token', async ({ browser }) => {
  test.setTimeout(120000);
  const document = `wtf256-lab-${randomUUID()}`;
  const errors = [];
  let context;
  try {
    let page;
    ({ context, page } = await open(browser, document, jwt(document, 'not-the-server-secret'), 'Ada', errors));
    // The plugin backs off 1, 2, 4 and 8 seconds between its five attempts.
    await page.waitForFunction(() => editors.a.h.states.collab_status === 'failed', null, { timeout: 60000 });
    expect(await page.evaluate(() => debuggerMessages)).toEqual([
      'a: Tiptap Cloud authentication failed after 5 attempts. Giving up. Please check your JWT token configuration.',
    ]);
    await expect.poll(() => page.evaluate(() => labResources().openSockets)).toBe(0);
    expect(await page.evaluate(() => labResources())).toMatchObject({ editors: 0, menuPlaceholders: 0 });
    await page.evaluate(token => { editors.a.properties.collab_jwt = token; editors.a.h.update(editors.a.properties); }, jwt(document));
    await page.waitForFunction(() => editors.a.h.states.is_ready && editors.a.h.states.collab_synced, null, { timeout: 30000 });
    await expect.poll(() => page.evaluate(() => labResources().openSockets)).toBe(1);
    await page.evaluate(() => editors.a.h.instance.data.teardownEditor('lab done'));
    await expect.poll(() => page.evaluate(() => labResources().openSockets)).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context?.close();
    await cleanup(document);
  }
});
