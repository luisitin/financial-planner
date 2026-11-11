// Money/UX review of the 2026-11-07 follow-up (UX 1, 3, 5, 6): the words a layperson reads. Invented households only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pageText } from "../qa/fixtures/fake-dom.mjs";
import { widowPlan } from "../qa/fixtures/widow-plan.mjs";

const T = "2026-11-06";
const page = async (rel, plan) => (await pageText(new URL(`../${rel}`, import.meta.url), plan, T)).replace(/​/g, "").replace(/\s+/g, " ");
const src = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("UX 3: the widow on Medicare is not sold an HSA under the headline that says she cannot add to one", async () => {
  const w = widowPlan();
  w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, asOf: T, ownerId: "p-ruth" });
  w.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  const t = await page("modules/taxes/hsa-fsa/view.js", w);
  assert.ok(/Once you're on Medicare you can't add to an HSA/.test(t));
  assert.ok(!/Why an HSA comes first/.test(t) && !/Three tax breaks, not two/.test(t), t.slice(0, 1500));
  assert.ok(/What you can still do/.test(t) && /Spend what is in the account/.test(t) && /Take out what was added this year/.test(t), t.slice(0, 1500));
  assert.ok(/Change what you typed/.test(t), "the form stays, folded, to fix the typed money");
  // the card points at the fold by the name it shows on Medicare (verify 2026-11-07: it said "This year's figures", a title she never sees)
  assert.ok(/type 0 under "Change what you typed" below/.test(t) && !/This year's figures/.test(t), t.slice(0, 2000));
  // someone who can still save keeps the case for an HSA
  const young = widowPlan(); young.household.people[0].birthDate = "1985-05-05"; young.income = young.income.filter((x) => x.type !== "social");
  young.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, asOf: T, ownerId: "p-ruth" });
  young.taxes.hsa = { coverage: "self", contribution: 2000, employer: 0, fsa: 0, fsaSpent: 0 };
  assert.ok(/Why an HSA comes first/.test(await page("modules/taxes/hsa-fsa/view.js", young)));
});

test("UX 5 and 6: Will the money last? says 'already retired' for a retiree and lists the withdrawal order in plain words", async () => {
  const t = await page("modules/retirement/projection/view.js", widowPlan());
  assert.ok(/Ruth: already retired \(74\), plan to 95/.test(t) || /already retired \(\d+\)/.test(t), t.slice(0, 2500));
  assert.ok(!/retires at 74/.test(t));
  assert.ok(!/\$0 tax-free|pre-tax,|, roth\b/.test(t) && /retirement accounts you pay tax on later/.test(t) && /Roth accounts \(tax already paid\)/.test(t), t.slice(0, 3500));
  assert.ok(/required withdrawals start at 73/.test(t), t.slice(0, 3500));
});

test("UX 1: between 6 and 9 in 10 the headline does not say 'It lasts, just'; Chance the money lasts says every, not 'almost every', at 100%", () => {
  const p = src("modules/retirement/projection/view.js");
  assert.ok(/c\.planned < 0\.9 \? "It lasts in most cases, not all"/.test(p));
  const m = src("modules/retirement/monte-carlo/view.js");
  assert.ok(/d\.successRate >= 1 \? "Strong: the money lasted in every pretend future\."/.test(m));
  assert.ok(/ui\.h\("h1", \{\}, "Chance the money lasts"\)/.test(m), "the heading is the menu name");
});

test("verify 2026-11-07 (HSA verify R3's last item): someone already 65 is not told what this year's money is worth 'at 65'", async () => {
  // Ruth turns 65 in July 2026 and gets Social Security from July: 2,700 may go in (the 6 months before Medicare, catch-up included)
  const w = widowPlan(); w.household.people[0] = { id: "p-ruth", name: "Ruth", role: "self", birthDate: "1961-07-15", retirementAge: 67, lifeExpectancy: null };
  w.income = [{ id: "i-pay", name: "Ruth's pay", type: "salary", personId: "p-ruth", amount: 70000, period: "annual", growth: 0, taxable: true },
    { id: "i-ss", name: "Ruth's Social Security", type: "social", personId: "p-ruth", amount: 2100, period: "monthly", growth: 0, startDate: "2026-07-01", taxable: true }];
  w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 8000, asOf: T, ownerId: "p-ruth" });
  w.taxes.hsa = { coverage: "self", contribution: 2000, employer: 0, fsa: 0, fsaSpent: 0 };
  const t = await page("modules/taxes/hsa-fsa/view.js", w);
  assert.ok(/against a limit of \$2,700/.test(t), t.slice(0, 800));
  assert.ok(!/at 65/.test(t.slice(0, t.indexOf("payroll tax"))), t.slice(0, 800));
  // someone of 41 still reads it
  const young = widowPlan(); young.household.people[0].birthDate = "1985-05-05"; young.income = young.income.filter((x) => x.type !== "social");
  young.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, asOf: T, ownerId: "p-ruth" });
  young.taxes.hsa = { coverage: "self", contribution: 2000, employer: 0, fsa: 0, fsaSpent: 0 };
  assert.ok(/this year's money alone is worth about \$[\d,]+ at 65/.test(await page("modules/taxes/hsa-fsa/view.js", young)));
});
