import { component, step, p } from "@buildprint/bubblescript/testing";

// Selects the first block of the editor containing the text with a real mouse drag.
export default component("lab_select", {
  params: { text: "string" },
  steps: [
    step({
      name: "Drag-select text in the editor",
      run: `text=${p.text}
read x1 y1 x2 y2 <<< "$(agent-browser eval "labBlock('$text')" | jq -r .)"
agent-browser mouse move $x1 $y1
agent-browser mouse down
agent-browser mouse move $x2 $y2
agent-browser mouse up
sleep 1`,
    }),
  ],
});
