if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Unset background color");

if (instance.data.ext.backgroundcolor) {
    instance.data.editor.chain().focus().unsetBackgroundColor().run();
} else {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Unset background color", "Background Color");
}
