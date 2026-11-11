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
      // past full retirement age the page shows the average itself; before it, the amount at full age (not claimed yet)
      if (age >= fullRetirementAge(born).asYears) assert.ok(Math.abs(person.monthly - avg) <= 2, `${where}: the page shows about the average, ${person.monthly} vs ${avg}`);
      else assert.ok(Math.abs(person.monthly - avg / claimFactor(born, age)) <= 2, `${where}: at full age ${person.monthly}`);
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
  assert.equal(p.retirement.socialSecurity["setup-self"].claimAge, undefined, "the age it started was ours: gone");
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
