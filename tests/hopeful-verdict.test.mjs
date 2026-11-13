// tests/hopeful-verdict.test.mjs -- L10 (spec rv/spec.md section 5 risk 1; 2026-11-13): a stock return above the middle figure
// (Assumptions' "Middle 7% (ours)") never makes the answer other pages give better on its own. Will the money last? keeps the
// answer on the person's own return (with the L5 tag) and says the middle return's answer under it; `savingVerdict`, which Next
// best action, Benchmarks, the guide's "What would help" step and "drawing as planned" read, gives the middle return's answer
// whenever it is worse. Written before the change; each test failed first. The critic's review of 2026-11-13 added the bond and
// cash returns (a bond return above 4% beat the guard: F2) and worked the middle answer only when asked (F8: it doubled every
// compute's cost above 7%); those tests failed first too.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../modules/retirement/projection/compute.js";
import { compute as nba } from "../modules/overview/next-best-action/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-13";
const at = (mk, r, more = {}) => { const p = migrate(mk()); p.assumptions.returnStocks = r; Object.assign(p.assumptions, more); return p; };
const MID = { stocks: 0.07, bonds: 0.04, cash: 0.02 };
const arche = (n) => () => ARCHETYPES.find((a) => a.id.startsWith(n)).build();

test("L10: Dana & Lee on track only at 9%: other pages are told 'tight', with the middle return's figures", () => {
  const mid = P.compute(at(phone.danaLee, 0.07), { today: T });
  const hi = P.compute(at(phone.danaLee, 0.09), { today: T });
  // by hand: on track needs the most the plan can pay for to be at least 1.15 times the spending (compute's rule)
  assert.equal(mid.verdict, "tight"); assert.ok(mid.affordable / mid.spendingYearly < 1.15);
  assert.equal(hi.verdict, "on track"); assert.ok(hi.affordable / hi.spendingYearly >= 1.15);
  // the page's own answer stays on the person's return; the middle return's answer rides beside it
  assert.deepEqual(P.middleOf(hi), { returns: MID, raised: ["stocks"], verdict: "tight", shortYear: null, shortAge: null, affordable: mid.affordable });
  const v = P.savingVerdict(at(phone.danaLee, 0.09), { today: T });
  assert.equal(v.verdict, "tight");
  assert.equal(v.affordable, mid.affordable, "said = done: the figure the plan gives at 7%");
  assert.equal(v.spendingYearly, hi.spendingYearly);
  assert.deepEqual(v.heldBack, { returns: { ...MID, stocks: 0.09 }, verdict: "on track", shortAge: null, affordable: hi.affordable });
  assert.equal(v.onMiddle.verdict, "tight");
});

test("L10: a return that turns 'runs out' into 'lasts, just' is held back too; and 'runs out at 94' on 8% is said at 89 on 7%", () => {
  const robin = P.savingVerdict(at(phone.robin, 0.08), { today: T });
  const robinMid = P.compute(at(phone.robin, 0.07), { today: T });
  assert.equal(P.compute(at(phone.robin, 0.08), { today: T }).verdict, "tight");
  assert.equal(robinMid.verdict, "short");
  assert.equal(robin.verdict, "short"); assert.equal(robin.shortAge, robinMid.shortAge);
  // (12-high-net-worth has no Social Security figure on file, so savingVerdict waits for it: the age rule is checked on compute's own)
  const hi = P.compute(at(arche("12"), 0.08), { today: T }), mid = P.compute(at(arche("12"), 0.07), { today: T });
  assert.equal(hi.verdict, "short"); assert.equal(mid.verdict, "short"); assert.ok(mid.shortAge < hi.shortAge);
  assert.equal(P.middleOf(hi).shortAge, mid.shortAge);
  assert.ok(P.middleWorse(hi));
});

test("L10: a plan that lasts on the middle return too keeps its answer, with the middle return said", () => {
  const v = P.savingVerdict(at(() => familyPlan(T), 0.08), { today: T });
  const own = P.compute(at(() => familyPlan(T), 0.08), { today: T });
  assert.equal(v.verdict, "on track"); assert.equal(v.affordable, own.affordable);
  assert.equal(v.heldBack, undefined);
  assert.equal(v.onMiddle.verdict, "on track");
});

test("L10: at the middle returns or below nothing changes: no middle answer, the same four fields", () => {
  for (const r of [0.06, 0.07]) {
    const p = at(phone.danaLee, r, { returnBonds: 0.03, returnCash: 0.02 });
    assert.equal(P.middleOf(P.compute(p, { today: T })), null, `${r}`);
    assert.deepEqual(Object.keys(P.savingVerdict(p, { today: T })), ["verdict", "shortAge", "affordable", "spendingYearly"], `${r}`);
  }
  const p = migrate(phone.danaLee()); delete p.assumptions.returnStocks; delete p.assumptions.returnBonds; delete p.assumptions.returnCash;   // the defaults
  assert.equal(P.middleOf(P.compute(p, { today: T })), null);
});

// critic-engine F2 (2026-11-13): the bond return is typed on the same Assumptions page, and raising it alone turned Robin's
// "runs out at 94" into "lasts, just" and Dana & Lee's "tight" into "on track" on every page
test("L10: a hopeful bond or cash return is held back like a stock one: other pages get the answer on the middle figures", () => {
  const robinMid = P.compute(at(phone.robin, 0.07), { today: T });
  assert.equal(robinMid.verdict, "short");
  const rb = at(phone.robin, 0.07, { returnBonds: 0.07 });
  assert.equal(P.compute(rb, { today: T }).verdict, "tight", "the page keeps the answer on the person's own returns");
  const v = P.savingVerdict(rb, { today: T });
  assert.equal(v.verdict, "short"); assert.equal(v.shortAge, robinMid.shortAge); assert.equal(v.affordable, robinMid.affordable);
  assert.deepEqual(v.heldBack.returns, { ...MID, bonds: 0.07 });
  const danaMid = P.compute(at(phone.danaLee, 0.07), { today: T });
  for (const more of [{ returnBonds: 0.07 }, { returnBonds: 0.09 }]) {
    const d = at(phone.danaLee, 0.09, more);
    assert.equal(P.compute(d, { today: T }).verdict, "on track");
    const w = P.savingVerdict(d, { today: T });
    assert.equal(w.verdict, "tight"); assert.equal(w.affordable, danaMid.affordable, "the 7% / 4% figure");
  }
  // a cash return above 2% is worked on 2% too (Robin: cash 6% moves the run-out age a year)
  const rc = at(phone.robin, 0.07, { returnCash: 0.06 });
  assert.deepEqual(P.middleOf(P.compute(rc, { today: T })).raised, ["cash"]);
  assert.equal(P.savingVerdict(rc, { today: T }).shortAge, robinMid.shortAge);
});

// critic-engine F8 (2026-11-13): the middle answer (a second run and a second search for the most the plan can pay for) was worked
// inside every compute above 7%, also for the many pages that never read it
test("L10: compute does not work the middle answer itself; middleOf works it once per answer, when asked", () => {
  const d = P.compute(at(phone.danaLee, 0.09), { today: T });
  assert.equal("middle" in d, false);
  assert.deepEqual(Object.keys(d), Object.keys(P.compute(at(phone.danaLee, 0.07), { today: T })), "the same fields at 9% and 7%");
  const m = P.middleOf(d);
  assert.equal(P.middleOf(d), m, "worked once, then kept for that answer");
  assert.equal(P.middleOf(null), null); assert.equal(P.middleOf({ ready: false }), null);
});

test("L10: Next best action no longer calls more saving optional when only a hopeful return makes the plan last", () => {
  const ira = (r) => nba(at(phone.danaLee, r), { today: T }).steps.find((s) => s.id === "ira");
  assert.equal(ira(0.07).optional, false);
  assert.equal(ira(0.09).optional, false, "on 9% the plan lasts, on the middle 7% only just");
  assert.ok(!/already lasts/.test(ira(0.09).why));
});

test("L10: 'drawing as planned' (a retired household living on savings) waits for the middle return's answer", () => {
  const retired = () => {
    const p = arche("08")();
    const ids = p.household.people.filter((x) => x.role !== "dependent").map((x) => x.id);
    p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}), status: Object.fromEntries(ids.map((id) => [id, "retired"])), ss: Object.fromEntries(ids.map((id) => [id, "none"])) } };
    p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 6400 };
    return p;
  };
  assert.equal(P.compute(at(retired, 0.07), { today: T }).verdict, "short");
  assert.equal(P.compute(at(retired, 0.08), { today: T }).verdict, "tight");
  assert.equal(P.drawingAsPlanned(at(retired, 0.08), { today: T }), null, "short on the middle return: not 'the plan working'");
  assert.equal(P.drawingAsPlanned(at(retired, 0.07), { today: T }), null);
});

test("L10: the words Will the money last? says under its answer", () => {
  const d = P.compute(at(phone.danaLee, 0.09), { today: T });
  assert.equal(P.middleWords(d), "With stocks at our middle figure, 7% a year, the money lasts, but only just. A higher return alone does not make a plan safe.");
  const r = P.compute(at(phone.robin, 0.08), { today: T });
  assert.equal(P.middleWords(r), `With stocks at our middle figure, 7% a year, the money runs out at ${P.middleOf(r).shortAge}. A higher return alone does not make a plan safe.`);
  const h = P.compute(at(arche("12"), 0.08), { today: T });
  assert.equal(P.middleWords(h), `With stocks at our middle figure, 7% a year, the money runs out at ${P.middleOf(h).shortAge}, not ${h.shortAge}. A higher return alone does not make a plan safe.`);
  assert.equal(P.middleWords(P.compute(at(() => familyPlan(T), 0.08), { today: T })), null, "lasts on both: nothing to say");
  // the bond or cash return raised: the words name what was put back to its middle figure
  const b = P.compute(at(phone.robin, 0.07, { returnBonds: 0.07 }), { today: T });
  assert.equal(P.middleWords(b), `With bonds at our middle figure, 4% a year, the money runs out at ${P.middleOf(b).shortAge}. A higher return alone does not make a plan safe.`);
  const sb = P.compute(at(phone.danaLee, 0.09, { returnBonds: 0.09 }), { today: T });
  assert.equal(P.middleWords(sb), "With stocks and bonds at our middle figures (7% and 4% a year), the money lasts, but only just. A higher return alone does not make a plan safe.");
  const all = P.compute(at(phone.robin, 0.08, { returnBonds: 0.05, returnCash: 0.03 }), { today: T });
  assert.match(P.middleWords(all), /^With stocks, bonds and cash at our middle figures \(7%, 4% and 2% a year\), the money runs out at \d+/);
});
