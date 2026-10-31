import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, aliases, hide, restore, factSheet, allowedPages, buildPrompt, readAnswer, MAX_POINTS, LEVELS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-31";

test("stand-ins for names: adults then children in household order; names and account names hidden, then put back", () => {
  const p = familyPlan(TODAY);
  const names = aliases(p);
  assert.deepEqual(names, [{ name: "Ana", alias: "Adult 1" }, { name: "Bo", alias: "Adult 2" }, { name: "Cy", alias: "Child 1" }]);
  const visa = p.accounts.find((a) => a.type === "credit");
  const text = `Replace Bo's car; ${visa.name} at 23.9%; Ana and Bo; Anagram stays; Cy's college.`;
  const hidden = hide(text, p, names);
  assert.equal(hidden, `Replace Adult 2's car; the credit card at 23.9%; Adult 1 and Adult 2; Anagram stays; Child 1's college.`, "whole words only");
  assert.equal(restore("Adult 2 should name a guardian for Child 1; Adult 12 is not a person", names), "Bo should name a guardian for Cy; Adult 12 is not a person");
  assert.deepEqual(aliases(emptyPlan()), []);
});

test("the fact sheet: counts and ages, the health score's parts, the next steps, the estate papers; no names, no account names", () => {
  const p = familyPlan(TODAY);
  const s = factSheet(p, { today: TODAY });
  assert.equal(s.ready, true);
  const all = s.lines.join("\n");
  assert.match(s.lines[0], /^Household: Adult 1 \(age \d+\), Adult 2 \(age \d+\), Child 1 \(age \d+\); files taxes as married filing jointly; lives in TX\.$/);
  assert.match(all, /Plan health score: \d+ of 100/);
  for (const t of ["Cash cushion", "Saving each month", "Estate papers: 0 of 11 done", "Next step (do now)"]) assert.ok(all.includes(t), `has "${t}"`);
  assert.match(all, /Estate warning: No guardian is named for Child 1/);
  for (const name of [...p.household.people.map((x) => x.name), ...p.accounts.map((a) => a.name)]) assert.ok(!new RegExp(`\\b${name}\\b`).test(all), `"${name}" is not sent`);
  assert.ok(!/p-ana|acct-|@/.test(all), "no ids or emails");
  assert.deepEqual(factSheet(emptyPlan(), { today: TODAY }), { lines: [], names: [], ready: false });
});

test("the pages the AI may name: built ones only, never this page", () => {
  const pages = allowedPages([{ key: "ai/critic", status: "usable" }, { key: "a/b", status: "usable" }, { key: "c/d", status: "stub" }, { key: "e/f", status: "planned" }, null]);
  assert.deepEqual(pages.map((x) => x.key), ["a/b", "c/d"]);
});

test("the question holds the facts and the page list, and asks for JSON points tied to a page", () => {
  const q = buildPrompt(["Household: Adult 1 (age 40).", "Cash cushion (a problem): 0.9 months."], [{ key: "balance/liquidity", title: "Liquidity", purpose: "How long your cash lasts." }]);
  assert.match(q.system, /JSON only/); assert.match(q.system, new RegExp(`at most ${MAX_POINTS}`)); assert.match(q.system, /never invent numbers/);
  assert.match(q.user, /- Household: Adult 1 \(age 40\)\./); assert.match(q.user, /balance\/liquidity: Liquidity, How long your cash lasts\./);
});

test("the answer read back: titles kept in order, unknown pages dropped, levels checked, names put back, at most 8", () => {
  const pages = [{ key: "balance/liquidity" }, { key: "estate/documents" }];
  const names = [{ name: "Cy", alias: "Child 1" }];
  const text = `Sure! [{"title":"Name a guardian for Child 1","why":"No  guardian is named.","page":"estate/documents","level":"high"},
    {"title":"Build the cash cushion","why":"0.9 months of bills.","page":"balance/liquidity","level":"urgent"},
    {"title":"Buy Acme insurance","page":"made/up","level":"low"},
    {"title":"name a guardian for child 1","page":"estate/documents"},
    {"why":"no title"}, "text", null]`;
  const r = readAnswer(text, pages, names);
  assert.deepEqual(r, [
    { title: "Name a guardian for Cy", why: "No guardian is named.", page: "estate/documents", level: "high" },
    { title: "Build the cash cushion", why: "0.9 months of bills.", page: "balance/liquidity", level: "medium" },
    { title: "Buy Acme insurance", why: "", page: null, level: "low" },
  ], "the repeat (any case, before names come back) and the untitled ones are dropped");
  const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ title: `Point ${i}`, page: "balance/liquidity", level: "low" })));
  assert.equal(readAnswer(many, pages).length, MAX_POINTS);
  assert.deepEqual(readAnswer("I could not find any problems.", pages), []); assert.deepEqual(readAnswer("[{broken", pages), []);
  assert.deepEqual(Object.keys(LEVELS), ["high", "medium", "low"]);
});

test("ready once someone is in the household", () => {
  assert.deepEqual(compute(emptyPlan()), { ready: false, people: 0, adults: 0 });
  assert.deepEqual(compute(familyPlan(TODAY)), { ready: true, people: 3, adults: 2 });
});
