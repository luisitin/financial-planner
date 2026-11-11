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
import { nameIn, nameOf, NamesIn, verbFor } from "../../../core/words.js";
import { isGuess } from "../../../core/estimate/index.js";
import { payOf, deferralLimit, ageInYear } from "../../overview/guesses/estimators/saving.js";
import { compute as assumptionsOf } from "../../system/assumptions/compute.js";

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
 * The year-by-year scan also checks that every age from the one found up to the planned age lasts, and takes the first age after a
 * gap if one does not (fix round 1, 2026-11-12, M5: "as early as 60" while 62 to 64 ran out). `from` (the same fix): the first age
 * tried (never below this year's). Goal seek passes the planned age
 * while the plan as it stands falls short, so an earlier age that happens to last (the engine's spending figure moves with the
 * year work stops: Casey lasted retiring at 61, ran out at 62 to 65) is never shown as "room to spare".
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
  const from = params.from === null || params.from === undefined || !Number.isFinite(Number(params.from)) ? ageNow : Math.min(upTo, Math.max(ageNow, Math.floor(Number(params.from))));
  let age = null;
  if (params.search === "bisect") {
    const ok = (a) => { const inp = withAge(a); return !!inp && meets(inp); };
    if (ok(upTo)) { let lo = from - 1, hi = upTo; while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid; } age = hi; }
  } else {
    for (let a = from; a <= upTo; a++) { const inp = withAge(a); if (inp && meets(inp)) { age = a; break; } }
    // "as early as" holds for every later age too (fix round 1, 2026-11-12, M5): checked down from the planned age, and on a gap
    // the first age after it that lasts (Casey with $790 a month in the 401(k) lasted retiring at 60 and 61, ran out at 62 to 64:
    // the engine's spending moves with the year work stops, claude-c's to fix; the card said "as early as 60")
    if (age !== null && age < planned) {
      for (let a = planned; a > age; a--) {
        const inp = withAge(a);
        if (inp && meets(inp)) continue;
        age = null;
        for (let b = a + 1; b <= upTo; b++) { const i2 = withAge(b); if (i2 && meets(i2)) { age = b; break; } }
        break;
      }
    }
  }
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
export const RETIRE_HOW = "Retirement: the earliest age at which the person still working could stop, up to 75 (or the planned age, if later). If the first person has already stopped working and the other's pay is on Income, the first person counts as stopped from this year, as on the Financial independence page.";

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
 * The claiming lever while the plan falls short (fix round 1, 2026-11-12; "helps" from 2026-11-11 is gone): "needs" when claiming at
 * the age that spends the most reaches the goal on its own, "cannot" when it does not (`atBest`: that run's outcome).
 * The return lever carries `info: true`, `line` (Goal seek's grey line) and `more` (its detail, for the fold "How it is worked
 * out"): it is information, never a change to make. The saving
 * lever carries `idle` (account ids) when nothing goes in and a 401(k) at a job the person still has holds money, and then
 * `into` and `rest` (idleSaving's parts: what to type into each 401(k), and into other savings).
 * Every money figure is in today's dollars. `legacy` is what the plan should still hold at its end.
 * Round 8 (2026-11-06), for the Plan health score's hint, both left out by the page itself (which then works as before):
 * `spendingScale` (default 1) solves every lever for the plan spending that many times its amount in retirement (1.15:
 * "room for bad luck"); `spendingMonthly` and each lever's `current` are then the scaled amount. `only` (lever ids) works
 * just those levers, so a caller that needs three does not pay for the Social Security ages. `retireSearch: "bisect"`: the
 * retirement age by halving (earliestRetireAge's `search`), for the score's speed. `savingInto` (fix round 1, 2026-11-12): "work"
 * solves the saving lever into an idle 401(k) (idleSaving) when there is one, "taxable" keeps the plain search into savings; the
 * default is "work", or "taxable" when `only` is given (the score's hint names no account).
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
    // while the plan as it stands falls short, from the planned age on (fix round 1, 2026-11-12, M5): an earlier age that happens to
    // last (the engine's spending moves with the year work stops) read "room to spare: as early as 61" under "runs out in 2070"
    const found = earliestRetireAge(withStops(plan, wn.stopNow), { today, legacy, personId: self.id, ...(ok0 ? {} : { from: retireAge }), ...(scale !== 1 ? { spendingScale: scale } : {}), ...(params.retireSearch === "bisect" ? { search: "bisect" } : {}) });
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
    // nothing goes in, but a 401(k) at a job the person still has holds money (owner's request 2026-11-11, L1): name it, and say
    // where to add what goes in from each paycheck, instead of "You save nothing toward this today" (Casey's $48,000 401(k))
    const idle = now < 0.5 ? idleWorkPlans(plan, today) : null;
    // and work the amount out going INTO that 401(k), as the Contributions form writes it (fix round 1, 2026-11-12, M1/P2: it was
    // solved into taxable savings, so $670 typed into Casey's 401(k) still ran out in 2070; $790 there lasts), at most the year's
    // 401(k) limit, the rest into other savings
    // `savingInto` "taxable" keeps the plain search (the default for a caller asking for `only` some levers: the Plan health score's
    // hint, whose words name no account; its own test pins that figure); the page and Legacy goals name the 401(k), so they get it
    const intoWork = (params.savingInto ?? (Array.isArray(params.only) ? "taxable" : "work")) === "work";
    const into = idle && !ok0 && intoWork ? idleSaving(plan, today, { idle, leadId: self?.id ?? null, meets, scale, hi: Math.max(5000, now * 10) }) : null;
    const need = into ? into.need : smallestWhere((e) => meets(withSaving(e)), -now, Math.max(5000, now * 10), 1);
    // within $10 of what goes in now (fix round 1, 2026-11-12: Casey, having typed the card's $790, read "room to spare ... $0 less
    // than the $790 going in now"): "just right", "Exactly what goes in now"
    add({ id: "saving", icon: "🐖", title: "What you need to save", value: need === null ? null : now + need, current: now, unit: "month", status: need === null ? "cannot" : need <= -now + 0.5 && now >= 0.5 ? "room" : roundDown(-need) >= 10 ? "room" : need < 0.5 ? "same" : "needs",
      ...(idle ? { idle: idle.accounts.map((a) => a.id) } : {}), ...(into?.parts ? { into: into.parts, rest: into.rest } : {}),
      sentence: need === null ? `No amount of saving gets there before retirement.${idle ? ` ${idle.words}` : ""}` : need <= -now + 0.5 ? `Nothing more: it gets there even if retirement saving stopped today (now ${fmt(now)} a month).` : roundDown(-need) >= 10 ? `About ${fmt(now + need, "up")} a month would do: ${fmt(-need, "down")} less than the ${fmt(now)} going in now.` : need < 0.5 ? `Exactly what goes in now, ${fmt(now)} a month.` : into?.parts ? idleSavingWords(plan, into, idle, cur) : now < 0.5 ? `Save about ${fmt(now + need, "up")} a month. ${idle ? idle.words : "You save nothing toward this today."}` : `About ${fmt(now + need, "up")} a month, ${fmt(need, "up")} more than the ${fmt(now)} going in now.`, go: ["retirement", "contributions"] });
  }

  // 4. the return it needs: stocks and bonds moved together. Information, never a change to make (owner's request 2026-11-11, L1:
  // "The return it needs: 10.4%" sat among the changes with an Assumptions button, the "fix it by raising the return" trap). The
  // lever stays in `levers` (the Plan health score and Legacy goals read the list) with `info: true`; Goal seek shows `line`, one
  // grey line under the cards, with the sourced 10-year forecasts (RETURN_FORECAST) and no button
  if (want("returns")) {
    const shifted = (d) => { const c = copyInputs(I); c.returns.stocks += d; c.returns.bonds += d; return c; };
    const d = smallestWhere((x) => meets(shifted(x)), RETURN_FLOOR, 0.2, 0.0001);
    const mix = (I.rates.stocksNow + I.rates.stocksRetired) / 2;
    const blend = (x) => mix * (I.returns.stocks + x) + (1 - mix) * (I.returns.bonds + x);
    const status = d === null ? "cannot" : d < -0.0005 ? "room" : ok0 && d < 0.0005 ? "same" : "needs";
    // whose growth figures they are (fix round 1, 2026-11-12, P4): "you chose" only when typed or reviewed on Assumptions (its
    // own 365-day rule), else "our usual figures"
    let yours = false;
    try { const a = assumptionsOf(plan, { today }); yours = !a.stale || a.rows.some((r) => (r.key === "returnStocks" || r.key === "returnBonds") && r.changed); } catch { yours = false; }
    const w = returnWords({ status, need: d === null ? null : blend(d), now: blend(0), room: d === null ? 0 : -d, mix, stocks: I.returns.stocks, bonds: I.returns.bonds, yours, floor: d !== null && d <= RETURN_FLOOR + 0.0005 });
    add({ id: "returns", icon: "📈", title: "The return it needs", value: d === null ? null : blend(d), current: blend(0), unit: "rate", status, info: true, sentence: w.sentence, line: w.line, ...(w.more ? { more: w.more } : {}), go: ["system", "assumptions"] });
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
    const inputsAt = new Map();
    for (const a of candidates) {
      const inp = withPlan((p) => { for (const x of movable) p.retirement.socialSecurity[x.id].claimAge = a; });
      if (!inp) continue;
      inputsAt.set(a, inp);
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
    const atWords = (a) => (isNow(a) && !Number.isInteger(a) ? `now (${ageWords(a)})` : `at ${ageWords(a)}`);
    const same = !!best && claims.length === 1 && Math.abs(best.age - claims[0]) < 1 / 24;
    // another age spends more: "room" while the plan reaches the goal (owner's request 2026-11-11, L1: a green "room to spare" sat on
    // the Social Security card of plans that run out at 70 and 67). While it falls short, the plan is run at that age with its own
    // spending (fix round 1, 2026-11-12, P1: a grey "helps" sat on a change that made Jamie's money run out two years sooner, on
    // Robin's one change that works on its own, and on Morgan's that changes nothing): "needs a change" when that age alone reaches
    // the goal, "not on its own" when it does not, said in the headline's terms (when the money runs out)
    let atBest = null;
    if (best && !same && !ok0 && inputsAt.has(best.age)) {
      const c = copyInputs(inputsAt.get(best.age));
      if (scale !== 1) c.spending = { ...c.spending, yearly: c.spending.yearly * scale };
      const r = project(c);
      atBest = { meets: r.success && r.endBalanceReal >= legacy - 0.5, success: r.success, failYear: r.failYear, failAge: r.failAge, endReal: r.endBalanceReal };
    }
    const status = !best ? "cannot" : same ? "same" : ok0 ? "room" : atBest?.meets ? "needs" : "cannot";
    const more = best && nowAt && Math.abs(best.age - nowAt.age) > 1 / 24 ? (best.monthly - nowAt.monthly) / scale : null;
    const tail = `${names.length > 1 ? " Both claim at the same age here; the Social Security page shows each person's amounts." : ""}${others.length ? ` ${NamesIn(others)} already ${others.length === 1 ? verbFor(others[0], "gets", "get") : "get"} it, so that stays as it is.` : ""}`;
    const sentence = !best ? "No claiming age still open gets there on its own."
      : atBest?.meets ? `${who} claiming ${atWords(best.age)} alone makes the money last${legacy ? ` and leave ${fmt(legacy)}` : ""}: about ${fmt(best.monthly / scale, "down")} a month can be spent if markets do as well as average${more !== null && more >= 5 ? `, ${fmt(more, "down")} more than claiming at ${ageWords(nowAt.age)}` : ""}.`
      : atBest ? `${who} claiming ${atWords(best.age)} lets the plan pay ${more !== null && more >= 5 ? `about ${fmt(more, "down")} a month more` : `the most, about ${fmt(best.monthly / scale, "down")} a month`}, steady, if markets do as well as average. ${claimOutcome(base, atBest, { spendingMonthly, scale, legacy, fmt })}`
      : `${candidates.length === 1 ? `${who} can only claim ${isNow(best.age) ? "now" : "at"} ${isNow(best.age) ? `(${ageWords(best.age)})` : ageWords(best.age)}: about ${fmt(best.monthly / scale, "down")} a month can be spent if markets do as well as average` : `${who} claiming ${atWords(best.age)} lets the plan spend the most if markets do as well as average, about ${fmt(best.monthly / scale, "down")} a month${more !== null ? `, ${fmt(more, "down")} more than claiming at ${ageWords(nowAt.age)}` : ""}`}.`;
    add({ id: "claim", icon: "🇺🇸", title: "When to claim Social Security", value: best?.age ?? null, current: claims.length === 1 ? claims[0] : null, unit: "age", status, results, who: movable.map((x) => x.id), nowAge, nowForAll, ...(atBest ? { atBest } : {}),
      sentence: `${sentence}${tail}`, go: ["retirement", "social-security"] });
  }

  const noSavings = !ok0 && (() => { try { return savingsUnknown(projectionOf(plan, { today })); } catch { return false; } })();
  return { ready: true, missing: [], legacy, scale, noSavings, ...(noSavings ? { nothingSaved: nothingSaved(plan) } : {}), meets: ok0, endReal: base.endBalanceReal, success: base.success, failYear: base.failYear, spendingMonthly, strategy: I.strategy, levers };
}

/** How a change card ranks for the first view: one that gets there on its own first, then room, "just right", "not on its own". */
const LEVER_RANK = { needs: 0, room: 1, same: 2, cannot: 3 };
/** How many change cards Goal seek shows before any tap (owner, 2026-11-12 and 2026-11-13: "simple by default"). */
export const FIRST_CARDS = 3;

/**
 * firstLevers(levers, n = FIRST_CARDS) -> { shown, more }: the change cards shown before any tap and the rest, for the fold "N more
 * changes" (owner, 2026-11-12 and 2026-11-13: simple by default, more one quiet tap away; fix round 2). Never the return it needs
 * (`info`: a grey line, not a change). Never folded, because each is worth money to the person: the Social Security card while
 * claiming at its age gets there on its own or adds room ("needs", "room"), and the saving card that names a 401(k) at the person's
 * job with nothing going in ("Less would do if Casey's job adds some": a match they may be missing), whether saving gets there
 * ("needs") or not on its own ("cannot": "Priya's 401(k) holds $92,000, but nothing goes into it now. If some of each paycheck
 * does go in, add it on Retirement contributions."; final fix, 2026-11-13: it was folded behind a "not on its own" card with
 * nothing to act on). Then the changes that get there on their own ("needs"), those with room, "just right", and "not on its own"
 * ("cannot") last, in the page's order within each. Both lists keep the page's own order (spending, retiring, saving, today,
 * Social Security).
 */
export function firstLevers(levers, n = FIRST_CARDS) {
  const cards = (levers ?? []).filter((l) => l && !l.info);
  const pinned = (l) => (l.id === "claim" && (l.status === "needs" || l.status === "room")) || (l.id === "saving" && Array.isArray(l.idle) && l.idle.length > 0 && (l.status === "needs" || l.status === "cannot"));
  const ranked = cards.map((l, i) => ({ l, i, k: pinned(l) ? -1 : LEVER_RANK[l.status] ?? 4 })).sort((a, b) => a.k - b.k || a.i - b.i);
  const keep = new Set(ranked.slice(0, Math.max(n, ranked.filter((x) => x.k === -1).length)).map((x) => x.l));
  return { shown: cards.filter((l) => keep.has(l)), more: cards.filter((l) => !keep.has(l)) };
}

/**
 * nothingSaved(plan) -> true when the person told us there is nothing saved and nothing going in, rather than told us nothing: a
 * 401(k), IRA or Roth on file (even at $0), or Get started's saving answer "None" (fix round 1, 2026-11-12, B4: with an empty 401(k)
 * on Net worth and "$0 every month" on Retirement contributions, the gated pages said "You haven't told us about retirement
 * savings"). The gate itself is the projection's savingsUnknown; this only picks its words.
 */
export function nothingSaved(plan) {
  return (plan?.accounts ?? []).some((a) => a && ["401k", "ira", "roth"].includes(a.type))
    || Object.values(plan?.guide?.setup?.saving ?? {}).some((x) => x && x.pct === 0);
}

/**
 * Professional forecasts over the next 10 years, a year before inflation (the app's returns are the same kind): Vanguard's capital
 * markets model, "as of 2026-09-30" (page of 2026-10-21, read 2026-11-11 and 2026-11-12; scratchpad rv/verify-web.md): U.S.
 * equities 4.8%-6.8%, U.S. aggregate bonds 5.1%-6.1%. The grey line under Goal seek's cards sets the plan's need against them on
 * the plan's own mix of stocks and bonds (forecastFor; fix round 1, 2026-11-12, M4: a need on the mix was set against the stocks
 * range alone). Nothing is worked out from it.
 */
export const RETURN_FORECAST = { low: 0.048, high: 0.068, bonds: { low: 0.051, high: 0.061 }, who: "Vanguard", asOf: "2026-09-30", asOfWords: "September 30, 2026" };
/** The forecast range on a mix with `mix` in stocks (the rest bonds): each end the same blend of the two ranges' ends. */
export const forecastFor = (mix) => {
  const m = Math.min(1, Math.max(0, Number.isFinite(mix) ? mix : 0.6));
  return { low: m * RETURN_FORECAST.low + (1 - m) * RETURN_FORECAST.bonds.low, high: m * RETURN_FORECAST.high + (1 - m) * RETURN_FORECAST.bonds.high };
};
/** How far below the plan's own returns the return search starts (both moved together): a need there is the edge of the search. */
export const RETURN_FLOOR = -0.15;

/**
 * returnWords({ status, need, now, room, mix, stocks, bonds, yours, floor }) -> { sentence, line, more }: what the return lever says
 * (owner's request 2026-11-11, L1; fix round 1, 2026-11-12, B2/M4/P4). `need` is the return on the plan's mix of stocks and bonds
 * that just reaches the goal (null: none up to 20 points more does), `now` the same blend at the plan's returns, `mix` the share in
 * stocks it is blended on, `stocks` and `bonds` the plan's own returns, `yours` whether the person typed or reviewed them
 * (Assumptions), `floor` the search found no edge (the plan lasts even at its lowest try). `sentence` stands alone; `line` is
 * Goal seek's grey line under its cards, which ends "the cards above are" where it compares a figure the plan would need.
 * Simple first (owner, 2026-11-12: "default to less is more"): the line is the need, what the plan uses, whose that figure is in
 * three words ("we use" / "your own figures give") and the forecasts' range; `more` is the detail for the fold "How it is worked
 * out" (what the plan's figure is made of and whose the parts are), null when no figure is shown.
 * - like with like: the need on the plan's mix against the forecasts on the same mix (forecastFor), never stocks alone;
 * - "Most forecasts ... are lower" only when the need shown is above the top of that range as shown;
 * - whose figures: "your own figures" only when typed or reviewed, else "we use" (the fold: "our usual figures unless you change them");
 * - no figure when the plan does not need growth: "even with no growth at all", or, at the search's edge with losses on both,
 *   "even if they lost money every year" (the retired couple's "-9.2% ... 15.0 percentage points of room" was the search's edge).
 * Never a button, never "raise".
 */
export function returnWords({ status, need = null, now, room = 0, mix = 0.6, stocks = 0.07, bonds = 0.04, yours = false, floor = false }) {
  const uses = yours ? `the ${pct(now)} a year your own figures give` : `the ${pct(now)} a year we use`;
  const fc = forecastFor(mix);
  const range = `about ${pct(fc.low)}-${pct(fc.high)} a year (${RETURN_FORECAST.who})`;
  const share = Math.round(Math.min(1, Math.max(0, Number.isFinite(mix) ? mix : 0.6)) * 100);
  const more = `The ${pct(now)} is ${pctShort(stocks)} for stocks and ${pctShort(bonds)} for bonds on the plan's mix, about ${share}% in stocks: ${yours ? "the figures you chose" : "our usual figures unless you change them"}.`;
  if (status === "cannot") {
    const s = `Even if investments grew far faster than ${uses}, it would not get there. That isn't a choice you can make`;
    return { sentence: `${s}.`, line: `${s}; the cards above are.`, more };
  }
  if (status === "room" && need !== null && need <= 0) {
    const s = floor && now + RETURN_FLOOR < 0 && stocks + RETURN_FLOOR < 0 && bonds + RETURN_FLOOR < 0
      ? "Your plan does not depend on how investments grow: it gets there even if they lost money every year."
      : "Your plan does not depend on how investments grow: it gets there even with no growth at all.";
    return { sentence: s, line: s, more: null };
  }
  if (status === "room" && floor) {
    const s = `It gets there even if investments grew ${Math.round(-RETURN_FLOOR * 100)} points a year less than ${uses}.`;
    return { sentence: s, line: s, more };
  }
  if (status === "room") {
    const s = `Investments growing about ${pctUp(need)} a year would still do, against ${uses}. Forecasts for a mix like the plan's: ${range}.`;
    return { sentence: s, line: s, more };
  }
  if (status === "same") {
    const s = `It gets there only if investments grow ${uses}: no room for bad luck. Forecasts for a mix like the plan's: ${range}.`;
    return { sentence: s, line: s, more };
  }
  const shown = Math.ceil(need * 1000 - 1e-6) / 1000;   // the figure printed (pctUp)
  const top = Math.round(fc.high * 1000) / 1000;        // the top of the range as printed (pct)
  const forecasts = shown > top + 1e-9 ? `Most forecasts for a mix like the plan's are lower: ${range}.` : `Forecasts for a mix like the plan's: ${range}.`;
  const s = `For the plan to work as it is, investments would have to grow about ${pctUp(need)} a year, against ${uses}. ${forecasts} That isn't a choice you can make`;
  return { sentence: `${s}.`, line: `${s}; the cards above are.`, more };
}

/** The old-job names Retirement contributions goes by (contributions/view.js, its `cur401`): such a 401(k) is not the job's now. */
const OLD_JOB = /\b(old|former|previous|prior|rollover)\b/i;

/**
 * idleWorkPlans(plan, today) -> { accounts, owners, said, words, holds } | null: the 401(k)s holding money at a job the owner still
 * has (pay on Income today) while no contribution row puts anything into them, for the saving card (owner's request 2026-11-11, L1:
 * Casey's 401(k) holds $48,000 and the card said "You save nothing toward this today"). A 401(k) from a job the owner has left is
 * not listed: marked `formerJob`, or named old, former, previous, prior or rollover (Retirement contributions' own rule; fix round 1,
 * 2026-11-12: "Derek's old 401(k)" was named). `owners` the owner of each; `said`: every one has a row typed as 0 (Get started's
 * "None"). `words` names them; `holds` says the same with "It" (one account) for a sentence that has just named it. Both end
 * "(you said so)." when said, else with "If some of each paycheck does go in, add it on Retirement contributions."
 */
export function idleWorkPlans(plan, today) {
  const adults = (plan?.household?.people ?? []).filter((p) => p && p.role !== "dependent");
  const rows = plan?.retirement?.contributions ?? [];
  const ownerOf = (a) => adults.find((p) => p.id === a.ownerId)?.id ?? (!a.ownerId && adults.length === 1 ? adults[0].id : null);
  const into = (a) => rows.filter((c) => c && c.accountId === a.id);
  const accounts = (plan?.accounts ?? []).filter((a) => a && a.type === "401k" && Number(a.balance) > 0 && !a.formerJob && !OLD_JOB.test(String(a.name ?? "")) && ownerOf(a) && payOf(plan, ownerOf(a), today) > 0
    && !into(a).some((c) => Number(c.amount) > 0 || Number(c.employerMatch) > 0));
  if (!accounts.length) return null;
  const typedZero = (a) => into(a).some((c) => Number(c.amount) === 0 && !isGuess(plan, `retirement.contributions[${c.id}].amount`)) || plan?.guide?.setup?.saving?.[ownerOf(a)]?.pct === 0;
  const said = accounts.every(typedZero);
  const cur = plan?.meta?.currency ?? "USD";
  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);
  // under $100 to the dollar (a $4 balance read "holds $0"), else to $10
  const held = fmtMoney(total < 100 ? Math.round(total) : Math.round(total / 10) * 10, cur);
  const names = accounts.map((a) => a.name || "Your 401(k)");
  const one = accounts.length === 1;
  // simple first (owner, 2026-11-12): the reminder to add what goes in only when the person has not said that nothing does
  const rest = `nothing goes into ${one ? "it" : "them"} now${said ? " (you said so)." : ". If some of each paycheck does go in, add it on Retirement contributions."}`;
  const words = `${one ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`} ${one ? "holds" : "hold"} ${held}${one ? "" : " between them"}, but ${rest}`;
  const holds = one ? `It holds ${held}, but ${rest}` : words;
  return { accounts, owners: accounts.map(ownerOf), said, words, holds };
}

/** "Casey's plan at work" as it is, "My 401(k)" as "your 401(k)", any other name with "the" ("the Hospital 403(b)"). */
const accountIn = (name) => {
  const t = String(name ?? "").trim() || "401(k)";
  if (/^(my|your)\b/i.test(t)) return t.replace(/^(my|your)\b/i, "your");
  return /['’]s\b/i.test(t) ? t : `the ${t}`;
};

/**
 * idleSaving(plan, today, { idle, leadId, meets, scale, hi }) -> { need, parts: [{ accountId, personId, name, monthly, capped }],
 *   rest, year } | { need: null } | null: Goal seek's saving answer when nothing goes in and a 401(k) at work sits idle (fix round 1,
 * 2026-11-12, M1/P2), worked out going into that 401(k) as the Contributions form writes it, a monthly row into the account with no
 * match, run through the projection's own buildInputs (the deferred bucket, its owner, stopping with the owner's last pay):
 * - one 401(k) per owner (a person's limit covers all of theirs), the lead adult's first; each at most that owner's 401(k) limit for
 *   the year (deferralLimit: IRS Notice 2025-67, $24,500 in 2026, more from 50 and at 60 to 63), shown rounded down to $10 when it
 *   binds ("the most allowed"); then the rest in a row with no account (other savings, counted as taxable);
 * - every amount shown is what is typed: a need rounds up to $10, a limit down;
 * - the search runs on one build of the plan with the rows put in at $1 a month and each one's yearly then set directly; the answer
 *   is then checked by building the plan with the amounts shown (the spending figure can move with pre-tax saving when it is our
 *   estimate), and raised by $10 at a time until it gets there.
 * null when the plan cannot be built with the rows (then the card keeps the plain search).
 */
export function idleSaving(plan, today, { idle, leadId = null, meets, scale = 1, hi = 5000 } = {}) {
  const year = Number(String(today).slice(0, 4));
  const adults = (plan?.household?.people ?? []).filter((p) => p && p.role !== "dependent");
  const order = idle.accounts.map((a, k) => ({ a, owner: idle.owners?.[k] ?? a.ownerId })).sort((x, y) => (y.owner === leadId) - (x.owner === leadId));
  const seen = new Set(), accts = [];
  for (const x of order) if (x.owner && !seen.has(x.owner)) { seen.add(x.owner); accts.push(x); }
  if (!accts.length) return null;
  const caps = accts.map(({ owner }) => {
    const p = adults.find((q) => q.id === owner);
    const lim = deferralLimit(ageInYear(plan, owner, year) ?? (p?.birthDate ? ageOn(p.birthDate, today) : null), year);
    return lim > 0 ? lim / 12 : Infinity;
  });
  const K = accts.length + 1;
  const rowsFor = (am) => [...accts.map(({ a, owner }, k) => ({ id: `goal-seek-${k}`, accountId: a.id, personId: owner, amount: am[k], period: "monthly", employerMatch: 0 })),
    { id: "goal-seek-rest", accountId: "", personId: accts[0].owner, amount: am[K - 1], period: "monthly", employerMatch: 0 }];
  const scaled = (inp) => (scale !== 1 ? { ...copyInputs(inp), spending: { ...inp.spending, yearly: inp.spending.yearly * scale } } : inp);
  const build = (am) => {
    const p2 = JSON.parse(JSON.stringify(plan));
    p2.retirement = p2.retirement ?? {};
    p2.retirement.contributions = [...(p2.retirement.contributions ?? []), ...rowsFor(am)];
    const inp = buildInputs(p2, { today }).inputs;
    return inp ? scaled(inp) : null;
  };
  const J = build(Array(K).fill(1));
  if (!J) return null;
  const at = J.contributions.length - K;
  // the rows put in at $1 a month are the last K (rows of $0 are left out, the order is kept): checked before they are used
  const exact = at >= 0 && J.contributions.slice(at).every((c) => Math.abs(c.yearly - 12) < 1e-9);
  const fast = (am) => { if (!exact) return build(am); const c = copyInputs(J); am.forEach((m, k) => { c.contributions[at + k].yearly = m * 12; }); return c; };
  const ok = (am) => { const inp = fast(am); return !!inp && meets(inp); };
  const am = Array(K).fill(0), capped = Array(K).fill(false);
  let done = false;
  for (let k = 0; k < accts.length && !done; k++) {
    const room = Math.min(caps[k], Math.max(0, hi - am.reduce((s, v) => s + v, 0)));
    const x = smallestWhere((v) => { const t = [...am]; t[k] = v; return ok(t); }, 0, room, 1);
    if (x !== null && roundUp(x) <= caps[k] + 1e-9) { am[k] = roundUp(x); done = true; break; }
    am[k] = Number.isFinite(caps[k]) ? roundDown(caps[k]) : 0; capped[k] = am[k] > 0;   // the most allowed this year, then on
  }
  if (!done) {
    const r = smallestWhere((v) => { const t = [...am]; t[K - 1] = v; return ok(t); }, 0, Math.max(0, hi - am.reduce((s, v) => s + v, 0)), 1);
    if (r === null) return { need: null };
    am[K - 1] = roundUp(r);
  }
  // checked on the plan as it would be typed; short: $10 more at a time into the last part that takes money (past a 401(k)'s
  // limit, into other savings)
  const enough = (t) => { const inp = build(t); return !!inp && meets(inp); };
  for (let step = 0; !enough(am); step++) {
    if (step >= 200 || am.reduce((s, v) => s + v, 0) > hi) return { need: null };
    let k = K - 1;
    while (k > 0 && !(am[k] > 0)) k--;
    if (!(am[k] > 0)) k = K - 1;
    if (k < accts.length && am[k] + 10 > (Number.isFinite(caps[k]) ? roundDown(caps[k]) : Infinity) + 1e-9) { capped[k] = true; k = K - 1; }
    am[k] += 10;
  }
  // and the other way: $10 less at a time while the plan as typed still gets there (the one build can sit a step or two high)
  { let k = K - 1; while (k > 0 && !(am[k] > 0)) k--;
    for (let step = 0; step < 30 && am[k] >= 10; step++) { const t = [...am]; t[k] -= 10; if (!enough(t)) break; am[k] = t[k]; if (k < accts.length) capped[k] = false; } }
  const parts = accts.map(({ a, owner }, k) => ({ accountId: a.id, personId: owner, name: a.name || "Your 401(k)", monthly: am[k], capped: capped[k] }));
  return { need: am.reduce((s, v) => s + v, 0), parts, rest: am[K - 1], year };
}

/**
 * The saving card's words for idleSaving's answer: "Put about $790 a month into Casey's plan at work. Less would do if Casey's job
 * adds some. It holds $48,000, but nothing goes into it now (you said so)." With the limit: "... into the Hospital 403(b), the most
 * allowed in 2026, and $990 more into other savings, such as a brokerage account" (the row with no account is invested, so the
 * words name where). The match sentence is left out when every owner said there is none. Short on
 * purpose (owner, 2026-11-12, simple first): what to put where, the one caveat, and what we know about the account.
 */
export function idleSavingWords(plan, into, idle, cur = "USD") {
  const m = (n) => fmtMoney(n, cur);
  const used = into.parts.filter((p) => p.monthly > 0);
  const items = used.map((p, i) => ({ text: `${i ? "" : "about "}${m(p.monthly)}${i ? "" : " a month"} into ${accountIn(p.name)}${p.capped ? `, the most allowed in ${into.year}` : ""}`, comma: p.capped }));
  if (into.rest > 0) items.push({ text: `${used.length ? "" : "about "}${m(into.rest)}${used.length ? " more" : " a month"} into other savings, such as a brokerage account`, comma: true });
  // "A, B and C"; an item that ends in its own clause ("..., the most allowed in 2026") keeps a comma before "and"
  const list = items.length === 1 ? items[0].text : `${items.slice(0, -1).map((x) => x.text).join(", ")}${items[items.length - 2].comma ? "," : ""} and ${items[items.length - 1].text}`;
  const people = plan?.household?.people ?? [];
  const owners = [...new Set(used.map((p) => p.personId))];
  const asked = owners.filter((id) => plan?.retirement?.workPlans?.[id]?.match !== false);
  const whose = (id) => nameOf(people.find((p) => p.id === id)?.name);
  const match = !asked.length ? "" : owners.length === 1 ? ` Less would do if ${whose(owners[0])} job adds some.` : " Less would do if the jobs add some.";
  return `Put ${list}.${match} ${used.length === 1 && idle.accounts.length === 1 ? idle.holds : idle.words}`;
}

/** What claiming at the best age does to the headline (P1): when the money runs out, or what it leaves, against the plan as it stands. */
function claimOutcome(base, alt, { spendingMonthly, scale = 1, legacy = 0, fmt }) {
  const spend = scale !== 1 ? `At ${Math.round((scale - 1) * 100)}% more than the ${fmt(spendingMonthly / scale)} a month the plan spends` : `At the ${fmt(spendingMonthly)} a month the plan spends`;
  const when = (r) => `${r.failYear}${r.failAge !== null && r.failAge !== undefined ? ` (age ${r.failAge})` : ""}`;
  const left = (n) => fmt(Math.round(Math.max(0, n) / 1000) * 1000);
  if (!base.success && !alt.success) {
    if (alt.failYear < base.failYear) return `${spend}, though, the money would run out in ${when(alt)} instead of ${when(base)}: waiting means drawing more from savings until it starts.`;
    if (alt.failYear === base.failYear) return `${spend}, the money would still run out in ${when(base)}.`;
    return `${spend}, the money would run out in ${when(alt)} instead of ${when(base)}: later, but still before the plan ends.`;
  }
  if (!base.success) return `${spend}, the money would last but leave about ${left(alt.endReal)}, short of the ${fmt(legacy)} you want to leave.`;
  if (!alt.success) return `${spend}, though, the money would run out in ${when(alt)}, where as it stands it lasts.`;
  return `${spend}, it would leave about ${left(alt.endReal)} instead of ${left(base.endBalanceReal)}, short of the ${fmt(legacy)} you want to leave.`;
}

/** The "room for bad luck" target: spending 15% above the plan (the Plan health score's full marks, FULL_RETIREMENT, is the same 1.15). */
export const BAD_LUCK = 1.15;
const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
/** 0.07 -> "7%", 0.065 -> "6.5%": a return as typed on Assumptions. */
const pctShort = (x) => { const v = Math.round(x * 1000) / 10; return `${Number.isInteger(v) ? v : v.toFixed(1)}%`; };
/** A rate you must earn, rounded UP to the shown tenth of a percent (the same rounding as the lever's `shownValue`). */
const pctUp = (x) => `${(Math.ceil(x * 1000 - 1e-6) / 10).toFixed(1)}%`;

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
