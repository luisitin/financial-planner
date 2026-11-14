// modules/balance/net-worth/path.js -- PURE. "Ahead or behind the path you drew" (gap design #35).
// When "Save today's totals" is tapped on Net worth, the page also keeps, at most once a month, where the retirement plan
// of that day put the household's savings in the years after (`plan.pathSnapshots`). Six months later and after, Net worth
// and the Annual review pack can say in one calm line whether savings are ahead of that path or behind it.
// "Savings" here are the accounts the retirement plan draws on (cash, investments, retirement accounts), never the home or
// the car, so the words on screen are "savings", not "net worth".
// Kept apart from compute.js: the retirement projection imports that file (ACCOUNT_TYPES), and this one imports the projection.
import { compute as computeProjection, buildInputs, BUCKET_OF } from "../../retirement/projection/compute.js";
import { addMonths, daysBetween } from "../../../core/math/dates.js";

/** A kept path says nothing until it is this old (months). */
export const MIN_MONTHS = 6;
/** At most this many kept paths; the oldest goes first. */
export const KEEP = 24;
/** Years of the path kept in one snapshot (one figure a year). */
export const POINT_YEARS = 10;
/** The kept path closest to this many days old is the one compared ("the plan of a year ago"). */
export const AIM_DAYS = 365;
/** Under this share of the expected figure (and always under $100) the answer is "right where the plan put them". */
export const ON_PLAN_SHARE = 0.01;
/** With nothing going into savings and under this much in them (that day, by the path and today), there is no path to speak of: nothing is said. */
export const MIN_PATH = 5000;
/** A counted balance dated more than this many months ago is said to be old: the answer is then about that day's balances. */
export const STALE_MONTHS = 1;
const DAYS_A_YEAR = 365.25;
const sum = (b) => (Number(b?.cash) || 0) + (Number(b?.taxable) || 0) + (Number(b?.deferred) || 0) + (Number(b?.free) || 0);
/** A real calendar day written "YYYY-MM-DD" ("2025-13-45" and "2025-02-30" are not). */
export function isDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * snapshotOf(plan, today) -> { at, start, points: { [year]: savings }, lastsTo, inflation } | null
 * The retirement projection of today, kept small: `start` the savings today, `points[startYear + i]` the projection's
 * rows[i].totalReal (whole dollars, the first POINT_YEARS rows), `lastsTo` the year the money runs out, else the plan's
 * last year, `inflation` the yearly rise in prices that plan assumed (the points are in the prices of the day; a later change
 * of the assumption does not move a path already kept). null while the projection cannot be worked out (no birth date, no accounts).
 */
export function snapshotOf(plan, today) {
  if (!isDay(today)) return null;
  let d;
  try { d = computeProjection(plan, { today }); } catch { return null; }
  if (!d?.ready || !d.rows?.length) return null;
  const points = {};
  for (const r of d.rows.slice(0, POINT_YEARS)) points[r.year] = Math.round(r.totalReal);
  return { at: today, start: Math.round(sum(d.inputs.balances)), points, lastsTo: d.result.failYear ?? d.rows[d.rows.length - 1].year,
    ...(Number.isFinite(Number(d.inputs.rates?.inflation)) ? { inflation: Number(d.inputs.rates.inflation) } : {}) };
}

/**
 * keepSnapshot(draft, snap) -> true when written. At most one a month: a second save on the same day replaces that day's
 * (as the saved totals do), a save on another day of a month that already has one writes nothing. At most KEEP are kept.
 */
export function keepSnapshot(draft, snap) {
  if (!snap || !isDay(snap.at)) return false;
  const list = Array.isArray(draft.pathSnapshots) ? draft.pathSnapshots.filter((s) => s && isDay(s.at)) : [];
  const month = snap.at.slice(0, 7);
  if (list.some((s) => s.at.slice(0, 7) === month && s.at !== snap.at)) return false;
  const next = [...list.filter((s) => s.at !== snap.at), snap].sort((a, b) => a.at.localeCompare(b.at));
  draft.pathSnapshots = next.slice(-KEEP);
  return true;
}

/** Whether keepSnapshot would write `snap` into this plan (asked before the save, for its confirmation); changes nothing. */
export const wouldKeep = (plan, snap) => keepSnapshot({ pathSnapshots: plan?.pathSnapshots }, snap);

/** The totals of a day are removed on Net worth: the path kept that day goes with them (a mistyped balance spoils both). */
export function dropSnapshot(draft, date) {
  if (!Array.isArray(draft.pathSnapshots)) return;
  const left = draft.pathSnapshots.filter((s) => s?.at !== date);
  if (left.length) draft.pathSnapshots = left; else delete draft.pathSnapshots;
}

/**
 * expectedAt(snap, today, inflation) -> { years, real, expected } | null
 * Where the kept path puts the savings on `today`, in money of today.
 *   years = days since the snapshot / 365.25
 *   The path's marks, a year apart: mark 0 = `start` (the day it was kept); mark k = the projection's row k-1, the savings
 *   one more year on. A row's figure is in the prices of the day the path was kept (totalReal), and the projection's first
 *   year is at those prices, so mark k in the money of its own day = points[year0 + k - 1] x (1 + inflation)^(k - 1).
 *   expected = a straight line between the two marks around `years`.
 *   real = the same line through the figures as kept (the prices of the day the path was kept).
 */
export function expectedAt(snap, today, inflation = 0) {
  if (!snap || !isDay(snap.at) || !isDay(today) || !snap.points) return null;
  const days = daysBetween(snap.at, today);
  if (!(days >= 0)) return null;
  const years = days / DAYS_A_YEAR, k = Math.floor(years), part = years - k;
  const year0 = Number(snap.at.slice(0, 4)), infl = Number(inflation) || 0;
  const real = (i) => (i === 0 ? Number(snap.start) : Number(snap.points[year0 + i - 1]));
  const lo = real(k), hi = real(k + 1);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  const then = (i) => real(i) * (i === 0 ? 1 : Math.pow(1 + infl, i - 1));
  return { years, real: lo + (hi - lo) * part, expected: then(k) + (then(k + 1) - then(k)) * part };
}

/** The kept path to compare with: at least MIN_MONTHS old, the one closest to a year old (the older of two as close). */
export function pickSnapshot(list, today) {
  if (!Array.isArray(list) || !isDay(today)) return null;
  const latest = addMonths(today, -MIN_MONTHS);
  const old = list.filter((s) => s && isDay(s.at) && s.at <= latest && s.points && Number.isFinite(Number(s.start)));
  if (!old.length) return null;
  const off = (s) => Math.abs(daysBetween(s.at, today) - AIM_DAYS);
  return old.sort((a, b) => off(a) - off(b) || a.at.localeCompare(b.at))[0];
}

/** What the plan puts into savings a month today: the projection's own contribution rows that still run this year. */
export function monthlySaving(inputs) {
  if (!inputs) return 0;
  const year = inputs.startYear;
  let yearly = 0;
  for (const c of inputs.contributions ?? []) {
    const p = inputs.people?.[c.personIndex ?? 0];
    const age = year - (p?.birthYear ?? year);
    if (age >= (c.untilAge ?? p?.retireAge ?? 65)) continue;
    if ((c.untilYear !== undefined && c.untilYear !== null && year > c.untilYear) || c.skipYears?.includes(year)) continue;
    yearly += Number(c.yearly) || 0;
  }
  return yearly / 12;
}

/**
 * oldestBalance(plan) -> "YYYY-MM-DD" | null: the oldest "as of" day among the accounts counted as savings (the projection's
 * buckets) that hold money and carry a day. null when none carries one.
 */
export function oldestBalance(plan) {
  let oldest = null;
  for (const a of plan?.accounts ?? []) {
    if (!a || !BUCKET_OF[a.type] || !(Number(a.balance) || 0) || !isDay(a.asOf)) continue;
    if (!oldest || a.asOf < oldest) oldest = a.asOf;
  }
  return oldest;
}

/**
 * tooSmall(plan, snap, today) -> true when a comparison with this kept path would say nothing as things stand: the plan
 * saves nothing today and the savings are under MIN_PATH both on the day the path was kept and today (also true while
 * today's projection cannot be worked out). The page then promises no comparison; the path is kept all the same, in
 * case saving starts.
 */
export function tooSmall(plan, snap, today) {
  let b;
  try { b = buildInputs(plan, { today }); } catch { return true; }
  if (!b?.inputs || !snap) return true;
  return !(monthlySaving(b.inputs) > 0) && Math.max(Number(snap.start) || 0, sum(b.inputs.balances)) < MIN_PATH;
}

/**
 * comingOn(plan, today) -> "YYYY-MM-DD" | null: the day the first kept path turns six months old, while none is that old
 * yet (the page then says in one line that the comparison is on its way). null with no kept path, once one is old enough,
 * or while that path is too small to say anything about (tooSmall).
 */
export function comingOn(plan, today) {
  const list = Array.isArray(plan?.pathSnapshots) ? plan.pathSnapshots.filter((s) => s && isDay(s.at) && s.points && Number.isFinite(Number(s.start)) && s.at <= today) : [];
  if (!list.length || !isDay(today) || pickSnapshot(list, today)) return null;
  const first = list.sort((a, b) => a.at.localeCompare(b.at))[0];
  return tooSmall(plan, first, today) ? null : addMonths(first.at, MIN_MONTHS);
}

/**
 * against(plan, today) -> null | { at, years, now, expected, ahead, side: "ahead" | "behind" | "on", monthly, months, staleFrom }
 *   now = the savings today in the projection's own buckets (cash, taxable, pre-tax, tax-free)
 *   expected = expectedAt(the picked snapshot, today, the inflation that plan assumed (kept in the snapshot; the plan's
 *     inflation of today for a snapshot kept without it))
 *   ahead = now - expected (minus = behind); "on" when |ahead| is under $100 or under 1% of expected
 *   months = |ahead| / monthly saving (null with no saving)
 *   staleFrom = the oldest counted balance's "as of" day when it is more than a month old (the page then says the answer
 *     is about the balances on file), else null
 * null (nothing to say) with no kept path six months old, while today's projection cannot be worked out, or when the plan
 * saves nothing and the savings are under MIN_PATH that day, by the path and today (a few dollars of interest is no path).
 */
export function against(plan, today) {
  const snap = pickSnapshot(plan?.pathSnapshots, today);
  if (!snap) return null;
  let b;
  try { b = buildInputs(plan, { today }); } catch { return null; }
  if (!b?.inputs) return null;
  const e = expectedAt(snap, today, Number.isFinite(Number(snap.inflation)) && snap.inflation !== null ? Number(snap.inflation) : b.inputs.rates?.inflation);
  if (!e) return null;
  const now = sum(b.inputs.balances), ahead = now - e.expected;
  const side = Math.abs(ahead) < Math.max(100, Math.abs(e.expected) * ON_PLAN_SHARE) ? "on" : ahead > 0 ? "ahead" : "behind";
  const monthly = monthlySaving(b.inputs);
  if (!(monthly > 0) && Math.max(Number(snap.start), e.expected, now) < MIN_PATH) return null;
  const oldest = oldestBalance(plan);
  return { at: snap.at, years: e.years, now, expected: e.expected, ahead, side, monthly, months: monthly > 0 ? Math.abs(ahead) / monthly : null,
    staleFrom: oldest && oldest < addMonths(today, -STALE_MONTHS) ? oldest : null };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The kept plan in words: "last November's plan" (last calendar year), "this May's plan" (this year), "your November 2024 plan". */
export function planWords(at, today) {
  const y = Number(at.slice(0, 4)), m = MONTHS[Number(at.slice(5, 7)) - 1], now = Number(today.slice(0, 4));
  return y === now - 1 ? `last ${m}'s plan` : y === now ? `this ${m}'s plan` : `your ${m} ${y} plan`;
}
/** ", about 3 months of your usual saving" (two years and more said in years); "" under one month or with no saving. */
export function savingWords(months) {
  if (!(months >= 1)) return "";
  const n = Math.round(months);
  if (n >= 24) return `, about ${Math.round(n / 12)} years of your usual saving`;
  return `, about ${n} month${n === 1 ? "" : "s"} of your usual saving`;
}
/**
 * The one sentence, per case (money: a number -> "$12,400"):
 *   ahead   "Your savings are $12,400 ahead of where last November's plan put them, about 3 months of your usual saving."
 *   behind  "Your savings are $8,000 behind where last November's plan put them, about 2 months of your usual saving."
 *   on      "Your savings are right where last November's plan put them."
 */
export function sentenceOf(a, today, money) {
  const plan = planWords(a.at, today);
  if (a.side === "on") return `Your savings are right where ${plan} put them.`;
  const amount = money(Math.abs(a.ahead));
  return a.side === "ahead" ? `Your savings are ${amount} ahead of where ${plan} put them${savingWords(a.months)}.`
    : `Your savings are ${amount} behind where ${plan} put them${savingWords(a.months)}.`;
}
/**
 * The line under the sentence when the balances counted are old (`staleFrom`), else "". `day`: a date -> "May 3, 2026".
 *   "This compares the balances on file, the oldest from May 3, 2026. Update your balances for today's answer."
 */
export function staleWords(a, day) {
  return a?.staleFrom ? `This compares the balances on file, the oldest from ${day(a.staleFrom)}. Update your balances for today's answer.` : "";
}
/** The line shown while a kept path is not six months old yet (`comingOn`). `day`: a date -> "May 14, 2027". */
export const comingWords = (on, day) => `From ${day(on)}, this page also says whether your savings are ahead of or behind the plan you had when you saved your totals.`;
/** What "Save today's totals" confirms: the totals, and the plan kept with them when one was kept by this save. */
export const savedWords = (kept) => (kept ? "Today's totals saved. Your plan is kept too, so you can compare in six months." : "Today's totals saved.");
/** The part's status beside its title, at most 20 characters: "ahead by $12,400", "behind by $8,000", "on track". */
export function statusWords(a, money) {
  if (a.side === "on") return "on track";
  const s = `${a.side} by ${money(Math.abs(a.ahead))}`;
  return s.length <= 20 ? s : a.side;
}
