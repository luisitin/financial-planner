// modules/goals/travel/compute.js -- PURE. Trips, a wedding and other big days, each priced from its parts
// (a trip: flights per person, nights of lodging, meals per person per day; a wedding: guests and the main
// costs) and turned into what to set aside each month to pay for it in cash by the date. Each event can be
// a goal on the Goals page; then its money and monthly amount come from there.
import { pmtToReach } from "../../../core/math/finance.js";
import { compute as computeGoals } from "../goals/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";

/** The kinds of event, the parts each is priced from, and the icon its goal gets. */
export const KINDS = {
  trip: { label: "A trip", icon: "✈️", fields: ["people", "nights", "flightPerPerson", "lodgingPerNight", "foodPerPersonDay", "activities", "other"] },
  wedding: { label: "A wedding", icon: "💍", fields: ["guests", "perGuest", "venue", "attire", "photos", "rings", "other"] },
  other: { label: "Something else (a birthday, the holidays, a move)", icon: "🎁", fields: ["other"] },
};

/** The parts of an event's cost, each { label, amount }. */
export function parts(e) {
  const n = (k) => Math.max(0, Number(e[k]) || 0);
  if (e.kind === "trip") {
    const people = Math.max(1, n("people")), nights = n("nights");
    return [
      { label: `Flights (${people} x ${n("flightPerPerson")})`, amount: people * n("flightPerPerson") },
      { label: `Lodging (${nights} night${nights === 1 ? "" : "s"})`, amount: nights * n("lodgingPerNight") },
      { label: `Food (${people} people, ${nights + 1} days)`, amount: people * (nights + 1) * n("foodPerPersonDay") },
      { label: "Activities", amount: n("activities") },
      { label: "Other", amount: n("other") },
    ].filter((x) => x.amount > 0);
  }
  if (e.kind === "wedding") return [
    { label: `Food and drink (${n("guests")} guests)`, amount: n("guests") * n("perGuest") },
    { label: "Venue", amount: n("venue") }, { label: "Clothes", amount: n("attire") }, { label: "Photos", amount: n("photos") }, { label: "Rings", amount: n("rings") }, { label: "Other", amount: n("other") },
  ].filter((x) => x.amount > 0);
  return n("other") > 0 ? [{ label: "Budget", amount: n("other") }] : [];
}

/**
 * compute(plan, { today }) -> {
 *   events: [{ ...event, kindLabel, icon, parts, total, months, goal: { id, name, funded, monthly } | null, saved, neededMonthly, past }],
 *   upcoming (count), neededMonthly (sum for upcoming), next (the nearest upcoming event) | null, cashRate
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const goals = computeGoals(plan, { today }).goals;
  const cashRate = Number(plan.assumptions?.returnCash ?? 0.02);
  const events = (plan.events ?? []).map((e) => {
    const k = KINDS[e.kind] ? e.kind : "other";
    const ps = parts({ ...e, kind: k });
    const total = ps.reduce((t, x) => t + x.amount, 0);
    const months = today && e.date ? monthsBetween(today, e.date) : null;
    const g = e.goalId ? goals.find((y) => y.id === e.goalId) ?? null : null;
    const saved = g ? g.funded : Math.max(0, Number(e.saved) || 0);
    const neededMonthly = months !== null && months > 0 ? Math.max(0, pmtToReach(cashRate / 12, months, total, saved)) : null;
    return { ...e, kind: k, kindLabel: KINDS[k].label.split(" (")[0], icon: KINDS[k].icon, parts: ps, total, months, goal: g ? { id: g.id, name: g.name, funded: g.funded, monthly: Number(g.monthly) || 0 } : null, saved, neededMonthly, past: months !== null && months < 0 };
  }).sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
  const upcoming = events.filter((e) => !e.past);
  return { events, upcoming: upcoming.length, neededMonthly: upcoming.reduce((t, e) => t + (e.neededMonthly ?? 0), 0), next: upcoming.find((e) => e.date) ?? null, cashRate };
}
