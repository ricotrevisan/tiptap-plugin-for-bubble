# DEF-1927 — combined collaboration and autobinding verification

## Target and rollback

- App `tiptap-plugin`, profile `ricowtf`, existing approved branch `def-1927-doc-server-id` (`63l47`).
- Exact preview: https://tiptap-plugin.bubbleapps.io/version-63l47/tiptap-demo
- Savepoint `1790975499189`: “DEF-1927 before combined autobinding verification”.
- Workspace `/tmp/def1927-bubble/def-1927-doc-server-id`; original reusable source preserved at `/tmp/def1927-combined-original.ts`.
- Ran `bubble-graph impact "Doc.HTML"` before binding configuration changes. Buildprint check passed. Applied only six source lines in `reusable-elements/demo-collaboration/reusable.ts` (one replacement and five insertions).
- The existing static collaboration editor now has actual `autoBinding: true`, `bindField: "html_text"`, and `autobinding_record_id: parentThing().uniqueId()`. Its parent group resolves the existing `Doc` titled `Recipe: collaboration copy`. Collaboration remains enabled on the existing ticket-specific static document. File uploads remains explicitly false. The dynamic editor is unchanged.
- No mm-137, Test/Live configuration changes, Pled rollback, branch deletion, merge, or release.

## BEFORE — original code, client-only interception

Playwright intercepted only `**/package/static_js/**`. It replaced the exact escaped current `update.js` source with `git show origin/main:src/elements/tiptap-AAC/update.js`. The replacement count was **exactly one**. This is a real Bubble preview with original code served locally to the verification browser, not an original remote deployment. Shared Testing was never rolled back.

The console emitted the exact target error:

> Element Collaboration editor - Collaboration and auto-binding are both enabled. Auto-binding will be ignored while collaboration is active — the collaborative document is the source of truth.

Both static and dynamic editors ultimately showed `connected`, `Synced: yes`.

Evidence: `combined-before-console.txt`, `combined-before-state.json`, `combined-before.png`.

## AFTER — unmodified remote Testing

Used a separate fresh page with **no network route or source override**. The target error was absent. Both editors showed `connected`, `Synced: yes`.

Evidence: `combined-after-console.txt`, `combined-after-state.json`, `combined-after.png`.

Both BEFORE and AFTER also emitted transient “Collaboration is waiting for a supported provider, document name, credentials, and endpoint configuration” errors before the page-load token workflow completed. These are separate from the target error. This verification does not claim a completely error-free console.

## Shared-mode behavior

Two fresh browser pages used unmodified remote Testing. Real pointer and keyboard input inserted marker ` DEF1927-COMBINED-20261002` into the static cloud document. The second page received it and retained it after reload. The bound database copy’s read-only view stayed exactly unchanged after typing, a five-second debounce window, and peer reload. The Save a copy button was never clicked.

Evidence: `combined-after-typing.png` and `combined-shared-behavior.json`.

The first cleanup attempt using Control+End and Backspace did not restore the original cloud HTML. Follow-up inspection showed the marker in the heading and an empty paragraph. Cleanup was retried using direct real pointer/keyboard interactions on the heading and paragraph. Final outcome is recorded below.

## Collaboration off

The existing off-mode real autobinding fixture was already verified after the Testing push at https://tiptap-plugin.bubbleapps.io/version-63l47/wtf-260-autobinding. Typing saved to Bubble, persisted through reload, and was removed with exact original HTML restoration. See `autobinding-console-verification.md`, `autobinding-after-persisted.png`, and `autobinding-console-after.txt`. This was not repeated during the combined run.

## Final cleanup outcome

**Exact original cloud HTML restored.** The heading/paragraph keyboard repair’s `textContent` wait timed out, but subsequent read-only fresh-page reload inspection confirmed exact HTML equality:

```html
<h2>Shared notes</h2><p>Everyone on this page edits the same text.</p>
```

The database copy also remained exactly equal to its original HTML. No `setContent` API or direct CRDT mutation was used. The actual combined binding fixture is left on the approved feature branch; its original configuration remains available in the savepoint and preserved source file.

A final independent two-page load confirmed exact original HTML in both peers (`combined-cleanup-confirmation.json`).
