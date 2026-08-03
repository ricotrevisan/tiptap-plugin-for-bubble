if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Unset all marks");

  instance.data.editor.chain().unsetAllMarks().focus().run();