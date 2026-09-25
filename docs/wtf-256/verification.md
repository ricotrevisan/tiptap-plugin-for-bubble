# WTF-256: lifecycle lab — local and real-Bubble verification

## Scope

The ticket's latest triage (2026-09-23) authorizes continuing the bounded lab:

- action, rebuild and resource counters;
- saved regressions;
- pointer hit-testing and modal stacking;
- multi-editor isolation.

Page inventory and deletion are a separate, approval-gated workstream.
Nothing in Bubble was created, changed or deleted.

This PR is the first slice:

- An automated lifecycle lab (`lib/tests/browser/lab.html`,
  `lifecycle-lab.spec.mjs`). It has nine cases (L1–L9) in Chromium, Firefox and
  WebKit and runs in CI with the other browser tests. The contract, and how it
  maps to the ticket's matrix, is in [lifecycle-lab.md](lifecycle-lab.md).
- A saved real-Bubble check for `tiptap-demo`
  (`lib/tests/browser/check-demo-menu-lifecycle.mjs`), with a mode that
  previews an unpushed `initialize.js` in the real page.
- Fixes for two menu defects the lab found. The change is in
  `src/elements/tiptap-AAC/initialize.js` only; `lib/index.js` and the runtime
  bundle are unchanged, so there's no new CDN asset or header change.

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

## Red → green

Full record: [red-before-fix.txt](red-before-fix.txt).

- **Automated lab, `origin/main` `initialize.js`:** L4 and L8 fail in all three
  engines. The other 21 pass. 6 failed, 21 passed.
- **Automated lab, this branch:** 27/27.
- **Real Bubble, deployed development version** (`version-test/tiptap-demo`,
  2026-09-25): **moving to another editor hides the menu** and **a closed popup
  does not lift the menu above that popup** fail. Measured: the Notion demo's
  menu stays `visible` with `pointer-events: auto`, and it gets z-index 2003
  over a closed popup at 2002.
- **Real Bubble, same page, this branch's `initialize.js`** swapped into the
  served app script with `--local-initialize=origin/main`: all three checks
  pass. The menu hides on focus move and stays at z-index 3.

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

## Gates (Node 24, from `lib/`, merged with `origin/main` `f2c4f9f`)

All passed on 2026-09-25:

- `npm ci`
- `npm test`: 19 scripts. `menu-ownership-lifecycle.mjs` now asserts that a
  shown menu sits in its portal, and that hide and teardown remove the portal.
- `npm run validate:plugin`: 5 metadata files, 73 function bodies
- `npm run test:validator`: 11 passed
- `CI=1 npm run test:browser`: 54 passed. That is 27 lab tests plus the
  existing 27, across Chromium, Firefox and WebKit.

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
- **Drummer (static, nonblocking) review of `bbf79fd`:** no important or
  blocker findings.

## Not covered (follow-ups)

- A dedicated Bubble lab page and saved Buildprint project tests. The old lab
  branch `83ie9` no longer exists. The real-Bubble layer is the `tiptap-demo`
  check.
- WTF-260 autobinding convergence/reload, Liveblocks and auth scenarios aren't
  in this lab. They keep their own Node suites and Python probes.
- Phase 1 page inventory and cleanup wasn't started. It needs separate
  approval. The August inventory is out of date: `test` has 44 pages, and many
  classified pages are no longer on it.
- After `pled push`, run
  `node tests/browser/check-demo-menu-lifecycle.mjs` without flags against
  `version-test/tiptap-demo`. It should report all checks passed.
