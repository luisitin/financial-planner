// Money before 59½ (gap design #38, 2026-11-14): the extra 10% in the engine, the age-55 rule, the equal payments' sums, the
// page's sentences one case at a time, and its drawing. The invariance check over every invented household is
// tests/early-invariance.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { project } from "../../../core/math/retirement.js";
import { EARLY_RATE, shareBefore59Half, halfYear, leftAt55Year, seppAmortized, seppRecalculated, seppRateCap, seppLastYear, earlyShares } from "../../../core/math/early.js";
import { singleLife } from "../../../core/math/rmd.js";
import { shareBefore59Half as fedShare, leftWorkAt55 as fedLeft, EARLY_RATE as FED_RATE } from "../../taxes/federal/known.js";
import { buildInputs, earlyInputs, seppOf, earlyNote, earlyTaxWords, taxSettings, compute as projection } from "../projection/compute.js";
import { compute, answerWords, at55Words, equalWords, ruleWords, methodWords, yearlyCheckWords, savedWords, setSepp, clearSepp, halfMonth, acctWords, RATE_CHIPS } from "./compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const T = "2026-11-14";
const near = (a, b, tol = 0.01, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} is not ${b}`);
// an invented early retiree: born March 1976, a 401(k), an IRA, some savings
const early = (ra = 52, extra = {}) => {
  const p = migrate(emptyPlan());
  p.household.people = [{ id: "a", name: "Me", role: "self", birthDate: "1976-03-10", ...(ra ? { retirementAge: ra } : {}) }];
  p.accounts = [{ id: "c", name: "Savings", type: "savings", balance: 60000 }, { id: "b", name: "Brokerage", type: "brokerage", balance: 150000 },
    { id: "k", name: "401(k)", type: "401k", balance: 900000, ownerId: "a" }, { id: "i", name: "IRA", type: "ira", balance: 300000, ownerId: "a" }];
  p.retirement.spendingMonthly = 5000;
  Object.assign(p.retirement, extra);
  return p;
};
// the engine alone: one person of 50 who has stopped work, $1,000,000 pre-tax, $40,000 a year, no growth, no prices, no income tax
const flat = (over = {}) => ({ startYear: 2026, endYear: 2040, people: [{ name: "A", birthYear: 1976, retireAge: 50, endAge: 64 }], balances: { cash: 0, taxable: 0, deferred: 1000000, free: 0 },
  contributions: [], incomes: [], spending: { yearly: 40000 }, retireYear: 2026, rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0, stocksNow: 0.5, stocksRetired: 0.5 },
  returns: { stocks: 0, bonds: 0 }, rmd: null, strategy: "fixed-real", ...over });
const owner = { personIndex: 0, halfYear: 2035, halfShare: 0.5, leftYear: null, at55Part: 0, share: 1 };

// ---- 1. the 10% only on pre-tax draws under 59½ -------------------------------------------------------------------------
test("engine: a pre-tax withdrawal before 59½ owes 10% on top, paid like the rest of the year's tax; none after", () => {
  const r = project(flat({ early: { owners: [owner] } }));
  const y = (n) => r.rows.find((x) => x.year === n);
  // 2026: W - 0.1 W = 40,000, so W = 44,444.44 and the 10% is 4,444.44
  near(y(2026).withdrawn.deferred, 40000 / 0.9); near(y(2026).earlyTax, 4444.44); near(y(2026).taxes, 4444.44); near(y(2026).earlyDrawn, 44444.44);
  // 2035, half the year before 59½: W - 0.05 W = 40,000, so W = 42,105.26 and the 10% on half of it is 2,105.26
  near(y(2035).withdrawn.deferred, 40000 / 0.95); near(y(2035).earlyTax, 2105.26);
  assert.equal(y(2036).earlyTax, undefined, "past 59½: no field at all"); assert.equal(y(2036).withdrawn.deferred, 40000); assert.equal(y(2036).taxes, 0);
  near(r.totalEarlyTax, 9 * 4444.444 + 2105.263, 0.05);
  assert.equal(EARLY_RATE, 0.1); assert.equal(EARLY_RATE, FED_RATE, "the Federal estimate's own rate");
});
test("engine: cash, taxable and Roth money owe none of it; nor does a required withdrawal; with no `early` nothing is charged", () => {
  const r = project(flat({ balances: { cash: 40000, taxable: 40000, deferred: 0, free: 500000 }, early: { owners: [owner] } }));
  assert.ok(r.rows.every((x) => x.earlyTax === undefined && x.taxes === 0)); assert.equal(r.totalEarlyTax, undefined);
  const plain = project(flat());
  assert.ok(plain.rows.every((x) => x.earlyTax === undefined && x.sepp === undefined && x.early55 === undefined)); assert.equal("totalEarlyTax" in plain, false);
  assert.equal(plain.rows[0].withdrawn.deferred, 40000);
  // a couple: the older one's required withdrawal while the younger is under 59½ is not an early withdrawal
  const couple = flat({ people: [{ name: "A", birthYear: 1976, retireAge: 50, endAge: 64 }, { name: "B", birthYear: 1950, retireAge: 60, endAge: 90 }], spending: { yearly: 0 },
    rmd: { birthYear: 1976, startAge: 75, owners: [{ personIndex: 0, share: 0, startAge: 75 }, { personIndex: 1, share: 1, startAge: 72 }] },
    early: { owners: [{ ...owner, share: 0 }] } });
  const c = project(couple);
  assert.ok(c.rows[0].rmd > 0); assert.equal(c.rows[0].earlyTax, undefined);
});
test("engine: with the tax brackets the 10% comes on top of the income tax", () => {
  const tax = taxSettings(early(52), { mode: "brackets" });
  const a = project(flat({ tax })), b = project(flat({ tax, early: { owners: [owner] } }));
  const ra = a.rows[0], rb = b.rows[0];
  near(rb.earlyTax, 0.1 * rb.withdrawn.deferred, 0.01);
  assert.ok(rb.taxes - rb.earlyTax > ra.taxes, "more comes out to pay the 10%, and that is income too");
  near(rb.withdrawn.deferred - rb.taxes, 40000, 0.01, "what is left pays the year's spending");
});

// ---- 2. the age-55 rule ---------------------------------------------------------------------------------------------------
test("engine: the 401(k) of a job left at 55 or later owes none; an IRA beside it still does", () => {
  const all = project(flat({ early: { owners: [{ ...owner, leftYear: 2026, at55Part: 1 }] } }));
  assert.equal(all.rows[0].earlyTax, undefined); near(all.rows[0].early55, 40000); assert.equal(all.rows[0].withdrawn.deferred, 40000);
  // three quarters in the 401(k): W - 0.1 x 0.25 W = 40,000, so W = 41,025.64; 1,025.64 of tax; 30,769.23 spared
  const part = project(flat({ early: { owners: [{ ...owner, leftYear: 2026, at55Part: 0.75 }] } }));
  near(part.rows[0].withdrawn.deferred, 40000 / 0.975); near(part.rows[0].earlyTax, 1025.64); near(part.rows[0].early55, 30769.23);
  // before the year they leave, the rule does not apply yet
  const later = project(flat({ early: { owners: [{ ...owner, leftYear: 2031, at55Part: 1 }] } }));
  near(later.rows[0].earlyTax, 4444.44); assert.equal(later.rows.find((x) => x.year === 2031).earlyTax, undefined);
  assert.deepEqual(earlyShares([{ ...owner, leftYear: 2031, at55Part: 0.75 }], 2031), { owes: 0.25, at55: 0.75 });
  assert.deepEqual(earlyShares([owner], 2036), { owes: 0, at55: 0 });
});
test("the plan's flag: the Federal estimate's leftWorkAt55 rule decides it (a typed retirement age of 55 or more)", () => {
  const at = (ra) => buildInputs(early(ra), { today: T }).inputs.early.owners[0];
  assert.equal(at(52).leftYear, null); assert.equal(at(52).at55Part, 0);
  assert.equal(at(56).leftYear, 1976 + 56); assert.equal(at(56).at55Part, 0.75, "$900,000 of $1,200,000 is in the 401(k)");
  assert.equal(at(null).leftYear, null, "no age typed on People: the rule is not assumed");
  assert.equal(at(52).halfYear, 2035); near(at(52).halfShare, 252 / 365, 1e-9, "59½ on September 10, 2035: 252 days of the year before it");
  // the two date rules written again in core/math/early.js give the Federal estimate's answers
  for (const birthDate of ["1966-01-01", "1970-06-30", "1970-07-01", "1976-03-10", "1976-12-31", "1980-02-29"]) for (let y = 2020; y <= 2045; y++) {
    assert.equal(shareBefore59Half(birthDate, y), fedShare({ birthDate }, y), `${birthDate} ${y}`);
    for (const ra of [undefined, "", 50, 54, 55, 56, 62]) { const p = { birthDate, retirementAge: ra }, ly = leftAt55Year(p); assert.equal(ly !== null && ly <= y, fedLeft(p, y), `${birthDate} ${ra} ${y}`); }
  }
  assert.deepEqual(halfYear("1976-07-01"), { year: 2035, share: 1 }, "59½ on January 1, 2036: all of 2035 is before it");
  assert.equal(halfYear("1976-12-31").year, 2036); assert.equal(halfYear(null), null);
  assert.equal(halfMonth("1976-03-10"), "September 2035"); assert.equal(halfMonth("1976-08-02"), "February 2036");
  // six months after the 29th, 30th or 31st, in a month too short for it: that month's last day (critic F4: August 31 gave March 3)
  near(shareBefore59Half("1967-08-31", 2027), 58 / 365, 1e-12); near(fedShare({ birthDate: "1967-08-31" }, 2027), 58 / 365, 1e-12);
  near(shareBefore59Half("1968-08-30", 2028), 59 / 366, 1e-12); near(shareBefore59Half("1967-03-31", 2026), 272 / 365, 1e-12); near(shareBefore59Half("1967-12-31", 2027), 180 / 365, 1e-12);
  assert.deepEqual(halfYear("1967-08-31"), { year: 2027, share: 58 / 365 });
});
test("the plan's input: only when someone who owns or adds to a 401(k) or IRA is still under 59½, or equal payments are set", () => {
  assert.equal("early" in buildInputs(familyPlan(T), { today: T }).inputs, true, "the family's adults are under 59½");
  const old = early(65); old.household.people[0].birthDate = "1960-01-01";
  assert.equal("early" in buildInputs(old, { today: T }).inputs, false, "past 59½: no key");
  const none = early(52); none.accounts = none.accounts.slice(0, 2);
  assert.equal("early" in buildInputs(none, { today: T }).inputs, false, "no 401(k) or IRA: no key");
  assert.equal(earlyInputs(old, [{ id: "a", birthYear: 1960 }], 1200000, 2026), null);
});

// ---- 3 and 4. equal payments ------------------------------------------------------------------------------------------------
test("equal payments, the same each year: $500,000 at 5% from 52 is $30,772.60 a year (by hand)", () => {
  // the Single Life Table at 52 is 34.3. 1.05^34.3 = e^(34.3 x 0.04879016) = e^1.6735026 = 5.33080; 1 - 1/5.33080 = 0.812411;
  // 500,000 x 0.05 / 0.812411 = 30,772.6
  assert.equal(singleLife(52), 34.3);
  near(seppAmortized(500000, 0.05, 52), 30772.6, 0.05);
  near(seppAmortized(500000, 0.05, 52), 25000 / (1 - Math.exp(-34.3 * Math.log(1.05))), 1e-6);
  near(seppAmortized(500000, 0, 52), 500000 / 34.3, 1e-9, "no interest: the balance over the years");
  assert.equal(seppAmortized(0, 0.05, 52), 0);
  assert.equal(seppRateCap(), 0.05); assert.equal(seppRateCap(0.043), 0.05); assert.equal(seppRateCap(0.0562), 0.0562, "120% of the mid-term rate, when a person types one above 5%");
});
test("equal payments, recalculated each year: the balance over the table's figure at each age", () => {
  near(seppRecalculated(500000, 52), 14577.26);   // 500,000 / 34.3
  // in the engine, from 2027 (age 51, 35.3) with no growth: 500,000 / 35.3 = 14,164.31; then 485,835.69 / 34.3 = 14,164.31;
  // then 471,671.39 / 33.4 = 14,121.90: it is worked out again every year
  const r = project(flat({ early: { owners: [owner], sepp: { personIndex: 0, share: 0.5, startYear: 2027, method: "rmd", rate: 0.05, halfYear: 2035 } } }));
  const y = (n) => r.rows.find((x) => x.year === n);
  assert.equal(y(2026).sepp, undefined); near(y(2027).sepp, 14164.31); near(y(2028).sepp, 14164.31); near(y(2029).sepp, 471671.39 / 33.4); near(y(2029).sepp, 14121.9);
  assert.equal(y(2035).sepp > 0, true, "the year 59½ is reached still has a payment"); assert.equal(y(2036).sepp, undefined);
  // the payment owes no 10%; the rest of the year's draw does: (W - 14,164.31) x 0.1 with W - tax = 40,000
  near(y(2027).earlyTax, (40000 - 14164.31) / 0.9 * 0.1, 0.01);
});
test("equal payments in the engine: one amount fixed in the first year, to the later of five years and 59½; what is not needed is saved", () => {
  const sepp = { personIndex: 0, share: 0.5, startYear: 2033, method: "amortization", rate: 0.05, halfYear: 2035 };
  const r = project(flat({ early: { owners: [owner], sepp } }));
  const paid = r.rows.filter((x) => x.sepp > 0);
  assert.deepEqual(paid.map((x) => x.year), [2033, 2034, 2035, 2036, 2037], "five payments: past 59½, because five years is later");
  assert.ok(paid.every((x) => Math.abs(x.sepp - paid[0].sepp) < 1e-9), "the same every year");
  near(paid[0].sepp, seppAmortized(500000, 0.05, 57), 1e-6);
  // a payment bigger than the year needs lands in taxable savings, with no 10%
  const big = project(flat({ spending: { yearly: 10000 }, early: { owners: [owner], sepp: { ...sepp, startYear: 2026 } } }));
  assert.equal(big.rows[0].earlyTax, undefined); near(big.rows[0].balances.taxable, big.rows[0].sepp - 10000, 0.01);
  // a series that began before the plan's first year keeps the amount typed
  const past = project(flat({ early: { owners: [owner], sepp: { ...sepp, startYear: 2024, yearly: 20000 } } }));
  assert.equal(past.rows[0].sepp, 20000); assert.deepEqual(past.rows.filter((x) => x.sepp > 0).map((x) => x.year).at(-1), 2035);
  assert.equal(seppLastYear(2028, { year: 2035 }), 2035); assert.equal(seppLastYear(2033, { year: 2035 }), 2037);
});
test("the plan's equal payments: read with defaults, refused when they cannot run; set and cleared", () => {
  const p = early(52);
  assert.equal(seppOf(p, { year: 2026 }), null);
  setSepp(p, { accountId: "i", startYear: 2028, method: "amortization", rate: 0.05 });
  assert.deepEqual(p.retirement.early, { sepp: { accountId: "i", startYear: 2028, method: "amortization", rate: 0.05 } });
  const s = seppOf(p, { year: 2026 });
  assert.equal(s.lastYear, 2035); assert.equal(s.owner.id, "a"); assert.equal(s.rate, 0.05);
  const I = buildInputs(p, { today: T }).inputs;
  assert.deepEqual(I.early.sepp, { personIndex: 0, share: 0.25, startYear: 2028, method: "amortization", rate: 0.05, halfYear: 2035 });
  setSepp(p, { accountId: "i", startYear: 2028, method: "nonsense", rate: 0.5 });
  assert.equal(p.retirement.early.sepp.method, "amortization"); assert.equal(p.retirement.early.sepp.rate, 0.05, "a rate past 10% is a slip: 5%");
  for (const bad of [{ accountId: "b" }, { accountId: "gone" }, { startYear: 2036 }, { startYear: "x" }]) { const q = early(52); setSepp(q, { accountId: "i", startYear: 2028, ...bad }); assert.equal(seppOf(q, { year: 2026 }), null, JSON.stringify(bad)); }
  { const q = early(52); setSepp(q, { accountId: "i", startYear: 2028 }); assert.equal(seppOf(q, { year: 2036 }), null, "over: nothing left to pay"); }
  clearSepp(p);
  assert.equal("early" in p.retirement, false, "the plan is as it was before the page");
});

// ---- 5. the sentences, one case each ----------------------------------------------------------------------------------------
test("answerWords: charged (the plan takes pre-tax money before 59½ and pays the 10%)", () => {
  const d = compute(early(52), { today: T });
  assert.equal(d.kind, "charged");
  near(d.tax, d.charged * 0.1, 0.01);
  const w = answerWords(d);
  assert.equal(w.head, "About $41,131 of extra tax before 59½");
  assert.equal(w.lede, "The plan takes $411,308 from your 401(k) and IRA before 59½; the extra 10% tax costs about $41,131.");
  assert.deepEqual(w.also, ["Cash and taxable savings last until 2031.", "In today's dollars."]);
  // the same figure Will the money last? says under its answer
  const pj = projection(early(52), { today: T }), note = earlyNote(pj);
  near(note.tax, d.tax, 1e-6); assert.equal(note.before, true);
  assert.equal(earlyTaxWords(note), "This plan takes money out of a 401(k) or IRA before 59½, which costs about $41,131 of extra tax.");
});
test("answerWords: bridge (work stops before 59½; cash and taxable savings carry the years)", () => {
  const p = early(52); p.accounts[0].balance = 900000; p.accounts[1].balance = 900000;
  const d = compute(p, { today: T });
  assert.equal(d.kind, "bridge"); assert.equal(d.tax, 0);
  assert.deepEqual(answerWords(d), { head: "No extra tax before 59½", lede: "You stop work at 52. Until you reach 59½ in 2035, the plan lives on cash and taxable savings, and they last. No extra 10% tax.", also: [] });
  const note = earlyNote(projection(p, { today: T }));
  assert.deepEqual(note, { tax: 0, before: true }); assert.equal(earlyTaxWords(note), null, "no line under the answer; only the link among the deeper pages");
  assert.equal(answerWords({ ...d, failYear: 2030 }).lede, "You stop work at 52. Until you reach 59½ in 2035, the plan lives on cash and taxable savings, but the money runs short in 2030.");
  assert.match(answerWords({ ...d, roth: true }).lede, /cash and taxable savings and Roth money, and they last/);
});
test("answerWords: free (pre-tax money comes out early and none of it owes the 10%)", () => {
  const p = early(56); p.accounts = p.accounts.filter((a) => a.id !== "i");   // the 401(k) alone, left at 56
  const d = compute(p, { today: T });
  assert.equal(d.kind, "free"); assert.equal(d.tax, 0); assert.ok(d.spared > 0);
  const w = answerWords(d, (n) => `$${Math.round(n)}`);
  assert.equal(w.head, "No extra tax before 59½");
  assert.equal(w.lede, `You stop work at 56. The plan takes $${Math.round(d.spared)} from your 401(k) before 59½, and none of it owes the extra 10% tax: it is from the 401(k) of a job left at 55 or later.`);
  assert.match(answerWords({ ...d, spared: 0, seppPaid: 5 }).lede, /: it comes as equal yearly payments\.$/);
  assert.match(answerWords({ ...d, seppPaid: 5 }).lede, /: part comes as equal yearly payments, and the rest is from the 401\(k\) of a job left at 55 or later\.$/);
});
test("answerWords: after, past, none and not known yet", () => {
  const after = compute(early(65), { today: T });
  assert.equal(after.kind, "after");
  assert.deepEqual(answerWords(after), { head: "Nothing comes out before 59½", lede: "You stop work at 65, after 59½, and the plan takes nothing from your 401(k) and IRA before then. No extra 10% tax.", also: [] });
  const fam = compute(familyPlan(T), { today: T });
  assert.equal(fam.kind, "after"); assert.match(answerWords(fam).lede, /^Ana stops work at 65, after 59½, and the plan takes nothing from your 401\(k\)s before then\./);
  assert.equal(earlyNote(projection(familyPlan(T), { today: T })), null, "nothing new on Will the money last? for the family");
  const old = early(65); old.household.people[0].birthDate = "1960-01-01";
  const past = compute(old, { today: T });
  assert.equal(past.kind, "past"); assert.equal(answerWords(past).head, "No extra tax: past 59½");
  assert.equal(answerWords(past).lede, "Everyone here who owns a 401(k) or IRA is past 59½, so money comes out of them with no extra 10% tax.");
  const bare = early(52); bare.accounts = bare.accounts.slice(0, 2);
  const none = compute(bare, { today: T });
  assert.equal(none.kind, "none"); assert.equal(answerWords(none).lede, "No 401(k) or traditional IRA is on file, so there is nothing that would owe the extra 10% tax before 59½.");
  const empty = compute(migrate(emptyPlan()), { today: T });
  assert.equal(empty.kind, "unknown"); assert.ok(empty.missing.length > 0);
  assert.match(answerWords(empty).lede, /^Taking money out of a 401\(k\) or IRA before 59½ usually costs an extra 10% in tax\./);
});
test("the three rows: where this household stands on each way", () => {
  const d = compute(early(52), { today: T });
  // stopping before the year of the 55th birthday: the rule never reaches that job's 401(k), and the row says so (critic P1:
  // it read "From 55, your 401(k) would owe none", as if waiting were enough)
  assert.equal(at55Words(d), "No help as planned: you stop work at 52, before 2031, the year you turn 55. Stopping in 2031 or later would spare your 401(k) ($900,000 today). It never covers an IRA.");
  assert.equal(at55Words({ ...d, people: d.people.map((x) => ({ ...x, name: "Ana", year55: 2045, in401: 86000 })) }), "No help as planned: Ana stops work at 52, before 2045, the year Ana turns 55. Stopping in 2045 or later would spare Ana's 401(k) ($86,000 today). It never covers an IRA.");
  assert.doesNotMatch(at55Words(d), /From 55|would owe none/);
  assert.doesNotMatch(at55Words(compute(early(54), { today: T })), /Counted/); assert.match(at55Words(compute(early(54), { today: T })), /^No help as planned: you stop work at 54, before 2031/);
  assert.equal(at55Words(compute(early(56), { today: T })), "Counted: you stop work at 56, so your 401(k) owes none of it. It never covers an IRA.");
  assert.equal(at55Words(compute(early(65), { today: T })), "That job's 401(k) then owes no extra tax. It never covers an IRA.");
  const noAge = compute(early(null), { today: T });
  assert.equal(at55Words({ ...noAge, kind: "charged" }), "Not counted yet: put your own retirement age on People, and the plan spares your 401(k) when it is 55 or more.");
  const ira = early(52); ira.accounts = ira.accounts.filter((a) => a.id !== "k");
  assert.equal(at55Words(compute(ira, { today: T })), "No 401(k) is on file for anyone under 59½. It never covers an IRA.");
  // equal payments: the figure it would pay (an IRA first), then "Counted" once set
  assert.equal(d.suggest.accountId, "i"); assert.equal(d.suggest.startYear, 2028); assert.equal(d.suggest.lastYear, 2035);
  assert.equal(equalWords(d), "About $19,536 a year from your IRA, with no extra tax. Not counted yet.");
  const set = compute(early(52, { early: { sepp: { accountId: "i", startYear: 2028, method: "amortization", rate: 0.05 } } }), { today: T });
  assert.equal(equalWords(set), "Counted: about $19,536 a year from your IRA, 2028 to 2035.");
  near(set.sepp.first.yearlyReal, d.suggest.yearlyReal, 1e-6, "what the row promised is what the plan then counts");
  assert.equal(equalWords(compute(early(65), { today: T })), "A set amount out of one 401(k) or IRA every year, with no extra tax.");
  assert.equal(acctWords("IRA"), "your IRA"); assert.equal(acctWords("Kim's 401(k)"), "Kim's 401(k)"); assert.equal(acctWords("My old IRA"), "your old IRA");
});
test("the continuation rule's words, and how the amount is set", () => {
  const set = (method, rate = 0.05) => compute(early(52, { early: { sepp: { accountId: "i", startYear: 2028, method, rate } } }), { today: T }).sepp;
  assert.equal(ruleWords(set("amortization")), "Once they start, the payments must go on, the same amount every year, through 2035: the later of five years and the day you reach 59½. Stop or change them sooner and the extra 10% comes back on every payment already made, with interest.");
  assert.equal(ruleWords({ ...set("rmd"), ownerName: "Kim", lastYear: 2037 }), "Once they start, the payments must go on, worked out the same way every year, through 2037: the later of five years and the day Kim reaches 59½. Stop or change them sooner and the extra 10% comes back on every payment already made, with interest.");
  assert.equal(methodWords(set("amortization")), "Set once, in 2028, and never changed: the yearly amount that would use the account up over 34.3 years (the tax tables' years of life left at 52) if it earned 5% a year. $20,726 in 2028.");
  assert.equal(methodWords(set("rmd")), "Each year: what the account holds, divided by the tax tables' years of life left at that age (34.3 at 52). It moves with the account. $9,818 in 2028.");
  assert.equal(methodWords({ ...set("amortization"), past: true, yearly: 20000 }), "The same every year: the $20,000 you typed.");
  assert.equal(set("amortization", 0.06).over5, true); assert.equal(set("amortization").over5, false);
  assert.deepEqual(RATE_CHIPS.map((c) => c.value), [0.03, 0.04, 0.05], "the chips stop at 5%");
});
test("the green line after a save names the new answer (R7), each case", () => {
  const set = compute(early(52, { early: { sepp: { accountId: "i", startYear: 2028, method: "amortization", rate: 0.05 } } }), { today: T });
  assert.equal(savedWords({ tax: 41131 }, set), "Saved. The plan now takes about $19,536 a year from your IRA, 2028 to 2035. The extra 10% tax before 59½ falls from about $41,131 to about $21,596.");
  near(set.without.tax, 41131, 0.5, "the 10% without the payments, for the page's own words");
  assert.match(savedWords({ tax: 10000 }, set), /rises from about \$10,000 to about \$21,596\.$/);
  assert.match(savedWords({ tax: set.tax }, set), /The extra 10% tax before 59½ stays about \$21,596\.$/);
  assert.match(savedWords({ tax: 0 }, set), /The extra 10% tax before 59½ is now about \$21,596\.$/);
  assert.match(savedWords({ tax: 500 }, { ...set, tax: 0 }), /falls from about \$500 to nothing\.$/);
  assert.match(savedWords({ tax: 0 }, { ...set, tax: 0 }), /No extra 10% tax before 59½ either way\.$/);
  const off = compute(early(52), { today: T });
  assert.equal(savedWords({ tax: set.tax }, off), "Removed. The plan no longer counts equal payments. The extra 10% tax before 59½ rises from about $21,596 to about $41,131.");
});

// ---- the drawing ------------------------------------------------------------------------------------------------------------
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { render } = await import("./view.js");
function page(plan, query = {}) {
  const st = { p: plan, saved: [], root: null };
  const draw = () => { st.root = new FakeElement("main"); render(st.root, { ui, fmt: { ...fmt, today: () => T }, plan: st.p, route: { group: "retirement", id: "early-access", rest: [], query }, module: { group: "retirement", id: "early-access" },
    store: { get: () => st.p, update: (fn) => { const d = structuredClone(st.p); fn(d); st.saved.push(d); st.p = d; draw(); } }, redraw: draw }); };
  draw();
  st.states = () => st.root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  st.chip = (text) => st.root.all().find((e) => e.tagName === "BUTTON" && e.textContent === text);
  st.outside = () => { const shut = st.root.all().filter((e) => e.tagName === "DETAILS" && !e.hasAttribute("open")); return st.root.all().filter((e) => !shut.some((d) => d !== e && d.contains?.(e))); };
  return st;
}
const p0High = () => early(52, { early: { sepp: { accountId: "i", startYear: 2020, method: "amortization", rate: 0.05, yearly: 90000 } } });
test("first view: the answer, three rows and two shut parts; the equal payments' chips are one tap away", () => {
  const st = page(early(52));
  const text = textOf(st.root);
  assert.match(text, /About \$41,131 of extra tax before 59½/);
  assert.match(text, /Three ways around it/); assert.match(text, /Leave your job in or after the year you turn 55/); assert.match(text, /Move some to a Roth account each year/);
  // plain words on the first view (critic P4): no ladder, no section number, no rate's name
  const folded = (e) => { for (let x = e.parentNode; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) return true; return false; };
  const first = st.root.all().filter((e) => !folded(e) && (["H1", "H2", "H3", "P"].includes(e.tagName) || /rec-(title|sub)/.test(e.getAttribute("class") ?? ""))).map((e) => e.textContent).join(" ");
  assert.match(first, /Three ways around it/); assert.doesNotMatch(first, /ladder|72\(t\)|mid-term|amortiz/i); assert.match(text, /Equal yearly payments from one account/);
  assert.deepEqual(st.states(), [["equal", "own", false], ["how", "how", false]]);
  const filled = st.root.all().filter((e) => (e.tagName === "A" || e.tagName === "BUTTON") && /(^| )btn( |$)/.test(e.getAttribute("class") ?? "") && !/secondary/.test(e.getAttribute("class") ?? ""));
  assert.deepEqual(filled.map((e) => [e.textContent, e.getAttribute("href")]), [["Count equal payments", "#/retirement/early-access?show=equal"]], "one filled button, and it lands on the part by its name");
  const own = st.root.all().find((e) => e.dataset.part === "equal");
  assert.equal(own.querySelector(".fold-title").textContent, "Set my own numbers"); assert.equal(own.querySelector(".fold-status").textContent, "not set yet");
  // nothing else for the households with nothing to take out early
  for (const p of [migrate(emptyPlan())]) { const e = page(p); assert.deepEqual(e.states(), []); assert.doesNotMatch(textOf(e.root), /Three ways/); }
});
test("S11: a chip saves, says the new answer in a green line inside the part, keeps that part open and opens no other", () => {
  const st = page(early(52));
  st.chip("IRA, $300,000").click();
  assert.equal(st.saved.length, 1);
  assert.deepEqual(st.p.retirement.early.sepp, { accountId: "i", startYear: 2028, method: "amortization", rate: 0.05 });
  assert.deepEqual(st.states(), [["equal", "own", true], ["how", "how", false]], "the saved part stays open (R17); the other is as it was");
  const own = st.root.all().find((e) => e.dataset.part === "equal");
  assert.match(textOf(own), /Saved\. The plan now takes about \$19,536 a year from your IRA, 2028 to 2035\. The extra 10% tax before 59½ falls from about \$41,131 to about \$21,596\./);
  assert.match(textOf(own), /Once they start, the payments must go on, the same amount every year, through 2035/);
  assert.equal(own.querySelector(".fold-status").textContent, "set by you");
  assert.match(textOf(st.root), /About \$21,596 of extra tax before 59½/, "the headline is the new answer");
  // said once, right under the chips just tapped (critic P2: at the top of the part it was off a small screen and the shell
  // said it again over the chips), with the way on inside it (critic P3)
  const greens = () => st.root.all().filter((e) => /(^| )notice ok( |$)/.test(e.getAttribute("class") ?? ""));
  const under = (choiceId) => { const kids = st.root.all().find((e) => e.dataset.part === "equal").all(); const f = kids.find((e) => e.dataset.choice === choiceId).parentNode; const sibs = f.parentNode.childNodes; return sibs[sibs.indexOf(f) + 1]; };
  assert.equal(greens().length, 1); assert.equal(under("equalAccount"), greens()[0]);
  assert.deepEqual(greens()[0].all().filter((e) => e.tagName === "A").map((e) => [e.textContent, e.getAttribute("href")]), [["See Will the money last? ›", "#/retirement/projection"]]);
  // once they are counted the one filled button is the way on to the answer they changed; none inside the part
  const filledNow = () => st.root.all().filter((e) => e.tagName === "A" && e.getAttribute("class") === "btn").map((e) => [e.textContent, e.getAttribute("href")]);
  assert.deepEqual(filledNow(), [["See Will the money last? ›", "#/retirement/projection"]]);
  assert.equal(own.all().some((e) => /(^| )btn( |$)/.test(e.getAttribute("class") ?? "") && !/secondary/.test(e.getAttribute("class") ?? "")), false);
  st.chip("Recalculated each year").click();
  assert.equal(greens().length, 1); assert.equal(under("equalMethod"), greens()[0], "the line follows the box tapped");
  assert.equal(st.p.retirement.early.sepp.method, "rmd"); assert.equal(st.chip("3%"), undefined, "no interest rate to pick for the recalculated way");
  st.chip("Same each year").click(); st.chip("4%").click();
  assert.equal(greens().length, 1); assert.equal(under("equalRate"), greens()[0]);
  assert.equal(st.p.retirement.early.sepp.rate, 0.04);
  st.chip("This year, 2026").click();
  assert.equal(st.p.retirement.early.sepp.startYear, 2026);
  assert.deepEqual(st.states(), [["equal", "own", true], ["how", "how", false]]);
  st.chip("Stop counting them").click();
  assert.equal("early" in st.p.retirement, false);
  assert.match(textOf(st.root), /Removed\. The plan no longer counts equal payments\./);
  assert.equal(greens().length, 1); assert.equal(under("equalAccount"), greens()[0]);
  assert.deepEqual(filledNow(), [["Count equal payments", "#/retirement/early-access?show=equal"]], "and the page's own button is back");
  assert.deepEqual(st.states(), [["equal", "own", true], ["how", "how", false]]);
  // a draw with nothing just saved: both shut again (opening and shutting is never written to the plan)
  assert.deepEqual(page(st.p).states(), [["equal", "own", false], ["how", "how", false]]);
});
test("a series that began in an earlier year: the words and the amount agree (today's balance and age), and a slip of a year is not counted", () => {
  const at = (sepp) => compute(early(52, { early: { sepp: { accountId: "i", method: "amortization", rate: 0.05, ...sepp } } }), { today: T });
  const now = at({ startYear: 2026 }).sepp, old = at({ startYear: 2020 }).sepp;
  // no amount typed: the plan's figure is worked from what the account holds today, at the age reached this year (50: 36.2)
  assert.equal(old.past, true); assert.equal(old.workedYear, 2026); assert.equal(old.ageAtStart, 50); assert.equal(old.factor, singleLife(50)); assert.equal(old.factor, 36.2);
  near(old.first.yearly, seppAmortized(300000, 0.05, 50), 0.01); near(old.first.yearly, now.first.yearly, 1e-9, "the same sum as a series starting this year");
  assert.equal(methodWords(old), "These payments began in 2020, and the amount fixed then is not on file. Until you type it below, the plan uses its own figure from what the account holds today: the yearly amount that would use the account up over 36.2 years (the tax tables' years of life left at 50) if it earned 5% a year. $18,094 in 2026.");
  assert.doesNotMatch(methodWords(old), /life left at 44|41\.9|Set once/, "never the age and table figure of the year it began");
  // the recalculated way, begun earlier: this year's age and figure too
  assert.match(methodWords(at({ startYear: 2020, method: "rmd" }).sepp), /\(36\.2 at 50\)\. It moves with the account\. \$8,287 in 2026\.$/);
  // a typed amount is the amount
  const typed = at({ startYear: 2020, yearly: 15000 }).sepp;
  assert.equal(methodWords(typed), "The same every year: the $15,000 you typed."); near(typed.first.yearly, 15000);
  // a first year before the owner is 25 (a stored 1900: "life left at -76") is a slip: not counted at all
  for (const y of [1900, 1990, 2000]) { const d = at({ startYear: y }); assert.equal(d.sepp, null, String(y)); assert.equal(seppOf(early(52, { early: { sepp: { accountId: "i", startYear: y } } }), { year: 2026 }), null); assert.equal("sepp" in (buildInputs(early(52, { early: { sepp: { accountId: "i", startYear: y } } }), { today: T }).inputs.early ?? {}), false); }
  assert.ok(at({ startYear: 2001 }).sepp, "the year they turn 25 is the first one read");
});
test("a typed yearly amount: never more than the account holds, and more than a fifth of it is flagged", () => {
  const p = early(52);
  // a slip of far too many zeros is not written, and a stored one is not read: the plan works its own amount out
  setSepp(p, { accountId: "i", startYear: 2020, yearly: 1e12 });
  assert.equal("yearly" in p.retirement.early.sepp, false);
  p.retirement.early.sepp.yearly = 1e12;
  assert.equal(seppOf(p, { year: 2026 }).yearly, null);
  const d = compute(p, { today: T });
  near(d.sepp.first.yearly, seppAmortized(300000, 0.05, 50), 0.01, "not the whole account in one year");
  assert.equal(d.sepp.yearlyHigh, false); assert.equal(yearlyCheckWords(d.sepp), null);
  // within the account but more than a fifth of it: counted as typed, and the page says to check it
  setSepp(p, { accountId: "i", startYear: 2020, yearly: 90000 });
  assert.equal(p.retirement.early.sepp.yearly, 90000);
  const hi = compute(p, { today: T });
  near(hi.sepp.first.yearly, 90000); assert.equal(hi.sepp.yearlyHigh, true);
  assert.equal(yearlyCheckWords(hi.sepp), "$90,000 a year is more than a fifth of the $300,000 this account holds, so it would be empty in about 3 years. Check the figure against your own records.");
  setSepp(p, { accountId: "i", startYear: 2020, yearly: 60000 });
  assert.equal(compute(p, { today: T }).sepp.yearlyHigh, false, "a fifth itself is not flagged");
  // on the page: the part opens by itself saying there is something to fix, with the amber line; the box takes no more than the account holds
  const st = page(p0High());
  const own = st.root.all().find((e) => e.dataset.part === "equal");
  assert.equal(own.hasAttribute("open"), true); assert.equal(own.querySelector(".fold-status").textContent, "1 to fix");
  assert.match(textOf(own.querySelector(".notice.warn")), /^\$90,000 a year is more than a fifth of the \$300,000/);
  assert.equal(page(early(52, { early: { sepp: { accountId: "i", startYear: 2020, yearly: 15000 } } })).root.all().some((e) => /notice warn/.test(e.getAttribute("class") ?? "")), false);
});
test("How this is worked out holds the years, the rule and what is not counted", () => {
  const st = page(early(52));
  const how = textOf(st.root.all().find((e) => e.dataset.part === "how"));
  assert.match(how, /You reach 59½ in September 2035/);
  assert.match(how, /2031 · age 55/); assert.match(how, /taken out early, 10% of it extra tax/);
  assert.match(how, /Not counted: money taken from a Roth account is treated as tax-free at any age/);
  assert.match(how, /section 72\(t\) and IRS Notice 2022-6/);
});

// ---- what-ifs in which the law spares it: a death, never working again ------------------------------------------------------
test("a what-if's copy of the plan can say whose money owes none: what a partner who died owned, and someone who can never work again", async () => {
  const { survivorInputs } = await import("../../scenarios/stress-tests/compute.js");
  // the engine: half the owner's money came from someone who died; W - 0.1 x 0.5 W = 40,000
  const half = project(flat({ early: { owners: [{ ...owner, freePart: 0.5 }] } }));
  near(half.rows[0].withdrawn.deferred, 40000 / 0.95); near(half.rows[0].earlyTax, 2105.26);
  assert.equal(project(flat({ early: { owners: [{ ...owner, freePart: 1, leftYear: 2026, at55Part: 1 }] } })).rows[0].earlyTax, undefined);
  // a couple of 50 and 48: Kim's IRA comes to the one left with no 10%; their own 401(k) still owes it
  const p = early(52);
  p.household.people.push({ id: "k2", name: "Kim", role: "partner", birthDate: "1978-05-01", retirementAge: 52 });
  p.accounts.find((a) => a.id === "i").ownerId = "k2";
  assert.equal(buildInputs(p, { today: T }).inputs.early.owners.some((o) => "freePart" in o), false, "the plan itself never has the field");
  const sv = survivorInputs(p, "k2", { today: T });
  assert.deepEqual(sv.inputs.early.owners.map((o) => [o.personIndex, o.freePart]), [[0, 0.25]], "Kim's $300,000 of the $1,200,000 the survivor now holds");
  assert.equal(p.retirement.early, undefined, "the what-if wrote nothing to the plan");
  // never working again: their own accounts owe none (Stress tests says it in its copy of the plan)
  const q = early(52); q.retirement.early = { free: { people: ["a"] } };
  assert.equal(buildInputs(q, { today: T }).inputs.early.owners[0].freePart, 1);
  assert.equal(compute(q, { today: T }).tax, 0);
});
