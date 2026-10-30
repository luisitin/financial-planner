// qa/flows/seed-gifts.js -- gifts for the SANDBOX family (after seed-family.js): a 529 front-load for Cy from
// both, a cash gift from Ana next year, and a gift from Bo to a niece over the yearly limit. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-gifts.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const y = new Date().getFullYear();
plan.estate = plan.estate ?? { documents: [], beneficiaries: [] };
plan.estate.gifts = [
  { id: "g-529", to: "Cy", from: "both", amount: 60000, year: y, kind: "529", superfund: true, notes: "" },
  { id: "g-cash", to: "Cy", from: "p-ana", amount: 5000, year: y + 1, kind: "cash", notes: "" },
  { id: "g-niece", to: "Niece", from: "p-bo", amount: 30000, year: y, kind: "cash", notes: "help with a house deposit" },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { gifts: plan.estate.gifts.length };
