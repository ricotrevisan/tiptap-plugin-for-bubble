if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Insert emoji");

if (!instance.data.ext.emoji)
    return instance.data.returnAndReportErrorIfExtensionNotActive("Insert emoji", "Emoji");

// Accept the catalog name (smile) or a shortcode (:smile:). Unicode itself
// can already be entered as text; the action inserts a real emoji node.
const name = String(properties.emoji_name || "").trim().replace(/^:([^:]+):$/, "$1");
const emojis = instance.data.editor.storage.emoji?.emojis || [];
if (!emojis.some(item => item.name === name || item.shortcodes?.includes(name))) {
    context.reportDebugger("Insert emoji needs a known emoji name or shortcode, such as smile or :smile:. Nothing was inserted.");
    return;
}
instance.data.editor.chain().focus().setEmoji(name).run();
