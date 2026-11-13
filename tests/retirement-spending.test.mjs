// tests/retirement-spending.test.mjs -- spending in retirement, the optional parts (gap design #4, 2026-11-13): spending that
// eases with age (`retirement.spendingEase`, `easeFromAge`), the lowest spending accepted (`retirement.spendingFloor`) and the
// guardrail rule's own numbers (`retirement.guard`). core/math/retirement.js holds the sums (easeChanges, guardRule, the floor
// in project); modules/retirement/projection/compute.js reads the plan (easeOf, spendingExtras).
//  1. Invariance: with the fields absent, or set to what absent means, every answer is what it was, byte for byte.
//  2. Each formula, on small engine inputs worked by hand and on the invented households.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { project, affordableSpending, easeChanges, levelFactor, guardRule, GUARD_DEFAULT, EASE_MAX, STRATEGIES, strategyWords, shareWords } from "../core/math/retirement.js";
import { buildInputs, compute as projection, easeOf, spendingExtras, easedBy, SPEND_RULES } from "../modules/retirement/projection/compute.js";
import { compute as monteCarlo } from "../modules/retirement/monte-carlo/compute.js";
import { compute as historical } from "../modules/retirement/historical/compute.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import { retirementPlan } from "../qa/fixtures/retirement-plan.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-13";
const NEW = ["spendingEase", "easeFromAge", "spendingFloor", "guard"];
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();
const out = (compute, plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T })); } catch (e) { return `throws ${e.message}`; } };
const withRt = (plan, more) => { const p = structuredClone(plan); p.retirement = { ...(p.retirement ?? {}), ...more }; return p; };
const retired = (r) => r.rows.filter((x) => x.retired);

// ---------------------------------------------------------------- 1. invariance
test(`no plan has the new fields, migrate adds none, and buildInputs adds no key: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  let ran = 0;
  for (const { name, plan } of ALL) {
    for (const p of [plan, migrate(structuredClone(plan))]) for (const k of NEW) assert.equal(p.retirement?.[k], undefined, `${name}: no ${k}`);
    const b = buildInputs(migrate(structuredClone(plan)), { today: T });
    if (!b.inputs) continue;
    for (const k of ["ease", "spendingFloor", "guard"]) assert.equal(k in b.inputs, false, `${name}: no ${k} in the engine inputs`);
    ran++;
  }
  assert.ok(ran >= 20, `${ran} plans that run`);
});

test("d = 0, floor = 0 and the usual guard give the very same run as the fields absent: every way, every plan", () => {
  // the engine: the keys written out at what absent means
  let ran = 0;
  for (const { name, plan } of ALL) {
    const b = buildInputs(migrate(structuredClone(plan)), { today: T });
    if (!b.inputs) continue;
    for (const strategy of Object.keys(STRATEGIES)) {
      const I = { ...b.inputs, strategy };
      const was = JSON.stringify(project(I));
      assert.equal(JSON.stringify(project({ ...I, spendingFloor: { yearly: 0 }, guard: { ...GUARD_DEFAULT }, spendingChanges: [...(I.spendingChanges ?? []), ...easeChanges({ rate: 0, fromYear: I.retireYear, endYear: I.endYear })] })), was, `${name}: ${strategy}`);
      assert.equal(JSON.stringify(project({ ...I, spendingFloor: null, guard: null })), was, `${name}: ${strategy}, nulls`);
      ran++;
    }
  }
  assert.ok(ran >= 80, `${ran} runs`);
  // the plan: the fields saved at what absent means (a chip tapped back to "Stays the same", a floor cleared)
  const same = { spendingEase: 0, easeFromAge: null, spendingFloor: 0, guard: { cut: 0.1, raise: 0.1, upper: 1.2, lower: 0.8 } };
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    for (const strategy of Object.keys(STRATEGIES)) {
      const p = withRt(a, { strategy });
      assert.equal(JSON.stringify(buildInputs(withRt(p, same), { today: T })), JSON.stringify(buildInputs(p, { today: T })), `${name}: ${strategy}: buildInputs`);
    }
    assert.equal(out(projection, withRt(a, same)), out(projection, a), `${name}: retirement/projection`);
  }
});

function reaches(file, target, seen = new Map()) {
  if (file === target) return true;
  if (seen.has(file)) return seen.get(file);
  seen.set(file, false);
  let src = "";
  try { src = fs.readFileSync(file, "utf8"); } catch { return false; }
  const hit = [...src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].some((m) => reaches(path.resolve(path.dirname(file), m[1]), target, seen));
  seen.set(file, hit);
  return hit;
}
test("every module's compute that can reach the projection is the same with the fields at what absent means, on the four fixture plans", async () => {
  const target = path.join(ROOT, "modules", "retirement", "projection", "compute.js");
  const SIZE_ONLY = new Set(["system/diagnostics", "system/settings"]);   // they measure the saved plan's size
  const mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js"), key = `${g.name}/${m.name}`;
      if (m.isDirectory() && fs.existsSync(f) && !SIZE_ONLY.has(key) && reaches(f, target)) mods.push([key, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  assert.ok(mods.length >= 40, `${mods.length} modules reach the projection`);
  for (const k of ["retirement/monte-carlo", "retirement/historical", "retirement/withdrawal-strategy"]) assert.ok(mods.some(([x]) => x === k), k);
  const same = { spendingEase: 0, spendingFloor: 0, guard: { ...GUARD_DEFAULT } };
  const four = ALL.filter(({ name }) => /fixture (family|renter-debt|retired-couple|retirement)-plan/.test(name));
  assert.ok(four.length >= 4);
  let compared = 0;
  for (const { name, plan } of four) {
    const a = migrate(structuredClone(plan)), b = withRt(a, same);
    for (const [key, compute] of mods) { assert.equal(out(compute, b), out(compute, a), `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 160, `${compared} comparisons`);
});

// ---------------------------------------------------------------- 2. the formulas
// a small household worked by hand: retired from the first year, no income, no tax, no growth, no inflation
const tiny = (more = {}) => ({
  startYear: 2030, endYear: 2039, retireYear: 2030, people: [{ name: "Pat", birthYear: 1965, retireAge: 65, endAge: 74 }],
  balances: { cash: 0, taxable: 1000000, deferred: 0, free: 0 }, contributions: [], incomes: [], spending: { yearly: 40000 },
  rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0, stocksNow: 0.5, stocksRetired: 0.5 }, returns: { stocks: 0, bonds: 0 }, rmd: null,
  strategy: "fixed-real", withdrawalRate: 0.04, ...more,
});

test("easeChanges: year fromYear + k spends the figure x (1 - d)^k; nothing for 0, a negative rate or one over 5%", () => {
  assert.deepEqual(easeChanges({ rate: 0, fromYear: 2030, endYear: 2040 }), []);
  assert.deepEqual(easeChanges({ rate: -0.01, fromYear: 2030, endYear: 2040 }), []);
  assert.deepEqual(easeChanges({ rate: EASE_MAX + 0.001, fromYear: 2030, endYear: 2040 }), []);
  assert.deepEqual(easeChanges({ rate: 0.01, fromYear: 2030, endYear: 2032 }), [{ fromYear: 2031, factor: 0.99, ease: true }, { fromYear: 2032, factor: 0.99, ease: true }]);
  // a reader of the level changes alone leaves the yearly steps out (Stress tests' room a month: critic, F1)
  assert.equal(levelFactor(undefined), 1);
  assert.equal(levelFactor(easeChanges({ rate: 0.02, fromYear: 2030, endYear: 2060 })), 1);
  assert.equal(levelFactor([{ fromYear: 2030, factor: 0.7 }, ...easeChanges({ rate: 0.02, fromYear: 2030, endYear: 2060 }), { fromYear: 2040, factor: 0.5 }]), 0.35);
  const r = project(tiny({ spendingChanges: easeChanges({ rate: 0.01, fromYear: 2030, endYear: 2039 }) }));
  r.rows.forEach((row, k) => assert.ok(Math.abs(row.spendingReal - 40000 * Math.pow(0.99, k)) < 1e-6, `year ${k}: ${row.spendingReal}`));
  // by hand: 40,000 x 0.99^9 = 36,540.69 in the tenth year; ten years take 40,000 x (1 - 0.99^10) / 0.01 = 382,471.70
  assert.equal(Math.round(r.rows[9].spendingReal * 100) / 100, 36540.69);
  assert.equal(Math.round((1000000 - r.endBalance) * 100) / 100, 382471.7);
  // with prices rising 3% a year the same holds in today's money: nominal spending still rises, by 1.03 x 0.99 a year
  const p = project(tiny({ rates: { ...tiny().rates, inflation: 0.03 }, spendingChanges: easeChanges({ rate: 0.01, fromYear: 2030, endYear: 2039 }) }));
  p.rows.forEach((row, k) => { assert.ok(Math.abs(row.spendingReal - 40000 * Math.pow(0.99, k)) < 1e-6); if (k) assert.ok(Math.abs(row.spending / p.rows[k - 1].spending - 1.03 * 0.99) < 1e-12); });
  // from a later year: full until then
  const late = project(tiny({ spendingChanges: easeChanges({ rate: 0.02, fromYear: 2034, endYear: 2039 }) }));
  assert.deepEqual(late.rows.map((x) => Math.round(x.spendingReal * 100) / 100), [40000, 40000, 40000, 40000, 40000, 39200, 38416, 37647.68, 36894.73, 36156.83]);
});

test("easeOf: the last full year is the start of retirement, this year for a household already retired, or the age typed", () => {
  const people = [{ birthYear: 1990, retireAge: 65, endAge: 95 }];
  const at = { people, retireYear: 2055, nowYear: 2026, endYear: 2085 };
  assert.equal(easeOf({}, at), null);
  assert.equal(easeOf({ spendingEase: 0 }, at), null);
  assert.deepEqual(easeOf({ spendingEase: 0.01 }, at), { rate: 0.01, fromYear: 2055, fromAge: 65 });
  assert.deepEqual(easeOf({ spendingEase: 0.02, easeFromAge: 75 }, at), { rate: 0.02, fromYear: 2065, fromAge: 75 });
  assert.deepEqual(easeOf({ spendingEase: 0.01, easeFromAge: 50 }, at), { rate: 0.01, fromYear: 2055, fromAge: 65 }, "never before retirement starts");
  assert.deepEqual(easeOf({ spendingEase: 0.01, easeFromAge: "" }, at), { rate: 0.01, fromYear: 2055, fromAge: 65 });
  assert.deepEqual(easeOf({ spendingEase: 0.5 }, at), { rate: EASE_MAX, fromYear: 2055, fromAge: 65 }, "at most 5% a year");
  assert.deepEqual(easeOf({ spendingEase: 0.01 }, { people: [{ birthYear: 1954, retireAge: 65, endAge: 95 }], retireYear: 2026, nowYear: 2026, endYear: 2049 }), { rate: 0.01, fromYear: 2026, fromAge: 72 });
  assert.equal(easeOf({ spendingEase: 0.01, easeFromAge: 95 }, at), null, "no year left after it");
  assert.equal(easedBy({ rate: 0.01, fromYear: 2055 }, 2085), 26);   // 1 - 0.99^30 = 0.2603
  assert.equal(easedBy({ rate: 0.01, fromYear: 2055 }, 2055), 0);
});

test("the plan: d = 1% gives the same spending every year x 0.99^k from retirement on; the ways that take a share get none", () => {
  const plan = withRt(familyPlan(T), { spendingEase: 0.01 });
  const base = projection(familyPlan(T), { today: T }), d = projection(plan, { today: T });
  assert.deepEqual(d.inputs.ease, { rate: 0.01, fromYear: 2055, fromAge: 65 });
  const a = retired(base), b = retired(d);
  // the loan payments in the figure are fixed amounts and do not ease: year k is the rest x 0.99^k, plus that year's loans
  const rest = base.inputs.spending.yearly - (base.inputs.loans ?? []).reduce((t, l) => t + (l.inBase ?? 0), 0);
  b.forEach((row, k) => assert.ok(Math.abs(row.spendingReal - (rest * Math.pow(0.99, k) + (a[k].spendingReal - rest))) < 1e-6, `year ${k}: ${row.spendingReal}`));
  assert.ok(b.at(-1).spendingReal < a.at(-1).spendingReal * 0.76 && b[0].spendingReal === a[0].spendingReal);
  // it lasts longer and can pay for more to start with
  assert.ok(d.atEnd.totalReal > base.atEnd.totalReal && d.affordable > base.affordable);
  assert.equal(d.spendingYearly, base.spendingYearly, "the figure itself is where spending starts");
  for (const strategy of ["percent", "vpw"]) {
    const off = projection(withRt(familyPlan(T), { strategy }), { today: T }), on = projection(withRt(plan, { strategy }), { today: T });
    assert.equal("ease" in on.inputs, false, strategy);
    assert.equal(JSON.stringify(on), JSON.stringify(off), `${strategy}: the share sets the spending`);
  }
  assert.deepEqual(SPEND_RULES, ["fixed-real", "guardrails"]);
  // guardrails: the target eases too (never above the eased plan)
  const g = projection(withRt(plan, { strategy: "guardrails" }), { today: T });
  retired(g).forEach((row, k) => assert.ok(row.spendingReal <= b[k].spendingReal + 1e-6 || row.incomeReal > b[k].spendingReal, `year ${k}`));
});

test("spendingExtras: each key only when the plan sets it", () => {
  const at = { people: [{ birthYear: 1990, retireAge: 65, endAge: 95 }], retireYear: 2055, nowYear: 2026, endYear: 2085, strategy: "fixed-real" };
  assert.deepEqual(spendingExtras({}, at), {});
  assert.deepEqual(spendingExtras({ spendingFloor: 3000 }, at), { spendingFloor: { yearly: 36000 } });
  assert.deepEqual(spendingExtras({ spendingFloor: -5 }, at), {});
  assert.deepEqual(spendingExtras({ guard: { cut: 0.05, raise: 0.05 } }, at), { guard: { cut: 0.05, raise: 0.05, upper: 1.2, lower: 0.8 } });
  assert.deepEqual(spendingExtras({ guard: { cut: 0.1, raise: 0.1, upper: 1.2, lower: 0.8 } }, at), {});
  assert.equal(spendingExtras({ spendingEase: 0.01 }, at).spendingChanges.length, 30);
  assert.deepEqual(spendingExtras({ spendingEase: 0.01 }, { ...at, strategy: "percent" }), {});
});

test("guardRule: the usual numbers unless a sensible one is set; shareWords and strategyWords say the trim", () => {
  assert.deepEqual(guardRule(), { cut: 0.1, raise: 0.1, upper: 1.2, lower: 0.8, custom: false });
  assert.deepEqual(guardRule({ cut: 0.05, raise: 0.05 }), { cut: 0.05, raise: 0.05, upper: 1.2, lower: 0.8, custom: true });
  assert.deepEqual(guardRule({ cut: 9, raise: -1, upper: 0.5, lower: 2 }), { cut: 0.1, raise: 0.1, upper: 1.2, lower: 0.8, custom: false }, "out of range: the usual one");
  assert.deepEqual(guardRule({ cut: "", upper: 1.3, lower: null }), { cut: 0.1, raise: 0.1, upper: 1.3, lower: 0.8, custom: true });
  assert.equal(shareWords(0.1), "a tenth"); assert.equal(shareWords(0.05), "5%"); assert.equal(shareWords(0.15), "15%");
  assert.equal(strategyWords("guardrails"), STRATEGIES.guardrails);
  assert.equal(strategyWords("guardrails", { upper: 1.3 }), STRATEGIES.guardrails, "the bands alone leave the line as it is");
  assert.equal(strategyWords("guardrails", { cut: 0.05, raise: 0.05 }), "What you plan, trimmed by 5% after bad years and raised back after good ones");
  assert.equal(strategyWords("percent", { cut: 0.05 }), STRATEGIES.percent);
});

test("guardrails: cut = 5% trims by 5%, and the bands move when the trim comes", () => {
  // half in stocks, which lose 60% in the first year: 40,000 of 960,000 x 0.7 = 672,000 is 5.95% > 1.2 x 4%: a trim
  const seq = (n) => Array.from({ length: n }, (_, i) => ({ stocks: i === 0 ? -0.6 : 0, bonds: 0, cash: 0, inflation: 0 }));
  const run = (guard) => project(tiny({ strategy: "guardrails", ...(guard ? { guard } : {}) }), { sequence: seq(10) });
  const usual = run(null), five = run({ cut: 0.05, raise: 0.05 }), fifteen = run({ cut: 0.15, raise: 0.15 });
  assert.equal(usual.rows[0].spending, 40000);
  assert.ok(Math.abs(usual.rows[1].spending - 36000) < 1e-9, "the usual tenth");
  assert.ok(Math.abs(five.rows[1].spending - 38000) < 1e-9, "5%");
  assert.ok(Math.abs(fifteen.rows[1].spending - 34000) < 1e-9, "15%");
  // 5.95% is under 1.5 x 4% = 6%: with the upper band at 1.5 nothing is trimmed that year
  assert.equal(run({ upper: 1.5 }).rows[1].spending, 40000);
  // and raised back by the same step once what is taken falls under the lower band: never past the plan's figure
  const up = project(tiny({ strategy: "guardrails", guard: { cut: 0.05, raise: 0.05 } }), { sequence: [{ stocks: -0.6, bonds: 0 }, { stocks: 2, bonds: 0 }, ...seq(8).slice(1)].map((x) => ({ cash: 0, inflation: 0, ...x })) });
  assert.ok(Math.abs(up.rows[1].spending - 38000) < 1e-9);
  assert.ok(Math.abs(up.rows[2].spending - 39900) < 1e-9, "38,000 x 1.05");
  assert.ok(Math.abs(up.rows[3].spending - 39900) < 1e-9, "39,900 of 1,228,100 is 3.25%, between the bands: it stays");
  // a long boom: back at the plan's figure, never past it
  const boom = project(tiny({ strategy: "guardrails", guard: { cut: 0.05, raise: 0.05 } }), { sequence: [{ stocks: -0.6, bonds: 0 }, ...Array.from({ length: 9 }, () => ({ stocks: 1, bonds: 0 }))].map((x) => ({ cash: 0, inflation: 0, ...x })) });
  assert.equal(boom.rows.at(-1).spending, 40000);
  for (const row of boom.rows) assert.ok(row.spending <= 40000);
});

test("the floor: spending never falls under it while savings last (share of savings, years left, guardrails), and a year savings cannot pay it is short", () => {
  // half in stocks, which lose 80% in each of the first two years: savings fall 40% a year
  const crash = Array.from({ length: 10 }, (_, i) => ({ stocks: i < 2 ? -0.8 : 0, bonds: 0, cash: 0, inflation: 0 }));
  for (const strategy of ["percent", "guardrails"]) {
    const free = project(tiny({ strategy }), { sequence: crash });
    const low = Math.min(...retired(free).map((x) => x.spending));
    assert.ok(low < 30000, `${strategy}: without a floor it falls to ${low}`);
    const held = project(tiny({ strategy, spendingFloor: { yearly: 30000 } }), { sequence: crash });
    for (const row of retired(held)) if (row.shortfall === 0) assert.ok(row.spending >= 30000 - 1e-6, `${strategy} ${row.year}: ${row.spending}`);
    assert.ok(held.success, `${strategy}: savings pay 30,000 a year here`);
    // never more than the way itself would spend when that is above the floor
    assert.equal(held.rows[0].spending, free.rows[0].spending, `${strategy}: the first year is the way's own`);
  }
  // by hand, a share of what is left: 1,000,000 x 4% = 40,000; then 960,000 x 0.6 = 576,000 x 4% = 23,040 -> 30,000
  const p = project(tiny({ strategy: "percent", spendingFloor: { yearly: 30000 } }), { sequence: crash });
  assert.equal(p.rows[0].spending, 40000);
  assert.equal(p.rows[1].spending, 30000);
  assert.ok(Math.abs(p.rows[1].total - (576000 - 30000) * 0.6) < 1e-6);
  // the years left: 100,000, 60,000, then 288,000 over eight years is 36,000 a year. A floor of 38,000 is held for seven
  // years (266,000); the eighth finds 22,000 and is short
  const v = project(tiny({ strategy: "vpw", spendingFloor: { yearly: 38000 } }), { sequence: crash });
  assert.deepEqual(v.rows.map((x) => Math.round(x.spending)), [100000, 60000, 38000, 38000, 38000, 38000, 38000, 38000, 38000, 38000]);
  assert.equal(v.success, false); assert.equal(v.failYear, 2039);
  assert.ok(Math.abs(v.rows[9].shortfall - 16000) < 1e-6);
  assert.deepEqual(project(tiny({ strategy: "vpw" }), { sequence: crash }).rows.slice(2).map((x) => Math.round(x.spending)), Array(8).fill(36000));
  // income pays part of the floor: the share is raised only by what is missing (floor - income), no more
  const inc = project(tiny({ strategy: "percent", spendingFloor: { yearly: 30000 }, incomes: [{ name: "Pension", yearly: 20000, personIndex: 0, startAge: 60, taxable: false }], balances: { cash: 0, taxable: 100000, deferred: 0, free: 0 } }));
  assert.equal(inc.rows[0].spending, 30000);   // 4% of 100,000 is 4,000; with 20,000 of income that is 24,000: raised to 30,000
  assert.equal(inc.rows[0].withdrawn.taxable, 10000);
  // a floor savings cannot pay: the year is short and the plan says so (as the same spending every year does)
  const dry = project(tiny({ strategy: "percent", spendingFloor: { yearly: 200000 } }));
  assert.equal(dry.success, false);
  assert.equal(dry.failYear, 2035, "1,000,000 pays 200,000 for five years");
  // the same spending every year ignores it
  assert.equal(JSON.stringify(project(tiny({ spendingFloor: { yearly: 90000 } }))), JSON.stringify(project(tiny())));
  // guardrails: the floor never lifts the target past the plan's own figure
  const g = project(tiny({ strategy: "guardrails", spendingFloor: { yearly: 90000 } }), { sequence: crash });
  for (const row of retired(g)) assert.ok(row.spending <= 40000 + 1e-9);
  assert.equal(g.rows[2].spending, 40000, "held at the plan's figure: it is the lower of the two");
  // with tax: the floor is what is spent after the year's tax (the flat rate on pre-tax money)
  const taxed = project(tiny({ strategy: "percent", spendingFloor: { yearly: 30000 }, balances: { cash: 0, taxable: 0, deferred: 300000, free: 0 }, rates: { ...tiny().rates, taxRate: 0.2 } }));
  assert.ok(Math.abs(taxed.rows[0].spending - 30000) < 1e-3, String(taxed.rows[0].spending));
  assert.ok(Math.abs(taxed.rows[0].withdrawn.deferred - 37500) < 1e-3, "30,000 / (1 - 20%)");
});

test("the floor on the invented households: never broken while savings last, in average markets and in the worst of history", async () => {
  const { RETURNS } = await import("../modules/retirement/historical/data/returns.js");
  for (const [who, plan] of [["family", familyPlan(T)], ["retired couple", retiredCouplePlan()], ["late fifties", retirementPlan()]]) {
    for (const strategy of ["percent", "vpw", "guardrails"]) {
      const b = buildInputs(withRt(plan, { strategy, spendingFloor: 3000 }), { today: T });
      assert.deepEqual(b.inputs.spendingFloor, { yearly: 36000 });
      const years = b.inputs.endYear - b.inputs.startYear + 1;
      const least = strategy === "guardrails" ? Math.min(36000, b.inputs.spending.yearly) : 36000;
      const runs = [project(b.inputs)];
      for (let s = 0; s + years <= RETURNS.length; s += 7) runs.push(project(b.inputs, { sequence: RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation })) }));
      for (const r of runs) for (const row of retired(r)) if (row.shortfall === 0) assert.ok(row.spendingReal >= least - 0.01, `${who} ${strategy} ${row.year}: ${row.spendingReal}`);
    }
  }
});

test("Monte Carlo and What if history repeated read the same inputs: each moves with the new fields", () => {
  const plan = retirementPlan();
  const eased = withRt(plan, { spendingEase: 0.02 });
  const mc0 = monteCarlo(plan, { today: T, paths: 200, careful: false }), mc1 = monteCarlo(eased, { today: T, paths: 200, careful: false });
  assert.ok(mc1.successRate >= mc0.successRate && JSON.stringify(mc1.bands) !== JSON.stringify(mc0.bands), `${mc0.successRate} -> ${mc1.successRate}`);
  const h0 = historical(plan, { today: T, quick: true }), h1 = historical(eased, { today: T, quick: true });
  assert.ok(h1.successRate >= h0.successRate && h1.medianEndReal > h0.medianEndReal);
  // the floor and the guard, on a way that uses them
  const g0 = withRt(plan, { strategy: "guardrails" }), g1 = withRt(g0, { guard: { cut: 0.05, raise: 0.05 }, spendingFloor: 6000 });
  assert.notEqual(JSON.stringify(monteCarlo(g1, { today: T, paths: 200, careful: false }).bands), JSON.stringify(monteCarlo(g0, { today: T, paths: 200, careful: false }).bands));
  assert.notEqual(JSON.stringify(historical(g1, { today: T, quick: true }).runs), JSON.stringify(historical(g0, { today: T, quick: true }).runs));
  // and the most it can pay (the same spending every year, eased) is found on the eased path
  const b = buildInputs(eased, { today: T });
  assert.ok(affordableSpending(b.inputs) > affordableSpending(buildInputs(plan, { today: T }).inputs));
});

test("guardrails with easing on: the lowest spending accepted holds against the easing too, and never lifts spending past the plan's figure before easing", async () => {
  // (critic of gap design #4, F2: the floor was capped at the eased figure, so the family's $6,500 a month fell to about
  // $4,100 while the page said "never under")
  const { familyPlan } = await import("../qa/fixtures/family-plan.mjs");
  const floor = 6500;
  const p = withRt(familyPlan(T), { strategy: "guardrails", spendingEase: 0.02, spendingFloor: floor });
  const b = buildInputs(p, { today: T });
  assert.ok(b.inputs.spending.yearly > floor * 12, "the plan starts above the floor");
  const r = project(b.inputs);
  assert.equal(r.success, true);
  const rows = retired(r);
  assert.ok(Math.min(...rows.map((x) => x.spendingReal)) >= floor * 12 - 0.5, `lowest ${Math.min(...rows.map((x) => x.spendingReal))}`);
  // it still eases down to the floor, then stays there
  assert.ok(Math.abs(rows.at(-1).spendingReal - floor * 12) < 1, `${rows.at(-1).spendingReal}`);
  assert.ok(rows[0].spendingReal > rows.at(-1).spendingReal);
  // a floor above the plan lifts nothing past the plan's own figure
  const high = project(buildInputs(withRt(familyPlan(T), { strategy: "guardrails", spendingEase: 0.02, spendingFloor: 50000 }), { today: T }).inputs);
  const plain = project(buildInputs(withRt(familyPlan(T), { strategy: "guardrails" }), { today: T }).inputs);
  for (const x of retired(high)) assert.ok(x.spendingReal <= retired(plain)[0].spendingReal + 0.5, `${x.year}: ${x.spendingReal}`);
  // by hand: $1,000,000 in cash, no growth, no prices, $40,000 a year easing 5%, a floor of $36,000: 40,000, 38,000, 36,100, then 36,000 for good
  const hand = project(tiny({ strategy: "guardrails", spendingChanges: easeChanges({ rate: 0.05, fromYear: 2030, endYear: 2039 }), spendingFloor: { yearly: 36000 } }));
  assert.deepEqual(retired(hand).slice(0, 4).map((x) => Math.round(x.spendingReal)), [40000, 38000, 36100, 36000]);
  assert.ok(retired(hand).slice(3).every((x) => Math.round(x.spendingReal) === 36000));
});
