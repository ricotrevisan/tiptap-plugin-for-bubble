// WTF-256 lifecycle lab. Real-Bubble counterpart of lib/tests/browser/lab.html.
// Contract: docs/wtf-256/lifecycle-lab.md in the plugin repository.

import { dataTypeRef, plugin, button, dynamicText, element, floatingGroup, group, input, page, popup, reusableInstance, text } from "@buildprint/bubblescript";

export default page("bwpjnlmz", {
	name: "lifecycle-lab",
	title: "Tiptap lifecycle lab",
	comment: "WTF-256 lifecycle lab: menus, stacking, isolation. Test surface, not a demo.",
	layout: { builderWidth: 1200, container: "column", gap: 12, padding: "20px 20px 400px", height: "fill", width: "fill", minWidth: 0 },
	appearance: { background: "#FFFFFF" },
	customStates: [
		{ name: "a h1", id: "a_h1_", type: "number", defaultValue: 0 },
		{ name: "a h2", id: "a_h2_", type: "number", defaultValue: 0 },
		{ name: "b h1", id: "b_h1_", type: "number", defaultValue: 0 },
		{ name: "s h2", id: "s_h2_", type: "number", defaultValue: 0 },
		{ name: "p h1", id: "p_h1_", type: "number", defaultValue: 0 },
		{ name: "f h1", id: "f_h1_", type: "number", defaultValue: 0 },
	],
	children: [
		text("bwboynhq", "Tiptap lifecycle lab", {
	name: "Lab title",
	layout: { height: "fit", width: "fill" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}),
		text("bwfjvkrk", "Test surface for WTF-256. Each menu button runs one Tiptap action and adds 1 to its counter.", {
	name: "Lab intro",
	layout: { height: "fit", width: "fill" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}),
		group("bwktcrjr", {
	name: "Counters",
	layout: { container: "column", gap: 8, height: "fit", padding: 12, alignSelf: "stretch", width: "fill" },
	appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
	children: [text("bwfwibro", dynamicText("A H1: ", element("lifecycle-lab").state("a h1")), {
	name: "Counter A H1",
	layout: { height: "fit", width: "fill" }, appearance: { htmlId: "lab-count-a-h1" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}), text("bwbxmygw", dynamicText("B H1: ", element("lifecycle-lab").state("b h1")), {
	name: "Counter B H1",
	layout: { height: "fit", width: "fill" }, appearance: { htmlId: "lab-count-b-h1" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}), text("bwlojpzc", dynamicText("S H2: ", element("lifecycle-lab").state("s h2")), {
	name: "Counter S H2",
	layout: { height: "fit", width: "fill" }, appearance: { htmlId: "lab-count-s-h2" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}), text("bwseyzau", dynamicText("P H1: ", element("lifecycle-lab").state("p h1")), {
	name: "Counter P H1",
	layout: { height: "fit", width: "fill" }, appearance: { htmlId: "lab-count-p-h1" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}), text("bwiagenl", dynamicText("F H1: ", element("lifecycle-lab").state("f h1")), {
	name: "Counter F H1",
	layout: { height: "fit", width: "fill" }, appearance: { htmlId: "lab-count-f-h1" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
}), text("bwfrjivm", dynamicText("A H2: ", element("lifecycle-lab").state("a h2")), {
	name: "Counter A H2",
	layout: { height: "fit", width: "fill" }, appearance: { htmlId: "lab-count-a-h2" },
	typography: { color: "#0F172A", fontSize: 14, lineHeight: 1.4 },
})],
}),
		group("bwqgazdn", {
	name: "Editor A section",
	layout: { container: "column", gap: 8, height: "fit", padding: 12, alignSelf: "stretch", width: "fill" },
	appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
	children: [group("bwqxhdsv", {
	name: "Menu A",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labMenuA" },
	children: [button("bwnxaclb", "H1", {
	name: "A H1 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-a-h1" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
}), input("bwzghmho", { name: "Menu A input", placeholder: "Link URL", layout: { height: 30, width: 160 }, appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", htmlId: "lab-menu-a-input" } })],
}), group("bwsgrvwk", {
	name: "Floating menu A",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labFloatA" },
	children: [button("bwnbtpxj", "H2", {
	name: "A H2 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-a-h2" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}), plugin("bwlpaort", {
	type: "1670612027178x122079323974008830_current-AAC",
	name: "Editor A",
	style: "Standard tiptap",
	layout: { minHeight: 140, alignSelf: "stretch", minWidth: 0 },
	appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
	properties: { mention_list_type: dataTypeRef("User"), bubbleMenu: "labMenuA", ext_bubblemenu: true, ext_floatingmenu: true, file_upload_condition: false, floatingMenu: "labFloatA", initialContent: "<p>Editor A. Select this text to show menu A.</p>", isEditable: true, placeholder: "Type here…" },
})],
}),
		group("bwxjiems", {
	name: "Editor B section",
	layout: { container: "column", gap: 8, height: "fit", padding: 12, alignSelf: "stretch", width: "fill" },
	appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
	children: [group("bworzatw", {
	name: "Menu B",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labMenuB" },
	children: [button("bwlpoaza", "H1", {
	name: "B H1 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-b-h1" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}), plugin("bwmdmhai", {
	type: "1670612027178x122079323974008830_current-AAC",
	name: "Editor B",
	style: "Standard tiptap",
	layout: { minHeight: 140, alignSelf: "stretch", minWidth: 0 },
	appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
	properties: { mention_list_type: dataTypeRef("User"), bubbleMenu: "labMenuB", ext_bubblemenu: true, file_upload_condition: false, initialContent: "<p>Editor B. Select this text to show menu B.</p>", isEditable: true, placeholder: "Type here…" },
})],
}),
		input("bwuvhctq", { name: "Lab input", placeholder: "A page input", layout: { height: 36, width: 320 }, appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", htmlId: "lab-input" } }),
		group("bwyquavw", {
	name: "Scroll section",
	layout: { container: "column", gap: 8, height: "fit", padding: 12, alignSelf: "stretch", width: "fill" },
	appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
	children: [group("bwjiirag", {
	name: "Floating menu S",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labFloatS" },
	children: [button("bwvjhnde", "H2", {
	name: "S H2 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-s-h2" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}), group("bwwavdfd", {
	name: "Scroll wrap",
	layout: { container: "column", height: 220, alignSelf: "stretch", width: "fill" },
	appearance: { border: "1px dashed #94A3B8" },
	properties: { overflowScroll: true },
	children: [plugin("bwxhuogm", {
	type: "1670612027178x122079323974008830_current-AAC",
	name: "Scroll editor",
	style: "Standard tiptap",
	layout: { minHeight: 300, alignSelf: "stretch", minWidth: 0 },
	appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
	properties: { mention_list_type: dataTypeRef("User"), ext_floatingmenu: true, file_upload_condition: false, floatingMenu: "labFloatS", initialContent: "<h2>Scroll area</h2><p>Line 1. Scroll this box.</p><p>Line 2. Scroll this box.</p><p>Line 3. Scroll this box.</p><p>Line 4. Scroll this box.</p><p>Line 5. Scroll this box.</p><p>Line 6. Scroll this box.</p><p>Line 7. Scroll this box.</p><p>Line 8. Scroll this box.</p><p>Line 9. Scroll this box.</p><p>Line 10. Scroll this box.</p><p>Line 11. Scroll this box.</p><p>Line 12. Scroll this box.</p><p>Line 13. Scroll this box.</p><p>Line 14. Scroll this box.</p><p>Line 15. Scroll this box.</p>", isEditable: true, placeholder: "Type here…" },
})],
})],
}),
		group("bwupvnjk", {
	name: "Popup section",
	layout: { container: "column", gap: 8, height: "fit", padding: 12, alignSelf: "stretch", width: "fill" },
	appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
	children: [button("bwknwxhl", "Open popup", {
	name: "Open popup button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-open-popup" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}),
		group("bwvpzdvx", {
	name: "Reusable copies",
	layout: { container: "column", gap: 8, height: "fit", padding: 12, alignSelf: "stretch", width: "fill" },
	appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
	children: [reusableInstance("lab-editor-copy", "bwiqhbup", { name: "Copy 1", layout: { height: 200, alignSelf: "stretch", width: "fill" } }), reusableInstance("lab-editor-copy", "bwqjduue", { name: "Copy 2", layout: { height: 200, alignSelf: "stretch", width: "fill" } })],
}),
		popup("bwbllpig", {
			name: "Lab popup",
			style: "Standard Popup",
			layout: { collapseWhenHidden: false, container: "column", gap: 10, height: "fit", hidden: true, padding: 20, width: "fill", maxWidth: 560 },
			appearance: { background: "#FFFFFF", borderRadius: 12 },
			children: [group("bwnqwrrp", {
	name: "Menu P",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labMenuP" },
	children: [button("bwbadpjh", "H1", {
	name: "P H1 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-p-h1" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}), plugin("bwlsukbv", {
	type: "1670612027178x122079323974008830_current-AAC",
	name: "Popup editor",
	style: "Standard tiptap",
	layout: { minHeight: 140, alignSelf: "stretch", minWidth: 0 },
	appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
	properties: { mention_list_type: dataTypeRef("User"), bubbleMenu: "labMenuP", ext_bubblemenu: true, file_upload_condition: false, initialContent: "<p>Popup editor. Select this text.</p>", isEditable: true, placeholder: "Type here…" },
}), button("bwyoiyqf", "Close popup", {
	name: "Close popup button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-close-popup" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
		}),
		floatingGroup("bwfughsp", {
			name: "Lab floating group",
			layout: { collapseWhenHidden: false, container: "column", gap: 6, floating: { vertical: "bottom", horizontal: "right" }, height: "fit", margin: "0 16px 16px 0", padding: 10, width: 360 },
			appearance: { background: "#F1F5F9", border: "1px solid #94A3B8", borderRadius: 10 },
			children: [group("bwstceey", {
	name: "Menu F",
	layout: { container: "row", columnGap: 4, height: "fit", padding: 6, width: "fit" },
	appearance: { background: "#E2E8F0", borderRadius: 8, htmlId: "labMenuF" },
	children: [button("bwehfxzf", "H1", {
	name: "F H1 button",
	layout: { height: "fit", padding: "6px 10px", width: "fit" },
	appearance: { background: "#FFFFFF", border: "1px solid #94A3B8", borderRadius: 6, htmlId: "lab-f-h1" },
	typography: { color: "#0F172A", fontSize: 13, lineHeight: 1.2 },
})],
}), plugin("bwravzpg", {
	type: "1670612027178x122079323974008830_current-AAC",
	name: "Floating editor",
	style: "Standard tiptap",
	layout: { minHeight: 90, alignSelf: "stretch", minWidth: 0 },
	appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
	properties: { mention_list_type: dataTypeRef("User"), bubbleMenu: "labMenuF", ext_bubblemenu: true, file_upload_condition: false, initialContent: "<p>Floating group editor. Select this text.</p>", isEditable: true, placeholder: "Type here…" },
})],
		}),
	],
});
