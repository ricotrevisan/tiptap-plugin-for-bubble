// WTF-256 lifecycle lab: every copy of this reusable has a menu group with the
// same unique ID. Each editor must use the copy in its own reusable.

import { dataTypeRef, plugin, button, dynamicText, element, group, reusable, text } from "@buildprint/bubblescript";

export default reusable("bwberfkr", {
	type: "group",
	name: "lab-editor-copy",
	layout: { builderWidth: 600, container: "column", gap: 6, height: "fill", width: "fill", minWidth: 40 },
	elementProperties: { customElementPlatform: "web" },
	customStates: [{ name: "h1 clicks", id: "h1_clicks_", type: "number", defaultValue: 0 }],
	children: [
		text("bwhzfhka", dynamicText("Copy H1: ", element("lab-editor-copy").state("h1 clicks")), {
			name: "Copy counter",
			layout: { height: "fit", width: "fill" },
			typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
		}),
		group("bwajkbzg", {
	name: "Copy menu",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labDupMenu" },
	children: [button("bwpnrosw", "H1", {
	name: "Copy H1 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-copy-h1" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}),
		plugin("bwphddzx", {
	type: "1670612027178x122079323974008830_current-AAC",
	name: "Copy editor",
	style: "Standard tiptap",
	layout: { minHeight: 90, alignSelf: "stretch", minWidth: 0 },
	appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
	properties: { mention_list_type: dataTypeRef("User"), bubbleMenu: "labDupMenu", ext_bubblemenu: true, file_upload_condition: false, initialContent: "<p>Reusable copy. Select this text.</p>", isEditable: true, placeholder: "Type here…" },
}),
	],
});
