// qa/flows/seed-advisor.js -- an advisor's plan for the SANDBOX family (after seed-family.js): rosier returns,
// lower inflation, Ana retiring at 62, a 1% fee, a quoted 92%. The firm is invented. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-advisor.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.advisor = { firm: "Northgate Advisers", date: "2026-09-15", fee: 0.01, quotedChance: 0.92, notes: "Retire Ana at 62; move to a 70/30 managed portfolio.", changes: { returnStocks: 0.085, returnBonds: 0.045, inflation: 0.025, "retireAge:p-ana": 62, spendingMonthly: 7500 } };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { advisor: plan.advisor.firm };
