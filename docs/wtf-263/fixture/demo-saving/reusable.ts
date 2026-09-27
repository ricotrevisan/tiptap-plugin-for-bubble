import { dataTypeRef, plugin, button, dynamicText, element, fontVariable, group, parentThing, reusable, search, text, thisElement } from "@buildprint/bubblescript";

export default reusable("bpsvrcpa", {
	type: "group",
	name: "demo-saving",
	layout: { builderWidth: 1200, container: "column", height: "fill", width: "fill", minWidth: 40 },
	elementProperties: { customElementPlatform: "web" },
	customStates: [{ name: "Autobind note", id: "autobind_note", type: "text", defaultValue: "A" }],
	children: [
		group("bpsvrcpb", {
			name: "Saving playground",
			layout: { container: "column", gap: 14, height: "fit", padding: 32, alignSelf: "stretch", width: "fill" },
			appearance: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 24 },
			children: [
				text("bpsvrcpc", "Save to your database.", {
					name: "Playground heading",
					layout: { height: "fit", width: "fill" },
					typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 36, lineHeight: 1.2 },
					properties: { tagType: "h1" },
				}),
				text("bpsvrcpd", "Pick one way to save each document. A Save button writes when the user clicks. Autobinding writes while the user types. Don't use both on the same field.", {
					name: "Playground description",
					layout: { height: "fit", alignSelf: "stretch", width: "fill" },
					typography: { color: "#475569", fontFamily: fontVariable("app"), fontSize: 16, lineHeight: 1.55 },
				}),
				text("bpsvrcpe", "1. Save button", {
					name: "Save button heading",
					layout: { height: "fit", width: "fill" },
					typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 24, lineHeight: 1.3 },
					properties: { tagType: "h2" },
				}),
				group("bpsvrcpf", {
					name: "Save button record",
					dataSource: search("Doc", { constraints: [{ field: "Title", operator: "equals", value: "Recipe: save button" }] }).firstItem(),
					groupType: dataTypeRef("Doc"),
					layout: { container: "column", gap: 10, height: "fit", alignSelf: "stretch", width: "fill" },
					children: [
						plugin("bpsvrcpg", {
							type: "1670612027178x122079323974008830_current-AAC",
							name: "Save button editor",
							style: "Standard tiptap",
							layout: { minHeight: 160, alignSelf: "stretch", minWidth: 0 },
							appearance: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12 },
							properties: {
								autoBinding: false,
								file_upload_condition: false,
								mention_list_type: dataTypeRef("Doc"),
								h2_margin: "0 0 0.5rem 0",
								h2_size: "1.5rem",
								initialContent: dynamicText("", parentThing().field("HTML"), ""),
								isEditable: true,
								placeholder: "Start writing…",
							},
						}),
						group("bpsvrcph", {
							name: "Save row",
							layout: { container: "row", columnGap: 12, height: "fit", alignSelf: "stretch", width: "fill" },
							children: [
								button("bpsvrcpi", "Save", {
									name: "Save button",
									layout: { height: "fit", padding: "10px 18px", alignSelf: "center", width: "fit" },
									appearance: { background: "#1D4ED8", borderRadius: 10 },
									typography: { color: "#FFFFFF", fontFamily: fontVariable("app"), fontWeight: 700, fontSize: 14, lineHeight: 1.2 },
									conditions: [{ id: "hover", when: thisElement().isHovered(), appearance: { background: "#1E40AF" } }],
								}),
								text("bpsvrcpj", "All changes saved.", {
									name: "Save status",
									layout: { height: "fit", alignSelf: "center", width: "fill" },
									typography: { color: "#15803D", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 14, lineHeight: 1.4 },
									conditions: [
										{
											when: element("Save button editor").state("contentHTML").notEquals(element("Save button record").groupData().field("HTML")),
											properties: { text: "Unsaved changes. Click Save to write them to the database." },
											typography: { color: "#B45309" },
										},
									],
								}),
							],
						}),
					],
				}),
				text("bpsvrcpk", "2. Autobinding, switching between records", {
					name: "Autobind heading",
					layout: { height: "fit", width: "fill" },
					typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 24, lineHeight: 1.3 },
					properties: { tagType: "h2" },
				}),
				group("bpsvrcpl", {
					name: "Note switcher",
					layout: { container: "row", columnGap: 8, height: "fit", alignSelf: "stretch", width: "fill" },
					children: [
						button("bpsvrcpm", "Note A", {
							name: "Note A button",
							layout: { height: "fit", padding: "10px 14px", alignSelf: "center", width: "fit" },
							appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
							typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 14, lineHeight: 1.2 },
							conditions: [{ when: element("demo-saving").state("Autobind note").equals("A"), appearance: { background: "#DBEAFE", borderColor: "#1D4ED8" } }],
						}),
						button("bpsvrcpn", "Note B", {
							name: "Note B button",
							layout: { height: "fit", padding: "10px 14px", alignSelf: "center", width: "fit" },
							appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
							typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 14, lineHeight: 1.2 },
							conditions: [{ when: element("demo-saving").state("Autobind note").equals("B"), appearance: { background: "#DBEAFE", borderColor: "#1D4ED8" } }],
						}),
					],
				}),
				group("bpsvrcpo", {
					name: "Autobind record",
					dataSource: search("Doc", {
						constraints: [{ field: "Title", operator: "equals", value: dynamicText("Recipe: autobind ", element("demo-saving").state("Autobind note"), "") }],
					}).firstItem(),
					groupType: dataTypeRef("Doc"),
					layout: { container: "column", gap: 10, height: "fit", alignSelf: "stretch", width: "fill" },
					children: [
						plugin("bpsvrcpp", {
							type: "1670612027178x122079323974008830_current-AAC",
							name: "Autobind editor",
							style: "Standard tiptap",
							layout: { minHeight: 160, alignSelf: "stretch", minWidth: 0 },
							appearance: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12 },
							properties: {
								autoBinding: true,
								mention_list_type: dataTypeRef("Doc"),
								bindField: "html_text",
								autobinding_record_id: dynamicText("", parentThing().uniqueId(), ""),
								file_upload_condition: false,
								h2_margin: "0 0 0.5rem 0",
								h2_size: "1.5rem",
								isEditable: true,
								placeholder: "Start writing…",
							},
						}),
						text("bpsvrcpq", dynamicText("Saved in the database: ", parentThing().field("HTML"), ""), {
							name: "Autobind stored HTML",
							layout: { height: "fit", alignSelf: "stretch", width: "fill" },
							typography: { color: "#334155", fontFamily: fontVariable("app"), fontSize: 13, lineHeight: 1.45 },
						}),
						text("bpsvrcpr", "3. Read-only view of the saved note", {
							name: "Read-only heading",
							layout: { height: "fit", width: "fill" },
							typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 24, lineHeight: 1.3 },
							properties: { tagType: "h2" },
						}),
						plugin("bpsvrcps", {
							type: "1670612027178x122079323974008830_current-AAC",
							name: "Read-only view",
							style: "Standard tiptap",
							layout: { minHeight: 80, alignSelf: "stretch", minWidth: 0 },
							appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
							properties: {
								autoBinding: false,
								file_upload_condition: false,
								mention_list_type: dataTypeRef("Doc"),
								h2_margin: "0 0 0.5rem 0",
								h2_size: "1.5rem",
								initialContent: dynamicText("", parentThing().field("HTML"), ""),
								isEditable: false,
								ext_bubblemenu: false,
								ext_floatingmenu: false,
							},
						}),
					],
				}),
				group("bpsvrcpt", {
					name: "How to wire it",
					layout: { container: "column", gap: 12, height: "fit", padding: "24px 0 0", alignSelf: "stretch", width: "fill" },
					children: [
						text("bpsvrcpu", "How you would wire this.", {
							name: "How-to heading",
							layout: { height: "fit", width: "fill" },
							typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 24, lineHeight: 1.3 },
							properties: { tagType: "h2" },
						}),
						text("bpsvrcpv", "Save button: set Initial content to the Thing's HTML. When Save is clicked, Make changes to the Thing: HTML = This Tiptap's Content (HTML).\n\nAutobinding: turn on autobinding to the Thing's HTML field and set Autobinding record ID to the Thing's unique ID. It saves 2.2 seconds after the user stops typing, or right away when the editor loses focus.\n\nRead-only: a second Tiptap with This input is enabled unchecked shows the saved HTML with the same styles.", {
							name: "How-to body",
							layout: { height: "fit", alignSelf: "stretch", width: "fill" },
							typography: { color: "#334155", fontFamily: fontVariable("app"), fontSize: 15, lineHeight: 1.6 },
						}),
					],
				}),
			],
		}),
	],
});
