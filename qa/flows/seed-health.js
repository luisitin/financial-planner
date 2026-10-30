// qa/flows/seed-health.js -- three health plans to choose from at open enrollment, family cover, to the
// SANDBOX plan (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-health.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.insurance = plan.insurance ?? { policies: [] };
plan.insurance.health = { tier: "family", expected: 6000, plans: [
  { id: "hp-ppo", name: "Gold PPO", premium: 640, deductible: 1000, oopMax: 6000, coinsurance: 0.2, hsa: false, employerHsa: 0 },
  { id: "hp-hsa", name: "Bronze HSA plan", premium: 390, deductible: 3400, oopMax: 8000, coinsurance: 0.2, hsa: true, employerHsa: 1000 },
  { id: "hp-hmo", name: "Silver HMO", premium: 520, deductible: 500, oopMax: 7000, coinsurance: 0.1, hsa: false, employerHsa: 0 },
] };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { plans: plan.insurance.health.plans.length };
