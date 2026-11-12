// tests/followups-fix1.test.mjs -- the review fixes to follow-ups A, B, C (money D1 to D9, UX 1 to 5). Each says what it did before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimators, TABLES } from "../modules/overview/guesses/compute.js";
import { payOf, jobPayOf } from "../modules/overview/guesses/estimators/saving.js";
import * as S from "../modules/overview/setup/compute.js";
import { compute as nextBest } from "../modules/overview/next-best-action/compute.js";
import { compute as planPage } from "../modules/overview/plan/compute.js";
import { fillBlankFromGuess, contributionFormStart } from "../modules/retirement/contributions/view.js";
import { removePerson } from "../modules/household/people/compute.js";
import { estimate, mergeEstimators, settle, isGuess } from "../core/estimate/index.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { compute as assets } from "../modules/balance/assets/compute.js";
import { jordan, patLee } from "../qa/fixtures/setup-personas.mjs";

const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const T0 = "2026-11-02", T6 = "2026-11-06";
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const ME = "setup-self", PARTNER = "setup-partner";
const gx = (plan) => { const before = structuredClone(plan); return (key, opts = {}) => estimate(before, key, { ...OPTS, ...opts }); };
function q4b(plan, v, picks) { if (picks) S.applyHavePicks(plan, picks); S.applyHaveAmounts(plan, v, T0, { guess: gx(plan) }); return plan; }
const worker = (plan) => { plan.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1400, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "food", amount: 500, period: "monthly", essential: true }]; return plan; };
const row = (plan, pid) => plan.retirement.contributions.find((c) => c.id === `setup-contrib-${pid}`);
const matchStep = (plan) => nextBest(plan, { today: T6 }).steps.find((s) => s.id === "match");
const salary = (id, amount, extra = {}) => ({ id, name: id, type: "salary", personId: ME, amount, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true, ...extra });
const one = (over = {}) => { const p = migrate(emptyPlan()); S.applyYou(p, { name: "Kit", who: "me", kids: 0, state: "OH" });
  S.applyMoney(p, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "yes", ...over } } }, T0);
  S.applyAges(p, { people: { [ME]: { month: 6, year: 1985, stopAge: 65, ss: { mode: "estimate" } } } }, T0); return worker(p); };

test("D1: a second job does not raise the match step's advice: the 401(k) goes by the pay of its own job", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  const two = worker(jordan()); two.income.push(salary("second-job", 40000)); q4b(two, {}, ["retire"]);
  assert.equal(S.employerPay(two, ME, T6), S.employerPay(j, ME, T6), "Get started's share chips used all pay");
  const a = matchStep(j).detail, b = matchStep(two).detail;
  assert.equal(b, a, "the step read $490 a month on combined pay where the job pays $290");
  assert.doesNotMatch(b, /\$490/);
});

test("D2: the job's pay is the pay line only while it pays a salary now; otherwise all employer pay", () => {
  const p = worker(jordan());
  const root = p.income.find((x) => x.id === `setup-pay-${ME}`);
  root.endDate = "2026-06-30";                       // a new job began; its pay was typed on Income
  p.income.push(salary("new-job", 70000, { startDate: "2026-07-01" }));
  assert.equal(jobPayOf(p, ME, T6), 70000, "the ended Get started line made the job's pay $0");
  // a business in Get started, a salary typed on Income: still a 401(k) guess from that salary
  const k = one({ by: "self" }); k.income.push(salary("inc-dayjob", 60000));
  q4b(k, { [`kind-${ME}`]: "work" }, ["retire"]);
  assert.equal(jobPayOf(k, ME, T6), 60000);
  assert.ok(row(k, ME)?.amount > 0, "no contribution row at all");
  // a bonus from the same person is part of the job's pay
  const b = worker(jordan()); const base = jobPayOf(b, ME, T6); b.income.push({ ...salary("inc-bonus", 8000), type: "bonus" });
  assert.equal(jobPayOf(b, ME, T6), base + 8000);
});

test("D3/D4: 'No' to the plan at work drops only a guess nothing points at; leaving work keeps a guessed 401(k)", () => {
  const g = one(); q4b(g, {});
  g.estate = g.estate ?? {}; g.estate.beneficiaries = [{ id: "b1", accountId: `setup-workplan-${ME}`, name: "Sister", share: 1, kind: "primary" }];
  S.applyMoney(g, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "no" } } }, T0);
  const acc = g.accounts.find((a) => a.id === `setup-workplan-${ME}`);
  assert.ok(acc, "kept: a beneficiary is named on it");
  assert.doesNotMatch(acc.name, /plan at work/i);
  assert.equal(isGuess(g, `accounts[${acc.id}].balance`), true, "the guess became a typed figure");
  const r = row(g, ME);
  if (r) { assert.equal(isGuess(g, `retirement.contributions[${r.id}].amount`), true, "$270 a month became typed and flows into a plan that does not exist"); }
  settle(g, { ...OPTS, today: T6 });
  assert.equal(row(g, ME)?.amount ?? 0, 0, "it settles to nothing under No");
  // retired: the guessed 401(k) stays
  const q = one(); q4b(q, {});
  S.applyMoney(q, { people: { [ME]: { status: "retired" } } }, T0);
  assert.ok(q.accounts.some((a) => a.type !== "checking" && a.balance > 0 && /retire|401|plan/i.test(a.type + a.name)), "retiring deleted the guessed 401(k)");
});

test("D5: the tie-break for two same-named homes does not take the homeowners policy from the home it covered", () => {
  const pol = (id, name, kind) => ({ id, name, kind, personId: "", premium: 100, period: "monthly" });
  const p = migrate(emptyPlan());
  p.household.people = [{ id: "me", name: "Me", role: "self", birthDate: "1980-01-01" }];
  p.accounts = [["a1", "Condo", 300000], ["a2", "Condo", 200000], ["a3", "Cabin", 150000]].map(([id, name, balance]) => ({ id, name, type: "property", balance, ownerId: "", history: [] }));
  p.property = [{ id: "r1", kind: "rental", name: "Condo", value: 200000, accountId: "a2", rent: 2000 }, { id: "r2", kind: "rental", name: "Cabin", value: 150000, accountId: "a3", rent: 1000 }];
  p.insurance.policies = [pol("p1", "Condo landlord policy", "landlord"), pol("p2", "Homeowners policy", "home")];
  const d = assets(p, { today: T6 });
  const by = Object.fromEntries(d.homes.map((h) => [`${h.name}${h.rental ? "-rental" : ""}`, h.policy?.name ?? null]));
  assert.equal(by["Condo-rental"], "Condo landlord policy");
  assert.equal(by["Condo"], "Homeowners policy", "the lived-in Condo was left with no policy");
});

test("D6: a removed partner's pay kept as the household's is never a self-employed or retired adult's pay", () => {
  for (const mine of [{ status: "work", by: "self", amount: "60000", period: "annual" }, { status: "retired", pension: 900 }]) {
    const p = migrate(emptyPlan()); S.applyYou(p, { name: "Pat", who: "spouse", partnerName: "Lee", kids: 0, state: "AZ" });
    S.applyMoney(p, { people: { [ME]: mine, [PARTNER]: { status: "work", amount: "40000", period: "annual" } } }, T0);
    S.applyAges(p, { people: { [ME]: { month: 3, year: 1965, stopAge: 65, ss: { mode: "estimate" } }, [PARTNER]: { month: 8, year: 1967, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
    worker(p); q4b(p, {}, ["retire"]);
    const before = payOf(p, ME, T6);
    removePerson(p, PARTNER, { keep: true });
    assert.equal(payOf(p, ME, T6), before, `${mine.status}: Lee's $40,000 became Pat's pay`);
  }
});

test("D7: a gray amount kept while 'How often' changes stays the same money", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  const r = row(j, ME), start = contributionFormStart(j, r);
  const v = fillBlankFromGuess({ amount: "", employerMatch: null, period: "biweekly" }, start);
  assert.ok(Math.abs(Number(v.amount) * 26 / 12 - r.amount) < 0.5, `${v.amount} every two weeks is not ${r.amount} a month`);
  assert.equal(fillBlankFromGuess({ amount: "", employerMatch: null, period: "monthly" }, start).amount, String(r.amount));
});

test("D8: a removed partner's kept contribution guess is frozen, not worked again without an age", () => {
  const pl = worker(patLee()); q4b(pl, {}, ["retire"]);
  const before = { amount: row(pl, PARTNER).amount, match: row(pl, PARTNER).employerMatch };
  removePerson(pl, PARTNER, { keep: true });
  settle(pl, { ...OPTS, today: T6 });
  const r = row(pl, PARTNER);
  if (r) assert.deepEqual({ amount: r.amount, match: r.employerMatch }, before, "it moved when the birth date went");
});

test("D9: 17.9 months against a target of 6 reads 'well over', not '17.9 of 6 months'", () => {
  const plan = { meta: { currency: "USD" }, accounts: [{ id: "c", type: "checking", name: "Checking", balance: 21500 }] };
  const words = S.cushionHave(plan, { now: 21500, all: 21500, covered: 17.9, months: 6, earmarked: 0, taxOwed: 0 });
  // months never chosen in this plan: "we suggest 6" (left2 merge W d, 2026-11-11)
  assert.match(words, /18 months, well over the 6 we suggest/);
  assert.doesNotMatch(words, /17\.9 of 6/);
  const short = S.cushionHave(plan, { now: 11500, all: 11500, covered: 1.9, months: 6, earmarked: 0, taxOwed: 0 });
  assert.match(short, /1\.9 months so far, and we suggest 6/);
});

test("UX1: a couple who typed their total and spending are not told to type their 401(k) again", () => {
  const c = migrate(emptyPlan()); S.applyYou(c, { name: "Kit", who: "spouse", partnerName: "Lee", kids: 0, state: "OH" });
  S.applyMoney(c, { people: { [ME]: { status: "work", amount: "50000", period: "annual" }, [PARTNER]: { status: "work", amount: "52000", period: "annual" } } });
  S.applyAges(c, { people: { [ME]: { month: 3, year: 1990, stopAge: 65, ss: { mode: "estimate" } }, [PARTNER]: { month: 8, year: 1990, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  c.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 3000, period: "monthly", essential: true }]; c.retirement.spendingMonthly = 6500;
  q4b(c, { [`retire-${ME}`]: "500000", joint: "both" }, ["retire"]);
  const st = S.standing(c, { today: T6 });
  assert.equal(st.retireGuessedWhat, "saving", "the split of a typed total counted as a guessed balance");
  const ask = S.retireGuessAsk(st);
  assert.equal(ask.words, "Partly our guesses. Check what you put in each month ›");
  assert.equal(ask.href, "#/retirement/contributions");
  const line = planPage(c, { today: T6 }).groups.flatMap((g) => g.rows).find((r) => r.key === "retire").line;
  assert.match(line, /Partly our guesses of what you put in each month\.$/);
  assert.doesNotMatch(line, /of your spending/, "Your plan said 'of your spending' though the spending was typed");
});

test("UX2: a young renter with no retirement savings reads 'not known yet' on the reveal, Your plan and Goal seek, never 'short' or 'runs out'", async () => {
  const a = migrate(emptyPlan()); S.applyYou(a, { name: "Alex", who: "me", kids: 0, state: "OH" });
  S.applyMoney(a, { people: { [ME]: { status: "work", amount: "52000", period: "annual" } } });
  S.applyAges(a, { people: { [ME]: { month: 3, year: 2000, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  S.applyHavePicks(a, ["checking"]); S.applyHaveAmounts(a, { checking: 2400 }, T0);
  a.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "food", amount: 500, period: "monthly", essential: true }];
  const st = S.standing(a, { today: T6 });
  assert.equal(st.retireSavingsUnknown, true, "the reveal said 'Short at 65' where the next screen says 'We don't know yet'");
  const rows = planPage(a, { today: T6 }).groups.flatMap((g) => g.rows);
  assert.match(rows.find((r) => r.key === "retire").value, /Not known yet/);
  const fix = rows.find((r) => r.key === "fix-retire");
  // since the stress test of 2026-11-11 (j-first-renter/F4) the path has no "What would help" step while the savings are not
  // known, so the row is gone; if it is ever shown again it must still not promise changes
  assert.ok(!fix || /Add your retirement savings first/.test(fix.line), "Your plan promised 'a few changes would make it last'");
  const { compute: gs } = await import("../modules/scenarios/goal-seek/compute.js");
  const g = gs(a, { today: T6 });
  assert.ok(g.ready && !g.meets);
  assert.equal(g.noSavings, true, "Goal seek said the money runs out in 2065");
});
