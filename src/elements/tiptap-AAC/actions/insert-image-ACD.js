if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Insert Image");

  if (instance.data.ext.image) {
    let image = properties.insert_image;
    if (!image) return;

    const options = {};

    let title = properties.title;
    let alt_text = properties.alt_text;

    options.src = image;
    if (title) {
      options.title = title;
    }
    if (alt_text) {
      options.alt = alt_text;
    }

    const before = instance.data.editor.state.doc;
    const inserted = instance.data.editor.commands.setImage(options);
    if (inserted && !before.eq(instance.data.editor.state.doc)) {
      // This URL already exists. Record the successful insertion without
      // uploading it again or emitting the upload-only fileUploaded event.
      instance.data.fileUploadUrls = [...(instance.data.fileUploadUrls || []), image];
      instance.publishState("fileUploadUrls", instance.data.fileUploadUrls.slice());
    }
  } else {
    console.log("tried to add Image, but extension is not active.");
  }