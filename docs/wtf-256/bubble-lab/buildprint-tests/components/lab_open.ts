import { component, step, url } from "@buildprint/bubblescript/testing";

// Opens the WTF-256 lifecycle lab and installs two read-only page helpers:
// labMenu(id) reports a menu's visibility, z-index and whether a pointer at its
// first control reaches it; labBlock(text) gives drag coordinates across the
// first block of the editor containing text.
export default component("lab_open", {
  params: {},
  steps: [
    step({
      name: "Open the lifecycle lab",
      run: `agent-browser open ${url("lifecycle-lab")} --headers "$BUILDPRINT_RUN_MODE_AUTH_HEADER"
agent-browser wait --fn "document.querySelectorAll('.tiptap').length >= 6" --timeout 60000`,
      timeoutMs: 70000,
    }),
    step({
      name: "Install the page helpers",
      run: `agent-browser eval "window.labMenu = id => { const n = document.getElementById(id); const s = getComputedStyle(n); const t = n.querySelector('button, .clickable-element, input') || n; const r = t.getBoundingClientRect(); const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2); const h = document.elementFromPoint(x, y); return [s.visibility, String(!!h && n.contains(h)), x, y, Number(n.style.zIndex) || 0].join(' '); }; window.labBlock = text => { const e = [...document.querySelectorAll('.tiptap')].find(n => n.textContent.includes(text)).firstElementChild; e.scrollIntoView({ block: 'center' }); const r = document.createRange(); r.selectNodeContents(e); const rs = r.getClientRects(); const f = rs[0], l = rs[rs.length - 1]; return [Math.round(f.left + 2), Math.round(f.top + f.height / 2), Math.round(l.right - 2), Math.round(l.top + l.height / 2)].join(' '); }; true"`,
    }),
  ],
});
