# WTF-263: recipes — verification

## Scope

- New user guide: [docs/recipes.md](../recipes.md). README links it and the
  canonical demo page (`tiptap-plugin` / `tiptap-demo`) instead of the old
  `tiptap-demo` app.
- No plugin source or runtime bundle change. `src/` and `lib/index.js` are
  untouched, so no new CDN asset, header change or `pled push` is needed.
- New tests:
  - `lib/tests/recipes-docs-contract.mjs`: every bold name in the recipes is a
    real element field/state/event/action, server action field, plugin key or
    an allowlisted Bubble label. Every recipe states **File uploads enabled**
    explicitly and cites a lifecycle test that runs in `npm test`. Defaults
    quoted (2200 ms, 300 ms) match `AAC.json`. README links the canonical demo,
    not the old one. No Liveblocks setup steps until WTF-248 is verified in a
    real Bubble app.
  - `lib/tests/document-ownership-lifecycle.mjs`: six scenarios through the
    real `initialize.js` / `update.js` / `dist.js` for the claims the existing
    suites didn't cover: explicit save events and no autobinding writes; the
    saved value returning as **Initial content** keeps the text; read-only view
    follows **Initial content**; collaboration waits for the token, then
    starts; autobinding is ignored while collaborating (writes and incoming
    values); **Content updated** fires on every local and remote collaborative
    change.
  - `lib/tests/webhook-html-node18-compatibility.mjs`: adds Tiptap Cloud's
    `document.saved` body (`tiptapJson`) passed whole as text.

## Red → green

- `recipes-docs-contract.mjs` before the docs: failed at `README links the
  canonical demo page` ([red-before-docs.txt](red-before-docs.txt)). After:
  `PASS recipes docs contract (80 bold terms, 5 recipes)`.
- The docs test also failed while drafting on four bold terms (`bold` in the
  intro, and three names wrapped across lines). The wrap was a test bug
  (Markdown reads a line break as a space); the intro was rewritten.
- `document-ownership-lifecycle.mjs` characterizes existing behavior, so it
  passed first time. Mutation check: removing `&& !properties.collab_active`
  from the autobinding branch in `update.js` makes "collaboration owns the
  document: autobinding is ignored" fail. Source restored.

## Real Bubble verification (2026-09-25)

- Bubble app `tiptap-plugin`, feature branch `wtf-263-recipes` (`73knr`),
  created from `test`. Savepoint before changes: `1790343414572`.
- Preview: https://tiptap-plugin.bubbleapps.io/version-73knr/tiptap-demo
  (login `tippy` / `tappy`). Plugin: development version, unchanged.
- Added reusables `demo-saving` and `demo-collaboration` to `tiptap-demo`
  after `demo-outputs`. Their BubbleScript is in [fixture/](fixture/). Every
  new Tiptap element sets **File uploads enabled** to no.
- New development records (titles start with `Recipe:`): save button
  `1790343746792x662993404464832000`, autobind A
  `1790343746793x195133471709167070`, autobind B
  `1790343746826x263583170732905920`, collaboration copy
  `1790343746792x915641002873984500`. Their text was reset after testing.
- Collaboration uses Tiptap Cloud app `nrm8d1ko`, document
  `tiptap-demo-recipes`, with the token from **generate auth token** on page
  load. (The older unused `Portable Multiplayer Demo` reusable points at
  `nrm8g1ko`, which doesn't resolve.)

All checks used real keyboard typing and real mouse clicks (agent-browser),
and read the development database through Buildprint.

| Recipe | Check | Result |
| --- | --- | --- |
| Save button | Edit shows "Unsaved changes"; database unchanged | ✓ |
| | Click Save → database has the edit; status "All changes saved." | ✓ |
| | Type immediately after clicking Save | Newer typing kept; database has the saved text |
| | Reload | Saved text shown; unsaved typing gone (expected) |
| Autobinding | Time from last keystroke to saved value (read-only view) | 2214 ms (default 2200) |
| | Type, then click outside the editor | Saved after 50 ms (blur flush) |
| | Type, then click Note B within the delay | A saved (click blurred first); B unchanged |
| | Reload | A and B hold their own text |
| Read-only | Editor vs read-only H2 styles | Both 24px / 800 / `0 0 8px`; read-only not editable |
| Collaboration | Two browser sessions | Both `connected`, synced, 2 people |
| | Type in A, then in B | Each sees the other's text; carets labelled "Guest" |
| | Save a copy in B | Database copy has the shared text; A's read-only view updated |
| | Before the token arrives | Debugger: waiting for credentials; then connected |

Screenshots: [demo-saving.png](demo-saving.png),
[demo-collaboration.png](demo-collaboration.png).

### Webhook persistence (not a working recipe)

To test the Tiptap Cloud webhook path, the branch temporarily got an exposed
backend workflow (`tiptap_document_saved`, kept as
[fixture/webhook-probe-removed.ts](fixture/webhook-probe-removed.ts)) and the
Workflow API was switched on for the branch only. A `document.saved`-shaped
body (from Tiptap's docs) was posted to it:

- Manual parameters with `tiptapJson` as text: HTTP 400 `Invalid data for key
  tiptapJson: Expected a string, but got a object`.
- Detected request data, passing `Request Data's raw body text` to the
  converter: `name` was read, but the raw body was empty, so the converter
  returned `The payload is empty`.

The probe workflow was deleted and the Workflow API switched off again on the
branch; the endpoint now returns `does not expose a Workflow API`. The recipes
document this and recommend a Save-a-copy button instead. A supported path
(for example a server action that fetches the document from Tiptap Cloud's
REST API by name) is a product decision for a follow-up.

## Not verified

- Custom Hocuspocus server in real Bubble (`collab.rico.wtf` returned 503).
  The recipe says so.
- Liveblocks: left out on purpose until WTF-248 is verified in a real Bubble
  app.
- Record switch without a blur in real Bubble: not repeated here. It's covered
  by `autobinding-record-lifecycle.mjs` and WTF-260's browser checks.
- Menus in a repeating group in real Bubble: covered by
  `menu-ownership-lifecycle.mjs` (two containers with the same menu ID); the
  demo page shows menus in a reusable only.
- Server-confirmed save before navigation: the recipes say the plugin can't
  provide it; no pattern was built.

## Final checks (Node 24, from `lib/`)

`npm ci`, `npm test` (21 scripts), `npm run validate:plugin` (5
metadata files, 73 function bodies), `npm run test:validator` (11 tests),
`npm run test:browser` (27 passed across Chromium, Firefox and WebKit), and
`git diff --check`. All passed.
