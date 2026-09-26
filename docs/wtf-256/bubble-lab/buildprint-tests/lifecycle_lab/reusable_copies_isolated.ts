import { test, step } from "@buildprint/bubblescript/testing";
import { lab_open } from "../components/lab_open";

export default test("reusable_copies_isolated", {
  name: "Two copies of a reusable each use their own menu",
  description: "Both copies of lab-editor-copy contain a menu group with the ID labDupMenu. Selecting text in the second copy shows only its own menu, and its button changes only that copy. WTF-256 lifecycle lab.",
  steps: [
    lab_open({}),
    step({
      name: "Drag-select text in the second copy",
      run: `read x1 y1 x2 y2 <<< "$(agent-browser eval "(() => { const e = [...document.querySelectorAll('.tiptap')].filter(n => n.textContent.includes('Reusable copy'))[1].firstElementChild; e.scrollIntoView({ block: 'center' }); const r = document.createRange(); r.selectNodeContents(e); const rs = r.getClientRects(); const f = rs[0], l = rs[rs.length - 1]; return [Math.round(f.left + 2), Math.round(f.top + f.height / 2), Math.round(l.right - 2), Math.round(l.top + l.height / 2)].join(' '); })()" | jq -r .)"
agent-browser mouse move $x1 $y1
agent-browser mouse down
agent-browser mouse move $x2 $y2
agent-browser mouse up
sleep 1`,
    }),
    step({
      name: "Only the second copy's menu is visible",
      run: `test "$(agent-browser eval "[...document.querySelectorAll('[id=labDupMenu]')].map(n => getComputedStyle(n).visibility).join(',')" | jq -r .)" = "hidden,visible"`,
    }),
    step({
      name: "Click the visible copy menu's button",
      run: `read x y <<< "$(agent-browser eval "(() => { const n = [...document.querySelectorAll('[id=labDupMenu]')].find(n => getComputedStyle(n).visibility === 'visible'); const r = n.querySelector('button, .clickable-element').getBoundingClientRect(); return Math.round(r.left + r.width / 2) + ' ' + Math.round(r.top + r.height / 2); })()" | jq -r .)"
agent-browser mouse move $x $y
agent-browser mouse down
agent-browser mouse up
sleep 1.5`,
    }),
    step({
      name: "Only the second copy changed, once",
      run: `test "$(agent-browser eval "[...document.querySelectorAll('.tiptap')].filter(n => n.textContent.includes('Reusable copy')).map(e => e.querySelectorAll('h1').length).join(',')" | jq -r .)" = "0,1"
agent-browser eval "document.body.innerText" | jq -r . | grep -c "Copy H1: 1" | grep -qx 1`,
    }),
  ],
});
