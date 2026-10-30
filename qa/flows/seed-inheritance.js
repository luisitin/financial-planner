// qa/flows/seed-inheritance.js -- what the SANDBOX family might inherit (after seed-family.js): money and an
// IRA from Ana's parents, the parents' house later. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-inheritance.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const y = new Date().getFullYear();
plan.estate = plan.estate ?? { documents: [], beneficiaries: [] };
plan.estate.inheritance = { items: [
  { id: "ih-ira", from: "Ana's parents", amount: 120000, year: y + 18, kind: "ira", notes: "" },
  { id: "ih-house", from: "Ana's parents", amount: 260000, year: y + 22, kind: "home", notes: "shared with a brother: half" },
] };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { items: plan.estate.inheritance.items.length };
