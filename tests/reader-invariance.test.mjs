// tests/reader-invariance.test.mjs -- the Document reader reads a W-2, a 1099 and last year's return (gap design #23) and
// nothing else it did moves. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones and
// the empty plan (pattern of tests/happenings-invariance.test.mjs), the reader's compute() for the papers it read before
// (pay stubs, statements, Social Security statements, an advisor's plan, nothing, and text it cannot place), with each kind
// picked and each adult named, gives the very output it gave before the new kinds: byte for byte, checked by a digest per
// plan written down from the code before the change (commit 2631836). The guess of the kind from the words is the same for
// every one of those papers, and a plan with no W-2, 1099 or return read is never touched.
//
// To write the digests down again after a deliberate change to what those papers give: PRINT=1 node --test tests/reader-invariance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { compute, detectKind } from "../modules/ai/reader/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-14";
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();

// the papers the reader read before (invented, as in modules/ai/reader/module.test.mjs)
const stub = (lines) => ["ACME FREIGHT CO", "Pay Date: 11/06/2026", "Pay Period: 10/19/2026 - 11/01/2026", "  Current  YTD", ...lines].join("\n");
export const PAPERS = [
  "",
  "hello there",
  "EARNINGS STATEMENT\nPay Date: 10/24/2026\nPay Period: 10/04/2026 - 10/17/2026\n  Current  YTD\nGross Pay 4,050.00 81,000.00\nFederal Income Tax 412.18 8,243.60\n401(k) 486.00 9,720.00\nNet Pay 2,842.00 56,840.00",
  stub(["Gross Pay 2,769.23 55,384.60", "Federal Income Tax 201.11 4,022.20", "401(k) Pre-Tax 4.00% 110.77 2,215.40", "Roth 401(k) 2.00% 55.38 1,107.60", "401K Loan 75.00 1,500.00",
    "Employer Contributions", "401(k) ER Match 110.77 2,215.40", "Net Pay 1,890.12 37,802.40", "Direct deposit to account XXXX6789"]),
  "Pay Date: 11/06/2026\nPay Period: 10/19/2026 - 11/01/2026\nGross Pay 2,769.23\nROTH 401K 166.15 3,323.00\nCompany Match 110.77\nNet Pay 1,890.12",
  "RIVERBEND HOSPITAL\nEarnings Statement   Semi-Monthly\nPay Date 11/15/2026\nGross Pay 3,250.00 68,250.00\nFederal Income Tax 262.50 5,512.50\n401(k) Pre-Tax 6% 195.00 4,095.00\nDental Pre-Tax 18.00 378.00\nNet Pay 2,520.88 52,938.48\nEmployer 401(k) Match 97.50 2,047.50",
  stub(["Gross Pay 2,692.31 59,230.82", "Federal Income Tax 198.00 4,356.00", "401(k) 4.00% 107.69 2,369.18", "401(k) Catch-Up 166.15 3,655.30", "Employer Contributions", "401(k) ER Match 107.69 2,369.18", "Net Pay 1,950.00 42,900.00"]),
  stub(["Gross Pay 3,000.00 66,000.00", "Federal Income Tax 240.00 5,280.00", "401(k) 0.00 1,200.00", "Net Pay 2,300.00 50,600.00"]),
  "Gross pay 1,000.00\nNet pay 800.00",
  "Statement Period: 09/01/2026 to 09/30/2026\nAccount Number: XXXX1234\nBeginning Balance $10,950.11\nEnding Balance $11,812.40",
  "Your Social Security Statement\nAt age 62 your payment would be about $1,840 a month\nAt your full retirement age (67) $2,710 a month\nAt age 70 $3,360 a month",
  "Key assumptions\nEquity return: 8.0% per year\nFixed income return 4.5%\nInflation: 2.5%\nAdvisory fee 1.00% of assets\nRetirement age 62\nRetirement spending $90,000 per year\nProbability of success: 91%",
  // words a W-2, a 1099 or a return also hold, on papers that are none of them: the old kinds still read them
  "Pay Date: 11/06/2026\nGross Pay 2,000.00\nSocial Security 124.00\nMedicare 29.00\nFederal taxable wages 1,900.00\nNet Pay 1,600.00",
  "Brokerage statement\nStatement Period: 10/01/2026 to 10/31/2026\nDividends 120.00\nInterest 4.10\nEnding Balance $18,200.00",
];
const KINDS = [undefined, "paystub", "statement", "ssa", "advisor"];
function outputsFor(plan) {
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => p.id);
  const account = plan.accounts?.[0]?.id;
  const out = [];
  for (const text of PAPERS) for (const kind of KINDS) for (const personId of [undefined, ...people]) {
    const params = { text, kind, personId, accountId: kind === "statement" ? account : undefined, today: T };
    let r; try { r = compute(structuredClone(plan), params); } catch (e) { r = `throws ${e.message}`; }
    out.push(r);
  }
  return JSON.stringify(out);
}
// sha-256 in base64url, cut to 22 characters: enough to tell outputs apart, and no long run of digits in this file
const digest = (s) => crypto.createHash("sha256").update(s).digest("base64url").slice(0, 22);

// written down from the code before gap design #23 (commit 2631836)
const BEFORE = process.env.PRINT ? null : JSON.parse(fs.readFileSync(new URL("./reader-invariance.json", import.meta.url), "utf8"));

test(`the kind guessed from the words of every paper read before is the same: ${PAPERS.length} papers`, () => {
  const kinds = PAPERS.map((t) => detectKind(t));
  if (process.env.PRINT) { console.log(JSON.stringify(kinds)); return; }
  assert.deepEqual(kinds, BEFORE.kinds);
});

test(`what the reader gives for those papers is byte for byte what it gave before, over ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  const now = Object.fromEntries(ALL.map(({ name, plan }) => [name, digest(outputsFor(plan))]));
  if (process.env.PRINT) { console.log(JSON.stringify({ kinds: PAPERS.map((t) => detectKind(t)), plans: now }, null, 1)); return; }
  for (const { name } of ALL) assert.equal(now[name], BEFORE.plans[name], `${name}: the reader's output for the papers it read before moved`);
  assert.deepEqual(Object.keys(BEFORE.plans).sort(), Object.keys(now).sort(), "the same plans");
});

test("reading those papers changes no plan: compute() leaves the plan it is given as it was", () => {
  for (const { name, plan } of ALL) {
    const before = JSON.stringify(plan);
    for (const text of PAPERS) compute(plan, { text, today: T });
    assert.equal(JSON.stringify(plan), before, name);
  }
});
