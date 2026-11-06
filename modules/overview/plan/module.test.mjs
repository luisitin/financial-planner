// modules/overview/plan/module.test.mjs -- "Your plan": its rows quote the result pages, calm rows on guesses, "In short", the
// guess list, plain words, light imports, and the walk from an empty plan to this page in pure code.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { compute, GROUP_TITLES, VALUE_MAX } from "./compute.js";
import { goalsWords, protectionAsks, guessList, notCounted } from "./words.js";
import manifest from "./module.js";
import { pathSummary, nextAfter, passStep, barFor, startGuide, journeyStatus, journeyById, PATH_ID, resultOrder } from "../guide/compute.js";
import { JOURNEYS } from "../guide/journeys.js";
import { standing, visibleScreens, markAt } from "../setup/compute.js";
import { answerFor } from "../quick/compute.js";
import { protectionGaps } from "../../insurance/life-needs/compute.js";
import { firstYear } from "../../retirement/withdrawal-strategy/compute.js";
import { thisYear as rmdThisYear } from "../../retirement/rmd/compute.js";
import { compute as houseOf } from "../../goals/house/compute.js";
import { guessesInUse } from "../../../core/estimate/index.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { sam, jordan, patLee, ruth, finishSetup } from "../../../qa/fixtures/setup-personas.mjs";

const T = "2026-11-02";
const HERE = fileURLToPath(new URL(".", import.meta.url));
const src = (f) => fs.readFileSync(`${HERE}${f}`, "utf8");
const empty = () => migrate(emptyPlan());
const HOUSEHOLDS = () => ({ sam: finishSetup("sam", sam()), jordan: finishSetup("jordan", jordan()), patLee: finishSetup("patLee", patLee()), ruth: finishSetup("ruth", ruth()), family: migrate(familyPlan(T)) });
const rowsOf = (d) => Object.fromEntries(d.groups.flatMap((g) => g.rows).map((r) => [r.key, r]));

test("manifest: a usable page right after the Dashboard, found by 'my plan'", () => {
  assert.deepEqual([manifest.id, manifest.group, manifest.title, manifest.status, manifest.order, manifest.heavy, manifest.enabledByDefault], ["plan", "overview", "Your plan", "usable", 1.5, false, true]);
  assert.ok(manifest.aliases.includes("my plan") && manifest.aliases.includes("whole plan") && manifest.aliases.includes("final plan"));
  assert.deepEqual(manifest.writes, ["assumptions", "guide"]);
  assert.equal(GROUP_TITLES.length, 3);
});

test("the numbers agree: every row's figure is the figure its page's own compute leads with, for five households", () => {
  for (const [name, p] of Object.entries(HOUSEHOLDS())) {
    const d = compute(p, { today: T });
    const r = rowsOf(d);
    const st = standing(p, { today: T });
    // rows of steps that do not apply are absent
    const keys = pathSummary(p, { today: T }).parts.map((x) => x.key);
    for (const k of ["debts", "protect", "fix-retire", "take-out", "rmd", "home", "college", "taxes"]) assert.equal(!!r[k], keys.includes(k), `${name}: ${k} row iff the step applies`);
    assert.deepEqual(d.groups.flatMap((g) => g.rows).map((x) => x.key), resultOrder(p, { today: T }).map((x) => x.key), `${name}: in resultOrder's order`);
    if (r.net) assert.equal(r.net.figure, st.netWorth, `${name}: net`);
    if (r.month?.figure !== undefined && r.month.status !== "open") assert.equal(r.month.figure, st.spare, `${name}: month`);
    if (r.cushion && r.cushion.status !== "open") assert.equal(r.cushion.figure, st.runway, `${name}: cushion`);
    if (r.debts && r.debts.status !== "open") { const a = answerFor("debt", p, { today: T }); assert.equal(r.debts.figure, a.headline); assert.ok(r.debts.line.startsWith(a.headline)); }
    if (r.retire && r.retire.status !== "open") {
      const a = answerFor("retire", p, { today: T });
      assert.equal(r.retire.figure, a.headline);
      assert.ok(r.retire.line.includes(a.line.replace(/\s*\([^()]*shows how much less\)/, "")));   // (without the page-title pointer, see the review-fix tests)
      if (a.verdict === "short") assert.equal(r.retire.value, `Runs out at ${a.shortAge}`);
      assert.equal(r.retire.status === "bad" || r.retire.status === "calm", a.verdict === "short" || a.verdict === "unknown" || !!st.retireGuessed || false, `${name}: red only when short`);
    }
    if (r.taxes && r.taxes.status !== "open") { const a = answerFor("taxes", p, { today: T }); assert.equal(r.taxes.figure, a.headline); }
    if (r.protect) { const g = protectionGaps(p, { today: T }); assert.equal(r.protect.figure, g.reduce((t, x) => t + x.gap, 0)); }
    if (r["take-out"] && r["take-out"].status !== "open") assert.equal(r["take-out"].figure, firstYear(p, { today: T }).fromSavings);
    if (r.rmd && r.rmd.status !== "open") assert.equal(r.rmd.figure, rmdThisYear(p, { today: T }).due.length ? rmdThisYear(p, { today: T }).total : 0);
    if (r.home && r.home.status !== "open") assert.equal(r.home.figure, houseOf(p, { today: T }).maxPrice);
    assert.deepEqual(JSON.parse(JSON.stringify(d)), d, `${name}: plain data`);
  }
});

test("Your plan, by household: the retired widow gets the retirement steps and the law's yearly amount; the family gets cover and college", () => {
  const h = HOUSEHOLDS();
  const ruthRows = rowsOf(compute(h.ruth, { today: T }));
  assert.deepEqual(Object.keys(ruthRows), ["net", "month", "cushion", "retire", "take-out", "rmd"]);
  assert.match(ruthRows.rmd.line, /Required withdrawals start in 2027\./);
  assert.match(ruthRows["take-out"].line, /^This year, /);
  const fam = rowsOf(compute(h.family, { today: T }));
  assert.ok(fam.protect && fam.college && fam.goals);
  assert.match(fam.protect.line, /would need about \$[\d,]+ more life insurance/);
  assert.match(fam.cushion.note, /lost job or a big repair/);
  assert.equal(compute(h.family, { today: T }).groups.map((g) => g.title).join("|"), "Right now|Family and retirement|Goals and this year's tax");
  // a page that is off: its row goes
  assert.equal(rowsOf(compute(h.ruth, { today: T, off: ["retirement/rmd"] })).rmd, undefined);
});

test("the tax row's short phrase reads in a sentence: owe, back, about right", () => {
  const p = HOUSEHOLDS().sam;
  const tax = rowsOf(compute(p, { today: T })).taxes;
  assert.ok(tax.short === "no big tax bill or refund" || /^(you owe about|about) \$[\d,]+ (in April|back in April)|left to pay|federal tax/.test(tax.short), tax.short);
  assert.ok(!/^about right/.test(tax.short));
});

test("a row that rests mostly on guesses is calm, never amber or red; a step that waits is a gap, counted and linked", () => {
  const p = migrate(familyPlan(T));
  p.guesses = {};
  for (const x of p.expenses) p.guesses[`expenses[${x.id}].amount`] = { k: "overview/guesses:spend", v: x.amount, u: "month", s: null, at: T, d: "2026-11-02" };
  const d = compute(p, { today: T });
  for (const r of d.groups.flatMap((g) => g.rows)) if (r.guessed && ["month", "cushion", "retire", "protect", "home"].includes(r.key)) assert.ok(r.status === "calm" || r.status === "ok", `${r.key} is ${r.status}`);
  const q = HOUSEHOLDS().ruth;
  q.retirement.socialSecurity = {}; q.guide.setup.ss = {}; q.income = q.income.filter((x) => x.type !== "social");
  const e = compute(q, { today: T });
  const r = rowsOf(e).retire;
  assert.equal(r.status, "open"); assert.match(r.line, /^Not worked out yet: needs .*Social Security\.$/);
  assert.equal(e.head.gaps >= 1, true); assert.ok(e.head.firstGap.href.startsWith("#/")); assert.match(e.head.firstGap.what, /Social Security/);
});

test("In short: only rows' own short phrases, at most three, the red ones first, then amber, then green", () => {
  const d = compute(HOUSEHOLDS().family, { today: T });
  const rows = d.groups.flatMap((g) => g.rows);
  const order = ["bad", "warn", "ok"].flatMap((s) => rows.filter((r) => r.status === s && r.short));
  const expect = order.slice(0, 3).map((r) => r.short);
  assert.ok(expect.length >= 2);
  const words = d.head.inShort;
  assert.ok(words.startsWith("In short: ") && words.endsWith("."));
  for (const s of expect) assert.ok(words.includes(s), s);
  assert.ok(words.indexOf(expect[0]) < words.indexOf(expect[1]));
  assert.equal(compute(empty(), { today: T }).head.inShort, "", "nothing to say yet");
});

test("the guess list is setup's guessList and the count is the ledger's", () => {
  const p = HOUSEHOLDS().jordan;
  const d = compute(p, { today: T });
  assert.deepEqual(d.guesses, guessList(p, { today: T }));
  assert.equal(d.guessCount, guessesInUse(p).length);
  assert.deepEqual(d.notCounted, notCounted(p, { today: T }));
  const g = compute(empty(), { today: T });
  assert.deepEqual([g.guesses, g.guessCount, g.someGuessed], [[], 0, false]);
  // what the old done screen listed: the spending we filled in, each home value, each debt's figures
  for (const row of d.guesses) { assert.ok(row.label && /^#\//.test(row.href)); }
});

test("head: empty, going, complete with and without gaps; checkIn and assumptions", () => {
  assert.equal(compute(empty(), { today: T }).head.state, "empty");
  const p = HOUSEHOLDS().ruth; markAt(p, "done", T);
  let d = compute(p, { today: T });
  assert.deepEqual([d.head.state, d.head.step, d.head.next.key], ["going", 2, "month"]);
  for (const x of pathSummary(p, { today: T }).parts.slice(1)) passStep(p, x.key, T);
  d = compute(p, { today: T });
  assert.deepEqual([d.head.state, d.head.gaps, d.head.next, d.head.name], ["complete", 0, null, "Ruth"]);
  assert.deepEqual(d.assumptions, { inflation: 0.03, returnStocks: 0.07, returnBonds: 0.04, planEndAge: 95, emergencyMonths: 6, looked: false });
  assert.equal(d.checkIn.next, "2026-12"); assert.equal(d.checkIn.nextName, "December"); assert.equal(d.checkIn.due, null);
  const early = compute(p, { today: "2026-12-03" });
  assert.equal(early.checkIn.due?.name, "November", "the first ten days of a month, last month not reviewed");
});

test("goalsWords is the Dashboard's goals sentence; protectionAsks is life-needs' first test", () => {
  const money = (n) => `$${Math.round(n)}`;
  assert.equal(goalsWords({ count: 0 }, {}, money), "none set yet");
  assert.equal(goalsWords({ count: 3, done: 1 }, { behind: [1], need: 120, queued: [], pastDue: [] }, money), "1 reached, 1 behind, about $120 more a month");
  assert.equal(goalsWords({ count: 1, done: 0 }, { behind: [], need: 0, queued: [1], pastDue: [], turn: "2027-03-01" }, money), "starts in March 2027, after your earlier steps");
  assert.equal(goalsWords({ count: 2, done: 0 }, { behind: [], need: 0, queued: [], pastDue: [] }, money), "all on track");
  const h = HOUSEHOLDS();
  assert.equal(protectionAsks(h.family, { today: T }), true);
  assert.equal(protectionAsks(h.sam, { today: T }), false, "one adult, no children");
  assert.equal(protectionAsks(h.ruth, { today: T }), false);
  assert.equal(protectionAsks(h.jordan, { today: T }), true);
});

test("plain words: no banned word in the path's text or on this page", () => {
  const BANNED = ["Monte Carlo", "simulated", "liabilities", "assumptions", "net worth", "RMD", "AGI", "IRMAA", "W-4", "withholding", "withheld", "guide", "journey", "scenario", "lever", "levers", "goal seek", "PC", "AI", "server", "sandbox", "inflation", "bonds", "stocks", "pre-tax", "Roth", "Medigap", "9 of 10 markets", "middle run", "must-pay"];
  const re = new RegExp(`\\b(${BANNED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
  // every string literal that is a sentence (has a space; not an address, not code)
  const literals = (text) => [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, "")).filter((t) => / /.test(t) && !/#\/|=/.test(t));
  const bad = [];
  for (const f of ["view.js", "compute.js", "words.js"]) for (const t of literals(src(f))) if (re.test(t) && !/^\s*(\/\/|\*)/.test(t)) bad.push(`${f}: ${t}`);
  // the path's own journey text
  const j = JOURNEYS.find((x) => x.id === PATH_ID);
  for (const t of [j.title, j.line, j.haveReady, j.finish.label, j.finish.text, ...j.steps.flatMap((s) => [s.title, s.short, s.ask, s.doneWhen, s.name, s.none, s.noneSaid])].filter(Boolean)) if (re.test(t)) bad.push(`journeys: ${t}`);
  assert.deepEqual(bad, [], "banned words:\n" + bad.join("\n"));
  // and on a built page: every row of the five households
  for (const [name, p] of Object.entries(HOUSEHOLDS())) { const d = compute(p, { today: T }); for (const r of d.groups.flatMap((g) => g.rows)) for (const t of [r.label, r.value, r.line, r.short, r.note].filter(Boolean)) if (re.test(t)) bad.push(`${name}/${r.key}: ${t}`); }
  assert.deepEqual(bad, [], "banned words:\n" + bad.join("\n"));
});

test("compute.js imports, directly, none of the heavy simulations (life-needs is the one named exception)", () => {
  const text = src("compute.js");
  const imports = [...text.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  for (const bad of ["monte-carlo", "stress-tests", "goal-seek", "health-score"]) assert.ok(!imports.some((i) => i.includes(bad)), `imports ${bad}`);
  assert.ok(imports.some((i) => i.includes("life-needs")));
  assert.equal(manifest.heavy, false);
});

test("the walk from A to B, in pure code: Next lands on a new page each time, the step counter goes up by one, and the taps are few", () => {
  const LIMIT = { sam: 18, patLee: 18, jordan: 20, ruth: 16 };
  for (const [name, mk] of Object.entries({ sam, jordan, patLee, ruth })) {
    // A: an empty plan, Let's go; the questions (persona + the rest), one forward tap per screen
    let p = finishSetup(name, mk(T), T);
    const screens = visibleScreens(p).filter((s) => s.id !== "welcome" && s.id !== "done").length;
    const setupTaps = 1 + screens;
    assert.ok(setupTaps <= 11, `${name}: setup taps ${setupTaps}`);
    markAt(p, "done", T);
    // the reveal: Next goes to the first step not passed (step 2)
    let ps = pathSummary(p, { today: T });
    const M = ps.total;
    const visited = new Set(["overview/setup"]);
    let taps = 0, at = null, counter = 1;
    const tapNext = (toHref, page) => { taps++; assert.ok(!visited.has(page), `${name}: ${page} seen twice (a loop)`); visited.add(page); };
    tapNext(ps.next.href, ps.next.page);
    at = ps.next.key; counter = 2;
    assert.equal(barFor(p, { page: ps.next.page, query: { guide: PATH_ID, step: at }, today: T }).index, 2);
    for (let guard = 0; guard < 20; guard++) {
      const nxt = nextAfter(p, at, { today: T });
      passStep(p, at, T);
      if (nxt.kind === "finish") { taps++; assert.equal(nxt.href, "#/overview/plan"); break; }
      assert.equal(nxt.kind, "next", `${name}: the first walk-through is in order`);
      const page = pathSummary(p, { today: T }).parts.find((x) => x.key === nxt.key).page;
      tapNext(nxt.href, page);
      at = nxt.key; counter++;
      const bar = barFor(p, { page, query: { guide: PATH_ID, step: at }, today: T });
      assert.equal(bar.index, counter, `${name}: Step N goes up by one`);
      assert.equal(bar.total, M);
    }
    assert.equal(taps, M, `${name}: Next taps from the reveal to Your plan equal M (${M})`);
    assert.ok(setupTaps + taps <= LIMIT[name], `${name}: ${setupTaps} + ${taps} taps`);
    assert.equal(compute(p, { today: T }).head.state, "complete", `${name}: Your plan says it is ready`);
    assert.equal(journeyStatus(journeyById(PATH_ID), p, { today: T }).finished, true);
  }
});

// ---- review fixes (walk and UX reviews of the first build)

const guessedFamily = () => {
  const p = migrate(familyPlan(T));
  p.guesses = {};
  for (const x of p.expenses) p.guesses[`expenses[${x.id}].amount`] = { k: "overview/guesses:spend", v: x.amount, u: "month", s: null, at: T, d: T };
  return p;
};

test("the cushion row never prints a bare '0 months' while its page says the months are not known yet", () => {
  const p = guessedFamily();
  p.accounts = p.accounts.filter((a) => !/checking|savings|cash/i.test(`${a.type}${a.name}`));   // no cash at all: the page reads 0
  assert.equal(standing(p, { today: T }).runway, 0); assert.equal(standing(p, { today: T }).runwayWaits, true);
  const r = rowsOf(compute(p, { today: T })).cushion;
  assert.equal(r.value, null, "no figure on the right");
  assert.match(r.line, /not known yet|isn.t known yet/i); assert.doesNotMatch(r.line, /(^|[^.\d])0 months/);
  assert.equal(r.status, "calm");
  // a figure under two months is said with one decimal, as the page says it
  const q = guessedFamily(); const s = standing(q, { today: T });
  assert.ok(s.runway > 0 && s.runway < 2);
  assert.match(rowsOf(compute(q, { today: T })).cushion.line, new RegExp(`about ${Math.round(s.runway * 10) / 10} months`));
});

test("the month row says the spending is our guess when the pay is missing, so it never seems to lose the Expenses page", () => {
  const p = migrate(familyPlan(T)); p.income = []; p.guesses = {};
  p.expenses.forEach((x, i) => { x.id = `setup-x-${i}`; p.guesses[`expenses[${x.id}].amount`] = { k: "overview/guesses:spend", v: x.amount, u: "month", s: null, at: T, d: T }; });   // the rows Get started wrote
  const st = standing(p, { today: T });
  assert.equal(st.spare, null); assert.ok(st.spendGuessed.rows > 0);
  const r = rowsOf(compute(p, { today: T })).month;
  assert.equal(r.status, "open"); assert.equal(r.value, null);
  assert.match(r.line, /^Spending is our guess \(about \$[\d,]+ a month\)\. Add your pay to see what is left\.$/);
  assert.match(r.fixHref, /^#\/overview\/setup\/money\?back=done&from=plan$/);
});

test("the head says 'ready' and shows the check only when no answer is missing", () => {
  const p = HOUSEHOLDS().ruth; markAt(p, "done", T);
  for (const x of pathSummary(p, { today: T }).parts.slice(1)) passStep(p, x.key, T);
  let d = compute(p, { today: T });
  assert.deepEqual([d.head.state, d.head.ready, d.head.title, d.head.lede], ["complete", true, "Your plan is ready, Ruth", null]);
  const q = HOUSEHOLDS().ruth; q.retirement.socialSecurity = {}; q.guide.setup.ss = {}; q.income = q.income.filter((x) => x.type !== "social");
  markAt(q, "done", T); for (const x of pathSummary(q, { today: T }).parts.slice(1)) passStep(q, x.key, T);
  d = compute(q, { today: T });
  assert.deepEqual([d.head.state, d.head.ready], ["complete", false]);
  assert.equal(d.head.title, "Your plan is not finished yet");
  assert.match(d.head.lede, /^\d answers? still needs? something from you; (it says|they say) Not worked out yet\.$/);
  assert.doesNotMatch(`${d.head.title} ${d.head.lede}`, /ready/i);
  const v = src("view.js");
  assert.match(v, /else if \(!h\.ready\)/, "no check mark and no 'ready' on the head while a gap is open");
  assert.match(v, /First, fill in the gaps above/, "'What to do next' waits for the gaps");
  assert.match(v, /h\.ready \? \[ui\.h\("p", \{\}, "Nothing else is needed/, "the closing 'you're done' lines only when ready");
});

test("cover for the family is grey and 'not checked yet' until its step is passed; then the plain verdict", () => {
  const p = HOUSEHOLDS().patLee;
  const s = pathSummary(p, { today: T });
  assert.ok(s.parts.some((x) => x.key === "protect"));
  assert.equal(protectionGaps(p, { today: T }).length, 0);
  let r = rowsOf(compute(p, { today: T })).protect;
  assert.equal(r.status, "calm"); assert.match(r.line, /^Not checked yet/);
  markAt(p, "done", T); passStep(p, "protect", T);
  r = rowsOf(compute(p, { today: T })).protect;
  assert.equal(r.status, "ok"); assert.equal(r.line, "If an earner died, your family would be all right.");
});

test("'In short' says so when a phrase rests on a figure we filled in (the tax is an estimate until the paycheck's tax is typed)", () => {
  const p = HOUSEHOLDS().patLee;
  const d = compute(p, { today: T });
  const tax = rowsOf(d).taxes;
  assert.equal(tax.guessed, p.taxes?.thisYear?.withheldTyped !== true);
  if (tax.guessed && d.head.inShort.includes(tax.short)) assert.match(d.head.inShort, /Some of this rests on our guesses\.$/);
  const q = structuredClone(p); q.taxes = { ...(q.taxes ?? {}), thisYear: { ...(q.taxes?.thisYear ?? {}), withheldTyped: true } };
  const e = rowsOf(compute(q, { today: T })).taxes;
  assert.equal(e.guessed, false);
});

test("the retirement row drops the page's '(... shows how much less)' pointer and keeps the plain sentence", () => {
  const d = compute(HOUSEHOLDS().ruth, { today: T });
  const r = rowsOf(d).retire;
  assert.doesNotMatch(r.line, /shows how much less|\(Will the money last/);
  assert.match(r.line, /^You plan on \$[\d,]+/);
});

test("rows that open a setup screen carry &from=plan, and setup leads back to Your plan from there", () => {
  const d = compute(HOUSEHOLDS().sam, { today: T });
  const hrefs = [...d.guesses.map((g) => g.href), ...d.notCounted.map((g) => g.href), d.head.firstGap?.href].filter((h) => /overview\/setup\//.test(h ?? ""));
  assert.ok(hrefs.length, "some row opens a setup screen");
  for (const h of hrefs) assert.match(h, /\?back=done&from=plan$/, h);
  const v = fs.readFileSync(`${HERE}../setup/view.js`, "utf8");
  assert.match(v, /const fromPlan = backDone && ctx\.route\.query\?\.from === "plan"/);
  assert.match(v, /if \(fromPlan\) \{ ctx\.go\("overview", "plan"\); return; \}/, "Back goes to Your plan");
  assert.match(v, /else if \(fromPlan\) ctx\.go\("overview", "plan"\)/, "Save goes to Your plan");
  assert.match(v, /"‹ Your plan"/);
});

test("the muted 'Not yet' value is grey, not a link colour", () => {
  assert.match(src("view.js"), /\.pl-v\.open \{ font-weight: 600; color: var\(--text-2\); \}/);
});

// review fix (UX 3): a household with no retirement savings on file is "Not known yet", calm, never "Runs out", and not a gap
test("part 3 review: no retirement savings on file reads Not known yet (calm), not Runs out, and does not hold the plan unfinished", () => {
  let seen = 0;
  for (const [name, p] of Object.entries(HOUSEHOLDS())) {
    const a = answerFor("retire", p, { today: T });
    if (a?.verdict !== "unknown") continue;
    seen++;
    const r = rowsOf(compute(p, { today: T })).retire;
    assert.equal(r.value, "Not known yet", name);
    assert.equal(r.status, "calm", name);
    assert.equal(r.fixHref, "#/balance/net-worth", name);
    assert.ok(!/runs out/i.test(r.line + r.value), name);
  }
  assert.ok(seen >= 1, "at least one test household has no retirement savings on file (the family persona)");
});
