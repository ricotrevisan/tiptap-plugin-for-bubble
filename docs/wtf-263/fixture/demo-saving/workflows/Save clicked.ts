import { changeThing, elementClicked, element } from "@buildprint/bubblescript";

export default elementClicked("Save button", {
	id: "bpsvrcw1",
	workflowName: "Save clicked",
	actions: [
		changeThing({
			id: "bpsvrcw2",
			thing: element("Save button record").groupData(),
			values: [{ field: "HTML", value: element("Save button editor").state("contentHTML") }],
		}),
	],
});
