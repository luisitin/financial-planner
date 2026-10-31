// tests/router.test.mjs -- the hash address, with the optional ?query a step-by-step guide or a quick
// answer adds (#/balance/liabilities?guide=debt&step=rates). Old addresses parse exactly as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { router } from "../core/router.js";

test("old addresses parse as before, with an empty query", () => {
  assert.deepEqual(router.parse("#/balance/liabilities/abc"), { group: "balance", id: "liabilities", rest: ["abc"], query: {} });
  assert.deepEqual(router.parse("#/goals/house"), { group: "goals", id: "house", rest: [], query: {} });
  for (const h of ["", "#", "#/", undefined, null]) assert.deepEqual(router.parse(h), { group: "overview", id: "dashboard", rest: [], query: {} });
});
test("a query after the path is split off", () => {
  assert.deepEqual(router.parse("#/goals/house?guide=home&step=goal"), { group: "goals", id: "house", rest: [], query: { guide: "home", step: "goal" } });
  const p = router.parse("#/overview/pages/ready?from=quick");
  assert.deepEqual(p.rest, ["ready"]);
  assert.equal(p.query.from, "quick");
  assert.deepEqual(router.parse("#/?more=1"), { group: "overview", id: "dashboard", rest: [], query: { more: "1" } });
  assert.deepEqual(router.parse("#/a/b?x&y=&=z").query, { x: "", y: "" });
  assert.deepEqual(router.parse("#/a/b?t=two%20words").query, { t: "two words" });
});
test("href builds the address and leaves out empty values", () => {
  assert.equal(router.href("goals", "house", [], { guide: "home", step: "goal" }), "#/goals/house?guide=home&step=goal");
  assert.equal(router.href("goals", "house"), "#/goals/house");
  assert.equal(router.href("goals", "house", [], {}), "#/goals/house");
  assert.equal(router.href("goals", "house", [], { x: "", y: null, z: undefined }), "#/goals/house");
  assert.equal(router.href("overview", "pages", ["ready"], { from: "quick" }), "#/overview/pages/ready?from=quick");
});
test("parse(href(...)) gives back what went in", () => {
  for (const [g, i, r, q] of [["balance", "liabilities", [], { guide: "debt", step: "rates" }], ["overview", "guide", ["retire"], {}], ["overview", "pages", ["ready"], { from: "quick" }], ["a", "b", [], { t: "two words & more" }]]) {
    assert.deepEqual(router.parse(router.href(g, i, r, q)), { group: g, id: i, rest: r, query: q });
  }
});
