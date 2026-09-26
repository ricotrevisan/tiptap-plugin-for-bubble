# WTF-256: lifecycle lab — local and real-Bubble verification

## Scope

**Round 1** follows the ticket's latest triage (2026-09-23). It continues the
bounded lab:

- action, rebuild and resource counters;
- hit-testing and modal stacking;
- multi-editor isolation.

**Round 2** follows the maintainer's instruction on 2026-09-25 to go ahead
with the rest. It adds:

- a fix for the in-menu-input limitation;
- autobinding, Liveblocks and authentication cases in the lab;
- a Bubble lab page with saved Buildprint tests;
- a fresh page inventory.

No Bubble page was deleted. Page deletion still needs a decision on the
inventory (see below).

What is in this PR:

- **Automated lifecycle lab** (`lib/tests/browser/lab.html`,
  `lifecycle-lab.spec.mjs`, in CI): 15 cases (L1–L15) in Chromium, Firefox and
  WebKit. The contract, and how it maps to the ticket's matrix, is in
  [lifecycle-lab.md](lifecycle-lab.md).
- **Real-Bubble lab:**
  - the `lifecycle-lab` page on the Bubble branch `wtf-256-lab` (`73kof`),
    with its source copied to [bubble-lab/](bubble-lab/);
  - five saved Buildprint tests;
  - `check-bubble-lab.mjs` (20 checks) and `check-demo-menu-lifecycle.mjs`
    (3 checks). Both share `real-bubble.mjs`, which provides
    `--local-initialize`.
- **Page inventory:** [page-inventory.md](page-inventory.md).
- **Three menu fixes**, all in `src/elements/tiptap-AAC/initialize.js`.
  `lib/index.js` and the runtime bundle are unchanged, so there's no new CDN
  asset or header change.
- The in-memory Liveblocks service
  (`lib/tests/support/fake-liveblocks.mjs`) now uses `btoa`/`atob` instead of
  Node's `Buffer`, so it runs in the browser lab too. The Node suites that use
  it still pass.

## Defects found and fixed

1. **Hidden body layers inflated the menu z-index (L4).** A shown menu took
   `max(z-index of body children) + 1`, and hidden children counted. Real
   Bubble keeps a closed popup in `<body>` as `display: none` with
   `z-index: 2002`. After one open/close, every later menu got 2003 and
   covered the popup when it reopened. Now only body layers that are displayed
   and not `visibility: hidden` count. A visible menu of another editor counts
   through its portal.
2. **Menus didn't hide when focus moved to another focusable element (L8).**
   Tiptap's blur handler returns early when
   `menu.parentNode.contains(event.relatedTarget)`. Menus were appended
   directly to `<body>`, so that was always true. The Bubble Menu or Floating
   Menu stayed visible and clickable after the user clicked into another editor
   or an input. Only a click on non-focusable space hid it. Each shown menu is
   now appended to its own `display: contents` portal in `<body>`. The portal
   has no box and no z-index, so layout and stacking are unchanged. Tiptap's
   "focus moved into the menu" check now means what it says. The portal is
   removed on hide and on lease release, so hidden menus leave nothing in
   `<body>`.
3. **A menu stayed open after focus left an input inside it (L10).** When
   focus is in the menu, its editor is already blurred. Moving on from the
   input then fires no editor blur, so the menu stayed open until the editor
   was used again. A `focusout` listener on each leased menu wrapper now
   dispatches the menu's own `hide` transaction when focus leaves the menu for
   anything other than the menu or its editor. When there is no
   `relatedTarget` (a click on empty space) it hides too, the same as Tiptap's
   blur handler.
   - Review round 2 found that the first version (`6b68f1e`) re-entered
     Tiptap's `hide()`: Chromium fires `focusout` while `hide()` removes the
     focused menu. The inner hide moved the wrapper, the outer `remove()`
     threw, and the transaction's update was lost. So a "Divider" menu button
     didn't publish its edit (L15, red in Chromium; real Bubble published
     Content (HTML) without the `<hr>`).
   - The listener now ignores a menu that is already being hidden (`hide()`
     sets `visibility: hidden` before it removes the menu). It dispatches its
     own hide in a microtask, which re-checks that focus hasn't returned to
     the menu or editor and that the editor is still current.

## Red → green

Full record: [red-before-fix.txt](red-before-fix.txt).

| Surface | `origin/main` / deployed dev version | This branch |
| --- | --- | --- |
| Automated lab, 3 engines | L4, L8, L10 fail (9 failed, 33 passed of L1–L14). L15 passes on main, which has no fix 3; it failed in Chromium on the unguarded `6b68f1e`. | 45/45 |
| `check-bubble-lab.mjs` on `lifecycle-lab` | 7 of 20 checks fail: menus linger after a focus move and after leaving their input, then intercept the pointer after resize and scroll, and menus go above the closed popup (2004/2005 over 2002). With `6b68f1e`'s code only the Divider check fails (no `<hr>` published). | 20/20 with `--local-initialize=origin/main` |
| `check-demo-menu-lifecycle.mjs` on `tiptap-demo` | 2 of 3 fail (menu lingers; z-index 2003 over a popup at 2002) | 3/3 with `--local-initialize=origin/main` |
| Saved Buildprint tests on `wtf-256-lab` | `menu_hides_on_focus_move` and `menu_below_closed_popup` fail at their bug checks; the other three pass | green expected after `pled push` (they run the deployed plugin) |

## Bubble changes (made on my branch `wtf-256-lab`, `73kof`; merged into `test` in round 3)

- **Branch:** created from `test` with Buildprint. There were six other
  branches under `test`, so this is the seventh of nine.
- **Savepoints:** `1790354571044` before the first apply, and `1790358077446`
  before the Divider scenario.
- **Page `lifecycle-lab`:**
  - editors A and B with Bubble Menus;
  - a Floating Menu on A, and an input inside menu A;
  - a page input;
  - an editor with a Floating Menu in a scrolling group;
  - an editor in a popup, with open and close buttons;
  - an editor in a floating group;
  - two copies of the new reusable `lab-editor-copy`, which share the menu
    ID `labDupMenu`;
  - one page counter per menu workflow;
  - a Divider (horizontal rule) button in Floating Menu A, and a text that
    shows editor A's published Content (HTML).

  Every editor sets **File uploads enabled** to `no` and **Type of content**
  to User; mentions are off.
- **Saved Buildprint tests** (`tests/components/lab_open`, `lab_select`,
  `lab_click_menu`; `tests/lifecycle_lab/`):
  - `menu_click_runs_once`
  - `menu_hides_on_focus_move`
  - `menu_below_closed_popup`
  - `reusable_copies_isolated`
  - `floating_menu_divider_publishes`

  Recorded batches: `ac19f939-0325-4430-8f7c-f9af20ed9a8f` (the first four)
  and `bbdc5a96-c3c9-4045-96ee-d9700445f619` (all five).
- **Tooling:** Buildprint's runner needs `agent-browser` 0.38.0 or newer. The
  global `agent-browser` in `~/.local` was upgraded from 0.35.1 to 0.38.1,
  when no session was running. npm skipped its postinstall script; the runner
  works without it.
- The Buildprint CLI used a temporary `ricowtf` profile. It was switched back
  to `default` and the temporary profile was removed afterwards.
- `test` and `live` were only read (inventory clones). Nothing was merged or
  deleted.

## Lab stability

Timing issues found and fixed in the lab while it was built. None of them were
plugin defects:

- ProseMirror applies a click's selection just after mouseup, so the lab uses
  a triple-click to select, and retries End until the caret has landed.
- Element actions call Tiptap's deferred `focus()`, which restores the
  selection on the next animation frame. The lab waits two frames and confirms
  the selection collapsed.
- Bubble Menu hides after Tiptap's 250 ms update delay, so "hidden" is polled.

Repeated runs of the whole lab with CI settings (`CI=1`, 2 workers, three
engines, `--repeat-each=4`, 108 tests):

- the final version passed 108/108;
- the previous run, before the End-retry helper, had one selection race and two
  Firefox clicks that timed out after 30 s while other engines ran in
  parallel.

The timeouts didn't reproduce in 20 isolated Firefox repeats of those cases.
The existing `lifecycle.spec.mjs` passed 60/60 under the same repeat load.

Round 2:

- The autobinding cases wait for "settled": no write in flight and no new
  write for 1.5 s.
- The token case waits out the plugin's real 1 + 2 + 4 + 8 s backoff, so it
  gets a 90 s timeout.
- One real-Bubble run hit a 60 s page-load timeout. The rerun passed. Page
  loads now wait up to 120 s.
- Review round 2 found two races in the lab's own `settled()` helper, both
  fixed:
  - The stale write in L11 finishing last needs a corrective write, so the
    helper now also waits for the plugin's queued save or repair.
  - It read the store and the controller in one page evaluation, so a
    repair can't fire between two reads.
- After the fixes, L11/L12 passed 36/36 over 6 repeats in all engines.

## Gates (Node 24, from `lib/`, merged with `origin/main` `9d46395`)

All passed on 2026-09-25, round 2, after the review fixes:

- `npm ci` (run earlier in round 2)
- `npm test`: 19 scripts
- `npm run validate:plugin`: 5 metadata files, 73 function bodies
- `npm run test:validator`: 11 passed
- `CI=1 npm run test:browser`: 72 passed. That is 45 lab tests plus the
  existing 27, across Chromium, Firefox and WebKit.

Round 3 gates: the same commands passed, and `CI=1 npm run test:browser`
reported 72 passed and 6 skipped (the opt-in Tiptap Cloud spec). With this
branch's `initialize.js` served in, `check-bubble-lab.mjs` passed 20/20 on the
merged `version-test/lifecycle-lab`.

After merging `origin/main` `a132fdb` (WTF-262 link fix, new runtime bundle,
already pushed to the development version), with the CHANGELOG and tests
README conflicts resolved by keeping both sides:
- `npm ci`, `npm test`, `validate:plugin` and `test:validator` (11) all
  passed;
- `CI=1 npm run test:browser` reported 106 passed and 8 skipped (6 Tiptap
  Cloud, 2 Chromium-only IME cases);
- against the new deployed version, `check-bubble-lab.mjs` still fails the
  same 7 of 20 checks, and with the merged `initialize.js` served in it
  passes 20/20. `check-demo-menu-lifecycle.mjs` passes 3/3 with it.

Round 1 gates, at `039fa6d`, had the same results with 54 browser tests.

## Review

- **Independent read-only review of `bbf79fd`: approve with findings.** It
  confirmed both fixes against the installed Tiptap 3.31.3 source and the
  bundled `dist.js`.
- It also ran each fix alone in a throwaway copy:
  - without the visible-layer filter, only L4 fails;
  - with `appendTo: () => document.body` restored, only L8 fails.
- It ran the real-Bubble check in both modes and got the results recorded
  above.
- Fixed in the next commit:
  - CHANGELOG wording narrowed (menus hide when focus leaves *the editor*; a
    closed popup no longer ends up under menus).
  - L8 now covers a non-focusable `<div>` button and an input inside the menu.
  - L6 asserts that the second editor holds no lease and waits past Tiptap's
    250 ms show delay.
  - L4 really opens and closes the popup.
  - The check script parses `--local-initialize=` refs that contain `=`, and
    reads the z-index of the popup it opened.
  - The red record notes that `initialize.js` is identical at `321e20b` and
    `f2c4f9f`.
  - Documented as a known limitation: focus inside the menu, then another
    editor. This was already the case before this PR. So is the listener
    counter's bias toward false leaks (`once`/`AbortSignal` listeners).
- **Re-review of `0e44f16`: approve.**
  - All seven findings were confirmed resolved.
  - Both single-fix mutations still fail only L4 and only L8.
  - 54/54 browser tests passed.
  - Its three nits are fixed in the next commit:
    - L8 now also focuses the in-menu input without a mousedown. That path
      reaches Tiptap's "focus moved into the menu" check instead of
      `preventHide`. It also asserts the typed value.
    - A duplicated comment phrase in `lab.html` is removed.
    - The check script gives a clear error if no popup opened.
- **Drummer (static, nonblocking) review of `bbf79fd`:** no important or
  blocker findings.
- **Round 2, review of `6b68f1e`: request changes.**
  1. **Blocking:** fix 3 re-entered Tiptap's `hide()` in Chromium and lost
     the edit's update. Fixed with a guard and a microtask. L15 was added
     (red on `6b68f1e` in Chromium), plus a real-Bubble Divider check and a
     Buildprint test.
  2. **Medium:** L11 never made a stale write land last. Fixed: the delays are
     now 2500/100/100 ms, and the test asserts the corrective write.
  3. **Low:** the L14 doc claimed more than the test checked. The test now
     counts the server's rejected attempts (5).
  4. **Nit:** the record store only echoes on completion. Documented.
  5. **Nit:** `check-bubble-lab.mjs` had an unguarded popup lookup. Guarded.

  The reviewer confirmed that removing the listener fails only L10, that
  L12 matches the WTF-260 contract, and that the real-Bubble logs match.
  The drummer review of `6b68f1e` had no important or blocker findings.
- Also corrected while fixing: Bubble Buttons render as real `<button>`s
  (tabIndex 0), not `<div>`s. The docs now describe the lab's `<div>` button
  as a clickable group or icon.

## Round 3 (maintainer decisions, 2026-09-25)

The maintainer answered the round-2 questions:

1. Demo link → a `nocode-to-knowcode` page.
2. Delete `test`.
3. Merge the lab branch.
4. Rebuild `code_highlight` in `nocode-to-knowcode`.
5. Real-database autobinding: do it.
6. Liveblocks: no key.
7. Tiptap Cloud: use the 1Password item `tiptap-cloud`.

- **Demo link:** `src/plugin.json` `demo_page`, the description's Demo line,
  and the README now point to
  https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap. It loads
  anonymously (200), with 10 editors and no page errors.
- **Real-database autobinding:** the WTF-260 fixture page was recreated on
  `wtf-256-lab` from `docs/wtf-260/fixture`.
  - The saved source lacked the element's autobinding setting
    (`autoBinding: true, bindField: "html_text"`). It is fixed both in the
    repo and in Bubble.
  - The Python probes now take `WTF260_VERSION` and `WTF260_WORKSPACE`, since
    the current Buildprint CLI reads data inside a workspace.
  - `open-autobinding-fixture.py` opens the session and resets the two
    disposable records to canonical HTML. Record B had non-canonical stored
    HTML with a leading space, which an editor never reproduces.
  - The navigation probe now waits for the record switch (about 0.4 s)
    instead of sleeping for 0.5 s.
  - All eight probes pass against the real database on the deployed plugin:
    - convergence at 0, 300 and 2200 ms (5 trials each, plus a reload);
    - a held older write, with a corrective write;
    - a save in flight across navigation;
    - a pending edit across a record switch;
    - stale-echo replay at 0 and 300 ms.

    Log: [autobinding-real-bubble.txt](autobinding-real-bubble.txt). After
    the merge, convergence at 300 ms also passed on `version-test`.
- **Real Tiptap Cloud:** `lib/tests/browser/tiptap-cloud.spec.mjs` (opt-in).
  - It passed 6/6 across Chromium, Firefox and WebKit.
  - Without credentials all 6 are skipped, which is what happens in CI.
- **`test` page deleted and branch merged:** see
  [page-inventory.md](page-inventory.md), "Applied changes".
  - Savepoint on `test`: `1790370879548`.
  - Clean merge.
  - `/test` returns 404, and the lab pages and `tiptap-demo` return 200.
  - All 5 Buildprint tests are active on `test`.
- **`code_highlight`:** source recovered from the 2026-08-21 snapshot. The
  rebuild waits on Buildprint access to `nocode-to-knowcode`.
- **Review of `6af5cfd`: approve with findings, none blocking.** All four are
  fixed in the next commit:
  1. **Low:** `open-autobinding-fixture.py` now refuses to write without
     `WTF260_WORKSPACE`.
  2. **Low:** tracing is off in the Tiptap Cloud spec, because signed tokens
     reached local failure traces.
  3. **Nit:** the spec now needs all three credentials, so documents are
     always deleted.
  4. **Nit:** sessions open inside `try`, so cleanup always runs.

  After the fixes, real Tiptap Cloud passed 6/6 again, with every document
  deleted.

## Deployment — development version (2026-09-26)

- PR #52 was squash-merged as `2d3292e`. `main`'s tree is identical to the
  reviewed head `ea5a7a4` (base `a132fdb`).
- Before the push, `pled status` showed only local changes, and
  `git diff a132fdb HEAD -- src/` held only this PR's `initialize.js` and
  `plugin.json` changes. `pled push` completed, and `pled status` then
  reported **In sync**. This commit records the resulting `.src.json`
  baseline, including the new `demo_page` and description.
- Real run mode (`tiptap-plugin`, development version):
  - The served test-version element code for `tiptap-demo` contains the
    menu portal (`data-tiptap-menu-portal`, `appendTo`) and the `focusout`
    hide (`setMeta(pluginKey, "hide")`).
  - All 10 demo editors mounted, with no page errors. Real clicking and
    typing in the first demo editor inserted the typed text.
  - `node tests/browser/check-demo-menu-lifecycle.mjs`: all 3 checks pass on
    `version-test/tiptap-demo` (2 of 3 failed before the push).
  - `node tests/browser/check-bubble-lab.mjs`: all 20 checks pass on
    `version-test/lifecycle-lab` (7 of 20 failed before the push).
- Not run by the ship session: `buildprint test run lifecycle_lab` from a
  clone of `test`.
- No Bubble `test`/`live` change and no Marketplace release. The new demo
  link and description reach the Marketplace listing with the next release.

## Not covered (follow-ups)

- Real Liveblocks (no key).
- The `code_highlight` rebuild, until Buildprint can access
  `nocode-to-knowcode`.
- After `pled push`:
  - from `lib/`, run `node tests/browser/check-bubble-lab.mjs` and
    `node tests/browser/check-demo-menu-lifecycle.mjs`;
  - from a clone of `test`, run `buildprint test run lifecycle_lab`.

  All should pass.
