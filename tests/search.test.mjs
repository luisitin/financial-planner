// tests/search.test.mjs -- core/search.js: finding pages in the owner's own words (FEEDBACK F-007).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, words, matchRank, matches, stem } from "../core/search.js";

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

// the real pages: everyday questions from a phone walk-through (2026-11-01) that used to find nothing, or the wrong page first
test("plain questions find the page that answers them, first", async () => {
  const { default: registry } = await import("../modules/registry.js");
  const { GROUPS } = await import("../core/groups.js");
  const pages = [];
  for (const e of registry) { const m = (await e.load()).default; if (!m.placeholder) pages.push(m); }
  const title = (g) => GROUPS.find((x) => x.id === g)?.title ?? g;
  const top = (q) => pages.map((m) => ({ k: `${m.group}/${m.id}`, r: matchRank(m, title(m.group), q) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r);
  const firstRank = (q) => top(q)[0]?.r;
  const among = (q, key) => top(q).filter((x) => x.r === firstRank(q)).map((x) => x.k).includes(key);
  for (const [q, key] of [
    ["safety cushion", "goals/emergency-fund"], ["next move", "overview/next-best-action"], ["can we afford a house", "goals/house"],
    ["are we saving enough", "retirement/projection"], ["lose my job", "balance/liquidity"], ["will our money last", "retirement/projection"],
    ["stock from work", "career/equity"], ["left over", "cashflow/expenses"], ["update balances", "balance/update"],
    ["how much tax", "taxes/federal"], ["debt free", "debt/payoff"], ["monthly check-in", "overview/monthly-review"],
    ["buy a home", "goals/house"], ["what I owe", "balance/net-worth"],
  ]) assert.ok(among(q, key), `"${q}" finds ${key} first (got ${top(q).slice(0, 3).map((x) => `${x.k}:${x.r}`).join(", ") || "nothing"})`);
  assert.notEqual(top("buy a home")[0].k, "overview/dashboard", "a one-word alias (home) does not match inside a longer question");
});
test("stems and synonyms: saving, savings and save are one word; house finds home", () => {
  assert.equal(stem("savings"), stem("save")); assert.equal(stem("saving"), stem("save"));
  assert.equal(stem("house"), stem("home")); assert.equal(stem("kids"), stem("child"));
  assert.equal(matchRank({ title: "Home", purpose: "what it is worth" }, "Property", "my house worth"), 3);
});
