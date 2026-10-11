import { elementClicked, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("Note A button", {
	id: "bpsvrcw3",
	workflowName: "Note A clicked",
	actions: [setCustomState({ id: "bpsvrcw4", element: "demo-saving", state: "Autobind note", value: "A" })],
});
