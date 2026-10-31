// tests/golden-debt.test.mjs -- the debt pages (debt/payoff, debt/credit-cards, debt/mortgage, and the Debts page's own
// months per debt) against an answer key worked independently from Regulation Z, the Homeowners Protection Act and the
// CFPB's pages (tools/golden_debt, tests/golden/debt/RULES.md), never from this repo's code (a verification against the
// pages later changed two of the key's rules where no source decides: RULES.md section 5, items 9 and 10). Each row becomes a small
// plan, the way the pages read one: a liability account per debt with its detail in plan.debts (rate, required payment,
// extra), plan.debtPlan (extra and order; the transfer offer), a property account for the home's value, and that plan is
// fed to the page's own compute(plan, params). Payments must agree within a cent, months exactly, interest and totals
// within $1. An amount matches if it is within the tolerance of the key's exact column or of its *_cents_track column.
// "never" in the key is Infinity on the pages.
//
// What is compared, by part (each row is one test per part):
//   payoff.csv   avalanche, snowball  the page's plans: months, interest, paid, the month each debt ends
//                plus100   what the page shows (months and interest saved by 100 more a month, nothing when a plan never
//                          ends) and the plan behind it: the page computes that plan but returns only the difference, so
//                          its months, interest, paid and payoff months come from core/math/payoff.js payoffPlan() called
//                          with the page's own debts and its arguments (avalanche, extra + 100)
//                baseline  the page's "required payments only" = avalanche with extra 0, freed payments rolling on; that is
//                          the key's baseline_rollover (on 1,220 rows the no-rollover reading would differ)
//                alone     the key's baseline (no rollover: each debt alone at its required payment) against what the
//                          Debts page (modules/balance/liabilities) shows for each debt: months and interest at its payment
//                renamed   avalanche and snowball again with the debts named in reverse entry order (see ties below)
//   cards.csv    minimum   paying only the minimum: months and interest (the required payment, or 2% with a $25 floor)
//                transfer  the balance transfer: interest on the old card over the promotion (paying max(the required
//                          payment set, balance / promo months)), fee, saving, pay to clear
//   mortgage.csv base, extra, biweekly  months and interest at the payment, at payment + extra, at payment x 13/12, and the
//                          months and interest saved; recast  the new payment and the saving after the lump (only rows with
//                          a lump: without one the page shows no recast); insurance  months until 80% of the home's value
// Not compared (the pages have no such figure): min_first_payment, min_paid, bt_payment, biweekly_payment; the key's
// contrasts held_min_*, bt_interest_with_min_floor, bw26_*, recast_payment_fractional; and hpa_* (the pages have no
// original value or schedule).
//
// Ties: no source says how to order two debts with the same rate (avalanche) or the same balance (snowball). The payoff
// page sorts them by the debt's name; the key's figures keep the order they were entered in. Both are valid. The main
// parts name the debts "Debt 1".."Debt n" in entry order, so the two orders are the same there and the key's labelled tie
// rows are checked; the renamed part names them the other way round, where a tie has no single right answer, so a
// method whose order has an exact tie is not compared there (avalanche on po-edge-011, -012, -015; snowball on -013, -014).
//
// Where the page and the key part ways, the case ids are listed by cause in golden/debt/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause. When a cause is fixed,
// delete its list and those rows must then pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { payoffPlan } from "../core/math/payoff.js";
import { compute as payoffPage } from "../modules/debt/payoff/compute.js";
import { compute as cardsPage } from "../modules/debt/credit-cards/compute.js";
import { compute as mortgagePage } from "../modules/debt/mortgage/compute.js";
import { compute as debtsPage } from "../modules/balance/liabilities/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/debt/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const NEVER = "never";
const show = (x) => Number.isFinite(x) ? (Number.isInteger(x) ? String(x) : x.toFixed(2)) : x === Infinity ? "never" : String(x);

const SETS = {
  "payoff.csv": ["avalanche", "snowball", "plus100", "baseline", "alone", "renamed"],
  "cards.csv": ["minimum", "transfer"],
  "mortgage.csv": ["base", "extra", "biweekly", "recast", "insurance"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));

// Where the page and the key part ways (tests/golden/debt/RULES.md and tools/golden_debt/README.md).
// None today. The two causes this key found are fixed in core/math/payoff.js minimumOnly (2026-10-31): the 2% minimum
// is now taken from the month's opening balance, before interest (12 CFR 1026 appendix M2), and "never" means a payment
// at or below the month's interest (1026.7(b)(12)(ii)), not 1,200 months.
const REASONS = {};
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<case_id> <part>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const part = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${part}`, why = `${cause}: ${REASONS[cause]}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

// --- comparing one figure ---------------------------------------------------------------------------------------
function near(out, label, got, want, tol, alt) {
  if (want === NEVER) { if (got !== Infinity) out.push(`${label}: app ${show(got)}, key never`); return; }
  const ok = (w) => w !== undefined && w !== "" && w !== NEVER && Math.abs(got - num(w)) <= tol + 1e-9;
  if (!(ok(want) || ok(alt))) out.push(`${label}: app ${show(got)}, key ${want}${alt !== undefined && alt !== "" ? ` (cents track ${alt})` : ""}`);
}
function months(out, label, got, want) {
  if (got !== (want === NEVER ? Infinity : num(want))) out.push(`${label}: app ${show(got)}, key ${want}`);
}

// --- payoff.csv: debts "balance:apr:required|..." in entry order ---------------------------------------------------
const debtsOf = (row) => row.debts.split("|").map((s) => { const [b, a, q] = s.split(":"); return { balance: num(b), apr: num(a), required: num(q) }; });
/** The row as a plan: one loan account per debt (named in entry order, or the other way round), its rate and payment on the Debts page. */
function payoffPlanOf(row, { reverseNames = false } = {}) {
  const p = emptyPlan(), list = debtsOf(row);
  list.forEach((d, i) => {
    p.accounts.push({ id: `a${i + 1}`, name: `Debt ${reverseNames ? list.length - i : i + 1}`, type: "loan", balance: d.balance });
    p.debts.push({ id: `d${i + 1}`, accountId: `a${i + 1}`, rate: d.apr, minPayment: d.required, extra: 0 });
  });
  p.debtPlan = { extra: num(row.extra), order: "avalanche" };
  return p;
}
/** An exact tie in the order's key: equal rates for avalanche ("apr"), equal balances for snowball ("balance"). */
const tied = (row, field) => { const v = debtsOf(row).map((d) => d[field]); return new Set(v).size < v.length; };
const payoffMonthsOf = (row, ends) => debtsOf(row).map((_, i) => show(ends(`a${i + 1}`))).join("|");
/** One plan (the page's shape: months, totalInterest, totalPaid, debts[{ id, months }]) against one variant of the key. */
function planMismatches(out, row, label, variant, r) {
  const k = (s) => row[`${variant}_${s}`];
  months(out, `${label}_months`, r.months, k("months"));
  if (k("months") === NEVER || !Number.isFinite(r.months)) return;   // a plan that never ends: every field of the key says never
  const owed = debtsOf(row).reduce((s, d) => s + d.balance, 0);
  near(out, `${label}_interest`, r.totalInterest, k("interest"), 1, k("interest_cents_track"));
  near(out, `${label}_paid`, r.totalPaid, k("paid"), 1, (owed + num(k("interest_cents_track"))).toFixed(2));
  const got = payoffMonthsOf(row, (id) => r.debts.find((d) => d.id === id).months);
  if (got !== k("payoff_months")) out.push(`${label}_payoff_months: app ${got}, key ${k("payoff_months")}`);
}
function payoffMismatches(row, part) {
  const out = [];
  if (part === "renamed") {
    const d = payoffPage(payoffPlanOf(row, { reverseNames: true }), {});
    if (!tied(row, "apr")) planMismatches(out, row, "avalanche", "avalanche", d.plans.avalanche);
    if (!tied(row, "balance")) planMismatches(out, row, "snowball", "snowball", d.plans.snowball);
    return out;
  }
  const plan = payoffPlanOf(row), d = payoffPage(plan, {});
  if (part === "avalanche" || part === "snowball") planMismatches(out, row, part, part, d.plans[part]);
  if (part === "baseline") planMismatches(out, row, "baseline", "baseline_rollover", d.baseline);
  if (part === "plus100") {
    if (row.avalanche_months === NEVER || row.plus100_months === NEVER) {
      if (d.plus100 !== null) out.push(`plus100: app ${JSON.stringify(d.plus100)}, key: a plan never ends, so nothing to show`);
    } else if (!d.plus100) out.push(`plus100: app shows nothing, key ${num(row.avalanche_months) - num(row.plus100_months)} months sooner`);
    else {
      months(out, "plus100 months sooner", d.plus100.months, String(num(row.avalanche_months) - num(row.plus100_months)));
      near(out, "plus100 interest saved", d.plus100.interest, (num(row.avalanche_interest) - num(row.plus100_interest)).toFixed(2), 1,
        (num(row.avalanche_interest_cents_track) - num(row.plus100_interest_cents_track)).toFixed(2));
    }
    planMismatches(out, row, "plus100", "plus100", payoffPlan(d.debts, { extra: d.extra + 100, order: "avalanche" }));
  }
  if (part === "alone") {
    const li = debtsPage(plan, {});
    const each = debtsOf(row).map((_, i) => li.rows.find((x) => x.id === `a${i + 1}`));
    const last = Math.max(...each.map((x) => x.months));
    months(out, "alone_months", last, row.baseline_months);
    if (row.baseline_months !== NEVER && Number.isFinite(last)) {
      near(out, "alone_interest", each.reduce((s, x) => s + x.totalInterest, 0), row.baseline_interest, 1, row.baseline_interest_cents_track);
      const got = each.map((x) => show(x.months)).join("|");
      if (got !== row.baseline_payoff_months) out.push(`alone_payoff_months: app ${got}, key ${row.baseline_payoff_months}`);
    }
  }
  return out;
}

// --- cards.csv ----------------------------------------------------------------------------------------------------
function cardPlanOf(row) {
  const p = emptyPlan();
  p.accounts.push({ id: "card", name: "Card", type: "credit", balance: num(row.balance) });
  p.debts.push({ id: "c", accountId: "card", rate: num(row.apr), minPayment: row.required === "" ? 0 : num(row.required), extra: 0 });
  p.debtPlan = { transfer: { months: num(row.promo_months), feePct: num(row.fee_pct) } };
  return p;
}
function cardMismatches(row, part) {
  const c = cardsPage(cardPlanOf(row), {}).cards[0], out = [];
  if (part === "minimum") {
    months(out, "min_months", c.trap.months, row.min_months);
    if (row.min_months !== NEVER && Number.isFinite(c.trap.months)) near(out, "min_interest", c.trap.interest, row.min_interest, 1, row.min_interest_cents_track);
  }
  if (part === "transfer") {
    const t = c.transfer;
    near(out, "bt_interest", t.interestNow, row.bt_interest, 1, row.bt_interest_cents_track);
    near(out, "bt_fee", t.fee, row.bt_fee, 0.01);
    near(out, "bt_saves", t.saves, row.bt_saves, 1);
    near(out, "bt_pay_to_clear", t.payToClear, row.bt_pay_to_clear, 0.01);
  }
  return out;
}

// --- mortgage.csv -------------------------------------------------------------------------------------------------
function mortgagePlanOf(row) {
  const p = emptyPlan();
  p.accounts.push({ id: "home", name: "Home", type: "property", balance: num(row.home_value) }, { id: "mort", name: "Mortgage", type: "mortgage", balance: num(row.balance) });
  p.debts.push({ id: "m", accountId: "mort", rate: num(row.rate), minPayment: num(row.payment), extra: num(row.extra) });
  return p;
}
function mortgageMismatches(row, part) {
  // the view passes the lump typed on the page; the extra comes from the Debts page, as the view's default
  const d = mortgagePage(mortgagePlanOf(row), { lump: num(row.lump) }), out = [];
  if (part === "base") {
    months(out, "months", d.base.months, row.months);
    near(out, "interest", d.base.totalInterest, row.interest, 1, row.interest_cents_track);
  }
  if (part === "extra") {
    months(out, "extra_months", d.withExtra.months, row.extra_months);
    near(out, "extra_interest", d.withExtra.totalInterest, row.extra_interest, 1, row.extra_interest_cents_track);
    months(out, "months_saved", d.withExtra.monthsSaved, row.months_saved);
    near(out, "interest_saved", d.withExtra.interestSaved, row.interest_saved, 1, (num(row.interest_cents_track) - num(row.extra_interest_cents_track)).toFixed(2));
  }
  if (part === "biweekly") {
    months(out, "biweekly_months", d.biweekly.months, row.biweekly_months);
    near(out, "biweekly_interest", d.biweekly.totalInterest, row.biweekly_interest, 1, row.biweekly_interest_cents_track);
    months(out, "biweekly_months_saved", d.biweekly.monthsSaved, row.biweekly_months_saved);
    near(out, "biweekly_interest_saved", d.biweekly.interestSaved, row.biweekly_interest_saved, 1, (num(row.interest_cents_track) - num(row.biweekly_interest_cents_track)).toFixed(2));
  }
  if (part === "recast" && num(row.lump) > 0) {
    if (!d.recast) out.push(`recast: app shows nothing, key ${row.recast_payment}`);
    else { near(out, "recast_payment", d.recast.newPayment, row.recast_payment, 0.01); near(out, "recast_saving", d.recast.monthlySaving, row.recast_saving, 0.01); }
  }
  if (part === "insurance") {
    if (!d.pmi) out.push("mi_months: app shows nothing");
    else months(out, "mi_months", d.pmi.monthsUntilDrop, row.mi_months);
  }
  return out;
}

const CHECK = { "payoff.csv": payoffMismatches, "cards.csv": cardMismatches, "mortgage.csv": mortgageMismatches };
const SIZE = { "payoff.csv": 1500, "cards.csv": 1000, "mortgage.csv": 1000 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));

for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => r.case_id)).size, SIZE[f]);
  });
}
test("every to-do cause has a reason and names rows of the key that its part reads", () => {
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(REASONS[cause], `no reason for ${cause}`);
    const f = PART_OF[cause.split("-")[0]];
    assert.ok(f, `${cause} does not start with a part (${Object.keys(PART_OF).join(", ")})`);
    const ids = new Set(ROWS[f].map((r) => r.case_id));
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows ${f} does not have`);
    assert.equal(new Set(list).size, list.length, `${cause} names a row twice`);
  }
});

for (const [f, rows] of Object.entries(ROWS)) {
  for (const row of rows) {
    for (const part of SETS[f]) {
      const reason = TODO[`${row.case_id} ${part}`];
      test(`debt ${row.case_id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}
