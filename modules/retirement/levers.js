// modules/retirement/levers.js -- PURE, shared like careful.js and needs.js. "What this rests on": the numbers the answer on
// Will the money last? rests on, whose each one is (yours, our guess, the usual figure, not counted), and what one sensible
// change to each would do to that answer, in the answer's own unit (the age the money runs out, or lasts to the end).
// Owner's request 2026-11-11 (spec rv/spec.md part A, decisions D-A1 to D-A7). Formulas and sources: ./projection/README.md
// "What this rests on (2026-11-11)".
//
//   leverList(plan, { today, spare })   -> the rows with their tags and values, no projections (the hero's count, the
//                                          "Before your change" line)
//   leverSteps(plan, { today, spare })  -> a generator for careful.js whenWorked: one projection per step, then the rows with
//                                          their effects, ordered, the first five shown and the rest folded
//   leverRows(plan, { today, spare })   -> the same, worked out at once (tests, said = done)
//   answerOf(plan, { today })           -> { lasts, age, endAge, endReal } the answer itself (one projection) or null
//   answerWords(a, money)               -> "runs out at 70" | "lasts to the end (age 95)"
//   workAlt(plan, pid, { today })       -> the work-saving alternative the card shows (Contributions' ?add=<pid> fills it in)
//   workLanding / matchLanding          -> what Contributions' ?add=<pid> and ?match=<rowId> open (L3)
//   matchChecks(plan, { today })        -> rows with own money in, no match on them and the match never answered (L3)
//   answerChangeWords(before, after)    -> "now runs out at 76 (was 66)" after a save (L3, L5)
//   mixAtRetirement(d) / mixWords(m)    -> the money when retirement starts by when its tax is paid (L6, D-C4)
//   leftoverAnswer / leftoverStanding / applyLeftover / lowerLeftover / leftoverAccounts -> the money left over, answered in place (L4)
//
// `spare` is Next best action's `spare` (the money left over each month: its `monthly`, the Dashboard's figure), handed in by the view: this file must not import
// Next best action, which imports the projection's savingVerdict (a loop). It never changes the plan it is given.
import { buildInputs, saveSpendingFigure, savingsUnknown, workingNow, BUCKET_OF, compute as projection } from "./projection/compute.js";
import { project } from "../../core/math/retirement.js";
import { isGuess, guessesTouching } from "../../core/estimate/index.js";
import { usualShare, jobPayOf, matchTerms, compLimit, deferralLimit, ageInYear, typedTiers } from "../overview/guesses/estimators/saving.js";
import { compute as socialSecurity } from "./social-security/compute.js";
import { ASSUMPTIONS, RETURN_PRESETS, INFLATION_PRESETS } from "../system/assumptions/compute.js";
import { limitKind, applyMatchAtWork } from "./contributions/compute.js";
import { daysBetween } from "../../core/math/dates.js";
import { perYear } from "../../core/math/periods.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor } from "../../core/words.js";

/** The tags, in the order the card lists them (D-A2): not counted, our guess, the usual figure, yours. */
export const TAGS = { missing: "Not counted", guess: "Our guess", usual: "Usual figure", yours: "Yours" };
const GROUP = { missing: 0, guess: 1, usual: 2, yours: 3 };
/** Rows shown before the fold (D-A2). */
export const SHOWN = 5;
/** Careful, middle and hopeful returns for stocks: Assumptions' own chips (L5; the forecasts beside them and their dates are Assumptions' FORECASTS). */
export const GROWTH_PRESETS = RETURN_PRESETS;
/** How fast prices rise: the lower and higher chips around ours (3%) on Assumptions. */
export const PRICE_STEPS = INFLATION_PRESETS.filter((x) => !x.ours).map((x) => x.value);
/** The leftover row needs at least this much a month (spec table, `leftover`): under it there is no row and nothing "not counted". */
export const LEFTOVER_MIN = 50;
/** Stopping work later: two years, never past 75. */
export const STOP_STEP = 2, STOP_MAX = 75;
/** Planning the money to last longer: five years more. */
export const PLAN_TO_STEP = 5;
/** The share in stocks once retired, 20 points each way (Sensitivity's NUDGE.mix). */
export const MIX_STEP = 0.2;
/** Spending in retirement: 10% less. */
export const SPEND_STEP = 0.1;
/** A review of the Assumptions page is good for a year (system/assumptions compute `stale`). */
const REVIEW_DAYS = 365;

const L = (o, k) => (Array.isArray(o?.[k]) ? o[k] : []);
const dollars = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const pctWords = (x) => `${Number((x * 100).toFixed(1))}%`;
const round2 = (n) => Math.round(n * 100) / 100;
const yearOf = (today) => Number(String(today ?? "").slice(0, 4)) || new Date().getFullYear();

// ---- the answer itself, and its words (D-A1) --------------------------------------------------------------------------
/** One projection of engine inputs at average markets: { lasts, age (the first adult's age the year it runs out), endAge, endReal }. */
export function outcomeOf(inputs) {
  const r = project(inputs);
  const last = r.rows.at(-1);
  return { lasts: !!r.success, age: r.success ? null : r.failAge, endAge: last?.ages?.[0] ?? null, endReal: last?.totalReal ?? 0 };
}
/** answerOf(plan, { today }) -> the answer on Will the money last? in its own unit, or null when the plan cannot be run yet. */
export function answerOf(plan, { today } = {}) {
  let b = null;
  try { b = buildInputs(plan, { today }); } catch { b = null; }
  return b?.inputs ? outcomeOf(b.inputs) : null;
}
/** Money to a round figure for an effect line: $100s under $10,000, else $1,000s. */
const roundMoney = (n) => (Math.abs(n) >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100);
/** "runs out at 70" | "lasts to the end (age 95)"; `would` says it as a question's answer ("the money would run out at 70"). */
export function answerWords(a, money = dollars, { would = false, left = false } = {}) {
  if (!a) return "";
  if (!a.lasts) return would ? `it would run out at ${a.age}` : `runs out at ${a.age}`;
  const end = would ? `it would last to the end (age ${a.endAge})` : `lasts to the end (age ${a.endAge})`;
  return left && a.endReal > 0.5 ? `${end}, about ${money(roundMoney(a.endReal))} left in today's dollars` : end;
}
/** What one change does, against the answer as it is: the run-out age, or with both lasting, the money left at the end. */
export function effectWords(o, base, money = dollars, { would = false } = {}) {
  if (!o) return null;
  if (!o.lasts || !base?.lasts) return answerWords(o, money, { would });
  const diff = o.endReal - base.endReal, r = roundMoney(Math.abs(diff));
  const end = would ? "it would last to the end" : "lasts to the end";
  if (r < 100) return `${end}, about the same left at ${o.endAge}`;
  return `${end}, with about ${money(r)} ${diff > 0 ? "more" : "less"} left at ${o.endAge} (today's dollars)`;
}
/**
 * The size of a change (D-A2), in years: (alt lasts ? its end age + 1 : the age it runs out) - (the same for the answer as it
 * is). When both last: the change in the money left at the end, in today's dollars, over a year of spending.
 */
export function scoreOf(o, base, spendingYearly) {
  if (!o || !base) return 0;
  if (o.lasts && base.lasts) return (o.endReal - base.endReal) / Math.max(1, spendingYearly);
  return (o.lasts ? o.endAge + 1 : o.age) - (base.lasts ? base.endAge + 1 : base.age);
}

// ---- who, and the usual figures (D-A4) ----------------------------------------------------------------------------------
/** The adult a household-wide answer is about (the lead earner, goal seek's leadAdult): the first adult still at work. */
export function leadEarner(plan, inputs, today) {
  const adults = L(plan?.household, "people").filter((p) => p.role !== "dependent");
  try { const w = workingNow(plan, inputs, today); if (w.lead) return adults.find((p) => p.id === w.lead.id) ?? null; } catch { /* below */ }
  return null;
}
const tierMatch = (d, tiers) => { let prev = 0, m = 0; for (const t of [...tiers].sort((a, b) => a.upTo - b.upTo)) { m += Math.max(0, Math.min(d, t.upTo) - prev) * t.rate; prev = Math.max(prev, t.upTo); } return m; };
/**
 * The usual match a year for one person putting in `ownYearly` (the contrib.match guess, overview/guesses/estimators/saving.js):
 * Vanguard's median match value, 4% of pay, times the share of the full match earned (it takes about 6% of pay in), on the pay a
 * plan counts (IRC 401(a)(17)); the formula typed on Work benefits instead when there is one. Rounded as the guess is: whole
 * $10 a month, twelve of them.
 */
export function usualMatchAt(plan, pid, today, ownYearly) {
  const pay = jobPayOf(plan, pid, today);
  if (!(pay > 0) || !(ownYearly > 0)) return 0;
  const year = yearOf(today), comp = Math.min(pay, compLimit(year));
  const cap = deferralLimit(ageInYear(plan, pid, year), year);
  const put = Math.min(ownYearly, Number.isFinite(cap) ? cap : Infinity);
  const tiers = typedTiers(plan, pid);
  const { value, needed } = matchTerms();
  const yearly = tiers ? tierMatch(put / comp, tiers) * comp : value * Math.min(1, put / comp / needed) * comp;
  return Math.round(yearly / 12 / 10) * 10 * 12;
}
/** The 401(k)-like accounts a person saves into at work: a 401(k), or a Roth 401(k) (a Roth account that counts against the 401(k) limit). */
// (an account from a job left, marked so or named "old", "former", "prior" or "rollover", takes no new money: Contributions' own test)
const OLD_JOB = /\b(old|former|previous|prior|rollover)\b/i;
const atWork = (acct, match = 0) => !!acct && !acct.formerJob && !OLD_JOB.test(acct.name ?? "") && (acct.type === "401k" || (acct.type === "roth" && limitKind("roth", acct.name, match) === "401k"));
/** A person's rows into their plan at work (their own, or a household row into an account they own), with the account. */
export function workRows(plan, pid) {
  const accts = L(plan, "accounts");
  return L(plan?.retirement, "contributions").map((c) => ({ c, acct: accts.find((a) => a.id === c.accountId) }))
    .filter(({ c, acct }) => atWork(acct, c.employerMatch) && (c.personId === pid || (!c.personId && acct.ownerId === pid)));
}
const workAccount = (plan, pid) => L(plan, "accounts").find((a) => a.ownerId === pid && a.type === "401k" && atWork(a)) ?? L(plan, "accounts").find((a) => a.ownerId === pid && atWork(a)) ?? null;
/** Has a plan at work: Get started's "Yes" (`retirement.workPlans[pid].plan`), or a 401(k) of their own on file. */
const hasWorkPlan = (plan, pid) => plan?.retirement?.workPlans?.[pid]?.plan === true || !!workAccount(plan, pid);
/** "401(k)", or the account's own kind when its name says 403(b), 457 or TSP. */
const kindWords = (acct) => { const n = String(acct?.name ?? ""); return /403\s*\(?b/i.test(n) ? "403(b)" : /\b457\b/.test(n) ? "457" : /\btsp\b|thrift/i.test(n) ? "TSP" : "401(k)"; };
const isYouName = (name) => nameIn(name) === "you";
const amountPath = (id) => `retirement.contributions[${id}].amount`;
const matchPath = (id) => `retirement.contributions[${id}].employerMatch`;

/**
 * workAlt(plan, pid, { today }) -> the change the work-saving row shows, or null:
 *   nothing goes in: { kind: "usual", share, monthly, match }: the share of pay people with this pay and age put in (Vanguard's How
 *     America Saves, usualShare) plus the usual match at that share (none when the person said there is no match): one row, since
 *     a match alone adds $0 when nothing goes in (D-A5);
 *   under the share that earns the whole usual match (about 6%) while the match is our guess: { kind: "full", ... } that share,
 *     with the usual match at it;
 *   otherwise { kind: "more", ... }: 1% of pay more, the match as it is.
 * `rowId` is the row it goes on (the biggest of the person's rows at work, or none: a new one into `accountId`); `monthly` is that
 * row's own money a month after the change, `match` its match a year. Never past the year's 401(k) limit. `matchLater`: the money
 * goes in as Roth 401(k) and no pay-the-tax-later row holds the match, so the match is written on a pay-the-tax-later row of
 * its own (contributions' applyMatchAtWork; D-C2, review 2026-11-12, B5).
 */
export function workAlt(plan, pid, { today } = {}) {
  const pay = jobPayOf(plan, pid, today);
  if (!(pay > 0) || !hasWorkPlan(plan, pid)) return null;
  const rows = workRows(plan, pid);
  const own = rows.reduce((t, { c }) => t + perYear(c.amount, c.period), 0);
  const year = yearOf(today), cap = deferralLimit(ageInYear(plan, pid, year), year);
  const main = [...rows].sort((a, b) => perYear(b.c.amount, b.c.period) - perYear(a.c.amount, a.c.period))[0] ?? null;
  const acct = main?.acct ?? workAccount(plan, pid);
  const noMatch = plan?.retirement?.workPlans?.[pid]?.match === false;
  // the row the match is on: a pay-the-tax-later row with a match (the split keeps it there, D-C2), else the main row
  const matchRow = rows.find(({ c, acct: a }) => a.type === "401k" && Number(c.employerMatch) > 0) ?? main;
  const base = { rowId: main?.c.id ?? null, matchRowId: matchRow && matchRow !== main ? matchRow.c.id : null, accountId: acct?.id ?? null, period: "monthly", today,
    matchLater: !!main && main.acct.type === "roth" && matchRow === main };
  if (!(own > 0)) {
    const share = usualShare(plan, pid, today);
    if (!(share > 0)) return null;
    const monthly = round2(Math.min(share * pay, Number.isFinite(cap) ? cap : Infinity) / 12);
    return { ...base, kind: "usual", share, monthly, match: noMatch ? 0 : usualMatchAt(plan, pid, today, monthly * 12), ownYearly: monthly * 12 };
  }
  if (Number.isFinite(cap) && own >= cap - 0.5) return null;
  const otherOwn = own - perYear(main.c.amount, main.c.period);
  const { needed } = matchTerms();
  const guessedMatch = rows.some(({ c }) => Number(c.employerMatch) > 0 && isGuess(plan, matchPath(c.id)));
  const matchNow = rows.reduce((t, { c }) => t + (Number(c.employerMatch) || 0), 0);
  const full = own / pay < needed - 0.0005 && guessedMatch && !noMatch;
  const ownYearly = Math.min(full ? needed * pay : own + 0.01 * pay, Number.isFinite(cap) ? cap : Infinity);
  const monthly = round2(Math.max(0, ownYearly - otherOwn) / 12);
  return { ...base, kind: full ? "full" : "more", share: ownYearly / pay, monthly, match: full ? usualMatchAt(plan, pid, today, ownYearly) : base.matchRowId ? Number(matchRow.c.employerMatch) || 0 : Number(main.c.employerMatch) || 0, ownYearly, before: own, matchNow };
}
/** Put a workAlt on a draft plan: the row it names changed (as a monthly row), or a new row into its account. */
export function applyWorkAlt(draft, pid, alt) {
  draft.retirement = draft.retirement ?? {};
  draft.retirement.contributions = L(draft.retirement, "contributions");
  const row = alt.rowId ? draft.retirement.contributions.find((c) => c.id === alt.rowId) : null;
  // the match on its own row when that is not the one the money goes on (a pay-the-tax-later row beside a Roth 401(k) one, D-C2)
  const mRow = alt.matchRowId ? draft.retirement.contributions.find((c) => c.id === alt.matchRowId) : null;
  if (row && mRow) { Object.assign(row, { amount: alt.monthly, period: "monthly" }); delete row.pctOfPay; mRow.employerMatch = alt.match; return; }
  if (row) {
    Object.assign(row, { amount: alt.monthly, period: "monthly" }); delete row.pctOfPay;
    if (alt.matchLater) applyMatchAtWork(draft, row.id, alt.match, { today: alt.today ?? null, ids: { laterRow: `lever-later-${pid}`, laterAccount: `lever-401k-${pid}` } });
    else row.employerMatch = alt.match;
    return;
  }
  let accountId = alt.accountId;
  if (!accountId) {
    accountId = `lever-401k-${pid}`;
    draft.accounts = [...L(draft, "accounts"), { id: accountId, name: "401(k) at work", type: "401k", balance: 0, ownerId: pid, history: [] }];
  }
  draft.retirement.contributions.push({ id: `lever-${pid}`, accountId, personId: pid, amount: alt.monthly, period: "monthly", employerMatch: alt.match });
}

// ---- where the card's links land on Contributions (L3) -------------------------------------------------------------------
/**
 * workLanding(plan, pid, { today }) -> what Contributions' ?add=<pid> opens: { pid, rowId (the row to edit, or null: a new row),
 * accountId, alt (workAlt), fill (nothing of the person's own goes in: the "usual" change, a $0 row or none), tried (the change
 * the card tried, as the form's one-tap chip puts it in: { amount (a month), period: "monthly" }), matchGuess (the usual match a
 * year the card counted with it, or 0) }.
 * Nothing of ours is typed in for the person (review 2026-11-12, P2: one tap on Save stored our usual 6.6% and our usual $2,880
 * match as Casey's own). The amount box opens as the row is (empty with the usual amount grey in it when nothing goes in) and a
 * chip "Use ..." puts the tried amount in; the match box opens empty with the usual match grey in it, and left blank it is
 * saved as our guess, worked out again at the amount saved (M5; the `contrib.match` guess, tagged "Our guess"). So the chip and
 * Save make the same change as applyWorkAlt (said = done).
 */
export function workLanding(plan, pid, { today } = {}) {
  const alt = workAlt(plan, pid, { today });
  const rs = workRows(plan, pid);
  const byOwn = [...rs].sort((a, b) => perYear(b.c.amount, b.c.period) - perYear(a.c.amount, a.c.period));
  const row = (alt?.rowId ? rs.find(({ c }) => c.id === alt.rowId) : byOwn[0])?.c ?? null;
  const fill = alt?.kind === "usual";
  return { pid, rowId: row?.id ?? null, accountId: alt?.accountId ?? row?.accountId ?? workAccount(plan, pid)?.id ?? null, alt, fill,
    tried: alt ? { amount: alt.monthly, period: "monthly" } : null, matchGuess: alt && alt.kind !== "more" ? alt.match : 0 };
}
/** Whose a row is: its person, or the owner of the account it goes into. */
const rowPerson = (plan, c) => c?.personId || L(plan, "accounts").find((a) => a.id === c?.accountId)?.ownerId || null;
/**
 * matchLanding(plan, rowId, { today }) -> what Contributions' ?match=<rowId> and the match check say: { rowId, pid, usual (the usual
 * match a year at what the person puts in at work now, as the card's match row tries it), typed (the formula typed on Work
 * benefits is used instead of the usual one), said (`workPlans[pid].match`) } or null for a row that is not there.
 */
export function matchLanding(plan, rowId, { today } = {}) {
  const c = L(plan?.retirement, "contributions").find((x) => x.id === rowId);
  if (!c) return null;
  const pid = rowPerson(plan, c);
  const rs = pid ? workRows(plan, pid) : [];
  const own = rs.length ? rs.reduce((t, x) => t + perYear(x.c.amount, x.c.period), 0) : perYear(c.amount, c.period);
  return { rowId, pid, usual: pid ? usualMatchAt(plan, pid, today, own) : 0, typed: !!(pid && typedTiers(plan, pid)), said: pid ? plan.retirement?.workPlans?.[pid]?.match : undefined };
}
/**
 * matchChecks(plan, { today }) -> the rows that get "No match on file. Is that right?" (spec L3): a row into a plan at work with
 * money of the person's own going in, no match on it (not our guess), and the match never answered (`workPlans[pid].match` unset).
 * The card's match row tags these "Not counted".
 */
export function matchChecks(plan, { today } = {}) {
  const out = [];
  for (const p of L(plan?.household, "people").filter((x) => x.role !== "dependent")) {
    if (plan.retirement?.workPlans?.[p.id]?.match !== undefined) continue;
    const rs = workRows(plan, p.id);
    // a match on any of the person's rows at work answers it (the split keeps it on the pay-the-tax-later row, D-C2)
    if (rs.some(({ c }) => Number(c.employerMatch) > 0 || isGuess(plan, matchPath(c.id)))) continue;
    const hasLater = rs.some(({ c, acct }) => acct.type === "401k" && perYear(c.amount, c.period) > 0);
    for (const { c, acct } of rs) {
      if (!(perYear(c.amount, c.period) > 0) || (acct.type === "roth" && hasLater)) continue;
      out.push({ ...matchLanding(plan, c.id, { today }), name: p.name });
    }
  }
  return out;
}
/**
 * The answer after a save next to the one before it (spec L3 "Now runs out at 76 (was 66)", L5): "now runs out at 76 (was 66)",
 * "now lasts to the end, age 95 (was: runs out at 66)", "now runs out at 70 (it lasted to the end before)", "lasts to the end,
 * with about $40,000 more left at 95 (today's dollars)", "still runs out at 70". "" when either answer is missing, or when
 * nothing moved and `still` is false.
 * Review 2026-11-12: an answer that lasts both times is never said with "still" (P6: this is the average-market answer, and the
 * page's headline, which also looks at a bad run of years, may have turned under it); `unknown` (the page said "We don't know
 * yet" before: nothing saved for retirement was on file) gives the new answer alone, never a "was" the page did not say (M7).
 */
export function answerChangeWords(before, after, money = dollars, { still = true, unknown = false } = {}) {
  if (!after || (!before && !unknown)) return "";
  if (unknown) return after.lasts ? `now lasts to the end (age ${after.endAge})` : `now runs out at ${after.age}`;
  if (!after.lasts && !before.lasts) return after.age === before.age ? (still ? `still runs out at ${after.age}` : "") : `now runs out at ${after.age} (was ${before.age})`;
  if (!after.lasts) return `now runs out at ${after.age} (it lasted to the end before)`;
  if (!before.lasts) return `now lasts to the end, age ${after.endAge} (was: runs out at ${before.age})`;
  const diff = after.endReal - before.endReal, r = roundMoney(Math.abs(diff));
  if (r < 100) return still ? `lasts to the end, with about the same left at ${after.endAge}` : "";
  return `lasts to the end, with about ${money(r)} ${diff > 0 ? "more" : "less"} left at ${after.endAge} (today's dollars)`;
}

// ---- the money left over each month, answered (L4; spec part B) -------------------------------------------------------------
export const ASK_AGAIN_DAYS = 365, ASK_AGAIN_MOVE = 0.25;
const LEFT_ANSWERS = ["invest", "bank", "spend"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthYear = (iso) => { const m = Number(String(iso ?? "").slice(5, 7)); return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${String(iso).slice(0, 4)}` : "the past"; };
/**
 * leftoverAnswer(plan) -> `retirement.leftover` with its row and account ({ answer, on, monthly, rowId, row, account, bank (the
 * row goes into a checking or savings account), lost (the row's account is no longer on file) }), or null: not answered, not one
 * of the three answers, or an "invested" / "in the bank" answer whose row was removed (then the question is asked again as if
 * never answered, and everything is as before the answer: spec acceptance 5).
 */
export function leftoverAnswer(plan) {
  const a = plan?.retirement?.leftover;
  if (!a || typeof a !== "object" || !LEFT_ANSWERS.includes(a.answer)) return null;
  if (a.answer === "spend") return { ...a, row: null, account: null, bank: false, lost: false };
  const row = L(plan.retirement, "contributions").find((c) => c.id === a.rowId);
  if (!row) return null;
  const account = L(plan, "accounts").find((x) => x.id === row.accountId) ?? null;
  return { ...a, row, account, bank: BUCKET_OF[account?.type] === "cash", lost: !account };
}
/**
 * leftoverStanding(plan, leftMonthly, today) -> { ans, rowMonthly, total, rest, again }.
 *   `leftMonthly` is the month's left-over as it stands (Next best action's `spare.monthly`, the Dashboard's figure).
 *   `total` is the left-over the question is about, before the answer: an invested row is saving out of pay to every page, so
 *     it has already come off `leftMonthly` and is put back (leftMonthly + the row a month); a row into the bank has not (the
 *     money stays in checking and savings: contributions compute leaves it out of the saving, review 2026-11-12, M3), so the
 *     total is `leftMonthly` itself. `rest` = total - the row: what is left over beyond the answer.
 *   `again`: "lost" the row's account is no longer on file (B7); "short" the row is more than the total (B3: a bill added since;
 *     whatever the 25% rule says, the plan is counting money that is not there); "old" answered more than 365 days ago; "moved"
 *     the total is more than 25% away from the left-over answered about (D-B6); else null.
 */
export function leftoverStanding(plan, leftMonthly, today) {
  const ans = leftoverAnswer(plan);
  const rowMonthly = ans?.row ? perYear(ans.row.amount, ans.row.period) / 12 : 0;
  const known = leftMonthly !== null && leftMonthly !== undefined;
  const total = (Number(leftMonthly) || 0) + (ans?.row && !ans.bank ? rowMonthly : 0);
  let again = null;
  if (ans) {
    const days = ans.on && today ? daysBetween(ans.on, today) : null;
    const was = Number(ans.monthly) || 0;
    if (ans.lost) again = "lost";
    else if (known && rowMonthly > total + 0.5) again = "short";
    else if (days !== null && days > ASK_AGAIN_DAYS) again = "old";
    else if (known && (was > 0 ? Math.abs(total - was) / was > ASK_AGAIN_MOVE : total >= LEFTOVER_MIN)) again = "moved";
  }
  return { ans, rowMonthly, total, rest: total - rowMonthly, again };
}
/**
 * lowerLeftover(draft, amount, { today, total }) -- the answered row brought down to what is left over now ("Lower it to
 * $1,120"; B3), dated today for the left-over as it is; at 0 the row and the answer are taken out ("Stop counting it"), and the
 * question is asked again when there is something left over.
 */
export function lowerLeftover(draft, amount, { today = null, total = 0 } = {}) {
  const a = draft?.retirement?.leftover;
  if (!a) return;
  const list = L(draft.retirement, "contributions");
  const row = list.find((c) => c.id === a.rowId);
  const to = Math.max(0, Math.floor((Number(amount) || 0) / 10) * 10);
  if (!row || !(to > 0)) { draft.retirement.contributions = list.filter((c) => c.id !== a.rowId); delete draft.retirement.leftover; return; }
  row.amount = to; row.period = "monthly";
  a.on = today; a.monthly = round2(Number(total) || 0);
}
/**
 * applyLeftover(draft, { answer, monthly, amount, accountId, newAccount: { id, name, type }, personId, today }) -- the answer
 * saved: `retirement.leftover = { answer, on, monthly (the left-over answered about), rowId? }`. "invest" and "bank" write one
 * ordinary contribution row `leftover-<n>` (monthly, employer match 0, the lead earner's, so it stops when that person retires
 * and grows with pay raises like every row) into `accountId` or a new $0 account (`asOf` today, the lead earner's); "spend"
 * writes no row. The row an earlier answer wrote is taken out first (`keep` leaves it, for a change tried beside it).
 */
export function applyLeftover(draft, { answer, monthly = 0, amount = 0, accountId = null, newAccount = null, personId = null, today = null, keep = false } = {}) {
  draft.retirement = draft.retirement ?? {};
  const old = keep ? null : draft.retirement.leftover?.rowId;
  let list = L(draft.retirement, "contributions").filter((c) => !old || c.id !== old);
  const out = { answer, on: today, monthly: round2(Number(monthly) || 0) };
  if (answer !== "spend" && Number(amount) > 0) {
    let acct = accountId;
    if (!acct && newAccount) {
      draft.accounts = [...L(draft, "accounts"), { id: newAccount.id, name: newAccount.name, type: newAccount.type, balance: 0, asOf: today, ownerId: personId ?? "", history: [] }];
      acct = newAccount.id;
    }
    const n = 1 + Math.max(0, ...list.map((c) => Number(/^leftover-(\d+)$/.exec(c.id ?? "")?.[1]) || 0));
    out.rowId = `leftover-${n}`;
    list = [...list, { id: out.rowId, accountId: acct, personId: personId ?? "", amount: round2(Number(amount)), period: "monthly", employerMatch: 0 }];
  }
  draft.retirement.contributions = list;
  if (!keep) draft.retirement.leftover = out;
}
/** The accounts an answer can go into: brokerage for "invested", savings for "in the bank" (an existing one, or a new one). */
export function leftoverAccounts(plan, answer) {
  const type = answer === "bank" ? "savings" : answer === "invest" ? "brokerage" : null;
  return type ? L(plan, "accounts").filter((a) => a.type === type) : [];
}

// ---- the money when retirement starts, by when its tax is paid (L6, spec D-C4) ----------------------------------------------
/**
 * mixAtRetirement(d) -> the projection's (compute's output, read only) retirement-year balances as shares that add up to 100
 * (largest remainder): { year, age, later (pay-the-tax-later: the deferred bucket), now (already taxed, Roth: free), regular
 * (regular savings and cash: taxable + cash), total } or null when there is no such row or nothing in it.
 */
export function mixAtRetirement(d) {
  const at = d?.atRetirement;
  const row = at ? (d.rows ?? []).find((r) => r.year === at.year) : null;
  const b = row?.balances;
  if (!b) return null;
  const parts = { later: Math.max(0, b.deferred || 0), now: Math.max(0, b.free || 0), regular: Math.max(0, (b.taxable || 0) + (b.cash || 0)) };
  const total = parts.later + parts.now + parts.regular;
  if (!(total > 0)) return null;
  const raw = Object.entries(parts).map(([k, v]) => [k, (v / total) * 100]);
  const out = Object.fromEntries(raw.map(([k, v]) => [k, Math.floor(v)]));
  let left = 100 - Object.values(out).reduce((t, v) => t + v, 0);
  for (const [k] of [...raw].sort((x, y) => (y[1] - Math.floor(y[1])) - (x[1] - Math.floor(x[1])))) { if (left <= 0) break; out[k]++; left--; }
  return { year: at.year, age: at.age, ...out, total };
}
/** "Your money when retirement starts (2047): 68% pay-the-tax-later, 22% already taxed (Roth), 10% regular savings." */
export function mixWords(m) {
  if (!m) return "";
  const parts = [[m.later, "pay-the-tax-later"], [m.now, "already taxed (Roth)"], [m.regular, "regular savings"]].filter(([v]) => v > 0).map(([v, w]) => `${v}% ${w}`);
  return `Your money when retirement starts (${m.year}): ${parts.join(", ")}.`;
}

// ---- tags ---------------------------------------------------------------------------------------------------------------
/** An Assumptions figure is the usual one while it equals its default and the page was not saved in the last year (D-A3). */
export function assumptionTag(plan, key, today) {
  const def = ASSUMPTIONS.find((x) => x.key === key)?.def;
  const a = plan?.assumptions ?? {};
  const v = a[key] === undefined || a[key] === null ? def : Number(a[key]);
  const at = a.reviewedAt ?? null;
  const days = at && today ? daysBetween(at, today) : null;
  const reviewed = !!at && days !== null && days <= REVIEW_DAYS;
  return Math.abs(v - def) < 1e-9 && !reviewed ? "usual" : "yours";
}

// ---- the copy a change is tried on -----------------------------------------------------------------------------------------
/** A copy deep enough for every change below (the parts a change writes are copied; the rest is shared, read only). */
function copyFor(plan) {
  return { ...plan, accounts: structuredClone(L(plan, "accounts")), household: structuredClone(plan.household ?? {}), assumptions: { ...(plan.assumptions ?? {}) },
    retirement: structuredClone(plan.retirement ?? {}), guide: structuredClone(plan.guide ?? {}), ...(plan.guesses ? { guesses: structuredClone(plan.guesses) } : {}) };
}
/** The answer for the plan with one change made (said = done: the same copy a save would make, through buildInputs). */
export function tryChange(plan, today, change) {
  const copy = copyFor(plan);
  change(copy);
  const b = buildInputs(copy, { today });
  return b.inputs ? outcomeOf(b.inputs) : null;
}

// ---- the rows -------------------------------------------------------------------------------------------------------------
/** savingsUnknown (the projection's), worked out only when it can be true: nothing invested and nothing going in (the page's own `d` when handed in). */
function unknownOf(plan, today, I, d) {
  if (d) return savingsUnknown(d);
  const bal = I.balances;
  if ((bal.taxable + bal.deferred + bal.free) > 0 || I.contributions.length || !(I.retireYear > I.startYear)) return false;
  try { return savingsUnknown(projection(plan, { today })); } catch { return false; }
}
/**
 * leverList(plan, { today, spare, money }) -> {
 *   ready, unknown (nothing saved, nothing going in: savingsUnknown), spendingYearly,
 *   rows: [{ key, name (for "Before your change"), label, value, short, tag, alts: [{ say, change(draft) }], acts: [{ label, href } | { label, open }],
 *     note?, always? (never hidden), foldOnly?, would? (a question's answer), worseHides? (spending: a worse effect is not shown) }],
 *   counts: { yours, guess, usual, missing }, missing: [words]
 * }
 */
export function leverList(plan, { today, spare = null, money = dollars, d = null } = {}) {
  let b = null;
  try { b = buildInputs(plan, { today }); } catch { b = null; }
  if (!b?.inputs) return { ready: false, rows: [], counts: { yours: 0, guess: 0, usual: 0, missing: 0 }, missing: [] };
  const I = b.inputs;
  const unknown = unknownOf(plan, today, I, d);
  const adults = L(plan.household, "people").filter((p) => p.role !== "dependent");
  const byId = (id) => adults.find((p) => p.id === id);
  let wn = null;
  try { wn = workingNow(plan, I, today); } catch { wn = null; }
  const stillWorks = (q) => !!wn && wn.stillWorks(q);
  const rows = [];

  // what goes into each plan at work, and the match on each row (spec table rows `work-saving` and `match`)
  for (const p of adults) {
    const pay = jobPayOf(plan, p.id, today);
    if (!(pay > 0) || !hasWorkPlan(plan, p.id)) continue;
    const alt = workAlt(plan, p.id, { today });
    const rs = workRows(plan, p.id);
    const own = rs.reduce((t, { c }) => t + perYear(c.amount, c.period), 0);
    const kind = kindWords(rs[0]?.acct ?? workAccount(plan, p.id));
    const whose = `${nameOf(p.name)} ${kind}`;
    const amtGuess = rs.some(({ c }) => isGuess(plan, amountPath(c.id)));
    const tag = amtGuess ? "guess" : own > 0 || rs.length ? "yours" : "missing";
    const value = own > 0 ? `${money(own / 12)} a month (${pctWords(own / pay)} of pay)` : tag === "yours" ? "nothing (you said so)" : tag === "guess" ? "nothing (our guess)" : "nothing on file";
    const say = !alt ? "" : alt.kind === "usual" ? `${pctWords(alt.share)} of pay${alt.match > 0 ? " plus the usual match" : ""}`
      : alt.kind === "full" ? `${pctWords(alt.share)} of pay, enough for the whole usual match` : `1% of pay more (about ${money((alt.ownYearly - alt.before) / 12)} a month)`;
    rows.push({
      key: `work-saving:${p.id}`, name: `what goes into ${whose}`, label: `What goes into ${whose}`, value, short: own > 0 ? `${money(own / 12)} a month` : "nothing", tag, zero: !(own > 0),
      alts: alt ? [{ say, change: (draft) => applyWorkAlt(draft, p.id, alt) }] : [],
      note: alt?.kind === "usual" ? `People with pay like ${isYouName(p.name) ? "yours" : nameOf(p.name)} usually put in about ${pctWords(alt.share)} (Vanguard, How America Saves 2026).` : null,
      // ("Read it from a pay stub ›" waits for the pay stub reader to read a Roth 401(k) line apart from the pre-tax one, L7: today's
      // reader reads "ROTH 401K" as pay-the-tax-later money; review 2026-11-12, B8)
      acts: [{ label: "Type what goes in ›", href: `#/retirement/contributions?add=${encodeURIComponent(p.id)}` }],
      missingWords: `what goes into ${whose}`,
    });
    // the match, a row of its own for each row at work with money of the person's own going in (D-A5: with nothing going in it
    // is part of the row above); the usual match is worked out on all the person's own money at work
    const job = isYouName(p.name) ? "your job" : `${nameOf(p.name)} job`;
    // one match row for each row with own money in, except a Roth 401(k) row beside a pay-the-tax-later row (the match is
    // there, D-C2), and for a $0 pay-the-tax-later row that carries the match while the money goes in as Roth ("Now")
    const laterLive = rs.some(({ c, acct }) => acct.type === "401k" && (perYear(c.amount, c.period) > 0 || Number(c.employerMatch) > 0));
    for (const { c, acct } of rs) {
      const ownIn = perYear(c.amount, c.period) > 0;
      if (ownIn ? acct.type === "roth" && laterLive : !(own > 0 && acct.type === "401k" && Number(c.employerMatch) > 0)) continue;
      const m = Number(c.employerMatch) || 0;
      const said = plan.retirement?.workPlans?.[p.id]?.match;
      const mTag = isGuess(plan, matchPath(c.id)) ? "guess" : m > 0 || said === false ? "yours" : "missing";
      const usual = usualMatchAt(plan, p.id, today, own);
      rows.push({
        key: `match:${c.id}`, name: `the match at ${job}`, label: `What ${job} adds (the match)`, tag: mTag, zero: !(m > 0),
        value: m > 0 ? `${money(m)} a year` : mTag === "yours" ? "No match on file (you said so)" : "No match on file", short: m > 0 ? `${money(m)} a year` : "none",
        alts: Math.abs(usual - m) >= 12 ? [{ say: `If ${job} matched like most (about ${money(usual)} a year)`, change: (draft) => applyMatchAtWork(draft, c.id, usual, { today, ids: { laterRow: `lever-later-${p.id}`, laterAccount: `lever-401k-${p.id}` } }) }] : [],
        note: mTag === "guess" ? "Our guess: most work plans add about 4% of pay when you put in 6% (Vanguard, How America Saves 2026). A pay stub shows the real figure." : null,
        acts: [{ label: "Check the match ›", href: `#/retirement/contributions?match=${encodeURIComponent(c.id)}` }],
        missingWords: `the match at ${job}`,
      });
    }
  }

  // the money left over each month (spec table row `leftover`; part B, D-B1 to D-B6): not counted until the person answers;
  // answered, the row reads the answer (Yours) and the row it wrote; asked again after a year or when it moved more than 25%
  // (the month's left-over is the Dashboard's own: Next best action's `spare.monthly`, after the goal saving and with uneven pay
  // at what the plan counts on. The spec's table named leftOverOf(spare), the left-over with the goal saving put back at the
  // month all uneven pay comes in: investing that spent the goal money twice, review 2026-11-12, M1)
  const lead = leadEarner(plan, I, today);
  const leftMonthly = spare && Number.isFinite(Number(spare.monthly)) ? Number(spare.monthly) : null;
  const st = leftoverStanding(plan, leftMonthly, today);
  // one value for "what the person said", whatever the row is asking just now (N6: "You just changed this: $1,820 a month
  // invested -> $1,820 a month" after a bill was added)
  const saidShort = st.ans ? (st.ans.answer === "spend" ? "spent" : `${money(st.rowMonthly)} a month ${st.ans.bank ? "in the bank" : "invested"}`) : null;
  const saidCmp = st.ans ? `${st.ans.answer}:${Math.round(st.rowMonthly)}` : "not counted";
  const partly = guessesTouching(plan, ["expenses"]).length > 0;
  const floor10 = (n) => Math.floor(Math.max(0, n) / 10) * 10;
  const person = st.ans?.row?.personId || lead?.id || null;
  // a row of the left-over into a new $0 account, as the answer saves it (applyLeftover; said = done), the answered row first
  // taken out when it is being answered again
  const addRow = (type, name, amount, { replace = false } = {}) => (draft) => applyLeftover(draft, { answer: type === "savings" ? "bank" : "invest", monthly: amount, amount, personId: person, today,
    newAccount: { id: `lever-${type}`, name, type }, keep: !replace });
  const leftWords = (n) => `${money(n)} a month${partly ? ", worked out from bills that are partly our guesses" : ""}`;
  const answerAct = (label) => ({ label, answer: true });
  if (st.ans && (st.again === "short" || st.again === "lost")) {
    // the plan counts money that is not there (a bill added since the answer), or a row whose account is gone: said, with the
    // one tap that puts it right; never "Still right" (B3, B7)
    const a = st.ans, to = st.again === "lost" ? 0 : floor10(st.total);
    const kind = a.bank ? "kept in the bank" : "invested";
    const lower = (draft) => lowerLeftover(draft, to, { today, total: st.total });
    rows.push({
      key: "leftover", name: "the money left over each month", label: "Money left over each month", tag: "yours", ask: true, always: true,
      value: st.again === "lost" ? `${money(st.rowMonthly)} a month is still counted as ${kind}, but the account it went into is no longer on Net worth.`
        : `You said ${money(st.rowMonthly)} a month is ${kind}; ${st.total >= 1 ? `only ${money(st.total)} is left over now` : "nothing is left over now"}.`,
      short: saidShort, cmp: saidCmp, amount: to, total: st.total, rowMonthly: st.rowMonthly, leadId: person, answered: a.answer,
      alts: [{ id: "lower", say: to > 0 ? `Lowered to ${money(to)} a month` : "No longer counted", change: lower }],
      baseSay: "As it is counted now",
      acts: [...(to > 0 ? [{ label: `Lower it to ${money(to)}`, lower: to }] : [{ label: "Stop counting it", lower: 0 }]), ...(to > 0 || st.again === "lost" ? [answerAct("Answer again")] : [])],
      missingWords: "the money left over each month",
    });
  } else if (st.ans && !st.again) {
    // answered, and still right
    const a = st.ans, more = leftMonthly !== null && st.rest >= LEFTOVER_MIN ? floor10(st.rest) : 0;
    const into = a.row ? `${money(st.rowMonthly)} a month into ${a.account?.name ?? "an account"}` : "";
    const alts = a.answer === "spend"
      ? (more ? [{ id: "invest", say: "If it's invested", change: addRow("brokerage", "Investments for later", more, { replace: true }) }, { id: "bank", say: "If it piles up in the bank", change: addRow("savings", "Savings for later", more, { replace: true }) }] : [])
      : [
        ...(a.bank ? [{ id: "invest-instead", say: "If it were invested instead", change: (draft) => { const r = L(draft.retirement, "contributions").find((c) => c.id === a.rowId); if (r) { draft.accounts = [...L(draft, "accounts"), { id: "lever-brokerage", name: "Investments for later", type: "brokerage", balance: 0, ownerId: person, history: [] }]; r.accountId = "lever-brokerage"; } } }] : []),
        ...(more ? [{ id: "more", say: `If ${money(more)} a month of that were invested too`, change: (draft) => { draft.accounts = [...L(draft, "accounts"), { id: "lever-brokerage-more", name: "Investments for later", type: "brokerage", balance: 0, ownerId: person, history: [] }]; draft.retirement.contributions = [...L(draft.retirement, "contributions"), { id: "leftover-lever", accountId: "lever-brokerage-more", personId: person, amount: more, period: "monthly", employerMatch: 0 }]; } }] : []),
      ];
    rows.push({
      key: "leftover", name: "the money left over each month", label: "Money left over each month", tag: "yours",
      value: a.answer === "spend" ? `Spent (you said so)${more ? `; ${leftWords(st.rest)}` : ""}` : `${into}, ${a.bank ? "kept in the bank" : "invested"} (you said so)${more ? `; ${money(st.rest)} a month more is left over` : ""}`,
      short: saidShort, cmp: saidCmp,
      amount: more || floor10(st.total), total: st.total, rowMonthly: st.rowMonthly, leadId: person, answered: a.answer, alts, acts: [answerAct("Change my answer")], missingWords: "the money left over each month",
      // the one row the card writes: never hidden by D-A2's less-than-a-year rule, so the answer and "Change my answer" stay in reach
      always: true,
    });
  } else if ((st.again || (leftMonthly !== null && leftMonthly >= LEFTOVER_MIN)) && (lead || st.ans)) {
    // never answered (or the row it wrote was removed), or answered a year ago or for a left-over that has moved since: asked
    const amount = floor10(st.again ? st.total : leftMonthly);
    const again = st.again ? st.ans : null;
    const said = again ? (again.answer === "spend" ? "is spent" : `${again.bank ? "goes into the bank" : "is invested"}`) : "";
    const saidMoney = again?.row ? money(st.rowMonthly) : money(again?.monthly ?? 0);
    rows.push({
      key: "leftover", name: "the money left over each month", label: "Money left over each month", tag: again ? "yours" : "missing", would: unknown, ask: !!again,
      value: again ? `You said in ${monthYear(again.on)} that ${saidMoney} a month ${said}. Left over each month now: ${money(st.total)}. Still right?` : leftWords(leftMonthly),
      short: again ? saidShort : `${money(leftMonthly)} a month`,
      // not answered, it moves with every bill and pay change: a result, never "a change you made" (B6); answered, what the
      // person said, the same whether or not it is being asked about again (N6)
      cmp: saidCmp,
      amount, total: st.total, rowMonthly: st.rowMonthly, leadId: person,
      alts: [
        { id: "invest", say: unknown ? "If it were invested" : again ? "If it's all invested" : "If it's invested", change: addRow("brokerage", "Investments for later", amount, { replace: true }) },
        { id: "bank", say: unknown ? "If it piled up in the bank" : again ? "If it all piles up in the bank" : "If it piles up in the bank", change: addRow("savings", "Savings for later", amount, { replace: true }) },
      ],
      baseSay: unknown ? null : again ? "As it is now" : "As it is, counted as spent",
      acts: again ? [{ label: "Still right", keep: true }, answerAct("Answer again")] : [answerAct("Answer")],
      missingWords: `the ${money(leftMonthly ?? st.total)} left over each month`,
    });
  }

  // nothing saved for retirement and nothing going in: only what is not counted, said as questions; with no plan at work to
  // ask about, one statement first (part A, Sam)
  if (unknown) {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].tag !== "missing") rows.splice(i, 1);
    for (const r of rows) r.would = true;
  }
  if (unknown && !rows.some((r) => r.key.startsWith("work-saving:"))) {
    rows.unshift({ key: "nothing-saved", name: "retirement saving", label: "Saving for retirement", tag: "missing", first: true, value: "Nothing is saved for retirement yet, and nothing goes in.", short: "none", alts: [],
      acts: [{ label: "What you save for retirement ›", href: "#/retirement/contributions" }], missingWords: "retirement saving" });
  }

  if (!unknown) {
    // spending in retirement (the figure, where it comes from; 10% less through Retirement settings' own save)
    const guessed = isGuess(plan, "retirement.spendingMonthly");
    const monthly = b.spendingYearly / 12;
    const from = guessed ? "our guess from today's bills" : b.spendingSource === "expenses" ? "today's bills" : "the figure you typed";
    const typedLess = Math.round((b.figureMonthly ?? monthly) * (1 - SPEND_STEP));
    rows.push({
      key: "spending", name: "spending in retirement", label: "Spending in retirement", value: `${money(monthly)} a month, ${from}`, short: `${money(monthly)} a month`, tag: guessed ? "guess" : "yours", worseHides: true,
      alts: [{ say: `${money(typedLess)} a month (10% less)`, change: (draft) => saveSpendingFigure(draft, typedLess, b.figureMonthly ?? null) }],
      // (`open`: Will the money last? opens its own settings at the box, in place; the address is for a link from another page: N4)
      acts: [{ label: "Change ›", open: "spending", href: "#/retirement/projection?type=spending" }],
    });

    // when each adult still at work stops
    for (const q of I.people) {
      const p = byId(q.id);
      if (!p || !stillWorks(q)) continue;
      const own = Number(p.retirementAge) > 0;
      const later = Math.min(STOP_MAX, q.retireAge + STOP_STEP);
      rows.push({
        key: `stop:${q.id}`, name: `when ${nameIn(q.name)} ${verbFor(q.name, "stops", "stop")} work`, label: `When ${nameIn(q.name)} ${verbFor(q.name, "stops", "stop")} work`, value: `at ${q.retireAge}`, short: `${q.retireAge}`,
        tag: own ? "yours" : assumptionTag(plan, "retirementAge", today),
        alts: later > q.retireAge ? [{ say: `At ${later}`, change: (draft) => { const r = L(draft.household, "people").find((x) => x.id === q.id); if (r) r.retirementAge = later; } }] : [],
        acts: [{ label: "Change ›", href: "#/household/people" }],
      });
    }

    // Social Security for each adult
    let ss = null;
    try { ss = socialSecurity(plan, { today }); } catch { ss = null; }
    for (const s of ss?.people ?? []) {
      const p = byId(s.id);
      if (!p || !(s.monthly > 0) || s.source === "none") continue;
      const guess = isGuess(plan, `retirement.socialSecurity.${s.id}.monthlyAtFRA`);
      const claim = Number(s.claimAge);
      const can = !s.claimed && Number.isFinite(claim) && claim < 70;
      rows.push({
        key: `ss:${s.id}`, name: `${nameOf(s.name)} Social Security`, label: `${NameOf(s.name)} Social Security`, value: `${money(s.monthly)} a month from ${Math.floor(claim)}`, short: `${money(s.monthly)} a month from ${Math.floor(claim)}`,
        tag: guess ? "guess" : "yours",
        alts: can ? [{ say: "Claimed at 70", change: (draft) => { draft.retirement.socialSecurity = draft.retirement.socialSecurity ?? {}; draft.retirement.socialSecurity[s.id] = { ...(draft.retirement.socialSecurity[s.id] ?? {}), claimAge: 70 }; } }] : [],
        note: guess ? "Our estimate from your pay; your real figure is on ssa.gov/myaccount." : null,
        acts: [{ label: guess ? "Type yours ›" : "When ›", href: "#/retirement/social-security" }],
      });
    }

    // how fast investments grow (D-A7: never offered as a fix; both directions)
    const a = plan.assumptions ?? {};
    const stocks = Number(a.returnStocks ?? 0.07), bonds = Number(a.returnBonds ?? 0.04);
    const atPreset = GROWTH_PRESETS.find((x) => Math.abs(x.value - stocks) < 1e-9);
    const growthAlts = (atPreset ? GROWTH_PRESETS.filter((x) => x !== atPreset) : GROWTH_PRESETS.filter((x) => x.name !== "Middle"))
      .map((x) => ({ say: `${x.name} ${pctWords(x.value)}`, change: (draft) => { draft.assumptions.returnStocks = x.value; } }));
    const gTag = assumptionTag(plan, "returnStocks", today) === "usual" && assumptionTag(plan, "returnBonds", today) === "usual" ? "usual" : "yours";
    rows.push({
      key: "growth", name: "how fast investments grow", label: "How fast investments grow", value: `stocks ${pctWords(stocks)} a year (bonds ${pctWords(bonds)}), before prices rise`, short: pctWords(stocks), tag: gTag, always: true,
      alts: growthAlts, note: "Nobody can choose this. Fix the plan with what you control: saving, when you stop, spending.",
      acts: [{ label: "Check ›", href: "#/system/assumptions?show=returnStocks" }],
    });

    // how fast prices rise
    const infl = Number(a.inflation ?? 0.03);
    rows.push({
      key: "prices", name: "how fast prices rise", label: "How fast prices rise", value: `${pctWords(infl)} a year`, short: pctWords(infl), tag: assumptionTag(plan, "inflation", today), always: true,
      alts: PRICE_STEPS.filter((x) => Math.abs(x - infl) > 1e-9).map((x) => ({ say: `At ${pctWords(x)}`, change: (draft) => { draft.assumptions.inflation = x; } })),
      acts: [{ label: "Check ›", href: "#/system/assumptions?show=inflation" }],
    });

    // how long the money must last
    const ownEnd = adults.some((p) => Number(p.lifeExpectancy) > 0);
    const ends = I.people.map((q) => q.endAge);
    rows.push({
      key: "plan-to", name: "how long the plan runs", label: "How long the money must last", value: I.people.length > 1 ? I.people.map((q) => `${nameIn(q.name)} to ${q.endAge}`).join(", ") : `to age ${ends[0]}`, short: ends.join(" and "),
      tag: ownEnd ? "yours" : assumptionTag(plan, "planEndAge", today),
      alts: [{ say: I.people.length > 1 ? "Five years longer each" : `To ${ends[0] + PLAN_TO_STEP}`, change: (draft) => {
        if (!ownEnd) { draft.assumptions.planEndAge = Number(draft.assumptions.planEndAge ?? 95) + PLAN_TO_STEP; return; }
        for (const q of I.people) { const r = L(draft.household, "people").find((x) => x.id === q.id); if (r) r.lifeExpectancy = q.endAge + PLAN_TO_STEP; }
      } }],
      acts: [{ label: "Check ›", href: ownEnd ? "#/retirement/longevity" : "#/system/assumptions?show=planEndAge" }],
    });

    // the share in stocks (in the fold only)
    const rt = plan.retirement ?? {};
    const now = Number(rt.stocksNow ?? 0.7), later = Number(rt.stocksRetired ?? 0.5);
    const clamp = (x) => Math.round(Math.min(1, Math.max(0, x)) * 100) / 100;
    rows.push({
      key: "mix", name: "the share in stocks", label: "How much is in stocks", value: `${Math.round(now * 100)}% now, ${Math.round(later * 100)}% once retired`, short: `${Math.round(now * 100)}% / ${Math.round(later * 100)}%`,
      tag: Math.abs(now - 0.7) < 1e-9 && Math.abs(later - 0.5) < 1e-9 ? "usual" : "yours", foldOnly: true,
      alts: [clamp(later - MIX_STEP), clamp(later + MIX_STEP)].filter((x) => Math.abs(x - later) > 1e-9).map((x) => ({ say: `${Math.round(x * 100)}% once retired`, change: (draft) => { draft.retirement.stocksRetired = x; } })),
      acts: [{ label: "Change ›", open: "settings" }],
    });
  }
  const counts = { yours: 0, guess: 0, usual: 0, missing: 0 };
  for (const r of rows) if (r.key !== "nothing-saved") counts[r.tag]++;
  return { ready: true, unknown, spendingYearly: b.spendingYearly, rows, counts, missing: rows.filter((r) => r.tag === "missing").map((r) => r.missingWords ?? r.name) };
}

/**
 * leverSteps(plan, { today, spare, money }): a generator (careful.js whenWorked drives it a slice at a time). Each step is one
 * projection; it returns leverList's result with, on each row, `effects` (sentences), `score` (D-A2) and `outs`, and
 * `shown` (the first five), `folded` (the rest) and `hidden` (Yours and Usual rows whose change moves the answer by less than
 * a year, except growth and prices, D-A2), and `base` (the answer as it is).
 */
export function* leverSteps(plan, { today, spare = null, money = dollars } = {}) {
  const list = leverList(plan, { today, spare, money });
  if (!list.ready) return { ...list, shown: [], folded: [], hidden: [], base: null };
  const base = answerOf(plan, { today });
  yield;
  for (const row of list.rows) {
    row.outs = [];
    for (const alt of row.alts) {
      let o = null;
      try { o = tryChange(plan, today, alt.change); } catch { o = null; }
      row.outs.push(o);
      yield;
    }
  }
  return finish(list, base, money);
}
/** leverRows(plan, opts) -> leverSteps' result, worked out at once. */
export function leverRows(plan, opts = {}) {
  const it = leverSteps(plan, opts);
  let r;
  do r = it.next(); while (!r.done);
  return r.value;
}

/**
 * The group a row is listed in (D-A2: not counted, our guess, the usual figure, yours). Builder's reading (2026-11-11): a zero the
 * person gave on a plan at work ("None" going in, "No match") is listed with the not-counted rows, whose zero it is the same as
 * for the answer; its tag still says Yours. So the owner's own examples (a 401(k) with nothing going in, a match said to be none)
 * come before the guesses, as the spec's acceptance walks expect.
 */
const groupOf = (r) => (r.tag === "yours" && r.zero && Math.abs(r.score ?? 0) >= 1 ? GROUP.missing : GROUP[r.tag]);

function finish(list, base, money) {
  for (const row of list.rows) {
    const outs = row.outs ?? [];
    const scores = outs.map((o) => scoreOf(o, base, list.spendingYearly));
    row.score = scores.length ? scores.reduce((m, s) => (Math.abs(s) > Math.abs(m) ? s : m), 0) : 0;
    // spending: a smaller figure that comes out worse is not shown (spec risk 3, gap 8: the loans a typed figure holds)
    row.worse = !!row.worseHides && scores.some((s) => s < -1e-9);
    row.effects = row.worse ? [] : row.alts.map((alt, i) => (outs[i] ? `${alt.say}: ${effectWords(outs[i], base, money, { would: row.would })}.` : null)).filter(Boolean);
    if (row.baseSay && base && !row.worse) row.effects.push(`${row.baseSay}: ${answerWords(base, money)}.`);
  }
  const hiddenRow = (r) => (r.tag === "yours" || r.tag === "usual") && !r.always && !r.ask && Math.abs(r.score) < 1;
  const ordered = list.rows.map((r, i) => ({ r, i })).sort((x, y) => (y.r.first ? 1 : 0) - (x.r.first ? 1 : 0) || (y.r.ask ? 1 : 0) - (x.r.ask ? 1 : 0) || groupOf(x.r) - groupOf(y.r) || Math.abs(y.r.score) - Math.abs(x.r.score) || x.i - y.i).map((x) => x.r);
  const visible = ordered.filter((r) => !hiddenRow(r));
  const shown = visible.filter((r) => !r.foldOnly).slice(0, SHOWN);
  const folded = visible.filter((r) => !shown.includes(r));
  return { ...list, base, shown, folded, hidden: ordered.filter(hiddenRow) };
}

/** The hero's line (worked out at once): "This answer rests on 7 numbers: 3 you gave us, 2 our guesses, 2 usual figures." */
export function restsOnWords(list) {
  const c = list?.counts ?? {};
  const n = (c.yours ?? 0) + (c.guess ?? 0) + (c.usual ?? 0);
  const parts = [[c.yours, "you gave us", "you gave us"], [c.guess, "our guess", "our guesses"], [c.usual, "usual figure", "usual figures"]].filter(([k]) => k > 0).map(([k, one, many]) => `${k} ${k === 1 ? one : many}`);
  const first = n ? `This answer rests on ${n} number${n === 1 ? "" : "s"}: ${parts.join(", ")}.` : "";
  const m = list?.missing ?? [];
  const list2 = m.length < 2 ? m.join("") : `${m.slice(0, -1).join(", ")} and ${m.at(-1)}`;
  const second = m.length ? `${m.length === 1 ? "1 thing is" : `${m.length} things are`} not counted yet: ${list2}.` : "";
  return [first, second].filter(Boolean).join(" ");
}

/**
 * The row values the "Before your change" line compares: { [key]: { name, short, cmp } }. `cmp` is what counts as a change the
 * person made: the value itself, except where a row says so (the money left over, while not answered, moves with every bill and
 * pay change: it is a result, never named as "You changed"; review 2026-11-12, B6).
 */
export const valuesOf = (list) => Object.fromEntries((list?.rows ?? []).map((r) => [r.key, { name: r.name, short: r.short, cmp: r.cmp ?? r.short }]));
/** The levers whose value the person changed between two drawings: [{ key, name, from, to }] (a row gone from the money left over: "now counted"). */
export function changedKeys(before = {}, after = {}) {
  const out = [];
  for (const [k, v] of Object.entries(after)) { const w = before[k]; if (w && (w.cmp ?? w.short) !== (v.cmp ?? v.short) && w.short !== v.short) out.push({ key: k, name: v.name, from: w.short, to: v.short }); }
  for (const [k, w] of Object.entries(before)) if (!(k in after) && k.startsWith("leftover")) out.push({ key: k, name: w.name, from: w.short, to: "now counted" });
  return out;
}
/** The levers whose value differs between two drawings, in words: "how fast investments grow (7% → 6%)". */
export function changedWords(before = {}, after = {}) {
  return changedKeys(before, after).map((x) => (x.to === "now counted" ? `${x.name} (now counted)` : `${x.name} (${x.from} → ${x.to})`));
}
