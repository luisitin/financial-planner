// modules/household/life-events/compute.js -- PURE. A guide for each big life event (marriage, a baby or adoption, a
// new job, a move, an inheritance, a divorce): its steps in order, the deadlines counted from the event's day, which
// steps are done, and the plan changes the page can make (each only when the person taps it): add a partner or a
// child, change the filing status or the state, update pay, add an inherited account.
import { EVENTS } from "./data/events.js";
import { US_STATES, FILING_STATUSES } from "../people/compute.js";
import { addDays } from "../../cashflow/recurring/compute.js";
import { daysBetween } from "../../../core/math/dates.js";

/** Days ahead a deadline counts as "soon". */
export const SOON_DAYS = 14;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
const text = (v) => String(v ?? "").trim();
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Has the plan already got what this change makes? (So the step shows as done without a tap.) */
function changeDone(plan, change, ev) {
  const people = plan.household?.people ?? [];
  const fs = plan.household?.filingStatus;
  switch (change) {
    case "addPartner": return people.some((p) => p.role === "partner");
    case "fileJointly": return fs === "married_joint" || fs === "married_separate";
    case "addChild": return people.some((p) => p.role === "dependent" && isDate(p.birthDate) && isDate(ev.date) && Math.abs(daysBetween(p.birthDate, ev.date)) <= 60);
    case "fileHeadOfHousehold": return fs === "head_of_household";
    case "fileSingle": return fs === "single" || fs === "head_of_household";
    default: return false;
  }
}

/**
 * One started event with its steps:
 * { id, kind, label, icon, date, dateLabel, intro, steps: [{ key, text, go, change, deadline, daysLeft, done, doneOn,
 *   auto (done because the plan already has it), state: "done" | "late" | "soon" | "open" }], done, total, next }
 */
export function eventView(plan, ev, today) {
  const def = EVENTS[ev.kind];
  if (!def) return null;
  const fs = plan.household?.filingStatus ?? "";
  const steps = def.steps.filter((s) => !s.only || (s.only === "single" && (fs === "single" || fs === "head_of_household" || !fs))).map((s) => {
    const deadline = isDate(ev.date) ? (s.days ? addDays(ev.date, s.days) : s.year10 ? `${Number(ev.date.slice(0, 4)) + 10}-12-31` : null) : null;
    const doneOn = ev.done?.[s.key] ?? null;
    const auto = !doneOn && !!s.change && changeDone(plan, s.change, ev);
    const done = !!doneOn || auto;
    const daysLeft = deadline && isDate(today) ? daysBetween(today, deadline) : null;
    const state = done ? "done" : daysLeft !== null && daysLeft < 0 ? "late" : daysLeft !== null && daysLeft <= SOON_DAYS ? "soon" : "open";
    return { key: s.key, text: s.text, go: s.go ?? null, change: s.change ?? null, deadline, daysLeft, done, doneOn, auto, state };
  });
  const done = steps.filter((s) => s.done).length;
  return { id: ev.id, kind: ev.kind, label: def.label, icon: def.icon, date: isDate(ev.date) ? ev.date : null, dateLabel: def.dateLabel, intro: def.intro, steps, done, total: steps.length,
    next: steps.find((s) => !s.done && (s.state === "late" || s.state === "soon")) ?? steps.find((s) => !s.done) ?? null };
}

/**
 * compute(plan, { today }) -> {
 *   kinds: [{ kind, label, icon, intro, started }], events: [eventView] (newest day first), urgent: [{ event, step }]
 *   (deadlines late or within SOON_DAYS, soonest first), states: US_STATES, filingStatuses
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const events = (plan.lifeEvents ?? []).filter((e) => e?.id && EVENTS[e.kind]).map((e) => eventView(plan, e, today)).filter(Boolean)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const urgent = events.flatMap((e) => e.steps.filter((s) => !s.done && (s.state === "late" || s.state === "soon")).map((s) => ({ event: { id: e.id, label: e.label, icon: e.icon }, step: s })))
    .sort((a, b) => a.step.deadline.localeCompare(b.step.deadline));
  return {
    kinds: Object.entries(EVENTS).map(([kind, d]) => ({ kind, label: d.label, icon: d.icon, intro: d.intro, started: events.filter((e) => e.kind === kind).length })),
    events, urgent, states: US_STATES, filingStatuses: FILING_STATUSES,
  };
}

/** Start an event on the plan draft. */
export function startEvent(draft, { id, kind, date }, today) {
  if (!EVENTS[kind]) return null;
  draft.lifeEvents = draft.lifeEvents ?? [];
  const ev = { id, kind, date: isDate(date) ? date : "", done: {}, startedAt: today ?? "" };
  draft.lifeEvents.push(ev);
  return ev;
}
export function setEventDate(draft, id, date) { const e = (draft.lifeEvents ?? []).find((x) => x.id === id); if (e && isDate(date)) e.date = date; return !!e; }
export function removeEvent(draft, id) { const n = (draft.lifeEvents ?? []).length; draft.lifeEvents = (draft.lifeEvents ?? []).filter((x) => x.id !== id); return draft.lifeEvents.length < n; }
/** Tick a step done (with the day) or untick it. */
export function setStep(draft, id, key, on, today) {
  const e = (draft.lifeEvents ?? []).find((x) => x.id === id);
  if (!e) return false;
  e.done = e.done ?? {};
  if (on) e.done[key] = today ?? "done"; else delete e.done[key];
  return true;
}

/**
 * Make one of the plan changes on the draft and tick its step. `values` holds what the person typed and a new `id`
 * (made by the view) for anything added. -> { ok, text } (text: what changed, for the notice) | { ok: false, text: why }
 */
export function applyChange(draft, eventId, change, values = {}, today = null) {
  const h = (draft.household = draft.household ?? { people: [], filingStatus: "", state: "" });
  h.people = h.people ?? [];
  const tick = (key) => setStep(draft, eventId, key, true, today);
  const name = text(values.name);
  switch (change) {
    case "addPartner":
      if (!name) return { ok: false, text: "Type your partner's name." };
      h.people.push({ id: values.id, name, birthDate: isDate(values.birthDate) ? values.birthDate : "", role: "partner" });
      tick("partner"); return { ok: true, text: `${name} added to People.` };
    case "addChild":
      if (!name) return { ok: false, text: "Type the child's name (a nickname is fine until you decide)." };
      h.people.push({ id: values.id, name, birthDate: isDate(values.birthDate) ? values.birthDate : "", role: "dependent" });
      tick("child"); return { ok: true, text: `${name} added to People.` };
    case "fileJointly":
      h.filingStatus = "married_joint"; tick("filing"); return { ok: true, text: "Filing status set to married filing jointly." };
    case "fileHeadOfHousehold":
      h.filingStatus = "head_of_household"; tick("hoh"); return { ok: true, text: "Filing status set to head of household." };
    case "fileSingle": {
      const st = values.status === "head_of_household" ? "head_of_household" : "single";
      h.filingStatus = st; tick("filing"); return { ok: true, text: `Filing status set to ${st === "single" ? "single" : "head of household"}.` };
    }
    case "setState": {
      const s = text(values.state).toUpperCase();
      if (!US_STATES.includes(s)) return { ok: false, text: "Pick the state you are moving to." };
      h.state = s; tick("state"); return { ok: true, text: `Your state is now ${s}.` };
    }
    case "updatePay": {
      const amount = num(values.amount);
      if (amount === null || amount < 0) return { ok: false, text: "Type the new pay." };
      draft.income = draft.income ?? [];
      const period = ["weekly", "biweekly", "semimonthly", "monthly", "annual"].includes(values.period) ? values.period : "annual";
      let inc = draft.income.find((x) => x.id === values.incomeId);
      if (inc) { inc.amount = amount; inc.period = period; if (isDate(values.startDate)) inc.startDate = values.startDate; }
      else { inc = { id: values.id, name: name || "Pay from the new job", type: "salary", personId: text(values.personId), amount, period, growth: null, startDate: isDate(values.startDate) ? values.startDate : "", endDate: "", taxable: true }; draft.income.push(inc); }
      tick("pay"); return { ok: true, text: `Pay updated on Income: ${inc.name}.` };
    }
    case "addAccount": {
      const balance = num(values.balance);
      if (!name || balance === null) return { ok: false, text: "Type a name and the amount." };
      draft.accounts = draft.accounts ?? [];
      const type = ["checking", "savings", "brokerage", "ira", "roth", "401k", "property", "other_asset"].includes(values.type) ? values.type : "savings";
      draft.accounts.push({ id: values.id, name, type, institution: "", balance, asOf: today ?? "", ownerId: "", history: [], notes: "Inherited" });
      tick("account"); return { ok: true, text: `${name} added to your accounts.` };
    }
    default: return { ok: false, text: "That change is not known." };
  }
}
