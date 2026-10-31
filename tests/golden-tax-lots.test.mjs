// tests/golden-tax-lots.test.mjs -- the Tax lots and harvesting page (investments/tax-lots: longOn, lotsOf, compute) against
// an answer key worked independently from the law (tools/golden_tax_lots, tests/golden/tax-lots/RULES.md), never from this
// repo's code. The key works each row twice in exact fractions and rounds once when written: money to the cent and rates to
// six decimals, half away from zero; the page's two rates come from federal totals rounded to the cent, as a total of tax
// is money (RULES.md R2, revised 2026-10-31 after a first run: no source decides how a rate is rounded). The page works in
// floating point, so every amount is compared within a cent and every rate within half a unit of the sixth decimal (5e-7).
// Dates, terms, day counts, lot keys and orders are compared exactly. Checked on 2026-10-31: 13,006 tests, 11,495 pass,
// 0 fail, 1,511 to-do: 124 (period 9, lots 115) under feb28-before-leap, 1,387 saved rows under loss-limit (1,297) and
// wash-sale (171), 21 of them under both and 9 passing today (the reasons below say why).
//
// lots.csv: one lot per row, fed to longOn(acquired) and to lotsOf() as a one-lot holding (price 10, 1 share, cost 5) on the
// row's today. households.csv: each row is one plan, emptyPlan() with the filing status, one adult (self) born 1980-01-01,
// taxes.year = tax_year, the key's taxable interest (other_ordinary) as one Income-page "Dividends and interest" item a year
// (type investment: the federal page counts it as ordinary income and as investment income for the 3.8%, Form 8960 line 1;
// its typed "other ordinary income" box is left out of investment income, since it also holds IRA withdrawals),
// taxes.thisYear.qualifiedIncome = qualified_dividends, and taxes.gains = one short and one long sale whose proceeds less
// basis is st_realized and lt_realized (a gain as proceeds over a basis of 0, a loss as a basis over proceeds of 0). (The
// interest item changes no rate: $1,000 more income adds the same 3.8% whatever the investment income; it matters only to
// the saved part.) Two accounts: "brokerage" (the
// holdings page's taxable bucket) for the key's `taxable` holdings and "ira" (the deferred bucket) for its `ira` ones;
// holding i is { id h<i>, accountId, symbol, shares, price, costBasis, lots: [{ id, date (null when blank), shares, cost }] }
// in the key's order, so the page's lot j of holding i is the key's "i|j" and the page's unassigned lot is "i|u". Then
// compute(plan, { today }).
//
// What is compared, by part (each row is one test per part):
//   lots.csv       period   longOn(acquired) and the lot's longOn against long_on (the law's first long-term day; none when
//                           undated), its term against term, daysToLong against days_to_long
//   households.csv lots     every lot in the key's order (holding by holding, lots as typed, the unassigned lot last): value,
//                           cost (the key's value - gain), gain, term, longOn (none for an undated or unassigned lot),
//                           daysToLong, assigned; per holding shares, gain and unassignedShares (the key's shares less the
//                           typed lots' shares); ready, taxableCount and the number in the page's "N taxable holdings have
//                           shares not split into lots" note (the key's taxable holdings with an "i|u" lot)
//                  rates    marginal against marginal_rate, gainsRate against gains_rate
//                  harvest  the candidates (the set of lot keys; the page sorts them by tax saved, the key lists them in lot
//                           order), each one's loss and taxSaved against page_tax_saved (the README's per-lot convention:
//                           loss x rate), harvest.length, harvestTotal, shortLosses, longLosses, and the wash-sale note shown
//                           when there is a candidate
//                  saved    taxSavedTotal, the figure the hero calls what the losses are "worth ... of tax", against
//                           harvest_tax_saved_law: the year's federal tax without the harvest less with every candidate sold
//                           today (0 when there is no candidate)
//                  sell     sellFirst (the first eight taxable lots) against sell_first, key for key and in order; the 7
//                           sell_first_tie rows included (the page's sort is stable, as the key's input order on ties)
// Reported only (no pass or fail; the page has no such figure or follows its own documented convention):
//   - the key's page-convention columns (lots.csv long_on_page / term_page / days_to_long_page, households.csv
//     lot_page_contrast) against the app, as counts: the app follows them wherever the law column differs;
//   - findings beside the saved part: how far apart the page's total and the law's are, the carryover to next year
//     (harvest_carryover_*; the page shows no amount and says "up to 3,000 a year of income", which is 1,500 filing
//     separately, 26 U.S.C. 1211(b)(1)), wash sales against purchases already made (harvest[].wash_sale and disallowed,
//     wash_matches; the page lists every candidate at its full loss and its note covers only buying back after the sale)
//     and the tax-per-dollar order (sell_first_tax_per_dollar, against the page's sellFirst: a convention, no source decides
//     which lot to sell for cash).
// Not compared (the page has no such figure): page_tax_saved_total (the per-lot page_tax_saved figures are, and the saved
// part holds the total to the law), disallowed_total, short_losses_allowed, long_losses_allowed, tax_without,
// tax_with, niit_without, niit_with, ratio_law_to_page, carryover_without_*, carryover_added_*, wash_plain_test,
// wash_basis_note, same_day_sensitive (it moves only the key's allowed short / long split, which is not compared), the
// holding_results value and cost (the page's holding carries only shares and gain; its lots' value and cost are compared),
// lots.csv today_is, law_page_differ and note, households.csv row_kind and note.
//
// Where the page and the key part ways, the case ids are listed by cause in golden/tax-lots/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause. Each reason starts with the
// verdict of a check against the sources: "app wrong" (the law says otherwise, or the screen tells a layperson something
// about what a harvest saves that the law contradicts), "simplification" (a modelling choice the page's README or data
// model states) or "convention" (no source decides). Each cause was checked with a copy of the page's code that has one
// switch per cause: with every switch on, every row of every part agrees; with all but one on, exactly the rows listed
// under that one differ, apart from rows either of two causes alone explains, which are listed under both (they pass once
// either is fixed). When a cause is fixed, delete its lists and those rows must then pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute, lotsOf, longOn } from "../modules/investments/tax-lots/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/tax-lots/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : String(Number(x.toFixed(6)));
const yes = (v) => v === "yes";
const blank = (v) => v === "";
const CENT = 0.01, RATE = 5e-7, EPS = 1e-9;
/** A key list field: items joined by ";", fields by "|". */
const items = (v) => (blank(v) ? [] : v.split(";").map((s) => s.split("|")));

const SETS = {
  "lots.csv": ["period"],
  "households.csv": ["lots", "rates", "harvest", "saved", "sell"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));
const idOf = (f, row) => row.case_id;

// Where the page and the key part ways (tests/golden/tax-lots/RULES.md sections 3 and 6, tools/golden_tax_lots/README.md
// open points 1 and 3). A cause is "<part>-<why>"; the reason is the why's.
const WHY = {
  "feb28-before-leap": "app wrong: longOn() takes the day after the calendar anniversary, which for a lot bought on February 28 of the year before a leap year (2019, 2023, 2027) is February 29; but the holding period starts the day after the buy (Publication 550 (2025) p.81: \"begin counting on the date after the day you acquired the property\"), so March 1, and a year counted from March 1 runs to the last day of February, so the lot is held \"more than 1 year\" (26 U.S.C. 1222(3)) only from March 1 (Rev. Rul. 66-7: a lot bought on a month's last day must be held until the first day of the month after the period; the key read it in a secondary copy only). The README derives its rule from the same Pub. 550 sentence, which gives the day after the anniversary for every other date. A sale on that February 29 is short-term, not long-term (term-0014: 2023-02-28 sold 2024-02-29; term-0288: 2027-02-28 sold 2028-02-29); in households.csv (2025 and 2026) only longOn (not shown on the page) of 2019 and 2023 February 28 lots moves, never a term or a day count. The fix: count a year from the day after the buy (isoOf(y + 1, m, d) of that day, which rolls a February 29 start to March 1)",
  "loss-limit": "app wrong: taxSavedTotal, which the hero calls what the losses are \"worth about ... of tax\" (and each lot \"saves about\" its share), prices every harvested loss at a rate (loss x the marginal rate if short-term, x the gains rate if long-term), but a capital loss first cancels this year's gains, short against short and long against long, then across (26 U.S.C. 1222; Schedule D lines 7, 15, 16), and a net loss counts against other income only up to $3,000, $1,500 filing separately (1211(b): losses \"shall be allowed only to the extent of the gains from such sales or exchanges, plus ... the lower of (1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains\"); the rest is carried to next year (1212(b)(1)) and saves nothing this year. So the page says the harvest saves tax this year where the law saves none (lots-2026-mfj-1929: page $364,126.07, law $0.00, the year's own losses already use the $3,000) and prices a long-term loss at the 0% gains rate when it in fact comes off ordinary income (RULES.md 10.3: page $0, law $96). The fix: the federal total now less the federal total with every candidate's loss added to the year's sales (the app's own engine already nets and limits them), shown as this year's saving next to the carryover",
  "wash-sale": "app wrong: the page lists every candidate at its full loss and counts it in what the harvest is worth, though a purchase of the same ticker in the 30 days before today, in any of the household's accounts, already disallows the loss on as many shares (26 U.S.C. 1091(a): \"within a period beginning 30 days before the date of such sale ... the taxpayer has acquired ... substantially identical stock or securities, then no deduction shall be allowed\"; Pub. 550: a wash sale also when you \"Acquire substantially identical stock for your individual retirement arrangement (IRA) or Roth IRA\" or \"your spouse ... buys\"; Rev. Rul. 2008-5: the IRA case is lost for good). The page has every lot's date, so it can see these purchases, and its note only warns about buying back after the sale. Matching share for share, earliest purchase first (26 CFR 1.1091-1(b)-(e)), with the key's conventions W1-W4 (same ticker = substantially identical; lots sold in the same harvest are not replacements; undated lots are sold first and are never replacements). The fix: before pricing the harvest, cut each candidate's loss by its matched shares and say which purchase did it. 21 rows are listed under both causes (the whole loss is washed and the year's own losses already use the $3,000, so either fix alone gives the law's $0), and 9 wash-sale rows pass today only because the page's 0% gains rate prices at $0 a loss the law also takes away; they fail once loss-limit alone is fixed",
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
  if (!(typeof got === "number" && Math.abs(got - num(want)) <= tol + EPS)) out.push(`${label}: app ${show(got)}, key ${want === "" ? "none" : typeof want === "number" ? show(want) : want}`);
}
function same(out, label, got, want) {
  if (got !== want) out.push(`${label}: app ${show(got)}, key ${want === "" || want === null || want === undefined ? "none" : show(want)}`);
}

// --- lots.csv -----------------------------------------------------------------------------------------------------
const oneLot = (row) => lotsOf({ price: 10, shares: 1, costBasis: 5, lots: [{ id: "l1", date: blank(row.acquired) ? null : row.acquired, shares: 1, cost: 5 }] }, row.today)[0];
function lotsMismatches(row, part) {
  const out = [];
  if (part === "period") {
    const l = oneLot(row), want = blank(row.long_on) ? null : row.long_on;
    if (!blank(row.acquired)) same(out, "longOn(acquired)", longOn(row.acquired), want);
    same(out, "lot longOn", l.longOn ?? null, want);
    same(out, "term", l.term, row.term);
    same(out, "days_to_long", l.daysToLong, num(row.days_to_long));
  }
  return out;
}

// --- households.csv -----------------------------------------------------------------------------------------------
/** The row as a plan for the page. */
function planOf(row) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = row.filing_status;
  p.taxes.year = num(row.tax_year);
  p.income = num(row.other_ordinary) > 0 ? [{ id: "int", name: "Interest", type: "investment", amount: num(row.other_ordinary), period: "annual", taxable: true }] : [];
  p.taxes.thisYear.qualifiedIncome = num(row.qualified_dividends);
  const sale = (id, net, held) => ({ id, name: `${held}-term sales`, proceeds: Math.max(0, num(net)), basis: Math.max(0, -num(net)), held });
  p.taxes.gains = [sale("st", row.st_realized, "short"), sale("lt", row.lt_realized, "long")];
  p.accounts = [{ id: "brk", name: "Brokerage", type: "brokerage", balance: 0 }, { id: "ira", name: "IRA", type: "ira", balance: 0 }];
  const lots = items(row.lots);
  p.holdings = items(row.holdings).map(([symbol, kind, price, shares, cost], i) => ({
    id: `h${i}`, accountId: kind === "ira" ? "ira" : "brk", symbol, name: "", shares: num(shares), price: num(price), priceAsOf: row.today, costBasis: num(cost), assetClass: "", expenseRatio: null, yield: null,
    lots: lots.filter((l) => num(l[0]) === i).map(([, date, sh, c], j) => ({ id: `h${i}l${j}`, date: blank(date) ? null : date, shares: num(sh), cost: num(c) })),
  }));
  return p;
}
const cache = new Map();
/** The page's result for the row, with each of its lots' key ("i|j", the unassigned lot "i|u"). */
const pageOf = (row) => {
  if (!cache.has(row.case_id)) {
    const d = compute(planOf(row), { today: row.today }), keyOf = new Map();
    d.holdings.forEach((h, i) => { let j = 0; for (const l of h.lots) keyOf.set(l, `${i}|${l.assigned ? j++ : "u"}`); });
    cache.set(row.case_id, { d, keyOf });
  }
  return cache.get(row.case_id);
};

function householdMismatches(row, part) {
  const out = [], { d, keyOf } = pageOf(row);
  if (part === "lots") {
    const want = items(row.lot_results), app = d.holdings.flatMap((h) => h.lots);
    same(out, "lot keys", app.map((l) => keyOf.get(l)).join(";"), want.map((w) => `${w[0]}|${w[1]}`).join(";"));
    for (const [h, j, value, gain, term, lo, days, assigned] of want) {
      const k = `${h}|${j}`, l = app.find((x) => keyOf.get(x) === k);
      if (!l) continue;
      near(out, `${k} value`, l.value, value);
      near(out, `${k} cost`, l.cost, num(value) - num(gain));
      near(out, `${k} gain`, l.gain, gain);
      same(out, `${k} term`, l.term, term);
      same(out, `${k} longOn`, l.longOn ?? null, blank(lo) ? null : lo);
      same(out, `${k} days_to_long`, l.daysToLong, num(days));
      same(out, `${k} assigned`, l.assigned, yes(assigned));
    }
    const typed = items(row.lots), kinds = items(row.holdings).map((x) => x[1]);
    for (const [i, shares, , , gain] of items(row.holding_results)) {
      const h = d.holdings[num(i)];
      if (!h) { out.push(`holding ${i}: app none`); continue; }
      near(out, `holding ${i} shares`, h.shares, shares, 1e-6);
      near(out, `holding ${i} gain`, h.gain, gain);
      const inLots = typed.filter((l) => l[0] === i).reduce((s, l) => s + num(l[2]), 0);
      near(out, `holding ${i} unassignedShares`, h.unassignedShares, want.some((w) => w[0] === i && w[1] === "u") ? num(shares) - inLots : 0, 1e-6);
    }
    same(out, "ready", d.ready, kinds.length > 0);
    same(out, "taxableCount", d.taxableCount, kinds.filter((k) => k === "taxable").length);
    const note = d.notes.map((n) => /^(\d+) taxable holdings? ha(?:s|ve) shares not split into lots/.exec(n)).find(Boolean);
    same(out, "taxable holdings with unassigned shares (note)", note ? Number(note[1]) : 0, want.filter((w) => w[1] === "u" && kinds[num(w[0])] === "taxable").length);
  }
  if (part === "rates") {
    near(out, "marginal_rate", d.marginal, row.marginal_rate, RATE);
    near(out, "gains_rate", d.gainsRate, row.gains_rate, RATE);
  }
  if (part === "harvest") {
    const want = items(row.harvest), app = new Map(d.harvest.map((x) => [keyOf.get(x.lot), x]));
    same(out, "candidates", [...app.keys()].sort().join(";"), want.map((w) => `${w[0]}|${w[1]}`).sort().join(";"));
    same(out, "harvest_count", d.harvest.length, num(row.harvest_count));
    for (const [h, j, loss, saved] of want) {
      const x = app.get(`${h}|${j}`);
      if (!x) continue;
      near(out, `${h}|${j} loss`, x.loss, loss);
      near(out, `${h}|${j} page_tax_saved`, x.taxSaved, saved);
    }
    near(out, "harvest_total", d.harvestTotal, row.harvest_total);
    near(out, "short_losses", d.shortLosses, row.short_losses);
    near(out, "long_losses", d.longLosses, row.long_losses);
    same(out, "the wash-sale note (shown with any candidate)", d.notes.some((n) => n.startsWith("Harvesting:")), num(row.harvest_count) > 0);
  }
  if (part === "saved") near(out, "taxSavedTotal against harvest_tax_saved_law (this year's federal tax without the harvest less with it)", d.taxSavedTotal, row.harvest_tax_saved_law);
  if (part === "sell") same(out, "sell_first", d.sellFirst.map((x) => keyOf.get(x.lot)).join(";"), row.sell_first);
  return out;
}

const CHECK = { "lots.csv": lotsMismatches, "households.csv": householdMismatches };
const SIZE = { "lots.csv": 3000, "households.csv": 2000 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => idOf(f, r))).size, SIZE[f]);
  });
}
test("every household row is a tax year the page works (2025 or 2026), seen on a day of that year, with no lot bought after it", () => {
  for (const r of ROWS["households.csv"]) {
    assert.ok(["2025", "2026"].includes(r.tax_year) && r.today.slice(0, 4) === r.tax_year, r.case_id);
    for (const l of items(r.lots)) assert.ok(blank(l[1]) || l[1] <= r.today, `${r.case_id} lot dated ${l[1]}`);
  }
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
      test(`tax-lots ${id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}

// ---- reported only: the page's own convention, and the law's figures the page does not work ----
const money2 = (n) => Math.round(n * 100) / 100;
test("reported: the app against the key's page-convention columns (the day after the calendar anniversary), as counts", (t) => {
  let rows = 0, agree = 0, lots = 0, lotsAgree = 0;
  for (const row of ROWS["lots.csv"]) {
    const l = oneLot(row);
    rows++;
    if ((l.longOn ?? "") === row.long_on_page && l.term === row.term_page && l.daysToLong === num(row.days_to_long_page)) agree++;
  }
  for (const row of ROWS["households.csv"]) {
    const { d, keyOf } = pageOf(row), app = d.holdings.flatMap((h) => h.lots);
    for (const [h, j, lo, term, days] of items(row.lot_page_contrast)) {
      const l = app.find((x) => keyOf.get(x) === `${h}|${j}`);
      lots++;
      if (l && l.longOn === lo && l.term === term && l.daysToLong === num(days)) lotsAgree++;
    }
  }
  assert.ok(rows > 0);
  t.diagnostic(`lots.csv: the app's longOn, term and days to long-term equal long_on_page, term_page and days_to_long_page on ${agree} of ${rows} rows`);
  t.diagnostic(`households.csv lot_page_contrast: the app equals the page column on ${lotsAgree} of ${lots} lots (the law's first long-term day differs on each)`);
});
test("reported: the law's figures the page does not work (findings, not failures), as counts", (t) => {
  const H = ROWS["households.csv"];
  // the tax the harvest saves this year: the page's taxSavedTotal against harvest_tax_saved_law
  const c = { rows: 0, within: 0, higher: 0, lower: 0, higherBy: 0, lowerBy: 0, lawNothing: 0 }, why = { carry: 0, wash: 0 };
  let worst = null;
  for (const row of H) {
    const { d } = pageOf(row);
    if (!d.harvest.length) continue;
    c.rows++;
    const law = num(row.harvest_tax_saved_law), diff = d.taxSavedTotal - law;
    if (Math.abs(diff) <= 1) c.within++;
    else if (diff > 0) {
      c.higher++; c.higherBy += diff;
      if (num(row.carryover_added_short) + num(row.carryover_added_long) > 0) why.carry++;
      if (num(row.disallowed_total) > 0) why.wash++;
      if (law <= 1) c.lawNothing++;
    } else { c.lower++; c.lowerBy -= diff; }
    if (!worst || Math.abs(diff) > Math.abs(worst.diff)) worst = { id: row.case_id, diff, app: d.taxSavedTotal, law };
  }
  t.diagnostic(`tax saved this year: rows with candidates ${c.rows}; the page's taxSavedTotal within $1 of harvest_tax_saved_law on ${c.within}, above it by more than $1 on ${c.higher} (by ${money2(c.higherBy).toLocaleString("en-US")} in all; ${why.carry} of them leave more loss to carry to next year, ${why.wash} lose part of a loss to a wash sale, ${c.lawNothing} save $1 or less by law), below it on ${c.lower} (by ${money2(c.lowerBy).toLocaleString("en-US")}); the widest gap ${worst?.id}: page ${money2(worst?.app ?? 0)}, law ${money2(worst?.law ?? 0)}`);
  // the carryover to next year
  let carry = 0, carryAdded = 0, carryShort = 0, carryLong = 0, withCandidates = 0, separate = 0;
  for (const row of H) {
    if (!pageOf(row).d.harvest.length) continue;
    withCandidates++;
    if (row.filing_status === "married_separate") separate++;
    const s = num(row.harvest_carryover_short), l = num(row.harvest_carryover_long);
    if (s + l > 0) { carry++; if (s > 0) carryShort++; if (l > 0) carryLong++; }
    if (num(row.carryover_added_short) + num(row.carryover_added_long) > 0) carryAdded++;
  }
  t.diagnostic(`carryover: the page shows no amount ("the rest carries forward"); harvesting every candidate leaves a loss to carry to next year on ${carry} of the ${withCandidates} rows with candidates (short ${carryShort}, long ${carryLong}), ${carryAdded} of them more than without the harvest; the hero's "up to 3,000 a year of income" is 1,500 on the ${separate} married-filing-separately rows with candidates (26 U.S.C. 1211(b)(1))`);
  // wash sales against purchases already made
  let washCandidates = 0, washRows = 0, ira = 0, taxable = 0, disallowed = 0, plain = 0, plainDiffers = 0, candidates = 0;
  for (const row of H) {
    const { d, keyOf } = pageOf(row), listed = new Set(d.harvest.map((x) => keyOf.get(x.lot)));
    const want = items(row.harvest), plainSet = new Set(items(row.wash_plain_test).map((x) => `${x[0]}|${x[1]}`));
    candidates += want.length;
    const washed = want.filter((w) => yes(w[4]));
    washCandidates += washed.length;
    for (const w of want) { if (plainSet.has(`${w[0]}|${w[1]}`)) plain++; if (plainSet.has(`${w[0]}|${w[1]}`) !== yes(w[4])) plainDiffers++; }
    assert.ok(washed.every((w) => listed.has(`${w[0]}|${w[1]}`)), `${row.case_id}: a wash-sale candidate the page does not list`);
    if (washed.length) washRows++;
    disallowed += num(row.disallowed_total);
    const accounts = new Set(items(row.wash_matches).map((m) => m[6]));
    if (accounts.has("ira")) ira++;
    if (accounts.has("taxable")) taxable++;
  }
  t.diagnostic(`wash sales: the page tests none and lists every candidate at its full loss; of ${candidates} candidates the law disallows part or all of ${washCandidates} (${washRows} rows, ${money2(disallowed).toLocaleString("en-US")} of loss in all) because the same ticker was bought in the 30 days before today, in an IRA on ${ira} rows (lost for good) and in a taxable account on ${taxable}; the brief's plain test (any other lot of the ticker dated today - 30 to today) says yes on ${plain} and differs from the share-for-share match on ${plainDiffers}`);
  // the order to sell
  let orderRows = 0, orderDiffers = 0;
  for (const row of H) {
    const { d, keyOf } = pageOf(row);
    if (!d.sellFirst.length) continue;
    orderRows++;
    if (d.sellFirst.map((x) => keyOf.get(x.lot)).join(";") !== row.sell_first_tax_per_dollar) orderDiffers++;
  }
  t.diagnostic(`order to sell: the page sorts by gain per share; the key's tax-per-dollar contrast (losses first, then the least tax per dollar raised) gives another first eight on ${orderDiffers} of ${orderRows} rows`);
});
