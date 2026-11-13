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

// ---------------------------------------------------------------- the page (simple first, docs/OPTIONAL.md), drawn on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const { render } = await import("./view.js");
function draw(plan0) {
  const s = { saved: [], root: null, plan: migrate(structuredClone(plan0)) };
  const go = () => { s.root = new FakeElement("main"); render(s.root, { ui, fmt: { ...fmt, today: () => TODAY }, plan: s.plan, route: { group: "household", id: "documents", rest: [], query: {} }, module: { group: "household", id: "documents" },
    store: { get: () => s.plan, update: (fn) => { const d = structuredClone(s.plan); fn(d); s.saved.push(d); s.plan = d; go(); } }, redraw: go }); };
  go();
  return s;
}
const all = (el) => [el, ...el.all()];
const partsOf = (root) => all(root).filter((e) => e.tagName === "DETAILS");
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id);
const opened = (e) => e.hasAttribute("open");
/** a filled button a person can see: not outlined, not inside a shut fold */
const filled = (root) => all(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|danger/.test(e.className) && !e.closest("details:not([open])"));
const said = (el) => { const w = (n) => (n.data !== undefined ? n.data : n.tagName === "STYLE" ? "" : n.tagName === "DETAILS" && !opened(n) ? w(n.childNodes.find((c) => c.tagName === "SUMMARY")) : n.childNodes.map(w).join(" ")); return w(el).replace(/\s+/g, " ").trim(); };

test("simple first: each group a shut row of one card, every fold a part; one filled way on, outside the rows", () => {
  const s = draw(familyPlan(TODAY));
  const ps = partsOf(s.root);
  assert.ok(ps.every((e) => e.dataset.part), "no fold written by hand");
  assert.deepEqual(ps.filter((e) => e.dataset.kind === "item" && /^papers-/.test(e.dataset.part)).map((e) => [e.dataset.part, opened(e)]),
    [["papers-id", false], ["papers-money", false], ["papers-medical", false], ["papers-estate", false]], "the four groups, shut (open today: the first)");
  assert.equal(textOf(partOf(s.root, "papers-id").querySelector(".fold-status")), "0 of 8");
  // "Only if you have them" is a row inside its group
  const extra = partOf(s.root, "extra-id");
  assert.ok(extra && extra.dataset.kind === "item" && extra.parentNode && partOf(s.root, "papers-id").all().includes(extra));
  // the how part, by its pinned title
  const how = partOf(s.root, "places");
  assert.equal(how.dataset.kind, "how"); assert.equal(textOf(how.querySelector(".fold-title")), "Good places to keep papers"); assert.ok(!opened(how));
  // one filled button, outside the rows: the next paper
  assert.match(said(s.root), /Next paper: Birth certificate \(Ana\) Write where it is kept/);
  assert.deepEqual(filled(s.root).map((b) => textOf(b)), ["Write where it is kept"]);
  // papers of your own: no empty fold, one outlined button
  assert.equal(partOf(s.root, "papers-own"), undefined);
  assert.ok(all(s.root).some((e) => e.tagName === "BUTTON" && textOf(e) === "+ Add a paper of your own" && /secondary/.test(e.className)));
  // More on this: the family packet, once something is written (before that, the one way to start is the button)
  assert.equal(all(s.root).find((e) => e.tagName === "SECTION" && e.dataset.links !== undefined), undefined);
  const started = familyPlan(TODAY); savePlace(started, "taxReturns", { where: "Blue box in the attic" }, TODAY);
  const card = all(draw(started).root).find((e) => e.tagName === "SECTION" && e.dataset.links !== undefined);
  assert.deepEqual(all(card).filter((e) => e.tagName === "A").map((x) => x.getAttribute("href")), ["#/estate/documents", "#/reports/if-something-happens"]);
});

test("S11: the way on opens that paper's group and its form; a save says so, and the group saved stays open (R17)", () => {
  const s = draw(familyPlan(TODAY));
  filled(s.root)[0].click();
  const g = partOf(s.root, "papers-id");
  assert.ok(opened(g), "its group opens");
  assert.deepEqual(partsOf(s.root).filter((e) => opened(e)).map((e) => e.dataset.part), ["papers-id"]);
  const form = all(g).find((e) => e.tagName === "FORM");
  assert.ok(form);
  assert.deepEqual(filled(s.root).map((b) => textOf(b)), ["Save"], "while the form is open its Save is the one filled button");
  form.querySelector('[name="where"]').value = "Fire safe in the hall closet";
  form.dispatch("submit");
  assert.equal(s.saved.length, 1);
  assert.equal(s.plan.papers[0].where, "Fire safe in the hall closet");
  assert.ok(opened(partOf(s.root, "papers-id")), "the group saved stays open");
  assert.deepEqual(partsOf(s.root).filter((e) => opened(e)).map((e) => e.dataset.part), ["papers-id"], "no other part opens");
  assert.match(said(s.root), /Saved where your birth certificate \(Ana\) is kept\./);
  assert.match(said(s.root), /Next paper: Birth certificate \(Bo\) Write where it is kept/);
});
