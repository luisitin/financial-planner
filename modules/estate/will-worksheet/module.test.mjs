// modules/estate/will-worksheet/module.test.mjs -- "Choices to take to a lawyer" (gap design #14): the shares check and
// each sentence it refuses with, the guardian read from Estate documents, one written sentence per case, the empty
// state, the saves (green line, the part stays open: S11), the printed sheet's sections, and the invariance rule (with
// estate.worksheet absent or present, no other page's compute changes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, sharesCheck, giftsCheck, restWords, saveWorksheet, headlineOf, ledeOf, lawyerLinkWords, refusal, nothingWords, NOT_A_WILL, pct, ROWS, SHEET, INTROS, NOT_DECIDED } from "./compute.js";
import { compute as documents } from "../documents/compute.js";
import { compute as packet } from "../../reports/if-something-happens/compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";

const T = "2026-11-13";
/** The family with every row written. */
function fullPlan() {
  const p = migrate(familyPlan(T));
  saveWorksheet(p, { who: "Aunt Kay", guardianBackup: "Uncle Lou", childrenAge: 25 }, T, "g-1");
  saveWorksheet(p, { executor: "Each other, then Dee", executorBackup: "Lou", poaMoney: "Each other", poaHealth: "Each other, then Kay" }, T);
  saveWorksheet(p, { rest: [{ name: "Cy", share: 0.6 }, { name: "The food bank", share: 0.4 }] }, T);
  saveWorksheet(p, { specific: [{ what: "The piano", to: "Kay" }] }, T);
  saveWorksheet(p, { pets: "The dog goes to Lou", notes: "We also own a cabin in another state" }, T);
  return p;
}

// ---------------------------------------------------------------- the one formula
test("gap #14, test 1: the shares must add up to 100%, and each refusal is said in words", () => {
  const ok = sharesCheck([{ name: " Bo ", share: 0.6 }, { name: "Cy", share: 0.4 }, { name: "", share: null }]);
  assert.deepEqual(ok, { ok: true, rows: [{ name: "Bo", share: 0.6 }, { name: "Cy", share: 0.4 }], sum: 1, error: "" });
  assert.deepEqual(sharesCheck([]), { ok: true, rows: [], sum: 0, error: "" }, "nothing decided yet is fine");
  assert.deepEqual(sharesCheck([{ name: "", share: "" }]).rows, []);
  // every share empty: equal shares
  assert.deepEqual(sharesCheck([{ name: "Bo" }, { name: "Cy" }]).rows, [{ name: "Bo", share: 0.5 }, { name: "Cy", share: 0.5 }]);
  assert.deepEqual(sharesCheck([{ name: "Bo", share: null }]).rows, [{ name: "Bo", share: 1 }]);
  const three = sharesCheck([{ name: "A" }, { name: "B" }, { name: "C" }]);
  assert.ok(three.ok); assert.ok(Math.abs(three.rows.reduce((s, r) => s + r.share, 0) - 1) < 1e-12);
  // thirds typed to one decimal are 100%
  assert.equal(sharesCheck([{ name: "A", share: 0.333 }, { name: "B", share: 0.333 }, { name: "C", share: 0.334 }]).ok, true);
  // too little, too much
  assert.equal(sharesCheck([{ name: "Bo", share: 0.5 }, { name: "Cy", share: 0.4 }]).error, "The shares add up to 90%. They must add up to 100%: 10% is still to give.");
  assert.equal(sharesCheck([{ name: "Bo", share: 0.7 }, { name: "Cy", share: 0.4 }]).error, "The shares add up to 110%. They must add up to 100%: take off 10%.");
  assert.equal(sharesCheck([{ name: "A", share: 0.33 }, { name: "B", share: 0.33 }, { name: "C", share: 0.33 }]).error, "The shares add up to 99%. They must add up to 100%: 1% is still to give.");
  assert.equal(sharesCheck([{ name: "Bo", share: 0.5 }]).error, "The shares add up to 50%. They must add up to 100%: 50% is still to give.");
  // a share for some and not for others; a share with no name; a share out of range
  assert.equal(sharesCheck([{ name: "Bo", share: 0.5 }, { name: "Cy", share: null }]).error, "Give every name a share, or leave every share empty to split it equally.");
  assert.equal(sharesCheck([{ name: "Bo", share: 0.5 }, { name: "", share: 0.5 }]).error, "Write who gets the 50% share.");
  assert.equal(sharesCheck([{ name: "Bo", share: 1.5 }]).error, "A share is more than 0% and at most 100%.");
  assert.equal(sharesCheck([{ name: "Bo", share: 0 }, { name: "Cy", share: 1 }]).error, "A share is more than 0% and at most 100%.");
  assert.equal(sharesCheck([{ name: "Bo", share: -0.2 }, { name: "Cy", share: 1.2 }]).ok, false);
  assert.equal(pct(0.5), "50%"); assert.equal(pct(0.333), "33.3%"); assert.equal(pct(1), "100%");
});

test("who gets what, one written sentence per case: no one, one name, equal shares, unequal shares", () => {
  assert.equal(restWords([]), NOT_DECIDED);
  assert.equal(restWords([{ name: "Bo", share: 1 }]), "Everything goes to Bo.");
  assert.equal(restWords([{ name: "Bo", share: 0.5 }, { name: "Cy", share: 0.5 }]), "Bo and Cy get equal shares.");
  assert.equal(restWords(sharesCheck([{ name: "A" }, { name: "B" }, { name: "C" }]).rows), "A, B and C get equal shares.");
  assert.equal(restWords([{ name: "Cy", share: 0.6 }, { name: "The food bank", share: 0.4 }]), "Cy 60%, The food bank 40%.");
});

// ---------------------------------------------------------------- what it reads
test("gap #14, test 2: the guardian is read from Estate documents, and saved back to the same box", () => {
  const p = migrate(familyPlan(T));
  assert.equal(compute(p, { today: T }).values.who, "");
  p.estate.documents.push({ id: "d-g", kind: "guardian", personId: "", status: "started", done: false, updatedAt: "", where: "", notes: "", who: " Aunt  Kay " });
  const d = compute(p, { today: T });
  assert.equal(d.values.who, "Aunt Kay");
  assert.deepEqual(d.rows.find((r) => r.key === "children"), { key: "children", title: "For the children", main: true, filled: true, says: "1 of 3 filled in" });
  assert.equal(d.sheet.find((s) => s.key === "guardian").lines[0], "First choice: Aunt Kay");
  // changed here: the same row, its status and notes untouched; Estate documents shows the new name
  saveWorksheet(p, { who: "Uncle Lou", guardianBackup: "", childrenAge: null }, T, "new-id");
  assert.equal(p.estate.documents.filter((r) => r.kind === "guardian").length, 1);
  assert.deepEqual(p.estate.documents.find((r) => r.kind === "guardian"), { id: "d-g", kind: "guardian", personId: "", status: "started", done: false, updatedAt: "", where: "", notes: "", who: "Uncle Lou" });
  assert.equal(documents(p, { today: T }).items.find((x) => x.kind === "guardian").who, "Uncle Lou");
  assert.equal(p.estate.worksheet, undefined, "only the guardian was typed: nothing of the worksheet's own to keep");
  // no guardian row yet: one is made, not signed
  const q = migrate(familyPlan(T));
  saveWorksheet(q, { who: "Kay" }, T, "g-9");
  assert.deepEqual(q.estate.documents.find((r) => r.kind === "guardian"), { id: "g-9", kind: "guardian", personId: "", status: "none", done: false, updatedAt: "", where: "", notes: "", who: "Kay" });
  // and an empty name makes no row
  const e = migrate(familyPlan(T));
  saveWorksheet(e, { who: "  " }, T, "g-9");
  assert.equal(e.estate.documents.some((r) => r.kind === "guardian"), false);
});

test("pets are the same line as Final wishes: read from it, saved to it, the other wishes kept", () => {
  const p = migrate(familyPlan(T));
  p.estate.wishes = { funeral: "A small service", written: "", pets: "The cat goes to Dee", tell: "", letterWhere: "", updatedAt: "2026-01-01" };
  assert.equal(compute(p, { today: T }).values.pets, "The cat goes to Dee");
  saveWorksheet(p, { pets: "The cat goes to Kay", notes: "" }, T);
  assert.deepEqual(p.estate.wishes, { funeral: "A small service", written: "", pets: "The cat goes to Kay", tell: "", letterWhere: "", updatedAt: T });
  assert.equal(packet(p, { today: T }).wishes.pets, "The cat goes to Kay");
  assert.equal(p.estate.worksheet, undefined);
  // of the wishes, only the pets line is read here (which is why gap #11's invariance test leaves this page out)
  const q = structuredClone(p); q.estate.wishes = { ...q.estate.wishes, funeral: "Something else", written: "In the desk", tell: "Lou", letterWhere: "The safe", updatedAt: "2026-02-02" };
  assert.equal(JSON.stringify(compute(q, { today: T })), JSON.stringify(compute(p, { today: T })));
  const r = structuredClone(p); delete r.estate.wishes;
  assert.notEqual(JSON.stringify(compute(r, { today: T })), JSON.stringify(compute(p, { today: T })));
});

test("the children's row: drawn with children under 18, with no one listed yet, or when something is written in it", () => {
  const keys = (p) => compute(p, { today: T }).rows.map((r) => r.key);
  assert.deepEqual(keys(migrate(familyPlan(T))), ROWS.map((r) => r.key));
  assert.deepEqual(compute(migrate(familyPlan(T)), { today: T }).children, ["Cy"]);
  assert.deepEqual(keys(migrate(emptyPlan())), ROWS.map((r) => r.key), "no one on the People page yet: we cannot know, so the row is there");
  const couple = migrate(retiredCouplePlan());
  assert.deepEqual(keys(couple), ["people", "rest", "gifts", "other"]);
  assert.deepEqual(compute(couple, { today: T }).sheet.map((s) => s.key), ["executor", "rest", "gifts", "pets", "powers", "notes"]);
  assert.equal(compute(couple, { today: T }).total, 2);
  saveWorksheet(couple, { guardianBackup: "Lou" }, T);
  assert.deepEqual(keys(couple), ROWS.map((r) => r.key), "something written: never hidden");
});

test("statuses: at most 20 characters, the main rows 'not set yet', the optional ones 'optional'", () => {
  const says = (p) => Object.fromEntries(compute(p, { today: T }).rows.map((r) => [r.key, r.says]));
  assert.deepEqual(says(migrate(familyPlan(T))), { children: "not set yet", people: "not set yet", rest: "not set yet", gifts: "optional", other: "optional" });
  assert.deepEqual(says(fullPlan()), { children: "3 of 3 filled in", people: "4 of 4 filled in", rest: "2 names", gifts: "1 gift", other: "2 of 2 filled in" });
  const one = migrate(emptyPlan()); saveWorksheet(one, { rest: [{ name: "Bo", share: 1 }], specific: [{ what: "A", to: "B" }, { what: "C", to: "D" }] }, T);
  assert.equal(says(one).rest, "1 name"); assert.equal(says(one).gifts, "2 gifts");
  for (const p of [fullPlan(), migrate(emptyPlan())]) for (const r of compute(p, { today: T }).rows) assert.ok(r.says.length <= 20, r.says);
});

// ---------------------------------------------------------------- one written sentence per case
test("the headline and its sentence, one per case: nothing written, some main choices open, all main choices written", () => {
  const none = compute(migrate(familyPlan(T)), { today: T });
  assert.equal(headlineOf(none), "Nothing written down yet");
  assert.equal(ledeOf(none), "Write down your choices first; a lawyer turns them into a will.");
  const some = migrate(familyPlan(T)); saveWorksheet(some, { executor: "Dee" }, T);
  assert.equal(headlineOf(compute(some, { today: T })), "1 of 3 choices written down");
  assert.equal(ledeOf(compute(some, { today: T })), "Write down the rest when you are ready, or print what you have. A lawyer turns your choices into a will.");
  // only an optional row written: still none of the main ones
  const opt = migrate(familyPlan(T)); saveWorksheet(opt, { specific: [{ what: "The piano", to: "Kay" }] }, T);
  assert.equal(headlineOf(compute(opt, { today: T })), "0 of 3 choices written down");
  const all = compute(fullPlan(), { today: T });
  assert.equal(headlineOf(all), "Your choices are written down");
  assert.equal(ledeOf(all), "Print the sheet and take it to a lawyer, who turns your choices into a will.");
  // a couple with no children under 18: two main choices
  const couple = migrate(retiredCouplePlan()); saveWorksheet(couple, { executor: "Each other" }, T);
  assert.equal(headlineOf(compute(couple, { today: T })), "1 of 2 choices written down");
});

test("the line that is never folded, one sentence per case: no lawyer on Who to call, or one by name", () => {
  const p = migrate(familyPlan(T));
  assert.equal(NOT_A_WILL, "This is not a will. State laws differ; a lawyer makes it valid.");
  assert.equal(lawyerLinkWords(compute(p, { today: T })), "Keep a lawyer's number on Who to call ›");
  p.contacts = [{ id: "k-1", role: "attorney", name: "", firm: "Park Law", phone: "555-0100" }];
  assert.equal(lawyerLinkWords(compute(p, { today: T })), "Your lawyer, Park Law, is on Who to call ›");
});

test("a password or a long number is refused in words, and left off the sheet if it is already stored", () => {
  assert.equal(refusal("Aunt Kay"), "");
  assert.match(refusal("password: hunter22"), /^This looks like a password/);
  assert.match(refusal("account 123456789012"), /^This holds a long number/); // leak-guard: ok -- an invented run, the case under test
  const p = migrate(familyPlan(T));
  p.estate.worksheet = { executor: "password: hunter22", notes: "Dee" };
  const d = compute(p, { today: T });
  assert.equal(d.values.executor, ""); assert.equal(d.values.notes, "Dee");
});

test("saveWorksheet: texts trimmed, a row's patch leaves the other rows alone, an emptied worksheet is removed", () => {
  const p = migrate(emptyPlan());
  assert.deepEqual(saveWorksheet(p, { executor: "  Dee   Park ", executorBackup: "", poaMoney: "", poaHealth: "" }, T),
    { executor: "Dee Park", executorBackup: "", guardianBackup: "", poaMoney: "", poaHealth: "", notes: "", childrenAge: null, specific: [], rest: [], updatedAt: T });
  saveWorksheet(p, { childrenAge: 25, guardianBackup: "Lou" }, T);
  assert.equal(p.estate.worksheet.executor, "Dee Park"); assert.equal(p.estate.worksheet.childrenAge, 25);
  saveWorksheet(p, { childrenAge: 2.5 }, T); assert.equal(p.estate.worksheet.childrenAge, null, "not a whole age: not kept");
  saveWorksheet(p, { specific: [{ what: " The piano ", to: "Kay" }, { what: "", to: "" }] }, T);
  assert.deepEqual(p.estate.worksheet.specific, [{ what: "The piano", to: "Kay" }]);
  saveWorksheet(p, { executor: "", executorBackup: "", poaMoney: "", poaHealth: "" }, T);
  saveWorksheet(p, { guardianBackup: "", childrenAge: null }, T);
  assert.equal(saveWorksheet(p, { specific: [] }, T), null);
  assert.equal(p.estate.worksheet, undefined);
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
test("a plan with something else where a list should be (a damaged file) reads as empty instead of failing", () => {
  for (const estate of [{ documents: {} }, { documents: "x", worksheet: "x" }, { documents: null, worksheet: { rest: {}, specific: 3 } }]) {
    for (const rest of [{ contacts: {} }, { contacts: "x", household: { people: {} } }, { household: { people: [null, { role: "dependent", name: "Cy" }] } }]) {
      const d = compute({ ...rest, estate }, { today: T });
      assert.equal(headlineOf(d), "Nothing written down yet");
      assert.equal(d.lawyer, "");
    }
  }
  const p = { estate: { documents: {} } };
  saveWorksheet(p, { who: "Aunt Kay" }, T, "g-1");
  assert.equal(compute(p, { today: T }).values.who, "Aunt Kay");
});

const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map((n) => (n == null ? String(n) : typeof n)).join(", ")}): a browser would write it`);
  return appendOf.apply(this, ns);
};
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { render, TITLE } = await import("./view.js");
function page(plan0) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], root: null };
  const ctx = () => ({ ui, fmt: { ...fmt, today: () => T }, plan, route: { group: "estate", id: "will-worksheet", rest: [], query: {} }, module: { group: "estate", id: "will-worksheet" },
    store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } }, redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); render(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const all_ = (el) => [el, ...el.all()];
const partsOf = (root) => all_(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const opened = (e) => e.hasAttribute("open");
const formIn = (root, id) => all_(partOf(root, id)).find((e) => e.tagName === "FORM");
const okIn = (root, id) => textOf(all_(partOf(root, id)).find((e) => e.className === "notice ok") ?? { childNodes: [] });
const warnIn = (root, id) => textOf(all_(partOf(root, id)).find((e) => e.className === "notice warn") ?? { childNodes: [] });
const buttons = (root) => all_(root).filter((e) => e.tagName === "BUTTON" && e.getAttribute("type") !== "submit" && !e.closest("details"));
/** The words a person sees without opening anything (a shut part shows its summary; the hidden sheet nothing). */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const wordsOf = (t) => t.split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

test("gap #14, test 4: the empty state says what to do first, with one way to start, five shut rows and the line that is never folded", () => {
  for (const plan of [emptyPlan(), familyPlan(T)]) {
    const s = page(plan);
    const t = seen(s.root);
    assert.match(t, /^Nothing written down yet Write down your choices first; a lawyer turns them into a will\. Start with the first choice ›/);
    assert.match(t, /Your choices For the children not set yet › Who acts for you not set yet › Who gets what not set yet › Special gifts optional › Pets and notes optional ›/);
    assert.match(t, /This is not a will\. State laws differ; a lawyer makes it valid\. Keep a lawyer's number on Who to call ›$/);
    assert.ok(wordsOf(t) <= 100, `${wordsOf(t)} words on the empty first view`);
    assert.deepEqual(partsOf(s.root).map((e) => [e.dataset.part, e.dataset.kind, opened(e)]), ROWS.map((r) => [r.key, "item", false]));
    assert.deepEqual(buttons(s.root).map((b) => [textOf(b), b.className ?? ""]), [["Start with the first choice ›", ""]], "one filled button, no Print yet");
    assert.equal(all_(s.root).some((e) => e.tagName === "SECTION" && e.dataset.links !== undefined), false, "no More on this while empty");
    assert.ok(!all_(s.root).some((e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) && !e.closest("details")), "no box outside the rows");
    // Start opens the first row; its Save is then the filled button and Start goes quiet. Nothing is saved by opening
    buttons(s.root)[0].click();
    assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["children"]);
    assert.deepEqual(buttons(s.root).map((b) => [textOf(b), b.className]), [["Start with the first choice ›", "secondary"]]);
    assert.equal(s.saved.length, 0);
  }
});

test("the full page: the headline, Print my choices, the rows with their statuses, More on this; every row is worth a tap", () => {
  const s = page(fullPlan());
  const t = seen(s.root);
  assert.match(t, /^Your choices are written down Print the sheet and take it to a lawyer, who turns your choices into a will\. Print my choices Your choices For the children 3 of 3 filled in › Who acts for you 4 of 4 filled in › Who gets what 2 names › Special gifts 1 gift › Pets and notes 2 of 2 filled in ›/);
  assert.match(t, /Last saved November 13, 2026\.|Last saved Nov 13, 2026\.|Last saved 11\/13\/2026\./);
  assert.match(t, /More on this Are the will and the other papers signed\? Estate documents › Who is named on each account and policy\? Beneficiary audit › What would your family need if something happened to you\? One packet to print ›$/);
  assert.deepEqual(buttons(s.root).map((b) => textOf(b)), ["Print my choices"]);
  assert.ok(wordsOf(t) <= 240);
  for (const plan of [emptyPlan(), familyPlan(T), fullPlan(), renterDebtPlan(), retiredCouplePlan()]) {
    for (const e of partsOf(page(plan).root)) {
      const body = e.children.find((c) => /fold-body/.test(c.className));
      const words = wordsOf(textOf(body)), rows = all_(body).filter((x) => /\bfield\b/.test(x.className ?? "")).length;
      assert.ok(words >= 40 || rows >= 3, `${e.dataset.part}: ${words} words, ${rows} rows`);
      const first = all_(body).filter((x) => /^(INPUT|TEXTAREA)$/.test(x.tagName) && !x.closest(".form-more"));
      assert.ok(first.length <= 5, `${e.dataset.part}: ${first.length} boxes before "More ... (optional)"`);
      assert.ok(!all_(body).some((x) => x.hasAttribute?.("required")), "nothing is required");
      assert.equal(textOf(body).startsWith(INTROS[e.dataset.part]), true);
    }
  }
});

test("S11: a row saves through store.update, the green line names the new answer, the saved row stays open and no other opens", () => {
  const s = page(familyPlan(T));
  let f = formIn(s.root, "people");
  assert.deepEqual(all_(f).filter((e) => e.getAttribute?.("name")).map((e) => e.getAttribute("name")), ["executor", "executorBackup", "poaMoney", "poaHealth"]);
  f.querySelector('[name="executor"]').value = "  Each other, then Dee ";
  f.dispatch("submit");
  assert.equal(s.saved.length, 1);
  assert.equal(s.plan().estate.worksheet.executor, "Each other, then Dee");
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["people"], "R17: the saved part stays open, no other opens");
  assert.equal(okIn(s.root, "people"), "Saved. 1 of 3 choices written down.");
  assert.match(seen(s.root), /^1 of 3 choices written down .* Print my choices/);
  assert.match(seen(s.root), /Who acts for you 1 of 4 filled in ›/);
  // the same headline after a second save: the line says only that it saved
  f = formIn(s.root, "people"); f.querySelector('[name="poaMoney"]').value = "Each other"; f.dispatch("submit");
  assert.equal(okIn(s.root, "people"), "Saved.");
  // the children: the guardian goes to Estate documents, the rest to the worksheet
  f = formIn(s.root, "children");
  assert.match(textOf(f), /Who would raise the children \(Cy\)\?/);
  f.querySelector('[name="who"]').value = "Aunt Kay"; f.querySelector('[name="childrenAge"]').value = "25"; f.dispatch("submit");
  assert.equal(s.plan().estate.documents.find((r) => r.kind === "guardian").who, "Aunt Kay");
  assert.equal(s.plan().estate.worksheet.childrenAge, 25);
  assert.equal(okIn(s.root, "children"), "Saved. 2 of 3 choices written down.");
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["children"]);
  // pets go to Final wishes
  f = formIn(s.root, "other"); f.querySelector('[name="pets"]').value = "The dog goes to Lou"; f.dispatch("submit");
  assert.equal(s.plan().estate.wishes.pets, "The dog goes to Lou");
  assert.equal(okIn(s.root, "other"), "Saved.");
  // a password is held at its box: nothing saved
  const n = s.saved.length;
  f = formIn(s.root, "people"); f.querySelector('[name="executorBackup"]').value = "password: hunter22"; f.dispatch("submit");
  assert.equal(s.saved.length, n);
});

test("Save on a row that is empty and stays empty writes nothing and says what to do, one sentence per row", () => {
  for (const [key, words] of [["children", "Nothing to save yet. Write a name in the first box."], ["people", "Nothing to save yet. Write a name in the first box."],
    ["rest", "Nothing to save yet. Write a name in the first box."], ["gifts", "Nothing to save yet. Write the gift in the first box."], ["other", "Nothing to save yet. Write something in a box first."]]) {
    assert.equal(nothingWords(key), words);
    const s = page(familyPlan(T));
    const f = formIn(s.root, key);
    f.dispatch("submit"); f.dispatch("submit");
    assert.equal(s.saved.length, 0, `${key}: nothing written`);
    assert.equal(okIn(s.root, key), "", `${key}: no green line`);
    assert.deepEqual(all_(partOf(s.root, key)).filter((e) => e.className === "notice warn").map((e) => textOf(e)), [words], "said once, under the form");
    assert.match(seen(s.root), /^Nothing written down yet/);
  }
  // a row that held something and is emptied does save (it takes the choice away)
  const s = page(familyPlan(T));
  let f = formIn(s.root, "people"); f.querySelector('[name="executor"]').value = "Dee"; f.dispatch("submit");
  f = formIn(s.root, "people"); f.querySelector('[name="executor"]').value = ""; f.dispatch("submit");
  assert.equal(s.saved.length, 2); assert.equal(s.plan().estate.worksheet, undefined);
  assert.equal(okIn(s.root, "people"), "Saved. Nothing written down yet.");
  // spaces only are nothing
  f = formIn(s.root, "people"); f.querySelector('[name="executor"]').value = "   "; f.dispatch("submit");
  assert.equal(s.saved.length, 2); assert.equal(warnIn(s.root, "people"), "Nothing to save yet. Write a name in the first box.");
});

test("the green line of the last save goes when the next Save is refused, and when a box is typed in again", () => {
  const fresh = () => { const s = page(familyPlan(T)); const f = formIn(s.root, "rest");
    f.querySelector('[name="name0"]').value = "Bo"; f.querySelector('[name="share0"]').value = "60";
    f.querySelector('[name="name1"]').value = "Cy"; f.querySelector('[name="share1"]').value = "40"; f.dispatch("submit");
    assert.equal(okIn(s.root, "rest"), "Saved. 1 of 3 choices written down.");
    return s; };
  // a password, a long number, shares that do not add up, a share with no name beside one without: each refusal
  for (const [box, value] of [["name0", "password: hunter22"], ["name1", "account 1234 5678 9012"], ["share1", "30"], ["share1", ""]]) {
    const s = fresh(), f = formIn(s.root, "rest");
    f.querySelector(`[name="${box}"]`).value = value; f.dispatch("submit");
    assert.equal(s.saved.length, 1, `${box}: refused, nothing more saved`);
    assert.equal(okIn(s.root, "rest"), "", `${box} = "${value}": the green line is gone`);
  }
  // half a gift
  { const s = page(familyPlan(T)); let f = formIn(s.root, "gifts");
    f.querySelector('[name="what0"]').value = "The piano"; f.querySelector('[name="to0"]').value = "Kay"; f.dispatch("submit");
    assert.match(okIn(s.root, "gifts"), /^Saved\./);
    f = formIn(s.root, "gifts"); f.querySelector('[name="to0"]').value = ""; f.dispatch("submit");
    assert.equal(s.saved.length, 1); assert.equal(okIn(s.root, "gifts"), ""); }
  // typing again: what is in the boxes is no longer what was saved
  const s = fresh();
  formIn(s.root, "rest").dispatch("input");
  assert.equal(okIn(s.root, "rest"), "");
});

test("the saved row shuts when the person opens another row, unless they typed in it again; opening never saves", () => {
  const saved = () => { const s = page(familyPlan(T)); const f = formIn(s.root, "children");
    f.querySelector('[name="who"]').value = "Aunt Kay"; f.dispatch("submit");
    assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["children"]);
    return s; };
  const openRow = (s, id) => { const el = partOf(s.root, id); el.open = true; el.dispatch("toggle"); };
  let s = saved();
  openRow(s, "rest");
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["rest"]);
  assert.equal(s.saved.length, 1);
  // shutting a row shuts nothing else
  s = saved();
  { const el = partOf(s.root, "rest"); el.open = false; el.dispatch("toggle"); }
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["children"]);
  // typed in again and not saved: it stays open, so nothing typed goes out of sight
  s = saved();
  formIn(s.root, "children").dispatch("input");
  openRow(s, "rest");
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["children", "rest"]);
  // rows the person opened by hand stay as they left them
  s = page(familyPlan(T));
  openRow(s, "people"); openRow(s, "rest");
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["people", "rest"]);
});

test("who gets what: the form refuses shares that do not add up, in words, and saves equal shares when none is typed", () => {
  const s = page(familyPlan(T));
  let f = formIn(s.root, "rest");
  const more = all_(f).find((e) => e.tagName === "DETAILS");
  assert.match(textOf(more), /^More people \(optional\)/); assert.equal(opened(more), false);
  assert.match(textOf(f), /Their share \(leave empty to split equally\)/);
  f.querySelector('[name="name0"]').value = "Bo"; f.querySelector('[name="share0"]').value = "50";
  f.querySelector('[name="name1"]').value = "Cy"; f.querySelector('[name="share1"]').value = "40";
  f.dispatch("submit");
  assert.equal(s.saved.length, 0, "refused: nothing saved");
  assert.equal(textOf(all_(f).find((e) => e.className === "notice error")), "The shares add up to 90%. They must add up to 100%: 10% is still to give.");
  f.querySelector('[name="share1"]').value = "50"; f.dispatch("submit");
  assert.deepEqual(s.plan().estate.worksheet.rest, [{ name: "Bo", share: 0.5 }, { name: "Cy", share: 0.5 }]);
  assert.equal(okIn(s.root, "rest"), "Saved. 1 of 3 choices written down.");
  // equal shares come back as empty share boxes; unequal ones as typed
  f = formIn(s.root, "rest");
  assert.equal(f.querySelector('[name="share0"]').value, ""); assert.equal(f.querySelector('[name="name1"]').value, "Cy");
  f.querySelector('[name="name2"]').value = "The food bank"; f.dispatch("submit");
  assert.equal(s.plan().estate.worksheet.rest.length, 3);
  assert.match(seen(s.root), /Who gets what 3 names ›/);
  f = formIn(s.root, "rest");
  assert.equal(opened(all_(f).find((e) => e.tagName === "DETAILS")), true, "a third name is saved: its line is open");
  for (const [k, val] of [["share0", "60"], ["share1", "30"], ["share2", "10"]]) f.querySelector(`[name="${k}"]`).value = val;
  f.dispatch("submit");
  assert.deepEqual(s.plan().estate.worksheet.rest.map((r) => r.share), [0.6, 0.3, 0.1]);
  assert.equal(String(formIn(s.root, "rest").querySelector('[name="share0"]').value), "60");
});

test("special gifts: a gift needs both what it is and who gets it", () => {
  const s = page(familyPlan(T));
  let f = formIn(s.root, "gifts");
  f.querySelector('[name="what0"]').value = "The piano"; f.dispatch("submit");
  assert.equal(s.saved.length, 0, "half a gift: held at its box (ui.fieldError), nothing saved");
  assert.deepEqual(giftsCheck([{ what: "The piano", to: "" }]), { ok: false, list: [{ what: "The piano", to: "" }], at: 0, missing: "to", error: "Write who gets this gift." });
  assert.deepEqual(giftsCheck([{ what: "A", to: "B" }, { what: " ", to: "Kay" }]), { ok: false, list: [{ what: "A", to: "B" }, { what: "", to: "Kay" }], at: 1, missing: "what", error: "Write what the gift is." });
  assert.deepEqual(giftsCheck([{ what: " A ", to: "B" }, { what: "", to: "" }]), { ok: true, list: [{ what: "A", to: "B" }], at: -1, missing: "", error: "" });
  f.querySelector('[name="what0"]').value = ""; f.querySelector('[name="to0"]').value = "Kay"; f.dispatch("submit");
  assert.equal(s.saved.length, 0);
  f.querySelector('[name="what0"]').value = "The piano"; f.dispatch("submit");
  assert.deepEqual(s.plan().estate.worksheet.specific, [{ what: "The piano", to: "Kay" }]);
  assert.equal(okIn(s.root, "gifts"), "Saved. 0 of 3 choices written down.");
});

test("gap #14, test 3: the printed sheet holds every row, hidden on screen, with 'Not decided yet.' where nothing is written", () => {
  const s = page(fullPlan());
  const wrap = all_(s.root).find((e) => /rp-root/.test(e.className ?? ""));
  assert.equal(wrap.hidden, true, "drawn for the printer only");
  const sheet = all_(wrap).find((e) => /rp-sheet/.test(e.className ?? ""));
  assert.deepEqual(all_(sheet).filter((e) => e.tagName === "H2").map((e) => textOf(e)), SHEET.map((x) => x.title));
  assert.equal(textOf(all_(sheet).find((e) => e.tagName === "H1")), TITLE);
  const t = textOf(sheet);
  assert.match(t, /Written down November 13, 2026\. This is not a will\. It is a list of our choices for a lawyer/);
  for (const line of ["First choice: Aunt Kay", "Second choice: Uncle Lou", "First choice: Each other, then Dee", "Second choice: Lou", "Cy 60%, The food bank 40%.", "The piano: to Kay",
    "Each child gets their share outright at age 25.", "The dog goes to Lou", "Who handles the money if we cannot: Each other", "Who makes medical decisions if we cannot: Each other, then Kay", "We also own a cabin in another state"]) assert.ok(t.includes(line), line);
  assert.match(t, /Never on this sheet: passwords, full account numbers or Social Security numbers\.$/);
  // a household with no children under 18 and nothing written for children: neither of the children's sections is printed
  for (const plan of [retiredCouplePlan(), retiredCouplePlan(T)]) {
    const c = page(plan);
    const heads = all_(all_(c.root).find((e) => /rp-sheet/.test(e.className ?? ""))).filter((e) => e.tagName === "H2").map((e) => textOf(e));
    assert.deepEqual(heads, SHEET.filter((x) => x.key !== "guardian" && x.key !== "childrenMoney").map((x) => x.title));
    assert.doesNotMatch(textOf(c.root), /children/i);
  }
  assert.equal(SHEET.find((x) => x.key === "executor").title, "Who carries out our will");
  // nothing written: every section still there, saying so
  const e = compute(migrate(familyPlan(T)), { today: T });
  assert.deepEqual(e.sheet.map((x) => x.key), SHEET.map((x) => x.key));
  assert.deepEqual(e.sheet.find((x) => x.key === "guardian").lines, ["First choice: Not decided yet.", "Second choice: Not decided yet."]);
  assert.deepEqual(e.sheet.find((x) => x.key === "rest").lines, ["Not decided yet."]);
  assert.deepEqual(e.sheet.find((x) => x.key === "gifts").lines, ["None written down."]);
  assert.deepEqual(e.sheet.find((x) => x.key === "childrenMoney").lines, ["The age each child gets their share outright: Not decided yet."]);
  assert.deepEqual(e.sheet.find((x) => x.key === "pets").lines, ["Nothing written down."]);
  assert.deepEqual(e.sheet.find((x) => x.key === "notes").lines, ["None."]);
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
test("gap #14 invariance: with estate.worksheet absent or present, every other page that reads the estate gives byte-identical output", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const mods = await Promise.all(REGISTRY.map(async (e) => (await e.load()).default));
  const readers = mods.filter((m) => (m.needs ?? []).includes("estate") && !(m.group === "estate" && m.id === "will-worksheet") && !m.placeholder);
  assert.ok(readers.length >= 10, readers.map((m) => `${m.group}/${m.id}`).join(", "));
  const fixtures = [familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const plans = [...fixtures, ...ARCHETYPES.map((a) => a.build())];
  for (const plan of plans) {
    const a = migrate(structuredClone(plan));
    const b = structuredClone(a);
    // the worksheet's own fields only (the guardian and the pets are other pages' boxes, written since before this page)
    saveWorksheet(b, { executor: "Dee", executorBackup: "Lou", guardianBackup: "Kay", childrenAge: 25, poaMoney: "Dee", poaHealth: "Dee", notes: "A cabin", specific: [{ what: "The piano", to: "Kay" }], rest: [{ name: "Bo", share: 0.5 }, { name: "Cy", share: 0.5 }] }, T);
    assert.ok(b.estate.worksheet);
    // and this page, with the field absent, is the same for a plan with no estate section at all
    assert.equal(JSON.stringify(compute(a, { today: T })), JSON.stringify(compute({ ...a, estate: { ...a.estate, worksheet: undefined } }, { today: T })));
    for (const m of readers.filter((x) => !x.heavy || fixtures.includes(plan))) {
      let x, y;
      // Diagnostics measures the plan file's size: a longer plan is a bigger file, and that is all it may say
      const out = (q) => { const r = m.compute(q, { today: T }); if (m.id === "diagnostics" && r?.size) delete r.size; return JSON.stringify(r); };
      try { x = out(a); } catch (e) { x = `THROW ${e.message}`; }
      try { y = out(b); } catch (e) { y = `THROW ${e.message}`; }
      assert.equal(y, x, `${m.group}/${m.id}`);
    }
  }
});
