// modules/ai/assistant/compute.js -- PURE. Builds the context the model is allowed to
// see: a compact summary, never the raw plan. Extend this carefully; every field added
// here is data sent to whatever model is configured.
import { isGuess } from "../../../core/estimate/index.js";

/** " (our guess)" after a figure the plan filled in where a box was left empty (core/estimate isGuess), else "" (C5 hand-off H4). */
const ours = (plan, path) => { try { return isGuess(plan, path) ? " (our guess)" : ""; } catch { return ""; } };

export function compute(plan) {
  const people = (plan.household?.people ?? []).map((p) => `${p.name ?? "someone"}${p.age ? ` (${p.age})` : ""}`);
  // a balance or a goal's amount that is our guess says so, so the model never passes it off as the person's own figure
  const accounts = (plan.accounts ?? []).map((a) => `${a.name}: ${a.type}, balance ${Math.round(Number(a.balance) || 0)}${ours(plan, `accounts[${a.id}].balance`)}`);
  const goals = (plan.goals ?? []).map((g) => `${g.name}: target ${g.target ?? "?"}${ours(plan, `goals[${g.id}].target`)} by ${g.targetDate ?? "?"}`);
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
Rules: be concise and plain; never invent numbers that are not in the context; a figure marked "(our guess)" is a typical figure the app filled in where the person left a box empty, not their own, so say so whenever you use it; when a question needs a calculation, point to the page of the app that does it, using ONLY the page names in the PAGES list (never invent a page name); do not add disclaimers about not being an advisor (the app already shows one).`;
/** The pages the model may name: ready ones only, "Title: purpose" per line. The view passes ctx.modules. */
export function pagesContext(modules) {
  const list = [...(modules?.values?.() ?? [])].filter((m) => m.status && m.status !== "planned").sort((a, b) => a.title.localeCompare(b.title));
  return list.length ? `PAGES (the only page names you may use):\n${list.map((m) => `- ${m.title}: ${m.purpose ?? ""}`).join("\n")}` : "";
}
