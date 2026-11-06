// modules/reports/annual-review/compute.js -- PURE and heavy. The year in one pack: the months reviewed
// and their notes, net worth from the first saved point of the year to the last, the money in and out
// from the bank files month by month and where it went, the goals reached and still open, the plan's
// health today, and what next year holds (the timeline's moments, the next steps).
import { compute as computeSpending } from "../../cashflow/spending/compute.js";
import { compute as computeIncomeStatement } from "../../cashflow/income-statement/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeHealth } from "../../overview/health-score/compute.js";
import { compute as computeTimeline } from "../../overview/timeline/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { monthLabel } from "../../overview/monthly-review/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { firstLineOf } from "../../transactions/ledger/compute.js";

/** The year a review on `today` is about: last year in January and February, else this year so far. */
export const defaultYear = (today) => (Number(today.slice(5, 7)) <= 2 ? Number(today.slice(0, 4)) - 1 : Number(today.slice(0, 4)));

/**
 * compute(plan, { today, year }) -> {
 *   ready, missing, year, today, partial (the year is not over),
 *   reviews: { count, months: [{ month, label, at, note }] },
 *   netWorth: { first (the last total saved before the year, else its first; null when there is none), last (the year so far: today's
 *     balances, live: true; a year over: its last saved total), change (null without a first), points: [{ date, netWorth }],
 *     lastSaved (a year over whose last total is not from December: its date) } | null,
 *   money: { months: [{ ym, label, in, out, net }], in, out, net, rate, cards, cardMonths: [{ cardId, name, total, months: [ym], first }], gaps: [{ why, yms }] } | null,
 *     categories: [{ label, total, share }] (the year's spending, largest first; both from the income statement and Spending, so
 *     a card whose own file is missing counts as its payments, "<card>, details not imported yet", `cards` is that part of
 *     `out` and `cardMonths` says it per card with its months and its first line ever (`first`, null when it has no lines at
 *     all), 2026-11-02; `gaps`: the income statement's `missing` reasons for the
 *     year's months, grouped: the days an account's files miss, which the totals leave out (re-check 2026-11-02)),
 *   goals: { reached: [names], open: [{ name, status }] }, health: { score, band } | null,
 *   ahead: { year, moments: [{ date, title, icon }], steps: [{ title, detail }] }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const year = Number(params.year) || defaultYear(today);
  const inYear = (d) => Number(String(d ?? "").slice(0, 4)) === year;
  const partial = Number(today.slice(0, 4)) <= year;

  const reviews = (plan.reviews ?? []).filter((r) => inYear(r.month)).sort((a, b) => a.month.localeCompare(b.month)).map((r) => ({ ...r, label: monthLabel(r.month) }));
  const pts = (plan.netWorthHistory ?? []).filter((h) => inYear(h.date)).sort((a, b) => a.date.localeCompare(b.date));
  const before = (plan.netWorthHistory ?? []).filter((h) => Number(h.date.slice(0, 4)) < year).sort((a, b) => a.date.localeCompare(b.date)).pop();
  // the year so far ends today, at today's balances (the Dashboard's figure), not at the last total someone saved: most
  // people never press "Save today's totals", so the old end point was often the start point itself ("up $0")
  const nwNow = (plan.accounts ?? []).length ? computeNetWorth(plan, { today }) : null;
  const live = partial && Number(today.slice(0, 4)) === year && nwNow ? { date: today, assets: nwNow.assets, liabilities: nwNow.liabilities, netWorth: nwNow.netWorth, live: true } : null;
  const saved = pts.filter((h) => !live || h.date < today);
  const first = before ?? saved[0] ?? null;
  const last = live ?? pts[pts.length - 1] ?? null;
  const points = [...(before ? [before] : []), ...saved, ...(live ? [live] : [])].map((h) => ({ date: h.date, netWorth: h.netWorth }));
  const netWorth = last ? { first: first && first !== last ? first : null, last, change: first && first !== last ? last.netWorth - first.netWorth : null, points,
    lastSaved: !live && last && last.date.slice(5, 7) !== "12" ? last.date : null } : null;

  let money = null, categories = [];
  if ((plan.transactions ?? []).length) {
    const is = computeIncomeStatement(plan, { today, months: 36 });
    const rows = is.rows.filter((r) => inYear(r.ym)).sort((a, b) => a.ym.localeCompare(b.ym));
    if (rows.length) {
      const tin = rows.reduce((s, r) => s + r.in, 0), tout = rows.reduce((s, r) => s + r.out, 0);
      // `cards`: the payments to a card whose own file is missing that month, already in `out` (the income statement's stand-in
      // lines); `cardMonths`: per card, its total and the months it was in, so the review names them ("in July went to the Visa")
      const per = new Map();
      for (const r of rows) for (const c of r.cardsBy ?? []) { const x = per.get(c.cardId) ?? { cardId: c.cardId, name: c.name, total: 0, months: [], first: firstLineOf(plan, c.cardId) }; x.total += c.total; x.months.push(r.ym); per.set(c.cardId, x); }
      // the days an account's files miss in the year's months, grouped by the gap ("Chase checking has no lines from 7/31 to
      // 8/2" for July and August): the totals leave out what happened then (re-check 2026-11-02)
      const gaps = [];
      for (const r of rows) for (const [i, why] of (r.missing ?? []).entries()) { const g = gaps.find((x) => x.why === why); if (g) g.yms.push(r.ym); else gaps.push({ why, yms: [r.ym], unsure: r.kinds?.[i] === "unsure" }); }
      money = { months: rows.map((r) => ({ ym: r.ym, label: r.label, in: r.in, out: r.out, net: r.net })), in: tin, out: tout, net: tin - tout, rate: tin > 0 ? (tin - tout) / tin : null, cards: rows.reduce((s, r) => s + (r.cards ?? 0), 0), cardMonths: [...per.values()].sort((a, b) => b.total - a.total), gaps };
      const byCat = new Map();
      for (const r of rows) { const sp = computeSpending(plan, { today, month: r.ym }); if (sp.month !== r.ym) continue; for (const c of sp.byCategory) byCat.set(c.label, (byCat.get(c.label) ?? 0) + c.total); }
      const total = [...byCat.values()].reduce((s, v) => s + v, 0);
      categories = [...byCat.entries()].map(([label, t]) => ({ label, total: t, share: total > 0 ? t / total : 0 })).sort((a, b) => b.total - a.total);
    }
  }

  const gl = computeGoals(plan, { today });
  const goals = { reached: gl.goals.filter((g) => g.status === "done").map((g) => g.name), open: gl.goals.filter((g) => g.status !== "done").map((g) => ({ name: g.name, status: g.status })) };
  const h = computeHealth(plan, { today });
  const tl = computeTimeline(plan, { today });
  const nb = computeNext(plan, { today });
  const steps = [];
  if (nb.ready && nb.next) steps.push({ title: nb.next.title, detail: nb.next.detail });
  for (const g of h.ready ? h.gains : []) if (g.fix && steps.length < 4) steps.push({ title: g.title, detail: g.fix });
  const nextYear = year + 1;
  return {
    ready: true, missing: [], year, today, partial,
    reviews: { count: reviews.length, months: reviews }, netWorth, money, categories, goals,
    health: h.ready ? { score: h.score, band: h.band } : null,
    ahead: { year: nextYear, moments: tl.ready ? tl.events.filter((e) => e.year === nextYear).map((e) => ({ date: e.date, title: e.title, icon: e.icon })) : [], steps },
  };
}
