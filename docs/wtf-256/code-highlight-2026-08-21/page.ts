// @buildprint raw-locations: 1

import {
	plugin,
	arbitraryText,
	button,
	colorVariable,
	dropdown,
	dynamicText,
	element,
	fontVariable,
	group,
	html,
	page,
	search,
	staticText,
	text,
	thisItem,
} from "@buildprint/bubblescript";

export default page("bTIAL", {
	name: "code_highlight",
	title: "tiptap-plugin",
	layout: { builderWidth: 1080, container: "column", height: "fill", minHeight: 767, width: "fill", minWidth: 0 },
	appearance: { background: "#FFFFFF" },
	children: [
		plugin("bTIAX", {
			type: "1680072712220x425578562619179000_current-AAC",
			name: "codehighlighter A",
			layout: { collapseWhenHidden: false, zIndex: 5 },
			properties: { dynamicStyle: element("Dropdown A").value() },
		}),
		group("bTIAa", {
			name: "Group A",
			style: "Standard Group",
			layout: {
				collapseWhenHidden: false,
				container: "row",
				gap: 20,
				height: "fit",
				minHeight: 0,
				padding: "20px 40px",
				alignSelf: "center",
				width: "fit",
				minWidth: 0,
				zIndex: 6,
			},
			children: [
				group("bTIAq", {
					name: "Group Styles",
					style: "Standard Group",
					layout: {
						collapseWhenHidden: false,
						container: "column",
						gap: 5,
						height: "fit",
						minHeight: 0,
						alignSelf: "flex-start",
						width: "fit",
						minWidth: 0,
						zIndex: 6,
					},
					children: [
						text("bTIAu", "STYLES", {
							name: "Text A",
							layout: { collapseWhenHidden: false, height: "fit", minHeight: 0, alignSelf: "flex-start", width: "fill", minWidth: 0, zIndex: 4 },
							typography: { color: colorVariable("slate-500"), fontFamily: fontVariable("app"), fontWeight: 500, fontSize: 12, lineHeight: 1.4 },
						}),
						dropdown("bTIAT", {
							name: "Dropdown A",
							style: "Standard Dropdown",
							value: "Base16 / Brogrammer",
							options: arbitraryText(
								staticText(
									"Default,A 11 Y Dark,A 11 Y Light,Agate,An Old Hope,Androidstudio,Arduino Light,Arta,Ascetic,Atom One Dark,Atom One Dark Reasonable,Atom One Light,Base16 / 3024,Base16 / Apathy,Base16 / Apprentice,Base16 / Ashes,Base16 / Atelier Cave,Base16 / Atelier Cave Light,Base16 / Atelier Dune,Base16 / Atelier Dune Light,Base16 / Atelier Estuary,Base16 / Atelier Estuary Light,Base16 / Atelier Forest,Base16 / Atelier Forest Light,Base16 / Atelier Heath,Base16 / Atelier Heath Light,Base16 / Atelier Lakeside,Base16 / Atelier Lakeside Light,Base16 / Atelier Plateau,Base16 / Atelier Plateau Light,Base16 / Atelier Savanna,Base16 / Atelier Savanna Light,Base16 / Atelier Seaside,Base16 / Atelier Seaside Light,Base16 / Atelier Sulphurpool,Base16 / Atelier Sulphurpool Light,Base16 / Atlas,Base16 / Bespin,Base16 / Black Metal,Base16 / Black Metal Bathory,Base16 / Black Metal Burzum,Base16 / Black Metal Dark Funeral,Base16 / Black Metal Gorgoroth,Base16 / Black Metal Immortal,Base16 / Black Metal Khold,Base16 / Black Metal Marduk,Base16 / Black Metal Mayhem,Base16 / Black Metal Nile,Base16 / Black Metal Venom,Base16 / Brewer,Base16 / Bright,Base16 / Brogrammer,Base16 / Brush Trees,Base16 / Brush Trees Dark,Base16 / Chalk,Base16 / Circus,Base16 / Classic Dark,Base16 / Classic Light,Base16 / Codeschool,Base16 / Colors,Base16 / Cupcake,Base16 / Cupertino,Base16 / Danqing,Base16 / Darcula,Base16 / Dark Violet,Base16 / Darkmoss,Base16 / Darktooth,Base16 / Decaf,Base16 / Default Dark,Base16 / Default Light,Base16 / Dirtysea,Base16 / Dracula,Base16 / Edge Dark,Base16 / Edge Light,Base16 / Eighties,Base16 / Embers,Base16 / Equilibrium Dark,Base16 / Equilibrium Gray Dark,Base16 / Equilibrium Gray Light,Base16 / Equilibrium Light,Base16 / Espresso,Base16 / Eva,Base16 / Eva Dim,Base16 / Flat,Base16 / Framer,Base16 / Fruit Soda,Base16 / Gigavolt,Base16 / Github,Base16 / Google Dark,Base16 / Google Light,Base16 / Grayscale Dark,Base16 / Grayscale Light,Base16 / Green Screen,Base16 / Gruvbox Dark Hard,Base16 / Gruvbox Dark Medium,Base16 / Gruvbox Dark Pale,Base16 / Gruvbox Dark Soft,Base16 / Gruvbox Light Hard,Base16 / Gruvbox Light Medium,Base16 / Gruvbox Light Soft,Base16 / Hardcore,Base16 / Harmonic 16 Dark,Base16 / Harmonic 16 Light,Base16 / Heetch Dark,Base16 / Heetch Light,Base16 / Helios,Base16 / Hopscotch,Base16 / Horizon Dark,Base16 / Horizon Light,Base16 / Humanoid Dark,Base16 / Humanoid Light,Base16 / Ia Dark,Base16 / Ia Light,Base16 / Icy Dark,Base16 / Ir Black,Base16 / Isotope,Base16 / Kimber,Base16 / London Tube,Base16 / Macintosh,Base16 / Marrakesh,Base16 / Materia,Base16 / Material,Base16 / Material Darker,Base16 / Material Lighter,Base16 / Material Palenight,Base16 / Material Vivid,Base16 / Mellow Purple,Base16 / Mexico Light,Base16 / Mocha,Base16 / Monokai,Base16 / Nebula,Base16 / Nord,Base16 / Nova,Base16 / Ocean,Base16 / Oceanicnext,Base16 / One Light,Base16 / Onedark,Base16 / Outrun Dark,Base16 / Papercolor Dark,Base16 / Papercolor Light,Base16 / Paraiso,Base16 / Pasque,Base16 / Phd,Base16 / Pico,Base16 / Pop,Base16 / Porple,Base16 / Qualia,Base16 / Railscasts,Base16 / Rebecca,Base16 / Ros Pine,Base16 / Ros Pine Dawn,Base16 / Ros Pine Moon,Base16 / Sagelight,Base16 / Sandcastle,Base16 / Seti Ui,Base16 / Shapeshifter,Base16 / Silk Dark,Base16 / Silk Light,Base16 / Snazzy,Base16 / Solar Flare,Base16 / Solar Flare Light,Base16 / Solarized Dark,Base16 / Solarized Light,Base16 / Spacemacs,Base16 / Summercamp,Base16 / Summerfruit Dark,Base16 / Summerfruit Light,Base16 / Synth Midnight Terminal Dark,Base16 / Synth Midnight Terminal Light,Base16 / Tango,Base16 / Tender,Base16 / Tomorrow,Base16 / Tomorrow Night,Base16 / Twilight,Base16 / Unikitty Dark,Base16 / Unikitty Light,Base16 / Vulcan,Base16 / Windows 10,Base16 / Windows 10 Light,Base16 / Windows 95,Base16 / Windows 95 Light,Base16 / Windows High Contrast,Base16 / Windows High Contrast Light,Base16 / Windows Nt,Base16 / Windows Nt Light,Base16 / Woodland,Base16 / Xcode Dusk,Base16 / Zenburn,Brown Paper,Codepen Embed,Color Brewer,Dark,Devibeans,Docco,Far,Felipec,Foundation,Github,Github Dark,Github Dark Dimmed,Gml,Googlecode,Gradient Dark,Gradient Light,Grayscale,Hybrid,Idea,Intellij Light,Ir Black,Isbl Editor Dark,Isbl Editor Light,Kimbie Dark,Kimbie Light,Lightfair,Lioshi,Magula,Mono Blue,Monokai,Monokai Sublime,Night Owl,Nnfx Dark,Nnfx Light,Nord,Obsidian,Panda Syntax Dark,Panda Syntax Light,Paraiso Dark,Paraiso Light,Pojoaque,Purebasic,Qtcreator Dark,Qtcreator Light,Rainbow,Routeros,School Book,Shades Of Purple,Srcery,Stackoverflow Dark,Stackoverflow Light,Sunburst,Tokyo Night Dark,Tokyo Night Light,Tomorrow Night Blue,Tomorrow Night Bright,Vs,Vs 2015,Xcode,Xt 256",
								),
							)
								.splitBy(","),
							optionLabel: dynamicText(thisItem()),
							layout: { collapseWhenHidden: false, height: 48, alignSelf: "center", width: 250, zIndex: 3 },
						}),
					],
				}),
				button("bTIAh", "highlight", {
					name: "Button A",
					style: "Primary Button",
					layout: { collapseWhenHidden: false, height: "fit", minHeight: 0, alignSelf: "flex-end", width: "fit", minWidth: 0, zIndex: 4 },
				}),
			],
		}),
		html("bTIAW", dynamicText(
			search("Doc", { constraints: [{ field: "unique id", operator: "equals", value: "1671742816306x214931179238394100" }] }).firstItem().field("HTML"),
		), {
			name: "HTML A",
			style: "Standard HTML",
			layout: { collapseWhenHidden: false, height: "fit", minHeight: 150, alignSelf: "center", width: "fill", minWidth: 0, maxWidth: 680, zIndex: 4 },
			properties: { deferDrawing: true },
		}),
	],
});
