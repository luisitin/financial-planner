// modules/overview/setup/view.js -- DOM only. "Set up my plan": one question per screen at #/overview/setup/<screen>
// (the phone's Back button goes to the previous question). Answers live in the screen until Continue (or Finish
// later), which saves them in one store.update -- compute.js turns them into the pages' own records -- and moves on.
// A Continue that changes nothing saves nothing (compute's wouldChange). Enter in a box moves to the next box; only
// the Continue button moves on. What was typed and not saved is kept while you go Back and forth (drafts).
// "?back=done" (from Change an answer): saving returns to where you stand.
import {
  SCREENS, QUESTIONS, HAVE, OWE, GOALS, PAY_PERIODS, WHO_PAYS, OTHER_KINDS, RETIRE_KINDS, DATE_CHIPS, STATES, TYPICAL_RATES,
  adults, dependents, picks, nextScreen, prevScreen, resolveScreen, barShare, valuesFor, reflect, hasMortgage,
  existingHave, existingOwe, existingPay, askOwners, oweTaken, goalTaken, askHomeWithMortgage, spendRows,
  spendBase, loansAfterWork, allRetired, cushion, estimateSocialSecurity, yearlyPay, parseMoney, possessive, wouldChange,
  markAt, applyYou, applyMoney, applyAges, applyHavePicks, applyHaveAmounts, applyOwePicks, applyOweAmounts, applySpend,
  applyGoalPicks, applyGoalDetails, applyGuesses, progress, standing, payLineNow, oweArgs, haveId, spendArgs, spendBasis, housingWords,
  WORK_PLAN, workPlanAcct, workPlanLine, workPlanAdded, goalFundChoices, cushionHave, cushionHeldWords, cushionHeldAsk, IRA_KINDS, iraKindHelp,
  ssGettingHelp, goalAmountHelp, GOAL_FUNDS_HELP, goalWords,
} from "./compute.js";
import { typoCheck } from "../../../core/math/estimate.js";
import { applies, guessesInUse, isGuess } from "../../../core/estimate/index.js";
import { guessTwins } from "../guesses/compute.js";
import { dayWords } from "../next-best-action/compute.js";
import { fullRetirementAge } from "../../retirement/social-security/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { ageOn } from "../../../core/math/dates.js";

let pending = [];        // [{ kind, text }] for the top of the next screen (the shell redraws after every save)
let lastShare = 0;       // the bar starts where the last screen left it, then fills to this one
let reveal = false;      // the last Continue was just tapped: show "Putting your plan together" once
let drafts = {};         // { [screen]: { v, at } }: typed, not saved yet, kept for Back and forth while the plan is unchanged
let cameFrom = null;     // the screen a Continue just left: stamped on the next screen's history entry, so Back can go back
let warnedPay = null;    // the low-pay question already asked once for these figures
let warnedKept = null;   // the "Kept X" warnings Finish later already stopped for once

const STYLE = `
.su-root { max-width: 580px; margin: 0 auto; }
.su-root input::placeholder { color: var(--muted); opacity: 1; }
.su-root .su-vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.su-top { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: -6px 0 2px; }
.su-root .su-icon { flex: none; width: 44px; height: 44px; padding: 0; display: grid; place-items: center; border-radius: 50%; border: 0; background: none; color: var(--accent-ink); font-size: 28px; line-height: 1; }
.su-root .su-icon:hover { background: var(--panel-2); filter: none; }
.su-bar { flex: 1; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
.su-bar > span { display: block; height: 100%; background: var(--accent); border-radius: 999px; transition: width .5s cubic-bezier(.2,.8,.2,1); }
.su-root .su-later { flex: none; min-height: 44px; padding: 0 6px; border: 0; background: none; color: var(--text-2); font-weight: 600; font-size: var(--fs-sm); }
.su-root .su-later:hover { color: var(--accent-ink); filter: none; }
.su-count { color: var(--text-2); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; margin: 0 0 10px 54px; }
.su-card { display: block; background: var(--panel); border: 1px solid var(--line); border-radius: calc(var(--radius) + 6px); box-shadow: var(--shadow); padding: 22px 18px 16px; animation: su-in .3s ease-out; }
@keyframes su-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes su-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
@keyframes su-dot { 0%, 80%, 100% { transform: scale(.5); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }
.su-emoji { font-size: 40px; line-height: 1; margin: 0 0 12px; }
.su-q { font-size: var(--fs-xl); line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 8px; text-wrap: balance; }
.su-q:focus { outline: none; }
.su-help { color: var(--text-2); margin: 0 0 20px; font-size: var(--fs); line-height: 1.5; }
.su-card .notice { margin: 0 0 16px; }
.su-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 20px; }
.su-tiles.three { grid-template-columns: 1fr; gap: 8px; }
.su-root .su-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 4px; min-height: 96px; padding: 12px; text-align: left; font-weight: 400;
  background: var(--panel-2); color: var(--text); border: 1.5px solid var(--line-2); border-radius: var(--radius); transition: border-color .15s, background .15s, transform .1s; }
.su-root .su-tile:hover { filter: none; border-color: var(--accent); }
.su-root .su-tile:active { transform: scale(.98); }
.su-root .su-tile:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.su-tile .su-ti { font-size: 28px; line-height: 1.1; }
.su-tile .su-tx { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.su-tile .su-tl { font-weight: 650; font-size: var(--fs); line-height: 1.25; }
.su-tile .su-ts { color: var(--text-2); font-size: var(--fs-sm); line-height: 1.3; }
.su-root .su-tile.on { border-color: var(--accent); background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); }
.su-tile.on::after { content: "✓"; content: "✓" / ""; position: absolute; top: 9px; right: 9px; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: 13px; font-weight: 700; display: grid; place-items: center; }
.su-root .su-tile.have { cursor: default; }
.su-root .su-tile.have .su-ti { opacity: .6; }
.su-root .su-tile.have:hover { border-color: var(--accent); }
.su-root .su-tile.wide { grid-column: 1 / -1; min-height: 60px; flex-direction: row; align-items: center; gap: 12px; }
.su-root .su-tiles.three .su-tile { min-height: 60px; flex-direction: row; align-items: center; gap: 12px; padding: 10px 14px; }
.su-tiles.three .su-tile .su-tx, .su-tile.wide .su-tx { flex: 1; gap: 2px; padding-right: 26px; }
.su-tiles.three .su-tile.on::after, .su-tile.wide.on::after { top: 50%; transform: translateY(-50%); }
.su-field { display: block; margin: 0 0 16px; }
.su-field > label { display: block; }
.su-label { display: block; font-weight: 600; margin: 0 0 6px; }
.su-sub { display: block; color: var(--text-2); font-size: var(--fs); line-height: 1.45; margin: 6px 0 0; }
.su-in { width: 100%; min-height: 52px; font: inherit; font-size: var(--fs-lg); padding: 10px 14px; border: 1.5px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel); color: var(--text); }
.su-in:focus { border-color: var(--accent); outline: 3px solid var(--accent-soft); outline-offset: 0; }
select.su-in { font-size: var(--fs-md); }
.su-money { position: relative; }
.su-money > span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-2); font-size: var(--fs-lg); pointer-events: none; }
.su-money > input { padding-left: 32px; font-variant-numeric: tabular-nums; }
.su-pct { position: relative; }
.su-pct > span { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--text-2); font-size: var(--fs-lg); pointer-events: none; }
.su-pct > input { padding-right: 34px; }
.su-seg { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
.su-root .su-seg button { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1.5px solid var(--line-2); background: var(--panel); color: var(--text); font-weight: 600; }
.su-root .su-seg button:hover { filter: none; border-color: var(--accent); }
.su-root .su-seg button[aria-checked="true"], .su-root .su-seg button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); }
.su-group { border-top: 1px solid var(--line); padding: 18px 0 16px; }
.su-root .su-gap { margin-top: 18px; }
.su-group > :last-child, .su-group > :last-child > :last-child { margin-bottom: 0; }
.su-group.first { border-top: 0; padding-top: 0; }
.su-gh { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: var(--fs-md); margin: 0 0 12px; }
.su-gh .sum { margin-left: auto; color: var(--text-2); font-weight: 600; font-size: var(--fs); font-variant-numeric: tabular-nums; }
.su-step { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.su-root .su-step button { width: 48px; height: 48px; padding: 0; border-radius: 50%; border: 1.5px solid var(--line-2); background: var(--panel); color: var(--text); font-size: 22px; display: grid; place-items: center; }
.su-root .su-step button:hover { filter: none; border-color: var(--accent); }
.su-step output { min-width: 2.5ch; text-align: center; font-size: var(--fs-xl); font-weight: 700; font-variant-numeric: tabular-nums; }
.su-step .su-live { color: var(--text-2); margin: 0; }
.su-born { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px; }
.su-live { color: var(--text-2); font-size: var(--fs); line-height: 1.45; margin: 6px 0 0; }
.su-live:empty { display: none; }
.su-live b { color: var(--text); }
.su-row { display: grid; grid-template-columns: 1fr 9rem; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--line); }
.su-gh + .su-row { border-top: 0; }
.su-row .su-label { margin: 0; }
.su-row .su-sub { margin: 2px 0 0; font-size: var(--fs-sm); }
.su-row .su-in { min-height: 48px; font-size: var(--fs-md); }
.su-row .su-money > span { font-size: var(--fs-md); left: 12px; }
.su-row .su-money > input { padding-left: 26px; }
.su-row .su-fixed { text-align: right; font-size: var(--fs-md); font-weight: 600; font-variant-numeric: tabular-nums; padding-right: 14px; }
.su-total { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 14px 16px; margin: 8px 0 0; border-radius: var(--radius-sm); background: var(--panel-2); font-weight: 650; }
.su-total b { font-size: var(--fs-lg); font-variant-numeric: tabular-nums; }
.su-parts { color: var(--text-2); font-size: var(--fs-sm); text-align: right; margin: 6px 4px 20px; font-variant-numeric: tabular-nums; }
.su-parts:empty { margin-bottom: 20px; }
.su-have { background: var(--panel-2); border-radius: var(--radius-sm); padding: 12px 14px; margin: 0 0 16px; color: var(--text-2); line-height: 1.45; }
.su-have b { color: var(--text); font-weight: 600; }
.su-basis { margin: 4px 0 12px; font-size: var(--fs-sm); }
.su-first { margin: 0 0 8px; font-weight: 600; color: var(--text); font-size: var(--fs-sm); }
.su-basis[hidden], .su-first[hidden], .su-tap[hidden], .su-adjust[hidden] { display: none; }
.su-tap { padding: 0 0 12px; }
.su-tap .su-field { margin: 0; }
.su-tap .su-label { font-size: var(--fs-sm); font-weight: 600; }
.su-laterline { border-top: 1px solid var(--line); padding: 16px 0 0; margin: 0 0 8px; font-size: var(--fs-sm); }
.su-laterline:empty { display: none; }
.su-actions { display: flex; gap: 10px; margin: 22px 0 0; }
.su-root .su-actions .su-backbtn { flex: 0 0 auto; min-height: 52px; padding: 0 18px; }
.su-root .su-actions .su-go { flex: 1; min-height: 52px; font-size: var(--fs-md); }
.su-root .su-skip { display: block; width: 100%; background: none; border: 0; color: var(--text-2); font-weight: 600; min-height: 48px; margin-top: 4px; }
.su-root .su-skip:hover { color: var(--accent-ink); filter: none; }
.su-root a.su-skip { display: flex; align-items: center; justify-content: center; text-align: center; }
.su-foot { text-align: center; color: var(--text-2); font-size: var(--fs-sm); line-height: 1.5; margin: 16px 0 4px; }
.su-list { list-style: none; padding: 0; margin: 4px 0 20px; display: grid; gap: 14px; }
.su-list li { display: flex; gap: 14px; align-items: center; }
.su-list .su-li { flex: none; width: 44px; height: 44px; border-radius: 14px; background: var(--accent-soft); display: grid; place-items: center; font-size: 22px; }
.su-list b { display: block; font-weight: 650; }
.su-list .m { display: block; color: var(--text-2); }
.su-ticks { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 8px; }
.su-ticks li { display: flex; gap: 10px; align-items: center; color: var(--text); }
.su-ticks li::before { content: "✓"; content: "✓" / ""; flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: 12px; font-weight: 700; display: grid; place-items: center; }
.su-meter { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 8px 0 0; }
.su-meter > span { display: block; height: 100%; background: var(--ok); border-radius: 999px; }
.su-wait { text-align: center; padding: 56px 12px; }
.su-dots { display: inline-flex; gap: 8px; margin: 0 0 16px; }
.su-dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--accent); animation: su-dot 1.2s infinite ease-in-out; }
.su-dots i:nth-child(2) { animation-delay: .15s; } .su-dots i:nth-child(3) { animation-delay: .3s; }
.su-done-head { text-align: center; margin: 2px 0 20px; }
.su-check { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; background: var(--ok-soft); color: var(--ok); display: grid; place-items: center; font-size: 32px; font-weight: 700; animation: su-pop .5s ease-out; }
.su-done-head .su-q { margin-bottom: 8px; }
.su-done-head p { color: var(--text-2); margin: 0 auto; max-width: 30em; line-height: 1.5; }
.su-stand { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 26px; }
.su-stand .su-fig { display: flex; flex-direction: column; border-radius: var(--radius); border: 1px solid var(--line); background: var(--panel-2); padding: 12px 12px 10px; min-width: 0; color: inherit; text-decoration: none; }
.su-stand .su-fig .stat { padding: 0; border: 0; background: none; flex: none; }
.su-stand .su-fig:first-child { grid-column: 1 / -1; }
.su-stand .su-fig:not(:first-child) .stat-value { font-size: var(--fs-lg); }
.su-stand .su-fig:not(:first-child) .stat-value.long, .su-stand .su-fig:not(:first-child) .stat-value.xlong { font-size: var(--fs-md); }
.su-stand .su-fig .stat-value { font-variant-numeric: tabular-nums; }
.su-stand .su-fig .stat-label { font-size: var(--fs-sm); line-height: 1.3; margin-top: 2px; color: var(--text); font-weight: 600; }
.su-stand .su-fig .stat-sub { font-size: var(--fs-sm); color: var(--text-2); margin-top: 6px; line-height: 1.35; }
.su-stand .su-fig .st { margin-top: auto; padding-top: 8px; font-size: var(--fs-sm); font-weight: 650; color: var(--text-2); }
.su-stand .su-fig.ok .st { color: var(--ok); }
.su-stand .su-fig.warn .st { color: var(--warn); }
.su-stand .su-fig.open .stat-value { color: var(--text-2); font-size: var(--fs-lg); }
.su-stand a.su-fig .st { color: var(--accent-ink); }
.su-stand a.su-fig.calm .st { color: var(--text-2); }
.su-stand a.su-fig:hover { border-color: var(--accent); }
.su-h2 { font-size: var(--fs-lg); margin: 0 0 12px; }
.su-moves { list-style: none; padding: 0; margin: 0 0 24px; display: grid; gap: 10px; }
.su-moves a { display: flex; gap: 12px; align-items: center; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: var(--text); text-decoration: none; min-height: 64px; }
.su-moves a:hover { border-color: var(--accent); }
.su-moves .n { flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: var(--on-accent); display: grid; place-items: center; font-weight: 700; }
.su-moves b { display: block; font-weight: 650; }
.su-moves .d { display: block; color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; line-height: 1.4; }
.su-moves .c { margin-left: auto; color: var(--text-2); font-size: 22px; }
.su-root .page-list { margin: 0 0 22px; }
.su-root .page-list .row-link { align-items: center; min-height: 52px; padding: 8px 4px; }
.su-root .page-list .row-link .t { color: var(--text); font-weight: 600; }
.su-root .page-list .row-link .chev { flex: none; margin-left: auto; color: var(--text-2); font-size: 22px; line-height: 1; padding-left: 8px; }
.su-root .page-list .d { display: block; color: var(--text-2); }
.su-guess { margin: 0 0 24px; }
.su-guess .su-list { margin-top: 12px; }
.su-guess .su-gbtns { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.su-end { display: grid; gap: 10px; }
.su-root .su-end .btn, .su-root .su-end button { display: flex; align-items: center; justify-content: center; min-height: 52px; font-size: var(--fs-md); }
@media (max-width: 719px) { .su-stand .su-fig:last-child:nth-child(even) { grid-column: 1 / -1; } }
@media (min-width: 720px) {
  .su-card { padding: 30px 32px 22px; }
  .su-tiles, .su-tiles.three { grid-template-columns: 1fr 1fr 1fr; }
  .su-root .su-tiles.three .su-tile { min-height: 84px; flex-direction: column; align-items: flex-start; gap: 4px; }
  .su-tiles.three .su-tile .su-tx { padding-right: 0; }
  .su-tiles.three .su-tile .su-tl { padding-right: 22px; }
  .su-tiles.three .su-tile.on::after { top: 9px; transform: none; }
  .su-stand .su-fig:first-child { grid-column: auto; }
  .su-stand .su-fig:nth-child(n) .stat-value, .su-stand .su-fig:nth-child(n) .stat-value.long { font-size: var(--fs-xl); }
}
@media (max-width: 380px) { .su-row { grid-template-columns: 1fr 8rem; } }
@media (prefers-reduced-motion: reduce) { .su-card, .su-check, .su-dots i { animation: none; } .su-bar > span, .su-tile { transition: none; } }
`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FOOT = "🔒 Everything stays on your own devices. No bank logins or account numbers, ever.";
const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
/** append / replace children, skipping null, false and "" (the DOM would print "null"). */
const keep = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false && k !== "");
const add = (el, ...kids) => el.append(...keep(kids));
const swap = (el, ...kids) => el.replaceChildren(...keep(kids));
const and = (list) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);
let uid = 0;
/** "1234567.5" -> "1,234,567.5" as you type (k and m kept at the end). */
function groupDigits(raw) {
  let s = String(raw ?? "").replace(/[^0-9.kKmM]/g, "");
  const suf = /[kKmM]$/.test(s) ? s.slice(-1).toLowerCase() : "";
  s = s.replace(/[kKmM]/g, "");
  const [i, ...rest] = s.split(".");
  const int = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return int + (rest.length ? `.${rest.join("").slice(0, 2)}` : "") + suf;
}
/** One choice of a radio group: tabindex 0 on the checked option (else the first), -1 on the rest; arrow keys move. */
function roving(btns) {
  const at = Math.max(0, btns.findIndex((b) => b.getAttribute("aria-checked") === "true"));
  btns.forEach((b, i) => { b.tabIndex = i === at ? 0 : -1; });
}
function arrows(box, btns) {
  box.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = btns[(i + step + btns.length) % btns.length];
    n.focus(); n.click();
  });
}

export function render(page, ctx) {
  const { ui, fmt, store } = ctx;
  const plan = ctx.plan;
  const today = fmt.today();
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
  // an "about" figure that adds up our guesses: three significant figures ($158,900 -> $159,000), $10 under $1,000
  const about = (n) => { const x = Math.abs(Number(n) || 0); if (x < 1000) return Math.round(n / 10) * 10; const step = 10 ** (Math.floor(Math.log10(x)) - 2); return Math.round(n / step) * step; };
  const pctOf = (r) => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
  const symbol = (() => { try { return new Intl.NumberFormat(plan.meta?.locale || "en-US", { style: "currency", currency: cur }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$"; } catch { return "$"; } })();
  const prog = progress(plan);
  const asked = ctx.route.rest?.[0] ?? "welcome";
  const backDone = ctx.route.query?.back === "done";
  const screenId = resolveScreen(plan, SCREENS.some((s) => s.id === asked) ? asked : "welcome");
  if (screenId !== asked && asked !== "welcome") { try { history.replaceState(history.state, "", `#/overview/setup/${screenId}${backDone ? "?back=done" : ""}`); } catch { /* the address stays; the screen is right */ } }
  if (cameFrom) { try { history.replaceState({ ...(history.state ?? {}), suFrom: cameFrom }, ""); } catch { /* Back then replaces instead */ } cameFrom = null; }
  const screen = SCREENS.find((s) => s.id === screenId);
  const root = ui.h("div", { class: "su-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  try { window.scrollTo(0, 0); } catch { /* no window in tests */ }

  const go = (id, query = {}) => ctx.go("overview", "setup", id === "welcome" ? [] : [id], query);
  const ad = adults(plan);
  const self = ad.find((p) => p.role === "self") ?? ad[0];
  const firstName = self && self.name && self.name !== "Me" ? self.name : null;
  const named = (p, text) => (ad.length > 1 && p ? `${p.name}: ${text}` : null);
  const setupHref = (id) => `#/overview/setup/${id}?back=done`;
  // a draft lives while the plan is the one it was typed against
  const stamp = plan.meta?.updatedAt ?? "";
  const draft = (make) => { const d = drafts[screenId]; if (d && d.at === stamp) return d.v; const v = make(); drafts[screenId] = { v, at: stamp }; return v; };

  /** The answers on screen as a writer; Continue and Finish later save through it. */
  let current = null;
  const toStart = () => { drafts = {}; ctx.go("overview", "start"); };
  const save = (then) => {
    if (!current) { then(nextScreen(plan, screenId)); return; }
    let kept = [];
    const fn = (d) => { kept = current.apply(d) || []; markAt(d, then === toStart ? screenId : nextScreen(d, screenId), today); };
    const changed = wouldChange(plan, fn);
    if (changed) store.update(fn);
    delete drafts[screenId];
    warnedPay = null;
    const after = store.get();
    pending = [];
    const said = current.words?.(after);
    if (said) pending.push({ kind: "ok", text: said });
    for (const k of kept) pending.push({ kind: "warn", text: `Kept ${k.name}: ${k.reason}. ${k.page === "#/household/people" ? "Remove them on People" : "Remove it on Net worth"} if you mean to.` });
    if (then === toStart) {
      const warns = pending.filter((n) => n.kind === "warn"), key = JSON.stringify(warns);
      if (warns.length && warnedKept !== key) {
        // stay, so the reason an account stayed is seen; the shell redraws this screen after the save
        warnedKept = key;
        pending = warns;
        if (!changed) { for (const n of pending) { const el = ui.notice(n.kind, n.text); el.setAttribute("role", "alert"); card.prepend(el); } pending = []; }
        return;
      }
      warnedKept = null;
      pending = [];
    }
    then(nextScreen(after, screenId));
  };
  const forward = () => {
    const ask = current?.check?.();
    if (ask && warnedPay !== ask) {
      warnedPay = ask;
      card.querySelector(".su-ask")?.remove();
      const el = ui.notice("warn", ask); el.classList.add("su-ask"); el.setAttribute("role", "alert");
      card.prepend(el);
      try { el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); } catch { /* a nicety */ }
      return;
    }
    save((next) => {
      cameFrom = screenId;
      if (backDone) { if (SCREENS.find((s) => s.id === next)?.follow) go(next, { back: "done" }); else go("done"); return; }
      if (next === "done") reveal = true;
      go(next);
    });
  };
  const skip = () => {
    const fn = (d) => { if (screenId === "you" && !(d.household?.people ?? []).length) applyYou(d, { who: "me" }); markAt(d, nextScreen(d, screenId), today); };
    if (wouldChange(plan, fn)) store.update(fn);
    delete drafts[screenId];
    const next = nextScreen(store.get(), screenId);
    if (next === "done") reveal = true;
    cameFrom = screenId;
    go(next);
  };
  // Back goes back in history when this screen was reached by Continue from the one before; else it replaces the
  // address, so the phone's Back never walks forward through the questions
  const back = () => {
    if (backDone) { history.back(); return; }
    const prev = prevScreen(plan, screenId);
    if (!prev || prev === "welcome") { toStart(); return; }
    let from = null;
    try { from = history.state?.suFrom ?? null; } catch { from = null; }
    if (from === prev) { history.back(); return; }
    try { location.replace(`#/overview/setup/${prev}`); } catch { go(prev); }
  };

  // the top: back, the bar, finish later; then "Question 3 of 7" (the heading says it to screen readers)
  if (screen.q) {
    const share = barShare(screenId);
    const fill = ui.h("span", { style: { width: `${Math.max(3, Math.round(lastShare * 100))}%` } });
    add(root,
      ui.h("div", { class: "su-top" },
        ui.h("button", { type: "button", class: "su-icon", "aria-label": "Back", onClick: back }, "‹"),
        ui.h("div", { class: "su-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(share * 100)), "aria-valuetext": `Question ${screen.q} of ${QUESTIONS}`, "aria-label": "How far along" }, fill),
        backDone ? null : ui.h("button", { type: "button", class: "su-later", onClick: () => save(toStart) }, "Finish later")),
      ui.h("p", { class: "su-count", "aria-hidden": "true" }, `Question ${screen.q} of ${QUESTIONS}`));
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${Math.max(3, Math.round(share * 100))}%`; }));
    lastShare = share;
  }
  const card = ui.h("form", { class: "su-card", "aria-labelledby": "su-q", novalidate: true, onSubmit: (e) => { e.preventDefault(); forward(); } });
  add(root, card);
  // Enter (the phone keyboard's Next) moves to the next box, never on to the next question; the last box says Done
  const boxes = () => [...card.querySelectorAll("input.su-in, select.su-in")].filter((el) => el.offsetParent !== null && !el.disabled);
  card.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("su-in")) return;
    e.preventDefault();
    const all = boxes(), nxt = all[all.indexOf(t) + 1];
    if (nxt) nxt.focus(); else t.blur();
  });
  card.addEventListener("focusin", (e) => { const t = e.target; if (t instanceof HTMLInputElement && t.classList.contains("su-in")) { const all = boxes(); t.setAttribute("enterkeyhint", all[all.length - 1] === t ? "done" : "next"); } });
  for (const n of pending) { const el = ui.notice(n.kind, n.text); el.setAttribute("role", "status"); add(card, el); ctx.announce?.(n.text); }
  pending = [];

  // ---- small parts
  const head = (emoji, q, help) => add(card,
    emoji ? ui.h("div", { class: "su-emoji", "aria-hidden": "true" }, emoji) : null,
    ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, screen.q ? ui.h("span", { class: "su-vh" }, `Question ${screen.q} of ${QUESTIONS}: `) : null, q),
    help ? ui.h("p", { class: "su-help" }, help) : null);
  const actions = (label = "Continue", { noSkip = false, skipLabel = "Skip this question", onSkip = skip } = {}) => {
    add(card, ui.h("div", { class: "su-actions" },
      ui.h("button", { type: "button", class: "secondary su-backbtn", onClick: back }, "‹ Back"),
      ui.h("button", { type: "submit", class: "su-go" }, backDone ? "Save" : label)));
    if (!noSkip && !backDone) add(card, ui.h("button", { type: "button", class: "su-skip", onClick: onSkip }, skipLabel));
  };
  /**
   * Choice tiles, built once and updated in place (so focus and the screen reader stay on the tile tapped). Multi:
   * aria-pressed; one-of (radio): role radio, one Tab stop, arrow keys. `isHave`: already in the plan, shown ticked.
   */
  const tileGroup = (label, opts, { cls = "", radio = false, isOn, onPick, isHave = () => false }) => {
    const box = ui.h("div", { class: `su-tiles${cls}`, role: radio ? "radiogroup" : "group", "aria-label": label });
    let btns = [];
    const refresh = () => {
      btns.forEach((b, i) => {
        const o = opts[i], have = isHave(o), on = have || !!isOn(o);
        b.classList.toggle("on", on);
        if (radio) b.setAttribute("aria-checked", String(on));
        else if (!have) b.setAttribute("aria-pressed", String(on));
      });
      if (radio) roving(btns);
    };
    btns = opts.map((o) => {
      const have = isHave(o);
      return ui.h("button", {
        type: "button", class: `su-tile${o.wide ? " wide" : ""}${have ? " have" : ""}`, "data-key": o.key, role: radio ? "radio" : null, "aria-disabled": have ? "true" : null,
        onClick: have ? null : () => { onPick(o); refresh(); },
      }, ui.h("span", { class: "su-ti", "aria-hidden": "true" }, o.icon), ui.h("span", { class: "su-tx" }, ui.h("span", { class: "su-tl" }, o.label), have ? ui.h("span", { class: "su-ts" }, "Already in your plan") : o.line ? ui.h("span", { class: "su-ts" }, o.line) : null));
    });
    add(box, btns);
    refresh();
    if (radio) arrows(box, btns);
    return box;
  };
  /** Help under a box, read out with it (aria-describedby) and kept out of its name. */
  const describe = (control, sub) => {
    if (!sub) return null;
    const id = `su-h-${++uid}`;
    const el = control.matches?.("input, select") ? control : control.querySelector?.("input, select") ?? control;
    el.setAttribute("aria-describedby", id);
    return ui.h("span", { class: "su-sub", id }, sub);
  };
  // no grey figure by default: a grey figure in a box is what the plan counts (smart guesses, rule P1), never an example
  const moneyIn = (value, onValue, { label = null, placeholder = "" } = {}) => {
    const input = ui.h("input", { class: "su-in", inputmode: "decimal", enterkeyhint: "next", autocomplete: "off", value: groupDigits(value === null || value === undefined ? "" : String(value)), placeholder, "aria-label": label });
    input.addEventListener("input", () => {
      const at = input.selectionStart ?? input.value.length;
      const before = input.value.slice(0, at).replace(/[^0-9.kKmM]/g, "").length;
      input.value = groupDigits(input.value);
      let n = 0, p = 0;
      while (p < input.value.length && n < before) { if (input.value[p] !== ",") n++; p++; }
      try { input.setSelectionRange(p, p); } catch { /* not focused */ }
      onValue(input.value);
    });
    return ui.h("div", { class: "su-money" }, ui.h("span", { "aria-hidden": "true" }, symbol), input);
  };
  const pctIn = (value, onValue, label, placeholder) => ui.h("div", { class: "su-pct" }, ui.h("input", { class: "su-in", inputmode: "decimal", enterkeyhint: "next", value: value === "" || value === null || value === undefined ? "" : String(value), placeholder, "aria-label": label, onInput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); onValue(e.target.value); } }), ui.h("span", { "aria-hidden": "true" }, "%"));
  const field = (label, control, sub) => ui.h("div", { class: "su-field" }, ui.h("label", {}, ui.h("span", { class: "su-label" }, label), control), describe(control, sub));
  const fieldset = (label, control, sub) => ui.h("div", { class: "su-field" }, label ? ui.h("span", { class: "su-label" }, label) : null, control, describe(control, sub));
  /** One of a few, as pills (role radio), updated in place; one Tab stop, arrow keys. */
  const seg = (options, value, onPick, label) => {
    const wrap = ui.h("div", { class: "su-seg", role: "radiogroup", "aria-label": label });
    let v = value;
    const btns = options.map((o) => ui.h("button", { type: "button", role: "radio", onClick: () => { v = o.value; mark(); onPick(o.value); } }, o.label));
    const mark = () => { btns.forEach((b, i) => b.setAttribute("aria-checked", String(options[i].value === v))); roving(btns); };
    add(wrap, btns); mark(); arrows(wrap, btns);
    return wrap;
  };
  const toggle = (label, on, onFlip) => {
    const b = ui.h("button", { type: "button", "aria-pressed": String(!!on), onClick: () => { on = !on; b.setAttribute("aria-pressed", String(on)); b.textContent = on ? `✓ ${label}` : label; onFlip(on); } }, on ? `✓ ${label}` : label);
    return ui.h("div", { class: "su-seg" }, b);
  };
  /** A number with − and +; a starting value outside the range is reported back at once, so what shows is what saves. */
  const stepper = (value, min, max, onValue, label, live) => {
    let v = Math.max(min, Math.min(max, Number(value) || min));
    if (v !== Number(value)) onValue(v);
    const out = ui.h("output", { "aria-live": "polite" }, String(v));
    const note = live ? ui.h("span", { class: "su-live" }, live(v)) : null;
    const set = (n) => { v = Math.max(min, Math.min(max, n)); out.textContent = String(v); if (note) note.textContent = live(v); onValue(v); };
    return ui.h("div", { class: "su-step", role: "group", "aria-label": label },
      ui.h("button", { type: "button", "aria-label": `Less: ${label}`, onClick: () => set(v - 1) }, "−"), out,
      ui.h("button", { type: "button", "aria-label": `More: ${label}`, onClick: () => set(v + 1) }, "+"), note);
  };
  const haveNote = (items) => (items.length ? ui.h("p", { class: "su-have" }, "Already in your plan: ", ...items.flatMap((x, i) => [i ? (i === items.length - 1 ? " and " : ", ") : "", ui.h("b", {}, x)]), ". Nothing is added twice.") : null);
  const accLine = (a) => `${a.name} ${money(Math.abs(Number(a.balance) || 0))}`;
  const group = (title, ...body) => ui.h("div", { class: "su-group" }, title ? ui.h("div", { class: "su-gh" }, title) : null, ...body);
  const firstGroup = () => { const g = card.querySelector(".su-group"); if (g) g.classList.add("first"); };
  const who = (p) => (ad.length > 1 ? p.name : null);
  const needYou = (emoji, q) => { head(emoji, q, "First, who the plan is for."); add(card, ui.h("div", { class: "su-end" }, ui.h("button", { type: "button", onClick: () => go("you") }, "Go to question 1"))); };
  const rowLink = (href, icon, title, sub) => ui.h("li", {}, ui.h("a", { class: "row-link", href },
    icon ? ui.h("span", { class: "ic", "aria-hidden": "true" }, icon) : null,
    ui.h("span", { class: "body" }, ui.h("span", { class: "t" }, title), sub ? ui.h("span", { class: "d" }, sub) : null),
    ui.h("span", { class: "chev", "aria-hidden": "true" }, "›")));

  /** The money answer in words (reflect): today's pay; pay that starts later, from its first day; or pay that has ended. */
  const moneyWords = (r) => (!r ? null : r.ended ? "Nothing comes in now: the pay on Income has ended"
    : r.from ? `About ${money(r.monthly)} a month before tax from ${dayWords(r.from)}` : `About ${money(r.monthly)} a month before tax`);
  /** One line per question for "Change an answer": what the plan holds now. */
  const answerOf = (id) => {
    const none = "Not answered yet";
    if (id === "you") { const kids = dependents(plan).length, st = STATES.find((s) => s.value === plan.household?.state)?.label; const names = ad.map((p) => (p.name === "Me" ? "You" : p.name)); return [names.length ? and(names) : null, kids ? `${kids} ${kids === 1 ? "child" : "children"}` : null, st].filter(Boolean).join(", ") || none; }
    if (id === "money") { const r = reflect(plan, "money", { today }); return moneyWords(r) ?? none; }
    if (id === "ages") { const a = ad.filter((p) => p.birthDate).map((p) => `${ad.length > 1 ? `${p.name} ` : ""}${ageOn(p.birthDate, today)}`); return a.length ? `${and(a)}${ad.length > 1 ? "" : " years old"}` : none; }
    if (id === "have") { const r = reflect(plan, "have-amounts"); const ks = picks(plan, "have"); return r ? `${money(r.total)} saved and invested` : ks.length ? and(ks.map((k) => HAVE.find((h) => h.key === k)?.label ?? k)) : none; }
    if (id === "owe") { if (picks(plan, "owe").includes("none")) return "Debt free"; const r = reflect(plan, "owe-amounts"); return r?.kind === "owe" ? `${money(r.total)} owed` : r?.kind === "paid-in-full" ? "Cards paid in full each month" : none; }
    if (id === "spend") { const r = reflect(plan, "spend"); return r ? `About ${money(r.monthly)} a month` : none; }
    if (id === "goals") { const ks = picks(plan, "goals"); return ks.length ? and(ks.map((k) => GOALS.find((g) => g.key === k)?.label ?? k)) : none; }
    return none;
  };

  const UI = {
    welcome() {
      if (prog.finished) {
        head("🌱", "Your plan is set up", "Tap a question to change its answer. You come straight back to where you stand.");
        const Q = [["you", "👋", "Who the plan is for"], ["money", "💵", "What comes in"], ["ages", "🎂", "Ages and Social Security"], ["have", "🏦", "What you have"], ["owe", "🧾", "What you owe"], ["spend", "🛒", "What you spend"], ["goals", "🎯", "What you're working toward"]];
        add(card, ui.h("ul", { class: "page-list", "aria-label": "Your answers" }, Q.map(([id, icon, title]) => rowLink(setupHref(id), icon, title, answerOf(id)))));
        add(card, ui.h("div", { class: "su-end" }, ui.h("button", { type: "button", onClick: () => go("done") }, "See where I stand"), ui.h("button", { type: "button", class: "secondary", onClick: () => go("you") }, "Go through every question again")));
        return;
      }
      head("🌱", firstName ? `Let's build your plan, ${firstName}` : "Let's build your plan", "A few easy questions, one at a time. At the end you'll see your money on one page.");
      add(card, ui.h("ul", { class: "su-list" }, [["🗂️", "See what you own and owe", "Every account and debt in one place"], ["📅", "Know what's left each month", "After tax, bills and saving"], ["✅", "Get your first three moves", "In the order that helps most"]]
        .map(([i, b, m]) => ui.h("li", {}, ui.h("span", { class: "su-li", "aria-hidden": "true" }, i), ui.h("div", {}, ui.h("b", {}, b), ui.h("span", { class: "m" }, m))))));
      add(card, ui.h("ul", { class: "su-ticks" }, ui.h("li", {}, "About 5 minutes"), ui.h("li", {}, "Rough numbers are fine"), ui.h("li", {}, "Stop any time, pick up later")));
      if (ctx.view.build && store.backend() !== "server" && !store.sandbox()) add(card, ui.h("div", { class: "notice info" }, "This device is not connected to your PC, so what you save stays on this device only. To keep one plan on your phone and your PC, ", ui.h("a", { href: "#/system/settings" }, "connect them in Settings"), "."));
      const resume = prog.started && prog.at && prog.at !== "welcome" && prog.at !== "done";
      const btns = ui.h("div", { class: "su-end" });
      if (resume) add(btns, ui.h("button", { type: "button", onClick: () => go(prog.at) }, `Pick up at question ${SCREENS.find((s) => s.id === prog.at)?.q ?? 1} of ${QUESTIONS}`), ui.h("button", { type: "button", class: "secondary", onClick: () => go("you") }, "Start from the first question"));
      else add(btns, ui.h("button", { type: "button", onClick: () => { if (wouldChange(plan, (d) => markAt(d, "you", today))) store.update((d) => markAt(d, "you", today)); go("you"); } }, "Let's go"));
      add(card, btns, ui.h("a", { class: "su-skip", href: "#/overview/guide/whole-plan" }, "I'd rather fill in the full pages myself"));
    },

    you() {
      const v = draft(() => valuesFor(plan, "you"));
      const stateSel = ui.h("select", { class: "su-in", onChange: (e) => { v.state = e.target.value; } }, ui.h("option", { value: "" }, "Choose…"), STATES.map((s) => ui.h("option", { value: s.value, selected: s.value === v.state }, s.label)));
      if (v.own.length) {
        head("👋", "Who is this plan for?", null);
        add(card, haveNote(v.own), field("Which state do you live in?", stateSel, "For state income tax."), ui.h("a", { class: "su-skip", href: "#/household/people" }, "Change the people on People"));
        current = { apply: (d) => applyYou(d, v) };
        actions("Continue", { noSkip: true });
        return;
      }
      head("👋", "Who is this plan for?", "First names only. No surnames, bank logins or account numbers.");
      const nameIn = ui.h("input", { class: "su-in", autocomplete: "given-name", enterkeyhint: "next", value: v.name, placeholder: "Your first name", onInput: (e) => { v.name = e.target.value; } });
      add(card, field("Your first name", nameIn, "So the plan can talk to you. You can leave it blank."));
      const partnerWrap = ui.h("div", {});
      const drawPartner = () => swap(partnerWrap, v.who === "me" ? "" : field(v.who === "spouse" ? "Your spouse's first name" : "Your partner's first name", ui.h("input", { class: "su-in", enterkeyhint: "next", value: v.partnerName, placeholder: "First name", onInput: (e) => { v.partnerName = e.target.value; } })));
      const opts = [{ key: "me", icon: "🙋", label: "Just me", line: "Not married" }, { key: "spouse", icon: "💍", label: "Me and my spouse", line: "Married" }, { key: "partner", icon: "🤝", label: "Me and my partner", line: "Not married" }];
      const tilesEl = tileGroup("Who is this plan for?", opts, { cls: " three", radio: true, isOn: (o) => v.who === o.key, onPick: (o) => { v.who = o.key; drawPartner(); } });
      drawPartner();
      add(card, fieldset(null, tilesEl), partnerWrap,
        fieldset("Children who live with you", stepper(v.kids, 0, 9, (n) => { v.kids = n; }, "Children who live with you", (n) => (n === 0 ? "None" : "")), "Children who live with you more than half the year. Their ages come later."),
        field("Which state do you live in?", stateSel, "For state income tax."));
      current = { apply: (d) => applyYou(d, v) };
      actions();
    },

    money() {
      if (!ad.length) return needYou("💵", "What comes in?");
      head("💵", ad.length > 1 ? "What comes in for each of you?" : "What comes in?", "Before tax: pay from a job, or what your own work brings in. Pick how often it comes.");
      const v = draft(() => valuesFor(plan, "money", { today }));
      // someone paid by their own business: what they already sent the IRS this year, so no page starts from "$0 paid"
      const taxHost = ui.h("div");
      const drawTax = () => swap(taxHost, ad.some((q) => v.people[q.id]?.status === "work" && v.people[q.id]?.by === "self" && !existingPay(plan, q.id).filter((i) => i.id !== `setup-pay-${q.id}`).length)
        ? group("Tax on your own work", field("Estimated tax paid so far this year", moneyIn(v.taxPaid, (val) => { v.taxPaid = val; }, { label: "Estimated tax paid so far this year" }), "The quarterly payments sent to the IRS for this year. Type 0 if none; leave it blank if you are not sure."))
        : "");
      for (const p of ad) {
        const x = v.people[p.id];
        const own = existingPay(plan, p.id);
        const mine = p === self || ad.length === 1;
        const STATUS = [{ key: "work", icon: "💼", label: mine ? "I work" : "Works" }, { key: "retired", icon: "🌴", label: mine ? "I'm retired" : "Retired" }, { key: "none", icon: "⏸️", label: "Not working now" }];
        const body = ui.h("div", {});
        // "Retirement plan at work?" under pay from an employer (round 8): one tap, or none; Yes adds a $0 401(k) so the next
        // moves ask about the match, No says there is nothing to get, Not sure saves nothing
        const planQ = () => { const el = fieldset("Retirement plan at work?", seg(WORK_PLAN, x.plan ?? null, (val) => { x.plan = val; }, named(p, "retirement plan at work") ?? "Retirement plan at work?"), "Like a 401(k) or 403(b). Many employers add money when you save in one."); el.classList.add("su-gap"); return el; };
        const drawBody = () => {
          if (x.status === "work" && own.length) { swap(body, haveNote(own.map((i) => `${i.name} ${money(i.amount)} ${PAY_PERIODS.find((o) => o.value === i.period)?.label.toLowerCase() ?? ""}`.trim())), own.some((i) => i.type === "salary") ? planQ() : null); return; }
          if (x.status === "work") {
            const live = ui.h("p", { class: "su-live", "aria-live": "polite" });
            const showMo = () => { const n = parseMoney(x.amount); live.textContent = n > 0 ? (x.period === "annual" ? `That's about ${money(perYear(n, x.period) / 12)} a month.` : `That's about ${money(perYear(n, x.period))} a year.`) : ""; };
            // who pays: an employer (a paycheck with tax held back) or their own business or freelance work (no paycheck:
            // the plan then works out self-employment tax and quarterly payments instead of a W-4)
            const by = x.by === "self" ? "self" : "employer";
            const amountField = by === "self"
              ? field("What your work brings in, before tax", moneyIn(x.amount, (val) => { x.amount = val; showMo(); }, { label: named(p, "what the work brings in") }), "If it changes month to month, give a typical year. Business costs come later, on Small business.")
              : field("Pay before tax", moneyIn(x.amount, (val) => { x.amount = val; showMo(); }, { label: named(p, "pay before tax") }));
            swap(body, fieldset("Who pays you", seg(WHO_PAYS, by, (val) => { x.by = val; drawBody(); drawTax(); }, named(p, "who pays") ?? "Who pays you")),
              amountField,
              fieldset("How often", seg(PAY_PERIODS, x.period, (val) => { x.period = val; showMo(); }, named(p, "how often") ?? "How often")), live,
              by === "employer" ? planQ() : null);
            showMo();
            return;
          }
          swap(body, x.status === "retired" ? field("A pension a month, if any", moneyIn(x.pension, (val) => { x.pension = val; }, { label: named(p, "pension a month") }), "Social Security comes on the next question. Leave this blank if there is no pension.")
            : x.status === "none" ? ui.h("p", { class: "su-sub" }, "Nothing counted for now. You can add pay any time on Income.") : "");
        };
        const tilesEl = tileGroup(named(p, "work") ?? "Work", STATUS, { cls: " three", radio: true, isOn: (o) => x.status === o.key, onPick: (o) => { x.status = o.key; drawBody(); drawTax(); } });
        drawBody();
        add(card, group(who(p), tilesEl, body));
      }
      drawTax(); add(card, taxHost);
      const o = v.other;
      add(card, group("Any other money coming in each month?",
        field("A month", moneyIn(o.amount, (val) => { o.amount = val; }, { label: "Other money a month" }), "Leave it blank if there is none."),
        fieldset("What kind", seg(OTHER_KINDS, o.kind, (val) => { o.kind = val; }, "Other money: what kind"))));
      firstGroup();
      // a yearly figure under $15,000 for a job is most often a month's pay with "A year" left on: ask once
      const check = () => {
        for (const p of ad) {
          const x = v.people[p.id];
          if (x.status !== "work" || existingPay(plan, p.id).length) continue;
          const n = parseMoney(x.amount);
          if (n > 0 && perYear(n, x.period) < 15000) return `${money(n)} ${PAY_PERIODS.find((k) => k.value === x.period)?.label.toLowerCase() ?? ""} is low for a job${ad.length > 1 ? ` (${p.name})` : ""}. If that's what comes in each month, tap "A month" under How often. Tap Continue again to keep it.`;
        }
        return null;
      };
      // a plan at work this Continue added, with its $0 401(k): said back once (round 8; review UX 9)
      const planWords = (p2) => { const w = workPlanAdded(p2, ad.filter((q) => v.people[q.id]?.plan === "yes" && !workPlanAcct(plan, q.id)).map((q) => q.id)); return w ? ` ${w}` : ""; };
      current = { apply: (d) => applyMoney(d, { ...v, today }), check, words: (p2) => { const w = moneyWords(reflect(p2, "money", { today })); return w ? `Got it: ${w.charAt(0).toLowerCase()}${w.slice(1)}.${planWords(p2)}` : null; } };
      actions();
    },

    ages() {
      if (!ad.length) return needYou("🎂", "Your ages");
      if (allRetired(plan)) head("🎂", ad.length > 1 ? "Your ages, and Social Security" : "Your age, and Social Security", "This decides how long the money has to last and what Social Security adds.");
      else head("🎂", ad.length > 1 ? "Your ages, and when you'd like to stop working" : "Your age, and when you'd like to stop working", "This decides when retirement money and Social Security start.");
      const v = draft(() => valuesFor(plan, "ages", { today }));
      const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
      const ageOf = (x) => { const y = Number(x.year); if (!(y >= 1900 && y <= year)) return null; const m = Number(x.month) || 7; return year - y - (month < m ? 1 : 0); };
      const SS = { estimate: "Estimate it for me", statement: "I have my statement figure", getting: "I already get it", none: "I won't get any" };
      for (const p of ad) {
        const x = v.people[p.id];
        const retiredNow = plan.guide?.setup?.status?.[p.id] === "retired";
        const modeSaved = !!plan.guide?.setup?.ss?.[p.id];
        if (retiredNow) x.retired = true;
        if (retiredNow && x.ss.mode === "estimate") x.ss.mode = "getting";
        const liveAge = ui.h("p", { class: "su-live", "aria-live": "polite" });
        const stopBox = ui.h("div", {}), ssPick = ui.h("div", {}), ssBody = ui.h("div", {});
        let pickKey = null;
        const showAge = () => { const a = ageOf(x); liveAge.textContent = a === null ? "" : `${a} years old`; };
        const monthSel = ui.h("select", { class: "su-in", "aria-label": named(p, "birth month") ?? "Birth month", onChange: (e) => { x.month = e.target.value; showAge(); drawStop(); drawSS(); } }, ui.h("option", { value: "" }, "Month"), MONTHS.map((m, i) => ui.h("option", { value: String(i + 1), selected: Number(x.month) === i + 1 }, m)));
        const yearIn = ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", maxlength: "4", value: x.year ? String(x.year) : "", placeholder: "Year", "aria-label": named(p, "birth year") ?? "Birth year", onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); x.year = e.target.value; showAge(); if (e.target.value.length === 4) { drawStop(); drawSS(); } } });
        const tog = retiredNow ? null : toggle("Already retired", x.retired, (on) => { x.retired = on; drawStop(); drawSS(); });
        function drawStop() {
          const a = ageOf(x);
          if (x.retired) { swap(stopBox, ui.h("p", { class: "su-sub" }, "Already retired.")); return; }
          swap(stopBox, stepper(x.stopAge, Math.max(40, (a ?? 39) + 1), 85, (n) => { x.stopAge = n; drawSS(); }, named(p, "age to stop working") ?? "Age to stop working", (n) => (a === null ? `at ${n}` : `in ${n - a} year${n - a === 1 ? "" : "s"} (${year + n - a})`)));
        }
        function drawSS() {
          const s = x.ss;
          if (s.record) { swap(ssPick); swap(ssBody, ui.h("p", { class: "su-sub" }, "Your ssa.gov record is in the plan: the Social Security page works from it.")); return; }
          const a = ageOf(x), by = Number(x.year);
          const young = x.retired && a !== null && a < 62;
          // before 62 nobody gets retirement benefits yet: the statement figure first; "getting it" is disability or survivor pay
          if (young && !modeSaved && !s.touched && s.mode === "getting") s.mode = "statement";
          const opts = x.retired
            ? (young ? [{ value: "statement", label: "Not yet: I have my statement figure" }, { value: "getting", label: "I get it now" }, { value: "none", label: SS.none }] : ["getting", "statement", "none"].map((k) => ({ value: k, label: SS[k] })))
            : ["estimate", "statement", "getting", "none"].map((k) => ({ value: k, label: SS[k] }));
          const key = opts.map((o) => o.label).join("|");
          if (key !== pickKey) { pickKey = key; swap(ssPick, seg(opts, s.mode, (m) => { s.mode = m; s.touched = true; drawSS(); }, named(p, "Social Security") ?? "Social Security")); }
          let detail = null;
          if (s.mode === "estimate") {
            const pay = yearlyPay(plan, p.id);
            const est = by >= 1900 ? estimateSocialSecurity({ birthYear: by, yearlyPay: pay, stopAge: x.retired ? a ?? 65 : x.stopAge, today }) : null;
            const fra = by >= 1900 ? fullRetirementAge(by) : null;
            detail = ui.h("p", { class: "su-live", "aria-live": "polite" }, est === null ? (by >= 1900 ? "Needs your pay (question 2) to estimate." : "Type the birth year above to see it.") : ["About ", ui.h("b", {}, `${money(est)} a month`), ` from age ${fra.years}${fra.months ? ` and ${fra.months} months` : ""}, in today's money. A rough guide; your statement at ssa.gov is exact.`]);
          } else if (s.mode === "statement") detail = field("Your monthly benefit at full retirement age", moneyIn(s.amount, (val) => { s.amount = val; }, { label: named(p, "Social Security at full retirement age") }), "On your statement at ssa.gov/myaccount.");
          else if (s.mode === "getting") {
            // before Medicare comes out (round 8): the letter's figure, with the Part B premium to add back to a deposit
            const amount = field("What you get a month", moneyIn(s.amount, (val) => { s.amount = val; }, { label: named(p, "Social Security a month") }), a === null ? null : ssGettingHelp(a));
            if (young) detail = amount;
            else {
              const fra = by >= 1900 ? fullRetirementAge(by).asYears : 67;
              const top = a === null ? 70 : Math.max(62, Math.min(70, a));
              if (!s.startedKnown && !s.startedTouched) s.started = a === null ? Math.round(fra) : a >= fra ? Math.round(fra) : top;
              detail = ui.h("div", {}, amount, fieldset("It started at age", stepper(s.started, 62, top, (n) => { s.started = n; }, named(p, "age Social Security started") ?? "Age Social Security started"), "The age of your first payment."));
              detail.querySelectorAll(".su-step button").forEach((b) => b.addEventListener("click", () => { s.startedTouched = true; }));
            }
          } else if (s.mode === "none") detail = ui.h("p", { class: "su-sub" }, "No Social Security counted. Some public jobs pay into a pension instead.");
          swap(ssBody, detail ?? "");
        }
        showAge(); drawStop(); drawSS();
        add(card, group(who(p) ?? "You",
          ui.h("div", { class: "su-field" }, ui.h("span", { class: "su-label" }, "Born"), ui.h("div", { class: "su-born" }, monthSel, yearIn), liveAge),
          fieldset(retiredNow ? "Work" : "Stop working at", ui.h("div", {}, stopBox, tog)),
          fieldset("Social Security", ssPick), ssBody));
      }
      const kids = dependents(plan);
      if (kids.length) add(card, group("Children's birth years", ui.h("div", { class: "su-born" }, ...kids.map((k) => field(k.name, ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", maxlength: "4", value: v.kids[k.id] ? String(v.kids[k.id]) : "", placeholder: "Year", onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); v.kids[k.id] = e.target.value; } }))))));
      firstGroup();
      current = { apply: (d) => applyAges(d, v, today) };
      actions();
    },

    have() {
      head("🏦", "What do you have?", "Tap all that apply. Amounts come next.");
      const v = draft(() => new Set(valuesFor(plan, "have")));
      // the $0 401(k) question 2's "Yes" made: said once, so nobody ticks Retirement only to record it (round 8)
      const workSaid = workPlanLine(plan);
      const workLine = workSaid ? ui.h("p", { class: "su-have" }, workSaid) : null;
      add(card, tileGroup("What do you have?", HAVE, { isOn: (o) => v.has(o.key), onPick: (o) => { if (v.has(o.key)) v.delete(o.key); else v.add(o.key); }, isHave: (o) => askOwners(plan, o.key).length === 0 }),
        workLine, haveNote(HAVE.flatMap((h) => existingHave(plan, h.key)).map(accLine)));
      current = { apply: (d) => applyHavePicks(d, [...v]) };
      actions();
    },

    "have-amounts"() {
      head("🧮", "About how much is in each?", "Today's balance or value. Round numbers are fine; you can make them exact later.");
      // a balance that is one of our guesses (question 5 guessed the home): its box is empty with our figure in grey, and
      // an empty box keeps it (applyHaveAmounts), so the screen never shows a guess as typed text (spec P2)
      const greyOf = (id) => {
        const path = `accounts[${id}].balance`, a = (plan.accounts ?? []).find((x) => x.id === id);
        if (!a || !isGuess(plan, path)) return null;
        let why = null; try { why = ctx.guess(plan.guesses?.[path]?.k, { path })?.why ?? null; } catch { why = null; }
        return { shown: groupDigits(String(Math.round(Number(a.balance) || 0))), line: why ? `Our guess: ${why}.` : "Our guess for now." };
      };
      const v = draft(() => valuesFor(plan, "have-amounts"));
      for (const h of HAVE.filter((x) => picks(plan, "have").includes(x.key))) {
        for (const pid of askOwners(plan, h.key)) {
          if (!h.perAdult) {
            const label = h.key === "home" ? "Your home" : h.key === "car" ? "Your car" : h.label;
            const g = greyOf(haveId(h.key));
            add(card, group(null, field(`${h.icon} ${label}`, moneyIn(v[h.key], (val) => { v[h.key] = val; }, { label: g ? `${label}, blank uses our guess of about ${symbol}${g.shown}` : label, placeholder: g?.shown ?? "" }), g ? [g.line, h.ask ? `${h.ask}${/[.!?]$/.test(h.ask) ? "" : "."}` : null].filter(Boolean).join(" ") : h.ask ?? null)));
            continue;
          }
          const p = ad.find((x) => x.id === pid);
          const extra = ui.h("div", {});
          // paid by their own business: no employer, so no pay stub (review 2026-11-02)
          const ownBiz = payLineNow(plan.income ?? [], pid, today)?.type === "business";
          // which kind of IRA, right under "Where" (round 8): one tap, or none (then as before: an IRA, or the Roth set on Net worth)
          const iraBox = ui.h("div", {});
          const drawIra = () => swap(iraBox, v[`kind-${pid}`] === "own" ? fieldset("Which kind of IRA?", seg(IRA_KINDS, v[`iraKind-${pid}`] ?? null, (val) => { v[`iraKind-${pid}`] = val; }, named(p, "which kind of IRA") ?? "Which kind of IRA?"), iraKindHelp(ownBiz)) : "");
          drawIra();
          const drawExtra = () => swap(extra,
            field("You put in a month", moneyIn(v[`contrib-${pid}`], (val) => { v[`contrib-${pid}`] = val; }, { label: named(p, "put in a month") }), "From pay, if you save. Leave it blank if not."),
            v[`kind-${pid}`] === "work" ? field(ownBiz ? "Your business adds a month" : "Your employer adds a month", moneyIn(v[`match-${pid}`], (val) => { v[`match-${pid}`] = val; }, { label: named(p, ownBiz ? "business adds a month" : "employer adds a month") }), ownBiz ? "What the business puts in on top, in a solo 401(k). Leave it blank if none." : "The match, if there is one. It's on your pay stub.") : null);
          drawExtra();
          add(card, group(`${h.icon} ${ad.length > 1 ? `${possessive(p)} retirement savings` : "Retirement savings"}`,
            fieldset("Where", seg(RETIRE_KINDS, v[`kind-${pid}`], (val) => { v[`kind-${pid}`] = val; drawIra(); drawExtra(); }, named(p, "retirement through work or on your own") ?? "Retirement through work or on your own"), ownBiz ? "Your own business: an IRA, a SEP-IRA or a solo 401(k) all count as on your own; a solo 401(k) that your business adds to can go under Through work." : "Through work: a 401(k) or 403(b). On your own: an IRA."),
            iraBox,
            (() => { const g = greyOf(haveId(h.key, pid)); return field("Saved so far", moneyIn(v[`${h.key}-${pid}`], (val) => { v[`${h.key}-${pid}`] = val; }, { label: named(p, "retirement saved so far"), placeholder: g?.shown ?? "" }), g ? `${g.line} Add up every account of that kind.` : "Add up every account of that kind."); })(),
            extra));
        }
      }
      firstGroup();
      current = { apply: (d) => applyHaveAmounts(d, v, today), words: (p2) => { const r = reflect(p2, "have-amounts"); return r ? `Got it: ${money(r.total)} saved and invested in all.` : null; } };
      actions();
    },

    owe() {
      head("🧾", "Do you owe money on anything?", "Tap all that apply. Most people do; it helps the plan put things in the right order.");
      const v = draft(() => new Set(valuesFor(plan, "owe")));
      const opts = [...OWE, { key: "none", icon: "🎉", label: "No, I'm debt free", wide: true }];
      add(card, tileGroup("Do you owe money on anything?", opts, {
        isOn: (o) => v.has(o.key),
        isHave: (o) => o.key !== "none" && oweTaken(plan, o.key),
        onPick: (o) => {
          if (o.key === "none") { const on = !v.has("none"), had = v.size > 0 && !v.has("none"); v.clear(); if (on) v.add("none"); if (on && had) ctx.announce?.("Other picks cleared"); return; }
          v.delete("none"); if (v.has(o.key)) v.delete(o.key); else v.add(o.key);
        },
      }), haveNote(OWE.flatMap((o) => existingOwe(plan, o.key)).filter((a, i, all) => all.indexOf(a) === i).map(accLine)));
      current = { apply: (d) => applyOwePicks(d, [...v]), words: (p2) => (reflect(p2, "owe")?.kind === "debt-free" ? "Debt free: that makes everything easier." : null) };
      actions();
    },

    "owe-amounts"() {
      // our guesses fill what is left blank (U.S. plans: core/estimate applies); elsewhere the boxes work as they did
      const guessing = applies(plan);
      head("✍️", "Tell us about each one", guessing ? "Start with what you pay a month. Leave the rest empty and we'll work it out." : "What you pay a month and what you owe today. The rate is on the statement; leave a box blank if you don't know it.");
      const v = draft(() => valuesFor(plan, "owe-amounts"));
      const askHome = askHomeWithMortgage(plan);
      const picked = OWE.filter((x) => picks(plan, "owe").includes(x.key) && !oweTaken(plan, x.key));
      // one question that sharpens a guess the most, at most, on the screen: when the mortgage was taken out, else the car loan
      const tapOn = picked.some((o) => o.key === "mortgage") ? "mortgage" : picked.some((o) => o.key === "car-loan") ? "car-loan" : null;
      const shownMoney = (n) => groupDigits(String(Math.round(n)));
      const shownPct = (r) => String(Math.round(r * 1000) / 10);
      // the home on file (from question 4, or Net worth): said as a line, not asked twice
      const homeAcct = askHome ? null : (plan.accounts ?? []).find((a) => a.id === "setup-have-home") ?? existingHave(plan, "home")[0] ?? null;
      for (const o of picked) {
        const x = v[o.key];
        const body = ui.h("div", {});
        const helpOf = {
          payment: `${o.key === "mortgage" ? "It's on your bank statement. Include tax and insurance if they're in it." : o.key === "credit" ? "The minimum, or what you usually pay." : "It's on your bank statement."}${guessing ? "" : " Blank: a typical payment for now."}`,
          owed: o.key === "credit" ? "All your cards together." : null,
          rate: guessing ? "It's on your statement." : `Blank: a typical ${pctOf(TYPICAL_RATES[o.key])} for now${o.key === "mortgage" ? " (today's rate; an older loan may cost less)" : ""}.`,
          home: "So what you own counts beside what you owe.",
        };
        const labels = { payment: `${o.label}: paid a month`, owed: `${o.label}: still owed`, rate: `${o.label}: interest rate a year`, home: "What your home would sell for today" };
        const keyOf = { payment: `debt.${o.key}.payment`, owed: `debt.${o.key}.owed`, rate: `debt.${o.key}.rate`, home: "home.value" };
        const pathOf = { payment: `debts[setup-debt-${o.key}].minPayment`, owed: `accounts[setup-owe-${o.key}].balance`, rate: `debts[setup-debt-${o.key}].rate`, home: "accounts[setup-have-home].balance" };
        const boxes = {};
        const box = (k, control) => { const input = control.querySelector("input"); boxes[k] = { input }; return control; };
        const sub = (k) => { const el = ui.h("span", { class: "su-sub" }); boxes[k].sub = el; return el; };
        const fieldWith = (label, k, control) => { box(k, control); const el = sub(k); const id = `su-h-${++uid}`; el.id = id; boxes[k].input.setAttribute("aria-describedby", id); return ui.h("div", { class: "su-field" }, ui.h("label", {}, ui.h("span", { class: "su-label" }, label), control), el); };
        // the tap: shown once our guess of what is still owed says it would sharpen it, and kept while it has an answer
        const tapWrap = ui.h("div", { hidden: true });
        let tapBuilt = false;
        const refresh = () => {
          const args = oweArgs(plan, x, o.key, { askHome });
          for (const k of Object.keys(boxes)) {
            const b = boxes[k], blank = args[k] === null;
            const g = guessing && blank ? ctx.guess(keyOf[k], { path: pathOf[k], args }) : null;
            const shown = g && g.value !== null ? (k === "rate" ? shownPct(g.value) : shownMoney(g.value)) : "";
            b.input.placeholder = shown;
            b.input.setAttribute("aria-label", `${labels[k]}${shown ? `, blank uses our guess of about ${k === "rate" ? `${shown}%` : `${symbol}${shown}`}` : ""}`);
            // the guess, then the field's own help (spec 9.3): where to find it stays on screen while our figure shows
            b.sub.textContent = shown ? [`Our guess: ${g.why}.`, helpOf[k]].filter(Boolean).join(" ") : helpOf[k] ?? "";
          }
          if (tapOn === o.key) {
            const g = guessing ? ctx.guess(keyOf.owed, { path: pathOf.owed, args }) : null;
            const want = !!((g?.ask && args.owed === null) || args.start);
            if (want && !tapBuilt && g?.ask) {
              const q = g.ask;
              swap(tapWrap, fieldset(q.question, seg(q.options, x.start ?? null, (val) => { x.start = val; refresh(); }, q.question), "Tell us and we'll work out what's left from your payment."));
              tapBuilt = true;
            }
            tapWrap.hidden = !(want && tapBuilt);
          }
        };
        const moneyBox = (k, label) => moneyIn(x[k], (val) => { x[k] = val; refresh(); }, { label, placeholder: "" });
        const draw = () => {
          for (const k of Object.keys(boxes)) delete boxes[k];
          tapBuilt = false;
          swap(body, ...(o.key === "credit" && x.paidInFull ? [ui.h("p", { class: "su-sub" }, "Then your cards cost you nothing in interest. Nothing to add.")] : [
            fieldWith("Paid a month", "payment", moneyBox("payment", labels.payment)),
            fieldWith("Still owed", "owed", moneyBox("owed", labels.owed)),
            // the one tap sits under the figure it sharpens
            tapOn === o.key ? tapWrap : null,
            fieldWith("Interest rate a year", "rate", pctIn(x.rate, (val) => { x.rate = val; refresh(); }, labels.rate, "")),
            o.key === "mortgage" && askHome ? fieldWith("🏡 What would your home sell for today?", "home", moneyBox("home", labels.home)) : null,
            // the home on file, after the boxes and the tap (a 44 px button, not a bare link: thumbs)
            o.key === "mortgage" && homeAcct ? ui.h("div", { class: "su-field" },
              ui.h("p", { class: "su-sub" }, `Your home: about ${fmt.money(Math.round(Number(homeAcct.balance) || 0), cur)}, ${homeAcct.id === "setup-have-home" ? "from question 4" : "on Net worth"}.`),
              ui.h("p", { class: "su-sub" }, ui.h("a", { href: homeAcct.id === "setup-have-home" ? setupHref("have-amounts") : "#/balance/net-worth", class: "btn secondary small" }, "Change the home's value"))) : null,
          ]));
          // a tap or a payment moves the grey figure under Still owed: it is announced (screen readers)
          boxes.owed?.sub?.setAttribute("aria-live", "polite");
          refresh();
        };
        draw();
        add(card, group(`${o.icon} ${o.label}`,
          o.key === "credit" ? fieldset("Do you pay the whole bill every month?", seg([{ value: "yes", label: "Yes, every month" }, { value: "no", label: "No, some carries over" }], x.paidInFull ? "yes" : x.owed !== "" || x.payment !== "" ? "no" : null, (val) => { x.paidInFull = val === "yes"; draw(); }, "Do you pay the whole card bill every month?")) : null,
          body));
      }
      firstGroup();
      const words = (p2) => {
        const r = reflect(p2, "owe-amounts");
        if (r?.kind === "paid-in-full") return "Paid in full every month: no card debt to plan for.";
        if (r?.kind !== "owe") return null;
        if (!r.guessed) return `Got it: ${money(r.total)} owed in all.`;
        // the payments typed are the person's: said so when every balance is ours
        const typedPays = (p2.debts ?? []).filter((d) => typeof d.id === "string" && d.id.startsWith("setup-debt-") && Number(d.minPayment) > 0 && !isGuess(p2, `debts[${d.id}].minPayment`)).length;
        const ours = r.guessed === r.of ? `by our guesses.${typedPays ? ` ${typedPays === 1 ? "The payment you typed stays" : "The payments you typed stay"} as you typed ${typedPays === 1 ? "it" : "them"}.` : ""}`
          : `${r.guessed === 1 ? "One balance is" : `${r.guessed} balances are`} our guess for now.`;
        return `Got it: about ${money(about(r.total))} still owed in all${r.guessed === r.of ? `, ${ours}` : `. ${ours}`}`;
      };
      const guessOpt = guessing ? { guess: ctx.guess } : {};
      current = { apply: (d) => applyOweAmounts(d, v, today, guessOpt), words };
      // "Skip: use our guesses": what is on the screen is kept (typed boxes stay typed) and every empty box gets our guess,
      // the same save as Continue; a debt picked is never dropped
      const skipGuessing = () => { current = { apply: (d) => applyOweAmounts(d, v, today, guessOpt), words }; forward(); };
      actions("Continue", guessing ? { skipLabel: "Skip: use our guesses", onSkip: skipGuessing } : {});
    },

    spendPlain() {
      const v = draft(() => valuesFor(plan, "spend"));
      const base = spendBase(plan), rows = spendRows(plan), mortgage = hasMortgage(plan), loansLater = loansAfterWork(plan, today);
      head("🛒", "What do you spend in a typical month?", "Guesses are fine. Leave out what you save.");
      if (base.existingCount) add(card, ui.h("p", { class: "su-have" }, "Already in your plan: ", ui.h("b", {}, `${money(base.existing)} a month`), ` in ${base.existingCount} bill${base.existingCount === 1 ? "" : "s"}. Add only what's missing.`));
      if (base.loanPayments > 0) add(card, ui.h("p", { class: "su-have" }, "Leave out loan and card payments: we already have them (", ui.h("b", {}, `${money(base.loanPayments)} a month`), ") and add them to the total below."));
      const body = ui.h("div", {});
      const totalEl = ui.h("b", {}), partsEl = ui.h("p", { class: "su-parts" });
      const later = v.later ?? (v.later = { typed: v.retireTyped, value: v.retireMonthly });
      let laterInput = null;
      const num = (s) => parseMoney(s) ?? 0;
      const rowsSum = (g) => rows.filter((s) => !g || s.group === g).reduce((t, s) => t + num(v.rows[s.key]), 0);
      const sums = {};
      const upd = () => {
        const own = v.mode === "total" ? num(v.total) : rowsSum();
        totalEl.textContent = money(own + base.existing + base.loanPayments);
        partsEl.textContent = base.loanPayments > 0 || base.existing > 0 ? [`${money(own)} here`, base.existing > 0 ? `${money(base.existing)} already in your plan` : null, base.loanPayments > 0 ? `${money(base.loanPayments)} loan payments` : null].filter(Boolean).join(" + ") : "";
        if (sums.must) sums.must.textContent = money(rowsSum("must") + base.loanPayments);
        if (sums.else) sums.else.textContent = money(rowsSum("else"));
        if (laterInput && !later.typed) {
          const core = base.existingCore + (v.mode === "total" ? num(v.total) : rows.filter((s) => s.key !== "childcare").reduce((t, s) => t + num(v.rows[s.key]), 0)) + loansLater;
          laterInput.value = core > 0 ? groupDigits(String(Math.round(core / 10) * 10)) : "";
          later.value = laterInput.value;
        }
      };
      const row = (s) => {
        const hw = s.key === "housing" ? housingWords(plan) : null, name = hw ? hw.label : s.label, help = hw ? hw.help : s.help;
        const box = moneyIn(v.rows[s.key], (val) => { v.rows[s.key] = val; upd(); });
        const input = box.querySelector("input"), id = `su-i-${++uid}`;
        input.id = id;
        return ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("label", { class: "su-label", for: id }, name), describe(input, help)), box);
      };
      const mode = tileGroup("How to answer", [{ key: "rows", icon: "📋", label: "A few groups", line: "Rent, food, car..." }, { key: "total", icon: "✏️", label: "One rough total", line: "If you're not sure" }],
        { radio: true, isOn: (o) => (o.key === "total") === (v.mode === "total"), onPick: (o) => { v.mode = o.key; drawBody(); } });
      const drawBody = () => {
        if (v.mode === "total") swap(body, field(base.existingCount ? "Everything else, in a month" : "All your spending in a month", moneyIn(v.total, (val) => { v.total = val; upd(); }), "Home, food, car, fun: everything. It counts as must-pay, to be safe."));
        else {
          sums.must = ui.h("span", { class: "sum" }); sums.else = ui.h("span", { class: "sum" });
          const must = rows.filter((s) => s.group === "must"), other = rows.filter((s) => s.group === "else");
          const loanRow = base.loanPayments > 0 ? ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("span", { class: "su-label" }, "Loan and card payments"), ui.h("span", { class: "su-sub" }, "From question 5, already counted")), ui.h("span", { class: "su-fixed" }, money(base.loanPayments))) : null;
          swap(body,
            must.length || loanRow ? ui.h("div", { class: "su-group first" }, ui.h("div", { class: "su-gh" }, "Must-pay bills", sums.must), ...must.map(row), loanRow) : null,
            other.length ? ui.h("div", { class: "su-group" }, ui.h("div", { class: "su-gh" }, "Everything else", sums.else), ...other.map(row)) : null,
            rows.length ? null : ui.h("p", { class: "su-sub" }, "Every kind of bill is already in your plan."));
        }
        upd();
      };
      add(card, mode, body, ui.h("div", { class: "su-total" }, ui.h("span", {}, "In all, about a month"), totalEl), partsEl);
      if (!allRetired(plan)) {
        const box = moneyIn(later.value, (val) => { later.value = val; later.typed = true; });
        laterInput = box.querySelector("input");
        add(card, group(null, field("Once you stop working, about how much a month?", box, loansLater > 0
          ? `We start from today's spending without childcare, and keep the ${money(loansLater)} of loan payments still running then. Change it if you expect to spend more or less.`
          : "We start from today's spending without loan payments and childcare. Change it if you expect to spend more or less.")));
      }
      drawBody();
      current = { apply: (d) => applySpend(d, { ...v, retireMonthly: later.value, retireAuto: !later.typed }), words: (p2) => { const r = reflect(p2, "spend"); return r ? `Got it: about ${money(r.monthly)} a month, ${money(r.essential)} of it bills you must pay.` : null; } };
      actions();
    },

    // Q6 with our guesses (U.S. plans): each box shows its grey figure (core/estimate, spec 7.A), the group sums and the
    // total add them up with their parts, and a box left blank saves that figure as one of our guesses
    spend() {
      if (!applies(plan)) { UI.spendPlain(); return; }
      const v = draft(() => valuesFor(plan, "spend"));
      v.taps = v.taps ?? {};
      const base = spendBase(plan), rows = spendRows(plan), mortgage = hasMortgage(plan), loansLater = loansAfterWork(plan, today);
      head("🛒", "What do you spend in a typical month?", "Round numbers are fine. Leave a box empty and we'll use the grey figure: what's typical for someone like you.");
      if (base.existingCount) add(card, ui.h("p", { class: "su-have" }, "Already in your plan: ", ui.h("b", {}, `${money(base.existing)} a month`), ` in ${base.existingCount} bill${base.existingCount === 1 ? "" : "s"}. Add only what's missing.`));
      if (base.loanPayments > 0) add(card, ui.h("p", { class: "su-have" }, "Leave out loan and card payments: we already have them (", ui.h("b", {}, `${money(base.loanPayments)} a month`), ") and add them to the total below."));
      const basis = ui.h("p", { class: "su-sub su-basis" });
      const first = ui.h("p", { class: "su-sub su-first", hidden: true }, "Type your rent first: it's the biggest one.");
      const renting = housingWords(plan).kind === "rent";
      const body = ui.h("div", {});
      const totalEl = ui.h("b", {}), partsEl = ui.h("p", { class: "su-parts", "aria-live": "polite" });
      // R10 (spec 2.2): a box typed moves the other grey figures so the month stays near what households like this spend in
      // all; when it does, one line says so (C3 UX review 2: the figures moved and nothing said why)
      // (su-adjust: .su-sub's display would otherwise override [hidden], and the line showed before anything was typed; C3 verify)
      const adjustEl = ui.h("p", { class: "su-sub su-adjust", hidden: true },"As you type, our other figures adjust, so the month stays near what households like yours usually spend in all.");
      let blankBase = null, blankKey = null;
      const baseGrey = (args) => {
        const key = JSON.stringify(args.taps ?? {});
        if (blankBase && blankKey === key) return blankBase;
        const all = { ...args, mode: "rows", total: null, rows: Object.fromEntries(rows.map((s) => [s.key, null])) };
        blankBase = Object.fromEntries(rows.map((s) => { const g = ctx.guess(`spend.${s.key}`, { path: `expenses[setup-x-${s.key}].amount`, args: all }); return [s.key, g && typeof g.value === "number" ? g.value : 0]; }));
        blankKey = key;
        return blankBase;
      };
      const later = v.later ?? (v.later = { typed: v.retireTyped, value: v.retireMonthly });
      const num = (x) => parseMoney(x) ?? 0;
      const sums = {};
      const boxes = {};      // row key -> { input, tap, tapBuilt }
      let grey = {};         // row key -> the grey figure shown (a blank box), 0 when there is none
      let totalInput = null, laterInput = null, laterSub = null, laterLine = null;
      // under 50 (or no birth dates) the retirement figure is one line, written as our guess; from 50, or once typed, a box
      const ages = ad.map((p) => (p.birthDate ? ageOn(p.birthDate, today) : null)).filter((a) => a !== null);
      const laterBox = !allRetired(plan) && (later.typed || (ages.length && Math.max(...ages) >= 50));
      const rowArgs = () => spendArgs(plan, v);
      const refresh = () => {
        const args = rowArgs();
        grey = {};
        for (const s of rows) {
          const b = boxes[s.key];
          const blank = v.mode === "total" ? args.total === null : args.rows[s.key] === null;
          const g = blank ? ctx.guess(`spend.${s.key}`, { path: `expenses[setup-x-${s.key}].amount`, args }) : null;
          grey[s.key] = g && typeof g.value === "number" ? g.value : 0;
          if (b?.input) {
            const shown = grey[s.key] > 0 ? groupDigits(String(Math.round(grey[s.key]))) : "";
            b.input.placeholder = shown;
            b.input.setAttribute("aria-label", `${b.name}${shown ? `, blank uses our guess of about ${symbol}${shown}` : ""}`);
          }
          // a tap the row's guess asks (how health cover is had, childcare, an HOA fee), kept on screen once answered
          if (b?.tap) {
            const q = g?.ask ?? null, said = v.taps[b.tapKey] ?? null;
            // at most two "does this exist" taps on the screen (spec P9): with childcare asked, the HOA fee is not asked
            // (blank takes the likelier side, as Not sure does)
            const room = b.tapKey !== "hoa" || !rows.some((r) => r.key === "childcare") || !!said;
            const want = v.mode !== "total" && blank && (!!q || !!said) && room;
            if (want && !b.tapBuilt && (q || b.ask)) {
              const ask = q ?? b.ask;
              b.ask = ask;
              swap(b.tap, fieldset(ask.question, seg(ask.options, said, (val) => { v.taps[ask.key] = val; refresh(); }, ask.question)));
              b.tapBuilt = true;
            }
            b.tap.hidden = !(want && b.tapBuilt);
            if (said) b.tap.querySelector(".su-care-again")?.remove();
          }
        }
        const typedOf = (s) => (v.mode === "total" ? 0 : num(v.rows[s.key]));
        const rowFig = (s) => typedOf(s) || (args.rows?.[s.key] === 0 ? 0 : grey[s.key] ?? 0);
        const typedSum = v.mode === "total" ? (args.total ?? 0) : rows.reduce((t, s) => t + typedOf(s), 0);
        const ours = v.mode === "total" && args.total !== null ? 0 : rows.reduce((t, s) => t + (typedOf(s) || args.rows?.[s.key] === 0 ? 0 : grey[s.key] ?? 0), 0);
        if (totalInput) { const t = rows.reduce((x, s) => x + (grey[s.key] ?? 0), 0); totalInput.placeholder = t > 0 ? groupDigits(String(Math.round(t))) : ""; totalInput.setAttribute("aria-label", `All your spending in a month${t > 0 ? `, blank uses our guess of about ${symbol}${groupDigits(String(Math.round(t)))}` : ""}`); }
        totalEl.textContent = money(typedSum + ours + base.existing + base.loanPayments);
        partsEl.textContent = ours > 0 || base.loanPayments > 0 || base.existing > 0
          ? [typedSum > 0 ? `${money(typedSum)} you typed` : null, ours > 0 ? `${money(ours)} our guesses` : null, base.existing > 0 ? `${money(base.existing)} already in your plan` : null, base.loanPayments > 0 ? `${money(base.loanPayments)} loan payments` : null].filter(Boolean).join(" + ") : "";
        if (sums.must) sums.must.textContent = money(rows.filter((s) => s.group === "must").reduce((t, s) => t + rowFig(s), 0) + base.loanPayments);
        if (sums.else) sums.else.textContent = money(rows.filter((s) => s.group === "else").reduce((t, s) => t + rowFig(s), 0));
        // the one basis line (spec 5.6), and the rent first while rent is ours
        const typedAny = v.mode !== "total" && rows.some((s) => args.rows?.[s.key] !== null && args.rows?.[s.key] !== undefined);
        adjustEl.hidden = !(typedAny && rows.some((s) => args.rows?.[s.key] === null && Math.abs((grey[s.key] ?? 0) - (baseGrey(args)[s.key] ?? 0)) >= 10));
        const anyGrey = Object.values(grey).some((x) => x > 0);
        basis.textContent = anyGrey ? spendBasis(plan, { today }) : "";
        basis.hidden = !basis.textContent;
        first.hidden = !(v.mode !== "total" && renting && rows.some((s) => s.key === "housing") && args.rows?.housing === null && grey.housing > 0);
        // retirement: our figure follows the rows until it is typed
        if (!allRetired(plan)) {
          const g = later.typed ? null : ctx.guess("overview/setup:retireSpend", { path: "retirement.spendingMonthly", args });
          const fig = g && g.value > 0 ? g.value : null;
          if (laterInput) {
            laterInput.placeholder = fig ? groupDigits(String(Math.round(fig))) : "";
            laterInput.setAttribute("aria-label", `Once you stop working, about how much a month${fig ? `, blank uses our guess of about ${symbol}${groupDigits(String(Math.round(fig)))}` : ""}`);
            if (laterSub) laterSub.textContent = later.typed ? "Your figure. Health cover is added on Will the money last?" : fig ? (loansLater > 0 ? `Our guess: about ${money(Math.round((fig - loansLater) / 10) * 10)} a month of costs, plus the ${money(loansLater)} of loan payments still running then. Health cover is added on Will the money last?` : "Our guess: everyday costs as people 65 to 74 usually spend them, plus your home costs. Health cover is added on Will the money last?") : "";
          }
          // (only what applies: childcare left out when there is any, the loans that run on or end by then when there are any)
          const care = rows.some((r) => r.key === "childcare") || (plan.expenses ?? []).some((x) => x.category === "childcare");
          const loanBit = loansLater > 0 ? `, plus the ${money(loansLater)} of loan payments still running then` : base.loanPayments > 0 ? `${care ? " and" : ""} without the loans that end by then` : "";
          if (laterLine) laterLine.textContent = fig ? `We'll plan on about ${money(fig)} a month once you stop working: today's costs${care ? " without childcare" : ""}${loanBit}. Change it on the "Will the money last?" page.` : "";
          later.guess = fig;
        }
      };
      const row = (s) => {
        const hw = s.key === "housing" ? housingWords(plan) : null, name = hw ? hw.label : s.label, help = hw ? hw.help : s.help;
        const box = moneyIn(v.rows[s.key], (val) => { v.rows[s.key] = val; refresh(); });
        const input = box.querySelector("input"), id = `su-i-${++uid}`;
        input.id = id;
        const tapKey = s.key === "insurance" ? "health-cover" : s.key === "childcare" ? "childcare" : s.key === "housing" ? "hoa" : null;
        const tap = tapKey ? ui.h("div", { class: "su-tap", hidden: true }) : null;
        boxes[s.key] = { input, name, tap, tapKey, tapBuilt: false, ask: null };
        return [ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("label", { class: "su-label", for: id }, name), describe(input, help)), box), tap];
      };
      const mode = tileGroup("How to answer", [{ key: "rows", icon: "📋", label: "A few groups", line: "Rent, food, car..." }, { key: "total", icon: "✏️", label: "One rough total", line: "If you're not sure" }],
        { radio: true, isOn: (o) => (o.key === "total") === (v.mode === "total"), onPick: (o) => { v.mode = o.key; drawBody(); } });
      const drawBody = () => {
        for (const k of Object.keys(boxes)) delete boxes[k];
        totalInput = null;
        if (v.mode === "total") {
          const box = moneyIn(v.total, (val) => { v.total = val; refresh(); });
          totalInput = box.querySelector("input");
          swap(body, field(base.existingCount ? "Everything else, in a month" : "All your spending in a month", box, "Home, food, car, fun: everything. It counts as must-pay, to be safe. Leave it empty and we'll use the grey figure, our guesses for each group added up."));
        } else {
          sums.must = ui.h("span", { class: "sum" }); sums.else = ui.h("span", { class: "sum" });
          const must = rows.filter((s) => s.group === "must"), other = rows.filter((s) => s.group === "else");
          const loanRow = base.loanPayments > 0 ? ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("span", { class: "su-label" }, "Loan and card payments"), ui.h("span", { class: "su-sub" }, "From question 5, already counted")), ui.h("span", { class: "su-fixed" }, money(base.loanPayments))) : null;
          swap(body,
            must.length || loanRow ? ui.h("div", { class: "su-group first" }, ui.h("div", { class: "su-gh" }, "Must-pay bills", sums.must), ...must.flatMap(row), loanRow) : null,
            other.length ? ui.h("div", { class: "su-group" }, ui.h("div", { class: "su-gh" }, "Everything else", sums.else), ...other.flatMap(row)) : null,
            rows.length ? null : ui.h("p", { class: "su-sub" }, "Every kind of bill is already in your plan."));
        }
        refresh();
      };
      add(card, mode, basis, first, body, ui.h("div", { class: "su-total" }, ui.h("span", {}, "In all, about a month"), totalEl), partsEl, adjustEl);
      if (!allRetired(plan)) {
        if (laterBox) {
          const box = moneyIn(later.typed ? later.value : "", (val) => { later.value = val; later.typed = parseMoney(val) !== null; refresh(); });
          laterInput = box.querySelector("input");
          laterSub = ui.h("span", { class: "su-sub", "aria-live": "polite" });
          const id = `su-h-${++uid}`; laterSub.id = id; laterInput.setAttribute("aria-describedby", id);
          add(card, group(null, ui.h("div", { class: "su-field" }, ui.h("label", {}, ui.h("span", { class: "su-label" }, "Once you stop working, about how much a month?"), box), laterSub)));
        } else {
          laterLine = ui.h("p", { class: "su-sub su-laterline", "aria-live": "polite" });
          add(card, laterLine);
        }
      }
      drawBody();
      const words = (p2) => {
        const r = reflect(p2, "spend");
        if (!r) return null;
        // the month in all, as the screen's "In all" says it (loan and card payments from question 5 included)
        // (how many of the screen's amounts are ours, said against how many there are: "6 of the 7 amounts", "All 7 amounts")
        const ours = r.guessed === r.count ? (r.count === 1 ? "The amount is our guess" : `All ${r.count} amounts are our guesses`) : `${r.guessed} of the ${r.count} amounts ${r.guessed === 1 ? "is our guess" : "are our guesses"}`;
        return r.guessed ? `Got it: about ${money(about(r.monthly))} a month. ${ours} for now.` : `Got it: about ${money(r.monthly)} a month, ${money(r.essential)} of it bills you must pay.`;
      };
      const apply = (d) => applySpend(d, { ...v, retireMonthly: later.typed ? later.value : "", retireAuto: !later.typed }, today, { guess: ctx.guess });
      // a typed row far from what households like this spend that a slip explains ($15,000 a month: a year's rent?): asked once
      const check = () => {
        const args = rowArgs();
        for (const s of rows) {
          const t = args.rows?.[s.key];
          if (!(t > 0)) continue;
          const g = ctx.guess(`spend.${s.key}`, { path: `expenses[setup-x-${s.key}].amount`, args: { ...args, rows: { ...args.rows, [s.key]: null } } });
          const slip = typoCheck(t, g ? { value: g.value, sigma: g.sigma } : null, [{ id: "year-as-month", map: (x) => x / 12, words: (x, m) => `${money(x)} a month for ${(s.key === "housing" ? housingWords(plan).label : s.label).toLowerCase()}? Did you mean ${money(x)} a year (${money(m)} a month)? Continue keeps what you typed.` }]);
          if (slip) return slip.words;
        }
        return null;
      };
      current = { apply, words, check };
      // "Skip: use our guesses": what is on the screen is kept (typed boxes stay typed) and every empty box gets our guess.
      // Childcare is never guessed without its tap (spec E06), so a Skip with the childcare tap unanswered asks it once more
      // first (C3 UX review 4: a parent who skipped had no childcare counted, and nothing said so); a second Skip goes on.
      let askedCare = false;
      const careOpen = () => { const b = boxes.childcare; return !!b?.tap && !b.tap.hidden && !(v.taps.childcare) && v.mode !== "total"; };
      actions("Continue", { skipLabel: "Skip: use our guesses", onSkip: () => {
        if (careOpen() && !askedCare) {
          askedCare = true;
          const b = boxes.childcare;
          b.tap.querySelector(".su-care-again")?.remove();
          b.tap.prepend(ui.h("p", { class: "su-sub su-care-again", role: "status" }, "One thing first: we never guess childcare. Do you pay for it? Tap Yes, No or Not sure, or Skip again to leave it out."));
          b.tap.scrollIntoView({ behavior: "smooth", block: "center" });
          b.tap.querySelector("button")?.focus({ preventScroll: true });
          return;
        }
        current = { apply, words }; forward();
      } });
    },

    goals() {
      head("🎯", "What are you working toward?", "Pick any. You can add more later.");
      const v = draft(() => new Set(valuesFor(plan, "goals")));
      add(card, tileGroup("What are you working toward?", GOALS, { isOn: (o) => v.has(o.key), onPick: (o) => { if (v.has(o.key)) v.delete(o.key); else v.add(o.key); }, isHave: (o) => !o.focus && goalTaken(plan, o.key) }),
        haveNote((plan.goals ?? []).filter((g) => !String(g.id).startsWith("setup-")).map((g) => g.name)));
      current = { apply: (d) => applyGoalPicks(d, [...v]) };
      actions();
    },

    "goal-details"() {
      head("🗓️", "How much, and by when?", "A rough target is enough to see what it takes each month.");
      const v = draft(() => valuesFor(plan, "goal-details", { today }));
      const loans = spendBase(plan).loanPayments > 0;
      // the plan as this screen's answers would save it, so the cushion line follows a savings account linked below (round 8)
      const preview = () => { const d = structuredClone(plan); try { applyGoalDetails(d, v, today); } catch { return plan; } return d; };
      const choices = goalFundChoices(plan);
      let redrawCushion = null;
      const shownGoals = GOALS.filter((x) => !x.focus && x.key !== "cushion" && picks(plan, "goals").includes(x.key) && !goalTaken(plan, x.key));
      const notes = [];   // each goal's line under its pills, redrawn after any tap (an account ticked for two goals)
      let tapped = null;
      /** "Is any of your savings already for this?": the cash accounts as pills (any number), or None of it. */
      const fundsPick = (g, x) => {
        const sel = new Set(x.funds ?? []);
        let none = false;
        const opts = [...choices.map((a) => ({ id: a.id, label: `${a.name}: ${money(a.balance)}` })), { id: null, label: "None of it" }];
        const note = ui.h("div", { "aria-live": "polite" });
        // after a tap, under the pills: what the cushion now counts (its own line may be above the screen; review UX 7), and
        // an account ticked for another goal too, which fills that goal in date order (Goals' F-013; review UX 8)
        const drawNote = () => {
          const also = [...sel].map((id) => { const o = shownGoals.filter((y) => y.key !== g.key && (v[y.key]?.funds ?? []).includes(id)); const a = choices.find((c) => c.id === id); return o.length && a ? `${a.name} is also for ${o.map((y) => goalWords({ id: `setup-goal-${y.key}`, name: v[y.key]?.name || y.label })).join(" and ")}.` : null; }).filter(Boolean);
          let have = null;
          if (tapped === g.key) { const pv = preview(), c = cushion(pv, v.cushion?.months ?? null, today); if (c.essential > 0) have = `Your cushion now counts ${money(c.now)}: ${(Math.round((c.covered ?? 0) * 10) / 10).toFixed(1)} months of must-pay bills. Aim for ${c.months}.`; }
          swap(note, also.length ? ui.h("p", { class: "su-live" }, `${also.join(" ")} The goal due first fills first.`) : null, have ? ui.h("p", { class: "su-live" }, have) : null);
        };
        notes.push(drawNote);
        const btns = opts.map((o) => ui.h("button", { type: "button", onClick: () => {
          if (o.id === null) { none = !none; sel.clear(); } else { none = false; if (sel.has(o.id)) sel.delete(o.id); else sel.add(o.id); }
          x.funds = [...sel];
          tapped = g.key;
          mark(); notes.forEach((f) => f()); redrawCushion?.();
        } }, o.label));
        const mark = () => btns.forEach((b, i) => b.setAttribute("aria-pressed", String(opts[i].id === null ? none : sel.has(opts[i].id))));
        mark();
        const el = fieldset("Is any of your savings already for this?", ui.h("div", { class: "su-seg", role: "group", "aria-label": `${g.label}: savings already for it` }, btns), GOAL_FUNDS_HELP);
        el.classList.add("su-gap");
        return ui.h("div", {}, el, note);
      };
      for (const g of GOALS.filter((x) => !x.focus && picks(plan, "goals").includes(x.key) && !goalTaken(plan, x.key))) {
        const x = v[g.key];
        if (g.key === "cushion") {
          const live = ui.h("div", { "aria-live": "polite" });
          const drawC = () => {
            const pv = preview(), c = cushion(pv, x.months, today);
            // Emergency fund's own target (months x must-pay bills), and why the cash it counts is less than the accounts hold
            const share = c.exact > 0 ? Math.min(1, c.now / c.exact) : 0;
            swap(live, c.essential > 0
              ? ui.h("p", { class: "su-live" }, "That's ", ui.h("b", {}, money(c.exact)), `: ${x.months} month${x.months === 1 ? "" : "s"} of the ${money(c.essential)} in must-pay bills${loans ? " and loan payments" : ""}.`)
              : ui.h("p", { class: "su-live" }, "Your must-pay bills (question 6) set the amount."),
              c.essential > 0 ? ui.h("p", { class: "su-live" }, cushionHave(pv, c)) : null,
              c.essential > 0 ? ui.h("div", { class: "su-meter", role: "img", "aria-label": `${Math.round(share * 100)}% of the cushion` }, ui.h("span", { style: { width: `${Math.round(share * 100)}%` } })) : null);
          };
          drawC();
          redrawCushion = drawC;
          add(card, group(`${g.icon} ${g.label}`, fieldset("How many months of must-pay bills?", stepper(x.months, 1, 12, (n) => { x.months = n; drawC(); }, "Months of must-pay bills"), "Three to six months is the usual advice; more if your pay goes up and down."), live));
          continue;
        }
        const dateBox = ui.h("div", {});
        const opts = [...DATE_CHIPS.map((n) => ({ value: String(n), label: `${n} year${n === 1 ? "" : "s"}` })), { value: "date", label: "Pick a date" }];
        let chip = x.years ? String(x.years) : x.date ? "date" : String(g.years);
        const drawDate = () => swap(dateBox, chip === "date" ? ui.h("input", { class: "su-in", type: "date", value: x.date || "", min: today, "aria-label": `${g.label}: by when`, onInput: (e) => { x.date = e.target.value; x.years = null; } }) : "");
        drawDate();
        add(card, group(`${g.icon} ${g.label}`,
          g.key === "other" ? field("What is it?", ui.h("input", { class: "su-in", enterkeyhint: "next", value: x.name, onInput: (e) => { x.name = e.target.value; } }), "For example, a new kitchen.") : null,
          field("How much", moneyIn(x.target, (val) => { x.target = val; redrawCushion?.(); }, { label: `${g.label}: how much` }), goalAmountHelp(g.key)),
          fieldset("By when", seg(opts, chip, (val) => { chip = val; if (val !== "date") { x.years = Number(val); x.date = ""; } drawDate(); }, `${g.label}: by when`)), dateBox,
          choices.length ? fundsPick(g, x) : null));
      }
      firstGroup();
      current = { apply: (d) => applyGoalDetails(d, v, today) };
      actions("See where I stand");
    },

    done() {
      if (!plan.guide?.setup?.finishedAt && wouldChange(plan, (d) => markAt(d, "done", today))) { store.update((d) => markAt(d, "done", today)); return; }
      if (reveal && !reduced()) {
        reveal = false;
        add(card, ui.h("div", { class: "su-wait", role: "status" }, ui.h("div", { class: "su-dots", "aria-hidden": "true" }, ui.h("i"), ui.h("i"), ui.h("i")), ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, "Putting your plan together…")));
        setTimeout(() => { if (card.isConnected) { swap(card); drawDone(); } }, 1100);
        return;
      }
      reveal = false;
      drawDone();
    },
  };

  function drawDone() {
    drafts = {};
    const st = standing(plan, { today });
    const any = st.netWorth !== null || st.spare !== null || st.runway !== null || !!st.retire;
    add(card, ui.h("div", { class: "su-done-head" }, any ? ui.h("div", { class: "su-check", "aria-hidden": "true" }, "✓") : ui.h("div", { class: "su-emoji", "aria-hidden": "true" }, "🌱"),
      ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, any ? (firstName ? `You did it, ${firstName}. Here is your money on one page.` : "You did it. Here is your money on one page.") : "Your plan is ready for numbers"),
      ui.h("p", {}, st.headline)));
    const counters = [];
    const fig = (cls, label, value, sub, status, href) => {
      const s = ui.stat(label, typeof value === "number" ? money(value) : value, sub);
      if (typeof value === "number") counters.push({ el: s.querySelector(".stat-value"), to: value });
      return ui.h(href ? "a" : "div", { class: `su-fig ${cls}`, href: href ?? null }, s, status ? ui.h("div", { class: "st" }, status) : null);
    };
    const couple = st.later.some((l) => l.key === "couple");
    // half or more of one side is our guesses: the figure, said as partly ours, calm (never "a solid base" on guesses)
    const nwFig = st.netWorth === null ? fig("open", "What you own, minus what you owe", "Not yet", "Needs what you have and what you owe.", "Add them ›", setupHref("have"))
      : st.netWorthGuessed ? fig("calm", "What you own, minus what you owe", st.netWorth, `Partly our guesses. You own about ${money(about(st.assets))} and owe about ${money(about(st.liabilities))}.`, "● Our guesses for now")
      : st.netWorth >= 0 ? fig("ok", "What you own, minus what you owe", st.netWorth, `You own ${money(st.assets)} and owe ${money(st.liabilities)}.`, "● A solid base")
        : st.homeMissing ? fig("calm", "What you own, minus what you owe", st.netWorth, "Your home's value is not in yet, so only the mortgage counts.", "Add your home ›", setupHref("owe-amounts"))
          : fig("calm", "What you own, minus what you owe", st.netWorth, "Common with a mortgage or student loans. It grows as you pay them down.", "● Grows as the loans shrink");
    const spareFig = st.spare === null ? fig("open", "Left over each month", "Not yet", "Needs your pay and spending.", "Add them ›", setupHref((plan.income ?? []).length ? "spend" : "money"))
      // most of the spending is our guesses (spec 8.1): no verdict, no green or amber; what our guesses say, and where to type
      : st.spareWaits ? fig("calm", "Left over each month", "Depends on your spending", `With our spending guesses: about ${money(about(Math.abs(st.spare)))} ${st.spare < 0 ? "short" : "spare"}.${st.childcareMissing ? " Childcare is not counted yet." : ""} Type yours ›`, "● Our guesses for now", setupHref("spend"))
      : st.drawing ? fig("calm", "Drawn from savings each month", -st.spare, "What your pension and Social Security don't cover.", "● Living on savings")
        : st.bank ? fig("warn", "Left over each month", st.spare, `By your plan. Your bank shows about ${money(Math.round(st.bank.gap / 10) * 10)} a month more going out.`, "Check Expenses ›", "#/cashflow/expenses")
        : fig(st.spare >= 0 ? "ok" : "warn", "Left over each month", st.spare, `After ${st.stateTaxCounted ? "tax" : "federal tax"}${couple ? " (worked out as one return for now)" : ""}, bills and saving${st.debtExtra > 0 ? `, and the ${money(st.debtExtra)} a month extra on ${st.debtOn ?? "debts"}` : ""}.${st.lean ? ` That is a lean month: when all your uneven pay comes in, ${st.lean.kind === "ahead" ? `about ${money(st.lean.about)} is left` : st.lean.kind === "even" ? "it only just about breaks even" : `it is still about ${money(-st.lean.about)} short`}.` : ""}`,
          // short only in a lean month (Side income's "count on"; review 2026-11-02, round 5)
          st.spare >= 0 ? "● Money to put to work" : st.lean?.kind === "ahead" ? "● Short in a lean month" : "● More goes out than comes in");
    // cash set aside for a goal, or this year's tax not paid yet, is not cushion: said, so the months read right (round 8)
    const held = cushionHeldWords(st, plan);
    // the cash is held for the owner's own "Emergency fund" goal, not ticked as the cushion: where to say it is (F-034)
    const heldAsk = cushionHeldAsk(st);
    const cushionFig = st.runway === null ? fig("open", "Safety cushion", "Not yet", "Needs your spending and savings.", "Add them ›", setupHref((plan.expenses ?? []).length ? "have" : "spend"))
      : st.runwayWaits ? fig("calm", "Safety cushion", `About ${(Math.round(st.runway * 10) / 10).toFixed(1)} months`, `${held ? `${held} ` : ""}By our guesses of your must-pay bills. Aim for ${st.runwayTarget ?? 6}.`, "● Our guesses for now", setupHref("spend"))
      : fig(st.runwayStatus === "ok" ? "ok" : "warn", "Safety cushion", `${(Math.round(st.runway * 10) / 10).toFixed(1)} months`, held ? `${held} Aim for ${st.runwayTarget ?? 6} months.${heldAsk ? ` ${heldAsk}` : ""}` : `of must-pay bills in cash. Aim for ${st.runwayTarget ?? 6}.`, st.runwayStatus === "ok" ? "● Covered" : "● Worth building up", heldAsk ? "#/goals/emergency-fund" : null);
    const retireFig = !st.retirementKnown || !st.retire ? fig("open", "Retirement", "Not worked out yet", `Needs ${st.retirementMissing ?? "Social Security and birth dates"}.`, "Add it ›", setupHref("ages"))
      // its spending is mostly our guesses: the verdict word, calm, never "Short at 65" in amber on guesses alone
      : st.retireGuessed ? fig("calm", "Retirement", st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : "Needs a look", "Partly our guesses. Type what you spend ›", "● Our guesses for now", setupHref("spend"))
      : fig(st.retire.verdict === "on track" ? "ok" : "warn", "Retirement", st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : st.retire.shortAge ? `Short at ${st.retire.shortAge}` : "Needs a look", "If nothing changes.", st.retire.verdict === "on track" ? "● The money lasts" : "● Small changes help", "#/retirement/projection");
    add(card, ui.h("div", { class: "su-stand" }, nwFig, spareFig, cushionFig, retireFig));
    if (!reduced() && counters.length) {
      const t0 = performance.now(), dur = 800;
      for (const c of counters) c.el.textContent = money(0);
      const tick = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); for (const c of counters) c.el.textContent = money(c.to * e).replace(/,/g, ",​"); if (k < 1 && card.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    if (st.moves.length) {
      add(card, ui.h("h2", { class: "su-h2" }, st.moves.length === 1 ? "Your first move" : `Your first ${st.moves.length === 2 ? "two" : "three"} moves`),
        ui.h("ol", { class: "su-moves" }, st.moves.map((m, i) => ui.h("li", {}, ui.h("a", { href: m.href }, ui.h("span", { class: "n", "aria-hidden": "true" }, String(i + 1)), ui.h("span", {}, ui.h("b", {}, m.title), m.detail ? ui.h("span", { class: "d" }, m.detail) : null), ui.h("span", { class: "c", "aria-hidden": "true" }, "›"))))));
    }
    // what is not counted yet: what no tile above already asks for (their "Add them" links cover the rest)
    // Social Security worked out from pay is counted, so it is one of our guesses, not "not counted yet"
    const ssLine = st.later.find((l) => l.key === "ss-estimate");
    const notes = st.later.filter((l) => !["income", "spend", "accounts", "retire", "ss-estimate"].includes(l.key)).map((l) => rowLink(l.href, null, l.label));
    // a car loan counts while the car is not in yet (question 4 left its value empty): said, with where to add it
    const carLoan = (plan.accounts ?? []).some((a) => a.type === "loan" && (a.id === "setup-owe-car-loan" || /car|auto|vehicle|truck/i.test(a.name ?? "")) && Math.abs(Number(a.balance) || 0) > 0);
    const carIn = (plan.accounts ?? []).some((a) => a.type === "vehicle" && Number(a.balance) > 0);
    if (carLoan && !carIn) notes.unshift(rowLink(setupHref(picks(plan, "have").includes("car") ? "have-amounts" : "have"), null, "Your car: type what it would sell for, so it counts beside its loan"));
    // the debt figures we filled in are counted, so they are not "not counted yet": they are listed as our guesses, each
    // debt on one row, with the page that lists every guess (and where to type the real figures)
    const homes = (plan.accounts ?? []).filter((a) => a.type === "property" && typeof a.id === "string" && isGuess(plan, `accounts[${a.id}].balance`))
      .map((a) => rowLink("#/overview/guesses", null, `${a.name}: worth about ${money(a.balance)}`));
    // the month's spending we filled in comes first: it moves the most
    const spendRow = st.spendGuessed ? [rowLink(setupHref("spend"), null, `Spending: about ${money(about(st.spendGuessed.monthly))} a month${st.spendGuessed.typed > 0 ? `, besides the ${money(st.spendGuessed.typed)} you typed` : ""}`)] : [];
    const ours = [...spendRow, ...guessTwins(plan).map((t) => rowLink("#/overview/guesses", null, `Is ${t.twinName} the ${t.name.toLowerCase()} we guessed? Tell us, so it counts once`)), ...homes, ...st.guessed.map((g) => {
      const parts = [g.owed !== undefined ? `still owed about ${money(g.owed)}` : null, g.rate !== null ? `rate ${pctOf(g.rate)}` : null, g.payment !== null ? `${money(g.payment)} a month` : null].filter(Boolean);
      return rowLink("#/overview/guesses", null, `${g.name}: ${parts.join(", ")}`);
    }), ...(st.iraGuessed ?? []).map((x) => rowLink(setupHref("have-amounts"), null, `${ad.length > 1 ? x.name : "Your retirement"}: counted as a traditional IRA. A Roth? Tell us which`)),
    ...(ssLine ? [rowLink(ssLine.href, null, ssLine.label)] : [])];
    if (ours.length) {
      const n = guessesInUse(plan).length;
      add(card, ui.h("h2", { class: "su-h2" }, "Our guesses for now"),
        ui.h("p", { class: "su-help" }, "Typical figures for a household like yours. Good enough to start; type the real ones when you have them."),
        ui.h("ul", { class: "page-list" }, ours, n > ours.length ? rowLink("#/overview/guesses", null, `All ${n} of our guesses`) : null));
    }
    if (notes.length) add(card, ui.h("h2", { class: "su-h2" }, "Not counted yet"), ui.h("ul", { class: "page-list" }, notes));
    const a = plan.assumptions ?? {};
    const pc = (x) => `${Math.round(Number(x) * 1000) / 10}%`;
    const looked = !!a.reviewedAt;
    add(card, ui.h("details", { class: "card fold fold-card su-guess" },
      ui.h("summary", {}, ui.h("h2", {}, "What the plan assumes about prices and markets"), ui.h("span", { class: "fold-status" }, looked ? "✓ Looked over" : "Worth a look"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("ul", { class: "su-list" },
        [["🏷️", `Prices rise ${pc(a.inflation ?? 0.03)} a year`, "Inflation, the long-run average"],
          ["📈", `Stocks grow about ${pc(a.returnStocks ?? 0.07)} a year, bonds ${pc(a.returnBonds ?? 0.04)}`, "Before inflation, on average; some years fall"],
          ["🎂", `The plan runs to age ${a.planEndAge ?? 95}`, "So the money is planned to last"],
          ["🛟", `A cushion of ${a.emergencyMonths ?? 6} months of must-pay bills`, "For a lost job or a big repair"]]
          .map(([i, b, m]) => ui.h("li", {}, ui.h("span", { class: "su-li", "aria-hidden": "true" }, i), ui.h("div", {}, ui.h("b", {}, b), ui.h("span", { class: "m" }, m))))),
      ui.h("div", { class: "su-gbtns" }, looked ? null : ui.h("button", { type: "button", class: "secondary", onClick: () => { pending = [{ kind: "ok", text: "Saved: you've looked over what the plan assumes." }]; store.update((d) => applyGuesses(d, today)); } }, "These sound fine"), ui.h("a", { href: "#/system/assumptions", class: "btn secondary" }, "Change them ›"))));
    add(card, ui.h("div", { class: "su-end" }, ui.h("a", { class: "btn", href: "#/overview/dashboard" }, "Go to my dashboard"), ui.h("button", { type: "button", class: "secondary", onClick: () => go("welcome") }, "Change an answer")));
    try { card.querySelector("#su-q")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
  }

  (UI[screenId] ?? UI.welcome)();
  add(root, ui.h("p", { class: "su-foot" }, FOOT));
  if (screen.q) { try { card.querySelector("#su-q")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } }
}
