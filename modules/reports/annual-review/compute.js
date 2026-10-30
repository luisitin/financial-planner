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

/** The year a review on `today` is about: last year in January and February, else this year so far. */
export const defaultYear = (today) => (Number(today.slice(5, 7)) <= 2 ? Number(today.slice(0, 4)) - 1 : Number(today.slice(0, 4)));

/**
 * compute(plan, { today, year }) -> {
 *   ready, missing, year, today, partial (the year is not over),
 *   reviews: { count, months: [{ month, label, at, note }] },
 *   netWorth: { first, last, change, points: [{ date, netWorth }] } | null,
 *   money: { months: [{ ym, label, in, out, net }], in, out, net, rate } | null, categories: [{ label, total, share }] (the year's spending, largest first),
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
  const first = before ?? pts[0] ?? null, last = pts[pts.length - 1] ?? null;
  const netWorth = last && first ? { first, last, change: last.netWorth - first.netWorth, points: [...(before ? [before] : []), ...pts].map((h) => ({ date: h.date, netWorth: h.netWorth })) } : null;

  let money = null, categories = [];
  if ((plan.transactions ?? []).length) {
    const is = computeIncomeStatement(plan, { today, months: 36 });
    const rows = is.rows.filter((r) => inYear(r.ym)).sort((a, b) => a.ym.localeCompare(b.ym));
    if (rows.length) {
      const tin = rows.reduce((s, r) => s + r.in, 0), tout = rows.reduce((s, r) => s + r.out, 0);
      money = { months: rows.map((r) => ({ ym: r.ym, label: r.label, in: r.in, out: r.out, net: r.net })), in: tin, out: tout, net: tin - tout, rate: tin > 0 ? (tin - tout) / tin : null };
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
