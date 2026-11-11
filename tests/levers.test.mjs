// tests/levers.test.mjs -- "What this rests on" (modules/retirement/levers.js; owner's request 2026-11-11, spec part A): the tags,
// the effects (said = done: each equals a copy changed by hand and run through buildInputs and project), the size and order of the
// rows, the hide rule, the five shown and the fold, the usual figures equal to the guesses', and that nothing is changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as LV from "../modules/retirement/levers.js";
import { buildInputs, saveSpendingFigure, compute as projection, savingsUnknown } from "../modules/retirement/projection/compute.js";
import { project } from "../core/math/retirement.js";
import { migrate } from "../core/schema/migrate.js";
import { compute as nbaCompute } from "../modules/overview/next-best-action/compute.js";
import { estimate, mergeEstimators } from "../core/estimate/index.js";
import { estimators as guessEstimators, TABLES } from "../modules/overview/guesses/compute.js";
import { estimators as setupEstimators } from "../modules/overview/setup/compute.js";
import { usualShare, jobPayOf, matchTerms } from "../modules/overview/guesses/estimators/saving.js";
import { danaLee, jamie, casey, robin, morgan } from "../qa/fixtures/phone-households.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-11";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const plans = { danaLee: () => migrate(danaLee()), jamie: () => migrate(jamie()), casey: () => migrate(casey()), robin: () => migrate(robin()), morgan: () => migrate(morgan()) };
const spareOf = (plan) => { const n = nbaCompute(plan, { today: T }); return n.ready ? n.spare : null; };
const rowsOf = (plan) => LV.leverRows(plan, { today: T, spare: spareOf(plan) });
const all = (r) => [...r.shown, ...r.folded, ...r.hidden];
const row = (r, key) => all(r).find((x) => x.key === key);
const byHand = (plan, change) => { const p = structuredClone(plan); change(p); return LV.outcomeOf(buildInputs(p, { today: T }).inputs); };
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };

test("tags on the phone-built households: Jamie's no match is Yours, Robin's match our guess, Casey's None Yours, Morgan has no work row", () => {
  const J = rowsOf(plans.jamie());
  const jm = all(J).find((x) => x.key.startsWith("match:"));
  assert.equal(jm.tag, "yours"); assert.equal(jm.value, "No match on file (you said so)");
  const R = rowsOf(plans.robin());
  assert.equal(all(R).find((x) => x.key.startsWith("match:")).tag, "guess");
  const C = rowsOf(plans.casey());
  const cw = row(C, "work-saving:setup-self");
  assert.ok(cw, "a work-saving row for Casey");
  assert.equal(cw.tag, "yours"); assert.equal(cw.value, "nothing (you said so)");
  assert.equal(all(C).some((x) => x.key.startsWith("match:")), false, "no match row while nothing goes in (D-A5)");
  const M = rowsOf(plans.morgan());
  assert.equal(all(M).some((x) => x.key.startsWith("work-saving:") || x.key.startsWith("match:")), false, "no plan at work, no work row");
  // spending and Social Security are our guesses on every phone-built plan; growth and prices the usual figures (never reviewed)
  for (const r of [J, R, C, M]) {
    assert.equal(row(r, "spending").tag, "guess");
    assert.equal(row(r, "ss:setup-self").tag, "guess");
    assert.equal(row(r, "growth").tag, "usual");
    assert.equal(row(r, "prices").tag, "usual");
    assert.equal(row(r, "leftover").tag, "missing");
  }
});

test("said = done: each effect equals the copy changed by hand, run through buildInputs and project", () => {
  for (const [name, mk] of Object.entries(plans)) {
    const plan = mk();
    const r = rowsOf(plan);
    const base = LV.outcomeOf(buildInputs(plan, { today: T }).inputs);
    assert.deepEqual(r.base, base, `${name}: the answer as it is`);
    const d = projection(plan, { today: T });
    assert.equal(base.lasts, d.result.success, `${name}: the page's own answer`);
    if (!base.lasts) assert.equal(base.age, d.shortAge);
    const check = (key, i, change) => { const x = row(r, key); if (!x) return; assert.deepEqual(x.outs[i], byHand(plan, change), `${name}: ${key} #${i}`); };
    check("growth", 0, (p) => { p.assumptions.returnStocks = 0.06; });
    check("growth", 1, (p) => { p.assumptions.returnStocks = 0.08; });
    check("prices", 0, (p) => { p.assumptions.inflation = 0.025; });
    check("prices", 1, (p) => { p.assumptions.inflation = 0.04; });
    check("stop:setup-self", 0, (p) => { p.household.people.find((q) => q.id === "setup-self").retirementAge = Math.min(75, (p.household.people.find((q) => q.id === "setup-self").retirementAge ?? 65) + 2); });
    check("ss:setup-self", 0, (p) => { p.retirement.socialSecurity["setup-self"] = { ...(p.retirement.socialSecurity["setup-self"] ?? {}), claimAge: 70 }; });
    check("plan-to", 0, (p) => { p.assumptions.planEndAge = 100; });
    check("mix", 0, (p) => { p.retirement.stocksRetired = 0.3; });
    check("mix", 1, (p) => { p.retirement.stocksRetired = 0.7; });
    // spending 10% less, saved the way Retirement settings saves it
    const fig = buildInputs(plan, { today: T }).figureMonthly;
    check("spending", 0, (p) => saveSpendingFigure(p, Math.round(fig * 0.9), fig));
    // the money left over, as a monthly row into a new account of the lead earner's (L4 writes the same row)
    const lo = row(r, "leftover");
    if (lo) {
      const add = (type) => (p) => { p.accounts.push({ id: "x", name: "x", type, balance: 0, ownerId: lo.leadId, history: [] }); p.retirement.contributions.push({ id: "y", accountId: "x", personId: lo.leadId, amount: lo.amount, period: "monthly", employerMatch: 0 }); };
      check("leftover", 0, add("brokerage"));
      check("leftover", 1, add("savings"));
    }
    // the match: the usual figure on the row itself
    for (const x of all(r).filter((y) => y.key.startsWith("match:") && y.alts.length)) {
      const id = x.key.slice(6), pid = "setup-self";
      const own = LV.workRows(plan, plan.retirement.contributions.find((c) => c.id === id).personId).reduce((t, { c }) => t + Number(c.amount) * 12, 0);
      check(x.key, 0, (p) => { p.retirement.contributions.find((c) => c.id === id).employerMatch = LV.usualMatchAt(plan, plan.retirement.contributions.find((c) => c.id === id).personId ?? pid, T, own); });
    }
  }
});

test("Casey: nothing goes in, so the work row is the usual share of pay plus the usual match, never the match alone (D-A5)", () => {
  const plan = plans.casey();
  const alt = LV.workAlt(plan, "setup-self", { today: T });
  const share = usualShare(plan, "setup-self", T), pay = jobPayOf(plan, "setup-self", T);
  assert.equal(alt.kind, "usual");
  assert.equal(alt.share, share);
  assert.equal(alt.monthly, Math.round(share * pay / 12 * 100) / 100, "the share of pay, a month, to the cent (what typing it as a share on Contributions saves)");
  assert.ok(alt.monthly > 0 && alt.match > 0, "own money and the match together");
  const x = row(rowsOf(plan), "work-saving:setup-self");
  assert.match(x.alts[0].say, /^6\.6% of pay plus the usual match$/);
  // the copy: the $0 row itself carries both
  assert.deepEqual(x.outs[0], byHand(plan, (p) => { const c = p.retirement.contributions[0]; c.amount = alt.monthly; c.period = "monthly"; c.employerMatch = alt.match; }));
  // never the match alone: no alternative of any row puts a match on a row with nothing of the person's own going in
  for (const mk of Object.values(plans)) {
    const p0 = mk();
    for (const x of all(rowsOf(p0))) for (const alt2 of x.alts) {
      const q = structuredClone(p0); alt2.change(q);
      for (const c of q.retirement.contributions) if (Number(c.employerMatch) > 0 && !p0.retirement.contributions.some((o) => o.id === c.id && Number(o.employerMatch) === Number(c.employerMatch))) assert.ok(Number(c.amount) > 0, `${x.key}: a match with money going in`);
    }
  }
  // said "No match": the usual share only
  const noMatch = structuredClone(plan); noMatch.retirement.workPlans["setup-self"].match = false;
  assert.equal(LV.workAlt(noMatch, "setup-self", { today: T }).match, 0);
});

test("the usual share and the usual match equal the guesses' own (Vanguard, How America Saves 2026; D-A4)", () => {
  const REG = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }]);
  for (const name of ["jamie", "casey", "robin", "danaLee"]) {
    const plan = plans[name]();
    for (const c of plan.retirement.contributions) {
      const pid = c.personId;
      const g = estimate(plan, "contrib.amount", { estimators: REG.estimators, tables: REG.tables, today: T, path: `retirement.contributions[${c.id}].amount` });
      if (g?.uses?.rate) assert.equal(usualShare(plan, pid, T), g.uses.rate, `${name}: the share`);
      const m = estimate(plan, "contrib.match", { estimators: REG.estimators, tables: REG.tables, today: T, path: `retirement.contributions[${c.id}].employerMatch` });
      if (m && plan.retirement.workPlans?.[pid]?.match !== false && Number(c.amount) > 0) assert.equal(LV.usualMatchAt(plan, pid, T, Number(c.amount) * 12), m.value, `${name}: the match`);
    }
  }
  assert.deepEqual(matchTerms(), { value: 0.04, needed: 0.06 }, "the median match is worth 4% of pay and takes 6% in");
});

test("size and order (D-A2): not counted, our guesses, usual figures, yours; by size within each; five shown; small ones hidden", () => {
  const r = rowsOf(plans.jamie());
  assert.equal(r.shown.length, LV.SHOWN);
  assert.equal(r.shown[0].key, "leftover", "the money left over first: not counted, and the biggest");
  assert.equal(r.shown[1].key.startsWith("match:"), true, "a zero the person gave (no match) is listed with the not-counted rows (builder's reading)");
  const groups = { missing: 0, guess: 1, usual: 2, yours: 3 };
  const g = (x) => (x.tag === "yours" && x.zero && Math.abs(x.score) >= 1 ? 0 : groups[x.tag]);
  const order = [...r.shown, ...r.folded];
  for (let i = 1; i < order.length; i++) {
    if (order[i].foldOnly || order[i - 1].foldOnly) continue;
    assert.ok(g(order[i - 1]) < g(order[i]) || (g(order[i - 1]) === g(order[i]) && Math.abs(order[i - 1].score) >= Math.abs(order[i].score)), `${order[i - 1].key} before ${order[i].key}`);
  }
  // the score: years, from the run-out ages (Jamie: 70 now, 89 invested)
  assert.equal(row(r, "leftover").score, 89 - 70);
  assert.equal(LV.scoreOf({ lasts: true, endAge: 95, endReal: 0 }, { lasts: false, age: 70 }, 1), 96 - 70);
  assert.equal(LV.scoreOf({ lasts: true, endAge: 95, endReal: 120000 }, { lasts: true, endAge: 95, endReal: 60000 }, 30000), 2, "both last: the money left over a year of spending");
  // hidden: yours or usual under a year, never growth or prices
  for (const x of r.hidden) { assert.ok(x.tag === "yours" || x.tag === "usual"); assert.ok(Math.abs(x.score) < 1); assert.ok(x.key !== "growth" && x.key !== "prices"); }
  assert.ok(all(r).some((x) => x.key === "growth") && all(r).some((x) => x.key === "prices"), "growth and prices always listed");
  assert.equal(r.shown.some((x) => x.key === "mix"), false, "the share in stocks is in the fold only");
  // the hero's line, worked out at once
  assert.equal(LV.restsOnWords(LV.leverList(plans.jamie(), { today: T, spare: spareOf(plans.jamie()) })), "This answer rests on 9 numbers: 2 you gave us, 2 our guesses, 5 usual figures. 1 thing is not counted yet: the $567 left over each month.");
});

test("returns are never offered as a fix: the growth row checks, shows both ways and says nobody can choose it (D-A7)", () => {
  for (const mk of Object.values(plans)) {
    const r = rowsOf(mk());
    for (const x of all(r)) for (const a of x.acts) assert.doesNotMatch(a.label, /raise|higher return|more return/i);
    const g = row(r, "growth");
    if (!g) continue;
    assert.deepEqual(g.acts.map((a) => a.label), ["Check ›"]);
    assert.deepEqual(g.alts.map((a) => a.say), ["Careful 6%", "Hopeful 8%"]);
    assert.match(g.note, /Nobody can choose this/);
  }
});

test("a plan with nothing saved and nothing going in (Sam) shows only what is not counted, said as questions", () => {
  const plan = personas.finishSetup("sam", personas.sam(T), T);
  assert.equal(savingsUnknown(projection(plan, { today: T })), true);
  const r = rowsOf(plan);
  assert.ok(all(r).length >= 2);
  for (const x of all(r)) assert.equal(x.tag, "missing", x.key);
  assert.equal(r.shown[0].value, "Nothing is saved for retirement yet, and nothing goes in.");
  const lo = row(r, "leftover");
  assert.match(lo.effects[0], /^If it were invested: it would last to the end \(age \d+\)\.$/);
  for (const e of lo.effects) assert.doesNotMatch(e, /\$0 \/ \$0/);
});

test("leverRows never changes the plan it is given (deep-frozen), and the leftover row needs Next best action's month handed in", () => {
  for (const mk of [...Object.values(plans), () => familyPlan(T)]) {
    const plan = deepFreeze(mk());
    const json = JSON.stringify(plan);
    const r = LV.leverRows(plan, { today: T, spare: spareOf(plan) });
    assert.ok(r.ready);
    for (const x of all(r)) for (const o of x.outs ?? []) assert.ok(o !== null, `${x.key}: worked out on a copy`);
    assert.equal(JSON.stringify(plan), json);
  }
  assert.equal(LV.leverList(plans.jamie(), { today: T }).rows.some((x) => x.key === "leftover"), false, "no spare, no leftover row");
  const src = fs.readFileSync(path.join(ROOT, "modules/retirement/levers.js"), "utf8");
  assert.doesNotMatch(src, /next-best-action/, "levers.js must not import Next best action (it imports savingVerdict: a loop)");
});

test("Before your change: the lever whose value moved is named", () => {
  const a = LV.leverList(plans.jamie(), { today: T });
  const p = plans.jamie(); p.assumptions.returnStocks = 0.06;
  const b = LV.leverList(p, { today: T });
  assert.deepEqual(LV.changedWords(LV.valuesOf(a), LV.valuesOf(b)), ["how fast investments grow (7% → 6%)"]);
  assert.equal(LV.answerWords({ lasts: false, age: 66 }), "runs out at 66");
  assert.equal(LV.answerWords({ lasts: true, endAge: 95, endReal: 0 }), "lasts to the end (age 95)");
});

// every qa fixture and every qa household (the 14 types): nothing throws and every effect is a finite answer
async function everyPlan() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `${f}:${name}`, plan: migrate(fn()) });
  }
  for (const [name, mk] of Object.entries(plans)) out.push({ name: `phone ${name}`, plan: mk() });
  for (const a of ARCHETYPES) out.push({ name: `household ${a.id}`, plan: migrate(a.build()) });
  return out;
}
test("every qa fixture and household: leverRows does not throw and every effect is finite", async () => {
  const list = await everyPlan();
  assert.ok(list.length >= 30, `${list.length} plans`);
  for (const { name, plan } of list) {
    let r;
    assert.doesNotThrow(() => { r = LV.leverRows(plan, { today: T, spare: spareOf(plan) }); }, name);
    if (!r.ready) continue;
    for (const x of all(r)) {
      assert.ok(Number.isFinite(x.score), `${name}: ${x.key} score`);
      for (const o of x.outs ?? []) if (o) assert.ok(o.lasts ? Number.isFinite(o.endReal) && Number.isFinite(o.endAge) : Number.isFinite(o.age), `${name}: ${x.key}`);
      for (const e of x.effects ?? []) assert.doesNotMatch(e, /NaN|undefined|null|Infinity/, `${name}: ${x.key}: ${e}`);
      assert.doesNotMatch(`${x.label} ${x.value}`, /NaN|undefined|null/, `${name}: ${x.key}`);
    }
  }
});

test("?check=1 lands on the card once per arrival: open, scrolled to, its heading focused (spec part D)", async () => {
  const { renderPage, FakeElement } = await import("../qa/fixtures/fake-dom.mjs");
  const calls = [];
  const was = { scroll: FakeElement.prototype.scrollIntoView, focus: FakeElement.prototype.focus };
  FakeElement.prototype.scrollIntoView = function () { calls.push(["scroll", this]); };
  FakeElement.prototype.focus = function () { calls.push(["focus", this]); };
  try {
    const url = pathToFileURL(path.join(ROOT, "modules/retirement/projection/view.js")).href;
    const route = { rest: [], query: { check: "1" } };
    const r = await renderPage(url, jamie(), T, { route, computeOf: { "overview/next-best-action": nbaCompute } });
    await new Promise((res) => setTimeout(res, 20));
    const card = r.root.querySelectorAll(".lv")[0];
    assert.ok(card, "the card is on the page");
    assert.equal(calls.filter(([k, el]) => k === "scroll" && el === card).length, 1, "brought into view once");
    assert.equal(calls.filter(([k, el]) => k === "focus" && el === card.__head).length, 1, "its heading focused");
    assert.match(r.text(), /This answer rests on 9 numbers/);
    assert.match(r.text(), /Check the numbers behind this ↓/);
    // the same arrival drawn again (a save on this page): not brought back
    calls.length = 0;
    await renderPage(url, jamie(), T, { route, computeOf: { "overview/next-best-action": nbaCompute } });
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(calls.filter(([k]) => k === "scroll").length, 0);
    // no ?check: nothing scrolls
    await renderPage(url, jamie(), T, { route: { rest: [], query: {} }, computeOf: { "overview/next-best-action": nbaCompute } });
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(calls.filter(([k]) => k === "scroll").length, 0);
  } finally { Object.assign(FakeElement.prototype, { scrollIntoView: was.scroll, focus: was.focus }); }
});

test("the page's one filled button is 'Check the numbers behind this'; with nothing saved, 'Add what you own' stays the filled one", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const url = pathToFileURL(path.join(ROOT, "modules/retirement/projection/view.js")).href;
  const filled = (root) => root.all().filter((e) => (e.tagName === "BUTTON" || /\bbtn\b/.test(e.className)) && !/\bsecondary\b/.test(e.className) && e.getAttribute("type") !== "submit").map((e) => e.textContent);
  const j = await renderPage(url, jamie(), T, { computeOf: { "overview/next-best-action": nbaCompute } });
  assert.deepEqual(filled(j.root), ["Check the numbers behind this ↓"]);
  const sam = personas.finishSetup("sam", personas.sam(T), T);
  const s = await renderPage(url, sam, T, { computeOf: { "overview/next-best-action": nbaCompute } });
  assert.deepEqual(filled(s.root), ["Add what you own ›"]);
  assert.match(s.text(), /Check the numbers behind this ↓/);
  // the go-deeper questions and the two range pages are links, outlined
  for (const t of ["What matters most? ›", "Try two plans side by side ›", "What if history repeated? ›", "If history repeated ›"]) assert.ok(j.root.all().some((e) => e.tagName === "A" && e.textContent === t && /secondary/.test(e.className)), t);
  assert.doesNotMatch(j.text(), /Two more pages, Chance the money lasts and If history repeated, show/);
});

// ---- L3: where the card's links land on Contributions, the match check, the answer after a save ----
test("L3 workLanding: filled only when nothing of one's own goes in (Casey), with the change the card ran; else the row as it is", () => {
  const c = plans.casey();
  const w = LV.workLanding(c, "setup-self", { today: T });
  assert.deepEqual([w.rowId, w.fill, w.values], ["setup-contrib-setup-self", true, { amount: 396, period: "monthly", employerMatch: 2880 }]);
  // said = done: those boxes saved over the row are the change the card ran
  const asSaved = byHand(c, (p) => { const r = p.retirement.contributions.find((x) => x.id === w.rowId); Object.assign(r, w.values); });
  assert.deepEqual(asSaved, byHand(c, (p) => LV.applyWorkAlt(p, "setup-self", w.alt)));
  const j = LV.workLanding(plans.jamie(), "setup-self", { today: T });
  assert.deepEqual([j.rowId, j.fill, j.values, j.alt.kind], ["setup-contrib-setup-self", false, null, "more"]);
  // no plan at work: nothing to try, nothing to fill
  const m = LV.workLanding(plans.morgan(), "setup-self", { today: T });
  assert.deepEqual([m.alt, m.rowId, m.accountId, m.fill], [null, null, null, false]);
});

test("L3 matchLanding and matchChecks: the usual match at what goes in now; asked only when own money goes in, no match, never answered", () => {
  const j = plans.jamie();
  const ml = LV.matchLanding(j, "setup-contrib-setup-self", { today: T });
  assert.deepEqual([ml.pid, ml.usual, ml.typed, ml.said], ["setup-self", 2040, false, false]);
  assert.equal(ml.usual, LV.usualMatchAt(j, "setup-self", T, 3000));
  assert.equal(LV.matchLanding(j, "no-such-row", { today: T }), null);
  assert.deepEqual(LV.matchChecks(j, { today: T }), [], "Jamie said there is no match");
  const never = plans.jamie(); delete never.retirement.workPlans["setup-self"].match;
  assert.deepEqual(LV.matchChecks(never, { today: T }).map((x) => [x.rowId, x.pid, x.usual, x.name]), [["setup-contrib-setup-self", "setup-self", 2040, "Jamie"]]);
  assert.deepEqual(LV.matchChecks(plans.robin(), { today: T }), [], "Robin's match is our guess: the card says so, no question");
  assert.deepEqual(LV.matchChecks(plans.casey(), { today: T }), [], "nothing of Casey's own goes in: the work row asks, not the match");
  const zero = plans.jamie(); delete zero.retirement.workPlans["setup-self"].match; zero.retirement.contributions[0].amount = 0;
  assert.deepEqual(LV.matchChecks(zero, { today: T }), []);
});

test("L3 answerChangeWords: the answer after a save beside the one before it", () => {
  const out = (age) => ({ lasts: false, age, endAge: 95, endReal: 0 }), last = (endReal) => ({ lasts: true, age: null, endAge: 95, endReal });
  assert.equal(LV.answerChangeWords(out(66), out(76)), "now runs out at 76 (was 66)");
  assert.equal(LV.answerChangeWords(out(70), out(70)), "still runs out at 70");
  assert.equal(LV.answerChangeWords(out(70), out(70), undefined, { still: false }), "");
  assert.equal(LV.answerChangeWords(out(66), last(5000)), "now lasts to the end, age 95 (was: runs out at 66)");
  assert.equal(LV.answerChangeWords(last(5000), out(90)), "now runs out at 90 (it lasted to the end before)");
  // (an answer that lasts both times is never "still": review 2026-11-12, P6; tests/levers-leftover.test.mjs)
  assert.equal(LV.answerChangeWords(last(100000), last(141000)), "lasts to the end, with about $41,000 more left at 95 (today's dollars)");
  assert.equal(LV.answerChangeWords(last(100000), last(100040)), "lasts to the end, with about the same left at 95");
  assert.equal(LV.answerChangeWords(null, out(70)), "");
});

// ---- L4: the money left over each month, answered in place (spec part B, D-B1 to D-B7) ----
const leftRow = (plan) => row(rowsOf(plan), "leftover");
const answer = (plan, opts) => { const p = structuredClone(plan); LV.applyLeftover(p, { today: T, personId: "setup-self", ...opts }); return p; };

test("L4 applyLeftover: one ordinary monthly row of the amount, the lead earner's, into a new $0 account or one on file; spend writes none", () => {
  const p = plans.danaLee();
  const inv = answer(p, { answer: "invest", monthly: 1828.4, amount: 1820, newAccount: { id: "acct-new", name: "Investments for later", type: "brokerage" } });
  assert.deepEqual(inv.retirement.leftover, { answer: "invest", on: T, monthly: 1828.4, rowId: "leftover-1" });
  assert.deepEqual(inv.retirement.contributions.at(-1), { id: "leftover-1", accountId: "acct-new", personId: "setup-self", amount: 1820, period: "monthly", employerMatch: 0 });
  assert.deepEqual(inv.accounts.at(-1), { id: "acct-new", name: "Investments for later", type: "brokerage", balance: 0, asOf: T, ownerId: "setup-self", history: [] });
  assert.equal(inv.retirement.contributions.length, p.retirement.contributions.length + 1);
  // answered again: the earlier row goes, the new one takes its place (into a savings account on file)
  inv.accounts.push({ id: "a-sav", name: "Rainy day", type: "savings", balance: 5000, ownerId: "", history: [] });
  const bank = structuredClone(inv); LV.applyLeftover(bank, { answer: "bank", monthly: 1828.4, amount: 1000, accountId: "a-sav", personId: "setup-self", today: T });
  assert.deepEqual(bank.retirement.contributions.filter((c) => /^leftover-/.test(c.id)).map((c) => [c.id, c.accountId, c.amount]), [["leftover-1", "a-sav", 1000]]);
  assert.equal(bank.accounts.length, inv.accounts.length, "no new account when one on file is picked");
  const spend = structuredClone(inv); LV.applyLeftover(spend, { answer: "spend", monthly: 1828.4, today: T });
  assert.deepEqual(spend.retirement.leftover, { answer: "spend", on: T, monthly: 1828.4 });
  assert.equal(spend.retirement.contributions.length, p.retirement.contributions.length, "spend: no row, and the earlier one is gone");
  assert.ok(LV.leftoverAccounts(bank, "bank").some((a) => a.id === "a-sav") && LV.leftoverAccounts(bank, "bank").every((a) => a.type === "savings"));
  assert.equal(LV.leftoverAccounts(bank, "invest").map((a) => a.id).join(), "acct-new");
});

test("L4 said = done: the answer saved gives the card's effect; invested, Next best action's left-over drops by the amount; in the bank, it stays; nothing counted twice", () => {
  for (const k of ["danaLee", "jamie"]) {
    const p = plans[k]();
    const r = leftRow(p);
    assert.equal(r.tag, "missing");
    const before = nbaCompute(p, { today: T }).spare.monthly;
    for (const [i, a, type] of [[0, "invest", "brokerage"], [1, "bank", "savings"]]) {
      const q = answer(p, { answer: a, monthly: r.total, amount: r.amount, newAccount: { id: `n-${a}`, name: "x", type } });
      assert.deepEqual(LV.answerOf(q, { today: T }), r.outs[i], `${k} ${a}: the verdict after the save is the card's`);
      // invested, it is saving out of pay and comes off the month; in the bank it stays in checking and savings (M3)
      assert.ok(Math.abs(nbaCompute(q, { today: T }).spare.monthly - (before - (a === "bank" ? 0 : r.amount))) < 0.01, `${k} ${a}: the left-over after`);
    }
    // spend changes nothing the answer rests on
    assert.deepEqual(LV.answerOf(answer(p, { answer: "spend", monthly: r.total }), { today: T }), LV.answerOf(p, { today: T }));
  }
  // Dana & Lee's acceptance figures: $1,828 left over, $1,820 the amount
  const d = leftRow(plans.danaLee());
  assert.deepEqual([d.value, d.amount, d.leadId], ["$1,828 a month", 1820, "setup-self"]);
  assert.match(d.effects.join(" "), /^If it's invested: lasts to the end, with about \$[\d,]+ more left at 97 \(today's dollars\)\. If it piles up in the bank: lasts to the end, with about \$[\d,]+ more left at 97 \(today's dollars\)\. As it is, counted as spent: lasts to the end \(age 97\)\.$/);
});

test("L4 the bank row lands in the cash bucket at the cash rate, and every row stops when the lead earner stops work", () => {
  const p = plans.jamie();
  const r = leftRow(p);
  const q = answer(p, { answer: "bank", monthly: r.total, amount: r.amount, newAccount: { id: "n-bank", name: "Savings for later", type: "savings" } });
  const I = buildInputs(q, { today: T }).inputs;
  const c = I.contributions.find((x) => x.name === "Savings for later");
  assert.deepEqual([c.bucket, c.yearly, c.personIndex], ["cash", r.amount * 12, 0]);
  const a = project(buildInputs(p, { today: T }).inputs).rows, b = project(I).rows;
  const retireAge = I.people[0].retireAge;
  for (let i = 0; i < a.length; i++) {
    const added = b[i].contributions - a[i].contributions;
    if (a[i].ages[0] < retireAge) assert.ok(added > 0, `${a[i].year}: the row goes in while Jamie works`);
    else assert.ok(Math.abs(added) < 1e-6, `${a[i].year}: nothing after ${retireAge}`);
  }
  // the cash it builds grows at the plan's cash rate, not the stocks' (the bank answer's effect is smaller than investing it)
  assert.ok(r.outs[1].age < r.outs[0].age);
});

test("L4 the row reads the answer: Yours, what was saved; spend keeps both effects; a removed row is asked again", () => {
  const p = plans.jamie(), r = leftRow(p);
  const inv = answer(p, { answer: "invest", monthly: r.total, amount: 560, newAccount: { id: "n-inv", name: "Investments for later", type: "brokerage" } });
  const a = leftRow(inv);
  assert.equal(a.tag, "yours");
  assert.equal(a.value, "$560 a month into Investments for later, invested (you said so)");
  // part of it: the rest is said, with what investing it too would do
  const part = leftRow(answer(p, { answer: "invest", monthly: r.total, amount: 300, newAccount: { id: "n-inv", name: "Investments for later", type: "brokerage" } }));
  assert.equal(part.value, "$300 a month into Investments for later, invested (you said so); $267 a month more is left over");
  assert.match(part.effects[0], /^If \$260 a month of that were invested too: /);
  assert.deepEqual(a.acts.map((x) => x.label), ["Change my answer"]);
  // the one row the card writes is never hidden by the less-than-a-year rule (Dana & Lee: all of it invested, nothing more to try)
  const dl = plans.danaLee(), dlr = leftRow(dl);
  const dlAll = rowsOf(answer(dl, { answer: "invest", monthly: dlr.total, amount: dlr.amount, newAccount: { id: "n-inv", name: "Investments for later", type: "brokerage" } }));
  assert.ok([...dlAll.shown, ...dlAll.folded].some((x) => x.key === "leftover") && !dlAll.hidden.some((x) => x.key === "leftover"));
  assert.ok(!LV.leverList(inv, { today: T, spare: spareOf(inv) }).missing.some((m) => /left over/.test(m)), "no longer 'not counted'");
  const s = answer(p, { answer: "spend", monthly: r.total });
  const sp = leftRow(s);
  assert.equal(sp.tag, "yours");
  assert.match(sp.value, /^Spent \(you said so\); \$567 a month/);
  assert.deepEqual(sp.effects.slice(0, 2), r.effects.slice(0, 2), "the same two effects as before the answer");
  // the row removed on Contributions: asked again, as if never answered (spec acceptance 5)
  const gone = structuredClone(inv); gone.retirement.contributions = gone.retirement.contributions.filter((c) => c.id !== "leftover-1");
  assert.equal(LV.leftoverAnswer(gone), null);
  assert.deepEqual([leftRow(gone).tag, leftRow(gone).value], ["missing", "$567 a month"]);
  assert.deepEqual(LV.answerOf(gone, { today: T }), LV.answerOf(p, { today: T }), "everything returns to the earlier figures");
});

test("L4 asked again after 365 days, or when the left-over moved more than 25% from the one answered about (D-B6)", () => {
  const p = plans.jamie(), r = leftRow(p);
  const at = (on, monthly) => { const q = answer(p, { answer: "invest", monthly, amount: 300, newAccount: { id: "n-inv", name: "Investments for later", type: "brokerage" } }); q.retirement.leftover.on = on; return q; };
  assert.equal(!!leftRow(at("2025-11-12", r.total)).ask, false, "364 days: not yet");
  const old = leftRow(at("2025-11-10", r.total));
  assert.equal(old.ask, true);
  assert.equal(old.value, "You said in November 2025 that $300 a month is invested. Left over each month now: $567. Still right?");
  assert.deepEqual(old.acts.map((x) => x.label), ["Still right", "Answer again"]);
  assert.equal(rowsOf(at("2025-11-10", r.total)).shown[0].key, "leftover", "asked first");
  assert.equal(leftRow(at(T, r.total / 1.3)).ask, true, "moved 30% from the one answered about");
  assert.equal(!!leftRow(at(T, r.total / 1.2)).ask, false, "moved 20%");
  const sp = answer(p, { answer: "spend", monthly: 400 });
  assert.match(leftRow(sp).value, /^You said in November 2026 that \$400 a month is spent\. Left over each month now: \$567\. Still right\?$/);
});

test("F3 (the final review, 2026-11-13): \"More settings\" says when a box under it holds a figure typed since the page was drawn; opening it changes nothing", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const url = pathToFileURL(path.join(ROOT, "modules/retirement/projection/view.js")).href;
  const r = await renderPage(url, migrate(jamie()), T, { computeOf: { "overview/next-best-action": nbaCompute } });
  const settings = r.root.querySelectorAll("details").find((x) => /pj-settings/.test(x.className));
  const more = settings.querySelectorAll("details").find((x) => /pj-more/.test(x.className));
  const line = () => more.querySelector("summary").textContent;
  const form = settings.querySelector("form");
  assert.equal(line(), "More settings (stocks, tax, how much to take out)as usual›");
  more.open = true; more.dispatch("toggle"); more.open = false; more.dispatch("toggle");
  assert.equal(r.saved.length, 0, "opening and closing saves nothing");
  // 85 typed in "Share in stocks now" (an input event goes up to the form), the fold closed again
  form.querySelector('[name="stocksNow"]').value = "85";
  form.dispatch("input");
  assert.equal(line(), "More settings (stocks, tax, how much to take out)1 to save›");
  form.querySelector('[name="taxMode"]').value = "brackets";
  form.dispatch("change");
  assert.equal(line(), "More settings (stocks, tax, how much to take out)2 to save›");
  // both put back: the line goes back
  form.querySelector('[name="stocksNow"]').value = "70";
  form.querySelector('[name="taxMode"]').value = "flat";
  form.dispatch("change");
  assert.equal(line(), "More settings (stocks, tax, how much to take out)as usual›");
  // a setting already away from the usual figure: "1 changed" until another box is typed in
  const q = migrate(jamie()); q.retirement.stocksRetired = 0.3;
  const r2 = await renderPage(url, q, T, { computeOf: { "overview/next-best-action": nbaCompute } });
  const more2 = r2.root.querySelectorAll("details").find((x) => /pj-more/.test(x.className));
  assert.match(more2.querySelector("summary").textContent, /1 changed›$/);
  const f2 = r2.root.querySelectorAll("details").find((x) => /pj-settings/.test(x.className)).querySelector("form");
  f2.querySelector('[name="withdrawalRate"]').value = "5";
  f2.dispatch("input");
  assert.match(more2.querySelector("summary").textContent, /1 to save›$/);
});
