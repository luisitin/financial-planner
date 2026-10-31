// modules/overview/timeline/compute.js -- PURE. Every moment between today and the end of the plan
// that changes the household's money, in date order: retirements, Social Security, Medicare, the
// ages the tax rules open or close something (catch-up saving, penalty-free withdrawals, required
// withdrawals), debts and the mortgage paid off, goals coming due, children growing up, financial
// independence, the savings milestones, and whether the money lasts. It reads the other pages'
// computes, so every date here is the date those pages show.
import { ageOn, dateAtAge, addMonths } from "../../../core/math/dates.js";
import { project } from "../../../core/math/retirement.js";
import { rmdStartAge, rmdStartYear, RMD_ACCOUNT_TYPES } from "../../../core/math/rmd.js";
import { money as fmtMoney } from "../../../core/format.js";
import { compute as computePeople } from "../../household/people/compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { compute as computeSocialSecurity, fullRetirementAge } from "../../retirement/social-security/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeFire } from "../../retirement/fire/compute.js";
import { limitsFor } from "../../retirement/contributions/compute.js";

/** What each kind of moment is about; the chips on the page filter by `topic`. */
export const KINDS = {
  now:        { icon: "📍", topic: "money" },
  retire:     { icon: "🏖️", topic: "work" },
  social:     { icon: "🇺🇸", topic: "money" },
  medicare:   { icon: "🩺", topic: "health" },
  catchup:    { icon: "📥", topic: "tax" },
  penalty:    { icon: "🔓", topic: "tax" },
  rmd:        { icon: "📤", topic: "tax" },
  debt:       { icon: "✂️", topic: "money" },
  mortgage:   { icon: "🔑", topic: "money" },
  debtfree:   { icon: "🎉", topic: "money" },
  goal:       { icon: "🎯", topic: "money" },
  child:      { icon: "🧒", topic: "family" },
  fi:         { icon: "🌱", topic: "money" },
  milestone:  { icon: "⭐", topic: "money" },
  peak:       { icon: "⛰️", topic: "money" },
  short:      { icon: "⚠️", topic: "money" },
  end:        { icon: "🏁", topic: "money" },
};
export const TOPICS = [
  { id: "all", label: "Everything" },
  { id: "money", label: "Money" },
  { id: "work", label: "Work" },
  { id: "family", label: "Family" },
  { id: "health", label: "Health" },
  { id: "tax", label: "Tax rules" },
];
/** Savings milestones worth marking, in today's dollars. */
export const MILESTONES = [100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000];

const yearOf = (iso) => Number(String(iso).slice(0, 4));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * compute(plan, { today }) -> {
 *   ready, missing: [text], notes: [text], startYear, endYear,
 *   people: [{ id, name, role, birthDate, birthYear, age }],
 *   events: [{ id, date (ISO or null), year, kind, topic, icon, title, detail, tone: "ok"|"warn"|"bad"|null, personId, go: [group, id] | null }],
 *   years: [{ year, ages: [{ id, name, age }], events: [...], era: "work"|"retired", gapBefore (quiet years since the previous year shown) }],
 *   savings: [{ year, real }] (the projection's savings in today's dollars, or [] without one),
 *   headline: { retireYear, retireIn, debtFreeYear, lastsTo, shortYear, fiYear, endYear },
 *   counts: { [topic]: n }
 * }
 * Only moments from today on are listed; a moment without a known day is placed on January 1 of its year for ordering.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const ppl = computePeople(plan, { today });
  const dated = ppl.people.filter((p) => p.birthDate);
  const adults = dated.filter((p) => p.role !== "dependent");
  const missing = [], notes = [];
  if (!today) missing.push("today's date");
  if (!adults.length) missing.push("a person with a birth date on the People page");
  const empty = { ready: false, missing, notes, events: [], years: [], savings: [], people: [], headline: {}, counts: {} };
  if (missing.length) return empty;

  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n / 100) * 100, cur);
  const startYear = yearOf(today);
  const events = [];
  const add = (e) => {
    const date = e.date ?? null;
    const year = e.year ?? (date ? yearOf(date) : startYear);
    if (date ? date < today : year < startYear) return;
    events.push({ id: e.id, date, year, kind: e.kind, topic: KINDS[e.kind].topic, icon: e.icon || KINDS[e.kind].icon, title: e.title, detail: e.detail ?? "", tone: e.tone ?? null, personId: e.personId ?? null, go: e.go ?? null });
  };
  const self = adults.find((p) => p.role === "self") ?? adults[0];
  const ordered = [self, ...adults.filter((p) => p !== self)];
  const endYear = Math.max(...ordered.map((p) => yearOf(p.planEndDate)));
  const limits = limitsFor(startYear);
  const accounts = plan.accounts ?? [];
  const owns = (p, a) => a.ownerId === p.id || (p === self && !adults.some((q) => q.id === a.ownerId));
  const hasType = (p, types) => accounts.some((a) => types.includes(a.type) && owns(p, a));
  const contributes = (p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id);

  // the projection: savings by year, who withdraws what, whether the money lasts
  const b = buildInputs(plan, { today });
  const run = b.inputs ? project(b.inputs) : null;
  const rows = run ? run.rows : [];
  if (!run) notes.push(`Add ${b.missing.join(" and ")} to see your savings and whether the money lasts.`);
  const savings = rows.map((r) => ({ year: r.year, real: r.totalReal }));
  const retireYear = b.inputs ? b.inputs.retireYear : yearOf(self.retirementDate);

  const savedNow = b.inputs ? Object.values(b.inputs.balances).reduce((s, v) => s + v, 0) : null;
  add({ id: "now", kind: "now", date: today, title: "Today", detail: savedNow !== null ? `${money(savedNow)} in savings, retirement and investment accounts: what the rest of this page grows from.` : "Where the plan starts.", go: ["balance", "net-worth"] });

  // each adult: retirement, the ages the rules care about, Social Security, Medicare, required withdrawals, the plan's end
  const ss = computeSocialSecurity(plan, { today });
  for (const p of ordered) {
    const name = p.name || "You";
    const by = yearOf(p.birthDate);
    if (!p.retired) {
      const gap = p.retirementAge < 65 ? ` Health cover from work ends: until Medicare at 65 that means a marketplace plan or a former employer's (${65 - p.retirementAge} ${65 - p.retirementAge === 1 ? "year" : "years"}).` : "";
      add({ id: `retire-${p.id}`, kind: "retire", date: p.retirementDate, personId: p.id, title: `${name} retires`, detail: `At ${p.retirementAge}. The paychecks stop; savings, Social Security and any pension take over.${gap}`, go: ["household", "people"] });
    }
    const working = (age) => !p.retired && age < p.retirementAge;
    if (working(50) && (contributes(p) || hasType(p, ["401k", "ira", "roth"]))) {
      const k = limits.kinds["401k"], ira = limits.kinds.ira;
      add({ id: `catchup-${p.id}`, kind: "catchup", date: dateAtAge(p.birthDate, 50), personId: p.id, title: `${name} can save more for retirement`, detail: `From 50 the limits rise: ${fmtMoney(k.catchUp, cur)} more a year into a 401(k) and ${fmtMoney(ira.catchUp, cur)} more into an IRA (${limits.kindYear["401k"] === startYear && limits.kindYear.ira === startYear ? startYear : "latest"} figures).`, go: ["investments", "limits"] });
    }
    if (working(60) && hasType(p, ["401k"]) && limits.kinds["401k"].superCatchUp) {
      const sc = limits.kinds["401k"].superCatchUp;
      add({ id: `supercatchup-${p.id}`, kind: "catchup", date: dateAtAge(p.birthDate, sc.from), personId: p.id, title: `${name}'s four bigger catch-up years`, detail: `From ${sc.from} to ${sc.to} the 401(k) catch-up is ${fmtMoney(sc.amount, cur)} a year instead of ${fmtMoney(limits.kinds["401k"].catchUp, cur)}.`, go: ["investments", "limits"] });
    }
    if (working(55) && hasType(p, ["hsa"])) add({ id: `hsa-${p.id}`, kind: "catchup", date: dateAtAge(p.birthDate, 55), personId: p.id, title: `${name}'s HSA limit rises`, detail: `From 55 a health savings account takes ${fmtMoney(limits.kinds.hsa.catchUp, cur)} more a year.`, go: ["taxes", "hsa-fsa"] });
    if (hasType(p, ["401k", "ira", "roth"])) add({ id: `penalty-${p.id}`, kind: "penalty", date: addMonths(dateAtAge(p.birthDate, 59), 6), personId: p.id, title: `${name} can draw on retirement accounts freely`, detail: "From 59½ money comes out of IRAs and 401(k)s without the 10% early-withdrawal penalty (income tax still applies to pre-tax money).", go: ["retirement", "withdrawal-order"] });
    const sp = ss.people.find((x) => x.id === p.id);
    if (sp && sp.source !== "none" && sp.monthly > 0) {
      const claimDate = addMonths(p.birthDate, Math.round(sp.claimAge * 12));
      const fra = fullRetirementAge(by);
      const when = Math.round(sp.claimAge * 12) < Math.round(fra.asYears * 12) ? "early, so smaller for life" : Math.round(sp.claimAge * 12) > Math.round(fra.asYears * 12) ? "late, so bigger for life" : "at full retirement age";
      add({ id: `social-${p.id}`, kind: "social", date: claimDate, personId: p.id, title: `${name}'s Social Security starts`, detail: `About ${fmtMoney(sp.monthly, cur)} a month in today's dollars, claimed at ${fmtAge(sp.claimAge)}: ${when}. It rises with inflation every year after.`, tone: "ok", go: ["retirement", "social-security"] });
    } else add({ id: `social-${p.id}`, kind: "social", date: dateAtAge(p.birthDate, 62), personId: p.id, title: `${name} can claim Social Security`, detail: "62 is the earliest age. There is no estimate in the plan yet: add one so the plan counts it.", tone: "warn", go: ["retirement", "social-security"] });
    add({ id: `medicare-${p.id}`, kind: "medicare", date: dateAtAge(p.birthDate, 65), personId: p.id, title: `${name} joins Medicare`, detail: "Sign up in the three months before the 65th birthday to avoid a lifelong late penalty on Part B.", go: ["retirement", "projection"] });
    if (hasType(p, RMD_ACCOUNT_TYPES)) {
      const startAge = rmdStartAge(p.birthDate), sy = rmdStartYear(p.birthDate);
      const k = b.inputs ? b.inputs.people.findIndex((q) => q.id === p.id) : -1;
      const row = rows.find((r) => r.year === sy);
      const first = row && k >= 0 ? row.rmdBy?.[k] / row.priceLevel : null;
      add({ id: `rmd-${p.id}`, kind: "rmd", year: sy, personId: p.id, title: `${name}'s required withdrawals begin`, detail: `The tax rules make pre-tax accounts pay out from ${fmtAge(startAge)}${first ? `: about ${money(first)} the first year in today's dollars, taxed as income` : ", taxed as income"}.`, go: ["retirement", "rmd"] });
    }
    add({ id: `end-${p.id}`, kind: "end", date: p.planEndDate, personId: p.id, title: `The plan runs to ${name}'s ${p.planEndAge}`, detail: ordered.length > 1 ? "The money has to last until the last of you reaches the plan's end age." : "The money has to last until here.", go: ["retirement", "longevity"] });
  }

  // children: the tax credit ends at 17, adulthood at 18, a parent's health plan ends at 26
  for (const c of dated.filter((p) => p.role === "dependent")) {
    const name = c.name || "Your child";
    add({ id: `child17-${c.id}`, kind: "child", date: dateAtAge(c.birthDate, 17), personId: c.id, title: `${name} turns 17`, detail: "The child tax credit stops (it is for children under 17); a smaller credit for other dependents can take its place.", go: ["taxes", "federal"] });
    add({ id: `child18-${c.id}`, kind: "child", date: dateAtAge(c.birthDate, 18), personId: c.id, title: `${name} turns 18`, detail: "College or work years usually start here.", go: ["goals", "goals"] });
    add({ id: `child26-${c.id}`, kind: "child", date: dateAtAge(c.birthDate, 26), personId: c.id, title: `${name} turns 26`, detail: "The last year on a parent's health insurance.", go: null });
  }

  // debts, in the order the payoff plan clears them
  const pay = computePayoff(plan, { today });
  if (pay.hasData && pay.chosen) {
    const typeOf = (id) => accounts.find((a) => a.id === id)?.type;
    for (const d of pay.chosen.debts) {
      if (!d.endDate) continue;
      const isMortgage = typeOf(d.id) === "mortgage";
      add({ id: `debt-${d.id}`, kind: isMortgage ? "mortgage" : "debt", date: d.endDate, title: `${d.name} paid off`, detail: isMortgage ? `The house is yours. That frees the monthly payment for everything else.${d.interest ? ` Interest from here on: about ${money(d.interest)}.` : ""}` : `${d.interest ? `About ${money(d.interest)} of interest from here on. ` : ""}Its payment then rolls onto the next debt.`, tone: "ok", go: ["debt", isMortgage ? "mortgage" : "payoff"] });
    }
    if (pay.chosen.debts.length > 1 && pay.chosen.endDate) add({ id: "debtfree", kind: "debtfree", date: pay.chosen.endDate, title: "Debt-free", detail: `Every loan and card is paid off, ${money(pay.chosen.totalInterest)} of interest in all from today.`, tone: "ok", go: ["debt", "payoff"] });
  }
  if (pay.missing?.length) notes.push(`${plural(pay.missing.length, "debt has", "debts have")} no rate or payment, so ${pay.missing.length === 1 ? "its" : "their"} payoff date is not on the timeline: ${pay.missing.join(", ")}.`);

  // goals that are still open
  const gl = computeGoals(plan, { today });
  for (const g of gl.goals) {
    if (!g.targetDate || g.status === "done" || g.status === "no amount") continue;
    const behind = g.status === "behind" || g.status === "past due";
    add({ id: `goal-${g.id}`, kind: "goal", date: g.targetDate, icon: g.icon, title: g.name, detail: `${money(g.targetThen ?? g.target)} due.${behind ? ` Behind: about ${money(g.neededMonthly)} a month is needed.` : " On track at what goes in each month."}`, tone: behind ? "warn" : "ok", go: ["goals", "goals"] });
  }

  // money: independence, the savings milestones, the peak, whether it lasts
  const fi = run ? computeFire(plan, { today }) : null;
  if (fi?.ready && fi.fiYear && fi.fiYear > startYear && fi.fiYear < retireYear) add({ id: "fi", kind: "fi", year: fi.fiYear, title: "Financially independent", detail: `Savings of about ${money(fi.fiNumber)} could pay for your spending for good${fi.fiAge ? ` (${self.name || "you"} ${fi.fiAge})` : ""}. Work becomes a choice.`, tone: "ok", go: ["retirement", "fire"] });
  if (rows.length) {
    let best = MILESTONES.filter((m) => m <= (rows[0]?.totalReal ?? 0)).pop() ?? 0;
    for (const r of rows) {
      const m = MILESTONES.filter((x) => x > best && r.totalReal >= x).pop();
      if (m && r.year > startYear) { add({ id: `milestone-${m}`, kind: "milestone", year: r.year, title: `Savings pass ${fmtMoney(m, cur)}`, detail: "In today's dollars, after inflation.", go: ["retirement", "projection"] }); best = m; }
    }
    const peak = rows.reduce((a, r) => (r.totalReal > a.totalReal ? r : a), rows[0]);
    if (peak.year > startYear && peak.year < rows[rows.length - 1].year) add({ id: "peak", kind: "peak", year: peak.year, title: "Savings peak", detail: `About ${money(peak.totalReal)} in today's dollars. From here the plan spends more than it earns, as it should in retirement.`, go: ["retirement", "cash-flow"] });
    if (!run.success) add({ id: "short", kind: "short", year: run.failYear, title: "The savings run out", detail: `In ${run.failYear}${run.failAge ? `, when ${self.name || "you"} would be ${run.failAge}` : ""}. Spending less, working longer or saving more moves this date; the stress tests and goal seek show by how much.`, tone: "bad", go: ["retirement", "projection"] });
    else add({ id: "lasts", kind: "end", date: ordered.map((p) => p.planEndDate).sort().pop(), title: "The money lasts", detail: `About ${money(run.endBalanceReal)} is left at the end, in today's dollars.`, tone: "ok", go: ["retirement", "projection"] });
  }

  // order: by date, then a fixed order of kinds inside a day
  const rank = Object.keys(KINDS);
  events.sort((a, b) => (a.date ?? `${a.year}-01-01`).localeCompare(b.date ?? `${b.year}-01-01`) || rank.indexOf(a.kind) - rank.indexOf(b.kind));

  // years that have something in them, each with everyone's age that year and the quiet years before it
  const byYear = new Map();
  for (const e of events) { if (!byYear.has(e.year)) byYear.set(e.year, []); byYear.get(e.year).push(e); }
  let prev = null;
  const years = [...byYear.keys()].sort((a, b) => a - b).map((year) => {
    const ages = dated.filter((p) => year >= yearOf(p.birthDate) && year <= yearOf(p.planEndDate)).map((p) => ({ id: p.id, name: p.name, age: year - yearOf(p.birthDate) }));
    const out = { year, ages, events: byYear.get(year), era: year >= retireYear ? "retired" : "work", gapBefore: prev === null ? 0 : Math.max(0, year - prev - 1) };
    prev = year;
    return out;
  });

  const counts = {};
  for (const e of events) { counts[e.topic] = (counts[e.topic] ?? 0) + 1; counts.all = (counts.all ?? 0) + 1; }
  const debtFree = events.find((e) => e.kind === "debtfree") ?? (pay.chosen?.debts.length === 1 ? events.find((e) => e.kind === "debt" || e.kind === "mortgage") : null);
  const headline = {
    retireYear, retireIn: Math.max(0, retireYear - startYear), debtFreeYear: debtFree ? debtFree.year : null,
    lastsTo: run ? (run.success ? rows[rows.length - 1].year : null) : null, shortYear: run && !run.success ? run.failYear : null,
    fiYear: events.find((e) => e.kind === "fi")?.year ?? null, endYear,
  };
  return {
    ready: true, missing: [], notes, startYear, endYear,
    people: dated.map((p) => ({ id: p.id, name: p.name, role: p.role, birthDate: p.birthDate, birthYear: yearOf(p.birthDate), age: ageOn(p.birthDate, today) })),
    events, years, savings, headline, counts,
  };
}

/** 66.5 -> "66 and 6 months", 70 -> "70". */
export function fmtAge(age) {
  const y = Math.floor(age + 1e-9), m = Math.round((age - y) * 12);
  return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y);
}
