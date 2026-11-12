// tests/search-words.test.mjs -- wave 1 (the touch stress test, 2026-11-11, SH-SEARCH N5 and x-3): a word is found as a
// whole word or at the start of a longer word, never inside a word; the page named for the word comes first
// (core/search.js matchScore; matchRank keeps its levels as floor(matchScore)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRank, matchScore, hasWords } from "../core/search.js";

const vehicles = { group: "property", id: "vehicles", title: "Vehicles", purpose: "What your cars cost to keep." };
const career = { group: "career", id: "salary", title: "Career and pay", purpose: "Raises and job changes." };
const medicare = { group: "retirement", id: "medicare", title: "Medicare and IRMAA", purpose: "When to sign up for Medicare." };
const healthcare = { group: "retirement", id: "healthcare", title: "Healthcare before 65", purpose: "Health insurance between retiring and Medicare." };
const cards = { group: "debt", id: "credit-cards", title: "Credit cards", purpose: "What each card costs." };
const payoff = { group: "debt", id: "payoff", title: "Pay off debts", purpose: "Which debt first." };
const consolidation = { group: "debt", id: "consolidation", title: "Consolidation", purpose: "Roll cards into one cheaper loan." };
const wills = { group: "estate", id: "documents", title: "Estate documents", purpose: "Your will and power of attorney." };
const projection = { group: "retirement", id: "projection", title: "Will the money last?", purpose: "Retirement year by year.", aliases: ["retirement", "retire", "when can I retire"] };
const ss = { group: "retirement", id: "social-security", title: "Social Security", purpose: "What claiming at each age pays.", aliases: ["social security", "benefit at 62", "benefit at 70"] };
const budget = { group: "cashflow", id: "budget", title: "Budget", purpose: "An envelope for each kind of spending.", aliases: ["budget", "envelopes"] };
const expenses = { group: "cashflow", id: "expenses", title: "Expenses", purpose: "Your regular spending by category.", aliases: ["spending", "bills", "budget"] };
const fiftyThirty = { group: "cashflow", id: "budget-percent", title: "Budget (50/30/20)", purpose: "Needs, wants and savings." };
const contacts = { group: "household", id: "contacts", title: "Contacts", purpose: "Lists your advisor, accountant and insurers." };
const papers = { group: "household", id: "documents", title: "Document vault index", purpose: "Where your papers are kept." };
const calendar = { group: "household", id: "calendar", title: "Money calendar", purpose: "Bills, paydays and tax deadlines." };
const settings = { group: "system", id: "settings", title: "Settings", purpose: "Turn pages on or off, download or restore a copy." };

const order = (pages, q, topic = "") => pages.map((m) => ({ m, s: matchScore(m, topic, q) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s).map((x) => x.m.id);

test("a short word inside another word is not a hit ('car' in Medicare)", () => {
  assert.equal(matchRank(medicare, "Retirement", "car"), -1);
  assert.ok(matchRank(vehicles, "Property", "car") >= 0, "car finds Vehicles through 'cars' (the same stem)");
});
test("a whole word ranks before the start of a longer word ('car': Vehicles before Career)", () => {
  assert.ok(matchScore(vehicles, "Property", "car") < matchScore(career, "Career", "car"));
  assert.equal(matchRank(career, "Career", "car"), 0, "typing 'car' on the way to 'career' still finds it, lower down");
});
test("the page's own name beats the same word in one of its search phrases ('card')", () => {
  assert.ok(matchScore(cards, "Debt", "card") < matchScore(payoff, "Debt", "card"));
});
test("a phrase that is exactly the word ranks first ('will': the wills page before Will the money last?)", () => {
  assert.ok(matchScore(wills, "Estate", "will") < matchScore(projection, "Retirement", "will"));
});
test("the plain words a person types for the household and settings pages find them (who to call, papers, reminder, reset)", () => {
  assert.equal(matchRank(contacts, "Household", "who to call"), 0);
  assert.equal(matchRank(contacts, "Household", "phone"), 0);
  assert.equal(matchRank(papers, "Household", "papers"), 0);
  assert.equal(matchRank(calendar, "Household", "reminder"), 0);
  assert.equal(matchRank(settings, "System", "reset"), 0);
});
test("hasWords: a topic name holds the word, or a word starting with it", () => {
  assert.ok(hasWords("Career and income", "car"));
  assert.ok(hasWords("Taxes", "tax"));
  assert.ok(!hasWords("Medicare", "car"));
});
test("'budget': the page called Budget first, then the page whose phrase is the word, then a name holding it (breaker S5)", () => {
  assert.deepEqual(order([fiftyThirty, expenses, budget], "budget"), ["budget", "expenses", "budget-percent"]);
});
test("'cards': a phrase word found only by its stem is not a name-level hit (Help's own directory order holds)", () => {
  assert.deepEqual(order([payoff, consolidation], "cards"), ["consolidation", "payoff"]);
  assert.equal(matchRank(payoff, "Debt", "cards"), 3, "Pay off debts is still found, lower down");
});
test("'health care' finds both health pages by name; 'care' alone finds them, never by the letters inside Medicare", () => {
  assert.equal(matchRank(medicare, "Retirement", "health care"), 0);
  assert.equal(matchRank(healthcare, "Retirement", "health care"), 0);
  assert.equal(matchRank(medicare, "Retirement", "care"), 0, "through its phrase 'health care'");
});
test("'retire at 62' puts Will the money last? before Social Security (it found only Social Security)", () => {
  assert.deepEqual(order([ss, projection], "retire at 62", "Retirement"), ["projection", "social-security"]);
  assert.equal(matchRank(projection, "Retirement", "when can I stop working"), 0);
});
test("'debt payoff' (and 'debt pay' on the way) puts Pay off debts first; 'language' finds Settings (tapmenu, fix-1)", () => {
  const nwProjection = { group: "balance", id: "projection", title: "Net worth projection", purpose: "Net worth in the years ahead: savings growing and spent in retirement, the home's value, debts paid down, in today's money." };
  const register = { group: "balance", id: "assets", title: "Asset register", purpose: "Lists your home, cars and belongings with what you paid, what each is worth now and which policy covers it." };
  for (const q of ["debt payoff", "debt pay", "payoff"]) assert.equal(order([nwProjection, register, cards, consolidation, payoff], q, "Debt")[0], "payoff", q);
  assert.equal(matchRank(settings, "System", "language"), 0);
});

// The gate before `main` moves (tools/main-gate.mjs -> qa/flows/static-skew.mjs syntheticShellChange) makes a pretend
// deploy by editing these lines as they stand; a line it cannot find exactly once stops every push to main. Wave 1
// changes both files, so the lines are pinned here (found by the integration run: All pages' import line had grown).
test("the lines the gate before main edits are still there, once each (All pages and the shell)", async () => {
  const fs = await import("node:fs");
  const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  const once = (rel, line) => assert.equal(read(rel).split(line).length - 1, 1, `${rel} must hold this line exactly once: ${line.trim()}`);
  once("modules/overview/pages/view.js", 'import { matches } from "../../../core/search.js";\n');
  once("modules/overview/pages/view.js", "  const build = ctx.view.build;");
  once("core/app.js", "    openSearch,\n");
  const skew = read("qa/flows/static-skew.mjs");
  for (const line of ['import { matches } from "../../../core/search.js";\\n', "  const build = ctx.view.build;", "    openSearch,\\n"]) assert.ok(skew.includes(line), `qa/flows/static-skew.mjs still edits: ${line}`);
});
