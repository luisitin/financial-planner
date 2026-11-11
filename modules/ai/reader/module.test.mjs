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
