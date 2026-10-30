// qa/flows/seed-home.js -- the SANDBOX family's house (after seed-family.js): what they paid in 2022, the yearly costs, two past values. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-home.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const home = plan.accounts.find((a) => a.id === "a-home");
home.history = [{ date: "2024-06-01", balance: 345000 }, { date: "2025-06-01", balance: 362000 }];
plan.property = [...(plan.property ?? []), { id: "h1", kind: "home", accountId: "a-home", purchasePrice: 310000, purchaseDate: "2022-06-01", improvements: 15000, propertyTax: 4800, insurance: 1900, hoaMonthly: 0, maintenance: 0.01, appreciation: 0.035, sellCosts: 0.06 }];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { home: true };
