// modules/overview/guesses/rank.js -- PURE and heavy. "Our guesses for you": which of our guesses change your answers the
// most (spec 11.2, C8). Each of the first eight (by static weight) is moved on its own to the ends of its middle half and
// the plan's three answers are worked out again: what is left each month (Next best action's monthOf), the months the
// emergency fund covers (Emergency fund) and, when it can be worked out, what the plan can pay for in retirement and its
// verdict (Will the money last?). Tier 1: an answer's verdict changes; tier 2: the month or retirement moves by $100 a month,
// or the cushion by a month; tier 3: the rest.
//
//   rankGuesses(plan, { today, registry, before }) -> { key, ranks: { [path]: { tier, spare, months, retire, flips } } }
//   rankWords(rank, currency)   the line under the row: "If it's off by about $46,000 a year, what's left each month could
//                               change by about $2,650."
//
// It lives beside compute.js, not in it: the import rule (spec 6.2, module.test.mjs) keeps every overview compute out of what
// compute.js reaches, and this file reads Next best action's. The page calls it (view.js, once per change of the plan) and
// hands the result to compute(plan, { ranked }), which orders the rows by it; the Dashboard reads the same memo.
import { guessMoves, measure } from "./ranges.js";
import { monthOf } from "../next-best-action/compute.js";
import { compute as liquidity, cushionKeep } from "../../balance/liquidity/compute.js";
import { compute as projection, retireKeep } from "../../retirement/projection/compute.js";
import { money as fmtMoney } from "../../../core/format.js";

/** At most this many guesses go through the moves (spec 11.2: the top 8 by static weight). */
export const RANK_MAX = 8;
/** Tier 2: the month or retirement moves by this much a month, or the cushion by this many months (spec 11.2). */
export const TIER2 = { monthly: 100, months: 1 };

/** A guess the month's left over can rest on (Next best action's sections). */
const spareKeep = (e) => /^(expenses|debts|income)\[/.test(e.path) || /^retirement\.contributions\[/.test(e.path);
/** The guesses that can move one of the three answers (a home's value, a car's or a debt's balance moves none of them). */
const anyKeep = (fromBills) => (e, plan) => spareKeep(e) || cushionKeep(e, plan) || retireKeep(e, plan, fromBills);

/** "$150": the swing said to $10 under $100, else to $50 (spec 11.2). */
export function swingMoney(v, cur = "USD") {
  const a = Math.abs(v);
  return fmtMoney(a < 100 ? Math.round(a / 10) * 10 : Math.round(a / 50) * 50, cur);
}

/** What the answers rest on: the plan's figures and today, without its stamps and without the ledger (keeping a guess as it is
 * changes no figure, so what was worked out for the other guesses still holds). */
export const figuresKey = (plan, today) => `${today}|${JSON.stringify({ ...plan, meta: undefined, guesses: undefined })}`;

/**
 * rankGuesses(plan, { today, registry, before }) -> { key, ranks: { [path]: { tier: 1 | 2 | 3, spare, months, retire,
 * flips: ["month" | "cushion" | "retirement"], kinds: { retirement: [...] } } } }: for the guesses that can move an answer, at
 * most RANK_MAX of them, the big ones first. spare: the larger change of the month's left over (dollars a month); months: of
 * the cushion; retire: of what the plan can pay for in retirement (dollars a month). A guess not ranked has no entry (the page
 * keeps its static place). `before`: the last answer; while the figures are the same (figuresKey) a guess already worked out
 * is not worked out again (a tap on "That's about right" changes only the ledger).
 */
export function rankGuesses(plan, { today, registry = null, before = null } = {}) {
  if (!today) return { key: null, ranks: {} };
  const key = figuresKey(plan, today);
  const fromBills = !(Number(plan?.retirement?.spendingMonthly) > 0);
  const all = guessMoves(plan, { keep: anyKeep(fromBills), registry, today, group: false, max: RANK_MAX });
  const same = (m) => before?.key === key && before.ranks?.[m.id] && before.ranks[m.id].factorHigh === m.factorHigh;
  const ranks = Object.fromEntries(all.filter(same).map((m) => [m.id, before.ranks[m.id]]));
  const moves = all.filter((m) => !same(m));
  if (!moves.length) return { key, ranks };
  // (v, u, the factors and each answer's end: how far "off" the line under the row means, said in the guess's own unit)
  const out = Object.fromEntries(moves.map((m) => [m.id, { tier: 3, spare: 0, months: 0, retire: 0, flips: [], kinds: {}, factorHigh: m.factorHigh, factorLow: m.factorLow, v: m.v, u: m.u, ends: {} }]));
  const endOf = (x) => (x.flips ? x.flipEnd : x.end);
  const run = (keep, fn, kindOf, put) => {
    const mine = moves.filter((m) => keep({ path: m.id }));
    if (!mine.length) return;
    const r = measure(fn, plan, mine, { kindOf });
    if (!r) return;
    mine.forEach((m, i) => put(out[m.id], r.each[i], r));
  };
  // the month: short (below -$5) or not, as Next best action says it
  run(spareKeep, (p) => { const m = monthOf(p, today); return m.needs.length ? null : m.spare.monthly; }, (x) => (typeof x === "number" ? (x < -5 ? "short" : "not short") : null),
    (o, x) => { o.spare = x.side; o.ends.month = endOf(x); if (x.flips) o.flips.push("month"); });
  // the cushion: covered, half way or less, as Emergency fund says it
  const target = Number(plan?.assumptions?.emergencyMonths ?? 6);
  run((e) => cushionKeep(e, plan), (p) => liquidity(p, { today }).runwayMonths, (x) => (typeof x !== "number" ? null : target > 0 && x / target >= 1 ? "ok" : target > 0 && x / target >= 0.5 ? "warn" : "bad"),
    (o, x) => { o.months = x.side; o.ends.cushion = endOf(x); if (x.flips) o.flips.push("cushion"); });
  // retirement, when the plan can be run at all (spec 11.2: "when retirementKnown")
  let ready = false;
  try { ready = projection(plan, { today }).ready === true; } catch { ready = false; }
  if (ready) {
    run((e) => retireKeep(e, plan, fromBills), (p) => { const d = projection(p, { today }); return d.ready ? { value: d.affordable, verdict: d.verdict } : null; }, (r) => (r && typeof r === "object" ? r.verdict : null),
      (o, x, r) => { o.retire = x.side / 12; o.ends.retirement = endOf(x); if (x.flips) { o.flips.push("retirement"); o.kinds.retirement = r.kinds; } });
  }
  for (const o of Object.values(out)) o.tier = o.flips.length ? 1 : o.spare >= TIER2.monthly || o.retire >= TIER2.monthly || o.months >= TIER2.months ? 2 : 3;
  return { key, ranks: { ...ranks, ...out } };
}

/** "$46,000": how far off a guess is, said plainly (under $1,000 as swingMoney says it, above it to two figures). */
export function offMoney(v, cur = "USD") {
  const a = Math.abs(v);
  if (a < 1000) return swingMoney(a, cur);
  const step = 10 ** (Math.floor(Math.log10(a)) - 1);
  return fmtMoney(Math.round(a / step) * step, cur);
}
/** " by about $46,000 a year": the guess at the end that moves `answer` ("month", "cushion", "retirement"), less the guess as it
 * is, in the guess's own unit; "" when it cannot be said (a ranking kept from before this was recorded, or no figure). */
export function offWords(r, answer, cur = "USD") {
  const end = r?.ends?.[answer];
  const f = end === "low" ? 1 - r.factorLow : end === "high" ? r.factorHigh - 1 : NaN;
  const d = Number(r?.v) * f;
  if (!(d > 0) || !Number.isFinite(d)) return "";
  return ` by about ${offMoney(d, cur)}${r.u === "month" ? " a month" : r.u === "year" ? " a year" : ""}`;
}

/**
 * The page's line for one ranked guess, one sentence per case (spec 11.2), or null (tier 3: it matters less, nothing said). "Off"
 * says how far (critic F6: "could change by about $2,650" for a $66,000 pay read as made up until it said the pay could be
 * $46,000 a year higher): the guess at the end of its middle half that moves that answer, against the guess as it is.
 *   tier 1  "If it's off by about $2,000, it could decide whether your month comes out short." (or the emergency fund, or the
 *           money lasting)
 *   tier 2  "If it's off by about $46,000 a year, what's left each month could change by about $2,650." (or retirement, or
 *           the cushion by N months)
 */
export function rankWords(r, cur = "USD") {
  if (!r) return null;
  const off = (answer) => `If it's off${offWords(r, answer, cur)}`;
  if (r.tier === 1) {
    if (r.flips.includes("month")) return `${off("month")}, it could decide whether your month comes out short.`;
    if (r.flips.includes("cushion")) return `${off("cushion")}, it could decide whether your emergency fund is big enough.`;
    return (r.kinds?.retirement ?? []).includes("short") ? `${off("retirement")}, it could decide whether the money lasts in retirement.` : `${off("retirement")}, it could decide whether your retirement is on track.`;
  }
  if (r.tier === 2) {
    if (r.spare >= TIER2.monthly) return `${off("month")}, what's left each month could change by about ${swingMoney(r.spare, cur)}.`;
    if (r.retire >= TIER2.monthly) return `${off("retirement")}, what you could spend in retirement could change by about ${swingMoney(r.retire, cur)} a month.`;
    const n = Math.max(1, Math.round(r.months));
    return `${off("cushion")}, your emergency fund could cover about ${n === 1 ? "a month" : `${n} months`} more or less.`;
  }
  return null;
}
