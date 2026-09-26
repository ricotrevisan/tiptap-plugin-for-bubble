# WTF-256: `tiptap-plugin` page inventory (2026-09-25)

A fresh inventory of the Bubble app's pages. The August inventory in the ticket
(52 pages) is out of date. Most pages it asked about are gone:

- the Tiptap test pages (`doc-nobind`, `floating`, `popup`, `rebuild`,
  `zzz_collab`, `collab_*`, `minimal-*`, `multi-*`, …);
- `code_highlight`, `html_styler*` and `react`.

Maintainer decisions on 2026-09-25, all applied:
- delete `test`;
- merge the lab branch into `test`;
- point the Marketplace demo link at the `nocode-to-knowcode` demo;
- rebuild `code_highlight` in `nocode-to-knowcode`.

See "Applied changes" at the end.

## Method

Read-only Buildprint clones of `test` and `live`. For each page the script
counted:

- the plugins used, including those inside reusable elements, resolved
  recursively;
- the Tiptap editors;
- the workflows;
- the reusables used;
- incoming `goToPage`/`pageRef` references from other pages and reusables.

The script also searched every repository under `~/bubble-plugins` for
`tiptap-plugin.bubbleapps.io` URLs, and requested each linked page with and
without the run-mode login.

- `test` has 35 pages. `live` has the same 35. The Bubble branch `wtf-256-lab`
  adds `lifecycle-lab`.
- The whole app is behind the run-mode login (tippy / tappy). Every URL on
  `tiptap-plugin.bubbleapps.io` returns **401** to anonymous visitors, so none
  of its pages can serve as a public demo.

## Decisions

| Page | Project / purpose | Tiptap editors | Workflows | Decision |
| --- | --- | --- | --- | --- |
| `index` | App shell; two buttons go to `tiptap-demo`. Its text is an old plugin description. | 0 | 2 | Keep |
| `404`, `reset_pw` | Bubble system pages | 0 | 0 | Keep |
| `tiptap-demo` | Canonical user demo (AGENTS.md); 9 demo reusables | 11 | 0 | Keep |
| `lifecycle-lab` | WTF-256 lifecycle lab: real-Bubble test surface plus 5 saved Buildprint tests | 7 | 9 | Keep (merged into `test`) |
| `wtf-260-autobinding` | WTF-260 autobinding fixture, used by the real-database probes | 1 | 8 | Keep (recreated and merged into `test`) |
| `test` | One legacy Bubble **Rich Text Editor** (built-in plugin) input, no Tiptap | 0 | 0 | **Deleted** (maintainer) |
| `1t-modern-rows`, `1t-modern-test`, `1t-slimselect-check` | 1T Dropdown plugin fixtures | 0 | 1 / 3 / 0 | Protect (other project) |
| `bubbleex-*` (22 pages) | BubbleEx controlled fixtures. `bubbleex-i36-target` is the link target of `bubbleex-i36-text-only-link`. | 0 | 0 | Protect (other project) |
| `modern-dropdown-demo`, `modern-popover`, `modern-popover-reuse-check` | Modern Dropdown demos and fixtures | 0 | 3 / 0 / 0 | Protect (other project) |
| `native-binding-57`, `tanstack-chart-demo`, `tanstack-chart-dev` | TanStack Charts demos and fixtures; referenced from that plugin's repo | 0 | 3 / 14 / 15 | Protect (other project) |

Tiptap-owned pages: `index`, `tiptap-demo`, `test`, and `lifecycle-lab` on the
branch. The other 31 belong to other plugin projects and shouldn't be cleaned
up as part of Tiptap work.

The August "merge then delete" pages were already gone. Their scenarios are
now in the automated lab (see `lifecycle-lab.md`).

## Broken external references (found by the scan)

| Where | Link | Status |
| --- | --- | --- |
| This plugin, `src/plugin.json` → `demo_page` (the Marketplace "Demo" link) | `https://tiptap-plugin.bubbleapps.io/version-test/doc-nobind/demo` | 401 anonymous, **404** logged in (page deleted) |
| Code syntax highlighter plugin metadata (`🤌 Code syntax highlighter/plugin.json`, seen in an app snapshot under the WTF-246 worktree) | `https://tiptap-plugin.bubbleapps.io/version-test/code_highlight` | 401 anonymous, **404** logged in |
| This repo's `README.md` and the plugin description | `https://tiptap-demo.bubbleapps.io/version-test/doc/demo` (a different app) | 200, public |

The public demo that works is `tiptap-demo.bubbleapps.io/version-test/doc/demo`,
in a different app. Changing the Marketplace `demo_page` is a public-listing
decision, so it's left for the maintainer.

Old branch links found in other repos' notes (`version-83ie9`,
`version-33jpy`, …) point to branches that no longer exist. They are
historical records and were not changed.

## Applied changes (2026-09-25)

- **`test` page deleted and lab pages added.** Both were done on the Bubble
  branch `wtf-256-lab`, which was then merged into `test` with Buildprint:
  - savepoint on `test`: `1790370879548`;
  - clean merge, no conflicts.

  After the merge, on `version-test`:
  - `/test` returns 404;
  - `lifecycle-lab`, `wtf-260-autobinding` and `tiptap-demo` return 200;
  - the 5 Buildprint tests are active on `test`.

  The deleted page's source is kept in `docs/wtf-256/deleted-test-page/`,
  and in the savepoint.
- **Marketplace demo link.** `src/plugin.json` `demo_page`, the Demo line in
  the plugin description, and the README all point to
  https://nocode-to-knowcode.bubbleapps.io/version-test/tiptap. That page is
  public: 200 anonymously, 10 editors, no page errors. The change reaches the
  Marketplace with the next `pled push`.
- **`code_highlight`: rebuilt** in `nocode-to-knowcode` on 2026-09-26. It is
  public at https://nocode-to-knowcode.bubbleapps.io/version-test/code_highlight
  and uses the published Code Syntax Highlighter plugin. See
  [code-highlight-rebuild.md](code-highlight-rebuild.md). The plugin's own
  Marketplace demo link still needs to point there.
- **Bubble branch `wtf-256-lab` deleted** on 2026-09-26, after the merge, at
  the maintainer's request.
