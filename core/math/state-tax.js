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
//   investment     interest, dividends and gains inside `agi` (optional; Georgia and New Jersey leave some of it out from 62)
//   rental         net rent (after its costs; a loss below 0) inside `agi` (optional; Georgia's retirement exclusion counts it)
//   earned         pay and business profit inside `agi` (optional; Georgia counts $5,000 of it in its retirement exclusion,
//                  New Jersey allows its second retirement exclusion only at $3,000 or less; not given = not known)
//   ages           the filers' ages at the end of the year (one on a single return, two on a joint one); null when not known
//   dependents     dependents claimed
//   children       the dependents under 17 (North Carolina's child deduction; not given = `dependents`)
//   scale          how much prices have risen since the figures' year (1 this year); a state that raises its figures
//                  with prices each year (`indexed`) has them times this, the others keep them as written in law
//
// Graduated tax = the state's own table: the tax at the start of the bracket the taxable income falls in, plus the
// bracket's rate on the part above its start (each state publishes its table this way; the start amounts equal
// Σ rate × (min(income, top) − bottom) over the brackets below, rounded as the state rounds them). New Jersey publishes
// its own as "multiply by the rate, subtract", and that form is kept as written.

/** The two-letter codes and names this file uses. */
const NAMES = { AK: "Alaska", CA: "California", FL: "Florida", GA: "Georgia", IL: "Illinois", NC: "North Carolina", NH: "New Hampshire", NJ: "New Jersey", NV: "Nevada", NY: "New York", SD: "South Dakota", TN: "Tennessee", TX: "Texas", VA: "Virginia", WA: "Washington", WY: "Wyoming" };

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

// the filers on the return (two only on a joint one: a surviving spouse files alone), with a known age
const onReturn = (status, ages) => (Array.isArray(ages) ? ages : []).slice(0, status === "married_joint" ? 2 : 1).filter((a) => a !== null && a !== undefined && Number.isFinite(Number(a))).map(Number);
// a table printed as "multiply by the rate, then subtract": [over, rate, subtract] -> [over, rate, the tax at `over`]
const subtractForm = (rows) => rows.map(([over, rate, sub]) => [over, rate, rate * over - sub]);

// ---- Georgia ------------------------------------------------------------------------------------------------------------
// 2026 rate, standard deduction and dependent deduction: Employer's Tax Guide (2026, updated September 2026), "What's new for
// tax year 2026" (HB 463, back to January 1, 2026). Social Security and the retirement income exclusion: IT-511 booklet (2025),
// Schedule 1 and its page 2: the 2026 booklet is not out yet. Georgia writes its figures in law.
const GA = {
  name: "Georgia", figuresYear: 2026, indexed: false,
  yearWords: (y) => (y > 2026 ? `2026 rate and deductions and 2025's retirement exclusion: the ${y} ones are not out yet` : "2026 rate and deductions; the retirement exclusion is 2025's: the 2026 one is not out yet"),
  rate: 0.0499,
  standard: { joint: 30000, other: 15000 },   // married filing jointly; single, head of household, separately, surviving spouse
  dependent: 5000,
  // the retirement income exclusion a person: 62 to 64 $35,000, 65 or older $65,000, of which up to $5,000 may be pay
  exclusion: { from62: 35000, from65: 65000, earned: 5000 },
  rules: ["Social Security is not taxed", "from age 62, the first $35,000 a person of pensions, money taken out of retirement accounts, interest, dividends, gains and rent is not taxed, and from 65 the first $65,000", "the rest is taxed at one rate, 4.99%, after a standard deduction and $5,000 for each dependent"],
  tax(x) {
    const s = x.status;
    const ss = pos(x.taxableSocialSecurity);
    const ages = onReturn(s, x.ages);
    const cap = ages.reduce((t, a) => t + (a >= 65 ? this.exclusion.from65 : a >= 62 ? this.exclusion.from62 : 0), 0);
    // what the exclusion covers (Form 500 Schedule 1 page 2, lines 5 to 14): pensions, IRA money (conversions too: Georgia
    // follows the federal rules on them), interest, dividends and gains, rent, royalties and partnership income (line 13, a loss
    // counted against the rest; line 14: never below 0), and up to $5,000 of pay a person who qualifies
    const rent = Number.isFinite(Number(x.rental)) ? Number(x.rental) : 0;
    const unearned = Math.max(0, pos(x.pensions) + pos(x.withdrawals) + pos(x.conversions) + pos(x.investment) + rent);
    const counted = unearned + Math.min(pos(x.earned), this.exclusion.earned * ages.filter((a) => a >= 62).length);
    const retirement = Math.min(counted, cap, Math.max(0, pos(x.agi) - ss));
    const base = Math.max(0, pos(x.agi) - ss - retirement);
    const deduction = s === "married_joint" ? this.standard.joint : this.standard.other;
    const exemptions = this.dependent * pos(x.dependents);
    const taxable = Math.max(0, base - deduction - exemptions);
    const tax = this.rate * taxable;
    return { excluded: { socialSecurity: ss, retirement }, base, deduction, exemptions, taxable, beforeCredits: tax, credits: 0, tax };
  },
};

// ---- North Carolina -----------------------------------------------------------------------------------------------------
// 2026 rate and standard deduction: Form NC-40 instructions, "For tax years beginning on or after January 1, 2026" (Session
// Law 2023-134). The child deduction: Form NC-4 (October 2025, used with the 2026 withholding tables), Schedule 2, as in the
// D-401 instructions (2025), line 10. Social Security: D-401 (2025), Schedule S line 19. North Carolina writes its figures in law.
const NC = {
  name: "North Carolina", figuresYear: 2026, indexed: false,
  yearWords: (y) => (y > 2026 ? `2026 figures: the ${y} ones are not out yet` : null),
  rate: 0.0399,
  standard: { single: 12750, married_separate: 12750, head_of_household: 19125, married_joint: 25500, qualifying_surviving: 25500 },
  // the child deduction for each qualifying child: $3,000 up to the first federal AGI line, $500 less over each line after
  child: { joint: [40000, 60000, 80000, 100000, 120000, 140000], hoh: [30000, 45000, 60000, 75000, 90000, 105000], single: [20000, 30000, 40000, 50000, 60000, 70000] },
  rules: ["Social Security is not taxed", "pensions and money taken out of retirement accounts are taxed like pay", "income is taxed at one rate, 3.99%, after a standard deduction and an amount for each child"],
  tax(x) {
    const s = x.status;
    const ss = pos(x.taxableSocialSecurity);
    const base = Math.max(0, pos(x.agi) - ss);
    const deduction = this.standard[s] ?? this.standard.single;
    const lines = this.child[s === "head_of_household" ? "hoh" : joint(s) ? "joint" : "single"];
    const kids = x.children === undefined || x.children === null ? pos(x.dependents) : pos(x.children);
    const exemptions = kids * Math.max(0, 3000 - 500 * lines.filter((l) => pos(x.agi) > l).length);
    const taxable = Math.max(0, base - deduction - exemptions);
    const tax = this.rate * taxable;
    return { excluded: { socialSecurity: ss, retirement: 0 }, base, deduction, exemptions, taxable, beforeCredits: tax, credits: 0, tax };
  },
};

// ---- New Jersey ---------------------------------------------------------------------------------------------------------
// 2026 rates and exemptions: Form NJ-1040-ES (2026), Tables A and B and "Exemptions". The pension exclusion (line 28a), the
// other retirement income exclusion (line 28b, Worksheet D), Social Security and the filing threshold: NJ-1040 instructions
// (2025): the 2026 ones are not out yet. New Jersey writes its figures in law.
const NJ = {
  name: "New Jersey", figuresYear: 2026, indexed: false,
  yearWords: (y) => (y > 2026 ? `2026 rates and 2025's retirement exclusions: the ${y} ones are not out yet` : "2026 rates and exemptions; the retirement exclusions are 2025's: the 2026 ones are not out yet"),
  // as printed, [over, rate, subtract]: Table A single and married filing separately; Table B joint, head of household, surviving spouse
  printed: {
    single: [[0, 0.014, 0], [20000, 0.0175, 70], [35000, 0.035, 682.5], [40000, 0.05525, 1492.5], [75000, 0.0637, 2126.25], [500000, 0.0897, 15126.25], [1000000, 0.1075, 32926.25]],
    joint: [[0, 0.014, 0], [20000, 0.0175, 70], [50000, 0.0245, 420], [70000, 0.035, 1154.5], [80000, 0.05525, 2775], [150000, 0.0637, 4042.5], [500000, 0.0897, 17042.5], [1000000, 0.1075, 34842.5]],
  },
  exemption: { person: 1000, senior: 1000, dependent: 1500 },
  // the exclusion by filing status: [the amount up to $100,000 of income, the share from $100,001 to $125,000, from $125,001 to
  // $150,000]; line 28a takes the share of the pension, Worksheet D's maximum the share of the income; none over $150,000
  exclusion: { married_joint: [100000, 0.5, 0.25], married_separate: [50000, 0.25, 0.125], other: [75000, 0.375, 0.1875] },
  threshold: { single: 10000, married_separate: 10000, other: 20000 },   // New Jersey gross income at or below it: no tax
  rules: ["Social Security is not taxed", "from age 62, pensions and money taken out of retirement accounts are not taxed, up to $100,000 for a couple or $75,000 alone", "that shrinks once your income passes $100,000, and stops above $150,000", "$1,000 a person, $1,000 more from age 65 and $1,500 for each dependent are not taxed"],
  tax(x) {
    const s = x.status;
    const ss = pos(x.taxableSocialSecurity);
    const income = Math.max(0, pos(x.agi) - ss);                          // line 27: the income, Social Security left out
    const ages = onReturn(s, x.ages);
    const E = this.exclusion[s] ?? this.exclusion.other;
    const pension = pos(x.pensions) + pos(x.withdrawals) + pos(x.conversions);   // line 20a (a conversion is reported there)
    let a = 0, b = 0;
    if (ages.some((g) => g >= 62) && income <= 150000) {
      const share = income <= 100000 ? null : income <= 125000 ? E[1] : E[2];
      a = share === null ? Math.min(pension, E[0]) : pension * share;            // line 28a
      const most = share === null ? E[0] : income * share;                       // Worksheet D line 1
      // line 28b: the rest of the maximum, when pay and business income are $3,000 or less (not known: not used)
      const earned = x.earned === undefined || x.earned === null ? Infinity : pos(x.earned);
      if (earned <= 3000) b = Math.max(0, most - a);
    }
    const retirement = Math.min(income, a + b);
    const gross = income - retirement;                                       // line 29: New Jersey gross income
    const exemptions = this.exemption.person * (s === "married_joint" ? 2 : 1) + this.exemption.senior * ages.filter((g) => g >= 65).length + this.exemption.dependent * pos(x.dependents);
    const taxable = Math.max(0, gross - exemptions);
    const before = Math.max(0, fromTable(subtractForm(this.printed[s === "single" || s === "married_separate" ? "single" : "joint"]), taxable));
    const tax = gross <= (this.threshold[s] ?? this.threshold.other) ? 0 : before;
    return { excluded: { socialSecurity: ss, retirement }, base: gross, deduction: 0, exemptions, taxable, beforeCredits: before, credits: 0, tax };
  },
};

// ---- Virginia -----------------------------------------------------------------------------------------------------------
// 2026 rates, personal exemptions and the filing threshold: Form 760ES (2026, Rev. 09/25), its Tax Rate Schedule, worksheet
// line 4 and Section I. The standard deduction for 2025 and 2026, the age deduction and Social Security: Form 760 instructions
// (2025), Lines 4, 5 and 11 and the Age 65 and Older Deduction Worksheet: the 2026 ones are not out yet. The standard
// deduction from 2027: the 2026 Appropriation Act (House Bill 30, Special Session I, Chapter 1, third enactment clause), in
// Virginia Tax's 2026 Legislative Summary (no. 26-82, issued 2026-07-06). Virginia writes its figures in law.
const VA = {
  name: "Virginia", figuresYear: 2026, indexed: false,
  yearWords: (y) => (y > 2026 ? `2026 rates and exemptions and 2025's age deduction: the ${y} ones are not out yet` : "2026 rates and exemptions; the age deduction is 2025's: the 2026 one is not out yet"),
  schedule: [[0, 0.02, 0], [3000, 0.03, 60], [5000, 0.05, 120], [17000, 0.0575, 720]],
  // the standard deduction by tax year, [the last year it is for, married filing jointly, everyone else] (head of household
  // and a surviving spouse file as single in Virginia): $8,750 / $17,500 for 2025 and 2026; $9,200 / $18,400 for 2027;
  // $9,300 / $18,600 for 2028 and 2029; then, as the law stands, back to the amounts before 2019, $3,000 / $6,000
  standard: [[2026, 17500, 8750], [2027, 18400, 9200], [2029, 18600, 9300], [Infinity, 6000, 3000]],
  exemption: { person: 930, senior: 800 },
  // $12,000 each from 65; for those born after January 1, 1939 cut by $1 for each $1 of income (federal AGI less the taxed
  // Social Security) over $50,000 alone or $75,000 married
  age: { each: 12000, single: 50000, married: 75000, fullUpToBirthYear: 1938 },
  threshold: { joint: 23900, other: 11950 },   // Virginia AGI under it: no tax
  rules: ["Social Security is not taxed", "from age 65, $12,000 a person is not taxed; that shrinks by $1 for each $1 of income over $50,000 ($75,000 for a couple)", "a standard deduction and $930 a person come off first", "the standard deduction, $8,750 alone or $17,500 for a couple, rises to $9,200 ($18,400) in 2027 and $9,300 ($18,600) in 2028 and 2029; then, as the law stands today, it falls to $3,000 ($6,000)"],
  tax(x) {
    const s = x.status, y = Number(x.year) || 2026;
    const ss = pos(x.taxableSocialSecurity);
    const ages = onReturn(s, x.ages);
    const afagi = Math.max(0, pos(x.agi) - ss);
    const old = ages.filter((a) => a >= 65);
    const full = old.filter((a) => y - a <= this.age.fullUpToBirthYear).length;
    const over = Math.max(0, afagi - (s === "married_joint" || s === "married_separate" ? this.age.married : this.age.single));
    const ageDeduction = Math.min(afagi, full * this.age.each + Math.max(0, (old.length - full) * this.age.each - over));
    const vagi = afagi - ageDeduction;                                       // line 9, Virginia AGI
    const row = this.standard.find(([last]) => y <= last);
    const deduction = s === "married_joint" ? row[1] : row[2];
    const exemptions = this.exemption.person * ((s === "married_joint" ? 2 : 1) + pos(x.dependents)) + this.exemption.senior * old.length;
    const taxable = Math.max(0, vagi - deduction - exemptions);
    const before = fromTable(this.schedule, taxable);
    const tax = vagi < (s === "married_joint" ? this.threshold.joint : this.threshold.other) ? 0 : before;
    return { excluded: { socialSecurity: ss, retirement: ageDeduction }, base: vagi, deduction, exemptions, taxable, beforeCredits: before, credits: 0, tax };
  },
};

/** The states worked out from their own figures, by two-letter code, one block each. */
export const STATES = { CA, NY, IL, GA, NC, NJ, VA };

/** The names of the states the app works out from their own figures (not the ones with no income tax), in table order. */
export const stateNames = () => Object.values(STATES).map((S) => S.name);

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
