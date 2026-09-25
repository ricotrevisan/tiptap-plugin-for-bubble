# WTF-256: lifecycle lab contract

The lifecycle lab is the standard pre-release test for how editors and their
Bubble Menu / Floating Menu groups behave on a Bubble-shaped page. It has two layers:

1. **Automated lab** (every PR, in CI):
   `lib/tests/browser/lab.html` + `lib/tests/browser/lifecycle-lab.spec.mjs`.
   It runs in Chromium, Firefox and WebKit, with real layout, real pointer
   and keyboard input, and the real decoded `initialize.js`/`update.js`/actions
   running on the built `dist.js`.
2. **Real Bubble** (before and after a `pled push`):
   - The `lifecycle-lab` page on the Bubble branch `wtf-256-lab` (`73kof`)
     has:
     - editors with Bubble and Floating Menus;
     - an input inside a menu;
     - a scroll group, a popup and a floating group;
     - two copies of a reusable that share a menu ID;
     - a counter per menu workflow.

     Source: `docs/wtf-256/bubble-lab/`.
   - Four **saved Buildprint tests** (`tests/lifecycle_lab/` in the Bubble
     workspace) drive it with real mouse and keyboard input. Run them with
     `buildprint test run lifecycle_lab` from a clone of the branch.
   - `lib/tests/browser/check-bubble-lab.mjs` runs 19 checks on that page.
     `check-demo-menu-lifecycle.mjs` runs 3 on `tiptap-demo`.
   - With `--local-initialize=<ref>`, both scripts preview an unpushed
     `initialize.js` in the real page without changing Bubble.

The fast Node tests (`menu-ownership-lifecycle.mjs`,
`floating-menu-hidden-guard.mjs`, …) remain the first layer.

## The lab page

`lab.html` mirrors how Bubble lays out a page. Measured in run mode on
`tiptap-demo` and `lifecycle-lab` (2026-09-25):

- The page root is a body child with `position: relative; z-index: 2`.
- A **floating group** is a fixed body child (`z-index: 1501`).
- A **popup** is a fixed body child (`z-index: 2002`). Bubble keeps a popup in
  `<body>` after it closes, as `display: none` with its z-index, and uses the
  same z-index when it reopens.
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
| L10 | While focus is in the menu's own input, clicking another editor or empty space hides the menu. Going back from the input to its own editor keeps it. | 2; menus never claimed across editors |
| L11 | Autobinding against a Bubble-like record store whose writes finish out of order (900/100/500 ms). After typing stops, the stored record equals the editor, and the other record is untouched. A Bubble Menu action on the bound editor is saved once. A fresh editor loading the record (a reload) shows the same content and doesn't save it. | WTF-260 convergence and reload |
| L12 | Autobinding: a record switch before the save delay cancels the unsent edit, and neither record changes. A dirty blur saves once to the bound record; a clean blur writes nothing. Content saved by someone else shows up without being saved back, and it cancels a pending local edit. | WTF-260 record isolation, blur, external content |
| L13 | Liveblocks (the installed provider, backed by the in-memory service in `lib/tests/support/fake-liveblocks.mjs`): two editors share a room, both report 2 users, and edits and a menu action in A reach B. Switching A through two rooms and back keeps exactly one live session per editor. Teardown leaves no session, no editor and no menu lease. | 9; Liveblocks setup and teardown |
| L14 | A token rejected by a real Hocuspocus server leads to exactly five attempts (1, 2, 4 and 8 s apart), then a `failed` state. The editor, menu leases and connection are released, and there is one debugger message. An unchanged Bubble update doesn't retry. A corrected token recovers, and the menu works. | Bounded authentication retry |

The real-Bubble layer covers the parts that depend on Bubble's own DOM:

| Check | `check-bubble-lab.mjs` | Buildprint test | Lab case |
| --- | --- | --- | --- |
| Hidden menus don't intercept the pointer on load, after resize, after page scroll, and after scrolling the scroll group | ✓ | | L1 |
| One menu click runs one workflow on its own editor (counters) | ✓ | `menu_click_runs_once` | L2 |
| Moving to editor B hides menu A | ✓ | `menu_hides_on_focus_move` | L8 |
| Leaving menu A's own input for editor B hides menu A | ✓ | `menu_hides_on_focus_move` | L10 |
| Menus of editors in a floating group and in a popup paint above that layer | ✓ | | L3 |
| After the popup closes, later menus stay below its z-index | ✓ | `menu_below_closed_popup` | L4 |
| Reusable copies with the same menu ID stay isolated | ✓ | `reusable_copies_isolated` | L5 |
| Floating Menu inside a scroll group | ✓ | | L1, L2 |

`check-demo-menu-lifecycle.mjs` checks L2, L8 and L4 on the Notion and popup
demos of `tiptap-demo`.

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
3. **A menu stayed open after focus left its own input (L10).** Once focus is
   inside the menu, for example in a link input, the editor is already blurred.
   Tiptap then gets no blur event when the user moves on, so the menu stayed
   until the editor was used again. When focus leaves the menu for anything
   other than the menu itself or its own editor, the plugin now hides it the
   way Tiptap does, with the menu's `hide` transaction.

All three reproduce in real Bubble on the current development version. With
the local `initialize.js` served in the real page, every check passes (see
`verification.md`).

## Not covered

- **Real-Bubble autobinding with the database.** L11/L12 use a record store in
  the page; the Python probes from WTF-260 cover Bubble's database, and they
  need their own fixture branch.
- **Real Liveblocks, and real Tiptap Cloud authentication.** L13/L14 use the
  installed providers against local stand-ins.
- A menu that is shown *while* a modal is already open still goes above that
  modal. This is by design: it takes the highest visible layer + 1.
- Page inventory: see [page-inventory.md](page-inventory.md). No page was
  deleted.
