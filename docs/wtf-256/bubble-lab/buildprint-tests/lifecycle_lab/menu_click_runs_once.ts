import { test, step } from "@buildprint/bubblescript/testing";
import { lab_open } from "../components/lab_open";
import { lab_select } from "../components/lab_select";
import { lab_click_menu } from "../components/lab_click_menu";

export default test("menu_click_runs_once", {
  name: "A Bubble Menu click runs one action on its own editor",
  description: "Selecting text in editor A shows menu A above the editor. One real click on its H1 button runs the workflow once and changes only editor A. WTF-256 lifecycle lab.",
  steps: [
    lab_open({}),
    lab_select({ text: "Editor A." }),
    step({
      name: "Menu A is visible and reachable by the pointer",
      run: `read vis hit x y z <<< "$(agent-browser eval "labMenu('labMenuA')" | jq -r .)"
test "$vis" = visible
test "$hit" = true`,
    }),
    lab_click_menu({ menu: "labMenuA" }),
    step({
      name: "The H1 workflow ran once",
      run: `test "$(agent-browser eval "document.getElementById('lab-count-a-h1').textContent" | jq -r .)" = "A H1: 1"`,
    }),
    step({
      name: "Only editor A became a heading",
      run: `test "$(agent-browser eval "[...document.querySelectorAll('.tiptap')].map(e => e.querySelectorAll('h1').length + ':' + e.textContent.slice(0, 9)).filter(s => /Editor [AB]/.test(s)).join(',')" | jq -r .)" = "1:Editor A.,0:Editor B."`,
    }),
  ],
});
