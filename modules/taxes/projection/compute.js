// modules/taxes/projection/compute.js -- PURE. Federal tax in every year of the retirement
// plan, through the brackets: what is taxed each year (pensions, pay, withdrawals, the taxable
// part of Social Security, gains and dividends), the bracket the year ends in, the tax and
// the rate; totals in today's dollars; the years that hurt most; and how the flat-rate
// setting compares. And the state's income tax in each of those years, from the state's own brackets and its rules for
// retirement income, for a state the app has them for (core/math/state-tax.js, gap design #40).
import { project } from "../../../core/math/retirement.js";
import { stateIncomeTax, hasRules, stateNames } from "../../../core/math/state-tax.js";
import { buildInputs, taxSettings, noYearsWhy } from "../../retirement/projection/compute.js";
import { STATE_NAMES } from "../state/compute.js";

// noYearsWhy lives with the projection since round 7 (buildInputs uses it); kept importable from here
export { noYearsWhy };
// the states worked out from their own rules, for the page's words (the view does not read the state table itself)
export { stateNames };

/**
 * compute(plan, { today, real, stateBrackets }) -> {
 *   ready, missing, rows: [{ year, ages, retired, ordinary, qualified, socialSecurity, taxableSocialSecurity, taxableIncome, deduction, bracketRate, taxes, effectiveRate, conversion, rmd, withdrawnDeferred, priceLevel }] (retired years; money real unless real=false),
 *   totals: { taxes, ordinary, socialSecurity, taxableSocialSecurity, conversions, rmd }, average (yearly tax), peak: { year, taxes, why }, byBracket: [{ rate, years }],
 *   flatTaxes (what the flat setting would charge over the same years), bracketsOn, notes, people, filingStatus, firstZero (years with no tax),
 *   noYears ({ why, check }: why the plan has no retirement year to tax and what to check on People, when `rows` is empty; else null),
 *   and only for a state with rules in core/math/state-tax.js (else these keys are absent and the answer is what it was):
 *   rows[].state (that year's state income tax), totals.state, state: { code, name, none, total, average, zeroYears, rules,
 *   yearWords, indexed, local }
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  // everyone past the age the plan runs to: buildInputs has no year to run and says why (`noYears`, round 7)
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, rows: [], noYears: b.noYears ?? null };
  const real = params.real !== false;
  const tax = taxSettings(plan, { mode: "brackets" });
  const r = project({ ...b.inputs, tax });
  const flat = project({ ...b.inputs, tax: { mode: "flat" } });
  const k = (row, n) => real ? n / row.priceLevel : n;
  const code = String(plan.household?.state ?? "").toUpperCase();
  const withState = params.stateBrackets !== false && hasRules(code);   // `stateBrackets: false`: the answer before gap #40 (tests)
  const rows = r.rows.filter((x) => x.retired).map((x) => {
    const i = x.taxInfo ?? {};
    const row = { year: x.year, ages: x.ages, retired: x.retired, ordinary: k(x, i.ordinary ?? 0), qualified: k(x, i.qualified ?? 0), socialSecurity: k(x, i.socialSecurity ?? 0), taxableSocialSecurity: k(x, i.taxableSocialSecurity ?? 0), taxableIncome: k(x, i.taxableIncome ?? 0), deduction: k(x, i.deduction ?? 0), bracketRate: i.bracketRate ?? null, taxes: k(x, x.taxes), effectiveRate: i.effectiveRate ?? 0, conversion: k(x, x.conversion), rmd: k(x, x.rmd), withdrawnDeferred: k(x, x.withdrawn.deferred), priceLevel: x.priceLevel };
    if (withState) row.state = k(x, stateYear(code, x, { inputs: b.inputs, status: tax.filingStatus, levelAt: levelAt(r.rows) }).tax);
    return row;
  });
  const sum = (f) => rows.reduce((s, x) => s + f(x), 0);
  const totals = { taxes: sum((x) => x.taxes), ordinary: sum((x) => x.ordinary), socialSecurity: sum((x) => x.socialSecurity), taxableSocialSecurity: sum((x) => x.taxableSocialSecurity), conversions: sum((x) => x.conversion), rmd: sum((x) => x.rmd), qualified: sum((x) => x.qualified) };
  let state;
  if (withState) {
    totals.state = sum((x) => x.state);
    const first = rows[0] ? stateYear(code, r.rows.find((x) => x.year === rows[0].year), { inputs: b.inputs, status: tax.filingStatus, levelAt: levelAt(r.rows) }) : stateIncomeTax(code, { year: b.inputs.startYear, status: tax.filingStatus });
    state = { code, name: first.name, none: first.none, total: totals.state, average: rows.length ? totals.state / rows.length : 0, zeroYears: rows.filter((x) => x.state < 1).length,
      rules: first.rules, yearWords: stateIncomeTax(code, { year: b.inputs.startYear, status: tax.filingStatus })?.yearWords ?? null, indexed: first.indexed, local: LOCAL[code] ?? null };
  }
  const peak = rows.reduce((a, x) => x.taxes > (a?.taxes ?? -1) ? x : a, null);
  const peakWhy = peak ? peak.conversion > 0 ? "a Roth conversion" : peak.rmd > 0 && peak.rmd >= peak.withdrawnDeferred * 0.9 ? "required withdrawals" : peak.withdrawnDeferred > 0 ? "pre-tax withdrawals" : "income" : "";
  const byBracketMap = new Map();
  for (const x of rows) if (x.bracketRate !== null) byBracketMap.set(x.bracketRate, (byBracketMap.get(x.bracketRate) ?? 0) + 1);
  const byBracket = [...byBracketMap.entries()].sort((a, b) => a[0] - b[0]).map(([rate, years]) => ({ rate, years }));
  const flatTaxes = flat.rows.filter((x) => x.retired).reduce((s, x) => s + (real ? x.taxes / x.priceLevel : x.taxes), 0);
  const notes = [...b.notes];
  if ((plan.retirement?.taxMode ?? "flat") !== "brackets") notes.push(`The projection pages still use the flat ${Math.round((plan.retirement?.taxRate ?? 0.15) * 100)}% setting, which comes to $${Math.round(flatTaxes).toLocaleString("en-US")} over the same years; switch Will the money last? to the federal brackets to use these figures.`);
  return { ready: true, missing: [], rows, totals, ...(withState ? { state } : {}), average: rows.length ? totals.taxes / rows.length : 0, peak: peak ? { year: peak.year, taxes: peak.taxes, why: peakWhy } : null, byBracket, flatTaxes, bracketsOn: (plan.retirement?.taxMode ?? "flat") === "brackets", notes, people: b.people, filingStatus: tax.filingStatus, zeroYears: rows.filter((x) => x.taxes < 1).length, real, retireYear: b.inputs.retireYear, success: r.success, failYear: r.failYear,
    noYears: rows.length ? null : noYearsWhy(b.people, b.inputs.startYear ?? (params.today ? Number(String(params.today).slice(0, 4)) : null)) };
}

/** What the state figure leaves out that a reader there would expect (named under "How this is worked out": "... are not counted"). */
const LOCAL = { NY: "New York City's and Yonkers' own income taxes", NJ: "New Jersey's property tax deduction and credit for your home" };

/** The price level of the year the state's figures are for (a state that raises them with prices has them times the rise since). */
const levelAt = (rows) => (year) => rows.find((x) => x.year === year)?.priceLevel ?? (rows.length && year < rows[0].year ? rows[0].priceLevel : null);

/**
 * One projected year's state income tax (in that year's dollars) from the engine's row: federal AGI is the year's ordinary
 * income (pensions, a partner's pay, pre-tax withdrawals, conversions), its gains and dividends and the taxed part of Social
 * Security, as the federal tax has it; the pensions are the projection's pension lines paid that year, as the engine pays
 * them (core/math/retirement.js step 2); the withdrawals are the pre-tax money taken out (required withdrawals included);
 * the ages are the first two people's. The earned income is the pay lines paid that year (a partner still working), the
 * same way; the investment income is the year's gains and dividends (Georgia and New Jersey leave some of these out from 62);
 * the rent is the taxed rent lines paid that year (a place on Rental analysis after its running costs, as the engine taxes
 * it; Georgia's retirement exclusion counts rent).
 * A state that raises its figures with prices has them raised by the plan's inflation since the figures' year.
 * -> stateIncomeTax(...) (never null here: the caller asks only for a state with rules)
 */
export function stateYear(code, x, { inputs, status, levelAt: at }) {
  const i = x?.taxInfo ?? {};
  const paid = { pension: 0, pay: 0, rental: 0 };
  for (const inc of inputs.incomes ?? []) {
    if (!(inc.type in paid) || inc.taxable === false) continue;
    const age = x.ages[inc.personIndex ?? 0];
    if (age < inc.startAge || (inc.endAge !== undefined && inc.endAge !== null && age > inc.endAge)) continue;
    if ((inc.fromYear !== undefined && inc.fromYear !== null && x.year < inc.fromYear) || (inc.untilYear !== undefined && inc.untilYear !== null && x.year > inc.untilYear)) continue;
    paid[inc.type] += inc.yearly * (inc.cola === false ? 1 : x.priceLevel);
  }
  const figures = stateIncomeTax(code, { year: x.year, status })?.figuresYear ?? x.year;
  const base = at(figures);
  const scale = x.year > figures && base ? x.priceLevel / base : 1;
  return stateIncomeTax(code, { year: x.year, status, agi: (i.ordinary ?? 0) + (i.qualified ?? 0) + (i.taxableSocialSecurity ?? 0), taxableSocialSecurity: i.taxableSocialSecurity ?? 0,
    pensions: paid.pension, withdrawals: x.withdrawn?.deferred ?? 0, conversions: x.conversion ?? 0, investment: i.qualified ?? 0, earned: paid.pay, rental: paid.rental, ages: x.ages.slice(0, 2), dependents: 0, scale });
}

/** The name of a state the plan names (the State tax page's list), or null: for the words about a state outside the table. */
export const stateNameOf = (code) => STATE_NAMES[String(code ?? "").toUpperCase()] ?? null;

/**
 * The page's one sentence on the state (R5: one written sentence per case). `s` is compute's `state` (absent: the app has no
 * rules for the state, or none is chosen), `money` the page's formatter, `one` true for a single retirement year, `outside`
 * the name of the plan's state when the app has no rules for it ("Massachusetts income tax is not counted yet.").
 */
export function stateLine(s, money, one = false, outside = null) {
  if (!s) return outside ? `${outside} income tax is not counted yet.` : "State tax is not included.";
  if (s.none && s.code === "WA") return "Washington has no income tax on this; its tax on large capital gains is not counted.";
  if (s.none) return `${s.name} has no state income tax.`;
  if (s.total < 1) return `${s.name} takes no income tax from this retirement income.`;
  return one ? `${s.name} income tax adds about ${money(s.total)} that year.` : `${s.name} income tax adds about ${money(s.total)} over the same years, ${money(s.average)} a year on average.`;
}
