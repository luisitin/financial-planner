import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import * as fmt from "../../../core/format.js";

const tx = (id, date, amount, category, payee = "x") => ({ id, date, amount, payee, accountId: "chk", category });
function plan() {
  const p = emptyPlan();
  p.transactions.push(
    tx("1", "2026-09-02", -120, "groceries"), tx("2", "2026-09-09", -95, "groceries"), tx("3", "2026-09-05", -60, "dining"), tx("4", "2026-09-01", -1500, "housing"), tx("5", "2026-09-03", 1950, "income-salary"),
    tx("6", "2026-08-10", -380, "groceries"), tx("7", "2026-08-12", -140, "dining"), tx("8", "2026-07-10", -420, "groceries"), tx("9", "2026-06-10", -400, "groceries"), tx("10", "2026-08-01", -1500, "housing"),
  );
  p.budgets.push({ id: "b1", category: "groceries", amount: 450, period: "monthly", rollover: true }, { id: "b2", category: "dining", amount: 100, period: "monthly", rollover: false });
  return p;
}
test("no month: nothing; a month with envelopes: spent, left, pace, rollover", () => {
  assert.equal(compute(emptyPlan()).hasData, false);
  const d = compute(plan(), { today: "2026-09-15" });
  assert.equal(d.month, "2026-09"); assert.equal(d.label, "Sep 2026"); assert.equal(d.dayOfMonth, 15); assert.equal(d.daysInMonth, 30); assert.equal(d.daysLeft, 15);
  const g = d.envelopes.find((e) => e.category === "groceries"), n = d.envelopes.find((e) => e.category === "dining");
  assert.equal(g.spent, 215); assert.equal(g.carried, 70, "August: 450 - 380 unspent rolled over"); assert.equal(g.available, 520); assert.equal(g.left, 305); assert.equal(g.pace, "on");
  assert.equal(n.spent, 60); assert.equal(n.carried, 0, "no rollover"); assert.equal(n.pace, "ahead", "60 of 100 by mid-month is faster than half");
  assert.equal(d.totals.spent, 275); assert.equal(d.totals.available, 620); assert.equal(d.totals.left, 345);
  assert.deepEqual(d.unbudgeted.map((u) => u.category), ["housing"]);
  // the lines start on Jun 10, so June is not a whole month: July and August are averaged, and "2 months" is what it was divided by
  assert.deepEqual(d.suggestFrom, ["2026-08", "2026-07"]);
  assert.equal(d.suggestions.find((s) => s.category === "housing").average, 750, "1500 once over the two whole months");
  assert.equal(d.suggestions.find((s) => s.category === "housing").months, 2);
  assert.equal(d.suggestions.find((s) => s.category === "groceries"), undefined, "already budgeted");
});
test("over budget and a past month", () => {
  const p = plan();
  p.transactions.push(tx("11", "2026-09-12", -90, "dining"));
  let d = compute(p, { today: "2026-09-15" });
  assert.equal(d.envelopes.find((e) => e.category === "dining").pace, "over");
  d = compute(p, { today: "2026-09-15", month: "2026-08" });
  assert.equal(d.dayOfMonth, 31); assert.equal(d.daysLeft, 0);
  assert.equal(d.envelopes.find((e) => e.category === "groceries").carried, 30, "July: 450 - 420");
});
test("a file with no whole month suggests nothing; a file that stops days before today is stale", () => {
  const p = emptyPlan();
  // a file downloaded on Sep 2 covering Aug 12 to Sep 2: no whole month, so no averages of a part of a month
  p.transactions.push(tx("a", "2026-08-12", -70, "groceries"), tx("b", "2026-08-20", -640, "debt"), tx("c", "2026-09-02", -40, "groceries"));
  let d = compute(p, { today: "2026-09-02" });
  assert.deepEqual(d.suggestFrom, []); assert.deepEqual(d.suggestions, []);
  assert.equal(d.stale, false, "the file reaches today");
  d = compute(p, { today: "2026-09-20" });
  assert.equal(d.stale, true, "18 days of September are not in the file yet");
  assert.equal(compute(p, { today: "2026-09-04" }).stale, false, "two days behind is normal (the bank posts late)");
  assert.equal(compute(p, { today: "2026-10-03" }).stale, true, "a new month the files do not reach yet");
  assert.equal(compute(p, { today: "2026-10-03", month: "2026-09" }).stale, false, "only this month's spent-so-far is affected");
});

test("a bill paid once a month reads paid, not spending fast; two payments or less than 90% still pace as before", () => {
  const p = plan();
  p.budgets.push({ id: "b3", category: "housing", amount: 1500, period: "monthly", rollover: false });
  let d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "paid", "the mortgage on the 1st, as in August");
  // one big grocery trip on the 2nd is not a bill: last month had several payments there
  p.transactions.push(tx("13", "2026-09-02", -400, "groceries"), tx("14", "2026-09-02", -50, "dining"));
  p.budgets.find((b) => b.id === "b1").amount = 200;
  const g = compute(p, { today: "2026-09-02" }).envelopes.find((e) => e.category === "groceries");
  assert.notEqual(g.pace, "paid");
  p.transactions = p.transactions.filter((t) => !["13", "14"].includes(t.id)); p.budgets.find((b) => b.id === "b1").amount = 450;
  p.budgets.find((b) => b.id === "b3").amount = 2000;   // 1,500 of 2,000 is 75%: still fast on the 2nd
  d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "ahead");
  p.budgets.find((b) => b.id === "b3").amount = 1500;
  p.transactions.push(tx("12", "2026-09-02", -100, "housing"));   // two payments, 1,600 of 1,500: over
  d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "over");
});

test("no envelopes and no whole bank month: start from Expenses' amounts, added in one go (round 4)", async () => {
  const { useExpenses } = await import("./compute.js");
  const { compute: expenses } = await import("../expenses/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T); p.transactions = []; p.budgets = [];
  const d = compute(p, { today: T });
  const ex = expenses(p, { today: T });
  assert.equal(d.fromExpenses.length, ex.byCategory.length);
  assert.deepEqual(d.fromExpenses[0], { category: "housing", label: "Rent or mortgage", icon: "🏠", amount: 1980 });
  assert.ok(d.fromExpenses.some((x) => x.category === "debt"), "debt payments count as spending to budget");
  assert.ok(Math.abs(d.fromExpensesTotal - ex.monthly) <= d.fromExpenses.length * 0.5, `${d.fromExpensesTotal} vs ${ex.monthly}`);
  // one tap: an envelope each, never twice
  let k = 0; const id = () => `b${++k}`;
  assert.equal(useExpenses(p, d.fromExpenses, id), d.fromExpenses.length);
  assert.equal(useExpenses(p, d.fromExpenses, id), 0);
  assert.equal(p.budgets.find((b) => b.category === "groceries").amount, d.fromExpenses.find((x) => x.category === "groceries").amount);
  // with envelopes, or with a whole bank month to average, it is not offered
  assert.deepEqual(compute(p, { today: T }).fromExpenses, []);
});

// The page drawn with a stand-in for the UI kit: every element keeps its children, so the words on screen can be read
// back as text without a browser (review 2026-11-02, round 5).
function drawText(render, plan, computeOf, today) {
  const node = (tag, kids = []) => {
    const n = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, remove() {}, scrollIntoView() {}, set innerHTML(v) { n.kids = []; void v; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]),
    row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), field: (l, c) => node("field", [l, c]), select: () => node("select"), uid: () => "u", confirm: () => false };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} }, computeOf, route: { query: {} } });
  return root.textContent.replace(/\s+/g, " ");
}

test("Start from your expenses: short only in a lean month says so, with the full month to the nearest $10 (review 2026-11-02, round 5)", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  // the family's $600 of photography counted at $0, no envelopes and no bank file; spending set so a full month leaves `left`
  const at = (left, countOn = 0) => {
    const p = familyPlan(D); p.budgets = []; p.transactions = [];
    const x = p.income.find((y) => y.id === "i-side"); if (countOn !== null) x.countOn = countOn;
    const s = next(p, { today: D }).spare;
    p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false });
    return p;
  };
  const text = (p) => drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), D);
  const lean = at(297), s = next(lean, { today: D }).spare;
  assert.ok(s.monthly < 0 && s.held > 0.5);
  assert.match(text(lean), new RegExp(`In a lean month, these, tax and your saving come to about \\${fmt.money(-s.monthly)} more than comes in, counting uneven pay at what you can count on: the same gap as the Dashboard\\. A month that brings the Income page's amount leaves about \\$300\\.`));
  assert.match(text(at(-120)), /Even a month that brings the Income page's amount is about \$120 short\./);
  // nothing held back: the plain sentence
  const plain = at(-100, null);
  assert.match(text(plain), /These, tax and your saving come to about \$100 a month more than comes in: the same gap as the Dashboard\./);
  assert.doesNotMatch(text(plain), /lean month/);
});

test("Start from your expenses: a full month within $5 of $0 'only just about breaks even', never 'about $0' (review 2026-11-02, round 5)", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  const at = (left) => {
    const p = familyPlan(D); p.budgets = []; p.transactions = [];
    p.income.find((y) => y.id === "i-side").countOn = 0;
    const s = next(p, { today: D }).spare;
    p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false });
    return p;
  };
  for (const left of [3, -2]) {
    const p = at(left);
    const text = drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), D);
    assert.match(text, /Even a month that brings the Income page's amount only just about breaks even\./);
    assert.doesNotMatch(text, /about \$0\b/);
  }
});

// ---- a month with a hole in an account's files is not averaged; a card's missing file is in no category (2026-11-02)
test("suggestions skip a month with a hole between two files, and say which; the hand-worked averages", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 1 });
  // groceries $10 every day from Jul 1 to Sep 30, rent $1,000 on the 1st; the second file starts Aug 20, 10 days after the first
  // stops: 9 days with nothing, more than a quiet spell (more than 7 and more than 2 x the daily spacing; re-check 4)
  for (let t = Date.UTC(2026, 6, 1), n = 0; t <= Date.UTC(2026, 8, 30); t += 864e5, n++) { const d = new Date(t).toISOString().slice(0, 10); if (d < "2026-08-11" || d > "2026-08-19") p.transactions.push(tx(`g${n}`, d, -10, "groceries")); }
  for (const ym of ["2026-07", "2026-08", "2026-09"]) p.transactions.push(tx(`r${ym}`, `${ym}-01`, -1000, "housing"));
  p.imports = [{ id: "a", accountId: "chk", from: "2026-07-01", to: "2026-08-10" }, { id: "b", accountId: "chk", from: "2026-08-20", to: "2026-09-30" }];
  const d = compute(p, { today: "2026-10-05" });
  assert.deepEqual(d.suggestFrom, ["2026-09", "2026-07"]);
  assert.deepEqual(d.suggestSkipped.map((s) => [s.ym, s.holes[0].from, s.holes[0].to, s.holes[0].days]), [["2026-08", "2026-08-11", "2026-08-19", 9]]);
  // groceries: (310 in July + 300 in September) / 2 = 305; rent: (1000 + 1000) / 2
  assert.equal(d.suggestions.find((s) => s.category === "groceries").average, 305);
  assert.equal(d.suggestions.find((s) => s.category === "housing").average, 1000);
  assert.equal(d.suggestions[0].months, 2);
  // the files joined up (the second from Aug 11): August counts again
  p.imports[1].from = "2026-08-11";
  assert.deepEqual(compute(p, { today: "2026-10-05" }).suggestFrom, ["2026-09", "2026-08", "2026-07"]);
  // a 4-day gap with nothing usual due in it (the second file from Aug 15) is a quiet spell at a file's edge, not a hole
  p.imports[1].from = "2026-08-15"; p.transactions = p.transactions.filter((t) => !(t.date >= "2026-08-11" && t.date <= "2026-08-14"));
  assert.deepEqual(compute(p, { today: "2026-10-05" }).suggestFrom, ["2026-09", "2026-08", "2026-07"]);
});
test("the sample family in November: August is left out (the 1st and 2nd are missing), the mortgage reads $1,980, the Visa is apart", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.budgets = [];
  const d = compute(p, { today: T });
  assert.deepEqual(d.suggestFrom, ["2026-10", "2026-09"]);
  assert.deepEqual(d.suggestSkipped.map((s) => [s.ym, s.holes[0].whole.from, s.holes[0].whole.to]), [["2026-08", "2026-07-31", "2026-08-02"]]);
  assert.equal(d.suggestions.find((s) => s.category === "housing").average, 1980, "two mortgages over two months, not two over three");
  assert.equal(d.suggestions.find((s) => s.category === "dining").average, 94, "$93.60 each month from checking");
  assert.ok(!d.suggestions.some((s) => s.category === "card-unimported" || /not imported/.test(s.label)), "the card's payments are in no category");
  // what went to the Visa in September and October, a month: (2,980.55 + 2,610.30) / 2 = 2,795.43
  assert.deepEqual(d.suggestCards.map((c) => [c.cardId, c.name, c.average, c.months]), [["a-visa", "Visa card", 2795, 2]]);
  // October's page: the payment is spending with no envelope, one line for the card, never an envelope to add
  const oct = compute(p, { today: T, month: "2026-10" });
  const card = oct.unbudgeted.find((u) => u.card);
  assert.deepEqual([card.label, card.category, card.cardId], ["Visa card, details not imported yet", "", "a-visa"]);
  assert.ok(Math.abs(card.spent - 2610.3) < 0.005);
});
// ---- round-5 review (2026-11-02): a card file that starts late is left out with its reason; a card file for some months only
test("the Visa's file from 8/20: August is left out for both reasons; the suggestions average September and October", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-20", "2026-10-31"); p.budgets = [];
  const d = compute(p, { today: T });
  assert.deepEqual(d.suggestFrom, ["2026-10", "2026-09"]);
  assert.deepEqual(d.suggestSkipped.map((s) => [s.ym, s.issues.map((x) => x.why)]), [["2026-08", ["Chase checking has no lines from 7/31 to 8/2", "Visa card's lines start on 8/20"]]]);
  // eating out: checking's $93.60 a month plus the Visa's 30 and 31 dinners of $30: (93.60 + 900 + 93.60 + 930) / 2 = 1,008.60
  assert.equal(d.suggestions.find((s) => s.category === "dining").average, 1009);
  assert.deepEqual(d.suggestCards, [], "the Visa's file covers both months");
});
test("the Visa's file for September only: what went to it in October is named as October's, not 'a month'", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-09-01", "2026-09-30"); p.budgets = [];
  const d = compute(p, { today: T });
  assert.deepEqual(d.suggestFrom, ["2026-10", "2026-09"]);
  assert.deepEqual(d.suggestCards.map((c) => [c.cardId, c.inMonths, c.total, c.average, c.months]), [["a-visa", ["2026-10"], 2610.3, 1305, 2]]);
});
// ---- re-check of the card patch (2026-11-02)
test("finding 4: a quiet savings account (interest on 7/31 and 10/31) and no card: suggestions from August to October, none skipped", () => {
  return import("../../../qa/fixtures/card-gap-plan.mjs").then(({ cardGapPlan }) => {
    const T = "2026-11-02";
    const p = cardGapPlan(T); p.accounts = p.accounts.filter((a) => a.type !== "credit"); p.budgets = [];
    p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01" && !/CRD AUTOPAY/.test(t.rawPayee));
    for (const [i, d] of ["2026-07-31", "2026-10-31"].entries()) p.transactions.push({ id: `iq${i}`, date: d, amount: 12, payee: "INTEREST PAID", rawPayee: "INTEREST PAID", accountId: "a-sav", category: "income-interest", tags: [], note: "" });
    const d = compute(p, { today: T });
    assert.deepEqual([d.suggestFrom, d.suggestSkipped, d.suggestCards], [["2026-10", "2026-09", "2026-08"], [], []]);
  });
});
test("finding 2: the Visa file stopping on 10/10 leaves October out of the suggestions; the 10/14 payment is no stand-in", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-01", "2026-10-10"); p.budgets = [];
  const d = compute(p, { today: T });
  assert.deepEqual(d.suggestFrom, ["2026-09"]);
  assert.deepEqual(d.suggestSkipped.map((s) => [s.ym, s.issues.map((x) => x.why)]), [["2026-10", ["Visa card's lines stop on 10/10"]], ["2026-08", ["Chase checking has no lines from 7/31 to 8/2"]]]);
  assert.deepEqual(d.suggestCards, []);
  assert.equal(compute(p, { today: T, month: "2026-10" }).unbudgeted.find((u) => u.card), undefined);
});

// --- re-check 4: one rule for holes, and a payment counted for neither card ---
test("money 1 (re-check 4): one checking file a month, each from its first to its last line: suggestions from August to October (groceries $997)", async () => {
  const { cardGapPlan, noCardFromAug, oneFileAMonth } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = noCardFromAug(cardGapPlan(T)); p.budgets = [];
  p.transactions = p.transactions.filter((t) => t.date !== "2026-09-28" && t.date !== "2026-09-30");
  oneFileAMonth(p, "a-chk");
  const d = compute(p, { today: T, month: "2026-11" });
  assert.deepEqual([d.suggestFrom, d.suggestSkipped], [["2026-10", "2026-09", "2026-08"], []]);
  assert.equal(d.suggestions.find((s) => s.category === "groceries").average, 997);
});
test("money 4 (re-check 4): a payment for one of two Chase cards: no suggestions from those months, and October says why in one sentence", async () => {
  const { cardGapPlan, anAccount } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.budgets = []; p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const d = compute(p, { today: T, month: "2026-11" });
  assert.deepEqual(d.suggestFrom, []);
  assert.deepEqual(d.suggestSkipped.map((s) => [s.ym, s.issues[0].why]), [
    ["2026-10", "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought"],
    ["2026-09", "$2,981 went to one of your Chase cards in September; bring in the card files to see what it bought"],
    ["2026-08", "$2,450 went to one of your Chase cards in August; bring in the card files to see what it bought"]]);
  assert.equal(compute(p, { today: T, month: "2026-10" }).unsure, "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought.");
});

// --- re-check 5 (2026-11-05): two cards at one bank, no files: Budget's note is true and says why no month is suggested from
test("re-check 5, defect 4: two Chase cards with no files: 'start from Expenses', and August to October are left out for the cards", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { cardGapPlan, anAccount } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.budgets = []; p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const d = compute(p, { today: T });
  assert.deepEqual(d.suggestFrom, []);
  assert.ok(d.fromExpenses.length > 0);
  // one short reason for the months a payment counted for neither card keeps out (ledger gapIssues' `brief`)
  assert.deepEqual(d.suggestSkipped.map((s) => [s.ym, s.issues[0].kind, s.issues[0].brief]), ["2026-10", "2026-09", "2026-08"].map((ym) => [ym, "unsure", "money went to your Chase cards, whose files aren't in"]));
  const text = drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), T);
  // (the checking file reaches November 1, so Safe to spend leads the page and the reason sits in the card it explains, gap #5)
  assert.match(text, /^About \$[\d,]+ is free to spend until Sunday\./);
  assert.match(text, /Start from your expenses Your bank files have no whole month to suggest amounts from yet\. August to October 2026 are left out: money went to your Chase cards, whose files aren't in\./);
  assert.doesNotMatch(text, /once a bank file is in/);
  // with no bank file at all the old words stay true
  const q = cardGapPlan(T, { withFile: false }); q.budgets = []; q.transactions = [];
  assert.match(drawText(render, q, (key, params) => (key === "overview/next-best-action" ? next(q, params) : null), T), /Spending against each envelope shows once a bank file is in\./);
});

// ================================================================ Safe to spend (gap #5, 2026-11-13)
// A household in June 2026 (the 1st is a Monday; 30 days). The month's after-tax money comes from Next best action's
// `spare`; here a stand-in with round figures so every sum can be done by hand:
//   take-home = spare.monthly + spending + retirement + goals + extra = 1,000 + 2,800 + 500 + 200 + 100 = 4,600
//   must-pay bills (kinds marked must-pay on the categories list) = rent 1,500 + groceries 600 + car insurance 1,200 / 12 = 2,200
//   set aside for yearly costs that are not must-pay (Irregular expenses) = summer trip 2,400 / 12 = 200
//   free for June = 4,600 - 2,200 - 200 - (500 + 200) - 100 = 1,400
const { safeToSpend, nextPayday, envelopeWords, SAFE_SPANS } = await import("./compute.js");
const SPARE = { monthly: 1000, spending: 2800, retirementSaving: 500, goalSaving: 200, debtExtra: 100 };
function june(lines = []) {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 5000 });
  p.expenses.push(
    { id: "e1", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true },
    { id: "e2", name: "Food", category: "groceries", amount: 600, period: "monthly", essential: true },
    { id: "e3", name: "Eating out", category: "dining", amount: 400, period: "monthly", essential: false },
    { id: "e4", name: "Summer trip", category: "travel", amount: 2400, period: "annual", essential: false },
    { id: "e5", name: "Car insurance", category: "insurance", amount: 1200, period: "annual", essential: true });
  p.transactions.push(...lines);
  return p;
}
const J1 = [tx("r", "2026-06-01", -1500, "housing"), tx("d1", "2026-06-01", -50, "dining")];

test("gap #5, test 1: on the first day of a 30-day month, the week figure = left x 7 / 30 (the plan's month)", () => {
  const s = safeToSpend(june(J1), { today: "2026-06-01", spare: SPARE });
  assert.equal(s.drawn, true); assert.equal(s.mode, "plan");
  assert.deepEqual([s.plan.takeHome, s.plan.mustPay, s.plan.setAside, s.plan.retirement + s.plan.goals, s.plan.debtExtra], [4600, 2200, 200, 700, 100]);
  assert.equal(s.planned, 1400);
  assert.equal(s.spent, 50); assert.equal(s.left, 1350);
  assert.deepEqual([s.daysInMonth, s.daysLeft, s.span, s.rawDays, s.days, s.cut, s.until], [30, 30, "week", 7, 7, false, "2026-06-07"]);
  assert.equal(s.safe, 1350 * 7 / 30);
  assert.equal(s.about, 320, "$315, to the nearest $10 above $100");
  assert.deepEqual(s.plan.mustPayKinds, ["Rent or mortgage", "Groceries", "Insurance"]);
  // the spare can be handed over as a function (the page works Next best action out only when it is needed)
  assert.equal(safeToSpend(june(J1), { today: "2026-06-01", spare: () => SPARE }).safe, s.safe);
});

test("gap #5, test 2: a bill already paid in the ledger is not taken twice; a yearly cost paid comes from what was set aside", () => {
  const without = safeToSpend(june([tx("d1", "2026-06-01", -50, "dining")]), { today: "2026-06-01", spare: SPARE });
  const withRent = safeToSpend(june(J1), { today: "2026-06-01", spare: SPARE });
  assert.equal(withRent.spent, without.spent); assert.equal(withRent.planned, without.planned);
  assert.equal(withRent.billsPaid, 1500);
  // the summer trip paid on the 1st (within 10% of its $2,400) is the set-aside's, not this week's money; one more trip line is spending
  const trip = safeToSpend(june([...J1, tx("t1", "2026-06-01", -2350, "travel"), tx("t2", "2026-06-01", -100, "travel")]), { today: "2026-06-01", spare: SPARE });
  assert.deepEqual([trip.setAsidePaid, trip.spent, trip.left], [2350, 150, 1250]);
  // a yearly charge the bank lines show (no Expenses row): set aside a twelfth, and its own line is not this month's spending
  const p = june([...J1, tx("y1", "2025-06-03", -139, "subscriptions", "PRIME MEMBERSHIP"), tx("y2", "2026-06-03", -139, "subscriptions", "PRIME MEMBERSHIP")]);
  const y = safeToSpend(p, { today: "2026-06-03", spare: SPARE });
  assert.ok(Math.abs(y.plan.setAside - (200 + 139 / 12)) < 1e-9, String(y.plan.setAside));
  assert.deepEqual([y.setAsidePaid, y.spent], [139, 50]);
});

test("gap #5, test 3: transfers between your own accounts are ignored; money out not sorted yet counts as spent", () => {
  const base = safeToSpend(june(J1), { today: "2026-06-01", spare: SPARE });
  const moved = safeToSpend(june([...J1, tx("x", "2026-06-01", -400, "transfer"), { ...tx("x2", "2026-06-01", -300, ""), transferId: "x3" }]), { today: "2026-06-01", spare: SPARE });
  assert.equal(moved.spent, base.spent);
  const unsorted = safeToSpend(june([...J1, tx("u", "2026-06-01", -25, "")]), { today: "2026-06-01", spare: SPARE });
  assert.equal(unsorted.spent, base.spent + 25);
});

test("gap #5, test 4 and the cases: one written sentence per case (R5)", () => {
  const at = (lines, today, opts = {}) => safeToSpend(june(lines), { today, spare: SPARE, ...opts });
  // ok, by span
  let s = at(J1, "2026-06-01");
  assert.deepEqual([s.kind, s.words.headline, s.words.second], ["ok", "About $320 is free to spend until Sunday.", "That keeps your bills and saving covered to the end of June."]);
  assert.equal(at(J1, "2026-06-01", { span: "today" }).words.headline, "About $45 is free to spend today.", "1,350 / 30");
  // Sunday: this week is today
  s = at([...J1, tx("s", "2026-06-28", -1, "dining")], "2026-06-28");
  assert.deepEqual([s.rawDays, s.words.headline], [1, `About $${Math.round(s.left / 3)} is free to spend today.`]);
  // Monday the 29th: the week runs past the month's end, so it stops there
  s = at([...J1, tx("m", "2026-06-29", -1, "dining")], "2026-06-29");
  assert.deepEqual([s.rawDays, s.days, s.cut, s.words.headline], [7, 2, true, `About $${(Math.round(s.left / 10) * 10).toLocaleString("en-US")} is free to spend to the end of June.`]);
  assert.equal(s.safe, s.left, "the whole of what is left: the days left are the span");
  // under $100: to the dollar
  assert.equal(at([...J1, tx("big", "2026-06-01", -1300, "shopping")], "2026-06-01").words.headline, "About $12 is free to spend until Sunday.", "(1,400 - 1,350) x 7 / 30 = 11.67");
  // all spent, and past it (test 4): the alarm
  s = at([...J1, tx("big", "2026-06-01", -1350, "shopping")], "2026-06-01");
  assert.deepEqual([s.kind, s.words.headline, s.words.second, s.about], ["spent", "This month's free money is all spent.", "Anything more this month comes out of the money for bills and saving.", 0]);
  s = at([...J1, tx("big", "2026-06-01", -1490, "shopping")], "2026-06-01");
  assert.deepEqual([s.kind, s.left, s.words.headline, s.words.second, s.safe], ["over", -140, "Spending is $140 past this month's plan.", "Unless more comes in, that $140 comes out of the money for bills and saving.", 0]);
  // the plan's month has nothing free: said as that, not as spending past the plan
  s = safeToSpend(june(J1), { today: "2026-06-01", spare: { ...SPARE, monthly: -1500 } });
  assert.deepEqual([s.kind, s.planned, s.words.headline, s.words.second], ["short", -1100, "Nothing is free to spend this month.", "Your bills and saving need more than comes in after tax."]);
  // envelopes: their own second sentence
  const e = june(J1); e.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false });
  s = safeToSpend(e, { today: "2026-06-01" });
  assert.deepEqual([s.mode, s.planned, s.spent, s.words.headline, s.words.second], ["envelopes", 300, 50, "About $58 is free to spend until Sunday.", "That keeps your spending within your envelopes to the end of June."]);
  // a reason to doubt the figure is said (R9): our guesses in the bills; a month mostly of guesses gives no figure at all
  assert.deepEqual(at(J1, "2026-06-01", { spare: { ...SPARE, guessedMonthly: 300 } }).words.doubt, ["Some of the bills it sets aside are our guesses."]);
  assert.deepEqual(at(J1, "2026-06-01", { spare: { ...SPARE, guessedMonthly: 2000, waits: true } }), { drawn: false, why: "guesses" });
});

test("gap #5: a card whose own file is missing is said, not guessed at", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = cardGapPlan("2026-11-02"); p.budgets = [];
  const s = safeToSpend(p, { today: "2026-10-15", spare: SPARE });
  assert.equal(s.drawn, true);
  assert.deepEqual(s.words.doubt, ["It leaves out the $2,610 that went to Visa card this month: its own file isn't in yet."]);
});

test("gap #5: the envelopes that are not bills are the planned money; bills, rollover and spending with no envelope", () => {
  const p = june([...J1, tx("m1", "2026-05-12", -100, "dining"), tx("m2", "2026-05-02", -1500, "housing"), tx("g", "2026-06-01", -200, "groceries"), tx("sh", "2026-06-01", -30, "shopping")]);
  p.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: true }, { id: "b2", category: "groceries", amount: 600, period: "monthly", rollover: false });
  const s = safeToSpend(p, { today: "2026-06-01" });
  // dining 300 + May's unspent 200 rolled over; groceries is a bill; shopping has no envelope but is not a bill: spent
  assert.deepEqual([s.mode, s.planned, s.spent, s.billsPaid, s.left], ["envelopes", 500, 80, 1700, 420]);
  assert.deepEqual(s.envelopes, [{ label: "Eating out", available: 500 }]);
  // only bill envelopes: the plan's month decides (an envelope list of bills says nothing about the rest)
  p.budgets = [{ id: "b2", category: "groceries", amount: 600, period: "monthly", rollover: false }];
  assert.equal(safeToSpend(p, { today: "2026-06-01", spare: SPARE }).mode, "plan");
  assert.deepEqual(safeToSpend(p, { today: "2026-06-01" }), { drawn: false, why: "plan" }, "no after-tax month to plan with");
});

test("gap #5, test 5: nothing to measure, nothing drawn", () => {
  assert.deepEqual(safeToSpend(emptyPlan(), { today: "2026-06-01", spare: SPARE }), { drawn: false, why: "no files" });
  const e = emptyPlan(); e.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false });
  assert.equal(safeToSpend(e, { today: "2026-06-01" }).drawn, false, "envelopes alone: nothing spent is known");
  // files that stop more than 3 days ago, or start after the 4th, do not measure the month so far
  assert.deepEqual(safeToSpend(june(J1), { today: "2026-06-05", spare: SPARE }), { drawn: false, why: "files" });
  assert.equal(safeToSpend(june(J1), { today: "2026-06-04", spare: SPARE }).drawn, true, "3 days behind is the bank's usual delay");
  assert.equal(safeToSpend(june([tx("late", "2026-06-05", -10, "dining")]), { today: "2026-06-05", spare: SPARE }).drawn, false);
  assert.equal(safeToSpend(june([tx("may", "2026-05-31", -10, "dining")]), { today: "2026-06-02", spare: SPARE }).drawn, true, "May's file reaching the 31st covers June 1 and 2");
  // another month than today's, or no date
  assert.deepEqual(safeToSpend(june(J1), { today: "2026-06-01", month: "2026-05", spare: SPARE }), { drawn: false, why: "another month" });
  assert.deepEqual(safeToSpend(june(J1), { spare: SPARE }), { drawn: false, why: "no date" });
});

test("gap #5, test 6: until payday uses the next payday and stops at the month's end; no payday, no chip", () => {
  const p = june(J1);
  assert.deepEqual(safeToSpend(p, { today: "2026-06-01", spare: SPARE }).spans, ["today", "week"]);
  p.income.push({ id: "i1", name: "My pay", type: "salary", personId: "", amount: 2000, period: "biweekly", payday: "2026-05-29" });
  let s = safeToSpend(p, { today: "2026-06-01", spare: SPARE, span: "payday" });
  assert.deepEqual([s.spans, s.nextPayday, s.rawDays, s.days, s.cut], [SAFE_SPANS, "2026-06-12", 11, 11, false]);
  assert.equal(s.safe, 1350 * 11 / 30);
  assert.equal(s.words.headline, "About $500 is free to spend until payday on June 12.");
  // the span is read from the plan's choice (whatIfs.safeSpend) when the page does not pass one
  p.whatIfs = { safeSpend: { span: "payday" } };
  assert.equal(safeToSpend(p, { today: "2026-06-01", spare: SPARE }).span, "payday");
  // a payday after the month's end: the days left in the month
  const q = june([...J1, tx("l", "2026-06-25", -1, "dining")]);
  q.income.push({ id: "i2", type: "salary", personId: "", amount: 5000, period: "monthly", payday: "2026-05-05" });
  q.whatIfs = { safeSpend: { span: "payday" } };
  s = safeToSpend(q, { today: "2026-06-25", spare: SPARE });
  assert.deepEqual([s.nextPayday, s.rawDays, s.daysLeft, s.days, s.cut, s.safe], ["2026-07-05", 10, 6, 6, true, s.left]);
  assert.match(s.words.headline, /^About \$[\d,]+ is free to spend to the end of June\.$/);
  // a saved "payday" with no payday known any more: this week
  q.income = [];
  assert.equal(safeToSpend(q, { today: "2026-06-25", spare: SPARE }).span, "week");
});

test("gap #5: the next payday on each rhythm, never before the pay starts or after it ends", () => {
  const P = (...income) => ({ income });
  const inc = (period, payday, extra = {}) => ({ id: `i-${period}-${payday}`, type: "salary", personId: "", amount: 1000, period, payday, ...extra });
  assert.equal(nextPayday(P(inc("biweekly", "2026-05-29")), "2026-06-12"), "2026-06-26", "strictly after today");
  assert.equal(nextPayday(P(inc("weekly", "2026-06-03")), "2026-06-01"), "2026-06-03", "a payday typed ahead of today");
  assert.deepEqual(["2026-06-01", "2026-06-15", "2026-06-30"].map((t) => nextPayday(P(inc("semimonthly", "2026-05-15")), t)), ["2026-06-15", "2026-06-30", "2026-07-15"]);
  assert.deepEqual(["2026-02-10", "2026-03-01"].map((t) => nextPayday(P(inc("monthly", "2026-01-31")), t)), ["2026-02-28", "2026-03-31"]);
  assert.equal(nextPayday(P(inc("annual", "2026-05-29")), "2026-06-01"), "2026-06-12", "a year's salary is paid every two weeks (payRhythm)");
  assert.equal(nextPayday(P(inc("annual", "2026-05-29", { type: "pension" })), "2026-06-01"), "2026-06-29", "a pension typed as a year comes monthly");
  assert.equal(nextPayday(P(inc("biweekly", "2026-05-29", { endDate: "2026-06-10" })), "2026-06-01"), null, "ended before its next payday");
  assert.equal(nextPayday(P(inc("biweekly", "2026-05-29", { startDate: "2026-06-20" })), "2026-06-01"), "2026-06-26", "not before it starts");
  assert.equal(nextPayday(P(inc("monthly", "2026-05-20"), inc("biweekly", "2026-05-29")), "2026-06-01"), "2026-06-12", "the soonest of two");
  assert.equal(nextPayday(P(inc("once", "2026-05-29"), { ...inc("monthly", "x"), payday: "" }), "2026-06-01"), null);
});

test("opt C19: what the envelopes say, one written sentence per case", () => {
  const env = (envelopes, extra = {}) => ({ month: "2026-06", daysLeft: 18, envelopes, totals: { left: envelopes.reduce((t, e) => t + e.left, 0) }, ...extra });
  const E = (label, left) => ({ label, left });
  const T = { today: "2026-06-12" };
  assert.deepEqual(envelopeWords(env([E("Groceries", 300), E("Eating out", 40)]), T), { head: "$340 is left in your envelopes.", more: "Every envelope is within its amount, with 18 days to go." });
  assert.deepEqual(envelopeWords(env([E("Groceries", -40), E("Eating out", 100)]), T), { head: "$60 is left in your envelopes.", more: "Over on Groceries by $40, with 18 days to go." });
  assert.deepEqual(envelopeWords(env([E("Fun", -10), E("Groceries", -100), E("Eating out", -40), E("Gifts", -5)]), T), { head: "Your envelopes are $155 over.", more: "Over on Groceries by $100, Eating out by $40 and 2 more, with 18 days to go." });
  assert.deepEqual(envelopeWords(env([E("Groceries", -100), E("Eating out", -40)], { daysLeft: 1 }), T).more, "Over on Groceries by $100 and Eating out by $40, with 1 day to go.");
  assert.equal(envelopeWords(env([E("Groceries", 5)], { daysLeft: 0 }), T).more, "Every envelope is within its amount, with today left.");
  // a past month, in its own tense
  assert.deepEqual(envelopeWords(env([E("Groceries", 120)], { daysLeft: 0 }), { today: "2026-07-02" }), { head: "$120 was left in your envelopes in June.", more: "Every envelope stayed within its amount." });
  assert.deepEqual(envelopeWords(env([E("Groceries", -140)], { daysLeft: 0 }), { today: "2026-07-02" }), { head: "Your envelopes went $140 over in June.", more: "Over on Groceries by $140." });
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
test("gap #5 invariance: compute() is the same with or without the saved span, over every household and fixture plan", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-13";
  const plans = [["family", familyPlan(T)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ["cardGap", cardGapPlan("2026-11-02")], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 19);
  const KEYS = ["month", "label", "dayOfMonth", "daysInMonth", "daysLeft", "envelopes", "totals", "unbudgeted", "suggestions", "hasBudget", "hasData", "suggestFrom", "suggestSkipped", "suggestCards", "unsure", "cover", "stale", "fromExpenses", "fromExpensesTotal"];
  for (const [name, p0] of plans) for (const today of [T, "2026-11-02"]) {
    const p = migrate(structuredClone(p0));
    const before = JSON.stringify(compute(p, { today }));
    assert.deepEqual(Object.keys(compute(p, { today })), KEYS, name);
    for (const span of SAFE_SPANS) {
      const q = structuredClone(p); q.whatIfs = { ...(q.whatIfs ?? {}), safeSpend: { span } };
      assert.equal(JSON.stringify(compute(q, { today })), before, `${name} ${today} ${span}: the saved span changes nothing else`);
    }
    // the saved span changes Safe to spend's span only; absent, it is this week
    const s0 = safeToSpend(p, { today, spare: SPARE });
    const w = structuredClone(p); w.whatIfs = { ...(w.whatIfs ?? {}), safeSpend: { span: "week" } };
    assert.equal(JSON.stringify(safeToSpend(w, { today, spare: SPARE })), JSON.stringify(s0), name);
  }
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const kit = await import("../../../core/ui/dom.js");
const { migrate: migrateFor } = await import("../../../core/schema/migrate.js");
const { render: renderBudget } = await import("./view.js");
/** Draw the page as the shell does: store.update records the draft and draws again; Next best action is a stand-in. */
function page(plan0, { today = "2026-06-01", query = {}, spare = SPARE } = {}) {
  let plan = migrateFor(structuredClone(plan0));
  const route = { group: "cashflow", id: "budget", rest: [], query };
  const s = { saved: [], root: null, redraws: 0 };
  const ctx = () => ({ ui: kit, fmt: { ...fmt, today: () => today }, plan, route,
    store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } },
    computeOf: (key) => (key === "overview/next-best-action" ? (spare ? { ready: true, spare: { held: 0, ...spare } } : { ready: false }) : null),
    redraw: () => { s.redraws++; draw(); } });
  const draw = () => { s.root = new FakeElement("main"); renderBudget(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const everything = (el) => [el, ...el.all()];
const isOpen = (d) => d.hasAttribute("open");
const partsOf = (root) => everything(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partNamed = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
/** The words a person sees without opening anything: a shut part shows only its summary. */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !isOpen(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const words = (el) => { const walk = (n) => (n.data !== undefined ? n.data : n.childNodes.map(walk).join(" ")); return walk(el).replace(/\s+/g, " ").trim(); };
const chipsIn = (root, id) => everything(root).find((e) => e.dataset?.choice === id)?.all().filter((e) => e.tagName === "BUTTON") ?? [];
const h1Of = (root) => everything(root).find((e) => e.tagName === "H1")?.textContent;
const okLine = (root) => everything(root).find((e) => e.tagName === "DIV" && e.className === "notice ok")?.textContent ?? null;
/** Filled buttons outside shut parts (a link styled as a button counts; outlined, chips and small ones do not). */
const filled = (root) => everything(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|danger|small|ghost|link/.test(e.className) && !e.closest("details"));

test("gap #5 on the page: the headline, its sentence and the span chips; How this is worked out one tap away, each figure linked", () => {
  const s = page(june(J1));
  assert.equal(h1Of(s.root), "About $320 is free to spend until Sunday.");
  assert.match(seen(s.root), /^About \$320 is free to spend until Sunday\. That keeps your bills and saving covered to the end of June\. Today This week Month/);
  const chips = chipsIn(s.root, "safeSpan");
  assert.deepEqual(chips.map((b) => [b.textContent, b.className]), [["Today", "chip"], ["This week", "chip on"]], "no payday known: no Until payday");
  // one part, shut, saying where the figure comes from; the sum inside with each figure linked to its page
  const how = partNamed(s.root, "how");
  assert.deepEqual([partsOf(s.root).filter((p) => p.parentNode?.parentNode?.dataset?.parts !== undefined).length, how.querySelector(".fold-title").textContent, how.querySelector(".fold-status").textContent, isOpen(how)], [1, "How this is worked out", "from your plan", false]);
  assert.equal(words(how).replace(/^How this is worked out from your plan › /, ""),
    "Money in after tax The same month the Dashboard uses. $4,600 Must-pay bills Rent or mortgage, Groceries, Insurance - $2,200 Set aside for yearly and one-time costs - $200 Saving for retirement and goals $500 for retirement, $200 for goals - $700 Extra on debts - $100 Free for June $1,400 Spent so far on everything else June 1 to today, from your bank files - $50 Left for June $1,350 Of the 30 days left in June (today included), the 7 days through Sunday: $1,350 × 7 ÷ 30 = $315, about $320. Spending on must-pay kinds (rent, groceries, the car, insurance and the like) is not counted as spent here: it is set aside above. A yearly or one-time cost paid this month comes from what was set aside for it. Money out that is not sorted into a kind yet counts as spent, so the figure errs low.");
  assert.deepEqual(how.all().filter((e) => e.tagName === "A").map((a) => a.getAttribute("href")), ["#/cashflow/income", "#/cashflow/expenses", "#/cashflow/sinking-funds", "#/goals/goals", "#/debt/payoff", "#/transactions/ledger?month=2026-06"]);
  // R16: opening or shutting saves nothing
  how.setAttribute("open", ""); how.dispatch("toggle"); how.removeAttribute("open"); how.dispatch("toggle");
  assert.equal(s.saved.length, 0);
  assert.ok(filled(s.root).length <= 1, filled(s.root).map((b) => b.textContent).join(", "));
  // "More on this": the deeper pages as questions
  assert.match(seen(s.root), /More on this Where did my money go this month\? › What do my yearly bills need each month\? › Prefer one simple rule\? Needs, wants and savings ›$/);
});

test("gap #5 on the page, R7: a span chip saves only whatIfs.safeSpend, and the green line names the new answer", () => {
  const p = june(J1); p.income.push({ id: "i1", name: "My pay", type: "salary", personId: "", amount: 2000, period: "biweekly", payday: "2026-05-29" });
  const s = page(p);
  assert.deepEqual(chipsIn(s.root, "safeSpan").map((b) => b.textContent), ["Today", "This week", "Until payday"]);
  assert.equal(okLine(s.root), null, "no green line before a save");
  chipsIn(s.root, "safeSpan").find((b) => b.textContent === "Today").click();
  assert.equal(s.saved.length, 1);
  assert.deepEqual(s.plan().whatIfs.safeSpend, { span: "today" });
  const was = migrateFor(structuredClone(p)), now = structuredClone(s.plan());
  delete now.whatIfs.safeSpend; delete was.meta; delete now.meta;
  assert.deepEqual(now, { ...was, whatIfs: { ...(was.whatIfs ?? {}) } }, "nothing else in the plan changed");
  assert.equal(okLine(s.root), "Saved. About $45 is free to spend today.");
  assert.equal(h1Of(s.root), "About $45 is free to spend today.");
  assert.equal(chipsIn(s.root, "safeSpan").find((b) => b.className === "chip on").textContent, "Today");
  // the chip already on does nothing; the payday chip: the days until the day before payday
  chipsIn(s.root, "safeSpan").find((b) => b.textContent === "Today").click();
  assert.equal(s.saved.length, 1);
  chipsIn(s.root, "safeSpan").find((b) => b.textContent === "Until payday").click();
  assert.equal(okLine(s.root), "Saved. About $500 is free to spend until payday on June 12.");
  assert.ok(!isOpen(partNamed(s.root, "how")), "no part opened by the save (R17)");
});

test("gap #5 on the page: at or past zero the alarm leads, in amber, with no chips; a past month says its own envelopes", () => {
  const s = page(june([...J1, tx("big", "2026-06-01", -1490, "shopping")]));
  assert.equal(h1Of(s.root), "Spending is $140 past this month's plan.");
  assert.equal(everything(s.root).find((e) => e.className === "notice warn")?.textContent, "Unless more comes in, that $140 comes out of the money for bills and saving.");
  assert.deepEqual(chipsIn(s.root, "safeSpan"), []);
  assert.doesNotMatch(words(partNamed(s.root, "how")), /about \$/, "no span sum when nothing is free");
  // envelopes, a month looked back on from the Monthly review's link: no Safe to spend, the envelopes' own sentence
  const e = june([...J1, tx("m1", "2026-05-12", -340, "dining")]); e.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false });
  const back = page(e, { query: { month: "2026-05" } });
  assert.equal(h1Of(back.root), "Your envelopes went $40 over in May.");
  assert.match(seen(back.root), /^Your envelopes went \$40 over in May\. Over on Eating out by \$40\. Month/);
  assert.equal(partNamed(back.root, "how"), null);
  // envelopes and no bank file yet: what they hold, and when spending shows
  const none = emptyPlan(); none.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false }, { id: "b2", category: "groceries", amount: 600, period: "monthly", rollover: false });
  assert.match(seen(page(none).root), /^Your 2 envelopes hold \$900 a month\. Spending against them shows once a bank file is in\. Import a bank file Month/);
});

test("opt C19 on the page: envelopes over first, six, then N more envelopes (a fast one never hidden); a save names the new answer", () => {
  const p = june(J1);
  const kinds = ["dining", "fun", "shopping", "travel", "giving", "personal", "pets", "subscriptions", "other", "groceries"];
  kinds.forEach((c, i) => p.budgets.push({ id: `b${i}`, category: c, amount: 100 + i * 10, period: "monthly", rollover: false }));
  p.transactions.push(tx("o", "2026-06-01", -170, "pets"), tx("f", "2026-06-01", -90, "subscriptions"));
  // (the page keeps a month picked by an earlier arrival: this one asks for June, as the Monthly review's link does)
  const s = page(p, { query: { month: "2026-06" } });
  // flexible envelopes 1,260 (all but groceries); spent 50 + 170 + 90 = 310; left 950; this week 950 x 7 / 30 = 221.67
  assert.equal(h1Of(s.root), "About $220 is free to spend until Sunday.");
  const card = everything(s.root).find((e) => e.tagName === "SECTION" && e.querySelector("H2")?.textContent === "Envelopes");
  // which envelopes are over leads their card when Safe to spend is the headline (no second "left" total: critic 1)
  assert.match(seen(card), /^Envelopes Over on Pets by \$10, with 29 days to go\. 🐾 Pets over/);
  const shown = everything(card).filter((e) => e.tagName === "LI" && !e.closest("details")).map((li) => li.querySelector(".t").textContent.trim());
  assert.equal(shown[0], "Pets over", "the envelope that is over comes first");
  assert.ok(shown.some((t) => t.startsWith("Subscriptions spending fast")), "spending fast is kept in sight");
  const more = partNamed(card, "envelopes");
  assert.equal(more.querySelector(".fold-title").textContent, `${10 - shown.length} more envelopes`);
  assert.ok(!isOpen(more));
  // add an envelope: a must-pay one leaves what is free as it was, so the green line says only that it was added
  const add = (category, amount) => {
    const c = everything(s.root).find((e) => e.tagName === "SECTION" && e.querySelector("H2")?.textContent === "Envelopes");
    c.all().find((e) => e.tagName === "BUTTON" && e.textContent === "+ Add another envelope").click();
    const form = everything(s.root).find((e) => e.tagName === "FORM");
    form.reset = () => {};   // (the stand-in DOM has no form reset)
    form.querySelector('[name="category"]').value = category;
    form.querySelector('[name="amount"]').value = amount;
    form.dispatch("submit");
  };
  add("health", "75");
  assert.equal(s.saved.length, 1);
  assert.equal(h1Of(s.root), "About $220 is free to spend until Sunday.");
  assert.equal(okLine(s.root), "Envelope added.");
  // a flexible one (Fun and hobbies from $110 to $410): 1,250 left, this week 291.67: the green line names the new answer (R7)
  add("fun", "410");
  assert.equal(s.saved.length, 2);
  assert.equal(okLine(s.root), "Envelope added. About $290 is free to spend until Sunday.");
});

test("S11: after a save no part opens or shuts (a span chip, an envelope added, an envelope changed: none is saved inside a part)", () => {
  const openOf = (root) => Object.fromEntries(partsOf(root).map((e) => [e.dataset.part, isOpen(e)]));
  const p = june(J1);
  ["dining", "fun", "shopping", "travel", "giving", "personal", "pets", "subscriptions", "other", "groceries"].forEach((c, i) => p.budgets.push({ id: `b${i}`, category: c, amount: 100 + i * 10, period: "monthly", rollover: false }));
  const s = page(p, { query: { month: "2026-06" } });
  const before = openOf(s.root);
  assert.deepEqual(Object.keys(before).sort(), ["envelopes", "how"], "the parts this test watches are drawn");
  assert.ok(Object.values(before).every((o) => o === false));
  // a span chip (in the headline's card)
  chipsIn(s.root, "safeSpan").find((b) => b.textContent === "Today").click();
  assert.equal(s.saved.length, 1);
  assert.deepEqual(openOf(s.root), before);
  // an envelope added from "+ Add another envelope" (under the list, outside the parts)
  const card = () => everything(s.root).find((e) => e.tagName === "SECTION" && e.querySelector("H2")?.textContent === "Envelopes");
  card().all().find((e) => e.tagName === "BUTTON" && e.textContent === "+ Add another envelope").click();
  const form = everything(s.root).find((e) => e.tagName === "FORM");
  form.reset = () => {};
  form.querySelector('[name="category"]').value = "health";
  form.querySelector('[name="amount"]').value = "75";
  form.dispatch("submit");
  assert.equal(s.saved.length, 2);
  assert.deepEqual(openOf(s.root), before);
  // an envelope changed from its row (the form opens under the list, outside the parts)
  card().all().find((e) => e.tagName === "LI" && e.getAttribute("role") === "button").click();
  const edit = everything(s.root).find((e) => e.tagName === "FORM");
  edit.querySelector('[name="amount"]').value = "333";
  edit.dispatch("submit");
  assert.equal(s.saved.length, 3);
  assert.deepEqual(openOf(s.root), before);
});

// ---------------------------------------------------------------- the critic's findings on gap #5 (2026-11-13)
test("gap #5 critic 1: with Safe to spend as the headline, the Envelopes card says no second 'left' total", () => {
  // dining (not a bill) 300, groceries (a bill) 600 with 200 spent: all envelopes have 650 left, Safe to spend's month 250
  const p = june([...J1, tx("g", "2026-06-01", -200, "groceries")]);
  p.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false }, { id: "b2", category: "groceries", amount: 600, period: "monthly", rollover: false });
  const s = page(p, { query: { month: "2026-06" } });
  assert.equal(h1Of(s.root), "About $58 is free to spend until Sunday.", "250 x 7 / 30");
  const card = everything(s.root).find((e) => e.tagName === "SECTION" && e.querySelector("H2")?.textContent === "Envelopes");
  assert.match(seen(card), /^Envelopes Every envelope is within its amount, with 29 days to go\. 🛒 Groceries/);
  assert.doesNotMatch(seen(s.root), /left in your envelopes/);
  // the alarm: the card names the envelope that is over, and no total "left" beside "past this month's plan"
  const a = june([...J1, tx("g", "2026-06-01", -200, "groceries"), tx("big", "2026-06-01", -400, "dining")]);
  a.budgets = p.budgets;
  const t = page(a, { query: { month: "2026-06" } });
  assert.equal(h1Of(t.root), "Spending is $150 past this month's plan.");
  const c2 = everything(t.root).find((e) => e.tagName === "SECTION" && e.querySelector("H2")?.textContent === "Envelopes");
  assert.match(seen(c2), /^Envelopes Over on Eating out by \$150, with 29 days to go\. 🍽️ Eating out over/);
  assert.doesNotMatch(seen(t.root), /left in your envelopes/);
});

test("gap #5 critic 2: the alarm's second sentence is true in each mode, and never says 'what is left' when nothing is", () => {
  const at = (lines) => safeToSpend(june(lines), { today: "2026-06-01", spare: SPARE });
  assert.equal(at([...J1, tx("big", "2026-06-01", -1350, "shopping")]).words.second, "Anything more this month comes out of the money for bills and saving.");
  assert.equal(at([...J1, tx("big", "2026-06-01", -1490, "shopping")]).words.second, "Unless more comes in, that $140 comes out of the money for bills and saving.");
  const env = (lines) => { const p = june(lines); p.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false }); return safeToSpend(p, { today: "2026-06-01" }); };
  let s = env([...J1, tx("big", "2026-06-01", -250, "dining")]);
  assert.deepEqual([s.mode, s.kind, s.words.second], ["envelopes", "spent", "Your envelopes for spending are used up: anything more comes out of money meant for bills or saving."]);
  s = env([...J1, tx("big", "2026-06-01", -390, "dining")]);
  assert.deepEqual([s.mode, s.kind, s.words.headline, s.words.second], ["envelopes", "over", "Spending is $140 past this month's plan.", "Your envelopes for spending don't cover that $140, so it comes out of money meant for bills or saving."]);
  for (const x of [at([...J1, tx("big", "2026-06-01", -1490, "shopping")]), s]) assert.doesNotMatch(x.words.second, /what is left/);
});

test("gap #5 critic 3: spending with no envelope is said when it comes off the envelopes' money", () => {
  const p = june([...J1, tx("sh", "2026-06-01", -30, "shopping"), tx("u", "2026-06-01", -12, "")]);
  p.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false });
  const s = safeToSpend(p, { today: "2026-06-01" });
  // dining 50 from its envelope; shopping 30 and 12 not sorted yet have no envelope: 300 - 92 = 208
  assert.deepEqual([s.spent, s.noEnvelope, s.left], [92, 42, 208]);
  assert.equal(s.words.second, "That keeps your spending within your envelopes to the end of June, counting the $42 spent with no envelope.");
  // none with no envelope: the sentence as before; the plan's month has no envelopes to speak of
  p.transactions = p.transactions.filter((t) => !["sh", "u"].includes(t.id));
  assert.deepEqual([safeToSpend(p, { today: "2026-06-01" }).noEnvelope, safeToSpend(p, { today: "2026-06-01" }).words.second], [0, "That keeps your spending within your envelopes to the end of June."]);
  assert.equal(safeToSpend(june([...J1, tx("sh", "2026-06-01", -30, "shopping")]), { today: "2026-06-01", spare: SPARE }).words.second, "That keeps your bills and saving covered to the end of June.");
  // and in How this is worked out, the spent line says how much of it had no envelope
  p.transactions.push(tx("sh", "2026-06-01", -30, "shopping"));
  const how = partNamed(page(p, { query: { month: "2026-06" } }).root, "how");
  assert.match(words(how), /Spent so far on everything else June 1 to today, from your bank files; \$30 of it with no envelope - \$80/);
});

test("gap #5 critic 4: with Safe to spend leading and no envelope yet, what an envelope is moves to the first card that offers one", () => {
  const INTRO = "Give each kind of spending an envelope: an amount for the month. The page shows what you have spent so far (from your transactions), what is left, and whether you are on pace.";
  const s = page(june(J1));
  assert.equal(h1Of(s.root), "About $320 is free to spend until Sunday.");
  const text = seen(s.root);
  assert.equal(text.split(INTRO).length - 1, 1, "said once");
  assert.ok(text.indexOf(`Spent this month with no envelope ${INTRO}`) > 0, text.slice(0, 400));
  // with an envelope there is nothing to explain; without Safe to spend the hero says it, as before
  const e = june(J1); e.budgets.push({ id: "b1", category: "dining", amount: 300, period: "monthly", rollover: false });
  assert.doesNotMatch(seen(page(e, { query: { month: "2026-06" } }).root), /Give each kind of spending an envelope/);
  assert.match(seen(page(june(J1), { today: "2026-06-20" }).root), new RegExp(`^Budget ${INTRO.replace(/[.()]/g, "\\$&")}`));
});

test("gap #5 critic 5: two chips never give the same answer (Sunday, the month's last day, payday the same as Sunday)", () => {
  const sun = (extra = []) => june([...J1, tx("s", "2026-06-28", -1, "dining"), ...extra]);
  // Sunday the 28th: this week is today, so only Today is offered, and a saved "This week" reads as today
  let s = safeToSpend(sun(), { today: "2026-06-28", spare: SPARE });
  assert.deepEqual([s.spans, s.span, s.days], [["today"], "today", 1]);
  assert.match(s.words.headline, /is free to spend today\.$/);
  // with a payday (biweekly from May 29: July 10, after the month's end): Today and Until payday, the 3 days left
  const pay = { id: "i1", name: "My pay", type: "salary", personId: "", amount: 2000, period: "biweekly", payday: "2026-05-29" };
  const p = sun(); p.income.push(pay);
  s = safeToSpend(p, { today: "2026-06-28", spare: SPARE });
  assert.deepEqual([s.spans, s.span], [["today", "payday"], "today"]);
  assert.equal(safeToSpend(p, { today: "2026-06-28", spare: SPARE, span: "payday" }).days, 3);
  // the month's last day: every span is today
  const last = june([...J1, tx("l", "2026-06-30", -1, "dining")]); last.income.push(pay);
  assert.deepEqual(safeToSpend(last, { today: "2026-06-30", spare: SPARE }).spans, ["today"]);
  // Thursday the 25th with a weekly payday on Monday the 29th: until payday is this week (4 days), so no third chip;
  // a saved "Until payday" reads as this week
  const thu = june([...J1, tx("t", "2026-06-25", -1, "dining")]);
  thu.income.push({ ...pay, period: "weekly", payday: "2026-06-22" });
  thu.whatIfs = { safeSpend: { span: "payday" } };
  s = safeToSpend(thu, { today: "2026-06-25", spare: SPARE });
  assert.deepEqual([s.nextPayday, s.spans, s.span, s.days], ["2026-06-29", ["today", "week"], "week", 4]);
  // on the page: one span left draws no chips; two draw two, the one in use on
  const q = { query: { month: "2026-06" } };
  assert.deepEqual(chipsIn(page(sun(), { today: "2026-06-28", ...q }).root, "safeSpan"), []);
  assert.deepEqual(chipsIn(page(p, { today: "2026-06-28", ...q }).root, "safeSpan").map((b) => [b.textContent, b.className]), [["Today", "chip on"], ["Until payday", "chip"]]);
});
