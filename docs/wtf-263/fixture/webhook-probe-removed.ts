import { apiObject, pluginAction, apiWorkflow, pluginActionRef, previousStep, returnApiResponse, wfParam } from "@buildprint/bubblescript";

export default apiWorkflow("tiptap_document_saved", {
	id: "bpwtf263a",
	comment: "WTF-263 probe: how does Bubble pass a Tiptap Cloud document.saved body to the converter?",
	workflowName: "tiptap_document_saved",
	expose: true,
	authentication: "none",
	parameterMode: "detect",
	requestData: apiObject({ name: "text", trigger: "text" }),
	actions: [
		pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "convert webhook payload to HTML"), {
			id: "bpwtf263b",
			name: "Convert document to HTML",
			payload: wfParam("Request Data").field("raw body text"),
			field_name: "default",
		}),
		returnApiResponse({
			id: "bpwtf263c",
			fields: [
				{ name: "name", type: "text", value: wfParam("Request Data").field("name") },
				{ name: "payload", type: "text", value: wfParam("Request Data").field("raw body text") },
				{ name: "html", type: "text", value: previousStep("bpwtf263b").field("html") },
				{ name: "error", type: "text", value: previousStep("bpwtf263b").field("error") },
			],
		}),
	],
});
