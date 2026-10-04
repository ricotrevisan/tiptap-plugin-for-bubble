if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Blur");

// Only focus changes; content and selection stay, and the editor fires
// its own "isn't focused" event.
if (instance.data.editor.can().blur()) {
    instance.data.editor.commands.blur();
} else {
    const message = "Tried to run Blur, but the editor cannot blur. Returning";
    instance.data.debug(message);
    context.reportDebugger(message);
}