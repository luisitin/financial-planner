// tests/ui-form-guess.test.mjs -- our guesses in the form kit (smart guesses C6, spec 9.2, 9.3, 14.5; docs/CONVENTIONS.md
// "Guesses"): a blank box that shows our grey guess reads null and is marked in meta.guessed; a typed figure is the
// person's, even when it equals ours; a percent box with no guess shows no grey text; the help line, the spoken label and
// the page's one muted note in their exact words. The pure reading (readValues) needs no page; the drawn form uses the
// stand-in DOM. Every household and figure here is invented.
import { test } from "node:test";
import assert from "node:assert/strict";
import "../qa/fixtures/fake-dom.mjs";
import { FakeElement } from "../qa/fixtures/fake-dom.mjs";

const ui = await import("../core/ui/dom.js");
const { readValues, pctValue, guessLine, guessText, guessWords, guessLabel, clearedWords, guessNoteWords, guessNote, setGuess, pctBox } = ui;

const RATE = { key: "debt.credit.rate", value: 0.218, unit: "rate", why: "the average rate on cards that charge interest", dataAsOf: "2026-11-01" };
const PAY = { key: "debt.credit.payment", value: 120, unit: "month", why: "the month's interest plus 1% of what you owe, a usual minimum", dataAsOf: "2026-11-01" };
const FIELDS = [
  { key: "rate", label: "Interest rate a year", type: "percent", required: true, min: 0, max: 100, help: "on the statement" },
  { key: "minPayment", label: "Payment a month", type: "money", required: true, min: 0 },
  { key: "extra", label: "Extra you pay a month", type: "money", min: 0 },
  { key: "note", label: "Note", type: "text" },
  { key: "done", label: "Paid off", type: "checkbox" },
];
const all = (el) => (el instanceof FakeElement ? el.all() : []);
const boxOf = (f, name) => all(f).find((e) => e.tagName === "INPUT" && e.getAttribute("name") === name);
const helpOf = (f, name) => boxOf(f, name)?.closest("label")?.all().find((e) => e.tagName === "SMALL")?.textContent ?? null;
/** Draw a form, type into it, submit it; -> { values, meta } as the page's callback got them. */
function submit(fields, start, typed = {}, change = null) {
  let got = null;
  const f = ui.form(fields, start, (values, meta) => { got = { values, meta }; });
  change?.(f);
  for (const [k, v] of Object.entries(typed)) boxOf(f, k).value = v;
  f.dispatch("submit");
  return { f, ...got };
}

test("14.5: a blank box that shows our guess reads null and is marked guessed", () => {
  const r = readValues(FIELDS, { rate: "", minPayment: " ", extra: "", note: "", done: false }, { rate: RATE, minPayment: PAY });
  assert.equal(r.values.rate, null);
  assert.equal(r.values.minPayment, null);
  assert.ok(r.meta.guessed.has("rate"));
  assert.ok(r.meta.guessed.has("minPayment"));
  assert.equal(r.meta.guessed.has("extra"), false, "a blank box with no guess is not ours: it saves nothing, as before");
  assert.deepEqual(Object.keys(r.meta.guess).sort(), ["minPayment", "rate"]);
  assert.equal(r.meta.guess.rate, RATE);
});

test("14.5: a figure typed equal to our guess is typed, not guessed", () => {
  const r = readValues(FIELDS, { rate: "21.8", minPayment: "120" }, { rate: RATE, minPayment: PAY });
  assert.equal(r.values.rate, 0.218);
  assert.equal(r.values.minPayment, 120);
  assert.equal(r.meta.guessed.size, 0);
  // typed over ours with another figure: the person's too
  const s = readValues(FIELDS, { rate: "19.9%", minPayment: "$95" }, { rate: RATE, minPayment: PAY });
  assert.deepEqual([s.values.rate, s.values.minPayment, s.meta.guessed.size], [0.199, 95, 0]);
});

test("14.5: pctValue reads a percent box as a fraction", () => {
  assert.equal(pctValue("6%"), 0.06);
  assert.equal(pctValue("6"), 0.06);
  assert.equal(pctValue(" 2.555 "), 0.02555);
  assert.equal(pctValue(""), null);
  assert.equal(pctValue("six"), null);
  assert.equal(pctValue(null), null);
  const { input } = pctBox({ name: "share" });
  input.value = "7.5";
  assert.equal(pctValue(input), 0.075);
});

test("14.5: a percent box with no guess shows no grey text (the old \"e.g. 7\" is gone)", () => {
  const f = ui.form([{ key: "growth", label: "Grows a year", type: "percent" }], {}, () => {});
  const box = boxOf(f, "growth");
  assert.equal(box.getAttribute("placeholder"), null);
  assert.equal(box.closest(".unit-in") !== null || box.parentNode?.className === "unit-in", true, "the % sign sits inside the box");
  const { input } = pctBox({ name: "x" });
  assert.equal(input.getAttribute("placeholder"), null);
});

test("readValues reads every kind of box as the kit always has (no guess: the same values, nothing marked)", () => {
  // the reading before C6, written out: money to the cent, number, percent / 100, a tick box, text as typed
  const raw = { rate: "7", minPayment: "1,234.567", extra: "", note: " hi ", done: true };
  const old = { rate: 0.07, minPayment: 1234.57, extra: null, note: " hi ", done: true };
  const r = readValues(FIELDS, raw, {});
  assert.deepEqual(r.values, old);
  assert.equal(r.meta.guessed.size, 0);
  assert.deepEqual(r.meta.guess, {});
  // a guess with no figure (one still waiting on a tap) is no guess
  const w = readValues(FIELDS, { rate: "" }, { rate: { key: "x", value: null, ask: {} } });
  assert.equal(w.meta.guessed.size, 0);
  // a guess on a text box is ignored: we guess amounts only
  const t = readValues(FIELDS, { note: "" }, { note: RATE });
  assert.equal(t.meta.guessed.size, 0);
});

test("invariance: a form with no guess draws and submits exactly as before", () => {
  const start = { rate: 0.05, minPayment: 300, note: "card", done: false };
  const a = submit(FIELDS, start);
  assert.deepEqual(a.values, { rate: 0.05, minPayment: 300, extra: null, note: "card", done: false });
  assert.equal(a.meta.guessed.size, 0);
  // required boxes stay required, with their own help and no spoken extra
  assert.equal(boxOf(a.f, "rate").hasAttribute("required"), true);
  assert.equal(boxOf(a.f, "rate").getAttribute("aria-label"), null);
  assert.equal(helpOf(a.f, "rate"), "on the statement");
  assert.equal(boxOf(a.f, "rate").dataset.guess, undefined);
  // fields with guess: null are fields with no guess
  const b = submit(FIELDS.map((fd) => ({ ...fd, guess: null })), start);
  assert.deepEqual(b.values, a.values);
  assert.equal(boxOf(b.f, "minPayment").hasAttribute("required"), true);
});

test("9.3: a box with our guess: grey figure, not required, the guess line first, spoken, marked, never folded", () => {
  const fields = [{ ...FIELDS[0], guess: RATE }, { ...FIELDS[1], guess: PAY, zeroOk: true }, { key: "x", label: "Other", type: "money", more: true, guess: PAY }];
  const f = ui.form(fields, { rate: null, minPayment: null }, () => {});
  const rate = boxOf(f, "rate"), pay = boxOf(f, "minPayment");
  assert.equal(rate.getAttribute("placeholder"), "21.8");
  assert.equal(pay.getAttribute("placeholder"), "120");
  assert.equal(rate.hasAttribute("required"), false);
  assert.equal(pay.hasAttribute("required"), false);
  assert.equal(helpOf(f, "rate"), "Our guess: the average rate on cards that charge interest. On the statement");
  assert.equal(helpOf(f, "minPayment"), "Our guess: the month's interest plus 1% of what you owe, a usual minimum. Type 0 if you have none.");
  assert.equal(rate.getAttribute("aria-label"), "Interest rate a year, blank uses our guess of about 21.8%");
  assert.equal(pay.getAttribute("aria-label"), "Payment a month, blank uses our guess of about $120");
  assert.equal(rate.dataset.guess, "");
  // a box with our guess is never put under "More details (optional)"
  assert.equal(all(f).some((e) => e.tagName === "DETAILS"), false);
  assert.ok(boxOf(f, "x"));
});

test("9.2: submitted blank, the guess is marked; typed, it is the person's", () => {
  const fields = [{ ...FIELDS[0], guess: RATE }, { ...FIELDS[1], guess: PAY }, FIELDS[2]];
  const blank = submit(fields, { rate: null, minPayment: null });
  assert.deepEqual(blank.values, { rate: null, minPayment: null, extra: null });
  assert.deepEqual([...blank.meta.guessed].sort(), ["minPayment", "rate"]);
  const typed = submit(fields, { rate: null, minPayment: null }, { rate: "21.8", minPayment: "140" });
  assert.deepEqual(typed.values, { rate: 0.218, minPayment: 140, extra: null });
  assert.equal(typed.meta.guessed.size, 0);
  // a figure on file in the box (a typed one the page passes) is read as typed
  const kept = submit(fields, { rate: 0.199, minPayment: 95 });
  assert.deepEqual([kept.values.rate, kept.values.minPayment, kept.meta.guessed.size], [0.199, 95, 0]);
});

test("setGuess: the payment's guess follows a rate typed above it; null makes the box required again", () => {
  const fields = [{ ...FIELDS[0], guess: RATE }, { ...FIELDS[1], guess: PAY }];
  const moved = { ...PAY, value: 110, why: "the month's interest plus 1% of what you owe, a usual minimum" };
  const r = submit(fields, { rate: null, minPayment: null }, { rate: "12" }, (f) => {
    assert.equal(setGuess(f, "minPayment", moved), true);
    assert.equal(boxOf(f, "minPayment").getAttribute("placeholder"), "110");
    assert.equal(boxOf(f, "minPayment").getAttribute("aria-label"), "Payment a month, blank uses our guess of about $110");
  });
  assert.equal(r.meta.guess.minPayment.value, 110);
  assert.ok(r.meta.guessed.has("minPayment"));
  assert.equal(r.meta.guessed.has("rate"), false);
  const gone = submit(fields, { rate: null, minPayment: null }, {}, (f) => {
    setGuess(f, "minPayment", null);
    const box = boxOf(f, "minPayment");
    assert.equal(box.getAttribute("placeholder"), null);
    assert.equal(box.hasAttribute("required"), true);
    assert.equal(box.getAttribute("aria-label"), null);
    assert.equal(box.dataset.guess, undefined);
    assert.equal(helpOf(f, "minPayment"), "", "no guess and no help of its own: the line is empty and hidden");
    assert.equal(box.closest("label").all().find((e) => e.tagName === "SMALL").hidden, true);
    assert.equal(setGuess(f, "nope", PAY), false);
    // and back: a box with no help of its own gets the guess line
    setGuess(f, "minPayment", PAY);
    assert.equal(helpOf(f, "minPayment"), "Our guess: the month's interest plus 1% of what you owe, a usual minimum.");
  });
  assert.ok(gone.meta.guessed.has("minPayment"));
});

test("the words: the guess line, the grey figure, the spoken label, the cleared notice", () => {
  assert.equal(guessLine(RATE), "Our guess: the average rate on cards that charge interest.");
  assert.equal(guessLine({ value: 2016, why: "Most owners your age bought in the last few years." }), "Our guess: Most owners your age bought in the last few years.");
  assert.equal(guessLine({ value: 0, why: "about half of people your age don't put money in yet" }, { zeroOk: true }), "Our guess: about half of people your age don't put money in yet. Type 0 if you have none.");
  assert.equal(guessLine({ value: 5 }), "Our guess for now.");
  assert.equal(guessLine(null), "");
  assert.equal(guessText({ value: 1200 }, "money"), "1,200");
  assert.equal(guessText({ value: 0.046 }, "percent"), "4.6");
  assert.equal(guessText({ value: 0.2179999 }, "percent"), "21.8");
  assert.equal(guessText({ value: 2016 }, "number"), "2016");
  assert.equal(guessText({ value: null }, "money"), "");
  assert.equal(guessWords({ value: 1200 }), "$1,200");
  assert.equal(guessWords({ value: 0.046 }, "percent"), "4.6%");
  assert.equal(guessLabel("Current balance", { value: 2700 }), "Current balance, blank uses our guess of about $2,700");
  assert.equal(clearedWords({ value: 1200 }), "Cleared: we'll use our guess, about $1,200, until you type yours.");
});

test("C6 review round 2 F3: a percent guess shows the figure saved, to its last digit (never another figure than the one counted)", async () => {
  const ui = await import("../core/ui/dom.js");
  const g = (value) => ({ key: "k", value, unit: "rate", why: "w", dataAsOf: "2026-01-01" });
  assert.equal(ui.guessText(g(0.224), "percent"), "22.4");
  assert.equal(ui.guessText(g(0.046), "percent"), "4.6");
  assert.equal(ui.guessText(g(0.0005), "percent"), "0.05", "not 0.1 (it was toFixed(1))");
  assert.equal(ui.guessText(g(0.0717), "percent"), "7.17", "an older plan's rate, not 7.2");
  // what the grey text says, typed in, is the figure the blank box saves
  for (const v of [0.224, 0.046, 0.0005, 0.0717, 0.2236, 0.07125]) assert.equal(ui.pctValue(ui.guessText(g(v), "percent")), v, String(v));
  assert.equal(ui.guessText(g(0.21799999), "percent"), "21.8", "float dust is not a figure");
  assert.equal(ui.guessWords(g(0.0717), "percent"), "7.17%");
});

test("9.5: the page's one muted note names the two biggest guesses, then how many more", () => {
  assert.equal(guessNoteWords([]), "");
  assert.equal(guessNoteWords(null), "");
  assert.equal(guessNoteWords(["your spending"]), "Some of this uses our guesses: your spending.");
  assert.equal(guessNoteWords(["your spending", "your 401(k)"]), "Some of this uses our guesses: your spending and your 401(k).");
  assert.equal(guessNoteWords(["your spending", "your 401(k)", "the mortgage rate", "your spending", "the car loan"]), "Some of this uses our guesses: your spending and your 401(k), and 2 more.");
  assert.equal(guessNote([]), null);
  const n = guessNote(["your spending"]);
  assert.equal(n.tagName, "UL");
  assert.equal(n.className, "page-list");
  const a = n.all().find((e) => e.tagName === "A");
  assert.equal(a.className, "muted");
  assert.equal(a.getAttribute("href"), "#/overview/guesses");
  assert.equal(a.textContent, "Some of this uses our guesses: your spending. ›");
  assert.equal(guessNote(["x"], { href: "#/balance/net-worth" }).all().find((e) => e.tagName === "A").getAttribute("href"), "#/balance/net-worth");
});
