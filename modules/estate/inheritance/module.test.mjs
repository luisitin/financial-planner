import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, netOf, KINDS, LATER_YEARS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withItems = (items) => { const p = familyPlan(TODAY); p.estate.inheritance = { items }; return p; };

test("what arrives: cash and Roth whole, an IRA less income tax, a house less selling costs", () => {
  assert.equal(netOf({ amount: 100000, kind: "cash" }, 0.15), 100000);
  assert.equal(netOf({ amount: 100000, kind: "roth" }, 0.15), 100000);
  assert.equal(netOf({ amount: 100000, kind: "ira" }, 0.15), 85000);
  assert.ok(Math.abs(netOf({ amount: 100000, kind: "home" }, 0.15) - 94000) < 1e-9);
  assert.equal(netOf({ amount: 100000, kind: "nonsense" }, 0.15), 100000);
  assert.equal(Object.keys(KINDS).length, 4);
});

test("nothing expected: the plan alone", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.withIt, null); assert.equal(d.extraMonthly, 0);
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("an inheritance: more left at the end, more to spend; half as much and later in between", () => {
  const d = compute(withItems([{ id: "a", from: "Parents", amount: 120000, year: 2044, kind: "ira" }, { id: "b", from: "Parents", amount: 260000, year: 2048, kind: "home" }]), { today: TODAY });
  assert.equal(d.total, 380000); assert.ok(Math.abs(d.net - (120000 * (1 - d.taxRate) + 260000 * 0.94)) < 1e-6);
  assert.ok(d.withIt.endReal > d.base.endReal); assert.ok(d.extraMonthly > 0);
  assert.ok(d.half.affordableMonthly > d.base.affordableMonthly && d.half.affordableMonthly < d.withIt.affordableMonthly);
  assert.ok(d.later.affordableMonthly < d.withIt.affordableMonthly);
  assert.equal(LATER_YEARS, 10);
});

test("a year in the past or missing counts from this year; the plan itself is untouched", () => {
  const p = withItems([{ id: "a", amount: 50000, year: 1999, kind: "cash" }, { id: "b", amount: 1, kind: "cash" }]);
  const d = compute(p, { today: TODAY });
  assert.equal(d.items[0].year, 2026); assert.equal(d.items[1].year, 2026);
  assert.deepEqual(p.estate.inheritance.items[0].year, 1999);
});

// ---------------------------------------------------------------- an inherited IRA: emptying it within 10 years (gap #36)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drawPlans, pastRbdOf, bornOf, emptying, emptyingSentence, eligibleNote, wayWords, answerSentence, savedLine, heirsOf, mainWay, emptyingSays, emptyingSaved, bridgeSentence, partTitles, NO_INCOME, EMPTY_YEARS, EMPTYING_KINDS, EMPTYING_MAX } from "./compute.js";
import { SINGLE_LIFE, singleLife, inheritedDivisor, UNIFORM_LIFETIME, rmdFactor, rmdStartYear } from "../../../core/math/rmd.js";
import { federalTax } from "../../../core/math/tax.js";
import { known } from "../../taxes/federal/known.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { migrate } from "../../../core/schema/migrate.js";
import { ARCHETYPES } from "../../../qa/households/lib/catalog.mjs";

const NOW = "2026-11-13";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const usd = (n) => `$${(Math.round(n / 10) * 10).toLocaleString("en-US")}`;

test("the Single Life Table: 121 ages as published, 120 and over 1.0; the other table is untouched", () => {
  assert.equal(SINGLE_LIFE.length, 121);
  // 26 CFR 1.401(a)(9)-9(b) and Publication 590-B (2025) Appendix B Table I
  for (const [age, v] of [[0, 84.6], [16, 69.0], [30, 55.3], [45, 41.0], [50, 36.2], [57, 29.8], [65, 22.9], [70, 18.8], [75, 14.8], [76, 14.1], [80, 11.2], [90, 5.7], [100, 2.8], [106, 2.1], [112, 2.0], [119, 1.1], [120, 1.0]]) assert.equal(SINGLE_LIFE[age], v, `age ${age}`);
  for (let a = 1; a <= 120; a++) assert.ok(SINGLE_LIFE[a] <= SINGLE_LIFE[a - 1], `never rises at ${a}`);
  assert.equal(singleLife(50.9), 36.2); assert.equal(singleLife(135), 1.0); assert.equal(singleLife(null), null); assert.equal(singleLife(""), null); assert.equal(singleLife("x"), null);
  assert.equal(UNIFORM_LIFETIME[73], 26.5); assert.equal(rmdFactor(71), Infinity);
});

test("the divisor: the heir's table figure less 1 a year; the owner's when that is longer; never under 1", () => {
  assert.equal(inheritedDivisor(1, 50), 36.2);
  near(inheritedDivisor(4, 50), 33.2);
  // an heir of 80 and an owner who died at 70: the owner's 18.8 less 1 is longer than the heir's 11.2
  near(inheritedDivisor(1, 80, 70), 17.8); near(inheritedDivisor(3, 80, 70), 15.8);
  near(inheritedDivisor(1, 50, 85), 36.2);
  assert.equal(inheritedDivisor(9, 110), 1); assert.equal(inheritedDivisor(1, null, 70), null);
});

test("evenly: one tenth, then one ninth of what is left, and nothing is left after year 10", () => {
  const flat = drawPlans({ balance: 100000, growth: 0 }).even;
  assert.equal(flat.length, EMPTY_YEARS);
  for (const r of flat) near(r.draw, 10000);
  const g = 0.03, rows = drawPlans({ balance: 300000, growth: g }).even;
  near(rows[0].draw, 30000); near(rows[1].start, 270000 * 1.03); near(rows[1].draw, 270000 * 1.03 / 9);
  for (const r of rows) near(r.draw, r.start / (11 - r.k));
  near(rows[9].draw, rows[9].start);                      // year 10 takes all that is left
  near((rows[9].start - rows[9].draw) * (1 + g), 0);
  // each year's withdrawal is the one before it grown by g: an even share in today's dollars
  for (let i = 1; i < 10; i++) near(rows[i].draw, rows[i - 1].draw * (1 + g), 1e-6);
});

test("as required: the balance over the table's figure each year, and year 10 takes the rest", () => {
  const g = 0.03, rows = drawPlans({ balance: 300000, growth: g, heirAge: 50 }).required;
  near(rows[0].draw, 300000 / 36.2);
  near(rows[1].start, (300000 - 300000 / 36.2) * 1.03); near(rows[1].draw, rows[1].start / 35.2);
  for (const r of rows.slice(0, 9)) near(r.draw, r.start / (36.2 - (r.k - 1)));
  near(rows[9].draw, rows[9].start); assert.ok(rows[9].draw > rows[8].draw * 10);
  // the owner's longer figure makes the yearly amounts smaller
  const older = drawPlans({ balance: 300000, growth: g, heirAge: 80, ownerAge: 70 }).required;
  near(older[0].draw, 300000 / 17.8);
  // an heir of 115: the figure would fall under 1, so everything comes out at once
  const old = drawPlans({ balance: 1000, growth: 0, heirAge: 119 }).required;
  near(old[0].draw, 1000 / 1.1); near(old[1].draw, old[1].start);
  assert.equal(drawPlans({ balance: 300000, growth: g }).required, null);   // no age: not worked out
});

test("all in year 10: nothing for nine years, then the whole grown balance; a bad balance is nothing", () => {
  const rows = drawPlans({ balance: 100000, growth: 0.03 }).last;
  assert.equal(rows.slice(0, 9).reduce((s, r) => s + r.draw, 0), 0);
  near(rows[9].draw, 100000 * 1.03 ** 9);
  assert.equal(drawPlans({ balance: -5, growth: 0.03 }).even.reduce((s, r) => s + r.draw, 0), 0);
  assert.equal(drawPlans({ balance: "x" }).last[9].draw, 0);
});

test("had the person begun required withdrawals: what was typed, else from the birth year and the year of death", () => {
  assert.deepEqual(pastRbdOf({ pastRbd: "yes", fromBirthYear: 1990 }, 2030), { past: "yes", from: "typed" });
  assert.deepEqual(pastRbdOf({ pastRbd: "no", fromBirthYear: 1930 }, 2030), { past: "no", from: "typed" });
  assert.equal(rmdStartYear("1955"), 2028);              // 73 in 2028; the first withdrawal is due by April 1, 2029
  assert.deepEqual(pastRbdOf({ fromBirthYear: 1955 }, 2030), { past: "yes", from: "age" });
  assert.deepEqual(pastRbdOf({ fromBirthYear: 1955 }, 2029), { past: "unsure", from: "age" });   // before or after April 1
  assert.deepEqual(pastRbdOf({ fromBirthYear: 1955 }, 2028), { past: "no", from: "age" });
  assert.deepEqual(pastRbdOf({ pastRbd: "unsure", fromBirthYear: 1962 }, 2040), { past: "yes", from: "age" });   // 75 in 2037
  assert.deepEqual(pastRbdOf({ pastRbd: "unsure" }, 2040), { past: "unsure", from: "unknown" });
  assert.deepEqual(pastRbdOf({}, 2040), { past: "unsure", from: "unknown" });
});

const IRA = { id: "a", from: "Mom", amount: 300000, year: 2030, kind: "ira" };
const one = (item, change) => { const p = familyPlan(NOW); p.estate.inheritance = { items: [item] }; if (change) change(p); return emptying(p, { today: NOW }); };

test("the tax on a year's withdrawal: this year's federal tax with it minus without, while the household works", () => {
  const p = familyPlan(NOW); p.estate.inheritance = { items: [IRA] };
  const E = emptying(p, { today: NOW }), e = E.items[0];
  assert.equal(E.taxYear, 2026); assert.equal(E.filingStatus, "married_joint");
  near(E.growth, (1 + 0.7 * 0.07 + 0.3 * 0.04) / 1.03 - 1, 1e-12);
  assert.equal(e.year, 2030); assert.equal(e.endYear, 2040); assert.equal(e.heirId, "p-ana"); assert.equal(e.heirAge, 2031 - 1990);
  const fed = taxInputs(p, { today: NOW }), base = known(p, { today: NOW }).inputs;
  const r = e.plans.even.rows[0];
  assert.equal(r.year, 2031); near(r.draw, 30000);
  near(r.tax, federalTax({ ...base, otherOrdinary: base.otherOrdinary + 30000 }, fed.params).totalTax - federalTax(base, fed.params).totalTax, 1e-6);
  assert.ok(r.tax > 30000 * 0.2 && r.tax < 30000 * 0.3, `the family's next dollars are taxed at about 22%: ${r.tax}`);
  // the totals add up, and one big year costs more than ten even ones
  for (const w of Object.values(e.plans)) { near(w.tax, w.rows.reduce((s, x) => s + x.tax, 0)); near(w.taken, w.rows.reduce((s, x) => s + x.draw, 0)); near(w.kept, w.taken - w.tax); }
  assert.ok(e.plans.last.tax > e.plans.even.tax * 1.2, `${e.plans.last.tax} against ${e.plans.even.tax}`);
  assert.ok(e.plans.last.tax / e.plans.last.taken > e.plans.even.tax / e.plans.even.taken);
  assert.equal(e.plans.last.taxLow, e.plans.last.taxHigh); assert.equal(e.plans.last.taxHigh, e.plans.last.rows[9].tax);
  assert.ok(e.plans.required.rows[9].tax > e.plans.required.rows[0].tax * 10);
});

test("the tax after the household retires counts on top of what the plan expects that year, not today's pay", () => {
  const e = one({ ...IRA, amount: 100000, year: 2060 }).items[0];
  const working = one({ ...IRA, amount: 100000, year: 2030 }).items[0];
  assert.ok(e.plans.even.tax < working.plans.even.tax, "retired on a smaller income: the same money is taxed less");
  assert.ok(e.plans.even.tax > 0);
  // past the end of the plan the last year's income is used; nothing throws
  assert.ok(one({ ...IRA, year: 2084 }).items[0].plans.even.tax > 0);
  // no plan to speak of: taxed on its own, at the single rates
  const bare = migrate(emptyPlan()); bare.estate.inheritance = { items: [IRA] };
  const b = emptying(bare, { today: NOW }).items[0];
  assert.ok(b.plans.even.tax > 0 && b.plans.even.tax < working.plans.even.tax);
  assert.equal(b.heirAge, null); assert.equal(b.plans.required, null); assert.deepEqual(b.offered, ["even", "last"]);
});

test("which ways the rule allows: both unknown, withdrawals begun, not begun", () => {
  assert.deepEqual(one(IRA).items[0].offered, ["even", "required", "last"]);
  assert.deepEqual(one({ ...IRA, pastRbd: "yes" }).items[0].offered, ["even", "required"]);
  assert.deepEqual(one({ ...IRA, pastRbd: "no" }).items[0].offered, ["even", "last"]);
  const byAge = one({ ...IRA, fromBirthYear: 1950 }).items[0];
  assert.equal(byAge.past, "yes"); assert.equal(byAge.pastFrom, "age"); assert.deepEqual(byAge.offered, ["even", "required"]);
  // the owner's age (80 in 2030) does not beat a 41-year-old's own figure
  near(byAge.plans.required.rows[0].draw, 300000 / SINGLE_LIFE[41]);
  // how many of the three boxes hold something; "not sure" is not one
  assert.equal(one(IRA).items[0].set, 0); assert.equal(one({ ...IRA, pastRbd: "unsure" }).items[0].set, 0);
  assert.equal(one({ ...IRA, pastRbd: "no", fromBirthYear: 1950, heirId: "p-bo" }).items[0].set, 3);
  assert.equal(one({ ...IRA, heirId: "nobody" }).items[0].set, 0);
});

test("which of you inherits: 'Me' unless chosen; the other adult's age and name", () => {
  const p = familyPlan(NOW);
  assert.deepEqual(heirsOf(p).map((x) => x.id), ["p-ana", "p-bo"]);
  const bo = one({ ...IRA, pastRbd: "yes", heirId: "p-bo" }).items[0];
  assert.equal(bo.heirName, "Bo"); assert.equal(bo.heirAge, 2031 - 1988);
  near(bo.plans.required.rows[0].draw, 300000 / SINGLE_LIFE[43]);
  assert.equal(one({ ...IRA, heirId: "p-cy" }).items[0].heirId, "p-ana");   // a child of the household is not offered
});

test("a Roth IRA: no tax, nothing year by year, empty within 10 years", () => {
  const e = one({ ...IRA, kind: "roth", pastRbd: "yes" }).items[0];
  assert.deepEqual(e.offered, ["last", "even"]); assert.equal(e.past, "no");
  for (const w of [e.plans.even, e.plans.last, e.plans.required]) { assert.equal(w.tax, 0); assert.ok(w.rows.every((r) => r.tax === 0)); near(w.kept, w.taken); }
  near(e.plans.last.taken, 300000 * (1 + one(IRA).growth) ** 9);
  assert.equal(emptyingSentence(e, usd), `A Roth IRA you inherit is not taxed when you take the money out, and nothing has to come out year by year. It must be empty by the end of 2040. Left to grow until then, about ${usd(e.plans.last.taken)} would come out, with no tax.`);
  assert.deepEqual(wayWords(e, "last", usd), { title: "All in 2040", value: "no tax", when: "", detail: `about ${usd(e.plans.last.taken)} after 10 years of growth` });
  assert.deepEqual(wayWords(e, "even", usd), { title: "Evenly over 10 years", value: "no tax", when: "", detail: "about $30,000 out in the first year, a little more each year after" });
});

test("the sentence, one per case: withdrawals begun, begun with no age, not begun, not known, not known with no age", () => {
  const yes = one({ ...IRA, pastRbd: "yes" }).items[0];
  assert.equal(emptyingSentence(yes, usd), `The person was already taking required withdrawals, so some has to come out every year, and all of it by the end of 2040. Taking it out evenly would cost about ${usd(yes.plans.even.tax)} of federal tax in all; taking only the yearly minimum and the rest in 2040, about ${usd(yes.plans.required.tax)}.`);
  const noAge = (extra) => one({ ...IRA, ...extra }, (p) => { for (const x of p.household.people) delete x.birthDate; }).items[0];
  const yesNoAge = noAge({ pastRbd: "yes" });
  assert.equal(yesNoAge.plans.required, null);
  assert.equal(emptyingSentence(yesNoAge, usd), `The person was already taking required withdrawals, so some has to come out every year, and all of it by the end of 2040. Taking it out evenly would cost about ${usd(yesNoAge.plans.even.tax)} of federal tax in all. How much is required each year depends on your age: add your birth date on People to see it.`);
  const no = one({ ...IRA, pastRbd: "no" }).items[0];
  assert.equal(emptyingSentence(no, usd), `Nothing has to come out year by year, but all of it has to be out by the end of 2040. Taking it out evenly would cost about ${usd(no.plans.even.tax)} of federal tax in all; leaving it all to 2040, about ${usd(no.plans.last.tax)}.`);
  const unsure = one(IRA).items[0];
  assert.equal(emptyingSentence(unsure, usd), `All of it has to be out by the end of 2040. If the person was already taking required withdrawals, some has to come out every year too: the firm that holds the account can tell you. Taking it out evenly would cost about ${usd(unsure.plans.even.tax)} of federal tax in all.`);
  const unsureNoAge = noAge({});
  assert.equal(emptyingSentence(unsureNoAge, usd), `All of it has to be out by the end of 2040. If the person was already taking required withdrawals, some has to come out every year too: the firm that holds the account can tell you, and with your birth date on People this page can show how much. Taking it out evenly would cost about ${usd(unsureNoAge.plans.even.tax)} of federal tax in all.`);
  for (const e of [yes, yesNoAge, no, unsure, unsureNoAge]) assert.doesNotMatch(emptyingSentence(e, usd), /NaN|undefined|null/);
});

test("each way's row: its name, its tax, and when it applies if that is not known", () => {
  const u = one(IRA).items[0];
  const pct = (w) => `${Math.round(w.tax / w.taken * 100)}%`;
  assert.deepEqual(wayWords(u, "even", usd), { title: "Evenly over 10 years", value: `${usd(u.plans.even.tax)} tax`, when: "", detail: `about ${usd(u.plans.even.tax / 10)} of tax a year, ${pct(u.plans.even)} of what comes out` });
  assert.deepEqual(wayWords(u, "required", usd), { title: "Only the yearly minimum, the rest in 2040", value: `${usd(u.plans.required.tax)} tax`, when: "if the person had already started taking money out",
    detail: `about ${usd(u.plans.required.rows[0].draw)} out in the first year; ${usd(u.plans.required.rows[9].tax)} of the tax falls in 2040; ${pct(u.plans.required)} of what comes out` });
  assert.deepEqual(wayWords(u, "last", usd), { title: "All in 2040", value: `${usd(u.plans.last.tax)} tax`, when: "only if the person had not yet started taking money out", detail: `all of the tax in one year, ${pct(u.plans.last)} of what comes out` });
  assert.equal(wayWords(one({ ...IRA, pastRbd: "yes" }).items[0], "required", usd).when, "");
  assert.equal(wayWords(one({ ...IRA, pastRbd: "no" }).items[0], "last", usd).when, "");
});

test("the eligible-heir note: the list, or the heir's own case when the birth years are close", () => {
  const LIST = "A spouse, a minor child, someone disabled or chronically ill, or someone not more than 10 years younger has other choices; a spouse can treat it as their own.";
  assert.equal(eligibleNote(one(IRA).items[0]), LIST);                                  // the person's birth year not known
  const far = one({ ...IRA, fromBirthYear: 1955 }).items[0];
  assert.equal(far.close, false); assert.equal(eligibleNote(far), LIST);                // a parent: 35 years older
  const sib = one({ ...IRA, fromBirthYear: 1984 }).items[0];
  assert.equal(sib.close, true);
  assert.equal(eligibleNote(sib), "By the birth years, Ana is not more than 10 years younger than the person who died. Someone that close in age, a spouse, a minor child, or someone disabled or chronically ill has other choices: they can spread the withdrawals over their lifetime instead, and a spouse can treat the account as their own.");
  assert.equal(one({ ...IRA, fromBirthYear: 1980 }).items[0].close, true);              // exactly 10 years by the years
  assert.equal(one({ ...IRA, fromBirthYear: 1979 }).items[0].close, false);
  assert.equal(one({ ...IRA, fromBirthYear: 1995 }).items[0].close, true);              // the heir is the older one
  assert.match(eligibleNote({ close: true, heirName: "" }), /^By the birth years, the one who inherits is not more/);
});

test("the answer's sentence, one per case, and the green line that names the new answer", () => {
  const run = (success, endReal, failYear = null) => ({ success, endReal, failYear, affordableMonthly: 0 });
  assert.equal(answerSentence({ withIt: run(true, 500000), base: run(false, 0, 2071) }, usd), "With it your money lasts to the end of the plan; without it, it runs out in 2071. It would leave about $500,000 at the end (today's dollars).");
  assert.equal(answerSentence({ withIt: run(true, 900000), base: run(true, 600000) }, usd), "The plan would end with about $900,000 instead of $600,000 (today's dollars).");
  assert.equal(answerSentence({ withIt: run(false, 0, 2075), base: run(false, 0, 2071) }, usd), "Even with it the money runs out, in 2075 instead of 2071.");
  assert.equal(answerSentence({ withIt: run(false, 0, 2071), base: run(false, 0, 2071) }, usd), "Even with it the money runs out in 2071, as it does without it.");
  assert.equal(savedLine("Added.", { ready: true, withIt: run(true, 1), extraMonthly: 412 }, usd), "Added. If it comes, you could spend about $410 a month more in retirement.");
  assert.equal(savedLine("Removed.", { ready: true, withIt: null }, usd), "Removed.");
  assert.equal(savedLine("Added.", { ready: false }, usd), "Added.");
});

// ---- invariance: the three optional boxes change nothing compute() gives; only an IRA or a Roth IRA gets the ten years
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
async function everyPlan() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of ["family-plan.mjs", "renter-debt-plan.mjs", "retired-couple-plan.mjs", "retirement-plan.mjs"]) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const NEW_FIELDS = { pastRbd: "yes", heirId: "p-nobody", fromBirthYear: 1950 };
const strip = (d) => JSON.stringify(d, (k, v) => (k in NEW_FIELDS ? undefined : v));

test("invariance: with the new boxes absent compute() is what it was, and filled in they change no figure of it", async () => {
  const ALL = await everyPlan();
  assert.ok(ALL.length >= 19, `${ALL.length} plans`);
  let ran = 0;
  for (const { name, plan } of ALL) {
    // no plan has the fields today, and migrate adds none
    for (const p of [plan, migrate(structuredClone(plan))]) for (const x of p.estate?.inheritance?.items ?? []) for (const k of Object.keys(NEW_FIELDS)) assert.equal(x[k], undefined, `${name}: ${k}`);
    // the plan as it is: nothing to empty, and asking changes nothing in the plan
    const asIs = structuredClone(plan), before = JSON.stringify(asIs);
    if (!(asIs.estate?.inheritance?.items ?? []).some((x) => EMPTYING_KINDS.includes(x.kind))) assert.deepEqual(emptying(asIs, { today: NOW }).items, [], name);
    assert.equal(JSON.stringify(asIs), before, `${name}: emptying() reads only`);
    // an inheritance of every kind, without the boxes and with them: compute() says the same, the boxes aside
    const mk = (extra) => { const p = structuredClone(plan); p.estate = p.estate ?? {}; p.estate.inheritance = { items: Object.keys(KINDS).map((kind, i) => ({ id: `k${i}`, from: "Aunt Di", amount: 90000, year: 2040, kind, ...extra })) }; return p; };
    const bare = compute(mk({}), { today: NOW }), filled = compute(mk(NEW_FIELDS), { today: NOW });
    assert.equal(strip(filled), JSON.stringify(bare), `${name}: the boxes move no figure of compute()`);
    assert.equal(strip(filled), strip(bare));
    // only the IRA and the Roth IRA get the ten years; the same answer for them whatever the other kinds hold
    const E = emptying(mk({}), { today: NOW });
    assert.deepEqual(E.items.map((x) => x.kind), ["ira", "roth"], name);
    const alone = structuredClone(mk({})); alone.estate.inheritance.items = alone.estate.inheritance.items.filter((x) => x.kind === "ira");
    assert.equal(JSON.stringify(emptying(alone, { today: NOW }).items[0]), JSON.stringify(E.items[0]), `${name}: other kinds do not move an IRA's figures`);
    ran++;
  }
  assert.equal(ran, ALL.length);
});

test("invariance: compute()'s own figures for an IRA are the ones it gave before this part was built", () => {
  // what arrives is still the amount less the plan's flat tax rate; the ten years are shown beside it, never in it
  const p = familyPlan(TODAY); p.estate.inheritance = { items: [{ id: "a", from: "Parents", amount: 120000, year: 2044, kind: "ira", ...NEW_FIELDS }] };
  const d = compute(p, { today: TODAY });
  assert.equal(d.net, 120000 * (1 - d.taxRate)); assert.equal(d.items[0].net, d.net);
  assert.deepEqual(Object.keys(d).sort(), ["base", "endGain", "extraMonthly", "half", "items", "later", "missing", "net", "ready", "spendingMonthly", "taxRate", "total", "withIt"].sort());
  assert.equal(EMPTYING_MAX, 4);
});

// ---------------------------------------------------------------- the page (simple first, docs/OPTIONAL.md), drawn on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
FakeElement.prototype.reset ??= function () {};          // the stand-in DOM has no form reset (the add form empties itself after Add)
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { render } = await import("./view.js");
const all = (el) => [el, ...el.all()];
/** The page for a plan, redrawn after every save as the shell does; computeRemote answers at once. */
function page(plan0) {
  const s = { plan: migrate(structuredClone(plan0)), saved: [], root: null };
  const go = () => {
    s.root = new FakeElement("main");
    render(s.root, { ui, fmt: { ...fmt, today: () => NOW }, plan: s.plan, route: { group: "estate", id: "inheritance", rest: [], query: {} }, module: { group: "estate", id: "inheritance" },
      computeRemote: (key, prm) => ({ then: (ok) => ok(compute(s.plan, prm)) }),
      store: { get: () => s.plan, update: (fn) => { const d = structuredClone(s.plan); fn(d); s.saved.push(d); s.plan = d; go(); } }, redraw: go });
  };
  go();
  return s;
}
const partsOf = (root) => all(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partNamed = (root, id) => partsOf(root).find((e) => e.dataset.part === id);
const openOf = (root) => partsOf(root).map((e) => [e.dataset.part, e.hasAttribute("open")]);
/** The words a person sees without opening anything (a shut part shows only its summary). */
function seen(el) {
  if (el.tagName === "STYLE") return "";
  if (el.tagName === "DETAILS" && !el.hasAttribute("open")) return textOf(el.children.find((k) => k.tagName === "SUMMARY") ?? el);
  return (el.childNodes ?? []).map((k) => (k.tagName ? seen(k) : String(k.textContent ?? k.data ?? k))).join(" ");
}
const fam = (items) => { const p = familyPlan(NOW); p.estate.inheritance = { items }; return p; };

test("the first view, nothing entered: what the page is for, the five boxes, one filled button; the rest one tap away", () => {
  const { root } = page(familyPlan(NOW));
  const t = seen(root).replace(/\s+/g, " ");
  assert.match(t, /An inheritance you might receive/);
  assert.match(t, /Add what you might receive/);
  assert.doesNotMatch(t, /Emptying it/); assert.doesNotMatch(t, /no federal inheritance tax/);
  assert.deepEqual(openOf(root), [["how", false]]);
  const how = partNamed(root, "how");
  assert.equal(textOf(how.querySelector(".fold-title")), "How this is worked out");
  assert.match(textOf(how), /There is no federal inheritance tax/); assert.match(textOf(how), /IRS Publication 590-B \(2025\)/); assert.match(textOf(how), /Read November 13, 2026/);
  assert.match(t, /More on this/); assert.match(t, /Could care in later life use it up first\?/);
  assert.equal(all(root).filter((e) => e.tagName === "FORM").length, 1);
});

test("the first view with an IRA: the answer, the cases and the list; its ten years are one shut row saying the tax", () => {
  const s = page(fam([IRA, { id: "h", from: "Mom", amount: 200000, year: 2030, kind: "home" }]));
  const t = seen(s.root).replace(/\s+/g, " ");
  assert.match(t, /If it comes/); assert.match(t, /The plan would end with about \$[\d,]+ instead of \$[\d,]+ \(today's dollars\)\./);
  assert.match(t, /\+ Add another inheritance/);
  const e = emptying(s.plan, { today: NOW }).items[0];
  const row = partNamed(s.root, "empty-a");
  assert.ok(row && !row.hasAttribute("open"), "shut until tapped");
  assert.equal(row.dataset.kind, "item");
  assert.equal(textOf(row.querySelector(".fold-title")), "Emptying it within 10 years");
  assert.equal(textOf(row.querySelector(".fold-status")), `about ${usd(e.plans.even.tax)} tax in all`);   // P2: an estimate, and of all ten years
  // P1: the answer's flat-rate figure and the year-by-year tax are bridged in words, with the answer's own figure
  const d0 = compute(s.plan, { today: NOW });
  assert.ok(textOf(row).replace(/\s+/g, " ").includes(bridgeSentence(d0.items[0].net, d0.taxRate, usd)));
  assert.match(bridgeSentence(255000, 0.15, usd), /^Above, this account counts as \$255,000 after tax: your plan's usual tax rate \(15%\) taken off in one go\. Here the tax is worked out year by year, on top of your other income, so the two do not match\.$/);
  assert.doesNotMatch(textOf(row), /income is not entered/);
  assert.equal(partNamed(s.root, "empty-h"), undefined, "a house has no ten years");
  assert.doesNotMatch(t, /required withdrawals/); assert.doesNotMatch(t, /Evenly over 10 years/);
  // inside: the sentence, the three ways with their tax, the note on who has other choices, what the tax is, and three boxes
  const inside = textOf(row).replace(/\s+/g, " ");
  assert.ok(inside.includes(emptyingSentence(e, usd)));
  for (const k of ["even", "required", "last"]) { const w = wayWords(e, k, usd); assert.ok(inside.includes(w.title) && inside.includes(w.value) && inside.includes(w.detail), k); }
  assert.ok(inside.includes(eligibleNote(e)));
  assert.match(inside, /Federal income tax only, at this year's rates and in today's dollars.*it is not tax advice\./);
  assert.deepEqual(all(row).filter((x) => x.tagName === "SELECT" || x.tagName === "INPUT").map((x) => x.getAttribute("name")), ["pastRbd", "fromBirthYear", "heirId"]);
  assert.equal(all(row).filter((x) => x.tagName === "DETAILS" && x !== row).length, 1, "the form's one More details line");
  assert.doesNotMatch(textOf(s.root), /NaN|undefined|null|\[object/);
  assert.equal(s.saved.length, 0, "drawing and reading save nothing");
});

test("several inherited accounts: each its own named row; a Roth IRA has no boxes; at most four rows", () => {
  const s = page(fam([IRA, { id: "r", from: "Dad", amount: 50000, year: 2035, kind: "roth" }, { id: "x", amount: 10000, year: 2035, kind: "ira" }, { id: "y", amount: 10000, year: 2035, kind: "ira" }, { id: "z", amount: 10000, year: 2035, kind: "ira" }]));
  assert.deepEqual(partsOf(s.root).map((e) => textOf(e.querySelector(".fold-title"))), ["How this is worked out", "Emptying the IRA from Mom", "Emptying the Roth IRA from Dad", "Emptying an IRA (1)", "Emptying an IRA (2)"]);
  // F5: the fifth account has no row, and the page says so
  assert.match(textOf(s.root), /The first 4 inherited accounts each have a row here\. The same rules hold for the other one\./);
  assert.doesNotMatch(textOf(page(fam([IRA])).root), /inherited accounts each have a row/);
  assert.deepEqual(partTitles([{ kind: "ira", from: "Dad" }]), ["Emptying it within 10 years"]);
  assert.deepEqual(partTitles([{ kind: "ira", from: "Dad" }, { kind: "roth", from: "" }]), ["Emptying the IRA from Dad", "Emptying a Roth IRA"]);
  const roth = partNamed(s.root, "empty-r");
  assert.equal(textOf(roth.querySelector(".fold-status")), "no tax");
  assert.equal(all(roth).filter((x) => x.tagName === "FORM").length, 0);
  assert.match(textOf(roth), /A Roth IRA you inherit is not taxed/); assert.match(textOf(roth), /the person who died first put money in a Roth IRA at least five years before the money comes out/);
  assert.doesNotMatch(textOf(roth), /Above, this account counts/);
});

test("S11: saving inside an IRA's part keeps that part open, says so with the new figure, and moves no other part", () => {
  const s = page(fam([IRA, { id: "r", from: "Dad", amount: 50000, year: 2035, kind: "roth" }]));
  const before = openOf(s.root);
  assert.deepEqual(before, [["how", false], ["empty-a", false], ["empty-r", false]]);
  const form = () => all(partNamed(s.root, "empty-a")).find((e) => e.tagName === "FORM");
  form().querySelector('[name="pastRbd"]').value = "yes";
  form().querySelector('[name="fromBirthYear"]').value = "1950";
  form().querySelector('[name="heirId"]').value = "p-bo";
  form().dispatch("submit");
  assert.equal(s.saved.length, 1);
  const x = s.plan.estate.inheritance.items[0];
  assert.deepEqual({ pastRbd: x.pastRbd, fromBirthYear: x.fromBirthYear, heirId: x.heirId }, { pastRbd: "yes", fromBirthYear: 1950, heirId: "p-bo" });
  assert.deepEqual({ ...x, pastRbd: undefined, fromBirthYear: undefined, heirId: undefined }, { ...IRA, pastRbd: undefined, fromBirthYear: undefined, heirId: undefined }, "nothing else of the item moved");
  assert.deepEqual(openOf(s.root), [["how", false], ["empty-a", true], ["empty-r", false]]);
  const e = emptying(s.plan, { today: NOW }).items[0];
  const part = partNamed(s.root, "empty-a");
  assert.ok(textOf(part).replace(/\s+/g, " ").includes(`Saved. Taking it out evenly would cost about ${usd(e.plans.even.tax)} of federal tax in all.`));
  assert.equal(textOf(part.querySelector(".fold-status")), "3 set by you");
  assert.doesNotMatch(textOf(part), /All in 2040/, "withdrawals had begun: leaving it all to the last year is not offered");
  // "Not sure", an empty year and "Me" take the three boxes out of the plan again
  form().querySelector('[name="pastRbd"]').value = "unsure";
  form().querySelector('[name="fromBirthYear"]').value = "";
  form().querySelector('[name="heirId"]').value = "p-ana";
  form().dispatch("submit");
  assert.deepEqual(s.plan.estate.inheritance.items[0], IRA);
  assert.deepEqual(openOf(s.root), [["how", false], ["empty-a", true], ["empty-r", false]]);
  // P5: the part saved in is still open when the page is drawn again with nothing just saved (Back), until the person shuts it
  const again = page(s.plan);
  assert.deepEqual(openOf(again.root), [["how", false], ["empty-a", true], ["empty-r", false]]);
  const el = partNamed(again.root, "empty-a"); el.removeAttribute("open"); el.dispatch("toggle");
  assert.deepEqual(openOf(page(s.plan).root), [["how", false], ["empty-a", false], ["empty-r", false]]);
});

test("S11, two accounts: a save in the second leaves the first, saved in before, open", () => {
  const s = page(fam([{ ...IRA, id: "s1" }, { ...IRA, id: "s2", from: "Dad" }]));
  const save = (id) => { const f = all(partNamed(s.root, id)).find((e) => e.tagName === "FORM"); f.querySelector('[name="pastRbd"]').value = "no"; f.dispatch("submit"); };
  save("empty-s1");
  assert.deepEqual(openOf(s.root), [["how", false], ["empty-s1", true], ["empty-s2", false]]);
  save("empty-s2");
  assert.deepEqual(openOf(s.root), [["how", false], ["empty-s1", true], ["empty-s2", true]]);
  for (const id of ["empty-s1", "empty-s2"]) { const el = partNamed(s.root, id); el.removeAttribute("open"); el.dispatch("toggle"); }
});

test("F1: an old heir of someone who had begun withdrawals is not offered an even share that is under the yearly minimum", () => {
  const old = (extra) => one({ ...IRA, amount: 100000, year: 2027, fromBirthYear: 1935, ...extra }, (p) => { p.household.people.find((x) => x.id === "p-ana").birthDate = "1938-01-01"; }).items[0];
  const e = old({ pastRbd: "yes" });
  assert.equal(e.heirAge, 90); assert.equal(e.evenShort, true);
  assert.ok(e.plans.even.rows[0].draw < e.plans.required.rows[0].draw, "an even tenth is less than the balance over 5.7");
  near(e.plans.required.rows[0].draw, 100000 / SINGLE_LIFE[90]);
  assert.deepEqual(e.offered, ["required"]); assert.equal(mainWay(e), "required");
  // every way offered takes at least the required amount in every year
  for (const k of e.offered) e.plans[k].rows.slice(0, 9).forEach((r, i) => assert.ok(r.draw >= e.plans.required.rows[i].draw - 1e-9, `${k} year ${r.k}`));
  assert.equal(emptyingSentence(e, usd), `The person was already taking required withdrawals, so some has to come out every year, and all of it by the end of 2037. At the age of the one who inherits, the yearly minimum is more than an even share, so it cannot be spread evenly: taking the yearly minimum would cost about ${usd(e.plans.required.tax)} of federal tax in all.`);
  assert.equal(emptyingSays(e, usd), `about ${usd(e.plans.required.tax)} tax in all`);
  assert.equal(emptyingSaved(e, "Saved.", usd), `Saved. Taking the yearly minimum would cost about ${usd(e.plans.required.tax)} of federal tax in all.`);
  // the yearly minimum has it all out before the last year: the row does not speak of a rest
  const last = e.plans.required.rows.filter((r) => r.draw > 0).at(-1);
  assert.ok(last.year < e.endYear);
  assert.deepEqual(wayWords(e, "required", usd), { title: "Only the yearly minimum", value: `${usd(e.plans.required.tax)} tax`, when: "", detail: `about ${usd(e.plans.required.rows[0].draw)} out in the first year, all of it out by ${last.year}; ${Math.round(e.plans.required.tax / e.plans.required.taken * 100)}% of what comes out` });
  // not known whether they had begun: evenly stays, saying when it is allowed
  const u = old({ fromBirthYear: undefined });
  assert.equal(u.past, "unsure"); assert.deepEqual(u.offered, ["even", "required", "last"]);
  assert.equal(wayWords(u, "even", usd).when, "only if the person had not yet started taking money out");
  // had not begun: nothing is required, evenly is fine
  assert.deepEqual(old({ pastRbd: "no" }).offered, ["even", "last"]);
  // a younger heir: an even share is always more than the minimum, nothing changes
  const y = one({ ...IRA, pastRbd: "yes" }).items[0];
  assert.equal(y.evenShort, false); assert.deepEqual(y.offered, ["even", "required"]); assert.equal(wayWords(one(IRA).items[0], "even", usd).when, "");
  y.plans.even.rows.slice(0, 9).forEach((r, i) => assert.ok(r.draw >= y.plans.required.rows[i].draw));
  assert.equal(emptyingSaved(y, "Saved.", usd), `Saved. Taking it out evenly would cost about ${usd(y.plans.even.tax)} of federal tax in all.`);
});

test("F2: with no income entered the row asks for it instead of saying $0, and the part says the tax is too low", () => {
  const bare = migrate(emptyPlan()); bare.estate.inheritance = { items: [{ ...IRA, amount: 100000 }, { ...IRA, id: "r", kind: "roth" }] };
  const E = emptying(bare, { today: NOW });
  assert.equal(E.noIncome, true); assert.equal(E.items[0].plans.even.tax, 0);
  assert.equal(emptyingSays(E.items[0], usd, E.noIncome), "needs your income");
  assert.equal(emptyingSays(E.items[1], usd, E.noIncome), "no tax");
  const s = page(bare), row = partNamed(s.root, "empty-a");
  assert.equal(textOf(row.querySelector(".fold-status")), "needs your income");
  assert.ok(textOf(row).replace(/\s+/g, " ").includes(`${NO_INCOME} Add what you earn on Income`));
  assert.ok(all(row).some((x) => x.tagName === "A" && x.getAttribute("href") === "#/cashflow/income"));
  assert.doesNotMatch(textOf(partNamed(s.root, "empty-r")), /income is not entered/);
  // a household with pay, and a retired one living on pensions: there is income
  assert.equal(one(IRA).noIncome, false);
  for (const a of ARCHETYPES) { const p = a.build(); assert.equal(emptying(p, { today: NOW }).noIncome, false, a.id); }
});

test("F4: a hand-edited birth year outside 1900 to this year is not known, and a year with a fraction is rounded", () => {
  assert.equal(bornOf({ fromBirthYear: 1950 }, 2026), 1950); assert.equal(bornOf({ fromBirthYear: "1950.4" }, 2026), 1950);
  for (const bad of [2100, 1000000, 1899, -5, "x", null, undefined, NaN]) assert.equal(bornOf({ fromBirthYear: bad }, 2026), null, String(bad));
  for (const bad of [2100, 1000000, 1850]) {
    const e = one({ ...IRA, fromBirthYear: bad }).items[0];
    assert.equal(e.past, "unsure"); assert.equal(e.pastFrom, "unknown"); assert.equal(e.close, null); assert.equal(e.set, 0);
    assert.equal(JSON.stringify(e), JSON.stringify(one(IRA).items[0]), `${bad} is read as no birth year`);
  }
  assert.deepEqual(pastRbdOf({ fromBirthYear: 2100 }, 2030), { past: "unsure", from: "unknown" });
  const f = one({ ...IRA, year: 2030.7 }).items[0];
  assert.equal(f.year, 2031); assert.equal(f.endYear, 2041); assert.ok(f.plans.even.rows.every((r) => Number.isInteger(r.year)));
});

test("adding one confirms itself with the new answer; removing says so", () => {
  const s = page(familyPlan(NOW));
  const form = all(s.root).find((e) => e.tagName === "FORM");
  form.querySelector('[name="amount"]').value = "150000";
  form.querySelector('[name="kind"]').value = "ira";
  form.dispatch("submit");
  assert.equal(s.plan.estate.inheritance.items.length, 1);
  assert.match(textOf(s.root), /Added\. If it comes, you could spend about \$[\d,]+ a month more in retirement\./);
  assert.ok(partNamed(s.root, "empty-" + s.plan.estate.inheritance.items[0].id), "the IRA's ten years are there, shut");
  assert.deepEqual(openOf(s.root).map((x) => x[1]), [false, false]);
});
