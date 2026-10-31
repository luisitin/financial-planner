// tests/golden-limits.test.mjs -- the contribution-limit pages (investments/limits: each adult's 401(k), IRA and HSA limit,
// catch-up, used, room and over, the Roth IRA income check, the FSA limit, the gift exclusion and five-year 529 amount, the
// deadlines; taxes/hsa-fsa: the household's HSA limit, room and over, the tax and payroll tax the HSA payroll money saves,
// the health FSA) against an answer key worked independently from the law (tools/golden_limits,
// tests/golden/limits/RULES.md), never from this repo's code. The key works each row twice in exact arithmetic and rounds
// once to the cent, half up; the pages work in floating point. Each cause below was checked with a copy of the two pages'
// compute() (and of the Federal estimate's return they read) that has one switch per cause: with every switch off the copy
// gives the pages' own figures on every row; with every switch on, every row of every part agrees; with all but one on, the
// rows listed under that one are the rows that still differ.
//
// One plan per row, from emptyPlan(): household.filingStatus, taxes.livedApart, adult A (role self) and B (role partner)
// with their birth dates; each adult's pay as a monthly salary (pay / 12); for each kind of money an account the adult owns
// and a yearly Contributions row: "401k" (pre-tax, with the employer match as its employerMatch), "roth" named "Roth
// 401(k)", "ira" (traditional), "roth" named "Roth IRA", "hsa" (the adult's own payroll money, the employer's deposits as
// its employerMatch); taxes.hsa = { coverage (the row's "none" / "self" / "family"), contribution: the household's HSA
// payroll money, employer: the household's employer HSA money, fsa, fsaSpent }; taxes.thisYear.otherOrdinary = the
// interest. Both pages run on the row's `today`.
//
// What is compared, by part (each row is one test per part; the key leaves every 2025-2026-only column blank on its 100
// rows of 2027, so k401, ira, roth, taxsaved, payroll and fsa skip them):
//   people    the limits page lists the row's adults (A, and B on a married row), each with the age the key gives (year
//             minus birth year)
//   k401      per adult, the limits page's 401(k) row: limit (the page's includes the catch-up) against k401_limit +
//             k401_catch_up, catchUp, used, room and over against k401_catch_up, _used, _room, _over, within a cent
//   ira       the same for the IRA row against ira_limit + ira_catch_up, ira_catch_up, _used, _room, _over
//   hsa       per adult, the limits page's HSA row: limit, used, room and over against hsa_limit, _used, _room, _over, and
//             catchUp against $1,000 for an adult the key marks eligible and 55 or over (the key has no catch-up column;
//             223(b)(3)(B), not indexed), within a cent
//   roth      the limits page's Roth check, per adult (roth.people, in the order of the page's adults): magi against the
//             adult's MAGI and allowed (what may go into a Roth IRA directly: 408A(c)(3)(A) reduced, rounded down to $10,
//             the $200 floor, less the traditional IRA money, 408A(c)(2)) against roth_allowed, each within a cent, and
//             status (ok / partial / over) against roth_status
//   year      the limits page: the FSA limit against fsa_limit, the gift exclusion and the five-year 529 amount against
//             gift_exclusion and qtp_five_year_max, exactly; the IRA and HSA deadline against ira_hsa_deadline
//   hsapage   the HSA page: hsa.limit, total, room and over against hsa_limit_household, hsa_total, hsa_room_household,
//             hsa_over_household within a cent; hsa.catchUp against $1,000 for each adult eligible and 55 or over
//   taxsaved  the HSA page's hsa.taxSaved, the federal return without the HSA payroll money less the return with it, against
//             income_tax_saved + addl_medicare_saved (the 0.9% additional Medicare tax is on that return), within 2 cents:
//             the page rounds each of its two returns to the cent before subtracting, the key each of its two figures
//   payroll   the HSA page's hsa.ficaSaved against fica_saved (the law: Social Security below the wage base, Medicare on
//             all, only money within the limit) within a cent
//   fsa       the HSA page's fsa.limit and carryover exactly, fsa.over and unspent within a cent, and its FSA-with-HSA note
//             against fsa_with_hsa
// Not compared (the pages have no such figure): roth_reduced_limit, roth_over and roth_allowed_worksheet (the limits page
// shows the amount allowed, roth_allowed, which is compared); k401_in_income; ira_compensation and ira_comp_ok
// (recorded only); wages, agi, trad_ira_page_deduction and the household magi / agi (the Roth figure is compared through
// each adult's MAGI); hsa_eligible (it shows as a limit of 0), hsa_excess and hsa_excess_to_remove; income_tax_with and
// income_tax_without (the page returns only their difference); fica_saved_ss and fica_saved_medicare (one figure);
// fsa_forfeit (the page says only that unspent money above the carryover is lost); the key's contrasts
// fica_saved_flat (7.65% of the household's HSA payroll money: the HSA page's old model, compared as part "flat" until
// 2026-10-31, when the page took up the law's payroll-tax saving), trad_ira_deductible, agi_real_deduction, annual_additions, limit_415c, over_415c, exceeds_415c and active_participant;
// the pages' 401(k) and 529 deadlines, totals, notes other than the FSA one, growth figures and fsa.taxSaved / daysLeft
// (the key has none); and the note column.
//
// Where the pages and the key part ways, the case ids are listed by cause in golden/limits/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause. Each reason starts with
// the verdict of a check against the sources: "app wrong" (the law says otherwise and the page's README does not claim the
// shortcut) or "simplification" (a modelling choice the page's README or code states, the law says otherwise). When a
// cause is fixed, delete its list and those rows must then pass. On 2026-10-31 the pages took up the law for every cause
// but one (README of investments/limits, taxes/hsa-fsa, taxes/federal and retirement/contributions), and those lists were
// deleted. The one left, taxsaved-separate-as-one-return, is the only gap on its 190 rows: worked as two returns from the
// Federal estimate's own per-person figures (each spouse's pay, 401(k) and IRA kept out of income, HSA money and excess,
// the FSA on A, half the interest), the tax saved agrees with the key on all 498 separate-return rows of 2025 and 2026.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { splitCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import * as limits from "../modules/investments/limits/compute.js";
import * as hsaFsa from "../modules/taxes/hsa-fsa/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/limits/${name}`, import.meta.url), "utf8");
// the notes hold commas and semicolons, so the separator is named rather than detected
const csv = (name) => { const [headers, ...rows] = splitCsv(read(name), ","); return toObjects({ headers, rows }); };
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : x.toFixed(2);
const CENT = 0.01;

const PARTS = ["people", "k401", "ira", "hsa", "roth", "year", "hsapage", "taxsaved", "payroll", "fsa"];
const ONLY_2025_2026 = new Set(["k401", "ira", "roth", "taxsaved", "payroll", "fsa"]);
const runs = (row, part) => !(ONLY_2025_2026.has(part) && row.year === "2027");

// Where the pages and the key part ways (tests/golden/limits/RULES.md section 12 and tools/golden_limits/README.md).
// The gaps are those of each cause alone (the switched copy with every other cause fixed).
const REASONS = {
  "taxsaved-separate-as-one-return": "app wrong: filing separately is two returns, each spouse's own income on the separate schedule; the page works one return on both spouses' income at the separate brackets, which nobody files, so the tax saved is off by $2.44 to $2,406.68",
};
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<case_id> <part>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const part = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${part}`, why = `${cause}: ${REASONS[cause]}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

// --- comparing one figure ---------------------------------------------------------------------------------------
function near(out, label, got, want, tol) {
  if (!(typeof got === "number" && Math.abs(got - num(want)) <= tol + 1e-9)) out.push(`${label}: app ${show(got)}, key ${want === "" ? "none" : want}`);
}
function same(out, label, got, want) {
  if (got !== want) out.push(`${label}: app ${show(got)}, key ${want === "" ? "none" : want}`);
}

// --- the row as a plan --------------------------------------------------------------------------------------------
const who = (row) => (row.b_birth ? ["a", "b"] : ["a"]);
const ID = { a: "pa", b: "pb" };
function planOf(row) {
  const p = emptyPlan(), xs = who(row);
  p.household.people = xs.map((x, i) => ({ id: ID[x], name: `Adult ${x.toUpperCase()}`, role: i ? "partner" : "self", birthDate: row[`${x}_birth`] }));
  p.household.filingStatus = row.filing_status;
  p.taxes.livedApart = row.lived_apart === "1";
  p.taxes.thisYear.otherOrdinary = num(row.other_income);
  p.income = xs.filter((x) => num(row[`${x}_pay`]) > 0).map((x) => ({ id: `pay-${x}`, name: "Pay", type: "salary", personId: ID[x], amount: num(row[`${x}_pay`]) / 12, period: "monthly", growth: 0, taxable: true }));
  const accounts = [], contributions = [];
  for (const x of xs) {
    const add = (key, type, name, amount, match = 0) => {
      if (!(amount > 0 || match > 0)) return;
      accounts.push({ id: `${key}-${x}`, name, type, balance: 0, ownerId: ID[x] });
      contributions.push({ id: `c-${key}-${x}`, accountId: `${key}-${x}`, personId: ID[x], amount, period: "annual", employerMatch: match });
    };
    add("k401", "401k", "401(k)", num(row[`${x}_k401`]), num(row[`${x}_k401_match`]));
    add("roth401k", "roth", "Roth 401(k)", num(row[`${x}_roth401k`]));
    add("ira", "ira", "Traditional IRA", num(row[`${x}_trad_ira`]));
    add("rothira", "roth", "Roth IRA", num(row[`${x}_roth_ira`]));
    add("hsa", "hsa", "HSA", num(row[`${x}_hsa_payroll`]), num(row[`${x}_hsa_employer`]));
  }
  p.accounts = accounts;
  p.retirement = { ...(p.retirement ?? {}), contributions };
  const sum = (k) => xs.reduce((s, x) => s + num(row[`${x}_${k}`]), 0);
  p.taxes.hsa = { coverage: row.coverage, contribution: sum("hsa_payroll"), employer: sum("hsa_employer"), fsa: num(row.fsa_election), fsaSpent: num(row.fsa_spent) };
  if (row.coverage === "self") p.taxes.hsa.coveredId = ID.a;   // the key's self-only cover is adult A's (RULES.md); the page asks who the plan covers
  return p;
}
const cache = new Map();
const pages = (row) => {
  if (!cache.has(row.case_id)) { const plan = planOf(row); cache.set(row.case_id, { l: limits.compute(plan, { today: row.today }), h: hsaFsa.compute(plan, { today: row.today }) }); }
  return cache.get(row.case_id);
};
/** The key has no HSA catch-up column: $1,000 (223(b)(3)(B), not indexed) for each adult it marks eligible and 55 or over. */
const hsaCatchUp = (row, x) => (row[`${x}_hsa_eligible`] === "1" && num(row[`${x}_age`]) >= 55 ? 1000 : 0);

function mismatches(row, part) {
  const out = [], { l, h } = pages(row), xs = who(row);
  const rowOf = (i, kind) => l.people[i]?.rows.find((r) => r.kind === kind);
  if (part === "people") {
    same(out, "adults", l.people.length, xs.length);
    xs.forEach((x, i) => same(out, `${x}_age`, l.people[i]?.age, num(row[`${x}_age`])));
  }
  if (part === "k401" || part === "ira") {
    xs.forEach((x, i) => {
      const r = rowOf(i, part === "k401" ? "401k" : "ira");
      if (!r) { out.push(`${x}: no ${part} row on the page`); return; }
      near(out, `${x}_${part}_limit + ${x}_${part}_catch_up`, r.limit, num(row[`${x}_${part}_limit`]) + num(row[`${x}_${part}_catch_up`]), CENT);
      for (const k of ["catch_up", "used", "room", "over"]) near(out, `${x}_${part}_${k}`, r[k === "catch_up" ? "catchUp" : k], row[`${x}_${part}_${k}`], CENT);
    });
  }
  if (part === "hsa") {
    xs.forEach((x, i) => {
      const r = rowOf(i, "hsa");
      if (!r) { out.push(`${x}: no hsa row on the page`); return; }
      near(out, `${x}_hsa_limit`, r.limit, row[`${x}_hsa_limit`], CENT);
      near(out, `${x} hsa catch-up`, r.catchUp, hsaCatchUp(row, x), CENT);
      for (const k of ["used", "room", "over"]) near(out, `${x}_hsa_${k}`, r[k], row[`${x}_hsa_${k}`], CENT);
    });
  }
  if (part === "roth") {
    if (!l.roth) { out.push("roth: none on the page"); return out; }
    xs.forEach((x, i) => {
      const r = l.roth.people?.[i];
      if (!r) { out.push(`${x}: no Roth check on the page`); return; }
      near(out, `${x}_magi`, r.magi, row[`${x}_magi`], CENT);
      same(out, `${x}_roth_status`, r.status, row[`${x}_roth_status`]);
      near(out, `${x}_roth_allowed`, r.allowed, row[`${x}_roth_allowed`], CENT);
    });
  }
  if (part === "year") {
    if (row.fsa_limit !== "") near(out, "fsa_limit (limits page)", l.fsa.limit, row.fsa_limit, 0);
    if (row.gift_exclusion !== "") near(out, "gift_exclusion", l.gift.exclusion, row.gift_exclusion, 0);
    if (row.qtp_five_year_max !== "") near(out, "qtp_five_year_max", l.gift.superfund, row.qtp_five_year_max, 0);
    same(out, "ira_hsa_deadline", l.deadlines.find((d) => /IRA and HSA/.test(d.label))?.date, row.ira_hsa_deadline);
  }
  if (part === "hsapage") {
    near(out, "hsa_limit_household", h.hsa.limit, row.hsa_limit_household, CENT);
    near(out, "household hsa catch-up", h.hsa.catchUp, xs.reduce((s, x) => s + hsaCatchUp(row, x), 0), CENT);
    near(out, "hsa_total", h.hsa.total, row.hsa_total, CENT);
    near(out, "hsa_room_household", h.hsa.room, row.hsa_room_household, CENT);
    near(out, "hsa_over_household", h.hsa.over, row.hsa_over_household, CENT);
  }
  if (part === "taxsaved") near(out, "income_tax_saved + addl_medicare_saved", h.hsa.taxSaved, (num(row.income_tax_saved) + num(row.addl_medicare_saved)).toFixed(2), 2 * CENT);
  if (part === "payroll") near(out, "fica_saved", h.hsa.ficaSaved, row.fica_saved, CENT);
  if (part === "fsa") {
    near(out, "fsa_limit", h.fsa.limit, row.fsa_limit, 0);
    near(out, "fsa_carryover", h.fsa.carryover, row.fsa_carryover, 0);
    near(out, "fsa_over", h.fsa.over, row.fsa_over, CENT);
    near(out, "fsa_unspent", h.fsa.unspent, row.fsa_unspent, CENT);
    same(out, "fsa_with_hsa (the FSA and HSA note)", h.notes.some((n) => /FSA and an HSA cannot/.test(n)) ? "1" : "0", row.fsa_with_hsa);
  }
  return out;
}

const ROWS = csv("households.csv");

// ---- tests ----
test(`the answer key has 3,000 households, each once (${ROWS.length})`, () => {
  assert.equal(ROWS.length, 3000);
  assert.equal(new Set(ROWS.map((r) => r.case_id)).size, 3000);
  assert.equal(ROWS.filter((r) => r.year === "2027").length, 100);
});
test("every to-do cause has a reason and names rows of the key that its part reads", () => {
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(REASONS[cause], `no reason for ${cause}`);
    const part = cause.split("-")[0];
    assert.ok(PARTS.includes(part), `${cause} does not start with a part (${PARTS.join(", ")})`);
    const ids = new Set(ROWS.filter((r) => runs(r, part)).map((r) => r.case_id));
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows ${part} does not read`);
    assert.equal(new Set(list).size, list.length, `${cause} names a row twice`);
  }
});

for (const row of ROWS) {
  for (const part of PARTS) {
    if (!runs(row, part)) continue;
    const reason = TODO[`${row.case_id} ${part}`];
    test(`limits ${row.case_id} ${part}`, reason ? { todo: reason } : {}, () => {
      assert.deepEqual(mismatches(row, part), []);
    });
  }
}
