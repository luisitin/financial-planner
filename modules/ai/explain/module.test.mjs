import { test } from "node:test";
import assert from "node:assert/strict";
import { digest, sheetFor, explainable, buildMessages, readAnswer, compute, words, MAX_LINES, MAX_ITEMS, SKIP } from "./compute.js";
import { compute as netWorth } from "../../balance/net-worth/compute.js";
import { compute as income } from "../../cashflow/income/compute.js";
import { compute as goals } from "../../goals/goals/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-31";
const plan = () => familyPlan(TODAY);
const REAL = /\b(Ana|Bo|Cy|Chase|Ally|Visa)\b/;

test("the digest: a part's own numbers first (rounded to the cent), yes/no, words for keys, ids and free text left out", () => {
  const d = digest({ parts: { inner: 1 }, netWorth: 1234.567, ok: true, label: "  Fine  ", id: "x1", note: "private words", go: ["a", "b"], nothing: null, nan: NaN });
  assert.deepEqual(d.lines, ["net worth: 1234.57", "ok: yes", "label: Fine", "parts › inner: 1"]);
  assert.equal(d.cut, false);
  for (const k of ["id", "note", "go", "phone", "email", "where", "who"]) assert.ok(SKIP.has(k), k);
  assert.equal(words("sinceLastPct"), "since last pct");
  assert.equal(words("dti_ratio"), "dti ratio");
});

test("the digest: lists of records (how many, the first few, a label instead of its code), a list repeated, long lists of numbers", () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}`, name: `Item ${i}`, type: "salary", typeLabel: "Pay from a job", amount: i * 10, rate: { apr: 0.2, id: "r" } }));
  const d = digest({ items, active: items, path: Array.from({ length: 30 }, (_, i) => i * 1.5), few: [1, 2.345], tags: ["a", "b"] });
  assert.deepEqual(d.lines.slice(0, 3), ["path: 30 values, first 0, last 43.5, lowest 0, highest 43.5", "few: 1, 2.35", "tags: a, b"], "short lists of values before lists of records");
  assert.equal(d.lines[3], "items (9 in all):");
  assert.equal(d.lines[4], "  1. name Item 0; type label Pay from a job; amount 0; rate apr 0.2");
  assert.equal(d.lines[4 + MAX_ITEMS], `  and ${9 - MAX_ITEMS} more`);
  assert.equal(d.lines[5 + MAX_ITEMS], "active: the same 9 as items");
});

test("the digest stops at MAX_LINES and says something was left out; anything deeper than the depth limit is left out", () => {
  const big = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]));
  const d = digest(big);
  assert.equal(d.cut, true);
  assert.equal(d.lines.length, MAX_LINES + 1);
  assert.equal(d.lines.at(-1), "(more numbers on the page were left out)");
  assert.deepEqual(digest({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }).lines, []);
  assert.deepEqual(digest(null).lines, []);
});

test("what the AI reads for a page: its own compute on a renamed copy; no real names of people or accounts; numbers unchanged", () => {
  for (const run of [(c) => netWorth(c, { today: TODAY }), (c) => income(c, { today: TODAY }), (c) => goals(c, { today: TODAY })]) {
    const s = sheetFor(plan(), run, { today: TODAY });
    assert.equal(s.ok, true);
    assert.ok(!REAL.test(s.lines.join("\n")), s.lines.find((l) => REAL.test(l)));
  }
  const nw = sheetFor(plan(), (c) => netWorth(c, { today: TODAY }), { today: TODAY });
  assert.ok(nw.lines.includes(`net worth: ${netWorth(plan(), { today: TODAY }).netWorth}`), "the same figure the page shows");
  const inc = sheetFor(plan(), (c) => income(c, { today: TODAY }), { today: TODAY });
  assert.ok(inc.lines.some((l) => l.includes("Adult 1's salary")), "names in text are swapped for the stand-ins");
  assert.ok(inc.names.some((n) => n.alias === "Adult 1"), "the names to put back");
});

test("a page whose compute fails, or that has no numbers yet, says so instead of sending nothing", () => {
  assert.equal(sheetFor(plan(), () => { throw new Error("boom"); }).why, "error");
  assert.equal(sheetFor(plan(), () => ({ error: "Error: boom" })).why, "error", "the shell's way of reporting a failed compute");
  const empty = sheetFor(emptyPlan(), () => ({ ready: false, items: [] }));
  assert.deepEqual([empty.ok, empty.why], [false, "empty"]);
});

test("the pages offered: built, with a compute, not system or AI pages, not contacts or where papers are kept", () => {
  const pages = [
    { key: "balance/net-worth", group: "balance", status: "usable", hasCompute: true },
    { key: "goals/vehicle", group: "goals", status: "planned", hasCompute: true },
    { key: "system/settings", group: "system", status: "usable", hasCompute: true },
    { key: "ai/critic", group: "ai", status: "usable", hasCompute: true },
    { key: "household/contacts", group: "household", status: "usable", hasCompute: true },
    { key: "overview/dashboard", group: "overview", status: "stub", hasCompute: true },
    { key: "x/no-compute", group: "x", status: "usable", hasCompute: false },
  ];
  assert.deepEqual(explainable(pages).map((p) => p.key), ["balance/net-worth", "overview/dashboard"]);
  assert.deepEqual(explainable(undefined), []);
});

test("the question: the page, its numbers, and the person's question with names hidden (or the default question)", () => {
  const s = sheetFor(plan(), (c) => netWorth(c, { today: TODAY }), { today: TODAY });
  const m = buildMessages({ title: "Net worth", purpose: "What you own minus what you owe.", lines: s.lines, question: "Why is Ana's 401(k) so big compared with the Chase checking?", terms: s.terms });
  assert.equal(m[0].role, "system");
  assert.match(m[0].content, /never invent/);
  assert.match(m[1].content, /^PAGE: Net worth \(What you own minus what you owe\.\)/);
  assert.match(m[1].content, /- net worth: \d+/);
  assert.ok(!REAL.test(m[1].content), m[1].content.split("QUESTION:")[1]);
  assert.match(m[1].content, /QUESTION: Why is Adult 1's/);
  assert.match(buildMessages({ title: "T", lines: [] })[1].content, /QUESTION: What does this page tell me about my money\?$/);
  assert.equal(buildMessages({ title: "T", lines: [], question: "x".repeat(500) })[1].content.split("QUESTION: ")[1].length, 300, "cut to MAX_QUESTION");
});

test("the answer: a reasoning model's thinking dropped, the real names put back, tidy, never empty-looking", () => {
  const s = sheetFor(plan(), (c) => income(c, { today: TODAY }), { today: TODAY });
  const a = readAnswer("<think>working…</think>\n\nAdult 1 earns most.   \n\n\n\nThe checking account holds cash.", s.names);
  assert.equal(a, "Ana earns most.\n\nThe checking account (Chase checking) holds cash.");
  assert.equal(readAnswer("reasoning only</think>Done.", []), "Done.");
  assert.equal(readAnswer("  ", []), "");
  assert.equal(readAnswer(undefined), "");
  assert.ok(readAnswer("y".repeat(5000)).length <= 3000);
});

test("compute: ready once the plan has people, accounts, income or spending", () => {
  assert.equal(compute(emptyPlan()).ready, false);
  assert.equal(compute(plan()).ready, true);
  assert.equal(compute(undefined).ready, false);
});
