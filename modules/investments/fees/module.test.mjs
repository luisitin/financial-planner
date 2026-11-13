// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, growWithFees, CHEAP_ER, planFeeAccounts, headlineOf, ledeOf, savedWords } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";

test("fees: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// ---- gap #34: a 401(k)'s own fees and what trading cost (O26, O27)
const T = "2026-11-13";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const fmt = await import("../../../core/format.js");
const money = (n) => fmt.money(n);
const pct1 = (x) => fmt.pct(x, 1);
/** The keys compute() gave before #34, in order: with the new fields absent it gives exactly these. */
const KEYS = ["ready", "total", "items", "fundFees", "advisoryFee", "advisoryYearly", "feesYearly", "weightedEr", "allIn", "years", "rate", "contributions", "withFees", "withoutFees", "lifetimeCost", "withCheap", "cheapSaves", "priciest", "unknownCount", "notes", "endAge"];
const K401 = 1500 * 212 + 4000 * 50;   // Sam's 401(k) on Holdings: FXAIX and the 2055 target-date fund, 518,000

test("#34 zero is identical: blank or zero plan and trading fees give compute()'s output byte for byte, with no new keys", () => {
  const base = compute(investmentsPlan(), { today: T });
  assert.deepEqual(Object.keys(base), KEYS);
  for (const blank of [{ planFees: {} }, { planFees: { k401: {} } }, { planFees: { k401: { pct: 0, dollars: 0 } } }, { planFees: { k401: { pct: null, dollars: "" } } },
    { tradingFees: { year: 2026, amount: 0 } }, { tradingFees: null }, { planFees: { nope: { pct: 0.01 } } }, { planFees: { roth: { dollars: 50 } } }]) {
    const p = investmentsPlan(); Object.assign(p.investments, blank);
    assert.equal(JSON.stringify(compute(p, { today: T })), JSON.stringify(base), JSON.stringify(blank));
  }
});

test("#34 a percent and a dollar fee on the 401(k), and trading fees: both join the yearly cost and the lifetime cost by the page's own method", () => {
  const base = compute(investmentsPlan(), { today: T });
  const p = investmentsPlan();
  p.investments.planFees = { k401: { pct: 0.002, dollars: 60 } };
  p.investments.tradingFees = { year: 2026, amount: 240 };
  const d = compute(p, { today: T });
  // yearly cost = balance x (the fund's ratio + plan %) + plan dollars + trading
  near(d.planYearly, K401 * 0.002 + 60);          // 1,036 + 60
  near(d.tradingYearly, 240); assert.equal(d.tradingYear, 2026);
  near(d.otherYearly, 1096 + 240);
  near(d.feesYearly, base.fundFees + base.advisoryYearly + 1096 + 240);
  near(d.allIn, d.feesYearly / d.total, 1e-12);
  assert.deepEqual(d.planFees, [{ accountId: "k401", name: "Sam's 401(k)", value: K401, pct: 0.002, dollars: 60, yearly: K401 * 0.002 + 60 }]);
  // the lifetime cost: the same money grown with and without every fee, as before; a fee charged as a share grows with
  // the money, one charged in dollars (the plan's $60, trading's $240) is the same dollars each year
  const c = d.contributions;
  near(d.withFees, growWithFees(d.total, d.years, d.rate, (base.fundFees + base.advisoryYearly + K401 * 0.002) / d.total, c.yearly, c.years, 0.03, 60 + 240), 1e-6);
  near(d.withoutFees, base.withoutFees, 1e-9);
  near(d.lifetimeCost, d.withoutFees - d.withFees, 1e-9);
  assert.ok(d.lifetimeCost > base.lifetimeCost);
  // index funds cannot drop the plan's own fee: it is still paid on the cheap path
  near(d.withCheap, growWithFees(d.total, d.years, d.rate, CHEAP_ER + K401 * 0.002 / d.total, c.yearly, c.years, 0.03, 60), 1e-6);
  assert.ok(d.withCheap < base.withCheap);
  // the % alone, the dollars alone
  const only = (fee) => { const q = investmentsPlan(); q.investments.planFees = { k401: fee }; return compute(q, { today: T }); };
  near(only({ pct: 0.005 }).planYearly, K401 * 0.005);
  near(only({ dollars: 125 }).planYearly, 125);
  // a Roth IRA is not a plan at work; a Roth 401(k) is (its name says so, as Contributions reads it)
  const q = investmentsPlan(); q.investments.planFees = { roth: { dollars: 50 } };
  assert.equal(compute(q, { today: T }).planYearly, undefined);
  q.accounts.find((a) => a.id === "roth").name = "Sam's Roth 401(k)";
  near(compute(q, { today: T }).planYearly, 50);
});

test("#34 a fee in dollars comes out as the same dollars each year, never below nothing; with none, growWithFees is as before", () => {
  near(growWithFees(1000, 2, 0.1, 0, 0, 0, 0, 100), 1000, 1e-9);           // 1,100 - 100, twice
  near(growWithFees(1000, 1, 0.1, 0.01, 100, 1, 0, 50), 1140, 1e-9);       // 1,000 x 1.09 - 50 + 100
  assert.equal(growWithFees(100, 3, 0, 0, 0, 0, 0, 500), 0);
  assert.equal(growWithFees(1000, 1, 0.1, 0.01, 100, 1), growWithFees(1000, 1, 0.1, 0.01, 100, 1, 0, 0));
  // $83 a year in dollars costs far less over 59 years than the same $83 as a share of money that grows to millions
  const asShare = growWithFees(103600, 59, 0.061, 0, 20000, 30, 0.03) - growWithFees(103600, 59, 0.061, 83 / 103600, 20000, 30, 0.03);
  const asDollars = growWithFees(103600, 59, 0.061, 0, 20000, 30, 0.03) - growWithFees(103600, 59, 0.061, 0, 20000, 30, 0.03, 83);
  near(asDollars, 83 * (Math.pow(1.061, 59) - 1) / 0.061, 1e-3);           // a level yearly payment, compounded
  assert.ok(asDollars * 3 < asShare, `${asDollars} vs ${asShare}`);
});

test("#34 the lifetime cost only grows as a plan fee or trading fee grows", () => {
  const at = (fee, trading) => { const p = investmentsPlan(); p.investments.planFees = { k401: fee }; if (trading) p.investments.tradingFees = { year: 2026, amount: trading }; return compute(p, { today: T }); };
  let last = compute(investmentsPlan(), { today: T });
  for (const x of [0.0005, 0.001, 0.0025, 0.005, 0.01]) { const d = at({ pct: x }); assert.ok(d.lifetimeCost > last.lifetimeCost && d.withFees < last.withFees, String(x)); last = d; }
  last = compute(investmentsPlan(), { today: T });
  for (const x of [10, 100, 500, 2000]) { const d = at({ dollars: x }); assert.ok(d.lifetimeCost > last.lifetimeCost, String(x)); last = d; }
  last = compute(investmentsPlan(), { today: T });
  for (const x of [5, 50, 600, 5000]) { const d = at({}, x); assert.ok(d.lifetimeCost > last.lifetimeCost, String(x)); last = d; }
});

test("#34 the plans at work with funds on Holdings get a box; a plan at work with none is named; a fee typed for last year still counts", () => {
  const p = investmentsPlan();
  const f = planFeeAccounts(p, { today: T });
  assert.deepEqual(f.accounts.map((a) => [a.id, a.name, a.value]), [["k401", "Sam's 401(k)", K401]]);
  assert.deepEqual(f.waiting, []);
  p.accounts.push({ id: "old", name: "Lee's old 403(b)", type: "401k", balance: 40000 });
  assert.deepEqual(planFeeAccounts(p, { today: T }).waiting, ["Lee's old 403(b)"]);
  const q = investmentsPlan(); q.investments.tradingFees = { year: 2025, amount: 300 };
  const d = compute(q, { today: T });
  near(d.tradingYearly, 300); assert.equal(d.tradingYear, 2025);
});

test("#34 one written sentence per case (R5): the headline and the line under it, with nothing typed, a plan fee, trading only, all of them, and nothing to pay", () => {
  const draw = (set) => { const p = investmentsPlan(); set?.(p); const d = compute(p, { today: T }); return [headlineOf(d, money), ledeOf(d, money, pct1)]; };
  const [h0, l0] = draw();
  assert.equal(h0, "Fees cost you about $205,346 over the plan");
  assert.equal(l0, "$519 a year today: 0.05% of $969,500 (fund fees at 0.06% on average). Grown at 6.1% for 37 years with your contributions, the money ends at $11,168,265 instead of $11,373,611. In broad index funds at 0.05% it would end at $11,181,836: $13,571 more.");
  const [h1, l1] = draw((p) => { p.investments.planFees = { k401: { pct: 0.002, dollars: 60 } }; });
  assert.equal(h1, "Fees cost you about $611,752 over the plan");
  assert.equal(l1, "$1,615 a year today: 0.17% of $969,500 ($519 in fund fees at 0.06% on average and $1,096 charged by your plan at work). Grown at 6.1% for 37 years with your contributions, the money ends at $10,761,858 instead of $11,373,611. In broad index funds at 0.05%, still paying your plan's own fee, it would end at $10,774,951: $13,092 more.");
  const [, l2] = draw((p) => { p.investments.tradingFees = { year: 2026, amount: 240 }; });
  assert.equal(l2, "$759 a year today: 0.08% of $969,500 ($519 in fund fees at 0.06% on average and $240 in trading fees). Grown at 6.1% for 37 years with your contributions, the money ends at $11,137,395 instead of $11,373,611. In broad index funds at 0.05% it would end at $11,181,836: $44,441 more.");
  const [, l3] = draw((p) => { p.investments.advisoryFee = 0.01; p.investments.planFees = { k401: { dollars: 100 } }; p.investments.tradingFees = { year: 2026, amount: 240 }; });
  assert.equal(l3, "$10,554 a year today: 1.09% of $969,500 ($519 in fund fees at 0.06% on average, $9,695 to an advisor at 1.00%, $100 charged by your plan at work and $240 in trading fees). Grown at 6.1% for 37 years with your contributions, the money ends at $7,901,364 instead of $11,373,611. In broad index funds at 0.05%, still paying your plan's own fee, it would end at $11,168,963: $3,267,599 more.");
  const [h4, l4] = draw((p) => { p.accounts.push({ id: "k2", name: "Lee's 403(b)", type: "401k", balance: 1000 }); p.holdings.push({ id: "z", accountId: "k2", symbol: "VTI", shares: 10, price: 100, costBasis: 1000 }); p.investments.planFees = { k401: { dollars: 100 }, k2: { dollars: 50 } }; p.investments.advisoryFee = 0.01; });
  assert.equal(h4.startsWith("Fees cost you about"), true);
  assert.match(l4, / and \$150 charged by your plans at work\)\..* In broad index funds at 0\.05%, still paying your plans' own fees, it would end at /);
  const [h5, l5] = draw((p) => { for (const x of p.holdings) x.expenseRatio = 0; });
  assert.equal(h5, "Your investments cost almost nothing to hold");
  assert.equal(l5, "0.00% on average across $969,500: index-fund territory. Nothing to change here.");
});

test("#34 after a save the green line names the new answer (R7)", () => {
  const d0 = compute(investmentsPlan(), { today: T });
  const p = investmentsPlan(); p.investments.planFees = { k401: { pct: 0.002, dollars: 60 } };
  const d1 = compute(p, { today: T });
  assert.equal(savedWords(headlineOf(d0, money), d1, money), "Saved. Fees now cost you about $611,752 over the plan, $1,615 a year today.");
  assert.equal(savedWords(headlineOf(d1, money), d1, money), "Saved.");
  const z = investmentsPlan(); for (const x of z.holdings) x.expenseRatio = 0;
  assert.equal(savedWords(headlineOf(d0, money), compute(z, { today: T }), money), "Saved. Your investments now cost almost nothing to hold.");
  assert.equal(savedWords("What your investments cost", compute(emptyPlan(), { today: T }), money), "Saved. These fees count once your funds are on the Holdings page.");
});

// ---- invariance (gap spec 3.5): with the new fields absent, compute() is what it was
test("gap #34 invariance: over the invented households and the four fixture plans, the keys are as before and blank new fields change nothing", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [["family", familyPlan(T)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["investments", investmentsPlan()], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 19);
  for (const [name, p0] of plans) for (const day of ["2026-03-01", T, "2027-02-01"]) {
    const p = migrate(structuredClone(p0));
    const d = compute(p, { today: day });
    assert.deepEqual(Object.keys(d), KEYS, name);
    const blank = structuredClone(p);
    blank.investments.planFees = Object.fromEntries((blank.accounts ?? []).map((a) => [a.id, { pct: 0, dollars: 0 }]));
    blank.investments.tradingFees = { year: Number(day.slice(0, 4)), amount: 0 };
    assert.equal(JSON.stringify(compute(blank, { today: day })), JSON.stringify(d), `${name} @ ${day}`);
  }
});

// ---- the page, drawn with the real kit on the fake DOM
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const kit = await import("../../../core/ui/dom.js");
const { render: drawPage } = await import("./view.js");
function page(plan0, today = T) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], root: null };
  const ctx = () => ({ ui: kit, fmt: { ...fmt, today: () => today }, plan, module: { group: "investments", id: "fees" }, route: { group: "investments", id: "fees", rest: [], query: {} },
    go: () => {}, store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } }, redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); drawPage(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const every = (el) => [el, ...el.all()];
const isOpen = (el) => el.hasAttribute("open");
const shutAround = (e) => { for (let p = e.parentNode; p; p = p.parentNode) if (p.tagName === "DETAILS" && !isOpen(p)) return true; return false; };
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden || n.tagName === "STYLE" ? "" : n.tagName === "DETAILS" && !isOpen(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const partsOf = (root) => every(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const titleIn = (el) => el.querySelector(".fold-title")?.textContent ?? "";
const statusIn = (el) => el.querySelector(".fold-status")?.textContent ?? "";
const filled = (root) => every(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|link|ghost|small|danger/.test(e.className) && !shutAround(e));
const boxesSeen = (root) => every(root).filter((e) => (e.tagName === "INPUT" || e.tagName === "SELECT") && !shutAround(e));
const input = (root, name) => every(root).find((e) => e.tagName === "INPUT" && e.getAttribute("name") === name);
const okLines = (root) => every(root).filter((x) => /\bnotice\b/.test(x.className) && /\bok\b/.test(x.className)).map((x) => x.textContent);

test("#34 page: the first view is as before, the fees the funds hide wait in one shut part \"Set my own numbers\", and no <details> is written by hand", () => {
  const s = page(investmentsPlan());
  const parts = partsOf(s.root);
  assert.deepEqual(parts.map((e) => [e.dataset.part, e.dataset.kind, titleIn(e), statusIn(e), isOpen(e)]), [["own", "own", "Set my own numbers", "none typed", false]]);
  assert.ok(every(s.root).filter((e) => e.tagName === "DETAILS").every((e) => e.dataset.part || /\bform-more\b/.test(e.className)), "every fold is a part (or the form's own More details)");
  const words = seen(s.root);
  assert.match(words, /^Fees cost you about \$\d[\d,]* over the plan /);
  assert.ok(!/plan at work|trading fees|plan's own/i.test(words), "nothing new on the first view");
  assert.equal(boxesSeen(s.root).length, 0);
  assert.equal(filled(s.root).length, 0);
  // inside the part: the advisor's fee, the 401(k)'s own fee in dollars, trading; the 401(k)'s % under More details (optional)
  const own = partOf(s.root, "own");
  const where = (e) => (e.closest(".form-more") ? "more" : "first");
  assert.deepEqual(every(own).filter((e) => e.tagName === "INPUT").map((e) => [e.getAttribute("name"), where(e)]),
    [["advisoryFee", "first"], ["planDollars-k401", "first"], ["tradingFees", "first"], ["planPct-k401", "more"]]);
  assert.match(own.textContent, /Each quarterly statement shows the dollars taken/);
});

test("#34 page: with no investments on Holdings the empty view keeps one filled button, and names a 401(k) whose funds are not there yet", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = page(familyPlan(T));
  assert.equal(filled(s.root).length, 1);
  assert.deepEqual(partsOf(s.root).map((e) => [e.dataset.part, isOpen(e)]), [["own", false]]);
  const own = partOf(s.root, "own");
  assert.match(own.textContent, /Ana's 401\(k\) and Bo's old 401\(k\) have no funds on the Holdings page yet/);
  assert.equal(input(own, "planDollars-a-401"), undefined);
});

test("S11 and R7 (#34): saving inside \"Set my own numbers\" writes the fees, keeps that part open and opens or shuts no other, names the new answer in green, and the status says what is set", () => {
  const s = page(investmentsPlan());
  const before = seen(s.root).slice(0, 60);
  input(s.root, "planDollars-k401").value = "60";
  input(s.root, "planPct-k401").value = "0.2";
  input(s.root, "tradingFees").value = "240";
  every(s.root).find((e) => e.tagName === "FORM").dispatch("submit");
  assert.equal(s.saved.length, 1);
  const inv = s.plan().investments;
  assert.deepEqual(inv.planFees, { k401: { pct: 0.002, dollars: 60 } });
  assert.deepEqual(inv.tradingFees, { year: 2026, amount: 240 });
  assert.equal(inv.advisoryFee, 0);
  assert.deepEqual(partsOf(s.root).map((e) => [e.dataset.part, isOpen(e)]), [["own", true]], "the part just saved stays open (R17)");
  assert.deepEqual(okLines(s.root), ["Saved. Fees now cost you about $641,879 over the plan, $1,855 a year today."]);
  assert.notEqual(seen(s.root).slice(0, 60), before);
  assert.equal(statusIn(partOf(s.root, "own")), "3 set by you");
  assert.match(seen(s.root), /charged by your plan at work and \$240 in trading fees\)/);
  // inside, what is counted
  assert.match(partOf(s.root, "own").textContent, /Sam's 401\(k\): \$1,096 a year/);
  // a new visit: the part shut, its status kept
  const again = page(s.plan());
  assert.deepEqual(partsOf(again.root).map((e) => [isOpen(e), statusIn(e)]), [[false, "3 set by you"]]);
  assert.deepEqual(okLines(again.root), []);
  // clearing every box takes the fields away again: the plan is as it was
  for (const k of ["planDollars-k401", "planPct-k401", "tradingFees"]) input(again.root, k).value = "";
  every(again.root).find((e) => e.tagName === "FORM").dispatch("submit");
  assert.equal(again.plan().investments.planFees, undefined);
  assert.equal(again.plan().investments.tradingFees, undefined);
  // a trading figure saved again unchanged keeps the year it was typed for
  const old = investmentsPlan(); old.investments.tradingFees = { year: 2025, amount: 300 };
  const o = page(old);
  every(o.root).find((e) => e.tagName === "FORM").dispatch("submit");
  assert.deepEqual(o.plan().investments.tradingFees, { year: 2025, amount: 300 });
});
