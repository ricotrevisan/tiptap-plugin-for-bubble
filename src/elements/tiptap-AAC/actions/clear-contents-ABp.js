if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Clear Contents");

  try {
    instance.data.editor.chain().clearContent(true).run();
    instance.data.refreshTableOfContents();
  } catch (error) {
    console.error(error);
    context.reportDebugger("There was an error running clearContent.\n" + error.message);
  }