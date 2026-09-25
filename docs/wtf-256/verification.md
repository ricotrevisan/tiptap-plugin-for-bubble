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
  `lifecycle-lab.spec.mjs`, in CI): 14 cases (L1–L14) in Chromium, Firefox and
  WebKit. The contract, and how it maps to the ticket's matrix, is in
  [lifecycle-lab.md](lifecycle-lab.md).
- **Real-Bubble lab:**
  - the `lifecycle-lab` page on the Bubble branch `wtf-256-lab` (`73kof`),
    with its source copied to [bubble-lab/](bubble-lab/);
  - four saved Buildprint tests;
  - `check-bubble-lab.mjs` (19 checks) and `check-demo-menu-lifecycle.mjs`
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

## Red → green

Full record: [red-before-fix.txt](red-before-fix.txt).

| Surface | `origin/main` / deployed dev version | This branch |
| --- | --- | --- |
| Automated lab, 3 engines | L4, L8, L10 fail (9 failed, 33 passed) | 42/42 |
| `check-bubble-lab.mjs` on `lifecycle-lab` | 6 of 19 checks fail. Menu A lingers after a focus move and after leaving its input, and then intercepts the pointer after resize and scroll. The scroll-group Floating Menu gets z-index 2004 over the closed popup at 2002. | 19/19 with `--local-initialize=origin/main` |
| `check-demo-menu-lifecycle.mjs` on `tiptap-demo` | 2 of 3 fail (menu lingers; z-index 2003 over a popup at 2002) | 3/3 with `--local-initialize=origin/main` |
| Saved Buildprint tests on `wtf-256-lab` | `menu_hides_on_focus_move` and `menu_below_closed_popup` fail at their bug checks; the other two pass | green expected after `pled push` (they run the deployed plugin) |

## Bubble changes (all on my branch `wtf-256-lab`, `73kof`)

- **Branch:** created from `test` with Buildprint. There were six other
  branches under `test`, so this is the seventh of nine.
- **Savepoint:** `1790354571044`, taken before the first apply.
- **Page `lifecycle-lab`:**
  - editors A and B with Bubble Menus;
  - a Floating Menu on A, and an input inside menu A;
  - a page input;
  - an editor with a Floating Menu in a scrolling group;
  - an editor in a popup, with open and close buttons;
  - an editor in a floating group;
  - two copies of the new reusable `lab-editor-copy`, which share the menu
    ID `labDupMenu`;
  - one page counter per menu workflow.

  Every editor sets **File uploads enabled** to `no` and **Type of content**
  to User; mentions are off.
- **Saved Buildprint tests** (`tests/components/lab_open`, `lab_select`,
  `lab_click_menu`; `tests/lifecycle_lab/`):
  - `menu_click_runs_once`
  - `menu_hides_on_focus_move`
  - `menu_below_closed_popup`
  - `reusable_copies_isolated`

  One recorded batch: `ac19f939-0325-4430-8f7c-f9af20ed9a8f`.
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

## Gates (Node 24, from `lib/`, merged with `origin/main` `9d46395`)

All passed on 2026-09-25, round 2:

- `npm ci`
- `npm test`: 19 scripts
- `npm run validate:plugin`: 5 metadata files, 73 function bodies
- `npm run test:validator`: 11 passed
- `CI=1 npm run test:browser`: 69 passed. That is 42 lab tests plus the
  existing 27, across Chromium, Firefox and WebKit.

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

## Not covered (follow-ups)

- Real-Bubble autobinding with the database, real Liveblocks, and real Tiptap
  Cloud authentication. L11–L14 run the plugin against local stand-ins.
- Deciding the `test` page (legacy Rich Text Editor coexistence) and the
  Marketplace `demo_page` link, which is dead. See
  [page-inventory.md](page-inventory.md).
- Merging `wtf-256-lab` into `test` is up to the maintainer. The lab page and
  its tests should live on `test` if they are to be the standard pre-release
  surface.
- After `pled push`:
  - from `lib/`, run `node tests/browser/check-bubble-lab.mjs` and
    `node tests/browser/check-demo-menu-lifecycle.mjs`;
  - from a clone of `wtf-256-lab`, run `buildprint test run lifecycle_lab`.

  All should pass.
