// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { QUESTIONS, KEYS, BANDS, pointsBand, cleanAnswers, answersOf, answersLine, sameAnswers, riskRange, compareShare, bandText, rangeText, rangeShort, progressSentence, capSentence, compareSentence, planAlsoSentence, heroWords, NOT_ADVICE } from "./risk.js";

const T = "2026-11-15";

test("glide-path: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// ---- the five questions: the app's own rule of thumb (README "The five questions") ------------------------------------
const A = (when, income, fall, year, know) => ({ when, income, fall, year, know });

test("five questions: the questions, their answers and their points, as the README writes them", () => {
  assert.deepEqual(KEYS, ["when", "income", "fall", "year", "know"]);
  assert.deepEqual(QUESTIONS.map((q) => q.answers.length), [4, 3, 3, 3, 3]);
  assert.deepEqual(QUESTIONS[0].answers.map((a) => [a.label, a.cap]), [["Within 3 years", 0], ["3 to 10 years", 2], ["10 to 20 years", 3], ["Over 20 years", 4]]);
  for (const q of QUESTIONS.slice(1)) assert.deepEqual(q.answers.map((a) => a.points), [0, 1, 2], q.key);
  assert.deepEqual(BANDS.map((b) => bandText(BANDS.indexOf(b))), ["0% to 20%", "20% to 40%", "40% to 60%", "60% to 80%", "80% to 100%"]);
  // a third of $100,000, as the question says
  assert.match(QUESTIONS[3].ask, /about \$33,000 of every \$100,000/); assert.equal(Math.round(100000 / 3 / 1000) * 1000, 33000);
});

test("five questions: points 0-2, 3-4, 5-6 and 7-8 give the four bands; every edge", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(pointsBand), [1, 1, 1, 2, 2, 3, 3, 4, 4]);
  const at = (income, fall, year, know) => riskRange(A("over20", income, fall, year, know));
  assert.deepEqual([at("unsteady", "sell", "cannot", "little").points, at("unsteady", "sell", "cannot", "little").band], [0, 1]);
  assert.deepEqual([at("steady", "sell", "cannot", "little").points, rangeText(at("steady", "sell", "cannot", "little"))], [2, "20% to 40%"]);
  assert.deepEqual([at("steady", "wait", "cannot", "little").points, rangeText(at("steady", "wait", "cannot", "little"))], [3, "40% to 60%"]);
  assert.deepEqual([at("fair", "wait", "worry", "some").points, rangeText(at("fair", "wait", "worry", "some"))], [4, "40% to 60%"]);
  assert.deepEqual([at("steady", "wait", "worry", "some").points, rangeText(at("steady", "wait", "worry", "some"))], [5, "60% to 80%"]);
  assert.deepEqual([at("steady", "buy", "worry", "some").points, rangeText(at("steady", "buy", "worry", "some"))], [6, "60% to 80%"]);
  assert.deepEqual([at("steady", "buy", "fine", "some").points, rangeText(at("steady", "buy", "fine", "some"))], [7, "80% to 100%"]);
  const top = at("steady", "buy", "fine", "lot");
  assert.deepEqual([top.points, top.low, top.high, top.capped], [8, 0.8, 1, false]);
});

test("five questions: the date sets the most, and the range is the lower of the two", () => {
  const all = (when) => riskRange(A(when, "steady", "buy", "fine", "lot"));   // 8 points: 80% to 100% alone
  assert.deepEqual(["under3", "3to10", "10to20", "over20"].map((w) => rangeText(all(w))), ["0% to 20%", "40% to 60%", "60% to 80%", "80% to 100%"]);
  assert.deepEqual(["under3", "3to10", "10to20", "over20"].map((w) => all(w).capped), [true, true, true, false]);
  // the date never raises a range: 0 points with over 20 years stays 20% to 40%; within 3 years lowers it to 0% to 20%
  assert.equal(rangeText(riskRange(A("over20", "unsteady", "sell", "cannot", "little"))), "20% to 40%");
  assert.equal(rangeText(riskRange(A("under3", "unsteady", "sell", "cannot", "little"))), "0% to 20%");
  // 4 points (40% to 60%) and 3 to 10 years (at most 40% to 60%): the same band, not capped
  const even = riskRange(A("3to10", "fair", "wait", "worry", "some"));
  assert.deepEqual([even.fromPoints, even.cap, even.band, even.capped], [2, 2, 2, false]);
});

test("five questions: unknown answers are dropped, partial answers give no range, saved answers are read back", () => {
  assert.deepEqual(cleanAnswers({ when: "soon", income: "fair", extra: 1 }), { when: null, income: "fair", fall: null, year: null, know: null });
  const part = riskRange({ income: "fair", fall: "wait" });
  assert.deepEqual([part.answered, part.complete, part.missing, part.low], [2, false, ["when", "year", "know"], null]);
  assert.equal(answersOf(emptyPlan()), null);
  assert.equal(answersOf({ whatIfs: { riskCheck: { when: "nope" } } }), null);
  assert.deepEqual(answersOf({ whatIfs: { riskCheck: A("over20", "fair", "wait", "worry", "some") } }), A("over20", "fair", "wait", "worry", "some"));
  assert.ok(sameAnswers(null, {})); assert.ok(sameAnswers({ when: "over20" }, { when: "over20", income: null }));
  assert.ok(!sameAnswers({ when: "over20" }, { when: "3to10" }));
  assert.equal(answersLine(A("under3", "unsteady", "sell", "cannot", "little")), "Within 3 years · Uncertain · Sell · Could not stand it · Very little");
  assert.equal(answersLine({ when: "over20", know: "lot", year: "nope" }), "Over 20 years · A lot");
});

test("five questions: where a share sits against the range, the edges inside", () => {
  const r = riskRange(A("over20", "fair", "wait", "worry", "some"));   // 40% to 60%
  assert.deepEqual([0.39, 0.4, 0.5, 0.6, 0.61].map((s) => compareShare(s, r)), ["below", "inside", "inside", "inside", "above"]);
  assert.equal(compareShare(0.5, riskRange({})), null);
  assert.equal(compareShare(null, r), null);
  // only a number is a share: an empty box or a word is never read as 0% (critic M4: "" read as inside 0% to 20%)
  const low = riskRange(A("under3", "unsteady", "sell", "cannot", "little"));   // 0% to 20%
  for (const x of ["", " ", "0.1", false, undefined, NaN, Infinity, {}]) assert.equal(compareShare(x, low), null, String(x));
  assert.equal(compareShare(0, low), "inside");
  assert.equal(rangeShort(r), "40–60%"); assert.equal(rangeShort(riskRange(A("over20", "steady", "buy", "fine", "lot"))), "80–100%");
  // the status beside the title fits 20 characters with the person's state first
  assert.ok(`set by you · ${rangeShort(riskRange(A("over20", "steady", "buy", "fine", "lot")))}`.length <= 20);
});

test("five questions: one written sentence per case (R5)", () => {
  assert.equal(progressSentence(riskRange({})), "");
  assert.equal(progressSentence(riskRange({ when: "over20" })), "1 of 5 answered: answer the other 4 to see a range.");
  assert.equal(progressSentence(riskRange({ when: "over20", income: "fair" })), "2 of 5 answered: answer the other 3 to see a range.");
  assert.equal(progressSentence(riskRange({ when: "over20", income: "fair", fall: "wait" })), "3 of 5 answered: answer the other 2 to see a range.");
  assert.equal(progressSentence(riskRange({ when: "over20", income: "fair", fall: "wait", year: "worry" })), "4 of 5 answered: answer the last one to see a range.");
  assert.equal(progressSentence(riskRange(A("over20", "fair", "wait", "worry", "some"))), "");
  assert.equal(capSentence(riskRange(A("over20", "steady", "buy", "fine", "lot"))), "");
  assert.equal(capSentence(riskRange(A("under3", "steady", "buy", "fine", "lot"))), "Money you need within 3 years has little time to wait out a fall, so how soon you need the money counts most: 0% to 20%. Your other answers alone give 80% to 100%.");
  assert.equal(capSentence(riskRange(A("3to10", "steady", "wait", "worry", "some"))), "Money you need in 3 to 10 years has little time to wait out a fall, so how soon you need the money counts most: 40% to 60%. Your other answers alone give 60% to 80%.");
  assert.equal(capSentence(riskRange(A("10to20", "steady", "buy", "fine", "lot"))), "Money you need in 10 to 20 years has little time to wait out a fall, so how soon you need the money counts most: 60% to 80%. Your other answers alone give 80% to 100%.");
  assert.equal(compareSentence("inside", 0.7), "Your plan's 70% in stocks is inside the range your answers give.");
  assert.equal(compareSentence("above", 0.7), "Your plan's 70% in stocks is above the range your answers give: a bad year would shake it more than your answers say you would like.");
  assert.equal(compareSentence("below", 0.3), "Your plan's 30% in stocks is below the range your answers give: it may grow more slowly than you could accept.");
  // with holdings on file: what is held first (critic P2), then the plan's own share, "too" when it sits on the same side
  assert.equal(compareSentence("inside", 0.5, "held"), "The 50% you hold in stocks is inside the range your answers give.");
  assert.equal(compareSentence("above", 0.9, "held"), "The 90% you hold in stocks is above the range your answers give: a bad year would shake it more than your answers say you would like.");
  assert.equal(compareSentence("below", 0.3, "held"), "The 30% you hold in stocks is below the range your answers give: it may grow more slowly than you could accept.");
  assert.equal(compareSentence(null, 0.3, "held"), "");
  assert.equal(planAlsoSentence("above", "above", 0.7), "Your plan's 70% is above it too.");
  assert.equal(planAlsoSentence("inside", "above", 0.5), "Your plan's 50% is inside it.");
  assert.equal(planAlsoSentence("inside", "inside", 0.5), "Your plan's 50% is inside it too.");
  assert.equal(planAlsoSentence("below", "inside", 0.3), "Your plan's 30% is below it.");
  assert.equal(planAlsoSentence(null, "inside", 0.3), "");
  assert.equal(NOT_ADVICE, "Not advice: the app's own rule of thumb.");
});

// ---- the headline: one sentence per case (R3, R5) --------------------------------------------------------------------
const person = (birthDate, extra = {}) => { const p = migrate(emptyPlan()); p.household.people = [{ id: "a", name: "Alex", role: "self", birthDate, retirementAge: 65 }]; Object.assign(p.retirement, extra); return p; };
const withStocks = (p, stocks) => { p.accounts = [{ id: "brk", name: "Brokerage", type: "brokerage", balance: 100000 }]; p.holdings = [{ id: "s", accountId: "brk", symbol: "VTI", shares: stocks * 1000, price: 100, costBasis: 0 }, { id: "b", accountId: "brk", symbol: "BND", shares: (1 - stocks) * 1000, price: 100, costBasis: 0 }].filter((x) => x.shares > 0); return p; };

test("headline: the six cases, each its own written sentence", () => {
  const w = (p) => heroWords(compute(p, { today: T }));
  assert.deepEqual(w(person("1986-01-01")), { case: "glides", head: "70% in stocks now; about 50% when you retire, on your plan's path", lede: "Add your holdings to see where you stand against this path." });
  assert.deepEqual(w(person("1986-01-01", { stocksNow: 0.6, stocksRetired: 0.6 })), { case: "flat", head: "60% in stocks now and when you retire, on your plan's path", lede: "Add your holdings to see where you stand against this path." });
  assert.deepEqual(w(person("1950-01-01")), { case: "retired", head: "50% in stocks, your plan's share in retirement", lede: "Add your holdings to see where you stand against this path." });
  assert.deepEqual(w(withStocks(person("1986-01-01"), 0.72)), { case: "on", head: "You hold 72% in stocks; your plan's path says 70%", lede: "That is within five points: you are on the path." });
  assert.deepEqual(w(withStocks(person("1986-01-01"), 0.9)), { case: "more", head: "You hold 90% in stocks; your plan's path says 70%", lede: "That is 20 points more than the path: a bad year would hit harder than the plan assumes." });
  assert.deepEqual(w(withStocks(person("1986-01-01"), 0.55)), { case: "fewer", head: "You hold 55% in stocks; your plan's path says 70%", lede: "That is 15 points less than the path: growth would lag what the plan assumes." });
  // the path measured against: 110 minus 40 is 70%; a target-date fund for 2051 holds 50% + 40% x 25/25... = 90% at 25 years out
  const age = withStocks(person("1986-01-01"), 0.9); age.investments.glide = "age";
  assert.equal(w(age).head, "You hold 90% in stocks; 110 minus your age says 70%");
  const td = withStocks(person("1986-01-01"), 0.9); td.investments.glide = "target-date";
  assert.equal(w(td).head, "You hold 90% in stocks; a target-date fund holds 90%");
  // no birth date: no age is said (guess-sanity pt.pension.one-age)
  assert.ok(!/\b\d\d\b(?!%)/.test(w(migrate(emptyPlan())).head.replace(/\d+%/g, "")));
});

// ---- the page (stand-in DOM) -----------------------------------------------------------------------------------------
async function page(plan, today = T) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const P = { plan: migrate(structuredClone(plan)), saved: [], root: null };
  // one address for the visit, as the shell draws it again after a save (P.visit() is a new arrival: a new address object)
  P.route = { group: "investments", id: "glide-path", rest: [], query: {} };
  P.visit = () => { P.route = { ...P.route }; return P.draw(); };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route: P.route, module: { group: "investments", id: "glide-path" },
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: P.draw }); return P; };
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.open = (id) => { const d = P.part(id); d.open = true; d.setAttribute?.("open", ""); d.dispatch("toggle"); return d; };
  P.states = () => P.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open"), e.querySelector(".fold-status")?.textContent ?? ""]);
  P.textOf = textOf;
  P.chip = (key, label) => P.part("risk").all().find((e) => e.dataset?.question === key).all().find((e) => e.tagName === "BUTTON" && textOf(e) === label);
  P.button = (label) => P.root.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label);
  return P.draw();
}
const pick = (P, answers) => { for (const q of QUESTIONS) { const label = q.answers.find((a) => a.value === answers[q.key]).label; P.chip(q.key, label).dispatch("click"); } };

test("page: the first view leads with the answer; the milestones, the questions, the path and the working are quiet rows", async () => {
  const P = await page(investmentsPlan());
  assert.equal(P.textOf(P.root.querySelector("h1")), "You hold 90% in stocks; your plan's path says 70%");
  assert.deepEqual(P.states(), [["ages", false, ""], ["risk", false, ""], ["path", false, "plan's path"], ["how", false, "3 paths"]]);
  assert.deepEqual(P.root.all().filter((e) => e.dataset?.part).map((e) => P.textOf(e.querySelector(".fold-title"))), ["9 more ages", "Five questions about how much ups and downs suit you", "Which path to measure against", "How this is worked out"]);
  // the two named "own" parts hold no box to type in (R24: a pick from a list, so not "Set my own numbers")
  for (const id of ["risk", "path"]) assert.deepEqual(P.open(id).all().filter((e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName)), [], id);
  // no "Use N% on Will the money last?": this page has no save path for the stock share
  assert.ok(!P.root.all().some((e) => e.tagName === "BUTTON" && /^Use \d+%/.test(P.textOf(e))));
  const empty = await page(emptyPlan());
  assert.equal(P.textOf(empty.root.querySelector("h1")), "70% in stocks now; about 50% when you retire, on your plan's path");
  assert.ok(empty.root.all().some((e) => e.tagName === "A" && P.textOf(e) === "Add your holdings ›"));
});

test("S11: Five questions: picking changes nothing in the plan; Save keeps the answers, names the range in green, keeps its part open and moves no other part", async () => {
  const P = await page(investmentsPlan());
  P.open("ages");   // a part the person opened by hand stays as it was
  const risk = P.open("risk");
  assert.match(P.textOf(risk), /^Five questions about how much ups and downs suit you › Nothing is kept until you tap Save\. When will you need most of this money\?/);
  P.chip("when", "Over 20 years").dispatch("click");
  P.chip("income", "Fairly steady").dispatch("click");
  assert.match(P.textOf(P.part("risk")), /2 of 5 answered: answer the other 3 to see a range\./);
  assert.ok(!P.button("Save my answers"), "no Save before all five");
  P.chip("fall", "Wait it out").dispatch("click"); P.chip("year", "Worried, but hold on").dispatch("click"); P.chip("know", "Some").dispatch("click");
  assert.equal(P.saved.length, 0, "picking saves nothing");
  const t = P.textOf(P.part("risk"));
  // what is held (90%, the hero's figure) is what the range is measured against; the plan's share beside it (critic P2)
  assert.match(t, /From your answers 40% to 60% What you hold now 90% By your age: 110 minus 58 52% Your plan's share 70% now/);
  assert.match(t, /The 90% you hold in stocks is above the range your answers give: a bad year would shake it more than your answers say you would like\. Your plan's 70% is above it too\./);
  assert.ok(P.part("risk").all().some((e) => e.tagName === "A" && e.getAttribute("href") === "#/retirement/projection?show=stocksNow" && P.textOf(e) === "Change it on Will the money last? ›"));
  assert.match(t, /Not advice: the app's own rule of thumb\./);
  assert.equal(P.button("Save my answers").className, "secondary", "outlined: the page keeps one filled button");
  P.button("Save my answers").dispatch("click");
  assert.equal(P.saved.length, 1);
  assert.deepEqual(P.plan.whatIfs.riskCheck, A("over20", "fair", "wait", "worry", "some"));
  assert.deepEqual(P.states(), [["ages", false, ""], ["risk", true, "set by you · 40–60%"], ["path", false, "plan's path"], ["how", false, "3 paths"]], "the saved part open, the others as the page draws them");
  const ok = P.part("risk").all().find((e) => String(e.className).includes("notice ok"));
  assert.equal(P.textOf(ok), "Saved. Your answers give 40% to 60% in stocks.");
  // a reload: shut, saying what it holds; open, the answer first with the answers in a line, the questions one tap away
  P.draw();
  assert.deepEqual(P.states()[1], ["risk", false, "set by you · 40–60%"]);
  P.open("risk");
  assert.ok(!P.part("risk").all().some((e) => e.dataset?.question), "no questions until Change my answers");
  assert.match(P.textOf(P.part("risk")), /From your answers 40% to 60% .* Your answers: Over 20 years · Fairly steady · Wait it out · Worried, but hold on · Some\. Change my answers Forget my answers$/);
  assert.ok(!P.button("Save my answers") && !P.button("Save my new answers") && P.button("Forget my answers"));
  P.button("Change my answers").dispatch("click");
  assert.equal(P.chip("when", "Over 20 years").getAttribute("aria-pressed"), "true");
  assert.ok(!P.button("Save my new answers"), "no Save until an answer changes");
  assert.equal(P.saved.length, 1);
  // inside the range: no link to change it; the date lowers the range and says so
  P.chip("when", "10 to 20 years").dispatch("click"); P.chip("income", "Very steady").dispatch("click"); P.chip("fall", "Buy more").dispatch("click"); P.chip("year", "Part of investing").dispatch("click"); P.chip("know", "A lot").dispatch("click");
  const t2 = P.textOf(P.part("risk"));
  assert.match(t2, /From your answers 60% to 80% What you hold now 90% By your age: 110 minus 58 52% Your plan's share 70% now Money you need in 10 to 20 years has little time to wait out a fall, so how soon you need the money counts most/);
  assert.match(t2, /The 90% you hold in stocks is above the range your answers give: .* Your plan's 70% is inside it\./);
  assert.ok(!P.part("risk").all().some((e) => e.tagName === "A" && /Change it on/.test(P.textOf(e))));
  assert.equal(P.saved.length, 1);
  P.button("Save my new answers").dispatch("click");
  assert.equal(P.plan.whatIfs.riskCheck.when, "10to20");
  assert.equal(P.textOf(P.part("risk").all().find((e) => String(e.className).includes("notice ok"))), "Saved. Your answers give 60% to 80% in stocks.");
});

test("Forget my answers: removes them, says so, and Undo puts them back", async () => {
  const p = investmentsPlan(); p.whatIfs = { ...(p.whatIfs ?? {}), riskCheck: A("over20", "fair", "wait", "worry", "some") };
  const P = await page(p);
  P.open("risk");
  P.button("Forget my answers").dispatch("click");
  assert.equal(P.plan.whatIfs.riskCheck, undefined);
  assert.deepEqual(P.states()[1], ["risk", true, ""]);
  const n = P.part("risk").all().find((e) => String(e.className).includes("notice ok"));
  assert.match(P.textOf(n), /^Your answers are forgotten\. Undo$/);
  n.all().find((e) => e.tagName === "BUTTON").dispatch("click");
  assert.deepEqual(P.plan.whatIfs.riskCheck, A("over20", "fair", "wait", "worry", "some"));
  assert.equal(P.textOf(P.part("risk").all().find((e) => String(e.className).includes("notice ok"))), "Your answers are back.");
});

test("S11: Which path to measure against: three chips, saved on the tap, the new headline in green, the part kept open", async () => {
  const P = await page(investmentsPlan());
  const path = P.open("path");
  assert.deepEqual(path.all().filter((e) => e.tagName === "BUTTON").map((e) => [P.textOf(e), e.getAttribute("aria-pressed")]), [["The plan's path", "true"], ["110 minus age", "false"], ["Target-date fund", "false"]]);
  path.all().find((e) => e.tagName === "BUTTON" && P.textOf(e) === "110 minus age").dispatch("click");
  assert.equal(P.plan.investments.glide, "age");
  assert.deepEqual(P.states(), [["ages", false, ""], ["risk", false, ""], ["path", true, "110 minus age"], ["how", false, "3 paths"]]);
  assert.equal(P.textOf(P.part("path").all().find((e) => String(e.className).includes("notice ok"))), "Saved. You hold 90% in stocks; 110 minus your age says 52%.");
  assert.equal(P.textOf(P.root.querySelector("h1")), "You hold 90% in stocks; 110 minus your age says 52%");
  // no holdings: the headline does not change, so the line says what the choice will do
  const E = await page(emptyPlan());
  E.open("path").all().find((e) => e.tagName === "BUTTON" && P.textOf(e) === "Target-date fund").dispatch("click");
  assert.equal(P.textOf(E.part("path").all().find((e) => String(e.className).includes("notice ok"))), "Saved. Once your holdings are in, the page measures them against a target-date fund.");
});

test("page: opening and shutting every part, and picking answers without Save, changes nothing in the plan", async () => {
  const P = await page(investmentsPlan());
  const before = JSON.stringify(P.plan);
  for (const id of ["ages", "risk", "path", "how"]) P.open(id);
  pick(P, A("under3", "unsteady", "sell", "cannot", "little"));
  assert.match(P.textOf(P.part("risk")), /From your answers 0% to 20%/);
  assert.equal(P.saved.length, 0); assert.equal(JSON.stringify(P.plan), before);
});

test("answers not saved last for the visit only: a redraw keeps them; leaving and coming back, or another plan, starts over (critic M1)", async () => {
  const P = await page(investmentsPlan());
  P.open("risk");
  pick(P, A("under3", "unsteady", "sell", "cannot", "little"));
  P.draw();   // the shell's redraw after a save elsewhere on the page: the same address, the answers kept and the part open
  assert.deepEqual(P.states()[1], ["risk", true, ""]);
  assert.match(P.textOf(P.part("risk")), /From your answers 0% to 20% .* Save my answers$/);
  P.visit();  // left and came back (a link, the menu, Back): a new address, nothing kept
  assert.deepEqual(P.states()[1], ["risk", false, ""]);
  P.open("risk");
  assert.ok(!/From your answers|Save my answers/.test(P.textOf(P.part("risk"))));
  assert.ok(P.part("risk").all().filter((e) => e.getAttribute?.("aria-pressed") === "true").length === 0, "no chip picked");
  // another plan in the same tab (same address): the answers picked for the first plan are not shown for the second
  pick(P, A("under3", "unsteady", "sell", "cannot", "little"));
  P.plan = migrate({ ...structuredClone(P.plan), meta: { ...P.plan.meta, createdAt: "2026-01-02T00:00:00.000Z" } });
  P.draw();
  assert.deepEqual(P.states()[1], ["risk", false, ""]);
  assert.equal(P.saved.length, 0);
});

test("five questions with no holdings on file: the plan's own share is measured, no held row", async () => {
  const P = await page(emptyPlan());
  P.open("risk");
  pick(P, A("over20", "fair", "wait", "worry", "some"));
  const t = P.textOf(P.part("risk"));
  assert.ok(!/What you hold now/.test(t));
  assert.match(t, /From your answers 40% to 60% .*Your plan's share 70% now Your plan's 70% in stocks is above the range your answers give/);
});

// ---- invariance (gap spec 3.5): the saved answers change no page's figures ---------------------------------------------
test("invariance: with whatIfs.riskCheck saved, every page's compute gives byte-identical output over the fixtures and every household", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder && !m.heavy);
  const withAnswers = (plan) => { const b = structuredClone(plan); b.whatIfs = { ...(b.whatIfs ?? {}), riskCheck: A("10to20", "steady", "buy", "fine", "lot") }; return b; };
  // Diagnostics and Settings measure the plan file's size, and Export writes the plan out: a longer plan is a bigger file
  const out = (m, q) => { try { const r = m.compute(q, { today: T }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; } return JSON.stringify(r); } catch (e) { return `THROW ${e.message}`; } };
  const fixtures = [investmentsPlan(), familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const near = mods.filter((m) => ["investments", "retirement", "overview"].includes(m.group));
  for (const plan of [...fixtures, ...ARCHETYPES.map((a) => a.build())]) {
    const a = migrate(structuredClone(plan));
    for (const m of near) assert.equal(out(m, withAnswers(a)), out(m, a), `${m.group}/${m.id}`);
  }
  for (const plan of fixtures) {
    const a = migrate(structuredClone(plan));
    for (const m of mods.filter((x) => !near.includes(x) && !(x.group === "reports" && x.id === "export"))) assert.equal(out(m, withAnswers(a)), out(m, a), `${m.group}/${m.id}`);
  }
  // and no code outside this page reads the new field
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => !f.includes(`${path.sep}glide-path${path.sep}`) && /riskCheck\b/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(readers, []);
});
