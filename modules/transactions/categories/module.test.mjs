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
