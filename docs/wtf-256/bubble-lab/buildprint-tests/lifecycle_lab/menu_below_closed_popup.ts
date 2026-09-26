import { test, step } from "@buildprint/bubblescript/testing";
import { lab_open } from "../components/lab_open";
import { lab_select } from "../components/lab_select";

export default test("menu_below_closed_popup", {
  name: "A closed popup does not end up under later menus",
  description: "After the lab popup opens and closes, a menu shown later must stay below the popup's z-index, so the popup still appears above it when it reopens. Before WTF-256 the menu went above it.",
  steps: [
    lab_open({}),
    step({
      name: "Open and close the popup",
      run: `agent-browser click "#lab-open-popup"
agent-browser wait --fn "document.querySelectorAll('.tiptap').length >= 7" --timeout 20000
agent-browser eval "String([...document.querySelectorAll('.bubble-element.Popup')].map(p => getComputedStyle(p).zIndex).join(''))" | jq -r . > "$BUILDPRINT_TEST_ARTIFACT_DIR/popup-z-$BUILDPRINT_TEST_RUN_ID"
agent-browser click "#lab-close-popup"
sleep 1.5`,
      timeoutMs: 30000,
    }),
    lab_select({ text: "Editor A." }),
    step({
      name: "Menu A shows below the closed popup's layer",
      run: `popup=$(cat "$BUILDPRINT_TEST_ARTIFACT_DIR/popup-z-$BUILDPRINT_TEST_RUN_ID")
read vis hit x y z <<< "$(agent-browser eval "labMenu('labMenuA')" | jq -r .)"
echo "menu z=$z popup z=$popup"
test "$vis" = visible
test "$hit" = true
test "$z" -lt "$popup"`,
    }),
  ],
});
