// modules/retirement/medicare/compute.js -- PURE. Medicare from 65: when each of you can sign up, what
// Part B, a drug plan and any supplement cost, and the income surcharge (IRMAA) each year, from the plan's
// own income two years before (Roth conversions and required withdrawals included): which years it bites,
// how much it adds over retirement, and how much room is left under the first threshold.
import { buildInputs, workRule, payYears, expensesCarried } from "../projection/compute.js";
import { project } from "../../../core/math/retirement.js";
import { ageOn } from "../../../core/math/dates.js";
import { YEAR, PART_B, PART_B_DEDUCTIBLE, PART_D_BASE, tiersFor, LATE_PENALTY, MEDIGAP_G } from "./data/medicare.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeContributions } from "../contributions/compute.js";
// health costs that rise faster than prices (Assumptions, gap design #10): 0 unless the household chose it
import { healthGrowthOf, healthFactor } from "../../system/assumptions/compute.js";

/** The tier for a modified AGI: { index, partB, partDAdd, upTo, next (the next threshold above, or null) }. */
export function tierFor(magi, status) {
  const t = tiersFor(status);
  const i = t.findIndex(([upTo]) => magi <= upTo);
  const k = i < 0 ? t.length - 1 : i;
  return { index: k, partB: t[k][1], partDAdd: t[k][2], upTo: t[k][0], first: t[0][0] };
}

/** The sign-up period around the 65th birthday: three months before the birthday month to three months after (a birthday on the 1st moves it a month earlier). */
export function enrollmentWindow(birthDate) {
  const [y, m, d] = String(birthDate).split("-").map(Number);
  let month = m - (d === 1 ? 1 : 0), year = y + 65;
  if (month < 1) { month += 12; year -= 1; }
  const at = (k) => { const t = (year * 12 + (month - 1)) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
  return { from: at(-3), month: at(0), to: at(3) };
}

/**
 * The two incomes means-tested costs are priced on, from a year's parts in today's dollars (fifth pass, 2026-11-02):
 * - Medicare's income surcharge (IRMAA): modified AGI is AGI plus tax-exempt interest (42 USC 1395r(i)(4)(A); 20 CFR
 *   418.1010). Untaxed Social Security stays out.
 * - The marketplace's premium tax credit: modified AGI is AGI plus untaxed Social Security plus tax-exempt interest (26 USC
 *   36B(d)(2)(B); foreign income excluded under section 911 too, which the plan does not hold). It was the IRMAA figure, so a
 *   couple living on Social Security read as under the poverty line (the 68/63 couple: $15,365 in 2026, "Medicaid may cover
 *   people with that income instead"), while the marketplace counts the whole benefit.
 * irmaaIncome({ agi, exemptInterest }) / marketplaceIncome({ agi, exemptInterest, untaxedSocialSecurity }) -> dollars
 */
export const irmaaIncome = ({ agi = 0, exemptInterest = 0 } = {}) => agi + exemptInterest;
export const marketplaceIncome = ({ agi = 0, exemptInterest = 0, untaxedSocialSecurity = 0 } = {}) => agi + exemptInterest + untaxedSocialSecurity;

/**
 * The plan's income for means-tested costs (Medicare's surcharge, marketplace credits), year by year, in today's dollars:
 * the plan run through the federal brackets. AGI: in a retired year, ordinary income + qualified dividends and gains + taxable
 * Social Security (the brackets' own figures, conversions and required withdrawals included); in a working year (the engine
 * works out no tax), the pay of whoever still works less their pre-tax 401(k) and IRA saving, plus the plan's other taxable
 * income that year. Tax-exempt interest: an Income line of interest and dividends ("investment") marked untaxed. Untaxed
 * Social Security: the benefit less its taxable part (all of it in a working year, where AGI leaves it out). Lines are told
 * apart by their kind (Social Security) and type (a partner's pay is type "pay", else the Income type), never by name. In a working
 * year the pay counted is that of whoever works that year by the projection's one work rule (workRule: a partner Get started says
 * is retired or not working brings none in, whatever Income still holds; review 2026-11-06, it went by age alone).
 * -> { inputs, run, partsOf(row): { agi, exemptInterest, untaxedSocialSecurity }, magiOf(row) (IRMAA's), acaMagiOf(row) (the
 * marketplace's) } | { inputs: null, missing }. Shared with retirement/healthcare and, through both, with the projection's health
 * line (buildInputs works it out once and hands it to both as `params.planIncome`).
 */
export function planIncome(plan, { today } = {}) {
  // buildInputs only reads the plan: a shallow copy with the brackets is enough (a deep copy of a plan with years of bank
  // transactions cost more than the rest of this together, and the projection now runs this for its health line)
  const p2 = { ...plan, retirement: { ...(plan.retirement ?? {}), taxMode: "brackets" } };
  // health: false -- the plan without its own health line (Will the money last? adds this page's premiums and the
  // marketplace's to the plan, worked from this income: one pass, so the income here leaves the premiums' own withdrawals out)
  const b = buildInputs(p2, { today, health: false });
  if (!b.inputs) return { inputs: null, missing: b.missing ?? [] };
  const I = b.inputs;
  const run = project(I);
  const inc = computeIncome(plan, { today }), con = computeContributions(plan, { today });
  // the pay of a year: the lines paid that year (payYears; review 2026-11-06, seventh pass: it was the lines paid today, every year)
  const payOf = (id, year) => inc.items.filter((x) => x.personId === id && ["salary", "bonus", "business"].includes(x.type)).filter((x) => { const r = payYears(x, today); return r && year >= r.from && year <= r.until; }).reduce((s, x) => s + x.yearly, 0);
  const preTaxOf = (id) => (con.items ?? []).filter((c) => c.personId === id && ["401k", "ira"].includes(c.accountType)).reduce((s, c) => s + c.yearly, 0);
  // each engine income line's kind, by the income it comes from
  const works = workRule(plan, I.people, { today, retireYear: I.retireYear });
  const kindOf = new Map();
  for (const x of I.incomes ?? []) kindOf.set(x.name, x.kind === "social" ? "social" : x.type === "pay" ? "pay" : x.taxable === false ? (x.type === "investment" ? "exempt" : "untaxed") : "taxed");
  const partsOf = (row) => {
    const sum = (k) => (row?.incomeLines ?? []).filter((l) => kindOf.get(l.name) === k).reduce((s, l) => s + l.amount, 0) / row.priceLevel;
    const exemptInterest = sum("exempt"), social = sum("social");
    if (row?.retired && row.taxInfo) {
      const t = row.taxInfo;
      return { agi: (t.ordinary + t.qualified + t.taxableSocialSecurity) / row.priceLevel, exemptInterest, untaxedSocialSecurity: Math.max(0, social - t.taxableSocialSecurity / row.priceLevel) };
    }
    const working = I.people.reduce((s, p) => s + (works(p, row.year) ? Math.max(0, payOf(p.id, row.year) - preTaxOf(p.id)) : 0), 0);
    return { agi: working + sum("taxed"), exemptInterest, untaxedSocialSecurity: social };
  };
  const magiOf = (row) => irmaaIncome(partsOf(row));
  const acaMagiOf = (row) => marketplaceIncome(partsOf(row));
  return { inputs: I, run, partsOf, magiOf, acaMagiOf };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, year (of the figures), partB, deductible, partD, supplement (a month: the one entered, else MEDIGAP_G),
 *   supplementDefault (none entered: the national Plan G average), supplementYear, status, jobCoversSpouse (the tick),
 *   spouseYears: [{ year, names, worker }] (years someone 65 or over has stopped while a husband or wife still works: the tick's
 *   question; not someone whose Medicare a line on Expenses pays), healthIncluded (Will the money last? adds no health cover:
 *   "my spending figure already includes health cover"),
 *   people: [{ id, name, medicareYear, signup: { from, month, to } }],
 *   years: [{ year, enrolled, magiYear, magiReal, tier, partBEach, partDAddEach, surchargeYearly, totalYearly, conversion }],
 *   lifetime (all premiums, today's dollars), surcharge (the IRMAA part of it), surchargeYears, firstSurcharge: { year, magiYear, over } | null, roomNow: { year, room } | null,
 *   healthGrowth (only when the household chose it on Assumptions: each year's premiums are today's times (1 + h)^(years from now))
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const m = plan.retirement?.medicare ?? {};
  const partD = Number(m.partDPremium) >= 0 && m.partDPremium !== null && m.partDPremium !== "" && m.partDPremium !== undefined ? Number(m.partDPremium) : PART_D_BASE;
  // a supplement (Medigap) or Advantage plan premium: the household's own figure (0 for none), else the national average for
  // Medigap Plan G (review 2026-11-06, seventh pass: it was $0, so Medicare counted only Part B and the drug plan)
  const typedSupplement = m.supplementPremium !== null && m.supplementPremium !== undefined && m.supplementPremium !== "" && Number(m.supplementPremium) >= 0;
  const supplement = typedSupplement ? Number(m.supplementPremium) : MEDIGAP_G.monthly;
  const status = plan.household?.filingStatus || "single";
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const people = adults.map((p) => ({ id: p.id, name: p.name, medicareYear: Number(p.birthDate.slice(0, 4)) + 65, signup: enrollmentWindow(p.birthDate), age: today ? ageOn(p.birthDate, today) : null }));
  const base = { year: YEAR, partB: PART_B, deductible: PART_B_DEDUCTIBLE, partD, supplement, supplementDefault: !typedSupplement, supplementYear: typedSupplement ? null : MEDIGAP_G.year, status, people, latePenalty: LATE_PENALTY, jobCoversSpouse: m.jobCoversSpouse === true, healthIncluded: plan.retirement?.healthIncluded === true };
  const pi = params.planIncome ?? planIncome(plan, { today });   // the projection's health line passes the run it already made
  if (!pi.inputs) return { ...base, ready: false, missing: pi.missing };
  const { inputs: I, run: r, magiOf } = pi;
  const byYear = new Map(r.rows.map((row) => [row.year, row]));
  const h = healthGrowthOf(plan);
  const years = [];
  for (const row of r.rows) {
    const enrolled = I.people.filter((p, k) => row.ages[k] >= 65 && row.ages[k] <= p.endAge).length;
    if (!enrolled) continue;
    const src = byYear.get(row.year - 2) ?? r.rows[0];
    const magiReal = magiOf(src) ?? 0;
    const t = tierFor(magiReal, status);
    // every premium of today (Part B with its surcharge, the drug plan with its, the supplement) times (1 + h)^(years from now):
    // the surcharges are set as shares of the premiums' cost, so they rise with them; the income lines (tierFor) stay as they
    // are. g is exactly 1 with prices
    const g = healthFactor(h, row.year, I.startYear);
    const each = (t.partB + partD + t.partDAdd + supplement) * 12 * g;
    years.push({ year: row.year, enrolled, magiYear: src.year, magiReal, tier: t.index, partBEach: t.partB * g, partDAddEach: t.partDAdd * g, surchargeYearly: ((t.partB - PART_B) + t.partDAdd) * 12 * enrolled * g, totalYearly: each * enrolled, conversion: (src.conversion ?? 0) / src.priceLevel });
  }
  // the years someone 65 or over has stopped work while a husband or wife still works (the projection's one work rule): the
  // years the tick "a plan through their job covers them" is about (seventh pass)
  const works = workRule(plan, I.people, { today, retireYear: I.retireYear });
  // (verify 2026-11-06: not someone whose Medicare a line on Expenses already pays: the plan keeps that line, so the tick would
  // change nothing; the projection's own rule, expensesCarried)
  const paidIds = new Set(expensesCarried(plan, I.people, today, works)?.paidBy?.ids ?? []);
  const spouseYears = [];
  for (const row of r.rows) {
    const off = I.people.filter((p, k) => row.ages[k] >= 65 && row.ages[k] <= p.endAge && !works(p, row.year) && !paidIds.has(p.id));
    const w = I.people.filter((p) => works(p, row.year));
    if (off.length && w.length) spouseYears.push({ year: row.year, names: off.map((p) => p.name), worker: w[0].name });
  }
  const sum = (k) => years.reduce((s, y) => s + y[k], 0);
  const hit = years.filter((y) => y.tier > 0);
  const first = hit[0] ?? null;
  // the room under the first threshold in the first year that sets a premium (the year two before the first Medicare year)
  const firstY = years[0];
  const firstTier = firstY ? tierFor(firstY.magiReal, status) : null;
  return {
    ...base, ready: true, missing: [], years, spouseYears,
    lifetime: sum("totalYearly"), surcharge: sum("surchargeYearly"), surchargeYears: hit.length,
    firstSurcharge: first ? { year: first.year, magiYear: first.magiYear, over: first.magiReal - tierFor(0, status).upTo, conversion: first.conversion } : null,
    roomNow: firstY ? { year: firstY.magiYear, premiumYear: firstY.year, room: firstTier.first - firstY.magiReal } : null,
    taxMode: plan.retirement?.taxMode ?? "flat",
    // only when chosen: a plan without it reads exactly as before
    ...(h > 0 ? { healthGrowth: h } : {}),
  };
}
