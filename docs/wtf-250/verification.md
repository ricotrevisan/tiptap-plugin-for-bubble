# WTF-250: local verification

## Scope and behavior

- Branch: `fix/wtf-250-setup-atomicity`; base: `f3ae0f3` (main after PR #42).
- `setupEditor` checks settings before creating anything. Two cases fail early:
  UniqueID turned on with no usable types (blank, or only commas and spaces),
  and **Content is JSON?** set to yes with content that isn't valid JSON. Blank
  JSON content starts an empty editor instead of throwing out of `update()`.
- Everything created after that check shares one failure boundary: the editor
  wrapper, extension build, menu acquisition and configuration, the
  collaboration Y.Doc and provider, the Liveblocks room, and `new Editor`.
  `buildEditor` holds the existing construction body. Any throw goes through
  `teardownEditor`, which removes the wrapper by reference (so detached
  canvases are covered too), restores menu groups, destroys the provider and
  Y.Doc, and leaves the Liveblocks room.
- A failed rebuild gives the next attempt the unsaved local snapshot and a copy
  of the shared document's CRDT state, including unsent operations.
- Failure publishes a stable **Setup error** (`setup_error`, text) and reports
  it to the debugger once. `is_ready` stays false. A successful setup clears it.
- Retries are keyed by a fingerprint of the scalar properties, Bubble's
  auto-binding and fit-height flags, and the Bubble data that construction reads
  (currently **Allowed MIME types**). Unchanged updates don't retry a failed
  configuration. Changing any of these, or an element reset, retries it.
- Bubble signals data that is still loading by throwing from a list read and
  re-running `update()` once it arrives. That list is read before the
  fingerprint and before any side effect, so the signal escapes `update()`
  exactly as before, without staging resources or latching a failure. (Caught
  by independent review of the first revision.)
- A stale **Setup error** is cleared while setup is skipped because
  collaboration settings are incomplete or authentication is exhausted.
- WTF-246 is unchanged: authentication exhaustion is still checked before the
  setup-failure latch.

## Red → green evidence

Using Node **24.19.0**, from `lib/`:

```sh
node tests/setup-failure-atomicity.mjs
```

With only the new state declared, the original source fails at
`UniqueID types "": no orphan editor wrapper` (actual `1`, expected `0`).
Removing the CRDT copy from the new rollback fails at
`CRDT state kept for the next attempt`. The test runs the real decoded
initialize/update/reset source and bundle, and covers:

- both UniqueID early returns;
- invalid JSON;
- editor construction failure with both menus and a Hocuspocus provider, in
  attached and detached canvases;
- menu configuration failure after another menu was acquired;
- Hocuspocus provider construction failure;
- Liveblocks provider failure after entering a room;
- failed local and collaborative rebuilds;
- a Bubble list that is still loading;
- clearing a stale error;
- unchanged-update suppression, changed-configuration retry, and reset retry.

## Final checks

From `lib/` with the pinned Node binary on `PATH`: `npm ci`, `npm test`,
`npm run validate:plugin`, `npm run test:validator`, `npm run test:browser`.

- Build and all **17 regression scripts** passed.
- Plugin validation passed: **5 metadata files, 73 function bodies**.
- Validator tests: **11 passed**.
- Browser tests: **24 passed** across Chromium, Firefox and WebKit.

## Deployment — development version (2026-09-24)

- PR #45 was squash-merged as `6117c29`; `main`'s tree is identical to the reviewed head `ac715b5`.
- Before pushing, `pled check-remote` reported divergence. The remote was pulled into a throwaway worktree and compared. Its Tiptap element code and `AAC.json` were identical to `f3ae0f3` (PR #42 with WTF-246). The only other remote difference was serialization in `toc_element`: a trailing newline and an empty `actions` object. So the remote held nothing that `main` lacked. `pled push --force` from `6117c29` completed, and `pled status` reports **In sync**. This commit records the resulting `.src.json` baseline.
- Real run mode (`tiptap-plugin`, `version-test/tiptap-demo`):
  - The served plugin bundle contains `setupFingerprint`, `clearSetupFailure` and `setup_error`, and not the old construction catch.
  - All 10 demo editors mounted.
  - Real keyboard typing in the HTML/JSON/text demo updated **Content (HTML)**.
- **Not yet verified in Bubble: the failure case** (a misconfigured editor showing **Setup error** and recovering once fixed). `test` already has nine branches, Bubble's limit, so no verification branch could be created. No Bubble branch was created, edited or deleted, and nothing was released to the Marketplace.
