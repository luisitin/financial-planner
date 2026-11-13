// tests/match-roth.test.mjs -- L9 (spec rv/spec.md part C, D-C2; 2026-11-13): the employer's match on a Roth 401(k) row is
// pay-the-tax-later money, the tax law's default (IRC 402A: only what the employee designates is Roth; SECURE 2.0 section 604
// lets a plan offer the match as Roth, and then it is income the year it goes in, IRS Notice 2024-2 Q&A L-2). An optional
// `matchRoth: true` on the row says the plan pays it as Roth. Written before the change; each test failed first.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as P from "../modules/retirement/projection/compute.js";
import { compute as federal, taxInputs } from "../modules/taxes/federal/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";

const T = "2026-11-13";
/** The family plan with Bo's Roth row at work: $300 a month of his own money and an employer match of $1,800 a year. */
function rothAtWork(extra = {}) {
  const p = migrate(familyPlan(T));
  p.accounts.find((a) => a.id === "a-roth").name = "Bo's Roth 401(k)";
  Object.assign(p.retirement.contributions.find((c) => c.id === "c-bo"), { employerMatch: 1800, ...extra });
  return p;
}
const bo = (I) => I.contributions.filter((c) => c.personIndex === I.people.findIndex((x) => x.id === "p-bo"));

test("L9: a match on a Roth 401(k) row goes in as pay-the-tax-later money; the person's own money stays Roth", () => {
  const I = P.buildInputs(rothAtWork(), { today: T }).inputs;
  const rows = bo(I);
  // by hand: own money $300 x 12 = $3,600 a year, Roth (tax-free); the match $1,800 a year, pre-tax
  assert.deepEqual(rows.map((c) => [c.bucket, c.yearly]), [["free", 3600], ["deferred", 1800]]);
  // pre-tax 401(k) money has required withdrawals (only a Roth 401(k)'s own Roth money has none from 2024, SECURE 2.0 s. 325)
  assert.ok(!rows[1].rmdExempt, "the match counts toward Bo's required withdrawals");
  // the same stop (his last pay line, if dated) and the same person on both parts
  assert.equal(rows[0].untilYear, rows[1].untilYear);
  assert.equal(rows[0].name, rows[1].name);
});

test("L9: with matchRoth the plan pays the match as Roth, so the whole row is Roth, as before", () => {
  const rows = bo(P.buildInputs(rothAtWork({ matchRoth: true }), { today: T }).inputs);
  assert.deepEqual(rows.map((c) => [c.bucket, c.yearly]), [["free", 5400]]);
});

test("L9: matchRoth on a row with no match, or matchRoth false, changes nothing anywhere in the projection", () => {
  const base = migrate(familyPlan(T));
  const a = JSON.stringify(P.compute(base, { today: T }));
  const q = structuredClone(base); q.retirement.contributions.find((c) => c.id === "c-bo").matchRoth = true;   // c-bo has no match
  assert.equal(JSON.stringify(P.compute(q, { today: T })), a);
  const r = rothAtWork(), f = rothAtWork({ matchRoth: false });
  assert.equal(JSON.stringify(P.compute(f, { today: T })), JSON.stringify(P.compute(r, { today: T })));
  // an account that is not a plan at work (a brokerage row with a "match" typed) is never split
  const b = structuredClone(base); b.accounts.find((x) => x.id === "a-roth").type = "brokerage";
  Object.assign(b.retirement.contributions.find((c) => c.id === "c-bo"), { employerMatch: 600, matchRoth: true });
  assert.deepEqual(bo(P.buildInputs(b, { today: T }).inputs).map((c) => [c.bucket, c.yearly]), [["taxable", 4200]]);
});

// critic-law finding 5 (2026-11-13): the law ties a Roth match to the person's own choice for the match (IRC 402A(c)(1) as
// amended: "the employee designates"), not to their own money being Roth (Notice 2024-2 section L), so a pre-tax 401(k) row can
// carry `matchRoth` too: its own money stays pre-tax and the match goes in as Roth, income this year
test("L9: matchRoth on a pre-tax 401(k) row: the person's own money stays pre-tax, the match goes in as Roth and is income this year", () => {
  const plain = migrate(familyPlan(T)), roth = migrate(familyPlan(T));
  roth.retirement.contributions.find((c) => c.id === "c-ana").matchRoth = true;
  const ana = (p) => { const I = P.buildInputs(p, { today: T }).inputs; return I.contributions.filter((c) => c.personIndex === I.people.findIndex((x) => x.id === "p-ana")); };
  // by hand: $470 x 26 = $12,220 of her own money pre-tax; the $3,050 match Roth (tax-free, no required withdrawals)
  assert.deepEqual(ana(plain).map((c) => [c.bucket, c.yearly]), [["deferred", 15270]]);
  const rows = ana(roth);
  assert.deepEqual(rows.map((c) => [c.bucket, c.yearly]), [["deferred", 12220], ["free", 3050]]);
  assert.equal(rows[0].untilYear, rows[1].untilYear);
  // federal: income rises by the match, wages do not; by hand the family's taxable income is in the 22% band, so $671 more tax
  const a = taxInputs(plain, { today: T }), b = taxInputs(roth, { today: T });
  assert.equal(b.inputs.wages, a.inputs.wages);
  assert.equal(b.inputs.otherOrdinary - a.inputs.otherOrdinary, 3050);
  assert.equal(b.rothMatch, 3050);
  assert.equal(a.rothMatch, undefined, "no Roth match: no field, so every other plan's output is as it was");
  assert.equal(Math.round(federal(roth, { today: T }).result.totalTax - federal(plain, { today: T }).result.totalTax), 671);
});

test("L9: the money at retirement has more pay-the-tax-later money and less Roth, the total the same in average markets", () => {
  const later = P.compute(rothAtWork(), { today: T }), roth = P.compute(rothAtWork({ matchRoth: true }), { today: T });
  const at = (d) => d.rows.find((r) => r.year === d.inputs.retireYear - 1).balances;
  // nothing is spent or taxed before retirement, so the two runs put the same dollars in, only in other places
  const sum = (b) => b.cash + b.taxable + b.deferred + b.free;
  assert.ok(Math.abs(sum(at(later)) - sum(at(roth))) < 0.01);
  assert.ok(at(later).deferred > at(roth).deferred + 1000 && at(later).free < at(roth).free - 1000);
});

test("L9: federal tax: a Roth match is income this year (not wages: Form 1099-R); a match left as pay-the-tax-later is not", () => {
  const plain = taxInputs(rothAtWork(), { today: T }), roth = taxInputs(rothAtWork({ matchRoth: true }), { today: T });
  assert.equal(roth.inputs.wages, plain.inputs.wages, "not wages");
  assert.equal(roth.inputs.otherOrdinary - plain.inputs.otherOrdinary, 1800, "income rises by the match");
  const line = roth.sources.find((s) => s.key === "rothMatch");
  assert.ok(line && line.amount === 1800 && /Roth/.test(line.label), JSON.stringify(roth.sources.map((s) => s.key)));
  assert.equal(plain.sources.find((s) => s.key === "rothMatch"), undefined);
  // by hand: the family's taxable income is in the 22% band of 2026 (married filing jointly, $100,800 to $211,400), so
  // $1,800 more costs $396 of federal tax
  const t0 = federal(rothAtWork(), { today: T }).result.totalTax, t1 = federal(rothAtWork({ matchRoth: true }), { today: T }).result.totalTax;
  assert.equal(Math.round(t1 - t0), 396);
  // without matchRoth the federal figures are those of the plan with no match at all (a match is never income by default)
  const none = migrate(familyPlan(T)); none.accounts.find((a) => a.id === "a-roth").name = "Bo's Roth 401(k)";
  assert.equal(federal(rothAtWork(), { today: T }).result.totalTax, federal(none, { today: T }).result.totalTax);
});

test("L9: filing separately, a Roth match is on its owner's return", () => {
  const p = rothAtWork({ matchRoth: true }); p.household.filingStatus = "married_separate";
  const q = rothAtWork(); q.household.filingStatus = "married_separate";
  const a = taxInputs(p, { today: T }).separate, b = taxInputs(q, { today: T }).separate;
  const of = (s, id) => s.find((x) => x.personId === id).otherOrdinary;
  assert.equal(of(a, "p-bo") - of(b, "p-bo"), 1800);
  assert.equal(of(a, "p-ana"), of(b, "p-ana"));
  // the part says what of its income is a Roth match (not Income-page money), for pages that rebuild a return from the Income page
  assert.equal(a.find((x) => x.personId === "p-bo").fromIncome.rothMatch, 1800);
  assert.equal(a.find((x) => x.personId === "p-ana").fromIncome.rothMatch, undefined);
});

test("L9 touches no qa plan: none has a Roth row carrying a match, so every answer there stays as it was", async () => {
  const ROOT = fileURLToPath(new URL("..", import.meta.url));
  const plans = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs"))) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) { try { plans.push([name, fn()]); } catch { /* a builder that needs arguments */ } }
  }
  for (const a of ARCHETYPES) plans.push([a.id, a.build()]);
  for (const [name, fn] of Object.entries(phone)) plans.push([name, fn()]);
  assert.ok(plans.length >= 30, `${plans.length} plans`);
  for (const [name, plan] of plans) {
    const acct = new Map((plan.accounts ?? []).map((a) => [a.id, a]));
    assert.ok(!(plan.retirement?.contributions ?? []).some((c) => acct.get(c.accountId)?.type === "roth" && Number(c.employerMatch) > 0), name);
    assert.ok(!(plan.retirement?.contributions ?? []).some((c) => c.matchRoth !== undefined), `${name}: no row says matchRoth`);
  }
});
