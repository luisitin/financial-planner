// tools/check.mjs -- the conventions, enforced. Run before committing (`npm run check`).
// It is deliberately strict so a future editor gets told exactly what is missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GROUP_IDS } from "../core/groups.js";
import { mergeEstimators, checkEstimators } from "../core/estimate/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODS = path.join(ROOT, "modules");
const errors = [];
const PURE = /\b(document|window|localStorage|fetch)\b/;
const registries = [];             // every compute.js's `estimators` (docs/CONVENTIONS.md "Guesses")
const catalog = fs.existsSync(path.join(ROOT, "docs", "MODULE_CATALOG.md")) ? fs.readFileSync(path.join(ROOT, "docs", "MODULE_CATALOG.md"), "utf8") : "";

for (const group of fs.readdirSync(MODS, { withFileTypes: true })) {
  if (!group.isDirectory() || group.name.startsWith("_")) continue;
  if (!GROUP_IDS.has(group.name)) errors.push(`modules/${group.name}: unknown group (add it to core/groups.js)`);
  for (const mod of fs.readdirSync(path.join(MODS, group.name), { withFileTypes: true })) {
    if (!mod.isDirectory() || mod.name.startsWith("_")) continue;
    const key = `${group.name}/${mod.name}`, dir = path.join(MODS, group.name, mod.name);
    for (const f of ["module.js", "compute.js", "view.js", "README.md"]) if (!fs.existsSync(path.join(dir, f))) errors.push(`${key}: missing ${f}`);
    if (!fs.existsSync(path.join(dir, "module.js"))) continue;
    const src = fs.readFileSync(path.join(dir, "module.js"), "utf8");
    if (!src.includes(`id: "${mod.name}"`)) errors.push(`${key}: module.js must declare id: "${mod.name}"`);
    if (!src.includes(`group: "${group.name}"`)) errors.push(`${key}: module.js must declare group: "${group.name}"`);
    if (fs.existsSync(path.join(dir, "compute.js"))) {
      const c = fs.readFileSync(path.join(dir, "compute.js"), "utf8");
      if (PURE.test(c)) errors.push(`${key}: compute.js must be pure (no document/window/localStorage/fetch)`);
      try {
        const m = await import(pathToFileURL(path.join(dir, "compute.js")).href);
        if (typeof m.compute !== "function") errors.push(`${key}: compute.js must export compute(plan, params)`);
        if (m.estimators) {
          registries.push({ from: key, estimators: m.estimators });
          if (!/\bestimators\b/.test(src)) errors.push(`${key}: compute.js exports estimators; module.js must re-export them (export default { ..., estimators })`);
        }
      }
      catch (e) { errors.push(`${key}: compute.js failed to import in Node: ${e.message}`); }
    }
    // estimators may live in their own files: pure, like compute.js
    const estDir = path.join(dir, "estimators");
    if (fs.existsSync(estDir)) for (const f of fs.readdirSync(estDir).filter((x) => x.endsWith(".js"))) if (PURE.test(fs.readFileSync(path.join(estDir, f), "utf8"))) errors.push(`${key}: estimators/${f} must be pure (no document/window/localStorage/fetch)`);
    if (catalog && !catalog.includes(`\`${key}\``)) errors.push(`${key}: not listed in docs/MODULE_CATALOG.md (add a row with its status)`);
  }
}
if (!fs.existsSync(path.join(MODS, "registry.js"))) errors.push("modules/registry.js missing: run `npm run registry`");

// the guess plumbing and the shared math are pure too (they run in the browser, on the PC and in tests); the plumbing
// imports no module, so it may not load one late either (a dynamic import() would slip past the import-graph test)
for (const rel of ["core/estimate", "core/math"]) {
  const d = path.join(ROOT, rel);
  if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(d, f), "utf8");
    if (PURE.test(src)) errors.push(`${rel}/${f} must be pure (no document/window/localStorage/fetch)`);
    if ((rel === "core/estimate" || f === "estimate.js") && /\bimport\s*\(/.test(src)) errors.push(`${rel}/${f} must not use a dynamic import() (core/estimate imports no module)`);
  }
}
// the estimator registry: every module's estimators merged, as core/app.js merges them; no key twice; the contract holds
const merged = mergeEstimators(registries);
for (const p of merged.problems) errors.push(`guesses: ${p}`);
for (const p of checkEstimators(registries.map((r) => r.estimators))) errors.push(`guesses: ${p}`);
// coverage: every input a layperson may not know, and how a blank is handled (modules/overview/guesses/coverage.js)
let coverageLine = "";
const COV = path.join(MODS, "overview", "guesses", "coverage.js");
if (fs.existsSync(COV)) {
  try {
    const { COVERAGE, BUILT } = await import(pathToFileURL(COV).href);
    const HOW = /^(guess:\S+|compute:.+|fallback:.+|example|ask|other-builder|later:C(\d+))$/;
    let later = 0;
    COVERAGE.forEach((r, i) => {
      const where = `coverage row ${i + 1} (${r?.page} ${r?.label})`;
      if (!r || typeof r.page !== "string" || typeof r.path !== "string" || typeof r.label !== "string") { errors.push(`guesses: ${where}: needs page, path and label`); return; }
      const m = HOW.exec(r.how ?? "");
      if (!m) { errors.push(`guesses: ${where}: how "${r.how ?? ""}" is not one of guess:<key>, compute:..., fallback:..., example, ask, other-builder, later:C<n>`); return; }
      if (r.how.startsWith("guess:") && !merged.estimators[r.how.slice(6)]) errors.push(`guesses: ${where}: no module defines the estimator ${r.how.slice(6)}`);
      if (m[2]) { later++; if (Number(m[2]) <= Number(BUILT)) errors.push(`guesses: ${where}: still later:C${m[2]}, but C${BUILT} is built; say how it is handled now`); }
    });
    coverageLine = `guess coverage: ${COVERAGE.length - later} of ${COVERAGE.length} unknown inputs handled (${later} later)`;
  } catch (e) { errors.push(`guesses: coverage.js failed to import: ${e.message}`); }
}
if (coverageLine) console.log(coverageLine);
console.log(`guess estimators: ${Object.keys(merged.estimators).length} from ${registries.length} module(s)`);
if (errors.length) { console.log("check: FAIL"); for (const e of errors) console.log("  " + e); process.exit(1); }
console.log("check: OK");
