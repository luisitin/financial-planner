// modules/estate/legacy/compute.js -- PURE and heavy. What you want to leave and to whom: people and
// causes, as amounts in today's money. Their total, less the home if it is part of what you leave, is
// the amount the plan aims to still have at its end. Does the plan leave it, and if not, what would:
// each lever solved by Goal seek with that amount as the goal.
import { project } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { compute as computeGoalSeek } from "../../scenarios/goal-seek/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";

export const KINDS = { person: "A person", charity: "A charity or cause" };

/** The amount the plan should still hold at its end for the legacy: the bequests' total, less the home when it is part of it. Also Goal seek's starting goal. */
export function legacyTarget(plan) {
  const L = plan.estate?.legacy ?? {};
  const total = (L.bequests ?? []).reduce((s, b) => s + Math.max(0, Number(b.amount) || 0), 0);
  const home = L.includeHome ? (plan.accounts ?? []).filter((a) => a.type === "property").reduce((s, a) => s + countedBalance(a), 0) : 0;
  return { total, home, target: Math.max(0, total - home) };
}

/**
 * compute(plan, { today }) -> {
 *   bequests: [{ id, to, kind, kindLabel, amount, share (of the total) }], total, people, charity, home, includeHome, target,
 *   ready, missing, endReal (what the plan leaves in investments, today's dollars), meets, gap, levers (Goal seek's, for the target) | null
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const L = plan.estate?.legacy ?? {};
  const t = legacyTarget(plan);
  const bequests = (L.bequests ?? []).map((b) => ({ id: b.id, to: b.to ?? "", kind: KINDS[b.kind] ? b.kind : "person", kindLabel: KINDS[b.kind] ?? KINDS.person, amount: Math.max(0, Number(b.amount) || 0), notes: b.notes ?? "", share: t.total > 0 ? Math.max(0, Number(b.amount) || 0) / t.total : 0 }));
  const sum = (kind) => bequests.filter((b) => b.kind === kind).reduce((s, b) => s + b.amount, 0);
  const out = { bequests, total: t.total, people: sum("person"), charity: sum("charity"), home: t.home, includeHome: !!L.includeHome, target: t.target };
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ...out, ready: false, missing: b.missing ?? [] };
  const r = project(b.inputs);
  const endReal = Math.max(0, r.endBalanceReal);
  const meets = r.success && endReal >= t.target - 0.5;
  const gs = t.target > 0 ? computeGoalSeek(plan, { today, legacy: t.target }) : null;
  return { ...out, ready: true, missing: [], endReal, success: r.success, meets, gap: Math.max(0, t.target - endReal), endYear: b.inputs.endYear, levers: gs?.ready ? gs.levers : null };
}
