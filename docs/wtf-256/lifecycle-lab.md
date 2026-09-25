# WTF-256: lifecycle lab contract

The lifecycle lab is the standard pre-release test for how editors and their
Bubble Menu / Floating Menu groups behave on a Bubble-shaped page. It has two layers:

1. **Automated lab** (every PR, in CI):
   `lib/tests/browser/lab.html` + `lib/tests/browser/lifecycle-lab.spec.mjs`.
   It runs in Chromium, Firefox and WebKit, with real layout, real pointer
   and keyboard input, and the real decoded `initialize.js`/`update.js`/actions
   running on the built `dist.js`.
2. **Real-Bubble check** (before and after a `pled push`):
   `lib/tests/browser/check-demo-menu-lifecycle.mjs` runs on `tiptap-demo`.
   It covers the cases that depend on Bubble's own DOM. With
   `--local-initialize=<ref>` it previews an unpushed `initialize.js` in the
   real page without changing Bubble.

The fast Node tests (`menu-ownership-lifecycle.mjs`,
`floating-menu-hidden-guard.mjs`, …) remain the first layer.

## The lab page

`lab.html` mirrors how Bubble lays out a page. Measured on `tiptap-demo`
(2026-09-25):

- The page root is a body child with `position: relative; z-index: 2`.
- A **floating group** is a fixed body child (`z-index: 5`).
- A **popup** is a fixed body child (`z-index: 1000`). Bubble keeps a popup
  in `<body>` after it closes, as `display: none` with its z-index (2002 on
  `tiptap-demo`), and uses the same z-index when it reopens.
- A full-screen **modal** layer opens above everything.
- Editors A and B have their own Bubble Menu groups. Editor A also has a
  Floating Menu.
- Two copies of one **reusable** each contain a menu group with the same ID
  (`dup-menu`).
- An editor with a Floating Menu sits inside a **nested scroll area**.
- There is a text input.

Each menu button runs one element action (H1, H2, Bold) through a click
listener, the way a Bubble "When button is clicked" workflow does. The lab
counts every run per editor (`actionCounts`).

**Resource counters** (`labResources()`) are installed before the runtime
loads:

- editor DOM nodes (`.tiptap`);
- menu position placeholders (one per active menu lease);
- `<body>` children;
- event listeners on long-lived targets (window, document, and connected
  nodes outside an editor); `labListeners()` breaks these down by target and
  event type;
- Resize/IntersectionObserver instances that still observe a connected node;
- open WebSockets.

## Cases

"Hidden" means `visibility` isn't `visible` **and**
`document.elementFromPoint()` at the centre of the menu's button doesn't land
in the menu. "Shown" means visible **and** `elementFromPoint()` reaches the
button, so the menu paints above everything around it. Every action click is a
real mouse click at those coordinates.

| Case | Contract | Ticket matrix / assertion |
| --- | --- | --- |
| L1 | Hidden menus never intercept the pointer: before first show, after hide, after two viewport resizes, and after scrolling the nested area and the window. No action runs. | 1, 5; hidden menus not hit-testable (#20) |
| L2 | A shown menu paints above its editor. One click runs one action, on that editor only. Selecting in B shows B's menu and hides A's. | 1, 2; exact-once, correct editor |
| L3 | Menus of editors inside a floating group and inside a popup paint above that container and work. After the popup closes, its menu is hidden. | 4 |
| L4 | A modal opened after a menu is shown covers the menu, even after a popup at the same z-index has opened and closed first. Clicking where the menu was runs nothing. After the modal closes, the menu works again. | 7; later modals above menus |
| L5 | Two copies of a reusable with the same menu ID each lease their own copy. Only the focused copy's menu shows, and its action goes to its own editor. | 2, 3, 8; menus never claimed across editors |
| L6 | A menu ID already owned by another editor is reported once in the debugger. The second editor holds no menu lease, and selecting text in it shows nothing, even after Tiptap's 250 ms show delay. The owner's menu still works. | 8 |
| L7 | Over three cycles, the lab destroys and recreates editor A, switches a construction-time extension on and off, and turns the Floating Menu off and on. After each step the menu works with exactly one action per click. After destroy, the Bubble-owned groups are back in place with their original style/tabindex. At the end of each cycle every resource counter equals the baseline. Final teardown leaves no editors, placeholders or extra body children. | 6; restores Bubble styles, no leaked DOM/listeners |
| L8 | When focus moves from editor A to editor B, or to an input, A's Bubble Menu and Floating Menu hide. Inside the menu, clicking a `<button>`, clicking a non-focusable `<div>` button (as Bubble renders them), and typing in an input all keep the menu usable. | 2; menus never claimed across editors |
| L9 | Collaboration (a local Hocuspocus server): three document switches, collaboration off, then on. Exactly one open connection while collaboration is on, and none while it's off or after teardown. Menus keep working. Resources return to the baseline. | 9; providers not leaked |

The real-Bubble check covers the same contract on `tiptap-demo`:

- selecting text shows the Notion demo's menu above its editor (L2);
- moving to another editor hides it (L8);
- after the demo popup opens and closes, the menu stays below that popup's
  z-index (L4).

## Defects the lab found (fixed in this PR)

1. **Closed popups lifted menus above themselves (L4).** A shown menu took a
   z-index one above the highest z-index among body children, and hidden ones
   counted too. After a Bubble popup (z-index 2002) opened and closed once,
   every menu shown later got 2003. The popup then opened *under* the menu,
   for example a link popup opened from a menu button. Now only visible body
   layers count.
2. **Menus stayed visible after focus moved to another editor or input (L8).**
   Tiptap doesn't hide a menu on blur when "the menu's parent contains the
   newly focused element". The plugin appended menus directly to `<body>`, and
   `<body>` contains every element, so the menu stayed visible and clickable
   until the user clicked empty space. Each shown menu now sits in its own
   `display: contents` box in `<body>`. That box has no layout, only holds
   the menu, and is removed on hide and on release.

Both reproduce in real Bubble on the current development version. With the
local `initialize.js` served in the real page, both checks pass (see
`verification.md`).

## Not covered yet

- **Saved Buildprint project tests** and a dedicated Bubble lab page. The
  earlier lab branch (`plugin-lifecycle-lab`, `83ie9`) no longer exists. The
  real-Bubble layer is the `tiptap-demo` check above.
- **Autobinding scenarios from WTF-260**, database convergence after reload,
  and **Liveblocks/auth** scenarios. Those have their own Node suites
  (`autobinding-record-lifecycle.mjs`, `liveblocks-lifecycle.mjs`,
  `collaboration-auth-lifecycle.mjs`) and Python real-Bubble probes. They
  aren't part of this lab yet.
- **Page inventory and cleanup** (Phase 1) needs separate approval. It wasn't
  started. The August inventory is out of date: the `test` branch now has 44
  pages, and many pages it classified (`floating`, `popup`, `rebuild`,
  `doc-nobind`, `zzz_collab`, `collab_*`, …) are no longer on `test`. Redo the
  inventory before any cleanup decision.
- A menu that is shown *while* a modal is already open still goes above that
  modal. This is by design: it takes the highest visible layer + 1.
- If focus is already inside the menu (for example its link input) and the
  user then clicks another editor, the menu stays visible. The editor was
  already blurred, so Tiptap gets no blur event to hide on. This was already
  the case before this PR.
