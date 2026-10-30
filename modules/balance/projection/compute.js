// modules/balance/projection/compute.js -- PURE. Net worth at the end of each year from now: the savings and
// investments as the retirement projection grows and spends them (contributions while working, withdrawals
// after), homes growing in value, cars losing it, 529 plans growing, and every debt paid down on the payoff
// plan's schedule. In money of the day and in today's money, with the moments that change it: debts and the
// mortgage paid off, net worth doubling or passing a million, retirement, the peak.
import { payoffPlan } from "../../../core/math/payoff.js";
import { compute as computeNetWorth, countedBalance, isLiability } from "../net-worth/compute.js";
import { compute as computeRetirement } from "../../retirement/projection/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";

/** The page's own settings: years shown (null: to five years after retirement, 10 to 40), home prices' yearly growth, cars' yearly loss of value. */
export const DEFAULTS = { years: null, homeGrowth: 0.035, vehicleLoss: 0.15 };

/**
 * compute(plan, { today }) -> {
 *   ready, missing, notes, settings,
 *   now: { netWorth, assets, liabilities, invested, homes, vehicles, college, other, debts },
 *   rows: [{ year, age, retired, invested, homes, vehicles, college, other, debts, mortgage, netWorth, priceLevel, netWorthReal }],
 *   milestones: [{ year, kind, label }], peak: row, retireYear,
 *   inTen: row | null (ten years on), atRetirement: row | null, last: row
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.netWorth ?? {};
  const num = (v, d) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
  const settings = { years: num(s.years, null), homeGrowth: num(s.homeGrowth, DEFAULTS.homeGrowth), vehicleLoss: num(s.vehicleLoss, DEFAULTS.vehicleLoss) };
  const nw = computeNetWorth(plan, { today });
  const accounts = plan.accounts ?? [];
  const sum = (...types) => accounts.filter((a) => types.includes(a.type)).reduce((t, a) => t + countedBalance(a), 0);
  const nowParts = { homes: sum("property"), vehicles: sum("vehicle"), college: sum("529"), other: sum("other_asset") };
  const ret = computeRetirement(plan, { today });
  if (settings.years !== null) settings.years = Math.min(40, Math.max(1, Math.round(settings.years)));
  if (!ret.ready) return { ready: false, missing: ret.missing, notes: ret.notes ?? [], settings, now: { netWorth: nw.netWorth, assets: nw.assets, liabilities: nw.liabilities } };

  // debts: the payoff plan month by month; debts without a rate and payment stay as they are
  const pay = computePayoff(plan, { today });
  const sched = pay.hasData ? payoffPlan(pay.debts, { extra: pay.extra, order: pay.order, customOrder: pay.customOrder }) : null;
  const scheduled = new Set(pay.debts?.map((d) => d.id) ?? []);
  const debtAccounts = accounts.filter((a) => isLiability(a.type) && countedBalance(a) > 0);
  const flatDebt = debtAccounts.filter((a) => !scheduled.has(a.id)).reduce((t, a) => t + countedBalance(a), 0);
  const mortgageIds = new Set(debtAccounts.filter((a) => a.type === "mortgage").map((a) => a.id));
  const flatMortgage = debtAccounts.filter((a) => mortgageIds.has(a.id) && !scheduled.has(a.id)).reduce((t, a) => t + countedBalance(a), 0);
  const startDebt = Object.fromEntries((pay.debts ?? []).map((d) => [d.id, d.balance]));
  const debtAt = (months) => {
    const bal = months <= 0 || !sched ? startDebt : (sched.timeline[Math.min(months, sched.timeline.length) - 1]?.balances ?? {});
    let all = 0, mortgage = 0;
    for (const id of scheduled) { const b = months > (sched?.timeline.length ?? 0) ? 0 : (bal[id] ?? 0); all += b; if (mortgageIds.has(id)) mortgage += b; }
    return { all: all + flatDebt, mortgage: mortgage + flatMortgage };
  };

  const month = today ? Number(String(today).slice(5, 7)) : 12;
  const monthsLeft = 12 - month;   // payments still to come this year
  const growth = planReturn(plan);
  if (settings.years === null) settings.years = Math.min(40, Math.max(10, ret.inputs.retireYear - ret.rows[0].year + 6));
  const rows = ret.rows.slice(0, settings.years).map((r, i) => {
    const t = (monthsLeft + 12 * i) / 12;   // years from today to the end of this row's year
    const d = debtAt(monthsLeft + 12 * i);
    const homes = nowParts.homes * Math.pow(1 + settings.homeGrowth, t);
    const vehicles = nowParts.vehicles * Math.pow(1 - settings.vehicleLoss, t);
    const college = nowParts.college * Math.pow(1 + growth, t);
    const invested = r.total;
    const netWorth = invested + homes + vehicles + college + nowParts.other - d.all;
    return { year: r.year, age: r.ages?.[0] ?? null, retired: r.retired, invested, homes, vehicles, college, other: nowParts.other, debts: d.all, mortgage: d.mortgage, netWorth, priceLevel: r.priceLevel, netWorthReal: netWorth / r.priceLevel };
  });

  // the moments that change it
  const milestones = [];
  const nowDebts = debtAccounts.reduce((t, a) => t + countedBalance(a), 0);
  const first = (test) => rows.find(test) ?? null;
  const freeOf = nowDebts > 0 && flatDebt === 0 ? first((r) => r.debts < 0.5) : null;
  if (mortgageIds.size && flatMortgage === 0) { const m = first((r) => r.mortgage < 0.5); if (m) milestones.push({ year: m.year, kind: "mortgage", label: freeOf?.year === m.year ? "Mortgage paid off: debt-free" : "Mortgage paid off" }); }
  if (freeOf && !milestones.some((x) => x.kind === "mortgage" && x.year === freeOf.year)) milestones.push({ year: freeOf.year, kind: "debtfree", label: "Debt-free" });
  if (nw.netWorth < 0) { const m = first((r) => r.netWorth >= 0); if (m) milestones.push({ year: m.year, kind: "positive", label: "You own more than you owe" }); }
  if (nw.netWorth > 0) { const m = first((r) => r.netWorthReal >= 2 * nw.netWorth); if (m) milestones.push({ year: m.year, kind: "double", label: "Net worth doubles (in today's money)" }); }
  if (nw.netWorth < 1e6) { const m = first((r) => r.netWorthReal >= 1e6); if (m) milestones.push({ year: m.year, kind: "million", label: "A million in today's money" }); }
  const retireYear = ret.inputs.retireYear;
  const atRetirement = rows.find((r) => r.year === retireYear) ?? null;
  if (atRetirement && retireYear > rows[0].year) milestones.push({ year: retireYear, kind: "retire", label: "Retirement" });
  const peak = rows.reduce((a, r) => (r.netWorthReal > a.netWorthReal ? r : a), rows[0]);
  if (peak !== rows[rows.length - 1]) milestones.push({ year: peak.year, kind: "peak", label: "The highest point (in today's money)" });
  milestones.sort((a, b) => a.year - b.year);

  const notes = [...(ret.notes ?? [])];
  if (flatDebt > 0) notes.push("Debts without a rate and a payment (Debts page) stay at today's balance.");
  if (sched?.neverPaysOff?.length) notes.push("A debt whose payment does not cover its interest never shrinks here.");
  const invested0 = nw.netWorth - nowParts.homes - nowParts.vehicles - nowParts.college - nowParts.other + nowDebts;
  return {
    ready: true, missing: [], notes, settings,
    now: { netWorth: nw.netWorth, assets: nw.assets, liabilities: nw.liabilities, invested: invested0, ...nowParts, debts: nowDebts },
    rows, milestones, peak, retireYear,
    inTen: rows.find((r) => r.year === rows[0].year + 10) ?? null, atRetirement, last: rows[rows.length - 1],
  };
}
