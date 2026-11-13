// modules/debt/credit-score/module.test.mjs -- "Your credit score" (gap design #18): the bands on each scale and their
// edges, one sentence per case, the one lever (Credit cards' own figure), the history newest first, a score typed again
// for the same day replacing the old one, the freeze ticks per person and bureau, the first view and its parts, the green
// line after a save naming the new answer, and the invariance rule (with `credit` absent or present, no other page's
// compute changes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, band, longDate, headlineOf, sentenceOf, staleSentence, leverOf, leverSentence, safeStatus, emptySentence, cardsLine,
  saveScore, removeScore, setFreeze, setAlert, BANDS, BUREAUS } from "./compute.js";
import { compute as cardsCompute } from "../credit-cards/compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";

// ---------------------------------------------------------------- the page on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
let VIEW = null;
/** Draw the page: { root, first (the words outside the parts, phone markup), text, saved, parts: [{ id, kind, title, status, open, text }] }. */
async function draw(plan, { route = { rest: [], query: {} }, today = T, fieldError = null } = {}) {
  VIEW ??= await import("./view.js");
  const p = migrate(structuredClone(plan));
  const saved = [];
  const root = new FakeElement("main");
  const ctx = { ui: fieldError ? { ...ui, fieldError } : ui, fmt: { ...fmt, today: () => today }, plan: p, route, module: { group: "debt", id: "credit-score" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    computeOf: (key, params = {}) => (key === "debt/credit-cards" ? cardsCompute(p, { today, ...params }) : null), redraw: () => {} };
  VIEW.render(root, ctx);
  await new Promise((r) => setTimeout(r, 0));
  const details = root.querySelectorAll("details");
  const outside = (n) => (n.tagName === "STYLE" ? "" : n.tagName === "DETAILS" ? (n.childNodes[0] ? textOf(n.childNodes[0]) : "") : n.hidden || n.matches?.(".only-wide") ? "" : n.childNodes ? n.childNodes.map((c) => (c instanceof FakeElement ? outside(c) : c.data)).join(" ") : "");
  return { root, ctx, saved, text: textOf(root), first: outside(root).replace(/\s+/g, " ").trim(),
    parts: details.filter((x) => x.dataset.part).map((x) => ({ id: x.dataset.part, kind: x.dataset.kind, title: x.querySelector(".fold-title")?.textContent, status: x.querySelector(".fold-status")?.textContent ?? "", open: x.hasAttribute("open"), text: textOf(x) })) };
}
const T = "2026-11-13";
const BAND_WORDS = /\b(poor|fair|good|very good|exceptional|subprime|near prime|prime|superprime)\b/i;
/** The family (Ana and Bo, one Visa card at $6,400 of a $15,000 limit) with scores typed. */
function scored(...scores) {
  const p = familyPlan(T);
  p.credit = { scores: scores.map((s, i) => ({ id: `s-${i}`, personId: "p-ana", model: "fico", ...s })) };
  return p;
}

// ---------------------------------------------------------------- the bands (myFICO; VantageScore)
test("gap #18, test 1: FICO's bands at their edges: 579 poor, 580 fair, 669 fair, 670 good, 739 good, 740 very good, 799 very good, 800 exceptional", () => {
  const at = (n) => band(n, "fico")?.label;
  assert.deepEqual([579, 580, 669, 670, 739, 740, 799, 800].map(at), ["poor", "fair", "fair", "good", "good", "very good", "very good", "exceptional"]);
  assert.equal(at(300), "poor"); assert.equal(at(850), "exceptional");
  assert.deepEqual([band(712, "fico").lo, band(712, "fico").hi], [670, 739]);
  // outside the 300 to 850 scale, or not a whole score: no band
  for (const n of [299, 851, 0, null, undefined, "abc", 712.5]) assert.equal(band(n, "fico"), null, String(n));
  // VantageScore 4.0's tiers: 300-600 subprime, 601-660 near prime, 661-780 prime, 781-850 superprime
  const v = (n) => band(n, "vantage")?.label;
  assert.deepEqual([600, 601, 660, 661, 780, 781].map(v), ["subprime", "near prime", "near prime", "prime", "prime", "superprime"]);
  // every scale covers 300 to 850 with no gap and no overlap
  for (const [model, lines] of Object.entries(BANDS)) {
    assert.equal(lines[0].lo, 300, model); assert.equal(lines[lines.length - 1].hi, 850, model);
    for (let i = 1; i < lines.length; i++) assert.equal(lines[i].lo, lines[i - 1].hi + 1, model);
  }
});

test("gap #18, test 2: \"Not sure\" gives no band words, in the sentence and on the page", async () => {
  assert.equal(band(712, "unsure"), null);
  const p = scored({ date: "2026-11-02", score: 712, model: "unsure" });
  const d = compute(p, { today: T });
  const s = sentenceOf(d.shown[0], d);
  assert.equal(s, "Seen November 2, 2026. Your app names the kind of score (FICO or VantageScore): pick it with your next score to see what it means.");
  assert.ok(!BAND_WORDS.test(s), s);
  const { first } = await draw(p);
  assert.ok(!BAND_WORDS.test(first.replace(/FICO's scale|What the numbers mean/g, "")), first);
});

// ---------------------------------------------------------------- one sentence per case (R3, R5)
test("one sentence per case: FICO, VantageScore, Not sure, a score over a year old, two people, and the empty page", () => {
  assert.equal(longDate("2026-11-02"), "November 2, 2026"); assert.equal(longDate("2025-01-31"), "January 31, 2025"); assert.equal(longDate("x"), "");
  // FICO
  let d = compute(scored({ date: "2026-11-02", score: 712 }), { today: T });
  assert.equal(headlineOf(d), "Ana's score: 712");
  assert.equal(sentenceOf(d.shown[0], d), "Seen November 2, 2026: good on FICO's scale (670 to 739).");
  assert.equal(staleSentence(d.shown[0], d), null);
  // VantageScore: its own words, with what they mean
  d = compute(scored({ date: "2026-11-02", score: 712, model: "vantage" }), { today: T });
  assert.equal(sentenceOf(d.shown[0], d), "Seen November 2, 2026: VantageScore calls 661 to 780 prime, lower rates than near prime.");
  d = compute(scored({ date: "2026-11-02", score: 590, model: "vantage" }), { today: T });
  assert.equal(sentenceOf(d.shown[0], d), "Seen November 2, 2026: VantageScore calls 300 to 600 subprime, where a lender might say no.");
  // a score seen more than a year ago
  d = compute(scored({ date: "2025-10-01", score: 640 }), { today: T });
  assert.equal(sentenceOf(d.shown[0], d), "Seen October 1, 2025: fair on FICO's scale (580 to 669).");
  assert.equal(staleSentence(d.shown[0], d), "That was over a year ago: your bank or card app may show a newer one.");
  // two people: each one's newest, the first adult first, each sentence led by whose it is
  const p = scored({ date: "2026-11-02", score: 712 }, { date: "2026-10-01", score: 655, personId: "p-bo" }, { date: "2026-06-01", score: 690 });
  d = compute(p, { today: T });
  assert.equal(headlineOf(d), "Ana's score: 712 · Bo's: 655");
  assert.deepEqual(d.shown.map((e) => sentenceOf(e, d)), ["Ana's, seen November 2, 2026: good on FICO's scale (670 to 739).", "Bo's, seen October 1, 2026: fair on FICO's scale (580 to 669)."]);
  // the first adult Get started left unnamed ("Me") reads "your" and "yours"
  const q = scored({ date: "2026-11-02", score: 801 }); q.household.people[0].name = "Me";
  assert.equal(headlineOf(compute(q, { today: T })), "Your score: 801");
  const q2 = structuredClone(p); q2.household.people[0].name = "Me";
  const d2 = compute(q2, { today: T });
  assert.equal(headlineOf(d2), "Your score: 712 · Bo's: 655");
  assert.equal(sentenceOf(d2.shown[0], d2), "Yours, seen November 2, 2026: good on FICO's scale (670 to 739).");
  const r = scored({ date: "2026-11-02", score: 801 }); r.household.people.splice(1, 1);
  assert.equal(sentenceOf(compute(r, { today: T }).shown[0], compute(r, { today: T })), "Seen November 2, 2026: exceptional on FICO's scale (800 to 850).");
  // the empty page
  d = compute(familyPlan(T), { today: T });
  assert.equal(d.empty, true); assert.equal(headlineOf(d), "Your credit score");
  assert.equal(emptySentence(), "Type your score and the date you saw it. Your bank or card app often shows it for free.");
});

// ---------------------------------------------------------------- the one lever: Credit cards' figure
test("gap #18, test 3: the lever is Credit cards' own figure, in one sentence per case", () => {
  const fam = familyPlan(T);
  const cards = cardsCompute(fam, { today: T });
  const d = compute(scored({ date: "2026-11-02", score: 712 }), { today: T });
  assert.equal(d.lever.kind, "under30");
  assert.equal(d.lever.amount, cards.under.less30);
  assert.equal(d.lever.amount, 1900);   // $6,400 of a $15,000 limit: 6,400 - 0.3 x 15,000
  assert.equal(leverSentence(d.lever), "Paying $1,900 off your cards would bring the share of your limits in use under 30%.");
  // under 30% already: the 10% line, which is best for a score
  const low = familyPlan(T); low.accounts.find((a) => a.type === "credit").balance = 3000;
  const l = compute(low, { today: T }).lever;
  assert.deepEqual([l.kind, l.amount], ["under10", cardsCompute(low, { today: T }).under.less10]);
  assert.equal(leverSentence(l), "Paying $1,500 off your cards would bring the share of your limits in use under 10%, the best for a score.");
  // a part of a dollar is rounded up, so the share really gets under the line
  assert.equal(leverSentence({ kind: "under30", amount: 1899.2 }), "Paying $1,900 off your cards would bring the share of your limits in use under 30%.");
  // cards with no limit typed
  const nolim = familyPlan(T); for (const x of nolim.debts) delete x.creditLimit;
  assert.equal(compute(nolim, { today: T }).lever.kind, "limits");
  assert.equal(leverSentence({ kind: "limits" }), "Add your cards' credit limits on the Debts page: how much of them you use is one of the biggest parts of a score.");
  // no card, or under 10% already: paying on time
  assert.equal(compute(retiredCouplePlan(), { today: T }).lever.kind, "onTime");
  const tiny = familyPlan(T); tiny.accounts.find((a) => a.type === "credit").balance = 500;
  assert.equal(compute(tiny, { today: T }).lever.kind, "onTime");
  assert.equal(leverSentence({ kind: "onTime" }), "Paying every bill on time counts most: it is about a third of a FICO score.");
  assert.deepEqual(leverOf(null), { kind: "onTime" });
});

// critic g35 #1 (2026-11-13): Credit cards adds every card's balance but only the limits typed, so a card with no limit was
// measured against the other cards' limits ("Paying $7,850 ..." of a $9,800 balance and $6,500 of limits)
test("a card that carries a balance with no limit typed: the lever asks for that limit, and nothing is measured against the other cards' limits", async () => {
  const p = renterDebtPlan(T);
  delete p.debts.find((x) => x.id === "setup-debt-credit").creditLimit;   // the Visa card, $4,500 owed; Store and Mastercard keep $2,500 and $4,000
  p.credit = { scores: [{ id: "a", personId: "", date: "2026-11-12", score: 640, model: "vantage" }] };
  const d = compute(p, { today: T });
  assert.deepEqual(d.lever, { kind: "limits", missing: ["Visa card"] });
  assert.equal(d.cardTotals, null);
  assert.equal(leverSentence(d.lever), "Add the credit limit of the Visa card on the Debts page: without it, the share of your limits in use cannot be worked out.");
  assert.equal(cardsLine(d), "The Visa card has no credit limit on file, so the share of your limits in use is not worked out.");
  // two and more cards; a name that does not end in "card"; a card with no name
  assert.equal(leverSentence({ kind: "limits", missing: ["Visa card", "Mastercard"] }), "Add the credit limits of the Visa card and the Mastercard on the Debts page: without them, the share of your limits in use cannot be worked out.");
  assert.equal(leverSentence({ kind: "limits", missing: ["Gold", "Card A", ""] }), "Add the credit limits of 3 of your cards on the Debts page: without them, the share of your limits in use cannot be worked out.");
  assert.equal(leverSentence({ kind: "limits", missing: ["Gold"] }), "Add the credit limit of the Gold card on the Debts page: without it, the share of your limits in use cannot be worked out.");
  assert.equal(leverSentence({ kind: "limits", missing: ["Card A"] }), "Add the credit limit of Card A on the Debts page: without it, the share of your limits in use cannot be worked out.");
  assert.equal(leverSentence({ kind: "limits", missing: [""] }), "Add the credit limit of one of your cards on the Debts page: without it, the share of your limits in use cannot be worked out.");
  assert.equal(cardsLine({ lever: { kind: "limits", missing: ["Visa card", "Mastercard"] }, cardTotals: null }), "The Visa card and the Mastercard have no credit limit on file, so the share of your limits in use is not worked out.");
  // on the page: no amount on the first view, and How this is worked out says what is missing
  const { first, parts } = await draw(p);
  assert.match(first, /Add the credit limit of the Visa card on the Debts page: without it, the share of your limits in use cannot be worked out\./);
  assert.ok(!/7,850|9,800|6,500/.test(first), first);
  const how = parts.find((x) => x.id === "how").text;
  assert.match(how, /The Visa card has no credit limit on file, so the share of your limits in use is not worked out\./);
  assert.ok(!/9,800|6,500/.test(how), "no balance measured against limits that leave a card out");
  // a card with nothing owed and no limit does not hold the lever back: the figure stays true (its limit could only lower the share)
  const z = renterDebtPlan(T);
  z.accounts.find((a) => a.id === "setup-owe-credit").balance = 0; delete z.debts.find((x) => x.id === "setup-debt-credit").creditLimit;
  const dz = compute(z, { today: T });
  assert.deepEqual([dz.lever.kind, dz.lever.amount], ["under30", 3350]);   // $5,300 owed of $6,500 in limits: 5,300 - 0.3 x 6,500
  assert.equal(dz.lever.amount, cardsCompute(z, { today: T }).under.less30);
  assert.equal(cardsLine(dz), "Your cards: $5,300 owed of $6,500 in limits, 82% in use. 30% of $6,500 is $1,950, so $3,350 less gets you there.");
  // no card has a limit: the sentence and the line as before
  const nolim = renterDebtPlan(T); for (const x of nolim.debts) delete x.creditLimit;
  const dn = compute(nolim, { today: T });
  assert.deepEqual(dn.lever, { kind: "limits" });
  assert.equal(cardsLine(dn), "No card with a credit limit on file, so the share of your limits in use is not worked out.");
  // the family (every card has its limit): the line with its figures
  assert.equal(cardsLine(compute(scored({ date: "2026-11-02", score: 712 }), { today: T })), "Your cards: $6,400 owed of $15,000 in limits, 43% in use. 30% of $15,000 is $4,500, so $1,900 less gets you there.");
});

// ---------------------------------------------------------------- the history, saving and removing
test("the history: newest first per person; a score typed again for the same person and day replaces it; remove; nothing left removes the section", () => {
  const p = scored({ date: "2026-03-01", score: 650 }, { date: "2026-11-02", score: 712 }, { date: "2026-07-01", score: 690 }, { date: "2026-07-01", score: 700, personId: "p-bo" });
  const d = compute(p, { today: T });
  assert.deepEqual(d.people.find((x) => x.id === "p-ana").scores.map((s) => s.score), [712, 690, 650]);
  assert.deepEqual(d.shown.map((s) => s.score), [712, 700]);
  assert.deepEqual(d.more.map((s) => s.score), [690, 650], "the older scores, newest first");
  // the same person and day again: replaced, not added
  const q = structuredClone(p);
  assert.equal(saveScore(q, { id: "new", personId: "p-ana", date: "2026-11-02", score: 715, model: "fico" }), "replaced");
  assert.equal(q.credit.scores.length, 4); assert.equal(q.credit.scores.find((s) => s.date === "2026-11-02").score, 715);
  assert.equal(saveScore(q, { id: "new2", personId: "p-ana", date: "2026-11-10", score: 720, model: "vantage" }), "added");
  assert.equal(q.credit.scores.length, 5);
  // a score saved holds no figure beyond the score (the design: never from a bureau, nothing more)
  assert.deepEqual(Object.keys(q.credit.scores.find((s) => s.id === "new2")).sort(), ["date", "id", "model", "personId", "score"]);
  // a score outside 300 to 850 or a day that is not a date is never saved
  assert.equal(saveScore(q, { id: "bad", personId: "p-ana", date: "2026-11-10", score: 900, model: "fico" }), null);
  assert.equal(saveScore(q, { id: "bad", personId: "p-ana", date: "soon", score: 700, model: "fico" }), null);
  assert.equal(saveScore(q, { id: "bad", personId: "p-ana", date: "2026-11-10", score: 700, model: "bureau" }), null);
  // remove: the last one gone takes the whole section with it (a plan with nothing typed is as before)
  const r = familyPlan(T);
  saveScore(r, { id: "one", personId: "p-ana", date: "2026-11-02", score: 712, model: "fico" });
  removeScore(r, "one");
  assert.equal("credit" in r, false);
  // a score whose person is gone is read as the first adult's when there is only one
  const s = scored({ date: "2026-11-02", score: 712, personId: "gone" }); s.household.people = [s.household.people[0]];
  assert.deepEqual(compute(s, { today: T }).shown.map((e) => e.personId), ["gone"]);
  assert.equal(headlineOf(compute(s, { today: T })), "Ana's score: 712");
});

test("gap #18, test 4: freeze ticks are saved per person and bureau; the fraud alert's last day per person", () => {
  const p = familyPlan(T);
  setFreeze(p, "p-ana", "experian", true);
  setFreeze(p, "p-bo", "equifax", true);
  assert.deepEqual(p.credit.freeze, { "p-ana": { experian: true }, "p-bo": { equifax: true } });
  let d = compute(p, { today: T });
  assert.equal(d.frozen, 2); assert.equal(d.bureaus, 6);
  assert.equal(safeStatus(d), "partly frozen");
  setFreeze(p, "p-ana", "equifax", true); setFreeze(p, "p-ana", "transunion", true);
  assert.equal(compute(p, { today: T }).freeze["p-ana"].transunion, true);
  // a tick taken off removes it; nothing ticked removes the person, then the section
  setFreeze(p, "p-bo", "equifax", false);
  assert.deepEqual(p.credit.freeze, { "p-ana": { experian: true, equifax: true, transunion: true } });
  assert.throws(() => setFreeze(p, "p-ana", "bank", true));
  // the fraud alert: until a day, then ended
  setAlert(p, "p-ana", "2027-11-13");
  d = compute(p, { today: T });
  assert.deepEqual(d.alerts["p-ana"], { until: "2027-11-13", active: true });
  assert.equal(compute(p, { today: "2027-11-14" }).alerts["p-ana"].active, false);
  setAlert(p, "p-ana", "");
  assert.equal(p.credit.alertUntil, undefined);
  for (const b of BUREAUS) setFreeze(p, "p-ana", b.key, false);
  assert.equal("credit" in p, false);
  // statuses fit beside the title at 320 px (20 characters)
  const one = familyPlan(T); one.household.people = [one.household.people[0]];
  assert.equal(safeStatus(compute(one, { today: T })), "none frozen yet");
  for (const b of BUREAUS) setFreeze(one, "p-ana", b.key, true);
  assert.equal(safeStatus(compute(one, { today: T })), "frozen at all 3");
});

// critic g35 #2 (2026-11-13): "frozen at 3 of 6" for a couple; nobody can tell what the 6 counts (2 adults x 3 bureaus)
test("Keep your credit safe says how many people are frozen at all three bureaus, never a count of six", () => {
  const p = familyPlan(T);
  const st = () => safeStatus(compute(p, { today: T }));
  const seen = [st()];
  for (const b of BUREAUS) setFreeze(p, "p-ana", b.key, true);
  seen.push(st());
  assert.equal(st(), "1 of 2 people frozen");
  setFreeze(p, "p-bo", "equifax", true);
  seen.push(st());
  assert.equal(st(), "1 of 2 people frozen", "Bo at one bureau is not frozen yet: a freeze works at all three");
  for (const b of BUREAUS) setFreeze(p, "p-bo", b.key, true);
  seen.push(st());
  assert.equal(st(), "both frozen at all 3");
  for (const b of BUREAUS) setFreeze(p, "p-ana", b.key, false);
  for (const b of BUREAUS) setFreeze(p, "p-bo", b.key, false);
  setFreeze(p, "p-ana", "experian", true);
  seen.push(st());
  assert.equal(st(), "partly frozen");
  // three adults
  const three = familyPlan(T); three.household.people.push({ id: "p-cy", name: "Cy", role: "adult" });
  for (const a of ["p-ana", "p-bo", "p-cy"]) for (const b of BUREAUS) setFreeze(three, a, b.key, true);
  assert.equal(safeStatus(compute(three, { today: T })), "all 3 people frozen");
  seen.push(safeStatus(compute(three, { today: T })));
  for (const b of BUREAUS) setFreeze(three, "p-cy", b.key, false);
  assert.equal(safeStatus(compute(three, { today: T })), "2 of 3 people frozen");
  // one adult keeps the bureau count (three bureaus, listed in the part)
  const one = familyPlan(T); one.household.people = [one.household.people[0]];
  setFreeze(one, "p-ana", "experian", true); setFreeze(one, "p-ana", "equifax", true);
  assert.equal(safeStatus(compute(one, { today: T })), "frozen at 2 of 3");
  for (const s of seen) { assert.ok(s.length <= 20, s); assert.ok(!/ of 6\b/.test(s), s); }
});

test("an empty plan, no people, odd values in the section: no crash, nothing shown that was not typed", () => {
  const e = compute(emptyPlan(), { today: T });
  assert.equal(e.empty, true); assert.equal(e.people.length, 1); assert.equal(e.people[0].id, "");
  assert.equal(e.bureaus, 3);
  const p = emptyPlan(); p.credit = { scores: [null, { id: "x", date: "2026-01-01", score: "abc" }, { id: "y", personId: "", date: "2026-01-02", score: 650, model: "odd" }], freeze: "no", alertUntil: [] };
  const d = compute(p, { today: T });
  assert.deepEqual(d.shown.map((s) => [s.score, s.model]), [[650, "unsure"]]);
  assert.equal(d.frozen, 0);
});

const words = (s) => s.split(/\s+/).filter(Boolean).length;
// a filled button a person sees before a tap (a part's own form's Save waits inside the shut part)
const shutAround = (e) => { for (let x = e.parentNode; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) return true; return false; };
const filled = (root) => root.querySelectorAll("button").filter((b) => b.getAttribute("type") !== "button" || !/secondary|chip/.test(b.className)).filter((b) => !/secondary|chip|notice-action/.test(b.className)).concat(root.querySelectorAll("a").filter((a) => /^btn$|^btn /.test(a.className) && !/secondary/.test(a.className))).filter((b) => !shutAround(b));

test("gap #18, test 5: the empty page: one sentence, the form with its four boxes, one filled button, nothing made up", async () => {
  const { root, first, parts } = await draw(familyPlan(T));
  assert.match(first, /^Your credit score Type your score and the date you saw it\. Your bank or card app often shows it for free\./);
  const form = root.querySelector("form");
  assert.ok(form, "the form is open while there is no score");
  const boxes = form.all().filter((e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName));
  assert.deepEqual(boxes.map((b) => b.getAttribute("name")), ["score", "date", "personId", "model"], "score, date, whose, which kind");
  assert.ok(boxes.length <= 5);
  assert.equal(filled(root).length, 1, filled(root).map((b) => b.textContent).join(" | "));
  assert.ok(!/\$/.test(first), "no money figure before a score");
  assert.ok(words(first) <= 100, `${words(first)} words`);
  // the safe-keeping and the mistakes are there before a score too, shut; "More on this" waits for a score (one way to start)
  assert.ok(!root.querySelectorAll("a").some((x) => x.getAttribute("href") === "#/debt/ratios"));
  assert.deepEqual(parts.map((x) => [x.id, x.open]), [["safe", false], ["fix", false], ["how", false]]);
  // one adult: no "Whose" box
  const one = familyPlan(T); one.household.people = [one.household.people[0]];
  const o = await draw(one);
  assert.deepEqual(o.root.querySelector("form").all().filter((e) => ["INPUT", "SELECT"].includes(e.tagName)).map((b) => b.getAttribute("name")), ["score", "date", "model"]);
});

test("the first view with a score: the score and its sentence, the lever, + Add a newer score; the rest one tap away", async () => {
  const p = scored({ date: "2026-11-02", score: 712 }, { date: "2026-06-01", score: 690 }, { date: "2026-02-01", score: 662 }, { date: "2026-07-01", score: 640, personId: "p-bo", model: "vantage" });
  const { root, first, parts } = await draw(p);
  assert.match(first, /^Ana's score: 712 · Bo's: 640 Ana's, seen November 2, 2026: good on FICO's scale \(670 to 739\)\. Bo's, seen July 1, 2026: VantageScore calls 601 to 660 near prime, higher rates than prime\. Paying \$1,900 off your cards would bring the share of your limits in use under 30%\./);
  assert.ok(!root.querySelectorAll("form").some((f) => !shutAround(f)), "the add form waits behind + Add a newer score");
  const add = root.querySelectorAll("button").find((b) => b.textContent === "+ Add a newer score");
  assert.ok(add && /secondary/.test(add.className), "outlined");
  assert.equal(filled(root).length, 0, "no filled button on a page that has its answer");
  assert.ok(words(first) <= 160, `${words(first)} words`);
  // parts: "2 more scores" (the older ones, with the small line), the ticks and days (own), then the two reading parts, all shut
  assert.deepEqual(parts.map((x) => [x.id, x.kind, x.title, x.open]), [["scores", "more", "2 more scores", false], ["safe", "own", "Keep your credit safe", false], ["fix", "how", "Fix a mistake on your report", false], ["how", "how", "How this is worked out", false]]);
  for (const x of parts) assert.ok(x.status.length <= 20, x.status);
  const older = parts.find((x) => x.id === "scores").text;
  assert.match(older, /690/); assert.match(older, /662/); assert.ok(!/712/.test(older.replace(/from 662 in February 2026 to 712 in November 2026/, "")), "the newest is not among the older ones");
  assert.match(older, /Ana's scores from 662 in February 2026 to 712 in November 2026/, "the small line when there are three or more");
  // the freeze, the alerts and the free reports (FTC); the dispute timings (15 U.S.C. 1681i, 1681j)
  const safe = parts.find((x) => x.id === "safe").text;
  assert.match(safe, /free since September 21, 2018/); assert.match(safe, /lasts until you lift it/);
  assert.match(safe, /one year/); assert.match(safe, /seven years/); assert.match(safe, /AnnualCreditReport\.com/); assert.match(safe, /every week/);
  const fix = parts.find((x) => x.id === "fix").text;
  assert.match(fix, /30 days/); assert.match(fix, /45/); assert.match(fix, /5 business days/);
  const how = parts.find((x) => x.id === "how").text;
  for (const w of ["300 to 579", "580 to 669", "670 to 739", "740 to 799", "800 to 850", "35%", "30%", "$6,400", "$15,000"]) assert.ok(how.includes(w), w);
  // "More on this": what lenders see, and the cards
  const more = root.querySelectorAll("a").map((a) => a.getAttribute("href"));
  assert.ok(more.includes("#/debt/ratios") && more.includes("#/debt/credit-cards"), more.join(" "));
});

test("R7, R17: Save writes the score through store.update, and the green line names the new answer", async () => {
  const p = familyPlan(T);
  const a = await draw(p);
  const form = a.root.querySelector("form");
  const box = (n) => form.all().find((e) => e.getAttribute("name") === n);
  box("score").value = "712"; box("date").value = "2026-11-02"; box("personId").value = "p-bo"; box("model").value = "fico";
  form.dispatch("submit");
  assert.equal(a.saved.length, 1);
  const s = a.saved[0].credit.scores;
  assert.equal(s.length, 1); assert.deepEqual([s[0].personId, s[0].date, s[0].score, s[0].model], ["p-bo", "2026-11-02", 712, "fico"]);
  // the next draw (the shell's, after store.update) says what was saved and what it means
  const b = await draw(a.saved[0]);
  assert.match(b.first, /Saved\. Bo's score: 712, good on FICO's scale\./);
  // an older score than the one shown: said to be with the older scores
  const { savedSentence } = await import("./compute.js");
  const q = scored({ date: "2026-11-02", score: 712 }, { date: "2026-08-01", score: 698 });
  const dq = compute(q, { today: T });
  assert.equal(savedSentence(dq, dq.more[0]), "Saved: Ana's 698 from August 1, 2026 is with the older scores.");
  assert.equal(savedSentence(dq, dq.shown[0]), "Saved. Ana's score: 712, good on FICO's scale.");
  // a score held back at its box: nothing saved
  const c = await draw(familyPlan(T));
  const f2 = c.root.querySelector("form");
  f2.all().find((e) => e.getAttribute("name") === "score").value = "950";
  f2.all().find((e) => e.getAttribute("name") === "date").value = "2026-11-02";
  f2.dispatch("submit");
  assert.equal(c.saved.length, 0);
});

// critic g35 #3 (2026-11-13): 712.5 showed the form kit's "Use a whole number, like 12." (12 is not a score)
test("a score with a part after the point gets this page's words, not the form kit's 'like 12'", async () => {
  const said = [];
  const c = await draw(familyPlan(T), { fieldError: (box, text) => { said.push([box?.getAttribute("name"), text]); return false; } });
  const f = c.root.querySelector("form");
  const box = (n) => f.all().find((e) => e.getAttribute("name") === n);
  box("score").value = "712.5"; box("score").dispatch("input");
  assert.equal(box("score").validity, "", `the kit says nothing first: "${box("score").validity}"`);
  box("date").value = "2026-11-02";
  f.dispatch("submit");
  assert.deepEqual(said, [["score", "Type a whole score from 300 to 850."]]);
  assert.equal(c.saved.length, 0);
  // off the scale: the kit's own range words name the scale
  box("score").value = "950"; box("score").dispatch("input");
  assert.equal(box("score").validity, "Use a number from 300 to 850.");
});

test("S11: Keep your credit safe is one form: a tick saves on the tap, Save writes the alert's day, and only that part opens on the redraw", async () => {
  const openOf = (r) => Object.fromEntries(r.parts.map((x) => [x.id, x.open]));
  const a = await draw(scored({ date: "2026-11-02", score: 712 }));
  const before = openOf(a);
  assert.deepEqual(before, { safe: false, fix: false, how: false });
  const safe = a.root.querySelectorAll("details").find((x) => x.dataset.part === "safe");
  const form = safe.querySelector("form");
  assert.ok(form, "the ticks and the days are one form, so no box sits in the parts card outside a form (S15)");
  assert.ok(!/\.field:has|cs-safe/.test(a.root.querySelector("style").textContent), "the kit's own tick: no style of this page's aimed at the kit's .field");
  assert.match(textOf(safe), /each box is saved when you tap it/, "the page says a tick needs no Save");
  const box = (n) => form.all().find((e) => e.getAttribute("name") === n);
  assert.deepEqual(form.all().filter((e) => e.tagName === "INPUT").map((e) => e.getAttribute("name")),
    ["freeze-p-ana-equifax", "freeze-p-ana-experian", "freeze-p-ana-transunion", "alert-p-ana", "freeze-p-bo-equifax", "freeze-p-bo-experian", "freeze-p-bo-transunion", "alert-p-bo"]);
  assert.match(textOf(form), /Ana: frozen at Equifax/); assert.match(textOf(form), /Bo: fraud alert until \(optional\)/);
  assert.equal(form.all().find((e) => e.tagName === "BUTTON" && e.getAttribute("type") === "submit").textContent, "Save the alert days");
  // a tick saves at once: one store.update with that one bureau, and nothing else
  box("freeze-p-bo-transunion").checked = true; box("freeze-p-bo-transunion").dispatch("change");
  assert.equal(a.saved.length, 1, "a freeze is done once: the tick is kept the moment it is tapped");
  assert.deepEqual(a.saved[0].credit.freeze, { "p-bo": { transunion: true } });
  assert.equal(a.saved[0].credit.alertUntil, undefined, "a tick saves no day");
  const b = await draw(a.saved[0]);
  assert.deepEqual(openOf(b), { ...before, safe: true }, "only the part saved in differs");
  let now = b.parts.find((x) => x.id === "safe");
  assert.equal(now.status, "partly frozen");
  assert.match(now.text, /Saved: Bo's credit is frozen at TransUnion\./);
  // the day waits for its Save (a date box changes on every digit); Save writes it and says what is true now
  const f2 = b.root.querySelectorAll("details").find((x) => x.dataset.part === "safe").querySelector("form");
  const box2 = (n) => f2.all().find((e) => e.getAttribute("name") === n);
  assert.equal(box2("freeze-p-bo-transunion").checked, true, "the box comes back as saved");
  box2("alert-p-ana").value = "2027-11-13"; box2("alert-p-ana").dispatch("change");
  assert.equal(b.saved.length, 0, "a day typed saves nothing until Save");
  f2.dispatch("submit");
  assert.equal(b.saved.length, 1);
  assert.equal(b.saved[0].credit.alertUntil["p-ana"], "2027-11-13");
  assert.deepEqual(b.saved[0].credit.freeze, { "p-bo": { transunion: true } }, "Save leaves the ticks as they were");
  const c = await draw(b.saved[0]);
  assert.deepEqual(openOf(c), { ...before, safe: true });
  assert.match(c.parts.find((x) => x.id === "safe").text, /Saved: Ana's fraud alert lasts until November 13, 2027\./);
  // Save with nothing changed says so and saves nothing
  const f3 = c.root.querySelectorAll("details").find((x) => x.dataset.part === "safe").querySelector("form");
  f3.dispatch("submit");
  assert.equal(c.saved.length, 0);
  // a tick taken off (a tap by mistake undone): saved at once; the last tick off and the day cleared, the section goes
  const box3 = (n) => f3.all().find((e) => e.getAttribute("name") === n);
  box3("freeze-p-bo-transunion").checked = false; box3("freeze-p-bo-transunion").dispatch("change");
  assert.equal(c.saved.length, 1);
  assert.equal(c.saved[0].credit.freeze, undefined);
  const e = await draw(c.saved[0]);
  assert.match(e.parts.find((x) => x.id === "safe").text, /Saved: Bo's credit is no longer marked frozen at TransUnion\./);
  const f4 = e.root.querySelectorAll("details").find((x) => x.dataset.part === "safe").querySelector("form");
  f4.all().find((x) => x.getAttribute("name") === "alert-p-ana").value = "";
  f4.dispatch("submit");
  assert.equal("credit" in e.saved[0] && (e.saved[0].credit.freeze || e.saved[0].credit.alertUntil) ? "left" : "gone", "gone");
  assert.match((await draw(e.saved[0])).parts.find((x) => x.id === "safe").text, /Saved: no fraud alert on file for Ana\./);
  // one adult: the labels need no name, and the button says one day
  const one = scored({ date: "2026-11-02", score: 712 }); one.household.people = [one.household.people[0]];
  const o = await draw(one);
  const f5 = o.root.querySelectorAll("details").find((x) => x.dataset.part === "safe").querySelector("form");
  assert.match(textOf(f5), /^Frozen at Equifax/);
  assert.match(textOf(f5), /Save the alert day$/);
  const t1 = f5.all().find((x) => x.getAttribute("name") === "freeze-p-ana-equifax");
  t1.checked = true; t1.dispatch("change");
  assert.equal(o.saved.length, 1);
  assert.match((await draw(o.saved[0])).parts.find((x) => x.id === "safe").text, /Saved: Ana's credit is frozen at Equifax\./);
  // the score's own Save (outside every part) moves no part
  const s = await draw(scored({ date: "2026-11-02", score: 712 }));
  s.root.querySelectorAll("button").find((x) => x.textContent === "+ Add a newer score").click();
  const add = s.root.querySelectorAll("form").find((f) => f.all().some((e) => e.getAttribute("name") === "score"));
  add.all().find((e) => e.getAttribute("name") === "score").value = "720";
  add.all().find((e) => e.getAttribute("name") === "date").value = "2026-11-12";
  add.dispatch("submit");
  const t = await draw(s.saved[0]);
  for (const [id, open] of Object.entries(openOf(t))) assert.equal(open, before[id] ?? false, id);
});

test("every household: the page draws, at most five parts, statuses within 20 characters, one filled button at most", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  for (const plan of [familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan(), ...ARCHETYPES.map((x) => x.build())]) {
    const r = await draw(plan);
    assert.ok(r.parts.length <= 5);
    for (const x of r.parts) assert.ok(x.status.length <= 20, x.status);
    assert.ok(filled(r.root).length <= 1);
  }
});

// ---------------------------------------------------------------- the links from What lenders see and Credit cards
test("What lenders see and Credit cards each have a row to Your credit score, in their \"More on this\" card, in sight", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  for (const page of ["ratios", "credit-cards"]) {
    for (const plan of [familyPlan(T), renterDebtPlan()]) {
      const r = await renderPage(new URL(`../${page}/view.js`, import.meta.url), plan, T, { route: { rest: [], query: {} } });
      const row = r.root.querySelectorAll("a").find((a) => a.getAttribute("href") === "#/debt/credit-score");
      assert.ok(row, page);
      assert.match(textOf(row), /What is my credit score/);
      assert.ok(r.root.all().find((e) => e.dataset?.links !== undefined)?.all().includes(row), `${page}: in the More on this card`);
      for (let a = row.parentNode; a; a = a.parentNode) assert.ok(!(a.tagName === "DETAILS" && !a.hasAttribute("open")), `${page}: in no shut part`);
    }
  }
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
test("gap #18: with `credit` absent or present, What lenders see, Credit cards and the other debt pages give byte-identical output over every household; every page does over the four fixtures", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder && !(m.group === "debt" && m.id === "credit-score"));
  const fixtures = [familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const withCredit = (plan) => {
    const b = structuredClone(plan), who = b.household.people[0]?.id ?? "";
    saveScore(b, { id: "s-1", personId: who, date: "2026-11-02", score: 712, model: "fico" });
    setFreeze(b, who, "experian", true); setAlert(b, who, "2027-11-13");
    return b;
  };
  // Diagnostics and Settings measure the plan file's size, and Export writes the plan out: a longer plan is a bigger file and a longer copy
  const out = (m, q) => { try { const r = m.compute(q, { today: T }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; } return JSON.stringify(r); } catch (e) { return `THROW ${e.message}`; } };
  const same = (m, plan) => { const a = migrate(structuredClone(plan)); assert.equal(out(m, withCredit(a)), out(m, a), `${m.group}/${m.id}`); };
  // the pages this change touches, and the rest of the debt group, over every household
  const debt = mods.filter((m) => m.group === "debt" || (m.group === "balance" && m.id === "liabilities"));
  assert.ok(debt.some((m) => m.id === "ratios") && debt.some((m) => m.id === "credit-cards"));
  for (const plan of [...fixtures, ...ARCHETYPES.map((a) => a.build())]) for (const m of debt) same(m, plan);
  // and no code outside this page reads the section at all (the heavy pages included, which are not run above)
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => !f.includes(`${path.sep}credit-score${path.sep}`) && !f.endsWith("registry.js"))
    .filter((f) => /\b(plan|p|draft|q)\.credit\b|\w\[["']credit["']\]/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(readers, []);
  // every other page that is not heavy over the four fixtures (Export's copy of the plan carries the section, as it carries every other)
  for (const plan of fixtures) for (const m of mods.filter((x) => !x.heavy && !debt.includes(x) && !(x.group === "reports" && x.id === "export"))) same(m, plan);
});
