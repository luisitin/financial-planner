// tests/server-static.test.mjs -- the app opens quickly and never from a stale mix: index.html carries an import map that
// gives each code file an address with its content hash (kept by the browser for good), every file has an ETag (304 when
// unchanged), text is gzipped, an edited file gets a new address on the next open, and private files stay refused.
// Runs on a copy of server/server.mjs in a temporary folder with a tiny app of its own, so nothing real is read.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("static files: fingerprinted code addresses, ETags and gzip; an edit shows on the next open; sw.js always checked; private files refused", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planner-static-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  fs.mkdirSync(path.join(root, "server"));
  fs.copyFileSync(path.join(REPO, "server", "server.mjs"), path.join(root, "server", "server.mjs"));
  fs.copyFileSync(path.join(REPO, "package.json"), path.join(root, "package.json"));
  put("index.html", '<!doctype html><html><head><link rel="stylesheet" href="./core/ui/base.css"></head><body><main></main>\n<script type="module" src="./core/app.js"></script>\n</body></html>');
  put("core/app.js", `import "../modules/x/a.js";\n// ${"padding so the file is worth compressing ".repeat(60)}\n`);
  put("core/ui/base.css", "body { margin: 0 }\n");
  put("modules/x/a.js", "export const a = 1;\n");
  put("modules/x/module.test.mjs", "// a test, never served to the app as code\n");
  put("sw.js", "self.addEventListener('fetch', () => {});\n");
  const port = 20000 + Math.floor(Math.random() * 20000);
  put("planner.properties", `server.port=${port}\nserver.bind=127.0.0.1\nai.provider=none\ndata.dir=data\n`);
  const child = spawn(process.execPath, [path.join(root, "server", "server.mjs")], { cwd: root, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  const get = (p, headers = {}) => fetch(base + p, { headers: { "accept-encoding": "identity", ...headers } });
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) { try { up = (await fetch(`${base}/api/health`)).status === 200; } catch { await sleep(100); } }
    assert.ok(up, "the server copy started");

    // the shell names every code file's current address, and the entry script uses the same address as the map
    const shell = await get("/");
    assert.equal(shell.headers.get("cache-control"), "no-cache", "the shell is always checked");
    const html = await shell.text();
    const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
    const appAt = map["/core/app.js"];
    assert.match(appAt, /^\/core\/app\.js\?v=[0-9a-f]{12}$/);
    assert.ok(html.includes(`src=".${appAt}"`), "the entry script is the mapped address (one copy of each module)");
    assert.match(html, /href="\.\/core\/ui\/base\.css\?v=[0-9a-f]{12}"/);
    assert.ok(html.indexOf("importmap") < html.indexOf('type="module"'), "the map comes before the first module");
    assert.ok(map["/modules/x/a.js"], "module files are mapped");
    assert.equal(map["/modules/x/module.test.mjs"], undefined, "tests are not");

    // the fingerprinted address is kept for good; any other address is checked each time
    const kept = await get(appAt);
    assert.equal(kept.status, 200);
    assert.match(kept.headers.get("cache-control"), /max-age=31536000.*immutable/);
    const tag = kept.headers.get("etag");
    assert.ok(tag);
    assert.equal((await get("/core/app.js")).headers.get("cache-control"), "no-cache");
    assert.equal((await get("/core/app.js?v=000000000000")).headers.get("cache-control"), "no-cache", "a wrong hash is never kept");
    const again = await get("/core/app.js", { "if-none-match": tag });
    assert.equal(again.status, 304, "unchanged: nothing sent again");

    // text goes gzipped when the browser accepts it
    const gz = await fetch(base + "/core/app.js", { headers: { "accept-encoding": "gzip" } });
    assert.equal(gz.headers.get("content-encoding"), "gzip");
    assert.ok(Number(gz.headers.get("content-length")) < fs.statSync(path.join(root, "core/app.js")).size / 3, "much smaller");
    const raw = await new Promise((resolve, reject) => {   // fetch undoes gzip itself; read the bytes as sent
      import("node:http").then(({ default: http }) => http.get(`${base}/core/app.js`, { headers: { "accept-encoding": "gzip" } }, (res) => { const parts = []; res.on("data", (c) => parts.push(c)); res.on("end", () => resolve(Buffer.concat(parts))); }).on("error", reject));
    });
    assert.equal(zlib.gunzipSync(raw).toString(), fs.readFileSync(path.join(root, "core/app.js"), "utf8"));

    // an edited file gets a new address on the next open (never a mix of old and new)
    await sleep(1100);
    put("modules/x/a.js", "export const a = 2;\n");
    const html2 = await (await get("/")).text();
    const map2 = JSON.parse(html2.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
    assert.notEqual(map2["/modules/x/a.js"], map["/modules/x/a.js"]);
    assert.equal(map2["/core/app.js"], appAt, "an unchanged file keeps its address");
    assert.equal(await (await get(map2["/modules/x/a.js"])).text(), "export const a = 2;\n");

    // the service worker: served as JavaScript, always checked (a changed worker is picked up on the next open), never in the map
    const sw = await get("/sw.js");
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get("content-type"), /^text\/javascript/);
    assert.equal(sw.headers.get("cache-control"), "no-cache");
    assert.equal(map["/sw.js"], undefined, "not a module: no hashed address");
    const swTag = sw.headers.get("etag");
    assert.equal((await get(`/sw.js?v=${swTag.slice(3, -1)}`)).headers.get("cache-control"), "no-cache", "even with its own hash it is never kept for good");
    assert.equal((await get("/sw.js", { "if-none-match": swTag })).status, 304);

    // private files are still refused
    assert.equal((await get("/planner.properties")).status, 403);
    assert.equal((await get("/data/plan.json")).status, 403);
  } finally {
    child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
