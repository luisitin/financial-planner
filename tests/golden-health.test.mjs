// tests/golden-health.test.mjs -- the health cost pages (retirement/healthcare: the Marketplace premium tax credit;
// retirement/medicare: the income surcharge, IRMAA; insurance/health: out of pocket on a plan and whether it can have an
// HSA) against an answer key worked independently from the law (tools/golden_health, tests/golden/health/RULES.md), never
// from this repo's code. The key works each row twice in exact arithmetic; the pages work in floating point. Each cause
// below was checked with a copy of the page's code that has one switch per cause: with every switch of a part on, every
// row of that part agrees; with all but one on, the rows listed under that one still differ.
//
// What is compared, by part (each row is one test per part):
//   ptc.csv     poverty    povertyLine(household_size, coverage_year) against fpl exactly, and credit().multiple against
//                          income_multiple (written to 8 decimals)
//               law        credit({ magi, size: household_size, benchmarkYearly: the key's benchmark, rules: "law", year:
//                          coverage_year }): who qualifies, the percentage to the key's 2 decimals (the page rounds it to
//                          0.01 of a point as the IRS does), the contribution and the credit within a cent. The key's
//                          benchmark goes in, so this part is about the credit alone.
//               enhanced   the same with rules: "enhanced" against enhanced_*: the percentage to 2 decimals, the
//                          contribution and the credit within a cent
//               benchmark  ageFactor(age) of each covered person against age_factors (3 decimals), and the page's own
//                          benchmark formula from compute() (12 x benchmark_40 / ageFactor(40) x the factors of the people
//                          countedAges() keeps: every adult and only the three oldest children under 21) against benchmark
//                          within a cent: neither side rounds per person
//               marketplace  the page's whole compute(): a small plan per row (the covered adults retired at their age
//                          today, the children as dependents, the row's income as a yearly pension, the benchmark for the
//                          adults entered so that the page solves the row's benchmark_40), fed on October 31 of the row's
//                          coverage year. The first year's household size, income multiple and benchmark (to the cent),
//                          credit and cost (within a cent). Sample: ptc-edge-001 to -006 and every random row whose
//                          number ends in 0, of those compute() can hold: every child under 19 (the page counts a child in
//                          the household only until 19, the key's household_size counts every dependant) and everyone in
//                          the household covered.
//   irmaa.csv   tier       tierFor(magi, status): the tier (married filing separately: the page's 0 / 1 / 2 are the key's
//                          0 / 4 / 5), Part B, the Part D add-on, the surcharge a month and a year per person and for the
//                          household (x people), all within a cent: published amounts, no rounding on either side
//               medicare   the page's whole compute(): one or two people on Medicare (66, and 67 or 60 on a joint return)
//                          with the row's MAGI as a yearly pension, fed for 2026 (the page reads the income of two years
//                          before, or the plan's first year when there is none: the same figure). Tier, people, Part B, the
//                          add-on and the household's surcharge a year. Sample: every edge row and every random row whose
//                          number ends in 0.
//   hdhp.csv    oop        outOfPocket(plan, bills), and the page's whole compute() with the row's bills as the usual year
//                          (plans[0].usual.oop), against out_of_pocket within a cent: the same formula, no rounding
//               hsa2026    compute() on 2026-10-31 with the plan ticked as HSA: eligible against hsa_2026, the reason in
//                          its warning against hsa_2026_reason (a blank maximum with a share after the deductible: the
//                          page asks for the maximum and counts the plan as not eligible, the key's "no out-of-pocket
//                          limit"), hsaLimit against hsa_limit_2026 (the HDHP table and the contribution limits through
//                          the page itself)
//               hsa2027    the same on 2027-06-30 against the 2027 columns: the page takes its year from today
// Not compared (the pages have no such figure): phase; children_not_counted; the key's contrasts benchmark_all_children,
// credit_all_children and credit_no_floor (the page's old readings, before the fixes below); the unrounded track
// (applicable_pct_unrounded, contribution_unrounded_pct, credit_unrounded_pct: the page now rounds the percentage, as the
// regulation says); form_* (the Form 8962 method, whole percent and whole dollars); at_or_under_tier and
// at_or_under_surcharge_year_per_person (a literal "at or under" reading of the top line: the page's own lines are
// $499,999.99 / $749,999.99 / $390,999.99 inclusive, so it puts exactly $500,000 / $750,000 / $391,000 in the top tier, as
// the law does, and matches tier); surcharge_year_part_b_only (the page has no
// "no drug plan" choice: a $0 drug plan still pays the add-on); and the guideline-year and band labels themselves.
//
// Where the page and the key part ways, the case ids are listed by cause in golden/health/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause. Each reason starts with
// the verdict of a check against the sources: "app wrong" (the law or the agency's table says otherwise and the page's
// README does not claim the shortcut) or "simplification" (a modelling choice the page's README states). When a cause is
// fixed, delete its list and those rows must then pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import * as aca from "../modules/retirement/healthcare/compute.js";
import * as medicare from "../modules/retirement/medicare/compute.js";
import * as health from "../modules/insurance/health/compute.js";
import { PART_B } from "../modules/retirement/medicare/data/medicare.js";

const read = (name) => fs.readFileSync(new URL(`./golden/health/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : Math.abs(x) < 20 ? String(Number(x.toFixed(8))) : x.toFixed(2);
const CENT = 0.01;

const SETS = {
  "ptc.csv": ["poverty", "law", "enhanced", "benchmark", "marketplace"],
  "irmaa.csv": ["tier", "medicare"],
  "hdhp.csv": ["oop", "hsa2026", "hsa2027"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));

// Where the page and the key part ways (tests/golden/health/RULES.md and tools/golden_health/README.md).
// None today. The causes this key found on 2026-10-31 are fixed on the pages: coverage in 2027 uses the 2026 poverty
// guideline and Rev. Proc. 2026-26; the percentage is rounded to 0.01 of a point (26 CFR 1.36B-3(g)(1)); no credit under
// 100% of the poverty line (36B(c)(1)(A)), for either schedule; exactly 133% starts the upper band (Rev. Proc. 2025-25);
// the federal default age curve has its own factor for every age, 1.444 at 45 (CMS, Dec 16, 2016, Appendix I); only the
// three oldest children under 21 count (45 CFR 147.102(c)(1)); an HSA plan with no maximum entered is checked, not passed
// (26 U.S.C. 223(c)(2)(A)(ii)); and 2027 dates use Rev. Proc. 2026-24's HSA lines and limits.
const REASONS = {};
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<case_id> <part>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const part = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${part}`, why = `${cause}: ${REASONS[cause]}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

// --- comparing one figure ---------------------------------------------------------------------------------------
function near(out, label, got, want, tol) {
  if (!(typeof got === "number" && Math.abs(got - num(want)) <= tol + 1e-9)) out.push(`${label}: app ${show(got)}, key ${want}`);
}
function same(out, label, got, want) {
  if (got !== want) out.push(`${label}: app ${show(got)}, key ${want === "" ? "none" : want}`);
}

// --- ptc.csv ------------------------------------------------------------------------------------------------------
const agesOf = (s) => (s ? s.split("|").map(Number) : []);
/** The page's credit for the row, against the key's benchmark. */
const creditOf = (row, rules) => aca.credit({ magi: num(row.magi), size: num(row.household_size), benchmarkYearly: num(row.benchmark), rules, year: num(row.coverage_year) });
/** The page's poverty line for the row's household. */
const povertyOf = (row) => aca.povertyLine(num(row.household_size), num(row.coverage_year));
/** The page's benchmark a year, as compute() works it: 12 x (the 40-year-old's benchmark / ageFactor(40)) x the factors of the people counted. */
const pageBenchmark = (b40, adults, children) => 12 * (b40 / aca.ageFactor(40)) * aca.countedAges([...adults, ...children]).reduce((s, a) => s + aca.ageFactor(a), 0);

function creditMismatches(out, row, c, { pct, contribution, credit, tolPct, tolMoney, prefix = "" }) {
  const qualifies = row[pct] !== "";
  same(out, `${prefix}qualifies`, c.share !== null, qualifies);
  if (qualifies && c.share !== null) {
    near(out, `${prefix}applicable_pct`, c.share * 100, row[pct], tolPct);
    near(out, `${prefix}contribution`, c.contribution, row[contribution], tolMoney);
  }
  near(out, `${prefix}credit`, c.credit, row[credit], tolMoney);
}

/** The row as a plan for the healthcare page: the covered adults retired at their age today, the children as dependents, the income as a yearly pension. */
function marketplacePlanOf(row, year) {
  const p = emptyPlan(), adults = agesOf(row.adults), kids = agesOf(row.children), b40 = num(row.benchmark_40);
  p.household.people = [
    ...adults.map((a, i) => ({ id: `a${i + 1}`, name: `Adult ${i + 1}`, role: i ? "partner" : "self", birthDate: `${year - a}-06-15`, retirementAge: a })),
    ...kids.map((a, i) => ({ id: `c${i + 1}`, name: `Child ${i + 1}`, role: "dependent", birthDate: `${year - a}-06-15` })),
  ];
  p.household.filingStatus = adults.length > 1 ? "married_joint" : "single";
  p.accounts = [{ id: "cash", name: "Savings", type: "savings", balance: 1e7 }];
  if (num(row.magi) > 0) p.income = [{ id: "pension", name: "Pension", type: "pension", personId: "a1", amount: num(row.magi), period: "annual", growth: 0, taxable: true }];
  // the page solves the 40-year-old's benchmark from the adults' benchmark today: enter the one that gives benchmark_40
  p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 1, aca: { rules: "law", benchmarkMonthly: b40 * adults.reduce((s, a) => s + aca.ageFactor(a) / aca.ageFactor(40), 0) } };
  return p;
}
const holdsInCompute = (row) => agesOf(row.adults).length > 0 && agesOf(row.children).every((a) => a < 19) && agesOf(row.adults).length + agesOf(row.children).length === num(row.household_size);
const sampled = (row, prefix, edges) => edges.includes(row.case_id) || (new RegExp(`^${prefix}-\\d+$`).test(row.case_id) && Number(row.case_id.split("-")[1]) % 10 === 0);
const PTC_EDGES = ["ptc-edge-001", "ptc-edge-002", "ptc-edge-003", "ptc-edge-004", "ptc-edge-005", "ptc-edge-006"];
const inMarketplaceSample = (row) => sampled(row, "ptc", PTC_EDGES) && holdsInCompute(row);

function ptcMismatches(row, part) {
  const out = [];
  if (part === "poverty") {
    same(out, "fpl", povertyOf(row), num(row.fpl));
    near(out, "income_multiple", creditOf(row, "law").multiple, row.income_multiple, 5e-9);
  }
  if (part === "law") creditMismatches(out, row, creditOf(row, "law"), { pct: "applicable_pct", contribution: "contribution", credit: "credit", tolPct: 1e-6, tolMoney: CENT });
  if (part === "enhanced") creditMismatches(out, row, creditOf(row, "enhanced"), { pct: "enhanced_applicable_pct", contribution: "enhanced_contribution", credit: "enhanced_credit", tolPct: 1e-6, tolMoney: CENT, prefix: "enhanced " });
  if (part === "benchmark") {
    const adults = agesOf(row.adults), children = agesOf(row.children), key = row.age_factors.split("|");
    const off = [...adults, ...children].map((a, i) => [a, aca.ageFactor(a), key[i]]).filter(([, f, k]) => !(Math.abs(f - num(k)) <= 0.0005 + 1e-12));
    if (off.length) out.push(`age_factors: ${off.map(([a, f, k]) => `age ${a} app ${f.toFixed(4)}, key ${k}`).join("; ")}`);
    near(out, "benchmark", pageBenchmark(num(row.benchmark_40), adults, children), row.benchmark, CENT);
  }
  if (part === "marketplace") {
    const year = num(row.coverage_year), d = aca.compute(marketplacePlanOf(row, year), { today: `${year}-10-31` }), y = d.years?.[0];
    const covered = agesOf(row.adults).length + agesOf(row.children).length;
    if (!y || y.year !== year || y.covered.length !== covered) { out.push(`marketplace: app's first year ${y ? `${y.year}, ${y.covered.length} covered` : "none"}, key ${year}, ${covered} covered`); return out; }
    near(out, "plan income", y.magi, row.magi, CENT);
    same(out, "household_size", y.size, num(row.household_size));
    near(out, "income_multiple", y.multiple, row.income_multiple, 5e-9);
    near(out, "benchmark", y.benchmark, row.benchmark, CENT);
    near(out, "credit", y.credit, row.credit, CENT);
    near(out, "cost", y.cost, (num(row.benchmark) - num(row.credit)).toFixed(2), CENT);
  }
  return out;
}

// --- irmaa.csv ----------------------------------------------------------------------------------------------------
const STATUS = { single: "single", joint: "married_joint", separate: "married_separate" };
/** The page's tier index as the key numbers it: married filing separately has the page's tiers 0, 1, 2 for the key's 0, 4, 5. */
const keyTier = (row, index) => (row.filing_status === "separate" ? [0, 4, 5][index] ?? index : index);
function medicarePlanOf(row, year) {
  const p = emptyPlan(), people = num(row.people);
  const ages = row.filing_status === "joint" ? [66, people === 2 ? 67 : 60] : [66];
  p.household.people = ages.map((a, i) => ({ id: `a${i + 1}`, name: `Adult ${i + 1}`, role: i ? "partner" : "self", birthDate: `${year - a}-06-15`, retirementAge: 60 }));
  p.household.filingStatus = STATUS[row.filing_status];
  p.accounts = [{ id: "cash", name: "Savings", type: "savings", balance: 1e7 }];
  if (num(row.magi) > 0) p.income = [{ id: "pension", name: "Pension", type: "pension", personId: "a1", amount: num(row.magi), period: "annual", growth: 0, taxable: true }];
  p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 1 };
  return p;
}
const inMedicareSample = (row) => /^ir-edge-/.test(row.case_id) || sampled(row, "ir", []);
function irmaaMismatches(row, part) {
  const out = [];
  if (part === "tier") {
    const t = medicare.tierFor(num(row.magi), STATUS[row.filing_status]);
    same(out, "tier", keyTier(row, t.index), num(row.tier));
    near(out, "part_b_premium", t.partB, row.part_b_premium, CENT);
    near(out, "part_b_irmaa", t.partB - PART_B, row.part_b_irmaa, CENT);
    near(out, "part_d_irmaa", t.partDAdd, row.part_d_irmaa, CENT);
    const month = (t.partB - PART_B) + t.partDAdd;
    near(out, "surcharge_month_per_person", month, row.surcharge_month_per_person, CENT);
    near(out, "surcharge_year_per_person", month * 12, row.surcharge_year_per_person, CENT);
    near(out, "surcharge_year_household", month * 12 * num(row.people), row.surcharge_year_household, CENT);
  }
  if (part === "medicare") {
    const d = medicare.compute(medicarePlanOf(row, 2026), { today: "2026-10-31" }), y = d.years?.[0];
    if (!y || y.year !== 2026) { out.push(`medicare: app's first year ${y ? y.year : "none"}, key 2026`); return out; }
    near(out, "plan income", y.magiReal, row.magi, CENT);
    same(out, "people", y.enrolled, num(row.people));
    same(out, "tier", keyTier(row, y.tier), num(row.tier));
    near(out, "part_b_premium", y.partBEach, row.part_b_premium, CENT);
    near(out, "part_d_irmaa", y.partDAddEach, row.part_d_irmaa, CENT);
    near(out, "surcharge_year_household", y.surchargeYearly, row.surcharge_year_household, CENT);
  }
  return out;
}

// --- hdhp.csv -----------------------------------------------------------------------------------------------------
const planOfRow = (row) => ({ id: "plan", name: "Plan", premium: 0, deductible: num(row.deductible), coinsurance: num(row.coinsurance), oopMax: row.oop_max === "" ? null : num(row.oop_max), hsa: true, employerHsa: 0 });
function healthPlanOf(row) {
  const p = emptyPlan();
  p.insurance = { ...(p.insurance ?? {}), health: { tier: row.coverage === "family" ? "family" : "self", expected: num(row.bills), plans: [planOfRow(row)] } };
  return p;
}
/** The reason in the page's warning, in the key's words. */
const reasonOf = (warnings) => {
  const w = warnings.join(" ");
  return /deductible under/.test(w) ? "deductible under the minimum" : /out of pocket over/.test(w) ? "out-of-pocket maximum over the limit" : /enter its out-of-pocket maximum/.test(w) ? "no out-of-pocket limit" : w ? `(${w})` : "";
};
const TODAY = { hsa2026: "2026-10-31", hsa2027: "2027-06-30" };
function hdhpMismatches(row, part) {
  const out = [];
  if (part === "oop") {
    near(out, "out_of_pocket", health.outOfPocket(planOfRow(row), num(row.bills)), row.out_of_pocket, CENT);
    near(out, "compute usual oop", health.compute(healthPlanOf(row), { today: TODAY.hsa2026 }).plans[0].usual.oop, row.out_of_pocket, CENT);
  }
  if (part === "hsa2026" || part === "hsa2027") {
    const y = part.slice(3), d = health.compute(healthPlanOf(row), { today: TODAY[part] }), p = d.plans[0];
    same(out, `hsa_${y}`, p.eligible ? "yes" : "no", row[`hsa_${y}`]);
    if (!p.eligible && row[`hsa_${y}`] === "no") same(out, `hsa_${y}_reason`, reasonOf(d.warnings), row[`hsa_${y}_reason`]);
    near(out, `hsa_limit_${y}`, d.hsaLimit, row[`hsa_limit_${y}`], CENT);
  }
  return out;
}

const CHECK = { "ptc.csv": ptcMismatches, "irmaa.csv": irmaaMismatches, "hdhp.csv": hdhpMismatches };
const SIZE = { "ptc.csv": 2000, "irmaa.csv": 1500, "hdhp.csv": 1000 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));
const SAMPLE = { marketplace: inMarketplaceSample, medicare: inMedicareSample };
const runs = (row, part) => !SAMPLE[part] || SAMPLE[part](row);

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => r.case_id)).size, SIZE[f]);
  });
}
test("the whole-page samples are large enough to mean something", () => {
  const n = (f, part) => ROWS[f].filter((r) => runs(r, part)).length;
  assert.ok(n("ptc.csv", "marketplace") >= 50, `marketplace sample ${n("ptc.csv", "marketplace")}`);
  assert.ok(n("irmaa.csv", "medicare") >= 150, `medicare sample ${n("irmaa.csv", "medicare")}`);
});
test("every to-do cause has a reason and names rows of the key that its part reads", () => {
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(REASONS[cause], `no reason for ${cause}`);
    const part = cause.split("-")[0], f = PART_OF[part];
    assert.ok(f, `${cause} does not start with a part (${Object.keys(PART_OF).join(", ")})`);
    const ids = new Set(ROWS[f].filter((r) => runs(r, part)).map((r) => r.case_id));
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows ${part} does not read`);
    assert.equal(new Set(list).size, list.length, `${cause} names a row twice`);
  }
});

for (const [f, rows] of Object.entries(ROWS)) {
  for (const row of rows) {
    for (const part of SETS[f]) {
      if (!runs(row, part)) continue;
      const reason = TODO[`${row.case_id} ${part}`];
      test(`health ${row.case_id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}
