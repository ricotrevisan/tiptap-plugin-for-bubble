if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Replace all");

if (!instance.data.ext.findreplace) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Replace all", "Find & Replace");
}

const replacement = properties.replacement ?? "";
instance.data.editor.commands.setReplaceTerm(replacement);
instance.data.editor.commands.replaceAll();
