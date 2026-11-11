import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, NUDGE, SS_PAYABLE_IF_DEPLETED } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { affordableSpending, copyInputs } from "../../../core/math/retirement.js";

const TODAY = "2026-10-30";
const d = compute(familyPlan(), { today: TODAY });
const row = (id) => d.rows.find((r) => r.id === id);

test("an empty plan says what is missing", () => {
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.ready, false); assert.ok(e.missing.length);
});

test("eleven inputs for the family, sorted by swing, the biggest first", () => {
  assert.equal(d.ready, true);
  assert.deepEqual(d.rows.map((r) => r.id).sort(), ["bonds", "claim", "end", "inflation", "mix", "raises", "retire", "saving", "ss-cut", "stocks", "tax"]);
  for (let i = 1; i < d.rows.length; i++) assert.ok(d.rows[i - 1].swing >= d.rows[i].swing);
  assert.equal(d.biggest, d.rows[0]);
  near(d.base.spendingMonthly, 7000);
});

test("each end is the plan with exactly one thing changed (checked against a hand-made change)", () => {
  const I = buildInputs(familyPlan(), { today: TODAY }).inputs;
  const s = copyInputs(I); s.returns.stocks -= NUDGE.returns;
  near(row("stocks").low.affordableMonthly, affordableSpending(s) / 12, 1);
  const c = copyInputs(I); for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED;
  near(row("ss-cut").low.affordableMonthly, affordableSpending(c) / 12, 1);
  near(row("ss-cut").high.affordableMonthly, d.base.affordableMonthly, 1);
  assert.equal(row("retire").low.label, "age 63"); assert.equal(row("retire").high.label, "age 67");
  assert.equal(row("saving").baseLabel.startsWith("$"), true);
});

test("the directions make sense: more return, later retirement, saving more and later claiming help; more inflation and a longer plan hurt", () => {
  for (const id of ["stocks", "bonds", "retire", "saving", "claim", "raises"]) assert.equal(row(id).worse, "low", id);
  for (const id of ["inflation", "end", "tax"]) assert.equal(row(id).worse, "high", id);
});

test("no flat tax row in brackets mode; no retirement row once retired", () => {
  const p = familyPlan(); p.retirement.taxMode = "brackets";
  assert.equal(compute(p, { today: TODAY }).rows.some((r) => r.id === "tax"), false);
  const q = familyPlan(); q.household.people[0].birthDate = "1958-01-01";
  assert.equal(compute(q, { today: TODAY }).rows.some((r) => r.id === "retire"), false);
});

test("review 2026-11-02 (round 5): the trust-fund row stays when nobody can still choose; left-out people by reason; 'now' only when it is now for all", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  const retired = (samBorn, leeBorn) => { const p = retirementPlan(); p.household.people[0].birthDate = samBorn; p.household.people[1].birthDate = leeBorn; p.income = []; p.retirement.contributions = []; return p; };
  const social = (id, amount) => ({ id: `ss-${id}`, name: "Social Security", type: "social", personId: id, amount, period: "monthly" });
  // both already get it: no claiming row, but the 77% row, checked against a hand-made cut
  const both = retired("1950-03-10", "1957-06-20"); both.income = [social("sam", 2800), social("lee", 2100)];
  const a = compute(both, { today: T });
  assert.equal(a.rows.some((r) => r.id === "claim"), false);
  const cut = a.rows.find((r) => r.id === "ss-cut");
  assert.ok(cut, "the trust-fund row is there for benefits already paid");
  const c = copyInputs(buildInputs(both, { today: T }).inputs); for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED;
  near(cut.low.affordableMonthly, affordableSpending(c) / 12, 1); near(cut.high.affordableMonthly, a.base.affordableMonthly, 1);
  // Sam is 76 and never claimed (66 on file), Lee 69 and 5 months: only Lee moves, and Sam is left out for his age
  const old = retired("1950-06-20", "1957-06-10"); old.retirement.socialSecurity.sam.claimAge = 66;
  const b = compute(old, { today: T }).rows.find((r) => r.id === "claim");
  assert.equal(b.help, "Lee only: Sam is 70 or over, when waiting adds nothing"); assert.equal(b.low.label, "now (69 and 5 months)");
  old.income = [social("sam", 2100)];
  assert.equal(compute(old, { today: T }).rows.find((r) => r.id === "claim").help, "Lee only: Sam already gets it");
  // 64 and 6 months and 60 and 5 months, both moved to the older one's age: "at", not "now"; alone, Sam's "now" is true
  const mixed = retired("1962-05-10", "1966-06-20"); mixed.household.people[1].retirementAge = 60;
  assert.equal(compute(mixed, { today: T }).rows.find((r) => r.id === "claim").low.label, "at 64 and 6 months");
  delete mixed.retirement.socialSecurity.lee;
  assert.equal(compute(mixed, { today: T }).rows.find((r) => r.id === "claim").low.label, "now (64 and 6 months)");
});

test("review 2026-11-02 (round 5, second pass): the method note says how the claiming row moves a couple", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const { ssMethodNote } = await import("./compute.js");
  const T = "2026-11-02";
  const retired = (samBorn, leeBorn) => { const p = retirementPlan(); p.household.people[0].birthDate = samBorn; p.household.people[1].birthDate = leeBorn; p.income = []; p.retirement.contributions = []; return p; };
  // 64 and 6 months and 60 and 5 months: both move to the older one's age today, not to 62
  const mixed = retired("1962-05-10", "1966-06-20"); mixed.household.people[1].retirementAge = 60;
  const m = compute(mixed, { today: T });
  assert.equal(m.rows.find((r) => r.id === "claim").low.label, "at 64 and 6 months");
  assert.equal(m.ssMethod, "Social Security: Sam and Lee claiming at the same age, the older one's age today (62 at the earliest), or both at 70; and the 77% that would be payable if the retirement trust fund runs dry in 2033 (2025 Trustees Report).");
  // one person still choosing
  delete mixed.retirement.socialSecurity.lee;
  assert.match(compute(mixed, { today: T }).ssMethod, /^Social Security: Sam claiming at today's age \(62 at the earliest\) or at 70; and the 77%/);
  // both already paid: no claiming row, so only the trust fund
  const both = retired("1950-03-10", "1957-06-20"); both.income = [{ id: "a", name: "SS", type: "social", personId: "sam", amount: 2800, period: "monthly" }, { id: "b", name: "SS", type: "social", personId: "lee", amount: 2100, period: "monthly" }];
  assert.equal(compute(both, { today: T }).ssMethod, "Social Security: the 77% that would be payable if the retirement trust fund runs dry in 2033 (2025 Trustees Report).");
  assert.equal(ssMethodNote([], false), null);
  assert.match(ssMethodNote(["A", "B", "C"], false), /^Social Security: A, B and C claiming at the same age, the oldest one's age today \(62 at the earliest\), or all at 70\.$/);
});

test("review 2026-11-06 (round 7): the unnamed first adult reads you, the partner your spouse; names as before", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const { ssMethodNote } = await import("./compute.js");
  const T = "2026-11-02";
  const fam = familyPlan(); fam.household.people[0].name = "Me"; fam.household.people[1].name = "My spouse";
  const m = compute(fam, { today: TODAY });
  assert.equal(m.rows.find((r) => r.id === "retire").label, "When you retire");
  assert.equal(row("retire").label, "When Ana retires");
  assert.match(m.ssMethod, /^Social Security: you and your spouse claiming at the same age, the older one's age today/);
  assert.match(d.ssMethod, /^Social Security: Ana and Bo claiming at the same age/);
  assert.match(ssMethodNote(["Me"], false), /^Social Security: you claiming at today's age \(62 at the earliest\) or at 70\.$/);
  assert.match(ssMethodNote(["Bo", "Me"], false), /^Social Security: you and Bo claiming at the same age/);
  // who is left out of the claiming row, and why, in the person's own number
  const retired = (samBorn, leeBorn) => { const p = retirementPlan(); p.household.people[0].birthDate = samBorn; p.household.people[1].birthDate = leeBorn; p.income = []; p.retirement.contributions = []; return p; };
  const old = retired("1950-06-20", "1957-06-10"); old.retirement.socialSecurity.sam.claimAge = 66;
  old.household.people[0].name = "Me"; old.household.people[1].name = "My spouse";
  assert.equal(compute(old, { today: T }).rows.find((r) => r.id === "claim").help, "your spouse only: you are 70 or over, when waiting adds nothing");
  old.income = [{ id: "ss-sam", name: "Social Security", type: "social", personId: "sam", amount: 2100, period: "monthly" }];
  assert.equal(compute(old, { today: T }).rows.find((r) => r.id === "claim").help, "your spouse only: you already get it");
});

// --- owner's request 2026-11-11, L1: gated like the other two pages; the saving row when nothing goes in ---------------------------
// An invented household like the 2026-11-11 phone walk's Casey: one adult, $72,000 pay, a 401(k) at work holding $48,000 with
// "None" going in (a typed $0 row), Social Security estimated, $3,090 a month planned in retirement
function casey({ workPlan = true, match, pay = 72000, ira = false } = {}) {
  const p = emptyPlan();
  p.household.people.push({ id: "c", name: "Casey", role: "self", birthDate: "1980-06-15" });
  p.household.filingStatus = "single";
  p.accounts.push(ira ? { id: "ira", name: "Casey's retirement", type: "ira", balance: 12000, ownerId: "c" } : { id: "k", name: "Casey's plan at work", type: "401k", balance: 48000, ownerId: "c" },
    { id: "chk", name: "Checking", type: "checking", balance: 4000 }, { id: "sav", name: "Savings", type: "savings", balance: 15000 });
  p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "c", amount: pay, period: "annual" });
  p.retirement.spendingMonthly = 3090;
  p.retirement.socialSecurity = { c: { monthlyAtFRA: 2697 } };
  p.retirement.workPlans = { c: { plan: workPlan, ...(match === undefined ? {} : { match }) } };
  if (!ira) p.retirement.contributions.push({ id: "row", accountId: "k", personId: "c", period: "monthly", amount: 0, employerMatch: 0 });
  p.guide = { setup: { status: { c: "work" } } };
  return p;
}
const T11 = "2026-11-11";

test("L1: no retirement savings and nothing going in: 'We don't know yet' and one filled button, never rows of $0", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { usualSaving } = await import("./compute.js");
  const d0 = compute(renterDebtPlan(), { today: T11 });
  assert.equal(d0.ready, true); assert.equal(d0.noSavings, true); assert.deepEqual(d0.rows, []); assert.equal(d0.biggest, null);
  // the same rule as Will the money last? and Goal seek (savingsUnknown)
  const { compute: projection, savingsUnknown } = await import("../../retirement/projection/compute.js");
  assert.equal(savingsUnknown(projection(renterDebtPlan(), { today: T11 })), true);
  const { compute: goalSeek } = await import("../goal-seek/compute.js");
  assert.equal(goalSeek(renterDebtPlan(), { today: T11, only: ["spending"] }).noSavings, true);
  // told rather than untold (fix round 1, B4): a $0 "Work 401(k)" is on file, so "Nothing is saved", with the usual saving's line,
  // its figure the usual row typed on Retirement contributions and run through the projection (said = done)
  assert.equal(d0.nothingSaved, true);
  const typed = renterDebtPlan(); typed.retirement.contributions.push(...usualSaving(typed, T11).flatMap((u) => u.rows));
  near(d0.usualLine.affordableMonthly, affordableSpending(buildInputs(typed, { today: T11 }).inputs) / 12, 1e-6);
  assert.match(d0.usualLine.text, /^If Riley put in 4\.7% of pay \(about \$150 a month\) plus the usual match, the plan could pay about \$1,940 a month of the \$2,040 it plans\.$/);
  // the page
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/sensitivity": (plan, params) => compute(plan, params) };
  const r = await renderPage(new URL("./view.js", import.meta.url), renterDebtPlan(), T11, { computeRemote: live });
  assert.match(r.text(), /We don't know yet/); assert.match(r.text(), /Nothing is saved for retirement yet, and nothing goes in/);
  assert.doesNotMatch(r.text(), /haven't told us/); assert.match(r.text(), /If Riley put in 4\.7% of pay/);
  assert.ok(!/\$0\b/.test(r.text()), r.text());
  const filled = r.root.querySelectorAll("a").filter((a) => a.classList.contains("btn") && !a.classList.contains("secondary"));
  assert.deepEqual(filled.map((a) => [a.textContent, a.getAttribute("href")]), [["Add what you own ›", "#/balance/net-worth"]]);
  assert.equal(r.root.querySelectorAll(".sn-row").length, 0);
  // nothing on file and nothing said: "You haven't told us", no line
  const untold = renterDebtPlan(); untold.accounts = untold.accounts.filter((a) => a.type !== "401k");
  const du = compute(untold, { today: T11 });
  assert.equal(du.noSavings, true); assert.equal(du.nothingSaved, false); assert.equal(du.usualLine, null);
  assert.match(await (await import("../../../qa/fixtures/fake-dom.mjs")).pageText(new URL("./view.js", import.meta.url), untold, T11, { computeRemote: live }), /You haven't told us about retirement savings/);
  // a plan with savings is not gated
  assert.equal(compute(casey(), { today: T11 }).noSavings, undefined);
});

test("L1: nothing going in: the saving row's high end is the usual share of pay plus the usual match, as if typed on Contributions", async () => {
  const { usualSaving } = await import("./compute.js");
  const { usualShare, matchTerms } = await import("../../overview/guesses/estimators/saving.js");
  const p = casey();
  const share = usualShare(p, "c", T11);
  assert.equal(share, 0.066);   // Vanguard How America Saves 2026, for $72,000 at 46
  const [u] = usualSaving(p, T11);
  near(u.own, share * 72000, 1e-6);
  near(u.match, matchTerms().value * Math.min(1, share / matchTerms().needed) * 72000, 1e-6);   // 4% of pay: all of the usual match
  near(u.match, 2880, 1e-6); assert.equal(u.accountId, "k"); assert.equal(u.kind, "401k"); assert.equal(u.capped, false);
  const d1 = compute(p, { today: T11 });
  const r = d1.rows.find((x) => x.id === "saving");
  assert.ok(r, "the row is there when nothing goes in");
  // fix round 1 (M2, P3): the high end in money, the line in words a person can act on, the own money alone, still short
  assert.equal(r.baseLabel, "nothing"); assert.equal(r.low.label, "nothing"); assert.equal(r.high.label, "$400 a month + $240 match");
  // simple first (owner, 2026-11-12): the line says what the high end is, that the match is the usual one and not the job's own,
  // and that it is still short; the shares, the match's amount and the own money alone are the row's "More about this"
  assert.equal(r.help, "Nothing goes in now. The high end: what people with pay like Casey's usually put in, plus the match most jobs add (Casey's job may differ). Still short of the $3,090 a month the plan spends.");
  assert.equal(r.more, "Casey: 6.6% of pay, about $400 a month. The usual match: about $240 a month; HR can tell you the real one. With Casey's own money alone, the plan could pay about $2,720 a month.");
  near(r.low.affordableMonthly, d1.base.affordableMonthly, 1e-6);
  // said = done: the same row typed on Contributions gives the same high end; with no match typed, the own-money figure
  const typed = casey(); typed.retirement.contributions[0] = { ...typed.retirement.contributions[0], amount: share * 72000 / 12, employerMatch: 2880 };
  near(r.high.affordableMonthly, affordableSpending(buildInputs(typed, { today: T11 }).inputs) / 12, 1e-6);
  typed.retirement.contributions[0].employerMatch = 0;
  near(r.ownOnlyMonthly, affordableSpending(buildInputs(typed, { today: T11 }).inputs) / 12, 1e-6);
  assert.ok(r.high.affordableMonthly > r.low.affordableMonthly + 100); assert.equal(r.worse, "low");
  // no pay-raise row while nothing goes in (saving that grows with pay needs saving)
  assert.equal(d1.rows.some((x) => x.id === "raises"), false);
});

test("L1 + fix round 1 (M3, B5): the usual saving keeps to the law's limits and to people of working age", async () => {
  const { usualSaving, WORK_AGE } = await import("./compute.js");
  const { limitsFor } = await import("../../retirement/contributions/compute.js");
  // no plan at work, an IRA (the phone walk's Morgan): own money only, into the IRA
  const ira = casey({ ira: true, workPlan: false, match: false });
  const [u] = usualSaving(ira, T11);
  assert.equal(u.match, 0); assert.equal(u.accountId, "ira"); assert.equal(u.kind, "ira"); assert.equal(u.capped, false);
  const r = compute(ira, { today: T11 }).rows.find((x) => x.id === "saving");
  assert.ok(r); assert.doesNotMatch(`${r.help} ${r.more}`, /match/);
  assert.equal(r.help, "Nothing goes in now. The high end: what people with pay like Casey's usually put in. Still short of the $3,090 a month the plan spends.");
  assert.match(r.more, /^Casey: [\d.]+% of pay, about \$[\d,]+ a month, into Casey's retirement\.$/);
  // the job's plan has no match (the person said so): no match
  assert.equal(usualSaving(casey({ match: false }), T11)[0].match, 0);
  // high pay at work: own money stops at the 401(k) limit for the year (2026: $24,500 under 50), the match on the pay a plan counts
  const high = usualSaving(casey({ pay: 900000 }), T11)[0];
  assert.equal(high.own, 24500); assert.equal(high.capped, true);
  near(high.match, 0.04 * Math.min(1, 24500 / 360000 / 0.06) * 360000, 1e-6);
  const hr = compute(casey({ pay: 900000 }), { today: T11 }).rows.find((x) => x.id === "saving");
  assert.match(hr.help, /^Nothing goes in now\. The high end: the most allowed in a 401\(k\) in 2026, plus the match most jobs add \(Casey's job may differ\)\./);
  assert.match(hr.more, /^Casey: the most allowed in a 401\(k\) in 2026, about \$2,040 a month \(people with pay like Casey's usually put in [\d.]+% of pay\)\. The usual match: about \$[\d,]+ a month; HR can tell you the real one\./);
  // outside a plan at work: an IRA up to the year's IRA limit for the age ($7,500, +$1,100 from 50), the rest into other savings
  const iraHigh = casey({ ira: true, workPlan: false, pay: 200000 });
  const [h] = usualSaving(iraHigh, T11);
  const lim = limitsFor(2026).kinds.ira;
  assert.equal(h.kind, "ira"); assert.equal(h.capped, true);
  near(h.rows[0].amount * 12, lim.limit, 1e-6); assert.equal(h.rows[0].accountId, "ira");
  near(h.rows[1].amount * 12, h.share * 200000 - lim.limit, 1e-6); assert.equal(h.rows[1].accountId, "");
  const old = casey({ ira: true, workPlan: false, pay: 200000 }); old.household.people[0].birthDate = "1970-06-15";
  near(usualSaving(old, T11)[0].rows[0].amount * 12, lim.limit + lim.catchUp, 1e-6);
  // a Roth IRA above the top of its income range takes nothing: all of it into other savings (single, 2026: $168,000)
  const roth = casey({ ira: true, workPlan: false, pay: 200000 }); roth.accounts[0] = { ...roth.accounts[0], id: "roth", type: "roth", name: "Casey's Roth" };
  const [ro] = usualSaving(roth, T11);
  assert.equal(ro.accountId, null); assert.deepEqual(ro.rows.map((x) => x.accountId), [""]);
  // under the range it goes in, up to the IRA limit
  const rothLow = casey({ ira: true, workPlan: false, pay: 60000 }); rothLow.accounts[0] = { ...rothLow.accounts[0], id: "roth", type: "roth", name: "Casey's Roth" };
  assert.equal(usualSaving(rothLow, T11)[0].accountId, "roth");
  // the high-earner qa household: no row outside the limits, no Roth row above its range
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const hnw = migrate(ARCHETYPES.find((a) => a.id === "12-high-net-worth").build());
  for (const x of usualSaving(hnw, T11)) for (const row of x.rows) {
    const acct = hnw.accounts.find((a) => a.id === row.accountId);
    if (acct?.type === "401k") assert.ok(row.amount * 12 <= 32500 + 1e-6, `${x.name} 401(k)`);
    assert.notEqual(acct?.type, "roth", `${x.name}: no Roth IRA at that income`);
  }
  // working age only (B5): a birth year typed in the future, or a child marked as the household's adult
  const future = casey(); future.household.people[0].birthDate = "2080-06-15";
  assert.deepEqual(usualSaving(future, T11), []);
  const child = casey(); child.household.people[0].birthDate = "2018-06-15";
  assert.deepEqual(usualSaving(child, T11), []); assert.equal(WORK_AGE, 16);
  // something already goes in, or no pay: nobody to add
  const saving = casey(); saving.retirement.contributions[0].amount = 300;
  assert.deepEqual(usualSaving(saving, T11), []);
  assert.deepEqual(usualSaving(casey({ pay: 0 }), T11), []);
  // the family already saves: the rows are as before (eleven, with the 25% nudge)
  assert.equal(row("saving").low.label, "75%");
});

test("fix round 1 (B1): the headline never compares the plan with itself, and says the saving it means in shares and dollars", async () => {
  const { heroLine } = await import("./compute.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const hh = (id) => compute(migrate(ARCHETYPES.find((a) => a.id === id).build()), { today: T11 });
  const single = hh("01-single-adult"), two = hh("04-two-parents");
  assert.equal(single.biggest.id, "saving"); assert.equal(two.biggest.id, "saving");
  assert.equal(single.headline, "If Maya put in 6.0% of pay (about $320 a month) plus the usual match, as people with pay like Maya's usually do, the plan could pay about $1,390 a month more.");
  assert.equal(two.headline, "If Carlos put in 7.5% of pay (about $750 a month) and Jen 5.2% (about $200 a month), plus the usual match, as people with pay like theirs usually do, the plan could pay about $2,210 a month more.");
  for (const d of [single, two]) { assert.doesNotMatch(d.headline, /nothing instead of nothing|by \$0\b|the usual share/); assert.match(d.headline, /\d\.\d% of pay \(about \$[\d,]+ a month\)/); }
  // any row: an end that is the plan as it is, or that moves it by under $5, is left out; nothing left: no sentence
  const base = { affordableMonthly: 1000 };
  const top = (low, high) => ({ id: "x", label: "Inflation", baseLabel: "3.0%", low, high });
  assert.equal(heroLine(top({ label: "2.0%", affordableMonthly: 1200 }, { label: "4.0%", affordableMonthly: 900 }), base), "Inflation: 2.0% instead of 3.0% raises it by $200 a month; 4.0% cuts it by $100.");
  assert.equal(heroLine(top({ label: "3.0%", affordableMonthly: 1000 }, { label: "4.0%", affordableMonthly: 900 }), base), "Inflation: 4.0% instead of 3.0% cuts it by $100 a month.");
  assert.equal(heroLine(top({ label: "2.0%", affordableMonthly: 1002 }, { label: "4.0%", affordableMonthly: 998 }), base), null);
  // the page shows it under the headline
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/sensitivity": (plan, params) => compute(plan, params) };
  const t = await pageText(new URL("./view.js", import.meta.url), migrate(ARCHETYPES.find((a) => a.id === "01-single-adult").build()), T11, { computeRemote: live });
  assert.match(t, /How much you save moves your plan the most/); assert.match(t, /If Maya put in 6\.0% of pay/); assert.doesNotMatch(t, /nothing instead of nothing/);
});

test("simple first (owner, 2026-11-12 and 2026-11-13): three numbers first, the rest and every detail one quiet tap away; the figures we use are checked, never raised (P8)", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/sensitivity": (plan, params) => compute(plan, params) };
  const d = compute(casey(), { today: T11 });
  const r = await renderPage(new URL("./view.js", import.meta.url), casey(), T11, { computeRemote: live });
  // every row is on the page; three are in the first list, the rest inside the fold that says how many
  assert.equal(r.root.querySelectorAll(".sn-row").length, d.rows.length);
  const rest = r.root.querySelectorAll("details").find((x) => x.classList.contains("sn-rest"));
  assert.ok(rest && !rest.hasAttribute("open"), "the rest starts closed");
  assert.equal(rest.querySelectorAll(".sn-row").length, d.rows.length - 3);
  assert.match(rest.querySelector("summary").textContent, new RegExp(`^${d.rows.length - 3} more numbers`));
  // the first three are the three that move what the plan can pay the most
  const first = r.root.querySelectorAll(".sn-row").filter((x) => !x.closest?.("details") && !rest.querySelectorAll(".sn-row").includes(x));
  assert.deepEqual(first.map((x) => x.querySelector(".sn-label").textContent.replace(/^\d/, "")), d.rows.slice(0, 3).map((x) => x.label));
  // the saving row: a short line, its shares and the match's amount behind "More about this"
  const saving = r.root.querySelectorAll(".sn-row").find((x) => /How much you save/.test(x.textContent));
  const about = saving.querySelectorAll("details").find((x) => x.classList.contains("sn-about"));
  assert.equal(about.querySelector("summary").textContent.replace("›", "").trim(), "More about this");
  assert.match(about.textContent, /Casey: 6\.6% of pay, about \$400 a month\. The usual match: about \$240 a month; HR can tell you the real one\./);
  // rows with nothing more to say have no fold
  assert.equal(r.root.querySelectorAll("details").filter((x) => x.classList.contains("sn-about")).length, 1);
  // how to read the bars is folded; the only way to the figures we use is inside it and says "check"
  const read = r.root.querySelectorAll("details").find((x) => /How to read this/.test(x.querySelector("summary")?.textContent ?? ""));
  assert.ok(read && !read.hasAttribute("open"));
  const links = r.root.querySelectorAll("a").map((a) => [a.textContent, a.getAttribute("href")]);
  assert.deepEqual(links.filter(([, h]) => String(h).includes("assumptions")), [["Check the figures we use ›", "#/system/assumptions?show=returnStocks"]]);
  assert.ok(read.querySelectorAll("a").some((a) => a.getAttribute("href") === "#/system/assumptions?show=returnStocks"));
  // one way on, in plain words, outlined; no filled button on the page
  assert.deepEqual(links.filter(([, h]) => h === "#/scenarios/goal-seek"), [["What it would take ›", "#/scenarios/goal-seek"]]);
  assert.equal(r.root.querySelectorAll("a").filter((a) => a.classList.contains("btn") && !a.classList.contains("secondary")).length, 0);
  // four rows: three shown, the fourth one tap away (retired this year, no Social Security: no retirement, saving or claiming row)
  const few = casey(); few.household.people[0].retirementAge = 46; few.income = []; few.retirement.contributions = [];
  few.retirement.socialSecurity = { c: { source: "none" } };
  const df = compute(few, { today: T11 });
  const liveRows = df.rows.filter((x) => x.moves.spend);
  const rf = await renderPage(new URL("./view.js", import.meta.url), few, T11, { computeRemote: live });
  const restF = rf.root.querySelectorAll("details").find((x) => x.classList.contains("sn-rest"));
  assert.equal(rf.root.querySelectorAll(".sn-row").length - (restF ? restF.querySelectorAll(".sn-row").length : 0), Math.min(3, liveRows.length));
  // this plan lasts or not: the way on uses Goal seek's own words for it
  const on = rf.root.querySelectorAll("a").find((a) => a.getAttribute("href") === "#/scenarios/goal-seek");
  assert.equal(on.textContent, df.base.success ? "How far each change could go ›" : "What it would take ›");
});

// --- fix round 2 (2026-11-13), N1: a number that moves nothing is never listed among the ones that matter most -------------------
test("fix round 2 (N1): a plan that pays $0 at every setting: the moving rows first, the rest as 'no change here', the headline only for a number that moves", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { MOVES, valueOn, runoutLine } = await import("./compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  const live = { "scenarios/sensitivity": (plan, params) => compute(plan, params) };
  // qa 01-single-adult: nothing goes in, no Social Security on file; the plan pays $0 at every setting but the saving row's high end
  const maya = () => migrate(ARCHETYPES.find((a) => a.id === "01-single-adult").build());
  const d1 = compute(maya(), { today: T11 });
  assert.equal(d1.base.affordableMonthly, 0);
  assert.deepEqual(d1.measures, ["spend", "runout"]); assert.equal(d1.measure, "spend");
  assert.equal(d1.biggest.id, "saving"); assert.ok(d1.rows.every((x) => x.moves.spend === (x.id === "saving")));
  // "moves" is checked by hand: either end at least $5 a month (or a year) from the plan as it is
  for (const x of d1.rows) {
    assert.equal(x.moves.spend, Math.max(Math.abs(x.low.affordableMonthly - d1.base.affordableMonthly), Math.abs(x.high.affordableMonthly - d1.base.affordableMonthly)) >= MOVES.spend, x.id);
    assert.equal(x.moves.runout, Math.max(Math.abs(valueOn(x.low, "runout", d1.runoutCap) - valueOn(d1.base, "runout", d1.runoutCap)), Math.abs(valueOn(x.high, "runout", d1.runoutCap) - valueOn(d1.base, "runout", d1.runoutCap))) >= 1, x.id);
  }
  // the run-out age is the engine's own (project's failAge, the first adult's age in the year the money runs out)
  const { buildInputs: bi } = await import("../../retirement/projection/compute.js");
  const run = project(bi(maya(), { today: T11 }).inputs);
  assert.equal(d1.base.runsOutAge, run.failAge); assert.equal(d1.base.failYear, run.failYear);
  const r1 = await renderPage(new URL("./view.js", import.meta.url), maya(), T11, { computeRemote: live });
  // first view: the one row that moves; the seven that do not are one tap away, said as "no change here", with no bar
  const rest = r1.root.querySelectorAll("details").find((x) => x.classList.contains("sn-rest"));
  const inRest = rest.querySelectorAll(".sn-row");
  const first = r1.root.querySelectorAll(".sn-row").filter((x) => !inRest.includes(x));
  assert.deepEqual(first.map((x) => /How much you save/.test(x.textContent)), [true]);
  assert.match(rest.querySelector("summary").textContent, /^7 more numbers.*they change nothing here/);
  const still = inRest.filter((x) => x.classList.contains("sn-still"));
  assert.equal(still.length, 7); assert.ok(still.every((x) => /no change here\./.test(x.textContent) && !x.querySelectorAll("svg").length));
  assert.match(r1.text(), /How much you save moves your plan the most/);
  // the hero says when the money runs out, never "about $0 a month of spending"
  assert.match(r1.text(), new RegExp(`As it stands the money runs out in ${d1.base.failYear} \\(age ${d1.base.runsOutAge}\\), and the plan can't yet pay for any of the \\$[\\d,]+ a month it plans\\.`));
  assert.doesNotMatch(r1.text(), /about \$0 a month/);
  // the measure chips are the two that something moves: never "What is left at the end" with every bar at $0
  const chips = r1.root.querySelectorAll(".chip").map((c) => c.textContent);
  assert.deepEqual(chips, ["What you can spend", "How long it lasts"]);
  // "How long it lasts": the rows that change the run-out age, then the rest
  r1.root.querySelectorAll(".chip").find((c) => c.textContent === "How long it lasts").click();
  const inRest2 = r1.root.querySelectorAll("details").find((x) => x.classList.contains("sn-rest")).querySelectorAll(".sn-row");
  const first2 = r1.root.querySelectorAll(".sn-row").filter((x) => !inRest2.includes(x)).map((x) => x.querySelector(".sn-label").textContent.replace(/^\d/, ""));
  assert.deepEqual(first2.sort(), d1.rows.filter((x) => x.moves.runout).map((x) => x.label).sort());
  assert.match(r1.text(), new RegExp(`Bars: the age the money lasts to with each setting \\("lasts": to the end of the plan\\)\\. The line is your plan as it is: to age ${d1.base.runsOutAge}\\.`));
  // under the bars: "to 81", never "age 63: age 81"
  const svgText = r1.root.querySelectorAll("text").map((x) => x.textContent);
  assert.ok(svgText.length && svgText.every((x) => /: (to \d+|lasts)$/.test(x)), svgText.join(" | "));
  // switching the measure changes nothing in the plan
  assert.deepEqual(r1.saved, []);

  // qa "turns retirement age today": nothing moves at all (the money runs out this year with every setting)
  const today0 = maya(); const self = today0.household.people.find((q) => q.role === "self") ?? today0.household.people[0];
  self.retirementAge = Number(T11.slice(0, 4)) - Number(String(self.birthDate).slice(0, 4)); today0.income = [];
  const d0 = compute(today0, { today: T11 });
  assert.equal(d0.ready, true); assert.ok(!d0.noSavings);
  assert.deepEqual(d0.measures, []); assert.equal(d0.biggest, null); assert.equal(d0.headline, null);
  const t0 = (await renderPage(new URL("./view.js", import.meta.url), today0, T11, { computeRemote: live })).text();
  assert.match(t0, /None of these numbers changes the answer/); assert.doesNotMatch(t0, /moves your plan the most/);
  assert.match(t0, /With every setting the money still runs out in \d{4}/);
  // said once, in the hero; the list's card does not repeat it, and no measure is offered
  assert.doesNotMatch(t0, /With every setting the plan still can't pay for steady spending/);
  assert.doesNotMatch(t0, /Measure it another way/);
  assert.match(t0, /\d+ more numbers they change nothing here/);
  // the sentence for "How long it lasts", by hand
  const top = { label: "How much stocks earn", baseLabel: "7.0%", low: { label: "6.0%", success: false, runsOutAge: 74 }, high: { label: "8.0%", success: false, runsOutAge: 81 } };
  const base = { success: false, runsOutAge: 77 };
  assert.equal(runoutLine(top, base, 96), "How much stocks earn: at 6.0% instead of 7.0%, the money lasts to age 74 instead of 77; at 8.0%, to age 81.");
  assert.equal(runoutLine({ ...top, high: { label: "8.0%", success: true } }, base, 96), "How much stocks earn: at 6.0% instead of 7.0%, the money lasts to age 74 instead of 77; at 8.0%, it lasts to the end.");
  assert.equal(runoutLine({ ...top, low: { label: "6.0%", success: false, runsOutAge: 77 }, high: { label: "8.0%", success: true } }, base, 96), "How much stocks earn: at 8.0% instead of 7.0%, the money lasts to the end instead of running out at 77.");
  assert.equal(runoutLine({ ...top, low: { label: "6.0%", success: false, runsOutAge: 77 }, high: { label: "8.0%", success: false, runsOutAge: 77 } }, base, 96), null);
});

test("fix round 2 (N1): on every qa base household the first three rows move the measure shown, and the headline's number moves the plan", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  let checked = 0;
  for (const a of ARCHETYPES) {
    let plan; try { plan = migrate(a.build()); } catch { continue; }
    const x = compute(plan, { today: T11 });
    if (!x.ready || x.noSavings) continue;
    checked++;
    if (x.biggest) assert.ok(x.biggest.moves[x.measure], a.id);
    else assert.deepEqual(x.measures, [], a.id);
    assert.ok(!x.measures.includes("spend") || x.measure === "spend", a.id);
    for (const m of x.measures) assert.ok(x.rows.some((r) => r.moves[m]), `${a.id} ${m}`);
  }
  assert.ok(checked >= 8, `checked ${checked}`);
});

test("fix round 2 (N6): a row's 'More about this' stays open when the measure is switched", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/sensitivity": (plan, params) => compute(plan, params) };
  const r = await renderPage(new URL("./view.js", import.meta.url), casey(), T11, { computeRemote: live });
  const aboutOf = () => r.root.querySelectorAll("details").find((x) => x.classList.contains("sn-about"));
  const a = aboutOf(); a.setAttribute("open", ""); a.open = true; a.dispatch("toggle");
  const chips = r.root.querySelectorAll(".chip");
  assert.ok(chips.length >= 2);
  chips.find((c) => c.getAttribute("aria-pressed") === "false").click();
  assert.ok(aboutOf().hasAttribute("open"), "still open after the switch");
  chips.find((c) => c.getAttribute("aria-pressed") === "true")?.click();
  // closed again: stays closed
  const b = aboutOf(); b.removeAttribute("open"); b.open = false; b.dispatch("toggle");
  r.root.querySelectorAll(".chip")[0].click();
  assert.ok(!aboutOf().hasAttribute("open"));
});

test("L1 + fix round 1 (P5): the page is called what it answers, in words that fit the top bar; the old names still find it", async () => {
  const m = (await import("./module.js")).default;
  assert.equal(m.title, "What matters most");
  assert.ok(m.aliases.includes("sensitivity")); assert.ok(m.aliases.includes("what changes your answer"));
});

function near(a, b, tol = 0.5) { assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`); }

// simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): the hero is the answer; the other measures are one quiet tap away
test("simple first (fix round 2): the bars show the page's own measure; the others are behind 'Measure it another way', whose line says which is showing", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/sensitivity": (plan, params) => compute(plan, params) };
  const d = compute(casey(), { today: T11 });
  // Casey's money runs out with every setting, so nothing is ever left at the end: two measures move something
  assert.deepEqual(d.measures, ["spend", "runout"]); assert.equal(d.measure, "spend");
  const r = await renderPage(new URL("./view.js?measure-fold", import.meta.url), casey(), T11, { computeRemote: live });
  // the hero: the answer and the headline, not how the numbers were nudged (that is in "How to read this")
  const hero = r.root.querySelectorAll("section").find((x) => x.classList.contains("hero"));
  assert.doesNotMatch(hero.textContent, /nudged/); assert.match(hero.textContent, /^.*moves your plan the most\s*As it stands the plan can pay for about \$/);
  const read = r.root.querySelectorAll("details").find((x) => /How to read this/.test(x.textContent));
  assert.match(read.textContent, /Each of your plan's numbers is nudged down and up, one at a time/);
  // every measure chip is inside the closed fold; its line names the other two
  const fold = r.root.querySelectorAll("details").find((x) => x.classList.contains("sn-measure"));
  assert.ok(fold && !fold.hasAttribute("open"));
  assert.equal(fold.querySelector("summary").textContent, "Measure it another wayhow long it lasts›");
  const chips = r.root.querySelectorAll(".chip");
  assert.deepEqual(chips.map((c) => c.textContent), ["What you can spend", "How long it lasts"]);
  assert.ok(chips.every((c) => fold.all().includes(c)));
  assert.match(r.text(), /Bars: the steady spending a month/);
  // another measure picked: the line says so, the bars and their caption follow, the fold stays open (a view choice, never the plan)
  fold.setAttribute("open", ""); fold.open = true; fold.dispatch("toggle");
  chips.find((c) => c.textContent === "How long it lasts").click();
  assert.equal(fold.querySelector("summary").textContent, "Measure it another wayshowing how long it lasts›");
  assert.match(r.text(), /Bars: the age the money lasts to with each setting/);
  assert.ok(fold.hasAttribute("open"));
  assert.deepEqual(r.saved, []);
  r.root.querySelectorAll(".chip").find((c) => c.textContent === "What you can spend").click();
  assert.equal(fold.querySelector("summary").textContent, "Measure it another wayhow long it lasts›");
  // the family's money lasts with every setting: "how long it lasts" moves nothing, so it is not offered; the line names the end
  const fam = familyPlan(T11);
  assert.deepEqual(compute(fam, { today: T11 }).measures, ["spend", "end"]);
  const rf = await renderPage(new URL("./view.js?measure-fold-2", import.meta.url), fam, T11, { computeRemote: live });
  assert.equal(rf.root.querySelectorAll("details").find((x) => x.classList.contains("sn-measure")).querySelector("summary").textContent, "Measure it another waywhat is left at the end›");
  assert.deepEqual(rf.root.querySelectorAll(".chip").map((c) => c.textContent), ["What you can spend", "What is left at the end"]);
});
