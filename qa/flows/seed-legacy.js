// qa/flows/seed-legacy.js -- what the SANDBOX family wants to leave (after seed-family.js): money for Cy and
// a gift to a food bank, the home counted in. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-legacy.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.estate = plan.estate ?? { documents: [], beneficiaries: [] };
plan.estate.legacy = { includeHome: true, bequests: [
  { id: "lg-cy", to: "Cy", kind: "person", amount: 900000, notes: "a start, and help with a first home" },
  { id: "lg-food", to: "Riverside food bank", kind: "charity", amount: 50000, notes: "" },
] };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { bequests: plan.estate.legacy.bequests.length };
