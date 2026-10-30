import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, schedule, loanCost, PROJECTS, DEFAULTS } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("schedule: interest by hand; with no discount the payments' present value is what is paid", () => {
  const s = schedule(1000, 0.12, 100);
  let b = 1000, i = 0, paid = 0; for (let m = 0; m < 20 && b > 0.005; m++) { const x = b * 0.01, p = Math.min(100, b + x); i += x; paid += p; b = b + x - p; }
  near(s.interest, i); near(s.pv, paid);
  assert.ok(schedule(1000, 0.12, 100, 0.06).pv < s.pv);
});

test("loanCost: the level payment, and at a discount equal to the rate the payments are worth the loan", () => {
  const l = loanCost(30000, 0.08, 10, 0.08);
  near(l.payment, pmt(0.08 / 12, 120, 30000)); near(l.pv, 30000, 0.05);
  near(l.interest, l.payment * 120 - 30000, 0.05);
});

test("value added: the project's average share, or your own", () => {
  const p = emptyPlan(); p.whatIfs = { renovation: { project: "garage-door", cost: 4000 } };
  const d = compute(p, { today: TODAY });
  near(d.valueAdded, 4000 * PROJECTS["garage-door"].recoup); assert.ok(d.equityChange > 0);
  p.whatIfs.renovation.recoup = 0.4;
  near(compute(p, { today: TODAY }).valueAdded, 1600);
});

test("the family's kitchen: four ways; no cash to spare; the line ranks first in today's money", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.ways.map((w) => w.id), ["cash", "heloc", "refi", "loan"]);
  const cash = d.ways[0]; assert.equal(cash.fits, false);
  near(d.discount, planReturn(p));
  const heloc = d.ways.find((w) => w.id === "heloc"), loan = d.ways.find((w) => w.id === "loan");
  const h = loanCost(30000, DEFAULTS.helocRate, DEFAULTS.helocYears, d.discount);
  near(heloc.monthly, h.payment); near(heloc.today, h.pv - 30000);
  const l = loanCost(30000, DEFAULTS.loanRate, DEFAULTS.loanYears, d.discount);
  near(loan.today, l.pv - 30000);
  assert.equal(heloc.taxSaved, 0, "the family takes the standard deduction");
  assert.equal(d.best, "heloc");
  near(d.home.borrowable, 380000 * DEFAULTS.cltv - 265000);
});

test("the refinance: the whole mortgage at the new rate against keeping it, closing costs borrowed too", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const r = d.ways.find((w) => w.id === "refi");
  const fees = (265000 + 30000) * DEFAULTS.refiCosts;
  near(r.fees, fees);
  const nl = loanCost(265000 + 30000 + fees, DEFAULTS.refiRate, DEFAULTS.refiYears, d.discount);
  const old = schedule(265000, 0.0625, 1980, d.discount);
  near(r.monthly, nl.payment - 1980); near(r.interest, nl.interest - old.interest); near(r.today, nl.pv - old.pv - 30000);
  assert.ok(r.risk, "it gives up a lower rate");
});

test("with the cash and no home: cash is the way, and no home loans are offered", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 80000, history: [] });
  p.whatIfs = { renovation: { project: "bath", cost: 20000 } };
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.ways.map((w) => w.id), ["cash", "loan"]);
  assert.equal(d.best, "cash"); assert.equal(d.home, null);
  near(d.cushion.after, 60000);
});
