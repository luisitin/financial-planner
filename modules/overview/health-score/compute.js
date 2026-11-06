// modules/overview/health-score/compute.js -- PURE and heavy. One number from 0 to 100 for the whole
// plan, built from seven parts, each scored from the page that works it out: the cash cushion, how
// much of each month's money is saved, debt, whether retirement is on track, protection (the stress
// tests' life shocks), goals, and whether the plan knows enough and is up to date. Every part says
// what it would take to earn the points it is missing.
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities, rentsHome, DTI_LINES, shownShare } from "../../balance/liabilities/compute.js";
import { compute as computeProjection, householdRetired, ssOnIncome, retirementKnown } from "../../retirement/projection/compute.js";
import { retirementGap } from "../setup/compute.js";
import { compute as computeStress } from "../../scenarios/stress-tests/compute.js";
import { compute as computeGoalSeek } from "../../scenarios/goal-seek/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeNext, monthWords } from "../next-best-action/compute.js";
import { goalsBehind } from "../alerts/compute.js";
import { daysBetween } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";

/** The parts and their weights (they add to 100). */
export const PARTS = { cushion: 15, saving: 15, debt: 15, retirement: 25, protection: 15, goals: 5, knows: 10 };
/** A healthy share of after-tax income saved (retirement, goals and what is left over): 20%, the "20" of the 50/30/20 rule. */
export const SAVING_TARGET = 0.2;
/** Lenders' line for total debt payments against gross income (the qualified-mortgage rule's 43%); 36% is the comfortable one. */
export const DTI = { good: 0.36, max: 0.43 };
/** The retirement part's full marks: the plan can carry 115% of the spending it plans (room for bad luck). */
export const FULL_RETIREMENT = 1.15;
export const BANDS = [{ min: 85, label: "Strong" }, { min: 70, label: "Good" }, { min: 50, label: "Fair" }, { min: 0, label: "Needs work" }];

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * compute(plan, { today }) -> {
 *   ready, missing, score (0-100, whole), band, parts: [{ id, title, points, max, share, status: "ok"|"warn"|"bad"|"unknown", detail, fix, go,
 *            hint?, query? (retirement only: the ways without the score's words; Goal seek's target for the link) }],
 *   gains: parts sorted by points missing (largest first)
 * }
 * A part the plan cannot judge yet scores 0 with status "unknown" and a fix that says what to add.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const parts = [];
  const add = (id, title, share, detail, fix, go, status) => {
    const max = PARTS[id];
    const s = share === null ? 0 : clamp01(share);
    parts.push({ id, title, max, points: Math.round(s * max * 10) / 10, share: share === null ? null : s, status: status ?? (share === null ? "unknown" : s >= 0.9 ? "ok" : s >= 0.5 ? "warn" : "bad"), detail, fix: s >= 0.999 ? null : fix, go });
  };

  // 1. the cash cushion: months of must-pay bills in usable cash against the plan's target
  const liq = computeLiquidity(plan, { today });
  if (liq.runwayMonths === null) add("cushion", "Cash cushion", null, "No must-pay expenses yet, so the cushion cannot be measured.", "Add your expenses and mark the ones you cannot skip.", ["cashflow", "expenses"]);
  else add("cushion", "Cash cushion", liq.runwayMonths / liq.targetMonths, `Usable cash covers ${Math.round(liq.runwayMonths * 10) / 10} months of must-pay bills; the plan aims for ${liq.targetMonths}.`, `${money(liq.gap)} more in cash you can reach in a day fills it.`, ["balance", "liquidity"]);

  // 2. saving: retirement, goals and what is left over, as a share of income after tax
  const nb = computeNext(plan, { today });
  if (!nb.ready) add("saving", "Saving each month", null, "Income and expenses are needed to see how much of each month is saved.", "Fill in the Income and Expenses pages.", ["cashflow", "income"]);
  // retired and drawing from savings as the plan intends: the saving rule is for working years, so full marks
  else if (nb.drawing) add("saving", "Saving each month", 1, `Retired: about ${money(-nb.spare.monthly)} a month comes from savings, inside what the plan can carry (${money(nb.drawing.affordableMonthly)} a month).`, null, ["retirement", "projection"]);
  else {
    // on the careful month, as the spare is: side income above what you count on (after its tax) is off both sides (review 2026-11-02)
    const s = nb.spare, afterTax = s.gross - (s.businessCosts ?? 0) - s.federalTax - s.payrollTax - (s.stateTax ?? 0) - (s.held ?? 0);
    // the saved debt plan's extra pays down what is owed: it adds to what you are worth as surely as saving does
    const saved = s.retirementSaving + s.goalSaving + (s.debtExtra ?? 0) + s.monthly;
    const rate = afterTax > 0 ? saved / afterTax : 0;
    // short on the careful month: said so, with what a month that brings the Income page's amount leaves (review 2026-11-02;
    // Next best action's spare.full, said as its fullAbout, the one figure every page shows, round 5)
    // within $5 of $0 it "only just about breaks even" (fullKind), never "about $0" (round 5)
    const full = s.full ?? s.monthly + (s.held ?? 0), about = s.fullAbout ?? full, kind = s.fullKind ?? (full >= 0 ? "ahead" : "short");
    const shortWords = `About ${money(-s.monthly)} a month more goes out than comes in after tax${(s.held ?? 0) > 0.5 ? `, counting uneven pay at what you can count on (Side income); a month that brings the Income page's amount ${kind === "ahead" ? `leaves about ${money(about)}` : kind === "even" ? "only just about breaks even" : `is still about ${money(-about)} short`}` : ""}.`;
    add("saving", "Saving each month", rate / SAVING_TARGET, rate >= 0 ? `About ${Math.round(rate * 100)}% of income after tax is saved or left over (retirement ${money(s.retirementSaving)}, goals ${money(s.goalSaving)}${s.debtExtra ? `, extra on debts ${money(s.debtExtra)}` : ""}, spare ${money(Math.max(0, s.monthly))} a month).` : shortWords, `Saving ${Math.round(SAVING_TARGET * 100)}% of income after tax earns full marks: about ${money(Math.max(0, SAVING_TARGET * afterTax - saved))} a month more.`, ["overview", "next-best-action"]);
  }

  // 3. debt: expensive balances against a year's income, and the share of income that goes to payments
  const li = computeLiabilities(plan, { today });
  const yearly = nb.ready ? nb.spare.gross * 12 : (li.income ?? 0) * 12;
  const expensive = li.rows.filter((r) => r.owed > 0 && r.rate !== null && r.rate >= 0.1 && r.type !== "mortgage");
  const expensiveOwed = expensive.reduce((s, r) => s + r.owed, 0);
  const highShare = yearly > 0 ? 1 - Math.min(1, expensiveOwed / (yearly * 0.25)) : expensiveOwed > 0 ? 0 : 1;
  // a renter's required payments against the renters' line, rent not counted (round 8, 2026-11-06; CFPB: 15 to 20% or less):
  // full to 20%, half to 36%; a homeowner's payments against 36% (half to 43%) as before. Review (2026-11-06): a renter's share
  // is of the required payments, as a lender counts them (an extra chosen on top cost points), and every share is graded at
  // the whole percent the words show (liabilities shownShare: 20.3% read "20% ... 20% or less" with half marks)
  const renter = li.dti !== null && rentsHome(plan, li.rows);
  const line = renter ? { good: DTI_LINES.renter.good, max: DTI_LINES.renter.high } : DTI;
  const dtiShown = shownShare(renter ? li.dtiRequired : li.dti);
  const dtiShare = dtiShown === null ? 1 : dtiShown <= line.good + 1e-9 ? 1 : dtiShown <= line.max + 1e-9 ? 0.5 : 0;
  const dtiWords = dtiShown === null ? "" : renter ? `Required payments take ${Math.round(dtiShown * 100)}% of gross income; for renters the guideline is ${Math.round(line.good * 100)}% or less (rent not counted).` : `Payments take ${Math.round(dtiShown * 100)}% of gross income${dtiShown > DTI.good + 1e-9 ? `; lenders like ${Math.round(DTI.good * 100)}% or less` : ""}.`;
  add("debt", "Debt", (highShare * 2 + dtiShare) / 3, [expensiveOwed > 0 ? `${money(expensiveOwed)} of debt at 10% or more (${expensive.map((r) => r.name).join(", ")}).` : "No debt at 10% or more.", dtiWords].join(" "), expensiveOwed > 0 ? `Paying off ${expensive.map((r) => r.name).join(" and ")} earns these points back fastest.` : `Bring debt payments under ${Math.round(line.good * 100)}% of gross income.`, ["debt", "payoff"]);

  // 4. retirement: the spending the plan can carry against the spending it plans
  const pr = computeProjection(plan, { today });
  // whether the money lasts is judged only once Social Security is known for each adult (an estimate, typed on Income, or
  // "none") with birth dates, as the Dashboard does (projection's retirementKnown): without it the plan runs short and the
  // score said "runs out in 2067" and asked for $3,040 a month less spending (round 4, 2026-11-02)
  const known = retirementKnown(plan, today);
  // what is missing, named: a birth date goes to People, Social Security to its page (setup's retirementGap, review 2026-11-02)
  const gap = known ? null : retirementGap(plan);
  if (!pr.ready) add("retirement", "Retirement on track", null, "The plan cannot be run yet.", `Add ${pr.missing.join(" and ")}.`, ["retirement", "projection"]);
  else if (!known) add("retirement", "Retirement on track", null, `Not scored yet: whether the money lasts needs ${gap?.what ?? "Social Security and birth dates"}.`, gap?.fix ?? "Add Social Security on the Social Security page.", gap?.go ?? ["retirement", "social-security"]);
  else {
    const ratio = pr.spendingYearly > 0 ? pr.affordable / pr.spendingYearly : 1;
    const ways = ratio < FULL_RETIREMENT ? retirementWays(plan, { today, ratio, money }) : null;
    add("retirement", "Retirement on track", (ratio - 0.6) / 0.55, pr.result.success ? `The plan can carry about ${money(pr.affordable / 12)} a month against the ${money(pr.spendingYearly / 12)} it plans (${Math.round(ratio * 100)}%).` : `The money runs out in ${pr.shortYear}: it can carry about ${money(pr.affordable / 12)} a month against the ${money(pr.spendingYearly / 12)} planned.`, ways ? hintText(ways) : null, ["scenarios", "goal-seek"]);
    // the link opens Goal seek on the target the hint was worked out for ("Just last"), and the hint without the score's own
    // words for reports that say how to make the money last (Plan summary)
    if (ways) Object.assign(parts[parts.length - 1], { hint: ways.text, ...(ways.query ? { query: ways.query } : {}) });
  }

  // 5. protection: the stress tests' life shocks (job loss, never working again, a death, a care home, a long life)
  const st = pr.ready && known ? computeStress(plan, { today }) : null;
  const life = st?.ready ? st.scenarios.filter((s) => s.group === "life") : [];
  if (pr.ready && !known) add("protection", "Protection", null, `Not scored yet: the stress tests need ${gap?.what ?? "Social Security"} first, like the retirement part.`, "Scored as soon as the retirement part above is.", gap?.go ?? ["retirement", "social-security"]);
  else if (!life.length) add("protection", "Protection", null, "The stress tests need the plan basics first.", "Fill in the basics on Will the money last?", ["scenarios", "stress-tests"]);
  else {
    const passed = life.filter((s) => s.success);
    const failed = life.filter((s) => !s.success);
    add("protection", "Protection", passed.length / life.length, failed.length ? `The money lasts through ${passed.length} of ${life.length} of life's shocks; not "${failed.map((s) => s.title).join('" or "')}".` : `The money lasts through all ${life.length} of life's shocks in the stress tests.`, failed.some((s) => s.id.startsWith("death-") || s.id === "disability") ? "Life and disability insurance are what close these gaps; the stress tests show how much each shock is short." : "The stress tests show what each shock is short.", ["scenarios", "stress-tests"]);
  }

  // 6. goals: dated goals on track or done
  const gl = computeGoals(plan, { today });
  const dated = gl.goals.filter((g) => g.targetDate && g.status !== "no amount");
  if (!dated.length) add("goals", "Goals", null, "No goals with a date yet.", "Add what you are saving for, with a date, on the Goals page.", ["goals", "goals"]);
  else {
    // a goal waiting its turn on Next best action (nothing in yet, still reachable from then) is not behind: Goals, Timeline,
    // Needs attention and the Dashboard say "starts later", so it counts as on track here too (review 2026-11-02)
    let nba = null;
    try { nba = dated.some((g) => g.status === "behind") ? computeNext(plan, { today }) : null; } catch { nba = null; }
    const gb = goalsBehind(gl, { nba, today });
    const waiting = dated.filter((g) => gb.queued.some((q) => q.id === g.id));
    const good = dated.filter((g) => g.status === "done" || g.status === "on track" || waiting.includes(g));
    const short = dated.filter((g) => !good.includes(g));
    const later = waiting.length ? `${waiting.map((g) => g.name).join(", ")}: saving for ${waiting.length === 1 ? "it" : "them"} starts in ${monthWords(gb.turn)}, when ${waiting.length === 1 ? "its" : "their"} turn comes on Next best action.` : "";
    add("goals", "Goals", good.length / dated.length, `${good.length} of ${dated.length} goals with a date are done or on track${waiting.length ? `, counting ${waiting.length === 1 ? "one" : waiting.length} waiting ${waiting.length === 1 ? "its" : "their"} turn` : ""}.`,
      short.length ? `${short.map((g) => g.name).join(", ")} ${short.length === 1 ? "needs" : "need"} more each month (Goals).${later ? ` ${later}` : ""}` : later, ["goals", "goals"]);
  }

  // 7. the plan knows enough, and it is current
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const ss = plan.retirement?.socialSecurity ?? {};
  const checks = [
    ["birth dates for every adult", people.length > 0 && people.every((p) => p.birthDate)],
    ["accounts", (plan.accounts ?? []).length > 0],
    ["balances updated in the last 90 days", (plan.accounts ?? []).length > 0 && (plan.accounts ?? []).every((a) => a.asOf && daysBetween(a.asOf, today) <= 90)],
    ["income and expenses", (plan.income ?? []).length > 0 && (plan.expenses ?? []).length > 0],
    ["a Social Security figure for every adult", people.length > 0 && people.every((p) => (ss[p.id] && (Number(ss[p.id].monthlyAtFRA) > 0 || (ss[p.id].record ?? []).length)) || ssOnIncome(plan, p.id, today))],
    // retired: what they spend now is what they spend in retirement (the setup does not ask it)
    ["what you will spend in retirement", Number(plan.retirement?.spendingMonthly) > 0 || householdRetired(plan, { today })],
    ["assumptions looked over in the last year", !!plan.assumptions?.reviewedAt && daysBetween(plan.assumptions.reviewedAt, today) <= 365],
  ];
  const have = checks.filter((c) => c[1]);
  add("knows", "The plan knows enough", have.length / checks.length, have.length === checks.length ? "Everything the score leans on is filled in and current." : `${have.length} of ${checks.length} things the score leans on are filled in and current.`, `Still to do: ${checks.filter((c) => !c[1]).map((c) => c[0]).join("; ")}.`, ["overview", "alerts"]);

  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  const band = BANDS.find((b) => score >= b.min).label;
  const gains = [...parts].filter((p) => p.max - p.points >= 0.5).sort((a, b) => (b.max - b.points) - (a.max - a.points));
  return { ready: true, missing: [], score, band, parts, gains };
}

/**
 * retirementWays(plan, { today, ratio, money }) -> { text, query | null, scale }: what earns the retirement part's missing
 * points, in Goal seek's own answers for the target it names (round 8, 2026-11-06). It said "(1.15 x planned yearly - affordable)
 * / 12 a month less spending, or the same in more saving or later retirement": a yearly gap in retirement spending put as a
 * monthly cut (and as a saving), $2,350 for a renter whose page of levers says $240 a month more saving and whose planned
 * spending is $2,040. Short of lasting (ratio < 1) the target is the money lasting, as Goal seek's "Just last"; lasting but
 * under 115% it is 115% of the planned spending (Goal seek's `spendingScale`). A lever is named only when Goal seek gets there
 * with it: more saving a month (its saving lever's value less what goes in now), a later retirement age, or less spending
 * (planned - what the plan can carry / the target, never as much as the planned spending; dropped when spending alone cannot
 * get there).
 * Review (2026-11-06):
 *  - Goal seek runs on steady spending (strategy "fixed-real"), the score's own measure (projection affordableSpending): under a
 *    rule that never runs out (a share of what is left, guardrails, years left) its saving lever said "Nothing more" and the
 *    hint dropped it; the lead then says "To carry the planned spending every year".
 *  - Where the figures can be seen, in a sentence of its own: 'Goal seek shows it (each) on "Just last".' with `query`
 *    { target: "last" } (the score's link opens Goal seek there, whatever Legacy goals holds) only when the page works them the
 *    same way (steady spending, the money lasting); otherwise "Worked out as Goal seek does, ...", since the page has no 115%
 *    target and works saving on the plan's own rule.
 *  - A spending cut of more than half the planned spending is left out when another way gets there (a couple short only in the
 *    two years before Social Security read "save about $70 ... or spend about $2,040 a month less"); Goal seek still shows it.
 */
export function retirementWays(plan, { today, ratio, money }) {
  const scale = ratio < 1 ? 1 : FULL_RETIREMENT;
  const steady = (plan.retirement?.strategy ?? "fixed-real") === "fixed-real";
  const lead = scale !== 1 ? `Full marks at ${Math.round(FULL_RETIREMENT * 100)}% (room for bad luck)` : steady ? "To make the money last" : "To carry the planned spending every year";
  const onPage = scale === 1 && steady;
  // where the figures come from, in a sentence of its own (a way can end in a name in brackets: "retire at 68 (Ana)")
  const where = (n) => onPage ? `Goal seek shows ${n === 1 ? "it" : "each"} on "Just last".` : `Worked out as Goal seek does${steady ? "" : ", spending the same every year"}${scale !== 1 ? `, for ${Math.round((FULL_RETIREMENT - 1) * 100)}% more spending than you plan` : ""}.`;
  const query = onPage ? { target: "last" } : null;
  const asked = steady ? plan : { ...plan, retirement: { ...(plan.retirement ?? {}), strategy: "fixed-real" } };
  let gs = null;
  try { gs = computeGoalSeek(asked, { today, only: ["spending", "retire", "saving"], retireSearch: "bisect", ...(scale !== 1 ? { spendingScale: scale } : {}) }); } catch { gs = null; }
  if (!gs?.ready) return { text: `${lead}: Goal seek shows what each change would take.`, query, scale };
  const lever = (id) => gs.levers.find((l) => l.id === id) ?? null;
  const ways = [];
  const save = lever("saving");
  if (save?.status === "needs" && save.value !== null && save.value - save.current >= 5) ways.push(`save about ${money(save.value - save.current)} a month more`);
  const ret = lever("retire");
  // one adult: "retire at 67"; with two, whose age it is
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").length;
  if (ret?.status === "needs" && ret.value !== null) { const who = /^When (.+) can retire$/.exec(ret.title)?.[1]; ways.push(`retire at ${ret.value}${adults > 1 && who ? ` (${who})` : ""}`); }
  const spend = lever("spending");
  if (spend && spend.status !== "cannot" && spend.value !== null) {
    const planned = gs.spendingMonthly / scale, cut = planned - spend.value / scale;
    if (cut >= 5 && cut < planned && (cut <= planned / 2 || !ways.length)) ways.push(`spend about ${money(cut)} a month less`);
  }
  if (!ways.length) return { text: `${lead}: no one change gets there on its own; Goal seek shows what each would take.`, query, scale };
  return { text: `${lead}: ${ways.length === 1 ? ways[0] : `${ways.slice(0, -1).join(", ")} or ${ways[ways.length - 1]}`}. ${where(ways.length)}`, query, scale };
}
/** hintText(ways) -> the score's hint: the ways, and short of lasting, that full marks need room for bad luck on top. */
const hintText = (w) => `${w.text}${w.scale === 1 ? " Full marks need some room for bad luck on top of that." : ""}`;
/** retirementHint(plan, { today, ratio, money }) -> the score's hint text (retirementWays, with the score's own words). */
export function retirementHint(plan, opts) { return hintText(retirementWays(plan, opts)); }
