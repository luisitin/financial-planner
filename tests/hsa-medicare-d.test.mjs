// Follow-up 2026-11-07 (HSA verify R3 and R4): the widow on Medicare reads the rule once, a retiree is not told her HSA money is
// "taxed as pay", the "At 65" tile is only for someone under 65, and the Health page does not count payroll tax for a retiree.
// Invented households only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute } from "../modules/taxes/hsa-fsa/compute.js";
import { compute as health } from "../modules/insurance/health/compute.js";
import { pageText } from "../qa/fixtures/fake-dom.mjs";
import { widowPlan } from "../qa/fixtures/widow-plan.mjs";

const T = "2026-11-06";
const RULE = /Once you're on Medicare you can't add to an HSA/g;
const widow = (hsa = 4400, balance = 3000) => {
  const w = widowPlan();
  w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance, asOf: T, ownerId: "p-ruth" });
  w.taxes.hsa = { coverage: "self", contribution: hsa, employer: 0, fsa: 0, fsaSpent: 0 };
  return w;
};
const page = async (plan) => (await pageText(new URL("../modules/taxes/hsa-fsa/view.js", import.meta.url), plan, T)).replace(/\u200b/g, "").replace(/\s+/g, " ");

test("R3: the widow reads the Medicare rule once on the HSA page, not in the headline and again in the note under it", async () => {
  const d = compute(widow(), { today: T });
  const note = d.notes.find((n) => /on Medicare/.test(n)) ?? "";
  assert.ok(/Ruth is on Medicare \(people 65 or older who get Social Security are signed up for Medicare Part A\)\./.test(note), note);
  assert.ok(!RULE.test(note), "the note leaves the rule to the headline: " + note);
  assert.ok(/too much/.test(note) && /Take it out before the tax filing deadline and stop adding to it/.test(note), note);
  const text = await page(widow());
  assert.equal((text.match(RULE) ?? []).length, 1, text.slice(0, 700));
  // a household where the headline does not say it (part of the year, or a spouse still eligible) keeps the sentence in the note
  const part = emptyPlan();
  part.household.filingStatus = "single"; part.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1961-07-15" }];
  part.income = [{ id: "ss", name: "Social Security", type: "social", personId: "a", amount: 24000, period: "annual", growth: 0, startDate: "2026-07-01", taxable: true }];
  part.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }]; part.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  assert.ok(RULE.test(compute(part, { today: T }).notes.find((n) => /on Medicare/.test(n)) ?? ""));
});

test("R3: a 74-year-old reads no 'At 65' tile, and a retiree's 'Tax saved' says why it is nothing", async () => {
  const text = await page(widow(0, 3000));
  assert.ok(!/At 65/.test(text), text.slice(0, 900));
  assert.ok(/\$3,000 In the account today, for medical bills/.test(text), text.slice(0, 900));
  // typed money for a retiree: the sub-line is not "on your own money from pay"
  const typed = await page(widow(4400, 3000));
  assert.ok(!/on your own money from pay/.test(typed) && !/saves tax only when it comes out of pay/.test(typed) && /none: on Medicare nothing can go in/.test(typed), typed.slice(0, 900));
  // money review M5: a 62-year-old retiree with a small pension is not on Medicare and her limit is not 0: the reason is her income; with a
  // bigger pension the same typed money DOES save income tax with no pay at all (4,400 x 12% = 528: Form 8889, IRC 223(a))
  const retiree = (pension) => {
    const r = emptyPlan();
    r.household.filingStatus = "single"; r.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1964-05-05" }];
    r.income = [{ id: "pen", name: "Pension", type: "pension", personId: "a", amount: pension, period: "annual", growth: 0, taxable: true }];
    r.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }]; r.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
    return r;
  };
  const small = await page(retiree(14000));
  assert.ok(/none: no income tax to save at this income/.test(small) && !/Medicare nothing can go in/.test(small), small.slice(0, 900));
  const bigger = compute(retiree(40000), { today: T });
  assert.ok(bigger.hsa.noPay && bigger.hsa.taxSaved > 400 && bigger.hsa.ficaSaved === 0, JSON.stringify([bigger.hsa.taxSaved, bigger.hsa.ficaSaved]));
  assert.ok(!/saves tax only when it comes out of pay/.test(await page(retiree(40000))));
  // someone under 65 keeps the tile
  const young = emptyPlan();
  young.household.filingStatus = "single"; young.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1990-05-05" }];
  young.income = [{ id: "pay", name: "Pay", type: "salary", personId: "a", amount: 80000, period: "annual", growth: 0, taxable: true }];
  young.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }]; young.taxes.hsa = { coverage: "self", contribution: 2000, employer: 0, fsa: 0, fsaSpent: 0 };
  assert.ok(/At 65/.test(await page(young)));
});

test("R3: the Health page does not count payroll tax for a retiree, and says nothing is counted on Medicare", async () => {
  const w = widow(0, 3000);
  w.insurance.health = { tier: "self", expected: 5000, plans: [{ id: "x", name: "HDHP", premium: 300, deductible: 3400, oopMax: 7000, coinsurance: 0.2, hsa: true, employerHsa: 0 }] };
  const h = health(w, { today: T });
  assert.equal(h.hsaLimit, 0); assert.equal(h.payrollRate, 0);
  const text = (await pageText(new URL("../modules/insurance/health/view.js", import.meta.url), w, T)).replace(/\s+/g, " ");
  assert.ok(!/up to the \$0 self-only limit/.test(text) && !/income tax plus payroll tax/.test(text), text.slice(0, 1200));
  assert.ok(/No HSA tax savings are counted: once you're on Medicare you can't add to an HSA\./.test(text), text.slice(0, 1400));
  // a retiree not on Medicare yet (62) with a limit: the limit is named, the payroll part is not
  const young = widow(0, 3000); young.household.people[0].birthDate = "1964-05-05";
  young.income = young.income.filter((x) => x.type !== "social");
  young.insurance.health = w.insurance.health;
  const y = health(young, { today: T });
  assert.ok(y.hsaLimit > 0 && y.payrollRate === 0, JSON.stringify([y.hsaLimit, y.payrollRate]));
  const yt = (await pageText(new URL("../modules/insurance/health/view.js", import.meta.url), young, T)).replace(/\s+/g, " ");
  assert.ok(/self-only limit, at [\d.]+% \(income tax\)\./.test(yt), yt.slice(0, 1400));
});

test("R4: the older notes do not say 'taxed as pay' for someone with no pay", () => {
  // a spouse with no pay outside the self-only plan: Mo is retired, Eve covered and working
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people = [{ id: "mo", name: "Mo", role: "self", birthDate: "1962-01-10" }, { id: "eve", name: "Eve", role: "partner", relation: "spouse", birthDate: "1964-02-02" }];
  p.income = [{ id: "pay", name: "Eve's pay", type: "salary", personId: "eve", amount: 80000, period: "annual", growth: 0, taxable: true }];
  p.accounts = [{ id: "hm", name: "Mo's HSA", type: "hsa", balance: 1000, ownerId: "mo" }, { id: "he", name: "Eve's HSA", type: "hsa", balance: 1000, ownerId: "eve" }];
  p.retirement.contributions = [{ id: "c1", accountId: "hm", personId: "mo", period: "annual", amount: 1000, employerMatch: 0 }];
  p.taxes.hsa = { coverage: "self", coveredId: "eve", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 };
  const note = compute(p, { today: T }).notes.find((n) => /not on the self-only health plan/.test(n)) ?? "";
  assert.ok(/Mo is not on the self-only health plan, so the 1,000 going into Mo's HSA is not allowed: it gets no tax break and is charged 6% a year until taken out\./.test(note), note);
  assert.ok(!/taxed as pay/.test(note));
  // with pay of their own it is still "taxed as pay"
  p.income.push({ id: "pay2", name: "Mo's pay", type: "salary", personId: "mo", amount: 40000, period: "annual", growth: 0, taxable: true });
  assert.ok(/it is taxed as pay and is charged 6%/.test(compute(p, { today: T }).notes.find((n) => /not on the self-only health plan/.test(n)) ?? ""));
  // no high-deductible plan at all, nobody paid: no break rather than "taxed as pay"
  const none = emptyPlan();
  none.household.filingStatus = "single"; none.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1950-05-05" }];
  none.income = [{ id: "pen", name: "Pension", type: "pension", personId: "a", amount: 20000, period: "annual", growth: 0, taxable: true }];
  none.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 100, ownerId: "a" }]; none.taxes.hsa = { coverage: "none", contribution: 1000, employer: 0, fsa: 0, fsaSpent: 0 };
  const nn = compute(none, { today: T }).notes.find((n) => /no high-deductible health plan/.test(n)) ?? "";
  assert.ok(/all of it gets no tax break and is charged 6% a year until it is taken out/.test(nn) && !/taxed as pay/.test(nn), nn);
});

test("money review M7: the Health page's HSA limit is the HSA page's, catch-up from 55 included", () => {
  const mk = (birth, ss) => {
    const p = emptyPlan();
    p.household.filingStatus = "single"; p.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: birth }];
    p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "a", amount: 80000, period: "annual", growth: 0, taxable: true }];
    if (ss) p.income.push({ id: "ss", name: "Social Security", type: "social", personId: "a", amount: 24000, period: "annual", growth: 0, startDate: ss, taxable: true });
    p.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }]; p.taxes.hsa = { coverage: "self", contribution: 2000, employer: 0, fsa: 0, fsaSpent: 0 };
    p.insurance.health = { tier: "self", expected: 5000, plans: [{ id: "x", name: "HDHP", premium: 300, deductible: 3400, oopMax: 7000, coinsurance: 0.2, hsa: true, employerHsa: 0 }] };
    return p;
  };
  // 66, working, no Social Security: 4,400 + 1,000 catch-up = 5,400 (was 4,400 here)
  const a = mk("1960-05-05", null);
  assert.equal(health(a, { today: T }).hsaLimit, compute(a, { today: T }).hsa.limit);
  assert.equal(health(a, { today: T }).hsaLimit, 5400);
  // 65 in July with Social Security from July: 5,400 x 6/12 = 2,700 (was 2,200: "only $2,200 can go in")
  const b = mk("1961-07-15", "2026-07-01");
  assert.equal(health(b, { today: T }).hsaLimit, 2700);
  assert.equal(compute(b, { today: T }).hsa.limit, 2700);
  // under 55: the plain 4,400
  assert.equal(health(mk("1990-05-05", null), { today: T }).hsaLimit, 4400);
});
