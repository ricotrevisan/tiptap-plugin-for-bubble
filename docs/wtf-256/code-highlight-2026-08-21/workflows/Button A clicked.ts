import { pluginAction, elementClicked, pluginActionRef } from "@buildprint/bubblescript";

export default elementClicked("Button A", {
	id: "bTIAk",
	actions: [pluginAction(pluginActionRef("🤌 Code syntax highlighter", "Highlight code"), { id: "bTIAn", element: "codehighlighter A" })],
});
