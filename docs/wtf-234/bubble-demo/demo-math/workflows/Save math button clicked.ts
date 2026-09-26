import { pluginAction, element, elementClicked, hideElement, pluginActionRef } from "@buildprint/bubblescript";

export default elementClicked("Save math button", {
	id: "bpmthwfs",
	actions: [
		pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "Update math"), { id: "bpmthws1", element: "Math editor", latex: element("LaTeX input").value() }),
		hideElement({ id: "bpmthws2", element: "Math popup" }),
	],
});
