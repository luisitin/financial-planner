// Follow-up 2026-11-07 (batch 5b follow-up A): one plain way of saying how often the money lasts. No page says "markets" for a pretend
// run of years ("9 of 10 markets", "every market tried", "simulated markets", "100 markets"); every page that shows the odds takes its
// words from modules/retirement/odds.js. Source scan of the views and computes a person reads (comments may keep the old wording).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chanceWords, BAD_RUN, BAD_RUN_NOTE } from "../modules/retirement/odds.js";

const root = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");
// code and strings only: whole-line comments are dropped
const code = (p) => read(p).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

const PAGES = ["modules/retirement/projection/view.js", "modules/retirement/withdrawal-strategy/view.js", "modules/retirement/rmd/view.js", "modules/retirement/fire/view.js",
  "modules/retirement/monte-carlo/view.js", "modules/reports/retirement/view.js", "modules/scenarios/advisor-plan/view.js", "modules/scenarios/compare/view.js",
  "modules/retirement/careful.js", "modules/retirement/odds.js", "modules/overview/quick/compute.js"];

test("no page says 'markets' for a try: no '9 of 10 markets', 'every market tried', 'simulated markets' or 'N markets'", () => {
  for (const p of PAGES) {
    const c = code(p);
    for (const bad of [/\d+ of \d+ markets/i, /every market tried/i, /simulated markets?/i, /of 100 markets/i, /in 9 of 10/i, /fewer than 9 in 10/i, /\b\d+ in 10 markets/i]) assert.ok(!bad.test(c), `${p}: ${bad}`);
  }
});

test("the pages that show the odds take their words from the shared helper", () => {
  for (const p of ["modules/retirement/projection/view.js", "modules/retirement/withdrawal-strategy/view.js", "modules/retirement/rmd/view.js", "modules/retirement/fire/view.js"]) {
    assert.ok(/BAD_RUN|chanceWords/.test(code(p)) && /from "\.\.\/careful\.js"/.test(code(p)), p);
  }
  assert.ok(/export \{ chanceWords, BAD_RUN, BAD_RUN_NOTE \}/.test(code("modules/retirement/careful.js")));
});

test("the words: even in a bad run of years, about half the time, in about N of 10 pretend futures; the number beside it where it helps", () => {
  assert.equal(BAD_RUN, "even in a bad run of years"); assert.equal(BAD_RUN_NOTE, "(only 1 in 10 is worse)");
  assert.equal(chanceWords(0.93), "even in a bad run of years (93 of 100 pretend futures last)");
  assert.equal(chanceWords(0.93, { exact: false }), "even in a bad run of years");
  assert.equal(chanceWords(1), "in every pretend future we ran");
  assert.equal(chanceWords(0.5), "about half the time (50 of 100 pretend futures last)");
  assert.equal(chanceWords(0.38), "in about 3 of 10 pretend futures (38 of 100)");
  assert.equal(chanceWords(0.05, { exact: false }), "in fewer than 1 of 10 pretend futures");
  // the share is rounded down: a hair under 90% never reads as a bad-run answer
  assert.equal(chanceWords(0.8999), "in about 8 of 10 pretend futures (89 of 100)");
  assert.equal(chanceWords(0.9), "even in a bad run of years (90 of 100 pretend futures last)");
  // nothing else in the sentence is a technical word
  for (const s of [0, 0.05, 0.38, 0.5, 0.65, 0.9, 0.99, 1]) assert.ok(!/market|simulat|path|percent|stochastic/i.test(chanceWords(s)), String(s));
});
