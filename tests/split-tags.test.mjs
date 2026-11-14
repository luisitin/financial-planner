// tests/split-tags.test.mjs -- gap design #24 (2026-11-14): a purchase split across categories, and tags that do something
// (`transactions[].splits`, `rules[].tag`; modules/transactions/splits.js, ledger allLines / linesOf).
// Over the 14 households of qa/households and four fixture plans, each given six months of invented bank lines
// (qa/fixtures/bank-lines.mjs):
//   1. invariance: with no split and no tag anywhere, the lines a page reads are plan.transactions itself, and every module
//      that reads transactions gives byte-identical output with the new fields absent, empty, or present but unusable;
//   2. a split purchase counts once in every total on every page that reads transactions: the pages that total by
//      category (Ledger, Where the money goes, Budget, Income statement, Categories, Export) move money between categories
//      and nothing else; the pages that read whole transactions do not change at all;
//   3. tags change no figure anywhere but in the Tags part.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { samplePlan } from "../qa/fixtures/sample-plan.mjs";
import { renterDebtPlan } from "../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import { withBankLines, splitSome, tagSome } from "../qa/fixtures/bank-lines.mjs";
import { compute as ledger, allLines, linesOf, splitsOf } from "../modules/transactions/ledger/compute.js";
import { compute as spending, watchChoices } from "../modules/cashflow/spending/compute.js";
import { compute as budget } from "../modules/cashflow/budget/compute.js";
import { compute as incomeStatement, bankVsPlan } from "../modules/cashflow/income-statement/compute.js";
import { compute as categories } from "../modules/transactions/categories/compute.js";
import { DATASETS } from "../modules/reports/export/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-13";
const PLANS = [
  ...ARCHETYPES.map((a, i) => ({ name: a.id, plan: withBankLines(a.build(), i + 1) })),
  { name: "family", plan: withBankLines(familyPlan(T), 40) }, { name: "sample", plan: samplePlan() }, { name: "sample + lines", plan: withBankLines(samplePlan(), 41) },
  { name: "renter with debts", plan: withBankLines(renterDebtPlan(T), 42) }, { name: "retired couple", plan: withBankLines(retiredCouplePlan(T), 43) },
];
/** Every module whose compute.js names transactions (it reads them, or a page that does). */
async function readers() {
  const mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      if (m.isDirectory() && fs.existsSync(f) && /transactions/.test(fs.readFileSync(f, "utf8"))) mods.push([`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  return mods.filter(([, fn]) => typeof fn === "function");
}
const READERS = await readers();
// System > Diagnostics and Settings measure the saved plan's size: any field added changes it, by design
const SIZE_ONLY = new Set(["system/diagnostics", "system/settings", "system/backups"]);
const out = (fn, plan, params = { today: T }) => { try { return JSON.stringify(fn(structuredClone(plan), params)); } catch (e) { return `throws ${e.message}`; } };
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const monthsOf = (plan) => [...new Set((plan.transactions ?? []).map((t) => String(t.date).slice(0, 7)))].sort();
const sum = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);

test(`the households have bank lines to test on: ${PLANS.length} plans, ${READERS.length} modules that read transactions`, () => {
  assert.ok(PLANS.length >= 19); assert.ok(READERS.length >= 30, `${READERS.length}`);
  for (const { name, plan } of PLANS) {
    assert.ok(plan.transactions.length >= 10, `${name}: ${plan.transactions.length} lines`);
    assert.ok(plan.transactions.every((t) => t.splits === undefined && !(t.tags ?? []).length), `${name}: no split, no tag`);
    assert.ok((plan.rules ?? []).every((r) => r.tag === undefined));
  }
  assert.equal(allLines(emptyPlan()).length, 0);
});

test("invariance: with no split anywhere the lines read are plan.transactions itself, and every reader gives the same output with the new fields absent, empty or unusable", () => {
  let ran = 0;
  for (const [at, { name, plan }] of PLANS.entries()) {
    assert.equal(allLines(plan), plan.transactions, `${name}: the very same array`);
    // the fields there but holding nothing: an empty list of parts and of tags on every line, an empty tag on every rule
    const empty = structuredClone(plan);
    for (const t of empty.transactions) { t.splits = []; t.tags = t.tags ?? []; }
    for (const r of empty.rules ?? []) r.tag = "";
    // parts that cannot be used (they do not add up; one part; the wrong way): the purchase counts whole, as before
    const bad = structuredClone(plan);
    bad.transactions.forEach((t, i) => { t.splits = i % 3 === 0 ? [{ category: "gifts", amount: Number(t.amount) / 2 }, { category: "dining", amount: Number(t.amount) }] : i % 3 === 1 ? [{ category: "gifts", amount: Number(t.amount) }] : [{ category: "gifts", amount: -Number(t.amount) }, { category: "dining", amount: 2 * Number(t.amount) }]; });
    assert.ok(bad.transactions.every((t) => splitsOf(t) === null && linesOf(t)[0] === t));
    const strip = (s) => s.replace(/,"splits":\[[^\]]*\]/g, "");
    for (const [id, compute] of READERS) {
      if (SIZE_ONLY.has(id)) continue;
      const base = out(compute, plan);
      assert.ok(!base.startsWith("throws"), `${name} ${id}: ${base}`);
      assert.equal(strip(out(compute, empty)), base, `${name} ${id}: empty fields`);
      if (at % 3 === 0) assert.equal(strip(out(compute, bad)), base, `${name} ${id}: unusable parts`);   // every third household: it takes time
      ran++;
    }
    for (const ds of DATASETS) { const base = out((p) => ds.build(p, T), plan); assert.equal(out((p) => ds.build(p, T), empty), base, `${name} export ${ds.id}`); assert.equal(out((p) => ds.build(p, T), bad), base, `${name} export ${ds.id}`); }
    assert.equal(out(bankVsPlan, empty), out(bankVsPlan, plan)); assert.equal(out(watchChoices, empty), out(watchChoices, plan));
  }
  assert.ok(ran >= 500, `${ran} runs`);
});

for (const how of ["other", "same"]) {
  test(`a split purchase counts once on every page that totals by category (parts in ${how === "same" ? "the purchase's own category" : "another category"})`, () => {
    let splitCount = 0;
    for (const { name, plan } of PLANS) {
      const s = splitSome(plan, how);
      const n = s.transactions.filter((t) => t.splits).length;
      if (!n) continue;   // a household with no purchase to split
      splitCount += n;
      assert.ok(s.transactions.every((t) => !t.splits || splitsOf(t)), `${name}: every split adds up`);
      near(sum(allLines(s), (l) => l.amount), sum(plan.transactions, (t) => t.amount), `${name} lines`);
      assert.equal(allLines(s).length, plan.transactions.length + n);

      // Ledger: money in, money out and the counts, over everything and month by month; the categories partition the total
      for (const params of [{ today: T }, ...monthsOf(plan).map((month) => ({ today: T, month })), { today: T, dir: "out" }, { today: T, q: "maple" }]) {
        const a = ledger(plan, params), b = ledger(s, params), w = `${name} ledger ${JSON.stringify(params)}`;
        near(b.in, a.in, `${w} in`); near(b.out, a.out, `${w} out`); near(b.net, a.net, `${w} net`);
        for (const k of ["matched", "matchedIn", "matchedOut", "total", "uncategorised", "uncategorisedAll", "shown"]) assert.equal(b[k], a[k], `${w} ${k}`);
      }
      const all = ledger(s, { today: T });
      const cats = [...new Set(allLines(s).map((l) => l.category || "none"))];
      near(sum(cats, (c) => ledger(s, { today: T, category: c }).out), all.out - all.cardsOut, `${name} ledger: the categories' money out adds up to the total`);
      near(sum(cats, (c) => ledger(s, { today: T, category: c }).in), all.in, `${name} ledger: the categories' money in adds up to the total`);

      // Where the money goes: each month's total, count, daily figures; the categories add up to the total
      for (const month of monthsOf(plan)) {
        const a = spending(plan, { today: T, month }), b = spending(s, { today: T, month }), w = `${name} spending ${month}`;
        near(b.total, a.total, `${w} total`); assert.equal(b.count, a.count, `${w} count`); near(b.perDay, a.perDay, `${w} a day`);
        // (the list leaves out a category whose refunds outweigh it, so it adds up to the total only when none does)
        if (b.byCategory.length && allLines(s).every((l) => !(Number(l.amount) > 0) || l.transferId || /^income|^$/.test(l.category ?? ""))) near(sum(b.byCategory, (c) => c.total), b.total, `${w} categories`);
        near(sum(b.daily, (x) => x.total), sum(a.daily, (x) => x.total), `${w} days`);
        near(sum(b.topPayees, (x) => x.total), sum(a.topPayees, (x) => x.total), `${w} payees`);
        assert.deepEqual(b.topPayees.map((x) => [x.payee, x.count]).sort(), a.topPayees.map((x) => [x.payee, x.count]).sort(), `${w} payee counts`);
        assert.deepEqual(b.biggest.map((x) => [x.id, x.amount]), a.biggest.map((x) => [x.id, x.amount]), `${w} biggest lines are whole purchases`);
        if (a.previous) near(b.previous.total, a.previous.total, `${w} the month before`);
      }
      { const a = watchChoices(plan), b = watchChoices(s); assert.deepEqual(b.payees, a.payees, `${name} shops to watch`); }

      // Budget: what the month spent, in envelopes or outside them
      for (const month of monthsOf(plan)) {
        const a = budget(plan, { today: T, month }), b = budget(s, { today: T, month });
        near(sum(b.envelopes, (e) => e.spent) + sum(b.unbudgeted, (u) => u.spent), sum(a.envelopes, (e) => e.spent) + sum(a.unbudgeted, (u) => u.spent), `${name} budget ${month}`);
      }

      // Income statement: every month's in, out, count; the categories add up
      { const a = incomeStatement(plan, { today: T }), b = incomeStatement(s, { today: T });
        assert.deepEqual(b.rows.map((r) => [r.ym, r.count, r.uncategorised]), a.rows.map((r) => [r.ym, r.count, r.uncategorised]), `${name} income statement counts`);
        a.rows.forEach((r, i) => { near(b.rows[i].in, r.in, `${name} ${r.ym} in`); near(b.rows[i].out, r.out, `${name} ${r.ym} out`); });
        near(b.totals.in, a.totals.in, `${name} in`); near(b.totals.out, a.totals.out, `${name} out`);
        for (const side of ["in", "out"]) near(sum(b.byCategory[side], (c) => c.total), sum(a.byCategory[side], (c) => c.total), `${name} ${side} by category`);
        const x = bankVsPlan(plan, { today: T }), y = bankVsPlan(s, { today: T });
        assert.equal(x === null, y === null); if (x) { near(y.bankOut, x.bankOut, `${name} bank against plan`); assert.equal(y.months, x.months); } }

      // Categories: the totals add up to the filed transactions; the count of unfiled ones is as it was
      { const a = categories(plan), b = categories(s);
        near(sum(b.categories, (c) => c.total), sum(a.categories, (c) => c.total), `${name} categories`);
        assert.equal(b.uncategorised, a.uncategorised); assert.equal(b.total, a.total); }

      // Export: one row per part, the amounts adding up to the transactions
      { const tx = DATASETS.find((d) => d.id === "transactions"), a = tx.build(plan, T), b = tx.build(s, T);
        assert.equal(b.rows.length, a.rows.length + n); near(sum(b.rows, (r) => r[3]), sum(a.rows, (r) => r[3]), `${name} export`);
        assert.equal(b.rows.filter((r) => r[7]).length, 2 * n); }
    }
    assert.ok(splitCount >= 300, `${splitCount} purchases split`);
  });
}

// the pages that read whole transactions (they never look at the parts): the purchase is what it was to them, so nothing
// can be counted twice. `other` keeps the purchase's own category the biggest part, which is the one it carries.
const WHOLE = ["cashflow/statement", "cashflow/recurring", "cashflow/subscriptions", "cashflow/forecast", "cashflow/sinking-funds", "transactions/categorize", "transactions/rules", "transactions/transfers",
  "transactions/reconcile", "transactions/import", "transactions/statements", "ai/categorizer", "ai/notes", "overview/guesses", "household/calendar", "investments/performance"];
test("the pages that read whole transactions give byte-identical output for a split purchase: it is one purchase to them", () => {
  const have = new Map(READERS);
  const ids = WHOLE.filter((id) => have.has(id));
  assert.ok(ids.length >= 10, `${ids.length}: ${ids}`);
  assert.ok(ids.includes("cashflow/statement") && ids.includes("transactions/categorize") && ids.includes("ai/categorizer"));
  for (const { name, plan } of PLANS) {
    const s = splitSome(plan, "other");
    for (const id of ids) assert.equal(out(have.get(id), s), out(have.get(id), plan), `${name} ${id}`);
  }
});

test("tags change no figure: every reader gives the same output but for the tags themselves; Where the money goes adds the Tags figures", () => {
  for (const [at, { name, plan }] of PLANS.entries()) {
    const tagged = tagSome(plan);
    if (!tagged.transactions.some((t) => (t.tags ?? []).length)) continue;
    const strip = (s) => s.replace(/"tags":\[[^\]]*\]/g, '"tags":[]');
    for (const [id, compute] of READERS) {
      if (at % 2 || SIZE_ONLY.has(id) || id === "cashflow/spending" || id === "ai/explain") continue;   // every other household: it takes time
      assert.equal(strip(out(compute, tagged)), strip(out(compute, plan)), `${name} ${id}`);
    }
    // Where the money goes: the same but for `tags`, whose figures are worked out from the same lines
    for (const month of monthsOf(plan)) {
      const a = spending(plan, { today: T, month }), b = spending(tagged, { today: T, month });
      const { tags, ...rest } = b;
      assert.equal(strip(JSON.stringify(rest)), strip(JSON.stringify(a)), `${name} spending ${month}`);
      const trip = tags.find((t) => t.tag === "trip");
      const mine = tagged.transactions.filter((t) => (t.tags ?? []).includes("trip"));
      near(trip.all, -sum(mine, (t) => t.amount), `${name} #trip in all`);
      near(trip.total, -sum(mine.filter((t) => String(t.date).slice(0, 7) === month), (t) => t.amount), `${name} #trip in ${month}`);
      assert.equal(trip.allCount, mine.length);
      // split as well: the tag's figures do not move
      const both = spending(splitSome(tagged, "other"), { today: T, month }).tags.find((t) => t.tag === "trip");
      near(both.total, trip.total, `${name} #trip, split`); near(both.all, trip.all, `${name} #trip in all, split`); assert.equal(both.count, trip.count); assert.equal(both.allCount, trip.allCount);
    }
  }
});
