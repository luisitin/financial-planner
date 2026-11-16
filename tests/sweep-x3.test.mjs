// tests/sweep-x3.test.mjs -- the whole-app phone sweep x3 (2026-11-16): every usable page at 390 px for the empty plan and the
// invented households, and what it found on claude-b's pages, each pinned by a test that would have caught it at ce79d70.
//
// 1. The retirement answer said two ways. For a plan with nothing saved for retirement and nothing going in (renterDebt: Riley,
//    24, an empty 401(k); sam: nothing said about savings), Will the money last?, Goal seek and What matters most say "We don't
//    know yet" while twelve pages said the money "runs out at 65". The shared gate is retirement/projection's retirementUnknown.
// The pages are drawn as the shell draws them (qa/first-view-lib: the real UI kit on the stand-in DOM, the clock held at its TODAY).
import { test } from "node:test";
import assert from "node:assert/strict";
import { retirementUnknown, unknownWords, nothingSaved, compute as projection, savingsUnknown } from "../modules/retirement/projection/compute.js";
import { nothingSaved as goalSeekNothingSaved } from "../modules/scenarios/goal-seek/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";

const T = "2026-11-13";   // qa/first-view-lib's held TODAY
const sam = () => migrate(personas.finishSetup("sam", personas.sam(T), T));
const rd = () => migrate(renterDebtPlan());
const fam = () => migrate(familyPlan(T));

// ---- the page as a person meets it: its text, outside nothing (every fold's words included, as a reader who opens them)
const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
// the filled buttons a person meets before any tap, as qa/first-view-lib counts them (the accent background after the cascade),
// outside every shut <details>
const filledOf = (root) => {
  const out = [];
  const walk = (n, shut) => {
    if (!n.tagName) return;
    if (L.unseen(n)) return;
    if (!shut && L.isFilled(n)) out.push(textOf(n).trim());
    const closed = n.tagName === "DETAILS" && !n.hasAttribute("open");
    for (const c of n.childNodes ?? []) walk(c, shut || (closed && c.tagName !== "SUMMARY"));
  };
  for (const c of root.childNodes ?? []) walk(c, false);
  return out;
};
let L = null;
async function drawn(key, plan) {
  L = L ?? await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  app.plans.x3 = migrate(structuredClone(plan));
  const d = await L.draw(key, "x3");
  assert.ok(!d.error, `${key}: ${d.error}`);
  return { root: d.root, text: textOf(d.root), filled: filledOf(d.root) };
}
const RUNS_OUT = /runs? out|ran out|runs short|run short|money does not last/i;

// ---- the gate and its words ------------------------------------------------------------------------------------------------
test("retirementUnknown: nothing saved and nothing going in, retirement ahead -> the two cases; any other plan -> null", () => {
  assert.deepEqual(retirementUnknown(rd(), { today: T }), { nothingSaved: true }, "Riley's empty Work 401(k) says it: nothing is saved");
  assert.deepEqual(retirementUnknown(sam(), { today: T }), { nothingSaved: false }, "Sam said nothing about retirement savings");
  assert.equal(retirementUnknown(fam(), { today: T }), null);
  assert.equal(retirementUnknown(migrate(retiredCouplePlan(T)), { today: T }), null, "a retired couple: retirement is not ahead");
  assert.equal(retirementUnknown(migrate({}), { today: T }), null, "the empty plan cannot be run at all");
  // one dollar invested, or a dollar a month going in, is an answer
  const one = rd(); one.accounts.find((a) => a.type === "401k").balance = 1;
  assert.equal(retirementUnknown(one, { today: T }), null);
  // the gate is the projection page's own, so the two can never disagree
  for (const p of [rd(), sam(), fam()]) assert.equal(!!retirementUnknown(p, { today: T }), !!retirementUnknownFromPage(p));
});
const retirementUnknownFromPage = (p) => savingsUnknown(projection(p, { today: T }));

test("nothingSaved moved to the projection; Goal seek re-exports the same function", () => {
  assert.equal(goalSeekNothingSaved, nothingSaved);
  assert.equal(nothingSaved(rd()), true);
  assert.equal(nothingSaved(sam()), false);
});

test("unknownWords: one sentence per case, the page's own question inside it, short and with one 'yet' (fix round, critics P3 and P4)", () => {
  assert.equal(unknownWords({ nothingSaved: true }, "the chance the money lasts"),
    "Nothing is saved for retirement, so we can't say the chance the money lasts yet. Once you start saving, add it and we can answer.");
  assert.equal(unknownWords({ nothingSaved: false }, "the chance the money lasts"),
    "You haven't told us about retirement savings, so we can't say the chance the money lasts yet. Add what you own and we can answer.");
  // the long sentence said word for word on twelve pages, and "yet" twice, are gone (critic P3: "That is common; once something is
  // saved or goes in each paycheck, add it and come back."; P4: "Nothing is saved for retirement yet, ... we can't say ... yet")
  for (const n of [true, false]) {
    const w = unknownWords({ nothingSaved: n }, "whether the money lasts");
    assert.equal(w.match(/\byet\b/g).length, 1, w);
    assert.doesNotMatch(w, /That is common|come back/);
    assert.ok(w.split(/\s+/).length <= 24, `${w.split(/\s+/).length} words`);
  }
});

test("Goal seek and What matters most say the same words as the twelve pages (one sentence, unknownWords)", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const cases = [["scenarios/goal-seek", "what it would take", { only: ["spending"] }], ["scenarios/sensitivity", "which of your numbers change the answer most", {}]];
  for (const [key, what, extra] of cases) {
    const { compute } = await import(`../modules/${key}/compute.js`);
    const live = { [key]: (plan, params) => compute(plan, { ...params, ...extra }) };
    for (const [plan, nothing] of [[rd(), true], [(() => { const u = rd(); u.accounts = u.accounts.filter((a) => a.type !== "401k"); return u; })(), false]]) {
      const r = await renderPage(new URL(`../modules/${key}/view.js`, import.meta.url), plan, T, { computeRemote: live });
      assert.ok(r.text().includes(unknownWords({ nothingSaved: nothing }, what)), `${key}, nothing saved ${nothing}: ${r.text().slice(0, 400)}`);
    }
  }
});

// ---- each page, drawn for Riley (nothing saved) and Sam (nothing said), and for the family (the answer as before) --------------
async function saysUnknown(key, what, { title = null } = {}) {
  for (const [who, plan, words] of [["renterDebt", rd(), unknownWords({ nothingSaved: true }, what)], ["sam", sam(), unknownWords({ nothingSaved: false }, what)]]) {
    const r = await drawn(key, plan);
    assert.ok(r.text.includes(words), `${key} for ${who}: the page's own "we can't say yet" sentence\n${r.text.slice(0, 600)}`);
    assert.doesNotMatch(r.text, RUNS_OUT, `${key} for ${who}: never "runs out" beside Will the money last?'s "We don't know yet"`);
    assert.ok(r.filled.includes("Add what you own ›"), `${key} for ${who}: the way on is the one filled link (${r.filled})`);
    assert.equal(r.filled.length, 1, `${key} for ${who}: one filled button (${r.filled})`);
    if (title) assert.ok(r.text.includes(title), `${key}: its title stays`);
  }
}

test("If history repeated: nothing saved -> the page's own we-can't-say-yet sentence, no '0 of 27'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/historical/view.js");
  await saysUnknown("retirement/historical", UNKNOWN_WHAT, { title: "If history repeated itself" });
  const r = await drawn("retirement/historical", rd());
  assert.doesNotMatch(r.text, /0 of 27|nothing left to chart/);
  const f = await drawn("retirement/historical", fam());
  assert.match(f.text, /start years since 1928 in which the money lasts to the end/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Chance the money lasts: nothing saved -> the page's own we-can't-say-yet sentence, no '0 of 100'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/monte-carlo/view.js");
  await saysUnknown("retirement/monte-carlo", UNKNOWN_WHAT, { title: "Chance the money lasts" });
  const r = await drawn("retirement/monte-carlo", rd());
  assert.doesNotMatch(r.text, /0 of 100|Weak/);
  const f = await drawn("retirement/monte-carlo", fam());
  assert.match(f.text, /pretend futures where the money lasts/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("How much to take out: nothing saved -> the page's own we-can't-say-yet sentence, no 'runs out at 65'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/withdrawal-strategy/view.js");
  await saysUnknown("retirement/withdrawal-strategy", UNKNOWN_WHAT, { title: "How much to take out each year" });
  const f = await drawn("retirement/withdrawal-strategy", fam());
  assert.match(f.text, /about \$[\d,]+ a month/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Order of returns: nothing saved -> the page's own we-can't-say-yet sentence, no 'runs out at 65' rows; the family's rows unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/sequence-risk/view.js");
  await saysUnknown("retirement/sequence-risk", UNKNOWN_WHAT, { title: "Why the order of returns matters" });
  const f = await drawn("retirement/sequence-risk", fam());
  assert.match(f.text, /Same years, three orders/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Financial independence: nothing saved -> the page's own we-can't-say-yet sentence, no 'Even working to 75, the money runs short'; the 25-times rule stays one quiet row", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/fire/view.js");
  await saysUnknown("retirement/fire", UNKNOWN_WHAT, { title: "Financial independence" });
  const r = await drawn("retirement/fire", rd());
  assert.match(r.text, /The 25-times rule|25 times spending/);
  const f = await drawn("retirement/fire", fam());
  assert.doesNotMatch(f.text, /can't say/);
  assert.match(f.text, /could stop work|would need to work until|Working out when/);
});

test("Stress tests: nothing saved -> the page's own we-can't-say-yet sentence, no 'survives 0 of 10 shocks'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/scenarios/stress-tests/view.js");
  await saysUnknown("scenarios/stress-tests", UNKNOWN_WHAT, { title: "Stress tests" });
  const r = await drawn("scenarios/stress-tests", rd());
  assert.doesNotMatch(r.text, /survives 0 of/);
  const f = await drawn("scenarios/stress-tests", fam());
  assert.match(f.text, /Your plan survives/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Long-term care: nothing saved -> the care costs stay, the verdict is the page's own we-can't-say-yet sentence, no 'runs short'; the family's verdict unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/insurance/ltc/view.js");
  await saysUnknown("insurance/ltc", UNKNOWN_WHAT, { title: "Care in later life" });
  const r = await drawn("insurance/ltc", rd());
  assert.match(r.text, /Care would cost/);
  const f = await drawn("insurance/ltc", fam());
  assert.match(f.text, /If Ana needed care/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Year by year: nothing saved -> the lede says we can't say whether the money lasts, never 'The money runs out in 2067'; the years stay; the family's lede unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/cash-flow/view.js");
  await saysUnknown("retirement/cash-flow", UNKNOWN_WHAT, { title: "Year by year" });
  const r = await drawn("retirement/cash-flow", rd());
  assert.match(r.text, /72 years, from 2026 to 2097\. Nothing is saved for retirement, so we can't say whether the money lasts yet\./);
  assert.match(r.text, /2067 · age 65/, "the years stay, as they are worked out");
  const f = await drawn("retirement/cash-flow", fam());
  assert.match(f.text, /The money lasts to the end\./);
  assert.doesNotMatch(f.text, /can't say/);
});

// a class on an element of the drawn page (the stand-in DOM keeps it as the attribute)
const classed = (root, cls) => root.all().filter((e) => String(e.getAttribute?.("class") ?? "").split(/\s+/).includes(cls));
test("Year by year: under 'we can't say yet' the years the money does not cover read in the plain colour, 'of spending not covered', never red 'short' (critic P2); a plan with savings that runs short keeps its red", async () => {
  const { shortWords } = await import("../modules/retirement/cash-flow/view.js");
  assert.equal(shortWords("$29,040"), "$29,040 short this year");
  assert.equal(shortWords("$29,040", { unknown: true }), "$29,040 of spending not covered this year");
  assert.equal(shortWords("$29,711", { every: true }), "nothing left; about $29,711 short every year");
  assert.equal(shortWords("$29,711", { unknown: true, every: true }), "about $29,711 of spending a year not covered");   // beside a dash, not "$0 left" (y2 (b))
  for (const plan of [rd(), sam()]) {
    const r = await drawn("retirement/cash-flow", plan);
    assert.match(r.text, /\$[\d,]+ of spending not covered this year/);
    assert.match(r.text, / Left: not known yet about \$[\d,]+ of spending a year not covered/);
    assert.doesNotMatch(r.text, /\$0 left|nothing left/, "\"Left: not known yet\" where \"$0 left\" was (y2 (b))");
    assert.doesNotMatch(r.text, /short this year|short every year/);
    assert.deepEqual(classed(r.root, "bad").map((e) => e.textContent), [], "nothing red");
  }
  // one dollar in the 401(k): the answer is known (the money runs out), and the short years keep their red words
  const one = rd(); one.accounts.find((a) => a.type === "401k").balance = 1;
  const k = await drawn("retirement/cash-flow", one);
  assert.match(k.text, /The money runs out in 20\d\d\./);
  assert.match(k.text, /short this year/);
  assert.ok(classed(k.root, "bad").length > 0);
});

test("Tax year by year: nothing saved -> the lede says we can't say whether the money lasts and that the years count only income, never 'The money runs out in 2067'; the family's lede unchanged", async () => {
  const { UNKNOWN_WHAT, UNKNOWN_COUNTS } = await import("../modules/taxes/projection/view.js");
  for (const [who, plan, nothing] of [["renterDebt", rd(), true], ["sam", sam(), false]]) {
    const r = await drawn("taxes/projection", plan);
    assert.ok(r.text.includes(`${unknownWords({ nothingSaved: nothing }, UNKNOWN_WHAT)} ${UNKNOWN_COUNTS}`), `${who}: ${r.text.slice(0, 500)}`);
    assert.doesNotMatch(r.text, RUNS_OUT, who);
  }
  const f = await drawn("taxes/projection", fam());
  assert.match(f.text, /of federal tax over retirement/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("How am I doing and Quick answers: nothing saved -> the two retirement rows keep the rule of thumb's sentence without 'Your own plan runs short at 65'; a short plan with savings still says it", async () => {
  for (const [who, plan] of [["renterDebt", rd()], ["sam", sam()]]) {
    for (const key of ["overview/benchmarks", "overview/quick"]) {
      const r = await drawn(key, plan);
      assert.doesNotMatch(r.text, RUNS_OUT, `${key} for ${who}`);
    }
  }
  const { compute: bench } = await import("../modules/overview/benchmarks/compute.js");
  const d = bench(rd(), { today: T });
  const rate = d.items.find((x) => x.id === "saving-rate");
  assert.equal(rate.sentence, "$0 a year goes into retirement accounts, employer money included: 0% of pay. The usual aim is 15%.");
  // the clause is still said when the plan has savings and runs short: one dollar in the 401(k) makes it an answer
  const one = rd(); one.accounts.find((a) => a.type === "401k").balance = 1;
  const d1 = bench(one, { today: T });
  assert.match(d1.items.find((x) => x.id === "saving-rate").sentence, /Your own plan runs short at \d+ \(see the Will the money last\? page\)\.$/);
});

test("Life timeline: nothing saved -> no 'Savings run out 2067' box or event; 'Not yet known' and the plan's last year says we can't say whether the money lasts; the family's timeline unchanged", async () => {
  const { compute: timeline } = await import("../modules/overview/timeline/compute.js");
  for (const [who, plan, nothing] of [["renterDebt", rd(), true], ["sam", sam(), false]]) {
    const d = timeline(plan, { today: T });
    assert.equal(d.headline.shortYear, null, who);
    assert.deepEqual(d.headline.unknown, { nothingSaved: nothing }, who);
    const e = d.events.find((x) => x.id === "unknown");
    assert.equal(e.title, "Whether the money lasts");
    assert.equal(e.detail, unknownWords({ nothingSaved: nothing }, "whether the money lasts"));
    assert.deepEqual(e.go, ["balance", "net-worth"]);
    assert.ok(!d.events.some((x) => x.id === "short"), who);
    const r = await drawn("overview/timeline", plan);
    assert.doesNotMatch(r.text, /Savings run out|The savings run out/, who);
    assert.match(r.text, nothing ? /Not yet known Will it last\? nothing saved for retirement yet/ : /Not yet known Will it last\? add what you own/, who);
  }
  const f = timeline(fam(), { today: T });
  assert.equal(f.headline.unknown, undefined);
  assert.equal(f.headline.lastsTo, 2085);
});

test("Retirement report: nothing saved -> the lead says we can't say whether the money lasts; no chance, history or market lines that say it runs out; the family's report unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/reports/retirement/view.js");
  for (const [who, plan, nothing] of [["renterDebt", rd(), true], ["sam", sam(), false]]) {
    const r = await drawn("reports/retirement", plan);
    assert.ok(r.text.includes(unknownWords({ nothingSaved: nothing }, UNKNOWN_WHAT)), `${who}: ${r.text.slice(0, 600)}`);
    assert.doesNotMatch(r.text, RUNS_OUT, who);
    assert.doesNotMatch(r.text, /pretend futures the money lasts|If history repeated|Market stress tests/, who);
    assert.match(r.text, /Not known yet Whether the money lasts/, who);
  }
  const f = await drawn("reports/retirement", fam());
  assert.match(f.text, /At expected returns the money lasts to 2085/);
  assert.match(f.text, /If history repeated/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Retirement report under 'we can't say yet': no red 'short' years, no 'Left at the end' or 'Can carry' figure, no withdrawal-order line; an outlined 'Add what you own' beside the one filled Print; each phone record's value says 'left' (critic P1)", async () => {
  for (const plan of [rd(), sam()]) {
    const r = await drawn("reports/retirement", plan);
    assert.deepEqual(classed(r.root, "rp-bad").map((e) => e.textContent), [], "nothing red");
    assert.doesNotMatch(r.text, /Left at the end|Can carry a month|How the money comes out|withdrawal order/i);
    assert.match(r.text, /Not known yet Whether the money lasts/);
    assert.deepEqual(r.filled, ["Print or save as PDF"]);
    const add = r.root.all().filter((e) => e.tagName === "A" && e.textContent === "Add what you own ›");
    assert.equal(add.length, 1); assert.equal(add[0].getAttribute("href"), "#/balance/net-worth");
    assert.ok(!r.root.all().some((e) => e.tagName === "ARTICLE" && e.all?.().includes(add[0])), "outside the printed sheet");
    // the phone records: "2026 ... $1,000 left", never a bare figure
    const recs = classed(r.root, "rp-rh").map((e) => e.textContent);
    assert.ok(recs.length > 5 && recs.every((t) => /left$/.test(t)), recs.join(" | "));
  }
  // the family: the same report as before, its phone records saying what the figure is
  const f = await drawn("reports/retirement", fam());
  assert.match(f.text, /Left at the end/); assert.match(f.text, /How the money comes out/);
  assert.ok(!f.root.all().some((e) => e.tagName === "A" && e.textContent === "Add what you own ›"));
  assert.ok(classed(f.root, "rp-rh").every((e) => /left$|short$/.test(e.textContent)));
  // a plan with savings that runs short keeps its red "short" years
  const one = rd(); one.accounts.find((a) => a.type === "401k").balance = 1;
  const k = await drawn("reports/retirement", one);
  assert.ok(classed(k.root, "rp-bad").length > 0);
});

test("Will the money last? and Quick answers: an empty 401(k) on file reads 'Nothing is saved for retirement', as Goal seek does; told nothing still reads 'You haven't told us'", async () => {
  const r = await drawn("retirement/projection", rd());
  assert.ok(r.text.includes(unknownWords({ nothingSaved: true }, "whether the money will last")), r.text.slice(0, 400));
  assert.doesNotMatch(r.text, /You haven't told us about retirement savings/);
  const s = await drawn("retirement/projection", sam());
  assert.match(s.text, /You haven't told us about retirement savings, so we can't say whether the money will last\. Add what you own to see\./);
  const { compute: quick } = await import("../modules/overview/quick/compute.js");
  const retireLine = (p) => quick(p, { today: T }).answers.find((a) => a.guide === "retire")?.line ?? null;
  assert.equal(retireLine(rd()), "Nothing is saved for retirement, so we can't say whether the money will last yet.");
  assert.equal(retireLine(sam()), "You haven't told us about retirement savings, so we can't say whether the money will last. Add what you own to see.");
});

// ---- 2. one filled button per first view ----------------------------------------------------------------------------------------
import { freelancerPlan } from "../qa/fixtures/round8-households.mjs";
test("Chance the money lasts, If history repeated, How much to take out: with Social Security missing, its 'Add Social Security' is the one filled button; the page's own way on is outlined", async () => {
  const p = migrate(freelancerPlan());
  for (const key of ["retirement/monte-carlo", "retirement/historical", "retirement/withdrawal-strategy"]) {
    const r = await drawn(key, p);
    assert.deepEqual(r.filled, ["Add Social Security"], `${key}: ${r.filled}`);
    assert.match(r.text, /Type what you'll spend ›/, `${key}: the way on is still there, outlined`);
  }
});

test("Money calendar: with the paydays card asking, its 'Show my paydays' is the one filled button; the empty reminder form waits behind '+ Add a reminder'", async () => {
  const r = await drawn("household/calendar", fam());
  assert.deepEqual(r.filled, ["Show my paydays"]);
  assert.match(r.text, /\+ Add a reminder/);
  assert.doesNotMatch(r.text, /Add it/);
  // the empty plan has no payday to ask for: the form stays open, its "Add it" the one filled button, as before
  const e = await drawn("household/calendar", migrate({}));
  assert.deepEqual(e.filled, ["Add it"]);
});

test("What you save for retirement: with the answer card's 'Start it at 3%' filled, the empty add form waits behind '+ Add a contribution'; 'Type my own amount' still opens it", async () => {
  const r = await drawn("retirement/contributions", rd());
  assert.deepEqual(r.filled, ["Start it at 3%"]);
  assert.match(r.text, /\+ Add a contribution/);
  assert.doesNotMatch(r.text, /Add contribution/);
  r.root.all().find((e) => e.tagName === "BUTTON" && textOf(e).trim() === "Type my own amount").click();
  assert.match(textOf(r.root), /Filled in with 3% of pay/, "the form opens, filled in");
  assert.match(textOf(r.root), /Add contribution/);
});

test("Capital gains on the empty plan: 'Add your income' is the one filled button; the sale form waits behind '+ Add a sale'", async () => {
  const e = await drawn("taxes/capital-gains", migrate({}));
  assert.deepEqual(e.filled, ["Add your income"]);
  assert.match(e.text, /\+ Add a sale/);
  // with income on file the empty form stays open, its "Add sale" the one filled button, as before
  const f = await drawn("taxes/capital-gains", fam());
  assert.ok(f.filled.includes("Add sale") && f.filled.length === 1, String(f.filled));
});

test("Expenses with nothing listed and our guesses offered: 'Use these guesses' is the one filled button; 'I'll type mine' opens the add form", async () => {
  const r = await drawn("cashflow/expenses", migrate(freelancerPlan()));
  assert.deepEqual(r.filled, ["Use these guesses"]);
  assert.match(r.text, /\+ Add an expense/);
  assert.doesNotMatch(r.text, /Add expense/);
  r.root.all().find((e) => e.tagName === "BUTTON" && /^I'll type mine/.test(textOf(e).trim())).click();
  assert.match(textOf(r.root), /Add expense/, "the form opens");
  // the empty plan has no offer: the form stays open, its "Add expense" the one filled button, as before
  const e = await drawn("cashflow/expenses", migrate({}));
  assert.deepEqual(e.filled, ["Add expense"]);
});
