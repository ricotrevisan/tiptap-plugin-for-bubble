if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Delete math");

if (!instance.data.ext.math) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Delete math", "Mathematics");
}

// Only the selected formula (from a click or the keyboard) is deleted.
const editor = instance.data.editor;
const { node, from: pos } = editor.state.selection;
if (node?.type.name === "inlineMath") editor.commands.deleteInlineMath({ pos });
else if (node?.type.name === "blockMath") editor.commands.deleteBlockMath({ pos });
else instance.data.debug("Delete math: no formula is selected");
