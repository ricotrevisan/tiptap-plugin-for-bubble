if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Unset line height");

if (instance.data.ext.lineheight) {
    instance.data.editor.chain().focus().unsetLineHeight().run();
} else {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Unset line height", "Line Height");
}