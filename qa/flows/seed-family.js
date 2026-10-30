// qa/flows/seed-family.js -- fill the SANDBOX plan with the whole-plan family from
// qa/fixtures/family-plan.mjs (Ana, Bo and Cy with retirement saving, Social Security, loan details
// and goals), then let drive.mjs reload the page. Use it as the first --script:
//   node tools/drive.mjs overview/timeline --script qa/flows/seed-family.js --shot timeline
// Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-family.js only runs in the sandbox");
const { familyPlan } = await import("/qa/fixtures/family-plan.mjs");
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plan = familyPlan(today);
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { seeded: true, people: plan.household.people.length, accounts: plan.accounts.length, today };
