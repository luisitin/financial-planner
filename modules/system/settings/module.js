import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "settings",
  group: "system",
  title: "Settings",
  icon: "⚙️",
  order: 1,
  version: 1,
  status: "usable",
  phase: 0,
  enabledByDefault: true,     // never disable: it is how you reach the toggles
  needs: ["meta"],
  writes: ["meta"],
  heavy: false,
  purpose: "Connect this device to the PC, choose the AI model, turn pages on or off, export or import your plan.",
  aliases: ["connect to the PC", "server", "phone setup", "export", "import", "backup", "AI", "Ollama"],
  compute,
  render,
};
