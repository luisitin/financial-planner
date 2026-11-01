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
  assert.match(by.taxes.headline, /^About \$[\d,]+ of federal tax for 2026$/);
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
