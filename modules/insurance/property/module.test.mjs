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

// ---- round 8 batch 6: one figure for "a lawsuit could reach", and a rented-out home's policy (landlord-7) ------------------
test("batch 6: a lawsuit could reach 318,000; 218,000 of it is not covered, after 100,000 of liability coverage", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const d = compute(condoOnNetWorthPlan(), { today: "2026-11-06" });
  // net worth 618,000 less the 401(k)s' 300,000; the weaker cover is the home's 100,000 (assumed: no limit entered)
  assert.equal(d.netWorth, 618000); assert.equal(d.exposed, 318000);
  assert.equal(d.liabilityCover, 100000); assert.equal(d.uncovered, 218000);
  // one meaning for each phrase: no check says "a lawsuit could reach" with another figure
  const liab = d.checks.find((c) => c.id === "liability");
  assert.equal(liab.title, "$218,000 of your net worth outside retirement accounts is not covered");
  assert.ok(!d.checks.some((c) => /lawsuit could reach/i.test(c.title)));
});

test("batch 6: a rented-out home needs a landlord policy: checked for each rental, with the umbrella when there is one", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  // the condo's policy is on file as a homeowners policy: ask for a landlord one
  let c = compute(condoOnNetWorthPlan(), { today: T }).checks.find((x) => x.id === "rental-r-condo");
  assert.equal(c.ok, false); assert.equal(c.title, "Condo is rented out: it needs a landlord policy");
  assert.match(c.text, /Condo landlord policy is on file as a homeowners policy/);
  // "Go there" opens that policy's form (review 2026-11-06, UX 11)
  assert.deepEqual(c.query, { edit: "pol-condo" });
  // set to Landlord: fine; with an umbrella, tell its insurer
  const p = condoOnNetWorthPlan(); p.insurance.policies[1].kind = "landlord";
  c = compute(p, { today: T }).checks.find((x) => x.id === "rental-r-condo");
  assert.equal(c.ok, true); assert.equal(c.title, "Condo has a landlord policy");
  p.insurance.policies.push({ id: "u", name: "Umbrella", kind: "umbrella", benefit: 1000000, premium: 300, period: "annual" });
  c = compute(p, { today: T }).checks.find((x) => x.id === "rental-r-condo");
  assert.equal(c.ok, null); assert.match(c.text, /Tell your umbrella insurer about Condo/);
  // no policy that names it: none on file
  const q = condoOnlyRentalPlan(); q.insurance.policies = q.insurance.policies.filter((x) => x.id !== "pol-condo");
  c = compute(q, { today: T }).checks.find((x) => x.id === "rental-r-condo");
  assert.equal(c.title, "Condo is rented out and has no policy on file"); assert.deepEqual(c.go, ["insurance", "policies"]);
  // a household with no rental: no such check
  assert.ok(!compute(withPolicies([HOME, AUTO]), { today: TODAY }).checks.some((x) => x.id.startsWith("rental-")));
});

test("batch 6: a landlord policy counts as cover on a home: its dwelling coverage, liability and deductible", () => {
  const p = withPolicies([{ ...HOME, kind: "landlord", liability: 300000, deductible: 1000 }, AUTO]);
  const d = compute(p, { today: TODAY });
  assert.equal(d.homes[0].policy?.id, "h"); assert.equal(d.homeLiability, 300000); assert.equal(d.deductibles.total, 1000);
});

// ---- round 8 batch 6 review (money 6 and 8) ---------------------------------------------------------------------------------
test("batch 6 review: the two pages pair the condo with its landlord policy whatever the list order, and a rental only on Rental analysis keeps its policy", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const { compute: assets } = await import("../../balance/assets/compute.js");
  const T = "2026-11-06";
  // the review's kindorder: the condo linked, "Rental dwelling policy" (landlord) then "Homeowners policy" (home), no names
  const p = condoOnNetWorthPlan(); p.property[0].accountId = "condo";
  p.insurance.policies = p.insurance.policies.filter((x) => x.kind !== "home");
  p.insurance.policies.unshift({ id: "pl", name: "Rental dwelling policy", kind: "landlord", benefit: 250000, premium: 900, period: "annual" }, { id: "ph", name: "Homeowners policy", kind: "home", benefit: 400000, premium: 3000, period: "annual" });
  const d = compute(p, { today: T });
  assert.deepEqual(d.homes.map((h) => [h.name, h.policy?.id]), [["Home", "ph"], ["Condo", "pl"]]);
  assert.equal(d.checks.find((c) => c.id === "rental-r-condo").title, "Condo has a landlord policy");
  assert.deepEqual(assets(p, { today: T }).homes.map((h) => [h.name, h.policy?.id]), [["Home", "ph"], ["Condo", "pl"]]);
  // the review's onlyrental-landlord: the condo only on Rental analysis, its landlord policy named for the insurer
  const q = condoOnlyRentalPlan();
  const c = q.insurance.policies.find((x) => x.id === "pol-condo"); c.name = "Acme rental dwelling"; c.kind = "landlord";
  assert.equal(compute(q, { today: T }).checks.find((x) => x.id === "rental-r-condo").title, "Condo has a landlord policy", "What you own says it is insured by Acme rental dwelling");
  assert.equal(assets(q, { today: T }).homes.find((h) => h.rental).policy?.id, "pol-condo");
});

test("batch 6 review: the home side of the liability check is the weakest home or landlord policy, so a weak policy on the home you live in is not hidden", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  // the review's liab: home policy 100,000 of liability, the condo's landlord policy 1,000,000, the car 1,000,000
  const p = condoOnNetWorthPlan(); p.property[0].accountId = "condo";
  const pol = p.insurance.policies;
  Object.assign(pol.find((x) => x.id === "pol-condo"), { kind: "landlord", liability: 1000000 });
  pol.find((x) => x.id === "pol-home").liability = 100000; pol.find((x) => x.id === "pol-car").benefit = 1000000;
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.liabilityCover, 100000); assert.equal(d.uncovered, 218000);
  assert.equal(d.checks.find((c) => c.id === "liability").title, "$218,000 of your net worth outside retirement accounts is not covered");
});

test("batch 6 review (UX 8, 12): a rented-out condo with association dues is not asked for the cost to rebuild the building; the umbrella names its policy", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan(); p.property[0].accountId = "condo"; p.insurance.policies.find((x) => x.id === "pol-condo").kind = "landlord";
  let d = compute(p, { today: "2026-11-06" });
  // $350 a month of dues: the association's master policy usually has the building (Maryland Insurance Administration)
  const unit = d.checks.find((c) => c.id === "home-condo");
  assert.match(unit.text, /building itself is usually on the association's policy and yours covers the inside of the unit/);
  assert.doesNotMatch(unit.text, /cost to rebuild/);
  assert.match(d.checks.find((c) => c.id === "rental-r-condo").text, /usually on the association's policy: yours covers the inside/);
  // Home has no dues: its check still asks for the cost to rebuild
  assert.match(d.checks.find((c) => c.id === "home-setup-have-home").text, /cost to rebuild/);
  // the suggested umbrella names the condo's policy among those underneath it
  assert.match(d.checks.find((c) => c.id === "umbrella").text, /\$300,000 on the home and on Condo's landlord policy underneath it/);
  // with no dues the landlord check says it covers the building
  p.property[0].hoaMonthly = 0;
  d = compute(p, { today: "2026-11-06" });
  assert.match(d.checks.find((c) => c.id === "rental-r-condo").text, /it covers the building/);
});
