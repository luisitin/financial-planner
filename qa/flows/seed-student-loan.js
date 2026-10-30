// qa/flows/seed-student-loan.js -- Ana's federal student loans for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-student-loan.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.accounts.push({ id: "a-sl", name: "Ana's federal loans", type: "student_loan", institution: "Loan servicer", balance: 38000, ownerId: "p-ana", history: [] });
plan.debts.push({ id: "d-sl", accountId: "a-sl", rate: 0.055, minPayment: 412, extra: 0 });
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { loans: 1 };
