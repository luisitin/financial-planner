import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "digital",
  group: "estate",
  title: "Digital assets",
  icon: "📜",
  order: 70,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["accounts", "estate"],
  writes: ["estate"],
  heavy: false,
  purpose: "Your email, password manager, photos and crypto: who could get into each if something happened to you. Never the passwords themselves.",
  compute,
  render,
};
