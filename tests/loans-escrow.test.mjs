// tests/loans-escrow.test.mjs -- a loan's payment ends when the loan is paid off, everywhere, and the tax and insurance inside a
// mortgage payment are counted once (2026-11-07, claude-b, lane 1). Formulas and sources: modules/retirement/projection/README.md
// "Loans in retirement spending", modules/overview/guesses/README.md "Tax and insurance in the payment", modules/property/home/README.md.
// The households are built through Get started's own apply functions, as tests/home-purchase.test.mjs builds them.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../modules/overview/setup/compute.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { estimate, mergeEstimators, settle, isGuess, confirmGuess } from "../core/estimate/index.js";
import { estimators, TABLES, guessTwins, compute as guessesPage } from "../modules/overview/guesses/compute.js";
import { estimators as setupEstimators } from "../modules/overview/setup/compute.js";
import { compute as liabilities, loanMonths } from "../modules/balance/liabilities/compute.js";
import { buildInputs, setupLoans, setupFigure, rentalLines, spendingLoans } from "../modules/retirement/projection/compute.js";
import { project, copyInputs } from "../core/math/retirement.js";
import { addMonths } from "../core/math/dates.js";
import { escrowBefore, escrowKept, answerEscrow, escrowSaid, loanEscrow, ESCROW_KEY } from "../modules/overview/guesses/estimators/home.js";
import { tapSpan, mortgageAsk, startAsk, startOf, recordOf } from "../modules/overview/guesses/estimators/debts.js";
import { profileOf } from "../modules/overview/guesses/estimators/common.js";
import { loanFrom } from "../modules/overview/guesses/estimators/purchase.js";
import { compute as homePage } from "../modules/property/home/compute.js";
import { compute as mortgagePage } from "../modules/debt/mortgage/compute.js";

const T0 = "2026-11-07";
const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }]);
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""}: ${a} vs ${b}`);

/** A Get started household, Q5b answered with the given boxes (the screen's own apply functions, our guesses on). */
export function household({ ages = [25], state = "OH", pay = 60000, home = null, mortgage = {}, bought, tap, retired = false, owe = ["mortgage"] } = {}) {
  const p = migrate(emptyPlan());
  const couple = ages.length > 1;
  S.applyYou(p, { name: "Pat", who: couple ? "spouse" : "me", partnerName: couple ? "Lee" : undefined, kids: 0, state });
  const year = (age) => Number(T0.slice(0, 4)) - age;
  const people = { "setup-self": retired ? { status: "retired" } : { status: "work", amount: String(pay), period: "annual" } };
  const born = { "setup-self": { month: 6, year: year(ages[0]), stopAge: 65, retired, ss: { mode: "estimate" } } };
  if (couple) { people["setup-partner"] = retired ? { status: "retired" } : { status: "work", amount: String(pay * 0.9), period: "annual" }; born["setup-partner"] = { month: 6, year: year(ages[1]), stopAge: 65, retired, ss: { mode: "estimate" } }; }
  S.applyMoney(p, { people, today: T0 });
  S.applyAges(p, { people: born }, T0);
  S.applyHavePicks(p, ["checking", "home"]);
  S.applyOwePicks(p, owe);
  const via = (fn) => { const before = structuredClone(p); fn(p, (k, o = {}) => estimate(before, k, { ...OPTS, ...o })); settle(p, OPTS); };
  via((d, g) => S.applyHaveAmounts(d, { ...(home ? { home } : {}), ...(bought !== undefined ? { bought } : {}) }, T0, { guess: g }));
  via((d, g) => S.applyOweAmounts(d, { mortgage: { ...mortgage, ...(tap ? { start: tap } : {}) } }, T0, { guess: g }));
  return p;
}
const mortgageRow = (p) => liabilities(p, { today: T0 }).rows.find((r) => r.type === "mortgage");

// ---- (1) the engine: a loan payment the spending holds is a fixed amount until its payoff year
const engineInputs = (extra = {}) => ({
  startYear: 2030, endYear: 2045, people: [{ name: "A", birthYear: 1965, retireAge: 65, endAge: 80 }],
  balances: { cash: 0, taxable: 900000, deferred: 0, free: 0 }, contributions: [], incomes: [], spending: { yearly: 60000 }, retireYear: 2030,
  rates: { inflation: 0.03, cash: 0.02, salaryGrowth: 0.03, taxRate: 0, stocksNow: 0.5, stocksRetired: 0.5 }, returns: { stocks: 0.05, bonds: 0.03 },
  rmd: null, strategy: "fixed-real", withdrawalRate: 0.04, ...extra,
});

test("engine: a loan's payment is spent as a fixed amount up to its payoff year (the months paid in it), then only the rest of the figure", () => {
  // $60,000 a year holds a $12,000-a-year loan payment ending in June 2034: 2030-2033 spend $48,000 at that year's prices plus a flat
  // $12,000; 2034 half of it ($6,000: six months); from 2035 only $48,000 at that year's prices
  const r = project(engineInputs({ loans: [{ yearly: 12000, inBase: 12000, untilYear: 2034, lastMonths: 6 }] }));
  const row = (y) => r.rows.find((x) => x.year === y);
  for (const y of [2030, 2031, 2033]) near(row(y).spending, 48000 * row(y).priceLevel + 12000, 1e-6, `${y}`);
  near(row(2034).spending, 48000 * row(2034).priceLevel + 6000, 1e-6, "the payoff year: six months");
  for (const y of [2035, 2040, 2045]) near(row(y).spending, 48000 * row(y).priceLevel, 1e-6, `${y}: paid off`);
  // the rule sr.verdict.loans-end reads: today's-dollar spending falls by the payment at payoff (here the whole of it)
  assert.ok(row(2033).spendingReal - row(2035).spendingReal >= 0.5 * 12000 / row(2035).priceLevel);
  // no loans: the same rows to the bit as before (the engine's own tests hold the rest)
  const a = project(engineInputs()), b = project(engineInputs({ loans: [] }));
  assert.deepEqual(a.rows.map((x) => x.spending), b.rows.map((x) => x.spending));
  // a loan that never pays off at its payment runs to the end, fixed
  const never = project(engineInputs({ loans: [{ yearly: 12000, inBase: 12000 }] }));
  near(never.rows.at(-1).spending, 48000 * never.rows.at(-1).priceLevel + 12000, 1e-6, "never paid off");
  // copyInputs copies the loans (a what-if never changes the original)
  const I = engineInputs({ loans: [{ yearly: 1, inBase: 1, untilYear: 2031 }] }), c = copyInputs(I);
  c.loans[0].yearly = 99; assert.equal(I.loans[0].yearly, 1);
});

test("engine: guardrails spend the loan on top of the target, never trimmed; a share of savings is not changed by it", () => {
  const g = project(engineInputs({ strategy: "guardrails", loans: [{ yearly: 12000, inBase: 12000, untilYear: 2034, lastMonths: 12 }] }));
  near(g.rows[0].spending, 48000 + 12000, 1e-6, "the first year: the target without the loan, plus the loan");
  const after = g.rows.find((x) => x.year === 2035);
  assert.ok(after.spending <= 48000 * after.priceLevel + 1e-6, "after the payoff the target alone");
  const pct = engineInputs({ strategy: "percent" });
  assert.deepEqual(project(pct).rows.map((x) => x.spending), project({ ...pct, loans: [{ yearly: 12000, inBase: 12000, untilYear: 2034 }] }).rows.map((x) => x.spending));
});

// ---- (1) one payoff: Get started's retirement figure, Will the money last? and Debts
test("retirement figure: a loan counts as running when work stops by Debts' own payoff (the payment less its tax and insurance)", () => {
  // the bought verify's example: a couple aged 40 in Ohio who typed a $1,800 payment; Debts says about 305 months, work stops in 300
  const p = household({ ages: [40, 40], mortgage: { payment: "1,800" } });
  const row = mortgageRow(p), until = (65 - 40) * 12;
  assert.ok(row.escrow > 0, "the balance is our guess, so the usual tax and insurance are inside the payment");
  assert.ok(row.months > until, `Debts: ${row.months} months, past the ${until} until work stops`);
  assert.deepEqual(S.loansRunningThen(p, T0).map((d) => d.accountId), [row.id], "Get started's figure carries the mortgage");
  assert.deepEqual(setupLoans(p, T0).map((d) => d.accountId), [row.id], "and so does Will the money last?");
  const lm = loanMonths(p, p.accounts.find((a) => a.id === row.id), row.detail, T0);
  assert.equal(lm.months, row.months); near(lm.escrow, row.escrow, 1e-9);
  const sl = setupLoans(p, T0)[0];
  near(sl.toLoan + sl.escrow, sl.pay, 1e-9); assert.equal(sl.months, row.months);
});

test("retirement figure: every household of the grid agrees with Debts about the mortgage when work stops", () => {
  let n = 0;
  for (let age = 20; age <= 60; age += 5) for (const couple of [false, true]) for (const state of ["OH", "CA"]) for (const mortgage of [{}, { payment: "1,800" }, { owed: "150,000" }]) {
    const p = household({ ages: couple ? [age, age] : [age], state, mortgage });
    const row = mortgageRow(p), until = (65 - age) * 12;
    const running = S.loansRunningThen(p, T0).some((d) => d.accountId === row.id);
    assert.equal(running, !Number.isFinite(row.months) || row.months > until, `${age} ${couple} ${state} ${JSON.stringify(mortgage)}: Debts ${row.months} months, work stops in ${until}`);
    assert.equal(setupLoans(p, T0).some((d) => d.accountId === row.id), running, "Get started and Will the money last? agree");
    assert.equal(setupFigure(p, T0), S.retireDefault(p, T0), "setupFigure is retireDefault");
    n++;
  }
  assert.equal(n, 108);
});

test("retirement figure: a mortgage paid off before work stops leaves its tax and insurance in the figure; one still running carries its whole payment", () => {
  // a couple aged 30, nothing typed: the guessed loan (28 years or so) ends before work stops in 35 years
  const p = household({ ages: [30, 30] });
  const row = mortgageRow(p);
  assert.ok(row.months < 35 * 12 && row.escrow > 0);
  assert.equal(S.loansRunningThen(p, T0).length, 0);
  near(S.escrowAfterPayoff(p, T0), row.escrow, 1e-9, "the tax and insurance in the payment go on");
  const without = structuredClone(p); without.debts = [];
  assert.ok(S.retireDefault(p, T0) - S.retireDefault(without, T0) >= Math.floor(row.escrow / 10) * 10 - 10, "added to Get started's figure");
  assert.equal(setupFigure(p, T0), S.retireDefault(p, T0));
  // a household whose mortgage is still running then: its whole payment is in the figure, its tax and insurance not added again
  const q = household({ ages: [50, 50] });
  assert.equal(S.loansRunningThen(q, T0).length, 1);
  assert.equal(S.escrowAfterPayoff(q, T0), 0);
});

test("Will the money last?: the mortgage Get started's figure carries leaves the spending at Debts' payoff, as a fixed amount; its tax and insurance stay", () => {
  // a couple aged 55 who typed $2,600 a month (the guess-sanity household t-couple-55-all-debts' mortgage): retire in 2036
  const p = household({ ages: [55, 55], mortgage: { payment: "2,600" } });
  p.expenses = [{ id: "setup-x-groceries", name: "Groceries", category: "groceries", amount: 900, period: "monthly" }, { id: "power", name: "Power", category: "utilities", amount: 250, period: "monthly" }];
  p.guide.setup.retireAuto = true;
  const fig = setupFigure(p, T0);
  p.retirement = { ...(p.retirement ?? {}), spendingMonthly: fig };
  const row = mortgageRow(p);
  const b = buildInputs(p, { today: T0 });
  assert.equal(b.inputs.loans?.length, 1, "one loan the spending holds");
  const L = b.inputs.loans[0];
  assert.equal(L.accountId, row.id);
  assert.equal(L.ends, String(row.payoffDate).slice(0, 7), "the payoff Debts shows");
  near(L.monthly, 2600 - row.escrow, 1e-6, "the part that pays the loan; the tax and insurance stay in the spending");
  near(L.inBase, L.yearly, 1e-9);
  const r = project(b.inputs);
  const y = L.untilYear, before = r.rows.find((x) => x.year === y - 1), after = r.rows.find((x) => x.year === y + 1);
  assert.ok(before.retired, "still being paid after work stops");
  // the payment leaves today's-dollar spending at payoff (it was carried for life, rising with prices: sr.verdict.loans-end)
  assert.ok(before.spendingReal - after.spendingReal >= 0.5 * 2600 * 12 / after.priceLevel, `${before.spendingReal} -> ${after.spendingReal}`);
  // and while it runs it does not rise with prices: next year's nominal loan part is the same
  const y1 = r.rows.find((x) => x.year === b.inputs.retireYear), y2 = r.rows.find((x) => x.year === b.inputs.retireYear + 1);
  const rest = (x) => (b.spendingYearly - L.inBase) * x.priceLevel;
  near(y1.spending - rest(y1), L.yearly, 1e-6); near(y2.spending - rest(y2), L.yearly, 1e-6);
});

test("Will the money last?: today's bills as the spending: each debt payment in them ends at Debts' payoff", () => {
  const p = household({ ages: [55, 55], mortgage: { payment: "2,600" } });
  p.expenses = [{ id: "food", name: "Groceries", category: "groceries", amount: 900, period: "monthly" }];
  p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 0 };
  p.guide.setup.retireAuto = false;
  const b = buildInputs(p, { today: T0 });
  assert.equal(b.spendingSource, "expenses");
  const row = mortgageRow(p);
  const L = b.inputs.loans?.find((x) => x.accountId === row.id);
  assert.ok(L, "the mortgage in today's bills is a loan that ends");
  assert.equal(L.ends, String(row.payoffDate).slice(0, 7));
});

test("spendingLoans: a loan paid off before retirement leaves the figure; a typed figure carries none; a rental's loan is left to its own lines", () => {
  const p = household({ ages: [55, 55], mortgage: { payment: "2,600" } });
  const row = mortgageRow(p);
  const out = spendingLoans(p, [{ accountId: row.id, monthly: 2600 }], { today: T0 });
  assert.equal(out.length, 1);
  assert.equal(spendingLoans(p, [{ accountId: row.id, monthly: 2600 }], { today: T0, skip: new Set([row.id]) }).length, 0);
  assert.equal(spendingLoans(p, [{ accountId: row.id, monthly: 2600 }], { today: null }).length, 0, "no today, no dates");
  // a figure typed on Retirement settings is taken as it is: no loans
  const q = structuredClone(p); q.guide.setup.retireAuto = false; q.retirement = { ...(q.retirement ?? {}), spendingMonthly: 5000 };
  assert.equal(buildInputs(q, { today: T0 }).inputs.loans, undefined);
});

test("a rental's loan on Debts ends when Debts says (its payment less the tax and insurance in it)", () => {
  const p = household({ ages: [55, 55], mortgage: { owed: "150,000", payment: "1,500" } });
  p.accounts.push({ id: "condo-home", name: "Condo", type: "property", balance: 200000, asOf: T0 }, { id: "condo-loan", name: "Condo loan", type: "mortgage", balance: 120000, asOf: T0 });
  p.debts.push({ id: "condo-debt", accountId: "condo-loan", rate: 0.05, minPayment: 1100, extra: 0, escrowMonthly: 300 });
  p.property = [...(p.property ?? []), { id: "condo", kind: "rental", name: "Condo", accountId: "condo-home", loanAccountId: "condo-loan", rent: 1800 }];
  const row = liabilities(p, { today: T0 }).rows.find((r) => r.id === "condo-loan");
  near(row.escrow, 300, 1e-9);
  const people = [{ id: "setup-self", name: "Pat", birthYear: 1971, retireAge: 65, endAge: 95 }];
  const lines = rentalLines(p, people, 2036, T0);
  const loan = lines.find((x) => x.part === "loan");
  assert.equal(loan.loanEnds, String(row.payoffDate).slice(0, 7), "Debts' date, not nper on the whole $1,100");
  assert.equal(String(addMonths(T0, row.months)).slice(0, 7), loan.loanEnds);
});

// ---- (2) "Keep" on Our guesses, and the same figures typed on Get started: the tax and insurance stay in the payment
const DID = "setup-debt-mortgage", AID = "setup-owe-mortgage";
const debtOf = (p) => p.debts.find((d) => d.id === DID);
const keep = (p, path) => { const held = escrowBefore(p, T0); confirmGuess(p, path, T0); escrowKept(p, held, T0); settle(p, OPTS); };

test("Keep on Our guesses: keeping the guessed balance and payment keeps the tax and insurance inside it (payoff unchanged)", () => {
  const p = household({ ages: [25, 25] });
  const before = mortgageRow(p);
  assert.ok(before.escrow > 0, "the guessed payment holds the usual tax and insurance");
  keep(p, `accounts[${AID}].balance`);
  keep(p, `debts[${DID}].minPayment`);
  assert.equal(isGuess(p, `debts[${DID}].minPayment`), false, "the payment is the person's now");
  const d = debtOf(p), after = mortgageRow(p);
  near(d.escrowMonthly, before.escrow, 0.01, "escrowMonthly is the figure the guessed payment held");
  assert.equal(isGuess(p, `debts[${DID}].escrowMonthly`), true, "and it is still our guess (Our guesses lists it)");
  assert.equal(p.guesses[`debts[${DID}].escrowMonthly`].k, ESCROW_KEY);
  assert.equal(after.months, before.months, "Debts' payoff does not move (was 199 months, June 2043, before 2026-11-07)");
  assert.equal(after.payoffDate, before.payoffDate);
  // settle again (a later load): the figure does not drift
  settle(p, OPTS);
  near(debtOf(p).escrowMonthly, before.escrow, 0.01, "settle keeps it");
  assert.equal(mortgageRow(p).months, before.months);
});

test("Get started: typing the same two figures our guess showed keeps the tax and insurance and the rate", () => {
  const p = household({ ages: [25, 25] });
  const before = mortgageRow(p), d0 = debtOf(p);
  const via = (fn) => { const b = structuredClone(p); fn(p, (k, o = {}) => estimate(b, k, { ...OPTS, ...o })); settle(p, OPTS); };
  via((d, g) => S.applyOweAmounts(d, { mortgage: { payment: String(d0.minPayment), owed: String(Math.abs(p.accounts.find((a) => a.id === AID).balance)) } }, T0, { guess: g }));
  const after = mortgageRow(p);
  assert.equal(debtOf(p).rate, d0.rate, "the rate is not re-guessed from the two figures");
  near(debtOf(p).escrowMonthly, before.escrow, 0.01, "escrowMonthly kept");
  assert.equal(after.months, before.months);
});

// ---- (3) the question, asked once where the payment is typed
test("the question: Yes writes the typed figure, No writes 0, Not sure writes our usual figure as a guess; unanswered typed plans do not move", () => {
  const typed = { payment: "1,800", owed: "200,000", rate: "6.5" };
  const none = household({ ages: [40], mortgage: typed });
  assert.equal(debtOf(none).escrowMonthly, undefined, "typed both, never answered: nothing written");
  assert.equal(mortgageRow(none).escrow, 0, "and the typed payment is read as the loan's alone, as before");
  assert.equal(S.valuesFor(none, "owe-amounts").mortgage.escrow, null);

  const yes = household({ ages: [40], mortgage: { ...typed, escrow: "yes", escrowAmount: "450" } });
  assert.equal(debtOf(yes).escrowMonthly, 450);
  assert.equal(isGuess(yes, `debts[${DID}].escrowMonthly`), false, "a typed figure is the person's");
  assert.equal(mortgageRow(yes).escrow, 450);
  const lm = loanMonths(yes, yes.accounts.find((a) => a.id === AID), debtOf(yes), T0);
  assert.equal(lm.toLoan, 1350, "the loan is paid with $1,800 less $450");
  assert.ok(mortgageRow(yes).months > mortgageRow(none).months, "less goes to the loan: it lasts longer");
  assert.equal(S.valuesFor(yes, "owe-amounts").mortgage.escrow, "yes");
  assert.equal(S.valuesFor(yes, "owe-amounts").mortgage.escrowAmount, 450);

  const no = household({ ages: [40], mortgage: { ...typed, escrow: "no" } });
  assert.equal(debtOf(no).escrowMonthly, 0);
  assert.equal(mortgageRow(no).escrow, 0);
  assert.equal(mortgageRow(no).months, mortgageRow(none).months);
  assert.equal(S.valuesFor(no, "owe-amounts").mortgage.escrow, "no");

  const unsure = household({ ages: [40], mortgage: { ...typed, escrow: "unsure" } });
  const u = debtOf(unsure).escrowMonthly;
  assert.ok(u > 0 && u <= 900, `our usual figure, at most half the payment: ${u}`);
  assert.equal(isGuess(unsure, `debts[${DID}].escrowMonthly`), true, "Not sure: marked as our guess");
  assert.equal(S.valuesFor(unsure, "owe-amounts").mortgage.escrow, "unsure");
  // Yes with no figure: our usual figure, as a guess, said as "yes"
  const yes0 = household({ ages: [40], mortgage: { ...typed, escrow: "yes" } });
  near(debtOf(yes0).escrowMonthly, u, 0.01, "yes, figure blank: the usual figure");
  assert.equal(S.valuesFor(yes0, "owe-amounts").mortgage.escrow, "yes");
});

test("the question on Debts: answerEscrow writes the same as Get started's, and No then Yes changes it back", () => {
  const p = household({ ages: [40], mortgage: { payment: "1,800", owed: "200,000", rate: "6.5" } });
  answerEscrow(p, DID, "no", null, T0);
  assert.equal(debtOf(p).escrowMonthly, 0); assert.equal(escrowSaid(p, debtOf(p)), "no");
  answerEscrow(p, DID, "yes", 300, T0);
  assert.equal(debtOf(p).escrowMonthly, 300); assert.equal(escrowSaid(p, debtOf(p)), "yes");
  assert.equal(loanEscrow(p, p.accounts.find((a) => a.id === AID), debtOf(p), T0), 300);
  answerEscrow(p, DID, "unsure", null, T0);
  assert.equal(isGuess(p, `debts[${DID}].escrowMonthly`), true); assert.equal(escrowSaid(p, debtOf(p)), "unsure");
});

test("Get started's grey balance reads the answer: No means the whole typed payment pays the loan", () => {
  const p = household({ ages: [40] });
  const owedFor = (x) => estimate(p, "debt.mortgage.owed", { ...OPTS, path: `accounts[${AID}].balance`, args: S.oweArgs(p, x, "mortgage", { today: T0 }) }).value;
  // $1,000 a month: worked back, it stays under the home's value (the cap) either way
  const base = { payment: "1,000", owed: "", rate: "" };
  assert.ok(owedFor({ ...base, escrow: "no" }) > owedFor({ ...base, escrow: "unsure" }), "no tax and insurance in it: more of it pays the loan, so more is owed");
  near(owedFor({ ...base, escrow: "yes", escrowAmount: "0" }), owedFor({ ...base, escrow: "unsure" }), 0.5, "yes with 0 typed is read as blank");
});

// ---- (4) older owners: the guessed payment is not above the purchase loan's own payment
test("older owners' guessed payment: the loan part is about the purchase loan's own payment (was up to 1.43 times it)", () => {
  for (const o of [{ ages: [61] }, { ages: [66] }, { ages: [72], state: "FL", retired: true }, { ages: [80], retired: true }]) {
    const p = household(o);
    const acct = p.accounts.find((a) => a.type === "mortgage"), d = p.debts.find((x) => x.accountId === acct.id), home = p.accounts.find((a) => a.type === "property");
    const prof = profileOf(p, T0), s = startOf(p, recordOf(p, "mortgage", `accounts[${acct.id}].balance`), { today: T0, prof });
    const lf = loanFrom({ startDate: s.date, today: T0, valueNow: Number(home.balance), state: prof.state, age: prof.age, rate: d.rate });
    const pi = d.minPayment - loanEscrow(p, acct, d, T0);
    assert.ok(pi / lf.pi <= 1.03, `${o.ages[0]}: ${pi} vs ${lf.pi}`);
    assert.ok(pi / lf.pi >= 0.85, `${o.ages[0]}: not far below either: ${pi} vs ${lf.pi}`);
  }
});

// ---- (5) the year taps respect age
test("year taps: never a span that starts before the person was about 20", () => {
  assert.equal(tapSpan("2010s", { today: T0, age: 25 }), null, "25 now: 20 in 2021, so the 2010s are out");
  assert.deepEqual(tapSpan("2010s", { today: T0, age: 30 }), { from: 2016, to: 2019, date: "2018-01-01" });
  assert.deepEqual(tapSpan("2010s", { today: T0, age: 50 }), { from: 2010, to: 2019, date: "2015-01-01" }, "old enough for the whole span: as before");
  assert.equal(tapSpan("2020-21", { today: T0, age: 25 }).date, "2021-07-01");
  assert.deepEqual(mortgageAsk({ today: T0, age: 25 }).options.map((o) => o.value), ["2020-21", "2022on", "unsure"]);
  assert.ok(mortgageAsk({ today: T0, age: 60 }).options.some((o) => o.value === "pre2010"));
  // a saved tap from before the age rule (25 and "2010s") is set aside: the same figures as no tap
  const a = household({ ages: [25], mortgage: { payment: "1,400" } }), b = household({ ages: [25], mortgage: { payment: "1,400" }, tap: "2010s" });
  assert.equal(debtOf(b).rate, debtOf(a).rate);
  assert.equal(Math.abs(b.accounts.find((x) => x.id === AID).balance), Math.abs(a.accounts.find((x) => x.id === AID).balance));
  // the car loan's question by age: a 22-year-old is not offered "5 or more years ago"
  const young = household({ ages: [22] });
  const car = startAsk("car-loan", young, T0).options.map((o) => o.value);
  assert.ok(!car.includes("5+") && car.includes("0") && car.includes("unsure"), car.join());
  assert.ok(startAsk("car-loan", household({ ages: [40] }), T0).options.some((o) => o.value === "5+"));
});

// ---- (6) the Home page counts the tax and insurance inside the payment once
test("Home page: the tax and insurance inside a guessed payment are its tax and insurance lines (counted once, said where)", () => {
  const p = household({ ages: [40] });
  const r = homePage(p, { today: T0 });
  const row = mortgageRow(p);
  assert.ok(row.escrow > 0);
  const tax = r.costs.lines.find((l) => l.key === "tax"), ins = r.costs.lines.find((l) => l.key === "insurance");
  assert.equal(r.costs.inPayment, true);
  near((tax?.amount ?? 0) + (ins?.amount ?? 0), row.escrow * 12, 1, "the two lines are the part of the payment, a year");
  assert.match(tax.label, /in your mortgage payment/);
  // a typed figure on the Home page is the one shown
  const q = structuredClone(p); const e = (q.property ?? []).find((x) => x.kind === "home") ?? null;
  if (e) { e.propertyTax = 2400; const r2 = homePage(q, { today: T0 }); assert.equal(r2.costs.lines.find((l) => l.key === "tax").amount, 2400); }
  // a payment that holds none: as before (nothing from the payment)
  const n = household({ ages: [40], mortgage: { payment: "1,800", owed: "200,000", rate: "6.5", escrow: "no" } });
  assert.equal(homePage(n, { today: T0 }).costs.inPayment, false);
});

// ---- (7) the low items
test("mortgage insurance is shown only above 80% of the home's value (Homeowners Protection Act)", () => {
  const p = household({ ages: [30], home: "300,000", mortgage: { payment: "2,000", owed: "270,000", rate: "6.5" } });
  assert.equal(mortgagePage(p, { today: T0 }).pmi?.applies, true, "90% owed");
  const q = household({ ages: [30], home: "300,000", mortgage: { payment: "2,000", owed: "200,000", rate: "6.5" } });
  assert.equal(mortgagePage(q, { today: T0 }).pmi?.applies ?? false, false, "67% owed: none");
});

test("Home page: 'the year bought works out the years left' is said only when it is used", () => {
  const guessed = household({ ages: [40], bought: "2015" });
  assert.equal(homePage(guessed, { today: T0 }).yearUsed, true, "balance and payment ours: counted from 2015");
  const typed = household({ ages: [40], bought: "2015", mortgage: { payment: "1,800", owed: "200,000", rate: "6.5" } });
  assert.equal(homePage(typed, { today: T0 }).yearUsed, false, "both typed: the year is not what the years left come from");
});

test("a typed purchase year does not move a guessed rate when the balance and the payment are both typed", () => {
  const both = { payment: "1,300", owed: "150,000" };
  const a = household({ ages: [50, 49], mortgage: both }), b = household({ ages: [50, 49], mortgage: both, bought: "2021" });
  assert.equal(debtOf(b).rate, debtOf(a).rate, "the rate comes from the two figures, not the year");
  // with only the payment typed the year still sharpens the rate (as before)
  const c = household({ ages: [50, 49], mortgage: { payment: "1,300" } }), e = household({ ages: [50, 49], mortgage: { payment: "1,300" }, bought: "2021" });
  assert.notEqual(debtOf(e).rate, debtOf(c).rate);
});

test("Debts' own loan start and term are read when the balance is ours", () => {
  const p = household({ ages: [45] });
  const d = debtOf(p); d.startDate = "2012-03-01"; d.termMonths = 180;
  settle(p, OPTS);
  const s = startOf(p, recordOf(p, "mortgage", `accounts[${AID}].balance`), { today: T0 });
  assert.equal(s.via, "loan"); assert.equal(s.date, "2012-03-01"); assert.equal(s.term, 180);
  const owed = Math.abs(p.accounts.find((a) => a.id === AID).balance);
  // a 15-year loan from March 2012 has about 4 years left: what is owed is small beside a 30-year loan's
  const q = household({ ages: [45] });
  assert.ok(owed < Math.abs(q.accounts.find((a) => a.id === AID).balance) * 0.6, `${owed}`);
});

// ---- C2 follow-ups still open at c804ed0 (scratchpad est/c2/c2-verify.md F2-F6)
test("F2: a guessed debt deleted on Net worth takes its guesses with it (settle drops a row's entries once its account is gone)", () => {
  const p = household({ ages: [40] });
  assert.ok(Object.keys(p.guesses).some((k) => k.startsWith(`debts[${DID}].`)));
  p.accounts = p.accounts.filter((a) => a.id !== AID);         // Net worth's Delete: the account goes, the row stays
  settle(p, OPTS);
  assert.deepEqual(Object.keys(p.guesses ?? {}).filter((k) => k.startsWith(`debts[${DID}].`)), []);
  assert.doesNotMatch(JSON.stringify(guessesPage(p, { today: T0 })), /Mortgage interest rate/);
  // a row with no account named at all is not touched
  const q = household({ ages: [40] }); const d = debtOf(q); const keys = Object.keys(q.guesses).filter((k) => k.startsWith(`debts[${DID}].`));
  delete d.accountId; settle(q, OPTS);
  assert.deepEqual(Object.keys(q.guesses).filter((k) => k.startsWith(`debts[${DID}].`)), keys);
});

test("F3: details cleared on Debts and added again, then Get started's question 5 walked again: one row, as typed", () => {
  const p = household({ ages: [40] });
  p.debts = p.debts.filter((d) => d.accountId !== AID);
  p.debts.push({ id: "debt-readded", accountId: AID, rate: 0.0399, minPayment: 950, extra: 0 });
  settle(p, OPTS);
  const v = S.valuesFor(p, "owe-amounts");
  assert.equal(v.mortgage.payment, 950); assert.equal(v.mortgage.rate, 3.99);
  const b = structuredClone(p);
  S.applyOweAmounts(p, v, T0, { guess: (k, o = {}) => estimate(b, k, { ...OPTS, ...o }) });
  settle(p, OPTS);
  const rows = p.debts.filter((d) => d.accountId === AID);
  assert.equal(rows.length, 1, rows.map((d) => d.id).join());
  assert.equal(rows[0].minPayment, 950); assert.equal(rows[0].rate, 0.0399);
  assert.equal(S.setupRow(p, "mortgage"), rows[0]);
});

test("F4: a rental is not asked about as the home we guessed; a personal loan is not the car loan we guessed", () => {
  const p = household({ ages: [40], owe: ["mortgage", "car-loan"] });
  assert.ok(p.accounts.some((a) => a.id === "setup-owe-car-loan") && isGuess(p, "accounts[setup-owe-car-loan].balance"));
  p.accounts.push({ id: "rent-1", type: "property", name: "Rental condo", balance: 250000 }, { id: "pl-1", type: "loan", name: "Personal loan", balance: -8000 });
  p.property = [...(p.property ?? []), { id: "r1", kind: "rental", accountId: "rent-1" }];
  assert.deepEqual(guessTwins(p).map((t) => `${t.id}=${t.twinId}`), []);
  p.accounts.push({ id: "car-2", type: "loan", name: "Auto loan", balance: -9000 });
  assert.deepEqual(guessTwins(p).map((t) => `${t.id}=${t.twinId}`), ["setup-owe-car-loan=car-2"]);
});
