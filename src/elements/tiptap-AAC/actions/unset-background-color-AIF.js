if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Unset background color");

if (instance.data.ext.backgroundcolor) {
    instance.data.editor.chain().focus().unsetBackgroundColor().run();
} else {
    console.log("tried to unset background color but Background Color extension is not active.");
}
