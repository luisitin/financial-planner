// modules/insurance/ltc/compute.js -- PURE and heavy. Long-term care: the odds, what it costs, and
// whether the plan can pay for it on its own. Each adult's care (the kind, from what age, for how
// long, what it costs where you live) is dropped into the plan on top of normal spending: how many
// years of care the savings could carry and still last, and what a long-term care policy on file
// changes, against the premiums it costs until then.
import { project, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { survival } from "../../retirement/longevity/compute.js";
import { compute as computePolicies } from "../policies/compute.js";
import { largestWhere, smallestWhere } from "../../scenarios/goal-seek/compute.js";
import { ageOn } from "../../../core/math/dates.js";

/** National medians, a year, 2024 (CareScout / Genworth Cost of Care Survey 2024, released March 2025). Home care is 44 hours a week; adult day care 5 days a week. */
export const CARE = {
  nursing:  { label: "Nursing home, private room", short: "a nursing home", yearly: 127750 },
  semi:     { label: "Nursing home, shared room", short: "a shared nursing-home room", yearly: 111325 },
  assisted: { label: "Assisted living", short: "assisted living", yearly: 70800 },
  home:     { label: "Home health aide, 44 hours a week", short: "a home health aide", yearly: 77792 },
  day:      { label: "Adult day care, 5 days a week", short: "adult day care", yearly: 26000 },
};
export const COST_YEAR = 2024;
/** Almost 70% of people turning 65 will need some long-term care; women for 3.7 years on average, men 2.2 (US Administration for Community Living, "How much care will you need?"). */
export const CHANCE_AFTER_65 = 0.7, AVERAGE_YEARS = { female: 3.7, male: 2.2 }, AVERAGE_YEARS_ANY = 3;
/** The usual settings: a private nursing-home room from 85. */
export const DEFAULTS = { care: "nursing", startAge: 85, costFactor: 1 };
/** Policy terms when the policy does not say: a 90-day waiting period and three years of benefits, the most common choices. */
export const DEFAULT_WAIT_DAYS = 90, DEFAULT_BENEFIT_YEARS = 3;
/** The most care the search looks at. */
export const MAX_YEARS = 15;

/** The settings with the defaults filled in; `years` defaults to the average for the person's sex. */
export function settingsFor(plan, personId) {
  const s = plan.insurance?.ltc ?? {};
  const sex = plan.retirement?.longevity?.[personId]?.sex ?? "";
  const years = Number(s.years) > 0 ? Number(s.years) : AVERAGE_YEARS[sex] ?? AVERAGE_YEARS_ANY;
  return { care: CARE[s.care] ? s.care : DEFAULTS.care, startAge: Number(s.startAge) > 0 ? Number(s.startAge) : DEFAULTS.startAge, costFactor: Number(s.costFactor) > 0 ? Number(s.costFactor) : DEFAULTS.costFactor, years, sex };
}

/**
 * The care as yearly amounts out of savings (today's dollars) from a year: whole years, then the part-year left, less
 * what a policy pays: after its waiting period, up to its monthly benefit and its pool (monthly x 12 x benefit years).
 * Without inflation protection the benefit is a fixed dollar amount, worth less each year: in today's dollars it is
 * divided by (1 + inflation)^(years from now) (`policy.inflation`, from `policy.nowYear`).
 */
export function careEvents({ fromYear, years, yearly, lastYear, policy = null }) {
  const out = [];
  let poolLeft = policy ? policy.monthly * 12 * policy.years : 0;   // in the policy's own dollars
  let wait = policy ? policy.waitDays / 365 : 0;
  for (let k = 0; k < Math.ceil(years - 1e-9); k++) {
    const y = fromYear + k;
    if (y > lastYear) break;
    const share = Math.min(1, years - k);
    const cost = yearly * share;
    let pays = 0;
    if (policy) {
      const worth = Math.pow(1 + (policy.inflation ?? 0), -(y - (policy.nowYear ?? y)));   // today's dollars per policy dollar
      const covered = Math.max(0, share - wait);
      wait = Math.max(0, wait - share);
      pays = Math.min(cost, policy.monthly * 12 * covered * worth, poolLeft * worth);
      poolLeft -= pays / worth;
    }
    out.push({ year: y, amount: cost - pays, cost, pays, label: "long-term care" });
  }
  return out;
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, primary (whose age the failure ages are), settings (the stored ones, defaults filled), care: { key, label, yearly (with the cost factor) },
 *   base: { success, failAge, endReal },
 *   people: [{ id, name, age, sex, startAge, fromYear, years, reachChance (alive at the start age), costYearly, costTotal,
 *     self: { success, failAge, failYear, endReal }, maxYears (of this care the plan can carry and still last; null when the plan fails anyway),
 *     shortToday (the lump sum today that would let the plan pay for it; 0 when it can),
 *     policy: { names, monthly, years, waitDays, inflationProtected, monthlyThenReal (the monthly benefit when care starts, in today's dollars), premiumYearly, premiumsToStart (today's dollars), benefitTotal, paysTotal (today's dollars) } | null,
 *     withPolicy: the care less what the policy pays, and the premiums out of savings until the care starts,
 *       { success, failAge, endReal } | null }]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  if (!today || !b.inputs) return { ready: false, missing: b.missing ?? ["today's date"] };
  const I = b.inputs;
  const household = plan.household?.people ?? [];
  const pol = computePolicies(plan, { today });
  const baseRun = project(I);
  const base = { success: baseRun.success, failAge: baseRun.failAge ?? null, endReal: baseRun.endBalanceReal };
  const s0 = settingsFor(plan, I.people[0]?.id);
  const run = (events) => { const T = copyInputs(I); T.events.push(...events); const r = project(T); return { success: r.success, failAge: r.failAge ?? null, failYear: r.failYear ?? null, endReal: r.endBalanceReal }; };

  const people = I.people.map((p) => {
    const st = settingsFor(plan, p.id);
    const person = household.find((q) => q.id === p.id);
    const age = person?.birthDate ? ageOn(person.birthDate, today) : I.startYear - p.birthYear;
    const yearly = CARE[st.care].yearly * st.costFactor;
    // care starts at the chosen age, or late enough in the plan to fit (never before retirement or today)
    const lastAge = p.endAge;
    const startAge = Math.max(age, Math.min(st.startAge, Math.max(p.retireAge, lastAge - Math.ceil(st.years) + 1)));
    const fromYear = p.birthYear + startAge;
    const lastYear = I.endYear;
    const events = (years, policy = null) => careEvents({ fromYear, years, yearly, lastYear, policy });
    const self = run(events(st.years));
    const ok = (years) => { const r = run(events(years)); return base.success ? r.success : false; };
    const maxYears = base.success ? (ok(MAX_YEARS) ? MAX_YEARS : largestWhere(ok, 0, MAX_YEARS, 0.05)) : null;
    let shortToday = 0;
    if (!self.success && base.success) {
      const withLump = (lump) => run([...events(st.years), { year: I.startYear, amount: -lump, label: "set aside" }]).success;
      let hi = 1e5; while (!withLump(hi) && hi < 1e9) hi *= 4;
      shortToday = Math.ceil((smallestWhere(withLump, 0, hi, 50) ?? hi) / 1000) * 1000;
    }
    const mine = pol.items.filter((x) => !x.ended && x.kind === "ltc" && x.personId === p.id && Number(x.benefit) > 0);
    let policy = null, withPolicy = null;
    if (mine.length) {
      const monthly = mine.reduce((s, x) => s + Number(x.benefit), 0);
      const years = Math.max(...mine.map((x) => Number(x.benefitYears) || DEFAULT_BENEFIT_YEARS));
      const waitDays = Math.min(...mine.map((x) => (x.waitDays !== undefined && x.waitDays !== null && x.waitDays !== "" ? Number(x.waitDays) : DEFAULT_WAIT_DAYS)));
      const premiumYearly = mine.reduce((s, x) => s + x.premiumYearly, 0);
      const protectedAll = mine.every((x) => !!x.inflationProtected);
      const inflation = protectedAll ? 0 : I.rates.inflation;
      const ev = events(st.years, { monthly, years, waitDays, inflation, nowYear: I.startYear });
      // the premiums, level in dollars (worth less each year), out of savings every year until the care starts: what keeping the policy costs the plan
      const premiums = [];
      for (let y = I.startYear; y < fromYear && y <= I.endYear; y++) premiums.push({ year: y, amount: premiumYearly * Math.pow(1 + I.rates.inflation, -(y - I.startYear)), label: "care policy premium" });
      policy = { names: mine.map((x) => x.name), monthly, years, waitDays, inflationProtected: protectedAll, monthlyThenReal: monthly * Math.pow(1 + inflation, -(fromYear - I.startYear)), premiumYearly, premiumsToStart: premiums.reduce((s, e) => s + e.amount, 0), benefitTotal: monthly * 12 * years, paysTotal: ev.reduce((s, e) => s + e.pays, 0) };
      withPolicy = run([...ev, ...premiums]);
    }
    const lg = plan.retirement?.longevity?.[p.id] ?? {};
    return {
      id: p.id, name: p.name, age, sex: st.sex, startAge, fromYear, years: st.years,
      reachChance: startAge > age ? survival(age, startAge, { sex: lg.sex ?? "", health: lg.health ?? "average" }) : 1,
      costYearly: yearly, costTotal: yearly * st.years, self, maxYears, shortToday, policy, withPolicy,
    };
  });
  return { ready: true, missing: [], primary: I.people[0]?.name ?? "", settings: s0, care: { key: s0.care, label: CARE[s0.care].label, short: CARE[s0.care].short, yearly: CARE[s0.care].yearly * s0.costFactor }, base, people };
}
