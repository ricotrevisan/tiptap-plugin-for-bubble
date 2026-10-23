# Set content: empty list items — verification

Found in Defacto (mm-137): Set content with the default preserveWhitespace
`'full'` threw `Invalid content for node listItem: <>` for HTML with an empty
`<li>`. PR #73 falls back to a document parse for HTML only.

## Review and merge

- Two independent read-only review rounds. Round 1 blocked on JSON content
  (a document parse loads schema-invalid JSON unchecked); fixed in `8421526`.
  Round 2 (head `8421526`, base `5915c99`): no blocking findings.
- CI passed on `8421526`. Squash-merged as `7ed575a`.

## Deployment — development version (2026-10-23)

- Before the push, `git diff --stat e184e8f 7ed575a -- src/` showed only
  `set-content-ACW.js`, and `pled status` showed only local changes (one
  element field). `pled push` completed; `pled status` then reported
  **In sync**. This commit records the resulting `.src.json` baseline.
- The served test-version element code on `tiptap-plugin` contains the new
  fallback ("JSON is not repaired") and no longer the
  `setContent preserveWhitespace` log.
- Lifecycle lab, before → after the push:
  - `check-bubble-lab.mjs`: 20/20 → 20/20.
  - `check-demo-menu-lifecycle.mjs`: 3/3 → 3/3.
  - `buildprint test run lifecycle_lab`: 5/5 → 4/5. `menu_click_runs_once`
    failed at step 4 ("Menu A is visible and reachable by the pointer"); it
    passed 7/7 on one rerun. The lab page never calls Set content, and the
    same menu-visibility condition passed in `check-bubble-lab.mjs` after the
    push, so this is recorded as a flaky step, not a regression.
