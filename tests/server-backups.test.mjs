// tests/server-backups.test.mjs -- the server's backup routes (GET /api/plan/backups and /api/plan/backups/<name>) on a
// copy of server/server.mjs in a temporary folder with its own planner.properties and data, so the real ones are never
// read or written. A name is served only when it is in the backups folder's own list: never a path.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("backups: the list, one backup by name, and nothing outside the folder", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planner-backups-"));
  fs.mkdirSync(path.join(root, "server"));
  fs.copyFileSync(path.join(REPO, "server", "server.mjs"), path.join(root, "server", "server.mjs"));
  fs.copyFileSync(path.join(REPO, "package.json"), path.join(root, "package.json"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  fs.writeFileSync(path.join(root, "planner.properties"), `server.port=${port}\nserver.bind=127.0.0.1\nai.provider=none\ndata.dir=data\n`);
  fs.mkdirSync(path.join(root, "data", "backups"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "backups", "plan-2026-10-30T10-00-00.json"), JSON.stringify({ schemaVersion: 1, notes: "older" }));
  fs.writeFileSync(path.join(root, "data", "backups", "plan-2026-10-31T09-30-00.json"), JSON.stringify({ schemaVersion: 1, notes: "newer" }));
  fs.writeFileSync(path.join(root, "data", "backups", "plan-broken.json"), "{ not json");
  fs.writeFileSync(path.join(root, "data", "secret.json"), JSON.stringify({ secret: true }));
  const child = spawn(process.execPath, [path.join(root, "server", "server.mjs")], { cwd: root, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}/api`;
  const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json().catch(() => null) }; };
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) { try { up = (await get("/health")).status === 200; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    assert.ok(up, "the server copy started");
    assert.deepEqual((await get("/plan/backups")).body.backups, ["plan-broken.json", "plan-2026-10-31T09-30-00.json", "plan-2026-10-30T10-00-00.json"]);
    const one = await get("/plan/backups/plan-2026-10-30T10-00-00.json");
    assert.equal(one.status, 200); assert.equal(one.body.notes, "older");
    assert.equal((await get("/plan/backups/plan-broken.json")).status, 422, "a file that is not a plan says so");
    assert.equal((await get("/plan/backups/plan-2027-01-01T00-00-00.json")).status, 404, "not in the list");
    assert.equal((await get("/plan/backups/..%2Fsecret.json")).status, 404, "a path is never followed");
    assert.equal((await get("/plan/backups/%2E%2E%2Fsecret.json")).status, 404);
    assert.equal((await get("/plan/backups/%E0%A4%A")).status, 404, "a malformed name");
    // saves: each keeps a copy of the plan before it; two saves in the same second keep the first copy, never the second
    const put = (body) => fetch(`${base}/plan`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await put({ schemaVersion: 1, notes: "A" })).status, 200);
    const before = new Set((await get("/plan/backups")).body.backups);
    await put({ schemaVersion: 1, notes: "B" });
    await put({ schemaVersion: 1, notes: "C" });
    const made = (await get("/plan/backups")).body.backups.filter((n) => !before.has(n)).sort();
    const held = await Promise.all(made.map(async (n) => (await get(`/plan/backups/${n}`)).body.notes));
    assert.ok(made.length === 1 || made.length === 2, `copies made: ${made}`);
    assert.deepEqual(held, made.length === 1 ? ["A"] : ["A", "B"], "the plan before the first save of a second is kept");
  } finally {
    child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
