// tests/golden-employer-stock.test.mjs -- the Employer stock page (investments/employer-stock: vestSchedule,
// supplementalWithholding, compute) against an answer key worked independently from the law (tools/golden_employer_stock,
// tests/golden/employer-stock/RULES.md), never from this repo's code. The key works each row twice (exact fractions, and
// whole units of 1e-8 dollars by other routes) and rounds once when written: money to the cent and rates and ratios to six
// decimals, half away from zero. The page works in floating point, so every amount is compared within a cent and every
// rate within half a unit of the sixth decimal (5e-7); dates, share counts, years, levels and flags are compared exactly.
// The federal engine rounds each return's total tax to the cent (core/math/tax.js), so a tax the vests add is the
// difference of two rounded totals: those figures (owed, gap, the sale's tax) are compared within two cents.
//
// schedules.csv: vestSchedule({ shares, vestStart, vestMonths, cliffMonths, every }), the page's own function, one grant per
// row (a blank stays blank, null, so the page's default 48 / 12 / 3 applies); a vest is vested when dated on or before the
// row's today.
// households.csv: each row is one plan, emptyPlan() with the employee (id "emp", role self, born 1980-01-01) and, on a
// joint or separate row, a spouse ("sp", partner, born 1981-01-01): both under 65 in 2026 and 2027; household.filingStatus;
// household.state "IL" or "" (no state: the state page has no figure, so the page's state share is 0). Pay: one Income
// row per salary { type "salary", personId, amount, period "annual", taxable true }, or the key's wages_typed as
// taxes.thisYear.wages (typed W-2 wages for the return, no Income row). Accounts: "brokerage" (type brokerage), "401k"
// (type 401k) and "savings" (type savings) with the key's balances; ownerId the employee's id for the 401(k) and, on a
// single row, the brokerage; on a separate row the brokerage's owner as the key names it (employee "emp", spouse "sp",
// joint ""); "" on a joint row. Holdings: the company's shares in each account { accountId, symbol, shares, price,
// priceAsOf = today, costBasis (the brokerage's one total cost; none for the 401(k)) }. plan.equity = { symbol, price,
// priceAsOf = today, personId "emp", grants } with grant i (1-based, the key's order) { id "g<i>", kind, name "Grant <i>",
// vestStart, granted (an option's granted date; an RSU's vestStart, as the page's form stores it), shares, strike (options),
// vestMonths, cliffMonths, every (a blank stays blank, null) }. Then compute(plan, { today }).
//
// What is compared, by part (each row is one test per part):
//   schedules.csv schedule  every vest (date and shares, in order; months that add no share are not vests) against vests,
//                           their number against vest_count, the shares vested on or before today and those still to
//                           come against vested and unvested, the first vest after today against next_vest
//   households.csv position ready; heldValue, the vested options' value, owned, unvested, exposure, invested, share
//                           (none when invested is 0), level (none with the share), stress.loss against stress_loss, the
//                           held value in the brokerage (taxable) and the 401(k) (deferred), the unvested RSU and option
//                           values
//                  grants   per grant in the key's order: vested and unvested against grant_results; an option's
//                           vestedValue and unvestedValue against vested and unvested x the key's spread
//                  vests    today + 12 months (addMonths, the page's horizon) against view_end; the vests in view in order:
//                           date, shares, value, owed, withheld, gap, stateOwed against vests (state none = 0); the
//                           grant (by name) against vests_detail grant; its split, supplementalWithholding (the page's own
//                           function) on the year's running total of supplemental wages (the year's earlier vests, then
//                           the page's vests before it) and the rest of its withheld (its share of the 0.9%) against
//                           vests_detail
//                  years    the calendar years in view; per year earlier, value, owed, withheld, gap, over1m, medicare,
//                           state against years; withheld less medicare against years_detail's supplemental withheld;
//                           the year's earlier vests (today's year's entry, else the page's RSU schedules dated on or
//                           before today in today's year, at the page's price) against earlier_this_year
//                  sale     whether there is one (none when the key's sell columns are blank); sell, fromPlans, fromTaxable,
//                           gain, tax, after against sell_need, sell_from_401k, sell_from_brokerage, sell_gain, sell_tax,
//                           sell_share_after
// 2027: no 2027 federal tables were published on 2026-10-31 (RULES.md 5.2, Y1), so the key leaves 2027's owed and gap blank
// and the page's 2027 owed and gap (the 2026 tables indexed by the plan's inflation) are not compared; 2027's earlier,
// value, withheld (22% / 37% and the 0.9%: statutory), over1m, medicare and state are.
// Reported only (no pass or fail; the page has no such figure, follows the page convention where the law allows another
// way, or the figure is a contrast on unpublished tables), as counts:
//   - the 2027 contrast (contrast_2027_years, contrast_2027_vests: the 2026 tables held flat) against the page's 2027 owed
//     and gap;
//   - the law columns: the whole crossing vest withheld at 37% (vests_law, years_law, W2), Illinois' share by law
//     ($2,925 and the income limit, counted apart), the same-day crossings (T1), the sale's signed gain and its tax with
//     the $3,000 / $1,500 loss (sell_gain_law, sell_tax_law), Illinois' tax on the sale (sell_state_tax_law; the page's
//     sale tax is federal);
//   - the rows flagged flat_rate_ok = no (no employee pay: the law would need the aggregate method; the page and the key's
//     main column both withhold 22%).
// Verdicts on these (2026-10-31 review, from the sources): conventions the READMEs state: the 2027 tables (indexed by the
// plan's inflation, the fixed-in-law thresholds held), the 37% on the excess only (26 CFR 31.3402(g)-1(a)(4)(iv): required
// only on the excess, the whole "may"), same-day order, the 22% flat rate where no pay is on file, Illinois' income limit
// (taxes/state: "Credits and phase-outs are left out on purpose"), the sale's tax being federal (the page says "federal
// tax"). Two were page errors: Illinois' 2026 exemption ($2,850 is IDOR's 2025 figure; 2026 is $2,925; taxes/state, claude-a's
// lane, asked on the WORKBOARD 2026-10-31) and a sale at a loss (taken as a $0 gain; IRC 1211(b) allows the loss against
// $3,000 / $1,500 of other income). The sale was fixed on 2026-10-31 and is now compared against sell_gain_law and
// sell_tax_law. When taxes/state takes $2,925, the key's main column has to follow: the Illinois share against $2,925
// without the limit (rules.py IL_EXEMPTION_PAGE and es_key.py IL_PAGE_2; regenerate the CSVs).
// Not compared (the page has no such figure): schedules.csv zero_share_months (the vests and their number already show
// that months adding no share are not listed), note; households.csv flat_rate_ok (reported), years_detail tax before,
// tax after, income tax owed and 0.9% owed (the page shows only their difference, owed), sell_shares_401k and
// sell_shares_brokerage (the page gives the amounts to sell, not share counts), note.
//
// On 2026-10-31 the first run found every schedule, every figure of the position but one, every grant, every vest's date,
// shares, value, owed, withheld, gap and split, every year's figures and every sale in agreement (the brief's open
// conventions hold on the page: zero-share months left out, same-day vests in grant order, the salary counted before the
// vests for the 0.9%, typed joint wages halved, exactly 10% is ok, the years listed, future grant dates taken as typed).
// Two causes differ, each proved with a copy of the page's code with one switch per cause (the copy without switches
// fails on exactly the same rows; with both switches no row fails): the level "large" where there is no share (13 rows,
// position), and filing separately, the state's share worked on both returns' income instead of the employee's own
// (1 row, vests and years). Both were fixed the same day (employer-stock compute.js: no level without a stake; the state
// share on the employee's own return's income), and todo.json is empty. A third switch (no rounding of each return's total tax) shows that the two-cent tolerance on
// owed, gap and the sale's tax covers only the engine's rounding: with it every such figure is within a cent.
//
// Should the page and the key part ways, list the case ids by cause in golden/employer-stock/todo.json ("<part>-<why>")
// with a reason in WHY that starts with the verdict ("app wrong", "simplification" or "convention"); they then run as
// { todo } tests. Delete a cause's list when it is fixed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { addMonths } from "../core/math/dates.js";
import { compute, vestSchedule, supplementalWithholding } from "../modules/investments/employer-stock/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/employer-stock/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : String(Number(x.toFixed(6)));
const blank = (v) => v === "" || v === undefined || v === null;
/** A typed input: blank stays blank (null, the page's default applies), anything else is a number. */
const typedOrNull = (v) => (blank(v) ? null : Number(v));
const CENT = 0.01, TAX = 0.02, RATE = 5e-7, EPS = 1e-9;
/** A key list field: items joined by ";", fields by "|". */
const items = (v) => (blank(v) ? [] : v.split(";").map((s) => s.split("|")));
const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) ?? 0), 0);
const fieldsOf = (names) => (f) => Object.fromEntries(names.map((k, i) => [k, f[i] ?? ""]));

const SETS = {
  "schedules.csv": ["schedule"],
  "households.csv": ["position", "grants", "vests", "years", "sale"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));

// Where the page and the key part ways (tests/golden/employer-stock/RULES.md, tools/golden_employer_stock/README.md open
// points). A cause is "<part>-<why>"; the reason is the why's.
const WHY = {
  "level-blank": "app wrong: with nothing invested (invested 0, so the share is none) compute() still rates the stake \"large\", "
    + "and the page shows \"A large bet on one company\" beside a share of \"—\"; in all 13 rows the household has no company "
    + "stake at all (exposure 0: a symbol only, savings only, grants fully vested, options under water). The key leaves the "
    + "level blank with the share (README CSV columns); the page should give no level, and no level line, without a share",
  "separate-state-agi": "app wrong: filing separately the vests are on the employee's own return (the federal side already "
    + "puts them there, addIncome), but stateExtra reads the state estimate's AGI, which is both returns added up (taxes/state "
    + "takes the federal result's summed agi), against one $2,850 allowance; when the employee's own income is under the "
    + "allowance the spouse's pay uses it up, so the state share is 4.95% of the unused allowance too high ($141.07 in "
    + "2027 here). Illinois follows the federal filing status: \"if the federal income tax liability of either spouse is "
    + "determined on a separate federal income tax return, they shall file separate returns under this Act\" (35 ILCS "
    + "5/502(c)(1)(C)); the IL-1040 instructions' Line 10a chart counts married filing separately as Single, one exemption "
    + "on each return. So the share belongs on the employee's own return's AGI, with its own allowance (RULES.md 7)",
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
  if (!(typeof got === "number" && Math.abs(got - num(want)) <= tol + EPS)) out.push(`${label}: app ${show(got)}, key ${blank(want) ? "none" : want}`);
}
/** A figure the key leaves blank where it does not apply: the page must have none there. */
function opt(out, label, got, want, tol = CENT) {
  if (blank(want)) { if (got !== null && got !== undefined) out.push(`${label}: app ${show(got)}, key none`); }
  else near(out, label, got, want, tol);
}
function same(out, label, got, want) {
  if (got !== want) out.push(`${label}: app ${show(got)}, key ${blank(want) ? "none" : show(want)}`);
}
const yesNo = (b) => (b ? "yes" : "no");

// --- schedules.csv ------------------------------------------------------------------------------------------------
const pairsOf = (v) => (blank(v) ? [] : v.split(";").map((s) => { const [date, shares] = s.split(":"); return { date, shares: Number(shares) }; }));
const grantOfSchedule = (row) => ({ shares: num(row.shares), vestStart: row.vest_start, vestMonths: typedOrNull(row.vest_months), cliffMonths: typedOrNull(row.cliff_months), every: typedOrNull(row.every) });
function scheduleMismatches(row) {
  const out = [], s = vestSchedule(grantOfSchedule(row)), want = pairsOf(row.vests);
  same(out, "vest_count", s.length, num(row.vest_count));
  for (let i = 0; i < Math.max(s.length, want.length); i++) {
    const a = s[i], w = want[i];
    if (!a || !w || a.date !== w.date || a.shares !== w.shares) { out.push(`vest ${i + 1}: app ${a ? `${a.date}:${a.shares}` : "none"}, key ${w ? `${w.date}:${w.shares}` : "none"}`); break; }
  }
  const vested = sum(s.filter((e) => e.date <= row.today), (e) => e.shares);
  same(out, "vested", vested, num(row.vested));
  same(out, "unvested", sum(s, (e) => e.shares) - vested, num(row.unvested));
  const next = s.find((e) => e.date > row.today);
  same(out, "next_vest", next ? `${next.date}:${next.shares}` : "", row.next_vest);
  return out;
}

// --- households.csv -----------------------------------------------------------------------------------------------
const grantsOf = (row) => items(row.grants).map(fieldsOf(["kind", "shares", "vest_start", "vest_months", "cliff_months", "every", "strike", "granted"]));
const holdingsOf = (row) => items(row.holdings).map(fieldsOf(["kind", "shares", "cost"]));
const accountsOf = (row) => items(row.accounts).map(fieldsOf(["kind", "balance"]));
const vestsOf = (row) => items(row.vests).map(fieldsOf(["date", "shares", "value", "owed", "withheld", "gap", "state"]));
const vestsDetailOf = (row) => items(row.vests_detail).map(fieldsOf(["grant", "supplemental", "medicare"]));
const yearsOf = (row) => items(row.years).map(fieldsOf(["year", "earlier", "value", "owed", "withheld", "gap", "over_1m", "medicare_held", "state"]));
const yearsDetailOf = (row) => items(row.years_detail).map(fieldsOf(["year", "tax_before", "tax_after", "income_tax_owed", "medicare_owed", "supplemental"]));
const grantResultsOf = (row) => items(row.grant_results).map(fieldsOf(["vested", "unvested", "spread"]));
const vestsLawOf = (row) => items(row.vests_law).map(fieldsOf(["date", "withheld_whole", "gap_whole", "state_law"]));
const yearsLawOf = (row) => items(row.years_law).map(fieldsOf(["year", "withheld_whole", "gap_whole", "state_law", "same_day_crossing"]));
const contrastYearsOf = (row) => items(row.contrast_2027_years).map(fieldsOf(["year", "tax_before", "tax_after", "owed", "gap", "gap_whole"]));
const contrastVestsOf = (row) => items(row.contrast_2027_vests).map(fieldsOf(["date", "owed", "gap", "gap_whole"]));

const OWNER = { employee: "emp", spouse: "sp", joint: "" };
const ACCOUNT_TYPE = { brokerage: "brokerage", "401k": "401k", savings: "savings" };
/** The row as a plan for the Employer stock page. */
function stockPlan(row) {
  const p = emptyPlan(), two = row.filing_status !== "single", separate = row.filing_status === "married_separate";
  p.household.people = [{ id: "emp", name: "Employee", role: "self", birthDate: "1980-01-01" }];
  if (two) p.household.people.push({ id: "sp", name: "Spouse", role: "partner", birthDate: "1981-01-01" });
  p.household.filingStatus = row.filing_status;
  p.household.state = row.state === "IL" ? "IL" : "";
  const salary = (id, personId, amount) => ({ id, name: personId === "emp" ? "Employee's pay" : "Spouse's pay", type: "salary", personId, amount: Number(amount), period: "annual", taxable: true });
  if (!blank(row.salary_employee)) p.income.push(salary("pay-emp", "emp", row.salary_employee));
  if (!blank(row.salary_spouse)) p.income.push(salary("pay-sp", "sp", row.salary_spouse));
  if (!blank(row.wages_typed)) p.taxes.thisYear.wages = Number(row.wages_typed);
  const ownerOf = (kind) => kind === "401k" ? "emp" : kind === "savings" ? "" : separate ? OWNER[row.brokerage_owner] ?? "" : two ? "" : "emp";
  p.accounts = accountsOf(row).map((a) => ({ id: a.kind, name: a.kind === "401k" ? "401(k)" : a.kind === "brokerage" ? "Brokerage" : "Savings", type: ACCOUNT_TYPE[a.kind], balance: Number(a.balance), ownerId: ownerOf(a.kind) }));
  p.holdings = holdingsOf(row).map((h) => ({ id: `h-${h.kind}`, accountId: h.kind, symbol: row.symbol, name: row.symbol, shares: Number(h.shares), price: Number(row.price), priceAsOf: row.today, costBasis: typedOrNull(h.cost) }));
  p.equity = {
    symbol: row.symbol, price: Number(row.price), priceAsOf: row.today, personId: "emp",
    grants: grantsOf(row).map((g, i) => ({
      id: `g${i + 1}`, kind: g.kind, name: `Grant ${i + 1}`, vestStart: g.vest_start, granted: blank(g.granted) ? g.vest_start : g.granted,
      shares: Number(g.shares), strike: g.kind === "option" ? Number(g.strike) : null,
      vestMonths: typedOrNull(g.vest_months), cliffMonths: typedOrNull(g.cliff_months), every: typedOrNull(g.every),
    })),
  };
  return p;
}
const pageCache = new Map();
const pageOf = (row) => { if (!pageCache.has(row.case_id)) pageCache.set(row.case_id, compute(stockPlan(row), { today: row.today })); return pageCache.get(row.case_id); };
const yearOf = (date) => Number(String(date).slice(0, 4));
/** The key leaves a 2027 owed or gap blank (no published tables): not compared. */
const unverified = (want) => blank(want);

function householdMismatches(row, part) {
  const out = [], d = pageOf(row);
  if (!d.ready) return ["ready: app false, key true"];
  const options = d.grants.filter((g) => g.kind === "option"), rsus = d.grants.filter((g) => g.kind === "rsu");
  if (part === "position") {
    near(out, "held_value", d.heldValue, row.held_value);
    near(out, "vested_options_value", sum(options, (g) => g.vestedValue), row.vested_options_value);
    near(out, "owned", d.owned, row.owned);
    near(out, "unvested", d.unvested, row.unvested);
    near(out, "exposure", d.exposure, row.exposure);
    near(out, "invested", d.invested, row.invested);
    opt(out, "share", d.share, row.share, RATE);
    same(out, "level", d.level, blank(row.level) ? null : row.level);
    near(out, "stress_loss", d.stress.loss, row.stress_loss);
    near(out, "held_brokerage (taxable)", sum(d.held.filter((h) => h.bucket === "taxable"), (h) => h.value), row.held_brokerage);
    near(out, "held_401k (deferred)", sum(d.held.filter((h) => h.bucket === "deferred"), (h) => h.value), row.held_401k);
    near(out, "unvested_rsu_value", sum(rsus, (g) => g.unvestedValue), row.unvested_rsu_value);
    near(out, "unvested_options_value", sum(options, (g) => g.unvestedValue), row.unvested_options_value);
  }
  if (part === "grants") {
    const want = grantResultsOf(row);
    same(out, "grants", d.grants.length, want.length);
    want.forEach((w, i) => {
      const g = d.grants[i], L = `grant ${i + 1}`;
      if (!g) return;
      same(out, `${L} vested`, g.vested, num(w.vested));
      same(out, `${L} unvested`, g.unvested, num(w.unvested));
      if (g.kind === "option") {
        near(out, `${L} vestedValue (vested x spread)`, g.vestedValue, num(w.vested) * num(w.spread));
        near(out, `${L} unvestedValue (unvested x spread)`, g.unvestedValue, num(w.unvested) * num(w.spread));
      } else if (!blank(w.spread)) out.push(`${L}: an RSU with a spread in the key`);
    });
  }
  if (part === "vests") {
    same(out, "view_end (today + 12 months)", addMonths(row.today, 12), row.view_end);
    const want = vestsOf(row), detail = vestsDetailOf(row);
    same(out, "vests in view", d.vests.length, want.length);
    const soFar = Object.fromEntries(d.vestYears.map((y) => [y.year, y.earlier]));
    want.forEach((w, i) => {
      const v = d.vests[i], L = `vest ${i + 1} (${w.date})`;
      if (!v) return;
      same(out, `${L} date`, v.date, w.date);
      same(out, `${L} shares`, v.shares, num(w.shares));
      near(out, `${L} value`, v.value, w.value);
      if (!unverified(w.owed)) near(out, `${L} owed`, v.owed, w.owed, TAX);
      near(out, `${L} withheld`, v.withheld, w.withheld);
      if (!unverified(w.gap)) near(out, `${L} gap`, v.gap, w.gap, TAX);
      near(out, `${L} state`, v.stateOwed, blank(w.state) ? 0 : w.state);
      const k = detail[i];
      if (!k) return;
      same(out, `${L} grant`, v.grant, `Grant ${k.grant}`);
      const y = yearOf(v.date), supp = supplementalWithholding(v.value, soFar[y] ?? 0);
      soFar[y] = (soFar[y] ?? 0) + v.value;
      near(out, `${L} supplemental withheld (22% / 37%)`, supp, k.supplemental);
      near(out, `${L} 0.9% withheld`, v.withheld - supp, k.medicare);
    });
  }
  if (part === "years") {
    const want = yearsOf(row), detail = yearsDetailOf(row);
    same(out, "years", d.vestYears.map((y) => y.year).join(" "), want.map((w) => w.year).join(" "));
    want.forEach((w, i) => {
      const y = d.vestYears.find((x) => x.year === num(w.year)), L = `${w.year}`;
      if (!y) return;
      near(out, `${L} earlier`, y.earlier, w.earlier);
      near(out, `${L} value`, y.value, w.value);
      if (!unverified(w.owed)) near(out, `${L} owed`, y.owed, w.owed, TAX);
      near(out, `${L} withheld`, y.withheld, w.withheld);
      if (!unverified(w.gap)) near(out, `${L} gap`, y.gap, w.gap, TAX);
      same(out, `${L} over_1m`, yesNo(y.over1m), w.over_1m);
      near(out, `${L} medicare_held`, y.medicare, w.medicare_held);
      near(out, `${L} state`, y.state, blank(w.state) ? 0 : w.state);
      const k = detail.find((x) => x.year === w.year);
      if (k) near(out, `${L} supplemental withheld (withheld - medicare)`, y.withheld - y.medicare, k.supplemental);
    });
    const thisYear = yearOf(row.today), entry = d.vestYears.find((y) => y.year === thisYear);
    const earlier = entry ? entry.earlier : sum(rsus, (g) => sum(g.schedule.filter((e) => e.date <= row.today && yearOf(e.date) === thisYear), (e) => e.shares * d.price));
    near(out, `earlier_this_year (${entry ? "the year's entry" : "the schedules"})`, earlier, row.earlier_this_year);
  }
  if (part === "sale") {
    const x = d.diversify;
    if (blank(row.sell_need)) { if (x) out.push(`sale: app sells ${show(x.sell)}, key none`); return out; }
    if (!x) return [`sale: app none, key sells ${row.sell_need}`];
    near(out, "sell_need", x.sell, row.sell_need);
    near(out, "sell_from_401k", x.fromPlans, row.sell_from_401k);
    near(out, "sell_from_brokerage", x.fromTaxable, row.sell_from_brokerage);
    // since 2026-10-31 the page takes a loss by law (IRC 1211(b)): the signed gain and the tax with the loss allowed
    near(out, "sell_gain_law", x.gain, row.sell_gain_law);
    near(out, "sell_tax_law", x.tax, row.sell_tax_law, TAX);
    opt(out, "sell_share_after", x.after, row.sell_share_after, RATE);
  }
  return out;
}

const CHECK = { "schedules.csv": scheduleMismatches, "households.csv": householdMismatches };
const SIZE = { "schedules.csv": 1500, "households.csv": 2500 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => r.case_id)).size, SIZE[f]);
  });
}
test("every row is seen on a day of 2026; every household holds shares only in an account it has", () => {
  for (const r of [...ROWS["schedules.csv"], ...ROWS["households.csv"]]) assert.equal(r.today.slice(0, 4), "2026", r.case_id);
  for (const r of ROWS["households.csv"]) {
    const kinds = accountsOf(r).map((a) => a.kind);
    for (const h of holdingsOf(r)) assert.ok(kinds.includes(h.kind), `${r.case_id} holds shares in ${h.kind} without that account`);
  }
});
test("every to-do cause has a reason and names rows of the key that its part reads", () => {
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(reasonOf(cause), `no reason for ${cause}`);
    const part = cause.split("-")[0], f = PART_OF[part];
    assert.ok(f, `${cause} does not start with a part (${Object.keys(PART_OF).join(", ")})`);
    const ids = new Set(ROWS[f].map((r) => r.case_id));
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows ${part} does not read`);
    assert.equal(new Set(list).size, list.length, `${cause} names a row twice`);
  }
});

for (const [f, rows] of Object.entries(ROWS)) {
  for (const row of rows) {
    for (const part of SETS[f]) {
      const id = row.case_id, reason = TODO[`${id} ${part}`];
      test(`employer stock ${id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}

// ---- reported only: the 2027 contrast, the law's other ways, and the rows the law would withhold differently ----
const differs = (a, b, tol = CENT) => !(Math.abs(a - b) <= tol + EPS);
const H = ROWS["households.csv"];
test("reported: the page's 2027 owed and gap (its own indexing) against the key's contrast on the 2026 tables held flat, as counts", (t) => {
  let years = 0, owed = 0, gap = 0, largest = 0, vests = 0, vestOwed = 0;
  for (const row of H) {
    const d = pageOf(row);
    for (const c of contrastYearsOf(row)) {
      const y = d.vestYears?.find((x) => x.year === num(c.year));
      if (!y) continue;
      years++;
      if (differs(y.owed, num(c.owed), TAX)) owed++;
      if (differs(y.gap, num(c.gap), TAX)) gap++;
      largest = Math.max(largest, Math.abs(y.owed - num(c.owed)));
    }
    const inYear = (d.vests ?? []).filter((v) => yearOf(v.date) === 2027);
    contrastVestsOf(row).forEach((c, i) => { const v = inYear[i]; if (!v) return; vests++; if (differs(v.owed, num(c.owed), TAX)) vestOwed++; });
  }
  assert.ok(years > 0);
  t.diagnostic(`of ${years} years 2027 in view the page's owed differs from the contrast by more than two cents in ${owed} (largest $${largest.toFixed(2)}), its gap in ${gap}; of ${vests} 2027 vests the owed differs in ${vestOwed}`);
});
test("reported: the law's columns against the page (the whole crossing vest at 37%, Illinois by law, the sale at a loss and Illinois' tax on it), as counts", (t) => {
  let years = 0, whole = 0, wholeVests = 0, il = 0, ilDiffer = 0, ilAmount = 0, ilLargest = 0, ties = 0, sales = 0, gainLaw = 0, taxLaw = 0, stateSale = 0;
  for (const row of H) {
    const d = pageOf(row);
    for (const w of yearsLawOf(row)) {
      const y = d.vestYears?.find((x) => x.year === num(w.year));
      if (!y) continue;
      years++;
      if (differs(y.withheld, num(w.withheld_whole))) whole++;
      if (w.same_day_crossing === "yes") ties++;
      if (row.state === "IL") {
        il++;
        // why the law differs, from the key's own two columns: no more than 4.95% x $75 a person between them is the
        // exemption amount alone; more is the allowance lost above the income limit
        const keyPage = num(yearsOf(row).find((x) => x.year === w.year)?.state);
        if (differs(y.state, num(w.state_law))) { ilDiffer++; if (Math.abs(keyPage - num(w.state_law)) <= 0.0495 * 75 * (row.filing_status === "married_joint" ? 2 : 1) + CENT) ilAmount++; }
        ilLargest = Math.max(ilLargest, Math.abs(y.state - num(w.state_law)));
      }
    }
    vestsLawOf(row).forEach((w, i) => { const v = d.vests?.[i]; if (v && differs(v.withheld, num(w.withheld_whole))) wholeVests++; });
    if (!blank(row.sell_need) && d.diversify) {
      sales++;
      // the brief's main columns take a loss as a $0 gain; the page now follows the law (compared above), so count where they part
      if (differs(d.diversify.gain, num(row.sell_gain))) gainLaw++;
      if (differs(d.diversify.tax, num(row.sell_tax), TAX)) taxLaw++;
      if (num(row.sell_state_tax_law) !== 0) stateSale++;
    }
  }
  t.diagnostic(`whole-vest 37% (W2): the page's withholding differs from it in ${whole} of ${years} years in view (${wholeVests} vests); same-day vests across $1,000,000 (T1) in ${ties} years`);
  t.diagnostic(`Illinois by law ($2,925 and the income limit): differs from the page's share in ${ilDiffer} of ${il} Illinois years (largest $${ilLargest.toFixed(2)}): ${ilAmount} by the 2026 exemption amount alone (page error: $2,850 is 2025's), ${ilDiffer - ilAmount} by the allowance lost above the income limit (convention)`);
  t.diagnostic(`of ${sales} sales the page (by law: a loss allowed against $3,000 / $1,500 of other income) differs from the brief's $0-gain columns in ${gainLaw} gains and ${taxLaw} taxes (the sales at a loss); Illinois' tax on the sale (the page's is federal) is not 0 in ${stateSale}`);
});
test("reported: the federal tax figures more than a cent (and at most two) off the key, the engine rounding each return's total, as counts", (t) => {
  let figures = 0, overCent = 0, largest = 0;
  const look = (got, want) => { if (blank(want) || typeof got !== "number") return; figures++; const e = Math.abs(got - num(want)); if (e > CENT + EPS) overCent++; largest = Math.max(largest, e); };
  for (const row of H) {
    const d = pageOf(row);
    if (!d.ready) continue;
    vestsOf(row).forEach((w, i) => { const v = d.vests[i]; if (v) { look(v.owed, w.owed); look(v.gap, w.gap); } });
    yearsOf(row).forEach((w) => { const y = d.vestYears.find((x) => x.year === num(w.year)); if (y) { look(y.owed, w.owed); look(y.gap, w.gap); } });
    if (d.diversify) look(d.diversify.tax, row.sell_tax_law);
  }
  t.diagnostic(`of ${figures} owed, gap and sale-tax figures ${overCent} are more than a cent off the key (largest $${largest.toFixed(4)}): a tax the vests or the sale add is the difference of two totals the engine rounds to the cent`);
});
test("reported: the rows the key flags flat_rate_ok = no (vests in view, no employee pay), as counts", (t) => {
  let flagged = 0, payZero = 0;
  for (const row of H) {
    if (row.flat_rate_ok !== "no") continue;
    flagged++;
    if (pageOf(row).pay === 0) payZero++;
  }
  t.diagnostic(`${flagged} rows: the law would need the aggregate method there; the page withholds 22% as the key's main column does, and shows no pay on ${payZero} of them`);
});
