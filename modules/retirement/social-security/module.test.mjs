import { test } from "node:test";
import assert from "node:assert/strict";
import { fullRetirementAge, claimFactor, parseRecord, credits, estimateBenefit, compute } from "./compute.js";
import { WAGE_INDICES } from "./data/ssa.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("full retirement age and the claim-age factors match the SSA charts", () => {
  assert.deepEqual([fullRetirementAge(1960).years, fullRetirementAge(1960).months], [67, 0]);
  assert.deepEqual([fullRetirementAge(1957).years, fullRetirementAge(1957).months], [66, 6]);
  assert.deepEqual([fullRetirementAge(1950).years, fullRetirementAge(1950).months], [66, 0]);
  near(claimFactor(1960, 62), 0.70, 1e-9, "62 with an FRA of 67: 70%");
  near(claimFactor(1960, 67), 1, 1e-9);
  near(claimFactor(1960, 70), 1.24, 1e-9, "three years of 8% delayed credits");
  near(claimFactor(1960, 65), 1 - 24 * (5 / 9) / 100, 1e-9, "24 months early: 86.67%");
  near(claimFactor(1955, 62), 1 - 36 * (5 / 9) / 100 - 14 * (5 / 12) / 100, 1e-9, "FRA 66 and 2 months: 50 months early: 74.17%");
  near(claimFactor(1960, 75), 1.24, 1e-9, "no credit past 70");
});
test("parseRecord reads ssa.gov style text", () => {
  const rec = parseRecord("Year  Taxed Social Security Earnings\n2024\t$69,000\n2023 $66,500.00\n2022\t64,000\nsome junk\n2024 $70,000\n");
  assert.deepEqual(rec, [{ year: 2022, earnings: 64000 }, { year: 2023, earnings: 66500 }, { year: 2024, earnings: 70000 }]);
  assert.equal(credits(rec), 12);
  assert.equal(credits([{ year: 2024, earnings: 1000 }]), 0, "under one credit's worth");
});
test("estimateBenefit follows the SSA formula on a simple record", () => {
  // Born 1962: turns 60 in 2022 (indexing year), 62 in 2024. 35 years of earnings equal to the AWI of each year
  // index to exactly AWI[2022] each, so AIME = AWI[2022] / 12 and the bend points are the 2024 ones.
  const record = []; for (let y = 1987; y <= 2021; y++) record.push({ year: y, earnings: WAGE_INDICES[y] });
  const e = estimateBenefit(record, { birthYear: 1962, claimAge: 67, futureEarnings: "none", today: "2026-09-16" });
  assert.equal(e.indexingYear, 2022);
  assert.equal(e.aime, Math.floor(WAGE_INDICES[2022] * 35 / 420));
  const scale = WAGE_INDICES[2022] / WAGE_INDICES[1977];
  assert.deepEqual(e.bendPoints, [Math.round(180 * scale), Math.round(1085 * scale)]);
  const [bp1, bp2] = e.bendPoints;
  let pia = 0.9 * bp1 + 0.32 * (Math.min(e.aime, bp2) - bp1) + 0.15 * Math.max(0, e.aime - bp2);
  pia = Math.floor(pia * 10) / 10;
  // COLAs for 2024 and 2025 apply (turned 62 in 2024)
  assert.ok(e.pia > pia, "COLA'd up since 62"); assert.ok(e.pia < pia * 1.1);
  assert.equal(e.eligible, true); assert.equal(e.credits, 40); assert.equal(e.projectedYears, 0);
  near(e.monthly, e.pia, 0.11, "claiming at FRA 67: the PIA");
  const early = estimateBenefit(record, { birthYear: 1962, claimAge: 62, futureEarnings: "none", today: "2026-09-16" });
  near(early.monthly, Math.floor(e.pia * 0.7 * 10) / 10, 0.11);
});
test("future earnings repeat the last year until the stop year; a record with few years is not eligible", () => {
  const e = estimateBenefit([{ year: 2023, earnings: 50000 }, { year: 2024, earnings: 52000 }], { birthYear: 1990, claimAge: 67, futureEarnings: "same", stopYear: 2030, today: "2026-01-01" });
  assert.equal(e.projectedYears, 6); assert.equal(e.yearsInRecord, 8); assert.equal(e.eligible, false, "8 years is 32 credits");
  const f = estimateBenefit([{ year: 2023, earnings: 50000 }, { year: 2024, earnings: 52000 }], { birthYear: 1990, claimAge: 67, futureEarnings: "same", today: "2026-01-01" });
  assert.equal(f.yearsInRecord, 2 + (1990 + 67 - 1 - 2024), "until the year before claiming");
});
test("compute: a record, a typed statement figure, and nothing", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1962-05-20", retirementAge: 67 }, { id: "b", name: "Bo", role: "partner", birthDate: "1965-01-15" }, { id: "c", name: "Cy", role: "dependent", birthDate: "2020-01-01" });
  const record = []; for (let y = 1987; y <= 2021; y++) record.push({ year: y, earnings: WAGE_INDICES[y] });
  p.retirement = { socialSecurity: { a: { claimAge: 70, record, futureEarnings: "none" }, b: { claimAge: 62, monthlyAtFRA: 2000 } } };
  const d = compute(p, { today: "2026-09-16" });
  assert.equal(d.people.length, 2);
  assert.equal(d.people[0].source, "record"); assert.ok(d.people[0].monthly > 0); assert.equal(d.people[0].claimAge, 70);
  assert.equal(d.people[1].source, "typed"); near(d.people[1].monthly, 1400, 0.11, "62 with an FRA of 67 on 2,000");
  // Ana is 64 and 4 months (by month) and has not claimed: the ages still possible, from now (rounded up to the month) to 70 (round 4)
  assert.deepEqual(d.people[0].options.map((o) => Math.round(o.claimAge * 12)), [64 * 12 + 4, 65 * 12, 66 * 12, 67 * 12, 68 * 12, 69 * 12, 70 * 12]);
  assert.equal(d.hasData, true);
  const e = compute(emptyPlan(), { today: "2026-09-16" });
  assert.equal(e.hasData, false); assert.equal(e.householdYearly, 0);
});

test("decisions already made (round 4): getting it is a fact; past 62 the choice is from now to 70, answered", async () => {
  const p = emptyPlan();
  p.household.people.push({ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1957-06-20" });
  p.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 2100, period: "monthly" }];
  p.retirement = { socialSecurity: { r: { claimAge: 66, monthlyAtFRA: 2100 }, s: { claimAge: 70, monthlyAtFRA: 2400 } } };
  const T = "2026-11-02";
  const [ruth, sam] = compute(p, { today: T }).people;
  assert.equal(ruth.claimed, true); assert.equal(ruth.claimedYear, 2016); assert.equal(ruth.wait, null);
  assert.equal(sam.claimed, false);
  assert.deepEqual(sam.options.map((o) => Math.round(o.claimAge * 12)), [69 * 12 + 5, 70 * 12], "now (69 and 5 months) or 70");
  // claim now against 70 (SSA: 2/3 of 1% a month after full retirement age, FRA 66 and 6 months for 1957)
  assert.equal(sam.wait.at70, "2027-06"); assert.equal(sam.wait.at70Monthly, sam.options[1].monthly); assert.equal(sam.wait.nowMonthly, sam.options[0].monthly);
  const t = sam.wait.breakEven;
  assert.ok(Math.abs(sam.wait.nowMonthly * (t - sam.wait.nowAge) - sam.wait.at70Monthly * (t - 70)) < sam.wait.at70Monthly * 0.1, "the sums are equal at the break-even age");
  // setup's "I already get it" counts as claimed too; a claim age on file that has passed is flagged
  const q = structuredClone(p); q.income = []; q.guide = { setup: { ss: { r: "getting" } } }; q.retirement.socialSecurity.s.claimAge = 67;
  const [r2, s2] = compute(q, { today: T }).people;
  assert.equal(r2.claimed, true); assert.equal(s2.pastClaimAge, true);
});

test("review 2026-11-02: claimed only while paid; a benefit started before the claim age is 'now'; no past-age warning without figures", async () => {
  const { compute, fraFromMonthly, claimFactor } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-02";
  const base = () => { const p = emptyPlan(); p.household.people = [{ id: "pat", name: "Pat", role: "self", birthDate: "1976-04-10", retirementAge: 67 }]; return p; };
  // 50 and on disability benefits ("I get it now" in setup, saved at 62): getting it now, not "since 2038"
  const dis = base(); dis.guide = { setup: { ss: { pat: "getting" } } }; dis.retirement.socialSecurity = { pat: { claimAge: 62, monthlyAtFRA: 2142.9 } };
  const a = compute(dis, { today: T }).people[0];
  assert.equal(a.claimed, true); assert.equal(a.startedEarly, true); assert.equal(a.claimedYear, null);
  // Social Security typed on Income with a start date to come, as a one-off or ended: not claimed
  for (const line of [{ startDate: "2030-01-01", period: "monthly" }, { period: "once" }, { endDate: "2025-12-31", period: "monthly" }]) {
    const q = base(); q.household.people[0].birthDate = "1963-05-01";
    q.income = [{ id: "s", name: "Pat's Social Security", type: "social", personId: "pat", amount: 1800, ...line }];
    assert.equal(compute(q, { today: T }).people[0].claimed, false, JSON.stringify(line));
  }
  // past 62 with a claim age on file but no figures, or "won't get it": no "has passed" warning
  const none = base(); none.household.people[0].birthDate = "1957-01-01"; none.retirement.socialSecurity = { pat: { claimAge: 67 } };
  assert.equal(compute(none, { today: T }).people[0].pastClaimAge, false);
  none.retirement.socialSecurity.pat.monthlyAtFRA = 2000;
  assert.equal(compute(none, { today: T }).people[0].pastClaimAge, true, "with a figure, a claim age gone by is said");
  // 76, never claimed, 70 on file: up to date
  const old = base(); old.household.people[0].birthDate = "1950-03-10"; old.retirement.socialSecurity = { pat: { claimAge: 70, monthlyAtFRA: 2000 } };
  assert.equal(compute(old, { today: T }).people[0].pastClaimAge, false);
  // what arrives now, back to the full-age amount, to the dime
  assert.equal(fraFromMonthly(1950, 66, 2100), Math.round((2100 / claimFactor(1950, 66)) * 10) / 10);
});

test("review 2026-11-02 (round 5): an early claim from 62 is reduced; 70 or over and not claimed is valued at 70", async () => {
  const { compute, claimFactor, fraFromMonthly, floorDime } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-02";
  // Ruth is 64 and 6 months, gets $1,500 a month (Income), and the statement's $2,100 at 67 is still on the page
  const ruth = () => { const p = emptyPlan(); p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1962-05-10" }]; p.retirement.socialSecurity = { r: { monthlyAtFRA: 2100 } }; return p; };
  const paid = ruth(); paid.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1500, period: "monthly" }];
  const a = compute(paid, { today: T }).people[0];
  assert.equal(a.claimed, true); assert.equal(a.startedEarly, true, "paid before the claim age on file: 'now'"); assert.equal(a.claimedYear, null);
  assert.equal(a.monthly, 1500, "what arrives, not the unreduced $2,100 at 67"); assert.equal(a.yearly, 18000);
  assert.equal(Math.round(a.claimAge * 12), 64 * 12 + 6, "valued at today's age"); assert.equal(a.pia, 2100, "the full-age amount stays the statement's (second pass)");
  assert.equal(a.claimAgeOnFile, 67); assert.equal(a.reducedEarly, true);
  // paid every two weeks: the yearly amount over 12
  const bi = ruth(); bi.income = [{ id: "i", name: "SS", type: "social", personId: "r", amount: 700, period: "biweekly" }];
  near(compute(bi, { today: T }).people[0].monthly, 700 * 26 / 12, 1e-9);
  // "I already get it" with no Income line: the full-age figure reduced for today's age (5/9 of 1% for 30 months early)
  const got = ruth(); got.guide = { setup: { ss: { r: "getting" } } };
  const b = compute(got, { today: T }).people[0];
  assert.equal(b.startedEarly, true); assert.equal(b.monthly, floorDime(2100 * (1 - 30 * (5 / 9) / 100)));
  // a claim age saved at today's age (as an earlier Save did) reads as a claim made now
  got.retirement.socialSecurity.r = { claimAge: b.claimAge, monthlyAtFRA: fraFromMonthly(1962, b.claimAge, 1500) };
  const b2 = compute(got, { today: T }).people[0];
  assert.ok(Math.abs(b2.monthly - 1500) < 0.11); assert.equal(b2.startedEarly, false);
  // before 62 it is a disability or survivor benefit: unreduced, as before
  const dis = ruth(); dis.household.people[0].birthDate = "1971-03-15"; dis.guide = { setup: { ss: { r: "getting" } } }; dis.retirement.socialSecurity = { r: { claimAge: 67, monthlyAtFRA: 1800 } };
  const c = compute(dis, { today: T }).people[0];
  assert.equal(c.startedEarly, true); assert.equal(c.monthly, 1800); assert.equal(c.claimAge, 67);

  // Sam is 76 and never claimed. With no claim age saved, 70 (the only age still open), not his full retirement age:
  // the status, "can claim now" and the projection all say what claiming now pays
  const sam = emptyPlan(); sam.household.people = [{ id: "s", name: "Sam", role: "self", birthDate: "1950-06-20" }];
  sam.retirement.socialSecurity = { s: { monthlyAtFRA: 2100 } };
  const e = compute(sam, { today: T }).people[0];
  assert.equal(e.claimed, false); assert.equal(e.claimAge, 70); assert.equal(e.pastClaimAge, false);
  assert.equal(e.monthly, floorDime(2100 * claimFactor(1950, 70))); assert.equal(e.monthly, e.options[0].monthly, "the status and 'can claim now' agree");
  // a saved 66 is kept, as a saved age is under 70 (the SSA answer key checks every saved age to the dime), and flagged
  sam.retirement.socialSecurity.s.claimAge = 66;
  const d = compute(sam, { today: T }).people[0];
  assert.equal(d.claimAge, 66); assert.equal(d.monthly, 2100); assert.equal(d.pastClaimAge, true);
  delete sam.retirement.socialSecurity.s.claimAge;
  // the projection counts it from now at that amount
  const { buildInputs } = await import("../projection/compute.js");
  sam.accounts = [{ id: "a", name: "Savings", type: "savings", balance: 1000, history: [] }]; sam.retirement.spendingMonthly = 3000;
  const inc = buildInputs(sam, { today: T }).inputs.incomes.filter((x) => x.kind === "social");
  assert.equal(inc.length, 1); near(inc[0].yearly, e.yearly, 1e-6); assert.equal(inc[0].startAge, 70);
});

test("review 2026-11-02 (round 5): what an already-paid person types wins once the record is set aside (the view saves record: [])", async () => {
  const { compute, fraFromMonthly } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-02";
  const p = emptyPlan(); p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }];
  p.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1700, period: "monthly" }];
  const record = []; for (let y = 1972; y <= 2012; y++) record.push({ year: y, earnings: Math.round(9000 * Math.pow(1.05, y - 1972)) });
  p.retirement.socialSecurity = { r: { claimAge: 66, record, monthlyAtFRA: fraFromMonthly(1950, 66, 1700) } };
  assert.equal(compute(p, { today: T }).people[0].source, "record", "with a record, the record decides");
  p.retirement.socialSecurity.r.record = [];
  const r = compute(p, { today: T }).people[0];
  assert.equal(r.source, "typed"); assert.ok(Math.abs(r.monthly - 1700) < 0.11);
});

test("review 2026-11-02 (round 5, second pass): the full-age amount comes from its source; the Income line says only what arrives now", async () => {
  const { compute, floorDime, claimFactor, EARLY_TOLERANCE } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { survivorInputs } = await import("../../scenarios/stress-tests/compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const T = "2026-11-02";
  // Ruth, 64 and 6 months, claimed early: $1,500 on Income, the statement's $2,100 at full age; Sam, 60, $900 of his own at 67
  const couple = () => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1962-05-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-20" }];
    p.retirement.socialSecurity = { r: { monthlyAtFRA: 2100 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    p.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1500, period: "monthly" }];
    return p;
  };
  const d = compute(couple(), { today: T });
  const [ruth, sam] = d.people;
  assert.equal(ruth.monthly, 1500); assert.equal(ruth.pia, 2100); assert.equal(ruth.reducedEarly, true);
  // the widow(er)'s limit: at least 82.5% of the full-age amount, and the spouse's top-up on it (half of 2,100 less 900)
  assert.equal(ruth.survivor, floorDime(2100 * 0.825)); assert.equal(d.couple.survivorMonthly.s, floorDime(2100 * 0.825));
  assert.equal(d.couple.spousal.s, 150); assert.equal(sam.pia, 900);
  // the stress test "if Ruth died" works from the same full-age amount (before: worked back from $1,500, so $1,500)
  const sv = survivorInputs({ ...couple(), accounts: [{ id: "a", name: "Savings", type: "savings", balance: 1000, history: [] }], retirement: { ...couple().retirement, spendingMonthly: 3000 } }, "r", { today: T });
  assert.ok(sv.inputs.incomes.some((x) => x.kind === "social" && Math.abs(x.yearly - floorDime(2100 * 0.825) * 12) < 1), JSON.stringify(sv.inputs.incomes));

  // Ana is 62 and 8 months, on disability benefits set up at 61 (claim age 67 and $1,800 saved), $1,800 on Income: unreduced
  const ana = () => {
    const p = couple(); p.household.people[0] = { id: "r", name: "Ana", role: "self", birthDate: "1964-03-10" };
    p.guide = { setup: { ss: { r: "getting" } } }; p.retirement.socialSecurity.r = { claimAge: 67, monthlyAtFRA: 1800 };
    p.income = [{ id: "setup-ss-r", name: "Ana's Social Security", type: "social", personId: "r", amount: 1800, period: "monthly" }];
    return p;
  };
  const a = compute(ana(), { today: T });
  assert.equal(a.people[0].startedEarly, true); assert.equal(a.people[0].reducedEarly, false);
  assert.equal(a.people[0].monthly, 1800); assert.equal(a.people[0].pia, 1800); assert.equal(a.people[0].claimAge, 67);
  assert.equal(a.people[0].survivor, 1800); assert.equal(a.couple.survivorMonthly.s, 1800); assert.equal(a.couple.spousal.s, 0, "half of 1,800 is no more than Sam's own 900");
  // a cost-of-living rise on Income (more than the full figure), or a dollar or two under it, is still the full amount
  for (const amount of [1850, 1800 * (1 - EARLY_TOLERANCE) + 0.5]) {
    const q = ana(); q.income[0].amount = amount;
    const x = compute(q, { today: T }).people[0];
    assert.equal(x.reducedEarly, false, String(amount)); assert.equal(x.monthly, amount); assert.equal(x.pia, 1800);
  }
  // clearly less (1% under): a reduced early claim, valued at today's age
  const less = ana(); less.income[0].amount = 1782;
  const l = compute(less, { today: T }).people[0];
  assert.equal(l.reducedEarly, true); assert.equal(Math.round(l.claimAge * 12), 62 * 12 + 8); assert.equal(l.monthly, 1782); assert.equal(l.pia, 1800);
  // no Income line: unreduced only when setup marked it a disability benefit (third pass: a saved claim age is no longer
  // taken as that mark; without it, a reduced claim at today's age, below)
  const noLine = ana(); noLine.income = []; noLine.retirement.socialSecurity.r.paidUnreduced = true;
  const n = compute(noLine, { today: T });
  assert.equal(n.people[0].monthly, 1800); assert.equal(n.people[0].claimAge, 67); assert.equal(n.people[0].reducedEarly, false);
  const proj = buildInputs({ ...noLine, accounts: [{ id: "a", name: "Savings", type: "savings", balance: 1000, history: [] }], retirement: { ...noLine.retirement, spendingMonthly: 3000 } }, { today: T }).inputs.incomes.find((x) => x.kind === "social" && /Ana/.test(x.name));
  assert.equal(proj.yearly, 1800 * 12); assert.equal(proj.startAge, 62);
  // ...without the mark it is valued at today's age, with the claim age saved or not
  delete noLine.retirement.socialSecurity.r.paidUnreduced;
  assert.equal(compute(noLine, { today: T }).people[0].monthly, floorDime(1800 * claimFactor(1964, 62 + 8 / 12)));
  delete noLine.retirement.socialSecurity.r.claimAge;
  assert.equal(compute(noLine, { today: T }).people[0].monthly, floorDime(1800 * claimFactor(1964, 62 + 8 / 12)));
});

test("review 2026-11-02 (round 5, second pass): Save with nothing changed changes nothing; a new amount goes on the paying Income line", async () => {
  const { compute, saveFigures, parseRecord, fraFromMonthly } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-02";
  // what the page's form holds on first look (the amount box shows what is counted, the record box the record)
  const form = (person, typed) => ({ claimAge: person.claimAge, record: parseRecord((person.record ?? []).map((r) => `${r.year}\t${r.earnings}`).join("\n")), typed: typed ?? Math.round(person.monthly * 100) / 100, futureEarnings: person.futureEarnings });
  const record = []; for (let y = 1984; y <= 2024; y++) record.push({ year: y, earnings: Math.round(30000 * Math.pow(1.04, y - 1984)) });
  const early = (ss) => { const p = emptyPlan(); p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1962-05-10", retirementAge: 62 }]; p.retirement.socialSecurity = { r: ss }; p.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1500, period: "monthly" }]; return p; };
  for (const ss of [{ record, futureEarnings: "same" }, { monthlyAtFRA: 2100 }]) {
    const p = early(ss); const r = compute(p, { today: T }).people[0];
    assert.equal(r.startedEarly, true); assert.equal(r.monthly, 1500);
    // nothing changed: nothing to store (before, Save wrote claimAge 64.5 and $1,800 at full age, and the claim read as made today)
    const same = saveFigures(r, ss, form(r));
    assert.equal(same.changed, false); assert.deepEqual(same.entry, ss); assert.equal(same.line, null); assert.equal(same.addLine, null);
    // a different amount: the Income line that pays it, and nothing else
    const more = saveFigures(r, ss, form(r, 1550));
    assert.equal(more.changed, true); assert.deepEqual(more.line, { id: "i", amount: 1550 }); assert.deepEqual(more.entry, ss); assert.equal(more.recordRemoved, false);
    p.income[0].amount = 1550;
    const after = compute(p, { today: T }).people[0];
    assert.equal(after.monthly, 1550); assert.equal(after.startedEarly, true); assert.equal(after.claimedYear, null); assert.equal(after.pia, r.pia, "the full-age amount stays");
  }
  // paid before the claim age on file with no Income line: setup's own line is added
  const got = early({ monthlyAtFRA: 2100 }); got.income = []; got.guide = { setup: { ss: { r: "getting" } } };
  const g = compute(got, { today: T }).people[0];
  assert.equal(saveFigures(g, got.retirement.socialSecurity.r, form(g)).changed, false);
  const add = saveFigures(g, got.retirement.socialSecurity.r, form(g, 1500));
  assert.equal(add.addLine, 1500); assert.equal(add.line, null); assert.deepEqual(add.entry, { monthlyAtFRA: 2100 });
  // ...and with no figure at all, what arrives is also worked back to a full-age amount, the claim age left unsaved
  const bare = early({}); bare.income = []; bare.guide = { setup: { ss: { r: "getting" } } };
  const b = compute(bare, { today: T }).people[0];
  const fill = saveFigures(b, {}, form(b, 1500));
  assert.equal(fill.addLine, 1500); assert.equal(fill.entry.monthlyAtFRA, fraFromMonthly(1962, 64.5, 1500)); assert.equal(fill.entry.claimAge, undefined);

  // paid since the claim age on file (Ruth, 76, claimed at 66) with an earnings record: a corrected amount sets the record aside
  const old = emptyPlan(); old.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }];
  const rec2 = []; for (let y = 1972; y <= 2012; y++) rec2.push({ year: y, earnings: Math.round(9000 * Math.pow(1.05, y - 1972)) });
  old.retirement.socialSecurity = { r: { claimAge: 66, record: rec2, futureEarnings: "none" } };
  old.income = [{ id: "setup-ss-r", name: "Ruth's Social Security", type: "social", personId: "r", amount: 2482.2, period: "monthly" }];
  const o = compute(old, { today: T }).people[0];
  assert.equal(o.startedEarly, false); assert.equal(o.source, "record");
  assert.equal(saveFigures(o, old.retirement.socialSecurity.r, form(o)).changed, false);
  const fix = saveFigures(o, old.retirement.socialSecurity.r, form(o, 1700));
  assert.equal(fix.recordRemoved, true); assert.deepEqual(fix.entry.record, []); assert.equal(fix.entry.claimAge, 66);
  assert.equal(fix.entry.monthlyAtFRA, fraFromMonthly(1950, 66, 1700)); assert.deepEqual(fix.line, { id: "setup-ss-r", amount: 1700 });
  // the record pasted back with the amount left as it was is saved, and decides again
  const typedOnly = { claimAge: 66, record: [], futureEarnings: "none", monthlyAtFRA: fix.entry.monthlyAtFRA };
  old.retirement.socialSecurity.r = typedOnly; old.income[0].amount = 1700;
  const t = compute(old, { today: T }).people[0];
  const back = saveFigures(t, typedOnly, { ...form(t), record: rec2 });
  assert.equal(back.recordRemoved, false); assert.equal(back.entry.record.length, rec2.length);

  // not claimed: what the form holds, as before; the same form again changes nothing
  const plan = emptyPlan(); plan.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1980-01-15" }];
  const a = compute(plan, { today: T }).people[0];
  const s1 = saveFigures(a, {}, { claimAge: 67, record: [], typed: 2400, futureEarnings: "same" });
  assert.equal(s1.changed, true); assert.deepEqual(s1.entry, { claimAge: 67, monthlyAtFRA: 2400 });
  assert.equal(saveFigures(a, s1.entry, { claimAge: 67, record: [], typed: 2400, futureEarnings: "same" }).changed, false);
});

// ---- third pass (review 2026-11-02, round 5): a benefit already paid, the mark setup writes, Save, the survivor's words
test("review 2026-11-02 (round 5, third pass): a benefit already paid is never valued with delayed credits; with no Income line and no mark it is a claim made today", async () => {
  const { compute, floorDime, claimFactor } = await import("./compute.js");
  const { applyAges } = await import("../../overview/setup/compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const T = "2026-11-02";
  // Ruth, 64 and 6 months, saved her statement here before she claimed, then told Get started "I already get it" with
  // the amount left blank: no Income line, no mark (she is past 62)
  const ruth = (ss) => {
    const p = emptyPlan(); p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1962-05-15" }];
    p.retirement.socialSecurity = { r: ss }; p.accounts = [{ id: "a", name: "Savings", type: "savings", balance: 1000, history: [] }]; p.retirement.spendingMonthly = 3000;
    applyAges(p, { people: { r: { year: 1962, month: 5, stopAge: 64, retired: true, ss: { mode: "getting", amount: "", started: "" } } } }, T);
    return p;
  };
  const p70 = ruth({ claimAge: 70, record: [], monthlyAtFRA: 2400, futureEarnings: "same" });
  assert.equal(p70.income.length, 0); assert.equal(p70.retirement.socialSecurity.r.paidUnreduced, undefined);
  const r = compute(p70, { today: T }).people[0];
  assert.equal(r.claimed, true); assert.equal(r.startedEarly, true); assert.equal(r.reducedEarly, true);
  assert.equal(Math.round(r.claimAge * 12), 64 * 12 + 6, "claimed at today's age, not the saved 70");
  assert.equal(r.monthly, floorDime(2400 * claimFactor(1962, 64.5))); assert.equal(r.monthly, 2000, "second pass: $2,976, the saved 70's amount from today");
  const proj = buildInputs(p70, { today: T }).inputs.incomes.find((x) => x.kind === "social");
  assert.equal(proj.yearly, 2000 * 12); assert.equal(proj.startAge, 64);
  // with the default claim age (67) and $2,100: $1,750 (second pass: $2,100, unreduced on the saved age alone)
  const p67 = compute(ruth({ claimAge: 67, record: [], monthlyAtFRA: 2100, futureEarnings: "same" }), { today: T }).people[0];
  assert.equal(p67.monthly, 1750); assert.equal(p67.reducedEarly, true);
  // marked as a disability benefit: the full-age amount, and still not the saved 70's delayed credits
  const m = compute(ruth({ claimAge: 70, monthlyAtFRA: 2400, paidUnreduced: true }), { today: T }).people[0];
  assert.equal(m.monthly, 2400); assert.equal(m.reducedEarly, false); assert.equal(m.claimAge, 67); assert.equal(m.startedEarly, true);
  // past full retirement age (Sam, 68 and 8 months; 66 and 8 months is his full age) with 70 saved: the full-age amount
  const sam = emptyPlan(); sam.household.people = [{ id: "s", name: "Sam", role: "self", birthDate: "1958-03-15" }];
  sam.retirement.socialSecurity = { s: { claimAge: 70, monthlyAtFRA: 2000 } }; sam.guide = { setup: { ss: { s: "getting" } } };
  const s = compute(sam, { today: T }).people[0];
  assert.equal(s.startedEarly, true); assert.equal(s.monthly, 2000, "second pass: $2,533.30 with 40 months of delayed credits"); assert.equal(s.reducedEarly, false);
  // before 62 only a disability or survivor benefit can be paid: unreduced, at the full-age amount, not at the saved 70
  const dee = emptyPlan(); dee.household.people = [{ id: "d", name: "Dee", role: "self", birthDate: "1970-01-15" }];
  dee.retirement.socialSecurity = { d: { claimAge: 70, monthlyAtFRA: 1500 } }; dee.guide = { setup: { ss: { d: "getting" } } };
  const de = compute(dee, { today: T }).people[0];
  assert.equal(de.monthly, 1500, "second pass: $1,860"); assert.equal(de.claimAge, 67); assert.equal(de.reducedEarly, false);
});

test("review 2026-11-02 (round 5, third pass): Get started's 'I get it now' before 62 marks the entry paidUnreduced; any other answer takes it off", async () => {
  const { compute } = await import("./compute.js");
  const { applyAges } = await import("../../overview/setup/compute.js");
  const T = "2026-11-02";
  const dee = (ss = null) => { const p = emptyPlan(); p.household.people = [{ id: "d", name: "Dee", role: "self", birthDate: "1968-06-15" }]; p.retirement.socialSecurity = ss ? { d: ss } : {}; return p; };
  const ask = (p, ss) => applyAges(p, { people: { d: { year: 1968, month: 6, stopAge: 58, retired: true, ss } } }, T);
  const p = dee(); ask(p, { mode: "getting", amount: 1500 });
  assert.deepEqual(p.retirement.socialSecurity.d, { claimAge: 67, monthlyAtFRA: 1500, paidUnreduced: true });
  assert.equal(p.income.find((x) => x.id === "setup-ss-d").amount, 1500);
  // the mark carries the benefit unreduced past 62 even with the Income line gone
  const gone = JSON.parse(JSON.stringify(p)); gone.income = [];
  const later = compute(gone, { today: "2031-03-02" }).people[0];
  assert.equal(later.monthly, 1500); assert.equal(later.reducedEarly, false);
  // no amount yet: the mark alone; a pasted record keeps its record and gets the mark
  const blank = dee(); ask(blank, { mode: "getting", amount: "" }); assert.deepEqual(blank.retirement.socialSecurity.d, { paidUnreduced: true });
  const rec = [{ year: 2000, earnings: 40000 }];
  const withRec = dee({ record: rec }); ask(withRec, { mode: "getting", amount: 1500 });
  assert.deepEqual(withRec.retirement.socialSecurity.d, { record: rec, paidUnreduced: true });
  // another answer takes the mark off
  ask(p, { mode: "statement", amount: 1500 });
  assert.equal(p.retirement.socialSecurity.d.paidUnreduced, undefined); assert.equal(p.retirement.socialSecurity.d.monthlyAtFRA, 1500);
});

test("review 2026-11-02 (round 5, third pass): going through Get started's ages again with what it shows keeps a disability benefit as it is", async () => {
  const { compute, claimFactor } = await import("./compute.js");
  const { applyAges, valuesFor } = await import("../../overview/setup/compute.js");
  const T = "2026-11-02";
  // Ana, 62 and 8 months, on a disability benefit since before 62: $1,800 at full age, 67 on file, $1,800 on Income; Sam $900
  const ana = (extra = {}) => {
    const p = emptyPlan();
    p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1964-03-15" }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-15" }];
    p.retirement.socialSecurity = { a: { claimAge: 67, monthlyAtFRA: 1800, ...extra }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    p.income = [{ id: "setup-ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: 1800, period: "monthly", startDate: "", endDate: "" }];
    p.guide = { setup: { ss: { a: "getting", s: "statement" } } };
    return p;
  };
  const again = (p, started, amount = 1800) => applyAges(p, { people: { a: { year: 1964, month: 3, stopAge: 55, retired: true, ss: { mode: "getting", amount, started } }, s: { year: 1966, month: 6, stopAge: 67, ss: { mode: "statement", amount: 900 } } } }, T);
  assert.equal(valuesFor(ana(), "ages", T).people.a.ss.started, 67, "the screen starts from the age on file");
  // 67 as given back, or 62 as the screen's stepper holds it (62 to today's age): the entry stays (before: claim age 62
  // and $2,571.40 at full age, a $2,121 survivor figure and a $386 top-up for Sam)
  for (const started of [67, 62]) {
    const p = ana(); again(p, started);
    assert.deepEqual(p.retirement.socialSecurity.a, { claimAge: 67, monthlyAtFRA: 1800 }, String(started));
    const d = compute(p, { today: T });
    assert.equal(d.people[0].monthly, 1800); assert.equal(d.couple.survivorMonthly.s, 1800); assert.equal(d.couple.spousal.s, 0);
  }
  // a new amount on a marked benefit (a cost-of-living rise) is its new full-age amount; the mark stays
  const cola = ana({ paidUnreduced: true }); again(cola, 62, 1850);
  assert.deepEqual(cola.retirement.socialSecurity.a, { claimAge: 67, monthlyAtFRA: 1850, paidUnreduced: true });
  assert.equal(compute(cola, { today: T }).people[0].monthly, 1850);
  // a different age where one can be chosen is a retirement claim from that age: the mark comes off (Bea, 64)
  const bea = emptyPlan(); bea.household.people = [{ id: "b", name: "Bea", role: "self", birthDate: "1962-09-15" }];
  bea.retirement.socialSecurity = { b: { claimAge: 67, monthlyAtFRA: 1800, paidUnreduced: true } }; bea.guide = { setup: { ss: { b: "getting" } } };
  bea.income = [{ id: "setup-ss-b", name: "Bea's Social Security", type: "social", personId: "b", amount: 1800, period: "monthly", startDate: "", endDate: "" }];
  applyAges(bea, { people: { b: { year: 1962, month: 9, stopAge: 64, retired: true, ss: { mode: "getting", amount: 1500, started: 63 } } } }, T);
  assert.deepEqual(bea.retirement.socialSecurity.b, { claimAge: 63, monthlyAtFRA: Math.round((1500 / claimFactor(1962, 63)) * 10) / 10 });
});

test("review 2026-11-02 (round 5, third pass): a record pasted and an amount typed in the same Save: the amount wins and the record is set aside", async () => {
  const { compute, saveFigures, fraFromMonthly } = await import("./compute.js");
  const T = "2026-11-02";
  // Ruth, 76, paid since 66 on a typed figure ($1,500 on Income); she pastes a record and types $1,700
  const plan = () => {
    const p = emptyPlan(); p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }];
    p.retirement.socialSecurity = { r: { claimAge: 66, record: [], monthlyAtFRA: 1500, futureEarnings: "none" } };
    p.income = [{ id: "setup-ss-r", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1500, period: "monthly" }];
    return p;
  };
  const rec = []; for (let y = 1972; y <= 2012; y++) rec.push({ year: y, earnings: Math.round(9000 * Math.pow(1.05, y - 1972)) });
  const p = plan(); const r = compute(p, { today: T }).people[0];
  assert.equal(r.source, "typed"); assert.equal(r.startedEarly, false); assert.equal(r.monthly, 1500);
  const s = saveFigures(r, p.retirement.socialSecurity.r, { claimAge: 66, record: rec, typed: 1700, futureEarnings: "none" });
  assert.equal(s.recordPasted, true); assert.equal(s.recordRemoved, false); assert.deepEqual(s.entry.record, []);
  assert.equal(s.entry.monthlyAtFRA, fraFromMonthly(1950, 66, 1700)); assert.deepEqual(s.line, { id: "setup-ss-r", amount: 1700 });
  // what the plan then counts is the $1,700 that Income says too (before: the pasted record decided, about $2,527)
  p.retirement.socialSecurity.r = s.entry; p.income[0].amount = s.line.amount;
  const after = compute(p, { today: T }).people[0];
  assert.equal(after.source, "typed"); assert.ok(Math.abs(after.monthly - 1700) < 0.11, String(after.monthly));
  // pasted with the amount left as shown: the record is kept and decides
  const q = plan(); const qr = compute(q, { today: T }).people[0];
  const keep = saveFigures(qr, q.retirement.socialSecurity.r, { claimAge: 66, record: rec, typed: 1500, futureEarnings: "none" });
  assert.equal(keep.recordPasted, false); assert.equal(keep.entry.record.length, rec.length);
});

test("review 2026-11-02 (round 5, third pass): a survivor's figure larger than what the other gets says so, and why", async () => {
  const { compute, survivorWords } = await import("./compute.js");
  const { money } = await import("../../../core/format.js");
  const T = "2026-11-02";
  const usd = (n) => money(n, "USD");
  // Ruth, 64 and 6 months, gets $1,500 (an early claim; $2,100 at full age); Sam, 60, $900 of his own at 67
  const p = emptyPlan();
  p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1962-05-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-20" }];
  p.retirement.socialSecurity = { r: { monthlyAtFRA: 2100 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
  p.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1500, period: "monthly" }];
  const d = compute(p, { today: T }); const [ruth, sam] = d.people;
  assert.equal(survivorWords(sam, ruth, d.couple.survivorMonthly.s, usd),
    "If Ruth dies first, Sam would get a widow's or widower's benefit on Ruth's record: about $1,733 a month in place of Sam's own $900. That is more than the $1,500 Ruth gets now, because it is worked out from Ruth's full-age amount.");
  assert.equal(survivorWords(ruth, sam, d.couple.survivorMonthly.r, usd), "If Sam dies first, Ruth keeps their own $1,500 a month, and Sam's $900 stops.");
  // not claimed yet, planning 62: "would get at 62"
  p.household.people[0].birthDate = "1966-05-10"; p.retirement.socialSecurity.r = { claimAge: 62, monthlyAtFRA: 2100 }; p.income = [];
  const e = compute(p, { today: T });
  assert.match(survivorWords(e.people[1], e.people[0], e.couple.survivorMonthly.s, usd), /about \$1,733 a month in place of Sam's own \$900\. That is more than the \$1,470 Ruth would get at 62, because/);
  // the survivor's figure is the other's own benefit: the plain wording
  p.retirement.socialSecurity.r = { claimAge: 67, monthlyAtFRA: 2100 };
  const f = compute(p, { today: T });
  assert.equal(survivorWords(f.people[1], f.people[0], f.couple.survivorMonthly.s, usd), "If Ruth dies first, Sam keeps about $2,100 a month: Ruth's benefit in place of Sam's own $900.");
});

// ---- recheck 2026-11-05: what Income says counts for life; a spouse's top-up by SSA's own reduction, counted once
test("recheck 2026-11-05: a benefit already paid counts what its Income line says, also once the claim age on file has passed", async () => {
  const { compute, floorDime } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  // Ruth, born August 1960 (full retirement age 67): her $2,100 statement saved here with the page's 67, then "I already
  // get it" and $1,950 typed on this page (the line it adds); Sam, born June 1964, $900 of his own at 67
  const plan = (line = 1950) => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1960-08-15", retirementAge: 66 }, { id: "s", name: "Sam", role: "partner", birthDate: "1964-06-15", retirementAge: 67 }];
    p.accounts = [{ id: "a", name: "Savings", type: "savings", balance: 100000, history: [] }]; p.retirement.spendingMonthly = 3000;
    p.retirement.socialSecurity = { r: { claimAge: 67, record: [], monthlyAtFRA: 2100, futureEarnings: "same" }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    p.income = [{ id: "setup-ss-r", name: "Ruth's Social Security", type: "social", personId: "r", amount: line, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true }];
    p.guide = { setup: { ss: { r: "getting" } } };
    return p;
  };
  for (const today of ["2026-11-02", "2027-05-20", "2027-08-20", "2028-06-01"]) {
    const d = compute(plan(), { today }); const [ruth] = d.people;
    // before: $2,100 "since 67" from August 2027, and the projection counted $2,100 a month for life
    assert.equal(ruth.monthly, 1950, today); assert.equal(ruth.yearly, 1950 * 12, today);
    assert.equal(ruth.pia, 2100, `${today}: the full-age amount stays the statement's`);
    // $1,950 is less than the full-age amount, so it was not claimed at 67: "now", never "since 2027 (at 67)"
    assert.equal(ruth.startedEarly, true, today); assert.equal(ruth.claimedYear, null, today);
    // the widow(er)'s figure and the spouse's top-up do not move when the claim age on file goes by
    assert.equal(d.couple.survivorMonthly.s, 1950, today); assert.equal(d.couple.spousal.s, 150, today);
    const own = buildInputs(plan(), { today }).inputs.incomes.filter((x) => x.kind === "social" && x.personIndex === 0);
    assert.equal(own.length, 1, today); assert.equal(own[0].yearly, 1950 * 12, today);
    assert.ok(own[0].startAge <= Number(today.slice(0, 4)) - 1960, `${today}: counted from now`);
  }
  // an early claim of $1,500 (no claim age saved: full retirement age): the same $1,500 and the same 82.5% widow(er)'s
  // floor before and after full retirement age (before the fix: $2,100 "since 67" from August 2027, the floor gone)
  for (const today of ["2027-05-20", "2027-08-20", "2030-01-15"]) {
    const p = plan(1500); delete p.retirement.socialSecurity.r.claimAge; p.guide = {};
    const d = compute(p, { today });
    assert.equal(d.people[0].monthly, 1500, today); assert.equal(d.people[0].claimedYear, null, today);
    assert.equal(d.couple.survivorMonthly.s, floorDime(2100 * 0.825), today);
  }
  // a line that agrees with the claim age on file (62 pays $1,470; the line says $1,480 after a rise): "since 62", and
  // the page counts the $1,480 Income says, not the $1,470 the age gives
  const at62 = plan(1480); at62.retirement.socialSecurity.r.claimAge = 62;
  const s62 = compute(at62, { today: "2028-06-01" }).people[0];
  assert.equal(s62.startedEarly, false); assert.equal(s62.claimedYear, 2022); assert.equal(s62.monthly, 1480); assert.equal(s62.pia, 2100);
  // with an earnings record the record still gives the full-age amount; Income gives what arrives
  const rec = []; for (let y = 1984; y <= 2024; y++) rec.push({ year: y, earnings: Math.round(30000 * Math.pow(1.04, y - 1984)) });
  const withRec = plan(1950); withRec.retirement.socialSecurity.r = { claimAge: 67, record: rec, futureEarnings: "none" };
  const r2 = compute(withRec, { today: "2028-06-01" }).people[0];
  assert.equal(r2.source, "record"); assert.equal(r2.monthly, 1950); assert.equal(r2.pia, r2.estimate.pia);
});

test("recheck 2026-11-05: a line that is not a payment being received is not counted (the 'already gets it' rules)", async () => {
  const { compute, claimFactor, floorDime } = await import("./compute.js");
  const T = "2028-06-01";
  const ruth = (line) => {
    const p = emptyPlan(); p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1960-08-15" }];
    p.retirement.socialSecurity = { r: { claimAge: 67, monthlyAtFRA: 2100 } };
    p.income = line ? [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 1950, period: "monthly", startDate: "", endDate: "", ...line }] : [];
    return p;
  };
  // starting later, ended, or a one-off: not claimed, and the page counts the claim age's figure
  for (const line of [{ startDate: "2030-01-01" }, { endDate: "2027-12-31" }, { period: "once" }]) {
    const r = compute(ruth(line), { today: T }).people[0];
    assert.equal(r.claimed, false, JSON.stringify(line)); assert.equal(r.monthly, 2100, JSON.stringify(line));
  }
  // another person's line is not Ruth's
  const other = ruth({ personId: "someone-else" });
  assert.equal(compute(other, { today: T }).people[0].monthly, 2100);
  // "I already get it" with no line: the figure on file, as before
  const said = ruth(null); said.guide = { setup: { ss: { r: "getting" } } };
  assert.equal(compute(said, { today: T }).people[0].monthly, floorDime(2100 * claimFactor(1960, 67)));
});

test("recheck 2026-11-05: a spouse's top-up is reduced the SSA way (applied to the 50%) from the age it starts, never before the worker claims", async () => {
  const { compute, spousalEarlyFactor, spousalFactor } = await import("./compute.js");
  const near9 = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} != ${b}`);
  // SSA's tables (agereduction.html, oact/quickcalc/earlyretire.html): a $500 spouse's benefit is $325 at 62 for a full
  // age of 67 (35% less) and $350 for 66 (30% less); oact/quickcalc/spouse.html: 36 months early, $800 becomes $600
  near9(spousalEarlyFactor(1960, 62), 0.65, "born 1960 at 62"); near9(spousalEarlyFactor(1950, 62), 0.70, "born 1950 at 62");
  near9(spousalEarlyFactor(1960, 64), 0.75, "36 months early"); near9(spousalEarlyFactor(1960, 67), 1, "at full age"); near9(spousalEarlyFactor(1960, 70), 1, "no credits for waiting");
  near9(spousalEarlyFactor(1957, 62), 1 - 36 * (25 / 36) / 100 - 18 * (5 / 12) / 100, "born 1957: 54 months");
  // spousalAtSameAge keeps the answer key's own reading (tests/golden/retirement/ss-benefits.csv): see the README
  near9(spousalFactor(1960, 62), 0.15, "the key's 50% less 35 points");
  const T = "2026-11-02";
  // Ruth (born August 1960) $2,100 at full age; Sam (born June 1966) $900 of his own
  const plan = (rClaim, sClaim, extra = {}) => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1960-08-15", retirementAge: 66 }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-15", retirementAge: 62 }];
    p.accounts = [{ id: "a", name: "Savings", type: "savings", balance: 300000, history: [] }]; p.retirement.spendingMonthly = 4000;
    p.retirement.socialSecurity = { r: { claimAge: rClaim, monthlyAtFRA: 2100 }, s: { claimAge: sClaim, monthlyAtFRA: 900 } };
    Object.assign(p, extra);
    return p;
  };
  // Sam claims at 62 (June 2028), after Ruth's 67 (August 2027): $150 x 0.65 (before: $150 x 0.30 = $45)
  const a = compute(plan(67, 62), { today: T });
  assert.equal(a.couple.spousal.s, 97.5); assert.equal(a.couple.spousalCounted.s, 97.5); assert.equal(a.couple.spousalFromAge.s, 62);
  // Ruth waits to 70 (August 2030): Sam's top-up starts then, at 64 and 2 months (34 months early)
  const b = compute(plan(70, 62), { today: T });
  assert.equal(b.couple.spousal.s, Math.floor(150 * (1 - 34 * (25 / 36) / 100) * 10 + 1e-8) / 10); assert.equal(b.couple.spousalFromAge.s, 64);
  // Sam at full age: the whole $150, from his 67
  assert.equal(compute(plan(67, 67), { today: T }).couple.spousal.s, 150);
  // the hero's yearly figure and "you get together" are the same money: both people's own and the top-up
  for (const d of [a, b]) {
    assert.ok(Math.abs(d.householdYearly - 12 * d.couple.bothMonthly) < 1e-6);
    assert.ok(Math.abs(d.householdYearly - 12 * (d.people[0].monthly + d.people[1].monthly + d.couple.spousalCounted.s)) < 1e-6);
  }
});

test("recheck 2026-11-05: the top-up is counted only with the person's own figure, and not when the Income line already pays it", async () => {
  const { compute } = await import("./compute.js");
  const T = "2028-06-01";
  const plan = () => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1960-08-15" }, { id: "s", name: "Sam", role: "partner", birthDate: "1962-06-15" }];
    p.retirement.socialSecurity = { r: { claimAge: 67, monthlyAtFRA: 2100 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    return p;
  };
  // Sam has no figure of his own: the page can say what he could get, the plan does not count it
  const none = plan(); delete none.retirement.socialSecurity.s;
  const n = compute(none, { today: "2026-11-02" });
  assert.ok(n.couple.spousal.s > 0); assert.equal(n.couple.spousalCounted.s, 0);
  assert.equal(n.householdYearly, n.people[0].yearly);
  // Sam already paid by an Income line and Ruth already claimed: the line is what arrives, the top-up in it
  const paid = plan(); paid.income = [{ id: "i", name: "Sam's Social Security", type: "social", personId: "s", amount: 1050, period: "monthly" }, { id: "j", name: "Ruth's Social Security", type: "social", personId: "r", amount: 2100, period: "monthly" }];
  const p = compute(paid, { today: T });
  assert.equal(p.people[1].monthly, 1050); assert.equal(p.couple.spousalCounted.s, 0); assert.equal(p.householdYearly, (1050 + 2100) * 12);
  // ...while Ruth has not claimed yet, it comes on top once she does
  paid.income = paid.income.slice(0, 1); paid.retirement.socialSecurity.r.claimAge = 70;
  const q = compute(paid, { today: T });
  assert.equal(q.couple.spousalCounted.s, 150); assert.equal(q.couple.spousalFromAge.s, 68, "Ruth claims at 70, in 2030, when Sam is 68");
});

test("verify 2026-11-05: no spouse's benefit for a partner Get started was told is not a spouse (SSA pays it to a husband or wife)", async () => {
  const { compute, spousalWords, heroTopUpWords } = await import("./compute.js");
  const { compute: projection } = await import("../projection/compute.js");
  const plan = (relation) => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1966-03-10", retirementAge: 67 }, { id: "s", name: "Sam", role: "partner", relation, birthDate: "1966-06-15", retirementAge: 67 }];
    p.household.filingStatus = relation === "spouse" ? "married_joint" : "single";
    p.accounts = [{ id: "a", name: "S", type: "savings", balance: 300000, history: [] }]; p.retirement.spendingMonthly = 4000;
    p.retirement.socialSecurity = { r: { claimAge: 67, monthlyAtFRA: 2100 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    return p;
  };
  const T = "2026-11-05", usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const wed = compute(plan("spouse"), { today: T });
  assert.equal(wed.couple.spousalCounted.s, 150); assert.equal(wed.householdYearly, (2100 + 900 + 150) * 12);
  const un = compute(plan("partner"), { today: T });
  assert.equal(un.couple.spousal.s, 0); assert.equal(un.couple.spousalCounted.s, 0);
  assert.equal(un.householdYearly, (2100 + 900) * 12); assert.equal(un.couple.bothMonthly, 3000);
  assert.equal(heroTopUpWords(un, usd), ""); assert.equal(spousalWords(un.people[1], un.people[0], un, usd), "");
  const soc = projection(plan("partner"), { today: T }).inputs.incomes.filter((x) => x.kind === "social").map((x) => x.name);
  assert.deepEqual(soc, ["Ruth's Social Security", "Sam's Social Security"]);
});

test("recheck 2026-11-05: the page's words for the top-up and the hero say the same money", async () => {
  const { compute, spousalWords, heroTopUpWords } = await import("./compute.js");
  const { money } = await import("../../../core/format.js");
  const usd = (n) => money(n, "USD");
  const T = "2026-11-02";
  const p = emptyPlan();
  p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1960-08-15" }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-15" }];
  p.retirement.socialSecurity = { r: { claimAge: 67, monthlyAtFRA: 2100 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
  const d = compute(p, { today: T }); const [ruth, sam] = d.people;
  assert.equal(heroTopUpWords(d, usd), "The $37,800 a year includes about $150 a month Sam gets on Ruth's record (a spouse's benefit) from 2033.");
  assert.equal(spousalWords(sam, ruth, d, usd), "On Ruth's record, Sam also gets about $150 a month more (a spouse's benefit) from 2033, once both have claimed. The plan counts it.");
  assert.equal(spousalWords(ruth, sam, d, usd), "");
  // no figure of Sam's own: what he could get, and that it is not counted
  delete p.retirement.socialSecurity.s;
  const e = compute(p, { today: T });
  assert.equal(heroTopUpWords(e, usd), "");
  assert.match(spousalWords(e.people[1], e.people[0], e, usd), /^On Ruth's record, Sam could get up to about \$1,050 a month \(a spouse's benefit\) once both have claimed\. The plan does not count it until Sam's own figure is added below\.$/);
  // already in Sam's Income line
  p.retirement.socialSecurity.s = { claimAge: 67, monthlyAtFRA: 900 };
  p.household.people[1].birthDate = "1958-06-15";
  p.income = [{ id: "i", name: "Sam's Social Security", type: "social", personId: "s", amount: 1050, period: "monthly" }, { id: "j", name: "Ruth's Social Security", type: "social", personId: "r", amount: 2100, period: "monthly" }];
  const f = compute(p, { today: T });
  assert.equal(spousalWords(f.people[1], f.people[0], f, usd), "Any spouse's benefit Sam gets on Ruth's record is paid with Sam's own, so the $1,050 a month on the Income page already holds it.");
});

test("recheck 2026-11-05: a new amount saved here for a benefit paid unreduced is its new full-age amount, as Get started takes it", async () => {
  const { compute, saveFigures } = await import("./compute.js");
  const T = "2026-11-02";
  // Ana, 62 and 8 months, disability benefit: $1,800 at 67 on file, $1,800 on Income; Sam $900 at 67. Her yearly letter says $1,850
  for (const mark of [false, true]) {
    const p = emptyPlan();
    p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1964-03-15" }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-15" }];
    p.retirement.socialSecurity = { a: { claimAge: 67, monthlyAtFRA: 1800, ...(mark ? { paidUnreduced: true } : {}) }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    p.income = [{ id: "setup-ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: 1800, period: "monthly", startDate: "", endDate: "" }];
    p.guide = { setup: { ss: { a: "getting", s: "statement" } } };
    const a = compute(p, { today: T }).people[0];
    assert.equal(a.unreduced, true);
    const r = saveFigures(a, p.retirement.socialSecurity.a, { claimAge: a.claimAge, record: [], typed: 1850, futureEarnings: "same" });
    // before: the line only, so the full-age amount stayed $1,800 and Sam's top-up $0 (Get started's marked path: $25)
    assert.deepEqual(r.entry, { claimAge: 67, monthlyAtFRA: 1850, ...(mark ? { paidUnreduced: true } : {}) }); assert.deepEqual(r.line, { id: "setup-ss-a", amount: 1850 });
    p.retirement.socialSecurity.a = r.entry; p.income[0].amount = 1850;
    const d = compute(p, { today: T });
    assert.equal(d.people[0].monthly, 1850); assert.equal(d.couple.survivorMonthly.s, 1850); assert.equal(d.couple.spousal.s, 25);
  }
});

test("review 2026-11-06 (round 7): the unnamed first adult reads you and your, the partner your spouse; names as before", async () => {
  const { compute, survivorWords, spousalWords, heroTopUpWords } = await import("./compute.js");
  const { money } = await import("../../../core/format.js");
  const T = "2026-11-02";
  const usd = (n) => money(n, "USD");
  // the round-5 couple (an early claim of $1,500, $2,100 at full age; $900 of the other's own at 67), first named by Get started
  const pair = (a, b) => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: a, role: "self", birthDate: "1962-05-10" }, { id: "s", name: b, role: "partner", birthDate: "1966-06-20" }];
    p.retirement.socialSecurity = { r: { monthlyAtFRA: 2100 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    p.income = [{ id: "i", name: "My Social Security", type: "social", personId: "r", amount: 1500, period: "monthly" }];
    return p;
  };
  const d = compute(pair("Me", "My spouse"), { today: T }); const [me, sp] = d.people;
  assert.equal(survivorWords(sp, me, d.couple.survivorMonthly.s, usd),
    "If you die first, your spouse would get a widow's or widower's benefit on your record: about $1,733 a month in place of your spouse's own $900. That is more than the $1,500 you get now, because it is worked out from your full-age amount.");
  assert.equal(survivorWords(me, sp, d.couple.survivorMonthly.r, usd), "If your spouse dies first, you keep your own $1,500 a month, and your spouse's $900 stops.");
  assert.equal(spousalWords(sp, me, d, usd), "On your record, your spouse also gets about $150 a month more (a spouse's benefit) from 2033, once both have claimed. The plan counts it.");
  assert.equal(heroTopUpWords(d, usd), "The $30,600 a year includes about $150 a month your spouse gets on your record (a spouse's benefit) from 2033.");
  // the first adult the one with the top-up: "you get", "your own figure", "you won't get"
  const q = pair("Sam", "Me"); q.retirement.socialSecurity.s = { claimAge: 67 };
  const e = compute(q, { today: T });
  assert.equal(spousalWords(e.people[1], e.people[0], e, usd), "On Sam's record, you could get up to about $1,050 a month (a spouse's benefit) once both have claimed. The plan does not count it until your own figure is added below.");
  assert.match(spousalWords(e.people[1], e.people[0], e, usd, { none: true }), /The plan leaves it out, as you won't get Social Security\.$/);
  const f = compute(pair("Sam", "Me"), { today: T });
  assert.equal(survivorWords(f.people[0], f.people[1], f.couple.survivorMonthly.r, usd), "If you die first, Sam keeps their own $1,500 a month, and your $900 stops.");
  assert.equal(heroTopUpWords(f, usd), "The $30,600 a year includes about $150 a month you get on Sam's record (a spouse's benefit) from 2033.");
  // typed names read exactly as before
  const g = compute(pair("Ruth", "Sam"), { today: T });
  assert.equal(survivorWords(g.people[0], g.people[1], g.couple.survivorMonthly.r, usd), "If Sam dies first, Ruth keeps their own $1,500 a month, and Sam's $900 stops.");
  assert.equal(heroTopUpWords(g, usd), "The $30,600 a year includes about $150 a month Sam gets on Ruth's record (a spouse's benefit) from 2033.");
});
