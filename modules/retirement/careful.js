// modules/retirement/careful.js -- the view side, shared by the pages that show the careful answer (the one that lasts even in a bad run of years): the spending that
// lasts (Will the money last?, How much to take out, Goal seek: monte-carlo/compute.js carefulSteps) and the age to stop work
// (Financial independence: fire/compute.js carefulAgeSteps). Each is thousands of runs of the projection, half a second or
// more here and longer on a phone. So the page is drawn first and the answer filled in after the first paint: on the PC when
// it is connected (the page stays free), else on this device a slice at a time between frames, so taps and scrolling never
// wait for it (round 5, 2026-11-02: the page froze for about a second).
import { buildInputs } from "./projection/compute.js";
import { api } from "../../core/api.js";
import { carefulSteps, CAREFUL_CHANCE } from "./monte-carlo/compute.js";
import { chanceWords, BAD_RUN, BAD_RUN_NOTE } from "./odds.js";

export { CAREFUL_CHANCE };

/** fn() once the page has been painted: after the next frame, not before it. */
export function afterPaint(fn) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 0);
}

// the answers worked out on this visit, by what they were worked out from (a short hash of it): a few plans at most, newest kept
const answers = new Map();
const KEEP = 12;
function remember(key, a) { answers.delete(key); answers.set(key, a); while (answers.size > KEEP) answers.delete(answers.keys().next().value); }

/** keyOf(value) -> a short string standing for the value's JSON (FNV-1a, 32 bits, and the length): what an answer is remembered by. */
export function keyOf(value) {
  const s = JSON.stringify(value) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${(h >>> 0).toString(36)}.${s.length.toString(36)}`;
}

/** knownAnswer(key) -> the remembered answer for `key` (null when it was worked out and there is none), or undefined. */
export const knownAnswer = (key) => (answers.has(key) ? answers.get(key) : undefined);

/**
 * whenWorked(ctx, el, { remote: [key, params], pick, steps }, done): after the first paint, done(answer). With the PC connected
 * it asks the PC for `remote` (a heavy module's compute) and done(pick(result)); else it drives the generator `steps()`
 * (a pure *Steps function) a slice of about 24 ms at a time and done(its return value). done(null) when it cannot be worked
 * out. Nothing runs, and done is never called, once `el` has left the page (the page was redrawn or left).
 */
export function whenWorked(ctx, el, { remote, pick = (x) => x, steps, key = null }, done) {
  const alive = () => el.isConnected;
  // the same plan worked out before on this visit to the app: the answer at once, before the first paint, so a second visit or a
  // save elsewhere on the page never shows the waiting words or a verdict that then changes (stress test 2026-11-11, HC-2)
  if (key !== null && answers.has(key)) { const a = answers.get(key); queueMicrotask(() => done(a)); return; }
  const finish = (a) => { if (key !== null) remember(key, a); done(a); };
  afterPaint(() => {
    if (!alive()) return;
    if (remote && ctx.store.backend?.() === "server") {
      // ask the PC directly: computeRemote's own fallback works it out here in one block, which froze the page when the PC
      // did not answer (review 2026-11-05); on a failure the slices below run instead
      api.compute(remote[0], remote[1], ctx.store.get()).then((out) => { if (alive()) finish(pick(out) ?? null); }, () => { if (alive()) local(); });
      return;
    }
    local();
  });
  function local() {
    let it;
    try { it = steps(); if (!it) { done(null); return; } } catch (e) { console.warn("[planner] careful answer", e); done(null); return; }
    const slice = () => {
      if (!alive()) return;
      const t0 = performance.now();
      let r;
      try { do r = it.next(); while (!r.done && performance.now() - t0 < 24); } catch (e) { console.warn("[planner] careful answer", e); done(null); return; }
      if (r.done) finish(r.value ?? null); else setTimeout(slice, 0);
    };
    slice();
  }
}

/**
 * whenCareful(ctx, el, done, { legacy }): Monte Carlo's `careful` object for the plan ({ yearly, rate, planned, average, ... }:
 * the spending that lasts in 9 of 10 markets, leaving `legacy`), or null; worked out as whenWorked says.
 */
export function whenCareful(ctx, el, done, { legacy = 0 } = {}) {
  whenWorked(ctx, el, {
    key: carefulKey(ctx, { legacy }),
    // the PC runs the same search on the same draw (paths: 100 keeps the rest of its run small; the figure is settled on 2,000)
    remote: ["retirement/monte-carlo", { today: ctx.fmt.today(), paths: 100, legacy }],
    pick: (mc) => (mc?.ready ? mc.careful ?? null : null),
    steps: () => { const b = buildInputs(ctx.store.get(), { today: ctx.fmt.today() }); return b.inputs ? carefulSteps(b.inputs, { legacy }) : null; },
  }, done);
}

/** carefulKey(ctx, { legacy }) -> what whenCareful remembers its answer by: the projection's inputs for the plan now, the goal and the day. */
export function carefulKey(ctx, { legacy = 0 } = {}) {
  const today = ctx.fmt.today();
  let inputs = null;
  try { inputs = buildInputs(ctx.store.get(), { today }).inputs ?? null; } catch { inputs = null; }
  return keyOf(["careful", today, legacy, inputs]);
}

/** Whole $100s a month that never add up to more than the yearly figure ($110,100 a year is $9,100 a month, not $9,200). */
export const monthlyOf = (yearly) => Math.floor(yearly / 1200) * 100;

/** A soft grey bar as wide as the text that will take its place (`like`, its expected length), for an answer still being worked out. */
/** Words a screen reader says while an answer is being worked out (the grey bars are hidden from it). */
export const busyWords = (ui, text) => ui.h("span", { style: { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } }, text);

// never wider than the line it sits in (stress test 2026-11-11, x-3 and A9: a 33em bar made the page 518 px wide on a phone)
export const slot = (ui, like) => ui.h("span", { "aria-hidden": "true", style: { display: "inline-block", width: `${String(like).length * 0.55}em`, maxWidth: "100%", height: "0.8em", borderRadius: "4px", background: "var(--line-2)", verticalAlign: "-0.05em" } });

/** The withdrawal rules other than steady spending, in plain words (Will the money last?, Financial independence, Goal seek). */
export const RULE_WORDS = { percent: "a set share of what is left each year", guardrails: "spending trimmed by a tenth after bad years", vpw: "spending what the years left can afford" };

/** chanceWords: how often the money lasts, in the same plain words on every page (odds.js). */
export { chanceWords, BAD_RUN, BAD_RUN_NOTE };

/** An account's own name, said as an account (round 8, Batch 5b): "Ruth's retirement" reads "Ruth's retirement account"; "Jo's IRA" stays. */
export const accountName = (n) => (/\b(ira|401\(?k\)?|403\(?b\)?|457|tsp|roth|account|plan|fund|savings|checking|brokerage|cash|pension|annuity|hsa)$/i.test(String(n).trim()) ? n : `${n} account`);

const listOf = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");

/**
 * leftWords(ui, money, left) -> [text and nodes]: the income the projection does not count after work stops (projection
 * buildInputs' `otherLeft`), said plainly: support and other income with no end date, with the way to keep it (an end date on
 * the Income page, linked), dividends and interest, which the accounts' growth already holds (recheck 2026-11-05), and money
 * taken out of the household's own accounts ("IRA withdrawals": projection ownAccountMoney), which the plan already draws on,
 * so an end date is never suggested for it (recheck 2026-11-05, second pass: following that advice counted the IRA twice).
 * Dividends and interest from outside the accounts (a loan the household made, a trust) are typed as other income with an end
 * date, and the sentence says so.
 */
/** leftWhy(item) -> why an `otherLeft` item is not counted, for Will the money last?'s "Not counted" row (recheck 2026-11-05). */
export const leftWhy = (x) => (x.why === "growth" ? "already in your accounts' growth" : x.why === "accounts" ? "taken from your own accounts, which the plan already draws on" : "no end date, so it stops when work does");

export function leftWords(ui, money, left = []) {
  const work = left.filter((x) => x.why === "work"), growth = left.filter((x) => x.why === "growth"), own = left.filter((x) => x.why === "accounts");
  const sum = (a) => money(a.reduce((s, x) => s + x.yearly, 0));
  const out = [];
  const gap = () => (out.length ? " " : "");
  if (work.length) out.push(`${sum(work)} a year of other income is not counted after work stops: ${listOf(work.map((x) => x.name))}. Give ${work.length === 1 ? "it" : "each one"} an end date on the `, ui.h("a", { href: "#/cashflow/income" }, "Income page"), ` if ${work.length === 1 ? "it carries" : "they carry"} on.`);
  if (own.length) out.push(`${gap()}${listOf(own.map((x) => x.name))}, ${sum(own)} a year, ${own.length === 1 ? "is not added: it comes" : "are not added: they come"} out of your own accounts, which the plan already draws on. If an account is missing, add it on `, ui.h("a", { href: "#/balance/net-worth" }, "Net worth"), ".");
  if (growth.length) out.push(`${gap()}Dividends and interest, ${sum(growth)} a year, are not added: your accounts' growth already includes them. If some of it comes from outside your accounts (a loan you made, a trust), type that part as other income with an end date on the `, ui.h("a", { href: "#/cashflow/income" }, "Income page"), ".");
  return out;
}
