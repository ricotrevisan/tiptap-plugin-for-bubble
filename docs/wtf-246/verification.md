# WTF-246: local verification

## Scope and behavior

- Worktree: `/home/rico/bubble-plugins/tiptap-plugin-for-bubble-wtf-246`
- Branch: `fix/wtf-246-terminal-auth`; base: `103b06e`.
- Custom Hocuspocus and Tiptap Cloud retain **five total attempts**: initial
  connection plus four retries after **1, 2, 4, 8 seconds**. No 16-second retry.
- Retry teardown preserves progress before emitting Bubble events. Successful
  authentication and explicit construction-configuration changes reset the budget.
- The fifth failure disposes the provider, owned websocket/awareness, editor,
  active Y.Doc, polling/retry timers, and menu leases. It reports `failed` and
  `is_ready = false`. Unchanged updates cannot revive it.
- Existing generation guards reject obsolete provider callbacks; handlers and
  timers also stop if a synchronous Bubble workflow creates a newer generation.
- Changed credentials/provider/document/endpoint or construction-time
  extension/menu configuration can recover. Disabling collaboration still works.
- Raw authentication reasons and provider URL/document debug lines are omitted
  to avoid exposing credentials or document identifiers.

## Red → green evidence

Using Node **24.19.0**, from `lib/`:

```sh
node tests/collaboration-auth-lifecycle.mjs
```

Before the fix, this failed at `terminal failure must destroy the fifth provider`
(actual `0`, expected `1`). Attempts 1–5 and exact backoff timing already passed.
Subsequent failing regressions covered credential recovery, unsafe authentication
diagnostics (synthetic sentinel values only), and synchronous Bubble updates
resetting attempt progress. All now pass.

The new test runs real decoded initialize/update source and the bundled editor
and Hocuspocus SDK, with network connections disabled and deterministic plugin
clocks. It covers both providers, exact disposal counts, stale callbacks and a
queued canceled timer, unchanged updates, multiple instances, configuration
recovery, success resetting the budget, menus, local mode, and reentrant status
workflows. It does not substitute for a deployed Bubble authentication test.

## Final checks

Commands run with the pinned Node binary on `PATH`, from `lib/`:

```sh
npm ci
npm test
npm run validate:plugin
npm run test:validator
npm run test:browser
```

Results:

- Build and all **13 regression scripts passed**, including collaboration
  configuration, menu ownership, and **27 autobinding scenarios**.
- Plugin validation passed: **5 metadata files, 73 function bodies**. Existing
  computed-state-name static-validation note remains.
- Validator tests: **11 passed**.
- Browser tests: **15 passed** across Chromium, Firefox, and WebKit, including
  local Hocuspocus two-session collaboration.
- Independent final read-only review: approved; no remaining actionable findings
  within this issue's scope.
- `npm ci` reports **54 existing dependency audit findings** (53 moderate,
  1 high). Dependencies/lockfile were not changed or automatically upgraded.

## Release gate — not deployed

Local skill preflight passed. Read-only `pled status` / `pled check-remote -v`
reported remote-ahead image-lifecycle changes in eight fields, including
initialize/update, an image action, states/events, and the CDN header. Those
changes were not pulled, overwritten, or merged; they must be reconciled before
any authorized push.

No Pled push/upload, Bubble edit/reset/branch operation, Git push/merge/PR, or
Marketplace release was performed. No real Bubble preview authentication-failure
run was performed, and this issue is **not release-complete**. Next approval is
needed for external publication and a dedicated Bubble verification run after
remote reconciliation. The bundle source/dependencies and CDN header are
unchanged; this fix does not require a new runtime asset.
