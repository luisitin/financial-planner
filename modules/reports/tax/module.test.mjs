import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { compute as federal } from "../../taxes/federal/compute.js";
import { taxAnswer } from "../../taxes/withholding/compute.js";

const TODAY = "2026-10-30";

test("no income: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("this year's figures are the Federal estimate's; the ladder covers every bracket and marks the current one", async () => {
  const d = compute(familyPlan(), { today: TODAY });
  const f = federal(familyPlan(), { today: TODAY });
  // the whole year's tax (self-employment tax included), as Withholding check and the Federal estimate's headline say;
  // the walk gains the business rows and ends at it (round 4, 2026-11-02)
  const a = taxAnswer(familyPlan(), { today: TODAY });
  // the income tax is the Federal estimate's (known.js: the business at its profit), not the answer keys' return (round 8
  // review: the report's rates and bracket came from that return while its walk and total did not)
  const { known } = await import("../../taxes/federal/known.js");
  const k = known(familyPlan(), { today: TODAY });
  assert.equal(d.thisYear.totalTax, a.totalTax); assert.equal(d.thisYear.incomeTax, k.result.totalTax);
  assert.equal(d.thisYear.taxableIncome, k.result.taxableIncome); assert.equal(d.thisYear.bracketRate, k.result.bracketRate); assert.equal(d.thisYear.nextDollar, k.nextDollar);
  // round 8 item 20: worked with the business at its profit: an Adjustments row (half the self-employment tax), the 20%
  // deduction and the self-employment tax join the walk
  assert.equal(d.thisYear.steps.length, f.steps.length + 3);
  assert.ok(["Adjustments", "Business deduction (20%)", "Self-employment tax"].every((l) => d.thisYear.steps.some((x) => x.label === l)));
  assert.equal(d.thisYear.steps.find((x) => x.label === "Federal tax").amount, a.totalTax);
  assert.ok(d.thisYear.seTax > 1000 && d.thisYear.seTax < 1100, "the family's 7,200 of photography: about 1,017");
  assert.equal(d.ladder.length, 7); assert.equal(d.ladder.filter((l) => l.current).length, 1);
  assert.equal(d.ladder.find((l) => l.current).rate, d.thisYear.bracketRate);
  assert.equal(d.paying.verdict, a.verdict, "estimated from pay, the same answer as Withholding check"); assert.equal(Math.round(d.paying.balance), Math.round(a.balance));
  assert.equal(d.hsa, null); assert.equal(d.gains.hasSales, false);
  assert.ok(d.retirement.ready && d.retirement.years > 0);
});

test("the tax fixture: withholding about right, sales, an HSA", () => {
  const d = compute(taxPlan(), { today: TODAY });
  assert.equal(d.paying.verdict, taxAnswer(taxPlan(), { today: TODAY }).verdict, "the same answer as Withholding check");
  assert.equal(d.gains.hasSales, true); assert.ok(d.gains.taxOnGains > 0);
  assert.ok(d.hsa && d.hsa.taxSaved > 0);
});

// --- Review 2026-11-06 (verifier) ------------------------------------------------------------------------------------------
/** The report's text with a stand-in for the UI kit; the page's computeRemote answers with this compute. */
async function reportText(plan, today = TODAY) {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, replaceChildren(...k) { x.kids = []; x.append(...k); }, querySelector() { return null; }, addEventListener() {}, setAttribute() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const base = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]) };
  const ui = new Proxy(base, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const root = node("root");
  let done; const ready = new Promise((r) => { done = r; });
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} }, computeRemote: async (route, params) => { const d = compute(plan, params); setTimeout(done, 0); return d; } });
  await ready;
  return root.textContent.replace(/\s+/g, " ");
}

test("Review 2026-11-06 (verifier): filing separately, Paying it says each return's own bill or refund, not the two netted", async () => {
  // the family filing separately, 3,750 each in child care accounts: Ana's return gets 2,200 back, Bo's owes 1,659.70 (his
  // business's self-employment tax is on his return). The report said "a refund of about $540 next spring", the two netted,
  // while Withholding check, the Federal estimate, Quick answers and Needs attention say each return's own
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  p.whatIfs = { ...(p.whatIfs ?? {}), benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const d = compute(p, { today: TODAY });
  const a = taxAnswer(p, { today: TODAY });
  assert.equal(d.paying.returns.length, 2);
  const by = Object.fromEntries(d.paying.returns.map((x) => [x.name, x]));
  assert.ok(Math.abs(by.Bo.balance - a.returns.find((x) => x.name === "Bo").balance) < 0.005 && by.Bo.verdict === "owe");
  assert.ok(Math.abs(by.Ana.balance + 2200) < 0.5 && by.Ana.verdict === "refund");
  const t = await reportText(p);
  assert.ok(!t.includes("a refund of about $540"), t);
  assert.ok(t.includes("Filing separately, each return settles on its own, and one return's refund cannot pay the other's bill."), t);
  assert.ok(t.includes("Ana's return: a refund of about $2,200 next spring.") && t.includes("Bo's return: about $1,660 left to pay at filing"), t);
  // filing jointly the line is the household's, as before
  const j = await reportText(familyPlan(TODAY));
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).paying.returns, null);
  assert.ok(/left to pay at filing|a refund of about|about right/.test(j) && !j.includes("Filing separately, each return"));
});

// --- Review 2026-11-06 (fix round 6) --------------------------------------------------------------------------------------
test("Review 2026-11-06: a plan with no retirement year finishes the report and says why (17 qa households never finished)", async () => {
  // H-0008: the plan runs to 60 and Maya retires at 70; the tax projection has no retired row, so `peak` is null and the
  // view threw on r.peak.year inside .then: the page stayed on "Putting the tax report together..."
  const p = familyPlan(TODAY);
  for (const x of p.household.people.filter((y) => y.role !== "dependent")) { x.retirementAge = 70; x.lifeExpectancy = 60; }
  const t = await reportText(p);
  assert.ok(!t.includes("Putting the tax report together"), t.slice(0, 300));
  const d = compute(p, { today: TODAY });
  assert.equal(d.retirement.ready, true); assert.equal(d.retirement.years, 0); assert.equal(d.retirement.peak, null);
  assert.deepEqual(d.retirement.noYears, { why: "the plan runs to 60, and Ana and Bo retire at 70", check: 'the retirement age and "Plan to age"' });
  assert.ok(t.includes(`There are no retirement years to tax: the plan runs to 60, and Ana and Bo retire at 70. Check the retirement age and "Plan to age" on the People page.`), t);
  assert.ok(t.includes("Prepared with Financial Planner on"), "the report reaches its last line");
  // H-0090: born 1900, past the plan's end age
  const old = familyPlan(TODAY); old.household.people = old.household.people.filter((y) => y.id !== "p-bo"); old.household.people.find((y) => y.id === "p-ana").birthDate = "1900-01-01";
  old.household.filingStatus = "single"; old.income = old.income.filter((x) => x.personId !== "p-bo");
  const to = await reportText(old);
  assert.ok(to.includes("There are no retirement years to tax: Ana is 126, past the age the plan runs to (95). Check the birth date on the People page."), to.slice(-900));
  // one retirement year: "1 retirement year", no average and no "the most in"
  const one = structuredClone(old); one.household.people.find((y) => y.id === "p-ana").birthDate = "1990-05-20";
  Object.assign(one.household.people.find((y) => y.id === "p-ana"), { retirementAge: 94, lifeExpectancy: 94 });
  assert.equal(compute(one, { today: TODAY }).retirement.years, 1);
  const t1 = await reportText(one);
  assert.ok(t1.includes("Over 1 retirement year the plan pays") && !t1.includes("a year on average") && !t1.includes("the most in"), t1.slice(-900));
});

test("Review 2026-11-06: filing separately, the rates and the brackets are each return's own, not the two added up on one ladder", async () => {
  // the family filing separately: the report read "The next dollar of ordinary income pays 22%; $X more taxable income fits
  // in the 22% bracket" beside the two returns' combined taxable income, with Ana's room on the separate-return ladder
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  const t = await reportText(p);
  assert.ok(!t.includes("The next dollar of ordinary income pays"), "not the household's one line: " + t.slice(0, 600));
  const d = compute(p, { today: TODAY });
  // each return as the Federal estimate works it (known.js: Bo's business at its profit on his return)
  const { known } = await import("../../taxes/federal/known.js");
  const kp = known(p, { today: TODAY }), f = { result: kp.result, nextDollar: kp.nextDollar, inputs: kp.inputs, params: kp.fed.params };
  const rets = d.thisYear.returns;
  assert.equal(rets.length, 2); assert.deepEqual(rets.map((x) => x.name), f.result.separate.map((x) => x.name));
  for (const x of rets) {
    const own = f.result.separate.find((y) => y.personId === x.personId);
    assert.equal(x.ordinaryTaxable, own.ordinaryTaxable); assert.equal(x.bracketRate, own.bracketRate);
    // the room is the top of the return's own rung less its own ordinary taxable income
    const rung = x.ladder.find((l) => l.current);
    assert.equal(rung.rate, x.bracketRate); assert.ok(Math.abs(x.roomInBracket - (rung.to - x.ordinaryTaxable)) < 0.005);
    // the ladder fills to the return's own taxable income, and its tax is each slice at its rate
    assert.ok(Math.abs(x.ladder.reduce((s, l) => s + l.filled, 0) - x.ordinaryTaxable) < 0.005);
    assert.ok(Math.abs(x.ladder.reduce((s, l) => s + l.tax, 0) - x.ladder.reduce((s, l) => s + l.filled * l.rate, 0)) < 1e-6);
  }
  // the shown return's next dollar is the Federal estimate's; the other's is the same probe with more income on that return
  const shown = rets.find((x) => x.shown);
  assert.equal(shown.personId, f.result.separateTo); assert.equal(shown.nextDollar, f.nextDollar);
  const { nextDollarOf } = await import("../../taxes/federal/compute.js");
  const other = rets.find((x) => !x.shown);
  assert.equal(other.nextDollar, nextDollarOf({ ...f.inputs, separateTo: other.personId }, f.params));
  const m = (n) => `$${Math.round(n).toLocaleString("en-US")}`, pc = (r) => `${Math.round(r * 100)}%`;
  const [a, b] = rets;
  assert.ok(t.includes(`Filing separately, each return has its own brackets: on ${a.name}'s return the next dollar of regular income is taxed at ${pc(a.nextDollar)}, and ${m(a.roomInBracket)} more taxable income fits in the ${pc(a.bracketRate)} bracket before ${pc(a.nextRate)} starts; on ${b.name}'s, the next dollar is taxed at ${pc(b.nextDollar)}, and ${m(b.roomInBracket)} more fits in the ${pc(b.bracketRate)} bracket`), t.slice(0, 900));
  assert.ok(t.includes(`${a.name}'s return: ${m(a.ordinaryTaxable)} of taxable income (not counting long-term gains)`) && t.includes(`${b.name}'s return: ${m(b.ordinaryTaxable)} of taxable income (not counting long-term gains)`), t);
  // "The rates": a column a return (a row a figure, so it fits a 360 px phone), with the same room as the opening (to the dollar)
  assert.ok(t.includes(`${a.name}'s ${b.name}'s The next dollar ${pc(a.nextDollar)} ${pc(b.nextDollar)} Bracket ${pc(a.bracketRate)} ${pc(b.bracketRate)} Room left in it ${m(a.roomInBracket)} ${m(b.roomInBracket)}`) && !t.includes("Your bracket"), t);
  // filing jointly the report keeps the household's one ladder and line
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).thisYear.returns, null);
  const j = await reportText(familyPlan(TODAY));
  assert.ok(j.includes("Your next dollar of regular income is taxed at") && j.includes("Your bracket") && !j.includes("Filing separately, each return has its own brackets"));
});

test("Review 2026-11-06: every report finishes when its figures cannot be worked out (settleReport)", async () => {
  const { settleReport } = await import("../report-kit.js");
  const node = (tag, kids = []) => ({ tag, kids, replaceChildren(...k) { this.kids = k; }, get textContent() { return this.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } });
  const ui = { notice: (lv, t) => node(`notice:${lv}`, [t]) };
  const quiet = console.error; console.error = () => {};
  try {
    // the compute failed (the shell's safeCompute answers { error }): not "The review needs ." or "It needs:" with nothing after
    const h1 = node("host", [node("notice:info", ["Rolling the year up..."])]); let drew = false;
    await settleReport(Promise.resolve({ error: "TypeError: x" }), h1, ui, "year in review", () => { drew = true; });
    assert.equal(drew, false); assert.equal(h1.kids[0].tag, "notice:error");
    assert.equal(h1.textContent, "The year in review could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates and the ages on the People page, then reload the page.");
    // drawing throws part way (the tax report's r.peak.year): the half-drawn sheet gives way to the notice
    const h2 = node("host", [node("notice:info", ["Putting the tax report together..."])]);
    await settleReport(Promise.resolve({ ready: true }), h2, ui, "tax report", () => { h2.kids.push("half"); throw new TypeError("Cannot read properties of null (reading 'year')"); });
    assert.equal(h2.kids.length, 1); assert.match(h2.textContent, /^The tax report could not be put together/);
    // the remote compute rejects
    const h3 = node("host", []);
    await settleReport(Promise.reject(new Error("offline")), h3, ui, "retirement report", () => {});
    assert.match(h3.textContent, /^The retirement report could not be put together/);
    // a good answer is drawn
    const h4 = node("host", []); let got = null;
    await settleReport(Promise.resolve({ ready: true, n: 1 }), h4, ui, "tax report", (d) => { got = d.n; });
    assert.equal(got, 1); assert.equal(h4.kids.length, 0);
  } finally { console.error = quiet; }
  // every report page goes through it
  const fs = await import("node:fs");
  for (const m of ["tax", "retirement", "plan-summary", "statements", "annual-review"]) {
    const src = fs.readFileSync(new URL(`../${m}/view.js`, import.meta.url), "utf8");
    assert.ok(/settleReport\(ctx\.computeRemote\(/.test(src) && !/ctx\.computeRemote\([^)]*\)\.then\(/.test(src), `${m}: its compute's answer is drawn through settleReport`);
  }
});

test("round 8 review 3: the report's rates, bracket, room and ladder are the return its total is worked on (the Federal estimate's)", async () => {
  const { widowPlan, freelancerPlan, equityPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const T = "2026-11-06";
  // the widow with this year's required withdrawal: taxable 35,104.30 in the 12% bracket; the ladder adds up to her 3,964.52
  const w = compute(widowPlan(), { today: T });
  assert.equal(w.thisYear.bracketRate, 0.12); assert.ok(Math.abs(w.thisYear.taxableIncome - 35104.3) < 0.05, String(w.thisYear.taxableIncome));
  assert.ok(Math.abs(w.ladder.reduce((t, x) => t + x.tax, 0) - 3964.52) < 0.05, String(w.ladder.reduce((t, x) => t + x.tax, 0)));
  assert.equal(w.thisYear.nextDollar, w.thisYear.marginal); assert.ok(Math.abs(w.thisYear.nextDollar - 0.222) < 0.002, String(w.thisYear.nextDollar));
  // the hold-back leads the paying lines' figures (no "past due" route first)
  assert.equal(w.paying.holdBack.amount, 3600);
  // the freelancer with the business at its profit: 42,711.58 taxable, the 12% bracket (it read 22% and 58,900)
  const f = compute(freelancerPlan(), { today: T });
  assert.equal(f.thisYear.bracketRate, 0.12); assert.ok(Math.abs(f.thisYear.taxableIncome - 42711.58) < 0.05);
  // the stock couple: the 24% bracket
  assert.equal(compute(equityPlan(), { today: T }).thisYear.bracketRate, 0.24);
});

// --- round 8, batch 1 verify (2026-11-06) ------------------------------------------------------------------------------
test("round 8 verify: the 0% gain room and the tax sales add are worked on the return the report's walk shows", async () => {
  const { widowPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { known } = await import("../../taxes/federal/known.js");
  const { compute: gainsPage } = await import("../../taxes/capital-gains/compute.js");
  const R8 = "2026-11-06";
  const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
  // Ruth: 35,104 of taxable income with her required withdrawal; the 0% line is 49,450 (Rev. Proc. 2025-32 sec. 4.03), and
  // each dollar of gain also makes 85 cents of her Social Security taxable until 85% of it is (23,460, 3,084 more): 3,628 of
  // gain pulls that in (6,712 of taxable income), then 7,634 more reaches the line: 11,262, not the 27,340 the keys' return
  // (no withdrawal, 5,360 taxable) leaves
  const d = compute(widowPlan(), { today: R8 });
  assert.equal(d.thisYear.taxableIncome, known(widowPlan(), { today: R8 }).result.taxableIncome);
  near(d.gains.zeroRoom, 11262, 1);
  // a 10,000 long-term sale: Social Security taxed 23,460 (3,083.70 more), AGI 72,338, taxable 48,188 (all of the gain under
  // the 0% line), ordinary tax 1,240 + 12% x 25,788 = 4,334.56: the sale adds 370.04 (the Social Security it pulls in)
  const p = widowPlan(); p.taxes = { ...(p.taxes ?? {}), gains: [{ id: "g1", name: "Fund", proceeds: 30000, basis: 20000, held: "long" }] };
  const s = compute(p, { today: R8 });
  near(s.gains.taxOnGains, 370.04, 0.01);
  near(s.gains.taxOnGains, known(p, { today: R8 }).total - known(widowPlan(), { today: R8 }).total, 1e-6);
  // a household none of the plan's steps change keeps the Capital gains page's figures exactly
  const t = compute(taxPlan(), { today: TODAY }), g = gainsPage(taxPlan(), { today: TODAY });
  assert.equal(known(taxPlan(), { today: TODAY }).changed, false);
  assert.equal(t.gains.zeroRoom, g.zeroRoom); assert.equal(t.gains.taxOnGains, g.taxOnGains);
});
