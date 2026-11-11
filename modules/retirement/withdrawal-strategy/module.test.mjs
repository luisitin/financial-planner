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
  assert.ok(!/Guardrails/.test(w.first) && /How much you could spend: four ways What each way lets you spend a month this year, with your income\./.test(w.first), w.first);
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
