import { component, step, p } from "@buildprint/bubblescript/testing";

// Clicks the first control of a menu with the real mouse, where the user would.
export default component("lab_click_menu", {
  params: { menu: "string" },
  steps: [
    step({
      name: "Click the menu's first button",
      run: `menu=${p.menu}
read vis hit x y z <<< "$(agent-browser eval "labMenu('$menu')" | jq -r .)"
agent-browser mouse move $x $y
agent-browser mouse down
agent-browser mouse up
sleep 1.5`,
    }),
  ],
});
