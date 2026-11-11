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
import { pmt, pv, nper } from "../core/math/finance.js";
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
    // fix round 1 (2026-11-11, money review D10): still being paid the year after work stops (born June, so 2026 - age + 65), by
    // Debts' own payoff date; one that ends in the year work stops is paid on top of the figure by Will the money last? It was
    // "more months than the whole years of age until 65", all or nothing
    const row = mortgageRow(p), stopYear = 2026 - age + 65;
    const running = S.loansRunningThen(p, T0).some((d) => d.accountId === row.id);
    assert.equal(running, !Number.isFinite(row.months) || Number(String(row.payoffDate).slice(0, 4)) > stopYear, `${age} ${couple} ${state} ${JSON.stringify(mortgage)}: Debts ${row.payoffDate}, work stops in ${stopYear}`);
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

// =====================================================================================================================
// Fix round 1 (2026-11-11, claude-c): the reviewers' findings on the lane, each test written first and seen to fail on
// the lane's build (the money review's D1 to D11, the layperson's L-1 to L-8, the breaker's B-1 to B-13).
// =====================================================================================================================
import * as HOME from "../modules/overview/guesses/estimators/home.js";
import * as PROJ from "../modules/retirement/projection/compute.js";
const acctOf = (p) => p.accounts.find((a) => a.id === AID);
const snap = (p) => { const r = mortgageRow(p); return { owed: r.owed, pay: r.minPayment, months: r.months, date: r.payoffDate, escrow: Math.round(r.escrow * 100) / 100, rate: r.rate }; };

// ---- D2 / B-3 / L-1: "Keep" on one guessed figure never moves the other
test("fix D2: Keep on the guessed balance, the payment, or both (either order) moves no figure and no payoff, at any age", () => {
  const who = [{ ages: [72], state: "FL", retired: true }, { ages: [60, 58], state: "FL" }, { ages: [61, 59], state: "AZ", home: "450,000" }, { ages: [60], state: "FL", pay: 150000 }, { ages: [85], state: "CA", retired: true },
    { ages: [45] }, { ages: [50, 49], pay: 80000 }, { ages: [25, 25] }, { ages: [65, 65], state: "FL" }];
  for (const o of who) {
    const base = snap(household(o)), name = JSON.stringify(o);
    for (const order of [["balance"], ["payment"], ["balance", "payment"], ["payment", "balance"]]) {
      const p = household(o);
      for (const k of order) keep(p, k === "balance" ? `accounts[${AID}].balance` : `debts[${DID}].minPayment`);
      assert.deepEqual(snap(p), base, `${name}: keep ${order.join(" then ")}`);
    }
  }
});
test("fix D2: a payment typed near our guess gives a balance near our guess (no cliff either side), and more paid never owes less", () => {
  const p = household({ ages: [72], state: "FL", retired: true });
  const r = mortgageRow(p);
  const owedFor = (pay) => estimate(p, "debt.mortgage.owed", { ...OPTS, path: `accounts[${AID}].balance`, args: S.oweArgs(p, { payment: String(pay), owed: "", rate: "" }, "mortgage", { today: T0 }) }).value;
  assert.equal(owedFor(r.minPayment), r.owed, "the payment we showed, typed back: the balance we showed");
  let last = 0;
  for (let d = -300; d <= 300; d += 10) { const v = owedFor(r.minPayment + d); assert.ok(v >= last, `more paid never owes less (${d})`); last = v; }
  assert.ok(Math.abs(owedFor(r.minPayment + 10) - r.owed) <= 0.1 * r.owed, `$10 more is not another loan: ${owedFor(r.minPayment + 10)} vs ${r.owed}`);
  assert.ok(Math.abs(owedFor(r.minPayment - 10) - r.owed) <= 0.1 * r.owed, `$10 less is not another loan: ${owedFor(r.minPayment - 10)} vs ${r.owed}`);
});

// ---- B-1: a payment typed beside a balance of ours keeps its tax and insurance when the balance is kept
test("fix B-1: Keep on the guessed balance beside a typed payment keeps the tax and insurance (payoff and retirement figure unchanged)", () => {
  for (const o of [{ ages: [25, 25], mortgage: { payment: "1,600" } }, { ages: [40, 40], mortgage: { payment: "1,800" } }]) {
    const p = household(o), before = snap(p), fig = S.retireDefault(p, T0);
    assert.ok(before.escrow > 0, "the typed payment is read with the usual tax and insurance while the balance is ours");
    keep(p, `accounts[${AID}].balance`);
    assert.deepEqual(snap(p), before, JSON.stringify(o));
    assert.equal(S.retireDefault(p, T0), fig, "the retirement figure does not move");
    assert.equal(isGuess(p, `debts[${DID}].escrowMonthly`), true, "kept as our guess (Our guesses lists it)");
  }
});

// ---- D3 / B-5: a loan start typed on Debts
const withStart = (o, startDate, termMonths, mortgage = {}) => {
  const p = household({ ...o, mortgage });
  const d = debtOf(p); d.startDate = startDate; if (termMonths) d.termMonths = termMonths;
  settle(p, OPTS);
  return p;
};
test("fix D3: a loan start and length typed on Debts set the months left (no cap), and a start long ago never makes a huge payment", () => {
  // 2015-06, 360 months: 223 months left on 2026-11-07, and Debts says so (was 274: the item-4 cap overrode the loan's own term)
  const a = withStart({ ages: [45] }, "2015-06-01", 360), ra = mortgageRow(a);
  assert.ok(Math.abs(ra.months - 223) <= 4, `Debts' months follow the loan's own term (the payment is shown to $10): ${ra.months}`);
  near(ra.minPayment - ra.escrow, pmtOf(ra.rate, 223, ra.owed), 6, "the level payment over the months left");
  assert.equal(mortgagePage(a, { today: T0 }).start.monthsLeft, 223);
  // 180 months from 2015-06: 43 left
  const b = withStart({ ages: [45] }, "2015-06-01", 180), rb = mortgageRow(b);
  assert.ok(Math.abs(rb.months - 43) <= 2, `a 15-year loan: ${rb.months}`);
  // 1999-01, 360 months, nothing else typed: 26 months left on the card and on Debts (was 26 and 78), and a believable payment
  const c = withStart({ ages: [60] }, "1999-01-01", 360), rc = mortgageRow(c);
  assert.ok(Math.abs(rc.months - 26) <= 2, `one answer: ${rc.months}`);
  assert.ok(rc.minPayment < 2000, `not a payment several times the usual: ${rc.minPayment}`);
  // a $150,000 balance typed beside a start in 2000 (38 months of that loan left): the loan was refinanced; the payment is the
  // usual one for the balance, not $4,840
  const plain = household({ ages: [45], mortgage: { owed: "150,000" } });
  for (const start of ["2000-01-01", "1996-12-01", "1990-01-01"]) {
    const d = withStart({ ages: [45] }, start, 360, { owed: "150,000" });
    assert.ok(mortgageRow(d).minPayment <= mortgageRow(plain).minPayment * 1.25, `${start}: ${mortgageRow(d).minPayment} vs ${mortgageRow(plain).minPayment} with no start typed`);
    assert.equal(startOf(d, recordOf(d, "mortgage", `accounts[${AID}].balance`), { today: T0 }).via, "guess", "counted from our year, and said so");
  }
  // a start before the adult was about 20 (age 30, 1980) is not read at all
  const e = withStart({ ages: [30] }, "1980-01-01", 360), plain30 = household({ ages: [30] });
  assert.deepEqual(snap(e), snap(plain30), "before the person was about 20: set aside");
});
const pmtOf = (rate, n, owed) => { const r = rate / 12; return r > 0 ? owed * r / (1 - Math.pow(1 + r, -n)) : owed / n; };

// ---- D5 / B-2: a guessed tax and insurance never stretches a loan past its term, has no cliff, and a kept one does not move
test("fix D5: 'Not sure' or 'Yes' with no figure never makes a typed loan run past 30 years; more owed is never paid off sooner", () => {
  const cases = [{ ages: [40], state: "TX", m: { owed: "230,000", payment: "1,800", rate: "4.6" } }, { ages: [40], state: "TX", m: { owed: "230,000", payment: "1,700", rate: "4.6" } },
    { ages: [35], state: "NY", m: { owed: "300,000", payment: "2,070", rate: "4.6" } }, { ages: [25], state: "TX", m: { owed: "230,000", payment: "1,850", rate: "6.7" } },
    { ages: [50], state: "MS", m: { owed: "200,000", payment: "1,300", rate: "5" } }, { ages: [60], state: "TX", m: { owed: "200,000", payment: "1,500", rate: "5" } }];
  for (const c of cases) for (const said of ["unsure", "yes"]) {
    const p = household({ ages: c.ages, state: c.state, mortgage: { ...c.m, escrow: said } }), r = mortgageRow(p);
    assert.ok(r.months <= 360, `${JSON.stringify(c.m)} ${said}: ${r.months} months`);
    assert.equal(S.valuesFor(p, "owe-amounts").mortgage.escrow, said, "the answer is kept");
  }
  // the cliff (single 40, OH, $1,200 at 5%, Not sure): $190,000 was 807 months and $200,000 was 286
  let last = 0;
  for (let owed = 100000; owed <= 240000; owed += 5000) {
    const p = household({ ages: [40], pay: 70000, mortgage: { owed: String(owed), payment: "1,200", rate: "5", escrow: "unsure" } });
    const m = mortgageRow(p).months;
    assert.ok(m >= last, `more owed is never paid off sooner: $${owed} ${m} after ${last}`);
    assert.equal(S.valuesFor(p, "owe-amounts").mortgage.escrow, "unsure", `the answer is kept at $${owed}`);
    last = m;
  }
});
test("fix D5: a tax and insurance kept with its payment does not move when the home's value is typed later", () => {
  for (const o of [{ ages: [25, 25] }, { ages: [72], state: "FL", retired: true }, { ages: [50, 49], pay: 80000 }]) {
    const p = household(o);
    keep(p, `accounts[${AID}].balance`); keep(p, `debts[${DID}].minPayment`);
    const before = snap(p);
    const home = p.accounts.find((a) => a.type === "property");
    confirmGuess(p, `accounts[${home.id}].balance`, T0); home.balance = Math.round(Number(home.balance) * 1.5);
    settle(p, OPTS);
    assert.deepEqual(snap(p), before, JSON.stringify(o));
  }
});
test("fix D5: a rate typed on a kept loan cannot turn the kept tax and insurance into 0 (a cliff), nor stretch the loan past 30 years", () => {
  const p = household({ ages: [45] });
  keep(p, `accounts[${AID}].balance`); keep(p, `debts[${DID}].minPayment`);
  const d = debtOf(p); confirmGuess(p, `debts[${DID}].rate`, T0); d.rate = 0.07; settle(p, OPTS);
  const r = mortgageRow(p);
  assert.ok(r.escrow > 0, `some of the payment is still tax and insurance: ${r.escrow}`);
  assert.ok(r.months <= 360 && r.months >= 300, `the loan runs its 30 years, no longer: ${r.months}`);
});

// ---- D6 / B-7: the answer on one mortgage is that mortgage's alone
function withCabin(p) {
  p.accounts.push({ id: "a-cabin", name: "Cabin mortgage", type: "mortgage", balance: -100000 });
  p.debts.push({ id: "d-cabin", accountId: "a-cabin", rate: 0.05, minPayment: 900 });
  settle(p, OPTS);
  return p;
}
test("fix D6: the answer on a second mortgage changes only that mortgage, and 'Yes' or 'Not sure' is never dropped", () => {
  for (const said of ["no", "yes", "unsure"]) {
    const p = withCabin(household({ ages: [45] })), before = snap(p);
    const out = answerEscrow(p, "d-cabin", said, null, T0); settle(p, OPTS);
    assert.deepEqual(snap(p), before, `the home's mortgage is untouched by '${said}' on the cabin`);
    assert.equal(p.guide?.setup?.taps?.escrow, undefined, "Get started's tap is the home mortgage's, not written for another loan");
    assert.equal(escrowSaid(p, p.debts.find((d) => d.id === "d-cabin")), said, `the cabin's answer is kept: ${said}`);
    if (said !== "no") assert.equal(out, "ask", "no home on file for the cabin: the page asks for the figure");
  }
});

// ---- D7 / B-10: a typed tax and insurance is taken as typed, up to the payment
test("fix D7: tax and insurance typed above half the payment are used as typed; above the payment they are cut to the payment", () => {
  const p = household({ ages: [62], state: "FL", mortgage: { owed: "30,000", payment: "1,600", rate: "6", escrow: "yes", escrowAmount: "900" } });
  const r = mortgageRow(p);
  assert.equal(r.escrow, 900, "the $900 typed, not $800");
  assert.equal(r.months, 49, "-ln(1 - 150/700) / ln(1.005) = 48.4 -> 49 months");
  const home = homePage(p, { today: T0 });
  near(home.costs.lines.filter((l) => l.inPayment).reduce((t, l) => t + l.amount, 0), 10800, 1, "Home lists $10,800 a year, once");
  near(mortgagePage(p, { today: T0 }).mortgage.escrow, 900, 0.01, "the mortgage page takes the same $900 out");
  const q = household({ ages: [30], mortgage: { owed: "200,000", payment: "1,500", rate: "6", escrow: "yes", escrowAmount: "5,000" } });
  assert.equal(debtOf(q).escrowMonthly, 1500, "a figure above the payment is stored as the payment, never above it");
});

// ---- the retirement figure (fix round 1): D1, D4, D8, D10, B-6, B-13
/** A Get started household with the spending question answered blank too (our guesses), so its retirement figure is our guess in the ledger. */
function withSpending(o) {
  const p = household(o), before = structuredClone(p);
  S.applySpend(p, S.valuesFor(p, "spend", { today: T0 }), T0, { guess: (k, x = {}) => estimate(before, k, { ...OPTS, ...x }) });
  settle(p, OPTS);
  return p;
}
const spendRows = (p) => { const b = buildInputs(p, { today: T0 }); return { b, rows: project(b.inputs).rows.filter((r) => r.retired) }; };

test("fix D1: a retirement figure the person types still ends the loans it holds: $100 a month less is never more spending in any year", () => {
  for (const o of [{ ages: [45] }, { ages: [40, 40], mortgage: { payment: "1,800" } }, { ages: [50, 49], pay: 80000 }]) {
    const p = withSpending(o), name = JSON.stringify(o);
    const a = spendRows(p);
    assert.equal(a.b.inputs.loans?.length, 1, `${name}: our own figure holds the mortgage until its payoff`);
    const less = a.b.figureMonthly - 100;
    // typed on Will the money last? (saveSpendingFigure), typed over our guess anywhere (settle sees it), and Get started's own box
    const ways = {
      "Will the money last?": (q) => { PROJ.saveSpendingFigure(q, less, a.b.figureMonthly, T0); },
      "typed over our guess": (q) => { q.retirement.spendingMonthly = less; },
      "Get started's box": (q) => { const before = structuredClone(q); S.applySpend(q, { ...S.valuesFor(q, "spend", { today: T0 }), retireMonthly: String(less), retireAuto: false }, T0, { guess: (k, x = {}) => estimate(before, k, { ...OPTS, ...x }) }); },
      "Keep, then lowered": (q) => { confirmGuess(q, "retirement.spendingMonthly", T0); settle(q, OPTS); q.retirement.spendingMonthly = less; },
    };
    for (const [way, f] of Object.entries(ways)) {
      const q = structuredClone(p); f(q); settle(q, OPTS);
      assert.equal(q.retirement.spendingMonthly, less, `${name}, ${way}: the figure is the person's`);
      assert.equal(isGuess(q, "retirement.spendingMonthly"), false);
      const z = spendRows(q);
      assert.equal(z.b.inputs.loans?.length, 1, `${name}, ${way}: the typed figure still holds the mortgage until its payoff`);
      assert.equal(z.b.inputs.loans[0].ends, a.b.inputs.loans[0].ends);
      for (let i = 0; i < a.rows.length; i++) assert.ok(z.rows[i].spending <= a.rows[i].spending + 1e-6, `${name}, ${way}, ${a.rows[i].year}: ${z.rows[i].spending} vs ${a.rows[i].spending}`);
    }
    // a figure typed below the loans' payments cannot hold them: taken as typed, for life
    const low = structuredClone(p); PROJ.saveSpendingFigure(low, 300, a.b.figureMonthly, T0); settle(low, OPTS);
    assert.equal(buildInputs(low, { today: T0 }).inputs.loans, undefined);
  }
  // a figure typed on a plan whose figure was never Get started's own holds no loans (typed plans do not move)
  const own = household({ ages: [45] });
  own.expenses = [{ id: "food", name: "Groceries", category: "groceries", amount: 900, period: "monthly" }];
  own.retirement = { ...(own.retirement ?? {}), spendingMonthly: 4000 };
  assert.equal(buildInputs(own, { today: T0 }).inputs.loans, undefined);
});

test("fix D8: a typed mortgage that never answered the question keeps the usual tax and insurance in retirement spending after payoff (Debts unchanged)", () => {
  // the money review's household D: a couple aged 58 and 56 in Texas, $180,000 owed, $1,900 a month, home $420,000, all typed
  const typed = { owed: "180,000", payment: "1,900", rate: "4.5" };
  const p = withSpending({ ages: [58, 56], state: "TX", home: "420,000", mortgage: typed });
  const row = mortgageRow(p);
  assert.equal(row.escrow, 0, "Debts reads the typed payment as the loan's alone, as before");
  assert.equal(row.months, Math.ceil(Math.log(1900 / (1900 - 180000 * 0.045 / 12)) / Math.log(1 + 0.045 / 12) - 1e-9), "and its payoff is nper on the whole payment, as before");
  // the usual figure by hand (README "The home"): Texas property tax and home insurance on a $420,000 home come to about $796 a month
  const { b, rows } = spendRows(p);
  const L = b.inputs.loans.find((x) => x.accountId === AID);
  assert.ok(L, "the mortgage is still running when work stops");
  const before = rows.find((r) => r.year === L.untilYear - 1), after = rows.find((r) => r.year === L.untilYear + 1);
  assert.ok(after.spendingReal >= b.spendingYearly - 1900 * 12 + 600 * 12, `after payoff the spending still holds a property tax and insurance bill: ${Math.round(after.spendingReal)} of ${b.spendingYearly}`);
  const usual = HOME.escrowAfterLoan(p, acctOf(p), debtOf(p), T0);
  assert.equal(usual.assumed, true);
  assert.ok(usual.monthly > 600 && usual.monthly <= 950, `the usual Texas figure on a $420,000 home, at most half the payment: ${usual.monthly}`);
  near(L.monthly, 1900 - usual.monthly, 0.01, "what leaves the spending at payoff is the payment less the usual tax and insurance");
  assert.equal(L.assumed, true);
  assert.ok(before.spendingReal - after.spendingReal < 1900 * 12 / after.priceLevel + 1, "the whole payment no longer leaves");
  near(after.spendingReal, (b.spendingYearly - L.inBase), 1, "after payoff: the figure less the loan part, the tax and insurance still in it");
  // answered "No, I pay them myself": none is kept; a property tax bill on Expenses: none is added either
  const no = withSpending({ ages: [58, 56], state: "TX", home: "420,000", mortgage: { ...typed, escrow: "no" } });
  assert.equal(HOME.escrowAfterLoan(no, acctOf(no), debtOf(no), T0).monthly, 0);
  const billed = structuredClone(p); billed.expenses.push({ id: "ptax", name: "Property tax", category: "housing", amount: 7000, period: "annual" });
  assert.equal(HOME.escrowAfterLoan(billed, acctOf(billed), debtOf(billed), T0, { billed: HOME.taxOrInsuranceBilled(billed) }).monthly, 0);
  // a mortgage paid off before work stops: the same usual figure stays in Get started's figure (and Will the money last? agrees)
  const young = withSpending({ ages: [45], mortgage: { owed: "60,000", payment: "1,500", rate: "5" } });
  const u = HOME.escrowAfterLoan(young, acctOf(young), debtOf(young), T0);
  assert.ok(u.assumed && u.monthly > 0);
  near(S.escrowAfterPayoff(young, T0), u.monthly, 1e-9);
  assert.equal(setupFigure(young, T0), S.retireDefault(young, T0));
});

test("fix B-6: from age 50 the retirement figure reads the tax and insurance the person gave, as under 50", () => {
  const m = { owed: "60,000", payment: "1,500", rate: "5" };   // paid off before work stops at either age
  const fig = (age, extra) => withSpending({ ages: [age], pay: 70000, mortgage: { ...m, ...extra } }).retirement.spendingMonthly;
  for (const age of [45, 55]) {
    const y200 = fig(age, { escrow: "yes", escrowAmount: "200" }), y600 = fig(age, { escrow: "yes", escrowAmount: "600" });
    assert.ok(Math.abs((y600 - y200) - 400) <= 10, `${age}: $600 typed gives a figure $400 above $200 typed (${y200} -> ${y600})`);
  }
});

test("fix D4: a rental's loan the spending carries is a fixed amount until its payoff, then nothing (no rising 'loan back')", async () => {
  const { condoOnNetWorthPlan } = await import("../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan(), T = "2026-11-06";
  const b = buildInputs(p, { today: T });
  const L = (b.inputs.loans ?? []).find((x) => /condo/i.test(x.name));
  assert.ok(L, "the condo's loan is one of the loans the spending holds");
  near(L.yearly, 851 * 12, 1, "$851 a month");
  assert.equal(L.ends, "2050-12", "Debts' payoff: 289 months");
  assert.equal(b.inputs.incomes.filter((x) => x.part === "loan back").length, 0, "nothing comes back as a rising income");
  const rows = project(b.inputs).rows, at = (y) => rows.find((r) => r.year === y);
  // by hand: the figure less the 10,212 at the year's prices, plus a flat 10,212, in 2045 to 2050; from 2051 the first part alone
  // (the figure: Get started's $5,200 a month, $62,400 a year, plus the usual tax and insurance of the home's typed mortgage, D8)
  const rest = b.spendingYearly - 10212;
  for (const y of [2045, 2048, 2050]) near(at(y).spending, rest * at(y).priceLevel + 10212, 1, `${y}`);
  near(at(2051).spending, rest * at(2051).priceLevel, 1, "2051: paid off");
  assert.ok(at(2049).spendingReal - at(2051).spendingReal >= 0.5 * 10212 / at(2051).priceLevel, "sr.verdict.loans-end: today's-dollar spending falls at payoff");
});

test("fix D10: a loan that ends in the year work stops is not dropped: its last months are paid on top of the figure", () => {
  // born March 1971, stops at 65 (2036); a 0% loan at $1,000 a month
  const mk = (months) => {
    const p = withSpending({ ages: [55], mortgage: { owed: String(months * 1000), payment: "1,000", rate: "0", escrow: "no" } });
    p.household.people[0].birthDate = "1971-03-15"; settle(p, OPTS);
    return p;
  };
  // in Get started's figure only when it is still being paid the year after work stops (122 months: January 2037)
  for (const [months, held] of Object.entries({ 109: false, 120: false, 121: false, 122: true })) {
    const p = mk(Number(months));
    assert.equal(S.loansRunningThen(p, T0).length === 1, held, `${months} months: in Get started's figure`);
    assert.equal(setupLoans(p, T0).length === 1, held, `${months} months: in Will the money last?'s copy of it`);
    assert.equal(setupFigure(p, T0), S.retireDefault(p, T0));
  }
  const run = (months) => { const p = mk(months), b = buildInputs(p, { today: T0 }), rows = project(b.inputs).rows; return { b, at: (y) => rows.find((r) => r.year === y) }; };
  // 109 months: paid off in December 2035, before retirement: nothing of it is spent in retirement
  assert.equal(run(109).b.inputs.loans, undefined);
  // 120 months ends in November 2036 (it was dropped: 8 payments after work stops went missing): 11 of 12 payments in 2036, on top
  const a = run(120), La = a.b.inputs.loans[0];
  assert.deepEqual([La.untilYear, La.lastMonths, La.inBase, La.onTop], [2036, 11, 0, true]);
  near(a.at(2036).spending, a.b.spendingYearly * a.at(2036).priceLevel + 11000, 1, "2036: the figure, plus 11 payments");
  near(a.at(2037).spending, a.b.spendingYearly * a.at(2037).priceLevel, 1, "2037: the figure alone");
  // 121 months (December 2036) and 122 (January 2037) differ by the one payment, not by a whole year's
  const c = run(121), d = run(122), Ld = d.b.inputs.loans[0];
  near(c.at(2036).spending, c.b.spendingYearly * c.at(2036).priceLevel + 12000, 1, "121 months: 12 payments in 2036");
  assert.deepEqual([Ld.untilYear, Ld.lastMonths, Ld.inBase], [2037, 1, 12000]);
  near(d.at(2036).spending, (d.b.spendingYearly - 12000) * d.at(2036).priceLevel + 12000, 1, "122 months: 12 payments in 2036");
  near(d.at(2037).spending, (d.b.spendingYearly - 12000) * d.at(2037).priceLevel + 1000, 1, "and one in 2037");
  near(d.b.spendingYearly - c.b.spendingYearly, 12000, 130, "the figure holds the loan only in the second case (to $10 a month)");
});

test("fix B-13: the engine ignores a loan entry that is not an object, and never spends less than nothing", () => {
  const a = project(engineInputs()), b = project(engineInputs({ loans: [null, undefined, 7, "x"] }));
  assert.deepEqual(a.rows.map((x) => x.spending), b.rows.map((x) => x.spending));
  assert.doesNotThrow(() => copyInputs(engineInputs({ loans: [null] })));
});

test("fix B-1: the balance we guessed typed back on Get started beside a typed payment keeps the tax and insurance and the rate", () => {
  const p = household({ ages: [25, 25], mortgage: { payment: "1,600" } }), before = snap(p);
  const b = structuredClone(p);
  S.applyOweAmounts(p, { mortgage: { payment: "1,600", owed: String(before.owed) } }, T0, { guess: (k, o = {}) => estimate(b, k, { ...OPTS, ...o }) }); settle(p, OPTS);
  assert.equal(isGuess(p, `accounts[${AID}].balance`), false, "the balance is the person's now");
  assert.deepEqual(snap(p), before, "nothing on screen moves: the rate is not re-guessed (was 6.7% -> 4.6%, payoff 2039-03)");
});

// ---- D11: the pages that read the spending figure see the loans end too
test("fix D11: Annuities' guaranteed share and the FIRE target count a loan the spending holds only until its payoff", async () => {
  const { compute: fire } = await import("../modules/retirement/fire/compute.js");
  const { spendingRealIn, lifelongSpending } = await import("../core/math/retirement.js");
  const p = withSpending({ ages: [45] });
  p.accounts.push({ id: "k", name: "401(k)", type: "401k", balance: 150000, asOf: T0, ownerId: "setup-self" });
  const b = buildInputs(p, { today: T0 }), I = b.inputs, L = I.loans[0];
  // FIRE: enough to live on for good is on the spending that goes on for good: the figure less the loan part that ends
  const f = fire(p, { today: T0 });
  near(f.spendingYearly, I.spending.yearly - L.inBase, 1, "the yearly spending that goes on for good");
  near(f.fiNumber, (I.spending.yearly - L.inBase) / f.withdrawalRate + mortgageRow(p).owed, 1, "25 times it, plus what is still owed on the loan (enough to pay it off)");
  assert.ok(f.fiNumber < I.spending.yearly / f.withdrawalRate, "less than 25 times the figure with the loan in it for life");
  near(f.loansEnding.yearly, L.yearly, 1); assert.equal(f.loansEnding.untilYear, L.untilYear);
  // the helpers: the year's spending in today's dollars is the engine's own row
  const rows = project(I).rows;
  for (const y of [I.retireYear, L.untilYear, L.untilYear + 1]) near(spendingRealIn(I, y), rows.find((r) => r.year === y).spendingReal, 1, `${y}`);
  near(lifelongSpending(I), I.spending.yearly - L.inBase, 1e-6);
  // Annuities: the share of the first retirement year's spending that guaranteed income covers is on that year's spending
  const { compute: annuities } = await import("../modules/retirement/annuities/compute.js");
  const q = structuredClone(p); q.retirement.annuities = [{ id: "an1", personId: "setup-self", premium: 100000, monthly: 600, startAge: 65 }];
  const a = annuities(q, { today: T0, paths: 20 });
  if (a.quotes?.length) {
    const first = rows.find((r) => r.year === I.retireYear);
    const g = I.incomes.reduce((s, x) => s + (PROJ.incomeIn(I, x, I.retireYear) ? x.yearly * (x.cola === false ? Math.pow(1 + I.rates.inflation, -(I.retireYear - I.startYear)) : 1) : 0), 0);
    const health = (I.events ?? []).filter((e) => e.spending && e.year === I.retireYear && e.amount > 0).reduce((s, e) => s + e.amount, 0);
    near(a.quotes[0].floorBefore, g / (first.spendingReal + health - health * 0 ), 0.02, "the first year's own spending (the loan's fixed payment in today's dollars), not the figure for life");
  }
});

// ---- item 8 F5: Get started's question 5b does not bring back a guessed debt deleted on Net worth
test("fix F5: a guessed mortgage deleted on Net worth is not brought back by saving question 5b again", () => {
  const p = household({ ages: [41] });
  assert.ok(p.accounts.some((a) => a.id === AID));
  // deleted on Net worth: the account and its details go (the page's own delete)
  p.accounts = p.accounts.filter((a) => a.id !== AID); p.debts = p.debts.filter((d) => d.accountId !== AID); settle(p, OPTS);
  assert.deepEqual(S.picks(p, "owe"), [], "the pick goes with the account");
  const b = structuredClone(p);
  S.applyOweAmounts(p, S.valuesFor(p, "owe-amounts"), T0, { guess: (k, o = {}) => estimate(b, k, { ...OPTS, ...o }) }); settle(p, OPTS);
  assert.equal(p.accounts.some((a) => a.id === AID), false, "saving 5b again does not add it back");
  // picked again on question 5 on purpose: it is asked and saved as before
  S.applyOwePicks(p, ["mortgage"]);
  const c = structuredClone(p);
  S.applyOweAmounts(p, { mortgage: {} }, T0, { guess: (k, o = {}) => estimate(c, k, { ...OPTS, ...o }) }); settle(p, OPTS);
  assert.ok(p.accounts.some((a) => a.id === AID), "picked again: it is back");
});

// ---- what the pages say (fix round 1): L-3, L-4 / B-11, L-7, B-13, D7's warning
test("fix L-4: after 'No, I pay them myself' the Home page still lists property tax and home insurance, as our guess of what is paid apart", () => {
  const typed = { payment: "2,600", owed: "265,000", rate: "6.5" };   // (room in the payment for the usual amount: escrowCap does not bind)
  const no = household({ ages: [30, 30], state: "TX", mortgage: { ...typed, escrow: "no" } });
  const lines = homePage(no, { today: T0 }).costs.lines;
  const tax = lines.find((l) => l.key === "tax"), ins = lines.find((l) => l.key === "insurance");
  assert.ok(tax && tax.amount > 1000 && tax.guessed === true && !tax.inPayment, `property tax, our guess, paid apart: ${JSON.stringify(tax)}`);
  assert.ok(ins && ins.amount > 500 && ins.guessed === true && !ins.inPayment, `home insurance, our guess, paid apart: ${JSON.stringify(ins)}`);
  assert.match(tax.label, /our guess/); assert.match(tax.label, /paid by you/);
  // the same couple answering Yes with no figure: about the same two amounts, inside the payment (the cost of owning is one figure)
  const yes = household({ ages: [30, 30], state: "TX", mortgage: { ...typed, escrow: "yes" } });
  const inPay = homePage(yes, { today: T0 }).costs.lines.filter((l) => l.inPayment).reduce((t, l) => t + l.amount, 0);
  near(tax.amount + ins.amount, inPay, 0.02 * inPay, "the same year of tax and insurance whichever way the bills are paid");
  // a figure typed on Home wins, and is not marked as a guess
  no.property = [{ id: "h1", kind: "home", accountId: "setup-have-home", name: "Home", propertyTax: 5000, insurance: 1800 }];
  const own = homePage(no, { today: T0 }).costs.lines;
  assert.deepEqual([own.find((l) => l.key === "tax").amount, own.find((l) => l.key === "tax").guessed ?? false, own.find((l) => l.key === "insurance").amount], [5000, false, 1800]);
});

test("fix L-3 / D7: Debts' row and the mortgage page say how much of the payment is tax and insurance, and warn when what is left does not cover the interest", () => {
  const p = household({ ages: [41], mortgage: { payment: "1,450", owed: "180,000", rate: "4.6", escrow: "yes", escrowAmount: "380" } });
  const r = mortgageRow(p);
  assert.deepEqual([r.escrow, r.escrowOurs], [380, false], "the person's own figure");
  const m = mortgagePage(p, { today: T0 }).mortgage;
  assert.deepEqual([m.payment, m.escrow, m.toLoan, m.escrowOurs], [1450, 380, 1070, false]);
  const g = mortgageRow(household({ ages: [25, 25] }));
  assert.equal(g.escrowOurs, true, "a guessed payment's tax and insurance are our guess");
  // tax and insurance typed so high that the rest does not cover the interest: Debts says which figure to check
  const q = household({ ages: [30], mortgage: { owed: "200,000", payment: "1,500", rate: "6", escrow: "yes", escrowAmount: "1,000" } });
  const w = liabilities(q, { today: T0 }).warnings.join(" ");
  assert.match(w, /property tax and home insurance/); assert.match(w, /does not cover the interest/);
});

test("fix B-13: the mortgage insurance stat is shown only when the share printed is above 80%", () => {
  const mk = (owed) => { const p = household({ ages: [40], home: "300,000", mortgage: { owed: String(owed), payment: "1,800", rate: "6" } }); return mortgagePage(p, { today: T0 }).pmi; };
  assert.equal(mk(240001).applies, false, "80.0003% prints as 80%: no 'you owe 80% now' under a line that says it ends at 80%");
  assert.equal(mk(241000).applies, false, "80.3% prints as 80%");
  assert.equal(mk(243000).applies, true, "81%");
});

test("fix L-7 / M-14: Will the money last? says each loan the spending holds in plain sentences, with the whole payment the other pages show", () => {
  const p = withSpending({ ages: [61, 59], state: "AZ", home: "450,000" });
  const b = buildInputs(p, { today: T0 }), row = mortgageRow(p);
  assert.equal(typeof PROJ.spendingLoanWords, "function", "the sentences are worked out in compute (the view only prints them)");
  const words = PROJ.spendingLoanWords(b.inputs).join(" ");
  const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  assert.ok(words.includes(`${usd(row.minPayment)} a month`), `the payment Debts shows (${usd(row.minPayment)}): ${words}`);
  assert.ok(words.includes(`${usd(row.minPayment - row.escrow)} pays the loan`) && words.includes(`stops in ${String(row.payoffDate).slice(0, 4)}`), words);
  assert.ok(words.includes(`${usd(row.escrow)} of property tax and home insurance carries on`), words);
  assert.ok(words.includes("at the payment you make today"), "Debts' own date, said as such (the payoff plan can end it sooner)");
  assert.ok(!/\([^)]*\(/.test(words), "no brackets inside brackets");
  // a typed mortgage that never said: the usual tax and insurance kept after the payoff are said as our guess, with where to say
  const t = withSpending({ ages: [58, 56], state: "TX", home: "420,000", mortgage: { owed: "180,000", payment: "1,900", rate: "4.5" } });
  const tw = PROJ.spendingLoanWords(buildInputs(t, { today: T0 }).inputs).join(" ");
  assert.ok(/our guess/.test(tw) && /Debts/.test(tw) && /property tax and home insurance/.test(tw), tw);
});

// ---- fix round 2 (2026-11-11, claude-c): the findings still open after the first final check
// The usual years left on a mortgage by the owner's age: SCF 2025 public data (first mortgage on the main home, the year it was
// taken out or last refinanced plus its length, less 2025; weighted medians by ten-year age group at the group's mean age).
const SCF_LEFT = [[30.0, 27], [39.5, 25], [49.6, 24], [59.5, 23], [69.2, 19], [80.3, 17]];
const usualLeft = (age) => {
  if (age <= SCF_LEFT[0][0]) return SCF_LEFT[0][1] * 12;
  for (let i = 1; i < SCF_LEFT.length; i++) if (age <= SCF_LEFT[i][0]) { const [a0, y0] = SCF_LEFT[i - 1], [a1, y1] = SCF_LEFT[i]; return Math.round(12 * (y0 + (y1 - y0) * (age - a0) / (a1 - a0))); }
  return SCF_LEFT.at(-1)[1] * 12;
};
const purchaseLeft = (p) => {
  const prof = profileOf(p, T0), s = startOf(p, recordOf(p, "mortgage", `accounts[${AID}].balance`), { today: T0, prof });
  const lf = loanFrom({ startDate: s.date, today: T0, valueNow: Number(p.accounts.find((a) => a.type === "property").balance), state: prof.state, age: prof.age, rate: debtOf(p).rate });
  return { left: lf.monthsLeft, pi: lf.pi, balance: lf.balance, age: prof.age };
};

test("fix2 F1: a guessed mortgage never runs longer than the longer of the purchase loan's months left and the usual years left at the owner's age", () => {
  // the couple aged 61 and 59 in Arizona: $140,000 at about $1,040 ran 325 months on a 60,000 pay (to 2056, age 91, on the reviewers')
  const az = household({ ages: [61, 59], state: "AZ" }), r = mortgageRow(az), b = purchaseLeft(az);
  assert.ok(r.months <= Math.max(b.left, usualLeft(61)) + 3, `61 and 59 in Arizona: ${r.months} months, the most is ${Math.max(b.left, usualLeft(61))}`);
  assert.ok(61 + r.months / 12 < 84.5, "paid off at about 83, not 91");
  let n = 0;
  for (const state of ["OH", "AZ", "CA", "FL", "TX"]) for (const ages of [[45], [50, 50], [55], [58, 56], [61], [61, 59], [66, 66], [72], [80], [85, 85]]) for (const pay of [40000, 60000, 150000]) {
    const retired = ages[0] >= 70;
    if (retired && pay !== 60000) continue;
    const p = household({ ages, state, pay, retired }), row = mortgageRow(p), x = purchaseLeft(p), d = debtOf(p), owed = Math.abs(p.accounts.find((a) => a.id === AID).balance);
    const where = `${state} ${ages.join("/")} ${pay}`;
    // (the payment is shown to $10: at worst $5 under the payment that ends the loan in exactly those months)
    const most = Math.max(x.left, usualLeft(x.age)), byTen = Math.ceil(nper(d.rate / 12, pmt(d.rate / 12, most, owed) - 5, owed));
    assert.ok(row.months <= byTen, `${where}: ${row.months} months left, the most is ${most} (${byTen} with the payment to $10)`);
    // and item 4 still holds: the loan part is never more than what pays the balance off over the purchase loan's months left
    // (the $10 the payment is rounded to aside), and never under the purchase loan's own when the balance is above that loan's
    const pi = d.minPayment - loanEscrow(p, p.accounts.find((a) => a.id === AID), d, T0);
    assert.ok(pi <= pmt(d.rate / 12, x.left, owed) + 10, `${where}: ${pi} against the level payment ${pmt(d.rate / 12, x.left, owed)}`);
    if (owed > x.balance + 0.5) assert.ok(pi >= Math.min(x.pi, pmt(d.rate / 12, x.left, owed)) - 10, `${where}: ${pi} under the purchase loan's ${x.pi}`);
    n++;
  }
  assert.ok(n >= 100);
});

test("fix2 F1: a payment typed alone is worked back over those bounded months too (no 30 years for an owner of 61), and Keep still moves nothing", () => {
  const p = household({ ages: [61, 59], state: "AZ", mortgage: { payment: "1,600" } }), r = mortgageRow(p), b = purchaseLeft(p);
  assert.ok(r.months <= Math.max(b.left, usualLeft(61)) + 3, `${r.months} months`);
  // Keep on the guessed pair, either order: no figure and no payoff moves (fix D2 holds)
  for (const order of [["accounts[setup-owe-mortgage].balance", "debts[setup-debt-mortgage].minPayment"], ["debts[setup-debt-mortgage].minPayment", "accounts[setup-owe-mortgage].balance"]]) {
    const q = household({ ages: [61, 59], state: "AZ" }), before = mortgageRow(q);
    for (const path of order) { const held = escrowBefore(q, T0); confirmGuess(q, path, T0); escrowKept(q, held, T0); settle(q, OPTS); }
    const after = mortgageRow(q);
    assert.deepEqual([after.owed, after.minPayment, after.months], [before.owed, before.minPayment, before.months], order[0]);
  }
});

test("fix2 F2: 'Not sure' on a typed payment keeps the usual tax and insurance after payoff even when the payment has room for less (more owed never spends less for life)", () => {
  // the breaker's couple aged 40 in Texas, $1,200 a month typed at 5%, "Not sure": at $150,000 the payment holds the usual $395; at
  // $200,000 it has room for only $126 (the rest pays the loan off in 30 years), and that $126 was all that went on after payoff
  const mk = (owed, escrow) => withSpending({ ages: [40, 40], state: "TX", pay: 70000, mortgage: { owed: String(owed), payment: "1,200", rate: "5", ...(escrow ? { escrow } : {}) } });
  const a = mk(150000, "unsure"), b = mk(200000, "unsure");
  const after = (p) => HOME.escrowAfterLoan(p, acctOf(p), debtOf(p), T0, { billed: HOME.taxOrInsuranceBilled(p) });
  const ra = mortgageRow(a), rb = mortgageRow(b);
  assert.ok(rb.escrow < ra.escrow - 100, `inside the payment: ${ra.escrow} at $150,000, ${rb.escrow} at $200,000 (what it has room for)`);
  assert.equal(rb.months, 360, "Debts: paid off in 30 years, as before");
  assert.ok(after(b).monthly >= after(a).monthly - 0.01, `after payoff: ${after(a).monthly} at $150,000 and ${after(b).monthly} at $200,000`);
  // the same figure a plan that never answered keeps (the usual one for the home)
  near(after(b).monthly, after(mk(200000)).monthly, 0.01, "as with no answer");
  assert.equal(after(b).topped, true, "said on Will the money last? as the usual amount, more than the payment has room for");
  // the engine: what leaves the spending at payoff is the payment less that figure; Debts' payoff date is untouched
  const lb = buildInputs(b, { today: T0 }).inputs.loans.find((x) => x.accountId === AID);
  near(lb.monthly, 1200 - after(b).monthly, 0.01, "the loan part that ends");
  assert.equal(lb.ends, String(rb.payoffDate).slice(0, 7));
  const words = PROJ.spendingLoanWords(buildInputs(b, { today: T0 }).inputs).join(" ");
  assert.match(words, /more than (this|the) payment has room for/);
  // step by step, more owed never gives a lower figure for retirement or a smaller lifelong part
  let prev = null;
  for (const owed of [50000, 100000, 150000, 200000, 250000]) {
    const p = mk(owed, "unsure"), fig = S.retireDefault(p, T0);
    if (prev !== null) assert.ok(fig >= prev - 10, `$${owed}: the retirement figure ${fig} is under ${prev}`);
    prev = fig;
  }
  // a property tax bill on Expenses: only what is inside the payment is kept (the bill holds the rest)
  const billed = structuredClone(b); billed.expenses.push({ id: "ptax", name: "Property tax", category: "housing", amount: 7000, period: "annual" });
  near(after(billed).monthly, rb.escrow, 0.01);
});

test("fix2 F7: a typed tax and insurance that leaves barely more than the interest gets a warning on Debts (the loan would run past 40 years)", () => {
  // $230,000 at 6.7%, $1,700 a month, "Yes, $400": $1,300 against $1,284 of interest, 792 months (to 2092) with no word
  const p = household({ ages: [30], mortgage: { owed: "230,000", payment: "1,700", rate: "6.7", escrow: "yes", escrowAmount: "400" } });
  const out = liabilities(p, { today: T0 }), row = out.rows.find((r) => r.type === "mortgage");
  assert.ok(Number.isFinite(row.months) && row.months > 480, `${row.months} months`);
  const w = out.warnings.join(" ");
  assert.match(w, /\$400 of property tax and home insurance/);
  assert.match(w, new RegExp(`${Math.round(row.months / 12)} years`), w);
  assert.match(w, /Check that figure on this page, or raise the payment/);
  // $200,000 at 5%, $1,200, "Yes, $337": 811 months
  const q = household({ ages: [30], mortgage: { owed: "200,000", payment: "1,200", rate: "5", escrow: "yes", escrowAmount: "337" } });
  assert.match(liabilities(q, { today: T0 }).warnings.join(" "), /would take about \d+ years/);
  // not for a figure that leaves a usual loan (30 years or so), and not when the figure is our guess (it is held to 30 years)
  const fine = household({ ages: [30], mortgage: { owed: "200,000", payment: "1,500", rate: "5", escrow: "yes", escrowAmount: "300" } });
  assert.doesNotMatch(liabilities(fine, { today: T0 }).warnings.join(" "), /would take about/);
  const ours = household({ ages: [30], mortgage: { owed: "230,000", payment: "1,700", rate: "6.7", escrow: "unsure" } });
  assert.doesNotMatch(liabilities(ours, { today: T0 }).warnings.join(" "), /would take about/);
  // the mortgage page says the same years as Debts
  assert.equal(mortgagePage(p, { today: T0 }).base.months, row.months);
});

test("fix2 F6: an 'Insurance' bill on Expenses may already hold the home insurance: only the property tax is kept after payoff, and the page says so", () => {
  // the money review's household D again (all typed, never answered): the usual Texas tax and insurance are kept after payoff
  const typed = { owed: "180,000", payment: "1,900", rate: "4.5" };
  const p = withSpending({ ages: [58, 56], state: "TX", home: "420,000", mortgage: typed });
  const after = (q) => HOME.escrowAfterLoan(q, acctOf(q), debtOf(q), T0, { billed: HOME.taxOrInsuranceBilled(q) });
  const usual = HOME.usualParts(p, AID, T0), all = after(p);
  near(all.monthly, Math.min(usual.total, 950), 0.01, "no insurance bill: tax and insurance");
  // a bill the person named "Insurance" in the insurance category (as 634 of the 1,400 qa plans have): it may hold the home's
  const q = structuredClone(p); q.expenses.push({ id: "ins", name: "Insurance", category: "insurance", amount: 1050, period: "monthly" });
  const taxOnly = after(q);
  near(taxOnly.monthly, Math.min(usual.tax, 950), 0.01, "only the property tax is kept");
  assert.equal(taxOnly.assumed, true); assert.equal(taxOnly.taxOnly, true);
  const words = PROJ.spendingLoanWords(buildInputs(q, { today: T0 }).inputs).join(" ");
  assert.match(words, /for property tax after that/);
  assert.match(words, /insurance bill on (your )?Expenses/);
  assert.doesNotMatch(words, /for property tax and home insurance after that/);
  assert.match(words, /hold no property tax bill/); assert.doesNotMatch(words, /hold no such bill/);
  // a bill that names another kind of insurance is not the home's: tax and insurance are kept, as before
  for (const name of ["Car insurance", "Health insurance (marketplace)", "Life insurance", "Auto and renters insurance", "Dental"]) {
    const r = structuredClone(p); r.expenses.push({ id: "ins", name, category: "insurance", amount: 300, period: "monthly" });
    near(after(r).monthly, all.monthly, 0.01, name);
  }
  // Get started's own "Insurance and health" row (our guess of health, car and life cover) is not a home insurance bill
  assert.ok(p.expenses.some((x) => x.category === "insurance" || x.category === "health"), "the household has Get started's insurance row");
  // a bill that says home insurance: nothing is added at all, as before
  const h = structuredClone(p); h.expenses.push({ id: "ins", name: "Homeowners insurance", category: "insurance", amount: 150, period: "monthly" });
  assert.equal(after(h).monthly, 0);
  // Debts never reads any of this: the payoff is the typed one
  assert.equal(mortgageRow(q).months, mortgageRow(p).months);
});

test("fix2 F3: Keep on a guessed balance alone (the payment still ours) moves neither the payment nor the payoff", () => {
  // the money review's couple aged 35 in Texas: Keep on the $280,000 lifted the home's guessed value by its floor for a typed
  // balance, and with it the tax and insurance inside the payment we show: $2,280 -> $2,340, 682 -> 739 a month
  const BAL = "accounts[setup-owe-mortgage].balance", PAY = "debts[setup-debt-mortgage].minPayment";
  const keep = (q, path) => { const held = escrowBefore(q, T0); confirmGuess(q, path, T0); escrowKept(q, held, T0); settle(q, OPTS); };
  let n = 0;
  for (const state of ["TX", "FL", "CA", "OH"]) for (const ages of [[35], [35, 35], [30, 30], [40], [75], [80, 80], [85]]) for (const pay of [50000, 70000]) {
    const retired = ages[0] >= 70;
    if (retired && pay !== 50000) continue;
    const p = household({ ages, state, pay, retired }), before = mortgageRow(p);
    const q = structuredClone(p); keep(q, BAL);
    const after = mortgageRow(q), where = `${state} ${ages.join("/")} ${pay}`;
    assert.deepEqual([after.owed, after.minPayment, after.months], [before.owed, before.minPayment, before.months], `${where}: keep balance`);
    near(after.escrow, before.escrow, 0.01, `${where}: tax and insurance in the payment`);
    // then Keep on the payment too: still nothing moves
    keep(q, PAY);
    const both = mortgageRow(q);
    assert.deepEqual([both.owed, both.minPayment, both.months], [before.owed, before.minPayment, before.months], `${where}: then keep payment`);
    n++;
  }
  assert.equal(n, 44);
});

test("fix2 F3: after Keep on the balance alone, the payment we still guess follows a tax and insurance typed on Home", () => {
  const p = household({ ages: [35, 35], state: "TX", pay: 70000 }), before = mortgageRow(p);
  const held = escrowBefore(p, T0); confirmGuess(p, "accounts[setup-owe-mortgage].balance", T0); escrowKept(p, held, T0); settle(p, OPTS);
  assert.equal(mortgageRow(p).minPayment, before.minPayment);
  p.property = [...(p.property ?? []).filter((x) => x.kind !== "home"), { id: "h1", kind: "home", accountId: "setup-have-home", name: "Home", propertyTax: 9600, insurance: 2400 }];
  settle(p, OPTS);
  const r = mortgageRow(p);
  near(r.escrow, 1000, 0.01, "the tax and insurance typed on Home");
  assert.equal(r.minPayment, Math.round((before.minPayment - before.escrow + 1000) / 10) * 10);
});

test("fix2 F4: the sanity rule HD-AMORT-IDENTITY reads the mortgage page as the page pays: a loan with no required payment is paid by its extra", async () => {
  // qa H-0862: required payment $0, extra $300 a month: the mortgage page pays the $300 (193 months), the rule took the required $0
  // alone and said "never", a rule artifact (final check F-4)
  const GS = await import("../qa/guess-sanity.mjs");
  await GS.loadPages();
  const file = GS.qaHouseholdFiles().find((f) => /H-0862/.test(f)), plan = GS.qaHouseholdPlan(file);
  const t = {};
  GS.checkHousehold(new GS.Household(plan, { id: "qa:H-0862", src: "qa" }, { tier: "A", today: plan.__today ?? GS.TODAY }), t, { only: new Set(["HD-AMORT-IDENTITY"]) });
  const x = GS.finishTally(t)["HD-AMORT-IDENTITY"];
  assert.ok(x && x.checked >= 2, "checked on Debts and the mortgage page");
  assert.equal(x.failed, 0, JSON.stringify(x.examples));
});

test("fix2 F4: a mortgage bill on Expenses that is $100 a week less still ends with the loan (qa H-0329: less spent never runs out sooner)", async () => {
  // H-0329 files the mortgage as "Mortgage payment", $466.15 a week (Debts: about $2,020 a month). $100 a week less on that bill
  // put it more than 10% off the payment, so the retirement plan stopped treating it as the loan's and spent it for life: short
  // at 70 instead of 71 (final check F-4). One mortgage and a bill named for it: the bill is that loan's, at the bill's amount.
  const GS = await import("../qa/guess-sanity.mjs");
  const plan = GS.qaHouseholdPlan(GS.qaHouseholdFiles().find((f) => /H-0329/.test(f)));
  const T = plan.__today ?? GS.TODAY, O = { estimators: GS.REG.estimators, tables: GS.REG.tables, today: T };
  settle(plan, O);
  const q = structuredClone(plan), bill = q.expenses.find((x) => x.name === "Mortgage payment"); bill.amount = Number(bill.amount) - 100; settle(q, O);
  const a = PROJ.compute(plan, { today: T }), b = PROJ.compute(q, { today: T });
  const la = a.inputs.loans.find((l) => l.type === "mortgage"), lb = b.inputs.loans.find((l) => l.type === "mortgage");
  assert.ok(la, "the mortgage ends at its payoff");
  assert.ok(lb, "with $100 a week less on its bill too");
  assert.equal(lb.ends, la.ends);
  near(lb.monthly + lb.escrow, (Number(bill.amount) * 52) / 12, 0.5, "at the bill's amount");
  assert.ok(!(b.shortAge && (!a.shortAge || b.shortAge < a.shortAge)), `less spent ran out sooner: ${a.verdict} ${a.shortAge} -> ${b.verdict} ${b.shortAge}`);
  // two mortgages and one bill for less than both: which one it is cannot be told, so neither is read from it (as before)
});
