// modules/overview/next-best-action/compute.js -- PURE. Where the next spare dollar goes, in the
// well-known order (the r/personalfinance "prime directive", the Bogleheads' investing priorities):
// cover the bills, a starter emergency fund, the employer match, expensive debt, a full emergency
// fund, the HSA, an IRA, middling debt, the 401(k) to the limit, then goals and the rest. Each step
// says whether it is done, what is left, and, from the money left over each month after tax,
// spending and what already goes to savings, about when the spare money gets it done.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { addMonths } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";

/** Debt at this rate or above is "expensive": pay it before investing beyond the match (r/personalfinance wiki: above about 10%). */
export const HIGH_RATE = 0.10;
/** Debt from this rate up to HIGH_RATE is "moderate": after the IRA, before the rest of the 401(k) (the wiki's 4-5% line). Mortgages are left to the last step. */
export const MODERATE_RATE = 0.04;
/** Payroll taxes on pay: Social Security 6.2% up to the wage base and Medicare 1.45% (IRC §3101); self-employment 15.3% on 92.35% of profit (§1401, §1402). */
export const FICA = { ss: 0.062, medicare: 0.0145, selfEmployed: 0.153, seBase: 0.9235 };
/** How many months the simulation looks ahead. */
export const HORIZON_MONTHS = 120;

/**
 * compute(plan, { today }) -> {
 *   ready, missing,
 *   spare: { monthly, gross, federalTax, payrollTax, spending, retirementSaving, goalSaving } (all a month; spare may be negative),
 *   steps: [{ id, n, title, why, status: "done"|"now"|"later"|"check"|"skip", detail, gap (one-off amount left) | null, roomYearly | null,
 *             doneDate | null (a gap filled by the spare money), startDate | null (when an ongoing step starts getting money), monthly | null, go }],
 *   next: the first step that is not done (or null)
 * }
 * Steps that do not apply to this household (no 401(k), no HSA) are left out.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
  const missing = [];
  if (!inc.count) missing.push("what comes in, on the Income page");
  if (!exp.count) missing.push("what goes out, on the Expenses page");
  if (missing.length) return { ready: false, missing };

  // the money left each month: pay after federal and payroll tax, less spending, less what already goes to retirement and goals
  const fed = computeFederal(plan, { today });
  const base = fed.params.ssWageBase ?? Infinity;
  let payroll = 0;
  for (const p of new Set(inc.active.map((x) => x.personId))) {
    const wages = inc.active.filter((x) => x.personId === p && (x.type === "salary" || x.type === "bonus")).reduce((s, x) => s + x.yearly, 0);
    const business = inc.active.filter((x) => x.personId === p && x.type === "business").reduce((s, x) => s + x.yearly, 0);
    payroll += Math.min(wages, base) * FICA.ss + wages * FICA.medicare + Math.max(0, business) * FICA.seBase * FICA.selfEmployed;
  }
  const con = computeContributions(plan, { today });
  const gl = computeGoals(plan, { today });
  const goalSaving = gl.goals.filter((g) => g.status !== "done").reduce((s, g) => s + (Number(g.monthly) || 0), 0);
  const spare = { gross: inc.monthly, federalTax: fed.result.totalTax / 12, payrollTax: payroll / 12, spending: exp.monthly, retirementSaving: con.yearly / 12, goalSaving };
  spare.monthly = spare.gross - spare.federalTax - spare.payrollTax - spare.spending - spare.retirementSaving - spare.goalSaving;

  const liq = computeLiquidity(plan, { today });
  const debts = computeLiabilities(plan, { today }).rows.filter((r) => r.owed > 0);
  const accounts = plan.accounts ?? [];
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const L = con.limits.kinds;
  const steps = [];
  const add = (s) => steps.push({ gap: null, roomYearly: null, doneDate: null, startDate: null, monthly: null, ...s });

  // 0. the bills
  add({ id: "bills", title: "Spend less than comes in", why: "Nothing else works until the month ends with money left.", status: spare.monthly >= 0 ? "done" : "now",
    detail: spare.monthly >= 0 ? `About ${money(spare.monthly)} a month is left after tax, spending and what already goes to savings.` : `About ${money(-spare.monthly)} a month more goes out than comes in, after tax and saving. Trim spending or pause a goal first.`, go: ["cashflow", "expenses"] });

  // 1. a starter emergency fund: one month of must-pay bills in cash you can use
  const essential = liq.expenses?.essentialMonthly ?? exp.essentialMonthly;
  const starterGap = Math.max(0, essential - liq.now);
  add({ id: "starter", title: "A starter emergency fund", why: "One month of must-pay bills in cash, so a surprise does not land on a credit card.", status: starterGap <= 0 ? "done" : "now", gap: starterGap,
    detail: starterGap <= 0 ? `Usable cash ${money(liq.now)} covers a month of must-pay bills (${money(essential)}).` : `${money(starterGap)} more in usable cash reaches one month of must-pay bills (${money(essential)}).`, go: ["balance", "liquidity"] });

  // 2. the employer match
  const k401 = accounts.filter((a) => a.type === "401k");
  if (k401.length) {
    const owners = adults.filter((p) => k401.some((a) => a.ownerId === p.id) || (p.role === "self" && k401.some((a) => !a.ownerId)));
    const working = owners.filter((p) => inc.active.some((x) => x.personId === p.id && (x.type === "salary" || x.type === "bonus")));
    const contributing = working.filter((p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id && k401.some((a) => a.id === c.accountId)));
    const matched = contributing.filter((p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id && Number(c.employerMatch) > 0));
    const missingMatch = working.filter((p) => !contributing.includes(p));
    if (working.length) add({ id: "match", title: "Get the whole employer match", why: "A match is an instant 50% or 100% return; nothing else comes close.", status: missingMatch.length ? "check" : "done",
      detail: missingMatch.length ? `${missingMatch.map((p) => p.name).join(" and ")} ${missingMatch.length === 1 ? "has" : "have"} a 401(k) and pay but no contribution on file. Check whether the employer matches, and put in at least enough to get all of it.` : `${matched.map((p) => p.name).join(" and ") || "Everyone with a 401(k)"} ${matched.length > 1 ? "put" : "puts"} money in${matched.length ? " with a match" : ""}. If the employer would match more, raise the contribution to get every dollar.`, go: ["retirement", "contributions"] });
  }

  // 3. expensive debt, most expensive first (mortgages left out)
  const high = debts.filter((d) => d.rate !== null && d.rate >= HIGH_RATE && d.type !== "mortgage").sort((a, b) => b.rate - a.rate);
  const highGap = high.reduce((s, d) => s + d.owed, 0);
  add({ id: "high-debt", title: "Pay off expensive debt", why: `Debt at ${Math.round(HIGH_RATE * 100)}% or more costs more than investing is likely to earn.`, status: highGap > 0 ? "now" : "done", gap: highGap,
    detail: highGap > 0 ? `${high.map((d) => `${d.name} ${money(d.owed)} at ${pct(d.rate)}`).join(", ")}: every extra dollar here earns the rate for sure.` : `No debt at ${Math.round(HIGH_RATE * 100)}% or more.`, go: ["debt", "payoff"] });

  // 4. the full emergency fund
  const fullGap = Math.max(0, liq.gap ?? 0);
  add({ id: "full-fund", title: `A full emergency fund (${liq.targetMonths} months)`, why: "Enough must-pay bills in cash to ride out a job loss without selling investments at a bad time.", status: fullGap > 0 ? "now" : "done", gap: fullGap,
    detail: fullGap > 0 ? `${money(fullGap)} more reaches ${liq.targetMonths} months of must-pay bills (${money(liq.target)}).` : `Usable cash covers ${Math.round((liq.runwayMonths ?? 0) * 10) / 10} months; the plan aims for ${liq.targetMonths}.`, go: ["balance", "liquidity"] });

  // 5. the HSA, for those who have one
  const hsaUsed = (con.byPerson ?? []).flatMap((p) => p.limits).filter((l) => l.kind === "hsa").reduce((s, l) => s + l.used, 0);
  if (accounts.some((a) => a.type === "hsa")) {
    const family = plan.taxes?.hsa?.coverage === "family";
    const hsaLimit = family ? L.hsa.family : L.hsa.limit;
    const room = Math.max(0, hsaLimit - hsaUsed);
    add({ id: "hsa", title: "Fill the health savings account", why: "Tax-free going in, growing and coming out for health costs: the only triple tax break.", status: room > 0 ? "now" : "done", roomYearly: room,
      detail: room > 0 ? `${money(room)} of room left this year (limit ${money(hsaLimit)}, ${family ? "family" : "self-only"} cover).` : "At this year's limit.", go: ["taxes", "hsa-fsa"] });
  }

  // 6. an IRA for each adult with earned income
  const earners = adults.filter((p) => inc.active.some((x) => x.personId === p.id && ["salary", "bonus", "business"].includes(x.type)));
  const iraRoom = earners.map((p) => { const used = (con.byPerson.find((q) => q.personId === p.id)?.limits ?? []).filter((l) => l.kind === "ira").reduce((s, l) => s + l.used, 0); const age = con.byPerson.find((q) => q.personId === p.id)?.age; const limit = L.ira.limit + (age !== null && age !== undefined && age >= L.ira.catchUpAge ? L.ira.catchUp : 0); return { p, room: Math.max(0, limit - used), limit }; });
  const iraTotal = iraRoom.reduce((s, x) => s + x.room, 0);
  if (earners.length) add({ id: "ira", title: "An IRA for each of you", why: "Roth money grows tax-free for good; for most people early in a career it is the best next account.", status: iraTotal > 0 ? "now" : "done", roomYearly: iraTotal,
    detail: iraTotal > 0 ? `${iraRoom.filter((x) => x.room > 0).map((x) => `${x.p.name} ${money(x.room)}`).join(", ")} of room left this year (limit ${money(iraRoom[0].limit)} each). Above the income limit a Roth needs the backdoor route.` : "Every IRA is at this year's limit.", go: ["investments", "limits"] });

  // 7. moderate debt (not the mortgage)
  const mid = debts.filter((d) => d.rate !== null && d.rate >= MODERATE_RATE && d.rate < HIGH_RATE && d.type !== "mortgage").sort((a, b) => b.rate - a.rate);
  const midGap = mid.reduce((s, d) => s + d.owed, 0);
  if (mid.length) add({ id: "mid-debt", title: "Pay down middling debt", why: `Debt at ${Math.round(MODERATE_RATE * 100)}% to ${Math.round(HIGH_RATE * 100)}%: paying it is a sure return at that rate.`, status: "now", gap: midGap,
    detail: `${mid.map((d) => `${d.name} ${money(d.owed)} at ${pct(d.rate)}`).join(", ")}.`, go: ["debt", "payoff"] });

  // 8. the 401(k) to the limit
  if (k401.length) {
    const k = (con.byPerson ?? []).map((p) => { const l = p.limits.find((x) => x.kind === "401k"); return l ? { name: p.name, room: Math.max(0, l.limit - l.used), limit: l.limit } : null; }).filter(Boolean);
    const room = k.reduce((s, x) => s + x.room, 0);
    if (k.length) add({ id: "max-401k", title: "The 401(k) to the limit", why: "Tax-sheltered growth on every dollar the law allows.", status: room > 0 ? "now" : "done", roomYearly: room,
      detail: room > 0 ? `${k.filter((x) => x.room > 0).map((x) => `${x.name} ${money(x.room)}`).join(", ")} of room left this year (limit ${money(k[0].limit)}).` : "At this year's limit.", go: ["investments", "limits"] });
  }

  // 9. goals that are behind: the extra a month they need
  const behind = gl.goals.filter((g) => g.status === "behind" || g.status === "past due");
  const goalExtra = behind.reduce((s, g) => s + Math.max(0, g.neededMonthly - (Number(g.monthly) || 0)), 0);
  if (gl.goals.length) add({ id: "goals", title: "Catch up the goals", why: "What you are saving for, by when: behind now means short later.", status: goalExtra > 0 ? "now" : "done", roomYearly: goalExtra * 12,
    detail: goalExtra > 0 ? `${behind.map((g) => g.name).join(", ")}: about ${money(goalExtra)} a month more in all puts them on track.` : "Every goal with a date is on track.", go: ["goals", "goals"] });

  // 10. the rest: a choice
  const mortgage = debts.find((d) => d.type === "mortgage");
  add({ id: "rest", title: "Then: your choice", why: "Past this point there is no wrong answer, only priorities.", status: "later",
    detail: `Invest in a brokerage account, pay the mortgage down early${mortgage?.rate ? ` (a sure ${pct(mortgage.rate)})` : ""}, a 529 for a child, retire earlier, give. The Goal seek page shows what each would buy.`, go: ["scenarios", "goal-seek"] });

  // the spare money, month by month: one-off gaps in order, then this year's room, ongoing
  const avail0 = Math.max(0, spare.monthly);
  const left = steps.map((s) => (s.status === "now" && s.gap ? s.gap : 0));
  for (let m = 0; m < HORIZON_MONTHS && avail0 > 0; m++) {
    let avail = avail0;
    steps.forEach((s, i) => {
      if (avail <= 0 || s.status !== "now") return;
      if (s.gap) {
        if (left[i] <= 0) return;
        const put = Math.min(left[i], avail); left[i] -= put; avail -= put;
        if (left[i] <= 0.5 && !s.doneDate) s.doneDate = addMonths(today, m + 1);
      } else if (s.roomYearly) {
        const put = Math.min(s.roomYearly / 12, avail); avail -= put;
        if (put > 0 && !s.startDate) { s.startDate = addMonths(today, m); s.monthly = put; }
      }
    });
  }
  // number the steps; the first one not done is the next best action
  steps.forEach((s, i) => { s.n = i; });
  const next = steps.find((s) => s.status === "now" || s.status === "check") ?? null;
  if (next) for (const s of steps) if (s !== next && s.status === "now") s.status = "later";
  return { ready: true, missing: [], spare, steps, next };
}

function pct(x) { return `${(Math.round(x * 1000) / 10).toFixed(1)}%`; }
