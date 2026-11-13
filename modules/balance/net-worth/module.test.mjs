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
