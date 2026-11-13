// modules/overview/quick/module.test.mjs -- the list and its rule: every row opens a usable page that saves only
// calculator inputs, quotes or a goal by its own button, never a record other pages count.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { compute, MOST_ASKED, MORE, NEEDS_FIRST, ALLOWED_WRITES, quickHref, questionFor } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { journeyById } from "../guide/compute.js";

const MODS = fileURLToPath(new URL("../../", import.meta.url));
const manifest = (key) => { const f = `${MODS}${key}/module.js`; return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
/** Pages that do not answer on an empty plan today (the 2026-10-31 sweep): never listed as quick. */
const NOT_QUICK_YET = ["debt/payoff", "debt/credit-cards", "debt/consolidation", "debt/student-loans", "debt/ratios", "cashflow/paycheck", "cashflow/budget-percent", "goals/emergency-fund", "retirement/fire", "retirement/projection", "insurance/life-needs", "taxes/self-employment", "goals/education", "taxes/withholding", "goals/goals", "goals/travel"];
const ALL = [...MOST_ASKED, ...MORE];

test("at most 8 to start with, no page twice, every title a question and every line a sentence", () => {
  assert.ok(MOST_ASKED.length <= 8 && MOST_ASKED.length >= 4);
  assert.equal(new Set(ALL.map((q) => q.key)).size, ALL.length);
  for (const q of [...ALL, ...NEEDS_FIRST]) { assert.match(q.title, /\?$/, q.title); assert.match(q.line, /^[A-Z].*\.$/, q.line); }
});
test("every row is a usable page that answers on an empty plan and saves nothing other pages count", () => {
  for (const q of ALL) {
    const src = manifest(q.key);
    assert.ok(src, `${q.key} exists`);
    assert.match(src, /status: "(usable|complete)"/, `${q.key} is usable`);
    assert.ok(!NOT_QUICK_YET.includes(q.key), `${q.key} does not answer on an empty plan yet`);
    const writes = JSON.parse((src.match(/writes: (\[[^\]]*\])/) ?? [null, "[]"])[1]);
    for (const w of writes) assert.ok(ALLOWED_WRITES.includes(w), `${q.key} writes ${w}`);
  }
});
test("questions that need numbers first open a real guide", () => {
  for (const n of NEEDS_FIRST) assert.ok(journeyById(n.guide), n.guide);
});
test("rows open their page with ?from=quick; pages off on this device are left out", () => {
  assert.equal(quickHref("goals/house"), "#/goals/house?from=quick");
  const d = compute(emptyPlan());
  assert.equal(d.mostAsked.length, MOST_ASKED.length);
  assert.equal(d.mostAsked[0].href, "#/goals/house?from=quick");
  assert.equal(d.needsFirst[0].href, "#/overview/guide/retire");
  const off = compute(emptyPlan(), { off: ["goals/house", "investments/risk", "overview/guide"] });
  assert.ok(!off.mostAsked.some((q) => q.key === "goals/house"));
  assert.ok(!off.more.some((q) => q.key === "investments/risk"));
  assert.equal(off.needsFirst.length, 0);
  assert.equal(questionFor("goals/house").title, "How much home can I afford?");
  assert.equal(questionFor("nope/nope"), null);
});

test("the plan's own answers: the sample family's three questions answer at once, an empty plan keeps the guides", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { compute, questionFor } = await import("./compute.js");
  const { compute: projection } = await import("../../retirement/projection/compute.js");
  const T = "2026-11-01";
  const p = familyPlan(T);
  const d = compute(p, { today: T });
  assert.deepEqual(d.answers.map((a) => a.guide), ["retire", "debt", "taxes", "protect", "budget"]);
  assert.deepEqual(d.needsFirst, []);
  const by = Object.fromEntries(d.answers.map((a) => [a.guide, a]));
  assert.equal(by.retire.headline, projection(p, { today: T }).verdict === "on track" ? "The money lasts" : by.retire.headline, "the answer page's own heading");
  assert.match(by.debt.headline, /^Debt-free by [A-Z][a-z]+ \d{4}$/);
  // the question is "what will I owe": the April bill or refund first (withholding estimated from pay), the year's tax in the line
  assert.match(by.taxes.headline, /^(Owe about \$[\d,]+ in April|About \$[\d,]+ back in April|About right: no big bill or refund)$/);
  assert.match(by.taxes.line, /of federal tax for 2026 .*your paychecks take out about \$[\d,]+, estimated from your pay\.$/);
  assert.equal(by.retire.href, "#/retirement/projection?from=quick");
  assert.equal(questionFor("debt/payoff").title, "When will I be debt-free?", "the answer page shows the question on top");
  // a page switched off on this device: its question goes back to the guide
  const off = compute(p, { today: T, off: ["debt/payoff"] });
  assert.deepEqual(off.answers.map((a) => a.guide), ["retire", "taxes", "protect", "budget"]);
  assert.deepEqual(off.needsFirst.map((n) => n.guide), ["debt"]);
  const e = compute(emptyPlan(), { today: T });
  assert.deepEqual(e.answers, []);
  assert.deepEqual(e.needsFirst.map((n) => n.guide), ["retire", "debt", "taxes", "protect", "budget"]);
});

test("the retirement answer names its figure as the average-market one, a year at a time (review 2026-11-02)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute } = await import("./compute.js");
  const by = Object.fromEntries(compute(familyPlan("2026-11-02"), { today: "2026-11-02" }).answers.map((a) => [a.guide, a]));
  // the family's plan adds health cover on top of its spending (the projection's health line), and says so
  assert.match(by.retire.line, /^You plan to spend \$[\d,]+ a year plus health insurance\. If markets do as well as average, your plan can pay for (about )?\$[\d,]+ a year; less after a run of bad years \(see the Will the money last\? page\)\./);
});

test("Review 2026-11-06: the tax answer, filing separately, says each return's own bill or refund (not \"About $540 back in April\")", async () => {
  const { answerFor } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T); p.household.filingStatus = "married_separate";
  p.whatIfs = { ...(p.whatIfs ?? {}), benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const a = answerFor("taxes", p, { today: T });
  assert.equal(a.headline, "Bo owes about $1,660; Ana gets about $2,200 back");
  assert.equal(a.status, "warn"); assert.match(a.line, /^Filing separately, each return settles on its own\./);
  // filing jointly the household's answer stays (5,253 since round 8: the 20% business deduction comes after AGI, as Form 1040
  // line 13 takes it, so the family's AGI is 1,338 higher and the child care credit a step lower: 30 more tax; it read 5,223)
  assert.match(answerFor("taxes", familyPlan(T), { today: T }).headline, /^Owe about \$5,253 in April$/);
});

test("round 8 review UX 3: the widow's tax answer leads with having tax held back, not 'past due', and says her rate as the Federal estimate does", async () => {
  const { answerFor } = await import("./compute.js");
  const { widowPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const a = answerFor("taxes", widowPlan(), { today: "2026-11-06" });
  assert.equal(a.headline, "Have about $3,600 of tax held back from your IRA withdrawal by December 31");
  assert.ok(!/past due/.test(a.line), a.line);
  assert.match(a.line, /^About \$3,965 of federal tax for 2026 \(6\.0% of your income\), and you have not entered any tax withheld\./);
  assert.match(a.line, /about \$4,000 leaves nothing to pay in April/);
});

test("round 8 fix: credits above the tax read as no federal income tax and what comes back, never \"About $0 ... (-5.7% of your income)\"", () => {
  // Jo, head of household, 30,000 of pay, one child, 900 a month of care (the Bracket explorer's case): the care credit takes
  // all 585 of income tax and 1,700 of the child tax credit is refundable, so the year's tax is -1,700
  const p = emptyPlan(); p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  const a = compute(p, { today: "2026-11-02" }).answers.find((x) => x.guide === "taxes");
  assert.ok(a, "a tax answer");
  assert.ok(a.line.startsWith("No federal income tax for 2026: the credits are about $1,700 more than the tax"), a.line);
  assert.ok(!/-\d+(\.\d)?%/.test(a.line) && !a.line.includes("About $0"), a.line);
});

test("life insurance and saving: answered in the answer pages' own words, or opening their guides (stress test j-one-answer/A4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { protectionGaps } = await import("../../insurance/life-needs/compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = familyPlan("2026-11-11");
  const d = compute(p, { today: "2026-11-11" });
  const life = d.answers.find((a) => a.guide === "protect");
  assert.equal(life.headline, protectionGaps(p, { today: "2026-11-11" })[0].title);
  assert.equal(life.href, "#/insurance/life-needs?from=quick");
  assert.ok(d.answers.find((a) => a.guide === "budget").line.includes("of pay"));
  const e = compute(emptyPlan(), { today: "2026-11-11" });
  assert.deepEqual(e.needsFirst.map((x) => x.guide), ["retire", "debt", "taxes", "protect", "budget"]);
});

// ================================================================ "Will my savings last?" in three boxes (gap #2, 2026-11-13)
// The history is Damodaran's 1928-2025 (modules/retirement/historical/data/returns.js, 98 years). One stretch per start
// year: take the year's amount at its start, then grow by the year's mix of stocks and bonds less the fee, then shrink by
// that year's rise in prices (today's dollars). README "Will my savings last?".
const Q = await import("./compute.js");
const { RETURNS } = await import("../../retirement/historical/data/returns.js");
const { savingsLast, runStretch, safeMonthly, lastInputs, lastWords, LAST_DEFAULTS } = Q;
// a three-year history worked by hand (README "A hand example")
const TOY = [
  { year: 2000, stocks: 0.10, bonds: 0, inflation: 0 },
  { year: 2001, stocks: -0.20, bonds: 0.05, inflation: 0.02 },
  { year: 2002, stocks: 0.30, bonds: 0, inflation: 0 },
];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ""} ${a} vs ${b}`);
const MIX = { stocks: 0.6, fee: 0 };

test("gap #2, test 1: a hand example, two stretches of two years", () => {
  // 2000-01: 100,000 - 12,000 = 88,000; x 1.05 (half of +10%, half of 0%) = 92,400; - 12,000 = 80,400; x 0.925 / 1.02
  near(runStretch(0, { saved: 100000, yearly: 12000, years: 2, stocks: 0.5, fee: 0 }, TOY).end, 80400 * 0.925 / 1.02, "2000");
  // 2001-02: 88,000 x 0.925 / 1.02 = 79,803.92; - 12,000 = 67,803.92; x 1.15
  near(runStretch(1, { saved: 100000, yearly: 12000, years: 2, stocks: 0.5, fee: 0 }, TOY).end, (88000 * 0.925 / 1.02 - 12000) * 1.15, "2001");
  const a = savingsLast({ saved: 100000, monthly: 1000, years: 2, stocks: 0.5, fee: 0 }, TOY);
  assert.equal(a.windows, 2); assert.equal(a.lasted, 2); assert.equal(a.case, "all");
  assert.equal(a.hardest.start, 2000, "the least left"); near(a.hardest.end, 80400 * 0.925 / 1.02);
  near(a.medianEnd, (80400 * 0.925 / 1.02 + (88000 * 0.925 / 1.02 - 12000) * 1.15) / 2, "median of two");
  // the most that lasts both: 2001 binds, W <= 100,000 x 0.925/1.02 / (1 + 0.925/1.02) = 47,557.84 a year, 3,963.15 a month
  assert.equal(a.safeMonthly, 3960);
  // 4,000 a month (48,000 a year): 2000 lasts (5,985.29 left), 2001 cannot pay its second year
  const b = savingsLast({ saved: 100000, monthly: 4000, years: 2, stocks: 0.5, fee: 0 }, TOY);
  assert.equal(b.lasted, 1); assert.equal(b.case, "often");
  assert.deepEqual([b.hardest.start, b.hardest.failYear, b.hardest.yearsPaid], [2001, 2, 1]);
  near(runStretch(0, { saved: 100000, yearly: 48000, years: 2, stocks: 0.5, fee: 0 }, TOY).end, 6600 * 0.925 / 1.02);
  // the real history, 97 years: two stretches, starting 1928 and 1929
  const c = savingsLast({ saved: 1000000, monthly: 3000, years: 97, ...MIX });
  assert.deepEqual([c.windows, c.from, c.lastStart, c.to], [2, 1928, 1929, 2025]);
});

test("gap #2, test 2: one stretch per start year, 98 - N + 1 of them", () => {
  assert.equal(RETURNS.length, 98, "1928 to 2025");
  for (const n of [1, 20, 25, 30, 35, 60, 98]) assert.equal(savingsLast({ saved: 500000, monthly: 2000, years: n, ...MIX }).windows, 98 - n + 1, `${n} years`);
  assert.equal(savingsLast({ saved: 500000, monthly: 2000, years: 30, ...MIX }).windows, 69);
});

test("gap #2, tests 3 and 4: nothing taken out always lasts; more than the savings fails in the first year", () => {
  for (const n of [1, 30, 98]) { const a = savingsLast({ saved: 250000, monthly: 0, years: n, ...MIX }); assert.equal(a.lasted, a.windows, `${n} years`); }
  const b = savingsLast({ saved: 100000, monthly: 9000, years: 30, ...MIX });   // 108,000 a year from 100,000
  assert.equal(b.lasted, 0); assert.equal(b.case, "never");
  for (let s = 0; s < b.windows; s++) assert.equal(runStretch(s, { saved: 100000, yearly: 108000, years: 30, ...MIX }).failYear, 1, String(RETURNS[s].year));
  assert.equal(b.hardest.yearsPaid, 0);
});

test("gap #2, test 5: the safe amount lasts in every stretch and $10 more fails one", () => {
  for (const [saved, years, stocks, fee] of [[1000000, 30, 0.6, 0], [400000, 25, 0.4, 0.01], [2500000, 35, 0.8, 0.0025], [120000, 20, 0.6, 0]]) {
    const safe = safeMonthly({ saved, years, stocks, fee });
    assert.equal(safe % 10, 0, "in steps of $10");
    const all = (m) => savingsLast({ saved, monthly: m, years, stocks, fee });
    assert.equal(all(safe).case, "all", `${saved} ${years}: ${safe} lasts`);
    assert.notEqual(all(safe + 10).case, "all", `${saved} ${years}: ${safe + 10} fails one`);
    assert.equal(all(safe).safeMonthly, safe, "the answer carries it");
  }
});

test("gap #2, test 6: a higher fee never lasts in more stretches", () => {
  for (const m of [3000, 3500, 4000, 4500, 5000, 6000]) {
    const n = (fee) => savingsLast({ saved: 1000000, monthly: m, years: 30, stocks: 0.6, fee }).lasted;
    assert.ok(n(0) >= n(0.0025) && n(0.0025) >= n(0.01), `${m}: ${n(0)} ${n(0.0025)} ${n(0.01)}`);
  }
});

test("gap #2, test 7: one written sentence per case, and the line under it", () => {
  const base = { saved: 1000000, monthly: 4000, years: 30, stocks: 0.6, fee: 0, windows: 69, from: 1928, to: 2025, lastStart: 1996, safeMonthly: 3650, medianEnd: 1234567 };
  const w = (x) => lastWords({ ...base, ...x }, "USD");
  // all lasted
  let a = w({ lasted: 69, case: "all", hardest: { start: 1966, end: 312345.6, failYear: null, yearsPaid: 30 } });
  assert.equal(a.sentence, "In every 30-year stretch since 1928, $4,000 a month from $1,000,000 lasted.");
  assert.equal(a.second, "Even starting in 1966, the hardest year, $312,000 was left.");
  assert.equal(a.saved, "Saved. It lasted in all 69 stretches.");
  // at least 90%
  a = w({ lasted: 64, case: "most", hardest: { start: 1966, end: 0, failYear: 25, yearsPaid: 24 } });
  assert.equal(a.sentence, "In 64 of 69 stretches of 30 years since 1928, $4,000 a month from $1,000,000 lasted.");
  assert.equal(a.second, "The hardest start was 1966: it ran out after 24 years.");
  assert.equal(a.saved, "Saved. It lasted in 64 of 69 stretches.");
  // 50 to 90%
  a = w({ lasted: 48, case: "often", hardest: { start: 1966, end: 0, failYear: 22, yearsPaid: 21 } });
  assert.equal(a.sentence, "It lasted in 48 of 69 stretches since 1928; in the rest it ran out early.");
  // under 50%
  a = w({ lasted: 20, case: "seldom", hardest: { start: 1929, end: 0, failYear: 2, yearsPaid: 1 } });
  assert.equal(a.sentence, "In most stretches since 1928, $4,000 a month ran out before 30 years.");
  assert.equal(a.second, "The hardest start was 1929: it ran out after 1 year.");
  // none
  a = w({ lasted: 0, case: "never", hardest: { start: 1928, end: 0, failYear: 1, yearsPaid: 0 } });
  assert.equal(a.sentence, "In every stretch since 1928, $4,000 a month ran out before 30 years.");
  assert.equal(a.second, "The hardest start was 1928: it ran out in the first year.");
  assert.equal(a.saved, "Saved. It ran out in all 69 stretches.");
  // one year, one stretch
  assert.equal(w({ years: 1, windows: 98, lasted: 98, case: "all", hardest: { start: 1931, end: 5, failYear: null } }).sentence, "In every 1-year stretch since 1928, $4,000 a month from $1,000,000 lasted.");
  assert.equal(w({ years: 1, lasted: 0, case: "never", hardest: { start: 1928, end: 0, failYear: 1, yearsPaid: 0 } }).sentence, "In every stretch since 1928, $4,000 a month ran out before 1 year.");
  assert.equal(w({ lasted: 69, case: "all", hardest: { start: 1966, end: 0.2, failYear: null } }).second, "Even starting in 1966, the hardest year, it lasted with nothing left.");
  // the three more numbers
  a = w({ lasted: 64, case: "most", hardest: { start: 1966, end: 0, failYear: 25, yearsPaid: 24 } });
  assert.deepEqual(a.more, ["Up to $3,650 a month lasted in every stretch.", "In the middle stretch, $1,235,000 was left after 30 years, in today's dollars.", "69 stretches of 30 years, the first starting in 1928 and the last in 1996."]);
  assert.equal(w({ case: "never", lasted: 0, safeMonthly: 0, medianEnd: 0, hardest: { start: 1928, end: 0, failYear: 1, yearsPaid: 0 } }).more.slice(0, 2).join(" "), "Less than $10 a month lasted in every stretch. In the middle stretch, the money ran out before 30 years.");
  assert.equal(w({ years: 98, windows: 1, lastStart: 1928, lasted: 1, case: "all", hardest: { start: 1928, end: 9, failYear: null } }).more[2], "1 stretch of 98 years, starting in 1928.");
  // the status of "The figures": the two amounts, never past 20 characters
  assert.equal(a.figures, "$1,000,000, $4,000");
  assert.equal(w({ saved: 12500000, monthly: 45000, lasted: 69, case: "all", hardest: { start: 1966, end: 1, failYear: null } }).figures, "$12,500,000, $45,000");
  assert.equal(w({ saved: 12500000, monthly: 450000, lasted: 69, case: "all", hardest: { start: 1966, end: 1, failYear: null } }).figures, "$12,500,000", "21 characters: the savings alone");
  // no sentence says "markets" for a stretch of years (tests/odds-words.test.mjs)
  for (const c of ["all", "most", "often", "seldom", "never"]) assert.ok(!/market/i.test(JSON.stringify(w({ lasted: 10, case: c, hardest: { start: 1966, end: 1, failYear: 3, yearsPaid: 2 } }))), c);
});

test("gap #2: the boxes are read with the page's defaults; a missing amount is no answer yet", () => {
  assert.deepEqual(LAST_DEFAULTS, { years: 30, stocks: 0.6, fee: 0 });
  assert.equal(lastInputs(undefined), null);
  assert.equal(lastInputs({ saved: 1000000 }), null, "no monthly amount");
  assert.equal(lastInputs({ monthly: 4000, years: 25 }), null, "no savings");
  assert.deepEqual(lastInputs({ saved: 1000000, monthly: 4000 }), { saved: 1000000, monthly: 4000, years: 30, stocks: 0.6, fee: 0 });
  assert.deepEqual(lastInputs({ saved: "1000000", monthly: 4000, years: 500, stocks: 2, fee: -1 }), { saved: 1000000, monthly: 4000, years: 98, stocks: 1, fee: 0 }, "held inside the history and 0 to 100%");
  // compute() carries the answer only when both amounts are saved
  const p = emptyPlan(); p.whatIfs = { quickLast: { saved: 1000000, monthly: 4000, years: 30 } };
  const d = compute(p, { today: "2026-11-13" });
  assert.equal(d.last.windows, 69); assert.equal(d.last.words.figures, "$1,000,000, $4,000");
  assert.equal(compute(emptyPlan(), { today: "2026-11-13" }).last, undefined);
});

test("gap #2: the real history, the design's example", () => {
  const a = savingsLast({ saved: 1000000, monthly: 4000, years: 30, ...MIX });
  assert.equal(a.windows, 69);
  assert.ok(a.lasted > 0 && a.lasted < 69, `${a.lasted} of 69`);
  assert.ok(a.safeMonthly > 2500 && a.safeMonthly < 4000, String(a.safeMonthly));
  assert.ok(a.hardest.start >= 1929 && a.hardest.start <= 1973, String(a.hardest.start));
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
test("gap #2 invariance: with no saved figures, compute() gives the same output as before, byte for byte", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-13";
  const plans = [["family", familyPlan(T)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 18);
  for (const [name, p0] of plans) {
    const p = migrate(structuredClone(p0));
    const before = compute(p, { today: T });
    assert.deepEqual(Object.keys(before), ["mostAsked", "more", "answers", "needsFirst"], name);
    const q = structuredClone(p); q.whatIfs = { ...(q.whatIfs ?? {}), quickLast: { saved: 800000, monthly: 3500 } };
    const { last, ...rest } = compute(q, { today: T });
    assert.ok(last, name);
    assert.equal(JSON.stringify(rest), JSON.stringify(before), `${name}: the saved figures change nothing else`);
  }
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
// a browser writes "null" for a null handed to append(); the stand-in skips it, so here it fails instead
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map((n) => (n === null || n === undefined ? String(n) : typeof n)).join(", ")}): a browser would write "${String(ns.find((n) => n == null))}"`);
  return appendOf.apply(this, ns);
};
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const { render } = await import("./view.js");
const { default: REGISTRY } = await import("../../registry.js");
const tick = () => new Promise((r) => setTimeout(r, 0));
/** Draw the page as the shell does: every registered page usable; store.update records the draft and draws again. */
function page(plan0, { today = "2026-11-13", route = { group: "overview", id: "quick", rest: [], query: {} }, fieldError = null } = {}) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], redraws: 0, root: null };
  const mods = new Map(REGISTRY.map((m) => [`${m.group}/${m.id}`, { group: m.group, id: m.id, status: "usable" }]));
  const ctx = () => ({ ui: fieldError ? { ...ui, fieldError } : ui, fmt: { ...fmt, today: () => today }, plan, route, modules: mods, features: { enabled: () => true }, isReady: () => true, shown: () => true,
    store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } },
    redraw: () => { s.redraws++; draw(); }, openSearch: () => {} });
  const draw = () => { s.root = new FakeElement("main"); render(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const all = (el) => [el, ...el.all()];
const parts = (root) => all(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => parts(root).find((e) => e.dataset.part === id) ?? null;
const opened = (d) => d.hasAttribute("open");
/** The words a person sees without opening anything: a shut part shows only its summary. */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const lastCard = (root) => all(root).find((e) => e.tagName === "SECTION" && e.dataset.last !== undefined);
const boxes = (root) => all(root).filter((e) => e.tagName === "INPUT");
const chipsOf = (root, id) => all(root).find((e) => e.dataset?.choice === id)?.all().filter((e) => e.tagName === "BUTTON") ?? [];
const formOf = (root) => all(lastCard(root) ? root : root).find((e) => e.tagName === "FORM" && e.querySelector('[name="saved"]'));
function answer(s, saved, monthly) {
  const f = formOf(s.root);
  f.querySelector('[name="saved"]').value = saved; f.querySelector('[name="monthly"]').value = monthly;
  f.dispatch("submit");
}

test("gap #2, test 8: empty boxes show the form and no answer; the first view is one sentence, the boxes, six questions", () => {
  const s = page(emptyPlan());
  const card = lastCard(s.root);
  const t = seen(card);
  assert.match(t, /^Will my savings last\? Saved for retirement .* To take out each month .* In today's dollars For how many years 20 years 25 years 30 years 35 years Type my own More details \(optional\) stocks, fees › See the answer This leaves out Social Security, pensions and taxes\. Your plan counts them: Set up my plan ›$/, t);
  assert.deepEqual(boxes(card).map((b) => b.getAttribute("name")), ["saved", "monthly"], "two boxes; the years are chips");
  assert.equal(chipsOf(card, "quickYears").find((b) => b.className === "chip on").textContent, "30 years");
  assert.ok(!opened(partOf(card, "options")), "More details (optional) starts shut");
  assert.ok(!/stretch/.test(textOf(s.root)), "no answer yet");
  assert.equal(all(card).find((e) => e.tagName === "A")?.getAttribute("href"), "#/overview/guide/retire");
  // one filled button on the page: See the answer (Search is outlined)
  const filled = all(s.root).filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(e.className) && !e.closest("details:not([open])"));
  assert.deepEqual(filled.map((b) => b.textContent), ["See the answer"]);
  // the opt conversion: one sentence under the title, six questions, then "5 more questions"; the steps' own retirement
  // row goes (the line under the boxes links the same steps); every question is still on the page
  const all6 = seen(s.root);
  assert.match(all6, /^Get a quick answer Pick a question and type your own numbers: nothing to set up first\. Will my savings last\?/);
  const qs = [...MOST_ASKED, ...MORE];
  for (const q of qs.slice(0, 6)) assert.ok(all6.includes(q.title), q.title);
  for (const q of qs.slice(6)) { assert.ok(!all6.includes(q.title), `${q.title} waits under 5 more questions`); assert.ok(textOf(s.root).includes(q.title), q.title); }
  assert.equal(partOf(s.root, "questions").querySelector(".fold-title").textContent, "5 more questions");
  assert.ok(!all6.includes("Will my money last?"), "no second retirement question");
  for (const n of NEEDS_FIRST.filter((x) => x.guide !== "retire")) assert.ok(all6.includes(n.title), n.title);
  assert.ok(all6.includes("Everything stays on your own devices."), "moved, not deleted");
  assert.ok(all6.split(" ").length < 417, `${all6.split(" ").length} words on the first view (417 before)`);
});

test("gap #2, R7 and R8: See the answer saves only whatIfs.quickLast; the answer leads, the boxes fold into The figures", () => {
  const s = page(emptyPlan());
  answer(s, "1,000,000", "4,000");
  assert.equal(s.saved.length, 1);
  assert.deepEqual(s.plan().whatIfs.quickLast, { saved: 1000000, monthly: 4000, years: 30, stocks: 0.6, fee: 0 });
  const was = migrate(emptyPlan()); const now = structuredClone(s.plan());
  delete now.whatIfs.quickLast; delete was.meta; delete now.meta;
  assert.deepEqual(now, { ...was, whatIfs: { ...(was.whatIfs ?? {}) } }, "nothing else in the plan changed");
  const card = lastCard(s.root);
  assert.equal(seen(card), "Saved. It lasted in 52 of 69 stretches. Will my savings last? It lasted in 52 of 69 stretches since 1928; in the rest it ran out early. The hardest start was 1966: it ran out after 19 years. This leaves out Social Security, pensions and taxes. Your plan counts them: Set up my plan ›");
  const ps = parts(s.root).filter((p) => p.dataset.part !== "questions" && p.dataset.part !== "options");
  assert.deepEqual(ps.map((p) => [p.dataset.part, p.querySelector(".fold-title").textContent, p.querySelector(".fold-status")?.textContent ?? "", opened(p)]),
    [["numbers", "3 more numbers", "", false], ["figures", "The figures", "$1,000,000, $4,000", false], ["how", "How this is worked out", "4 steps", false]]);
  assert.ok(partOf(s.root, "figures").querySelector('[name="saved"]'), "the boxes are inside The figures");
  assert.match(textOf(partOf(s.root, "numbers")), /Up to \$3,100 a month lasted in every stretch\. In the middle stretch, \$975,000 was left after 30 years, in today's dollars\. 69 stretches of 30 years/);
  assert.match(textOf(partOf(s.root, "how")), /At the start of each year, \$48,000 comes out \(\$4,000 a month\)\..*60% stocks and 40% bonds.*Aswath Damodaran/);
  // no second filled button outside the shut parts
  assert.equal(all(s.root).filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(e.className) && !e.closest("details")).length, 0);
});

test("gap #2, R17, S11: saving inside The figures keeps it open, no other part moves, and the green line names the new answer", () => {
  const p = emptyPlan(); p.whatIfs = { quickLast: { saved: 1000000, monthly: 4000, years: 30, stocks: 0.6, fee: 0 } };
  const s = page(p);
  assert.equal(seen(lastCard(s.root)).startsWith("Saved."), false, "no green line before a save");
  const openOf = () => Object.fromEntries(parts(s.root).map((x) => [x.dataset.part, opened(x)]));
  const before = openOf();
  assert.deepEqual(before, { questions: false, options: false, numbers: false, figures: false, how: false }, "every part shut on the first view");
  // after each save, the whole set of parts is compared: only the part saved in differs (S11), never a part beside it
  const onlyMoved = (...ids) => assert.deepEqual(openOf(), { ...before, ...Object.fromEntries(ids.map((id) => [id, true])) }, `only ${ids.join(" and ")} differ`);
  answer(s, "1,000,000", "3,000");
  assert.equal(s.saved.length, 1);
  onlyMoved("figures");
  assert.match(seen(lastCard(s.root)), /^Saved\. It lasted in all 69 stretches\. Will my savings last\? In every 30-year stretch since 1928, \$3,000 a month from \$1,000,000 lasted\. Even starting in 1966, the hardest year, \$117,000 was left\./);
  // a chip there saves at once (the answer always matches the chips) and keeps the part open; nothing else moves
  const c25 = chipsOf(partOf(s.root, "figures"), "quickYears").find((b) => b.textContent === "25 years");
  c25.click();
  assert.equal(s.saved.length, 2);
  assert.equal(s.plan().whatIfs.quickLast.years, 25);
  onlyMoved("figures");
  assert.match(seen(lastCard(s.root)), /^Saved\. It lasted in all 74 stretches\..*In every 25-year stretch since 1928/);
  // the mix: More details (optional) (inside The figures) opens on its own once a figure in it is not the page's own, and
  // says so; the answer's own parts beside it stay shut
  const c80 = chipsOf(partOf(s.root, "options"), "quickStocks").find((b) => b.textContent === "80%");
  c80.click();
  assert.equal(s.saved.length, 3);
  assert.equal(s.plan().whatIfs.quickLast.stocks, 0.8);
  onlyMoved("figures", "options");
  assert.equal(partOf(s.root, "options").querySelector(".fold-status").textContent, "1 filled in");
  for (const d of s.saved) assert.deepEqual(Object.keys(d.whatIfs), ["quickLast"], "only whatIfs.quickLast is written");
});

test("S11: a figure held at its box saves nothing and moves no part but the one around the box: 'Use $1 or more.'", () => {
  const p = emptyPlan(); p.whatIfs = { quickLast: { saved: 1000000, monthly: 4000, years: 30, stocks: 0.6, fee: 0 } };
  // ui.fieldError acts only in a browser; this stand-in records the words and does what the kit's bringTo does first, open
  // each shut section around the box (the kit's own: tests/ui-kit-helpers.test.mjs, "a shut section holding the box opens")
  const said = [];
  const fieldError = (box, text) => {
    said.push([box?.getAttribute("name"), text]);
    for (let x = box; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) x.setAttribute("open", "");
    return false;
  };
  const s = page(p, { fieldError });
  const openOf = () => Object.fromEntries(parts(s.root).map((x) => [x.dataset.part, opened(x)]));
  const before = openOf();
  assert.equal(before.figures, false, "The figures is shut on the first view");
  answer(s, "0", "4,000");
  assert.deepEqual(said, [["saved", "Use $1 or more."]], "the words are said at the box that holds the 0");
  assert.equal(s.saved.length, 0, "nothing saved");
  assert.deepEqual(openOf(), { ...before, figures: true }, "the part around the box opens, and no other");
  assert.equal(seen(lastCard(s.root)).startsWith("Saved."), false, "no green line: nothing was saved");
  answer(s, "1,000,000", "");
  assert.deepEqual(said[1], ["monthly", "Use $1 or more."]);
  assert.equal(s.saved.length, 0);
});

test("gap #2: before the first answer a chip is held, not saved, and goes with See the answer", () => {
  const s = page(emptyPlan());
  chipsOf(lastCard(s.root), "quickYears").find((b) => b.textContent === "35 years").click();
  assert.equal(s.saved.length, 0, "nothing saved by a chip before an answer");
  assert.equal(s.redraws, 1);
  assert.equal(chipsOf(lastCard(s.root), "quickYears").find((b) => b.className === "chip on").textContent, "35 years");
  chipsOf(partOf(s.root, "options"), "quickFee").find((b) => b.textContent === "1%").click();
  assert.ok(opened(partOf(s.root, "options")), "the part with the chip stays open");
  answer(s, "600,000", "2,500");
  assert.deepEqual(s.plan().whatIfs.quickLast, { saved: 600000, monthly: 2500, years: 35, stocks: 0.6, fee: 0.01 });
  assert.equal(s.saved.length, 1);
});

test("gap #2, test 9: the page saves only calculator inputs (its own manifest)", () => {
  const src = manifest("overview/quick");
  const writes = JSON.parse(src.match(/writes: (\[[^\]]*\])/)[1]);
  assert.deepEqual(writes, ["whatIfs"]);
  for (const w of writes) assert.ok(ALLOWED_WRITES.includes(w));
});

test("gap #2: a plan that answers retirement keeps its answers first and points to them from the three boxes", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = page(familyPlan("2026-11-13"));
  const t = seen(s.root);
  assert.ok(t.indexOf("Your plan already answers") < t.indexOf("Will my savings last?"), "the plan's own answers come first");
  assert.match(t, /^Get a quick answer Your plan already answers the questions below; for any other, type your own numbers\./);
  const link = all(lastCard(s.root)).find((e) => e.tagName === "A");
  assert.deepEqual([link.getAttribute("href"), link.textContent], ["#/retirement/projection?from=quick", "See your plan's answer ›"]);
  assert.ok(!t.includes("Questions that need your numbers first"), "the family's plan answers all five");
});

test("gap #2: a plan that does not know its retirement savings yet points to setting it up, not to its answer", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const s = page(renterDebtPlan());
  assert.match(seen(s.root), /We don't know yet Will my money last\?/);
  const link = all(lastCard(s.root)).find((e) => e.tagName === "A");
  assert.deepEqual([link.getAttribute("href"), link.textContent], ["#/retirement/projection?from=quick", "Set up my plan ›"]);
});

// ---------------------------------------------------------------- critic g12 (2026-11-13)
test("critic g12 F2: nothing saved or nothing taken out is no answer: the page asks for an amount above $0", () => {
  // compute: a 0 in either amount has nothing to test ("$0 a month from $0 lasted" read as an answer)
  assert.equal(lastInputs({ saved: 0, monthly: 0 }), null, "both 0");
  assert.equal(lastInputs({ saved: 1000000, monthly: 0 }), null, "nothing taken out");
  assert.equal(lastInputs({ saved: 0, monthly: 4000 }), null, "nothing saved");
  const p = emptyPlan(); p.whatIfs = { quickLast: { saved: 0, monthly: 0, years: 30 } };
  assert.equal(compute(p, { today: "2026-11-13" }).last, undefined);
  // the page: both boxes ask for $1 or more (the kit's words at the box), and See the answer with a 0 saves nothing
  const s = page(emptyPlan());
  const f = formOf(s.root);
  assert.deepEqual(["saved", "monthly"].map((k) => f.querySelector(`[name="${k}"]`).getAttribute("min")), ["1", "1"]);
  for (const [a, b] of [["0", "0"], ["1,000,000", "0"], ["0", "4,000"]]) { answer(s, a, b); assert.equal(s.saved.length, 0, `${a} / ${b}: nothing saved`); }
  assert.ok(!/stretch/.test(textOf(s.root)), "no answer");
});

test("critic g12 F2: the middle stretch that lasted with nothing left is not said to have run out", () => {
  // $48,000 saved, $4,000 a month for 1 year: every stretch pays its one year and ends at $0
  const a = savingsLast({ saved: 48000, monthly: 4000, years: 1, ...MIX });
  assert.equal(a.case, "all"); assert.equal(a.medianEnd, 0);
  const w = lastWords(a, "USD");
  assert.equal(w.second, "Even starting in 1928, the hardest year, it lasted with nothing left.");
  assert.equal(w.more[1], "In the middle stretch, it lasted with nothing left after 1 year.");
  // more than half ran out: the middle stretch ran out
  const b = savingsLast({ saved: 100000, monthly: 9000, years: 30, ...MIX });
  assert.equal(lastWords(b, "USD").more[1], "In the middle stretch, the money ran out before 30 years.");
});

test("critic g12 F1: a box that \"Type my own\" opens is not kept as typing, so the form keeps one name for it (core/place.js)", () => {
  // place.js names a form by its boxes; a box opening inside the form gave the typing made before it a second name, left
  // behind after See the answer as a stale "Not saved yet: what you typed in 'Will my savings last?'" line. Those boxes
  // save on change, so they carry data-no-keep and the form's own boxes stay the two amounts.
  const noKeep = (e) => { for (let x = e; x; x = x.parentNode) if (x.dataset?.noKeep !== undefined) return true; return false; };
  const openOwn = (root) => { for (const id of ["quickYears", "quickStocks", "quickFee"]) chipsOf(root, id).find((b) => b.textContent === "Type my own").click(); };
  const check = (root, when) => {
    const ins = all(formOf(root)).filter((e) => e.tagName === "INPUT");
    assert.deepEqual(ins.map((e) => e.getAttribute("name")), ["saved", "monthly", "quickYears", "quickStocks", "quickFee"], when);
    assert.deepEqual(ins.filter((e) => !noKeep(e)).map((e) => e.getAttribute("name")), ["saved", "monthly"], `${when}: only the two amounts are kept as typing`);
  };
  const s = page(emptyPlan());
  openOwn(s.root); check(s.root, "asking");
  const p = emptyPlan(); p.whatIfs = { quickLast: { saved: 1000000, monthly: 4000 } };
  const t = page(p);
  openOwn(t.root); check(t.root, "inside The figures");
});

test("seen while looking (g12 fix): a year of your own reads \"Yours: 1 year\", not \"1 years\"", () => {
  const on = (years) => { const p = emptyPlan(); p.whatIfs = { quickLast: { saved: 48000, monthly: 4000, years } }; return chipsOf(page(p).root, "quickYears").find((b) => b.className === "chip on")?.textContent; };
  assert.equal(on(1), "Yours: 1 year");
  assert.equal(on(28), "Yours: 28 years");
});
