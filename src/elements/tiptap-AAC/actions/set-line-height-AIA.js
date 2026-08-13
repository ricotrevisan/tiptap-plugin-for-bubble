if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Set line height");

if (instance.data.ext.lineheight) {
    let line_height = properties.line_height;
    if (!line_height) return;
    instance.data.editor.chain().focus().setLineHeight(line_height).run();
} else {
    console.log("tried to set line height but Line Height extension is not active.");
}
