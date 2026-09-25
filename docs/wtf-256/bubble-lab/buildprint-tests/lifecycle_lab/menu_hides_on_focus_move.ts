import { test, step } from "@buildprint/bubblescript/testing";
import { lab_open } from "../components/lab_open";
import { lab_select } from "../components/lab_select";

export default test("menu_hides_on_focus_move", {
  name: "A menu hides when focus moves to another editor",
  description: "Menu A must hide, and stop catching clicks, when the user selects text in editor B, including after typing in menu A's own input. Before WTF-256 it stayed visible and clickable.",
  steps: [
    lab_open({}),
    lab_select({ text: "Editor A." }),
    step({
      name: "Menu A shows",
      run: `test "$(agent-browser eval "labMenu('labMenuA')" | jq -r . | cut -d' ' -f1)" = visible`,
    }),
    lab_select({ text: "Editor B." }),
    step({
      name: "Menu A is hidden and not clickable after moving to editor B",
      run: `read vis hit x y z <<< "$(agent-browser eval "labMenu('labMenuA')" | jq -r .)"
test "$vis" = hidden
test "$hit" = false`,
    }),
    lab_select({ text: "Editor A." }),
    step({
      name: "Type in menu A's input",
      run: `agent-browser click "#lab-menu-a-input"
agent-browser keyboard type "https://example.com"
sleep 1
test "$(agent-browser eval "labMenu('labMenuA')" | jq -r . | cut -d' ' -f1)" = visible`,
    }),
    lab_select({ text: "Editor B." }),
    step({
      name: "Menu A is hidden after leaving its input for editor B",
      run: `read vis hit x y z <<< "$(agent-browser eval "labMenu('labMenuA')" | jq -r .)"
test "$vis" = hidden
test "$hit" = false`,
    }),
  ],
});
