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
  assert.ok(/only works out conversions before 73/.test(text) && /once each year's required amount is out/.test(text), text.slice(0, 600));
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
  assert.equal(buttons.filter((b) => /^Use this|^Convert at the/.test(b.textContent)).length, kept.length);
  // a plan that runs out at once converts nothing on any setting: nothing to use
  assert.ok(compute(migrate(shortSavingsRetiree()), { today: "2026-11-06" }).options.every((o) => !o.offer));
});
test("round 8 review UX 3 and 4: a saved setting that leaves less than the best one is said so, with the switch; the lost help says what it is compared with", async () => {
  const { text, buttons, saved } = await rothPage(earlyRetirees(0.12));
  // 12% leaves $2,191,158, the 10% bracket $2,291,778 and no conversions $2,207,021
  assert.ok(/Your plan converts at the 12% rate: that leaves about \$100,620 less than the 10% rate, and \$15,863 less than none\. Mostly because it gives up more of the help with health insurance before 65\./.test(text), text.slice(0, 1600));
  const sw = buttons.filter((b) => /^Convert at the 10% rate instead/.test(b.textContent));
  assert.equal(sw.length, 1); sw[0].click();
  assert.equal(saved().retirement.rothConversion.on, true); assert.equal(saved().retirement.rothConversion.fillRate, 0.10);
  assert.ok(/Year by year, your plan's setting: the 12% rate/.test(text));
  assert.ok(/\$121,102 less help with health insurance before 65 than with no conversions/.test(text));
  // the best one saved: no such line
  assert.ok(!/Your plan converts/.test((await rothPage(earlyRetirees(0.10))).text));
});
test("round 8 review UX 9: with no years to convert in, the page carries no note about setting a figure 'on this page'", async () => {
  const { text } = await rothPage(widow());
  assert.ok(!/set your own figure on this page/.test(text), text);
  // with years to convert in, the note stays, saying where to change it by the page's own name (batch 5b UX 18: not "the Projection page")
  const full = (await rothPage(migrate(fullBracketRetiree()))).text;
  assert.ok(/Spending is today's expenses; change it under Retirement settings on Will the money last\?/.test(full) && !/on this page|Projection page/.test(full), full);
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
  assert.ok(/This page uses the real tax rates; your plan uses a flat 15% until you turn conversions on\./.test(w.first), w.first.slice(0, 900));
  for (const word of JARGON) assert.ok(!word.test(w.first), `${word} on the first screen: ${w.first}`);
  assert.ok(!/up to 10%/.test(w.first), "never 'up to 10%'");
  assert.ok(w.paras.every((p) => p.length <= 160), w.paras.filter((p) => p.length > 160).join(" | "));
  const go = w.buttons.filter((b) => /^Convert at the 10% rate$/.test(b.textContent));
  assert.equal(go.length, 1); assert.ok(/secondary/.test(go[0].attrs?.class ?? ""), "outlined for a small gain");
  go[0].click();
  assert.deepEqual([w.saved().retirement.rothConversion.on, w.saved().retirement.rothConversion.fillRate, w.saved().retirement.taxMode], [true, 0.10, "brackets"]);
  const after = await firstScreen(w.saved());
  assert.ok(new RegExp(`Done: your plan now converts at the 10% rate: about ${h(best.moves[0].real)} in 2028, then about ${h(later)} a year from 2033 to 2040\\. It also works out tax at the real rates now, not a flat 15%: that alone changes what Will the money last\\? says\\.`).test(after.first), after.first.slice(0, 900));
  // UX 10 and 11: each rate against not converting; the ones that leave less are folded away with no button
  assert.ok(/No conversions yours Keeps it all pre-tax\. At the 10% rate best \$6,702 more Moves about \$113,780 in all\./.test(w.first), w.first);
  assert.ok(!/At the 12% rate/.test(w.first), "12% leaves less: folded");
  const all = await rothPage(migrate(bridgeCouple()));
  assert.ok(/Other rates: each leaves less than not converting \(3\) › At the 12% rate \$[\d,]+ less/.test(all.text), all.text);
  assert.equal(all.buttons.filter((b) => /^Use this/.test(b.textContent)).length, 0, "no button on a rate that leaves less");
  assert.ok(/Will the money last\? counts 401\(k\) and IRA money at its full value before tax, so its "left at the end" is a different figure\. It also uses a flat 15% until conversions are on\./.test(w.fold), w.fold.slice(0, 900));
  // the year by year list and the rules are in the fold
  assert.ok(/Year by year, the best way: the 10% rate/.test(w.fold) && /Five years/i.test(w.fold), w.fold.slice(0, 500));
});
test("5b page: the years named are the years it converts in, and a late start says why (UX review 13)", async () => {
  const { earlyRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const d = compute(migrate(earlyRetiree()), { today: "2026-11-06" });
  const best = d.options.find((o) => o.best);
  assert.ok(best.moves[0].year > d.span.from, "conversions start after the window opens");
  const w = await firstScreen(migrate(earlyRetiree()));
  assert.ok(new RegExp(`in ${best.moves[0].year} to about \\$[\\d,]+ in ${best.moves.at(-1).year}`).test(w.first) && !new RegExp(`from ${d.span.from} to`).test(w.first), w.first.slice(0, 400));
  // Kim, 45: the gain is small and the wait is explained; the year rows say "no tax that year", not "taxed at up to 10%"
  assert.ok(/^Roth conversions Converting makes little difference for you: about \$4,948 more at the end, after tax\./.test(w.first), w.first.slice(0, 300));
  // every year it converts in owes no tax (the deduction covers the move), so the page does not say "taxed at 10%" (seen on the
  // phone, 2026-11-06); the wait is said as what the setting does, not as "nothing could be converted"
  assert.ok(d.table.every((r) => r.taxes < 0.5));
  assert.ok(new RegExp(`It would move to a Roth from about \\$[\\d,]+ in 2048 to about \\$[\\d,]+ in 2055, with no tax to pay in those years\\.`).test(w.first) && !/each taxed at/.test(w.first), w.first.slice(0, 500));
  assert.ok(/Until 2048, your other income fills the 10% rate \(investment gains and dividends count\), so this converts nothing before then\./.test(w.first), w.first);
  assert.ok(/2048 · age 67 \$292 no other taxed income · no tax that year/.test(w.fold) && !/taxed at up to/.test(w.fold), w.fold);
  assert.ok(w.buttons.filter((b) => /^Convert at the 10% rate$/.test(b.textContent)).every((b) => /secondary/.test(b.attrs?.class ?? "")));
});
test("5b page: the early retirees' plan (saved on 12%) and the widow read plain words first", async () => {
  const e = await firstScreen(earlyRetirees(0.12));
  assert.ok(/^Roth conversions Move to a Roth from about \$[\d,]+ in 2032 to about \$[\d,]+ in 2037, then about \$[\d,]+ a year from 2041 to 2046\. Each move is taxed at the lowest rate, 10%, and leaves about \$84,757 more at the end, after tax\./.test(e.first), e.first.slice(0, 700));
  assert.ok(/Before 65, what you convert counts as income for the help with health insurance, which stops once income passes about \$86,560 a year\./.test(e.first), e.first.slice(0, 900));
  for (const word of JARGON) assert.ok(!word.test(e.first), `${word}: ${e.first}`);
  assert.ok(e.paras.every((p) => p.length <= 160), e.paras.filter((p) => p.length > 160).join(" | "));
  // the widow: what she can still do, and why it can pay, in two short lines
  const w = await firstScreen(widow());
  // batch 5b UX review 12: a do or don't, in two short lines
  assert.ok(/^Roth conversions You can still move money to a Roth once each year's required amount is out\. You pay the tax on it now, at your rate\. It pays off only if your heirs would pay a higher rate on an inherited IRA later\./.test(w.first), w.first.slice(0, 600));
  assert.ok(/only works out conversions before 73/.test(w.fold), w.fold);
  assert.ok(w.paras.every((p) => p.length <= 160), w.paras.filter((p) => p.length > 160).join(" | "));
});
test("5b review: when the money runs out either way, the page says so in plain words and points on with a button, not a link in the sentence", async () => {
  const { taxedDrawRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const plan = migrate(taxedDrawRetiree());
  const d = compute(plan, { today: "2026-11-06" });
  assert.equal(d.verdict, "fails");
  const w = await firstScreen(plan);
  assert.ok(new RegExp(`^Roth conversions The money runs out in ${d.none.failYear} with or without conversions\\. Conversions move tax around; they do not add money\\. Will the money last\\? shows what would fix the plan\\. Will the money last\\?`).test(w.first), w.first.slice(0, 400));
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
