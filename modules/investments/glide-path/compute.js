// modules/investments/glide-path/compute.js -- PURE. How the stock share should move with age:
// the plan's own path (the Projection settings: stocks now, stocks in retirement, gliding
// between them until the retirement year), the old "110 minus age" rule, and the shape a
// target-date fund follows; against what the holdings actually hold today.
import { compute as computeHoldings, targetDateMix } from "../holdings/compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";

export const RULES = {
  plan: { label: "The plan's path", note: "the Projection page's stock share now and in retirement, gliding between them" },
  age: { label: "110 minus age", note: "the classic rule of thumb; 100 minus age for the cautious, 120 minus age for the bold" },
  "target-date": { label: "Target-date fund shape", note: "90% stocks far out, 50% at the retirement year, 30% seven years after" },
};

/** Stock share by age for each rule, for one person: { age, plan, age110, targetDate } for ages from now to the plan's end. */
export function paths(plan, params = {}) {
  const b = buildInputs(plan, params);
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const people = b.people ?? [];
  const self = people[0] ?? null;
  const ageNow = self ? year - self.birthYear : Number(a.retirementAge ?? 65) - 20;
  const retireAge = self?.retireAge ?? Number(a.retirementAge ?? 65), endAge = self?.endAge ?? Number(a.planEndAge ?? 95);
  const stocksNow = Number(rt.stocksNow ?? 0.7), stocksRetired = Number(rt.stocksRetired ?? 0.5);
  const retireYear = year + Math.max(0, retireAge - ageNow);
  const rows = [];
  for (let age = ageNow; age <= endAge; age++) {
    const y = year + (age - ageNow);
    const t = retireYear > year ? Math.min(1, Math.max(0, (y - year) / (retireYear - year))) : 1;
    const planShare = stocksNow + (stocksRetired - stocksNow) * t;
    const td = targetDateMix(retireYear, y);
    rows.push({ age, year: y, plan: planShare, age110: Math.min(1, Math.max(0, (110 - age) / 100)), targetDate: td.us_stocks + td.intl_stocks });
  }
  return { rows, ageNow, retireAge, endAge, retireYear, stocksNow, stocksRetired, person: self?.name ?? null, hasPeople: !!self };
}

/**
 * compute(plan, { today }) -> {
 *   ready (holdings), ...paths, actual (stock share held now), rule (chosen), suggested (the chosen rule's share now), gap, verdict,
 *   milestones: [{ age, year, plan, age110, targetDate }] every five years, notes
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const p = paths(plan, params);
  const rule = RULES[plan.investments?.glide] ? plan.investments.glide : "plan";
  const key = rule === "age" ? "age110" : rule === "target-date" ? "targetDate" : "plan";
  const now = p.rows[0];
  const suggested = now ? now[key] : null;
  const actual = h.hasData && h.classifiedShare > 0 ? h.stockShare : null;
  const gap = actual !== null && suggested !== null ? actual - suggested : null;
  const verdict = gap === null ? "unknown" : Math.abs(gap) <= 0.05 ? "on path" : gap > 0 ? "more stocks than the path" : "fewer stocks than the path";
  const milestones = p.rows.filter((r, i) => i === 0 || r.age % 5 === 0 || r.age === p.retireAge || i === p.rows.length - 1);
  const notes = [];
  if (!p.hasPeople) notes.push("Ages come from the People page; without a birth date the path starts 20 years before the plan's retirement age.");
  if (!h.hasData) notes.push("Add your holdings to see where you actually stand against the path.");
  return { ready: h.hasData, ...p, actual, rule, ruleLabel: RULES[rule].label, suggested, gap, verdict, milestones, notes, key };
}
