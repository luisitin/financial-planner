// tests/server-plan-base.test.mjs -- PUT /api/plan never overwrites another device's save: a save names the copy it was
// built on (X-Planner-Base = that copy's meta.updatedAt); when the PC's copy changed since, the server answers 409 with
// its copy and keeps it. Run on a copy of server/server.mjs in a temporary folder with its own planner.properties and
// data, so the real ones are never read or written (as tests/server-backups.test.mjs does).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A copy of the server in a temporary folder with its own planner.properties (`extra` lines added). */
function serverCopy(extra = "ai.provider=none") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planner-base-"));
  fs.mkdirSync(path.join(root, "server"));
  fs.copyFileSync(path.join(REPO, "server", "server.mjs"), path.join(root, "server", "server.mjs"));
  fs.copyFileSync(path.join(REPO, "package.json"), path.join(root, "package.json"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  fs.writeFileSync(path.join(root, "planner.properties"), `server.port=${port}\nserver.bind=127.0.0.1\ndata.dir=data\n${extra}\n`);
  const child = spawn(process.execPath, [path.join(root, "server", "server.mjs")], { cwd: root, stdio: "ignore" });
  return { root, child, base: `http://127.0.0.1:${port}/api` };
}

test("plan saves: the base check refuses a save built on an old copy, and old pages without it still save", async () => {
  const { root, child, base } = serverCopy();
  const put = async (body, from) => { const r = await fetch(`${base}/plan`, { method: "PUT", headers: { "content-type": "application/json", ...(from ? { "x-planner-base": from } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const pc = async () => (await fetch(`${base}/plan`)).json();
  const plan = (at, notes) => ({ schemaVersion: 1, notes, meta: { updatedAt: at } });
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) { try { up = (await fetch(`${base}/health`)).status === 200; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    assert.ok(up, "the server copy started");

    assert.equal((await put(plan("2026-11-01T08:00:00.000Z", "start"))).status, 200, "no base: saved as always");
    // the phone and the PC both opened the 08:00 copy
    assert.equal((await put(plan("2026-11-01T09:00:00.000Z", "PC's change"), "2026-11-01T08:00:00.000Z")).status, 200, "built on the current copy: saved");
    const refused = await put(plan("2026-11-01T09:05:00.000Z", "phone's change"), "2026-11-01T08:00:00.000Z");
    assert.equal(refused.status, 409, "built on an old copy: refused");
    assert.equal(refused.body.plan.notes, "PC's change", "the refusal carries the PC's copy");
    assert.equal((await pc()).notes, "PC's change", "nothing was overwritten");

    // the phone chose to keep its version: it saves on top of the copy it was shown
    assert.equal((await put(plan("2026-11-01T09:06:00.000Z", "phone's change"), "2026-11-01T09:00:00.000Z")).status, 200);
    assert.equal((await pc()).notes, "phone's change");
    // the same save sent twice (the answer was lost on the way): no refusal
    assert.equal((await put(plan("2026-11-01T09:06:00.000Z", "phone's change"), "2026-11-01T09:00:00.000Z")).status, 200, "a repeat of the copy already there is fine");
    // a page from before the check sends no base: it saves while the PC's copy predates the check too
    assert.equal((await put(plan("2026-10-01T00:00:00.000Z", "restored"))).status, 200);
    assert.equal((await pc()).notes, "restored");
    // a PC copy without a time (an old plan) is never a reason to refuse
    assert.equal((await put({ schemaVersion: 1, notes: "no time" })).status, 200);
    assert.equal((await put(plan("2026-11-01T10:00:00.000Z", "after"), "2026-11-01T09:06:00.000Z")).status, 200);
    // once a current page has saved (its copies carry meta.rev), a page from before the check cannot overwrite it
    const current = { schemaVersion: 1, notes: "current page", meta: { updatedAt: "2026-11-01T11:00:00.000Z", rev: "r-1" } };
    assert.equal((await put(current, "2026-11-01T10:00:00.000Z")).status, 200);
    const stale = await put(plan("2026-11-01T11:05:00.000Z", "a tab left open since the update"));
    assert.equal(stale.status, 409, "no base over a current copy: refused");
    assert.equal(stale.body.plan.notes, "current page"); assert.equal((await pc()).notes, "current page");
    assert.equal((await put(current)).status, 200, "the same copy again is fine");
  } finally {
    child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("health answers at once even when the AI host is slow, so a reachable PC never looks out of reach", async () => {
  // an AI host that accepts the connection and never answers
  const silent = net.createServer(() => { }); await new Promise((r) => silent.listen(0, "127.0.0.1", r));
  const { root, child, base } = serverCopy(`ai.provider=ollama\nai.host=127.0.0.1\nai.port=${silent.address().port}\nai.timeoutMs=20000`);
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) { try { await fetch(`${base}/config`); up = true; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    assert.ok(up, "the server copy started");
    const t = Date.now();
    const h = await (await fetch(`${base}/health`)).json();
    const took = Date.now() - t;
    assert.equal(h.ok, true);
    assert.ok(took < 3000, `health took ${took} ms`);
    assert.notEqual(h.ai.reachable, true, "the AI is not called reachable");
  } finally {
    child.kill(); silent.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
