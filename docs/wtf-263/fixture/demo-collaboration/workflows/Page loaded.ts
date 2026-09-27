import { pluginAction, pageLoaded, pluginActionRef, previousStep, setCustomState } from "@buildprint/bubblescript";

export default pageLoaded({
	id: "bpclrcw1",
	actions: [
		pluginAction(pluginActionRef("🤌 Rich text editor (Tiptap.dev)", "generate auth token"), {
			id: "bpclrcw2",
			appId: "nrm8d1ko",
			docNames: "tiptap-demo-recipes",
			jwt_secret: "Tiptap Cloud",
		}),
		setCustomState({ id: "bpclrcw3", element: "demo-collaboration", state: "Collaboration token", value: previousStep("bpclrcw2").field("auth token") }),
	],
});
