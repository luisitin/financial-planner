// tools/check.mjs -- the conventions, enforced. Run before committing (`npm run check`).
// It is deliberately strict so a future editor gets told exactly what is missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GROUP_IDS } from "../core/groups.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODS = path.join(ROOT, "modules");
const errors = [];
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
      if (/\b(document|window|localStorage|fetch)\b/.test(c)) errors.push(`${key}: compute.js must be pure (no document/window/localStorage/fetch)`);
      try { const m = await import(pathToFileURL(path.join(dir, "compute.js")).href); if (typeof m.compute !== "function") errors.push(`${key}: compute.js must export compute(plan, params)`); }
      catch (e) { errors.push(`${key}: compute.js failed to import in Node: ${e.message}`); }
    }
    if (catalog && !catalog.includes(`\`${key}\``)) errors.push(`${key}: not listed in docs/MODULE_CATALOG.md (add a row with its status)`);
  }
}
if (!fs.existsSync(path.join(MODS, "registry.js"))) errors.push("modules/registry.js missing: run `npm run registry`");
if (errors.length) { console.log("check: FAIL"); for (const e of errors) console.log("  " + e); process.exit(1); }
console.log("check: OK");
