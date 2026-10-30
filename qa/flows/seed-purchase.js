// qa/flows/seed-purchase.js -- the SANDBOX family (after seed-family.js) weighs a boat: big enough that saving for it squeezes their goals. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-purchase.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const d = new Date(), when = `${d.getFullYear() + 1}-06-01`;
plan.whatIfs = { ...(plan.whatIfs ?? {}), purchase: { name: "Fishing boat", price: 42000, salesTax: 0.0625, when, saved: 2000, apr: 0.089, termMonths: 84, promoMonths: 0 } };
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { purchase: "boat" };
