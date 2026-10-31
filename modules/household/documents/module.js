// modules/household/documents/module.js -- where each important paper is kept (the place, never the paper), a copy elsewhere, who else knows.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "documents",
  group: "household",
  title: "Document vault index",
  icon: "👪",
  order: 30,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "accounts", "property", "insurance", "estate", "papers"],
  writes: ["papers"],
  heavy: false,
  purpose: "Keeps track of where your will, insurance policies, deeds and tax returns are kept (the locations, not the files themselves).",
  compute,
  render,
};
