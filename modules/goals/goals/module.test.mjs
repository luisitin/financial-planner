import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { pmtToReach, fv, inflate } from "../../../core/math/finance.js";

const TODAY = "2026-09-15";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.neededMonthly, 0); assert.equal(d.totalTarget, 0);
});
test("a two-year goal uses the cash rate; needed monthly matches pmtToReach; status behind without contributions", () => {
  const p = emptyPlan();
  p.goals.push({ id: "g", name: "Car", target: 12000, targetDate: "2028-09-15", saved: 2000, monthly: 0, inflates: false });
  const d = compute(p, { today: TODAY });
  const g = d.goals[0];
  assert.equal(g.monthsLeft, 24);
  assert.equal(g.rate, 0.02, "under 3 years: the plan's cash return");
  assert.equal(g.targetThen, 12000);
  assert.equal(g.funded, 2000);
  near(g.neededMonthly, pmtToReach(0.02 / 12, 24, 12000, 2000));
  assert.equal(g.status, "behind");
  near(g.progress, 2000 / 12000, 1e-9);
});
test("a five-year inflating goal uses the bond rate and grows the target; enough monthly means on track", () => {
  const p = emptyPlan();
  p.goals.push({ id: "g", name: "Down payment", target: 60000, targetDate: "2031-09-15", saved: 10000, monthly: 900, inflates: true });
  const d = compute(p, { today: TODAY });
  const g = d.goals[0];
  assert.equal(g.rate, 0.04);
  near(g.targetThen, inflate(60000, 0.03, 5));
  near(g.projected, fv(0.04 / 12, 60, 900, 10000));
  assert.equal(g.status, g.projected >= g.targetThen ? "on track" : "behind");
  assert.ok(g.projected > g.targetThen, "900/mo for 5 years from 10k beats ~69.6k");
});
test("money in a linked account counts; missing account warns; done when funded", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 15000 });
  p.goals.push({ id: "g1", name: "Emergency fund", target: 15000, fundedBy: ["s"] }, { id: "g2", name: "Ghost", target: 100, fundedBy: ["gone"] });
  const d = compute(p, { today: TODAY });
  assert.equal(d.goals[0].funded, 15000);
  assert.equal(d.goals[0].status, "done");
  assert.deepEqual(d.goals[0].fundedFrom, ["Savings"]);
  assert.equal(d.done, 1);
  assert.ok(d.warnings.some((w) => w.includes("no longer exists")));
  assert.equal(d.goals[1].status, "no date");
});
test("past due, no amount, own rate, and totals", () => {
  const p = emptyPlan();
  p.goals.push(
    { id: "a", name: "Late", target: 1000, targetDate: "2026-01-01", saved: 100 },
    { id: "b", name: "Blank", target: 0 },
    { id: "c", name: "Own rate", target: 1200, targetDate: "2027-09-15", rate: 0, monthly: 100 },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.goals[0].status, "past due");
  assert.ok(d.warnings.some((w) => w.includes("date has passed")));
  assert.equal(d.goals[1].status, "no amount");
  assert.equal(d.goals[2].rate, 0);
  assert.equal(d.goals[2].neededMonthly, 100);
  assert.equal(d.goals[2].status, "on track");
  assert.equal(d.totalTarget, 2200);
  assert.equal(d.totalFunded, 100);
  assert.equal(d.contributing, 100);
  near(d.neededMonthly, 900 + 100, 1e-9, "past-due goal needs the whole remainder now (n = 0)");
});

test("a goal leads to the page that works out its cost, and says that page's figure when it differs by 5% or more", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { plannerFor, plannerFigure, plannerDiffers } = await import("./compute.js");
  const { compute: education } = await import("../education/compute.js");
  const { compute: vehicle } = await import("../vehicle/compute.js");
  const p = familyPlan("2026-11-02"), T = { today: "2026-11-02" };
  const rows = compute(p, T).goals, byId = (id) => p.goals.find((g) => g.id === id), row = (id) => rows.find((g) => g.id === id);
  assert.deepEqual(p.goals.map((g) => plannerFor(g)?.page ?? null), ["goals/emergency-fund", "goals/vehicle", "goals/education", "goals/travel"]);
  const col = plannerFigure(byId("g-col"), row("g-col"), "goals/education", education(p, T));
  assert.equal(col.amount, Math.round(education(p, T).children[0].totalToday / 1000) * 1000, "rounded as Education's own Update rounds it"); assert.equal(plannerDiffers(byId("g-col"), col), true);
  assert.equal(plannerFigure(byId("g-car"), row("g-car"), "goals/vehicle", vehicle(p, T)), null, "no price on the Vehicle page: it would add sales tax to the goal's own amount on every tap");
  p.whatIfs = { ...(p.whatIfs ?? {}), vehicle: { price: 27000 } };
  const v = vehicle(p, T), car = plannerFigure(byId("g-car"), row("g-car"), "goals/vehicle", v);
  // the car's net (purchase-day dollars) scaled back to today's like the goal's own amount: target x net / targetThen
  assert.ok(Math.abs(car.amount - 25000 * v.net / row("g-car").targetThen) < 1e-6); assert.equal(car.shown, v.net);
  assert.equal(plannerFigure(byId("g-trip"), row("g-trip"), "goals/vehicle", v), null, "the Vehicle page works out another goal");
  assert.equal(plannerDiffers({ target: 100000 }, { amount: 104000 }), false, "under 5%: not mentioned");
});

test("review: the planners' figures settle, follow the page's own choices, and only reach the goal they are about", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { plannerFor, plannerFigure, plannerDiffers } = await import("./compute.js");
  const { compute: education } = await import("../education/compute.js");
  const { compute: emergency } = await import("../emergency-fund/compute.js");
  const T = { today: "2026-11-02" };
  const fig = (p, id, page, r) => { const rows = compute(p, T).goals; return plannerFigure(p.goals.find((g) => g.id === id), rows.find((g) => g.id === id), page, r, p); };
  // Education: the share chosen there, rounded the same way as its Update button, so the two never argue
  const half = familyPlan("2026-11-02"); half.whatIfs = { ...(half.whatIfs ?? {}), college: { "p-cy": { type: "public", share: 0.5 } } };
  const c = education(half, T).children[0];
  const fh = fig(half, "g-col", "goals/education", education(half, T));
  assert.equal(fh.amount, Math.round(c.totalToday * 0.5 / 1000) * 1000); assert.match(fh.words, /for 50% of it/);
  half.goals.find((g) => g.id === "g-col").target = fh.amount;
  assert.equal(plannerDiffers(half.goals.find((g) => g.id === "g-col"), fig(half, "g-col", "goals/education", education(half, T))), false, "taken once, it settles");
  // a goal that does not grow: the dollars of those years
  const flat = familyPlan("2026-11-02"); flat.goals.find((g) => g.id === "g-col").inflates = false;
  const ff = fig(flat, "g-col", "goals/education", education(flat, T));
  assert.equal(ff.amount, Math.round(education(flat, T).children[0].total / 1000) * 1000); assert.match(ff.words, /dollars of those years/);
  // a grown-up's degree is not the child's college
  const grad = familyPlan("2026-11-02");
  grad.goals = grad.goals.filter((g) => g.id !== "g-col").concat([{ id: "g-grad", name: "Bo's grad school", icon: "🎓", target: 30000, targetDate: "2028-09-01", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }]);
  assert.equal(fig(grad, "g-grad", "goals/education", education(grad, T)), null);
  // Emergency fund: only the ticked goal gets an amount, the target less the other cash that counts
  const ef = familyPlan("2026-11-02"); const eg = ef.goals.find((g) => plannerFor(g)?.page === "goals/emergency-fund");
  const fe = fig(ef, eg.id, "goals/emergency-fund", emergency(ef, T));
  assert.equal(fe.amount, null); assert.match(fe.note, /ticked as your emergency fund/); assert.equal(plannerDiffers(eg, fe), false);
  eg.isEmergencyFund = true;
  const r = emergency(ef, T), row = compute(ef, T).goals.find((g) => g.id === eg.id);
  const ft = fig(ef, eg.id, "goals/emergency-fund", r);
  assert.ok(Math.abs(ft.amount - (r.target - (r.now - row.funded))) < 1e-6, "the other cash is not saved twice");
  // names: a roof, repairs, a trip home and a car loan are not a house or a car to buy
  assert.equal(plannerFor({ name: "New roof for the house" }), null); assert.equal(plannerFor({ name: "Home repairs" })?.page ?? null, null);
  assert.equal(plannerFor({ name: "Trip home to see Grandma" }).page, "goals/travel");
  assert.equal(plannerFor({ name: "Pay off the car loan", icon: "🚗" }), null);
});
