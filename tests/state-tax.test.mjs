// tests/state-tax.test.mjs -- core/math/state-tax.js (gap design #40): each state's own worked example or table rows, the
// flat state, the states with no income tax, Social Security and retirement income left out where the state says so,
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

test("Social Security is never taxed in the three states: the part in AGI changes nothing", () => {
  for (const code of ["CA", "NY", "IL"]) {
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
  for (const code of ["OH", "PA", "GA", "NJ", "AZ", "", null, undefined, "XX", "outside"]) {
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
