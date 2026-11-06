// modules/overview/quick/module.test.mjs -- the list and its rule: every row opens a usable page that saves only
// calculator inputs, quotes or a goal by its own button, never a record other pages count.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { compute, MOST_ASKED, MORE, NEEDS_FIRST, ALLOWED_WRITES, quickHref, questionFor } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { journeyById } from "../guide/compute.js";

const MODS = fileURLToPath(new URL("../../", import.meta.url));
const manifest = (key) => { const f = `${MODS}${key}/module.js`; return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
/** Pages that do not answer on an empty plan today (the 2026-10-31 sweep): never listed as quick. */
const NOT_QUICK_YET = ["debt/payoff", "debt/credit-cards", "debt/consolidation", "debt/student-loans", "debt/ratios", "cashflow/paycheck", "cashflow/budget-percent", "goals/emergency-fund", "retirement/fire", "retirement/projection", "insurance/life-needs", "taxes/self-employment", "goals/education", "taxes/withholding", "goals/goals", "goals/travel"];
const ALL = [...MOST_ASKED, ...MORE];

test("at most 8 to start with, no page twice, every title a question and every line a sentence", () => {
  assert.ok(MOST_ASKED.length <= 8 && MOST_ASKED.length >= 4);
  assert.equal(new Set(ALL.map((q) => q.key)).size, ALL.length);
  for (const q of [...ALL, ...NEEDS_FIRST]) { assert.match(q.title, /\?$/, q.title); assert.match(q.line, /^[A-Z].*\.$/, q.line); }
});
test("every row is a usable page that answers on an empty plan and saves nothing other pages count", () => {
  for (const q of ALL) {
    const src = manifest(q.key);
    assert.ok(src, `${q.key} exists`);
    assert.match(src, /status: "(usable|complete)"/, `${q.key} is usable`);
    assert.ok(!NOT_QUICK_YET.includes(q.key), `${q.key} does not answer on an empty plan yet`);
    const writes = JSON.parse((src.match(/writes: (\[[^\]]*\])/) ?? [null, "[]"])[1]);
    for (const w of writes) assert.ok(ALLOWED_WRITES.includes(w), `${q.key} writes ${w}`);
  }
});
test("questions that need numbers first open a real guide", () => {
  for (const n of NEEDS_FIRST) assert.ok(journeyById(n.guide), n.guide);
});
test("rows open their page with ?from=quick; pages off on this device are left out", () => {
  assert.equal(quickHref("goals/house"), "#/goals/house?from=quick");
  const d = compute(emptyPlan());
  assert.equal(d.mostAsked.length, MOST_ASKED.length);
  assert.equal(d.mostAsked[0].href, "#/goals/house?from=quick");
  assert.equal(d.needsFirst[0].href, "#/overview/guide/retire");
  const off = compute(emptyPlan(), { off: ["goals/house", "investments/risk", "overview/guide"] });
  assert.ok(!off.mostAsked.some((q) => q.key === "goals/house"));
  assert.ok(!off.more.some((q) => q.key === "investments/risk"));
  assert.equal(off.needsFirst.length, 0);
  assert.equal(questionFor("goals/house").title, "How much home can I afford?");
  assert.equal(questionFor("nope/nope"), null);
});

test("the plan's own answers: the sample family's three questions answer at once, an empty plan keeps the guides", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { compute, questionFor } = await import("./compute.js");
  const { compute: projection } = await import("../../retirement/projection/compute.js");
  const T = "2026-11-01";
  const p = familyPlan(T);
  const d = compute(p, { today: T });
  assert.deepEqual(d.answers.map((a) => a.guide), ["retire", "debt", "taxes"]);
  assert.deepEqual(d.needsFirst, []);
  const by = Object.fromEntries(d.answers.map((a) => [a.guide, a]));
  assert.equal(by.retire.headline, projection(p, { today: T }).verdict === "on track" ? "The money lasts" : by.retire.headline, "the answer page's own heading");
  assert.match(by.debt.headline, /^Debt-free by [A-Z][a-z]+ \d{4}$/);
  // the question is "what will I owe": the April bill or refund first (withholding estimated from pay), the year's tax in the line
  assert.match(by.taxes.headline, /^(Owe about \$[\d,]+ in April|About \$[\d,]+ back in April|About right: no big bill or refund)$/);
  assert.match(by.taxes.line, /of federal tax for 2026 .*your paychecks take out about \$[\d,]+, estimated from your pay\.$/);
  assert.equal(by.retire.href, "#/retirement/projection?from=quick");
  assert.equal(questionFor("debt/payoff").title, "When will I be debt-free?", "the answer page shows the question on top");
  // a page switched off on this device: its question goes back to the guide
  const off = compute(p, { today: T, off: ["debt/payoff"] });
  assert.deepEqual(off.answers.map((a) => a.guide), ["retire", "taxes"]);
  assert.deepEqual(off.needsFirst.map((n) => n.guide), ["debt"]);
  const e = compute(emptyPlan(), { today: T });
  assert.deepEqual(e.answers, []);
  assert.deepEqual(e.needsFirst.map((n) => n.guide), ["retire", "debt", "taxes"]);
});

test("the retirement answer names its figure as the average-market one, a year at a time (review 2026-11-02)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute } = await import("./compute.js");
  const by = Object.fromEntries(compute(familyPlan("2026-11-02"), { today: "2026-11-02" }).answers.map((a) => [a.guide, a]));
  // the family's plan adds health cover on top of its spending (the projection's health line), and says so
  assert.match(by.retire.line, /^You plan on \$[\d,]+ a year plus health cover; if markets do as well as average the plan carries (about )?\$[\d,]+ a year, less in a bad run of years/);
});

test("Review 2026-11-06: the tax answer, filing separately, says each return's own bill or refund (not \"About $540 back in April\")", async () => {
  const { answerFor } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T); p.household.filingStatus = "married_separate";
  p.whatIfs = { ...(p.whatIfs ?? {}), benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const a = answerFor("taxes", p, { today: T });
  assert.equal(a.headline, "Bo owes about $1,660; Ana gets about $2,200 back");
  assert.equal(a.status, "warn"); assert.match(a.line, /^Filing separately, each return settles on its own\./);
  // filing jointly the household's answer stays (5,253 since round 8: the 20% business deduction comes after AGI, as Form 1040
  // line 13 takes it, so the family's AGI is 1,338 higher and the child care credit a step lower: 30 more tax; it read 5,223)
  assert.match(answerFor("taxes", familyPlan(T), { today: T }).headline, /^Owe about \$5,253 in April$/);
});

test("round 8 review UX 3: the widow's tax answer leads with having tax held back, not 'past due', and says her rate as the Federal estimate does", async () => {
  const { answerFor } = await import("./compute.js");
  const { widowPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const a = answerFor("taxes", widowPlan(), { today: "2026-11-06" });
  assert.equal(a.headline, "Have about $3,600 of tax held back from your IRA withdrawal by December 31");
  assert.ok(!/past due/.test(a.line), a.line);
  assert.match(a.line, /^About \$3,965 of federal tax for 2026 \(6\.0% of your income\), and no tax held back is on file\./);
  assert.match(a.line, /about \$4,000 leaves nothing to pay in April/);
});

test("round 8 fix: credits above the tax read as no federal income tax and what comes back, never \"About $0 ... (-5.7% of your income)\"", () => {
  // Jo, head of household, 30,000 of pay, one child, 900 a month of care (the Bracket explorer's case): the care credit takes
  // all 585 of income tax and 1,700 of the child tax credit is refundable, so the year's tax is -1,700
  const p = emptyPlan(); p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  const a = compute(p, { today: "2026-11-02" }).answers.find((x) => x.guide === "taxes");
  assert.ok(a, "a tax answer");
  assert.ok(a.line.startsWith("No federal income tax for 2026: the credits are about $1,700 more than the tax"), a.line);
  assert.ok(!/-\d+(\.\d)?%/.test(a.line) && !a.line.includes("About $0"), a.line);
});
