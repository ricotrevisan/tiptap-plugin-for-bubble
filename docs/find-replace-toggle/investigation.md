# Forum post 645 investigation and implementation

Source: <https://forum.bubble.io/t/rich-text-editor-with-real-time-collaboration-tiptap/238504/645>

## Outcome

All three reports were valid and are fixed locally. The changes are tested but not uploaded or pushed to Bubble yet.

### 1. Find & Replace blanked the editor

Root cause: `initialize.js` called `FindAndReplace.configure(...)`, but the shipped runtime did not export that extension. The call threw after the editor had already been torn down for a schema rebuild, leaving an empty element and null content states.

Fix:

- Upgraded the complete compatible `@tiptap/*` runtime set to 3.31.3.
- Added and exported `@tiptap/extension-find-and-replace`.
- Kept a defensive runtime capability guard so a stale/missing bundle cannot destroy the editor.
- Added functional coverage for Find, next/previous navigation, case-sensitive, whole-word, regex, Replace, Replace all, empty replacement, invalid regex, HTML/JSON content, and runtime toggle rebuilds.

### 2. Insert image URLs were absent from File upload URLs

Root cause: only actual drop/paste uploads wrote `fileUploadUrls`. The Insert image action called `setImage` and published nothing.

Fix:

- A successful Insert image action appends its URL to **File upload URLs**.
- Duplicate insert operations remain in this operation-result list.
- A filtered/no-op insertion is not reported.
- Inserting an existing URL does not perform an upload and does not fire **file is uploaded**.
- Real drop/paste upload batches retain their existing reset semantics. Their state is now published before the upload event, so workflows see the current URLs inside the event.

### 3. No image-deletion event

Fix:

- Added **Image deleted** (`image_deleted`).
- Added the text-list state **Removed image URLs** (`removed_image_urls`).
- The state is published before the event.
- URLs are reported only when their last reference in the current document disappears. Repeated images with the same exact `src` are handled correctly.
- Covers keyboard deletion, range/multi-image deletion, undo of insertion, redo of deletion, loaded HTML/JSON images, and image moves.
- Set content, Clear contents, initial-content changes, autobinding record switches, reset, rebuild, and remote Yjs collaboration changes do not produce deletion notifications.
- Collaboration undo/redo is deliberately silent because it has Yjs origin.
- This is a notification only. The plugin never deletes a stored file; Bubble workflows must check other documents, collaborators, and undo history before deletion.

## Related integration work

The remote plugin contained the already-published collaboration lifecycle work from commits `a099a45` and `103b06e`. It was three-way merged with the forum fixes instead of overwritten. Pled now reports **Local ahead**, not divergence.

The Tiptap upgrade exposed a collaboration-caret repaint issue: `CollaborationCaret` discards `clientId` before its `render` option, so retained cursor DOM could not be keyed correctly. The adapter now uses raw `yCursorPlugin`, which supplies `clientId`; collaborator name/color repaint tests pass in all browsers.

## Verification

Final local gates:

- `cd lib && npm test` — passed, including real Find/Replace commands, image URL/removal lifecycle, two real Yjs documents, collaboration configuration, save ordering, menus, TOC, image alignment/resizing, and existing lifecycle coverage.
- `npm run validate:plugin` — passed: 5 metadata files, 73 function bodies (one existing computed-state note).
- `npm run test:validator` — 11 passed.
- `npx playwright test` — 24 passed: 8 scenarios in Chromium, Firefox, and WebKit.
- `pled status` — Local ahead; 6 element-field changes; no divergence.

## Release blockers

- The runtime changed, so release requires a uniquely versioned `lib/dist.js` upload, updating `src/elements/tiptap-AAC/headers.html`, then `pled push`. These are external mutations and were not performed.
- Real Bubble verification is blocked because the currently linked Buildprint CLI token exposes only app `mm-137`, not `tiptap-plugin`. A CLI token scoped to `tiptap-plugin` is needed before creating a verification branch.
