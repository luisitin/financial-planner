import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, AUTO_MIN, UMBRELLA_UNDER, HOME_LIABILITY_DEFAULT, COINSURANCE, UMBRELLA_STEP, UMBRELLA_COST, IRA_LIMIT } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const HOME = { id: "h", name: "Homeowners", kind: "home", benefit: 410000, premium: 2160, period: "annual" };
const AUTO = { id: "a", name: "Two cars", kind: "auto", benefit: 300000, premium: 104, period: "monthly" };
const withPolicies = (policies, change) => { const p = familyPlan(TODAY); p.insurance = { policies }; if (change) change(p); return p; };
const check = (d, id) => d.checks.find((c) => c.id === id);

test("an empty plan: nothing on file, rent assumed, renters insurance suggested", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.hasAny, false); assert.equal(check(d, "renters").ok, false);
});

test("what a lawsuit could reach: net worth less 401(k)s in full and IRAs up to the bankruptcy limit", () => {
  const d = compute(withPolicies([HOME, AUTO]), { today: TODAY });
  assert.equal(d.netWorth, 287100); assert.equal(d.shielded, 86000 + 42000 + 31000); assert.equal(d.exposed, 287100 - 159000);
  const big = compute(withPolicies([HOME, AUTO], (p) => { p.accounts.push({ id: "x", name: "Big IRA", type: "ira", balance: 2000000 }); }), { today: TODAY });
  assert.equal(big.shielded, 86000 + 42000 + IRA_LIMIT); assert.equal(big.exposed, big.netWorth - big.shielded);
});

test("the family: the home's rebuild cost unknown, the car limit fine, the home's assumed liability short", () => {
  const d = compute(withPolicies([HOME, AUTO]), { today: TODAY });
  assert.equal(d.homes[0].status, "unknown"); assert.equal(d.homes[0].dwelling, 410000);
  assert.equal(check(d, "auto").ok, true);
  assert.equal(d.homeLiability, HOME_LIABILITY_DEFAULT); assert.equal(d.homeLiabilityKnown, false);
  assert.equal(d.inCar, 300000); assert.equal(d.atHome, 100000);
  const l = check(d, "liability"); assert.equal(l.ok, false); assert.match(l.title, /\$28,100/); assert.match(l.text, /home policy's liability limit to \$300,000/);
  assert.equal(d.suggestedUmbrella, 0);
});

test("the home against the cost to rebuild: full, over the coinsurance line, under it", () => {
  const at = (rebuildCost) => compute(withPolicies([{ ...HOME, rebuildCost }, AUTO]), { today: TODAY }).homes[0];
  assert.equal(at(410000).status, "ok");
  const low = at(450000); assert.equal(low.status, "low"); assert.ok(Math.abs(low.share - 410000 / 450000) < 1e-12);
  assert.equal(at(410000 / COINSURANCE + 1000).status, "under");
  assert.equal(compute(withPolicies([AUTO]), { today: TODAY }).homes[0].status, "none");
});

test("an umbrella: suggested in $1M steps above the underlying limits, priced per million; checked against what it needs underneath", () => {
  const rich = (p) => { p.accounts.push({ id: "b2", name: "Brokerage 2", type: "brokerage", balance: 1500000 }); };
  const d = compute(withPolicies([{ ...HOME, liability: 300000 }, AUTO], rich), { today: TODAY });
  const need = Math.ceil((d.exposed - 300000) / UMBRELLA_STEP) * UMBRELLA_STEP;
  assert.equal(d.suggestedUmbrella, need); assert.equal(need, 2000000);
  assert.deepEqual(d.umbrellaCost, UMBRELLA_COST.map((c) => c * 2));
  const withU = compute(withPolicies([{ ...HOME, liability: 300000 }, AUTO, { id: "u", name: "Umbrella", kind: "umbrella", benefit: 2000000, premium: 400, period: "annual" }], rich), { today: TODAY });
  assert.equal(withU.suggestedUmbrella, 0); assert.equal(withU.inCar, 2300000); assert.equal(check(withU, "liability").ok, true);
  assert.equal(check(withU, "umbrella").ok, false, `car liability under ${UMBRELLA_UNDER.auto}`);
});

test("car checks: a low limit, and a car with no policy", () => {
  assert.equal(check(compute(withPolicies([HOME, { ...AUTO, benefit: 50000 }]), { today: TODAY }), "auto").ok, false);
  assert.ok(AUTO_MIN === 300000);
  const none = compute(withPolicies([HOME]), { today: TODAY });
  assert.equal(check(none, "auto").ok, false, "the car loan shows a car"); assert.match(check(none, "auto").title, /No car insurance/);
});

test("deductibles against usable cash", () => {
  const d = compute(withPolicies([{ ...HOME, deductible: 2500 }, { ...AUTO, deductible: 1000 }]), { today: TODAY });
  assert.equal(d.deductibles.total, 3500); assert.equal(d.deductibles.ok, d.deductibles.cash >= 3500);
  const big = compute(withPolicies([{ ...HOME, deductible: 50000 }]), { today: TODAY });
  assert.equal(big.deductibles.ok, false);
});

test("an umbrella's cost: $150 to $300 for the first million, about $75 for the second and $50 for each one after (III)", async () => {
  const { umbrellaCost } = await import("./compute.js");
  assert.deepEqual(umbrellaCost(0), [0, 0]); assert.deepEqual(umbrellaCost(1000000), [150, 300]);
  assert.deepEqual(umbrellaCost(2000000), [225, 375]); assert.deepEqual(umbrellaCost(3000000), [275, 425]); assert.deepEqual(umbrellaCost(5000000), [375, 525]);
});
