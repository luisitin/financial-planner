// tests/one-answer-invariance.test.mjs -- one retirement answer on every overview page (z1, 2026-11-16) changes nothing it was
// not meant to. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones, the round 8
// households, the four Get started personas, the demo and the empty plan, with nothing new typed, each touched compute()'s whole
// output is checked against a digest written down from the code before the change (commit e223a42). What may move:
//   - a plan whose only retirement gap is Social Security and whose money lasts without it (overview/setup lastsWithoutSs): the
//     retirement answer on Get started's standing(), Your plan, Quick answers, the Timeline, Health score and the path's "Your
//     retirement" step (on Step by step and on Start). Each of those outputs, with the parts that say the retirement answer
//     taken out (`STRIP` below, the same function on both sides), is byte for byte what it was; the Dashboard's row, Next best
//     action, Needs attention and the Dashboard's compute are what they were in full. tests/one-answer.test.mjs says what the
//     moved parts now say.
//   - the spending worked out from a typed left-over (overview/setup solveSpend), for a plan with an income-tax line filed on
//     Expenses: only its ceiling (`available`, and `over` where the ceiling decides it), now lower by exactly that line's part
//     the month's tax holds (cashflow/forecast taxesListedOf). Every other plan's answer is what it was, byte for byte.
//
// To write the digests down again (from the code before a deliberate change): PRINT=1 node --test tests/one-answer-invariance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { demoHousehold } from "../qa/fixtures/demo-household.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./one-answer-invariance.json", import.meta.url);
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `round8 ${name}`, plan: fn() });
  for (const n of ["sam", "jordan", "patLee", "ruth"]) out.push({ name: `persona ${n}`, plan: personas.finishSetup(n, personas[n](T), T) });
  out.push({ name: "demo", plan: demoHousehold(T) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out.map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
}

const ALL = await plans();
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: String(e.message) }; } };
const setup = await imp("modules/overview/setup/compute.js");
const dash = await imp("modules/overview/dashboard/compute.js");
const yourPlan = await imp("modules/overview/plan/compute.js");
const timeline = await imp("modules/overview/timeline/compute.js");
const alerts = await imp("modules/overview/alerts/compute.js");
const health = await imp("modules/overview/health-score/compute.js");
const quick = await imp("modules/overview/quick/compute.js");
const guide = await imp("modules/overview/guide/compute.js");
const start = await imp("modules/overview/start/compute.js");
const nextBest = await imp("modules/overview/next-best-action/compute.js");
// Plan health score's words of 452408a put back (ha2: one ask for a missing figure, the retirement part in plain words; a no-op on
// the score's output before that change): only those words moved, tests/health-score-words.mjs says which
const healthWords = await import("./health-score-words.mjs");

/** The left-overs typed into question 6 that the spending search is tried with (a month: none, a usual one, more than any pay). */
const LEFTS = [0, 750, 100000];

/** Every touched compute's whole output for one plan, each on a fresh copy. */
function figures(plan) {
  const p = () => structuredClone(plan);
  const st = run(() => setup.standing(p(), { today: T }));
  const out = {
    standing: st,
    dashboard: run(() => dash.compute(p(), { today: T })),
    dashboardRow: st?.threw ? st : run(() => dash.retireRow(st, { plan: p(), today: T })),
    plan: run(() => yourPlan.compute(p(), { today: T })),
    timeline: run(() => timeline.compute(p(), { today: T })),
    alerts: run(() => alerts.compute(p(), { today: T })),
    health: run(() => healthWords.healthBack(health.compute(p(), { today: T }), plan, T)),
    quick: run(() => quick.compute(p(), { today: T })),
    path: run(() => guide.pathSummary(p(), { today: T })),
    guide: run(() => guide.compute(p(), { today: T })),
    start: run(() => start.compute(p(), { today: T })),
    nextBest: run(() => nextBest.compute(p(), { today: T })),
  };
  // the spending worked out from a typed left-over (question 6, and Expenses' "what's left over" box), only where there is pay
  if ((plan.income ?? []).length) {
    const v = setup.spendAnswers(plan);
    for (const left of LEFTS) out[`solveSpend ${left}`] = run(() => { const r = setup.solveSpend(p(), v, { left }, { today: T }); const { spare, ...rest } = r; return { ...rest, spare: spare ? digest(spare) : spare }; });
  }
  return out;
}

// ---------------------------------------------------------------- what says the retirement answer, taken out on both sides
const RETIRE_EVENTS = new Set(["needs-ss", "lasts", "short", "unknown"]);
const omit = (o, keys) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !keys.includes(k)));
export const STRIP = {
  standing: (s) => ({ ...omit(s, ["retire", "retireSavingsUnknown", "retireGuessed", "retireGuessedWhat", "withoutSs", "tileWhy", "tileAt"]), tileWhy: omit(s?.tileWhy, ["retire"]) }),
  plan: (d) => ({ ...d, head: omit(d?.head, ["ready", "title", "lede", "inShort", "gaps", "firstGap"]), groups: (d?.groups ?? []).map((g) => ({ ...g, rows: g.rows.filter((r) => r.key !== "retire") })) }),
  timeline: (d) => {
    const keep = (e) => !RETIRE_EVENTS.has(e.id);
    const years = (d?.years ?? []).map((y) => ({ ...omit(y, ["gapBefore"]), events: y.events.filter(keep) })).filter((y) => y.events.length);
    return { ...d, events: (d?.events ?? []).filter(keep), years, headline: omit(d?.headline, ["lastsTo", "shortYear", "needsSS", "needs", "withoutSs"]) };
  },
  // (fix round, critic P4: "The plan knows enough" names the Social Security figure Protection asks for as the same one, "add Sam's
  // Social Security (as above)", for a plan the rule lifts; put back as the words it had, a no-op on the code before the change)
  health: (d) => {
    const knows = (x) => (x.id === "knows" && typeof x.fix === "string" ? { ...x, fix: x.fix.replace(/add (?:your|[^;:]+?'s) Social Security \(as above\)/, "add a Social Security figure for every adult") } : x);
    return { ...omit(d, ["score", "band"]), parts: (d?.parts ?? []).filter((x) => x.id !== "retirement" && x.id !== "protection").map(knows), gains: (d?.gains ?? []).filter((x) => x.id !== "retirement" && x.id !== "protection").map(knows) };
  },
  quick: (d) => ({ ...d, answers: (d?.answers ?? []).filter((x) => x.guide !== "retire"), needsFirst: (d?.needsFirst ?? []).filter((x) => x.guide !== "retire") }),
  path: (d) => ({ ...d, parts: (d?.parts ?? []).map((x) => (x.key === "retire" ? omit(x, ["waiting"]) : x)), gaps: (d?.gaps ?? []).filter((x) => x.key !== "retire") }),
  guide: (d) => ({ ...d, journeys: (d?.journeys ?? []).map((j) => (j.id === "plan" ? { ...j, steps: (j.steps ?? []).map((x) => (x.key === "retire" ? omit(x, ["waiting"]) : x)) } : j)) }),
  // Start shows the path's summary too (its steps, which of them wait)
  start: (d) => ({ ...d, path: d?.path ? STRIP.path(d.path) : d?.path }),
};
/** The pages whose retirement answer may move, for a plan whose answer stands without the Social Security not in yet. */
const MAY_MOVE = Object.keys(STRIP);
/** The search's ceiling, for a plan with an income-tax line filed on Expenses: `available` and the `over` it decides. */
const CEILING = ["available", "over", "why"];
const ceilingOf = (r) => (r && typeof r === "object" && "available" in r ? { available: r.available, over: r.over, why: r.why } : null);

const ALL_FIGURES = new Map(ALL.map(({ name, plan }) => [name, figures(plan)]));

if (process.env.PRINT) {
  const json = { note: "digests of the touched computes before one retirement answer on every overview page (commit e223a42); tests/one-answer-invariance.test.mjs says how to write them again", today: T, plans: {} };
  for (const { name } of ALL) {
    const f = ALL_FIGURES.get(name);
    json.plans[name] = {
      full: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, digest(v)])),
      stripped: Object.fromEntries(MAY_MOVE.map((k) => [k, digest(STRIP[k](f[k]))])),
      ceilings: Object.fromEntries(LEFTS.filter((l) => f[`solveSpend ${l}`]).map((l) => [l, { ...ceilingOf(f[`solveSpend ${l}`]), rest: digest(omit(f[`solveSpend ${l}`], CEILING)) }])),
    };
  }
  fs.writeFileSync(FILE, JSON.stringify(json, null, 1) + "\n");
  test("digests written", () => {});
} else {
  const before = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const { taxesListedOf } = await imp("modules/cashflow/forecast/compute.js");
  const { compute: expenses } = await imp("modules/cashflow/expenses/compute.js");

  test("the plans are the ones the digests were written for", () => {
    assert.deepEqual(ALL.map((x) => x.name), Object.keys(before.plans));
    assert.ok(ALL.length >= 45, `${ALL.length} plans`);
  });

  const lifted = [], ceilings = [];
  for (const { name, plan } of ALL) {
    test(`${name}: every touched compute is what it was, but for the answers it is meant for`, () => {
      const was = before.plans[name], now = ALL_FIGURES.get(name);
      const stands = !!setup.lastsWithoutSs(plan, { today: T });
      if (stands) lifted.push(name);
      // the income-tax line the month's tax holds, as Next best action leaves it out of spending (the one rule)
      const n = run(() => nextBest.compute(structuredClone(plan), { today: T }));
      const s = n?.ready ? n.spare : null;
      const listed = s ? taxesListedOf(expenses(structuredClone(plan), { today: T }).items, { tax: s.federalTax + s.payrollTax + s.stateTax, state: s.stateKnown ? s.stateTax : 0 }) : 0;
      assert.ok(Math.abs(listed - (Number(s?.taxesListed) || 0)) < 1e-9, `${name}: the search asks the same rule Next best action does`);
      for (const [k, v] of Object.entries(now)) {
        const full = digest(v);
        if (full === was.full[k]) continue;
        if (stands && MAY_MOVE.includes(k)) { assert.equal(digest(STRIP[k](v)), was.stripped[k], `${name}: ${k} moved outside its retirement answer`); continue; }
        if (k.startsWith("solveSpend ") && listed > 0.005) {
          const left = Number(k.slice(11)), c0 = was.ceilings[left], c1 = ceilingOf(v);
          // without the ceiling, the answer is what it was
          assert.equal(digest(omit(v, CEILING)), c0.rest, `${name} ${left}: moved outside its ceiling`);
          // the ceiling is lower by exactly the line the month's tax holds (whole dollars, as the search says it)
          assert.ok(Math.abs(c0.available - c1.available - listed) <= 1, `${name} ${left}: ${c0.available} - ${c1.available} = ${listed}`);
          ceilings.push(`${name} ${left}: ${c0.why} ${c0.available} -> ${c1.why} ${c1.available}`);
          continue;
        }
        assert.fail(`${name}: ${k} moved`);
      }
    });
  }
  test("the plans whose answer moved are the three whose money lasts without the Social Security not in yet, and no other", () => {
    assert.deepEqual(lifted.sort(), ["08-retired/base", "14-unusual-structures/base", "fixture retired-couple-plan.mjs:retiredCouplePlan"]);
  });
  test("the search's ceiling moved only where an income-tax line on Expenses is held by the month's tax, and lower by that line", () => {
    // Nadia (11-self-employed) files $1,400 a month of quarterly estimated tax; the month's tax holds $1,137.76 of it: a left-over of
    // $100,000 is more than comes in after tax and saving, about $5,896 a month (it said $7,033, Expenses' whole month)
    // ($750 is still refused for her bills, as before: only the ceiling it reports moved)
    assert.deepEqual(ceilings, ["11-self-employed/base 750: bills 7033 -> bills 5896", "11-self-employed/base 100000: more-than-pay 7033 -> more-than-pay 5896"]);
  });
}
