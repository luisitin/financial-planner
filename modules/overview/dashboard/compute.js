// modules/overview/dashboard/compute.js -- PURE. Setup steps, whether "Set up my plan" is finished, and whether the
// plan has enough in it to show money instead of a welcome. Where you stand and the next move come from
// overview/setup's standing() (view.js asks for it through ctx.computeOf). Readiness of pages (how many are built)
// is display logic done in view.js from ctx.modules.
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
  // "Set up my plan" finished: the checklist folds to one line even while a step (the assumptions) is open; that
  // step stays a to-do on Needs attention, and the page's one filled button becomes your next move
  const setupFinished = !!plan.guide?.setup?.finishedAt;
  return { steps, doneCount, total: steps.length, next, setupFinished, hasMoney: (plan.accounts ?? []).length > 0, noteCount: Object.keys(plan.pageNotes ?? {}).length };
}
