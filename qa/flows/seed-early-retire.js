// qa/flows/seed-early-retire.js -- both of the SANDBOX family retire at 58 (after seed-family.js), to see the years before Medicare. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-early-retire.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
for (const p of plan.household.people) if (p.role !== "dependent") p.retirementAge = 58;
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { retireAt: 58 };
