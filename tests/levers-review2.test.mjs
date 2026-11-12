// tests/levers-review2.test.mjs -- "What this rests on" after the review of 2026-11-12, the parts that need the tax split (L6) and
// the "Before your change" line: what the person said reads the same whether or not it is being asked about again (N6); the
// match the card tries stays pay-the-tax-later and stays our guess (B5, M5). Invented households: the phone-built ones, the
// family.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as LV from "../modules/retirement/levers.js";
import * as C from "../modules/retirement/contributions/compute.js";
import { buildInputs, BUCKET_OF } from "../modules/retirement/projection/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { perYear } from "../core/math/periods.js";
import { isGuess } from "../core/estimate/index.js";
import { compute as nbaCompute } from "../modules/overview/next-best-action/compute.js";
import { compute as benchmarks } from "../modules/overview/benchmarks/compute.js";
import { compute as liquidity } from "../modules/balance/liquidity/compute.js";
import { yearSavingWords } from "../core/math/leftover.js";
import { danaLee, jamie, casey, robin, morgan } from "../qa/fixtures/phone-households.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-11";
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const nba = (plan) => nbaCompute(structuredClone(plan), { today: T });
const spareOf = (plan) => { const n = nba(plan); return n.ready ? n.spare : null; };
const rowsOf = (plan) => LV.leverRows(plan, { today: T, spare: spareOf(plan) });
const all = (r) => [...r.shown, ...r.folded, ...r.hidden];
const leftRow = (plan) => all(rowsOf(plan)).find((x) => x.key === "leftover");
const household = (id) => migrate(ARCHETYPES.find((a) => a.id === id).build());
const answer = (plan, opts) => { const p = structuredClone(plan); LV.applyLeftover(p, { today: T, ...opts }); return p; };
const invest = (plan, row, amount = row.amount) => answer(plan, { answer: "invest", monthly: row.total, amount, personId: row.leadId, newAccount: { id: "n-inv", name: "Investments for later", type: "brokerage" } });
const bank = (plan, row, amount = row.amount) => answer(plan, { answer: "bank", monthly: row.total, amount, personId: row.leadId, newAccount: { id: "n-bank", name: "Savings for later", type: "savings" } });
const bill = (plan, amount) => { const p = structuredClone(plan); p.expenses.push({ id: `bill-${amount}`, name: "A new bill", amount, period: "monthly", category: "other", essential: true }); return p; };

// ---- N6: what the person said is one value ----
test("N6: a bill that makes the card ask again is not 'You changed the money left over'; neither is 'Still right'", () => {
  const p = migrate(danaLee()), row = leftRow(p);
  const q = invest(p, row);
  const values = (plan) => LV.valuesOf(LV.leverList(plan, { today: T, spare: spareOf(plan) }));
  const asked = bill(q, 700);
  assert.equal(leftRow(asked).ask, true);
  assert.deepEqual(LV.changedKeys(values(q), values(asked)).filter((x) => x.key === "leftover"), []);
  // asked again because it moved more than a quarter (the left-over rose): the same value
  const more = structuredClone(q); more.expenses = more.expenses.slice(1);
  if (leftRow(more).ask) assert.deepEqual(LV.changedKeys(values(q), values(more)).filter((x) => x.key === "leftover"), []);
  const kept = structuredClone(asked); kept.retirement.leftover.on = T; kept.retirement.leftover.monthly = 1128.4;
  assert.deepEqual(LV.changedKeys(values(asked), values(kept)).filter((x) => x.key === "leftover"), []);
  // a value that reads the same before and after is never a change, whatever it is compared by
  assert.deepEqual(LV.changedKeys({ k: { name: "x", short: "$5", cmp: "a" } }, { k: { name: "x", short: "$5", cmp: "b" } }), []);
  // the answer itself is one
  assert.deepEqual(LV.changedKeys(values(p), values(q)).filter((x) => x.key === "leftover").map((x) => [x.from, x.to]), [["$1,828 a month", "$1,820 a month invested"]]);
});

// ---- B5: the match of money that goes in as Roth is kept pay-the-tax-later ----
test("B5: after 'Pay the tax now' the card's match change and the match landing keep the employer's money on a pay-the-tax-later row", () => {
  const j = migrate(jamie());
  delete j.retirement.workPlans["setup-self"].match;
  const ROW = "setup-contrib-setup-self";
  const now = structuredClone(j);
  C.applyTaxChoice(now, ROW, { choice: "now", nowEach: 250, period: "monthly", today: T, ids: { nowRow: "n-row", nowAccount: "n-acct" }, accountName: "Roth 401(k) at work" });
  assert.deepEqual(now.retirement.contributions.map((c) => [c.id, c.amount, c.employerMatch]), [["n-row", 250, 0]]);
  const r = all(rowsOf(now)).find((x) => x.key === "match:n-row");
  assert.ok(r, "a match row for the Roth 401(k) row");
  // the same match on a pay-the-tax-later row, by hand
  const usual = LV.usualMatchAt(now, "setup-self", T, 3000);
  const byHand = structuredClone(now);
  byHand.retirement.contributions.push({ id: "hand", accountId: "setup-workplan-setup-self", personId: "setup-self", amount: 0, period: "monthly", employerMatch: usual });
  assert.deepEqual(r.outs[0], LV.answerOf(byHand, { today: T }), "the card's effect is the match counted pay-the-tax-later");
  const onRoth = structuredClone(now); onRoth.retirement.contributions[0].employerMatch = usual;
  assert.notDeepEqual(r.outs[0], LV.answerOf(onRoth, { today: T }), "not the rosier answer with the match on the Roth row");
  // the write itself: the Roth row keeps no match, a $0 pay-the-tax-later row of the same job carries it
  const saved = structuredClone(now); C.applyMatchAtWork(saved, "n-row", 2040, { today: T, ids: { laterRow: "l-row" } });
  assert.deepEqual(saved.retirement.contributions.map((c) => [c.id, c.accountId, c.amount, c.employerMatch]), [["n-row", "n-acct", 250, 0], ["l-row", "setup-workplan-setup-self", 0, 2040]]);
  for (const c of saved.retirement.contributions) if (C.isNowAccount(saved.accounts.find((a) => a.id === c.accountId), c.employerMatch)) assert.equal(c.employerMatch, 0);
  // taken back to none, the $0 row goes
  C.applyMatchAtWork(saved, "n-row", 0, { today: T });
  assert.deepEqual(saved.retirement.contributions.map((c) => c.id), ["n-row"]);
  // a pay-the-tax-later row just gets the figure
  const plain = structuredClone(j); C.applyMatchAtWork(plain, ROW, 2040, { today: T });
  assert.equal(plain.retirement.contributions[0].employerMatch, 2040);
  // the work-saving change of a Roth-only person never puts a match on the Roth row either
  const withGuess = structuredClone(now); withGuess.retirement.contributions[0].amount = 100;
  const alt = LV.workAlt(withGuess, "setup-self", { today: T });
  const tried = structuredClone(withGuess); LV.applyWorkAlt(tried, "setup-self", { ...alt, match: 1200 });
  assert.equal(tried.retirement.contributions.find((c) => c.id === "n-row").employerMatch, 0);
  assert.equal(tried.retirement.contributions.reduce((t, c) => t + (Number(c.employerMatch) || 0), 0), 1200);
});

// ---- M5: "enough for the whole usual match" ----
test("M5: the 'full' change names the usual match it counts; the landing asks for it as our guess", () => {
  const p = migrate(robin());
  const ROW = "setup-contrib-setup-self", PATH = `retirement.contributions[${ROW}].employerMatch`;
  const row = p.retirement.contributions.find((c) => c.id === ROW);
  row.amount = 175;
  const g = LV.usualMatchAt(p, "setup-self", T, 175 * 12);
  row.employerMatch = g; p.guesses[PATH].v = g;
  assert.equal(isGuess(p, PATH), true);
  const alt = LV.workAlt(p, "setup-self", { today: T });
  assert.equal(alt.kind, "full");
  const wl = LV.workLanding(p, "setup-self", { today: T });
  assert.deepEqual([wl.fill, wl.tried, wl.matchGuess], [false, { amount: alt.monthly, period: "monthly" }, alt.match]);
  assert.ok(alt.match > g, "the whole usual match is more than the match at 3% of pay");
  assert.equal(LV.usualMatchAt(p, "setup-self", T, alt.monthly * 12), alt.match, "the usual match at the amount saved is the one the card counted");
});
