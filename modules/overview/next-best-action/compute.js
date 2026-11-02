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
import { protectionGaps } from "../../insurance/life-needs/compute.js";
import { savingVerdict, drawingAsPlanned } from "../../retirement/projection/compute.js";
import { compute as computeLimits } from "../../investments/limits/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
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
 *   spare: { monthly, gross, federalTax, payrollTax, spending, retirementSaving, goalSaving, debtExtra } (all a month; spare may be negative;
 *            debtExtra: the extra a month the saved debt plan pays on top of the required payments, Pay off debts' `extra`),
 *   debtPlan: { extra, names, ids, until, months } | null (that saved extra: the debts it goes to, and when the last of them is gone),
 *   steps: [{ id, n, title, why, status: "done"|"now"|"later"|"check"|"skip"|"underway", detail, gap (one-off amount left) | null, roomYearly | null,
 *             underway: { extra, names, until } (a debt step the saved debt plan already pays off: no spare money goes to it),
 *             doneDate | null (a gap filled by the spare money), startDate | null (when an ongoing step starts getting money), monthly | null, go,
 *             ask (the match step: [{ personId, name, accounts: [401(k) ids] }] with pay, a 401(k) and nothing going in) }],
 *   next: the first step that is not done (or null)
 *   drawing: a retired household drawing from savings as planned ({ verdict, spendingMonthly, affordableMonthly }) or null
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
  // the saved debt plan (Pay off debts): an extra a month on top of the required payments is money already spoken for, until
  // the debts it is aimed at are gone (all of them, when it is aimed at none: it rolls from one to the next)
  let pay = null;
  try { pay = computePayoff(plan, { today }); } catch { pay = null; }
  const debtPlan = pay?.hasData && pay.extra > 0 ? (() => {
    const ids = pay.targets.length ? pay.targets : pay.debts.map((x) => x.id);
    const ends = ids.map((id) => pay.chosen.debts.find((x) => x.id === id)).filter(Boolean);
    const last = ends.length === ids.length && ends.every((x) => Number.isFinite(x.months)) ? ends.reduce((a, b) => (b.months > a.months ? b : a)) : null;
    return { extra: pay.extra, ids, names: ids.map((id) => pay.debts.find((x) => x.id === id)?.name).filter(Boolean), until: last?.endDate ?? null, months: last ? last.months : null };
  })() : null;
  spare.debtExtra = debtPlan ? debtPlan.extra : 0;
  spare.monthly = spare.gross - spare.federalTax - spare.payrollTax - spare.spending - spare.retirementSaving - spare.goalSaving - spare.debtExtra;

  const liq = computeLiquidity(plan, { today });
  const debts = computeLiabilities(plan, { today }).rows.filter((r) => r.owed > 0);
  const accounts = plan.accounts ?? [];
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const L = con.limits.kinds;
  const steps = [];
  const add = (s) => steps.push({ gap: null, roomYearly: null, doneDate: null, startDate: null, monthly: null, ...s });

  // 0. the bills. A retired household living on its savings as the plan intends is not overspending: it is done
  let drawing = null;
  if (spare.monthly < 0) { try { drawing = drawingAsPlanned(plan, { today }); } catch { drawing = null; } }
  if (drawing) add({ id: "bills", title: "Spend within what the plan can carry", why: "In retirement the savings pay part of each month: that is what they are for.", status: "done",
    detail: `About ${money(-spare.monthly)} a month comes from savings, as planned. The plan can carry about ${money(drawing.affordableMonthly)} a month of spending in all, and the money lasts (Will the money last?).`, go: ["retirement", "projection"] });
  else add({ id: "bills", title: "Spend less than comes in", why: "Nothing else works until the month ends with money left.", status: spare.monthly >= 0 ? "done" : "now",
    detail: spare.monthly >= 0 ? (spare.debtExtra && spare.monthly < 5 ? `Every dollar has a job: after tax, spending and what already goes to savings, the rest is the ${money(spare.debtExtra)} a month extra on debts.` : `About ${money(spare.monthly)} a month is left after tax, spending and what already goes to savings${spare.debtExtra ? ` and the ${money(spare.debtExtra)} extra on debts` : ""}.`)
      : `About ${money(-spare.monthly)} a month more goes out than comes in, after tax and saving${spare.debtExtra ? `, counting the ${money(spare.debtExtra)} a month extra on debts (Pay off debts)` : ""}. Trim spending${spare.debtExtra ? ", lower that extra" : ""} or pause a goal first.`, go: ["cashflow", "expenses"] });

  // 1. a starter emergency fund: one month of must-pay bills in cash you can use
  const essential = liq.expenses?.essentialMonthly ?? exp.essentialMonthly;
  // under half a dollar short is done: the page shows whole dollars, so typing the amount it asks for must finish the step
  const starterGap = essential - liq.now < 0.5 ? 0 : essential - liq.now;
  add({ id: "starter", title: "A starter emergency fund", why: "One month of must-pay bills in cash, so a surprise does not land on a credit card.", status: starterGap <= 0 ? "done" : "now", gap: starterGap,
    detail: starterGap <= 0 ? `Usable cash ${money(liq.now)} covers a month of must-pay bills (${money(essential)}).` : `${money(starterGap)} more in usable cash reaches one month of must-pay bills (${money(essential)}).`, go: ["balance", "liquidity"] });

  // 1b. the people who count on an earner: life cover for the gap Life insurance needs works out (its own answer: the
  // survivor's plan kept whole), right after the starter cushion; an action, not a sum to save, so no gap is filled
  const gaps = protectionGaps(plan, { today });
  // the words come from Life insurance needs (protectionGaps' title and sentence), so every page says the same thing
  if (gaps.length) add({ id: "protect", title: "Protect the people who count on you", why: "If an earner died, life insurance keeps the family's plan whole. Term cover is the cheap way to buy it.", status: "now", gap: null,
    people: gaps.map((g) => ({ personId: g.id, name: g.name, who: g.who, whose: g.whose, gap: g.gap, cover: g.cover, until: g.until, depends: g.depends, ending: g.endsSoon.length > 0, title: g.title, sentence: g.sentence })),
    detail: gaps.map((g) => g.sentence).join(" ") + " Cover you already have, through work too, goes on Policies.",
    go: ["insurance", "life-needs"] });

  // 2. the employer match: a 401(k) marked as from a job left (`formerJob`) takes no new money, and a person who said their
  // job has no plan or no match (`retirement.workPlans[id].match === false`) has nothing to check
  const k401 = accounts.filter((a) => a.type === "401k");
  const atWork = k401.filter((a) => !a.formerJob);
  // match tiers typed on Open enrollment (career/benefits) say it more exactly; without them, the answer on Contributions
  const noMatch = (id) => { const t = plan.whatIfs?.benefits?.[id]?.matchTiers; return Array.isArray(t) ? !t.some((x) => Number(x.rate) > 0 && Number(x.upTo) > 0) : plan.retirement?.workPlans?.[id]?.match === false; };
  const paid = (p) => inc.active.some((x) => x.personId === p.id && (x.type === "salary" || x.type === "bonus"));
  const ownOf = (p) => k401.filter((a) => a.ownerId === p.id || (p.role === "self" && !a.ownerId));
  // a paid adult whose every 401(k) is from a job left: the job now may have a plan with a match, so it is still asked
  // (unless they said there is none); `newJob` in the ask, with no accounts to put money in yet
  const leftOnly = adults.filter((p) => { const own = ownOf(p); return own.length && own.every((a) => a.formerJob) && paid(p) && !noMatch(p.id); });
  if (atWork.length || leftOnly.length) {
    const owners = adults.filter((p) => atWork.some((a) => a.ownerId === p.id) || (p.role === "self" && atWork.some((a) => !a.ownerId)));
    const working = owners.filter((p) => !noMatch(p.id) && paid(p));
    const contributing = working.filter((p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id && k401.some((a) => a.id === c.accountId)));
    const matched = contributing.filter((p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id && Number(c.employerMatch) > 0));
    const missingMatch = working.filter((p) => !contributing.includes(p));
    const toAsk = [...missingMatch, ...leftOnly];
    const left = leftOnly.length ? ` ${leftOnly.map((p) => p.name).join(" and ")}'s 401(k) is from a job left: check whether the job now has a plan with a match.` : "";
    if (working.length || leftOnly.length) add({ id: "match", title: "Get the whole employer match", why: "A match is an instant 50% or 100% return; nothing else comes close.", status: toAsk.length ? "check" : "done",
      detail: toAsk.length ? `${missingMatch.length ? `${missingMatch.map((p) => p.name).join(" and ")} ${missingMatch.length === 1 ? "has" : "have"} a 401(k) and pay but no contribution on file. Check whether the employer matches, and put in at least enough to get all of it. If the 401(k) is from a job left, or there is no match, say so on Retirement contributions.` : ""}${left}`.trim() : `${matched.map((p) => p.name).join(" and ") || "Everyone with a 401(k)"} ${matched.length > 1 ? "put" : "puts"} money in${matched.length ? " with a match" : ""}. If the employer would match more, raise the contribution to get every dollar.`,
      ask: [...missingMatch.map((p) => ({ personId: p.id, name: p.name, accounts: atWork.filter((a) => a.ownerId === p.id || (p.role === "self" && !a.ownerId)).map((a) => a.id) })),
        ...leftOnly.map((p) => ({ personId: p.id, name: p.name, accounts: [], newJob: true, old: ownOf(p).map((a) => a.id) }))], go: ["retirement", "contributions"] });
  }

  // 3. expensive debt, most expensive first (mortgages left out)
  // a debt the saved debt plan's extra reaches is being paid off already: the step is under way, with the month the last
  // of them is gone (Pay off debts' own date), and no spare money is counted for it twice; one it does not reach stays to do
  const reached = (d) => !!debtPlan && debtPlan.ids.includes(d.id) && Number.isFinite(pay.chosen.debts.find((x) => x.id === d.id)?.months);
  const debtStep = (list) => {
    const on = list.filter(reached), off = list.filter((d) => !reached(d));
    const ends = on.map((d) => pay.chosen.debts.find((x) => x.id === d.id)).sort((a, b) => a.months - b.months);
    const until = ends.length ? ends[ends.length - 1].endDate : null;
    const names = on.map((d) => d.name);
    const sentence = on.length && until ? `${money(debtPlan.extra)} a month extra already goes to ${listWords(names)} (Pay off debts), on top of the required payments: ${on.length === 1 ? "it is" : "they are"} gone by about ${monthWords(until)}.` : "";
    return { on, off, until, names, sentence, gap: off.reduce((s, d) => s + d.owed, 0) };
  };
  const high = debts.filter((d) => d.rate !== null && d.rate >= HIGH_RATE && d.type !== "mortgage").sort((a, b) => b.rate - a.rate);
  const hs = debtStep(high);
  const highGap = hs.gap;
  const highWords = (list) => `${list.map((d) => `${d.name} ${money(d.owed)} at ${pct(d.rate)}`).join(", ")}`;
  if (high.length && !hs.off.length && hs.until) add({ id: "high-debt", title: "Pay off expensive debt", why: `Debt at ${Math.round(HIGH_RATE * 100)}% or more costs more than investing is likely to earn.`, status: "underway", gap: 0,
    underway: { extra: debtPlan.extra, names: hs.names, until: hs.until }, detail: `Under way. ${hs.sentence}`, go: ["debt", "payoff"] });
  else add({ id: "high-debt", title: "Pay off expensive debt", why: `Debt at ${Math.round(HIGH_RATE * 100)}% or more costs more than investing is likely to earn.`, status: highGap > 0 ? "now" : "done", gap: highGap,
    detail: highGap > 0 ? `${highWords(hs.off)}: every extra dollar here earns the rate for sure.${hs.sentence ? ` ${hs.sentence}` : ""}` : `No debt at ${Math.round(HIGH_RATE * 100)}% or more.`, go: ["debt", "payoff"] });

  // 4. the full emergency fund
  const fullGap = (liq.gap ?? 0) < 0.5 ? 0 : liq.gap;
  add({ id: "full-fund", title: `A full emergency fund (${liq.targetMonths} months)`, why: "Enough must-pay bills in cash to ride out a job loss without selling investments at a bad time.", status: fullGap > 0 ? "now" : "done", gap: fullGap,
    detail: fullGap > 0 ? `${money(fullGap)} more reaches ${liq.targetMonths} months of must-pay bills (${money(liq.target)}).` : `Usable cash covers ${Math.round((liq.runwayMonths ?? 0) * 10) / 10} months; the plan aims for ${liq.targetMonths}.`, go: ["balance", "liquidity"] });

  // 5. the HSA, for those who have one and a high-deductible plan this year (none: nobody may put money in, IRC 223(c)(1))
  const hsaUsed = (con.byPerson ?? []).flatMap((p) => p.limits).filter((l) => l.kind === "hsa").reduce((s, l) => s + l.used, 0);
  if (accounts.some((a) => a.type === "hsa") && con.hsa?.coverage !== "none") {
    const family = plan.taxes?.hsa?.coverage === "family";
    const hsaLimit = family ? L.hsa.family : L.hsa.limit;
    const room = Math.max(0, hsaLimit - hsaUsed);
    add({ id: "hsa", title: "Fill the health savings account", why: "Tax-free going in, growing and coming out for health costs: the only triple tax break.", status: room > 0 ? "now" : "done", roomYearly: room,
      detail: room > 0 ? `${money(room)} of room left this year (limit ${money(hsaLimit)}, ${family ? "family" : "self-only"} cover).` : "At this year's limit.", go: ["taxes", "hsa-fsa"] });
  }

  // 6. an IRA for each adult with earned income
  const earners = adults.filter((p) => inc.active.some((x) => x.personId === p.id && ["salary", "bonus", "business"].includes(x.type)));
  // the plan's own answer to "are we saving enough?" (Will the money last?): when it already lasts, more saving is a choice
  let saving = null;
  try { saving = savingVerdict(plan, { today }); } catch { saving = null; }
  const optional = saving?.verdict === "on track" ? "Optional: your plan already lasts (Will the money last?); more saving buys an earlier retirement or more to spend. " : "";
  const iraRoom = earners.map((p) => { const used = (con.byPerson.find((q) => q.personId === p.id)?.limits ?? []).filter((l) => l.kind === "ira").reduce((s, l) => s + l.used, 0); const age = con.byPerson.find((q) => q.personId === p.id)?.age; const limit = L.ira.limit + (age !== null && age !== undefined && age >= L.ira.catchUpAge ? L.ira.catchUp : 0); return { p, room: Math.max(0, limit - used), limit }; });
  const iraTotal = iraRoom.reduce((s, x) => s + x.room, 0);
  // the backdoor route is said only when this household's income is in or over the Roth limit range (Contribution limits)
  let rothNear = false;
  try { const r = computeLimits(plan, { today }).roth; rothNear = !!r && (r.status === "partial" || r.status === "over"); } catch { rothNear = false; }
  if (earners.length) add({ id: "ira", title: "An IRA for each of you", why: `${optional}Roth money grows tax-free for good, and a traditional IRA can cut this year's tax. Either way the room is lost for any year you skip.`, status: iraTotal > 0 ? "now" : "done", roomYearly: iraTotal, optional: !!optional,
    detail: iraTotal > 0 ? `${iraRoom.filter((x) => x.room > 0).map((x) => `${x.p.name} ${money(x.room)}`).join(", ")} of room left this year (limit ${money(iraRoom[0].limit)} each).${rothNear ? " Your income is at the Roth limit: a Roth then needs the backdoor route (a traditional IRA turned into a Roth)." : ""}` : "Every IRA is at this year's limit.", go: ["investments", "limits"] });

  // 7. moderate debt (not the mortgage)
  const mid = debts.filter((d) => d.rate !== null && d.rate >= MODERATE_RATE && d.rate < HIGH_RATE && d.type !== "mortgage").sort((a, b) => b.rate - a.rate);
  const ms = debtStep(mid);
  const midWhy = `Debt at ${Math.round(MODERATE_RATE * 100)}% to ${Math.round(HIGH_RATE * 100)}%: paying it is a sure return at that rate.`;
  if (mid.length && !ms.off.length && ms.until) add({ id: "mid-debt", title: "Pay down middling debt", why: midWhy, status: "underway", gap: 0,
    underway: { extra: debtPlan.extra, names: ms.names, until: ms.until }, detail: `Under way. ${ms.sentence}`, go: ["debt", "payoff"] });
  else if (mid.length) add({ id: "mid-debt", title: "Pay down middling debt", why: midWhy, status: "now", gap: ms.gap,
    detail: `${highWords(ms.off)}.${ms.sentence ? ` ${ms.sentence}` : ""}`, go: ["debt", "payoff"] });

  // 8. the 401(k) to the limit
  if (k401.length) {
    // only someone with pay can put money into a 401(k): a retired household gets no "fill the 401(k)" step
    const k = (con.byPerson ?? []).filter((p) => earners.some((e) => e.id === p.personId)).map((p) => { const l = p.limits.find((x) => x.kind === "401k"); return l ? { name: p.name, room: Math.max(0, l.limit - l.used), limit: l.limit } : null; }).filter(Boolean);
    const room = k.reduce((s, x) => s + x.room, 0);
    if (k.length) add({ id: "max-401k", title: "The 401(k) to the limit", why: `${optional}Tax-sheltered growth on every dollar the law allows.`, optional: !!optional, status: room > 0 ? "now" : "done", roomYearly: room,
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
  // once the saved debt plan's debts are gone, its extra is free again and joins the spare money
  const freed = debtPlan && debtPlan.months !== null ? debtPlan.months : Infinity;
  for (let m = 0; m < HORIZON_MONTHS && (avail0 > 0 || freed < HORIZON_MONTHS); m++) {
    let avail = Math.max(0, spare.monthly + (m >= freed ? debtPlan.extra : 0));
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
  return { ready: true, missing: [], spare, steps, next, drawing, debtPlan };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2028-01-15" -> "January 2028" (pure: no locale). */
export const monthWords = (iso) => (iso ? `${MONTHS[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}` : "");
const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
function pct(x) { return `${(Math.round(x * 1000) / 10).toFixed(1)}%`; }
