// tools/build.mjs -- produce dist/planner.html: ONE self-contained file (shell +
// CSS + every module inlined) for opening from a phone's files, hosting anywhere,
// or sending to someone. It still talks to a PC server if one is configured in
// its Settings page. Needs esbuild once:  npm install --save-dev esbuild
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let esbuild;
try { esbuild = await import("esbuild"); }
catch { console.error("esbuild is not installed. Run:  npm install --save-dev esbuild   (one time), then npm run build"); process.exit(1); }

const result = await esbuild.build({ entryPoints: [path.join(ROOT, "core/app.js")], bundle: true, format: "iife", minify: false, write: false, target: ["es2022"], logLevel: "warning" });
const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(ROOT, "core/ui/base.css"), "utf8");
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
html = html.replace(/<link rel="stylesheet" href="\.\/core\/ui\/base\.css">/, `<style>\n${css}\n</style>`)
           .replace(/<script type="module" src="\.\/core\/app\.js"><\/script>/, `<script>\n${js.replace(/<\/script>/g, "<\\/script>")}\n</script>`);
fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "dist", "planner.html"), html, "utf8");
console.log(`built dist/planner.html (${(html.length / 1024).toFixed(0)} KB)`);
