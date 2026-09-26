// WTF-234: real-Bubble check that KaTeX loads from the real jsDelivr (SRI) and
// renders with its own fonts inside Bubble's page CSS. Not part of CI. From lib/:
//   node tests/browser/check-bubble-math.mjs [--local-bundle=<git ref>] [--screenshot=<path>] [url]
// --local-bundle=<ref> serves this checkout's built dist.js in place of the
// bundle named in headers.html at <ref> (the pushed version), so the check can
// run before a pled push. Nothing in Bubble is changed.
// It mounts a Mathematics editor from window.tiptap inside the first demo
// editor's Bubble element. The element's Bubble fields, actions and events need
// the pushed plugin (see docs/wtf-234/verification.md).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { openBubble, parseArgs } from './real-bubble.mjs';

const { url } = parseArgs('https://tiptap-plugin.bubbleapps.io/version-test/tiptap-demo');
const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const bundleRef = option('local-bundle');
const screenshot = option('screenshot');
const { page, load, check, finish } = await openBubble({ url, minEditors: 1 });
try {
  if (bundleRef) {
    const headers = execFileSync('git', ['show', `${bundleRef}:src/elements/tiptap-AAC/headers.html`], { cwd: '..', encoding: 'utf8' });
    // Bubble serves plugin assets from its own CDN host; match the path.
    const pushed = headers.match(/src="\/\/[^/]+(\/[^"]+\.js)"/)[1];
    await page.route(`**${pushed}`, route => route.fulfill({ body: readFileSync('dist.js'), contentType: 'text/javascript' }));
    console.log(`Serving local dist.js in place of ${pushed}`);
  }
  await load();
  check('the served bundle has Mathematics', await page.evaluate(() => typeof window.tiptap.loadKatex === 'function' && !!window.tiptap.InlineMath), {});
  const result = await page.evaluate(async () => {
    const { Editor, Document, Paragraph, Text, InlineMath, BlockMath, loadKatex } = window.tiptap;
    const host = document.querySelector('.tiptap').closest('.bubble-element');
    const element = document.createElement('div');
    element.id = 'wtf234-math-check';
    host.prepend(element);
    new Editor({
      element,
      extensions: [Document, Paragraph, Text,
        InlineMath.configure({ katexOptions: { throwOnError: false } }),
        BlockMath.configure({ katexOptions: { throwOnError: false, displayMode: true } })],
      content: '<p>Area <span data-type="inline-math" data-latex="\\pi r^2"></span>, bad <span data-type="inline-math" data-latex="\\frac{"></span></p>'
        + '<div data-type="block-math" data-latex="\\sum_{i=1}^n i = \\frac{n(n+1)}{2}"></div>',
    });
    const katex = await loadKatex().then(() => true, error => error.message);
    await document.fonts.ready;
    element.scrollIntoView();
    const style = selector => {
      const found = element.querySelector(selector);
      return found && { fontFamily: getComputedStyle(found).fontFamily, color: getComputedStyle(found).color, width: found.getBoundingClientRect().width };
    };
    return {
      katex,
      assets: [...document.querySelectorAll('[data-tiptap-katex]')].map(asset => ({ url: asset.src || asset.href, integrity: asset.integrity })),
      inline: style('.katex'),
      block: style('.katex-display'),
      error: style('.katex-error'),
      fonts: ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_Size2'].map(font => [font, document.fonts.check(`16px ${font}`)]),
      loadedFonts: [...document.fonts].filter(font => font.family.includes('KaTeX') && font.status === 'loaded').map(font => font.family),
    };
  });
  check('KaTeX script loaded from jsDelivr with SRI', result.katex === true && result.assets.length === 2 && result.assets.every(asset => /cdn\.jsdelivr\.net\/npm\/katex@0\.16\.29\//.test(asset.url) && /^sha384-/.test(asset.integrity)), { katex: result.katex, assets: result.assets });
  check('inline formula uses KaTeX fonts', /KaTeX_Main/.test(result.inline?.fontFamily) && result.inline.width > 0, result.inline);
  check('block formula renders in display mode', result.block?.width > 0, result.block);
  check('KaTeX fonts loaded', result.fonts.every(([, ok]) => ok) && result.loadedFonts.length > 0, { fonts: result.fonts, loadedFonts: [...new Set(result.loadedFonts)] });
  check('invalid LaTeX is red', result.error?.color === 'rgb(204, 0, 0)', result.error);
  if (screenshot) await page.locator('#wtf234-math-check').screenshot({ path: screenshot });
} catch (error) {
  check(`script error: ${error.message}`, false, {});
} finally {
  await finish();
}
