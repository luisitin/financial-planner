// tests/golden-estimated.test.mjs -- the estimated tax pages (taxes/estimated: the safe amount, the four quarterly
// payments with their due dates and statuses, what is behind and what is next; taxes/withholding: the withholding projected
// to December, the balance at filing, the verdict and the W-4 advice; and the due dates they share with the Money calendar,
// household/calendar dueDay) against an answer key worked independently from the law (tools/golden_estimated,
// tests/golden/estimated/RULES.md), never from this repo's code. The key works each row twice in exact arithmetic and
// rounds once to the cent, half up; the pages work in floating point and round only the tax (to the cent), so every amount
// is compared within a cent (4 rows, est-0865, -1378, -1428, -1875, sit a full cent apart on the tax: a half-cent tie the
// page's floating point lands just under). Paychecks left and the W-4 change are whole numbers on both sides and compared
// exactly; no amount needs a $1 tolerance.
//
// Each row of households.csv is one plan: emptyPlan() with the filing status and state, one or two adults (self, partner)
// born 1980-01-01 (nobody is 65), no income items, taxes.year = the row's year, taxes.thisYear.otherOrdinary = the interest,
// taxes.thisYear.withheld = withheld_so_far with withheldTyped = true (left as emptyPlan's 0 when blank), taxes.withholding.self / partner = { perPaycheck, period }
// when typed, taxes.priorYear = { tax, agi } (null when blank) and taxes.estimated.paid = the four boxes (blank = 0), fed to
// both pages' compute() on the row's today.
//
// What is compared, by part (each row is one test per part):
//   dates.csv       due        QUARTERS(year, state)[quarter].due against due_law (7503: weekends and D.C.'s legal holidays,
//                              for every filer) and against irs_printed where the IRS printed one
//                   dueday     dueDay(statutory_date) with no state against due_law, and on the fourth installment
//                              dueDay(January 31 of the next year) against jan31_option: the holiday engine itself
//   households.csv  tax        both pages' totalTax against total_tax, and the Federal estimate's with the row's own birth
//                              dates (the key's age edges, est-edge-120 to -126)
//                   harbour    harbour.required (both pages), ninety, prior against prior_share (an amount; none when
//                              blank), priorShare x 100 against prior_pct, basis
//                   withholding  withholding typed or not (withholdingFrom, hasSetup), the projected withholding on both
//                              pages against withholding_projected (0 when nothing is typed), people[].left against
//                              paychecks_left_self / _partner (a person with no per-paycheck amount has no entry)
//                   schedule   needsEstimates, toPayByEstimates, perQuarter, each quarter's due, cumulative and status
//                   standing   paid, remaining, behind, overdue.due, nextDue (due, amount), balanceAtFiling, penaltyRisk
//                              against page_penalty_flag_estimates
//                   check      the withholding page: balance against balance_at_filing, verdict, suggestion kind (add /
//                              cut / estimates / none = the key's more / less / use estimates / blank) and perPaycheck,
//                              penaltyRisk against page_penalty_flag_withholding
//   and, reported only (no pass or fail: the pages' flags are not the law's test), each page's penaltyRisk against
//   law_penalty_exposure, as counts of the four combinations, beside the same counts for the key's page columns.
// Read the page's way, as its view shows it:
//   - With no estimates needed (needs_estimates = no) the page shows "No estimated payments needed" and no schedule: there
//     the page's perQuarter, cumulative shares, behind (0), statuses ("none") and next payment (none) are compared with
//     nothing, not with the key, which works the schedule anyway (319 of those rows still have an amount to pay, 110 a
//     quarter short and something behind).
//   - overdue.due is the first short quarter's due date ("Payments from the 1st quarter (due ...) on are behind";
//     compute.js "due (the first of them)"), rebuilt from the key's q*_status and q*_due when overdue_due is filled (key
//     open point 6); the key's own overdue_due is the last past-due quarter's date, 358 rows apart by definition.
//   - On suggestion_ambiguous rows (a per-paycheck amount but no paycheck left: December 31 or January after the year) the
//     key says "use estimates" and calls the reading open (open point 7): "use estimates" or no advice both pass, a W-4
//     change does not.
// Not compared (the pages have no such figure): dates.csv statutory_date and the weekdays (behind due_law), the reasons a
// date moved, due_page (the page's convention as the key rebuilt it: the app matched it on all 80 rows on 2026-10-31; it is
// not a test, since fixing the Patriots' Day cause below would break it), jan31_irs_printed, irs_source and note;
// households.csv last_past_due_quarter, next_quarter, suggestion_person (the page advises the first person with a
// per-paycheck amount; kind and amount agree wherever no cause applies), needs_estimates_amount_only, small_tax_exemption,
// zero_prior_exemption, law_underpaid, tolerance_sensitive (the labelled tolerance rows are compared like any other),
// tax_table_tax (the page uses the formula, as the key's main column does) and note.
//
// Where the page and the key part ways, the case ids are listed by cause in golden/estimated/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause (dates.csv rows are named
// <tax_year>-<state or none>-q<quarter>). Each reason starts with the verdict of a check against the sources: "app wrong"
// (the law says otherwise and the page's README does not claim the shortcut), "simplification" (a modelling choice the
// page's README or data model states) or "convention" (no source decides). Each cause was checked with a copy of the pages'
// code that has one switch per cause: with every switch on, every row of every part agrees; with all but one on, exactly
// the rows listed under that one differ. When a cause is fixed, delete its lists and those rows must then pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute as estimated, QUARTERS } from "../modules/taxes/estimated/compute.js";
import { compute as withholding } from "../modules/taxes/withholding/compute.js";
import { compute as federal } from "../modules/taxes/federal/compute.js";
import { dueDay } from "../modules/household/calendar/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/estimated/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : x.toFixed(4);
const yes = (v) => v === "yes";
const blank = (v) => v === "";
const CENT = 0.01;

const SETS = {
  "dates.csv": ["due", "dueday"],
  "households.csv": ["tax", "harbour", "withholding", "schedule", "standing", "check"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));
const idOf = (f, row) => (f === "dates.csv" ? `${row.tax_year}-${row.state || "none"}-q${row.quarter}` : row.case_id);

// Where the page and the key part ways (tests/golden/estimated/RULES.md sections 5-8 and 10-11, tools/golden_estimated/README.md).
// A cause is "<part>-<why>"; the reason is the why's.
const WHY = {
  "patriots-day": "app wrong: QUARTERS() moves the first payment of a Massachusetts or Maine filer past Patriots' Day (2024: April 17), but Patriots' Day moves only a MA / ME resident's return, never an estimated payment, which is due where it is paid (Rev. Rul. 2015-13; Form 1040-ES (2024) printed April 15, 2024 for everyone; today's MA and ME vouchers go to Louisville, KY). The README cites Pub. 509 (2024)'s \"April 17 in Maine or Massachusetts\", which is said of the return. Same date in 2025-2027 (Patriots' Day falls after April 15); 2024 and 2030 differ. The fix: QUARTERS() asks dueDay() without the state's April holiday (D.C.'s holidays still apply to every filer)",
  "january-full-year": "app wrong: in the January after the tax year paychecksLeft() counts a whole year of paychecks still to come (today's year is not the tax year, which the function reads as a year not yet begun), so the projected withholding adds a year of pay that can no longer fall in the tax year (26 U.S.C. 31(a)(2): what is withheld during a calendar year is credited for the taxable year that begins in it); the key counts 0 (RULES.md 7: never below 0). The balance, the verdict, the W-4 advice (a W-4 change in January for the year just ended), the amount to pay by estimates, the schedule and both flags follow from it",
  "typed-zero-so-far": "app wrong (in the data model): a \"withheld so far\" of 0 counts as blank, so the whole year runs at the per-paycheck rate, though tax withheld is credited as withheld (26 U.S.C. 31(a); 6654(g)(1)) and someone with nothing withheld yet (a new job) has 0 plus the paychecks left; the key reads a typed 0 as a figure (RULES.md 7, key open point 3). The README promises the full year only when the figure is blank, but the plan cannot tell the two apart: emptyPlan() stores 0 for \"not typed\" and the Federal estimate page saves a blank as 0 and shows 0 as blank. The fix needs null for blank there and a migration that turns stored 0s into null (docs/DATA_MODEL.md, core/schema/migrate.js)",
  "boxes-not-total": "app wrong: the page marks a quarter paid only when the boxes up to it reach its cumulative share less $1, while behind and the next payment use everything paid. The README says a quarter is short when \"the payments to date\" fall behind its share, and the law credits every payment against the oldest unpaid installment first (26 U.S.C. 6654(b)(3)), so a catch-up typed in a later box makes the earlier quarters paid now, and a payment typed early counts toward a quarter not yet due. As it is, est-edge-002 shows the first two quarters \"behind\" and \"Payments from the 1st quarter (due April 15) on are behind\" though only the third quarter is unpaid, and est-edge-106 (a second-quarter payment typed in March) leads with \"$0 due by April 15\" (the key: Q2 $827 by June 15). The fix: statuses, the overdue date and the next payment from everything paid; the penalty flag keeps testing each past-due quarter's boxes on its own date (the charge runs from each missed date even after a catch-up, Instructions for Form 2210), which is what the key's page flag now does",
};
const reasonOf = (cause) => WHY[cause.slice(cause.indexOf("-") + 1)];
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<id> <part>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const part = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${part}`, why = `${cause}: ${reasonOf(cause)}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

// --- comparing one figure ---------------------------------------------------------------------------------------
function near(out, label, got, want, tol = CENT) {
  if (!(typeof got === "number" && Math.abs(got - num(want)) <= tol + 1e-9)) out.push(`${label}: app ${show(got)}, key ${want === "" ? "none" : want}`);
}
function same(out, label, got, want) {
  if (got !== want) out.push(`${label}: app ${show(got)}, key ${want === "" || want === null ? "none" : want}`);
}

// --- dates.csv ----------------------------------------------------------------------------------------------------
function datesMismatches(row, part) {
  const out = [], q = num(row.quarter);
  if (part === "due") {
    const app = QUARTERS(num(row.tax_year), row.state)[q - 1].due;
    same(out, "due_law", app, row.due_law);
    if (!blank(row.irs_printed)) same(out, "irs_printed", app, row.irs_printed);
  }
  if (part === "dueday") {
    same(out, "dueDay(statutory_date)", dueDay(row.statutory_date), row.due_law);
    if (q === 4) same(out, "dueDay(January 31)", dueDay(`${num(row.tax_year) + 1}-01-31`), row.jan31_option);
  }
  return out;
}

// --- households.csv -----------------------------------------------------------------------------------------------
/** The row as a plan for both pages; `ownBirths` puts the row's birth dates in place of 1980-01-01. */
function planOf(row, ownBirths = false) {
  const p = emptyPlan();
  p.household.people = row.adults.split("|").map((b, i) => ({ id: `a${i + 1}`, name: `Adult ${i + 1}`, role: i ? "partner" : "self", birthDate: ownBirths ? b : "1980-01-01" }));
  p.household.filingStatus = row.filing_status;
  p.household.state = row.state;
  p.taxes.year = num(row.year);
  p.taxes.thisYear.otherOrdinary = num(row.other_income);
  if (!blank(row.withheld_so_far)) { p.taxes.thisYear.withheld = num(row.withheld_so_far); p.taxes.thisYear.withheldTyped = true; }   // typed, a 0 included (the Federal estimate page sets the flag on save)
  p.taxes.withholding = {};
  if (!blank(row.self_per_paycheck)) p.taxes.withholding.self = { perPaycheck: num(row.self_per_paycheck), period: row.self_period };
  if (!blank(row.partner_per_paycheck)) p.taxes.withholding.partner = { perPaycheck: num(row.partner_per_paycheck), period: row.partner_period };
  p.taxes.priorYear = { tax: blank(row.prior_tax) ? null : num(row.prior_tax), agi: blank(row.prior_agi) ? null : num(row.prior_agi) };
  p.taxes.estimated.paid = [1, 2, 3, 4].map((i) => num(row[`paid_q${i}`]));
  return p;
}
const cache = new Map();
const pagesOf = (row) => {
  if (!cache.has(row.case_id)) { const plan = planOf(row), params = { today: row.today }; cache.set(row.case_id, { e: estimated(plan, params), w: withholding(plan, params) }); }
  return cache.get(row.case_id);
};
const KIND = { add: "more", cut: "less", estimates: "use estimates", none: "" };

function householdMismatches(row, part) {
  const out = [], { e, w } = pagesOf(row), needs = yes(row.needs_estimates);
  if (part === "tax") {
    near(out, "total_tax (estimated)", e.totalTax, row.total_tax);
    near(out, "total_tax (withholding)", w.totalTax, row.total_tax);
    near(out, "total_tax (the row's birth dates)", Math.max(0, federal(planOf(row, true), { today: row.today }).result.totalTax), row.total_tax);
  }
  if (part === "harbour") {
    const h = e.harbour;
    near(out, "required", h.required, row.required);
    near(out, "required (withholding)", w.harbour.required, row.required);
    near(out, "ninety", h.ninety, row.ninety);
    if (blank(row.prior_share)) same(out, "prior_share", h.prior, null);
    else near(out, "prior_share", h.prior, row.prior_share);
    if (!blank(row.prior_pct)) same(out, "prior_pct", Math.round(h.priorShare * 100), num(row.prior_pct));
    same(out, "basis", h.basis, row.basis);
  }
  if (part === "withholding") {
    const typed = !blank(row.withholding_projected);
    same(out, "withholding typed (estimated)", e.withholdingFrom, typed ? "typed" : "none");
    same(out, "withholding typed (withholding)", w.withholding.hasSetup, typed);
    near(out, "withholding_projected (estimated)", e.withholding, typed ? row.withholding_projected : "0");
    near(out, "withholding_projected (withholding)", w.withholding.projected, typed ? row.withholding_projected : "0");
    for (const key of ["self", "partner"]) {
      const p = w.withholding.people.find((x) => x.key === key), want = row[`paychecks_left_${key}`];
      same(out, `paychecks_left_${key}`, p ? p.left : null, blank(want) ? null : num(want));
    }
  }
  if (part === "schedule") {
    same(out, "needs_estimates", e.needsEstimates, needs);
    near(out, "to_pay_by_estimates", e.toPayByEstimates, row.to_pay_by_estimates);
    // with no estimates needed the page shows no schedule: no share and no status (the key works them anyway)
    near(out, "per_quarter", e.perQuarter, needs ? row.per_quarter : "0");
    e.quarters.forEach((q, i) => {
      const k = `q${i + 1}`;
      same(out, `${k}_due`, q.due, row[`${k}_due`]);
      near(out, `${k}_cumulative`, q.cumulative, needs ? row[`${k}_cumulative`] : "0");
      same(out, `${k}_status`, q.status, needs ? row[`${k}_status`] : "none");
    });
  }
  if (part === "standing") {
    near(out, "paid", e.paid, row.paid);
    near(out, "remaining", e.remaining, row.remaining);
    near(out, "behind", e.behind, needs ? row.behind : "0");
    // the page dates what is behind from the first short quarter; the key's overdue_due is the last past-due one's date
    const firstShort = [1, 2, 3, 4].find((i) => row[`q${i}_status`] === "short");
    same(out, "overdue.due (the first short quarter)", e.overdue?.due ?? null, needs && !blank(row.overdue_due) && firstShort ? row[`q${firstShort}_due`] : null);
    const next = needs && !blank(row.next_due) ? row.next_due : null;
    same(out, "next_due", e.nextDue?.due ?? null, next);
    if (e.nextDue && next) near(out, "next_amount", e.nextDue.amount, row.next_amount);
    near(out, "balance_at_filing (estimated)", e.balanceAtFiling, row.balance_at_filing);
    same(out, "page_penalty_flag_estimates", e.penaltyRisk, yes(row.page_penalty_flag_estimates));
  }
  if (part === "check") {
    near(out, "balance_at_filing (withholding)", w.balance, row.balance_at_filing);
    same(out, "verdict", w.verdict, row.verdict);
    const kind = KIND[w.suggestion.kind] ?? w.suggestion.kind;
    if (yes(row.suggestion_ambiguous)) { if (!["use estimates", ""].includes(kind)) out.push(`suggestion_kind (no paycheck left: use estimates or nothing): app ${kind}, key ${row.suggestion_kind}`); }
    else {
      same(out, "suggestion_kind", kind, row.suggestion_kind);
      if (["more", "less"].includes(kind) && kind === row.suggestion_kind) same(out, "suggestion_per_paycheck", w.suggestion.perPaycheck, num(row.suggestion_per_paycheck));
    }
    same(out, "page_penalty_flag_withholding", w.penaltyRisk, yes(row.page_penalty_flag_withholding));
  }
  return out;
}

const CHECK = { "dates.csv": datesMismatches, "households.csv": householdMismatches };
const SIZE = { "dates.csv": 80, "households.csv": 3000 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => idOf(f, r))).size, SIZE[f]);
  });
}
test("every household row is a tax year the pages work (2025 or 2026), seen from January 1 of it to January 31 after", () => {
  for (const r of ROWS["households.csv"]) assert.ok(["2025", "2026"].includes(r.year) && r.today >= `${r.year}-01-01` && r.today <= `${num(r.year) + 1}-01-31`, r.case_id);
});
test("every to-do cause has a reason and names rows of the key that its part reads", () => {
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(reasonOf(cause), `no reason for ${cause}`);
    const part = cause.split("-")[0], f = PART_OF[part];
    assert.ok(f, `${cause} does not start with a part (${Object.keys(PART_OF).join(", ")})`);
    const ids = new Set(ROWS[f].map((r) => idOf(f, r)));
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows ${part} does not read`);
    assert.equal(new Set(list).size, list.length, `${cause} names a row twice`);
  }
});

for (const [f, rows] of Object.entries(ROWS)) {
  for (const row of rows) {
    for (const part of SETS[f]) {
      const id = idOf(f, row), reason = TODO[`${id} ${part}`];
      test(`estimated ${id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}

// ---- reported only: the pages' penalty flags against the law's exposure ----
test("reported: each page's penalty flag against the law's exposure (law_penalty_exposure), as counts", (t) => {
  const counts = {};
  const add = (name, page, law) => { const c = counts[name] ??= { "both": 0, "page only": 0, "law only": 0, "neither": 0 }; c[page && law ? "both" : page ? "page only" : law ? "law only" : "neither"]++; };
  for (const row of ROWS["households.csv"]) {
    const { e, w } = pagesOf(row), law = yes(row.law_penalty_exposure);
    assert.equal(typeof e.penaltyRisk, "boolean"); assert.equal(typeof w.penaltyRisk, "boolean");
    add("Estimated payments page", e.penaltyRisk, law);
    add("Withholding check page", w.penaltyRisk, law);
    add("the key's estimates-page column", yes(row.page_penalty_flag_estimates), law);
    add("the key's withholding-page column", yes(row.page_penalty_flag_withholding), law);
  }
  for (const [name, c] of Object.entries(counts)) t.diagnostic(`${name}: both ${c.both}, page only ${c["page only"]}, law only ${c["law only"]}, neither ${c.neither}`);
});
