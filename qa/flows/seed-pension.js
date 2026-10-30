// qa/flows/seed-pension.js -- Bo's county pension for the SANDBOX family (after seed-family.js): no
// cost-of-living raise, a lump sum offered, a 100% survivor option. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-pension.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.retirement.pensions = [{ id: "pn-county", name: "County pension", personId: "p-bo", monthly: 1800, startAge: 62, cola: false, endAge: null, lumpSum: 310000, jointMonthly: 1620, survivorShare: 1 }];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { pensions: 1 };
