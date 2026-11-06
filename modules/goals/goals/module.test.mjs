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
  // (review UX 9: "The date for Late has passed", not "Late's date has passed")
  assert.ok(d.warnings.some((w) => w.startsWith("The date for Late has passed")));
  assert.equal(d.goals[1].status, "no amount");
  assert.equal(d.goals[2].rate, 0);
  assert.equal(d.goals[2].neededMonthly, 100);
  assert.equal(d.goals[2].status, "on track");
  assert.equal(d.totalTarget, 2200);
  assert.equal(d.totalFunded, 100);
  assert.equal(d.contributing, 100);
  // round 8 item 18: a goal whose date has passed is due now, not a month's saving: it is left out of "Needed each month"
  // (it used to add its whole remainder, so one college goal dated 2023 read "$105,576 needed each month")
  near(d.neededMonthly, 100, 1e-9, "only the dated goal still ahead");
  assert.equal(d.goals[0].neededMonthly, null);
  near(d.goals[0].dueNow, 900, 1e-9); near(d.dueNow, 900, 1e-9);
  assert.equal(d.goals[2].dueNow, undefined, "a goal still ahead is not due now");
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

// Round 8 batch 2 review (UX 4 and 9): "Child 2's college's date has passed. Set a new date or mark it done" -- no button marks a
// goal done, and the possessive on a name read badly
test("round 8 review UX 4: a passed date is said plainly, with what to do that the page can do", () => {
  const p = emptyPlan();
  p.goals.push({ id: "a", name: "Child 2's college", target: 1000, targetDate: "2026-01-01", saved: 100 });
  const w = compute(p, { today: TODAY }).warnings;
  assert.ok(w.includes("The date for Child 2's college has passed. Set a new date, or lower its amount to what is still needed."), JSON.stringify(w));
  assert.ok(!w.some((x) => /mark it done/.test(x)));
});

// Round 8 batch 2 review (UX 4): a goal for a child already in college: Education's figure is the next bill, the one its own
// Update button writes, not four years "in the dollars of those years" ($103,000 beside a $25,850 goal)
test("round 8 review UX 4: Education's figure for a child in college is the next bill", async () => {
  const { plannerFigure, plannerDiffers } = await import("./compute.js");
  const { compute: education } = await import("../education/compute.js");
  const T = { today: "2026-11-06" };
  const p = emptyPlan();
  p.household = { people: [{ id: "p-m", name: "Marcus", role: "self", birthDate: "1972-03-15" }, { id: "k-2", name: "Child 2", role: "dependent", birthDate: "2005-07-15" }], filingStatus: "single", state: "WA" };
  p.goals = [{ id: "g-old", name: "Child 2's college", icon: "🎓", target: 103000, targetDate: "2023-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  const r = education(p, T), gr = compute(p, T).goals[0];
  const f = plannerFigure(p.goals[0], gr, "goals/education", r, p);
  assert.deepEqual([f.amount, f.words], [12930, "for its next bill (the spring half of 2026-27, January 15, 2027)"]);
  assert.equal(plannerDiffers(p.goals[0], f), true);
  // the goal set to it, as Education's Update button writes it: the same figure, so no "works it out at" line
  p.goals[0] = { ...p.goals[0], target: 12930, targetDate: "2027-01-15", inflates: false };
  assert.equal(plannerDiffers(p.goals[0], plannerFigure(p.goals[0], compute(p, T).goals[0], "goals/education", education(p, T), p)), false);
});

// Round 8 batch 2 review (UX 1): Education's goal for a January college bill made "Needed each month" $28,404 for a family with
// $55,000 in cash; a bill Next best action pays from savings is said as one, and is not a month's saving here
test("round 8 review UX 1: a bill paid from savings is out of 'Needed each month' and its row says so", async () => {
  const { render } = await import("./view.js");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const fmt = await import("../../../core/format.js");
  const T8 = "2026-11-06";
  const p = emptyPlan();
  p.household = { people: [{ id: "p-m", name: "Marcus", role: "self", birthDate: "1972-03-15" }, { id: "p-l", name: "Lin", role: "partner", birthDate: "1974-05-15" },
    { id: "k-1", name: "Child 1", role: "dependent", birthDate: "2007-07-15" }, { id: "k-2", name: "Child 2", role: "dependent", birthDate: "2005-07-15" }], filingStatus: "married_joint", state: "WA" };
  p.income = [{ id: "i-m", name: "Pay", type: "salary", personId: "p-m", amount: 210000, period: "annual", growth: 0, taxable: true }, { id: "i-l", name: "Pay", type: "salary", personId: "p-l", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.accounts = [{ id: "a-chk", name: "Checking", type: "checking", balance: 15000, ownerId: "", history: [] }, { id: "a-sav", name: "Savings", type: "savings", balance: 40000, ownerId: "", history: [] }];
  p.expenses = [{ id: "e-home", name: "Mortgage", category: "housing", amount: 3200, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "groceries", amount: 1500, period: "monthly", essential: true }, { id: "e-fun", name: "Everything else", category: "fun", amount: 6000, period: "monthly", essential: false }];
  p.retirement.workPlans = { "p-m": { match: false }, "p-l": { match: false } };
  p.goals = [{ id: "g-c1", name: "Child 1's college, 2026-27", icon: "🎓", target: 12930, targetDate: "2027-01-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-car", name: "New car", icon: "🚗", target: 30000, targetDate: "2029-06-01", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false }];
  const d = compute(p, { today: T8 });
  const car = d.goals.find((g) => g.id === "g-car").neededMonthly;
  const node = (tag, kids = [], extra = {}) => { const x = { tag, kids: [], style: {}, ...extra, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, set innerHTML(v) { x.kids = []; }, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l, fn) => node("button", [l], { onClick: fn }), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), uid: () => "x", confirm: () => true };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => T8 }, plan: p, store: { update() {} }, computeOf: (key, prm) => (key === "overview/next-best-action" ? nba(p, prm) : null) });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.match(text, new RegExp(`Needed each month ${fmt.money(car, "USD").replace(/[$.]/g, "\\$&")}`));
  assert.match(text, /\$0 of \$12,930 · by [\d/]+ · paid from savings when it is due \(Next best action\)/);
  assert.doesNotMatch(text, /needs \$6,4\d\d a month/);
});

// Round 8 verify (2026-11-06, the rest of review UX 4): the Goals page still said "$103,000 is due now" in its header and row for a
// college goal of a child in college, next to its own link "Education works it out at $12,930 for its next bill"
test("round 8 verify: a passed college goal of a child in college is not said as its whole amount due now", async () => {
  const { render } = await import("./view.js");
  const { compute: education } = await import("../education/compute.js");
  const fmt = await import("../../../core/format.js");
  const T8 = "2026-11-06";
  const p = emptyPlan();
  p.household = { people: [{ id: "p-m", name: "Marcus", role: "self", birthDate: "1972-03-15" }, { id: "k-2", name: "Child 2", role: "dependent", birthDate: "2005-07-15" }], filingStatus: "single", state: "WA" };
  p.income = [{ id: "i-m", name: "Pay", type: "salary", personId: "p-m", amount: 150000, period: "annual", growth: 0, taxable: true }];
  p.goals = [{ id: "g-old", name: "Child 2's college", icon: "🎓", target: 103000, targetDate: "2023-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true },
    { id: "g-old2", name: "Boat", icon: "⛵", target: 9000, targetDate: "2025-06-01", priority: 3, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false }];
  const node = (tag, kids = [], extra = {}) => { const x = { tag, kids: [], style: {}, ...extra, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, set innerHTML(v) { x.kids = []; }, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l, fn) => node("button", [l], { onClick: fn }), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), uid: () => "x", confirm: () => true };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => T8 }, plan: p, store: { update() {} }, computeOf: (key, prm) => (key === "goals/education" ? education(p, prm) : null) });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.doesNotMatch(text, /\$103,000 is due now|due now: \$103,000/);
  assert.match(text, /Education works it out at \$12,930 for its next bill/);
  // a passed goal no page has a figure for keeps its amount due now
  assert.match(text, /\$9,000 is due now on goals whose date has passed/); assert.match(text, /due now: \$9,000/);
});
