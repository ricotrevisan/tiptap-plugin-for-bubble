// @buildprint raw-locations: 1

import { dataTypeRef, plugin, button, colorVariable, dynamicText, element, group, page, parentThing, search, text } from "@buildprint/bubblescript";

export default page("bpmsmqwc", {
	name: "wtf-260-autobinding",
	title: "WTF-260 autobinding regression",
	layout: { container: "column", gap: 16, padding: 32, height: "fill", width: "fill" },
	appearance: { background: "#FFFFFF" },
	customStates: [
		{ name: "Selected record", id: "selected_record", type: "text", defaultValue: "A" },
		{ name: "Save delay", id: "save_delay", type: "number", defaultValue: 2200 },
	],
	children: [
		text("bpmsmqwd", "WTF-260 — typing and record switching", { name: "Title", layout: { height: "fit", alignSelf: "stretch", width: "fill" } }),
		group("cnHyk0", {
			name: "Group A",
			style: "Standard Group",
			layout: { container: "row", gap: 8, height: "fit", minHeight: 40, padding: 8, alignSelf: "flex-start", width: "fill", minWidth: 40, zIndex: 2 },
			appearance: { background: colorVariable("slate-50"), borderRadius: 6 },
			children: [
				button("bpmsmqwe", "Record A", {
					name: "Record A",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
				button("bpmsmqwf", "Record B", {
					name: "Record B",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
				button("bpbniaqu", "Switch to B in 1 second", {
					name: "Delayed switch",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
				button("bphidenv", "Hide editor", {
					name: "Hide editor",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
				button("bpshowev", "Show editor", {
					name: "Show editor",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
                button("bpsavedd", "Delay 2200", {
                    name: "Delay 2200",
                    layout: { height: "fit", padding: 12, width: "fit" },
                    appearance: { background: colorVariable("primaryContrast") },
                    typography: { color: colorVariable("text") },
                }),
				button("bpdelayz", "Delay 0", {
					name: "Delay 0",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
				button("bpdelayd", "Delay 300", {
					name: "Delay 300",
					layout: { height: "fit", padding: 12, width: "fit" },
					appearance: { background: colorVariable("primaryContrast") },
					typography: { color: colorVariable("text") },
				}),
			],
		}),
		group("bpmsmqwg", {
			name: "Bound record",
			dataSource: search("Doc", {
				constraints: [{ field: "Title", operator: "equals", value: dynamicText("WTF-260 ", element("wtf-260-autobinding").state("Selected record")) }],
			})
				.firstItem(),
			groupType: dataTypeRef("Doc"),
			layout: { collapseWhenHidden: false, container: "column", height: "fit", padding: 8, alignSelf: "flex-start", width: "fill" },
			appearance: { background: "#FFFFFF" },
			children: [
				plugin("bpmsmqwi", {
					type: "1670612027178x122079323974008830_current-AAC",
					name: "Autobound editor",
					style: "Standard tiptap",
					layout: { collapseWhenHidden: false, minHeight: 240, alignSelf: "stretch" },
					appearance: { htmlId: "wtf260-editor" },
					properties: {
						autobinding_record_id: dynamicText(parentThing().uniqueId()),
						collab_active: false,
						ext_mention: false,
						file_upload_condition: false,
						isEditable: true,
						mention_list_type: dataTypeRef("Doc"),
						update_delay: element("wtf-260-autobinding").state("Save delay"),
                        autobinding_save_delay: element("wtf-260-autobinding").state("Save delay"),
					},
				}),
				text("bpmsmqwh", dynamicText(parentThing().field("Title")), { name: "Current record", layout: { height: "fit", alignSelf: "flex-start", width: "fit" } }),
				text("bpmsmqwj", dynamicText("Stored HTML: ", parentThing().field("HTML")), {
					name: "Stored HTML",
					layout: { height: "fit", alignSelf: "flex-start", width: "fit" },
				}),
			],
		}),
	],
});
