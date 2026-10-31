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
// its employerMatch); taxes.hsa = { coverage ("self" / "family"; left out for "none"), contribution: the household's HSA
// payroll money, employer: the household's employer HSA money, fsa, fsaSpent }; taxes.thisYear.otherOrdinary = the
// interest. Both pages run on the row's `today`.
//
// What is compared, by part (each row is one test per part; the key leaves every 2025-2026-only column blank on its 100
// rows of 2027, so k401, ira, roth, taxsaved, payroll, flat and fsa skip them):
//   people    the limits page lists the row's adults (A, and B on a married row), each with the age the key gives (year
//             minus birth year)
//   k401      per adult, the limits page's 401(k) row: limit (the page's includes the catch-up) against k401_limit +
//             k401_catch_up, catchUp, used, room and over against k401_catch_up, _used, _room, _over, within a cent
//   ira       the same for the IRA row against ira_limit + ira_catch_up, ira_catch_up, _used, _room, _over
//   hsa       per adult, the limits page's HSA row: limit, used, room and over against hsa_limit, _used, _room, _over, and
//             catchUp against $1,000 for an adult the key marks eligible and 55 or over (the key has no catch-up column;
//             223(b)(3)(B), not indexed), within a cent
//   roth      the limits page's Roth check: its one income figure (magi) against each adult's MAGI within a cent, and its
//             status (ok / partial / over) against each adult's roth_status
//   year      the limits page: the FSA limit against fsa_limit, the gift exclusion and the five-year 529 amount against
//             gift_exclusion and qtp_five_year_max, exactly; the IRA and HSA deadline against ira_hsa_deadline
//   hsapage   the HSA page: hsa.limit, total, room and over against hsa_limit_household, hsa_total, hsa_room_household,
//             hsa_over_household within a cent; hsa.catchUp against $1,000 for each adult eligible and 55 or over
//   taxsaved  the HSA page's hsa.taxSaved, the federal return without the HSA payroll money less the return with it, against
//             income_tax_saved + addl_medicare_saved (the 0.9% additional Medicare tax is on that return), within 2 cents:
//             the page rounds each of its two returns to the cent before subtracting, the key each of its two figures
//   payroll   the HSA page's hsa.ficaSaved against fica_saved (the law: Social Security below the wage base, Medicare on
//             all, only money within the limit) within a cent
//   flat      the same hsa.ficaSaved against the key's contrast fica_saved_flat (7.65% of the household's HSA payroll
//             money, the page's own model) within a cent: the payroll causes below are that model and nothing else
//   fsa       the HSA page's fsa.limit and carryover exactly, fsa.over and unspent within a cent, and its FSA-with-HSA note
//             against fsa_with_hsa
// Not compared (the pages have no such figure): roth_reduced_limit, roth_allowed, roth_over and roth_allowed_worksheet (the
// limits page shows only the status and the range, no amount allowed); k401_in_income; ira_compensation and ira_comp_ok
// (recorded only); wages, agi, trad_ira_page_deduction and the household magi / agi (the Roth figure is compared through
// each adult's MAGI); hsa_eligible (it shows as a limit of 0), hsa_excess and hsa_excess_to_remove; income_tax_with and
// income_tax_without (the page returns only their difference); fica_saved_ss and fica_saved_medicare (one figure);
// fsa_forfeit (the page says only that unspent money above the carryover is lost); the key's contrasts
// trad_ira_deductible, agi_real_deduction, annual_additions, limit_415c, over_415c, exceeds_415c and active_participant;
// the pages' 401(k) and 529 deadlines, totals, notes other than the FSA one, growth figures and fsa.taxSaved / daysLeft
// (the key has none); and the note column.
//
// Where the pages and the key part ways, the case ids are listed by cause in golden/limits/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause. Each reason starts with
// the verdict of a check against the sources: "app wrong" (the law says otherwise and the page's README does not claim the
// shortcut) or "simplification" (a modelling choice the page's README or code states, the law says otherwise). When a
// cause is fixed, delete its list and those rows must then pass. One row, limits-2025-mfj-1545, passes taxsaved today
// because two of its causes (taxsaved-no-additional-medicare and taxsaved-hsa-excess-deducted) cancel; it is listed
// under both, since it fails as soon as either is fixed alone.
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

const PARTS = ["people", "k401", "ira", "hsa", "roth", "year", "hsapage", "taxsaved", "payroll", "flat", "fsa"];
const ONLY_2025_2026 = new Set(["k401", "ira", "roth", "taxsaved", "payroll", "flat", "fsa"]);
const runs = (row, part) => !(ONLY_2025_2026.has(part) && row.year === "2027");

// Where the pages and the key part ways (tests/golden/limits/RULES.md section 12 and tools/golden_limits/README.md).
// The gaps are those of each cause alone (the switched copy with every other cause fixed).
const REASONS = {
  "k401-roth-401k-counted-as-ira": "app wrong: the limits page sorts money by account type and puts every Roth account under the IRA (KIND_OF_TYPE roth: \"ira\"), so Roth 401(k) money is left off the 401(k) row: used $100 to $38,228 too low, room too high, 241 excesses missed (1,244 adults). Pre-tax and Roth 401(k) money share one 402(g) limit (402A(c)(2)), and the Contributions page's own limitKind() already tells a Roth 401(k) (named 401(k) or with a match) from a Roth IRA",
  "k401-catch-up-not-capped-by-pay": "app wrong: the 401(k) catch-up is the lesser of the dollar amount and pay less the other deferrals (414(v)(2)(A)(ii)); the page gives the whole $7,500 / $8,000 / $11,250 to someone with little or no pay, so its limit and room are $75 to $11,250 too high (115 adults, 23 of them with no pay)",
  "ira-roth-401k-counted-as-ira": "app wrong: the same mapping puts Roth 401(k) money on the IRA row, so IRA used is $100 to $38,228 too high, room up to $8,600 too low, and 1,017 adults are shown over the IRA limit (845 of them are not over at all, 172 by less); 408A(c)(2) limits Roth IRA money only",
  "hsa-no-cover-gets-a-limit": "app wrong: only someone covered by a high-deductible plan can put money in an HSA (223(b)(1), (c)(1)), but the pages have no 'no high-deductible cover' choice (taxes.hsa.coverage is self or family; left out, it is read as self-only), so every adult of a household without cover is shown the self-only limit with catch-up, $4,300 to $5,400, as room (1,966 adults), and the 57 who have HSA money anyway are not shown over",
  "hsa-spouse-outside-self-only-cover": "app wrong: with self-only cover only the covered adult (A in the key) can have an HSA, but the limits page gives every adult the self-only limit and catch-up, so the spouse is shown $4,300 to $5,400 of room (367 adults)",
  "hsa-household-money-on-each-person": "app wrong: when the HSA page has a contribution, the limits page shows the household's whole HSA money (taxes.hsa contribution + employer) as each adult's used, so each spouse shows both people's money: used $33 to $13,322 too high (1,253 adults) and 1,007 adults shown over (719 of them are not over at all, 288 by less); each person's limit is reduced by their own and their own employer's money (223(b)(4))",
  "hsa-employer-money-missed": "app wrong: with no HSA payroll money in the household, the limits page counts only the employee's own HSA money (a Contributions row's amount, not its employerMatch; taxes.hsa.employer only with a contribution), so employer deposits alone show as $0 used and full room; employer money counts against the limit (223(b)(4)(B); Pub. 969), as the Contributions page itself counts it (18 adults, $1,500 to $10,000)",
  "hsa-family-limit-not-shared": "simplification the README states ('family HSA coverage uses the family limit plus the person's own catch-up'), but married people with family cover share one family limit (223(b)(5)): each spouse may have the family amount less the other spouse's money beyond their own catch-up, plus their own catch-up; the page gives each the whole family limit, so a spouse's limit is $25 to $9,000 too high and 268 excesses are missed (913 adults)",
  "hsa-2027-limits-missing": "app wrong: data/limits.js has no 2027, so a 2027 date uses 2026's $4,400 / $8,750 instead of Rev. Proc. 2026-24's $4,500 / $9,000 (s.3.01(1)): limits $100 or $250 low, 67 adults shown over (40 of them are not over at all, 27 by less) (the file says these limits are known and kept in insurance/health until the whole 2027 year is added)",
  "hsapage-no-cover-gets-a-limit": "app wrong: as on the limits page, a household without high-deductible cover is shown the self-only limit with catch-ups, $4,300 to $5,400, as room, and HSA money it has anyway (56 rows) as within the limit; without cover the limit is 0 (223(b)(1), (c)(1))",
  "hsapage-catch-up-of-uncovered-spouse": "app wrong: under self-only cover the HSA page adds the $1,000 catch-up when any adult is 55 or over, the spouse included; a catch-up goes only into the 55+ person's own HSA (223(b)(3); Pub. 969 'Each spouse must make the additional contribution to their own HSA') and the spouse is not covered, so the limit is $1,000 too high (69 rows)",
  "hsapage-2027-limits-missing": "app wrong: the HSA page also uses 2026's $4,400 / $8,750 for 2027 instead of Rev. Proc. 2026-24's $4,500 / $9,000 (s.3.01(1)): limit $100 or $250 low, 52 households shown over (31 of them are not over at all, 21 by less)",
  "year-deadline-not-moved": "app wrong: IRA and HSA money for a year can go in until the filing date (219(f)(3), 223(d)(4)(B)), April 15 moved to the next day that is not a weekend or a D.C. holiday (7503; D.C. Code 28-2701: Emancipation Day April 16, a Sunday in 2028 and so kept on Monday the 17th); the page always says April 15, which for 2027 money is Saturday April 15, 2028, not Tuesday April 18 (2025 and 2026 money: April 15 is a weekday)",
  "roth-magi-less-traditional-ira": "simplification the code states ('AGI is close enough'; README 'Roth status from AGI'), but the Roth income limit is on MAGI, AGI with the IRA deduction added back (219(g)(3)(A), 408A(c)(3)(B)): the page's figure is low by the traditional IRA money, $3 to $17,200 (1,996 adults), and 101 adults get the wrong status",
  "roth-magi-keeps-fsa": "app wrong: an FSA salary reduction is not wages (125; Pub. 969), but the Federal estimate the page reads leaves it in pay, so the Roth figure is $2 to $3,400 high (410 adults, 4 statuses); the HSA page's own FSA tax saving does take it out of wages",
  "roth-magi-without-excess-deferral": "app wrong: pre-tax 401(k) money over the limit that Roth 401(k) money does not cover is income this year (402(g)(1)(A); 26 CFR 1.402(g)-1(a)); the Federal estimate takes all pre-tax money off wages, so the Roth figure is $1 to $4,897 low (395 adults)",
  "roth-magi-without-hsa-excess": "app wrong: HSA money over the limit is income (106(d)(1); Pub. 969 'Excess contributions made by your employer are included in your gross income'), all of it for someone without cover; the Federal estimate deducts every dollar of HSA payroll money, so the Roth figure is $1 to $4,951 low (643 adults, 6 statuses)",
  "roth-separate-uses-household-income": "app wrong: filing separately, each spouse's Roth limit turns on their own MAGI (own pay; the key gives each half the interest), but the page uses the household's one Federal estimate, both spouses' pay together, for both: off by $1 to $758,030 (980 adults), 330 statuses wrong",
  "roth-separate-apart-range": "app wrong: spouses filing separately who lived apart all year are not treated as married for the Roth limit (408A(c)(3)(C), 219(g)(4); Pub. 590-A Table 2-1) and use the single range ($150,000 to $165,000 in 2025, $153,000 to $168,000 in 2026); the page uses the separate range, $0 to $10,000, so it says over or partial where the law says ok or partial (319 adults); taxes.livedApart is already in the plan",
  "roth-separate-zero-is-partial": "app wrong: filing separately and living together, a MAGI of exactly 0 allows the full Roth IRA amount (Pub. 590-A Table 2-1: \"zero (-0-)\" \"you can contribute up to $7,000\"; only \"more than zero (-0-) but less than $10,000\" is reduced; 408A(c)(3)(A): nothing over the $0 start), but the page's status test is magi < start for ok, so at 0 it says partial (8 adults). At the start of the joint and single ranges the page's partial is what Table 2-1 says (\"at least $236,000\"), and the key now says the same",
  "taxsaved-no-additional-medicare": "app wrong: HSA money taken through payroll is out of Medicare wages too (3121(a)(5)(G); Pub. 15-B), so above $200,000 of wages ($250,000 joint, $125,000 separate) it also saves 0.9% additional Medicare tax, which is on the return the page works; the page keeps Medicare wages at the full pay with and without the money, so its tax saved misses $0.32 to $92.70",
  "taxsaved-hsa-excess-deducted": "app wrong: only HSA money up to the limit is kept out of income (106(d)(1); Pub. 969), all of it is income for someone without cover; the page takes the whole contribution off income, so the tax saved is off by $0.12 to $1,732.54",
  "taxsaved-separate-as-one-return": "app wrong: filing separately is two returns, each spouse's own income on the separate schedule; the page works one return on both spouses' income at the separate brackets, which nobody files, so the tax saved is off by $2.44 to $2,406.68",
  "taxsaved-excess-deferral-not-income": "app wrong: the excess pre-tax 401(k) deferral is income (402(g)(1)(A)); left out, the HSA money's saving is worked at a lower bracket, off by $3.30 to $271.80",
  "taxsaved-fsa-in-wages": "app wrong: the FSA salary reduction is not wages (125; Pub. 969); left in, the HSA money's saving is worked at a higher bracket, off by $87.34 to $219.92",
  "taxsaved-ira-over-limit-deducted": "app wrong: the Federal estimate deducts every dollar of traditional IRA money, also above the IRA limit (219(b)(1)), which moves the HSA money's saving across a bracket line: off by $8.10 to $50.00",
  "payroll-flat-rate-above-wage-base": "simplification the README states ('ficaSaved at 7.65%'), but Social Security tax is only on pay up to the wage base ($176,100 in 2025, $184,500 in 2026; 3121(a)(1)), so above it the HSA payroll money saves only the 1.45% Medicare tax: the page's saving is $1.55 to $604.50 too high",
  "payroll-hsa-excess-saved": "app wrong: HSA payroll money is free of payroll tax only up to the limit (Pub. 15-B 'Up to specified dollar limits'; 3121(a)(5)(G)); the page counts 7.65% on the money over it too, $0.04 to $378.75 too much",
  "payroll-fsa-in-wages": "app wrong: the FSA salary reduction is not payroll-tax wages (3121(a)(5)(G)); on this row it takes pay under the wage base, so the HSA money saves more Social Security tax than with it left in pay ($109.40)",
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
  p.taxes.hsa = { contribution: sum("hsa_payroll"), employer: sum("hsa_employer"), fsa: num(row.fsa_election), fsaSpent: num(row.fsa_spent) };
  if (row.coverage !== "none") p.taxes.hsa.coverage = row.coverage;
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
    for (const x of xs) {
      near(out, `${x}_magi`, l.roth.magi, row[`${x}_magi`], CENT);
      same(out, `${x}_roth_status`, l.roth.status, row[`${x}_roth_status`]);
    }
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
  if (part === "flat") near(out, "fica_saved_flat", h.hsa.ficaSaved, row.fica_saved_flat, CENT);
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
