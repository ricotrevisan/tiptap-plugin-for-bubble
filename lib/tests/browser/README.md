# Real-browser Bubble adapter regressions

From `lib/`, using the repository's `.node-version`:

    npm ci
    npx playwright install --with-deps chromium firefox webkit
    npm run test:browser

CI builds before running Playwright and uploads failure traces. The server binds to loopback only and serves this checkout. Playwright starts/stops it automatically; no Bubble account or app changes are required.

The fixture loads built `lib/dist.js`, real jQuery 3.7.1, and actual decoded initialize/update/reset/set-content bodies. The shared harness is a dev dependency installed from a committed tarball; `npm ci` works without the harness source checkout.

Four tests run in all three engines:

- Typing publishes content and coherent debounced event snapshots; repeated updates preserve the editor and draft.
- Update and set-content action refresh the rendered document and table-of-contents state.
- Extension rebuild preserves unsaved text; reset destroys the editor and update remounts it while a second instance remains independent.
- Keyboard mention selection exercises shared list `length/get` and Thing `get` through the actual adapter and runtime.

`publishAutobinding` is an explicit fixture output recorder. Tiptap calls it after debounced edits and on blur even with inbound autobinding disabled. Tests observe its output without simulating persistence. Unsupported instance/context methods fail. Properties are explicit scenario inputs; no schema defaults or dynamic expressions are evaluated.

Real Bubble still must verify property resolution, scheduling, workflows, uploads, persistence, repeating-group lifecycle and app-specific layout. For actual Bubble verification set File uploads enabled explicitly as documented in AGENTS.md. No file-upload behavior is simulated here.

## Package provenance and upgrades

Package: `@rico/bubble-element-test-harness@0.1.0`

Source repository: `bubble-plugins/test-harness`, branch `feat/reusable-bubble-harness`, commit `49ddc2b`.

Archive: `lib/vendor/rico-bubble-element-test-harness-0.1.0.tgz`

SHA-256: `717423e3f159b72923afac5338f8d52f1c5b4213b89e1674d97fce2d640d3fdd`

The lockfile also pins SHA-512 integrity. The distributed README describes the interface and limitations. To upgrade, bump the source package version, run its unit/type/package checks, then `npm pack --pack-destination <consumer>/lib/vendor`. From this repository's `lib/`, run `npm install --save-dev --save-exact ./vendor/<new-version>.tgz`, update provenance, run checks, and commit the archive and lockfile. No publication or workstation-specific dependency path is needed.
