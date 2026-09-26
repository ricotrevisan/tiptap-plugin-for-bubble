import { pluginAction, elementClicked, hideElement, pluginActionRef } from "@buildprint/bubblescript";

export default elementClicked("Delete math button", {
	id: "bpmthwfd",
	actions: [
		pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "Delete math"), { id: "bpmthwd1", element: "Math editor" }),
		hideElement({ id: "bpmthwd2", element: "Math popup" }),
	],
});
