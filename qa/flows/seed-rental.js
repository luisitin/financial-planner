// qa/flows/seed-rental.js -- an invented duplex rented out since 2021, with its own loan, for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-rental.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.property = [...(plan.property ?? []), { id: "r1", kind: "rental", name: "Duplex on Elm", value: 320000, purchasePrice: 280000, purchaseDate: "2021-06-15", rentMonthly: 2600, vacancy: 0.05, propertyTax: 4200, insurance: 1500, maintenance: 0.01, cashIn: 70000, loanBalance: 190000, loanRate: 0.045, loanPayment: 1150, landShare: 0.2, appreciation: 0.035 }];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { rentals: 1 };
