import { test, step } from "@buildprint/bubblescript/testing";
import { lab_open } from "../components/lab_open";

export default test("floating_menu_divider_publishes", {
  name: "A Floating Menu button that ends the empty line still publishes the edit",
  description: "On an empty line in editor A, the Floating Menu's Divider button inserts a horizontal rule, which hides the menu while focus is on the button. The workflow must run once and Content (HTML) must include the rule. WTF-256 review finding: re-hiding from inside Tiptap's hide lost the update in Chromium.",
  steps: [
    lab_open({}),
    step({
      name: "Put the caret on a new empty line in editor A",
      run: `read x1 y1 x2 y2 <<< "$(agent-browser eval "labBlock('Editor A.')" | jq -r .)"
agent-browser mouse move $x2 $y2
agent-browser mouse down
agent-browser mouse up
sleep 0.5
agent-browser press End
agent-browser press Enter
sleep 1
test "$(agent-browser eval "labMenu('labFloatA')" | jq -r . | cut -d' ' -f1)" = visible`,
    }),
    step({
      name: "Click Divider with the real mouse",
      run: `read x y <<< "$(agent-browser eval "(() => { const r = document.getElementById('lab-a-divider').getBoundingClientRect(); return Math.round(r.left + r.width / 2) + ' ' + Math.round(r.top + r.height / 2); })()" | jq -r .)"
agent-browser mouse move $x $y
agent-browser mouse down
agent-browser mouse up
sleep 1.5`,
    }),
    step({
      name: "The Divider workflow ran once and the rule is in the editor",
      run: `test "$(agent-browser eval "document.getElementById('lab-count-a-hr').textContent" | jq -r .)" = "A Divider: 1"
test "$(agent-browser eval "String([...document.querySelectorAll('.tiptap')].find(e => e.textContent.includes('Editor A.')).querySelectorAll('hr').length)" | jq -r .)" = 1`,
    }),
    step({
      name: "Content (HTML) was published with the rule",
      run: `agent-browser eval "document.getElementById('lab-a-html').textContent" | jq -r . | grep -q "<hr>"`,
    }),
  ],
});
