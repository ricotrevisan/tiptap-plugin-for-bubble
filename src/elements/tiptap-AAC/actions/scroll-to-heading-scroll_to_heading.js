if (!instance.data.editor_is_ready)
    return instance.data.returnAndReportErrorIfEditorNotReady("Scroll to heading");

if (!instance.data.ext.tableofcontents) {
    return instance.data.returnAndReportErrorIfExtensionNotActive("Scroll to heading", "Table of Contents");
}

const headingId = String(properties.heading_id || "").trim();
const behavior = properties.behavior === "auto" ? "auto" : "smooth";
const validBlocks = ["start", "center", "end", "nearest"];
const block = validBlocks.includes(properties.block) ? properties.block : "start";
const didScroll = instance.data.scrollToTableOfContentsHeading(headingId, { behavior, block });

if (!didScroll) {
    const message = `No table of contents heading found with id "${headingId}". Returning`;
    instance.data.debug(message);
    context.reportDebugger(message);
}
