if (!instance.data.refreshAiEditorContext) {
    const message = "AI editor context generation is not available on this editor instance.";
    instance.publishState("ai_editor_context", "");
    instance.publishState("ai_context_error", message);
    instance.triggerEvent("ai_editor_context_failed");
    context.reportDebugger(message);
    return;
}

return instance.data.refreshAiEditorContext(context);
