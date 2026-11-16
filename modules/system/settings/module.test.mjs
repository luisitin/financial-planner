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
  for (const k of ["overview/quick"]) assert.ok(handForms.includes(k), `${k}: ${handForms.join(", ")}`);   // (Goals' form uses the kit's since 2026-11-15)
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
  // what the shut row says, case by case
  const says = k.looks.saysOf;
  assert.equal(says({}), ""); assert.equal(says({ hide: true }), "amounts hidden");
  assert.equal(says({ text: "larger" }), "larger text"); assert.equal(says({ text: "largest" }), "largest text");
  assert.equal(says({ theme: "light" }), "light"); assert.equal(says({ theme: "dark" }), "dark");
  // several: each in its own words (a count, "3 changed", told the person nothing)
  assert.equal(says({ hide: true, theme: "dark" }), "amounts hidden, dark"); assert.equal(says({ hide: true, text: "larger", theme: "light" }), "amounts hidden, larger text, light");
  assert.equal(says({ text: "largest", theme: "dark" }), "largest text, dark");
  for (const hide of [false, true]) for (const text of ["usual", "larger", "largest"]) for (const theme of ["phone", "light", "dark"]) assert.doesNotMatch(says({ hide, text, theme }), /\d|changed/, "words, never a count");
  assert.equal(says({ hide: false, text: "usual", theme: "phone" }), "");
  for (const x of [{ hide: true }, { text: "largest" }, { theme: "light" }, { hide: true, theme: "dark" }]) assert.ok(says(x).length <= 20, "one line beside the title at 320 px");
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

test("Screen: Text size and Light or dark are three chips each, the first one on; a chip acts at once, says so in green, keeps the row open and never writes the plan", async () => {
  const k = await lookKit();
  const chips = (id) => k.host.all().find((e) => e.dataset?.choice === id).all().filter((e) => e.tagName === "BUTTON");
  const read = (id) => chips(id).map((b) => [b.textContent, b.getAttribute("aria-pressed")]);
  assert.deepEqual(read("look-text"), [["Usual", "true"], ["Larger", "false"], ["Largest", "false"]]);
  assert.deepEqual(read("look-theme"), [["Like the phone", "true"], ["Light", "false"], ["Dark", "false"]]);
  assert.ok(chips("look-text").concat(chips("look-theme")).every((b) => /\bchip\b/.test(b.getAttribute("class"))), "chips, not buttons: the page's one filled button stays Plan basics' Save");
  assert.match(k.text(), /Text size Usual Larger Largest Light or dark Like the phone Light Dark/);
  assert.equal(k.host.all().filter((e) => e.tagName === "INPUT").length, 1, "no box to type in: the tick only");
  const tap = (id, name) => chips(id).find((b) => b.textContent === name).click();
  const said = { text: { Larger: "Done. Text is now larger on this phone.", Largest: "Done. Text is now at its largest on this phone.", Usual: "Done. Text is back to its usual size." },
    theme: { Light: "Done. The app now stays light on this phone.", Dark: "Done. The app now stays dark on this phone.", "Like the phone": "Done. Light or dark now follows the phone's own setting." } };
  for (const [name, value] of [["Larger", "larger"], ["Largest", "largest"], ["Usual", "usual"]]) {
    tap("look-text", name);
    assert.equal(k.core.look.chosen.text, value);
    assert.ok(k.text().includes(said.text[name]), `${name}: ${k.text()}`);
    assert.equal(k.row().hasAttribute("open"), true);
    assert.equal(read("look-text").find(([, on]) => on === "true")[0], name, "the chip that is on follows");
  }
  for (const [name, value] of [["Light", "light"], ["Dark", "dark"], ["Like the phone", "phone"]]) {
    tap("look-theme", name);
    assert.equal(k.core.look.chosen.theme, value);
    assert.ok(k.text().includes(said.theme[name]), `${name}: ${k.text()}`);
    assert.equal(k.host.all().filter((e) => /\bnotice\b/.test(e.getAttribute?.("class") ?? "")).length, 1, "one green line, the latest");
  }
  assert.equal(disk.has("planner.look"), false, "back to the first chips: nothing is stored");
  tap("look-text", "Usual");                                        // the chip already on does nothing
  assert.equal(disk.size, 0);
  tap("look-text", "Largest"); tap("look-theme", "Dark");
  assert.deepEqual(JSON.parse(disk.get("planner.look")), { fmt: 1, text: "largest", theme: "dark" });
  assert.match(k.summary(), /^Screen largest text, dark/);
  // the green line is drawn right under what was tapped (read where the finger is: the shell then has no reason to say
  // it a second time at the bottom of the screen), before the next thing in the row
  const order = () => k.text();
  assert.match(order(), /Light Dark Done\. The app now stays dark on this phone\. On this phone only/, "under the Light or dark chips");
  tap("look-text", "Larger");
  assert.match(order(), /Usual Larger Largest Done\. Text is now larger on this phone\. Light or dark/, "under the Text size chips");
  k.tick("look-hide", true);
  assert.match(order(), /Hide amounts on screen Done\. Amounts on this phone now read as dots\.[^.]*\. Every amount reads as dots/, "under the tick");
  assert.equal(k.host.all().filter((e) => /\bnotice\b/.test(e.getAttribute?.("class") ?? "")).length, 1, "one green line");
  k.tick("look-hide", false); tap("look-text", "Largest");
  assert.deepEqual(k.writes, [], "the plan was never written");
  k.looks.forgetLook();
  assert.deepEqual(k.core.look.chosen, { hide: false, text: "usual", theme: "phone" }, "Erase the copy on this device");
});

// ---- How the helper talks to you (gap list next 60, item 58; X8; talk.js, ai/assistant/tone.js) -----------------------------
async function talkKit({ build = false, ai = false, off = [] } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const talk = await import("./talk.js");
  const { tone } = await import("../../ai/assistant/tone.js");
  const { offered } = await import("../../../core/view.js");
  disk.clear(); tone._reset();
  const modules = new Map();
  for (const k of ["ai/assistant", "ai/explain", "system/settings"]) modules.set(k, (await import(`../../${k}/module.js`)).default);
  const host = new FakeElement("main");
  const writes = [];
  const ctx = { ui, modules, module: { group: "system", id: "settings" }, route: { group: "system", id: "settings", query: {} },
    view: { build }, live: { pc: ai, ai }, shown: (m) => offered(m, { build, pc: ai, ai }),
    features: { enabled: (m) => !off.includes(`${m.group}/${m.id}`) },
    store: { update: () => writes.push("update"), get: () => ({}) }, redraw: () => { host.replaceChildren(...[talk.talkCard(ctx)].filter(Boolean)); } };
  ctx.redraw();
  const row = () => host.all().find((e) => e.tagName === "DETAILS") ?? null;
  const chips = () => host.all().find((e) => e.dataset?.choice === "talk-tone")?.all().filter((e) => e.tagName === "BUTTON") ?? [];
  const tap = (name) => chips().find((b) => b.textContent === name).click();
  return { host, ctx, talk, tone, writes, row, chips, tap, text: () => textOf(host).replace(/\s+/g, " ").trim(), summary: () => textOf(row().querySelector("summary")).replace(/\s+/g, " ").trim() };
}

test("How the helper talks to you: no row while no page that talks is offered (no helper, the household's view), so Settings' first view is as it was", async () => {
  assert.equal((await talkKit()).row(), null, "no helper answering, the household's view: nothing");
  assert.equal((await talkKit({ ai: true, off: ["ai/assistant", "ai/explain"] })).row(), null, "both pages switched off on this device: nothing");
  assert.ok((await talkKit({ ai: true, off: ["ai/assistant"] })).row(), "Explain a page alone still talks");
  assert.ok((await talkKit({ build: true })).row(), "the build view shows every page, and the row");
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.indexOf("lookCard(ctx)") < view.indexOf("talkCard(ctx)") && view.indexOf("talkCard(ctx)") < view.indexOf('ui.card("Pages"'), "after Screen, before Pages: Settings' order kept");
});

test("How the helper talks to you: one shut row, Plain on and nothing said while Plain; three chips, one example each on the same finding", async () => {
  const k = await talkKit({ ai: true });
  assert.equal(k.row().getAttribute("class"), "card fold fold-card", "a folded card, like Settings' other folded cards");
  assert.equal(k.row().dataset.part, undefined, "not a part (looks.js says why)");
  assert.equal(k.row().hasAttribute("open"), false, "shut");
  assert.equal(k.row().querySelector("h2").textContent, "How the helper talks to you");
  assert.equal(k.row().querySelector(".fold-status"), null, "Plain: nothing said");
  assert.deepEqual(k.chips().map((b) => [b.textContent, b.getAttribute("aria-pressed")]), [["Gentle", "false"], ["Plain", "true"], ["Blunt", "false"]]);
  assert.ok(k.chips().every((b) => /\bchip\b/.test(b.getAttribute("class"))), "chips: the page's one filled button stays Plan basics' Save");
  assert.equal(k.host.all().filter((e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName)).length, 0, "no box");
  assert.equal(k.text(), "How the helper talks to you › For the helper that answers your questions and explains pages. Only the words change: the figures still come from your plan. Gentle Plain Blunt"
    + " For example, when eating out went over the budget: Gentle: “Eating out came to $460 this month, a little over the $400 you planned. A quieter week or two would bring it back.”"
    + " Plain: “Eating out came to $460 this month, $60 over the $400 you planned.”"
    + " Blunt: “You spent $60 more on eating out than you planned. Cut back for the rest of the month.”"
    + " On this phone only; your plan stays the same.");
  // the same finding in each: $460 spent, $400 planned, $60 over
  const ex = k.talk.TALK_WORDS.examples;
  assert.match(ex.gentle, /\$460.*\$400/); assert.match(ex.plain, /\$460.*\$60.*\$400/); assert.match(ex.blunt, /\$60/);
  assert.equal(disk.size, 0, "nothing stored on a new phone");
  assert.equal(k.talk.saysOf("plain"), ""); assert.equal(k.talk.saysOf("gentle"), "talks gently"); assert.equal(k.talk.saysOf("blunt"), "talks bluntly"); assert.equal(k.talk.saysOf("loud"), "");
});

test("How the helper talks to you: a chip acts at once on this phone, says so in green under the chips, keeps the row open, never writes the plan; Plain removes the key", async () => {
  const k = await talkKit({ ai: true });
  const said = { Gentle: "Done. The helper now talks to you gently.", Blunt: "Done. The helper now talks to you bluntly.", Plain: "Done. The helper talks to you plainly again." };
  for (const [name, value] of [["Gentle", "gentle"], ["Blunt", "blunt"], ["Plain", "plain"]]) {
    k.tap(name);
    assert.equal(k.tone.chosen, value);
    assert.match(k.text(), new RegExp(`Gentle Plain Blunt ${said[name].replace(/\./g, "\\.")} For example`), `${name}: under the chips`);
    assert.equal(k.host.all().filter((e) => /\bnotice\b/.test(e.getAttribute?.("class") ?? "")).length, 1, "one green line");
    assert.equal(k.row().hasAttribute("open"), true, "the row stays open on the draw after the tap");
    assert.equal(k.chips().find((b) => b.getAttribute("aria-pressed") === "true").textContent, name);
    if (value === "plain") assert.equal(disk.has("planner.tone"), false, "Plain: nothing stored");
    else { assert.deepEqual(JSON.parse(disk.get("planner.tone")), { fmt: 1, tone: value }); assert.match(k.summary(), new RegExp(`^How the helper talks to you talks ${value === "gentle" ? "gently" : "bluntly"} ›$`), "shut, it says what it describes"); }
  }
  k.tap("Plain");   // the chip already on does nothing
  assert.equal(disk.size, 0);
  assert.deepEqual(k.writes, [], "the plan was never written");
  // the next draw (a page change, a reload): shut, nothing said; the device still remembers
  k.tap("Blunt"); k.ctx.redraw();
  assert.equal(k.row().hasAttribute("open"), false); assert.equal(k.host.querySelector(".notice.ok"), null);
  k.tone._reset(); assert.equal(k.tone.chosen, "blunt", "read back from this phone's storage");
  k.talk.forgetTalk();
  assert.equal(disk.has("planner.tone"), false); assert.equal(k.tone.chosen, "plain", "Erase the copy on this device: Plain again");
  const fs = await import("node:fs");
  assert.match(fs.readFileSync(new URL("./view.js", import.meta.url), "utf8"), /forgetTalk\(\);[^\n]*\n\s*forgetLook\(\);[^\n]*\n\s*forgetShown\(\);/, "Erase forgets the tone with the rest of this phone's choices");
});

test("How the helper talks to you: what this phone stores is read with care (another format or a broken value is Plain)", async () => {
  const k = await talkKit({ ai: true });
  for (const raw of ["{", "null", "[]", '"blunt"', '{"tone":"blunt"}', '{"fmt":2,"tone":"blunt"}', '{"fmt":1,"tone":"shout"}']) {
    disk.set("planner.tone", raw); k.tone._reset();
    assert.equal(k.tone.chosen, "plain", raw);
  }
  disk.set("planner.tone", '{"fmt":1,"tone":"gentle"}'); k.tone._reset();
  assert.equal(k.tone.chosen, "gentle");
  const { TONE_KEY } = await import("../../ai/assistant/tone.js");
  assert.equal(TONE_KEY, "planner.tone", "planner.tone.sandbox in the sandbox (?sandbox in the address)");
});
