// tools/build.mjs -- produce ONE self-contained HTML file (shell + CSS + every module inlined) for opening from a
// phone's files, hosting anywhere, or sending to someone. It still talks to a PC server if one is configured in
// its Settings page. Needs esbuild once:  npm install --save-dev esbuild
//
//   node tools/build.mjs                                  -> dist/planner.html
//   node tools/build.mjs --demo <plan.json> --out <file>  -> a single file that opens on a pretend household
//
// --demo <plan>: <plan> is a plan file (.json), or a .mjs whose default export (or `demoHousehold`) makes one for a date.
// The file opens in the everyday view on that household when the browser has no plan of its own yet (core/store.js
// startingPlan), and every change after that stays in that browser. In a frame where the browser keeps nothing
// (sandbox="allow-scripts"), the plan lives in memory for the visit. It does not call itself anything but the app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Read `--name value` pairs; returns { demo, out }. */
export function parseArgs(argv) {
  const o = { demo: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--demo") o.demo = argv[++i] ?? "";
    else if (argv[i] === "--out") o.out = argv[++i] ?? "";
    else throw new Error(`unknown option ${argv[i]}. Use: node tools/build.mjs [--demo <plan.json> --out <file>]`);
  }
  if (o.demo === "" || (argv.includes("--demo") && !o.demo)) throw new Error("--demo needs a plan file");
  if (argv.includes("--out") && !o.out) throw new Error("--out needs a file name");
  return o;
}

/** The script that hands the starting plan to core/store.js; "<" is escaped so nothing inside can end the script. */
export function startScript(plan) {
  const json = JSON.stringify(plan).replace(/</g, "\\u003c").replace(new RegExp("[\\u2028\\u2029]", "g"), (c) => "\\u" + c.charCodeAt(0).toString(16));
  return `<script>globalThis.__PLANNER_START__ = ${json};</script>`;
}

async function loadPlan(file) {
  const abs = path.resolve(file);
  if (/\.mjs$/i.test(abs)) {
    const mod = await import(pathToFileURL(abs).href);
    const make = mod.default ?? mod.demoHousehold;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return typeof make === "function" ? make(today) : make;
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export async function build({ demo = null, out = null } = {}) {
  let esbuild;
  try { esbuild = await import("esbuild"); }
  catch { throw new Error("esbuild is not installed. Run:  npm install --save-dev esbuild   (one time), then npm run build"); }
  const result = await esbuild.build({ entryPoints: [path.join(ROOT, "core/app.js")], bundle: true, format: "iife", minify: false, write: false, target: ["es2022"], logLevel: "warning" });
  const js = result.outputFiles[0].text;
  const css = fs.readFileSync(path.join(ROOT, "core/ui/base.css"), "utf8");
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const start = demo ? startScript(await loadPlan(demo)) : "";
  html = html.replace(/<link rel="stylesheet" href="\.\/core\/ui\/base\.css">/, () => `<style>\n${css}\n</style>`)
             .replace(/<script type="module" src="\.\/core\/app\.js"><\/script>/, () => `${start}\n<script>\n${js.replace(/<\/script>/g, "<\\/script>")}\n</script>`);
  if (demo) {   // one file: the icons are inlined and the install manifest (a separate file) is left out
    const icon = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, "icon-180.png")).toString("base64")}`;
    html = html.replace(/<link rel="manifest"[^>]*>\n?/, "").replace(/(<link rel="(?:icon|apple-touch-icon)" href=")\.\/icon-180\.png(")/g, (_, a, b) => `${a}${icon}${b}`);
  }
  const target = out ? path.resolve(out) : path.join(ROOT, "dist", "planner.html");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, "utf8");
  return { target, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { target, bytes } = await build(parseArgs(process.argv.slice(2)));
    console.log(`built ${path.relative(process.cwd(), target) || target} (${(bytes / 1024).toFixed(0)} KB)`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
