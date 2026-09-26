import { pluginAction, element, elementClicked, pluginActionRef, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("B H1 button", {
	id: "bwwvkutm",
	actions: [pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "H1"), { id: "bwwvbkfg", element: "Editor B" }), setCustomState({ id: "bwsnkwvy", element: "lifecycle-lab", state: "b h1", value: element("lifecycle-lab").state("b h1").plus(1) })],
});
