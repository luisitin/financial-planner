// qa/flows/seed-vehicle.js -- Bo's older sedan (worth less than its loan) with its running costs, for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-vehicle.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.accounts.push({ id: "a-veh", name: "Bo's 2016 sedan", type: "vehicle", institution: "", balance: 9000, ownerId: "p-bo", history: [] });
plan.property = [...(plan.property ?? []), { id: "v1", kind: "vehicle", accountId: "a-veh", milesYear: 11000, mpg: 27, fuelPrice: 3.4, insuranceYear: 1300, maintenanceYear: 1400, registrationYear: 180, loss: 0.12, loanAccountId: "a-car" }];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { cars: 1 };
