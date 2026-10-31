import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, worthNow, saveBelonging, removeBelonging, KINDS, COVERS_THINGS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-31";

/** The family plan with a home's purchase, a car, an other asset, three policies and four belongings. */
function plan() {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-car", name: "Minivan", type: "vehicle", balance: 18000 }, { id: "a-boat", name: "Canoe", type: "other_asset", balance: 900 });
  p.property = [{ id: "e-home", kind: "home", accountId: "a-home", purchasePrice: 300000, purchaseDate: "2020-10-31" }, { id: "e-car", kind: "vehicle", accountId: "a-car", loss: 0.15, purchasePrice: 30000, purchaseDate: "2023-05-01" }];
  p.insurance = { policies: [{ id: "pol-h", name: "House policy", kind: "home" }, { id: "pol-a", name: "Car policy", kind: "auto" }, { id: "pol-l", name: "Term life", kind: "term" }] };
  p.belongings = [
    { id: "b1", name: "Laptop", kind: "electronics", room: "Office", bought: "2024-10-31", paid: 1500, life: 5, policyId: "pol-h", proof: "photos on phone" },
    { id: "b2", name: "Ring", kind: "jewelry", room: "Bedroom", bought: "2015-06-01", paid: 4000, policyId: "pol-h", listed: false, proof: "appraisal in desk" },
    { id: "b3", name: "Sofa", kind: "furniture", room: "Living room", paid: 2000, life: 10, value: 600, valuedAt: "2026-09-01", proof: "receipt" },
    { id: "b4", name: "Old TV", kind: "electronics", room: "Basement", bought: "2012-01-01", paid: 800, life: 5, policyId: "pol-h" },
  ];
  return p;
}

test("worth now: your figure, else paid less an even share a year over the years it lasts (never below 0), else what you paid", () => {
  // two years into five: 1,500 × (1 − 2/5), about 900 (to the day: 730 days / 365.25)
  const w = worthNow({ paid: 1500, life: 5, bought: "2024-10-31" }, TODAY);
  assert.equal(w.how, "estimate"); assert.ok(Math.abs(w.worth - 1500 * (1 - (730 / 365.25) / 5)) < 0.01); assert.equal(w.perYear, 300);
  assert.deepEqual(worthNow({ paid: 800, life: 5, bought: "2012-01-01" }, TODAY), { worth: 0, how: "estimate", years: daysYears("2012-01-01"), perYear: 0 }, "past its years: 0, and it loses nothing more");
  assert.equal(worthNow({ paid: 2000, life: 10, value: 600 }, TODAY).how, "yours"); assert.equal(worthNow({ paid: 2000, life: 10, value: 600 }, TODAY).worth, 600);
  assert.deepEqual(worthNow({ paid: 4000, bought: "2015-06-01" }, TODAY), { worth: 4000, how: "paid", years: daysYears("2015-06-01"), perYear: 0 }, "no years: keeps its value");
  assert.equal(worthNow({ paid: 900, life: 5 }, TODAY).how, "paid", "no day bought: what you paid");
  assert.equal(worthNow({ paid: 900, life: 5, bought: "2027-01-01" }, TODAY).years, null, "a future day is not an age");
  assert.deepEqual(worthNow({ name: "x" }, TODAY), { worth: null, how: null, years: null, perYear: 0 });
  assert.equal(worthNow({ paid: 0, value: 0 }, TODAY).worth, 0, "a zero figure is a figure");
});
const daysYears = (iso) => Math.round((Date.UTC(2026, 9, 31) - Date.UTC(...iso.split("-").map((n, i) => (i === 1 ? n - 1 : +n)))) / 864e5) / 365.25;

test("homes: value against what you paid, as a yearly rate; the policy tied to the account, else paired as insurance/property pairs", () => {
  const d = compute(plan(), { today: TODAY });
  const h = d.homes[0];
  assert.equal(h.name, "House"); assert.equal(h.value, 380000); assert.equal(h.paid, 300000); assert.equal(h.change, 80000);
  // six years: (380,000 / 300,000)^(1/6) − 1
  assert.ok(Math.abs(h.perYear - (Math.pow(380000 / 300000, 1 / 6) - 1)) < 1e-12);
  assert.deepEqual(h.policy, { id: "pol-h", name: "House policy" }, "one home, one home policy");
  const p = plan(); p.accounts.push({ id: "a-cabin", name: "Cabin", type: "property", balance: 150000 });
  p.insurance.policies.push({ id: "pol-c", name: "Cabin policy", kind: "home", accountId: "a-cabin" });
  const two = compute(p, { today: TODAY }).homes;
  assert.equal(two.find((x) => x.accountId === "a-cabin").policy.id, "pol-c", "tied by account");
  assert.equal(two.find((x) => x.accountId === "a-home").policy.id, "pol-h", "two homes, two policies: paired in order");
  // a rental entry with no account is listed with its own value, and not counted in net worth
  p.property.push({ id: "e-r", kind: "rental", name: "Duplex", value: 250000 });
  const r = compute(p, { today: TODAY });
  assert.equal(r.homes.find((x) => x.entryId === "e-r").value, 250000); assert.equal(r.homes.find((x) => x.entryId === "e-r").rental, true);
  assert.equal(r.totals.homes, 380000 + 150000);
});

test("cars: the share a car loses a year (its own, else property/vehicles' 12%), and the car policies on file", () => {
  const d = compute(plan(), { today: TODAY });
  assert.deepEqual(d.cars.map((c) => [c.name, c.value, c.loss, c.lossYear, c.paid]), [["Minivan", 18000, 0.15, 2700, 30000]]);
  assert.deepEqual(d.carPolicies, [{ id: "pol-a", name: "Car policy" }]);
  const p = plan(); delete p.property[1].loss;
  assert.equal(compute(p, { today: TODAY }).cars[0].lossYear, 18000 * 0.12);
});

test("belongings: worth, policy, flags; totals; things worth a look", () => {
  const d = compute(plan(), { today: TODAY });
  assert.deepEqual(d.items.map((x) => x.name), ["Old TV", "Ring", "Sofa", "Laptop"], "by room (Basement, Bedroom, Living room, Office), then name");
  const by = Object.fromEntries(d.items.map((x) => [x.id, x]));
  assert.deepEqual(by.b2.flags, ["list-it"], "jewelry on a policy but not listed by name");
  assert.deepEqual(by.b3.flags, ["uncovered"]); assert.deepEqual(by.b4.flags, ["no-proof"]); assert.deepEqual(by.b1.flags, []);
  assert.equal(by.b1.policy.name, "House policy"); assert.equal(by.b2.special, true);
  assert.equal(d.totals.paid, 1500 + 4000 + 2000 + 800);
  assert.ok(Math.abs(d.totals.worth - (by.b1.worth + 4000 + 600 + 0)) < 1e-9);
  assert.equal(d.totals.uncovered, 600); assert.equal(d.totals.uncoveredCount, 1);
  assert.equal(d.totals.counted, 380000 + 18000 + 900, "homes, cars and other assets on Net worth");
  assert.deepEqual(d.checks.map((c) => c.id), ["uncovered", "list-it", "no-proof"]);
  assert.match(d.checks[0].text, /^Sofa is not tied/); assert.match(d.checks[2].text, /^Old TV has no note/);
  assert.deepEqual(d.policies, [{ id: "pol-h", name: "House policy", kind: "home" }], "only home and other policies can cover things");
  assert.deepEqual(COVERS_THINGS, ["home", "other"]);
  // listing it clears the flag
  const p = plan(); p.belongings[1].listed = true;
  assert.deepEqual(compute(p, { today: TODAY }).items.find((x) => x.id === "b2").flags, []);
});

test("things worth a look for homes and cars without insurance, and the empty plan", () => {
  const p = plan(); p.insurance.policies = []; p.belongings = [];
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.checks.map((c) => c.id), ["home-a-home", "cars"]);
  assert.deepEqual(d.checks[0].go, ["insurance", "policies"]);
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.empty, true); assert.deepEqual(e.checks, []); assert.equal(e.totals.counted, 0); assert.equal(e.lastChanged, null);
  // a belonging with no policy when none can cover it points to Policies
  p.belongings = [{ id: "x", name: "Bike", kind: "sports", paid: 500, proof: "receipt" }];
  assert.deepEqual(compute(p, { today: TODAY }).checks.find((c) => c.id === "uncovered").go, ["insurance", "policies"]);
});

test("saving and removing a belonging: cleaned, added or replaced by id, dated; the kinds", () => {
  const p = emptyPlan();
  const a = saveBelonging(p, { id: "n1", name: "  Guitar ", kind: "instruments", paid: "700", life: "15", bought: "2020-01-01", value: "", listed: 0 }, TODAY);
  assert.deepEqual(a, { id: "n1", name: "Guitar", kind: "instruments", room: "", bought: "2020-01-01", paid: 700, value: null, valuedAt: "", life: 15, policyId: "", listed: false, details: "", proof: "", updatedAt: TODAY });
  saveBelonging(p, { id: "n1", name: "Guitar", kind: "nope", paid: 700, value: 500, life: 0, bought: "1/1/2020" }, "2026-11-01");
  assert.equal(p.belongings.length, 1, "same id: replaced");
  assert.deepEqual([p.belongings[0].kind, p.belongings[0].value, p.belongings[0].valuedAt, p.belongings[0].life, p.belongings[0].bought, p.belongings[0].updatedAt], ["other", 500, "2026-11-01", null, "", "2026-11-01"]);
  assert.equal(compute(p, { today: TODAY }).lastChanged, "2026-11-01");
  assert.equal(removeBelonging(p, "n1"), true); assert.equal(removeBelonging(p, "n1"), false); assert.deepEqual(p.belongings, []);
  // every special kind keeps its value; every kind has a label
  for (const [, k] of Object.entries(KINDS)) { assert.ok(k.label); if (k.special) assert.equal(k.life, null); }
});
