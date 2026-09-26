if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Insert inline math");

if (!instance.data.ext.math) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Insert inline math", "Mathematics");
}

const latex = properties.latex || "";
if (!latex.trim()) {
    context.reportDebugger("Insert inline math needs LaTeX. Nothing was inserted.");
    return;
}
instance.data.editor.chain().focus().insertInlineMath({ latex }).run();
