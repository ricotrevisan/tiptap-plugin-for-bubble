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
- Retries are keyed by a fingerprint of the scalar properties plus Bubble's
  auto-binding and fit-height flags. Unchanged updates don't retry a failed
  configuration. Changing any property, or an element reset, retries it.
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
- unchanged-update suppression, changed-configuration retry, and reset retry.

## Final checks

From `lib/` with the pinned Node binary on `PATH`: `npm ci`, `npm test`,
`npm run validate:plugin`, `npm run test:validator`, `npm run test:browser`.

- Build and all **17 regression scripts** passed.
- Plugin validation passed: **5 metadata files, 73 function bodies**.
- Validator tests: **11 passed**.
- Browser tests: **24 passed** across Chromium, Firefox and WebKit.

## Release gate — not deployed

`src/` changed: `initialize.js`, `reset.js`, and a new state in `AAC.json`. The
runtime bundle and CDN header did not change. Reaching the development version
needs an authorized `pled push`, then a real-preview check that a broken setting
shows **Setup error** and recovers once fixed. Neither has been done.
