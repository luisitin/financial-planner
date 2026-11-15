// modules/investments/performance/words.js -- PURE. Every sentence the page's three quiet rows say (gap list, next 60,
// item 48), one written sentence per case (docs/OPTIONAL.md R5), each read by a test in module.test.mjs. The figures come
// from compute.js; this file only says them.
import { date, money as fmtMoney, pct } from "../../../core/format.js";
import { PERIODS, NEAR_DAYS, LAST_RETURN_YEAR } from "./compute.js";

const DAY = 86400000;
const days = (a, b) => (new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / DAY;
/** "+12.3%" / "−4.1%" (a true minus sign, as the page writes it). */
export const pc = (x) => (x === null || x === undefined || !Number.isFinite(x) ? "-" : `${x < 0 ? "−" : "+"}${pct(Math.abs(x), 1)}`);
const money = (n, cur) => fmtMoney(n, cur);
/** "+$12,000" / "−$360". */
export const signed = (n, cur) => (n < 0 ? `−${money(-n, cur)}` : `+${money(n, cur)}`);
const whole = (x) => `${Math.round(Math.abs(x) * 100)}%`;
/** "Mar 2021" from "2021-03". */
export const monthWords = (ym) => { const [y, m] = String(ym).split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }); };
const span = (b) => (b.from === b.to ? String(b.from) : `${b.from}-${b.to}`);

// ---------------------------------------------------------------- Pick the period
/** The status of "Pick the period": the chip that is on. */
export function periodStatus(per) {
  if (!per || per.fellBack) return "every saved point";
  if (per.key === "own") return "your own dates";
  return PERIODS.find((p) => p.key === per.key)?.status ?? "every saved point";
}
/** What is measured, in one sentence per case (compute's `period`). */
export function periodSentence(per) {
  if (!per?.from) return "";
  const from = date(per.from), to = date(per.to);
  if (per.key === "all" || !per.asked) return `From ${from}, the first saved point, to ${to}, the last.`;
  if (per.key === "own") return per.moved ? `You asked for ${date(per.asked.from)} to ${date(per.asked.to)}; the nearest saved points are ${from} and ${to}, so those are measured.` : `From ${from} to ${to}, as you asked.`;
  if (!per.moved) return `From ${from} to ${to}.`;
  // the stretch asked for reaches back before anything saved: it starts at the first saved point
  if (per.from === per.first && days(per.asked.from, per.from) > NEAR_DAYS) return `From ${from} to ${to}: your saved points go back only to ${from}.`;
  // this year so far starts in the year (or the December before), never at a point from last autumn
  if (per.key === "ytd" && per.from >= per.asked.from) return `From ${from} to ${to}: your first saved point this year and the one nearest to today.`;
  return `From ${from} to ${to}: the saved points nearest to ${PERIODS.find((p) => p.key === per.key)?.ask ?? "the start"} and to today.`;
}
/** The red line when a stretch holds fewer than two saved points of any account. */
export const FELL_BACK = "No two saved points fall in that stretch, so there is nothing to measure in it. The page shows every saved point instead.";
/** The date form's own refusal. */
export const DATES_BACKWARDS = "The first date has to be before the second.";

// ---------------------------------------------------------------- Compare with
/** A mix in words: "80% stocks and 20% bonds", "60% stocks, 30% bonds and 10% cash", "all stocks". */
export function mixWords(mix) {
  const parts = [["stocks", mix?.stocks], ["bonds", mix?.bonds], ["cash", mix?.bills]].filter(([, v]) => Number(v) > 0.0005);
  if (!parts.length) return "nothing";
  if (parts.length === 1) return `all ${parts[0][0]}`;
  const said = parts.map(([n, v]) => `${Math.round(Number(v) * 100)}% ${n}`);
  return said.length === 2 ? `${said[0]} and ${said[1]}` : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`;
}
/** The status of "Compare with". */
export const compareStatus = (mix) => (mix?.source === "own" ? "set by you" : `plan's ${Math.round((mix?.stocks ?? 0.7) * 100)}% stocks`);
/** Why there is no figure to set beside yours, one sentence per case (compute's `compare.why`). */
export function noFigureWords(why) {
  if (why === "picked") return "No figure for the stretch picked, which holds no whole calendar year; since the first saved point there is one.";
  if (why === "late") return `No figure: the yearly index returns here end with ${LAST_RETURN_YEAR}, and the stretch measured starts after 1/1/${LAST_RETURN_YEAR}.`;
  return "No figure yet: that needs your saved balances to cover a whole calendar year, January to December.";
}
/** The line inside "Compare with" under the chips: what the mix made, or why there is no figure. */
export function compareLine(mix, benchmark, why = "short") {
  const who = mix?.source === "own" ? `Your own mix, ${mixWords(mix)},` : `Your plan's mix, ${mixWords(mix)},`;
  if (!benchmark) return noFigureWords(why);
  return `${who} made ${pc(benchmark.annual)} a year over ${span(benchmark)}.`;
}
/** The green line after a pick (R7: it names the new answer, or says plainly that there is none yet and why). */
export function compareSaved(mix, benchmark, why = "short") {
  const own = mix?.source === "own";
  if (!benchmark) return `${own ? `Saved: you will compare with ${mixWords(mix)}.` : `Saved: you will compare with your plan's mix again, ${mixWords(mix)}.`} ${noFigureWords(why)}`;
  const said = own ? `Saved. You now compare with ${mixWords(mix)}` : `Saved. You compare with your plan's mix again: ${mixWords(mix)}`;
  return `${said}, which made ${pc(benchmark.annual)} a year over ${span(benchmark)}.`;
}
/** The words after Undo. */
export const compareBack = (mix) => `Back to comparing with ${mixWords(mix)}, as before.`;
/** The form's refusal when the three boxes do not come to 100. */
export const mixOff = (sum) => `These add up to ${Math.round(sum * 10) / 10}%. Make them come to 100%.`;

/** The hero's comparison clause, one per case: none, the plan's mix, the person's own. */
export function heroClause(stockShare, mix, benchmark) {
  if (!benchmark) return "";
  if (mix?.source === "own") return `; your own mix of ${mixWords(mix)} made ${pc(benchmark.annual)} a year over ${span(benchmark)}`;
  return `; a plain ${Math.round(stockShare * 100)}/${Math.round((1 - stockShare) * 100)} index mix made ${pc(benchmark.annual)} a year over ${span(benchmark)}`;
}

// ---------------------------------------------------------------- Gain on each holding since you bought it
/** The row's title: what it lists, so it is never read as what drove the stretch the page measures (critic P2). */
export const DRIVERS_TITLE = "Gain on each holding since you bought it";
/** The first sentence of the row, one per case. */
export function driversIntro(dr, cur) {
  const t = dr?.total;
  if (!t || !dr.rows.length) return "Type what you paid for each holding on Holdings, and this shows which gained and which lost since you bought them.";
  if (t.gain < 0) return `Since each was bought, your holdings are down ${money(-t.gain, cur)} on the ${money(t.paid, cur)} you paid (${pc(t.ret)}). Best first, worst last.`;
  return `Since each was bought, your holdings are up ${money(t.gain, cur)} on the ${money(t.paid, cur)} you paid (${pc(t.ret)}). Best first, worst last.`;
}
/** Said on the page that measures a period: what this list is not. */
export const NOT_THE_PERIOD = "This counts from when each was bought, not the stretch the page measures: the app keeps no record of each holding's value over time.";
/** A holding's share of the whole, one per case (the shares add up to 100%). */
export function shareWords(row, total) {
  if (row.share === null || row.share === undefined || !total || total.gain === 0) return "";
  if (total.gain > 0) return row.gain >= 0 ? `${whole(row.share)} of the whole gain` : `takes ${whole(row.share)} off the whole gain`;
  return row.gain <= 0 ? `${whole(row.share)} of the whole loss` : `makes the whole loss ${whole(row.share)} smaller`;
}
/** Since when, from the Tax lots: "about 7.9% a year since Mar 2021", "since Mar 2021", or nothing. */
export function sinceWords(row) {
  if (!row.since) return "";
  return row.yearly !== null && row.yearly !== undefined ? `about ${pc(row.yearly)} a year since ${monthWords(row.since)}` : `since ${monthWords(row.since)}`;
}
/** The line under a holding: "+40.0% on $30,000 paid, since Mar 2021 · 30% of the whole gain". */
export function driverSub(row, total, cur) {
  const since = sinceWords(row), share = shareWords(row, total);
  return `${pc(row.ret)} on ${money(row.paid, cur)} paid${since ? `, ${since}` : ""}${share ? ` · ${share}` : ""}`;
}
/** The holdings left out, in one line. */
export function leftWords(left) {
  if (!left?.length) return "";
  return `Left out: ${left.map((x) => `${x.symbol} (${x.why === "price" ? "no price typed in" : "no cost typed in"})`).join(", ")}.`;
}
/** Above ten holdings, the line between the best five and the worst five. */
export const betweenWords = (n) => `${n} more in between.`;
