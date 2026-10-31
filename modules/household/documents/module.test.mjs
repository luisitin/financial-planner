import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, savePlace, addPaper, clearPlace, PAPERS, GROUPS, RECHECK_DAYS, rowKey } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-31";
const rowsOf = (d, g) => d.groups.find((x) => x.key === g).rows;

test("the checklist: one row per person, adult or household; a deed only counts with a home, a title with a car", () => {
  const p = familyPlan(TODAY);   // Ana, Bo (adults), Cy (dependent); a house; no car
  const d = compute(p, { today: TODAY });
  const id = rowsOf(d, "id");
  assert.deepEqual(id.filter((r) => r.paper === "birth").map((r) => r.personName), ["Ana", "Bo", "Cy"]);
  assert.deepEqual(id.filter((r) => r.paper === "photoId").map((r) => r.personName), ["Ana", "Bo"], "photo ID for adults");
  assert.equal(id.find((r) => r.paper === "birth").key, "birth:p-ana");
  const money = rowsOf(d, "money");
  assert.equal(money.find((r) => r.paper === "deed").optional, false, "the family has a house");
  assert.equal(money.find((r) => r.paper === "carTitle").optional, true, "no car: only if you have one");
  // optional rows that are empty do not count; 3 people × (birth, ssn, health cards, medicines) + 2 photo IDs + tax, deed, statements, inventory
  assert.equal(d.total, 3 * 4 + 2 + 4); assert.equal(d.placed, 0); assert.equal(d.started, false);
  assert.equal(rowKey("ssn", "p-bo"), "ssn:p-bo"); assert.equal(rowKey("deed", ""), "deed");
  assert.ok(PAPERS.every((x) => GROUPS[x.group]), "every paper is in a group");
});

test("insurance policies get a row each; signed estate papers are shown read-only with their place", () => {
  const p = familyPlan(TODAY);
  p.insurance = { policies: [{ id: "pol-h", name: "House policy", kind: "home" }, { id: "pol-l", name: "Term life", kind: "term" }] };
  p.estate = { documents: [{ id: "e1", kind: "will", personId: "p-ana", status: "done", where: "attorney's office", updatedAt: "2025-01-01" }, { id: "e2", kind: "will", personId: "p-bo", status: "done", updatedAt: "2025-01-01" }, { id: "e3", kind: "poaFinance", personId: "p-ana", status: "started" }] };
  const d = compute(p, { today: TODAY });
  assert.deepEqual(rowsOf(d, "money").filter((r) => r.paper === "policy").map((r) => [r.key, r.label]), [["policy:pol-h", "Insurance policy: House policy"], ["policy:pol-l", "Insurance policy: Term life"]]);
  const est = rowsOf(d, "estate");
  assert.deepEqual(est.map((r) => [r.label, r.personName, r.where, r.readOnly, r.placed]), [["Will", "Ana", "attorney's office", true, true], ["Will", "Bo", "", true, false]], "only signed papers");
  assert.deepEqual(est[0].go, ["estate", "documents"]);
  const c = d.checks.find((x) => x.id === "estate");
  assert.match(c.text, /^Your will is signed but not where it is/); assert.deepEqual(c.go, ["estate", "documents"]);
});

test("counting: a place counts; \"do not have\" leaves the count; checks for missing places, copies, who knows and old entries", () => {
  const p = familyPlan(TODAY);
  savePlace(p, "birth:p-ana", { where: "fire safe", copy: "scanned folder", who: "Bo" }, TODAY);
  savePlace(p, "ssn:p-ana", { where: "fire safe" }, "2025-06-01");
  savePlace(p, "passport:p-ana", { none: true, where: "ignored" }, TODAY);
  savePlace(p, "taxReturns", { where: "filing cabinet" }, TODAY);
  const d = compute(p, { today: TODAY });
  assert.equal(d.placed, 3); assert.equal(d.total, 18, "the passport is marked as not had, so the total is unchanged");
  assert.equal(rowsOf(d, "id").find((r) => r.key === "passport:p-ana").none, true);
  assert.equal(rowsOf(d, "id").find((r) => r.key === "passport:p-ana").where, "", "not had: no place");
  assert.equal(d.started, true);
  const ids = d.checks.map((c) => c.id);
  assert.deepEqual(ids, ["missing", "copy", "stale"]);
  assert.match(d.checks[0].text, /^15 papers have no place/);
  assert.match(d.checks[1].text, /^1 paper has no copy/, "the Social Security card; tax returns are not on the copy list");
  assert.ok(RECHECK_DAYS === 365 && rowsOf(d, "id").find((r) => r.key === "ssn:p-ana").stale, "written 518 days ago");
  // nobody else knows: only when no placed paper names anyone
  savePlace(p, "birth:p-ana", { where: "fire safe", copy: "scanned folder" }, TODAY);
  assert.ok(compute(p, { today: TODAY }).checks.some((c) => c.id === "who"));
  // an optional paper that is written down counts
  savePlace(p, "passport:p-bo", { where: "desk drawer" }, TODAY);
  const e = compute(p, { today: TODAY });
  assert.equal(e.total, 19); assert.equal(e.placed, 4);
});

test("papers you add, clearing a place, and the empty plan", () => {
  const p = familyPlan(TODAY);
  const key = addPaper(p, "x1", "  Pension letter ", { where: "blue folder" }, TODAY);
  assert.equal(key, "own:x1");
  let own = rowsOf(compute(p, { today: TODAY }), "own");
  assert.deepEqual(own.map((r) => [r.label, r.where, r.custom]), [["Pension letter", "blue folder", true]]);
  savePlace(p, key, { label: "Pension letter (old job)", where: "blue folder", who: "Ana" }, TODAY);
  own = rowsOf(compute(p, { today: TODAY }), "own");
  assert.equal(own[0].label, "Pension letter (old job)"); assert.equal(own[0].who, "Ana");
  assert.equal(clearPlace(p, key), true); assert.equal(clearPlace(p, key), false);
  assert.equal(rowsOf(compute(p, { today: TODAY }), "own").length, 0);
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.started, false); assert.equal(rowsOf(e, "id").find((r) => r.paper === "birth").personName, "", "no people: one row for the household");
  assert.equal(e.share, 0);
});
