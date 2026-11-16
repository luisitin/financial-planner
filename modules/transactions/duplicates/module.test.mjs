import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, findDuplicates } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("empty plan", () => { assert.equal(compute(emptyPlan()).count, 0); });
test("the Amazon line posted twice a day apart is a duplicate; the two Kroger trips a week apart are not", () => {
  const d = compute(samplePlan());
  assert.equal(d.count, 1);
  assert.equal(d.pairs[0].keep.id, "t11"); assert.equal(d.pairs[0].drop.id, "t12"); assert.equal(d.pairs[0].accountName, "Visa card");
  assert.ok(d.pairs[0].why.includes("a day apart"));
});
test("similar descriptions count; different accounts or amounts do not", () => {
  const dup = findDuplicates([
    { id: "a", accountId: "x", date: "2026-09-01", amount: -10, payee: "Starbucks", rawPayee: "STARBUCKS STORE 1234 DAYTON OH" },
    { id: "b", accountId: "x", date: "2026-09-01", amount: -10, payee: "Starbucks", rawPayee: "STARBUCKS 1234 DAYTON" },
    { id: "c", accountId: "y", date: "2026-09-01", amount: -10, payee: "Starbucks", rawPayee: "STARBUCKS 1234 DAYTON" },
    { id: "d", accountId: "x", date: "2026-09-01", amount: -11, payee: "Starbucks", rawPayee: "STARBUCKS 1234 DAYTON" },
    { id: "e", accountId: "x", date: "2026-09-01", amount: -10, payee: "Shell", rawPayee: "SHELL OIL" },
  ]);
  assert.equal(dup.length, 1); assert.equal(dup[0].keep.id, "a"); assert.equal(dup[0].drop.id, "b"); assert.ok(dup[0].why.includes("same day"));
});

// ---- a comment on a copy is never dropped in silence (gap list next 60, item 58; u2 fix M2) --------------------------------
const { dropCopies, commentsKept } = await import("./compute.js");
const said = { text: "What was this?", by: "p-bo", on: "2026-11-12" };
const line = (id, over = {}) => ({ id, accountId: "x", date: "2026-11-01", amount: -5, payee: "Cafe", rawPayee: "CAFE", ...over });

test("item 58: Remove the copy moves the copy's comment to the line that stays, or says it when that line has its own", () => {
  const a = line("a"), b = line("b", { comment: said }), c = line("c", { date: "2026-11-05" });
  const pairs = findDuplicates([a, b, c]);
  assert.deepEqual(pairs.map((p) => [p.keep.id, p.drop.id]), [["a", "b"]], "the earlier line kept, as before");
  const r = dropCopies([a, b, c], pairs);
  assert.deepEqual(r.transactions.map((t) => t.id), ["a", "c"]);
  assert.deepEqual(r.transactions[0].comment, said, "moved to the line that stays"); assert.equal(r.moved, 1); assert.deepEqual(r.lost, []);
  assert.equal("comment" in a, false, "the list given is not changed");
  assert.equal(commentsKept(r, true), "Its comment moved to the one that stays.");
  // both have one: the kept line keeps its own, the copy's words are said
  const k = line("a", { comment: { text: "Lunch with Bo", by: "p-ana", on: "2026-11-02" } });
  const r2 = dropCopies([k, b], findDuplicates([k, b]));
  assert.deepEqual(r2.transactions.map((t) => [t.id, t.comment.text]), [["a", "Lunch with Bo"]]); assert.equal(r2.moved, 0); assert.deepEqual(r2.lost, ["What was this?"]);
  assert.equal(commentsKept(r2, true), "Its comment, “What was this?”, went with it: the one that stays has its own.");
  // no comment: the copy goes as it always did, nothing more said
  const r3 = dropCopies([a, line("b")], findDuplicates([a, line("b")]));
  assert.deepEqual(r3, { transactions: [a], moved: 0, lost: [] }); assert.equal(commentsKept(r3, true), "");
  // Remove all: counted
  assert.equal(commentsKept({ moved: 2, lost: [] }, false), "2 comments moved to the lines that stay.");
  assert.equal(commentsKept({ moved: 1, lost: ["Ok"] }, false), "A comment moved to the lines that stay. A comment, “Ok”, went with its copy: the lines that stay have their own.");
  assert.equal(commentsKept({ moved: 0, lost: ["Ok", "Hm"] }, false), "2 comments went with their copies: the lines that stay have their own.");
});

test("item 58 on the page: Remove the copy keeps the comment on the line that stays and says so; Remove all counts them", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = samplePlan(); p.transactions.find((t) => t.id === "t12").comment = said;
  const r = await renderPage(new URL("./view.js", import.meta.url).href, p, "2026-11-13");
  r.root.querySelectorAll("button").find((b) => textOf(b) === "Remove the copy").click();
  assert.equal(r.saved.length, 1);
  const after = r.saved[0].transactions;
  assert.equal(after.some((t) => t.id === "t12"), false, "the copy is gone");
  assert.deepEqual(after.find((t) => t.id === "t11").comment, said, "its comment is on the line that stays");
  assert.equal(after.length, p.transactions.length - 1, "nothing else removed");
  const r2 = await renderPage(new URL("./view.js", import.meta.url).href, r.saved[0], "2026-11-13");
  assert.match(textOf(r2.root.querySelector(".notice")), /The one from .* stays\. Its comment moved to the one that stays\.$/);
});
