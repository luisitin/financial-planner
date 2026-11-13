// tests/first-view/1.test.mjs -- shard 1 of the first-view check (docs/OPTIONAL.md, check N; qa/first-view-lib.mjs):
// the pages tests/first-view.kinds.mjs gives shard 1, each drawn for four invented households and held to its kind's
// budget or its entry in tests/first-view.known.json. This shard also checks the check: the kinds table covers every
// usable page, the counts file names only real pages, and the counter and the structure checks find what they are for
// on small drawings made here. The whole picture: node qa/first-view-node.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as K from "../first-view.kinds.mjs";
import { defineShard, loadApp, count, structure, handWritten, readKnown, isFilled, backgroundRules, ROOT } from "../../qa/first-view-lib.mjs";

const app = await loadApp();
const ui = app.ui, h = ui.h;
const { part, parts, rest, links } = await import("../../core/ui/more.js");
const ctxOf = (query = {}) => ({ ui, fmt: app.fmt, route: { group: "taxes", id: "check", rest: [], query }, module: { group: "taxes", id: "check" } });
const page = (...kids) => h("div", { dataset: { page: "taxes/check" } }, ...kids);
const ids = (list) => list.map((c) => c.id).sort();

test("the kinds table: every usable page has a kind and a shard, and it names no other page", () => {
  const kinds = new Set(Object.keys(K.BUDGETS));
  for (const key of app.usable) {
    assert.ok(K.KINDS[key], `${key} is usable but has no kind in tests/first-view.kinds.mjs: give it [kind, shard]`);
    const [kind, shard] = K.KINDS[key];
    assert.ok(kinds.has(kind), `${key}: kind "${kind}" is not one of ${[...kinds].join(", ")}`);
    assert.ok(Number.isInteger(shard) && shard >= 1 && shard <= K.SHARDS, `${key}: shard ${shard}`);
  }
  for (const key of Object.keys(K.KINDS)) assert.ok(app.usable.includes(key), `${key} is in the kinds table but is not a usable page`);
  for (let n = 1; n <= K.SHARDS; n++) assert.ok(fs.existsSync(path.join(ROOT, "tests", "first-view", `${n}.test.mjs`)), `shard ${n} has no test file`);
});

test("the browser check's rule: the worst household against the kind's budget, an entry that may only go down", async () => {
  const B = await import("../../qa/first-view.mjs");
  const row = (who, f) => ({ who, key: "taxes/check", f: { fsWords: 0, fsFigs: 0, headCut: 0, actCut: 0, cardCut: 0, noStart: 0, nextFar: 0, wide320: 0, tapMoved: 0, rowShort: 0, partTall: 0, tapStored: 0, memory: 0, moreWide: 0, moreSmall: 0, moreFilled: 1, errors: 0, ...f } });
  const rows = [row("family", { fsWords: 154, fsFigs: 9 }), row("renterDebt", { fsWords: 120 }), row("retiredCouple", { tapMoved: 1 }), row("empty", { noStart: 1 })];
  assert.deepEqual(B.worst(rows).plan.fsWords, [154, "family"]);
  assert.deepEqual(B.entryFor(rows, "answer", K), { plan: { fsWords: 160, fsFigs: 9, tapMoved: 1 }, empty: { noStart: 1 } }, "words rounded up to ten");
  assert.equal(B.judge(rows, "answer", null, K).fails.length, 4, "no entry: four counts over their budgets");
  assert.deepEqual(B.judge(rows, "answer", { plan: { fsWords: 160, fsFigs: 9, tapMoved: 1 }, empty: { noStart: 1 } }, K).fails, []);
  const up = B.judge(rows, "answer", { plan: { fsWords: 150, fsFigs: 9, tapMoved: 1 }, empty: { noStart: 1 } }, K);
  assert.equal(up.fails.length, 1, "a count above its entry fails");
  const down = B.judge(rows, "answer", { plan: { fsWords: 200, fsFigs: 12, tapMoved: 1 }, empty: { noStart: 1 } }, K);
  assert.deepEqual(down.fails, []); assert.equal(down.notes.filter((x) => x.startsWith("lower me")).length, 2, "a count below its entry says lower me");
  const rounded = B.judge(rows, "answer", { plan: { fsWords: 160, fsFigs: 9, tapMoved: 1 }, empty: { noStart: 1 } }, K);
  assert.deepEqual(rounded.notes.filter((x) => x.startsWith("lower me")), [], "154 words sits under its entry rounded up to 160: nothing to lower");
  assert.equal(B.budgetOf("list", "fsWords", "plan", K), null, "only an answer page has a first-screen word budget");
  assert.equal(B.budgetOf("settings", "cardCut", "plan", K), 0);
  assert.deepEqual(B.judge([{ who: "family", key: "x", failed: "boom" }], "answer", null, K).fails, ["family: could not be measured: boom"]);
});

test("claude-a's folders are the 13 that tests/wording.test.mjs lists", () => {
  const src = fs.readFileSync(path.join(ROOT, "tests", "wording.test.mjs"), "utf8");
  const listed = [...(/CLAUDE_A_LANE = \[([\s\S]*?)\]/.exec(src)?.[1] ?? "").matchAll(/"modules\/([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual([...K.CLAUDE_A_LANE].sort(), listed);
});

test("the counts file names only usable pages outside claude-a's folders, with the fields the rule reads", () => {
  const known = readKnown();
  const FIELDS = new Set(["words", "figs", "boxes", "tiles", "filled", "parts"]);
  for (const [key, e] of Object.entries(known)) {
    if (key.startsWith("_")) continue;
    assert.ok(app.usable.includes(key), `${key} has an entry but is not a usable page: delete it`);
    assert.ok(!K.CLAUDE_A_LANE.includes(key), `${key} is claude-a's: its counts are to-do lines, never an entry`);
    for (const k of Object.keys(e)) assert.ok(["plan", "empty", "checks", "cannotDraw"].includes(k), `${key}: unknown part "${k}"`);
    for (const scope of ["plan", "empty"]) for (const [f, n] of Object.entries(e[scope] ?? {})) {
      assert.ok(FIELDS.has(f), `${key}.${scope}: unknown count "${f}"`);
      assert.ok(Number.isInteger(n) && n > 0, `${key}.${scope}.${f}: ${n}`);
      if (f === "words") assert.equal(n % 10, 0, `${key}.${scope}.words is rounded up to the next ten`);
    }
  }
});

test("S9: no view passes moreOpen: false or !! (a false beats the switch and a box that already holds something)", () => {
  const bad = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) { const src = fs.readFileSync(p, "utf8"); for (const m of src.matchAll(/moreOpen\s*:\s*(false\b|!!)/g)) bad.push(`${path.relative(ROOT, p)}: ${m[0]}`); } } };
  walk(path.join(ROOT, "modules"));
  assert.deepEqual(bad, [], "write moreOpen: editing || undefined (docs/CONVENTIONS.md)");
});

test("the counter: only what a person sees before a tap, in the phone markup", () => {
  const root = page(
    h("h1", {}, "You would owe about $5,253 in April"),
    h("p", {}, "That is 12% of your pay."),
    h("div", { class: "only-wide" }, h("p", {}, "a wide table of many many words $1 $2 $3")),
    h("span", { class: "vh" }, "for screen readers only"),
    h("p", { hidden: true }, "hidden words"),
    h("p", { "aria-hidden": "true" }, "a marker"),
    h("div", { class: "stat" }, "$400"),
    ui.input({ name: "a" }), h("input", { type: "checkbox", name: "b" }), h("select", { name: "c" }, h("option", { value: "x" }, "an option's words")),
    ui.button("Save"), ui.button("Cancel", null, { class: "secondary" }), h("a", { class: "btn", href: "#/x" }, "Start"),
    h("details", { class: "fold" }, h("summary", {}, "4 more numbers"), h("p", {}, "$1 $2 $3 and seven words behind it")),
    h("details", { class: "fold form-more" }, h("summary", {}, "More details (optional)"), ui.input({ name: "d" })),
    h("ul", { class: "records" }, h("li", {}, "one"), h("li", {}, "two"), h("li", { class: "rec-form" }, "a form")));
  const c = count(root);
  assert.equal(c.words, 7 + 6 + 1 + 1 + 1 + 1 + 3 + 3 + 1 + 1 + 2, JSON.stringify(c));   // the h1, the line, the tile, Save, Cancel, Start, the two summaries, the three rows
  assert.equal(c.figs, 3, "$5,253, 12% and $400");
  assert.equal(c.boxes, 2, "the text box and the select; not the tick, not the folded box");
  assert.equal(c.filled, 2, "Save and the a.btn Start; Cancel is outlined");
  assert.equal(c.tiles, 1);
  assert.equal(c.parts, 1, "one section that opens; the form's line is counted apart");
  assert.equal(c.moreLines, 1);
  assert.equal(c.rows, 2, "list rows, the row holding a form left out");
  assert.equal(c.behind, 8, "the words behind the shut section are reported");
});

test("a filled button is the accent's fill as a person sees it: base.css, then the page's own style, then inline", () => {
  const btn = (attrs, label = "Go") => h("button", { type: "button", ...attrs }, label);
  const plain = btn({}), outlined = btn({ class: "secondary" }), danger = btn({ class: "danger" }), link = h("a", { class: "btn", href: "#/x" }, "Start");
  const row = btn({ class: "x-row" }, "A row"), inline = btn({ style: { background: "none" } }), chip = btn({ class: "chip on" }, "Yours: 5.5%"), off = btn({ disabled: true });
  const wide = btn({ class: "x-wide" }, "Wide only"), small = btn({ class: "small" }, "Edit");
  page(h("style", {}, ".x-root .x-row { background: none; border: 0 } @media (min-width: 700px) { .x-wide { background: none } } /* .x-wide { background: none } */"),
    h("div", { class: "x-root" }, plain, outlined, danger, link, row, inline, chip, off, wide, small));
  assert.deepEqual([plain, link, wide, small].map(isFilled), [true, true, true, true], "the accent: a plain button, a.btn, a rule only for wide screens, a small one");
  assert.deepEqual([outlined, danger, row, inline, chip, off].map(isFilled), [false, false, false, false, false, false], "outlined, danger, the page's own rule, inline, a chip, disabled");
  // the style sheet reader: a background in a rule list, @media kept only when it holds on a phone 390 px wide
  assert.deepEqual(backgroundRules("a, .b { background: var(--x) } @media (max-width: 600px) { .c { background-color: red !important } } @media print { .d { background: none } }").map((r) => [r.sel, r.bg]),
    [["a", "var(--x)"], [".b", "var(--x)"], [".c", "red"]]);
});

test("a page's own querySelector finds what a browser finds (real selectors in the stand-in DOM)", () => {
  const save = h("button", { type: "submit" }, "Save"), shut = h("details", { class: "fold", dataset: { part: "how" } }, h("summary", {}, "How"), h("p", {}, "x"));
  const root = page(h("form", {}, h("div", { class: "form-actions" }, save, h("button", { type: "button", class: "secondary" }, "Cancel"))), shut,
    h("details", { open: true }, h("summary", {}, "Open"), h("ul", { class: "records" }, h("li", {}, "1"), h("li", { class: "rec-form" }, "2"))), h("select", { name: "kind" }));
  assert.equal(root.querySelector(".form-actions button[type=submit]"), save);
  assert.equal(root.querySelector("details:not([open])"), shut);
  assert.equal(root.querySelector("details[data-part=how] > summary + p")?.textContent, "x");
  assert.equal(root.querySelectorAll(".records > li:not(.rec-form)").length, 1);
  assert.equal(root.querySelectorAll("input, select, textarea").length, 1);
  assert.equal(root.querySelectorAll("button:hover").length, 0, "a page standing still is never hovered");
  assert.equal(save.closest("[data-page] form")?.tagName, "FORM");
});

test("the structure checks find what they are for (S1 to S7, S9, S10, S12, S15)", () => {
  const ctx = ctxOf();
  const fold = (id, kind, title, status, ...body) => h("details", { class: "fold", dataset: { part: id, kind } },
    h("summary", {}, h("span", { class: "fold-title" }, title), status ? h("span", { class: "fold-status" }, status) : null), h("div", { class: "fold-body" }, ...body));
  const many = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty "
    + "twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty thirty-one thirty-two thirty-three thirty-four thirty-five thirty-six thirty-seven thirty-eight thirty-nine forty";
  const cases = [
    ["S1", page(part(ctx, { id: "a", kind: "how", body: [h("p", {}, many), part(ctx, { id: "b", kind: "more", n: 3, noun: "numbers", body: h("p", {}, "$1 $2") })] }))],
    ["S2", page(h("section", { class: "card", dataset: { parts: "" } }, ["a", "b", "c", "d", "e", "f"].map((id) => fold(id, "more", "3 more numbers", "", h("p", {}, "$1 $2")))))],
    ["S2", page(h("section", { class: "card", dataset: { parts: "" } }, fold("h", "how", "How this is worked out", "", h("p", {}, "$1 $2")), fold("m", "more", "3 more numbers", "", h("p", {}, "$1 $2"))))],
    ["S3", page(fold("a", "how", "How this is worked out", "every single step and the sources", h("p", {}, "$1 $2")))],
    ["S3", page(fold("a", "own", "Set my own numbers", "you set 2", h("p", {}, "$1 $2")))],
    ["S4", page(fold("a", "own", "Details", "", h("p", {}, "$1 $2")))],
    ["S4", page(fold("a", "tech", "Advanced", "", h("p", {}, "$1 $2")))],
    ["S5", page(fold("a", "how", "How this is worked out", "", h("p", {}, "$1 $2"), ui.notice("warn", "$1,241 of tax is overdue now")))],
    ["S5", page(fold("a", "own", "Set my own numbers", "", h("p", {}, "$1 $2"), h("input", { name: "x", required: true })))],
    ["S5", page(h("details", { class: "card fold" }, h("summary", {}, "Older"), ui.notice("error", "Fill this in first.")))],
    ["S6", page(fold("a", "own", "Set my own numbers", "", h("p", {}, "$1 $2"), ui.button("Use these")))],
    ["S7", page(fold("a", "how", "How this is worked out", "", h("p", {}, "One short line.")))],
    ["S9", page(h("form", {}, h("details", { class: "fold form-more" }, h("summary", {}, "More details (optional)"), h("input", { name: "x", required: true }))))],
    ["S12", page(h("p", {}, "You would owe undefined in April"))],
    ["S15", page(h("section", { class: "card", dataset: { parts: "" } }, h("div", { class: "folds" }, fold("a", "own", "Set my own numbers", "", h("p", {}, "$1 $2"), h("input", { name: "x" })))))],
  ];
  for (const [id, root] of cases) assert.ok(ids(structure(root, { key: "taxes/check" })).includes(id), `${id} should be found in ${JSON.stringify(structure(root, { key: "taxes/check" }))}`);
  assert.deepEqual(ids(handWritten(page(h("details", {}, h("summary", {}, "By hand")), h("details", { class: "fold form-more" }, h("summary", {}, "More details (optional)"))))), ["S10"]);
  // a notice a page moved on purpose (MOVED_NOTICES) is let through
  assert.deepEqual(structure(page(fold("a", "how", "How this is worked out", "", h("p", {}, "$1 $2"), ui.notice("info", "Kept here: the sources"))), { moved: ["Kept here"] }), []);
});

test("a page drawn with the helper as docs/OPTIONAL.md shows it passes every check, on a step of the path too", () => {
  for (const query of [{}, { guide: "plan" }]) {
    const ctx = ctxOf(query);
    const rows = Array.from({ length: 10 }, (_, i) => ({ name: `Account ${i + 1}`, value: (i + 1) * 100 }));
    const root = page(
      h("section", { class: "card hero" }, h("h1", {}, "You would owe about $5,253 in April")),
      parts(ctx,
        { id: "how", kind: "how", says: "11 steps", body: () => h("ol", {}, Array.from({ length: 11 }, (_, i) => h("li", {}, `Step ${i + 1}`))) },
        { id: "numbers", kind: "more", n: 4, noun: "numbers", body: () => ui.row(ui.stat("Tax", "$14,723"), ui.stat("Withheld", "$9,470")) },
        { id: "figures", kind: "own", title: "Figures the plan cannot see", set: 1, holds: ["withheld", "otherIncome", "credits"],
          body: ui.form([{ key: "withheld", label: "Federal tax withheld so far", type: "money" }, { key: "otherIncome", label: "Other income", type: "money" },
            { key: "credits", label: "Credits", type: "money" }], {}, () => { }) }),
      h("section", { class: "card" }, ...rest(ctx, { id: "accounts", items: rows, noun: "accounts", row: (r) => h("li", {}, `${r.name}: $${r.value}`) })),
      links(ctx, [{ href: "#/taxes/brackets", ask: "What would more income cost?", says: "22% on the next dollar" }]));
    assert.deepEqual(structure(root, { key: "taxes/check" }), [], JSON.stringify(query));
    assert.deepEqual(handWritten(root), []);
    const c = count(root);
    assert.equal(c.parts, query.guide ? 5 : 4, "three parts, the list's '4 more accounts', and on a step the links as one shut row");
  }
});

await defineShard(test, 1, K);
