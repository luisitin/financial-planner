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
  assert.equal(fe.amount, null); assert.match(fe.note, /checked off as your emergency fund/); assert.equal(plannerDiffers(eg, fe), false);
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
// college goal of a child in college, next to its own link "The Education page puts it at $12,930 for its next bill"
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
  assert.match(text, /The Education page puts it at \$12,930 for its next bill/);
  // a passed goal no page has a figure for keeps its amount due now
  assert.match(text, /\$9,000 is due now on goals whose date has passed/); assert.match(text, /due now: \$9,000/);
});

// ---- C5 hand-off N2, H6: an amount that is our guess is said as ours, never amber; a goal with no amount asks for one calmly
test("N2/H6: Goals marks our amount as ours and never amber, and asks calmly for a blank one", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const T = "2026-11-02";
  const p = emptyPlan();
  p.goals.push(
    { id: "setup-goal-home", name: "House down payment", icon: "🏡", target: 43000, targetDate: "2029-11-02", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true },
    { id: "setup-goal-trip", name: "Big trip", icon: "✈️", target: 0, targetDate: "2027-11-02", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true },
    { id: "g-car", name: "Car", icon: "🚗", target: 12000, targetDate: "2028-09-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
  p.guesses = { "goals[setup-goal-home].target": { k: "goal.home.target", v: 43000, u: "total", s: null, at: T, d: T } };
  const pg = await renderPage(new URL("./view.js", import.meta.url).href, p, T);
  const rows = pg.root.querySelectorAll("li").filter((li) => li.getAttribute("role") === "button");
  const row = (name) => rows.find((li) => li.textContent.includes(name));
  const pillOf = (li) => li.querySelectorAll("span").find((s) => /\bpill\b/.test(s.className) && s.textContent !== "must have");
  // ours: said first, in the words Expenses and Income use, the figure "about"; behind, but not amber
  assert.match(row("House down payment").textContent, /Our guess for now: tap to type yours · \$0 of about \$43,000/);
  assert.equal(pillOf(row("House down payment")).textContent, "behind");
  assert.doesNotMatch(pillOf(row("House down payment")).className, /warn/);
  // the person's own amount, behind: amber as before
  assert.match(pillOf(row("Car")).className, /warn/);
  assert.doesNotMatch(row("Car").textContent, /our guess/i);
  // no amount: calm, "add an amount", and the line says what to do
  assert.equal(pillOf(row("Big trip")).textContent, "add an amount");
  assert.doesNotMatch(pillOf(row("Big trip")).className, /warn/);
  assert.match(row("Big trip").textContent, /No amount yet: tap to add one/);
  assert.doesNotMatch(row("Big trip").textContent, /\$0 of \$0/);
});

// ---- the chance of reaching each goal on time (gap list, next 60, item 12; README "The chance of reaching each goal") ----------
const C_TODAY = "2026-11-15";
const chanceOf = async (goals, extra = {}) => {
  const { chances } = await import("./compute.js");
  const p = emptyPlan();
  p.goals = goals.map((g, i) => ({ id: `g${i}`, name: `Goal ${i}`, icon: "🎯", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false, ...g }));
  Object.assign(p.assumptions, extra.assumptions ?? {});
  return chances(p, { today: C_TODAY, ...(extra.params ?? {}) });
};
const words = async (x, opt) => (await import("./compute.js")).chanceWords(x, opt);

test("chance: a sure goal (cash, enough each month) is sure, says so, and has no second line", async () => {
  const r = await chanceOf([{ target: 12000, targetDate: "2028-11-15", saved: 2000, monthly: 450 }]);
  const g = r.goals[0];
  assert.equal(g.kind, "run"); assert.equal(g.steady, true); assert.equal(g.mixKind, "cash"); assert.equal(g.swing, 0);
  assert.equal(g.chance, 1);
  assert.equal(g.aimMonthly, undefined, "nothing to aim for at 10 in 10");
  const w = await words(g);
  assert.deepEqual(w, { value: "On pace", says: "It reaches $12,000 by November 2028 at this pace.", aim: "" });
});

test("chance: an impossible goal reads Under 1 in 10, calmly, and the monthly figure for 9 in 10 really gets there ($10 less does not)", async () => {
  const goal = { target: 1000000, targetDate: "2031-11-15", monthly: 100 };
  const r = await chanceOf([goal]);
  const g = r.goals[0];
  assert.equal(g.mixKind, "bonds"); assert.equal(g.swing, 0.05); assert.equal(g.chance, 0);
  assert.equal(g.aimDate, null, "at $100 a month no date within 10 years gets there");
  const w = await words(g);
  assert.equal(w.value, "Under 1 in 10");
  assert.equal(w.says, "Very unlikely at this pace to reach $1,000,000 by November 2031.");
  assert.equal(w.aim, `It would be 9 in 10 with about ${fmtMoney(g.aimMonthly)} a month.`);
  assert.equal(g.aimMonthly % 10, 0, "rounded up to $10");
  assert.ok((await chanceOf([{ ...goal, monthly: g.aimMonthly }])).goals[0].chance >= 0.9, "at that monthly: 9 in 10 or better");
  assert.ok((await chanceOf([{ ...goal, monthly: g.aimMonthly - 10 }])).goals[0].chance < 0.9, "$10 less: under 9 in 10");
});

test("chance: a goal already reached, one with no amount, no date, a passed date, due this month, too far off, and one paid from savings each say so", async () => {
  const r = await chanceOf([
    { target: 15000, targetDate: "2027-06-01", saved: 15000 },
    { target: 0, targetDate: "2027-06-01" },
    { target: 5000, targetDate: "" },
    { target: 5000, targetDate: "2026-01-01", saved: 100 },
    { target: 5000, targetDate: "2026-11-30", saved: 1000 },
    { target: 5000, targetDate: "9999-12-31", monthly: 50, inflates: true },
    { target: 5000, targetDate: "2027-01-15" },
  ]);
  assert.deepEqual(r.goals.map((g) => g.kind), ["reached", "no amount", "no date", "date passed", "due now", "too far", "run"]);
  const say = await Promise.all(r.goals.map((g, i) => words(g, { fromSavings: i === 6 })));
  assert.deepEqual(say.map((w) => [w.value, w.says, w.aim]), [
    ["Reached", "The money set aside already covers its $15,000.", ""],
    ["No amount", "Add an amount to see its chance.", ""],
    ["No date", "Add a date to see its chance of being on time.", ""],
    ["Date passed", "Its date has passed: set a new date to see its chance.", ""],
    ["Due now", "It is due this month, and $4,000 is still needed.", ""],
    ["Too far off", "Its date is more than 80 years away: too far off to say.", ""],
    ["From savings", "It is paid from savings when it is due, so there is no chance to work out.", ""],
  ]);
  for (const g of r.goals.slice(0, 6)) assert.equal(g.chance, undefined, `${g.kind}: no chance worked out`);
});

test("chance: a date typed far ahead (9999) is not walked month by month: 80 years at most, each draw quick (critic M3)", async () => {
  const { CHANCE } = await import("./compute.js");
  assert.equal(CHANCE.farMonths, 960);
  const t0 = performance.now();
  const far = await chanceOf([{ target: 10000, saved: 100, monthly: 50, targetDate: "9999-12-31", inflates: true }, { target: 10000, saved: 100, monthly: 50, targetDate: "2999-12-31", inflates: true }]);
  assert.deepEqual(far.goals.map((g) => g.kind), ["too far", "too far"]);
  assert.ok(performance.now() - t0 < 100, "no 8,000 years of months");
  // the last month still worked out: 80 years from today, with the later-date search past it
  const edge = await chanceOf([{ target: 900000, monthly: 50, targetDate: "2106-11-15", inflates: true }]);
  assert.equal(edge.goals[0].monthsLeft, 960); assert.equal(edge.goals[0].kind, "run");
  assert.equal((await chanceOf([{ target: 900000, monthly: 50, targetDate: "2106-12-15", inflates: true }])).goals[0].kind, "too far");
});

test("chance: a goal that gets there with nothing going in says so, beside the page's own row (critic M1)", async () => {
  const goal = { target: 10000, saved: 9900, monthly: 0, targetDate: "2028-11-15" };
  const p = emptyPlan(); p.goals = [{ id: "g0", name: "Goal 0", icon: "🎯", priority: 2, fundedBy: [], rate: null, inflates: false, ...goal }];
  const row = compute(p, { today: C_TODAY }).goals[0];
  // the page's own row: "behind" (its on track needs money going in) and "needs $0 a month" (compute() is not touched)
  assert.equal(row.status, "behind"); assert.equal(row.neededMonthly, 0); assert.ok(row.projected >= row.targetThen);
  const g = (await chanceOf([goal])).goals[0];
  assert.equal(g.chance, 1);
  assert.deepEqual(await words(g), { value: "On pace", says: "It reaches $10,000 by November 2028 with nothing more put in.", aim: "" });
  // with ups and downs (a goal 5 years off, counted as bonds): the same words added
  const b = (await chanceOf([{ target: 10000, saved: 9700, monthly: 0, targetDate: "2031-11-15" }])).goals[0];
  assert.ok(b.chance >= 0.9 && b.chance < 1, String(b.chance));
  assert.equal((await words(b)).says, "At least 9 in 10 that it reaches $10,000 by November 2031 with nothing more put in.");
});

test("chance: a growth figure that is not a number gives no monthly figure to say, never \"- a month\" (critic M2)", async () => {
  for (const extra of [{ goal: { rate: "abc" } }, { assumptions: { returnBonds: "x" } }]) {
    const r = await chanceOf([{ target: 10000, saved: 100, monthly: 50, targetDate: "2030-11-15", ...(extra.goal ?? {}) }], { assumptions: extra.assumptions });
    const g = r.goals[0];
    assert.equal(g.aimMonthly, null, JSON.stringify(extra));
    const w = await words(g);
    assert.equal(w.aim, "", JSON.stringify(extra));
    assert.doesNotMatch(Object.values(w).join(" "), /NaN|undefined|null| - a month/);
  }
  // and the words never say a figure that is not one, whatever reaches them
  assert.equal((await words({ kind: "run", target: 5000, when: "2030-01-01", steady: false, chance: 0.4, aimMonthly: NaN, aimDate: null })).aim, "");
});

test("chance: two goals sharing one id each keep their own growth figure (critic M5)", async () => {
  const one = { target: 20000, monthly: 300, targetDate: "2031-11-15" };
  const r = await chanceOf([{ ...one, id: "x", rate: 0.07 }, { ...one, id: "x", rate: null }]);
  assert.deepEqual(r.goals.map((g) => [g.rate, g.mixKind]), [[0.07, "own"], [0.04, "bonds"]]);
  const alone = await chanceOf([{ ...one, id: "x", rate: 0.07 }]);
  assert.equal(r.goals[0].chance, alone.goals[0].chance);
});

test("chance status: the shut row says the answer: one goal's own short answer, how many may be late, or none (critic P1)", async () => {
  const { chanceStatus, mayBeLate } = await import("./compute.js");
  const run = (id, chance, o = {}) => ({ id, kind: "run", target: 5000, when: "2030-01-01", steady: false, monthly: 100, chance, ...o });
  const k = (id, kind) => ({ id, kind, target: 5000, when: "2030-01-01" });
  assert.equal(chanceStatus([run("a", 0.73)]), "7 in 10");
  assert.equal(chanceStatus([run("a", 0, { steady: true })]), "Not at this pace");
  assert.equal(chanceStatus([k("a", "no date")]), "No date");
  assert.equal(chanceStatus([run("a", 0.5), run("b", 0.95), k("c", "reached"), k("d", "no date")]), "1 of 4 may be late");
  assert.equal(chanceStatus([run("a", 0.5), run("b", 0, { steady: true }), k("c", "date passed")]), "All 3 may be late");
  assert.equal(chanceStatus([run("a", 0.9), k("b", "reached"), k("c", "no amount")]), "None look late");
  assert.equal(chanceStatus([k("a", "no date"), k("b", "no amount")]), "2 goals");
  // a goal paid from savings when it is due is not late, and alone has no chance to say
  assert.equal(chanceStatus([run("a", 0.2), k("b", "due now")], { fromSavings: (id) => id === "b" }), "1 of 2 may be late");
  assert.equal(chanceStatus([k("a", "due now"), k("b", "too far")], { fromSavings: (id) => id === "a" }), "2 goals");
  assert.equal(mayBeLate(run("a", 0.899)), true); assert.equal(mayBeLate(run("a", 0.9)), false); assert.equal(mayBeLate(k("a", "too far")), false);
  // never longer than the status line holds (core/ui/more.js STATUS_MAX), up to 99 goals
  const { STATUS_MAX } = await import("../../../core/ui/more.js");
  for (const n of [2, 9, 10, 99]) for (const late of [1, n - 1, n]) {
    const list = Array.from({ length: n }, (_, i) => run(`g${i}`, i < late ? 0.1 : 0.95));
    assert.ok(chanceStatus(list).length <= STATUS_MAX, chanceStatus(list));
  }
});

const fmtMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
test("chance: every written sentence, one per case (R5), and every second line", async () => {
  const x = (o) => ({ kind: "run", name: "House", target: 60000, grows: true, when: "2029-06-01", runs: 1000, steady: false, monthly: 400, ...o });
  const cases = [
    [x({ chance: 1 }), "10 in 10", "It reaches $60,000 in today's dollars by June 2029 in all 1,000 pretend futures we tried."],
    [x({ chance: 1, monthly: 0 }), "10 in 10", "It reaches $60,000 in today's dollars by June 2029 with nothing more put in, in all 1,000 pretend futures we tried."],
    [x({ chance: 0.95, monthly: 0 }), "9 in 10", "At least 9 in 10 that it reaches $60,000 in today's dollars by June 2029 with nothing more put in."],
    [x({ chance: 0.95 }), "9 in 10", "At least 9 in 10 that it reaches $60,000 in today's dollars by June 2029."],
    [x({ chance: 0.9 }), "9 in 10", "At least 9 in 10 that it reaches $60,000 in today's dollars by June 2029."],
    [x({ chance: 0.899 }), "8 in 10", "About 8 in 10 that it reaches $60,000 in today's dollars by June 2029."],
    [x({ chance: 0.73 }), "7 in 10", "About 7 in 10 that it reaches $60,000 in today's dollars by June 2029."],
    [x({ chance: 0.1 }), "1 in 10", "About 1 in 10 that it reaches $60,000 in today's dollars by June 2029."],
    [x({ chance: 0.05 }), "Under 1 in 10", "Unlikely at this pace: fewer than 1 in 10 that it reaches $60,000 in today's dollars by June 2029."],
    [x({ chance: 0 }), "Under 1 in 10", "Very unlikely at this pace to reach $60,000 in today's dollars by June 2029."],
    [x({ chance: 1, steady: true, grows: false }), "On pace", "It reaches $60,000 by June 2029 at this pace."],
    [x({ chance: 1, steady: true, grows: false, monthly: 0 }), "On pace", "It reaches $60,000 by June 2029 with nothing more put in."],
    [x({ chance: 0, steady: true, grows: false }), "Not at this pace", "It falls short of $60,000 by June 2029."],
  ];
  // one scale (critic P2): "On pace" / "Not at this pace" for money with no ups and downs, "N in 10" for money with them
  for (const [g, value] of cases) assert.match(value, g.steady ? /^(On pace|Not at this pace)$/ : /^(Under 1|\d+) in 10$/, value);
  for (const [g, value, says] of cases) { const w = await words(g); assert.deepEqual([w.value, w.says, w.aim], [value, says, ""], JSON.stringify(g)); }
  const aim = async (o) => (await words(x({ chance: 0.7, aimMonthly: 1050, ...o }))).aim;
  assert.equal(await aim({ aimDate: "2030-03-01" }), "It would be 9 in 10 with about $1,050 a month, or with the date moved to March 2030.");
  assert.equal(await aim({ aimDate: null }), "It would be 9 in 10 with about $1,050 a month.");
  assert.equal(await aim({ steady: true, chance: 0, aimMonthly: 452, aimDate: "2028-08-01" }), "It would get there with $452 a month, or with the date moved to August 2028.");
  assert.equal(await aim({ steady: true, chance: 0, aimMonthly: 452, aimDate: "2034-02-01", aimSwing: true }), "It would get there with $452 a month, or be 9 in 10 with the date moved to February 2034.");
  assert.equal(await aim({ steady: true, chance: 0, aimMonthly: 452, aimDate: null }), "It would get there with $452 a month.");
  // the page's money format (its currency) is used, never advice words
  const w = await words(x({ chance: 0.5, aimMonthly: 1050 }), { money: (n) => `€${n}` });
  assert.match(w.says, /€60000 in today's dollars/); assert.match(w.aim, /€1050 a month/);
  for (const [g] of cases) { const t = Object.values(await words(g)).join(" "); assert.doesNotMatch(t, /\byou should\b|\bwe recommend\b|\bconsider\b|\bundefined\b|\bNaN\b|\bnull\b/i); }
});

test("chance formulas: the mix for each growth figure, as the README writes it", async () => {
  const { goalMix } = await import("./compute.js");
  const a = { returnCash: 0.02, returnBonds: 0.04, returnStocks: 0.07, stdevBonds: 0.05, stdevStocks: 0.15 };
  assert.deepEqual(goalMix(null, 35, a), { rate: 0.02, swing: 0, kind: "cash" }, "under 3 years: cash, no swing");
  assert.deepEqual(goalMix(null, 36, a), { rate: 0.04, swing: 0.05, kind: "bonds" }, "from 3 years: bonds");
  assert.deepEqual(goalMix(0.01, 120, a), { rate: 0.01, swing: 0, kind: "own" }, "own rate under cash: steady");
  assert.deepEqual(goalMix(0.02, 120, a), { rate: 0.02, swing: 0, kind: "own" }, "own rate at cash: steady");
  near(goalMix(0.03, 120, a).swing, 0.5 * 0.05, 1e-12);
  const w = 0.5, mix = Math.sqrt((w * 0.15) ** 2 + ((1 - w) * 0.05) ** 2 + 2 * w * (1 - w) * 0.1 * 0.15 * 0.05);
  near(goalMix(0.055, 120, a).swing, mix, 1e-12);
  near(goalMix(0.07, 120, a).swing, 0.15, 1e-12);
  assert.equal(goalMix(0.09, 120, a).swing, 0.15, "above stocks: the stock swing");
  // the page's own rate is the mix's rate at the goal's date
  const p = familyPlanFor();
  const rows = compute(p, { today: C_TODAY }).goals;
  for (const row of rows.filter((g) => g.monthsLeft !== null)) {
    const own = p.goals.find((g) => g.id === row.id).rate;
    assert.equal(goalMix(own ?? null, Math.max(0, row.monthsLeft), p.assumptions).rate, row.rate, row.name);
  }
});
const familyPlanFor = () => { const p = emptyPlan(); p.goals = [
  { id: "a", name: "Soon", target: 9000, targetDate: "2027-11-15", saved: 0, monthly: 100, rate: null, inflates: false },
  { id: "b", name: "Later", target: 30000, targetDate: "2031-11-15", saved: 2000, monthly: 300, rate: null, inflates: true },
  { id: "c", name: "Own", target: 50000, targetDate: "2036-08-15", saved: 4000, monthly: 250, rate: 0.06, inflates: true }]; return p; };

test("chance formulas: with no swing the walk is the page's fv to the cent, and On pace is exactly the page's on track", async () => {
  const { walker, drawLuck, chances } = await import("./compute.js");
  const w = walker(drawLuck(10, 1), { rate: 0.02, swing: 0 }, { runs: 10, start: 2000, monthly: 450, targetAt: () => 0, snap: 24 });
  w.share(24);
  near(2000 * w.P[0] + 450 * w.A[0], fv(0.02 / 12, 24, 450, 2000), 0.005);
  // across monthly amounts around the needed figure, chance 1 exactly when the page says on track
  for (const monthly of [400, 420, 431, 432, 440, 500]) {
    const p = emptyPlan(); p.goals = [{ id: "g", name: "Car", target: 12000, targetDate: "2028-11-15", saved: 2000, monthly, rate: null, inflates: false }];
    const row = compute(p, { today: C_TODAY }).goals[0], g = chances(p, { today: C_TODAY }).goals[0];
    assert.equal(g.chance === 1, row.status === "on track", `$${monthly}: ${g.chance} vs ${row.status}`);
    if (g.chance < 1) assert.equal(g.aimMonthly, row.neededMonthly, "steady: the page's own needed figure");
  }
});

test("chance formulas: a pretend year's twelve months grow, on average, as the page's monthly compounding, with the plan's swing", async () => {
  const { walker, drawLuck } = await import("./compute.js");
  const runs = 4000, r = 0.04, s = 0.05;
  const w = walker(drawLuck(runs, 7), { rate: r, swing: s }, { runs, start: 1, monthly: 0, targetAt: () => 0, snap: 12 });
  w.share(12);
  const P = [...w.P], mean = P.reduce((t, x) => t + x, 0) / runs;
  const sd = Math.sqrt(P.reduce((t, x) => t + (x - mean) ** 2, 0) / (runs - 1));
  const v = Math.log(1 + (s / (1 + r)) ** 2), want = (1 + r / 12) ** 12;
  assert.ok(Math.abs(mean - want) < 4 * sd / Math.sqrt(runs), `mean ${mean} vs ${want}`);
  near(sd, want * Math.sqrt(Math.expm1(v)), 0.004);
  // within a year every month gets the same luck; the next year new luck
  const logs = P.map(Math.log), lsd = Math.sqrt(logs.reduce((t, x) => t + x * x, 0) / runs - (logs.reduce((t, x) => t + x, 0) / runs) ** 2);
  near(lsd, Math.sqrt(v), 0.003);
});

test("chance formulas: the later date is the first month that reaches 9 in 10, and the month before does not", async () => {
  const { addMonths } = await import("../../../core/math/dates.js");
  const goal = { target: 30000, targetDate: "2030-11-15", saved: 2000, monthly: 300, inflates: true };
  const g = (await chanceOf([goal])).goals[0];
  assert.ok(g.chance < 0.9 && g.aimDate, JSON.stringify(g));
  assert.equal(g.aimDate.slice(8), "01", "the first of a month");
  const at = (d) => chanceOf([{ ...goal, targetDate: d }]).then((r) => r.goals[0].chance);
  assert.ok(await at(g.aimDate) >= 0.9, "a date in that month: 9 in 10");
  assert.ok(await at(addMonths(g.aimDate, -1)) < 0.9, "a month earlier: under 9 in 10");
  // a cash goal whose later date is 3 or more years away is counted as bonds there (the page's own rule), and says 9 in 10
  const c = (await chanceOf([{ target: 25000, targetDate: "2029-03-01", saved: 3500, monthly: 300, inflates: true }])).goals[0];
  assert.equal(c.steady, true); assert.equal(c.aimSwing, true);
  assert.match((await words(c)).aim, /or be 9 in 10 with the date moved to /);
});

test("chance: the seed is fixed, and a goal's answer never moves when another goal is added", async () => {
  const one = { target: 30000, targetDate: "2031-11-15", saved: 2000, monthly: 300, inflates: true };
  const a = await chanceOf([one]), b = await chanceOf([one]);
  assert.deepEqual(a, b, "the same plan, the same answer");
  const c = await chanceOf([one, { target: 90000, targetDate: "2045-08-15", saved: 0, monthly: 200, rate: 0.065, inflates: true }]);
  assert.equal(JSON.stringify(c.goals[0]), JSON.stringify(a.goals[0]));
  const d = await chanceOf([{ target: 90000, targetDate: "2045-08-15", saved: 0, monthly: 200, rate: 0.065, inflates: true }, one]);
  assert.equal(JSON.stringify({ ...d.goals[1], id: "g0", name: "Goal 0" }), JSON.stringify(a.goals[0]), "nor when it moves down the list");
  assert.equal(a.runs, 1000); assert.equal(a.seed, 1);
});

test("chance: month words and the first month at least t months away", async () => {
  const { monthYear, monthAtLeast } = await import("./compute.js");
  const { monthsBetween } = await import("../../../core/math/dates.js");
  assert.equal(monthYear("2029-06-01"), "June 2029"); assert.equal(monthYear(""), ""); assert.equal(monthYear("2029-13-01"), "");
  for (const today of ["2026-11-01", "2026-11-15", "2026-01-31", "2028-02-29"]) for (const t of [1, 11, 12, 37]) {
    const d = monthAtLeast(today, t);
    assert.ok(monthsBetween(today, d) >= t, `${today} + ${t}: ${d}`);
    assert.ok(monthsBetween(today, d) <= t, `${today} + ${t}: ${d} is the first such month`);
  }
});

// ---- invariance: nothing new is typed anywhere; compute() reads the same bytes, and chances() changes nothing --------------
test("chance invariance: over every fixture plan, household and variant, compute() gives the same bytes before and after chances(), which writes nothing and says no undefined", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const { chances, chanceWords } = await import("./compute.js");
  const dir = fileURLToPath(new URL("../../../qa/fixtures/", import.meta.url));
  const all = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) all.push([`${f}:${name}`, fn(C_TODAY)]);
  }
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") all.push([`phone ${name}`, fn()]);
  for (const a of ARCHETYPES) {
    all.push([`${a.id}/base`, a.build()]);
    for (const [pack, vs] of Object.entries({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const p = structuredClone(a.build()); v.apply(p); all.push([`${a.id}/${pack}/${v.slug}`, p]); }
  }
  all.push(["empty plan", emptyPlan()]);
  let goals = 0, ran = 0;
  for (const [name, raw] of all) {
    const plan = migrate(structuredClone(raw)), bytes = JSON.stringify(plan);
    for (const T of [C_TODAY, "2026-09-15"]) {
      const before = JSON.stringify(compute(plan, { today: T }));
      const r = chances(plan, { today: T, runs: 50 });
      assert.equal(JSON.stringify(plan), bytes, `${name}: chances() wrote to the plan`);
      assert.equal(JSON.stringify(compute(plan, { today: T })), before, `${name}: compute() moved`);
      assert.deepEqual(Object.keys(compute(plan, { today: T })).sort(), ["contributing", "count", "done", "goals", "neededMonthly", "totalFunded", "totalTarget", "warnings", ...("dueNow" in JSON.parse(before) ? ["dueNow"] : [])].sort(), name);
      assert.equal(r.goals.length, (plan.goals ?? []).length, name);
      for (const g of r.goals) {
        goals++; if (g.kind === "run") ran++;
        const t = Object.values(chanceWords(g)).join(" ");
        assert.doesNotMatch(t, /undefined|NaN|null|\[object/, `${name}: ${t}`);
        if (g.kind === "run") assert.ok(g.chance >= 0 && g.chance <= 1, name);
      }
    }
  }
  assert.ok(all.length > 900 && goals > 1000 && ran > 500, `${all.length} plans, ${goals} goals, ${ran} worked out`);
});
