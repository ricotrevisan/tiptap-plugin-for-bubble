import { plugin, button, dataTypeRef, dynamicText, element, fontVariable, group, input, popup, reusable, text, thisElement } from "@buildprint/bubblescript";

export default reusable("bpmthrus", {
	type: "group",
	name: "demo-math",
	layout: { builderWidth: 1200, container: "column", height: "fill", width: "fill", minWidth: 40 },
	elementProperties: { customElementPlatform: "web" },
	children: [
		group("bpmthpgc", {
			name: "Page content",
			layout: { container: "column", gap: 28, height: "fit", alignSelf: "center", width: "fill", maxWidth: 960 },
			children: [
				group("bpmthcrd", {
					name: "Math playground",
					layout: { container: "column", gap: 14, height: "fit", padding: 32, alignSelf: "stretch", width: "fill" },
					appearance: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 24 },
					children: [
						text("bpmthhdg", "Math formulas with LaTeX.", {
							name: "Playground heading",
							layout: { height: "fit", width: "fill" },
							typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 36, lineHeight: 1.2 },
							properties: { tagType: "h1" },
						}),
						text("bpmthdsc", "Type $$x^2$$ for a formula inside a sentence, or $$$x^2$$$ on an empty line for a formula on its own line. Prices like $5 stay text. Click a formula to edit it in a Bubble popup.", {
							name: "Playground description",
							layout: { height: "fit", alignSelf: "stretch", width: "fill" },
							typography: { color: "#475569", fontFamily: fontVariable("app"), fontSize: 16, lineHeight: 1.55 },
						}),
						group("bpmthbtn", {
							name: "Insert buttons",
							layout: { container: "row", gap: 8, height: "fit", alignSelf: "flex-start", width: "fit" },
							children: [
								button("bpmthbin", "Insert inline formula", {
									name: "Insert inline button",
									layout: { height: "fit", padding: "10px 14px", width: "fit" },
									appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8 },
									typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 13, lineHeight: 1.2 },
									conditions: [{ id: "hover", when: thisElement().isHovered(), appearance: { background: "#F8FAFC", borderColor: "#94A3B8" } }],
								}),
								button("bpmthbbl", "Insert block formula", {
									name: "Insert block button",
									layout: { height: "fit", padding: "10px 14px", width: "fit" },
									appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8 },
									typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 13, lineHeight: 1.2 },
									conditions: [{ id: "hover", when: thisElement().isHovered(), appearance: { background: "#F8FAFC", borderColor: "#94A3B8" } }],
								}),
							],
						}),
						plugin("bpmthedt", {
							type: "1670612027178x122079323974008830_current-AAC",
							name: "Math editor",
							style: "Standard tiptap",
							layout: { minHeight: 260, alignSelf: "stretch", minWidth: 0 },
							appearance: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12 },
							properties: {
								ext_math: true,
								file_upload_condition: false,
								mention_list_type: dataTypeRef("User"),
								h1_margin: "0 0 0.75rem 0",
								h1_size: "2rem",
								h2_margin: "1.25rem 0 0.5rem 0",
								h2_size: "1.5rem",
								initialContent:
									'<p>The area of a circle is <span data-type="inline-math" data-latex="\\pi r^2"></span>. Click the formula to edit it.</p><div data-type="block-math" data-latex="\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}"></div><p>A ticket costs $5 or $10. That stays text.</p>',
								isEditable: true,
								placeholder: "Type $$x^2$$…",
							},
						}),
						group("bpmthrdo", {
							name: "Selected formula readout",
							layout: { container: "column", gap: 6, height: "fit", padding: 16, alignSelf: "stretch", width: "fill" },
							appearance: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12 },
							children: [
								text("bpmthrdh", "States: Selected math type and Selected math LaTeX", {
									name: "Readout heading",
									layout: { height: "fit", alignSelf: "flex-start", width: "fill" },
									typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 700, fontSize: 15, lineHeight: 1.4 },
								}),
								text("bpmthrdt", dynamicText("Selected formula: ", element("Math editor").state("selected_math_type", { id: "get_selected_math_type" }), " ", element("Math editor").state("selected_math_latex", { id: "get_selected_math_latex" }), ""), {
									name: "Selected formula",
									layout: { height: "fit", alignSelf: "flex-start", width: "fill" },
									typography: { color: "#334155", fontFamily: fontVariable("app"), fontSize: 15, lineHeight: 1.5 },
								}),
							],
						}),
						group("bpmthhow", {
							name: "How to wire it",
							layout: { container: "column", gap: 12, height: "fit", padding: "24px 0 0", alignSelf: "stretch", width: "fill" },
							children: [
								text("bpmthhwh", "How you would wire this.", {
									name: "How-to heading",
									layout: { height: "fit", width: "fill" },
									typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 24, lineHeight: 1.3 },
									properties: { tagType: "h2" },
								}),
								text("bpmthhwb", "1. Turn on Mathematics on the Tiptap element (Extensions > Mathematics).\n2. Buttons: Insert inline math or Insert block math with the LaTeX, without dollar signs.\n3. Editing: add a workflow When Tiptap Math clicked → Reset the popup → Show the popup. The popup's input starts with Selected math LaTeX.\n4. Save runs Update math with the input's value. Delete runs Delete math. Both change the formula the user clicked.\n\nFormulas are saved in the HTML with their LaTeX, so they load again. Outside the editor (an HTML element, an email) the LaTeX shows as text. Invalid LaTeX shows in red and still saves. In a read-only editor, clicking a formula does nothing.", {
									name: "How-to body",
									layout: { height: "fit", alignSelf: "stretch", width: "fill" },
									typography: { color: "#334155", fontFamily: fontVariable("app"), fontSize: 15, lineHeight: 1.6 },
								}),
							],
						}),
					],
				}),
			],
		}),
		popup("bpmthpop", {
			name: "Math popup",
			style: "Standard Popup",
			layout: { collapseWhenHidden: false, container: "column", gap: 16, height: "fit", hidden: true, padding: 28, width: "fill", maxWidth: 520 },
			appearance: { background: "#FFFFFF", borderRadius: 16 },
			children: [
				text("bpmthptt", dynamicText("Edit ", element("Math editor").state("selected_math_type", { id: "get_selected_math_type" }), " formula"), {
					name: "Popup title",
					layout: { height: "fit", width: "fill" },
					typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 800, fontSize: 22, lineHeight: 1.5 },
					properties: { tagType: "h2" },
				}),
				input("bpmthinp", {
					name: "LaTeX input",
					value: dynamicText("", element("Math editor").state("selected_math_latex", { id: "get_selected_math_latex" }), ""),
					placeholder: "LaTeX, for example \\frac{a}{b}",
					layout: { height: 44, padding: "0 12px", alignSelf: "stretch", width: "fill" },
					appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10 },
					typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontSize: 14, lineHeight: 1.2 },
				}),
				group("bpmthpbt", {
					name: "Popup buttons",
					layout: { container: "row", gap: 8, height: "fit", alignSelf: "flex-end", width: "fit" },
					children: [
						button("bpmthcnl", "Cancel", {
							name: "Cancel math button",
							layout: { height: "fit", padding: "10px 14px", width: "fit" },
							appearance: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8 },
							typography: { color: "#0F172A", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 13, lineHeight: 1.2 },
						}),
						button("bpmthdel", "Delete", {
							name: "Delete math button",
							layout: { height: "fit", padding: "10px 14px", width: "fit" },
							appearance: { background: "#FFFFFF", border: "1px solid #FCA5A5", borderRadius: 8 },
							typography: { color: "#B91C1C", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 13, lineHeight: 1.2 },
						}),
						button("bpmthsav", "Save", {
							name: "Save math button",
							layout: { height: "fit", padding: "10px 14px", width: "fit" },
							appearance: { background: "#1D4ED8", border: "1px solid #1D4ED8", borderRadius: 8 },
							typography: { color: "#FFFFFF", fontFamily: fontVariable("app"), fontWeight: 600, fontSize: 13, lineHeight: 1.2 },
						}),
					],
				}),
			],
		}),
	],
});
