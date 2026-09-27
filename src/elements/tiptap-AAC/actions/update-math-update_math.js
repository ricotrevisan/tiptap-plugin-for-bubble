if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Update math");

if (!instance.data.ext.math) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Update math", "Mathematics");
}

// Only the selected formula (from a click or the keyboard) is updated.
const editor = instance.data.editor;
const { node, from: pos } = editor.state.selection;
const latex = properties.latex || "";
if (node?.type.name !== "inlineMath" && node?.type.name !== "blockMath") {
    instance.data.debug("Update math: no formula is selected");
    return;
}
if (!latex.trim()) {
    context.reportDebugger("Update math needs LaTeX. The formula was not changed.");
    return;
}
const chain = editor.chain();
(node.type.name === "inlineMath" ? chain.updateInlineMath({ latex, pos }) : chain.updateBlockMath({ latex, pos }))
    .setNodeSelection(pos)
    .run();
