// Update debug mode flag so the debug helper picks it up
instance.data._debug_mode = properties.debug_mode;

// Store latest properties/context for collab auth retry mechanism
instance.data._lastProperties = properties;
instance.data._lastContext = context;

// Construction-time extensions require a full rebuild when their dynamic
// Bubble toggle changes. Run this before collaboration prerequisite checks so
// disabling one always clears stale state, even while credentials are loading.
// Gate on isEditorSetup (not editor_is_ready) so a toggle that arrives while the
// editor is still being created asynchronously is not silently lost.
const aiToolkitChanged =
    instance.data._currentAiToolkitEnabled !== !!properties.ext_ai_toolkit;
const findReplaceChanged =
    instance.data._currentFindReplaceEnabled !== !!properties.ext_find_replace;
const tableOfContentsChanged =
    instance.data._currentTableOfContentsEnabled !== !!properties.ext_table_of_contents;
const menuConfiguration = instance.data.menuConfiguration(properties);
const menusChanged = instance.data._currentMenuConfiguration?.some((value, index) => value !== menuConfiguration[index]);
if (instance.data.isEditorSetup && (aiToolkitChanged || findReplaceChanged || tableOfContentsChanged || menusChanged)) {
    const changedExtensions = [];
    if (menusChanged) changedExtensions.push("Menus");
    if (aiToolkitChanged) changedExtensions.push("AI Toolkit");
    if (findReplaceChanged) changedExtensions.push("Find & Replace");
    if (tableOfContentsChanged) changedExtensions.push("Table of Contents");
    const rebuildReason = changedExtensions.join(" and ") + " extension changed";
    instance.data.debug(rebuildReason + " — rebuilding editor");

    // Rebuilding must not reset an unsaved local document back to the element's
    // initialContent property. Record the prior initialContent too so a
    // simultaneous property change is still applied after the rebuild.
    const bindingChange = instance.data._autobindingSave.classify(properties.autobinding_record_id, properties.autobinding);
    const boundDocumentChanged = properties.bubble.auto_binding() &&
        (bindingChange === "record" || bindingChange === "external");
    if (!properties.collab_active && !boundDocumentChanged && instance.data.editor_is_ready && instance.data.editor) {
        instance.data._pendingRebuildContent = instance.data.editor.getJSON();
        instance.data._pendingRebuildInitialContent = instance.data.initialContent;
        instance.data._pendingRebuildSave = instance.data._autobindingSave.checkpoint();
    } else if (boundDocumentChanged) {
        // A simultaneous extension toggle must not carry A's local document
        // into the editor being rebuilt for B.
        delete instance.data._pendingRebuildContent;
        delete instance.data._pendingRebuildInitialContent;
        delete instance.data._pendingRebuildSave;
    }
    instance.data.teardownEditor(rebuildReason);
}

if (properties.collab_active === true && !properties.collab_jwt) {
    instance.data.debug("collab is active but auth token is not yet loaded. Returning...");
    if (!instance.data._jwtEmptyWarningShown) {
        instance.data._jwtEmptyWarningShown = true;
        context.reportDebugger(
            "Collaboration is enabled but the JWT token is empty. The editor will initialize once the token is provided.",
        );
    }
    return;
}

if (properties.collab_active === true && !properties.collab_doc_id) {
    instance.data.debug("collab is active but document name (collab_doc_id) is not yet loaded. Returning...");
    context.reportDebugger(
        "Collaboration is enabled but the Document name field is empty. Please provide a unique document name (e.g. a slug or unique ID) for collaboration to work.",
    );
    return;
}

// Warn if both collaboration and auto-binding are enabled (one-time)
if (properties.collab_active && properties.bubble.auto_binding() && !instance.data._collabAutobindingWarningShown) {
    instance.data._collabAutobindingWarningShown = true;
    context.reportDebugger(
        "Collaboration and auto-binding are both enabled. Auto-binding will be ignored while collaboration is active — the collaborative document is the source of truth.",
    );
}

// Detect collab_doc_id change and rebuild editor if needed
if (
    instance.data.editor_is_ready &&
    properties.collab_active &&
    instance.data._currentCollabDocId &&
    properties.collab_doc_id &&
    instance.data._currentCollabDocId !== properties.collab_doc_id
) {
    instance.data.debug(
        "collab_doc_id changed from",
        instance.data._currentCollabDocId,
        "to",
        properties.collab_doc_id,
        "— rebuilding editor"
    );

    // Trigger the document change event before teardown
    instance.triggerEvent("collab_doc_changed");

    // Teardown the current editor
    instance.data.teardownEditor("collab_doc_id changed");

    // The next update cycle (or continuation of this one) will re-setup
    // because isEditorSetup is now false
}

// First run: set up the editor (defined in initialize.js)
// Also re-runs after a collab auth failure retry (isEditorSetup is reset to false)
if (!instance.data.isEditorSetup) {
    // If a retry is pending (timer hasn't fired yet), wait for it
    if (instance.data._collabRetryPending) {
        instance.data.debug("collab retry pending — waiting for backoff timer before re-setup");
        return;
    }
    instance.data.setupEditor(properties, context);
}

/*
    PROPERTY CHANGE HANDLERS
    (run on every update after the editor is ready)
*/

if (!!instance.data.editor_is_ready && properties.isEditable != instance.data.editor.isEditable) {
    instance.data.debug("editable state changing to:", properties.isEditable);
    let isEditable = properties.isEditable;
    instance.data.editor.setEditable(isEditable);
}

if (
    instance.data.editor_is_ready &&
    properties.initialContent !== "" &&
    instance.data.initialContent !== properties.initialContent &&
    !properties.bubble.auto_binding()
) {
    instance.data.debug("initialContent has changed");

    if (!properties.collab_active) {
        instance.data.initialContent = properties.initialContent;
        let content = properties.content_is_json ? JSON.parse(instance.data.initialContent) : instance.data.initialContent;

        // Clear any pending debounce timeout before programmatic update
        instance.data.cancelPendingContent();

        // Save cursor position before setContent
        const { from, to } = instance.data.editor.state.selection;

        instance.data.editor.commands.setContent(content, { emitUpdate: true });

        // Restore cursor position (clamped to document bounds)
        const docSize = instance.data.editor.state.doc.content.size;
        const newFrom = Math.min(from, Math.max(1, docSize - 1));
        const newTo = Math.min(to, Math.max(1, docSize - 1));
        instance.data.editor.commands.setTextSelection({ from: newFrom, to: newTo });
        instance.data.refreshTableOfContents();
    } else {
        instance.data.debug("initialContent has changed but collaboration is active -- not updating content");
    }
}

if (instance.data.editor_is_ready && instance.data.delay !== properties.update_delay) {
    instance.data.debug("updating debounce delay from", instance.data.delay + "ms to", properties.update_delay + "ms");
    instance.data.delay = properties.update_delay;
}

if (instance.data.editor_is_ready && properties.bubble.auto_binding() && !properties.collab_active) {
    const recordId = properties.autobinding_record_id || "";
    const change = instance.data._autobindingSave.receive(recordId, properties.autobinding);
    const recordChanged = change === "record";
    instance.data._lastBoundContent = properties.autobinding;

    if (recordChanged || change === "external") {
        instance.data.cancelPendingContent();
        instance.data._boundRecordId = recordId;
        const editor = instance.data.editor;
        const { from, to } = editor.state.selection;
        instance.data.isProgrammaticUpdate = true;
        try {
            editor.chain().setMeta("addToHistory", false)
                .setContent(properties.autobinding || "", { emitUpdate: true }).run();
            const maxPosition = Math.max(1, editor.state.doc.content.size - 1);
            editor.commands.setTextSelection(recordChanged ? 1 : {
                from: Math.min(from, maxPosition), to: Math.min(to, maxPosition),
            });
        } finally {
            instance.data.isProgrammaticUpdate = false;
        }
        instance.data.refreshTableOfContents();
    }
}

if (!!instance.data.editor_is_ready) {
    if (!properties.bubble.fit_height()) {
        instance.canvas.css({ overflow: "scroll" });
    } else {
        instance.canvas.css({ overflow: "auto" });
    }
}

if (!!instance.data.editor_is_ready && !!properties.collab_active) {
    const collabUser = {
        name: properties.collab_user_name || "Anonymous",
        color: properties.collab_cursor_color || "#958DF1",
    };
    instance.data.debug("updating collab user:", collabUser.name, "color:", collabUser.color);
    instance.data.editor.commands.updateUser(collabUser);
}

instance.data.applyStylesheet(properties);