// tests/state-tax.test.mjs -- core/math/state-tax.js (gap design #40): each state's own worked example or table rows, the
// flat states (Illinois, Georgia, North Carolina), the states with no income tax, Social Security and retirement income left out where the state says so,
// and a state outside the table giving null (its callers keep their answer). Sources and read dates:
// modules/taxes/projection/README.md "State income tax by brackets".
import { test } from "node:test";
import assert from "node:assert/strict";
import { stateIncomeTax, hasRules, fromTable, sumOfBrackets, STATES, NO_INCOME_TAX } from "../core/math/state-tax.js";

const near = (a, b, tol = 0.005, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);

test("every table's start amounts are the sum of the brackets below (California to the cent, New York to the dollar it rounds to)", () => {
  for (const [g, rows] of Object.entries(STATES.CA.schedules)) for (const r of rows) near(sumOfBrackets(rows, r[0]), r[2], 0.02, `CA ${g} ${r[0]}`);
  for (const [g, rows] of Object.entries(STATES.NY.tables)) for (const r of rows) near(sumOfBrackets(rows, r[0]), r[2], 1, `NY ${g} ${r[0]}`);
  // the graduated tax: rate × (min(income, top) − bottom) summed, the same as the table's own form inside a bracket
  near(fromTable(STATES.CA.schedules.single, 50000), sumOfBrackets(STATES.CA.schedules.single, 50000), 0.02);
});

test("California: the 2026 Tax Rate Schedules' own example (Chris and Pat Smith, joint, taxable income $125,000: $4,590)", () => {
  // Step 2: 125,000 − 118,996 = 6,004; Step 3: × 8% = 480.32; Step 4: + 4,109.92 = 4,590.24, entered as $4,590
  assert.equal(Math.round(fromTable(STATES.CA.schedules.joint, 125000) * 100) / 100, 4590.24);
  // the same couple through the engine: AGI = taxable income + the $11,412 standard deduction (2025's: the 2026 one is not
  // out yet), less two personal exemption credits of $153 (Form 540 line 7)
  const r = stateIncomeTax("CA", { year: 2026, status: "married_joint", agi: 136412, ages: [45, 44] });
  assert.equal(r.deduction, 11412); assert.equal(r.taxable, 125000);
  near(r.beforeCredits, 4590.24); assert.equal(r.credits, 306); near(r.tax, 4284.24);
  assert.equal(r.yearWords, "2026 brackets; the standard deduction and credits are 2025's: the 2026 ones are not out yet");
});

test("California: single (Schedule X), head of household (Schedule Z), the senior and dependent credits, and their cut above the income line", () => {
  // single, taxable $50,000: 1,056.74 + 6% × (50,000 − 42,861) = 1,485.08; one personal credit $153
  const s = stateIncomeTax("CA", { year: 2026, status: "single", agi: 55706, ages: [40] });
  near(s.beforeCredits, 1485.08); near(s.tax, 1485.08 - 153);
  // head of household, taxable $80,000: 1,485.13 + 6% × (80,000 − 70,018) = 2,084.05; one personal, two dependents ($475 each)
  const h = stateIncomeTax("CA", { year: 2026, status: "head_of_household", agi: 91412, ages: [40], dependents: 2 });
  near(h.beforeCredits, 2084.05); near(h.credits, 153 + 950); near(h.tax, 2084.05 - 1103);
  // 65 or older: a senior credit each (line 9)
  assert.equal(stateIncomeTax("CA", { year: 2026, status: "married_joint", agi: 60000, ages: [70, 66] }).credits, 4 * 153);
  // over the line ($252,203 single): $6 off each credit for each $2,500 or part of it; $10,000 over is 4 steps, $24 off
  near(stateIncomeTax("CA", { year: 2026, status: "single", agi: 262203, ages: [40] }).credits, 153 - 24);
  // the 1% on taxable income over $1 million (Behavioral Health Services Tax)
  const m = stateIncomeTax("CA", { year: 2026, status: "single", agi: 1105706, ages: [50] });
  near(m.beforeCredits, fromTable(STATES.CA.schedules.single, 1100000) + 1000);
});

test("New York: the 2026 rate table rows (IT-2105-I, 2026) and the dependent exemption", () => {
  // single, taxable $50,000: 586 plus 5.40% of the excess over 13,900 = 2,535.40
  const s = stateIncomeTax("NY", { year: 2026, status: "single", agi: 58000, ages: [40] });
  assert.equal(s.deduction, 8000); assert.equal(s.taxable, 50000); near(s.tax, 2535.40);
  // married filing jointly, taxable $80,000 (New York AGI under $107,650): 1,174 plus 5.40% of the excess over 27,900 = 3,987.40
  near(stateIncomeTax("NY", { year: 2026, status: "married_joint", agi: 96050, ages: [40, 40] }).tax, 3987.40);
  // head of household with two dependents ($1,000 each): NYAGI 50,000 − 11,200 − 2,000 = 36,800 taxable; 879 + 5.4% × 15,900
  const h = stateIncomeTax("NY", { year: 2026, status: "head_of_household", agi: 50000, ages: [40], dependents: 2 });
  assert.equal(h.exemptions, 2000); near(h.tax, 879 + 0.054 * 15900);
  // filing separately uses the single table; a surviving spouse the joint one
  near(stateIncomeTax("NY", { year: 2026, status: "married_separate", agi: 58000, ages: [40] }).tax, 2535.40);
  near(stateIncomeTax("NY", { year: 2026, status: "qualifying_surviving", agi: 96050, ages: [40] }).tax, 3987.40);
});

test("New York: above $107,650 of New York AGI the lower brackets' benefit is taken back (tax computation worksheets 7, 8 and 1)", () => {
  // worksheet 7, single, NYAGI 128,000, taxable 120,000: table 4,191 + 5.9% × 39,350 = 6,512.65; flat 120,000 × 5.9% = 7,080;
  // (7,080 − 6,512.65) × 0.4070 [(128,000 − 107,650) ÷ 50,000] = 230.91; 6,512.65 + 230.91
  near(stateIncomeTax("NY", { year: 2026, status: "single", agi: 128000, ages: [40] }).tax, 6512.65 + 567.35 * 0.407, 0.01);
  // at $157,650 or more the whole taxable income is at 5.9%
  near(stateIncomeTax("NY", { year: 2026, status: "single", agi: 168000, ages: [40] }).tax, 160000 * 0.059);
  // worksheet 8, single, NYAGI 300,000, taxable 292,000: table 12,141 + 6.85% × 76,600 + 567 + 2,047 × 1 (the lesser of
  // 84,600 and 50,000, over 50,000)
  near(stateIncomeTax("NY", { year: 2026, status: "single", agi: 300000, ages: [50] }).tax, 12141 + 0.0685 * 76600 + 567 + 2047, 0.01);
  // worksheet 1, joint, NYAGI 140,000, taxable 123,950: table 1,174 + 5.4% × 96,050 = 6,360.70; flat 123,950 × 5.4% = 6,693.30;
  // (6,693.30 − 6,360.70) × 0.6470 [(140,000 − 107,650) ÷ 50,000] = 215.19
  near(stateIncomeTax("NY", { year: 2026, status: "married_joint", agi: 140000, ages: [50, 50] }).tax, 6360.70 + 332.60 * 0.647, 0.01);
  // over $25 million: 10.9% of all of it (worksheet 11)
  near(stateIncomeTax("NY", { year: 2026, status: "single", agi: 30008000, ages: [50] }).tax, 30000000 * 0.109);
});

test("New York: pension and IRA income up to $20,000 a person from 59½ is left out, and Social Security is not taxed", () => {
  const base = { year: 2026, status: "married_joint", agi: 80000, ages: [67, 64] };
  const none = stateIncomeTax("NY", base);
  // both 60 or older: up to $40,000 of pensions and withdrawals left out
  const both = stateIncomeTax("NY", { ...base, pensions: 25000, withdrawals: 20000 });
  assert.equal(both.excluded.retirement, 40000); near(both.base, 40000);
  // one of them under 60: $20,000
  assert.equal(stateIncomeTax("NY", { ...base, ages: [67, 55], pensions: 25000, withdrawals: 20000 }).excluded.retirement, 20000);
  // Social Security: the part in AGI comes off whole
  const ss = stateIncomeTax("NY", { ...base, agi: 95000, taxableSocialSecurity: 15000 });
  near(ss.tax, none.tax);
  assert.deepEqual(STATES.NY.rules.slice(0, 2), ["Social Security is not taxed", "pensions and money taken out of retirement accounts: the first $20,000 a person is not taxed from age 59½"]);
});

test("Illinois: Booklet IL-700-T's own example (Alice, $800 a week, two allowances of $2,925 and two of $1,000: $32.13 a week)", () => {
  // the year's version: $41,600 of pay on a joint return, both 65 or older: (41,600 − 2 × 2,925 − 2 × 1,000) × 4.95% = 1,670.63,
  // which is 52 weeks of $32.13 (1,670.76) less the weekly rounding
  const r = stateIncomeTax("IL", { year: 2026, status: "married_joint", agi: 41600, ages: [66, 67] });
  assert.equal(r.exemptions, 7850); near(r.tax, 1670.625);
  near(r.tax, 52 * 32.13, 0.2);
});

test("Illinois is one flat rate: 4.95% of every dollar above the exemptions, at any income", () => {
  for (const agi of [10000, 60000, 200000]) {
    const r = stateIncomeTax("IL", { year: 2026, status: "single", agi, ages: [40] });
    near(r.tax, 0.0495 * Math.max(0, agi - 2925), 1e-6);
  }
  // above $250,000 (single) or $500,000 (joint) of federal AGI there is no exemption (IL-1040 instructions, Line 10)
  assert.equal(stateIncomeTax("IL", { year: 2026, status: "single", agi: 250001, ages: [40] }).exemptions, 0);
  assert.equal(stateIncomeTax("IL", { year: 2026, status: "married_joint", agi: 500000, ages: [40, 40], dependents: 1 }).exemptions, 3 * 2925);
  // a surviving spouse files alone: one exemption
  assert.equal(stateIncomeTax("IL", { year: 2026, status: "qualifying_surviving", agi: 50000, ages: [50] }).exemptions, 2925);
});

test("Illinois: Social Security, pensions, IRA and 401(k) withdrawals and Roth conversions come off (IL-1040 Line 5)", () => {
  const r = stateIncomeTax("IL", { year: 2026, status: "married_joint", agi: 90000, taxableSocialSecurity: 20000, pensions: 30000, withdrawals: 25000, conversions: 5000, ages: [70, 68] });
  assert.equal(r.excluded.socialSecurity, 20000); assert.equal(r.excluded.retirement, 60000);
  near(r.tax, 0.0495 * Math.max(0, 10000 - 2 * 2925 - 2000));
  // only retirement income: no tax
  assert.equal(stateIncomeTax("IL", { year: 2026, status: "single", agi: 40000, taxableSocialSecurity: 10000, pensions: 30000, ages: [70] }).tax, 0);
});

test("Georgia: the 2026 Employer's Tax Guide's own example (married, one earner, one child, $2,000 semi-monthly: $27.03)", () => {
  // Step 1: 2,000 − 1,250 (Table E, married filing joint, semi-monthly: a 24th of $30,000); Step 2: − 208.33 (a 24th of the
  // $5,000 dependent allowance) = 541.67; Step 3: × 4.99% = 27.03. The year's version: (48,000 − 30,000 − 5,000) × 4.99%
  const r = stateIncomeTax("GA", { year: 2026, status: "married_joint", agi: 48000, ages: [40, 38], dependents: 1 });
  assert.equal(r.deduction, 30000); assert.equal(r.exemptions, 5000); assert.equal(r.taxable, 13000); near(r.tax, 648.70);
  near(r.tax / 24, 27.03, 0.005);
  near(Math.round((2000 - 1250 - 208.33) * 0.0499 * 100) / 100, 27.03, 1e-9);
  // single, head of household and filing separately: $15,000
  for (const status of ["single", "head_of_household", "married_separate", "qualifying_surviving"]) assert.equal(stateIncomeTax("GA", { year: 2026, status, agi: 40000, ages: [40] }).deduction, 15000, status);
  assert.equal(r.yearWords, "2026 rate and deductions; the retirement exclusion is 2025's: the 2026 one is not out yet");
});

test("Georgia is one flat rate (4.99%) above its deductions, and leaves out retirement income from 62 (IT-511, Schedule 1)", () => {
  for (const agi of [20000, 80000, 400000]) near(stateIncomeTax("GA", { year: 2026, status: "single", agi, ages: [40] }).tax, 0.0499 * Math.max(0, agi - 15000), 1e-6);
  // 65 or older: $65,000 each of pensions, IRA money, interest, dividends and gains; 62 to 64: $35,000
  const both = stateIncomeTax("GA", { year: 2026, status: "married_joint", agi: 150000, pensions: 60000, withdrawals: 40000, investment: 30000, ages: [67, 63] });
  assert.equal(both.excluded.retirement, 100000); near(both.tax, 0.0499 * (150000 - 100000 - 30000));
  // under the caps all of it comes off; only pay above $5,000 a person is taxed
  const r = stateIncomeTax("GA", { year: 2026, status: "single", agi: 50000, pensions: 30000, investment: 8000, earned: 12000, ages: [66] });
  assert.equal(r.excluded.retirement, 43000); near(r.tax, 0.0499 * Math.max(0, 7000 - 15000));
  // before 62: none
  assert.equal(stateIncomeTax("GA", { year: 2026, status: "single", agi: 50000, pensions: 30000, ages: [61] }).excluded.retirement, 0);
  // a Roth conversion is IRA money in Georgia
  assert.equal(stateIncomeTax("GA", { year: 2026, status: "single", agi: 50000, conversions: 50000, ages: [70] }).excluded.retirement, 50000);
  // rent counts too (Form 500 Schedule 1 page 2, line 13 "Rental, Royalty, Partnership, S Corp, etc. Income (Losses)"):
  // a pension of $20,000 and $30,000 of rent at 66 are all left out; before 62, none of it
  const rent = stateIncomeTax("GA", { year: 2026, status: "single", agi: 50000, pensions: 20000, rental: 30000, ages: [66] });
  assert.equal(rent.excluded.retirement, 50000); assert.equal(rent.tax, 0);
  near(stateIncomeTax("GA", { year: 2026, status: "single", agi: 50000, pensions: 20000, rental: 30000, ages: [60] }).tax, 0.0499 * (50000 - 15000));
  // a rental loss is counted against the rest (line 14: never below 0), as it lowers AGI
  assert.equal(stateIncomeTax("GA", { year: 2026, status: "single", agi: 30000, pensions: 40000, rental: -10000, ages: [66] }).excluded.retirement, 30000);
  assert.equal(stateIncomeTax("GA", { year: 2026, status: "single", agi: 0, pensions: 5000, rental: -10000, ages: [66] }).excluded.retirement, 0);
  // the other states do not read it
  for (const code of ["CA", "NY", "IL", "NC", "NJ", "VA"]) near(stateIncomeTax(code, { year: 2026, status: "single", agi: 50000, pensions: 20000, rental: 30000, ages: [66] }).tax, stateIncomeTax(code, { year: 2026, status: "single", agi: 50000, pensions: 20000, ages: [66] }).tax, 0);
});

test("North Carolina: the 2026 rate (3.99%) on income less its standard deduction, checked on NC-30's own annualized example", () => {
  // NC-30 (2026), annualized method: $450 a week × 52 = 23,400; less the $12,750 standard deduction and 2 allowances of $2,500
  // = 5,650; × 4.09% (the tables' rate: 3.99% plus 0.1%, page 18) = 231.09
  near((23400 - STATES.NC.standard.single - 5000) * (STATES.NC.rate + 0.001), 231.09, 0.0051);   // 231.085, to the cent 231.09
  const r = stateIncomeTax("NC", { year: 2026, status: "single", agi: 23400, ages: [30] });
  assert.equal(r.deduction, 12750); assert.equal(r.taxable, 10650); near(r.tax, 10650 * 0.0399);
  // NC-40 (2026): $25,500 joint and surviving spouse, $19,125 head of household, $12,750 single and separate
  assert.deepEqual(["married_joint", "qualifying_surviving", "head_of_household", "married_separate"].map((status) => stateIncomeTax("NC", { year: 2026, status, agi: 50000 }).deduction), [25500, 25500, 19125, 12750]);
  for (const agi of [30000, 90000, 300000]) near(stateIncomeTax("NC", { year: 2026, status: "married_joint", agi, ages: [40, 40] }).tax, 0.0399 * Math.max(0, agi - 25500), 1e-6);
});

test("North Carolina: the child deduction falls $500 a child at each income line (NC-4 Schedule 2), and pensions are taxed", () => {
  const kids = (status, agi, children) => stateIncomeTax("NC", { year: 2026, status, agi, dependents: children, children }).exemptions;
  assert.equal(kids("married_joint", 40000, 2), 6000);        // up to $40,000: $3,000 each
  assert.equal(kids("married_joint", 40001, 2), 5000);        // over $40,000 up to $60,000: $2,500
  assert.equal(kids("married_joint", 140000, 1), 500);
  assert.equal(kids("married_joint", 140001, 1), 0);
  assert.equal(kids("head_of_household", 75000, 1), 1500);    // over $60,000 up to $75,000
  assert.equal(kids("single", 20000, 1), 3000);
  assert.equal(kids("single", 70001, 1), 0);
  // a dependent of 17 or older is not a qualifying child
  assert.equal(stateIncomeTax("NC", { year: 2026, status: "married_joint", agi: 50000, dependents: 2, children: 1 }).exemptions, 2500);
  assert.equal(stateIncomeTax("NC", { year: 2026, status: "single", agi: 60000, pensions: 60000, ages: [70] }).excluded.retirement, 0);
});

test("New Jersey: the 2026 tables (NJ-1040-ES) give the tax table's own rows, and Table B is the joint one", () => {
  // the tax table (2025 NJ-1040, the same rates): taxable 40,000 to 40,050, the middle 40,025: $719 single, $630 joint
  const single = stateIncomeTax("NJ", { year: 2026, status: "single", agi: 41025, ages: [40] });
  assert.equal(single.exemptions, 1000); assert.equal(single.taxable, 40025); assert.equal(Math.round(single.tax), 719);
  assert.equal(Math.round(stateIncomeTax("NJ", { year: 2026, status: "married_joint", agi: 42025, ages: [40, 40] }).tax), 630);
  // Table A step by step at $50,000: 50,000 × .05525 − 1,492.50 = 1,270; Table B at $200,000: 200,000 × .0637 − 4,042.50 = 8,697.50
  near(stateIncomeTax("NJ", { year: 2026, status: "married_separate", agi: 51000, ages: [40] }).tax, 1270);
  near(stateIncomeTax("NJ", { year: 2026, status: "head_of_household", agi: 202500, ages: [40], dependents: 1 }).tax, 8697.5);
  // the printed subtract amounts are the sum of the brackets below (the joint 70,000 row as printed is 50 cents over)
  for (const [g, rows] of Object.entries(STATES.NJ.printed)) for (const [over, rate, sub] of rows) near(rate * over - sub, sumOfBrackets(rows, over), g === "joint" && over === 70000 ? 0.5 + 1e-6 : 1e-6, `NJ ${g} ${over}`);
  // exemptions: $1,000 each, $1,000 more each from 65, $1,500 a dependent
  assert.equal(stateIncomeTax("NJ", { year: 2026, status: "married_joint", agi: 90000, ages: [66, 60], dependents: 2 }).exemptions, 2000 + 1000 + 3000);
  // income of $20,000 or less ($10,000 single) pays nothing
  assert.equal(stateIncomeTax("NJ", { year: 2026, status: "married_joint", agi: 20000, ages: [40, 40] }).tax, 0);
  assert.equal(stateIncomeTax("NJ", { year: 2026, status: "single", agi: 10000, ages: [40] }).tax, 0);
  assert.ok(stateIncomeTax("NJ", { year: 2026, status: "single", agi: 10001, ages: [40] }).tax > 0);
});

test("New Jersey: the pension exclusion from 62 (line 28a) and the other retirement income exclusion (Worksheet D)", () => {
  const base = { year: 2026, status: "married_joint", ages: [66, 64] };
  // income up to $100,000: up to $100,000 of pensions and IRA money off
  assert.equal(stateIncomeTax("NJ", { ...base, agi: 90000, pensions: 50000, withdrawals: 30000, earned: 0 }).excluded.retirement, 90000);
  // the rest of the $100,000 (20,000) comes off the other income when pay is $3,000 or less; not with $10,000 of pay
  assert.equal(stateIncomeTax("NJ", { ...base, agi: 90000, pensions: 50000, withdrawals: 30000, investment: 10000, earned: 10000 }).excluded.retirement, 80000);
  // $100,001 to $125,000: half the pension; $125,001 to $150,000: a quarter; over $150,000: none
  assert.equal(stateIncomeTax("NJ", { ...base, agi: 120000, pensions: 80000, earned: 40000 }).excluded.retirement, 40000);
  assert.equal(stateIncomeTax("NJ", { ...base, agi: 140000, pensions: 80000, earned: 60000 }).excluded.retirement, 20000);
  assert.equal(stateIncomeTax("NJ", { ...base, agi: 160000, pensions: 80000, earned: 0 }).excluded.retirement, 0);
  // single: $75,000; before 62: none
  assert.equal(stateIncomeTax("NJ", { year: 2026, status: "single", agi: 90000, pensions: 90000, ages: [70] }).excluded.retirement, 75000);
  assert.equal(stateIncomeTax("NJ", { year: 2026, status: "single", agi: 90000, pensions: 90000, ages: [61] }).excluded.retirement, 0);
  // pay not known: no second exclusion
  assert.equal(stateIncomeTax("NJ", { year: 2026, status: "single", agi: 90000, pensions: 30000, investment: 60000, ages: [70] }).excluded.retirement, 30000);
});

test("Virginia: the 2026 Tax Rate Schedule's own example ($90,000 taxable: $4,917.50, rounded to $4,918) and the spouse example", () => {
  const r = stateIncomeTax("VA", { year: 2026, status: "single", agi: 90000 + 8750 + 930, ages: [40] });
  assert.equal(r.deduction, 8750); assert.equal(r.exemptions, 930); assert.equal(r.taxable, 90000); near(r.tax, 4917.5);
  // the Smiths (Form 760 instructions, Line 17): $47,000 joint, $2,445 before the spouse tax adjustment; $1,755 + $470 = $2,225
  // apart, the $220 the adjustment takes off (it is not counted here: the plan does not split a couple's income)
  near(fromTable(STATES.VA.schedule, 47000), 2445); near(fromTable(STATES.VA.schedule, 35000) + fromTable(STATES.VA.schedule, 12000), 2225);
  near(stateIncomeTax("VA", { year: 2026, status: "married_joint", agi: 47000 + 17500 + 1860, ages: [40, 40] }).tax, 2445);
  // $930 a person and a dependent, $800 more each from 65; under $11,950 ($23,900 joint) of Virginia AGI: no tax
  assert.equal(stateIncomeTax("VA", { year: 2026, status: "married_joint", agi: 40000, ages: [40, 40], dependents: 2 }).exemptions, 4 * 930);
  assert.equal(stateIncomeTax("VA", { year: 2026, status: "single", agi: 11949, ages: [40] }).tax, 0);
  assert.ok(stateIncomeTax("VA", { year: 2026, status: "single", agi: 11950, ages: [40] }).tax > 0);
  assert.equal(r.yearWords, "2026 rates and exemptions; the age deduction is 2025's: the 2026 one is not out yet");
});

test("Virginia: the age deduction from 65 (Age 65 and Older Deduction Worksheet) and the standard deduction after 2026", () => {
  // single, income under $50,000: $12,000 off, and the $800 exemption
  const a = stateIncomeTax("VA", { year: 2026, status: "single", agi: 40000, ages: [70] });
  assert.equal(a.excluded.retirement, 12000); assert.equal(a.exemptions, 930 + 800);
  // single, $56,000: cut by $6,000; married, both 65 or older, $85,000 of income less the taxed Social Security: 24,000 − 10,000
  assert.equal(stateIncomeTax("VA", { year: 2026, status: "single", agi: 56000, ages: [70] }).excluded.retirement, 6000);
  assert.equal(stateIncomeTax("VA", { year: 2026, status: "married_joint", agi: 100000, taxableSocialSecurity: 15000, ages: [70, 68] }).excluded.retirement, 14000);
  // born on or before January 1, 1939: the full $12,000 whatever the income
  assert.equal(stateIncomeTax("VA", { year: 2026, status: "single", agi: 200000, ages: [88] }).excluded.retirement, 12000);
  assert.equal(stateIncomeTax("VA", { year: 2026, status: "single", agi: 200000, ages: [80] }).excluded.retirement, 0);
  // after 2026: the 2026 Appropriation Act (HB 30, Special Session I, Chapter 1; Virginia Tax, 2026 Legislative Summary,
  // document 26-82): $9,200 / $18,400 for 2027, $9,300 / $18,600 for 2028 and 2029, then the amounts before 2019, $3,000 / $6,000
  const ded = (year, status) => stateIncomeTax("VA", { year, status, agi: 80000, ages: status === "married_joint" ? [50, 50] : [50] }).deduction;
  assert.deepEqual([2025, 2026, 2027, 2028, 2029, 2030, 2040].map((y) => ded(y, "single")), [8750, 8750, 9200, 9300, 9300, 3000, 3000]);
  assert.deepEqual([2025, 2026, 2027, 2028, 2029, 2030, 2040].map((y) => ded(y, "married_joint")), [17500, 17500, 18400, 18600, 18600, 6000, 6000]);
  for (const status of ["head_of_household", "married_separate", "qualifying_surviving"]) assert.equal(ded(2028, status), 9300, status);
  // 2027, single at $40,000 and 50: 40,000 − 9,200 − 930 = 29,870: 720 + 5.75% × 12,870 = 1,460.03 (it was 1,816.53 on $3,000)
  near(stateIncomeTax("VA", { year: 2027, status: "single", agi: 40000, ages: [50] }).tax, 720 + 0.0575 * (40000 - 9200 - 930 - 17000));
  assert.match(STATES.VA.rules.at(-1), /rises to \$9,200 \(\$18,400\) in 2027 and \$9,300 \(\$18,600\) in 2028 and 2029; then, as the law stands today, it falls to \$3,000 \(\$6,000\)$/);
});

test("Social Security is never taxed in any state in the table: the part in AGI changes nothing", () => {
  assert.deepEqual(Object.keys(STATES), ["CA", "NY", "IL", "GA", "NC", "NJ", "VA"]);
  for (const code of Object.keys(STATES)) {
    const a = stateIncomeTax(code, { year: 2026, status: "single", agi: 60000, ages: [70] });
    const b = stateIncomeTax(code, { year: 2026, status: "single", agi: 78000, taxableSocialSecurity: 18000, ages: [70] });
    near(a.tax, b.tax, 1e-9, code);
  }
  // California taxes pensions and IRA withdrawals like pay
  const c = stateIncomeTax("CA", { year: 2026, status: "single", agi: 60000, pensions: 60000, ages: [70] });
  assert.equal(c.excluded.retirement, 0);
});

test("the states with no income tax give 0 at any income", () => {
  assert.deepEqual(Object.keys(NO_INCOME_TAX).sort(), ["AK", "FL", "NH", "NV", "SD", "TN", "TX", "WA", "WY"]);
  for (const code of Object.keys(NO_INCOME_TAX)) {
    const r = stateIncomeTax(code, { year: 2026, status: "married_joint", agi: 750000, pensions: 100000 });
    assert.equal(r.tax, 0, code); assert.equal(r.none, true); assert.ok(hasRules(code));
  }
  assert.match(stateIncomeTax("WA", { year: 2026 }).rules[0], /large capital gains is not counted/);
});

test("a state outside the table gives null, so its callers keep the answer they had", () => {
  for (const code of ["OH", "PA", "MI", "OR", "AZ", "", null, undefined, "XX", "outside"]) {
    assert.equal(stateIncomeTax(code, { year: 2026, status: "single", agi: 60000 }), null, String(code));
    assert.equal(hasRules(code), false, String(code));
  }
  // lower case is the same state
  assert.ok(stateIncomeTax("ca", { year: 2026, status: "single", agi: 60000 }));
});

test("later years: California and Illinois raise their figures with prices; New York keeps them as written in law", () => {
  const ca1 = stateIncomeTax("CA", { year: 2030, status: "single", agi: 60000, ages: [40], scale: 1 });
  const ca2 = stateIncomeTax("CA", { year: 2030, status: "single", agi: 66000, ages: [40], scale: 1.1 });
  near(ca2.tax, ca1.tax * 1.1, 0.01);
  assert.equal(ca2.yearWords, "2026 brackets and 2025 deductions: the 2030 ones are not out yet");
  near(stateIncomeTax("IL", { year: 2030, status: "single", agi: 50000, ages: [40], scale: 1.2 }).exemptions, 2925 * 1.2);
  const ny = stateIncomeTax("NY", { year: 2030, status: "single", agi: 58000, ages: [40], scale: 1.2 });
  near(ny.tax, 2535.40); assert.equal(ny.indexed, false); assert.equal(ny.yearWords, "2026 rates: the small further cut New York's law makes to its lower rates from 2027 is not counted yet, so later years are a little high"); assert.equal(ny.older, true);
  // this year: nothing to say for New York and Illinois
  assert.equal(stateIncomeTax("IL", { year: 2026, status: "single", agi: 1 }).yearWords, null);
});
