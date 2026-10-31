// modules/overview/benchmarks/compute.js -- PURE. How the household compares: net worth against the
// median family whose head is the same age (Federal Reserve, Survey of Consumer Finances), retirement
// savings against Fidelity's multiple of salary for the age, and the rules of thumb most planners use:
// 15% of pay saved for retirement, 3 to 6 months of must-pay bills in cash, housing under 28% of
// gross income, all debt payments under 36%.
import { compute as computePeople } from "../../household/people/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { money as fmtMoney } from "../../../core/format.js";
import { MEDIAN_NET_WORTH_BY_AGE, MEDIAN_NET_WORTH_ALL, SCF_YEAR, SAVINGS_MULTIPLE_BY_AGE } from "./data/scf.js";

/** Rules of thumb: retirement saving 15% of pay with the match (Fidelity); housing 28% and all debt 36% of gross income (the lenders' front-end and back-end ratios); cash 3 to 6 months. */
export const RULES = { saving: 0.15, housing: 0.28, debt: 0.36, cashMin: 3, cashMax: 6 };
export const RETIREMENT_TYPES = ["401k", "ira", "roth"];

/** Fidelity's multiple of salary for an age: straight-line between the guideline's ages, 0 at 22, 10 from 67. */
export function savingsMultiple(age) {
  const pts = [[22, 0], ...SAVINGS_MULTIPLE_BY_AGE];
  if (age <= pts[0][0]) return 0;
  for (let i = 1; i < pts.length; i++) if (age <= pts[i][0]) { const [a0, m0] = pts[i - 1], [a1, m1] = pts[i]; return m0 + ((age - a0) / (a1 - a0)) * (m1 - m0); }
  return pts[pts.length - 1][1];
}
export const ageGroup = (age) => MEDIAN_NET_WORTH_BY_AGE.find((g) => age >= g.from && age <= g.to);

/**
 * compute(plan, { today }) -> {
 *   ready, missing, age (the head's), group, scfYear,
 *   items: [{ id, title, you, benchmark, unit: "money"|"multiple"|"share"|"months", better: "higher"|"lower"|"range", verdict: "ahead"|"on par"|"behind"|"unknown", sentence, source, go }],
 *   ahead (count), judged (count)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const ppl = computePeople(plan, { today });
  const head = ppl.self ?? ppl.people.find((p) => p.role !== "dependent");
  if (!today || !head || head.age === null) return { ready: false, missing: ["your birth date on the People page"] };
  const age = head.age, group = ageGroup(age);
  const money = (n) => fmtMoney(Math.round(n), plan.meta?.currency ?? "USD");
  const nw = computeNetWorth(plan, { today }), inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
  const items = [];
  const add = (x) => items.push(x);
  const verdictOf = (you, bench, better, band = 0.1) => (you === null || bench === null ? "unknown" : better === "higher" ? (you >= bench * (1 + band) ? "ahead" : you >= bench * (1 - band) ? "on par" : "behind") : (you <= bench * (1 - band) ? "ahead" : you <= bench * (1 + band) ? "on par" : "behind"));

  // 1. net worth against the median family of the same age
  const nwV = verdictOf(nw.netWorth, group.median, "higher");
  add({ id: "net-worth", title: "Net worth", you: nw.netWorth, benchmark: group.median, unit: "money", better: "higher", verdict: nw.count ? nwV : "unknown",
    sentence: nw.count ? `${ratio(nw.netWorth, group.median)} the median for families whose head is ${group.label}: half of them have less than ${money(group.median)}, half more.` : "Add your accounts to compare.",
    source: `Federal Reserve, Survey of Consumer Finances ${SCF_YEAR}, in ${SCF_YEAR} dollars (the median for all families is ${money(MEDIAN_NET_WORTH_ALL)})`, go: ["balance", "net-worth"] });

  // 2. retirement savings as a multiple of pay (Fidelity)
  const pay = inc.active.filter((x) => x.type === "salary" || x.type === "bonus").reduce((s, x) => s + x.yearly, 0);
  const saved = (plan.accounts ?? []).filter((a) => RETIREMENT_TYPES.includes(a.type)).reduce((s, a) => s + countedBalance(a), 0);
  const target = savingsMultiple(age);
  if (pay > 0 && target > 0) {
    const mult = saved / pay;
    add({ id: "savings-multiple", title: "Retirement savings for your age", you: mult, benchmark: target, unit: "multiple", better: "higher", verdict: verdictOf(mult, target, "higher"),
      sentence: `${money(saved)} in retirement accounts is ${mult.toFixed(1)} times a year's pay (${money(pay)}); the guideline at ${age} is about ${target.toFixed(1)} times.`, source: "Fidelity's savings guideline: 1x pay by 30, 3x by 40, 6x by 50, 8x by 60, 10x by 67", go: ["retirement", "contributions"] });
  } else add({ id: "savings-multiple", title: "Retirement savings for your age", you: null, benchmark: target || null, unit: "multiple", better: "higher", verdict: "unknown", sentence: pay > 0 ? "The guideline starts at 22." : "Needs pay on the Income page.", source: "Fidelity's savings guideline", go: ["cashflow", "income"] });

  // 3. retirement saving rate, the match included
  const con = computeContributions(plan, { today });
  if (pay > 0) {
    const rate = con.totalYearly / pay;
    add({ id: "saving-rate", title: "Saving for retirement", you: rate, benchmark: RULES.saving, unit: "share", better: "higher", verdict: verdictOf(rate, RULES.saving, "higher", 0.07),
      sentence: `${money(con.totalYearly)} a year goes into retirement accounts, employer money included: ${pctW(rate)} of pay. The usual aim is ${pctW(RULES.saving)}.`, source: "Fidelity: save 15% of pay a year, the employer match included", go: ["retirement", "contributions"] });
  }

  // 4. cash: months of must-pay bills
  const liq = computeLiquidity(plan, { today });
  if (liq.runwayMonths !== null) {
    const m = liq.runwayMonths;
    add({ id: "cash", title: "Cash for emergencies", you: m, benchmark: RULES.cashMin, unit: "months", better: "range", verdict: m >= RULES.cashMin ? "ahead" : m >= RULES.cashMin * 0.7 ? "on par" : "behind",
      sentence: `Usable cash covers ${m.toFixed(1)} months of must-pay bills; most planners say ${RULES.cashMin} to ${RULES.cashMax}${m > RULES.cashMax * 2 ? ". Well past that, some of it could be earning more" : ""}.`, source: "The common 3-to-6-months rule", go: ["balance", "liquidity"] });
  }

  // 5. housing and 6. all debt payments, against gross income
  const gross = inc.monthly;
  if (gross > 0) {
    const housing = exp.active.filter((x) => x.category === "housing").reduce((s, x) => s + x.monthly, 0);
    if (housing > 0) add({ id: "housing", title: "Housing cost", you: housing / gross, benchmark: RULES.housing, unit: "share", better: "lower", verdict: verdictOf(housing / gross, RULES.housing, "lower", 0.07),
      sentence: `${money(housing)} a month on housing is ${pctW(housing / gross)} of gross income; lenders like ${pctW(RULES.housing)} or less.`, source: "The lenders' front-end ratio (28%)", go: ["cashflow", "expenses"] });
    const li = computeLiabilities(plan, { today });
    if (li.dti !== null) add({ id: "debt", title: "Debt payments", you: li.dti, benchmark: RULES.debt, unit: "share", better: "lower", verdict: verdictOf(li.dti, RULES.debt, "lower", 0.07),
      sentence: `${money(li.payments)} a month on loans and cards is ${pctW(li.dti)} of gross income; under ${pctW(RULES.debt)} is comfortable; many mortgage lenders approve up to 43 to 50% with good credit and savings, but above 43% payments get tight.`, source: "Fannie Mae's limit for loans checked by hand (36%; up to 45 to 50% with strong credit and savings)", go: ["debt", "ratios"] });
  }

  const judged = items.filter((x) => x.verdict !== "unknown");
  return { ready: true, missing: [], age, group, scfYear: SCF_YEAR, items, ahead: judged.filter((x) => x.verdict === "ahead").length, judged: judged.length };
}

const pctW = (x) => `${Math.round(x * 100)}%`;
const ratio = (a, b) => (b <= 0 ? "" : a < 0 ? "Below zero, under" : a / b >= 1.1 ? `About ${(a / b).toFixed(1)} times` : a / b >= 0.9 ? "About the same as" : `About ${Math.round((a / b) * 100)}% of`);
