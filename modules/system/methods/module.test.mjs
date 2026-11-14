// modules/system/methods/module.test.mjs -- "How we work out the answers" (gap design #28): every page it links exists,
// every source carries a read date and is one a module README already cites with that date, the words on screen are
// plain, the page is the same for every household and writes nothing; and the one line the helper adds under every
// "How this is worked out", and Help's link.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compute, dayWords, readWords, sourcesWords, INTRO, PROMISE, NEW_TAB } from "./compute.js";
import { METHODS } from "./data/methods.js";
import manifest from "./module.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { ARCHETYPES } from "../../../qa/households/lib/catalog.mjs";
import { FAQ } from "../help/compute.js";

const MODULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = path.resolve(MODULES, "..");
const TODAY = "2026-11-14";
const read = (key, file) => fs.readFileSync(path.join(MODULES, key, file), "utf8");
const field = (src, k) => src.match(new RegExp(`^\\s*${k}:\\s*"([^"]*)"`, "m"))?.[1];
/** Every page's manifest facts, read from its module.js (the registry is generated from these folders). */
const PAGES = new Map();
for (const g of fs.readdirSync(MODULES, { withFileTypes: true })) {
  if (!g.isDirectory() || g.name.startsWith("_")) continue;
  for (const m of fs.readdirSync(path.join(MODULES, g.name), { withFileTypes: true })) {
    const f = path.join(MODULES, g.name, m.name, "module.js");
    if (!m.isDirectory() || !fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    PAGES.set(`${g.name}/${m.name}`, { key: `${g.name}/${m.name}`, group: g.name, id: m.name, title: field(t, "title"), status: field(t, "status"), builderOnly: /^\s*builderOnly:\s*true/m.test(t), requires: field(t, "requires") });
  }
}
const squash = (s) => String(s).replace(/\s+/g, " ");

// ---------------------------------------------------------------- the list
test("the seven topics of the design, in its order, each with a short status, its words, sources and pages", () => {
  assert.deepEqual(METHODS.map((t) => t.topic), ["Retirement", "Taxes", "Debt", "Cash and budget", "Investments", "Insurance", "Our guesses"]);
  assert.equal(new Set(METHODS.map((t) => t.id)).size, METHODS.length, "ids are unique");
  for (const t of METHODS) {
    assert.match(t.id, /^[a-z]+$/, t.id);
    assert.ok(t.status.length > 0 && t.status.length <= 20, `${t.topic}: status "${t.status}" is ${t.status.length} characters (at most 20)`);
    assert.doesNotMatch(t.status, /…|\.\.\./);
    assert.ok(t.says.length >= 2 && t.says.length <= 3, `${t.topic}: two or three short paragraphs`);
    for (const s of t.says) assert.ok(s.split(/\s+/).length <= 60 && /[.]$/.test(s), `${t.topic}: "${s}"`);
    assert.ok(t.sources.length >= 2 && t.sources.length <= 4, `${t.topic}: ${t.sources.length} sources`);
    assert.ok(t.pages.length >= 2 && t.pages.length <= 6, `${t.topic}: ${t.pages.length} pages`);
  }
  assert.equal(METHODS[0].status, "history since 1928");
  assert.equal(METHODS[1].status, "IRS tables for 2026");
});

test("every linked page exists in the registry, is built, and is a page a household is offered", async () => {
  const registry = (await import(pathToFileURL(path.join(MODULES, "registry.js")).href)).default;
  const inRegistry = new Set(registry.map((r) => `${r.group}/${r.id}`));
  assert.ok(inRegistry.has("system/methods"), "the page itself is in the registry");
  for (const t of METHODS) for (const k of t.pages) {
    assert.ok(inRegistry.has(k), `${t.topic}: ${k} is not in the registry`);
    const p = PAGES.get(k);
    assert.ok(p, `${t.topic}: ${k} has no module.js`);
    assert.ok(p.status === "usable" || p.status === "complete", `${k} is ${p.status}`);
    assert.ok(!p.builderOnly && !p.requires, `${k} is not offered to every household`);
    assert.equal(new Set(t.pages).size, t.pages.length, `${t.topic}: a page twice`);
  }
});

test("a page named in the words is a page: every quoted title is some page's title, and that page is linked under the topic", () => {
  const titles = new Map([...PAGES.values()].map((p) => [p.title, p.key]));
  let seen = 0;
  for (const t of METHODS) for (const s of t.says) for (const m of s.matchAll(/"([^"]+)"/g)) {
    assert.ok(titles.has(m[1]), `${t.topic}: "${m[1]}" is not a page title`);
    assert.ok(t.pages.includes(titles.get(m[1])), `${t.topic}: "${m[1]}" is named but not linked`);
    seen++;
  }
  assert.ok(seen >= 3);
  // the Assumptions page is named without quotes: its title is still that
  assert.equal(PAGES.get("system/assumptions").title, "Assumptions");
});

test("every source has a name and a read date (a real day, not after today); an address is https", () => {
  for (const t of METHODS) for (const s of t.sources) {
    assert.ok(s.name && s.name.length > 10, `${t.topic}: a source without a name`);
    assert.match(String(s.read), /^\d{4}-\d{2}-\d{2}$/, `${t.topic}: "${s.name}" has no read date`);
    assert.ok(dayWords(s.read), `${s.name}: ${s.read} is not a day`);
    assert.ok(s.read <= TODAY && s.read >= "2026-01-01", `${s.name}: read ${s.read}`);
    if (s.url !== undefined) assert.match(s.url, /^https:\/\/[a-z0-9.-]+\//, s.name);
    assert.ok(s.readme && s.cited, `${s.name}: says which README cites it, and in which words`);
  }
});

test("no source is new here: each is cited in the README it names, with its read date beside it, and its address is the README's", () => {
  for (const t of METHODS) for (const s of t.sources) {
    assert.ok(PAGES.has(s.readme), `${s.name}: ${s.readme} is not a page`);
    const text = squash(read(s.readme, "README.md"));
    const cited = squash(s.cited);
    const at = [];
    for (let i = text.indexOf(cited); i >= 0; i = text.indexOf(cited, i + 1)) at.push(i);
    assert.ok(at.length > 0, `${s.readme}/README.md does not cite "${s.cited}"`);
    // the README's date is beside the citation: a "Sources (read ...)" heading above its list, or right after the citation
    const beside = at.some((i) => text.slice(Math.max(0, i - 2500), i + cited.length + 400).includes(s.read));
    assert.ok(beside, `${s.readme}/README.md cites "${s.cited}" but not with ${s.read} beside it`);
    if (s.url) {
      const bare = s.url.replace(/^https:\/\/(www\.)?/, "");
      assert.ok(text.includes(bare), `${s.readme}/README.md does not give the address ${bare}`);
    }
  }
});

test("the day shown is the LATEST day a README says it read the source: a later 'read <day>' right at the citation is not passed over", () => {
  // critic M1: the tax tables were dated 2026-11-02 here while taxes/federal's README also says "read 2026-11-06 at" that address
  let dated = 0;
  for (const t of METHODS) for (const s of t.sources) {
    const text = squash(read(s.readme, "README.md")), cited = squash(s.cited);
    const days = [];
    for (let i = text.indexOf(cited); i >= 0; i = text.indexOf(cited, i + 1)) {
      const before = text.slice(Math.max(0, i - 40), i), after = text.slice(i + cited.length, i + cited.length + 60);
      for (const m of before.matchAll(/\bread (\d{4}-\d{2}-\d{2})\b/g)) days.push(m[1]);
      const next = /^[^.;|]*?\bread (\d{4}-\d{2}-\d{2})\b/.exec(after);
      if (next) days.push(next[1]);
    }
    if (!days.length) continue;
    dated++;
    const latest = days.sort().at(-1);
    assert.ok(s.read >= latest, `${s.name}: shown as read ${s.read}, but ${s.readme}/README.md says read ${latest} right at "${s.cited}"`);
  }
  assert.ok(dated >= 5, `${dated} sources have their day right at the citation`);
  const tables = METHODS.find((t) => t.id === "taxes").sources.find((s) => /rp-25-32/.test(s.url));
  assert.equal(tables.read, "2026-11-06");
});

test("a source is named in plain words first; the publisher's own name or number comes after, in brackets", () => {
  // critic P1: "IRS Revenue Procedure 2025-32", "Public Law 119-21", "Debt-to-income calculator tool" led the line
  const CODE = /Revenue Procedure|Rev\. Proc|Public Law|Publication|Notice \d|CFR|U\.S\.C|Selling Guide|Topic no|Table [IVX0-9]|Worksheet \d|Appendix|Act of \d|Supplement|Survey of|Community Survey|Benefits Survey/;
  const START = /^(The |A |What |Pay |Yearly |Vanguard's |Social Security's |Fannie Mae's )/;
  for (const s of new Set(METHODS.flatMap((t) => t.sources))) {
    const lead = s.name.split(" (")[0];
    assert.match(s.name, START, `"${s.name}" does not start with plain words`);
    assert.doesNotMatch(lead, CODE, `"${s.name}": the law's or paper's own name belongs in the brackets at the end`);
    assert.doesNotMatch(s.name, /Debt-to-income|calculator tool|"|withholding|Ratios/i, s.name);
    assert.ok(lead.split(/\s+/).length >= 4, `"${s.name}": the plain words say what it is`);
    assert.ok((s.name.match(/\(/g) ?? []).length <= 1 && (!s.name.includes("(") || s.name.endsWith(")")), `"${s.name}": one bracket, at the end`);
    assert.ok(s.name.length <= 125, `"${s.name}" is ${s.name.length} characters`);
  }
  const names = METHODS.flatMap((t) => t.sources.map((s) => s.name));
  assert.ok(names.includes("The IRS's tax tables and amounts for 2026 (Revenue Procedure 2025-32)"));
  assert.ok(names.includes("The tax law passed in 2025 (Public Law 119-21)"));
  assert.ok(names.includes("The IRS's worksheet for what an employer holds back for income tax (Publication 15-T, 2026)"));
});

// ---------------------------------------------------------------- the words
test("a day in words: November 13, 2026; not a day says nothing", () => {
  assert.equal(dayWords("2026-11-13"), "November 13, 2026");
  assert.equal(dayWords("2026-01-05"), "January 5, 2026");
  for (const bad of ["", null, undefined, "2026-13-01", "2026-00-10", "2026-11-32", "13 Nov 2026", "2026-11"]) assert.equal(dayWords(bad), "", String(bad));
  assert.equal(readWords("2026-10-31"), "Read October 31, 2026");
  assert.equal(readWords("soon"), "");
  assert.equal(sourcesWords(1), "1 source");
  assert.equal(sourcesWords(3), "3 sources");
});

test("the page's one sentence, and the small line under it", () => {
  assert.equal(INTRO, "Every answer is simple arithmetic on your own numbers and on published figures, such as tax tables and past returns.");
  assert.equal(INTRO.split(/(?<=[.!?]) /).length, 1, "one sentence");
  // critic P2: short, no colon joining two thoughts, and it says which published figures
  assert.ok(INTRO.split(/\s+/).length <= 20 && !INTRO.includes(":"), INTRO);
  assert.equal(PROMISE, "Tap a topic to see how. Each source shows the day we last read it.");
  assert.equal(NEW_TAB, "Opens in a new tab.");
});

test("compute: every topic with its sources' days in words; a source without a day would be left out", () => {
  const d = compute(emptyPlan());
  assert.equal(d.intro, INTRO); assert.equal(d.promise, PROMISE);
  assert.equal(d.topics.length, 7);
  for (const [i, t] of d.topics.entries()) {
    assert.equal(t.sources.length, METHODS[i].sources.length, "every source has a day, so none is left out");
    for (const s of t.sources) { assert.equal(s.readWords, readWords(s.read)); assert.match(s.readWords, /^Read [A-Z][a-z]+ \d{1,2}, 2026$/); assert.ok(s.url === null || s.url.startsWith("https://")); }
  }
  assert.equal(d.newest, "2026-11-13");
  assert.equal(d.sourceCount, new Set(METHODS.flatMap((t) => t.sources.map((s) => s.name))).size);
  assert.ok(d.sourceCount >= 18);
});

// ---------------------------------------------------------------- invariance: nothing of the plan is read or written
test("invariance: the same output, byte for byte, for the empty plan, the 14 households and every fixture plan; no plan is touched", async () => {
  const plans = [{ name: "empty plan", plan: emptyPlan() }, { name: "nothing", plan: undefined }];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `fixture ${f}:${name}`, plan: migrate(fn()) });
  }
  for (const a of ARCHETYPES) plans.push({ name: `${a.id}/base`, plan: a.build() });
  assert.ok(plans.length >= 20, `${plans.length} plans`);
  const want = JSON.stringify(compute(emptyPlan()));
  for (const { name, plan } of plans) {
    const before = JSON.stringify(plan);
    assert.equal(JSON.stringify(compute(plan)), want, name);
    assert.equal(JSON.stringify(plan), before, `${name}: the plan is as it was`);
  }
  assert.deepEqual(manifest.needs, []); assert.deepEqual(manifest.writes, []);
  // and the list itself is not handed out to be changed
  compute().topics[0].says.push("x"); compute().topics[0].pages.push("x");
  assert.equal(JSON.stringify(compute()), want);
});

// ---------------------------------------------------------------- the page
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { render } = await import("./view.js");
const { part, parts, METHODS_HREF } = await import("../../../core/ui/more.js");

const everyPage = () => new Map([...PAGES.values()].map((p) => [p.key, { ...p }]));
function draw({ modules = everyPage(), shown = () => true, enabled = () => true, plan = emptyPlan() } = {}) {
  const saved = [];
  const root = new FakeElement("main");
  render(root, { ui, fmt, plan, modules, shown, isReady: (m) => m.status !== "planned", features: { enabled }, route: { group: "system", id: "methods", rest: [], query: {} }, module: { group: "system", id: "methods" },
    store: { get: () => plan, update: (fn) => saved.push(fn) } });
  return { root, saved };
}
const all = (el) => [el, ...el.all()];
const rows = (root) => all(root).filter((e) => e.tagName === "DETAILS");
const isOpen = (e) => e.hasAttribute("open");
/** The page as it opens: everything outside a shut row. */
function firstView(root) {
  const walk = (n) => (!(n instanceof FakeElement) ? n.textContent : n.tagName === "DETAILS" && !isOpen(n) ? textOf(n.children.find((c) => c.tagName === "SUMMARY")) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" "));
  return squash(walk(root)).trim();
}

test("the first view: the heading, one sentence, seven shut rows each with its short status, and nothing to fill in or press", () => {
  const { root } = draw();
  const rs = rows(root);
  assert.deepEqual(rs.map((r) => [textOf(r.querySelector(".fold-title")), textOf(r.querySelector(".fold-status")), r.dataset.kind, isOpen(r)]), METHODS.map((t) => [t.topic, t.status, "item", false]));
  assert.deepEqual(rs.map((r) => r.dataset.part), METHODS.map((t) => t.id));
  const first = firstView(root);
  assert.ok(first.startsWith(`How we work out the answers ${INTRO} ${PROMISE} Pick a topic Retirement history since 1928`), first);
  assert.ok(first.split(/\s+/).length <= 100, `${first.split(/\s+/).length} words on the first view`);
  assert.doesNotMatch(first, /Read [A-Z][a-z]+ \d/, "no source on the first view: they are one tap away");
  assert.equal(all(root).filter((e) => ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "FORM"].includes(e.tagName)).length, 0, "nothing to type, nothing to press");
  assert.equal(all(root).filter((e) => e.tagName === "H1").length, 1);
  // report-kind structure: no row inside a row, one card of rows
  for (const r of rs) for (let a = r.parentNode; a; a = a.parentNode) assert.notEqual(a.tagName, "DETAILS", "no row inside a row");
  assert.equal(new Set(rs.map((r) => r.parentNode)).size, 1, "the rows are one list");
  assert.equal(rs[0].parentNode.className, "folds");
});

test("a row holds the method in plain words, each source with the day it was read, and the pages that use it", () => {
  const { root } = draw();
  for (const [i, r] of rows(root).entries()) {
    const t = METHODS[i], text = textOf(r.querySelector(".fold-body"));
    for (const s of t.says) assert.ok(text.includes(s), `${t.topic}: "${s}"`);
    assert.ok(text.includes("Where the figures come from"));
    const srcs = r.querySelector(".mt-src").children;
    assert.equal(srcs.length, t.sources.length);
    for (const [j, li] of srcs.entries()) {
      const s = t.sources[j];
      // critic P3: a source that is a link says the tap leaves the app; one without an address says only its day
      assert.equal(textOf(li), s.url ? `${s.name} ${readWords(s.read)}. Opens in a new tab.` : `${s.name} ${readWords(s.read)}`, "the name, then the day it was read");
      const a = li.querySelector(".mt-name");
      if (s.url) { assert.equal(a.tagName, "A"); assert.equal(a.getAttribute("href"), s.url); assert.equal(a.getAttribute("target"), "_blank"); assert.equal(a.getAttribute("rel"), "noopener"); }
      else assert.equal(a.tagName, "DIV", "no address in the README: the name alone, never a made-up link");
    }
    assert.ok(text.includes("Pages that use it"));
    const chips = all(r).filter((e) => e.tagName === "A" && e.className === "chip");
    assert.deepEqual(chips.map((a) => a.getAttribute("href")), t.pages.map((k) => `#/${k}`));
    assert.deepEqual(chips.map((a) => textOf(a)), t.pages.map((k) => PAGES.get(k).title), "each page by its own title");
  }
});

test("a page this household is not offered (switched off, not shown, not built) gets no link; with none left the heading goes too", () => {
  const off = draw({ enabled: (m) => m.key !== "retirement/historical" });
  assert.ok(!all(off.root).some((e) => e.getAttribute?.("href") === "#/retirement/historical"));
  assert.ok(all(off.root).some((e) => e.getAttribute?.("href") === "#/retirement/projection"));
  const hidden = draw({ shown: (m) => m.group !== "debt" });
  assert.ok(!textOf(rows(hidden.root)[2]).includes("Pages that use it"), "Debt: no page to show, no heading");
  assert.ok(textOf(rows(hidden.root)[2]).includes("Where the figures come from"));
  const soon = everyPage(); soon.get("overview/guesses").status = "planned";
  const d = draw({ modules: soon });
  assert.ok(!all(d.root).some((e) => e.getAttribute?.("href") === "#/overview/guesses"), "neither under the topic nor in More on this");
  // with no page list at all (a bare test double) the page still draws
  assert.doesNotThrow(() => draw({ modules: new Map() }));
});

test("More on this: three questions, each a way on", () => {
  const { root } = draw();
  const card = all(root).find((e) => e.dataset?.links !== undefined);
  assert.ok(card);
  assert.deepEqual(all(card).filter((e) => e.tagName === "A").map((a) => [a.getAttribute("href"), textOf(a.querySelector(".t"))]),
    [["#/overview/guesses", "Which figures are guesses?"], ["#/system/assumptions", "What does the plan assume?"], ["#/ai/glossary", "What does a word mean?"]]);
});

test("no builder words on screen: no PC, server, AI, build, file or short forms a layperson would not know", () => {
  const { root } = draw();
  const walk = (n) => (!(n instanceof FakeElement) ? n.textContent : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" "));
  const said = squash(walk(root));
  assert.ok(said.length > 3000, "every row's words are read, open or shut");
  const BUILDER = /\b(PC|server|AI|sync|synced|build|builder|browser|valid|validation|invalid|input|field|value|required|error|module|README|compute|registry|formula|JSON|fixture|repo|commit|vendor|stub|placeholder)\b/i;
  const SHORT = /\b(RMD|RMDs|IRMAA|PIA|DTI|MAGI|AGI|PMI|HDHP|HSA|FSA|VCMM|COLA|SCF|ACS|CPI|TSP)\b/;
  // a source is named as its publisher names it (a law's number, "CFR"); the app's own words are held to the plain list
  const own = [INTRO, PROMISE, NEW_TAB, ...METHODS.flatMap((t) => [t.topic, t.status, ...t.says]), "Pick a topic", "Where the figures come from", "Pages that use it"].join(" ");
  assert.doesNotMatch(own, BUILDER); assert.doesNotMatch(own, SHORT);
  assert.doesNotMatch(own, /Monte Carlo|amortiz|bisection|nominal|percentile|stochastic/i);
  for (const s of METHODS.flatMap((t) => t.sources)) { assert.doesNotMatch(s.name, BUILDER, s.name); assert.doesNotMatch(s.name, SHORT, s.name); }
  assert.doesNotMatch(said, /null|undefined|NaN|\[object/);
  assert.doesNotMatch(manifest.purpose, /\bPC\b|\bserver\b|\bphase\b|\bAI\b|\bstatus\b/i);
});

test("S11: there is nothing to save here, so drawing and opening every row writes nothing to the plan", () => {
  const plan = emptyPlan(), before = JSON.stringify(plan);
  const { root, saved } = draw({ plan });
  for (const r of rows(root)) r.open = true;
  assert.equal(saved.length, 0);
  assert.equal(JSON.stringify(plan), before);
});

// ---------------------------------------------------------------- the helper's one line, and Help's link
const ctxFor = (extra = {}) => ({ ui, fmt, module: { group: "taxes", id: "federal" }, route: { group: "taxes", id: "federal", rest: [], query: {} }, ...extra });
const methodsLink = (el) => all(el).find((e) => e.tagName === "A" && e.dataset?.methods !== undefined) ?? null;
const offered = { modules: everyPage(), shown: () => true, features: { enabled: () => true } };

test("every \"How this is worked out\" ends with \"All our methods and sources\", a link to this page", () => {
  assert.equal(METHODS_HREF, "#/system/methods");
  const how = part(ctxFor(offered), { id: "how", kind: "how", says: "2 steps", body: () => [ui.h("p", {}, "Your pay, less the standard deduction")] });
  const a = methodsLink(how);
  assert.ok(a, "the link is there");
  assert.equal(a.getAttribute("href"), "#/system/methods");
  assert.equal(textOf(a), "All our methods and sources ›");
  const body = how.querySelector(".fold-body");
  assert.equal(body.children[body.children.length - 1], a, "the last line of the part");
  assert.equal(a.style.minHeight, "44px", "a full-size tap target");
  assert.equal(isOpen(how), false, "the part opens as before: shut");
  // a pinned title is still a "how" part
  assert.ok(methodsLink(part(ctxFor(offered), { id: "sources", kind: "how", title: "Where these numbers come from", body: ["x"] })));
  // inside the page's parts card too
  assert.ok(methodsLink(parts(ctxFor(offered), { id: "how", kind: "how", body: ["x"] })));
});

test("the line is only under a \"how\" part, once, and a body built when opened gets it when it is built", () => {
  for (const kind of ["more", "own", "figures", "item", "tech"]) {
    const o = kind === "more" ? { id: "p", kind, n: 4, noun: "numbers", body: ["x"] } : { id: "p", kind, title: "A part", body: ["x"] };
    assert.equal(methodsLink(part(ctxFor(offered), o)), null, kind);
  }
  let built = 0;
  const lazy = part(ctxFor(offered), { id: "how", kind: "how", lazy: true, body: () => { built++; return ["x"]; } });
  assert.equal(methodsLink(lazy), null, "not built yet");
  lazy.open = true; lazy.dispatch("toggle"); lazy.dispatch("toggle");
  assert.equal(built, 1);
  assert.equal(all(lazy).filter((e) => e.dataset?.methods !== undefined).length, 1, "once");
});

test("no line where the page is not offered: no page list (a test double), not built, switched off, or not shown to this household", () => {
  const how = { id: "how", kind: "how", body: ["x"] };
  assert.equal(methodsLink(part(ctxFor(), how)), null, "no ctx.modules: every module test's drawing is as it was");
  assert.equal(methodsLink(part(ctxFor({ modules: new Map() }), how)), null);
  const soon = everyPage(); soon.get("system/methods").status = "planned";
  assert.equal(methodsLink(part(ctxFor({ ...offered, modules: soon }), how)), null);
  assert.equal(methodsLink(part(ctxFor({ ...offered, features: { enabled: (m) => m.key !== "system/methods" } }), how)), null);
  assert.equal(methodsLink(part(ctxFor({ ...offered, shown: (m) => m.key !== "system/methods" }), how)), null);
  assert.ok(methodsLink(part(ctxFor({ modules: everyPage() }), how)), "a page list alone is enough");
});

test("Help: \"How are the numbers worked out?\" has one way on, to this page by its title", async () => {
  const f = FAQ.find((x) => x.q === "How are the numbers worked out?");
  assert.deepEqual(f.link, { key: "system/methods", label: manifest.title });
  assert.equal(FAQ.filter((x) => x.link).length, 1);
  const help = await import("../help/view.js");
  const helpDraw = (extra = {}) => {
    const root = new FakeElement("main");
    const plan = migrate(emptyPlan());
    const { GROUPS } = extra.groups;
    help.render(root, { ui, fmt, plan, modules: everyPage(), GROUPS, shown: () => true, features: { enabled: () => true }, view: { build: false }, live: { pc: false, ai: false }, store: { get: () => plan, update() {} },
      route: { group: "system", id: "help", rest: [], query: {} }, module: { group: "system", id: "help" }, ...extra.ctx });
    return all(root).filter((e) => e.tagName === "A" && e.getAttribute("href") === "#/system/methods");
  };
  const groups = await import("../../../core/groups.js");
  const links = helpDraw({ groups });
  const inAnswer = links.filter((a) => a.className === "chip");
  assert.equal(inAnswer.length, 1);
  assert.equal(textOf(inAnswer[0]), "How we work out the answers");
  assert.equal(textOf(inAnswer[0].closest(".hp-q").children[0]), "How are the numbers worked out?");
  assert.equal(helpDraw({ groups, ctx: { features: { enabled: (m) => m.id !== "methods" } } }).filter((a) => a.className === "chip").length, 0, "switched off: the answer stands alone");
});
