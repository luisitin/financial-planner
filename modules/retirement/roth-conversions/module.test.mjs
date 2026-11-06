// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("roth-conversions: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// ---- round 8 (2026-11-06) ---------------------------------------------------------------------------------------------------
// A couple who stop work at 60 and buy marketplace cover until 65 (Bo 2034-2038): the help with the premium (the premium tax
// credit) is worked from the year's income, conversions included, so each conversion setting has its own health bill.
import { migrate } from "../../../core/schema/migrate.js";
const earlyRetirees = (saved = null) => migrate({
  schemaVersion: 1, meta: { currency: "USD" },
  household: { people: [
    { id: "ana", name: "Ana", role: "self", birthDate: "1972-03-15", retirementAge: 60 },
    { id: "bo", name: "Bo", role: "partner", relation: "spouse", birthDate: "1974-05-15", retirementAge: 60 },
  ], filingStatus: "married_joint", state: "WA" },
  accounts: [
    { id: "chk", name: "Checking", type: "checking", balance: 15000 }, { id: "sav", name: "Savings", type: "savings", balance: 40000 },
    { id: "k1", name: "Ana's 401(k)", type: "401k", balance: 780000, ownerId: "ana" }, { id: "k2", name: "Bo's 401(k)", type: "401k", balance: 120000, ownerId: "bo" },
    { id: "brk", name: "Investments", type: "brokerage", balance: 300000 },
  ],
  income: [{ id: "pa", name: "Ana's pay", type: "salary", personId: "ana", amount: 210000, period: "annual" }, { id: "pb", name: "Bo's pay", type: "salary", personId: "bo", amount: 30000, period: "annual" }],
  expenses: [{ id: "e", name: "Everything", category: "other", amount: 6210, period: "monthly", essential: true }],
  assumptions: { inflation: 0.03, returnStocks: 0.07, returnBonds: 0.04, returnCash: 0.02, salaryGrowth: 0.03, planEndAge: 95 },
  retirement: { spendingMonthly: 6210, taxMode: "brackets", strategy: "fixed-real", withdrawalOrder: ["taxable", "deferred", "free"],
    contributions: [{ id: "c1", accountId: "k1", personId: "ana", period: "monthly", amount: 2000, employerMatch: 8400 }, { id: "c2", accountId: "k2", personId: "bo", period: "monthly", amount: 250, employerMatch: 1200 }],
    socialSecurity: { ana: { monthlyAtFRA: 4390 }, bo: { monthlyAtFRA: 1577 } }, pensions: [],
    rothConversion: saved ? { on: true, fillRate: saved, untilAge: null } : { on: false, fillRate: 0.22, untilAge: null } },
});
test("round 8 (equity-1): each conversion setting carries its own health bill, so the ranking does not follow the saved setting", () => {
  const today = "2026-11-06";
  const off = compute(earlyRetirees(), { today }), on12 = compute(earlyRetirees(0.12), { today });
  // what each setting leaves after tax when it is the plan's own setting (its own marketplace credit before 65)
  const fair = new Map([null, 0.10, 0.12, 0.22, 0.24].map((r) => [r, compute(earlyRetirees(r), { today }).options.find((o) => o.fillRate === r).endAfterTaxReal]));
  for (const d of [off, on12]) for (const o of d.options) assert.ok(Math.abs(o.endAfterTaxReal - fair.get(o.fillRate)) < 0.01, `${o.label}: ${o.endAfterTaxReal} against ${fair.get(o.fillRate)}`);
  // the tester's figures (equity/plan.json, the same household): none $2,207,021, 10% $2,291,778 (best), 12% $2,191,158
  assert.equal(Math.round(off.options[0].endAfterTaxReal), 2207021);
  assert.equal(Math.round(off.options[1].endAfterTaxReal), 2291778);
  assert.equal(Math.round(off.options[2].endAfterTaxReal), 2191158);
  assert.equal(off.best, 0.10); assert.equal(on12.best, 0.10, "the same best whether the saved setting is off or 12%");
  assert.deepEqual(off.options.map((o) => o.best), on12.options.map((o) => o.best));
  // the help with marketplace cover each setting gives up before 65, against no conversions (today's dollars)
  assert.equal(off.options[0].creditLostReal, 0);
  assert.ok(off.options[2].creditLostReal > 100000, String(off.options[2].creditLostReal));
  assert.ok(off.options[1].creditLostReal < off.options[2].creditLostReal);
  assert.ok(off.options[2].cliffYears.length > 0 && off.options[0].cliffYears.length === 0);
});

// A widow of 74, already taking required withdrawals (round 8, widow-3): the page works out conversions only before they
// start, so it has no years to try; it must not call that "conversions do not help", nor offer "Use this" (which switched the
// plan's tax setting to the brackets for conversions that never happen).
import { widowPlan } from "../../../qa/fixtures/widow-plan.mjs";
const widow = () => migrate(widowPlan());
/** A stand-in for core/ui good enough to read a page's words and its buttons (functions and attributes are not text). */
function fakeUi() {
  const buttons = [];
  const node = (tag, kids) => { const x = { tag, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false && typeof c !== "function") x.kids.push(c); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent ?? "" : String(c))).join(" "); }, style: {} }; x.append(...kids); return x; };
  const isNode = (a) => a && typeof a === "object" && "kids" in a;
  const kidsOf = (a) => a.filter((k) => k === null || typeof k !== "object" || Array.isArray(k) || isNode(k));
  const ui = new Proxy({
    h: (tag, attrs, ...k) => node(tag, attrs && typeof attrs === "object" && !Array.isArray(attrs) && !isNode(attrs) ? k : [attrs, ...k]),
    button: (label, fn) => { const b = node("button", [label]); b.click = fn; buttons.push(b); return b; },
    select: () => node("select", []), table: () => node("table", []),
  }, { get: (t, k) => t[k] ?? ((...a) => node(String(k), kidsOf(a))) });
  return { ui, buttons };
}
test("round 8 (widow-3): at 74 the page says conversions are worked out only before 73, offers no 'Use this', and leaves the tax setting alone", async () => {
  const today = "2026-11-06";
  const d = compute(widow(), { today });
  assert.equal(d.ready, true); assert.equal(d.span, null);
  assert.equal(d.verdict, "no-years");
  assert.deepEqual(d.noWindow, { reason: "started", age: 74, retireAge: 74, rmdStartAge: 73, name: "Ruth", younger: [] });
  assert.ok(d.options.every((o) => !o.offer), "no setting is offered");
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui, buttons } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" "); } };
  const plan = widow(); let updates = 0;
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update: () => { updates++; } } });
  const text = root.textContent;
  assert.ok(!/do not help/.test(text), text.slice(0, 300));
  assert.ok(/only works out conversions before 73/.test(text) && /above each year's required withdrawal/.test(text), text.slice(0, 600));
  assert.ok(/10 years/.test(text), "the heirs' 10-year line");
  assert.equal(buttons.filter((b) => /^Use this|Turn conversions off/.test(b.textContent)).length, 0, buttons.map((b) => b.textContent).join(" | "));
  assert.equal(updates, 0); assert.equal(plan.retirement.taxMode, "flat");
});

// ---- round 8, Batch 5 reviews (2026-11-06) ------------------------------------------------------------------------------------
import { youngerOwnerCouple, fullBracketRetiree, shortSavingsRetiree } from "../../../qa/fixtures/retiree-cases.mjs";
async function rothPage(plan, today = "2026-11-06") {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui, buttons } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  let saved = null;
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update: (fn) => { saved = structuredClone(plan); fn(saved); } } });
  return { text: root.textContent, buttons, saved: () => saved };
}
test("round 8 review D3: when the pre-tax money is the younger spouse's, the page says she can convert any of it before her own start", async () => {
  // Al is 75 with no pre-tax money; Bea is 66 with a $600,000 IRA and no required withdrawals until 75, in 2035 (IRS Pub. 590-A:
  // only the year's required amount cannot be converted). The engine converts by the first adult's age only, so no years to try.
  const d = compute(migrate(youngerOwnerCouple()), { today: "2026-11-06" });
  assert.equal(d.verdict, "no-years");
  assert.equal(d.noWindow.reason, "owner-younger");
  assert.deepEqual(d.noWindow.younger, [{ name: "Bea", startYear: 2035, startAge: 75, deferredNow: 600000 }]);
  const { text } = await rothPage(migrate(youngerOwnerCouple()));
  assert.ok(!/Converting once required withdrawals have started/.test(text) && !/take that year's required amount first/.test(text), text);
  assert.ok(/Bea's \$600,000 has no required withdrawals until 2035, so Bea can convert any part of it each year before then/.test(text), text);
});
test("round 8 review UX 10: a setting that converts nothing is not offered", async () => {
  // Di's $60,000 pension fills the 10% bracket every year: filling it converts $0, and "Use this" switched the tax setting for nothing
  const d = compute(migrate(fullBracketRetiree()), { today: "2026-11-06" });
  const ten = d.options.find((o) => o.fillRate === 0.10);
  assert.ok(ten.totalConvertedReal < 1); assert.equal(ten.offer, false);
  assert.ok(d.options.filter((o) => o.fillRate && o.totalConvertedReal >= 1).every((o) => o.offer));
  const { buttons } = await rothPage(migrate(fullBracketRetiree()));
  assert.equal(buttons.filter((b) => /^Use this/.test(b.textContent)).length, d.options.filter((o) => o.fillRate && o.totalConvertedReal >= 1).length);
  // a plan that runs out at once converts nothing on any setting: nothing to use
  assert.ok(compute(migrate(shortSavingsRetiree()), { today: "2026-11-06" }).options.every((o) => !o.offer));
});
test("round 8 review UX 3 and 4: a saved setting that leaves less than the best one is said so, with the switch; the lost help says what it is compared with", async () => {
  const { text, buttons, saved } = await rothPage(earlyRetirees(0.12));
  // 12% leaves $2,191,158, the 10% bracket $2,291,778 and no conversions $2,207,021
  assert.ok(/Your plan is set to fill the 12% bracket\. That leaves about \$100,620 less than the 10% bracket, and \$15,863 less than not converting, mostly because it gives up more of the help with health insurance before 65\./.test(text), text.slice(0, 1600));
  const sw = buttons.filter((b) => /^Switch to the 10% bracket/.test(b.textContent));
  assert.equal(sw.length, 1); sw[0].click();
  assert.equal(saved().retirement.rothConversion.on, true); assert.equal(saved().retirement.rothConversion.fillRate, 0.10);
  assert.ok(/Your plan's setting, the 12% bracket, year by year/.test(text));
  assert.ok(/about \$121,102 less help than with no conversions/.test(text), text.slice(0, 1600));
  assert.ok(/\$121,102 less help with health insurance before 65 than with no conversions/.test(text));
  // the best one saved: no such line
  assert.ok(!/Your plan is set to fill/.test((await rothPage(earlyRetirees(0.10))).text));
});
test("round 8 review UX 9: with no years to convert in, the page carries no note about setting a figure 'on this page'", async () => {
  const { text } = await rothPage(widow());
  assert.ok(!/set your own figure on this page/.test(text), text);
  // with years to convert in, the note stays, saying which page it means
  const full = (await rothPage(migrate(fullBracketRetiree()))).text;
  assert.ok(/set your own figure on the Projection page/.test(full) && !/on this page/.test(full), full);
});
