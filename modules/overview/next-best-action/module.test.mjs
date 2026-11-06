import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, FICA, HIGH_RATE, monthLines } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const step = (d, id) => d.steps.find((s) => s.id === id);
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("no income or expenses: says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.missing.length, 2);
});

test("the spare money: pay less federal and payroll tax, spending, retirement and goal saving", () => {
  const d = compute(familyPlan(), { today: TODAY });
  near(d.spare.gross, (3900 * 26 + 5200 * 12 + 600 * 12) / 12, 0.01);
  const payroll = (3900 * 26) * (FICA.ss + FICA.medicare) + (5200 * 12) * (FICA.ss + FICA.medicare) + 600 * 12 * FICA.seBase * FICA.selfEmployed;
  near(d.spare.payrollTax, payroll / 12, 0.01);
  near(d.spare.retirementSaving, (470 * 26 + 300 * 12) / 12, 0.01);   // the employer's match is not from pay
  near(d.spare.goalSaving, 400 + 300 + 250, 0.01);
  near(d.spare.monthly, d.spare.gross - d.spare.federalTax - d.spare.payrollTax - d.spare.spending - d.spare.retirementSaving - d.spare.goalSaving, 0.01);
  assert.ok(d.spare.monthly > 3000 && d.spare.monthly < 5000, String(d.spare.monthly));
});

test("the order for the family, the next step, and the dates the spare money reaches", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.deepEqual(d.steps.map((s) => s.id), ["bills", "starter", "protect", "match", "high-debt", "full-fund", "ira", "mid-debt", "max-401k", "goals", "rest"]);
  assert.equal(d.next.id, "starter");
  // Ana's death would leave Bo and Cy short (Life insurance needs' own answer); Bo's would not: the plan holds
  const pr = step(d, "protect");
  // 2026-11-02, the health line (Bo alone pays marketplace cover 2050-2052 and Medicare from 2053): 235,000 -> 287,000;
  // seventh pass, 2026-11-06: Bo's Medicare now holds a supplement, the national Medigap Plan G average of $194 a month, so the need moved 287,000 -> 312,000
  assert.deepEqual(pr.people.map((x) => [x.name, x.gap, x.cover, x.until, x.depends]), [["Ana", 312000, 0, 2042, ["Bo", "Cy"]]]);
  assert.match(pr.detail, /^If Ana died this year, Bo and Cy would be about \$312,000 short\. Term life cover on Ana until about 2042 \(Cy turns 22\) closes it\./);
  assert.equal(pr.gap, null, "an action, not a sum the spare money fills");
  assert.equal(step(d, "bills").status, "done");
  assert.equal(step(d, "match").status, "check", "Bo has a 401(k) and pay but no contribution");
  near(step(d, "high-debt").gap, 6400); assert.ok(step(d, "high-debt").detail.includes("23.9%"));
  assert.ok(step(d, "mid-debt").detail.includes("Car loan"), "5.9% is middling"); assert.equal(step(d, "mid-debt").detail.includes("Mortgage"), false);
  // the gaps fill in order: starter, then the card, then the full fund
  assert.ok(step(d, "starter").doneDate <= step(d, "high-debt").doneDate && step(d, "high-debt").doneDate <= step(d, "full-fund").doneDate);
  near(step(d, "ira").roomYearly, 7500 + (7500 - 3600));
  near(step(d, "max-401k").roomYearly, 24500 - 470 * 26, 1);   // the match does not use the employee's limit
  assert.ok(step(d, "ira").startDate >= step(d, "full-fund").doneDate.slice(0, 7) || step(d, "ira").startDate <= step(d, "full-fund").doneDate);
});

test("spending more than comes in makes the bills the next step and stops the dates", () => {
  const p = familyPlan(); p.expenses.push({ id: "big", name: "Boat", category: "fun", amount: 9000, period: "monthly", essential: false });
  const d = compute(p, { today: TODAY });
  assert.ok(d.spare.monthly < 0); assert.equal(d.next.id, "bills");
  assert.ok(d.steps.every((s) => !s.doneDate && !s.startDate));
});

test("no expensive debt, no HSA, no 401(k): those steps are done or left out", () => {
  const p = familyPlan();
  p.debts = p.debts.filter((x) => x.accountId !== "a-visa"); p.accounts = p.accounts.filter((a) => a.id !== "a-visa" && a.type !== "401k");
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.accountId !== "a-401");
  const d = compute(p, { today: TODAY });
  assert.equal(step(d, "high-debt").status, "done");
  assert.equal(step(d, "match"), undefined); assert.equal(step(d, "max-401k"), undefined); assert.equal(step(d, "hsa"), undefined);
  assert.ok(HIGH_RATE === 0.10);
});

test("an HSA account but no high-deductible plan this year: no HSA step (IRC 223(c)(1))", () => {
  const p = familyPlan();
  if (!p.accounts.some((a) => a.type === "hsa")) p.accounts.push({ id: "a-hsa-test", name: "HSA", type: "hsa", balance: 1000, ownerId: p.household.people[0].id });
  assert.ok(step(compute(p, { today: TODAY }), "hsa"), "with self-only cover the step is there");
  p.taxes.hsa = { ...p.taxes.hsa, coverage: "none" };
  assert.equal(step(compute(p, { today: TODAY }), "hsa"), undefined);
});

test("the match step: a 401(k) from a job left moves the question to the job now; no match leaves nothing to check; the step names who to ask", () => {
  const p = familyPlan("2026-11-02");
  const d0 = compute(p, { today: "2026-11-02" });
  const m0 = step(d0, "match");
  assert.equal(m0.status, "check", "Bo has a 401(k) and pay, nothing going in");
  assert.deepEqual(m0.ask.map((a) => a.personId), ["p-bo"]);
  assert.ok(m0.ask[0].accounts.length >= 1);
  // the 401(k) is from a job Bo left
  const p1 = familyPlan("2026-11-02");
  for (const a of p1.accounts) if (m0.ask[0].accounts.includes(a.id)) a.formerJob = true;
  const m1 = step(compute(p1, { today: "2026-11-02" }), "match");
  assert.equal(m1.status, "check", "Bo is still paid: the question moves to the job Bo has now");
  assert.deepEqual(m1.ask, [{ personId: "p-bo", name: "Bo", accounts: [], newJob: true, old: m0.ask[0].accounts }], "no question about putting money into the old job's 401(k)");
  p1.retirement.workPlans = { "p-bo": { match: false } };
  const m1b = step(compute(p1, { today: "2026-11-02" }), "match");
  assert.ok(!m1b || m1b.status === "done", "and nothing once Bo said the job now has no plan or no match");
  // Bo's job has no match
  const p2 = familyPlan("2026-11-02");
  p2.retirement.workPlans = { "p-bo": { match: false } };
  const m2 = step(compute(p2, { today: "2026-11-02" }), "match");
  assert.ok(!m2 || m2.status === "done", "nothing to check once Bo said there is no match");
  assert.equal(m2?.ask?.length ?? 0, 0);
});

test("review: a gap under half a dollar is done; Open enrollment's match tiers answer the match question too", () => {
  const p = familyPlan("2026-11-02");
  const T = "2026-11-02";
  const gap = step(compute(p, { today: T }), "starter").gap;
  p.accounts.find((a) => a.id === "a-chk").balance += Math.round(gap);   // the amount the page shows, in whole dollars
  const st = step(compute(p, { today: T }), "starter");
  assert.equal(st.status, "done"); assert.equal(st.gap, 0);
  const q = familyPlan(T);
  q.accounts.find((a) => a.id === "a-chk").balance += 1000;
  q.whatIfs = { ...(q.whatIfs ?? {}), benefits: { "p-bo": { matchTiers: [] } } };
  assert.ok(!step(compute(q, { today: T }), "match") || step(compute(q, { today: T }), "match").status === "done", "no match typed on Open enrollment");
  q.whatIfs.benefits["p-bo"].matchTiers = [{ rate: 0.5, upTo: 0.06 }];
  q.retirement.workPlans = { "p-bo": { match: false } };
  assert.equal(step(compute(q, { today: T }), "match").status, "check", "a match typed there wins over an older no");
});

test("protection: done once the cover on file reaches the need; no step for a household nobody depends on", () => {
  const p = familyPlan();
  // 2026-11-02, the health line moved the need 235,000 -> 287,000: the cover that reaches it 250,000 -> 300,000, the gap left by 100,000 135,000 -> 187,000
  // (seventh pass, 2026-11-06: the Medigap Plan G default in Bo's Medicare moved it 287,000 -> 312,000: the cover 300,000 -> 350,000, the gap 187,000 -> 212,000)
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 350000, premium: 25, period: "monthly", throughWork: false }] };
  assert.equal(compute(p, { today: TODAY }).steps.find((s) => s.id === "protect"), undefined, "Ana's $350,000 covers the $312,000");
  p.insurance.policies[0].benefit = 100000;
  const pr = compute(p, { today: TODAY }).steps.find((s) => s.id === "protect");
  assert.equal(pr.people[0].gap, 212000); assert.match(pr.detail, /even with the \$100,000 of cover on file\. More cover on Ana/);
  const single = familyPlan();
  single.household.people = single.household.people.filter((x) => x.id === "p-ana");
  single.income = single.income.filter((x) => x.personId === "p-ana");
  assert.equal(compute(single, { today: TODAY }).steps.find((s) => s.id === "protect"), undefined, "one adult, no children: nobody to protect");
});

test("saving: when the plan already lasts, the IRA and 401(k) steps say they are optional; the backdoor only near the Roth limit", () => {
  const d = compute(familyPlan("2026-11-02"), { today: "2026-11-02" });
  for (const id of ["ira", "max-401k"]) { const s = d.steps.find((x) => x.id === id); assert.equal(s.optional, true, id); assert.match(s.why, /^Optional: your plan already lasts/); }
  assert.doesNotMatch(d.steps.find((x) => x.id === "ira").detail, /backdoor/, "$163,800 of pay is well under the Roth limit");
  const rich = familyPlan("2026-11-02");
  rich.income.find((x) => x.personId === "p-ana" && x.type === "salary").amount = 12000;   // every two weeks: $312,000 a year
  assert.match(compute(rich, { today: "2026-11-02" }).steps.find((x) => x.id === "ira").detail, /backdoor route/);
});

test("a saved debt plan: its extra is spoken for, the debt step is under way with Pay off debts' own date, and nothing asks for it twice", async () => {
  const { compute: payoff } = await import("../../debt/payoff/compute.js");
  const { compute: alerts } = await import("../alerts/compute.js");
  const { compute: health } = await import("../health-score/compute.js");
  const base = familyPlan(), before = compute(base, { today: TODAY });
  assert.equal(before.spare.debtExtra, 0); assert.equal(before.debtPlan, null);
  const p = familyPlan(); p.debtPlan = { extra: 410, order: "avalanche", targets: ["a-visa"] };
  const d = compute(p, { today: TODAY });
  // the extra is not spare money: Each month's money takes it off, like saving
  assert.equal(d.spare.debtExtra, 410);
  near(d.spare.monthly, before.spare.monthly - 410, 0.01);
  near(d.spare.monthly, d.spare.gross - d.spare.federalTax - d.spare.payrollTax - d.spare.spending - d.spare.retirementSaving - d.spare.goalSaving - d.spare.debtExtra, 0.01);
  // the step is under way, with the month Pay off debts gives for the card, and the spare money is not sent to it again
  const end = payoff(p, { today: TODAY }).chosen.debts.find((x) => x.id === "a-visa").endDate;
  const hd = step(d, "high-debt");
  assert.equal(hd.status, "underway"); assert.equal(hd.gap, 0); assert.equal(hd.doneDate, null);
  assert.deepEqual(hd.underway, { extra: 410, names: ["Visa card"], until: end });
  assert.match(hd.detail, /^Under way\. \$410 a month extra already goes to Visa card \(Pay off debts\), on top of the required payments: it is gone by about \w+ \d{4}\.$/);
  assert.deepEqual(d.debtPlan, { extra: 410, ids: ["a-visa"], names: ["Visa card"], until: end, months: payoff(p, { today: TODAY }).chosen.debts.find((x) => x.id === "a-visa").months });
  assert.notEqual(d.next.id, "high-debt");
  // the car loan is not in the plan's aim, so middling debt stays to do, saying nothing about the extra
  assert.equal(step(d, "mid-debt").status, "later"); assert.doesNotMatch(step(d, "mid-debt").detail, /already goes/);
  // Needs attention drops "Visa card is expensive debt" while it is in hand; the health score's saving counts the extra as saving
  assert.ok(alerts(base, { today: TODAY }).alerts.some((a) => a.id === "debt-expensive-a-visa"));
  assert.ok(!alerts(p, { today: TODAY }).alerts.some((a) => a.id === "debt-expensive-a-visa"));
  const sav = (x) => health(x, { today: TODAY }).parts.find((y) => y.id === "saving").points;
  near(sav(p), sav(base), 0.01);
  // aimed at no debt in particular, the extra rolls on: the car loan's step is under way too, until the last debt is gone
  const q = familyPlan(); q.debtPlan = { extra: 410, order: "avalanche" };
  const dq = compute(q, { today: TODAY });
  assert.equal(step(dq, "high-debt").status, "underway"); assert.equal(step(dq, "mid-debt").status, "underway");
  assert.match(step(dq, "mid-debt").detail, /Car loan/);
  // the cards it was aimed at are paid off (none left in the plan): the extra has stopped and the step reads as before
  const r = familyPlan(); r.debtPlan = { extra: 410, order: "avalanche", targets: ["a-gone"] };
  const dr = compute(r, { today: TODAY });
  assert.equal(dr.spare.debtExtra, 0); near(dr.spare.monthly, before.spare.monthly, 0.01);
  assert.equal(step(dr, "high-debt").status, step(before, "high-debt").status);
});

test("a saved extra larger than the money left: the bills step says it counts, and that lowering it is a way out", () => {
  const p = familyPlan(); p.debtPlan = { extra: 9000, order: "avalanche", targets: ["a-visa"] };
  const d = compute(p, { today: TODAY });
  assert.ok(d.spare.monthly < 0); assert.equal(d.next.id, "bills");
  assert.match(step(d, "bills").detail, /counting the \$9,000 a month extra on debts \(Pay off debts\)\. Trim spending, lower that extra or pause a goal first\./);
});

test("one tax for the month: the state's income tax comes off, and Budget (50/30/20) and the Cash-flow statement leave the same money", async () => {
  const { compute: budget, yearTaxes } = await import("../../cashflow/budget-percent/compute.js");
  const { compute: statement } = await import("../../cashflow/statement/compute.js");
  for (const state of ["TX", "PA"]) {
    const p = familyPlan(); p.household.state = state;
    const d = compute(p, { today: TODAY }), T = yearTaxes(p, { today: TODAY });
    near(d.spare.federalTax, T.federal / 12, 0.01); near(d.spare.payrollTax, T.payroll / 12, 0.01); near(d.spare.stateTax, T.state / 12, 0.01);
    assert.equal(d.spare.stateKnown, true);
    near(d.spare.monthly, d.spare.gross - d.spare.businessCosts - d.spare.federalTax - d.spare.payrollTax - d.spare.stateTax - d.spare.spending - d.spare.retirementSaving - d.spare.goalSaving - d.spare.debtExtra, 0.01);
    near(budget(p, { today: TODAY }).saving.leftover, d.spare.monthly, 0.5);
    const y = statement(p, { today: TODAY }).year;
    near((y.net - y.goals) / 12, d.spare.monthly, 0.5);
    if (state === "TX") assert.equal(d.spare.stateTax, 0, "no state income tax in Texas");
    else assert.ok(d.spare.stateTax > 300, `Pennsylvania's flat 3.07% on about $171,000: ${d.spare.stateTax}`);
  }
  // a graduated state with no rate typed: nothing taken off, and stateKnown says so (the page asks for the rate)
  const ca = familyPlan(); ca.household.state = "CA";
  const dc = compute(ca, { today: TODAY });
  assert.equal(dc.spare.stateTax, 0); assert.equal(dc.spare.stateKnown, false);
});

test("costly debt is paid from savings above the full cushion, today; only the rest waits for the spare money (round 4)", async () => {
  const { compute: liquidity } = await import("../../balance/liquidity/compute.js");
  const { standing } = await import("../setup/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T); p.accounts.find((a) => a.id === "a-sav").balance = 60000;
  const lq = liquidity(p, { today: T });
  const hd = step(compute(p, { today: T }), "high-debt");
  assert.ok(lq.nowAfterOneOffs - lq.target >= 6400, "the cash above six months covers the Visa");
  assert.equal(hd.fromSavings, 6400); assert.equal(hd.gap, 0); assert.equal(hd.doneDate, T);
  assert.equal(hd.title, "Pay off expensive debt from savings");
  assert.match(hd.detail, /^Pay the Visa card's \$6,400 from savings now: you would still have [\d.]+ months of must-pay bills in cash \(the plan aims for 6\)\. Paying it is a sure 23\.9% return\./);
  // part of it: what is above the cushion now, the rest from the monthly left-over
  p.accounts.find((a) => a.id === "a-sav").balance = 48000;
  const l2 = liquidity(p, { today: T }), h2 = step(compute(p, { today: T }), "high-debt");
  near(h2.fromSavings, Math.floor((l2.nowAfterOneOffs - l2.target) / 10) * 10); near(h2.gap, 6400 - h2.fromSavings);
  assert.match(h2.detail, /^Pay \$[\d,]+ of the \$6,400 \(Visa card at 23\.9%\) from savings now: .* The other \$[\d,]+ comes from what is left each month\./);
  // under a full cushion: nothing from savings, as before
  p.accounts.find((a) => a.id === "a-sav").balance = 11500;
  assert.equal(step(compute(p, { today: T }), "high-debt").fromSavings, 0);
  // the Dashboard's move says it, once life cover is in
  const q = familyPlan(T); q.accounts.find((a) => a.id === "a-sav").balance = 60000;
  q.insurance = { ...(q.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 400000, premium: 25, period: "monthly", throughWork: false }] };
  const mv = standing(q, { today: T }).moves.find((m) => m.id === "high-debt");
  assert.equal(mv?.title, "Pay off the cards from your savings");
});

test("one cushion verdict: the starter month in cash and costly debt paid first reads 'enough for now' everywhere (round 4)", async () => {
  const { cushionLater } = await import("./compute.js");
  const { compute: liquidity } = await import("../../balance/liquidity/compute.js");
  const { compute: alerts } = await import("../alerts/compute.js");
  const { standing } = await import("../setup/compute.js");
  const T = "2026-11-02";
  // under one month: the starter is still the next step, and the cushion is thin (red) as before
  const thin = familyPlan(T);
  assert.equal(cushionLater(compute(thin, { today: T })), null);
  assert.ok(alerts(thin, { today: T }).alerts.some((a) => a.id === "emergency-bad"));
  assert.equal(standing(thin, { today: T }).cushionLater, null);
  // about three months in cash: the starter is done, the Visa comes before the full six months
  const p = familyPlan(T); p.accounts.find((a) => a.id === "a-sav").balance = 30000;
  const d = compute(p, { today: T }), lq = liquidity(p, { today: T });
  assert.equal(step(d, "starter").status, "done"); assert.equal(lq.status, "bad");
  const later = cushionLater(d);
  assert.deepEqual(later, { until: step(d, "high-debt").doneDate });
  const al = alerts(p, { today: T }).alerts;
  assert.ok(!al.some((a) => a.id === "emergency-bad" || a.id === "emergency-warn"), "no red 'thin' beside the plan's own order");
  const it = al.find((a) => a.id === "emergency-later");
  assert.equal(it.level, "info"); assert.equal(it.title, "Emergency fund: enough for now");
  assert.match(it.detail, /^Usable cash covers 3 months of must-pay bills: enough for now\. Costly debt comes first; once it is paid off \(about \w+ \d{4}\), the plan builds this to 6 months\.$/);
  assert.deepEqual(standing(p, { today: T }).cushionLater, later);
  // a saved debt plan on the card: the date is Pay off debts' own
  const q = familyPlan(T); q.accounts.find((a) => a.id === "a-sav").balance = 30000; q.debtPlan = { extra: 410, order: "avalanche", targets: ["a-visa"] };
  const dq = compute(q, { today: T });
  assert.equal(step(dq, "high-debt").status, "underway");
  assert.deepEqual(cushionLater(dq), { until: dq.debtPlan.until });
  // no costly debt: the full cushion is the next thing, so the usual verdict stands
  const r = familyPlan(T); r.accounts.find((a) => a.id === "a-sav").balance = 30000; r.debts = r.debts.filter((x) => x.accountId !== "a-visa"); r.accounts = r.accounts.filter((a) => a.id !== "a-visa");
  assert.equal(cushionLater(compute(r, { today: T })), null);
});

test("paying from savings, review 2026-11-02: one-off income is not cash yet, the whole balance exactly, a saved plan does not hide it, no cushion no offer", async () => {
  const { compute: liquidity } = await import("../../balance/liquidity/compute.js");
  const T = "2026-11-02";
  const visaAcct = (p) => p.accounts.find((a) => a.id === "a-visa");
  // one-time income coming (a car to sell) does not count as cash on hand: the cushion stays full
  const a = familyPlan(T); a.goals = a.goals.filter((g) => g.id !== "g-ef");
  const la = liquidity(a, { today: T });
  a.accounts.find((x) => x.id === "a-sav").balance += la.target - la.now;   // exactly the full cushion
  a.income.push({ id: "i-car", name: "Selling the old car", type: "other", amount: 8000, period: "once" });
  const ha = step(compute(a, { today: T }), "high-debt");
  assert.equal(ha.fromSavings, 0, "nothing above the cushion until the car money is in the bank");
  // savings cover the card: the exact balance, no $10 left at 23.9%
  const b = familyPlan(T); b.accounts.find((x) => x.id === "a-sav").balance = 60000; visaAcct(b).balance = 6409;
  const hb = step(compute(b, { today: T }), "high-debt");
  assert.equal(hb.fromSavings, 6409); assert.equal(hb.gap, 0); assert.equal(hb.doneDate, T);
  assert.match(hb.detail, /^Pay the Visa card's \$6,409 from savings now/); assert.doesNotMatch(hb.detail, /The other \$/);
  // a saved debt plan aimed at the card, with the cash there: pay it from savings, not 15 more months at 23.9%
  const c = familyPlan(T); c.accounts.find((x) => x.id === "a-sav").balance = 90000; c.debtPlan = { extra: 100, order: "avalanche", targets: ["a-visa"] };
  const hc = step(compute(c, { today: T }), "high-debt");
  assert.notEqual(hc.status, "underway"); assert.equal(hc.fromSavings, 6400); assert.equal(hc.doneDate, T);
  assert.match(hc.detail, /^Pay the Visa card's \$6,400 from savings now/); assert.doesNotMatch(hc.detail, /already goes/);
  // no must-pay bills marked: the cushion is unknown, so no "you would still have a full cushion"
  const d = familyPlan(T); d.accounts.find((x) => x.id === "a-sav").balance = 60000; d.expenses.forEach((e) => { e.essential = false; }); d.debts.forEach((x) => { x.minPayment = null; });
  const dd = compute(d, { today: T });
  assert.ok(dd.ready); const hd = step(dd, "high-debt"); assert.equal(hd.fromSavings ?? 0, 0); assert.doesNotMatch(hd.detail, /full cushion/);
});

// a freelancer of one: design work $78,000 a year, no paycheck, $16,900 in cash, a $1,800 card (invented)
const freelancer = (paid) => {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-rae", name: "Rae", role: "self", birthDate: "1986-06-15", retirementAge: 65 }], filingStatus: "single", state: "CO" };
  p.accounts = [{ id: "a-chk", name: "Business checking", type: "checking", balance: 7400, asOf: "2026-11-02", history: [] }, { id: "a-sav", name: "Savings", type: "savings", balance: 9500, asOf: "2026-11-02", history: [] }, { id: "a-card", name: "Card", type: "credit", balance: 1800, asOf: "2026-11-02", history: [] }];
  p.debts = [{ id: "d-card", accountId: "a-card", rate: 0.229, minPayment: 60, extra: 0 }];
  p.income = [{ id: "i-fl", name: "Freelance design", type: "business", personId: "p-rae", amount: 6500, period: "monthly", growth: 0, taxable: true }];
  p.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1900, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "groceries", amount: 600, period: "monthly", essential: true }, { id: "e-fun", name: "Fun", category: "fun", amount: 700, period: "monthly", essential: false }];
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid }, priorYear: { tax: 11200, agi: 70000 } };   // last year's tax sets the safe amount: $2,800 a quarter
  return p;
};

test("a freelancer: this year's tax is kept apart before the cushion, and a past-due estimated payment comes first", () => {
  const today = "2026-11-02";
  const d = compute(freelancer([2800, 2800, 2800, 0]), { today });
  const tax = d.steps.find((s) => s.id === "tax");
  assert.equal(tax.status, "done"); assert.equal(tax.title, "This year's tax, kept apart");
  assert.match(tax.detail, /of your cash is federal tax on what you have earned this year/);
  assert.match(tax.detail, /the next payment is \$2,800 by January 15, 2027/);
  assert.ok(d.steps.findIndex((s) => s.id === "tax") < d.steps.findIndex((s) => s.id === "starter"));
  const starter = d.steps.find((s) => s.id === "starter");
  assert.doesNotMatch(starter.detail, /16,900/, "the cushion is the cash less the tax");
  // nothing paid since April: paying it is the next move, from the cash kept apart
  // nothing typed on Estimated payments yet: it asks first, with what is due if none were made (review 2026-11-02)
  const asked = compute(freelancer([0, 0, 0, 0]), { today });
  assert.equal(asked.next.id, "tax"); assert.equal(asked.next.title, "Type or pay this year's estimated tax");
  assert.match(asked.next.detail, /^No estimated payments are typed for 2026 yet\. If none were made, .* was due by now \(the first part on April 15, 2026\)/);
  const typedZero = freelancer([0, 0, 0, 0]); typedZero.taxes.estimated.typedAt = "2026-10-01";
  const u = compute(typedZero, { today });
  assert.equal(u.next.id, "tax"); assert.equal(u.next.title, "Pay the estimated tax that is past due");
  assert.match(u.next.detail, /past due \(the first part since April 15, 2026\)/);
  assert.match(u.next.detail, /from the cash kept apart for tax/);
  assert.equal(u.next.gap, 0); assert.equal(u.next.doneDate, today);
  // the family (paychecks withhold most of it) gets no tax step
  assert.equal(compute(familyPlan(today), { today }).steps.some((s) => s.id === "tax"), false);
});

test("a freelancer: a retirement plan through the business (Small business's best), after the IRA; none once a 401(k) gets money", async () => {
  const { compute: business } = await import("../../career/business/compute.js");
  const today = "2026-11-02";
  const plan = freelancer([2800, 2800, 2800, 0]);
  const d = compute(plan, { today });
  const b = business(plan, { today });
  const best = b.plans.find((x) => x.key === b.best);
  const st = d.steps.find((s) => s.id === "business-plan");
  assert.ok(st, "the step is there");
  assert.equal(st.roomYearly, best.room);
assert.ok(st.detail.startsWith(`${best.label}: up to $`), st.detail);
  assert.ok(d.steps.findIndex((s) => s.id === "business-plan") > d.steps.findIndex((s) => s.id === "ira"));
  // the family's weekend photography allows less than an IRA ($6,690 against $7,500): no such step, the IRA step is the answer
  assert.equal(compute(familyPlan(today), { today }).steps.some((s) => s.id === "business-plan"), false);
});

test("costly debt first in line: the same date as Pay off debts' offer for the same money (required payments and interest included)", async () => {
  const { offer } = await import("../../debt/payoff/compute.js");
  const today = "2026-11-02";
  // a renter (invented): two cards, a month of bills in cash, about $350 a month spare
  const p = emptyPlan();
  p.household = { people: [{ id: "me", name: "Riley", role: "self", birthDate: "1996-05-01", retirementAge: 67 }], filingStatus: "single", state: "" };
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 3200 }, { id: "store", name: "Store card", type: "credit", balance: 900 }, { id: "visa", name: "Visa", type: "credit", balance: 6400 }];
  p.debts = [{ id: "d1", accountId: "store", rate: 0.269, minPayment: 40, extra: 0 }, { id: "d2", accountId: "visa", rate: 0.239, minPayment: 160, extra: 0 }];
  p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "me", amount: 4200, period: "monthly", taxable: true }];
  p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true }, { id: "food", name: "Food", category: "groceries", amount: 500, period: "monthly", essential: true }, { id: "fun", name: "Fun", category: "fun", amount: 600, period: "monthly", essential: false }];
  const d = compute(p, { today });
  const hd = d.steps.find((s) => s.id === "high-debt");
  assert.equal(d.next.id, "high-debt", "the cushion's first month is there, so the cards come first");
  const o = offer(p, { today, amount: d.spare.monthly, stepId: "high-debt" });
  assert.ok(o?.soon);
  assert.equal(hd.doneDate.slice(0, 7), o.soon.slice(0, 7));
  // paying from the spare money alone (the old reckoning) would have read later
  const naive = Math.ceil(hd.gap / d.spare.monthly);
  const offerMonths = Math.round((Date.parse(`${o.soon.slice(0, 7)}-15`) - Date.parse("2026-11-15")) / (30.44 * 864e5));
  assert.ok(offerMonths < naive);
});

test("short on the careful month (review 2026-11-02): the bills step says it counts uneven pay at what you can count on, and what a full month leaves", async () => {
  const { money } = await import("../../../core/format.js");
  const m = (n) => money(Math.round(n / 10) * 10, "USD");
  const plan = (fn) => { const p = familyPlan(); if (fn) fn(p); return p; };
  const base = compute(familyPlan(), { today: TODAY }).spare.monthly;
  // a plan whose month leaves `leftInFull` when the side income brings its whole amount, counting on none of it
  const at = (leftInFull, fn) => { const p = plan(fn); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: compute(plan(fn), { today: TODAY }).spare.monthly - leftInFull, period: "monthly", essential: false }); p.income.find((x) => x.id === "i-side").countOn = 0; return compute(p, { today: TODAY }); };
  // a month that brings the Income page's amount leaves $150: lean months are short, good months make up for them
  const d = at(150);
  assert.ok(d.spare.monthly < 0 && d.spare.held > 0.5); near(d.spare.monthly + d.spare.held, 150, 0.01);
  const bills = step(d, "bills");
  assert.equal(bills.status, "now");
  assert.match(bills.detail, new RegExp(`^About \\${m(-d.spare.monthly)} a month more goes out than comes in, after tax and saving, with uneven pay counted at what you can count on \\(Side income\\)\\. A month that brings the Income page's amount leaves about \\$150, so good months make up for lean ones; to be safe in a lean month, trim spending or pause a goal\\.$`));
  // even a full month is short: said so, and the usual way out
  const e = at(-120);
  assert.match(step(e, "bills").detail, /with uneven pay counted at what you can count on \(Side income\); even a month that brings the Income page's amount is about \$120 short\. Trim spending or pause a goal first\.$/);
  // no goal saving to pause: not offered
  const g = at(150, (p) => { p.goals = []; });
  assert.match(step(g, "bills").detail, /to be safe in a lean month, trim spending\.$/);
  // nothing held back: the plain sentence, as before
  const plain = familyPlan(); plain.expenses.push({ id: "x-more", name: "More", category: "fun", amount: base + 100, period: "monthly", essential: false });
  assert.match(step(compute(plain, { today: TODAY }), "bills").detail, /^About \$100 a month more goes out than comes in, after tax and saving\. Trim spending or pause a goal first\.$/);
});

test("one full-month figure (review 2026-11-02, round 5): spare.full and, said with 'about', spare.fullAbout to the nearest $10", async () => {
  const { aboutTen } = await import("../../cashflow/budget-percent/compute.js");
  assert.equal(aboutTen(1196.82), 1200); assert.equal(aboutTen(1194.9), 1190); assert.equal(aboutTen(-769.85), -770);
  assert.ok(Object.is(aboutTen(-4), 0), "never -0"); assert.equal(aboutTen(null), 0);
  // the family's $600 of photography counted at $0, spending set so a full month leaves $297 (said "about $300")
  const plan = () => { const p = familyPlan(); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const p = plan(); const s0 = compute(plan(), { today: TODAY }).spare;
  p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s0.full - 297, period: "monthly", essential: false });
  const d = compute(p, { today: TODAY });
  near(d.spare.full, d.spare.monthly + d.spare.held, 1e-9); near(d.spare.full, 297, 0.01);
  assert.equal(d.spare.fullAbout, 300);
  assert.ok(d.spare.monthly < 0);
  assert.match(step(d, "bills").detail, /A month that brings the Income page's amount leaves about \$300, so good months make up for lean ones/);
  // nothing held back: the full month is the month
  const f = compute(familyPlan(), { today: TODAY }).spare;
  assert.equal(f.full, f.monthly); assert.equal(f.fullAbout, aboutTen(f.monthly));
});

test("a full month within $5 of $0 'only just about breaks even', never 'about $0' (review 2026-11-02, round 5)", () => {
  const plan = () => { const p = familyPlan(); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: compute(plan(), { today: TODAY }).spare.full - left, period: "monthly", essential: false }); return compute(p, { today: TODAY }); };
  for (const left of [3, -2]) {
    const d = at(left);
    assert.equal(d.spare.fullKind, "even");
    const bills = step(d, "bills").detail;
    assert.match(bills, /even a month that brings the Income page's amount only just about breaks even\. Trim spending or pause a goal first\.$/);
    assert.doesNotMatch(bills, /\$0\b/);
  }
  assert.equal(at(8).spare.fullKind, "ahead"); assert.equal(at(-8).spare.fullKind, "short");
});

test("the child care account's money it would lose comes off the spare money (care fourth pass, Form 2441 line 14)", () => {
  // Jo: head of household in Ohio, 62,000 of pay, one child under 13, no care on Expenses. A 5,000 account for 2026 pays
  // nothing back, so all 5,000 leaves the pay for good; the tax falls by 600 + 382.50 + 137.50 = 1,120. The month has
  // 5,000 - 1,120 = 3,880 a year less: 323.33 a month (the page said 93.33 MORE)
  const NOV = "2026-11-02";
  const jo = (acct) => {
    const p = emptyPlan();
    p.household.filingStatus = "head_of_household"; p.household.state = "OH";
    p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
    p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
    p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1300, period: "monthly", essential: true }];
    if (acct) p.whatIfs = { benefits: { jo: { dcfsaElect: acct, planYear: 2026 } } };
    return p;
  };
  const without = compute(jo(0), { today: NOV }).spare, withAcct = compute(jo(5000), { today: NOV }).spare;
  assert.equal(without.careLost, 0);
  assert.ok(Math.abs(withAcct.careLost - 5000 / 12) < 1e-6, `${withAcct.careLost}`);
  assert.ok(Math.abs((withAcct.monthly - without.monthly) - -3880 / 12) < 0.005, `${withAcct.monthly - without.monthly}`);
  // with the care on Expenses nothing is lost: the account is worth its 70 a year (5.83 a month)
  const cared = (acct) => { const p = jo(acct); p.expenses.push({ id: "care", name: "Childcare and school", category: "childcare", amount: 900, period: "monthly", essential: true }); return p; };
  const c0 = compute(cared(0), { today: NOV }).spare, c1 = compute(cared(5000), { today: NOV }).spare;
  assert.equal(c1.careLost, 0); assert.ok(Math.abs((c1.monthly - c0.monthly) - 70 / 12) < 0.005, `${c1.monthly - c0.monthly}`);
});

test("Each month's money: the lines on screen add up to the spare money, the child care account's lost money a line of its own (Review 2026-11-06)", () => {
  // the verifier's plan: Jo with a 5,000 account and no care showed 5,170 - 120 - 360 - 70 - 3,070 = 1,550 above "Spare
  // each month $1,130": the 417 a month the account would lose had no line
  const NOV = "2026-11-02";
  const p = emptyPlan();
  p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1300, period: "monthly", essential: true }];
  p.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2026 } } };
  const d = compute(p, { today: NOV });
  const lines = monthLines(d.spare, d.debtPlan);
  const lost = lines.find((x) => x.key === "careLost");
  assert.ok(lost, "a line for the money the account would lose");
  near(lost.amount, 5000 / 12, 0.005);
  assert.match(lost.label, /child care account/i);
  near(lines.reduce((t, x) => t + x.amount, 0), d.spare.gross - d.spare.monthly, 0.005);
  // with nothing lost there is no such line, and the lines still add up (the family plan: business costs, state tax, goals)
  const f = compute(familyPlan(TODAY), { today: TODAY });
  const fl = monthLines(f.spare, f.debtPlan);
  assert.ok(!fl.some((x) => x.key === "careLost"));
  near(fl.reduce((t, x) => t + x.amount, 0), f.spare.gross - f.spare.monthly, 0.005);
});

test("Review 2026-11-06 (round 7): the unnamed first adult (\"Me\") reads you and your, the unnamed partner your spouse; typed names as before", () => {
  const T = "2026-11-02";
  const named = compute(familyPlan(T), { today: T });
  assert.match(step(named, "match").detail, /^Bo has a 401\(k\) and pay but no contribution on file\./);
  assert.match(step(named, "ira").detail, /^Ana \$7,500, Bo \$[\d,]+ of room left this year \(limit \$7,500 each\)\./);
  assert.match(step(named, "max-401k").detail, /^Ana \$[\d,]+ of room left this year \(limit/);
  const couple = familyPlan(T); couple.household.people[0].name = "Me"; couple.household.people[1].name = "My spouse";
  const d = compute(couple, { today: T });
  assert.match(step(d, "match").detail, /^Your spouse has a 401\(k\) and pay but no contribution on file\./);
  assert.match(step(d, "ira").detail, /^Room left this year: you \$7,500, your spouse \$[\d,]+ \(limit \$7,500 each\)\./);
  assert.match(step(d, "max-401k").detail, /^You have \$[\d,]+ of room left this year \(limit/);
  for (const s of d.steps) assert.doesNotMatch(s.detail, /\bMe\b|My spouse/, s.id);
  // nothing on file for either: "You and your spouse have"
  const none = structuredClone(couple); none.retirement.contributions = [];
  assert.match(step(compute(none, { today: T }), "match").detail, /^You and your spouse have a 401\(k\) and pay/);
  // alone, with a match: "You put money in with a match", not "Me puts"
  const single = familyPlan(T); single.household.people[0].name = "Me"; single.household.people = single.household.people.filter((x) => x.role !== "partner");
  const s = compute(single, { today: T });
  assert.match(step(s, "match").detail, /^You put money in with a match\./);
  assert.match(step(s, "ira").detail, /^You have \$7,500 of room left this year \(limit \$7,500\)\./);
  // a 401(k) only from a job left: "Your spouse's 401(k) is from a job left"
  const left = structuredClone(couple);
  const ask = step(d, "match").ask[0].accounts;
  for (const a of left.accounts) if (ask.includes(a.id)) a.formerJob = true;
  assert.match(step(compute(left, { today: T }), "match").detail, /^Your spouse's 401\(k\) is from a job left: check whether the job now has a plan with a match\./);
});
