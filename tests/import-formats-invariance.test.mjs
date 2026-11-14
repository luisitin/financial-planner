// tests/import-formats-invariance.test.mjs -- another app's file (gap #33, YNAB, Monarch, Mint) changes nothing for anyone
// who does not bring one in. Its three optional fields (importProfiles[].accounts, importProfiles[].categories,
// imports[].categories) are read by the Import page alone: for every qa/fixtures/*-plan.mjs plan, the 14 households' base
// plans, the five phone-built ones and the empty plan, migrate adds none, and every module's compute gives the same output
// with them as without them. And every bank file the qa folder holds (none is one of the three apps') reads exactly as it did:
// prepareImport with the formats step and without it ({ formats: false }, the old way) give the same result on every
// account of every plan (pattern of tests/leftover-invariance.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { prepareImport, readFormat, parseBankCsv, importRecord } from "../modules/transactions/import/compute.js";

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
async function modules() {
  const mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      if (m.isDirectory() && fs.existsSync(f)) mods.push([`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  return mods;
}
// System > Diagnostics and Settings measure the saved plan's size: any field added changes it, by design
const SIZE_ONLY = new Set(["system/diagnostics", "system/settings"]);
const out = (compute, plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T })); } catch (e) { return `throws ${e.message}`; } };
// Import's own compute lists the import records as they are (Past imports): the record's new field is in that list by being
// on the record, and nothing else there changes
const bare = (json) => json.replace(/,"categories":\["coffee-shops"\]/g, "");
const APP_FILES = ["ynab-register.csv", "monarch-transactions.csv", "mint-transactions.csv"];
const BANK_FILES = fs.readdirSync(path.join(ROOT, "qa", "fixtures")).filter((f) => f.endsWith(".csv") && !APP_FILES.includes(f)).sort();

test(`migrate adds none of the three fields, and no plan has one today: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) for (const p of [plan, migrate(structuredClone(plan))]) {
    for (const prof of Object.values(p.importProfiles ?? {})) { assert.equal(prof.accounts, undefined, name); assert.equal(prof.categories, undefined, name); }
    for (const im of p.imports ?? []) assert.equal(im.categories, undefined, name);
  }
});

test("every module's compute is the same with an app file's layout and import record as with a bank file's", async () => {
  const mods = await modules();
  assert.ok(mods.length >= 150, `${mods.length} modules`);
  let compared = 0;
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    const acct = a.accounts?.[0]?.id ?? "none";
    a.importProfiles = { ...(a.importProfiles ?? {}), "account|date|payee|outflow|inflow": { accountId: acct, mapping: { date: 1, payee: 2, amount: null, debit: 3, credit: 4, type: null, dateOrder: "MDY" }, flipSign: false } };
    a.imports = [...(a.imports ?? []), { id: "inv-im", at: `${T}T10:00:00Z`, accountId: acct, fileName: "register.csv", rows: 0, added: 0, skipped: 0, bad: 0 }];
    const b = structuredClone(a);
    Object.assign(b.importProfiles["account|date|payee|outflow|inflow"], { accounts: { k1: acct }, categories: { "coffee shop": "dining", electric: "" } });
    b.imports[b.imports.length - 1].categories = ["coffee-shops"];
    for (const [key, compute] of mods) { if (SIZE_ONLY.has(key)) continue; assert.equal(key === "transactions/import" ? bare(out(compute, b)) : out(compute, b), out(compute, a), `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 150 * 30, `${compared} comparisons`);
});

test(`every bank file the qa folder holds reads as before on every account of every plan: ${BANK_FILES.length} files`, () => {
  assert.ok(BANK_FILES.length >= 9, BANK_FILES.join(", "));
  let compared = 0;
  for (const f of BANK_FILES) {
    const text = fs.readFileSync(path.join(ROOT, "qa", "fixtures", f), "utf8");
    assert.equal(readFormat(parseBankCsv(text)), null, `${f} is no app's file`);
    for (const { name, plan } of ALL) for (const acc of (plan.accounts ?? []).slice(0, 4)) {
      const opts = { accountId: acc.id, importId: "x" };
      const now = prepareImport(structuredClone(plan), text, opts), old = prepareImport(structuredClone(plan), text, { ...opts, formats: false });
      assert.deepEqual(now, old, `${f} on ${name}:${acc.id}`);
      assert.deepEqual(importRecord(now, { id: "i", at: "t", accountId: acc.id, fileName: f }), importRecord(old, { id: "i", at: "t", accountId: acc.id, fileName: f }));
      compared++;
    }
  }
  assert.ok(compared >= 500, `${compared} comparisons`);
});
