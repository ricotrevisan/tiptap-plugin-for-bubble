import { pluginAction, element, elementClicked, pluginActionRef, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("A Divider button", {
	id: "bwkpgvqw",
	actions: [pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "Horizontal rule"), { id: "bwzgbuaj", element: "Editor A" }), setCustomState({ id: "bwoclszb", element: "lifecycle-lab", state: "a hr", value: element("lifecycle-lab").state("a hr").plus(1) })],
});
