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

test("this year's figures are the Federal estimate's; the ladder covers every bracket and marks the current one", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const f = federal(familyPlan(), { today: TODAY });
  // the whole year's tax (self-employment tax included), as Withholding check and the Federal estimate's headline say;
  // the walk gains the business rows and ends at it (round 4, 2026-11-02)
  const a = taxAnswer(familyPlan(), { today: TODAY });
  assert.equal(d.thisYear.totalTax, a.totalTax); assert.equal(d.thisYear.incomeTax, f.result.totalTax);
  assert.equal(d.thisYear.steps.length, f.steps.length + 2);
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
