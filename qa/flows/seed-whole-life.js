// qa/flows/seed-whole-life.js -- add a whole-life policy Bo has paid into for eight years, and the figures
// from a whole-life illustration Ana was offered, to the SANDBOX plan (after seed-family.js and
// seed-policies.js). The insurer is invented. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-whole-life.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.insurance = plan.insurance ?? { policies: [] };
plan.insurance.policies.push({ id: "pol-bo-whole", name: "Bo's whole life", kind: "whole", personId: "p-bo", insurer: "Harbor Mutual", benefit: 100000, premium: 1150, period: "annual", cashValue: 7400, yearsPaid: 8, surrenderValue: 6900, laterYears: 10, cashValueLater: 24500, termQuote: 180 });
plan.insurance.compare = { deathBenefit: 500000, wholePremium: 6200, termPremium: 420, termYears: 20, cashValue: 150000, cashValueGuaranteed: 112000, taxed: true, returnRate: null };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { policies: plan.insurance.policies.length };
