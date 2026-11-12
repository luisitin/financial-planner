// tests/tax-split.test.mjs -- pay the tax later or now, per row at work (owner's request 2026-11-11, spec part C, option C1, L6):
// two rows, the match kept on the pay-the-tax-later one; this year's federal tax difference; Paycheck's Roth 401(k) line; Work
// benefits counting both rows; the money at retirement by when its tax is paid; the catch-up line. Households are the invented
// phone-built ones (qa/fixtures/phone-households.mjs: Dana & Lee) and qa/fixtures/family-plan.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../core/schema/migrate.js";
import { perYear } from "../core/math/periods.js";
import { danaLee, jamie } from "../qa/fixtures/phone-households.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import * as C from "../modules/retirement/contributions/compute.js";
import { compute as federal } from "../modules/taxes/federal/compute.js";
import { compute as paycheck } from "../modules/cashflow/paycheck/compute.js";
import { compute as benefits, matchAt } from "../modules/career/benefits/compute.js";
import { compute as projection } from "../modules/retirement/projection/compute.js";
import { compute as nba } from "../modules/overview/next-best-action/compute.js";
import * as LV from "../modules/retirement/levers.js";

const T = "2026-11-11";
const DANA = "setup-contrib-setup-self";
const dl = () => migrate(danaLee());
const ids = { nowRow: "n-row", laterRow: "l-row", nowAccount: "n-acct", laterAccount: "l-acct" };
const split = (plan, rowId, opts) => { const q = structuredClone(plan); C.applyTaxChoice(q, rowId, { today: T, ids, accountName: "Roth 401(k) at work", ...opts }); return q; };
const ownOf = (plan, pid) => (plan.retirement.contributions ?? []).filter((c) => c.personId === pid).reduce((t, c) => t + perYear(c.amount, c.period), 0);
const matchOf = (plan, pid) => (plan.retirement.contributions ?? []).filter((c) => c.personId === pid).reduce((t, c) => t + (Number(c.employerMatch) || 0), 0);
const fed = (plan) => federal(plan, { today: T }).result.totalTax;

test("taxPairOf: a row at work read with the person's other one; an IRA, a brokerage and a job left are not asked", () => {
  const p = dl();
  const pair = C.taxPairOf(p, DANA);
  assert.deepEqual([pair.pid, pair.choice, pair.laterEach, pair.nowEach, pair.match, pair.period, pair.nowAccount], ["setup-self", "later", 400, 0, 2400, "monthly", null]);
  const f = migrate(familyPlan());
  // Bo's Roth IRA: by law a traditional and a Roth IRA are separate accounts, never split
  assert.equal(C.taxPairOf(f, "c-bo"), null);
  const old = structuredClone(p); old.accounts.find((a) => a.id === "setup-workplan-setup-self").formerJob = true;
  assert.equal(C.taxPairOf(old, DANA), null);
});

test("some of each: the own money keeps its total, the whole match stays on the pay-the-tax-later row, the Roth 401(k) row counts against the 401(k) limit", () => {
  const p = dl();
  const q = split(p, DANA, { choice: "some", laterEach: 260, nowEach: 140 });
  assert.equal(ownOf(q, "setup-self"), ownOf(p, "setup-self"), "own money a year unchanged");
  assert.equal(matchOf(q, "setup-self"), 2400);
  const later = q.retirement.contributions.find((c) => c.id === DANA), now = q.retirement.contributions.find((c) => c.id === "n-row");
  assert.deepEqual([later.amount, later.employerMatch, later.period], [260, 2400, "monthly"]);
  assert.deepEqual([now.amount, now.employerMatch, now.period, now.personId, now.accountId], [140, 0, "monthly", "setup-self", "n-acct"]);
  assert.deepEqual(q.accounts.find((a) => a.id === "n-acct"), { id: "n-acct", name: "Roth 401(k) at work", type: "roth", balance: 0, asOf: T, ownerId: "setup-self", history: [] });
  const items = C.compute(q, { today: T }).items;
  assert.equal(items.find((i) => i.id === "n-row").limitKind, "401k");
  // the 401(k) limit counts both rows
  const lim = C.compute(q, { today: T }).byPerson.find((x) => x.personId === "setup-self").limits.find((l) => l.kind === "401k");
  assert.equal(lim.used, 4800);
  const back = C.taxPairOf(q, "n-row");
  assert.deepEqual([back.choice, back.laterEach, back.nowEach, back.later.id, back.now.id], ["some", 260, 140, DANA, "n-row"]);
  // shares of pay typed are kept beside the dollars
  const s = split(p, DANA, { choice: "some", laterEach: 260, nowEach: 130, laterPct: 0.04, nowPct: 0.02 });
  assert.deepEqual(s.retirement.contributions.filter((c) => c.personId === "setup-self").map((c) => c.pctOfPay), [0.04, 0.02]);
});

test("pay the tax now: all of it on the Roth 401(k) row, the match left on a $0 pay-the-tax-later row; no match, no $0 row; later again takes the Roth row out", () => {
  const p = dl();
  const q = split(p, DANA, { choice: "now", nowEach: 400 });
  const rows = q.retirement.contributions.filter((c) => c.personId === "setup-self");
  assert.deepEqual(rows.map((c) => [c.id, c.amount, c.employerMatch]), [[DANA, 0, 2400], ["n-row", 400, 0]]);
  assert.equal(C.taxPairOf(q, "n-row").choice, "now");
  // Lee has no match: the row moves whole
  const lee = split(p, "setup-contrib-setup-partner", { choice: "now", nowEach: 150 });
  assert.deepEqual(lee.retirement.contributions.filter((c) => c.personId === "setup-partner").map((c) => [c.id, c.amount, c.employerMatch]), [["n-row", 150, 0]]);
  assert.equal(lee.accounts.filter((a) => a.ownerId === "setup-partner" && a.type === "401k").length, 1, "the 401(k) itself stays on Net worth");
  // and back: later, from the Roth row
  const back = split(q, "n-row", { choice: "later", laterEach: 400 });
  assert.deepEqual(back.retirement.contributions.filter((c) => c.personId === "setup-self").map((c) => [c.id, c.amount, c.employerMatch]), [[DANA, 400, 2400]]);
  // a match typed by hand on a Roth 401(k) row goes to the pay-the-tax-later row with any answer (D-C2)
  const hand = structuredClone(q); hand.retirement.contributions.find((c) => c.id === "n-row").employerMatch = 600;
  const moved = split(hand, "n-row", { choice: "some", laterEach: 100, nowEach: 300 });
  assert.deepEqual(moved.retirement.contributions.filter((c) => c.personId === "setup-self").map((c) => [c.id, c.employerMatch]), [[DANA, 3000], ["n-row", 0]]);
});

test("federal tax this year: pre-tax money drops by the Roth part, and the tax line's figure is the Federal estimate's own difference", () => {
  const p = dl();
  const q = split(p, DANA, { choice: "some", laterEach: 270, nowEach: 130 });
  const k = (plan) => federal(plan, { today: T }).k401.people.find((x) => x.id === "setup-self");
  assert.equal(k(p).pretax - k(q).pretax, 130 * 12);
  assert.equal(k(q).roth, 130 * 12);
  const allLater = split(q, "n-row", { choice: "later", laterEach: 400 });
  const diff = Math.round((fed(q) - fed(allLater)) / 10) * 10;
  assert.equal(diff, 190);
  // the 12% bracket on $1,560 a year, near enough (the Federal estimate's own figure is what is shown)
  assert.ok(Math.abs(diff - 0.12 * 1560) < 20);
});

test("Paycheck: the Roth 401(k) line is the person's Roth 401(k) rows a paycheck when none is typed; a typed what-if still wins", () => {
  const q = split(dl(), DANA, { choice: "some", laterEach: 260, nowEach: 130 });
  const dana = paycheck(q, { today: T }).people.find((x) => x.id === "setup-self");
  const roth = dana.aftertax.find((x) => x.key === "roth");
  assert.deepEqual([roth.amount, roth.from], [130 * 12 / dana.paychecks, "plan"]);
  assert.equal(dana.pretax.find((x) => x.key === "k401").amount, 260 * 12 / dana.paychecks);
  const typed = structuredClone(q); typed.whatIfs = { paycheck: { "setup-self": { roth: 75 } } };
  assert.deepEqual(paycheck(typed, { today: T }).people.find((x) => x.id === "setup-self").aftertax.find((x) => x.key === "roth").amount, 75);
  // no Roth 401(k): no line, as before
  assert.equal(paycheck(dl(), { today: T }).people.find((x) => x.id === "setup-self").aftertax.find((x) => x.key === "roth"), undefined);
});

test("Work benefits: what goes in now and the match on it count both rows at the job", () => {
  const p = dl();
  const q = split(p, DANA, { choice: "some", laterEach: 260, nowEach: 130 });
  const a = benefits(p, { today: T }).k401, b = benefits(q, { today: T }).k401;
  assert.equal(b.nowYearly, 4680);
  assert.ok(Math.abs(b.nowPct - 4680 / 78000) < 1e-12);
  assert.equal(b.nowMatch, matchAt(4680 / 78000, b.tiers) * 78000);
  // the same total all pay-the-tax-later gives the same "put in X% for the full match"
  const same = split(p, DANA, { choice: "later", laterEach: 390 });
  assert.equal(b.fullPct, benefits(same, { today: T }).k401.fullPct);
  assert.equal(b.nowYearly, benefits(same, { today: T }).k401.nowYearly);
  assert.ok(a.nowYearly === 4800);
  // the choice "what goes in now" takes the Roth part after tax
  const nowOpt = b.options.find((o) => o.key === "now");
  assert.equal(nowOpt.roth, 1560);
  // "on $X put in before tax" leaves the Roth part out
  const t = benefits(q, { today: T }).total;
  assert.equal(t.rothYearly, 1560);
});

test("the mix at retirement: shares of the projection's retirement-year balances, adding up to 100", () => {
  for (const plan of [dl(), split(dl(), DANA, { choice: "some", laterEach: 260, nowEach: 130 }), migrate(familyPlan())]) {
    const d = projection(plan, { today: T });
    const m = LV.mixAtRetirement(d);
    assert.equal(m.later + m.now + m.regular, 100);
    const b = d.rows.find((r) => r.year === d.atRetirement.year).balances;
    const tot = b.deferred + b.free + b.taxable + b.cash;
    for (const [k, v] of [["later", b.deferred], ["now", b.free], ["regular", b.taxable + b.cash]]) assert.ok(Math.abs(m[k] - (v / tot) * 100) < 1, k);
  }
  assert.equal(LV.mixWords({ year: 2044, later: 88, now: 9, regular: 3 }), "Your money when retirement starts (2044): 88% pay-the-tax-later, 9% already taxed (Roth), 3% regular savings.");
  assert.equal(LV.mixWords({ year: 2044, later: 97, now: 0, regular: 3 }), "Your money when retirement starts (2044): 97% pay-the-tax-later, 3% regular savings.");
  assert.equal(LV.mixAtRetirement(null), null);
});

test("the catch-up line: 50 or over, pay from this job over $150,000, from 2026", () => {
  const w = "From 2026, catch-up money above the usual limit must go in as Roth if last year's pay from this job was over $150,000.";
  assert.equal(C.catchUpRothWords(50, 150001, 2026), w);
  assert.equal(C.catchUpRothWords(49, 200000, 2026), null);
  assert.equal(C.catchUpRothWords(50, 150000, 2026), null, "over the line, not at it");
  assert.equal(C.catchUpRothWords(60, 200000, 2025), null, "not before 2026");
  assert.equal(C.catchUpRothWords(null, 200000, 2026), null);
  assert.match(C.TAX_RULE_OF_THUMB, /^If you expect a lower tax rate in retirement, later usually wins; higher, now wins\. Not sure\? Some of each is a sound choice\.$/);
});

test("F1 (review 2026-11-13): \"Change ›\" shows the three answers and the rule of thumb, and the catch-up line only when there is one; never the word null", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const view = new URL("../modules/retirement/contributions/view.js", import.meta.url).href;
  const opened = async (plan) => {
    const r = await renderPage(view, plan, T, { computeOf: { "overview/next-best-action": nba } });
    r.root.querySelectorAll("li").find((x) => /Dana's plan at work/.test(x.textContent)).click();
    r.root.querySelectorAll("button").find((b) => b.textContent === "Change ›").click();
    const part = r.root.querySelector(".ct-tax");
    // the opened part's own nodes: the three answers, the rule of thumb and (only with one) the catch-up line, no bare text
    const raw = (n) => (n.tagName ? n.childNodes.flatMap(raw) : [n.data]);
    return { text: r.text(), loose: part.all().filter((e) => e.childNodes.some((c) => !c.tagName && c.raw)).length, words: raw(part) };
  };
  // Dana is 47 and paid $78,000: no catch-up line
  const young = await opened(danaLee());
  assert.match(young.text, /Some of each If you expect a lower tax rate in retirement, later usually wins; higher, now wins\. Not sure\? Some of each is a sound choice\./);
  assert.doesNotMatch(young.text, /\bnull\b|\bundefined\b|catch-up/);
  assert.equal(young.loose, 0);
  assert.ok(!young.words.includes("null"));
  // 50 or over and paid over $150,000 from this job: the catch-up line under the rule of thumb
  const older = danaLee();
  older.household.people[0].birthDate = "1970-04-15";
  older.income[0].amount = 160000;
  const o = await opened(older);
  assert.match(o.text, /sound choice\. From 2026, catch-up money above the usual limit must go in as Roth if last year's pay from this job was over \$150,000\./);
  assert.doesNotMatch(o.text, /\bnull\b|\bundefined\b/);
});

test("after a split: one match row on the card, on the pay-the-tax-later row; no match check on the Roth 401(k) row; nothing is counted twice", () => {
  const p = dl();
  const q = split(p, DANA, { choice: "some", laterEach: 260, nowEach: 140 });
  const spare = (plan) => { const n = nba(plan, { today: T }); return n?.ready ? n.spare : null; };
  const r = LV.leverRows(q, { today: T, spare: spare(q) });
  const rows = [...r.shown, ...r.folded, ...r.hidden];
  assert.deepEqual(rows.filter((x) => x.key.startsWith("match:") && x.key.includes("setup-self") || x.key === `match:${DANA}` || x.key === "match:n-row").map((x) => x.key), [`match:${DANA}`]);
  const ws = rows.find((x) => x.key === "work-saving:setup-self");
  assert.equal(ws.short, "$400 a month", "both rows are what goes in");
  assert.deepEqual(LV.matchChecks(q, { today: T }).map((x) => x.rowId), [], "Dana's match is on file; Lee was answered");
  // "now": the match row is the $0 pay-the-tax-later row that carries it
  const n = split(p, DANA, { choice: "now", nowEach: 400 });
  const nr = LV.leverRows(n, { today: T, spare: spare(n) });
  assert.deepEqual([...nr.shown, ...nr.folded, ...nr.hidden].filter((x) => x.key.startsWith("match:") && !x.key.includes("partner")).map((x) => [x.key, x.value]), [[`match:${DANA}`, "$2,400 a year"]]);
  // a usual-match change tried on a split goes on the row that holds the match, never on the Roth row (D-C2)
  const jm = migrate(jamie());
  const js = split(jm, "setup-contrib-setup-self", { choice: "some", laterEach: 150, nowEach: 100 });
  const alt = LV.workAlt(js, "setup-self", { today: T });
  const tried = structuredClone(js); LV.applyWorkAlt(tried, "setup-self", alt);
  assert.equal(tried.retirement.contributions.find((c) => c.id === "n-row").employerMatch, 0);
  // the money going in is taken off the month once: the left-over moves only by the tax on the part paid now (less than it)
  const drop = nba(p, { today: T }).spare.monthly - nba(q, { today: T }).spare.monthly;
  assert.ok(drop >= 0 && drop < 140 * 0.25, `left-over drop ${drop}`);
});

test("the Contributions form: Dana's row, the tax line, Some of each, 4% later and 2% now, Save: two rows, the match on later, one sentence, this year's tax and the mix under the rows, no engine answer", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const { compute: pj } = await import("../modules/retirement/projection/compute.js");
  const view = new URL("../modules/retirement/contributions/view.js", import.meta.url).href;
  const cOf = { "overview/next-best-action": nba, "retirement/projection": pj };
  const r = await renderPage(view, danaLee(), T, { computeOf: cOf });
  // open Dana's row from the list
  const li = r.root.querySelectorAll("li").find((x) => /Dana's plan at work/.test(x.textContent));
  li.click();
  const f = r.root.querySelector("form");
  // simple first (owner, 2026-11-12; review P10): one quiet line, the three answers one tap away; no citation on screen
  assert.match(r.text(), /Tax on this money: paid later, the usual\. Change ›/);
  assert.doesNotMatch(r.text(), /Some of each|Brown, Cederburg/);
  const btn = (t) => r.root.querySelectorAll("button").find((b) => b.textContent === t);
  btn("Change ›").click();
  assert.match(r.text(), /Pay the tax later Pay the tax now Some of each If you expect a lower tax rate in retirement, later usually wins; higher, now wins\. Not sure\? Some of each is a sound choice\./);
  assert.doesNotMatch(r.text(), /Brown, Cederburg/);
  assert.equal(btn("Pay the tax later").getAttribute("aria-pressed"), "true");
  assert.equal(f.querySelector('[name="nowAmount"]').closest("label").hidden, true, "the now box shows only for Some of each");
  btn("Some of each").click();
  assert.equal(f.querySelector('[name="nowAmount"]').closest("label").hidden, false);
  assert.match(r.text(), /Pay the tax later: your own money/);
  assert.match(r.text(), /Now \$400 a month in all\. Type the part that pays the tax now; the rest stays pay-the-tax-later\./);
  // the spec's acceptance: 4% later, 2% now, both typed (the total moves from $400 to $390 and the form says so first: M2)
  f.querySelector('[name="amount"]').value = "4%";
  f.querySelector('[name="amount"]').dispatch("change");
  f.querySelector('[name="nowAmount"]').value = "2%";
  f.querySelector('[name="nowAmount"]').dispatch("change");
  assert.equal(f.querySelector('[name="amount"]').value, "4%", "a box the person typed is never retyped");
  assert.match(r.text(), /That is \$390 a month in all, \$10 less than now\./);
  // this year's tax as a year's figure, with the month's take-home pay (federal and state: Dana and Lee live in North Carolina; M4)
  assert.match(r.text(), /About \$190 a year more in federal income tax than paying it all later \(state tax on top\): about \$2\d a month less take-home pay\./);
  f.reset = () => {};
  f.dispatch("submit");
  assert.equal(r.saved.length, 1);
  const s = r.saved[0];
  const mine = s.retirement.contributions.filter((c) => c.personId === "setup-self");
  assert.deepEqual(mine.map((c) => [c.amount, c.employerMatch, c.pctOfPay]), [[260, 2400, 0.04], [130, 0, 0.02]]);
  assert.equal(s.accounts.find((a) => a.id === mine[1].accountId).name, "Dana's Roth 401(k) at work");
  assert.equal(mine[1].pairOf, mine[0].accountId, "the Roth part is tied to its job (B1)");
  // the page after the save: one sentence (P3); this year's tax and the mix in the open fold under the rows; no "Your retirement
  // answer" (D-C3)
  const after = await renderPage(view, s, T, { computeOf: cOf });
  const t = after.text();
  assert.match(t, /Saved: \$260 a month paying the tax later \(with the match\), \$130 a month paying it now\./);
  assert.match(t, /When the tax is paid \$130 a month now/);
  assert.match(t, /Dana pays the tax now on \$130 a month \(Roth 401\(k\)\)\. About \$190 a year more in federal income tax than paying it all later \(state tax on top\): about \$2\d a month less take-home pay\./);
  assert.match(t, /Your money when retirement starts \(2044\): \d+% pay-the-tax-later, \d+% already taxed \(Roth\), \d+% regular savings\./);
  const tf = after.root.querySelectorAll("details").find((x) => /ct-taxfold/.test(x.className));
  assert.ok(tf.open === true || (tf.getAttribute("open") ?? null) !== null, "open right after the save");
  assert.doesNotMatch(t, /Your retirement answer/);
});

test("Some of each keeps the person's total: typing only the pay-the-tax-now part takes it out of the pay-the-tax-later box (review 2026-11-12, M2)", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const view = new URL("../modules/retirement/contributions/view.js", import.meta.url).href;
  const r = await renderPage(view, danaLee(), T, { computeOf: { "overview/next-best-action": nba } });
  r.root.querySelectorAll("li").find((x) => /Dana's plan at work/.test(x.textContent)).click();
  const f = r.root.querySelector("form");
  const btn = (t) => r.root.querySelectorAll("button").find((b) => b.textContent === t);
  btn("Change ›").click();
  btn("Some of each").click();
  f.querySelector('[name="nowAmount"]').value = "2%";
  f.querySelector('[name="nowAmount"]').dispatch("change");
  // 2% of $78,000 a year is $130 a month; $400 - $130 = $270 stays pay-the-tax-later
  assert.equal(f.querySelector('[name="amount"]').value, "270");
  assert.match(r.text(), /Now \$400 a month in all\./);
  f.reset = () => {};
  f.dispatch("submit");
  const own = (p) => p.retirement.contributions.filter((c) => c.personId === "setup-self").reduce((t, c) => t + perYear(c.amount, c.period), 0);
  assert.equal(own(r.saved[0]), own(danaLee()), "the person's own money a year is unchanged");
  // taken back: 4% and $130 (a share and dollars) go back into one box in dollars, nothing dropped (B2)
  const r2 = await renderPage(view, r.saved[0], T, { computeOf: { "overview/next-best-action": nba } });
  r2.root.querySelectorAll("li").find((x) => /Dana's plan at work/.test(x.textContent)).click();
  const f2 = r2.root.querySelector("form");
  const b2 = (t) => r2.root.querySelectorAll("button").find((b) => b.textContent === t);
  assert.match(r2.text(), /Tax on this money: some paid later, some now \(Roth\)\./);
  b2("Change ›").click();
  b2("Pay the tax later").click();
  assert.equal(f2.querySelector('[name="amount"]').value, "400");
  f2.reset = () => {};
  f2.dispatch("submit");
  assert.equal(own(r2.saved[0]), own(danaLee()));
});

test("F5 (review 2026-11-13): a save that keeps the tax answer says what changed and what it did to the retirement answer; a change of the tax answer, or money moved between the parts, does not", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const { compute: pj } = await import("../modules/retirement/projection/compute.js");
  const view = new URL("../modules/retirement/contributions/view.js", import.meta.url).href;
  const cOf = { "overview/next-best-action": nba, "retirement/projection": pj };
  // 1 (B5's steps): Jamie, the match never asked, pays the tax now on $250 a month; "Check the match ›" lands on the Roth row
  const j = migrate(jamie());
  j.retirement.workPlans = {};
  C.applyTaxChoice(j, "setup-contrib-setup-self", { choice: "now", nowEach: 250, laterEach: 0, period: "monthly", match: 0, today: T, ids, accountName: "Roth 401(k) at work" });
  const was = LV.answerOf(j, { today: T });
  const r = await renderPage(view, j, T, { computeOf: cOf, route: { rest: [], query: { match: "n-row" } } });
  const f = r.root.querySelector("form");
  f.querySelector('[name="employerMatch"]').value = "2040";
  f.reset = () => {};
  f.dispatch("submit");
  assert.equal(r.saved.length, 1);
  assert.equal(matchOf(r.saved[0], "setup-self"), 2040);
  assert.equal(r.saved[0].retirement.contributions.find((c) => c.id === "n-row").employerMatch, 0, "the match goes on a pay-the-tax-later row (B5)");
  const words = LV.answerChangeWords(was, LV.answerOf(r.saved[0], { today: T }), (n) => `$${Math.round(n)}`);
  assert.ok(words, "the answer moved");
  const t1 = (await renderPage(view, r.saved[0], T, { computeOf: cOf })).text();
  assert.match(t1, /Saved: Jamie's employer adds \$2,040 a year \(on the pay-the-tax-later row\)\. Your retirement answer: now /);
  assert.doesNotMatch(t1, /Saved: \$250 a month goes into/);
  // 2: Dana after a split ($270 later + $130 now) raises the later part to $470: both parts and the answer
  const q = split(dl(), DANA, { choice: "some", laterEach: 270, nowEach: 130, period: "monthly", match: 2400 });
  const open = async (plan) => {
    const x = await renderPage(view, plan, T, { computeOf: cOf });
    x.root.querySelectorAll("li").find((li) => /Dana's plan at work/.test(li.textContent)).click();
    const form = x.root.querySelector("form");
    form.reset = () => {};
    return { x, form };
  };
  const a = await open(q);
  a.form.querySelector('[name="amount"]').value = "470";
  a.form.dispatch("submit");
  assert.equal(a.x.saved.length, 1);
  const t2 = (await renderPage(view, a.x.saved[0], T, { computeOf: cOf })).text();
  assert.match(t2, /Saved: \$470 a month paying the tax later \(with the match\), \$130 a month paying it now\. Your retirement answer: /);
  // 3: the same split, money moved from one part to the other with the total kept ($200 + $200): the tax answer moved, so no
  // retirement answer (D-C3: the projection does not count the tax a pay-the-tax-later dollar saves today)
  const b = await open(q);
  b.form.querySelector('[name="amount"]').value = "200";
  b.form.querySelector('[name="nowAmount"]').value = "200";
  b.form.dispatch("submit");
  assert.equal(b.x.saved.length, 1);
  assert.equal(ownOf(b.x.saved[0], "setup-self"), ownOf(q, "setup-self"));
  const t3 = (await renderPage(view, b.x.saved[0], T, { computeOf: cOf })).text();
  assert.match(t3, /Saved: \$200 a month paying the tax later \(with the match\), \$200 a month paying it now\./);
  assert.doesNotMatch(t3, /Your retirement answer/);
});

// ---- review of 2026-11-12 (break critic B1, N2, N3, N5; money critic M8; break N1) ----
import { robin } from "../qa/fixtures/phone-households.mjs";
const twoJobs = () => {
  const p = migrate(robin());
  p.accounts.push({ id: "acme-roth", name: "Roth 401(k) at Acme", type: "roth", balance: 0, ownerId: "setup-self", history: [] });
  p.accounts.push({ id: "second-k", name: "401(k) at Second job", type: "401k", balance: 0, ownerId: "setup-self", history: [] });
  p.retirement.contributions.push({ id: "acme-row", accountId: "acme-roth", personId: "setup-self", amount: 200, period: "monthly", employerMatch: 0 });
  p.retirement.contributions.push({ id: "second-row", accountId: "second-k", personId: "setup-self", amount: 100, period: "monthly", employerMatch: 600 });
  return p;
};

test("B1: two jobs: a Roth 401(k) row tied to no job is not taken over by another job's row; every answer there leaves it as it is", () => {
  const p = twoJobs();
  const pair = C.taxPairOf(p, "second-row");
  assert.deepEqual([pair.jobs, pair.later.id, pair.now, pair.choice, pair.ownYearly], [2, "second-row", null, "later", 1200]);
  const acme = JSON.stringify(p.retirement.contributions.find((c) => c.id === "acme-row"));
  for (const opts of [{ choice: "later", laterEach: 300 }, { choice: "now", nowEach: 100 }, { choice: "some", laterEach: 60, nowEach: 40 }]) {
    const q = split(p, "second-row", { period: "monthly", match: 600, ...opts });
    assert.equal(JSON.stringify(q.retirement.contributions.find((c) => c.id === "acme-row")), acme, `${opts.choice}: Acme's row untouched`);
    // the Roth part of the second job is its own, named for that job and tied to it
    const mine = q.retirement.contributions.find((c) => c.id === "n-row");
    if (opts.nowEach) {
      assert.equal(mine.pairOf, "second-k");
      assert.equal(q.accounts.find((a) => a.id === mine.accountId).name, "401(k) at Second job (Roth part)");
      assert.equal(C.limitKind("roth", "401(k) at Second job (Roth part)", 0), "401k");
      // reopened, it reads as that job's pair
      assert.equal(C.taxPairOf(q, "n-row").laterAccount.id, "second-k");
    }
  }
  // the Roth row tied to no job, with several jobs, is not asked the question (it cannot be placed)
  assert.equal(C.taxPairOf(p, "acme-row"), null);
  // one job: the Roth 401(k) row on file is that job's pair (as before)
  const one = migrate(robin());
  one.accounts.push({ id: "r", name: "Roth 401(k) at work", type: "roth", balance: 0, ownerId: "setup-self", history: [] });
  one.retirement.contributions.push({ id: "rr", accountId: "r", personId: "setup-self", amount: 100, period: "monthly", employerMatch: 0 });
  assert.equal(C.taxPairOf(one, "setup-contrib-setup-self").now.id, "rr");
});

test("N2: a Roth account that was a Roth 401(k) only by its match keeps counting as one when the split moves the match: renamed, the own money unchanged", () => {
  const j = migrate(jamie());
  const acct = j.accounts.find((a) => a.id === j.retirement.contributions[0].accountId);
  acct.type = "roth"; acct.name = "Roth at Acme";
  j.retirement.contributions[0].employerMatch = 1500;
  assert.equal(C.limitKind("roth", "Roth at Acme", 1500), "401k");
  assert.equal(C.rothRenameOf(acct), "Roth at Acme (Roth 401(k))");
  assert.equal(C.rothRenameOf({ type: "roth", name: "Roth 401(k) at work" }), null);
  const before = ownOf(j, "setup-self");
  for (const opts of [{ choice: "some", laterEach: 100, nowEach: 150 }, { choice: "now", nowEach: 250 }]) {
    const q = split(j, j.retirement.contributions[0].id, { period: "monthly", match: 1500, ...opts });
    const roth = q.retirement.contributions.find((c) => q.accounts.find((a) => a.id === c.accountId)?.type === "roth");
    const name = q.accounts.find((a) => a.id === roth.accountId).name;
    assert.equal(name, "Roth at Acme (Roth 401(k))", opts.choice);
    assert.equal(C.limitKind("roth", name, roth.employerMatch), "401k");
    assert.equal(roth.employerMatch, 0);
    assert.equal(ownOf(q, "setup-self"), before, `${opts.choice}: the own money a year is unchanged`);
    assert.equal(matchOf(q, "setup-self"), 1500);
  }
});

test("N3: a tax answer saved with nothing going in keeps the row asked about at $0; it is never deleted by a save", () => {
  const j = migrate(jamie());
  const id = j.retirement.contributions[0].id;
  for (const choice of ["now", "some", "later"]) {
    const q = split(j, id, { choice, laterEach: 0, nowEach: 0, period: "monthly", match: 0 });
    assert.deepEqual(q.retirement.contributions.map((c) => [c.id, c.amount, c.employerMatch]), [[id, 0, 0]], choice);
  }
});

test("N3, N5 on the form: a changed tax answer with the box cleared is refused in words; an account changed with the tax answer is refused unless it is of the row's own kind", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const view = new URL("../modules/retirement/contributions/view.js", import.meta.url).href;
  const open = async (plan, re) => {
    const r = await renderPage(view, plan, T, { computeOf: { "overview/next-best-action": nba } });
    r.root.querySelectorAll("li").find((x) => re.test(x.textContent)).click();
    const f = r.root.querySelector("form"); f.reset = () => {};
    const btn = (t) => r.root.querySelectorAll("button").find((b) => b.textContent === t);
    btn("Change ›").click();
    return { r, f, btn };
  };
  const a = await open(migrate(jamie()), /Jamie's plan at work/);
  a.btn("Pay the tax now").click();
  a.f.querySelector('[name="amount"]').value = "";
  a.f.dispatch("submit");
  assert.equal(a.r.saved.length, 0);
  assert.match(a.r.text(), /Type how much goes in each time, like 250\./);
  // Dana's row moved to Lee's 401(k) while answering "Some of each": the account is applied to the row asked about (it was
  // dropped while the page said Saved, N5), and the Roth part follows it; the fold's line said it changed
  const b = await open(dl(), /Dana's plan at work/);
  b.btn("Some of each").click();
  b.f.querySelector('[name="nowAmount"]').value = "100";
  b.f.querySelector('[name="nowAmount"]').dispatch("change");
  const acct = b.f.querySelector('[name="accountId"]');
  acct.value = dl().accounts.find((x) => /Lee/.test(x.name) && x.type === "401k").id;
  acct.dispatch("change"); b.f.dispatch("change");   // (a change bubbles to the form on a page; the fake DOM does not bubble)
  // the account and whose are one quiet tap away when a row is edited (simple first), and the fold says when one changed
  assert.match(b.r.text(), /More options ?changed/);
  b.f.dispatch("submit");
  assert.equal(b.r.saved.length, 1);
  const s1 = b.r.saved[0];
  const leeK = dl().accounts.find((x) => /Lee/.test(x.name) && x.type === "401k").id;
  const later = s1.retirement.contributions.find((c) => c.id === DANA);
  assert.equal(later.accountId, leeK);
  assert.equal(s1.retirement.contributions.find((c) => c.id === "n-row" || (c.personId === "setup-self" && c.id !== DANA))?.pairOf, leeK);
  assert.match((await renderPage(view, s1, T, { computeOf: { "overview/next-best-action": nba } })).text(), /It now goes into Lee's plan at work\./);
  // an account of another kind with the tax answer: refused in words, nothing saved
  const j = migrate(jamie());
  j.accounts.push({ id: "j-roth-ira", name: "Jamie's Roth IRA", type: "roth", balance: 0, ownerId: "setup-self", history: [] });
  const c = await open(j, /Jamie's plan at work/);
  c.btn("Some of each").click();
  c.f.querySelector('[name="nowAmount"]').value = "50";
  c.f.querySelector('[name="accountId"]').value = "j-roth-ira";
  c.f.dispatch("submit");
  assert.equal(c.r.saved.length, 0);
  assert.match(c.r.text(), /Change the account on its own first: save that, then answer the tax question\./);
});

test("M8: Work benefits gives the reason that is true: all of it Roth, the pay drops by the same; part, less tax on the before-tax part; none, less tax comes out", async () => {
  const { costWords, allRoth } = await import("../modules/career/benefits/view.js");
  const money = (n) => `$${Math.round(n)}`;
  const o = (roth, yearly, costFrom = "paycheck") => ({ roth, yearly, costPerCheck: 180, costFrom });
  assert.equal(allRoth(o(4680, 4680)), true);
  assert.equal(costWords(o(4680, 4680), money), "it goes in after tax, so your take-home pay drops by the same $180");
  assert.equal(costWords(o(1560, 4680), money), "less tax comes out on the part that goes in before tax, so your take-home pay drops by $180");
  assert.equal(costWords(o(0, 4680), money), "because less tax comes out, your take-home pay drops by only $180");
  assert.equal(costWords(o(0, 4680, "budget"), money), "after the tax it saves, it costs you $180");
});

test("N1: 'Use N%' on Work benefits after a split: the person's own money a year is the choice, never above the year's limit; the Roth part kept in dollars", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const view = new URL("../modules/career/benefits/view.js", import.meta.url).href;
  const q = split(dl(), DANA, { choice: "some", laterEach: 260, nowEach: 130, period: "monthly", match: 2400 });
  const r = await renderPage(view, q, T, { computeOf: { "overview/next-best-action": nba } });
  const k = benefits(q, { today: T });
  const options = k.k401.options.filter((x) => x.key !== "now");
  const uses = r.root.querySelectorAll("button").filter((b) => /^(Use|Start it at) /.test(b.textContent));
  assert.equal(uses.length, options.length, "one Use button a choice");
  uses.at(-1).click();
  assert.equal(r.saved.length, 1);
  const own = ownOf(r.saved[0], "setup-self");
  assert.ok(Math.abs(own - options.at(-1).yearly) <= 1, `own ${own} = the choice ${options.at(-1).yearly}`);
  // never above the limit, not by a cent (review 2026-11-13, F2: 1,911.67 a month made 24,500.04 and Contributions warned)
  assert.ok(own <= k.k401.limit + 1e-6, `own ${own} within the limit ${k.k401.limit}`);
  assert.equal(r.saved[0].retirement.contributions.find((c) => c.id === "n-row").amount, 130, "the Roth part kept in dollars");
  const con = C.compute(r.saved[0], { today: T });
  assert.deepEqual(con.warnings.filter((w) => /over the \d+ limit/.test(w)), []);
  const l = con.byPerson.find((x) => x.personId === "setup-self").limits.find((x) => x.kind === "401k");
  assert.equal(l.over, 0);
});

test("F2 (review 2026-11-13): the most a year on Work benefits never lands above the limit by cents, split or not; the limit check itself stays exact (a cent over is over, the answer key's rule)", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const view = new URL("../modules/career/benefits/view.js", import.meta.url).href;
  // a plain row (no split): 24,500 / 12 = 2,041.67 to the nearest cent would be 24,500.04 a year
  const r = await renderPage(view, dl(), T, { computeOf: { "overview/next-best-action": nba } });
  const k = benefits(dl(), { today: T });
  r.root.querySelectorAll("button").filter((b) => /^(Use|Start it at) /.test(b.textContent)).at(-1).click();
  const row = r.saved[0].retirement.contributions.find((c) => c.id === DANA);
  assert.equal(k.k401.options.at(-1).yearly, k.k401.limit);
  assert.equal(row.amount, 2041.66, "down to the cent at the limit");
  assert.ok(ownOf(r.saved[0], "setup-self") <= k.k401.limit);
  // below the limit the nearest cent stays: 6% of $78,000 is $390 a month
  const r6 = await renderPage(view, dl(), T, { computeOf: { "overview/next-best-action": nba } });
  const six = r6.root.querySelectorAll("button").find((b) => /^Use 6%/.test(b.textContent));
  six.click();
  assert.equal(r6.saved[0].retirement.contributions.find((c) => c.id === DANA).amount, 390);
  // the limit check stays exact (tests/golden/retirement/briefs/contributions.md: "warn strictly above; equality is allowed",
  // a cent either side of the cap), which is why the payments above go down to the cent: $1,911.67 a month would be over
  const at = (later) => { const q = split(dl(), DANA, { choice: "some", laterEach: later, nowEach: 130, period: "monthly", match: 2400 }); return C.compute(q, { today: T }); };
  const lim = (d) => d.byPerson.find((x) => x.personId === "setup-self").limits.find((x) => x.kind === "401k");
  assert.ok(lim(at(1911.67)).over > 0.03 && lim(at(1911.67)).over < 0.05);
  assert.equal(lim(at(1911.66)).over, 0);
  assert.deepEqual(at(1911.66).warnings.filter((w) => /over the \d+ limit/.test(w)), []);
});
