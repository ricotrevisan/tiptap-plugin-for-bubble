const canvas = instance.canvas[0] || instance.canvas.get?.(0);
const uid = `tiptap-toc-${Math.random().toString(36).slice(2)}`;
const style = document.createElement("style");
const root = document.createElement("div");
root.dataset.tiptapToc = uid;
canvas.appendChild(style);
canvas.appendChild(root);

instance.data.tocRoot = root;
instance.data.tocStyle = style;
instance.data.tocItems = [];
instance.data.tocAnchors = new Map();
instance.data.tocStructureSignature = "";
instance.data.tocOptions = { autoScroll: true, behavior: "smooth", block: "start" };
instance.data.tocLastError = "";

instance.publishState("clicked_heading_id", "");

function clampNumber(value, fallback, minimum, maximum) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function reportError(message, context) {
    instance.data.tocClickedHeadingId = "";
    instance.publishState("clicked_heading_id", "");
    if (instance.data.tocLastError !== message) {
        instance.data.tocLastError = message;
        context?.reportDebugger?.(`Table of Contents: ${message}`);
    }
}

function clearError() {
    instance.data.tocLastError = "";
}

function parseItems(value) {
    const source = typeof value === "string" ? value.trim() : "";
    if (!source) return [];
    let parsed;
    try {
        parsed = JSON.parse(source);
    } catch {
        throw new Error("JSON input is not valid JSON.");
    }
    if (!Array.isArray(parsed)) throw new Error("JSON input must be an array.");
    const ids = new Set();
    let previousLevel = 0;
    return parsed.map((item, index) => {
        const path = `Item ${index + 1}`;
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new Error(`${path} must be an object.`);
        }
        const id = typeof item.id === "string" ? item.id.trim() : "";
        if (!id) throw new Error(`${path} must have a non-empty id.`);
        if (ids.has(id)) throw new Error(`${path} repeats heading id "${id}".`);
        ids.add(id);
        if (typeof item.textContent !== "string" || !item.textContent.trim()) {
            throw new Error(`${path} must have non-empty textContent.`);
        }
        const level = Number(item.level);
        if (!Number.isInteger(level) || level < 1 || level > 6) {
            throw new Error(`${path} level must be an integer from 1 to 6.`);
        }
        if (index === 0 && level !== 1) throw new Error("The first heading level must be 1.");
        if (index > 0 && level > previousLevel + 1) {
            throw new Error(`${path} level cannot jump from ${previousLevel} to ${level}.`);
        }
        previousLevel = level;
        return {
            id,
            textContent: item.textContent,
            level,
            isActive: item.isActive === true,
            isScrolledOver: item.isScrolledOver === true,
        };
    });
}

function applyItemState(anchor, item) {
    anchor.dataset.active = String(item.isActive);
    anchor.dataset.scrolledOver = String(item.isScrolledOver);
    if (item.isActive) anchor.setAttribute("aria-current", "location");
    else anchor.removeAttribute("aria-current");
}

function buildNavigation(items, label) {
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", label || "Table of contents");
    const rootList = document.createElement("ul");
    nav.appendChild(rootList);
    const stack = [{ list: rootList, lastItem: null }];
    const anchors = new Map();

    items.forEach((item) => {
        while (stack.length > item.level) stack.pop();
        while (stack.length < item.level) {
            const parentItem = stack[stack.length - 1].lastItem;
            const nestedList = document.createElement("ul");
            parentItem.appendChild(nestedList);
            stack.push({ list: nestedList, lastItem: null });
        }
        const listItem = document.createElement("li");
        const anchor = document.createElement("a");
        anchor.href = `#${encodeURIComponent(item.id)}`;
        anchor.dataset.headingId = item.id;
        anchor.textContent = item.textContent;
        applyItemState(anchor, item);
        listItem.appendChild(anchor);
        stack[stack.length - 1].list.appendChild(listItem);
        stack[stack.length - 1].lastItem = listItem;
        anchors.set(item.id, anchor);
    });

    return { nav, anchors };
}

instance.data.renderTableOfContents = function (properties, context) {
    const indent = clampNumber(properties.indent_px, 16, 0, 64);
    const gap = clampNumber(properties.item_gap_px, 4, 0, 32);
    const normalColor = properties.normal_color || "rgba(15,23,42,1)";
    const scrolledOverColor = properties.scrolled_over_color || "rgba(100,116,139,1)";
    const activeColor = properties.active_color || "rgba(79,70,229,1)";
    const activeBackground = properties.active_background || "rgba(79,70,229,0.12)";
    const activeFontWeight = ["400", "500", "600", "700", "800", "900"].includes(String(properties.active_font_weight))
        ? String(properties.active_font_weight)
        : "600";
    const activeIndicatorWidth = clampNumber(properties.active_indicator_width, 3, 0, 8);
    style.textContent = `
[data-tiptap-toc="${uid}"] { width: 100%; height: 100%; }
[data-tiptap-toc="${uid}"] nav, [data-tiptap-toc="${uid}"] ul { margin: 0; padding: 0; }
[data-tiptap-toc="${uid}"] ul { list-style: none; }
[data-tiptap-toc="${uid}"] ul ul { padding-inline-start: ${indent}px; margin-block-start: ${gap}px; }
[data-tiptap-toc="${uid}"] li + li { margin-block-start: ${gap}px; }
[data-tiptap-toc="${uid}"] a { display: block; box-sizing: border-box; color: ${normalColor}; font: inherit; line-height: 1.35; padding: 0.35em 0.5em; border-inline-start: ${activeIndicatorWidth}px solid transparent; border-radius: 4px; text-decoration: none; cursor: pointer; }
[data-tiptap-toc="${uid}"] a[data-scrolled-over="true"] { color: ${scrolledOverColor}; }
[data-tiptap-toc="${uid}"] a[data-active="true"] { color: ${activeColor}; background: ${activeBackground}; border-inline-start-color: currentColor; font-weight: ${activeFontWeight}; }
[data-tiptap-toc="${uid}"] a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
`;

    instance.data.tocOptions = {
        autoScroll: properties.auto_scroll !== false,
        behavior: ["smooth", "auto"].includes(properties.scroll_behavior) ? properties.scroll_behavior : "smooth",
        block: ["start", "center", "end", "nearest"].includes(properties.scroll_block) ? properties.scroll_block : "start",
    };

    let items;
    try {
        items = parseItems(properties.contents_json);
    } catch (error) {
        root.replaceChildren();
        instance.data.tocItems = [];
        instance.data.tocAnchors = new Map();
        instance.data.tocStructureSignature = "";
        reportError(error.message, context);
        return;
    }

    clearError();
    const currentIds = new Set(items.map((item) => item.id));
    const clickedId = instance.data.tocClickedHeadingId || "";
    if (clickedId && !currentIds.has(clickedId)) {
        instance.data.tocClickedHeadingId = "";
        instance.publishState("clicked_heading_id", "");
    }

    if (items.length === 0) {
        root.replaceChildren();
        instance.data.tocItems = [];
        instance.data.tocAnchors = new Map();
        instance.data.tocStructureSignature = "";
        return;
    }

    const structureSignature = JSON.stringify(items.map(({ id, textContent, level }) => [id, textContent, level]));
    const label = typeof properties.accessible_label === "string" && properties.accessible_label.trim()
        ? properties.accessible_label.trim()
        : "Table of contents";
    if (structureSignature !== instance.data.tocStructureSignature) {
        const navigation = buildNavigation(items, label);
        root.replaceChildren(navigation.nav);
        instance.data.tocAnchors = navigation.anchors;
        instance.data.tocStructureSignature = structureSignature;
    } else {
        root.querySelector("nav")?.setAttribute("aria-label", label);
        items.forEach((item) => applyItemState(instance.data.tocAnchors.get(item.id), item));
    }
    instance.data.tocItems = items;
};

instance.data.tocClickHandler = function (event) {
    const anchor = event.target.closest?.("a[data-heading-id]");
    if (!anchor || !root.contains(anchor)) return;
    event.preventDefault();
    const headingId = anchor.dataset.headingId;
    instance.data.tocClickedHeadingId = headingId;
    instance.publishState("clicked_heading_id", headingId);
    instance.triggerEvent("heading_clicked");
    if (instance.data.tocOptions.autoScroll) {
        document.getElementById(headingId)?.scrollIntoView({
            behavior: instance.data.tocOptions.behavior,
            block: instance.data.tocOptions.block,
        });
    }
};
root.addEventListener("click", instance.data.tocClickHandler);