if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Unset line height");

if (instance.data.ext.lineheight) {
    instance.data.editor.chain().focus().unsetLineHeight().run();
} else {
    console.log("tried to unset line height but Line Height extension is not active.");
}
