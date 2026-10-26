import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "statements",
  group: "transactions",
  title: "Statement reader",
  icon: "📄",
  order: 25,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "rules", "imports"],
  writes: ["transactions", "imports", "rules"],
  heavy: true,
  purpose: "No bank file? Give the plan the statement itself, as a PDF or a picture; the PC reads the rows for you to check.",
  aliases: ["pdf statement", "scan", "photo of a statement", "screenshot", "read my statement", "ocr"],
  compute,
  render,
};
