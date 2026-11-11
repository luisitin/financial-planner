// tests/home-purchase.test.mjs -- "when you bought your home" (owner's request 2026-11-07): the year an owner of this age most
// likely bought, and the mortgage worked from it when the person typed neither the payment nor the balance.
// Formulas and sources: modules/overview/guesses/README.md "When the home was bought". The persona grid at the end walks every
// age from 20 to 85, single and a couple, through Get started's own apply functions with nothing typed.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../modules/overview/setup/compute.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { estimate, mergeEstimators, settle } from "../core/estimate/index.js";
import { estimators, TABLES } from "../modules/overview/guesses/compute.js";
import { T as PURCHASE } from "../modules/overview/guesses/data/purchase.js";
import { T as HOME } from "../modules/overview/guesses/data/home.js";
import { estimators as setupEstimators } from "../modules/overview/setup/compute.js";
import { boughtGuess, tenureMedian, GROUP_AGES, guessedRate, rateInYear, downShare, hpiIn, priceThen, loanFrom, midYear, yearOf } from "../modules/overview/guesses/estimators/purchase.js";
import { startOf, recordOf } from "../modules/overview/guesses/estimators/debts.js";
import { escrowMonthly, purchaseOf } from "../modules/overview/guesses/estimators/home.js";
import { profileOf } from "../modules/overview/guesses/estimators/common.js";
import { compute as liabilities } from "../modules/balance/liabilities/compute.js";
import { compute as mortgagePage, loanStart } from "../modules/debt/mortgage/compute.js";
import { purchaseDateFrom } from "../modules/property/home/compute.js";
import { compute as payoffPlanPage } from "../modules/debt/payoff/compute.js";
import { compute as timeline } from "../modules/overview/timeline/compute.js";
import { setMortgageStart } from "../modules/debt/mortgage/compute.js";
import { rateMean } from "../modules/overview/guesses/estimators/purchase.js";
import { nper, pmt } from "../core/math/finance.js";

const T0 = "2026-11-07";
const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }]);
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""}: ${a} vs ${b}`);

/** A Get started household, Q5b answered with the given boxes (the screen's own apply functions, our guesses on). */
function household({ ages = [25], state = "OH", pay = 60000, home = null, mortgage = {}, bought, tap } = {}) {
  const p = migrate(emptyPlan());
  const couple = ages.length > 1;
  S.applyYou(p, { name: "Pat", who: couple ? "spouse" : "me", partnerName: couple ? "Lee" : undefined, kids: 0, state });
  const year = (age) => Number(T0.slice(0, 4)) - age;   // born in June: turned `age` before today (November)
  const people = { "setup-self": { status: "work", amount: String(pay), period: "annual" } };
  const born = { "setup-self": { month: 6, year: year(ages[0]), stopAge: 65, ss: { mode: "estimate" } } };
  if (couple) { people["setup-partner"] = { status: "work", amount: String(pay * 0.9), period: "annual" }; born["setup-partner"] = { month: 6, year: year(ages[1]), stopAge: 65, ss: { mode: "estimate" } }; }
  S.applyMoney(p, { people });
  S.applyAges(p, { people: born }, T0);
  S.applyHavePicks(p, ["checking", "home"]);
  S.applyOwePicks(p, ["mortgage"]);
  const via = (fn) => { const before = structuredClone(p); fn(p, (k, o = {}) => estimate(before, k, { ...OPTS, ...o })); settle(p, OPTS); };
  via((d, g) => S.applyHaveAmounts(d, { ...(home ? { home } : {}), ...(bought !== undefined ? { bought } : {}) }, T0, { guess: g }));
  via((d, g) => S.applyOweAmounts(d, { mortgage: { ...mortgage, ...(tap ? { start: tap } : {}) } }, T0, { guess: g }));
  return p;
}
const loanOf = (p) => {
  const row = liabilities(p, { today: T0 }).rows.find((r) => r.type === "mortgage");
  const acct = p.accounts.find((a) => a.id === "setup-owe-mortgage"), debt = p.debts.find((d) => d.id === "setup-debt-mortgage");
  const rec = recordOf(p, "mortgage", "accounts[setup-owe-mortgage].balance");
  const start = startOf(p, rec, { today: T0, prof: profileOf(p, T0) });
  return { row, balance: Number(acct?.balance), payment: Number(debt?.minPayment), rate: Number(debt?.rate), start, monthsLeft: start ? Math.max(12, 360 - gone(start.date)) : null, home: Number(p.accounts.find((a) => a.id === "setup-have-home")?.balance) };
};
// loans lane 1 (2026-11-07, item 4): when our balance is above what the purchase loan would owe now (the usual balance for the age
// blended in), the principal and interest is the purchase loan's own, never below a new 30-year loan's on the balance, and the
// months come from nper on it (they run past the purchase loan's years). Else it pays the balance off in the months left.
const ownPI = (p, x) => {
  const prof = profileOf(p, T0), full = pmt(x.rate / 12, x.monthsLeft, x.balance);
  const lf = loanFrom({ startDate: x.start.date, today: T0, valueNow: x.home, state: prof.state, age: prof.age, rate: x.rate });
  const capped = !!lf && Number.isFinite(lf.pi) && x.balance > lf.balance + 0.5;
  return { pi: capped ? Math.min(full, Math.max(lf.pi, pmt(x.rate / 12, 360, x.balance))) : full, capped };
};
const gone = (date) => (Number(T0.slice(0, 4)) - Number(date.slice(0, 4))) * 12 + (Number(T0.slice(5, 7)) - Number(date.slice(5, 7))) - (T0.slice(8, 10) < date.slice(8, 10) ? 1 : 0);

// ---- the data behind it
test("data: the Census move-in years and owners by age, Freddie Mac's yearly rates, the NAR profile and the FHFA national index", () => {
  const moved = HOME.acs2025_year_moved_in_by_age_us, owners = PURCHASE.acs2025_owner_households_by_age_us;
  // B25007 owner-occupied rows add up to the table's owner total (87,511,734); B25128's owner rows too
  assert.equal(owners.rows.owners.reduce((a, b) => a + b, 0), 87511734);
  assert.equal(["owners:15 to 34", "owners:35 to 64", "owners:65 and over"].map((k) => moved.rows[k].reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0), 87511734);
  assert.equal(moved.rows["owners:15 to 34"][0], 3357513, "owners 15 to 34 who moved in 2023 or later");
  // Freddie Mac: the mean of each year's weekly 30-year rates (published annual figures: 2021 2.96, 2022 5.34, 2023 6.81, 2024 6.72)
  const r = PURCHASE.pmms30_annual_average_by_year;
  assert.deepEqual([2000, 2012, 2021, 2022, 2023, 2024].map((y) => r.rows["30-year fixed"][r.cols.indexOf(String(y))]), [8.05, 3.66, 2.96, 5.34, 6.81, 6.72]);
  assert.equal(rateInYear(2021), 0.0296);
  assert.equal(rateInYear(2090), rateInYear(2026), "a year past the last takes the last");
  // NAR 2025 Profile (news release 2025-11-04): median down payment 10% first-time, 23% repeat; median age 40 and 62
  const n = PURCHASE.nar2025_home_buyer_profile;
  assert.deepEqual([n.rows["median down payment (% of price)"], n.rows["median age (years)"]], [[10, 23], [40, 62]]);
  assert.equal(n.industry, true, "NAR is a trade group: the sources fold says so");
  // the national index (FHFA, 100 in 1975): 2025 1,060.69 over 2020's
  assert.equal(PURCHASE.fhfa_hpi_national_annual.rows.HPI.at(-1), 1060.69);
  for (const id of Object.keys(PURCHASE)) { assert.ok(TABLES[id], `${id} is a bundled table`); assert.match(PURCHASE[id].url, /^https:\/\//); assert.ok(PURCHASE[id].readOn <= T0); }
});

test("tenure: the owners' mean ages, and how long an owner of each age has most likely lived in the home", () => {
  const [a, b, c] = GROUP_AGES();
  near(a, 28.6, 0.1, "15 to 34"); near(b, 50.3, 0.1, "35 to 64"); near(c, 74.6, 0.1, "65 and over");
  near(tenureMedian(null), 12.7, 0.1, "no age: the middle of all owners (spans end mid-2025, when the interviews are: review D9)");
  near(tenureMedian(25), 2.24, 0.05, "25: of those who moved in within the 5 years since 20, the middle");
  near(tenureMedian(85), 23.9, 0.5);
  // nondecreasing with age
  let last = 0;
  for (let age = 20; age <= 90; age++) { const t = tenureMedian(age); assert.ok(t >= last - 1e-9, `${age}: ${t} < ${last}`); last = t; }
});

test("boughtGuess: never before the age of 20, the most likely year for the age", () => {
  assert.deepEqual([25, 30, 41, 61, 85].map((age) => boughtGuess({ age, today: T0 }).year), [2024, 2023, 2020, 2012, 2002]);
  for (let age = 20; age <= 90; age++) {
    const g = boughtGuess({ age, today: T0 });
    assert.ok(g.year >= 2026 - age + 20 - 1, `${age}: bought ${g.year}`);   // born in 2026 - age (or the year before): not before the 20th birthday's year, less one
    assert.ok(g.year <= 2026);
  }
  assert.equal(boughtGuess({ age: null, today: T0 }).year, 2014, "no age: about thirteen years ago");
  assert.equal(boughtGuess({ age: 30 }), null, "no date, no guess");
});

test("loanFrom: the price taken back with the index, the usual down payment, that year's rate, paid for the months since", () => {
  assert.equal(downShare(30), 0.1); assert.equal(downShare(40), 0.1); assert.equal(downShare(62), 0.23); assert.equal(downShare(80), 0.23);
  near(downShare(51), 0.165, 1e-9, "straight between 40 and 62");
  const f = hpiIn("OH", 2020) / hpiIn("OH", 2025);
  near(priceThen(300000, "OH", 2020, T0), 300000 * f, 1e-6);
  assert.equal(priceThen(300000, "OH", 2030, T0), 300000, "a home bought after the index ends was not cheaper");
  const l = loanFrom({ startDate: "2020-07-01", today: T0, valueNow: 300000, state: "OH", age: 41 });
  near(l.price, 300000 * f, 1e-6); near(l.loan, l.price * 0.9, 1e-6); assert.equal(l.rate, rateInYear(2020));
  assert.equal(l.gone, 76); assert.equal(l.monthsLeft, 284);
  // the balance after 76 payments pays off in the 284 left, at the rate: pmt(284 months, balance) = the loan's P&I
  near(pmt(l.rate / 12, l.monthsLeft, l.balance), l.pi, 0.01, "payment and balance agree");
  // typed price wins over the index
  assert.equal(loanFrom({ startDate: "2020-07-01", today: T0, valueNow: 300000, price: 200000, age: 41 }).price, 200000);
  // never above the home's value; a very old loan still shows its last year
  assert.ok(loanFrom({ startDate: "2023-07-01", today: T0, valueNow: 100000, price: 400000, age: 30 }).balance <= 100000);
  assert.equal(loanFrom({ startDate: "1990-07-01", today: T0, valueNow: 300000, age: 60 }).monthsLeft, 12);
  assert.equal(loanFrom({ startDate: "2020-07-01", today: T0 }), null, "no price and no value: nothing to work from");
  assert.deepEqual([yearOf(2019), yearOf("2019-03-04"), yearOf(1850), yearOf("x"), yearOf(null)], [2019, 2019, null, null, null]);
  assert.equal(midYear(2030, T0), T0, "never after today");
});

test("purchaseDateFrom: the exact date when it was typed or changed, the middle of the year when only the year was", () => {
  const f = (v, was) => purchaseDateFrom(v, was, 2026);
  assert.equal(f({ year: 2019, date: "" }, { year: null, date: "" }), "2019-07-01");
  assert.equal(f({ year: 2019, date: "2019-03-15" }, { year: 2019, date: "2019-03-15" }), "2019-03-15", "nothing changed: the exact date stays");
  assert.equal(f({ year: 2020, date: "2019-03-15" }, { year: 2019, date: "2019-03-15" }), "2020-07-01", "the year changed");
  assert.equal(f({ year: 2019, date: "2018-02-01" }, { year: 2019, date: "2019-03-15" }), "2018-02-01", "the date changed: it wins");
  assert.equal(f({ year: null, date: "2019-03-15" }, { year: 2019, date: "2019-03-15" }), "", "the year cleared");
  assert.equal(f({ year: 2090, date: "" }, { year: null, date: "" }), "", "a year ahead counts as blank");
});

// ---- Get started
test("Get started: 'Year you bought it' is saved on the home's entry (July 1), a blank box takes it back, the home going takes it too", () => {
  const p = household({ ages: [30], home: "300000", bought: "2021", mortgage: { bought: "2021" } });
  assert.deepEqual(p.property, [{ id: "setup-home", kind: "home", accountId: "setup-have-home", purchaseDate: "2021-07-01" }]);
  assert.equal(S.boughtYearOn(p), 2021);
  assert.equal(S.valuesFor(p, "have-amounts").bought, 2021);
  assert.equal(S.valuesFor(p, "owe-amounts").mortgage.bought, 2021);
  // an exact date already in that year stays
  const q = structuredClone(p); q.property[0].purchaseDate = "2021-03-15";
  S.applyOweAmounts(q, { mortgage: { bought: "2021" } }, T0);
  assert.equal(q.property[0].purchaseDate, "2021-03-15");
  // blank takes the answer back (and the empty entry goes)
  S.applyOweAmounts(q, { mortgage: { bought: "" } }, T0);
  assert.deepEqual(q.property, []);
  // junk is no answer; a screen without the box changes nothing
  const r = structuredClone(p); S.applyOweAmounts(r, { mortgage: { bought: "20x1" } }, T0);
  assert.deepEqual(r.property, []);
  const t = structuredClone(p); S.applyOweAmounts(t, { mortgage: {} }, T0);
  assert.equal(t.property[0].purchaseDate, "2021-07-01");
  assert.equal(S.parseYear("2019"), 2019); assert.equal(S.parseYear("1949"), null); assert.equal(S.parseYear("2090", 2026), null); assert.equal(S.parseYear(" 2019 "), 2019);
  // the home's value blank and the home dropped: the entry goes with it
  const u = structuredClone(p); S.applyHavePicks(u, ["checking"]); S.applyHaveAmounts(u, { checking: 500, home: "" }, T0);
  assert.equal((u.property ?? []).some((e) => e.id === "setup-home"), false);
});

test("home.boughtYear: the guess for the box, in plain words, and none without a date", () => {
  const e = estimate(household({ ages: [25, 25] }), "home.boughtYear", OPTS);
  assert.equal(e.value, 2024);
  assert.equal(e.why, "Most owners your age bought in the last few years.");
  assert.deepEqual(e.tables, ["acs2025_year_moved_in_by_age_us", "acs2025_owner_households_by_age_us"]);
  assert.equal(estimate(household({ ages: [61] }), "home.boughtYear", OPTS).why, "Most owners your age bought ten to twenty years ago.");
  assert.equal(estimate(household({ ages: [85] }), "home.boughtYear", OPTS).why, "Most owners your age have been in their home for twenty years or more.");
});

// ---- the owner's case, and the rules
test("a 25-year-old couple, nothing typed: about 28 years left on the loan, bought in the last few years, not 12", () => {
  const p = household({ ages: [25, 25] });
  const x = loanOf(p);
  assert.equal(x.start.via, "guess"); assert.equal(x.start.year, 2024);
  assert.ok(x.monthsLeft >= 27 * 12, `${x.monthsLeft / 12} years left`);
  assert.equal(x.rate, 0.067, "Freddie Mac's 2024 average");
  assert.ok(x.balance > 150000 && x.balance <= x.home, `${x.balance} of ${x.home}`);
  // the mortgage page says so (its one plain line)
  const m = mortgagePage(p, { today: T0 });
  assert.equal(m.start.via, "guess"); assert.equal(m.start.worked, true); assert.equal(Math.round(m.start.yearsLeft), 28);
});

test("a year typed wins over the guess, a refinance tapped wins over both, an impossible tap is set aside", () => {
  const base = { ages: [25, 25] };
  const typed = loanOf(household({ ...base, bought: "2019", mortgage: { bought: "2019" } }));
  assert.equal(typed.start.via, "typed"); assert.equal(typed.start.year, 2019); assert.equal(typed.rate, 0.039);
  assert.equal(Math.round(typed.monthsLeft / 12), 23);
  const tapped = loanOf(household({ ...base, tap: "2020-21" }));
  // (loans lane 1, 2026-11-07, item 5: at 25 the couple was 20 in 2021, so "2020 or 2021" is read as 2021 alone: July 2021, was January)
  assert.equal(tapped.start.via, "tap"); assert.equal(tapped.start.date, "2021-07-01");
  // the tap is a loan's real start, a refinance: it wins over a year typed earlier ...
  const both = loanOf(household({ ...base, bought: "2015", mortgage: { bought: "2015" }, tap: "2020-21" }));
  assert.equal(both.start.via, "tap");
  // ... unless the loan would start before the purchase
  const odd = loanOf(household({ ...base, bought: "2024", mortgage: { bought: "2024" }, tap: "2020-21" }));
  assert.equal(odd.start.via, "typed");
  // every page reads one answer: Debts' row and the mortgage page's line move with the year typed
  const a = household({ ages: [30] }), b = household({ ages: [30], bought: "2012", mortgage: { bought: "2012" } });
  assert.notEqual(loanOf(a).balance, loanOf(b).balance);
  assert.ok(loanOf(b).monthsLeft < loanOf(a).monthsLeft);
  assert.equal(mortgagePage(b, { today: T0 }).start.year, 2012);
});

test("a typed figure is always kept; one typed beside the year sharpens the other", () => {
  const pay = household({ ages: [25, 25], mortgage: { payment: "1,900" } });
  assert.equal(loanOf(pay).payment, 1900);
  const x = loanOf(pay);
  // worked back from the payment over the months left since the year we guess: P&I = 1,900 less tax and insurance
  const esc = escrowMonthly(pay, { today: T0 }, { memo: (n, f) => f(), estimate: (k, o) => estimate(pay, k, { ...OPTS, ...o }) });
  const pi = Math.max(1900 - esc.total, 950);
  near(x.balance, 1 * pmtInverse(x.rate / 12, x.monthsLeft, pi), x.balance * 0.02, "balance = pv of P&I over the months left");
  const bal = household({ ages: [25, 25], mortgage: { owed: "250,000" } });
  assert.equal(loanOf(bal).balance, 250000);
  const lo = loanOf(bal);
  const escB = escrowMonthly(bal, { today: T0 }, { memo: (n, f) => f(), estimate: (k, o) => estimate(bal, k, { ...OPTS, ...o }) });
  near(lo.payment, pmt(lo.rate / 12, lo.monthsLeft, 250000) + escB.total, 30, "payment = P&I over the months left, plus tax and insurance");
});
const pmtInverse = (i, n, pay) => pay * (1 - Math.pow(1 + i, -n)) / i;

test("no figure moved: payment and balance both typed, no year -> the rate is the state's average, whatever the age", () => {
  for (const age of [25, 41, 61, 80]) {
    const p = household({ ages: [age], mortgage: { payment: "1,500", owed: "200,000" } });
    const x = loanOf(p);
    assert.equal(x.balance, 200000); assert.equal(x.payment, 1500);
    assert.equal(x.rate, 0.046, `${age}: FHFA Ohio 4.6%, as before`);
    assert.equal(x.row.months, Math.ceil(nper(0.046 / 12, 1500, 200000) - 1e-9), "years left read from their own figures");
    assert.equal(mortgagePage(p, { today: T0 }).start.worked, false, "the page says the years left come from their figures");
  }
});

// ---- the grid
const couple2 = (age, kind) => age;   // (a couple's older partner is the age)
const ages = [];
for (let a = 20; a <= 85; a += a < 40 ? 1 : 3) ages.push(a);
test("persona grid: every age 20 to 85, single and a couple, nothing typed", () => {
  const years = { single: [], couple: [] };
  for (const kind of ["single", "couple"]) {
    for (const age of ages) {
      const p = household({ ages: kind === "couple" ? [age, Math.max(20, age - 2)] : [age] });
      const x = loanOf(p);
      const where = `${kind} ${age}`;
      assert.ok(x.start && x.start.via === "guess", where);
      // never implies buying before about 20: the loan began no earlier than the 20th birthday (a year's slack: July 1 of the year)
      const startAge = age - gone(x.start.date) / 12;
      assert.ok(startAge >= 19, `${where}: bought at ${startAge.toFixed(1)}`);
      years[kind].push([age, x.monthsLeft / 12]);
      // the balance never exceeds the home's value, and is above 0
      assert.ok(x.balance > 0 && x.balance <= x.home, `${where}: owes ${x.balance} on ${x.home}`);
      // payment and balance agree: the payment less tax and insurance pays the balance off in the months left, at the rate (to the
      // dollars the payment is rounded by: $10 below $1,000, $50 above)
      const esc = escrowMonthly(p, { today: T0 }, { memo: (n, f) => f(), estimate: (k, o) => estimate(p, k, { ...OPTS, ...o }) });
      const step = x.payment < 1000 ? 10 : 50;
      const own = ownPI(p, x).pi;
      assert.ok(Math.abs(x.payment - (own + esc.total)) <= step / 2 + 0.01, `${where}: payment ${x.payment} vs ${own + esc.total}`);
      // the rate: the middle half of the age's move-in years' average, eased toward the loans people have (Ohio 4.6%): between 4% and 7%, and never past 0.3 of it
      near(x.rate, guessedRate({ age: couple2(age, kind), today: T0, outstanding: 0.046 }), 0.0006, where);
      assert.ok(x.rate > 0.04 && x.rate < 0.07, `${where}: ${x.rate}`);
      // the pages read the loan: Debts has a payoff date, and the mortgage page's line shows the same years
      const m = mortgagePage(p, { today: T0 });
      assert.equal(m.start.year, x.start.year, where);
      assert.equal(Math.round(m.start.monthsLeft), x.monthsLeft, where);
    }
  }
  for (const kind of ["single", "couple"]) {
    // years left falls with age (nonincreasing; the loan can only have been running longer)
    for (let i = 1; i < years[kind].length; i++) assert.ok(years[kind][i][1] <= years[kind][i - 1][1] + 1e-9, `${kind}: ${years[kind][i - 1]} then ${years[kind][i]}`);
  }
  // the owner's case: a 25-year-old (couple) has about 27 years or more
  assert.ok(years.couple.find(([a]) => a === 25)[1] >= 27, "25-year-old couple");
  assert.ok(years.single.find(([a]) => a === 25)[1] >= 27, "25-year-old");
  // and an older owner's loan is further along
  assert.ok(years.single.find(([a]) => a === 61)[1] < 17);
});


// ---- the review of 2026-11-07 (money D1 to D10, each written to fail on the patch before the fix)
const monthsOn = (row) => row.months;
test("D1 the pages count only principal and interest against the loan: every page shows the years the loan has (grid, nothing typed)", () => {
  for (const kind of ["single", "couple"]) {
    for (const age of ages) {
      const p = household({ ages: kind === "couple" ? [age, Math.max(20, age - 2)] : [age] });
      const x = loanOf(p), where = `${kind} ${age}`;
      assert.ok(x.row.escrow > 0 && x.row.escrow < x.row.minPayment, `${where}: tax and insurance are inside the payment`);
      // Debts' row: the loan's own months left, to the rounding of the payment ($50 on about $1,500 of principal and interest ~ 3%)
      // (the payment is rounded to $10 below $1,000 and $50 above, so the months are those of the loan's own principal and interest
      // plus or minus half a step)
      const own = ownPI(p, x).pi, step = x.payment < 1000 ? 10 : 50;
      const lo = Math.ceil(nper(x.rate / 12, own + step / 2 + 0.01, x.balance) - 1e-9) - 1, hi = Math.ceil(nper(x.rate / 12, own - step / 2 - 0.01, x.balance) - 1e-9) + 1;
      assert.ok(monthsOn(x.row) >= lo && monthsOn(x.row) <= hi, `${where}: Debts shows ${monthsOn(x.row)} months, the loan has ${x.monthsLeft} (${lo} to ${hi})`);
      // the mortgage page, Pay off debts and the Timeline say the same month as Debts
      const m = mortgagePage(p, { today: T0 });
      assert.equal(m.base.months, monthsOn(x.row), `${where}: mortgage page`);
      const pay = payoffPlanPage(p, { today: T0 });
      const mine = pay.chosen.debts.find((d) => d.id === x.row.id);
      assert.equal(mine.endDate.slice(0, 7), x.row.payoffDate.slice(0, 7), `${where}: Pay off debts`);
      const ev = timeline(p, { today: T0 }).events.find((e) => e.id === `debt-${x.row.id}`);
      assert.equal(ev.date.slice(0, 7), x.row.payoffDate.slice(0, 7), `${where}: Timeline`);
    }
  }
  // the owner's case, on the page he reads: a 25-year-old couple has about 27 years or more, not 17
  const c = household({ ages: [25, 25] }), r = loanOf(c).row;
  assert.ok(r.months >= 26.5 * 12, `Debts: ${r.months / 12} years`);
  assert.ok(Number(r.payoffDate.slice(0, 4)) >= 2053, r.payoffDate);
  assert.ok(mortgagePage(c, { today: T0 }).schedule.length >= 27);
});

test("D1 both typed: nothing moves (the whole payment pays the loan, as typed); a payment typed beside a guessed balance has its tax and insurance split out", () => {
  const both = household({ ages: [25, 25], mortgage: { payment: "1,900", owed: "230,000" } });
  const b = loanOf(both);
  assert.equal(b.row.escrow, 0);
  assert.equal(b.row.months, Math.ceil(nper(b.rate / 12, 1900, 230000) - 1e-9));
  const pay = household({ ages: [25, 25], mortgage: { payment: "1,900" } }), y = loanOf(pay);
  assert.ok(y.row.escrow > 300, "tax and insurance");
  // the balance is our guess shown to two figures: worked back over the 332 months left it is pv(6.7%/12, 332, 1,900 - 393.7) =
  // $227,302, saved as $230,000 (1.2% more), which this early in a 30-year loan is 12 months more on the pages (344). With the
  // whole $1,900 paying the loan they would say about 17 years (203 months). (Was 6 months: the flat state insurance put the escrow at
  // $383.7 and the pages at 338; insurance follows the home's value since guess-sanity, integration 2026-11-07.)
  assert.ok(Math.abs(y.row.months - y.monthsLeft) <= 12, `${y.row.months} vs ${y.monthsLeft}`);
  // "paid apart" (the tap): the whole payment pays the loan
  const apart = household({ ages: [25, 25], mortgage: { payment: "1,900" } }); apart.guide.setup.taps = { ...(apart.guide.setup.taps ?? {}), escrow: "no" };
  assert.equal(liabilities(apart, { today: T0 }).rows.find((r) => r.type === "mortgage").escrow, 0);
  // an escrow typed on the debt row wins (optional field, no version bump)
  const typed = structuredClone(both); typed.debts.find((d) => d.id === "setup-debt-mortgage").escrowMonthly = 400;
  assert.equal(liabilities(typed, { today: T0 }).rows.find((r) => r.type === "mortgage").escrow, 400);
});

test("D2 a second home or a rental loan is worked from its own home, and typing its year changes only that home", () => {
  // two homes: Get started's (typed 2010) and a lake house with its own loan, linked to nothing
  const p = household({ ages: [46, 45], home: "300000", bought: "2010", mortgage: { bought: "2010" } });
  p.accounts.push({ id: "lake", name: "Lake house", type: "property", balance: 200000, asOf: T0 }, { id: "lake-loan", name: "Lake loan", type: "mortgage", balance: -150000, asOf: T0 });
  p.debts.push({ id: "d-lake", accountId: "lake-loan", rate: 0.03, minPayment: 0, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
  const rec = recordOf(p, "mortgage", "accounts[lake-loan].balance");
  const s = startOf(p, rec, { today: T0, prof: profileOf(p, T0) });
  assert.notEqual(s.via, "typed", "the lake loan does not read the main home's 2010");
  assert.equal(purchaseOf(p, { loanId: "lake-loan" }).year, null);
  assert.equal(purchaseOf(p, { loanId: "setup-owe-mortgage" }).year, 2010);
  // link the lake house to its loan and type a year there: only the lake house's entry holds it
  p.property = [...(p.property ?? []), { id: "pr-lake", kind: "home", accountId: "lake", loanAccountId: "lake-loan", purchaseDate: "2021-07-01" }];
  assert.equal(purchaseOf(p, { loanId: "lake-loan" }).year, 2021);
  assert.equal(startOf(p, rec, { today: T0, prof: profileOf(p, T0) }).year, 2021);
  assert.equal(purchaseOf(p, { loanId: "setup-owe-mortgage" }).year, 2010, "the main home keeps its own");
  // a rental: worked from the condo's $150,000, never above it
  const q = household({ ages: [50], home: "600000" });
  q.accounts.push({ id: "condo", name: "Condo", type: "property", balance: 150000, asOf: T0 }, { id: "condo-loan", name: "Condo loan", type: "mortgage", balance: -1, asOf: T0 });
  q.property = [{ id: "pr-c", kind: "rental", accountId: "condo", loanAccountId: "condo-loan", purchaseDate: "2015-03-01", name: "Condo" }];
  const est = estimate(q, "debt.mortgage.owed", { ...OPTS, path: "accounts[condo-loan].balance" });
  assert.ok(est.value > 0 && est.value <= 150000, `owed ${est.value} on a $150,000 condo`);
  const tax = escrowMonthly(q, { today: T0, loanId: "condo-loan" }, { memo: (n, f) => f(), estimate: (k, o) => estimate(q, k, { ...OPTS, ...o }) });
  assert.ok(tax.value === 150000, "tax worked from the condo's value");
});

test("D3 an old typed year (a loan from then would be paid off) is not the loan's start: counted as with no year typed (verify 2026-11-07), the refinance question asked", () => {
  for (const age of [55, 60, 66, 70]) {
    for (const year of [1990, 1995, 1998, 2000]) {
      const none = household({ ages: [age] }), old = household({ ages: [age], bought: String(year), mortgage: { bought: String(year) } });
      const a = loanOf(none), b = loanOf(old), where = `${age} typed ${year}`;
      const startNone = a.start;
      assert.ok(b.payment <= 1.2 * a.payment + 50, `${where}: payment ${b.payment} vs ${a.payment}`);
      assert.ok(b.row.months >= 36 || !b.start, `${where}: ${b.row.months} months left`);
      // not the loan's start: counted like no year typed (our guess for the age), never as a new 30-year loan (verify 2026-11-07)
      assert.deepEqual([b.start.via, b.start.stale, b.start.year], ["guess", year, a.start.year], `${where}: not the loan's start`);
      assert.ok(Math.abs(b.row.months - a.row.months) <= 1, `${where}: ${b.row.months} months, as with no year typed (${a.row.months})`);
      // (a payment at the purchase loan's principal and interest, item 4, runs past that loan's years, never past a new 30-year loan's)
      assert.ok(b.row.months <= 360 - 12 * (2026 - a.start.year) + 36 || (ownPI(old, b).capped && b.row.months < 360), `${where}: not a new 30-year loan (${b.row.months} months)`);
      assert.equal(mortgagePage(old, { today: T0 }).start.via, "stale", where);
      const ask = estimate(old, "debt.mortgage.owed", { ...OPTS, path: "accounts[setup-owe-mortgage].balance" }).ask;
      assert.equal(ask?.key, "mortgage-start", `${where}: the refinance question is offered`);
      assert.ok(startNone === null || startNone.via !== "typed");
    }
  }
  // answering it (the mortgage page's buttons write the same tap Get started keeps) gives the loan a start again
  const old = household({ ages: [60], bought: "1995", mortgage: { bought: "1995" } });
  setMortgageStart(old, "2010s");
  assert.equal(loanOf(old).start.via, "tap");
  assert.equal(mortgagePage(old, { today: T0 }).start.via, "tap");
  setMortgageStart(old, null);
  assert.equal(old.guide.setup.taps, undefined);
});

test("D4 a typed payment never makes a loan larger than its home, whatever the payment (ages 25, 41, 61)", () => {
  for (const age of [25, 41, 61]) {
    for (const payment of [1000, 1500, 2000, 3000, 4000, 5000, 6000]) {
      const p = household({ ages: [age], mortgage: { payment: String(payment) } });
      const x = loanOf(p);
      assert.ok(x.balance <= x.home + 1, `${age}, $${payment}: owes ${x.balance} on ${x.home}`);
      assert.equal(x.payment, payment, "the typed payment is kept");
    }
  }
});

test("D5 Get started's year goes on the Home page's entry for the home when there is one: one entry, one answer", () => {
  const p = household({ ages: [25, 25], home: "300000" });
  p.property = [{ id: "uid-home-1", kind: "home", accountId: "setup-have-home", purchasePrice: 200000 }];
  S.applyOweAmounts(p, { mortgage: { bought: "2015" } }, T0);
  assert.equal(p.property.length, 1, "no second entry");
  assert.equal(p.property[0].purchaseDate, "2015-07-01");
  assert.equal(S.boughtYearOn(p), 2015);
  assert.equal(loanOf(p).start.year, 2015);
  assert.equal(loanOf(p).start.via, "typed");
  assert.equal(purchaseOf(p, { loanId: "setup-owe-mortgage" }).year, 2015);
  // a plan an earlier build left with both entries reads the one that has a date, everywhere
  const q = structuredClone(p); q.property.push({ id: "setup-home", kind: "home", accountId: "setup-have-home", purchaseDate: "2019-07-01" }); q.property[0].purchaseDate = "";
  assert.equal(S.boughtYearOn(q), 2019); assert.equal(purchaseOf(q, { loanId: "setup-owe-mortgage" }).year, 2019);
  // a blank takes the answer back from the entry that holds it
  S.applyOweAmounts(p, { mortgage: { bought: "" } }, T0);
  assert.equal(p.property[0].purchaseDate, undefined);
  assert.equal(loanOf(p).start.via, "guess");
});

test("D6 a refinance tapped is worked at the average 30-year rate of its years (Freddie Mac), 2022 or later at the state's new-loan rate", () => {
  const base = { ages: [25, 25] };
  const rate = (tap) => loanOf(household({ ...base, tap })).rate;
  near(rate("2020-21"), Math.round(rateMean(2020, 2021) * 1000) / 1000, 0.0006, "2020 or 2021"); assert.equal(rate("2020-21"), 0.03);
  // loans lane 1 (2026-11-07, item 5): a span is read only from the year the oldest adult was about 20, so at 25 "2010 to 2019" and
  // "before 2010" are set aside (the rate is the one with no tap); a couple of 50 and 49 was 20 in 1996: the whole spans
  assert.equal(rate("2010s"), loanOf(household(base)).rate); assert.equal(rate("pre2010"), loanOf(household(base)).rate);
  const older = (tap) => loanOf(household({ ages: [50, 49], tap })).rate;
  assert.equal(older("2010s"), 0.041); assert.equal(older("pre2010"), 0.063);
  assert.notEqual(rate("2022on"), 0.063, "a new loan's rate from the state's table");
  // the tap with both payment and balance typed moves nothing
  const bothTyped = loanOf(household({ ...base, mortgage: { payment: "1,500", owed: "200,000" }, tap: "2020-21" }));
  assert.equal(bothTyped.rate, 0.046);
});

test("D7 the guessed rate does not jump with age: within 4% to 7%, and no step of more than 0.8 points a year of age; a typed year keeps its own year's rate", () => {
  let last = null;
  for (let age = 22; age <= 85; age++) {
    const r = guessedRate({ age, today: T0, outstanding: 0.046 });
    assert.ok(r >= 0.04 && r <= 0.07, `${age}: ${r}`);
    if (last !== null) assert.ok(Math.abs(r - last) <= 0.008, `${age}: ${r} after ${last}`);
    last = r;
  }
  assert.ok(guessedRate({ age: 70, today: T0, outstanding: 0.046 }) < 0.055, "a 70-year-old is not guessed at 6.4%");
  assert.ok(guessedRate({ age: 25, today: T0, outstanding: 0.046 }) > 0.064, "a 25-year-old bought at today's rates");
  assert.equal(loanOf(household({ ages: [70], bought: "2006", mortgage: { bought: "2006" } })).rate, Math.round(rateInYear(2006) * 1000) / 1000, "typed: that year's average");
});

test("D8 a year ahead is no answer; the upper bound is this year, from the plan's today", () => {
  assert.equal(S.parseYear("2027", 2026), null); assert.equal(S.parseYear("2026", 2026), 2026); assert.equal(S.parseYear("1949", 2026), null);
  const p = household({ ages: [30], home: "300000", bought: "2027", mortgage: { bought: "2027" } });
  assert.equal(S.boughtYearOn(p), "", "nothing is stored for 2027");
  assert.equal(loanOf(p).start.via, "guess");
  assert.equal(S.valuesFor(p, "owe-amounts").mortgage.bought, "");
});

test("D9 the Census move-in spans end when the interviews do (mid-2025): ages 45, 50, 55 and 70 guess the year they did not", () => {
  assert.deepEqual([25, 35, 41, 45, 50, 55, 61, 66, 70].map((age) => boughtGuess({ age, today: T0 }).year), [2024, 2022, 2020, 2019, 2017, 2015, 2012, 2009, 2007]);
});

// ---- verify 2026-11-07: one answer on Your plan and the mortgage page's card
test("verify: Your plan's mortgage row says the years Debts shows, and nothing about the start when the balance and payment are typed", async () => {
  const { guessList } = await import("../modules/overview/plan/words.js");
  const rowOf = (p) => S.standing(p, { today: T0 }).guessed.find((g) => /Mortgage/.test(g.name));
  const label = (p) => guessList(p, { today: T0 }).find((r) => /^Mortgage/.test(r.label))?.label;
  // both typed, only the rate ours: as before this change ("Mortgage: rate 4.6%"), no years worked from a guessed purchase
  for (const ages of [[25, 25], [50, 49], [70]]) {
    const p = household({ ages, mortgage: { owed: "150,000", payment: "1,300" } });
    assert.equal(rowOf(p).yearsLeft, undefined, `${ages}`);
    assert.equal(label(p), "Mortgage: rate 4.6%", `${ages}`);
  }
  // nothing typed, a payment typed, a payment so large the balance is held at the home's value: the years are Debts' own
  for (const mortgage of [{}, { payment: "1,900" }, { payment: "4,000" }]) {
    const p = household({ ages: [25, 25], mortgage }), x = loanOf(p);
    assert.equal(rowOf(p).yearsLeft, Math.round(x.row.months / 12), JSON.stringify(mortgage));
    assert.match(label(p), new RegExp(`about ${Math.round(x.row.months / 12)} years left \\(bought 2024, our guess\\)`));
  }
});

test("verify: the mortgage page's card says the page's own years; a payment far above the usual one is said, not hidden", () => {
  for (const ages of [[25, 25], [35], [50, 49], [66], [80]]) {
    const p = household({ ages }), m = mortgagePage(p, { today: T0 });
    assert.equal(m.start.pageMonths, m.base.months, `${ages}`);
    assert.equal(m.start.apart, undefined, `${ages}: nothing typed, the payment pays the balance off about when the loan ends`);
  }
  const big = household({ ages: [25, 25], mortgage: { payment: "4,000" } }), m = mortgagePage(big, { today: T0 });
  assert.deepEqual([m.start.apart, m.start.owedGuess], [true, true]);
  // a small balance typed, the payment ours: apart too, and it is the payment that is asked for
  const small = mortgagePage(household({ ages: [40], mortgage: { owed: "5,000" } }), { today: T0 });
  assert.deepEqual([small.start.apart, small.start.owedGuess], [true, false]);
  assert.ok(m.base.months < m.start.monthsLeft - 36, `${m.base.months} vs ${m.start.monthsLeft}`);
  // both typed: the person's own figures, never "apart"
  assert.equal(mortgagePage(household({ ages: [25, 25], mortgage: { owed: "150,000", payment: "1,300" } }), { today: T0 }).start.apart, undefined);
});

test("verify: a year typed too long ago reads as a loan from our guessed year on Your plan, not as the year bought", async () => {
  const { guessList } = await import("../modules/overview/plan/words.js");
  const p = household({ ages: [60], bought: "1995", mortgage: { bought: "1995" } }), x = loanOf(p);
  const g = S.standing(p, { today: T0 }).guessed.find((r) => /Mortgage/.test(r.name));
  assert.deepEqual([g.boughtVia, g.bought, g.yearsLeft], ["stale", x.start.year, Math.round(x.row.months / 12)]);
  assert.match(guessList(p, { today: T0 }).find((r) => /^Mortgage/.test(r.label)).label, new RegExp(`left \\(loan from about ${x.start.year}, our guess\\)`));
  const m = mortgagePage(p, { today: T0 });
  assert.deepEqual([m.start.via, m.start.stale, m.start.year], ["stale", 1995, x.start.year]);
});

test("verify: Refinance compares today's payment and the offer's whole (the tax and insurance ride on both), interest from the loan parts", async () => {
  const { compute: refinance } = await import("../modules/debt/refinance/compute.js");
  const offer = { today: T0, rate: 0.06, termYears: 30, closingCosts: 5000 };
  const p = household({ ages: [25, 25] }), m = mortgagePage(p, { today: T0 }), r = refinance(p, offer);
  const pi = Math.round(pmt(0.06 / 12, 360, m.mortgage.balance) * 100) / 100;
  assert.ok(m.mortgage.escrow > 300, "a guessed payment carries Ohio's usual tax and insurance");
  near(r.offer.payment, pi + m.mortgage.escrow, 0.01, "the offer's payment keeps the same tax and insurance");
  near(r.monthlySaving, m.mortgage.toLoan - pi, 0.01, "the saving is the loan part's");
  assert.ok(r.monthlySaving < 200, `${r.monthlySaving}: not the $500 a bare loan payment against a whole one would claim`);
  // a plan with its own balance and payment: no escrow split out, the offer is the bare loan payment as before
  const q = household({ ages: [25, 25], mortgage: { owed: "150,000", payment: "1,300" } }), s = refinance(q, offer);
  assert.equal(s.current.escrow, 0);
  assert.equal(s.offer.payment, Math.round(pmt(0.06 / 12, 360, 150000) * 100) / 100);
  near(s.monthlySaving, 1300 - s.offer.payment, 0.01);
});

test("verify: a young owner's guessed payment is rounded to $10, so the pages say about the years the loan has (25-year-olds: 27 years or more, within 9 months of the loan)", () => {
  // with R11's $50 steps the payment's rounding alone moved the pages' years by up to 18 months either way: a 25-year-old couple
  // in Ohio on $40,000 read 26.5 years (318 months) on a loan with 332 left, and with no pay typed 26 (verify 2026-11-07)
  const out = [];
  for (const state of ["OH", "TX", "CA", "FL", "NY", "MS", "WA"]) for (const pay of [1, 40000, 60000, 120000]) for (const ages of [[25, 25], [25]]) {
    const p = household({ ages, state, pay });
    const L = loanOf(p);
    assert.equal(L.payment % 10, 0, "a guessed mortgage payment is a whole $10");
    out.push({ state, pay, ages: ages.join("+"), months: L.row.months, left: L.monthsLeft });
    assert.ok(L.row.months >= 27 * 12, `${state} ${pay} ${ages}: ${L.row.months} months on the pages`);
    near(L.row.months, L.monthsLeft, 9, `${state} ${pay} ${ages}: the pages' months vs the loan's`);
  }
  assert.equal(out.length, 56);
});

test("verify: a year typed too long ago says on Get started that the loan is counted from our year, never 'typical in 2013' under 'you bought in 1995'", () => {
  const p = household({ ages: [60], bought: "1995", mortgage: { bought: "1995" } });
  const e = estimate(p, "debt.mortgage.owed", { ...OPTS, path: "accounts[setup-owe-mortgage].balance", args: S.oweArgs(p, { bought: "1995" }, "mortgage", { today: T0 }) });
  assert.match(e.why, /like most owners your age|counted from about 20\d\d/);
  assert.doesNotMatch(e.why, /typical in 20\d\d/);
});

test("verify: a payment our older Get started guessed (the paymentGuessed flag: the loan's level payment alone) keeps its 30 years; a guessed tax and insurance never turns a payment that pays the loan off into one that never does", async () => {
  // qa/fixtures/guessed-plan.mjs: $185,000 at 7.24% with the typical $1,261 (pmt over 360 months, no tax or insurance) and no
  // ledger entry. patch-b took the state's usual $363 out of it, so the loan never paid off on Debts, Mortgage, Pay off debts,
  // Timeline and Your plan (verify 2026-11-07)
  const { guessedPlan } = await import("../qa/fixtures/guessed-plan.mjs");
  const p = guessedPlan(T0);
  const d = p.debts.find((x) => x.id === "setup-debt-mortgage"), a = p.accounts.find((x) => x.id === d.accountId);
  assert.equal(typeof d.paymentGuessed, "number", "the older flag");
  assert.equal(Object.keys(p.guesses ?? {}).some((k) => k.includes("minPayment")), false, "no ledger entry on the payment");
  const row = liabilities(p, { today: T0 }).rows.find((r) => r.type === "mortgage");
  assert.equal(row.escrow, 0, "the older guess is the loan's payment alone");
  assert.equal(row.months, Math.ceil(nper(d.rate / 12, d.minPayment, a.balance) - 1e-9));
  assert.ok(row.months >= 359 && row.months <= 360, `${row.months}`);
  assert.ok(Number.isFinite(mortgagePage(p, { today: T0 }).base.months), "Mortgage");
  assert.ok(timeline(p, { today: T0 }).events.some((e) => e.id === `debt-${row.id}`), "Timeline has the payoff");
  // Your plan says what it said before: that payment was never worked from a year bought ("30 years left (bought 2021)" is not true)
  const g = S.standing(p, { today: T0 }).guessed.find((x) => /mortgage/i.test(x.name));
  assert.ok(g, "the mortgage is listed among the guesses");
  assert.equal(g.yearsLeft, undefined);
  // a typed payment beside a guessed balance whose usual tax and insurance would leave less than the month's interest: the
  // payment is read as the loan's alone (a finite payoff), never "never pays off"
  const q = household({ ages: [25, 25], mortgage: { payment: "1,900" } });
  const qd = q.debts.find((x) => x.id === "setup-debt-mortgage"), qa = q.accounts.find((x) => x.id === "setup-owe-mortgage");
  const key = Object.keys(q.guesses).find((k) => k.includes("setup-owe-mortgage") && k.endsWith("balance"));
  assert.ok(key, "the balance is our guess");
  const big = Math.round(1800 * 12 / qd.rate);
  qa.balance = big; q.guesses[key] = { ...q.guesses[key], v: big };
  const qr = liabilities(q, { today: T0 }).rows.find((r) => r.type === "mortgage");
  assert.equal(qr.escrow, 0);
  assert.ok(Number.isFinite(qr.months) && qr.months > 360, `${qr.months}`);
  // the guard only steps in then: the same plan with its own balance worked back keeps the tax and insurance split out
  assert.ok(loanOf(household({ ages: [25, 25], mortgage: { payment: "1,900" } })).row.escrow > 300);
});
