// tests/c11-invariance.test.mjs -- the smart guesses' last step (C11) changes no figure. Over every qa/fixtures/*-plan.mjs plan,
// the 14 households' base plans, the phone-built ones, the round 8 households and the empty plan (the pattern of
// tests/withdrawal-ways-invariance.test.mjs), every compute the step touches or reads (Federal estimate, Withholding check,
// Capital gains, Tax lots, What you save for retirement, the 50-30-20 split, Health insurance before Medicare, Medicare, Roth
// conversions, Inheritance and its inherited accounts) gives, byte for byte, what it gave before the change (commit ab3bdde):
//   - each plan as it is (nothing new typed: no C11 guess exists, so the gray figures are drawn and never counted);
//   - the same plan with every one of the 18 boxes typed (`typedAll`): a typed figure is the person's, so nothing moves either.
// A compute's new export (`estimators`) is not part of compute()'s output; a sales list holding a blank entry is not in any qa plan.
//
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/c11-invariance.test.mjs
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
import { compute as federal } from "../modules/taxes/federal/compute.js";
import { compute as withholding, withholdingEstimate } from "../modules/taxes/withholding/compute.js";
import { compute as capitalGains } from "../modules/taxes/capital-gains/compute.js";
import { compute as taxLots } from "../modules/investments/tax-lots/compute.js";
import { compute as contributions } from "../modules/retirement/contributions/compute.js";
import { compute as budgetPercent } from "../modules/cashflow/budget-percent/compute.js";
import { compute as healthcare } from "../modules/retirement/healthcare/compute.js";
import { compute as medicare } from "../modules/retirement/medicare/compute.js";
import { compute as roth } from "../modules/retirement/roth-conversions/compute.js";
import { compute as inheritance, emptying } from "../modules/estate/inheritance/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-15";
const FILE = new URL("./c11-invariance.json", import.meta.url);
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
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = (await plans()).map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };

/** Every one of the 18 C11 boxes typed, as a person would type them (the coverage rows' paths). */
export function typedAll(plan) {
  const p = structuredClone(plan);
  p.taxes = p.taxes ?? {};
  p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), otherOrdinary: 1200, qualifiedIncome: 800, taxExemptInterest: 300, adjustments: 250, withheld: 4000, withheldTyped: true };
  p.taxes.itemized = { ...(p.taxes.itemized ?? {}), mortgageInterest: 9000, propertyTax: 4000, stateTax: 2500, other: 150 };
  p.whatIfs = { ...(p.whatIfs ?? {}), budgetPercent: { preset: "own", needs: 0.55, wants: 0.25, savings: 0.2 } };
  p.retirement = p.retirement ?? {};
  p.retirement.aca = { ...(p.retirement.aca ?? {}), rules: "enhanced" };
  p.retirement.medicare = { ...(p.retirement.medicare ?? {}), supplementPremium: 150 };
  p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: true, fillRate: 0.12, untilAge: 70 };
  p.estate = p.estate ?? { documents: [], beneficiaries: [] };
  p.estate.inheritance = { ...(p.estate.inheritance ?? {}), items: [...(p.estate.inheritance?.items ?? []), { id: "c11-ih", from: "Family", amount: 100000, year: 2040, kind: "cash" }] };
  // a new row into a plan at work, with its match typed
  const k = (p.accounts ?? []).find((a) => a.type === "401k");
  if (k) p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "c11-row", accountId: k.id, personId: k.ownerId || "", amount: 200, period: "monthly", employerMatch: 1500 }];
  return p;
}

/** Every figure the step could reach, for one plan, by what it is. */
function figures(plan) {
  const p = () => structuredClone(plan);
  return {
    federal: run(() => federal(p(), { today: T })),
    withholding: run(() => withholding(p(), { today: T })),
    withholdingEstimate: run(() => withholdingEstimate(p(), { today: T })),
    capitalGains: run(() => capitalGains(p(), { today: T })),
    taxLots: run(() => taxLots(p(), { today: T })),
    contributions: run(() => contributions(p(), { today: T })),
    budgetPercent: run(() => budgetPercent(p(), { today: T })),
    healthcare: run(() => healthcare(p(), { today: T })),
    medicare: run(() => medicare(p(), { today: T })),
    roth: run(() => roth(p(), { today: T })),
    inheritance: run(() => inheritance(p(), { today: T })),
    emptying: run(() => emptying(p(), { today: T })),
  };
}

test(`the plans: ${ALL.length}; none holds a C11 guess, and migrate is settled`, () => {
  assert.ok(ALL.length >= 40, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    for (const k of Object.keys(plan.guesses ?? {})) assert.ok(!/^taxes\.|employerMatch$/.test(k) || !/^(taxes\/federal|retirement\/contributions):/.test(plan.guesses[k]?.k ?? ""), `${name}: ${k}`);
    assert.equal(JSON.stringify(migrate(structuredClone(plan))), JSON.stringify(plan), `${name}: migrate is settled`);
  }
});

test("as they are and with every C11 box typed, every figure is the one the code gave before (ab3bdde), byte for byte", () => {
  const now = {};
  for (const { name, plan } of ALL) {
    now[name] = Object.fromEntries(Object.entries(figures(plan)).map(([k, v]) => [k, digest(v)]));
    now[`${name} (typed)`] = Object.fromEntries(Object.entries(figures(typedAll(plan))).map(([k, v]) => [k, digest(v)]));
  }
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of the C11 pages' figures before the smart guesses' last step (commit ab3bdde), each plan as it is and with every C11 box typed; tests/c11-invariance.test.mjs says how to write them again", plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  for (const [name, d] of Object.entries(now)) for (const [k, v] of Object.entries(was[name])) assert.equal(d[k], v, `${name}: ${k}`);
});
