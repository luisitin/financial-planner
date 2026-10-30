// modules/scenarios/advisor-plan/compute.js -- PURE and heavy. An advisor's plan, as a scenario: their
// assumptions (returns, inflation, stock share, ages, spending) and their fee, run through the same
// engine as your own plan. Which of their assumptions makes the difference, one at a time; what the fee
// costs over the plan; and the chance of success they quoted against the one this app gets with their
// own assumptions.
import { buildInputs } from "../../retirement/projection/compute.js";
import { applyChanges, results, describe, LEVERS, PATHS } from "../compare/compute.js";

/** The levers an advisor's plan usually states (the fee is entered on its own). */
export const ADVISOR_LEVERS = ["returnStocks", "returnBonds", "inflation", "stocksNow", "stocksRetired", "retireAge", "claimAge", "spendingMonthly", "extraSavingMonthly"];

/**
 * compute(plan, { today, paths }) -> {
 *   ready, missing, entered (anything entered), firm, date, fee, quotedChance,
 *   yours, theirs, theirsNoFee (their assumptions without the fee), described: [text],
 *   effects: [{ key, text, roomMonthly (the change in the room a month, what it could spend less what it plans to, from that one assumption alone), endReal }] (largest first),
 *   feeCost: { endReal, affordableMonthly } (what the fee takes, with their other assumptions), chanceGap (their quote - this app's, same assumptions)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const paths = params.paths ?? PATHS;
  const A = plan.advisor ?? {};
  const changes = Object.fromEntries(Object.entries(A.changes ?? {}).filter(([k, v]) => v !== null && v !== "" && Number.isFinite(Number(v)) && ADVISOR_LEVERS.includes(k.split(":")[0])));
  const fee = Number(A.fee) > 0 ? Number(A.fee) : 0;
  const quotedChance = Number(A.quotedChance) > 0 ? Number(A.quotedChance) : null;
  const out = { firm: A.firm ?? "", date: A.date ?? "", fee, quotedChance, changes, entered: Object.keys(changes).length > 0 || fee > 0 || quotedChance !== null };
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ...out, ready: false, missing: b.missing ?? [] };
  const yours = results(b.inputs, { paths });
  if (!out.entered) return { ...out, ready: true, missing: [], yours, theirs: null, effects: [], described: [] };
  const run = (ch) => { const a = applyChanges(plan, ch, { today }); return a.inputs ? results(a.inputs, { paths }) : null; };
  const theirs = run({ ...changes, ...(fee ? { fee } : {}) });
  const theirsNoFee = fee ? run(changes) : theirs;
  // one assumption at a time, against your plan
  const effects = [];
  const quick = (ch) => { const a = applyChanges(plan, ch, { today }); return a.inputs ? results(a.inputs, { paths: 0 }) : null; };
  for (const [k, v] of Object.entries({ ...changes, ...(fee ? { fee } : {}) })) {
    const r = quick({ [k]: v });
    if (!r) continue;
    // the room a month (what it could spend less what it plans to spend) moves with every assumption, spending included
    effects.push({ key: k, text: describe(plan, { [k]: v })[0] ?? k, roomMonthly: (r.affordableMonthly - r.spendingMonthly) - (yours.affordableMonthly - yours.spendingMonthly), endReal: r.endReal - yours.endReal });
  }
  effects.sort((x, y) => Math.abs(y.roomMonthly) - Math.abs(x.roomMonthly));
  return {
    ...out, ready: true, missing: [], yours, theirs, theirsNoFee, described: describe(plan, { ...changes, ...(fee ? { fee } : {}) }), effects,
    feeCost: fee && theirsNoFee ? { endReal: theirsNoFee.endReal - theirs.endReal, affordableMonthly: theirsNoFee.affordableMonthly - theirs.affordableMonthly } : null,
    chanceGap: quotedChance !== null && theirs?.chance !== null ? quotedChance - theirs.chance : null,
    leverKeys: LEVERS.filter((l) => ADVISOR_LEVERS.includes(l.key)).map((l) => l.key),
  };
}
