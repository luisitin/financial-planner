// modules/scenarios/goal-seek/compute.js -- PURE and heavy. Pick the goal (the money lasts to the end
// of the plan, leaving at least so much) and every lever is solved for it on its own, everything else
// held as the plan has it: the most you can spend, the earliest you can retire, the saving it takes,
// the return it needs, the lump sum it is short (or the room it has today), and the Social Security
// claiming age that lets you spend the most.
import { project, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs, healthAdded, workingNow, withStops, compute as projectionOf, savingsUnknown } from "../../retirement/projection/compute.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";
import { nameIn, NamesIn, verbFor } from "../../../core/words.js";

/** The largest x in [lo, hi] with ok(x) (ok true at lo, monotone), the bracket grown past hi while ok; null if ok(lo) fails. */
export function largestWhere(ok, lo, hi, tol = 0.5) {
  if (!ok(lo)) return null;
  for (let k = 0; k < 60 && ok(hi); k++) { lo = hi; hi = hi * 2 + 1; }
  for (let k = 0; k < 200 && hi - lo > tol; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
  return lo;
}
/** The smallest x in [lo, hi] with ok(x) (ok false at lo, monotone, true by hi); lo itself when ok(lo); null when ok(hi) fails. */
export function smallestWhere(ok, lo, hi, tol = 0.5) {
  if (ok(lo)) return lo;
  if (!ok(hi)) return null;
  for (let k = 0; k < 200 && hi - lo > tol; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}

/**
 * earliestRetireAge(plan, { today, legacy = 0, personId }) -> { age (null: not by the last age tried), now (age is this
 *   year's: they could stop now), planned, ageNow, upTo (the last age tried), personId, name,
 *   stopYear (the year they stop at that age: never before this year), plannedStopYear, yearsSooner (plannedStopYear - stopYear:
 *   0 when both are this year, as for someone who turns the planned age later this year) } | null
 * The first whole age, from this year's (stopping now) to the later of 75 and the planned age, at which one adult (personId,
 * else the one marked self, else the first) can stop work and the plan still lasts to its end leaving `legacy` (today's
 * dollars), everyone else as the plan has it. null when there is no such adult or date, or they have already reached the
 * planned age. Goal seek's "When you can retire" lever and Financial independence share it, so both pages give one answer.
 * (Round 5 review, 2026-11-02: it started at next year's age and never below 45, so a plan that already worked now or at
 * 40 read "at 59" or "at 45"; and someone past 75 was never tried.)
 * Each age is tested spending the plan's amount the same every year after inflation (strategy "fixed-real"), as the most you
 * can spend and the 9-in-10 figures are, whatever rule the plan uses (recheck 2026-11-05: under a set share of what is left,
 * guardrails or years-left spending the money never runs out, so a 36-year-old read "stopping now would do").
 * Fifth pass: without `personId`, the adult the question is about (leadAdult), never one Get started says does not work.
 * `spendingScale` (round 8, 2026-11-06; default 1): each age is tested spending that many times the plan's amount, so the
 * Plan health score can ask for its 115% ("room for bad luck") on the same search. `search: "bisect"` (the score's, for speed:
 * about 7 projections instead of one per year of age) tries the last age first (none: null at once), then halves the range;
 * it finds the same age as the year-by-year scan whenever stopping later never makes the plan worse, the usual case.
 */
export function earliestRetireAge(plan, params = {}) {
  const today = params.today ?? null;
  const legacy = Math.max(0, Number(params.legacy) || 0);
  const scale = Number(params.spendingScale) > 0 ? Number(params.spendingScale) : 1;
  const adults = (plan?.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = (params.personId ? adults.find((p) => p.id === params.personId) : null) ?? leadAdult(plan, adults, today);
  if (!self || !today) return null;
  const ageNow = ageOn(self.birthDate, today);
  const planned = Number(self.retirementAge ?? plan.assumptions?.retirementAge ?? 65);
  if (ageNow === null || !Number.isFinite(planned) || !(ageNow < planned)) return null;
  const meets = (inputs) => { const r = project({ ...inputs, strategy: "fixed-real", ...(scale !== 1 ? { spending: { ...inputs.spending, yearly: inputs.spending.yearly * scale } } : {}) }); return r.success && r.endBalanceReal >= legacy - 0.5; };
  // the plan with steady spending, so the health line is priced on the withdrawals each age is tested with (review 2026-11-06:
  // priced on the plan's own rule, a set share of what is left gave the family 61 against 62 with steady spending)
  const withAge = (a) => { const p2 = JSON.parse(JSON.stringify(plan)); p2.household.people.find((q) => q.id === self.id).retirementAge = a; p2.retirement = { ...(p2.retirement ?? {}), strategy: "fixed-real" }; return buildInputs(p2, { today }).inputs; };
  const upTo = Math.max(75, planned);
  let age = null;
  if (params.search === "bisect") {
    const ok = (a) => { const inp = withAge(a); return !!inp && meets(inp); };
    if (ok(upTo)) { let lo = ageNow - 1, hi = upTo; while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid; } age = hi; }
  } else for (let a = ageNow; a <= upTo; a++) { const inp = withAge(a); if (inp && meets(inp)) { age = a; break; } }
  // the engine stops work in the year that age is reached, never before this year: compare stop years, not ages (review
  // 2026-11-02: 64 now and 65 in December both stop in 2026, and were called "1 year before the plan's 65")
  const year = Number(String(today).slice(0, 4)), by = Number(String(self.birthDate).slice(0, 4));
  const stopYear = age === null ? null : Math.max(year, by + age), plannedStopYear = Math.max(year, by + planned);
  return { age, now: age === ageNow, planned, ageNow, upTo, personId: self.id, name: self.name, stopYear, plannedStopYear, yearsSooner: stopYear === null ? null : plannedStopYear - stopYear };
}

/**
 * How the retirement lever is searched, in the page's words ("How it is worked out"; verify 2026-11-06, sixth pass: it read
 * "the first person's earliest age" while the lever is about the adult who still works, a partner when the first adult has
 * stopped: "When Jo can retire" under "Retirement: the first person's earliest age").
 */
export const RETIRE_HOW = "Retirement: the earliest age of the adult who still works (the first person while they work, else the next one who does; none when nobody works), from this year's to 75 (or the planned age if later), counted by the year they stop; when the first person has stopped before the age on file and the other's pay is on Income, with the first person stopped from this year, as Financial independence does.";

/**
 * The adult the "When ... can retire" question is about (review 2026-11-06: the projection's workingNow, one work rule with the
 * health line and Financial independence): the first adult while they still work, else the first other adult who does, else
 * null (nobody works: retirement is now, there is no age to find); the one marked self (else the first) when the plan cannot
 * be run yet. The fifth pass took the projection's `retireBy` here, so with the first adult past their age and a partner at
 * work it asked about nobody while Financial independence asked about the partner.
 */
export function leadAdult(plan, adults, today) {
  let b = null;
  try { b = buildInputs(plan, { today }); } catch { b = null; }
  if (!b?.inputs) return adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const wn = workingNow(plan, b.inputs, today);
  return wn.lead ? adults.find((p) => p.id === wn.lead.id) ?? null : null;
}

/**
 * compute(plan, { today, legacy = 0 }) -> {
 *   ready, missing, legacy, meets (the plan as it stands reaches the goal), endReal, spendingMonthly,
 *   strategy (the plan's withdrawal rule: the spending and retirement levers spend the same every year whatever it is),
 *   levers: [{ id, title, icon, value, current, unit: "month"|"age"|"rate"|"once", status: "room"|"needs"|"cannot"|"same", sentence, go }]
 * }
 * Every money figure is in today's dollars. `legacy` is what the plan should still hold at its end.
 * Round 8 (2026-11-06), for the Plan health score's hint, both left out by the page itself (which then works as before):
 * `spendingScale` (default 1) solves every lever for the plan spending that many times its amount in retirement (1.15:
 * "room for bad luck"); `spendingMonthly` and each lever's `current` are then the scaled amount. `only` (lever ids) works
 * just those levers, so a caller that needs three does not pay for the Social Security ages. `retireSearch: "bisect"`: the
 * retirement age by halving (earliestRetireAge's `search`), for the score's speed.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const legacy = Math.max(0, Number(params.legacy) || 0);
  const scale = Number(params.spendingScale) > 0 ? Number(params.spendingScale) : 1;
  const want = (id) => !Array.isArray(params.only) || params.only.includes(id);
  // Round 8 batch 4 follow-up (2026-11-07): an amount you must reach rounds UP to the shown $10, a limit rounds DOWN, so following
  // the words always works ("save about $240" when $243.53 is needed left the money $12 short); `near` for what the plan has now.
  const cur = plan.meta?.currency ?? "USD";
  const fmt = (n, dir = "near") => fmtMoney(dir === "up" ? roundUp(n) : dir === "down" ? roundDown(n) : Math.round(n / 10) * 10, cur);
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ready: false, missing: b.missing, legacy };
  const I = scale !== 1 ? { ...copyInputs(b.inputs), spending: { ...b.inputs.spending, yearly: b.inputs.spending.yearly * scale } } : b.inputs;
  const meets = (inputs) => { const r = project(inputs); return r.success && r.endBalanceReal >= legacy - 0.5; };
  const base = project(I);
  const ok0 = meets(I);
  const levers = [];
  const add = (l) => levers.push(l);
  const spendingMonthly = I.spending.yearly / 12;

  // 1. spending: the most a month that still reaches the goal, if markets do as well as average every year (the view adds the
  // figure that does it in 9 of 10 markets, Monte Carlo's careful figure for the same goal, once worked out)
  if (want("spending")) {
    const best = largestWhere((s) => meets({ ...copyInputs(I), strategy: "fixed-real", spending: { yearly: s } }), 0, Math.max(12000, I.spending.yearly * 2), 1);
    const m = best === null ? 0 : best / 12;
    // the projection's health line (marketplace to 65, then Medicare) is paid on top of the spending figure: said so, as Will the money last? does
    const h = healthAdded(b.health);
    const onTop = h ? " on top of health insurance" : "", before = h ? " before health insurance" : "";
    add({ id: "spending", icon: "🛒", title: "What you can spend", value: m, current: spendingMonthly, unit: "month", status: best === null ? "cannot" : m >= spendingMonthly ? "room" : "needs",
      sentence: best === null ? `Even spending nothing in retirement${h ? " but health insurance" : ""} does not reach the goal: look at the other changes.` : m >= spendingMonthly ? `If markets do as well as average, up to about ${fmt(m / scale, "down")} a month${onTop}, ${fmt((m - spendingMonthly) / scale, "down")} more than the ${fmt(spendingMonthly / scale)} the plan spends${before}.` : `If markets do as well as average, about ${fmt(m / scale, "down")} a month${onTop}: ${fmt((spendingMonthly - m) / scale, "up")} less than the ${fmt(spendingMonthly / scale)} the plan spends${before}.`, go: ["retirement", "projection"] });
  }

  // 2. the earliest retirement age that reaches the goal, for the adult Financial independence asks about (review 2026-11-06,
  // workingNow: the first adult while they still work, else the first other who does; no lever when nobody works), searched on
  // the same plan: with the first adult stopping now when they stopped before the age on file (stopNow), so both pages give one age
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const wn = workingNow(plan, I, today);
  const self = wn.lead ? adults.find((p) => p.id === wn.lead.id) ?? null : null;
  const firstStops = wn.stopNow.length ? adults.find((p) => p.id === wn.stopNow[0].personId) ?? null : null;
  // the unnamed first adult ("Me") reads "you", the partner "your spouse" (review 2026-11-06, round 7)
  const stopWords = !firstStops ? "" : ` This counts ${nameIn(firstStops.name)} as ${plan.guide?.setup?.status?.[firstStops.id] === "none" ? "not working from this year on" : "stopped from this year"}.`;
  const ageNow = self ? ageOn(self.birthDate, today) : null;
  const retireAge = self ? Number(self.retirementAge ?? plan.assumptions?.retirementAge ?? 65) : null;
  const withPlan = (mutate) => { const p2 = JSON.parse(JSON.stringify(plan)); mutate(p2); return buildInputs(p2, { today }).inputs; };
  if (want("retire") && self && ageNow < retireAge) {
    const found = earliestRetireAge(withStops(plan, wn.stopNow), { today, legacy, personId: self.id, ...(scale !== 1 ? { spendingScale: scale } : {}), ...(params.retireSearch === "bisect" ? { search: "bisect" } : {}) });
    // counted by the year they stop (round 5 review, 2026-11-02): an earlier age that stops in the same year is no sooner
    const sooner = found?.yearsSooner ?? null;
    const thisYear = !!found && found.plannedStopYear === found.stopYear && found.stopYear === Number(String(today).slice(0, 4));
    const earliest = found?.age === null || found?.age === undefined ? null : sooner === 0 ? retireAge : found.age;
    const yrs = (n) => `${n} year${n === 1 ? "" : "s"}`;
    // the age is markets doing exactly as well as average every year: said so (Financial independence adds the 9-in-10 age)
    add({ id: "retire", icon: "🏖️", title: `When ${nameIn(self.name)} can retire`, value: earliest, current: retireAge, unit: "age", status: earliest === null ? "cannot" : sooner > 0 ? "room" : sooner === 0 ? "same" : "needs",
      sentence: (earliest === null ? `Not by ${found?.upTo ?? 75}, even if markets do as well as average: working longer alone does not get there.`
        : sooner > 0 && found.now ? `If markets do as well as average, now: the money already lasts if ${nameIn(self.name)} stopped this year, ${yrs(sooner)} before the plan's ${retireAge}.`
        : sooner > 0 ? `If markets do as well as average, as early as ${earliest}, ${yrs(sooner)} before the plan's ${retireAge}.`
        : sooner === 0 ? (thisYear ? "This year, as planned." : `If markets do as well as average, at ${retireAge} as planned: not a year earlier.`)
        : `If markets do as well as average, at ${earliest}: ${yrs(-sooner)} later than the plan's ${retireAge}.`) + stopWords, go: ["household", "people"] });
  }

  // 3. saving: the extra (or the cut) a month, before retirement, into the accounts already used (the first person's biggest contribution, else taxable)
  if (want("saving") && I.retireYear > I.startYear) {
    const now = I.contributions.reduce((s, c) => s + c.yearly, 0) / 12;
    const main = [...I.contributions].sort((x, y) => y.yearly - x.yearly)[0];
    const withSaving = (extra) => { const c = copyInputs(I); if (extra >= 0) c.contributions.push({ bucket: main?.bucket ?? "taxable", yearly: extra * 12, personIndex: main?.personIndex ?? 0, name: "extra" }); else { const f = now > 0 ? Math.max(0, 1 + extra / now) : 1; for (const x of c.contributions) x.yearly *= f; } return c; };
    const need = smallestWhere((e) => meets(withSaving(e)), -now, Math.max(5000, now * 10), 1);
    add({ id: "saving", icon: "🐖", title: "What you need to save", value: need === null ? null : now + need, current: now, unit: "month", status: need === null ? "cannot" : need <= -0.5 ? "room" : need < 0.5 ? "same" : "needs",
      sentence: need === null ? "No amount of saving gets there before retirement." : need <= -now + 0.5 ? `Nothing more: it gets there even if retirement saving stopped today (now ${fmt(now)} a month).` : need < -0.5 ? `About ${fmt(now + need, "up")} a month would do: ${fmt(-need, "down")} less than the ${fmt(now)} going in now.` : need < 0.5 ? `Exactly what goes in now, ${fmt(now)} a month.` : now < 0.5 ? `Save about ${fmt(now + need, "up")} a month. You save nothing toward this today.` : `About ${fmt(now + need, "up")} a month, ${fmt(need, "up")} more than the ${fmt(now)} going in now.`, go: ["retirement", "contributions"] });
  }

  // 4. the return it needs: stocks and bonds moved together
  if (want("returns")) {
    const shifted = (d) => { const c = copyInputs(I); c.returns.stocks += d; c.returns.bonds += d; return c; };
    const d = smallestWhere((x) => meets(shifted(x)), -0.15, 0.2, 0.0001);
    const mix = (I.rates.stocksNow + I.rates.stocksRetired) / 2;
    const blend = (x) => mix * (I.returns.stocks + x) + (1 - mix) * (I.returns.bonds + x);
    add({ id: "returns", icon: "📈", title: "The return it needs", value: d === null ? null : blend(d), current: blend(0), unit: "rate", status: d === null ? "cannot" : d < -0.0005 ? "room" : ok0 && d < 0.0005 ? "same" : "needs",
      sentence: d === null ? "No believable return gets there on its own." : d < -0.0005 ? `About ${pctUp(blend(d))} a year on your mix would do, against the ${pct(blend(0))} you assume: ${pts(-d, "down")} of room for bad luck.` : ok0 && d < 0.0005 ? `About ${pct(blend(0))} a year, just what you assume: no room for bad luck.` : `About ${pctUp(blend(d))} a year on your mix, ${pts(d, "up")} more than the ${pct(blend(0))} you assume.`, go: ["system", "assumptions"] });
  }

  // 5. a lump sum today: what it is short, or what could come out today and still get there
  if (want("lump")) {
    const withLump = (x) => { const c = copyInputs(I); c.events.push({ year: c.startYear, amount: -x, label: "lump sum" }); return c; };
    if (ok0) {
      const spare = largestWhere((x) => meets(withLump(-x)), 0, Math.max(10000, Object.values(I.balances).reduce((s, v) => s + v, 0)), 50);
      add({ id: "lump", icon: "💰", title: "Room today", value: spare ?? 0, current: 0, unit: "once", status: "room", sentence: `About ${fmt(spare ?? 0, "down")} could come out of savings today and the plan would still get there. Not a suggestion to spend it: a measure of the room you have.`, go: ["balance", "net-worth"] });
    } else {
      const short = smallestWhere((x) => meets(withLump(x)), 0, 1e7, 50);
      add({ id: "lump", icon: "💰", title: "What it is short today", value: short, current: 0, unit: "once", status: short === null ? "cannot" : "needs", sentence: short === null ? "More than ten million dollars today: look at the other changes." : `About ${fmt(short, "up")} more in savings today would get there (an inheritance, a sale, a bonus).`, go: ["balance", "net-worth"] });
    }
  }

  // 6. Social Security: the claiming age that lets the plan spend the most while reaching the goal, for the people who have
  // not claimed yet and only at ages still possible (round 4, 2026-11-02: it advised claiming at 70 to someone who has
  // been getting it since 66); those still choosing all claim at the same age here
  const ss = plan.retirement?.socialSecurity ?? {};
  let sp = null;
  if (want("claim")) try { sp = computeSocialSecurity(plan, { today }); } catch { sp = null; }
  const movable = (sp?.people ?? []).filter((x) => ss[x.id] && !x.claimed && !(x.ageNow !== null && x.ageNow >= 70 - 1 / 24));
  if (want("claim") && I.incomes.some((x) => x.kind === "social") && movable.length) {
    const claims = [...new Set(movable.map((x) => Number(ss[x.id].claimAge) || 67))];
    // the ages still possible: "now" (to the month, as the Social Security page offers it first), then each whole age to 70
    // (review 2026-11-02: "now" at 69 and 5 months was never tried, so "70 spends the most" could be false)
    const nowAge = Math.min(70, Math.max(62, ...movable.map((x) => (x.ageNow !== null ? Math.ceil(x.ageNow * 12 - 1e-9) / 12 : 62))));
    // that first age is "now" only when it is now for everyone moved: within a month of each one's age today; otherwise it
    // reads "at 64 and 6 months" (review 2026-11-02, round 5: a couple of 64 and 60 were both told "now")
    const nowForAll = movable.every((x) => x.ageNow !== null && Math.abs(nowAge - x.ageNow) <= 1 / 12 + 1e-9);
    const candidates = [nowAge, ...[63, 64, 65, 66, 67, 68, 69, 70].filter((a) => a > nowAge + 1 / 24)];
    let best = null;
    const results = [];
    for (const a of candidates) {
      const inp = withPlan((p) => { for (const x of movable) p.retirement.socialSecurity[x.id].claimAge = a; });
      if (!inp) continue;
      const s = largestWhere((x) => meets({ ...copyInputs(inp), strategy: "fixed-real", spending: { yearly: x } }), 0, Math.max(12000, I.spending.yearly * 2), 5);
      results.push({ age: a, monthly: s === null ? 0 : s / 12 });
      if (s !== null && (!best || s / 12 > best.monthly + 0.5)) best = { age: a, monthly: s / 12 };
    }
    const nowAt = results.find((r) => Math.abs(r.age - claims[0]) < 1 / 24) ?? null;
    const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };
    const names = movable.map((x) => x.name);
    // "You and your spouse claiming at 70", never "Me and My spouse" (review 2026-11-06, round 7)
    const who = NamesIn(names);
    const others = (sp?.people ?? []).filter((x) => x.claimed && x.source !== "none").map((x) => x.name);
    const isNow = (a) => a === nowAge && nowForAll;
    add({ id: "claim", icon: "🇺🇸", title: "When to claim Social Security", value: best?.age ?? null, current: claims.length === 1 ? claims[0] : null, unit: "age", status: !best ? "cannot" : claims.length === 1 && Math.abs(best.age - claims[0]) < 1 / 24 ? "same" : "room", results, who: movable.map((x) => x.id), nowAge, nowForAll,
      sentence: !best ? "No claiming age still open gets there on its own." : `${candidates.length === 1 ? `${who} can only claim ${isNow(best.age) ? "now" : "at"} ${isNow(best.age) ? `(${ageWords(best.age)})` : ageWords(best.age)}: about ${fmt(best.monthly / scale, "down")} a month can be spent if markets do as well as average` : `${who} claiming ${isNow(best.age) && !Number.isInteger(best.age) ? `now (${ageWords(best.age)})` : `at ${ageWords(best.age)}`} lets the plan spend the most if markets do as well as average, about ${fmt(best.monthly / scale, "down")} a month${nowAt && Math.abs(best.age - nowAt.age) > 1 / 24 ? `, ${fmt((best.monthly - nowAt.monthly) / scale, "down")} more than claiming at ${ageWords(nowAt.age)}` : ""}`}.${names.length > 1 ? " Both claim at the same age here; the Social Security page shows each person's amounts." : ""}${others.length ? ` ${NamesIn(others)} already ${others.length === 1 ? verbFor(others[0], "gets", "get") : "get"} it, so that stays as it is.` : ""}`, go: ["retirement", "social-security"] });
  }

  return { ready: true, missing: [], legacy, scale, noSavings: !ok0 && (() => { try { return savingsUnknown(projectionOf(plan, { today })); } catch { return false; } })(), meets: ok0, endReal: base.endBalanceReal, success: base.success, failYear: base.failYear, spendingMonthly, strategy: I.strategy, levers };
}

/** The "room for bad luck" target: spending 15% above the plan (the Plan health score's full marks, FULL_RETIREMENT, is the same 1.15). */
export const BAD_LUCK = 1.15;
const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
/** A rate you must earn, rounded UP to the shown tenth of a percent (the same rounding as the lever's `shownValue`). */
const pctUp = (x) => `${(Math.ceil(x * 1000 - 1e-6) / 10).toFixed(1)}%`;
const ptsN = (x, dir) => (dir === "up" ? Math.ceil(x * 1000 - 1e-6) : dir === "down" ? Math.floor(x * 1000 + 1e-6) : Math.round(x * 1000));
const pts = (x, dir = "near") => `${(ptsN(x, dir) / 10).toFixed(1)} percentage point${ptsN(x, dir) === 10 ? "" : "s"}`;

/** A need rounds up to the shown $10 (under 50 cents it is nothing), a limit rounds down. */
export const roundUp = (n) => (n < 0.5 ? 0 : Math.ceil(n / 10 - 1e-9) * 10);
export const roundDown = (n) => Math.floor(n / 10 + 1e-9) * 10;
/**
 * shownValue(lever) -> the number the page prints for a lever's answer (the lever's `value` itself stays unrounded): what you
 * must reach rounds UP (saving, a lump sum that is short, the return it needs), a limit rounds DOWN (what you can spend, the
 * room today), so doing what the words say always works. `scale` (the result's): what you can spend is shown in the plan's terms,
 * the spending that lasts divided by it, so with "room for bad luck" (1.15) it is the most to plan, each month then 15% more. Ages are whole already; a "just right" return is the nearest tenth.
 */
export function shownValue(l, scale = 1) {
  if (l.value === null || l.value === undefined) return l.value ?? null;
  if (l.unit === "rate") return (l.status === "same" ? Math.round(l.value * 1000) : Math.ceil(l.value * 1000 - 1e-6)) / 1000;
  if (l.unit === "month") return l.id === "saving" ? roundUp(l.value) : roundDown(l.value / scale);   // spending: in the plan's terms (under "room for bad luck" the engine spends `scale` times the plan)
  if (l.unit === "once") return l.status === "needs" ? roundUp(l.value) : roundDown(l.value);
  return l.value;
}
