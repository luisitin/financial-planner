// tests/retype-and-pay.test.mjs -- L11 (spec rv/spec.md: gap 8 and defect A; 2026-11-13). Both were fixed by claude-c's left2
// commit (cb820f2: its B1 with fix round 1's B-1 and B-3, and its B2) before this lane reached them; its tests read one plan
// each (tests/left2-merge-items.test.mjs, tests/left2-fix1.test.mjs). These hold the two rules across the qa plans, and pin the
// markers the spending box writes. On fe678cb, before left2, the Dana & Lee, marker, family and sweep tests fail (build notes).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as P from "../modules/retirement/projection/compute.js";
import * as S from "../modules/overview/setup/compute.js";
import { compute as expenses } from "../modules/cashflow/expenses/compute.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { retypeHousehold } from "../qa/fixtures/retype-households.mjs";

const T = "2026-11-11";
const RANK = { short: 0, tight: 1, "on track": 2 };
/** Better or the same: a higher verdict, or the same verdict lasting as long (short: the same or a later age). */
const notWorse = (after, before) => RANK[after.verdict] > RANK[before.verdict]
  || (after.verdict === before.verdict && (after.verdict !== "short" || (after.shortAge ?? 0) >= (before.shortAge ?? 0)));
const typed = (plan, v, shown) => { const q = structuredClone(plan); P.saveSpendingFigure(q, v, shown); return q; };

async function plans() {
  const ROOT = fileURLToPath(new URL("..", import.meta.url));
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) { try { out.push([`${f}:${name}`, fn()]); } catch { /* needs arguments */ } }
  }
  for (const a of ARCHETYPES) out.push([a.id, a.build()]);
  for (const [name, fn] of Object.entries(phone)) out.push([`phone ${name}`, fn()]);
  for (const n of ["12", "14"]) out.push([`retype ${n}`, retypeHousehold(n)]);
  return out.map(([name, p]) => [name, migrate(p)]);
}
const ALL = await plans();

test("gap 8: Dana & Lee, built through Get started and reading today's bills: typing the bills' own $6,430 keeps 'tight'; $5,500 is not worse", () => {
  const p = migrate(emptyPlan());
  S.applyYou(p, { name: "Dana", who: "spouse", partnerName: "Lee", kids: 0, state: "NC" });
  S.applyMoney(p, { today: T, people: { "setup-self": { status: "work", amount: "78000", period: "annual", plan: "yes" }, "setup-partner": { status: "work", amount: "52000", period: "annual", plan: "yes" } } });
  S.applyAges(p, { people: { "setup-self": { month: 4, year: 1979, stopAge: 65, ss: { mode: "estimate" } }, "setup-partner": { month: 9, year: 1981, stopAge: 65, ss: { mode: "estimate" } } } }, T);
  S.applyHavePicks(p, ["checking", "savings", "retire", "home"]);
  S.applyHaveAmounts(p, { checking: 6000, savings: 22000, home: 360000, "retire-setup-self": 85000, "kind-setup-self": "work", "contrib-setup-self": 400, "match-setup-self": 200, "retire-setup-partner": 30000, "kind-setup-partner": "work", "contrib-setup-partner": 150 }, T);
  S.applyOwePicks(p, ["mortgage"]);
  S.applyOweAmounts(p, { mortgage: { owed: 240000, rate: "6.2", payment: 1900 } }, T);
  S.applySpend(p, { mode: "rows", rows: { housing: 450, utilities: 380, groceries: 900, transport: 600, insurance: 500, dining: 800, shopping: 900 } }, T);
  // the builder variant the verify pass reproduced (verify-code, "Gap 8 reproduced"): no retirement figure, so the plan reads the bills
  p.retirement.spendingMonthly = null; delete p.guide.setup.retireAuto; delete p.guide.setup.retireHeld;
  const d = P.compute(p, { today: T });
  assert.equal(d.spendingSource, "expenses");
  const bills = expenses(p, { today: T }).monthly;
  assert.equal(Math.round(bills), 6430);
  // by hand: the figure typed over the bills stands for them scaled to it (figure / bills = 1 here), so the same loans and the same
  // health cover come out of it: the very same answer. Before left2 the mortgage was spent for life: short at 77
  const same = P.compute(typed(p, 6430, null), { today: T });
  assert.equal(same.verdict, d.verdict);
  assert.equal(d.verdict, "tight");
  assert.ok(Math.abs(same.affordable / same.spendingYearly - d.affordable / d.spendingYearly) < 0.005);
  assert.equal((same.inputs.loans ?? []).length, (d.inputs.loans ?? []).length);
  assert.ok(notWorse(P.compute(typed(p, 5500, null), { today: T }), d), "less spending is never a worse answer (it was short at 90)");
});

test("gap 8: the spending box's markers: over today's bills, over Get started's own figure, and cleared", () => {
  const bills = migrate(familyPlan(T)); delete bills.retirement.spendingMonthly;
  const a = typed(bills, 5000, null);
  assert.equal(a.retirement.spendingFrom, "expenses"); assert.equal(a.guide?.setup?.retireHeld, undefined);
  const b = typed(a, 4800, 5000);   // typed again: still the bills, scaled
  assert.equal(b.retirement.spendingFrom, "expenses");
  const c = typed(b, "", 4800);     // cleared: the plan reads the bills again, no marker left
  assert.equal(c.retirement.spendingFrom, undefined); assert.equal(c.retirement.spendingMonthly, null);
  const auto = migrate(familyPlan(T)); auto.guide = { setup: { retireAuto: true } };
  const shown = P.compute(auto, { today: T }).figureMonthly;
  const kept = typed(auto, shown, shown);   // the figure the box showed, saved again: still Get started's own
  assert.equal(kept.guide.setup.retireAuto, true); assert.equal(kept.guide.setup.retireHeld, undefined);
  const mine = typed(auto, shown - 100, shown);
  assert.equal(mine.guide.setup.retireAuto, false); assert.equal(mine.guide.setup.retireHeld, true);
  assert.equal(typed(mine, "", shown - 100).guide.setup.retireHeld, undefined);
});

test("gap 8 across the qa plans: the bills' total typed keeps the verdict, 10% less is never worse, Get started's figure again changes nothing", () => {
  let fromBills = 0, fromSetup = 0;
  for (const [name, p] of ALL) {
    let d; try { d = P.compute(p, { today: T }); } catch { continue; }
    if (!d.ready) continue;
    if (d.spendingSource === "expenses") {
      fromBills++;
      const bills = Math.round(expenses(p, { today: T }).monthly);
      const same = P.compute(typed(p, bills, null), { today: T });
      assert.equal(same.verdict, d.verdict, `${name}: ${bills} typed`);
      assert.ok(notWorse(P.compute(typed(p, Math.round(bills * 0.9), null), { today: T }), d), `${name}: 10% less`);
    } else if (p.guide?.setup?.retireAuto === true && d.figureMonthly) {
      fromSetup++;
      assert.equal(JSON.stringify(P.compute(typed(p, d.figureMonthly, d.figureMonthly), { today: T })), JSON.stringify(d), `${name}: same figure`);
      assert.ok(notWorse(P.compute(typed(p, Math.round(d.figureMonthly * 0.9), d.figureMonthly), { today: T }), d), `${name}: 10% less`);
    }
  }
  assert.ok(fromBills >= 15 && fromSetup >= 1, `${fromBills} plans read the bills, ${fromSetup} Get started's figure`);
});

test("defect A: Bo working to 75 pays the tax on his own pay; savings are the same in brackets mode as in flat mode every working year", () => {
  const run = (mode) => { const p = migrate(familyPlan(T)); p.retirement.taxMode = mode; p.household.people.find((x) => x.id === "p-bo").retirementAge = 75; return P.compute(p, { today: T }); };
  const flat = run("flat"), brackets = run("brackets");
  const y0 = brackets.rows[0];
  // by hand: Bo's pay $5,200 + $600 a month = $69,600 in 2026; married filing jointly, less the $32,200 standard deduction,
  // $37,400 is taxed: 10% of $24,800 + 12% of $12,600 = $2,480 + $1,512 = $3,992, paid out of that pay
  assert.equal(Math.round(y0.income), 69600);
  assert.equal(Math.round(y0.taxes), 3992);
  for (const [f, b] of flat.rows.filter((r) => !r.retired).map((r, i) => [r, brackets.rows[i]])) {
    const out = b.withdrawn.cash + b.withdrawn.taxable + b.withdrawn.deferred + b.withdrawn.free;
    assert.ok(out < 0.005, `${b.year}: ${out} taken from savings`);
    assert.ok(Math.abs(f.total - b.total) < 0.01, `${b.year}: ${f.total} vs ${b.total}`);
  }
});

test("defect A across the qa plans, brackets mode: in a working year with no health cover or one-off, savings pay nothing beyond a required withdrawal", () => {
  // (a required withdrawal's year is checked too since the critics' review of 2026-11-13: the income's own tax came off it,
  // tests/working-and-retired-years.test.mjs works one by hand)
  let years = 0;
  for (const [name, p0] of ALL) {
    const p = structuredClone(p0); p.retirement = { ...(p.retirement ?? {}), taxMode: "brackets" };
    let d; try { d = P.compute(p, { today: T }); } catch { continue; }
    if (!d.ready) continue;
    for (const r of d.rows) {
      if (r.retired || r.eventOut > 0 || !(r.income > 0)) continue;
      years++;
      const out = r.withdrawn.cash + r.withdrawn.taxable + r.withdrawn.deferred + r.withdrawn.free - r.rmd;
      assert.ok(out < 0.005, `${name} ${r.year}: ${out} taken from savings with ${r.income} of income and ${r.taxes} of tax`);
    }
  }
  assert.ok(years >= 100, `${years} working years with income checked`);
});
