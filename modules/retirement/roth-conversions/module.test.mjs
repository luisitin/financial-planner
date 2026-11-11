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
  // the tester's figures (equity/plan.json, the same household): none $2,207,021, 10% $2,291,778 (best), 12% $2,191,158. Follow-up
  // 2026-11-07 (5b R4): the room under a rate is what ORDINARY income leaves; this household's brokerage dividends are taxed on top
  // of it (IRS Pub. 550) and no longer use up the 10% rate, so it converts more ($331,937 against $166,944 in today's dollars) and
  // gives up more of the marketplace help. Verify 2026-11-07: every year before 65 now converts up to the rate's top (a float hair over
  // the top had made 2032 and 2034 convert $0 at 12%, and 2037 at 10% read the wrong health bill), so 10% gives up $111,262 of the help
  // for $121,042 less tax and leaves $2,151,634, 12% $2,112,783: not converting is best, whether the saved setting is off or 12%
  assert.equal(Math.round(off.options[0].endAfterTaxReal), 2207021);
  assert.equal(Math.round(off.options[1].endAfterTaxReal), 2151634);
  assert.equal(Math.round(off.options[2].endAfterTaxReal), 2112783);
  assert.equal(off.best, null); assert.equal(on12.best, null, "the same best whether the saved setting is off or 12%");
  assert.deepEqual(off.options.map((o) => o.best), on12.options.map((o) => o.best));
  // the help with marketplace cover each setting gives up before 65, against no conversions (today's dollars)
  assert.equal(off.options[0].creditLostReal, 0);
  assert.ok(off.options[2].creditLostReal > 90000, String(off.options[2].creditLostReal));
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
    button: (label, fn, opts = {}) => { const b = node("button", [label]); b.click = fn; b.attrs = opts; buttons.push(b); return b; },
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
  assert.ok(/only works out conversions before 73/.test(text) && /once this year's required amount is out/.test(text), text.slice(0, 600));
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
  assert.ok(/Bea can move any part of Bea's \$600,000 to a Roth each year until 2035, when Bea's required withdrawals start\. Each move is taxed as income that year\./.test(text), text);
});
test("round 8 review UX 10: a setting that converts nothing is not offered", async () => {
  // Di's $60,000 pension fills the 10% bracket every year: filling it converts $0, and "Use this" switched the tax setting for nothing
  const d = compute(migrate(fullBracketRetiree()), { today: "2026-11-06" });
  const ten = d.options.find((o) => o.fillRate === 0.10);
  assert.ok(ten.totalConvertedReal < 1); assert.equal(ten.offer, false);
  assert.ok(d.options.filter((o) => o.fillRate && o.totalConvertedReal >= 1).every((o) => o.offer));
  const { buttons } = await rothPage(migrate(fullBracketRetiree()));
  // a rate that leaves less than not converting has no button (batch 5b UX review 10): only those that convert and leave as much or more
  const kept = d.options.filter((o) => o.fillRate && o.totalConvertedReal >= 1 && (o.best || (o.success && o.endAfterTaxReal >= d.none.endAfterTaxReal - 0.5)));
  assert.ok(kept.length >= 1 && kept.length < d.options.filter((o) => o.fillRate && o.totalConvertedReal >= 1).length);
  assert.equal(buttons.filter((b) => /^Use this|^Move money up to the/.test(b.textContent)).length, kept.length);
  // a plan that runs out at once converts nothing on any setting: nothing to use
  assert.ok(compute(migrate(shortSavingsRetiree()), { today: "2026-11-06" }).options.every((o) => !o.offer));
});
test("round 8 review UX 3 and 4: a saved setting that leaves less than the best one is said so, with the switch; the lost help says what it is compared with", async () => {
  const { text, buttons, saved } = await rothPage(earlyRetirees(0.12));
  // 12% leaves $2,112,783 and no conversions $2,207,021, the best (the room is what ordinary income leaves, follow-up 2026-11-07; every
  // year before 65 converts up to the top, verify 2026-11-07): the switch is the one that turns conversions off
  assert.ok(/Your plan converts at the 12% rate: that leaves about \$94,238 less than none\./.test(text), text.slice(0, 1600));
  assert.ok(/Mostly because it gives up more of the help with health insurance before 65\./.test(text), text.slice(0, 1600));
  const sw = buttons.filter((b) => /^Turn conversions off/.test(b.textContent));
  assert.ok(sw.length >= 1); sw[0].click();
  assert.equal(saved().retirement.rothConversion.on, false);
  assert.ok(/Year by year, your plan's setting: the 12% rate/.test(text));
  assert.ok(/\$121,102 less help with health insurance before 65 than with no conversions/.test(text));
  // the best one saved (no conversions): no such line
  assert.ok(!/Your plan converts/.test((await rothPage(earlyRetirees())).text));
});
test("round 8 review UX 9: with no years to convert in, the page carries no note about setting a figure 'on this page'", async () => {
  const { text } = await rothPage(widow());
  assert.ok(!/set your own figure on this page/.test(text), text);
  // with years to convert in, the note stays, saying where to change it by the page's own name (batch 5b UX 18: not "the Projection page")
  const full = (await rothPage(migrate(fullBracketRetiree()))).text;
  assert.ok(/Retirement spending is set to what you spend today; change it under Retirement settings on Will the money last\?/.test(full) && !/on this page|Projection page/.test(full), full);
});

// round 8, Batch 5b (2026-11-06): with the share, years-left and guardrail ways the tax a conversion saves later would be spent,
// not kept, so "left at the end" would miss it: each setting is compared on the plan's own spending, the same every year
test("5b: a plan on another way compares its conversion settings at the same spending every year", async () => {
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const today = "2026-11-06";
  // health cover is priced on the plan's own income, which moves with the way: left out here, so only the way differs
  const couple = () => { const p = migrate(bridgeCouple()); p.retirement.healthIncluded = true; return p; };
  const steady = compute(couple(), { today });
  assert.ok(steady.options.some((o) => o.totalConvertedReal > 1000), "the couple has years to convert in");
  for (const way of ["percent", "guardrails", "vpw"]) {
    const p = couple(); p.retirement.strategy = way;
    const d = compute(p, { today });
    assert.deepEqual(d.options.map((o) => [o.fillRate, o.endAfterTaxReal, o.taxesReal, o.totalConvertedReal]), steady.options.map((o) => [o.fillRate, o.endAfterTaxReal, o.taxesReal, o.totalConvertedReal]), way);
    assert.equal(d.best, steady.best);
  }
});

// ---- round 8, Batch 5b (2026-11-06): the owner, "Just make sure a layman can easily understand and use the page" ---------------
// The first screen says how much to move, what it leaves at the end and what to do, in plain words (no "bracket", "premium tax
// credit", "poverty line" or "IRMAA"); the year-by-year list and the rules are under "How this is worked out".
const outside = (n) => (n && typeof n === "object" ? (n.tag === "details" ? "" : (n.kids ?? []).map(outside).join(" ")) : String(n ?? ""));
const paragraphs = (n, out = []) => { if (n && typeof n === "object" && n.tag !== "details") { if (n.tag === "p") out.push(n.textContent.replace(/\s+/g, " ").trim()); (n.kids ?? []).forEach((k) => paragraphs(k, out)); } return out; };
async function firstScreen(plan, today = "2026-11-06") {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui, buttons } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); } };
  let saved = null;
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update: (fn) => { saved = structuredClone(plan); fn(saved); } } });
  let fold = "";
  const walk = (n) => { if (!n || typeof n !== "object") return; if (n.tag === "details" && /How this is worked out/.test(n.textContent)) fold = n.textContent.replace(/\s+/g, " "); (n.kids ?? []).forEach(walk); };
  root.kids.forEach(walk);
  return { first: root.kids.map(outside).join(" ").replace(/\s+/g, " "), paras: root.kids.flatMap((k) => paragraphs(k)), fold, buttons, saved: () => saved };
}
const JARGON = [/bracket/i, /premium tax credit/i, /poverty line/i, /IRMAA/, /factor/i];
test("5b page: the couple at 60 retiring at 62 read how much to move each year, what it leaves, and one button", async () => {
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const plan = migrate(bridgeCouple());
  const d = compute(plan, { today: "2026-11-06" });
  const best = d.options.find((o) => o.best);
  const $ = (n) => `\\$${Math.round(n).toLocaleString("en-US")}`;
  const h = (n) => $(Math.round(n / 100) * 100);
  const w = await firstScreen(plan);
  // batch 5b UX review 4: the amounts to move, year by year, in dollars ("Convert up to 10% each year" read as 10% of the account).
  // Moves: 2028, then 2033 to 2040 (today's dollars); 6,702 on 376,838 is under 2%: "little difference" (UX 13), outlined button
  assert.deepEqual(best.moves.map((m) => m.year), [2028, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]);
  const later = best.moves.slice(1).reduce((t, m) => t + m.real, 0) / 8;
  assert.ok(best.endAfterTaxReal - d.none.endAfterTaxReal < 0.02 * d.none.endAfterTaxReal);
  assert.ok(new RegExp(`^Roth conversions Converting makes little difference for you: about ${$(best.endAfterTaxReal - d.none.endAfterTaxReal)} more at the end, after tax\\. It would move to a Roth about ${h(best.moves[0].real)} in 2028, then about ${h(later)} a year from 2033 to 2040, each taxed at the lowest rate, 10%\\.`).test(w.first), w.first.slice(0, 700));
  // UX 3: the plan's flat rate is named before the tap, and the confirmation names the switch to the real rates
  assert.ok(/This page uses the actual tax rates for each year; your plan uses a flat 15% tax rate until you turn conversions on\./.test(w.first), w.first.slice(0, 900));
  for (const word of JARGON) assert.ok(!word.test(w.first), `${word} on the first screen: ${w.first}`);
  assert.ok(!/up to 10%/.test(w.first), "never 'up to 10%'");
  assert.ok(w.paras.every((p) => p.length <= 160), w.paras.filter((p) => p.length > 160).join(" | "));
  const go = w.buttons.filter((b) => /^Move money up to the 10% tax rate$/.test(b.textContent));
  assert.equal(go.length, 1); assert.ok(/secondary/.test(go[0].attrs?.class ?? ""), "outlined for a small gain");
  go[0].click();
  assert.deepEqual([w.saved().retirement.rothConversion.on, w.saved().retirement.rothConversion.fillRate, w.saved().retirement.taxMode], [true, 0.10, "brackets"]);
  const after = await firstScreen(w.saved());
  assert.ok(new RegExp(`Done: your plan now converts at the 10% rate: about ${h(best.moves[0].real)} in 2028, then about ${h(later)} a year from 2033 to 2040\\. It also works out tax at the real rates now, not a flat 15%: that alone changes what Will the money last\\? says\\.`).test(after.first), after.first.slice(0, 900));
  // UX 10 and 11: each rate against not converting; the ones that leave less are folded away with no button
  assert.ok(/No conversions yours Leaves it where it is; you pay tax as you take it out\. At the 10% rate best \$6,702 more Moves about \$113,780 in all\./.test(w.first), w.first);
  assert.ok(!/At the 12% rate/.test(w.first), "12% leaves less: folded");
  const all = await rothPage(migrate(bridgeCouple()));
  assert.ok(/Other choices: each ends with less than not converting \(3\) › At the 12% rate \$[\d,]+ less/.test(all.text), all.text);
  assert.equal(all.buttons.filter((b) => /^Use this/.test(b.textContent)).length, 0, "no button on a rate that leaves less");
  assert.ok(/Will the money last\? counts 401\(k\) and IRA money at its full value before tax, so its "left at the end" is a different figure\. It also uses a flat 15% until conversions are on\./.test(w.fold), w.fold.slice(0, 900));
  // the year by year list and the rules are in the fold
  assert.ok(/Year by year, the best way: the 10% rate/.test(w.fold) && /Five years/i.test(w.fold), w.fold.slice(0, 500));
});
test("5b R4 (follow-up 2026-11-07): gains and dividends do not use up the room under a rate, so Kim's verdict and its reason are about her ordinary income", async () => {
  const { earlyRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const d = compute(migrate(earlyRetiree()), { today: "2026-11-06" });
  // Kim, 45, with a $950,000 brokerage: its dividends and gains sit on top of her ordinary income (IRS Pub. 550; the Qualified Dividends
  // and Capital Gain Tax Worksheet). Counted as if they filled the 10% rate, the room was almost nothing and the page said "little
  // difference, $4,948"; counted as the tax rules say, she has room each year, converting it costs her the marketplace help with health
  // insurance and pushes the dividends out of the 0% rate, and the page says converting does not help
  assert.equal(d.verdict, "no-help");
  const ten = d.options.find((o) => o.fillRate === 0.10);
  assert.ok(ten.totalConvertedReal > 400000, `the 10% rate has room every year, about $451,000 in all: ${ten.totalConvertedReal}`);
  assert.ok(ten.endAfterTaxReal < d.none.endAfterTaxReal - 100000, "and leaves far less than not converting");
  // each year's room is ordinary taxable income at the top of the rate, whatever the dividends are
  // (the page's table shows the 22% rate here: no rate is best; the first year converts up to its top, the pot ends later)
  const first = d.table[0];
  assert.ok(Math.abs(first.ordinaryTaxable - first.bracketTop) < 1 && first.taxableIncome > first.ordinaryTaxable, `${first.year}: ${first.ordinaryTaxable} vs ${first.bracketTop} (taxable ${first.taxableIncome})`);
  const w = await firstScreen(migrate(earlyRetiree()));
  assert.ok(!/investment gains and dividends count|fills the 10% rate \(/.test(w.first), w.first.slice(0, 500));
  // where a late first move is explained, the reason is the other income taxed like pay, never gains and dividends
  const view = (await import("node:fs")).readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(/your pay, pension, taxable Social Security and 401\(k\) or IRA withdrawals fill the \$\{pct\(best\.fillRate\)\} rate/.test(view) && !/gains and dividends count|count toward each rate/.test(view));
});
test("5b R4: the room under a rate is worked on ordinary income with the gains stacked on top (hand figures)", async () => {
  const { roomUnder, bracketTop, paramsFor, federalTax } = await import("../../../core/math/tax.js");
  const { FEDERAL } = await import("../../taxes/federal/data/federal.js");
  const P = paramsFor(FEDERAL, 2026, { inflation: 0.03 });
  // single, 2026, $32,000 of qualified dividends and gains, no other income: the standard deduction 16,100 and the 10% rate to 12,400
  // of ordinary taxable income, so 28,500 can be converted (the verifier's figure); the gains stay in the 0% rate (taxable 44,400 < 49,450)
  const top = bracketTop(0.10, "single", P);
  assert.equal(top, 12400);
  const room = roomUnder({ filingStatus: "single", otherOrdinary: 0, qualifiedIncome: 32000 }, P, top);
  assert.ok(Math.abs(room - 28500) < 0.01, String(room));
  const t = federalTax({ filingStatus: "single", otherOrdinary: room, qualifiedIncome: 32000 }, P);
  assert.ok(Math.abs(t.ordinaryTaxable - 12400) < 0.01 && Math.abs(t.totalTax - 1240) < 0.01, JSON.stringify([t.ordinaryTaxable, t.totalTax]));
  // no gains: the same room as before the fix (the old definition and the new one agree)
  assert.ok(Math.abs(roomUnder({ filingStatus: "single", otherOrdinary: 0 }, P, top) - 28500) < 0.01);
  // ordinary income that already fills the rate leaves none, with or without gains
  assert.equal(roomUnder({ filingStatus: "single", otherOrdinary: 40000, qualifiedIncome: 32000 }, P, top), 0);
});
test("5b page: the early retirees' plan (saved on 12%) and the widow read plain words first", async () => {
  const e = await firstScreen(earlyRetirees(0.12));
  // follow-up 2026-11-07 (5b R4): the household's brokerage dividends no longer use up the 10% rate; with every year before 65 converting up
  // to the top (verify 2026-11-07) no rate leaves more than not converting: 10% saves $121,042 of tax and gives up $111,262 of the help
  assert.ok(/^Roth conversions Moving money to a Roth would not leave you more at the end \(\$2,207,021 after tax\): the tax now is about what it would be later\./.test(e.first), e.first.slice(0, 700));
  assert.ok(/Before 65, what you convert counts as income for the help with health insurance, which stops once income passes about \$86,560 a year\./.test(e.first), e.first.slice(0, 900));
  for (const word of JARGON) assert.ok(!word.test(e.first), `${word}: ${e.first}`);
  assert.ok(e.paras.every((p) => p.length <= 160), e.paras.filter((p) => p.length > 160).join(" | "));
  // the widow: what she can still do, and why it can pay, in two short lines
  const w = await firstScreen(widow());
  // batch 5b UX review 12: a do or don't, in two short lines
  assert.ok(/^Roth conversions You can still move money into a Roth account once this year's required amount is out\. A Roth is one you pay the tax on now and never owe tax on again\. It pays off only if your children would pay tax at a higher rate on what you leave them\./.test(w.first), w.first.slice(0, 600));
  assert.ok(/only works out conversions before 73/.test(w.fold), w.fold);
  assert.ok(w.paras.every((p) => p.length <= 160), w.paras.filter((p) => p.length > 160).join(" | "));
});
test("5b review: when the money runs out either way, the page says so in plain words and points on with a button, not a link in the sentence", async () => {
  const { taxedDrawRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const plan = migrate(taxedDrawRetiree());
  const d = compute(plan, { today: "2026-11-06" });
  assert.equal(d.verdict, "fails");
  const w = await firstScreen(plan);
  assert.ok(new RegExp(`^Roth conversions The money runs out in ${d.none.failYear} with or without conversions\\. Conversions move tax around; they do not add money\\. To see what would fix the plan, open \"Will the money last\\?\"\\. Will the money last\\?`).test(w.first), w.first.slice(0, 400));
  // no link inside a sentence: every paragraph on the first screen is words only
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui } = fakeUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); } };
  render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan, store: { update() {} } });
  const linkIn = (n) => n && typeof n === "object" && (n.kids ?? []).some((k) => k?.tag === "a" || linkIn(k));
  const ps = [];
  const walk = (n) => { if (!n || typeof n !== "object" || n.tag === "details") return; if (n.tag === "p") ps.push(n); (n.kids ?? []).forEach(walk); };
  root.kids.forEach(walk);
  assert.ok(ps.length >= 2 && ps.every((p) => !linkIn(p)), "a link inside a paragraph");
  assert.ok(!/up to \d+%/.test(w.first), w.first.slice(0, 400));
});

test("money review M2: where the loss is the help with health insurance, the first screen says so, not 'the tax now is about what it would be later'", async () => {
  const { earlyRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const d = compute(migrate(earlyRetiree()), { today: "2026-11-07" });
  const ten = d.options.find((o) => o.fillRate === 0.10);
  // Kim: converting at 10% pays $31,097 LESS tax over the plan and gives up $101,116 of the help (the reviewer's hand figures)
  assert.ok(Math.abs((d.none.taxesReal - ten.taxesReal) - 31097) < 2 && Math.abs(ten.creditLostReal - 101116) < 2, JSON.stringify([d.none.taxesReal - ten.taxesReal, ten.creditLostReal]));
  const w = await firstScreen(migrate(earlyRetiree()));
  assert.ok(/would not leave you more at the end \(\$351,378 after tax\)\./.test(w.first), w.first.slice(0, 400));
  assert.ok(/Even at the lowest rate you would end with less\. Before 65, what you convert counts as income, and that costs more of the help with health insurance than it saves in tax \(at the 10% rate, about \$101,116 of help lost for \$31,097 less tax\)/.test(w.first), w.first.slice(0, 700));
  assert.ok(!/about what it would be later/.test(w.first), "the false reason is gone where the help is the loss");
  // the old reason stays for a household that loses no help
  const view = (await import("node:fs")).readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(/the tax now is about what it would be later/.test(view));
});

test("money review M4: a conversion that lifts gains and dividends past the 0% rate is told, with the amount pushed", async () => {
  const { earlyRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const p = migrate(earlyRetiree()); p.retirement.rothConversion = { on: true, fillRate: 0.10 }; p.retirement.taxMode = "brackets";
  const d = compute(p, { today: "2026-11-07" });
  // 2026: converts 28,500 and the gains and dividends (32,304) stay in the 0% rate (taxable 44,704 < 49,450): nothing pushed.
  // 2027: converts 29,375, taxable income 58,382 against the 0% top of 50,950: 7,432 of gains and dividends are taxed at 15% (hand: 58,382 - 50,950)
  const y = (n) => d.table.find((r) => r.year === n);
  assert.equal(y(2026).gainsMoved, 0);
  assert.ok(Math.abs(y(2027).gainsMoved - 7432) < 2, String(y(2027).gainsMoved));
  const view = (await import("node:fs")).readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(/or a little more in years it also raises the tax on your investment earnings/.test(view));
  assert.ok(/do not use up a rate, but a conversion can push some of them from the 0% rate to 15%/.test(view) && !/count toward each rate/.test(view));
});

test("verify 2026-11-07: a year whose first try lands a hair over the rate's top still converts up to the top", () => {
  // ordinary taxable income is taxable income less the dividends and gains (5b R4); that subtraction left the first try 1e-11 over the
  // top in 2032 and 2034, the step back by the same hair was still over, and those years converted $0 at the 12% rate
  const d = compute(earlyRetirees(0.12), { today: "2026-11-06" });
  const years = d.options.find((o) => o.fillRate === 0.12).moves.map((m) => m.year);
  for (let y = 2032; y <= 2046; y++) assert.ok(years.includes(y), `${y} converts: ${years.join(", ")}`);
  // each of the first years ends at the top of the 12% rate on ordinary taxable income, never over it
  const first = d.table.filter((r) => r.year <= 2035);
  assert.equal(first.length, 4);
  for (const r of first) assert.ok(r.ordinaryTaxable <= r.bracketTop + 0.01 && r.ordinaryTaxable >= r.bracketTop - 1, `${r.year}: ${r.ordinaryTaxable} against ${r.bracketTop}`);
});
