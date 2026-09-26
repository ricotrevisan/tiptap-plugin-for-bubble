import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const require = createRequire(import.meta.url);
const actionDirectory = new URL(
    "../../src/actions/convert-webhook-payload-to-html-convert_webhook/",
    import.meta.url,
);
const metadata = JSON.parse(
    await readFile(new URL("convert-webhook-payload-to-html.json", actionDirectory), "utf8"),
);
const declaredDependencies = JSON.parse(metadata.code.package.fn).dependencies;

assert.equal(
    declaredDependencies.jsdom,
    "22.1.0",
    "Bubble runs server actions on Node 18, so jsdom must stay pinned to the compatible release",
);

const installedJsdom = require("jsdom/package.json");
assert.equal(installedJsdom.version, declaredDependencies.jsdom);
assert.equal(installedJsdom.engines.node, ">=16");

const source = await readFile(new URL("server.js", actionDirectory), "utf8");
const runAction = new AsyncFunction("properties", "context", "require", source);
const result = await runAction(
    {
        payload: JSON.stringify({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "Issue 30 smoke" }],
                },
            ],
        }),
        field_name: "default",
    },
    {},
    require,
);

assert.deepEqual(result, {
    html: "<p>Issue 30 smoke</p>",
    error: "",
    returned_an_error: false,
});

const alignedImageResult = await runAction(
    {
        payload: JSON.stringify({
            type: "doc",
            content: [
                {
                    type: "image",
                    attrs: {
                        src: "https://example.test/image.png",
                        textAlign: "center",
                    },
                },
            ],
        }),
        field_name: "default",
    },
    {},
    require,
);
assert.equal(alignedImageResult.returned_an_error, false);
assert.match(alignedImageResult.html, /text-align:\s*center/);
assert.match(alignedImageResult.html, /margin-left:\s*auto/);
assert.match(alignedImageResult.html, /margin-right:\s*auto/);

// WTF-234: math nodes keep the editor's HTML (docs/wtf-234/math-contract.md, case 18).
const mathResult = await runAction(
    {
        payload: JSON.stringify({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Area " },
                        { type: "inlineMath", attrs: { latex: "\\pi r^2 < 4" } },
                    ],
                },
                { type: "blockMath", attrs: { latex: "\\sum_{i=1}^n i" } },
            ],
        }),
        field_name: "default",
    },
    {},
    require,
);
assert.deepEqual(mathResult, {
    html: '<p>Area <span data-latex="\\pi r^2 < 4" data-type="inline-math">\\pi r^2 &lt; 4</span></p>'
        + '<div data-latex="\\sum_{i=1}^n i" data-type="block-math">\\sum_{i=1}^n i</div>',
    error: "",
    returned_an_error: false,
});

const malformedResult = await runAction(
    { payload: "not JSON", field_name: "default" },
    {},
    require,
);
assert.equal(malformedResult.html, "");
assert.match(malformedResult.error, /^Failed to parse input as JSON:/);
assert.equal(malformedResult.returned_an_error, true);

console.log("webhook HTML action uses the Node 18-compatible DOM dependency");
