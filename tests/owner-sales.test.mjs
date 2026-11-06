// Sales and accounts that name their owner, filing separately (a review of 2026-10-31): the owner saved as a person's id,
// a sale named for someone on neither return, the household's gains figures built from each return, Capital gains'
// short-term tax per return, and Crypto's sentences on the returns its lots land on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, ownersToIds } from "../core/schema/migrate.js";
import { compute as computeFederal, taxInputs } from "../modules/taxes/federal/compute.js";
import { known } from "../modules/taxes/federal/known.js";
import { compute as computeGains } from "../modules/taxes/capital-gains/compute.js";
import { compute as computeCrypto } from "../modules/investments/crypto/compute.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const ago = (n) => new Date(Date.UTC(2026, 9, 30) - n * 864e5).toISOString().slice(0, 10);
const separate = () => { const p = familyPlan(TODAY); p.household.filingStatus = "married_separate"; return p; };

test("an account's owner typed as a name becomes that person's id when the plan is opened; anything else stays", () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "w1", name: "Wallet", type: "crypto", balance: 0, ownerId: " bo ", history: [] }, { id: "w2", name: "Other", type: "crypto", balance: 0, ownerId: "Grandpa", history: [] });
  ownersToIds(p);
  assert.equal(p.accounts.find((a) => a.id === "w1").ownerId, "p-bo");
  assert.equal(p.accounts.find((a) => a.id === "w2").ownerId, "Grandpa", "no such person: left as typed");
  assert.equal(p.accounts.find((a) => a.id === "a-401").ownerId, "p-ana", "an id stays an id");
  const twins = familyPlan(TODAY); twins.household.people.push({ id: "p-bo2", name: "Bo", role: "dependent", birthDate: "2015-01-01" });
  twins.accounts.push({ id: "w3", name: "Wallet", type: "crypto", balance: 0, ownerId: "Bo", history: [] });
  assert.equal(ownersToIds(twins).accounts.find((a) => a.id === "w3").ownerId, "Bo", "two people named Bo: not guessed");
  const m = familyPlan(TODAY); m.accounts[0].ownerId = "Ana"; m.schemaVersion = 1;
  assert.equal(migrate(m).accounts[0].ownerId, "p-ana", "migrate does it on every open");
});

test("filing separately, a sale named for someone on neither return is halved, as if in neither name", () => {
  const sale = { id: "g", name: "Fund", proceeds: 60000, basis: 10000, held: "long" };
  const p = separate(); p.household.people.push({ id: "p-gran", name: "Gran", role: "partner", birthDate: "1950-01-01" });
  const named = { ...p, taxes: { ...p.taxes, gains: [{ ...sale, personId: "p-gran" }] } };
  const unnamed = { ...p, taxes: { ...p.taxes, gains: [sale] } };
  near(computeFederal(named, { today: TODAY }).result.totalTax, computeFederal(unnamed, { today: TODAY }).result.totalTax);
  near(taxInputs(named, { today: TODAY }).inputs.qualifiedIncome, 50000);
});

// Ana sells for a 10,000 short-term gain, Bo for a 5,000 short-term loss, each in their own name
const owned = () => { const p = separate(); p.taxes.gains = [{ id: "ga", name: "Ana's fund", proceeds: 15000, basis: 5000, held: "short", personId: "p-ana" }, { id: "gb", name: "Bo's fund", proceeds: 0, basis: 5000, held: "short", personId: "p-bo" }]; return p; };

test("filing separately, the gains figures are each return's own: Ana's 10,000 gain stands, Bo's 5,000 loss takes 1,500 and carries 3,500", () => {
  const d = computeFederal(owned(), { today: TODAY });
  near(d.gains.netShort, 10000); near(d.gains.netLoss, -5000); near(d.gains.lossAllowed, -1500);
  near(d.gains.carryForward, -3500, 0.01);   // the worksheet on Bo's return (his taxable income is above 0): 5,000 - 1,500
  near(d.sources.find((x) => x.key === "shortGains").amount, 10000); near(d.sources.find((x) => x.key === "loss").amount, -1500);
  assert.deepEqual(d.gains.byReturn.map((x) => [x.personId, x.netShort, x.netLoss]), [["p-ana", 10000, 0], ["p-bo", 0, -5000]]);
});

test("Capital gains: the short-term tax takes Ana's 10,000 off Ana's return, not the household's 5,000 off whoever", () => {
  const p = owned(), g = computeGains(p, { today: TODAY });
  // without her sale (her pay is under the 125,000 line, so no 3.8% either way), on the return the page works on: the Federal
  // estimate's (known(): the family's 7,200 of business profit in, round 8 verify). Ana's taxable income goes 73,080 to
  // 83,080, all inside the separate 22% bracket (50,400 to 105,700, Rev. Proc. 2025-32 sec. 4.01): 2,200. Taking the
  // household's net 5,000 off whoever would say about 1,100.
  const withoutAna = { ...p, taxes: { ...p.taxes, gains: p.taxes.gains.filter((x) => x.id !== "ga") } };
  near(g.shortTax, g.taxWith - known(withoutAna, { today: TODAY }).result.totalTax);
  near(g.shortTax, 2200);
  near(g.gains.carryForward, -3500);
});

function bosWallet(p, coins) {
  p.accounts.push({ id: "w-bo", name: "Bo's wallet", type: "crypto", balance: 0, ownerId: "p-bo", history: [] });
  p.holdings = coins.map(([symbol, price, shares, cost, date], i) => ({ id: `c${i}`, accountId: "w-bo", symbol, shares, price, priceAsOf: TODAY, costBasis: cost, lots: [{ id: `l${i}`, date, shares, cost }] }));
  return p;
}

test("Crypto filing separately: the gains it adds are netted on Bo's return, where his coins are", () => {
  // a typed +4,000 short-term sale in neither name (2,000 on each return); Bo's coins: BTC +10,000 long, ETH -4,000 short.
  // On Bo's return his 2,000 and the 4,000 loss net to -2,000, which uses 2,000 of the long gain: it adds 8,000 long and cancels
  // 2,000 short (8,000 x 15% - 2,000 x 22% = 760)
  const p = bosWallet(separate(), [["BTC", 20000, 1, 10000, ago(800)], ["ETH", 1000, 4, 8000, ago(100)]]);
  p.taxes.gains = [{ id: "g", name: "Stock", proceeds: 4000, basis: 0, held: "short" }];
  const t = computeCrypto(p, { today: TODAY }).tax;
  near(t.addLong, 8000); near(t.addShort, -2000); near(t.total, 760, 0.5);
  assert.equal(t.returns, 2);
});

test("Crypto filing separately: a loss on a spouse whose return has no taxable income says so (why 'under')", () => {
  const p = bosWallet(separate(), [["ETH", 1000, 2, 4000, ago(100)]]);
  p.income = p.income.filter((x) => x.personId !== "p-bo");
  const t = computeCrypto(p, { today: TODAY }).tax;
  near(t.total, 0); near(t.carry, 2000); assert.equal(t.why, "under");
});
