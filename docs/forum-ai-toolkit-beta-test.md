# Beta testers wanted: Tiptap Server AI Toolkit bridge for Bubble

I’ve added a functional bridge for Tiptap’s **Server AI Toolkit v4** to the Rich Text Editor (Tiptap.dev) Bubble plugin.

I don’t currently have an AI Toolkit entitlement, so the normal editor features and local integration seams have been tested, but I’m looking for users with an entitled Tiptap environment to verify the live API flow.

## What this release adds

- Automatic **AI editor context** state generated from the editor’s active schema
- Context ready/failed events and a manual refresh action
- Secure server-side ES256 authentication—your private key never enters browser JavaScript
- **Fetch AI Toolkit tools** server action with an explicit allowlist
- **Execute AI Toolkit tool** server action
- Inline document mode, returning JSON for the existing Set content action
- Collaborative mode, with `Documents:Write` scoped to one Tiptap Cloud document

The plugin does not include an AI model provider or chat interface. You can use OpenAI, Anthropic, Google, or another provider separately.

## Prerequisites

- Update the Bubble plugin to the version containing the **Server AI Toolkit bridge beta**
- A Tiptap environment with the Server AI Toolkit entitlement
- Its Access Control environment ID and ES256 PKCS#8 private key
- A Bubble test page—please do not start with production data

## 1. Configure credentials

In the Bubble app editor, open:

**Plugins → Rich Text Editor (Tiptap.dev) → settings**

Set:

- **Tiptap AI environment ID**
- **Tiptap AI ES256 private key**
- Leave **Tiptap AI API base URL** empty to use `https://api.tiptap.dev`

Do not place the private key in an element property, page state, client-side action, or LLM-provider configuration.

## 2. Verify editor context

1. Add a Tiptap element to a test page.
2. Enable its **AI Toolkit** option.
3. Display these states temporarily:
   - AI editor context
   - AI context error
   - Content JSON
4. Add workflows for:
   - AI editor context ready
   - AI editor context failed
5. Preview the page.

Expected:

- AI editor context is valid JSON containing `serializedSchema` and `items`.
- AI context error is empty.
- The ready event fires.
- Running **Refresh AI editor context** succeeds and produces stable JSON.

Optional negative test: disable AI Toolkit and run Refresh. The failed event should fire with a compatibility warning.

## 3. Fetch tool definitions

Add a button that runs **Fetch AI Toolkit tools** with:

- **AI editor context (JSON):** the editor’s AI editor context state
- **Tool allowlist:** `tiptapRead,tiptapEdit`

Display or store the action outputs.

Expected:

- `success = yes`
- `status_code = 200`
- Empty error code/message
- A system prompt
- Tool definitions JSON containing `tiptapRead` and `tiptapEdit`

Negative tests:

- Empty allowlist → no tools enabled
- `deleteEverything` → `unsupported_tool`

## 4. Execute a deterministic inline read

Run **Execute AI Toolkit tool** with:

- **AI editor context:** the editor’s AI editor context state
- **Tool call JSON:**

```json
{"name":"tiptapRead","input":{"from":0}}
```

- **Document mode:** Inline
- **Inline document JSON:** the editor’s Content JSON state

Expected:

- `success = yes`
- `status_code = 200`
- Tool output contains the document content
- `document_changed = no`

## 5. Test an AI-generated edit

Pass the fetched system prompt and tool definitions to your chosen LLM. When it selects a Tiptap tool, send its tool call to **Execute AI Toolkit tool**.

For Inline mode, when `document_changed = yes`:

1. Run the existing **Set content** element action.
2. Set Content to **updated inline document (JSON)**.
3. Set **Is JSON?** to yes.

Use test content and watch for concurrent user edits before replacing the document.

## 6. Optional collaborative test

Connect the editor to a Tiptap Cloud document using the plugin’s existing collaboration settings, then execute with:

- **Document mode:** Collaborative
- **Collaborative document ID:** the exact connected document ID

Expected:

- The token can write only that document.
- Do not call Set content.
- The existing collaboration provider delivers edits to the editor.
- All connected clients use the same schema and AI Toolkit setting.

## Please report

Reply with:

```text
Plugin version:
Browser:
Tiptap environment type: Cloud / on-prem
Inline fetch-tools: pass / fail
Inline tiptapRead: pass / fail
Inline tiptapEdit: pass / fail / not tested
Collaborative execution: pass / fail / not tested
HTTP status:
Error code/message:
Notes (with credentials and document content removed):
```

Please never post private keys, bearer tokens, full editor context, private document content, or sensitive server responses.
