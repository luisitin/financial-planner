// tests/user-view.test.mjs -- the household's view (core/view.js): only pages that work, nothing that needs the PC or
// the AI helper unless it answers, no builder pages; the build view shows everything as before; the choice is read
// from the address, remembered when the browser can, and kept in memory when it cannot.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseView, offered, VIEW_KEY } from "../core/view.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fresh = (tag) => import(`../core/view.js?${tag}`);   // a copy with its own state
const memoryStorage = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };
const withStorage = async (s, fn) => { const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage"); Object.defineProperty(globalThis, "localStorage", { configurable: true, get: s instanceof Error ? () => { throw s; } : () => s }); try { return await fn(); } finally { if (had) Object.defineProperty(globalThis, "localStorage", had); else delete globalThis.localStorage; } };

test("the address chooses the view: ?view=build / ?view=user, anything else is no choice", () => {
  assert.equal(parseView("?view=build"), "build");
  assert.equal(parseView("?sandbox=1&view=user"), "user");
  for (const s of ["", "?view=", "?view=BUILD", "?view=other", "?sandbox=1", undefined, null]) assert.equal(parseView(s), null, String(s));
});

test("the user view is the default; ?view= sets and remembers the choice on this device", async () => {
  const st = memoryStorage();
  await withStorage(st, async () => {
    const v = (await fresh("a")).view;
    assert.equal(v.init(""), false, "nothing chosen: the user view");
    assert.equal(v.init("?view=build"), true); assert.equal(st.m.get(VIEW_KEY), "build");
    const again = (await fresh("b")).view;
    assert.equal(again.init(""), true, "remembered on the next visit");
    assert.equal(again.init("?view=user"), false); assert.equal(st.m.has(VIEW_KEY), false, "the user view forgets the build choice");
  });
});

test("with storage unavailable the user view shows, and a choice lasts for the visit in memory", async () => {
  await withStorage(new Error("SecurityError"), async () => {
    const v = (await fresh("c")).view;
    assert.equal(v.init(""), false);
    assert.doesNotThrow(() => v.set(true));
    assert.equal(v.build, true, "the switch still works for this visit");
    assert.equal((await fresh("d")).view.init(""), false, "but a new visit starts in the user view");
    assert.doesNotThrow(() => v.init("?view=build"));
  });
});

test("what answers: the AI helper only counts through the PC", async () => {
  const { reach } = await fresh("e");
  assert.deepEqual([reach.pc, reach.ai], [false, false]);
  assert.equal(reach.set({ ai: true }), false, "an AI helper without a PC is nothing");
  assert.equal(reach.set({ pc: true }), true); assert.equal(reach.ai, false);
  assert.equal(reach.set({ ai: true }), true); assert.equal(reach.ai, true);
  assert.equal(reach.set({ ai: true }), false, "no change, no event");
  reach.set({ pc: false }); assert.deepEqual([reach.pc, reach.ai], [false, false], "the PC going away takes the AI helper with it");
});

const ready = (m) => m.status !== "planned";
const none = { build: false, pc: false, ai: false }, pcOnly = { build: false, pc: true, ai: false }, both = { build: false, pc: true, ai: true };
test("a page is offered in the user view only when it is ready, not a builder's page, and what it needs answers", () => {
  const usable = { status: "usable" }, soon = { status: "planned", placeholder: true };
  assert.equal(offered(usable, none, ready), true);
  assert.equal(offered(soon, none, ready), false, "no coming-soon page");
  assert.equal(offered({ status: "usable", builderOnly: true }, both, ready), false, "no builder page, whatever answers");
  const ai = { status: "usable", requires: "ai" }, pc = { status: "usable", requires: "pc" };
  assert.deepEqual([none, pcOnly, both].map((s) => offered(ai, s, ready)), [false, false, true]);
  assert.deepEqual([none, pcOnly, both].map((s) => offered(pc, s, ready)), [false, true, true]);
  assert.equal(offered(null, both, ready), false);
});
test("the build view offers every page, as before", () => {
  for (const m of [{ status: "planned" }, { status: "usable", builderOnly: true }, { status: "usable", requires: "ai" }, { status: "stub", requires: "pc" }]) assert.equal(offered(m, { build: true, pc: false, ai: false }, ready), true);
});

// ---- the real manifests
function manifests() {
  const out = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "module.js");
      if (!m.isDirectory() || !fs.existsSync(f)) continue;
      const t = fs.readFileSync(f, "utf8"), field = (k) => t.match(new RegExp(`^\\s*${k}:\\s*"([^"]*)"`, "m"))?.[1];
      out.push({ key: `${g.name}/${m.name}`, status: field("status"), requires: field("requires"), builderOnly: /^\s*builderOnly:\s*true/m.test(t) || undefined });
    }
  }
  return out;
}
test("real pages: the household with no PC sees no planned, builder or PC/AI page; with both answering, the AI pages return", () => {
  const all = manifests(); assert.ok(all.length > 100);
  const bare = all.filter((m) => offered(m, none, ready));
  assert.ok(bare.length > 100, "the everyday pages are all there");
  for (const m of bare) { assert.notEqual(m.status, "planned", m.key); assert.ok(!m.builderOnly && !m.requires, m.key); }
  const keys = (s) => new Set(all.filter((m) => offered(m, s, ready)).map((m) => m.key));
  for (const k of ["ai/assistant", "ai/categorizer", "ai/critic", "ai/explain"]) { assert.ok(!keys(none).has(k) && !keys(pcOnly).has(k), `${k} hidden without the AI`); assert.ok(keys(both).has(k), `${k} offered when it answers`); }
  for (const k of ["system/audit", "system/backups", "transactions/statements"]) { assert.ok(!keys(none).has(k), `${k} hidden without the PC`); assert.ok(keys(pcOnly).has(k), `${k} offered when the PC answers`); }
  for (const k of ["ai/glossary", "ai/notes", "ai/reader", "system/help", "system/settings", "system/assumptions", "overview/quick", "overview/dashboard"]) assert.ok(keys(none).has(k), `${k} works without a PC`);
  for (const k of ["system/diagnostics", "system/docs"]) { assert.ok(!keys(both).has(k), `${k} is a builder page`); assert.ok(offered(all.find((m) => m.key === k), { build: true, pc: false, ai: false }, ready), `${k} stays in the build view`); }
});
test("every `requires` in a manifest is pc or ai", () => { for (const m of manifests()) assert.ok(m.requires === undefined || ["pc", "ai"].includes(m.requires), `${m.key}: requires "${m.requires}"`); });

// ---- the single-file build and the starting plan
test("tools/build.mjs: --demo / --out are read, and the starting plan can never end its script", async () => {
  const { parseArgs, startScript } = await import("../tools/build.mjs");
  assert.deepEqual(parseArgs(["--demo", "p.json", "--out", "o.html"]), { demo: "p.json", out: "o.html" });
  assert.deepEqual(parseArgs([]), { demo: null, out: null });
  assert.throws(() => parseArgs(["--demo"]), /needs a plan file/);
  assert.throws(() => parseArgs(["--demo", "p.json", "--out"]), /needs a file name/);
  assert.throws(() => parseArgs(["--nope"]), /unknown option/);
  const s = startScript({ meta: { name: "</script><script>alert(1)</script>" } });
  assert.equal((s.match(/<\/script>/g) ?? []).length, 1, "only our own closing tag");
  const ev = new Function("globalThis", s.replace(/^<script>|<\/script>$/g, ""));
  const g = {}; ev(g); assert.equal(g.__PLANNER_START__.meta.name, "</script><script>alert(1)</script>");
});
test("tools/build.mjs --demo writes one self-contained file under 16 MB that opens on the invented household", async (t) => {
  const { build } = await import("../tools/build.mjs");
  let out;
  try { out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "planner-demo-")), "demo.html"); await build({ demo: path.join(ROOT, "qa/fixtures/demo-household.mjs"), out }); }
  catch (e) { if (/esbuild is not installed/.test(e.message)) return t.skip("esbuild is not installed"); throw e; }
  const html = fs.readFileSync(out, "utf8");
  assert.ok(html.length < 16 * 1024 * 1024);
  assert.ok(html.includes("__PLANNER_START__") && !/<link[^>]+(href|src)="\.\//.test(html), "one file: no relative links left");
  assert.ok(/Ana/.test(html) && /Our plan/.test(html), "the invented household is inside");
  fs.rmSync(path.dirname(out), { recursive: true });
});

test("the store starts from the baked-in plan once, keeps changes in memory when storage throws, and never calls storage full", async () => {
  globalThis.location = { search: "", protocol: "file:", origin: "null", hash: "" };
  globalThis.Event = class { constructor(type) { this.type = type; } };
  globalThis.addEventListener = () => {}; globalThis.dispatchEvent = () => true;
  delete globalThis.fetch;
  globalThis.__PLANNER_START__ = { schemaVersion: 1, meta: { name: "Pretend" }, household: { people: [{ id: "p1", name: "Ana", role: "self" }] } };
  await withStorage(new Error("SecurityError"), async () => {
    const { store } = await import("../core/store.js?memory");
    await store.load();
    assert.equal(store.get().meta.name, "Pretend");
    store.update((p) => { p.meta.name = "Changed"; });
    assert.equal(store.get().meta.name, "Changed");
    assert.equal(store.syncState().localFull, false, "no 'out of space' for a browser that keeps nothing");
    assert.equal(store.backend(), "local");
  });
  const st = memoryStorage();
  await withStorage(st, async () => {
    const { store } = await import("../core/store.js?seed");
    await store.load();
    assert.equal(store.get().meta.name, "Pretend"); assert.ok(st.m.has("planner.plan"), "kept in the browser when it can");
    store.update((p) => { p.meta.name = "Mine"; });
    const again = await import("../core/store.js?seed2");
    await again.store.load();
    assert.equal(again.store.get().meta.name, "Mine", "a plan of its own is never replaced by the baked-in one");
  });
  delete globalThis.__PLANNER_START__;
});

// ---- wording the household reads (review 2026-11-06): no machine, build or AI words on pages that work without them
test("purposes of pages offered with no PC and no AI never say PC, server, phase or AI", () => {
  const rows = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "module.js");
      if (!m.isDirectory() || !fs.existsSync(f)) continue;
      const t = fs.readFileSync(f, "utf8"), field = (k) => t.match(new RegExp(`^\\s*${k}:\\s*"([^"]*)"`, "m"))?.[1];
      rows.push({ key: `${g.name}/${m.name}`, status: field("status"), requires: field("requires"), builderOnly: /^\s*builderOnly:\s*true/m.test(t) || undefined, purpose: field("purpose") ?? "", icon: field("icon") });
    }
  }
  for (const m of rows.filter((x) => offered(x, none, ready))) assert.doesNotMatch(m.purpose, /\bPC\b|\bserver\b|\bphase\b|\bAI\b|\bstatus\b/i, `${m.key}: "${m.purpose}"`);
  const robot = (k) => rows.find((x) => x.key === k).icon;
  for (const k of ["ai/notes", "ai/glossary", "ai/reader"]) assert.notEqual(robot(k), "🤖", `${k} works without the AI: no robot`);
});
test("the topic of the AI pages is not called an assistant, the footers do not name a computer, the import line follows the view", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.doesNotMatch(read("core/groups.js"), /title:\s*"AI assistant"/);
  for (const f of ["modules/overview/start/view.js", "modules/overview/quick/view.js"]) assert.doesNotMatch(read(f), /your own computer and phone/, f);
  assert.match(read("modules/transactions/import/view.js"), /ctx\.view\.build \? " on the PC" : ""/);
  assert.match(read("core/app.js"), /userView\(\) \? "Saved on your computer" : "Saved on PC"/);
  assert.match(read("modules/household/calendar/view.js"), /\.cal-link \{[^}]*min-width: 44px/);
});
test("inside a frame the shell sends a Save tap to the form itself without probing (a sandboxed frame logs every blocked submit)", () => {
  const src = fs.readFileSync(path.join(ROOT, "core/app.js"), "utf8");
  const fn = src.slice(src.indexOf("function mendBlockedForms"), src.indexOf("boot().then(mendBlockedForms)"));
  assert.doesNotMatch(fn, /requestSubmit/, "no probe: a probe is itself a blocked submit");
  assert.match(fn, /window\.top !== window\.self/);
  assert.match(fn, /!form\.noValidate/, "a form that opted out of checking is not checked");
});
test("first screens a household sees never say the PC is not connected (setup, Monte Carlo), except in the build view", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const setup = read("modules/overview/setup/view.js");
  assert.match(setup, /if \(ctx\.view\.build && store\.backend\(\) !== "server" && !store\.sandbox\(\)\) add\(card[^\n]*not connected to your PC/);
  assert.doesNotMatch(setup, /your own computer and phone/);
  const mc = read("modules/retirement/monte-carlo/view.js");
  assert.doesNotMatch(mc, /^(?!.*ctx\.view\.build).*"[^"\n]*the PC is not connected/m, "the PC clause only in the build view");
  assert.match(mc, /ctx\.view\.build \? "10,000 pretend futures \(best on your computer\)" : "10,000 pretend futures"/);
});
