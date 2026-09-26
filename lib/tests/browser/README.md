# Real-browser Bubble adapter regressions

From `lib/`, using the repository's `.node-version`:

    npm ci
    npx playwright install --with-deps chromium firefox webkit
    npm run test:browser

CI builds before running Playwright and uploads failure traces. The server binds to loopback only and serves this checkout. Playwright starts/stops it automatically; no Bubble account or app changes are required.

The fixture loads built `lib/dist.js`, real jQuery 3.7.1, and actual decoded initialize/update/set-content bodies. The shared harness is a dev dependency installed from a committed tarball; `npm ci` works without the harness source checkout.

Twenty-seven scenarios run in all three engines (79 browser tests; the IME scenario runs in Chromium only and is skipped in Firefox and WebKit):

- Typing publishes content and coherent debounced event snapshots; repeated updates preserve the editor and draft.
- Update and set-content action refresh the rendered document and table-of-contents state.
- Extension rebuild preserves unsaved text; the internal teardown destroys the editor and update remounts it while a second instance remains independent.
- Keyboard mention selection exercises shared list `length/get` and Thing `get` through the actual adapter and runtime.
- Enter and click mention selection publish ID/label/trigger before **Mention created** fires once each; keyboard undo/redo does not fire.
- Two collaborators preserve edits and repaint caret names/colors through runtime provider reconfiguration.
- Real **Find**, **Replace**, and **Replace all** actions work after toggling **Find & Replace**, while preserving the draft.
- Find & Replace starts with JSON content and respects whole-word and case-sensitive options.
- **Insert image** publishes its URL without a fake upload event; keyboard deletion publishes removed URLs before **Image deleted**, with undo/redo and document-replacement coverage.
- Links (WTF-262): text typed with the real keyboard after a link set from a toolbar-style button, or after a link at the end of a line, is plain text. So is IME composition there (Chromium). Typing inside a link, Set link with nothing selected (with Backspace, and ArrowRight to stop at the end of a line and move on), retyping a selected link, pasting over it, **Remove link**, autolink, and HTML/JSON round trips keep their behavior.
- Mathematics (WTF-234, `math.spec.mjs`): with the toggle off no KaTeX file is requested. With it on, KaTeX's CSS, script and fonts (served from `node_modules/katex` in place of jsDelivr, same bytes, so SRI applies) render formulas in KaTeX fonts, and invalid LaTeX in red. A real click selects a formula and fires **Math clicked** once with the states already set; **Update math** from an input outside the editor and **Delete math** change it. Arrow keys select a formula without the event. Typing `$$…$$` and `$$$…$$$` makes formulas while `$5` stays text. In read-only mode a click does nothing.

`lifecycle-lab.spec.mjs` runs the WTF-256 lifecycle lab. `lab.html` is a Bubble-shaped page with several editors, menu groups, a floating group, a popup, a modal, a nested scroll area, resource counters, a Bubble-like autobinding record store, and the in-memory Liveblocks service. There are 15 cases in all three engines (45 tests). The contract is in `docs/wtf-256/lifecycle-lab.md`. The cases cover:
- menu hit-testing and stacking;
- exact-once actions and multi-editor isolation;
- rebuild leaks;
- autobinding convergence, record switches and blur;
- Hocuspocus, Liveblocks and rejected-token lifecycles.

The collaboration cases start local Hocuspocus servers. The token case waits out the plugin's real 15-second backoff.

Two real-Bubble checks are not Playwright tests and are not in CI:
- `check-bubble-lab.mjs` runs on the `lifecycle-lab` page.
- `check-demo-menu-lifecycle.mjs` runs on `tiptap-demo`.
- `check-bubble-math.mjs` mounts a Mathematics editor inside a real Bubble element on `tiptap-demo` and checks that KaTeX loads from the real jsDelivr with SRI and renders in its own fonts. `--local-bundle=<git ref>` serves this checkout's `dist.js` before a `pled push`.

Add `--local-initialize=<git ref>` to preview this checkout's `initialize.js` there before a `pled push` (see `real-bubble.mjs`).

`tiptap-cloud.spec.mjs` runs the plugin's Tiptap Cloud provider against the real Tiptap Cloud: two shared sessions, and a rejected token that recovers. It is skipped unless `TIPTAP_CLOUD_APP_ID`, `TIPTAP_CLOUD_SECRET` and `TIPTAP_CLOUD_API_TOKEN` are set; see its header for the 1Password references. CI has no credentials, so it reports skipped there.

The WTF-260 real-database autobinding probes (`*.py`) run against the `wtf-260-autobinding` page on `test`. Set `WTF260_WORKSPACE` to a Buildprint clone of `test`, then run `python3 open-autobinding-fixture.py`, then any probe.

`publishAutobinding` is an explicit fixture output recorder. With autobinding disabled, typing must not call it. Tests observe adapter outputs without simulating persistence. Bubble reset remains disabled; the teardown test invokes the internal lifecycle function directly. Unsupported instance/context methods fail. Properties are explicit scenario inputs; no schema defaults or dynamic expressions are evaluated.

Real Bubble still must verify property resolution, scheduling, workflows, uploads, persistence, repeating-group lifecycle and app-specific layout. For actual Bubble verification set File uploads enabled explicitly as documented in AGENTS.md. No file-upload behavior is simulated here.

## Package provenance and upgrades

Package: `@rico/bubble-element-test-harness@0.1.0`

Source repository: `bubble-plugins/test-harness`, branch `feat/reusable-bubble-harness`, commit `49ddc2b`.

Archive: `lib/vendor/rico-bubble-element-test-harness-0.1.0.tgz`

SHA-256: `717423e3f159b72923afac5338f8d52f1c5b4213b89e1674d97fce2d640d3fdd`

The lockfile also pins SHA-512 integrity. The distributed README describes the interface and limitations. To upgrade, bump the source package version, run its unit/type/package checks, then `npm pack --pack-destination <consumer>/lib/vendor`. From this repository's `lib/`, run `npm install --save-dev --save-exact ./vendor/<new-version>.tgz`, update provenance, run checks, and commit the archive and lockfile. No publication or workstation-specific dependency path is needed.
