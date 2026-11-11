// tests/wording-left.test.mjs -- the sentences the wording sweep could not finish because each is built from figures and
// conditions (follow-up 2026-11-07, "wording follow-up" in the READMEs). Each test renders the page for the invented family
// (qa/fixtures/family-plan.mjs) and pins the sentence as a person reads it; the figure-format decisions (one rounding for the
// month, whole months, words not abbreviations, scores in words) are pinned across every page that shows the figure.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pageText } from "../qa/fixtures/fake-dom.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { monthsText, monthsWords, yearsMonthsWords } from "../core/format.js";
import { needsWords } from "../core/words.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const T = "2026-11-07";
// every page's compute, so a view that asks another page (computeOf) gets the real answer
const computeOf = {};
for (const g of fs.readdirSync(path.join(ROOT, "modules"))) {
  if (g.startsWith("_") || !fs.statSync(path.join(ROOT, "modules", g)).isDirectory()) continue;
  for (const id of fs.readdirSync(path.join(ROOT, "modules", g))) {
    const f = path.join(ROOT, "modules", g, id, "compute.js");
    if (!fs.existsSync(f)) continue;
    try { const m = await import(pathToFileURL(f).href); if (m.compute) computeOf[`${g}/${id}`] = m.compute; } catch { /* a page that needs the browser */ }
  }
}
const text = (page, plan = familyPlan(T)) => pageText(new URL(`../modules/${page}/view.js`, import.meta.url), plan, T, { computeOf, computeRemote: computeOf });

test("n01, n02: one rounding for the month on every page: to the dollar, as the Dashboard says it", async () => {
  const pages = ["overview/next-best-action", "overview/health-score", "reports/plan-summary", "reports/annual-review", "overview/monthly-review", "cashflow/budget", "cashflow/budget-percent", "balance/liquidity", "cashflow/income-statement"];
  const seen = {};
  for (const p of pages) {
    const t = await text(p);
    for (const bad of ["$3,880", "$1,320", "$5,830", "$4,770", "$570"]) assert.ok(!t.includes(bad), `${p} rounds the month to ten dollars: ${bad}`);
    for (const good of ["$3,884", "$1,318", "$5,826", "$4,768", "$568"]) if (t.includes(good)) seen[good] = (seen[good] ?? 0) + 1;
  }
  assert.ok(Object.keys(seen).length === 5 && Object.values(seen).every((n) => n >= 2), JSON.stringify(seen));
});

test("n03: the plan summary says the net worth the Dashboard and Net worth say, to the dollar", async () => {
  const t = await text("reports/plan-summary");
  assert.match(t, /you own \$572,700 and owe \$285,600: a net worth of \$287,100/);
  assert.ok(!t.includes("$287,000"));
});

test("n04: months are whole numbers (one decimal only under 2), never '11.0' or '6.0'", async () => {
  assert.equal(monthsText(11.04), "11"); assert.equal(monthsText(6), "6"); assert.equal(monthsText(0.9), "0.9"); assert.equal(monthsText(1.96), "2"); assert.equal(monthsText(120), "100+");
  assert.equal(monthsWords(1), "1 month"); assert.equal(monthsWords(6.0), "6 months"); assert.equal(monthsWords(0.86), "0.9 months");
  const t = await text("overview/benchmarks");
  assert.match(t, /aim 6 months/);
  assert.doesNotMatch(t, /\b\d+\.0 months?\b/);
});

test("n05: years and months in words, a year and a month spelled out", async () => {
  assert.equal(yearsMonthsWords(31), "2 years 7 months"); assert.equal(yearsMonthsWords(12), "1 year"); assert.equal(yearsMonthsWords(13), "1 year 1 month");
  assert.equal(yearsMonthsWords(5), "5 months"); assert.equal(yearsMonthsWords(0), "0 months"); assert.equal(yearsMonthsWords(Infinity), "never"); assert.equal(yearsMonthsWords(NaN), "never");
  const t = await text("debt/mortgage");
  assert.doesNotMatch(t, /\d+ yr\b|\d+ mo\b|\/mo\b|\/yr\b/, t.match(/.{30}(\d+ yr|\d+ mo|\/mo|\/yr).{20}/)?.[0]);
  const subs = fs.readFileSync(path.join(ROOT, "modules/cashflow/subscriptions/view.js"), "utf8");
  assert.ok(subs.includes("} a year`") && !subs.includes("}/yr`"));
});

test("n08: a score is said in words: 'out of', the same on every page", async () => {
  const t = await text("reports/plan-summary");
  assert.match(t, /Plan health: \d+ out of 100 \(\w+\)\./);
  assert.match(t, /Plan health: \d+ out of 100 Part Points/);
  assert.match(t, /Emergency fund [\d.]+ out of 15/);
  assert.doesNotMatch(t, /\d+ of 100|[\d.]+ \/ \d+/);
  const h = await text("overview/health-score");
  assert.match(h, /: \d+ out of 100/); assert.match(h, /[\d.]+ out of 15/); assert.doesNotMatch(h, /[\d.]+ \/ 15/);
  assert.match(h, /You can gain the most points in "[^"]+"( and "[^"]+")?\./);
});

test("p058: cash is months of bills, with the aim after it; never '0.8 of 6 months'", async () => {
  const plan = familyPlan(T);
  const t = await text("balance/liquidity", plan);
  assert.doesNotMatch(t, /covers [\d.]+ of the \d+ months/);
  const { ROWS } = await import("../modules/overview/plan/compute.js");
  const low = ROWS.cushion({ st: () => ({ runway: 0.8, runwayTarget: 6, runwayStatus: "bad" }) });
  assert.equal(low.short, "about 0.8 months of bills in cash (the aim is 6 months)");
});

test("p036, p110, p111: loan page, college page and a guess, in plain words", async () => {
  const reno = fs.readFileSync(path.join(ROOT, "modules/property/renovation/view.js"), "utf8");
  assert.ok(reno.includes("allows for the ") && reno.includes("a long, cheap loan can beat a short, expensive one") && !/ dear /.test(reno));
  const edu = await text("goals/education");
  assert.match(edu, /a month for about \d+ years/); assert.doesNotMatch(edu, /for \d+\.\d years/);
  const { estimators } = await import("../modules/overview/guesses/compute.js");
  assert.ok(typeof estimators === "object");
  const saving = fs.readFileSync(path.join(ROOT, "modules/overview/guesses/estimators/saving.js"), "utf8");
  assert.ok(saving.includes("for someone ") && saving.includes("aged ${prof.age}") && saving.includes("with your income") && !saving.includes("with your pay") && !saving.includes("typical bank balance ${"));
});

test("l001: what a page still needs is one sentence with a count, the same on every page", () => {
  const items = ["a birth date on the People page", "your accounts on the Net worth page", "what you will spend in retirement (a figure here, or your expenses on the Expenses page)"];
  assert.equal(needsWords("First, the plan needs", items), "First, the plan needs three things: a birth date on the People page, your accounts on the Net worth page, and what you will spend in retirement (on the Expenses page, or on the Will the money last? page).");
  assert.equal(needsWords("To compare, your plan needs", items.slice(0, 2)), "To compare, your plan needs two things: a birth date on the People page and your accounts on the Net worth page.");
  assert.equal(needsWords("It needs", items.slice(0, 1)), "It needs a birth date on the People page.");
  assert.equal(needsWords("First, the plan needs", ["a person with a birth date on the People page", "your accounts on the Net worth page", "what you will spend in retirement (a figure here, or your expenses on the Expenses page)"]), needsWords("First, the plan needs", items));
});

test("l004, l005, l013: Medicare, risk and limits read as sentences", async () => {
  const m = await text("retirement/medicare");
  assert.match(m, /Each person pays about \$436 a month: Part B \$203, a drug plan \$39 and a supplement \$194, plus the Part B deductible of \$283 a year when you use it\. You have not entered a supplement, so the page uses the 2025 national average for Medigap Plan G; type yours below\./);
  const r = await text("investments/risk");
  assert.match(r, /on your \$177,000: since 1871, a mix like this has averaged 8\.1% a year, with a typical swing of 13% up or down\. It lost money in 23% of years; its worst year was 1931 \(-31%, or \$55,673 of yours\)\./);
  const lim = fs.readFileSync(path.join(ROOT, "modules/investments/limits/view.js"), "utf8");
  assert.ok(lim.includes("This year each person may put ${money(d.base[\"401k\"])} into a 401(k)") && lim.includes("with family coverage). From age 50 you can put in more (from 55 for the HSA)."), "limits sentence");
});

test("w003, w028, p106: Life insurance needs says when, with whom and what was taken out", async () => {
  const t = await text("insurance/life-needs");
  assert.match(t, /money would run out when Bo is \d+\./);
  assert.match(t, /with Bo spending 75% of what the two of you spend together, after paying for a funeral of about \$8,300\./);
  assert.match(t, /\(about \$[\d,]+ a year, after taking out Ana's own spending\)/);
  assert.doesNotMatch(t, /themself/);
});

test("w020, j021: the state is named, and portability is explained", async () => {
  const t = await text("estate/estate-tax");
  assert.match(t, /Texas has no estate or inheritance tax of its own\./);
  assert.doesNotMatch(t, /\bTX has\b/);
  const src = fs.readFileSync(path.join(ROOT, "modules/estate/estate-tax/view.js"), "utf8");
  assert.ok(src.includes("is measured against the survivor's own") && src.includes("whatever the first spouse did not use") && src.includes('called "portability"'));
});

test("j005, j037: tax pages say 'taxable income' and 'brackets', not ordinary income, ladder or rung", async () => {
  const b = await text("taxes/brackets");
  assert.match(b, /Each rate applies only to the dollars inside its bracket: overall you pay [\d.]+%\./);
  assert.match(b, /The 2026 brackets/);
  assert.doesNotMatch(b, /\bladder\b|\brung\b|ordinary/i);
  const r = await text("reports/tax");
  assert.match(r, /Your next dollar of regular income is taxed at \d+%/);
  assert.doesNotMatch(r, /ordinary/i);
});

test("w010, p061: years in each bracket and 'until Ana would be about 97'", async () => {
  const p = await text("taxes/projection");
  assert.match(p, /Years by bracket/);
  const src = fs.readFileSync(path.join(ROOT, "modules/taxes/projection/view.js"), "utf8");
  assert.ok(src.includes(" in the ${fmt.pct(x.rate, 0)} bracket`"));
  const lg = await text("retirement/longevity");
  // the advice is a button now, and People a button beside it (stress test 2026-11-11, RC-6)
  assert.match(lg, /until Ana would be about \d+( \(\d{4}\))?\. Your plan runs to \d{4} now\. Plan to \d{4} instead of \d{4} Change ages on People ›/);
});

test("w035, w017, m005, m007: sentences with a clause that reads on its own", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.ok(read("modules/retirement/withdrawal-strategy/view.js").includes("all your income after tax, which is more than you plan to spend; it is cut back only if savings have to help"));
  assert.ok(read("modules/overview/dashboard/view.js").includes("goals\"} behind${") && read("modules/overview/dashboard/view.js").includes("they need\"} about"));
  assert.ok(read("modules/goals/goals/view.js").includes("page puts it at"));
  assert.ok(read("modules/career/human-capital/view.js").includes("your pay ${") && read("modules/career/human-capital/view.js").includes("and your savings growing as the retirement projection expects"));
});

test("p059: debts that are never paid off say so, not 'debt-free in never' and a huge interest figure", () => {
  const src = fs.readFileSync(path.join(ROOT, "modules/debt/payoff/view.js"), "utf8");
  assert.ok(src.includes("Here every order costs the same: the debts are never paid off, and the interest keeps growing.") && src.includes("the debts would never be paid off") && src.includes("interest keeps growing\"") );
});

test("a003, a006, a028: the tax pages say what is paid, what is owed and what is behind", async () => {
  const fed = fs.readFileSync(path.join(ROOT, "modules/taxes/federal/view.js"), "utf8");
  for (const s of ["You have not entered any tax withheld", "No tax is taken out of your pay", "You have paid ${money(ans.paid)} in estimates so far", ", so you still owe about ${money(owes)}", "is overdue now"]) assert.ok(fed.includes(s), s);
  assert.ok(!fed.includes("Nothing is taken out of pay") && !fed.includes("held back is on file"));
  const est = fs.readFileSync(path.join(ROOT, "modules/taxes/estimated/view.js"), "utf8");
  assert.ok(est.includes("behind starting with the ${d.overdue.label} (due ${fmt.date(d.overdue.due)}). The penalty grows like interest"));
  const rep = fs.readFileSync(path.join(ROOT, "modules/reports/tax/view.js"), "utf8");
  assert.ok(rep.includes("You could still take about ${money(d.gains.zeroRoom)} of long-term gains this year and pay 0% tax on them."));
  assert.ok(fs.readFileSync(path.join(ROOT, "modules/taxes/hsa-fsa/view.js"), "utf8").includes("Money for a tax year can go in until that year's April tax deadline"));
});

test("a011, a036, a005, p027: the page's notes in plain words", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.ok(read("modules/cashflow/paycheck/compute.js").includes("so the page assumes ${DEFAULT_PAYCHECKS} paychecks a year: set how often"));
  assert.ok(read("modules/career/benefits/compute.js").includes("You entered your pay as a ${salaries[0].period"));
  const hs = read("modules/overview/health-score/compute.js");
  assert.ok(hs.includes('"look over your assumptions (once a year)"') && hs.includes('"update your balances (at least every 90 days)"'));
  const si = read("modules/career/side-income/view.js");
  assert.ok(si.includes("You need to pay the IRS every quarter, and ${money(e.overdue.amount)} of the payments due since") && si.includes("worked out from the Income page's"));
});

test("p020, w001, j003, j006, j018, w018, w021, w022, p068, p083, p002: the rest of the pinned sentences", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.ok(read("modules/career/benefits/view.js").includes("Only if you have about ${money(Math.round(moreAMonth(o) / 10) * 10)} to spare each month; you have about ${money(spare)}."));
  assert.ok(read("modules/taxes/estimated/view.js").includes("Last year's income before deductions (adjusted gross income)"));
  assert.ok(read("modules/taxes/capital-gains/view.js").includes("Your ${d.year} rates: 0% while taxable income stays under"));
  assert.ok(read("modules/retirement/monte-carlo/view.js").includes("so the answer does not change when you reopen the page"));
  assert.match(read("modules/scenarios/goal-seek/compute.js"), /earliest age at which the person still working could stop, up to 75/);
  assert.ok(read("modules/scenarios/stress-tests/compute.js").includes("would then file taxes as ${kids"));
  assert.ok(read("modules/reports/retirement/view.js").includes("Market stress tests (starting in ${d.hitYear})") && read("modules/reports/retirement/view.js").includes('label: "Saved"'));
  assert.ok(read("modules/ai/glossary/data/terms.js").includes("withholds 20% for tax and you have 60 days to deposit the full amount"));
  assert.ok(read("modules/taxes/federal/compute.js").includes("money taken from your paycheck is already left out"));
});

test("w007, j025, w006: 'leave blank', kinds of investment, the table raised for inflation", () => {
  const stale = [];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) walk(rel); else if (e.name === "view.js") { const s = fs.readFileSync(path.join(ROOT, rel), "utf8"); if (/help: [`"][^`"]*(?:\bempty:|\bif empty\b|if you leave it empty|; blank (?:for|if|uses|means)|help: "blank )/.test(s) && !/taxes\/state|student-loans|goals\/charitable|goals\/vehicle|balance\/projection|system\/settings/.test(rel)) stale.push(rel); } } };
  walk("modules");
  assert.deepEqual(stale, [], "help text that says 'empty:' / 'blank uses' instead of 'leave blank ...'");
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.ok(read("modules/investments/holdings/view.js").includes("Kind of investment (US stocks, bonds ...)") && read("modules/investments/allocation/module.js").includes("kinds of investment"));
  assert.ok(read("modules/taxes/federal/view.js").includes("(the last table, raised for inflation)"));
});

test("(2) the page title 'Will the money last?' never has punctuation straight after its question mark", () => {
  const bad = [];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel); } else if (/\.js$/.test(e.name) && !/test\.mjs$/.test(e.name)) { for (const line of fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n")) { if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; if (/Will the money last\?[,;:)\].]/.test(line.replace(/\/\/.*$/, ""))) bad.push(`${rel}: ${line.trim().slice(0, 100)}`); } } } };
  walk("modules"); walk("core");
  assert.deepEqual(bad, []);
});

test("(3) the household's view says 'your computer', not 'PC'", () => {
  const files = ["core/heal.js", "modules/system/backups/view.js", "modules/system/backups/module.js", "modules/system/audit/view.js", "modules/system/audit/module.js", "modules/ai/health.js", "modules/ai/notes/view.js", "modules/ai/explain/view.js", "modules/ai/critic/view.js", "modules/ai/reader/view.js", "modules/ai/categorizer/view.js", "modules/ai/assistant/module.js", "modules/transactions/categorize/view.js", "modules/transactions/connect/module.js", "modules/transactions/statements/module.js", "modules/retirement/monte-carlo/view.js", "modules/scenarios/stress-tests/view.js", "modules/overview/dashboard/view.js"];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8").replace(/PC connection|requires: "pc"/g, "").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.ok(!/\bPCs?\b/.test(s.replace(/\/\/.*$/gm, "")), `${f} still says PC`);
  }
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(idx.includes("restart the app on your computer") && !/restart the app on the PC/.test(idx));
  const app = fs.readFileSync(path.join(ROOT, "core/app.js"), "utf8");
  assert.ok(app.includes("Your changes are now saved on your computer.") && app.includes("Use your computer's version"));
});
