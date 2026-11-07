// tests/static-host.test.mjs -- the app works the same from a static host (GitHub Pages, phone only) as from the PC's
// server (docs/PLAN.md "On a static host (GitHub Pages)"). What differs there, checked without a browser:
// - Pages is Linux (case-sensitive) under a subpath, the owner edits on Windows: every relative address the app loads
//   must name a file that exists with exactly that case, and none may start at the domain root ("/core/...").
// - The whole app is loaded once, at boot (modules/registry.js lists every page): the only import() is the registry's.
//   A page loaded later (an import() on navigation) would come new from the site next to the old files already running
//   in an open tab after a deploy, and no service worker can prevent that.
// - .nojekyll keeps Jekyll from dropping or rewriting files.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Every file under `dir` (relative to the repo, "/" separators) whose name passes `keep`. */
function walk(dir, keep, out = []) {
  for (const e of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, keep, out);
    else if (keep(e.name)) out.push(rel);
  }
  return out;
}
/** Does `rel` exist with exactly this case, segment by segment (Windows and macOS would say yes to any case)? */
function existsExactly(rel) {
  let at = REPO;
  for (const seg of rel.split("/")) {
    let names;
    try { names = fs.readdirSync(at); } catch { return false; }
    if (!names.includes(seg)) return false;
    at = path.join(at, seg);
  }
  return true;
}
/** The code without its comments (// to the end of a line, whole-line * lines, /* ... *\/ blocks), so prose is not read. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).map((l) => l.replace(/(^|\s)\/\/\s.*$/, "")).join("\n");

const JS = walk("core", (n) => /\.m?js$/.test(n)).concat(walk("modules", (n) => /\.js$/.test(n)), ["sw.js"]);
const CSS = walk("core", (n) => n.endsWith(".css")).concat(walk("modules", (n) => n.endsWith(".css")));

/** The relative addresses one file loads: [{ spec, line }]. */
function addresses(rel) {
  const src = code(fs.readFileSync(path.join(REPO, rel), "utf8"));
  const found = [];
  const add = (re) => { for (const m of src.matchAll(re)) found.push(m[1]); };
  if (/\.m?js$/.test(rel)) {
    add(/\bfrom\s*["']([^"']+)["']/g);                 // import ... from "x", export ... from "x"
    add(/^\s*import\s*["']([^"']+)["']/gm);             // import "x"
    add(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g);      // import("x")
  } else if (rel.endsWith(".css")) {
    add(/url\(\s*["']?([^"')]+)["']?\s*\)/g);
    add(/@import\s+["']([^"']+)["']/g);
  } else {
    add(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g);
  }
  return found;
}

test("every relative address the app loads names a file that exists with exactly that case (Pages is case-sensitive)", () => {
  const missing = [];
  let checked = 0;
  for (const rel of [...JS, ...CSS, "index.html"]) {
    for (const spec of addresses(rel)) {
      if (!/^\.\.?\//.test(spec)) continue;   // other sites, data: addresses, #anchors: not files of the app
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec.replace(/[?#].*$/, "")));
      checked++;
      if (target.startsWith("..") || !existsExactly(target)) missing.push(`${rel}: "${spec}" -> ${target}`);
    }
  }
  assert.ok(checked > 1000, `the whole app was read (${checked} addresses)`);
  assert.deepEqual(missing, [], "each of these 404s on GitHub Pages (or loads only on a case-blind disk)");
});

test("nothing the app loads starts at the domain root: the site lives under /financial-planner/", () => {
  const rooted = [];
  for (const rel of [...JS, ...CSS, "index.html"]) {
    for (const spec of addresses(rel)) if (/^\/(?!\/)/.test(spec)) rooted.push(`${rel}: "${spec}"`);
  }
  assert.deepEqual(rooted, [], "an address starting with / reaches someone.github.io/... instead of the app");
  const index = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  assert.match(index, /<script type="module" src="\.\/core\/app\.js"><\/script>/);
  assert.match(index, /register\("\.\/sw\.js", \{ scope: "\.\/" \}\)/, "the worker by a relative address, scoped to the app's folder");
});

test("the whole app loads at boot: the only import() is the registry's list of pages, each a fixed address", () => {
  const lazy = [];
  for (const rel of JS) {
    if (rel === "modules/registry.js") continue;
    const src = code(fs.readFileSync(path.join(REPO, rel), "utf8"));
    if (/\bimport\s*\(/.test(src)) lazy.push(rel);
  }
  assert.deepEqual(lazy, [], "a file loaded later (after a deploy) would run new next to the old files of an open tab");
  const registry = fs.readFileSync(path.join(REPO, "modules", "registry.js"), "utf8");
  const calls = [...registry.matchAll(/import\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(calls.length > 100);
  assert.ok(calls.every((c) => /^"\.\/[a-z0-9-]+\/[a-z0-9-]+\/module\.js"$/.test(c)), "fixed addresses only");
});

test(".nojekyll is at the root, so GitHub Pages serves every file as it is", () => {
  assert.ok(fs.existsSync(path.join(REPO, ".nojekyll")));
  assert.equal(fs.readFileSync(path.join(REPO, ".nojekyll"), "utf8"), "");
});
