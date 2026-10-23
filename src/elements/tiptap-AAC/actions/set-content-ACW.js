if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Set Content");

  try {
    let content = properties.is_json
      ? JSON.parse(properties.content)
      : properties.content;
    let preserveWhitespace =
      properties.parseOptions_preserveWhitespace === "true"
        ? true
        : properties.parseOptions_preserveWhitespace === "false"
          ? false
          : "full";

    const setContent = (preserve) =>
      instance.data.editor.commands.setContent(content, {
        emitUpdate: true,
        parseOptions: { preserveWhitespace: preserve },
      });

    try {
      setContent(preserveWhitespace);
    } catch (error) {
      // "full" parses content as a slice, which rejects HTML the editor's
      // schema can repair, such as an empty <li>. Parse it as a document.
      if (preserveWhitespace !== "full") throw error;
      setContent(true);
    }
    instance.data.refreshTableOfContents();
  } catch (error) {
    console.error(error);
    context.reportDebugger("There was an error running setContent.\n" + error.message);
  }