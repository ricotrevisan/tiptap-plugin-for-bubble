# WTF-248: Liveblocks sync/status lifecycle — local verification

## Scope and behavior

- Base: `main` at `d40313d` (after WTF-250). Provider-specific prerequisites
  (public key instead of JWT) and failure-atomic setup were already on `main`.
- `setupLiveblocks` now subscribes to the room and provider:
  - room `status` → **Collab status**: `connected` and `disconnected` pass
    through; `initial`, `connecting` and `reconnecting` publish `connecting`.
    Any non-connected status clears **Collab synced**.
  - provider `sync` → `collabHasSynced`, **Collab synced**, and the
    **collab synced** event on each transition to synced. It then seeds an empty
    room with the initial content. The 10-second polling fallback is no longer
    the only path.
  - room `others` / `my-presence` → **Collab connected users** (the provider's
    awareness state count, including this session; same as Hocuspocus).
  - room `error` → a fixed debugger message without the raw text, which can
    contain room names. Connection errors (`ROOM_CONNECTION_ERROR`) include
    only the error code and are reported once until the room connects again.
    Other room errors report only their type.
  All callbacks are guarded by the collaboration generation, so a replaced
  session can't publish into its successor.
- Ownership: the room's `leave` and every subscription go on
  `instance.data._collabDisposers`. `teardownEditor` releases them in reverse
  order, exactly once, however many times it runs. The installed
  `LiveblocksYjsProvider` destroys the Y.Doc it was given, so generic teardown
  now skips an already destroyed document. Before this change it destroyed the
  document a second time.
- The runtime bundle (`lib/index.js`, dependencies) is unchanged, so no new
  CDN asset or header update is needed.

## Tests

`lib/tests/support/fake-liveblocks.mjs` is an in-memory Liveblocks service. It
implements the room surface the **installed** `LiveblocksYjsProvider` uses:
status/others/ydoc events, presence, and Yjs fetch/update with a state-vector
handshake. Rooms are scoped per public key. Sync responses can be held back.
Sessions can drop and reconnect.

`lib/tests/liveblocks-lifecycle.mjs` runs the real decoded source and bundle
with two editor sessions:

1. Sync held past the polling window. After release: synced state and event,
   and the empty room is seeded once.
2. Second session: receives the seeded document without re-seeding. Both report
   2 users. Edits propagate.
3. Drop and reconnect: `connecting`, then not synced, then peer count 1. Edits
   made offline sync after reconnect. The event fires again.
4. Four room switches plus a return to the first room: one `leave` per switch,
   one live session per editor, no content crossing rooms, and the first room's
   shared state reloads.
5. Callbacks already queued by a replaced room (status, others, presence,
   error, delivered after unsubscribe) change no state. With the generation
   guard removed, this fails.
6. Errors are sanitized. A connection error is reported once until the room
   reconnects. Other error types don't use up that one report.
7. Repeated teardown: every room left once, zero listeners remaining, and
   `destroy()` called exactly once on each provider-owned Y.Doc.

`setup-failure-atomicity.mjs` case 5 now uses the fake service. It covers both
partial failures: the provider constructor throws, and the editor throws after
the provider is created. Each asserts that the room was left once and all room
listeners were released. The second also asserts the Y.Doc was destroyed once.
`collaboration-configuration-lifecycle.mjs` runs its Liveblocks section against
the real provider.

Red → green: with the `main` `initialize.js`, `liveblocks-lifecycle.mjs` fails
at the first status assertion, and `setup-failure-atomicity.mjs` fails with
`provider-owned Y.Doc destroyed exactly once` (actual 2).

## Review

An independent read-only reviewer approved head `317c84d`. They found no
blocking issues. Addressed in the follow-up commit:

- the stale-callback test didn't exercise the generation guard (the fake now
  delivers late callbacks);
- raw error text went to the debugger, possibly repeatedly (now sanitized and
  deduplicated);
- the changelog overstated cleanup on element removal. Cleanup runs on update,
  reset or failed setup; nothing detects a silently removed element. That was
  already true for every provider.

A second pass on `3df677f` approved. Its two low findings were fixed in the
next commit: the dedup wording, and deduplicating only
`ROOM_CONNECTION_ERROR`.

Recorded, not changed: the fake models a simpler room than Liveblocks. It
doesn't keep self/others through reconnect, doesn't reference-count rooms
per client, and throws on a second `leave()` to make double disposal fail
loudly. The plugin creates one client per setup, so room sharing doesn't
arise.

## Final checks (Node 24, from `lib/`)

`npm ci`, `npm test` (18 scripts), `npm run validate:plugin` (5 metadata
files, 73 function bodies), `npm run test:validator`, `npm run test:browser`
(24 passed across Chromium, Firefox and WebKit). All passed.

## Deployment — development version (2026-09-25)

- PR #46 was squash-merged as `69b0610`. `main`'s tree is identical to the
  reviewed head `7897ed7`.
- Before the push, `pled status` showed only local changes (one element
  field). `pled push` completed, and `pled status` then reported **In sync**.
  This commit records the resulting `.src.json` baseline.
- Real run mode (`tiptap-plugin`, `version-test/tiptap-demo`):
  - The served test-version element code contains `disposeCollabResources`
    and `ROOM_CONNECTION_ERROR`, and not the old `_leaveCollabRoom`.
  - All 10 demo editors mounted.
  - Real keyboard typing in the first demo editor updated the Bubble states
    (character count, Is focused, Can undo).
- No Bubble branch was created, edited or deleted. Nothing was released to
  the Marketplace.

## Not yet verified

Real Liveblocks network verification in Bubble (two browser sessions,
reconnect, repeated room switch) needs a Liveblocks public key. None is
available in the Dev vault, and the plugin has not been pushed to the
development version for this change.
