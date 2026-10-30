// qa/flows/seed-annuity.js -- two annuity quotes for the SANDBOX family (after seed-family.js). Insurers invented. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-annuity.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.retirement.annuities = [
  { id: "an-dia", name: "Income from 65", insurer: "Lantern Life", personId: "p-ana", premium: 100000, monthly: 1150, startAge: 65, joint: false, cola: false },
  { id: "an-joint", name: "Joint income from 65", insurer: "Harbor Mutual", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 65, joint: true, cola: false },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { quotes: 2 };
