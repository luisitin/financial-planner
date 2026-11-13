// core/demo/names.js -- the pretend families a person can look around in, and the addresses in and out of them.
// PURE (no DOM, no storage): safe to import in Node. The plans themselves are in core/demo/plans.js, which only the
// store loads, and only when a pretend family is opened (core/store.js load()).
//
// A pretend family is the sandbox (?sandbox=1) opened with &demo=<id>. It is kept under its own key in this browser
// (DEMO_KEY), so it can never be the real plan ("planner.plan"), nor a tester's own pretend plan
// ("planner.plan.sandbox"), and the sandbox never reaches the home computer. "Leave" erases the pretend copy and opens
// the app without both words in the address. core/demo/README.md has the whole story.

/** The pretend families, in the order they are offered. `chip` is the choice, `who` starts the line under the top bar. */
export const DEMOS = Object.freeze([
  Object.freeze({ id: "family", chip: "A family with children", who: "A pretend family" }),
  Object.freeze({ id: "couple", chip: "A couple near retirement", who: "A pretend couple" }),
  Object.freeze({ id: "starter", chip: "Someone starting out", who: "A pretend person" }),
]);
export const DEMO_IDS = Object.freeze(DEMOS.map((d) => d.id));
/** Where a pretend family opens: the page that shows the whole picture. */
export const DEMO_START = "#/overview/dashboard";

const params = (search) => { try { return new URLSearchParams(String(search ?? "")); } catch { return new URLSearchParams(""); } };

/**
 * Which pretend family this address asks for: an id of DEMOS, or null.
 * Only inside the sandbox: `demo` without `sandbox` is ignored (the real plan opens as always, untouched).
 * A name that is not one of ours, or none, is the first family, so a mistyped link still shows a family.
 */
export function demoOf(search) {
  const q = params(search);
  if (!q.has("sandbox") || !q.has("demo")) return null;
  const name = String(q.get("demo") ?? "").trim().toLowerCase();
  return DEMO_IDS.includes(name) ? name : DEMO_IDS[0];
}

/** Where this browser keeps a pretend family: never the real plan's key, never the tester's sandbox key. */
export const demoKey = (id) => `planner.plan.demo.${DEMO_IDS.includes(id) ? id : DEMO_IDS[0]}`;

/** The address that opens a pretend family from the page at { pathname, search }: other words in the address stay. */
export function demoHref(id, { pathname = "", search = "" } = {}) {
  const q = params(search);
  q.delete("sandbox"); q.delete("demo");
  const rest = q.toString();
  return `${pathname}?sandbox=1&demo=${DEMO_IDS.includes(id) ? id : DEMO_IDS[0]}${rest ? `&${rest}` : ""}${DEMO_START}`;
}

/** The address "Leave" opens: the same app without the sandbox and the pretend family, on its first page. */
export function leaveHref({ pathname = "", search = "" } = {}) {
  const q = params(search);
  q.delete("sandbox"); q.delete("demo");
  const rest = q.toString();
  return `${pathname || "./"}${rest ? `?${rest}` : ""}`;
}

/**
 * The line under the top bar, one sentence set per family and per case.
 * `missing`: the family's plan could not be fetched (core/store.js demoMissing), so the page under the line is empty.
 */
export function demoLine(id, { missing = false } = {}) {
  const d = DEMOS.find((x) => x.id === id) ?? DEMOS[0];
  if (missing) return `${d.who} could not be opened. Check your connection and open it again. Your plan is not touched.`;
  return `${d.who}. Nothing here touches your plan. Changes here are forgotten when you leave.`;
}

/** Where "Leave" notes, for this tab only, that a pretend family was just closed; the shell reads it once (bar.js takeLeft). */
export const LEFT_KEY = "planner.demo.left";
/** The green line on the first page after "Leave". `hasPlan`: the person's own plan holds something. */
export function leftWords(hasPlan) {
  return hasPlan ? "Pretend family closed. This is your own plan." : "Pretend family closed. Your own plan starts here.";
}

/**
 * The Dashboard's one filled button inside a pretend family: nobody "continues their plan" there, they look around.
 * "Continue your plan: Your month" -> "Look at: Your month", and the "Your plan: step 2 of 8" line above it goes.
 * Any other label is left as it is. `next`: overview/dashboard homeNext()'s result, or null.
 */
export function lookNext(next) {
  const m = /^Continue your plan: (.+)$/.exec(String(next?.label ?? ""));
  return m ? { ...next, label: `Look at: ${m[1]}`, line: null } : next;
}

/** A changed pretend copy is kept this many days, then started over (its dates were worked out from the day it was made). */
export const DEMO_KEEP_DAYS = 30;
const dayNumber = (d) => { const [y, m, dd] = String(d).split("-").map(Number); return Math.round(Date.UTC(y, m - 1, dd) / 86400000); };
/**
 * Is the copy this browser holds too old to show? `made`: { day, rev } written when the copy was made (null: unknown,
 * the copy is kept); `rev`: the copy's stamp now; `today`: YYYY-MM-DD.
 *   made today, or a day that is not behind today (a clock set back)  -> false
 *   made on an earlier day and never changed (rev is still made.rev)  -> true: made again for today, nothing is lost
 *   changed, made up to DEMO_KEEP_DAYS ago                            -> false: the changes are kept
 *   changed, made longer ago                                          -> true: started over
 */
export function demoOld({ made, rev, today }) {
  if (!made || typeof made.day !== "string") return false;
  const age = dayNumber(today) - dayNumber(made.day);
  if (!(age > 0)) return false;
  return made.rev === rev || age > DEMO_KEEP_DAYS;
}

/**
 * A birth date for someone who is `age` today and was born on month/day: the year that makes it so, whatever today is.
 * (birth year = this year - age, one less when this year's birthday is still to come.)
 */
export function bornOn(today, age, month, day) {
  const [y, m, d] = String(today).split("-").map(Number);
  const had = m > month || (m === month && d >= day);
  return iso(y - age - (had ? 0 : 1), month, day);
}
/** The date `months` from today's month (negative: ago), on `day` (1 to 28). */
export function monthsFrom(today, months, day = 1) {
  const [y, m] = String(today).split("-").map(Number);
  const n = y * 12 + (m - 1) + months;
  return iso(Math.floor(n / 12), (n % 12 + 12) % 12 + 1, Math.min(28, Math.max(1, day)));
}
export const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Today on this device's own clock, as YYYY-MM-DD. */
export function localToday(now = new Date()) { return iso(now.getFullYear(), now.getMonth() + 1, now.getDate()); }
