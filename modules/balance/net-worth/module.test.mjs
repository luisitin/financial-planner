import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

function plan() {
  const p = emptyPlan();
  p.accounts.push(
    { id: "1", name: "Checking", type: "checking", balance: 1000 },
    { id: "2", name: "401k", type: "401k", balance: 20000 },
    { id: "3", name: "Roth", type: "roth", balance: 5000 },
    { id: "4", name: "Car", type: "vehicle", balance: 8000 },
    { id: "5", name: "Visa", type: "credit", balance: 500 },
    { id: "6", name: "Car loan", type: "loan", balance: -3000 },   // sign is ignored for debts
  );
  return p;
}
test("net worth totals", () => {
  const d = compute(plan());
  assert.equal(d.assets, 34000);
  assert.equal(d.liabilities, 3500);
  assert.equal(d.netWorth, 30500);
  assert.equal(d.liquid, 1000);
  assert.equal(d.cash, 1000);
  assert.equal(d.investable, 25000, "checking is not invested (F-003)");
  assert.deepEqual(d.byTaxBucket, { taxable: 0, deferred: 20000, free: 5000, none: 9000 });
  assert.equal(d.count, 6);
});
test("an overdrawn checking account lowers what you own instead of adding to it (F-001)", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "1", name: "Checking", type: "checking", balance: -500 }, { id: "2", name: "Savings", type: "savings", balance: 2000 }, { id: "3", name: "Brokerage", type: "brokerage", balance: 1000 });
  const d = compute(p);
  assert.equal(d.assets, 2500);
  assert.equal(d.netWorth, 2500);
  assert.equal(d.liquid, 2500);
  assert.equal(d.cash, 1500);
  assert.equal(d.investable, 1000);
  assert.deepEqual(d.byTaxBucket, { taxable: 1000, deferred: 0, free: 0, none: 1500 }, "cash is not invested, so it sits in none");
});
test("change vs last snapshot", () => {
  const p = plan();
  p.netWorthHistory.push({ date: "2026-01-01", assets: 30000, liabilities: 4000, netWorth: 26000 });
  const d = compute(p);
  assert.equal(d.change.sinceLast, 4500);
  assert.ok(Math.abs(d.change.sinceLastPct - 4500 / 26000) < 1e-9);
});
test("empty plan", () => {
  const d = compute(emptyPlan());
  assert.equal(d.netWorth, 0);
  assert.equal(d.change, null);
});

// C2 (smart guesses, spec 8.1): additive keys, present only when the plan holds guesses
test("partly our guesses: the guessed share of each side, keys only when a balance is a guess", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = plan();
  const plain = compute(p);
  assert.equal("guessedAssets" in plain || "guessedLiabilities" in plain || "partlyGuessed" in plain, false, "no guesses: the result is as before");
  // the car loan ($3,000 of $3,500 owed, 86%) is our guess: liabilities rest on guesses
  markGuess(p, "accounts[6].balance", { key: "debt.car-loan.owed", value: -3000, unit: "total", sigma: 0.5, today: "2026-11-02" });
  const g = compute(p);
  assert.deepEqual([g.netWorth, g.guessedAssets, g.guessedLiabilities, g.partlyGuessed], [plain.netWorth, 0, 3000, true]);
  // a guessed asset under half of the assets, and a guessed liability under half: not "partly our guesses"
  const q = plan();
  markGuess(q, "accounts[4].balance", { key: "car.value", value: 8000, unit: "total", sigma: 0.3, today: "2026-11-02" });
  markGuess(q, "accounts[5].balance", { key: "debt.credit.owed", value: 500, unit: "total", sigma: 0.8, today: "2026-11-02" });
  const h = compute(q);
  assert.deepEqual([h.guessedAssets, h.guessedLiabilities, h.partlyGuessed], [8000, 500, false], "8,000 of 34,000 and 500 of 3,500");
  // exactly half counts: the guessed $500 card of $1,000 owed
  q.accounts.find((a) => a.id === "6").balance = -500;
  assert.equal(compute(q).partlyGuessed, true, "500 of 1,000 owed");
});

// ---- plain-words pass C10 (2026-11-13, SPEC 13.1): the words change, every figure and saved value stays ----------------------
test("C10: each kind of account has plain words on screen; the stored kind and the label other pages read are kept", async () => {
  const { ACCOUNT_TYPES, typeName } = await import("./compute.js");
  assert.deepEqual(Object.fromEntries(Object.keys(ACCOUNT_TYPES).map((k) => [k, typeName(k)])), {
    checking: "Checking", savings: "Savings or money market", cash: "Cash", brokerage: "Investments outside retirement", "401k": "401(k) / 403(b)",
    ira: "Traditional IRA (taxed when taken out)", roth: "Roth (tax-free later)", hsa: "Health savings account (HSA)", "529": "College savings (529)", crypto: "Crypto",
    property: "A home or land", vehicle: "Vehicle", cash_value_life: "Savings inside a life insurance policy", other_asset: "Something else I own",
    credit: "Credit card", loan: "Car or personal loan", mortgage: "Mortgage", student_loan: "Student loan", other_liability: "Something else I owe",
  });
  assert.equal(typeName("boat"), "Something else I own", "an unknown kind is counted, and named, as something else you own");
  assert.equal(typeName("boat", "other_liability"), "Something else I owe");
  // a traditional IRA cuts this year's tax only under the income limits (IRC 219(g)), and money put in without the deduction
  // never did; what is true of every one is that it is taxed when taken out, as the Invested for later line says (critic a-2)
  assert.doesNotMatch(typeName("ira"), /cut|this year/);
  assert.match(typeName("ira"), /taxed when taken out/);
  assert.equal(ACCOUNT_TYPES.ira.taxBucket, "deferred", "the bucket the words describe");
  // the label is kept: AI notes, Explain, the AI critic, the export file and their tests read it
  assert.deepEqual([ACCOUNT_TYPES.brokerage.label, ACCOUNT_TYPES.roth.label, ACCOUNT_TYPES.property.label, ACCOUNT_TYPES.loan.label, ACCOUNT_TYPES.ira.label],
    ["Brokerage (taxable)", "Roth IRA / 401(k)", "Real estate", "Personal / auto loan", "Traditional IRA"]);
  // the same figures as before
  const d = compute(plan());
  assert.deepEqual([d.assets, d.liabilities, d.netWorth, d.investable], [34000, 3500, 30500, 25000]);
});

const T = "2026-11-13";
const view = new URL("./view.js", import.meta.url);
const onePerson = () => { const p = plan(); p.household.people = [{ id: "p-sam", name: "Sam", role: "self", birthDate: "1990-01-01" }]; return p; };
const computeOf = { "balance/net-worth": compute };   // the view reads its figures through ctx.computeOf
const addForm = (p, add = "checking") => import("../../../qa/fixtures/fake-dom.mjs").then(({ renderPage }) => renderPage(view, p, T, { computeOf, route: { rest: [], query: { add } } }));

test("C10: the form says Bank or company; Whose account offers Both of us for two adults, and is not asked with one adult", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const two = (await addForm(familyPlan(T))).text();
  assert.match(two, /Bank or company/);
  assert.match(two, /Whose account Both of us Ana Bo Cy/);
  for (const w of ["Institution", "Bank or firm", "Joint or shared"]) assert.ok(!two.includes(w), w);
  // Type lists the plain words (in the order of ACCOUNT_TYPES, where "529" comes first as a number-like key, as before)
  assert.match(two, /Type College savings \(529\) Checking Savings or money market Cash Investments outside retirement 401\(k\) \/ 403\(b\) Traditional IRA \(taxed when taken out\) Roth \(tax-free later\) Health savings account \(HSA\) Crypto A home or land Vehicle Savings inside a life insurance policy Something else I own Credit card Car or personal loan Mortgage Student loan Something else I owe/);
  // ("Traditional IRA" stays, now with what it means: the Type list above pins it with "(taxed when taken out)")
  assert.ok(!two.includes("cuts this year's tax"));
  for (const w of ["Brokerage (taxable)", "Roth IRA / 401(k)", "529 plan", "Real estate", "Life insurance cash value", "Other liability", "Personal / auto loan"]) assert.ok(!two.includes(w), w);
  const one = (await addForm(onePerson())).text();
  for (const w of ["Whose account", "Both of us", "Joint or shared", "Shared"]) assert.ok(!one.includes(w), w);
});

test("C10: one adult: a new account still saves no owner (\"\"), an account on file keeps its owner; a single parent can still pick a child", async () => {
  const save = async (p, route, typed) => {
    const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
    const r = await renderPage(view, p, T, { computeOf, route });
    const form = r.root.querySelectorAll("form")[0];
    for (const [k, v] of Object.entries(typed)) form.querySelector(`[name="${k}"]`).value = v;
    form.reset = () => {};   // (the stand-in DOM has no reset; the add form clears itself after a save)
    form.dispatch("submit");
    return { r, after: r.saved.at(-1) };
  };
  const added = await save(onePerson(), { rest: [], query: { add: "savings" } }, { name: "Rainy day", balance: "2500" });
  assert.deepEqual(added.after.accounts.at(-1).ownerId, "", "as the hidden box would have saved");
  assert.equal(added.after.accounts.at(-1).balance, 2500);
  const mine = onePerson(); mine.accounts[0].ownerId = "p-sam";
  const kept = await save(mine, { rest: [], query: { edit: "1" } }, { balance: "1200" });
  assert.equal(kept.after.accounts.find((a) => a.id === "1").ownerId, "p-sam");
  // a single parent: the adult (saves "" as before, or the id on file) and the child; no "Both of us"
  const parent = onePerson(); parent.household.people.push({ id: "p-kid", name: "Kit", role: "dependent", birthDate: "2018-01-01" });
  const text = (await addForm(parent)).text();
  assert.match(text, /Whose account Sam Kit/);
  assert.ok(!text.includes("Both of us"));
  const kid = await save(parent, { rest: [], query: { add: "529" } }, { name: "Kit's college", balance: "900", ownerId: "p-kid" });
  assert.equal(kid.after.accounts.at(-1).ownerId, "p-kid");
});

test("C10: the list and the invested line in plain words, the sums unchanged", async () => {
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = plan(); p.accounts.push({ id: "7", name: "Index funds", type: "brokerage", balance: 1500 }, { id: "8", name: "Land", type: "property", balance: 40000 });
  const text = await pageText(view, p, T, { computeOf });
  assert.match(text, /\$20,000 in retirement accounts, taxed when taken out; \$5,000 tax-free; \$1,500 in other investments/);
  assert.match(text, /Investments outside retirement/);
  assert.match(text, /A home or land/);
  assert.match(text, /Car or personal loan/);
  for (const w of ["pre-tax", "taxable", "Brokerage (taxable)", "Real estate", "Personal / auto loan"]) assert.ok(!text.includes(w), w);
  // an address that asks for a kind with no heading of its own gets the heading of its sort
  assert.match((await addForm(plan(), "hsa")).text(), /Add an account/);
  assert.match((await addForm(plan(), "other_liability")).text(), /Add something you owe/);
  assert.match((await addForm(plan(), "other_asset")).text(), /Add something you own/);
});

// ---------------------------------------------------------------- gap design #33: an account added for a file on Import
test("#33 added for a file on Import: the name from the file, and the balance can wait ($0 for now, no date, said); any other add as before", async () => {
  const { renderPage, FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const add = async (query, typed) => {
    const r = await renderPage(view, onePerson(), T, { computeOf, route: { rest: [], query } });
    const form = r.root.querySelectorAll("form")[0];
    const box = (k) => form.querySelector(`[name="${k}"]`);
    const before = { name: box("name").value, required: box("balance").hasAttribute("required"), text: r.text() };
    for (const [k, v] of Object.entries(typed)) box(k).value = v;
    form.reset = () => {};
    form.dispatch("submit");
    return { before, after: r.saved.at(-1), root: r.root };
  };
  const later = await add({ add: "credit", from: "import", name: "Rewards Card" }, { balance: "" });
  assert.equal(later.before.name, "Rewards Card"); assert.equal(later.before.required, false);
  assert.match(later.before.text, /Not sure now\? Leave it empty: it is added at \$0, and you type the balance later\./);
  const card = later.after.accounts.at(-1);
  assert.deepEqual([card.name, card.type, card.balance, card.asOf, "later" in card], ["Rewards Card", "credit", 0, "", false]);
  // (the green line with its button is brought into view when it is off screen: the stand-in DOM has no layout)
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 200 });
  const again = await renderPage(view, later.after, T, { computeOf, route: { rest: [], query: { from: "import" } } });
  assert.match(again.text(), /Rewards Card added at \$0 for now\. When you know its balance, tap Edit beside it here\./);
  // a balance typed is kept as typed, dated as usual
  const typed = await add({ add: "checking", from: "import", name: "Joint Checking" }, { balance: "1200" });
  assert.deepEqual([typed.after.accounts.at(-1).name, typed.after.accounts.at(-1).balance, typed.after.accounts.at(-1).asOf], ["Joint Checking", 1200, T]);
  // not from Import: no name from the address, and the balance is asked as before
  const plain = await add({ add: "checking", name: "Joint Checking" }, { name: "Mine", balance: "50" });
  assert.equal(plain.before.name, ""); assert.equal(plain.before.required, true);
  assert.doesNotMatch(plain.before.text, /Not sure now/);
});

// ---------------------------------------------------------------- gap design #35: ahead or behind the path you drew (path.js)
import { snapshotOf, keepSnapshot, dropSnapshot, expectedAt, pickSnapshot, monthlySaving, against, planWords, savingWords, sentenceOf, statusWords,
  isDay, wouldKeep, tooSmall, oldestBalance, comingOn, comingWords, staleWords, savedWords, MIN_MONTHS, KEEP, POINT_YEARS, MIN_PATH } from "./path.js";
import { compute as projectionOf } from "../../retirement/projection/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { migrate } from "../../../core/schema/migrate.js";
const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
// Sam, 36, with $26,000 in the accounts a retirement plan draws on (the car and the debts are not savings)
const sam = () => { const p = onePerson(); p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 3000 }; return p; };
const SNAP = { at: "2025-11-13", start: 10000, points: { 2025: 13600, 2026: 20000, 2027: 27000 }, lastsTo: 2085 };
const withSnap = (snap = SNAP, p = sam()) => { p.pathSnapshots = [structuredClone(snap)]; return p; };
const pathPart = (r) => r.root.querySelectorAll("details").find((x) => x.dataset.part === "path") ?? null;
const pressSave = (r) => r.root.querySelectorAll("button").find((b) => b.textContent === "Save today's totals").click();

test("#35 the snapshot: today's savings, the projection's first ten rows in today's dollars, the year the plan runs to; none while the projection cannot be worked out", () => {
  const p = migrate(familyPlan("2025-11-12"));
  const s = snapshotOf(p, "2025-11-12"), d = projectionOf(p, { today: "2025-11-12" });
  assert.equal(s.at, "2025-11-12");
  assert.equal(s.start, Math.round(Object.values(d.inputs.balances).reduce((a, b) => a + b, 0)));
  assert.equal(Object.keys(s.points).length, POINT_YEARS);
  for (const r of d.rows.slice(0, POINT_YEARS)) assert.equal(s.points[r.year], Math.round(r.totalReal));
  assert.equal(s.lastsTo, d.result.failYear ?? d.rows.at(-1).year);
  assert.equal(s.inflation, d.inputs.rates.inflation, "the rise in prices that plan assumed is kept with it");
  // only a real calendar day is a day (critic M3): no snapshot is made for, kept under, or read from an impossible date
  for (const bad of ["2025-13-45", "2025-02-30", "2025-00-10", "2025-1-5", "", null]) assert.equal(isDay(bad), false, String(bad));
  assert.equal(isDay("2024-02-29"), true); assert.equal(isDay("2025-02-29"), false);
  assert.equal(snapshotOf(p, "2025-13-45"), null);
  const odd = {}; assert.equal(keepSnapshot(odd, { ...SNAP, at: "2025-13-45" }), false); assert.equal("pathSnapshots" in odd, false);
  assert.equal(pickSnapshot([{ ...SNAP, at: "2025-13-45" }], "2026-11-13"), null);
  assert.equal(snapshotOf(plan(), "2025-11-12"), null, "nobody with a birth date: no projection, nothing kept");
  assert.equal(snapshotOf(migrate(emptyPlan()), "2025-11-12"), null);
});

test("#35 at most one write a month: the same day replaces, another day of that month writes nothing, the next month adds; at most 24 are kept", () => {
  const p = {};
  assert.equal(keepSnapshot(p, { ...SNAP, at: "2026-03-05", start: 1 }), true);
  assert.equal(keepSnapshot(p, { ...SNAP, at: "2026-03-05", start: 2 }), true, "saving twice in one day updates that day");
  assert.deepEqual(p.pathSnapshots.map((s) => [s.at, s.start]), [["2026-03-05", 2]]);
  assert.equal(keepSnapshot(p, { ...SNAP, at: "2026-03-28", start: 3 }), false);
  assert.deepEqual(p.pathSnapshots.map((s) => [s.at, s.start]), [["2026-03-05", 2]]);
  assert.equal(keepSnapshot(p, { ...SNAP, at: "2026-04-01", start: 4 }), true);
  assert.equal(p.pathSnapshots.length, 2);
  assert.equal(keepSnapshot(p, null), false, "no projection that day: nothing written");
  const q = {};
  for (let i = 0; i < 30; i++) keepSnapshot(q, { ...SNAP, at: `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-10` });
  assert.equal(q.pathSnapshots.length, KEEP);
  assert.equal(q.pathSnapshots[0].at, "2020-07-10", "the oldest six went");
  assert.equal(q.pathSnapshots.at(-1).at, "2022-06-10");
  dropSnapshot(q, "2022-06-10");
  assert.equal(q.pathSnapshots.length, KEEP - 1);
  dropSnapshot(p, "2026-03-05"); dropSnapshot(p, "2026-04-01");
  assert.equal("pathSnapshots" in p, false, "the last one removed takes the section off");
});

test("#35 the interpolation: a straight line between the path's marks, a year apart, from the day it was kept", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  // no inflation: day 0 is the start, 183 days on is 183/365.25 of the way to the first row
  near(expectedAt(SNAP, "2025-11-13", 0).expected, 10000);
  near(expectedAt(SNAP, "2026-05-15", 0).expected, 10000 + 3600 * (183 / 365.25));
  near(expectedAt(SNAP, "2026-11-13", 0).expected, 10000 + 3600 * (365 / 365.25));
  // past the first mark: between the first row and the second (366 days = one year and 0.75 of a day)
  near(expectedAt(SNAP, "2026-11-14", 0).expected, 13600 + 6400 * (0.75 / 365.25));
  assert.equal(expectedAt(SNAP, "2025-11-12", 0), null, "a day before it was kept");
  assert.equal(expectedAt(SNAP, "2029-11-13", 0), null, "past the last mark kept: nothing to say");
  assert.equal(expectedAt({ ...SNAP, points: null }, "2026-11-13", 0), null);
});

test("#35 the inflation re-expression: a row's today's-dollars figure is put into the money of its own day with the plan's inflation", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  // 2025-01-01 to 2027-01-01 is 730 days: mark 1 (13,600, the first year is at the prices of the day) to mark 2 (20,000 x 1.03)
  const s = { ...SNAP, at: "2025-01-01" };
  const e = expectedAt(s, "2027-01-01", 0.03), part = 730 / 365.25 - 1;
  near(e.expected, 13600 + (20000 * 1.03 - 13600) * part);
  near(e.real, 13600 + (20000 - 13600) * part);
  // 1,461 days are four years to the day: a plan followed to the letter lands on the projection's own fourth row, in its own money
  const p = migrate(familyPlan("2025-01-01")), d = projectionOf(p, { today: "2025-01-01" });
  const kept = { at: "2025-01-01", start: 0, points: Object.fromEntries(d.rows.slice(0, 10).map((r) => [r.year, r.totalReal])) };
  near(expectedAt(kept, "2029-01-01", d.inputs.rates.inflation).expected, d.rows[3].total);
  near(expectedAt(kept, "2029-01-01", d.inputs.rates.inflation).years, 4);
});

test("#35 M2: the path is read with the inflation its own plan assumed, so changing the assumption later does not move it", () => {
  // two years and a bit on, so the rate matters (mark 2 = 20,000 x (1 + inflation))
  const day = "2027-12-01", snap = { ...SNAP, inflation: 0.03 };
  const p = withSnap(snap), q = withSnap(snap);
  q.assumptions = { ...(q.assumptions ?? {}), inflation: 0.08 };
  const a = against(p, day), b = against(q, day);
  assert.ok(Math.abs(a.expected - expectedAt(snap, day, 0.03).expected) < 1e-9);
  assert.equal(b.expected, a.expected, "the plan's inflation of today is not used for a path kept with its own");
  // a path kept before the rate was stored falls back on the plan's rate of today
  const old = withSnap(SNAP); old.assumptions = { ...(old.assumptions ?? {}), inflation: 0.08 };
  assert.ok(Math.abs(against(old, day).expected - expectedAt(SNAP, day, 0.08).expected) < 1e-9);
  assert.notEqual(against(old, day).expected, a.expected);
});

test("#35 M1: balances more than a month old are said: the answer is about the balances on file, with the oldest day", () => {
  const fresh = withSnap();
  for (const a of fresh.accounts) a.asOf = "2026-10-20";
  assert.equal(oldestBalance(fresh), "2026-10-20");
  assert.equal(against(fresh, T).staleFrom, null, "under a month old: nothing more is said");
  assert.equal(staleWords(against(fresh, T), (d) => d), "");
  const stale = withSnap();
  for (const a of stale.accounts) a.asOf = "2026-11-01";
  stale.accounts.find((a) => a.type === "401k").asOf = "2025-11-13";
  stale.accounts.find((a) => a.type === "vehicle").asOf = "2020-01-01";   // a car is not savings: its date does not count
  assert.equal(oldestBalance(stale), "2025-11-13");
  const a = against(stale, T);
  assert.equal(a.staleFrom, "2025-11-13");
  assert.equal(staleWords(a, () => "November 13, 2025"), "This compares the balances on file, the oldest from November 13, 2025. Update your balances for today's answer.");
  const edge = withSnap(); for (const x of edge.accounts) x.asOf = "2026-10-13";
  assert.equal(against(edge, T).staleFrom, null, "a month to the day is not old yet");
  for (const x of edge.accounts) x.asOf = "2026-10-12";
  assert.equal(against(edge, T).staleFrom, "2026-10-12");
  const none = withSnap(); for (const x of none.accounts) delete x.asOf;
  assert.equal(oldestBalance(none), null); assert.equal(against(none, T).staleFrom, null, "no day on any balance: nothing is claimed");
  assert.equal(oldestBalance({ accounts: [{ type: "401k", balance: 0, asOf: "2020-01-01" }, { type: "roth", balance: 5, asOf: "2026-01-01" }, null] }), "2026-01-01", "an empty account's day does not count");
});

test("#35 F4: with nothing going in and under $5,000 in savings then, by the path and today, there is no path to speak of: nothing is said", () => {
  assert.equal(MIN_PATH, 5000);
  const small = { ...SNAP, start: 2000, points: { 2025: 2040, 2026: 2081, 2027: 2122 } };
  const tiny = () => { const p = sam(); p.accounts = [{ id: "1", name: "Checking", type: "checking", balance: 2000 }]; return p; };
  assert.equal(against(withSnap(small, tiny()), T), null, "about $2,000 and no saving: not 'right on plan'");
  // the same small path says something once money goes in, or once the savings are no longer small
  const saver = withSnap(small, tiny()); saver.retirement.contributions = [{ id: "c1", accountId: "1", personId: "p-sam", amount: 300, period: "monthly", employerMatch: 0 }];
  assert.equal(against(saver, T).side, "on");
  const grown = withSnap(small, tiny()); grown.accounts[0].balance = 9000;
  assert.equal(against(grown, T).side, "ahead");
  assert.equal(against(withSnap({ ...SNAP, start: 6000, points: { 2025: 3000, 2026: 2000 } }, tiny()), T).side, "behind", "it was more than that on the day the plan was kept");
});

test("#35 F1 and F2: a kept path younger than six months says from which day the comparison shows; the save says the plan is kept too", async () => {
  assert.equal(comingOn(sam(), T), null, "no kept path: nothing");
  assert.equal(comingOn(withSnap({ ...SNAP, at: "2026-08-01" }), T), "2027-02-01");
  const two = withSnap(); two.pathSnapshots = [{ ...SNAP, at: "2026-09-02" }, { ...SNAP, at: "2026-07-15" }];
  assert.equal(comingOn(two, T), "2027-01-15", "the first one kept");
  assert.equal(comingOn(withSnap(), T), null, "one is old enough: the row itself shows");
  assert.equal(comingWords("2027-02-01", () => "February 1, 2027"), "From February 1, 2027, this page also says whether your savings are ahead of or behind the plan you had when you saved your totals.");
  assert.equal(savedWords(true), "Today's totals saved. Your plan is kept too, so you can compare in six months.");
  assert.equal(savedWords(false), "Today's totals saved.");
  const frozen = Object.freeze({ pathSnapshots: Object.freeze([{ ...SNAP, at: "2026-11-02" }]) });
  assert.equal(wouldKeep(frozen, { ...SNAP, at: "2026-11-20" }), false, "the month has one already");
  assert.equal(wouldKeep(frozen, { ...SNAP, at: "2026-12-01" }), true, "asking changes nothing in the plan");
  assert.equal(wouldKeep({}, null), false);
  // the page: the line stands where the row will be, and only then
  const young = await renderPage(view, withSnap({ ...SNAP, at: "2026-08-01" }), T, { computeOf });
  assert.match(young.text(), /From February 1, 2027, this page also says whether your savings are ahead of or behind the plan you had/);
  assert.equal(young.root.querySelectorAll("details").length, 0);
  assert.doesNotMatch((await renderPage(view, sam(), T, { computeOf })).text(), /this page also says/);
  assert.doesNotMatch((await renderPage(view, withSnap(), T, { computeOf })).text(), /this page also says/);
  // a first save keeps the plan and says so; a later day of that month keeps none and does not say so; no projection, no claim
  const first = await renderPage(view, sam(), T, { computeOf });
  pressSave(first);
  assert.equal(first.saved[0].pathSnapshots.length, 1);
  const shown = await renderPage(view, first.saved[0], T, { computeOf });
  assert.match(shown.text(), /Today's totals saved\. Your plan is kept too, so you can compare in six months\./);
  assert.match(shown.text(), /From May 13, 2027, this page also says/);
  const later = await renderPage(view, first.saved[0], "2026-11-28", { computeOf });
  pressSave(later);
  const laterShown = (await renderPage(view, later.saved[0], "2026-11-28", { computeOf })).text();
  assert.match(laterShown, /Today's totals saved\./); assert.doesNotMatch(laterShown, /kept too/);
  // about $2,000 with no saving: the path is kept, but no comparison is promised, since none would be shown (critic F4)
  const tiny = sam(); tiny.accounts = [{ id: "1", name: "Checking", type: "checking", balance: 2000 }];
  assert.equal(tooSmall(tiny, snapshotOf(migrate(structuredClone(tiny)), T), T), true);
  assert.equal(tooSmall(sam(), snapshotOf(migrate(sam()), T), T), false);
  assert.equal(comingOn(withSnap({ ...SNAP, at: "2026-08-01", start: 2000 }, structuredClone(tiny)), T), null);
  const small = await renderPage(view, tiny, T, { computeOf });
  pressSave(small);
  assert.equal(small.saved[0].pathSnapshots.length, 1);
  const smallShown = (await renderPage(view, small.saved[0], T, { computeOf })).text();
  assert.match(smallShown, /Today's totals saved\./); assert.doesNotMatch(smallShown, /kept too|this page also says/);
  const none = await renderPage(view, plan(), T, { computeOf });
  pressSave(none);
  const noneShown = (await renderPage(view, none.saved[0], T, { computeOf })).text();
  assert.match(noneShown, /Today's totals saved\./); assert.doesNotMatch(noneShown, /kept too/);
});

test("#35 which kept path: none younger than six months, then the one closest to a year old", () => {
  assert.equal(MIN_MONTHS, 6);
  const at = (...days) => days.map((d) => ({ ...SNAP, at: d }));
  assert.equal(pickSnapshot(at("2026-05-14", "2026-09-01"), "2026-11-13"), null, "one day short of six months");
  assert.equal(pickSnapshot(at("2026-05-13"), "2026-11-13").at, "2026-05-13", "six months to the day");
  assert.equal(pickSnapshot(at("2024-11-01", "2025-10-20", "2026-01-15", "2026-05-01", "2026-10-01"), "2026-11-13").at, "2025-10-20");
  assert.equal(pickSnapshot(at("2024-11-01", "2026-05-01"), "2026-11-13").at, "2026-05-01");
  assert.equal(pickSnapshot(undefined, "2026-11-13"), null);
  assert.equal(pickSnapshot([null, { at: "soon" }, { at: "2025-11-13" }], "2026-11-13"), null, "a broken entry is passed over");
});

test("#35 ahead = savings today in the projection's buckets minus the expected figure; months of saving = that over the plan's monthly saving", () => {
  const a = against(withSnap(), T);
  assert.equal(a.now, 26000, "the 401(k), the Roth and the checking account; not the car, not the debts");
  assert.ok(Math.abs(a.expected - (10000 + 3600 * (365 / 365.25))) < 1e-6);
  assert.ok(Math.abs(a.ahead - (26000 - a.expected)) < 1e-9);
  assert.equal(a.side, "ahead"); assert.equal(a.monthly, 0); assert.equal(a.months, null);
  // with $4,000 a month going in
  const p = withSnap(); p.retirement.contributions = [{ id: "c1", accountId: "2", personId: "p-sam", amount: 4000, period: "monthly", employerMatch: 0 }];
  const b = against(p, T);
  assert.equal(b.monthly, 4000);
  assert.ok(Math.abs(b.months - b.ahead / 4000) < 1e-9);
  assert.equal(monthlySaving(null), 0);
  assert.equal(monthlySaving({ startYear: 2026, people: [{ birthYear: 1950, retireAge: 65 }], contributions: [{ yearly: 12000, personIndex: 0 }] }), 0, "a row of someone past their retirement age no longer runs");
  assert.equal(monthlySaving({ startYear: 2026, people: [{ birthYear: 1990, retireAge: 65 }], contributions: [{ yearly: 12000, personIndex: 0 }, { yearly: 6000, personIndex: 0, untilYear: 2025 }] }), 1000);
  // nothing to say: no kept path, one too young, or no projection today
  assert.equal(against(sam(), T), null);
  assert.equal(against(withSnap({ ...SNAP, at: "2026-08-01" }), T), null);
  assert.equal(against(withSnap(SNAP, plan()), T), null, "nobody with a birth date");
});

test("#35 one sentence per case: ahead, behind, right on plan; with and without the months of saving; the plan named by its month", () => {
  const A = (ahead, months = null, at = "2025-11-13") => ({ at, ahead, side: Math.abs(ahead) < 100 ? "on" : ahead > 0 ? "ahead" : "behind", months });
  assert.equal(sentenceOf(A(12400, 3.1), T, usd), "Your savings are $12,400 ahead of where last November's plan put them, about 3 months of your usual saving.");
  assert.equal(sentenceOf(A(-8000, 2.2), T, usd), "Your savings are $8,000 behind where last November's plan put them, about 2 months of your usual saving.");
  assert.equal(sentenceOf(A(40, 0.1), T, usd), "Your savings are right where last November's plan put them.");
  assert.equal(sentenceOf(A(12400), T, usd), "Your savings are $12,400 ahead of where last November's plan put them.");
  assert.equal(sentenceOf(A(-300, 0.4), T, usd), "Your savings are $300 behind where last November's plan put them.", "under a month of saving is not said");
  assert.equal(sentenceOf(A(1500, 1), T, usd), "Your savings are $1,500 ahead of where last November's plan put them, about 1 month of your usual saving.");
  assert.equal(sentenceOf(A(90000, 31), T, usd), "Your savings are $90,000 ahead of where last November's plan put them, about 3 years of your usual saving.");
  assert.equal(sentenceOf(A(5000, null, "2026-05-02"), T, usd), "Your savings are $5,000 ahead of where this May's plan put them.");
  assert.equal(sentenceOf(A(-5000, null, "2024-12-02"), T, usd), "Your savings are $5,000 behind where your December 2024 plan put them.");
  assert.equal(planWords("2025-01-31", "2026-01-02"), "last January's plan");
  assert.equal(savingWords(23.4), ", about 23 months of your usual saving"); assert.equal(savingWords(23.6), ", about 2 years of your usual saving"); assert.equal(savingWords(null), "");
  // the status beside the title: at most 20 characters, never cut
  assert.equal(statusWords(A(12400), usd), "ahead by $12,400");
  assert.equal(statusWords(A(-8000), usd), "behind by $8,000");
  assert.equal(statusWords(A(0), usd), "on track");
  assert.equal(statusWords(A(-1234567), usd), "behind by $1,234,567");
  assert.equal(statusWords(A(-12345678), usd), "behind");
  // the real case, end to end: under 1% of the expected figure (or under $100) reads as on plan
  const on = sam(); on.accounts = [{ id: "2", name: "401k", type: "401k", balance: 13650 }];
  assert.equal(against(withSnap(SNAP, on), T).side, "on");
  const behind = sam(); behind.accounts = [{ id: "2", name: "401k", type: "401k", balance: 9000 }];
  assert.equal(against(withSnap(SNAP, behind), T).side, "behind");
  assert.doesNotMatch([sentenceOf(A(-8000, 2), T, usd), sentenceOf(A(-800000, 200), T, usd)].join(" "), /warning|danger|alert|!|off track|fail/i, "never an alarm");
});

test("#35 the page: no part without a path six months old; then one quiet row in Over time, shut, with the sentence and both figures inside", async () => {
  for (const p of [sam(), withSnap({ ...SNAP, at: "2026-06-01" })]) {
    const r = await renderPage(view, p, T, { computeOf });
    assert.equal(r.root.querySelectorAll("details").length, 0);
    assert.doesNotMatch(r.text(), /earlier plan|ahead by|behind by|on track/);
  }
  const r = await renderPage(view, withSnap(), T, { computeOf });
  const el = pathPart(r);
  assert.ok(el && !el.hasAttribute("open"), "drawn, and shut");
  assert.equal(el.dataset.kind, "how");
  assert.equal(el.querySelector(".fold-title").textContent, "Your earlier plan");
  assert.equal(el.querySelector(".fold-status").textContent, "ahead by $12,402");
  assert.equal(r.root.querySelectorAll("details").length, 1, "the one new part");
  const over = r.root.querySelectorAll("section").find((s) => s.querySelector("h2")?.textContent === "Over time");
  assert.ok(over.querySelectorAll("details").includes(el), "inside the card it belongs to");
  const body = textOf(el);
  assert.match(body, /Your savings are \$12,402 ahead of where last November's plan put them\./);
  assert.match(body, /Where that plan put you by today \$13,598/);
  assert.match(body, /Your savings today \$26,000/);
  assert.doesNotMatch(body, /balances on file|Update my balances/, "the balances carry no old day: nothing more is said");
  // balances last dated a year ago (critic M1): the line under the sentence says so, with the way to fix it, and the figure is "on file"
  const stale = withSnap(); for (const a of stale.accounts) a.asOf = "2025-11-13";
  const sb = pathPart(await renderPage(view, stale, T, { computeOf }));
  assert.match(textOf(sb), /This compares the balances on file, the oldest from November 13, 2025\. Update your balances for today's answer\./);
  assert.match(textOf(sb), /Your savings on file \$26,000/);
  assert.doesNotMatch(textOf(sb), /Your savings today/);
  assert.equal(sb.querySelectorAll("a").find((x) => x.textContent === "Update my balances")?.getAttribute("href"), "#/balance/update");
  assert.match(body, /today's dollars/);
  assert.match(body, /saved your totals on November 13, 2025/);
  assert.doesNotMatch(body, /net worth|real terms|nominal|interpolat|snapshot/i);
  assert.equal(r.saved.length, 0, "drawing it saves nothing");
});

test("#35 S11: the plan changes only on Save today's totals: that tap keeps the path once a month, and the part stays as it was; Remove takes that day's path with its totals", async () => {
  const openOf = (r) => Object.fromEntries(r.root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
  // a first save: today's totals, each account's point, and the path of today's plan
  const p = withSnap();
  const r = await renderPage(view, p, T, { computeOf });
  const before = openOf(r);
  assert.deepEqual(before, { path: false });
  pressSave(r);
  assert.equal(r.saved.length, 1);
  assert.deepEqual(openOf(r), before, "no part opened or shut by the save");
  const after = r.saved[0];
  assert.deepEqual(after.pathSnapshots.map((s) => s.at), ["2025-11-13", T]);
  assert.deepEqual(after.pathSnapshots[1], snapshotOf(migrate(structuredClone(p)), T));
  assert.equal(after.netWorthHistory.at(-1).date, T);
  // everything else in the plan is as it was
  const rest = (q) => { const c = structuredClone(q); delete c.pathSnapshots; delete c.netWorthHistory; for (const a of c.accounts) delete a.history; return c; };
  assert.deepEqual(rest(after), rest(migrate(structuredClone(p))));
  // later the same month: the totals are saved again, the path of the month stays the first one
  const again = await renderPage(view, after, "2026-11-28", { computeOf });
  pressSave(again);
  assert.deepEqual(again.saved[0].pathSnapshots, after.pathSnapshots);
  assert.equal(again.saved[0].netWorthHistory.at(-1).date, "2026-11-28");
  // a household with no projection (no birth date): the totals are saved as before and no section appears
  const none = await renderPage(view, plan(), T, { computeOf });
  pressSave(none);
  assert.equal("pathSnapshots" in none.saved[0], false);
  // Remove on a day's totals takes the path kept that day
  const realConfirm = globalThis.confirm; globalThis.confirm = () => true;
  try {
    const rm = await renderPage(view, after, "2026-12-01", { computeOf });
    rm.root.querySelectorAll("button").find((b) => b.textContent === "Remove").click();
    assert.deepEqual(rm.saved[0].pathSnapshots.map((s) => s.at), ["2025-11-13"]);
  } finally { globalThis.confirm = realConfirm; }
  await renderPage(view, after, "2026-12-01", { computeOf });   // (the page's own next draw shows the green line; no later test inherits it)
});

test("#35 invariance: with `pathSnapshots` absent the pages give the output of before; with it, no other page's compute moves", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { compute: reviewOf } = await import("../../reports/annual-review/compute.js");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder);
  const fixtures = [familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const all = [...fixtures, ...ARCHETYPES.map((a) => a.build())].map((q) => migrate(structuredClone(q)));
  const old = (q) => ({ ...structuredClone(q), pathSnapshots: [structuredClone(SNAP)] });
  const young = (q) => ({ ...structuredClone(q), pathSnapshots: [{ ...SNAP, at: "2026-08-01" }] });
  let said = 0;
  for (const q of all) {
    // Net worth's own compute never reads the section
    assert.equal(JSON.stringify(compute(old(q), { today: T })), JSON.stringify(compute(q, { today: T })));
    // the Annual review pack: no `path` key without a path six months old, and nothing else moves with one
    const base = reviewOf(q, { today: T });
    assert.equal("path" in base, false);
    assert.equal(JSON.stringify(reviewOf(young(q), { today: T })), JSON.stringify(base));
    const withOld = reviewOf(old(q), { today: T });
    if ("path" in withOld) said++;
    delete withOld.path;
    assert.equal(JSON.stringify(withOld), JSON.stringify(base));
    assert.equal("path" in reviewOf(old(q), { today: T, year: 2024 }), false, "a review of an older year is not about today");
    // the Net worth page: no part; a path kept less than six months ago adds its one line (from which day) and nothing else
    const [a, b] = [await renderPage(view, q, T, { computeOf }), await renderPage(view, young(q), T, { computeOf })];
    assert.equal(b.text().replace(/\s*From February 1, 2027, this page also says[^.]*\./, ""), a.text());
    assert.equal(a.root.querySelectorAll("details").length, 0);
    assert.equal(b.root.querySelectorAll("details").length, 0);
  }
  assert.ok(said >= 10, "the households with a projection do get the key once a path is old enough");
  // no code outside these two pages reads the section (the heavy pages included, which are not run below)
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => /pathSnapshots/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f).split(path.sep).join("/"));
  assert.deepEqual(readers.sort(), ["modules/balance/net-worth/module.js", "modules/balance/net-worth/path.js", "modules/reports/annual-review/module.js",
    "modules/system/audit/compute.js", "modules/system/backups/compute.js", "modules/system/settings/view.js"],
    "the section is read in path.js alone; the Annual review pack asks path.js; Backups and Settings only hold its name in plain words, What changed names an entry by its day");
  // every other page that is not heavy, over the four fixtures (Export, Diagnostics and Settings carry or measure the plan file
  // itself: its size, and Settings' count of each list in it, "1 plan kept to compare")
  const out = (m, q) => { try { const r = m.compute(q, { today: T }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; delete r.sections; } return JSON.stringify(r); } catch (e) { return `THROW ${e.message}`; } };
  for (const q of fixtures.map((x) => migrate(structuredClone(x)))) for (const m of mods.filter((x) => !x.heavy && !(x.group === "reports" && x.id === "export"))) assert.equal(out(m, old(q)), out(m, q), `${m.group}/${m.id}`);
});
