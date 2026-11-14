import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, firstMoney, moneyIn, firstPercent, firstDate, lastDate, detectKind, readFields, readPlanLines, stubLines, stubPeriod, whoseStub, ownLimit, buildPrompt, parseAnswer, applyProposal, workRows, hasPreTaxLine, alreadyOnFile, PLAN_WORDS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { limitKind } from "../../retirement/contributions/compute.js";
import { perYear } from "../../../core/math/periods.js";

const TODAY = "2026-10-30";
const STUB = "EARNINGS STATEMENT\nPay Date: 10/24/2026\nPay Period: 10/04/2026 - 10/17/2026\n  Current  YTD\nGross Pay 4,050.00 81,000.00\nFederal Income Tax 412.18 8,243.60\n401(k) 486.00 9,720.00\nNet Pay 2,842.00 56,840.00";
const STATEMENT = "Statement Period: 09/01/2026 to 09/30/2026\nAccount Number: XXXX1234\nBeginning Balance $10,950.11\nEnding Balance $11,812.40";
const SSA = "Your Social Security Statement\nAt age 62 your payment would be about $1,840 a month\nAt your full retirement age (67) $2,710 a month\nAt age 70 $3,360 a month";
const ADVISOR = "Key assumptions\nEquity return: 8.0% per year\nFixed income return 4.5%\nInflation: 2.5%\nAdvisory fee 1.00% of assets\nRetirement age 62\nRetirement spending $90,000 per year\nProbability of success: 91%";

test("money, percents and dates in text", () => {
  assert.equal(firstMoney("Total 2026 $1,234"), 1234, "the year is skipped");
  assert.equal(firstMoney("Net Pay 2,842.00 56,840.00"), 2842);
  assert.equal(firstMoney("(45.10)"), -45.1); assert.equal(firstMoney("-$12.00"), -12); assert.equal(firstMoney("$90"), 90);
  assert.equal(firstMoney("age 67 in 2026"), null);
  assert.equal(firstPercent("return 6.5% a year"), 0.065);
  assert.equal(firstDate("10/24/2026"), "2026-10-24"); assert.equal(firstDate("3/5/26"), "2026-03-05"); assert.equal(firstDate("March 5, 2026"), "2026-03-05"); assert.equal(firstDate("5 Mar 2026"), "2026-03-05"); assert.equal(firstDate("2026-1-2"), "2026-01-02");
  assert.equal(lastDate("09/01/2026 to 09/30/2026"), "2026-09-30"); assert.equal(lastDate("10/04/2026 - 10/17/2026"), "2026-10-17");
});

test("the kind of document from its words", () => {
  assert.equal(detectKind(STUB), "paystub"); assert.equal(detectKind(STATEMENT), "statement"); assert.equal(detectKind(SSA), "ssa"); assert.equal(detectKind(ADVISOR), "advisor");
  assert.equal(detectKind("hello"), null);
});

test("a pay stub: the current column, the period from its dates", () => {
  const f = readFields("paystub", STUB);
  assert.deepEqual(f, { gross: 4050, net: 2842, federal: 412.18, k401: 486, payDate: "2026-10-24", periodStart: "2026-10-04", periodEnd: "2026-10-17", period: "biweekly" });
  assert.equal(readFields("paystub", "Gross pay 2,000.00\nPay period 01/01/2026 - 01/31/2026").period, "monthly");
});

test("a statement, a Social Security statement, an advisor's plan (a yearly spending figure becomes a month)", () => {
  assert.deepEqual(readFields("statement", STATEMENT), { balance: 11812.4, date: "2026-09-30" });
  assert.deepEqual(readFields("ssa", SSA), { monthlyAtFRA: 2710, at70: 3360, at62: 1840 });
  assert.deepEqual(readFields("advisor", ADVISOR), { returnStocks: 0.08, returnBonds: 0.045, inflation: 0.025, fee: 0.01, quotedChance: 0.91, retireAge: 62, spendingMonthly: 7500 });
});

test("proposals against the plan, and applying them", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { text: STUB, personId: "p-ana", today: TODAY });
  assert.deepEqual(d.proposals.map((x) => x.op), ["income", "withholding", "work"]);
  assert.deepEqual(d.proposals[0].before, { amount: 3900, period: "biweekly", yearly: 101400 });
  for (const x of d.proposals) applyProposal(p, x);
  assert.equal(p.income.find((i) => i.id === "i-ana").amount, 4050);
  assert.deepEqual(p.taxes.withholding.self, { perPaycheck: 412.18, period: "biweekly" });
  assert.equal(p.retirement.contributions.find((c) => c.id === "c-ana").amount, 486);

  const s = compute(p, { text: STATEMENT, accountId: "a-sav", today: TODAY });
  applyProposal(p, s.proposals[0]);
  const a = p.accounts.find((x) => x.id === "a-sav");
  assert.equal(a.balance, 11812.4); assert.equal(a.asOf, "2026-09-30"); assert.deepEqual(a.history.at(-1), { date: "2026-09-30", balance: 11812.4 });
  assert.equal(compute(p, { text: STATEMENT, today: TODAY }).proposals.length, 0, "no account chosen, no change");

  applyProposal(p, compute(p, { text: SSA, personId: "p-bo" }).proposals[0]);
  assert.equal(p.retirement.socialSecurity["p-bo"].monthlyAtFRA, 2710); assert.equal(p.retirement.socialSecurity["p-bo"].claimAge, 67, "the rest kept");

  applyProposal(p, compute(p, { text: ADVISOR, personId: "p-ana" }).proposals[0]);
  assert.deepEqual(p.advisor.changes, { returnStocks: 0.08, returnBonds: 0.045, inflation: 0.025, spendingMonthly: 7500, "retireAge:p-ana": 62 });
  assert.equal(p.advisor.fee, 0.01); assert.equal(p.advisor.quotedChance, 0.91);

  const fresh = familyPlan(TODAY); fresh.income = [];
  applyProposal(fresh, compute(fresh, { text: STUB, personId: "p-bo" }).proposals[0], { newId: () => "new" });
  assert.deepEqual(fresh.income[0], { id: "new", name: "Bo's pay", type: "salary", personId: "p-bo", amount: 4050, period: "biweekly", growth: 0.03, taxable: true });
});

test("the AI's answer: only known keys, numbers checked, percents as fractions, never trusted blindly", () => {
  const msgs = buildPrompt("ssa", SSA);
  assert.equal(msgs[0].role, "system"); assert.match(msgs[1].content, /monthlyAtFRA/);
  assert.deepEqual(parseAnswer("advisor", 'Here: {"returnStocks": "7.5%", "fee": 0.008, "bogus": 3, "inflation": null}'), { returnStocks: 0.075, fee: 0.008 });
  assert.deepEqual(parseAnswer("statement", '{"balance": "$1,200.50", "date": "Sept 30, 2026"}'), { balance: 1200.5, date: "2026-09-30" });
  assert.deepEqual(parseAnswer("paystub", "no json here"), {});
  const d = compute(familyPlan(TODAY), { text: "Gross pay 1,000.00", kind: "paystub", extra: { net: 800 } });
  assert.equal(d.fields.net, 800); assert.ok(d.found.some((f) => f.key === "net"));
});

// ---- a pay stub's 401(k) lines read apart (2026-11-11, owner's request: "maybe they didn't input how much they contributed ...
// the match"). Invented stubs and households only.
const SPLIT = [
  "WIDGET WORKS LLC", "Earnings Statement", "Pay Date: 11/06/2026", "Pay Period: 10/19/2026 - 11/01/2026", "Pay frequency: Biweekly",
  "Gross Pay 2,769.23 55,384.60", "Federal Income Tax 231.40 4,628.00",
  "401(k) Pre-Tax 4.00% 110.77 2,215.40", "Roth 401(k) 2.00% 55.38 1,107.60", "401K Loan 75.00 1,500.00",
  "Employer Contributions", "401(k) ER Match 110.77 2,215.40", "Net Pay 1,890.12 37,802.40", "Direct deposit to account XXXX6789",
].join("\n");
const ROTH_ONLY = "Pay Date: 11/06/2026\nPay Period: 10/19/2026 - 11/01/2026\nGross Pay 2,769.23\nROTH 401K 166.15 3,323.00\nCompany Match 110.77\nNet Pay 1,890.12";
/** one adult with a 401(k) at work and nothing going in (Get started's "Yes" with "None"), as a phone builds it */
const caseyLike = () => ({
  meta: { currency: "USD" }, household: { people: [{ id: "p1", name: "Casey", role: "self", birthDate: "1984-03-01", retirementAge: 65 }] },
  income: [{ id: "i1", name: "Casey's pay", type: "salary", personId: "p1", amount: 72000, period: "annual" }],
  accounts: [{ id: "k1", name: "Casey's plan at work", type: "401k", ownerId: "p1", balance: 48000, asOf: TODAY, history: [] }],
  retirement: { contributions: [{ id: "c1", accountId: "k1", personId: "p1", amount: 0, period: "monthly", employerMatch: 0, pctOfPay: 0 }], workPlans: { p1: { plan: true } } },
});
const ids = () => { let n = 0; return { newId: () => `new${++n}` }; };
const useAll = (plan, props) => { const g = ids(); for (const x of props) applyProposal(plan, x, g); return plan; };

test("a stub's money lines: a rate (6.00%) is never money; a day that does not exist is no date", () => {
  assert.equal(firstMoney("401(k) Pre-Tax 6.00% 243.00 4,860.00"), 243);
  assert.equal(firstMoney("Roth 2.5 % 55.38"), 55.38);
  assert.equal(firstDate("2026-02-31"), null); assert.equal(firstDate("02/31/2026"), null); assert.equal(firstDate("Feb 30, 2026"), null);
  assert.equal(firstDate("2028-02-29"), "2028-02-29"); assert.equal(firstDate("13/01/2026"), null);
});

test("the pay-the-tax-later 401(k), the Roth 401(k) and the match are read apart; a loan payback is none of them", () => {
  const f = readFields("paystub", SPLIT);
  assert.equal(f.k401, 110.77); assert.equal(f.roth401k, 55.38); assert.equal(f.match, 110.77); assert.equal(f.period, "biweekly");
  // the old reading took "ROTH 401K" as the pre-tax 401(k): no more
  const r = readFields("paystub", ROTH_ONLY);
  assert.equal(r.k401, undefined); assert.equal(r.roth401k, 166.15); assert.equal(r.match, 110.77);
  assert.equal(readFields("paystub", "Gross pay 1,000.00\n401K LOAN 50.00").k401, undefined);
  assert.equal(readFields("paystub", "Gross pay 1,000.00\n401(k)\nRoth 401(k) 40.00").k401, undefined, "the next line is a Roth line: not the pre-tax figure");
  assert.equal(readFields("paystub", "403(b) Before-Tax 120.00\nER 403b 60.00").k401, 120);
  assert.equal(readFields("paystub", "403(b) Before-Tax 120.00\nER 403b 60.00").match, 60);
  assert.equal(hasPreTaxLine(SPLIT), true); assert.equal(hasPreTaxLine(ROTH_ONLY), false);
});

test("Casey: the empty 401(k) row is filled, a Roth 401(k) is made, the match lands on the pay-the-tax-later row", () => {
  const plan = caseyLike();
  const d = compute(plan, { text: SPLIT, today: TODAY });
  const by = Object.fromEntries(d.proposals.map((x) => [x.id, x]));
  assert.deepEqual(Object.keys(by), ["pay", "withholding", "k401", "roth401k", "match"]);
  assert.equal(by.k401.make, null); assert.equal(by.k401.contributionId, "c1"); assert.deepEqual(by.k401.before, { amount: 0, period: "monthly", yearly: 0 });
  assert.equal(by.roth401k.make, "account"); assert.equal(by.roth401k.accountName, "Casey's Roth 401(k) at work"); assert.equal(by.roth401k.before, null);
  assert.equal(by.match.employerMatch, Math.round(perYear(110.77, "biweekly") * 100) / 100, "a paycheck's match times 26");
  useAll(plan, d.proposals);
  const rows = plan.retirement.contributions;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { id: "c1", accountId: "k1", personId: "p1", amount: 110.77, period: "biweekly", employerMatch: by.match.employerMatch }, "pctOfPay dropped: the row is dollars now");
  const roth = plan.accounts.find((a) => a.type === "roth");
  assert.deepEqual(roth, { id: roth.id, name: "Casey's Roth 401(k) at work", type: "roth", institution: "", balance: 0, asOf: TODAY, ownerId: "p1", history: [], notes: "" });
  assert.equal(limitKind(roth.type, roth.name, 0), "401k", "the Roth row counts against the 401(k) limit, not the IRA's");
  assert.deepEqual(rows[1], { id: rows[1].id, accountId: roth.id, personId: "p1", amount: 55.38, period: "biweekly", employerMatch: 0 }, "never a match on the Roth row");
  assert.equal(plan.retirement.workPlans.p1.match, true); assert.equal(plan.retirement.workPlans.p1.plan, true);
  // the same stub again: nothing new is made, each figure already matches
  const again = compute(plan, { text: SPLIT, today: TODAY }).proposals.filter((x) => x.op === "work");
  assert.ok(again.every((x) => x.make === null));
  assert.deepEqual(again.map((x) => x.before.matchYearly ?? x.before.amount), [110.77, 55.38, by.match.employerMatch]);
});

test("no 401(k) at all: the row and its account are proposed, and the order the person taps them in does not matter", () => {
  const bare = () => { const p = caseyLike(); p.accounts = []; p.retirement.contributions = []; p.retirement.workPlans = { p1: { plan: false, match: false } }; return p; };
  const props = compute(bare(), { text: SPLIT, today: TODAY }).proposals.filter((x) => x.op === "work");
  assert.deepEqual(props.map((x) => [x.id, x.make, x.accountName]), [["k401", "account", "Casey's 401(k) at work"], ["roth401k", "account", "Casey's Roth 401(k) at work"], ["match", "account", "Casey's 401(k) at work"]]);
  const a = useAll(bare(), props), b = useAll(bare(), [...props].reverse());
  const shape = (p) => ({ rows: p.retirement.contributions.map(({ id, accountId, ...r }) => ({ ...r, acct: p.accounts.find((x) => x.id === accountId).name })).sort((x, y) => x.acct.localeCompare(y.acct)), accts: p.accounts.map((x) => `${x.type}:${x.name}`).sort() });
  assert.deepEqual(shape(a), shape(b));
  assert.deepEqual(shape(a).accts, ["401k:Casey's 401(k) at work", "roth:Casey's Roth 401(k) at work"], "one account of each kind, never two");
  assert.equal(a.retirement.workPlans.p1.match, true, "the stub shows a match: the earlier 'no match' gives way");
  assert.equal(a.retirement.workPlans.p1.plan, true, "money going in from the paycheck: the job has a plan, the earlier 'No' gives way");
  // a stub with no match line: the plan is a yes, and the match answer on file is left alone (the stub does not say)
  const noMatch = bare(); const nm = compute(noMatch, { text: SPLIT.replace("401(k) ER Match 110.77 2,215.40", ""), today: TODAY }).proposals;
  assert.equal(nm.some((x) => x.id === "match"), false);
  useAll(noMatch, nm.filter((x) => x.op === "work"));
  assert.deepEqual(noMatch.retirement.workPlans.p1, { plan: true, match: false });
});

test("a new pay line for the first adult left unnamed reads 'Your pay', never \"Me's pay\"", () => {
  const me = caseyLike(); me.household.people[0].name = "Me"; me.income = [];
  const pay = compute(me, { text: SPLIT, today: TODAY }).proposals.find((x) => x.op === "income");
  useAll(me, [pay]);
  assert.equal(me.income[0].name, "Your pay"); assert.equal(me.income[0].amount, 2769.23); assert.equal(me.income[0].period, "biweekly");
});

test("a Roth-only stub: ONE card asks whether the money on file is this same Roth money; the match moves off a Roth row", () => {
  // the Roth money typed as a 401(k) (Get started's "Through work" saves a 401(k)): the stub has no pre-tax line
  const p = caseyLike(); p.retirement.contributions[0].amount = 166; p.retirement.contributions[0].period = "biweekly"; p.retirement.workPlans = {};
  const d = compute(p, { text: ROTH_ONLY, today: TODAY });
  assert.equal(d.proposals.some((x) => x.id === "k401"), false, "no second card that sets the money on file to $0");
  const roth = d.proposals.find((x) => x.id === "roth401k");
  assert.deepEqual(roth.move, { rowId: "c1", amount: 166, period: "biweekly", yearly: 4316, accountName: "Casey's plan at work", balance: 48000 });
  assert.equal(roth.same, undefined, "a question is never 'already on file'");
  // "it is the same money": one change sets the row on file to $0 and adds the Roth row
  const yes = caseyLike(); yes.retirement.contributions[0].amount = 166; yes.retirement.contributions[0].period = "biweekly";
  useAll(yes, [{ ...roth, zeroLater: roth.move.rowId }]);
  assert.deepEqual(yes.retirement.contributions.map((c) => [yes.accounts.find((a) => a.id === c.accountId).type, c.amount, c.period]), [["401k", 0, "biweekly"], ["roth", 166.15, "biweekly"]]);
  // "both go in": the row on file stays
  const both = caseyLike(); both.retirement.contributions[0].amount = 166; both.retirement.contributions[0].period = "biweekly";
  useAll(both, [roth]);
  assert.deepEqual(both.retirement.contributions.map((c) => c.amount), [166, 166.15]);
  assert.equal(compute(p, { text: ROTH_ONLY.replace("ROTH 401K", "ROTH 401K 166.15\n401(k) Pre-Tax see below") }).proposals.some((x) => x.move), false, "a pre-tax line is there (its figure unread): nothing is asked");
  const none = caseyLike();
  assert.equal(compute(none, { text: ROTH_ONLY }).proposals.some((x) => x.move), false, "nothing on file: nothing to ask");
  // a match typed on the Roth 401(k) row (no pre-tax row): it moves to a $0 pay-the-tax-later row, never counted twice
  const q = caseyLike(); q.accounts = [{ id: "r1", name: "Roth 401(k)", type: "roth", ownerId: "p1", balance: 9000 }];
  q.retirement.contributions = [{ id: "cr", accountId: "r1", personId: "p1", amount: 166.15, period: "biweekly", employerMatch: 2400 }];
  const m = compute(q, { text: ROTH_ONLY, today: TODAY }).proposals.find((x) => x.id === "match");
  assert.deepEqual(m.before, { matchYearly: 2400, onNow: 2400 }); assert.equal(m.make, "account");
  useAll(q, [m]);
  const later = q.retirement.contributions.find((c) => c.id !== "cr");
  assert.equal(q.retirement.contributions.find((c) => c.id === "cr").employerMatch, 0);
  assert.equal(later.amount, 0); assert.equal(later.employerMatch, Math.round(110.77 * 26 * 100) / 100);
  assert.equal(q.accounts.find((a) => a.id === later.accountId).type, "401k");
});

test("whose 401(k): an old job's account is left alone, the unnamed first adult reads 'Your', the person picked is used", () => {
  const fam = familyPlan(TODAY);
  const bo = compute(fam, { text: SPLIT, personId: "p-bo", today: TODAY }).proposals.find((x) => x.id === "k401");
  assert.equal(bo.make, "account", "Bo's old 401(k) (nothing going in, named as an old job's) is not this paycheck's plan");
  assert.equal(bo.accountName, "Bo's 401(k) at work");
  assert.equal(workRows(fam, "p-bo").now, null, "Bo's Roth IRA is not a Roth 401(k)");
  const ana = compute(fam, { text: SPLIT, personId: "p-ana", today: TODAY }).proposals.find((x) => x.id === "match");
  assert.equal(ana.contributionId, "c-ana"); assert.equal(ana.before.matchYearly, 3050);
  const me = caseyLike(); me.household.people[0].name = "Me"; me.accounts = []; me.retirement.contributions = [];
  assert.equal(compute(me, { text: SPLIT }).proposals.find((x) => x.id === "roth401k").accountName, "Your Roth 401(k) at work");
  const gone = caseyLike(); gone.accounts[0].formerJob = true;
  assert.equal(compute(gone, { text: SPLIT }).proposals.find((x) => x.id === "k401").make, "account", "a 401(k) from a job left is never this stub's");
});

test("account numbers on a stub are never read or kept", () => {
  const plan = caseyLike();
  const d = compute(plan, { text: SPLIT, today: TODAY });
  assert.ok(!JSON.stringify(d.fields).includes("6789") && !JSON.stringify(d.proposals).includes("6789"));
  assert.ok(!JSON.stringify(useAll(plan, d.proposals)).includes("6789"));
  assert.match(buildPrompt("paystub", SPLIT)[0].content, /Never include account numbers/);
  assert.match(buildPrompt("paystub", SPLIT)[1].content, /"roth401k".*\n"match"/s, "the AI is asked for the Roth line and the match too");
});

test("already on file: the same figure a year is not offered again; a guess on file always is, and using it makes it the person's", () => {
  const plan = caseyLike();   // pay $72,000 a year; the stub's $2,769.23 every two weeks is $71,999.98
  const first = compute(plan, { text: SPLIT, today: TODAY }).proposals;
  assert.equal(first.find((x) => x.op === "income").same, true, "$72,000 a year either way: nothing to change");
  assert.ok(first.filter((x) => x.op === "work").every((x) => !x.same), "a $0 row, no Roth row, no match: each would change something");
  useAll(plan, first);
  const again = compute(plan, { text: SPLIT, today: TODAY }).proposals;
  assert.ok(again.every((x) => x.same), "the same stub read twice: every change is already on file");
  // a match that is our guess (the guesses ledger) is shown as one and offered even when equal; using it drops the guess
  const g = caseyLike(); const row = g.retirement.contributions[0]; Object.assign(row, { amount: 110.77, period: "biweekly", employerMatch: 2880.02 });
  g.guesses = { "retirement.contributions[c1].employerMatch": { k: "contrib.match", v: 2880.02, u: "year", s: 0.3, at: TODAY, d: null } };
  const m = compute(g, { text: SPLIT, today: TODAY }).proposals.find((x) => x.id === "match");
  assert.equal(m.before.guess, true); assert.equal(m.same, undefined, "our guess is never 'already on file'");
  assert.equal(alreadyOnFile({ ...m, before: { ...m.before, guess: undefined } }), true, "the same figure typed by the person would be");
  useAll(g, [m]);
  assert.equal(g.guesses, undefined, "the stub's match is the person's own now: the guess entry is gone");
  // the pay-the-tax-later amount: a guessed amount reads as one and is cleared the same way
  const h = caseyLike(); Object.assign(h.retirement.contributions[0], { amount: 120, period: "monthly" });
  h.guesses = { "retirement.contributions[c1].amount": { k: "contrib.amount", v: 120, u: "month", s: 0.4, at: TODAY, d: null } };
  const k = compute(h, { text: SPLIT, today: TODAY }).proposals.find((x) => x.id === "k401");
  assert.equal(k.before.guess, true);
  useAll(h, [k]); assert.equal(h.guesses, undefined);
});

// ---------------------------------------------------------------- round-1 review (2026-11-12). Invented stubs and households only.
const HEAD = ["HARBOR FREIGHT LINES", "Pay Date 11/06/2026", "Pay Period 10/19/2026 to 11/01/2026", "Pay frequency: Biweekly"];
const stub = (lines, head = HEAD) => [...head, ...lines].join("\n");
const rd = (plan, text, extra = {}) => compute(plan, { text, kind: "paystub", today: "2026-11-12", ...extra });
/** two adults as Get started leaves them: Dana $78,000 a year (twice a month), Lee $52,000 (every two weeks) */
const danaLee = () => ({
  meta: { currency: "USD" }, household: { people: [{ id: "d", name: "Dana", role: "self", birthDate: "1979-04-15" }, { id: "l", name: "Lee", role: "partner", birthDate: "1981-09-15" }] },
  income: [{ id: "id", name: "Dana's pay", type: "salary", personId: "d", amount: 78000, period: "annual" }, { id: "il", name: "Lee's pay", type: "salary", personId: "l", amount: 52000, period: "annual" }],
  accounts: [{ id: "kd", name: "Dana's plan at work", type: "401k", ownerId: "d", balance: 85000, asOf: TODAY, history: [] }, { id: "kl", name: "Lee's plan at work", type: "401k", ownerId: "l", balance: 30000, asOf: TODAY, history: [] }],
  retirement: { contributions: [{ id: "cd", accountId: "kd", personId: "d", amount: 400, period: "monthly", employerMatch: 2400 }, { id: "cl", accountId: "kl", personId: "l", amount: 150, period: "monthly", employerMatch: 0 }], workPlans: { d: { plan: true }, l: { plan: true, match: false } } },
});
const LEE = "NORTHWIND CLINIC\nPay Statement\nPay Period 10/19/2026 to 11/01/2026\nPay Date 11/06/2026\nGross Pay 2,000.00 42,000.00\nFed Income Tax 142.10 2,984.10\nROTH 401K 80.00 1,680.00\nNet Pay 1,624.90 34,122.90";
const DANA = "RIVERBEND HOSPITAL\nEarnings Statement   Semi-Monthly\nPay Date 11/15/2026\nGross Pay 3,250.00 68,250.00\nFederal Income Tax 262.50 5,512.50\n401(k) Pre-Tax 6% 195.00 4,095.00\nDental Pre-Tax 18.00 378.00\nNet Pay 2,520.88 52,938.48\nEmployer 401(k) Match 97.50 2,047.50";

test("M2: every line of a kind is added: a catch-up line, a Roth catch-up line; the parts are kept for the page", () => {
  const robin = caseyLike(); robin.household.people[0].birthDate = "1963-03-15"; Object.assign(robin.retirement.contributions[0], { amount: 600, period: "monthly", employerMatch: 2760 }); robin.income[0].amount = 70000;
  const text = stub(["Gross Pay 2,692.31 59,230.82", "Federal Income Tax 198.00 4,356.00", "401(k) 4.00% 107.69 2,369.18", "401(k) Catch-Up 166.15 3,655.30", "Employer Contributions", "401(k) ER Match 107.69 2,369.18", "Net Pay 1,950.00 42,900.00"]);
  const d = rd(robin, text);
  assert.equal(d.fields.k401, 273.84, "107.69 + 166.15"); assert.equal(d.fields.match, 107.69);
  assert.deepEqual(d.found.find((f) => f.key === "k401").parts, [{ amount: 107.69, catchUp: false }, { amount: 166.15, catchUp: true }]);
  const k = d.proposals.find((x) => x.id === "k401");
  assert.equal(Math.round(k.after.yearly * 100) / 100, 7119.84, "(107.69 + 166.15) x 26, not $2,800"); assert.equal(Math.round(k.before.yearly), 7200); assert.equal(k.suspect, undefined);
  const pair = readFields("paystub", stub(["Gross Pay 6,500.00", "ROTH 401K 200.00", "ROTH CATCH UP 207.69", "Net Pay 4,100.00"]));
  assert.equal(pair.roth401k, 407.69); assert.equal(pair.k401, undefined);
  // a pay-the-tax-later line and a Roth catch-up line (IRC 414(v)(7)): each on its own side
  const mixed = readFields("paystub", stub(["Gross Pay 6,500.00", "401(k) 6.00% 390.00", "401(k) Roth Catch-Up 288.46", "Net Pay 4,100.00"]));
  assert.equal(mixed.k401, 390); assert.equal(mixed.roth401k, 288.46);
  // the same line printed twice (a summary under the deductions) counts once
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\n401(k) 80.00 1,680.00\nSummary\n401(k) 80.00 1,680.00\nNet Pay 1,500.00").k401, 80);
});

test("M3: how often the stub pays: its period's dates first, its words when they are about the paycheck; a stray word decides nothing", () => {
  const body = ["Gross Pay 2,769.23", "Federal Income Tax 231.40", "401(k) 4.00% 110.77", "401(k) ER Match 110.77", "Net Pay 1,890.12"];
  const period = (lines, head) => readFields("paystub", stub(lines, head)).period;
  assert.equal(period(body, ["CO", "Pay Date 11/06/2026", "Pay Period 10/19/2026 to 11/01/2026", "Pay Frequency: Bi Weekly"]), "biweekly");
  assert.equal(period(body, ["CO", "Pay Date 11/15/2026", "Pay Period 11/01/2026 to 11/15/2026", "Pay Frequency: Semi Monthly"]), "semimonthly");
  assert.equal(period([...body, "Monthly Transit Pass 45.00"], ["CO", "Pay Date 11/06/2026", "Pay Period 10/19/2026 to 11/01/2026"]), "biweekly", "a transit pass is not the paycheck");
  assert.equal(period([...body, "Standard weekly hours 40.00"], ["CO", "Pay Date 11/06/2026", "Pay Period 10/19/2026 to 11/01/2026"]), "biweekly");
  assert.equal(period(body, ["CO", "Pay Date 02/26/2027", "Pay Period 02/16/2027 - 02/28/2027"]), "semimonthly", "the 16th to the month's last day is twice a month, not 13 days of two weeks");
  assert.equal(period(body, ["CO", "Pay Date 02/15/2027", "Pay Period 02/01/2027 - 02/15/2027"]), "semimonthly");
  assert.equal(period(body, ["CO", "Period Beginning: 10/19/2026", "Period Ending: 11/01/2026", "Pay Date: 11/06/2026"]), "biweekly");
  assert.equal(period(body, ["CO"]), null, "no words, no dates: the stub does not say");
  assert.equal(period([...body, "Monthly Transit Pass 45.00"], ["CO"]), null);
  assert.equal(period(body, ["CO", "Pay Frequency: Weekly"]), "weekly"); assert.equal(period(body, ["CO", "Paid monthly"]), "monthly");
  // the dates win over the words
  assert.deepEqual(stubPeriod("Pay Frequency: Weekly", "2026-10-19", "2026-11-01"), { period: "biweekly", why: "dates" });
  assert.deepEqual(stubPeriod("Biweekly", null, null), { period: "biweekly", why: "words" });
  assert.deepEqual(stubPeriod("x", "2026-01-01", "2026-01-31"), { period: "monthly", why: "dates" });
  assert.deepEqual(stubPeriod("x", "2026-11-02", "2026-11-08"), { period: "weekly", why: "dates" });
});

test("M5 / P3 / B10: what comes off the pay printed with a minus or in brackets is read as its size, and each gets its card", () => {
  const adp = "ACME LOGISTICS INC\nEarnings Statement\nPeriod Beginning: 10/19/2026\nPeriod Ending: 11/01/2026\nPay Date: 11/06/2026\nRegular 34.6154 80.00 2,769.23 58,153.83\nGross Pay $2,769.23 58,153.83\nFederal Income Tax -241.12 5,063.52\nSocial Security Tax -171.69 3,605.54\n401K -166.15 3,489.15\nNet Pay $2,051.81\n401K ER Match 83.08 1,744.68";
  const d = rd(caseyLike(), adp);
  assert.equal(d.fields.k401, 166.15); assert.equal(d.fields.federal, 241.12); assert.equal(d.fields.match, 83.08);
  assert.deepEqual(d.proposals.map((x) => x.id), ["pay", "withholding", "k401", "match"]);
  assert.equal(d.proposals.find((x) => x.id === "match").alone, undefined, "the match comes with the person's own money");
  const br = rd(caseyLike(), stub(["Gross Pay 2,769.23", "Federal Income Tax (231.40)", "401(k) (110.77)*", "Roth 401K -55.38 1,218.36", "Net Pay 1,890.12"]));
  assert.equal(br.fields.k401, 110.77); assert.equal(br.fields.roth401k, 55.38); assert.equal(br.fields.federal, 231.4);
  // a match with none of the person's own money on the stub or on file is said to stand alone
  const lone = rd(caseyLike(), stub(["Gross Pay 2,769.23", "401(k) ER Match 83.08", "Net Pay 1,890.12"]));
  assert.equal(lone.proposals.find((x) => x.id === "match").alone, true);
});

test("M6: another benefit's employer line is not the 401(k) match; the line that names the plan wins", () => {
  const f = readFields("paystub", stub(["Gross Pay 2,461.54", "Federal Income Tax 231.40", "401(k) 6.00% 147.69", "Employer Contributions", "HSA ER Match 25.00", "401(k) ER Match 73.85", "Net Pay 1,790.12"]));
  assert.equal(f.match, 73.85); assert.equal(f.k401, 147.69);
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\nCharity Matching Gift 25.00\nNet Pay 1,500.00").match, undefined);
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\nHealth Insurance Employer 310.00\nNet Pay 1,500.00").match, undefined);
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\nCompany Match 61.54\nNet Pay 1,500.00").match, 61.54);
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\nCompany Match 61.54\n401(k) Company Match 40.00\nNet Pay 1,500.00").match, 40, "the plan's own line, not the bare one");
});

test("M7 / P2: whose stub it is: the page's person, the name in the text, the pay that matches; asked when nothing tells", () => {
  const p = danaLee();
  // the address without &person=: Lee's stub is Lee's, by its pay ($2,000 x 26 = Lee's $52,000)
  const byPay = rd(p, LEE);
  assert.equal(byPay.stub.personId, "l"); assert.equal(byPay.stub.who, "pay");
  assert.equal(byPay.proposals.find((x) => x.id === "pay").same, true, "Lee's pay is already on file: nothing is offered on Dana's");
  assert.ok(byPay.proposals.every((x) => x.personId === "l"));
  // a stub that names Lee
  const byName = rd(p, `Employee: Lee\n${LEE.replace("2,000.00 42,000.00", "2,100.00 44,100.00")}`);
  assert.equal(byName.stub.personId, "l"); assert.equal(byName.stub.who, "name");
  // the page set for Dana with Lee's stub: Dana is kept, and the page is told the pay is Lee's
  const forDana = rd(p, LEE, { personId: "d" });
  assert.equal(forDana.stub.personId, "d"); assert.deepEqual(forDana.stub.other, { id: "l", name: "Lee", yearly: 52000 });
  // nothing tells them apart: asked, and no change is proposed until the person says
  const bonus = rd(p, DANA.replace("Gross Pay 3,250.00 68,250.00", "Bonus 2,000.00 2,000.00\nGross Pay 5,250.00 70,250.00"));
  assert.deepEqual(bonus.stub.ask, [{ id: "d", name: "Dana" }, { id: "l", name: "Lee" }]); assert.deepEqual(bonus.proposals, []);
  assert.deepEqual(whoseStub(caseyLike(), "x", { gross: 1 }), { personId: "p1", why: "only", ask: null, other: null });
});

test("P4: a stub that does not say how often it pays takes the rhythm that fits the pay on file; a paycheck unlike the usual is flagged", () => {
  const p = danaLee();
  const quiet = DANA.replace("   Semi-Monthly", "");
  const d = rd(p, quiet);
  assert.equal(d.stub.personId, "d"); assert.equal(d.fields.period, "semimonthly", "3,250 x 24 is Dana's $78,000"); assert.equal(d.stub.periodWhy, "pay");
  assert.equal(d.proposals.find((x) => x.id === "pay").same, true);
  assert.equal(Math.round(d.proposals.find((x) => x.id === "k401").after.yearly), 4680, "195 x 24, not x 26");
  assert.equal(d.proposals.find((x) => x.id === "match").employerMatch, 2340);
  assert.ok(d.proposals.every((x) => !x.needsPeriod));
  // the person's own answer wins
  assert.equal(rd(p, quiet, { extra: { period: "biweekly" } }).stub.periodWhy, "you");
  // no rhythm fits the pay on file: every change waits for the answer
  const odd = rd(p, quiet.replace("3,250.00 68,250.00", "2,900.00 60,900.00"), { personId: "d" });
  assert.equal(odd.fields.period, null); assert.ok(odd.proposals.length >= 3 && odd.proposals.every((x) => x.needsPeriod));
  // the stub says twice a month and this paycheck holds a bonus: the yearly figures would assume every paycheck is like it
  const bonus = rd(p, DANA.replace("Gross Pay 3,250.00 68,250.00", "Bonus 2,000.00 2,000.00\nGross Pay 5,250.00 70,250.00"), { personId: "d" });
  assert.equal(bonus.stub.odd, true); assert.equal(bonus.stub.stubYearly, 126000); assert.equal(bonus.stub.payOnFile, 78000);
  assert.equal(rd(p, DANA, { personId: "d" }).stub.odd, false);
});

test("P7: a stub pasted as one line is cut back into its lines", () => {
  const one = DANA.replace(/\n/g, " ");
  assert.ok(stubLines(one).includes("401(k) Pre-Tax 6% 195.00 4,095.00"));
  const f = readFields("paystub", one);
  assert.equal(f.k401, 195); assert.equal(f.match, 97.5); assert.equal(f.gross, 3250); assert.equal(f.federal, 262.5); assert.equal(f.period, "semimonthly");
  const casey = readFields("paystub", SPLIT.replace(/\n/g, " "));
  assert.equal(casey.k401, 110.77); assert.equal(casey.roth401k, 55.38); assert.equal(casey.match, 110.77);
  assert.deepEqual(stubLines("Gross Pay 2,000.00\n401(k) 80.00"), ["Gross Pay 2,000.00", "401(k) 80.00"], "a stub with its line breaks is left as it is");
});

test("P9 / M12: a stub with no retirement line says so; the person's own money a year on the stub and on file is told", () => {
  const none = rd(caseyLike(), stub(["Gross Pay 2,769.23 55,384.60", "Federal Income Tax 241.12 4,822.40", "Health Insurance 96.00 1,920.00", "Net Pay 2,220.27 44,405.40"]));
  assert.deepEqual(none.stub.noPlanLine, { onFile: 0 }); assert.equal(none.stub.own, null);
  const saving = caseyLike(); Object.assign(saving.retirement.contributions[0], { amount: 250, period: "monthly" });
  assert.deepEqual(rd(saving, stub(["Gross Pay 2,769.23", "Net Pay 2,220.27"])).stub.noPlanLine, { onFile: 3000 });
  assert.equal(rd(caseyLike(), SPLIT).stub.noPlanLine, null);
  // Lee: $1,800 a year on file, $2,080 on the stub; after the Roth line alone is used as "both go in", the plan says $3,880
  const p = danaLee();
  const d = rd(p, LEE);
  assert.deepEqual(d.stub.own, { stub: 2080, file: 1800 });
  applyProposal(p, d.proposals.find((x) => x.id === "roth401k"), ids());
  assert.deepEqual(rd(p, LEE).stub.own, { stub: 2080, file: 3880 });
});

test("M14 / N3 / B9: the dollars of the wrong line are never offered: wages, a rate with no % sign, a heading, a surname, a year-to-date figure", () => {
  const c = caseyLike;
  assert.equal(readFields("paystub", stub(["401(k) Eligible Wages 2,769.23", "Gross Pay 2,769.23 55,384.60", "401(k) 110.77 2,215.40", "Net Pay 2,159.84"])).k401, 110.77, "a wages line is not money going in");
  const rate = readFields("paystub", stub(["Gross Pay 2,769.23", "401(k) 4.00 110.77 2,436.94", "401(k) ER Match 4.00 110.77", "Net Pay 1,890.12"]));
  assert.equal(rate.k401, 110.77, "4.00 is the share of pay: 4 x 2,769.23 / 100 = 110.77"); assert.equal(rate.match, 110.77);
  assert.equal(readFields("paystub", stub(["Gross Pay 2,769.23", "401(k) 4% of 2,769.23 110.77", "Net Pay 1,890.12"])).k401, 110.77, "after '% of' the last figure is the amount");
  // a line with no amount never takes the dollars of the next line when that line has words
  const pct = rd(c(), stub(["Gross Pay 2,769.23 55,384.60", "401(k) 4%", "Roth 401(k) 2%", "Net Pay 2,159.84 43,196.80"]));
  assert.equal(pct.fields.k401, undefined); assert.equal(pct.fields.roth401k, undefined); assert.equal(pct.stub.unread, "line");
  assert.equal(readFields("paystub", stub(["Gross Pay 2,769.23", "401(k) Plan", "Medical 85.00 1,700.00", "401(k) Employee 110.77 2,215.40", "Net Pay 2,159.84"])).k401, 110.77);
  // copied cell by cell, the next line holds the figure and no letters
  assert.equal(readFields("paystub", "Gross Pay\n2,769.23\n401(k)\n166.15\n3,489.15\n401(k) Employer Match\n83.08\nNet Pay\n2,051.81").k401, 166.15);
  // "Roth" in a person's name is not a Roth line
  const name = readFields("paystub", stub(["Casey Roth", "Gross Pay 2,769.23 55,384.60", "401(k) 110.77 2,215.40", "Net Pay 2,159.84"]));
  assert.equal(name.roth401k, undefined); assert.equal(name.k401, 110.77);
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\nRoth IRA 100.00").roth401k, undefined);
  // a business named Roth is not a Roth line; a line that is Roth and a deduction's words is (fix round 2)
  assert.equal(readFields("paystub", stub(["ROTH & SONS FREIGHT  Check 10443.00", "Gross Pay 2,769.23", "401(k) 110.77", "Net Pay 1,890.12"])).roth401k, undefined);
  for (const l of ["Roth 55.38", "ROTH CATCH UP 55.38", "Roth EE Deferral 2% 55.38", "Roth: 55.38", "ROTH* 55.38", "Roth (55.38)"]) assert.equal(readFields("paystub", `Gross Pay 2,769.23\n${l}\nNet Pay 1,890.12`).roth401k, 55.38, l);
  // under "Current YTD", a line with one figure where gross pay has two may be the year-to-date figure: nothing is read
  const ytd = rd(c(), "BLUE HERON PRINTING CO\nPay date 11/06/2026\nDescription Current YTD\nGross Pay 2,769.23 58,153.83\nFederal Withholding 198.40 4,166.40\n401(k) 2,584.68\nNet Pay 1,951.75 40,986.79");
  assert.equal(ytd.fields.k401, undefined); assert.equal(ytd.stub.unread, "ytd"); assert.equal(ytd.proposals.some((x) => x.op === "work"), false);
  // a figure that cannot be a paycheck's saving gets no "Use it": half the pay or more, or a year above the limit
  const big = rd(c(), stub(["Gross Pay 2,769.23", "401(k) 2,584.68", "Net Pay 100.00"])).proposals.find((x) => x.id === "k401");
  assert.equal(big.suspect, "pay");
  const over = rd(c(), stub(["Gross Pay 4,000.00", "401(k) 1,200.00", "Net Pay 2,000.00"])).proposals.find((x) => x.id === "k401");
  assert.equal(over.suspect, "limit"); assert.equal(over.limit, 24500, "under 50 in 2026: $24,500 (IRC 402(g)(1))");
  assert.equal(ownLimit({ birthDate: "1970-01-01" }, "2026-11-12"), 32500, "50 or over: + $8,000"); assert.equal(ownLimit({ birthDate: "1963-03-15" }, "2026-11-12"), 35750, "63: + $11,250");
  // the person's own number is theirs: no check on it
  const typed = rd(c(), stub(["Gross Pay 4,000.00", "401(k) 1,200.00", "Net Pay 2,000.00"]), { extra: { k401: 1200 }, typed: ["k401"] }).proposals.find((x) => x.id === "k401");
  assert.equal(typed.suspect, undefined);
  assert.deepEqual(moneyIn("401(k) 4.00% 110.77 (2,436.94) -5.00"), [110.77, -2436.94, -5]);
});

test("N2: TSP, 457(b), thrift, deferred comp and 'Retirement Plan' lines are the plan's; with one on the stub nothing asks about the money on file", () => {
  const jamie = () => { const p = caseyLike(); Object.assign(p.retirement.contributions[0], { amount: 250, period: "monthly" }); p.income[0].amount = 64000; return p; };
  const tsp = rd(jamie(), "DEPARTMENT OF PARKS\nPay Date: 11/06/2026\nPay Period: 10/19/2026 - 11/01/2026\nGross Pay 2,461.54 54,153.88\nFederal Income Tax 231.40 4,628.00\nTSP 110.77 2,215.40\nRoth TSP 55.38 1,107.60\nTSP Agency Match 98.46 1,969.20\nNet Pay 1,890.12");
  assert.equal(tsp.fields.k401, 110.77); assert.equal(tsp.fields.roth401k, 55.38); assert.equal(tsp.fields.match, 98.46);
  assert.equal(tsp.proposals.some((x) => x.move || x.zero), false);
  for (const [later, roth] of [["457(b) 110.77", "Roth 457(b) 55.38"], ["Retirement Plan 110.77", "Roth 55.38"], ["Thrift Savings Plan 110.77", "Roth TSP 55.38"], ["Deferred Comp 110.77", "Roth Deferred Comp 55.38"]]) {
    const d = rd(jamie(), stub(["Gross Pay 2,461.54", later, roth, "Net Pay 1,890.12"]));
    assert.equal(d.fields.k401, 110.77, later); assert.equal(d.fields.roth401k, 55.38, roth); assert.equal(d.proposals.some((x) => x.move), false, later);
  }
  assert.equal(readFields("paystub", "Gross Pay 2,000.00\nNet Pay 1,457.00").k401, undefined, "the 457 inside an amount is not a plan");
  // the plan words the reader knows are ones Contributions counts against the 401(k) limit when they name a Roth account
  for (const name of ["Roth 401(k)", "Roth 403(b)", "Roth 457(b)", "Roth TSP", "Thrift Roth"]) { assert.ok(PLAN_WORDS.test(name), name); assert.equal(limitKind("roth", name, 0), "401k", name); }
});

test("N4: a 401(k) nobody owns (Net worth's 'Joint or shared') is this paycheck's when the household has one adult; using it makes it theirs", () => {
  const riley = caseyLike(); riley.household.people[0].name = "Riley";
  riley.accounts = [{ id: "chk", name: "Checking", type: "checking", ownerId: "", balance: 400 }, { id: "wk", name: "Work 401(k)", type: "401k", ownerId: "", balance: 0, asOf: TODAY, history: [] }];
  riley.retirement.contributions = [];
  const props = rd(riley, SPLIT).proposals.filter((x) => x.op === "work");
  assert.deepEqual(props.map((x) => [x.id, x.make, x.accountName]), [["k401", "row", "Work 401(k)"], ["roth401k", "account", "Riley's Roth 401(k) at work"], ["match", "row", "Work 401(k)"]]);
  useAll(riley, props);
  assert.deepEqual(riley.accounts.map((a) => [a.name, a.type, a.ownerId]), [["Checking", "checking", ""], ["Work 401(k)", "401k", "p1"], ["Riley's Roth 401(k) at work", "roth", "p1"]], "no second 401(k) account");
  // two adults and one unowned 401(k) nobody else pays into: taken; one another adult pays into: not
  const two = danaLee(); two.accounts[1].ownerId = ""; two.retirement.contributions = two.retirement.contributions.filter((c) => c.personId !== "l");
  assert.equal(workRows(two, "l").laterAcct.id, "kl");
  const paid = danaLee(); paid.accounts[0].ownerId = ""; paid.accounts[1].ownerId = "x"; paid.retirement.contributions = paid.retirement.contributions.filter((c) => c.personId !== "l");
  assert.equal(workRows(paid, "l").laterAcct, null, "Dana pays into the unowned one: it is not Lee's");
  // several unowned 401(k) accounts, one adult: the page asks which, the first is the default, "new" makes one
  const many = caseyLike(); many.accounts = [{ id: "a1", name: "401(k) A", type: "401k", ownerId: "" }, { id: "a2", name: "401(k) B", type: "401k", ownerId: "" }]; many.retirement.contributions = [];
  const k = rd(many, SPLIT).proposals.find((x) => x.id === "k401");
  assert.deepEqual(k.choices, [{ id: "a1", name: "401(k) A" }, { id: "a2", name: "401(k) B" }]); assert.equal(k.accountId, "a1");
  assert.equal(rd(many, SPLIT, { accountFor: { later: "a2" } }).proposals.find((x) => x.id === "k401").accountId, "a2");
  const fresh = rd(many, SPLIT, { accountFor: { later: "new" } }).proposals.find((x) => x.id === "k401");
  assert.equal(fresh.make, "account"); useAll(many, [fresh]); assert.equal(many.accounts.length, 3);
});

test("B8: a second job's stub goes to that job's row and pay line, and the page can ask which job", () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-403", name: "Clinic 403(b)", type: "401k", balance: 2000, ownerId: "p-ana", asOf: TODAY, history: [] });
  p.retirement.contributions.push({ id: "c-clinic", accountId: "a-403", personId: "p-ana", amount: 60, period: "biweekly", employerMatch: 0 });
  p.income.push({ id: "i-clinic", name: "Ana's clinic shifts", type: "salary", personId: "p-ana", amount: 1200, period: "biweekly" });
  const clinic = stub(["Gross Pay 1,250.00", "Federal Income Tax 90.00", "403(b) 65.00", "Net Pay 950.00"], ["LAKE CLINIC", "Pay Date 11/06/2026", "Pay Period 10/19/2026 to 11/01/2026"]);
  const d = rd(p, clinic, { personId: "p-ana" });
  assert.deepEqual(d.stub.jobs.map((j) => [j.rowId, j.name]), [["c-ana", p.accounts.find((a) => a.id === p.retirement.contributions.find((c) => c.id === "c-ana").accountId).name], ["c-clinic", "Clinic 403(b)"]]);
  assert.equal(d.stub.jobRowId, "c-clinic", "the row nearest the stub's $65 every two weeks");
  const k = d.proposals.find((x) => x.id === "k401"), pay = d.proposals.find((x) => x.id === "pay");
  assert.equal(k.contributionId, "c-clinic"); assert.equal(k.accountName, "Clinic 403(b)"); assert.equal(k.before.amount, 60);
  assert.equal(pay.incomeId, "i-clinic"); assert.equal(pay.incomeName, "Ana's clinic shifts");
  assert.equal(d.proposals.find((x) => x.id === "withholding").twoJobs, true, "one withholding figure per person: this paycheck is not all of it");
  useAll(p, [k, pay]);
  assert.equal(p.retirement.contributions.find((c) => c.id === "c-ana").amount, 470, "the first job's row is left alone"); assert.equal(p.retirement.contributions.find((c) => c.id === "c-clinic").amount, 65);
  assert.equal(p.income.find((i) => i.id === "i-ana").amount, 3900); assert.equal(p.income.find((i) => i.id === "i-clinic").amount, 1250);
  // the person says it is the other job
  assert.equal(rd(p, clinic, { personId: "p-ana", jobRowId: "c-ana" }).proposals.find((x) => x.id === "k401").contributionId, "c-ana");
});

test("B11: with no adult on the plan a stub proposes nothing (no 'Your pay' added again and again)", () => {
  const p = caseyLike(); p.household.people = [];
  const d = rd(p, SPLIT);
  assert.equal(d.stub.noPeople, true); assert.deepEqual(d.proposals, []); assert.equal(d.fields.k401, 110.77, "the lines are still read and shown");
});

// ---------------------------------------------------------------- fix round 3 (final review F1). Invented stubs and households only.
const ZERO = stub(["Gross Pay 2,769.23 55,384.60", "Federal Income Tax 231.40 4,628.00", "401(k) 0.00 1,200.00", "Net Pay 2,159.84 43,196.80"]);

test("F1: the 401(k) line's year so far is read beside this paycheck's figure, only when the gross pay prints both", () => {
  const two = readPlanLines(stubLines(ZERO), 2769.23);
  assert.equal(two.k401, 0); assert.deepEqual(two.ytd, { k401: 1200 });
  assert.deepEqual(readPlanLines(stubLines(SPLIT), 2769.23).ytd, { k401: 2215.4, roth401k: 1107.6 }, "the rate (4.00%) is not a figure; the second figure is the year so far");
  assert.deepEqual(readPlanLines(["Gross Pay 2,769.23", "401(k) 0.00 1,200.00"], 2769.23).ytd, {}, "the pay line prints one figure: the second is not said to be the year so far");
  assert.deepEqual(readPlanLines(["Gross Pay 2,769.23 55,384.60", "401(k) 0.00"], 2769.23).ytd, {}, "a line with one figure has no year so far");
});

test("F1: a 401(k) line printed as $0.00 this paycheck is said, matching $0 on file or not, and 'Set it to $0' sets only that row", () => {
  // Casey, $0 on file: it matches; nothing to set
  const none = rd(caseyLike(), ZERO);
  assert.equal(none.fields.k401, 0);
  assert.deepEqual(none.stub.noPlanLine, { onFile: 0, zeroLine: true, sides: ["later"], ytd: 1200, set: [] });
  assert.ok(!none.proposals.some((x) => x.op === "work"), "no 401(k) card offers $0 as a change");
  // Jamie-like, $250 a month on file with a match: the plan says $3,000 a year; one change sets the row to $0, nothing else
  const saving = caseyLike(); Object.assign(saving.retirement.contributions[0], { amount: 250, period: "monthly", employerMatch: 1500 });
  const d = rd(saving, ZERO);
  assert.equal(d.stub.noPlanLine.onFile, 3000); assert.equal(d.stub.noPlanLine.zeroLine, true); assert.equal(d.stub.noPlanLine.ytd, 1200);
  assert.equal(d.stub.noPlanLine.set.length, 1);
  const x = d.stub.noPlanLine.set[0];
  assert.deepEqual([x.op, x.side, x.contributionId, x.amount, x.period, x.make], ["work", "later", "c1", 0, "monthly", null]);
  assert.deepEqual(x.before, { amount: 250, period: "monthly", yearly: 3000, match: 1500 });
  const before = JSON.parse(JSON.stringify(saving));
  useAll(saving, d.stub.noPlanLine.set);
  const row = saving.retirement.contributions[0];
  assert.equal(row.amount, 0); assert.equal(row.period, "monthly"); assert.equal(row.employerMatch, 1500, "the match on file is left for the person to change");
  assert.equal("pctOfPay" in row, false);
  assert.deepEqual(saving.retirement.workPlans, before.retirement.workPlans, "a $0 line says nothing new about the job's plan");
  assert.deepEqual(saving.accounts, before.accounts); assert.deepEqual(saving.income, before.income);
  const again = rd(saving, ZERO).stub.noPlanLine;
  assert.equal(again.onFile, 0); assert.deepEqual(again.set, [], "read again, it matches what is on file");
});

test("F1: a $0.00 Roth line, both lines at $0.00, a $0.00 line beside money going in, and an unread line", () => {
  const roth = rd(caseyLike(), stub(["Gross Pay 2,769.23", "Roth 401(k) 0.00", "Net Pay 2,159.84"]));
  assert.deepEqual(roth.stub.noPlanLine, { onFile: 0, zeroLine: true, sides: ["now"], ytd: null, set: [] }, "the pay line prints one figure: no year so far");
  const both = caseyLike(); Object.assign(both.retirement.contributions[0], { amount: 100, period: "biweekly" });
  const b = rd(both, stub(["Gross Pay 2,769.23", "401(k) Pre-Tax 0.00", "Roth 401(k) 0.00", "Net Pay 2,159.84"]));
  assert.deepEqual(b.stub.noPlanLine.sides, ["later", "now"]);
  assert.deepEqual(b.stub.noPlanLine.set.map((y) => [y.side, y.contributionId]), [["later", "c1"]], "only a row on file that holds money is set");
  // a Roth line above $0: no $0 card, the Roth line is the change
  const mixed = rd(caseyLike(), stub(["Gross Pay 2,769.23", "401(k) Pre-Tax 0.00", "Roth 401(k) 55.38", "Net Pay 2,159.84"]));
  assert.equal(mixed.stub.noPlanLine, null); assert.ok(mixed.proposals.some((y) => y.id === "roth401k"));
  // a line under "Current YTD" with one figure is the year so far, not $0: the unread card, not this one
  const ytdOnly = rd(caseyLike(), stub(["Current YTD", "Gross Pay 2,769.23 55,384.60", "401(k) 1,200.00", "Net Pay 2,159.84 43,196.80"]));
  assert.equal(ytdOnly.stub.unread, "ytd"); assert.equal(ytdOnly.stub.noPlanLine, null);
  // the stub's own words only: a 0 from the AI for a line the stub does not have is no $0.00 line
  const ai = rd(caseyLike(), stub(["Gross Pay 2,769.23", "Net Pay 2,159.84"]), { extra: { k401: 0 } });
  assert.deepEqual(ai.stub.noPlanLine, { onFile: 0 });
});

// ---- a W-2, a 1099 and last year's return (gap design #23, 2026-11-14). Invented forms of the invented households of
// qa/ (Ana and Bo of qa/fixtures/family-plan.mjs, Casey). The identifiers below are built at run time from pieces, so no
// such number is written in this file (the leak guard refuses them); each is checked never to come out of the reader.
const F = await import("./forms.js");
const W = await import("./form-words.js");
const fmtMod = await import("../../../core/format.js");
const TY = "2026-11-14";
const SSN = ["987", "65", "4320"].join("-"), SSN_SPACED = SSN.replace(/-/g, " "), SSN_DIGITS = SSN.replace(/-/g, "");
const EIN = ["98", "7654321"].join("-"), ACCOUNT = ["5550", "1234"].join(""), CONTROL = ["0042", "13"].join("");
const IDS = [SSN, SSN_SPACED, SSN_DIGITS, EIN, EIN.replace("-", ""), ACCOUNT, CONTROL, "4320", "7654321"];
/** no identifier, nor its digits, in anything the reader gives back */
const noIds = (x, what) => { const s = JSON.stringify(x); for (const id of IDS) assert.ok(!s.includes(id), `${what}: holds "${id}"`); };
const W2_LINES = (o = {}) => [`Form W-2 Wage and Tax Statement ${o.year ?? 2025}`, `a Employee's social security number ${SSN}`, `b Employer identification number (EIN) ${EIN}`,
  "c Employer's name, address, and ZIP code", "RIVERBEND HOSPITAL", `d Control number ${CONTROL}`, "e Employee's first name and initial Last name", o.name ?? "ANA EXAMPLE",
  `1 Wages, tips, other compensation ${o.box1 ?? "94,900.00"}`, `2 Federal income tax withheld ${o.box2 ?? "9,120.00"}`, "3 Social security wages 101,400.00", "4 Social security tax withheld 6,286.80",
  `5 Medicare wages and tips ${o.box5 ?? "101,400.00"}`, "6 Medicare tax withheld 1,470.30", ...(o.box12 ?? ["12a D 6,500.00", "12b W 1,200.00", "12c DD 8,400.00", "12d AA 1,000.00"])];
const W2 = (o) => W2_LINES(o).join("\n");
// the form as its boxes copy: labels in a row, their figures in the row under them
const W2_GRID = ["2025 W-2 Wage and Tax Statement", "a Employee's social security number", SSN, "b Employer identification number (EIN)   1 Wages, tips, other compensation   2 Federal income tax withheld",
  `${EIN}   94,900.00   9,120.00`, "c Employer's name, address, and ZIP code   3 Social security wages   4 Social security tax withheld", "RIVERBEND HOSPITAL   101,400.00   6,286.80",
  "5 Medicare wages and tips   6 Medicare tax withheld", "101,400.00   1,470.30", "12a See instructions for box 12   12b", "D 6500.00   W 1200.00"].join("\n");
// a payroll site's page
const W2_SITE = ["Tax Year 2025 W-2", `Employee SSN: XXX-XX-${SSN.slice(-4)}`, "Box 1: Wages, tips, other compensation $94,900.00", "Box 2: Federal income tax withheld $9,120.00",
  "Box 5: Medicare wages and tips $101,400.00", "Box 12: D - 401(k) Deferral: $6,500.00", "Box 12: AA - Roth 401(k): $1,000.00", "Box 12: W - Employer HSA $1,200.00"].join("\n");
const F1099 = ["2025 TAX REPORTING STATEMENT", `Account number ${ACCOUNT}`, `PAYER'S TIN ${EIN}   RECIPIENT'S TIN XXX-XX-${SSN.slice(-4)}`,
  "Form 1099-DIV Dividends and Distributions", "1a Total ordinary dividends 1,250.40", "1b Qualified dividends 980.10", "2a Total capital gain distr. 312.00  2b Unrecap. Sec. 1250 gain 0.00", "4 Federal income tax withheld 0.00", "12 Exempt-interest dividends 45.00",
  "Form 1099-INT Interest Income", "1 Interest income 321.75", "3 Interest on U.S. Savings Bonds and Treasury obligations 50.00", "4 Federal income tax withheld 0.00", "8 Tax-exempt interest 12.00",
  "Form 1099-B Proceeds From Broker and Barter Exchange Transactions", "SHORT-TERM TRANSACTIONS FOR COVERED TAX LOTS", "Total Short-term Proceeds 4,200.00  Total Cost Basis 4,650.00",
  "LONG-TERM TRANSACTIONS FOR COVERED TAX LOTS", "Total Long-term Proceeds 12,400.00  Total Cost Basis 9,100.00"].join("\n");
const F1099R = ["Form 1099-R 2025 Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc.", `Account number ${ACCOUNT}`,
  "1 Gross distribution $18,000.00", "2a Taxable amount $18,000.00", "2b Taxable amount not determined", "4 Federal income tax withheld $1,800.00", "7 Distribution code(s) 7"].join("\n");
// the 2025 Form 1040 (lines 11a, 11b, 15, 24) and one from before 2025 (line 11), as tax software prints them
const F1040 = ["1040 U.S. Individual Income Tax Return 2025", "For the year Jan. 1–Dec. 31, 2025, or other tax year beginning", `Your social security number ${SSN}`,
  "1a Total amount from Form(s) W-2, box 1 (see instructions) 1a 118,400.", "9 Add lines 1z, 2b, 3b, 4b, 5b, 6b, 7a, and 8. This is your total income . . . 9 121,950.", "10 Adjustments to income from Schedule 1, line 26 . . . 10 2,700.",
  "11a Subtract line 10 from line 9. This is your adjusted gross income . . . . 11a 119,250.", "11b Amount from line 11a (adjusted gross income) . . . 11b 119,250.", "14 Add lines 12e and 13b . . . 14 31,500.",
  "15 Subtract line 14 from line 11b. If zero or less, enter -0-. This is your taxable income . . . 15 87,750.", "22 Subtract line 21 from line 18. If zero or less, enter -0- . . . 22 8,712.",
  "24 Add lines 22 and 23. This is your total tax . . . . 24 9,184.", "25d Add lines 25a through 25c . . . 25d 10,050."].join("\n");
const F1040_OLD = ["Form 1040 U.S. Individual Income Tax Return 2024", "11 Subtract line 10 from line 9. This is your adjusted gross income . . . 11 84,250", "15 Subtract line 14 from line 11. This is your taxable income . . . 15 69,650", "24 Add lines 22 and 23. This is your total tax . . . 24", "812"].join("\n");
const fam = (year = null) => { const p = familyPlan(TY); if (year) p.taxes.year = year; return p; };
const rf = (plan, text, extra = {}) => compute(plan, { text, today: TY, ...extra });
const money = (n) => fmtMod.money(n, "USD");
const wAna = { money, Whose: "Ana's", whose: "Ana's", whoIn: "Ana", nameOf: (n) => `${n}'s` };
const wYou = { money, Whose: "Your", whose: "your", whoIn: "you", nameOf: (n) => `${n}'s` };
// a sentence's words, then each page it sends to (drawn as an outlined button under the words) in brackets
// "9,999,999,999.99" as a figure (written so, as no run of nine digits sits in the repo)
const HUGE = 1e10 - 0.01;
const said = (parts) => parts.map((x) => (typeof x === "string" ? x : ` [${x.label}]`)).join("");

test("#23 a W-2 read by its box words in three layouts (one box a line, the form's grid, a payroll site), the plain rules alone", () => {
  const want = { wages: 94900, federal: 9120, medicareWages: 101400, k401: 6500, roth401k: 1000, hsaWork: 1200, year: 2025 };
  assert.deepEqual(readFields("w2", W2(), TY), want);
  const { roth401k, ...noRoth } = want;
  assert.deepEqual(readFields("w2", W2_GRID, TY), noRoth, "the grid has no Roth line");
  assert.deepEqual(readFields("w2", W2_SITE, TY), want);
  // with the AI helper off nothing else is needed: compute reads them, and asks nobody
  const d = rf(fam(), W2());
  assert.equal(d.kind, "w2"); assert.equal(d.detected, "w2");
  assert.deepEqual(d.fields, want);
  assert.deepEqual(d.missing, []);
});

test("#23 box 12: each code once (a W-2 pasted with its copies B, C and 2), codes not read are left, a capital inside a word is no code", () => {
  assert.deepEqual(F.box12(["12a D 6,500.00", "12b W 1,200.00", "12a D 6,500.00", "12b W 1,200.00"]), { D: 6500, W: 1200 }, "the copies repeat the codes");
  assert.deepEqual(F.box12(["12a D 6500.00   12b W 1200.00   12c DD 8400.00"]), { D: 6500, W: 1200, DD: 8400 });
  assert.deepEqual(F.box12(["Box 12: D - 401(k) Deferral: $6,500.00", "Box 12 Code EE 2,000.00"]), { D: 6500, EE: 2000 });
  assert.deepEqual(F.box12(["12a See instructions for box 12", "ANA EXAMPLE D 6500.00"]), { D: 6500 }, "the code under its box, a name before it");
  assert.deepEqual(F.box12(["Deferral 6,500.00", "Wages 94,900.00"]), {}, "no box 12 line, no code");
  // D, E and G add up as money put in before tax; AA, BB and EE as Roth
  const both = readFields("w2", W2({ box12: ["12a D 4,000.00", "12b G 2,500.00", "12c AA 600.00", "12d BB 400.00"] }), TY);
  assert.equal(both.k401, 6500); assert.equal(both.roth401k, 1000); assert.equal(both.hsaWork, undefined);
  const d = rf(fam(), W2({ box12: ["12a D 4,000.00", "12b G 2,500.00"] }));
  assert.deepEqual(d.found.find((x) => x.key === "k401").parts, [{ code: "D", amount: 4000 }, { code: "G", amount: 2500 }]);
});

test("#23 a 1099: a combined statement (DIV, INT and B by how long held), a 1099-R; the 1099-R's taxable amount only on a 1099-R", () => {
  assert.deepEqual(readFields("f1099", F1099, TY), { interest: 321.75, treasury: 50, ordinaryDiv: 1250.4, qualifiedDiv: 980.1, capGainDist: 312, exemptInterest: 57,
    shortProceeds: 4200, shortBasis: 4650, longProceeds: 12400, longBasis: 9100, withheld: 0, year: 2025 });
  assert.deepEqual(readFields("f1099", F1099R, TY), { iraGross: 18000, iraTaxable: 18000, withheld: 1800, year: 2025 });
  assert.equal(readFields("f1099", "Form 1099-INT 2025\n1 Interest income 40.00\nTaxable amount 40.00", TY).iraTaxable, undefined, "not a 1099-R");
  // a 1099-B that does not say how long the sales were held: its sales are read, with no term
  assert.deepEqual(readFields("f1099", "Form 1099-B 2025\n1d Proceeds 3,000.00\n1e Cost or other basis 2,000.00\n2 Short-term gain or loss\nLong-term gain or loss", TY), { proceeds: 3000, basis: 2000, year: 2025 });
  // what is not found is said only for the forms the text holds
  assert.deepEqual(rf(fam(2025), F1099R).missing, []);
  assert.deepEqual(rf(fam(2025), "Form 1099-INT 2025\n1 Interest income 40.00").missing, ["Interest on savings bonds and Treasury bills (1099-INT box 3)", "Tax-exempt interest (1099-INT box 8, 1099-DIV box 12)", "Federal tax taken out (box 4)"]);
});

test("#23 a Form 1040 by its line words: 2025's lines 11a and 24, line 11 before; dot leaders, line numbers and references are never the amount", () => {
  assert.deepEqual(readFields("f1040", F1040, TY), { agi: 119250, taxable: 87750, totalTax: 9184, year: 2025 });
  assert.deepEqual(readFields("f1040", F1040_OLD, TY), { agi: 84250, taxable: 69650, totalTax: 812, year: 2024 }, "line 24's amount on the line under it");
  assert.equal(F.amountIn(" . . . 24 7,840.", ["24"]), 7840);
  assert.equal(F.amountIn(" . . . 24", ["24"]), null, "the line's own number is no amount");
  assert.equal(F.amountIn(" Subtract line 10 from line 9 . . . 11a 119,250.", ["11"]), 119250, "references are not words");
  assert.equal(F.amountIn(" OMB No. 1545-0110"), null, "a number joined by a hyphen is no amount");
  assert.equal(F.amountIn(" shown in box 5, as well as the tax on any of those above $200,000."), null, "a figure deep in a sentence is not the box's");
  assert.equal(F.amountIn(" (1,200.00)"), -1200);
  assert.equal(F.amountIn(" 2025"), null, "a year is no amount");
  assert.equal(F.amountIn(" 58,250.00 2 ", [], { more: true }), 58250, "the next box's number is no amount");
  // a loss year: the adjusted gross income keeps its minus
  assert.equal(readFields("f1040", "Form 1040 2025\nThis is your adjusted gross income . . . 11a (4,100.)", TY).agi, -4100);
});

test("#23 the year: the form's words, never its revision or print date; a form that does not say is taken as last year's, and a year after this one is none", () => {
  assert.equal(F.formYear("w2", "Form W-2 Wage and Tax Statement 2025", 2026), 2025);
  assert.equal(F.formYear("f1099", "Form 1099-INT (Rev. January 2024)\nFor calendar year 2025", 2026), 2025);
  assert.equal(F.formYear("f1099", "Form 1099-DIV (Rev. 1-2024)\n1a Total ordinary dividends 10.00", 2026), null);
  assert.equal(F.formYear("f1040", "For the year Jan. 1–Dec. 31, 2025, or other tax year beginning", 2026), 2025);
  assert.equal(F.formYear("w2", "Form W-2 Wage and Tax Statement 2027", 2026), null, "not yet");
  const d = rf(fam(), W2().replace("Wage and Tax Statement 2025", "Wage and Tax Statement"));
  assert.equal(d.form.year, 2025); assert.equal(d.form.yearWhy, "assumed");
  assert.equal(rf(fam(), W2().replace("Wage and Tax Statement 2025", "Wage and Tax Statement"), { year: 2026 }).form.yearWhy, "you");
  // a return that does not say: the year before the one the Federal estimate works out
  const r = rf(fam(), F1040.replace(/2025/g, "").replace("For the year", "For the period"));
  assert.equal(r.form.year, 2025); assert.equal(r.form.when, "last");
});

test("#23 the kind from its words: a W-2, a 1099, a 1040; the papers read before keep their kind", () => {
  assert.equal(detectKind(W2()), "w2"); assert.equal(detectKind(W2_GRID), "w2"); assert.equal(detectKind(W2_SITE), "w2");
  assert.equal(detectKind(F1099), "f1099"); assert.equal(detectKind(F1099R), "f1099");
  assert.equal(detectKind(F1040), "f1040"); assert.equal(detectKind(F1040_OLD), "f1040");
  assert.equal(detectKind(STUB), "paystub"); assert.equal(detectKind(STATEMENT), "statement"); assert.equal(detectKind(SSA), "ssa"); assert.equal(detectKind(ADVISOR), "advisor");
});

test("#23 identifiers (Social Security, employer, account and control numbers) are never read, proposed, kept, shown or sent to the AI", () => {
  for (const t of [F.scrub(W2()), F.scrub(W2_GRID), F.scrub(W2_SITE), F.scrub(F1099), F.scrub(F1099R), F.scrub(F1040)]) noIds(t, "the text once scrubbed");
  assert.equal(F.scrub(`SSN ${SSN_SPACED}`).trim(), "SSN", "with spaces");
  assert.equal(F.scrub(`Account no. ${ACCOUNT.slice(0, 6)}`).trim(), "Account no.", "a short account number after its label");
  assert.match(F.scrub("1 Wages, tips, other compensation 94,900.00"), /94,900\.00/, "amounts stay");
  for (const [text, year] of [[W2(), null], [W2(), 2025], [W2_GRID, 2025], [W2_SITE, 2025], [F1099, 2025], [F1099R, 2025], [F1040, null]]) {
    const p = fam(year);
    const d = rf(p, text);
    noIds(d, `compute() of ${d.kind}`);
    assert.ok(d.proposals.length || d.form.checks.length, `${d.kind}: something to say`);
    const g = ids();
    for (const x of d.proposals) applyProposal(p, x, g);
    noIds(p, `the plan after every change of a ${d.kind}`);
    // what goes to the AI helper is the text with them blanked, and the helper is told to give none back
    const msgs = buildPrompt(d.kind, text);
    noIds(msgs, `the AI prompt for a ${d.kind}`);
    assert.match(msgs[0].content, /Never include a Social Security number/);
  }
  // an answer from the AI that holds one is dropped: nine digits or more is no amount on a tax form, and only known keys are kept
  assert.deepEqual(parseAnswer("w2", JSON.stringify({ wages: SSN_DIGITS, federal: SSN, ssn: SSN, ein: EIN, k401: "6,500.00", year: "2025" })), { k401: 6500, year: 2025 });
  // the pasted text is not kept beyond the page: compute leaves the plan as it was
  const p = fam(2025), before = JSON.stringify(p); rf(p, W2()); assert.equal(JSON.stringify(p), before);
});

test("#23 last year's W-2 leaves this year's figures alone: no wages and no tax taken out; a 401(k) figure the person set stays, nothing or our guess is filled", () => {
  // Ana: 470 every two weeks on file (her own figure); the W-2 is 2025's, the Federal estimate works out 2026
  const p = fam();
  const d = rf(p, W2());
  assert.equal(d.form.when, "last");
  assert.deepEqual(d.proposals.map((x) => x.id), ["roth401k"], "only the Roth 401(k), which has nothing on file");
  assert.ok(!d.proposals.some((x) => x.op === "taxYear"), "no figure of 2026's tax");
  assert.deepEqual(d.form.checks.find((c) => c.id === "k401"), { id: "k401", kind: "k401", side: "later", amount: 6500, onFile: 12220, year: 2025 });
  const g = ids(); for (const x of d.proposals) applyProposal(p, x, g);
  assert.deepEqual(p.taxes.thisYear, familyPlan(TY).taxes.thisYear, "this year's tax figures untouched");
  assert.equal(p.retirement.contributions.find((c) => c.id === "c-ana").amount, 470, "her figure stays");
  // Casey: a 401(k) at work with nothing going in: filled as a year's figure, and the plan says money goes in
  const c = caseyLike();
  const dc = rf(c, W2({ name: "CASEY EXAMPLE", box12: ["12a D 9,000.00"] }));
  assert.deepEqual(dc.proposals.map((x) => [x.id, x.op, x.make, x.amount, x.period]), [["k401", "work", null, 9000, "annual"]]);
  applyProposal(c, dc.proposals[0], ids());
  assert.deepEqual(c.retirement.contributions[0], { id: "c1", accountId: "k1", personId: "p1", amount: 9000, period: "annual", employerMatch: 0 }, "the share of pay goes, the match stays");
  assert.equal(rf(c, W2({ name: "CASEY EXAMPLE", box12: ["12a D 9,000.00"] })).form.checks.find((x) => x.id === "k401").same, true, "read again: already on file");
  // our guess on file is filled too, and the guess is dropped
  const gp = caseyLike(); Object.assign(gp.retirement.contributions[0], { amount: 300 });
  gp.guesses = { "retirement.contributions[c1].amount": { k: "contrib.amount", v: 300, u: "month", s: 0.3, at: TY, d: null } };
  const dg = rf(gp, W2({ name: "CASEY EXAMPLE", box12: ["12a D 9,000.00"] }));
  assert.equal(dg.proposals[0].before.guess, true);
  applyProposal(gp, dg.proposals[0], ids());
  assert.equal(gp.guesses, undefined, "the W-2's figure is the person's own");
});

test("#23 a W-2 for the year the Federal estimate works out fills its wages and tax taken out; a typed figure is added to, never replaced", () => {
  const p = fam(2025);
  const d = rf(p, W2());
  assert.equal(d.form.when, "plan");
  const wages = d.proposals.find((x) => x.id === "wages"), held = d.proposals.find((x) => x.id === "withheld");
  assert.deepEqual([wages.field, wages.before, wages.after, wages.adds], ["wages", null, 94900, undefined]);
  assert.deepEqual(wages.others, [{ id: "p-bo", name: "Bo" }], "Bo has pay too: the page says his W-2 adds to it");
  applyProposal(p, wages, ids()); applyProposal(p, held, ids());
  assert.equal(p.taxes.thisYear.wages, 94900); assert.equal(p.taxes.thisYear.withheld, 9120); assert.equal(p.taxes.thisYear.withheldTyped, true);
  // Bo's W-2 next: added to Ana's
  const bo = rf(p, W2({ name: "BO EXAMPLE", box1: "62,400.00", box2: "5,000.00", box5: "62,400.00", box12: [] }));
  assert.equal(bo.form.personId, "p-bo");
  const bw = bo.proposals.find((x) => x.id === "wages");
  assert.deepEqual([bw.before, bw.after, bw.adds], [94900, 157300, true]);
  applyProposal(p, bw, ids());
  assert.equal(p.taxes.thisYear.wages, 157300);
  // Ana's again: the same figure is on file now? no: 157,300 is not 94,900, so it would add; the page asks to leave it then
  assert.equal(rf(p, W2()).proposals.find((x) => x.id === "wages").adds, true);
  // a household of one reading its W-2 twice: the second time it is already on file
  const one = caseyLike(); one.taxes = { year: 2025, thisYear: {} };
  applyProposal(one, rf(one, W2({ name: "CASEY EXAMPLE" })).proposals.find((x) => x.id === "wages"), ids());
  assert.equal(rf(one, W2({ name: "CASEY EXAMPLE" })).proposals.find((x) => x.id === "wages").same, true);
});

test("#23 a 1099 for the Federal estimate's year: other income, qualified dividends, tax-exempt interest, gains rows, withdrawals, tax taken out; cautions when the Income page counts it", () => {
  const p = fam(2025);
  const d = rf(p, F1099);
  assert.deepEqual(d.proposals.map((x) => [x.id, x.op, x.field ?? x.held ?? null, x.amount ?? x.proceeds]), [
    ["ordinary", "taxYear", "otherOrdinary", 642.05], ["qualified", "taxYear", "qualifiedIncome", 980.1], ["exempt", "taxYear", "taxExemptInterest", 57],
    ["capdist", "gain", "long", 312], ["sale-short", "gain", "short", 4200], ["sale-long", "gain", "long", 12400]]);
  assert.deepEqual(d.proposals[0].parts, { interest: 371.75, dividends: 270.3 }, "boxes 1 and 3 of the 1099-INT, 1a less 1b of the 1099-DIV");
  const g = ids(); for (const x of d.proposals) applyProposal(p, x, g);
  assert.equal(p.taxes.thisYear.otherOrdinary, 642.05); assert.equal(p.taxes.thisYear.qualifiedIncome, 980.1); assert.equal(p.taxes.thisYear.taxExemptInterest, 57);
  assert.deepEqual(p.taxes.gains.map(({ id, ...x }) => x), [
    { name: "Capital gain distributions", proceeds: 312, basis: 0, held: "long" },
    { name: "Sales on a 1099-B, held a year or less", proceeds: 4200, basis: 4650, held: "short" },
    { name: "Sales on a 1099-B, held more than a year", proceeds: 12400, basis: 9100, held: "long" }]);
  // read again: every one is already on file, nothing is offered twice
  assert.ok(rf(p, F1099).proposals.every((x) => x.same), "already on file");
  // a 1099-R: the taxed part to the withdrawals, its tax taken out added to what is typed
  const r = fam(2025); r.taxes.thisYear.withheld = 500; r.taxes.thisYear.withheldTyped = true;
  const dr = rf(r, F1099R);
  assert.deepEqual(dr.proposals.map((x) => [x.id, x.before, x.after, !!x.adds]), [["ira", null, 18000, false], ["withheld", 500, 2300, true]]);
  // the Income page's dividends and interest, or a pension: the card says it may count twice, and it is never the filled one
  const inc = fam(2025); inc.income.push({ id: "i-div", name: "Dividends", type: "investment", personId: "p-ana", amount: 100, period: "monthly", taxable: true }, { id: "i-pen", name: "Pension", type: "pension", personId: "p-bo", amount: 1500, period: "monthly", taxable: true });
  const di = rf(inc, F1099);
  assert.equal(di.proposals.find((x) => x.id === "ordinary").caution, "income"); assert.equal(di.proposals.find((x) => x.id === "ordinary").incomeYearly, 1200);
  assert.equal(di.proposals.find((x) => x.id === "exempt").caution, undefined);
  assert.equal(rf(inc, F1099R).proposals.find((x) => x.id === "ira").caution, "pension");
  // a 1099-B that does not say how long, or what they cost; a 1099-R with nothing taxed, or with its taxed part not said
  const t = rf(fam(2025), "Form 1099-B 2025\n1d Proceeds 3,000.00\n1e Cost or other basis 2,000.00");
  assert.deepEqual([t.proposals.length, t.form.checks.map((c) => c.kind)], [0, ["term"]]);
  assert.deepEqual(rf(fam(2025), "Form 1099-B 2025\nLong-term\n1d Proceeds 3,000.00").form.checks.map((c) => c.kind), ["cost"]);
  assert.deepEqual(rf(fam(2025), "Form 1099-R 2025\n1 Gross distribution 9,000.00\n2a Taxable amount 0.00").form.checks.map((c) => c.kind), ["untaxed"]);
  assert.deepEqual(rf(fam(2025), "Form 1099-R 2025\n1 Gross distribution 9,000.00").form.checks.map((c) => c.kind), ["taxedPart"]);
});

test("#23 a 1099 of another year than the Federal estimate's changes nothing: one line says how to use it", () => {
  const p = fam();
  const d = rf(p, F1099);
  assert.deepEqual([d.proposals.length, d.form.checks], [0, [{ id: "year", kind: "year", year: 2025, planYear: 2026 }]]);
  assert.equal(rf(p, F1099R).proposals.length, 0);
});

test("#23 last year's return gives Estimated payments its figures; a return of another year changes nothing", () => {
  const p = fam();
  const d = rf(p, F1040);
  assert.deepEqual(d.proposals, [{ id: "prior", op: "priorYear", agi: 119250, tax: 9184, year: 2025, before: null, after: { agi: 119250, tax: 9184 } }]);
  applyProposal(p, d.proposals[0], ids());
  assert.deepEqual(p.taxes.priorYear, { agi: 119250, tax: 9184 });
  assert.equal(rf(p, F1040).proposals[0].same, true, "read again: already on file");
  // figures typed on Estimated payments are last year's too: the return's replace them, both kept when one is read
  const q = fam(); q.taxes.priorYear = { agi: 100000, tax: 8000 };
  const only = rf(q, "Form 1040 2025\n24 Add lines 22 and 23. This is your total tax . . . 24 9,184.");
  assert.deepEqual(only.proposals[0].after, { agi: 100000, tax: 9184 });
  applyProposal(q, only.proposals[0], ids()); assert.deepEqual(q.taxes.priorYear, { agi: 100000, tax: 9184 });
  // 2024's return while the Federal estimate works out 2026: not last year's
  const old = rf(fam(), F1040_OLD);
  assert.deepEqual([old.proposals.length, old.form.checks], [0, [{ id: "year", kind: "return", year: 2024, planYear: 2026 }]]);
  assert.equal(rf(fam(2025), F1040_OLD).proposals.length, 1, "with 2025 worked out, 2024's is last year's");
});

test("#23 using a change writes one field (and, for the tax taken out, its typed mark), nothing else", () => {
  const diff = (a, b, at = "") => {
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diff(a[k], b[k], at ? `${at}.${k}` : k));
    return [at];
  };
  const cases = [[fam(2025), W2(), "wages", ["taxes.thisYear.wages"]], [fam(2025), W2(), "withheld", ["taxes.thisYear.withheld", "taxes.thisYear.withheldTyped"]],
    [fam(2025), F1099, "ordinary", ["taxes.thisYear.otherOrdinary"]], [fam(2025), F1099, "qualified", ["taxes.thisYear.qualifiedIncome"]], [fam(2025), F1099, "exempt", ["taxes.thisYear.taxExemptInterest"]],
    [fam(2025), F1099, "sale-long", ["taxes.gains"]], [fam(2025), F1099R, "ira", ["taxes.thisYear.iraWithdrawals"]], [fam(), F1040, "prior", ["taxes.priorYear.tax", "taxes.priorYear.agi"]]];
  for (const [p, text, id, paths] of cases) {
    const before = migrateClone(p);
    applyProposal(p, rf(p, text).proposals.find((x) => x.id === id), ids());
    assert.deepEqual(diff(before, p), paths, id);
  }
  // a W-2's 401(k) money: the person's row (and the account it is made in when there is none), and that money goes in
  const c = caseyLike(), before = structuredClone(c);
  applyProposal(c, rf(c, W2({ name: "CASEY EXAMPLE", box12: ["12a D 9,000.00"] })).proposals[0], ids());
  assert.deepEqual(diff(before, c), ["retirement.contributions"]);
});
const migrateClone = (p) => structuredClone(p);

test("#23 whose W-2: the only adult, the name on it, its pay, the one picked; asked when nothing tells; nobody on People", () => {
  assert.deepEqual([rf(caseyLike(), W2({ name: "CASEY EXAMPLE" })).form.personId, rf(caseyLike(), W2({ name: "CASEY EXAMPLE" })).form.who], ["p1", "only"]);
  // no name box at all (a payroll site's page): the only adult's
  assert.deepEqual([rf(caseyLike(), W2_SITE).form.personId, rf(caseyLike(), W2_SITE).form.who], ["p1", "only"]);
  assert.equal(rf(fam(), W2({ name: "BO EXAMPLE" })).form.who, "name");
  // no name: Bo's pay on file is $62,400 a year, and the W-2's pay before tax matches it
  const pay = rf(fam(), W2({ name: "", box1: "60,000.00", box5: "62,400.00" }));
  assert.deepEqual([pay.form.personId, pay.form.who], ["p-bo", "pay"]);
  const asked = rf(fam(), W2({ name: "", box5: "10,000.00", box1: "10,000.00" }));
  assert.deepEqual(asked.form.ask, [{ id: "p-ana", name: "Ana" }, { id: "p-bo", name: "Bo" }]);
  assert.deepEqual([asked.proposals, asked.form.checks], [[], []], "nothing until the person says");
  assert.equal(rf(fam(), W2({ name: "", box5: "10,000.00", box1: "10,000.00" }), { personId: "p-bo" }).form.who, "asked");
  const nobody = rf({ meta: { currency: "USD" }, household: { people: [] } }, W2());
  assert.deepEqual([nobody.form.noPeople, nobody.proposals.length], [true, 0]);
});

test("#23 R5: one written sentence per case (cards, checks, the line above them, already on file)", () => {
  const cards = [
    [{ op: "work", side: "later", year: 2025, amount: 9000, make: null, before: null }, wYou, "Now: nothing goes in. This W-2 shows $9,000 going in for 2025. Would be: $9,000 a year."],
    [{ op: "work", side: "later", year: 2025, amount: 9000, make: null, before: { yearly: 3600, guess: true } }, wYou, "Now: $3,600 a year, our guess. This W-2 shows $9,000 going in for 2025. Would be: $9,000 a year."],
    [{ op: "work", side: "now", year: 2025, amount: 1000, make: "account", accountName: "Ana's Roth 401(k) at work", before: null }, wAna, "Now: nothing goes in. This W-2 shows $1,000 going in for 2025. Would be: $1,000 a year, into a new account, Ana's Roth 401(k) at work, at $0 until you type its balance on Net worth."],
    [{ op: "work", side: "now", year: 2025, amount: 1000, make: "row", accountName: "Ana's Roth 401(k)", before: null }, wAna, "Now: nothing goes in. This W-2 shows $1,000 going in for 2025. Would be: $1,000 a year, into Ana's Roth 401(k)."],
    [{ op: "taxYear", field: "wages", year: 2025, amount: 94900, before: null, after: 94900 }, wAna, "Now: worked out from the pay on Income. Would be: $94,900, box 1 of Ana's W-2."],
    [{ op: "taxYear", field: "wages", form: "W-2", year: 2025, amount: 62400, before: 94900, after: 157300, adds: true }, wAna, "Now: $94,900 typed. This W-2 shows $62,400. If the $94,900 is from another job or a spouse's, add this to it; if it already holds this W-2, leave it."],
    [{ op: "taxYear", field: "wages", form: "W-2", year: 2026, amount: 58250, before: 60000, after: 118250, adds: true, near: true }, wYou, "Now: $60,000 typed. This W-2 shows $58,250. If the $60,000 was a guess at this same money, replace it; if it is other money, add this to it."],
    [{ op: "taxYear", field: "wages", year: 2025, amount: 94900, before: 50000, guess: true, after: 94900 }, wAna, "Now: $50,000, our guess. Would be: $94,900, box 1 of Ana's W-2."],
    [{ op: "taxYear", field: "withheld", from: "w2", year: 2025, amount: 9120, before: null, after: 9120 }, wAna, "Now: none typed. Would be: $9,120, box 2 of Ana's W-2."],
    [{ op: "taxYear", field: "withheld", from: "1099", form: "1099", year: 2025, amount: 1800, before: 500, after: 2300, adds: true }, wAna, "Now: $500 typed. This 1099 shows $1,800. If the $500 is from other forms or pay, add this to it; if it already holds this 1099, leave it."],
    [{ op: "taxYear", field: "otherOrdinary", year: 2025, amount: 642, before: null, after: 642, parts: { interest: 372, dividends: 270 } }, wYou, "Now: none typed. Would be: $642, $372 of interest and $270 of dividends that are not qualified."],
    [{ op: "taxYear", field: "otherOrdinary", year: 2025, amount: 372, before: null, after: 372, parts: { interest: 372, dividends: 0 } }, wYou, "Now: none typed. Would be: $372, $372 of interest."],
    [{ op: "taxYear", field: "otherOrdinary", year: 2025, amount: 270, before: null, after: 270, parts: { interest: 0, dividends: 270 } }, wYou, "Now: none typed. Would be: $270, $270 of dividends that are not qualified."],
    [{ op: "taxYear", field: "qualifiedIncome", year: 2025, amount: 980, before: null, after: 980 }, wYou, "Now: none typed. Would be: $980, box 1b, taxed at the lower rates for gains."],
    [{ op: "taxYear", field: "taxExemptInterest", year: 2025, amount: 57, before: null, after: 57 }, wYou, "Now: none typed. Would be: $57, this 1099."],
    [{ op: "taxYear", field: "iraWithdrawals", year: 2025, amount: 18000, before: null, after: 18000 }, wYou, "Now: the plan's own figure (its required withdrawal and what it takes out to spend). Would be: $18,000, box 2a, the part that is taxed."],
    [{ op: "gain", id: "capdist", year: 2025, proceeds: 312, basis: 0, held: "long" }, wYou, "Would add $312 to the Capital gains page, taxed as a gain on something held more than a year (box 2a)."],
    [{ op: "gain", id: "sale-long", year: 2025, proceeds: 12400, basis: 9100, held: "long" }, wYou, "Would add them to the Capital gains page: $12,400 sold, $9,100 paid, a gain of $3,300 (boxes 1d and 1e)."],
    [{ op: "gain", id: "sale-short", year: 2025, proceeds: 4200, basis: 4650, held: "short" }, wYou, "Would add them to the Capital gains page: $4,200 sold, $4,650 paid, a loss of $450 (boxes 1d and 1e)."],
    [{ op: "gain", id: "sale-long", year: 2026, proceeds: 10000, basis: 10500, cost: 12000, wash: 1500, held: "long" }, wYou, "Would add them to the Capital gains page: $10,000 sold, $12,000 paid, $1,500 of the loss not allowed now (a wash sale, box 1g), so a loss of $500."],
    [{ op: "priorYear", year: 2025, agi: 119250, tax: 9184, before: null, after: { agi: 119250, tax: 9184 } }, wYou, "Now: nothing on file. Would be: income before deductions (adjusted gross income) $119,250 and total tax $9,184. Estimated payments works out the safe amount to pay this year from them."],
    [{ op: "priorYear", year: 2025, agi: null, tax: 9184, before: { agi: 100000, tax: 8000 }, after: { agi: 100000, tax: 9184 } }, wYou, "Now: income before deductions (adjusted gross income) $100,000 and total tax $8,000. Would be: income before deductions (adjusted gross income) $100,000 and total tax $9,184. Estimated payments works out the safe amount to pay this year from them."],
  ];
  for (const [x, w, want] of cards) assert.equal(said(W.cardOf(x, w).says), want);
  // a card that adds to a typed figure: two outlined choices, the likelier first (review M1)
  assert.deepEqual(W.cardOf({ op: "taxYear", field: "wages", form: "W-2", year: 2026, amount: 58250, before: 60000, after: 118250, adds: true, near: true }, wYou).choices, [{ how: "replace", label: "Replace it: $58,250" }, { how: "add", label: "Add it: $118,250" }]);
  assert.deepEqual(W.cardOf({ op: "taxYear", field: "wages", form: "W-2", year: 2025, amount: 62400, before: 94900, after: 157300, adds: true }, wAna).choices.map((c) => c.how), ["add", "replace"]);
  assert.equal(W.cardOf({ op: "taxYear", field: "wages", year: 2025, amount: 94900, before: null, after: 94900 }, wAna).choices, undefined, "nothing typed: one Use it");
  // the amber lines, the quiet line, the green lines after "Use it"
  assert.equal(said(W.cardOf({ op: "work", side: "now", year: 2025, amount: 1000, make: null, before: null, caution: "later", laterYearly: 3000 }, wAna).caution), "The plan also has $3,000 a year going in as pay the tax later, and this W-2 shows none. If that is this same money, set it to $0 there. [What you save for retirement ›]");
  assert.equal(said(W.cardOf({ op: "gain", id: "sale-long", year: 2026, proceeds: 10000, basis: 8000, held: "long", caution: "discount", discount: 300 }, wYou).caution), "Box 1f shows $300 of market discount on bonds: up to that much of this gain is taxed as interest, not as a gain, and this counts it all as a gain.");
  assert.equal(said(W.cardOf({ op: "taxYear", field: "otherOrdinary", year: 2025, amount: 642, before: null, after: 642, parts: { interest: 642 }, caution: "income", incomeYearly: 1200 }, wYou).caution), "The Income page also counts $1,200 a year of dividends and interest. If that is this money, using this counts it twice.");
  assert.equal(said(W.cardOf({ op: "taxYear", field: "iraWithdrawals", year: 2025, amount: 18000, before: null, after: 18000, caution: "pension", pensionYearly: 18000 }, wYou).caution), "The Income page also counts $18,000 a year of pension. If this 1099-R is that pension, using this counts it twice.");
  assert.equal(W.cardOf({ op: "taxYear", field: "wages", year: 2025, amount: 94900, before: null, after: 94900, others: [{ id: "p-bo", name: "Bo" }] }, wAna).note, "The Federal estimate keeps one figure for the household: read Bo's W-2 next and it adds to this.");
  assert.equal(said(W.cardOf({ op: "work", side: "later", year: 2025, amount: 9000, make: "account", accountName: "Your 401(k) at work", before: null }, wYou).saved), "Your 401(k), pay the tax later: saved, $9,000 a year. Your 401(k) at work starts at $0: type its balance on Net worth. [Net worth ›] [What you save for retirement ›]");
  assert.equal(said(W.cardOf({ op: "taxYear", field: "wages", year: 2025, amount: 94900, before: null, after: 94900 }, wAna).saved), "Saved: $94,900 of wages for 2025. The Federal estimate shows the tax with it.");
  assert.equal(said(W.cardOf({ op: "gain", id: "sale-long", year: 2025, proceeds: 12400, basis: 9100, held: "long" }, wYou).saved), "Saved: the gain of $3,300 is on Capital gains. [Capital gains ›]");
  assert.equal(said(W.cardOf({ op: "gain", id: "capdist", year: 2025, proceeds: 312, basis: 0, held: "long" }, wYou).saved), "Saved: $312 of capital gain distributions is on Capital gains. [Capital gains ›]");
  assert.equal(said(W.cardOf({ op: "priorYear", year: 2025, agi: 119250, tax: 9184, before: null, after: { agi: 119250, tax: 9184 } }, wYou).saved), "Saved: Estimated payments now works out the safe amount from 2025's total tax, $9,184.");
  assert.equal(said(W.cardOf({ op: "priorYear", year: 2025, agi: 119250, tax: null, before: null, after: { agi: 119250, tax: null } }, wYou).saved), "Saved: Estimated payments now has 2025's adjusted gross income, $119,250.");
  // every page a sentence names comes last, never in the middle of its words (drawn as a button: review P3)
  const all = [...cards.map(([x, w]) => W.cardOf(x, w)), ...[{ kind: "k401", side: "later", amount: 6500, onFile: 12220, year: 2025 }, { kind: "big", label: "Pay that is taxed (box 1)", amount: 1e10, more: 0 }].map((c) => W.checkOf(c, wAna))];
  for (const c of all) for (const line of [c.says, c.caution, c.saved].filter(Boolean)) assert.ok(line.findIndex((x) => typeof x !== "string") < 0 || line.slice(line.findIndex((x) => typeof x !== "string")).every((x) => typeof x !== "string"), said(line));
  const checks = [
    [{ kind: "k401", side: "later", amount: 6500, onFile: 12220, year: 2025 }, wAna, "Already saved as $12,220 a year. This W-2 shows $6,500 for 2025, so we left yours. [What you save for retirement ›]"],
    [{ kind: "roth401k", side: "now", amount: 1000, onFile: 600, year: 2025 }, wAna, "Already saved as $600 a year. This W-2 shows $1,000 for 2025, so we left yours. [What you save for retirement ›]"],
    [{ kind: "choose", side: "later", amount: 6500, year: 2025 }, wAna, "This W-2 shows $6,500 going in for 2025. The plan has several 401(k) accounts with no owner: say which is this job's there. [What you save for retirement ›]"],
    [{ kind: "hsa", amount: 1200, onFile: 0, year: 2025 }, wAna, "This W-2 shows $1,200 put into an HSA through work in 2025: the employer's money and Ana's own, together. The plan has none for this year. [HSA and FSA ›]"],
    [{ kind: "hsa", amount: 1200, onFile: 3000, year: 2025 }, wYou, "This W-2 shows $1,200 put into an HSA through work in 2025: the employer's money and your own, together. The plan has $3,000 for this year: change it there if that is not what goes in now. [HSA and FSA ›]"],
    [{ kind: "pay", amount: 101400, onFile: 0, year: 2025 }, wAna, "This W-2 shows about $101,400 of pay before tax in 2025. The plan has no pay for Ana yet. [Income ›]"],
    [{ kind: "pay", amount: 101400, onFile: 70000, year: 2025 }, wYou, "This W-2 shows about $101,400 of pay before tax in 2025. The plan has $70,000 a year: change it there if this year's pay is different. [Income ›]"],
    [{ kind: "year", year: 2025, planYear: 2026 }, wYou, "The Federal estimate works out 2026, so this 1099 changes nothing there. To fill in your 2025 return from it, pick 2025 as the tax year there, then read it again. [Federal estimate ›]"],
    [{ kind: "return", year: 2024, planYear: 2026 }, wYou, "Estimated payments needs last year's return, 2025's, for the safe amount: this one changes nothing."],
    [{ kind: "return", year: 2026, planYear: 2026 }, wYou, "Estimated payments needs the return before it, 2025's, for the safe amount: this one changes nothing."],
    [{ kind: "cost", held: "long", proceeds: 3000, year: 2025 }, wYou, "This 1099-B shows $3,000 of sales but not what they cost (box 1e), so they are not added: add them with their cost on Capital gains. [Capital gains ›]"],
    [{ kind: "term", proceeds: 3000, year: 2025 }, wYou, "This 1099-B shows $3,000 of sales and does not say how long they were held, so they are not added: add them on Capital gains. [Capital gains ›]"],
    [{ kind: "untaxed", amount: 9000, year: 2025 }, wYou, "This 1099-R shows $9,000 taken out and none of it taxed (box 2a is $0), so nothing changes."],
    [{ kind: "taxedPart", amount: 9000, year: 2025 }, wYou, "This 1099-R shows $9,000 taken out but not the part that is taxed (box 2a): ask the payer, or type it on the Federal estimate. [Federal estimate ›]"],
    [{ kind: "big", label: "Pay that is taxed (box 1)", amount: HUGE, more: 0 }, wYou, "This text reads $10,000,000,000 for pay that is taxed (box 1): no form holds that much, so it is not used. Check the text you pasted."],
    [{ kind: "big", label: "Federal tax taken out (box 2)", amount: 2.5e8, more: 2 }, wYou, "This text reads $250,000,000 for Federal tax taken out (box 2), and 2 more figures as large: no form holds that much, so it is not used. Check the text you pasted."],
  ];
  for (const [c, w, want] of checks) assert.equal(said(W.checkOf(c, w).says), want, c.kind);
  const heads = [
    [{ kind: "w2", year: 2025, when: "plan", yearWhy: "form", personId: "p" }, wAna, "Ana's W-2 for 2025, the year the Federal estimate works out."],
    [{ kind: "w2", year: 2025, when: "last", yearWhy: "form", personId: "p" }, wAna, "Ana's W-2 for 2025. It covers 2025, so it fills in only what the plan does not have yet."],
    [{ kind: "w2", year: 2025, when: "last", yearWhy: "assumed", personId: null }, wYou, "A W-2 for 2025. It covers 2025, so it fills in only what the plan does not have yet. It does not say its year: change it under “The W-2 you pasted” if it is not 2025."],
    [{ kind: "f1099", year: 2025, when: "plan", yearWhy: "form" }, wYou, "A 1099 for 2025, the year the Federal estimate works out."],
    [{ kind: "f1099", year: 2025, when: "last", yearWhy: "form" }, wYou, "A 1099 for 2025."],
    [{ kind: "f1040", year: 2025, when: "last", yearWhy: "form" }, wYou, "Your tax return for 2025."],
    [{ kind: "f1040", year: 2025, when: "last", yearWhy: "assumed" }, wYou, "Your tax return for 2025. It does not say its year: change it under “The tax return you pasted” if it is not 2025."],
  ];
  for (const [f, w, want] of heads) assert.equal(W.headLine(f, w), want);
  // whose W-2 is asked: nothing tells, or its name is not the adult's it would go to (review P2)
  const nameOf = (n) => (n === "Me" ? "your" : `${n}'s`);
  assert.equal(said(W.askLine({ ask: [{ name: "Ana" }, { name: "Bo" }] }, { nameOf })), "It does not name either of you, and its pay matches neither pay on file. Nothing is changed until you say.");
  assert.equal(said(W.askLine({ doubt: true, ask: [{ name: "Jo" }] }, { nameOf })), "The name on it is not Jo's. If it is someone else's W-2, add them on People first; nothing is changed until you say. [People ›]");
  assert.equal(said(W.askLine({ doubt: true, ask: [{ name: "Me" }, { name: "Bo" }] }, { nameOf })), "The name on it is neither yours nor Bo's. If it is someone else's W-2, add them on People first; nothing is changed until you say. [People ›]");
  assert.equal(said(W.askLine({ doubt: true, ask: [{ name: "A" }, { name: "B" }, { name: "C" }] }, { nameOf })), "The name on it is none of the names on People. If it is someone else's W-2, add them on People first; nothing is changed until you say. [People ›]");
  assert.equal(W.sameWords({ kind: "k401", side: "later", onFile: 9000, year: 2025 }, wYou), "your 401(k), pay the tax later, $9,000 a year");
  assert.equal(W.sameWords({ op: "taxYear", field: "wages", year: 2025, amount: 94900 }, wAna), "wages for 2025 on the Federal estimate, $94,900");
  assert.equal(W.sameWords({ op: "gain", id: "capdist", year: 2025, proceeds: 312, basis: 0, held: "long" }, wYou), "capital gain distributions in 2025");
  assert.equal(W.sameWords({ op: "priorYear", year: 2025 }, wYou), "last year's return, 2025");
  assert.equal(W.sameWords({ kind: "pay", amount: 101400, onFile: 104000, year: 2025, same: true }, wAna), "Ana's pay, about $101,400 a year");
  assert.equal(W.sameWords({ kind: "hsa", amount: 1200, onFile: 1200, year: 2025, same: true }, wYou), "HSA money through work, $1,200");
});

// ---- #23 the screen (forms-view.js), drawn by the real view with the UI kit in the stand-in DOM, as the shell draws it:
// store.update applies the change and the page is drawn again
async function page(plan, { query = {} } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const root = new FakeElement("main");
  const route = { group: "ai", id: "reader", rest: [], query };
  const calls = { ai: 0 };
  const ctx = { ui, fmt: { ...fmt, today: () => TY }, plan: migrate(structuredClone(plan)), route, module: { group: "ai", id: "reader" }, view: { build: false }, live: { pc: false, ai: true }, api: {},
    ai: { chat: async (msgs) => { calls.ai++; calls.msgs = msgs; throw new Error("No AI helper is set up on this device."); } },
    store: { get: () => ctx.plan, update: (fn) => { const d = structuredClone(ctx.plan); fn(d); ctx.plan = d; draw(); } } };
  const draw = () => { root.replaceChildren(); render(root, ctx); };
  draw();
  const all = () => root.all();
  const button = (label) => all().find((e) => e.tagName === "BUTTON" && textOf(e) === label) ?? null;
  const partOf = (id) => all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id) ?? null;
  return { root, ctx, calls, all, button, partOf, text: () => textOf(root), textOf, draw,
    read(t) { const box = all().find((e) => e.tagName === "TEXTAREA"); box.value = t; box.dispatch("input"); button("Read it").click(); },
    clear() { button("Clear")?.click(); } };
}
const STYLE_OFF = (t) => t.replace(/\.rd-root[^]*?\}\s*(?=\.rd-root|[A-Z])/g, "");

test("#23 with no form read: the landing names the three tax forms and offers them as chips (review P1); ?kind=w2 opens on a W-2", async () => {
  const s = await page(fam()); s.clear();
  const text = STYLE_OFF(s.text());
  assert.match(text, /Read a document Paste the text of a pay stub, a W-2, a 1099, last year's tax return, a statement or a plan\. You see what each figure would change, and you use only the ones that are right\. W-2 1099 Last year's tax return Read it/);
  const chips = (x) => x.all().filter((e) => e.tagName === "A" && e.className.includes("chip")).map((e) => [x.textOf(e), e.getAttribute("href"), e.className.includes("on")]);
  assert.deepEqual(chips(s), [["W-2", "#/ai/reader?kind=w2", false], ["1099", "#/ai/reader?kind=f1099", false], ["Last year's tax return", "#/ai/reader?kind=f1040", false]], "three chips, each its form's landing");
  assert.equal(s.all().filter((e) => e.dataset?.part !== undefined).length, 0, "no part of the new screen on the landing");
  assert.equal(s.all().find((e) => e.tagName === "DETAILS").textContent.includes("More options"), true, "the landing's own fold, as before");
  const w2 = await page(fam(), { query: { kind: "w2" } });
  assert.match(w2.text(), /Read your W-2 Paste the text of your W-2\./);
  assert.deepEqual(chips(w2).map(([t, , on]) => [t, on]), [["W-2", true], ["1099", false], ["Last year's tax return", false]], "the form's own chip is on");
  assert.match(w2.text(), /Social Security, employer and account numbers on it are blanked; names are not\./);
  // a pay stub's landing (the retirement card's "Read it from a pay stub") stays as it was: no chips
  const stubPage = await page(fam(), { query: { kind: "paystub" } });
  assert.equal(chips(stubPage).length, 0);
  const r = await page(fam(), { query: { kind: "f1040" } });
  assert.match(r.text(), /Read last year's tax return Paste the text of last year's federal tax return\./);
  (await page(fam())).clear();
});

test("#23 the screen: parts only (no <details> by hand), one filled button, three cards then \"N more figures\", nothing the first-view check refuses", async () => {
  const { structure, handWritten, isFilled } = await import("../../../qa/first-view-lib.mjs");
  const s = await page(fam(2025));
  s.read(W2());
  assert.deepEqual(structure(s.root, { key: "ai/reader" }), []);
  assert.deepEqual(handWritten(s.root), []);
  assert.deepEqual(s.all().filter(isFilled).map(s.textOf), ["Use it"], "one filled button: the first plain change");
  assert.deepEqual(s.all().filter((e) => e.tagName === "DETAILS").map((d) => [d.dataset.part, d.hasAttribute("open")]), [["figures", false], ["how", false], ["doc", false]]);
  const cards = s.all().filter((e) => e.tagName === "LI" && e.className.includes("rd-prop"));
  assert.equal(cards.length, 5, "five cards: never fewer than three folded away");
  // the first card is the Roth 401(k) (nothing on file); the household's wages and tax taken out say Bo's W-2 adds to them
  assert.match(s.textOf(cards[0]), /^Ana's Roth 401\(k\), pay the tax now Now: nothing goes in\./);
  // no small link inside a sentence: every page a card names is an outlined button (review P3)
  assert.deepEqual(s.all().filter((e) => e.tagName === "A" && e.closest?.(".rd-prop") && !e.className.includes("btn")).map(s.textOf), []);
  assert.ok(s.all().some((e) => e.tagName === "A" && e.className === "btn secondary" && s.textOf(e) === "HSA and FSA ›"), "the HSA check's page, as a button");
  // "The figures" says what its count is
  assert.match(s.textOf(s.partOf("figures")), /^The figures 7 of 7 read/);
  assert.match(s.textOf(cards[1]), /read Bo's W-2 next and it adds to this/);
  // what agrees with the plan is one quiet line, not a card
  assert.match(s.text(), /Already on file, nothing to change: Ana's pay, about \$101,400 a year\./);
  // what was pasted is kept and shown with its identifiers blanked
  noIds(s.all().find((e) => e.tagName === "TEXTAREA").textContent + s.all().find((e) => e.tagName === "TEXTAREA").value, "the box");
  noIds(s.text(), "the screen");
  // six changes: three cards, then "3 more figures" (a 1099 for the year the Federal estimate works out)
  s.read(F1099);
  assert.deepEqual(structure(s.root, { key: "ai/reader" }), []);
  assert.deepEqual(s.all().filter((e) => e.tagName === "DETAILS").map((d) => [d.dataset.part, d.hasAttribute("open")]), [["more", false], ["figures", false], ["how", false], ["doc", false]]);
  assert.ok(s.textOf(s.partOf("more")).startsWith("3 more figures"));
  assert.deepEqual(s.all().filter(isFilled).map(s.textOf), ["Use it"]);
  s.clear();
});

test("#23 S11: after a Use it only that card changes, it says what it changed and keeps its place once the plan holds it; no part opens or shuts", async () => {
  const s = await page(fam(2025));
  s.read(W2());
  const parts = () => s.all().filter((e) => e.tagName === "DETAILS").map((d) => [d.dataset.part, d.hasAttribute("open")]);
  const cards = () => s.all().filter((e) => e.tagName === "LI" && e.className.includes("rd-prop")).map(s.textOf);
  s.partOf("how").open = true;   // a person opened "How this is worked out"
  const before = cards(), opened = parts();
  s.button("Use it").click();
  const after = cards();
  assert.equal(after.length, before.length);
  assert.match(after[0], /^Ana's Roth 401\(k\), pay the tax now Was: nothing goes in\. Now: \$1,000 a year\. Ana's Roth 401\(k\), pay the tax now: saved, \$1,000 a year\. Ana's Roth 401\(k\) at work starts at \$0: type its balance on Net worth\. Net worth › What you save for retirement ›$/);
  assert.deepEqual(after.slice(1), before.slice(1), "every other card as it was");
  assert.equal(s.ctx.plan.retirement.contributions.filter((c) => c.personId === "p-ana").length, 2, "the Roth 401(k) row was made");
  assert.deepEqual(parts().map(([id]) => id), opened.map(([id]) => id));
  // the plan holds it now: the W-2's Roth figure reads as already on file, and the card stays where it was
  assert.equal(s.all().filter((e) => e.className?.includes("notice") && e.className.includes("ok")).length, 1);
  assert.ok(s.all().some((e) => e.tagName === "A" && s.textOf(e) === "See if the money lasts ›"), "the way on after a 401(k) change");
  // the next plain change is the filled one now? the household's wages are the person's call (Bo has pay): none is filled
  assert.equal(s.all().filter((e) => e.tagName === "BUTTON" && !e.className.includes("secondary") && s.textOf(e) === "Use it").length, 0);
  s.clear();
});

test("#23 whose W-2 is asked by chips; the year, the kind and whose are changed inside \"The W-2 you pasted\", which stays open (R17)", async () => {
  const s = await page(fam());
  s.read(W2({ name: "", box1: "10,000.00", box5: "10,000.00" }));
  assert.match(s.text(), /Whose W-2 is this\? Ana Bo It does not name either of you, and its pay matches neither pay on file\. Nothing is changed until you say\./);
  assert.equal(s.all().filter((e) => s.textOf(e) === "Use it").length, 0);
  s.all().find((e) => e.tagName === "BUTTON" && e.className === "chip" && s.textOf(e) === "Bo").click();
  assert.match(s.text(), /Bo's W-2 for 2025\. It covers 2025/);
  // the year picked inside the folded paper: it stays open, and the W-2 is now for the year the Federal estimate works out
  const year = s.partOf("doc").all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Which year it is for");
  year.value = "2026"; year.dispatch("change");
  assert.equal(s.partOf("doc").hasAttribute("open"), true, "the part it was changed in stays open");
  assert.match(s.text(), /Bo's W-2 for 2026, the year the Federal estimate works out\./);
  s.clear();
});

test("#23 the AI helper: asked from \"The figures\", its error shows there and keeps the part open; it is sent the text with identifiers blanked", async () => {
  const s = await page(fam());
  s.read(F1099R.replace("2a Taxable amount $18,000.00\n", ""));
  const ask = s.button("Ask the AI to find the rest");
  assert.ok(ask, "a box was not found, so the helper is offered (outlined)");
  ask.click();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(s.calls.ai, 1);
  noIds(s.calls.msgs, "what the AI helper was sent");
  assert.equal(s.partOf("figures").hasAttribute("open"), true);
  assert.match(s.textOf(s.partOf("figures")), /The AI is not available: No AI helper is set up on this device\. Settings has the AI connection\./);
  s.clear();
});

test("#23 a paper read as another kind and then picked as a W-2: the text kept from then on has its identifiers blanked", async () => {
  const s = await page(fam());
  s.read(`${STUB}\nEmployee SSN ${SSN}`);
  assert.match(s.text(), /What it would change/);
  const kind = s.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Kind of document");
  kind.value = "w2"; kind.dispatch("change");
  const box = s.all().find((e) => e.tagName === "TEXTAREA");
  noIds(`${box.textContent} ${box.value}`, "the box once picked as a W-2");
  assert.ok(s.partOf("doc"), "the W-2's own screen");
  s.clear();
});

test("#23 a form's printed words with no figures (its blank boxes, the instructions on its back) give no figure; a filled form with its back reads as before", () => {
  // lines as the IRS's own forms print them (Form W-2 2026, Forms 1099-DIV and 1099-B, read 2026-11-14)
  const back = ["Box 6. This amount includes the 1.45% Medicare Tax withheld on all", "Medicare wages and tips shown in box 5, as well as the 0.9% Additional", "Medicare Tax on any of those Medicare wages and tips above $200,000.",
    "the “Ordinary dividends” line of Form 1040 or 1040-SR. Also report it on", "11 FATCA filing   12 Exempt-interest dividends        13 Specified private activity",
    "4 Federal income tax withheld 5 Check if noncovered", "1a Total ordinary dividends         OMB No. 1545-0110", "5 Medicare wages and tips                       6 Medicare tax withheld"];
  for (const kind of ["w2", "f1099"]) { const f = readFields(kind, back.join("\n"), TY); delete f.year; assert.deepEqual(f, {}, kind); }
  assert.deepEqual(readFields("w2", `${W2()}\n${back.join("\n")}`, TY).medicareWages, 101400, "the box, not the sentence after it");
});

// ---- #23 the two critics' findings (2026-11-14): each test would have caught its finding
test("#23 M1: a typed figure near the W-2's is offered to be replaced, one far from it to be added to; a form used on this visit reads as on file", () => {
  // one adult, an estimate of 60,000 typed: the W-2's 58,250 is within 15%, so "Replace it" comes first
  const one = caseyLike(); one.taxes = { year: 2026, thisYear: { wages: 60000 } };
  const w = rf(one, W2({ year: 2026, name: "CASEY EXAMPLE", box1: "58,250.00" })).proposals.find((x) => x.id === "wages");
  assert.deepEqual([w.before, w.after, w.adds, w.near], [60000, 118250, true, true]);
  applyProposal(one, F.replaceOf(w), ids());
  assert.equal(one.taxes.thisYear.wages, 58250, "Replace it writes the W-2's figure alone");
  // a couple: Ana's W-2 used, then Bo's, then Ana's read again on the same visit (the page's memory, `held`)
  const p = fam(2026), held = {};
  const remember = (x, print) => { const was = held[x.field], keep = !!x.adds && !!was && was.year === x.year && was.figure === x.before; held[x.field] = { year: x.year, figure: x.after, from: [...(keep ? was.from : []), print] }; };
  const read = (o) => rf(p, W2({ year: 2026, ...o }), { held });
  const useAll = (d) => { for (const x of d.proposals.filter((y) => y.op === "taxYear" && !y.same)) { remember(x, d.form.print); applyProposal(p, x, ids()); } };
  useAll(read({ name: "ANA EXAMPLE", box1: "68,000.00", box2: "5,000.00", box5: "72,000.00" }));
  const bo = read({ name: "BO EXAMPLE", box1: "48,000.00", box2: "5,000.00", box5: "50,500.00", box12: [] });
  assert.deepEqual(bo.proposals.filter((x) => x.op === "taxYear").map((x) => [x.id, x.before, x.after, !!x.adds, !!x.near, !!x.same]),
    [["wages", 68000, 116000, true, false, false], ["withheld", 5000, 10000, true, false, false]], "Bo's same $5,000 tax taken out is added, never read as Ana's");
  useAll(bo);
  assert.deepEqual([p.taxes.thisYear.wages, p.taxes.thisYear.withheld], [116000, 10000]);
  const again = read({ name: "ANA EXAMPLE", box1: "68,000.00", box2: "5,000.00", box5: "72,000.00" });
  assert.ok(again.proposals.filter((x) => x.op === "taxYear").every((x) => x.same), "Ana's W-2 again: already on file, never 184,000");
  // the figure changed elsewhere since: the memory no longer speaks for it
  p.taxes.thisYear.wages = 70000;
  assert.equal(read({ name: "ANA EXAMPLE", box1: "68,000.00", box2: "5,000.00", box5: "72,000.00" }).proposals.find((x) => x.id === "wages").adds, true);
});

test("#23 M2: an account number after 'Account:' or joined by a dash is blanked before reading and before the AI helper", () => {
  const t = ["Form 1099-DIV", `Account: ${["123", "456789"].join("-")}`, `Account ${["555", "1234"].join("")}`, `Acct ${["1234", "5678"].join("")}`, `Payer TIN ${EIN}`, `Account number: ${["1234", "5678"].join("-")}`, "1a Total ordinary dividends 5.00"].join("\n");
  const ACC = ["123-456789", "456789", "5551234", "12345678", "1234-5678"];
  const prompt = JSON.stringify(buildPrompt("f1099", t));
  for (const id of ACC) { assert.ok(!F.scrub(t).includes(id), id); assert.ok(!prompt.includes(id), `prompt: ${id}`); }
  // amounts, dates and a span of years stay
  assert.equal(F.scrub("1a Total ordinary dividends 1,250.40 on 2025-12-31 (01-15-2025), tax years 2024-2025"), "1a Total ordinary dividends 1,250.40 on 2025-12-31 (01-15-2025), tax years 2024-2025");
  assert.equal(readFields("f1099", t, TY).ordinaryDiv, 5);
});

test("#23 M3, M5: a 1099-B's 'Total cost' is its cost; a wash sale's loss not allowed (box 1g) goes back on; market discount (box 1f) is said", () => {
  assert.deepEqual(readFields("f1099", "2025 1099-B\nLong-term\nTotal proceeds 7,000.00 Total cost 3,000.00", TY), { longProceeds: 7000, longBasis: 3000, year: 2025 });
  const grid = "2025 1099-B\nLong-term\n1d Proceeds 7,000.00 1e Cost or other basis 3,000.00 1f Accrued market discount 0.00 1g Wash sale loss disallowed 500.00 Gain or loss 4,500.00";
  assert.deepEqual(readFields("f1099", grid, TY), { longProceeds: 7000, longBasis: 3000, longWash: 500, year: 2025 }, "the gain column is never box 1g's figure");
  // Form 8949 (2025 instructions, column (h) and code W): gain = 1d - 1e + 1g. 10,000 - 12,000 + 1,500 = a loss of 500
  const p = fam(2026);
  const d = rf(p, "2026 1099-B\nLong-term\n1d Proceeds 10,000.00\n1e Cost or other basis 12,000.00\n1g Wash sale loss disallowed 1,500.00");
  const sale = d.proposals.find((x) => x.id === "sale-long");
  assert.deepEqual([sale.proceeds, sale.basis, sale.cost, sale.wash], [10000, 10500, 12000, 1500]);
  applyProposal(p, sale, ids());
  const row = p.taxes.gains.at(-1);
  assert.equal(row.proceeds - row.basis, -500, "the Capital gains row's loss is the form's");
  assert.ok(!d.missing.some((l) => /box 1[fg]/.test(l)), "boxes 1f and 1g are never 'not found'");
  // market discount on a gain: an amber line, so never the filled button; on a loss nothing to say
  const disc = rf(fam(2026), "2026 1099-B\nShort-term\n1d Proceeds 9,000.00\n1e Cost or other basis 8,000.00\n1f Accrued market discount 300.00").proposals.find((x) => x.id === "sale-short");
  assert.deepEqual([disc.caution, disc.discount, disc.basis], ["discount", 300, 8000]);
  assert.equal(rf(fam(2026), "2026 1099-B\nShort-term\n1d Proceeds 7,000.00\n1e Cost or other basis 8,000.00\n1f Accrued market discount 300.00").proposals.find((x) => x.id === "sale-short").caution, undefined);
});

test("#23 M4: a statement with two payers' 1099-Rs adds both, equal tax taken out included; a copy of one form is counted once", () => {
  const two = "2025 Consolidated 1099\n1099-R\n1 Gross distribution 10,000.00\n2a Taxable amount 10,000.00\n4 Federal income tax withheld 1,000.00\n1099-R (second payer)\n1 Gross distribution 12,000.00\n2a Taxable amount 12,000.00\n4 Federal income tax withheld 1,000.00";
  assert.deepEqual(readFields("f1099", two, TY), { iraGross: 22000, iraTaxable: 22000, withheld: 2000, year: 2025 });
  // Copy B and Copy 2 of one 1099-R, the second with fewer of its boxes: once
  const copies = "Form 1099-R 2025 Copy B\n1 Gross distribution $ 20,000.00 2a Taxable amount $ 20,000.00\n4 Federal income tax withheld $ 2,000.00\nForm 1099-R 2025 Copy 2\n1 Gross distribution $ 20,000.00\n4 Federal income tax withheld $ 2,000.00";
  assert.deepEqual(readFields("f1099", copies, TY), { iraGross: 20000, iraTaxable: 20000, withheld: 2000, year: 2025 });
  // a bank's 1099-INT and a fund's 1099-DIV with the same tax taken out: both
  assert.equal(readFields("f1099", "Form 1099-INT 2025\n1 Interest income 400.00\n4 Federal income tax withheld 40.00\nForm 1099-DIV 2025\n1a Total ordinary dividends 500.00\n4 Federal income tax withheld 40.00", TY).withheld, 80);
  // a statement's summary before its forms agrees with them: counted once
  assert.deepEqual(readFields("f1099", "2025 Tax Reporting Statement\nSummary\nTotal ordinary dividends 1,000.00\nInterest income 500.00\nForm 1099-DIV\n1a Total ordinary dividends 1,000.00\n1b Qualified dividends 800.00\nForm 1099-INT\n1 Interest income 500.00", TY),
    { interest: 500, ordinaryDiv: 1000, qualifiedDiv: 800, year: 2025 });
  const p = fam(2025);
  assert.deepEqual(rf(p, two).proposals.filter((x) => x.op === "taxYear").map((x) => [x.field, x.amount]), [["iraWithdrawals", 22000], ["withheld", 2000]]);
});

test("#23 M6, M7: a plan damaged by hand never makes a form fail; a figure of $100,000,000 or more is said and never used", () => {
  const texts = { w2: W2({ year: 2026 }), f1099: F1099.replace(/2025/g, "2026"), f1040: F1040 };
  const bad = [{}, { taxes: null }, { taxes: { year: 2026, thisYear: "x", gains: "y", priorYear: "z" } }, { household: null, income: null }, { household: { people: [null] } },
    { household: { people: [{ id: "a", name: "Ana" }] }, income: [null], taxes: { year: 2026, gains: [null] }, retirement: { contributions: [null] }, accounts: [null] }];
  for (const [i, plan] of bad.entries()) for (const [kind, text] of Object.entries(texts)) {
    const d = compute(plan, { text, kind, today: TY });
    // the tax pages' changes write into it too (a 401(k) row is the pay stub's own way, as before)
    for (const x of d.proposals.filter((y) => y.op !== "work")) { const q = structuredClone(plan); applyProposal(q, x, ids()); if (x.op === "gain") assert.ok(Array.isArray(q.taxes.gains), `${i} ${kind}`); }
  }
  const d = rf(fam(2025), W2({ box1: "9,999,999,999.99" }));
  assert.equal(d.fields.wages, HUGE, "read, and shown under The figures");
  assert.deepEqual(d.form.checks.find((c) => c.id === "big"), { id: "big", kind: "big", label: "Pay that is taxed (box 1)", amount: HUGE, more: 0 });
  assert.equal(d.proposals.find((x) => x.id === "wages"), undefined, "never a change");
  assert.ok(d.proposals.some((x) => x.id === "withheld"), "the other boxes are used as before");
});

test("#23 P2: a W-2 whose name is not the household's one adult is asked about, never taken as theirs", () => {
  const d = rf(caseyLike(), W2({ name: "ANA EXAMPLE" }));
  assert.deepEqual([d.form.personId, d.form.doubt, d.form.ask, d.proposals.length, d.form.checks.length], [null, true, [{ id: "p1", name: "Casey" }], 0, 0]);
  assert.equal(rf(caseyLike(), W2({ name: "ANA EXAMPLE" }), { personId: "p1" }).form.who, "asked", "the person says it is Casey's: used");
  // a couple: the W-2's pay is Bo's, but the name on it is someone else's
  const c = rf(fam(), W2({ name: "CHRIS OTHER", box1: "60,000.00", box5: "62,400.00" }));
  assert.deepEqual([c.form.personId, c.form.doubt], [null, true]);
  assert.deepEqual(F.nameOnForm("e Employee's first name and initial Last name\nANA EXAMPLE\n1 Wages, tips, other compensation 10.00"), ["ana", "example"]);
  assert.deepEqual(F.nameOnForm("e Employee's name ANA EXAMPLE"), ["ana", "example"]);
  assert.equal(F.nameOnForm(W2_SITE), null, "no name box: nothing to compare");
});

test("#23 M1 and P2 on the screen: Replace it and Add it, both outlined; the asked W-2's sentence and the way to People", async () => {
  const { isFilled } = await import("../../../qa/first-view-lib.mjs");
  const one = caseyLike(); one.taxes = { year: 2026, thisYear: { wages: 60000 } };
  const s = await page(one);
  s.read(W2({ year: 2026, name: "CASEY EXAMPLE", box1: "58,250.00", box12: [] }));
  const card = s.all().find((e) => e.tagName === "LI" && s.textOf(e).startsWith("Wages for 2026"));
  assert.match(s.textOf(card), /Now: \$60,000 typed\. This W-2 shows \$58,250\. If the \$60,000 was a guess at this same money, replace it; if it is other money, add this to it\. Replace it: \$58,250 Add it: \$118,250$/);
  assert.deepEqual(s.all().filter(isFilled).map(s.textOf).filter((t) => /Replace|Add it/.test(t)), [], "neither is the filled button");
  s.button("Replace it: $58,250").click();
  assert.equal(s.ctx.plan.taxes.thisYear.wages, 58250);
  assert.match(s.text(), /Was: \$60,000 typed\. Now: \$58,250\. Saved: \$58,250 of wages for 2026\./);
  // the same W-2 again on this visit: already on file, no card
  s.read(W2({ year: 2026, name: "CASEY EXAMPLE", box1: "58,250.00", box12: [] }));
  assert.match(s.text(), /Already on file, nothing to change: [^.]*wages for 2026 on the Federal estimate, \$58,250/);
  s.clear();
  // a W-2 naming someone else: asked, with the sentence and People as a button
  const q = await page(caseyLike());
  q.read(W2({ name: "ANA EXAMPLE" }));
  assert.match(q.text(), /Whose W-2 is this\? Casey The name on it is not Casey's\. If it is someone else's W-2, add them on People first; nothing is changed until you say\. People ›/);
  assert.equal(q.all().filter((e) => s.textOf(e) === "Use it").length, 0);
  q.clear();
});
