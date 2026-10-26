// tests/search.test.mjs -- core/search.js: finding pages in the owner's own words (FEEDBACK F-007).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, words, matchRank, matches } from "../core/search.js";

const netWorth = { title: "Net worth", purpose: "Every account and balance in one list: what you own, what you owe, and the difference over time.", aliases: ["what I owe", "what I own", "how much am I worth", "assets and debts"] };
const debts = { title: "Debts", purpose: "Every loan and card with its rate and payment: what interest costs you and when each one is gone." };
const goals = { title: "Goals", purpose: "What you are saving for, by when, and what to put aside each month to get there." };

test("normalize turns first person into second person and drops punctuation", () => {
  assert.equal(normalize("What I owe?"), "what you owe");
  assert.equal(normalize("How much am I worth"), "how much are you worth");
  assert.equal(normalize("my mortgage, my car"), "your mortgage your car");
  assert.equal(normalize("I'm retired"), "you are retired");
  assert.equal(normalize("  "), "");
});
test("words drops stopwords", () => {
  assert.deepEqual(words("how much debt do I have"), ["debt"]);
  assert.deepEqual(words("what I owe"), ["owe"]);
});
test("first-person phrasing finds the page that says it in second person", () => {
  assert.equal(matchRank(netWorth, "Assets and debts", "what I owe"), 0, "alias hit");
  assert.equal(matchRank(netWorth, "Assets and debts", "what you owe"), 0, "the alias says the same after normalising");
  assert.equal(matchRank(netWorth, "Assets and debts", "difference over time"), 2, "purpose hit");
  assert.equal(matchRank(debts, "Assets and debts", "what I owe"), -1);
  assert.equal(matchRank(debts, "Assets and debts", "how much debt do I have"), 3, "word hit on the title");
  assert.equal(matchRank(goals, "Goals", "saving for"), 2);
  assert.equal(matchRank(goals, "Goals", "goal"), 0);
  assert.equal(matchRank(goals, "Goals", "spaceship"), -1);
  assert.equal(matchRank(goals, "Goals", ""), 0, "no query matches everything");
  assert.equal(matches(netWorth, "Assets and debts", "am I worth"), true);
});
test("a page without aliases or purpose still works", () => {
  assert.equal(matchRank({ title: "Docs" }, "System", "docs"), 0);
  assert.equal(matchRank({ title: "Docs" }, "System", "system"), 1);
  assert.equal(matchRank({ title: "Docs" }, "System", "nothing"), -1);
});
