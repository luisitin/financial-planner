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
  assert.ok(new RegExp(`^Roth conversions Converting makes little difference for you: about ${$(best.endAfterTaxReal - d.none.endAfterTaxReal)} more at the end, after tax\\. It would move about ${h(best.moves[0].real)} to a Roth in 2028, then about ${h(later)} a year from 2033 to 2040, each taxed at the lowest rate, 10%\\.`).test(w.first), w.first.slice(0, 700));
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
  assert.ok(new RegExp(`Done: your plan now converts at the 10% rate: it moves about ${h(best.moves[0].real)} to a Roth in 2028, then about ${h(later)} a year from 2033 to 2040\\. It also works out tax at the real rates now, not a flat 15%: that alone changes what Will the money last\\? says\\.`).test(after.first), after.first.slice(0, 900));
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

// ---- simple first (docs/OPTIONAL.md): every fold is a part drawn by core/ui/more.js, titles unchanged ------------------------------
test("S11: a save outside the parts moves none; a save in Conversion settings keeps that part open and moves no other; no fold is by hand", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  let p = migrate(bridgeCouple());
  const saved = [];
  let root;
  const draw = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: p, route: { group: "retirement", id: "roth-conversions", rest: [], query: {} }, module: { group: "retirement", id: "roth-conversions" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); p = d; draw(); } }, redraw: draw }); };
  draw();
  const states = () => Object.fromEntries(root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, [e.dataset.kind, e.hasAttribute("open")]]));
  const titleOf = (id) => root.all().find((e) => e.dataset.part === id).querySelector(".fold-title").textContent;
  const first = states();
  assert.deepEqual(first, { other: ["item", false], how: ["how", false], settings: ["item", false] },
    "three parts, all shut: the costlier rates and the settings are items (no switch opens them), How this is worked out is kind how");
  assert.equal(titleOf("other"), "Other choices: each ends with less than not converting (3)");
  assert.equal(titleOf("how"), "How this is worked out");
  assert.equal(titleOf("settings"), "Conversion settings");
  assert.equal(root.all().find((e) => e.dataset.part === "settings").querySelector(".fold-status").textContent, "off");
  // a save outside the parts: the hero's one filled button
  root.all().find((e) => e.tagName === "BUTTON" && /^Move money up to the 10% tax rate$/.test(e.textContent)).click();
  assert.equal(saved.length, 1);
  assert.equal(p.retirement.rothConversion.on, true);
  assert.deepEqual(Object.values(states()).map(([, open]) => open), [false, false, false], "after the save no part opened or shut");
  assert.equal(root.all().find((e) => e.dataset.part === "settings").querySelector(".fold-status").textContent, "on, at the 10% rate", "the status says the new setting");
  // a save inside Conversion settings: that part stays open on the redraw (R17), the others as they were
  const was = states();
  const sel = root.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Convert until");
  sel.value = "65";
  sel.dispatch("change");
  assert.equal(saved.length, 2);
  assert.equal(p.retirement.rothConversion.untilAge, 65);
  const now = states();
  assert.deepEqual(now.settings, ["item", true], "the part saved in is open");
  for (const id of Object.keys(now).filter((k) => k !== "settings")) assert.deepEqual(now[id], was[id] ?? now[id], `${id} did not move`);
  assert.match(textOf(root), /Saved\./, "the green line (never folded)");
  // the draw after that one is drawn as the page draws it (open was for the save's redraw only, never remembered)
  draw();
  assert.equal(states().settings[1], false);
});

// ---- gap design #26 (2026-11-14): conversions that also stop under Medicare's income surcharge or the marketplace credit line ----
// The same couple (Ana 1972, Bo 1974, both stop at 60, marketplace cover 2034-2038, Medicare from 2037 and 2039), converting at
// the 22% rate. `retirement.conversionCeiling` absent or "bracket" is the tax rate alone, as before.
import { project } from "../../../core/math/retirement.js";
import { buildInputs } from "../projection/compute.js";
import { compute as computeMedicare } from "../medicare/compute.js";
import { compute as computeHealthcare } from "../healthcare/compute.js";
import { tiersFor } from "../medicare/data/medicare.js";
import { SCHEDULES } from "../healthcare/data/aca.js";
import { CEILINGS, CHIP, UNDER, ceilingOf, medicareLine, medicareYears, conversionCeiling, topShare, whyWords, diffWords, costWords, savedWords, heroWords, statusWords, idleWords } from "./ceiling.js";
import { IRMAA_FIRST_TIER } from "./compute.js";
import { renderPage } from "../../../qa/fixtures/fake-dom.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
const D26 = "2026-11-06";
const withStop = (kind, rate = 0.22, more = {}) => { const p = earlyRetirees(rate); if (kind !== undefined) p.retirement.conversionCeiling = kind; Object.assign(p.retirement, more); return p; };
const strip = (d) => { const { ceiling, stops, ...rest } = d; return JSON.stringify(rest); };

test("#26 test 1: no choice, \"bracket\" and a value that is not one of the three are all the tax rate alone, to the byte", () => {
  for (const rate of [null, 0.12, 0.22]) {
    const base = earlyRetirees(rate);
    assert.equal("conversionCeiling" in base.retirement, false, "migrate adds no field");
    const a = JSON.stringify(compute(base, { today: D26 }));
    for (const v of ["bracket", "something else", null, 3]) {
      const p = earlyRetirees(rate); p.retirement.conversionCeiling = v;
      assert.equal(ceilingOf(p), "bracket");
      assert.equal(JSON.stringify(compute(p, { today: D26 })), a, `rate ${rate}, value ${v}`);
      assert.equal("conversionCeiling" in buildInputs(p, { today: D26 }).inputs, false, "the engine is handed nothing");
    }
  }
  // the engine itself: a line that is Infinity every year changes no row
  const I = buildInputs(earlyRetirees(0.22), { today: D26 }).inputs;
  assert.equal(JSON.stringify(project({ ...I, conversionCeiling: { lineFor: () => Infinity } })), JSON.stringify(project(I)));
  // and no line is handed over while conversions are off, whatever the choice
  const off = earlyRetirees(null); off.retirement.conversionCeiling = "medicare";
  assert.equal("conversionCeiling" in buildInputs(off, { today: D26 }).inputs, false);
});

test("#26 the engine: a year converts the most that keeps counted income at or under the line, and nothing in a year already over it", () => {
  const I = buildInputs(earlyRetirees(0.22), { today: D26 }).inputs;
  const line = 150000;
  const counted = (x, social) => (x.taxInfo.ordinary + x.taxInfo.qualified + x.taxInfo.taxableSocialSecurity + (social ? x.taxInfo.socialSecurity - x.taxInfo.taxableSocialSecurity : 0)) / x.priceLevel;
  for (const untaxedSocial of [false, true]) {
    const free = project(I), capped = project({ ...I, conversionCeiling: { lineFor: (y) => (y >= 2034 ? line : Infinity), untaxedSocial } });
    let bound = 0;
    for (const [k, x] of capped.rows.entries()) {
      if (x.year < 2034) { assert.equal(x.conversion, free.rows[k].conversion, `${x.year}: before the line starts, as before`); continue; }
      if (!(x.conversion > 0)) continue;
      const c = counted(x, untaxedSocial);
      assert.ok(c <= line + 1e-6, `${x.year}: ${c} over ${line}`);
      // where the tax rate's own room was not the tighter limit, it lands on the line to a cent
      if (x.taxInfo.bracketRate < 0.22) { assert.ok(line - c < 0.01, `${x.year}: ${c} is the most under ${line}`); bound++; }
    }
    assert.ok(bound >= 2, `${bound} years stop at the line`);
  }
  // a year whose income is over the line before any conversion converts nothing, and its tax is what it was with no conversions
  const none = project({ ...I, rothConversion: null }), zero = project({ ...I, conversionCeiling: { lineFor: () => 1 } });
  assert.equal(zero.totalConverted, 0);
  assert.equal(JSON.stringify(zero.rows.map((x) => [x.taxes, x.balances])), JSON.stringify(none.rows.map((x) => [x.taxes, x.balances])));
  // tax-exempt interest counts toward the line though it is never taxed
  const withMuni = { ...I, incomes: [...I.incomes, { name: "Muni interest", yearly: 20000, personIndex: 0, startAge: 0, cola: true, taxable: false, type: "investment" }] };
  const a = project({ ...I, conversionCeiling: { lineFor: () => line } }), b = project({ ...withMuni, conversionCeiling: { lineFor: () => line } });
  const y = 2035, ra = a.rows.find((x) => x.year === y), rb = b.rows.find((x) => x.year === y);
  assert.ok(rb.conversion > 0 && rb.conversion < ra.conversion, `${ra.conversion} against ${rb.conversion}`);
  const cb = counted(rb, false) + 20000;
  assert.ok(cb <= line + 1e-6 && line - cb < 0.01, `${cb}: the interest is counted, and the year still lands on the line`);
});

test("#26 test 2 (Medicare): two years before anyone's Medicare year, income stays at or under the first surcharge line", () => {
  const today = D26, tier = tiersFor("married_joint")[0][0];
  assert.equal(medicareLine("married_joint"), tier); assert.equal(medicareLine("single"), tiersFor("single")[0][0]); assert.equal(medicareLine(undefined), tiersFor("single")[0][0]);
  // the page's older constant now reads the Medicare page's table too
  assert.equal(IRMAA_FIRST_TIER.married_joint, tier); assert.equal(IRMAA_FIRST_TIER.head_of_household, tiersFor("single")[0][0]);
  const I = buildInputs(earlyRetirees(0.22), { today }).inputs;
  // Ana is 65 in 2037: the first year that counts is 2035 (she is 63), then every year to two before the end of the plan
  const ys = medicareYears(I);
  assert.equal(ys[0], 2035); assert.equal(ys.at(-1), I.endYear - 2, "two years before the last year anyone is on Medicare");
  const before = computeMedicare(withStop(undefined), { today }), after = computeMedicare(withStop("medicare"), { today });
  assert.equal(before.surchargeYears, 3, "the tax rate alone trips the surcharge");
  assert.equal(after.surchargeYears, 0);
  let converted = 0;
  for (const y of after.years) { if (y.conversion > 0) { converted++; assert.ok(y.magiReal <= tier - UNDER + 1e-6, `${y.year}: ${y.magiReal}`); } }
  assert.ok(converted >= 3, `${converted} Medicare years priced on a year with a conversion`);
  // the most under it: the first capped year lands a dollar under the line
  assert.equal(Math.round(Math.max(...after.years.filter((y) => y.conversion > 0).map((y) => y.magiReal))), tier - UNDER);
  // the years before 63 are not capped: 2032 to 2034 convert what the tax rate allows
  const t0 = compute(withStop(undefined), { today }).table, t1 = compute(withStop("medicare"), { today }).table;
  for (const y of [2032, 2033, 2034]) assert.equal(t1.find((r) => r.year === y).conversion, t0.find((r) => r.year === y).conversion, String(y));
  assert.ok(t1.find((r) => r.year === 2035).conversion < t0.find((r) => r.year === 2035).conversion);
  assert.ok(t1.every((r) => !r.irmaa), "no year of the list trips the surcharge now");
});

test("#26 test 3 (marketplace): in the years marketplace cover is bought, income stays at or under the line where the help stops", () => {
  const today = D26;
  const before = computeHealthcare(withStop(undefined), { today }), after = computeHealthcare(withStop("marketplace"), { today });
  assert.equal(before.cliffYears, 4); assert.equal(after.cliffYears, 0);
  assert.equal(after.years.length, 5);
  for (const y of after.years) { assert.ok(y.magi <= y.cliff - UNDER + 1e-6, `${y.year}: ${y.magi} against ${y.cliff}`); assert.ok(y.credit > 0, `${y.year}: the help is kept`); }
  // the line is Healthcare's own figure for the year (four times the poverty line for two), and the marketplace's income counts all of Social Security
  const c = conversionCeiling(withStop("marketplace"), buildInputs(withStop(undefined), { today }).inputs, { today });
  assert.equal(c.kind, "marketplace"); assert.equal(c.untaxedSocial, true);
  assert.deepEqual(c.years.map((y) => y.year), after.years.map((y) => y.year));
  assert.equal(c.years[0].line, after.years[0].cliff); assert.equal(c.lineFor(c.years[0].year), after.years[0].cliff - UNDER); assert.equal(c.lineFor(2050), Infinity);
  assert.equal(conversionCeiling(withStop("medicare"), buildInputs(withStop(undefined), { today }).inputs, { today }).untaxedSocial, false);
  // the years after the last marketplace year convert up to the tax rate again
  const t = compute(withStop("marketplace"), { today }).table;
  assert.ok(t.some((r) => r.year > 2038 && r.conversion > 0));
});

test("#26 test 4: each choice comes with its lifetime tax and health insurance, at the rate shown", () => {
  const today = D26;
  const d = compute(withStop(undefined), { today });
  assert.equal(d.ceiling, "bracket"); assert.equal(d.shown, 0.22);
  assert.deepEqual(d.stops.map((x) => x.key), CEILINGS);
  assert.deepEqual(d.stops.map((x) => x.chosen), [true, false, false]);
  const fig = (x) => [Math.round(x.endAfterTaxReal), Math.round(x.taxesReal), Math.round(x.healthReal)];
  assert.deepEqual(fig(d.stops[0]), [1946730, 251552, 466630]);
  assert.deepEqual(fig(d.stops[1]), [1998997, 235914, 460300]);
  assert.deepEqual(fig(d.stops[2]), [2223933, 240753, 377721]);
  // the tax rate alone is the page's own line for that rate
  const own = d.options.find((o) => o.fillRate === 0.22);
  assert.equal(d.stops[0].endAfterTaxReal, own.endAfterTaxReal); assert.equal(d.stops[0].taxesReal, own.taxesReal); assert.equal(d.stops[0].healthReal, own.healthReal);
  assert.deepEqual([d.stops[1].years[0], d.stops[1].years.at(-1), d.stops[1].line], [2035, 2046, 218000]);
  assert.equal(d.stops[1].turns63, true, "2035 is the year the older of the two turns 63");
  assert.deepEqual([d.stops[2].years, d.stops[2].line], [[2034, 2035, 2036, 2037, 2038], d.options[1].cliffIncome]);
  // saved, a choice is the plan's: every rate is run with it, and its own entry is the plan's line
  const m = compute(withStop("marketplace"), { today });
  assert.equal(m.ceiling, "marketplace"); assert.deepEqual(m.stops.map((x) => x.chosen), [false, false, true]);
  assert.equal(m.stops[2].endAfterTaxReal, m.options.find((o) => o.fillRate === 0.22).endAfterTaxReal);
  assert.deepEqual(m.stops.map(fig), d.stops.map(fig), "the comparison is the same whichever is saved");
  assert.ok(m.options.every((o) => o.cliffYears.length === 0), "no rate passes the line now");
  // a line the conversions never reach is marked (the page then leaves its chip out): at 12% this couple stays under Medicare's
  const low = compute(withStop(undefined, 0.12), { today });
  assert.equal(low.stops[1].sameAsBracket, true); assert.equal(low.stops[2].sameAsBracket, false);
  // a household whose health insurance is not worked out from income (the retired couple): no $0 figure, the gap is said
  const rd = compute(migrate(retiredCouplePlan()), { today });
  assert.deepEqual(rd.stops.map((x) => [x.key, x.healthReal, x.healthPriced]), [["bracket", 0, false], ["medicare", 0, false]]);
  assert.equal(costWords(rd.stops[0]), `Tax over your whole plan: $${Math.round(rd.stops[0].taxesReal).toLocaleString("en-US")}.`);
  // both are past 63 already: the line acts from the first year, so its sentence names no year (critic P5: "from 2026 on" with 2026 nearly over)
  assert.equal(rd.stops[1].turns63, false);
  assert.match(whyWords(rd.stops[1]), /This keeps each year just under it\.$/);
  assert.match(costWords(rd.stops[1]), /so what this saves on premiums is not shown\.$/);
  // nothing to convert, or no years to convert in: no comparison
  const none = earlyRetirees(0.22); none.accounts = none.accounts.filter((a) => a.type !== "401k"); none.retirement.contributions = [];
  assert.deepEqual(compute(none, { today }).stops, []);
});

test("#26 test 5: under the larger-credit rules there is no line, so the marketplace choice caps nothing and says so", () => {
  const today = D26;
  const enhanced = (kind) => withStop(kind, 0.22, { aca: { rules: "enhanced" } });
  assert.equal("conversionCeiling" in buildInputs(enhanced("marketplace"), { today }).inputs, false);
  const a = compute(enhanced(undefined), { today }), b = compute(enhanced("marketplace"), { today });
  assert.equal(strip(b), strip(a), "every figure is the tax rate alone");
  const st = b.stops.find((x) => x.key === "marketplace");
  assert.equal(st.noCliff, true); assert.equal(st.line, null); assert.equal(st.sameAsBracket, true);
  assert.equal(st.share, Math.max(...SCHEDULES.enhanced.bands.map((x) => x[3]))); assert.equal(topShare(), 0.085);
  assert.equal(whyWords(st), "No cliff under these rules: at higher incomes each extra $1 costs 8.5¢ of credit.");
  assert.equal(savedWords(st, { rate: 0.22 }), "Saved. Under the rules you chose for marketplace credits there is no line to stop at, so nothing changes.");
  assert.equal(heroWords(st), "");
  // married filing separately gets no help at all: the marketplace choice is not offered
  const sep = withStop(undefined); sep.household.filingStatus = "married_separate";
  assert.equal(compute(sep, { today }).stops.some((x) => x.key === "marketplace"), false);
});

test("#26 the sentences, one for each case", () => {
  const med = { key: "medicare", line: 218000, years: [2035, 2036, 2037], success: true, endAfterTaxReal: 1998997.2, taxesReal: 235914.4, healthReal: 460299.8 };
  const mkt = { key: "marketplace", line: 86560, years: [2034, 2035, 2036, 2037, 2038], success: true, endAfterTaxReal: 2223933.4, taxesReal: 240753.2, healthReal: 377721 };
  const base = { key: "bracket", years: [], success: true, endAfterTaxReal: 1946729.9, taxesReal: 251551.6, healthReal: 466629.8 };
  assert.deepEqual(CHIP, { bracket: "No earlier stop", medicare: "Under Medicare's income surcharge", marketplace: "Under the marketplace credit line" });
  assert.equal(whyWords(med), "Medicare charges more for its monthly premiums when your income two years earlier was over about $218,000. This keeps each year just under it.");
  assert.equal(whyWords({ ...med, turns63: true }), "Medicare charges more for its monthly premiums when your income two years earlier was over about $218,000. This keeps each year just under it, from the year someone turns 63 (2035).");
  assert.equal(whyWords(mkt), "The help with marketplace health insurance stops when your income passes about $86,560. This keeps each year you buy that cover (2034 to 2038) just under it.");
  assert.equal(whyWords({ ...mkt, years: [2034] }), "The help with marketplace health insurance stops when your income passes about $86,560. This keeps the year you buy that cover (2034) just under it.");
  assert.equal(whyWords({ ...mkt, years: [2034, 2036, 2037] }), "The help with marketplace health insurance stops when your income passes about $86,560. This keeps each year you buy that cover (3 years from 2034 to 2037) just under it.");
  assert.equal(whyWords(base), "");
  assert.equal(diffWords(base, base), "");
  // the figure carries its noun (critic P2: beside a line about tax and premiums, a bare "more" read as more cost)
  assert.equal(diffWords(med, base), "$52,267 more left at the end");
  assert.equal(diffWords({ ...med, endAfterTaxReal: 1900000 }, base), "$46,730 less left at the end");
  assert.equal(diffWords({ ...med, endAfterTaxReal: base.endAfterTaxReal + 0.2 }, base), "the same at the end");
  assert.equal(diffWords({ ...med, success: false, failYear: 2061 }, base), "runs out 2061");
  assert.equal(diffWords(med, { ...base, success: false, failYear: 2060 }), "lasts to the end");
  assert.equal(costWords(base), "Tax over your whole plan: $251,552; health insurance: $466,630.");
  assert.equal(costWords(mkt), "Tax over your whole plan: $240,753; health insurance: $377,721.");
  assert.equal(costWords({ ...med, sameAsBracket: true }), "Tax over your whole plan: $235,914; health insurance: $460,300. It never comes into play: your conversions already stay under it.");
  // health insurance already inside the plan's spending: no premium figure, and the line says its saving is not counted
  assert.equal(costWords({ ...base, healthPriced: false, healthReal: 0 }), "Tax over your whole plan: $251,552.");
  assert.equal(costWords({ ...med, healthPriced: false, healthReal: 0 }), "Tax over your whole plan: $235,914. Your health insurance is counted inside your spending, so what this saves on premiums is not shown.");
  assert.equal(savedWords(med, { rate: 0.22 }), "Saved: each year's conversion now stops under Medicare's income surcharge. At the 22% rate that leaves about $1,998,997 at the end, after tax.");
  assert.equal(savedWords(mkt, { rate: 0.12 }), "Saved: each year's conversion now stops under the marketplace credit line. At the 12% rate that leaves about $2,223,933 at the end, after tax.");
  assert.equal(savedWords(base, { rate: 0.22 }), "Saved: conversions fill the tax rate again, with no earlier stop. At the 22% rate that leaves about $1,946,730 at the end, after tax.");
  assert.equal(savedWords({ ...med, success: false, failYear: 2061 }, { rate: 0.22 }), "Saved: each year's conversion now stops under Medicare's income surcharge. At the 22% rate the money runs out in 2061.");
  // conversions off: the plan converts nothing, so no end figure is quoted as its result (critic P1)
  assert.equal(savedWords(med, { rate: 0.22, on: false }), "Saved: conversions will stop under Medicare's income surcharge. It counts once conversions are on in your plan.");
  assert.equal(savedWords(mkt, { rate: 0.22, on: false }), "Saved: conversions will stop under the marketplace credit line. It counts once conversions are on in your plan.");
  assert.equal(savedWords(base, { rate: 0.22, on: false }), "Saved: no earlier stop. It counts once conversions are on in your plan.");
  assert.equal(idleWords("medicare"), "Your plan is set to stop each year's conversion under Medicare's income surcharge. With nothing to convert now, it does nothing.");
  assert.equal(idleWords("marketplace"), "Your plan is set to stop each year's conversion under the marketplace credit line. With nothing to convert now, it does nothing.");
  assert.equal(heroWords(med), "Each year also stops under Medicare's income surcharge, as you chose.");
  assert.equal(heroWords(mkt), "Each year also stops under the marketplace credit line, as you chose.");
  assert.equal(heroWords(base), ""); assert.equal(heroWords(null), ""); assert.equal(heroWords({ ...med, years: [] }), "");
  // the status beside "Conversion settings": never more than 20 characters
  const all = [statusWords({ on: true, fillRate: 0.22, ceiling: "bracket" }), statusWords({ on: false, fillRate: 0.22, ceiling: "bracket" }), statusWords({ on: true, fillRate: 0.24, ceiling: "medicare" }), statusWords({ on: false, fillRate: 0.22, ceiling: "marketplace" })];
  assert.deepEqual(all, ["on, at the 22% rate", "off", "24%, stops sooner", "off, stops sooner"]);
  for (const s of all) assert.ok(s.length <= 20, s);
});

test("#26 the page: the chips sit inside Conversion settings, only for a line that changes this plan; a tap saves and says the new answer", async () => {
  const VIEW = new URL("./view.js", import.meta.url).href;
  const chips = (r) => r.root.all().filter((e) => e.tagName === "BUTTON" && /chip/.test(e.className ?? e.getAttribute?.("class") ?? "")).map((e) => e.textContent);
  // at 22% both lines change a year: three chips, the tax rate alone is on
  const d26 = compute(withStop(undefined), { today: D26 });
  const r = await renderPage(VIEW, withStop(undefined), D26);
  assert.deepEqual(chips(r), ["No earlier stop", "Under Medicare's income surcharge", "Under the marketplace credit line"]);
  const t = r.text();
  assert.match(t, /Stop sooner \(optional\)/);
  assert.match(t, /Under the marketplace credit line \$277,203 more left at the end\. Tax over your whole plan: \$240,753; health insurance: \$377,721\./);
  assert.match(t, /Under Medicare's income surcharge \$52,267 more left at the end\. Tax over your whole plan: \$235,914; health insurance: \$460,300\./);
  // where each line is explained, the way out is named by its row and by what it does (critic P3: no orphan "it")
  assert.ok(t.includes('a year. "Stop sooner" in Conversion settings keeps you under that line.'), t);
  assert.ok(t.includes('The figures below count that charge. "Stop sooner" in Conversion settings avoids it.'));
  assert.ok(!t.includes("Conversion settings can stop under it"));
  assert.match(t, /A conversion adds to your income\. These stop it before a bigger bill starts\./);
  assert.match(t, /This keeps each year just under it, from the year someone turns 63 \(2035\)\./);
  assert.match(t, /No earlier stop yours Tax over your whole plan/, "conversions are on: the plan's own choice is marked");
  assert.ok(d26.stops.every((x) => x.healthPriced === true));
  assert.ok(!t.includes("as you chose"));
  r.root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Under the marketplace credit line").click();
  assert.equal(r.saved.at(-1).retirement.conversionCeiling, "marketplace");
  // saved: the answer says so, the part's status too, and going back takes the field off again
  const r2 = await renderPage(VIEW, withStop("marketplace"), D26);
  const t2 = r2.text();
  assert.match(t2, /Each year also stops under the marketplace credit line, as you chose\./);
  assert.match(t2, /22%, stops sooner/);
  assert.match(t2, /Stopping sooner: each year converts the most that keeps your income under the line you chose/);
  r2.root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "No earlier stop").click();
  assert.equal("conversionCeiling" in r2.saved.at(-1).retirement, false);
  // at 12% the couple never reaches Medicare's line: that chip is not offered
  assert.deepEqual(chips(await renderPage(VIEW, withStop(undefined, 0.12), D26)), ["No earlier stop", "Under the marketplace credit line"]);
  // under the larger-credit rules: one sentence, never a chip that does nothing
  const r3 = await renderPage(VIEW, withStop(undefined, 0.12, { aca: { rules: "enhanced" } }), D26);
  assert.deepEqual(chips(r3), []);
  assert.match(r3.text(), /The marketplace credit line: no cliff under these rules: at higher incomes each extra \$1 costs 8\.5¢ of credit\./);
  // conversions off (critic P1, P4): nothing is "yours" yet, and a tap's green line quotes no end figure as the plan's result
  const r4 = await renderPage(VIEW, earlyRetirees(null), D26);
  assert.deepEqual(chips(r4), ["No earlier stop", "Under Medicare's income surcharge", "Under the marketplace credit line"]);
  const t4 = r4.text(), list4 = t4.slice(t4.indexOf("it counts once conversions are in your plan:"));
  assert.match(list4, /^it counts once conversions are in your plan: No earlier stop Tax over your whole plan/);
  assert.ok(!list4.includes("yours"), list4);
  r4.root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Under Medicare's income surcharge").click();
  assert.equal(r4.saved.at(-1).retirement.conversionCeiling, "medicare");
  const offSaved = earlyRetirees(null); offSaved.retirement.conversionCeiling = "medicare";
  const t5 = (await renderPage(VIEW, offSaved, D26)).text();
  assert.match(t5, /Saved: conversions will stop under Medicare's income surcharge\. It counts once conversions are on in your plan\./);
  assert.ok(!/Saved:[^.]*\.[^.]*leaves about/.test(t5), "no end figure while the plan converts nothing");
  assert.match(t5, /Conversion settings off, stops sooner/);
  // a line saved earlier, then the pre-tax money goes (critic M1): no chips are drawn, so one outlined button takes it off
  const gone = withStop("medicare"); gone.accounts = gone.accounts.filter((a) => a.type !== "401k"); gone.retirement.contributions = [];
  assert.deepEqual(compute(gone, { today: D26 }).stops, []);
  const r6 = await renderPage(VIEW, gone, D26);
  assert.ok(r6.text().includes(idleWords("medicare")));
  const takeOff = r6.root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Remove that stop");
  assert.match(takeOff.className ?? takeOff.getAttribute("class"), /secondary/);
  takeOff.click();
  assert.equal("conversionCeiling" in r6.saved.at(-1).retirement, false);
  const clean = withStop(undefined); clean.accounts = clean.accounts.filter((a) => a.type !== "401k"); clean.retirement.contributions = [];
  const t7 = (await renderPage(VIEW, clean, D26)).text();
  assert.ok(!t7.includes("Remove that stop") && !t7.includes("Conversion settings"), "with no line saved, a plan with nothing to convert shows no settings");
  // a plan no line touches shows nothing new
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const plain = migrate(retirementPlan()); plain.retirement.rothConversion = { on: true, fillRate: 0.1, untilAge: null }; plain.retirement.taxMode = "brackets";
  const d = compute(plain, { today: D26 });
  if (d.stops.every((x) => x.key === "bracket" || x.sameAsBracket)) assert.ok(!(await renderPage(VIEW, plain, D26)).text().includes("Stop sooner"));
});
