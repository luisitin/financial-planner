// tests/golden-estate.test.mjs -- the estate and gift pages (estate/estate-tax: the federal estate tax for one person or a
// couple, with the unused exemption carried over or not; estate/gifting: gifts against the yearly allowance, the 529
// five-year election, the lifetime exemption used and left, the years needing a gift tax return; and the shared table in
// estate/gifting/data/transfer-tax.js) against an answer key worked independently from the law (tools/golden_estate,
// tests/golden/estate/RULES.md), never from this repo's code. The key's main columns are the pages' model as their READMEs
// stood before 2026-10-31 (the couple's conservative rule, only the gift marked "from both" split, any ticked 529 spread);
// its law_* columns give the law. The pages were fixed to the law that day, so the whole-page parts below compare them with
// the law_* columns, and the main columns only where the law and that model agree or where they test a function on the
// key's own inputs. The key works each row twice in exact arithmetic and rounds once to the cent, half up; the pages work
// in floating point and never round (their views round to whole dollars), so every amount is compared within a cent.
//
// What is compared, by part (each row is one test per part):
//   schedule.csv  rate       tentativeTax(amount) against tentative_tax within a cent, and the page's RATE_SCHEDULE has the
//                            key's row (bracket_over, bracket_rate) with the amount over that line and not over the next
//                            ("not over" a line keeps it in the lower row, as the page's loop does)
//                 exemption  exclusionFor(year) against basic_exclusion exactly (2027: the 2026 figure carried forward, as
//                            the key does), exclusionFor(year) + dsue against exemption and the credit, tentativeTax of that,
//                            against credit, both within a cent
//                 schedule   estateTax(taxable, gifts, exclusionFor(year) + dsue) against estate_tax within a cent (no gift
//                            tax payable: these rows test the schedule and the credit)
//   estate.csv    estatetax  estateTax() with the key's own inputs and no gift tax: one person estateTax(taxable_estate,
//                            gifts_a, exemption) against tax; a couple estateTax(taxable_estate, gifts_added, exemption +
//                            dsue_carried) and estateTax(taxable_estate, gifts_added, exemption) against the two second-death
//                            columns (the function on the old rule's inputs; the page now calls it per order of death)
//                 estate     the page's whole compute(): a small plan per row (one adult, or two married; a savings
//                            account per person with its owner holding the estate share; a term life policy on and owned by
//                            each person with cover; each person's lifetime taxable gifts entered as one cash gift of that
//                            much plus the year's allowance in the row's year, so the gifting page counts exactly that much
//                            over; the charity as a charitable bequest), fed on October 31 of the row's year. The exemption,
//                            each person's estate (share + cover), cover and gifts, the estate, the charity, the taxable
//                            estate, and for a couple the first death's tax and both unused exemptions (DSUE), all within a
//                            cent
//                 estatelaw  the same compute() against the law: one person, single.tax against law_tax_less_gift_tax (the
//                            gift tax payable on lifetime gifts over the exemption subtracted, 26 U.S.C. 2001(b)(2)); a
//                            couple, secondDeath.tax and taxWithout against the worse of the two real orders of death (max
//                            of law_a_first_* and law_b_first_*): the page works both orders and shows the costlier
//   gifts.csv     allowance  annualExclusionFor(year) against every year of allowances (2027 on: $19,000 carried
//                            forward), and exclusionFor(2026) against exemption, exactly
//                 gifts      the page's whole compute(): one plan per row (adult A, and B married to A when givers = 2; each
//                            gift with from = A's id, B's id or "both", kind, year, amount and the 529 election), fed on
//                            2026-10-31 (the key's exemption is 2026's), against the law: within a cent and both ways (an
//                            entry missing on one side counts as 0 there), per year, giver and recipient what is counted
//                            (law_counted); per year and giver what is over (law_over_by_year); each 529 election as elected
//                            / excess per year, giver and recipient (law_elections, from the page's elections); then
//                            lifetimeUsed and lifetimeLeft per giver (law_used_*, law_left_*) within a cent, and the years
//                            with needs709 (law_form709_years)
// Not compared (the pages have no such figure): schedule.csv exemption_published and exemption_kind (labels: the figures
// behind them are); estate.csv household (the plan has one adult or two), dsue_carried, gifts_added and the old rule's
// second-death and single-person tax columns (the pages no longer use that rule); gifts.csv years, counted, over_by_year,
// elections, used_*, left_*, form709_years (the old model), unpublished_years (the page carries the newest figure forward
// without saying so), law_split_years, law_filers (which spouse files: the page says only that a return is needed),
// law_differs and law_reason (the key's own summary of the contrast); and every label and note.
//
// Where the page and the key part ways, the case ids are listed by cause in golden/estate/todo.json and run as { todo }
// tests; a cause's part is the first word of its name, and a row can have more than one cause. Each reason starts with
// the verdict of a check against the sources: "app wrong" (the law says otherwise and the page's README does not claim the
// shortcut) or "simplification" (a modelling choice the page's README states). When a cause is fixed, delete its list and
// those rows must then pass.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { splitCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import * as estate from "../modules/estate/estate-tax/compute.js";
import * as gifting from "../modules/estate/gifting/compute.js";
import { tentativeTax, exclusionFor, annualExclusionFor, RATE_SCHEDULE } from "../modules/estate/gifting/data/transfer-tax.js";

const read = (name) => fs.readFileSync(new URL(`./golden/estate/${name}`, import.meta.url), "utf8");
// the gift lists hold ";" and "|" in their cells, so the separator is named rather than detected
const csv = (name) => { const [headers, ...rows] = splitCsv(read(name), ","); return toObjects({ headers, rows }); };
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : x.toFixed(2);
const CENT = 0.01;

const SETS = {
  "schedule.csv": ["rate", "exemption", "schedule"],
  "estate.csv": ["estatetax", "estate", "estatelaw"],
  "gifts.csv": ["allowance", "gifts"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));

// Where the page and the key part ways (tests/golden/estate/RULES.md section 10 and tools/golden_estate/README.md).
// None today. The causes this key found on 2026-10-31 are fixed on the pages: a year with a gift from both splits every
// gift either spouse made that year (26 U.S.C. 2513(a)(2); 26 CFR 25.2513-1(b)(5)); 529 gifts are one total per giver,
// child and year, spread only when that total is over the year's allowance, with the 5 x cap on the total (529(c)(2)(B);
// proposed 26 CFR 1.529-5(b)(2)); the gift tax payable on lifetime gifts comes off the estate tax (2001(b)(2)); and a
// couple's second death is worked for both orders of death, the costlier shown (2001(b)(1)(B), 2010(c)(4)), instead of the
// smaller unused exemption with the larger gifts.
const REASONS = {};
// Not causes: the half-cent ties the key labels (sch-edge-095, -096, gift-edge-028) are within a cent either way, and
// gift-edge-028's used + left being a cent above the exemption is the key's rounding of each figure on its own.
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
/** Two maps of amounts (key -> number on the page, key -> written amount in the key), within a cent, both ways; an entry
 *  missing on one side counts as 0 there (the key lists no recipient with nothing counted, the page no year without a gift). */
function nearMap(out, label, got, want) {
  for (const k of [...new Set([...got.keys(), ...want.keys()])].sort()) {
    const g = got.get(k) ?? 0, w = want.get(k) ?? "0.00";
    if (!(Math.abs(g - num(w)) <= CENT + 1e-9)) out.push(`${label} ${k}: app ${got.has(k) ? show(g) : "none"}, key ${want.has(k) ? w : "none"}`);
  }
}

// --- schedule.csv -------------------------------------------------------------------------------------------------
const exemptionOf = (row) => exclusionFor(num(row.year)) + num(row.dsue);
function scheduleMismatches(row, part) {
  const out = [], amount = num(row.amount);
  if (part === "rate") {
    near(out, "tentative_tax", tentativeTax(amount), row.tentative_tax, CENT);
    const i = RATE_SCHEDULE.findIndex((r) => r[0] === num(row.bracket_over));
    if (i < 0) out.push(`bracket_over: no row of the page's table starts at ${row.bracket_over}`);
    else {
      const [over, , rate] = RATE_SCHEDULE[i], next = RATE_SCHEDULE[i + 1]?.[0] ?? Infinity;
      if (Math.abs(rate * 100 - num(row.bracket_rate)) > 1e-9) out.push(`bracket_rate: app ${rate * 100}, key ${row.bracket_rate}`);
      if (!((amount > over || over === 0) && amount <= next)) out.push(`bracket: the page's row over ${over} (to ${next}) does not hold ${row.amount}`);
    }
  }
  if (part === "exemption") {
    near(out, "basic_exclusion", exclusionFor(num(row.year)), row.basic_exclusion, 0);
    near(out, "exemption", exemptionOf(row), row.exemption, CENT);   // a sum in floating point: within a cent
    near(out, "credit", tentativeTax(exemptionOf(row)), row.credit, CENT);
  }
  if (part === "schedule") near(out, "estate_tax", estate.estateTax(num(row.taxable), num(row.gifts), exemptionOf(row)), row.estate_tax, CENT);
  return out;
}

// --- estate.csv ---------------------------------------------------------------------------------------------------
const WHO = [["a", "pa", "Person A"], ["b", "pb", "Person B"]];
const isCouple = (row) => row.household === "couple";
/** The row as a plan for the estate tax page. */
function estatePlanOf(row) {
  const p = emptyPlan(), year = num(row.year), who = isCouple(row) ? WHO : WHO.slice(0, 1);
  p.household.people = who.map(([, id, name], i) => ({ id, name, role: i ? "partner" : "self" }));
  p.household.filingStatus = who.length > 1 ? "married_joint" : "single";
  p.accounts = who.map(([x, id]) => ({ id: `savings-${x}`, name: "Savings", type: "savings", balance: num(row[`estate_${x}`]), ownerId: id }));
  p.insurance = { ...(p.insurance ?? {}), policies: who.filter(([x]) => num(row[`life_cover_${x}`]) > 0).map(([x, id]) => ({ id: `life-${x}`, name: "Term life", kind: "term", personId: id, benefit: num(row[`life_cover_${x}`]), premium: 0, period: "yearly" })) };
  // lifetime taxable gifts: one cash gift the year's allowance above them, so the gifting page counts exactly them over
  const gifts = who.filter(([x]) => num(row[`gifts_${x}`]) > 0).map(([x, id]) => ({ id: `gift-${x}`, to: `Friend of ${x.toUpperCase()}`, from: id, amount: num(row[`gifts_${x}`]) + annualExclusionFor(year), year, kind: "cash" }));
  const bequests = num(row.charity) > 0 ? [{ id: "charity", to: "A charity", kind: "charity", amount: num(row.charity) }] : [];
  p.estate = { ...(p.estate ?? {}), gifts, legacy: { bequests } };
  return p;
}
const estateCache = new Map();
const estatePage = (row) => { if (!estateCache.has(row.case_id)) estateCache.set(row.case_id, estate.compute(estatePlanOf(row), { today: `${row.year}-10-31` })); return estateCache.get(row.case_id); };

function estateMismatches(row, part) {
  const out = [], couple = isCouple(row), E = num(row.exemption);
  if (part === "estatetax") {
    if (!couple) near(out, "tax", estate.estateTax(num(row.taxable_estate), num(row.gifts_a), E), row.tax, CENT);
    else {
      near(out, "second_death_tax_portability", estate.estateTax(num(row.taxable_estate), num(row.gifts_added), E + num(row.dsue_carried)), row.second_death_tax_portability, CENT);
      near(out, "second_death_tax_no_portability", estate.estateTax(num(row.taxable_estate), num(row.gifts_added), E), row.second_death_tax_no_portability, CENT);
    }
    return out;
  }
  const d = estatePage(row);
  same(out, "couple", d.couple, couple);
  if (d.couple !== couple) return out;
  if (part === "estate") {
    near(out, "exemption", d.exclusion, row.exemption, 0);
    near(out, "estate_total", d.estateToday, row.estate_total, CENT);
    near(out, "life cover", d.lifeCover, num(row.life_cover_a) + num(row.life_cover_b), CENT);
    near(out, "charity", d.charity, row.charity, CENT);
    d.people.forEach((q, i) => {
      const x = WHO[i][0];
      near(out, `estate_${x} + life_cover_${x}`, q.estate, num(row[`estate_${x}`]) + num(row[`life_cover_${x}`]), CENT);
      near(out, `life_cover_${x}`, q.lifeCover, row[`life_cover_${x}`], CENT);
      near(out, `gifts_${x}`, q.gifts, row[`gifts_${x}`], CENT);
    });
    if (!couple) near(out, "taxable_estate", d.single.taxable, row.taxable_estate, CENT);
    else {
      const s = d.pair.secondDeath;
      near(out, "first_death_tax", d.pair.firstDeath.tax, row.first_death_tax, CENT);
      near(out, "dsue_a", d.pair.firstDeath.dsue[0], row.dsue_a, CENT);
      near(out, "dsue_b", d.pair.firstDeath.dsue[1], row.dsue_b, CENT);
      // the exemption carried is the first to die's unused one, in the order shown
      near(out, "dsue carried (one of the two)", Math.min(Math.abs(s.exemption - d.exclusion - num(row.dsue_a)), Math.abs(s.exemption - d.exclusion - num(row.dsue_b))), 0, CENT);
      near(out, "exemption without portability", s.exemptionWithout, row.exemption, 0);
      near(out, "taxable_estate", s.taxable, row.taxable_estate, CENT);
    }
  }
  if (part === "estatelaw") {
    if (!couple) near(out, "law_tax_less_gift_tax", d.single.tax, row.law_tax_less_gift_tax, CENT);
    else {
      const worse = (a, b) => Math.max(num(row[a]), num(row[b])).toFixed(2);
      near(out, "the worse order, portability", d.pair.secondDeath.tax, worse("law_a_first_portability", "law_b_first_portability"), CENT);
      near(out, "the worse order, no portability", d.pair.secondDeath.taxWithout, worse("law_a_first_no_portability", "law_b_first_no_portability"), CENT);
    }
  }
  return out;
}

// --- gifts.csv ----------------------------------------------------------------------------------------------------
const GIVER_ID = { A: "pa", B: "pb" }, LETTER = { pa: "A", pb: "B" };
const items = (s) => (s ? s.split(";") : []);
/** "year:from:to:amount:kind:superfund;..." -> gifts as the gifting page stores them. */
const giftsOf = (row) => items(row.gifts).map((it, i) => {
  const [year, from, to, amount, kind, superfund] = it.split(":");
  return { id: `g${i + 1}`, to, from: from === "both" ? "both" : GIVER_ID[from], amount: num(amount), year: num(year), kind, superfund: superfund === "yes" };
});
function giftsPlanOf(row) {
  const p = emptyPlan();
  p.household.people = [{ id: "pa", name: "Giver A", role: "self" }, ...(row.givers === "2" ? [{ id: "pb", name: "Giver B", role: "partner" }] : [])];
  p.household.filingStatus = row.givers === "2" ? "married_joint" : "single";
  p.estate = { ...(p.estate ?? {}), gifts: giftsOf(row) };
  return p;
}
// the key's lists, as maps
const countedOf = (s) => new Map(items(s).flatMap((it) => { const [year, giver, rest] = it.split(":"); return rest.split("|").map((x) => { const [to, amt] = x.split("="); return [`${year}:${giver}:${to}`, amt]; }); }));
const pairsOf = (s) => new Map(items(s).map((it) => it.split("=")));
const electionsOf = (s, i) => new Map(items(s).map((it) => { const [k, v] = it.split("="); return [k, v.split("/")[i]]; }));
// the page's outputs, the same way
const L = (id) => LETTER[id] ?? id;
function pageLists(d) {
  const counted = new Map(), over = new Map(), elected = new Map(), excess = new Map();
  for (const b of d.byYear) {
    for (const g of d.givers) over.set(`${b.year}:${L(g.id)}`, 0);
    for (const r of b.rows) {
      const k = `${b.year}:${L(r.giverId)}:${r.to.toLowerCase()}`;
      counted.set(k, (counted.get(k) ?? 0) + r.counted);
      over.set(`${b.year}:${L(r.giverId)}`, (over.get(`${b.year}:${L(r.giverId)}`) ?? 0) + r.over);
    }
  }
  for (const e of d.elections) {
    const k = `${e.year}:${L(e.giverId)}:${e.to.toLowerCase()}`;
    elected.set(k, (elected.get(k) ?? 0) + e.elected);
    excess.set(k, (excess.get(k) ?? 0) + e.excess);
  }
  return { years: d.byYear.map((b) => b.year), counted, over, elected, excess, form709: d.byYear.filter((b) => b.needs709).map((b) => b.year) };
}
const giftsCache = new Map();
const giftsPage = (row) => { if (!giftsCache.has(row.case_id)) { const d = gifting.compute(giftsPlanOf(row), { today: "2026-10-31" }); giftsCache.set(row.case_id, { d, ...pageLists(d) }); } return giftsCache.get(row.case_id); };

function giftsMismatches(row, part) {
  const out = [];
  if (part === "allowance") {
    for (const [y, amt] of pairsOf(row.allowances.replace(/\|/g, ";"))) near(out, `allowance ${y}`, annualExclusionFor(Number(y)), amt, 0);
    near(out, "exemption", exclusionFor(2026), row.exemption, 0);
    return out;
  }
  const g = giftsPage(row), p = "law_";
  nearMap(out, `${p}counted`, g.counted, countedOf(row[`${p}counted`]));
  nearMap(out, `${p}over`, g.over, pairsOf(row[`${p}over_by_year`]));
  nearMap(out, `${p}elected`, g.elected, electionsOf(row[`${p}elections`], 0));
  nearMap(out, `${p}excess`, g.excess, electionsOf(row[`${p}elections`], 1));
  for (const x of row.givers === "2" ? ["a", "b"] : ["a"]) {
    near(out, `${p}used_${x}`, g.d.lifetimeUsed[GIVER_ID[x.toUpperCase()]], row[`${p}used_${x}`], CENT);
    near(out, `${p}left_${x}`, g.d.lifetimeLeft[GIVER_ID[x.toUpperCase()]], row[`${p}left_${x}`], CENT);
  }
  same(out, `${p}form709_years`, g.form709.join("|"), row[`${p}form709_years`]);
  return out;
}

const CHECK = { "schedule.csv": scheduleMismatches, "estate.csv": estateMismatches, "gifts.csv": giftsMismatches };
const SIZE = { "schedule.csv": 1000, "estate.csv": 1500, "gifts.csv": 1000 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));
const runs = () => true;

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => r.case_id)).size, SIZE[f]);
  });
}
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
      test(`estate ${row.case_id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}
