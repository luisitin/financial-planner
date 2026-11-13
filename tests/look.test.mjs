// tests/look.test.mjs -- how this phone looks (core/look.js, core/format.js maskAmounts; gap design 8): amounts hidden on
// screen is a choice of the phone, never of the plan. `npm test` runs it; nothing here needs a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as fmt from "../core/format.js";
import { migrate, emptyPlan } from "../core/schema/migrate.js";

// A phone's storage (Node has none; core/look.js reads it lazily).
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };
const L = await import("../core/look.js");
const fresh = () => { disk.clear(); L._test.reset(); return L.look; };
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

// ---------------------------------------------------------------- the words with the amounts as dots (pure)
test("maskAmounts: every money amount reads as dots, the sign and the currency stay; percentages, dates and counts stay", () => {
  const cases = [
    ["$1,234", "$•••"], ["€12.50", "€•••"], ["$2.4M", "$•••"], ["$450k", "$•••"], ["$1.2 million", "$•••"], ["$0", "$•••"],
    ["-$1,234 and +$50.", "-$••• and +$•••."],                                          // the sign is kept, the full stop too
    ["You owe $1,234.56, due 2026-04-15 (7.25%).", "You owe $•••, due 2026-04-15 (7.25%)."],
    ["$1,000-$2,000", "$•••-$•••"], ["$500-900 a month", "$••• a month"], ["$1,000–2,000", "$•••"],
    ["MX$1,234.50", "MX$•••"], ["CA$5", "CA$•••"], ["USD 1,234", "USD •••"], ["-GBP 1,234,568", "-GBP •••"],
    ["1234,50 US$", "••• US$"], ["-1.234.568 MXN", "-••• MXN"], ["1.234,50 €", "••• €"],
    ["$412,​100", "$•••"],                                                         // a tile's figure, with its wrap point (ui.stat)
    ["3 $10 fees", "3 $••• fees"],
    // forms the app does not write itself but a hand-written sentence could (the sign after the currency sign, a code
    // tight against the figure, thousands set off by a space or an apostrophe, a few more currency codes)
    ["$-50", "$-•••"], ["USD1,234", "USD•••"], ["$ 1 234", "$ •••"], ["$1'234", "$•••"], ["CHF 500", "CHF •••"], ["1 234,50 €", "••• €"],
    ["$500 in 2026", "$••• in 2026"], ["$500 2026", "$••• 2026"], ["pay $5 3 days", "pay $••• 3 days"],
  ];
  for (const [said, dots] of cases) assert.equal(fmt.maskAmounts(said), dots, said);
  for (const same of ["2026", "45%", "7.25%", "11/13/2026", "2026-04-15", "age 67", "3 years 2 months", "401k", "1,234 steps", "80 of 100", "", "$•••", "$ a month"]) assert.equal(fmt.maskAmounts(same), same, same);
  assert.equal(fmt.maskAmounts(null), "");
});

test("an amount written by money() or signed() is fully covered in every currency and number format Settings offers", () => {
  for (const locale of ["en-US", "es-MX", "es-ES"]) for (const currency of ["USD", "EUR", "MXN", "GBP", "CAD"]) {
    for (const n of [0, 7, 950, 1234.5, -48250, 1234567, 12345678.91]) for (const digits of [0, 2]) {
      const said = fmt.money(n, currency, locale, digits), dots = fmt.maskAmounts(said);
      assert.doesNotMatch(dots, /\d/, `${locale} ${currency} ${said} -> ${dots}`);
      assert.match(dots, /•••/);
      assert.equal(dots.startsWith("-"), said.startsWith("-"), `the minus stays: ${said} -> ${dots}`);
    }
  }
  assert.equal(fmt.maskAmounts(fmt.signed(-320)), "-$•••");
  assert.equal(fmt.maskAmounts(fmt.signed(320)), "+$•••");
});

test("a chart's side figures (418k, 1.3M) read as dots; years, ages and percentages on a chart stay", () => {
  for (const [said, dots] of [["418k", "•••"], ["1.3M", "•••"], ["-25k", "-•••"], ["1,200k", "•••"], [" 10k ", " ••• "]]) assert.equal(fmt.maskAxisLabel(said), dots);
  for (const same of ["2040", "45%", "Age 67", "0", "500", "401k plan", "Jan", ""]) assert.equal(fmt.maskAxisLabel(same), same);
});

test("pct(), dates and plain numbers are never masked", () => {
  for (const x of [0, 0.0725, 0.5, 1, -0.031]) assert.equal(fmt.maskAmounts(fmt.pct(x)), fmt.pct(x));
  assert.equal(fmt.maskAmounts(fmt.date("2026-09-15")), fmt.date("2026-09-15"));
  assert.equal(fmt.maskAmounts(fmt.num(1234567)), "1,234,567");
  assert.equal(fmt.maskAmounts(fmt.monthsWords(6)), "6 months");
});

test("money() and signed() write the amount whatever the phone hides: the helper's questions, downloads and printouts use them", () => {
  assert.equal(fmt.hidden(), false, "off unless something turns it on");
  const before = [fmt.money(1234.5), fmt.money(-20, "EUR", "es-ES", 2), fmt.signed(-5), fmt.amountText(380000)];
  fmt.setHidden(true);
  try {
    assert.equal(fmt.hidden(), true);
    assert.deepEqual([fmt.money(1234.5), fmt.money(-20, "EUR", "es-ES", 2), fmt.signed(-5), fmt.amountText(380000)], before);
  } finally { fmt.setHidden(false); }
});

// ---------------------------------------------------------------- the choice, on this phone only
test("nothing is stored until the person asks; hiding is one key on this phone and goes when it is undone", () => {
  const look = fresh();
  assert.deepEqual({ hide: look.chosen.hide }, { hide: false });
  assert.equal(disk.size, 0);
  look.set({ hide: true });
  assert.deepEqual(JSON.parse(disk.get("planner.look")), { fmt: 1, hide: 1 });
  assert.equal(fmt.hidden(), true, "pages can ask core/format.js hidden()");
  L._test.reset();
  assert.equal(L.look.chosen.hide, true, "read back on the next visit");
  L.look.set({ hide: false });
  assert.equal(disk.has("planner.look"), false, "undone: the key goes");
  assert.equal(fmt.hidden(), false);
  // a key that is not ours reads as nothing stored
  disk.set("planner.look", "{\"fmt\":2,\"hide\":1}"); L._test.reset();
  assert.equal(L.look.chosen.hide, false);
  disk.set("planner.look", "not json"); L._test.reset();
  assert.equal(L.look.chosen.hide, false);
  // Erase the copy on this device
  L.look.set({ hide: true }); L.look.forget();
  assert.equal(disk.has("planner.look"), false);
  assert.equal(L.look.chosen.hide, false);
});

test("the sandbox keeps its own key, so a test run never hides the amounts on the owner's phone", async () => {
  fresh();
  globalThis.location = { search: "?sandbox=1", hash: "" };
  const S = await import("../core/look.js?sandbox");
  delete globalThis.location;
  assert.equal(S.LOOK_KEY, "planner.look.sandbox"); assert.equal(L.LOOK_KEY, "planner.look");
  S.look.set({ hide: true });
  assert.deepEqual([...disk.keys()], ["planner.look.sandbox"]);
  assert.equal(L.look.chosen.hide, false);
  S.look.set({ hide: false });
});

test("?look=hide in the address hides for the visit only and stores nothing", () => {
  const look = fresh();
  globalThis.location = { search: "?sandbox=1&look=hide", hash: "" };
  try { assert.equal(look.now.hide, true); assert.equal(look.chosen.hide, false); } finally { delete globalThis.location; }
  assert.equal(look.now.hide, false);
  assert.equal(disk.size, 0);
});

test("the plan's bytes are identical after hiding and showing again, and the key is never in a downloaded copy", async () => {
  const look = fresh();
  const { familyPlan } = await import("../qa/fixtures/family-plan.mjs");
  for (const make of [() => migrate(emptyPlan()), () => migrate(structuredClone(familyPlan("2026-11-13")))]) {
    const plan = make(), before = JSON.stringify(plan, null, 2);
    look.set({ hide: true });
    const copy = JSON.stringify(plan, null, 2);          // what Settings' "Download a copy" writes
    assert.equal(copy, before);
    assert.doesNotMatch(copy, /planner\.look|"hide"|"look"/);
    look.set({ hide: false });
    assert.equal(JSON.stringify(plan, null, 2), before);
  }
  assert.match(read("../modules/system/settings/view.js"), /new Blob\(\[JSON\.stringify\(plan, null, 2\)\]/, "the download is the plan and nothing else");
  assert.doesNotMatch(read("../core/store.js"), /planner\.look|look\.js/, "the store never reads or sends the look");
  assert.doesNotMatch(read("../server/server.mjs"), /planner\.look/);
});

test("with amounts hidden every page's compute() gives byte-identical output (the hiding is on the screen, never in the sums)", async () => {
  const look = fresh();
  const registry = (await import("../modules/registry.js")).default;
  const { familyPlan } = await import("../qa/fixtures/family-plan.mjs");
  const { retiredCouplePlan } = await import("../qa/fixtures/retired-couple-plan.mjs");
  const { renterDebtPlan } = await import("../qa/fixtures/renter-debt-plan.mjs");
  const plans = { empty: migrate(emptyPlan()), family: migrate(structuredClone(familyPlan("2026-11-13"))), retiredCouple: migrate(structuredClone(retiredCouplePlan())), renterDebt: migrate(structuredClone(renterDebtPlan())) };
  const { ARCHETYPES } = await import("../qa/households/lib/catalog.mjs");
  for (const a of ARCHETYPES) plans[a.id] = migrate(structuredClone(a.build()));
  let n = 0;
  for (const e of registry) {
    const m = (await e.load()).default;
    if (m.status === "planned" || m.placeholder || m.heavy || typeof m.compute !== "function") continue;
    for (const [who, plan] of Object.entries(plans)) {
      const run = () => { try { return JSON.stringify(m.compute(structuredClone(plan))); } catch (err) { return `threw ${err.message}`; } };
      const shown = run();
      look.set({ hide: true });
      const hiddenOut = run();
      look.set({ hide: false });
      assert.equal(hiddenOut, shown, `${e.group}/${e.id} for ${who}`);
      n++;
    }
  }
  assert.ok(n > 1000, `${n} sums compared`);
});

// ---------------------------------------------------------------- the screen: text is covered, boxes are not
// A stand-in for the few DOM calls the pass makes (text nodes, parents, a tree walker).
function tree() {
  const doc = { nodeType: 9, createTreeWalker(root) { const all = []; const walk = (n) => { for (const c of n.childNodes ?? []) { if (c.nodeType === 3) all.push(c); else walk(c); } }; walk(root); let i = -1; return { nextNode: () => all[++i] ?? null }; } };
  const below = (e) => e.childNodes.filter((c) => c.nodeType === 1).flatMap((c) => [c, ...below(c)]);
  const el = (tagName, ...kids) => {
    const e = { nodeType: 1, tagName, childNodes: [], ownerDocument: doc, parentNode: null, attrs: {},
      getAttribute(n) { return n in e.attrs ? e.attrs[n] : null; }, setAttribute(n, v) { e.attrs[n] = String(v); },
      querySelectorAll(sel) { const names = [...sel.matchAll(/\[([\w-]+)\]/g)].map((m) => m[1]); return below(e).filter((x) => names.some((n) => n in x.attrs)); } };
    for (const k of kids) {
      if (k && typeof k === "object" && !k.nodeType) { Object.assign(e.attrs, k); continue; }   // a plain object: attributes
      const c = typeof k === "string" ? { nodeType: 3, nodeValue: k, ownerDocument: doc } : k; c.parentNode = e; e.childNodes.push(c);
    }
    return e;
  };
  return { el };
}
const texts = (root) => root.childNodes.flatMap((c) => (c.nodeType === 3 ? [c.nodeValue] : texts(c)));

test("the pass over the screen covers $1,234, €12.50 and $2.4M, leaves 2026 and 45%, skips the boxes, and puts everything back", () => {
  fresh();
  const { el } = tree();
  const body = el("BODY",
    el("DIV", "You own $1,234", el("SPAN", "€12.50"), "by 2026"),
    el("svg", el("text", "$2.4M"), el("text", "45%"), el("text", "418k"), el("text", "1.3M"), el("text", "2040"), el("tspan", "-25k")),
    el("P", "A 401k and 1.3M reasons"),
    el("SELECT", el("OPTION", "Savings ($5,000)")),
    el("TEXTAREA", "paid $40"),
    el("P", "Rent is 30% of pay; $1,​900 a month."));
  const before = texts(body);
  L.coverAll(body);
  assert.deepEqual(texts(body), ["You own $•••", "€•••", "by 2026", "$•••", "45%", "•••", "•••", "2040", "-•••", "A 401k and 1.3M reasons", "Savings ($5,000)", "paid $40", "Rent is 30% of pay; $••• a month."]);
  L.coverAll(body);                                              // a second pass changes nothing
  assert.equal(texts(body)[0], "You own $•••");
  // a page writes a new figure into a covered node: covered again from the new words
  body.childNodes[0].childNodes[0].nodeValue = "You own $9,999";
  L.coverAll(body);
  assert.equal(texts(body)[0], "You own $•••");
  L.uncoverAll(body);                                            // the hiding turned off, or a printout
  assert.deepEqual(texts(body), ["You own $9,999", ...before.slice(1)]);
});

test("what a screen reader says for a thing (aria-label, title) is covered too, follows a later change, and is put back", () => {
  fresh();
  const { el } = tree();
  const tile = el("A", { "aria-label": "Left over each month: $3,884. After tax, bills and saving. About $58,000 a year.", href: "#/cashflow/expenses?max=$9,999" }, "Left over");
  const hint = el("SPAN", { title: "your list may be missing about $1,220 a month", "aria-label": "45% of pay in 2026" }, "?");
  const box = el("INPUT", { "aria-label": "Balance, was $5,000", placeholder: "for example $500" });
  const body = el("BODY", { title: "Plan worth €12.50" }, el("DIV", tile, hint), box);
  L.coverAll(body);
  assert.equal(tile.attrs["aria-label"], "Left over each month: $•••. After tax, bills and saving. About $••• a year.");
  assert.equal(hint.attrs.title, "your list may be missing about $••• a month");
  assert.equal(hint.attrs["aria-label"], "45% of pay in 2026", "no amount: untouched");
  assert.equal(body.attrs.title, "Plan worth €•••", "the root itself too");
  assert.equal(box.attrs["aria-label"], "Balance, was $•••", "a box's name is words on screen, not what the person typed");
  assert.equal(box.attrs.placeholder, "for example $500", "the example inside a box stays");
  assert.equal(tile.attrs.href, "#/cashflow/expenses?max=$9,999", "only the spoken words: never an address");
  for (const a of L.SAID_ATTRS) assert.ok(["aria-label", "title", "aria-description", "aria-valuetext", "alt"].includes(a));
  L.coverAll(body);                                              // a second pass changes nothing
  assert.equal(hint.attrs.title, "your list may be missing about $••• a month");
  tile.attrs["aria-label"] = "Left over each month: $4,000.";    // the page writes a new figure
  L.coverAll(body);
  assert.equal(tile.attrs["aria-label"], "Left over each month: $•••.");
  L.uncoverAll(body);                                            // the hiding turned off, or a printout
  assert.equal(tile.attrs["aria-label"], "Left over each month: $4,000.");
  assert.equal(hint.attrs.title, "your list may be missing about $1,220 a month");
  assert.equal(body.attrs.title, "Plan worth €12.50");
  assert.equal(box.attrs["aria-label"], "Balance, was $5,000");
  // the pass that watches the screen is told when one of these words changes
  const src = read("../core/look.js");
  assert.match(src, /attributes: true, attributeFilter: \[\.\.\.SAID_ATTRS\]/);
  assert.match(src, /m\.type === "attributes"\) coverSaid\(m\.target, m\.attributeName\)/);
});

// ---------------------------------------------------------------- the words, and the shell's part
test("what the green line says, on and off", () => {
  assert.equal(L.HIDE_WORDS.on, "Done. Amounts on this phone now read as dots. \"Show amounts\" in the menu brings them back.");
  assert.equal(L.HIDE_WORDS.off, "Done. Amounts show again.");
  for (const w of Object.values(L.HIDE_WORDS)) assert.equal(fmt.maskAmounts(w), w, "the line itself is never covered");
});

test("the shell: the choice is in force before the first page draws, the menu's first row turns it on and off, and the paper shows amounts", () => {
  const app = read("../core/app.js");
  assert.match(app, /^import \{ look, HIDE_WORDS \} from "\.\/look\.js";$/m);
  assert.match(app, /^look\.start\(\);/m, "at the top of core/app.js, before boot() draws anything");
  assert.ok(app.indexOf("\nlook.start();") < app.indexOf("async function boot("), "before boot");
  const row = app.slice(app.indexOf("function hideRow("), app.indexOf("function markActive("));
  assert.match(row, /"Show amounts" : "Hide amounts"/);
  assert.match(row, /look\.set\(\{ hide: !on \}\)/);
  assert.match(row, /echo\(on \? HIDE_WORDS\.off : HIDE_WORDS\.on\)/, "it says so in green");
  assert.doesNotMatch(row, /store\.(update|replace)/, "never the plan");
  // the menu's first row, before "Start with" and the topics, so it is on the first screen of the menu on any phone (it
  // was the last row, under 18 topics: 1,433 px down on a 568 px screen); not among search results
  const nav = app.slice(app.indexOf("function buildNav("), app.indexOf("function hideRow("));
  assert.equal(nav.match(/hideRow\(\)/g)?.length, 1, "one row");
  assert.match(nav, /if \(!q\) \{\n\s+out\.push\(hideRow\(\)\);/, "only while nothing is searched for");
  assert.ok(nav.indexOf("out.push(hideRow())") < nav.indexOf('class: "nav-section"'), "before the first heading of the menu");
  assert.ok(nav.indexOf("out.push(hideRow())") < nav.indexOf("for (const g of GROUPS)"), "before the topics");
  const css = read("../core/ui/base.css");
  assert.match(css, /\.nav-look-btn \{[^}]*min-height: 44px/, "a 44 px row");
  const src = read("../core/look.js");
  assert.match(src, /addEventListener\("beforeprint", \(\) => \{ printing = true; watch\(false\); \}\)/, "printing shows the amounts");
  assert.match(src, /addEventListener\("afterprint"/);
});

// ================================================================ text size and light or dark by choice (gap design 9)
const CSS = read("../core/ui/base.css").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const blockOf = (selector) => { const i = CSS.indexOf(`${selector} {`); assert.ok(i >= 0, `core/ui/base.css has ${selector}`); return CSS.slice(i + selector.length + 2, CSS.indexOf("}", i)); };

test("core/ui/base.css: Larger and Largest step every size token up together; boxes stay at 16 px, taps at 44 px", () => {
  const usual = tokens(CSS.slice(CSS.indexOf(":root {"), CSS.indexOf("}", CSS.indexOf(":root {"))));
  const sizes = Object.keys(usual).filter((k) => k.startsWith("--fs"));
  assert.deepEqual(sizes, ["--fs-xs", "--fs-sm", "--fs", "--fs-md", "--fs-lg", "--fs-xl", "--fs-2xl"]);
  const px = (v) => Number(String(v).replace("px", ""));
  const larger = tokens(blockOf(':root[data-text="larger"]')), largest = tokens(blockOf(':root[data-text="largest"]'));
  for (const set of [larger, largest]) assert.deepEqual(Object.keys(set), sizes, "every --fs-* token, and nothing else");
  assert.equal(usual["--fs"], "15px"); assert.equal(larger["--fs"], "17px"); assert.equal(largest["--fs"], "19px");
  for (const k of sizes) assert.ok(px(usual[k]) < px(larger[k]) && px(larger[k]) < px(largest[k]), `${k}: ${usual[k]} < ${larger[k]} < ${largest[k]}`);
  for (const set of [usual, larger, largest]) for (let i = 1; i < sizes.length; i++) assert.ok(px(set[sizes[i - 1]]) < px(set[sizes[i]]), "the order of the sizes is kept");
  // at least the base's own step (15 -> 17 -> 19), so small print grows as much as the body text
  for (const k of sizes) { assert.ok(px(larger[k]) - px(usual[k]) >= 2, k); assert.ok(px(largest[k]) - px(usual[k]) >= 3, k); }
  assert.match(CSS, /input, select, textarea \{[^}]*font-size: max\(16px, var\(--fs\)\);[^}]*min-height: 44px/, "a box never under 16 px (no zoom on an iPhone), 44 px tall");
  assert.match(CSS, /button, \.btn \{[^}]*min-height: 44px/);
});

test("core/ui/base.css: dark as the phone asks unless Light was chosen, and the same dark tokens again when Dark was chosen", () => {
  const media = CSS.slice(CSS.indexOf("@media (prefers-color-scheme: dark) {"));
  assert.match(media, /^@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{/, "the phone's dark never overrides a chosen Light");
  const byPhone = tokens(media.slice(0, media.indexOf("}")));
  const byChoice = tokens(blockOf(':root[data-theme="dark"]'));
  assert.ok(Object.keys(byPhone).length >= 20);
  assert.deepEqual(byChoice, byPhone, "the two dark blocks hold the same tokens and values");
  assert.match(blockOf(':root[data-theme="dark"]'), /color-scheme: dark;/);
  assert.match(blockOf(':root[data-theme="light"]'), /color-scheme: light;/);
  assert.equal(byChoice["--panel"], L.BAR.dark, "the browser's own bar takes the top bar's dark colour");
  assert.equal(tokens(CSS.slice(CSS.indexOf(":root {"), CSS.indexOf("}", CSS.indexOf(":root {"))))["--panel"], L.BAR.light);
});

// A page's <html> and its metas, for core/look.js and for index.html's own script.
function fakePage() {
  const meta = (name, content, media) => ({ name, media, attrs: { content }, dataset: {}, getAttribute(k) { return this.attrs[k] ?? null; }, setAttribute(k, v) { this.attrs[k] = String(v); } });
  const metas = [meta("color-scheme", "light dark"), meta("theme-color", "#ffffff", "light"), meta("theme-color", "#181c22", "dark")];
  const root = { dataset: {}, setAttribute(k, v) { this.dataset[k.replace(/^data-/, "")] = String(v); } };
  const document = { documentElement: root, querySelector: (sel) => metas.find((m) => sel.includes(`"${m.name}"`)) ?? null, querySelectorAll: (sel) => metas.filter((m) => sel.includes(`"${m.name}"`)) };
  return { document, root, metas, scheme: () => metas[0].attrs.content, bars: () => metas.slice(1).map((m) => m.attrs.content) };
}

test("a choice sets <html data-text> and <html data-theme> at once, the browser's own parts follow, and the first choice undoes it", () => {
  const look = fresh();
  const pg = fakePage();
  globalThis.document = pg.document;
  try {
    look.start();
    assert.deepEqual(pg.root.dataset, {}, "nothing chosen: the app looks exactly as before");
    assert.equal(pg.scheme(), "light dark");
    look.set({ text: "larger" });
    assert.equal(pg.root.dataset.text, "larger");
    look.set({ text: "largest", theme: "dark" });
    assert.deepEqual({ ...pg.root.dataset }, { text: "largest", theme: "dark" });
    assert.equal(pg.scheme(), "dark");
    assert.deepEqual(pg.bars(), ["#181c22", "#181c22"]);
    assert.deepEqual(JSON.parse(disk.get("planner.look")), { fmt: 1, text: "largest", theme: "dark" });
    look.set({ theme: "light" });
    assert.equal(pg.root.dataset.theme, "light"); assert.equal(pg.scheme(), "light"); assert.deepEqual(pg.bars(), ["#ffffff", "#ffffff"]);
    look.set({ hide: true });
    assert.deepEqual(JSON.parse(disk.get("planner.look")), { fmt: 1, hide: 1, text: "largest", theme: "light" }, "one key holds all three");
    look.set({ text: "huge", theme: "sepia" });
    assert.deepEqual({ text: look.chosen.text, theme: look.chosen.theme }, { text: "largest", theme: "light" }, "a word that is not a choice changes nothing");
    look.set({ text: "usual", theme: "phone", hide: false });
    assert.deepEqual({ ...pg.root.dataset }, {});
    assert.equal(pg.scheme(), "light dark"); assert.deepEqual(pg.bars(), ["#ffffff", "#181c22"], "the metas are as index.html wrote them");
    assert.equal(disk.has("planner.look"), false, "all as on the first day: the key goes");
    look.set({ text: "larger", theme: "dark" }); look.forget();
    assert.deepEqual({ ...pg.root.dataset }, {}, "Erase the copy on this device");
    assert.deepEqual(look.chosen, { hide: false, text: "usual", theme: "phone" });
  } finally { delete globalThis.document; }
});

test("?look=largest,dark in the address is for the visit only", () => {
  const look = fresh();
  globalThis.location = { search: "?sandbox=1&look=largest,dark", hash: "" };
  try { assert.deepEqual(look.now, { hide: false, text: "largest", theme: "dark" }); assert.deepEqual(look.chosen, { hide: false, text: "usual", theme: "phone" }); } finally { delete globalThis.location; }
  assert.equal(disk.size, 0);
});

test("index.html sets the text size and light or dark before the first paint, from the same key, and never throws", async () => {
  const vm = await import("node:vm");
  const html = read("../index.html");
  const script = html.match(/<script id="look">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'index.html has <script id="look">');
  assert.ok(html.indexOf('id="look"') < html.indexOf('<link rel="stylesheet" href="./core/ui/base.css">'), "before the style sheet, so before the first paint");
  assert.ok(html.indexOf('name="color-scheme"') < html.indexOf('id="look"'), "after the meta it changes");
  const run = ({ search = "", stored = {}, storage = true } = {}) => {
    const pg = fakePage();
    const localStorage = storage ? { getItem: (k) => stored[k] ?? null } : { getItem() { throw new Error("blocked"); } };
    vm.runInNewContext(script, { window: { location: { search }, localStorage, document: pg.document }, decodeURIComponent, JSON, String });
    return { ...pg.root.dataset, scheme: pg.scheme() };
  };
  assert.deepEqual(run(), { scheme: "light dark" }, "nothing stored: nothing set");
  assert.deepEqual(run({ stored: { "planner.look": '{"fmt":1,"text":"largest","theme":"dark","hide":1}' } }), { text: "largest", theme: "dark", scheme: "dark" });
  assert.deepEqual(run({ stored: { "planner.look": '{"fmt":1,"text":"larger"}' } }), { text: "larger", scheme: "light dark" });
  assert.deepEqual(run({ stored: { "planner.look": '{"fmt":1,"theme":"light"}' } }), { theme: "light", scheme: "light" });
  // the sandbox reads its own key, never the owner's
  assert.deepEqual(run({ search: "?sandbox=1", stored: { "planner.look": '{"fmt":1,"text":"largest"}' } }), { scheme: "light dark" });
  assert.deepEqual(run({ search: "?sandbox=1", stored: { "planner.look.sandbox": '{"fmt":1,"text":"largest"}' } }), { text: "largest", scheme: "light dark" });
  // the visit-only key, over what is stored
  assert.deepEqual(run({ search: "?sandbox=1&look=largest,dark" }), { text: "largest", theme: "dark", scheme: "dark" });
  assert.deepEqual(run({ search: "?look=light", stored: { "planner.look": '{"fmt":1,"theme":"dark","text":"larger"}' } }), { text: "larger", theme: "light", scheme: "light" });
  // not ours, broken, or storage blocked (a private window): the app looks as it always did; the visit key still works
  assert.deepEqual(run({ stored: { "planner.look": '{"fmt":2,"text":"largest"}' } }), { scheme: "light dark" });
  assert.deepEqual(run({ stored: { "planner.look": "{oops" } }), { scheme: "light dark" });
  assert.deepEqual(run({ stored: { "planner.look": '{"fmt":1,"text":"enormous","theme":"pink"}' } }), { scheme: "light dark" });
  assert.deepEqual(run({ storage: false }), { scheme: "light dark" });
  assert.deepEqual(run({ storage: false, search: "?look=larger" }), { text: "larger", scheme: "light dark" });
  // the single-file copy keeps this script (tools/build.mjs drops only the opening guard)
  const { withoutOpeningGuard } = await import("../tools/build.mjs").catch(() => ({}));
  if (withoutOpeningGuard) assert.match(withoutOpeningGuard(html), /<script id="look">/);
});
