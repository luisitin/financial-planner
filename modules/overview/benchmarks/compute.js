// modules/overview/benchmarks/compute.js -- PURE. How the household compares: net worth against the
// median family whose head is the same age (Federal Reserve, Survey of Consumer Finances), retirement
// savings against Fidelity's multiple of salary for the age, and the rules of thumb most planners use:
// 15% of pay saved for retirement, 3 to 6 months of the bills you have to pay in cash, housing under 28% of
// gross income, all debt payments under 36%.
import { compute as computePeople } from "../../household/people/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities, rentsHome, lenderWithHousing, DTI_LINES, shownShare, renterLevel } from "../../balance/liabilities/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { savingVerdict, householdRetired } from "../../retirement/projection/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { money as fmtMoney, monthsText, monthsWords } from "../../../core/format.js";
import { isGuess } from "../../../core/estimate/index.js";
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
 *   items: [{ id, title, you, benchmark, unit: "money"|"multiple"|"share"|"months", better: "higher"|"lower"|"range", verdict: "ahead"|"on par"|"behind"|"rule"|"lasts"|"unknown", sentence, source, go }],
 *   ahead (count), judged (count)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const ppl = computePeople(plan, { today });
  const head = ppl.self ?? ppl.people.find((p) => p.role !== "dependent");
  if (!today || !head || head.age === null) return { ready: false, missing: ["your birth date on the People page"] };
  const age = head.age, group = ageGroup(age);
  // a birth date after today (a typo: 2031 for 1931) has no age group: wait for it rather than fail (round 7, 2026-11-06)
  if (!group) return { ready: false, missing: ["a birth date before today on the People page"] };
  const money = (n) => fmtMoney(Math.round(n), plan.meta?.currency ?? "USD");
  // what the plan can carry a month is an estimate: the $10 Goal seek and Plan health score show (wording follow-up n01, one answer)
  const est = (n) => fmtMoney(Math.round(n / 10) * 10, plan.meta?.currency ?? "USD");
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
  // pay: what is earned, a business's income included (a SEP or solo 401(k) is based on it), as Retirement contributions
  const pay = inc.active.filter((x) => x.type === "salary" || x.type === "bonus" || x.type === "business").reduce((s, x) => s + x.yearly, 0);
  const saved = (plan.accounts ?? []).filter((a) => RETIREMENT_TYPES.includes(a.type)).reduce((s, a) => s + countedBalance(a), 0);
  const target = savingsMultiple(age);
  // every adult retired (projection's householdRetired): the two pay-based rows cannot apply (round 8, 2026-11-06: a widow
  // read "Needs pay on the Income page"); one row points to the plan's own answer instead
  let retired = false;
  try { retired = householdRetired(plan, { today }); } catch { retired = false; }
  if (retired) {
    let own = null;
    try { own = savingVerdict(plan, { today }); } catch { own = null; }
    // the plan lasting is this row's "ahead" (round 8 review: a grey pill, left out of the count, read as not good enough)
    add({ id: "retirement-money", title: "Your savings in retirement", you: null, benchmark: null, unit: "share", better: "higher", verdict: !own ? "unknown" : own.verdict === "short" ? "behind" : own.verdict === "tight" ? "on par" : "lasts",
      // the projection's "tight" (lasts, under 115% of the spending: "It lasts, just") is on par, not ahead (verify, 2026-11-06)
      sentence: `Retired: the guidelines on pay no longer apply. ${!own ? "Will the money last? checks your savings against what you spend, once the plan has what it needs." : own.verdict === "short" ? `By your own plan the money runs short${own.shortAge ? ` at ${own.shortAge}` : ""} (see the Will the money last? page).` : own.verdict === "tight" ? `By your own plan the money lasts, but only just: it can carry about ${est(own.affordable / 12)} a month against the ${money(own.spendingYearly / 12)} planned, with little room for a bad run of markets (see the Will the money last? page).` : "By your own plan the money lasts (see the Will the money last? page)."}`,
      source: "Your own plan, not a rule of thumb", go: ["retirement", "projection"] });
  } else if (pay > 0 && target > 0) {
    const mult = saved / pay;
    add({ id: "savings-multiple", title: "Retirement savings for your age", you: mult, benchmark: target, unit: "multiple", better: "higher", verdict: verdictOf(mult, target, "higher"),
      sentence: `${money(saved)} in retirement accounts is ${mult.toFixed(1)} times a year's pay (${money(pay)}); the guideline at ${age} is about ${target.toFixed(1)} times.`, source: "Fidelity's savings guideline: 1x pay by 30, 3x by 40, 6x by 50, 8x by 60, 10x by 67", go: ["retirement", "contributions"] });
  } else if (!retired) add({ id: "savings-multiple", title: "Retirement savings for your age", you: null, benchmark: target || null, unit: "multiple", better: "higher", verdict: "unknown", sentence: pay > 0 ? "The guideline starts at 22." : "Needs pay on the Income page.", source: "Fidelity's savings guideline", go: ["cashflow", "income"] });

  // 3. retirement saving rate, the match included
  const con = computeContributions(plan, { today });
  if (pay > 0 && !retired) {
    const rate = con.totalYearly / pay;
    add({ id: "saving-rate", title: "Saving for retirement", you: rate, benchmark: RULES.saving, unit: "share", better: "higher", verdict: verdictOf(rate, RULES.saving, "higher", 0.07),
      sentence: `${money(con.totalYearly)} a year goes into retirement accounts, employer money included: ${pctW(rate)} of pay. The usual aim is ${pctW(RULES.saving)}.`, source: "Fidelity: save 15% of pay a year, the employer match included", go: ["retirement", "contributions"] });
  }

  // the two retirement rows are rules of thumb; the plan's own answer (Will the money last?) says whether being behind
  // them matters: behind but lasting reads "behind the rule of thumb" (not amber), short says so
  let own = null;
  try { own = savingVerdict(plan, { today }); } catch { own = null; }
  for (const x of items.filter((y) => (y.id === "savings-multiple" || y.id === "saving-rate") && y.verdict === "behind")) {
    if (own && own.verdict !== "short") { x.verdict = "rule"; x.sentence += " Behind the rule of thumb, but your own plan lasts (see the Will the money last? page)."; }
    else if (own?.verdict === "short") x.sentence += ` Your own plan runs short${own.shortAge ? ` at ${own.shortAge}` : ""} (see the Will the money last? page).`;
  }

  // 4. cash: months of the bills you have to pay, against the plan's own aim (liquidity's targetMonths: assumptions.emergencyMonths, the
  // Emergency fund page's): at or past it "ahead", from 3 months (the planners' least) up to it "on par", under 3 "behind"
  // (round 8, 2026-11-06: 5.1 months read "ahead" of 3 while every other page aims for 6)
  const liq = computeLiquidity(plan, { today });
  if (liq.runwayMonths !== null) {
    const m = liq.runwayMonths, aim = Number(liq.targetMonths) > 0 ? Number(liq.targetMonths) : RULES.cashMax;
    add({ id: "cash", title: "Emergency fund", you: m, benchmark: aim, unit: "months", better: "range", verdict: m >= aim - 1e-9 ? "ahead" : m >= Math.min(RULES.cashMin, aim) - 1e-9 ? "on par" : "behind",
      sentence: `Usable cash covers ${monthsWords(m)} of the bills you have to pay; your plan aims for ${monthsText(aim)} (most planners say ${RULES.cashMin} to ${RULES.cashMax})${m > Math.max(RULES.cashMax, aim) * 2 ? ". Well past that, some of it could be earning more" : ""}.`, source: "The common 3-to-6-months rule; the aim is your plan's (Emergency fund)", go: ["balance", "liquidity"] });
  }

  // 5. housing and 6. all debt payments, against gross income. One rule on these rows (round 8 review, 2026-11-06): over the
  // line is "behind", as What lenders see and the Debts tile say it ("29%: on par" for housing sat above "21%: behind" for debts);
  // within 7% under it "on par"; each graded at the whole percent shown (liabilities shownShare)
  const lineVerdict = (x, line, band = 0.07) => { const v = shownShare(x); return v <= line * (1 - band) + 1e-9 ? "ahead" : v <= line + 1e-9 ? "on par" : "behind"; };
  const gross = inc.monthly;
  if (gross > 0) {
    const housing = exp.active.filter((x) => x.category === "housing").reduce((s, x) => s + x.monthly, 0);
    if (housing > 0) add({ id: "housing", title: "Housing cost", you: housing / gross, benchmark: RULES.housing, unit: "share", better: "lower", verdict: lineVerdict(housing / gross, RULES.housing),
      sentence: `${money(housing)} a month on housing is ${pctW(housing / gross)} of income before tax; lenders like ${pctW(RULES.housing)} or less.`, source: "The lenders' housing guideline: housing costs under 28% of income before tax", go: ["cashflow", "expenses"] });
    const li = computeLiabilities(plan, { today });
    // a renter: the required payments (as a lender counts them; review D3) on the renters' line, rent not counted (CFPB: 15 to 20%
    // or less; liabilities DTI_LINES.renter): 15% or less "ahead", to 20% "on par", above "behind"; and the figure a home lender
    // would see with a housing payment like the rent (round 8, 2026-11-06: a renter's 21% was "ahead" of the homeowners' 36%)
    if (li.dti !== null && rentsHome(plan, li.rows)) { const R = DTI_LINES.renter, x = li.dtiRequired, lv = renterLevel(x); add({ id: "debt", title: "Debt payments", you: x, benchmark: R.good, unit: "share", better: "lower", verdict: lv === "fine" ? "ahead" : lv === "within" ? "on par" : "behind",
      sentence: `${money(li.minimums)} a month of required payments on loans and cards is ${pctW(x)} of income before tax; for renters the guideline is ${pctW(R.good)} or less, rent not counted.${housing > 0 ? ` ${lenderWithHousing((li.minimums + housing) / gross, housing, plan.meta?.currency ?? "USD", { guessed: exp.active.some((e) => e.category === "housing" && typeof e.id === "string" && isGuess(plan, `expenses[${e.id}].amount`)) })}` : ""}`, source: "Consumer Financial Protection Bureau's debt-to-income guide: renters 15 to 20% or less, rent not counted", go: ["debt", "ratios"] }); }
    else if (li.dti !== null) add({ id: "debt", title: "Debt payments", you: li.dti, benchmark: RULES.debt, unit: "share", better: "lower", verdict: lineVerdict(li.dti, RULES.debt),
      sentence: `${money(li.payments)} a month on loans and cards is ${pctW(li.dti)} of income before tax; under ${pctW(RULES.debt)} is comfortable; many mortgage lenders approve up to 43 to 50% with good credit and savings, but above 43% payments get tight.`, source: "Fannie Mae's limit for loans checked by hand (36%; up to 45 to 50% with strong credit and savings)", go: ["debt", "ratios"] });
  }

  const judged = items.filter((x) => x.verdict !== "unknown");
  return { ready: true, missing: [], age, group, scfYear: SCF_YEAR, items, ahead: judged.filter((x) => x.verdict === "ahead" || x.verdict === "lasts").length, judged: judged.length };
}

// as core/format.js pct prints a percent (x * 100 to 12 significant digits first: 0.285 is 29%, not 28; verify, 2026-11-06)
const pctW = (x) => `${Math.round(Number((x * 100).toPrecision(12)))}%`;
const ratio = (a, b) => (b <= 0 ? "" : a < 0 ? "Below zero, under" : a / b >= 1.1 ? `About ${(a / b).toFixed(1)} times` : a / b >= 0.9 ? "About the same as" : `About ${Math.round((a / b) * 100)}% of`);
