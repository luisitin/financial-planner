// modules/scenarios/goal-seek/compute.js -- PURE and heavy. Pick the goal (the money lasts to the end
// of the plan, leaving at least so much) and every lever is solved for it on its own, everything else
// held as the plan has it: the most you can spend, the earliest you can retire, the saving it takes,
// the return it needs, the lump sum it is short (or the room it has today), and the Social Security
// claiming age that lets you spend the most.
import { project, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";

/** The largest x in [lo, hi] with ok(x) (ok true at lo, monotone), the bracket grown past hi while ok; null if ok(lo) fails. */
export function largestWhere(ok, lo, hi, tol = 0.5) {
  if (!ok(lo)) return null;
  for (let k = 0; k < 60 && ok(hi); k++) { lo = hi; hi = hi * 2 + 1; }
  for (let k = 0; k < 200 && hi - lo > tol; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
  return lo;
}
/** The smallest x in [lo, hi] with ok(x) (ok false at lo, monotone, true by hi); lo itself when ok(lo); null when ok(hi) fails. */
export function smallestWhere(ok, lo, hi, tol = 0.5) {
  if (ok(lo)) return lo;
  if (!ok(hi)) return null;
  for (let k = 0; k < 200 && hi - lo > tol; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return hi;
}

/**
 * compute(plan, { today, legacy = 0 }) -> {
 *   ready, missing, legacy, meets (the plan as it stands reaches the goal), endReal, spendingMonthly,
 *   levers: [{ id, title, icon, value, current, unit: "month"|"age"|"rate"|"once", status: "room"|"needs"|"cannot"|"same", sentence, go }]
 * }
 * Every money figure is in today's dollars. `legacy` is what the plan should still hold at its end.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const legacy = Math.max(0, Number(params.legacy) || 0);
  const fmt = (n) => fmtMoney(Math.round(n / 10) * 10, plan.meta?.currency ?? "USD");
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ready: false, missing: b.missing, legacy };
  const I = b.inputs;
  const meets = (inputs) => { const r = project(inputs); return r.success && r.endBalanceReal >= legacy - 0.5; };
  const base = project(I);
  const ok0 = meets(I);
  const levers = [];
  const add = (l) => levers.push(l);
  const spendingMonthly = I.spending.yearly / 12;

  // 1. spending: the most a month that still reaches the goal
  {
    const best = largestWhere((s) => meets({ ...copyInputs(I), strategy: "fixed-real", spending: { yearly: s } }), 0, Math.max(12000, I.spending.yearly * 2), 1);
    const m = best === null ? 0 : best / 12;
    add({ id: "spending", icon: "🛒", title: "What you can spend", value: m, current: spendingMonthly, unit: "month", status: best === null ? "cannot" : m >= spendingMonthly ? "room" : "needs",
      sentence: best === null ? "Even spending nothing in retirement does not reach the goal: look at the other levers." : m >= spendingMonthly ? `Up to about ${fmt(m)} a month, ${fmt(m - spendingMonthly)} more than the ${fmt(spendingMonthly)} the plan spends.` : `About ${fmt(m)} a month: ${fmt(spendingMonthly - m)} less than the ${fmt(spendingMonthly)} the plan spends.`, go: ["retirement", "projection"] });
  }

  // 2. the earliest retirement age for the first person that reaches the goal
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = adults.find((p) => p.role === "self") ?? adults[0];
  const ageNow = ageOn(self.birthDate, today);
  const retireAge = Number(self.retirementAge ?? plan.assumptions?.retirementAge ?? 65);
  const withPlan = (mutate) => { const p2 = JSON.parse(JSON.stringify(plan)); mutate(p2); return buildInputs(p2, { today }).inputs; };
  if (ageNow < retireAge) {
    let earliest = null;
    for (let a = Math.max(ageNow + 1, 45); a <= 75; a++) { const inp = withPlan((p) => { p.household.people.find((q) => q.id === self.id).retirementAge = a; }); if (inp && meets(inp)) { earliest = a; break; } }
    add({ id: "retire", icon: "🏖️", title: `When ${self.name || "you"} can retire`, value: earliest, current: retireAge, unit: "age", status: earliest === null ? "cannot" : earliest < retireAge ? "room" : earliest === retireAge ? "same" : "needs",
      sentence: earliest === null ? "Not by 75: working longer alone does not get there." : earliest < retireAge ? `As early as ${earliest}, ${retireAge - earliest} year${retireAge - earliest === 1 ? "" : "s"} before the plan's ${retireAge}.` : earliest === retireAge ? `At ${retireAge}, as planned: not a year earlier.` : `At ${earliest}: ${earliest - retireAge} year${earliest - retireAge === 1 ? "" : "s"} later than the plan's ${retireAge}.`, go: ["household", "people"] });
  }

  // 3. saving: the extra (or the cut) a month, before retirement, into the accounts already used (the first person's biggest contribution, else taxable)
  if (I.retireYear > I.startYear) {
    const now = I.contributions.reduce((s, c) => s + c.yearly, 0) / 12;
    const main = [...I.contributions].sort((x, y) => y.yearly - x.yearly)[0];
    const withSaving = (extra) => { const c = copyInputs(I); if (extra >= 0) c.contributions.push({ bucket: main?.bucket ?? "taxable", yearly: extra * 12, personIndex: main?.personIndex ?? 0, name: "extra" }); else { const f = now > 0 ? Math.max(0, 1 + extra / now) : 1; for (const x of c.contributions) x.yearly *= f; } return c; };
    const need = smallestWhere((e) => meets(withSaving(e)), -now, Math.max(5000, now * 10), 1);
    add({ id: "saving", icon: "🐖", title: "What you need to save", value: need === null ? null : now + need, current: now, unit: "month", status: need === null ? "cannot" : need <= -0.5 ? "room" : need < 0.5 ? "same" : "needs",
      sentence: need === null ? "No amount of saving gets there before retirement." : need <= -now + 0.5 ? `Nothing more: it gets there even if retirement saving stopped today (now ${fmt(now)} a month).` : need < -0.5 ? `About ${fmt(now + need)} a month would do: ${fmt(-need)} less than the ${fmt(now)} going in now.` : need < 0.5 ? `Exactly what goes in now, ${fmt(now)} a month.` : `About ${fmt(now + need)} a month, ${fmt(need)} more than the ${fmt(now)} going in now.`, go: ["retirement", "contributions"] });
  }

  // 4. the return it needs: stocks and bonds moved together
  {
    const shifted = (d) => { const c = copyInputs(I); c.returns.stocks += d; c.returns.bonds += d; return c; };
    const d = smallestWhere((x) => meets(shifted(x)), -0.15, 0.2, 0.0001);
    const mix = (I.rates.stocksNow + I.rates.stocksRetired) / 2;
    const blend = (x) => mix * (I.returns.stocks + x) + (1 - mix) * (I.returns.bonds + x);
    add({ id: "returns", icon: "📈", title: "The return it needs", value: d === null ? null : blend(d), current: blend(0), unit: "rate", status: d === null ? "cannot" : d < -0.0005 ? "room" : d < 0.0005 ? "same" : "needs",
      sentence: d === null ? "No believable return gets there on its own." : d < -0.0005 ? `About ${pct(blend(d))} a year on your mix would do, against the ${pct(blend(0))} you assume: ${pts(-d)} of room for bad luck.` : d < 0.0005 ? `About ${pct(blend(0))} a year, just what you assume: no room for bad luck.` : `About ${pct(blend(d))} a year on your mix, ${pts(d)} more than the ${pct(blend(0))} you assume.`, go: ["system", "assumptions"] });
  }

  // 5. a lump sum today: what it is short, or what could come out today and still get there
  {
    const withLump = (x) => { const c = copyInputs(I); c.events.push({ year: c.startYear, amount: -x, label: "lump sum" }); return c; };
    if (ok0) {
      const spare = largestWhere((x) => meets(withLump(-x)), 0, Math.max(10000, Object.values(I.balances).reduce((s, v) => s + v, 0)), 50);
      add({ id: "lump", icon: "💰", title: "Room today", value: spare ?? 0, current: 0, unit: "once", status: "room", sentence: `About ${fmt(spare ?? 0)} could come out of savings today and the plan would still get there. Not a suggestion to spend it: a measure of the cushion.`, go: ["balance", "net-worth"] });
    } else {
      const short = smallestWhere((x) => meets(withLump(x)), 0, 1e7, 50);
      add({ id: "lump", icon: "💰", title: "What it is short today", value: short, current: 0, unit: "once", status: short === null ? "cannot" : "needs", sentence: short === null ? "More than ten million dollars today: look at the other levers." : `About ${fmt(short)} more in savings today would get there (an inheritance, a sale, a bonus).`, go: ["balance", "net-worth"] });
    }
  }

  // 6. Social Security: the claiming age (everyone the same) that lets the plan spend the most while reaching the goal
  const ss = plan.retirement?.socialSecurity ?? {};
  if (I.incomes.some((x) => x.kind === "social") && Object.keys(ss).length) {
    const claims = [...new Set(Object.values(ss).map((s) => Number(s.claimAge) || 67))];
    let best = null;
    const results = [];
    for (let a = 62; a <= 70; a++) {
      const inp = withPlan((p) => { for (const id of Object.keys(p.retirement.socialSecurity)) p.retirement.socialSecurity[id].claimAge = a; });
      if (!inp) continue;
      const s = largestWhere((x) => meets({ ...copyInputs(inp), strategy: "fixed-real", spending: { yearly: x } }), 0, Math.max(12000, I.spending.yearly * 2), 5);
      results.push({ age: a, monthly: s === null ? 0 : s / 12 });
      if (s !== null && (!best || s / 12 > best.monthly + 0.5)) best = { age: a, monthly: s / 12 };
    }
    const nowAt = results.find((r) => r.age === Math.round(claims[0]));
    add({ id: "claim", icon: "🇺🇸", title: "When to claim Social Security", value: best?.age ?? null, current: claims.length === 1 ? claims[0] : null, unit: "age", status: !best ? "cannot" : claims.length === 1 && best.age === Math.round(claims[0]) ? "same" : "room", results,
      sentence: !best ? "No claiming age gets there on its own." : `Claiming at ${best.age} lets the plan spend the most, about ${fmt(best.monthly)} a month${nowAt && best.age !== nowAt.age ? `, ${fmt(best.monthly - nowAt.monthly)} more than claiming at ${nowAt.age}` : ""}. Everyone claims at the same age here; the Social Security page shows each person's amounts.`, go: ["retirement", "social-security"] });
  }

  return { ready: true, missing: [], legacy, meets: ok0, endReal: base.endBalanceReal, success: base.success, failYear: base.failYear, spendingMonthly, levers };
}

const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const pts = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)} percentage point${Math.round(x * 1000) === 10 ? "" : "s"}`;
