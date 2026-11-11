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
  applyGoalPicks, applyGoalDetails, sumSplit, progress, standing, payLineNow, oweArgs, haveId, spendArgs, spendBasis, housingWords,
  haveArgs, employerPay, pctToMonthly, SAVING_CHIPS, haveKeys, readShareOfPay, parseYear,
  applyLeftOver, solveSpend, leftOverGuess, yearSavingWords, leftMarker, leftReading, spendAnswered,
  WORK_PLAN, workPlanAcct, workPlanLine, workPlanAdded, goalFundChoices, cushionHave, monthsWords, cushionHeldWords, cushionHeldAsk, IRA_KINDS, iraKindHelp,
  retireGuessAsk, retireKindsFor, ssGettingHelp, goalAmountHelp, GOAL_FUNDS_HELP, goalWords,
} from "./compute.js";
import { overTarget, monthsNear } from "../../../core/words.js";
import { typoCheck } from "../../../core/math/estimate.js";
import { applies, isGuess } from "../../../core/estimate/index.js";
import { startGuide, pathSummary, PATH_ID } from "../guide/compute.js";
import { offKeys, change } from "../guide/act.js";
import { dayWords } from "../next-best-action/compute.js";
import { calmHeadline } from "../dashboard/compute.js";
import { fullRetirementAge } from "../../retirement/social-security/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { ageOn } from "../../../core/math/dates.js";

/**
 * Where the person is now (markAt), and the path starts with the first screen: "Build my plan" is followed from the moment the
 * questions begin (startGuide changes nothing once it has started, so no extra save). It lives here, not in compute.js:
 * guide/journeys imports the setup's compute, so the other way round would be a cycle.
 */
const atScreen = (d, screen, today) => { markAt(d, screen, today); if (!d.guide?.journeys?.[PATH_ID]?.startedAt) startGuide(d, PATH_ID, today); };

let pending = [];        // [{ kind, text }] for the top of the next screen (the shell redraws after every save)
let lastShare = 0;       // the bar starts where the last screen left it, then fills to this one
let reveal = false;      // the last Continue was just tapped: show "Putting your plan together" once
let drafts = {};         // { [screen]: { v, at } }: typed, not saved yet, kept for Back and forth while the plan is unchanged
// ... and across a reload of the tab: written to sessionStorage as the page is hidden, read back once; the stamp still decides
// (Sets are written as { "\u0000set": [...] }). Only for this tab: it is gone when the tab closes (FL-SETUP F8)
const DRAFT_KEY = "planner.setup.drafts";
let draftsRead = false, draftsHooked = false;
const SET_TAG = "\u0000set";
function draftsLoad() {
  if (draftsRead) return; draftsRead = true;
  try {
    const raw = globalThis.sessionStorage?.getItem(DRAFT_KEY); if (!raw) return;
    const back = JSON.parse(raw, (k, v) => (v && typeof v === "object" && Array.isArray(v[SET_TAG]) ? new Set(v[SET_TAG]) : v));
    if (back && typeof back === "object" && !Object.keys(drafts).length) drafts = back;
  } catch { /* storage blocked or a bad entry: start clean */ }
}
function draftsSave() {
  try {
    const keep = Object.keys(drafts).length ? JSON.stringify(drafts, (k, v) => (v instanceof Set ? { [SET_TAG]: [...v] } : v)) : null;
    if (keep) globalThis.sessionStorage?.setItem(DRAFT_KEY, keep); else globalThis.sessionStorage?.removeItem(DRAFT_KEY);
  } catch { /* storage blocked or full: drafts live in memory only */ }
}
function draftsHook() {
  if (draftsHooked || typeof window === "undefined" || typeof window.addEventListener !== "function") return; draftsHooked = true;
  window.addEventListener("pagehide", draftsSave);
  try { document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") draftsSave(); }); } catch { /* no document */ }
}
let cameFrom = null;     // the screen a Continue just left: stamped on the next screen's history entry, so Back can go back
let warnedPay = null;    // the low-pay question already asked once for these figures
const askedOnce = new Set();  // every ask already said for these figures (cleared with warnedPay)
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
.su-year > input { max-width: 9em; font-variant-numeric: tabular-nums; }
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
.su-live.su-bad { color: var(--text); font-weight: 600; }
.su-born + .su-live.su-bad:empty, div > .su-live.su-bad:empty { display: none; }
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
.su-fold { margin: 14px 0 0; }
.su-fold > summary { border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 6px 14px; background: var(--panel); }
.su-fold[open] > summary { margin-bottom: 12px; }
.su-fold .fold-title { color: var(--accent-ink); }
.su-total { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 14px 16px; margin: 8px 0 0; border-radius: var(--radius-sm); background: var(--panel-2); font-weight: 650; }
.su-total b { font-size: var(--fs-lg); font-variant-numeric: tabular-nums; }
.su-parts { color: var(--text-2); font-size: var(--fs-sm); text-align: right; margin: 6px 4px 20px; font-variant-numeric: tabular-nums; }
.su-parts:empty { margin-bottom: 20px; }
.su-have { background: var(--panel-2); border-radius: var(--radius-sm); padding: 12px 14px; margin: 0 0 16px; color: var(--text-2); line-height: 1.45; }
.su-have b { color: var(--text); font-weight: 600; }
.su-basis { margin: 4px 0 12px; font-size: var(--fs-sm); }
.su-left-out { margin: 4px 0 14px; font-size: var(--fs-sm); color: var(--text-2); }
.su-left-out b { color: var(--text); }
.su-left-out .su-pair { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
.su-left-out .su-pair button { min-height: 44px; }
.su-notsure { margin: 0 0 6px; }
.su-way-left[hidden], .su-way-spend[hidden] { display: none; }
.su-first { margin: 0 0 8px; font-weight: 600; color: var(--text); font-size: var(--fs-sm); }
.su-total[hidden], .su-parts[hidden], .su-basis[hidden], .su-first[hidden], .su-tap[hidden], .su-adjust[hidden], .su-over[hidden] { display: none; }
.su-tap { padding: 0 0 12px; }
.su-tap .su-field { margin: 0; }
.su-tap .su-label { font-size: var(--fs-sm); font-weight: 600; }
.su-laterline { border-top: 1px solid var(--line); padding: 16px 0 0; margin: 0 0 8px; font-size: var(--fs-sm); }
.su-laterline:empty { display: none; }
.su-actions { display: flex; gap: 10px; margin: 22px 0 0; scroll-margin-bottom: 16px; }
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
.su-next { margin: 4px 0 0; }
.su-next .su-help { margin-bottom: 12px; }
.su-steps { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 8px; }
.su-steps li { display: flex; gap: 12px; align-items: center; min-height: 32px; line-height: 1.3; }
.su-steps li .n { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-ink); font-size: var(--fs-sm); font-weight: 700; }
.su-steps li.done { color: var(--text-2); }
.su-steps li.done .n { background: var(--ok-soft); color: var(--ok); }
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
/* a phone held sideways (390 px high or less): no big emoji, tighter heading and card, so the first box and the choices
   come up on the first screen (stress test 2026-11-11, sideways phone) */
@media (max-height: 480px) {
  .su-emoji { display: none; }
  .su-q { margin: 0 0 4px; }
  .su-card { padding: 12px; }
}
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
// Continue held on the left-over box: the reason itself, said beside Continue (the warning under the box may be off screen;
// "below" was wrong there, the message sits above the button: FL-SETUP OP-3 follow-up)
function leftStop(res, money) {
  const why = res?.why;
  if (why === "typed") return "What you typed in the groups is more than that left over allows. Tap \"My groups are right\" or \"What's left is right\" under the leftover box, then Continue.";
  if (why === "bills") return "Your bills and loan payments already in the plan are more than that left over allows. Tap \"My bills are right\" under the leftover box, or change the amount, then Continue.";
  if (why === "more-than-pay") return `That left over is more than comes in after tax and saving${res.available > 0 ? ` (about ${money(res.available)} a month)` : ""}. Change the amount, then Continue.`;
  if (why === "step") return "We could not match that exact leftover amount. Try a figure a few dollars higher or lower, then Continue.";
  return "Change the leftover amount, then Continue.";
}
/** "1234567.5" -> "1,234,567.5" as you type (k and m kept at the end). */
function groupDigits(raw, signed = false) {
  const neg = signed && /^\s*[-\u2212]/.test(String(raw ?? ""));   // a leading minus, only where a figure may go below zero (the left-over)
  let s = String(raw ?? "").replace(/[^0-9.kKmM]/g, "");
  const suf = /[kKmM]$/.test(s) ? s.slice(-1).toLowerCase() : "";
  s = s.replace(/[kKmM]/g, "");
  const [i, ...rest] = s.split(".");
  const int = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + int + (rest.length ? `.${rest.join("").slice(0, 2)}` : "") + suf;
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
  const today = fmt.today(), thisYear = Number(today.slice(0, 4));
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
  // an "about" figure that adds up our guesses: three significant figures ($158,900 -> $159,000), $10 under $1,000
  const about = (n) => { const x = Math.abs(Number(n) || 0); if (x < 1000) return Math.round(n / 10) * 10; const step = 10 ** (Math.floor(Math.log10(x)) - 2); return Math.round(n / step) * step; };
  const pctOf = (r) => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
  const symbol = (() => { try { return new Intl.NumberFormat(plan.meta?.locale || "en-US", { style: "currency", currency: cur }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$"; } catch { return "$"; } })();
  const prog = progress(plan);
  const asked = ctx.route.rest?.[0] ?? "welcome";
  const backDone = ctx.route.query?.back === "done";
  // opened from a row of Your plan ("&from=plan"): Back and Save both lead back to Your plan, not to the reveal
  const fromPlan = backDone && ctx.route.query?.from === "plan";
  const hops = backDone ? Math.max(0, Math.min(5, Number(ctx.route.query?.hops) || 0)) : 0;
  const keepQuery = backDone ? `?back=done${fromPlan ? "&from=plan" : ""}${hops ? `&hops=${hops}` : ""}` : "";
  const screenId = resolveScreen(plan, SCREENS.some((s) => s.id === asked) ? asked : "welcome");
  if (screenId !== asked && asked !== "welcome") { try { history.replaceState(history.state, "", `#/overview/setup/${screenId}${keepQuery}`); } catch { /* the address stays; the screen is right */ } }
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
  // the questions were finished before this screen's save (read before it: the save itself may reach "done")
  const wasDone = !!plan.guide?.setup?.finishedAt;
  draftsLoad(); draftsHook();
  const draft = (make) => { const d = drafts[screenId]; const v0 = d && d.at === stamp ? d.v : undefined;
    // a kept draft is used only when it has the shape a fresh one has (a Set for a Set, an object for an object): a draft from an
    // older version of this page, or a damaged entry, is dropped, never a blank screen (breaker 2026-11-11)
    if (v0 !== undefined) { const fresh = make(); if (v0 !== null && (fresh instanceof Set ? v0 instanceof Set : typeof v0 === typeof fresh && !(v0 instanceof Set) && Array.isArray(v0) === Array.isArray(fresh))) return v0; drafts[screenId] = { v: fresh, at: stamp }; return fresh; }
    const v = make(); drafts[screenId] = { v, at: stamp }; return v; };

  /** The answers on screen as a writer; Continue and Finish later save through it. */
  let current = null;
  const toStart = () => { drafts = {}; ctx.go("overview", "start"); };
  const save = (then) => {
    if (!current) { then(nextScreen(plan, screenId)); return; }
    let kept = [];
    // opened from a tile before the questions are finished: a Save never marks them finished on the way back (breaker 2026-11-11)
    const fn = (d) => { kept = current.apply(d) || []; const to = nextScreen(d, screenId); atScreen(d, then === toStart || (backDone && !wasDone && to === "done") ? screenId : to, today); };
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
  // a question before Continue goes on: right above Back / Continue, where the thumb and the eye already are, the screen moved
  // only as far as it takes to see it (it used to go to the top of the card, a screen or two from the box it was about and
  // from Continue; stress test 2026-11-11, OP-3 and F8). `ask` is the words, or { text, choices: [{ label, run }], focus }:
  // the choices are buttons in the notice (the low-pay one sets "A month" there), `focus` the box to put the cursor in
  const askHere = (ask) => {
    const { text, choices = [], focus = null } = typeof ask === "string" ? { text: ask } : ask;
    card.querySelector(".su-ask")?.remove();
    const el = ui.notice("warn", text); el.classList.add("su-ask"); el.setAttribute("role", "alert");
    if (choices.length) el.append(ui.h("div", { class: "su-pair" }, choices.map((c) => ui.h("button", { type: "button", class: "secondary", onClick: c.run }, c.label))));
    const row = card.querySelector(".su-actions");
    if (row) row.before(el); else card.prepend(el);
    // the message and Continue together on screen (the message alone left Continue just under the edge: breaker 2026-11-11);
    // the box it is about is not focused: on a phone the keyboard would open over the message
    try { (row ?? el).scrollIntoView({ block: "end", behavior: reduced() ? "auto" : "smooth" }); if (el.getBoundingClientRect().top < 64) el.scrollIntoView({ block: "start", behavior: "auto" }); } catch { /* a nicety */ }
    void focus;
  };
  const askText = (ask) => (typeof ask === "string" ? ask : ask?.text ?? null);
  const forward = () => {
    // a answer that cannot be saved as it stands (a left-over the typed bills leave no room for, a birth year that is not a
    // year): said, and Continue waits until it is changed
    const stop = current?.block?.();
    if (stop) { askHere(stop); return; }
    // every ask said on this screen is remembered: a second Continue passes it, and the next one still behind it is asked
    // (a couple: "Bo: tap..." first, then Ann's low pay; breaker 2026-11-11)
    if (warnedPay === null) askedOnce.clear();
    const ask = current?.check?.(askedOnce);
    if (ask && !askedOnce.has(askText(ask))) {
      warnedPay = askText(ask); askedOnce.add(warnedPay);
      askHere(ask);
      return;
    }
    save((next) => {
      cameFrom = screenId;
      // while questions are still unanswered, Save goes back to where it was opened from (the Dashboard, or the reveal), never
      // on to "You did it" with questions left (stress test 2026-11-11, j-first-renter/x-1)
      // (`hops`: the follow-up screens Save went through on the way, so the way back skips them too)
      if (backDone) { if (SCREENS.find((s) => s.id === next)?.follow) go(next, { back: "done", ...(fromPlan ? { from: "plan" } : {}), hops: String(hops + 1) }); else if (fromPlan) ctx.go("overview", "plan"); else if (!wasDone) history.go(-(hops + 1)); else go("done"); return; }
      if (next === "done") reveal = true;
      go(next);
    });
  };
  const skip = () => {
    const fn = (d) => { if (screenId === "you" && !(d.household?.people ?? []).length) applyYou(d, { who: "me" }); atScreen(d, nextScreen(d, screenId), today); };
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
    if (fromPlan) { ctx.go("overview", "plan"); return; }
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
  // Enter (the phone keyboard's Next) moves to the next thing to answer, never on to the next question. The stops, in reading
  // order, are the boxes and the choices (tiles, pills, a − / + counter): Next goes on to a box only when no choice sits between;
  // otherwise it closes the keyboard and brings that choice to the middle of the screen, and the key says Done (stress test
  // 2026-11-11, j-hard-conditions/x-1, K7). A box inside a closed fold is not a stop (F3: Next did nothing on question 6).
  const shown = (el) => el.offsetParent !== null && !el.closest("details:not([open])");
  const stops = () => [...card.querySelectorAll("input.su-in, select.su-in, [role=radiogroup], [role=group], .su-step")]
    .filter((el) => shown(el) && !el.disabled && !(el.matches("[role=group], .su-step") && el.parentElement?.closest("[role=radiogroup], [role=group], .su-step")));
  const isBox = (el) => el.matches("input, select");
  const after = (t) => { const all = stops(); return all[all.indexOf(t) + 1] ?? null; };
  card.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("su-in")) return;
    e.preventDefault();
    const nxt = after(t);
    if (nxt && isBox(nxt)) { nxt.focus(); return; }
    t.blur();
    if (!nxt) return;
    try { nxt.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); } catch { /* a nicety */ }
    const pick = nxt.querySelector("[aria-checked=true], [aria-pressed=true]") ?? nxt.querySelector("button");
    try { pick?.focus({ preventScroll: true }); } catch { /* a nicety */ }
  });
  card.addEventListener("focusin", (e) => { const t = e.target; if (t instanceof HTMLInputElement && t.classList.contains("su-in")) { const nxt = after(t); t.setAttribute("enterkeyhint", nxt && isBox(nxt) ? "next" : "done"); } });
  for (const n of pending) { const el = ui.notice(n.kind, n.text); el.setAttribute("role", "status"); add(card, el); ctx.announce?.(n.text); }
  pending = [];

  // ---- small parts
  const head = (emoji, q, help) => add(card,
    emoji ? ui.h("div", { class: "su-emoji", "aria-hidden": "true" }, emoji) : null,
    ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, screen.q ? ui.h("span", { class: "su-vh" }, `Question ${screen.q} of ${QUESTIONS}: `) : null, q),
    help ? ui.h("p", { class: "su-help" }, help) : null);
  const actions = (label = "Continue", { noSkip = false, skipLabel = "Skip this question", onSkip = skip } = {}) => {
    add(card, ui.h("div", { class: "su-actions" },
      ui.h("button", { type: "button", class: "secondary su-backbtn", onClick: back }, fromPlan ? "‹ Your plan" : "‹ Back"),
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
  const moneyIn = (value, onValue, { label = null, placeholder = "", signed = false } = {}) => {
    // (signed: a figure that may go below zero takes a minus sign, and the phone keyboard that has one: the left-over)
    const input = ui.h("input", { class: "su-in", inputmode: signed ? "text" : "decimal", enterkeyhint: "next", autocomplete: "off", value: groupDigits(value === null || value === undefined ? "" : String(value), signed), placeholder, "aria-label": label });
    input.addEventListener("input", () => {
      const at = input.selectionStart ?? input.value.length;
      const before = input.value.slice(0, at).replace(/[^0-9.kKmM]/g, "").length;
      input.value = groupDigits(input.value, signed);
      let n = 0, p = 0;
      while (p < input.value.length && n < before) { if (input.value[p] !== "," && input.value[p] !== "-") n++; p++; }
      try { input.setSelectionRange(p, p); } catch { /* not focused */ }
      onValue(input.value);
    });
    return ui.h("div", { class: "su-money" }, ui.h("span", { "aria-hidden": "true" }, symbol), input);
  };
  const pctIn = (value, onValue, label, placeholder) => ui.h("div", { class: "su-pct" }, ui.h("input", { class: "su-in", inputmode: "decimal", enterkeyhint: "next", value: value === "" || value === null || value === undefined ? "" : String(value), placeholder, "aria-label": label, onInput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); onValue(e.target.value); } }), ui.h("span", { "aria-hidden": "true" }, "%"));
  // a four-digit year ("Year you bought it"): digits only, a number keypad on a phone
  const yearIn = (value, onValue, label) => ui.h("div", { class: "su-year" }, ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", autocomplete: "off", maxlength: "4", value: value === "" || value === null || value === undefined ? "" : String(value), placeholder: "", "aria-label": label, onInput: (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4); onValue(e.target.value); } }));
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

  /**
   * The other way to answer the spending question: "I know what's left over" (the owner, 2026-11-07). Spending and the left-over
   * are one fact said two ways; typing the left-over works the spending out so that the left-over then reads exactly that
   * (compute.js solveSpend / applyLeftOver), into the same rows the question writes, leaving typed groups alone.
   * `v` is the screen's draft (v.way "spend" | "left", v.left the text in the box); `guess` is ctx.guess or null (a plan with no
   * guesses writes one rough total). `typedRows` says whether the screen still holds groups typed by hand, for the question
   * "which is right?". Returns the choice tiles, the left-over part, and what the screen needs to read: result(), conflict().
   */
  const leftWay = (v, { guess = null, onChange = () => {}, onKeepSpend = () => {}, onClearTyped = () => {}, hasTyped = () => false } = {}) => {
    const hasPay = (plan.income ?? []).length > 0;
    let res = null, timer = null, grey = null, greyDone = false;
    const answered = spendAnswered(plan);
    // pay or bills moved since the left-over was given: the box starts on what it reads now, and Continue keeps the spending as it is
    let moved = null;
    if (v.leftOver !== undefined && v.left === String(v.leftOver)) { const cur = leftReading(plan, today); if (cur !== null && Math.abs(cur - Number(v.leftOver)) >= 10) { moved = { from: Number(v.leftOver), to: cur }; v.left = String(cur); } }
    const out = ui.h("div", { class: "su-left-out", "aria-live": "polite" });
    const part = ui.h("div", { class: "su-way-left" });
    const forGuess = () => ({ ...v, mode: "rows", sum: "" });
    const greyFor = () => {
      if (!greyDone) { greyDone = true; const x = hasPay ? leftOverGuess(plan, forGuess(), today, guess) : null; grey = x === null ? null : Math.round(x / 10) * 10; }
      return grey;
    };
    const recompute = () => {
      clearTimeout(timer); timer = null;
      const n = parseMoney(v.left);
      res = n === null || !hasPay ? null : solveSpend(plan, forGuess(), { left: n }, { today, guess });
      draw(); onChange();
    };
    const schedule = () => { clearTimeout(timer); res = null; timer = setTimeout(recompute, 220); };
    const box = moneyIn(v.left, (val) => { v.left = val; if (moved && val.replace(/,/g, "") !== String(moved.to)) moved = null; schedule(); }, { signed: true });
    const input = box.querySelector("input");
    const sure = ui.h("button", { type: "button", class: "secondary su-notsure", onClick: () => { v.left = ""; input.value = ""; moved = null; recompute(); input.focus({ preventScroll: true }); } }, "Not sure");
    const say = (txt) => ui.h("p", { class: "su-sub" }, txt);
    const draw = () => {
      const n = parseMoney(v.left);
      if (!hasPay) { swap(out, say("Add your pay first (question 2), then we can work this out.")); return; }
      if (n === null) {
        const g = greyFor();
        swap(out, say(answered ? "Not sure? Leave it blank and we keep the spending you already gave."
          : g === null ? "Not sure? Tap Not sure and we'll use a typical month for people like you."
          : g < 0 ? `Not sure? Tap Not sure and we'll use a typical month, which would leave you about ${money(-g)} short each month.`
          : `Not sure? Tap Not sure and we'll use a typical month: about ${money(g)} left over.`));
        return;
      }
      if (!res) { swap(out, say("Working it out…")); return; }
      if (res.ok) {
        const goals = Number(res.spare?.goalSaving) || 0, yearly = res.spare ? yearSavingWords(res.spare, money) : "";
        const goalLine = goals >= 1 ? ` Of the ${money(n)}, your goals take ${money(goals)} a month, so ${n - goals >= 0 ? `${money(n - goals)} is left` : `${money(goals - n)} comes from savings`} after them.` : "";
        swap(out, ui.h("div", {},
          moved ? say(`Your pay or bills have changed since you said ${money(moved.from)}. It now reads ${money(moved.to)}. Continue keeps your spending as it is.`) : null,
          say(`That means you spend about ${money(res.month)} a month in all${res.others > 0.5 ? `, loan payments and bills already in your plan included` : ""}.${goalLine} ${yearly}`)));
        return;
      }
      const left = n < 0 ? "that" : `a ${money(n)} left over`;
      if (res.why === "typed") swap(out, ui.h("div", {}, ui.notice("warn", `What you typed in the groups below, ${money(res.allowed + res.over)} a month, is more than ${left} allows. With that left over, your groups can add up to at most ${money(Math.max(0, res.allowed))} a month. Which is right?`),
        ui.h("div", { class: "su-pair" }, ui.h("button", { type: "button", class: "secondary", onClick: onKeepSpend }, "My groups are right"), ui.h("button", { type: "button", class: "secondary", onClick: () => { onClearTyped(); recompute(); } }, "What's left over is right"))));
      else if (res.why === "bills") swap(out, ui.h("div", {}, ui.notice("warn", `Your bills and loan payments already in your plan come to ${money(res.over)} a month more than ${left} allows. Which is right?`),
        ui.h("div", { class: "su-pair" }, ui.h("button", { type: "button", class: "secondary", onClick: onKeepSpend }, "My bills are right"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "See my bills ›"))));
      else if (res.why === "more-than-pay") swap(out, ui.notice("warn", res.available > 0 ? `That is more than comes in after tax and saving (about ${money(res.available)} a month). Check the amount.` : "That is more than comes in after tax and saving. Check the amount, or add what comes in first."));
      else if (res.why === "step") swap(out, ui.notice("warn", "We could not match that exact amount. Try a figure a few dollars higher or lower."));
      else swap(out, ui.notice("warn", "We need your pay and bills first to work this out."));
    };
    const label = "How much does your checking go up in a normal month, before you move any to savings?";
    add(part, field(label, box, "Type a minus sign if it usually goes down, like -200. Not counting what comes out of your paycheck for retirement, or any extra you pay on debts."), ui.h("p", { class: "su-notsure" }, sure), out);
    const g0 = () => { const g = greyFor(); if (g !== null) { input.placeholder = groupDigits(String(Math.abs(g)), true).replace(/^/, g < 0 ? "-" : ""); } };
    return {
      part, input,
      show: () => { g0(); recompute(); },
      result: () => res,
      // the answer now, from the screen as it stands (a tap on Continue within a moment of typing, or a group typed since)
      flush: () => { recompute(); return res; },
      touch: () => { if (parseMoney(v.left) !== null) schedule(); },
      conflict: () => parseMoney(v.left) !== null && (!hasPay || (!!res && !res.ok)),
    };
  };

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
    if (id === "owe") { if (picks(plan, "owe").includes("none")) return "Debt-free"; const r = reflect(plan, "owe-amounts"); return r?.kind === "owe" ? `${money(r.total)} owed` : r?.kind === "paid-in-full" ? "Cards paid in full each month" : none; }
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
      else add(btns, ui.h("button", { type: "button", onClick: () => { if (wouldChange(plan, (d) => atScreen(d, "you", today))) store.update((d) => atScreen(d, "you", today)); go("you"); } }, "Let's go"));
      add(card, btns);
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
      head("💵", ad.length > 1 ? "What comes in for each of you?" : "What comes in?", "Tap the one that fits you. Amounts are before tax.");
      const v = draft(() => valuesFor(plan, "money", { today }));
      const tileEls = {};   // person id -> their three tiles, for the "nothing picked" question
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
              // a How often tapped answers the low-pay question: it goes (F8)
              fieldset("How often", seg(PAY_PERIODS, x.period, (val) => { x.period = val; showMo(); card.querySelector(".su-ask")?.remove(); warnedPay = null; }, named(p, "how often") ?? "How often")), live,
              by === "employer" ? planQ() : null);
            showMo();
            return;
          }
          swap(body, x.status === "retired" ? field("A pension a month, if any", moneyIn(x.pension, (val) => { x.pension = val; }, { label: named(p, "pension a month") }), "Social Security comes on the next question. Leave this blank if there is no pension.")
            : x.status === "none" ? ui.h("p", { class: "su-sub" }, "Nothing counted for now. You can add pay any time on Income.") : "");
        };
        const tilesEl = tileGroup(named(p, "work") ?? "Work", STATUS, { cls: " three", radio: true, isOn: (o) => x.status === o.key, onPick: (o) => { x.status = o.key; drawBody(); drawTax(); } });
        tileEls[p.id] = tilesEl;
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
      // nothing picked at all: asked once, so a retired person is not asked next when she would like to stop working (R2)
      const check = (seen = new Set()) => { const out = [];
        const none = ad.find((p) => !v.people[p.id]?.status && !existingPay(plan, p.id).length);
        if (none) {
          const t = tileEls[none.id];
          { out.push({ text: `${ad.length > 1 ? `${none.name}: tap` : "Tap"} the one that fits: ${ad.length > 1 && none !== self ? "Works, Retired" : "I work, I'm retired"} or Not working now. Or tap Continue again to leave it for later.`, focus: t?.querySelector("button") ?? null }); }
        }
        for (const p of ad) {
          const x = v.people[p.id];
          if (x.status !== "work" || existingPay(plan, p.id).length) continue;
          const n = parseMoney(x.amount);
          if (n > 0 && perYear(n, x.period) < 15000) {
            const said = `${money(n)} ${PAY_PERIODS.find((k) => k.value === x.period)?.label.toLowerCase() ?? ""}`;
            // the answer is one tap in the notice: "It is $3,200 a month" sets A month and goes on (F8, OP-3)
            const monthly = x.period !== "monthly" ? [{ label: `It is ${money(n)} a month`, run: () => { x.period = "monthly"; warnedPay = null; forward(); } }] : [];
            { out.push({ text: `${said} is low for a job${ad.length > 1 ? ` (${p.name})` : ""}. If that's what comes in each month, tap "A month" under How often. Tap Continue again to keep it.`, choices: [...monthly, { label: `Yes, ${said}`, run: () => forward() }] }); }
          }
        }
        return out.find((a) => !seen.has(a.text)) ?? null;
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
      /** What is wrong with a typed year, in words, or null: fewer than four digits once the box is left (or at once with
       * four), a year still ahead, or before 1900. The home's "Year you bought it" box is the model. */
      // a Continue held on a bad year: its message goes once the year is fixed (layperson walk, 2026-11-11)
      const dropAsk = () => { const a = card.querySelector(".su-ask"); if (a && /year/i.test(a.textContent) && !/Continue again/.test(a.textContent) && !current?.block?.()) a.remove(); };
      const yearWords = (raw, { left: gone = true, born = true } = {}) => {
        const t = String(raw ?? "").trim();
        if (!t) return null;
        const y = Number(t);
        if (t.length < 4) return gone ? `We can't use ${t}. Type the year as four digits, like ${born ? "1985" : "2015"}.` : null;
        if (y > year) return `${t} is still ahead. Type the year ${born ? "you were born" : "they were born"}.`;
        if (y < 1900) return `We can't use ${t}. Type the year as four digits, like ${born ? "1985" : "2015"}.`;
        return null;
      };
      const yearBoxes = [];   // { input, get, who, ss? }: every year box on the screen, for Continue's check
      for (const p of ad) {
        const x = v.people[p.id];
        const retiredNow = plan.guide?.setup?.status?.[p.id] === "retired";
        const modeSaved = !!plan.guide?.setup?.ss?.[p.id];
        if (retiredNow) x.retired = true;
        if (retiredNow && x.ss.mode === "estimate") x.ss.mode = "getting";
        const liveAge = ui.h("p", { class: "su-live", "aria-live": "polite" });
        const stopBox = ui.h("div", {}), ssPick = ui.h("div", {}), ssBody = ui.h("div", {});
        let pickKey = null;
        // a year that cannot be used is said at the box as it is typed (four digits) or left (fewer), never dropped without a word
        // (stress test 2026-11-11, R3, OP-2, FF3, F5, F1); a right one shows the age
        let left = false;
        const showAge = () => { const a = ageOf(x), bad = yearWords(x.year, { left, born: true }); liveAge.textContent = bad ?? (a === null ? "" : `${a} years old`); liveAge.classList.toggle("su-bad", !!bad); if (!bad) dropAsk(); };
        const monthSel = ui.h("select", { class: "su-in", "aria-label": named(p, "birth month") ?? "Birth month", onChange: (e) => { x.month = e.target.value; showAge(); drawStop(); drawSS(); } }, ui.h("option", { value: "" }, "Month"), MONTHS.map((m, i) => ui.h("option", { value: String(i + 1), selected: Number(x.month) === i + 1 }, m)));
        const yearIn = ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", maxlength: "4", value: x.year ? String(x.year) : "", placeholder: "Year", "aria-label": named(p, "birth year") ?? "Birth year", onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); x.year = e.target.value; left = false; showAge(); if (e.target.value.length === 4) { drawStop(); drawSS(); } }, onBlur: () => { left = true; showAge(); } });
        yearBoxes.push({ input: yearIn, get: () => x.year, who: p, ss: () => ["getting", "statement"].includes(x.ss.mode) && !x.ss.record && parseMoney(x.ss.amount) > 0 });
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
            detail = ui.h("p", { class: "su-live", "aria-live": "polite" }, est === null ? (by >= 1900 ? "Needs your pay (question 2) to estimate." : "Type the birth year above to see it.") : ["About ", ui.h("b", {}, `${money(est)} a month`), ` from age ${fra.years}${fra.months ? ` and ${fra.months} months` : ""}, in today's dollars. A rough guide; your statement at ssa.gov is exact.`]);
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
      if (kids.length) add(card, group("Children's birth years", ui.h("div", { class: "su-born" }, ...kids.map((k) => {
        const line = ui.h("span", { class: "su-live su-bad", "aria-live": "polite" });
        let gone = false;
        const say = () => { const bad = yearWords(v.kids[k.id], { left: gone, born: false }); line.textContent = bad ?? ""; if (!bad) dropAsk(); };
        const input = ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", maxlength: "4", value: v.kids[k.id] ? String(v.kids[k.id]) : "", placeholder: "Year", onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); v.kids[k.id] = e.target.value; gone = false; say(); }, onBlur: () => { gone = true; say(); } });
        yearBoxes.push({ input, get: () => v.kids[k.id], who: k, kid: true });
        return ui.h("div", {}, field(k.name, input), line);
      }))));
      firstGroup();
      // Continue waits while a typed year cannot be used (an empty box still goes on: skipping stays allowed), and while a
      // Social Security amount is typed with no usable year, which the plan cannot count without it (R3: the amount was dropped)
      const block = () => {
        for (const b of yearBoxes) {
          const bad = yearWords(b.get(), { born: !b.kid });
          if (bad) return { text: `${b.kid ? `${b.who.name}: ` : ad.length > 1 ? `${b.who.name}: ` : ""}${bad}`, focus: b.input };
          if (b.ss?.() && !String(b.get() ?? "").trim()) return { text: `${ad.length > 1 ? `${b.who.name}: t` : "T"}ype the year ${ad.length > 1 ? "they were" : "you were"} born with four digits, like 1953. We need it to count the Social Security.`, focus: b.input };
        }
        return null;
      };
      // a year that makes someone over 105: asked once, as a slip (1900 for 1990)
      const check = (seen = new Set()) => { const out = [];
        for (const b of yearBoxes) {
          const y = Number(b.get());
          if (!b.kid && y >= 1900 && year - y > 105) { out.push({ text: `That would make ${ad.length > 1 ? b.who.name : "you"} ${year - y}. Check the year, or tap Continue again to keep it.`, focus: b.input }); }
        }
        return out.find((a) => !seen.has(a.text)) ?? null;
      };
      current = { apply: (d) => applyAges(d, v, today), block, check };
      actions();
    },

    have() {
      head("🏦", "What do you have?", "Tap all that apply. Amounts come next.");
      const v = draft(() => new Set(valuesFor(plan, "have")));
      // the $0 401(k) question 2's "Yes" made: said once, so nobody ticks Retirement only to record it (round 8)
      // (said for the Retirement tile as it stands on screen: ticked, the next screen asks what is in it; C4 verify V4)
      const workSaid = workPlanLine(plan, { ticked: v.has("retire") });
      const workLine = workSaid ? ui.h("p", { class: "su-have" }, workSaid) : null;
      add(card, tileGroup("What do you have?", HAVE, { isOn: (o) => v.has(o.key), onPick: (o) => { if (v.has(o.key)) v.delete(o.key); else v.add(o.key); if (o.key === "retire" && workLine) workLine.textContent = workPlanLine(plan, { ticked: v.has("retire") }); }, isHave: (o) => askOwners(plan, o.key).length === 0 }),
        workLine, haveNote(HAVE.flatMap((h) => existingHave(plan, h.key)).map(accLine)));
      current = { apply: (d) => applyHavePicks(d, [...v]) };
      actions();
    },

    "have-amounts"() {
      // our guesses fill what is left blank (U.S. plans: core/estimate applies); elsewhere the boxes work as they did
      const guessing = applies(plan);
      head("🧮", "About how much is in each?", guessing ? "Today's balance or value. Round numbers are fine. Leave a box blank and we'll use the gray figure: what's typical for someone like you." : "Today's balance or value. Round numbers are fine; you can make them exact later.");
      const v = draft(() => valuesFor(plan, "have-amounts"));
      const shownMoney = (n) => groupDigits(String(Math.round(n)));
      const shownPct = (r) => String(Math.round(r * 1000) / 10);
      const isBlank = (x) => { const n = parseMoney(x); return n === null || n < 0; };
      // every box that can show a grey figure: re-run on each keystroke with what the screen holds (haveArgs), so the grey
      // figure is exactly what saving the blank box writes (spec 10)
      const greys = [];
      const lines = [];            // text lines that follow the answers (a share of pay in dollars, "Not sure" in words)
      const typoOpen = {};         // { [personId]: "no" } the slip question answered "no"
      const guessFor = (key, path, args) => { let g = null; if (guessing && key) { try { g = ctx.guess(key, { path, args }); } catch { g = null; } } return g && typeof g.value === "number" ? g : null; };
      const greyField = (label, control, cfg) => {
        const input = control.querySelector("input"), sub = ui.h("span", { class: "su-sub", id: `su-h-${++uid}` });
        input.setAttribute("aria-describedby", sub.id);
        greys.push({ ...cfg, input, sub, label: cfg.aria ?? label });
        return ui.h("div", { class: "su-field" }, ui.h("label", {}, ui.h("span", { class: "su-label" }, label), control), sub);
      };
      const tapWrap = ui.h("div", { hidden: true });
      const putFold = (pid, p, ...boxes) => {
        // said No to a plan at work: the match is "0" and "none" from that answer, not typed here, so only dollars put in count (UX 5)
        const noPlan = plan.retirement?.workPlans?.[pid]?.plan === false;
        const typedIn = noPlan ? String(v[`contrib-${pid}`] ?? "").trim() !== "" : ["contrib", "match"].some((k) => String(v[`${k}-${pid}`] ?? "").trim() !== "") || (v[`pct-${pid}`] !== null && v[`pct-${pid}`] !== undefined) || (v[`matchMode-${pid}`] ?? null) !== null;
        const f = ui.h("details", { class: "fold su-fold" },
          ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What goes in, and the match"), ui.h("span", { class: "fold-status" }, "our guess"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")),
          ui.h("div", { class: "fold-body" }, ...boxes));
        f.open = typedIn;
        return f;
      };
      const jointLine = ui.h("p", { class: "su-sub", role: "status", hidden: true });
      let tapQ = null;
      const refresh = () => {
        const args = haveArgs(plan, v, today);
        let ask = null;
        const shares = {};
        const nameOf = (id) => { const x = ad.find((a) => a.id === id); return x ? (x.name === "Me" ? "You" : x.name) : ""; };
        const hintFor = (a, id) => (tapQ && !v.joint && a.retire[id] > 0 ? "Is it yours alone or both of yours? Answer just below this box." : "");
        for (const b of greys) {
          const blank = b.blank(args), g = blank ? guessFor(b.key(args), b.path(), args) : null;
          const shown = g ? (b.year ? String(g.value) : b.pct ? shownPct(g.value) : shownMoney(g.value)) : "";
          b.input.placeholder = shown;
          b.input.setAttribute("aria-label", `${b.label}${shown ? `, leave blank to use our guess of ${b.year ? shown : `about ${b.pct ? `${shown}%` : `${symbol}${shown}`}`}` : ""}`);
          b.sub.textContent = shown ? [b.year ? `Our guess: ${shown}. ${g.why}` : `Our guess: ${g.why}.`, b.help].filter(Boolean).join(" ") : b.help ?? "";
          if (b.year && String(v.bought ?? "").length === 4 && parseYear(v.bought, thisYear) === null) b.sub.textContent = `We can't use ${v.bought}. Type the year as four digits between 1950 and ${thisYear}, like 2019, or leave it blank.`;
          if (g?.ask && b.retire) ask = g.ask;
          if (b.retire && g && args.joint) shares[b.pid] = g.value;
          // the box typed in, while the couple's question is open: say where the answer is (the question sits below both people's boxes)
          if (b.retire && b.pid !== undefined && !blank) b.sub.textContent = [b.sub.textContent, hintFor(args, b.pid)].filter(Boolean).join(" ");
        }
        // "Both of ours": the one figure typed, and what each box now holds (the plan holds the split, the typed box still shows the total)
        if (args.joint) {
          const others = Object.entries(shares).filter(([id]) => id !== args.joint.pid).reduce((t, [, x]) => t + x, 0);
          shares[args.joint.pid] = args.joint.total - others;
          jointLine.textContent = `Your ${money(args.joint.total)} is split by pay: ${Object.entries(shares).map(([id, x]) => `${nameOf(id)} ${money(x)}`).join(", ")}. Change either box if you know better.`;
          jointLine.hidden = false;
        } else jointLine.hidden = true;
        // answered before (Back to this screen): the question is asked of E12 again without the answer, so the tap stays on screen
        if (!ask && v.joint) { const open = { ...args }; delete open.joint; for (const b of greys) if (b.retire && b.blank(args)) { const g = guessFor("account.retire.balance", b.path(), open); if (g?.ask) ask = g.ask; } }
        for (const f of lines) f(args);
        // the couple's one tap: shown once one box is typed and the other empty, kept while it has an answer
        const pids = Object.keys(args.retire), one = pids.length === 2 && pids.filter((p) => args.retire[p] > 0).length === 1 && pids.filter((p) => args.retire[p] === null).length === 1;
        if (ask && ask.question !== tapQ) { tapQ = ask.question; swap(tapWrap, fieldset(ask.question, seg(ask.options, v.joint ?? null, (val) => { v.joint = val; refresh(); }, ask.question), "Tell us and we'll share it out by pay. Not sure? We count it as one person's.")); }
        // the question sits right under the box that was typed in, not at the bottom of the page
        if (one && tapQ) { const typed = greys.find((b) => b.retire && b.pid !== undefined && args.retire[b.pid] > 0); const at = typed?.input.closest(".su-field"); if (at && at.nextSibling !== tapWrap) at.after(tapWrap, jointLine); tapWrap.hidden = false; }
        else { tapWrap.hidden = true; tapQ = null; delete v.joint; }
      };
      for (const h of HAVE.filter((x) => haveKeys(plan).includes(x.key))) {
        for (const pid of askOwners(plan, h.key)) {
          if (!h.perAdult) {
            const label = h.key === "home" ? "Your home" : h.key === "car" ? "Your car" : h.label;
            const id = haveId(h.key);
            const cashKey = h.key === "checking" || h.key === "savings";
            add(card, group(null, greyField(`${h.icon} ${label}`, moneyIn(v[h.key], (val) => { v[h.key] = val; refresh(); }, { label }), {
              key: () => ({ checking: "account.cash", savings: "account.cash", invest: "account.invest.balance", home: "home.value", car: "account.car.value" })[h.key],
              path: () => `accounts[${id}].balance`, blank: (a) => (cashKey ? a[h.key] === null : isBlank(v[h.key])),
              help: h.ask ? `${h.ask}${/[.!?]$/.test(h.ask) ? "" : "."}` : null, aria: label,
            })));
            // the year it was bought (home only): the grey guess is the usual year for an owner this age; it sharpens the mortgage
            if (h.key === "home") add(card, group(null, greyField("🗓️ Year you bought it", yearIn(v.bought, (val) => { v.bought = val; refresh(); }, "Year you bought your home"), {
              key: () => "home.boughtYear", path: () => null, year: true, blank: () => parseYear(v.bought, thisYear) === null,
              help: "Optional. It helps us work out your loan.", aria: "Year you bought your home",
            })));
            continue;
          }
          const p = ad.find((x) => x.id === pid);
          const extra = ui.h("div", {});
          // paid by their own business: no employer, so no pay stub (review 2026-11-02)
          const ownBiz = payLineNow(plan.income ?? [], pid, today)?.type === "business";
          // which kind of IRA, right under "Where" (round 8): one tap, or none (then as before: an IRA, or the Roth set on Net worth)
          const rk = retireKindsFor(plan, pid);
          const iraBox = ui.h("div", {});
          const drawIra = () => swap(iraBox, v[`kind-${pid}`] === "own" ? fieldset("Which kind of IRA?", seg(IRA_KINDS, v[`iraKind-${pid}`] ?? null, (val) => { v[`iraKind-${pid}`] = val; }, named(p, "which kind of IRA") ?? "Which kind of IRA?"), iraKindHelp(ownBiz)) : "");
          drawIra();
          const q2 = workPlanAcct(plan, pid), balId = () => (v[`kind-${pid}`] !== "own" && q2 ? q2.id : haveId(h.key, pid));
          const payYear = employerPay(plan, pid, today);
          const cpath = `retirement.contributions[setup-contrib-${pid}].amount`, mpath = `retirement.contributions[setup-contrib-${pid}].employerMatch`;
          const works = () => v[`kind-${pid}`] !== "own" && payYear > 0 && plan.retirement?.workPlans?.[pid]?.plan !== false;
          // what goes in: a share of pay (chips), or dollars; blank (Not sure) is our guess
          const modeOf = () => { const pct = v[`pct-${pid}`]; return pct === null || pct === undefined ? (parseMoney(v[`contrib-${pid}`]) !== null ? "dollars" : "unsure") : pct === 0 ? "0" : SAVING_CHIPS.includes(pct) ? String(pct) : "other"; };
          let putMode = modeOf(), matchMode = v[`matchMode-${pid}`] ?? "unsure";
          const putBox = ui.h("div", {}), matchBox = ui.h("div", {});
          const setPct = (pct) => { v[`pct-${pid}`] = pct; v[`contrib-${pid}`] = pct === null ? "" : pct === 0 ? "0" : String(pctToMonthly(pct, payYear)); };
          const putLine = ui.h("span", { class: "su-live", "aria-live": "polite" });
          const typoBox = ui.h("div", {});
          lines.push((args) => {
            const pct = v[`pct-${pid}`];
            if (!works()) return;
            if (putMode === "unsure" || (putMode === "other" && pct === null)) {
              const g = guessFor("contrib.amount", cpath, args);
              putLine.textContent = !g ? "" : g.value > 0 ? `Not sure? We'll count ${money(g.value)} a month. Our guess: ${g.why}.` : `Not sure? We'll count nothing yet. Our guess: ${g.why}.`;
            } else if (pct === 0) putLine.textContent = "Nothing goes in from your pay.";
            else if (pct > 0) putLine.textContent = `${shownPct(pct)}% of your pay is ${money(pctToMonthly(pct, payYear))} a month.`;
            else putLine.textContent = "";
            // the slip question: "5" in the dollars box, meant as 5% of pay
            const t = putMode === "dollars" ? parseMoney(v[`contrib-${pid}`]) : null;
            const g2 = t > 0 && t <= 100 ? guessFor("contrib.amount", cpath, { ...args, contrib: { ...args.contrib, [pid]: null } }) : null;
            const slip = g2 && typoOpen[pid] !== "no" ? typoCheck(t, { value: g2.value, sigma: g2.sigma }, [{ id: "pct-of-pay", map: (x) => x / 100 * payYear / 12, words: (x, m) => `Did you mean ${x}% of your pay, about ${money(Math.round(m / 10) * 10)} a month?` }]) : null;
            if (slip) {
              if (typoBox.dataset.t !== String(t)) {
                typoBox.dataset.t = String(t);
                swap(typoBox, ui.h("p", { class: "su-sub", role: "status" }, `${slip.words} ${money(t)} a month is a very small amount.`),
                  ui.h("div", { class: "su-seg" },
                    ui.h("button", { type: "button", onClick: () => { setPct(t / 100); putMode = "other"; typoBox.dataset.t = ""; swap(typoBox); drawPut(); refresh(); } }, `Yes, ${t}% of my pay`),
                    ui.h("button", { type: "button", onClick: () => { typoOpen[pid] = "no"; typoBox.dataset.t = ""; swap(typoBox); } }, `No, ${money(t)} a month`)));
              }
              typoBox.dataset.words = slip.words;
            } else { typoBox.dataset.t = ""; typoBox.dataset.words = ""; swap(typoBox); }
          });
          const drawPut = () => {
            if (!works()) {
              const moneyBox = moneyIn(v[`contrib-${pid}`], (val) => { v[`contrib-${pid}`] = val; v[`pct-${pid}`] = null; refresh(); }, { label: named(p, "put in a month") });
              swap(putBox, greyField("You put in a month", moneyBox, { key: () => null, path: () => cpath, blank: () => false, help: v[`kind-${pid}`] === "own" ? "Into your IRA, if you save. Leave it blank if not." : "From pay, if you save. Leave it blank if not." }));
              return;
            }
            const opts = [{ value: "0", label: "None" }, ...SAVING_CHIPS.filter((x) => x > 0).map((x) => ({ value: String(x), label: `${shownPct(x)}%` })), { value: "other", label: "Other" }, { value: "unsure", label: "Not sure" }];
            const chips = fieldset("What you put in from your pay", seg(opts, putMode === "dollars" ? null : putMode, (val) => {
              putMode = val;
              if (val === "unsure") setPct(null); else if (val === "other") { if (v[`pct-${pid}`] === null || v[`pct-${pid}`] === undefined || SAVING_CHIPS.includes(v[`pct-${pid}`])) setPct(null); } else setPct(Number(val));
              drawPut(); refresh();
            }, named(p, "what you put in from your pay") ?? "What you put in from your pay"), "A share of your pay, taken before you see it. Not sure? We'll use what people your age and pay usually put in.");
            const pctBad = ui.h("p", { class: "su-sub", role: "alert", "data-words": "" });
            const other = putMode === "other" ? field("Share of your pay", pctIn(v[`pct-${pid}`] === null || v[`pct-${pid}`] === undefined ? "" : shownPct(v[`pct-${pid}`]), (val) => { const r = readShareOfPay(val); if (r.pct !== undefined) setPct(r.pct); else setPct(null); pctBad.textContent = r.bad ? `${r.bad} We'll use our guess unless you fix it.` : ""; pctBad.dataset.words = r.bad ? r.bad : ""; refresh(); }, named(p, "share of your pay") ?? "Share of your pay", ""), null) : null;
            const dollars = putMode === "dollars" ? greyField("A month, in dollars", moneyIn(v[`contrib-${pid}`], (val) => { v[`contrib-${pid}`] = val; v[`pct-${pid}`] = null; refresh(); }, { label: named(p, "put in a month, in dollars") }), { key: () => "contrib.amount", path: () => cpath, blank: (a) => a.contrib[pid] === null, help: "What leaves your pay each month." }) : null;
            const swapMode = ui.h("p", { class: "su-sub", style: "margin-bottom:16px" }, ui.h("button", { type: "button", class: "btn secondary small", onClick: () => { if (putMode === "dollars") { putMode = "unsure"; setPct(null); } else { putMode = "dollars"; v[`pct-${pid}`] = null; } drawPut(); refresh(); } }, putMode === "dollars" ? "Use a share of pay instead" : "A dollar amount a month instead"));
            swap(putBox, chips, other, other ? pctBad : null, dollars, putLine, typoBox, swapMode);
          };
          const drawMatch = () => {
            if (!works()) {
              // (nothing to ask for the employer's share of a plan they said they have not got)
              swap(matchBox, v[`kind-${pid}`] === "own" || plan.retirement?.workPlans?.[pid]?.plan === false ? "" : field(ownBiz ? "Your business adds a month" : "Your employer adds a month", moneyIn(v[`match-${pid}`], (val) => { v[`match-${pid}`] = val; }, { label: named(p, ownBiz ? "business adds a month" : "employer adds a month") }), ownBiz ? "What the business puts in on top, in a solo 401(k). Leave it blank if none." : "The match, if there is one. It's on your pay stub."));
              return;
            }
            const mline = ui.h("span", { class: "su-live", "aria-live": "polite" });
            lines.push((args) => { if (!mline.isConnected) return; if (matchMode !== "unsure") { mline.textContent = matchMode === "none" ? "Your employer adds nothing to what you put in." : ""; return; } const g = guessFor("contrib.match", mpath, args); mline.textContent = g ? (g.value > 0 ? `Not sure? We'll count about ${money(g.value / 12)} a month. Our guess: ${g.why}.` : `Not sure? We'll count nothing yet. Our guess: ${g.why}.`) : ""; });
            swap(matchBox, fieldset(ownBiz ? "What your business adds" : "What your employer adds", seg([{ value: "unsure", label: "Not sure (about 4%)" }, { value: "none", label: "No match" }, { value: "know", label: "I know it" }], matchMode, (val) => {
              matchMode = val; v[`matchMode-${pid}`] = val === "unsure" ? null : val;
              if (val === "unsure") v[`match-${pid}`] = ""; else if (val === "none") v[`match-${pid}`] = "0";
              drawMatch(); refresh();
            }, named(p, "what your employer adds") ?? "What your employer adds"), "Free money some employers add when you save. It's on your pay stub or benefits site."),
              matchMode === "know" ? field("A month", moneyIn(v[`match-${pid}`] === "0" ? "" : v[`match-${pid}`], (val) => { v[`match-${pid}`] = val; refresh(); }, { label: named(p, "employer adds a month") }), "What the employer adds each month, on top of yours.") : null, mline);
          };
          const drawExtra = () => { drawPut(); drawMatch(); };
          drawExtra();
          const balCfg = { pid, key: () => (haveArgs(plan, v, today).joint ? "account.retire.split" : v[`kind-${pid}`] === "own" ? "account.ira.balance" : "account.retire.balance"), path: () => `accounts[${balId()}].balance`, blank: (a) => a.retire[pid] === null, help: "Add up every account of that kind.", retire: true };
          add(card, group(`${h.icon} ${ad.length > 1 ? `${possessive(p)} retirement savings` : "Retirement savings"}`,
            fieldset(rk.label, seg(rk.kinds, v[`kind-${pid}`], (val) => { v[`kind-${pid}`] = val; drawIra(); drawExtra(); refresh(); }, named(p, "retirement through work or on your own") ?? "Retirement through work or on your own"), ad.length > 1 && ad[0].id !== pid ? null : rk.help ? rk.help : ownBiz ? "Your own business: an IRA, a SEP-IRA or a solo 401(k) all count as on your own; a solo 401(k) that your business adds to can go under Through work." : "Through work: a 401(k) or 403(b). On your own: an IRA. Not sure? We'll count it as through work."),
            rk.iraFold ? ui.h("details", { class: "fold su-fold", style: "margin-bottom:16px" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Is it a Roth IRA?"), ui.h("span", { class: "fold-status" }, "optional"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")), ui.h("div", { class: "fold-body" }, iraBox)) : iraBox,
            greyField("Saved so far", moneyIn(v[`${h.key}-${pid}`], (val) => { v[`${h.key}-${pid}`] = val; refresh(); }, { label: named(p, "retirement saved so far") }), { ...balCfg, aria: named(p, "retirement saved so far") ?? "Retirement saved so far" }),
            // a couple: what goes in a month and the match are folded until needed (open when something is typed in them), so the
            // page is not two long forms and the one-tap question sits right under the box that triggers it (follow-up F6)
            !rk.putIn ? null : ad.length > 1 ? putFold(pid, p, putBox, matchBox) : putBox, !rk.putIn || ad.length > 1 ? null : matchBox));
        }
      }
      add(card, tapWrap, jointLine);
      firstGroup();
      refresh();
      const guessOpt = guessing ? { guess: ctx.guess } : {};
      const words = (p2) => {
        const r = reflect(p2, "have-amounts");
        if (!r) return null;
        if (!r.guessed) return `Got it: ${money(r.total)} saved and invested in all.`;
        return `Got it: about ${money(about(r.total))} saved and invested in all. ${r.guessed === r.of ? (r.of === 1 ? "It is our guess" : r.of === 2 ? "Both are our guesses" : `All ${r.of} are our guesses`) : `${r.guessed} of the ${r.of} are our guesses`} for now.`;
      };
      // a slip in the dollars box ("5" meant as 5% of pay) holds Continue once, as the spending screen does
      const check = () => { for (const t of card.querySelectorAll("[data-words]")) if (t.dataset.words) return t.dataset.words; return null; };
      current = { apply: (d) => applyHaveAmounts(d, v, today, guessOpt), words, check };
      actions("Continue", guessing ? { skipLabel: "Skip: use our guesses", onSkip: () => { current = { apply: (d) => applyHaveAmounts(d, v, today, guessOpt), words }; forward(); } } : {});
    },

    owe() {
      head("🧾", "Do you owe money on anything?", allRetired(plan) ? "Tap all that apply; it helps the plan put things in the right order." : "Tap all that apply. Most people do; it helps the plan put things in the right order.");
      const v = draft(() => new Set(valuesFor(plan, "owe")));
      const opts = [...OWE, { key: "none", icon: "🎉", label: "No, I'm debt-free", wide: true }];
      add(card, tileGroup("Do you owe money on anything?", opts, {
        isOn: (o) => v.has(o.key),
        isHave: (o) => o.key !== "none" && oweTaken(plan, o.key),
        onPick: (o) => {
          if (o.key === "none") { const on = !v.has("none"), had = v.size > 0 && !v.has("none"); v.clear(); if (on) v.add("none"); if (on && had) ctx.announce?.("Other picks cleared"); return; }
          v.delete("none"); if (v.has(o.key)) v.delete(o.key); else v.add(o.key);
        },
      }), haveNote(OWE.flatMap((o) => existingOwe(plan, o.key)).filter((a, i, all) => all.indexOf(a) === i).map(accLine)));
      // "No, I'm debt-free" takes "Paying off debt" out of the goals picked before (breaker 2026-11-11; compute.js waits for left2)
      current = { apply: (d) => { const r = applyOwePicks(d, [...v]); if (v.has("none") && picks(d, "goals").includes("debt")) applyGoalPicks(d, picks(d, "goals").filter((k) => k !== "debt")); return r; }, words: (p2) => (reflect(p2, "owe")?.kind === "debt-free" ? "Debt-free: that makes everything easier." : null) };
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
          // more than one of a kind goes in together, said so the second car or loan has a place (stress test 2026-11-11, F7)
          owed: o.key === "credit" ? "All your cards together." : o.key === "car-loan" ? "More than one car loan? Add them together here, with the rate of the bigger one. You can split them later on Net worth."
            : o.key === "student" ? "More than one student loan? Add them together here, with the rate of the bigger one. You can split them later on Net worth."
            : o.key === "loan" ? "More than one? Add them together here, with the rate of the bigger one. You can split them later on Net worth." : null,
          rate: guessing ? "It's on your statement." : `Blank: a typical ${pctOf(TYPICAL_RATES[o.key])} for now${o.key === "mortgage" ? " (today's rate; an older loan may cost less)" : ""}.`,
          home: "So what you own counts beside what you owe.",
          bought: "Optional. It helps us work out your loan.",
        };
        const labels = { payment: `${o.label}: paid a month`, owed: `${o.label}: still owed`, rate: `${o.label}: interest rate a year`, home: "What your home would sell for today", bought: "Year you bought your home" };
        const keyOf = { payment: `debt.${o.key}.payment`, owed: `debt.${o.key}.owed`, rate: `debt.${o.key}.rate`, home: "home.value", bought: "home.boughtYear" };
        const pathOf = { payment: `debts[setup-debt-${o.key}].minPayment`, owed: `accounts[setup-owe-${o.key}].balance`, rate: `debts[setup-debt-${o.key}].rate`, home: "accounts[setup-have-home].balance", bought: null };
        const boxes = {};
        const box = (k, control) => { const input = control.querySelector("input"); boxes[k] = { input }; return control; };
        const sub = (k) => { const el = ui.h("span", { class: "su-sub" }); boxes[k].sub = el; return el; };
        const fieldWith = (label, k, control) => { box(k, control); const el = sub(k); const id = `su-h-${++uid}`; el.id = id; boxes[k].input.setAttribute("aria-describedby", id); return ui.h("div", { class: "su-field" }, ui.h("label", {}, ui.h("span", { class: "su-label" }, label), control), el); };
        // the tap: shown once our guess of what is still owed says it would sharpen it, and kept while it has an answer
        const tapWrap = ui.h("div", { hidden: true });
        let tapBuilt = false;
        const refresh = () => {
          const args = oweArgs(plan, x, o.key, { askHome, today });
          for (const k of Object.keys(boxes)) {
            const b = boxes[k], blank = args[k] === null;
            const g = guessing && blank ? ctx.guess(keyOf[k], { path: pathOf[k], args }) : null;
            const shown = g && g.value !== null ? (k === "bought" ? String(g.value) : k === "rate" ? shownPct(g.value) : shownMoney(g.value)) : "";
            b.input.placeholder = shown;
            b.input.setAttribute("aria-label", `${labels[k]}${shown ? `, leave blank to use our guess of ${k === "bought" ? shown : `about ${k === "rate" ? `${shown}%` : `${symbol}${shown}`}`}` : ""}`);
            if (k === "bought" && String(x.bought ?? "").length === 4 && parseYear(x.bought, thisYear) === null) { b.sub.textContent = `We can't use ${x.bought}. Type the year as four digits between 1950 and ${thisYear}, like 2019, or leave it blank.`; continue; }
            // the guess, then the field's own help (spec 9.3): where to find it stays on screen while our figure shows
            b.sub.textContent = shown ? [k === "bought" ? `Our guess: ${shown}. ${g.why}` : `Our guess: ${g.why}.`, helpOf[k]].filter(Boolean).join(" ") : helpOf[k] ?? "";
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
        let yearOpen = false;
        // the year was asked at question 4 when the home was picked there: say what is counted instead of asking again
        const q4Asked = o.key === "mortgage" && haveKeys(plan).includes("home");
        const q4Year = o.key === "mortgage" && parseYear(x.bought, thisYear) !== null ? parseYear(x.bought, thisYear) : null;
        const q4Guess = q4Asked && q4Year === null ? ctx.guess("home.boughtYear", {}) : null;
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
            // the year the home was bought: the mortgage is worked from it when the payment and balance are blank
            // asked once: a year already given at question 4 is said, with a way to change it
            o.key === "mortgage" ? ((q4Year || (q4Asked && q4Guess?.value)) && !yearOpen
              ? ui.h("div", { class: "su-field" }, ui.h("p", { class: "su-sub" }, q4Year ? `You said you bought it in ${q4Year}.` : `Year you bought it: ${q4Guess.value}, our guess.`), ui.h("button", { type: "button", class: "btn secondary small", onClick: () => { yearOpen = true; draw(); } }, "Change the year"))
              : fieldWith("🗓️ Year you bought your home", "bought", yearIn(x.bought, (val) => { x.bought = val; refresh(); }, labels.bought))) : null,
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
          o.key === "credit" ? fieldset("Do you pay the whole bill every month?", seg([{ value: "yes", label: "Yes, every month" }, { value: "no", label: "No, I carry a balance" }], x.paidInFull ? "yes" : x.owed !== "" || x.payment !== "" ? "no" : null, (val) => { x.paidInFull = val === "yes"; draw(); }, "Do you pay the whole card bill every month?")) : null,
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
      // a rate over 40% a year is most often a slip of the decimal point (69 for 6.9): asked once (F5)
      const check = () => {
        for (const o of picked) {
          const r = Number(String(v[o.key]?.rate ?? "").trim());
          if (String(v[o.key]?.rate ?? "").trim() && r > 40 && !(o.key === "credit" && v[o.key]?.paidInFull)) {
            const near = Math.round(r) / 10;
            return { text: `${r}% a year on ${o.key === "credit" ? "your cards" : o.key === "student" ? "your student loans" : `the ${o.name.toLowerCase()}`}? ${r < 1000 ? `Did you mean ${near}%? ` : ""}Continue keeps what you typed.`, focus: card.querySelector(`[aria-label^="${o.label}: interest rate"]`) };
          }
        }
        return null;
      };
      current = { apply: (d) => applyOweAmounts(d, v, today, guessOpt), words, check };
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
        const leftRes = v.way === "left" ? lw.result() : null;
        if (leftRes?.ok) { totalEl.textContent = money(leftRes.month); partsEl.textContent = `worked out from the ${money(parseMoney(v.left))} you said is left over`; }
        totalEl.parentElement.hidden = partsEl.hidden = !!leftRes && !leftRes.ok;   // (two answers at odds: no total until one is chosen)
        if (laterInput && !later.typed) {
          const core = base.existingCore + (v.mode === "total" ? num(v.total) : rows.filter((s) => s.key !== "childcare").reduce((t, s) => t + num(v.rows[s.key]), 0)) + loansLater;
          laterInput.value = core > 0 ? groupDigits(String(Math.round(core / 10) * 10)) : "";
          later.value = laterInput.value;
        }
      };
      const row = (s) => {
        const hw = s.key === "housing" ? housingWords(plan) : null, name = hw ? hw.label : s.label, help = hw ? hw.help : s.help;
        const box = moneyIn(v.rows[s.key], (val) => { v.rows[s.key] = val; lw?.touch(); upd(); });
        const input = box.querySelector("input"), id = `su-i-${++uid}`;
        input.id = id;
        return ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("label", { class: "su-label", for: id }, name), describe(input, help)), box);
      };
      // the other way to say it: what is left over each month (the plan has no guesses here, so it writes one rough total)
      v.way = v.way ?? (v.leftOver !== undefined ? "left" : "spend");
      v.left = v.left ?? (v.leftOver !== undefined ? String(v.leftOver) : "");
      const plainPart = ui.h("div", { class: "su-way-spend" });
      let lw = null;
      lw = leftWay(v, { guess: null, onChange: () => upd(), onKeepSpend: () => { wayTiles.querySelector('[data-key="spend"]')?.click(); }, onClearTyped: () => { for (const k of Object.keys(v.rows)) v.rows[k] = ""; drawBody(); } });
      const showWay = () => { plainPart.hidden = v.way === "left"; lw.part.hidden = v.way !== "left"; if (v.way === "left") lw.show(); upd(); };
      const wayTiles = tileGroup("How to answer", [{ key: "spend", icon: "🧾", label: "I know roughly what I spend", line: "Add up what you pay" }, { key: "left", icon: "💰", label: "I know what's left over", line: "What stays in checking" }],
        { radio: true, isOn: (o) => o.key === v.way, onPick: (o) => { v.way = o.key; showWay(); } });
      const mode = tileGroup("How to answer", [{ key: "rows", icon: "📋", label: "A few groups", line: "Rent, food, car..." }, { key: "total", icon: "✏️", label: "One rough total", line: "If you're not sure" }],
        { radio: true, isOn: (o) => (o.key === "total") === (v.mode === "total"), onPick: (o) => { v.mode = o.key; drawBody(); } });
      const drawBody = () => {
        if (v.mode === "total") swap(body, field(base.existingCount ? "Everything else, in a month" : "All your spending in a month", moneyIn(v.total, (val) => { v.total = val; upd(); }), "Home, food, car, fun: everything. It counts as bills you have to pay, to be safe."));
        else {
          sums.must = ui.h("span", { class: "sum" }); sums.else = ui.h("span", { class: "sum" });
          const must = rows.filter((s) => s.group === "must"), other = rows.filter((s) => s.group === "else");
          const loanRow = base.loanPayments > 0 ? ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("span", { class: "su-label" }, "Loan and card payments"), ui.h("span", { class: "su-sub" }, "From question 5, already counted")), ui.h("span", { class: "su-fixed" }, money(base.loanPayments))) : null;
          swap(body,
            must.length || loanRow ? ui.h("div", { class: "su-group first" }, ui.h("div", { class: "su-gh" }, "Bills you have to pay", sums.must), ...must.map(row), loanRow) : null,
            other.length ? ui.h("div", { class: "su-group" }, ui.h("div", { class: "su-gh" }, "Everything else", sums.else), ...other.map(row)) : null,
            rows.length ? null : ui.h("p", { class: "su-sub" }, "Every kind of bill is already in your plan."));
        }
        upd();
      };
      add(plainPart, mode, body);
      add(card, wayTiles, lw.part, plainPart, ui.h("div", { class: "su-total" }, ui.h("span", {}, "In all, about a month"), totalEl), partsEl);
      if (!allRetired(plan)) {
        const box = moneyIn(later.value, (val) => { later.value = val; later.typed = true; });
        laterInput = box.querySelector("input");
        add(card, group(null, field("Once you stop working, about how much a month?", box, loansLater > 0
          ? `We start from today's spending without childcare, and keep the ${money(loansLater)} of loan payments still running then. Change it if you expect to spend more or less.`
          : "We start from today's spending without loan payments and childcare. Change it if you expect to spend more or less.")));
      }
      drawBody();
      showWay();
      const leftTyped = () => v.way === "left" && parseMoney(v.left) !== null;
      const answered0 = spendAnswered(plan);
      current = {
        apply: (d) => {
          // a left-over that cannot be worked out writes nothing (block() has already stopped Continue); our guesses never stand in for it
          if (leftTyped()) { applyLeftOver(d, { ...v, retireMonthly: later.value, retireAuto: !later.typed, left: v.left }, today); return; }
          if (v.way === "left" && answered0) return;   // left empty and the spending already given: kept as it is
          applySpend(d, { ...v, retireMonthly: later.value, retireAuto: !later.typed });
        },
        block: () => { if (!leftTyped()) return null; lw.flush(); return lw.conflict() ? leftStop(lw.result(), money) : null; },
        words: (p2) => { const r = reflect(p2, "spend"), note = leftTyped() ? leftMarker(p2) : null; if (r && note) return `Got it: with ${money(note.left)} left over each month, you spend about ${money(r.monthly)} a month.`; return r ? `Got it: about ${money(r.monthly)} a month, ${money(r.essential)} of it bills you must pay.` : null; },
      };
      actions();
    },

    // Q6 with our guesses (U.S. plans): each box shows its grey figure (core/estimate, spec 7.A), the group sums and the
    // total add them up with their parts, and a box left blank saves that figure as one of our guesses
    spend() {
      if (!applies(plan)) { UI.spendPlain(); return; }
      const v = draft(() => valuesFor(plan, "spend"));
      v.taps = v.taps ?? {};
      // one box first (part 3 of the path): "Your best guess for a normal month". A plan saved with "One rough total" reopens with
      // that figure in the box; the groups sit in a fold below, which opens by itself when the plan already has typed groups
      if (v.mode === "total") { v.sum = v.total; v.mode = "rows"; }
      v.sum = v.sum ?? "";
      v.mode = "rows";
      const base = spendBase(plan), rows = spendRows(plan), mortgage = hasMortgage(plan), loansLater = loansAfterWork(plan, today);
      head("🛒", "What do you spend in a typical month?", "A rough number is fine. Pick the way that is easiest for you.");
      if (base.existingCount) add(card, ui.h("p", { class: "su-have" }, "Already in your plan: ", ui.h("b", {}, `${money(base.existing)} a month`), ` in ${base.existingCount} bill${base.existingCount === 1 ? "" : "s"}. Add only what's missing.`));
      if (base.loanPayments > 0) add(card, ui.h("p", { class: "su-have" }, "Leave out loan and card payments: we already have them (", ui.h("b", {}, `${money(base.loanPayments)} a month`), ") and add them to the total below."));
      // two ways to say it (owner, 2026-11-07): what you spend, or what is left over in checking each month; either works the other out
      v.way = v.way ?? (v.leftOver !== undefined ? "left" : "spend");
      v.left = v.left ?? (v.leftOver !== undefined ? String(v.leftOver) : "");
      v.sum0 = v.sum0 ?? v.sum ?? "";   // (the figure on file when the screen opened: kept when the left-over way is left empty)
      const spendPart = ui.h("div", { class: "su-way-spend" });
      let lw = null;
      const showWay = () => { spendPart.hidden = v.way === "left"; lw.part.hidden = v.way !== "left"; if (v.way === "left") lw.show(); refresh(); };
      const wayTiles = tileGroup("How to answer", [{ key: "spend", icon: "🧾", label: "I know roughly what I spend", line: "Add up what you pay" }, { key: "left", icon: "💰", label: "I know what's left over", line: "What stays in checking" }],
        { radio: true, isOn: (o) => o.key === v.way, onPick: (o) => { v.way = o.key; showWay(); } });
      lw = leftWay(v, {
        guess: ctx.guess, onChange: () => refresh(),
        onKeepSpend: () => { wayTiles.querySelector('[data-key="spend"]')?.click(); },
        onClearTyped: () => { for (const s of rows) { v.rows[s.key] = ""; if (boxes[s.key]?.input) boxes[s.key].input.value = ""; } },
      });
      add(card, wayTiles, lw.part, spendPart);
      const basis = ui.h("p", { class: "su-sub su-basis" });
      const first = ui.h("p", { class: "su-sub su-first", hidden: true }, "Type your rent first: it's the biggest one.");
      const renting = housingWords(plan).kind === "rent";
      const body = ui.h("div", {});
      const totalEl = ui.h("b", {}), partsEl = ui.h("p", { class: "su-parts", "aria-live": "polite" });
      // R10 (spec 2.2): a box typed moves the other grey figures so the month stays near what households like this spend in
      // all; when it does, one line says so (C3 UX review 2: the figures moved and nothing said why)
      // (su-adjust: .su-sub's display would otherwise override [hidden], and the line showed before anything was typed; C3 verify)
      const adjustEl = ui.h("p", { class: "su-sub su-adjust", hidden: true },"We changed our other guesses to fit what you typed, so the month stays near what households like yours spend. Type a total in the top box to set the whole month yourself.");
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
          const blank = args.rows[s.key] === null;
          const g = blank ? ctx.guess(`spend.${s.key}`, { path: `expenses[setup-x-${s.key}].amount`, args }) : null;
          grey[s.key] = g && typeof g.value === "number" ? g.value : 0;
          // a tap the row's guess asks (how health cover is had, childcare, an HOA fee), kept on screen once answered
          if (b?.tap) {
            const q = g?.ask ?? null, said = v.taps[b.tapKey] ?? null;
            // at most two "does this exist" taps on the screen (spec P9): with childcare asked, the HOA fee is not asked
            // (blank takes the likelier side, as Not sure does)
            const room = b.tapKey !== "hoa" || !rows.some((r) => r.key === "childcare") || !!said;
            const want = blank && (!!q || !!said) && room;
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
        // the best-guess figure shares itself over the blank groups in the proportions of our guesses (sumSplit, what saving writes)
        const leftRes = v.way === "left" ? lw.result() : null, leftOk = !!leftRes?.ok;
        const sumTyped = leftOk ? leftRes.figure : v.way === "left" ? 0 : Math.round(num(v.sum));
        const split = sumTyped > 0 ? sumSplit(rows, args, sumTyped, (s) => ({ value: grey[s.key] })) : null;
        const shown = (s) => (split ? split.rows[s.key] ?? 0 : grey[s.key] ?? 0);
        for (const s of rows) {
          const b = boxes[s.key];
          if (!b?.input) continue;
          const fig = args.rows[s.key] === null ? shown(s) : 0;
          const text = fig > 0 ? groupDigits(String(Math.round(fig))) : "";
          b.input.placeholder = text;
          b.input.setAttribute("aria-label", `${b.name}${text ? `, leave blank to use ${split ? "your best guess, divided up, about" : "our guess of about"} ${symbol}${text}` : ""}`);
        }
        const typedOf = (s) => num(v.rows[s.key]);
        const rowFig = (s) => typedOf(s) || (args.rows?.[s.key] === 0 ? 0 : shown(s));
        const typedSum = rows.reduce((t, s) => t + typedOf(s), 0);
        const ours = split ? 0 : rows.reduce((t, s) => t + (typedOf(s) || args.rows?.[s.key] === 0 ? 0 : grey[s.key] ?? 0), 0);
        const own = split ? Math.max(sumTyped, typedSum) : typedSum;
        if (totalInput) {
          const t = Math.round(typedSum + rows.reduce((x, s) => x + (grey[s.key] ?? 0), 0));
          totalInput.placeholder = t > 0 ? groupDigits(String(t)) : "";
          totalInput.setAttribute("aria-label", `Your best guess for a normal month${t > 0 ? `, leave blank to use our guess of about ${symbol}${groupDigits(String(t))}` : ""}`);
        }
        totalEl.textContent = money(own + ours + base.existing + base.loanPayments);
        partsEl.textContent = ours > 0 || split || base.loanPayments > 0 || base.existing > 0
          ? [own > 0 ? `${money(own)} ${split ? "your best guess" : "you typed"}` : null, ours > 0 ? `${money(ours)} our guesses` : null, base.existing > 0 ? `${money(base.existing)} already in your plan` : null, base.loanPayments > 0 ? `${money(base.loanPayments)} loan payments` : null].filter(Boolean).join(" + ") : "";
        // the left-over said: the month in all is what that leaves room for
        if (leftOk) { totalEl.textContent = money(leftRes.month); partsEl.textContent = `worked out from the ${money(parseMoney(v.left))} you said is left over`; }
        const clash = !!leftRes && !leftRes.ok;   // two answers at odds: no total (and no talk of changed guesses) until one is chosen
        totalEl.parentElement.hidden = partsEl.hidden = clash;
        overNote.hidden = !(split && typedSum > sumTyped);
        if (sums.must) sums.must.textContent = money(rows.filter((s) => s.group === "must").reduce((t, s) => t + rowFig(s), 0) + base.loanPayments);
        if (sums.else) sums.else.textContent = money(rows.filter((s) => s.group === "else").reduce((t, s) => t + rowFig(s), 0));
        // the one basis line (spec 5.6), and the rent first while rent is ours
        const typedAny = rows.some((s) => args.rows?.[s.key] !== null && args.rows?.[s.key] !== undefined);
        adjustEl.hidden = !(!split && typedAny && rows.some((s) => args.rows?.[s.key] === null && Math.abs((grey[s.key] ?? 0) - (baseGrey(args)[s.key] ?? 0)) >= 10));
        if (clash) adjustEl.hidden = true;
        const anyGrey = Object.values(grey).some((x) => x > 0);
        basis.textContent = anyGrey ? (split ? `The gray figures are your ${money(sumTyped)} divided up the way a household like yours usually spends it. Type your own to change one.` : spendBasis(plan, { today })) : "";
        basis.hidden = !basis.textContent;
        first.hidden = !(renting && rows.some((s) => s.key === "housing") && args.rows?.housing === null && grey.housing > 0);
        // retirement: our figure follows the rows until it is typed
        if (!allRetired(plan)) {
          const g = later.typed ? null : ctx.guess("overview/setup:retireSpend", { path: "retirement.spendingMonthly", args: split ? { ...args, rows: { ...args.rows, ...split.rows } } : args });
          const fig = g && g.value > 0 ? g.value : null;
          if (laterInput) {
            laterInput.placeholder = fig ? groupDigits(String(Math.round(fig))) : "";
            laterInput.setAttribute("aria-label", `Once you stop working, about how much a month${fig ? `, leave blank to use our guess of about ${symbol}${groupDigits(String(Math.round(fig)))}` : ""}`);
            if (laterSub) laterSub.textContent = later.typed ? "Your figure. Health insurance is added on Will the money last?" : fig ? (loansLater > 0 ? `Our guess: about ${money(Math.round((fig - loansLater) / 10) * 10)} a month of costs, plus the ${money(loansLater)} of loan payments still running then. Health insurance is added on Will the money last?` : "Our guess: everyday costs as people 65 to 74 usually spend them, plus your home costs. Health insurance is added on Will the money last?") : "";
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
        const box = moneyIn(v.rows[s.key], (val) => { v.rows[s.key] = val; lw?.touch(); refresh(); });
        const input = box.querySelector("input"), id = `su-i-${++uid}`;
        input.id = id;
        const tapKey = s.key === "insurance" ? "health-cover" : s.key === "childcare" ? "childcare" : s.key === "housing" ? "hoa" : null;
        const tap = tapKey ? ui.h("div", { class: "su-tap", hidden: true }) : null;
        boxes[s.key] = { input, name, tap, tapKey, tapBuilt: false, ask: null };
        return [ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("label", { class: "su-label", for: id }, name), describe(input, help)), box), tap];
      };
      const drawBody = () => {
        for (const k of Object.keys(boxes)) delete boxes[k];
        sums.must = ui.h("span", { class: "sum" }); sums.else = ui.h("span", { class: "sum" });
        const must = rows.filter((s) => s.group === "must"), other = rows.filter((s) => s.group === "else");
        const loanRow = base.loanPayments > 0 ? ui.h("div", { class: "su-row" }, ui.h("span", {}, ui.h("span", { class: "su-label" }, "Loan and card payments"), ui.h("span", { class: "su-sub" }, "From question 5, already counted")), ui.h("span", { class: "su-fixed" }, money(base.loanPayments))) : null;
        swap(body,
          must.length || loanRow ? ui.h("div", { class: "su-group first" }, ui.h("div", { class: "su-gh" }, "Bills you have to pay", sums.must), ...must.flatMap(row), loanRow) : null,
          other.length ? ui.h("div", { class: "su-group" }, ui.h("div", { class: "su-gh" }, "Everything else", sums.else), ...other.flatMap(row)) : null,
          rows.length ? null : ui.h("p", { class: "su-sub" }, "Every kind of bill is already in your plan."));
        refresh();
      };
      // the one box: your best guess for a normal month, with the grey guess in it; the groups are optional, in the fold below
      const sumBox = moneyIn(v.sum, (val) => { v.sum = val; refresh(); });
      totalInput = sumBox.querySelector("input");
      const overNote = ui.h("p", { class: "su-sub su-over", hidden: true, "aria-live": "polite" }, "The groups below add up to more than this, so we use the groups. Clear a box below to use your figure.");
      add(spendPart, field("Your best guess for a normal month", sumBox, base.loanPayments > 0 ? "Home, food, car, fun: everything except the loan and card payments we already have." : "Home, food, car, fun: everything. Leave it blank to use the gray figure: what's typical for someone like you."), basis, overNote);
      add(card, ui.h("div", { class: "su-total" }, ui.h("span", {}, "In all, about a month"), totalEl), partsEl, adjustEl);
      // "Split it up (optional)": the groups, the health cover question (it sits under its group) and what you'll spend once you stop working
      const fold = ui.h("details", { class: "fold su-fold" },
        ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Split it up (optional)"), ui.h("span", { class: "fold-status" }, "rent, food, car..."), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")),
        ui.h("div", { class: "fold-body" }, first, body));
      const typedRows = rows.some((s) => num(v.rows[s.key]) > 0 || v.rows[s.key] === 0) || base.existingCount > 0;
      fold.open = typedRows;
      add(card, fold);
      if (!allRetired(plan)) {
        if (laterBox) {
          const box = moneyIn(later.typed ? later.value : "", (val) => { later.value = val; later.typed = parseMoney(val) !== null; refresh(); });
          laterInput = box.querySelector("input");
          laterSub = ui.h("span", { class: "su-sub", "aria-live": "polite" });
          const id = `su-h-${++uid}`; laterSub.id = id; laterInput.setAttribute("aria-describedby", id);
          fold.querySelector(".fold-body").append(group(null, ui.h("div", { class: "su-field" }, ui.h("label", {}, ui.h("span", { class: "su-label" }, "Once you stop working, about how much a month?"), box), laterSub)));
        } else {
          laterLine = ui.h("p", { class: "su-sub su-laterline", "aria-live": "polite" });
          fold.querySelector(".fold-body").append(laterLine);
        }
      }
      drawBody();
      showWay();
      const leftTyped = () => v.way === "left" && parseMoney(v.left) !== null;
      const words = (p2) => {
        const r = reflect(p2, "spend");
        if (!r) return null;
        const note = leftTyped() ? leftMarker(p2) : null;
        if (note) return `Got it: with ${money(note.left)} left over each month, you spend about ${money(r.monthly)} a month.`;
        // the month in all, as the screen's "In all" says it (loan and card payments from question 5 included)
        // (how many of the screen's amounts are ours, said against how many there are: "6 of the 7 amounts", "All 7 amounts")
        const ours = r.guessed === r.count ? (r.count === 1 ? "The amount is our guess" : `All ${r.count} amounts are our guesses`) : `${r.guessed} of the ${r.count} amounts ${r.guessed === 1 ? "is our guess" : "are our guesses"}`;
        return r.guessed ? `Got it: about ${money(about(r.monthly))} a month. ${ours} for now.` : `Got it: about ${money(r.monthly)} a month, ${money(r.essential)} of it bills you must pay.`;
      };
      const spendV = () => ({ ...v, sum: v.way === "left" ? v.sum0 : v.sum, retireMonthly: later.typed ? later.value : "", retireAuto: !later.typed });
      const answered0 = spendAnswered(plan);
      const apply = (d) => {
        // a left-over that cannot be worked out writes nothing (block() has already stopped Continue); our guesses never stand in for it
        if (leftTyped()) { applyLeftOver(d, { ...spendV(), left: v.left }, today, { guess: ctx.guess }); return; }
        if (v.way === "left" && answered0) return;   // left empty and the spending already given: kept as it is
        applySpend(d, spendV(), today, { guess: ctx.guess });
      };
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
      const block = () => { if (!leftTyped()) return null; lw.flush(); return lw.conflict() ? leftStop(lw.result(), money) : null; };
      current = { apply, words, check, block };
      // "Skip: use our guesses": what is on the screen is kept (typed boxes stay typed) and every empty box gets our guess.
      // Childcare is never guessed without its tap (spec E06), so a Skip with the childcare tap unanswered asks it once more
      // first (C3 UX review 4: a parent who skipped had no childcare counted, and nothing said so); a second Skip goes on.
      let askedCare = false;
      const careOpen = () => { const b = boxes.childcare; return !!b?.tap && !b.tap.hidden && !(v.taps.childcare); };
      actions("Continue", { skipLabel: "Skip: use our guesses", onSkip: () => {
        if (careOpen() && !askedCare) {
          askedCare = true;
          fold.open = true;
          const b = boxes.childcare;
          b.tap.querySelector(".su-care-again")?.remove();
          b.tap.prepend(ui.h("p", { class: "su-sub su-care-again", role: "status" }, "One thing first: we never guess childcare. Do you pay for it? Tap Yes, No or Not sure, or Skip again to leave it out."));
          b.tap.scrollIntoView({ behavior: "smooth", block: "center" });
          b.tap.querySelector("button")?.focus({ preventScroll: true });
          return;
        }
        // a left-over typed that cannot be worked out (more than comes in, or the bills leave no room) writes nothing, so Skip
        // uses our guesses as it says, the groups typed kept; before, it moved on with no spending at all (verify 2026-11-07)
        const leftFails = leftTyped() && (lw.flush(), lw.conflict());
        current = { apply: leftFails ? (d) => applySpend(d, { ...spendV(), sum: v.sum0 }, today, { guess: ctx.guess }) : apply, words }; forward();
      } });
    },

    goals() {
      head("🎯", "What are you working toward?", "Pick any. You can add more later.");
      const v = draft(() => new Set(valuesFor(plan, "goals")));
      // after "No, I'm debt-free" there is no "Paying off debt" tile; everyone retired reads a retiree's words (R6)
      const debtFree = reflect(plan, "owe")?.kind === "debt-free", retiredAll = allRetired(plan);
      const goalTiles = GOALS.filter((g) => !(debtFree && g.key === "debt")).map((g) => retiredAll && g.key === "retire" ? { ...g, label: "Making the money last", line: "For the rest of your life" } : g);
      add(card, tileGroup("What are you working toward?", goalTiles, { isOn: (o) => v.has(o.key), onPick: (o) => { if (v.has(o.key)) v.delete(o.key); else v.add(o.key); }, isHave: (o) => !o.focus && goalTaken(plan, o.key) }),
        haveNote((plan.goals ?? []).filter((g) => !String(g.id).startsWith("setup-")).map((g) => g.name)));
      current = { apply: (d) => applyGoalPicks(d, [...v].filter((k) => !(debtFree && k === "debt"))) };
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
          if (tapped === g.key) { const pv = preview(), c = cushion(pv, v.cushion?.months ?? null, today); if (c.essential > 0) have = `Your emergency fund now counts ${money(c.now)}: ${monthsWords(c.covered ?? 0)} of the bills you have to pay. Aim for ${c.months}.`; }
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
            // Emergency fund's own target (months x bills you have to pay), and why the cash it counts is less than the accounts hold
            const share = c.exact > 0 ? Math.min(1, c.now / c.exact) : 0;
            swap(live, c.essential > 0
              ? ui.h("p", { class: "su-live" }, "That's ", ui.h("b", {}, money(c.exact)), `: ${x.months} month${x.months === 1 ? "" : "s"} of the ${money(c.essential)} in bills you have to pay${loans ? " and loan payments" : ""}.`)
              : ui.h("p", { class: "su-live" }, "The bills you have to pay (question 6) set the amount."),
              c.essential > 0 ? ui.h("p", { class: "su-live" }, cushionHave(pv, c)) : null,
              c.essential > 0 ? ui.h("div", { class: "su-meter", role: "img", "aria-label": `${Math.round(share * 100)}% of the emergency fund` }, ui.h("span", { style: { width: `${Math.round(share * 100)}%` } })) : null);
          };
          drawC();
          redrawCushion = drawC;
          add(card, group(`${g.icon} ${g.label}`, fieldset("How many months of the bills you have to pay?", stepper(x.months, 1, 12, (n) => { x.months = n; drawC(); }, "Months of the bills you have to pay"), allRetired(plan) ? "Three to six months is the usual advice: enough for a big repair or a medical bill." : "Three to six months is the usual advice; more if your pay goes up and down."), live));
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
      if (!plan.guide?.setup?.finishedAt && wouldChange(plan, (d) => atScreen(d, "done", today))) { store.update((d) => atScreen(d, "done", today)); return; }
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
    const ps = pathSummary(plan, { off: offKeys(ctx), today });
    // a runway worked out from our spending guesses with no cash on file is not a figure: "0 months" there is no finding,
    // and a reveal with nothing else reads "You're set up. The numbers come next." (F4, OP-6; design log 2026-11-06)
    const hasCash = (plan.accounts ?? []).some((a) => ["cash", "checking", "savings"].includes(a.type));
    const cushionOpen = st.runway === null || (!hasCash && (st.runwayWaits || !(plan.accounts ?? []).length));
    const any = st.netWorth !== null || st.spare !== null || !cushionOpen || !!st.retire;
    const target = st.runwayTarget ?? 6;
    // "the 6 you want" only when the person set the months; else the number is ours (R6)
    const targetSet = plan.assumptions?.emergencyMonths != null;
    const targetWords = targetSet ? `the ${target} you want` : `the ${target} months we suggest`;
    add(card, ui.h("div", { class: "su-done-head" }, any ? ui.h("div", { class: "su-check", "aria-hidden": "true" }, "✓") : ui.h("div", { class: "su-emoji", "aria-hidden": "true" }, "🌱"),
      ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, any ? (firstName ? `You did it, ${firstName}. Here is your money so far.` : "You did it. Here is your money so far.") : "You're set up. The numbers come next."),
      // the sentence as the Dashboard says it: nothing "below" here is a list of moves, and while the path goes on its Next
      // button is the next thing (claude-f's hand-over: FL-HOME F4 / D4)
      ui.h("p", {}, calmHeadline(st.headline, { underWay: !ps.complete }))));
    const fig = (cls, label, value, sub, status, href) => {
      const s = ui.stat(label, typeof value === "number" ? money(value) : value, sub);
      return ui.h(href ? "a" : "div", { class: `su-fig ${cls}`, href: href ?? null }, s, status ? ui.h("div", { class: "st" }, status) : null);
    };
    const couple = st.later.some((l) => l.key === "couple");
    // half or more of one side is our guesses: the figure, said as partly ours, calm (never "a solid base" on guesses)
    const nwFig = st.netWorth === null ? fig("open", "What you own, minus what you owe", "Not yet", "Needs what you have and what you owe.", "Add them ›", setupHref("have"))
      : st.netWorthGuessed ? fig("calm", "What you own, minus what you owe", st.netWorth, `Partly our guesses. You own about ${money(about(st.assets))} and owe about ${money(about(st.liabilities))}.`, "● Our guesses for now")
      : st.netWorth >= 0 ? fig("ok", "What you own, minus what you owe", st.netWorth, `You own ${money(st.assets)} and owe ${money(st.liabilities)}.`, "● A solid base")
        : st.homeMissing ? fig("calm", "What you own, minus what you owe", st.netWorth, "Your home's value is not in yet, so only the mortgage counts.", "Add your home ›", setupHref("owe-amounts"))
          : fig("calm", "What you own, minus what you owe", st.netWorth, "Common with a mortgage or student loans. It grows as you pay them down.", "● Grows as the loans shrink");
    const hasPay = (plan.income ?? []).length > 0, hasSpend = (plan.expenses ?? []).length > 0;
    const spareOne = hasSpend !== hasPay;
    const spareFig = st.spare === null ? fig("open", "Left over each month", "Not yet", hasSpend && !hasPay ? (allRetired(plan) ? "Needs your pension or Social Security." : "Needs your pay.") : hasPay && !hasSpend ? "Needs your spending." : "Needs your pay and spending.", spareOne ? "Add it ›" : "Add them ›", setupHref((plan.income ?? []).length ? "spend" : "money"))
      // most of the spending is our guesses (spec 8.1): no verdict, no green or amber; what our guesses say, and where to type
      : st.spareWaits ? fig("calm", "Left over each month", "Depends on your spending", `With our spending guesses: about ${money(about(Math.abs(st.spare)))} ${st.spare < 0 ? "short" : "spare"}.${st.childcareMissing ? " Childcare is not counted yet." : ""} Type yours ›`, "● Our guesses for now", setupHref("spend"))
      : st.drawing ? fig("calm", "Drawn from savings each month", -st.spare, "What your pension and Social Security don't cover.", "● Living on savings")
        : st.bank ? fig("warn", "Left over each month", st.spare, `By your plan. Your bank shows about ${money(Math.round(st.bank.gap / 10) * 10)} a month more going out.`, "Check Expenses ›", "#/cashflow/expenses")
        : fig(st.spare >= 0 ? "ok" : "warn", "Left over each month", st.spare, `After ${st.stateTaxCounted ? "tax" : "federal tax"}${couple ? " (worked out as one return for now)" : ""}, bills and saving${st.debtExtra > 0 ? `, and the ${money(st.debtExtra)} a month extra on ${st.debtOn ?? "debts"}` : ""}.${st.lean ? ` That is a lean month: when all your uneven pay comes in, ${st.lean.kind === "ahead" ? `about ${money(st.lean.about)} is left` : st.lean.kind === "even" ? "it only just about breaks even" : `it is still about ${money(-st.lean.about)} short`}.` : ""}${st.spare >= 0 && st.yearWords ? ` ${st.yearWords}` : ""}${st.leftFrom?.spending > 0 ? ` That means about ${money(Math.round(st.leftFrom.spending / 10) * 10)} a month goes on bills and spending.` : ""}`,
          // short only in a lean month (Side income's "count on"; review 2026-11-02, round 5)
          st.spare >= 0 ? "● Money to put to work" : st.lean?.kind === "ahead" ? "● Short in a lean month" : "● More goes out than comes in");
    // cash set aside for a goal, or this year's tax not paid yet, is not cushion: said, so the months read right (round 8)
    const held = cushionHeldWords(st, plan);
    // the cash is held for the owner's own "Emergency fund" goal, not ticked as the cushion: where to say it is (F-034)
    const heldAsk = cushionHeldAsk(st);
    const cushionFig = cushionOpen ? fig("open", "Emergency fund", "Not yet", hasSpend ? "Needs your savings." : "Needs your spending and savings.", "Add them ›", setupHref(hasSpend ? "have" : "spend"))
      : st.runwayWaits ? fig("calm", "Emergency fund", `About ${monthsNear(st.runway, target)}`, `${held ? `${held} ` : ""}By our guesses of the bills you have to pay. Aim for ${target}.`, "● Our guesses for now", setupHref("spend"))
      : st.runway >= target && !held ? fig("ok", "Emergency fund", monthsWords(st.runway), `of the bills you have to pay, in cash${overTarget(st.runway, target) ? `: ${overTarget(st.runway, target)}` : `: ${targetWords}`}.`, "● Covered", null)
      : fig(st.runwayStatus === "ok" ? "ok" : "warn", "Emergency fund", monthsNear(st.runway, target), held ? `${held} Aim for ${target} months.${heldAsk ? ` ${heldAsk}` : ""}` : `of the bills you have to pay, in cash. Aim for ${target}.`, st.runwayStatus === "ok" ? "● Covered" : "● Worth building up", heldAsk ? "#/goals/emergency-fund" : null);
    // the ages are in but the check could not run: what it waits for is the monthly spending, and that is where the link goes
    // (j-first-renter/x-1); no retirement savings on file: the link opens "What do you have?", where Retirement is ticked (x-2)
    const retireFig = st.retirementKnown && !st.retire ? fig("open", "Retirement", "Not worked out yet", "Needs what you spend each month.", "Add it ›", setupHref("spend"))
      : !st.retirementKnown || !st.retire ? fig("open", "Retirement", "Not worked out yet", `Needs ${st.retirementMissing ?? "Social Security and birth dates"}.`, "Add it ›", setupHref("ages"))
      // no retirement savings on file: "not known yet", never "Short at 65" while Will the money last? says it does not know
      : st.retireSavingsUnknown ? fig("open", "Retirement", "Not known yet", "Add your retirement savings to see: tick Retirement on the next screen.", "Add them ›", setupHref("have"))
      // its spending is mostly our guesses: the verdict word, calm, never "Short at 65" in amber on guesses alone
      : st.retireGuessed ? fig("calm", "Retirement", st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : "Needs a look", retireGuessAsk(st).words, "● Our guesses for now", retireGuessAsk(st).href ?? setupHref(retireGuessAsk(st).id))
      : fig(st.retire.verdict === "on track" ? "ok" : "warn", "Retirement", st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : st.retire.shortAge ? `Short at ${st.retire.shortAge}` : "Needs a look", "If nothing changes.", st.retire.verdict === "on track" ? "● The money lasts" : "● Small changes help", "#/retirement/projection");
    add(card, ui.h("div", { class: "su-stand" }, nwFig, spareFig, cushionFig, retireFig));
    // (the figures are shown as they are at once: they used to count up from $0, so a look at the screen while they ran read
    // $380 and -$10,085 where the next screens say $384 and -$10,200; follow-up B4)
    // what's next: the rest of the path, one page at a time, ending at Your plan. The first moves, our guesses and what the plan
    // counts on moved to Your plan (overview/plan), where the whole picture is
    const rest = ps.parts.slice(1);
    const minutes = Math.max(5, Math.round((2 * Math.max(1, ps.total - 1)) / 5) * 5);
    if (ps.complete) add(card, ui.h("div", { class: "su-end" }, ui.h("a", { class: "btn", href: ps.planHref }, "Back to your plan ›"), ui.h("button", { type: "button", class: "secondary", onClick: () => go("welcome") }, "Change an answer")));
    else add(card, ui.h("section", { class: "su-next", "aria-labelledby": "su-next-h" },
      ui.h("h2", { class: "su-h2", id: "su-next-h" }, "What's next"),
      ui.h("p", { class: "su-help" }, `Now a quick look at each step of your plan, one page at a time: about ${minutes} more minutes. Anything you don't know, we fill in with our guesses.`),
      ui.h("ol", { class: "su-steps" }, [...rest.map((x) => ui.h("li", { class: x.passed ? "done" : "" }, ui.h("span", { class: "n", "aria-hidden": "true" }, x.passed ? "✓" : String(rest.indexOf(x) + 2)), x.name)), ui.h("li", { class: "then" }, ui.h("span", { class: "n", "aria-hidden": "true" }, "→"), "Then: your whole plan on one page")]),
      ui.h("div", { class: "su-end" },
        ps.next ? ui.h("a", { class: "btn", href: ps.next.href, onClick: () => change(ctx, (q) => startGuide(q, PATH_ID, today)) }, `Next: ${ps.next.name} ›`) : null,
        ui.h("button", { type: "button", class: "secondary", onClick: () => go("welcome") }, "Change an answer"))));
    try { card.querySelector("#su-q")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
  }

  (UI[screenId] ?? UI.welcome)();
  add(root, ui.h("p", { class: "su-foot" }, FOOT));
  if (screen.q) { try { card.querySelector("#su-q")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } }
}
