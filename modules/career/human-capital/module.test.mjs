import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, presentValue, RISK } from "./compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeRetirement } from "../../retirement/projection/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("presentValue: level pay at no growth and no discount is pay × years; discounting and growth by hand", () => {
  near(presentValue(1000, 10, 0, 0), 10000);
  near(presentValue(1000, 2, 0, 0.1), 1000 / 1.1 + 1000 / 1.21);
  near(presentValue(1000, 2, 0.05, 0.05), 2000);
  assert.equal(presentValue(1000, 0, 0.02, 0.05), 0);
});

test("no earners: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: each earner's pay to retirement, an average job at the bond return plus two points", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const ana = d.people.find((x) => x.name === "Ana"), bo = d.people.find((x) => x.name === "Bo");
  assert.equal(ana.years, 65 - 36); assert.equal(bo.years, 62 - 38);
  assert.equal(ana.risk, "average"); near(ana.rate, Number(p.assumptions.returnBonds ?? 0.04) + RISK.average.add, 1e-12);
  const infl = Number(p.assumptions.inflation ?? 0.03), g = (1 + Number(p.assumptions.salaryGrowth ?? 0.03)) / (1 + infl) - 1;
  near(ana.value, presentValue(ana.pay, 29, g, (1 + ana.rate) / (1 + infl) - 1));
  assert.equal(bo.pay, 62400 + 7200, "the photography business counts as Bo's pay");
  near(d.total, ana.value + bo.value);
  const s = computeNext(p, { today: TODAY }).spare;
  near(d.takeHome, 1 - (s.federalTax + s.payrollTax) / s.gross, 1e-9); near(d.totalAfterTax, d.total * d.takeHome);
  near(d.share, d.total / (d.total + d.financial));
});

test("a steadier job is worth more today; a volatile one less", () => {
  const steady = familyPlan(TODAY); steady.whatIfs = { humanCapital: { "p-ana": "steady" } };
  const volatile = familyPlan(TODAY); volatile.whatIfs = { humanCapital: { "p-ana": "volatile" } };
  const v = (p) => compute(p, { today: TODAY }).people.find((x) => x.name === "Ana").value;
  assert.ok(v(steady) > v(familyPlan(TODAY))); assert.ok(v(volatile) < v(familyPlan(TODAY)));
});

test("the path: pay still to come falls to nothing by the last retirement; savings follow the projection; they cross", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.equal(d.path[0].year, 2026); near(d.path[0].human, d.total); near(d.path[0].financial, d.financial);
  assert.equal(d.path[d.path.length - 1].human, 0);
  for (let i = 1; i < d.path.length; i++) assert.ok(d.path[i].human <= d.path[i - 1].human + 1e-6);
  const rows = computeRetirement(p, { today: TODAY }).rows;
  near(d.path[5].financial, rows.find((r) => r.year === 2030).totalReal);
  assert.ok(d.crossYear > 2026); const c = d.path.find((x) => x.year === d.crossYear); assert.ok(c.financial >= c.human);
});

test("life cover against each earner's after-tax pay; the raise worth having", () => {
  const p = familyPlan(TODAY);
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 800000 }] };
  const d = compute(p, { today: TODAY });
  const ana = d.people.find((x) => x.name === "Ana");
  assert.equal(ana.cover, 800000); near(ana.coverShare, 800000 / ana.afterTax);
  assert.equal(d.people.find((x) => x.name === "Bo").cover, 0);
  assert.ok(d.raiseGain > 0);
});

// hb1 (whole-app phone smoke, 2026-11-17): the "How steady is each job?" fold's status read "average, average" (the stored keys).
test("hb1: the steadiness status in plain words, one sentence per case", async () => {
  const { steadinessWords } = await import("./compute.js");
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const P = (name, risk) => ({ name, risk });
  assert.equal(steadinessWords([]), "");
  assert.equal(steadinessWords([P("Ana", "average")]), "average");
  assert.equal(steadinessWords([P("Ana", "average"), P("Bo", "average")]), "both average");
  assert.equal(steadinessWords([P("Ana", "steady"), P("Bo", "steady"), P("Cy", "steady")]), "all steady");
  assert.equal(steadinessWords([P("Ana", "steady"), P("Bo", "average")]), "Ana: steady, Bo: average");
  assert.equal(steadinessWords([P("Me", "volatile"), P("Bo", "average")]), "You: uneven, Bo: average");
  assert.equal(steadinessWords([P("Ana", "volatile"), P("Bo", "volatile")]), "both uneven");
  assert.equal(steadinessWords([P("Ana", "nonsense")]), "average", "an unknown choice reads as compute() counts it");
  // the family (Ana and Bo, nothing chosen yet): both average, as the page now says
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.deepEqual(d.people.map((p) => p.risk), ["average", "average"]);
  assert.equal(steadinessWords(d.people), "both average");
  // a choice saved for Bo shows by name
  const p = familyPlan(TODAY); const bo = d.people.find((x) => x.name === "Bo");
  p.whatIfs = { ...(p.whatIfs ?? {}), humanCapital: { [bo.id]: "volatile" } };
  assert.equal(steadinessWords(compute(p, { today: TODAY }).people), "Ana: average, Bo: uneven");
  const view = fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8");
  assert.ok(view.includes('ui.h("span", { class: "fold-status" }, steadinessWords(d.people))'), "the view draws it");
  assert.ok(!view.includes('d.people.map((p) => p.risk).join(", ")'), "never the stored keys");
});

// hb1 fix M1: a couple whose second adult has no name read "You: average, You: steady"
test("hb1 fix: only one person is 'You'; a later unnamed adult is 'Person N'; a partner is 'Your spouse'", async () => {
  const { steadinessWords } = await import("./compute.js");
  const P = (name, risk) => ({ name, risk });
  assert.equal(steadinessWords([{ risk: "average" }, { risk: "steady" }]), "You: average, Person 2: steady");
  assert.equal(steadinessWords([P("Me", "steady"), P("", "average")]), "You: steady, Person 2: average");
  assert.equal(steadinessWords([P("Me", "steady"), P("Me", "average"), P("  ", "volatile")]), "You: steady, Person 2: average, Person 3: uneven");
  assert.equal(steadinessWords([P("Ana", "steady"), P("Me", "average")]), "Ana: steady, You: average", "the unnamed one is you wherever it stands");
  assert.equal(steadinessWords([P("Me", "steady"), P("My spouse", "volatile")]), "You: steady, Your spouse: uneven", "as the page's sentences say it");
  assert.equal(steadinessWords([P("Ana", "steady"), P("Bo", "average")]), "Ana: steady, Bo: average", "typed names as before");
  // never two "You"
  for (const names of [["", ""], ["Me", "Me"], [undefined, null], ["you", "Me", ""]]) {
    const line = steadinessWords(names.map((n, i) => P(n, i ? "steady" : "average")));
    assert.equal((line.match(/\bYou\b/g) ?? []).length, 1, line);
  }
});

// hb1 fix F3: the shut row's status said "uneven" while the choice inside read "Volatile (commission, a start-up, ...)"
test("hb1 fix: the status, the choices and the page's sentences use the same word for each kind of job", async () => {
  const { RISK, STEADY_WORDS, steadinessWords } = await import("./compute.js");
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  assert.deepEqual(Object.keys(STEADY_WORDS), Object.keys(RISK));
  for (const [k, r] of Object.entries(RISK)) {
    const w = STEADY_WORDS[k];
    assert.ok(r.label.startsWith(w.charAt(0).toUpperCase() + w.slice(1)), `${k}: "${r.label}" starts with the status word "${w}"`);
    assert.equal(steadinessWords([{ name: "Ana", risk: k }]), w);
  }
  assert.equal(RISK.volatile.label, "Uneven (commission, a start-up, your own business)");
  const view = fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8");
  assert.ok(view.includes('volatile: "an uneven" }[p.risk]'), "each earner's line: an uneven job");
  assert.ok(view.includes('"Uneven pay behaves like a stock:'), "What it means: uneven pay");
  // "volatile" is left only as the stored key the code reads, never in words on screen
  assert.ok(!/volatile/i.test(view.replace('volatile: "an uneven" }[p.risk]', "").replace('p.risk !== "volatile"', "")), "no other word for it on screen");
  // the choice saved is still the stored key, and still counts as before
  const p = familyPlan(TODAY); const d0 = compute(p, { today: TODAY }); const bo = d0.people.find((x) => x.name === "Bo");
  p.whatIfs = { humanCapital: { [bo.id]: "volatile" } };
  const d1 = compute(p, { today: TODAY });
  assert.equal(d1.people.find((x) => x.id === bo.id).risk, "volatile");
  assert.ok(d1.people.find((x) => x.id === bo.id).value < bo.value);
});
