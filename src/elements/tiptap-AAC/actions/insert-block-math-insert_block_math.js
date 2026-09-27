if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Insert block math");

if (!instance.data.ext.math) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Insert block math", "Mathematics");
}

const latex = properties.latex || "";
if (!latex.trim()) {
    context.reportDebugger("Insert block math needs LaTeX. Nothing was inserted.");
    return;
}
instance.data.editor.chain().focus().insertBlockMath({ latex }).run();
