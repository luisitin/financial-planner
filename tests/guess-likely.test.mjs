// tests/guess-likely.test.mjs -- follow-up lane 2 (2026-11-07): Social Security for people already retired, and guesses that
// are the most likely figure for the household, not the edge of what is believable. Each household is built the way Get
// started builds it (qa/guess-sanity.mjs walk, settle after each save). Sources: SSA Annual Statistical Supplement 2026,
// Table 5.B9 (guesses/data/retire.js); SCF 2025 (guesses/data/cells.js); ACS 2025 (guesses/data/home.js); AHS 2023 (the
// 1.61% in guesses/estimators/home.js). The formulas are in modules/overview/guesses/README.md "Believable for the
// household" and modules/overview/setup/README.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { walk, Household, loadPages, checkHousehold, TODAY, REG } from "../qa/guess-sanity.mjs";
import * as S from "../modules/overview/setup/compute.js";
import * as C from "../modules/overview/guesses/estimators/common.js";
import * as HM from "../modules/overview/guesses/estimators/home.js";
import * as SP from "../modules/overview/guesses/estimators/spend.js";
import { claimFactor, fullRetirementAge, compute as ssPage } from "../modules/retirement/social-security/compute.js";
import { T as RETIRE } from "../modules/overview/guesses/data/retire.js";
import { T as CELLS } from "../modules/overview/guesses/data/cells.js";
import { isGuess, guessAt, settle } from "../core/estimate/index.js";
import { yearTaxes } from "../modules/cashflow/budget-percent/compute.js";

await loadPages();
const base = { src: "test", state: "OH", tenure: "rent", typed: {}, debts: [], kind: "work", taps: {}, kids: [] };
const house = (o) => { const s = { ...base, status: (o.ages ?? [30]).map(() => "work"), ...o }; const w = walk(s); return new Household(w.plan, { ...s, preview: w.preview }, { tier: "B" }); };
const retired = (ages, ss, o = {}) => house({ who: ages.length > 1 ? "spouse" : "me", ages, status: ages.map(() => "retired"), pays: ages.map(() => null), ss, ...o });
const SSA = RETIRE.ssa_retired_worker_benefit_by_age_sex_2025;
const band = (row, col) => SSA.rows[row][SSA.cols.indexOf(col)];
const LINE = (pid = "setup-self") => `income[setup-ss-${pid}].amount`;
const FRA = (pid = "setup-self") => `retirement.socialSecurity.${pid}.monthlyAtFRA`;
const rule = (H, id) => { const t = {}; checkHousehold(H, t, { only: new Set([id]) }); return t[id] ?? { checked: 0, failed: 0 }; };

// ---- 1. Social Security for someone already retired, the amount left blank
test("SS: a retired person at 63, 66 or 72 who leaves the amount blank gets what SSA pays retired workers that age, for every answer", () => {
  for (const ss of ["getting", "statement", "unsure"]) for (const age of [63, 66, 72]) {
    const h = retired([age], ss);
    const born = Number(h.plan.household.people[0].birthDate.slice(0, 4));
    const where = `${ss} at ${age}`;
    const r = rule(h, "pt.ss.not-zero-when-retired");
    assert.ok(r.checked >= 1 && r.failed === 0, `${where}: pt.ss.not-zero-when-retired ${r.failed}/${r.checked}`);
    const rec = h.plan.retirement.socialSecurity["setup-self"] ?? {};
    assert.ok(rec.monthlyAtFRA > 0, `${where}: full-age amount ${rec.monthlyAtFRA}`);
    const avg = S.averagePaidBenefit(age);
    const person = ssPage(h.plan, { today: TODAY }).people[0];
    if (ss === "getting") {
      // what is paid: the Income line, the age it started, the full-age amount worked back, both ours
      const line = h.plan.income.find((x) => x.id === "setup-ss-setup-self");
      assert.equal(line?.amount, Math.round(avg), `${where}: the Income line`);
      assert.ok(isGuess(h.plan, LINE()) && guessAt(h.plan, LINE()).k === "overview/setup:ssPaid", `${where}: the line is marked as our guess`);
      assert.ok(isGuess(h.plan, FRA()) && guessAt(h.plan, FRA()).k === "overview/setup:ss", `${where}: the full-age amount too`);
      const fra = fullRetirementAge(born).asYears;
      assert.equal(rec.claimAge, age >= fra ? Math.round(fra) : age, `${where}: started at full retirement age, or today's age before it`);
      assert.equal(rec.monthlyAtFRA, Math.round((line.amount / claimFactor(born, rec.claimAge)) * 10) / 10, `${where}: worked back as a typed amount is`);
      assert.ok(Math.abs(person.monthly - Math.round(avg)) <= 0.5, `${where}: the Social Security page shows ${person.monthly}`);
      // Our guesses for you lists both with their source, and each estimator gives the figure on file
      assert.equal(h.est("overview/setup:ssPaid", { path: LINE() })?.value, line.amount);
      assert.equal(h.est("overview/setup:ss", { path: FRA() })?.value, rec.monthlyAtFRA);
      assert.deepEqual(h.est("overview/setup:ssPaid", { path: LINE() }).tables, ["ssa_retired_worker_benefit_by_age_sex_2025"]);
    } else {
      // "I have my statement figure" with no figure, or "Not sure": the estimate "Estimate it for me" makes, as the full-age amount
      assert.equal(rec.monthlyAtFRA, S.averageRetiredBenefit(age, born), `${where}: the full-age amount`);
      assert.equal(h.plan.income.some((x) => String(x.id).startsWith("setup-ss-")), false, `${where}: no Income line (they did not say it is paid)`);
      // the page shows about the average at every age: past full retirement age as the full-age amount; before it (fixer
      // round 2, ssg-B-2) as a claim made today, the age the average is paid at (before: the amount at full age, not claimed
      // yet, $1,934 at 63 against the $1,451 average, paid only from 67, so the retiree lived on savings until then)
      assert.ok(Math.abs(person.monthly - avg) <= 2, `${where}: the page shows about the average, ${person.monthly} vs ${avg}`);
      if (age < fullRetirementAge(born).asYears) {
        assert.equal(rec.claimAge, age, `${where}: claimed at today's age`);
        assert.equal(h.plan.guide.setup.ssClaimWrote?.["setup-self"], age, `${where}: noted as the setup's claim age`);
      } else assert.equal(rec.claimAge, undefined, `${where}: no claim age written past full retirement age`);
    }
  }
});

test("SS: the average is read between Table 5.B9's age bands and by sex when the plan says it", () => {
  assert.equal(S.averagePaidBenefit(61), null, "retired-worker benefits start at 62");
  assert.equal(S.averagePaidBenefit(63), band("all", "62-64"));
  assert.equal(S.averagePaidBenefit(72), band("all", "70-74"));
  assert.equal(S.averagePaidBenefit(65), band("all", "62-64") + (band("all", "65-69") - band("all", "62-64")) / 2, "halfway from 63 to 67");
  assert.equal(S.averagePaidBenefit(72, "f"), band("women", "70-74"));
  assert.equal(S.averagePaidBenefit(72, "m"), band("men", "70-74"));
  for (let a = 62; a < 100; a++) assert.ok(Math.abs(S.averagePaidBenefit(a + 1) - S.averagePaidBenefit(a)) < 140, `no step at ${a}`);
  // a woman whose sex is on Longevity: the women's row, on the Income line and in the gray figure
  const h = retired([72], "getting");
  const p = structuredClone(h.plan); p.retirement.longevity = { "setup-self": { sex: "f" } };
  S.applyAges(p, S.valuesFor(p, "ages", { today: TODAY }), TODAY);
  assert.equal(p.income.find((x) => x.id === "setup-ss-setup-self").amount, Math.round(band("women", "70-74")));
  assert.ok(isGuess(p, LINE()));
  const g = S.ssBlankGuess(p, "setup-self", { mode: "getting", birthYear: 1954, age: 72 }, TODAY);
  assert.deepEqual(g, { value: Math.round(band("women", "70-74")), why: "what retired women your age get on average" });
  // "I have my statement figure" asks for the full-age amount: the gray figure is worked back from the average paid, and says so
  const st = S.ssBlankGuess(h.plan, "setup-self", { mode: "statement", birthYear: 1954, age: 72, retired: true }, TODAY);
  assert.deepEqual(st, { value: S.averageRetiredBenefit(72, 1954), why: "worked back from the $2,225 retired workers your age get on average" });
});

test("SS: a couple both retired, amounts blank, each gets their own age's average on their own line", () => {
  const h = retired([70, 64], "getting", { who: "spouse" });
  for (const [pid, age] of [["setup-self", 70], ["setup-partner", 64]]) {
    const line = h.plan.income.find((x) => x.id === `setup-ss-${pid}`);
    assert.equal(line?.amount, Math.round(S.averagePaidBenefit(age)), pid);
    assert.equal(line.personId, pid);
    assert.ok(isGuess(h.plan, LINE(pid)) && isGuess(h.plan, FRA(pid)), pid);
    assert.equal(rule(h, "pt.ss.not-zero-when-retired").failed, 0);
  }
});

test("SS: what the person types wins and ends our guess; going through the screen again keeps our guess ours", () => {
  const h = retired([68], "getting");
  // the screen again: the box is blank (our figure in gray), and saving it as shown changes nothing
  const v = S.valuesFor(h.plan, "ages", { today: TODAY });
  assert.equal(v.people["setup-self"].ss.amount, "", "our guess shows as a blank box");
  const again = structuredClone(h.plan); S.applyAges(again, v, TODAY);
  assert.deepEqual(again.income, h.plan.income); assert.deepEqual(again.retirement.socialSecurity, h.plan.retirement.socialSecurity);
  assert.deepEqual(again.guesses, h.plan.guesses);
  // a typed amount: the line takes it, and neither figure is ours any more
  const typed = structuredClone(h.plan), tv = structuredClone(v); tv.people["setup-self"].ss.amount = "1850";
  S.applyAges(typed, tv, TODAY);
  assert.equal(typed.income.find((x) => x.id === "setup-ss-setup-self").amount, 1850);
  assert.equal(isGuess(typed, LINE()), false); assert.equal(isGuess(typed, FRA()), false);
  assert.ok(typed.retirement.socialSecurity["setup-self"].monthlyAtFRA > 0);
  // and a typed line is never replaced by our guess when the box is shown again and saved
  const tv2 = S.valuesFor(typed, "ages", { today: TODAY });
  assert.equal(tv2.people["setup-self"].ss.amount, 1850);
  const kept = structuredClone(typed); tv2.people["setup-self"].ss.amount = ""; S.applyAges(kept, tv2, TODAY);
  assert.equal(kept.income.find((x) => x.id === "setup-ss-setup-self").amount, 1850, "a line the person typed is theirs");
  assert.equal(isGuess(kept, LINE()), false);
  // so the box shows no gray figure over it either (a blank keeps the typed amount); ours shows one
  const born = Number(h.plan.household.people[0].birthDate.slice(0, 4));
  assert.equal(S.ssBlankGuess(typed, "setup-self", { mode: "getting", birthYear: born, age: 68 }, TODAY), null);
  assert.equal(S.ssBlankGuess(h.plan, "setup-self", { mode: "getting", birthYear: born, age: 68 }, TODAY)?.value, Math.round(S.averagePaidBenefit(68)));
});

test("SS: changing the answer from 'I already get it' takes our paid guess away; under 62 or outside the U.S. there is no guess", () => {
  const h = retired([66], "getting");
  const p = structuredClone(h.plan), v = S.valuesFor(p, "ages", { today: TODAY });
  v.people["setup-self"].ss.mode = "statement"; v.people["setup-self"].ss.amount = "";
  S.applyAges(p, v, TODAY);
  assert.equal(p.income.some((x) => String(x.id).startsWith("setup-ss-")), false, "no Income line for a benefit not said to be paid");
  assert.equal(isGuess(p, LINE()), false);
  const born = Number(p.household.people[0].birthDate.slice(0, 4));
  assert.equal(p.retirement.socialSecurity["setup-self"].monthlyAtFRA, S.averageRetiredBenefit(66, born), "the statement blank is the estimate");
  // the age 'I already get it' started at was ours and goes; retired and under full retirement age (67), the statement blank is
  // claimed today, as the average it is (fixer round 2, ssg-B-2; before: no claim age, paid from 67)
  assert.equal(p.retirement.socialSecurity["setup-self"].claimAge, 66, "claimed today, the age the average is paid at");
  assert.equal(p.guide.setup.ssClaimWrote?.["setup-self"], 66);
  // a statement figure typed afterwards takes that claim age back (it was ours), and the note with it
  const typed = structuredClone(p), tv = S.valuesFor(typed, "ages", { today: TODAY });
  tv.people["setup-self"].ss.mode = "statement"; tv.people["setup-self"].ss.amount = 2100;
  S.applyAges(typed, tv, TODAY);
  assert.equal(typed.retirement.socialSecurity["setup-self"].monthlyAtFRA, 2100);
  assert.equal(typed.retirement.socialSecurity["setup-self"].claimAge, undefined, "a typed statement figure: claimed at full retirement age, as before");
  assert.equal(typed.guide.setup.ssClaimWrote, undefined);
  // a claim age set on the Social Security page since is the person's: kept
  const mine = structuredClone(p); mine.retirement.socialSecurity["setup-self"].claimAge = 68;
  const mv = S.valuesFor(mine, "ages", { today: TODAY }); mv.people["setup-self"].ss.mode = "statement"; mv.people["setup-self"].ss.amount = "";
  S.applyAges(mine, mv, TODAY);
  assert.equal(mine.retirement.socialSecurity["setup-self"].claimAge, 68);
  assert.equal(mine.guide.setup.ssClaimWrote, undefined);
  // a full-age amount the person typed on the Social Security page is theirs: no average over it, no gray figure
  const own = structuredClone(retired([66], "none").plan);
  own.retirement.socialSecurity["setup-self"] = { claimAge: 70, record: [], monthlyAtFRA: 2400, futureEarnings: "same" };
  const ov = S.valuesFor(own, "ages", { today: TODAY }); ov.people["setup-self"].ss.mode = "getting"; ov.people["setup-self"].ss.amount = "";
  assert.equal(S.ssBlankGuess(own, "setup-self", { mode: "getting", birthYear: 1960, age: 66 }, TODAY), null);
  S.applyAges(own, ov, TODAY);
  assert.equal(own.income.some((x) => String(x.id).startsWith("setup-ss-")), false);
  assert.equal(own.retirement.socialSecurity["setup-self"].monthlyAtFRA, 2400);
  // under 62: disability or survivor money, not the retired average
  const young = retired([60], "getting");
  assert.equal(young.plan.income.some((x) => String(x.id).startsWith("setup-ss-")), false);
  assert.equal(S.ssPaidGuess({ birthYear: 1966, age: 60 }), null);
  // a plan outside the U.S. takes no U.S. figure (core/estimate applies)
  const abroad = structuredClone(retired([70], "none").plan);
  abroad.guide.setup.outsideUS = true;
  const av = S.valuesFor(abroad, "ages", { today: TODAY }); av.people["setup-self"].ss.mode = "getting"; av.people["setup-self"].ss.amount = "";
  S.applyAges(abroad, av, TODAY);
  assert.equal(abroad.income.some((x) => String(x.id).startsWith("setup-ss-")), false);
});

test("SS: the later list says the figure is the average for retired workers that age, and where to make it exact", () => {
  const paid = retired([72], "getting");
  const lp = S.standing(paid.plan, { today: TODAY }).later.find((x) => x.key === "ss-estimate");
  assert.ok(lp, "a later item");
  assert.equal(lp.label, "Your Social Security is the average for retired workers your age: type what you get a month to make it exact");
  assert.equal(lp.href, "#/cashflow/income");
  const est = retired([72], "unsure");
  const le = S.standing(est.plan, { today: TODAY }).later.find((x) => x.key === "ss-estimate");
  assert.equal(le.label, "Your Social Security is the average for retired workers your age: the statement at ssa.gov/myaccount is exact");
  assert.equal(le.href, "#/retirement/social-security");
  const working = house({ who: "me", ages: [50], pays: [70000] });
  assert.match(S.standing(working.plan, { today: TODAY }).later.find((x) => x.key === "ss-estimate").label, /^Social Security is estimated from your pay/);
});

test("SS: from 70 the full-age amount is the one the Social Security page shows as the average (valued at 70), never 24% to 32% more", () => {
  for (const age of [70, 75, 85]) {
    const h = retired([age], "unsure"), born = Number(h.plan.household.people[0].birthDate.slice(0, 4));
    const person = ssPage(h.plan, { today: TODAY }).people[0];
    assert.ok(Math.abs(person.monthly - S.averagePaidBenefit(age)) <= 2, `${age}: shows ${person.monthly}, average ${S.averagePaidBenefit(age)}`);
    assert.equal(S.averageRetiredBenefit(age, born), Math.round(S.averagePaidBenefit(age) / claimFactor(born, 70)));
  }
});

test("SS: a retiree whose Social Security is now on Income is guessed at least Medicare's Part B and Part D premiums", () => {
  // g2345 of the grid: 67, New York, renting, "I already get it" left blank. Our $2,056 a month puts the income over the
  // Medicare Savings Program's limit ($1,816), so the health row is held to $202.90 + $38.99, and a tight month no longer
  // scales that bill down (it was $130)
  const h = retired([67], "getting", { state: "NY" });
  assert.ok(h.spendRows.insurance.monthly >= 241.89, `${h.spendRows.insurance.monthly}`);
  const r = rule(h, "SF-HEALTH-AGE");
  assert.equal(r.failed, 0, "SF-HEALTH-AGE");
});

// fixer round 1 (2026-11-11): Social Security findings ssg-B-1, ssg-B-5, ssg-B-6, ssg-L-1, ssg-L-2, ssg-L-3
const fmt$ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const pageMonthly = (plan, today, i = 0) => ssPage(plan, { today }).people[i].monthly;
test("SS ssg-B-1: a blank 'statement' or 'Not sure' figure follows the birthdays (no 28% jump at 70); it is our guess, settled", () => {
  for (const ss of ["statement", "unsure"]) for (const age of [68, 69]) {
    const h = retired([age], ss), where = `${ss} at ${age}`;
    assert.ok(isGuess(h.plan, FRA()) && guessAt(h.plan, FRA()).k === "overview/setup:ss", `${where}: the blank figure is marked as our guess`);
    for (const later of ["2027-11-07", "2028-11-07"]) {
      const p = structuredClone(h.plan);
      settle(p, { estimators: REG.estimators, tables: REG.tables, today: later });
      const ageThen = age + Number(later.slice(0, 4)) - 2026;
      const fresh = S.averagePaidBenefit(ageThen);
      assert.ok(Math.abs(pageMonthly(p, later) - fresh) <= 3, `${where}, opened ${later}: the page shows ${pageMonthly(p, later)}, a fresh save ${fresh.toFixed(1)}`);
    }
  }
});
test("SS ssg-B-5: deleting our guessed Social Security line leaves the page at the average (claim age on file), not 24% under it", () => {
  const h = retired([72], "getting"), p = structuredClone(h.plan);
  p.income = p.income.filter((x) => x.id !== "setup-ss-setup-self");
  settle(p, { estimators: REG.estimators, tables: REG.tables, today: TODAY });
  assert.ok(Math.abs(pageMonthly(p, TODAY) - S.averagePaidBenefit(72)) <= 2, `the page shows ${pageMonthly(p, TODAY)}, average ${S.averagePaidBenefit(72)}`);
});
test("SS ssg-B-6: 'I already get it' left blank started at the exact full retirement age, so the benefit is never read as reduced", () => {
  for (const [born, age] of [[1939, 87], [1958, 68], [1942, 84]]) {
    const g = S.ssPaidGuess({ birthYear: born, age }), fra = fullRetirementAge(born).asYears;
    assert.equal(g.started, Math.round(fra * 12) / 12, `born ${born}: started ${g.started}, full retirement age ${fra}`);
    assert.ok(Math.abs(g.atFRA - g.amount) <= 0.1, `born ${born}: full-age amount ${g.atFRA} vs paid ${g.amount}`);
  }
  // the screen again, as shown: nothing moves (the stepper's whole year reads back as the exact age)
  const h = retired([68], "getting"), v = S.valuesFor(h.plan, "ages", { today: TODAY }), again = structuredClone(h.plan);
  S.applyAges(again, v, TODAY);
  assert.deepEqual(again.retirement.socialSecurity, h.plan.retirement.socialSecurity);
});
test("SS ssg-B-2: a retiree's guesses are sized on the Social Security the plan counts, whichever blank answer was picked", () => {
  // single Ohio renter, 72, retired, amount blank: before round 1 'getting' was on track at $22,680 a year and 'statement' or
  // 'unsure' short at 87 at $41,760, the rows guessed with no income at all
  const g = retired([72], "getting"), gp = g.ok("retirement/projection");
  for (const ss of ["statement", "unsure"]) {
    const h = retired([72], ss), r = h.ok("retirement/projection");
    assert.equal(r.verdict, gp.verdict, `${ss}: ${r.verdict} ${r.shortAge ?? ""} vs ${gp.verdict}`);
    assert.ok(Math.abs(r.spendingYearly - gp.spendingYearly) <= 0.1 * gp.spendingYearly, `${ss}: spending ${Math.round(r.spendingYearly)} a year vs ${Math.round(gp.spendingYearly)}`);
    // (the page's own amount: the full-age figure x the claim factor, $2,225.52 a month against the line's $2,225)
    assert.ok(Math.abs(C.profileOf(h.plan, TODAY).income - C.profileOf(g.plan, TODAY).income) <= 12, `${ss}: the income the guesses read, ${C.profileOf(h.plan, TODAY).income} vs ${C.profileOf(g.plan, TODAY).income}`);
  }
  // a typed plan is unmoved: a full-age amount the person typed is never counted as income here
  const t = retired([72], "statement", { typed: {} }), tp = structuredClone(t.plan);
  delete tp.guesses; tp.guide.setup.ssWrote = {};
  assert.equal(C.profileOf(tp, TODAY).income, null, "a typed full-age amount: no income line, none added");
});
test("SS ssg-B-2 (round 2): a retiree of 62 to 66 who has not claimed yet is sized on the Social Security the projection pays from its start", () => {
  // before: Social Security counted as income only once the claim age (full retirement age) had come, so a retired 62-year-old
  // who answered "Not sure" was guessed with no income at all (California owner: $3,410 a month of bills, short at 65) while
  // "I already get it" was guessed on $1,451 ($1,120 a month, on track)
  for (const state of ["OH", "CA"]) for (const tenure of ["own", "rent"]) for (const age of [62, 63, 66]) {
    const g = retired([age], "getting", { state, tenure }), gp = g.ok("retirement/projection");
    for (const ss of ["statement", "unsure"]) {
      const h = retired([age], ss, { state, tenure }), r = h.ok("retirement/projection"), where = `${state} ${tenure} ${age} ${ss}`;
      assert.ok(C.profileOf(h.plan, TODAY).income > 0, `${where}: the guesses read an income`);
      if (gp.verdict !== "short") assert.notEqual(r.verdict, "short", `${where}: short at ${r.shortAge} on $${Math.round(r.spendingYearly / 12)} a month ('getting': ${gp.verdict})`);
      // claimed today before full retirement age (no Income line: nobody said it is paid)
      assert.equal(h.plan.income.some((x) => String(x.id).startsWith("setup-ss-")), false, `${where}: no Income line`);
      // found on the round 2 phone shot: the claim age we set today (63) was read by the Social Security page as a claim age
      // that has passed for someone of 63 and 8 months ("The plan has you claiming at 63, which has passed"); our own claim
      // age is the claim the plan already makes, so the page does not ask about it
      const pg = ssPage(h.plan, { today: TODAY }).people[0];
      assert.equal(pg.pastClaimAge, false, `${where}: the Social Security page asks about a claim age that has passed (${pg.claimAge})`);
    }
  }
});
test("SS NEW-delay-claim (round 3): a retiree who has not claimed and sets a later claim age is not sized on the delayed benefit today", () => {
  // before: the retiredNow branch paid the full-age amount x the claim factor at the claim age the person typed (67), so a
  // retired 62-year-old who answered "Not sure" was counted as drawing the delayed benefit today: Ohio renter went from on
  // track ($1,160 a month of bills) to short at 66 ($1,660); California from short at 87 ($1,540) to short at 66 ($2,160)
  const monthly = (pl) => Math.round((pl.expenses ?? []).reduce((s, x) => s + (x.period === "yearly" ? x.amount / 12 : x.amount), 0));
  for (const state of ["OH", "CA"]) for (const age of [62, 63, 65]) {
    const h = retired([age], "unsure", { state }), r0 = h.ok("retirement/projection"), where = `${state} ${age}`;
    const p = structuredClone(h.plan);
    p.retirement.socialSecurity["setup-self"].claimAge = 67;
    settle(p, { estimators: REG.estimators, tables: REG.tables, today: TODAY });
    const H1 = new Household(p, h.spec, { tier: "B" }), r1 = H1.ok("retirement/projection");
    // what the guesses read today: no more than the benefit a claim made today pays
    const by = Number(p.household.people[0].birthDate.slice(0, 4));
    const ssNow = C.incomeLinesOf(p, TODAY).filter((x) => x.ssGuess).reduce((s, x) => s + x.amount, 0);
    assert.ok(ssNow <= p.retirement.socialSecurity["setup-self"].monthlyAtFRA * claimFactor(by, age + 1) + 0.01, `${where}: counted $${ssNow} a month today`);
    assert.equal(monthly(p), monthly(h.plan), `${where}: the guessed bills moved because the person typed a later claim age`);
    // the verdict may still move: waiting to 67 with no pay means living on savings until then, which the projection shows
    // (Ohio 62: short at 65 with the same $1,160 of bills; the person's own choice, not our guess; README "Before the claim age")
    assert.ok(r0 && r1, `${where}: the projection runs`);
  }
});
test("SS ssg-L-4: retired people with only our Social Security guess are never told their guesses are 'on our pay guess'", () => {
  for (const [ages, ss] of [[[72], "getting"], [[70, 66], "getting"], [[72], "unsure"]]) {
    const h = retired(ages, ss), whys = [];
    for (const [path, e] of Object.entries(h.plan.guesses ?? {})) { const r = h.est(e.k, { path }); if (r?.why) whys.push(`${e.k}: ${r.why}`); }
    for (const k of ["overview/setup:x-housing", "overview/setup:x-groceries"]) { const r = h.est(k); if (r?.why) whys.push(`${k}: ${r.why}`); }
    assert.ok(whys.length > 3, `${ages} ${ss}: ${whys.length} why-lines read`);
    const bad = whys.filter((w) => /pay guess/.test(w));
    assert.deepEqual(bad, [], `${ages} ${ss}`);
    // (a line over 70 characters drops its "on ..." part, fit(): "a typical bank balance")
    for (const w of whys.filter((x) => /on our|with our/.test(x) && !/^overview\/setup:ss/.test(x))) assert.match(w, /our Social Security guess/, `${ages} ${ss}`);
  }
});
test("SS partner-not-working-ss-zero (round 3): a partner of 62 or more who is not working, with no pay, gets an estimate, never $0", () => {
  // before: "Estimate it for me" worked from pay, and with no pay it gave the retired-worker average only once the stop-work
  // age on file had come (it is set later than today for someone not working), so 193 of the sweep's 206 remaining
  // pt.ss.not-zero-when-retired failures were partners marked "not working" at 62 to 85 with a Social Security of $0
  for (const age of [62, 65, 70, 75]) {
    const h = house({ who: "partner", ages: [age + 2, age], status: ["work", "none"], pays: [60000, null], ss: "estimate" });
    const pid = h.plan.household.people.find((p) => p.role !== "self" && p.role !== "dependent").id, where = `partner ${age}`;
    const r = rule(h, "pt.ss.not-zero-when-retired");
    assert.ok(r.checked >= 1 && r.failed === 0, `${where}: pt.ss.not-zero-when-retired ${r.failed}/${r.checked}`);
    const by = Number(h.plan.household.people.find((p) => p.id === pid).birthDate.slice(0, 4));
    const avg = S.estimateSocialSecurity({ birthYear: by, yearlyPay: null, stopAge: age, today: TODAY });
    assert.ok(avg > 0 && h.plan.retirement.socialSecurity[pid].monthlyAtFRA === avg, `${where}: the full-age figure ${h.plan.retirement.socialSecurity[pid].monthlyAtFRA} is the retired-worker average at that age (${avg})`);
    // the figure "Estimate it for me" shows on question 3 is the one saved
    const v = S.valuesFor(h.plan, "ages", { today: TODAY }).people[pid];
    assert.equal(S.ssLiveEstimate(h.plan, pid, { birthYear: by, age, retired: v.retired, stopAge: v.stopAge }, TODAY), h.plan.retirement.socialSecurity[pid].monthlyAtFRA, `${where}: live estimate`);
  }
  // under 62 and not working: no change (nothing to claim yet; the estimate still waits for the stop-work age)
  const y = house({ who: "partner", ages: [60, 55], status: ["work", "none"], pays: [60000, null], ss: "estimate" });
  const yp = y.plan.household.people.find((p) => p.role !== "self" && p.role !== "dependent").id;
  assert.ok(!(y.plan.retirement.socialSecurity?.[yp]?.monthlyAtFRA > 0), "a 55-year-old not working: no estimate from no pay");
});
test("SS ssg-M-5, L-5, B-7: the boxes say 'leave blank to use our guess of about $X', and the live estimate is the one saved", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../modules/overview/setup/view.js", import.meta.url), "utf8");
  assert.equal((src.match(/blank uses our guess/g) ?? []).length, 0, "no box says 'blank uses our guess'");
  // "Estimate it for me": the figure on screen is worked with the person's sex, as applyAges saves it (it left sex out)
  assert.equal((src.match(/estimateSocialSecurity\(/g) ?? []).length, 0, "the view shows S.ssLiveEstimate, never its own call");
  const h = house({ who: "me", ages: [50], pays: [70000] }), p = structuredClone(h.plan);
  p.retirement.longevity = { "setup-self": { sex: "f" } };
  const v = S.valuesFor(p, "ages", { today: TODAY }); v.people["setup-self"].ss.mode = "estimate";
  const live = S.ssLiveEstimate(p, "setup-self", { birthYear: Number(p.household.people[0].birthDate.slice(0, 4)), age: 50, retired: false, stopAge: v.people["setup-self"].stopAge }, TODAY);
  S.applyAges(p, v, TODAY);
  assert.equal(live, p.retirement.socialSecurity["setup-self"].monthlyAtFRA);
  assert.equal(S.blankGuessLabel("Social Security a month", 2225), "Social Security a month, leave blank to use our guess of about $2,225");
});
test("SS ssg-L-6: Income and the Social Security page say our guessed amount is our guess, not a fact", async () => {
  const { compute: incomePage } = await import("../modules/cashflow/income/compute.js");
  const h = retired([72], "getting");
  const item = incomePage(h.plan, { today: TODAY }).items.find((x) => x.id === "setup-ss-setup-self");
  assert.equal(item.guessed, true, "the Income line is marked as our guess");
  assert.equal(ssPage(h.plan, { today: TODAY }).people[0].guessed, true, "the Social Security page knows it is our guess");
  // typed: no marker
  const t = structuredClone(h.plan), v = S.valuesFor(t, "ages", { today: TODAY }); v.people["setup-self"].ss.amount = "1850"; S.applyAges(t, v, TODAY);
  assert.equal(incomePage(t, { today: TODAY }).items.find((x) => x.id === "setup-ss-setup-self").guessed, false);
  assert.equal(ssPage(t, { today: TODAY }).people[0].guessed, false);
  // the view words: no "Nothing to decide here" while it is ours
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../modules/retirement/social-security/view.js", import.meta.url), "utf8");
  assert.match(src, /p\.guessed \?/, "the claimed sentence has a guessed branch");
  assert.match(fs.readFileSync(new URL("../modules/cashflow/income/view.js", import.meta.url), "utf8"), /x\.guessed \?/, "Income marks a guessed line");
});
test("SS ssg-L-7: Our guesses for you shows one Social Security row for a person already paid, with one possessive", async () => {
  const { compute: guessesPage } = await import("../modules/overview/guesses/compute.js");
  const h = retired([72], "getting"), rows = guessesPage(h.plan, { today: TODAY, estimators: REG.estimators, tables: REG.tables }).rows;
  const ss = rows.filter((r) => /^overview\/setup:ss/.test(r.k));
  assert.deepEqual(ss.map((r) => r.label), ["Your Social Security a month"], "the paid row only (the full-age figure follows it)");
  const c = retired([70, 64], "getting", { who: "spouse" }); c.plan.household.people[1].name = "My spouse";
  const cs = guessesPage(c.plan, { today: TODAY, estimators: REG.estimators, tables: REG.tables }).rows.filter((r) => /^overview\/setup:ss/.test(r.k));
  assert.deepEqual(cs.map((r) => r.label).sort(), ["Your Social Security a month", "Your spouse's Social Security a month"]);
  // not paid ("Not sure"): the full-age row stays, with the same possessive
  const u = retired([72], "unsure"), us = guessesPage(u.plan, { today: TODAY, estimators: REG.estimators, tables: REG.tables }).rows.filter((r) => /^overview\/setup:ss/.test(r.k));
  assert.deepEqual(us.map((r) => r.label), ["Your Social Security at full retirement age"]);
});
test("SS ssg-L-1, L-2, L-3: the spouse's Social Security guess names the spouse, and 'worked back' only where it is", () => {
  // Get started names an unnamed spouse "My spouse" (the qa walk types "Partner")
  const h = retired([70, 64], "getting", { who: "spouse" }); h.plan.household.people[1].name = "My spouse";
  const paidP = h.est("overview/setup:ssPaid", { path: LINE("setup-partner") }), fraP = h.est("overview/setup:ss", { path: FRA("setup-partner") });
  assert.equal(paidP.why, "what retired workers your spouse's age get on average");
  assert.equal(fraP.why, `worked back from the ${fmt$(S.averagePaidBenefit(64))} retired workers your spouse's age get on average`);
  assert.equal(h.est("overview/setup:ssPaid", { path: LINE() }).why, "what retired workers your age get on average");
  const u = retired([70, 64], "unsure", { who: "spouse" }); u.plan.household.people[1].name = "My spouse";
  assert.equal(u.est("overview/setup:ss", { path: FRA("setup-partner") }).why, `worked back from the ${fmt$(S.averagePaidBenefit(64))} retired workers your spouse's age get on average`);
  const q3 = S.ssBlankGuess(u.plan, "setup-partner", { mode: "statement", birthYear: Number(u.plan.household.people[1].birthDate.slice(0, 4)), age: 64, retired: true }, TODAY);
  assert.equal(q3.why, `worked back from the ${fmt$(S.averagePaidBenefit(64))} retired workers your spouse's age get on average`);
  // between full retirement age and 70 the figure is the average itself: not "worked back"
  const mid = retired([68], "unsure");
  assert.equal(mid.est("overview/setup:ss", { path: FRA() }).why, "what retired workers your age get on average");
  // a named spouse
  const named = structuredClone(u.plan); named.household.people[1].name = "Ana";
  assert.match(S.ssBlankGuess(named, "setup-partner", { mode: "statement", birthYear: 1962, age: 64, retired: true }, TODAY).why, /retired workers Ana's age/);
});

// ---- 2. the family floor, then a fit to take-home
test("spending: the family floor never pushes the guessed leftover below zero on its own (Texas couple at 20 with a baby)", () => {
  // g74 of the grid: $40,000 for one of two, a baby, a mortgage on a $115,000 home, student loan and card. Before: -$140 a month.
  const h = house({ who: "spouse", ages: [20, 20], status: ["work", "none"], pays: [40000, null], state: "TX", tenure: "mortgage", kids: [0], debts: ["student", "credit"], typed: { home: 115000 }, taps: { childcare: "no" } });
  const lo = h.leftOver.monthly;
  assert.ok(lo >= 0, `left over ${Math.round(lo)} a month`);
  // the rows still never go under what the same two adults without the baby spend (the floor is cut, never the household's own)
  const memo = new Map(), lib = { memo: (k, f) => (memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k))) };
  const m = SP.spendModel(h.plan, { today: TODAY }, lib);
  assert.ok(m.floorFit && m.floorFit.kept >= 0 && m.floorFit.kept < 1, `the fit kept ${m.floorFit?.kept}`);
  assert.ok(m.floored, "the household has a child: the floor applies");
  // the fit reads our retirement saving guess as its own estimator gives it: one settle pass is still the fixed point
  const again = structuredClone(h.plan);
  assert.deepEqual(settle(again, { estimators: REG.estimators, tables: REG.tables, today: TODAY }).changed, [], "settling again moves nothing");
  // the same couple with a raise: settle once and the rows already follow (no second pass needed)
  const raised = structuredClone(h.plan); raised.income.find((x) => x.personId === "setup-self" && x.type === "salary").amount = 46000;
  settle(raised, { estimators: REG.estimators, tables: REG.tables, today: TODAY });
  assert.deepEqual(settle(raised, { estimators: REG.estimators, tables: REG.tables, today: TODAY }).changed, [], "one pass reaches the fixed point after a raise");
});

test("spending: a family with room to spare keeps the whole floor (the fit cuts only what does not fit)", () => {
  const h = house({ who: "spouse", ages: [35, 35], pays: [120000, 90000], state: "OH", tenure: "rent", kids: [4] });
  const memo = new Map(), lib = { memo: (k, f) => (memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k))) };
  const m = SP.spendModel(h.plan, { today: TODAY }, lib);
  assert.ok(m.floored);
  assert.equal(m.floorFit, undefined, "nothing cut");
  assert.ok(h.leftOver.monthly > 0);
});

// fixer round 1 (2026-11-11, findings ssg-M-1, ssg-B-3, ssg-B-8, ssg-M-2): the room the floor is fitted to is the Budget's own
// left-over (the same federal tax with credits, two returns for unmarried partners, state tax and payroll tax), so the floor is
// cut only where it does not fit, and the fit never leaves a row under what the same household without the floor gets
const memoLib = () => { const memo = new Map(); return { memo: (k, f) => (memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k))) }; };
const GRID_FAMILIES = [
  // NY renter, one earner (before: $270 of the floor cut, the whole floor left +$191 spare)
  { id: "g784", who: "spouse", ages: [35, 25], status: ["work", "none"], pays: [74000, null], kids: [5, 2], state: "NY", taps: { childcare: "no", "health-cover": "unsure" } },
  // GA owners with four debts (before: no floor at all, the whole floor left +$184)
  { id: "g508", who: "spouse", ages: [30, 30], pays: [31000, 31000], kids: [2], state: "GA", tenure: "mortgage", typed: { home: 175000 }, debts: ["car-loan", "student", "credit", "loan"], taps: { childcare: "no", "health-cover": "own" } },
  // TX unmarried partners, three children: two returns (before: room -$51 against a Budget leftover of +$341)
  { id: "g1491", who: "partner", ages: [50, 40], pays: [37000, 38000], kids: [12, 9, 6], state: "TX", debts: ["student", "credit"], taps: { childcare: "yes" } },
  // OH, adults 25 and 35, children 5 and 2 (before: room -$73, $209 removed, leftover +$157)
  { id: "g420", who: "spouse", ages: [25, 35], pays: [31000, 38000], kids: [5, 2], debts: ["student", "credit"], taps: { childcare: "yes" } },
  // OH partners 62 and 52, one child (before: $132 a month under the no-floor model)
  { id: "g2079", who: "partner", ages: [62, 52], status: ["work", "none"], pays: [72000, null], kids: [17], debts: ["car-loan"], taps: { childcare: "yes", "health-cover": "unsure" } },
  { id: "g1722", who: "spouse", ages: [55, 45], pays: [37000, 37000], kids: [17, 14], debts: ["student", "credit"], taps: { childcare: "yes", "health-cover": "work" } },
];
test("spending: the floor is cut only as far as the Budget's left-over needs, and never below the household without the floor", () => {
  for (const o of GRID_FAMILIES) {
    const h = house(o), lib = memoLib();
    const m = SP.spendModel(h.plan, { today: TODAY }, lib), m0 = SP.spendModel(h.plan, { today: TODAY, floor: false }, lib);
    assert.ok(m.floored, `${o.id}: the floor applies`);
    // never under the same household's spending without the floor: in all, and row by row where none of the floor is kept
    // (before: g1491 $142 a month under it, transport 327.5 vs 361.3, insurance 427.7 vs 471.9)
    const sum = (x) => m.guessed.reduce((s, r) => s + x.rows[r].value, 0);
    assert.ok(sum(m) >= sum(m0) - 0.01, `${o.id}: the guessed rows add up to ${sum(m).toFixed(1)}, under ${sum(m0).toFixed(1)} without the floor`);
    // and where the fit cut, the month costs exactly the room more than without the floor (none when there is no room)
    if (m.floorFit) assert.ok(Math.abs(sum(m) - sum(m0) - Math.max(0, m.floorFit.room)) < 0.01, `${o.id}: the fitted rows cost ${(sum(m) - sum(m0)).toFixed(1)} more than without the floor, the room is ${m.floorFit.room.toFixed(1)}`);
    // a floor cut while the month still has money left over is a cut that was not needed
    // (the room leaves out the child care credit, so the grey guess and the saved one stay one figure, SF-SPEND-ONE-FIGURE:
    // the month may keep that credit on top, $175 for g420)
    const lo = h.leftOver.monthly;
    const careCredit = (yearTaxes(h.plan, { today: TODAY }).afterTax - yearTaxes({ ...h.plan, expenses: [] }, { today: TODAY }).afterTax) / 12;
    if (m.floorFit && m.floorFit.kept < 1) assert.ok(lo <= 50 + careCredit, `${o.id}: $${Math.round(lo)} left over a month ($${Math.round(careCredit)} of it the child care credit), yet only ${Math.round(m.floorFit.kept * 100)}% of the $${Math.round(m.floorFit.extra)} floor kept`);
  }
});

test("spending (fixer round 3, floor-rounding-negative): rounding the saved rows never spends more than the room the floor was fitted to", () => {
  // sampled grid g196 (CA) and g1204 (TX): the fitted rows added up exactly, but each was saved rounded to $10 or $50 on its
  // own (g196 rent $2,432.99 saved as $2,450), so the saved month cost $28 and $33 more than the room and the Budget's
  // leftover went to -$28 and -$33 with $60 and $113 of the floor kept
  const fams = [
    { id: "g196", who: "spouse", ages: [22, 22], status: ["work", "work"], pays: [40000, 40000], kids: [2], state: "CA", tenure: "rent", debts: ["car-loan"], taps: { childcare: "no", "health-cover": null }, pension: 0, homeGoal: true },
    { id: "g1204", who: "spouse", ages: [45, 35], status: ["work", "none"], pays: [73000, null], kids: [7], state: "TX", tenure: "rent", debts: ["student", "credit"], taps: { childcare: "no", "health-cover": "unsure" }, pension: 0, homeGoal: true },
  ];
  for (const o of fams) {
    const h = house(o), lib = memoLib(), m = SP.spendModel(h.plan, { today: TODAY }, lib), m0 = SP.spendModel(h.plan, { today: TODAY, floor: false }, lib);
    assert.ok(m.floorFit, `${o.id}: the floor is fitted`);
    const sum = (x) => m.guessed.reduce((s, r) => s + x.rows[r].value, 0);
    const saved = m.guessed.reduce((s, r) => s + (h.plan.expenses.find((x) => x.id === `setup-x-${r}`)?.amount ?? 0), 0);
    // the room the floor may use: what is left after the no-floor rows (none when there is none)
    assert.ok(saved <= sum(m0) + Math.max(0, m.floorFit.room) + 0.01, `${o.id}: the saved rows cost $${saved}, the no-floor rows and the room $${(sum(m0) + Math.max(0, m.floorFit.room)).toFixed(2)}`);
    assert.ok(h.leftOver.monthly >= -0.5, `${o.id}: $${Math.round(h.leftOver.monthly)} left over a month with the floor fitted`);
    // the rows are still saved at the usual steps ($10 under $1,000, else $50)
    for (const r of m.guessed) { const v = h.plan.expenses.find((x) => x.id === `setup-x-${r}`)?.amount; if (v !== undefined) assert.equal(v % (v < 1000 ? 10 : 50), 0, `${o.id} ${r}: $${v}`); }
  }
});
test("spending (fixer round 2, ssg-M-1-residual): the room counts the child care credit, so a floor is cut only when the month has no more than $25 left", () => {
  // sampled grid g420, g426, g510 (all with paid childcare): before, the room left the care credit out and the floor was cut
  // with $207, $178 and $84 a month still left over
  const fams = [
    { id: "g420", who: "spouse", ages: [25, 35], pays: [31000, 38000], kids: [5, 2], state: "OH", tenure: "rent", debts: ["student", "credit"], taps: { childcare: "yes" } },
    { id: "g426", who: "spouse", ages: [25, 35], pays: [31000, 38000], kids: [5, 2], state: "OH", tenure: "mortgage", typed: { owed: 111000 }, taps: { childcare: "yes" } },
    { id: "g510", who: "spouse", ages: [30, 30], pays: [31000, 31000], kids: [2], state: "TX", tenure: "mortgage", typed: { owed: 128000 }, debts: ["car-loan"], taps: { childcare: "yes" } },
  ];
  for (const o of fams) {
    const h = house(o), m = SP.spendModel(h.plan, { today: TODAY }, memoLib()), lo = h.leftOver.monthly;
    // the rows are saved rounded (childcare to $100, the others to $10: g420's $1,923.70 of care is saved as $1,900), so the
    // month keeps what rounding gave back: $27 for g420. Unrounded, a cut floor leaves at most $25.
    const saved = Object.fromEntries(h.plan.expenses.map((x) => [x.id, x.amount]));
    const rounding = m.guessed.reduce((s, r) => s + m.rows[r].value - (saved[`setup-x-${r}`] ?? m.rows[r].value), 0);
    if (m.floorFit && m.floorFit.kept < 1) assert.ok(lo - rounding <= 25, `${o.id}: $${Math.round(lo)} left over a month ($${Math.round(rounding)} of it rounding), yet only ${Math.round(m.floorFit.kept * 100)}% of the $${Math.round(m.floorFit.extra)} floor kept (room ${Math.round(m.floorFit.room)})`);
    // settling again moves nothing (the room reads the care row as the model sizes it, not the figure saved)
    const again = structuredClone(h.plan);
    assert.deepEqual(settle(again, { estimators: REG.estimators, tables: REG.tables, today: TODAY }).changed, [], `${o.id}: settling again moves nothing`);
  }
});

test("SF-SPEND-CHILD-MONO: a child of 8 does not cut the rent guess of an Ohio couple at $30,000 each (the floor fits once the child's credits count)", () => {
  for (const age of [33, 40]) {
    const pair = { who: "spouse", ages: [age, age], pays: [30000, 30000] };
    const a = house(pair), b = house({ ...pair, kids: [8] });
    const ra = SP.spendModel(a.plan, { today: TODAY }, memoLib()).rows, rb = SP.spendModel(b.plan, { today: TODAY }, memoLib()).rows;
    for (const r of ["housing", "utilities"]) assert.ok(rb[r].value >= ra[r].value - 0.5, `at ${age}: ${r} ${Math.round(ra[r].value)} without the child, ${Math.round(rb[r].value)} with`);
  }
});

// ---- 3. rent never above what 95 in 100 renters at that income pay
test("rent: the guess stays under the 95th percentile of rent over income for the household's income fifth (SCF 2025)", () => {
  const t = CELLS.scf2025_rent_to_income_by_income_fifth;
  assert.ok(t, "the table is bundled");
  assert.deepEqual(t.rows["rentOverIncome:p95"], [1.23, 0.568, 0.475, 0.292, 0.215]);
  // g77: a California couple at 20, $94,000 each, a baby. Before: $3,550 a month, 22.7% of $188,000 (p95 21.5%)
  const h = house({ who: "spouse", ages: [20, 20], pays: [94000, 94000], state: "CA", tenure: "rent", kids: [0], debts: ["car-loan"] });
  const rent = h.spendRows.housing.monthly;
  assert.ok(rent * 12 <= 0.215 * 188000, `rent ${rent} a month is ${(rent * 12 / 188000 * 100).toFixed(1)}% of pay`);
  assert.ok(rent >= 3000, `still a California rent: ${rent}`);
  // the ceiling never falls as income rises
  let prev = 0;
  for (let inc = 5000; inc <= 500000; inc += 500) { const c = SP.rentCap(inc); assert.ok(c >= prev - 1e-6, `${inc}: ${c} < ${prev}`); prev = c; }
  assert.equal(SP.rentCap(0), null);
  // an Ohio single at $45,000 is untouched (the model's figure is well under the line)
  const oh = house({ who: "me", ages: [40], pays: [45000] });
  assert.ok(oh.spendRows.housing.monthly * 12 < SP.rentCap(45000));
});

// ---- 4. the home's value: the most likely figure, not the top of the range
test("home value: over the top of the range the guess is the age x income cell's median at the state's prices, not the cap", () => {
  const t = CELLS.scf2025_home_value_to_income;
  assert.ok(t.rows["p50:0-20"] && t.rows["n:90-100"], "the cell medians and counts are bundled");
  // a $12,000 earner of 30 in Ohio who owns: the formula says more than the cap (owners under 35, 95th percentile 7.13 times
  // pay: $85,000), which was the guess before; now the cell's median value at Ohio's prices, about $80,000
  const h = house({ who: "me", ages: [30], pays: [12000], state: "OH", tenure: "own" });
  const lim = C.homeRatios(30), cell = C.homeCellValue({ age: 30, income: 12000 }) * HM.statePriceLevel("OH");
  assert.ok(h.home.value < Math.floor(lim.p95 * 12000 / 1000) * 1000, `${h.home.value} is under the cap ${lim.p95 * 12000}`);
  assert.ok(Math.abs(h.home.value - cell) <= 0.05 * cell, `${h.home.value} ~ the cell's ${Math.round(cell)}`);
  // g3 (20, $20,000, New York, with a mortgage): the cell's figure, $135,000 at New York's prices, rounded to $140,000
  const g3 = house({ who: "me", ages: [20], pays: [20000], state: "NY", tenure: "mortgage", debts: ["car-loan", "student", "credit", "loan"] });
  const c3 = C.homeCellValue({ age: 20, income: 20000 }) * HM.statePriceLevel("NY");
  assert.ok(Math.abs(g3.home.value - c3) <= 0.05 * c3, `g3 ${g3.home.value} ~ ${Math.round(c3)}`);
  // the cell value never falls as income rises, and is held flat below the lowest group's middle (SCF: owners' homes do not
  // fall with income there: $173,000 under $10,000, $186,000 at $15,000-$20,000, all ages)
  for (const age of [25, 40, 50, 60, 70, 80]) { let prev = 0; for (let inc = 2000; inc <= 600000; inc += 2000) { const v = C.homeCellValue({ age, income: inc }); assert.ok(v >= prev - 1e-6, `${age} at ${inc}`); prev = v; } }
  assert.equal(C.homeCellValue({ age: 30, income: 5000 }), C.homeCellValue({ age: 30, income: C.incomeAt(10) }));
  assert.equal(C.homeCellValue({ age: 30, income: null }), null);
  // the guess never falls as pay rises (Ohio single at 45, $5,000 to $60,000)
  let prev = 0;
  for (let pay = 5000; pay <= 60000; pay += 5000) { const v = house({ who: "me", ages: [45], pays: [pay], tenure: "own" }).home.value; assert.ok(v >= prev * 0.99, `${pay}: ${v} < ${prev}`); prev = v; }
});

// ---- 5. home insurance on a cheap home
test("home insurance: the $350 floor is never more than owners of homes under $30,000 pay of the value (AHS 2023: 2.55%)", () => {
  assert.equal(HM.INSURANCE_SHARE_CHEAP, 0.0255);
  const cheap = HM.insuranceYear("MS", 10000);
  assert.ok(Math.abs(cheap - 255) < 1, `${cheap} on $10,000 (was $350, 3.5% of it)`);
  assert.ok(HM.insuranceYear("MS", 5000) <= 0.0255 * 5000 + 1e-9);
  assert.ok(Math.abs(HM.insuranceYear("MS", 15000) - 350) < 1e-9, "a $15,000 home: $350 (2.3%), under the $600 such homes pay in the middle");
  // the floor never makes a dearer home cheaper to insure, and the formula above it is untouched
  let prev = 0;
  for (let v = 1000; v <= 400000; v += 1000) { const y = HM.insuranceYear("MS", v); assert.ok(y >= prev - 1e-9, `${v}`); prev = y; }
  assert.ok(HM.insuranceYear("MS", 64000) / 64000 <= 0.0161);
});

// fixer round 1 (2026-11-11, finding ssg-B-4): the home value guess never jumps where the survey cell meets the formula
// (before: Ohio at 24, $73,000 at $13,000 pay and $96,000 at $14,000; New York at 28, $160,000 at $27,000 and $190,000 at $28,000)
const homeOf = (state, age, pay) => {
  const { plan } = walk({ ...base, state, tenure: "own", ages: [age], status: ["work"], pays: [pay] });
  return (plan.accounts ?? []).find((a) => a.type === "home" || String(a.id ?? "").includes("home"))?.balance ?? null;
};
test("home value: no step where the survey cell takes over from the formula (ssg-B-4)", () => {
  for (const [state, age, pays] of [["OH", 24, [10000, 11000, 12000, 13000, 14000, 15000, 16000]], ["NY", 24, [22000, 24000, 26000, 27000, 28000, 30000, 32000]], ["NY", 28, [24000, 26000, 27000, 28000, 30000]]]) {
    const v = pays.map((p) => homeOf(state, age, p));
    for (let i = 1; i < v.length; i++) {
      assert.ok(v[i] >= v[i - 1], `${state} at ${age}: $${v[i - 1]} at $${pays[i - 1]} pay, then $${v[i]} at $${pays[i]}`);
      assert.ok(v[i] / v[i - 1] <= 1.15, `${state} at ${age}: $${v[i - 1]} at $${pays[i - 1]} pay jumps to $${v[i]} at $${pays[i]} (x${(v[i] / v[i - 1]).toFixed(2)})`);
    }
  }
  // and across a birthday at the same pay (New York, $27,000: $160,000 at 28, $190,000 at 29)
  const a = homeOf("NY", 28, 27000), b = homeOf("NY", 29, 27000);
  assert.ok(Math.max(a, b) / Math.min(a, b) <= 1.12, `New York at $27,000 pay: $${a} at 28, $${b} at 29`);
});

// fixer round 1 (2026-11-11, ssg-M-1): the Budget hands its month after tax to the guesses through core/estimate (the guesses
// may not import that page: the import rule in modules/overview/guesses/module.test.mjs); the figure is the page's own
test("the Budget's month after tax reaches the guesses through core/estimate (ssg-M-1)", async () => {
  const { provided } = await import("../core/estimate/index.js");
  const f = provided("budget:afterTaxMonth");
  assert.equal(typeof f, "function", "cashflow/budget-percent registers its month after tax when it loads");
  const h = house(GRID_FAMILIES[2]);
  const T = yearTaxes({ ...h.plan, expenses: [] }, { today: TODAY });
  assert.ok(Math.abs(f(h.plan, TODAY) - (T.afterTax + (T.careLost ?? 0)) / 12) < 1e-6);
});

// fixer round 1 (2026-11-11, found on the phone shot after ssg-B-6): "It started at age" on question 3 showed
// "66.8333333333333" for a guessed start at the exact full retirement age; it shows years and months, and the buttons step to
// whole years from there
test("SS: question 3 shows a guessed start age in years and months, and steps to whole years (after ssg-B-6)", () => {
  const h = retired([67], "getting");
  const started = h.plan.retirement.socialSecurity["setup-self"].claimAge;
  assert.ok(!Number.isInteger(started), `the guess starts at the exact full retirement age (${started})`);
  assert.equal(S.ageShown(started), "66 and 10 months");
  assert.equal(S.ageShown(67), "67");
  assert.equal(S.ageStep(started, -1), 66);
  assert.equal(S.ageStep(started, 1), 67);
  assert.equal(S.ageStep(64, -1), 63);
  assert.equal(S.ageStep(64, 1), 65);
});

// fixer round 2 (2026-11-11, ssg-provider-order): "budget:afterTaxMonth" exists only once cashflow/budget-percent has been
// imported. The app and qa load every page first, but the PC server's POST /api/compute/<group>/<id> (overview/guesses is a
// heavy page, so a server plan computes it there) imported only that page's compute.js: Get started's spending offers then
// fell back to take-home less payroll tax and read differently (g420 with no bills yet: car $220 on the server, $270 in the
// app). core/estimate/providers.js PROVIDED_BY names the page behind each figure, and the server loads them before a compute.
test("a figure handed over through core/estimate is the same when the PC server computes the page (ssg-provider-order)", async () => {
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const P = await import("../core/estimate/providers.js");
  // every figure an estimator asks for names the page that registers it, and that page does register it
  const asked = new Set();
  const scan = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) scan(f); else if (e.name.endsWith(".js")) for (const m of fs.readFileSync(f, "utf8").matchAll(/provided\("([^"]+)"\)/g)) asked.add(m[1]); } };
  scan(path.join(REPO, "modules"));
  assert.ok(asked.has("budget:afterTaxMonth"));
  for (const name of asked) {
    const by = P.PROVIDED_BY?.[name];
    assert.ok(by && fs.existsSync(path.join(REPO, "modules", by, "compute.js")), `"${name}" names the page that registers it in PROVIDED_BY`);
    assert.match(fs.readFileSync(path.join(REPO, "modules", by, "compute.js"), "utf8"), new RegExp(`provide\\("${name}"`), `${by} registers "${name}"`);
  }
  // the server works the guesses page out as the app does: a copy of server.mjs over this repo's code, its own data folder
  const h = house(GRID_FAMILIES[3]);
  const plan = structuredClone(h.plan);
  plan.expenses = [];
  for (const k of Object.keys(plan.guesses ?? {})) if (k.startsWith("expenses[")) delete plan.guesses[k];
  const { compute: guessesPage } = await import("../modules/overview/guesses/compute.js");
  const here = guessesPage(plan, { today: TODAY });
  assert.ok(here.offers?.fill?.some((c) => c.case === "spend"), "the plan with no bills yet is offered the spending rows");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planner-provider-"));
  fs.mkdirSync(path.join(root, "server"));
  fs.copyFileSync(path.join(REPO, "server", "server.mjs"), path.join(root, "server", "server.mjs"));
  fs.copyFileSync(path.join(REPO, "package.json"), path.join(root, "package.json"));
  for (const d of ["core", "modules"]) fs.symlinkSync(path.join(REPO, d), path.join(root, d), "dir");
  // fixer round 3 (NEW-provider-test-port): the port was 9450 + a random 0-9, shared with anything else on the machine, so
  // the test failed when another process held it (EADDRINUSE; a stranger answering 404 on /api/health) and could have talked
  // to a planner server it did not start. Now startServerCopy asks the system for a free port and waits for the copy's own
  // start-up line (its own data folder, that port), and the copy is stopped by its PID.
  const { child, port } = await startServerCopy(root);
  const base = `http://127.0.0.1:${port}`;
  try {
    const up = (await fetch(`${base}/api/health`)).status === 200;
    assert.ok(up, "the server copy started");
    const res = await fetch(`${base}/api/compute/overview/guesses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, params: { today: TODAY } }) });
    assert.equal(res.status, 200);
    const there = await res.json();
    const rows = (o) => Object.fromEntries((o.offers?.fill?.find((c) => c.case === "spend")?.rows ?? []).map((r) => [r.row, r.value]));
    assert.deepEqual(rows(there), rows(here), "the spending offers on the server are the app's");
  } finally { await stopChild(child); fs.rmSync(root, { recursive: true, force: true }); }
});

/** A port the system says is free on 127.0.0.1 (listen on 0, read it, let it go). */
async function freePort() {
  const net = await import("node:net");
  return new Promise((resolve, reject) => { const s = net.createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
}
/** Stop a child process by its PID and wait until it has gone. */
async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const gone = new Promise((r) => child.once("exit", r));
  try { process.kill(child.pid, "SIGTERM"); } catch { return; }
  await Promise.race([gone, new Promise((r) => setTimeout(r, 3000))]);
  if (child.exitCode === null && child.signalCode === null) { try { process.kill(child.pid, "SIGKILL"); } catch { /* gone */ } }
}
/**
 * Start a copy of server.mjs in `root` on a free port and return { child, port } once that copy, and no other process, is
 * listening: its own start-up line names its own data folder (inside `root`) and the port. A port taken between the check
 * and the start (the copy exits) is retried on a new port.
 */
async function startServerCopy(root, { tries = 5, waitMs = 10000 } = {}) {
  const fs = await import("node:fs"), path = await import("node:path");
  const { spawn } = await import("node:child_process");
  for (let i = 0; i < tries; i++) {
    const port = await freePort();
    fs.writeFileSync(path.join(root, "planner.properties"), `server.port=${port}\nserver.bind=127.0.0.1\nai.provider=none\ndata.dir=data\n`);
    const child = spawn(process.execPath, [path.join(root, "server", "server.mjs")], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    child.stderr.resume();
    const ours = await new Promise((resolve) => {
      let out = "";
      const done = (v) => { clearTimeout(t); child.stdout.removeAllListeners("data"); child.stdout.resume(); resolve(v); };
      const t = setTimeout(() => done(false), waitMs);
      child.stdout.on("data", (d) => { out += d; if (out.includes(`data: ${path.join(fs.realpathSync(root), "data")}`) || out.includes(`data: ${path.join(root, "data")}`)) { if (out.includes(`http://127.0.0.1:${port}/`)) done(true); } });
      child.once("exit", () => done(false));
    });
    if (ours) return { child, port };
    await stopChild(child);
  }
  throw new Error(`the server copy did not start in ${tries} tries`);
}
