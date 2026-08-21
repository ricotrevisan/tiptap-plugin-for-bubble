const canvas = instance.canvas[0] || instance.canvas.get?.(0);
canvas.replaceChildren();
const nav = document.createElement("nav");
nav.setAttribute("aria-label", "Table of contents preview");
nav.style.font = "inherit";
nav.innerHTML = "<ul style=\"list-style:none;margin:0;padding:0\"><li>Introduction</li><li style=\"padding-inline-start:16px;margin-top:6px\">Getting started</li><li style=\"padding-inline-start:16px;margin-top:6px;font-weight:600\">Configuration</li><li style=\"margin-top:6px\">Next steps</li></ul>";
canvas.appendChild(nav);