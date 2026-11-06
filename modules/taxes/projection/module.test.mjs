// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("projection: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// --- Review 2026-11-06 (fix round 6) --------------------------------------------------------------------------------------
test("Review 2026-11-06: no retirement year in the plan says why, here and on the Tax report (noYearsWhy)", async () => {
  const { noYearsWhy } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  for (const x of p.household.people.filter((y) => y.role !== "dependent")) { x.retirementAge = 70; x.lifeExpectancy = 60; }
  // the page draws a hero that says why, where it threw on d.rows[0].year ("This page failed to render")
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = new Proxy({ h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]) }, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => "2026-10-30" }, plan: p });
  assert.ok(root.textContent.includes(`There are no retirement years to tax: the plan runs to 60, and Ana and Bo retire at 70. Check the retirement age and "Plan to age" on the People page`), root.textContent);
  const ages = 'the retirement age and "Plan to age"';
  // the plan ends before retirement (H-0008: runs to 60, retires at 70; H-0191: runs to 95, both retire at 96)
  assert.deepEqual(noYearsWhy([{ name: "Maya", birthYear: 1997, retireAge: 70, endAge: 60 }], 2026), { why: "the plan runs to 60, and Maya retires at 70", check: ages });
  assert.deepEqual(noYearsWhy([{ name: "Priya", birthYear: 1992, retireAge: 96, endAge: 95 }, { name: "Tom", birthYear: 1989, retireAge: 96, endAge: 95 }], 2026), { why: "the plan runs to 95, and Priya and Tom retire at 96", check: ages });
  assert.deepEqual(noYearsWhy([{ name: "A", birthYear: 1980, retireAge: 70, endAge: 60 }, { name: "B", birthYear: 1981, retireAge: 72, endAge: 65 }], 2026), { why: "the plan ends before A and B retire", check: ages });
  // past the plan's end age (H-0090: born 1900): this year less the birth year against the end age
  assert.deepEqual(noYearsWhy([{ name: "Maya", birthYear: 1900, retireAge: 65, endAge: 95 }], 2026), { why: "Maya is 126, past the age the plan runs to (95)", check: "the birth date" });
  assert.deepEqual(noYearsWhy([{ name: "A", birthYear: 1900, retireAge: 65, endAge: 95 }, { name: "B", birthYear: 1901, retireAge: 65, endAge: 95 }], 2026), { why: "A and B are both past the age the plan runs to", check: "the birth dates" });
  assert.deepEqual(noYearsWhy([], 2026), { why: "the plan has no years after work stops", check: ages });
  // the compute: rows empty, peak null, the reason; a plan with retirement years has none
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.ready, true); assert.equal(d.rows.length, 0); assert.equal(d.peak, null);
  assert.equal(d.noYears.why, "the plan runs to 60, and Ana and Bo retire at 70");
  assert.equal(compute(familyPlan("2026-10-30"), { today: "2026-10-30" }).noYears, null);
  // one retirement year (born 1931, plan to 95): "1 year, 2026", not "1 years from 2026 to 2026", with no average and no
  // biggest year (verifier)
  const one = familyPlan("2026-10-30"); one.household.people = one.household.people.filter((y) => y.id !== "p-bo"); one.household.filingStatus = "single";
  Object.assign(one.household.people.find((y) => y.id === "p-ana"), { birthDate: "1931-12-20", retirementAge: 65, lifeExpectancy: 95 });
  assert.equal(compute(one, { today: "2026-10-30" }).rows.length, 1);
  // the hero is drawn first; the chart under it needs a real DOM (svg), which this stub does not have
  const r1 = node("root"); try { render(r1, { ui, fmt: { ...fmt, today: () => "2026-10-30" }, plan: one }); } catch { /* the chart */ }
  assert.ok(r1.textContent.includes("1 year, 2026, in today's dollars, filing single.") && !/1 years|a year on average|The biggest year/.test(r1.textContent), r1.textContent.slice(0, 400));
});
