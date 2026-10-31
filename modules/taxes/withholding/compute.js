// modules/taxes/withholding/compute.js -- PURE. Whether this year's paychecks are taking out
// enough federal tax: what has been withheld so far plus what the rest of the year's paychecks
// will take, against the year's estimated tax; the refund or bill at filing time; the W-4
// change that would land it near zero; and the safe-harbour rule that avoids a penalty.
import { compute as computeFederal } from "../federal/compute.js";
import { PERIODS } from "../../../core/math/periods.js";
import { daysBetween } from "../../../core/math/dates.js";

/**
 * The smallest amount of withholding plus estimated payments that avoids the underpayment penalty:
 * 90% of this year's tax, or 100% of last year's (110% when last year's income was over 150,000; 75,000 filing separately), whichever is less.
 * Nothing is owed at all when the balance after withholding is under 1,000.
 */
export function safeHarbour(thisYearTax, priorTax, priorAgi, filingStatus) {
  const ninety = 0.9 * Math.max(0, thisYearTax);
  const priorShare = (Number(priorAgi) || 0) > (filingStatus === "married_separate" ? 75000 : 150000) ? 1.1 : 1;   // IRC 6654(d)(1)(C)
  const prior = priorTax !== null && priorTax !== undefined && priorTax !== "" ? Math.max(0, Number(priorTax)) * priorShare : null;
  const required = prior === null ? ninety : Math.min(ninety, prior);
  return { required, ninety, prior, priorShare, basis: prior !== null && prior <= ninety ? "last year" : "this year", label: prior !== null && prior <= ninety ? `${Math.round(priorShare * 100)}% of last year's tax` : "90% of this year's" };
}

/** Paychecks left in `year` after `today` for a pay period (a whole year when today is not in that year). */
export function paychecksLeft(period, today, year) {
  const perYear = (PERIODS[period] ?? PERIODS.biweekly).perYear || 12;
  if (!today || Number(String(today).slice(0, 4)) !== year) return perYear;
  const daysLeft = Math.max(0, daysBetween(today, `${year}-12-31`));
  return Math.max(0, Math.min(perYear, Math.floor(daysLeft / 365.25 * perYear)));
}

/**
 * projectedWithholding(plan, { today }) -> { projected, soFar, rest, people: [{ key, name, perPaycheck, period, left, rest, yearly }], hasSetup }
 * "So far" is the figure typed on the Federal estimate page; when it is blank, the whole year runs at the per-paycheck rate.
 */
export function projectedWithholding(plan, params = {}) {
  const today = params.today ?? null;
  const t = plan.taxes ?? {};
  const year = Number(t.year) || (today ? Number(String(today).slice(0, 4)) : new Date().getFullYear());
  const soFar = Math.max(0, Number(t.thisYear?.withheld) || 0);
  const w = t.withholding ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const people = [];
  for (const key of ["self", "partner"]) {
    const cfg = w[key]; if (!cfg || !(Number(cfg.perPaycheck) > 0)) continue;
    const period = PERIODS[cfg.period] ? cfg.period : "biweekly";
    const left = paychecksLeft(period, today, year);
    const perYear = PERIODS[period].perYear;
    const who = key === "self" ? adults.find((p) => p.role === "self") ?? adults[0] : adults.find((p) => p.role !== "self");
    people.push({ key, name: who?.name ?? (key === "self" ? "You" : "Partner"), perPaycheck: Number(cfg.perPaycheck), period, left, rest: Number(cfg.perPaycheck) * left, yearly: Number(cfg.perPaycheck) * perYear });
  }
  const rest = people.reduce((s, p) => s + p.rest, 0);
  const projected = soFar > 0 ? soFar + rest : people.reduce((s, p) => s + p.yearly, 0);
  return { projected, soFar, rest, people, hasSetup: people.length > 0 || soFar > 0, year };
}

/**
 * compute(plan, { today }) -> {
 *   year, totalTax, withholding: projectedWithholding, estimatedPaid, balance (tax - withholding - estimates; + owe, - refund),
 *   verdict: "about right" | "refund" | "owe" | "unknown", harbour, penaltyRisk,
 *   suggestion: { kind: "add" | "cut" | "none", perPaycheck, paychecks, text } for the main earner's W-4,
 *   notes, hasIncome
 * }
 */
export function compute(plan, params = {}) {
  const fed = computeFederal(plan, params);
  const wh = projectedWithholding(plan, params);
  const t = plan.taxes ?? {};
  const totalTax = Math.max(0, fed.result.totalTax);
  const estimatedPaid = (t.estimated?.paid ?? []).reduce((s, x) => s + (Math.max(0, Number(x)) || 0), 0);
  const balance = totalTax - wh.projected - estimatedPaid;
  const harbour = safeHarbour(totalTax, t.priorYear?.tax, t.priorYear?.agi, fed.filingStatus);
  const penaltyRisk = wh.hasSetup && balance >= 1000 && wh.projected + estimatedPaid < harbour.required;   // nothing to say until a paycheck figure is in
  const verdict = !wh.hasSetup ? "unknown" : Math.abs(balance) < 500 ? "about right" : balance > 0 ? "owe" : "refund";
  const main = wh.people[0] ?? null;
  let suggestion = { kind: "none", perPaycheck: 0, paychecks: 0, text: "" };
  if (main && main.left > 0 && verdict === "owe") suggestion = { kind: "add", perPaycheck: Math.ceil(balance / main.left), paychecks: main.left, text: `Ask for ${Math.ceil(balance / main.left).toLocaleString("en-US")} more per paycheck on a new W-4 (Step 4(c), "extra withholding") for the ${main.left} paychecks left, and the bill disappears.` };
  else if (main && main.left > 0 && verdict === "refund") suggestion = { kind: "cut", perPaycheck: Math.floor(-balance / main.left), paychecks: main.left, text: `You are lending the IRS about ${Math.floor(-balance / main.left).toLocaleString("en-US")} a paycheck. On a new W-4, entering ${Math.round(-balance).toLocaleString("en-US")} in Step 3 (credits) or the matching amount in Step 4(b) (deductions) brings the take-home up and the refund down.` };
  else if (verdict === "owe" && !main) suggestion = { kind: "estimates", perPaycheck: 0, paychecks: 0, text: "Nothing is withheld from a paycheck, so the Estimated payments page is the tool: it splits the bill into the four quarterly payments." };
  const notes = [];
  if (!fed.hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (!wh.hasSetup && fed.hasIncome) notes.push("Type the federal tax taken from one paycheck (the \"Federal income tax\" line on the stub) below, and what has been withheld so far this year on the Federal estimate page.");
  return { year: fed.year, totalTax, withholding: wh, estimatedPaid, balance, verdict, harbour, penaltyRisk, suggestion, notes, hasIncome: fed.hasIncome, effectiveRate: fed.result.effectiveRate, wages: fed.result.income.wages };
}
