import { changeThing, elementClicked, element } from "@buildprint/bubblescript";

export default elementClicked("Save a copy button", {
	id: "bpclrcw4",
	workflowName: "Save a copy clicked",
	actions: [
		changeThing({
			id: "bpclrcw5",
			when: element("Collaboration editor").state("is_ready").and(element("Collaboration editor").state("collab_synced", { id: "get_collab_synced" })),
			thing: element("Collaboration copy record").groupData(),
			values: [{ field: "HTML", value: element("Collaboration editor").state("contentHTML") }],
		}),
	],
});
