import { elementClicked, pauseWorkflowClient, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("Delayed switch", {
	id: "bpiwtfgn",
	actions: [
		pauseWorkflowClient({ id: "bphmocmk", length: 1000 }),
		setCustomState({ id: "bplzjzbv", element: "wtf-260-autobinding", state: "Selected record", value: "B" }),
	],
});
