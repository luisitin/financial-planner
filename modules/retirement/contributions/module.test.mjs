// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("contributions: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("a Roth 401(k) counts with the 401(k) limit, a Roth IRA with the IRA limit (IRC 402A(c)(2), 408A(c)(2))", async () => {
  const { limitKind } = await import("./compute.js");
  assert.equal(limitKind("roth", "Roth IRA"), "ira"); assert.equal(limitKind("roth", "Roth 401(k)"), "401k");
  assert.equal(limitKind("roth", "Work Roth", 1200), "401k", "an employer match: a workplace plan"); assert.equal(limitKind("roth", "Roth 403b"), "401k");
  assert.equal(limitKind("ira", "IRA"), "ira"); assert.equal(limitKind("401k", "401k"), "401k"); assert.equal(limitKind("hsa", "HSA"), "hsa");
  // $20,000 a year into a Roth 401(k) at 41 in 2026 is within the $24,500 401(k) limit, not over the $7,500 IRA limit
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1985-01-01" }];
  p.accounts = [{ id: "r", name: "Roth 401(k)", type: "roth", balance: 0, ownerId: "a" }];
  p.retirement = { ...(p.retirement ?? {}), contributions: [{ id: "c", personId: "a", accountId: "r", amount: 20000, period: "annual" }] };
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.warnings.length, 0); assert.equal(d.byPerson[0].limits[0].kind, "401k"); assert.equal(d.byPerson[0].limits[0].limit, 24500);
});

// --- the shared limit helpers (README "Shared helpers") ------------------------------------------------------------
import { limitsFor, catchUpFor, hsaPicture } from "./compute.js";

test("limitsFor: each kind from the newest year that has it; 2027 has only the HSA (Rev. Proc. 2026-24 sec. 3.01(1))", () => {
  const y26 = limitsFor(2026);
  assert.deepEqual(y26.kindYear, { "401k": 2026, ira: 2026, hsa: 2026, fsa: 2026 }); assert.equal(y26.complete, true); assert.equal(y26.fullYear, 2026);
  assert.equal(y26.kinds["401k"].limit, 24500); assert.equal(y26.kinds.hsa.limit, 4400); assert.equal(y26.kinds.fsa.limit, 3400); assert.equal(y26.giftExclusion, 19000);
  assert.deepEqual(y26.rothPhaseOut.married_joint, [242000, 252000]);
  assert.equal(limitsFor(2025).kinds["401k"].limit, 23500); assert.equal(limitsFor(2025).kinds.hsa.family, 8550);
  const y27 = limitsFor(2027);
  assert.deepEqual(y27.kindYear, { "401k": 2026, ira: 2026, hsa: 2027, fsa: 2026 });
  assert.equal(y27.kinds.hsa.limit, 4500); assert.equal(y27.kinds.hsa.family, 9000); assert.equal(y27.kinds.hsa.catchUp, 1000);
  assert.equal(y27.kinds["401k"].limit, 24500, "2026's until the 2027 notice is out"); assert.equal(y27.kinds.ira.limit, 7500); assert.equal(y27.kinds.fsa.limit, 3400);
  assert.equal(y27.rothPhaseOutYear, 2026); assert.equal(y27.giftExclusionYear, 2026); assert.equal(y27.fullYear, 2026); assert.equal(y27.complete, false);
  assert.deepEqual(limitsFor(2030).kindYear, y27.kindYear, "a later year keeps the newest of each");
  assert.deepEqual(limitsFor(2024).kindYear, { "401k": 2025, ira: 2025, hsa: 2025, fsa: 2025 }, "a year before the first table takes the first");
});

test("catchUpFor: the age reached in the year; 50+ for the 401(k) and IRA, 11,250 for 60 to 63 instead (IRC 414(v)(2)(E)), 55+ for the HSA", () => {
  const L = limitsFor(2026).kinds;
  assert.deepEqual([49, 50, 59, 60, 61, 62, 63, 64].map((a) => catchUpFor(L["401k"], a)), [0, 8000, 8000, 11250, 11250, 11250, 11250, 8000]);
  assert.deepEqual([49, 50, 70].map((a) => catchUpFor(L.ira, a)), [0, 1100, 1100]);
  assert.deepEqual([54, 55, 64].map((a) => catchUpFor(L.hsa, a)), [0, 1000, 1000]);
  assert.equal(catchUpFor(L["401k"], null), 0, "no birth date, no catch-up"); assert.equal(catchUpFor(L.fsa, 70), 0, "the health FSA has none");
  assert.equal(catchUpFor(limitsFor(2025).kinds["401k"], 50), 7500);
});

const couple = ({ coverage, ana = [0, 0], ben = [0, 0], typed = null, status = "married_joint", anaBirth = "1970-05-01", benBirth = "1974-05-01" }) => {
  const p = emptyPlan();
  p.household.filingStatus = status;
  p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: anaBirth }, { id: "b", name: "Ben", role: "partner", birthDate: benBirth }];
  p.accounts = [{ id: "ha", name: "Ana's HSA", type: "hsa", balance: 0, ownerId: "a" }, { id: "hb", name: "Ben's HSA", type: "hsa", balance: 0, ownerId: "b" }];
  p.retirement.contributions = [{ id: "1", accountId: "ha", personId: "a", amount: ana[0], period: "annual", employerMatch: ana[1] }, { id: "2", accountId: "hb", personId: "b", amount: ben[0], period: "annual", employerMatch: ben[1] }];
  p.taxes.hsa = { contribution: typed ? typed[0] : ana[0] + ben[0], employer: typed ? typed[1] : ana[1] + ben[1], fsa: 0, fsaSpent: 0 };
  if (coverage !== undefined) p.taxes.hsa.coverage = coverage;
  return p;
};
const pick = (h, ...keys) => h.people.map((q) => Object.fromEntries(keys.map((k) => [k, q[k]])));

test("hsaPicture: married with family cover share one family limit, employer money counts (IRC 223(b)(5), (b)(4); key RULES.md 10.4)", () => {
  // Ana 56: 3,000 + 1,000 from her employer; Ben 52: 5,000 + 500. 2026 family limit 8,750, Ana's catch-up 1,000
  const h = hsaPicture(couple({ coverage: "family", ana: [3000, 1000], ben: [5000, 500] }), 2026);
  assert.equal(h.shared, true); assert.equal(h.coverage, "family"); assert.equal(h.base, 8750);
  assert.deepEqual(pick(h, "used", "catchUp", "limit", "room", "over", "excess"), [
    { used: 4000, catchUp: 1000, limit: 1000 + 8750 - 5500, room: 250, over: 0, excess: 0 },
    { used: 5500, catchUp: 0, limit: 8750 - (4000 - 1000), room: 250, over: 0, excess: 0 }]);
  assert.deepEqual(h.household, { limit: 9750, catchUp: 1000, payroll: 8000, employer: 1500, used: 9500, room: 250, over: 0, excess: 0 });
  // Ben adds 1,000: both show the same 750 over; only 750 has to come out, at the division nearest to halves it is Ben's
  const o = hsaPicture(couple({ coverage: "family", ana: [3000, 1000], ben: [6000, 500] }), 2026);
  assert.deepEqual(pick(o, "limit", "over", "excess"), [{ limit: 3250, over: 750, excess: 0 }, { limit: 5750, over: 750, excess: 750 }]);
  assert.equal(o.household.over, 750); assert.equal(o.household.excess, 750);
  // ages swapped, Ana (52) has 9,750 and Ben (56) none: the household is at its limit, but Ben's catch-up cannot hold Ana's money
  const s = hsaPicture(couple({ coverage: "family", ana: [9750, 0], anaBirth: "1974-01-01", benBirth: "1970-01-01" }), 2026);
  assert.equal(s.household.over, 0); assert.equal(s.household.excess, 1000); assert.equal(s.people[0].over, 1000);
  // 2027: Rev. Proc. 2026-24's 9,000
  assert.equal(hsaPicture(couple({ coverage: "family", ana: [1000, 0] }), 2027).household.limit, 9000 + 1000);
});

test("hsaPicture: self-only cover is the covered adult's only; no high-deductible plan, no HSA (IRC 223(b)(1), (c)(1)(A))", () => {
  const h = hsaPicture(couple({ coverage: "self", ana: [3000, 1000], ben: [5000, 500] }), 2026);
  assert.equal(h.coveredId, "a"); assert.equal(h.shared, false);
  assert.deepEqual(pick(h, "eligible", "limit", "used", "over", "excess"), [{ eligible: true, limit: 4400 + 1000, used: 4000, over: 0, excess: 0 }, { eligible: false, limit: 0, used: 5500, over: 5500, excess: 5500 }]);
  assert.deepEqual(h.household, { limit: 5400, catchUp: 1000, payroll: 8000, employer: 1500, used: 9500, room: 0, over: 4100, excess: 5500 });
  const ben = couple({ coverage: "self", ben: [3000, 0] }); ben.taxes.hsa.coveredId = "b";
  const hb = hsaPicture(ben, 2026);
  assert.equal(hb.coveredId, "b"); assert.deepEqual(pick(hb, "limit"), [{ limit: 0 }, { limit: 4400 }], "Ben, 52, covered: no catch-up");
  const none = hsaPicture(couple({ coverage: "none", ana: [1000, 500] }), 2026);
  assert.equal(none.household.limit, 0); assert.equal(none.household.excess, 1500); assert.equal(none.people[0].over, 1500);
  // left out (a plan that never chose): read as self-only, as before
  const absent = hsaPicture(couple({ ana: [1000, 0] }), 2026);
  assert.equal(absent.coverage, "self"); assert.equal(absent.coverageChosen, false); assert.equal(absent.household.limit, 5400);
});

test("hsaPicture: the HSA page's typed money counts on the covered adult where it is more than the rows; unmarried adults each get the family limit", () => {
  // typed only: 6,000 + 500 on Ana, who is covered
  const only = couple({ coverage: "self", typed: [6000, 500] }); only.retirement.contributions = [];
  const t = hsaPicture(only, 2026);
  assert.deepEqual(pick(t, "payroll", "employer", "used"), [{ payroll: 6000, employer: 500, used: 6500 }, { payroll: 0, employer: 0, used: 0 }]);
  assert.equal(t.household.excess, 6500 - 5400);
  // typed equal to the rows: nothing added; typed more: the difference goes on Ana
  assert.equal(hsaPicture(couple({ coverage: "family", ana: [1000, 0], ben: [2000, 0] }), 2026).people[0].used, 1000);
  assert.equal(hsaPicture(couple({ coverage: "family", ana: [1000, 0], ben: [2000, 0], typed: [4000, 0] }), 2026).people[0].used, 2000);
  // no one on the People page: the household is one adult
  const empty = emptyPlan(); empty.taxes.hsa.contribution = 5000;
  const e = hsaPicture(empty, 2026);
  assert.equal(e.people.length, 1); assert.equal(e.household.limit, 4400); assert.equal(e.household.excess, 600);
  // filing single, two adults on one family plan: 223(b)(5) is for spouses, so each has the whole family limit
  const u = hsaPicture(couple({ coverage: "family", ana: [8000, 0], ben: [8000, 0], status: "single" }), 2026);
  assert.equal(u.shared, false); assert.deepEqual(pick(u, "limit", "over"), [{ limit: 8750 + 1000, over: 0 }, { limit: 8750, over: 0 }]);
});

test("contributions: the HSA rows follow the cover (a spouse outside self-only cover is over; family cover is shared)", () => {
  const p = couple({ coverage: "self", ana: [3000, 0], ben: [2000, 0] });
  const d = compute(p, { today: "2026-10-31" });
  const hsaRow = (i) => d.byPerson[i].limits.find((l) => l.kind === "hsa");
  assert.equal(hsaRow(0).limit, 5400); assert.equal(hsaRow(1).limit, 0); assert.equal(hsaRow(1).over, 2000);
  assert.ok(d.warnings.some((w) => /Ben: .* only the person on the self-only high-deductible plan/.test(w)));
  p.taxes.hsa.coverage = "family";
  const f = compute(p, { today: "2026-10-31" });
  assert.equal(f.byPerson[1].limits.find((l) => l.kind === "hsa").limit, 8750 - (3000 - 1000)); assert.equal(f.warnings.length, 0);
  assert.equal(f.byPerson[0].limits.find((l) => l.kind === "hsa").label, "HSA (family coverage)");
  // 2027: the HSA row uses 2027's figures and says so
  const n = compute(p, { today: "2027-03-01" });
  assert.equal(n.byPerson[0].limits.find((l) => l.kind === "hsa").year, 2027); assert.equal(n.limitsYear, 2026); assert.equal(n.kindYear.hsa, 2027);
});

test("every reader of the limits takes a 2027 date's HSA figures from 2027 and the rest from 2026", async () => {
  const { compute: limitsPage } = await import("../../investments/limits/compute.js");
  const { compute: hsaPage } = await import("../../taxes/hsa-fsa/compute.js");
  const { planRooms } = await import("../../career/business/compute.js");
  const p = couple({ coverage: "self", ana: [1000, 0] });
  const l = limitsPage(p, { today: "2027-02-01" });
  const row = (kind) => l.people[0].rows.find((r) => r.kind === kind);
  assert.equal(row("hsa").limit, 4500 + 1000); assert.equal(row("401k").limit, 24500 + 8000); assert.equal(row("ira").limit, 7500 + 1100);
  assert.equal(l.fsa.limit, 3400); assert.equal(l.gift.exclusion, 19000); assert.equal(l.kindYear.hsa, 2027); assert.equal(l.limitsYear, 2026);
  const h = hsaPage(p, { today: "2027-02-01" });
  assert.equal(h.hsa.limit, 4500 + 1000); assert.equal(h.fsa.limit, 3400); assert.equal(h.limitsYear, 2027); assert.equal(h.fsaYear, 2026);
  assert.equal(limitsPage(p, { today: "2026-02-01" }).people[0].rows.find((r) => r.kind === "hsa").limit, 4400 + 1000, "2026 unchanged");
  assert.equal(planRooms({ profit: 100000, seHalf: 7065, year: 2027 }).solo, planRooms({ profit: 100000, seHalf: 7065, year: 2026 }).solo, "the 2027 401(k) limit is not out: 2026's");
});

test("hsaPicture: self-only cover not chosen goes to the one adult whose HSA rows hold money (a plan saved before the choice)", async () => {
  const { hsaPicture } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1980-01-01" }, { id: "b", name: "Bo", role: "partner", birthDate: "1981-01-01" });
  p.accounts.push({ id: "h", type: "hsa", name: "HSA", ownerId: "b", balance: 0 });
  p.retirement.contributions.push({ id: "c", accountId: "h", personId: "b", amount: 3000, period: "annual", employerMatch: 0 });
  p.taxes.hsa = { coverage: "self" };
  let h = hsaPicture(p, 2026);
  assert.equal(h.coveredId, "b"); assert.equal(h.household.excess, 0);
  const bo = h.people.find((x) => x.id === "b"); assert.equal(bo.limit, 4400); assert.equal(bo.over, 0);
  // chosen on the HSA page: Ana is covered, so Bo's money is over
  p.taxes.hsa.coveredId = "a"; h = hsaPicture(p, 2026);
  assert.equal(h.coveredId, "a"); assert.equal(h.people.find((x) => x.id === "b").over, 3000);
});

// Round 8 item 1: no 401(k) on file yet -- one tap on this page starts it (the path was Benefits, Contributions, Net worth, back)
/** The page with a stand-in UI kit that keeps the buttons' handlers, and a store that changes the plan in place. */
async function page(plan, today = "2026-11-06") {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const node = (tag, kids = [], extra = {}) => { const x = { tag, kids: [], style: {}, ...extra, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  let n = 0;
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l, fn) => node("button", [l], { onClick: fn }), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: (f, values) => node("form", [], { values }), uid: () => `new-${++n}` };
  const draw = () => { const root = node("root"); render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update(fn) { fn(plan); } }, computeOf: (id, p) => (id === "overview/next-best-action" ? nba(plan, p) : null) }); return root; };
  const all = (x, tag, out = []) => { if (typeof x !== "object") return out; if (x.tag === tag) out.push(x); for (const c of x.kids) all(c, tag, out); return out; };
  return { draw, all };
}
function worker(name, pay, benefits) {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-1", name, role: "self", birthDate: "2002-03-15" }], filingStatus: "single", state: "OH" };
  p.income = [{ id: "i-1", name: "Pay", type: "salary", personId: "p-1", amount: pay, period: "annual", growth: 0, taxable: true }];
  p.accounts = [{ id: "a-chk", name: "Checking", type: "checking", balance: 3000, ownerId: "", history: [] }];
  p.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1400, period: "monthly", essential: true }];
  if (benefits) p.whatIfs = { benefits: { "p-1": benefits } };
  return p;
}

test("round 8 item 1: a match typed on Work benefits and no 401(k): 'Start it at 3%' adds the $0 401(k) and what goes in, in one tap", async () => {
  const p = worker("Jasmine", 39000, { matchTiers: [{ rate: 1, upTo: 0.03 }], paychecks: 26, planYear: 2027 });
  const { draw, all } = await page(p);
  const root = draw();
  assert.match(root.textContent, /Start Jasmine's 401\(k\) and get the whole match/);
  assert.match(root.textContent, /gets \$1,170 a year from the employer/);
  assert.equal(all(root, "card").filter((c) => c.kids.length === 0).length, 0, "no empty card while there is no account");
  const btn = all(root, "button").find((b) => /^Start it at 3%/.test(b.textContent));
  assert.ok(btn, "one button");
  btn.onClick();
  const k = p.accounts.find((a) => a.type === "401k");
  assert.deepEqual([k.name, k.balance, k.ownerId], ["Jasmine's 401(k)", 0, "p-1"]);
  assert.deepEqual(p.retirement.contributions.map((c) => [c.accountId, c.personId, c.amount, c.period, c.employerMatch]), [[k.id, "p-1", 45, "biweekly", 1170]]);
  // (review UX 8: "is started" claimed more than the app does)
  assert.match(draw().textContent, /Added to your plan: \$45 a paycheck \(3% of pay\), and the employer adds \$1,170 a year/);
});

test("round 8 item 1: no match known: Yes starts the 401(k) and opens the form on it; No saves 'no plan or no match'", async () => {
  const p = worker("Priya", 58000);
  const { draw, all } = await page(p);
  const root = draw();
  assert.match(root.textContent, /Does Priya's job have a retirement plan with a match\?/);
  assert.match(root.textContent, /about \$1,740 a year for Priya/);
  assert.ok(all(root, "button").some((b) => b.textContent === "Not sure"));
  // (review UX 3 and 8: "Yes: add", and the next card is a start, not the form; see the review's test below)
  all(root, "button").find((b) => /^Yes: add Priya's 401\(k\)/.test(b.textContent)).onClick();
  const k = p.accounts.find((a) => a.type === "401k");
  assert.ok(k && k.balance === 0 && k.ownerId === "p-1");
  assert.equal((p.retirement.contributions ?? []).length, 0, "no amount was typed, so none is saved");
  const q = worker("Priya", 58000);
  const pq = await page(q);
  pq.all(pq.draw(), "button").find((b) => /^No plan or no match/.test(b.textContent)).onClick();
  assert.deepEqual(q.retirement.workPlans, { "p-1": { match: false } });
});

// ---- Round 8 batch 2 review (2026-11-06) ----
/** Jasmine (invented, as the round-8 renter): $39,000 in Ohio, about $3 spare a month after a $50 extra on her Visa card. */
function renter() {
  const p = worker("Jasmine", 39000, { matchTiers: [{ rate: 1, upTo: 0.03 }], paychecks: 26, planYear: 2027 });
  p.expenses.push({ id: "e-food", name: "Food", category: "food", amount: 500, period: "monthly", essential: true }, { id: "e-card", name: "Visa payment", category: "debt", amount: 120, period: "monthly", essential: true },
    { id: "e-other", name: "Other", category: "other", amount: 690, period: "monthly", essential: false });
  p.accounts.push({ id: "a-visa", name: "Visa card", type: "credit", balance: 4000, ownerId: "p-1", history: [] });
  p.debts = [{ id: "d-visa", accountId: "a-visa", rate: 0.249, minPayment: 120, extra: 0 }];
  p.debtPlan = { extra: 50, order: "avalanche", customOrder: [] };
  return p;
}

// UX 2 and money D2: the card says what the match takes from take-home pay before the tap when the month has less, and the
// confirmation gives the month after it; UX 8: the words say it is added to the plan, and that signing up at work starts it
test("round 8 review D2 / UX 2 / UX 8: the cost before the tap, the month after it, and 'added to your plan'", async () => {
  const p = renter();
  const { draw, all } = await page(p);
  const root = draw();
  assert.match(root.textContent, /No retirement account yet: one tap below adds your 401\(k\) to the plan\./);
  assert.match(root.textContent, /This takes about \$83 a month from take-home pay, and about \$3 is left each month: put the \$50 a month extra on Visa card \(Pay off debts\) toward it instead/);
  all(root, "button").find((b) => /^Start it at 3%/.test(b.textContent)).onClick();
  const after = draw().textContent;
  assert.match(after, /Added to your plan: \$45 a paycheck \(3% of pay\), and the employer adds \$1,170 a year\. To actually start it, sign up at 3% with human resources or your job's benefits site\./);
  assert.match(after, /Each month is now about \$80 short: lower the \$50 extra on debts \(Pay off debts\) or trim spending to make up for it\./);
  assert.doesNotMatch(after, /is started/);
});

// UX 3: a 401(k) on file with nothing going in and the match typed on Work benefits: the same one-tap start, on that 401(k)
test("round 8 review UX 3: a 401(k) on file and a typed match: 'Start it at 3%' on that 401(k), no question", async () => {
  const p = worker("Jasmine", 39000, { matchTiers: [{ rate: 1, upTo: 0.03 }], paychecks: 26, planYear: 2027 });
  p.accounts.push({ id: "a-k", name: "Work 401(k)", type: "401k", balance: 0, ownerId: "p-1", history: [] });
  const { draw, all } = await page(p);
  const root = draw();
  assert.doesNotMatch(root.textContent, /Does Jasmine's job add money/);
  assert.match(root.textContent, /Start what goes into Jasmine's 401\(k\) and get the whole match/);
  all(root, "button").find((b) => /^Start it at 3%/.test(b.textContent)).onClick();
  assert.equal(p.accounts.filter((a) => a.type === "401k").length, 1, "no second 401(k)");
  assert.deepEqual(p.retirement.contributions.map((c) => [c.accountId, c.amount, c.period, c.employerMatch]), [["a-k", 45, "biweekly", 1170]]);
});

// UX 3: after "Yes", the question is not asked again: the 401(k) is added, the job's plan is noted as having a match
// (retirement.workPlans[id].match = true, the field Get started writes), and the next card offers a start at a common match or
// one's own amount, never "That 401(k) is from a job Priya left" about the account just added
test("round 8 review UX 3: after 'Yes: add Priya's 401(k)', a start at a common match or one's own amount, not the question again", async () => {
  const p = worker("Priya", 58000);
  const { draw, all } = await page(p);
  all(draw(), "button").find((b) => /^Yes: add Priya's 401\(k\)/.test(b.textContent)).onClick();
  const k = p.accounts.find((a) => a.type === "401k");
  assert.ok(k && k.balance === 0 && k.ownerId === "p-1");
  assert.deepEqual(p.retirement.workPlans, { "p-1": { match: true } });
  const after = draw();
  const text = after.textContent;
  assert.match(text, /Priya's 401\(k\) is added to the plan \(at \$0, on Net worth\)\./);
  assert.doesNotMatch(text, /Does Priya's job add money|from a job Priya left/);
  assert.match(text, /How much goes into Priya's 401\(k\)\?/);
  all(after, "button").find((b) => /^Type my own amount/.test(b.textContent)).onClick();
  const form = all(draw(), "form")[0];
  assert.ok(form, "the form is open");
  assert.deepEqual([form.values.accountId, form.values.personId, form.values.period, form.values.amount], [k.id, "p-1", "biweekly", 133.85]);
  all(draw(), "button").find((b) => /^Start it at 6%/.test(b.textContent)).onClick();
  assert.deepEqual(p.retirement.contributions.map((c) => [c.accountId, c.amount, c.period, c.employerMatch]), [[k.id, 133.85, "biweekly", 0]]);
  assert.match(draw().textContent, /Added to your plan: \$134 a paycheck \(6% of pay\)\. Type what the employer adds on it below once you know it\./);
});

test("HSA R1 (follow-up 2026-11-07): the Contributions page reads the Medicare-aware picture, so a widow on Medicare sees a limit of 0 and the reason", async () => {
  const { widowPlan } = await import("../../../qa/fixtures/widow-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const p = migrate(widowPlan());
  const ruth = p.household.people[0];
  p.accounts.push({ id: "hsa-w", name: "Ruth's HSA", type: "hsa", balance: 3000, ownerId: ruth.id });
  p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "c-hsa", accountId: "hsa-w", personId: ruth.id, period: "annual", amount: 4400, employerMatch: 0 }];
  const d = compute(p, { today: "2026-11-06" });
  const row = d.byPerson[0].limits.find((l) => l.kind === "hsa");
  // Ruth is 74 and gets Social Security: on Medicare all year, so the limit is 0 (IRC 223(b)(7); Pub. 969), not 5,400 (4,400 + 1,000 from 55)
  assert.equal(row.limit, 0); assert.equal(row.used, 4400); assert.equal(row.over, 4400);
  assert.equal(d.hsa.household.limit, 0);
  assert.ok(d.warnings.some((w) => /Ruth: on Medicare all year, and once you are on Medicare you cannot add to an HSA\. 4,400 goes in, this year's limit is 0\./.test(w)), JSON.stringify(d.warnings));
  assert.ok(!d.warnings.some((w) => /over the 2026 limit of 5,400/.test(w)));
  // someone not on Medicare keeps the plain limit and the plain warning
  const young = migrate(widowPlan());
  young.household.people[0].birthDate = "1990-05-05";
  young.accounts.push({ id: "hsa-y", name: "HSA", type: "hsa", balance: 100, ownerId: young.household.people[0].id });
  young.retirement.contributions = [{ id: "c-y", accountId: "hsa-y", personId: young.household.people[0].id, period: "annual", amount: 4400, employerMatch: 0 }];
  const y = compute(young, { today: "2026-11-06" });
  assert.equal(y.byPerson[0].limits.find((l) => l.kind === "hsa").limit, 4400); assert.equal(y.warnings.length, 0);
});
