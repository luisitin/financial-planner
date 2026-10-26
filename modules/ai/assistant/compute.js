// modules/ai/assistant/compute.js -- PURE. Builds the context the model is allowed to
// see: a compact summary, never the raw plan. Extend this carefully; every field added
// here is data sent to whatever model is configured.
export function compute(plan) {
  const people = (plan.household?.people ?? []).map((p) => `${p.name ?? "someone"}${p.age ? ` (${p.age})` : ""}`);
  const accounts = (plan.accounts ?? []).map((a) => `${a.name}: ${a.type}, balance ${Math.round(Number(a.balance) || 0)}`);
  const goals = (plan.goals ?? []).map((g) => `${g.name}: target ${g.target ?? "?"} by ${g.targetDate ?? "?"}`);
  const a = plan.assumptions ?? {};
  const summary = [
    `Currency: ${plan.meta?.currency ?? "USD"}.`,
    `Household: ${people.length ? people.join(", ") : "not entered"}.`,
    `Accounts (${accounts.length}): ${accounts.join("; ") || "none"}.`,
    `Goals: ${goals.join("; ") || "none"}.`,
    `Assumptions: inflation ${a.inflation}, stock return ${a.returnStocks}, bond return ${a.returnBonds}, retirement age ${a.retirementAge}, plan to age ${a.planEndAge}.`,
  ].join("\n");
  return { summary, chars: summary.length };
}
export const SYSTEM_PROMPT = `You are the assistant inside a personal financial planning app that runs on the user's own computer.
Rules: be concise and plain; never invent numbers that are not in the context; when a question needs a calculation, point to the page of the app that does it, using ONLY the page names in the PAGES list (never invent a page name); do not add disclaimers about not being an advisor (the app already shows one).`;
/** The pages the model may name: ready ones only, "Title: purpose" per line. The view passes ctx.modules. */
export function pagesContext(modules) {
  const list = [...(modules?.values?.() ?? [])].filter((m) => m.status && m.status !== "planned").sort((a, b) => a.title.localeCompare(b.title));
  return list.length ? `PAGES (the only page names you may use):\n${list.map((m) => `- ${m.title}: ${m.purpose ?? ""}`).join("\n")}` : "";
}
