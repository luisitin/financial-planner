// modules/cashflow/income/compute.js -- PURE. Every source of money coming in, put on the
// same footing (per month, per year) whatever its pay period, with who earns it and how it
// grows. Expenses, liquidity, retirement and taxes read these totals.
import { perMonth, perYear, activeOn, periodLabel } from "../../../core/math/periods.js";
import { addMonths, isValidDate } from "../../../core/math/dates.js";
import { isGuess } from "../../../core/estimate/index.js";
// a rental's rent after its running costs (a leaf: Net worth's balance rule only)
import { rentalsOf, rentAfterCosts, loanPaymentOf } from "../../property/rental/running.js";

export const INCOME_TYPES = {
  salary:     { label: "Pay from a job",           icon: "💼" },
  bonus:      { label: "Bonus or commission",      icon: "🎯" },
  business:   { label: "Self-employment / business", icon: "🛠️" },
  rental:     { label: "Rent you collect",         icon: "🏘️" },
  pension:    { label: "Pension",                  icon: "🏛️" },
  social:     { label: "Social Security",          icon: "🇺🇸" },
  investment: { label: "Dividends and interest",   icon: "📈" },
  support:    { label: "Support or gifts received", icon: "🎁" },
  other:      { label: "Other",                    icon: "💵" },
};

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...income, typeLabel, icon, periodLabel, personName, monthly, yearly, active, upcoming, ended, nextYear }],
 *   active: [items that count today], count,
 *   monthly, yearly (active, recurring only), nextYear (yearly after each item's raise),
 *   taxableYearly, untaxedYearly, oneTime (sum of active one-offs, not in monthly/yearly),
 *   heldMonthly (the part of uneven pay the plan does not count on: amount a month minus income[].countOn, active only;
 *   monthly and yearly keep the full amount, which tax uses),
 *   byType: { [type]: yearly }, byPerson: [{ personId, name, yearly, monthly }], warnings: [text]
 * }
 * `today` decides which items are active (start/end dates); without it everything counts.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const nameOf = (id) => people.find((p) => p.id === id)?.name ?? (id ? "Someone" : "Household");
  const items = (plan.income ?? []).map((x) => {
    const t = INCOME_TYPES[x.type] ?? INCOME_TYPES.other;
    const active = today ? activeOn(x, today) : true;
    const yearly = perYear(x.amount, x.period);
    const growth = Number(x.growth) || 0;
    // "count on" (Side income's careful figure, a month): cash-flow pages plan with it; tax keeps the amount, what comes in
    // on average. heldMonthly is the part of the amount the plan does not count on (round 4, 2026-11-02)
    const careful = countedOn(x);
    const held = careful !== null ? Math.max(0, perMonth(x.amount, x.period) - careful) : 0;
    return {
      ...x, typeLabel: t.label, icon: t.icon, periodLabel: periodLabel(x.period), personName: nameOf(x.personId),
      monthly: perMonth(x.amount, x.period), yearly, active,
      upcoming: !!(today && x.startDate && String(x.startDate) > today),
      ended: !!(today && x.endDate && String(x.endDate) < today),
      nextYear: yearly * (1 + growth),
      oneTime: x.period === "once" ? Number(x.amount) || 0 : 0,
      heldMonthly: held,
      // the amount is our guess (Get started left it blank; fixer round 1, ssg-L-6): the page marks it "Our guess for now"
      guessed: typeof x.id === "string" && !/[.[\]]/.test(x.id) && isGuess(plan, `income[${x.id}].amount`),
    };
  });
  const active = items.filter((x) => x.active);
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const byType = {};
  for (const x of active) byType[x.type ?? "other"] = (byType[x.type ?? "other"] ?? 0) + x.yearly;
  const byPersonMap = new Map();
  for (const x of active) { const k = x.personId || ""; const e = byPersonMap.get(k) ?? { personId: k, name: nameOf(k), yearly: 0, monthly: 0 }; e.yearly += x.yearly; e.monthly += x.monthly; byPersonMap.set(k, e); }
  const warnings = [];
  for (const x of items) {
    if (!(Number(x.amount) > 0)) warnings.push(`${x.name || "An income"} has no amount.`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name || "An income"} ends before it starts.`);
    if (Number(x.growth) > 0.25) warnings.push(`${x.name || "An income"} grows ${Math.round(Number(x.growth) * 100)}% a year. Raises are usually typed as 3, not 0.03 or 300.`);
  }
  // next year: what is coming in a year from today, so a raise or a new job that starts in between counts and pay that has
  // ended by then does not (2026-11-02); what is going today gets its yearly raise, what starts in between does not yet
  const ahead = today ? addMonths(today, 12) : null;
  const nextYear = ahead ? items.filter((x) => x.period !== "once" && activeOn(x, ahead)).reduce((t, x) => t + (x.active ? x.nextYear : x.yearly), 0) : sum(active, "nextYear");
  return {
    items, active, count: items.length,
    monthly: sum(active, "monthly"), yearly: sum(active, "yearly"), nextYear,
    taxableYearly: sum(active.filter((x) => x.taxable !== false), "yearly"),
    untaxedYearly: sum(active.filter((x) => x.taxable === false), "yearly"),
    oneTime: sum(active, "oneTime"),
    heldMonthly: sum(active, "heldMonthly"),
    byType, byPerson: [...byPersonMap.values()].sort((a, b) => b.yearly - a.yearly),
    warnings,
  };
}

/**
 * rentAfterCostsOf(plan, { today }) -> Map(income id -> { monthly (the line's rent a month, as typed), afterCosts (a month: the
 * rent of places on Rental analysis after their empty months and running costs, plus any rest of the line), rentals (the
 * places it is the rent of), beforeCosts (a month: the part that is rent for a place not on Rental analysis, before its costs) })
 * for each rent line going today (round 8 batch 6, landlord-5: Income listed the condo's $2,100 with none of its $1,163 a month
 * of running costs). The line keeps the rent as typed: tax and the totals read it. The match of lines to places is the Federal
 * estimate's and the retirement plan's (property/rental running.js rentAfterCosts). Empty when nothing is rent.
 * A line that is one rental's whole rent (review 2026-11-06) also has: `afterCosts` from that rental's own figure (not scaled by
 * the line, so it matches Rental analysis), `rentalRent` (the rent a month there, when it differs from the line; else null),
 * `loanMonthly` and `afterLoan` (its loan payment a month and what is left after it; null with no loan), `loanInDebts`.
 */
export function rentAfterCostsOf(plan, params = {}) {
  const d = compute(plan, params);
  const rows = d.items.filter((x) => x.type === "rental" && x.active && x.period !== "once" && x.yearly > 0);
  const out = new Map();
  if (!rows.length) return out;
  const split = rentAfterCosts(plan, rows.map((x) => ({ name: x.name, yearly: x.yearly })));
  const list = rentalsOf(plan);
  rows.forEach((x, j) => {
    const m = split[j];
    // a line that is one rental's whole rent (the only line holding it) shows that rental's own figure, as Rental analysis and
    // the retirement plan do, and the rent there when the two differ (review 2026-11-06, money 10: $2,000 here against $2,100
    // there read $892, the figure scaled by the line); its loan payment then comes off too (UX 5: "$937 or $86?")
    const one = m.parts.length === 1 && m.parts[0].only ? m.parts[0] : null;
    const afterCosts = m.removed > 0.005 ? ((one ? one.noi : m.afterCosts) + m.left) / 12 : null;
    const loan = one ? loanPaymentOf(plan, list[one.index]) : null;
    out.set(x.id, { monthly: x.monthly, afterCosts, rentals: m.names, beforeCosts: m.left / 12, onPage: list.length > 0,
      rentalRent: one && one.take < one.rent - 0.5 ? one.rent / 12 : null,
      loanMonthly: afterCosts !== null && loan ? loan.monthly : null, afterLoan: afterCosts !== null && loan ? afterCosts - loan.monthly : null, loanInDebts: !!loan?.inDebts });
  });
  return out;
}

/** Pay above this a year, typed as anything but yearly, is asked about ("Did you mean a year?"): $40,000 a month. My choice. */
export const ASK_YEARLY_ABOVE = 480000;
/**
 * looksYearly(item) -> { yearly, asIf } | null: a salary not typed as yearly that comes to more than ASK_YEARLY_ABOVE a year, which
 * is usually a yearly salary typed under the default "Every month" ($72,000 a month = $864,000 a year). asIf: the amount read as a year.
 */
export function looksYearly(item) {
  if (!item || item.type !== "salary" || item.period === "annual" || item.period === "once") return null;
  const yearly = perYear(item.amount, item.period);
  return yearly > ASK_YEARLY_ABOVE ? { yearly, asIf: Number(item.amount) || 0 } : null;
}

const dayBefore = (iso) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/**
 * countedOn(income line) -> the careful figure a month the cash-flow pages plan with (Side income's "count on",
 * income[].countOn), or null. Only uneven pay that repeats (Self-employment / business, not one-time) has one, and only
 * below what the line brings in a month: a figure at or above it, or one left on a line whose kind or schedule changed,
 * counts for nothing (review 2026-11-02: it used to keep lowering the left-over figure, or raise the forecast above Income).
 */
export function countedOn(x) {
  if (!x || x.type !== "business" || x.period === "once") return null;
  const v = x.countOn;
  if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0) return null;
  return Number(v) < perMonth(x.amount, x.period) - 0.005 ? Number(v) : null;
}

/**
 * chainId(income line) -> the key everything filed under an income is kept by (Side income's typed months and careful
 * figure, a job's raises on Salary): the line's own id, or for the new pay a raise from a later date started
 * (`continues`, set by changeFrom's split), the id of the line it carries on. Review 2026-11-02, round 5: one record for
 * both halves of a split, so a change on either side applies to both and nothing typed before the start date is lost.
 */
export const chainId = (x) => (x?.continues ? String(x.continues) : x?.id);

/**
 * changeFrom(item, values, today) -> { split: true, old, next, change (a month, before tax) } | { split: false, item }: how an edit to an income is kept.
 * An income going today whose amount or how-often changes with a start date still to come (a raise from January) is split:
 * the pay on file runs until the day before (`old`, its own id, amount, name and dates kept) and the new pay starts that
 * day (`next`, the edit, with no id: the caller gives it one). Anything else changes the income in place. Before (round-4
 * finding, 2026-11-02), the whole income moved to the later date and the plan showed no pay until then. The same rule as
 * Life events' new pay (household/life-events, updatePay).
 * Review 2026-11-02, round 5: the pay that ends keeps the id, so the setup's own pay line (`setup-pay-...`, Get started's
 * pay question) still answers with today's pay, and what is filed under the id stays where it is. The new pay says which
 * line it carries on (`continues`: the first line of the chain, `chainId`), and the pages that keep something by income
 * read and write it by `chainId`, so both halves share one record. The careful figure (countOn) goes on with it, as an edit
 * in place keeps it (countedOn ignores it once it is at or above the new amount), unless the new pay is not repeating
 * business pay; a setup pay line or one marked `typicalYear` marks the new pay `typicalYear`, so the Forecast still spreads
 * "a typical year" over the months without the setup's id.
 */
export function changeFrom(item, values, today) {
  const merged = { ...item, ...values };
  const going = !!today && activeOn(item, today);
  const later = !!today && isValidDate(values.startDate) && values.startDate > today;
  const changed = Number(values.amount) !== Number(item.amount) || values.period !== item.period;
  if (!going || !later || !changed || (item.startDate && item.startDate > today)) return { split: false, item: merged };
  const old = { ...item, endDate: item.endDate && item.endDate < values.startDate ? item.endDate : dayBefore(values.startDate) };
  const { id, ...rest } = merged; void id;
  const next = { ...rest, startDate: values.startDate };
  const root = chainId(item);
  if (root) next.continues = root;
  if (next.type !== "business" || next.period === "once") delete next.countOn;
  if (item.typicalYear || String(item.id ?? "").startsWith("setup-pay-")) next.typicalYear = true;
  return { split: true, old, next, change: perMonth(values.amount, values.period) - perMonth(item.amount, item.period) };
}
