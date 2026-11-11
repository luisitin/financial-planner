// modules/scenarios/sensitivity/compute.js -- PURE and heavy. Which of the plan's numbers matter most:
// each input nudged down and up by a realistic amount, everything else held, and the result measured
// as the steady spending the plan can carry (and what is left at the end). Sorted by how far each one
// swings the answer: the tornado.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs, compute as projectionOf, savingsUnknown } from "../../retirement/projection/compute.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { usualShare, jobPayOf, payOf, matchTerms, typedTiers, compLimit, deferralLimit, ageInYear } from "../../overview/guesses/estimators/saving.js";
import { limitsFor, catchUpFor, limitKind } from "../../retirement/contributions/compute.js";
import { nothingSaved } from "../goal-seek/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";
import { isYou, nameIn, NameIn, nameOf, namesIn, verbFor } from "../../../core/words.js";

/** The share of scheduled Social Security payable once the retirement trust fund runs dry (2025 Trustees Report: 2033, 77%). */
export const SS_PAYABLE_IF_DEPLETED = 0.77;
/** How far each input is nudged either way. */
export const NUDGE = { returns: 0.01, inflation: 0.01, retireYears: 2, endYears: 5, saving: 0.25, mix: 0.2, tax: 0.05, raises: 0.01 };

const pct1 = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;

/**
 * The three measures a row can be read on (fix round 2, 2026-11-13, N1): "spend" (the steady spending a month the plan can pay for),
 * "end" (what is left at the end, today's dollars) and "runout" (how long the money lasts: the age it runs out, from the same
 * project() run; a side that lasts to the end reads "lasts"). A row moves a measure when either end differs from the plan as it is
 * by at least MOVES (under $5 a month, under $500 at the end or the same run-out age is "no change"): 634 of 1,364 qa plans pay $0
 * at every setting, so the page listed "6.0%: $0 / 8.0%: $0" as one of the numbers that matter most.
 */
export const MOVES = { spend: 5, end: 500, runout: 1 };
export const MEASURES = ["spend", "end", "runout"];
/** One side's figure on a measure; `cap` is what "lasts" counts as on "runout" (one more than the latest last age of any run). */
export const valueOn = (side, m, cap = 0) => (m === "spend" ? side.affordableMonthly : m === "end" ? side.endReal : side.success ? cap : side.runsOutAge ?? 0);
/** How far a row moves the answer on a measure: the larger change, either end, from the plan as it is. */
export const moveOn = (row, base, m, cap = 0) => Math.max(Math.abs(valueOn(row.low, m, cap) - valueOn(base, m, cap)), Math.abs(valueOn(row.high, m, cap) - valueOn(base, m, cap)));
/** How far apart a row's two ends are on a measure (the bars' order). */
export const swingOn = (row, m, cap = 0) => Math.abs(valueOn(row.high, m, cap) - valueOn(row.low, m, cap));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * compute(plan, { today }) -> {
 *   ready, missing, base: { affordableMonthly, spendingMonthly, endReal, success },
 *   rows: [{ id, label, help, baseLabel, low: { label, affordableMonthly, endReal, success }, high: {...}, swing (monthly), worse: "low"|"high" }]
 *     sorted by swing, largest first,
 *   biggest: row | null,
 *   headline: the sentence under the page's headline (heroLine), or null,
 *   ssMethod: the method note's Social Security sentence for the rows built (ssMethodNote), or null,
 *   noSavings: true when no retirement savings are on file and nothing goes in (the projection's savingsUnknown): then no rows,
 *     `nothingSaved` (the person told us so: goal-seek's nothingSaved) and `usualLine` ({ text, affordableMonthly } | null)
 * }
 * The saving row when nothing goes in also carries `usual` (each person's share, own money and match a month, `capped`, `kind`),
 * `ownOnlyMonthly` (the plan's figure with the person's own money alone, when a match is in the high end) and `more` (the detail
 * behind the row's "More about this": usualHelp).
 * "low" and "high" are the input's own low and high settings; `worse` names the one that leaves less to spend.
 * Owner's request 2026-11-11 (L1): gated like Will the money last? and Goal seek ("We don't know yet": no rows of "$0 / $0"), and
 * the saving row is there when nothing goes in, its high end what people with pay like theirs usually put in (usualSaving).
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ready: false, missing: b.missing };
  const I = b.inputs;
  const cur = plan.meta?.currency ?? "USD";
  // runsOutAge, failYear and lastAge (fix round 2, N1): the "How long it lasts" measure, from the same run
  const measure = (inputs) => { const r = project(inputs); return { affordableMonthly: affordableSpending(inputs) / 12, endReal: r.endBalanceReal, success: r.success, runsOutAge: r.success ? null : r.failAge, failYear: r.success ? null : r.failYear, lastAge: r.rows?.[r.rows.length - 1]?.ages?.[0] ?? null }; };
  const fromInputs = (mutate) => { const c = copyInputs(I); mutate(c); return c; };
  const fromPlan = (mutate) => { const p2 = JSON.parse(JSON.stringify(plan)); mutate(p2); return buildInputs(p2, { today }).inputs; };
  // the usual rows typed on a copy of the plan, as the Contributions form would write them (`match: false`: own money only)
  const withUsual = (usual, match = true) => fromPlan((p) => { p.retirement = p.retirement ?? {}; p.retirement.contributions = [...(p.retirement.contributions ?? []), ...usual.flatMap((u) => u.rows.map((r) => (match ? r : { ...r, employerMatch: 0 })))]; });
  // nothing saved for retirement and nothing going in: the page says "we don't know yet", as the other two do (one rule, the
  // projection's savingsUnknown; the projection is run only when the cheap part of that rule already holds)
  const invested = (I.balances.taxable ?? 0) + (I.balances.deferred ?? 0) + (I.balances.free ?? 0);
  if (!(invested > 0) && !I.contributions.length) {
    let unknown = false;
    try { unknown = savingsUnknown(projectionOf(plan, { today })); } catch { unknown = false; }
    if (unknown) {
      // told, not untold (fix round 1, 2026-11-12, B4): an empty 401(k) on file or Get started's "None" reads "Nothing is saved for
      // retirement yet, and nothing goes in", with one grey line of what the usual saving would let the plan pay
      const said = nothingSaved(plan);
      let usualLine = null;
      if (said) {
        const usual = usualSaving(plan, today);
        const inp = usual.length ? withUsual(usual) : null;
        if (inp) {
          const a = affordableSpending(inp) / 12, spend = I.spending.yearly / 12, m = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
          usualLine = { affordableMonthly: a, text: `If ${putInWords(usual, cur)}, the plan could pay about ${m(a)} a month${a >= spend - 5 ? `, more than the ${fmtMoney(Math.round(spend), cur)} it plans` : ` of the ${fmtMoney(Math.round(spend), cur)} it plans`}.` };
        }
      }
      return { ready: true, missing: [], noSavings: true, nothingSaved: said, usualLine, base: { affordableMonthly: null, spendingMonthly: I.spending.yearly / 12, endReal: null, success: null }, rows: [], biggest: null, headline: null, ssMethod: null };
    }
  }
  const base = { ...measure(I), spendingMonthly: I.spending.yearly / 12 };
  const rows = [];
  const add = (id, label, help, baseLabel, low, high) => {
    if (!low.inputs || !high.inputs) return;
    const lo = { label: low.label, ...measure(low.inputs) }, hi = { label: high.label, ...measure(high.inputs) };
    rows.push({ id, label, help, baseLabel, low: lo, high: hi, swing: Math.abs(hi.affordableMonthly - lo.affordableMonthly), worse: lo.affordableMonthly <= hi.affordableMonthly ? "low" : "high" });
  };
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = adults.find((p) => p.role === "self") ?? adults[0];
  const ageNow = ageOn(self.birthDate, today);
  const retireAge = Number(self.retirementAge ?? plan.assumptions?.retirementAge ?? 65);

  add("stocks", "How much stocks earn", "a year, before inflation", pct1(I.returns.stocks),
    { label: pct1(I.returns.stocks - NUDGE.returns), inputs: fromInputs((c) => { c.returns.stocks -= NUDGE.returns; }) },
    { label: pct1(I.returns.stocks + NUDGE.returns), inputs: fromInputs((c) => { c.returns.stocks += NUDGE.returns; }) });
  add("bonds", "How much bonds earn", "a year, before inflation", pct1(I.returns.bonds),
    { label: pct1(I.returns.bonds - NUDGE.returns), inputs: fromInputs((c) => { c.returns.bonds -= NUDGE.returns; }) },
    { label: pct1(I.returns.bonds + NUDGE.returns), inputs: fromInputs((c) => { c.returns.bonds += NUDGE.returns; }) });
  add("inflation", "Inflation", "a year; returns stay as typed, so higher inflation means less growth after it", pct1(I.rates.inflation),
    { label: pct1(I.rates.inflation - NUDGE.inflation), inputs: fromInputs((c) => { c.rates.inflation -= NUDGE.inflation; }) },
    { label: pct1(I.rates.inflation + NUDGE.inflation), inputs: fromInputs((c) => { c.rates.inflation += NUDGE.inflation; }) });
  if (ageNow !== null && ageNow < retireAge) {
    const earlier = Math.max(ageNow + 1, retireAge - NUDGE.retireYears), later = retireAge + NUDGE.retireYears;
    if (earlier < retireAge) add("retire", `When ${nameIn(self.name)} ${verbFor(self.name, "retires", "retire")}`, "the household retires then and saving stops", `age ${retireAge}`,
      { label: `age ${earlier}`, inputs: fromPlan((p) => { p.household.people.find((q) => q.id === self.id).retirementAge = earlier; }) },
      { label: `age ${later}`, inputs: fromPlan((p) => { p.household.people.find((q) => q.id === self.id).retirementAge = later; }) });
  }
  const endAge = Number(self.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95);
  add("end", "How long the plan runs", "every adult's plan-end age", `to ${endAge}`,
    { label: `to ${endAge - NUDGE.endYears}`, inputs: fromPlan((p) => { for (const q of p.household.people) if (q.role !== "dependent") q.lifeExpectancy = Number(q.lifeExpectancy ?? p.assumptions?.planEndAge ?? 95) - NUDGE.endYears; }) },
    { label: `to ${endAge + NUDGE.endYears}`, inputs: fromPlan((p) => { for (const q of p.household.people) if (q.role !== "dependent") q.lifeExpectancy = Number(q.lifeExpectancy ?? p.assumptions?.planEndAge ?? 95) + NUDGE.endYears; }) });
  if (I.contributions.length && I.retireYear > I.startYear) {
    const now = I.contributions.reduce((s, c) => s + c.yearly, 0);
    add("saving", "How much you save", "into retirement accounts, employer money included", `${fmtMoney(now / 12, plan.meta?.currency ?? "USD")} a month`,
      { label: `${Math.round(100 - NUDGE.saving * 100)}%`, inputs: fromInputs((c) => { for (const x of c.contributions) x.yearly *= 1 - NUDGE.saving; }) },
      { label: `${Math.round(100 + NUDGE.saving * 100)}%`, inputs: fromInputs((c) => { for (const x of c.contributions) x.yearly *= 1 + NUDGE.saving; }) });
    add("raises", "Pay raises", "a year; saving grows with pay", pct1(I.rates.salaryGrowth),
      { label: pct1(I.rates.salaryGrowth - NUDGE.raises), inputs: fromInputs((c) => { c.rates.salaryGrowth -= NUDGE.raises; }) },
      { label: pct1(I.rates.salaryGrowth + NUDGE.raises), inputs: fromInputs((c) => { c.rates.salaryGrowth += NUDGE.raises; }) });
  } else if (I.retireYear > I.startYear) {
    // nothing goes in (Casey said "None", Morgan has an IRA and no plan at work): the row was missing exactly when it matters most
    // (owner's request 2026-11-11, L1). Low end: the plan as it is; high end: the usual share of pay (usualSaving)
    const usual = usualSaving(plan, today);
    if (usual.length) {
      // fix round 1, 2026-11-12 (M2, P3, B7): the high end in money ("$400 a month + $240 match"), the line under it in words a
      // person can act on, the match named as the usual one, "still short" when it is; its amount, each share and the own money
      // alone are one tap away (`more`)
      const own = usual.reduce((s, u) => s + u.own, 0) / 12, match = usual.reduce((s, u) => s + u.match, 0) / 12;
      const m10 = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
      add("saving", "How much you save", "", "nothing",
        { label: "nothing", inputs: copyInputs(I) },
        { label: `${m10(own)} a month${match >= 5 ? ` + ${m10(match)} match` : ""}`, inputs: withUsual(usual) });
      const r = rows[rows.length - 1];
      if (r?.id === "saving") {
        const ownOnly = match >= 5 ? measure(withUsual(usual, false)).affordableMonthly : null;
        r.usual = usual.map((u) => ({ personId: u.personId, name: u.name, share: u.share, ownMonthly: u.own / 12, matchMonthly: u.match / 12, capped: u.capped, kind: u.kind }));
        r.ownOnlyMonthly = ownOnly;
        const w = usualHelp(usual, { ownOnly, high: r.high.affordableMonthly, spending: base.spendingMonthly, cur, year: Number(String(today).slice(0, 4)) });
        r.help = w.help; r.more = w.more;
      }
    }
  }
  const ss = plan.retirement?.socialSecurity ?? {};
  // only who has not claimed yet and is under 70 can still move, and not before today (review 2026-11-02: a couple where one
  // has drawn it for ten years saw that claim moved to 62 and 70); as Goal seek's claiming lever does
  let sp = null;
  try { sp = computeSocialSecurity(plan, { today: params.today ?? null }); } catch { sp = null; }
  const movable = (sp?.people ?? []).filter((x) => ss[x.id] && !x.claimed && !(x.ageNow !== null && x.ageNow >= 70 - 1 / 24));
  if (I.incomes.some((x) => x.kind === "social") && movable.length) {
    const claimAll = (age) => fromPlan((p) => { for (const x of movable) p.retirement.socialSecurity[x.id].claimAge = age; });
    const claims = [...new Set(movable.map((x) => Number(ss[x.id].claimAge) || 67))];
    const low = Math.min(70, Math.max(62, ...movable.map((x) => (x.ageNow !== null ? Math.ceil(x.ageNow * 12 - 1e-9) / 12 : 62))));
    // "now" only when it is now for everyone moved: within a month of each one's age today (review 2026-11-02, round 5: a
    // couple of 64 and 60 read "now (64 and 6 months)", which is 19 months away for the younger one)
    const nowForAll = movable.every((x) => x.ageNow !== null && Math.abs(low - x.ageNow) <= 1 / 12 + 1e-9);
    const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };
    // names in a sentence: the unnamed first adult ("Me") reads "you", the partner "your spouse" (review 2026-11-06, round 7)
    const and = namesIn;
    const names = movable.map((x) => x.name);
    // who is left out, and why: already paid, or 70 or over (waiting adds nothing then); not "the others already get it" for
    // someone who never claimed (review 2026-11-02, round 5)
    const out = (sp?.people ?? []).filter((x) => ss[x.id] && !movable.includes(x));
    const paid = out.filter((x) => x.claimed).map((x) => x.name), over = out.filter((x) => !x.claimed).map((x) => x.name);
    const why = [paid.length ? `${and(paid)} already ${paid.length === 1 ? verbFor(paid[0], "gets", "get") : "get"} it` : null, over.length ? `${and(over)} ${over.length === 1 ? verbFor(over[0], "is", "are") : "are"} 70 or over, when waiting adds nothing` : null].filter(Boolean).join("; ");
    add("claim", "When Social Security starts", out.length ? `${and(names)} only: ${why}` : "everyone claims at the same age", claims.length === 1 ? `at ${ageWords(claims[0])}` : "as on the page",
      { label: low > 62 && nowForAll ? `now (${ageWords(low)})` : `at ${ageWords(low)}`, inputs: claimAll(low) }, { label: "at 70", inputs: claimAll(70) });
  }
  // the trust-fund row stands on its own: it applies to benefits already paid as much as to claims still to come (review
  // 2026-11-02, round 5: a retired couple who both get it lost the row, and with it their biggest risk)
  if (I.incomes.some((x) => x.kind === "social")) {
    add("ss-cut", "Social Security paid in full", `if the trust fund runs dry in 2033, about ${Math.round(SS_PAYABLE_IF_DEPLETED * 100)}% of benefits can be paid (2025 Trustees Report)`, "in full",
      { label: `${Math.round(SS_PAYABLE_IF_DEPLETED * 100)}%`, inputs: fromInputs((c) => { for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED; }) },
      { label: "in full", inputs: copyInputs(I) });
  }
  add("mix", "Stocks in retirement", "the share of savings in stocks once retired", `${Math.round(I.rates.stocksRetired * 100)}%`,
    { label: `${Math.round(clamp01(I.rates.stocksRetired - NUDGE.mix) * 100)}%`, inputs: fromInputs((c) => { c.rates.stocksRetired = clamp01(c.rates.stocksRetired - NUDGE.mix); }) },
    { label: `${Math.round(clamp01(I.rates.stocksRetired + NUDGE.mix) * 100)}%`, inputs: fromInputs((c) => { c.rates.stocksRetired = clamp01(c.rates.stocksRetired + NUDGE.mix); }) });
  if ((I.tax?.mode ?? "flat") === "flat") add("tax", "Tax on withdrawals", "the flat rate on money from pre-tax accounts", pct1(I.rates.taxRate),
    { label: pct1(Math.max(0, I.rates.taxRate - NUDGE.tax)), inputs: fromInputs((c) => { c.rates.taxRate = Math.max(0, c.rates.taxRate - NUDGE.tax); }) },
    { label: pct1(I.rates.taxRate + NUDGE.tax), inputs: fromInputs((c) => { c.rates.taxRate += NUDGE.tax; }) });

  rows.sort((a, c) => c.swing - a.swing);
  const claimNames = rows.some((r) => r.id === "claim") ? movable.map((x) => x.name) : [];
  // fix round 2 (2026-11-13, N1): what each row moves, the measures something moves, and the page's measure: what you can spend,
  // or how long the money lasts when no setting changes what the plan can pay (the plan pays $0 at every one); the headline only
  // names a number that moves it
  const runoutCap = Math.max(0, ...[base, ...rows.flatMap((r) => [r.low, r.high])].map((x) => x.lastAge ?? 0)) + 1;
  for (const r of rows) r.moves = Object.fromEntries(MEASURES.map((m) => [m, moveOn(r, base, m, runoutCap) >= MOVES[m]]));
  const measures = MEASURES.filter((m) => rows.some((r) => r.moves[m]));
  const shown = measures.includes("spend") ? "spend" : measures.includes("runout") ? "runout" : measures[0] ?? "spend";
  const top = [...rows].filter((r) => r.moves[shown]).sort((a, c) => swingOn(c, shown, runoutCap) - swingOn(a, shown, runoutCap) || moveOn(c, base, shown, runoutCap) - moveOn(a, base, shown, runoutCap))[0] ?? null;
  const headline = shown === "runout" ? runoutLine(top, base, runoutCap) : shown === "spend" ? heroLine(top, base, cur) : null;
  return { ready: true, missing: [], base, rows, measures, measure: shown, runoutCap, biggest: top, headline, ssMethod: ssMethodNote(claimNames, rows.some((r) => r.id === "ss-cut")) };
}

/**
 * heroLine(top, base, cur) -> the sentence under the page's headline for the row that moves the plan most, or null (fix round 1,
 * 2026-11-12, B1): an end that is the plan as it is, or that moves it by less than $5 a month, is left out (the "nothing goes in"
 * saving row read "nothing instead of nothing raises it by $0 a month" on 592 of 1,368 qa plans). The saving row when nothing goes
 * in says what the person can do, with each share and its dollars: "If Casey put in 6.6% of pay (about $400 a month) plus the usual
 * match, as people with pay like Casey's usually do, the plan could pay about $610 a month more."
 */
export function heroLine(top, base, cur = "USD") {
  if (!top || !base) return null;
  const m = (n) => fmtMoney(Math.round(Math.abs(n) / 10) * 10, cur);
  const diff = (side) => side.affordableMonthly - base.affordableMonthly;
  if (top.id === "saving" && top.usual?.length) {
    const d = diff(top.high);
    if (!(Math.abs(d) >= 5)) return null;
    const anyCapped = top.usual.some((u) => u.capped && u.kind === "401k");
    const like = top.usual.some((u) => isYou(u.name)) ? "yours" : top.usual.length === 1 ? nameOf(top.usual[0].name) : "theirs";
    return `If ${putInWords(top.usual.map((u) => ({ ...u, own: u.ownMonthly * 12, match: u.matchMonthly * 12 })), cur)}${anyCapped ? "" : `, as people with pay like ${like} usually do`}, the plan could pay about ${m(d)} a month ${d < 0 ? "less" : "more"}.`;
  }
  const sides = [top.low, top.high].filter((side) => side.label !== top.baseLabel && Math.abs(diff(side)) >= 5);
  if (!sides.length) return null;
  const verb = (n) => (n < 0 ? "cuts it by" : "raises it by");
  return `${top.label}: ${sides.map((side, i) => `${side.label}${i ? "" : ` instead of ${top.baseLabel}`} ${verb(diff(side))} ${m(diff(side))}${i ? "" : " a month"}`).join("; ")}.`;
}

/**
 * runoutLine(top, base, cap) -> the sentence under the headline when the page measures how long the money lasts (fix round 2, N1),
 * or null: "How much stocks earn: at 8.0% instead of 7.0%, the money lasts to age 81 instead of 77; at 6.0%, to age 74." An end that
 * runs out at the same age as the plan is left out; an end that lasts reads "lasts to the end".
 */
export function runoutLine(top, base, cap = 0) {
  if (!top || !base) return null;
  const b = valueOn(base, "runout", cap);
  const sides = [top.low, top.high].filter((side) => side.label !== top.baseLabel && Math.abs(valueOn(side, "runout", cap) - b) >= MOVES.runout);
  if (!sides.length) return null;
  const to = (side) => (side.success ? "lasts to the end" : `lasts to age ${side.runsOutAge}`);
  const was = base.success ? "instead of lasting to the end" : `instead of ${base.runsOutAge}`;
  return `${top.label}: ${sides.map((side, i) => (i ? `at ${side.label}, ${side.success ? "it lasts to the end" : `to age ${side.runsOutAge}`}` : `at ${side.label} instead of ${top.baseLabel}, the money ${to(side)} ${side.success ? (base.success ? "" : `instead of running out at ${base.runsOutAge}`) : was}`.trimEnd())).join("; ")}.`;
}

/** "Casey put in 6.6% of pay (about $400 a month) plus the usual match"; two people "Ana put in 6.4% of pay (about $500 a month)
 * and Ben 6.0% (about $400 a month), plus the usual match"; at the 401(k) limit "the most allowed in a 401(k) (about $2,040 a month)". */
export function putInWords(usual, cur = "USD") {
  const m = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const what = (u, first) => (u.capped && u.kind === "401k" ? `the most allowed in a 401(k) (about ${m(u.own / 12)} a month)` : `${pct1(u.share)}${first ? " of pay" : ""} (about ${m(u.own / 12)} a month)`);
  const match = usual.some((u) => u.match >= 60) ? " plus the usual match" : "";
  if (usual.length === 1) return `${nameIn(usual[0].name)} put in ${what(usual[0], true)}${match}`;
  const parts = usual.map((u, i) => `${nameIn(u.name)}${i ? "" : " put in"} ${what(u, i === 0)}`);
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}${match ? `,${match}` : ""}`;
}

/**
 * The words under the saving row when nothing goes in (fix round 1, 2026-11-12, M2/P3) -> { help, more }. Simple first (owner,
 * 2026-11-12: "default to less is more"): `help` is the line always shown, what the high end is, that the match is the usual one and
 * not the job's own ("Casey's job may differ"), and "Still short of ..." when even the high end is below what the plan spends;
 * `more` is the detail behind the row's quiet "More about this": each person's share and dollars and where they go, the match's
 * amount ("HR can tell you the real one"), and the plan's figure with the person's own money alone. The dollars are on the bar's
 * own label ("$400 a month + $240 match"), so the line does not repeat them.
 */
function usualHelp(usual, { ownOnly = null, high, spending, cur = "USD", year }) {
  const m = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const one = usual.length === 1, u0 = usual[0];
  const like = usual.some((u) => isYou(u.name)) ? "yours" : one ? nameOf(u0.name) : "theirs";
  const each = (u) => {
    const lead = `${NameIn(u.name)}: `;
    const share = `${pct1(u.share)} of pay`;
    if (u.kind === "401k" && u.capped) return `${lead}the most allowed in a 401(k) in ${year}, about ${m(u.own / 12)} a month (people with pay like ${isYou(u.name) ? "yours" : nameOf(u.name)} usually put in ${share})`;
    if (u.kind === "ira" && u.capped) return `${lead}${share}, about ${m(u.own / 12)} a month: ${m(u.rows[0].amount)} into ${accountWords(u.accountName)}, the most allowed in ${year}, and the rest into other savings`;
    const into = u.kind === "ira" ? `, into ${accountWords(u.accountName)}` : u.kind === null ? ", into other savings" : "";
    return `${lead}${share}, about ${m(u.own / 12)} a month${into}`;
  };
  const allCappedK = usual.every((u) => u.kind === "401k" && u.capped);
  const what = allCappedK ? `the most allowed in a 401(k) in ${year}` : `what people with pay like ${like} usually put in`;
  const matchMonthly = usual.reduce((s, u) => s + u.match, 0) / 12;
  const jobs = one ? `${nameOf(u0.name)} job may differ` : "the jobs may differ";
  const match = matchMonthly >= 5 ? `, plus the match most jobs add (${jobs})` : "";
  const short = high < spending - 5 ? ` Still short of the ${fmtMoney(Math.round(spending), cur)} a month the plan spends.` : "";
  const alone = ownOnly !== null && matchMonthly >= 5 ? ` With ${one ? nameOf(u0.name) : "their"} own money alone, the plan could pay about ${m(ownOnly)} a month.` : "";
  const matchMore = matchMonthly >= 5 ? ` The usual match: about ${m(matchMonthly)} a month; HR can tell you the real one.` : "";
  return { help: `Nothing goes in now. The high end: ${what}${match}.${short}`, more: `${usual.map(each).join("; ")}.${matchMore}${alone}` };
}
/** "Morgan's IRA" as it is, "My IRA" as "your IRA", any other name with "the" ("the Roth IRA"). */
const accountWords = (name) => {
  const t = String(name ?? "").trim() || "IRA";
  if (/^(my|your)\b/i.test(t)) return t.replace(/^(my|your)\b/i, "your");
  return /['\u2019]s\b/i.test(t) ? t : `the ${t}`;
};
/** The age from which a person counts as of working age for the usual saving (a 16-year-old's first job; below it a typo). */
export const WORK_AGE = 16;

/**
 * usualSaving(plan, today) -> [{ personId, name, share, pay, own, match, accountId, accountName, kind, capped, limit, rows, row }]: for
 * each adult of working age (16 to the retirement age; fix round 1, 2026-11-12, B5: a birth year typed in the future made a person
 * aged -54 a row) who still works for pay (job pay on Income today, not "retired" or "not working" on Get started) and has nothing
 * going in, what people with pay like theirs usually put in (owner's request 2026-11-11, L1: Sensitivity's saving row when nothing
 * goes in):
 * - own money a year = usualShare(plan, pid, today) x job pay (Vanguard, How America Saves 2026: the median share of pay put in,
 *   by pay and age; the same figure Get started's "Not sure" guess uses);
 * - at a plan at work (a 401(k) the person owns, or Get started's "plan at work: Yes"): into the job's 401(k) (one not named old,
 *   former, previous, prior or rollover, as Retirement contributions picks it), at most the 401(k) limit for the year (deferralLimit,
 *   IRS Notice 2025-67; `capped` when it binds); plus the match, unless the person said there is none (`workPlans[pid].match ===
 *   false`): a formula typed on Work benefits (typedTiers) on the pay a plan counts (compLimit), else the usual match, its median
 *   value of pay times the share of the full match earned: matchTerms().value x min(1, share / matchTerms().needed) x pay (4% of
 *   pay, all of it from 6% put in; the contrib.match estimator's own formula). A match alone adds nothing when nothing goes in, so
 *   the two are one high end (spec D-A5);
 * - outside a plan at work (fix round 1, M3): into the person's IRA, else their Roth IRA while household pay is under the top of the
 *   Roth IRA income range (limitsFor(year).rothPhaseOut for the filing status, Notice 2025-67; a share of the limit inside the
 *   range), at most the IRA limit for the age (limitsFor(year).kinds.ira plus catchUpFor from 50: $7,500 + $1,100 in 2026), the
 *   rest into a row with no account (other savings, counted as taxable); with neither, all of it there. No match.
 * `rows` are the contribution rows for a copy of the plan (`row` the first), monthly, as the Contributions form writes them.
 */
export function usualSaving(plan, today) {
  if (!today) return [];
  const year = Number(String(today).slice(0, 4));
  const adults = (plan?.household?.people ?? []).filter((p) => p && p.role !== "dependent" && p.birthDate);
  const rows = plan?.retirement?.contributions ?? [];
  const L = limitsFor(year);
  const filing = plan?.household?.filingStatus ?? "single";
  const out = [];
  for (const p of adults) {
    const age = ageOn(p.birthDate, today);
    const retireAge = Number(p.retirementAge ?? plan.assumptions?.retirementAge ?? 65);
    if (age === null || age < WORK_AGE || !(age < retireAge)) continue;
    if (["retired", "none"].includes(plan.guide?.setup?.status?.[p.id])) continue;
    const pay = jobPayOf(plan, p.id, today);
    if (!(pay > 0)) continue;
    if (rows.some((c) => c && c.personId === p.id && (Number(c.amount) > 0 || Number(c.employerMatch) > 0))) continue;   // something goes in already
    const share = usualShare(plan, p.id, today);
    if (!(share > 0)) continue;
    const own = (types) => (plan.accounts ?? []).filter((a) => a && types.includes(a.type) && !a.formerJob && (a.ownerId === p.id || (!a.ownerId && adults.length === 1)));
    const work = own(["401k"]);
    const w = plan.retirement?.workPlans?.[p.id] ?? {};
    const atWork = w.plan !== false && (work.length > 0 || w.plan === true);
    const ageY = ageInYear(plan, p.id, year) ?? age;
    const wanted = share * pay;
    let acct = null, ownYearly = wanted, match = 0, capped = false, limit = null, kind = null;
    const out1 = [];
    if (atWork) {
      acct = work.find((a) => !/\b(old|former|previous|prior|rollover)\b/i.test(a.name ?? "")) ?? work[0] ?? null;
      limit = deferralLimit(ageY, year);
      ownYearly = Math.min(wanted, limit > 0 ? limit : Infinity);
      capped = ownYearly < wanted - 0.5; kind = "401k";
      if (w.match !== false) {
        const comp = Math.min(pay, compLimit(year) || pay);
        const tiers = typedTiers(plan, p.id);
        const { value, needed } = matchTerms();
        match = tiers ? tierMatch(ownYearly / comp, tiers) * comp : value * Math.min(1, ownYearly / comp / needed) * comp;
      }
      out1.push({ id: `usual-${p.id}`, accountId: acct?.id ?? "", personId: p.id, amount: ownYearly / 12, period: "monthly", employerMatch: match });
    } else {
      // household pay stands in for the income the Roth IRA range is read on (pay is most of it for a working household)
      const income = filing === "married_joint" || filing === "qualifying_surviving" ? adults.reduce((s, q) => s + payOf(plan, q.id, today), 0) : payOf(plan, p.id, today);
      const [lo, hi] = L.rothPhaseOut?.[filing] ?? [Infinity, Infinity];
      const rothShare = income <= lo ? 1 : income >= hi ? 0 : (hi - income) / (hi - lo);
      const ira = own(["ira"])[0] ?? null;
      const roth = rothShare > 0 ? own(["roth"]).find((a) => limitKind("roth", a.name, 0) === "ira") ?? null : null;
      acct = ira ?? roth;
      if (acct) {
        const def = L.kinds.ira;
        limit = (def.limit + catchUpFor(def, ageY)) * (acct === ira ? 1 : rothShare);
        const into = Math.min(wanted, limit);
        capped = into < wanted - 0.5; kind = "ira";
        out1.push({ id: `usual-${p.id}`, accountId: acct.id, personId: p.id, amount: into / 12, period: "monthly", employerMatch: 0 });
        if (capped) out1.push({ id: `usual-${p.id}-rest`, accountId: "", personId: p.id, amount: (wanted - into) / 12, period: "monthly", employerMatch: 0 });
      } else out1.push({ id: `usual-${p.id}`, accountId: "", personId: p.id, amount: wanted / 12, period: "monthly", employerMatch: 0 });
    }
    out.push({ personId: p.id, name: p.name, share, pay, own: ownYearly, match, accountId: acct?.id ?? null, accountName: acct?.name ?? null, kind, capped, limit, rows: out1, row: out1[0] });
  }
  return out;
}
/** The match on a share of pay `d` for tiers [{ rate, upTo }] (each upTo the top of its band): the guesses' tierMatch, Work benefits' matchAt. */
const tierMatch = (d, tiers) => { let prev = 0, m = 0; for (const t of [...tiers].sort((a, b) => a.upTo - b.upTo)) { m += Math.max(0, Math.min(d, t.upTo) - prev) * t.rate; prev = Math.max(prev, t.upTo); } return m; };

/**
 * The "How it is worked out" sentence for the Social Security rows, as they were built: who is moved and to which ages,
 * and the trust-fund cut. Everyone moved claims at the same age, the oldest one's age today (never before 62), or at 70
 * (review 2026-11-02, round 5: the note said "62, or their age today", but a couple of 64 and 60 both move to 64 and 6 months).
 */
export function ssMethodNote(names = [], cut = false) {
  // the unnamed first adult ("Me") reads "you", the partner "your spouse" (review 2026-11-06, round 7)
  const and = namesIn;
  const two = names.length === 2;
  const claim = !names.length ? null : names.length === 1 ? `${nameIn(names[0])} claiming at today's age (62 at the earliest) or at 70`
    : `${and(names)} claiming at the same age, the ${two ? "older" : "oldest"} one's age today (62 at the earliest), or ${two ? "both" : "all"} at 70`;
  const parts = [claim, cut ? `the ${Math.round(SS_PAYABLE_IF_DEPLETED * 100)}% that would be payable if the retirement trust fund runs dry in 2033 (2025 Trustees Report)` : null].filter(Boolean);
  return parts.length ? `Social Security: ${parts.join("; and ")}.` : null;
}
