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
  assert.equal(categoryLabel(p, "coffee"), "Coffee"); assert.equal(categoryLabel(p, ""), "Uncategorised"); assert.equal(categoryLabel(p, "ghost"), "ghost");
  assert.equal(categoryIcon(p, ""), "❔"); assert.equal(categoryById(p, "nope"), null);
  assert.equal(list[0].kind, "expense", "spending first, then income, then transfer");
  assert.equal(slug("Coffee & Tea!"), "coffee-tea"); assert.equal(slug(""), "category");
});
test("compute counts usage per category and the uncategorised", () => {
  const d = compute(samplePlan());
  assert.equal(d.total, 16); assert.equal(d.uncategorised, 4);
  const groc = d.categories.find((c) => c.id === "groceries");
  assert.equal(groc.count, 3); assert.ok(Math.abs(groc.total - (-86.40 - 54.12 - 60)) < 0.005);
  assert.equal(d.categories.find((c) => c.id === "transfer").count, 2);
  assert.equal(d.custom, 0);
  assert.ok(d.byKind.expense > 10 && d.byKind.income === 9 && d.byKind.transfer === 1);
});
