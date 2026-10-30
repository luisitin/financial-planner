// qa/flows/seed-beneficiaries.js -- a typical half-done beneficiary picture for the SANDBOX family (after
// seed-family.js and seed-policies.js): Ana's 401(k) names Bo, Bo's old 401(k) names his mother (so Ana is
// missing), the Roth names Cy directly, the term policy has no backup. Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-beneficiaries.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.estate = plan.estate ?? { documents: [], beneficiaries: [] };
plan.estate.beneficiaries = [
  { key: "account:a-401", accountId: "a-401", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2023-02-01" },
  { key: "account:a-bk401", accountId: "a-bk401", primary: [{ name: "Dana (mother)", personId: "", share: 1 }], contingent: [], reviewedAt: "2015-06-01" },
  { key: "account:a-roth", accountId: "a-roth", primary: [{ name: "Cy", personId: "p-cy", share: 1 }], contingent: [], reviewedAt: "2024-05-01" },
  { key: "policy:pol-ana-term", policyId: "pol-ana-term", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [], reviewedAt: "2026-01-15" },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { rows: plan.estate.beneficiaries.length };
