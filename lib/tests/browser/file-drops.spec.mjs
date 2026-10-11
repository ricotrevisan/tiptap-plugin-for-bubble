import { test, expect } from '@playwright/test';

// DEF-1927: files the editor will not upload (type not allowed, or uploads off) must not
// reach the browser's default drop handling, which opens the file and leaves the page.
// They are reported once through File upload error, without console errors.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

async function editor(page, { uploads = true, mime = ['image/png', 'image/jpeg'] } = {}) {
  await page.evaluate(({ uploads, mime }) => {
    first.h.instance.data.teardownEditor('file drop test uses its own editor');
    window.uploaded = [];
    window.PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const list = mime && { get: (from, to) => mime.slice(from, to), length: () => mime.length };
    window.fd = makeHarness('second', { initialContent: '<p>Drop here</p>', ext_image: true,
      file_upload_condition: uploads, allowedMimeTypes: list });
    Object.assign(fd.h.instance, {
      canUploadFile: () => uploads,
      uploadFile: (file, callback) => { uploaded.push(file.name); callback(null, PNG); },
    });
  }, { uploads, mime });
  await page.waitForFunction(() => fd.h.states.is_ready);
}

// Dispatch a drop or paste of `files` (name/type pairs) plus optional extra data; return
// whether the default action was prevented and what the editor reported.
function send(page, kind, files, extra = {}) {
  return page.evaluate(({ kind, files, extra }) => {
    const dt = new DataTransfer();
    for (const [name, type] of files) dt.items.add(new File(['x'], name, { type }));
    for (const [type, value] of Object.entries(extra)) dt.setData(type, value);
    const target = document.querySelector('#second .tiptap');
    const box = target.getBoundingClientRect();
    const event = kind === 'drop'
      ? new DragEvent('drop', { dataTransfer: dt, clientX: box.left + 10, clientY: box.top + 10, bubbles: true, cancelable: true })
      : new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return new Promise(resolve => setTimeout(() => resolve({
      prevented: event.defaultPrevented,
      uploaded: [...uploaded],
      errorEvents: fd.h.events.filter(e => e.name === 'fileUploadError').length,
      message: fd.h.states.fileUploadErrorMessage || '',
      debugger: [...debuggerMessages],
      html: fd.h.instance.data.editor.getHTML(),
    }), 100));
  }, { kind, files, extra });
}

test('a dropped file of a type that is not allowed is blocked and reported once', async ({ page }) => {
  await editor(page);
  const r = await send(page, 'drop', [['invoice.pdf', 'application/pdf']]);
  expect(r).toMatchObject({ prevented: true, uploaded: [], errorEvents: 1 });
  expect(r.message).toContain('invoice.pdf');
  expect(r.debugger).toEqual([]);
});

test('a pasted file of a type that is not allowed is blocked and reported once', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'synthetic clipboard data is Chromium-only');
  await editor(page);
  const r = await send(page, 'paste', [['invoice.pdf', 'application/pdf']]);
  expect(r).toMatchObject({ prevented: true, uploaded: [], errorEvents: 1 });
});

test('with uploads off, a dropped image is blocked quietly', async ({ page }) => {
  await editor(page, { uploads: false });
  const r = await send(page, 'drop', [['shot.png', 'image/png']]);
  expect(r).toMatchObject({ prevented: true, uploaded: [], errorEvents: 1 });
  expect(r.message).toContain('shot.png');
  expect(r.debugger).toEqual([]);
});

test('an allowed image still uploads, and a mixed drop uploads only the allowed file', async ({ page }) => {
  await editor(page);
  const one = await send(page, 'drop', [['shot.png', 'image/png']]);
  expect(one).toMatchObject({ prevented: true, uploaded: ['shot.png'], errorEvents: 0 });
  expect(one.html).toContain('<img src="data:image/png');
  const mixed = await send(page, 'drop', [['b.png', 'image/png'], ['invoice.pdf', 'application/pdf']]);
  expect(mixed).toMatchObject({ prevented: true, uploaded: ['shot.png', 'b.png'], errorEvents: 1 });
  expect(mixed.message).toContain('invoice.pdf');
});

test('pasted files that also carry plain text paste the text when the files are refused', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'synthetic clipboard data is Chromium-only');
  await editor(page);
  const r = await send(page, 'paste', [['invoice.pdf', 'application/pdf']], { 'text/plain': 'invoice.pdf' });
  expect(r.errorEvents).toBe(0);
  expect(r.html).toContain('invoice.pdf');
});

test('a web image of a type that is not allowed drops as its HTML, as before', async ({ page }) => {
  await editor(page);
  const r = await send(page, 'drop', [['cat.webp', 'image/webp']], { 'text/html': '<p>Web caption</p>' });
  expect(r).toMatchObject({ uploaded: [], errorEvents: 0 });
  expect(r.html).toContain('Web caption');
});

test('an internal block drag is not treated as a file drop', async ({ page }) => {
  await editor(page);
  const r = await send(page, 'drop', [['shot.png', 'image/png']], { 'application/x-prosemirror-slice': '' });
  expect(r).toMatchObject({ uploaded: [], errorEvents: 0 });
});

test('a blank Allowed MIME Types list allows any type', async ({ page }) => {
  await editor(page, { mime: [] });
  const r = await send(page, 'drop', [['invoice.pdf', 'application/pdf']]);
  expect(r).toMatchObject({ prevented: true, uploaded: ['invoice.pdf'], errorEvents: 0 });
});

test('pasting web content that carries a file still pastes the content', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'synthetic clipboard data is Chromium-only');
  await editor(page);
  const r = await send(page, 'paste', [['invoice.pdf', 'application/pdf']], { 'text/html': '<p>Copied text</p>', 'text/plain': 'Copied text' });
  expect(r.errorEvents).toBe(0);
  expect(r.html).toContain('Copied text');
});

test('actions that fail report to the debugger instead of throwing', async ({ page }) => {
  await editor(page);
  const logged = page.errors.length;
  const r = await page.evaluate(() => {
    const editor = fd.h.instance.data.editor;
    const original = editor.commands.setContent;
    Object.defineProperty(editor, 'commands', { configurable: true, get: () => ({ setContent() { throw new Error('boom'); } }) });
    const before = debuggerMessages.length;
    let threw = null;
    // The fixture context has no reportToDebugger, like Bubble's action context.
    try { fd.h.action('setContent', { content: '<p>x</p>', is_json: false }); } catch (e) { threw = e.message; }
    delete editor.commands;
    return { threw, reported: debuggerMessages.slice(before) };
  });
  expect(r.threw).toBeNull();
  expect(r.reported.join(' ')).toContain('boom');
  // The action also logs the original error to the console on purpose.
  expect(page.errors.length - logged).toBe(1);
  page.errors.splice(logged);
});
