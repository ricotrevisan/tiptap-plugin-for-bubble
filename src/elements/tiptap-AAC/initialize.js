try {
    // Debug logging helper — only logs when debug_mode is enabled
    instance.data.debug = function (...args) {
        if (instance.data._debug_mode) {
            console.log("[Tiptap]", ...args);
        }
    };

    // add display: flex to main element
    instance.canvas.css("display", "flex");

    // this boolean turns true after the setup has been done, but the editor might not yet be initialized.
    // if the setup runs twice, it can add double initial data, etc.
    instance.data.isEditorSetup = false;

    // this boolean turns true when the editor is initialized and ready.
    instance.data.editor_is_ready = false;

    instance.data.emptyFindReplaceState = function () {
        return {
            searchTerm: "",
            replaceTerm: "",
            currentMatch: 0,
            matchCount: 0,
            caseSensitive: false,
            useRegex: false,
            wholeWord: false,
        };
    };

    instance.data.resetTableOfContentsState = function () {
        instance.data._tableOfContentsJSON = "[]";
        instance.publishState("table_of_contents", instance.data._tableOfContentsJSON);
    };

    instance.publishState("is_ready", false);
    instance.publishState("is_empty", true);
    instance.publishState("can_undo", false);
    instance.publishState("can_redo", false);
    instance.publishState("ai_editor_context", "");
    instance.publishState("find_replace_state", JSON.stringify(instance.data.emptyFindReplaceState()));
    instance.data.resetTableOfContentsState();
    instance.publishState("collab_status", "disconnected");
    instance.publishState("collab_synced", false);
    instance.publishState("collab_connected_users", 0);

    //    instance.canvas.cfss({'overflow':'scroll'});

    instance.data.stylesheet = document.createElement("style");
    instance.canvas.append(instance.data.stylesheet);

    // Reusable function to populate the editor stylesheet.
    // Called from update.js on every property change and from the collab retry path.
    instance.data.applyStylesheet = function (properties) {
        instance.data.stylesheet.innerHTML = `
#tiptapEditor-${instance.data.randomId} {

    .ProseMirror {

        h1 {
            font-size: ${properties.h1_size};
            color: ${properties.h1_color};
            margin: ${properties.h1_margin};
            font-weight: ${properties.h1_font_weight};
            ${properties.h1_adv}
        }

		h2 {
            font-size: ${properties.h2_size};
            color: ${properties.h2_color};
            margin: ${properties.h2_margin};
            font-weight: ${properties.h2_font_weight};
            ${properties.h2_adv}
		}

		h3 {
            font-size: ${properties.h3_size};
            color: ${properties.h3_color};
            margin: ${properties.h3_margin};
            font-weight: ${properties.h3_font_weight};
            ${properties.h3_adv}
        }

		h4 {
            font-size: ${properties.h4_size};
            color: ${properties.h4_color};
            margin: ${properties.h4_margin};
            font-weight: ${properties.h4_font_weight};
            ${properties.h4_adv}
        }

        h5 {
            font-size: ${properties.h5_size};
            color: ${properties.h5_color};
            margin: ${properties.h5_margin};
            font-weight: ${properties.h5_font_weight};
            ${properties.h5_adv}
        }

        h6 {
            font-size: ${properties.h6_size};
            color: ${properties.h6_color};
            margin: ${properties.h6_margin};
            font-weight: ${properties.h6_font_weight};
            ${properties.h6_adv}
        }

        p {
            font-size: ${properties.bubble.font_size()};
            color: ${properties.bubble.font_color()};
            font-family: ${properties.bubble.font_face().match(/^(.*?):/)[1]};
            margin: 1rem 0;
            font-weight: 400;
            ${properties.p_adv}
		}

        p.is-editor-empty:first-child::before {
            color: ${properties.placeholder_color || "#adb5bd"};
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
        }

        mark {
	        ${properties.mark_adv || ""}
        }

        a {
            text-decoration: underline;
            cursor: pointer;
            ${properties.link_adv}
        }

        a:link {
            color: ${properties.link_color};
            ${properties.link_unvisited_adv}
        }

        a:visited {
            color: ${properties.link_color_visited};
            ${properties.link_visited_adv}
        }

        a:focus {
	        ${properties.link_focus_adv}
        }

        a:hover {
            color: ${properties.link_color_hover};
            ${properties.link_hover_adv};
        }

	        a:active {
        }

        iframe {
	        ${properties.iframe}
        }

        img {
    	    ${properties.image_css}
        }

		blockquote {
        	${properties.blockquote_adv}
        }

        hr {
            ${properties.hr_adv || ""}
        }

        :not(pre) > code {
            ${properties.code_adv || ""}
        }

        pre {
            ${properties.codeblock_adv || ""}
        }

        sub {
            ${properties.sub_adv || ""}
        }

        sup {
            ${properties.sup_adv || ""}
        }

        [data-type="details"] {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 0.5rem;
            margin: 0.5rem 0;
            ${properties.details_adv || ""}
        }

        [data-type="details"] > button {
            cursor: pointer;
            font-weight: 600;
            padding: 0.25rem 0;
            background: none;
            border: none;
            font-size: 0.75rem;
        }

        [data-type="details"] > button::before {
            content: "►";
            display: inline-block;
            transition: transform 0.2s;
        }

        [data-type="details"].is-open > button::before {
            transform: rotate(90deg);
        }

        [data-type="details"] > div > [data-type="detailsSummary"] {
            display: inline;
            font-weight: 600;
            ${properties.details_summary_adv || ""}
        }

        [data-type="details"].is-open > div > [data-type="detailsContent"] {
            margin-top: 0.5rem;
        }

        .tiptap-invisible-character {
            ${properties.invisiblecharacters_adv || ""}
        }

		ul[data-type="taskList"] {
            list-style: none;
            padding: 0;
        }

		ul[data-type="taskList"] p {
        	margin: 0;
        }

		ul[data-type="taskList"] li {
        	display: flex;
        }

		ul[data-type="taskList"] li > label {
            flex: 0 0 auto;
            margin-right: 0.5rem;
            user-select: none;
        }

		ul[data-type="taskList"] li > div {
        	flex: 1 1 auto;
        }

        ul[data-type="taskList"] li > label input[type="checkbox"] {
            ${properties.tasklist_checkbox_adv || ""}
        }

		ul:not([data-type="taskList"]) {
        	${properties.ul_adv}
        }

		ol {
        	${properties.ol_adv}
        }

		table {
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            text-indent: 0;
        }
		th, td {
            padding: ${properties.table_th_td_padding};
            text-align: start;
            border-bottom: ${properties.table_th_td_border_bottom} ${properties.table_row_border_color};
        }

		th {
            font-weight: ${properties.table_th_font_weight};
            text-align: left;
            background: ${properties.table_th_background};
        }

		th * {
            color: ${properties.table_header_font_color};
            font-weight: ${properties.table_th_font_weight};
        }

		tr:nth-of-type(odd) {
        	background: ${properties.table_zebra_background};
        }

        .tiptap-drag-handle {
          align-items: center;
          background: white;
          border-radius: .25rem;
          border: 1px solid rgba(0, 0, 0, 0.1);
          cursor: grab;
          display: flex;
          height: 1.5rem;
          justify-content: center;
          width: 1.5rem;
          ${properties.draghandle_adv || ""}
        }

            ${properties.baseDiv || ""}

    }

    .ProseMirror .selection {
        background: #accef7;
        ${properties.ext_selection_css || ""}
    }

    .mention {
        border: 1px solid;
        border-color: ${properties.mention_border_color};
        background-color: ${properties.mention_background_color || "transparent"};
        border-radius: 0.4rem;
        padding: 0.1rem 0.3rem;
        box-decoration-break: clone;
    }

    .suggestions {
        border: 1px solid #ccc;
        background-color: white;
        padding: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border-radius: 4px;
        display: block;
        position: absolute;
        z-index: 1000;
    }

    .suggestion-item {
        padding: 8px 10px;
        cursor: pointer;
        list-style: none;
    }

    .suggestion-item:hover {
	    background-color: #eee;
    }

    .suggestion {
        background-color: black;
        color: white;
    }
}

.selectedCell:after {
    z-index: 2;
    position: absolute;
    content: "";
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(200, 200, 255, 0.4);
    pointer-events: none;
}

.column-resize-handle {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: -2px;
    width: 4px;
    background-color: #adf;
    pointer-events: none;
}

.tableWrapper {
    overflow-x: auto;
}

.resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
}

.collaboration-carets__caret {
    position: relative;
    margin-left: -1px;
    margin-right: -1px;
    border-left: 1px solid #0D0D0D;
    border-right: 1px solid #0D0D0D;
    word-break: normal;
    pointer-events: none;
}

.collaboration-carets__label {
    position: absolute;
    top: -1.4em;
    left: -1px;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    user-select: none;
    color: #0D0D0D;
    padding: 0.1rem 0.3rem;
    border-radius: 3px 3px 3px 0;
    white-space: nowrap;
    ${properties.collab_cursor_css || ""}
}

.items_${instance.data.randomId} {
    padding: 0.2rem;
    position: relative;
    border-radius: 0.5rem;
    background: #FFF;
    color: rgba(0, 0, 0, 0.8);
    overflow: hidden;
    font-size: 0.9rem;
    box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0px 10px 20px rgba(0, 0, 0, 0.1);

    .item {
        display: block;
        margin: 0;
        width: 100%;
        text-align: left;
        background: transparent;
        border-radius: 0.4rem;
        border: 1px solid transparent;
        padding: 0.2rem 0.4rem;

        &.is-selected {
        	border-color: #000;
        }
    }
}
`;
    };

    // function to find the nearest parent.
    // useful when Tiptap is used inside a repeating group
    function findElement(elementID) {
        let $parent = instance.canvas.parent();
        while ($parent.length > 0) {
            var $foundMenu = $parent.find("#" + elementID);

            if ($foundMenu.length > 0) {
                return $foundMenu[0];
            }

            $parent = $parent.parent();
        }
    }
    instance.data.findElement = findElement;

    instance.data.isProgrammaticUpdate = false;
    instance.data.delay = 300;

    instance.data.debounce = function debounce(cb, delay = instance.data.delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout); // Clear the existing timeout
            timeout = setTimeout(() => {
                cb(...args);
            }, instance.data.delay);
            instance.data.debounceTimeout = timeout; // Store the timeout ID
        };
    };

    instance.data.isDebouncingDone = true;
    instance.data.updateContent = instance.data.debounce((content) => {
        instance.data.debug("debounce done, updating content");
        instance.publishAutobinding(content);
        instance.triggerEvent("contentUpdated");
        instance.data.isDebouncingDone = true;
    }, instance.data.delay);

    // throttle function: to take it easy on the autobinding.
    // 1. writes to autobinding
    // 2. then waits a certain delay
    // 3. then writes again if the user created more changes
    // source: from https://blog.webdevsimplified.com/2022-03/debounce-vs-throttle

    function throttle(mainFunction, delay = 2000) {
        let timerFlag = null; // Variable to keep track of the timer

        // Returning a throttled version
        return (...args) => {
            if (timerFlag === null) {
                // If there is no timer currently running
                mainFunction(...args); // Execute the main function
                timerFlag = setTimeout(() => {
                    // Set a timer to clear the timerFlag after the specified delay
                    mainFunction(...args);
                    timerFlag = null; // Clear the timerFlag to allow the main function to be executed again
                }, delay);
            }
        };
    }
    instance.data.throttle = throttle;

    instance.data.throttledContentUpdated = instance.data.throttle(() => {
        instance.triggerEvent("contentUpdated");
        // console.log("getHTML", instance.data.editor.getHTML());
        instance.data.throttle(instance.publishAutobinding(instance.data.editor.getHTML()));
    });

    function returnAndReportErrorIfEditorNotReady(errorFragment = "error") {
        const message = "Tried to run " + errorFragment + " before editor was ready. Crash prevented. Returning";
        instance.data.debug(message);
        context.reportDebugger(message);
        return;
    }
    instance.data.returnAndReportErrorIfEditorNotReady = returnAndReportErrorIfEditorNotReady;

    function returnAndReportErrorIfExtensionNotActive(actionName, extensionName) {
        const message =
            "Tried to run '" + actionName + "' but the " + extensionName +
            " extension is not enabled. Enable it on the Tiptap element (Extensions > " +
            extensionName + ") first. Returning";
        instance.data.debug(message);
        context.reportDebugger(message);
        return;
    }
    instance.data.returnAndReportErrorIfExtensionNotActive = returnAndReportErrorIfExtensionNotActive;

    // Helper to set initial content on a new (empty) collab document.
    // Called from both the provider's onSynced and the editor's onCreate,
    // because either can fire first depending on network timing.
    instance.data.maybeSetCollabInitialContent = function () {
        if (!instance.data.collabHasSynced) return;
        if (!instance.data.editor_is_ready) return;
        if (!instance.data.collabInitialContent) return;
        if (instance.data.collabInitialContentSet) return;

        if (instance.data.editor.isEmpty) {
            instance.data.debug("collab document is empty after sync — setting initial content");
            instance.data.collabInitialContentSet = true;
            instance.data.editor.commands.setContent(instance.data.collabInitialContent);
        } else {
            instance.data.collabInitialContentSet = true; // prevent further checks
        }
    };

    // Helper to publish collab status as a state and fire the status changed event
    instance.data.publishCollabStatus = function (status) {
        instance.data.debug("collab status:", status);
        instance.publishState("collab_status", status);
        instance.triggerEvent("collab_status_changed");
    };

    // ── Collab auth-failure retry mechanism ──────────────────
    // When authentication fails (e.g. JWT not yet valid on server), tear down
    // the editor + provider and let the next update() cycle re-create everything.
    instance.data._collabRetryCount = 0;
    const COLLAB_MAX_RETRIES = 5;
    const COLLAB_RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // exponential backoff

    instance.data.teardownEditor = function (reason) {
        instance.data.debug("tearing down editor:", reason);

        // Clear the collab sync polling interval
        if (instance.data._collabSyncPollInterval) {
            clearInterval(instance.data._collabSyncPollInterval);
            instance.data._collabSyncPollInterval = null;
        }

        // Clear any pending collab retry timer
        if (instance.data._collabRetryTimer) {
            clearTimeout(instance.data._collabRetryTimer);
            instance.data._collabRetryTimer = null;
        }

        // Clear debounce timeout
        if (instance.data.debounceTimeout) {
            clearTimeout(instance.data.debounceTimeout);
            instance.data.debounceTimeout = null;
        }

        // Tear down provider (if in collab mode)
        if (instance.data.provider) {
            try {
                instance.data.provider.destroy();
            } catch (e) {
                instance.data.debug("error destroying provider:", e);
            }
            instance.data.provider = null;
        }

        // Tear down editor
        if (instance.data.editor) {
            try {
                instance.data.editor.destroy();
            } catch (e) {
                instance.data.debug("error destroying editor:", e);
            }
            instance.data.editor = null;
        }

        // Remove the editor DOM element so setupEditor can recreate it
        const editorEl = document.getElementById(instance.data.tiptapEditorID);
        if (editorEl) editorEl.remove();

        // Reset collab state
        instance.data.collabHasSynced = false;
        instance.data.collabInitialContentSet = false;
        instance.data._collabRetryCount = 0;
        instance.data._collabRetryPending = false;
        instance.data._currentCollabDocId = null;

        // Reset flags for re-initialization
        instance.data.isEditorSetup = false;
        instance.data.editor_is_ready = false;

        // Publish states - reset to initial values
        instance.publishState("is_ready", false);
        instance.publishState("is_empty", true);
        instance.publishState("can_undo", false);
        instance.publishState("can_redo", false);
        instance.publishState("ai_editor_context", "");
        instance.publishState("find_replace_state", JSON.stringify(instance.data.emptyFindReplaceState()));
        instance.data.resetTableOfContentsState();
        instance.publishState("collab_synced", false);
        instance.publishState("collab_connected_users", 0);
        instance.data.publishCollabStatus("disconnected");
    };

    instance.data.handleCollabAuthFailure = function (providerLabel, reason) {
        instance.data._collabRetryCount++;
        const attempt = instance.data._collabRetryCount;
        const message =
            providerLabel +
            " authentication failed (attempt " +
            attempt +
            "/" +
            COLLAB_MAX_RETRIES +
            "): " +
            reason;
        instance.data.debug(message);
        console.warn("[Tiptap]", message);

        if (attempt >= COLLAB_MAX_RETRIES) {
            const giveUpMsg =
                providerLabel +
                " authentication failed after " +
                COLLAB_MAX_RETRIES +
                " attempts. Giving up. Please check your JWT token configuration.";
            instance.data.debug(giveUpMsg);
            context.reportDebugger(giveUpMsg);
            return;
        }

        // Use shared teardown
        instance.data.teardownEditor("collab auth failure, attempt " + attempt);

        // Schedule a re-trigger after a backoff delay.
        // We call setupEditor directly because publishState does not trigger update() in Bubble.
        const delay = COLLAB_RETRY_DELAYS[attempt - 1] || COLLAB_RETRY_DELAYS[COLLAB_RETRY_DELAYS.length - 1];
        instance.data.debug("scheduling collab retry in " + delay + "ms");
        instance.data._collabRetryPending = true;
        instance.data._collabRetryTimer = setTimeout(() => {
            instance.data._collabRetryPending = false;
            instance.data.debug("collab retry timer fired — re-running setupEditor");
            instance.data.publishCollabStatus("retrying");
            if (instance.data._lastProperties && instance.data._lastContext) {
                instance.data.setupEditor(instance.data._lastProperties, instance.data._lastContext);
                instance.data.applyStylesheet(instance.data._lastProperties);
            }
        }, delay);
    };

    function getCollabUser(properties) {
        return {
            name: properties.collab_user_name || "Anonymous",
            color: properties.collab_cursor_color || "#958DF1",
        };
    }

    function maybeSetupCollaboration(instance, properties, options, extensions) {
        if (properties.collab_active === false) return;
        instance.data.debug("collaboration is active, provider:", properties.collabProvider);
        // Store initial content before removing — used to populate new (empty) collab documents
        instance.data.collabInitialContent = options.content;
        instance.data.collabHasSynced = false;
        instance.data.collabInitialContentSet = false;
        // removes initialContent -- normally a collab document will have some document in the cloud.
        delete options.content;

        if (!properties.collab_active) {
            instance.data.debug("collab is not active");
            return;
        }
        if (properties.collabProvider === "liveblocks") {
            setupLiveblocks(extensions, properties);
            return;
        }

        if (properties.collabProvider === "tiptap") {
            setupTiptapCloud(extensions, properties);
            return;
        }

        if (properties.collabProvider === "custom") {
            setupCustomHocuspocus(extensions, properties);
            return;
        }
    }
    instance.data.maybeSetupCollaboration = maybeSetupCollaboration;

    function setupCustomHocuspocus(extensions, properties) {
        instance.data.debug("setting up custom Hocuspocus collab");
        const { HocuspocusProvider, Collaboration, CollaborationCaret, Y } = window.tiptap;
        if (!properties.collab_url.endsWith("/")) {
            properties.collab_url += "/";
        }

        const custom_url = properties.collab_url + properties.collab_app_id;
        instance.data.debug("custom collab URL:", custom_url, "doc:", properties.collab_doc_id);
        try {
            instance.data.provider = new HocuspocusProvider({
                url: custom_url,
                name: properties.collab_doc_id,
                token: properties.collab_jwt,
                onStatus: ({ status }) => {
                    instance.data.publishCollabStatus(status);
                },
                onConnect() {
                    instance.data.publishCollabStatus("connected");
                },
                onAuthenticated() {
                    instance.data.debug("custom collab authenticated");
                    instance.data._collabRetryCount = 0; // reset on success
                },
                onAuthenticationFailed: ({ reason }) => {
                    instance.data.handleCollabAuthFailure("Custom collab", reason);
                },
                onSynced: () => {
                    instance.data.debug("custom collab synced");
                    instance.data.collabHasSynced = true;
                    instance.publishState("collab_synced", true);
                    instance.triggerEvent("collab_synced");
                    instance.data.maybeSetCollabInitialContent();
                },
                onDisconnect: () => {
                    instance.data.publishCollabStatus("disconnected");
                    instance.publishState("collab_synced", false);
                    instance.data.collabHasSynced = false;
                },
                onDestroy() {
                    instance.data.debug("custom collab destroyed");
                },
                onAwarenessChange: ({ states }) => {
                    instance.publishState("collab_connected_users", states.length);
                },
                onStateless: ({ payload }) => {
                    instance.data.debug("custom collab stateless message:", payload);
                },
            });

            // Also register synced handler via .on() as backup
            instance.data.provider.on("synced", () => {
                instance.data.collabHasSynced = true;
                instance.publishState("collab_synced", true);
                instance.data.maybeSetCollabInitialContent();
            });

            extensions.push(
                Collaboration.configure({
                    document: instance.data.provider.document,
                }),
                CollaborationCaret.configure({
                    provider: instance.data.provider,
                    user: getCollabUser(properties),
                }),
            );
            instance.data.debug("custom Hocuspocus provider created successfully");
        } catch (error) {
            const message = "Error setting up custom collab: ";
            context.reportDebugger(message + error);
            console.error("[Tiptap]", message, error);
        }
        return;
    }

    function setupTiptapCloud(extensions, properties) {
        instance.data.debug("setting up Tiptap Cloud collab");

        const { HocuspocusProvider, Collaboration, CollaborationCaret } = window.tiptap;
        const url = `wss://${properties.collab_app_id}.collab.tiptap.cloud`;
        instance.data.debug("Tiptap Cloud URL:", url, "doc:", properties.collab_doc_id);
        try {
            instance.data.provider = new HocuspocusProvider({
                url: url,
                name: properties.collab_doc_id,
                token: properties.collab_jwt,
                onConnect: () => {
                    instance.data.publishCollabStatus("connected");
                },
                onAuthenticated: () => {
                    instance.data.debug("Tiptap Cloud authenticated");
                    instance.data._collabRetryCount = 0; // reset on success
                },
                onAuthenticationFailed: ({ reason }) => {
                    instance.data.handleCollabAuthFailure("Tiptap Cloud", reason);
                },
                onStatus: ({ status }) => {
                    instance.data.publishCollabStatus(status);
                },
                onSynced: () => {
                    instance.data.debug("Tiptap Cloud synced");
                    instance.data.collabHasSynced = true;
                    instance.publishState("collab_synced", true);
                    instance.triggerEvent("collab_synced");
                    instance.data.maybeSetCollabInitialContent();
                },
                onDisconnect: () => {
                    instance.data.publishCollabStatus("disconnected");
                    instance.publishState("collab_synced", false);
                    instance.data.collabHasSynced = false;
                },
                onAwarenessChange: ({ states }) => {
                    instance.publishState("collab_connected_users", states.length);
                },
            });

            // Also register synced handler via .on() as backup
            instance.data.provider.on("synced", () => {
                instance.data.collabHasSynced = true;
                instance.publishState("collab_synced", true);
                instance.data.maybeSetCollabInitialContent();
            });

            instance.data.debug("Tiptap Cloud provider created successfully");
        } catch (error) {
            const message = "Error setting up Tiptap Cloud collab: ";
            context.reportDebugger(message + error);
            console.error("[Tiptap]", message, error);
        }

        extensions.push(
            Collaboration.configure({
                document: instance.data.provider.document,
            }),
            CollaborationCaret.configure({
                provider: instance.data.provider,
                user: getCollabUser(properties),
            }),
        );

        return;
    }

    function setupLiveblocks(extensions, properties) {
        instance.data.debug("setting up collab with Liveblocks");
        if (!properties.liveblocksPublicApiKey) {
            context.reportDebugger("Liveblocks is selected but there's no plublic API key");
            return;
        }

        const { createClient, LiveblocksProvider, Collaboration, CollaborationCaret, Y } = window.tiptap;

        try {
            const client = createClient({
                publicApiKey: properties.liveblocksPublicApiKey,
            });

            const { room, leave } = client.enterRoom(properties.collab_doc_id, {
                initialPresence: {},
            });

            const yDoc = new Y.Doc();
            const Text = yDoc.getText("tiptap");
            const Provider = new LiveblocksProvider(room, yDoc);

            extensions.push(
                Collaboration.configure({
                    document: yDoc,
                }),
                CollaborationCaret.configure({
                    provider: Provider,
                    user: getCollabUser(properties),
                }),
            );
        } catch (error) {
            context.reportDebugger("There was an error setting up Liveblocks. " + error);
        }

        return extensions;
    }
    instance.data.setupLiveblocks = setupLiveblocks;
} catch (error) {
    console.error("[Tiptap] error in initialize:", error);
}

// MentionList
instance.data.MentionList = class MentionList {
    constructor(stuff) {
        const { props, editor } = stuff;
        this.items = props.items;
        this.command = props.command;
        this.selectedIndex = 0;
        this.randomId = props.randomId;
        this.editor = editor;
        this.initElement();
        this.updateItems(this);
    }

    initElement() {
        this.element = document.createElement("div");
        this.element.className = "items_" + this.randomId;

        this.element.addEventListener("click", this.handleClick.bind(this));
        this.element.addEventListener("keydown", this.handleKeyDown.bind(this));
    }

    handleClick(event) {
        const target = event.target.closest(".item");
        const index = Array.from(this.element.children).indexOf(target);
        if (index !== -1) {
            this.selectItem(index);
            this.updateSelection(index);
        }
    }

    updateItems(props) {
        this.items = props.items;
        this.selectedIndex = 0;
        this.redraw();
    }

    updateProps(props) {
        this.range = props.range;
        this.editor = props.editor;
    }

    redraw() {
        this.element.innerHTML = "";
        const fragment = document.createDocumentFragment();

        this.items.forEach((item, index) => {
            const button = document.createElement("button");
            button.textContent = item.label;
            button.className = "item" + (index === this.selectedIndex ? " is-selected" : "");
            fragment.appendChild(button);
        });

        this.element.appendChild(fragment);
    }

    selectItem(index) {
        const item = this.items[index];
        const editor = this.editor;
        const range = this.range;

        if (item && range) {
            editor.commands.insertContentAt(range, {
                type: "mention",
                attrs: {
                    label: item.label,
                    id: item.id,
                },
            });
            editor.commands.insertContent(" ");
            editor.commands.setTextSelection(range.from + 1);
        } else {
            this.command(item);
        }
    }

    updateSelection(index) {
        const previouslySelected = this.element.querySelector(".is-selected");
        if (previouslySelected) previouslySelected.classList.remove("is-selected");

        const newSelected = this.element.children[index];
        if (newSelected) newSelected.classList.add("is-selected");

        this.selectedIndex = index;
    }

    handleKeyDown(event) {
        switch (event.key) {
            case "ArrowUp":
                this.moveSelection(-1);
                event.preventDefault();
                break;
            case "ArrowDown":
                this.moveSelection(1);
                event.preventDefault();
                break;
            case "Enter":
                this.selectItem(this.selectedIndex);
                event.preventDefault();
                break;
            case "Tab":
                this.selectItem(this.selectedIndex);
                event.preventDefault();
                break;
        }
    }

    moveSelection(direction) {
        const itemLength = this.items.length;
        const newIndex = (this.selectedIndex + direction + itemLength) % itemLength;
        this.updateSelection(newIndex);
        this.redraw();
    }
};

function configureSuggestion(instance, properties) {
    return {
        char: properties.mention_triggerChar || "@",
        items: ({ query }) => {
            if (typeof query !== "string") {
                // console.log("thing passed to Mention is not a string, returning. Typeof query: ", typeof query);
                return [];
            }
            const length = properties.mention_list.length();
            const source_list = properties.mention_list.get(0, length);
            const mention_list = source_list.map((item) => {
                return {
                    label: item.get(properties.mention_field_label),
                    id: item.get(properties.mention_field_id),
                };
            });
            // console.log("mention_list", mention_list);
            const query_result = mention_list.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

            return query_result;
        },

        render: () => {
            let popup, component;

            return {
                onStart: (props) => {
                    props.randomId = instance.data.randomId;
                    component = new instance.data.MentionList({
                        props,
                        editor: props.editor,
                    });
                    popup = window.tiptap.tippy("body", {
                        getReferenceClientRect: props.clientRect,
                        appendTo: () => document.body,
                        content: component.element,
                        showOnCreate: true,
                        interactive: true,
                        trigger: "manual",
                        placement: "bottom-start",
                    });
                },

                onUpdate: (props) => {
                    if (!props.clientRect) {
                        return;
                    }

                    component.updateProps(props);

                    popup[0].setProps({
                        getReferenceClientRect: props.clientRect,
                    });

                    const newItems = component.updateItems(props);
                    popup[0].setContent(newItems);
                },

                onKeyDown: ({ event, editor }) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        component.selectItem(component.selectedIndex);
                        return true;
                    }

                    return component.handleKeyDown(event);
                },

                onExit: () => {
                    popup[0].destroy();
                    component.element.remove();
                },
            };
        },
    };
}
instance.data.configureSuggestion = configureSuggestion;

instance.data.rgbToHex = function (colorString) {
    instance.data.debug("rgbToHex", colorString);

    // Regular expressions for RGB and RGBA
    const rgbRegex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
    const rgbaRegex = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/;

    let match = colorString.match(rgbRegex) || colorString.match(rgbaRegex);

    if (!match) {
        console.error('Invalid color string format. Expected "rgb(r, g, b)" or "rgba(r, g, b, a)"');
        return null;
    }

    // Convert the extracted values to integers
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    // Handle alpha if present (for RGBA)
    let a = match[4] ? parseFloat(match[4]) : 1;

    // Ensure the values are within the valid range
    const clamp = (val) => Math.min(255, Math.max(0, val));

    // Convert to hex and pad with zeros if necessary
    const toHex = (val) => clamp(val).toString(16).padStart(2, "0");

    // Combine the hex values
    let hex = "#" + toHex(r) + toHex(g) + toHex(b);

    // Add alpha to hex if it's less than 1
    if (a < 1) {
        const alpha = Math.round(a * 255)
            .toString(16)
            .padStart(2, "0");
        hex += alpha;
    }

    return hex;
};

// Publish the Find & Replace extension storage as one JSON state so Bubble
// workflows can render their own search UI without reaching into the editor.
function publishFindReplaceState(editor) {
    const storage = editor.storage.findAndReplace;
    const state = storage
        ? {
            searchTerm: storage.searchTerm,
            replaceTerm: storage.replaceTerm,
            currentMatch: storage.currentIndex === null ? 0 : storage.currentIndex + 1,
            matchCount: storage.results.length,
            caseSensitive: storage.caseSensitive,
            useRegex: storage.useRegex,
            wholeWord: storage.wholeWord,
        }
        : instance.data.emptyFindReplaceState();

    instance.publishState("find_replace_state", JSON.stringify(state));
}
instance.data.publishFindReplaceState = publishFindReplaceState;

// Publish only the serializable Table of Contents fields. Tiptap's storage also
// contains Editor, ProseMirror Node, and HTMLElement references that cannot be
// exposed through a Bubble text state.
function publishTableOfContentsState(editor, anchors, forceEvent = false) {
    const content = anchors || editor.storage.tableOfContents?.content || [];
    const state = content.map((anchor) => ({
        id: anchor.id,
        textContent: anchor.textContent,
        level: anchor.level,
        originalLevel: anchor.originalLevel,
        itemIndex: anchor.itemIndex,
        pos: anchor.pos,
        isActive: anchor.isActive,
        isScrolledOver: anchor.isScrolledOver,
    }));
    const json = JSON.stringify(state);
    const changed = json !== instance.data._tableOfContentsJSON;

    if (changed) {
        instance.data._tableOfContentsJSON = json;
        instance.publishState("table_of_contents", json);
    }
    if ((changed || forceEvent) && instance.data.editor_is_ready) {
        instance.triggerEvent("table_of_contents_updated");
    }
}
instance.data.publishTableOfContentsState = publishTableOfContentsState;

function scrollToTableOfContentsHeading(headingId, options) {
    const headings = instance.data.editor.storage.tableOfContents?.content || [];
    const heading = headings.find((item) => item.id === headingId);

    if (!heading) return false;
    heading.dom.scrollIntoView(options);
    return true;
}
instance.data.scrollToTableOfContentsHeading = scrollToTableOfContentsHeading;

// Publish all formatting-related active states for the current cursor/selection.
// Called from both onTransaction and onSelectionUpdate to avoid duplication.
function publishActiveStates(editor) {
    instance.publishState("bold", editor.isActive("bold"));
    instance.publishState("italic", editor.isActive("italic"));
    instance.publishState("strike", editor.isActive("strike"));
    instance.publishState("h1", editor.isActive("heading", { level: 1 }));
    instance.publishState("h2", editor.isActive("heading", { level: 2 }));
    instance.publishState("h3", editor.isActive("heading", { level: 3 }));
    instance.publishState("h4", editor.isActive("heading", { level: 4 }));
    instance.publishState("h5", editor.isActive("heading", { level: 5 }));
    instance.publishState("h6", editor.isActive("heading", { level: 6 }));
    instance.publishState("body", !editor.isActive("heading"));
    instance.publishState("orderedList", editor.isActive("orderedList"));
    instance.publishState("bulletList", editor.isActive("bulletList"));
    instance.publishState("sinkListItem", editor.can().sinkListItem("listItem"));
    instance.publishState("liftListItem", editor.can().liftListItem("listItem"));
    instance.publishState("blockquote", editor.isActive("blockquote"));
    instance.publishState("codeBlock", editor.isActive("codeBlock"));
    instance.publishState("taskList", editor.isActive("taskList"));
    instance.publishState("taskItem", editor.isActive("taskItem"));
    instance.publishState("link", editor.isActive("link"));
    instance.publishState("url", editor.getAttributes("link").href);
    instance.publishState("align_left", editor.isActive({ textAlign: "left" }));
    instance.publishState("align_center", editor.isActive({ textAlign: "center" }));
    instance.publishState("align_right", editor.isActive({ textAlign: "right" }));
    instance.publishState("align_justified", editor.isActive({ textAlign: "justify" }));
    instance.publishState("highlight", editor.isActive("highlight"));
    instance.publishState("underline", editor.isActive("underline"));
    instance.publishState("table", editor.isActive("table"));
    instance.publishState("subscript", editor.isActive("subscript"));
    instance.publishState("superscript", editor.isActive("superscript"));
    instance.publishState("details", editor.isActive("details"));

    const textStyle = editor.getAttributes("textStyle");
    if (textStyle && textStyle.color) {
        const color = textStyle.color;
        try {
            const hexColor = instance.data.rgbToHex(color);
            instance.data.textStyleColor = hexColor;
        } catch (error) {
            console.warn(`Failed to convert color to hex: ${color}`, error);
            instance.data.textStyleColor = color; // Fallback to original color value
        }
    } else {
        instance.data.textStyleColor = "";
    }
    instance.publishState("color", instance.data.textStyleColor);

    const publishTextStyleAttr = (attr, stateName) => {
        instance.publishState(stateName, textStyle && textStyle[attr] ? textStyle[attr] : "");
    };
    publishTextStyleAttr("fontFamily", "font_family");
    publishTextStyleAttr("fontSize", "font_size");
    publishTextStyleAttr("lineHeight", "line_height");
    publishTextStyleAttr("backgroundColor", "background_color");
}
instance.data.publishActiveStates = publishActiveStates;

function findParentBlock(state, pos) {
    const $pos = state.doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth--) {
        const node = $pos.node(depth);
        if (node.type.isBlock) {
            return { node, pos: $pos.before(depth), depth };
        }
    }
    return null;
}
instance.data.findParentBlock = findParentBlock;

function getSelection(editor) {
    const { state, view } = editor;
    const { from, to } = view.state.selection;
    const text = state.doc.textBetween(from, to, "");
    instance.publishState("selected_text", text);
    instance.publishState("from", from);
    instance.publishState("to", to);

    if (from === to) {
        // No selection, clear states
        instance.publishState("selectedContent", null);
        instance.publishState("selectedHTML", null);
        instance.publishState("selectedJSON", null);
        return;
    }

    try {
        const $from = state.doc.resolve(from);
        const $to = state.doc.resolve(to);
        let parentNode = $from.parent;
        let parentNodeType = parentNode.type.name;

        // Map ProseMirror node types to HTML tags
        const nodeTypeToHtmlTag = {
            paragraph: "p",
            heading: "h" + (parentNode.attrs.level || "1"), // h1, h2, etc.
            bulletList: "ul",
            orderedList: "ol",
            listItem: "li",
            blockquote: "blockquote",
            codeBlock: "pre",
            horizontalRule: "hr",
            table: "table",
            tableRow: "tr",
            tableCell: "td",
            tableHeader: "th",
        };

        const selectedNode = state.doc.slice(from, to);
        const selectedJSON = selectedNode.toJSON();
        const content = selectedJSON.content;

        // Use the same extensions the editor was built with
        const extensions = instance.data.editorExtensions;

        // Generate HTML from the JSON using the utility function
        let selectedHTML = window.tiptap.generateHTML({ type: "doc", content: content }, extensions);

        // If the selection is just text, wrap it with the appropriate HTML tag
        if (content.length === 1 && content[0].type === "text") {
            const htmlTag = nodeTypeToHtmlTag[parentNodeType] || "p";
            selectedHTML = `<${htmlTag}>${selectedHTML}</${htmlTag}>`;
        }

        instance.publishState("selectedContent", text);
        instance.publishState("selectedHTML", selectedHTML);
        instance.publishState("selectedJSON", JSON.stringify(selectedJSON));
    } catch (error) {
        console.error("Error generating JSON or HTML:", error);
    }
}
instance.data.getSelection = getSelection;

// ─────────────────────────────────────────────────────────────
// setupEditor — called once from update.js on first property load
// ─────────────────────────────────────────────────────────────
instance.data.setupEditor = function (properties, context) {
    instance.data.debug("starting editor setup");

    let initialContent = properties.bubble.auto_binding() ? properties.autobinding : properties.initialContent;

    // A runtime AI Toolkit toggle tears down the editor and rebuilds it with a
    // new schema. Rebuilding must not reset an unsaved local document back to
    // this element's initialContent property. Prefer the preserved snapshot.
    if (instance.data._pendingRebuildContent) {
        instance.data.initialContent = instance.data._pendingRebuildInitialContent ?? initialContent;
        content = instance.data._pendingRebuildContent;
        instance.data._pendingRebuildContent = null;
        instance.data._pendingRebuildInitialContent = null;
    } else {
        instance.data.initialContent = initialContent;
        content = properties.content_is_json ? JSON.parse(initialContent) : initialContent;
    }

    let placeholder = properties.placeholder;
    let bubbleMenu = properties.bubbleMenu;
    let floatingMenu = properties.floatingMenu;

    let preserveWhitespace =
        properties.parseOptions_preserveWhitespace === "true" ? true : properties.parseOptions_preserveWhitespace === "false" ? false : "full";

    // create the editor div
    const randomId = (Math.random() + 1).toString(36).substring(3);
    instance.data.randomId = randomId;
    var d = document.createElement("div");
    d.id = "tiptapEditor-" + randomId;
    d.style = "flex-grow: 1; display: flex;";
    instance.data.tiptapEditorID = d.id;
    instance.canvas.append(d);

    // pull libraries from window.tiptap
    const {
        Editor,
        Node,
        Extension,
        mergeAttributes,
        Document,
        HardBreak,
        Paragraph,
        Text,
        Bold,
        Italic,
        Strike,
        Underline,
        Code,
        Heading,
        Blockquote,
        CodeBlock,
        HorizontalRule,
        BulletList,
        OrderedList,
        ListItem,
        TaskList,
        TaskItem,
        FontFamily,
        Color,
        TextStyle,
        LineHeight,
        BackgroundColor,
        TextAlign,
        Highlight,
        Image,
        Resizable,
        Link,
        Youtube,
        Table,
        TableRow,
        TableHeader,
        TableCell,
        Mention,
        CharacterCount,
        Dropcursor,
        Gapcursor,
        UndoRedo,
        Placeholder,
        TrailingNode,
        Focus,
        Selection,
        BubbleMenu,
        FloatingMenu,
        FileHandler,
        UniqueID,
        Subscript,
        Superscript,
        Typography,
        ListKeymap,
        FontSize,
        Details,
        DetailsContent,
        DetailsSummary,
        InvisibleCharacters,
        DragHandle,
        FindAndReplace,
        TableOfContents,
        ServerAiToolkit,
        getEditorContext,
    } = window.tiptap;

    // Store extension states for action files to reference
    instance.data.ext = {
        bold: properties.ext_bold,
        italic: properties.ext_italic,
        strike: properties.ext_strike,
        underline: properties.ext_underline,
        code: properties.ext_code,
        highlight: properties.ext_highlight,
        fontfamily: properties.ext_fontfamily,
        color: properties.ext_color,
        lineheight: properties.ext_lineheight,
        backgroundcolor: properties.ext_backgroundcolor,
        heading: properties.ext_heading,
        blockquote: properties.ext_blockquote,
        horizontalrule: properties.ext_horizontalrule,
        codeblock: properties.ext_codeblock,
        bulletlist: properties.ext_bulletlist,
        orderedlist: properties.ext_orderedlist,
        tasklist: properties.ext_tasklist,
        image: properties.ext_image,
        youtube: properties.ext_youtube,
        link: properties.ext_link,
        table: properties.ext_table,
        bubblemenu: properties.ext_bubblemenu,
        floatingmenu: properties.ext_floatingmenu,
        placeholder: properties.ext_placeholder,
        textalign: properties.ext_textalign,
        dropcursor: properties.ext_dropcursor,
        gapcursor: properties.ext_gapcursor,
        history: properties.ext_history,
        hardbreak: properties.ext_hardbreak,
        mention: properties.ext_mention,
        uniqueid: properties.ext_uniqueid,
        subscript: properties.ext_subscript,
        superscript: properties.ext_superscript,
        fontsize: properties.ext_fontsize,
        details: properties.ext_details,
        invisiblecharacters: properties.ext_invisiblecharacters,
        draghandle: properties.ext_draghandle,
        findreplace: properties.ext_find_replace,
        tableofcontents: properties.ext_table_of_contents,
    };

    // parse heading levels
    instance.data.headings = [];
    if (properties.ext_heading) {
        properties.headings.split(",").map((item) => {
            instance.data.headings.push(parseInt(item));
        });
    }

    // ── Build extensions ─────────────────────────────────────

    const extensions = [
        Document,
        Paragraph,
        Text,
        ListItem,
        TextStyle,
        CharacterCount.configure({
            limit: properties.characterLimit || null,
        }),
    ];

    if (properties.ext_uniqueid) {
        if (!properties.extension_uniqueid_types) {
            context.reportDebugger("UniqueID extension is active but the types are empty. You could target `paragraph, heading`, for example.");
            return;
        }
        let unique_id_types = properties.extension_uniqueid_types.split(",").map((item) => {
            return item.trim();
        });

        if (unique_id_types.length === 0) {
            context.reportDebugger(
                "UniqueID extension is active but there are no types for it to target. You could target `paragraph, heading`, for example.",
            );
            return;
        }

        let attributeName = properties.extension_uniqueid_attrName || "id";
        instance.data.debug("UniqueID attributeName:", attributeName);

        extensions.push(
            UniqueID.configure({
                types: unique_id_types,
                attributeName: attributeName,
            }),
        );
    }

    // ── Extension toggles (each controlled by its own yes/no property) ──

    if (properties.ext_dropcursor) {
        const dropcursorConfig = {};
        if (properties.dropcursor_color) dropcursorConfig.color = properties.dropcursor_color;
        if (properties.dropcursor_width) dropcursorConfig.width = properties.dropcursor_width;
        extensions.push(Dropcursor.configure(dropcursorConfig));
    }
    if (properties.ext_gapcursor) extensions.push(Gapcursor);
    if (properties.ext_trailingnode) extensions.push(TrailingNode);
    if (properties.ext_focus) extensions.push(Focus.configure({ className: "has-focus", mode: properties.ext_focus_mode || "deepest" }));
    if (properties.ext_selection) extensions.push(Selection);
    if (properties.ext_ai_toolkit) extensions.push(ServerAiToolkit);
    if (properties.ext_find_replace) {
        extensions.push(FindAndReplace.configure({ searchDebounceMs: 0 }));
    }
    if (properties.ext_table_of_contents) {
        const canvas = instance.canvas[0] || instance.canvas.get?.(0);
        let tableOfContentsScrollParent = window;
        if (canvas && !properties.bubble.fit_height()) {
            tableOfContentsScrollParent = canvas;
        } else {
            for (let element = canvas?.parentElement; element; element = element.parentElement) {
                if (element === document.body || element === document.documentElement) {
                    break;
                }
                const overflowY = window.getComputedStyle(element).overflowY;
                if (/^(auto|scroll|overlay)$/.test(overflowY)) {
                    tableOfContentsScrollParent = element;
                    break;
                }
            }
        }
        extensions.push(TableOfContents.configure({
            scrollParent: () => tableOfContentsScrollParent,
            onUpdate: (anchors) => instance.data.publishTableOfContentsState(instance.data.editor, anchors),
        }));
    }
    if (properties.ext_hardbreak) {
        extensions.push(HardBreak.configure({ keepMarks: properties.hardBreakKeepMarks }));
    }
    if (properties.ext_history && !properties.collab_active) extensions.push(UndoRedo);
    if (properties.ext_bold) extensions.push(Bold);
    if (properties.ext_italic) extensions.push(Italic);
    if (properties.ext_strike) extensions.push(Strike);
    if (properties.ext_fontfamily) extensions.push(FontFamily);
    if (properties.ext_color) extensions.push(Color);
    if (properties.ext_lineheight) extensions.push(LineHeight);
    if (properties.ext_backgroundcolor) extensions.push(BackgroundColor);
    if (properties.ext_heading) extensions.push(Heading.configure({ levels: instance.data.headings }));
    if (properties.ext_bulletlist) extensions.push(BulletList.configure({
        keepMarks: properties.list_keepMarks || false,
        keepAttributes: properties.list_keepAttributes || false,
    }));
    if (properties.ext_orderedlist) extensions.push(OrderedList.configure({
        keepMarks: properties.list_keepMarks || false,
        keepAttributes: properties.list_keepAttributes || false,
    }));
    if (properties.ext_tasklist) extensions.push(TaskList, TaskItem.configure({ nested: true }));

    if (properties.ext_mention) {
        if (!properties.mention_list) {
            instance.data.debug("tried to use Mention extension, but mention_list is empty. Mention extension not loaded");
        } else {
            const suggestion_config = instance.data.configureSuggestion(instance, properties);
            extensions.push(
                Mention.configure({
                    HTMLAttributes: {
                        class: "mention",
                    },
                    renderHTML({ options, node }) {
                        return [
                            "a",
                            mergeAttributes({ href: `${properties.mention_base_url}${node.attrs.id}` }, options.HTMLAttributes),
                            `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
                        ];
                    },
                    deleteTriggerWithBackspace: true,
                    suggestion: suggestion_config,
                }),
            );
        }
    }

    if (properties.ext_highlight) extensions.push(Highlight.configure({ multicolor: properties.highlight_multicolor !== false }));
    if (properties.ext_underline) extensions.push(Underline);
    if (properties.ext_codeblock) extensions.push(CodeBlock.configure({
        exitOnTripleEnter: properties.codeblock_exitOnTripleEnter !== false,
        exitOnArrowDown: properties.codeblock_exitOnArrowDown !== false,
        defaultLanguage: properties.codeblock_defaultLanguage || null,
        enableTabIndentation: properties.codeblock_tabIndentation || false,
        tabSize: properties.codeblock_tabSize || 4,
    }));
    if (properties.ext_code) extensions.push(Code);
    if (properties.ext_blockquote) extensions.push(Blockquote);
    if (properties.ext_horizontalrule) extensions.push(HorizontalRule);
    if (properties.ext_youtube) extensions.push(Youtube.configure({
        nocookie: properties.youtube_nocookie !== false,
        allowFullscreen: properties.youtube_allowFullscreen !== false,
        addPasteHandler: properties.youtube_addPasteHandler !== false,
        width: properties.youtube_defaultWidth || 640,
        height: properties.youtube_defaultHeight || 480,
    }));
    if (properties.ext_table) {
        const tableResizable = properties.table_resizable !== false;
        extensions.push(
            Table.configure({
                resizable: tableResizable,
                handleWidth: properties.table_handleWidth || 5,
                cellMinWidth: properties.table_cellMinWidth || 25,
                lastColumnResizable: properties.table_lastColumnResizable !== false,
                allowTableNodeSelection: properties.table_allowNodeSelection || false,
            }),
            TableRow, TableHeader, TableCell
        );
    }
    if (properties.ext_image) {
        extensions.push(Image.configure({ inline: properties.image_inline || false, allowBase64: properties.allowBase64 }), Resizable);
    }
    if (properties.ext_link) {
        const linkConfig = {
            openOnClick: properties.link_openOnClick || false,
            autolink: properties.link_autolink !== false,
            linkOnPaste: properties.link_linkOnPaste !== false,
            defaultProtocol: properties.link_defaultProtocol || "https",
            HTMLAttributes: {},
        };
        if (properties.link_target) {
            linkConfig.HTMLAttributes.target = properties.link_target;
        }
        if (properties.link_rel) {
            linkConfig.HTMLAttributes.rel = properties.link_rel;
        }
        if (properties.link_protocols) {
            const protocols = properties.link_protocols.split(",").map(p => p.trim()).filter(Boolean)
                .map(p => ({ scheme: p, optionalSlashes: true }));
            if (protocols.length > 0) linkConfig.protocols = protocols;
        }
        extensions.push(Link.configure(linkConfig));
    }
    if (properties.ext_placeholder) extensions.push(Placeholder.configure({
        placeholder: placeholder,
        showOnlyWhenEditable: properties.placeholder_showOnlyWhenEditable !== false,
        showOnlyCurrent: properties.placeholder_showOnlyCurrent !== false,
        includeChildren: properties.placeholder_includeChildren || false,
    }));
    if (properties.ext_textalign) extensions.push(TextAlign.configure({ types: ["heading", "paragraph"] }));

    // ── Phase 2 extensions ───────────────────────────────────

    if (properties.ext_subscript) extensions.push(Subscript);
    if (properties.ext_superscript) extensions.push(Superscript);
    if (properties.ext_fontsize) extensions.push(FontSize);
    if (properties.ext_typography) extensions.push(Typography);
    if (properties.ext_listkeymap) extensions.push(ListKeymap);
    if (properties.ext_details) {
        extensions.push(
            Details.configure({ persist: properties.details_persist || false }),
            DetailsContent,
            DetailsSummary,
        );
    }
    if (properties.ext_invisiblecharacters) {
        extensions.push(InvisibleCharacters.configure({
            visible: properties.invisiblecharacters_visible !== false,
        }));
    }
    if (properties.ext_draghandle) {
        const dragHandleConfig = {
            render() {
                const el = document.createElement("div");
                el.classList.add("tiptap-drag-handle");
                el.innerHTML = "⠿";
                return el;
            },
        };

        if (properties.draghandle_nested) {
            dragHandleConfig.nested = true;
        }

        extensions.push(DragHandle.configure(dragHandleConfig));
    }

    // ── PreserveAttributes extension ─────────────────────────

    const PreserveAttributes = Extension.create({
        name: "preserveAttributes",

        addGlobalAttributes() {
            return [
                {
                    // Apply to all block nodes
                    types: ["paragraph", "heading", "blockquote", "codeBlock", "listItem", "table", "tableRow", "tableCell", "tableHeader"],
                    attributes: {
                        class: {
                            default: null,
                            parseHTML: (element) => element.getAttribute("class"),
                            renderHTML: (attributes) => {
                                if (!attributes.class) return {};
                                return { class: attributes.class };
                            },
                        },
                        style: {
                            default: null,
                            parseHTML: (element) => element.getAttribute("style"),
                            renderHTML: (attributes) => {
                                if (!attributes.style) return {};
                                return { style: attributes.style };
                            },
                        },
                        id: {
                            default: null,
                            parseHTML: (element) => element.getAttribute("id"),
                            renderHTML: (attributes) => {
                                if (!attributes.id) return {};
                                return { id: attributes.id };
                            },
                        },
                        "data-attributes": {
                            default: null,
                            parseHTML: (element) => {
                                const dataAttrs = {};
                                Array.from(element.attributes).forEach((attr) => {
                                    if (attr.name.startsWith("data-")) {
                                        dataAttrs[attr.name] = attr.value;
                                    }
                                });
                                return Object.keys(dataAttrs).length ? dataAttrs : null;
                            },
                            renderHTML: (attributes) => {
                                if (!attributes["data-attributes"]) return {};
                                return attributes["data-attributes"];
                            },
                        },
                    },
                },
                {
                    // Apply to inline marks
                    types: ["bold", "italic", "strike", "code", "link"],
                    attributes: {
                        class: {
                            default: null,
                            parseHTML: (element) => element.getAttribute("class"),
                            renderHTML: (attributes) => {
                                if (!attributes.class) return {};
                                return { class: attributes.class };
                            },
                        },
                        style: {
                            default: null,
                            parseHTML: (element) => element.getAttribute("style"),
                            renderHTML: (attributes) => {
                                if (!attributes.style) return {};
                                return { style: attributes.style };
                            },
                        },
                    },
                },
            ];
        },
    });

    // ── CustomDiv extension ──────────────────────────────────

    const CustomDivExtension = Node.create({
        name: "customDiv",
        group: "block",
        content: "block*",
        defining: true,

        addAttributes() {
            return {
                class: {
                    default: null,
                    parseHTML: (element) => element.getAttribute("class"),
                },
                style: {
                    default: null,
                    parseHTML: (element) => element.getAttribute("style"),
                },
                id: {
                    default: null,
                    parseHTML: (element) => element.getAttribute("id"),
                },
                "data-attributes": {
                    default: null,
                    parseHTML: (element) => {
                        const dataAttrs = {};
                        Array.from(element.attributes).forEach((attr) => {
                            if (attr.name.startsWith("data-")) {
                                dataAttrs[attr.name] = attr.value;
                            }
                        });
                        return Object.keys(dataAttrs).length ? dataAttrs : null;
                    },
                },
            };
        },

        parseHTML() {
            return [{ tag: "div" }];
        },

        renderHTML({ node, HTMLAttributes }) {
            const attrs = { ...node.attrs };

            // Merge data attributes
            if (attrs["data-attributes"]) {
                Object.assign(attrs, attrs["data-attributes"]);
                delete attrs["data-attributes"];
            }

            // Remove null/undefined attributes
            Object.keys(attrs).forEach((key) => {
                if (attrs[key] === null || attrs[key] === undefined) {
                    delete attrs[key];
                }
            });

            return ["div", { ...attrs, ...HTMLAttributes }, 0];
        },
    });

    if (properties.preserve_attributes) {
        extensions.push(PreserveAttributes);

        if (properties.preserve_unknown_tags) {
            // Add custom div support
            extensions.push(CustomDivExtension);
        }
    }

    // ── File upload handling ─────────────────────────────────

    function handleUpload(file, editor, pos) {
        const attachFilesTo = properties.attachFilesTo || null;
        return new Promise((resolve, reject) => {
            if (!instance.canUploadFile(file)) {
                const message = "Not allowed to upload this file";
                context.reportDebugger(message);
                instance.publishState("fileUploadErrorMessage", message);
                reject(new Error(message));
                return;
            }
            if (!properties.attachFilesTo) {
                context.reportDebugger(
                    "Uploading a file, but there's no object to attach to. This file could be accessible by anyone. Consider the privacy implications.",
                );
            }

            instance.publishState("fileUploadProgress", 0);
            const uploadedFile = instance.uploadFile(
                file,
                (err, url) => {
                    if (err) {
                        context.reportDebugger(err.message);
                        instance.publishState("fileUploadErrorMessage", err.message);
                        reject(err);
                        return;
                    }

                    if (file.type.startsWith("image/")) {
                        // Insert at the drop position
                        if (pos) {
                            editor.commands.insertContentAt(pos, {
                                type: "image",
                                attrs: { src: url },
                            });
                        } else {
                            // Fallback to regular image insertion if no position specified
                            editor.commands.setImage({ src: url });
                        }
                    }
                    instance.data.fileUploadUrls.push(url);
                    instance.triggerEvent("fileUploaded");
                    instance.publishState("fileUploadUrls", instance.data.fileUploadUrls);
                    resolve(url);
                },
                properties.attachFilesTo,
                (progress) => {
                    instance.publishState("fileUploadProgress", progress);
                },
            );
        });
    }

    let allowedMimeTypes = undefined;
    if (properties.allowedMimeTypes) {
        allowedMimeTypes = properties.allowedMimeTypes.get(0, properties.allowedMimeTypes.length());
    }

    extensions.push(
        FileHandler.configure({
            onDrop: async (editor, files, pos) => {
                instance.data.fileUploadUrls = [];
                try {
                    const uploadPromises = Array.from(files).map((file) => handleUpload(file, editor, pos));

                    // Wait for all uploads to complete
                    const urls = await Promise.all(uploadPromises);
                    instance.data.debug("file upload URLs:", urls);
                    instance.publishState("fileUploadUrls", urls);
                } catch (error) {
                    instance.triggerEvent("fileUploadError");
                    console.error("Upload error:", error);
                    context.reportDebugger(error.message);
                    instance.publishState("fileUploadErrorMessage", error.message);
                }
            },

            onPaste: async (editor, files, htmlContent) => {
                instance.data.fileUploadUrls = [];
                if (htmlContent) return;
                try {
                    const uploadPromises = Array.from(files).map((file) => handleUpload(file, editor));

                    // Wait for all uploads to complete
                    const urls = await Promise.all(uploadPromises);
                    instance.publishState("fileUploadUrls", urls);
                } catch (error) {
                    instance.triggerEvent("fileUploadError");
                    console.error("Upload error:", error);
                    context.reportDebugger(error.message);
                    instance.publishState("fileUploadErrorMessage", error.message);
                }
            },
            allowedMimeTypes: allowedMimeTypes,
        }),
    );

    // Store extensions for use by getSelection's generateHTML
    instance.data.editorExtensions = extensions;

    // ── Parse options ────────────────────────────────────────

    const parseOptions = {
        preserveWhitespace: preserveWhitespace,
    };

    // If attribute preservation is enabled, add custom parsing
    if (properties.preserve_html_attributes) {
        parseOptions.transformPastedHTML = (html) => {
            // Pre-process HTML to ensure better attribute preservation
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Find all div elements and ensure they're properly structured
            const divs = doc.querySelectorAll("div");
            divs.forEach((div) => {
                // Mark divs for preservation
                if (div.hasAttribute("style") || div.hasAttribute("class")) {
                    div.setAttribute("data-preserve-div", "true");
                }
            });

            return doc.body.innerHTML;
        };
    }

    // ── Editor options & callbacks ───────────────────────────

    const options = {
        element: d,
        editable: properties.isEditable,
        content: content,
        extensions: extensions,
        parseOptions: parseOptions,
        injectCSS: true,
        onCreate({ editor }) {
            instance.data.debug("editor created and ready");
            instance.data.editor_is_ready = true;
            instance.triggerEvent("is_ready");
            instance.publishState("is_ready", true);

            instance.publishState("contentHTML", editor.getHTML());
            instance.publishState("contentText", editor.getText());
            instance.publishState("contentJSON", JSON.stringify(instance.data.editor.getJSON()));
            instance.publishState("isEditable", editor.isEditable);
            instance.publishState("is_empty", editor.isEmpty);
            instance.publishState("can_undo", editor.can().undo());
            instance.publishState("can_redo", editor.can().redo());
            // CharacterCount is always loaded as a core extension
            instance.publishState("characterCount", editor.storage.characterCount.characters());
            instance.publishState("wordCount", editor.storage.characterCount.words());
            instance.data.publishFindReplaceState(editor);
            instance.data.publishTableOfContentsState(editor, null, properties.ext_table_of_contents === true);

            // AI Toolkit REST calls require editorContext generated from the exact
            // extension configuration used by this live editor.
            if (properties.ext_ai_toolkit) {
                try {
                    const editorContext = getEditorContext(editor);
                    instance.publishState("ai_editor_context", JSON.stringify(editorContext));
                } catch (error) {
                    instance.publishState("ai_editor_context", "");
                    const message = "Failed to generate AI editor context: " + (error?.message || error);
                    instance.data.debug(message);
                    context.reportDebugger(message);
                }
            }

            // Publish initial invisible characters state
            if (properties.ext_invisiblecharacters) {
                instance.publishState("invisible_characters_visible", properties.invisiblecharacters_visible !== false);
            }

            // If collaboration is active, try to set initial content
            if (properties.collab_active && instance.data.maybeSetCollabInitialContent) {
                // Try immediately (in case provider already synced)
                instance.data.maybeSetCollabInitialContent();

                // Poll as a fallback — onSynced may not fire reliably in all providers
                if (instance.data.provider && !instance.data.collabInitialContentSet) {
                    let pollAttempts = 0;
                    const maxAttempts = 50; // 50 * 200ms = 10 seconds
                    instance.data._collabSyncPollInterval = setInterval(() => {
                        pollAttempts++;
                        // Safety: stop polling if provider was destroyed (e.g. auth retry teardown)
                        if (!instance.data.provider) {
                            clearInterval(instance.data._collabSyncPollInterval);
                            instance.data._collabSyncPollInterval = null;
                            return;
                        }
                        const providerSynced = instance.data.provider.synced || instance.data.provider.isSynced;
                        if (providerSynced && !instance.data.collabHasSynced) {
                            instance.data.debug("collab sync detected via polling");
                            instance.data.collabHasSynced = true;
                            instance.publishState("collab_synced", true);
                            instance.triggerEvent("collab_synced");
                        }
                        if (instance.data.collabHasSynced) {
                            instance.data.maybeSetCollabInitialContent();
                        }
                        if (instance.data.collabInitialContentSet || pollAttempts >= maxAttempts) {
                            clearInterval(instance.data._collabSyncPollInterval);
                            instance.data._collabSyncPollInterval = null;
                        }
                    }, 200);
                }
            }
        },
        onUpdate({ editor }) {
            const contentHTML = editor.getHTML();
            instance.publishState("contentHTML", contentHTML);
            instance.publishState("contentText", editor.getText());
            instance.publishState("contentJSON", JSON.stringify(editor.getJSON()));
            instance.publishState("isEditable", editor.isEditable);
            instance.publishState("is_empty", editor.isEmpty);
            instance.publishState("can_undo", editor.can().undo());
            instance.publishState("can_redo", editor.can().redo());
            instance.publishState("characterCount", editor.storage.characterCount.characters());
            instance.publishState("wordCount", editor.storage.characterCount.words());

            if (!instance.data.isProgrammaticUpdate) {
                if (!properties.collab_active) {
                    instance.data.updateContent(contentHTML);
                } else {
                    instance.triggerEvent("contentUpdated");
                }
                instance.data.isDebouncingDone = false;
            }
        },
        onFocus({ editor, event }) {
            instance.data.debug("editor focused");
            instance.triggerEvent("isFocused");
            instance.publishState("isFocused", true);
            instance.data.is_focused = true;
        },
        onBlur({ editor, event }) {
            instance.data.debug("editor blurred");
            instance.triggerEvent("isntFocused");
            instance.publishState("isFocused", false);
            instance.data.is_focused = false;
            if (!properties.collab_active) {
                instance.publishAutobinding(editor.getHTML());
            }
        },
        onTransaction({ editor, transaction }) {
            instance.data.getSelection(editor);
            instance.data.publishActiveStates(editor);
            instance.data.publishFindReplaceState(editor);
            instance.publishState("is_empty", editor.isEmpty);
            instance.publishState("can_undo", editor.can().undo());
            instance.publishState("can_redo", editor.can().redo());
            instance.publishState("characterCount", editor.storage.characterCount.characters());
            instance.publishState("wordCount", editor.storage.characterCount.words());
        },
        onSelectionUpdate({ editor }) {
            instance.data.getSelection(editor);
            instance.data.publishActiveStates(editor);
        },
    };

    // ── Menu setup ───────────────────────────────────────────

    const menuErrorMessage = " not found. Is the entered id correct? FYI: the Bubble element should default to visible.";

    // Helper: Tiptap v3 uses Floating UI instead of tippy.js for BubbleMenu/FloatingMenu.
    // v3 does NOT initially hide the element (isVisible starts false, so hide() is a no-op).
    // We must hide menu elements ourselves before passing them to the extension.
    function hideMenuElement(el) {
        el.style.visibility = "hidden";
        el.style.opacity = "0";
    }

    if (bubbleMenu && properties.ext_bubblemenu) {
        // Find all elements with the id matching properties.bubbleMenu
        let bubbleMenuElements = document.querySelectorAll(`#${bubbleMenu}`);

        // If no elements found, log an error
        if (bubbleMenuElements.length === 0) {
            const errorMessage = "BubbleMenu" + menuErrorMessage;
            context.reportDebugger(errorMessage);
            instance.data.debug(errorMessage);
        } else if (bubbleMenuElements.length === 1) {
            // If only one element is found, make that the bubble menu.
            hideMenuElement(bubbleMenuElements[0]);
            options.extensions.push(
                BubbleMenu.configure({
                    element: bubbleMenuElements[0],
                    appendTo: () => document.body,
                }),
            );
        } else if (bubbleMenuElements.length >= 2) {
            // If multiple elements found, try to find the closest and warn the developer
            const errorMessage = `Bubble Menu: found multiple elements with the same ID ${bubbleMenu}. Assuming that the closest one is the correct one. However, the developer should update the code to ensure that the IDs are unique. Tiptap ID: ${instance.data.randomId}.`;
            context.reportDebugger(errorMessage);
            instance.data.debug(errorMessage);
            let bubbleMenuDiv = instance.data.findElement(bubbleMenu);
            hideMenuElement(bubbleMenuDiv);
            options.extensions.push(
                BubbleMenu.configure({
                    element: bubbleMenuDiv,
                    appendTo: () => document.body,
                }),
            );
        }
    }

    if (floatingMenu && properties.ext_floatingmenu) {
        // Find all elements with the id matching properties.floatingMenu
        let floatingMenuElements = document.querySelectorAll(`#${floatingMenu}`);

        // If no elements found, log an error
        if (floatingMenuElements.length === 0) {
            const errorMessage = "FloatingMenu" + menuErrorMessage;
            context.reportDebugger(errorMessage);
            instance.data.debug(errorMessage);
        } else if (floatingMenuElements.length === 1) {
            // If only one element is found, make that the floating menu.
            hideMenuElement(floatingMenuElements[0]);
            options.extensions.push(
                FloatingMenu.configure({
                    element: floatingMenuElements[0],
                    appendTo: () => document.body,
                }),
            );
        } else if (floatingMenuElements.length >= 2) {
            // If multiple elements found, try to find the closest and warn the developer
            const errorMessage = `Floating Menu: found multiple elements with the same ID ${floatingMenu}. Assuming that the closest one is the correct one. However, the developer should update the code to ensure that the IDs are unique. Tiptap ID: ${instance.data.randomId}.`;
            context.reportDebugger(errorMessage);
            instance.data.debug(errorMessage);
            let floatingMenuDiv = instance.data.findElement(floatingMenu);
            hideMenuElement(floatingMenuDiv);
            options.extensions.push(
                FloatingMenu.configure({
                    element: floatingMenuDiv,
                    appendTo: () => document.body,
                }),
            );
        }
    }

    // ── Collaboration ────────────────────────────────────────

    instance.data.maybeSetupCollaboration(instance, properties, options, extensions);

    // ── Create the editor ────────────────────────────────────

    try {
        instance.data.editor = new Editor(options);
        instance.data.isEditorSetup = true;
        instance.data._currentAiToolkitEnabled = !!properties.ext_ai_toolkit;
        instance.data._currentFindReplaceEnabled = !!properties.ext_find_replace;
        instance.data._currentTableOfContentsEnabled = !!properties.ext_table_of_contents;
        instance.data._currentCollabDocId = properties.collab_doc_id;
        instance.data.debug("editor instance created, waiting for onCreate");
    } catch (error) {
        console.error("[Tiptap] failed trying to create the Editor:", error);
    }
};