# DEF-1927: conditional collaboration and auto-binding

Proposed release: **4.16.1** (patch after 4.16.0). No release is published by this task.

## Change

Removed the one-time `context.reportDebugger` call in `update.js`. No replacement notice is needed: this is a supported configuration. Debug mode still logs normal lifecycle details through the existing `console.log` helper. Binding and collaboration handlers are unchanged.

## Regression coverage

`lib/tests/collaboration-configuration-lifecycle.mjs` uses the real bundled editor with a disconnected fixture Hocuspocus provider. It checks both debug-mode settings, no debugger error, ignored incoming bound content, no auto-binding writes while collaborating, and resumed local saves after collaboration is disabled.

## Other diagnostics inspected

Reviewed `reportDebugger` and `console.error` calls across `src/`.

- Uploads without `attachFilesTo` report a privacy warning even when an intentional public upload succeeds (`initialize.js`). Left unchanged: it is a separate security/privacy notice, not this collaboration false alarm.
- Missing collaboration prerequisites report an error while dynamic credentials are loading (`update.js`). This may be transient in a valid app, but it also indicates incomplete configuration. Left unchanged; changing prerequisite diagnostics needs separate scope.
- Actions before readiness, disabled extensions, invalid/missing action inputs, unavailable runtime extensions, menu ownership/configuration errors, authentication exhaustion, setup/provider failures, KaTeX load failures, denied/failed uploads, invalid color strings and serialization failures report actual unavailable operations or failures. Left unchanged.

## Live verification

`pled push` completed successfully and `pled status` reports **In sync**. Full `npm test`, `npm run validate:plugin`, and `npm run test:validator` passed. See `autobinding-console-verification.md` for real preview evidence. Rico approved reusing `def-1927-doc-server-id`. The real combined fixture now passes: original code reproduced the warning with client-only source interception; unmodified remote Testing does not emit it. Shared edits sync without writing the bound database copy. See `combined-verification.md` for logs, source-interception limits, transient prerequisite errors, and exact cleanup confirmation. No app other than `tiptap-plugin` is touched.

## Release notes

An editor with both Collaboration and Auto-binding enabled no longer reports a console error. Auto-binding remains ignored while collaboration is active and resumes when collaboration is off.
