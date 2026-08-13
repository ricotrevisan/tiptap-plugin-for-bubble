if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Set background color");

if (instance.data.ext.backgroundcolor) {
    let background_color = properties.background_color;
    if (!background_color) return;
    instance.data.editor.chain().focus().setBackgroundColor(background_color).run();
} else {
    console.log("tried to set background color but Background Color extension is not active.");
}
