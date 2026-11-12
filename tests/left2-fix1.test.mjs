// tests/left2-fix1.test.mjs -- the left2 lane's fix round 1 (2026-11-12, claude-c): what the money, layperson and breaker
// reviewers found in the lane. Each test was written before its fix and failed first (the failing output is in the round's
// report). Households: qa/fixtures (invented).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../modules/retirement/projection/compute.js";
import { project } from "../core/math/retirement.js";
import { retypeHousehold } from "../qa/fixtures/retype-households.mjs";

const T = "2026-11-12";
const RANK = { "on track": 0, tight: 1, short: 2 };
const typedOver = (p, v) => { const q = structuredClone(p); P.saveSpendingFigure(q, v, null); return q; };

test("B-1: a figure typed over today's bills never does better for spending more: no cliff at the total of the loan payments", () => {
  const p = retypeHousehold(12);
  const shown = P.compute(p, { today: T });
  const exTotal = Math.round(shown.spendingYearly / 12);
  // the health line is held out of this sweep: the marketplace credit is lost under the poverty line, so a lower income can
  // pay more for cover (a real rule, healthcare README), which is not what this test is about
  const noHealth = (d) => project({ ...d.inputs, events: (d.inputs.events ?? []).filter((e) => e.kind !== "health") });
  let last = null;
  for (let v = exTotal; v >= 600; v -= 37) {
    const r = noHealth(P.compute(typedOver(p, v), { today: T }));
    const end = r.success ? r.endBalanceReal : -1e9 + (r.failAge ?? 0) * 1e6;
    if (last) assert.ok(end >= last.end - 1, `typed ${v} ends at ${Math.round(end)}, below typed ${last.v}'s ${Math.round(last.end)}: less spending must not end worse`);
    last = { v, end };
  }
  // the cliff the breaker found: $1,140 and $1,138 differ by $2 a month
  const a = P.compute(typedOver(p, 1140), { today: T }), b = P.compute(typedOver(p, 1138), { today: T });
  assert.ok(Math.abs(a.atEnd.totalReal - b.atEnd.totalReal) < 2000, `1,140: ${Math.round(a.atEnd.totalReal)} vs 1,138: ${Math.round(b.atEnd.totalReal)}`);
});

test("B-3: retyping the Expenses total over today's bills gives the answer reading the bills gives (health cover is not added on top)", () => {
  for (const n of [12, 14]) {
    const p = retypeHousehold(n);
    const d = P.compute(p, { today: T });
    const v = Math.round(d.spendingYearly / 12 * 100) / 100;
    const e = P.compute(typedOver(p, v), { today: T });
    assert.ok(RANK[e.verdict] <= RANK[d.verdict], `household ${n}, typed ${v}: ${e.verdict} (short at ${e.shortAge}) is worse than ${d.verdict}`);
    assert.ok(Math.abs((e.health?.total ?? 0) - (d.health?.total ?? 0)) < 1, `household ${n}: health cover ${Math.round(e.health?.total ?? 0)} vs ${Math.round(d.health?.total ?? 0)} read from the bills`);
    assert.ok(Math.abs(e.atEnd.totalReal - d.atEnd.totalReal) < 50, `household ${n}: ends ${Math.round(e.atEnd.totalReal)} vs ${Math.round(d.atEnd.totalReal)}`);
  }
});

test("B-2: an ended rent line ends a rental only when it is that rental's by name, never because one name is part of the other", async () => {
  const { condoOnlyRentalPlan } = await import("../qa/fixtures/round8-rental.mjs");
  const mk = (rental, line) => {
    const p = condoOnlyRentalPlan(); p.property[0].name = rental; p.retirement.spendingMonthly = null;
    p.income = p.income.filter((x) => x.type !== "rental").concat([{ id: "old", name: line, type: "rental", amount: 900, period: "monthly", growth: 0, startDate: "2015-01-01", endDate: "2024-03-31", taxable: true, personId: "" }]);
    return p;
  };
  const rentOf = (p) => (P.compute(p, { today: T }).inputs?.incomes ?? []).filter((x) => x.type === "rental" && x.part === "rent");
  for (const [rental, line] of [["Condo", "Old condo across town"], ["", "Rental income"], ["A", "Garage space"]]) {
    const r = rentOf(mk(rental, line));
    assert.ok(r.length === 1 && r[0].untilYear === undefined, `rental "${rental}" and an ended line "${line}" (another place): the rent goes on (${JSON.stringify(r.map((x) => [x.name, x.untilYear]))})`);
  }
  for (const line of ["Condo rent", "condo", "Condo's rental income"]) {
    const r = rentOf(mk("Condo", line));
    assert.equal(r.length, 0, `"${line}" is the Condo's rent, ended in 2024: no rent in retirement`);
  }
});

// ---------------------------------------------------------------- rentals in the month (M-3, B-4, B-5, B-6)
const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../qa/fixtures/round8-rental.mjs");
const { compute: nextBest } = await import("../modules/overview/next-best-action/compute.js");
const { compute: budget, yearTaxes } = await import("../modules/cashflow/budget-percent/compute.js");
const { migrate } = await import("../core/schema/migrate.js");
const { provided } = await import("../core/estimate/providers.js");
const RT = "2026-11-06";

test("M-3 / B-4: the condo entered on Net worth (loan on Debts) or only on Rental analysis (loan typed there) leaves one month's leftover", () => {
  const a = nextBest(migrate(condoOnNetWorthPlan()), { today: RT }).spare, b = nextBest(migrate(condoOnlyRentalPlan()), { today: RT }).spare;
  assert.ok(Math.abs(a.monthly - b.monthly) < 0.01, `Net worth path ${a.monthly.toFixed(2)}, Rental analysis path ${b.monthly.toFixed(2)}`);
  // the loan typed only on Rental analysis is its own line, so the lines still add up
  const sum = (s) => s.gross - ((s.businessCosts ?? 0) + s.federalTax + s.payrollTax + s.stateTax + s.careLost + s.rentCosts + (s.rentLoan ?? 0) + s.spending + s.retirementSaving + s.goalSaving + s.debtExtra + s.held);
  assert.ok(Math.abs(sum(b) - b.monthly) < 0.01);
  assert.ok(Math.abs((b.rentLoan ?? 0) - 851) < 0.01, `the rental's loan, $851 a month: ${b.rentLoan}`);
  assert.equal(a.rentLoan ?? 0, 0, "on Debts, the payment is in the spending already");
  // Budget (50/30/20) takes the same month
  const ba = budget(migrate(condoOnNetWorthPlan()), { today: RT }), bb = budget(migrate(condoOnlyRentalPlan()), { today: RT });
  assert.ok(ba.ready && bb.ready);
  assert.ok(Math.abs(bb.saving.full - b.full) < 0.01 || Math.abs(bb.saving.leftover - Math.max(0, b.monthly)) < 0.01, `Budget ${bb.saving.leftover} vs ${b.monthly}`);
});

test("B-6: a rental with no rent typed on Rental analysis still takes its running costs off the month", () => {
  const p = migrate(condoOnNetWorthPlan());
  const full = nextBest(p, { today: RT }).spare;
  const q = migrate(condoOnNetWorthPlan()); q.property[0].rentMonthly = null;
  const s = nextBest(q, { today: RT }).spare;
  // the running costs without the empty months (no rent, nothing empty): property tax, insurance, dues, upkeep, manager on nothing
  assert.ok(s.rentCosts > 900, `no rent typed there: running costs ${s.rentCosts}`);
  assert.ok(s.monthly < full.monthly + 200, `leftover ${s.monthly.toFixed(2)} against ${full.monthly.toFixed(2)} with the rent typed there`);
});

test("B-5: the month the guessed family floor is fitted to has the rental's running costs off it", () => {
  const p = migrate(condoOnNetWorthPlan());
  const T = yearTaxes(p, { today: RT });
  const room = provided("budget:afterTaxMonth")(p, RT, 0);
  assert.ok(T.rentCosts > 0);
  assert.ok(Math.abs(room - (T.afterTax - T.rentCosts - (T.rentLoan ?? 0)) / 12) < 0.01, `room ${room} vs after tax less the rental's costs ${(T.afterTax - T.rentCosts) / 12}`);
});

// ---------------------------------------------------------------- Get started's leftover (B-7, L-4)
const S = await import("../modules/overview/setup/compute.js");
const F = await import("../qa/fixtures/setup-personas.mjs");
const EST = await import("../core/estimate/index.js");
const G = await import("../modules/overview/guesses/compute.js");
const { leftOverOf } = await import("../core/math/leftover.js");
const REG = EST.mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const PT = F.PERSONA_TODAY, GO = { estimators: REG.estimators, tables: REG.tables, today: PT };
const guessFor = (p) => { const b = structuredClone(p); return (k, o = {}) => EST.estimate(b, k, { ...GO, ...o }); };
const readLeft = (p) => leftOverOf(nextBest(p, { today: PT }).spare);

test("B-7: an exact leftover typed again after a small raise is worked out again; the $2 'about' room is only for an answer that was 'about'", () => {
  const p = F.sam(PT); F.finishSetup("sam", p, PT); EST.settle(p, GO);
  const r1 = S.applyLeftOver(p, { ...S.spendAnswers(p), rows: {}, left: 1000 }, PT, { guess: guessFor(p) });
  assert.ok(r1.ok && !r1.about && Math.abs(readLeft(p) - 1000) <= 0.5);
  const m = S.valuesFor(p, "money"); m.people["setup-self"].amount = String(Number(m.people["setup-self"].amount) + 30); S.applyMoney(p, { ...m, today: PT });
  assert.ok(Math.abs(readLeft(p) - 1000) > 0.5, `the raise moved it: ${readLeft(p)}`);
  const r2 = S.applyLeftOver(p, { ...S.spendAnswers(p), left: 1000 }, PT, { guess: guessFor(p) });
  assert.ok(r2.ok && !r2.about);
  assert.ok(Math.abs(readLeft(p) - r2.left) < 0.01, `the answer says ${r2.left}, the plan reads ${readLeft(p)}`);
  assert.ok(Math.abs(readLeft(p) - 1000) <= 0.5, `typed 1000 exactly: reads ${readLeft(p)}`);
});

test("L-4: at the top end (the bills use up the rest) a figure within $2 of the most that can be left is taken as 'about', and the gap only grows as the figure rises", () => {
  const mk = () => { const p = F.jordan(); S.applyOweAmounts(p, { mortgage: { payment: 1100 } }, PT, { guess: guessFor(p) }); EST.settle(p, GO); p.guide.setup.taps = { ...(p.guide.setup.taps ?? {}), childcare: "yes", "health-cover": "own" }; return p; };
  let lastOver = -1, okTop = null;
  for (let L = 3336; L <= 3392; L++) {
    const p = mk();
    const r = S.solveSpend(p, { ...S.spendAnswers(p), rows: {} }, { left: L }, { today: PT, guess: guessFor(p) });
    if (r.ok) { assert.ok(Math.abs(r.left - L) <= 2 + 1e-9, `L=${L} reads ${r.left}`); assert.equal(lastOver, -1, `L=${L} taken after a higher figure was refused`); okTop = L; continue; }
    assert.ok(r.over > 2, `L=${L}: refused (${r.why}) for a gap of $${r.over}: within $2 it is "about"`);
    assert.ok(r.over >= lastOver, `L=${L}: the gap fell from $${lastOver} to $${r.over} as the figure rose`);
    lastOver = r.over;
  }
  assert.ok(okTop !== null && lastOver > 0, "both sides seen");
});

test("L-1: a minus sign typed key by key in the leftover box stays: '-', '2', '5', '0' reads -250 (it saved +250)", async () => {
  const { typeKeys } = await import("../modules/overview/setup/view.js");
  assert.equal(typeKeys(["-", "2", "5", "0"], true), "-250");
  assert.equal(typeKeys(["-", "1", "2", "5", "0"], true), "-1,250");
  assert.equal(typeKeys(["1", "2", "5", "0"], true), "1,250");
  assert.equal(typeKeys(["-", "2"], false), "2", "a box that cannot go below zero drops it");
});

const $ = (x) => `$${Math.round(x).toLocaleString("en-US")}`;
const srcOf = async (rel) => (await import("node:fs")).readFileSync(new URL(rel, import.meta.url), "utf8");

test("L-2: checking going down $250 with $300 of goals says one monthly drop ($550) and a year that adds up to it", async () => {
  const { leftCardLines } = await import("../modules/overview/setup/view.js");
  const res = { ok: true, left: -250, month: 4000, spare: { monthly: -550, goalSaving: 300, retirementSaving: 0 } };
  const { goalLine, yearly } = leftCardLines(res, -250, $);
  assert.match(goalLine, /checking and savings go down about \$550 a month while your goals grow \$300/, goalLine);
  assert.doesNotMatch(goalLine, /comes from savings/, goalLine);
  // the year: -$550 + $300 = -$250 a month, so -$3,000 a year, said of checking, savings AND the goals together
  assert.match(yearly, /\$3,000 a year/, yearly);
  assert.match(yearly, /checking, savings and your goals together/, yearly);
  assert.doesNotMatch(yearly, /so checking and savings shrink by that/, yearly);
});

test("M-4: the 'about' sentence never prints a minus sign", async () => {
  const { leftCardLines } = await import("../modules/overview/setup/view.js");
  const { aboutLine } = leftCardLines({ ok: true, about: true, left: -252, month: 4000, spare: null }, -250, $);
  assert.doesNotMatch(aboutLine, /-\$/, aboutLine);
  assert.match(aboutLine, /checking going down about \$252 a month/, aboutLine);
  const ex = await srcOf("../modules/cashflow/expenses/view.js");
  assert.doesNotMatch(ex, /a leftover of about \$\{m\(r\.left\)\}/, "Expenses prints res.left with its sign");
});

test("L-7: the 'about' figure is said once on the card, not again in the total's caption", async () => {
  assert.doesNotMatch(await srcOf("../modules/overview/setup/view.js"), /\(the closest we can get: about/);
});

test("L-9 / L-5: Continue's words match the card: 'within a couple of dollars', and with nothing coming in, question 2", async () => {
  const { leftStop } = await import("../modules/overview/setup/view.js");
  const step = leftStop({ ok: false, why: "step" }, $);
  assert.doesNotMatch(step, /exact/, step);
  assert.match(step, /even to within a couple of dollars/, step);
  const stop = leftStop({ ok: false, why: "no-pay" }, $, () => {});
  const text = typeof stop === "string" ? stop : stop.text;
  assert.match(text, /Nothing is coming in yet/, text);
  assert.match(text, /question 2/, text);
  assert.doesNotMatch(text, /Change the leftover amount/, text);
  assert.ok(typeof stop === "object" && stop.choices?.some((c) => /question 2/.test(c.label)), "a button to question 2");
  // the guess total is hidden while the leftover cannot be worked out: result() says no-pay, which hides it as a clash does
  assert.match(await srcOf("../modules/overview/setup/view.js"), /why: "no-pay"/);
});

test("L-8: the Expenses clash notice names every group it counts, or says how many more, and a name with a comma stays readable", async () => {
  const { groupNamesWords } = await import("../modules/cashflow/expenses/view.js");
  const eight = ["Home costs", "Utilities and phone", "Groceries", "Car, gas and transit", "Health", "Fun", "Clothes", "Gifts"];
  const w = groupNamesWords(eight);
  assert.match(w, /and 4 more$/, w);
  assert.match(w, /Groceries; Car, gas and transit/, w);
  assert.equal(groupNamesWords(["Groceries", "Fun"]), "Groceries and Fun");
  assert.equal(groupNamesWords(["Groceries", "Fun", "Gifts"]), "Groceries, Fun and Gifts");
});

test("L-3: a month that runs short is said as 'Short each month $550' on Your plan and the Dashboard, and Expenses links the typed -$250 to it", async () => {
  const LO = await import("../core/math/leftover.js");
  assert.equal(typeof LO.spareLabel, "function", "one wording for the month's figure");
  assert.deepEqual(LO.spareLabel(-550), { label: "Short each month", value: 550 });
  assert.deepEqual(LO.spareLabel(1000), { label: "Left over each month", value: 1000 });
  assert.equal(LO.leftGoalsWords(-250, 300, $), " Your goals take another $300 a month, so you are $550 short each month.");
  assert.equal(LO.leftGoalsWords(1000, 300, $), "", "above zero the card already says what the goals take");
  for (const rel of ["../modules/overview/setup/view.js", "../modules/overview/dashboard/view.js"]) {
    const src = await srcOf(rel);
    assert.doesNotMatch(src, /fig\(st\.spare >= 0 \? "ok" : "warn", "Left over each month", st\.spare,/, rel);
    assert.doesNotMatch(src, /k: "Left over each month", s: st\.spare >= 0/, rel);
  }
  assert.match(await srcOf("../modules/cashflow/expenses/view.js"), /leftGoalsWords\(/);
});

// FIRE on a short month: Sam (invented, qa/fixtures/setup-personas.mjs) with a 401(k) of $150 a month out of pay and an employer
// match of $50 a month, the month typed as checking going down $500
async function fireSam(left, { k401 = true, who = "sam", goal = 0 } = {}) {
  const S = await import("../modules/overview/setup/compute.js");
  const { compute: fire } = await import("../modules/retirement/fire/compute.js");
  const { estimate, mergeEstimators, settle } = await import("../core/estimate/index.js");
  const G = await import("../modules/overview/guesses/compute.js");
  const Fx = await import("../qa/fixtures/setup-personas.mjs");
  const REG = mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const PT = Fx.PERSONA_TODAY, GO = { estimators: REG.estimators, tables: REG.tables, today: PT };
  const p = Fx[who](); settle(p, GO);
  if (k401) {
    const me = p.household.people[0].id;
    p.accounts.push({ id: "k401", name: "401(k)", type: "401k", balance: 20000, ownerId: me });
    p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "c-k", accountId: "k401", personId: me, amount: 150, period: "monthly", employerMatch: 50 }];
  }
  if (goal) p.goals = [...(p.goals ?? []), { id: "g-trip", name: "Trip", monthly: goal, target: goal * 12 }];
  const before = structuredClone(p), guess = (k, o = {}) => estimate(before, k, { ...GO, ...o });
  const r = S.applyLeftOver(p, { ...S.spendAnswers(p), rows: {}, left }, PT, { guess });
  assert.ok(r.ok, JSON.stringify(r));
  return fire(p, { today: PT });
}

test("M-6: a short month still counts the 401(k) money out of pay as saving (it showed only the match and 0%), and says checking goes down", async () => {
  const d = await fireSam(-500);
  assert.ok(d.saving, "a month can be read");
  assert.ok(d.saving.own >= 150 * 12 - 1, `own ${d.saving.own}: the $1,800 a year out of pay goes into the 401(k) whatever checking does`);
  assert.ok(d.saving.rate > 0, `rate ${d.saving.rate}`);
  assert.ok(d.saving.short > 5000, `short ${d.saving.short}: checking goes down about $6,000 a year, said beside it`);
});

test("M-6: no saving, or nobody working, gives no 'years to independence' (it said age 110 from growth alone)", async () => {
  const d = await fireSam(-500, { k401: false, who: "patLee" });   // Pat Lee: growth alone took it to age 110
  assert.ok(d.saving.yearly <= 0.5, `yearly ${d.saving.yearly}`);
  assert.equal(d.saving.yearsToFi, null, `years ${d.saving.yearsToFi}, age ${d.saving.fiAge}`);
  assert.equal(d.saving.fiAge, null);
});

test("L-6: FIRE says its quick rule counts what builds up in checking, which Will the money last? leaves out", async () => {
  const d = await fireSam(1000);
  assert.ok(d.saving.cash > 11000, `cash ${d.saving.cash}`);
  const src = await srcOf("../modules/retirement/fire/view.js");
  assert.match(src, /Will the money last\? counts only/);
});

test("M-1 / B-8: a plan spending exactly the careful figure the page shows lasts in at least 9 of 10 of the 2,000 paths", async () => {
  const { retirementPlan } = await import("../qa/fixtures/retirement-plan.mjs");
  const MC = await import("../modules/retirement/monte-carlo/compute.js");
  const plan = retirementPlan(); plan.retirement.spendingMonthly = 9175;
  const shown = MC.compute(plan, { today: "2026-11-02", paths: 2000 }).careful;
  const atIt = retirementPlan(); atIt.retirement.spendingMonthly = shown.yearly / 12;
  const share = MC.spendingAtChance(P.buildInputs(atIt, { today: "2026-11-02" }).inputs).planned;
  assert.ok(share >= 0.9, `the page says ${shown.yearly} a year lasts in 9 of 10; a plan spending it lasts in ${share}`);
});

test("M-6 / L-2: with goals saving, FIRE's 'goes down' figure is checking, savings and the goals together, as Get started says", async () => {
  const d = await fireSam(-250, { goal: 300 });
  assert.ok(Math.abs(d.saving.goals - 3600) < 1, `goals ${d.saving.goals}`);
  assert.ok(Math.abs(d.saving.short - 3000) < 50, `short ${d.saving.short}: -$250 a month is $3,000 a year, the goals' $300 inside it`);
  const src = await srcOf("../modules/retirement/fire/view.js");
  assert.match(src, /checking, savings and your goals together/);
});

// ---------------------------------------------------------------- fix round 2 (2026-11-12, claude-c)
// N-1: a rental typed only on Rental analysis (no Income rent line holds it). The month took its loan off and counted none of its
// rent (2,775.38), while the tax (Federal estimate rentalStep) and Will the money last? (rentalLines) count it after its costs.
const noRentLine = (p) => { p.income = p.income.filter((x) => x.type !== "rental"); return p; };
test("N-1: a rental only on Rental analysis counts its rent after empty months and running costs in the month, as with an Income line", () => {
  const withLine = nextBest(migrate(condoOnlyRentalPlan()), { today: RT }).spare;
  for (const [how, make] of [["loan typed on Rental analysis", condoOnlyRentalPlan], ["condo and loan on Net worth and Debts", condoOnNetWorthPlan]]) {
    const s = nextBest(migrate(noRentLine(make())), { today: RT }).spare;
    assert.ok(Math.abs(s.monthly - withLine.monthly) < 0.01, `${how}: leftover ${s.monthly.toFixed(2)} without an Income rent line, ${withLine.monthly.toFixed(2)} with one`);
    // the rent is in "Pay and other income", its empty months and costs on the rental line, so the lines still add up
    const sum = (x) => x.gross - ((x.businessCosts ?? 0) + x.federalTax + x.payrollTax + x.stateTax + x.careLost + x.rentCosts + (x.rentLoan ?? 0) + x.spending + x.retirementSaving + x.goalSaving + x.debtExtra + x.held);
    assert.ok(Math.abs(sum(s) - s.monthly) < 0.01, `${how}: lines ${sum(s).toFixed(2)} vs ${s.monthly.toFixed(2)}`);
    assert.ok(Math.abs(s.gross - withLine.gross) < 0.01, `${how}: the rent $2,100 is income: ${s.gross.toFixed(2)} vs ${withLine.gross.toFixed(2)}`);
    const b = budget(migrate(noRentLine(make())), { today: RT });
    assert.ok(Math.abs(b.saving.full - s.monthly) < 0.01, `${how}: Budget ${b.saving.full.toFixed(2)} vs ${s.monthly.toFixed(2)}`);
  }
});

test("N-1: a rental whose Income rent line (same name) has ended counts no rent, costs or loan in the month, as Will the money last? reads it sold", () => {
  const p = condoOnlyRentalPlan(); const line = p.income.find((x) => x.type === "rental"); line.name = "Condo rent"; line.endDate = "2025-06-30";
  const s = nextBest(migrate(p), { today: RT }).spare;
  assert.equal(Math.round((s.rentCosts ?? 0) * 100), 0, `costs ${s.rentCosts}`);
  assert.equal(Math.round((s.rentLoan ?? 0) * 100), 0, `loan ${s.rentLoan}`);
  const none = noRentLine(condoOnlyRentalPlan()); none.property = [];
  assert.ok(Math.abs(s.gross - nextBest(migrate(none), { today: RT }).spare.gross) < 0.01, "no rent counted");
});

// L-N2 (refuted as a month bug, rule documented in the budget-percent README): with no rent typed on Rental analysis the app cannot
// tell which Income rent line is that place's, so the Income rent is taxed as other income and the place's costs, interest and
// depreciation are a rental loss that at this income waits (IRC 469(i)); the month's federal tax is the Federal estimate's.
test("L-N2: blank rent on Rental analysis: the month's federal tax is the Federal estimate's, and the place's running costs come off whole", async () => {
  const { known } = await import("../modules/taxes/federal/known.js");
  const q = migrate(condoOnNetWorthPlan()); q.property[0].rentMonthly = null;
  const s = nextBest(q, { today: RT }).spare, k = known(q, { today: RT });
  assert.ok(Math.abs(s.federalTax * 12 - (k.result.totalTax - (k.result.additionalMedicare ?? 0))) < 1, `month ${s.federalTax * 12} vs Federal estimate ${k.result.totalTax}`);
  assert.ok(k.rental.passive.suspended > 25000, `the place's loss waits: ${k.rental.passive.suspended}`);
  assert.ok(Math.abs(s.monthly - 3355.04) < 0.01, `leftover ${s.monthly.toFixed(2)} (4,413.38 before fix round 1's B-6)`);
});

// NEW-1 (fix round 3): Reports > Financial statements builds its lines from the Income page, taxes, spending and saving, but its
// "Left over" and "Left in cash" are Next best action's month, which since round 1 also takes off a rental's running costs and a
// loan typed only on Rental analysis, and since round 2 brings in rent no Income line holds. The lines no longer added up:
// on the condo plans fromLiving less saving was 58,505 / 68,717 against 44,545. The child care account's lost money was missing too.
test("NEW-1: Financial statements: on the condo plans and a lost child care account, every line adds up to Left over and Left in cash", async () => {
  const { compute: statements } = await import("../modules/reports/statements/compute.js");
  const { emptyPlan } = await import("../core/schema/migrate.js");
  const careLostPlan = () => {
    const p = emptyPlan(); p.household.filingStatus = "head_of_household"; p.household.state = "OH";
    p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
    p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
    p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1300, period: "monthly", essential: true }];
    p.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2026 } } };
    return p;
  };
  const plans = [["condo on Net worth", condoOnNetWorthPlan()], ["condo only on Rental analysis", condoOnlyRentalPlan()],
    ["condo only on Rental analysis, no Income rent line", noRentLine(condoOnlyRentalPlan())], ["condo on Net worth, no Income rent line", noRentLine(condoOnNetWorthPlan())],
    ["a child care account with no care to pay back", careLostPlan()]];
  let rentOwnSeen = 0, careSeen = 0;
  for (const [how, raw] of plans) {
    const p = migrate(raw), d = statements(p, { today: RT }), s = nextBest(p, { today: RT }).spare, i = d.income, c = d.cashflow;
    if (s.rentOwn > 0) rentOwnSeen++;
    if (s.careLost > 0) careSeen++;
    const lines = i.lines.reduce((t, l) => t + l.yearly, 0);
    assert.ok(Math.abs(lines - i.total) < 0.5, `${how}: income lines ${lines.toFixed(0)} vs Total income ${i.total.toFixed(0)}`);
    const out = (i.businessCosts ?? 0) + i.federalTax + i.payrollTax + i.stateTax + (i.careLost ?? 0) + (i.rentCosts ?? 0) + (i.rentLoan ?? 0) + i.expensesTotal + i.retirementSaving + i.goalSaving + i.debtExtra + i.held;
    assert.ok(Math.abs(i.total - out - i.net) < 0.5, `${how}: income statement lines give ${(i.total - out).toFixed(0)}, Left over ${i.net.toFixed(0)}`);
    const every = c.income - c.taxes - c.living - c.businessCosts - c.held - (c.careLost ?? 0) - (c.rentCosts ?? 0) - (c.rentLoan ?? 0);
    assert.ok(Math.abs(every - c.fromLiving) < 0.5, `${how}: cash-flow lines give ${every.toFixed(0)}, Everyday cash ${c.fromLiving.toFixed(0)}`);
    assert.ok(Math.abs(c.fromLiving - c.retirement - c.goals - c.debtExtra - c.net) < 0.5, `${how}: Everyday cash less what is put to work ${(c.fromLiving - c.retirement - c.goals - c.debtExtra).toFixed(0)}, Left in cash ${c.net.toFixed(0)}`);
    assert.ok(Math.abs(c.net - s.monthly * 12) < 0.5, `${how}: Left in cash is Next best action's month x 12`);
  }
  assert.ok(rentOwnSeen >= 2 && careSeen >= 1, `rent from Rental analysis (${rentOwnSeen}) and a lost care account (${careSeen}) were checked`);
});
