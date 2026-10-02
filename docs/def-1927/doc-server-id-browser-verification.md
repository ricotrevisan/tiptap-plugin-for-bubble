# DEF-1927 — real Bubble Doc Server ID verification

## Result

**PASS for the requested real-Bubble dynamic-expression / static-only verification.** Both editors authenticated and synced on the existing server. Changing the dynamic expression's resolved value selected the corresponding actual WebSocket host and disposed the preceding connection without disconnecting the static-only editor.

No remaining blocker for those checks. **Two different provisioned/authenticated servers were not available:** the alternate hostnames below are deliberately unprovisioned probes, not working environments. Successful cross-server authentication/content isolation, custom Hocuspocus, and Liveblocks were not browser-tested in this run.

This evidence supersedes the branch-capacity blocker in `doc-server-id-verification.md`; the maintainer supplied a dedicated preview branch before this verification.

## Exact target and boundaries

- Verification date: **2026-10-02**, approximately **12:54–13:02 UTC**.
- App: **`tiptap-plugin`**, Buildprint profile **`ricowtf`** on every Buildprint command.
- Bubble branch ID: **`63l47`**; display name: **`def-1927-doc-server-id`**.
- Exact tested preview: **https://tiptap-plugin.bubbleapps.io/version-63l47/tiptap-demo** (no query string).
- Workspace: `/tmp/def1927-bubble/def-1927-doc-server-id`.
- Existing rollback savepoint verified before mutation: **`1790945508324`**, “Before DEF-1927 verification”. It was not restored.
- Plugin: `1670612027178x122079323974008830`, already pushed to **Testing** by the preceding implementation work. Pled status was **In sync** before and after this run. No plugin source/bundle changes or push/upload were needed here.
- Only the supplied preview branch was changed. No other app, Test/Live branch, branch deletion, merge, Marketplace release, or deployment was performed.
- No commit was made in the current plugin Git worktree. Buildprint automatically recorded its applied source in its separate temporary workspace; that is not a plugin-repository commit.

## Preview fixture changes

Only these two BubbleScript files changed, scoped to `demo-collaboration`:

1. `reusable-elements/demo-collaboration/reusable.ts`
   - Added preview-only verification instructions, override input, a second collaboration editor, and its status readout.
   - Existing editor `bpclrcpf` remains **static-only**, with `collab_app_id: "nrm8d1ko"` and **no `collab_app_id_dynamic` property**. Its document is now `def-1927-static-verification`.
   - New editor `bpyvsucg` has deliberately different static fallback `def-1927-static-fallback`, document `def-1927-dynamic-verification`, and the following actual Bubble expression:

     ```ts
     collab_app_id_dynamic: dynamicText(
       "", element("Doc Server ID override input").value(), ""
     )
     ```

   - Input `bpyvsucf` defaults to `nrm8d1ko`. The expression reads this native Bubble input; it was not replaced with a JavaScript literal at runtime.
   - Both collaboration editors and the existing read-only copy explicitly have File uploads enabled = **no** (`file_upload_condition: false`).
2. `reusable-elements/demo-collaboration/workflows/PageLoaded-bpmnxpte.ts`
   - Changed token allowed document names to `def-1927-static-verification,def-1927-dynamic-verification`.
   - Existing token action audience remains `nrm8d1ko`; existing Tiptap Cloud secret selection remains unchanged. No secret was read or copied into this evidence.

The ticket-specific collaboration documents prevent the verification from editing the existing shared `tiptap-demo-recipes` document. Connecting initialized the two ticket-specific cloud documents with the configured initial content. **Save a copy was never clicked**; no Bubble database record was intentionally written. The old saved-copy display is unchanged and is not evidence for the two new documents.

The fixture is left on this preview branch, with the override restored to **`nrm8d1ko`** and both editors connected/synced.

## `_current-AAC` investigation

Do not rename these elements to `_dev-AAC` merely based on the shared skill's typical install naming:

- The branch's Buildprint plugin index resolves this install as `1670612027178x122079323974008830_current`, version **`current`**; its elements use `1670612027178x122079323974008830_current-AAC`.
- Its downloaded plugin metadata contains field **`AEO`**, caption **Doc Server ID (dynamic)**, name `collab_app_id_dynamic`, editor **DynamicValue**, type **text**, optional, empty default.
- Generated `names.d.ts` exposes `collab_app_id_dynamic` as an expression-capable property. Buildprint accepted/applied the input expression without a raw-Bubble escape hatch.
- Most importantly, the real preview resolved `nrm8d1ko` from the input **instead of** the static sentinel and successfully authenticated. It then changed actual WebSocket targets as the input changed. Thus the `_current` install actually executing on this branch includes the pushed dynamic-field behavior; this was not a released-version-only fixture.

## Browser method and actual socket evidence

Used the **T3 shared-preview tools**, through the parent session's existing preview bridge (these tools were not directly registered in the worker's tool list). First calls:

- `preview_status`: `available: false`, `tabId: null`.
- `preview_open`: opened the exact preview in **`tab_a`**, `available: true`, 1280×800 viewport.

Initial unauthenticated navigation returned HTTP 401. Navigation with the documented run-mode login succeeded. Credentials are omitted from all evidence/URLs below. Initial Electron preload diagnostics did not prevent subsequent page loading, native interactions, or socket inspection.

Used `preview_type` with `clear: true` and `preview_press` Tab to change/commit the native input; `preview_wait_for` waited for real connection status. No synthetic DOM input/click events were dispatched. No standalone browser, Playwright instance, mock provider, intercepted response, or rerouting was used.

For the initial connections, inspected the **actual native `WebSocket` object's `.url` and `.readyState`** through the rendered Tiptap editor's `collaborationCaret` provider. For subsequent connections, installed an in-page observation-only wrapper around native `WebSocket`: it forwarded construction arguments unchanged and recorded only URL, time, and open/error/close events. It did not read messages, token configuration, or credentials. Native `WebSocket` was restored and temporary observation references removed at the end. Provider configuration URLs alone were **not** treated as successful socket connections.

### Observations

| Check | Native input value / fixture | Observed real provider/socket result |
| --- | --- | --- |
| Static-only compatibility | Existing editor; static `nrm8d1ko`; dynamic property absent | `wss://nrm8d1ko.collab.tiptap.cloud/`, socket OPEN (`readyState: 1`), authenticated **true**, synced **true**. Bubble: `Status: connected • Synced: yes • People here: 1`. |
| Dynamic precedence | Input `nrm8d1ko`; static fallback `def-1927-static-fallback` | Same valid `wss://nrm8d1ko.collab.tiptap.cloud/`, OPEN, authenticated **true**, synced **true**. It did **not** use the different static fallback. Bubble: `Dynamic status: connected • Synced: yes`. |
| Empty fallback | Input cleared to `""` via real input operation | Actual native WebSocket construction to `wss://def-1927-static-fallback.collab.tiptap.cloud/` at **12:59:50.949Z**, followed by error/close at **12:59:50.966–.967Z**. Previous dynamic socket CLOSED (`3`), previous provider detached. Static socket remained OPEN (`1`) and synced. |
| Whitespace fallback | Input `"  "` | Resolved provider URL remained `wss://def-1927-static-fallback.collab.tiptap.cloud`; observed retry host matched that fallback. Dynamic disconnected/unsynced, static still connected/synced. |
| Trimmed valid override | Input `"  nrm8d1ko  "` | Constructed `wss://nrm8d1ko.collab.tiptap.cloud/` at **13:00:35.371Z**, OPEN event **13:00:35.482Z**. Both editors authenticated/synced. No spaces in the socket host. |
| Changed non-empty override | Input `def-1927-dynamic-probe` | Constructed `wss://def-1927-dynamic-probe.collab.tiptap.cloud/` at **13:01:39.627Z**, error/close **13:01:39.729Z**. Previous dynamic provider detached; previous dynamic socket CLOSED. Static socket was the **same object**, still OPEN/connected/synced. This selected the dynamic probe, not the static sentinel. |
| Recovery / final state | Input restored to `nrm8d1ko` | Constructed valid socket at **13:01:40.685Z**, OPEN **13:01:40.887Z**. Static and dynamic sockets both OPEN, authenticated **true**, synced **true**. Readouts both connected/synced. |

The failures for `def-1927-static-fallback` and `def-1927-dynamic-probe` are **expected unprovisioned-host failures**. They establish host selection and old-connection disposal, not successful authentication to a second Tiptap app. No signing secret for a second app was supplied or fabricated.

Final inspected socket state, omitting the unrelated saved-copy editor:

```json
{
  "input": "nrm8d1ko",
  "editors": [
    {
      "document": "def-1927-static-verification",
      "url": "wss://nrm8d1ko.collab.tiptap.cloud/",
      "readyState": 1,
      "authenticated": true,
      "synced": true
    },
    {
      "document": "def-1927-dynamic-verification",
      "url": "wss://nrm8d1ko.collab.tiptap.cloud/",
      "readyState": 1,
      "authenticated": true,
      "synced": true
    }
  ]
}
```

### Shared-preview screenshot artifacts

Saved and visually inspected these screenshots; they are outside the plugin Git worktree:

- Static-only connected state, override input, and fixture instructions: `/home/rico/.t3/userdata/browser-artifacts/browser-screenshot-tiptap-plugin-bubbleapps-io-muqyzm0b-3efbd5e2.png`.
- Final valid override and both connected/synced readouts: `/home/rico/.t3/userdata/browser-artifacts/browser-screenshot-tiptap-plugin-bubbleapps-io-muqz2hhz-479e45f2.png`.

## Verification commands/results

- Skill preflight with `BUILDPRINT_PROFILE=ricowtf .../scripts/check-setup --live "$PWD"`: passed; Pled remote reachable/In sync and Buildprint app access confirmed.
- `BUILDPRINT_PROFILE=ricowtf buildprint branch tiptap-plugin 63l47`: confirmed exact name/display/preview URL.
- `BUILDPRINT_PROFILE=ricowtf buildprint savepoint list --app tiptap-plugin --branch 63l47`: confirmed the supplied rollback savepoint.
- `BUILDPRINT_PROFILE=ricowtf buildprint check` before apply: BubbleScript validation passed.
- `BUILDPRINT_PROFILE=ricowtf buildprint apply`: **12 changes applied to `tiptap-plugin/63l47`**; tests unchanged.
- Diff against the pre-verification Buildprint projection: **only the two fixture files above**, 39 insertions / 4 deletions.
- Final `BUILDPRINT_PROFILE=ricowtf buildprint check`: validation passed.
- Final `BUILDPRINT_PROFILE=ricowtf buildprint sync`: workspace already matches `tiptap-plugin/63l47`.
- Final `pled status`: **In sync**.

No plugin code changed during this verification, so the lifecycle/unit suite was not rerun here. Previous code-test results are recorded in `doc-server-id-verification.md`; the native browser results above are new evidence, not a restatement of those tests.
