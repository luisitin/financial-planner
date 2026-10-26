// modules/overview/dashboard/compute.js -- PURE. Setup steps and whether the plan has
// enough in it to show money instead of a welcome. Readiness of pages (how many are
// built) is display logic done in view.js from ctx.modules.
export function compute(plan) {
  const steps = [
    { key: "accounts", label: "Add your accounts and balances", done: (plan.accounts ?? []).length > 0, go: ["balance", "net-worth"] },
    { key: "people", label: "Add the people in your household", done: (plan.household?.people ?? []).length > 0, go: ["household", "people"] },
    { key: "income", label: "Enter what comes in each month", done: (plan.income ?? []).length > 0, go: ["cashflow", "income"] },
    { key: "expenses", label: "Enter what goes out, or import transactions", done: (plan.expenses ?? []).length > 0 || (plan.transactions ?? []).length > 0, go: ["cashflow", "expenses"] },
    { key: "goals", label: "Set your first goal", done: (plan.goals ?? []).length > 0, go: ["goals", "goals"] },
    { key: "assumptions", label: "Check the assumptions (inflation, returns, retirement age)", done: !!plan.assumptions?.reviewedAt, go: ["system", "assumptions"] },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  return { steps, doneCount, total: steps.length, next, hasMoney: (plan.accounts ?? []).length > 0, noteCount: Object.keys(plan.pageNotes ?? {}).length };
}
