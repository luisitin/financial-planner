// core/ui/checks.js: every sentence the form kit says at a box, and how it finds a row again (pure; plain records stand in for boxes)
// The last test (the plain-words guard over every quoted sentence) is from the forms2 design's tests/ui-words.test.mjs
// (wave 1 prototype, same repo, MIT), widened to core/ui/checks.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readNumber, numberText, boxWords, validityWords, summaryWords, keyText, sameRowIndex, keyHint, holdsSomething, FLOOR_DATE } from "../core/ui/checks.js";

test("numbers are read the way people type them; nonsense is null", () => {
  assert.equal(readNumber("1,200"), 1200);
  assert.equal(readNumber(" 300 "), 300);
  assert.equal(readNumber("2.555"), 2.555);
  assert.equal(readNumber("-2"), -2);
  assert.equal(readNumber("5%", { percent: true }), 5);
  assert.equal(readNumber("5%"), null);
  for (const bad of ["12..5", "abc", "72k", "$5", "", "  ", null]) assert.equal(readNumber(bad), null, String(bad));
  assert.equal(numberText("5,000"), "5000");
  assert.equal(numberText("7 %", { percent: true }), "7");
  assert.equal(numberText("12..5"), "12..5");
});
test("number and percent boxes: unreadable, whole, ranges with the unit, years without a comma", () => {
  assert.equal(boxWords({ kind: "number" }, "12..5"), "Type a number, like 12.");
  assert.equal(boxWords({ kind: "percent" }, "abc"), "Type a number, like 3.5 for 3.5%.");
  assert.equal(boxWords({ kind: "number", whole: true }, "2.5"), "Use a whole number, like 12.");
  assert.equal(boxWords({ kind: "number", whole: true }, "11,200"), "");
  assert.equal(boxWords({ kind: "percent", min: 0, max: 100 }, "150"), "Use a number from 0% to 100%.");
  assert.equal(boxWords({ kind: "percent", min: 0, max: 100 }, "2.555"), "");
  assert.equal(boxWords({ kind: "number", min: 2011, max: 2100 }, "1999"), "Use a number from 2011 to 2100.");
  assert.equal(boxWords({ kind: "number", min: 18 }, "5"), "Use 18 or more.");
  assert.equal(boxWords({ kind: "number", max: 50000 }, "60000"), "Use 50,000 or less.");
  assert.equal(boxWords({ kind: "number", min: 0, max: 5 }, ""), "", "an empty box says nothing until Save");
});
test("money boxes: the sign, the ceiling a page can lift", () => {
  assert.equal(boxWords({ kind: "money" }, "abc"), "Type an amount in numbers, like 4,500.");
  assert.equal(boxWords({ kind: "money", min: 0 }, "-50"), "Use $0 or more.");
  assert.equal(boxWords({ kind: "money", max: 10000 }, "12,000"), "Use $10,000 or less.");
  assert.equal(boxWords({ kind: "money" }, "99,999,999,999"), "That is more than a billion: check for an extra digit.");
  assert.equal(boxWords({ kind: "money", max: null }, "99,999,999,999"), "");
  assert.equal(boxWords({ kind: "money", sign: "€", min: 0 }, "-1"), "Use €0 or more.");
  assert.equal(boxWords({ kind: "money" }, "72k"), "");
});
test("what the browser holds back, in plain words", () => {
  const r = (x) => validityWords({ valid: false, ...x });
  assert.equal(r({ customError: true, message: "A symbol is letters, like ACME." }), "A symbol is letters, like ACME.", "a page's own words come first");
  assert.equal(r({ valueMissing: true, type: "text" }), "Fill this in first.");
  assert.equal(r({ valueMissing: true, type: "text", kind: "money" }), "Type an amount first.");
  assert.equal(r({ valueMissing: true, type: "text", missing: "Type the amount of the gift." }), "Type the amount of the gift.");
  assert.equal(r({ valueMissing: true, tag: "SELECT" }), "Choose one first.");
  assert.equal(r({ valueMissing: true, type: "date" }), "Pick a date first.");
  assert.equal(r({ valueMissing: true, type: "checkbox" }), "Check this box to go on.");
  assert.equal(r({ typeMismatch: true, type: "email" }), "Type an email address, like name@example.com.");
  assert.equal(r({ rangeUnderflow: true, type: "date", min: FLOOR_DATE }), "Check the year: type all four digits, like 2026.");
  assert.equal(r({ rangeOverflow: true, type: "date", max: "2026-11-11", today: "2026-11-11" }), "Pick a date that is not in the future.");
  assert.equal(r({ rangeOverflow: true, min: "0", max: "100", kind: "percent" }), "Use a number from 0% to 100%.");
  assert.equal(r({ stepMismatch: true, step: "1000", value: "1250" }), "Round it to the nearest 1000, like 1000.");
  assert.equal(r({ stepMismatch: true, step: "1", value: "2.5" }), "Use a whole number, like 12.");
  assert.equal(r({ patternMismatch: true, title: "Letters only." }), "Letters only.");
  assert.equal(validityWords({ valid: true }), "");
});
test("the count above the buttons names each box once, apart with semicolons", () => {
  assert.equal(summaryWords(["Amount"]), "");
  assert.equal(summaryWords(["What are you saving for", "Amount needed"]), "2 boxes need a fix: What are you saving for; Amount needed.");
  assert.equal(summaryWords(["Federal income tax on your pay stub, a paycheck", "Employer adds, a year"]), "2 boxes need a fix: Federal income tax on your pay stub, a paycheck; Employer adds, a year.");
  assert.equal(summaryWords(["a", "b", "c", "d", "e"]), "5 boxes need a fix: a; b; c; d; and more.");
});
test("a row is found again only where the list reads the same, row for row", () => {
  const before = ["Chase checking #", "Ally savings #", "Ana's #(k) #"].map(keyText);
  assert.equal(keyText("Store card $1,201"), keyText("Store card $1,202"));
  assert.notEqual(keyText("Ana's 401(k)"), keyText("Bo's 401(k)"));
  assert.equal(sameRowIndex(before, before.slice(), 1), 1, "drawn again as it was: the same place");
  assert.equal(sameRowIndex(before, [before[1], before[0], before[2]], 1), -1, "re-sorted: no guess");
  assert.equal(sameRowIndex(before, [keyText("Chase everyday #"), before[1], before[2]], 0), -1, "renamed: no guess");
  assert.equal(sameRowIndex(before, before.slice(0, 2), 1), -1, "a row gone: no guess");
  const twins = ["Coffee #", "Coffee #", "Rent #"];
  assert.equal(sameRowIndex(twins, twins.slice(), 1), 1, "twin rows: the same one by place, when nothing moved");
});
test("the keyboard key: next until the last control, then done", () => {
  assert.equal(keyHint(0, 3), "next");
  assert.equal(keyHint(2, 3), "done");
  assert.equal(keyHint(-1, 3), "done");
});

test("an optional box (more: true) opens its fold only when it holds something a person should see", () => {
  assert.equal(holdsSomething({ type: "text" }, ""), false);
  assert.equal(holdsSomething({ type: "text" }, "   "), false);
  assert.equal(holdsSomething({ type: "text" }, undefined), false);
  assert.equal(holdsSomething({ type: "money" }, null), false);
  assert.equal(holdsSomething({ type: "text" }, "Roof fund"), true);
  assert.equal(holdsSomething({ type: "money" }, 0), false, "pages store 0 for none: not worth opening the fold");
  assert.equal(holdsSomething({ type: "percent" }, "0"), false);
  assert.equal(holdsSomething({ type: "number" }, 12), true);
  assert.equal(holdsSomething({ type: "text" }, "0"), true, "typed words are words");
  assert.equal(holdsSomething({ type: "percent" }, 0.05), true);
  assert.equal(holdsSomething({ type: "checkbox" }, false), false);
  assert.equal(holdsSomething({ type: "checkbox" }, true), false, "a tick box always holds an answer: the page decides (moreOpen)");
  const who = { type: "select", options: [{ value: "", label: "Shared" }, { value: "p1", label: "Ana" }] };
  assert.equal(holdsSomething(who, ""), false, "the first choice is what an untouched list shows");
  assert.equal(holdsSomething(who, undefined), false);
  assert.equal(holdsSomething(who, "p1"), true);
  assert.equal(holdsSomething({ type: "select", options: ["low", "high"] }, "low"), false);
  assert.equal(holdsSomething({ type: "select", options: ["low", "high"] }, "high"), true);
});

// every quoted sentence (starts with a capital, ends with "." or ":") the kit can put on screen; a template's ${...} is
// code, not words, so it is read as "#"
const sentencesIn = (src) => [...src.matchAll(/(["`])([A-Z][^"`\n]{6,}?[.:])\1/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, "#")).filter((t) => /\s/.test(t));
const BUILDER_WORDS = /\b(PC|server|AI|sync|synced|build|browser|valid|validation|invalid|input|field|value|required|error)\b/i;
test("the kit's sentences have no builder or form-check words (the household's view)", () => {
  const said = ["../core/ui/checks.js", "../core/ui/dom.js"].flatMap((f) => sentencesIn(fs.readFileSync(new URL(f, import.meta.url), "utf8")));
  assert.ok(said.length >= 20, `found ${said.length} sentences`);
  for (const t of said) assert.doesNotMatch(t, BUILDER_WORDS, t);
  assert.match("Enter a valid value.", BUILDER_WORDS, "the guard itself catches a form-check sentence");
});
test("ui.form reads number and percent boxes the way people type them (the phone's path, in the stand-in document)", async () => {
  await import("../qa/fixtures/fake-dom.mjs");
  const ui = await import("../core/ui/dom.js");
  let got = null;
  const f = ui.form([{ key: "amount", label: "Amount", type: "number" }, { key: "raise", label: "Yearly raise", type: "percent", min: 0, max: 100 }, { key: "miles", label: "Miles a year", type: "number", step: 500 }],
    { raise: 0.03 }, (v) => { got = v; });
  const box = (k) => f.querySelector(`[name="${k}"]`);
  assert.equal(box("raise").value, "3", "a stored 0.03 shows as 3");
  assert.equal(box("raise").getAttribute("type"), "text", "a text box the kit reads, not the browser's number box");
  assert.equal(box("raise").getAttribute("inputmode"), "decimal", "the number pad");
  assert.ok(box("raise").closest(".unit-in"), "the % sits inside the box");
  assert.deepEqual([box("raise").getAttribute("min"), box("raise").getAttribute("max"), box("amount").getAttribute("max")], ["0", "100", null], "the range is written on the box for tools to read (the kit checks it, not the browser)");
  box("amount").value = "1,200"; box("raise").value = "2.555"; box("miles").value = "11,200";
  f.dispatch("submit");
  assert.deepEqual(got, { amount: 1200, raise: 0.02555, miles: 11200 });
});
test("ui.form folds the boxes marked more: true under one closed line above the buttons, and reads them all the same", async () => {
  await import("../qa/fixtures/fake-dom.mjs");
  const ui = await import("../core/ui/dom.js");
  const fields = [
    { key: "name", label: "What is it", type: "text", required: true },
    { key: "notes", label: "Notes", type: "textarea", more: true },
    { key: "amount", label: "Amount", type: "money", required: true },
    { key: "rate", label: "Growth per year", type: "percent", more: true },
    { key: "must", label: "Needed", type: "text", required: true, more: true },
  ];
  let got = null;
  const f = ui.form(fields, {}, (v) => { got = v; });
  const fold = f.querySelector(".form-more");
  assert.ok(fold, "one fold");
  assert.equal(f.querySelectorAll(".form-more").length, 1);
  assert.equal(fold.tagName, "DETAILS");
  assert.equal(fold.hasAttribute("open"), false, "closed while its boxes are empty: less on the screen");
  assert.equal(fold.querySelector(".fold-title").textContent, "More details (optional)");
  const inFold = (k) => !!f.querySelector(`[name="${k}"]`).closest(".form-more");
  assert.deepEqual(["name", "notes", "amount", "rate", "must"].map(inFold), [false, true, false, true, false], "a box that must be filled in is never folded away");
  const kids = f.children.map((c) => c.className);
  assert.equal(kids.indexOf("fold form-more"), kids.indexOf("form-actions") - 1, "the fold sits right above the buttons");
  f.querySelector('[name="name"]').value = "Roof"; f.querySelector('[name="amount"]').value = "4,500"; f.querySelector('[name="rate"]').value = "5"; f.querySelector('[name="must"]').value = "x";
  f.dispatch("submit");
  assert.deepEqual(got, { name: "Roof", notes: "", amount: 4500, rate: 0.05, must: "x" }, "a folded box is read like any other");
  // a record that already uses one of them: open, so nothing saved is hidden
  assert.equal(ui.form(fields, { rate: 0.05 }, () => { }).querySelector(".form-more").hasAttribute("open"), true);
  // the page can say so itself, and name the line
  const named = ui.form(fields, {}, () => { }, { moreOpen: true, moreLabel: "More about this goal (optional)" });
  assert.equal(named.querySelector(".form-more").hasAttribute("open"), true);
  assert.equal(named.querySelector(".fold-title").textContent, "More about this goal (optional)");
  assert.equal(ui.form(fields, { rate: 0.05 }, () => { }, { moreOpen: false }).querySelector(".form-more").hasAttribute("open"), false);
  // someone who wants every box on screen (a device setting the shell passes on): open from the start; the page's own word still wins
  ui.setMoreOpen(true);
  assert.equal(ui.form(fields, {}, () => { }).querySelector(".form-more").hasAttribute("open"), true);
  assert.equal(ui.form(fields, {}, () => { }, { moreOpen: false }).querySelector(".form-more").hasAttribute("open"), false);
  ui.setMoreOpen(false);
  assert.equal(ui.form(fields, {}, () => { }).querySelector(".form-more").hasAttribute("open"), false);
  // no box marked: no fold, the form as before
  assert.equal(ui.form(fields.map(({ more, ...fd }) => fd), {}, () => { }).querySelector(".form-more"), null);
});
