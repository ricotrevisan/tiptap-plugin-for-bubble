// @buildprint raw-locations: 1

import { rawBubble, plugin, colorVariable, dynamicText, element, fontVariable, group, page, text } from "@buildprint/bubblescript";

export default page("bTGzU", {
	name: "test",
	title: "tiptap-plugin",
	layout: { builderWidth: 1080, container: "column", gap: 32, height: "fill", minHeight: 767, width: "fill", minWidth: 0 },
	appearance: { background: "#FFFFFF" },
	children: [
		group("bTHkg", {
			name: "Group A",
			style: "Standard Group",
			layout: {
				collapseWhenHidden: false,
				container: "row",
				columnGap: 16,
				height: "fit",
				minHeight: 0,
				margin: "96px 16px",
				alignSelf: "center",
				width: "fill",
				minWidth: 0,
				maxWidth: 1280,
				zIndex: 4,
			},
			children: [
				plugin("bTHRu", {
					type: "1580238841425x582072028873097200-AAC",
					name: "RichTextInput A",
					layout: { collapseWhenHidden: false, minHeight: 200, minWidth: 0, zIndex: 2 },
					properties: { complexity: "Basic", placeholder: "Hello world" },
				}),
				group("bTHkx", {
					name: "Group D",
					style: "Standard Group",
					layout: {
						collapseWhenHidden: false,
						container: "column",
						gap: 32,
						height: "fit",
						minHeight: 0,
						alignSelf: "flex-start",
						width: "fill",
						minWidth: 0,
						zIndex: 6,
					},
					children: [
						group("bTHkl", {
							name: "Group B",
							style: "Standard Group",
							layout: {
								collapseWhenHidden: false,
								container: "column",
								gap: 4,
								height: "fit",
								minHeight: 0,
								alignSelf: "flex-start",
								width: "fill",
								minWidth: 0,
								zIndex: 4,
							},
							children: [
								text("bTHkp", "Raw output (what RTE saves to the database)", {
									name: "Text B",
									style: "Body",
									layout: { collapseWhenHidden: false, height: "fit", minHeight: 0, alignSelf: "flex-start", width: "fill", minWidth: 0, zIndex: 4 },
								}),
								text("bTHkd", dynamicText(element("RichTextInput A").state("value")), {
									name: "Text A",
									layout: {
										collapseWhenHidden: false,
										height: "fit",
										minHeight: 0,
										padding: 16,
										alignSelf: "flex-start",
										width: "fill",
										minWidth: 0,
										zIndex: 3,
									},
									appearance: { background: colorVariable("text") },
									typography: { color: colorVariable("primaryContrast"), fontFamily: fontVariable("app"), fontWeight: 400, fontSize: 14, lineHeight: 1.4 },
									properties: { noBbcode: true },
								}),
							],
						}),
						group("bTHks", {
							name: "Group C",
							style: "Standard Group",
							layout: {
								collapseWhenHidden: false,
								container: "column",
								gap: 4,
								height: "fit",
								minHeight: 0,
								alignSelf: "flex-start",
								width: "fill",
								minWidth: 0,
								zIndex: 5,
							},
							raw: rawBubble({ current_parent: "bTHkg.elements", order: 3 }),
							children: [
								text("bTHkv", "Formatted output", {
									name: "Text C",
									style: "Body",
									layout: { collapseWhenHidden: false, height: "fit", minHeight: 0, alignSelf: "flex-start", width: "fill", minWidth: 0, zIndex: 4 },
								}),
								text("bTHku", dynamicText(element("RichTextInput A").state("value")), {
									name: "Text C",
									layout: {
										collapseWhenHidden: false,
										height: "fit",
										minHeight: 0,
										padding: 16,
										alignSelf: "flex-start",
										width: "fill",
										minWidth: 0,
										zIndex: 3,
									},
									appearance: { background: colorVariable("text") },
									typography: { color: colorVariable("primaryContrast"), fontFamily: fontVariable("app"), fontWeight: 400, fontSize: 14, lineHeight: 1.4 },
									properties: { noBbcode: false },
								}),
							],
						}),
					],
				}),
			],
		}),
	],
});
