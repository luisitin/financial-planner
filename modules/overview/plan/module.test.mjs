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
      assert.ok(r.retire.line.includes(a.line.replace(/\s*\([^()]*(?:shows how much less|see the Will the money last\? page)\)/, "")));   // (without the page-title pointer, see the review-fix tests)
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
  assert.equal(goalsWords({ count: 3, done: 1 }, { behind: [1], need: 120, queued: [], pastDue: [] }, money), "1 reached; 1 goal behind (it needs about $120 more a month)");
  assert.equal(goalsWords({ count: 4, done: 0 }, { behind: [1, 2, 3], need: 1659, queued: [1], pastDue: [], turn: "2026-12-01" }, money), "3 goals behind (they need about $1659 more a month); 1 starts in December 2026", "w017: the Dashboard's words");
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
  assert.doesNotMatch(r.line, /shows how much less|see the Will the money last|\(Will the money last/);
  assert.match(r.line, /^You plan to spend \$[\d,]+/);
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

test("N1 (review 2026-11-11): a row waiting for something names only what is missing, and links to it", async () => {
  const { missingFor } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  assert.deepEqual(missingFor(p, ["pay", "spending"], null), { what: "your pay and spending", href: "#/overview/setup/money?back=done&from=plan" });
  p.income.push({ id: "i", type: "salary", amount: 4000 });
  assert.deepEqual(missingFor(p, ["pay", "spending"], null), { what: "your spending", href: "#/overview/setup/spend?back=done&from=plan" }, "pay on file: only the spending");
  p.household.people.push({ id: "s", role: "self", name: "Ruth", birthDate: "1958-03-01" });
  p.accounts.push({ id: "a", type: "ira", name: "IRA", balance: 429000 });
  assert.equal(missingFor(p, ["ages", "savings", "spending"], null).what, "your spending", "ages and savings on file are never asked for");
  p.expenses.push({ id: "e", amount: 100 });
  assert.equal(missingFor(p, ["ages", "savings", "spending"], "fallback"), "fallback");
});

test("N3 (review 2026-11-11): cash just short of the months aimed for is never rounded up to them (Your plan and Needs attention)", async () => {
  const { compute: alertsOf } = await import("../alerts/compute.js");
  const p = migrate(familyPlan(T));
  const sv = p.accounts.find((a) => a.type === "savings"), base = sv.balance;
  let lo = 0, hi = 200000;   // find the savings that give 5.7 months of the 6 aimed for
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; sv.balance = base + mid; if (standing(p, { today: T }).runway < 5.7) lo = mid; else hi = mid; }
  const st = standing(p, { today: T });
  assert.ok(st.runway < 6 && Math.round(st.runway) === 6, "set up: rounds to the target");
  assert.equal(rowsOf(compute(p, { today: T })).cushion.value, "5.7 months");
  const a = alertsOf(p, { today: T }).alerts.find((x) => /^emergency/.test(x.id));
  assert.ok(a, "an emergency fund alert");
  assert.ok(!/covers 6 months/.test(`${a.title} ${a.detail ?? ""} ${a.body ?? ""}`), JSON.stringify(a));
});

test("N21 (review 2026-11-11): an empty plan's Set up my plan opens the intro, as the Dashboard's does", () => {
  const src = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(src.includes('filled("#/overview/setup", "Set up my plan ›")') && !src.includes('filled("#/overview/setup/you", "Set up my plan'));
});

// ---- the C5 follow-ups (docs/handoffs/2026-11-13-guesses-c5.md): every box left to us, as Get started's screens save it
async function everyBoxOurs({ state = "AZ", today = T, goals = ["home"], pay = "" } = {}) {
  const S = await import("../setup/compute.js");
  const G = await import("../guesses/compute.js");
  const { estimate, settle, mergeEstimators } = await import("../../../core/estimate/index.js");
  const REG = mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const GO = { estimators: REG.estimators, tables: REG.tables, today };
  const p = empty(); S.applyYou(p, { name: "Sam", who: "me", kids: 0, state });
  const step = (fn) => { const before = structuredClone(p); const guess = (k, o = {}) => estimate(before, k, { ...GO, ...o }); fn(guess); settle(p, GO); };
  step((guess) => S.applyMoney(p, { people: { "setup-self": { status: "work", amount: pay, period: "annual" } }, today }, today, { guess }));
  step((guess) => S.applyAges(p, { people: { "setup-self": { month: 3, year: 1983, stopAge: 65, ss: { mode: "estimate" } } } }, today, { guess }));
  S.applyHavePicks(p, ["checking", "retire"]);
  step((guess) => S.applyHaveAmounts(p, {}, today, { guess }));
  S.applyOwePicks(p, ["credit"]);
  step((guess) => S.applyOweAmounts(p, {}, today, { guess }));
  step((guess) => S.applySpend(p, { mode: "rows", rows: {} }, today, { guess }));
  S.applyGoalPicks(p, goals);
  step((guess) => S.applyGoalDetails(p, Object.fromEntries(goals.map((g) => [g, { target: "" }])), today, null, { guess }));
  S.markAt(p, "done", today);
  return p;
}

// critic F3: while the month waits on our pay guess, the first move is the pay, as the Dashboard, Get started and Needs attention ask
test("F3: 'What to do next' starts with Type your pay while the month waits on our pay; the spending's move follows", async () => {
  const p = await everyBoxOurs();
  assert.equal(standing(p, { today: T }).spareWaitsOn, "both");
  const d = compute(p, { today: T });
  assert.equal(d.moves.length, 3);
  assert.deepEqual([d.moves[0].title, d.moves[0].href], ["Type your pay", "#/overview/setup/money?back=done&from=plan"]);
  assert.equal(d.moves[0].detail, "Your pay is our guess for now, and what is left each month waits for it.");
  assert.equal(d.moves[1].title, "Type what you really spend", "the spending is ours too: its move comes next");
  // the spending typed: the pay alone leads
  const S = await import("../setup/compute.js");
  const q = await everyBoxOurs();
  S.applySpend(q, { mode: "rows", rows: { housing: 1500, utilities: 200, groceries: 500, transport: 400, insurance: 150, dining: 300, shopping: 300 } }, T);
  assert.equal(standing(q, { today: T }).spareWaitsOn, "pay");
  const mq = compute(q, { today: T }).moves;
  assert.equal(mq[0].title, "Type your pay");
  assert.ok(!mq.some((m) => m.title === "Type what you really spend"));
  // the pay typed: the moves are Get started's, as before
  const r = await everyBoxOurs({ pay: "52000" });
  const st = standing(r, { today: T });
  assert.deepEqual(compute(r, { today: T }).moves.map((m) => m.title), st.moves.slice(0, 3).map((m) => m.title));
  assert.ok(!compute(r, { today: T }).moves.some((m) => m.title === "Type your pay"));
});

test("H2/C2: the guess list puts the month's own figures first (our pay, then our spending), then the big guesses in Our guesses for you's order", async () => {
  const p = await everyBoxOurs();
  const rows = guessList(p, { today: T });
  assert.match(rows[0].label, /^Sam's pay before tax: about \$[\d,]+ a year$/, "the pay leads: the month waits on it");
  assert.equal(rows[0].href, "#/overview/setup/money?back=done&from=plan", "it opens the pay question, and Back comes here");
  // critic F4: the spending (nearly all of the month's outgo) comes next, never behind a card or a 401(k) balance
  assert.match(rows[1].label, /^Spending: about \$[\d,]+ a month$/);
  assert.equal(rows[1].href, "#/overview/setup/spend?back=done&from=plan");
  for (const re of [/^Spending: about \$[\d,]+ a month$/, /retirement savings at work: about \$[\d,]+$/, /^What you put into your 401\(k\) a month: about \$[\d,]+$/, /^House down payment goal: about \$[\d,]+$/, /^Credit cards: still owed about/]) assert.ok(rows.some((r) => re.test(r.label)), String(re));
  // every guess in use is in the list once: a spending row or a debt's figure is never listed twice
  assert.equal(rows.filter((r) => /^Spending: |^Rent\b|^Groceries\b/.test(r.label)).length, 1);
  assert.equal(rows.filter((r) => /Credit cards/.test(r.label)).length, 1);
  // a big guess never after a small one (the checking balance is small)
  const small = rows.findIndex((r) => /^Checking and savings/.test(r.label));
  assert.ok(small > rows.findIndex((r) => /^House down payment goal/.test(r.label)));
  // Your plan shows the first three: the pay and the spending among them
  const d = compute(p, { today: T });
  assert.match(d.guesses[0].label, /pay before tax/);
  assert.match(d.guesses[1].label, /^Spending: /);
  // the pay typed: no pay row, and the spending leads
  const q = await everyBoxOurs({ pay: "52000" });
  assert.ok(!guessList(q, { today: T }).some((r) => /pay before tax/.test(r.label)));
  assert.match(guessList(q, { today: T })[0].label, /^Spending: /);
});

test("C2: Your plan's left-over row says what it waits for (our pay, our spending, or both) and opens that question", async () => {
  const p = await everyBoxOurs();
  const st = standing(p, { today: T });
  assert.equal(st.spareWaitsOn, "both");
  const m = rowsOf(compute(p, { today: T })).month;
  assert.match(m.line, /^Your pay and most of your spending are our guesses for now, so this waits for yours\. With our guesses, about \$[\d,]+ (spare|short)\.$/);
  assert.equal(m.href, "#/overview/setup/money?back=done&from=plan");
  assert.equal(m.status, "calm");
  // the same plan with the spending typed: the pay alone
  const S = await import("../setup/compute.js");
  const q = await everyBoxOurs();
  S.applySpend(q, { mode: "rows", rows: { housing: 1500, utilities: 200, groceries: 500, transport: 400, insurance: 150, dining: 300, shopping: 300 } }, T);
  const sq = standing(q, { today: T });
  if (sq.spareWaitsOn === "pay") {
    assert.match(rowsOf(compute(q, { today: T })).month.line, /^Your pay is our guess for now, so this waits for yours\. With our guess, about \$[\d,]+ (spare|short)\.$/);
  } else assert.fail(`the typed spending should leave the pay alone: ${sq.spareWaitsOn}`);
  // our spending alone: the words and the Expenses link stay as they were
  const r = await everyBoxOurs({ pay: "52000" });
  const mr = rowsOf(compute(r, { today: T })).month;
  if (standing(r, { today: T }).spareWaitsOn === "spending") {
    assert.match(mr.line, /^Most of your spending is our guesses, so this waits for yours\./);
    assert.equal(mr.href, "#/cashflow/expenses?from=plan");
  }
});

test("H1/N1: goalsWords: a goal with no amount is never on track; one behind on our guess of its amount says so", () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const none = { behind: [], need: 0, pastDue: [], queued: [] };
  // "3 goals: all on track" with a $0 target was the bug (H1): a blank amount is said, and nothing else is claimed
  assert.equal(goalsWords({ count: 3, done: 0, goals: [{ id: "a", status: "on track" }, { id: "b", status: "on track" }, { id: "c", status: "no amount" }] }, none, money), "1 needs an amount");
  assert.equal(goalsWords({ count: 2, done: 0, goals: [{ id: "a", status: "no amount" }, { id: "b", status: "no amount" }] }, none, money), "2 need amounts");
  assert.equal(goalsWords({ count: 2, done: 0, goals: [{ id: "a", status: "on track" }, { id: "b", status: "on track" }] }, none, money), "all on track");
  // behind on an amount the person never gave (N1): said as ours
  const one = { count: 1, done: 0, goals: [{ id: "h", status: "behind" }] }, gb = { behind: [{ id: "h" }], need: 1302, pastDue: [], queued: [] };
  assert.equal(goalsWords(one, gb, money), "1 goal behind (it needs about $1,302 more a month)", "typed: as before");
  assert.equal(goalsWords(one, gb, money, { guessed: new Set(["h"]) }), "1 goal behind by our guess of its amount (it needs about $1,302 more a month)");
  const two = { count: 3, done: 0, goals: [{ id: "h", status: "behind" }, { id: "e", status: "behind" }, { id: "t", status: "no amount" }] };
  const gb2 = { behind: [{ id: "h" }, { id: "e" }], need: 2000, pastDue: [], queued: [] };
  assert.equal(goalsWords(two, gb2, money, { guessed: new Set(["h", "e"]) }), "2 goals behind by our guess of their amounts (they need about $2,000 more a month); 1 needs an amount");
  assert.equal(goalsWords(two, gb2, money, { guessed: new Set(["h"]) }), "2 goals behind (they need about $2,000 more a month), 1 by our guess of its amount; 1 needs an amount");
  // the Dashboard's tile (`short`, critic F5: four lines at 320 px): a need worked out only from our amounts is left to Goals
  assert.equal(goalsWords(two, gb2, money, { guessed: new Set(["h", "e"]), short: true }), "2 goals behind by our guess of their amounts; 1 needs an amount");
  assert.equal(goalsWords(one, gb, money, { guessed: new Set(["h"]), short: true }), "1 goal behind by our guess of its amount");
  // ...an amount the person gave keeps its need (w017), alone or beside one of ours
  assert.equal(goalsWords(one, gb, money, { short: true }), "1 goal behind (it needs about $1,302 more a month)");
  assert.equal(goalsWords(two, gb2, money, { guessed: new Set(["h"]), short: true }), "2 goals behind (they need about $2,000 more a month), 1 by our guess of its amount; 1 needs an amount");
});

test("H1/N1: Your plan's goals row is calm on our amounts or a blank one, amber only on an amount the person gave", async () => {
  const p = await everyBoxOurs({ goals: ["home", "trip"] });
  const row = rowsOf(compute(p, { today: T })).goals;
  assert.match(row.line, /^2 goals: 1 goal behind by our guess of its amount \(it needs about \$[\d,]+ more a month\); 1 needs an amount\.$/);
  assert.equal(row.status, "calm");
  assert.equal(row.guessed, true);
  // the home's amount typed (a different figure, so the ledger lets it go as typed): behind on the person's own figure is amber
  const q = structuredClone(p);
  q.goals.find((g) => g.id === "setup-goal-home").target = 45000;
  const r2 = rowsOf(compute(q, { today: T })).goals;
  assert.match(r2.line, /1 goal behind \(it needs about/);
  assert.equal(r2.status, "warn");
  // every goal counted: no blank, no guess said
  const f = rowsOf(compute(migrate(familyPlan(T)), { today: T })).goals;
  assert.doesNotMatch(f.line, /needs an amount|our guess/);
});
