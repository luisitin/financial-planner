// modules/retirement/annuities/compute.js -- PURE and heavy. An income annuity quote (pay a sum now, get a
// monthly amount for life, from now or from a later age): the payout rate; the return it pays like over
// the lifetime you are likely to have (and for a couple, the longer of two); what a ladder of bonds paying
// the same until the plan's end would cost instead (the difference is what pooling the risk of a long
// life is worth); and what buying it does to your plan: the chance the money lasts, what you could
// spend, what is left at the end.
import { buildInputs } from "../projection/compute.js";
import { copyInputs } from "../../../core/math/retirement.js";
import { results } from "../../scenarios/compare/compute.js";
import { survival } from "../longevity/compute.js";
import { impliedRate } from "../pensions/compute.js";
import { ageOn } from "../../../core/math/dates.js";

export const TO_AGE = 115;
export const PATHS = 300;

/**
 * compute(plan, { today, paths }) -> {
 *   ready, missing, base (the plan as it is: results), quotes: [{ id, name, personId, personName, premium, monthly, startAge, cola, joint,
 *     payoutRate, rate (the return it pays like, nominal), ladderCost (bonds paying the same to the plan's end), ladderSaving (ladder - premium),
 *     withIt: results (the plan having bought it), floorShare (guaranteed income / spending in the first retirement year, before and after) }]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const paths = params.paths ?? PATHS;
  const b = buildInputs(plan, { today });
  const people = plan.household?.people ?? [];
  const raw = plan.retirement?.annuities ?? [];
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], quotes: [] };
  const I = b.inputs;
  const inflation = I.rates.inflation, bond = I.returns.bonds;
  const lg = plan.retirement?.longevity ?? {};
  const opts = (id) => ({ sex: lg[id]?.sex ?? "", health: lg[id]?.health ?? "average" });
  const base = results(I, { paths });
  const guaranteedShare = (inputs) => {
    const yr = inputs.retireYear;
    const g = (inputs.incomes ?? []).reduce((s, x) => { const pi = x.personIndex ?? 0; const age = yr - inputs.people[pi].birthYear; return s + (age >= x.startAge && (x.endAge === undefined || x.endAge === null || age <= x.endAge) ? x.yearly * (x.cola === false ? Math.pow(1 + inputs.rates.inflation, -(yr - inputs.startYear)) : 1) : 0); }, 0);   // a fixed-dollar payment, in today's dollars
    return inputs.spending.yearly > 0 ? g / inputs.spending.yearly : null;
  };
  const quotes = raw.map((q) => {
    const person = people.find((p) => p.id === q.personId) ?? people.find((p) => p.role === "self") ?? people[0];
    const pi = Math.max(0, I.people.findIndex((p) => p.id === person?.id));
    const ageNow = person?.birthDate && today ? ageOn(person.birthDate, today) : I.startYear - I.people[pi].birthYear;
    const premium = Math.max(0, Number(q.premium) || 0), monthly = Math.max(0, Number(q.monthly) || 0);
    const startAge = Math.max(ageNow, Number(q.startAge) || ageNow), cola = !!q.cola, joint = !!q.joint;
    const partner = people.find((p) => p.role !== "dependent" && p.id !== person?.id);
    const pAge = partner?.birthDate && today ? ageOn(partner.birthDate, today) : null;
    // the chance it is still paying t years from now: the person alive, or for a joint annuity either of the couple
    const paying = (t) => { const s1 = survival(ageNow, ageNow + t, opts(person?.id)); if (!joint || pAge === null) return s1; const s2 = survival(pAge, pAge + t, opts(partner.id)); return 1 - (1 - s1) * (1 - s2); };
    const n = TO_AGE - ageNow;
    const payments = [], alive = [];
    for (let t = 0; t <= n; t++) { const age = ageNow + t; payments.push(age >= startAge ? monthly * 12 * (cola ? Math.pow(1 + inflation, age - startAge) : 1) : 0); alive.push(paying(t)); }
    const rate = premium > 0 && monthly > 0 ? impliedRate(premium, payments, alive) : null;
    // a bond ladder paying the same every year until the plan's end, bought now at the plan's bond return
    const endAge = I.endYear - I.people[pi].birthYear;
    let ladderCost = 0;
    for (let t = 0; ageNow + t <= endAge; t++) ladderCost += payments[t] / Math.pow(1 + bond, t);
    // the plan having bought it: the premium out of savings now, the income from its start
    const T = copyInputs(I);
    T.events.push({ year: I.startYear, amount: premium, label: "annuity premium" });
    T.incomes.push({ name: q.name || "Annuity", yearly: monthly * 12, personIndex: pi, startAge, cola, taxable: true });
    const withIt = premium > 0 && monthly > 0 ? results(T, { paths }) : null;
    return { id: q.id, name: q.name || "Annuity quote", insurer: q.insurer ?? "", personId: person?.id ?? "", personName: person?.name ?? "", partnerName: joint && partner ? partner.name : null, ageNow, premium, monthly, startAge, cola, joint,
      payoutRate: premium > 0 ? monthly * 12 / premium : null, rate, ladderCost, ladderSaving: ladderCost - premium, endAge, withIt, floorBefore: guaranteedShare(I), floorAfter: guaranteedShare(T) };
  });
  return { ready: true, missing: [], base, quotes, bondRate: bond, inflation };
}
