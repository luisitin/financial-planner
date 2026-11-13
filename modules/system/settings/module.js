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
  purpose: "Turn pages on or off, download or restore a copy of your plan, and the advanced options.",
  aliases: ["connect to the PC", "server", "phone setup", "export", "import", "backup", "AI", "Ollama", "hide amounts", "privacy"],
  compute,
  render,
};
