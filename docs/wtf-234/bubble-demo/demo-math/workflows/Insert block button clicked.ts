import { pluginAction, elementClicked, pluginActionRef } from "@buildprint/bubblescript";

export default elementClicked("Insert block button", {
	id: "bpmthwfb",
	actions: [pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "Insert block math"), { id: "bpmthwb1", element: "Math editor", latex: "\\int_0^1 x^2 \\, dx = \\frac{1}{3}" })],
});
