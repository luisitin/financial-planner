// tests/golden-student-loans.test.mjs -- debt/student-loans (the standard 10-year plan, Income-Based Repayment for new
// borrowers, the Repayment Assistance Plan) against an answer key worked independently from the statute, the
// regulations and studentaid.gov (tools/golden_student_loans, tests/golden/student-loans/RULES.md), never from this
// repo's code. Each row is fed to the page's own simulate() with income and prices flat (growth 0, inflation 0), no
// discounting, no PSLF, the row's family size and dependents. The first month's payment must agree within a cent,
// the months paid exactly, the total paid and the amount forgiven within $1.
// IBR depends on the poverty line, and the page has one guideline year (modules/retirement/healthcare): IBR is
// compared only on the key's rows of that year (2025 today, found below from povertyLine itself). The standard plan
// and RAP do not use the poverty line and are compared on every row.
// Where the page and the key part ways, the case ids are listed by cause in golden/student-loans/todo.json and run
// as { todo } tests; a cause's plan is the first word of its name, and a row can have more than one cause. When a
// cause is fixed, delete its list and those rows must then pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { simulate } from "../modules/debt/student-loans/compute.js";
import { povertyLine } from "../modules/retirement/healthcare/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/student-loans/${name}`, import.meta.url), "utf8");
const rows = toObjects(parseCsv(read("loans.csv")));
const num = (v) => Number(v) || 0;
const PLANS = ["standard", "ibr", "rap"];

// The key's poverty guidelines, 48 states and DC: the 1-person figure and each person more (HHS, 90 FR 5917 and 91 FR 1797).
const GUIDELINES = { 2025: [15650, 5500], 2026: [15960, 5680] };
const IBR_YEAR = Number(Object.keys(GUIDELINES).find((y) => [1, 2, 3, 4, 5, 6, 7, 8].every((n) => povertyLine(n) === GUIDELINES[y][0] + GUIDELINES[y][1] * (n - 1)))) || null;

// Where the page and the key part ways (tests/golden/student-loans/RULES.md and tools/golden_student_loans/README.md).
const REASONS = {
  "standard-no-50-minimum": "the standard plan has no $50 minimum: below about $3,950 owed (at 9%) to $5,180 (at 3%) the 10-year payment is less than $50, but payments are at least $50 a month (34 CFR 685.208(b)(1)(ii)), so the key pays $50, finishes sooner and pays less interest",
  "ibr-cap-no-50-minimum": "IBR's cap is the 10-year standard payment without the standard plan's $50 minimum; the key's cap includes it (34 CFR 685.209(f)(2)(ii) and 685.208(b)(1)(ii)), so a small balance pays more a month and finishes sooner",
  "ibr-under-5-not-0": "an IBR payment under $5 is not set to $0 (34 CFR 685.209(g)(1)(iii)(A)); the test reads the calculated amount itself, so $4.995 is under $5 and is $0",
  "ibr-5-to-10-not-10": "an IBR payment from $5 to under $10 is not raised to $10 (34 CFR 685.209(g)(1)(iii)(B)), $9.995 included",
  "ibr-last-payment-overpaid": "in the month an IBR loan is paid off the page charges the whole monthly payment, not just what is left (principal, unpaid interest and that month's interest), so the total paid is too high by up to one payment",
};
// Not causes: no statute or regulation says how a payment is rounded, so the key pays the exact payment inside every
// schedule (as the page does) and rounds only what it writes; the monthly payment is compared within a cent.
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<case_id> <plan>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const plan = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${plan}`, why = `${cause}: ${REASONS[cause]}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

/** One row and one plan through the page's own simulate(), as the list of what disagrees with the key. */
function mismatches(row, plan) {
  const r = simulate({ balance: num(row.balance), rate: num(row.annual_rate), plan, agi: num(row.agi), growth: 0, inflation: 0, size: num(row.family_size), dependents: num(row.dependents), pslf: false, discount: 0 });
  const out = [];
  const near = (got, key, tol) => { const want = num(row[`${plan}_${key}`]); if (!(Math.abs(got - want) <= tol)) out.push(`${plan}_${key}: app ${got.toFixed(4)}, key ${row[`${plan}_${key}`]}`); };
  near(r.monthly, "monthly", 0.01 + 1e-9);
  if (r.months !== num(row[`${plan}_months`])) out.push(`${plan}_months: app ${r.months}, key ${row[`${plan}_months`]}`);
  near(r.paid, "total_paid", 1);
  near(r.forgiven, "forgiven", 1);
  return out;
}

test(`the answer key has 2,000 loans, each once (${rows.length})`, () => {
  assert.equal(rows.length, 2000);
  assert.equal(new Set(rows.map((r) => r.case_id)).size, 2000);
});
test(`the page's poverty line is the key's ${IBR_YEAR} guideline, so IBR is compared on that year's rows`, () => {
  assert.ok(IBR_YEAR, `povertyLine(1) = ${povertyLine(1)} matches neither guideline year of the key`);
  assert.ok(rows.filter((r) => num(r.guideline_year) === IBR_YEAR).length >= 900);
});
test("every to-do cause has a reason and names rows of the key", () => {
  const ids = new Set(rows.map((r) => r.case_id));
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(REASONS[cause], `no reason for ${cause}`);
    assert.ok(PLANS.includes(cause.split("-")[0]), `${cause} does not start with a plan`);
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows the key does not have`);
  }
});

for (const row of rows) {
  for (const plan of PLANS) {
    if (plan === "ibr" && num(row.guideline_year) !== IBR_YEAR) continue;
    const reason = TODO[`${row.case_id} ${plan}`];
    test(`student loans ${row.case_id} ${plan}`, reason ? { todo: reason } : {}, () => {
      assert.deepEqual(mismatches(row, plan), []);
    });
  }
}
