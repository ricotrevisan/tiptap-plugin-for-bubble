if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Clear Highlight");

if (instance.data.ext.highlight) {
    instance.data.editor.chain().focus().unsetHighlight().run();
} else {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Clear Highlight", "Highlight");
}