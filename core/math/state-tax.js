// core/math/state-tax.js -- PURE. State income tax worked out from each state's own brackets, deductions, exemptions and
// retirement-income rules (gap design #40). One block per state in STATES; each figure's page and the day it was read are in
// modules/taxes/projection/README.md ("State income tax by brackets"). The states with no income tax are in NO_INCOME_TAX.
// A state in neither gives null: the caller keeps the answer it had before (its own flat rule or none).
//
//   stateIncomeTax(code, income) -> null | { code, name, none, year, figuresYear, older, indexed, base, excluded: {
//     socialSecurity, retirement }, deduction, exemptions, taxable, beforeCredits, credits, tax, rules: [words],
//     yearWords (the figures' year in words when some are not the year asked, else null) }
//
// `income` (a year, in that year's dollars):
//   year           the tax year asked (2026 for this year)
//   status         the federal filing status: single | married_joint | married_separate | head_of_household | qualifying_surviving
//   agi            federal adjusted gross income (with the taxed part of Social Security in it)
//   taxableSocialSecurity   the part of Social Security inside `agi`
//   pensions       pensions inside `agi` (paid by a former employer)
//   withdrawals    money out of a 401(k) or a traditional IRA inside `agi` (required withdrawals included)
//   conversions    Roth conversions inside `agi`
//   ages           the filers' ages at the end of the year (one on a single return, two on a joint one); null when not known
//   dependents     dependents claimed
//   scale          how much prices have risen since the figures' year (1 this year); a state that raises its figures
//                  with prices each year (`indexed`) has them times this, the others keep them as written in law
//
// Graduated tax = the state's own table: the tax at the start of the bracket the taxable income falls in, plus the
// bracket's rate on the part above its start (each state publishes its table this way; the start amounts equal
// Σ rate × (min(income, top) − bottom) over the brackets below, rounded as the state rounds them).

/** The two-letter codes and names this file uses. */
const NAMES = { AK: "Alaska", CA: "California", FL: "Florida", IL: "Illinois", NH: "New Hampshire", NV: "Nevada", NY: "New York", SD: "South Dakota", TN: "Tennessee", TX: "Texas", WA: "Washington", WY: "Wyoming" };

/** The states with no tax on wages or retirement income (Tax Foundation, State Individual Income Tax Rates and Brackets, 2026). */
export const NO_INCOME_TAX = {
  AK: "no income tax", FL: "no income tax", NV: "no income tax", SD: "no income tax", TX: "no income tax", WY: "no income tax", TN: "no income tax",
  NH: "no income tax: its tax on interest and dividends ended in 2025",
  WA: "no income tax on pay, pensions or Social Security; its tax on large capital gains is not counted",
};

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const joint = (s) => s === "married_joint" || s === "qualifying_surviving";
/** The graduated tax from a state's own table: rows [over, rate, base] in order, the base being the tax at `over`. */
export function fromTable(rows, taxable) {
  const t = pos(taxable);
  let row = rows[0];
  for (const r of rows) if (t > r[0]) row = r;
  return row[2] + row[1] * (t - row[0]);
}
/** Σ over brackets of rate × (min(income, top) − bottom), for checking a table's start amounts. rows [over, rate]. */
export function sumOfBrackets(rows, taxable) {
  const t = pos(taxable);
  let tax = 0;
  rows.forEach(([over, rate], i) => { const top = rows[i + 1]?.[0] ?? Infinity; if (t > over) tax += rate * (Math.min(t, top) - over); });
  return tax;
}
const scaled = (rows, k) => rows.map(([over, rate, base]) => [over * k, rate, base * k]);
const filers = (status, ages) => (Array.isArray(ages) ? ages : []).slice(0, joint(status) ? 2 : 1);
const atLeast = (status, ages, age) => filers(status, ages).filter((a) => a !== null && a !== undefined && Number(a) >= age).length;
const people = (status) => (joint(status) ? 2 : 1);

// ---- California ---------------------------------------------------------------------------------------------------------
// Brackets: 2026 California Tax Rate Schedules (FTB, posted October 2026). Standard deduction and exemption credits: 2025
// (Form 540 and its booklet, 2025): the 2026 ones are not out yet. California raises them with prices each year.
const CA = {
  name: "California", figuresYear: 2026, indexed: true,
  // the year's figures in words, when some are not that year's (on screen under "How this is worked out")
  yearWords: (y) => (y > 2026 ? `2026 brackets and 2025 deductions: the ${y} ones are not out yet` : "2026 brackets; the standard deduction and credits are 2025's: the 2026 ones are not out yet"),
  schedules: {
    // Schedule X: single or married filing separately
    single: [[0, 0.01, 0], [11456, 0.02, 114.56], [27157, 0.04, 428.58], [42861, 0.06, 1056.74], [59498, 0.08, 2054.96], [75197, 0.093, 3310.88], [384109, 0.103, 32039.70], [460927, 0.113, 39951.95], [768213, 0.123, 74675.27]],
    // Schedule Y: married filing jointly or qualifying surviving spouse
    joint: [[0, 0.01, 0], [22912, 0.02, 229.12], [54314, 0.04, 857.16], [85722, 0.06, 2113.48], [118996, 0.08, 4109.92], [150394, 0.093, 6621.76], [768218, 0.103, 64079.39], [921854, 0.113, 79903.90], [1536426, 0.123, 149350.54]],
    // Schedule Z: head of household
    hoh: [[0, 0.01, 0], [22927, 0.02, 229.27], [54316, 0.04, 857.05], [70018, 0.06, 1485.13], [86654, 0.08, 2483.29], [102356, 0.093, 3739.45], [522385, 0.103, 42802.15], [626864, 0.113, 53563.49], [1044771, 0.123, 100786.98]],
  },
  standard: { single: 5706, joint: 11412 },           // single and separate; joint, head of household, surviving spouse
  credit: { personal: 153, senior: 153, dependent: 475 },
  creditLimit: { single: 252203, married_separate: 252203, joint: 504411, head_of_household: 378310 },
  behavioralHealth: { over: 1000000, rate: 0.01 },  // the 1% Behavioral Health Services Tax on taxable income over $1 million
  // the rules in plain words, one line each under "How this is worked out" (no "IRA" or other shorthand on screen)
  rules: ["Social Security is not taxed", "pensions and money taken out of retirement accounts are taxed like pay", "a standard deduction comes off first; then a credit for each person (one more from age 65) and for each dependent comes off the tax"],
  tax(x) {
    const k = x.scale, s = x.status;
    const excluded = { socialSecurity: pos(x.taxableSocialSecurity), retirement: 0 };
    const base = Math.max(0, pos(x.agi) - excluded.socialSecurity);
    const deduction = (s === "single" || s === "married_separate" ? this.standard.single : this.standard.joint) * k;
    const taxable = Math.max(0, base - deduction);
    const rows = scaled(s === "head_of_household" ? this.schedules.hoh : joint(s) ? this.schedules.joint : this.schedules.single, k);
    const before = fromTable(rows, taxable) + this.behavioralHealth.rate * Math.max(0, taxable - this.behavioralHealth.over);
    // exemption credits (Form 540 lines 7, 9, 10 and 32): fewer above the income line, $6 per credit for each $2,500 over
    // ($1,250 filing separately) or part of it
    const line = (this.creditLimit[s] ?? this.creditLimit.joint) * k, step = (s === "married_separate" ? 1250 : 2500) * k;
    const cut = pos(x.agi) > line ? Math.ceil((pos(x.agi) - line) / step) * 6 * k : 0;
    const own = people(s) + atLeast(s, x.ages, 65);
    const credits = Math.max(0, own * (this.credit.personal * k - cut)) + Math.max(0, pos(x.dependents) * (this.credit.dependent * k - cut));
    return { excluded, base, deduction, exemptions: 0, taxable, beforeCredits: before, credits, tax: Math.max(0, before - credits) };
  },
};

// ---- New York -----------------------------------------------------------------------------------------------------------
// 2026 rates, standard deduction and dependent exemption: IT-2105-I (2026), Estimated tax payments for individuals.
// The pension and annuity exclusion and the Social Security subtraction: IT-201 and its instructions (2025). New York
// writes its figures in law and does not raise them with prices.
const NY = {
  name: "New York", figuresYear: 2026, indexed: false,
  // the law cuts the five lower rates by 0.1 point more from 2027 (the second half of the 2026 cut): not counted yet, and said
  yearWords: (y) => (y > 2026 ? "2026 rates: the small further cut New York's law makes to its lower rates from 2027 is not counted yet, so later years are a little high" : null),
  tables: {
    joint: [[0, 0.039, 0], [17150, 0.044, 669], [23600, 0.0515, 953], [27900, 0.054, 1174], [161550, 0.059, 8391], [323200, 0.0685, 17928], [2155350, 0.0965, 143430], [5000000, 0.103, 417939], [25000000, 0.109, 2477939]],
    single: [[0, 0.039, 0], [8500, 0.044, 332], [11700, 0.0515, 473], [13900, 0.054, 586], [80650, 0.059, 4191], [215400, 0.0685, 12141], [1077550, 0.0965, 71198], [5000000, 0.103, 449714], [25000000, 0.109, 2509714]],
    hoh: [[0, 0.039, 0], [12800, 0.044, 499], [17650, 0.0515, 712], [20900, 0.054, 879], [107650, 0.059, 5564], [269300, 0.0685, 15101], [1616450, 0.0965, 107381], [5000000, 0.103, 433894], [25000000, 0.109, 2493894]],
  },
  // tax computation worksheets 1 to 16: above $107,650 of New York AGI the lower brackets' benefit is taken back.
  // first: taxable income up to `upto` is taxed at `flat` once New York AGI reaches $157,650, in steps from $107,650;
  // then each [over, base, incremental]: table tax + base + incremental × (the lesser of AGI over `over` and $50,000) ÷ $50,000
  recapture: {
    joint: { upto: 161550, flat: 0.054, steps: [[161550, 333, 807], [323200, 1140, 3071], [2155350, 4211, 60350], [5000000, 64561, 32500]] },
    single: { upto: 215400, flat: 0.059, steps: [[215400, 567, 2047], [1077550, 2614, 30172], [5000000, 32786, 32500]] },
    hoh: { upto: 269300, flat: 0.059, steps: [[269300, 787, 2559], [1616450, 3346, 45260], [5000000, 48606, 32500]] },
  },
  standard: { single: 8000, married_joint: 16050, married_separate: 8000, head_of_household: 11200, qualifying_surviving: 16050 },
  dependent: 1000,
  pensionExclusion: { each: 20000, age: 60 },   // $20,000 a person 59½ or older (counted here from the year a person turns 60)
  rules: ["Social Security is not taxed", "pensions and money taken out of retirement accounts: the first $20,000 a person is not taxed from age 59½", "a standard deduction comes off first"],
  tax(x) {
    const s = x.status;
    const g = s === "head_of_household" ? "hoh" : joint(s) ? "joint" : "single";
    const ss = pos(x.taxableSocialSecurity);
    const eligible = atLeast(s, x.ages, this.pensionExclusion.age);
    const retirement = Math.min(pos(x.pensions) + pos(x.withdrawals), this.pensionExclusion.each * eligible);
    const nyagi = Math.max(0, pos(x.agi) - ss - retirement);
    const deduction = this.standard[s] ?? this.standard.single;
    const exemptions = this.dependent * pos(x.dependents);
    const taxable = Math.max(0, nyagi - deduction - exemptions);
    const table = fromTable(this.tables[g], taxable);
    let tax = table;
    if (nyagi > 25000000) tax = 0.109 * taxable;
    else if (nyagi > 107650) {
      const R = this.recapture[g];
      const frac = (over) => Math.round(Math.min(Math.max(0, nyagi - over), 50000) / 50000 * 10000) / 10000;
      if (taxable <= R.upto) { const flat = taxable * R.flat; tax = nyagi >= 157650 ? flat : table + (flat - table) * frac(107650); }
      else { const st = [...R.steps].reverse().find(([over]) => taxable > over); tax = table + st[1] + st[2] * frac(st[0]); }
    }
    return { excluded: { socialSecurity: ss, retirement }, base: nyagi, deduction, exemptions, taxable, beforeCredits: tax, credits: 0, tax: Math.max(0, tax) };
  },
};

// ---- Illinois -----------------------------------------------------------------------------------------------------------
// 2026 rate and exemption: Booklet IL-700-T (2026), effective January 1, 2026 ($2,925 a person). The retirement subtraction
// (Line 5), the $1,000 for 65 or older (Line 10b) and the income limit on the exemption: IL-1040 instructions (2025).
// Illinois raises its exemption with prices; the $1,000 stays as written.
const IL = {
  name: "Illinois", figuresYear: 2026, indexed: true,
  yearWords: (y) => (y > 2026 ? `2026 figures: the ${y} ones are not out yet` : null),
  rate: 0.0495, exemption: 2925, senior: 1000, noExemptionOver: { joint: 500000, other: 250000 },
  rules: ["Social Security, pensions and money taken out of retirement accounts are not taxed", "the rest is taxed at one rate, 4.95%, after $2,925 a person"],
  tax(x) {
    const k = x.scale, s = x.status;
    const ss = pos(x.taxableSocialSecurity), retirement = pos(x.pensions) + pos(x.withdrawals) + pos(x.conversions);
    const base = Math.max(0, pos(x.agi) - ss - retirement);
    const over = s === "married_joint" ? this.noExemptionOver.joint : this.noExemptionOver.other;
    // one exemption a filer (two on a joint return; a surviving spouse files alone) and one a dependent
    const exemptions = pos(x.agi) > over ? 0 : this.exemption * k * ((s === "married_joint" ? 2 : 1) + pos(x.dependents)) + this.senior * atLeast(s, x.ages, 65);
    const taxable = Math.max(0, base - exemptions);
    const tax = this.rate * taxable;
    return { excluded: { socialSecurity: ss, retirement }, base, deduction: 0, exemptions, taxable, beforeCredits: tax, credits: 0, tax };
  },
};

/** The states worked out from their own figures, by two-letter code. A second stage adds more here, one block each. */
export const STATES = { CA, NY, IL };

/** Does the app have this state's rules (its brackets, or no income tax at all)? */
export const hasRules = (code) => !!(STATES[String(code ?? "").toUpperCase()] || NO_INCOME_TAX[String(code ?? "").toUpperCase()]);

/** The state's income tax for a year, or null when the app has no rules for the state (the caller keeps its own answer). */
export function stateIncomeTax(code, income = {}) {
  const c = String(code ?? "").toUpperCase();
  const year = Number(income.year) || null;
  if (NO_INCOME_TAX[c]) return { code: c, name: NAMES[c] ?? c, none: true, year, figuresYear: year, older: false, indexed: false, yearWords: null, base: 0, excluded: { socialSecurity: 0, retirement: 0 }, deduction: 0, exemptions: 0, taxable: 0, beforeCredits: 0, credits: 0, tax: 0, rules: [NO_INCOME_TAX[c]] };
  const S = STATES[c];
  if (!S) return null;
  const x = { ...income, status: income.status ?? "single", scale: S.indexed ? Math.max(1, Number(income.scale) || 1) : 1 };
  const r = S.tax(x);
  return { code: c, name: S.name, none: false, year, figuresYear: S.figuresYear, older: year !== null && year > S.figuresYear, indexed: S.indexed, yearWords: S.yearWords(year ?? S.figuresYear), ...r, rules: S.rules.slice() };
}
