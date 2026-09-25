# WTF-262: typing after a link — verification

## Scope and behavior

- Base: `main` at `f2c4f9f`. Contract: `link-boundary-contract.md`.
- Root cause: `@tiptap/extension-link` 3.31.3 sets `inclusive()` to the
  `autolink` option. The plugin's **Autolink** field defaults to yes, so links
  were inclusive and text typed at their right edge joined them.
- Fix (`src/elements/tiptap-AAC/initialize.js`): links are never inclusive. A
  small ProseMirror plugin keeps a link the user is *typing* going (after
  **Set link** with nothing selected, or when retyping a whole selected link),
  through Backspace and input rules, until the caret moves. ArrowRight at the
  end of a paragraph ends it (and still moves the caret if it can). Paste, drop, cut, remote collaboration edits,
  IME composition, non-text insertions and edits reaching back before the run
  are excluded. Retyping counts only when the typed text replaced the whole
  selection, so a stale selection can't relink text typed beside a link.

## Runtime bundle

`lib/index.js` now exports ProseMirror `Plugin` and `PluginKey` on
`window.tiptap`. Released as a new versioned asset:

- `pled upload lib/dist-v4.11.1-wtf262-bdd8b03533e2.js` → asset `AHS`,
  `//meta-q.cdn.bubble.io/f1790340793329x711759839404912300/dist-v4.11.1-wtf262-bdd8b03533e2.js`.
- SHA-256 of the CDN download equals the local build:
  `bdd8b03533e212e4c3c68e4a1624dd8bfe5d2e98ac489d3de71797dd8ca78c0e`.
- `src/elements/tiptap-AAC/headers.html` points at that URL.
- `pled push` was **not** run (not authorized for fix sessions). The ship
  session pushes it.

## Tests

- `lib/tests/link-boundary-lifecycle.mjs` (in `npm test`) runs the real decoded
  initialize/update/Set link/Remove link/Set content bodies on the built bundle.
  It covers: autolink on and off; right edge (text and `isActive`); end of
  line; inside and left edge; the stale-selection race; Set link with nothing
  selected; Backspace; ArrowRight at the end of a paragraph; input rules inside
  and reaching before the run; IME composition meta; mention insertion;
  retyping and undo; paste and remote edits; Remove link; HTML/JSON round trips
  with custom target/rel.
- `lib/tests/browser/link-boundary.spec.mjs`: twelve scenarios with real mouse
  and keyboard in Chromium, Firefox and WebKit. IME composition (CDP) runs in
  Chromium only. The fixture runs **Set link** from a real button outside the
  editor, which takes focus away as a Bubble toolbar button does. Tests wait
  for Tiptap's next-frame focus before typing.

### Red → green

With the `main` Link setup (`Link.configure(linkConfig)`):

- Browser: 6 of 18 failing before the extra cases were added — right edge and
  end of line in every engine. Example:
  `Received: <p>Read the docs <a …>today!</a></p>`.
- Node: `autolink on: text typed at the right edge is plain` —
  `'docs now' !== 'docs'` (and `links are not inclusive`).
- With only `inclusive: false` (first attempt), **Set link** with nothing
  selected followed by typing `hello` linked only `h`, and retyping a
  selected link dropped the link. The typing plugin was added for those; the
  browser spec shows they fail on the plain non-inclusive link.
- A `--repeat-each=5` run then found that typing which reached ProseMirror
  before it had read a click could relink text typed beside a still-selected
  link. The plugin now requires the typed text to replace the selection, and
  the lifecycle test covers it (case 4).

- Review round 1 (Backspace): with the `28aa68d` plugin, the lifecycle test
  fails `fixing a typo keeps the new link` (`' guid' !== ' guide'`).
- CI on `28aa68d` failed once in Chromium: Set link ran before Tiptap's
  next-frame focus, which then reset the caret and dropped the stored mark. The
  tests now wait for focus (`focusAt`).

- Review round 2 (ArrowRight at the end of a paragraph with more text after it
  kept the caret in place): the new browser case fails on the `695df4d`
  plugin in Chromium.

With the fix: `npm test` passes, `npm run validate:plugin` passes,
`npm run test:validator` 11/11, `npm run test:browser` 61 passed and 2 skipped
(IME outside Chromium). The full browser suite also passed `--repeat-each=4`
(244 passed, 8 skipped).

## Real Bubble

App `tiptap-plugin`, run mode, plugin **development version as currently
pushed** (without this change):

- `version-test/tiptap-demo`: every demo editor reports the Link mark with
  `autolink: true` and `inclusive: true`. After autolinking `example.org`,
  clicking just past it and pressing `X` gave `<a …>example.orgX</a>`.
- New branch `wtf-262-links` (`03knn`), created from `test`. Savepoint
  `1790340967140` was created before `buildprint apply`, which applied 18
  changes, then 2 more (icon size). Reusable `demo-docs` (Google Docs
  experience) gains **Link** (Set link `https://tiptap.dev`, lights up when the
  selection is a link) and **Remove link** toolbar buttons, a sample sentence
  and a wiring step. The editor keeps **File uploads enabled = no**.
- On `https://tippy:tappy@tiptap-plugin.bubbleapps.io/version-03knn/tiptap-demo`:
  real click after "word", Shift+ArrowLeft ×4, click on the Link toolbar
  button → `<a …href="https://tiptap.dev">word</a>`, selection kept (341–345),
  editor blurred. Click just past the link, keys `X`, `Y` →
  `<a …>wordXY</a>`. This is the customer's report, reproduced.

The fix itself can only run in Bubble after `pled push`. The ship session
should repeat the last step on `version-03knn` (or on `test` after the branch is
merged) and expect `<a …>word</a>XY`.

## Not covered

- **Set link** is a toggle: running it on a selection that is already a link
  removes the link instead of changing its URL. That is existing behavior,
  outside this ticket.
- IME composition *while typing a new link* is left to ProseMirror (only its
  stored mark applies). Only composition at an existing link's right edge has a
  browser test.
- The collaboration exclusion is tested with y-tiptap's `addToHistory: false`
  meta, not with a live collaboration session.
