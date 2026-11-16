import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, categoriesOf, categoryLabel, categoryIcon, categoryById, defaultCategories, slug } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("defaults: every Expenses category, every Income kind, and transfer", () => {
  const d = defaultCategories();
  assert.ok(d.some((c) => c.id === "groceries" && c.kind === "expense" && c.essential === true));
  assert.ok(d.some((c) => c.id === "income-salary" && c.kind === "income"));
  assert.ok(d.some((c) => c.id === "transfer" && c.kind === "transfer"));
  assert.equal(new Set(d.map((c) => c.id)).size, d.length, "ids are unique");
});
test("the owner's edits: rename, hide, add", () => {
  const p = emptyPlan();
  p.categories.push({ id: "groceries", label: "Food shopping" }, { id: "pets", hidden: true }, { id: "coffee", label: "Coffee", icon: "☕", kind: "expense" });
  const list = categoriesOf(p);
  assert.equal(list.find((c) => c.id === "groceries").label, "Food shopping");
  assert.equal(list.find((c) => c.id === "groceries").builtIn, true);
  assert.equal(list.find((c) => c.id === "pets"), undefined, "hidden");
  assert.equal(categoriesOf(p, { all: true }).find((c) => c.id === "pets").hidden, true);
  const coffee = list.find((c) => c.id === "coffee");
  assert.equal(coffee.builtIn, false); assert.equal(coffee.icon, "☕");
  assert.equal(categoryLabel(p, "coffee"), "Coffee"); assert.equal(categoryLabel(p, ""), "Uncategorized"); assert.equal(categoryLabel(p, "ghost"), "ghost");
  assert.equal(categoryIcon(p, ""), "❔"); assert.equal(categoryById(p, "nope"), null);
  assert.equal(list[0].kind, "expense", "spending first, then income, then transfer");
  assert.equal(slug("Coffee & Tea!"), "coffee-tea"); assert.equal(slug(""), "category");
});
test("compute counts usage per category and the uncategorized", () => {
  const d = compute(samplePlan());
  assert.equal(d.total, 16); assert.equal(d.uncategorised, 4);
  const groc = d.categories.find((c) => c.id === "groceries");
  assert.equal(groc.count, 3); assert.ok(Math.abs(groc.total - (-86.40 - 54.12 - 60)) < 0.005);
  assert.equal(d.categories.find((c) => c.id === "transfer").count, 2);
  assert.equal(d.custom, 0);
  assert.ok(d.byKind.expense > 10 && d.byKind.income === 9 && d.byKind.transfer === 1);
});

// gap #24 (2026-11-14): a purchase split across categories counts in each part's category, for that part's amount
test("gap #24: a split purchase counts in each of its parts' categories; the totals still add up to the transactions", () => {
  const p = samplePlan(), before = compute(p);
  p.transactions.push({ id: "s1", date: "2026-09-12", amount: -300, payee: "Big Box Store", accountId: "chk", category: "groceries", splits: [{ category: "shopping", amount: -100 }, { category: "groceries", amount: -200 }] });
  const d = compute(p);
  const of = (x, id) => x.categories.find((c) => c.id === id);
  assert.equal(of(d, "groceries").total, of(before, "groceries").total - 200); assert.equal(of(d, "groceries").count, of(before, "groceries").count + 1);
  assert.equal(of(d, "shopping").total, of(before, "shopping").total - 100); assert.equal(of(d, "shopping").count, of(before, "shopping").count + 1);
  assert.equal(d.uncategorised, before.uncategorised); assert.equal(d.total, before.total + 1);
  const sum = (x) => x.categories.reduce((s, c) => s + c.total, 0);
  assert.ok(Math.abs(sum(d) - (sum(before) - 300)) < 0.005, "counted once");
});

// gap #24 fix F4 (2026-11-14): hiding or removing a category says what happens to a purchase split across it
test("gap #24 fix F4 on the page: removing a category warns that a split purchase stops being split, and says so after", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const page = (plan) => renderPage(new URL("./view.js", import.meta.url).href, plan, "2026-11-14");
  const p = samplePlan();
  p.transactions.push({ id: "s1", date: "2026-09-12", amount: -300, payee: "Big Box Store", accountId: "chk", category: "groceries", splits: [{ category: "shopping", amount: -100 }, { category: "groceries", amount: -200 }] });
  const asked = [], had = globalThis.window.confirm;
  globalThis.window.confirm = (text) => { asked.push(text); return true; };
  try {
    const r = await page(p);
    r.root.querySelectorAll("li").find((l) => l.getAttribute("role") === "button" && textOf(l).includes("Shopping and clothes")).click();
    r.root.querySelectorAll("button").find((b) => /^(Hide|Remove) Shopping and clothes$/.test(textOf(b))).click();
    assert.equal(asked.length, 1);
    assert.match(asked[0], /They will become uncategorized\. One of them is a purchase split across categories: it will stop being split and wait for a category again, whole\. Continue\?$/);
    const t = r.saved[0].transactions.find((x) => x.id === "s1");
    assert.equal(t.splits, undefined); assert.equal(t.category, ""); assert.equal(t.amount, -300);
    assert.match((await page(r.saved[0])).root.querySelectorAll(".notice.ok").map((n) => textOf(n))[0], /One split purchase is whole again and waiting for a category\.$/);
    // a category no split uses: the question is what it was
    const r2 = await page(samplePlan());
    r2.root.querySelectorAll("li").find((l) => l.getAttribute("role") === "button" && textOf(l).includes("Groceries")).click();
    r2.root.querySelectorAll("button").find((b) => /^(Hide|Remove) Groceries$/.test(textOf(b))).click();
    assert.match(asked[1], /They will become uncategorized\. Continue\?$/);
  } finally { globalThis.window.confirm = had; }
});

// ---------------------------------------------------------------- gap list next 60 #16 (2026-11-16): invariance
// Nothing new typed, nothing moves. Every invented household (qa/fixtures/*-plan.mjs, the 14 households, the phone-built
// ones, the empty plan) gets six months of invented bank lines (qa/fixtures/bank-lines.mjs), some split, some tagged, a
// category of the person's own with lines in it, budget envelopes (one rolling over), moves between envelopes, a watched
// category and a dividend line. For each, every compute that reads a line's category and adds up by it gives the very
// output it gave at ce79d70 (before sub-categories): a digest per plan written down from that commit's code
// (invariance.json). To write them again after a deliberate change: PRINT=1 node --test modules/transactions/categories/module.test.mjs
export async function invariancePlans() {
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath, pathToFileURL } = await import("node:url");
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const { withBankLines, splitSome, tagSome } = await import("../../../qa/fixtures/bank-lines.mjs");
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn("2026-11-13") });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out.map(({ name, plan }, i) => {
    let q = withBankLines(migrate(structuredClone(plan)), i + 1);
    if (i % 3 === 1) q = splitSome(q, "other");
    if (i % 4 === 2) q = tagSome(q);
    q.categories = Array.isArray(q.categories) ? q.categories : [];
    const spend = categoriesOf(q).filter((c) => c.kind === "expense").map((c) => c.id);
    const s = (k) => spend[(k + i) % spend.length];
    // a category of the person's own, with every fifth purchase in it; a renamed built-in
    if (i % 2 === 1) {
      q.categories.push({ id: "coffee-shops", label: "Coffee shops", icon: "☕", kind: "expense" }, { id: s(3), label: "Renamed kind" });
      q.transactions.filter((t) => Number(t.amount) < 0 && t.category && !t.transferId && t.category !== "transfer").forEach((t, k) => { if (k % 5 === 0 && !t.splits) t.category = "coffee-shops"; });
    }
    // envelopes (one rolling over, one for the person's own category), moves between two of them, a watched category
    if (i % 2 === 0 || i % 5 === 1) {
      q.budgets = [{ id: "b1", category: s(0), amount: 900, period: "monthly", rollover: false }, { id: "b2", category: s(1), amount: 150, period: "monthly", rollover: true },
        { id: "b3", category: i % 2 ? "coffee-shops" : s(2), amount: 60, period: "monthly", rollover: false }];
      if (i % 4 === 0) q.budgetPlan = { method: "zero", carryOver: true, moves: [{ id: "m1", month: "2026-10", from: s(0), to: s(1), amount: 25 }] };
    }
    if (i % 3 === 0) q.spendingWatch = [{ kind: "category", key: s(1) }, { kind: "payee", key: "Corner Market" }];
    // a dividend paid into checking
    const chk = q.accounts.find((a) => a.type === "checking");
    q.transactions.push({ id: `div-${i}`, date: "2026-09-30", amount: 41.5, payee: "Fund dividend", rawPayee: "FUND DIVIDEND", accountId: chk.id, category: "income-investment", tags: [], note: "" });
    return { name, plan: q, spend };
  });
}
export async function invarianceDigests(plans = null) {
  const crypto = await import("node:crypto");
  const spending = await import("../../cashflow/spending/compute.js");
  const budget = await import("../../cashflow/budget/compute.js");
  const statement = await import("../../cashflow/income-statement/compute.js");
  const { bankSpend } = await import("../../overview/guesses/estimators/spend.js");
  const { receivedOf } = await import("../../investments/dividends/compute.js");
  const ledger = await import("../ledger/compute.js");
  const review = await import("../../overview/monthly-review/compute.js");
  const annual = await import("../../reports/annual-review/compute.js");
  const dig = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("base64url").slice(0, 22);
  const T = "2026-11-13";
  const out = {};
  for (const { name, plan: q, spend } of plans ?? await invariancePlans()) {
    const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
    out[name] = dig({
      categories: compute(q),
      order: categoriesOf(q).map((c) => c.id), all: categoriesOf(q, { all: true }).map((c) => c.id),
      spending: [spending.compute(q, { today: T }), ...months.map((month) => spending.compute(q, { today: T, month }))],
      budget: [budget.compute(q, { today: T }), budget.compute(q, { today: "2026-10-28", month: "2026-10" }), budget.compute(q, { today: T, month: "2026-09" }),
        budget.safeToSpend(q, { today: "2026-10-28", spare: { monthly: 1200, spending: 2500 } })],
      statement: [statement.compute(q, { today: T }), statement.bankVsPlan(q, { today: T })],
      guesses: bankSpend(q, T),
      dividends: receivedOf(q, T),
      ledger: [ledger.compute(q, { today: T }), ...spend.slice(0, 4).map((category) => ledger.compute(q, { today: T, category })), ledger.compute(q, { today: T, category: "coffee-shops" }), ledger.compute(q, { today: T, category: "none" })],
      review: review.compute(q, { today: T, month: "2026-10" }),
      annual: annual.compute(q, { today: T, year: 2026 }),
    });
  }
  return out;
}
test("gap next-60 #16 invariance: with no category inside another, every reader gives exactly what it gave at ce79d70", async () => {
  const fs = await import("node:fs");
  const file = new URL("./invariance.json", import.meta.url);
  const now = await invarianceDigests();
  if (process.env.PRINT) { fs.writeFileSync(file, JSON.stringify({ note: "digests of every category reader's output at ce79d70 (gap next-60 #16); module.test.mjs says how to write them again", plans: now }, null, 1) + "\n"); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(now).length >= 30, `${Object.keys(now).length} plans`);
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort());
  for (const k of Object.keys(was)) assert.equal(now[k], was[k], k);
});

// ---------------------------------------------------------------- gap next-60 #16 (a): one category inside another
const T16 = "2026-11-13";
/** The invented family of Ana and Bo with six months of invented bank lines; "Food" (their own) holds Groceries and Eating out. */
async function foodPlan({ nest = true } = {}) {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { withBankLines } = await import("../../../qa/fixtures/bank-lines.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const p = withBankLines(migrate(familyPlan(T16)), 3);
  p.categories = p.categories ?? [];
  p.categories.push({ id: "food", label: "Food", icon: "🍽️", kind: "expense" });
  // a few lines filed under Food itself, the rest of the groceries and eating out under their own
  p.transactions.filter((t) => t.category === "fun").slice(0, 3).forEach((t) => { t.category = "food"; });
  if (nest) p.categories.push({ id: "groceries", parent: "food" }, { id: "dining", parent: "food" });
  return p;
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg ?? ""} ${a} vs ${b}`);
const nestAt = (p, child, parent) => { p.categories = p.categories ?? []; const c = p.categories.find((x) => x.id === child); if (c) c.parent = parent; else p.categories.push({ id: child, parent }); return p; };

test("gap next-60 #16 links: a parent counts when it is on the list, another one, of the same kind and inside no other", async () => {
  const { parentsOf, rollUp, childrenOf, parentChoices, rollUpInto } = await import("./compute.js");
  const p = emptyPlan();
  assert.equal(parentsOf(p).size, 0); assert.equal(rollUp(p)("groceries"), "groceries", "none set: every id as it is");
  p.categories.push({ id: "food", label: "Food", kind: "expense" }, { id: "groceries", parent: "food" }, { id: "dining", parent: "food" },
    { id: "snacks", label: "Snacks", kind: "expense", parent: "groceries" },   // two levels: Snacks stands on its own
    { id: "income-other", parent: "food" },                                    // another kind
    { id: "pets", parent: "pets" },                                            // itself
    { id: "travel", parent: "ghost" },                                         // not on the list
    { id: "old", label: "Old", kind: "expense", hidden: true }, { id: "fun", parent: "old" });   // hidden
  assert.deepEqual([...parentsOf(p)].sort(), [["dining", "food"], ["groceries", "food"]]);
  const up = rollUp(p);
  assert.deepEqual(["groceries", "dining", "food", "snacks", "income-other", "pets", "travel", "fun", ""].map(up), ["food", "food", "food", "snacks", "income-other", "pets", "travel", "fun", ""]);
  assert.deepEqual(childrenOf(p, "food").map((c) => c.id), ["dining", "groceries"]);
  // the list: a category inside another right under it, the rest alphabetical as before
  const ids = categoriesOf(p).filter((c) => c.kind === "expense").map((c) => c.id);
  assert.deepEqual(ids.slice(ids.indexOf("food"), ids.indexOf("food") + 3), ["food", "dining", "groceries"]);
  assert.ok(ids.indexOf("fun") > ids.indexOf("groceries") && ids.indexOf("childcare") < ids.indexOf("food"));
  // what a category may be put inside: same kind, standing on its own, not itself; none for one that holds others
  const choices = parentChoices(p, { id: "pets", kind: "expense" }).map((c) => c.id);
  assert.ok(choices.includes("food") && !choices.includes("groceries") && !choices.includes("pets") && !choices.includes("old") && !choices.includes("income-salary"));
  assert.deepEqual(parentChoices(p, { id: "food", kind: "expense" }), []);
  assert.ok(parentChoices(p, { kind: "income" }).every((c) => c.kind === "income"));
  // for a page with its own list (Expenses' kinds): its own kind stays itself; one of yours inside one of its kinds counts there
  p.categories.push({ id: "coffee", label: "Coffee", kind: "expense", parent: "dining" }, { id: "kids-food", label: "Kids food", kind: "expense", parent: "childcare" });
  const known = (id) => ["dining", "groceries", "childcare", "housing"].includes(id);
  const into = rollUpInto(p, known);
  assert.deepEqual(["groceries", "kids-food", "coffee", "food", ""].map(into), ["groceries", "childcare", "coffee", "food", ""], "coffee is two levels down: on its own");
  // compute says where a category sits, only for a link that counts
  const d = compute(p);
  assert.equal(d.categories.find((c) => c.id === "groceries").inside, "food"); assert.equal("inside" in d.categories.find((c) => c.id === "snacks"), false);
  assert.equal("inside" in compute(samplePlan()).categories[0], false);
});

test("gap next-60 #16 words: putting inside, taking out, moving, refusals, and the ones that stand on their own", async () => {
  const { nestRefused, nestWords, addedInsideWords, onTheirOwnWords, nowOnTheirOwnWords, listOf, INSIDE_HELP, ON_ITS_OWN } = await import("./compute.js");
  const p = emptyPlan();
  p.categories.push({ id: "food", label: "Food", kind: "expense" }, { id: "home", label: "Home", kind: "expense" }, { id: "groceries", parent: "food" }, { id: "snack", label: "Snacks", kind: "expense" }, { id: "home2", label: "Cottage", kind: "expense", hidden: true });
  assert.equal(nestRefused(p, { id: "snack", parent: "" }), null); assert.equal(nestRefused(p, { id: "snack", parent: "food" }), null);
  assert.equal(nestRefused(p, { id: "food", parent: "food" }), "A category can't be inside itself.");
  assert.equal(nestRefused(p, { id: "snack", parent: "home2" }), "Cottage is not on your list: pick another, or none.");
  assert.equal(nestRefused(p, { id: "snack", parent: "ghost" }), "ghost is not on your list: pick another, or none.");
  assert.equal(nestRefused(p, { id: "snack", parent: "food", kind: "income" }), "Food is spending and this one is income: pick one of the same kind, or none.");
  assert.equal(nestRefused(p, { id: "income-salary", parent: "food" }), "Food is spending and this one is income: pick one of the same kind, or none.");
  assert.equal(nestRefused(p, { id: "snack", parent: "groceries" }), "Groceries is itself inside Food: pick one that stands on its own.");
  assert.equal(nestRefused(p, { id: "food", parent: "home" }), "Food has categories inside it, so it stays on its own.");
  assert.equal(nestRefused(p, { parent: "food", kind: "expense" }), null, "a new category");
  assert.deepEqual(nestWords("Groceries", "", "Food"), { ask: "Put Groceries inside Food? Pages that add up your money by category will count it in Food; every total stays the same.", done: "Groceries is now inside Food.", undone: "Undone: Groceries stands on its own again." });
  assert.deepEqual(nestWords("Groceries", "Food", ""), { ask: "Take Groceries out of Food? It will count on its own again.", done: "Groceries stands on its own again.", undone: "Undone: Groceries is inside Food again." });
  assert.deepEqual(nestWords("Groceries", "Food", "Home"), { ask: "Move Groceries from Food into Home?", done: "Groceries is now inside Home.", undone: "Undone: Groceries is inside Food again." });
  assert.equal(addedInsideWords("Coffee", "Eating out"), "Coffee added, inside Eating out.");
  assert.equal(onTheirOwnWords([]), ""); assert.equal(onTheirOwnWords(["Groceries"]), "Groceries, which is inside it, will stand on its own.");
  assert.equal(onTheirOwnWords(["Groceries", "Eating out"]), "Groceries and Eating out, which are inside it, will stand on their own.");
  assert.equal(nowOnTheirOwnWords(["Groceries"]), "Groceries stands on its own now."); assert.equal(nowOnTheirOwnWords(["A", "B", "C"]), "A, B and C stand on their own now.");
  assert.equal(listOf(["A", "B", "C"]), "A, B and C");
  assert.equal(INSIDE_HELP, "Pages that add up your money by category count it inside that one.", "no promise about totals: the question says what changes (critic M4)");
  assert.equal(ON_ITS_OWN, "No, it stands on its own");
});

test("gap next-60 #16 Where the money goes: a category inside another counts in it, with what each inside came to; the month's total is the same", async () => {
  const { compute: spending } = await import("../../cashflow/spending/compute.js");
  const flat = await foodPlan({ nest: false }), nested = await foodPlan();
  for (const month of ["2026-08", "2026-09", "2026-10"]) {
    const a = spending(flat, { today: T16, month }), b = spending(nested, { today: T16, month });
    near(b.total, a.total, month); assert.equal(b.count, a.count);
    const of = (d, id) => d.byCategory.find((c) => c.category === id)?.total ?? 0;
    near(of(b, "food"), of(a, "food") + of(a, "groceries") + of(a, "dining"), `${month} food`);
    assert.equal(b.byCategory.some((c) => c.category === "groceries" || c.category === "dining"), false);
    const food = b.byCategory.find((c) => c.category === "food");
    assert.deepEqual(food.subs.map((x) => [x.category, x.label]).sort(), [["dining", "Eating out"], ["groceries", "Groceries"]].filter(([id]) => of(a, id) > 0).sort());
    for (const x of food.subs) near(x.total, of(a, x.category));
    assert.ok(b.byCategory.filter((c) => c.category !== "food").every((c) => !("subs" in c)), "only a row with spending inside it has subs");
  }
  // twelve months: the rows roll up the same way (twelve whole months of lines)
  const year = (p) => { const q = structuredClone(p); for (const t of structuredClone(q.transactions)) for (const k of [6, 12]) q.transactions.push({ ...t, id: `${t.id}-${k}`, date: `${Number(t.date.slice(0, 4)) - (k === 12 ? 1 : 0)}-${String(((Number(t.date.slice(5, 7)) - 1 - k + 24) % 12) + 1).padStart(2, "0")}${t.date.slice(7)}`, ...(t.transferId ? { transferId: `${t.transferId}-${k}` } : {}) }); return q; };
  const ya = spending(year(flat), { today: T16 }).year, yb = spending(year(nested), { today: T16 }).year;
  if (ya && yb) {
    const avg = (y, id) => y.rows.find((r) => r.category === id)?.average ?? 0;
    near(avg(yb, "food"), avg(ya, "food") + avg(ya, "groceries") + avg(ya, "dining"), "twelve months");
    assert.equal(yb.rows.some((r) => r.category === "groceries"), false);
  }
  // a watched category counts the ones inside it; a watched one inside another counts itself
  for (const q of [flat, nested]) q.spendingWatch = [{ kind: "category", key: "food" }, { kind: "category", key: "groceries" }];
  const wa = spending(flat, { today: T16, month: "2026-10" }).watch, wb = spending(nested, { today: T16, month: "2026-10" }).watch;
  near(wb[0].total, wa[0].total + wa[1].total + spending(flat, { today: T16, month: "2026-10" }).byCategory.filter((c) => c.category === "dining").reduce((s, c) => s + c.total, 0), "watch food");
  near(wb[1].total, wa[1].total, "watch groceries");
});

test("gap next-60 #16 Budget: a line counts in its own envelope, else in the envelope of the category it sits inside; every line once", async () => {
  const { compute: budget, safeToSpend } = await import("../../cashflow/budget/compute.js");
  const flat = await foodPlan({ nest: false }), nested = await foodPlan();
  for (const q of [flat, nested]) q.budgets = [{ id: "b1", category: "food", amount: 700, period: "monthly", rollover: false }, { id: "b2", category: "dining", amount: 150, period: "monthly", rollover: true }];
  const a = budget(flat, { today: "2026-10-28", month: "2026-10" }), b = budget(nested, { today: "2026-10-28", month: "2026-10" });
  const env = (d, id) => d.envelopes.find((e) => e.category === id), un = (d, id) => d.unbudgeted.find((u) => u.category === id)?.spent ?? 0;
  near(env(b, "food").spent, env(a, "food").spent + un(a, "groceries"), "groceries counted in Food's envelope");
  near(env(b, "dining").spent, env(a, "dining").spent, "Eating out keeps its own envelope");
  assert.equal(b.unbudgeted.some((u) => u.category === "groceries"), false);
  const all = (d) => d.totals.spent + d.unbudgeted.reduce((s, u) => s + u.spent, 0);
  near(all(b), all(a), "every line once");
  // with no envelope of its own and none on the one it sits inside: it waits under that one
  for (const q of [flat, nested]) q.budgets = [{ id: "b3", category: "housing", amount: 1200, period: "monthly", rollover: false }];
  const c = budget(flat, { today: "2026-10-28", month: "2026-10" }), e = budget(nested, { today: "2026-10-28", month: "2026-10" });
  near(un(e, "food"), un(c, "food") + un(c, "groceries") + un(c, "dining")); near(all(e), all(c));
  // safe to spend: a line inside a category with an envelope is not "spending with no envelope"
  for (const q of [flat, nested]) q.budgets = [{ id: "b1", category: "food", amount: 700, period: "monthly", rollover: false }];
  const s1 = safeToSpend(flat, { today: "2026-10-28" }), s2 = safeToSpend(nested, { today: "2026-10-28" });
  assert.ok(s1.drawn && s2.drawn);
  near(s2.spent, s1.spent, "the month's spending is the same");
  assert.ok(s2.noEnvelope < s1.noEnvelope - 1, "groceries and eating out come off Food's money, not as spending with no envelope");
});

test("gap next-60 #16 Income statement, the bank against the plan, the spending guesses, Dividends and Transactions roll up the same way", async () => {
  const statement = await import("../../cashflow/income-statement/compute.js");
  const { bankSpend } = await import("../../overview/guesses/estimators/spend.js");
  const { receivedOf } = await import("../../investments/dividends/compute.js");
  const ledger = await import("../ledger/compute.js");
  const flat = await foodPlan({ nest: false }), nested = await foodPlan();
  const a = statement.compute(flat, { today: T16 }), b = statement.compute(nested, { today: T16 });
  assert.deepEqual(b.rows.map((r) => [r.ym, r.in, r.out]), a.rows.map((r) => [r.ym, r.in, r.out]), "the months are the same");
  const out = (d, id) => d.byCategory.out.find((c) => c.category === id)?.total ?? 0;
  near(out(b, "food"), out(a, "food") + out(a, "groceries") + out(a, "dining")); assert.equal(out(b, "groceries"), 0);
  // a category of your own inside one of Expenses' kinds counts as that kind against the plan, and in the spending guesses
  const own = (p) => { const q = structuredClone(p); q.categories.push({ id: "cafes", label: "Cafes", icon: "☕", kind: "expense" }); q.transactions.filter((t) => t.category === "dining").forEach((t) => { t.category = "cafes"; }); return q; };
  const loose = own(flat), inDining = nestAt(own(flat), "cafes", "dining");
  const line = (v, id) => v?.lines.find((l) => l.category === id)?.bank ?? 0;
  const v1 = statement.bankVsPlan(flat, { today: T16 }), v2 = statement.bankVsPlan(loose, { today: T16 }), v3 = statement.bankVsPlan(inDining, { today: T16 });
  assert.ok(v1 && v2 && v3);
  assert.deepEqual(v3, v1, "Cafes inside Eating out: the bank against the plan reads as if they were Eating out");
  assert.ok(line(v2, "other") > line(v1, "other") + 1, "Cafes on its own: under Other, as before #16");
  const g1 = bankSpend(flat, T16), g2 = bankSpend(loose, T16), g3 = bankSpend(inDining, T16);
  assert.ok(g1 && g2 && g3);
  assert.deepEqual(g3, g1, "Cafes inside Eating out: the spending guesses read them as Eating out");
  assert.ok(g2.byRow.dining < g1.byRow.dining - 1 && g2.byRow.shopping > g1.byRow.shopping + 1, "Cafes on its own: shopping and everything else, as before #16");
  near(g2.out, g1.out);
  // Dividends: a category inside "Dividends and interest" counts
  const div = (p) => { const q = structuredClone(p); const chk = q.accounts.find((x) => x.type === "checking"); q.categories.push({ id: "fund-pay", label: "Fund payouts", icon: "📈", kind: "income" }); q.transactions.push({ id: "dv", date: "2026-09-30", amount: 41.5, payee: "Fund", rawPayee: "FUND", accountId: chk.id, category: "fund-pay", tags: [], note: "" }); return q; };
  assert.equal(receivedOf(div(flat), T16), null);
  assert.equal(receivedOf(nestAt(div(flat), "fund-pay", "income-investment"), T16).total, 41.5);
  // Transactions: filtering by Food shows the lines inside it too, and its totals are theirs
  const f0 = ["food", "groceries", "dining"].map((category) => ledger.compute(flat, { today: T16, category, limit: 1000 }));
  const f1 = ledger.compute(nested, { today: T16, category: "food", limit: 1000 });
  assert.equal(f1.matched, f0.reduce((s, x) => s + x.matched, 0)); near(f1.out, f0.reduce((s, x) => s + x.out, 0));
  assert.equal(ledger.compute(nested, { today: T16, category: "groceries", limit: 1000 }).matched, f0[1].matched, "a category inside another: itself");
  near(ledger.compute(nested, { today: T16 }).out, ledger.compute(flat, { today: T16 }).out);
});

/** Puts some categories inside others in an invented plan: four spending ones inside the first, three (and your own) inside
 * the second, three income kinds inside the first income kind. */
function nestSome(q) {
  const spend = categoriesOf(q).filter((c) => c.kind === "expense").map((c) => c.id), inc = categoriesOf(q).filter((c) => c.kind === "income").map((c) => c.id);
  spend.slice(2, 6).forEach((id) => nestAt(q, id, spend[0])); spend.slice(6, 9).forEach((id) => nestAt(q, id, spend[1]));
  inc.slice(1, 4).forEach((id) => nestAt(q, id, inc[0]));
  return q;
}
test("gap next-60 #16 grand totals: with categories inside others, every household's totals are what they were", async () => {
  const { parentsOf } = await import("./compute.js");
  const spending = await import("../../cashflow/spending/compute.js");
  const budget = await import("../../cashflow/budget/compute.js");
  const statement = await import("../../cashflow/income-statement/compute.js");
  const ledger = await import("../ledger/compute.js");
  let n = 0;
  for (const { name, plan: q } of await invariancePlans()) {
    const r = nestSome(structuredClone(q));
    assert.ok(parentsOf(r).size >= 8, name);
    for (const month of ["2026-07", "2026-10"]) {
      const a = spending.compute(q, { today: T16, month }), b = spending.compute(r, { today: T16, month });
      near(b.total, a.total, `${name} ${month}`); assert.equal(b.count, a.count);
      // the rows add up as before; a category whose refunds were more than its spending is no row of its own (it shows only
      // spending), so once it sits inside another its refunds come off that one: the rows then add up to the total exactly
      const rows = (d) => d.byCategory.reduce((s, c) => s + c.total, 0);
      if (Math.abs(rows(a) - a.total) < 0.005) near(rows(b), b.total, `${name} ${month} rows`); else assert.ok(rows(b) <= rows(a) + 0.005, `${name} ${month} rows`);
      const x = budget.compute(q, { today: T16, month }), y = budget.compute(r, { today: T16, month });
      const every = (d) => d.totals.spent + d.unbudgeted.reduce((s, u) => s + u.spent, 0);
      if (Math.abs(every(x) - a.total) < 0.005) near(every(y), a.total, `${name} ${month} budget`); else assert.ok(every(y) <= every(x) + 0.005, `${name} ${month} budget`);
    }
    const s = statement.compute(q, { today: T16 }), t = statement.compute(r, { today: T16 });
    assert.deepEqual(t.rows.map((m) => [m.in, m.out]), s.rows.map((m) => [m.in, m.out]), name);
    for (const side of ["in", "out"]) near(t.byCategory[side].reduce((z, c) => z + c.total, 0), s.byCategory[side].reduce((z, c) => z + c.total, 0), `${name} ${side}`);
    const l = ledger.compute(q, { today: T16 }), m = ledger.compute(r, { today: T16 });
    assert.deepEqual([m.in, m.out], [l.in, l.out], name);
    n++;
  }
  assert.ok(n >= 30, `${n} households`);
});

// ---------------------------------------------------------------- gap next-60 #16 (a) on the page
async function catPage(plan) {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(new URL("./view.js", import.meta.url).href, plan, T16);
  const button = (label) => r.root.querySelectorAll("button").find((b) => textOf(b) === label) ?? null;
  const rowOf = (label) => r.root.querySelectorAll("li").find((l) => l.getAttribute("role") === "button" && textOf(l).replace(/^\S+ /, "").startsWith(label)) ?? null;
  const notices = () => r.root.querySelectorAll(".notice.ok").map((n) => textOf(n));
  const form = () => { const f = r.root.querySelectorAll("form").find((x) => x.querySelector('[name="label"]')); if (f) f.reset = () => {}; return f; };
  return { ...r, button, rowOf, notices, form, textOf };
}
/** The page with a store that keeps what was saved, drawn again on demand, as the shell does. */
async function liveCats(plan0) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"), fmt = await import("../../../core/format.js"), { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; } };
  return {
    get plan() { return cur; }, textOf,
    draw: () => { const root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => T16 }, plan: cur, route: { rest: [] }, store }); return root; },
    button: (root, label) => root.querySelectorAll("button").find((b) => textOf(b) === label) ?? null,
    row: (root, label) => root.querySelectorAll("li").find((l) => l.getAttribute("role") === "button" && textOf(l).replace(/^\S+ /, "").startsWith(label)) ?? null,
    notices: (root) => root.querySelectorAll(".notice.ok").map((n) => textOf(n)),
    form: (root) => root.querySelectorAll("form").find((x) => x.querySelector('[name="label"]')),
  };
}
async function withConfirm(answer, run) {
  const asked = [], had = globalThis.window.confirm;
  globalThis.window.confirm = (text) => { asked.push(text); return typeof answer === "function" ? answer(text) : answer; };
  try { await run(asked); } finally { globalThis.window.confirm = had; }
}
const isOpenPart = (d) => (typeof d.open === "boolean" ? d.open : d.hasAttribute("open"));
const partStates = (root) => Object.fromEntries(root.all().filter((e) => e.tagName === "DETAILS" && e.dataset?.part).map((e) => [e.dataset.part, isOpenPart(e)]));

test("gap next-60 #16 on the page: six of each group first, the rest one tap away; a category inside another right under it", async () => {
  const r = await catPage(emptyPlan());
  assert.deepEqual(partStates(r.root), { spending: false, income: false });
  assert.match(r.text(), /Spending .*13 more categories.*Income .*3 more categories.*Transfer between my accounts/);
  const p = emptyPlan();
  p.categories.push({ id: "food", label: "Food", icon: "🍽️", kind: "expense" }, { id: "groceries", parent: "food" }, { id: "dining", parent: "food" });
  const n = await catPage(p);
  const rows = n.root.querySelectorAll("li").filter((l) => l.getAttribute("role") === "button").map((l) => n.textOf(l).replace(/^\S+ /, ""));
  const at = rows.findIndex((t) => t.startsWith("Food"));
  assert.match(rows[at + 1], /^Eating out .*Inside Food Edit ›$/); assert.match(rows[at + 2], /^Groceries .*must pay Inside Food Edit ›$/);
  // with lines: where it sits, then its use
  const q = samplePlan(); nestAt(q, "groceries", "transport");
  assert.match(n.textOf((await catPage(q)).rowOf("Groceries")), /Inside Car, gas, transit · 3 transactions, \$201 Edit ›$/);
});

test("gap next-60 #16 on the page: Inside another category waits under More details (optional); a save asks first, says so, and Undo puts it back", async () => {
  const r = await catPage(samplePlan());
  r.rowOf("Groceries").click();
  const f = r.form();
  const box = f.querySelector('[name="parent"]');
  assert.ok(box.closest(".form-more"), "under More details (optional)");
  assert.match(r.textOf(box.closest(".form-more")), /Inside another category .*No, it stands on its own.*Pages that add up your money by category count it inside that one\.$/);
  const opts = box.querySelectorAll("option").map((o) => o.getAttribute("value"));
  assert.equal(opts[0], ""); assert.ok(opts.includes("dining") && !opts.includes("groceries") && !opts.includes("income-salary") && !opts.includes("transfer"));
  assert.equal(box.value, "");
  await withConfirm(true, async (asked) => {
    box.value = "dining";
    f.dispatch("submit");
    assert.deepEqual(asked, ["Put Groceries inside Eating out? Pages that add up your money by category will count it in Eating out; every total stays the same."]);
    assert.deepEqual(r.saved[0].categories, [{ id: "groceries", label: "Groceries", icon: "🛒", kind: "expense", essential: true, parent: "dining" }]);
    assert.deepEqual((await catPage(r.saved[0])).notices(), ["Groceries is now inside Eating out. Undo"]);
  });
  // a no: nothing saved, the form as typed
  const no = await catPage(samplePlan());
  no.rowOf("Groceries").click();
  await withConfirm(false, async () => { const g = no.form(); g.querySelector('[name="parent"]').value = "dining"; g.dispatch("submit"); });
  assert.equal(no.saved.length, 0);
  // Undo, on a store that keeps what was saved: the plan exactly as before
  const live = await liveCats(samplePlan());
  let root = live.draw();
  live.row(root, "Groceries").click();
  await withConfirm(true, async () => { const g = live.form(root); g.querySelector('[name="parent"]').value = "dining"; g.dispatch("submit"); });
  root = live.draw();
  assert.match(live.textOf(live.row(root, "Groceries")), /Inside Eating out/);
  live.button(root, "Undo").click();
  assert.deepEqual(live.plan.categories, samplePlan().categories, "as before");
  assert.deepEqual(live.notices(live.draw()), ["Undone: Groceries stands on its own again."]);
  // taking it out again, and moving it: asked, said, undone
  const q = nestAt(samplePlan(), "groceries", "dining");
  const t = await liveCats(q);
  root = t.draw(); t.row(root, "Groceries").click();
  await withConfirm(true, async (asked) => { const g = t.form(root); assert.equal(g.querySelector('[name="parent"]').value, "dining"); g.querySelector('[name="parent"]').value = ""; g.dispatch("submit"); assert.deepEqual(asked, ["Take Groceries out of Eating out? It will count on its own again."]); });
  assert.equal("parent" in t.plan.categories[0], false);
  root = t.draw(); assert.deepEqual(t.notices(root), ["Groceries stands on its own again. Undo"]);
  t.button(root, "Undo").click(); assert.equal(t.plan.categories[0].parent, "dining");
  assert.deepEqual(t.notices(t.draw()), ["Undone: Groceries is inside Eating out again."]);
  root = t.draw(); t.row(root, "Groceries").click();
  await withConfirm(true, async (asked) => { const g = t.form(root); g.querySelector('[name="parent"]').value = "shopping"; g.dispatch("submit"); assert.deepEqual(asked, ["Move Groceries from Eating out into Shopping and clothes?"]); });
  assert.deepEqual(t.notices(t.draw()), ["Groceries is now inside Shopping and clothes. Undo"]);
});

test("gap next-60 #16 on the page: a refusal saves nothing; a new one inside another; one that holds others has no box; hiding it lets them stand on their own", async () => {
  // the kind changed to income while the box says Eating out: refused at the box, nothing saved, nothing asked
  const r = await catPage(samplePlan());
  r.rowOf("Groceries").click();
  await withConfirm(true, async (asked) => { const f = r.form(); f.querySelector('[name="parent"]').value = "dining"; f.querySelector('[name="kind"]').value = "income"; f.dispatch("submit"); assert.deepEqual(asked, []); });
  assert.equal(r.saved.length, 0);
  // a new category inside another: no question (nothing is filed under it yet), said in green
  const a = await catPage(samplePlan());
  a.button("+ Add a category").click();
  await withConfirm(true, async (asked) => { const f = a.form(); f.querySelector('[name="label"]').value = "Coffee"; f.querySelector('[name="parent"]').value = "dining"; f.dispatch("submit"); assert.deepEqual(asked, []); });
  assert.deepEqual(a.saved[0].categories, [{ id: "coffee", label: "Coffee", icon: "📦", kind: "expense", essential: false, parent: "dining" }]);
  assert.deepEqual((await catPage(a.saved[0])).notices(), ["Coffee added, inside Eating out."]);
  // a category that holds others: no box (one level only); a rename keeps the ones inside it
  const p = nestAt(nestAt(samplePlan(), "groceries", "dining"), "fun", "dining");
  const h = await catPage(p);
  h.rowOf("Eating out").click();
  assert.equal(h.form().querySelector('[name="parent"]'), null);
  assert.ok(h.root.querySelectorAll("p").some((x) => h.textOf(x) === "Eating out can't go inside another category while Fun and hobbies and Groceries are inside it."), "says why there is no box (critic P5)");
  h.form().querySelector('[name="label"]').value = "Food out"; h.form().dispatch("submit");
  assert.deepEqual(h.saved[0].categories.map((c) => [c.id, c.parent ?? ""]), [["groceries", "dining"], ["fun", "dining"], ["dining", ""]]);
  // hiding it: asked, they stand on their own, said again after
  const hd = await catPage(p);
  hd.rowOf("Eating out").click();
  await withConfirm(true, async (asked) => {
    hd.button("Hide Eating out").click();
    assert.deepEqual(asked, ["Hide Eating out? Fun and hobbies and Groceries, which are inside it, will stand on their own. Continue?"], "says what is hidden (critic P3)");
  });
  assert.deepEqual(hd.saved[0].categories.map((c) => [c.id, c.parent ?? "", !!c.hidden]), [["groceries", "", false], ["fun", "", false], ["dining", "", true]]);
  assert.deepEqual((await catPage(hd.saved[0])).notices(), ["Eating out hidden. Show it again under Hidden. Fun and hobbies and Groceries stand on their own now."]);
  // with lines too: one question with both
  const g = nestAt(samplePlan(), "shopping", "groceries");
  const gp = await catPage(g);
  gp.rowOf("Groceries").click();
  await withConfirm(true, async (asked) => { gp.button("Hide Groceries").click(); assert.deepEqual(asked, ["Hide Groceries? 3 transactions use Groceries. They will become uncategorized. Shopping and clothes, which is inside it, will stand on its own. Continue?"]); });
  // its kind changed: the ones inside stand on their own, said in green
  const k = await catPage(p);
  k.rowOf("Eating out").click();
  k.form().querySelector('[name="kind"]').value = "income"; k.form().dispatch("submit");
  assert.deepEqual(k.saved[0].categories.map((c) => [c.id, c.parent ?? ""]), [["groceries", ""], ["fun", ""], ["dining", ""]]);
  assert.deepEqual((await catPage(k.saved[0])).notices(), ["Eating out saved. Fun and hobbies and Groceries stand on their own now."]);
});

test("gap next-60 #16 S11: after a save only the saved part changes: a category saved from the form opens or shuts no part", async () => {
  const r = await catPage(samplePlan());
  const before = partStates(r.root);
  assert.deepEqual(before, { spending: false, income: false });
  r.rowOf("Groceries").click();
  await withConfirm(true, async () => { const f = r.form(); f.querySelector('[name="parent"]').value = "dining"; f.dispatch("submit"); });
  const next = await catPage(r.saved[0]);
  assert.deepEqual(partStates(next.root), before, "every part as it was");
  assert.ok(!next.root.querySelectorAll("details").some((d) => d.querySelectorAll(".notice").length), "the green line is not inside a part");
});

// critics' findings, 2026-11-16 (M4, M5, P3 to P5)
test("gap next-60 #16 critic M4: inside a category a page reads by its id, the question says what that page counts instead of every total staying the same", async () => {
  const { nestWords, readAs, READ_AS } = await import("./compute.js");
  const { bankSpend } = await import("../../overview/guesses/estimators/spend.js");
  const { receivedOf } = await import("../../investments/dividends/compute.js");
  const statement = await import("../../cashflow/income-statement/compute.js");
  const base = await foodPlan({ nest: false });
  const chk = base.accounts.find((a) => a.type === "checking");
  base.transactions.push({ id: "dv", date: "2026-09-30", amount: 41.5, payee: "Fund dividend", rawPayee: "FUND DIVIDEND", accountId: chk.id, category: "income-investment", tags: [], note: "" });
  // the totals pages read off a category by its id: the spending guesses, the bank against the plan, Dividends
  const totals = (q) => { const g = bankSpend(q, T16), v = statement.bankVsPlan(q, { today: T16 }); return JSON.stringify([g?.out, g?.mortgage, v?.bankOut ?? null, receivedOf(q, T16)?.total ?? null]); };
  const changed = [];
  for (const c of categoriesOf(base).filter((x) => x.kind !== "transfer")) {
    // a category of yours holding that one's lines, on its own and then inside it: a total that moves must be said
    const q = structuredClone(base); q.categories.push({ id: "mine", label: "Mine", icon: "📦", kind: c.kind });
    q.transactions.filter((t) => t.category === c.id).forEach((t) => { t.category = "mine"; });
    if (totals(q) !== totals(nestAt(structuredClone(q), "mine", c.id))) { changed.push(c.id); assert.ok(readAs(q, "mine", c.id), `${c.label}: a total moves, so the question says so`); }
  }
  assert.ok(["taxes", "debt", "income-investment"].every((id) => changed.includes(id)), changed.join(" "));
  // one of Expenses' own kinds stays itself on the spending guesses whatever it sits inside; an ordinary one changes no total
  assert.equal(readAs(base, "utilities", "housing"), ""); assert.equal(readAs(base, "mine", "groceries"), ""); assert.equal(readAs(base, "mine", "income-salary"), "");
  assert.equal(readAs(base, "mine", "housing"), READ_AS.housing); assert.equal(readAs(base, "", ""), "");
  const own = structuredClone(base); own.categories.push({ id: "my-div", label: "Fund dividends", kind: "income" });
  assert.equal(readAs(own, "mine", "my-div"), READ_AS["income-investment"], "an income category whose name says dividend");
  // the words
  assert.equal(nestWords("Mine", "", "Taxes not withheld", readAs(base, "mine", "taxes")).ask, "Put Mine inside Taxes not withheld? Pages that add up your money by category will count it in Taxes not withheld, and the spending guesses will leave it out of your spending, as they do taxes you pay yourself.");
  assert.equal(nestWords("Mine", "Groceries", "Loan and card payments", readAs(base, "mine", "debt")).ask, "Move Mine from Groceries into Loan and card payments? Then the spending guesses will read it as paying off a loan or card, not as spending.");
  assert.equal(nestWords("Mine", "", "Rent or mortgage", readAs(base, "mine", "housing")).ask, "Put Mine inside Rent or mortgage? Pages that add up your money by category will count it in Rent or mortgage, and the spending guesses will read a payment in it that looks like your mortgage as that payment, not as spending.");
  assert.equal(nestWords("Fund payouts", "", "Dividends and interest", readAs(base, "x", "income-investment")).ask, "Put Fund payouts inside Dividends and interest? Pages that add up your money by category will count it in Dividends and interest, and the Dividends page will count it as money your investments paid.");
  assert.equal(nestWords("Mine", "Taxes not withheld", "", "").ask, "Take Mine out of Taxes not withheld? It will count on its own again.");
  // on the page: the question that is asked
  const p = samplePlan(); p.categories.push({ id: "mine", label: "Mine", icon: "📦", kind: "expense" });
  const r = await catPage(p);
  r.rowOf("Mine").click();
  await withConfirm(true, async (asked) => { const f = r.form(); f.querySelector('[name="parent"]').value = "taxes"; f.dispatch("submit"); assert.match(asked[0], /^Put Mine inside Taxes not withheld\? .*, and the spending guesses will leave it out of your spending, as they do taxes you pay yourself\.$/); });
  assert.equal(r.saved[0].categories.find((c) => c.id === "mine").parent, "taxes");
});

test("gap next-60 #16 critic M5: the box lists the categories of the kind picked, so a new income category can go inside an income one", async () => {
  const a = await catPage(samplePlan());
  a.button("+ Add a category").click();
  const f = a.form(), kind = f.querySelector('[name="kind"]'), box = f.querySelector('[name="parent"]');
  const ids = () => box.querySelectorAll("option").map((o) => o.getAttribute("value"));
  assert.ok(ids().includes("dining") && !ids().includes("income-investment"), "spending first");
  kind.value = "income"; kind.dispatch("change");
  assert.equal(ids()[0], ""); assert.ok(ids().includes("income-investment") && !ids().includes("dining"), "then income ones only");
  await withConfirm(true, async (asked) => { f.querySelector('[name="label"]').value = "Fund payouts"; box.value = "income-investment"; f.dispatch("submit"); assert.deepEqual(asked, []); });
  assert.deepEqual(a.saved[0].categories, [{ id: "fund-payouts", label: "Fund payouts", icon: "📦", kind: "income", essential: false, parent: "income-investment" }]);
  assert.deepEqual((await catPage(a.saved[0])).notices(), ["Fund payouts added, inside Dividends and interest."]);
  // editing: a pick of another kind goes back to standing on its own; one that still fits stays
  const e = await catPage(nestAt(samplePlan(), "groceries", "dining"));
  e.rowOf("Groceries").click();
  const g = e.form(), gk = g.querySelector('[name="kind"]'), gb = g.querySelector('[name="parent"]');
  assert.equal(gb.value, "dining");
  gk.value = "expense"; gk.dispatch("change"); assert.equal(gb.value, "dining", "still fits: kept");
  gk.value = "income"; gk.dispatch("change"); assert.equal(gb.value, "");
  await withConfirm(true, async (asked) => { g.dispatch("submit"); assert.deepEqual(asked, ["Take Groceries out of Eating out? It will count on its own again."]); });
  assert.deepEqual(e.saved[0].categories.find((c) => c.id === "groceries"), { id: "groceries", label: "Groceries", icon: "🛒", kind: "income", essential: true });
});

test("gap next-60 #16 hiding a category with one transaction says it in the singular", async () => {
  const p = nestAt(samplePlan(), "shopping", "groceries");
  p.transactions = p.transactions.filter((t) => t.category !== "groceries").concat([{ id: "g1", date: "2026-09-02", amount: -20, payee: "Corner Market", accountId: "chk", category: "groceries", tags: [], note: "" }]);
  const r = await catPage(p);
  r.rowOf("Groceries").click();
  await withConfirm(false, async (asked) => { r.button("Hide Groceries").click(); assert.deepEqual(asked, ["Hide Groceries? 1 transaction uses Groceries. It will become uncategorized. Shopping and clothes, which is inside it, will stand on its own. Continue?"]); });
  assert.equal(r.saved.length, 0);
});

test("gap next-60 #16 critic P4: a category inside another is set in under it", async () => {
  const n = await catPage(nestAt(samplePlan(), "groceries", "dining"));
  assert.equal(n.rowOf("Groceries").style.marginLeft, "28px"); assert.equal(n.rowOf("Eating out").style.marginLeft, undefined);
  assert.equal((await catPage(samplePlan())).rowOf("Groceries").style.marginLeft, undefined, "nothing inside another: as before");
});

test("gap next-60 #16 Where the money goes: a category with others inside it says what each came to", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = nestAt(nestAt(samplePlan(), "groceries", "shopping"), "transport", "shopping");
  const r = await renderPage(new URL("../../cashflow/spending/view.js", import.meta.url).href, p, "2026-09-20");
  const li = r.root.querySelectorAll("li").find((l) => textOf(l).replace(/^\S+ /, "").startsWith("Shopping and clothes"));
  assert.match(textOf(li), /2 transactions Inside: Groceries \$60 · Car, gas, transit \$48 \$108$/);
  const flat = await renderPage(new URL("../../cashflow/spending/view.js", import.meta.url).href, samplePlan(), "2026-09-20");
  assert.doesNotMatch(flat.text(), /Inside:/);
});
