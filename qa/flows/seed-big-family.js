// qa/flows/seed-big-family.js -- 10 people (2 adults, 8 dependents) and one account of every
// type in ACCOUNT_TYPES (plus a second vehicle, so a duplicate type is exercised too), spread
// across different owners. Used to stress-test People and Net worth with a bigger, more varied
// household. Sandbox only; never run with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-big-family.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null") || { schemaVersion: 1 };
Object.assign(plan, {
  household: {
    people: [
      { id: "p-ana", name: "Ana", role: "self", birthDate: "1988-04-12" },
      { id: "p-bo", name: "Bo", role: "partner", birthDate: "1986-11-30" },
      { id: "p-cy", name: "Cy", role: "dependent", birthDate: "2020-02-14" },
      { id: "p-dee", name: "Dee", role: "dependent", birthDate: "2016-06-01" },
      { id: "p-evan", name: "Evan", role: "dependent", birthDate: "2012-09-09" },
      { id: "p-fay", name: "Fay", role: "dependent", birthDate: "2024-03-03" },
      { id: "p-gus", name: "Gus", role: "dependent", birthDate: "2008-12-25" },
      { id: "p-hana", name: "Hana", role: "dependent", birthDate: "2025-07-19" },
      { id: "p-ivy", name: "Ivy", role: "dependent", birthDate: "2018-01-30" },
      { id: "p-jax", name: "Jax", role: "dependent", birthDate: "2014-05-22" },
    ],
    filingStatus: "married_joint", state: "CA",
  },
  accounts: [
    { id: "a-chk", name: "Ana checking", type: "checking", institution: "Chase", balance: 3200, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-sav", name: "Bo savings", type: "savings", institution: "Ally", balance: 9800, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-cash", name: "Cash on hand", type: "cash", balance: 500, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-brk", name: "Ana brokerage", type: "brokerage", institution: "Schwab", balance: 22000, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-401k", name: "Bo 401(k)", type: "401k", institution: "Fidelity", balance: 145000, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-ira", name: "Ana IRA", type: "ira", institution: "Vanguard", balance: 38000, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-roth", name: "Bo Roth IRA", type: "roth", institution: "Vanguard", balance: 27500, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-hsa", name: "Ana HSA", type: "hsa", institution: "Fidelity", balance: 6200, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-529", name: "Cy's 529", type: "529", institution: "Vanguard", balance: 14000, asOf: "2026-09-15", ownerId: "Cy", history: [] },
    { id: "a-crypto", name: "Bo crypto", type: "crypto", institution: "Coinbase", balance: 4300, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-home", name: "House", type: "property", balance: 410000, asOf: "2026-01-15", ownerId: "", history: [] },
    { id: "a-car1", name: "Ana's car", type: "vehicle", balance: 18500, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-car2", name: "Bo's car", type: "vehicle", balance: 9000, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-life", name: "Bo life insurance", type: "cash_value_life", institution: "Lakeshore Life", balance: 12000, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-other-a", name: "Jewelry and collectibles", type: "other_asset", balance: 2500, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-visa", name: "Ana's Visa", type: "credit", institution: "Chase", balance: 4100, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-persloan", name: "Bo's personal loan", type: "loan", institution: "SoFi", balance: 6700, asOf: "2026-09-15", ownerId: "Bo", history: [] },
    { id: "a-mort", name: "Mortgage", type: "mortgage", institution: "Wells Fargo", balance: 310000, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-stuloan", name: "Ana's student loan", type: "student_loan", institution: "Navient", balance: 22000, asOf: "2026-09-15", ownerId: "Ana", history: [] },
    { id: "a-other-l", name: "Owed to family", type: "other_liability", balance: 1200, asOf: "2026-09-15", ownerId: "", history: [] },
  ],
});
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { seeded: true, people: plan.household.people.length, accounts: plan.accounts.length };
