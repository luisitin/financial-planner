// qa/flows/seed-state-il.js -- move the SANDBOX family (after seed-family.js) to Illinois, with a big mortgage's interest and property tax so itemizing pays, and some state withholding. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-state-il.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.household.state = "IL";
plan.taxes.itemized = { ...plan.taxes.itemized, mortgageInterest: 21000, propertyTax: 7800 };
plan.taxes.state = { withheld: 6000 };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { state: "IL" };
