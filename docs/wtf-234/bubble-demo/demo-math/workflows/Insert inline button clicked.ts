import { pluginAction, elementClicked, pluginActionRef } from "@buildprint/bubblescript";

export default elementClicked("Insert inline button", {
	id: "bpmthwfi",
	actions: [pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "Insert inline math"), { id: "bpmthwi1", element: "Math editor", latex: "x^2 + y^2 = z^2" })],
});
