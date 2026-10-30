// modules/retirement/pensions/compute.js -- PURE. Each pension as what it is worth: the monthly amount and
// what inflation does to it without cost-of-living raises, its expected value over the lifetime it is
// likely to pay for (the survival curve from How long to plan for), the lump sum against the monthly
// payments (the return the pension pays like, and how long you must live for it to pay more), and the
// survivor option against the single-life one, weighted by both of your chances of living each year.
import { survival } from "../longevity/compute.js";
import { rateFor } from "../../../core/math/finance.js";
import { ageOn } from "../../../core/math/dates.js";

/** The oldest age the sums run to. */
export const TO_AGE = 115;

/** The yearly payments of a pension from its start, in today's dollars: level with a cost-of-living raise, worth less each year without one (fixed in dollars from today, like the projection treats it). */
export function realPayment(monthly, cola, inflation, yearsFromNow) { return monthly * 12 * (cola ? 1 : Math.pow(1 + inflation, -yearsFromNow)); }

/** Expected value at the start of a stream paid while someone is alive: sum over years of payment x the chance of being alive (given alive at the start) / (1 + r)^t. */
export function expectedValue({ payments, alive, rate }) {
  let v = 0;
  for (let t = 0; t < payments.length; t++) v += payments[t] * alive[t] / Math.pow(1 + rate, t);
  return v;
}

/** The rate at which a lump sum equals the expected payments (payments at the start of each year), by bisection in (-50%, 100%): Infinity when the payments are worth more even at 100% (a small lump sum), -Infinity when the lump sum is worth more even at -50%. */
export function impliedRate(lump, payments, alive) {
  const f = (r) => expectedValue({ payments, alive, rate: r }) - lump;
  let lo = -0.5, hi = 1;
  if (f(hi) > 0) return Infinity;
  if (f(lo) < 0) return -Infinity;
  for (let k = 0; k < 200 && hi - lo > 1e-10; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/**
 * compute(plan, { today }) -> {
 *   items: [{ id, name, personId, personName, monthly, startAge, cola, ageNow, startYear, endAge,
 *     atEightyFive (the monthly at 85 in today's dollars), lifetime (expected value at the start, today's dollars, discounted at the real bond return),
 *     lump: { amount, rate (the nominal return the pension pays like), breakevenAge (when the payments, undiscounted, pass the lump), verdict } | null,
 *     survivor: { monthly (the joint option), share, partnerName, single (expected value of the single-life option), joint, better: "joint"|"single"|"close", survivorMonthly } | null }],
 *   fromIncome: [{ name, monthly }] (pensions on the Income page, counted by the plan, edited there), realRate, nominalRate, totalMonthly
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : 2026;
  const a = plan.assumptions ?? {};
  const inflation = Number(a.inflation ?? 0.03), nominalRate = Number(a.returnBonds ?? 0.04);
  const realRate = (1 + nominalRate) / (1 + inflation) - 1;
  const people = plan.household?.people ?? [];
  const lg = plan.retirement?.longevity ?? {};
  const opts = (id) => ({ sex: lg[id]?.sex ?? "", health: lg[id]?.health ?? "average" });
  const ageOf = (p) => (p?.birthDate && today ? ageOn(p.birthDate, today) : null);
  const items = (plan.retirement?.pensions ?? []).map((x) => {
    const person = people.find((p) => p.id === x.personId) ?? people.find((p) => p.role === "self") ?? people[0];
    const ageNow = ageOf(person) ?? 60;
    const monthly = Math.max(0, Number(x.monthly) || 0), startAge = Number(x.startAge) || 65, cola = x.cola !== false;
    const endAge = Number(x.endAge) > 0 ? Number(x.endAge) : TO_AGE;
    const start = Math.max(startAge, ageNow);
    const n = Math.max(0, Math.min(endAge, TO_AGE) - start + 1);
    const o = opts(person?.id);
    const alive = Array.from({ length: n }, (_, t) => survival(start, start + t, o));
    const payments = Array.from({ length: n }, (_, t) => realPayment(monthly, cola, inflation, start + t - ageNow));
    const lifetime = expectedValue({ payments, alive, rate: realRate });
    // the lump sum, offered at the start, against the payments in the dollars they are paid (nominal)
    let lump = null;
    if (Number(x.lumpSum) > 0) {
      const amount = Number(x.lumpSum);
      const nominal = Array.from({ length: n }, (_, t) => monthly * 12 * (cola ? Math.pow(1 + inflation, t) : 1));
      const rate = impliedRate(amount, nominal, alive);
      let sum = 0, breakevenAge = null;
      for (let t = 0; t < n; t++) { sum += nominal[t]; if (sum >= amount) { breakevenAge = start + t + 1; break; } }
      const verdict = rate > nominalRate + 0.005 ? "monthly" : rate < nominalRate - 0.005 ? "lump" : "close";
      lump = { amount, rate, breakevenAge, verdict, chanceToBreakeven: breakevenAge ? survival(start, breakevenAge, o) : 0 };
    }
    // the survivor option: a lower monthly while both live, the share of it to the partner after
    let survivor = null;
    const partner = people.find((p) => p.role !== "dependent" && p.id !== person?.id);
    if (partner && Number(x.jointMonthly) > 0 && Number(x.survivorShare) > 0) {
      const pAge = ageOf(partner) ?? ageNow;
      const po = opts(partner.id);
      const jm = Number(x.jointMonthly), share = Number(x.survivorShare);
      const pAlive = Array.from({ length: n }, (_, t) => survival(pAge + (start - ageNow), pAge + (start - ageNow) + t, po) * survival(pAge, pAge + (start - ageNow), po));
      const pay = (m, t) => realPayment(m, cola, inflation, start + t - ageNow);
      let single = 0, joint = 0;
      for (let t = 0; t < n; t++) {
        const d = Math.pow(1 + realRate, -t);
        single += pay(monthly, t) * alive[t] * d;
        joint += (pay(jm, t) * alive[t] + pay(jm * share, t) * (1 - alive[t]) * pAlive[t]) * d;
      }
      survivor = { monthly: jm, share, partnerName: partner.name, survivorMonthly: jm * share, single, joint, better: joint > single * 1.02 ? "joint" : joint < single * 0.98 ? "single" : "close" };
    }
    return { id: x.id, name: x.name || "Pension", personId: person?.id ?? "", personName: person?.name ?? "", monthly, startAge, cola, ageNow, startYear: year + Math.max(0, startAge - ageNow), endAge: Number(x.endAge) || null, atEightyFive: cola ? monthly : monthly * Math.pow(1 + inflation, -(Math.max(85, start) - ageNow)), lifetime, lump, survivor };
  });
  const fromIncome = (plan.income ?? []).filter((x) => x.type === "pension").map((x) => ({ name: x.name, monthly: (Number(x.amount) || 0) * ({ weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1 }[x.period] ?? 12) / 12 }));
  return { items, fromIncome, realRate, nominalRate, inflation, totalMonthly: items.reduce((s, x) => s + x.monthly, 0) };
}
