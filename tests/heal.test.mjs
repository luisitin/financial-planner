// tests/heal.test.mjs -- a phone never stays on a mix of old and new files (docs/PLAN.md "On a static host (GitHub
// Pages)"): core/heal.js (the shell reloads once, then says so in plain words) and index.html's opening guard (registers
// sw.js where a service worker can work; reloads once when core/app.js itself cannot start). The guard is a plain script
// inside index.html: it runs here in a Node vm with a pretend window, exactly as written in the page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { HEAL_KEY, HEAL_WINDOW_MS, mayHeal, healOnce, brokenWords, bootWords, PAGE_WORDS, failNotice } from "../core/heal.js";
import { withoutOpeningGuard } from "../tools/build.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
const GUARD = INDEX.match(/<script id="opening-guard">([\s\S]*?)<\/script>/)?.[1];

function memoryStorage(keeps = true) {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (keeps) m.set(k, String(v)); }, map: m };
}

// ---------------------------------------------------------------- core/heal.js
test("mayHeal: once, then not again within two minutes", () => {
  const now = 1_800_000_000_000;
  assert.equal(HEAL_WINDOW_MS, 120000);
  assert.equal(mayHeal(null, now), true, "never reloaded");
  assert.equal(mayHeal("", now), true);
  assert.equal(mayHeal("garbage", now), true);
  assert.equal(mayHeal(String(now - 1000), now), false, "a second ago");
  assert.equal(mayHeal(String(now - HEAL_WINDOW_MS + 1), now), false, "just inside the window");
  assert.equal(mayHeal(String(now - HEAL_WINDOW_MS), now), true, "two minutes on: a later mix may be mended again");
  assert.equal(mayHeal(String(now + 60000), now), true, "a clock set back never blocks it for good");
});

test("healOnce: reloads once and keeps the time; never twice in the window; never where the time cannot be kept", () => {
  const storage = memoryStorage();
  let reloads = 0;
  const reload = () => { reloads++; };
  const t0 = 1_800_000_000_000;
  assert.equal(healOnce({ storage, now: t0, reload }), true);
  assert.equal(storage.getItem(HEAL_KEY), String(t0));
  assert.equal(healOnce({ storage, now: t0 + 5000, reload }), false, "the same mix after the reload: show the words");
  assert.equal(reloads, 1);
  assert.equal(healOnce({ storage, now: t0 + HEAL_WINDOW_MS + 1, reload }), true, "a new problem later: one more reload");
  assert.equal(reloads, 2);
  // a browser that keeps nothing (a sandboxed frame, the claude.ai demo): no reload, so it can never loop
  assert.equal(healOnce({ storage: memoryStorage(false), now: t0, reload }), false);
  assert.equal(healOnce({ storage: null, now: t0, reload }), false);
  assert.equal(healOnce({ storage: { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { } }, now: t0, reload }), false);
  assert.equal(healOnce({ storage: memoryStorage(), now: t0, reload: () => { throw new Error("blocked"); } }), false);
  assert.equal(reloads, 2);
});

test("the words: plain; the PC is mentioned only when the app's files come from it", () => {
  assert.equal(brokenWords(99, false), "Some pages could not open. Reload to try again.");
  assert.equal(brokenWords(1, false), "One page could not open. Reload to try again.");
  assert.doesNotMatch(brokenWords(99, false) + bootWords(false), /PC/);
  assert.equal(brokenWords(99, true), "99 pages could not load right now. Reload the page; if it keeps happening, restart the app on the PC.", "the PC's words as before");
  assert.equal(brokenWords(1, true), "One page could not load right now. Reload the page; if it keeps happening, restart the app on the PC.");
  assert.equal(PAGE_WORDS, "This page could not open.");
  assert.match(bootWords(true), /restart the app on the PC/);
  assert.equal(bootWords(false), "The app could not open. Reload to try again.");
  for (const w of [brokenWords(3, false), PAGE_WORDS, bootWords(false)]) assert.doesNotMatch(w, /TypeError|undefined|module|render/i, "no developer words on the first line");
});

test("the notice: words, a filled Reload button, details folded; never two Reload buttons on one screen", () => {
  // a pretend core/ui: h(tag, attrs, ...children) and button(text, onClick)
  const ui = {
    h: (tag, attrs, ...kids) => ({ tag, attrs, kids: kids.flat().filter((k) => k != null) }),
    button: (text, onClick) => ({ tag: "button", text, onClick }),
  };
  const find = (n, pred) => (n && typeof n === "object" ? [pred(n) ? n : null, ...(n.kids ?? []).flatMap((k) => find(k, pred))].filter(Boolean) : []);
  let reloaded = 0;
  const full = failNotice(ui, "Some pages could not open. Reload to try again.", ["pages: SyntaxError ..."], { onReload: () => reloaded++ });
  assert.equal(full.attrs.class, "notice error");
  assert.equal(full.attrs.role, "alert");
  assert.equal(full.kids[0].kids[0], "Some pages could not open. Reload to try again.", "the words come first");
  const buttons = find(full, (n) => n.tag === "button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].text, "Reload");
  buttons[0].onClick();
  assert.equal(reloaded, 1);
  assert.equal(find(full, (n) => n.tag === "summary")[0].kids[0], "Show details");
  // the shell already shows "Some pages could not open" with its button: the page's own notice says so without one
  const page = failNotice(ui, PAGE_WORDS, ["TypeError: x"], { reload: false });
  assert.equal(find(page, (n) => n.tag === "button").length, 0);
  assert.equal(page.kids[0].kids[0], PAGE_WORDS);
  assert.equal(find(page, (n) => n.tag === "li")[0].kids[0], "TypeError: x");
  assert.equal(find(failNotice(ui, "x"), (n) => n.tag === "details").length, 0, "no details: no fold");
  // core/app.js leaves the page's button out exactly when the pages notice (with its own) is on the screen
  const app = fs.readFileSync(path.join(REPO, "core", "app.js"), "utf8");
  assert.match(app, /if \(broken\.length\) root\.append\(failNotice\(brokenWords\(/);
  assert.match(app, /page\.append\(failNotice\(PAGE_WORDS, \[String\(e\)\], \{ reload: !broken\.length \}\)\)/);
});

// ---------------------------------------------------------------- index.html's opening guard
/** A pretend browser window for the guard. Returns the window and what happened. */
const PAGE = "https://someone.github.io/financial-planner/";
function browser({ secure = true, protocol = "https:", sw = "ok", storage = memoryStorage(), booting = true, importMap = false, storageThrows = false, href = PAGE, search = "" } = {}) {
  const happened = { registered: [], reloads: 0, listeners: [], replaced: null };
  const pill = { textContent: "Connecting…", style: {} };
  happened.pill = pill;
  const make = (tag) => {
    const el = { tagName: tag.toUpperCase(), children: [], className: "", textContent: "", style: {}, attrs: {}, handlers: {},
      appendChild(c) { el.children.push(c); return c; }, setAttribute(k, v) { el.attrs[k] = v; }, addEventListener(t, f) { el.handlers[t] = f; } };
    return el;
  };
  const opening = { parentNode: { replaceChild(n, old) { happened.replaced = n; } } };
  const document = {
    createElement: make,
    getElementById: (id) => (id === "status" ? pill : null),
    querySelector: (sel) => (sel === "#content .booting" ? (booting && !happened.replaced ? opening : null) : sel === 'script[type="importmap"]' ? (importMap ? {} : null) : null),
  };
  const navigator = {};
  if (sw === "ok") navigator.serviceWorker = { register: (url, opts) => { happened.registered.push({ url, opts }); return Promise.resolve({}); } };
  if (sw === "rejects") navigator.serviceWorker = { register: (url, opts) => { happened.registered.push({ url, opts }); return Promise.reject(new Error("SecurityError")); } };
  if (sw === "throws") Object.defineProperty(navigator, "serviceWorker", { enumerable: true, get() { throw new Error("SecurityError: the document is sandboxed"); } });
  const win = {
    isSecureContext: secure, navigator, document,
    location: { protocol, href: href + search, search, reload() { happened.reloads++; } },
    addEventListener: (type, fn, capture) => happened.listeners.push({ type, fn, capture }),
  };
  Object.defineProperty(win, "sessionStorage", { get() { if (storageThrows) throw new Error("SecurityError"); return storage; } });
  return { win, happened, storage };
}
function runGuard(b) {
  const ctx = vm.createContext({ window: b.win, Date, Number, String });
  vm.runInContext(GUARD, ctx, { filename: "index.html#opening-guard" });
  return b;
}
const errorEvent = (b, ev) => { for (const l of b.happened.listeners.filter((x) => x.type === "error")) l.fn(ev); };
const linkError = () => { const e = new SyntaxError("The requested module './format.js' does not provide an export named 'amountText'"); return { target: {}, error: e, message: `Uncaught ${e}` }; };
const texts = (el) => [el.textContent, ...(el.children ?? []).flatMap(texts)].filter(Boolean);

test("the guard is in index.html, before the app's script, and the single-file build leaves it out", () => {
  assert.ok(GUARD, 'index.html has <script id="opening-guard">');
  assert.ok(INDEX.indexOf('id="opening-guard"') < INDEX.indexOf('<script type="module" src="./core/app.js">'), "it runs before the app's own files");
  const single = withoutOpeningGuard(INDEX);
  assert.doesNotMatch(single, /serviceWorker|opening-guard|sw\.js/, "no service worker in the single file (no sw.js beside it; the claude.ai demo frame refuses one)");
  assert.match(single, /<script type="module" src="\.\/core\/app\.js"><\/script>/, "the rest of the page is untouched (build.mjs then inlines app.js)");
  assert.throws(() => withoutOpeningGuard("<html></html>"), /opening-guard/, "a renamed guard cannot slip into the single file");
});

test("registration: only where a service worker can work, with scope ./ (so it works under /financial-planner/)", () => {
  const cases = [
    [{ secure: true, protocol: "https:" }, true, "GitHub Pages (https)"],
    [{ secure: true, protocol: "http:" }, true, "http://localhost or 127.0.0.1 on the PC (a secure context)"],
    [{ secure: false, protocol: "http:" }, false, "the PC over a LAN address (http): not available, nothing said"],
    [{ secure: true, protocol: "file:" }, false, "a copy opened from the phone's files"],
    [{ secure: true, protocol: "https:", sw: "none" }, false, "a browser without service workers"],
  ];
  for (const [opts, want, why] of cases) {
    const b = runGuard(browser(opts));
    assert.equal(b.happened.registered.length, want ? 1 : 0, why);
    if (want) assert.deepEqual(JSON.parse(JSON.stringify(b.happened.registered[0])), { url: "./sw.js", opts: { scope: "./" } }, why);   // (the vm's objects have their own prototype)
  }
});

test("registration refused (a sandboxed frame, a blocked worker): caught, silent, and the guard still runs", async () => {
  const b1 = runGuard(browser({ sw: "throws" }));
  assert.equal(b1.happened.registered.length, 0);
  assert.equal(b1.happened.listeners.length, 1, "the opening watch is still in place");
  let unhandled = null;
  const onUnhandled = (e) => { unhandled = e; };
  process.on("unhandledRejection", onUnhandled);
  const b2 = runGuard(browser({ sw: "rejects" }));
  await new Promise((r) => setTimeout(r, 20));
  process.off("unhandledRejection", onUnhandled);
  assert.equal(b2.happened.registered.length, 1);
  assert.equal(unhandled, null, "a refused registration leaves no unhandled rejection");
});

test("the app cannot start (a link error, or core/app.js did not load): one reload, then plain words with Reload", () => {
  const storage = memoryStorage();
  const first = runGuard(browser({ storage }));
  errorEvent(first, linkError());
  assert.equal(first.happened.reloads, 1, "first time: reload at once");
  assert.equal(first.happened.replaced, null, "nothing shown while it reloads");
  assert.ok(Number(storage.getItem(HEAL_KEY)) > 0, "the time is kept under core/heal.js's key");
  // the reloaded page hits the same problem: no second reload, plain words instead of "Opening your plan..." for ever
  const second = runGuard(browser({ storage }));
  errorEvent(second, linkError());
  assert.equal(second.happened.reloads, 0);
  const box = second.happened.replaced;
  assert.ok(box, "the opening screen is replaced");
  assert.equal(box.className, "notice error");
  assert.equal(box.attrs.role, "alert");
  const words = texts(box);
  assert.equal(words[0], "The app could not open. Reload to try again.", "phone only: the PC is not mentioned");
  const button = box.children[1].children[0];
  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.textContent, "Reload");
  assert.equal(button.className, "", "a filled button (base.css's default), no class of its own");
  button.handlers.click();
  assert.equal(second.happened.reloads, 1, "the button reloads");
  const details = box.children[2];
  assert.equal(details.className, "notice-details");
  assert.equal(details.children[0].textContent, "Show details");
  assert.match(texts(details).join(" "), /does not provide an export named/, "the technical text is folded behind Show details");
  assert.equal(second.happened.pill.style.display, "none", "the top pill no longer says \"Connecting...\" for ever");
  // core/app.js failed to load (a fetch error fires on its <script type="module">), on the PC: the PC's words
  const pc = runGuard(browser({ storage, importMap: true }));
  errorEvent(pc, { target: { tagName: "SCRIPT", type: "module", src: "http://127.0.0.1:8787/core/app.js?v=a1b2c3d4e5f6" }, error: null, message: "" });
  assert.equal(pc.happened.reloads, 0, "still within two minutes of the first reload");
  assert.match(texts(pc.happened.replaced)[0], /restart the app on the PC/);
});

test("the guard stays out of the way: errors after the app has drawn, other errors, and browsers that keep nothing", () => {
  const drawn = runGuard(browser({ booting: false }));
  errorEvent(drawn, linkError());
  assert.equal(drawn.happened.reloads + (drawn.happened.replaced ? 1 : 0), 0, "the shell is up: core/app.js handles its own errors");
  const other = runGuard(browser());
  errorEvent(other, { target: {}, error: new TypeError("x is undefined"), message: "x" });
  errorEvent(other, { target: { tagName: "IMG", src: "icon-180.png" }, error: null, message: "" });
  assert.equal(other.happened.reloads + (other.happened.replaced ? 1 : 0), 0, "a stray error or a missing picture is not a broken app");
  const keepsNothing = runGuard(browser({ storageThrows: true }));
  errorEvent(keepsNothing, linkError());
  assert.equal(keepsNothing.happened.reloads, 0, "no sessionStorage: never reloads (it could loop)");
  assert.ok(keepsNothing.happened.replaced, "the words show at once");
});

test("one of the app's own files throws while it starts (not a link error): one reload, then the words", () => {
  // a new core/app.js calls fmt.notThere() on an old core/format.js: `import * as fmt` is not checked at link time, so
  // the browser reports a TypeError from that file, not a SyntaxError; the screen stayed on "Opening your plan..."
  const threw = (file) => { const e = new TypeError("fmt.notThere is not a function"); return { target: {}, error: e, message: `Uncaught ${e}`, filename: file, lineno: 52 }; };
  for (const [href, file] of [
    [PAGE, `${PAGE}core/app.js`],
    [`${PAGE}index.html`, `${PAGE}core/format.js`],
    ["http://127.0.0.1:8787/", "http://127.0.0.1:8787/core/app.js?v=a1b2c3d4e5f6"],   // the PC's hashed address
    [PAGE, `${PAGE}modules/overview/pages/view.js`],
  ]) {
    const storage = memoryStorage();
    const first = runGuard(browser({ storage, href }));
    errorEvent(first, threw(file));
    assert.equal(first.happened.reloads, 1, `${file}: reloads once`);
    const second = runGuard(browser({ storage, href }));
    errorEvent(second, threw(file));
    assert.equal(second.happened.reloads, 0);
    assert.equal(texts(second.happened.replaced)[0], "The app could not open. Reload to try again.", file);
    assert.match(texts(second.happened.replaced).join(" "), /fmt\.notThere is not a function/);
  }
  // not the app's own file: the page itself (an inline script), another site, a browser add-on, a sanitised cross-site error
  for (const file of [PAGE, `${PAGE}index.html`, "https://cdn.jsdelivr.net/npm/x@1.0.0/x.js", "chrome-extension://abc/content.js", "", undefined]) {
    const b = runGuard(browser());
    errorEvent(b, { target: {}, error: new TypeError("x is undefined"), message: "x", filename: file });
    assert.equal(b.happened.reloads + (b.happened.replaced ? 1 : 0), 0, String(file));
  }
});

test("the sandbox (?sandbox=1) never reloads by itself: a tester sees the words at once, as with core/app.js", () => {
  for (const search of ["?sandbox=1", "?view=build&sandbox=1", "?sandbox"]) {
    const storage = memoryStorage();
    const b = runGuard(browser({ storage, search }));
    errorEvent(b, linkError());
    assert.equal(b.happened.reloads, 0, search);
    assert.equal(storage.getItem(HEAL_KEY), null, "no time kept");
    assert.equal(texts(b.happened.replaced)[0], "The app could not open. Reload to try again.");
  }
  const notSandbox = runGuard(browser({ search: "?view=build" }));
  errorEvent(notSandbox, linkError());
  assert.equal(notSandbox.happened.reloads, 1, "any other address: the one reload");
});

test("the guard and core/heal.js share one key and one window, so the two together reload at most once in two minutes", () => {
  assert.match(GUARD, new RegExp(`KEY = "${HEAL_KEY.replace(".", "\\.")}"`));
  assert.match(GUARD, new RegExp(`WINDOW_MS = ${HEAL_WINDOW_MS}\\b`));
  // the shell reloaded (core/heal.js) a moment ago; the reloaded page cannot start: the guard does not reload again
  const storage = memoryStorage();
  assert.equal(healOnce({ storage, now: Date.now(), reload: () => { } }), true);
  const b = runGuard(browser({ storage }));
  errorEvent(b, linkError());
  assert.equal(b.happened.reloads, 0);
  // and the other way round
  const s2 = memoryStorage();
  errorEvent(runGuard(browser({ storage: s2 })), linkError());
  assert.equal(healOnce({ storage: s2, now: Date.now(), reload: () => { throw new Error("must not reload"); } }), false);
});
