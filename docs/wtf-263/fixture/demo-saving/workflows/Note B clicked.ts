import { elementClicked, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("Note B button", {
	id: "bpsvrcw5",
	workflowName: "Note B clicked",
	actions: [setCustomState({ id: "bpsvrcw6", element: "demo-saving", state: "Autobind note", value: "B" })],
});
