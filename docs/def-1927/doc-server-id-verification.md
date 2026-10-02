# DEF-1927 — dynamic Doc Server ID

## Contract and proposed release

Proposed minor: **4.16.0**, not published.
Field: **Doc Server ID (dynamic)**, `collab_app_id_dynamic`, optional DynamicValue text, empty default, Bubble field key `AEO`.
Non-empty trimmed override wins over `collab_app_id`; otherwise the static value is unchanged. Both Tiptap Cloud and custom Hocuspocus use it; Liveblocks ignores it.

Release description: Set the Doc Server ID from an expression to use a different collaboration server per Bubble environment. Leave it empty to retain the existing static ID. Changing the resolved ID reconnects without carrying content between servers. Use the same ID and matching signing secret when generating the JWT.

## Evidence

- `lib/`: `npm ci`, `npm test`: passed, including the new override lifecycle test.
- `npm run validate:plugin`: passed (5 metadata files, 80 function bodies).
- `npm run test:validator`: 11 passed.
- Focused test after review additions: passed; covers masked static changes, absent override, and old-server draft isolation.
- Independent read-only reviewer: no blocking correctness findings; suggested coverage added.
- `pled push`: succeeded for plugin `1670612027178x122079323974008830` Testing; subsequent `pled status`: **In sync**. Runtime imports/dependencies unchanged; no CDN bundle release required.

Provider-construction assertions cover static and dynamic Tiptap websocket URLs, custom URL suffixes, runtime reconnect/disposal, whitespace fallback, dynamic-only readiness, and configuration comparison.

## Token action

`generate auth token` already has DynamicValue `appId`, used as the optional JWT audience. No action change or guard added. The action cannot compare its ID with a client element's configuration; requiring an audience would break existing optional behavior. Callers must pass the matching ID and signing secret.

## Real Bubble verification — blocked

`BUILDPRINT_PROFILE=ricowtf buildprint branch list tiptap-plugin --json` showed all nine Test child branch slots occupied: 13kqb, 73kq6, 73kq4, 33kpz, 03kpl, 13kns, 73knr, 33kl0, 23kar.
No branch deleted or reused; no Test/Live app edits. A new preview-only branch cannot be created until the maintainer frees a slot. Consequently no real Bubble websocket/provider evidence or tested preview URL is claimed. The task remains incomplete at this gate.

No mm-137 or other app touched; no PR merge or Marketplace release performed.
