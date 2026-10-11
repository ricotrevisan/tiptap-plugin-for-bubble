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

    console.log(
      "setContent preserveWhitespace",
      typeof preserveWhitespace,
      preserveWhitespace
    );

    instance.data.editor.commands.setContent(content, {
      emitUpdate: true,
      parseOptions: { preserveWhitespace: preserveWhitespace },
    });
    instance.data.refreshTableOfContents();
  } catch (error) {
    console.error(error);
    context.reportDebugger("There was an error running setContent.\n" + error.message);
  }