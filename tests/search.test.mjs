// tests/search.test.mjs -- core/search.js: finding pages in the owner's own words (FEEDBACK F-007).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, words, matchRank, matches, stem, cleanQuery, closeShare } from "../core/search.js";

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
    // round 4, 2026-11-02: a freelancer's and a retiree's questions
    ["how much should I set aside for taxes", "taxes/estimated"], ["how much to take out", "retirement/withdrawal-strategy"],
    ["required withdrawal", "retirement/rmd"], ["credit score", "debt/credit-cards"],
  ]) assert.ok(among(q, key), `"${q}" finds ${key} first (got ${top(q).slice(0, 3).map((x) => `${x.k}:${x.r}`).join(", ") || "nothing"})`);
  assert.notEqual(top("buy a home")[0].k, "overview/dashboard", "a one-word alias (home) does not match inside a longer question");
});
test("stems and synonyms: saving, savings and save are one word; house finds home", () => {
  assert.equal(stem("savings"), stem("save")); assert.equal(stem("saving"), stem("save"));
  assert.equal(stem("house"), stem("home")); assert.equal(stem("kids"), stem("child"));
  assert.equal(matchRank({ title: "Home", purpose: "what it is worth" }, "Property", "my house worth"), 3);
});

// the third phone walk-through (2026-11-02): whole questions as people type them, with names and amounts in them
test("whole questions: names and amounts are left out, everyday phrases find the page first, the rest find the closest pages", async () => {
  const { default: registry } = await import("../modules/registry.js");
  const { GROUPS } = await import("../core/groups.js");
  const pages = [];
  for (const e of registry) { const m = (await e.load()).default; if (!m.placeholder) pages.push(m); }
  const title = (g) => GROUPS.find((x) => x.id === g)?.title ?? g;
  const ignore = ["Ana", "Bo", "Cy"];
  const top = (q) => pages.map((m) => ({ k: `${m.group}/${m.id}`, r: matchRank(m, title(m.group), q, { ignore }) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r);
  const among = (q, key) => { const t = top(q); return t.filter((x) => x.r === t[0]?.r).map((x) => x.k).includes(key); };
  for (const [q, key] of [
    ["How much do we have?", "balance/net-worth"], ["When will the credit card be paid off?", "debt/payoff"],
    ["Are we spending more than last month?", "cashflow/spending"], ["How much will college cost for Cy?", "goals/education"],
    ["Is our will up to date?", "estate/documents"], ["What do we pay for subscriptions?", "cashflow/subscriptions"],
    ["Can we afford a $30,000 car?", "goals/vehicle"], ["bigger house", "goals/house"], ["second child", "household/life-events"],
    ["take a pay cut", "career/offer-compare"], ["How do I make a budget?", "cashflow/budget"], ["What do I do first?", "overview/next-best-action"],
    ["Should I pay off my mortgage early?", "debt/mortgage"], ["Do we have enough insurance?", "insurance/life-needs"],
  ]) assert.ok(among(q, key), `"${q}" finds ${key} first (got ${top(q).slice(0, 3).map((x) => `${x.k}:${x.r}`).join(", ") || "nothing"})`);
  assert.equal(cleanQuery("Can we afford a $30,000 car?"), "can you afford a car");
  assert.equal(cleanQuery("Bo's 401k and the 529", ["Bo"]), "401k and the 529", "401k and 529 are words, not amounts");
  assert.equal(cleanQuery("save 72k or 1,500", []), "save or");
  assert.ok(top("Cy").length < pages.length, "only a name: searched as typed, not every page");
  // no page has every word: the closest pages, never for a single word
  const share = (q, key) => { const m = pages.find((x) => `${x.group}/${x.id}` === key); return closeShare(m, title(m.group), q, { ignore }); };
  assert.ok(share("lower my grocery spending", "cashflow/expenses") >= 0.5, "spending and groceries are in Expenses words");
  assert.ok(share("how do we cut grocery spending", "career/offer-compare") < 0.5, "one word of a phrase (pay cut) is not enough");
  assert.equal(share("Cy", "goals/education"), 0, "only a name: nothing meaningful left");
});
