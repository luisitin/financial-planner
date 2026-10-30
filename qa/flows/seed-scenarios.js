// qa/flows/seed-scenarios.js -- three what-ifs for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-scenarios.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.scenarios = [
  { id: "sc-60", name: "Both retire at 60", changes: { "retireAge:p-ana": 60, "retireAge:p-bo": 60 }, createdAt: "" },
  { id: "sc-save", name: "Save $500 more", changes: { extraSavingMonthly: 500 }, createdAt: "" },
  { id: "sc-fee", name: "With an advisor", changes: { fee: 0.01 }, createdAt: "" },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { scenarios: plan.scenarios.length };
