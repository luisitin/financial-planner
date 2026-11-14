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
/** The words of every node outside a fold (<details>): what the page says before anything is opened. */
const outside = (n) => (n && typeof n === "object" ? (n.tag === "details" ? "" : (n.kids ?? []).map(outside).join(" ")) : String(n ?? ""));
/** The words of the fold whose summary says `title`. */
const foldText = (root, title) => { let hit = ""; const walk = (n) => { if (!n || typeof n !== "object") return; if (n.tag === "details" && new RegExp(title).test(n.textContent)) hit = n.textContent; (n.kids ?? []).forEach(walk); }; root.kids.forEach(walk); return hit.replace(/\s+/g, " "); };
async function page(plan) {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui, buttons } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  let saved = null;
  // no server here: the careful (9 of 10 markets) figure never arrives, so the average-market sentence stays
  render(root, { ui, fmt: { ...fmt, today: () => TODAY8 }, plan, store: { update: (fn) => { saved = structuredClone(plan); fn(saved); } }, api: null, server: null });
  return { text: root.textContent, first: root.kids.map(outside).join(" ").replace(/\s+/g, " "), fold: (t) => foldText(root, t), buttons, saved: () => saved };
}

test("round 8 (widow-2): the tax on the required withdrawal is what it adds to the year's federal tax, not the plan's 15%", async () => {
  const fy = firstYear(migrate(widowPlan()), { today: TODAY8 });
  const P = paramsFor(FEDERAL, 2026, { inflation: 0.03 });
  const tax = (ordinary) => federalTax({ filingStatus: "single", otherOrdinary: ordinary, socialSecurity: 27600, ages65plus: 1 }, P).totalTax;
  // 3,964.61 with the $16,078.43 withdrawal, 536 without (by hand in rmd/module.test.mjs): about $3,429, not 15% ($2,412)
  assert.ok(Math.abs(fy.requiredTax - (tax(22800 + fy.required) - tax(22800))) < 0.01, String(fy.requiredTax));
  assert.equal(Math.round(fy.requiredTax), 3429);
  const { text } = await page(migrate(widowPlan()));
  // batch 5b UX review 9: the figure left after that tax, said plainly; the fold names the plan's flat 15% as such, beside the real figure
  assert.ok(/About \$12,650 of it is left after tax: it can go into a savings or investment account\./.test(text), text.slice(0, 900));
  const fold = (await page(migrate(widowPlan()))).fold("How this is worked out");
  assert.ok(/The tax in each way is the plan's flat 15% on money from pre-tax accounts \(Retirement settings\)\. This year's required withdrawal really adds about \$3,429: Required withdrawals works it out\./.test(fold), fold.slice(0, 900));
});

// ---- round 8, Batch 5b (2026-11-06): the owner's answer, "You can do as you please. Just make sure a layman can easily understand
// and use the page": the share, years-left and guardrail ways spend guaranteed income on top of their own withdrawal ------------
import { guardRetiree, taxedDrawRetiree, shortSavingsRetiree, bridgeCouple, earlyRetiree } from "../../../qa/fixtures/retiree-cases.mjs";
import { guardOf, heldWays, wayOptions } from "./compute.js";
const fmtMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

test("5b (widow-1): the widow's share way takes $16,880 from savings and spends about $67,280 before tax; every way is offered", () => {
  const d = compute(migrate(widowPlan()), { today: TODAY8 });
  const by = Object.fromEntries(d.rows.map((r) => [r.key, r]));
  // 4% of her $12,000 + $410,000 = $16,880 taken; with $50,400 of income, $67,280 before tax: the law's $16,078.43 at the plan's
  // flat 15% is $2,411.76 of tax, so $64,868.24 to spend (was $16,880 of "spending" and not offered)
  const p = by.percent.first;
  assert.ok(Math.abs(p.take - 16880) < 0.01 && Math.abs(p.income - 50400) < 0.01, JSON.stringify(p));
  assert.ok(Math.abs(p.spend + p.tax + p.health - 67280) < 0.01 && Math.abs(p.tax - 0.15 * 410000 / 25.5) < 0.01, JSON.stringify(p));
  assert.ok(Math.abs(p.spend - 64868.24) < 0.01);
  // spend what the years left can afford: the same $24,391.28 taken as before (verify.md: 422,000 over 22 years at 2.43%), now on
  // top of the income: 50,400 + 24,391.28 - 2,411.76 = $72,379.52
  assert.ok(Math.abs(by.vpw.first.take - 24391.28) < 0.01 && Math.abs(by.vpw.first.spend - 72379.52) < 0.01, JSON.stringify(by.vpw.first));
  // guardrails: her income pays for the $36,000 she plans and the tax, so nothing is drawn for spending and none is cut: she
  // spends all of it after tax, 50,400 - 2,411.76 = $47,988.24, and the law's whole $16,078.43 goes back into savings
  const g = by.guardrails.first;
  assert.ok(Math.abs(g.spend - 47988.24) < 0.01 && Math.abs(g.back - 410000 / 25.5) < 0.01 && g.need < 0.01, JSON.stringify(g));
  assert.ok(by.guardrails.expected.lowest >= 36000 - 0.5, "never cut below what she plans while her income covers it");
  // the same spending every year is unchanged: $36,000, and the withdrawal less its tax goes back: 16,078.43 - 2,411.76
  assert.ok(Math.abs(by["fixed-real"].first.spend - 36000) < 0.01 && Math.abs(by["fixed-real"].first.back - 13666.67) < 0.01);
  for (const k of ["percent", "guardrails", "vpw"]) { assert.equal(by[k].held, null, k); assert.equal(by[k].offer, true, k); }
  assert.equal(by["fixed-real"].offer, false, "already hers");
  assert.deepEqual(heldWays(projectionOf(migrate(widowPlan()), { today: TODAY8 }).inputs), { "fixed-real": null, percent: null, guardrails: null, vpw: null });
  assert.deepEqual(wayOptions(migrate(widowPlan()), { today: TODAY8 }).map((o) => o.value), ["fixed-real", "percent", "guardrails", "vpw"]);
});

test("5b: on every qa plan, no way plans spending, health insurance and tax below the year's guaranteed income, and every way the engine runs is offered", async () => {
  const plans = [];
  for (const f of ["family-plan", "retirement-plan", "tax-plan", "retired-couple-plan", "widow-plan", "sample-plan", "investments-plan", "guessed-plan", "card-gap-plan", "held-plan", "debt-plan", "retiree-cases"]) {
    const m = await import(`../../../qa/fixtures/${f}.mjs`);
    for (const fn of Object.values(m)) if (typeof fn === "function") { try { const p = fn(); if (p?.household) plans.push([f, p]); } catch { /* a helper, not a plan */ } }
  }
  let offered = 0;
  for (const [name, p] of plans) {
    const d = compute(migrate(structuredClone(p)), { today: TODAY8 });
    if (!d.ready) continue;
    for (const r of d.rows.filter((x) => x.key !== "fixed-real")) {
      assert.equal(r.held, null, `${name} ${r.key}`);
      if (!r.offer) continue;
      offered++;
      const q = migrate(structuredClone(p)); q.retirement = { ...(q.retirement ?? {}), strategy: r.key };
      const pr = projectionOf(q, { today: TODAY8 });
      for (const x of pr.rows.filter((y) => y.retired)) assert.ok((x.spending + x.eventSpending + x.taxes) / x.priceLevel >= x.incomeReal - 0.5, `${name} ${r.key} ${x.year}: ${x.spendingReal} + health + tax under ${x.incomeReal}`);
    }
  }
  assert.ok(offered > 20, String(offered));
});

test("5b: guardrails never cut while income and a small draw cover the plan (Rae: $45,000 of income, $50,000 planned)", () => {
  // before: all $50,000 was tested against her savings and cut from 2027 to $43,689, under her $44,563 of income. Now the
  // draw ($10,271 in 2026: 50,000 + 5,230.68 of health cover + 40.71 of tax - 45,000) is 2% of savings, so her spending stays at
  // $50,000 in today's dollars while her pension, which does not rise with prices, shrinks
  const d = compute(migrate(guardRetiree()), { today: TODAY8 });
  const g = d.rows.find((r) => r.key === "guardrails");
  assert.equal(g.held, null); assert.equal(g.offer, true);
  assert.ok(Math.abs(g.first.take - (50000 + 5230.68 + g.first.tax - 45000)) < 0.01, JSON.stringify(g.first));
  const q = migrate(guardRetiree()); q.retirement.strategy = "guardrails";
  const pr = projectionOf(q, { today: TODAY8 });
  for (const x of pr.rows.filter((y) => y.retired && y.year <= 2040)) assert.ok(Math.abs(x.spendingReal - 50000) < 0.01, `${x.year}: ${x.spendingReal}`);
});

test("5b: the guard stays as a safety net: a run that plans less than its income is held and says so", () => {
  const row = (spending, income, taxes) => ({ year: 2030, retired: true, priceLevel: 1, spending, spendingReal: spending, eventSpending: 0, taxes, income, incomeReal: income });
  assert.deepEqual(guardOf("percent", { rows: [row(60000, 50000, 2000)] }), { held: null, under: null });
  assert.deepEqual(guardOf("percent", { rows: [row(47000, 50000, 2000)] }), { held: "below-income", under: { year: 2030, spending: 47000, income: 50000 } });
  assert.deepEqual(guardOf("fixed-real", { rows: [row(10000, 50000, 0)] }), { held: null, under: null }, "the plan's own figure is never held");
});

test("5b: each way's first year adds up for the three laypeople (widow, the couple retiring at 62, the early retiree)", () => {
  for (const p of [widowPlan(), bridgeCouple(), earlyRetiree(), taxedDrawRetiree()]) {
    const d = compute(migrate(p), { today: TODAY8 });
    for (const r of d.rows) {
      const f = r.first;
      // what comes out of savings and the income pay for the spending, health cover, one-offs and tax, plus what goes back
      const extra = r.key === "fixed-real" ? Math.max(0, f.income - f.spend - f.health) : 0;   // the same spending every year leaves income above its need unspent
      assert.ok(Math.abs(f.take + f.income - (f.spend + f.health + f.other + f.tax + f.back + extra - f.short)) < 0.02, `${p.household.people[0].name} ${r.key} ${JSON.stringify(f)}`);
      assert.ok(Math.abs(f.spend - r.expected.firstYear) < 0.01);
    }
  }
  // the couple at 62, nothing coming in until 2033: 4% of the $15,000 + $560,000 + $200,000 (grown two years) is the share way's draw
  const b = compute(migrate(bridgeCouple()), { today: TODAY8 }).rows.find((r) => r.key === "percent").first;
  assert.equal(b.year, 2028); assert.ok(b.income < 0.5);
  assert.ok(Math.abs(b.spend - (b.take - b.tax - b.health)) < 0.01, JSON.stringify(b));
});

test("5b page: the widow reads the answer first, in plain words, and each way is one line with its figure and one button", async () => {
  const w = await page(migrate(widowPlan()));
  // the first screen: what to take and why, what pays for the year, and nothing technical
  assert.ok(/This year, take about \$16,078 from Ruth's retirement account: the law requires it\./.test(w.first), w.first.slice(0, 900));
  assert.ok(/Your \$50,400 of Social Security and pension already pays for the \$36,000 you spend\./.test(w.first), w.first.slice(0, 900));
  // the 9-in-10 figure fills in after the first paint (a grey bar until then: no server in a test, so it stays a bar)
  assert.ok(/You could spend up to about\s+a month and the money lasts even in a bad run of years \(only 1 in 10 is worse\)\. You plan \$[\d,]+ a month\./.test(w.first), w.first.slice(0, 900));
  for (const word of [/bracket/i, /factor/i, /IRMAA/, /premium tax credit/i, /poverty line/i, /Not offered/, /guardrail tests?/i, /withdrawal rate/i]) assert.ok(!word.test(w.first), `${word} on the first screen`);
  // each way: its name, what it lets you spend a month in the first year, one short line, one button (not on her own way)
  for (const [name, spend] of [["Same spending every year", 36000], ["A share of what is left", 64868.24], ["Trim after bad years", 47988.24], ["Spend what the years left can afford", 72379.52]])
    assert.ok(new RegExp(`${name} (yours )?about \\${fmtMoney(spend / 12)} a month`).test(w.first), `${name}: ${w.first}`);
  const use = w.buttons.filter((b) => /Use this one/.test(b.textContent));
  assert.equal(use.length, 3);
  // the details are in "How this is worked out", and add up
  const how = w.fold("How this is worked out");
  assert.ok(/take about \$16,880 from savings\. With your \$50,400 of income, that pays for the \$64,868 you spend and about \$2,412 of tax\./.test(how), how);
  assert.ok(/Your \$50,400 of income pays for the \$47,988 you spend and about \$2,412 of tax, so all of the withdrawal goes back into savings/.test(how), how);
  // batch 5b UX review 8: one plain name for guardrails; review 6: the card says "spend", not "take"
  assert.ok(!/Guardrails/.test(w.first) && /How much you could spend: four ways A month this year, with your income\./.test(w.first), w.first);
  // UX review 1: each way's risk names the bad stretch of history, on the worse of the two runs
  const d = compute(migrate(widowPlan()), { today: TODAY8 });
  const vpw = d.rows.find((r) => r.key === "vpw");
  assert.ok(vpw.worst.lowest < vpw.expected.lowest);
  assert.ok(new RegExp(`Spend what the years left can afford about \\$6,032 a month What savings can pay over the years left, on top of your income\\. In a bad stretch like the ${Math.floor(d.worstStartYear / 10) * 10}s it falls to about \\${fmtMoney(vpw.worst.lowest / 12)} a month\\.`).test(w.first), w.first);
  assert.ok(new RegExp(`Same spending every year yours about \\$3,000 a month The same each year, raised with prices, whatever markets do\\. Lasts to 95, even in a bad stretch like the ${Math.floor(d.worstStartYear / 10) * 10}s\\.`).test(w.first), w.first);
  // "Use this one" saves the way and nothing else, and the confirmation says what the plan now spends (UX review 5)
  use[2].click();
  assert.equal(w.saved().retirement.strategy, "vpw");
  const after = await page(w.saved());
  assert.ok(/Your plan now spends what the years left can afford: about \$6,032 a month this year \(it was \$3,000\), rising and falling with markets\. Savings are spent down to \$0 by 2047 on purpose\./.test(after.first), after.first.slice(0, 900));
  // with a way that moves, the answer says what it spends and how low it goes, never "the same every year" (UX review 5)
  assert.ok(new RegExp(`This way spends about \\$6,032 a month this year; in a bad stretch like the ${Math.floor(d.worstStartYear / 10) * 10}s it falls to about \\${fmtMoney(vpw.worst.lowest / 12)}\\.`).test(after.first) && !/the same every year/.test(after.first.split("How much you could spend")[0]), after.first.slice(0, 900));
  assert.ok(/Yours moves with markets; "Same spending every year" keeps it steady\./.test(after.first), after.first);
});

test("5b page: the couple retiring at 62 with nothing coming in until 67, and the early retiree with only savings", async () => {
  const c = await page(migrate(bridgeCouple()));
  const fy = firstYear(migrate(bridgeCouple()), { today: TODAY8 });
  assert.ok(new RegExp(`In 2028, your first year of retirement, take about \\${fmtMoney(fy.fromSavings)} from savings\\.`).test(c.first), c.first.slice(0, 900));
  assert.ok(/Take it from Checking first, then Pat's 401\(k\) and Jo's IRA\. Amounts are in today's dollars\./.test(c.first), c.first.slice(0, 900));
  assert.ok(new RegExp(`That pays for the \\$60,000 you plan to spend, \\${fmtMoney(fy.health)} of health insurance and about \\${fmtMoney(fy.taxes)} of tax\\.`).test(c.first), c.first.slice(0, 900));
  const k = await page(migrate(earlyRetiree()));
  const ky = firstYear(migrate(earlyRetiree()), { today: TODAY8 });
  assert.ok(new RegExp(`This year, take about \\${fmtMoney(ky.fromSavings)} from savings\\. That pays for the \\$39,600 you spend and \\${fmtMoney(ky.health)} of health insurance\\. Take it from Checking first, then Brokerage\\.`).test(k.first), k.first.slice(0, 900));
  // with no income, no way is "on top of your income" and the card does not say "with your income"; a way that can fall far says how far
  assert.ok(!/on top of your income|with your income/.test(k.first), k.first);
  assert.ok(/A share of what is left about \$[\d,]+ a month A set share of savings each year, so it moves with markets\. It can fall to about \$[\d,]+ a month\./.test(k.first), k.first);
  // no stray comma where "on top of your income" was taken out (seen on the phone, 2026-11-06)
  assert.ok(/Spend what the years left can afford about \$[\d,]+ a month What savings can pay over the years left\. It can fall to/.test(k.first) && !/,\./.test(k.first), k.first);
  // UX review 1: Kim's own way names the stretch it runs out in, not "Lasts to 95" (the 1966 stretch)
  const kd = compute(migrate(earlyRetiree()), { today: TODAY8 });
  const kf = kd.rows.find((r) => r.key === "fixed-real");
  assert.ok(kf.worst.failAge && kf.worst.failAge < 95);
  assert.ok(new RegExp(`Same spending every year yours about \\$3,300 a month The same each year, raised with prices, whatever markets do\\. In a bad stretch like the ${Math.floor(kd.worstStartYear / 10) * 10}s it runs out at ${kf.worst.failAge}\\.`).test(k.first), k.first);
  // the couple: the same, in their stretch
  const cd = compute(migrate(bridgeCouple()), { today: TODAY8 });
  assert.ok(new RegExp(`Same spending every year yours about \\$5,000 a month The same each year, raised with prices, whatever markets do\\. In a bad stretch like the ${Math.floor(cd.worstStartYear / 10) * 10}s it runs out at ${cd.rows[0].worst.failAge}\\.`).test(c.first), c.first);
  for (const t of [c.first, k.first]) for (const word of [/bracket/i, /factor/i, /Not offered/]) assert.ok(!word.test(t), String(word));
  // Kim trims after bad years: it starts at the same $3,300, so the confirmation does not say "(it was $3,300)" (seen on the phone, 2026-11-06)
  const use = k.buttons.filter((b) => b.textContent === "Use this one");
  assert.equal(use.length, 3);
  use[1].click();
  assert.equal(k.saved().retirement.strategy, "guardrails");
  const ka = await page(k.saved());
  assert.ok(/Your plan now trims spending by a tenth after bad years: about \$3,300 a month this year, as before, about \$[\d,]+ at the lowest if markets do as well as average\./.test(ka.first) && !/it was \$3,300/.test(ka.first), ka.first.slice(0, 900));
});

test("5b page: a first year whose savings run short says how much of the year's need they cover", async () => {
  // Cy: $20,000 of savings, $42,000 of spending, $15,927 of health cover and $1,800 of tax: savings cover $20,000 of $59,727
  const { first, fold } = await page(migrate(shortSavingsRetiree()));
  assert.ok(/This year, savings have only about \$20,000 left to take, from Checking and IRA\./.test(first), first.slice(0, 900));
  assert.ok(/That covers about \$20,000 of the \$59,727 the year needs: the \$42,000 you spend, \$15,927 of health insurance and about \$1,800 of tax\./.test(first), first.slice(0, 900));
  assert.ok(/savings have only about \$20,000 left\. That covers about \$20,000 of the \$59,727 the year needs\./.test(fold("How this is worked out")));
});

test("5b: after 'Use this one' on a share of what is left, the projection's 'you plan on' and 'Paid by income' agree", async () => {
  // the widow on the share way: she plans on $64,868 in 2026 and income pays 50,400 / 64,868.24 = 78% of it (was "you plan on
  // $36,000" beside "Paid by income 299%", 50,400 / 16,880)
  const pct = migrate(widowPlan()); pct.retirement.strategy = "percent";
  const pr = projectionOf(pct, { today: TODAY8 });
  assert.ok(Math.abs(pr.coverage - 50400 / 64868.24) < 1e-6, String(pr.coverage));
  const el = () => ({ setAttribute() {}, append() {}, style: {} });
  globalThis.document ??= { createElementNS: el, createElement: el };
  const { render } = await import("../projection/view.js");
  const fmt = await import("../../../core/format.js");
  const { ui } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  render(root, { ui, fmt: { ...fmt, today: () => TODAY8 }, plan: pct, store: { update() {}, get: () => pct }, api: null, server: null });
  const text = root.textContent;
  // batch 5b UX review 5: a way that moves with markets is said as itself: what it spends a month, how low it goes
  assert.ok(/^Will the money last\? |Your spending moves with markets About \$5,406 a month this year, about \$[\d,]+ at the lowest if markets do as well as average\./.test(text) && /Your spending moves with markets/.test(text), text.slice(0, 700));
  assert.ok(!/The money lasts|On track/.test(text.split("Paid by income")[0]), text.slice(0, 700));
  assert.ok(/Paid by income 78% of the first retirement year.s spending/.test(text), text.slice(0, 1400));
  // on the plan's own figure nothing changes: "you plan on $36,000" and 50,400 / 36,000 = 140%
  const root2 = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  render(root2, { ui, fmt: { ...fmt, today: () => TODAY8 }, plan: migrate(widowPlan()), store: { update() {}, get: () => null }, api: null, server: null });
  assert.ok(/you plan to spend \$36,000\./.test(root2.textContent) && /Paid by income 140% of the first retirement year.s spending/.test(root2.textContent), root2.textContent.slice(0, 1400));
});

test("5b review D2: each way's figure is the run the plan gets once that way is saved (its own health insurance before 65)", () => {
  // Pat and Jo retire at 62 with nothing coming in until 67: the help with health insurance before 65 depends on the year's
  // income, which depends on the way. Every way's first year, lowest year and end must equal Will the money last? with it saved
  for (const p of [bridgeCouple(), earlyRetiree(), widowPlan()]) {
    const plan = migrate(p);
    const d = compute(plan, { today: TODAY8 });
    for (const r of d.rows) {
      const q = migrate(structuredClone(p)); q.retirement = { ...(q.retirement ?? {}), strategy: r.key };
      const pr = projectionOf(q, { today: TODAY8 });
      const r0 = pr.rows.find((x) => x.retired);
      const who = `${p.household.people[0].name} ${r.key}`;
      assert.ok(Math.abs(r.first.spend - r0.spendingReal) < 0.01, `${who}: offered ${r.first.spend}, saved ${r0.spendingReal}`);
      assert.ok(Math.abs(r.first.health - r0.eventSpending / r0.priceLevel) < 0.01, `${who}: health ${r.first.health} vs ${r0.eventSpending / r0.priceLevel}`);
      const ret = pr.rows.filter((x) => x.retired);
      assert.ok(Math.abs(r.expected.lowest - Math.min(...ret.map((x) => x.spendingReal))) < 0.01, `${who}: lowest`);
      assert.ok(Math.abs(r.expected.endReal - pr.result.endBalanceReal) < 0.01, `${who}: end`);
    }
  }
});

test("5b UX review 7 and 8: one chance in the same words on every page, and one name for each way", async () => {
  const { chanceWords } = await import("../careful.js");
  // rounded down, never "9 of 10" under 90%; "about half" from 45% to under 60%
  // follow-up, 2026-11-07 (owner: no hard words): one helper (odds.js) says it everywhere, and no page calls a pretend future a "market"
  assert.equal(chanceWords(0.47), "about half the time (47 of 100 pretend futures last)");
  assert.equal(chanceWords(0.65), "in about 6 of 10 pretend futures (65 of 100)");
  assert.equal(chanceWords(0.899), "in about 8 of 10 pretend futures (89 of 100)");
  assert.equal(chanceWords(0.93), "even in a bad run of years (93 of 100 pretend futures last)");
  // verify: every try is said so, not a bad-run line with "(100 of 100 ...)" (the widow's Will the money last?)
  assert.equal(chanceWords(1), "in every pretend future we ran");
  assert.equal(chanceWords(0.999), "even in a bad run of years (99 of 100 pretend futures last)");
  assert.equal(chanceWords(0.04), "in fewer than 1 of 10 pretend futures (4 of 100)");
  assert.equal(chanceWords(0.47, { exact: false }), "about half the time");
  assert.equal(chanceWords(0.95, { exact: false }), "even in a bad run of years");
  // the word "market" never stands for a try, and the same helper is what every page imports
  for (const s of [0, 0.04, 0.3, 0.47, 0.65, 0.899, 0.93, 0.999, 1]) assert.ok(!/market/i.test(chanceWords(s)), String(s));
  const odds = await import("../odds.js");
  assert.equal(odds.chanceWords, chanceWords);
  // the Projection page's list uses How much to take out's names (it said "Your spending, cut 10% after a bad stretch, ...")
  assert.deepEqual(wayOptions(migrate(widowPlan()), { today: TODAY8 }).map((o) => o.label), ["Same spending every year", "A share of what is left", "Trim after bad years", "Spend what the years left can afford"]);
});

test("5b UX review 18: Will the money last? says where to change the spending figure, not 'on this page'", async () => {
  const el = () => ({ setAttribute() {}, append() {}, style: {} });
  globalThis.document ??= { createElementNS: el, createElement: el };
  const { render } = await import("../projection/view.js");
  const fmt = await import("../../../core/format.js");
  const { fullBracketRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const plan = migrate(fullBracketRetiree());
  const { ui } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  render(root, { ui, fmt: { ...fmt, today: () => TODAY8 }, plan, store: { update() {}, get: () => plan }, api: null, server: null });
  assert.ok(/Retirement spending is set to what you spend today; change it under Retirement settings below\./.test(root.textContent) && !/on this page/.test(root.textContent), root.textContent.slice(0, 900));
});

test("verify R2: on a way that takes more than the law requires, the answer still says the required withdrawal comes from the pre-tax account", async () => {
  // the widow on "A share of what is left": 4% of $422,000 = $16,880 comes out. The law requires $16,078.43 (410,000 / 25.5) from
  // her retirement account; the engine takes that first and the other $801.57 from Checking. The page said "Take it from Checking
  // first, then Ruth's retirement account": read in that order, $12,000 from Checking and $4,880 from the account, $11,198 short.
  const pct = migrate(widowPlan()); pct.retirement.strategy = "percent";
  const p = await page(pct);
  assert.ok(/This year, take about \$16,880 from savings\./.test(p.first), p.first.slice(0, 600));
  assert.ok(/About \$16,078 of it must come from Ruth.s retirement account: the law requires it\. The rest from Checking\./.test(p.first), p.first.slice(0, 600));
  assert.ok(!/Take it from Checking first/.test(p.first), p.first.slice(0, 600));
  // with nothing in Checking the whole $16,880 comes from the account: the required $16,078 and $802 more from there
  const noCash = structuredClone(pct); for (const a of noCash.accounts) if (a.type === "checking" || /checking/i.test(a.name)) a.balance = 0;
  const n = await page(noCash);
  assert.ok(/About \$16,078 of it must come from Ruth.s retirement account: the law requires it\. The rest comes from there too\./.test(n.first), n.first.slice(0, 600));
  // with no required withdrawal the order stays as it was (the early retiree: Checking, then Brokerage)
  const k = await page(migrate(earlyRetiree()));
  assert.ok(/Take it from Checking first, then Brokerage\./.test(k.first), k.first.slice(0, 600));
});

// stress test 2026-11-11, R4: "Use this one" changes the plan in one tap; its green line names the way back and stays
test("stress test: Use this one names the way back, and Put it back restores the old way exactly", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const url = new URL("./view.js", import.meta.url).href;
  const plan = retirementPlan(); delete plan.retirement.strategy;
  const r = await renderPage(url, plan, "2026-11-11");
  const use = r.root.querySelectorAll("button").find((b) => /Use this one/.test(b.textContent));
  assert.ok(use, "a way to choose");
  use.click();
  assert.ok(r.saved.at(-1).retirement.strategy && r.saved.at(-1).retirement.strategy !== "fixed-real");
  // the next render shows the green line with the named way back
  const r2 = await renderPage(url, r.saved.at(-1), "2026-11-11");
  const back = r2.root.querySelectorAll("button").find((b) => /^Put it back: Same spending every year$/.test(b.textContent));
  assert.ok(back, r2.text().slice(0, 400));
  back.click();
  const { migrate } = await import("../../../core/schema/migrate.js");
  assert.equal(r2.saved.at(-1).retirement.strategy, migrate(structuredClone(plan)).retirement.strategy, "the way the plan had before");
  const r3 = await renderPage(url, r2.saved.at(-1), "2026-11-11");
  assert.ok(/Back to "Same spending every year", as before\./.test(r3.text()));
});

// ---- simple first (docs/OPTIONAL.md): "How this is worked out" is a part drawn by core/ui/more.js, title unchanged --------------
test("S11: Use this one saves and says so; How this is worked out (the helper's part) stays as it was, and no fold is by hand", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let p = migrate(widowPlan());
  const saved = [];
  let root;
  const draw = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => TODAY8 }, plan: p, route: { group: "retirement", id: "withdrawal-strategy", rest: [], query: {} }, module: { group: "retirement", id: "withdrawal-strategy" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); p = d; draw(); } }, redraw: draw }); };
  draw();
  // (a form's own "More details (optional)" line is wave 1's, not a fold by hand)
  const states = () => root.all().filter((e) => e.tagName === "DETAILS" && !/form-more/.test(e.className)).map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  const before = states();
  assert.deepEqual(before, [["own", "own", false], ["how", "how", false]], "two parts, the person's own numbers and the working (Settings' switch opens it), both shut; no fold by hand");
  const how = root.all().find((e) => e.dataset.part === "how");
  assert.equal(how.querySelector(".fold-title").textContent, "How this is worked out", "the title the tests name is unchanged");
  assert.match(textOf(how), /Where it comes from:/, "the working is inside it");
  const was = p.retirement?.strategy;
  root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Use this one").click();
  assert.equal(saved.length, 1);
  assert.notEqual(p.retirement.strategy, was);
  assert.ok(root.all().some((e) => e.tagName === "BUTTON" && /^Put it back: /.test(e.textContent)), "the green line with its way back (never folded)");
  assert.deepEqual(states(), before, "after the save no part opened or shut");
});

// ---- Set my own numbers (gap design #4, 2026-11-13): the lowest spending accepted, and the trim's own numbers ---------------
// (the sums are in tests/retirement-spending.test.mjs; here: this page's words, its output and its form)
const T4 = "2026-11-13";
async function draw4(plan0) {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const s = { p: plan0, saved: [], root: null };
  s.draw = () => { s.root = new FakeElement("main"); render(s.root, { ui, fmt: { ...fmt, today: () => T4 }, plan: s.p, route: { group: "retirement", id: "withdrawal-strategy", rest: [], query: {} }, module: { group: "retirement", id: "withdrawal-strategy" },
    store: { get: () => s.p, update: (fn) => { const d = structuredClone(s.p); fn(d); s.saved.push(d); s.p = d; s.draw(); } }, redraw: s.draw }); };
  s.draw();
  s.part = (id) => s.root.all().find((e) => e.dataset?.part === id);
  s.chip = (text) => s.part("own").all().find((e) => e.tagName === "BUTTON" && /\bchip\b/.test(e.className) && e.textContent === text);
  s.submit = () => { const f = s.part("own").querySelector("form"); f.reset = () => {}; f.dispatch("submit"); };
  return s;
}

test("own numbers: the trim in words is the page's own line with the usual numbers, and says the person's when set (guardWords)", async () => {
  const { guardWords, DESCRIPTIONS } = await import("./compute.js");
  assert.equal(guardWords().short, DESCRIPTIONS.guardrails.short);
  assert.equal(guardWords().how, DESCRIPTIONS.guardrails.how);
  assert.equal(guardWords({ cut: 0.05, raise: 0.05 }).short, "what you plan, trimmed by 5% after bad years and raised back after good ones");
  assert.equal(guardWords({ cut: 0.15, raise: 0.15, upper: 1.25, lower: 0.7 }).how, "Spend what you plan. Trim it by 15% when what you take passes 1.25 times the starting share of savings; raise it back, never past your plan, when it falls under 0.7 times. Nothing is trimmed while income pays for everything.");
  assert.equal(guardWords({ cut: 0.05, raise: 0.1 }).how, "Spend what you plan. Trim it by 5% when what you take passes 1.2 times the starting share of savings; raise it back by a tenth, never past your plan, when it falls under 0.8 times. Nothing is trimmed while income pays for everything.");
  assert.equal(guardWords({ cut: 0.05, raise: 0 }).how, "Spend what you plan. Trim it by 5% when what you take passes 1.2 times the starting share of savings. Nothing is trimmed while income pays for everything.");
});

test("own numbers: what the plan holds, what a save writes, and one clause per change (ownNumbers, saveOwnNumbers, ownChanges, ownSavedWords)", async () => {
  const { ownNumbers, saveOwnNumbers, ownChanges } = await import("./compute.js");
  const { ownSavedWords } = await import("./view.js");
  const none = ownNumbers({});
  assert.deepEqual(none, { floor: 0, cut: 0.1, raise: 0.1, upperBy: 0.2, lowerBy: 0.2, custom: false, set: 0 });
  assert.deepEqual(ownNumbers({ spendingFloor: 3000, guard: { cut: 0.05, raise: 0.05, upper: 1.25, lower: 0.8 } }), { floor: 3000, cut: 0.05, raise: 0.05, upperBy: 0.25, lowerBy: 0.2, custom: true, set: 2 });
  // a save at what absent means writes nothing; a real one writes both, the raise the same step as the trim
  const d0 = { retirement: { strategy: "percent" } };
  saveOwnNumbers(d0, { floor: 0, cut: 0.1, upperBy: 0.2, lowerBy: 0.2 });
  assert.deepEqual(d0.retirement, { strategy: "percent" });
  saveOwnNumbers(d0, { floor: 3000, cut: 0.05, upperBy: 0.25, lowerBy: 0.2 });
  assert.deepEqual(d0.retirement, { strategy: "percent", spendingFloor: 3000, guard: { cut: 0.05, raise: 0.05, upper: 1.25, lower: 0.8 } });
  saveOwnNumbers(d0, { floor: null, cut: 0.1, upperBy: 0.2, lowerBy: 0.2 });
  assert.deepEqual(d0.retirement, { strategy: "percent" }, "taken away again");
  // the clauses
  const set = ownNumbers({ spendingFloor: 3000, guard: { cut: 0.05, raise: 0.05, upper: 1.25, lower: 0.7 } });
  assert.deepEqual(ownChanges(none, none), []);
  assert.deepEqual(ownChanges(none, ownNumbers({ spendingFloor: 3000 })), ["never under $3,000 a month"]);
  assert.deepEqual(ownChanges(ownNumbers({ spendingFloor: 3000 }), none), ["no lowest figure"]);
  assert.deepEqual(ownChanges(none, ownNumbers({ guard: { cut: 0.05, raise: 0.05 } })), ["trims by 5% after bad years"]);
  assert.deepEqual(ownChanges(none, ownNumbers({ guard: { upper: 1.25, lower: 0.7 } })), ["trims 25% above the starting share, raises 30% below"]);
  assert.deepEqual(ownChanges(none, set), ["never under $3,000 a month", "trims by 5% after bad years", "trims 25% above the starting share, raises 30% below"]);
  // the green line, one sentence per case
  assert.equal(ownSavedWords({ changes: [] }), "Saved. Nothing changed.");
  assert.equal(ownSavedWords({ changes: ["never under $3,000 a month"], moving: "This way spends about $5,900 a month in 2055; in a bad stretch like the 1970s it falls to about $3,000." }), "Saved: never under $3,000 a month. This way spends about $5,900 a month in 2055; in a bad stretch like the 1970s it falls to about $3,000.");
  assert.equal(ownSavedWords({ changes: ["trims by 5% after bad years"] }), "Saved: trims by 5% after bad years. Your own plan is unchanged; the three ways above that move with markets now use these numbers.");
});

test("own numbers: with none set the page's output is what it was; a floor holds the three ways that move and leaves the same spending every year alone", () => {
  const plan = retirementPlan();
  const base = compute(plan, { today: T4 });
  assert.equal("own" in base, false);
  assert.equal(JSON.stringify(compute({ ...plan, retirement: { ...plan.retirement, spendingFloor: 0, guard: { cut: 0.1, raise: 0.1, upper: 1.2, lower: 0.8 } } }, { today: T4 })), JSON.stringify(base));
  // (the couple plan $6,500 a month; in the worst stretch of history "Trim after bad years" falls to about $6,300)
  const floor = 6400;
  const d = compute({ ...plan, retirement: { ...plan.retirement, spendingFloor: floor } }, { today: T4 });
  assert.deepEqual(d.own, { floor, cut: 0.1, raise: 0.1, upperBy: 0.2, lowerBy: 0.2, custom: false, set: 1 });
  const row = (x, k) => x.rows.find((r) => r.key === k);
  assert.equal(JSON.stringify(row(d, "fixed-real")), JSON.stringify(row(base, "fixed-real")));
  let moved = 0;
  for (const k of ["percent", "vpw", "guardrails"]) for (const run of ["expected", "worst"]) {
    const was = row(base, k)[run], now = row(d, k)[run];
    // held at the floor (the plan's own figure is above it), unless savings ran out holding it
    if (now.success) assert.ok(now.lowest >= floor * 12 - 0.5, `${k} ${run}: ${now.lowest}`);
    if (was.lowest < floor * 12 - 0.5) { moved++; assert.ok(now.lowest > was.lowest || !now.success, `${k} ${run}`); }
  }
  assert.ok(moved >= 1, `${moved} runs fell under $${floor} a month before`);
  assert.ok(row(d, "guardrails").worst.lowest >= floor * 12 - 0.5 && row(base, "guardrails").worst.lowest < floor * 12);
  // the trim's own numbers move "Trim after bad years" alone, and its line says them
  const g = compute({ ...plan, retirement: { ...plan.retirement, guard: { cut: 0.05, raise: 0.05 } } }, { today: T4 });
  for (const k of ["fixed-real", "percent", "vpw"]) assert.equal(JSON.stringify(row(g, k)), JSON.stringify(row(base, k)), k);
  assert.notEqual(JSON.stringify(row(g, "guardrails").worst), JSON.stringify(row(base, "guardrails").worst));
  assert.equal(row(g, "guardrails").short, "what you plan, trimmed by 5% after bad years and raised back after good ones");
  assert.match(row(g, "guardrails").how, /^Spend what you plan\. Trim it by 5% when/);
});

test("own numbers: one quiet row, shut, 'none set'; the form asks one box and three chips, two more boxes under More details", async () => {
  const s = await draw4(retirementPlan());
  const own = s.part("own");
  assert.equal(own.hasAttribute("open"), false);
  assert.equal(own.querySelector(".fold-title").textContent, "Set my own numbers");
  assert.equal(own.querySelector(".fold-status"), null, "no line beside the title until something is set");
  // rows of one card, in the helper's order: the person's numbers, then how it is worked out
  assert.deepEqual(s.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => e.dataset.part), ["own", "how"]);
  assert.equal(own.parentNode.parentNode.dataset.parts, "");
  const form = own.querySelector("form");
  const more = form.all().find((e) => e.tagName === "DETAILS" && /form-more/.test(e.className));
  assert.equal(more.hasAttribute("open"), false, "the bands start shut at the usual figures");
  const names = form.all().filter((e) => e.getAttribute("name")).map((e) => e.getAttribute("name"));
  assert.deepEqual(names, ["floor", "upperBy", "lowerBy"]);
  assert.equal(form.querySelector('[name="floor"]').value, "");
  assert.equal(form.querySelector('[name="upperBy"]').value, "20");
  assert.ok(more.all().includes(form.querySelector('[name="upperBy"]')) && !more.all().includes(form.querySelector('[name="floor"]')));
  assert.deepEqual(own.all().filter((e) => /\bchip\b/.test(e.className)).map((e) => [e.textContent, e.getAttribute("aria-pressed")]), [["by 5%", "false"], ["by 10% (usual)", "true"], ["by 15%", "false"], ["Type my own", "false"]]);
  assert.match(own.textContent, /today's dollars; leave blank for none\. The three ways that move with markets never spend less while savings last/);
  // plain labels, and no way named in quotes inside the form (critic, P4)
  assert.deepEqual(form.all().filter((e) => /\bfield-label\b/.test(e.className ?? "")).map((e) => e.textContent), ["Lowest spending you'd accept, a month", "After bad years, trim spending", "Trim when the share of savings you take is this far above where it started", "Raise it back when it is this far below"]);
  assert.ok(!/["\u201c]/.test(form.textContent), form.textContent);
  // a save with nothing changed says so and writes no key
  s.submit();
  assert.equal("spendingFloor" in s.saved[0].retirement, false); assert.equal("guard" in s.saved[0].retirement, false);
  assert.equal(s.part("own").querySelector(".notice").textContent, "Saved. Nothing changed.");
});

test("own numbers: a save names what changed and the page's answer now, the part stays open, How this is worked out stays shut", async () => {
  // the plan spends the same every year: its answer does not move
  const s = await draw4(retirementPlan());
  s.part("own").querySelector('[name="floor"]').value = "5000";
  s.chip("by 5%").click();
  assert.equal(s.saved.length, 0, "a chip saves nothing by itself");
  assert.equal(s.chip("by 5%").getAttribute("aria-pressed"), "true");
  s.submit();
  assert.equal(s.saved.length, 1);
  assert.equal(s.saved[0].retirement.spendingFloor, 5000);
  assert.deepEqual(s.saved[0].retirement.guard, { cut: 0.05, raise: 0.05, upper: 1.2, lower: 0.8 });
  const own = s.part("own");
  assert.equal(own.hasAttribute("open"), true);
  assert.equal(s.part("how").hasAttribute("open"), false);
  assert.equal(own.querySelector(".notice").textContent, "Saved: never under $5,000 a month; trims by 5% after bad years. Your own plan is unchanged; the three ways above that move with markets now use these numbers.");
  assert.equal(own.querySelector(".fold-status").textContent, "2 set by you");
  assert.equal(own.querySelector('[name="floor"]').value, "5,000");
  assert.equal(s.chip("by 5%").getAttribute("aria-pressed"), "true");
  // the ways say it: the line of "Trim after bad years", and the note in How this is worked out
  assert.match(s.root.textContent, /What you plan, trimmed by 5% after bad years and raised back after good ones\./);
  assert.match(s.part("how").textContent, /The three ways that move with markets never spend under \$5,000 a month while savings last: the lowest you set\. A year savings cannot pay it counts as running out\./);
  assert.match(s.part("how").textContent, /Trim it by 5% when what you take passes 1\.2 times the starting share of savings/);
  // choosing that way says the person's trim, not "a tenth"
  const li = s.root.all().filter((e) => e.tagName === "LI").find((e) => /^Trim after bad years/.test(e.textContent) && e.all().some((b) => b.textContent === "Use this one"));
  li.all().find((b) => b.tagName === "BUTTON" && b.textContent === "Use this one").click();
  assert.equal(s.p.retirement.strategy, "guardrails");
  assert.match(s.root.all().find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className)).textContent, /^Your plan now trims spending by 5% after bad years: about \$/);
  // the plan's own way moves now: a save names its new answer
  s.part("own").querySelector('[name="floor"]').value = "4000";
  s.submit();
  assert.match(s.part("own").querySelector(".notice").textContent, /^Saved: never under \$4,000 a month\. This way spends about \$[\d,]+ a month in 2033[;,] /);
  // cleared: both keys go
  s.part("own").querySelector('[name="floor"]').value = "";
  s.chip("by 10% (usual)").click();
  s.submit();
  assert.equal("spendingFloor" in s.saved.at(-1).retirement, false); assert.equal("guard" in s.saved.at(-1).retirement, false);
  assert.match(s.part("own").querySelector(".notice").textContent, /^Saved: no lowest figure; trims by 10% after bad years\. This way spends about /);
  assert.equal(s.part("own").querySelector(".fold-status"), null);
});

test("own numbers: bands of the person's own open More details and are saved; a floor above every limit is refused at the box", async () => {
  const p = retirementPlan(); p.retirement.guard = { cut: 0.1, raise: 0.1, upper: 1.3, lower: 0.8 };
  const s = await draw4(p);
  const form = s.part("own").querySelector("form");
  assert.equal(form.all().find((e) => e.tagName === "DETAILS" && /form-more/.test(e.className)).hasAttribute("open"), true, "a changed figure is not hidden");
  assert.equal(form.querySelector('[name="upperBy"]').value, "30");
  assert.equal(s.part("own").querySelector(".fold-status").textContent, "1 set by you");
  form.querySelector('[name="upperBy"]').value = "20"; form.querySelector('[name="lowerBy"]').value = "30";
  s.submit();
  assert.deepEqual(s.saved[0].retirement.guard, { cut: 0.1, raise: 0.1, upper: 1.2, lower: 0.7 });
  assert.match(s.part("own").querySelector(".notice").textContent, /^Saved: trims 20% above the starting share, raises 30% below\. /);
});

test("own numbers: a lowest figure over the plan, or one that empties savings, is said in amber at the save and after (floorRisk)", async () => {
  // (critic of gap design #4, P1: $15,000 a month on a $7,000 plan was a plain green "Saved")
  const { floorRisk } = await import("./compute.js");
  assert.equal(floorRisk({ floor: 0, planMonthly: 7000, failAge: null }), "");
  assert.equal(floorRisk({ floor: 5000, planMonthly: 7000, failAge: null }), "");
  assert.equal(floorRisk({ floor: 15000, planMonthly: 7000, failAge: 73 }), "$15,000 a month is more than the $7,000 a month your plan spends. Holding it, savings run out at 73, even if markets do as well as average.");
  assert.equal(floorRisk({ floor: 7500, planMonthly: 7000, failAge: null }), "$7,500 a month is more than the $7,000 a month your plan spends.");
  assert.equal(floorRisk({ floor: 6500, planMonthly: 7000, failAge: 88 }), "Holding at least $6,500 a month, one of the ways above runs out of savings at 88, even if markets do as well as average.");
  // the plan: nothing with no floor or a modest one; the facts with one over the plan
  const plan = retirementPlan();
  assert.equal("floorWarn" in compute(plan, { today: T4 }), false);
  const planMonthly = compute(plan, { today: T4 }).figureMonthly;
  assert.ok(planMonthly > 3000);
  assert.equal("floorWarn" in compute({ ...plan, retirement: { ...plan.retirement, spendingFloor: 1000 } }, { today: T4 }), false);
  const big = compute({ ...plan, retirement: { ...plan.retirement, spendingFloor: planMonthly * 3 } }, { today: T4 });
  assert.equal(big.floorWarn.floor, planMonthly * 3);
  assert.equal(big.floorWarn.planMonthly, planMonthly);
  const share = big.rows.filter((r) => (r.key === "percent" || r.key === "vpw") && !r.expected.success);
  assert.ok(share.length >= 1, "holding three times the plan empties savings");
  assert.equal(big.floorWarn.failAge, Math.min(...share.map((r) => r.expected.failAge)));
  // the page: the green line of the save, then the warning; the warning is there on a later visit too
  const s = await draw4(plan);
  s.part("own").querySelector('[name="floor"]').value = String(planMonthly * 3);
  s.submit();
  const warn = () => s.part("own").all().find((e) => e.dataset?.floorWarn !== undefined);
  assert.match(s.part("own").querySelector(".notice").textContent, /^Saved: never under \$[\d,]+ a month\./);
  assert.match(warn().className, /\bnotice\b.*\bwarn\b/);
  assert.equal(warn().textContent, floorRisk(big.floorWarn, (n) => `$${Math.round(n).toLocaleString("en-US")}`));
  assert.match(warn().textContent, /is more than the \$[\d,]+ a month your plan spends\. Holding it, savings run out at \d+, even if markets do as well as average\.$/);
  assert.match(s.part("how").textContent, /"Trim after bad years" still never spends more than your plan\./);
  s.draw();
  assert.ok(warn(), "still said on the next visit");
  assert.equal(s.part("own").all().filter((e) => /\bnotice\b/.test(e.className ?? "") && /\bok\b/.test(e.className)).length, 0);
  // a modest one: no warning
  s.part("own").querySelector('[name="floor"]').value = "1000";
  s.submit();
  assert.equal(warn(), undefined);
});

test("own numbers: a save the form refuses takes the earlier green line away", async () => {
  // (critic, P5: "Saved: never under $15,000 a month" stayed above a red "Type an amount in numbers")
  const s = await draw4(retirementPlan());
  s.part("own").querySelector('[name="floor"]').value = "5000";
  s.submit();
  const own = s.part("own");
  const ok = () => own.all().filter((e) => /\bnotice\b/.test(e.className ?? "") && /\bok\b/.test(e.className));
  assert.equal(ok().length, 1);
  // the browser's "invalid" on a box of the form (it does not bubble: the form hears it on the way down)
  own.querySelector("form").dispatch("invalid");
  assert.equal(ok().length, 0, "the screen does not say both saved and failed");
});

test("own numbers: a raise the plan holds apart from its trim is kept while the trim stays; a stored figure the sums refuse is said", async () => {
  // (critic, F5)
  const { ownNumbers, saveOwnNumbers } = await import("./compute.js");
  const d = { retirement: { guard: { cut: 0.1, raise: 0.05, upper: 1.2, lower: 0.8 } } };
  saveOwnNumbers(d, { floor: 3000, cut: 0.1, upperBy: 0.2, lowerBy: 0.2 });
  assert.deepEqual(d.retirement.guard, { cut: 0.1, raise: 0.05, upper: 1.2, lower: 0.8 }, "the trim was left as it is: the raise stays");
  saveOwnNumbers(d, { floor: 3000, cut: 0.15, upperBy: 0.2, lowerBy: 0.2 });
  assert.deepEqual(d.retirement.guard, { cut: 0.15, raise: 0.15, upper: 1.2, lower: 0.8 }, "a new step is one step for both");
  assert.equal("replaced" in ownNumbers({ spendingFloor: 3000, guard: { cut: 0.05, raise: 0.05, upper: 1.25, lower: 0.8 } }), false);
  assert.deepEqual(ownNumbers({ guard: { cut: 0.8, raise: 0.1, upper: 5, lower: 0.8 } }).replaced, ["cut", "upper"]);
  assert.deepEqual(ownNumbers({ spendingFloor: 5000000 }).replaced, ["floor"]);
  // the page says both
  const p = retirementPlan(); p.retirement.guard = { cut: 0.1, raise: 0.05, upper: 5, lower: 0.8 };
  const s = await draw4(p);
  const own = s.part("own");
  assert.equal(own.all().find((e) => e.dataset?.replaced !== undefined).textContent, "A figure stored in your plan is outside what the sums can use, so the usual one is used and shown here. Save my numbers keeps what you see.");
  assert.match(own.textContent, /and raise it back by 5% after good years \(the step your plan holds\), never past your plan/);
  s.chip("by 15%").click();
  assert.match(s.part("own").textContent, /and raise it back by the same step after good years, never past your plan/);
  assert.equal(s.part("own").all().some((e) => e.dataset?.replaced !== undefined), true);
  const clean = await draw4(retirementPlan());
  assert.equal(clean.part("own").all().some((e) => e.dataset?.replaced !== undefined), false);
});

// ---- the rule, this year (gap design #31, 2026-11-14): a calm line when "Trim after bad years" says to act, for a household
// already retired; nothing for anyone else ------------------------------------------------------------------------------------
const T31 = "2026-11-14";
/** The widow (retired, $50,400 of income, $422,000 saved) on "Trim after bad years", spending `monthly`. */
const widowOn = (monthly, more = {}) => { const p = migrate(widowPlan()); Object.assign(p.retirement, { strategy: "guardrails", ...(monthly ? { spendingMonthly: monthly } : {}), ...more }); return p; };

test("the rule this year: each band, by hand (guardNudge)", async () => {
  const { guardNudge } = await import("./compute.js");
  const base = { savings: 1000000, start: 0.04, monthly: 4500 };
  // $55,000 of $1,000,000 is 5.5%, over 1.2 x 4% = 4.8%: trim a tenth, $4,500 -> $4,050
  const t = guardNudge({ ...base, need: 55000 });
  assert.deepEqual([t.act, t.to, t.by], ["trim", 4050, 450]);
  assert.ok(Math.abs(t.rate - 0.055) < 1e-12 && Math.abs(t.upperAt - 0.048) < 1e-12 && Math.abs(t.lowerAt - 0.032) < 1e-12);
  // inside the two lines (3.2% to 4.8%), and exactly on a line: nothing
  for (const need of [32000, 40000, 48000]) assert.equal(guardNudge({ ...base, need }).act, null, `${need}`);
  // under the lower line with nothing trimmed before: nothing to raise back to
  assert.equal(guardNudge({ ...base, need: 29000 }).act, null);
  // under it after a trim from $4,500 to $4,050: a tenth more, $4,455 to the nearest $10, under the old figure
  const r = guardNudge({ ...base, need: 29000, monthly: 4050, top: 4500 });
  assert.deepEqual([r.act, r.to, r.by], ["raise", 4460, 410]);
  // a tenth more would pass the figure before the trim: back to it, no further
  const rt = guardNudge({ ...base, need: 29000, monthly: 4200, top: 4500 });
  assert.deepEqual([rt.act, rt.to, rt.by], ["raise-top", 4500, 300]);
  // nothing drawn at all (income pays for everything) raises back too, while the raised year stays under the trim line
  assert.equal(guardNudge({ ...base, need: 0, monthly: 4050, top: 4500 }).act, "raise");
  assert.equal(guardNudge({ savings: 50000, start: 0.04, need: 0, monthly: 4050, top: 4500 }).act, null, "12 x $410 of $50,000 is 9.8%, over the trim line: no raise");
  // the person's own numbers: a 5% step; a wider band (1.5 x 4% = 6%) holds the trim; a raise of 0 never raises
  assert.deepEqual([guardNudge({ ...base, need: 55000, guard: { cut: 0.05, raise: 0.05 } }).to], [4280]);   // 4,275 to the nearest $10
  assert.equal(guardNudge({ ...base, need: 55000, guard: { upper: 1.5 } }).act, null);
  assert.equal(guardNudge({ ...base, need: 65000, guard: { upper: 1.5 } }).act, "trim");
  assert.equal(guardNudge({ ...base, need: 29000, monthly: 4050, top: 4500, guard: { raise: 0 } }).act, null);
  assert.equal(guardNudge({ ...base, need: 35000, monthly: 4050, top: 4500, guard: { lower: 0.9 } }).act, "raise", "3.5% is under 0.9 x 4%");
  // the lowest spending set: the trim stops at it, and at it nothing is asked
  const f = guardNudge({ ...base, need: 55000, floor: 4300 });
  assert.deepEqual([f.act, f.to, f.by], ["trim-floor", 4300, 200]);
  assert.equal(guardNudge({ ...base, need: 55000, floor: 4000 }).act, "trim", "a floor under the trimmed figure changes nothing");
  for (const floor of [4500, 6000]) { const a = guardNudge({ ...base, need: 55000, floor }); assert.deepEqual([a.act, a.to], ["at-floor", null]); }
  // a trim: the share once trimmed, and far over the line only past twice it
  assert.ok(Math.abs(t.after - 0.0496) < 1e-12); assert.equal("far" in t, false);
  assert.equal(guardNudge({ ...base, need: 96000 }).far, undefined); assert.equal(guardNudge({ ...base, need: 96001 }).far, true);
  // the lowest figure set is over what the plan spends: nothing to do, and it is "under", not "at" (M4)
  assert.deepEqual([guardNudge({ ...base, need: 55000, floor: 6000 }).under, "under" in guardNudge({ ...base, need: 55000, floor: 4500 })], [true, false]);
  // a figure too small to trim to the nearest $10: no line with no button (M7)
  assert.equal(guardNudge({ savings: 100000, start: 0.04, need: 5000, monthly: 4, guard: { cut: 0.5 } }).act, null);
  // income already pays for the raised figure (the page's answer shows that spending): no raise (P3); under it, the raise stands
  assert.equal(guardNudge({ ...base, need: 0, monthly: 4050, top: 4500, spends: 4460 }).act, null);
  assert.equal(guardNudge({ ...base, need: 0, monthly: 4050, top: 4500, spends: 4700 }).act, null);
  assert.equal(guardNudge({ ...base, need: 0, monthly: 4050, top: 4500, spends: 4200 }).act, "raise");
  // some income is known to be missing: no trim is asked (M2); a raise, which missing income only makes more careful, still is
  const u = guardNudge({ ...base, need: 55000, unsure: true });
  assert.deepEqual([u.act, u.to, u.unsure], [null, null, true]);
  assert.equal(guardNudge({ ...base, need: 55000, floor: 4500, unsure: true }).act, null);
  assert.equal(guardNudge({ ...base, need: 29000, monthly: 4050, top: 4500, unsure: true }).act, "raise");
  assert.equal("unsure" in t, false);
  // followed this year already: it rests
  assert.deepEqual([guardNudge({ ...base, need: 55000, rested: true }).act, guardNudge({ ...base, need: 55000, rested: true }).rested], [null, true]);
  // no savings, no starting share or no spending figure: no rule to follow
  for (const x of [{ savings: 0 }, { start: 0 }, { monthly: 0 }, { need: NaN }]) assert.equal(guardNudge({ ...base, need: 55000, ...x }), null);
});

test("the rule this year: one sentence per case (guardNudgeWords, guardHowWords, guardDoneWords)", async () => {
  const { guardNudge, guardNudgeWords, guardHowWords, guardDoneWords, guardUndoneWords } = await import("./compute.js");
  const base = { savings: 1000000, start: 0.04, monthly: 4500 };
  const say = (x) => guardNudgeWords(guardNudge({ ...base, ...x }));
  assert.deepEqual(say({ need: 55000 }), { tone: "warn", button: "Plan on $4,050 a month",
    text: "This year you take about 5.5% of your savings. Your \"Trim after bad years\" plan cuts spending above 4.8%, so it says spend 10% less: about $450 a month less." });
  assert.deepEqual(say({ need: 55000, floor: 4300 }), { tone: "warn", button: "Plan on $4,300 a month",
    text: "This year you take about 5.5% of your savings. Your \"Trim after bad years\" plan cuts spending above 4.8%, but not under the $4,300 a month you set as your lowest: about $200 a month less." });
  assert.deepEqual(say({ need: 55000, floor: 4500 }), { tone: "warn", button: null,
    text: "This year you take about 5.5% of your savings. Your \"Trim after bad years\" plan cuts spending above 4.8%, but you already spend the lowest you set, $4,500 a month, so nothing changes." });
  assert.deepEqual(say({ need: 29000, monthly: 4050, top: 4500 }), { tone: "good", button: "Plan on $4,460 a month",
    text: "This year you take about 2.9% of your savings. Your \"Trim after bad years\" plan raises spending back under 3.2%, so you could spend 10% more again: about $410 a month more." });
  assert.deepEqual(say({ need: 29000, monthly: 4200, top: 4500 }), { tone: "good", button: "Plan on $4,500 a month",
    text: "This year you take about 2.9% of your savings. Your \"Trim after bad years\" plan raises spending back under 3.2%, so you could go back to the $4,500 a month you planned before the trim." });
  // nothing drawn at all: said without "0%"
  assert.equal(say({ need: 0, monthly: 4050, top: 4500 }).text, "This year your income pays for what you spend. Your \"Trim after bad years\" plan raises spending back when you take under 3.2% of your savings, so you could spend 10% more again: about $410 a month more.");
  assert.equal(guardHowWords(guardNudge({ ...base, need: 0 })), "This year your income pays for what you spend, so your spending takes nothing from savings. Your \"Trim after bad years\" plan trims above 4.8% and raises spending back under 3.2%.");
  // the person's own trim is said as theirs; a share a hair over its line is not printed as the same figure
  assert.match(say({ need: 55000, guard: { cut: 0.05, raise: 0.05 } }).text, /, so it says spend 5% less: about \$220 a month less\.$/);
  // a share a hair past its line is never printed as the line itself ("4.8%, over 4.8%": critics' M3)
  assert.match(say({ need: 48300 }).text, /^This year you take just over 4\.8% of your savings\. Your "Trim after bad years" plan cuts spending above 4\.8%,/);
  assert.match(say({ need: 48010 }).text, /^This year you take just over 4\.8% of your savings\./);
  assert.match(say({ need: 31990, monthly: 6000, top: 7000 }).text, /^This year you take just under 3\.2% of your savings\. Your "Trim after bad years" plan raises spending back under 3\.2%,/);
  assert.equal(guardHowWords(guardNudge({ ...base, need: 47990 })), 'This year you take just under 4.8% of your savings. Your "Trim after bad years" plan trims above 4.8% and raises spending back under 3.2%.');
  assert.equal(guardHowWords(guardNudge({ ...base, need: 32010 })), 'This year you take just over 3.2% of your savings. Your "Trim after bad years" plan trims above 4.8% and raises spending back under 3.2%.');
  assert.match(guardHowWords(guardNudge({ ...base, need: 48000 })), /^This year you take about 4\.8% of your savings\./);
  for (const need of [48010, 48300, 31990, 55000, 29000]) assert.doesNotMatch(say({ need, monthly: 6000, top: 7000 })?.text ?? "", /take about (\d+(?:\.\d+)?%) of your savings\. .*(?:above|under) \1[, ]/, `${need}`);
  // the lowest figure set is over what the plan spends: "less than the lowest", never "at" it (M4)
  assert.deepEqual(say({ need: 60000, monthly: 6000, floor: 9000 }), { tone: "warn", button: null,
    text: 'This year you take about 6% of your savings. Your "Trim after bad years" plan cuts spending above 4.8%, but you already spend less than the lowest you set, $9,000 a month, so nothing changes.' });
  // far over the line (more than twice it): one more sentence, the same button (P1); at twice it or under, none
  assert.deepEqual(say({ need: 110000 }), { tone: "warn", button: "Plan on $4,050 a month",
    text: 'This year you take about 11% of your savings. Your "Trim after bad years" plan cuts spending above 4.8%, so it says spend 10% less: about $450 a month less. You are far over that line, so this trim may not be enough on its own.' });
  assert.match(say({ need: 110000, floor: 4300 }).text, /about \$200 a month less\. You are far over that line, so this trim may not be enough on its own\.$/);
  assert.doesNotMatch(say({ need: 96000 }).text, /far over/);
  // more than all of the savings: said in words, never "100000%" (M7)
  assert.match(say({ need: 2e6 }).text, /^This year you need more than all of your savings\. Your "Trim after bad years" plan cuts spending above 4\.8%, so it says spend 10% less/);
  // no sentence says "your rule": the way is named as the page names it (P2)
  for (const x of [{ need: 55000 }, { need: 55000, floor: 4300 }, { need: 55000, floor: 4500 }, { need: 29000, monthly: 4050, top: 4500 }, { need: 29000, monthly: 4200, top: 4500 }, { need: 0, monthly: 4050, top: 4500 }]) { assert.doesNotMatch(say(x).text, /your rule/i); assert.match(say(x).text, /Your "Trim after bad years" plan/); }
  // nothing to say: inside the lines, rested, no rule
  for (const x of [{ need: 40000 }, { need: 55000, rested: true }, { need: 55000, savings: 0 }]) assert.equal(say(x), null);
  // the line in How this is worked out, and the green lines of the button and of its way back
  assert.equal(guardHowWords(guardNudge({ ...base, need: 41000 }), 2026), "This year you take about 4.1% of your savings. Your \"Trim after bad years\" plan trims above 4.8% and raises spending back under 3.2%.");
  assert.equal(guardHowWords(guardNudge({ ...base, need: 41000, rested: true }), 2026), "This year you take about 4.1% of your savings. Your \"Trim after bad years\" plan trims above 4.8% and raises spending back under 3.2%. You followed it in 2026, so it looks again next year.");
  assert.equal(guardHowWords(null), "");
  const t = guardNudge({ ...base, need: 55000 });
  // still over the line once trimmed ($55,000 - 12 x $450 of $1,000,000 is 4.96%): the green line says so; $50,000 ends at 4.46%
  assert.equal(guardDoneWords(t), 'Your plan now spends $4,050 a month (it was $4,500). That still takes more than 4.8% of your savings; "Trim after bad years" looks again next year.');
  assert.equal(guardDoneWords(guardNudge({ ...base, need: 50000 })), 'Your plan now spends $4,050 a month (it was $4,500). "Trim after bad years" looks again next year.');
  // Social Security not counted yet and over the line: the working says why no trim is asked (M2)
  assert.equal(guardHowWords(guardNudge({ ...base, need: 55000, unsure: true }), 2026), 'This year you take about 5.5% of your savings. Your "Trim after bad years" plan trims above 4.8% and raises spending back under 3.2%. Social Security is not counted yet, so this share may be too high and no trim is asked.');
  assert.doesNotMatch(guardHowWords(guardNudge({ ...base, need: 41000, unsure: true }), 2026), /Social Security/);
  assert.equal(guardDoneWords(guardNudge({ ...base, need: 29000, monthly: 4050, top: 4500 })), 'Your plan now spends $4,460 a month (it was $4,050). "Trim after bad years" looks again next year.');
  assert.equal(guardUndoneWords(t), "Back to $4,500 a month, as before.");
});

test("the rule this year: what the button writes (applyGuardStep, guardStepOf)", async () => {
  const { guardNudge, applyGuardStep, guardStepOf } = await import("./compute.js");
  const base = { savings: 1000000, start: 0.04, monthly: 4500 };
  const d = { retirement: { spendingMonthly: 4500 } };
  applyGuardStep(d, guardNudge({ ...base, need: 55000 }), { year: 2026, shown: 4500 });
  assert.deepEqual(d.retirement, { spendingMonthly: 4050, guardStep: { year: 2026, top: 4500, at: 4050 } });
  // a second trim a year on keeps the first figure as the one to raise back to
  applyGuardStep(d, guardNudge({ ...base, need: 55000, monthly: 4050, top: 4500 }), { year: 2027, shown: 4050 });
  assert.deepEqual(d.retirement, { spendingMonthly: 3650, guardStep: { year: 2027, top: 4500, at: 3650 } });   // 3,645 to the nearest $10
  // a raise keeps it until the raise reaches it
  applyGuardStep(d, guardNudge({ ...base, need: 20000, monthly: 3650, top: 4500 }), { year: 2028, shown: 3650 });
  assert.deepEqual(d.retirement, { spendingMonthly: 4020, guardStep: { year: 2028, top: 4500, at: 4020 } });   // 4,015 to the nearest $10
  applyGuardStep(d, guardNudge({ ...base, need: 20000, monthly: 4200, top: 4500 }), { year: 2029, shown: 4200 });
  assert.deepEqual(d.retirement, { spendingMonthly: 4500, guardStep: { year: 2029 } });
  // a case with no figure writes nothing; what is stored is read with defaults
  const e = { retirement: { spendingMonthly: 4500 } };
  applyGuardStep(e, guardNudge({ ...base, need: 55000, floor: 4500 }), { year: 2026 });
  applyGuardStep(e, guardNudge({ ...base, need: 40000 }), { year: 2026 });
  applyGuardStep(e, null, { year: 2026 });
  assert.deepEqual(e, { retirement: { spendingMonthly: 4500 } });
  assert.deepEqual(guardStepOf(undefined), { year: 0, top: 0 });
  assert.deepEqual(guardStepOf({ guardStep: { year: "x", top: -5 } }), { year: 0, top: 0 });
  assert.deepEqual(guardStepOf({ guardStep: { year: 2026, top: 4500 } }), { year: 2026, top: 4500 });
  // a year after this one (a wrong clock, a figure typed by hand) is no step at all (M5)
  assert.deepEqual(guardStepOf({ guardStep: { year: 2099, top: 4500, at: 4050 } }, { yearNow: 2026, monthly: 4050 }), { year: 0, top: 0 });
  assert.deepEqual(guardStepOf({ guardStep: { year: 2026, top: 4500, at: 4050 } }, { yearNow: 2026, monthly: 4050 }), { year: 2026, top: 4500 });
  // the figure was changed somewhere else since the tap: nothing to raise back to (M5); a step with no `at` has none either
  assert.deepEqual(guardStepOf({ guardStep: { year: 2025, top: 4500, at: 4050 } }, { yearNow: 2026, monthly: 3000 }), { year: 2025, top: 0 });
  assert.deepEqual(guardStepOf({ guardStep: { year: 2025, top: 4500 } }, { yearNow: 2026, monthly: 4050 }), { year: 2025, top: 0 });
});

test("the rule this year: on the plan, from the engine's own first row; the person's bands and lowest figure are used", () => {
  // the widow spending $3,000 a month: her income pays for it, nothing comes out, nothing to say
  const calm = compute(widowOn(null), { today: T31 });
  assert.equal(calm.guardNow.act, null); assert.equal(calm.guardNow.rate, 0);
  // at $6,000 a month: what savings pay (spending + health insurance + tax - income, the row's own figures) over savings today
  const plan = widowOn(6000);
  const d = compute(plan, { today: T31 });
  const row = projectionOf(plan, { today: T31 }).rows[0];
  assert.equal(row.retired, true); assert.equal(row.year, 2026);
  const need = Math.max(0, row.spending + row.eventSpending + row.taxes - row.income);
  assert.ok(need > 20000);
  assert.ok(Math.abs(d.guardNow.rate - need / 422000) < 1e-12, `${d.guardNow.rate}`);
  assert.deepEqual([d.guardNow.year, d.guardNow.act, d.guardNow.monthly, d.guardNow.to, d.guardNow.by], [2026, "trim", 6000, 5400, 600]);
  assert.ok(Math.abs(d.guardNow.upperAt - 0.048) < 1e-12);
  // a starting share of 5% (Retirement settings) moves both lines; a band of 1.8 x 4% = 7.2% holds this trim
  assert.ok(Math.abs(compute(widowOn(6000, { withdrawalRate: 0.05 }), { today: T31 }).guardNow.upperAt - 0.06) < 1e-12);
  assert.equal(compute(widowOn(6000, { guard: { upper: 1.8 } }), { today: T31 }).guardNow.act, null);
  // her own trim of 5%, and her own lowest figure
  assert.deepEqual([compute(widowOn(6000, { guard: { cut: 0.05, raise: 0.05 } }), { today: T31 }).guardNow.to], [5700]);
  const f = compute(widowOn(6000, { spendingFloor: 5800 }), { today: T31 }).guardNow;
  assert.deepEqual([f.act, f.to, f.by], ["trim-floor", 5800, 200]);
  assert.equal(compute(widowOn(6000, { spendingFloor: 6000 }), { today: T31 }).guardNow.act, "at-floor");
  // followed this year: it rests; next year it looks again
  assert.deepEqual([compute(widowOn(6000, { guardStep: { year: 2026 } }), { today: T31 }).guardNow.act, compute(widowOn(6000, { guardStep: { year: 2026 } }), { today: T31 }).guardNow.rested], [null, true]);
  assert.equal(compute(widowOn(6000, { guardStep: { year: 2025, top: 7000 } }), { today: T31 }).guardNow.act, "trim");
  // a year after this one (a wrong clock, a figure typed by hand) never silences the rule (M5)
  const fut = compute(widowOn(6000, { guardStep: { year: 2099, top: 9000, at: 6000 } }), { today: T31 }).guardNow;
  assert.deepEqual([fut.act, fut.rested, fut.top], ["trim", false, 0]);
  // after a trim, with the share low again: raise back toward the figure before it
  const up = compute(widowOn(4000, { guardStep: { year: 2025, top: 4500, at: 4000 } }), { today: T31 }).guardNow;
  assert.deepEqual([up.act, up.to], ["raise", 4400]);
  assert.deepEqual([compute(widowOn(4200, { guardStep: { year: 2025, top: 4500, at: 4200 } }), { today: T31 }).guardNow.act], ["raise-top"]);
  // the spending figure was changed somewhere else since that trim: the old figure is not offered back (M5)
  const moved = compute(widowOn(3800, { guardStep: { year: 2025, top: 4500, at: 4000 } }), { today: T31 }).guardNow;
  assert.deepEqual([moved.act, moved.top], [null, 0]);
  // her income already pays for more than the raised figure (the answer says she spends about $3,563 a month): no raise that
  // would plan on less than the page already shows (P3)
  const paid = widowOn(3000, { guardStep: { year: 2025, top: 3800, at: 3000 } });
  assert.ok(firstYear(paid, { today: T31 }).spending / 12 > 3300);
  assert.equal(compute(paid, { today: T31 }).guardNow.act, null);
  assert.equal(compute(widowOn(2700, { guardStep: { year: 2025, top: 3000, at: 2700 } }), { today: T31 }).guardNow.act, null);
  // not for another way, and not for a household still working
  for (const strategy of ["fixed-real", "percent", "vpw"]) assert.equal("guardNow" in compute(widowOn(6000, { strategy }), { today: T31 }), false, strategy);
  assert.equal("guardNow" in compute({ ...retirementPlan(), retirement: { ...retirementPlan().retirement, strategy: "guardrails" } }, { today: T31 }), false, "the couple retire in 2033");
});

test("the rule this year: absent for everyone it is not for, and the new field changes nothing for them (every invented household)", async () => {
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath, pathToFileURL } = await import("node:url");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const dir = fileURLToPath(new URL("../../../qa/fixtures/", import.meta.url));
  const all = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) all.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) all.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") all.push({ name: `phone ${name}`, plan: fn() });
  all.push({ name: "empty plan", plan: emptyPlan() });
  assert.ok(all.length >= 30, `${all.length} plans`);
  const out = (p) => { try { return compute(structuredClone(p), { today: T31 }); } catch (e) { return { throws: e.message }; } };
  let ready = 0, shown = 0, onRule = 0;
  for (const { name, plan } of all) {
    const p = migrate(structuredClone(plan));
    assert.equal(p.retirement?.guardStep, undefined, `${name}: no plan holds the field, and migrate adds none`);
    const d = out(p);
    if (d.ready) ready++;
    // as the plan is: the key is there only for a retired household whose plan trims after bad years
    const mine = d.ready && d.chosen === "guardrails" && !d.chosenHeld && projectionOf(p, { today: T31 }).rows[0]?.retired === true;
    if (!mine) assert.equal("guardNow" in d, false, `${name}: no key`);
    // the stored step alone changes nothing for anyone the line is not for
    const stepped = structuredClone(p); stepped.retirement = { ...(stepped.retirement ?? {}), guardStep: { year: 2026, top: 9000 } };
    if (!mine) assert.equal(JSON.stringify(out(stepped)), JSON.stringify(d), `${name}: guardStep is not read`);
    // the same household on "Trim after bad years": everything but the one new key is what it was, and a working household has no key
    const g = structuredClone(p); g.retirement = { ...(g.retirement ?? {}), strategy: "guardrails" };
    const dg = out(g);
    if (!dg.ready) continue;
    onRule++;
    const retired = projectionOf(g, { today: T31 }).rows[0]?.retired === true;
    if (!retired || dg.chosenHeld) assert.equal("guardNow" in dg, false, `${name}: still working, no key`);
    else if (dg.guardNow) { shown++; assert.equal(dg.guardNow.year, 2026, name); }
    const { guardNow, ...rest } = dg;
    const gs = structuredClone(g); gs.retirement.guardStep = { year: 2026, top: 9000 };
    const { guardNow: g2, ...rest2 } = out(gs);
    assert.equal(JSON.stringify(rest2), JSON.stringify(rest), `${name}: the step moves no other figure`);
  }
  assert.ok(ready >= 20 && onRule >= 20 && shown >= 2, `${ready} ready, ${onRule} on the rule, ${shown} retired with the rule's line worked out`);
});

test("the rule this year, on the page: one amber line and one outlined button; the tap saves, says so, rests the rule and can be put back", async () => {
  const before = widowOn(6000);
  const s = await draw4(structuredClone(before));
  const line = () => s.root.all().find((e) => e.dataset?.guardNudge !== undefined);
  const buttons = (e) => e.all().filter((b) => b.tagName === "BUTTON");
  assert.ok(line(), "the line is on the first view");
  assert.equal(line().dataset.guardNudge, "trim");
  assert.match(line().className, /\bnotice warn\b/); assert.doesNotMatch(line().className, /\berror\b/);
  assert.equal(line().textContent, 'This year you take about 7% of your savings. Your "Trim after bad years" plan cuts spending above 4.8%, so it says spend 10% less: about $600 a month less.Plan on $5,400 a month');
  assert.deepEqual(buttons(line()).map((b) => [b.textContent, /\bsecondary\b/.test(b.className)]), [["Plan on $5,400 a month", true]], "one button, outlined");
  // not inside a fold, and the working has its quiet line
  for (let x = line().parentElement; x; x = x.parentElement) assert.notEqual(x.tagName, "DETAILS");
  assert.match(s.part("how").textContent, /This year you take about 7% of your savings\. Your "Trim after bad years" plan trims above 4\.8% and raises spending back under 3\.2%\./);
  assert.equal(s.saved.length, 0, "drawing the page saves nothing");
  buttons(line())[0].click();
  assert.equal(s.saved.length, 1);
  assert.equal(s.p.retirement.spendingMonthly, 5400);
  assert.deepEqual(s.p.retirement.guardStep, { year: 2026, top: 6000, at: 5400 });
  assert.equal(line(), undefined, "followed this year: the line rests");
  const ok = () => s.root.all().find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className));
  assert.equal(ok().textContent, 'Your plan now spends $5,400 a month (it was $6,000). That still takes more than 4.8% of your savings; "Trim after bad years" looks again next year.Put it back');
  assert.match(s.part("how").textContent, /You followed it in 2026, so it looks again next year\./);
  assert.deepEqual([s.part("own").hasAttribute("open"), s.part("how").hasAttribute("open")], [false, false], "no part opened");
  // Put it back: the plan is what it was, the line is back, and the page says so
  buttons(ok()).find((b) => b.textContent === "Put it back").click();
  assert.equal(s.saved.length, 2);
  assert.deepEqual(s.p, before);
  assert.match(ok().textContent, /^Back to \$6,000 a month, as before\.$/);
  assert.equal(line().dataset.guardNudge, "trim");
});

test("the rule this year, on the page: the raise is green with one button; at the lowest figure there is no button; nothing for anyone else", async () => {
  // after a trim, income pays for everything again: raise back
  const up = await draw4(widowOn(4000, { guardStep: { year: 2025, top: 4500, at: 4000 } }));
  const lineOf = (s) => s.root.all().find((e) => e.dataset?.guardNudge !== undefined);
  assert.equal(lineOf(up).dataset.guardNudge, "raise");
  assert.equal(lineOf(up).className, "notice", "green by its own colours, not the class of a save's line");
  assert.equal(lineOf(up).style.borderColor, "var(--ok)");
  assert.equal(lineOf(up).textContent, 'This year you take about 1.2% of your savings. Your "Trim after bad years" plan raises spending back under 3.2%, so you could spend 10% more again: about $400 a month more.Plan on $4,400 a month');
  lineOf(up).all().find((b) => b.tagName === "BUTTON").click();
  assert.equal(up.p.retirement.spendingMonthly, 4400);
  assert.deepEqual(up.p.retirement.guardStep, { year: 2026, top: 4500, at: 4400 });
  assert.match(up.root.textContent, /Your plan now spends \$4,400 a month \(it was \$4,000\)\. "Trim after bad years" looks again next year\./);
  // far over the line: one more sentence, the same single outlined button (P1)
  const far = await draw4(widowOn(8000));
  assert.match(lineOf(far).textContent, /about \$800 a month less\. You are far over that line, so this trim may not be enough on its own\.Plan on \$7,200 a month$/);
  assert.equal(lineOf(far).all().filter((b) => b.tagName === "BUTTON").length, 1);
  // at the lowest figure set: said, with nothing to tap
  const low = await draw4(widowOn(6000, { spendingFloor: 6000 }));
  assert.equal(lineOf(low).dataset.guardNudge, "at-floor");
  assert.match(lineOf(low).textContent, /, but you already spend the lowest you set, \$6,000 a month, so nothing changes\.$/);
  assert.equal(lineOf(low).all().filter((b) => b.tagName === "BUTTON").length, 0);
  // inside the lines: no line on the first view, the quiet line in the working only
  const calm = await draw4(widowOn(null));
  assert.equal(lineOf(calm), undefined);
  assert.match(calm.part("how").textContent, /This year your income pays for what you spend, so your spending takes nothing from savings\. Your "Trim after bad years" plan trims above 4\.8% and raises spending back under 3\.2%\./);
  // another way, and a household still working: nothing at all
  for (const p of [widowOn(6000, { strategy: "fixed-real" }), widowOn(6000, { strategy: "percent" }), { ...retirementPlan(), retirement: { ...retirementPlan().retirement, strategy: "guardrails" } }]) {
    const s = await draw4(p);
    assert.equal(lineOf(s), undefined);
    assert.doesNotMatch(s.root.textContent, /your rule|This year you take about|far over that line/);
    assert.equal(s.root.all().some((e) => e.dataset?.guardNow !== undefined), false);
  }
});

test("the rule this year: a figure read from today's bills is trimmed the way Retirement settings saves one", async () => {
  // the widow with no figure of her own and $6,400 a month of bills
  const p = migrate(widowPlan()); p.retirement.strategy = "guardrails";
  p.expenses.push({ id: "x-more", name: "Help at home", category: "other", essential: true, period: "monthly", inflates: true, amount: 3400 });
  const s = await draw4(p);
  const d = compute(s.p, { today: T4 });
  assert.equal(d.figureMonthly, null);
  assert.equal(d.guardNow.act, "trim");
  const was = d.guardNow.monthly, to = d.guardNow.to;
  assert.equal(to, Math.round((was * 0.9) / 10) * 10);
  s.root.all().find((e) => e.dataset?.guardNudge !== undefined).all().find((b) => b.tagName === "BUTTON").click();
  assert.equal(s.p.retirement.spendingMonthly, to);
  assert.equal(s.p.retirement.spendingFrom, "expenses");
  const after = compute(s.p, { today: T4 });
  assert.equal(after.figureMonthly, to);
  assert.ok(after.spendingYearly < d.spendingYearly - 1000, `${d.spendingYearly} -> ${after.spendingYearly}`);
  assert.equal(after.guardNow.rested, true);
});

test("the rule this year: a Roth conversion's own tax is no reason to trim (the year's tax before any conversion, as the engine tests it)", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  // the retired couple on tax brackets, both having said they get no Social Security (so nothing is known to be missing)
  const mk = (monthly, conv) => {
    const p = migrate(retiredCouplePlan()); Object.assign(p.retirement, { strategy: "guardrails", spendingMonthly: monthly, taxMode: "brackets" });
    if (conv) p.retirement.rothConversion = { on: true, fillRate: 0.22 };
    p.guide = p.guide ?? {}; p.guide.setup = { ...(p.guide.setup ?? {}), ss: Object.fromEntries(p.household.people.map((x) => [x.id, "none"])) };
    return p;
  };
  for (const monthly of [5000, 7000]) {
    const plan = mk(monthly, true);
    const row = projectionOf(plan, { today: T31 }).rows[0];
    assert.ok(row.conversion > 100000 && row.taxes > 30000, `the year converts ${Math.round(row.conversion)} and owes ${Math.round(row.taxes)}`);
    // the same year with no conversion in it: its tax is the one that counts
    const { project } = await import("../../../core/math/retirement.js");
    const { buildInputs } = await import("../projection/compute.js");
    const inputs = buildInputs(plan, { today: T31 }).inputs;
    const plain = project({ ...inputs, strategy: "guardrails", rothConversion: null }).rows[0];
    assert.ok(plain.taxes < 5000 && plain.conversion === 0);
    const g = compute(plan, { today: T31 }).guardNow;
    const savings = ["cash", "taxable", "deferred", "free"].reduce((t, k) => t + (inputs.balances[k] || 0), 0);
    const need = Math.max(0, row.spending + row.eventSpending + plain.taxes - row.income);
    assert.ok(Math.abs(g.rate - need / savings) < 1e-12, `${g.rate} of ${savings} vs ${need}`);
    // counted with the conversion's tax, as the first build did, the same year read as far over the trim line
    assert.ok((need + row.taxes - plain.taxes) / savings > g.upperAt * 1.2 && g.rate < (need + row.taxes - plain.taxes) / savings - 0.03);
    const off = compute(mk(monthly, false), { today: T31 }).guardNow;
    // with and without the conversion the share is within a point (health insurance alone may differ), never the 7% and 12% the
    // conversion's tax made of it, and the advice is the same
    assert.ok(Math.abs(g.rate - off.rate) < 0.01, `${monthly}: ${g.rate} vs ${off.rate}`);
    assert.equal(g.act, off.act, `${monthly}`);
  }
  assert.equal(compute(mk(5000, true), { today: T31 }).guardNow.act, null, "$5,000 a month: inside the lines, conversion or not");
});

test("the rule this year: no trim is asked while Social Security is not counted yet (the page's own notice says it looks worse than it is)", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ssMissingFor } = await import("../../overview/setup/compute.js");
  const p = migrate(retiredCouplePlan()); Object.assign(p.retirement, { strategy: "guardrails", spendingMonthly: 9000 });
  assert.ok(ssMissingFor(p).length > 0, "the fixture has a Social Security figure missing");
  const g = compute(p, { today: T31 }).guardNow;
  assert.ok(g.rate > g.upperAt, "over the trim line as counted");
  assert.deepEqual([g.act, g.to, g.unsure], [null, null, true]);
  const s = await draw4(structuredClone(p));
  assert.match(s.root.textContent, /Social Security is not counted yet, so this page looks worse than it is/);
  assert.equal(s.root.all().some((e) => e.dataset?.guardNudge !== undefined), false, "no line beside that notice");
  assert.match(s.part("how").textContent, /Social Security is not counted yet, so this share may be too high and no trim is asked\./);
  // once they say they get none, the income is complete and the rule speaks
  p.guide = p.guide ?? {}; p.guide.setup = { ...(p.guide.setup ?? {}), ss: Object.fromEntries(p.household.people.map((x) => [x.id, "none"])) };
  const g2 = compute(p, { today: T31 }).guardNow;
  assert.deepEqual([g2.act, "unsure" in g2], ["trim", false]);
});
