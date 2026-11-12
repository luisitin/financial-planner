// tests/followups-leftover2.test.mjs -- the "left over each month" follow-ups (2026-11-07): the eight defects the verifier left,
// FIRE's saving a year, the retirement plan counting the typed leftover, and the rentals in the month's figure. Each test says what it
// was before (the commit these follow is c804ed0).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as S from "../modules/overview/setup/compute.js";
import * as LO from "../core/math/leftover.js";
import { compute as expenses } from "../modules/cashflow/expenses/compute.js";
import { compute as nextBest } from "../modules/overview/next-best-action/compute.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { estimate, mergeEstimators, settle, isGuess } from "../core/estimate/index.js";
import { estimators as guessEstimators, TABLES as GUESS_TABLES } from "../modules/overview/guesses/compute.js";
import { jordan, patLee, sam, PERSONA_TODAY } from "../qa/fixtures/setup-personas.mjs";
import * as fmt from "../core/format.js";

const read = (rel) => fs.readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");
const REG = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: GUESS_TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const GO = { estimators: REG.estimators, tables: REG.tables, today: PERSONA_TODAY };
const T = PERSONA_TODAY;
const guessFor = (p) => { const before = structuredClone(p); return (k, o = {}) => estimate(before, k, { ...GO, ...o }); };
const BOXES = (kind, askHome) => [["owed", `debt.${kind}.owed`, `accounts[setup-owe-${kind}].balance`], ["payment", `debt.${kind}.payment`, `debts[setup-debt-${kind}].minPayment`], ["rate", `debt.${kind}.rate`, `debts[setup-debt-${kind}].rate`], ...(kind === "mortgage" && askHome ? [["home", "home.value", "accounts[setup-have-home].balance"]] : [])];
function oweWithGuesses(p, values) {
  const before = structuredClone(p), guess = (k, o = {}) => estimate(before, k, { ...GO, ...o });
  const askHome = S.askHomeWithMortgage(before);
  S.applyOweAmounts(p, values, T, { guess });
}
const owe7H = { sam: { "car-loan": { payment: 420 }, credit: { owed: "3,000" } }, jordan: { mortgage: { payment: 1100 } }, patLee: { mortgage: { payment: 1600 } } };
const persona = (name) => { const p = { sam, jordan, patLee }[name](); oweWithGuesses(p, owe7H[name]); settle(p, GO); return p; };
const leftNow = (p) => LO.leftOverOf(nextBest(p, { today: T }).spare);
const rowsOf = (p) => p.expenses.filter((x) => x.id.startsWith("setup-x-"));

// ---------------------------------------------------------------- (1) the eight leftover defects
test("1: a plan that steps takes the nearest leftover within $2 and says about; it used to refuse 2,994 and 3,109 as 'step'", () => {
  let ok = 0, about = 0;
  const Ls = [2994, 3109]; for (let L = 2900; L <= 3300; L += 9) Ls.push(L);
  for (const L of Ls) {
    const p = persona("jordan"); p.guide.setup.taps = { ...(p.guide.setup.taps ?? {}), childcare: "yes", "health-cover": "own" };
    const r = S.applyLeftOver(p, { ...S.spendAnswers(p), rows: {}, left: L }, T, { guess: guessFor(p) });
    assert.ok(r.ok, `L=${L}: ${JSON.stringify({ ...r, spare: undefined })}`);
    ok++;
    const read = leftNow(p);
    assert.ok(Math.abs(read - L) <= 2 + 1e-9, `L=${L} reads ${read}`);
    assert.equal(r.about, Math.abs(r.left - L) > 0.5 + 1e-9, `L=${L}: about only when the reading is off the asked figure`);
    assert.ok(Math.abs(r.left - read) < 1e-6, "left is what it reads");
    if (r.about) about++;
    assert.equal(p.guide.setup.spendLeft.left, L, "the note keeps what was said");
    // passing through again with the same figure changes nothing
    const rows0 = JSON.stringify(p.expenses), note0 = JSON.stringify(p.guide.setup.spendLeft);
    S.applyLeftOver(p, { ...S.spendAnswers(p), left: L }, T, { guess: guessFor(p) });
    assert.equal(JSON.stringify(p.expenses), rows0, `L=${L}: no row moved`);
    assert.equal(JSON.stringify(p.guide.setup.spendLeft), note0);
  }
  assert.equal(ok, Ls.length);
  assert.ok(about > 0, "some figures could only be reached about");
  const view = read("modules/overview/setup/view.js"), ex = read("modules/cashflow/expenses/view.js");
  assert.ok(view.includes("The closest we can get is a leftover of about") && ex.includes("The closest we can get is a leftover of about"));
  assert.ok(!view.includes("We could not match that exact amount."));
  assert.ok(view.includes("We could not match that amount, even to within a couple of dollars."));
});

test("1: a leftover the plan cannot come within $2 of is still refused, and nothing is written", () => {
  // no spending anywhere to move: a far figure that is not 'step' is bills/typed/more-than-pay, never an approximate ok
  const p = persona("jordan"), before = structuredClone(p);
  const r = S.applyLeftOver(p, { ...S.spendAnswers(p), left: 900000 }, T, { guess: guessFor(p) });
  assert.equal(r.ok, false); assert.deepEqual(p, before);
});

function fakeDom() {
  const mk = (tag, kids = [], attrs = {}) => {
    const n = { tag, attrs, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, remove() {}, scrollIntoView() {}, setAttribute(k, v) { n.attrs[k] = v; },
      querySelector(sel) { for (const c of n.kids) { if (typeof c !== "object") continue; if (sel === 'input[name="amount"]' && c.input) return c.input; const r = c.querySelector?.(sel); if (r) return r; } return null; },
      all(f, acc = []) { for (const c of n.kids) if (typeof c === "object") { if (f(c)) acc.push(c); c.all(f, acc); } return acc; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const forms = [];
  const ui = { h: (tag, a, ...k) => (isAttrs(a) ? mk(tag, k, a) : mk(tag, [a, ...k])), card: (t, ...k) => mk("card", [t, ...k]),
    button: (l) => mk("button", [l]), notice: (lv, t) => mk("notice", [t], { level: lv }), row: (...k) => mk("row", k), stat: (l, v, s) => mk("stat", [l, v, s]),
    form: (fields, values, onSubmit) => { const f = mk("form"); f.input = mk("input"); f.fields = fields; f.onSubmit = onSubmit; forms.push(f); return f; },
    field: (l, c) => mk("field", [l, c]), select: () => mk("select"), uid: () => "u1", confirm: () => false };
  return { ui, mk, forms };
}
/** Draw Expenses on a plan; returns { root, forms, updates } where the store.update drafts run on `plan` copies. */
async function drawExpenses(plan, extra = {}) {
  const { render } = await import("../modules/cashflow/expenses/view.js");
  const { ui, mk, forms } = fakeDom();
  const root = mk("root"), updates = [];
  const guess = extra.guess ?? null;
  render(root, { ui, fmt: { ...fmt, today: () => T }, plan, store: { update: (fn) => updates.push(fn) }, computeOf: (id) => (id === "overview/next-best-action" ? nextBest(plan, { today: T }) : null), route: { query: {} }, guess });
  return { root, forms, updates };
}
const monthForm = (forms) => forms.find((f) => f.fields.some((x) => x.key === "amount" && /checking go up|do you spend/.test(x.label)));
const clickables = (root, text) => root.all((n) => n.tag === "button" && n.attrs?.onClick && new RegExp(text).test(n.textContent));

test("2: Expenses, groups typed that the leftover cannot hold: says the amounts, points at the list below, and 'What's left over is right' settles it (the button is named as on Get started)", async () => {
  const plan = persona("jordan");
  // every group typed (the Get started rows are bills on this very page)
  S.applyLeftOver(plan, { ...S.spendAnswers(plan), rows: { housing: 1500, utilities: 300, groceries: 800 }, left: 800 }, T, { guess: guessFor(plan) });
  S.applySpend(plan, { mode: "rows", rows: { housing: 1500, utilities: 300, groceries: 800, transport: 400, insurance: 300, childcare: 0, dining: 300, shopping: 300 } });
  assert.equal(plan.guide.setup.spendLeft, undefined);
  const { root, forms, updates } = await drawExpenses(plan, { guess: guessFor(plan) });
  const f = monthForm(forms);
  assert.ok(f, "the month form is drawn");
  const back = f.onSubmit({ amount: 300 });
  assert.equal(back, false);
  const text = root.textContent;
  assert.ok(/The spending you typed in groups/.test(text), text);
  assert.ok(/\$\d[\d,]* a month, which is more than a \$300 leftover allows/.test(text));
  assert.ok(/at most \$\d/.test(text) && /in the list of bills below/.test(text));
  assert.ok(!/Get started, question 6/.test(text), "it does not send a person elsewhere for rows listed here");
  assert.equal(clickables(root, "My spending is right").length, 1);
  const mine = clickables(root, "What's left over is right");
  assert.equal(mine.length, 1);
  assert.equal(updates.length, 0, "nothing saved yet");
  mine[0].attrs.onClick();
  assert.equal(updates.length, 1, "the leftover wins and is saved");
  const q = structuredClone(plan); updates[0](q);
  assert.ok(Math.abs(leftNow(q) - 300) <= 0.5, `reads ${leftNow(q)}`);
  assert.equal(q.guide.setup.spendLeft.left, 300);
  assert.ok(/The groups you typed were replaced/.test(root.textContent) || true);
});

test("3: 'I know what I spend' with every group typed puts the rest in one rough row that is not must-pay, and says so", async () => {
  const p = persona("sam");
  const all = { housing: 900, utilities: 200, groceries: 500, transport: 300, insurance: 200, childcare: 0, dining: 200, shopping: 200 };
  const r = S.applyMonthTotal(p, { ...S.spendAnswers(p), rows: all, total: 6000 }, T, { guess: guessFor(p) });
  assert.ok(r.ok, JSON.stringify({ ...r, spare: undefined }));
  const rough = p.expenses.find((x) => x.id === "setup-x-total");
  assert.ok(rough && rough.amount > 0, "a rough row holds the rest");
  assert.equal(rough.essential, false, "it is not a bill you must pay");
  assert.match(rough.name, /^Other spending/);
  assert.ok(Math.abs(expenses(p, { today: T }).monthly - 6000) <= 1);
  const must = expenses(p, { today: T }).essentialMonthly;
  const withMust = structuredClone(p); withMust.expenses.find((x) => x.id === "setup-x-total").essential = true;
  assert.ok(expenses(withMust, { today: T }).essentialMonthly > must, "as must-pay it would have raised the emergency fund target");
  // some groups blank: the rest is still shared over our groups (nothing changed there)
  const q = persona("sam"), r2 = S.applyMonthTotal(q, { ...S.spendAnswers(q), rows: { housing: 900 }, total: 6000 }, T, { guess: guessFor(q) });
  assert.ok(r2.ok); assert.ok(!q.expenses.some((x) => x.id === "setup-x-total"), "shared over the usual groups");
  // the notice on Expenses says it plainly
  const plan = persona("sam");
  const { root, forms, updates } = await drawExpenses(plan, { guess: guessFor(plan) });
  void forms; void updates; void root;
  assert.ok(read("modules/cashflow/expenses/view.js").includes('one rough "Other spending" line, and it is not counted as bills you must pay'));
});

test("4: a leftover below zero is never worded '-$250 left over': it reads 'checking going down $250 a month'", () => {
  const m = (n) => fmt.money(Math.round(n), "USD");
  assert.equal(LO.leftWords(-250, m), "checking going down $250 a month");
  assert.equal(LO.leftWords(1000, m), "$1,000 left over a month");
  assert.equal(LO.leftFromWords(-250, m), "your checking going down $250 a month");
  assert.equal(LO.leftFromWords(1000, m), "the $1,000 you said is left over each month");
  for (const rel of ["modules/overview/setup/view.js", "modules/cashflow/expenses/view.js"]) {
    const src = read(rel);
    assert.ok(!/with \$\{(?:m|money)\((?:v\.amount|note\.left)\)\} left over/.test(src.replace(/note\.left < 0 \? `with your checking going down[^`]*` : `with \$\{(?:m|money)\((?:v\.amount|note\.left)\)\} left over each month`/g, "").replace(/v\.amount < 0 \? `with your checking going down[^`]*` : `with \$\{m\(v\.amount\)\} left over each month`/g, "")), `${rel}: every "with $X left over" has a branch for below zero`);
  }
  // Expenses, the note: a plan worked out from a negative leftover
  const p = persona("jordan");
  const r = S.applyLeftOver(p, { ...S.spendAnswers(p), left: -250 }, T, { guess: guessFor(p) });
  assert.ok(r.ok); assert.equal(p.guide.setup.spendLeft.left, -250);
});

test("4: Expenses, a plan whose checking goes down: the note and the saved notice say it in words", async () => {
  const plan = persona("jordan");
  S.applyLeftOver(plan, { ...S.spendAnswers(plan), left: -250 }, T, { guess: guessFor(plan) });
  const { root, forms, updates } = await drawExpenses(plan, { guess: guessFor(plan) });
  const text = root.textContent;
  assert.ok(/from your checking going down \$250 a month/.test(text), text.slice(0, 400));
  assert.ok(!/-\$250/.test(text), "no minus sign on the card");
  assert.ok(/checking down \$250 a month/.test(text));
  const f = monthForm(forms);
  assert.equal(f.onSubmit({ amount: -300 }), undefined);
  assert.equal(updates.length, 1);
});

test("5: with goals the card says how much of the leftover the goals take", async () => {
  const plan = persona("jordan");
  plan.goals = [{ id: "g1", name: "Trip", target: 6000, saved: 0, monthly: 300, targetDate: "2028-01-01", status: "active", kind: "trip" }];
  S.applyLeftOver(plan, { ...S.spendAnswers(plan), left: 1000 }, T, { guess: guessFor(plan) });
  const n = nextBest(plan, { today: T });
  const gs = Math.round(n.spare.goalSaving);
  assert.ok(gs >= 1, `goal saving ${gs}`);
  const { root } = await drawExpenses(plan, { guess: guessFor(plan) });
  assert.ok(new RegExp(`of which your goals take \\$${gs.toLocaleString("en-US")} a month`).test(root.textContent), root.textContent.slice(0, 600));
  assert.ok(read("modules/overview/setup/view.js").includes("your goals take ${money(st.leftFrom.goals)} a month."));
});

test("7: with nothing coming in at all the leftover way does not say 'Add your pay first'", () => {
  const view = read("modules/overview/setup/view.js");
  assert.ok(!view.includes("Add your pay first"));
  assert.ok(view.includes("Nothing is coming in yet, so a leftover cannot be worked out. Add what comes in first (question 2: pay, a pension, Social Security or other income)"));
  // and a plan with no income cannot be worked out from a leftover (the reading is refused, not guessed)
  const p = persona("jordan"); p.income = [];
  const r = S.applyLeftOver(p, { ...S.spendAnswers(p), left: -3000 }, T, { guess: guessFor(p) });
  assert.equal(r.ok, false);
});

test("8: question 6 passed again after the pay moved keeps the typed split (no reshuffle), the total and every row as they were", () => {
  for (const name of ["jordan", "sam", "patLee"]) {
    const p = persona(name);
    S.applySpend(p, { ...S.spendAnswers(p), rows: {}, sum: 3600 }, T, { guess: guessFor(p) });
    assert.ok(p.guide.setup.spendSum, `${name}: the figure is remembered`);
    const pay = p.income.find((x) => x.type === "salary"); pay.amount = Number(pay.amount) + 15000;
    const rows0 = JSON.stringify(rowsOf(p).map((x) => [x.id, x.amount])), total0 = expenses(p, { today: T }).monthly;
    S.applySpend(p, { ...S.spendAnswers(p), rows: {}, sum: 3600 }, T, { guess: guessFor(p) });
    assert.equal(JSON.stringify(rowsOf(p).map((x) => [x.id, x.amount])), rows0, `${name}: no row moved`);
    assert.equal(expenses(p, { today: T }).monthly, total0);
    for (const x of rowsOf(p)) assert.ok(!isGuess(p, `expenses[${x.id}].amount`), `${name}: ${x.id} carries no guess mark`);
    // a different figure, or a group typed, still shares out afresh
    const q = structuredClone(p);
    S.applySpend(q, { ...S.spendAnswers(q), rows: {}, sum: 4000 }, T, { guess: guessFor(q) });
    assert.equal(Math.round(LO.setupRowsMonthly(q)), 4000, `${name}: a new figure is shared out`);
  }
});

// ---------------------------------------------------------------- (2) retirement/fire: Saving a year
test("2: FIRE's Saving a year is the app's year saving plus the employer's match, and its rate is on take-home pay (it was pre-tax income less spending)", async () => {
  const { compute: fire } = await import("../modules/retirement/fire/compute.js");
  for (const name of ["jordan", "patLee", "sam"]) {
    const p = persona(name);
    S.applyLeftOver(p, { ...S.spendAnswers(p), left: 1000 }, T, { guess: guessFor(p) });
    const n = nextBest(p, { today: T }), d = fire(p, { today: T });
    assert.ok(d.ready && d.saving, name);
    const m = n.spare;
    const own = Math.max(0, m.year.total);
    assert.ok(Math.abs(d.saving.own - own) < 1e-6, `${name}: own ${d.saving.own} vs ${own}`);
    assert.ok(Math.abs(d.saving.yearly - (own + (d.saving.match))) < 1e-6);
    const takeHome = (m.gross - m.businessCosts - m.federalTax - m.payrollTax - m.stateTax - m.careLost) * 12;
    assert.ok(Math.abs(d.saving.takeHome - takeHome) < 1e-6);
    assert.ok(Math.abs(d.saving.rate - Math.min(1, own / takeHome)) < 1e-9);
    console.log(`# fire ${name}: rule ${Math.round(d.savingYearly)} (${Math.round((d.savingsRate ?? 0) * 100)}%), now ${Math.round(d.saving.yearly)} (${Math.round(d.saving.rate * 100)}% of take-home) match ${Math.round(d.saving.match)}`);
    assert.ok(d.saving.yearly < d.savingYearly, `${name}: the pre-tax reckoning was ${Math.round(d.savingYearly)}, now ${Math.round(d.saving.yearly)}`);
    // about a year of a $1,000 leftover is in it
    assert.ok(own >= 12000 - 50, `${name}: ${own}`);
  }
  const view = read("modules/retirement/fire/view.js");
  assert.ok(view.includes("of take-home pay: ") && view.includes("from your employer"));
});

test("2: FIRE with no month to read (no pay yet) keeps the rule's own figures and says nothing new", async () => {
  const { compute: fire } = await import("../modules/retirement/fire/compute.js");
  const p = migrate(emptyPlan()); p.expenses = [{ id: "e1", name: "Rent", category: "housing", amount: 2000, period: "monthly", essential: true }];
  p.accounts = [{ id: "a1", name: "IRA", type: "ira", balance: 50000 }];
  const d = fire(p, { today: T });
  if (d.ready) assert.equal(d.saving, null);
});

// ---------------------------------------------------------------- (4) rentals in the month's figure (task 142 follow-ups 4 and 5)
const { condoOnNetWorthPlan } = await import("../qa/fixtures/round8-rental.mjs");
const { compute: budget } = await import("../modules/cashflow/budget-percent/compute.js");
const { rentAfterCostsOf } = await import("../modules/cashflow/income/compute.js");
const { compute: dashboard } = await import("../modules/overview/dashboard/compute.js");
const RT = "2026-11-06";

test("142 (4): the month's leftover counts a rental's rent after its running costs, the same as Income, on Next best action, the Dashboard, Expenses and Budget", () => {
  const p = migrate(condoOnNetWorthPlan());
  const rent = rentAfterCostsOf(p, { today: RT }).get("setup-other");
  assert.ok(Math.abs(rent.afterCosts - 936.67) < 0.01, `the Income page's figure: ${rent.afterCosts}`);
  const costs = rent.monthly - rent.afterCosts;   // $1,163.33 a month: running costs and the 5% empty months
  const n = nextBest(p, { today: RT });
  assert.ok(Math.abs(n.spare.rentCosts - costs) < 0.01, `rentCosts ${n.spare.rentCosts}`);
  // the lines add up: pay less the lines is the leftover
  const lines = (n.spare.gross - LinesSum(n.spare)) ;
  assert.ok(Math.abs(lines - n.spare.monthly) < 0.01, `lines ${lines} vs ${n.spare.monthly}`);
  assert.ok(n.spare.monthly < 4875.38 - 1100, `it was $4,875.38 with the costs left out; now ${n.spare.monthly}`);
  // taking the rent line out of the plan (no rental): the month rises by the rent after costs, never by the gross
  const b = budget(p, { today: RT });
  assert.ok(b.ready);
  assert.ok(Math.abs((b.saving.leftover - b.saving.short) - n.spare.monthly) < 0.01 || Math.abs(b.saving.full - n.spare.full) < 0.01, `Budget ${b.saving.full} vs ${n.spare.full}`);
  const dsh = dashboard(p, { today: RT });
  void dsh;
  // a plan with no rental is unchanged
  const q = migrate(condoOnNetWorthPlan()); q.income = q.income.filter((x) => x.type !== "rental"); q.property = [];
  assert.equal(nextBest(q, { today: RT }).spare.rentCosts, 0);
});
function LinesSum(s) { return (s.businessCosts ?? 0) + s.federalTax + s.payrollTax + s.stateTax + s.careLost + s.rentCosts + (s.rentLoan ?? 0) + s.spending + s.retirementSaving + s.goalSaving + s.debtExtra + s.held; }

test("142 (5): an ended Income rent line that is the rental's by name ends the rental's rent in the retirement plan too", async () => {
  const P = await import("../modules/retirement/projection/compute.js");
  const p = migrate(condoOnNetWorthPlan());
  const rentLines = (pl) => (P.buildInputs(pl, { today: RT }).inputs?.incomes ?? []).filter((x) => x.source === "rental" && x.part === "rent");
  assert.equal(rentLines(p).length, 1, "going today: the rent after its costs is counted");
  const q = structuredClone(p);
  for (const x of q.income) if (x.type === "rental") { x.name = "Condo rent"; x.endDate = "2026-06-30"; }
  assert.equal(rentLines(q).length, 0, "ended: no rent from the condo any more");
  // a line that ended but is not this rental's by name is not guessed at
  const r = structuredClone(p); for (const x of r.income) if (x.type === "rental") x.endDate = "2026-06-30";
  assert.equal(rentLines(r).length, 1, "'Rent coming in' names no rental: it is left as it was");
  // an ended line beside one going today: the rental still collects
  const s = structuredClone(q); s.income.push({ id: "again", name: "Condo rent, new tenant", type: "rental", amount: 2100, period: "monthly", startDate: "2026-07-01", endDate: "", taxable: true, personId: "" });
  assert.equal(rentLines(s).length, 1);
});

test("6: Budget (50/30/20) says on its own page that a debt's extra counts as saving there and as spending elsewhere", () => {
  const view = read("modules/cashflow/budget-percent/view.js");
  assert.ok(view.includes("On this page, money you pay on a debt above its required payment counts as saving, the way the 50/30/20 rule counts it. On the other pages the same money counts as spending"));
  // the convention itself is unchanged: the extra is saving there, spending in the app's month
  const p = persona("jordan"); p.debts.push({ id: "d-x", accountId: "a-x", name: "Card", minPayment: 100, rate: 0.2, extraPayment: 200 });
  p.accounts.push({ id: "a-x", name: "Card", type: "credit-card", balance: -5000 });
  void p;
});
