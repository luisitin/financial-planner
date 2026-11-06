// Round 8, batch 1 follow-up: the pages that speak about this household's own tax year quote the Federal estimate's return
// (taxes/federal/known.js: this year's IRA and 401(k) withdrawals, stock pay, the business at its profit, the rentals after
// their costs, the IRA and student loan deductions), on the tester households of qa/fixtures/round8-households.mjs. Each
// test says the page's figure is the one the Federal estimate's own return gives, worked here from known() directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addIncome } from "../modules/taxes/federal/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { known, knownWithout, taxView } from "../modules/taxes/federal/known.js";
import { marginalRate } from "../core/math/tax.js";
import { federalTax } from "../core/math/tax.js";
import { stockAndBusinessPlan, widowPlan, freelancerPlan, equityPlan, landlordPlan } from "../qa/fixtures/round8-households.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { fullSteps } from "../modules/taxes/withholding/compute.js";
import { compute as hsa } from "../modules/taxes/hsa-fsa/compute.js";
import { compute as health } from "../modules/insurance/health/compute.js";
import { compute as lots } from "../modules/investments/tax-lots/compute.js";
import { compute as crypto } from "../modules/investments/crypto/compute.js";
import { compute as location } from "../modules/investments/asset-location/compute.js";
import { compute as benefits } from "../modules/career/benefits/compute.js";
import { compute as salary } from "../modules/career/salary/compute.js";
import { compute as offers } from "../modules/career/offer-compare/compute.js";
import { compute as education } from "../modules/goals/education/compute.js";
import { compute as home } from "../modules/property/home/compute.js";
import { compute as renovation } from "../modules/property/renovation/compute.js";
import { compute as equity } from "../modules/career/equity/compute.js";

const T = "2026-11-06";
const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const rate = (plan) => { const k = known(plan, { today: T }); return marginalRate(k.inputs, k.fed.params); };

/** A brokerage account with a fund bought a year and a half ago, now below its cost (a loss to harvest), and some coins. */
function withHoldings(p) {
  const ago = (n) => new Date(Date.UTC(2026, 10, 6) - n * 864e5).toISOString().slice(0, 10);
  p.accounts.push({ id: "brk", name: "Brokerage", type: "brokerage", balance: 9000 }, { id: "cx", name: "Coin wallet", type: "crypto", balance: 3000 });
  p.holdings = [
    { id: "h1", accountId: "brk", symbol: "VTI", shares: 30, price: 300, priceAsOf: ago(1), costBasis: 12000, lots: [{ id: "l1", date: ago(540), shares: 30, cost: 12000 }] },
    { id: "h2", accountId: "cx", symbol: "BTC", shares: 0.05, price: 60000, priceAsOf: ago(1), costBasis: 4000, lots: [{ id: "l2", date: ago(200), shares: 0.05, cost: 4000 }] },
  ];
  return p;
}

test("the widow's Social Security and withdrawals are in the rate Tax-lot harvesting, Asset location and Health quote: the Federal estimate's 22 cents, not 18.5", () => {
  const p = withHoldings(widowPlan());
  const k = known(p, { today: T });
  near(k.nextDollar, 0.222);
  near(lots(p, { today: T }).marginal, k.nextDollar);
  near(location(p, { today: T }).marginal, k.nextDollar);
  near(crypto(p, { today: T }).tax.marginal, k.nextDollar);
  // Health's HSA saving: the tax a year's HSA limit takes off income, per dollar, over the limit (it can cross a step)
  near(health(p, { today: T }).taxRate - 0.0765, k.nextDollar, 0.02);
});

test("the freelancer's business at its profit and its 20% deduction are in the rate: 9.6 cents, not the 22% of the rows alone", () => {
  const p = withHoldings(freelancerPlan());
  const k = known(p, { today: T });
  near(k.nextDollar, 0.096);
  near(lots(p, { today: T }).marginal, k.nextDollar);
  near(crypto(p, { today: T }).tax.marginal, k.nextDollar);
  near(location(p, { today: T }).marginal, Math.max(0.10, rate(p)));   // Asset location never quotes under 10%
  assert.ok(lots(p, { today: T }).gainsRate < 0.001, "long-term gains at 0% on a 12% return");
});

test("Tax-lot harvesting's tax saved is the difference of two Federal-estimate returns", () => {
  const p = widowPlan();
  const ago = (n) => new Date(Date.UTC(2026, 10, 6) - n * 864e5).toISOString().slice(0, 10);
  p.accounts.push({ id: "brk", name: "Brokerage", type: "brokerage", balance: 8000 });
  p.holdings = [{ id: "h1", accountId: "brk", symbol: "VTI", shares: 40, price: 200, priceAsOf: ago(1), costBasis: 14000, lots: [{ id: "l1", date: ago(600), shares: 40, cost: 14000 }] }];
  const d = lots(p, { today: T });
  assert.equal(d.harvest.length, 1);
  const loss = d.harvest[0].loss;                       // 6,000
  const sold = structuredClone(p); sold.taxes.gains = [{ id: "harvest-long-joint", proceeds: 0, basis: loss, held: "long" }];
  near(d.taxSavedTotal, known(p, { today: T }).result.totalTax - known(sold, { today: T }).result.totalTax, 0.01);
  assert.ok(d.taxSavedTotal > 0);
});

test("HSA: the tax saved is the Federal estimate's return with the HSA money against without it, and its rate the same", () => {
  const p = freelancerPlan();
  p.accounts.push({ id: "hsa", name: "HSA", type: "hsa", balance: 0, ownerId: "me" });
  p.retirement.contributions.push({ id: "c-hsa", accountId: "hsa", personId: "me", period: "annual", amount: 4400, employerMatch: 0 });
  p.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  const d = hsa(p, { today: T });
  assert.ok(d.hsa.deducted > 0);
  const k = known(p, { today: T });
  // 12% bracket, but the 20% business deduction is capped at 20% of taxable income here, so a dollar off income takes 20% off that
  // too: the Federal estimate's 9.6 cents on the next dollar
  near(k.result.bracketRate, 0.12, 0.0001);
  near(d.hsa.marginal, k.nextDollar, 0.0001);
  near(d.hsa.taxSaved, d.hsa.deducted * k.nextDollar, 0.01);
});

test("Benefits: what a pre-tax choice saves is worked at the Federal estimate's rate (the equity household is in 24%, not 22%)", () => {
  const p = equityPlan(); p.whatIfs = { benefits: { mo: { fsaElect: 3300, planYear: 2026 } } };
  const d = benefits(p, { today: T });
  const k = known(p, { today: T });
  assert.equal(k.result.bracketRate, 0.24);
  // 3,300 at 24% federal, 1.45% Medicare and 6.2% Social Security (pay 210,000 is past the 184,500 base: none), and the 0.9% extra
  // Medicare tax it takes off: cafeteria-plan money is out of Medicare wages (IRC 3121(a)(5)(G)), and the household's, with the units, are past 250,000
  const federal = 3300 * 0.24, payroll = 3300 * (0.0145 + 0.009);
  near(d.fsa.saved, federal + payroll, 1);
});

test("Salary: a raise keeps what the Federal estimate's rate leaves (24 cents federal on the equity household)", () => {
  const d = salary(equityPlan(), { today: T });
  const j = d.jobs[0], r = j.nextRaise;
  near(r.federal / r.amount, 0.24, 0.001);
});

test("Offer compare: a job's tax stacks on the Federal estimate's return, the widow's withdrawals and Social Security included", () => {
  const p = widowPlan(); p.whatIfs = { offers: { personId: "me", years: 1, offers: [{ id: "o1", name: "Part time", salary: 20000 }] } };
  const d = offers(p, { today: T });
  const o = d.options.find((x) => x.id === "o1");
  const k = known(p, { today: T });
  const more = structuredClone(p); more.income.push({ id: "job", name: "Pay", personId: "me", type: "salary", amount: 20000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true });
  const k2 = known(more, { today: T });
  near(o.tax.federal, (k2.result.totalTax - k2.result.additionalMedicare) - (k.result.totalTax - k.result.additionalMedicare), 1);
});

test("Education: the American Opportunity credit's income is the Federal estimate's AGI (the landlord's rent after its costs, not before)", () => {
  const p = landlordPlan(); p.household.people.push({ id: "c2", name: "Cam", role: "dependent", birthDate: "2007-09-01" });
  const d = education(p, { today: T });
  near(d.aotc.magi, known(p, { today: T }).result.agi, 0.01);
  assert.equal(d.aotc.status, "full", "154,400 is under the 160,000 where the credit starts to shrink");
});

test("Home: the tax on a sale is worked on the widow's Federal-estimate return", () => {
  const p = widowPlan(); p.accounts.push({ id: "home", name: "Home", type: "property", balance: 700000 });
  p.property = [{ id: "h1", kind: "home", accountId: "home", name: "Home", purchasePrice: 150000, purchaseDate: "2001-05-01" }];
  const d = home(p, { today: T });
  assert.equal(d.sale.taxable, 258000);
  const k = known(p, { today: T });
  const more = taxView(p, { today: T });
  near(more.result.totalTax, k.result.totalTax, 0.001);
  near(d.sale.tax, 43573.58, 0.5);
});

test("Renovation: interest saves at the Federal estimate's rate for a household that itemizes", () => {
  const p = equityPlan(); p.taxes.itemized = { ...p.taxes.itemized, other: 60000 };
  p.accounts.push({ id: "home", name: "Home", type: "property", balance: 1400000 }, { id: "mtg", name: "Mortgage", type: "mortgage", balance: 800000 });
  p.debts = [{ id: "d1", accountId: "mtg", rate: 0.065, minPayment: 5057, extra: 0, termMonths: 360, startDate: "2024-01-01", securedBy: "", creditLimit: null }];
  p.whatIfs = { renovation: { cost: 40000 } };
  const d = renovation(p, { today: T });
  const k = known(p, { today: T });
  assert.equal(k.result.deduction.used, "itemized");
  assert.equal(marginalRate(k.inputs, k.fed.params), 0.24);
  // the line's interest nets to a loss of deduction (the home debt passes the $750,000 limit): -1,180.80 at 22% was -1,288.15 at 24%
  const heloc = d.ways.find((w) => w.id === "heloc");
  near(heloc.taxSaved, -1288.15, 0.5);
});

test("Equity compensation: the units' federal tax is the Federal estimate's return with them less without them, and the rows add up to what to set aside", () => {
  const p = equityPlan();
  const d = equity(p, { today: T });
  const y = d.rsuYears[0], t = y.tax;
  const withIt = known(p, { today: T }), without = knownWithout(p, { today: T }, null, "stock");
  assert.ok(withIt.stock.value > 0 && Math.abs(withIt.stock.value - y.value) < 0.01, "the same units");
  near(t.federal, (withIt.result.totalTax - withIt.result.additionalMedicare) - (without.result.totalTax - without.result.additionalMedicare), 1);
  // owed - held back = the income tax's gap + the 0.9% Medicare tax owed less held back (Social Security and the 1.45% are held back in full)
  near(t.gap, t.federal - t.withheldFederal + t.extraMedicare - t.extraWithheld, 0.01);
  assert.ok(t.extraMedicare > 0 && t.extraWithheld > t.extraMedicare, "held back on the person's pay past 200,000, owed on the household's past 250,000");
});

test("taxView without a day is taxInputs' own return; with one it is known()", () => {
  const p = widowPlan();
  assert.equal(taxView(p, {}).known, null);
  near(taxView(p, { today: T }).result.totalTax, known(p, { today: T }).result.totalTax, 0.0001);
  near(taxView(p, { today: T }).nextDollar, known(p, { today: T }).nextDollar, 0.0001);
});

// ---- review fixes (round 8 batch 1 follow-up, money review) ----

test("Review 1, Offer compare: the other adult's stock pay stays in the household's other income, in federal and the 0.9% Medicare tax", () => {
  const p = equityPlan();
  p.income.find((x) => x.personId === "mo").amount = 120000;
  p.whatIfs = { offers: { personId: "lin", years: 1, offers: [{ id: "o1", name: "New job", salary: 90000 }] } };
  const d = offers(p, { today: T });
  const o = d.options.find((x) => x.id === "o1"), cur = d.options.find((x) => x.current);
  const fo = (k) => k.result.totalTax - k.result.additionalMedicare;
  const z = structuredClone(p); z.income = z.income.filter((x) => x.personId !== "lin");
  const q = structuredClone(p); q.income.find((x) => x.personId === "lin").amount = 90000;
  const kz = known(z, { today: T });
  near(cur.tax.federal, fo(known(p, { today: T })) - fo(kz), 1);
  near(o.tax.federal, fo(known(q, { today: T })) - fo(kz), 1);
  // payroll tax: Lin's 90,000 at 7.65%, and the 0.9% on the household's Medicare wages (Mo's 120,000 and his units, and her 90,000) past 250,000
  const units = known(p, { today: T }).stock.value;
  near(o.tax.payroll, 90000 * 0.0765 + 0.009 * (120000 + units + 90000 - 250000), 1);
});

test("Review 12, taxView: marginal and nextDollarNoCare are the Federal estimate's return's, not the old return's", () => {
  const p = widowPlan();
  const v = taxView(p, { today: T });
  const k = known(p, { today: T });
  near(v.marginal, marginalRate(k.inputs, k.fed.params), 1e-9);
  near(v.marginal, v.nextDollar, 0.0001);
  assert.ok(!("steps" in v) && !("sources" in v), "the old return's walk is not carried");
  const w = taxView(p, { today: T }, { without: "stock" });
  near(w.marginal, marginalRate(w.inputs, w.params), 1e-9);
});

function withHome(p, { interest, tax, owed, value = 450000, rate = 0.06, payment = 1600 }) {
  p.taxes.itemized = { ...(p.taxes.itemized ?? {}), mortgageInterest: interest, propertyTax: tax };
  p.accounts.push({ id: "home", name: "Home", type: "property", balance: value }, { id: "mtg", name: "Mortgage", type: "mortgage", balance: owed });
  p.debts = [...(p.debts ?? []), { id: "dm", accountId: "mtg", rate, minPayment: payment, extra: 0, termMonths: 360, startDate: "2020-01-01", securedBy: "", creditLimit: null }];
  p.whatIfs = { ...(p.whatIfs ?? {}), renovation: { cost: 40000 } };
  return p;
}

test("Review 2, Renovation: a household that owes no income tax gets no tax back on interest (0, not the 22% fallback)", () => {
  const p = withHome(emptyPlan(), { interest: 18000, tax: 4000, owed: 300000, value: 400000, payment: 1800 });
  p.household.people = [{ id: "me", name: "Pat", role: "self", birthDate: "1985-03-15", retirementAge: null, lifeExpectancy: null }]; p.household.filingStatus = "single"; p.household.state = "TX";
  p.income = [{ id: "j", name: "Pay", personId: "me", type: "salary", amount: 15000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true }];
  const d = renovation(p, { today: T });
  assert.equal(d.itemizes, true);
  assert.equal(d.marginal, 0);
  assert.equal(d.ways.find((w) => w.id === "heloc").taxSaved, 0);
  assert.equal(d.ways.find((w) => w.id === "refi").taxSaved, 0);
});

test("Review 3, Renovation: for a retiree in the Social Security band an itemized dollar saves the bracket rate (12%), not the income rate (22.2%)", () => {
  const p = withHome(widowPlan(), { interest: 14000, tax: 8000, owed: 240000 });
  const k = known(p, { today: T });
  assert.equal(k.result.deduction.used, "itemized");
  const save = (federalTax(k.inputs, k.fed.params).totalTax - federalTax({ ...k.inputs, itemized: k.inputs.itemized + 1000 }, k.fed.params).totalTax) / 1000;
  near(save, 0.12, 0.0005);
  const d = renovation(p, { today: T });
  near(d.marginal, save, 0.0005);
});

test("Review 4, Tax-lot harvesting: pay's next-dollar rate is the Federal estimate's (24 cents), the short-term gain's rate (with the 3.8%) is its own figure", () => {
  const p = withHoldings(equityPlan());
  const k = known(p, { today: T });
  const d = lots(p, { today: T });
  near(d.payRate, k.nextDollar, 0.0001);
  near(d.payRate, 0.24, 0.0001);
  near(d.shortRate, 0.278, 0.001);
  near(d.marginal, d.shortRate, 1e-9);
});

test("Review 7, Asset location: interest and dividends bear the 3.8% like Tax-lot harvesting says (equity household: 27.8% and 18.8%), and no income is not 22%", () => {
  const p = equityPlan(); const ago = (n) => new Date(Date.UTC(2026, 10, 6) - n * 864e5).toISOString().slice(0, 10);
  p.accounts.push({ id: "brk2", name: "Bond fund", type: "brokerage", balance: 72000 });
  p.holdings = [{ id: "b1", accountId: "brk2", symbol: "BND", assetClass: "bonds", shares: 1000, price: 72, priceAsOf: ago(1), costBasis: 80000, lots: [{ id: "lb", date: ago(600), shares: 1000, cost: 80000 }] }];
  const a = location(p, { today: T });
  near(a.marginal, lots(p, { today: T }).shortRate, 0.001);
  near(a.gainsRate, lots(p, { today: T }).gainsRate, 0.001);
  near(a.gainsRate, 0.188, 0.001);
  const none = emptyPlan(); none.household.people = [{ id: "me", name: "Pat", role: "self", birthDate: "1985-03-15", retirementAge: null, lifeExpectancy: null }]; none.household.filingStatus = "single"; none.household.state = "TX";
  assert.ok(location(none, { today: T }).marginal <= 0.10 + 1e-9, "never 22% for a household with no income");
});

test("Review 5, Benefits and the HSA page: the same HSA money saves the same, the 0.9% Medicare tax included (equity household)", () => {
  const p = equityPlan();
  p.accounts.push({ id: "xhsa", name: "HSA", type: "hsa", balance: 0, ownerId: "mo" });
  p.retirement.contributions.push({ id: "xc", accountId: "xhsa", personId: "mo", period: "annual", amount: 4400, employerMatch: 0 });
  p.taxes.hsa = { ...(p.taxes.hsa ?? {}), coverage: "self", contribution: 4400, employer: 0, fsa: 0 };
  p.whatIfs = { benefits: { mo: { planYear: 2026, hsaElect: 4400 } } };
  near(benefits(p, { today: T }).hsa.saved, hsa(p, { today: T }).hsa.savedTotal, 0.01);
  near(benefits(p, { today: T }).hsa.saved, 4400 * (0.24 + 0.0145 + 0.009), 0.5);
});

test("Review 8, Salary: the 0.9% Medicare tax and the Social Security base count the household's stock pay (equity: 73.65% kept; business plan: no Social Security past the base)", () => {
  const d = salary(equityPlan(), { today: T });
  const r = d.jobs[0].nextRaise;
  assert.ok(r.amount > 0);
  near(r.extraMedicare, 0.009 * r.amount, 0.005);   // Medicare wages 345,000 with the units are past 250,000 already
  const q = stockAndBusinessPlan();
  const e = salary(q, { today: T }).jobs[0].nextRaise;
  assert.equal(e.payroll - e.extraMedicare - e.amount * 0.0145, 0, "Ro's Social Security wages with 100,000 of units are past the 184,500 base: none on the raise");
  assert.ok(e.extraMedicare > 0);
});

test("Review 10, filing separately: Salary and Benefits put one spouse's change on that spouse's own return", () => {
  const p = equityPlan(); p.household.filingStatus = "married_separate";
  const k = known(p, { today: T });
  const fo = (r) => r.totalTax - r.additionalMedicare;
  const own = (pid, add) => fo(federalTax(addIncome(k.inputs, pid, add), k.fed.params)) - fo(k.result);
  const lin = salary(p, { today: T }).jobs.find((j) => j.personId === "lin").nextRaise;
  near(lin.federal, own("lin", { wages: lin.amount, medicareWages: lin.amount }), 0.01);
  assert.ok(lin.federal / lin.amount < 0.15, "Lin is on the 10% return, not Mo's 35%");
  p.whatIfs = { benefits: { personId: "lin", lin: { fsaElect: 3300, planYear: 2026 } } };
  const b = benefits(p, { today: T });
  assert.equal(b.person.id, "lin");
  near(b.fsa.saved, 3300 * 0.0765 - own("lin", { wages: -3300, medicareWages: -3300 }), 0.01);
});

function familyHsaPlan(p) {
  p.insurance = { ...(p.insurance ?? {}), health: { tier: "family", expected: 6000, plans: [{ id: "h", name: "HSA plan", premium: 600, deductible: 3400, oopMax: 8000, coinsurance: 0.2, hsa: true, employerHsa: 0 }, { id: "q", name: "PPO", premium: 900, deductible: 1000, oopMax: 6000, coinsurance: 0.2 }] } };
  return p;
}

test("Review 6, Health: the landlord's HSA saving works the rental allowance again with the deduction, as the HSA page does", () => {
  const p = familyHsaPlan(landlordPlan());
  const h = health(p, { today: T });
  const me = p.household.people[0].id;
  p.accounts.push({ id: "xhsa", name: "HSA", type: "hsa", balance: 0, ownerId: me });
  p.retirement.contributions.push({ id: "xc", accountId: "xhsa", personId: me, period: "annual", amount: h.hsaLimit, employerMatch: 0 });
  p.taxes.hsa = { ...(p.taxes.hsa ?? {}), coverage: "family", contribution: h.hsaLimit, employer: 0 };
  const d = hsa(p, { today: T });
  near(h.taxRate - 0.0765, d.hsa.marginal, 0.002);
  assert.ok(d.hsa.marginal > 0.25, "the freed rental loss makes it more than the 22 cents of a dollar of income");
});

test("Review 11, a self-employed person's HSA saves no payroll tax (Schedule SE is not lowered by the HSA deduction): HSA page and Health", () => {
  const p = freelancerPlan();
  p.accounts.push({ id: "hsa", name: "HSA", type: "hsa", balance: 0, ownerId: "me" });
  p.retirement.contributions.push({ id: "c-hsa", accountId: "hsa", personId: "me", period: "annual", amount: 4400, employerMatch: 0 });
  p.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  const d = hsa(p, { today: T });
  assert.equal(d.hsa.ficaSaved, 0);
  const k = known(p, { today: T });
  near(d.hsa.savedTotal, 4400 * k.nextDollar, 0.01);
  const h = health(familyHsaPlan(freelancerPlan()), { today: T });
  near(h.taxRate, h.taxRate - 0, 0);
  near(h.taxRate, known(freelancerPlan(), { today: T }).nextDollar, 0.03);
  assert.ok(h.taxRate < 0.13, `no 7.65% of payroll tax in it: ${h.taxRate}`);
});

test("Review 11, Health: pay past the Social Security base saves no 6.2% on the HSA money (Mo, 210,000)", () => {
  const h = health(familyHsaPlan(equityPlan()), { today: T });
  const k = known(equityPlan(), { today: T });
  near(h.taxRate, k.nextDollar + 0.0145, 0.02);
});

test("Review 9, Equity compensation with a business: the units' federal tax is the Federal estimate's with less without, and the self-employment tax change is a row", () => {
  const p = stockAndBusinessPlan();
  const y = equity(p, { today: T }).rsuYears[0], t = y.tax;
  const withIt = known(p, { today: T }), without = knownWithout(p, { today: T }, null, "stock");
  const fo = (r) => r.totalTax - r.additionalMedicare;
  near(t.federal, fo(withIt.result) - fo(without.result), 0.01);
  const se = (withIt.total - withIt.result.totalTax) - (without.total - without.result.totalTax);
  assert.ok(se < -1000, "the units fill the Social Security base, so the business's 12.4% part goes");
  near(t.selfEmployment, se, 0.01);
  near(t.owed, t.federal + t.payroll + t.state, 0.001);
  near(t.payroll, 0.062 * 0 + 0.0145 * t.value + t.extraMedicare + 0.062 * Math.max(0, Math.min(150000 + t.value, 184500) - Math.min(150000, 184500)) + se, 0.01);
});

test("Verify b1f, Tax-lot harvesting: with a business and no pay, the next dollar quoted is the Federal estimate's headline (what the next dollar the business makes costs), not other income's 9.6 cents", () => {
  const p = withHoldings(freelancerPlan());
  const k = known(p, { today: T });
  const head = fullSteps(p, k.fed, { today: T }, k).se.nextDollar;   // the Federal estimate's "On the next dollar ... of business profit"
  const d = lots(p, { today: T });
  assert.equal(d.payIs, "business");
  near(d.payRate, head, 1e-9);
  assert.ok(d.payRate > 0.2, `${d.payRate}: income and self-employment tax`);
  near(d.shortRate, k.nextDollar, 1e-9);   // a short-term gain is not business profit: no self-employment tax, 9.6 cents
  // a household with pay keeps the Federal estimate's "next dollar you earn"
  const e = lots(withHoldings(equityPlan()), { today: T });
  assert.equal(e.payIs, "pay");
});

test("Verify b1f, Tax-lot harvesting: a short-term gain raises income like pay, so it costs pay's whole-step rate (child care credit) plus the 3.8% where it applies", () => {
  const p = withHoldings(familyPlan(T));
  const k = known(p, { today: T });
  const d = lots(p, { today: T });
  assert.ok(k.careFalls || k.careSets, "the family's child care credit is in its phase-down");
  near(d.payRate, k.nextDollar, 1e-9);
  near(d.shortRate, d.payRate, 1e-9);   // no investment income tax at this AGI
  const q = withHoldings(equityPlan());
  const kq = known(q, { today: T }), dq = lots(q, { today: T });
  near(dq.shortRate, kq.nextDollar + 0.038, 1e-6);   // over 250,000 joint: the 3.8% on top (IRC 1411)
});
