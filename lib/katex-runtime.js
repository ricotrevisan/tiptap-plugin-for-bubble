// KaTeX for @tiptap/extension-mathematics without bundling it (WTF-234).
// The build aliases the extension's `katex` import to this module, so dist.js
// stays small and apps with Mathematics off never request KaTeX. Editors with
// Mathematics on call loadKatex(), which adds the pinned stylesheet (it loads
// the fonts) and script once per page. Formulas rendered before the script
// arrives show their raw LaTeX; each editor typesets its own formulas again
// once whenKatexLoaded() resolves.
// Contract: docs/wtf-234/math-contract.md.

const KATEX_BASE = "https://cdn.jsdelivr.net/npm/katex@0.16.29/dist/";
const KATEX_ASSETS = {
    css: { url: KATEX_BASE + "katex.min.css", integrity: "sha384-aKaoM0KVxt5vkmTHL4GAGXO2P1JTsTJ73egG6+Brhf70Apf9rfPzegvgcWGBk3cS" },
    js: { url: KATEX_BASE + "katex.min.js", integrity: "sha384-Nb8LtjZTKLgHUQ9V7avGfqntEr9VJWRr07IFUImhYDmZBjH+V9k1N0OrCXLdW85/" },
};

let loading = null;
let markLoaded;
// Resolves the first time KaTeX is available, even after earlier failed loads.
const loaded = new Promise((resolve) => { markLoaded = resolve; });

export default {
    render(latex, element, options) {
        if (window.katex) return window.katex.render(latex, element, options);
        element.textContent = latex;
    },
};

export function whenKatexLoaded() {
    return loaded;
}

function katexAsset(tag, attributes) {
    const element = document.createElement(tag);
    Object.assign(element, attributes, { crossOrigin: "anonymous" });
    element.dataset.tiptapKatex = "";
    return element;
}

// Resolves with window.katex; rejects when the script can't be loaded. A
// failed stylesheet or script is removed so a later editor can try again.
export function loadKatex() {
    if (!document.querySelector("link[data-tiptap-katex]")) {
        const stylesheet = katexAsset("link", { rel: "stylesheet", href: KATEX_ASSETS.css.url, integrity: KATEX_ASSETS.css.integrity });
        stylesheet.onerror = () => stylesheet.remove();
        document.head.appendChild(stylesheet);
    }
    if (window.katex) {
        markLoaded(window.katex);
        return Promise.resolve(window.katex);
    }
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
        const script = katexAsset("script", { src: KATEX_ASSETS.js.url, integrity: KATEX_ASSETS.js.integrity });
        script.onerror = () => {
            script.remove();
            reject(new Error("KaTeX could not be loaded from " + KATEX_ASSETS.js.url));
        };
        script.onload = () => {
            if (!window.katex) return script.onerror();
            markLoaded(window.katex);
            resolve(window.katex);
        };
        document.head.appendChild(script);
    });
    // After the assignment above: a blocked script can fail synchronously.
    loading.catch(() => { loading = null; });
    return loading;
}
