// tests/left2-merge-items.test.mjs -- the requests other builders left for the left2 lane, carried when it was merged
// (2026-11-11, claude-c): B1, B2, B3 (claude-b, retirement/projection and the engine), E1, E2, E3 (claude-e, overview/setup),
// the compute-side workboard items W a-f (overview/setup), and the handoff's item (4) loan part (one figure for both ways a
// rental is entered). Each was written before its fix and failed first; the logs are named in the left2 merge report.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../modules/retirement/projection/compute.js";
import * as S from "../modules/overview/setup/compute.js";
import { project } from "../core/math/retirement.js";
import { setupRowsMonthly } from "../core/math/leftover.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { condoOnNetWorthPlan, condoOnlyRentalPlan } from "../qa/fixtures/round8-rental.mjs";

const T = "2026-11-11";
const RANK = { "on track": 0, tight: 1, short: 2 };
const empty = () => migrate(emptyPlan());

/** The family plan with no retirement figure: the page reads today's bills (Expenses). */
const fromBills = () => { const p = familyPlan(T); delete p.retirement.spendingMonthly; return p; };

test("B1: retyping the figure the page showed from Expenses (or $100 less) keeps the loans those bills hold, and never makes the answer worse", () => {
  const p = fromBills();
  const d = P.compute(p, { today: T });
  const exLoans = d.inputs.loans.map((l) => l.accountId ?? l.name).sort();
  assert.ok(exLoans.length >= 1, "the family's bills hold its loan payments");
  const shown = Math.round(d.spendingYearly / 12);
  for (const v of [shown, shown - 100]) {
    const q = structuredClone(p);
    P.saveSpendingFigure(q, v, null);
    assert.equal(q.retirement.spendingFrom, "expenses", "the figure is marked as typed over today's bills");
    const e = P.compute(q, { today: T });
    assert.deepEqual(e.inputs.loans.map((l) => l.accountId ?? l.name).sort(), exLoans, `typed ${v}: the same loans leave the spending at their payoff`);
    assert.ok(RANK[e.verdict] <= RANK[d.verdict], `typed ${v}: ${e.verdict} is no worse than ${d.verdict}`);
    // year by year: never more spent than the Expenses path spends (the figure is at or below it)
    const a = project(d.inputs).rows.filter((r) => r.retired), b = project(e.inputs).rows.filter((r) => r.retired);
    b.forEach((r, i) => assert.ok(r.spending <= a[i].spending + 12 * r.priceLevel + 0.01, `${r.year}: ${r.spending} <= ${a[i].spending}`));
  }
  // cleared: the mark goes with the figure
  const q = structuredClone(p); P.saveSpendingFigure(q, shown, null); P.saveSpendingFigure(q, "", null);
  assert.equal(q.retirement.spendingFrom, undefined);
});

test("B2: in working years a partner's pay pays the tax on it; nothing comes out of savings for it (brackets mode)", () => {
  const p = familyPlan(T); p.household.people[1].retirementAge = 75; p.retirement.taxMode = "brackets";
  const b = P.buildInputs(p, { today: T });
  const rows = project(b.inputs).rows.filter((r) => !r.retired);
  assert.ok(rows.length > 0 && rows[0].income > 0 && rows[0].taxes > 0, "the pay is income in the run and taxed");
  for (const r of rows) {
    const w = r.withdrawn.cash + r.withdrawn.taxable + r.withdrawn.deferred + r.withdrawn.free;
    assert.ok(w < 0.01, `${r.year}: ${Math.round(w)} taken from savings in a working year`);
  }
});

test("B3: the note 'a typed leftover is not added' is not said once the leftover has its own saving row", () => {
  const p = familyPlan(T);
  p.guide = p.guide ?? {}; p.guide.setup = p.guide.setup ?? {};
  p.guide.setup.spendLeft = { left: 500, rows: setupRowsMonthly(p) };
  const said = (d) => (d.notes ?? []).some((n) => /is left over\. That stays in checking/.test(n));
  assert.equal(said(P.compute(p, { today: T })), true, "said while the leftover has no row of its own");
  const q = structuredClone(p);
  q.retirement.leftover = { rowId: "c-left" };
  assert.equal(said(P.compute(q, { today: T })), false);
});

test("E1: pay with no How often tapped is left unread; a key left out is still a year's pay", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 4000, period: null } } });
  assert.equal(p.income.filter((x) => x.personId === "setup-self").length, 0, "no line written from an amount with no How often");
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 4000, period: "monthly" } } });
  assert.equal(p.income.find((x) => x.id === "setup-pay-setup-self")?.period, "monthly");
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 5000, period: null } } });
  const line = p.income.find((x) => x.id === "setup-pay-setup-self");
  assert.ok(line, "the line already there stays");
  assert.deepEqual([line.amount, line.period], [4000, "monthly"], "and is not changed by an amount with no How often");
  const q = empty(); S.applyYou(q, { who: "me" });
  S.applyMoney(q, { people: { "setup-self": { status: "work", amount: 60000 } } });
  assert.equal(q.income.find((x) => x.id === "setup-pay-setup-self")?.period, "annual");
});

test("E2: savings never asked (no accounts, no answer to 'What do you have?'): the months the cash covers are not known", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 60000, period: "annual" } } });
  S.applySpend(p, { mode: "rows", rows: { housing: 1500, groceries: 400 } });
  const st = S.standing(p, { today: T });
  assert.equal(st.runway, null);
  assert.equal(st.runwayStatus, "unknown");
  // only debts on file (a card): still not asked
  p.accounts.push({ id: "card", name: "Card", type: "credit", balance: 900, asOf: T, ownerId: "", institution: "", history: [] });
  assert.equal(S.standing(p, { today: T }).runway, null);
  // a checking account on file with nothing in it: 0 months, a figure
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 0, asOf: T, ownerId: "", institution: "", history: [] });
  assert.equal(S.standing(p, { today: T }).runway, 0);
});

test("E3 and W d: the pace sentence says the months as the pages do, and 'we suggest' until the months are chosen", () => {
  const plan = empty();
  const c = { now: 10000, all: 10000, earmarked: 0, taxOwed: 0, covered: 2.96, months: 3 };
  const s = S.cushionHave(plan, c);
  assert.ok(s.includes("2.9 months so far"), s);
  assert.ok(s.endsWith("and we suggest 3."), s);
  const chosen = empty(); chosen.assumptions.emergencyMonths = 3; chosen.guide = { setup: { cushionSaid: true } };
  assert.ok(S.cushionHave(chosen, c).endsWith("and you want 3."));
  const over = S.cushionHave(chosen, { ...c, covered: 6.06, months: 6 });
  assert.ok(over.includes("6.1 months, a bit over the 6 you want"), over);
});

test("W a: 'I already get it' with no birth year keeps the amount typed, on Income", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  p.household.people[0].birthDate = "";
  S.applyAges(p, { people: { "setup-self": { ss: { mode: "getting", amount: 1850 } } } }, T);
  const line = p.income.find((x) => x.id === "setup-ss-setup-self");
  assert.ok(line, "an Income line is written");
  assert.deepEqual([line.amount, line.type, line.period], [1850, "social", "monthly"]);
});

test("W b: the where-you-stand sentence never points at 'the moves below'", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 2000, period: "monthly" } } });
  S.applySpend(p, { mode: "rows", rows: { housing: 2500, groceries: 600 } });
  const st = S.standing(p, { today: T });
  assert.ok(!/below/.test(st.headline), st.headline);
});

test("W c: everyone retired reads 'Making the money last' wherever the goals are named", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  p.guide.setup.status = { "setup-self": "retired" };
  assert.equal(S.goalsFor(p).find((g) => g.key === "retire").label, "Making the money last");
  const w = empty(); S.applyYou(w, { who: "me" });
  assert.equal(S.goalsFor(w).find((g) => g.key === "retire").label, "Retiring well");
});

test("W e: 'I don't owe anything' drops the 'Paying off debt' goal", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyGoalPicks(p, ["debt", "cushion"]);
  S.applyOwePicks(p, ["none"]);
  assert.deepEqual(p.guide.setup.picks.goals.includes("debt"), false);
});

test("W f: one person is asked for 'your birth date', never 'birth dates'", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  p.household.people[0].birthDate = "";
  assert.equal(S.retirementMissing(p), "Social Security and your birth date");
});

test("item 4: the condo entered on Net worth or only on Rental analysis gives one retirement answer, its loan leaving at payoff either way", () => {
  const out = [condoOnNetWorthPlan(), condoOnlyRentalPlan()].map((p) => {
    const b = P.buildInputs(p, { today: T });
    const rows = project(b.inputs).rows.filter((r) => r.retired);
    return { rows, verdict: P.compute(p, { today: T }).verdict };
  });
  assert.equal(out[0].verdict, out[1].verdict);
  // spending less income each retired year: the same to the $10 the figure is rounded to ($12 a year in today's dollars)
  out[0].rows.forEach((r, i) => {
    const s = out[1].rows[i];
    const a = r.spending - r.income, b = s.spending - s.income;
    assert.ok(Math.abs(a - b) <= 12 * 3.5 * r.priceLevel + 0.01, `${r.year}: ${Math.round(a)} vs ${Math.round(b)}`);
  });
});
