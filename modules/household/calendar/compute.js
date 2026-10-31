// modules/household/calendar/compute.js -- PURE. The household's money dates on one list: bills and paydays (from the
// bank lines that repeat, or the Income page when there are none), federal tax dates moved off weekends and holidays,
// Medicare and Marketplace open enrollment, required withdrawal deadlines, insurance renewals, goal dates and your
// own reminders; and the same list as a calendar file for a phone.
import { detectRecurring, nextAfter, addDays } from "../../cashflow/recurring/compute.js";
import { rmdStartYear, RMD_ACCOUNT_TYPES } from "../../../core/math/rmd.js";
import { ageOn, addMonths } from "../../../core/math/dates.js";
import { MARKETPLACE, MEDICARE_OPEN } from "./data/dates.js";

/** The kinds of date, in the order the filter chips show them. */
export const KINDS = {
  bill:     { label: "Bills", icon: "🧾" },
  pay:      { label: "Paydays", icon: "💵" },
  tax:      { label: "Taxes", icon: "🏛️" },
  health:   { label: "Health and Medicare", icon: "🩺" },
  retire:   { label: "Retirement accounts", icon: "🌴" },
  policy:   { label: "Insurance", icon: "🛡️" },
  goal:     { label: "Goals", icon: "🎯" },
  mine:     { label: "Your reminders", icon: "📌" },
};
/** How far ahead the list can look, in days. */
export const RANGES = { month: 31, quarter: 92, year: 366 };
export const REPEATS = { none: "Once", monthly: "Every month", yearly: "Every year" };

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dow = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** The nth weekday (0 = Sunday) of a month. */
const nthWeekday = (y, m, wd, n) => { const first = dow(ymd(y, m, 1)); return ymd(y, m, 1 + ((wd - first + 7) % 7) + 7 * (n - 1)); };

/**
 * Holidays that can fall on a federal tax due date: Martin Luther King Jr. Day (the third Monday of January, near the
 * January 15 payment; 5 U.S.C. 6103) and District of Columbia Emancipation Day (April 16; a Saturday is kept on the
 * Friday before and a Sunday on the Monday after, D.C. Code 1-612.02), which moves the April deadline.
 */
export function taxHolidays(year) {
  const em = ymd(year, 4, 16), d = dow(em);
  return new Set([nthWeekday(year, 1, 1, 3), d === 6 ? ymd(year, 4, 15) : d === 0 ? ymd(year, 4, 17) : em]);
}
/** A due date on a Saturday, Sunday or legal holiday moves to the next business day (IRC 7503; IRS Pub 509). */
export function dueDay(iso) {
  let d = iso;
  for (let i = 0; i < 7; i++) { const w = dow(d); if (w !== 0 && w !== 6 && !taxHolidays(Number(d.slice(0, 4))).has(d)) return d; d = addDays(d, 1); }
  return d;
}

/** Dates on a period from a start day, from `from` to `to` (Income page periods; semimonthly = the 15th and the last day). */
export function periodDates(start, period, from, to) {
  if (!isDate(start) || !isDate(from) || !isDate(to)) return [];
  const out = [];
  if (period === "semimonthly") {
    for (let m = from.slice(0, 7) + "-01"; m <= to; m = addMonths(m, 1)) {
      const [y, mo] = m.split("-").map(Number);
      for (const d of [ymd(y, mo, 15), addDays(ymd(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 1), -1)]) if (d >= from && d <= to && d >= start) out.push(d);
    }
    return out;
  }
  const step = { weekly: [0, 7], biweekly: [0, 14], monthly: [1, 0], quarterly: [3, 0], annual: [12, 0] }[period];
  if (!step) return [];
  let d = start;
  for (let i = 0; i < 2000 && d <= to; i++) {
    if (d >= from) out.push(d);
    d = step[0] ? addMonths(start, step[0] * (i + 1)) : addDays(d, step[1]);
  }
  return out;
}

/** The next yearly occurrence of a month and day on or after `from`. */
const yearly = (iso, from) => { const md = iso.slice(5); let d = `${from.slice(0, 4)}-${md}`; if (d < from) d = `${Number(from.slice(0, 4)) + 1}-${md}`; return d; };

/**
 * compute(plan, { today, range, kinds }) -> {
 *   events: [{ date, kind, title, detail, amount (signed, money in +) | null, go: [group, id] | null, source }],
 *   months: [{ month "YYYY-MM", events }], counts: { [kind]: n }, from, to, notes: [text]
 * }
 */
export function compute(plan, params = {}) {
  const today = isDate(params.today) ? params.today : null;
  if (!today) return { events: [], months: [], counts: {}, from: null, to: null, notes: [] };
  const to = addDays(today, (RANGES[params.range] ?? RANGES.quarter) - 1);
  const events = [];
  const add = (date, kind, title, extra = {}) => { if (isDate(date) && date >= today && date <= to) events.push({ date, kind, title, detail: "", amount: null, go: null, ...extra }); };
  const notes = [];
  const years = [];
  for (let y = Number(today.slice(0, 4)); y <= Number(to.slice(0, 4)) + 1; y++) years.push(y);
  const people = (plan.household?.people ?? []).filter((p) => p?.id);

  // bills and paydays: the bank lines that repeat
  const recurring = detectRecurring(plan.transactions ?? [], { today, plan }).filter((r) => !(plan.recurringIgnored ?? []).includes(r.key));
  for (const r of recurring) {
    let d = r.next;
    for (let i = 0; i < 400 && d && d <= to; i++) { add(d, r.amount > 0 ? "pay" : "bill", r.payee, { amount: r.amount, detail: `about ${r.cadenceLabel}, from your bank lines`, go: ["cashflow", "recurring"], source: "recurring" }); d = nextAfter(d, r.cadence, d); }
  }
  // paydays from the Income page, when the bank lines show none
  if (!recurring.some((r) => r.amount > 0)) {
    for (const inc of (plan.income ?? []).filter((x) => x && ["salary", "pension", "social"].includes(x.type) && x.period !== "once")) {
      if (!isDate(inc.startDate)) { if (inc.type === "salary") notes.push(`Add the first payday to "${inc.name || "your pay"}" on Income to see your paydays here.`); continue; }
      for (const d of periodDates(inc.startDate, inc.period, today, to)) if (!inc.endDate || d <= inc.endDate) add(d, "pay", inc.name || "Pay", { amount: Number(inc.amount) || null, detail: inc.period === "semimonthly" ? "the 15th and the last day of the month (a guess: your employer's days may differ)" : "from the Income page", go: ["cashflow", "income"], source: "income" });
    }
  }

  // federal tax dates
  const hasPay = (plan.income ?? []).some((x) => x?.type === "salary");
  const saver = (plan.accounts ?? []).some((a) => ["ira", "roth", "hsa"].includes(a.type));
  const estimates = (plan.taxes?.estimated?.paid ?? []).some((x) => Number(x) > 0) || (plan.income ?? []).some((x) => ["business", "rental"].includes(x?.type));
  for (const y of years) {
    if (hasPay) add(dueDay(ymd(y, 1, 31)), "tax", "W-2 pay forms due from employers", { detail: `Your employer must send your ${y - 1} pay and tax form by now.`, go: ["taxes", "documents"] });
    add(dueDay(ymd(y, 4, 15)), "tax", `Tax return for ${y - 1} due`, { detail: "File, or ask for more time (the tax owed is still due today).", go: ["taxes", "federal"] });
    if (saver) add(dueDay(ymd(y, 4, 15)), "retire", `Last day to put money in an IRA or health savings account for ${y - 1}`, { go: ["taxes", "hsa-fsa"] });
    add(dueDay(ymd(y, 10, 15)), "tax", `Tax return for ${y - 1} due if you asked for more time`, { go: ["taxes", "federal"] });
    if (estimates) for (const [m, d, q, ty] of [[1, 15, 4, y - 1], [4, 15, 1, y], [6, 15, 2, y], [9, 15, 3, y]]) add(dueDay(ymd(y, m, d)), "tax", `Estimated tax payment ${q} of 4 for ${ty}`, { go: ["taxes", "estimated"] });
  }

  // Medicare open enrollment, for anyone 65 or older by its last day
  for (const y of years) {
    const end = ymd(y, ...MEDICARE_OPEN.to);
    const who = people.filter((p) => p.birthDate && ageOn(p.birthDate, end) >= 65).map((p) => p.name).filter(Boolean);
    if (!who.length) continue;
    add(ymd(y, ...MEDICARE_OPEN.from), "health", "Medicare open enrollment opens", { detail: `Until December 7: ${who.join(" and ")} can change health or drug plans for next year.`, go: ["retirement", "medicare"] });
    add(end, "health", "Medicare open enrollment ends", { detail: "Changes start January 1.", go: ["retirement", "medicare"] });
  }
  // Marketplace open enrollment, when the household buys its own health cover
  const ownCover = (plan.insurance?.policies ?? []).some((x) => x?.kind === "health" && !x.throughWork) || Number(plan.retirement?.aca?.benchmarkMonthly) > 0;
  if (ownCover) for (const [year, w] of Object.entries(MARKETPLACE)) {
    add(w.opens, "health", `Marketplace open enrollment for ${year} opens`, { detail: `Health insurance you buy yourself (HealthCare.gov or your state's site), until ${w.closes.slice(5).replace("-", "/")}/${w.closes.slice(0, 4)}.`, go: ["insurance", "health"] });
    add(w.forJanuary, "health", `Last day to choose a Marketplace plan that starts January 1, ${year}`, { go: ["insurance", "health"] });
    add(w.closes, "health", `Marketplace open enrollment for ${year} ends`, { go: ["insurance", "health"] });
  }

  // required withdrawals from 401(k)s and IRAs
  for (const p of people) {
    const owns = (plan.accounts ?? []).some((a) => RMD_ACCOUNT_TYPES.includes(a.type) && (a.ownerId === p.id || (!a.ownerId && people.filter((q) => q.role !== "dependent").length === 1)) && Number(a.balance) > 0);
    if (!owns || !p.birthDate) continue;
    const first = rmdStartYear(p.birthDate);
    if (!first) continue;
    for (const y of years) {
      if (y === first + 1) add(ymd(y, 4, 1), "retire", `${p.name || "Your"}'s first required withdrawal deadline`, { detail: `For ${first}, from 401(k)s and traditional IRAs. Waiting until now means two withdrawals in ${y}.`, go: ["retirement", "rmd"] });
      if (y >= first + 1) add(ymd(y, 12, 31), "retire", `${p.name || "Your"}'s required withdrawal for ${y} due`, { go: ["retirement", "rmd"] });
    }
  }

  // insurance renewals and end dates
  for (const x of (plan.insurance?.policies ?? []).filter((x) => x?.id)) {
    if (isDate(x.renewalDate)) { let d = x.renewalDate < today ? yearly(x.renewalDate, today) : x.renewalDate; for (let i = 0; i < 3 && d <= to; i++, d = `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`) add(d, "policy", `${x.name || "A policy"} renews`, { detail: "A good time to compare prices.", go: ["insurance", "policies"] }); }
    if (isDate(x.endDate)) add(x.endDate, "policy", `${x.name || "A policy"} ends`, { go: ["insurance", "policies"] });
  }
  // goal dates
  for (const g of (plan.goals ?? []).filter((g) => g?.id && isDate(g.targetDate))) add(g.targetDate, "goal", `Goal date: ${g.name || "a goal"}`, { go: ["goals", "goals"] });
  // your own reminders
  for (const r of (plan.reminders ?? []).filter((r) => r?.id && isDate(r.date))) {
    const base = { detail: r.note || "", go: null, id: r.id, amount: Number.isFinite(Number(r.amount)) && r.amount !== "" && r.amount !== null ? Number(r.amount) : null, source: "reminder" };
    if (r.repeat === "monthly") { for (const d of periodDates(r.date, "monthly", today, to)) add(d, "mine", r.name || "Reminder", base); }
    else if (r.repeat === "yearly") { for (const d of periodDates(r.date, "annual", today, to)) add(d, "mine", r.name || "Reminder", base); }
    else add(r.date, "mine", r.name || "Reminder", base);
  }

  const order = Object.keys(KINDS);
  events.sort((a, b) => a.date.localeCompare(b.date) || order.indexOf(a.kind) - order.indexOf(b.kind) || a.title.localeCompare(b.title));
  const counts = Object.fromEntries(order.map((k) => [k, events.filter((e) => e.kind === k).length]));
  const shown = params.kinds?.length ? events.filter((e) => params.kinds.includes(e.kind)) : events;
  const months = [];
  for (const e of shown) { const m = e.date.slice(0, 7); if (months[months.length - 1]?.month !== m) months.push({ month: m, events: [] }); months[months.length - 1].events.push(e); }
  return { events: shown, months, counts, from: today, to, notes };
}

/** Add, change (same id) or remove a reminder on the plan draft. */
export function saveReminder(draft, r) {
  const clean = { id: r.id, name: String(r.name ?? "").trim() || "Reminder", date: isDate(r.date) ? r.date : "", repeat: REPEATS[r.repeat] ? r.repeat : "none", note: String(r.note ?? "").trim(),
    amount: r.amount === "" || r.amount === null || r.amount === undefined || !Number.isFinite(Number(r.amount)) ? null : Number(r.amount) };
  draft.reminders = draft.reminders ?? [];
  const i = draft.reminders.findIndex((x) => x.id === clean.id);
  if (i >= 0) draft.reminders[i] = clean; else draft.reminders.push(clean);
  return clean;
}
export function removeReminder(draft, id) {
  const n = (draft.reminders ?? []).length;
  draft.reminders = (draft.reminders ?? []).filter((x) => x.id !== id);
  return draft.reminders.length < n;
}

/** The events as an iCalendar file (RFC 5545): one all-day event each, lines folded at 75 octets. */
export function toIcs(events, { stamp = "20260101T000000Z", name = "Money calendar" } = {}) {
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const fold = (line) => { const out = []; let rest = line; while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; } out.push(rest); return out.join("\r\n"); };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//financial-planner//money calendar//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(name)}`];
  events.forEach((e, i) => {
    const d = e.date.replace(/-/g, ""), next = addDays(e.date, 1).replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:${d}-${i}-${e.kind}@money-calendar`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, fold(`SUMMARY:${esc(e.title)}`));
    if (e.detail) lines.push(fold(`DESCRIPTION:${esc(e.detail)}`));
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
