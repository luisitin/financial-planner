// tests/followups-rental.test.mjs -- rental follow-ups C7 (two homes of one name) and C9 (words).
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { compute as assets } from "../modules/balance/assets/compute.js";
import { pairHomes } from "../modules/insurance/policies/compute.js";
import { compute as propertyCover } from "../modules/insurance/property/compute.js";
import { linkedWords } from "../modules/property/rental/running.js";
import { seeLoanWords } from "../modules/debt/mortgage/compute.js";

const pol = (id, name, kind) => ({ id, name, kind, personId: "", premium: 100, period: "monthly" });
function twoCondos() {
  const p = migrate(emptyPlan());
  p.household.people = [{ id: "me", name: "Me", role: "self", birthDate: "1980-01-01" }];
  p.accounts = [{ id: "a-home", name: "Condo", type: "property", balance: 300000, ownerId: "", history: [] }, { id: "a-2", name: "Condo", type: "property", balance: 200000, ownerId: "", history: [] }];
  p.property = [{ id: "r1", kind: "rental", name: "Condo", value: 200000, accountId: "a-2", rent: 2000 }];
  p.insurance.policies = [pol("p1", "Condo landlord policy", "landlord"), pol("p2", "Condo home policy", "home")];
  return p;
}

test("C7: two homes named Condo: the landlord policy goes to the rental, the home policy to the home (no 'No home insurance on file')", () => {
  const d = assets(twoCondos(), { today: "2026-11-06" });
  const home = d.homes.find((h) => !h.rental), rental = d.homes.find((h) => h.rental);
  assert.equal(rental.policy?.name, "Condo landlord policy");
  assert.equal(home.policy?.name, "Condo home policy", "it showed no policy for the home");
  assert.equal(d.checks.some((c) => /No home insurance on file|No policy on file/.test(c.text)), false);
  // the pairing itself, either order of the list
  const homes = [{ accountId: "a-home", name: "Condo", rental: false }, { accountId: "a-2", name: "Condo", rental: true }];
  const ps = [pol("p2", "Condo home policy", "home"), pol("p1", "Condo landlord policy", "landlord")];
  assert.deepEqual(pairHomes(homes, ps).map((x) => x?.id), ["p2", "p1"]);
  assert.deepEqual(pairHomes([...homes].reverse(), ps).map((x) => x?.id), ["p1", "p2"]);
  // Policies written the other way round in the list
  assert.deepEqual(pairHomes(homes, [...ps].reverse()).map((x) => x?.id), ["p2", "p1"]);
});

test("C9: 'Linked: Condo on Net worth is this rental, counted once.'", () => {
  assert.equal(linkedWords("Condo", "Condo"), "Linked: Condo on Net worth is this rental, counted once.");
  assert.equal(linkedWords("Lake house", "Cabin"), "Linked: the Lake house on Net worth is Cabin, counted once.");
});

test("C9: 'See the loan ›' when the loan's own name is generic", () => {
  assert.equal(seeLoanWords("Mortgage"), "See the loan");
  assert.equal(seeLoanWords("Loan"), "See the loan");
  assert.equal(seeLoanWords("Condo loan"), "See Condo loan");
});

test("C9: the lawsuit check names its base as the tile does", () => {
  const p = migrate(emptyPlan());
  p.household.people = [{ id: "me", name: "Me", role: "self", birthDate: "1980-01-01" }];
  p.accounts = [{ id: "a", name: "Home", type: "property", balance: 900000, ownerId: "", history: [] }, { id: "k", name: "401k", type: "401k", balance: 100000, ownerId: "me", history: [] }];
  p.insurance.policies = [pol("p", "Home", "home")];
  const liab = propertyCover(p, { today: "2026-11-06" }).checks.find((c) => c.id === "liability");
  assert.equal(liab.ok, false);
  assert.equal(liab.title, "$800,000 of your net worth outside retirement accounts is not covered", "it said 'of what you own'");
});
