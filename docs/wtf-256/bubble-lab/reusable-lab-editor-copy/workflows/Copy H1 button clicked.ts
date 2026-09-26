import { element, elementClicked, pluginAction, pluginActionRef, setCustomState } from "@buildprint/bubblescript";

export default elementClicked("Copy H1 button", {
	id: "bwstecbz",
	actions: [pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "H1"), { id: "bwsdjxmp", element: "Copy editor" }), setCustomState({ id: "bphaxdcp", element: "lab-editor-copy", state: "h1 clicks", value: element("lab-editor-copy").state("h1 clicks").plus(1) })],
});
