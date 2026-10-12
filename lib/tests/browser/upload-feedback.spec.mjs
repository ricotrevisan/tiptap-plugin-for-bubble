import { test, expect } from '@playwright/test';

// DEF-1927: while a dropped or pasted file uploads, a placeholder chip shows its name and
// progress where it will land. The chip is a decoration: never in the document, HTML or
// collaboration. Files uploading / Upload started let apps build their own UI, and leaving
// the page mid-upload asks for confirmation.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.errors = errors;
  await page.goto('/lib/tests/browser/fixture.html');
  await page.waitForFunction(() => window.ready && first.h.states.is_ready);
  await page.evaluate(() => {
    first.h.instance.data.teardownEditor('upload feedback test uses its own editor');
    const mime = ['image/png', 'application/pdf'];
    window.fd = makeHarness('second', { initialContent: '<p>Alpha</p><p>Omega</p>', ext_image: true, ext_link: true, ext_codeblock: true,
      insert_file_links: true, file_upload_condition: true,
      allowedMimeTypes: { get: (a, b) => mime.slice(a, b), length: () => mime.length } });
    // Uploads finish only when the test says so.
    window.pending = {};
    window.PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    Object.assign(fd.h.instance, {
      canUploadFile: () => true,
      uploadFile: (file, callback, _attach, progress) => { pending[file.name] = { callback, progress }; },
    });
  });
  await page.waitForFunction(() => fd.h.states.is_ready);
});
test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

function drop(page, names) {
  return page.evaluate(names => {
    const target = document.querySelector('#second .tiptap');
    const omega = target.querySelectorAll('p')[1].getBoundingClientRect();
    const dt = new DataTransfer();
    for (const name of names) dt.items.add(new File(['x'], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'image/png' }));
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: omega.left + 1, clientY: omega.top + 3, bubbles: true, cancelable: true }));
  }, names);
}

const chips = page => page.evaluate(() => [...document.querySelectorAll('#second .tiptap-upload-placeholder')].map(c => c.textContent));
const html = page => page.evaluate(() => fd.h.instance.data.editor.getHTML());

test('a placeholder shows the file name and progress until the upload finishes', async ({ page }) => {
  await drop(page, ['invoice.pdf']);
  expect(await chips(page)).toEqual(['Uploading invoice.pdf…']);
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(1);
  expect(await page.evaluate(() => fd.h.events.filter(e => e.name === 'upload_started').length)).toBe(1);
  expect(await html(page)).toBe('<p>Alpha</p><p>Omega</p>');  // not part of the document

  await page.evaluate(() => pending['invoice.pdf'].progress(0.4));
  expect(await chips(page)).toEqual(['Uploading invoice.pdf… 40%']);

  // Typing above it moves it along.
  await page.evaluate(() => fd.h.instance.data.editor.chain().insertContentAt(1, 'New. ').run());
  const sits = await page.evaluate(() => document.querySelector('#second .tiptap-upload-placeholder').closest('p').textContent);
  expect(sits).toContain('Omega');

  await page.evaluate(() => pending['invoice.pdf'].callback(null, 'https://files.test/invoice.pdf'));
  expect(await chips(page)).toEqual([]);
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(0);
  expect(await html(page)).toContain('>invoice.pdf</a>');
});

test('several files each get a placeholder, in drop order', async ({ page }) => {
  await drop(page, ['a.pdf', 'b.png']);
  expect(await chips(page)).toEqual(['Uploading a.pdf…', 'Uploading b.png…']);
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(2);
  await page.evaluate(() => pending['b.png'].callback(null, PNG_URL));
  expect(await chips(page)).toEqual(['Uploading a.pdf…']);
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(1);
  await page.evaluate(() => pending['a.pdf'].callback(null, 'https://files.test/a.pdf'));
  expect(await chips(page)).toEqual([]);
});

test('a failed upload removes its placeholder', async ({ page }) => {
  await drop(page, ['invoice.pdf']);
  await page.evaluate(() => pending['invoice.pdf'].callback(new Error('Upload failed')));
  await page.waitForTimeout(50);
  expect(await chips(page)).toEqual([]);
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(0);
  page.errors.length = 0;  // the failure is logged on purpose
});

test('leaving the page during an upload asks for confirmation', async ({ page }) => {
  const prompted = () => page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(await prompted()).toBe(false);
  await drop(page, ['invoice.pdf']);
  expect(await prompted()).toBe(true);
  await page.evaluate(() => pending['invoice.pdf'].callback(null, 'https://files.test/invoice.pdf'));
  expect(await prompted()).toBe(false);
});

test('files land in drop order even when a later one finishes first', async ({ page }) => {
  await drop(page, ['first.pdf', 'second.pdf']);
  await page.evaluate(() => pending['second.pdf'].callback(null, 'https://files.test/second.pdf'));
  await page.evaluate(() => fd.h.instance.data.editor.chain().insertContentAt(1, 'Edited. ').run());
  await page.evaluate(() => pending['first.pdf'].callback(null, 'https://files.test/first.pdf'));
  const out = await html(page);
  expect(out).toContain('Edited. Alpha');
  expect(out.indexOf('>first.pdf<')).toBeGreaterThan(out.indexOf('Alpha'));
  expect(out.indexOf('>first.pdf<')).toBeLessThan(out.indexOf('>second.pdf<'));
  expect(await chips(page)).toEqual([]);
});

test('files that finish in drop order also land in drop order', async ({ page }) => {
  await drop(page, ['first.pdf', 'second.pdf']);
  await page.evaluate(() => pending['first.pdf'].callback(null, 'https://files.test/first.pdf'));
  await page.evaluate(() => pending['second.pdf'].callback(null, 'https://files.test/second.pdf'));
  const out = await html(page);
  expect(out.indexOf('>first.pdf<')).toBeGreaterThan(-1);
  expect(out.indexOf('>first.pdf<')).toBeLessThan(out.indexOf('>second.pdf<'));
});

test('Files uploading is already set when Upload started fires', async ({ page }) => {
  await page.evaluate(() => {
    const trigger = fd.h.instance.triggerEvent;
    fd.h.instance.triggerEvent = name => { if (name === 'upload_started') window.countAtStart = fd.h.states.files_uploading; return trigger(name); };
  });
  await drop(page, ['a.pdf', 'b.pdf']);
  expect(await page.evaluate(() => window.countAtStart)).toBe(2);
});

test('an editor torn down mid-upload settles the count and the leave-page guard', async ({ page }) => {
  await drop(page, ['invoice.pdf']);
  await page.evaluate(() => fd.h.instance.data.teardownEditor('rebuild mid-upload'));
  await page.evaluate(() => pending['invoice.pdf'].callback(null, 'https://files.test/invoice.pdf'));
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(0);
  const prompted = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(prompted).toBe(false);
});

test('uploads across a rebuild leave no leave-page guard behind', async ({ page }) => {
  await drop(page, ['a.pdf']);
  await page.evaluate(() => { fd.properties.placeholder = 'rebuilt'; fd.h.instance.data.teardownEditor('rebuild'); fd.h.update(fd.properties); });
  await page.waitForFunction(() => fd.h.instance.data.editor_is_ready);
  await drop(page, ['b.pdf']);
  await page.evaluate(() => { pending['a.pdf'].callback(new Error('gone')); pending['b.pdf'].callback(null, 'https://files.test/b.pdf'); });
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(0);
  const prompted = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(prompted).toBe(false);
  page.errors.length = 0;  // the failed upload is logged on purpose
});

test('pasting a file over a selection replaces it', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'synthetic clipboard data is Chromium-only');
  await page.evaluate(() => {
    const ed = fd.h.instance.data.editor; ed.commands.setTextSelection({ from: 2, to: 5 });
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'p.pdf', { type: 'application/pdf' }));
    document.querySelector('#second .tiptap').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.evaluate(() => pending['p.pdf'].callback(null, 'https://files.test/p.pdf'));
  const out = await html(page);
  expect(out).not.toContain('lph');
  expect(out).toContain('>p.pdf</a>');
});

test('two images dropped on an empty line land in drop order', async ({ page }) => {
  await page.evaluate(() => fd.h.instance.data.editor.commands.setContent('<p>Alpha</p><p></p><p>Omega</p>'));
  await page.evaluate(() => {
    const target = document.querySelector('#second .tiptap');
    const empty = target.querySelectorAll('p')[1].getBoundingClientRect();
    const dt = new DataTransfer();
    for (const name of ['one.png', 'two.png']) dt.items.add(new File(['x'], name, { type: 'image/png' }));
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: empty.left + 1, clientY: empty.top + 3, bubbles: true, cancelable: true }));
    window.urls = { 'one.png': PNG_URL + '#one', 'two.png': PNG_URL + '#two' };
  });
  await page.evaluate(() => pending['one.png'].callback(null, urls['one.png']));
  await page.evaluate(() => pending['two.png'].callback(null, urls['two.png']));
  const out = await html(page);
  expect(out.indexOf('#one')).toBeGreaterThan(-1);
  expect(out.indexOf('#one')).toBeLessThan(out.indexOf('#two'));
});

test('Files uploading is 0 before any upload', async ({ page }) => {
  expect(await page.evaluate(() => fd.h.states.files_uploading)).toBe(0);
});

test('in an empty editor the placeholder text hides while a chip is shown', async ({ page }) => {
  await page.evaluate(() => {
    fd.h.instance.data.teardownEditor('placeholder test');
    window.fd = makeHarness('second', { initialContent: '', placeholder: 'Write something…', ext_placeholder: true, ext_link: true, insert_file_links: true, file_upload_condition: true });
    Object.assign(fd.h.instance, { canUploadFile: () => true, uploadFile: (file, callback, _a, progress) => { pending[file.name] = { callback, progress }; } });
  });
  await page.waitForFunction(() => fd.h.states.is_ready);
  await page.evaluate(() => {
    const target = document.querySelector('#second .tiptap'); const r = target.getBoundingClientRect();
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 10, bubbles: true, cancelable: true }));
  });
  const before = await page.evaluate(() => {
    const p = document.querySelector('#second .tiptap p');
    return { chip: !!p.querySelector('.tiptap-upload-placeholder'), placeholder: getComputedStyle(p, '::before').content };
  });
  expect(before.chip).toBe(true);
  expect(['none', 'normal', '""']).toContain(before.placeholder);
  await page.evaluate(() => pending['a.pdf'].callback(null, 'https://files.test/a.pdf'));
  expect(await html(page)).toMatch(/^<p><a [^>]*>a\.pdf<\/a> <\/p>$/);
});

test('a file dropped just above a code block does not go into the code', async ({ page }) => {
  await page.evaluate(() => fd.h.instance.data.editor.commands.setContent('<pre><code>let x = 1</code></pre>'));
  await page.evaluate(() => {
    const target = document.querySelector('#second .tiptap'); const r = target.getBoundingClientRect();
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: r.left + 10, clientY: r.top + 2, bubbles: true, cancelable: true }));
  });
  await page.evaluate(() => pending['a.pdf'].callback(null, 'https://files.test/a.pdf'));
  const out = await html(page);
  expect(out).toContain('<code>let x = 1</code>');
  expect(out).not.toMatch(/<code>[^<]*a\.pdf/);
});
