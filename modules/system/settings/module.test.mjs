import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("settings reports sections", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  const d = compute(p);
  assert.equal(d.schemaVersion, 1);
  assert.equal(d.sections.find((s) => s.key === "accounts").count, 1);
  assert.ok(d.sizeKB > 0);
});

test("a file to restore must be shaped like a plan: lists stay lists, fields stay fields, two levels down", async () => {
  const { planShapeProblem } = await import("./compute.js");
  const t = emptyPlan();
  assert.equal(planShapeProblem(emptyPlan(), t), null);
  assert.equal(planShapeProblem({ schemaVersion: 1 }, t), null);                       // missing keys are filled by migrate
  assert.equal(planShapeProblem({ schemaVersion: 3, accounts: "oops" }, t), "accounts");
  assert.equal(planShapeProblem({ schemaVersion: 1, household: { people: "x" } }, t), "household.people");
  assert.equal(planShapeProblem({ schemaVersion: 1, household: null }, t), "household");
  assert.equal(planShapeProblem({ schemaVersion: 1, meta: "oops" }, t), "meta");
  assert.equal(planShapeProblem({ schemaVersion: 1, holdings: "oops" }, t), "holdings");
  assert.equal(planShapeProblem({ schemaVersion: 1, categories: {} }, t), "categories");
  assert.equal(planShapeProblem([], t), "the file");
});

// ---- How much to show (opt C7; docs/OPTIONAL.md "The two switches"; show.js) ----------------------------------------------------
// A phone's storage, so the device's choices can be read back (Node has none; core/ui/more.js reads it lazily).
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };
const fresh = async () => { const more = await import("../../../core/ui/more.js"); disk.clear(); more._test.reset(); more.detail.init(null); return more; };
async function cardKit() {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const show = await import("./show.js");
  const host = new FakeElement("main");
  const writes = [];
  // the plan is never touched: a store that records any write (the card has no store at all)
  const ctx = { ui, store: { update: () => writes.push("update"), get: () => ({}) }, redraw: () => { host.replaceChildren(show.howMuchCard(ctx)); } };
  host.append(show.howMuchCard(ctx));
  const boxes = () => host.all().filter((e) => e.tagName === "INPUT" && e.getAttribute("type") === "checkbox");
  const tick = (name, on) => { const b = boxes().find((x) => x.getAttribute("name") === name); b.checked = on; b.dispatch("change"); };
  return { host, ctx, ui, show, writes, boxes, tick, text: () => textOf(host).replace(/\s+/g, " "), FakeElement, textOf };
}

test("How much to show: two ticks, both off on a new phone, on this phone only; nothing is stored before a tick", async () => {
  await fresh();
  const k = await cardKit();
  assert.equal(k.host.querySelector("h2").textContent, "How much to show");
  assert.deepEqual(k.boxes().map((b) => [b.getAttribute("name"), b.checked]), [["show-working", false], ["show-boxes", false]]);
  // short (simple first): the title, the two ticks and one line; what a tick opens is said in green when it is ticked
  assert.equal(k.text().trim(), "How much to show Show how answers are worked out Show every box in forms On this phone only; your plan stays the same.");
  assert.equal(k.boxes().every((b) => b.closest("label")?.getAttribute("class") === "toggle-row"), true, "each tick is a full-width row with its words as the label");
  assert.equal(disk.size, 0);
});

test("How much to show: a tick acts at once, says so in green under the ticks, is undone by the same tick, and never writes the plan", async () => {
  const more = await fresh();
  const k = await cardKit();
  const said = [];
  more.detail.init({ setMoreOpen: (on) => said.push(on) });   // the shell's kit (core/app.js: detail.init(ui))
  k.tick("show-working", true);
  assert.equal(more.detail.working, true);
  assert.deepEqual(JSON.parse(disk.get("planner.more")), { fmt: 1, working: 1, parts: {} }, "on this phone, in planner.more");
  assert.match(k.text(), /Done\. "How this is worked out" now starts open on this phone\./);
  assert.ok(k.host.querySelector(".notice.ok"), "a green line");
  assert.equal(k.boxes()[0].checked, true, "drawn again ticked");
  k.tick("show-boxes", true);
  assert.deepEqual(said, [false, true], "the forms tick goes to the kit at once (ui.setMoreOpen)");
  assert.match(k.text(), /Done\. Most forms on this phone now start with "More details \(optional\)" open\./);
  k.tick("show-working", false);
  assert.match(k.text(), /Done\. Pages on this phone open short again\./);
  k.tick("show-boxes", false);
  assert.deepEqual(said, [false, true, false]);
  assert.match(k.text(), /Done\. Forms on this phone open short again\./);
  assert.equal(disk.has("planner.more"), false, "both off: the key goes");
  assert.deepEqual(k.writes, [], "the plan was never written");
});

test("How much to show: the rows a person opened are counted, with Shut them all; Erase the copy on this device forgets everything", async () => {
  const more = await fresh();
  more.kept.set("taxes/federal", "how", true, false);
  more.kept.set("retirement/rmd", "how", true, false);
  const k = await cardKit();
  assert.match(k.text(), /2 rows you opened stay open on this phone\. Each shuts by itself if its page goes 90 days without a visit\./);
  const shut = k.host.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Shut them all");
  assert.match(shut.getAttribute("class") ?? "", /secondary/, "outlined: the page's one filled button stays Plan basics' Save");
  shut.click();
  assert.equal(more.kept.count(), 0);
  assert.match(k.text(), /Done\. Those rows start shut again\./);
  assert.ok(!/rows? you opened/.test(k.text()));
  assert.equal(k.show.keptWords(1), "1 row you opened stays open on this phone. Each shuts by itself if its page goes 90 days without a visit.");
  // Erase the copy on this device: both ticks and every row kept open go (the view calls it before the plan goes)
  more.detail.set({ working: true, boxes: true });
  more.kept.set("retirement/rmd", "how", true, false);
  assert.ok(disk.has("planner.more"));
  k.show.forgetShown();
  assert.equal(disk.has("planner.more"), false);
  assert.deepEqual(more.detail.chosen, { working: false, boxes: false });
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.match(view, /forgetShown\(\);[^\n]*\n\s*store\.eraseDevice\(\); location\.reload\(\);/, "Erase forgets how much to show, then the plan");
});

test("How much to show is the second card, after Plan basics; Settings draws it on every plan", async () => {
  await fresh();
  const { draw } = await import("../../../qa/first-view-lib.mjs");
  for (const who of ["empty", "family"]) {
    const d = await draw("system/settings", who);
    assert.equal(d.error, null, d.error);
    const cards = d.root.children.filter((e) => e.tagName === "SECTION" || e.tagName === "DETAILS").map((e) => (e.querySelector("h2")?.textContent ?? "").trim());
    assert.deepEqual(cards.slice(0, 5), ["Plan basics", "How much to show", "Screen", "Pages", "Your data"], `${who}: ${cards.join(" | ")}`);
  }
});

test("the card's words are true: the first tick opens every How this is worked out and the N more rows drawn by the helper, never items or own parts; the second opens a form's More details (optional)", async () => {
  const more = await fresh();
  const { draw } = await import("../../../qa/first-view-lib.mjs");
  const states = (root) => root.all().filter((e) => e.tagName === "DETAILS" && e.dataset?.part !== undefined).map((e) => [e.dataset.kind, e.hasAttribute("open")]);
  const pages = ["retirement/rmd", "retirement/roth-conversions", "retirement/withdrawal-strategy", "retirement/monte-carlo", "debt/payoff", "debt/ratios", "taxes/estimated"];
  const seen = { how: 0, more: 0, other: 0 };
  for (const key of pages) {
    more.detail.set({ working: false });
    const off = await draw(key, "retiredCouple");
    assert.ok(states(off.root).every(([kind, open]) => !open || !["how", "more"].includes(kind)), `${key}: shut while the tick is off`);
    more.detail.set({ working: true });
    const on = await draw(key, "retiredCouple");
    const was = states(off.root);
    assert.equal(states(on.root).length, was.length, `${key}: the same parts either way`);
    states(on.root).forEach(([kind, open], i) => {
      if (kind === "how" || kind === "more") { assert.equal(open, true, `${key}: a ${kind} part starts open with the tick`); seen[kind]++; }
      // an item or a part with boxes is drawn as the page draws it (open only for the page's own reason), tick or not
      else if (kind !== "links") { assert.equal(open, was[i][1], `${key}: a ${kind} part does not move with the tick`); seen.other++; }
    });
  }
  more.detail.set({ working: false });
  assert.ok(seen.how >= 5 && seen.more >= 2 && seen.other >= 2, JSON.stringify(seen));
  // the forms tick: a form drawn by the kit opens its "More details (optional)" (Notes on Digital accounts)
  const lines = (root) => root.all().filter((e) => e.tagName === "DETAILS" && /form-more/.test(e.getAttribute("class") ?? "")).map((e) => e.hasAttribute("open"));
  assert.deepEqual(lines((await draw("estate/digital", "empty")).root), [false]);
  assert.deepEqual(lines((await draw("estate/digital", "empty", { boxes: true })).root), [true]);
});

test("the forms tick's green line and Help say most, not every, while some forms' More details (optional) are still drawn by hand; every How this is worked out already is a part", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const mods = new URL("../../", import.meta.url);
  const views = [];
  for (const g of fs.readdirSync(mods, { withFileTypes: true })) if (g.isDirectory()) for (const m of fs.readdirSync(new URL(`${g.name}/`, mods), { withFileTypes: true })) {
    const f = new URL(`${g.name}/${m.name}/view.js`, mods);
    if (m.isDirectory() && fs.existsSync(f)) views.push([`${g.name}/${m.name}`, fs.readFileSync(f, "utf8")]);
  }
  const by = (re) => views.filter(([, src]) => re.test(src)).map(([k]) => k).sort();
  assert.deepEqual(by(/"summary"[^\n]{0,160}How this is (worked out|done)/), [], "a hand-written \"How this is worked out\": the first tick would not open it, so its words would be untrue");
  const handForms = by(/("summary"[^\n]{0,120}"More details \(optional\)|title: "More details \(optional\)")/);
  assert.ok(handForms.length > 0, `no form draws its own "More details (optional)" any more: say "Forms on this phone now show every box" in show.js (and "every form" in Help)`);
  // what "most" stands for today (the comment in show.js names them)
  for (const k of ["goals/goals", "overview/quick"]) assert.ok(handForms.includes(k), `${k}: ${handForms.join(", ")}`);
  const { WORDS } = await import("./show.js");
  assert.match(WORDS.boxesOn, /^Done\. Most forms /);
  void path;
});

test("the shell hands the kit to the switches before every page draws (core/app.js: detail.init(ui) in show(), before the page's render), so a saved forms tick opens forms on the next visit", async () => {
  // core/app.js needs a browser, so its source is read: without this one line a person's saved "Show every box in forms"
  // would still show ticked here and say "Done", but no form would open its "More details (optional)" (review of opt C7)
  const fs = await import("node:fs");
  const app = fs.readFileSync(new URL("../../../core/app.js", import.meta.url), "utf8");
  assert.match(app, /^import \{[^}\n]*\bdetail\b[^}\n]*\} from "\.\/ui\/more\.js";$/m, "core/app.js imports detail from core/ui/more.js");
  const start = app.indexOf("async function show(");
  assert.ok(start >= 0, "core/app.js has show()");
  const body = app.slice(start, app.indexOf("\n}\n", start));
  const call = body.search(/^ +detail\.init\(ui\);/m);
  assert.ok(call >= 0, "show() calls detail.init(ui) as a statement of its own (not commented out, not behind an if)");
  const draws = body.indexOf("m.render(page, ctx)");
  assert.ok(draws >= 0, "show() draws the page with m.render(page, ctx)");
  assert.ok(call < draws, "detail.init(ui) runs before the page draws");
  assert.ok(call > body.indexOf("ui.setMoneySign("), "beside ui.setMoneySign, after the last page is cleaned up");
  // and what that call does: the kit learns the saved tick (the rest of the chain: tests/more.test.mjs, the card tests above)
  const more = await fresh();
  more.detail.set({ boxes: true });
  const told = [];
  more.detail.init({ setMoreOpen: (on) => told.push(on) });
  assert.deepEqual(told, [true], "a saved forms tick reaches the kit at the call");
  more.detail.set({ boxes: false });
});

// ---- Screen (gap design 8; looks.js, core/look.js) ----------------------------------------------------------------
async function lookKit() {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const looks = await import("./looks.js");
  const core = await import("../../../core/look.js");
  disk.clear(); core._test.reset();
  const host = new FakeElement("main");
  const writes = [];
  const ctx = { ui, module: { group: "system", id: "settings" }, route: { group: "system", id: "settings", query: {} }, store: { update: () => writes.push("update"), get: () => ({}) }, redraw: () => { host.replaceChildren(looks.lookCard(ctx)); } };
  host.append(looks.lookCard(ctx));
  const row = () => host.all().find((e) => e.tagName === "DETAILS");
  const box = (name) => host.all().find((e) => e.tagName === "INPUT" && e.getAttribute("name") === name);
  const tick = (name, on) => { const b = box(name); b.checked = on; b.dispatch("change"); };
  return { host, ctx, looks, core, writes, row, box, tick, text: () => textOf(host).replace(/\s+/g, " ").trim(), summary: () => textOf(row().querySelector("summary")).replace(/\s+/g, " ").trim() };
}

test("Screen: one shut row that says nothing while the phone looks as it always did; nothing is stored", async () => {
  const k = await lookKit();
  assert.equal(k.row().getAttribute("class"), "card fold fold-card", "a folded card, like Settings' other folded cards");
  assert.equal(k.row().dataset.part, undefined, "not a part: one part would make the first-view check refuse Settings' own folds (looks.js says why)");
  assert.equal(k.row().hasAttribute("open"), false, "shut: Settings' first view gains only the row's name");
  assert.equal(k.row().querySelector("h2").textContent, "Screen");
  assert.equal(k.row().querySelector(".fold-status"), null, "no status while nothing is changed");
  assert.equal(k.box("look-hide").checked, false);
  assert.equal(disk.size, 0);
  assert.equal(k.looks.saysOf({}), ""); assert.equal(k.looks.saysOf({ hide: true }), "amounts hidden");
  assert.ok(k.looks.saysOf({ hide: true }).length <= 20, "one line beside the title at 320 px");
});

test("Screen: the tick hides amounts at once, says so in green, keeps the row open, is undone by the same tick, and never writes the plan", async () => {
  const k = await lookKit();
  const fmt = await import("../../../core/format.js");
  k.tick("look-hide", true);
  assert.deepEqual(JSON.parse(disk.get("planner.look")), { fmt: 1, hide: 1 }, "on this phone, in planner.look");
  assert.equal(fmt.hidden(), true);
  assert.match(k.text(), /Done\. Amounts on this phone now read as dots\. "Show amounts" in the menu brings them back\./);
  assert.ok(k.host.querySelector(".notice.ok"), "a green line");
  assert.equal(k.row().hasAttribute("open"), true, "the row stays open on the draw after the tick");
  assert.equal(k.box("look-hide").checked, true, "drawn again ticked");
  assert.match(k.summary(), /^Screen amounts hidden/, "the shut row says what is changed");
  assert.match(k.text(), /Boxes you type in still show their figure, and so does anything you print\./, "the printout is said here");
  assert.match(k.text(), /On this phone only; your plan stays the same\./);
  k.tick("look-hide", false);
  assert.match(k.text(), /Done\. Amounts show again\./);
  assert.equal(disk.has("planner.look"), false, "undone: the key goes");
  assert.equal(fmt.hidden(), false);
  assert.deepEqual(k.writes, [], "the plan was never written");
  // the draw after that one (a page change, a reload): shut again, nothing said
  k.ctx.redraw();
  assert.equal(k.row().hasAttribute("open"), false);
  assert.equal(k.host.querySelector(".notice.ok"), null);
});

test("Erase the copy on this device shows the amounts again, before the plan goes", async () => {
  const k = await lookKit();
  k.core.look.set({ hide: true });
  k.looks.forgetLook();
  assert.equal(disk.has("planner.look"), false);
  assert.equal(k.core.look.chosen.hide, false);
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.match(view, /forgetLook\(\);[^\n]*\n\s*forgetShown\(\);[^\n]*\n\s*store\.eraseDevice\(\); location\.reload\(\);/);
});
