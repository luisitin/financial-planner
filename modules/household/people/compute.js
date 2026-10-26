// modules/household/people/compute.js -- PURE. Who is in the plan, how old they are, and
// how far each is from retirement and from the end of the plan. Every later page that
// needs an age or a horizon (retirement, Social Security, insurance needs) reads this.
import { ageOn, dateAtAge } from "../../../core/math/dates.js";

export const ROLES = {
  self:      { label: "Me",        icon: "🙂" },
  partner:   { label: "Partner",   icon: "💞" },
  dependent: { label: "Dependent", icon: "🧒" },
};
export const FILING_STATUSES = {
  single:               "Single",
  married_joint:        "Married, filing together",
  married_separate:     "Married, filing separately",
  head_of_household:    "Head of household",
  qualifying_surviving: "Qualifying surviving spouse",
};
export const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

/**
 * compute(plan, { today }) -> {
 *   people: [{ ...person, age, retirementAge, retirementDate, yearsToRetirement, retired, planEndAge, planEndDate, yearsLeft }],
 *   count, adults, dependents, self, filingStatus, filingLabel, state,
 *   horizonYears (years until the last adult reaches planEndAge; null with no dated adults),
 *   warnings: [text]
 * }
 * Defaults come from plan.assumptions: retirementAge (65), planEndAge (95). A person's own
 * values win when set. Without `today` every age is null; views pass ctx.fmt.today().
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const a = plan.assumptions ?? {};
  const raw = plan.household?.people ?? [];
  const people = raw.map((p) => {
    const age = today && p.birthDate ? ageOn(p.birthDate, today) : null;
    const isAdult = p.role !== "dependent";
    const retirementAge = isAdult ? Number(p.retirementAge ?? a.retirementAge ?? 65) : null;
    const planEndAge = Number(p.lifeExpectancy ?? a.planEndAge ?? 95);
    return {
      ...p, age, retirementAge, planEndAge,
      retirementDate: isAdult && p.birthDate ? dateAtAge(p.birthDate, retirementAge) : null,
      yearsToRetirement: isAdult && age !== null ? Math.max(0, retirementAge - age) : null,
      retired: isAdult && age !== null ? age >= retirementAge : null,
      planEndDate: p.birthDate ? dateAtAge(p.birthDate, planEndAge) : null,
      yearsLeft: age !== null ? Math.max(0, planEndAge - age) : null,
    };
  });
  const adults = people.filter((p) => p.role !== "dependent");
  const dependents = people.filter((p) => p.role === "dependent");
  const horizons = adults.map((p) => p.yearsLeft).filter((y) => y !== null);
  const warnings = [];
  if (people.length && !people.some((p) => p.role === "self")) warnings.push('Nobody is marked as "Me". Pick yourself so the plan knows whose retirement age to use.');
  if (people.filter((p) => p.role === "self").length > 1) warnings.push('More than one person is marked as "Me". Only one should be.');
  if (adults.length >= 2 && (plan.household?.filingStatus ?? "single") === "single") warnings.push("Two adults but the tax filing status is Single. Change it if you file together.");
  for (const p of people) {
    const who = p.name || "Someone";
    if (p.age !== null && p.age < 0) warnings.push(`${who} has a birth date in the future.`);
    if (p.age !== null && p.age > 120) warnings.push(`${who} would be ${p.age}. Check the birth date.`);
    if (p.role !== "dependent" && p.age !== null && p.retirementAge > p.planEndAge) warnings.push(`${who}: the retirement age (${p.retirementAge}) is past the plan's end age (${p.planEndAge}).`);
  }
  return {
    people, count: people.length, adults: adults.length, dependents: dependents.length,
    self: people.find((p) => p.role === "self") ?? null,
    filingStatus: plan.household?.filingStatus ?? "single",
    filingLabel: FILING_STATUSES[plan.household?.filingStatus] ?? FILING_STATUSES.single,
    state: plan.household?.state ?? "",
    horizonYears: horizons.length ? Math.max(...horizons) : null,
    warnings,
  };
}
