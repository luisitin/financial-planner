// modules/overview/plan/words.js -- PURE. Small helpers the path (guide/journeys.js) and "Your plan" (plan/compute.js) share.
// They live here, in the path's own folder, so no other page's compute is touched:
//   goalsWords     the Dashboard's goals line, once (the Dashboard builds the same sentence inline today)
//   protectionAsks the first test of life-needs' protectionGaps: is there anyone who would need life cover, and pay to replace
//   MONTH_NAMES / monthYear small date words
// (Moves to make later are listed in the build report: alerts/compute.js could export goalsWords, and
// insurance/life-needs/asks.js could hold protectionAsks.)
import { householdRetired } from "../../retirement/projection/compute.js";
import { standing, adults, picks } from "../setup/compute.js";
import { guessTwins } from "../guesses/compute.js";
import { isGuess } from "../../../core/estimate/index.js";
import { money as fmtMoney } from "../../../core/format.js";

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthYear = (ym) => (/^\d{4}-\d{2}/.test(String(ym ?? "")) ? `${MONTH_NAMES[Number(String(ym).slice(5, 7)) - 1]} ${String(ym).slice(0, 4)}` : "");

/**
 * The words for the goals row: "2 reached, 1 behind, about $120 more a month". `gl` is goals/goals' compute, `gb` is
 * goalsBehind(gl, ...). Same sentence as the Dashboard's Goals tile; `money` formats a figure.
 */
export function goalsWords(gl, gb, money) {
  if (!gl?.count) return "none set yet";
  const behind = gb?.behind?.length ?? 0, late = gb?.pastDue?.length ?? 0, queued = gb?.queued ?? [];
  const turn = gb?.turn ? monthYear(gb.turn) : "";
  return [
    gl.done ? `${gl.done} reached` : null,
    behind ? `${behind} behind${(gb.need ?? 0) >= 1 ? `, about ${money(gb.need)} more a month` : ""}` : null,
    queued.length ? (queued.length === gl.count ? `${gl.count === 1 ? "starts" : "they start"} in ${turn}, after your earlier steps` : `${queued.length} start${queued.length === 1 ? "s" : ""} in ${turn}`) : null,
    late ? `${late} past ${late === 1 ? "its date" : "their dates"}` : null,
  ].filter(Boolean).join(", ") || "all on track";
}

/**
 * Would anyone need life cover from this household's pay? Not retired, pay on file, and children or a second adult.
 * The same first test life-needs' protectionGaps runs, without the heavy compute behind it.
 */
export function protectionAsks(plan, { today = null } = {}) {
  const people = plan?.household?.people ?? [];
  const kids = people.filter((q) => q.role === "dependent");
  const grown = people.filter((q) => q.role !== "dependent");
  const paid = (plan?.income ?? []).some((x) => ["salary", "bonus", "business"].includes(x?.type) && Number(x.amount) > 0);
  if (!paid || !(kids.length || grown.length > 1)) return false;
  let retired = false;
  try { retired = householdRetired(plan, { today }); } catch { retired = false; }
  return !retired;
}

// ---------------------------------------------------------------- the figures we filled in (moved off setup's reveal screen)
const about = (n) => { const x = Math.abs(Number(n) || 0); if (x < 1000) return Math.round(n / 10) * 10; const step = 10 ** (Math.floor(Math.log10(x)) - 2); return Math.round(n / step) * step; };
const pctOf = (r) => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
const setupHref = (id) => `#/overview/setup/${id}?back=done&from=plan`;

/**
 * guessList(plan, { today, st? }) -> [{ label, href }]: what Get started filled in for the person, one plain row each:
 * the month's spending, a debt or home guessed beside one added later, each home value, each debt's figures, an IRA kind
 * answered "Not sure", and Social Security worked out from pay. This is what setup's done screen listed under "Our guesses
 * for now" before the path (the same rows, the same words); Your plan shows the first three. `st` is setup's standing()
 * when the caller already has it.
 */
export function guessList(plan, { today = null, st = null } = {}) {
  const cur = plan?.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(Number(n) || 0), cur);
  const s = st ?? (today ? standing(plan, { today }) : null);
  if (!s) return [];
  const ad = adults(plan);
  const rows = [];
  if (s.spendGuessed) rows.push({ label: `Spending: about ${money(about(s.spendGuessed.monthly))} a month${s.spendGuessed.typed > 0 ? `, besides the ${money(s.spendGuessed.typed)} you typed` : ""}`, href: setupHref("spend") });
  for (const t of guessTwins(plan)) rows.push({ label: `Is ${t.twinName} the ${t.name.toLowerCase()} we guessed? Tell us, so it counts once`, href: "#/overview/guesses" });
  for (const a of (plan?.accounts ?? []).filter((x) => x.type === "property" && typeof x.id === "string" && isGuess(plan, `accounts[${x.id}].balance`))) rows.push({ label: `${a.name}: worth about ${money(a.balance)}`, href: "#/overview/guesses" });
  for (const g of s.guessed ?? []) {
    const parts = [g.owed !== undefined ? `still owed about ${money(g.owed)}` : null, g.rate !== null ? `rate ${pctOf(g.rate)}` : null, g.payment !== null ? `${money(g.payment)} a month` : null].filter(Boolean);
    rows.push({ label: `${g.name}: ${parts.join(", ")}`, href: "#/overview/guesses" });
  }
  for (const x of s.iraGuessed ?? []) rows.push({ label: `${ad.length > 1 ? x.name : "Your retirement"}: counted as a regular IRA. Tell us if it is the tax-free kind`, href: setupHref("have-amounts") });
  const ssLine = (s.later ?? []).find((l) => l.key === "ss-estimate");
  if (ssLine) rows.push({ label: ssLine.label, href: ssLine.href });
  return rows;
}

/**
 * notCounted(plan, { today, st? }) -> [{ label, href }]: what is left out of the figures so far (setup's "Not counted yet"):
 * the state's income tax, childcare, tax filed as two returns, and a car loan whose car is not in yet.
 */
export function notCounted(plan, { today = null, st = null } = {}) {
  const s = st ?? (today ? standing(plan, { today }) : null);
  if (!s) return [];
  const rows = (s.later ?? []).filter((l) => !["income", "spend", "accounts", "retire", "ss-estimate"].includes(l.key)).map((l) => ({ label: l.label, href: l.href }));
  const carLoan = (plan?.accounts ?? []).some((a) => a.type === "loan" && (a.id === "setup-owe-car-loan" || /car|auto|vehicle|truck/i.test(a.name ?? "")) && Math.abs(Number(a.balance) || 0) > 0);
  const carIn = (plan?.accounts ?? []).some((a) => a.type === "vehicle" && Number(a.balance) > 0);
  if (carLoan && !carIn) rows.unshift({ label: "Your car: type what it would sell for, so it counts beside its loan", href: setupHref(picks(plan, "have").includes("car") ? "have-amounts" : "have") });
  return rows;
}
