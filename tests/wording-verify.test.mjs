// tests/wording-verify.test.mjs -- what the final check of the wording follow-up (2026-11-07) found unfinished, pinned as a
// person reads it: the goals line on Your plan says what the Dashboard says (w017), what a retirement page still needs is said
// in the same words on every page (l001), no cash is said in words, a name keeps its capital, the April deadline moves past a
// weekend or holiday, and an estimate is said at $10 while a month figure is to the dollar (n01).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pageText } from "../qa/fixtures/fake-dom.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { guardRetiree, taxedDrawRetiree, bridgeCouple } from "../qa/fixtures/retiree-cases.mjs";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { goalsWords } from "../modules/overview/plan/words.js";
import { compute as planOf } from "../modules/overview/plan/compute.js";
import { compute as benchmarksOf } from "../modules/overview/benchmarks/compute.js";
import { compute as healthOf } from "../modules/overview/health-score/compute.js";
import { compute as timelineOf } from "../modules/overview/timeline/compute.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const T = "2026-11-07";
const computeOf = {};
for (const g of fs.readdirSync(path.join(ROOT, "modules"))) {
  if (g.startsWith("_") || !fs.statSync(path.join(ROOT, "modules", g)).isDirectory()) continue;
  for (const id of fs.readdirSync(path.join(ROOT, "modules", g))) {
    const f = path.join(ROOT, "modules", g, id, "compute.js");
    if (!fs.existsSync(f)) continue;
    try { const m = await import(pathToFileURL(f).href); if (m.compute) computeOf[`${g}/${id}`] = m.compute; } catch { /* a page that needs the browser */ }
  }
}
const text = (page, plan = familyPlan(T), today = T) => pageText(new URL(`../modules/${page}/view.js`, import.meta.url), migrate(structuredClone(plan)), today, { computeOf, computeRemote: computeOf });
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

test("w017: Your plan's goals line is the Dashboard's sentence (who needs it, a semicolon between parts)", () => {
  assert.equal(goalsWords({ count: 2, done: 1 }, { behind: [{}], need: 120 }, money), "1 reached; 1 goal behind (it needs about $120 more a month)");
  assert.equal(goalsWords({ count: 4, done: 0 }, { behind: [{}, {}, {}], need: 1659, queued: [{}], turn: "2026-12" }, money), "3 goals behind (they need about $1,659 more a month); 1 starts in December 2026");
  assert.equal(goalsWords({ count: 1, done: 0 }, { behind: [{}], need: 0.4 }, money), "1 goal behind");
});

test("Your plan: no cash at all is said in words, never 'about 0 months'", () => {
  const d = planOf(migrate(taxedDrawRetiree()), { today: T });
  const s = JSON.stringify(d);
  assert.ok(s.includes("No cash set aside yet for the bills you have to pay. Aim for 6 months."), s.match(/.{60}Aim for.{20}/)?.[0]);
  assert.match(d.head.inShort, /^In short: no cash set aside for bills yet \(the aim is 6 months\)/);
  assert.ok(!/about 0 months/.test(s));
});

test("Your plan: a tax answer that starts with a name keeps its capital ('Bo owes', filing separately)", () => {
  const p = familyPlan(T); p.household.filingStatus = "married_separate";
  const d = planOf(migrate(p), { today: T });
  assert.match(d.head.inShort, /and Bo owes about \$[\d,]+; Ana gets about \$[\d,]+ back\./);
  assert.ok(!d.head.inShort.includes("bo owes"));
});

test("l001: every retirement page that cannot run yet names what it needs in the same words", async () => {
  const pages = ["insurance/ltc", "insurance/life-needs", "scenarios/goal-seek", "scenarios/stress-tests", "scenarios/sensitivity", "scenarios/compare", "reports/retirement", "retirement/historical", "overview/health-score"];
  for (const p of pages) {
    const t = await text(p, emptyPlan());
    assert.ok(t.includes("a birth date on the People page"), `${p}: ${t.slice(0, 300)}`);
    assert.ok(t.includes("what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"), p);
    assert.ok(!t.includes("a person with a birth date") && !t.includes("a figure here, or your expenses"), `${p} still shows the projection's own words`);
  }
  assert.match(await text("retirement/historical", emptyPlan()), /First, the plan needs three things: a birth date on the People page, your accounts on the Net worth page, and what you will spend in retirement \(on the Expenses page, or on the Will the money last\? page\)\./);
  // Monte Carlo needs the shell to render: its notice is built from the same helper, never "...first: see Will the money last?."
  const mc = fs.readFileSync(path.join(ROOT, "modules/retirement/monte-carlo/view.js"), "utf8");
  assert.ok(mc.includes('needsWords("First, the plan needs", d.missing)') && !mc.includes('["see Will the money last?"]'));
  const hs = healthOf(migrate(emptyPlan()), { today: T });
  assert.ok(JSON.stringify(hs).includes("Add a birth date on the People page, your accounts on the Net worth page and what you will spend in retirement (on the Expenses page, or on the Will the money last? page)."));
  const p = familyPlan(T); p.expenses = []; p.accounts = []; for (const k of ["spendingYearly", "spendingMonthly", "spending"]) if (p.retirement) delete p.retirement[k];
  assert.deepEqual(timelineOf(migrate(p), { today: T }).notes, ["Add your accounts on the Net worth page and what you will spend in retirement (on the Expenses page, or on the Will the money last? page) to see your savings and whether the money lasts."]);
});

test("HSA: the April deadline for a tax year moves past a weekend or holiday ('April 18, 2028' for 2027)", async () => {
  assert.match(await text("taxes/hsa-fsa"), /\(for 2026, until April 15, 2027\)/);
  const t27 = await text("taxes/hsa-fsa", familyPlan("2027-11-07"), "2027-11-07");
  assert.match(t27, /\(for 2027, until April 18, 2028\)/);
  assert.ok(!t27.includes("April 15, 2028"));
});

test("n01: what the plan can carry is an estimate at $10; the month planned is to the dollar", () => {
  const d = benchmarksOf(migrate(guardRetiree()), { today: T });
  const s = JSON.stringify(d);
  assert.match(s, /it can carry about \$[\d,]+0 a month against the \$[\d,]+ planned/);
  assert.ok(s.includes("about $4,720 a month against the $4,167 planned"), s.match(/can carry.{60}/)?.[0]);
});

test("Plan summary asks the retirement question as Will the money last? does, and the sensitivity month is to the dollar", async () => {
  const ps = fs.readFileSync(path.join(ROOT, "modules/reports/plan-summary/view.js"), "utf8");
  assert.ok(ps.includes('r.unknown ? ["Does the money last?", "Not known yet"]'));
  const t = await text("scenarios/sensitivity");
  assert.match(t, /the plan can pay for about \$8,430 a month of spending, after inflation, against the \$7,000 it plans\./);
  const sv = fs.readFileSync(path.join(ROOT, "modules/scenarios/sensitivity/view.js"), "utf8");
  assert.ok(sv.includes("against the ${fmt.money(Math.round(d.base.spendingMonthly), cur)} it plans."), "the month planned is to the dollar");
});

test("Your plan: a money that only just lasts reads as one phrase inside In short", () => {
  const a = planOf(migrate(bridgeCouple(T)), { today: T }).head.inShort;
  assert.match(a, /, the money only just lasts and you owe about \$[\d,]+ in April\./, a);
  assert.match(planOf(migrate(guardRetiree(T)), { today: T }).head.inShort, /and the money only just lasts\.$/);
  assert.ok(!/lasts, just/.test(a));
});

test("l007: what the federal estimate counts and what it leaves out are two sentences", async () => {
  const t = await text("taxes/federal");
  assert.match(t, /It counts the child tax credit and the child care credit\. It leaves out the alternative minimum tax, the earned income and education credits, the credit for caring for an adult who cannot look after themselves, and state tax\./);
  assert.ok(!t.includes("; it leaves out"));
});
