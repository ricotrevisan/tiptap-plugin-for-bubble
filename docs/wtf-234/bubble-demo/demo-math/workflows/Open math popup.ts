import { pluginEvent, resetGroup, showElement } from "@buildprint/bubblescript";

export default pluginEvent("Math editor", "Math clicked", {
	id: "bpmthwfc",
	workflowName: "Open math popup",
	plugin: "🤌 Rich text editor (Tiptap.dev)",
	pluginId: "1670612027178x122079323974008830_current",
	eventId: "math_clicked",
	actions: [resetGroup({ id: "bpmthwa1", element: "Math popup" }), showElement({ id: "bpmthwa2", element: "Math popup" })],
});
