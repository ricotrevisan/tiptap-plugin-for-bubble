# DEF-1927 autobinding preview verification

## Environment

- App: `tiptap-plugin`, Buildprint profile `ricowtf`.
- Existing read-only app configuration: `def-1927-doc-server-id` (`63l47`).
- Preview: https://tiptap-plugin.bubbleapps.io/version-63l47/wtf-260-autobinding
- Date: 2026-10-02.
- Plugin source was not pushed during this check; this is the before-push off-mode regression baseline.

## Collaboration off: PASS

The existing `Autobound editor` fixture has `autoBinding:true`, `collab_active:false`, and explicit `file_upload_condition:false`.

1. Saved the original Record A editor HTML in memory.
2. Clicked the editor and used real keyboard input to append ` DEF1927-VERIFY-20261002`.
3. Waited for the page's Stored HTML text to contain the marker.
4. Reloaded the exact preview URL. The editor HTML still contained the marker.
5. Removed the marker with real Backspace key events.
6. Waited for Stored HTML to lose the marker, then reloaded.
7. Compared restored editor HTML with the original: exact equality passed.

Only a temporary fixture record edit in the development database was made, with parent authorization. No live data or app configuration was changed.

Evidence: `autobinding-persisted.png`; raw browser console: `autobinding-console-before.txt`. The console includes Bubble's generic testing-plugin performance warning and font-load messages. These are not the targeted collaboration/autobinding warning.

## Collaboration plus autobinding: BLOCKED

Branch capacity is full. No branch was created or deleted. The existing collaboration fixture in `63l47` sets `autoBinding:false` in both editors, so it cannot reproduce the target warning. Existing branch configuration belongs to earlier work and was not changed. No synthetic runtime harness was used. Actual Bubble-config before/after console verification of collaboration plus autobinding remains unverified.
