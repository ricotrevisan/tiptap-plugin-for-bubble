import { pluginAction, element, elementClicked, pluginActionRef, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("A H1 button", {
	id: "bwxndjjo",
	actions: [pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "H1"), { id: "bwysquko", element: "Editor A" }), setCustomState({ id: "bwbzevwe", element: "lifecycle-lab", state: "a h1", value: element("lifecycle-lab").state("a h1").plus(1) })],
});
