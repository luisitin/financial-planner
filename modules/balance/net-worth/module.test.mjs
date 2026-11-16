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

// ---- smart guesses C6 (spec 9.2, 9.4, 12.1): a balance left empty is our guess for that kind of account, counted and marked;
// a typed figure is the person's; a balance still ours reopens grey; no grey example in a box ----------------------------------
async function guessKit(today) {
  const { FakeElement, textOf, fullSelectors } = await import("../../../qa/fixtures/fake-dom.mjs");
  fullSelectors();   // the page finds its Type and Whose boxes with 'select[name="type"]'

  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const G = await import("../../overview/guesses/compute.js");
  const S = await import("../../overview/setup/compute.js");
  const E = await import("../../../core/estimate/index.js");
  const { render } = await import("./view.js");
  const REG = E.mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const O = { estimators: REG.estimators, tables: REG.tables, today };
  const draw = (plan, route = { rest: [], query: {} }) => {
    const root = new FakeElement("main"), saved = [];
    render(root, { ui, fmt: { ...fmt, today: () => today }, plan, route, modules: new Map(), computeOf: (k, prm = {}) => (k === "balance/net-worth" ? compute(plan, { today, ...prm }) : null),
      guess: (k, { plan: on, ...o } = {}) => E.estimate(on ?? plan, k, { ...O, ...o }),   // (opts.plan: a draft, as core/app.js)
      store: { get: () => plan, update(fn) { const d = structuredClone(plan); fn(d); E.settle(d, O); saved.push(d); } } });
    const form = root.all().find((e) => e.tagName === "FORM");
    if (form) form.reset = () => {};
    const box = (n) => form?.all().find((e) => e.getAttribute("name") === n) ?? null;
    const help = (n) => box(n)?.closest("label")?.all().find((e) => e.tagName === "SMALL")?.textContent ?? null;
    return { root, saved, form, box, help, text: () => textOf(root) };
  };
  return { draw, E, O, ui };
}
const C6 = "2026-11-06";
const riley = async () => (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();

test("C6: balanceGuessKey: a kind with a table, alone in its group; none for a second one, a kind with no table, or two bank accounts on Get started", async () => {
  const { balanceGuessKey, balanceGuessPath, BALANCE_GUESS } = await import("./compute.js");
  const p = emptyPlan();
  for (const [type, key] of Object.entries(BALANCE_GUESS)) assert.equal(balanceGuessKey(p, type, "new"), key, type);
  for (const type of ["hsa", "529", "crypto", "cash_value_life", "other_asset", "other_liability", "nonsense"]) assert.equal(balanceGuessKey(p, type, "new"), null, type);
  p.accounts.push({ id: "c1", name: "Checking", type: "checking", balance: 900 }, { id: "car1", name: "Car", type: "vehicle", balance: 9000 }, { id: "r1", name: "Roth", type: "roth", balance: 3000 });
  assert.equal(balanceGuessKey(p, "savings", "new"), null, "a bank account is on file: the survey's figure is the household's whole bank balance");
  assert.equal(balanceGuessKey(p, "checking", "c1"), "account.cash", "the account being edited is not another one");
  assert.equal(balanceGuessKey(p, "ira", "new"), null, "IRAs and Roths are one figure");
  assert.equal(balanceGuessKey(p, "vehicle", "new"), "account.car.value", "a second car is worth what a car is worth");
  assert.equal(balanceGuessKey(p, "401k", "new"), "account.retire.balance");
  const q = emptyPlan(); q.guide = { setup: { picks: { have: ["checking", "savings"] } } };
  assert.equal(balanceGuessKey(q, "checking", "new"), null, "Get started shares one bank figure between the two");
  const r = emptyPlan(); r.household.people = [{ id: "pa", name: "Pat", role: "self" }, { id: "pb", name: "Lee", role: "spouse" }];
  assert.equal(balanceGuessPath(r, "401k", "n1", "pb"), "accounts[setup-have-retire-pb].balance");
  assert.equal(balanceGuessPath(r, "ira", "n1", ""), "accounts[setup-have-retire-pa].balance", "both of us: the first adult, as the plan reads it");
  assert.equal(balanceGuessPath(r, "brokerage", "n1", "pb"), "accounts[n1].balance");
});

test("C6 9.2: a 401(k) added with its balance empty: our guess grey, saved as our guess, counted and marked, said in the green line", async () => {
  const { draw, E, O, ui } = await guessKit(C6);
  const p = await riley();
  p.accounts = p.accounts.filter((a) => a.id !== "k401");
  const pg = draw(p, { rest: [], query: { add: "investment" } });
  pg.box("type").value = "401k"; pg.box("type").dispatch("change");
  const est = E.estimate(p, "account.retire.balance", { ...O, path: "accounts[setup-have-retire-setup-self].balance" });
  assert.ok(est.value > 1000, String(est.value));
  assert.equal(pg.box("balance").getAttribute("placeholder"), ui.guessText(est, "money"));
  assert.equal(pg.box("balance").hasAttribute("required"), false);
  assert.match(pg.help("balance"), /^Our guess: typical in a work plan at 24/);
  pg.box("name").value = "Work 401(k)";
  pg.form.dispatch("submit");
  const d = pg.saved.at(-1), a = d.accounts.find((x) => x.name === "Work 401(k)");
  assert.equal(a.type, "401k");
  assert.equal(a.balance, est.value);
  assert.equal(d.guesses[`accounts[${a.id}].balance`].k, "account.retire.balance");
  assert.ok(E.isGuess(d, `accounts[${a.id}].balance`));
  // counted, and the page says how much of it is ours
  const c = compute(d, { today: C6 });
  assert.equal(c.guessedAssets, est.value);
  const again = draw(d);
  assert.match(again.text(), new RegExp(`Work 401\\(k\\) added\\. Its balance is our guess for now: about \\$${ui.guessText(est, "money").replace(/,/g, ",")}\\.`));
  assert.match(again.text(), /Our guess for now\. Tap Edit to type the real one\./);
});

test("C6: typed equal to our guess is the person's; a balance still ours reopens grey and saves unchanged; typed over, it is theirs", async () => {
  const { draw, E, O, ui } = await guessKit(C6);
  const p = await riley();
  p.accounts = p.accounts.filter((a) => a.id !== "k401");
  const est = E.estimate(p, "account.retire.balance", { ...O, path: "accounts[setup-have-retire-setup-self].balance" });
  const typed = draw(p, { rest: [], query: { add: "401k" } });
  typed.box("name").value = "Plan"; typed.box("balance").value = String(est.value); typed.form.dispatch("submit");
  const t = typed.saved.at(-1), ta = t.accounts.find((x) => x.name === "Plan");
  assert.equal(ta.balance, est.value);
  assert.equal(t.guesses?.[`accounts[${ta.id}].balance`], undefined, "typed equal to ours: the person's");
  const blank = draw(p, { rest: [], query: { add: "401k" } });
  blank.box("name").value = "Plan"; blank.form.dispatch("submit");
  const ours = blank.saved.at(-1), id = ours.accounts.find((x) => x.name === "Plan").id;
  // reopened: the box is empty with the figure the plan counts grey in it
  const re = draw(ours, { rest: [], query: { edit: id } });
  assert.equal(re.box("balance").getAttribute("value") ?? "", "");
  assert.equal(re.box("balance").getAttribute("placeholder"), ui.guessText({ value: ours.accounts.find((x) => x.id === id).balance }, "money"));
  assert.match(re.text(), /This balance is our guess for now\. Type the real one; left empty, it stays our guess\./);
  re.form.dispatch("submit");
  const same = re.saved.at(-1);
  assert.equal(same.accounts.find((x) => x.id === id).balance, ours.accounts.find((x) => x.id === id).balance);
  assert.deepEqual(same.guesses[`accounts[${id}].balance`], ours.guesses[`accounts[${id}].balance`], "the same guess, its date kept");
  assert.deepEqual(same.accounts.find((x) => x.id === id).history, [], "a guess puts no point in the history");
  const over = draw(ours, { rest: [], query: { edit: id } });
  over.box("balance").value = "31,000"; over.form.dispatch("submit");
  const mine = over.saved.at(-1);
  assert.equal(mine.accounts.find((x) => x.id === id).balance, 31000);
  assert.equal(mine.guesses?.[`accounts[${id}].balance`], undefined);
});

test("C6: a loan added with what is owed left empty is our guess of a typical balance; a second card gets no guess (it would count twice)", async () => {
  const { draw, E, O, ui } = await guessKit(C6);
  const p = await riley();
  const pg = draw(p, { rest: [], query: { add: "student_loan" } });
  const est = E.estimate(p, "debt.student.owed", { ...O, path: `accounts[x].balance` });
  assert.ok(est && est.value > 0);
  assert.equal(pg.box("balance").getAttribute("placeholder"), ui.guessText(est, "money"));
  pg.box("name").value = "School loan"; pg.form.dispatch("submit");
  const d = pg.saved.at(-1), a = d.accounts.find((x) => x.name === "School loan");
  assert.equal(a.balance, est.value);
  assert.equal(d.guesses[`accounts[${a.id}].balance`].k, "debt.student.owed");
  assert.equal(compute(d, { today: C6 }).guessedLiabilities, est.value);
  // Riley has cards on file: a new card's balance is asked, as before (required, no grey figure)
  const card = draw(p, { rest: [], query: { add: "credit" } });
  assert.equal(card.box("balance").getAttribute("placeholder"), null);
  assert.equal(card.box("balance").hasAttribute("required"), true);
  // picking another kind under Type: the grey figure follows it
  card.box("type").value = "student_loan"; card.box("type").dispatch("change");
  assert.equal(card.box("balance").getAttribute("placeholder"), ui.guessText(est, "money"));
  card.box("type").value = "hsa"; card.box("type").dispatch("change");
  assert.equal(card.box("balance").getAttribute("placeholder"), null);
  assert.equal(card.box("balance").hasAttribute("required"), true);
});

test("C6: no guess for a file's account on Import, outside the U.S., or with no estimator; no grey example in any box", async () => {
  const { draw } = await guessKit(C6);
  const p = await riley();
  p.accounts = p.accounts.filter((a) => a.id !== "k401");
  const imp = draw(p, { rest: [], query: { add: "401k", from: "import", name: "Work plan" } });
  assert.equal(imp.box("balance").getAttribute("placeholder"), null);
  assert.match(imp.text(), /Not sure now\? Leave it empty: it is added at \$0/);
  const away = structuredClone(p); away.guide.setup.outsideUS = true;
  assert.equal(draw(away, { rest: [], query: { add: "401k" } }).box("balance").getAttribute("placeholder"), null);
  for (const add of ["debt", "credit", "loan", "mortgage", "student_loan", "property", "vehicle", "checking", "savings", "investment", "belonging"]) {
    const pg = draw(emptyPlan(), { rest: [], query: { add } });
    const name = pg.box("name");
    assert.equal(name.getAttribute("placeholder"), null, `${add}: the name box shows no grey example`);
    assert.match(pg.help("name"), /^For example, /, add);
  }
  assert.match(draw(emptyPlan(), { rest: [], query: { add: "debt" } }).help("name"), /^For example, Visa card or Car loan\.$/);
});

test("C6 invariance: with no guess offered (no ctx.guess), the add form saves exactly as before", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(view, onePerson(), T, { computeOf, route: { rest: [], query: { add: "savings" } } });
  const form = r.root.querySelectorAll("form")[0];
  form.querySelector('[name="name"]').value = "Rainy day"; form.querySelector('[name="balance"]').value = "2500";
  form.reset = () => {};
  form.dispatch("submit");
  const a = r.saved.at(-1).accounts.at(-1);
  assert.deepEqual([a.name, a.type, a.balance, a.guesses], ["Rainy day", "savings", 2500, undefined]);
  assert.equal(r.saved.at(-1).guesses, undefined);
  assert.equal(form.querySelector('[name="balance"]').hasAttribute("required"), true);
});

// ---- C6 review fixes (2026-11-14) -------------------------------------------------------------------------------------------
test("C6 fix F2: on Edit, a balance the person typed is never swapped for ours: no grey figure, the box stays required", async () => {
  const { draw } = await guessKit(C6);
  const p = await riley();
  p.accounts.find((a) => a.id === "k401").balance = 52000;
  for (const id of ["setup-have-car", "k401"]) {
    const pg = draw(p, { rest: [], query: { edit: id } });
    const box = pg.box("balance");
    assert.equal(box.getAttribute("placeholder"), null, `${id}: no grey figure over a typed balance`);
    assert.equal(box.hasAttribute("required"), true, `${id}: cleared, it is refused as before C6, never our guess`);
    assert.equal(box.hasAttribute("data-guess"), false);
    // another kind picked under Type: still none (the balance on file is the person's)
    pg.box("type").value = "brokerage"; pg.box("type").dispatch("change");
    assert.equal(box.getAttribute("placeholder"), null);
    // cleared and sent anyway (a page with no browser check): nothing is marked as ours
    box.value = ""; pg.form.dispatch("submit");
    assert.equal(pg.saved.at(-1)?.guesses?.[`accounts[${id}].balance`], undefined);
  }
});

test("C6 fix F3: typing over our guess is never asked about as a typing slip of it (nobody typed it)", async () => {
  const { draw } = await guessKit(C6);
  const p = await riley();
  p.accounts = p.accounts.filter((a) => a.id !== "k401");
  const blank = draw(p, { rest: [], query: { add: "401k" } });
  blank.box("name").value = "Plan"; blank.form.dispatch("submit");
  const ours = blank.saved.at(-1), a = ours.accounts.find((x) => x.name === "Plan");
  const ten = String(Math.round(a.balance) * 10);   // one digit added: what the slip check asks about
  const over = draw(ours, { rest: [], query: { edit: a.id } });
  over.box("balance").value = ten; over.form.dispatch("submit");
  assert.doesNotMatch(over.text(), /typing slip/);
  assert.equal(over.saved.length, 1, "saved at once");
  assert.equal(over.saved.at(-1).accounts.find((x) => x.id === a.id).balance, Number(ten));
  assert.equal(over.saved.at(-1).guesses?.[`accounts[${a.id}].balance`], undefined, "now the person's");
  // a typed balance is still asked about (as before)
  const q = structuredClone(over.saved.at(-1));
  const again = draw(q, { rest: [], query: { edit: a.id } });
  again.box("balance").value = String(Number(ten) * 10); again.form.dispatch("submit");
  assert.match(again.text(), /typing slip/);
});

test("C6 fix P1/P6: when every balance is ours the hero says it is a rough start from our guesses, not Partly; the name box's example names no real bank", async () => {
  const { draw } = await guessKit(C6);
  const first = draw(emptyPlan());
  assert.equal(first.help("name"), "For example, Main checking.");
  assert.doesNotMatch(first.text(), /Chase/);
  assert.equal(draw(emptyPlan(), { rest: [], query: { add: "checking" } }).help("name"), "For example, Main checking.", "opened as ?add=checking too");
  first.box("name").value = "My checking"; first.form.dispatch("submit");
  const d = first.saved.at(-1);
  assert.ok(d.accounts[0].balance > 0, "our guess of a bank balance, counted");
  assert.match(draw(d).text(), /A rough start, from our guesses\. Type the real balances below\./);
  // one typed account beside it: partly
  const q = structuredClone(d); q.accounts.push({ id: "car", name: "Car", type: "vehicle", balance: 1000, asOf: C6, history: [] });
  assert.match(draw(q).text(), /Partly our guesses\. Type the real balances below\./);
});

test("C6 fix F6: the guess helpers read malformed stored data without throwing", async () => {
  const { balanceGuessKey, balanceGuessPath } = await import("./compute.js");
  assert.equal(balanceGuessKey({ accounts: "x" }, "ira", "x"), "account.ira.balance");
  assert.equal(balanceGuessKey({ accounts: [null, 5, "y"] }, "checking", "x"), "account.cash");
  assert.equal(balanceGuessKey(null, "checking"), "account.cash");
  assert.equal(balanceGuessPath({ household: { people: [null] } }, "401k", "a"), "accounts[a].balance");
  assert.equal(balanceGuessPath({ household: { people: "x" } }, "ira", "a"), "accounts[a].balance");
  assert.equal(balanceGuessPath({ household: { people: [{ id: 7, role: "self" }] } }, "roth", "a"), "accounts[a].balance");
  assert.equal(balanceGuessPath(undefined, "401k", "a"), "accounts[a].balance");
});

// ---- C6 review round 2 (2026-11-14) -----------------------------------------------------------------------------------------
const couple = () => { const p = emptyPlan(); p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1975-03-01" }, { id: "b", name: "Bo", role: "spouse", birthDate: "1995-03-01" }]; p.household.state = "TX"; p.income.push({ id: "i1", name: "Pay", type: "salary", amount: 7000, period: "monthly", ownerId: "a" }); return p; };
const single = () => { const p = emptyPlan(); p.household.people = [{ id: "s", name: "Sam", role: "self", birthDate: "1990-01-01" }]; p.household.state = "NY"; return p; };
const esc = (t) => t.replace(/[$.,()]/g, (c) => `\\${c}`);

test("C6 round 2 F1: for every kind, the grey figure is what the plan counts once saved (a home for a household that owned none included), and the green line says that figure", async () => {
  const { draw, ui } = await guessKit(C6);
  const { BALANCE_GUESS } = await import("./compute.js");
  let checked = 0;
  for (const [who, mk] of [["couple", couple], ["single", single], ["blank", emptyPlan]]) {
    for (const kind of Object.keys(BALANCE_GUESS)) {
      const pg = draw(mk(), { rest: [], query: { add: kind } });
      const grey = pg.box("balance").getAttribute("placeholder");
      if (!grey) continue;
      checked++;
      pg.box("name").value = "It"; pg.form.dispatch("submit");
      const d = pg.saved.at(-1), a = d.accounts.find((x) => x.name === "It");
      assert.equal(ui.guessText({ value: a.balance, unit: "total" }, "money"), grey, `${who} ${kind}: grey ${grey}, counted ${a.balance} after the save`);
      assert.equal(d.guesses[`accounts[${a.id}].balance`].v, a.balance);
      assert.match(draw(d).text(), new RegExp(esc(`Its balance is our guess for now: about $${grey}.`)), `${who} ${kind}: the line says the figure counted`);
    }
  }
  assert.ok(checked >= 30, `kinds checked: ${checked}`);
  // the case the review found: a home for a couple in Texas who own none (grey 330,000 then, 270,000 counted)
  const home = draw(couple(), { rest: [], query: { add: "property" } });
  assert.equal(home.box("balance").getAttribute("placeholder"), "270,000");
  // the spouse's 401(k): the grey figure follows Whose account, and is what is counted
  const k = draw(couple(), { rest: [], query: { add: "investment" } });
  k.box("type").value = "401k"; k.box("type").dispatch("change");
  const self401 = k.box("balance").getAttribute("placeholder");
  k.box("ownerId").value = "b"; k.box("ownerId").dispatch("change");
  const g401 = k.box("balance").getAttribute("placeholder");
  assert.notEqual(g401, self401, "Bo's is his own (he is younger)");
  k.box("name").value = "Bo 401(k)"; k.form.dispatch("submit");
  assert.equal(ui.guessText({ value: k.saved.at(-1).accounts.find((x) => x.name === "Bo 401(k)").balance, unit: "total" }, "money"), g401);
});

test("C6 round 2 P2: Edit of a bank balance of ours says the same why as Add did, and the guess still follows the household (it was frozen)", async () => {
  const { draw, E, O } = await guessKit(C6);
  const add = draw(emptyPlan());
  const why = add.help("balance");
  assert.match(why, /^Our guess: a typical bank balance\./);
  add.box("name").value = "Main checking"; add.form.dispatch("submit");
  const d = add.saved.at(-1), a = d.accounts[0];
  const edit = draw(d, { rest: [], query: { edit: a.id } });
  assert.equal(edit.help("balance"), why, "not 'what we filled in for now'");
  assert.equal(edit.box("balance").getAttribute("placeholder"), add.box("balance").getAttribute("placeholder"));
  // read with itself taken out, the estimator gives a figure: told an age and an income, the guess moves with them (settle)
  const told = structuredClone(d);
  told.household.people = [{ id: "s", name: "Sam", role: "self", birthDate: "1960-01-01" }];
  told.income.push({ id: "i", name: "Pay", type: "salary", amount: 15000, period: "monthly", ownerId: "s" });
  E.settle(told, O);
  assert.ok(E.isGuess(told, `accounts[${a.id}].balance`), "still our guess");
  assert.notEqual(told.accounts[0].balance, a.balance, "it followed the answers instead of staying frozen");
  assert.equal(told.accounts[0].balance, E.estimate(told, "account.cash", { ...O, path: `accounts[${a.id}].balance` }).value);
});

test("C6 round 2 P5: a typed balance cleared on Edit asks for it with the way back in view", async () => {
  const { draw } = await guessKit(C6);
  const fmt = await import("../../../core/format.js");
  const p = await riley();
  const pick = p.accounts.find((a) => (a.type === "savings" || a.type === "checking") && !(p.guesses ?? {})[`accounts[${a.id}].balance`]);
  const pg = draw(p, { rest: [], query: { edit: pick.id } });
  assert.equal(pg.box("balance").hasAttribute("required"), true);
  assert.equal(pg.box("balance").dataset.missing, `Type the balance, or tap Cancel to keep ${fmt.money(Math.abs(pick.balance), "USD")}.`);
  const debt = p.accounts.find((a) => a.type === "credit" && !(p.guesses ?? {})[`accounts[${a.id}].balance`]);
  assert.match(draw(p, { rest: [], query: { edit: debt.id } }).box("balance").dataset.missing, /^Type the amount owed, or tap Cancel to keep \$[\d,.]+\.$/);
  // a balance of ours, or a new account, has no such words (the box is not asked that way)
  assert.equal(draw(emptyPlan()).box("balance").dataset.missing, undefined);
});

// ---------------------------------------------------------------- your own labels (gap list, next 60, item 44)
const L = await import("./labels.js");
const { labelTotals } = await import("./compute.js");
const { labelLine } = await import("./view.js");
const money0 = (n) => (n < 0 ? `-$${Math.round(-n).toLocaleString("en-US")}` : `$${Math.round(n).toLocaleString("en-US")}`);
const labelled = () => { const p = plan(); p.accounts[0].labels = ["kids"]; p.accounts[2].labels = ["kids", "retirement"]; p.accounts[1].labels = ["Retirement"]; p.accounts[5].labels = ["car"]; p.accounts[3].labels = ["car"]; return p; };

test("labels: typed with commas, spaces squeezed, the same label once (capitals not counted), nothing cut; picked spellings win", () => {
  assert.deepEqual(L.cleanLabels("kids,  Retirement ,, Kids "), ["kids", "Retirement"]);
  assert.deepEqual(L.cleanLabels(["a  b", "A B", "", null, 7]), ["a b", "7"]);
  assert.deepEqual(L.cleanLabels(""), []);
  assert.deepEqual(L.cleanLabels(undefined), []);
  assert.deepEqual(L.labelsOf({ labels: "kids" }), [], "stored data that is not a list reads as none");
  assert.deepEqual(L.labelsOf({ labels: ["kids", "KIDS", " x "] }), ["kids", "x"]);
  assert.ok(L.sameLabel("Kids ", "kids") && !L.sameLabel("kid", "kids"));
  assert.ok(L.hasLabel({ labels: ["Kids"] }, "kids") && !L.hasLabel({}, "kids") && !L.hasLabel(null, "kids"));
  assert.deepEqual(L.labelsIn([{ labels: ["retirement", "kids"] }], [{ labels: ["Kids", "car"] }, null]), ["car", "kids", "retirement"]);
  assert.deepEqual(L.planLabels(labelled()), ["car", "kids", "Retirement"], "the first spelling met: the 401k's 'Retirement' (accounts in order), not the Roth's");
  assert.deepEqual(L.spellAs(["Kids", "college"], ["kids", "car"]), ["kids", "college"]);
  assert.equal(L.tooLong("kids, " + "x".repeat(31)), "x".repeat(31));
  assert.equal(L.tooLong("x".repeat(30)), null);
  assert.equal(L.LABEL_MAX, 30);
  assert.equal(L.labelChange(["kids"], ["Kids"]), null);
  assert.equal(L.labelChange(["kids", "car"], ["car", "kids"]), null);
  assert.deepEqual(L.labelChange([], ["kids"]), ["kids"]);
  assert.deepEqual(L.labelChange(["kids"], []), []);
  assert.equal(L.labelWords(null), "");
  assert.equal(L.labelWords([]), "No labels now.");
  assert.equal(L.labelWords(["kids"]), "Label: kids.");
  assert.equal(L.labelWords(["kids", "college"]), "Labels: kids, college.");
  assert.equal(L.toggleIn("kids", "car"), "kids, car");
  assert.equal(L.toggleIn("kids, Car", "car"), "kids");
  assert.equal(L.toggleIn("", "kids"), "kids");
});

test("a label over 30 letters is held back with plain words, one or several typed (critic P7)", async () => {
  const { readLabels } = await import("./labels-view.js");
  const words = "Keep each label to 30 letters or fewer. Separate two labels with a comma.";
  assert.deepEqual(readLabels("this label is far far too long for one chip on a phone", []), { error: words });
  assert.deepEqual(readLabels("kids, " + "x".repeat(31), []), { error: words });
  assert.deepEqual(readLabels("Kids, college", ["kids"]), { list: ["kids", "college"] });
});

test("labelTotals and its sentence, one per case: things owned, debts only, both", () => {
  const p = labelled();
  const kids = labelTotals(p, "KIDS");
  assert.deepEqual([kids.count, kids.assets, kids.liabilities, kids.net, kids.hasAssets, kids.hasDebts], [2, 6000, 0, 6000, true, false]);
  assert.deepEqual(kids.ids, ["1", "3"]);
  assert.equal(labelLine(kids, money0), "2 accounts labeled KIDS: $6,000.");
  const car = labelTotals(p, "car");
  assert.deepEqual([car.count, car.assets, car.liabilities, car.net], [2, 8000, 3000, 5000], "a debt counts as owed, whatever sign was typed");
  assert.equal(labelLine(car, money0), "2 accounts labeled car: $8,000 owned, $3,000 owed, $5,000 in all.");
  const q = plan(); q.accounts[4].labels = ["cards"];
  assert.equal(labelLine(labelTotals(q, "cards"), money0), "1 account labeled cards: $500 owed.");
  const r = plan(); r.accounts[4].labels = ["x"]; r.accounts[0].labels = ["x"]; r.accounts[0].balance = 100;
  assert.equal(labelLine(labelTotals(r, "x"), money0), "2 accounts labeled x: $100 owned, $500 owed, -$400 in all.");
  assert.equal(labelTotals(emptyPlan(), "x").count, 0);
});

test("invariance: no label anywhere, every compute output as before; labels on accounts change no figure of compute()", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  for (const p of [plan(), familyPlan(T), ...ARCHETYPES.map((a) => a.build())]) {
    const a = JSON.stringify(compute(p, { today: T }));
    const q = structuredClone(p);
    for (const [i, x] of (q.accounts ?? []).entries()) x.labels = i % 2 ? ["kids"] : ["retirement", "car"];
    assert.equal(JSON.stringify(compute(q, { today: T })), a);
  }
});

const nwView = async (p, query = {}) => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(view, p, T, { computeOf, route: { rest: [], query } });
  const btn = (words) => r.root.querySelectorAll("button").find((b) => textOf(b) === words);
  const rows = () => r.root.querySelectorAll(".records").filter((u) => u.classList.contains("only-narrow"))[0]?.children ?? [];
  return { ...r, textOf, btn, rows };
};
const submit = (form, typed) => { for (const [k, v] of Object.entries(typed)) form.querySelector(`[name="${k}"]`).value = v; form.reset = () => {}; form.dispatch("submit"); };

test("labels on the form: not asked on the first account; then under More details (optional) with a chip for each label used", async () => {
  const first = await nwView(emptyPlan());
  assert.equal(first.root.querySelector('[name="labelsText"]'), null, "the empty page's form is as it was");
  const r = await nwView(labelled(), { add: "savings" });
  const box = r.root.querySelector('[name="labelsText"]');
  assert.ok(box && box.closest("details")?.classList.contains("form-more"));
  const picks = r.root.all().find((e) => e.dataset?.labelPicks !== undefined);
  assert.equal(r.textOf(picks), "Or tap one you already use: car kids Retirement");
  // a chip adds its label to the box, a second tap takes it out
  const chip = picks.querySelectorAll("button").find((b) => r.textOf(b) === "kids");
  chip.click(); assert.equal(box.value, "kids"); assert.equal(chip.getAttribute("aria-pressed"), "true");
  picks.querySelectorAll("button").find((b) => r.textOf(b) === "car").click(); assert.equal(box.value, "kids, car");
  chip.click(); assert.equal(box.value, "car"); assert.equal(chip.getAttribute("aria-pressed"), "false");
});

test("the label save: a new account keeps the plan's spelling and says its labels; Edit shows them, empties them, says so", async () => {
  const r = await nwView(labelled(), { add: "savings" });
  submit(r.root.querySelector("form"), { name: "College fund", balance: "2500", labelsText: "Kids,  college" });
  const added = r.saved.at(-1).accounts.at(-1);
  assert.deepEqual(added.labels, ["kids", "college"]);
  assert.ok(!("labelsText" in added));
  const shown = await nwView(r.saved.at(-1));
  assert.match(shown.text(), /College fund added\. Labels: kids, college\./);
  // Edit: the box holds them (its line opens by itself); emptied, the field goes
  const e = await nwView(r.saved.at(-1), { edit: added.id });
  const box = e.root.querySelector("form").querySelector('[name="labelsText"]');
  assert.equal(box.value, "kids, college");
  assert.ok(box.closest("details").hasAttribute("open"));
  submit(e.root.querySelector("form"), { labelsText: "" });
  const back = e.saved.at(-1).accounts.find((a) => a.id === added.id);
  assert.ok(!("labels" in back));
  assert.match((await nwView(e.saved.at(-1))).text(), /College fund saved\. No labels now\./);
  // saved with the same labels: no word about them
  const same = await nwView(labelled(), { edit: "1" });
  submit(same.root.querySelector("form"), {});
  assert.match((await nwView(same.saved.at(-1))).text(), /Checking saved\.(?! Label)/);
});

test("invariance of the form: the labels box left empty writes the record it wrote before (no labels, no labelsText)", async () => {
  const r = await nwView(plan(), { add: "savings" });
  submit(r.root.querySelector("form"), { name: "Rainy day", balance: "2500" });
  const a = r.saved.at(-1).accounts.at(-1);
  assert.deepEqual(Object.keys(a).sort(), ["asOf", "balance", "history", "id", "institution", "name", "ownerId", "type"].sort());
  // and on Edit of an account with no labels, nothing new is written
  const e = await nwView(plan(), { edit: "2" });
  submit(e.root.querySelector("form"), { balance: "21000" });
  const k = e.saved.at(-1).accounts.find((x) => x.id === "2");
  assert.ok(!("labels" in k) && !("labelsText" in k));
});

test("a label over 30 characters is held back at Save with words; nothing is saved", async () => {
  const r = await nwView(labelled(), { add: "savings" });
  submit(r.root.querySelector("form"), { name: "X", balance: "1", labelsText: "kids, " + "y".repeat(31) });
  assert.equal(r.saved.length, 0);
});

test("the filter: chips only once an account has a label; a tap lists only that label's accounts and its subtotal, writes nothing, and the top figures stay", async () => {
  const none = await nwView(plan());
  assert.equal(none.root.all().find((e) => e.dataset?.labelFilter !== undefined), undefined, "no label: no chip, the page as it was");
  const r = await nwView(labelled());
  const filter = r.root.all().find((e) => e.dataset?.labelFilter !== undefined);
  assert.equal(r.textOf(filter), "All accounts car kids Retirement");
  assert.equal(r.rows().length, 6);
  const top = r.textOf(r.root.querySelector(".stat"));
  r.btn("car").click();
  assert.equal(r.saved.length, 0, "never the plan");
  assert.deepEqual(r.rows().map((li) => r.textOf(li.querySelector(".rec-title"))), ["Car", "Car loan"]);
  assert.match(r.text(), /2 accounts labeled car: \$8,000 owned, \$3,000 owed, \$5,000 in all\./);
  assert.equal(r.textOf(r.root.querySelector(".stat")), top, "net worth is still the whole plan's");
  assert.equal(r.btn("car").getAttribute("aria-pressed"), "true");
  r.btn("Retirement").click();
  assert.deepEqual(r.rows().map((li) => r.textOf(li.querySelector(".rec-title"))), ["401k", "Roth"], "capitals not counted: the Roth's 'retirement' too");
  assert.match(r.text(), /2 accounts labeled Retirement: \$25,000\./);
  r.btn("All accounts").click();
  assert.equal(r.rows().length, 6);
  assert.doesNotMatch(r.text(), /labeled/);
  // the labels show on the rows, quietly
  assert.match(r.textOf(r.rows().find((li) => r.textOf(li.querySelector(".rec-title")) === "Roth")), /kids retirement$/);
});

// ---- One figure or item by item (gap list, next 60, item 11; README "One figure or item by item") ---------------------------
import * as OF from "./one-figure.js";
import { buildInputs, compute as retirementOf } from "../../retirement/projection/compute.js";
import { accountPerformance } from "../../investments/performance/compute.js";
const usd2 = (n) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
// the Garcia-Lee family (qa fixture) with two more savings accounts beside Ally (which a goal draws on), one with a history
const savers = () => {
  const p = migrate(familyPlan(T));
  p.accounts.push({ id: "sv2", name: "Holiday fund", type: "savings", institution: "Ally", balance: 2400, asOf: "2026-10-01", ownerId: "", history: [{ date: "2026-09-01", balance: 2000 }, { date: "2026-10-01", balance: 2300 }], notes: "for December" },
    { id: "sv3", name: "Old savings", type: "savings", institution: "Ally", balance: 800, asOf: "2026-09-01", typedOn: "2026-09-02", ownerId: "", history: [{ date: "2026-10-01", balance: 790 }] });
  return p;
};
// a live page: the same route object across redraws (as the shell after a save), the store's plan moving on each update
async function live(p0, query = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(p0)), updates = 0;
  const route = { rest: [], query };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; updates++; } };
  let root = null;
  const draw = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => T }, plan: cur, route, store, modules: new Map(), computeOf: (k, prm = {}) => (k === "balance/net-worth" ? compute(cur, { today: T, ...prm }) : null) }); return api; };
  const partEl = () => root.querySelectorAll("details").find((x) => x.dataset.part === "asOne") ?? null;
  const api = { draw, textOf, partEl, get plan() { return cur; }, get updates() { return updates; }, get root() { return root; },
    btn: (words, inside = root) => inside.querySelectorAll("button").find((b) => textOf(b) === words) ?? null,
    text: () => textOf(root), partText: () => textOf(partEl()) };
  return draw();
}

test("one figure: a kind is one kind of account of one owner, named in plain words; the mortgage, a home, a car, the HSA and college savings are never one figure", () => {
  const p = migrate(familyPlan(T));
  p.household.people.push({ id: "p-me", name: "Me", role: "self" });
  assert.equal(OF.sectionKey({ type: "savings" }), "savings||0|");
  assert.equal(OF.sectionKey({ type: "401k", ownerId: "p-ana", formerJob: true }), "401k|p-ana|1|");
  for (const type of ["mortgage", "property", "vehicle", "hsa", "529", "other_asset", "cash_value_life", "nonsense"]) assert.equal(OF.sectionKey({ type }), null, type);
  const name = (type, owner = "", past = 0) => OF.sectionName(p, `${type}|${owner}|${past}`);
  assert.deepEqual([name("checking"), name("savings"), name("cash"), name("brokerage"), name("crypto"), name("credit"), name("loan"), name("student_loan"), name("other_liability")],
    ["Checking", "Savings", "Cash", "Investments", "Crypto", "Credit cards", "Loans", "Student loans", "Other debts"]);
  assert.deepEqual([name("401k", "p-ana"), name("401k", "p-ana", 1), name("ira", "p-bo"), name("roth", "p-me"), name("401k"), name("ira"), name("savings", "p-ana"), name("roth", "someone-gone")],
    ["Ana's 401(k)", "Ana's 401(k), from former jobs", "Bo's traditional IRA", "My Roth", "401(k)", "Traditional IRA", "Ana's savings", "Roth"]);
  assert.equal(OF.sectionNoun(p, "savings||0|"), "your savings accounts");
  assert.equal(OF.sectionNoun(p, "401k|p-ana|1|"), "Ana's 401(k) accounts from former jobs");
  // the words other pages read in a name are part of the kind: an old job's 401(k), a Roth through work, a 457 or TSP, a car loan
  const k = (a) => OF.sectionKey(a);
  assert.deepEqual([k({ type: "401k", name: "Old job 401(k)" }), k({ type: "401k", name: "Rollover from Acme" }), k({ type: "401k", name: "TSP" }), k({ type: "roth", name: "Roth 401(k)" }), k({ type: "roth", name: "Roth IRA" }), k({ type: "ira", name: "Prior IRA" }), k({ type: "loan", name: "Car loan" }), k({ type: "loan", name: "Loan", institution: "Ally Auto" }), k({ type: "loan", name: "Personal loan" }), k({ type: "savings", name: "Old savings" })],
    ["401k||0|o", "401k||0|o", "401k||0|t", "roth||0|w", "roth||0|", "ira||0|o", "loan||0|c", "loan||0|c", "loan||0|", "savings||0|"]);
  assert.deepEqual(["401k||0|o", "401k|p-ana|0|t", "roth|p-bo|0|w", "loan||0|c", "loan||0|"].map((x) => OF.sectionName(p, x)),
    ["401(k), from former jobs", "Ana's 401(k), a 457, TSP or thrift plan", "Bo's Roth through work", "Car loans", "Loans"]);
});

test("one figure: listed with two rows or a mark; the row kept is the one marked, else Get started's, else the biggest free one; the rest join or stay on their own", () => {
  const p = savers();
  assert.deepEqual(OF.sectionsOf(migrate(familyPlan(T))).map((s) => s.key), [], "the family as it is: one row of each kind");
  const [s] = OF.sectionsOf(p);
  assert.equal(s.name, "Savings");
  assert.deepEqual([s.count, s.total, s.together, s.keep, s.join, s.mode, s.changes], [3, 14700, 3200, "sv2", ["sv3"], "items", true]);
  assert.deepEqual(s.held, [{ id: "a-sav", name: "Ally savings", why: "a goal draws on it" }]);
  // Get started's row is kept before a bigger one
  const g = savers(); g.accounts.push({ id: "setup-have-savings", name: "Savings", type: "savings", balance: 100, ownerId: "" });
  assert.equal(OF.sectionsOf(g)[0].keep, "setup-have-savings");
  // the row marked is kept; marked and alone (the others stay on their own) is "one"
  const m = savers(); m.accounts.find((a) => a.id === "sv3").oneFigure = true;
  assert.equal(OF.sectionsOf(m)[0].keep, "sv3");
  assert.equal(OF.sectionsOf(m)[0].mode, "items", "a free row beside the mark: listed item by item");
  const one = savers(); OF.asOne(one, "savings||0|", T);
  const after = OF.sectionsOf(one)[0];
  assert.deepEqual([after.mode, after.count, after.kept, after.changes], ["one", 2, 3200, true]);
  // all: every kind with a row, for the page's own list of what was just changed
  assert.ok(OF.sectionsOf(migrate(familyPlan(T)), { all: true }).length >= 6);
});

test("one figure: each reason a row stays on its own, one sentence each", () => {
  const base = () => { const p = emptyPlan(); p.household.people = [{ id: "p-ana", name: "Ana", role: "self" }]; p.accounts.push({ id: "k", name: "Main", type: "checking", balance: 900 }, { id: "x", name: "Spare", type: "checking", balance: 100 }); return p; };
  const why = (edit) => { const p = base(); edit(p); const s = OF.sectionsOf(p)[0]; return s.held.map(OF.holdWords); };
  const cases = [
    [(p) => { p.transactions = [{ id: "t", accountId: "x", amount: -5 }]; }, "it has bank lines in your ledger"],
    [(p) => { p.imports = [{ id: "i", accountId: "x" }]; }, "bank files were imported into it"],
    [(p) => { p.holdings = [{ id: "h", accountId: "x" }]; }, "it has investments listed in it"],
    [(p) => { p.reconciliations = [{ id: "r", accountId: "x" }]; }, "its statements were checked against it"],
    [(p) => { p.rules = [{ id: "r", accountId: "x" }]; }, "a rule files bank lines into it"],
    [(p) => { p.importProfiles = { bank: { accountId: "x" } }; }, "a bank file layout points at it"],
    [(p) => { p.goals = [{ id: "g", name: "Trip", fundedBy: ["x"] }]; }, "a goal draws on it"],
    [(p) => { p.debts = [{ id: "d", accountId: "x", rate: 0.2 }]; }, "its rate and payment are on Debts"],
    [(p) => { p.debtPlan = { customOrder: ["x"] }; }, "your debt plan puts it in its own place"],
    [(p) => { p.property = [{ id: "h", accountId: "x" }]; }, "a home or rental is linked to it"],
    [(p) => { p.contacts = [{ id: "c", accountIds: ["x"] }]; }, "a contact is linked to it"],
    [(p) => { p.estate = { beneficiaries: [{ accountId: "x" }] }; }, "it has beneficiaries"],
    [(p) => { p.retirement = { happenings: [{ kind: "move", from: "x" }] }; }, "a money move in your retirement plan uses it"],
    [(p) => { p.whatIfs = { somePage: { account: "x" } }; }, "another page keeps something about it"],
    [(p) => { p.guesses = { "accounts[x].balance": { v: 100, k: "account.cash", u: "total", d: "2026-11-01" } }; }, "its balance is our guess for now: type the real one first"],
    [(p) => { p.accounts[1].labels = ["trip"]; }, "it carries labels of its own"],
    [(p) => { p.accounts[0].id = "setup-have-checking"; p.accounts[1].id = "setup-have-checking-2"; }, "it is an answer in Get started"],
  ];
  for (const [edit, words] of cases) {
    const said = why(edit);
    assert.equal(said.length, 1, words);
    assert.match(said[0], new RegExp(`^(Spare|Main) stays on its own: ${words.replace(/[()]/g, "\\$&")}\\.$`), words);
  }
  // a contribution follows the row (it is not a reason), and a guess entry the balance no longer equals is not one either
  assert.deepEqual(why((p) => { p.retirement = { contributions: [{ id: "c", accountId: "x", amount: 100, period: "monthly" }] }; }), []);
});

test("one figure: putting together adds the balances (owed for debts, the kept row's sign), keeps the earliest date and the latest typing day, adds the histories from the first day every row has a point, and moves contributions", () => {
  const p = savers();
  p.retirement = { ...(p.retirement ?? {}), contributions: [...(p.retirement?.contributions ?? []), { id: "c-sv3", accountId: "sv3", amount: 50, period: "monthly" }] };
  const r = OF.asOne(p, "savings||0|", T);
  assert.deepEqual(r, { kept: "sv2", gone: ["sv3"], names: ["Holiday fund", "Old savings"], sum: 3200, name: "Savings" });
  const k = p.accounts.find((a) => a.id === "sv2");
  assert.equal(p.accounts.some((a) => a.id === "sv3"), false);
  assert.deepEqual({ name: k.name, balance: k.balance, asOf: k.asOf, institution: k.institution, notes: k.notes, oneFigure: k.oneFigure, typedOn: k.typedOn },
    { name: "Savings", balance: 3200, asOf: "2026-09-01", institution: "Ally", notes: "for December", oneFigure: true, typedOn: "2026-09-02" });
  // 2026-09-01: Old savings has no figure yet, so the day is left out (review 2026-11-16 F2); 2026-10-01: 2,300 + 790
  assert.deepEqual(k.history, [{ date: "2026-10-01", balance: 3090 }]);
  assert.equal(p.retirement.contributions.find((c) => c.id === "c-sv3").accountId, "sv2");
  assert.equal(p.accounts.find((a) => a.id === "a-sav").oneFigure, undefined, "the row on its own is left as it was");
  // debts: what is owed, whatever sign was typed; the kept row's sign kept; banks that differ leave the bank blank
  const d = emptyPlan();
  d.accounts.push({ id: "c1", name: "Visa", type: "credit", balance: -1200, institution: "A" }, { id: "c2", name: "Store card", type: "credit", balance: 300.55, institution: "B" });
  const rd = OF.asOne(d, "credit||0|", T);
  assert.equal(rd.sum, 1500.55);
  assert.deepEqual([d.accounts.length, d.accounts[0].balance, d.accounts[0].institution, d.accounts[0].name], [1, -1500.55, "", "Credit cards"]);
  assert.equal(compute(d).liabilities, 1500.55);
  // a kind of one row is only marked; Item by item takes the mark off and keeps the row
  const one = emptyPlan(); one.accounts.push({ id: "s", name: "Chase savings", type: "savings", balance: 500 });
  assert.deepEqual(OF.asOne(one, "savings||0|", T), { kept: "s", gone: [], names: ["Chase savings"], sum: 500, name: "Chase savings" });
  assert.equal(one.accounts[0].oneFigure, true);
  assert.equal(one.accounts[0].name, "Chase savings", "a single row keeps the name the person gave it");
  assert.deepEqual(OF.itemize(one, "savings||0|"), { kept: "s", name: "Chase savings", sum: 500 });
  assert.equal("oneFigure" in one.accounts[0], false);
  assert.equal(OF.itemize(one, "savings||0|"), null, "nothing marked: nothing to do");
  assert.equal(OF.asOne(one, "checking||0|", T), null, "no such kind");
});

test("one figure: mergedHistory adds each row's latest point on or before each day, from the first day every row has one", () => {
  const a = { history: [{ date: "2026-01-01", balance: 10 }, { date: "2026-03-01", balance: 30 }] }, b = { history: [{ date: "2026-02-01", balance: 5 }] };
  assert.deepEqual(OF.mergedHistory([a, b]), [{ date: "2026-02-01", balance: 15 }, { date: "2026-03-01", balance: 35 }], "January: b has no figure yet");
  assert.deepEqual(OF.mergedHistory([a, b, {}]), [], "a row with no point at all: the history starts afresh");
  assert.deepEqual(OF.mergedHistory([{ history: "junk" }, { history: [null, { date: 3 }] }]), []);
  // debts: what is owed on each day, signed like the balance kept (review 2026-11-16 F4)
  assert.deepEqual(OF.mergedHistory([{ history: [{ date: "2026-10-01", balance: -400 }] }, { history: [{ date: "2026-10-01", balance: 250 }] }], { owed: true, sign: -1 }), [{ date: "2026-10-01", balance: -650 }]);
});

test("one figure (review 2026-11-16 F2): a row saved from later on adds no false gain on Performance; F4: a debt's history is what is owed, with the balance's sign", () => {
  const p = emptyPlan(); p.household.people = [{ id: "p1", name: "Ana", birthDate: "1985-03-01", role: "self" }];
  p.accounts = [{ id: "a", name: "Fund A", type: "brokerage", balance: 12000, asOf: "2026-11-01", ownerId: "", history: [{ date: "2026-01-01", balance: 10000 }, { date: "2026-06-01", balance: 11000 }, { date: "2026-11-01", balance: 12000 }] },
    { id: "b", name: "Fund B", type: "brokerage", balance: 50000, asOf: "2026-11-01", ownerId: "", history: [{ date: "2026-09-01", balance: 49000 }, { date: "2026-11-01", balance: 50000 }] }];
  const apart = p.accounts.map((x) => accountPerformance(p, x).gain).reduce((t, g) => t + g, 0);
  OF.asOne(p, "brokerage||0|", T);
  assert.deepEqual(p.accounts[0].history, [{ date: "2026-09-01", balance: 60000 }, { date: "2026-11-01", balance: 62000 }]);
  const r = accountPerformance(p, p.accounts[0]);
  assert.deepEqual([r.start, r.end, r.gain], [60000, 62000, 2000], "the gain since both have a figure, not 52,000");
  assert.ok(r.gain <= apart && r.twr < 0.05, `twr ${r.twr}`);
  const d = emptyPlan();
  d.accounts = [{ id: "c1", name: "Visa", type: "credit", balance: -500, asOf: "2026-11-01", history: [{ date: "2026-10-01", balance: -400 }] }, { id: "c2", name: "MC", type: "credit", balance: 300, asOf: "2026-11-01", history: [{ date: "2026-10-01", balance: 250 }] }];
  OF.asOne(d, "credit||0|", T);
  assert.deepEqual([d.accounts.length, d.accounts[0].balance, d.accounts[0].history], [1, -800, [{ date: "2026-10-01", balance: -650 }]]);
  assert.equal(compute(d, { today: T }).liabilities, 800);
});

test("one figure (review 2026-11-16 F3): a row whose id is missing or shared stays on its own, and putting together removes only the rows that join", () => {
  const p = emptyPlan();
  p.accounts = [{ id: "a", name: "S1", type: "savings", balance: 100 }, { id: "a", name: "S2", type: "savings", balance: 50 }, { id: "b", name: "S3", type: "savings", balance: 10 },
    { name: "No id", type: "savings", balance: 5 }, { id: "c", name: "S4", type: "savings", balance: 1 }, { name: "Spare checking", type: "checking", balance: 7 }];
  const before = compute(p, { today: T }).netWorth;
  const [s] = OF.sectionsOf(p);
  assert.deepEqual([s.keep, s.join], ["b", ["c"]]);
  assert.deepEqual(s.held.map(OF.holdWords), ["S1 stays on its own: the app cannot tell it apart from another account on your list.",
    "S2 stays on its own: the app cannot tell it apart from another account on your list.", "No id stays on its own: the app cannot tell it apart from another account on your list."]);
  OF.asOne(p, s.key, T);
  assert.deepEqual(p.accounts.map((a) => [a.id, a.name, a.balance]), [["a", "S1", 100], ["a", "S2", 50], ["b", "Savings", 11], [undefined, "No id", 5], [undefined, "Spare checking", 7]]);
  assert.equal(compute(p, { today: T }).netWorth, before);
  // two rows with one id and nothing else of the kind: nothing to put together, and the part is not drawn for it
  const q = emptyPlan(); q.accounts = [{ id: "x", name: "A", type: "savings", balance: 1 }, { id: "x", name: "B", type: "savings", balance: 2 }];
  assert.deepEqual(OF.sectionsOf(q).map((x) => [x.keep, x.changes]), [[null, false]]);
  assert.equal(OF.asOne(q, "savings||0|", T), null);
  assert.equal(q.accounts.length, 2);
});

test("one figure: unmarkOnAdd takes the mark off when another account of that kind and owner is added, and says which kind", () => {
  const p = savers(); OF.asOne(p, "savings||0|", T);
  const added = { id: "n", name: "New savings", type: "savings", balance: 10, ownerId: "" };
  p.accounts.push(added);
  assert.equal(OF.unmarkOnAdd(p, added), "Savings");
  assert.equal(p.accounts.some((a) => a.oneFigure), false);
  assert.equal(OF.unmarkOnAdd(p, { type: "checking" }), null);
  assert.equal(OF.unmarkOnAdd(p, { type: "property" }), null);
});

test("one figure: the words, one sentence per case", () => {
  const p = savers();
  const [s] = OF.sectionsOf(p);
  assert.equal(OF.INTRO, "Keep a kind of account as one figure, typed and changed in one place, or list each account on its own. Either way your net worth counts the same, and so does every plan that reads it.");
  assert.equal(OF.PART_TITLE, "One figure or item by item");
  // the status
  assert.equal(OF.statusWords([s]), "1 can be one figure");
  assert.equal(OF.statusWords([s, { ...s, key: "x" }]), "2 can be one figure");
  assert.equal(OF.statusWords([{ ...s, mode: "one" }, s]), "1 as one figure");
  assert.equal(OF.statusWords([{ ...s, changes: false }]), "");
  // the line under a kind's name: what one figure would hold when some rows stay on their own (review 2026-11-16 P1)
  assert.equal(OF.sectionLine(s, usd2), "2 of 3 accounts can be one figure, $3,200");
  assert.equal(OF.sectionLine({ ...s, held: [], join: ["sv3", "a-sav"] }, usd2), "3 accounts, $14,700 in all");
  assert.equal(OF.sectionLine({ ...s, join: [] }, usd2), "3 accounts, $14,700 in all", "nothing joins: the plain line");
  assert.equal(OF.sectionLine({ ...s, debt: true, total: 4000, held: [] }, usd2), "3 accounts, $4,000 owed in all");
  assert.equal(OF.sectionLine({ ...s, debt: true, together: 900 }, usd2), "2 of 3 accounts can be one figure, $900 owed");
  assert.equal(OF.sectionLine({ ...s, mode: "one", held: [], kept: 3200 }, usd2), "One figure: $3,200");
  assert.equal(OF.sectionLine({ ...s, mode: "one", kept: 3200 }, usd2), "One figure: $3,200, with 1 more on its own");
  assert.equal(OF.sectionLine({ ...s, mode: "one", kept: 3200, held: [1, 2] }, usd2), "One figure: $3,200, with 2 more on their own");
  assert.equal(OF.sectionLine({ ...s, mode: "one", debt: true, held: [], kept: 900 }, usd2), "One figure: $900 owed");
  // the question: all of them; one stays; two stay; a debt
  const all = savers(); all.goals = [];
  const [sa] = OF.sectionsOf(all);
  assert.equal(OF.askWords(all, sa, usd2, 290300), "Replace Ally savings, Holiday fund and Old savings with one line, Savings: $14,700? Your net worth stays $290,300.");
  assert.equal(OF.askWords(p, s, usd2, 290300), "Replace Holiday fund and Old savings with one line, Savings: $3,200? Ally savings stays on its own. Your net worth stays $290,300.");
  assert.equal(OF.askWords(p, { ...s, held: [...s.held, { name: "Kids' jar" }] }, usd2, 290300), "Replace Holiday fund and Old savings with one line, Savings: $3,200? Ally savings and Kids' jar stay on their own. Your net worth stays $290,300.");
  const d = emptyPlan(); d.accounts.push({ id: "c1", name: "Visa", type: "credit", balance: 1200 }, { id: "c2", name: "Store card", type: "credit", balance: 300 });
  const [sd] = OF.sectionsOf(d);
  assert.equal(OF.askWords(d, sd, usd2, -1500), "Replace Visa and Store card with one line, Credit cards: $1,500 owed? Your net worth stays -$1,500.");
  // done; one row only marked; Item by item; Undo both ways; an add
  assert.equal(OF.doneWords({ gone: ["sv3"], names: ["Holiday fund", "Old savings"], sum: 3200, name: "Savings" }, s, usd2, 290300), "Savings is one figure now: $3,200, in place of 2 accounts. Ally savings stays on its own. Your net worth is still $290,300.");
  assert.equal(OF.doneWords({ gone: ["sv3"], names: ["Holiday fund", "Old savings"], sum: 3200, name: "Savings" }, { ...s, held: [...s.held, { name: "Kids' jar" }] }, usd2, 290300), "Savings is one figure now: $3,200, in place of 2 accounts. Ally savings and Kids' jar stay on their own. Your net worth is still $290,300.");
  assert.equal(OF.doneWords({ gone: [], names: ["Chase savings"], sum: 500, name: "Chase savings" }, s, usd2, 290300), "Chase savings is one figure now: $500. Your net worth is still $290,300.");
  assert.equal(OF.doneWords({ gone: ["c2"], names: ["Visa", "Store card"], sum: 1500, name: "Credit cards" }, sd, usd2, -1500), "Credit cards is one figure now: $1,500 owed, in place of 2 accounts. Your net worth is still -$1,500.");
  assert.equal(OF.itemizeWords({ name: "Savings", sum: 3200 }, s, usd2), "Savings is item by item now. List each one: tap Edit on its line to rename it, then + Add another account.");
  assert.equal(OF.undoneWords({ gone: ["sv3"], names: ["Holiday fund", "Old savings"] }, usd2, 290300), "Put back: Holiday fund and Old savings. Your net worth is still $290,300.");
  assert.equal(OF.undoneWords({ name: "Savings" }, usd2, 290300), "Back as it was: Savings. Your net worth is still $290,300.");
  assert.equal(OF.addWords("Savings"), "Savings is item by item again: each account is on the list.");
  assert.equal(OF.holdWords({ name: "Ally savings", why: "a goal draws on it" }), "Ally savings stays on its own: a goal draws on it.");
  assert.equal(OF.rowLine(p, p.accounts.find((a) => a.id === "sv2")), null, "not one figure yet: the row says nothing new");
  OF.asOne(p, "savings||0|", T);
  assert.equal(OF.rowLine(p, p.accounts.find((a) => a.id === "sv2")), "One figure for your savings accounts");
});

test("one figure: the totals are the same either way: Net worth's figures, the retirement plan's balances, contributions and answer", () => {
  const close = (a, b, path = "") => {
    if (typeof a === "number" && typeof b === "number") return assert.ok(Math.abs(a - b) <= Math.max(0.005, 1e-9 * Math.abs(a)), `${path}: ${a} != ${b}`);
    if (a && b && typeof a === "object") { assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path); for (const k of Object.keys(a)) close(a[k], b[k], `${path}.${k}`); return; }
    assert.deepEqual(a, b, path);
  };
  const figs = (p) => {
    const { history, change, count, ...nw } = compute(p, { today: T }); void history; void change; void count;   // (the number of rows is what changes)
    const b = buildInputs(structuredClone(p), { today: T });
    const sums = {}; for (const c of b.inputs?.contributions ?? []) sums[`${c.bucket}|${c.personIndex}`] = (sums[`${c.bucket}|${c.personIndex}`] ?? 0) + c.yearly;
    const r = retirementOf(structuredClone(p), { today: T });
    return { nw, balances: b.inputs?.balances, contributions: sums, answer: { verdict: r.verdict, affordable: r.affordable, coverage: r.coverage, atRetirement: r.atRetirement, atEnd: r.atEnd, rows: (r.rows ?? []).map((x) => x.total) } };
  };
  const p = savers();
  p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "c-sv3", personId: "p-ana", accountId: "sv3", amount: 50, period: "monthly" }];
  const before = figs(p);
  const one = structuredClone(p); OF.asOne(one, "savings||0|", T);
  close(figs(one), before, "one figure");
  const back = structuredClone(one); OF.itemize(back, "savings||0|");
  close(figs(back), before, "item by item again");
  assert.equal(before.nw.byType.savings, 14700);
});

test("one figure, the page: no part while nothing can change (the family as it is; Riley's cards, each with its rate on Debts)", async () => {
  for (const p of [migrate(familyPlan(T)), renterDebtPlan(), retiredCouplePlan(T), emptyPlan()]) {
    const r = await live(p);
    assert.equal(r.partEl(), null);
    assert.doesNotMatch(r.text(), /One figure/);
  }
});

test("one figure, the page: one quiet row, shut; One figure asks in place; Keep them changes nothing; Replace makes one row in one save, the part stays open with the green line and Undo", async () => {
  const r = await live(savers());
  const el = r.partEl();
  assert.ok(el && !el.hasAttribute("open"), "drawn, and shut");
  assert.equal(el.dataset.kind, "own");
  assert.equal(r.textOf(el.querySelector(".fold-title")), "One figure or item by item");
  assert.equal(r.textOf(el.querySelector(".fold-status")), "1 can be one figure");
  const accounts = r.root.querySelectorAll("section").find((x) => r.textOf(x.querySelector("h2")) === "Accounts");
  assert.ok(accounts.querySelectorAll("details").includes(el), "in the Accounts card, under the list");
  assert.match(r.partText(), /Savings · 2 of 3 accounts can be one figure, \$3,200 One figure Item by item Ally savings stays on its own: a goal draws on it\./);
  const pressed = () => ["One figure", "Item by item"].map((w) => r.btn(w, el).getAttribute("aria-pressed"));
  assert.deepEqual(pressed(), ["false", "true"]);
  assert.equal(el.querySelectorAll("button").filter((b) => !b.classList.contains("chip") && !b.classList.contains("secondary")).length, 0, "no filled button inside");
  r.btn("One figure", el).click();
  assert.match(r.partText(), /Replace Holiday fund and Old savings with one line, Savings: \$3,200\? Ally savings stays on its own\. Your net worth stays \$290,300\./);
  assert.deepEqual(pressed(), ["true", "false"], "while it asks, the chip tapped is the one lit (review 2026-11-16 P2)");
  assert.equal(r.updates, 0, "asking writes nothing");
  r.btn("Keep them as they are", el).click();
  assert.doesNotMatch(r.partText(), /Replace Holiday/);
  assert.deepEqual(pressed(), ["false", "true"], "kept as they are: the choice as it was");
  r.btn("One figure", el).click();
  r.btn("Item by item", el).click();
  assert.doesNotMatch(r.partText(), /Replace Holiday/, "the other chip while asking: the question goes");
  assert.deepEqual([pressed(), r.updates], [["false", "true"], 0]);
  r.btn("One figure", el).click();
  r.btn("Replace with one line", el).click();
  assert.equal(r.updates, 1, "one save");
  assert.deepEqual(r.plan.accounts.filter((a) => a.type === "savings").map((a) => [a.id, a.name, a.balance]), [["a-sav", "Ally savings", 11500], ["sv2", "Savings", 3200]]);
  r.draw();
  const el2 = r.partEl();
  assert.ok(el2.hasAttribute("open"), "the part saved in stays open");
  assert.equal(r.textOf(el2.querySelector(".fold-status")), "1 as one figure");
  assert.match(r.partText(), /^One figure or item by item 1 as one figure › Savings is one figure now: \$3,200, in place of 2 accounts\. Ally savings stays on its own\. Your net worth is still \$290,300\. Undo/);
  assert.match(r.partText(), /Savings · One figure: \$3,200, with 1 more on its own/);
  assert.equal(r.btn("One figure", el2).getAttribute("aria-pressed"), "true");
  // the list says what the row is
  assert.match(r.text(), /Savings Edit Delete Savings or money market · Ally \$3,200 One figure for your savings accounts, as of 9\/1\/2026/);
  // Undo: every row back, said
  r.btn("Undo", el2).click();
  assert.equal(r.updates, 2);
  assert.deepEqual(r.plan.accounts.filter((a) => a.type === "savings").map((a) => [a.id, a.name, a.balance]), [["a-sav", "Ally savings", 11500], ["sv2", "Holiday fund", 2400], ["sv3", "Old savings", 800]]);
  assert.deepEqual(r.plan.accounts, migrate(savers()).accounts, "exactly as before");
  r.draw();
  assert.ok(r.partEl().hasAttribute("open"));
  assert.match(r.partText(), /Put back: Holiday fund and Old savings\. Your net worth is still \$290,300\./);
});

test("one figure, the page: Item by item keeps the one row and says how to go on; adding another account of that kind lists it item by item again", async () => {
  const p = savers(); OF.asOne(p, "savings||0|", T);
  const r = await live(p);
  const el = r.partEl();
  assert.equal(r.textOf(el.querySelector(".fold-status")), "1 as one figure");
  r.btn("Item by item", el).click();
  assert.equal(r.updates, 1);
  assert.equal(r.plan.accounts.find((a) => a.id === "sv2").oneFigure, undefined);
  assert.equal(r.plan.accounts.find((a) => a.id === "sv2").balance, 3200, "the row stays: the list starts from it");
  r.draw();
  assert.match(r.partText(), /Savings is item by item now\. List each one: tap Edit on its line to rename it, then \+ Add another account\./);
  assert.doesNotMatch(r.text(), /One figure for your savings/);
  // an add of another savings account while Savings is one figure: the mark comes off, and the green line says so
  const q = savers(); OF.asOne(q, "savings||0|", T);
  const a = await live(q, { add: "savings" });
  submit(a.root.querySelector("form"), { name: "Rainy day", balance: "500" });
  assert.equal(a.updates, 1);
  assert.equal(a.plan.accounts.some((x) => x.oneFigure), false);
  a.draw();
  assert.match(a.text(), /Rainy day added\. Savings is item by item again: each account is on the list\./);
});

test("one figure: a kind whose name other pages read keeps the kept row's own name, so an old job's 401(k) stays one and a car loan stays a car loan", () => {
  const p = emptyPlan();
  p.household.people = [{ id: "p-ana", name: "Ana", role: "self" }];
  p.accounts.push({ id: "o1", name: "Old job 401(k)", type: "401k", ownerId: "p-ana", balance: 40000 }, { id: "o2", name: "Rollover 401(k)", type: "401k", ownerId: "p-ana", balance: 12000 },
    { id: "w1", name: "Acme 401(k)", type: "401k", ownerId: "p-ana", balance: 90000 },
    { id: "l1", name: "Car loan", type: "loan", balance: 9000 }, { id: "l2", name: "Truck loan", type: "loan", balance: 4000 }, { id: "l3", name: "Personal loan", type: "loan", balance: 2000 });
  const keys = OF.sectionsOf(p).map((s) => [s.key, s.name, s.count]);
  assert.deepEqual(keys, [["401k|p-ana|0|o", "Ana's 401(k), from former jobs", 2], ["loan||0|c", "Car loans", 2]], "the job she has now and the personal loan are kinds of their own (one row each)");
  const r = OF.asOne(p, "401k|p-ana|0|o", T);
  assert.equal(r.name, "Old job 401(k)");
  assert.deepEqual(p.accounts.filter((a) => a.type === "401k").map((a) => [a.name, a.balance]), [["Old job 401(k)", 52000], ["Acme 401(k)", 90000]]);
  assert.equal(OF.nameClass(p.accounts[0]), "o", "still read as a job she has left");
  OF.asOne(p, "loan||0|c", T);
  assert.deepEqual(p.accounts.filter((a) => a.type === "loan").map((a) => [a.name, a.balance]), [["Car loan", 13000], ["Personal loan", 2000]]);
  // a kind nobody reads by name takes the kind's name
  const q = emptyPlan(); q.accounts.push({ id: "a", name: "Chase", type: "checking", balance: 1 }, { id: "b", name: "Credit union", type: "checking", balance: 2 });
  assert.equal(OF.asOne(q, "checking||0|", T).name, "Checking");
});

// =============================================================================================================================
// Invariance of gold and silver by weight and the private investment (gap list, next 60, item 45; metals.js, private-fund.js):
// with no account holding `metal` or `private`, Net worth's compute and the page's words (as it opens, and with the add form
// open) are what they were at dca545e, before either existed. Over every qa fixture plan, every invented household, the phone,
// round 8 and persona households and the empty plan.
// `PRINT=1 node --test modules/balance/net-worth/module.test.mjs` writes the digests again; only do that on the old code.
// =============================================================================================================================
test("invariance: with no gold or silver by weight and no private investment, Net worth's figures and words are those of dca545e", async () => {
  const fs = await import("node:fs"); const path = await import("node:path"); const nodeCrypto = await import("node:crypto");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const round8 = await import("../../../qa/fixtures/round8-households.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const TI = "2026-11-16";
  const file = new URL("./special-invariance.json", import.meta.url);
  const digest = (x) => nodeCrypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x, (k, v) => (v instanceof Map ? [...v] : v)) ?? "undefined").digest("base64url").slice(0, 22);
  const plans = [];
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../qa/fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push([`fixture ${f}:${name}`, fn(TI)]);
  }
  for (const a of ARCHETYPES) plans.push([`${a.id}/base`, a.build()]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") plans.push([`phone ${name}`, fn()]);
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push([`round8 ${name}`, fn()]);
  for (const n of ["sam", "jordan", "patLee", "ruth"]) plans.push([`persona ${n}`, personas.finishSetup(n, personas[n](TI), TI)]);
  plans.push(["empty plan", emptyPlan()]);
  const safe = async (f) => { try { return await f(); } catch (e) { return `THROW ${e.message}`; } };
  const now = { today: TI, plans: {} };
  for (const [name, raw] of plans) {
    const p = migrate(structuredClone(raw));
    now.plans[name] = {
      netWorth: digest(await safe(() => compute(structuredClone(p), { today: TI }))),
      page: digest(await safe(async () => (await renderPage(view, p, TI, { computeOf })).text())),
      addForm: digest(await safe(async () => (await renderPage(view, p, TI, { computeOf, route: { rest: [], query: { add: "checking" } } })).text())),
    };
  }
  if (process.env.PRINT) { fs.writeFileSync(file, `${JSON.stringify({ note: "digests at dca545e, before gold and silver by weight and the private investment; module.test.mjs says how to write them again", ...now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Object.keys(was.plans).length >= 45, `${Object.keys(was.plans).length} plans`);
  assert.deepEqual(Object.keys(now.plans), Object.keys(was.plans), "the same plans");
  for (const name of Object.keys(was.plans)) assert.deepEqual(now.plans[name], was.plans[name], name);
});

// =============================================================================================================================
// Gold and silver by weight; a private investment with its own return and the calls still promised (gap list, next 60, item
// 45; metals.js, private-fund.js): every formula against a hand calculation, every sentence case, the form and the row
// =============================================================================================================================
const MT = await import("./metals.js");
const PF = await import("./private-fund.js");
const TW = "2026-11-16";
const near6 = (a, b, tol = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} ${msg}`);
const dollars0 = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

test("by weight: a troy ounce is 480 grains of 64.79891 mg = 31.1034768 g; grams and ounces; worth = ounces x the price, to the cent", () => {
  near6(MT.TROY_OUNCE_GRAMS, MT.GRAINS_PER_TROY_OUNCE * MT.GRAIN_MG / 1000, 1e-12);
  assert.equal(MT.TROY_OUNCE_GRAMS, 31.1034768);
  near6(MT.ouncesOf(31.1034768, "g"), 1, 1e-15);
  near6(MT.ouncesOf(1000, "g"), 32.150746568627980, 1e-12, "a kilo bar: 1,000 / 31.1034768");
  assert.equal(MT.ouncesOf(10, "oz"), 10);
  for (const bad of [0, -1, "", null, "abc", Infinity]) assert.equal(MT.ouncesOf(bad, "oz"), 0, String(bad));
  // a unit not on the list is not read as ounces (critic F3): no weight at all; no unit saved is ounces (the form's first choice)
  assert.deepEqual([MT.unitOf("oz"), MT.unitOf("g"), MT.unitOf(undefined), MT.unitOf(null), MT.unitOf(""), MT.unitOf("kg"), MT.unitOf("lb"), MT.unitOf("OZ")], ["oz", "g", "oz", "oz", "oz", null, null, null]);
  assert.equal(MT.ouncesOf(5, "kg"), 0);
  assert.equal(MT.metalValue({ weight: 5, unit: "kg", price: 2400 }), 0);
  // 10 one-ounce coins at 2,400 = 24,000; 100 g at 2,400: 3.2150747 oz x 2,400 = 7,716.179 -> 7,716.18
  assert.equal(MT.metalValue({ weight: 10, unit: "oz", price: 2400 }), 24000);
  assert.equal(MT.metalValue({ weight: 100, unit: "g", price: 2400 }), 7716.18);
  // silver: 500 oz at 31.45 = 15,725.00; a kilo of silver at 31.45 = 32.1507466 x 31.45 = 1,011.14
  assert.equal(MT.metalValue({ weight: 500, unit: "oz", price: 31.45 }), 15725);
  assert.equal(MT.metalValue({ weight: 1000, unit: "g", price: 31.45 }), 1011.14);
  assert.equal(MT.metalValue({ weight: 10, unit: "oz", price: null }), 0);
  assert.deepEqual([MT.weightText(10), MT.weightText(1), MT.weightText(0.25), MT.weightText(31.1, "g"), MT.weightText(1, "g"), MT.weightText(1234.5678, "g")], ["10 ounces", "1 ounce", "0.25 ounces", "31.1 grams", "1 gram", "1,234.5678 grams"]);
});

test("by weight: metalOf says the price typed while the worth still follows it, else the price the worth on file means; the row's line", () => {
  const a = { id: "g1", name: "Gold coins", type: "other_asset", balance: 24000, asOf: "2026-11-16", metal: { kind: "gold", weight: 10, unit: "oz", price: 2400 } };
  assert.ok(MT.isMetal(a));
  assert.deepEqual(MT.metalOf(a), { id: "g1", name: "Gold coins", kind: "gold", weight: 10, unit: "oz", ounces: 10, price: 2400, typed: true, value: 24000, asOf: "2026-11-16" });
  // the worth changed on Update all balances: 25,000 for 10 ounces means 2,500 an ounce
  assert.deepEqual([MT.metalOf({ ...a, balance: 25000 }).price, MT.metalOf({ ...a, balance: 25000 }).typed], [2500, false]);
  for (const bad of [{ ...a, type: "brokerage" }, { ...a, metal: { ...a.metal, kind: "copper" } }, { ...a, metal: { ...a.metal, weight: 0 } }, { ...a, metal: { ...a.metal, unit: "kg" } }, { ...a, metal: null }, { ...a, metal: "gold" }, null])
    assert.equal(MT.isMetal(bad), false, JSON.stringify(bad));
  // a unit not on the list: the account reads as a plain thing with its balance, never "5 ounces" (critic F3)
  assert.equal(MT.metalOf({ ...a, metal: { ...a.metal, weight: 5, unit: "kg" } }), null);
  assert.equal(MT.metalOf({ ...a, metal: { kind: "gold", weight: 10, price: 2400 } }).unit, "oz", "no unit saved: ounces");
  const price = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const day = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  assert.equal(MT.metalLine(MT.metalOf(a), price, day), "10 ounces of gold at $2,400.00 an ounce, your price of 11/16/2026");
  assert.equal(MT.metalLine(MT.metalOf({ ...a, asOf: "" }), price, day), "10 ounces of gold at $2,400.00 an ounce, your price, with no day typed");
  // the balance changed somewhere else (Update all balances): the price is only what that balance means, never "your price"
  // (critic F2): 24,500 / 10 = 2,450
  assert.equal(MT.metalLine(MT.metalOf({ ...a, balance: 24500, asOf: "2026-11-20" }), price, day), "10 ounces of gold, about $2,450.00 an ounce going by its balance of 11/20/2026");
  assert.equal(MT.metalLine(MT.metalOf({ ...a, balance: 24500, asOf: "" }), price, day), "10 ounces of gold, about $2,450.00 an ounce going by its balance");
  const s = { id: "s1", name: "Silver bar", type: "other_asset", balance: 1011.14, asOf: "2026-11-01", metal: { kind: "silver", weight: 1000, unit: "g", price: 31.45 } };
  assert.equal(MT.metalLine(MT.metalOf(s), price, day), "1,000 grams of silver at $31.45 an ounce, your price of 11/01/2026");
  assert.equal(MT.metalSaid("Silver bar", MT.metalOf(s), true, price, dollars0), "Silver bar added: 1,000 grams of silver at $31.45 an ounce, $1,011.");
  assert.equal(MT.metalSaid("Gold coins", MT.metalOf(a), false, price, dollars0), "Gold coins saved: 10 ounces of gold at $2,400.00 an ounce, $24,000.");
  assert.equal(MT.NEED_WEIGHT("silver"), "Type how much silver you hold.");
  assert.equal(MT.NEED_PRICE, "Type the price of one ounce.");
});

const fund = (flows, extra = {}) => ({ id: "f1", name: "Fund II", type: "other_asset", balance: 0, asOf: TW, private: { flows: flows.map(([date, kind, amount], i) => ({ id: `x${i}`, date, kind, amount })) }, ...extra });

test("a private investment's own yearly return: the internal rate of return on the dated amounts, against hand calculations", () => {
  // (1) 100,000 in on Jan 1, 2021; worth 121,000 on Jan 1, 2023: 730 days = 730 / 365.25 years, so (1 + r)^(730/365.25) = 1.21
  const one = PF.privateOf(fund([["2021-01-01", "in", 100000]], { balance: 121000, asOf: "2023-01-01" }), { today: TW });
  assert.equal(one.state, "rate");
  near6(one.irr, Math.pow(1.21, 365.25 / 730) - 1, 1e-8);
  near6(one.irr, 0.10007, 1e-5, "about 10.0% a year");
  assert.deepEqual([one.putIn, one.paidBack, one.worth, one.firstIn, one.days], [100000, 0, 121000, "2021-01-01", 730]);
  near6(one.multiple, 1.21); near6(one.soFar, 0.21);
  // (2) 100 in on Jan 1, 2021, 50 back on Jan 1, 2022, worth 60 on Jan 1, 2023: with a = 365/365.25 and y = (1 + r)^a,
  // -100 + 50 / y + 60 / y^2 = 0, so 100 y^2 - 50 y - 60 = 0 and y = (50 + sqrt(2,500 + 24,000)) / 200 = 1.0639410
  const two = PF.privateOf(fund([["2021-01-01", "in", 100], ["2022-01-01", "back", 50]], { balance: 60, asOf: "2023-01-01" }), { today: TW });
  const y = (50 + Math.sqrt(2500 + 24000)) / 200;
  near6(y, 1.0639410, 1e-7);
  near6(two.irr, Math.pow(y, 365.25 / 365) - 1, 1e-8);
  near6(two.multiple, 1.1);
  // (3) a loss: 100,000 in, worth 81,000 two years on: (1 + r)^(730/365.25) = 0.81
  const lost = PF.privateOf(fund([["2021-01-01", "in", 100000]], { balance: 81000, asOf: "2023-01-01" }), { today: TW });
  near6(lost.irr, Math.pow(0.81, 365.25 / 730) - 1, 1e-8);
  // (4) money in twice, some back, worth now: the rate makes every amount add up to nothing on its own day (npv = 0)
  const four = PF.privateOf(fund([["2021-03-01", "in", 60000], ["2022-06-15", "in", 20000], ["2024-12-31", "back", 10000]], { balance: 95000, asOf: "2026-10-31" }), { today: TW });
  const t = (d) => (Date.parse(`${d}T00:00:00`) - Date.parse("2021-03-01T00:00:00")) / 864e5 / 365.25;
  const npv = -60000 + -20000 / Math.pow(1 + four.irr, t("2022-06-15")) + 10000 / Math.pow(1 + four.irr, t("2024-12-31")) + 95000 / Math.pow(1 + four.irr, t("2026-10-31"));
  near6(npv, 0, 1e-4, "npv at the rate");
  assert.ok(four.irr > 0.05 && four.irr < 0.06, String(four.irr));
  near6(four.multiple, 105000 / 80000);
});

test("a private investment: none typed, under a year, all gone, a worth older than an amount; what is promised to keep ready", () => {
  assert.equal(PF.privateOf(fund([], { balance: 70000 }), { today: TW }).state, "none");
  // under a year from the first money in: no yearly rate, the plain change so far (56,000 - 50,000) / 50,000 = 12%
  const early = PF.privateOf(fund([["2026-06-01", "in", 50000]], { balance: 56000, asOf: TW }), { today: TW });
  assert.deepEqual([early.state, early.irr, early.days], ["early", null, 168]);
  near6(early.soFar, 0.12);
  const at364 = PF.privateOf(fund([["2025-11-17", "in", 1000]], { balance: 1100, asOf: TW }), { today: TW });
  const at365 = PF.privateOf(fund([["2025-11-16", "in", 1000]], { balance: 1100, asOf: TW }), { today: TW });
  assert.deepEqual([at364.days, at364.state, at365.days, at365.state], [364, "early", 365, "rate"], "a yearly rate from 365 days on");
  // nothing back and worth nothing
  assert.equal(PF.privateOf(fund([["2020-01-01", "in", 50000]], { balance: 0 }), { today: TW }).state, "gone");
  // no day on the worth: today's
  assert.equal(PF.privateOf(fund([["2026-06-01", "in", 50000]], { balance: 56000, asOf: "" }), { today: TW }).worthOn, TW);
  // the worth is of Jun 30, 2026; 10,000 went in on Aug 1, 2026
  const stale = PF.privateOf(fund([["2021-03-01", "in", 60000], ["2026-08-01", "in", 10000]], { balance: 80000, asOf: "2026-06-30" }), { today: TW });
  assert.equal(stale.staleAfter, "2026-08-01");
  assert.equal(PF.staleLine(stale), "What it is worth is from Jun 30, 2026, before the money of Aug 1, 2026: update it with Edit, above, for a truer return.");
  assert.equal(PF.staleLine(early), "");
  // a flow with no day on the calendar, an unknown kind, or no amount is not read
  assert.equal(PF.flowsOf(fund([["2026-02-31", "in", 5], ["2026-01-01", "out", 5], ["2026-01-01", "in", 0], ["2026-01-02", "in", 5]])).length, 1);
  // promised: money to keep ready, never in net worth
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 10000 }, { ...fund([["2021-03-01", "in", 60000]], { balance: 70000 }), private: { flows: [], promised: 40000 } });
  const d = compute(p, { today: TW });
  assert.equal(d.netWorth, 80000, "what is promised is not a debt");
  assert.equal(d.keepReady, 40000);
  assert.equal(PF.keepReadyLine(d.privates[0], dollars0), "Fund II can still ask you for $40,000: keep that much ready, in cash or something easy to sell.");
  assert.equal(PF.rowPromised(d.privates[0], dollars0), "It can still ask for $40,000: keep that ready.");
  assert.equal(PF.keepReadyLine(early, dollars0), "");
});

test("a private investment: one written sentence per case (R5), the row's words and the row's status", () => {
  const S = (f, extra) => PF.privateSentence(PF.privateOf(fund(f, extra), { today: TW }), dollars0);
  assert.equal(S([], { balance: 70000 }), "Add what you put into Fund II and when, and what it paid back, to see its own yearly return.");
  assert.equal(S([["2020-01-01", "in", 50000]], { balance: 0 }), "Nothing is left of the $50,000 you put in: nothing came back and it is worth $0 now.");
  assert.equal(S([["2026-06-01", "in", 50000]], { balance: 56000 }), "Up 12% so far: you put in $50,000, got nothing back yet, and it is worth $56,000. Its yearly return shows once the first money has been in a year.");
  assert.equal(S([["2026-06-01", "in", 50000], ["2026-09-01", "back", 2000]], { balance: 44000 }), "Down 8% so far: you put in $50,000, got $2,000 back, and it is worth $44,000. Its yearly return shows once the first money has been in a year.");
  assert.equal(S([["2026-06-01", "in", 50000]], { balance: 50000 }), "Even so far: you put in $50,000, got nothing back yet, and it is worth $50,000. Its yearly return shows once the first money has been in a year.");
  assert.equal(S([["2021-01-01", "in", 100], ["2022-01-01", "back", 50]], { balance: 60, asOf: "2023-01-01" }), "About 6.4% a year since January 2021: you put in $100, got $50 back, and it is worth $60 now, 1.10 times what you put in.");
  assert.equal(S([["2021-01-01", "in", 100000]], { balance: 81000, asOf: "2023-01-01" }), "It has lost about 10.0% a year since January 2021: you put in $100,000, got nothing back yet, and it is worth $81,000 now, 0.81 times what you put in.");
  assert.equal(PF.privateSentence({ ...PF.privateOf(fund([["2021-01-01", "in", 100]], { balance: 60, asOf: "2023-01-01" }), { today: TW }), state: "unknown" }, dollars0),
    "Its yearly return could not be worked out from these amounts: you put in $100, got nothing back yet, and it is worth $60 now.");
  const R = (f, extra) => PF.rowRate(PF.privateOf(fund(f, extra), { today: TW }));
  assert.deepEqual([R([], { balance: 1 }), R([["2026-06-01", "in", 50000]], { balance: 56000 }), R([["2021-01-01", "in", 100000]], { balance: 121000, asOf: "2023-01-01" }), R([["2021-01-01", "in", 100000]], { balance: 81000, asOf: "2023-01-01" }), R([["2020-01-01", "in", 5]], { balance: 0 })],
    [null, "up 12% so far", "about 10.0% a year", "lost about 10.0% a year", "nothing left"]);
  const all = (list) => ({ list, keepReady: list.reduce((s, r) => s + r.promised, 0) });
  const r1 = PF.privateOf(fund([["2021-01-01", "in", 100000]], { balance: 121000, asOf: "2023-01-01" }), { today: TW });
  assert.equal(PF.privateStatus(all([r1]), dollars0), "about 10.0% a year");
  assert.equal(PF.privateStatus(all([{ ...r1, promised: 40000 }]), dollars0), "keep $40,000 ready");
  assert.equal(PF.privateStatus(all([{ ...r1, promised: 1250000 }]), dollars0), "$1,250,000 promised", "at most 20 characters");
  assert.equal(PF.privateStatus(all([{ ...r1, state: "none" }]), dollars0), "not set yet");
  assert.equal(PF.privateStatus(all([r1, r1]), dollars0), "2 investments");
  assert.equal(PF.keepReadyAll(all([{ ...r1, promised: 40000 }, { ...r1, promised: 10000 }]), dollars0), "Keep $50,000 ready in all: money your investments can still ask you for.");
  assert.equal(PF.keepReadyAll(all([{ ...r1, promised: 40000 }]), dollars0), "");
  for (const s of ["keep $40,000 ready", "$1,250,000 promised", "about 10.0% a year", "not set yet", "2 investments"]) assert.ok(s.length <= 20, s);
});

test("a private investment's amounts: added in date order, a call paid comes off what is promised; removed; what is refused", () => {
  const p = emptyPlan();
  p.accounts.push({ ...fund([["2021-03-01", "in", 60000]], { balance: 200000 }), private: { flows: [{ id: "x0", date: "2021-03-01", kind: "in", amount: 60000 }], promised: 40000 } });
  assert.ok(PF.addFlow(p, "f1", { date: "2022-01-10", kind: "in", amount: 10000 }, "x1", { fromPromised: true }));
  assert.ok(PF.addFlow(p, "f1", { date: "2021-12-01", kind: "back", amount: 3000 }, "x2"));
  assert.deepEqual(p.accounts[0].private.flows.map((f) => [f.id, f.date]), [["x0", "2021-03-01"], ["x2", "2021-12-01"], ["x1", "2022-01-10"]]);
  assert.equal(p.accounts[0].private.promised, 30000, "40,000 - 10,000");
  PF.addFlow(p, "f1", { date: "2023-01-10", kind: "in", amount: 50000 }, "x3", { fromPromised: true });
  assert.ok(!("promised" in p.accounts[0].private), "a call bigger than what is left uses all of it");
  PF.addFlow(p, "f1", { date: "2023-02-10", kind: "back", amount: 5000 }, "x4", { fromPromised: true });
  assert.deepEqual(PF.removeFlow(p, "f1", "x4"), { id: "x4", date: "2023-02-10", kind: "back", amount: 5000 });
  assert.equal(PF.removeFlow(p, "f1", "nope"), null);
  assert.equal(PF.addFlow(p, "zz", { date: "2023-01-10", kind: "in", amount: 1 }, "y"), false);
  const no = (input, field, error) => assert.deepEqual(PF.planFlow(input, { today: TW }), { ok: false, field, error });
  no({ kind: "in", amount: "", date: "2026-01-01" }, "amount", "Type how much you put in.");
  no({ kind: "back", amount: 0, date: "2026-01-01" }, "amount", "Type how much it paid back.");
  no({ kind: "in", amount: 5, date: "" }, "date", "Type the day it happened.");
  no({ kind: "in", amount: 5, date: "2026-02-30" }, "date", "That day is not on the calendar: check the day and the month.");
  no({ kind: "in", amount: 5, date: "2026-11-17" }, "date", "Money that has not moved yet cannot be typed here: type it on its day.");
  assert.deepEqual(PF.planFlow({ kind: "back", amount: "1234.567", date: "2026-11-16" }, { today: TW }), { ok: true, flow: { date: "2026-11-16", kind: "back", amount: 1234.57 } });
  // the green lines name the new answer
  const r = PF.privateOf(p.accounts[0], { today: TW });
  assert.ok(r.irr > 0, String(r.irr));
  const lossy = PF.privateOf({ ...p.accounts[0], balance: 50000 }, { today: TW });
  assert.match(PF.flowAddedSaid({ date: "2023-01-10", kind: "in", amount: 50000 }, lossy, dollars0), /^Added: \$50,000 put into Fund II on Jan 10, 2023\. Its own return is now a loss of about \d+\.\d% a year\.$/);
  assert.equal(PF.flowAddedSaid({ date: "2023-01-10", kind: "in", amount: 50000 }, r, dollars0, undefined, { fromPromised: true }), `Added: $50,000 put into Fund II on Jan 10, 2023. Its own return is now about ${(Math.round(r.irr * 1000) / 10).toFixed(1)}% a year. Nothing is promised any more.`);
  assert.equal(PF.flowAddedSaid({ date: "2021-12-01", kind: "back", amount: 3000 }, { ...r, promised: 30000 }, dollars0), `Added: $3,000 paid back from Fund II on Dec 1, 2021. Its own return is now about ${(Math.round(r.irr * 1000) / 10).toFixed(1)}% a year.`);
  assert.equal(PF.flowAddedSaid({ date: "2026-10-01", kind: "in", amount: 10000 }, { ...r, promised: 30000 }, dollars0, undefined, { fromPromised: true }).endsWith(" Still promised: $30,000."), true);
  assert.equal(PF.flowAsk({ date: "2023-01-10", kind: "in", amount: 50000 }, dollars0), "Remove the $50,000 put in on Jan 10, 2023?");
  assert.equal(PF.flowRemovedSaid({ date: "2021-12-01", kind: "back", amount: 3000 }, PF.privateOf(fund([["2026-06-01", "in", 50000]], { balance: 56000 }), { today: TW }), dollars0), "Removed: the $3,000 paid back on Dec 1, 2021. Up 12% so far.");
  assert.equal(PF.flowTitle({ date: "2021-03-01", kind: "in" }), "Mar 1, 2021 · Put in");
  assert.equal(PF.flowTitle({ date: "2021-12-01", kind: "back" }), "Dec 1, 2021 · Paid back to you");
});

test("by weight and a private investment change no total: net worth reads the balance; compute adds metals and privates only when there are some", () => {
  const base = emptyPlan();
  base.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 10000 }, { id: "g1", name: "Gold coins", type: "other_asset", balance: 24000, asOf: TW });
  const plain = compute(base, { today: TW });
  const withKinds = structuredClone(base);
  withKinds.accounts[1].metal = { kind: "gold", weight: 10, unit: "oz", price: 2400 };
  const d = compute(withKinds, { today: TW });
  for (const k of Object.keys(plain)) assert.deepEqual(d[k], plain[k], k);
  assert.deepEqual(Object.keys(d).filter((k) => !(k in plain)), ["metals"]);
  assert.ok(!("metals" in plain) && !("privates" in plain) && !("keepReady" in plain));
});

/** Net worth drawn with a store that keeps its changes and draws again (as the app does), for the form and the new row. */
async function nwPage(plan, query = {}, today = TW) {
  const { FakeElement, textOf: tx } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const P = { plan: migrate(structuredClone(plan)), saved: [], textOf: tx };
  const route = { rest: [], query };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route, modules: new Map(), computeOf: (key, params = {}) => (key === "balance/net-worth" ? compute(P.plan, { today, ...params }) : null),
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: () => P.draw() }); return P; };
  P.text = () => tx(P.root);
  P.form = () => P.root.all().find((e) => e.tagName === "FORM");
  // a form sent as Save does it (the stand-in DOM has no reset; the add form clears itself after a save)
  P.submit = (f = P.form()) => { f.reset ??= () => {}; f.dispatch("submit"); };
  P.box = (n, within = P.root) => within.all().find((e) => e.getAttribute?.("name") === n) ?? null;
  P.label = (n) => P.box(n)?.closest("label");
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.button = (text, within = P.root) => within.all().find((e) => e.tagName === "BUTTON" && tx(e) === text);
  P.notice = (within = P.root) => within.all().filter((e) => String(e.className).split(/\s+/).includes("notice")).map((e) => tx(e));
  return P.draw();
}
const withAccount = () => { const p = emptyPlan(); p.household.people = [{ id: "p1", name: "Sam", role: "self", birthDate: "1990-01-01" }]; p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 5000, asOf: TW, history: [] }); return p; };

test("the form: What it is shows only for Something else I own; gold asks the weight and the price in place of the worth, saves the worth, says it in green with Undo", async () => {
  const P = await nwPage(withAccount(), { add: "checking" });
  for (const k of ["kindOf", "weight", "unit", "price", "promised"]) assert.equal(P.label(k).hidden, true, `${k} hidden for a checking account`);
  assert.ok(!/What it is|How much gold|Price of one ounce|Still promised/.test(P.text()), "nothing new said for another kind");
  P.box("type").value = "other_asset"; P.box("type").dispatch("change");
  assert.equal(P.label("kindOf").hidden, false);
  assert.match(P.text(), /What it is Something else: I type what it is worth Gold, by its weight Silver, by its weight A private fund, or a share in a business/);
  for (const k of ["weight", "unit", "price", "promised"]) assert.equal(P.label(k).hidden, true, k);
  P.box("kindOf").value = "gold"; P.box("kindOf").dispatch("change");
  for (const k of ["weight", "unit", "price"]) assert.equal(P.label(k).hidden, false, k);
  assert.equal(P.label("balance").hidden, true, "the worth is worked out");
  assert.equal(P.textOf(P.label("asOf").querySelector(".field-label")), "Price as of", "critic P4: not 'Price of that day'");
  assert.match(P.text(), /How much gold the metal's own weight: a one-ounce coin is 1 Weighed in ounces \(troy\) grams Price of one ounce \$ Type the price you see: this app never looks prices up\./);
  // nothing typed: refused, nothing saved
  P.box("name").value = "Gold coins";
  P.submit();
  assert.equal(P.saved.length, 0, "no weight: refused");
  P.box("weight").value = "10";
  P.submit();
  assert.equal(P.saved.length, 0, "no price: refused");
  P.box("price").value = "2400";
  P.submit();
  assert.equal(P.saved.length, 1);
  const g = P.plan.accounts.find((a) => a.name === "Gold coins");
  assert.deepEqual([g.type, g.balance, g.asOf, g.metal], ["other_asset", 24000, TW, { kind: "gold", weight: 10, unit: "oz", price: 2400 }]);
  assert.ok(!("kindOf" in g) && !("weight" in g) && !("price" in g) && !("promised" in g) && !("private" in g), "the boxes never go on the account as typed");
  assert.deepEqual(P.notice(), ["Gold coins added: 10 ounces of gold at $2,400.00 an ounce, $24,000. Undo"]);
  assert.match(P.text(), /Gold coins Edit Delete Something else I own \$24,000 10 ounces of gold at \$2,400\.00 an ounce, your price of 11\/16\/2026/);
  // Undo: off the list
  P.button("Undo").click();
  assert.ok(!P.plan.accounts.some((a) => a.name === "Gold coins"));
});

test("the form: grams of silver; editing the price works the worth out again (the old worth kept on its day); back to Something else drops the weight", async () => {
  const p = withAccount();
  p.accounts.push({ id: "s1", name: "Silver bar", type: "other_asset", balance: 1011.14, asOf: "2026-11-01", history: [], metal: { kind: "silver", weight: 1000, unit: "g", price: 31.45 } });
  const P = await nwPage(p, { edit: "s1" });
  assert.equal(P.box("kindOf").value, "silver");
  assert.equal(P.box("unit").value, "g");
  assert.equal(P.box("weight").value, "1000");
  assert.equal(P.textOf(P.label("weight").querySelector(".field-label")), "How much silver");
  assert.equal(P.label("balance").hidden, true);
  P.box("price").value = "32";
  P.box("asOf").value = TW;
  P.submit();
  const s = P.plan.accounts.find((a) => a.id === "s1");
  // 1,000 g = 32.1507466 oz x 32 = 1,028.82
  assert.deepEqual([s.balance, s.asOf, s.metal.price], [1028.82, TW, 32]);
  assert.deepEqual(s.history, [{ date: "2026-11-01", balance: 1011.14 }], "the old worth stays a point on its own day");
  assert.deepEqual(P.notice(), ["Silver bar saved: 1,000 grams of silver at $32.00 an ounce, $1,029. Undo"]);
  // back to "Something else": the worth is typed again and the weight is no longer kept
  const Q = await nwPage(P.plan, { edit: "s1" });
  Q.box("kindOf").value = ""; Q.box("kindOf").dispatch("change");
  assert.equal(Q.label("balance").hidden, false);
  Q.box("balance").value = "1100";
  Q.submit();
  const t = Q.plan.accounts.find((a) => a.id === "s1");
  assert.deepEqual([t.balance, "metal" in t], [1100, false]);
  // another Type puts the worth box back as it was
  const R = await nwPage(p, { edit: "s1" });
  R.box("type").value = "savings"; R.box("type").dispatch("change");
  assert.equal(R.label("balance").hidden, false);
  assert.equal(R.label("kindOf").hidden, true);
  assert.equal(R.textOf(R.label("asOf").querySelector(".field-label")), "Worth that on");
});

test("a private investment: added from the form, its row opens; amounts added name the new return in green with Undo; Remove asks first; promised is money to keep ready", async () => {
  const had = globalThis.window.confirm, asked = [];
  try {
    const P = await nwPage(withAccount(), { add: "checking" });
    P.box("type").value = "other_asset"; P.box("type").dispatch("change");
    P.box("kindOf").value = "private"; P.box("kindOf").dispatch("change");
    assert.equal(P.label("promised").hidden, false);
    // plain words, no "capital calls" (critic P3)
    assert.equal(P.textOf(P.label("promised")), "Still promised $ money you agreed to put in but have not put in yet; leave it empty if none");
    assert.ok(!/capital/i.test(P.text()), "no 'capital calls' on screen");
    assert.equal(P.textOf(P.label("balance").querySelector(".field-label")), "What it is worth now");
    P.box("name").value = "Fund II"; P.box("balance").value = "70000"; P.box("asOf").value = "2026-10-31"; P.box("promised").value = "40000";
    P.submit();
    const f = P.plan.accounts.find((a) => a.name === "Fund II");
    assert.deepEqual([f.type, f.balance, f.private], ["other_asset", 70000, { flows: [], promised: 40000 }]);
    assert.deepEqual(P.notice()[0], "Fund II added. Next: what you put in and when, under Private investments below. Undo");
    // the row under the list: open once, saying what to keep ready; the form open (nothing typed yet)
    const part = P.part("private");
    assert.equal(part.hasAttribute("open"), true);
    assert.equal(P.textOf(part.querySelector(".fold-title")), "Private investments");
    assert.equal(P.textOf(part.querySelector(".fold-status")), "keep $40,000 ready");
    assert.match(P.textOf(part), /Fund II Add what you put into Fund II and when, and what it paid back, to see its own yearly return\. Fund II can still ask you for \$40,000: keep that much ready, in cash or something easy to sell\. Add money in or out/);
    assert.match(P.text(), /It can still ask for \$40,000: keep that ready\./, "the row says it too");
    assert.equal(part.all().filter((e) => e.tagName === "BUTTON" && !String(e.className).includes("secondary")).length, 1, "one filled button: Add it");
    // 60,000 in on Mar 1, 2021 (not one of the calls promised)
    P.box("flowAmount").value = "60000"; P.box("flowDate").value = "2021-03-01"; P.box("fromPromised").checked = false;
    P.submit(P.part("private").all().find((e) => e.tagName === "FORM"));
    const r1 = PF.privateOf(P.plan.accounts.find((a) => a.name === "Fund II"), { today: TW });
    assert.equal(r1.state, "rate");
    assert.deepEqual(P.notice(P.part("private"))[0], `Added: $60,000 put into Fund II on Mar 1, 2021. Its own return is now about ${(Math.round(r1.irr * 1000) / 10).toFixed(1)}% a year.`);
    assert.equal(P.part("private").hasAttribute("open"), true, "the saved row stays open (R17)");
    assert.equal(P.plan.accounts.find((a) => a.name === "Fund II").private.promised, 40000, "not ticked: promised stays");
    assert.match(P.textOf(P.part("private")), /About \d+\.\d% a year since March 2021: you put in \$60,000, got nothing back yet, and it is worth \$70,000 now, 1\.17 times what you put in\./);
    assert.match(P.text(), /as of 10\/31\/2026 · about \d+\.\d% a year/);
    // a call paid: 10,000 in on Aug 1, 2026, ticked: off what is promised
    P.button("+ Add money in or out", P.part("private")).click();
    P.box("flowAmount").value = "10000"; P.box("flowDate").value = "2026-08-01";
    P.submit(P.part("private").all().find((e) => e.tagName === "FORM"));
    assert.equal(P.plan.accounts.find((a) => a.name === "Fund II").private.promised, 30000);
    assert.match(P.notice(P.part("private"))[0], /Still promised: \$30,000\.$/);
    assert.match(P.textOf(P.part("private")), /Fund II can still ask you for \$30,000: keep that much ready/);
    assert.ok(!/What it is worth is from/.test(P.textOf(P.part("private"))), "the worth (Oct 31) is newer than the call (Aug 1): no line about it");
    // Undo puts the call back, promised too
    P.button("Undo", P.part("private")).click();
    assert.equal(P.plan.accounts.find((a) => a.name === "Fund II").private.promised, 40000);
    assert.deepEqual(P.notice(P.part("private"))[0], "Undone: the amounts are back as they were.");
    // Remove asks first; No changes nothing
    globalThis.window.confirm = (t) => { asked.push(t); return false; };
    const n = P.saved.length;
    P.button("Remove", P.part("private")).click();
    assert.equal(P.saved.length, n);
    globalThis.window.confirm = (t) => { asked.push(t); return true; };
    P.button("Remove", P.part("private")).click();
    assert.deepEqual(asked, ["Remove the $60,000 put in on Mar 1, 2021?", "Remove the $60,000 put in on Mar 1, 2021?"]);
    assert.deepEqual(P.plan.accounts.find((a) => a.name === "Fund II").private.flows, []);
    assert.deepEqual(P.notice(P.part("private"))[0], "Removed: the $60,000 put in on Mar 1, 2021.");
    assert.ok(P.button("Undo", P.part("private")), "with Undo under it");
  } finally { globalThis.window.confirm = had; }
});

test("a private investment saved as something else asks first when its amounts would be lost", async () => {
  const had = globalThis.window.confirm, asked = [];
  try {
    const p = withAccount();
    p.accounts.push({ ...fund([["2021-03-01", "in", 60000]], { balance: 70000 }), history: [] });
    const P = await nwPage(p, { edit: "f1" });
    assert.equal(P.box("kindOf").value, "private");
    P.box("kindOf").value = ""; P.box("kindOf").dispatch("change");
    globalThis.window.confirm = (t) => { asked.push(t); return false; };
    P.submit();
    assert.equal(P.saved.length, 0);
    assert.deepEqual(asked, ["Fund II has 1 amount put in or paid back on file. Saved as something else, it is no longer kept. Save it anyway?"]);
    globalThis.window.confirm = () => true;
    P.submit();
    assert.ok(!("private" in P.plan.accounts.find((a) => a.id === "f1")));
  } finally { globalThis.window.confirm = had; }
});
