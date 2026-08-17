# Rich Text Editor (Tiptap.dev) — Bubble.io Plugin

A full-featured rich text editor for [Bubble.io](https://bubble.io) built on [Tiptap v3](https://tiptap.dev). Drop it into any Bubble app and get a modern editing experience — formatting, tables, images, collaboration, and 55+ editor actions — without writing a line of code inside Bubble.

**[Install the plugin](https://bubble.io/plugin/rich-text-editor-tiptapdev-1670612027178x122079323974008830)** · **[Live demo](https://tiptap-demo.bubbleapps.io/version-test/doc/demo)**

---

## Why use this plugin?

Bubble's built-in rich text editor is limited. This plugin gives you:

- **Full formatting** — Bold, italic, underline, strikethrough, highlight, text color, font family, font size, subscript, superscript
- **Structure** — Headings (H1–H6), blockquotes, code blocks, horizontal rules, collapsible details/accordion sections
- **Lists** — Bullet, numbered, and task/checklist lists with indent/outdent
- **Tables** — Insert, resize, merge/split cells, toggle header rows and columns
- **Media** — Images (inline or block) and YouTube embeds
- **Links** — With custom styling and configurable protocols
- **Menus** — Top toolbar, bubble menu (on text selection), and floating menu
- **Real-time collaboration** — Via Tiptap Cloud, custom Hocuspocus server, or Liveblocks, with cursor labels, connection status, and JWT auth
- **Output formats** — HTML, plain text, and JSON — all exposed as Bubble states
- **55+ workflow actions** — Control the editor programmatically from Bubble workflows
- **Keyboard & Markdown shortcuts** — Standard editor shortcuts plus Markdown-style triggers
- **Fully customizable** — CSS overrides for every element, per-extension toggles, debug mode

---

## Tiptap Server AI Toolkit

The plugin provides a server-side bridge to Tiptap's **Server AI Toolkit v4**. It supplies editor schema context, securely signs short-lived access-control JWTs, fetches an explicit set of Tiptap tools, and executes a tool call. Your Bubble app still owns the AI provider, prompts, UI, and model/tool-calling loop.

### Prerequisites and credentials

1. Enable Server AI Toolkit for your own Tiptap Cloud environment. This is a paid Tiptap entitlement.
2. In **Plugins → Rich Text Editor (Tiptap.dev) → settings**, configure:
   - **Tiptap AI environment ID** — the Access Control environment ID used as the JWT issuer.
   - **Tiptap AI ES256 private key** — the PKCS#8 P-256 private key issued for that environment. PEM text with escaped `\n` newlines is accepted.
   - **Tiptap AI API base URL** — optional; leave empty for `https://api.tiptap.dev`. Set it only to an HTTPS URL for a supported on-premises deployment.
3. Configure OpenAI, Anthropic, Google, or another model provider separately in your app. Model-provider credentials are not Tiptap credentials and this plugin does not store them.

The ES256 key is used only inside Bubble server-side actions. It is never an element property, browser state, browser action input, log value, or action output. Tokens expire after 30 minutes. Collaborative execution grants `Documents:Write` only for the requested document ID.

### Configure the editor

Enable **AI Toolkit** on the Tiptap element. This compatibility toggle preserves the `_hash` attributes used by server tools; by itself it does **not** call Tiptap or invoke AI.

When the editor is ready, the plugin publishes:

- **AI editor context** — serialized JSON for the editor's exact active schema.
- **AI context error** — empty on success, otherwise a human-readable generation error.
- **AI editor context ready / failed** events — deterministic workflow triggers.

Use **Refresh AI editor context** after rebuilding or changing the editor schema. Refresh fails visibly if AI Toolkit compatibility is disabled, because executing later with stripped hashes would be unsafe. The pinned `@tiptap/ai-toolkit` 0.3.0 context module is loaded on demand from jsDelivr only for this AI path; non-AI editors do not download its dependency graph.

### Fetch tools and call your model

Run the server-side **Fetch AI Toolkit tools** action with the AI editor context and a comma-separated allowlist. All tools are disabled unless explicitly named. Tiptap currently supports:

Use the exact names `tiptapRead`, `tiptapEdit`, `getThreads`, `editThreads`, `readDocument`, `readSelection`, and `proofread`.

Start with `tiptapRead,tiptapEdit`. Pass the returned **system prompt** and **tool definitions (JSON)** to your chosen model provider. When the model selects a tool, keep its generated arguments under `input`; optional developer-owned configuration belongs under `config`:

```json
{
  "name": "tiptapEdit",
  "input": { "operations": [] },
  "config": {}
}
```

Every server action returns `success`, `status_code`, `error_code`, and `error_message`, so Bubble workflows can branch without parsing logs. Tool definitions and tool results are JSON text.

### Inline document workflow

1. Run **Execute AI Toolkit tool** with document mode **Inline**.
2. Pass the selected tool-call JSON, AI editor context, and the editor's **content JSON** state.
3. On success, if **document changed** is yes, run the existing **Set content** element action with **updated inline document (JSON)** and set **Is JSON?** to yes.

Do not apply an old result blindly if the user changed the document while the AI request was in flight; decide in your workflow whether to retry, confirm, or replace.

### Collaborative document workflow

1. Connect the editor to the same Tiptap Cloud document through the plugin's existing collaboration settings.
2. Run **Execute AI Toolkit tool** with document mode **Collaborative** and that exact document ID. Set the collaborative field only if your document uses a field other than `default`.
3. Do **not** call Set content. The Tiptap server writes the cloud document and the existing collaboration provider delivers the update to connected editors. Handle `concurrent_edit_conflict` (HTTP 409) by retrying from current state when appropriate.

Every client editing one collaborative document must use a compatible schema, including the same AI Toolkit setting and relevant extensions. Thread tools are not supported in Inline mode; `getThreads`, `editThreads`, and selection-aware workflows require the documented cloud setup.

This bridge uses only the non-streaming v4 endpoints `/v4/ai/toolkit/fetch-tools` and `/v4/ai/toolkit/execute-tool`. Streaming, chat UI, and a bundled model provider are intentionally out of scope.

---

## Fork & develop locally

Want to customize the plugin, add extensions, or contribute? Here's how to get your own copy running.

### 1. Fork the plugin in Bubble

Open the [plugin page](https://bubble.io/plugin/rich-text-editor-tiptapdev-1670612027178x122079323974008830) in Bubble and click **Fork**. This creates your own copy of the plugin under your Bubble account.

### 2. Get the plugin editor URL

Open your forked plugin in the Bubble plugin editor. Copy the URL from your browser's address bar — it will look something like:

```
https://bubble.io/plugin_editor?id=1234567890x987654321
```

### 3. Install Pled

[Pled](https://github.com/RicoTrevisan/pled) is a CLI that lets you pull Bubble plugin source code to local files, edit with any editor or AI agent, and push back.

Download the latest archive for your platform from the [Pled releases page](https://github.com/RicoTrevisan/pled/releases/latest):

| Platform | Archive |
|---|---|
| macOS (Apple Silicon) | `pled-macos-arm.tar.gz` |
| macOS (Intel) | `pled-macos-x86.tar.gz` |
| Linux (ARM) | `pled-linux-arm.tar.gz` |
| Linux (x86) | `pled-linux-x86.tar.gz` |
| Windows | `pled-windows.zip` |

Extract and move the `pled` binary to your PATH:

```bash
# Example for macOS Apple Silicon
tar -xzf pled-macos-arm.tar.gz
sudo mv pled /usr/local/bin/pled
```

See the [Pled repo](https://github.com/RicoTrevisan/pled) for full setup details.

### 4. Set your Bubble cookie

Pled authenticates with Bubble using your browser session cookie. Export it as an environment variable:

```bash
export BUBBLE_COOKIE="your_bubble_session_cookie_here"
```

To get your cookie: open the Bubble plugin editor → open browser DevTools → Application tab → Cookies → copy the full cookie string. See the [Pled README](https://github.com/RicoTrevisan/pled) for detailed instructions.

> **Tip:** Add the export to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.) so it persists across sessions.

### 5. Clone this repo and initialize

```bash
git clone https://github.com/YOUR_USERNAME/tiptap.git
cd tiptap

# Point Pled at your forked plugin
pled init https://bubble.io/plugin_editor?id=YOUR_PLUGIN_ID

# Pull the latest plugin source from Bubble
pled pull
```

This decodes the plugin into editable JavaScript files under `src/`.

### 6. Make changes and push

Edit any file in `src/`, then push your changes back to Bubble:

```bash
pled push
```

Or use watch mode to auto-push on every save:

```bash
pled watch
```

That's it. Open your Bubble app, and the plugin reflects your changes.

---

## Project structure

```
src/
├── actions/                           # Server-side actions
│   ├── generate-auth-token-AEK/      # JWT auth token generation
│   └── convert-webhook-payload.../    # Hocuspocus webhook → HTML
├── elements/
│   └── tiptap-AAC/                    # Main editor element
│       ├── actions/                   # 55 element actions (bold, italic, tables, etc.)
│       ├── initialize.js              # Editor setup and configuration
│       ├── update.js                  # Property change handling
│       ├── preview.js                 # Bubble editor preview
│       └── reset.js                   # Teardown and cleanup
├── plugin.json                        # Plugin metadata and field definitions
└── shared.html                        # Shared HTML resources
lib/
├── index.js                           # Library imports → window.tiptap namespace
├── package.json                       # npm dependencies (Tiptap, Hocuspocus, etc.)
└── dist.js                            # Bundled output (uploaded to Bubble CDN)
```

---

## Library management

All Tiptap libraries are centralized in `lib/index.js`, bundled into a single file, and exposed on `window.tiptap` for use in `initialize.js` and `update.js`.

**To add a new library:**

1. Add the import to `lib/index.js` and expose it on `window.tiptap`
2. Bundle: `npm run build`
3. Upload: `pled upload dist.js`
4. Use the returned CDN URL in the element's `headers.html`
5. Access it in `initialize.js` / `update.js` via `window.tiptap`

---

## Commands

| Command | What it does |
|---|---|
| `pled pull` | Pull latest plugin source from Bubble |
| `pled push` | Push local changes to Bubble |
| `pled watch` | Auto-push on file save |
| `npm run build` | Bundle `lib/index.js` → `dist.js` |
| `pled upload dist.js` | Upload bundled libraries to Bubble CDN |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## License

This plugin is available on the [Bubble plugin marketplace](https://bubble.io/plugin/rich-text-editor-tiptapdev-1670612027178x122079323974008830). Fork and modify freely.
