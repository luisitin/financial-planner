// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, firstYear } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("withdrawal-strategy: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("firstYear: how much comes out of savings in the first year of retirement, from where, and what it pays for", async () => {
  const { firstYear } = await import("./compute.js");
  const { compute: projection } = await import("../projection/compute.js");
  const today = "2026-11-02";
  const plan = retirementPlan();
  const fy = firstYear(plan, { today });
  const p = projection(plan, { today });
  const r = p.rows.find((x) => x.retired);
  assert.equal(fy.year, r.year); assert.equal(fy.thisYear, false);
  const real = (n) => n / r.priceLevel;
  const out = Object.values(r.withdrawn).reduce((t, x) => t + x, 0);
  assert.ok(Math.abs(fy.fromSavings - real(out)) < 0.01, "everything taken out that year");
  assert.ok(Math.abs(fy.need - Math.max(0, r.spendingReal + real(r.eventOut) + real(r.taxes) - r.incomeReal)) < 0.01, "spending + one-offs + tax - guaranteed income");
  assert.ok(Math.abs(fy.extra - Math.max(0, fy.fromSavings - fy.need)) < 0.01);
  // in the engine's order: cash first, then the plan's withdrawal order; each with its accounts' names
  const order = ["cash", "taxable", "deferred", "free"];
  assert.deepEqual(fy.buckets.map((b) => b.bucket), order.filter((b) => r.withdrawn[b] > 0.5));
  if (fy.buckets[0]?.bucket === "cash") assert.deepEqual(fy.buckets[0].accounts, ["Checking", "Savings"]);
  assert.ok(Math.abs(fy.affordable - p.affordable) < 0.01);
  // a retired couple whose income covers the spending: only the required withdrawal comes out, and it is all extra
  const old = retirementPlan();
  old.household.people[0].birthDate = "1950-03-10"; old.household.people[0].retirementAge = 62;
  old.household.people[1].birthDate = "1951-06-20"; old.household.people[1].retirementAge = 62;
  old.income = [{ id: "ss", name: "Sam's Social Security", type: "social", personId: "sam", amount: 6000, period: "monthly" }, { id: "pen", name: "Lee's pension", type: "pension", personId: "lee", amount: 2000, period: "monthly" }];
  old.retirement.contributions = []; old.retirement.pensions = []; old.retirement.socialSecurity = {};
  old.retirement.spendingMonthly = 4000;
  const o = firstYear(old, { today });
  assert.equal(o.year, 2026); assert.equal(o.thisYear, true);
  assert.ok(o.need < 0.5, "income covers the spending");
  assert.ok(o.required > 1000 && Math.abs(o.fromSavings - o.required) < 0.01, "the required withdrawal is all that comes out");
  assert.deepEqual(o.sources, ["Social Security", "pension"]);
  // not ready: null
  assert.equal(firstYear(emptyPlan(), { today }), null);
});

// ---- round 8 (2026-11-06) ---------------------------------------------------------------------------------------------------
import { widowPlan } from "../../../qa/fixtures/widow-plan.mjs";
import { migrate } from "../../../core/schema/migrate.js";
import { federalTax, paramsFor } from "../../../core/math/tax.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
import { compute as projectionOf } from "../projection/compute.js";
const TODAY8 = "2026-11-06";
/** A stand-in for core/ui good enough to read a page's words and its buttons (functions and attributes are not text). */
function fakeUi() {
  const buttons = [];
  const node = (tag, kids) => { const x = { tag, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false && typeof c !== "function") x.kids.push(c); }, replaceChildren(...k) { x.kids = []; x.append(...k); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent ?? "" : String(c))).join(" "); }, style: {}, offsetHeight: 0 }; x.append(...kids); return x; };
  const isNode = (a) => a && typeof a === "object" && "kids" in a;
  const ui = new Proxy({
    h: (tag, attrs, ...k) => node(tag, attrs && typeof attrs === "object" && !Array.isArray(attrs) && !isNode(attrs) ? k : [attrs, ...k]),
    button: (label, fn) => { const b = node("button", [label]); b.click = fn; buttons.push(b); return b; },
  }, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => x === null || typeof x !== "object" || Array.isArray(x) || isNode(x)))) });
  return { ui, buttons };
}
async function page(plan) {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui, buttons } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  let saved = null;
  // no server here: the careful (9 of 10 markets) figure never arrives, so the average-market sentence stays
  render(root, { ui, fmt: { ...fmt, today: () => TODAY8 }, plan, store: { update: (fn) => { saved = structuredClone(plan); fn(saved); } }, api: null, server: null });
  return { text: root.textContent, buttons, saved: () => saved };
}

test("round 8 (widow-2): the tax on the required withdrawal is what it adds to the year's federal tax, not the plan's 15%", async () => {
  const fy = firstYear(migrate(widowPlan()), { today: TODAY8 });
  const P = paramsFor(FEDERAL, 2026, { inflation: 0.03 });
  const tax = (ordinary) => federalTax({ filingStatus: "single", otherOrdinary: ordinary, socialSecurity: 27600, ages65plus: 1 }, P).totalTax;
  // 3,964.61 with the $16,078.43 withdrawal, 536 without (by hand in rmd/module.test.mjs): about $3,429, not 15% ($2,412)
  assert.ok(Math.abs(fy.requiredTax - (tax(22800 + fy.required) - tax(22800))) < 0.01, String(fy.requiredTax));
  assert.equal(Math.round(fy.requiredTax), 3429);
  const { text } = await page(migrate(widowPlan()));
  assert.ok(/after about \$3,429 of tax on it/.test(text), text.slice(0, 700));
});

test("round 8 (widow-1): each way says what it takes from savings and what you spend; 'Use this one' never plans on less than you spend", async () => {
  const d = compute(migrate(widowPlan()), { today: TODAY8 });
  const by = Object.fromEntries(d.rows.map((r) => [r.key, r]));
  // a share of what is left: 4% of the $422,000 of savings is $16,880 taken; with $50,400 of income, about $67,280 before tax
  assert.equal(by.percent.first.rule, "share"); assert.equal(by.percent.first.beforeTax, true);
  assert.ok(Math.abs(by.percent.first.take - 16880) < 0.01 && Math.abs(by.percent.first.spend - 67280) < 0.01, JSON.stringify(by.percent.first));
  assert.ok(Math.abs(by.percent.first.income - 50400) < 0.01);
  // the same spending every year: the law's $16,078 comes out, you spend your $36,000
  assert.equal(by["fixed-real"].first.rule, "spend");
  assert.ok(Math.abs(by["fixed-real"].first.take - 410000 / 25.5) < 0.01 && Math.abs(by["fixed-real"].first.spend - 36000) < 0.01);
  // held: the share ways plan on less than the $36,000 she spends; guardrails plans on less than her $50,400 of income
  assert.equal(by.percent.offer, false); assert.equal(by.percent.held, "below-spending");
  assert.equal(by.vpw.offer, false); assert.equal(by.vpw.held, "below-spending");
  assert.equal(by.guardrails.offer, false); assert.equal(by.guardrails.held, "below-income");
  assert.equal(by["fixed-real"].held, null);
  const { text, buttons } = await page(migrate(widowPlan()));
  assert.equal(buttons.filter((b) => /Use this one/.test(b.textContent)).length, 0, "nothing below what she spends is offered");
  assert.ok(/take about \$16,880 from savings/.test(text) && /\$67,280/.test(text), text);
  // already on a share of what is left (the tester tapped it before): said at the top, and the way back is offered
  const pct = migrate(widowPlan()); pct.retirement.strategy = "percent";
  const p2 = await page(pct);
  assert.ok(/Your plan uses "A share of what is left"/.test(p2.text), p2.text.slice(0, 600));
  const back = p2.buttons.filter((b) => /Use this one/.test(b.textContent));
  assert.equal(back.length, 1); back[0].click(); assert.equal(p2.saved().retirement.strategy, "fixed-real");
});

test("round 8 (widow-1, review D2): on every qa plan, a way offered never makes the plan spend less than it plans on, or in any year less than its income", async () => {
  const plans = [];
  for (const f of ["family-plan", "retirement-plan", "tax-plan", "retired-couple-plan", "widow-plan", "sample-plan", "investments-plan", "guessed-plan", "card-gap-plan", "held-plan", "debt-plan", "retiree-cases"]) {
    const m = await import(`../../../qa/fixtures/${f}.mjs`);
    for (const fn of Object.values(m)) if (typeof fn === "function") { try { const p = fn(); if (p?.household) plans.push([f, p]); } catch { /* a helper, not a plan */ } }
  }
  let offered = 0;
  for (const [name, p] of plans) {
    const d = compute(migrate(structuredClone(p)), { today: TODAY8 });
    if (!d.ready) continue;
    for (const r of d.rows.filter((x) => x.offer && x.key !== "fixed-real")) {
      offered++;
      const q = migrate(structuredClone(p)); q.retirement = { ...(q.retirement ?? {}), strategy: r.key };
      const pr = projectionOf(q, { today: TODAY8 });
      const first = pr.rows.find((x) => x.retired);
      assert.ok(first.spendingReal >= pr.spendingYearly - 0.5, `${name} ${r.key}: plans on ${first.spendingReal} against ${pr.spendingYearly}`);
      // every retired year, not only the first (round 8 review D2: guardrails cut a household to $859 a year under $56,208 of income)
      for (const x of pr.rows.filter((y) => y.retired)) assert.ok(x.incomeReal <= x.spendingReal + 0.5, `${name} ${r.key} ${x.year}: income ${x.incomeReal} over spending ${x.spendingReal}`);
    }
  }
  assert.ok(offered > 0, "some plan offers another way");
});

// ---- round 8, Batch 5 reviews (2026-11-06): qa/fixtures/retiree-cases.mjs ------------------------------------------------------
import { guardRetiree, taxedDrawRetiree, shortSavingsRetiree } from "../../../qa/fixtures/retiree-cases.mjs";
const fmtMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
test("round 8 review D2: guardrails that cut spending below the year's income in a later year is not offered, and says when", async () => {
  // Rae: $45,000 of pension and Social Security, $50,000 of spending, a $500,000 IRA. Her savings pay about $5,000 a year, but
  // the engine tests all $50,000 against her savings and cuts from 2027: $43,689 against $44,563 of income (today's dollars)
  const d = compute(migrate(guardRetiree()), { today: TODAY8 });
  const g = d.rows.find((r) => r.key === "guardrails");
  assert.equal(g.held, "below-income"); assert.equal(g.offer, false);
  assert.equal(g.under?.year, 2027);
  assert.ok(Math.abs(g.under.spending - 43689) < 1 && Math.abs(g.under.income - 44563) < 1, JSON.stringify(g.under));
  const { text, buttons } = await page(migrate(guardRetiree()));
  assert.ok(/in 2027 it plans on \$43,689 of spending, less than your \$44,563 of income/.test(text), text);
  assert.equal(buttons.filter((b) => /Use this one/.test(b.textContent)).length, d.rows.filter((r) => r.offer).length);
  // already on guardrails: the notice says the same, and the answer is for the $50,000 she spends
  const gr = migrate(guardRetiree()); gr.retirement.strategy = "guardrails";
  const p2 = await page(gr);
  assert.ok(/Your plan uses "Guardrails": the planner works this way out as if your income were not there, so in 2027 it plans on \$43,689 of spending, less than your \$44,563 of income, and as low as \$25,468\. The answer below is for the \$50,000 you spend/.test(p2.text), p2.text.slice(0, 700));
});
test("round 8 review D6 and UX 1: each way's first line adds up, names the tax and the health cover, and says 'you spend' only of the row's own spending", async () => {
  // Rae with $24,000 of Social Security and a $900,000 IRA, $60,000 of spending: $48,507 from savings pays for $60,000 of
  // spending, $5,231 of health cover and $7,276 of tax (48,507 + 24,000 = 72,507 = 60,000 + 5,231 + 7,276)
  const d = compute(migrate(taxedDrawRetiree()), { today: TODAY8 });
  const f = d.rows.find((r) => r.key === "fixed-real").first;
  assert.ok(Math.abs(f.spend - d.rows[0].expected.firstYear) < 0.01, "the row's own spending figure");
  assert.ok(Math.abs(f.take + f.income - (f.spend + f.health + f.other + f.tax)) < 0.01, JSON.stringify(f));
  assert.ok(Math.abs(f.tax - 7276) < 1 && Math.abs(f.take - 48507) < 1, JSON.stringify(f));
  const { text } = await page(migrate(taxedDrawRetiree()));
  assert.ok(/take about \$48,507 from savings; with your \$24,000 of income, that pays for the \$60,000 you spend, \$5,231 of health cover and about \$7,276 of tax\./.test(text), text);
  // on every qa fixture, a spend line's "you spend" figure is the row's own first-year spending
  for (const f2 of ["family-plan", "retirement-plan", "retired-couple-plan", "widow-plan", "retiree-cases"]) {
    const m = await import(`../../../qa/fixtures/${f2}.mjs`);
    for (const fn of Object.values(m)) {
      let p; try { p = fn(); } catch { continue; }
      if (!p?.household) continue;
      const dd = compute(migrate(structuredClone(p)), { today: TODAY8 });
      if (!dd.ready) continue;
      for (const r of dd.rows) if (r.first && !r.first.beforeTax) assert.ok(Math.abs(r.first.spend - r.expected.firstYear) < 0.01, `${f2} ${fn.name} ${r.key}`);
    }
  }
});
test("round 8 review UX 1: a first year whose savings run short says how much of the year's need they cover, on the way and in the answer", async () => {
  // Cy: $20,000 of savings, $42,000 of spending, $15,927 of health cover and $1,800 of tax: savings cover $20,000 of $59,727
  const { text } = await page(migrate(shortSavingsRetiree()));
  assert.ok(/This year: savings have only about \$20,000 left; that covers about \$20,000 of the \$59,727 the year needs\./.test(text), text);
  assert.ok(!/that pays for the \$42,000 you plan to spend/.test(text), "the answer no longer says it is all paid for");
  assert.ok(/covers about \$20,000 of the \$59,727 the year needs: the \$42,000 you plan to spend, \$15,927 of health cover and about \$1,800 of tax\./.test(text), text);
});
test("round 8 review D7 and UX 2: the widow's ways say what goes back and compare the same kind of figure, and the ways not offered are folded", async () => {
  const { text } = await page(migrate(widowPlan()));
  assert.ok(/This year: take about \$16,078 from savings \(the least the law allows\); your \$50,400 of income already pays for the \$36,000 you spend, so the withdrawal, less its tax, goes back into savings\./.test(text), text);
  assert.ok(!/and the rest goes back into savings/.test(text));
  // every row's figure beside its name is what it takes from savings in the first year
  for (const [name, take] of [["Same spending every year", 16078], ["A share of what is left", 16880], ["Guardrails", 16078], ["Spend what the years left can afford", 24391]])
    assert.ok(new RegExp(`${name} (chosen )?\\${fmtMoney(take)} from savings`).test(text), `${name}: ${text}`);
  assert.ok(!/Amounts are yearly spending/.test(text));
  assert.ok(/Beside each way: what it takes from savings in the first year/.test(text));
  assert.ok(/Ways that don't fit your plan yet \(3\)/.test(text), text);
  assert.ok(/Not offered yet: the planner can only work this way out as if \$16,880 were all you spend, without your \$50,400 of income, so it would plan your retirement on the wrong figure\./.test(text), text);
});
test("round 8 review UX 6: with a way not offered already chosen, the answer is for what the household spends", async () => {
  const pct = migrate(widowPlan()); pct.retirement.strategy = "percent";
  const { text } = await page(pct);
  assert.ok(/cover the \$36,000 you plan to spend/.test(text), text.slice(0, 900));
  assert.ok(!/the \$16,880 you plan to spend/.test(text));
  assert.ok(/The answer below is for the \$36,000 you spend/.test(text));
});
test("round 8 review UX 7: the ways the projection's settings offer are the ways this page offers, plus the one chosen", async () => {
  const m = await import("./compute.js");
  assert.equal(typeof m.heldWays, "function"); assert.equal(typeof m.wayOptions, "function");
  const w = migrate(widowPlan());
  assert.deepEqual(m.heldWays(projectionOf(w, { today: TODAY8 }).inputs), { "fixed-real": null, percent: "below-spending", guardrails: "below-income", vpw: "below-spending" });
  assert.deepEqual(m.wayOptions(w, { today: TODAY8 }).map((o) => o.value), ["fixed-real"]);
  const pct = migrate(widowPlan()); pct.retirement.strategy = "percent";
  assert.deepEqual(m.wayOptions(pct, { today: TODAY8 }).map((o) => o.value), ["fixed-real", "percent"], "the chosen one stays");
  for (const p of [migrate(retirementPlan()), migrate(guardRetiree())]) {
    const d = compute(p, { today: TODAY8 });
    assert.deepEqual(m.wayOptions(p, { today: TODAY8 }).map((o) => o.value).sort(), d.rows.filter((r) => r.offer || r.key === d.chosen).map((r) => r.key).sort());
  }
});
