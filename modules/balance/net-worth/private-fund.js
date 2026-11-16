// modules/balance/net-worth/private-fund.js -- PURE. A private investment (a private fund, or a share in a business; gap list,
// next 60, item 45; README "A private investment"): an account of the kind "Something else I own" can carry
// `private: { flows: [{ id, date, kind: "in" | "back", amount }], promised? }`: the money put in and paid back, each on its
// day, and the money the fund can still ask for (capital calls promised and not made yet). Its balance is today's worth (the
// latest statement, or the person's estimate) and `asOf` that worth's day. From them: its own yearly return (the internal
// rate of return on the dated amounts, core/math/returns.js `xirr`), how many times the money put in it has come to, and the
// promised calls as money to keep ready. Still promised is not a debt: nothing is owed until the fund calls it, so it is
// never in net worth; every total goes on reading `balance` as before.
import { xirr } from "../../../core/math/returns.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY = 86400000;
const realDay = (iso) => { const t = ISO.test(String(iso ?? "")) ? new Date(`${iso}T00:00:00Z`) : null; return !!t && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso; };
/** Whole days from a to b (both ISO days), as the calendar counts them. */
const daysFrom = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const dollars = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-US")}`;
const shortDay = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const monthYearOf = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/** The first money must have been in this long before a yearly rate is said (a rate over a few months, made yearly, misleads). */
export const RATE_AFTER_DAYS = 365;
export const FLOW_KINDS = Object.freeze(["in", "back"]);

/** An account that is a private investment: "Something else I own" with a `private` object. */
export const isPrivate = (a) => !!a && typeof a === "object" && a.type === "other_asset" && !!a.private && typeof a.private === "object" && !Array.isArray(a.private);

/** Its dated amounts that can be read (a day on the calendar, in or back, an amount above 0), oldest first. */
export function flowsOf(a) {
  const list = Array.isArray(a?.private?.flows) ? a.private.flows : [];
  return list.filter((f) => f && typeof f === "object" && realDay(f.date) && FLOW_KINDS.includes(f.kind) && Number(f.amount) > 0 && Number.isFinite(Number(f.amount)))
    .map((f) => ({ id: String(f.id ?? ""), date: f.date, kind: f.kind, amount: cents(f.amount) }))
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}
/** What is still promised (capital calls not made yet): 0 when none is typed. */
export const promisedOf = (a) => { const v = Number(a?.private?.promised); return v > 0 && Number.isFinite(v) ? cents(v) : 0; };

/**
 * privateOf(account, { today }) -> { id, name, worth, worthOn, putIn, paidBack, promised, flows, firstIn, days, multiple,
 *   soFar, irr, state, staleAfter }
 *   worth: the balance (0 at least); worthOn: its day (`asOf`), else today; putIn / paidBack: the sums; multiple = (paidBack +
 *   worth) / putIn; soFar = (paidBack + worth - putIn) / putIn; days: from the first money in to worthOn;
 *   irr: the yearly rate r with sum(amount_i / (1 + r)^(t_i)) = 0 over put in (negative, on its day), paid back (positive, on
 *   its day) and the worth (positive, on worthOn), t_i in years of 365.25 days from the first amount (xirr); only from
 *   RATE_AFTER_DAYS on;
 *   state: "none" (nothing put in typed), "gone" (nothing came back and it is worth 0), "early" (under a year: soFar only),
 *   "rate" (irr), "unknown" (no rate could be found from these amounts);
 *   staleAfter: the day of the last amount after worthOn (the worth is older than money that moved), else null.
 */
export function privateOf(a, params = {}) {
  const today = params.today ?? null;
  const flows = flowsOf(a);
  const worth = Math.max(0, Number(a?.balance) || 0);
  const worthOn = realDay(a?.asOf) ? a.asOf : today;
  const putIn = cents(flows.filter((f) => f.kind === "in").reduce((s, f) => s + f.amount, 0));
  const paidBack = cents(flows.filter((f) => f.kind === "back").reduce((s, f) => s + f.amount, 0));
  const base = { id: a?.id ?? null, name: a?.name ?? "", worth, worthOn, putIn, paidBack, promised: promisedOf(a), flows, firstIn: null, days: null, multiple: null, soFar: null, irr: null, state: "none", staleAfter: null };
  if (!(putIn > 0)) return base;
  const firstIn = flows.find((f) => f.kind === "in").date;
  const after = worthOn ? flows.filter((f) => f.date > worthOn) : [];
  const out = { ...base, firstIn, days: worthOn ? daysFrom(firstIn, worthOn) : null, multiple: (paidBack + worth) / putIn, soFar: (paidBack + worth - putIn) / putIn, staleAfter: after.length ? after.at(-1).date : null };
  if (paidBack + worth < 0.005) return { ...out, state: "gone" };
  if (out.days === null || out.days < RATE_AFTER_DAYS) return { ...out, state: "early" };
  const irr = xirr([...flows.map((f) => ({ date: f.date, amount: f.kind === "in" ? -f.amount : f.amount })), ...(worth > 0 ? [{ date: worthOn, amount: worth }] : [])]);
  return irr === null || !Number.isFinite(irr) ? { ...out, state: "unknown" } : { ...out, irr, state: "rate" };
}

/** Everything on Net worth's private investments: each one, and what the funds can still ask for in all. */
export function privatesOf(plan, params = {}) {
  const list = (Array.isArray(plan?.accounts) ? plan.accounts : []).filter(isPrivate).map((a) => privateOf(a, params));
  return { list, keepReady: cents(list.reduce((s, r) => s + r.promised, 0)) };
}

// ---------------------------------------------------------------- writing (the part's form, Remove; the page adds Undo)
/**
 * planFlow({ kind, amount, date }, { today }) -> { ok: true, flow: { date, kind, amount } } | { ok: false, field, error }.
 */
export function planFlow(input = {}, params = {}) {
  const today = params.today ?? null;
  const kind = FLOW_KINDS.includes(input.kind) ? input.kind : "in";
  const amount = input.amount === null || input.amount === undefined || input.amount === "" ? NaN : Number(input.amount);
  if (!(amount > 0) || !Number.isFinite(amount)) return { ok: false, field: "amount", error: kind === "in" ? "Type how much you put in." : "Type how much it paid back." };
  const date = String(input.date ?? "");
  if (!ISO.test(date)) return { ok: false, field: "date", error: "Type the day it happened." };
  if (!realDay(date)) return { ok: false, field: "date", error: "That day is not on the calendar: check the day and the month." };
  if (today && date > today) return { ok: false, field: "date", error: "Money that has not moved yet cannot be typed here: type it on its day." };
  return { ok: true, flow: { date, kind, amount: cents(amount) } };
}
/** addFlow(draft, accountId, flow, id, { fromPromised }): the amount on the account's list (in date order); money put in that
 *  was one of the calls promised comes off what is still promised (at most all of it; none left removes the figure). */
export function addFlow(draft, accountId, flow, id, { fromPromised = false } = {}) {
  const a = (draft.accounts ?? []).find((x) => x && x.id === accountId);
  if (!isPrivate(a)) return false;
  const list = Array.isArray(a.private.flows) ? a.private.flows : [];
  const at = list.findIndex((f) => f && f.date > flow.date);
  const row = { id, date: flow.date, kind: flow.kind, amount: flow.amount };
  a.private.flows = at < 0 ? [...list, row] : [...list.slice(0, at), row, ...list.slice(at)];
  if (fromPromised && flow.kind === "in" && promisedOf(a) > 0) {
    const left = cents(Math.max(0, promisedOf(a) - flow.amount));
    if (left > 0) a.private.promised = left; else delete a.private.promised;
  }
  return true;
}
/** removeFlow(draft, accountId, id) -> the amount taken off, or null. What is still promised is left as it is. */
export function removeFlow(draft, accountId, id) {
  const a = (draft.accounts ?? []).find((x) => x && x.id === accountId);
  if (!isPrivate(a) || !Array.isArray(a.private.flows)) return null;
  const f = a.private.flows.find((x) => x && x.id === id);
  if (!f) return null;
  a.private.flows = a.private.flows.filter((x) => x !== f);
  return f;
}

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
const pct1 = (x) => `${(Math.round(Math.abs(x) * 1000) / 10).toFixed(1)}%`;
const pct0 = (x) => `${Math.round(Math.abs(x) * 100)}%`;
const times = (m) => `${(Math.round(m * 100) / 100).toFixed(2)} times`;
const backWords = (r, money) => (r.paidBack > 0 ? `got ${money(r.paidBack)} back` : "got nothing back yet");

/** The sentence under an investment's name (R5: six cases). */
export function privateSentence(r, money = dollars, monthYear = monthYearOf) {
  if (r.state === "none") return `Add what you put into ${r.name} and when, and what it paid back, to see its own yearly return.`;
  if (r.state === "gone") return `Nothing is left of the ${money(r.putIn)} you put in: nothing came back and it is worth ${money(0)} now.`;
  const parts = `you put in ${money(r.putIn)}, ${backWords(r, money)}, and it is worth ${money(r.worth)}`;
  if (r.state === "early") {
    const so = Math.abs(r.soFar) < 0.005 ? "Even so far" : r.soFar > 0 ? `Up ${pct0(r.soFar)} so far` : `Down ${pct0(r.soFar)} so far`;
    return `${so}: ${parts}. Its yearly return shows once the first money has been in a year.`;
  }
  if (r.state === "unknown") return `Its yearly return could not be worked out from these amounts: ${parts} now.`;
  const lead = r.irr >= 0 ? `About ${pct1(r.irr)} a year since ${monthYear(r.firstIn)}` : `It has lost about ${pct1(r.irr)} a year since ${monthYear(r.firstIn)}`;
  return `${lead}: ${parts} now, ${times(r.multiple)} what you put in.`;
}
/** Under it when its worth is older than money that moved since (empty otherwise). */
export const staleLine = (r, day = shortDay) => (r.staleAfter ? `What it is worth is from ${day(r.worthOn)}, before the money of ${day(r.staleAfter)}: update it with Edit, above, for a truer return.` : "");
/** The money to keep ready (empty when nothing is promised). */
export const keepReadyLine = (r, money = dollars) => (r.promised > 0 ? `${r.name} can still ask you for ${money(r.promised)}: keep that much ready, in cash or something easy to sell.` : "");
/** Above the investments when two or more have something promised (empty otherwise). */
export const keepReadyAll = (all, money = dollars) => (all.list.filter((r) => r.promised > 0).length >= 2 ? `Keep ${money(all.keepReady)} ready in all: money your investments can still ask you for.` : "");
/** The few words on the account's row after its day: "about 8.4% a year", "up 12% so far", "nothing left"; null with none typed. */
export function rowRate(r) {
  if (r.state === "rate") return r.irr >= 0 ? `about ${pct1(r.irr)} a year` : `lost about ${pct1(r.irr)} a year`;
  if (r.state === "early") return Math.abs(r.soFar) < 0.005 ? "even so far" : r.soFar > 0 ? `up ${pct0(r.soFar)} so far` : `down ${pct0(r.soFar)} so far`;
  if (r.state === "gone") return "nothing left";
  return null;
}
/** The row's line about calls (empty when nothing is promised). */
export const rowPromised = (r, money = dollars) => (r.promised > 0 ? `It can still ask for ${money(r.promised)}: keep that ready.` : "");
/** The part's status (at most 20 characters, R25): what to keep ready first, then the one investment's return, else how many. */
export function privateStatus(all, money = dollars) {
  if (all.keepReady > 0) { const s = `keep ${money(all.keepReady)} ready`; return s.length <= 20 ? s : `${money(all.keepReady)} promised`; }
  if (all.list.every((r) => r.state === "none")) return "not set yet";
  if (all.list.length === 1) return rowRate(all.list[0]) ?? "not set yet";
  return `${all.list.length} investments`;
}
/** A dated amount as the list says it: "Mar 1, 2021 · Put in" / "Mar 1, 2021 · Paid back to you". */
export const flowTitle = (f, day = shortDay) => `${day(f.date)} · ${f.kind === "in" ? "Put in" : "Paid back to you"}`;
/** The question before an amount is taken off, and the green lines. */
export const flowAsk = (f, money = dollars, day = shortDay) => `Remove the ${money(f.amount)} ${f.kind === "in" ? "put in" : "paid back"} on ${day(f.date)}?`;
const nowWords = (r) => (r.state === "rate" ? ` Its own return is now ${r.irr >= 0 ? `about ${pct1(r.irr)} a year` : `a loss of about ${pct1(r.irr)} a year`}.` : r.state === "early" ? ` ${rowRate(r)[0].toUpperCase()}${rowRate(r).slice(1)}.` : r.state === "gone" ? " Nothing is left of it." : "");
export function flowAddedSaid(f, r, money = dollars, day = shortDay, { fromPromised = false } = {}) {
  const what = f.kind === "in" ? `${money(f.amount)} put into ${r.name}` : `${money(f.amount)} paid back from ${r.name}`;
  const kept = fromPromised && f.kind === "in" ? (r.promised > 0 ? ` Still promised: ${money(r.promised)}.` : " Nothing is promised any more.") : "";
  return `Added: ${what} on ${day(f.date)}.${nowWords(r)}${kept}`;
}
export const flowRemovedSaid = (f, r, money = dollars, day = shortDay) => `Removed: the ${money(f.amount)} ${f.kind === "in" ? "put in" : "paid back"} on ${day(f.date)}.${nowWords(r)}`;
export const FLOW_UNDONE = "Undone: the amounts are back as they were.";
/** How it is worked out, in one line (README: the internal rate of return). */
export const HOW = "Its own yearly return is the one yearly rate at which every amount, from its own day, adds up to nothing: what you put in against what came back and what it is worth now (the internal rate of return).";
