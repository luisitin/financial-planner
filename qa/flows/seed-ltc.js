// qa/flows/seed-ltc.js -- add a long-term care policy for Bo to the SANDBOX plan (after seed-family.js and
// seed-policies.js): no inflation rider, the usual 90 days and three years. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-ltc.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.insurance = plan.insurance ?? { policies: [] };
plan.insurance.policies.push({ id: "pol-bo-ltc", name: "Bo's care policy", kind: "ltc", personId: "p-bo", insurer: "Lantern Life", benefit: 4500, premium: 150, period: "monthly", benefitYears: 3 });
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { policies: plan.insurance.policies.length };
