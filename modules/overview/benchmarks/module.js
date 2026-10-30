// modules/overview/benchmarks/module.js -- how the household compares with families its age and the usual rules of thumb.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "benchmarks",
  group: "overview",
  title: "How am I doing",
  icon: "📏",
  order: 50,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "retirement"],
  writes: [],
  heavy: false,
  purpose: "Your net worth against families of your age, your retirement savings against the usual guideline for your age, and the rules of thumb for saving, cash, housing and debt.",
  compute,
  render,
};
