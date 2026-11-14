// tests/levers-try.test.mjs -- "Try a change" on Will the money last? (gap design #19; modules/retirement/levers.js `tries` and
// trialWords, the card in modules/retirement/projection/view.js). A figure tried on a row of "What this answer rests on" shows
// what it would do to the answer and writes nothing; "Keep this" writes that one figure; another row, "Back to my plan",
// another page or Back drops it. Households: the 14 in qa/households, the family and the phone-built ones (all invented).
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import * as LV from "../modules/retirement/levers.js";
import { applyChanges } from "../modules/scenarios/compare/compute.js";
import { compute as projection } from "../modules/retirement/projection/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { settle, mergeEstimators } from "../core/estimate/index.js";
import { estimators as guessEstimators, TABLES } from "../modules/overview/guesses/compute.js";
import { estimators as setupEstimators } from "../modules/overview/setup/compute.js";
import { compute as nbaCompute } from "../modules/overview/next-best-action/compute.js";
import { danaLee, jamie, casey, robin, morgan } from "../qa/fixtures/phone-households.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-11";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VIEW = pathToFileURL(path.join(ROOT, "modules/retirement/projection/view.js")).href;
const cOf = { "overview/next-best-action": nbaCompute };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const route = () => ({ rest: [], query: {} });
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const HOUSEHOLDS = [
  ...ARCHETYPES.map((a) => [a.id, () => migrate(a.build())]),
  ["family", () => migrate(familyPlan(T))], ["retired couple", () => migrate(retiredCouplePlan(T))],
  ...[danaLee, jamie, casey, robin, morgan].map((mk) => [mk.name, () => migrate(mk())]),
  ...["sam", "jordan", "patLee", "ruth"].map((n) => [n, () => migrate(personas.finishSetup ? personas.finishSetup(n, personas[n](T), T) : personas[n](T))]),
];
const triesOf = (plan) => LV.leverList(plan, { today: T }).rows.flatMap((r) => (r.tries ?? []).map((t) => ({ row: r, t })));
const freeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freeze(v); } return o; };
const kept = (plan, t) => { const p = structuredClone(plan); t.write(p); return p; };
// the store's refresh of untouched guesses (core/app.js registers the same: every module's estimators), and its preview
const REG = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }]);
const settleNow = (draft) => settle(draft, { estimators: REG.estimators, tables: REG.tables, today: T });
const previewOf = (plan) => (fn) => { const d = structuredClone(plan); fn(d); settleNow(d); return d; };
/** Every place two plans differ, as dotted paths (a list of records by id when its items have one). */
function diffPaths(a, b, at = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const obj = (v) => v && typeof v === "object";
  if (!obj(a) || !obj(b) || Array.isArray(a) !== Array.isArray(b)) return [at];
  if (Array.isArray(a) && [...a, ...b].every((x) => obj(x) && x.id)) {
    const ids = [...new Set([...a, ...b].map((x) => x.id))];
    return ids.flatMap((id) => diffPaths(a.find((x) => x.id === id), b.find((x) => x.id === id), `${at}[${id}]`));
  }
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diffPaths(a[k], b[k], at ? `${at}.${k}` : k));
}
async function page(plan, r0 = route()) {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(VIEW, plan, T, { route: r0, computeOf: cOf });
  r.root.querySelector(".lv").open = true;
  r.root.querySelector(".lv").__start?.();
  for (let i = 0; i < 200 && r.root.querySelector(".lv-rows")?.getAttribute("aria-busy"); i++) await sleep(50);
  return r;
}
const tryButton = (r, key) => r.root.querySelector(`[data-try-open="${key}"]`);
const panel = (r) => r.root.querySelectorAll(".lv-try");
const chip = (r, label) => panel(r)[0].all().find((e) => e.tagName === "BUTTON" && e.classList.contains("chip") && e.textContent === label);
const button = (el, label) => el.all().find((e) => e.tagName === "BUTTON" && e.textContent === label);

// ---- the figures offered ----
test("the chips: prices 2.5 / 3 / 4% without the one in use; two years sooner to two later; 10% less, 5% less, 5% more; $100 / $250 / $500 more", () => {
  assert.deepEqual([...LV.TRY_PRICES], [0.025, 0.03, 0.04]);
  assert.deepEqual([...LV.TRY_STOP], [-2, -1, 1, 2]);
  assert.deepEqual([...LV.TRY_SPEND], [-0.1, -0.05, 0.05]);
  assert.deepEqual([...LV.TRY_SAVE], [100, 250, 500]);
  const p = migrate(jamie());
  const rows = Object.fromEntries(LV.leverList(p, { today: T }).rows.map((r) => [r.key, r]));
  assert.deepEqual(rows.prices.tries.map((t) => t.label), ["2.5% a year", "4% a year"]);
  assert.deepEqual(rows["stop:setup-self"].tries.map((t) => t.label), ["at 63", "at 64", "at 66", "at 67"]);
  assert.deepEqual(rows.spending.tries.map((t) => t.label), ["$2,898 (10% less)", "$3,059 (5% less)", "$3,381 (5% more)"]);
  assert.deepEqual(rows["work-saving:setup-self"].tries.map((t) => t.label), ["$100 more", "$250 more", "$500 more"]);
  // at 4% the chips are 2.5% and 3%
  const q = structuredClone(p); q.assumptions.inflation = 0.04;
  assert.deepEqual(LV.leverList(q, { today: T }).rows.find((r) => r.key === "prices").tries.map((t) => t.label), ["2.5% a year", "3% a year"]);
  // rows that are not one of the four have none (the match, growth, how long the plan runs, Social Security, the share in stocks)
  for (const [, mk] of HOUSEHOLDS) for (const r of LV.leverList(mk(), { today: T }).rows) if (r.tries?.length) assert.match(r.key, /^(prices|spending|stop:|work-saving:)/, r.key);
});

test("an age already reached and an age past 75 are never offered; a saving chip is offered only while all of it fits under the year's limit", () => {
  const p = migrate(jamie());
  const me = p.household.people.find((x) => x.id === "setup-self");
  const born = Number(String(me.birthDate).slice(0, 4));
  const age = 2026 - born;
  const soon = structuredClone(p); soon.household.people.find((x) => x.id === "setup-self").retirementAge = age + 1;
  const stop = LV.leverList(soon, { today: T }).rows.find((r) => r.key === "stop:setup-self");
  assert.deepEqual(stop.tries.map((t) => t.label), [`at ${age + 2}`, `at ${age + 3}`]);
  const late = structuredClone(p); late.household.people.find((x) => x.id === "setup-self").retirementAge = 74;
  assert.deepEqual(LV.leverList(late, { today: T }).rows.find((r) => r.key === "stop:setup-self").tries.map((t) => t.label), ["at 72", "at 73", "at 75"]);
  // nearly at the limit: the row's own money raised until only $3,000 a year of room is left ($250 a month)
  const row = p.retirement.contributions.find((c) => c.personId === "setup-self" || c.id.includes("setup-self"));
  let cap = null;
  for (let own = 12000; own <= 40000 && cap === null; own += 500) {
    const q = structuredClone(p); Object.assign(q.retirement.contributions.find((c) => c.id === row.id), { amount: own / 12, period: "monthly" });
    const tr = LV.leverList(q, { today: T }).rows.find((r) => r.key === "work-saving:setup-self")?.tries ?? [];
    if (tr.length < 3) cap = { own, labels: tr.map((t) => t.label) };
  }
  assert.ok(cap, "the limit is reached somewhere under $40,000 a year");
  assert.deepEqual(cap.labels, ["$100 more", "$250 more"]);
});

// ---- spec test 1: trying never changes the plan ----
test("trying never changes the plan's bytes: every chip of every household, on a deep-frozen plan", () => {
  let n = 0;
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = freeze(mk());
    const bytes = JSON.stringify(plan);
    for (const { t } of triesOf(plan)) { assert.doesNotThrow(() => LV.tryChange(plan, T, t.write), `${name}: ${t.id}`); n++; }
    assert.equal(JSON.stringify(plan), bytes, name);
  }
  assert.ok(n > 150, `${n} chips tried`);
});

// ---- spec test 2: the trial answer is Scenario compare's for the same change; and it is the answer after "Keep this" ----
test("said = done: every trial is the answer of the plan after 'Keep this' writes it", () => {
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = mk();
    for (const { t } of triesOf(plan)) assert.deepEqual(LV.tryChange(plan, T, t.write), LV.answerOf(kept(plan, t), { today: T }), `${name}: ${t.id}`);
  }
});

test("prices and the age to stop work: the trial equals Scenario compare's run of the same change, in every household", () => {
  let n = 0;
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = mk();
    for (const { row, t } of triesOf(plan)) {
      if (row.key !== "prices" && !row.key.startsWith("stop:")) continue;
      const a = applyChanges(plan, t.scenario, { today: T });
      assert.deepEqual(LV.tryChange(plan, T, t.write), a.inputs ? LV.outcomeOf(a.inputs) : null, `${name}: ${t.id}`);
      n++;
    }
  }
  assert.ok(n > 80, `${n} compared`);
});

test("spending: the trial equals Scenario compare's wherever the figure does not hold loans from today's bills; where it does, it is what the settings box saves", () => {
  let same = 0, held = 0;
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = mk();
    for (const { row, t } of triesOf(plan)) {
      if (row.key !== "spending") continue;
      const after = kept(plan, t);
      const a = applyChanges(plan, t.scenario, { today: T });
      const sc = a.inputs ? LV.outcomeOf(a.inputs) : null;
      // (the settings box marks a figure typed over today's bills as holding the loans those bills held: retirement.spendingFrom)
      if (after.retirement.spendingFrom === "expenses" && !plan.retirement.spendingFrom) { held++; continue; }
      assert.deepEqual(LV.tryChange(plan, T, t.write), sc, `${name}: ${t.id}`);
      same++;
    }
  }
  assert.ok(same >= 15, `${same} the same as Scenario compare`);
  assert.ok(held > 0, "some households' figure is today's bills, loans held");
});

// ---- spec test 4: "Keep this" writes exactly that lever's field ----
test("'Keep this' writes exactly that figure: the plan after it differs from the plan before in that one place", () => {
  const p = migrate(jamie());
  const rows = Object.fromEntries(LV.leverList(p, { today: T }).rows.map((r) => [r.key, r]));
  const expect = (t, patch) => { const want = structuredClone(p); patch(want); assert.deepEqual(kept(p, t), want, t.id); };
  expect(rows.prices.tries.find((t) => t.label === "4% a year"), (w) => { w.assumptions.inflation = 0.04; });
  expect(rows["stop:setup-self"].tries.find((t) => t.label === "at 67"), (w) => { w.household.people.find((x) => x.id === "setup-self").retirementAge = 67; });
  // what goes in at work: that row's own money, a month; the match and every other row stay
  const t = rows["work-saving:setup-self"].tries.find((x) => x.label === "$250 more");
  const after = kept(p, t);
  const changed = after.retirement.contributions.filter((c, i) => JSON.stringify(c) !== JSON.stringify(p.retirement.contributions[i]));
  assert.equal(changed.length, 1);
  const was = p.retirement.contributions.find((c) => c.id === changed[0].id);
  const perMonth = (c) => Number(c.amount) * ({ monthly: 12, yearly: 1, annual: 1, biweekly: 26, weekly: 52, semimonthly: 24 }[c.period] ?? 12) / 12;
  assert.ok(Math.abs(perMonth(changed[0]) - perMonth(was) - 250) < 0.01, `${perMonth(was)} -> ${perMonth(changed[0])}`);
  assert.equal(changed[0].employerMatch, was.employerMatch);
  const { retirement: r1, guesses: g1, ...rest1 } = after, { retirement: r0, guesses: g0, ...rest0 } = p;
  assert.deepEqual(rest1, rest0);
  assert.deepEqual({ ...r1, contributions: null }, { ...r0, contributions: null });
  // spending: the figure, as Retirement settings' own box saves it (saveSpendingFigure: its markers for a figure typed over Get
  // started's own or over today's bills go with it)
  const s = rows.spending.tries.find((x) => x.label === "$2,898 (10% less)");
  const sp = kept(p, s);
  assert.equal(sp.retirement.spendingMonthly, 2898);
  assert.deepEqual(sp.assumptions, p.assumptions); assert.deepEqual(sp.household, p.household); assert.deepEqual(sp.accounts, p.accounts); assert.deepEqual(sp.retirement.contributions, p.retirement.contributions);
});

// (review 2026-11-14, F2: "exactly that lever's field" is one field for prices and the age; the other two write the figure and
// the marks that go with a typed figure, and nothing else. Every chip of every household, every place it writes)
test("every place 'Keep this' writes, in every household: the figure, and for spending and saving the marks that say it is no longer our guess", () => {
  const ALLOWED = {
    prices: [/^assumptions\.inflation$/],
    stop: [/^household\.people\[[^\]]+\]\.retirementAge$/],
    // Retirement settings' own save (saveSpendingFigure): the figure; whether it still holds the loans today's bills held; Get
    // started's two notes that the figure was its own; and the entry that called it our guess
    spending: [/^retirement\.spendingMonthly$/, /^retirement\.spendingFrom$/, /^guide\.setup\.retireAuto$/, /^guide\.setup\.retireHeld$/, /^guesses(\.retirement\.spendingMonthly)?$/],
    // the row's money as a month's figure (a share of pay typed before goes with it), and the entry that called it our guess
    "work-saving": [/^retirement\.contributions\[[^\]]+\]\.(amount|period|pctOfPay)$/, /^guesses(\.retirement\.contributions\[[^\]]+\]\.amount)?$/],
  };
  let n = 0;
  const seen = new Set();
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = mk();
    for (const { row, t } of triesOf(plan)) {
      const kind = row.key.split(":")[0];
      const paths = diffPaths(plan, kept(plan, t));
      assert.ok(paths.length >= 1, `${name}: ${t.id} writes something`);
      for (const p of paths) { assert.ok(ALLOWED[kind].some((re) => re.test(p)), `${name}: ${t.id} wrote ${p}`); seen.add(`${kind} ${p.replace(/\[[^\]]+\]/g, "[]")}`); }
      if (kind === "prices" || kind === "stop") assert.equal(paths.length, 1, `${name}: ${t.id}`);
      if (kind === "work-saving") assert.equal(new Set(paths.filter((p) => p.startsWith("retirement.")).map((p) => /\[([^\]]+)\]/.exec(p)[1])).size, 1, `${name}: ${t.id}: one row`);
      n++;
    }
  }
  assert.ok(n > 150, `${n} chips kept`);
  assert.ok(seen.has("spending retirement.spendingMonthly") && seen.has("work-saving retirement.contributions[].amount"), [...seen].join("; "));
});

// ---- the guesses that follow a save are in the trial (review 2026-11-14, F3) ----
test("said = done in the app: with the store's preview the trial is the answer after the save and its refresh of guesses, in every household", () => {
  let moved = 0;
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = mk();
    for (const { t } of triesOf(plan)) {
      const saved = kept(plan, t); const s = settleNow(saved);
      const out = LV.trialAnswer(plan, T, t, previewOf(plan));
      assert.deepEqual(out, LV.answerOf(saved, { today: T }), `${name}: ${t.id}`);
      if (s.changed.length && JSON.stringify(out) !== JSON.stringify(LV.tryChange(plan, T, t.write))) moved++;
    }
  }
  assert.ok(moved >= 3, `${moved} trials where a guess follows the change and moves the answer`);
  // without a store (no preview) it is the change alone
  const p = migrate(jamie());
  const t = triesOf(p)[0].t;
  assert.deepEqual(LV.trialAnswer(p, T, t), LV.tryChange(p, T, t.write));
  assert.equal(LV.trialAnswer(p, T, null), null);
});

test("a match that is our guess grows with what goes in: the line says the answer with it, and 'Keep this' then says the same answer", async () => {
  const plan = migrate(casey());
  const row = plan.retirement.contributions.find((c) => c.id === "setup-contrib-setup-self");
  assert.equal(Number(row.employerMatch) || 0, 0, "the invented household: a match guessed at $0 while little goes in");
  const t = LV.leverList(plan, { today: T }).rows.find((x) => x.key === "work-saving:setup-self").tries.find((x) => x.label === "$250 more");
  const alone = LV.tryChange(plan, T, t.write), withMatch = LV.trialAnswer(plan, T, t, previewOf(plan));
  assert.equal(alone.age, 74); assert.equal(withMatch.age, 79);
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const here = route();
  const r = await renderPage(VIEW, plan, T, { route: here, computeOf: cOf, settle: settleNow });
  r.root.querySelector(".lv").open = true; r.root.querySelector(".lv").__start?.();
  for (let i = 0; i < 200 && r.root.querySelector(".lv-rows")?.getAttribute("aria-busy"); i++) await sleep(50);
  tryButton(r, "work-saving:setup-self").click();
  chip(r, "$250 more").click();
  const said = /: runs out at (\d+) instead of (\d+)\.$/.exec(panel(r)[0].querySelector(".lv-try-line").textContent);
  assert.ok(said, panel(r)[0].querySelector(".lv-try-line").textContent);
  assert.equal(Number(said[1]), 79, "the match that comes with it is counted");
  assert.equal(r.saved.length, 0);
  button(panel(r)[0], "Keep this").click();
  assert.equal(r.saved[0].retirement.contributions.find((c) => c.id === row.id).employerMatch, 2040);
  const r2 = await renderPage(VIEW, r.saved[0], T, { route: here, computeOf: cOf, settle: settleNow });
  assert.match(r2.root.querySelector(".lv").querySelector(".notice").textContent, new RegExp(`Your retirement answer: now runs out at ${said[1]} \\(was ${said[2]}\\)\\.`));
});

// ---- the one line, a sentence per case ----
test("trialWords: one sentence per case", () => {
  const t = { say: "With prices rising 4% a year" };
  const out = (age) => ({ lasts: false, age, endAge: 95, endReal: 0 }), lasts = (endReal) => ({ lasts: true, age: null, endAge: 95, endReal });
  assert.equal(LV.trialWords(t, out(84), out(88), money), "With prices rising 4% a year: runs out at 84 instead of 88.");
  assert.equal(LV.trialWords(t, out(88), out(88), money), "With prices rising 4% a year: still runs out at 88.");
  assert.equal(LV.trialWords(t, out(84), lasts(50000), money), "With prices rising 4% a year: runs out at 84 instead of lasting to the end (age 95).");
  assert.equal(LV.trialWords(t, lasts(50000), out(88), money), "With prices rising 4% a year: lasts to the end (age 95) instead of running out at 88.");
  assert.equal(LV.trialWords(t, lasts(60000), lasts(100000), money), "With prices rising 4% a year: lasts to the end, with about $40,000 less left at 95 (today's dollars).");
  assert.equal(LV.trialWords(t, lasts(140000), lasts(100000), money), "With prices rising 4% a year: lasts to the end, with about $40,000 more left at 95 (today's dollars).");
  assert.equal(LV.trialWords(t, lasts(100020), lasts(100000), money), "With prices rising 4% a year: lasts to the end, about the same left at 95.");
  assert.equal(LV.trialWords(t, null, out(88), money), "With prices rising 4% a year: this could not be worked out just now.");
  assert.equal(LV.trialWords(null, out(84), out(88), money), "");
});

test("each lever's words: what is tried and what was kept", () => {
  const p = migrate(danaLee());
  const rows = Object.fromEntries(LV.leverList(p, { today: T, money }).rows.map((r) => [r.key, r]));
  const one = (key, label) => rows[key].tries.find((t) => t.label === label);
  assert.equal(rows.prices.tryAsk, "What if prices rise");
  assert.equal(one("prices", "4% a year").say, "With prices rising 4% a year");
  assert.equal(one("prices", "4% a year").kept, "prices rise 4% a year");
  assert.equal(rows["stop:setup-self"].tryAsk, "What if Dana stops work at");
  assert.equal(one("stop:setup-self", "at 67").say, "If Dana stops work at 67");
  assert.equal(one("stop:setup-self", "at 67").kept, "Dana stops work at 67");
  assert.equal(rows.spending.tryAsk, "What if you spend each month");
  assert.equal(one("spending", "$4,646 (5% less)").say, "Spending $4,646 a month in retirement");
  assert.equal(one("spending", "$4,646 (5% less)").kept, "spending in retirement is $4,646 a month");
  assert.equal(rows["work-saving:setup-self"].tryAsk, "What if more went in each month");
  assert.match(one("work-saving:setup-self", "$100 more").say, /^With \$100 a month more going into Dana's 401\(k\)$/);
  assert.match(one("work-saving:setup-self", "$100 more").kept, /^\$[\d,]+ a month goes into Dana's 401\(k\) \(\$100 more\)$/);
  // the first adult Get started left unnamed is "you"
  const j = migrate(morgan());
  const stop = LV.leverList(j, { today: T }).rows.find((r) => r.key.startsWith("stop:"));
  if (/^What if you /.test(stop.tryAsk)) { assert.equal(stop.tryAsk, "What if you stop work at"); assert.match(stop.tries[0].say, /^If you stop work at \d+$/); }
});

// ---- the card ----
test("the card: 'Try a change' opens the row's chips in place; a chip says the answer at once and saves nothing; 'Back to my plan' drops it", async () => {
  const plan = migrate(jamie());
  const bytes = JSON.stringify(plan);
  const r = await page(plan);
  assert.equal(panel(r).length, 0, "nothing is tried until asked");
  const btn = tryButton(r, "prices");
  assert.equal(btn.textContent, "Try a change");
  assert.match(btn.className, /\bsecondary\b/, "outlined: the page keeps its one filled button");
  btn.click();
  assert.equal(panel(r).length, 1);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.match(panel(r)[0].textContent, /^2\.5% a year4% a yearTap one to see what it would do to the answer\. Nothing is saved unless you keep it\.Back to my plan$/);
  assert.equal(panel(r)[0].querySelector(".chips").getAttribute("aria-label"), "What if prices rise", "the chips are named for a screen reader; the row's own title is the one on screen");
  assert.equal(button(panel(r)[0], "Keep this"), undefined, "nothing to keep before a chip is tapped");
  // the row's own "At 4%: ..." lines step aside while its figures are tried: the same sentence is never on screen twice (P2)
  const eff = btn.parentNode.parentNode.querySelector(".lv-eff");
  assert.ok(eff, "the prices row shows its own effects");
  assert.equal(eff.hasAttribute("hidden"), true);
  chip(r, "4% a year").click();
  const line = panel(r)[0].querySelector(".lv-try-line");
  assert.equal(line.textContent, "With prices rising 4% a year: runs out at 68 instead of 70.");
  assert.equal(line.getAttribute("role"), "status");
  assert.equal(chip(r, "4% a year").getAttribute("aria-pressed"), "true");
  assert.match(panel(r)[0].textContent, /This assumes markets do about average\. The answer at the top, and the chance of getting through bad years, are worked out again once you keep this\./);
  assert.match(button(panel(r)[0], "Keep this").className, /\bsecondary\b/);
  chip(r, "2.5% a year").click();
  assert.equal(panel(r)[0].querySelector(".lv-try-line").textContent, "With prices rising 2.5% a year: runs out at 71 instead of 70.");
  assert.equal(r.saved.length, 0, "nothing written");
  button(panel(r)[0], "Back to my plan").click();
  assert.equal(panel(r).length, 0);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(eff.hasAttribute("hidden"), false, "the row's own lines are back");
  assert.equal(r.saved.length, 0);
  assert.equal(JSON.stringify(plan), bytes);
});

// ---- spec test 3: a second lever resets the first ----
test("a second row's 'Try a change' drops the first row's trial", async () => {
  const r = await page(migrate(jamie()));
  tryButton(r, "prices").click();
  chip(r, "4% a year").click();
  tryButton(r, "spending").click();
  assert.equal(panel(r).length, 1);
  assert.equal(panel(r)[0].getAttribute("data-try"), "spending");
  assert.equal(tryButton(r, "prices").getAttribute("aria-expanded"), "false");
  assert.equal(r.root.querySelector('[data-lever="prices"]').querySelector(".lv-eff").hasAttribute("hidden"), false, "the first row is as it was");
  assert.match(panel(r)[0].textContent, /Tap one to see what it would do to the answer/, "the new row starts with nothing tried");
  // back on the first row: nothing is remembered
  tryButton(r, "prices").click();
  assert.equal(panel(r)[0].getAttribute("data-try"), "prices");
  assert.equal(panel(r)[0].all().filter((e) => e.getAttribute("aria-pressed") === "true").length, 0);
  assert.equal(r.saved.length, 0);
});

// ---- nothing is written until "Keep this"; leaving or Back drops the trial ----
test("a trial is never stored: drawn again (another page and back, the phone's Back) the page shows no trial and the plan is as it was", async () => {
  const plan = migrate(jamie());
  const bytes = JSON.stringify(plan);
  const r = await page(plan);
  tryButton(r, "stop:setup-self").click();
  chip(r, "at 67").click();
  assert.equal(panel(r)[0].querySelector(".lv-try-line").textContent, "If Jamie stops work at 67: runs out at 78 instead of 70.");
  assert.equal(r.saved.length, 0);
  // the same address drawn again (Back), and a new arrival
  for (const r0 of [route(), route()]) {
    const again = await page(plan, r0);
    assert.equal(panel(again).length, 0);
    assert.equal(again.root.querySelector(".lv").querySelector(".notice"), null, "no green line: nothing was saved");
    assert.doesNotMatch(again.text(), /instead of 70|Keep this|Back to my plan/);
    assert.equal(again.saved.length, 0);
  }
  assert.equal(JSON.stringify(plan), bytes);
  // nothing of it is in the browser's storage either (the page asks for none: no localStorage in this process)
  assert.equal(globalThis.localStorage?.length ?? 0, 0);
});

// ---- spec tests 4 and 5: "Keep this" saves through the store, the green line names the new answer, the card stays open ----
test("'Keep this': one store.update of that figure; then the green line in the card says what was saved and the answer now and before, with Undo, and the card is open", async () => {
  const plan = migrate(jamie());
  const here = route();
  const r = await page(plan, here);
  tryButton(r, "stop:setup-self").click();
  chip(r, "at 67").click();
  button(panel(r)[0], "Keep this").click();
  assert.equal(r.saved.length, 1, "one save");
  const want = structuredClone(plan); want.household.people.find((x) => x.id === "setup-self").retirementAge = 67;
  assert.deepEqual(r.saved[0], want, "exactly the age");
  // the shell draws the page again for the same address
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const r2 = await renderPage(VIEW, r.saved[0], T, { route: here, computeOf: cOf });
  const card = r2.root.querySelector(".lv");
  assert.equal(card.open, true, "the card stays open");
  const notice = card.querySelector(".notice");
  assert.match(notice.className, /\bok\b/);
  assert.match(notice.textContent, /^Saved: Jamie stops work at 67\. Your retirement answer: now runs out at 78 \(was 70\)\./);
  // not said a second time in the hero (one green line, where the person is)
  assert.equal(r2.root.querySelector(".lv-before"), null);
  for (let i = 0; i < 200 && r2.root.querySelector(".lv-rows")?.getAttribute("aria-busy"); i++) await sleep(50);
  const first = r2.root.querySelector(".lv-rows").children[0];
  assert.equal(first.getAttribute("data-lever"), "stop:setup-self");
  assert.match(first.textContent, /You just changed this: 65 → 67\./);
  assert.equal(panel(r2).length, 0, "the trial is over");
  // a later drawing says it no more
  const r3 = await renderPage(VIEW, r.saved[0], T, { route: here, computeOf: cOf });
  assert.equal(r3.root.querySelector(".lv").querySelector(".notice"), null);
});

// (review 2026-11-14, F1: a fast double tap saved twice, and the second save, which changes nothing, took the first one's Undo)
test("a double tap on 'Keep this' saves once", async () => {
  const plan = migrate(jamie());
  const r = await page(plan);
  tryButton(r, "work-saving:setup-self").click();
  chip(r, "$250 more").click();
  const keep = button(panel(r)[0], "Keep this");
  keep.dispatch("click"); keep.dispatch("click");
  assert.equal(r.saved.length, 1, "one save");
  assert.equal(keep.disabled, true, "and the button says so");
  assert.equal(button(panel(r)[0], "Back to my plan").disabled, true);
});

// (review 2026-11-14, P5: "more left at 95" under "Saved: ..." did not say more than what)
test("after 'Keep this' on a plan that lasts either way, the green line says more or less than before", async () => {
  const last = (endReal) => ({ lasts: true, age: null, endAge: 95, endReal });
  assert.equal(LV.answerChangeWords(last(100000), last(605000), money, { than: true }), "lasts to the end, with about $505,000 more left at 95 than before (today's dollars)");
  assert.equal(LV.answerChangeWords(last(605000), last(100000), money, { than: true }), "lasts to the end, with about $505,000 less left at 95 than before (today's dollars)");
  assert.equal(LV.answerChangeWords(last(100000), last(605000), money), "lasts to the end, with about $505,000 more left at 95 (today's dollars)", "other pages' words are as they were");
  const plan = migrate(familyPlan(T));
  const here = route();
  const r = await page(plan, here);
  const b = r.root.all().find((e) => e.tagName === "BUTTON" && /^work-saving:/.test(e.getAttribute("data-try-open") ?? ""));
  b.click();
  panel(r)[0].all().find((e) => e.tagName === "BUTTON" && e.classList.contains("chip")).click();
  button(panel(r)[0], "Keep this").click();
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const r2 = await renderPage(VIEW, r.saved[0], T, { route: here, computeOf: cOf });
  assert.match(r2.root.querySelector(".lv").querySelector(".notice").textContent, /Your retirement answer: lasts to the end, with about \$[\d,]+ more left at \d+ than before \(today's dollars\)\./);
});

test("every lever keeps through the same path: prices, spending, what goes in at work", async () => {
  for (const [key, label, said] of [["prices", "4% a year", /^Saved: prices rise 4% a year\. Your retirement answer: now runs out at 68 \(was 70\)\./],
    ["spending", "$2,898 (10% less)", /^Saved: spending in retirement is \$2,898 a month\. Your retirement answer: now runs out at 73 \(was 70\)\./],
    ["work-saving:setup-self", "$250 more", /^Saved: \$[\d,]+ a month goes into Jamie's 401\(k\) \(\$250 more\)\. Your retirement answer: now runs out at 76 \(was 70\)\./]]) {
    const plan = migrate(jamie());
    const here = route();
    const r = await page(plan, here);
    tryButton(r, key).click();
    chip(r, label).click();
    button(panel(r)[0], "Keep this").click();
    assert.equal(r.saved.length, 1, key);
    const t = LV.leverList(plan, { today: T }).rows.find((x) => x.key === key).tries.find((x) => x.label === label);
    assert.deepEqual(r.saved[0], kept(plan, t), `${key}: the store holds what the chip tried`);
    const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
    const r2 = await renderPage(VIEW, r.saved[0], T, { route: here, computeOf: cOf });
    assert.match(r2.root.querySelector(".lv").querySelector(".notice").textContent, said, key);
  }
});

test("no 'Try a change' where there is no answer to set it against (nothing saved yet), and none on a row that is not one of the four", async () => {
  const sam = migrate(personas.finishSetup ? personas.finishSetup("sam", personas.sam(T), T) : personas.sam(T));
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(VIEW, sam, T, { route: route(), computeOf: cOf });
  for (let i = 0; i < 200 && r.root.querySelector(".lv-rows")?.getAttribute("aria-busy"); i++) await sleep(50);
  assert.equal(r.root.all().filter((e) => e.textContent === "Try a change").length, 0);
  const j = await page(migrate(jamie()));
  for (const b of j.root.all().filter((e) => e.tagName === "BUTTON" && e.textContent === "Try a change")) assert.match(b.getAttribute("data-try-open"), /^(prices|spending|stop:|work-saving:)/);
});

// ---- invariance: the design adds no field to the plan and touches no compute() ----
test("invariance: with nothing tried, the page's own figures and the card's rows are what they were (the tries ride on the rows and change none of them)", () => {
  for (const [name, mk] of HOUSEHOLDS) {
    const plan = freeze(mk());
    const before = JSON.stringify(projection(plan, { today: T }));
    const rows = LV.leverRows(plan, { today: T });
    // a row's own parts do not depend on its tries: taken off, the words, the order and the effects are the same
    const strip = (x) => JSON.stringify({ key: x.key, label: x.label, value: x.value, short: x.short, tag: x.tag, effects: x.effects, score: x.score, acts: x.acts });
    const again = LV.leverRows(plan, { today: T });
    assert.deepEqual([...rows.shown, ...rows.folded, ...rows.hidden].map(strip), [...again.shown, ...again.folded, ...again.hidden].map(strip), name);
    for (const { t } of triesOf(plan)) LV.tryChange(plan, T, t.write);
    assert.equal(JSON.stringify(projection(plan, { today: T })), before, `${name}: the projection, byte for byte, after every chip was tried`);
    // no try names a field the plan did not have: after a keep the plan's top-level sections are the same set
    for (const { t } of triesOf(plan)) assert.deepEqual(Object.keys(kept(plan, t)).filter((k) => k !== "guesses").sort(), Object.keys(plan).filter((k) => k !== "guesses").sort(), `${name}: ${t.id}`);
  }
});
