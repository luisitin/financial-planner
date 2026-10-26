// Structural checks for every modules/<group>/<id>/: compute.js is pure and exports
// compute(), module.js declares the folder's id/group. The modules' own tests
// (module.test.mjs) are picked up directly by `npm test`'s glob.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GROUP_IDS } from "../core/groups.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODS = path.join(ROOT, "modules");
for (const group of fs.readdirSync(MODS, { withFileTypes: true })) {
  if (!group.isDirectory() || group.name.startsWith("_")) continue;
  for (const mod of fs.readdirSync(path.join(MODS, group.name), { withFileTypes: true })) {
    if (!mod.isDirectory() || mod.name.startsWith("_")) continue;
    const dir = path.join(MODS, group.name, mod.name);
    const key = `${group.name}/${mod.name}`;
    test(`${key}: structure`, async () => {
      assert.ok(GROUP_IDS.has(group.name), `unknown group ${group.name}`);
      for (const f of ["module.js", "compute.js", "view.js", "README.md"]) assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
      const manifest = fs.readFileSync(path.join(dir, "module.js"), "utf8");
      assert.ok(manifest.includes(`id: "${mod.name}"`) && manifest.includes(`group: "${group.name}"`), "module.js id/group must match the folder");
      const m = await import(pathToFileURL(path.join(dir, "compute.js")).href);
      assert.equal(typeof m.compute, "function", "compute.js must export compute()");
      const src = fs.readFileSync(path.join(dir, "compute.js"), "utf8");
      assert.doesNotMatch(src, /\b(document|window|localStorage|fetch)\b/, "compute.js must not touch the DOM or network");
    });
  }
}
