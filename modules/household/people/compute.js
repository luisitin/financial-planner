// modules/household/people/compute.js -- PURE. Who is in the plan, how old they are, and
// how far each is from retirement and from the end of the plan. Every later page that
// needs an age or a horizon (retirement, Social Security, insurance needs) reads this.
import { ageOn, dateAtAge } from "../../../core/math/dates.js";
import { perMonth } from "../../../core/math/periods.js";
import { isLiability } from "../../balance/net-worth/compute.js";
import { KINDS as POLICY_KINDS } from "../../insurance/policies/compute.js";
import { KINDS as DOC_KINDS } from "../../estate/documents/compute.js";
import { listOf } from "../../estate/beneficiaries/compute.js";
import { NameIn, NameOf, verbFor, isYou } from "../../../core/words.js";

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
  if (adults.length === 1 && MARRIED.includes(plan.household?.filingStatus)) warnings.push(`One adult but the tax filing status is ${FILING_STATUSES[plan.household.filingStatus]}. Change it if you no longer file as a married couple.`);
  for (const p of people) {
    // a name in a sentence: "You" for the unnamed first adult ("Me"), "Your spouse", the name, or "Someone" with none
    const named = !!String(p.name ?? "").trim(), who = named ? NameIn(p.name) : "Someone", has = named ? verbFor(p.name, "has", "have") : "has";
    if (p.age !== null && p.age < 0) warnings.push(`${who} ${has} a birth date in the future.`);
    if (p.age !== null && p.age > 120) warnings.push(`${who} would be ${p.age}. Check the birth date.`);
    if (p.role !== "dependent" && p.age !== null && p.retirementAge > p.planEndAge) warnings.push(named && isYou(p.name) ? `Your retirement age (${p.retirementAge}) is past the plan's end age (${p.planEndAge}).` : `${who}: the retirement age (${p.retirementAge}) is past the plan's end age (${p.planEndAge}).`);
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

const MARRIED = ["married_joint", "married_separate"];

/**
 * tiedTo(plan, personId) -> {
 *   person, items: [{ kind, id, name, amount, every ("a month" | "balance" | "owed" | "cover" | "one time" | null), where, href }],
 *   named: [{ name, where, href }]  (accounts and policies that still name this person as a beneficiary: a form at the bank, never changed here),
 *   leavesOneAdult (removing this adult leaves exactly one), married (the filing status is a married one), dependents (left after)
 * }
 * What in the plan belongs to one person, so removing them never quietly leaves their pay or accounts counted as the
 * household's (the old Remove dropped only the person). Kinds: income, account, contribution (to an account not already
 * listed), socialSecurity, pension, annuity, policy, estateDoc (a will, a power of attorney).
 */
export function tiedTo(plan, personId) {
  const person = (plan.household?.people ?? []).find((x) => x.id === personId) ?? null;
  const items = [];
  const accounts = (plan.accounts ?? []).filter((a) => a.ownerId === personId);
  const accIds = new Set(accounts.map((a) => a.id));
  const nameOf = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? "an account";
  for (const x of plan.income ?? []) if (x.personId === personId) items.push({ kind: "income", id: x.id, name: x.name, amount: x.period === "once" ? Number(x.amount) || 0 : perMonth(x.amount, x.period), every: x.period === "once" ? "one time" : "a month", where: "Income", href: "#/cashflow/income" });
  for (const a of accounts) { const owed = isLiability(a.type); items.push({ kind: "account", id: a.id, name: a.name, amount: Math.abs(Number(a.balance) || 0), every: owed ? "owed" : "balance", where: owed ? "Debts" : "Net worth", href: owed ? "#/balance/liabilities" : "#/balance/net-worth" }); }
  for (const c of plan.retirement?.contributions ?? []) if (c.personId === personId && !accIds.has(c.accountId)) items.push({ kind: "contribution", id: c.id, name: `Saving into ${nameOf(c.accountId)}`, amount: perMonth(c.amount, c.period), every: "a month", where: "Retirement contributions", href: "#/retirement/contributions" });
  const ss = plan.retirement?.socialSecurity?.[personId];
  if (ss && (Number(ss.monthlyAtFRA) > 0 || (ss.record ?? []).length)) items.push({ kind: "socialSecurity", id: personId, name: `${person?.name ? NameOf(person.name) : "Their"} Social Security`, amount: Number(ss.monthlyAtFRA) || null, every: Number(ss.monthlyAtFRA) > 0 ? "a month" : null, where: "Social Security", href: "#/retirement/social-security", always: true });
  for (const x of plan.retirement?.pensions ?? []) if (x.personId === personId) items.push({ kind: "pension", id: x.id, name: x.name || "Pension", amount: Number(x.monthly) || 0, every: "a month", where: "Pensions", href: "#/retirement/pensions" });
  for (const x of plan.retirement?.annuities ?? []) if (x.personId === personId) items.push({ kind: "annuity", id: x.id, name: x.name || "Annuity quote", amount: Number(x.monthly) || 0, every: "a month", where: "Annuities", href: "#/retirement/annuities" });
  for (const x of plan.insurance?.policies ?? []) if (x.personId === personId) items.push({ kind: "policy", id: x.id, name: x.name || (POLICY_KINDS[x.kind] ?? POLICY_KINDS.other).label, amount: Number(x.benefit) || 0, every: "cover", where: "Policies", href: "#/insurance/policies" });
  // a person's own papers (their will, their powers of attorney) and their Social Security go with them either way
  // (`always`): only a household paper can be kept (review 2026-11-02: "kept as the household's" blanked a will's owner
  // and it was shown nowhere)
  for (const x of plan.estate?.documents ?? []) if (x.personId === personId) items.push({ kind: "estateDoc", id: x.id, name: (DOC_KINDS[x.kind]?.label) ?? "Document", amount: null, every: null, where: "Documents checklist", href: "#/estate/documents", always: DOC_KINDS[x.kind]?.per === "adult" });
  // still named on a beneficiary form: only the bank or insurer can change that, so it is listed, never edited
  const named = [];
  const who = String(person?.name ?? "").trim().toLowerCase();
  for (const r of plan.estate?.beneficiaries ?? []) {
    const all = [...listOf(r?.primary), ...listOf(r?.contingent)];
    if (!all.some((b) => b.personId === personId || (who && b.name.toLowerCase() === who))) continue;
    const id = r.accountId ?? r.policyId;
    if (accIds.has(id)) continue;   // an account that goes with the person
    const name = r.accountId ? nameOf(r.accountId) : ((plan.insurance?.policies ?? []).find((x) => x.id === r.policyId)?.name ?? "a policy");
    named.push({ name, where: "Beneficiary audit", href: "#/estate/beneficiaries" });
  }
  const people = plan.household?.people ?? [];
  const adultsLeft = people.filter((x) => x.id !== personId && x.role !== "dependent").length;
  return {
    person, items, named,
    leavesOneAdult: !!person && person.role !== "dependent" && adultsLeft === 1,
    married: MARRIED.includes(plan.household?.filingStatus),
    dependents: people.filter((x) => x.id !== personId && x.role === "dependent").length,
  };
}

/**
 * removePerson(draft, personId, { keep }) -> { removed: [name], kept: [name], filing: new status | null }
 * Mutates `draft` (a store draft). The person goes, and with `keep` false so does everything tiedTo lists (an account
 * takes its loan details, the saving into it and its beneficiary row with it; goals stop counting it). With `keep` true
 * those stay as the household's ("" owner). Either way the records that only mean something with the person (their
 * Social Security, paycheck and benefits settings, setup answers, scenario levers) go, and a married filing status with
 * one adult left becomes Single (the planner's choice: Single is the higher, safer tax; the page says head of household
 * may apply with children at home).
 */
export function removePerson(draft, personId, { keep = false } = {}) {
  const t = tiedTo(draft, personId);
  const removed = [], kept = [];
  if (!t.person) return { removed, kept, filing: null };
  const goes = (list, test, clear) => {
    const out = [];
    for (const x of list ?? []) {
      if (!test(x)) { out.push(x); continue; }
      if (keep) { clear(x); out.push(x); kept.push(x.name); } else removed.push(x.name);
    }
    return out;
  };
  const accIds = new Set((draft.accounts ?? []).filter((a) => a.ownerId === personId).map((a) => a.id));
  if (draft.income) draft.income = goes(draft.income, (x) => x.personId === personId, (x) => { x.personId = ""; });
  if (draft.accounts) draft.accounts = goes(draft.accounts, (a) => a.ownerId === personId, (a) => { a.ownerId = ""; });
  if (!keep && accIds.size) {
    if (draft.debts) draft.debts = draft.debts.filter((d) => !accIds.has(d.accountId));
    for (const g of draft.goals ?? []) if (Array.isArray(g.fundedBy)) g.fundedBy = g.fundedBy.filter((id) => !accIds.has(id));
    if (draft.estate?.beneficiaries) draft.estate.beneficiaries = draft.estate.beneficiaries.filter((r) => !accIds.has(r.accountId));
    if (draft.retirement?.contributions) draft.retirement.contributions = draft.retirement.contributions.filter((c) => !accIds.has(c.accountId));
    // what sat in those accounts goes with them: holdings, bank lines and sorting rules; a home or car loan link is cleared
    // (review 2026-11-02: a removed Roth IRA's funds went on counting on the investment pages under "No account")
    for (const k of ["holdings", "transactions", "rules"]) if (Array.isArray(draft[k])) draft[k] = draft[k].filter((x) => !accIds.has(x?.accountId));
    for (const x of draft.property ?? []) { if (accIds.has(x.accountId)) delete x.accountId; if (accIds.has(x.loanAccountId)) delete x.loanAccountId; }
    if (Array.isArray(draft.debtPlan?.targets)) draft.debtPlan.targets = draft.debtPlan.targets.filter((id) => !accIds.has(id));
  }
  const r = draft.retirement;
  if (r?.contributions) r.contributions = goes(r.contributions.map((c) => ({ ...c, name: `Saving into ${(draft.accounts ?? []).find((a) => a.id === c.accountId)?.name ?? "an account"}` })), (c) => c.personId === personId, (c) => { c.personId = ""; }).map(({ name, ...c }) => c);
  if (r?.pensions) r.pensions = goes(r.pensions, (x) => x.personId === personId, (x) => { x.personId = ""; });
  if (r?.annuities) r.annuities = goes(r.annuities, (x) => x.personId === personId, (x) => { x.personId = ""; });
  if (draft.insurance?.policies) draft.insurance.policies = goes(draft.insurance.policies, (x) => x.personId === personId, (x) => { x.personId = ""; });
  if (draft.estate?.documents) {
    const own = (x) => x.personId === personId && DOC_KINDS[x.kind]?.per === "adult";
    for (const x of draft.estate.documents) if (own(x)) removed.push(DOC_KINDS[x.kind]?.label ?? "Document");
    draft.estate.documents = goes(draft.estate.documents.filter((x) => !own(x)).map((x) => ({ ...x, name: DOC_KINDS[x.kind]?.label ?? "Document" })), (x) => x.personId === personId, (x) => { x.personId = ""; }).map(({ name, ...x }) => x);
  }
  // records that only mean something with the person
  if (r?.socialSecurity?.[personId]) { delete r.socialSecurity[personId]; removed.push(`${NameOf(t.person.name)} Social Security`); }
  for (const map of [r?.workPlans, r?.longevity, draft.whatIfs?.humanCapital, draft.whatIfs?.paycheck, draft.whatIfs?.benefits, draft.whatIfs?.college, draft.guide?.setup?.status, draft.guide?.setup?.ss, draft.guide?.setup?.ssWrote]) if (map && typeof map === "object") delete map[personId];
  for (const holder of [draft.whatIfs?.benefits, draft.whatIfs?.offers, draft.equity]) if (holder?.personId === personId) holder.personId = "";
  for (const g of draft.taxes?.gains ?? []) if (g.personId === personId) g.personId = "";
  if (draft.taxes?.hsa?.coveredId === personId) delete draft.taxes.hsa.coveredId;
  if (draft.papers) draft.papers = draft.papers.filter((x) => x.key !== `birth:${personId}`);
  for (const s of [...(draft.scenarios ?? []), draft.advisor].filter(Boolean)) if (s.changes) for (const k of Object.keys(s.changes)) if (k.endsWith(`:${personId}`)) delete s.changes[k];
  draft.household.people = (draft.household.people ?? []).filter((x) => x.id !== personId);
  let filing = null;
  if (t.leavesOneAdult && t.married) { draft.household.filingStatus = "single"; filing = "single"; }
  return { removed, kept, filing };
}
