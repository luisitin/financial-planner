import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.monthly, 0); assert.equal(d.yearly, 0); assert.deepEqual(d.byPerson, []);
});
test("pay periods are normalised: 2,000 every two weeks is 52,000 a year, 4,333.33 a month", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self" });
  p.income.push({ id: "i1", name: "Ana's pay", type: "salary", personId: "a", amount: 2000, period: "biweekly", growth: 0.03, taxable: true });
  const d = compute(p, { today: TODAY });
  assert.equal(d.yearly, 52000);
  near(d.monthly, 4333.33);
  near(d.nextYear, 53560);
  assert.equal(d.items[0].personName, "Ana");
  assert.equal(d.byPerson[0].name, "Ana");
  assert.equal(d.taxableYearly, 52000);
  assert.equal(d.untaxedYearly, 0);
});
test("start and end dates decide what counts today; one-offs stay out of the monthly total", () => {
  const p = emptyPlan();
  p.income.push(
    { id: "i1", name: "Job", type: "salary", amount: 5000, period: "monthly" },
    { id: "i2", name: "New job", type: "salary", amount: 6000, period: "monthly", startDate: "2027-01-01" },
    { id: "i3", name: "Old gig", type: "business", amount: 1000, period: "monthly", endDate: "2026-06-30" },
    { id: "i4", name: "Tax refund", type: "other", amount: 1500, period: "once", taxable: false },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.monthly, 5000);
  assert.equal(d.active.length, 2, "job and the one-off");
  assert.equal(d.items[1].upcoming, true);
  assert.equal(d.items[2].ended, true);
  assert.equal(d.oneTime, 1500);
  assert.equal(d.untaxedYearly, 0, "a one-off has no yearly amount");
  assert.equal(d.items[0].personName, "Household");
});
test("warnings: no amount, ends before it starts, growth typed as 300", () => {
  const p = emptyPlan();
  p.income.push({ id: "i1", name: "Nothing", type: "other", amount: 0, period: "monthly" }, { id: "i2", name: "Backwards", type: "other", amount: 1, period: "monthly", startDate: "2026-02-01", endDate: "2026-01-01" }, { id: "i3", name: "Rocket", type: "salary", amount: 1, period: "monthly", growth: 3 });
  const w = compute(p, { today: TODAY }).warnings;
  assert.ok(w.some((x) => x.includes("no amount")));
  assert.ok(w.some((x) => x.includes("ends before")));
  assert.ok(w.some((x) => x.includes("Raises are usually")));
});
test("byType sums yearly amounts per kind", () => {
  const p = emptyPlan();
  p.income.push({ id: "1", name: "a", type: "salary", amount: 100, period: "monthly" }, { id: "2", name: "b", type: "salary", amount: 100, period: "monthly" }, { id: "3", name: "c", type: "rental", amount: 1200, period: "annual" });
  assert.deepEqual(compute(p).byType, { salary: 2400, rental: 1200 });
});
test("looksYearly: a salary over $480,000 a year not typed as yearly is asked about; others are not", async () => {
  const { looksYearly, ASK_YEARLY_ABOVE } = await import("./compute.js");
  assert.equal(ASK_YEARLY_ABOVE, 480000);
  assert.deepEqual(looksYearly({ type: "salary", amount: 72000, period: "monthly" }), { yearly: 864000, asIf: 72000 });
  assert.equal(looksYearly({ type: "salary", amount: 40000, period: "monthly" }), null, "exactly $480,000 a year: not asked");
  assert.ok(looksYearly({ type: "salary", amount: 40001, period: "monthly" }));
  assert.equal(looksYearly({ type: "business", amount: 72000, period: "monthly" }), null, "only pay");
  assert.equal(looksYearly({ type: "salary", amount: 900000, period: "annual" }), null, "typed as a year: believed");
  assert.deepEqual(looksYearly({ type: "salary", amount: 20000, period: "biweekly" }), { yearly: 520000, asIf: 20000 });
  assert.equal(looksYearly({ type: "salary", amount: 72000, period: "once" }), null);
});

test("a raise from a later date keeps today's pay until then (round 4, 2026-11-02): changeFrom splits it; next year counts the raise", async () => {
  const { changeFrom } = await import("./compute.js");
  const T = "2026-11-02";
  const ana = { id: "i1", name: "Ana's salary", type: "salary", personId: "p-ana", amount: 3900, period: "biweekly", growth: 0.03, startDate: "", endDate: "", taxable: true };
  const ch = changeFrom(ana, { ...ana, amount: 4200, startDate: "2027-01-01" }, T);
  assert.equal(ch.split, true);
  // review 2026-11-02, round 5: the pay that ends keeps its id; the new pay has none (the page gives it one) and says which
  // line it carries on
  assert.deepEqual(ch.old, { ...ana, endDate: "2026-12-31" }, "the pay on file runs until the day before, unchanged");
  assert.deepEqual(ch.next, { name: "Ana's salary", type: "salary", personId: "p-ana", amount: 4200, period: "biweekly", growth: 0.03, startDate: "2027-01-01", endDate: "", taxable: true, continues: "i1" });
  near(ch.change, (4200 - 3900) * 26 / 12);
  // the plan keeps today's pay now, and the raise a year from now
  const plan = { ...emptyPlan(), income: [ch.old, { id: "i2", ...ch.next }] };
  const d = compute(plan, { today: T });
  near(d.monthly, 3900 * 26 / 12); near(d.nextYear, 4200 * 26, 0.01);
  // not split: no date, a date already past, only the name changed, or an income that has not started yet
  assert.equal(changeFrom(ana, { ...ana, amount: 4200 }, T).split, false);
  assert.equal(changeFrom(ana, { ...ana, amount: 4200, startDate: "2026-10-01" }, T).split, false);
  assert.equal(changeFrom(ana, { ...ana, name: "Pay", startDate: "2027-01-01" }, T).split, false);
  assert.equal(changeFrom({ ...ana, startDate: "2026-12-01" }, { ...ana, amount: 4200, startDate: "2027-01-01" }, T).split, false);
  // an end date already before the new start is kept
  assert.equal(changeFrom({ ...ana, endDate: "2026-12-15" }, { ...ana, endDate: "", amount: 4200, startDate: "2027-01-01" }, T).old.endDate, "2026-12-15");
});

test("a raise from a later date: one chain (review 2026-11-02, round 5): the setup's id and the careful figure stay, the new pay continues the line", async () => {
  const { changeFrom, chainId, countedOn } = await import("./compute.js");
  const T = "2026-11-02";
  // the setup's own pay line keeps its id (Get started's pay question answers with today's pay); the new pay is marked a
  // typical year, so the Forecast still spreads it without the setup's id
  const setup = { id: "setup-pay-p-ana", name: "Ana's business", type: "business", personId: "p-ana", amount: 90000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true };
  const sp = changeFrom(setup, { ...setup, amount: 96000, startDate: "2027-01-01" }, T);
  assert.equal(sp.old.id, "setup-pay-p-ana"); assert.equal("typicalYear" in sp.old, false);
  assert.equal("id" in sp.next, false); assert.equal(sp.next.continues, "setup-pay-p-ana"); assert.equal(sp.next.typicalYear, true);
  const marked = changeFrom({ ...setup, id: "x1", typicalYear: true }, { ...setup, amount: 96000, startDate: "2027-01-01" }, T);
  assert.equal(marked.next.typicalYear, true); assert.equal(marked.old.typicalYear, true, "kept on the line that has it");
  // the Forecast spreads both halves over the months (the ending one by the setup's id, the new one by typicalYear):
  // a year's pay never lands in the two weeks before the start date
  const { compute: forecast } = await import("../forecast/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fp = familyPlan(T); fp.income = fp.income.filter((x) => x.type !== "business");
  const ana60 = { ...setup, amount: 60000 }, s60 = changeFrom(ana60, { ...ana60, amount: 66000, startDate: "2027-01-01" }, T);
  fp.income.push(s60.old, { id: "n60", ...s60.next });
  const dep = forecast(fp, { today: T, days: 120 }).days.flatMap((x) => x.events.filter((e) => e.name === "Ana's business").map((e) => [x.date, Math.round(e.amount)]));
  assert.deepEqual(dep.slice(0, 3), [["2026-11-15", 5000], ["2026-12-15", 5000], ["2027-01-01", 5500]]);
  const plain = changeFrom({ ...setup, id: "x2", period: "monthly", amount: 7000 }, { ...setup, period: "monthly", amount: 7500, startDate: "2027-01-01" }, T);
  assert.equal("typicalYear" in plain.next, false, "any other line: not marked");
  // the careful figure goes on with the new pay (repeating business pay only); countedOn ignores it at or above a lower amount
  const side = { id: "i-side", name: "Weekend photography", type: "business", personId: "", amount: 600, period: "monthly", countOn: 300 };
  const up = changeFrom(side, { ...side, amount: 900, startDate: "2027-01-01" }, T);
  assert.equal(up.old.countOn, 300); assert.equal(up.next.countOn, 300); assert.equal(countedOn(up.next), 300);
  assert.equal(countedOn(changeFrom(side, { ...side, amount: 250, startDate: "2027-01-01" }, T).next), null);
  assert.equal("countOn" in changeFrom(side, { ...side, type: "salary", amount: 900, startDate: "2027-01-01" }, T).next, false, "a new kind drops it");
  assert.equal("countOn" in changeFrom(side, { ...side, period: "once", amount: 900, startDate: "2027-01-01" }, T).next, false, "one time drops it");
  // chainId: the line's own id, or the first line of the chain; a second raise on the new pay still continues the first line
  assert.equal(chainId(side), "i-side"); assert.equal(chainId({ id: "n1", ...up.next }), "i-side");
  const again = changeFrom({ id: "n1", ...up.next }, { ...up.next, amount: 1200, startDate: "2027-06-01" }, "2027-02-01");
  assert.equal(again.old.id, "n1"); assert.equal(again.old.continues, "i-side"); assert.equal(again.next.continues, "i-side");
  assert.equal(chainId(null), undefined);
});
