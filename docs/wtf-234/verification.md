# WTF-234: Mathematics (LaTeX) — verification

## Scope and behavior

- Base: `main` at `92592c3`. Spec: the ticket's "Decided spec — 2026-09-26".
  Contract: `math-contract.md` (18 numbered cases).
- `@tiptap/extension-mathematics` 3.31.3 (`InlineMath`, `BlockMath`) behind the
  new **Mathematics** field (`ext_math`, off by default), with the extension's
  own `$$…$$` / `$$$…$$$` input rules. `migrateMathStrings` is never run.
- KaTeX options: `throwOnError: false` for both nodes, `displayMode: true` for
  blocks.
- New states **Selected math LaTeX** / **Selected math type**, published with
  the other active states on every transaction and selection change. New event
  **Math clicked**, fired by the extension's click handler after selecting the
  formula and publishing the states. In read-only mode a mousedown on a formula
  is swallowed, so the browser can't select it either.
- New actions **Insert inline math**, **Insert block math**, **Update math**,
  **Delete math**. Update re-selects the formula it changed.
- Stored HTML is the extension's `data-type`/`data-latex` element, plus the raw
  LaTeX as text content, so the HTML is readable outside the editor.
- Changing the toggle on a live editor rebuilds it (like AI Toolkit, Find &
  Replace and Table of Contents). Turning it off keeps unsaved content as HTML,
  so formulas become their LaTeX text instead of the document failing to load.
- **Convert webhook payload to HTML** defines the two nodes with
  `@tiptap/core` only (same HTML), so the server action needs no new package
  and no KaTeX.

## Runtime bundle and KaTeX

- KaTeX is **not** bundled. The build aliases the extension's `katex` import to
  `lib/katex-runtime.js`. `window.tiptap.loadKatex()` adds, once per page:
  - `https://cdn.jsdelivr.net/npm/katex@0.16.29/dist/katex.min.css`
    `sha384-aKaoM0KVxt5vkmTHL4GAGXO2P1JTsTJ73egG6+Brhf70Apf9rfPzegvgcWGBk3cS`
  - `https://cdn.jsdelivr.net/npm/katex@0.16.29/dist/katex.min.js`
    `sha384-Nb8LtjZTKLgHUQ9V7avGfqntEr9VJWRr07IFUImhYDmZBjH+V9k1N0OrCXLdW85/`

  Both files were downloaded from jsDelivr and compared byte for byte with the
  npm package `katex@0.16.29` (the dev dependency the tests use) before hashing.
- Size: `dist.js` 1,450,671 → 1,457,014 bytes (+6.3 KB: the extension and the
  loader). Bundling KaTeX would have added 273 KB for every app.
- Released as a new versioned asset:
  `pled upload lib/dist-v4.12.0-wtf234-844adbe3c1f8.js` → asset `AHT`,
  `//meta-q.cdn.bubble.io/f1790431752601x176783390168029120/dist-v4.12.0-wtf234-844adbe3c1f8.js`.
  SHA-256 of the CDN download equals the local build:
  `844adbe3c1f8a0d9410f8ee73711f8b4dccb984e3db5e08277573bed7771352a`.
  `headers.html` points at it. `pled push` was **not** run (not authorized for
  fix sessions); before this session's upload, `pled status` showed only local
  changes (not remote-ahead).

## Tests

- `lib/tests/math-lifecycle.mjs` (in `npm test`) runs the real decoded
  initialize/update/Set content and the four new action bodies on the built
  bundle, with the real `katex` package standing in for the CDN script. It
  covers contract cases 1–17: metadata, toggle off (schema, no assets, no input
  rules), KaTeX blocked (raw LaTeX, one debugger message, retry), KaTeX
  arriving (waiting formulas typeset, one stylesheet and script per page, SRI),
  HTML/JSON round trips with Preserve unknown HTML tags on, `$` text never
  converted, typing rules and currency, click → selection → states → one
  event, per-editor isolation, states following selection/update/undo/delete,
  the four actions including no-ops, invalid LaTeX red and still saved
  (contentHTML and autobinding), read-only clicks, toggling on/off with
  content kept, and actions with the toggle off.
- `lib/tests/webhook-html-node18-compatibility.mjs`: case 18.
- `lib/tests/browser/math.spec.mjs` (Chromium, Firefox, WebKit; 6 scenarios,
  18 tests): real KaTeX CSS/fonts, real mouse clicks, arrow keys, keyboard
  typing and read-only clicks. See `lib/tests/browser/README.md`.

### Red → green

- `math-lifecycle.mjs` on the unchanged source: `AssertionError: Mathematics
  field exists`.
- Webhook on the unchanged action: `Unexpected error during conversion:
  RangeError: Unknown node type: inlineMath`.
- Found by the tests while building:
  - A blocked KaTeX script can fail synchronously. The loader then kept the
    rejected promise and never retried (`a failed script is removed so a later
    editor retries`, then `KaTeX loaded` failed). It now resets after the
    promise settles.
  - Turning Mathematics off with a formula in the document rebuilt an empty
    editor (`'' !== 'Draft Keep mea^2'`), because the preserved JSON contained
    node types the new schema lacks. Preserving HTML in that case fixes it.
  - Read-only: in all three engines a real click still selected the formula
    (the states showed `\pi r^2`, `inline`); the extension's click hook alone
    doesn't stop the browser's selection. Swallowing the mousedown fixes it.

### Gates (Node 24, from `lib/`)

`npm ci`, `npm test` (21 scripts), `npm run validate:plugin` (5 metadata
files, 77 function bodies), `npm run test:validator` (11/11),
`npm run test:browser` (124 passed, 8 skipped: IME outside Chromium, Tiptap
Cloud without credentials). All passed.

## Real Bubble

- `node tests/browser/check-bubble-math.mjs --local-bundle=e185dc5` on
  `https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo` (run mode,
  real jsDelivr, this checkout's `dist.js` served in place of the pushed
  bundle; nothing in Bubble changed). A Mathematics editor mounted inside the
  first demo editor's Bubble element:
  - KaTeX CSS and script loaded from jsDelivr with the SRI above;
  - the inline formula's font is `KaTeX_Main`; `KaTeX_Main`, `KaTeX_Math` and
    `KaTeX_Size2` loaded;
  - the block formula rendered in display mode;
  - `\frac{` rendered as `rgb(204, 0, 0)` text.

  Screenshot: `bubble-math-render.png`.
- The element's new field, actions, states and event can't be used in Bubble
  before `pled push`: Buildprint rejects the demo with `BSP2001 Unknown
  property "ext_math" for 1670612027178x122079323974008830_current-AAC`, and
  its copy of the plugin definition is read-only (`BSP7001`).
- Bubble branch `wtf-234-math` was created from `test` for the demo. Nothing
  has been applied to it yet. The demo is ready in `bubble-demo/`: a
  `demo-math` reusable (editor with Mathematics on and **File uploads
  enabled = no**, Insert inline/block formula buttons, a Selected formula
  readout, and a popup whose input starts from Selected math LaTeX, with Save =
  Update math, Delete = Delete math, Cancel), its six workflows, and the
  `tiptap-demo` placement (`tiptap-demo-page.diff`). With the plugin schema
  extended locally, `buildprint check` reported no other errors.

## After `pled push` (ship)

1. Clone `wtf-234-math`, copy `bubble-demo/demo-math` to
   `reusable-elements/demo-math`, apply `tiptap-demo-page.diff`,
   `buildprint check`, savepoint, `buildprint apply`.
2. On `version-<id>/tiptap-demo`, with real mouse and keyboard: type `$$x^2$$`;
   click a formula → the popup opens with its LaTeX; Save a change; Delete;
   Insert inline/block formula; invalid LaTeX is red; the readout follows the
   selection.

## Not covered

- Formulas count as no text in **Content (text)**, character and word counts
  (the extension defines no plain-text form).
- In the editor, formulas only render after KaTeX arrives from jsDelivr. If a
  site blocks jsDelivr, formulas stay as LaTeX text.
- Pasting HTML from other math editors that don't use `data-latex` (for
  example MathML) isn't converted.
