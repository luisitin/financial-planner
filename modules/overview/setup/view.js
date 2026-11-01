// modules/overview/setup/view.js -- DOM only. "Set up my plan": one question per screen at #/overview/setup/<screen>
// (the phone's Back button goes to the previous question). Answers live in the screen until Continue (or Enter, or
// Finish later), which saves them in one store.update -- compute.js turns them into the pages' own records -- and
// moves on. A Continue that changes nothing saves nothing (compute's wouldChange).
import {
  SCREENS, QUESTIONS, HAVE, OWE, GOALS, PAY_PERIODS, OTHER_KINDS, RETIRE_KINDS, DATE_CHIPS, STATES, TYPICAL_RATES,
  adults, dependents, picks, nextScreen, prevScreen, resolveScreen, barShare, valuesFor, reflect, hasMortgage,
  existingHave, existingOwe, existingPay, existingGoal, askOwners, spendRows, spendBase, allRetired, cushion,
  estimateSocialSecurity, yearlyPay, parseMoney, possessive, wouldChange, markAt, applyYou, applyMoney, applyAges,
  applyHavePicks, applyHaveAmounts, applyOwePicks, applyOweAmounts, applySpend, applyGoalPicks, applyGoalDetails, applyGuesses,
  progress, standing,
} from "./compute.js";
import { fullRetirementAge } from "../../retirement/social-security/compute.js";

let pending = [];        // [{ kind, text }] for the top of the next screen (the shell redraws after every save)
let lastShare = 0;       // the bar starts where the last screen left it, then fills to this one
let reveal = false;      // the last Continue was just tapped: show "Putting your plan together" once

const STYLE = `
.su-root { max-width: 580px; margin: 0 auto; }
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
.su-tile .su-tl { font-weight: 650; font-size: var(--fs); line-height: 1.25; padding-right: 22px; }
.su-tile .su-ts { color: var(--text-2); font-size: var(--fs-sm); line-height: 1.3; }
.su-root .su-tile.on { border-color: var(--accent); background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); }
.su-tile.on::after { content: "✓"; position: absolute; top: 9px; right: 9px; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: 13px; font-weight: 700; display: grid; place-items: center; }
.su-root .su-tile.have { cursor: default; opacity: .8; }
.su-root .su-tile.have:hover { border-color: var(--accent); }
.su-root .su-tile.wide { grid-column: 1 / -1; min-height: 60px; flex-direction: row; align-items: center; gap: 12px; }
.su-root .su-tiles.three .su-tile { min-height: 60px; flex-direction: row; align-items: center; gap: 12px; padding: 10px 14px; }
.su-tiles.three .su-tile .su-ts { margin-left: auto; padding-right: 26px; }
.su-tiles.three .su-tile.on::after { top: 50%; transform: translateY(-50%); }
.su-field { display: block; margin: 0 0 16px; }
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
.su-group { border-top: 1px solid var(--line); padding: 18px 0 2px; }
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
.su-total { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 14px 16px; margin: 8px 0 20px; border-radius: var(--radius-sm); background: var(--panel-2); font-weight: 650; }
.su-total b { font-size: var(--fs-lg); font-variant-numeric: tabular-nums; }
.su-have { background: var(--panel-2); border-radius: var(--radius-sm); padding: 12px 14px; margin: 0 0 16px; color: var(--text-2); line-height: 1.45; }
.su-have b { color: var(--text); font-weight: 600; }
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
.su-meta { margin: 0 0 18px; color: var(--text-2); font-weight: 600; text-align: center; }
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
.su-stand .su-fig .st { margin-top: auto; padding-top: 8px; font-size: var(--fs-sm); font-weight: 650; }
.su-stand .su-fig.ok .st { color: var(--ok); }
.su-stand .su-fig.warn { border-color: var(--warn); background: var(--warn-soft); }
.su-stand .su-fig.warn .st { color: var(--warn); }
.su-stand .su-fig.open .stat-value { color: var(--text-2); font-size: var(--fs-lg); }
.su-stand a.su-fig .st { color: var(--accent-ink); }
.su-stand a.su-fig:hover { border-color: var(--accent); }
.su-h2 { font-size: var(--fs-lg); margin: 0 0 12px; }
.su-moves { list-style: none; padding: 0; margin: 0 0 24px; display: grid; gap: 10px; }
.su-moves a { display: flex; gap: 12px; align-items: center; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: var(--text); text-decoration: none; min-height: 64px; }
.su-moves a:hover { border-color: var(--accent); }
.su-moves .n { flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: var(--on-accent); display: grid; place-items: center; font-weight: 700; }
.su-moves b { display: block; font-weight: 650; }
.su-moves .d { display: block; color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; line-height: 1.4; }
.su-moves .c { margin-left: auto; color: var(--text-2); font-size: 22px; }
.su-later-list { margin: 0 0 22px; padding: 0 0 0 20px; color: var(--text-2); line-height: 1.5; }
.su-later-list li { margin: 6px 0; }
.su-later-list a { display: inline-flex; min-height: 32px; align-items: center; }
.su-guess { margin: 0 0 24px; }
.su-guess .su-list { margin-top: 12px; }
.su-guess .su-gbtns { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.su-end { display: grid; gap: 10px; }
.su-root .su-end .btn, .su-root .su-end button { display: flex; align-items: center; justify-content: center; min-height: 52px; font-size: var(--fs-md); }
@media (min-width: 720px) {
  .su-card { padding: 30px 32px 22px; }
  .su-tiles, .su-tiles.three { grid-template-columns: 1fr 1fr 1fr; }
  .su-root .su-tiles.three .su-tile { min-height: 84px; flex-direction: column; align-items: flex-start; gap: 4px; }
  .su-tiles.three .su-tile .su-ts { margin-left: 0; }
  .su-tiles.three .su-tile.on::after { top: 9px; transform: none; }
  .su-stand { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .su-stand .su-fig:first-child { grid-column: auto; }
}
@media (max-width: 380px) { .su-row { grid-template-columns: 1fr 8rem; } }
@media (prefers-reduced-motion: reduce) { .su-card, .su-check, .su-dots i { animation: none; } .su-bar > span, .su-tile { transition: none; } }
`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
/** append / replace children, skipping null, false and "" (the DOM would print "null"). */
const keep = (kids) => kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false && k !== "");
const add = (el, ...kids) => el.append(...keep(kids));
const swap = (el, ...kids) => el.replaceChildren(...keep(kids));
const and = (list) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);
/** "1234567.5" -> "1,234,567.5" as you type (k and m kept at the end). */
function groupDigits(raw) {
  let s = String(raw ?? "").replace(/[^0-9.kKmM]/g, "");
  const suf = /[kKmM]$/.test(s) ? s.slice(-1).toLowerCase() : "";
  s = s.replace(/[kKmM]/g, "");
  const [i, ...rest] = s.split(".");
  const int = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return int + (rest.length ? `.${rest.join("").slice(0, 2)}` : "") + suf;
}

export function render(page, ctx) {
  const { ui, fmt, store } = ctx;
  const plan = ctx.plan;
  const today = fmt.today();
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
  const pctOf = (r) => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
  const symbol = (() => { try { return new Intl.NumberFormat(plan.meta?.locale || "en-US", { style: "currency", currency: cur }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$"; } catch { return "$"; } })();
  const prog = progress(plan);
  const asked = ctx.route.rest?.[0] ?? "welcome";
  const screenId = resolveScreen(plan, SCREENS.some((s) => s.id === asked) ? asked : "welcome");
  if (screenId !== asked && asked !== "welcome") { try { history.replaceState(null, "", `#/overview/setup/${screenId}`); } catch { /* the address stays; the screen is right */ } }
  const screen = SCREENS.find((s) => s.id === screenId);
  const root = ui.h("div", { class: "su-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  try { window.scrollTo(0, 0); } catch { /* no window in tests */ }

  const go = (id) => ctx.go("overview", "setup", id === "welcome" ? [] : [id]);
  const ad = adults(plan);
  const self = ad.find((p) => p.role === "self") ?? ad[0];
  const firstName = self && self.name && self.name !== "Me" ? self.name : null;

  /** The answers on screen as a writer; Continue, Enter and Finish later all save through it. */
  let current = null;
  const toStart = () => { ctx.go("overview", "start"); };
  const save = (then) => {
    if (!current) { then(nextScreen(plan, screenId)); return; }
    let kept = [];
    const fn = (d) => { kept = current.apply(d) || []; markAt(d, then === toStart ? screenId : nextScreen(d, screenId), today); };
    if (wouldChange(plan, fn)) store.update(fn);
    const after = store.get();
    pending = [];
    const said = current.words?.(after);
    if (said) pending.push({ kind: "ok", text: said });
    for (const k of kept) pending.push({ kind: "warn", text: `Kept ${k.name}: ${k.reason}. ${k.page === "#/household/people" ? "Remove them on People" : "Remove it on Net worth"} if you mean to.` });
    then(nextScreen(after, screenId));
  };
  const forward = () => save((next) => { if (next === "done") reveal = true; go(next); });
  const skip = () => {
    const fn = (d) => { if (screenId === "you" && !(d.household?.people ?? []).length) applyYou(d, { who: "me" }); markAt(d, nextScreen(d, screenId), today); };
    if (wouldChange(plan, fn)) store.update(fn);
    const next = nextScreen(store.get(), screenId);
    if (next === "done") reveal = true;
    go(next);
  };
  const back = () => { const prev = prevScreen(plan, screenId); if (!prev || prev === "welcome") toStart(); else go(prev); };

  // the top: back, the bar, finish later; then "Question 3 of 7"
  if (screen.q) {
    const share = barShare(screenId);
    const fill = ui.h("span", { style: { width: `${Math.max(3, Math.round(lastShare * 100))}%` } });
    add(root,
      ui.h("div", { class: "su-top" },
        ui.h("button", { type: "button", class: "su-icon", "aria-label": "Back", onClick: back }, "‹"),
        ui.h("div", { class: "su-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(share * 100)), "aria-label": `Question ${screen.q} of ${QUESTIONS}` }, fill),
        ui.h("button", { type: "button", class: "su-later", onClick: () => save(toStart) }, "Finish later")),
      ui.h("p", { class: "su-count" }, `Question ${screen.q} of ${QUESTIONS}`));
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${Math.max(3, Math.round(share * 100))}%`; }));
    lastShare = share;
  }
  const card = ui.h("form", { class: "su-card", "aria-labelledby": "su-q", novalidate: true, onSubmit: (e) => { e.preventDefault(); forward(); } });
  add(root, card);
  for (const n of pending) { const el = ui.notice(n.kind, n.text); el.setAttribute("role", "status"); add(card, el); ctx.announce?.(n.text); }
  pending = [];

  // ---- small parts
  const head = (emoji, q, help) => add(card,
    emoji ? ui.h("div", { class: "su-emoji", "aria-hidden": "true" }, emoji) : null,
    ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, q),
    help ? ui.h("p", { class: "su-help" }, help) : null);
  const actions = (label = "Continue", { noSkip = false } = {}) => {
    add(card, ui.h("div", { class: "su-actions" },
      ui.h("button", { type: "button", class: "secondary su-backbtn", onClick: back }, "‹ Back"),
      ui.h("button", { type: "submit", class: "su-go" }, label)));
    if (!noSkip) add(card, ui.h("button", { type: "button", class: "su-skip", onClick: skip }, "Skip this question"));
  };
  /** A choice tile: multi (aria-pressed) or one-of (role radio). `have`: already in the plan, shown ticked, not a choice. */
  const tile = (o, on, onPick, { radio = false, wide = false, have = false } = {}) => ui.h("button", {
    type: "button", class: `su-tile${on || have ? " on" : ""}${wide ? " wide" : ""}${have ? " have" : ""}`,
    role: radio ? "radio" : null, "aria-checked": radio ? String(!!on) : null, "aria-pressed": radio || have ? null : String(!!on), "aria-disabled": have ? "true" : null,
    onClick: have ? null : onPick,
  }, ui.h("span", { class: "su-ti", "aria-hidden": "true" }, o.icon), ui.h("span", { class: "su-tl" }, o.label), have ? ui.h("span", { class: "su-ts" }, "Already in your plan") : o.line ? ui.h("span", { class: "su-ts" }, o.line) : null);
  const tilesBox = (label, cls = "", radio = false) => ui.h("div", { class: `su-tiles${cls}`, role: radio ? "radiogroup" : "group", "aria-label": label });
  const moneyIn = (value, onValue, { label, placeholder = "0", hint = "next" } = {}) => {
    const input = ui.h("input", { class: "su-in", inputmode: "decimal", enterkeyhint: hint, autocomplete: "off", value: groupDigits(value === null || value === undefined ? "" : String(value)), placeholder, "aria-label": label ?? null });
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
  const field = (label, control, sub) => ui.h("label", { class: "su-field" }, ui.h("span", { class: "su-label" }, label), control, sub ? ui.h("span", { class: "su-sub" }, sub) : null);
  const fieldset = (label, control, sub) => ui.h("div", { class: "su-field" }, label ? ui.h("span", { class: "su-label" }, label) : null, control, sub ? ui.h("span", { class: "su-sub" }, sub) : null);
  /** One of a few, as pills (role radio). */
  const seg = (options, value, onPick, label) => {
    const wrap = ui.h("div", { class: "su-seg", role: "radiogroup", "aria-label": label });
    const draw = (v) => swap(wrap, ...options.map((o) => ui.h("button", { type: "button", role: "radio", "aria-checked": String(o.value === v), onClick: () => { onPick(o.value); draw(o.value); } }, o.label)));
    draw(value);
    return wrap;
  };
  const toggle = (label, on, onFlip) => {
    const b = ui.h("button", { type: "button", "aria-pressed": String(!!on), onClick: () => { on = !on; onFlip(on); } }, on ? `✓ ${label}` : label);
    return ui.h("div", { class: "su-seg" }, b);
  };
  const stepper = (value, min, max, onValue, label, live) => {
    let v = Math.max(min, Math.min(max, Number(value) || min));
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

  const UI = {
    welcome() {
      if (prog.finished) {
        head("🌱", "Your plan is set up", "Go through the questions again to change an answer, or see where you stand.");
        add(card, ui.h("div", { class: "su-end" }, ui.h("button", { type: "button", onClick: () => go("done") }, "See where I stand"), ui.h("button", { type: "button", class: "secondary", onClick: () => go("you") }, "Go through the questions again")));
        return;
      }
      head("🌱", firstName ? `Let's build your plan, ${firstName}` : "Let's build your plan", "A few easy questions, one at a time. At the end you'll see your money on one page.");
      add(card, ui.h("ul", { class: "su-list" }, [["🧭", "See what you own and owe", "Every account and debt in one place"], ["📅", "Know what's left each month", "After tax, bills and saving"], ["✅", "Get your first three moves", "In the order that helps most"]]
        .map(([i, b, m]) => ui.h("li", {}, ui.h("span", { class: "su-li", "aria-hidden": "true" }, i), ui.h("div", {}, ui.h("b", {}, b), ui.h("span", { class: "m" }, m))))));
      add(card, ui.h("p", { class: "su-meta" }, "About 5 minutes · Rough numbers are fine · Stop any time"));
      if (store.backend() !== "server" && !store.sandbox()) add(card, ui.h("div", { class: "notice info" }, "This device is not connected to your PC, so what you save stays on this device only. To keep one plan on your phone and your PC, ", ui.h("a", { href: "#/system/settings" }, "connect them in Settings"), "."));
      const resume = prog.started && prog.at && prog.at !== "welcome" && prog.at !== "done";
      const btns = ui.h("div", { class: "su-end" });
      if (resume) add(btns, ui.h("button", { type: "button", onClick: () => go(prog.at) }, `Pick up at question ${SCREENS.find((s) => s.id === prog.at)?.q ?? 1} of ${QUESTIONS}`), ui.h("button", { type: "button", class: "secondary", onClick: () => go("you") }, "Start from the first question"));
      else add(btns, ui.h("button", { type: "button", onClick: () => { if (wouldChange(plan, (d) => markAt(d, "you", today))) store.update((d) => markAt(d, "you", today)); go("you"); } }, "Let's go"));
      add(card, btns, ui.h("a", { class: "su-skip", href: "#/overview/guide/whole-plan" }, "I'd rather fill in the full pages myself"));
    },

    you() {
      const v = valuesFor(plan, "you");
      const stateSel = ui.h("select", { class: "su-in", "aria-label": "Your state", onChange: (e) => { v.state = e.target.value; } }, ui.h("option", { value: "" }, "Choose…"), STATES.map((s) => ui.h("option", { value: s.value, selected: s.value === v.state }, s.label)));
      if (v.own.length) {
        head("👋", "Who is this plan for?", null);
        add(card, haveNote(v.own), fieldset("Which state do you live in?", stateSel, "For state income tax."), ui.h("a", { class: "su-skip", href: "#/household/people" }, "Change the people on People"));
        current = { apply: (d) => applyYou(d, v) };
        actions("Continue", { noSkip: true });
        return;
      }
      head("👋", "Who is this plan for?", "First names only. Nothing else about you is asked.");
      const nameIn = ui.h("input", { class: "su-in", autocomplete: "given-name", enterkeyhint: "next", value: v.name, placeholder: "Your first name", onInput: (e) => { v.name = e.target.value; } });
      add(card, field("Your first name", nameIn, "So the plan can talk to you. You can leave it blank."));
      const tilesEl = tilesBox("Who is this plan for?", " three", true);
      const partnerWrap = ui.h("div", {});
      const opts = [{ key: "me", icon: "🙋", label: "Just me" }, { key: "spouse", icon: "💍", label: "Me and my spouse", line: "Married" }, { key: "partner", icon: "🤝", label: "Me and my partner", line: "Not married" }];
      const draw = () => {
        swap(tilesEl, ...opts.map((o) => tile(o, v.who === o.key, () => { v.who = o.key; draw(); }, { radio: true })));
        swap(partnerWrap, v.who === "me" ? "" : field(v.who === "spouse" ? "Your spouse's first name" : "Your partner's first name", ui.h("input", { class: "su-in", enterkeyhint: "next", value: v.partnerName, placeholder: "First name", onInput: (e) => { v.partnerName = e.target.value; } })));
      };
      draw();
      add(card, fieldset(null, tilesEl), partnerWrap,
        fieldset("Children who live with you", stepper(v.kids, 0, 9, (n) => { v.kids = n; }, "children who live with you", (n) => (n === 0 ? "None" : n === 1 ? "One child" : `${n} children`)), "Children you support. Their ages come later."),
        fieldset("Which state do you live in?", stateSel, "For state income tax."));
      current = { apply: (d) => applyYou(d, v) };
      actions();
    },

    money() {
      if (!ad.length) return needYou("💵", "What comes in?");
      head("💵", ad.length > 1 ? "What comes in for each of you?" : "What comes in?", "Before tax, as on a pay stub or offer letter. A yearly figure is fine.");
      const v = valuesFor(plan, "money");
      for (const p of ad) {
        const x = v.people[p.id];
        const own = existingPay(plan, p.id);
        const mine = p === self || ad.length === 1;
        const STATUS = [{ key: "work", icon: "💼", label: mine ? "I work" : "Works" }, { key: "retired", icon: "🌴", label: mine ? "I'm retired" : "Retired" }, { key: "none", icon: "⏸️", label: "Not working now" }];
        const tilesEl = tilesBox(`${p.name}: work`, " three", true);
        const body = ui.h("div", {});
        const draw = () => {
          swap(tilesEl, ...STATUS.map((o) => tile(o, x.status === o.key, () => { x.status = o.key; draw(); }, { radio: true })));
          swap(body, ...(x.status === "work" ? (own.length ? [haveNote(own.map((i) => `${i.name} ${money(i.amount)} ${PAY_PERIODS.find((o) => o.value === i.period)?.label.toLowerCase() ?? ""}`.trim()))] : [
            field("Pay before tax", moneyIn(x.amount, (val) => { x.amount = val; }, { label: `${p.name}: pay before tax`, placeholder: "65,000" })),
            fieldset("How often", seg(PAY_PERIODS, x.period, (val) => { x.period = val; }, `${p.name}: how often`)),
          ]) : x.status === "retired" ? [field("A pension a month, if any", moneyIn(x.pension, (val) => { x.pension = val; }, { label: `${p.name}: pension a month` }), "Social Security comes on the next question. Leave this blank if there is no pension.")]
            : x.status === "none" ? [ui.h("p", { class: "su-sub" }, "Nothing counted for now. You can add pay any time on Income.")] : []));
        };
        draw();
        add(card, group(who(p), tilesEl, body));
      }
      const o = v.other;
      add(card, group("Any other money coming in each month?",
        field("A month", moneyIn(o.amount, (val) => { o.amount = val; }, { label: "Other money a month", hint: "done" }), "Leave it blank if there is none."),
        fieldset("What kind", seg(OTHER_KINDS, o.kind, (val) => { o.kind = val; }, "Other money: what kind"))));
      firstGroup();
      current = { apply: (d) => applyMoney(d, v), words: (p2) => { const r = reflect(p2, "money"); return r ? `Got it: about ${money(r.monthly)} a month before tax.` : null; } };
      actions();
    },

    ages() {
      if (!ad.length) return needYou("🎂", "Your ages");
      head("🎂", ad.length > 1 ? "Your ages, and when you'd like to stop working" : "Your age, and when you'd like to stop working", "This decides when retirement money and Social Security start.");
      const v = valuesFor(plan, "ages", { today });
      const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
      const ageOf = (x) => { const y = Number(x.year); if (!(y >= 1900 && y <= year)) return null; const m = Number(x.month) || 7; return year - y - (month < m ? 1 : 0); };
      const SS = [{ value: "estimate", label: "Estimate it for me" }, { value: "statement", label: "I have my statement figure" }, { value: "getting", label: "I already get it" }, { value: "none", label: "I won't get any" }];
      for (const p of ad) {
        const x = v.people[p.id];
        const retiredNow = plan.guide?.setup?.status?.[p.id] === "retired";
        if (retiredNow) x.retired = true;
        if (retiredNow && x.ss.mode === "estimate") x.ss.mode = "getting";
        const liveAge = ui.h("p", { class: "su-live", "aria-live": "polite" });
        const stopBox = ui.h("div", {});
        const ssBody = ui.h("div", {});
        const showAge = () => { const a = ageOf(x); liveAge.textContent = a === null ? "" : `${a} years old`; };
        const monthSel = ui.h("select", { class: "su-in", "aria-label": `${p.name}: birth month`, onChange: (e) => { x.month = e.target.value; showAge(); drawStop(); drawSS(); } }, ui.h("option", { value: "" }, "Month"), MONTHS.map((m, i) => ui.h("option", { value: String(i + 1), selected: Number(x.month) === i + 1 }, m)));
        const yearIn = ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", maxlength: "4", value: x.year ? String(x.year) : "", placeholder: "Year", "aria-label": `${p.name}: birth year`, onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); x.year = e.target.value; showAge(); if (e.target.value.length === 4) { drawStop(); drawSS(); } } });
        function drawStop() {
          const a = ageOf(x);
          swap(stopBox,
            x.retired ? ui.h("p", { class: "su-sub" }, "Already retired.") : stepper(x.stopAge, Math.max(40, (a ?? 39) + 1), 85, (n) => { x.stopAge = n; drawSS(); }, `${p.name}: age to stop working`, (n) => (a === null ? `at ${n}` : `in ${n - a} year${n - a === 1 ? "" : "s"} (${year + n - a})`)),
            retiredNow ? null : toggle("Already retired", x.retired, (on) => { x.retired = on; drawStop(); drawSS(); }));
        }
        function drawSS() {
          const s = x.ss;
          if (s.record) { swap(ssBody, ui.h("p", { class: "su-sub" }, "Your ssa.gov record is in the plan: the Social Security page works from it.")); return; }
          let detail = null;
          if (s.mode === "estimate") {
            const by = Number(x.year), pay = yearlyPay(plan, p.id);
            const est = by >= 1900 ? estimateSocialSecurity({ birthYear: by, yearlyPay: pay, stopAge: x.retired ? ageOf(x) ?? 65 : x.stopAge, today }) : null;
            const fra = by >= 1900 ? fullRetirementAge(by) : null;
            detail = ui.h("p", { class: "su-live", "aria-live": "polite" }, est === null ? (by >= 1900 ? "Needs your pay (question 2) to estimate." : "Type the birth year above to see it.") : ["About ", ui.h("b", {}, `${money(est)} a month`), ` from age ${fra.years}${fra.months ? ` and ${fra.months} months` : ""}, in today's money. A rough guide; your statement at ssa.gov is exact.`]);
          } else if (s.mode === "statement") detail = field("Your monthly benefit at full retirement age", moneyIn(s.amount, (val) => { s.amount = val; }, { label: `${p.name}: Social Security at full retirement age` }), "On your statement at ssa.gov/myaccount.");
          else if (s.mode === "getting") detail = ui.h("div", {}, field("What you get a month", moneyIn(s.amount, (val) => { s.amount = val; }, { label: `${p.name}: Social Security a month` })), fieldset("It started at age", stepper(s.started, 62, 70, (n) => { s.started = n; }, `${p.name}: age Social Security started`)));
          else if (s.mode === "none") detail = ui.h("p", { class: "su-sub" }, "No Social Security counted. Some public jobs pay into a pension instead.");
          swap(ssBody, detail ?? "");
        }
        showAge(); drawStop(); drawSS();
        add(card, group(who(p) ?? "You",
          ui.h("div", { class: "su-field" }, ui.h("span", { class: "su-label" }, "Born"), ui.h("div", { class: "su-born" }, monthSel, yearIn), liveAge),
          fieldset(retiredNow ? "Work" : "Stop working at", stopBox),
          fieldset("Social Security", x.ss.record ? null : seg(retiredNow ? [SS[2], SS[1], SS[3]] : SS, x.ss.mode, (m) => { x.ss.mode = m; drawSS(); }, `${p.name}: Social Security`)), ssBody));
      }
      const kids = dependents(plan);
      if (kids.length) add(card, group("Children's birth years", ui.h("div", { class: "su-born" }, ...kids.map((k) => field(k.name, ui.h("input", { class: "su-in", inputmode: "numeric", enterkeyhint: "next", maxlength: "4", value: v.kids[k.id] ? String(v.kids[k.id]) : "", placeholder: "Year", onInput: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); v.kids[k.id] = e.target.value; } }))))));
      firstGroup();
      current = { apply: (d) => applyAges(d, v, today) };
      actions();
    },

    have() {
      head("🏦", "What do you have?", "Tap all that apply. Amounts come next.");
      const v = new Set(valuesFor(plan, "have"));
      const tilesEl = tilesBox("What do you have?");
      const draw = () => swap(tilesEl, ...HAVE.map((o) => tile(o, v.has(o.key), () => { if (v.has(o.key)) v.delete(o.key); else v.add(o.key); draw(); }, { have: askOwners(plan, o.key).length === 0 })));
      draw();
      add(card, tilesEl, haveNote(HAVE.flatMap((h) => existingHave(plan, h.key)).map(accLine)));
      current = { apply: (d) => applyHavePicks(d, [...v]) };
      actions();
    },

    "have-amounts"() {
      head("🧮", "About how much is in each?", "Today's balance or value. Round numbers are fine; you can make them exact later.");
      const v = valuesFor(plan, "have-amounts");
      for (const h of HAVE.filter((x) => picks(plan, "have").includes(x.key))) {
        for (const pid of askOwners(plan, h.key)) {
          if (!h.perAdult) {
            const label = h.key === "home" ? "Your home" : h.key === "car" ? "Your car" : h.label;
            add(card, group(null, field(`${h.icon} ${label}`, moneyIn(v[h.key], (val) => { v[h.key] = val; }, { label }), h.ask ?? null)));
            continue;
          }
          const p = ad.find((x) => x.id === pid);
          const extra = ui.h("div", {});
          const drawExtra = () => swap(extra,
            field("You put in a month", moneyIn(v[`contrib-${pid}`], (val) => { v[`contrib-${pid}`] = val; }, { label: `${p?.name}: put in a month` }), "From pay, if you save. Leave it blank if not."),
            v[`kind-${pid}`] === "work" ? field("Your employer adds a month", moneyIn(v[`match-${pid}`], (val) => { v[`match-${pid}`] = val; }, { label: `${p?.name}: employer adds a month` }), "The match, if there is one. It's on your pay stub.") : null);
          drawExtra();
          add(card, group(`${h.icon} ${ad.length > 1 ? `${possessive(p)} retirement savings` : "Retirement savings"}`,
            fieldset("Where", seg(RETIRE_KINDS, v[`kind-${pid}`], (val) => { v[`kind-${pid}`] = val; drawExtra(); }, `${p?.name}: retirement through work or on your own`), "Through work: a 401(k) or 403(b). On your own: an IRA."),
            field("Saved so far", moneyIn(v[`${h.key}-${pid}`], (val) => { v[`${h.key}-${pid}`] = val; }, { label: `${p?.name}: retirement saved so far` }), "Add up every account of that kind."),
            extra));
        }
      }
      firstGroup();
      current = { apply: (d) => applyHaveAmounts(d, v, today), words: (p2) => { const r = reflect(p2, "have-amounts"); return r ? `Got it: ${money(r.total)} saved and invested in all.` : null; } };
      actions();
    },

    owe() {
      head("🧾", "Do you owe money on anything?", "Tap all that apply. Most people do; it helps the plan put things in the right order.");
      const v = new Set(valuesFor(plan, "owe"));
      const tilesEl = tilesBox("Do you owe money on anything?");
      const draw = () => swap(tilesEl,
        ...OWE.map((o) => tile(o, v.has(o.key), () => { v.delete("none"); if (v.has(o.key)) v.delete(o.key); else v.add(o.key); draw(); }, { have: existingOwe(plan, o.key).length > 0 })),
        tile({ icon: "🎉", label: "No, I'm debt free" }, v.has("none"), () => { const on = !v.has("none"); v.clear(); if (on) v.add("none"); draw(); }, { wide: true }));
      draw();
      add(card, tilesEl, haveNote(OWE.flatMap((o) => existingOwe(plan, o.key)).filter((a, i, all) => all.indexOf(a) === i).map(accLine)));
      current = { apply: (d) => applyOwePicks(d, [...v]), words: (p2) => (reflect(p2, "owe")?.kind === "debt-free" ? "Debt free: that makes everything easier." : null) };
      actions();
    },

    "owe-amounts"() {
      head("✍️", "Tell us about each one", "What you owe today and what you pay a month. The rate is on the statement; leave it blank if you don't know it.");
      const v = valuesFor(plan, "owe-amounts");
      for (const o of OWE.filter((x) => picks(plan, "owe").includes(x.key) && !existingOwe(plan, x.key).length)) {
        const x = v[o.key];
        const body = ui.h("div", {});
        const draw = () => swap(body, ...(o.key === "credit" && x.paidInFull ? [ui.h("p", { class: "su-sub" }, "Then your cards cost you nothing in interest. Nothing to add.")] : [
          field("Still owed", moneyIn(x.owed, (val) => { x.owed = val; }, { label: `${o.label}: still owed` }), o.key === "credit" ? "All your cards together" : null),
          field("Paid a month", moneyIn(x.payment, (val) => { x.payment = val; }, { label: `${o.label}: paid a month` }), o.key === "credit" ? "The minimum, or what you usually pay" : null),
          field("Interest rate a year", pctIn(x.rate, (val) => { x.rate = val; }, `${o.label}: interest rate a year`, o.key === "credit" ? "e.g. 24.9" : "e.g. 6.5"), `Blank: a typical ${pctOf(TYPICAL_RATES[o.key])} for now${o.key === "mortgage" ? " (today's rate; an older loan may cost less)" : ""}.`),
        ]));
        draw();
        add(card, group(`${o.icon} ${o.label}`,
          o.key === "credit" ? fieldset("Do you pay the whole bill every month?", seg([{ value: "yes", label: "Yes, every month" }, { value: "no", label: "No, some carries over" }], x.paidInFull ? "yes" : x.owed !== "" ? "no" : null, (val) => { x.paidInFull = val === "yes"; draw(); }, "Do you pay the whole card bill every month?")) : null,
          body));
      }
      firstGroup();
      current = { apply: (d) => applyOweAmounts(d, v, today), words: (p2) => { const r = reflect(p2, "owe-amounts"); return r?.kind === "owe" ? `Got it: ${money(r.total)} owed in all.` : r?.kind === "paid-in-full" ? "Paid in full every month: no card debt to plan for." : null; } };
      actions();
    },

    spend() {
      const v = valuesFor(plan, "spend");
      const base = spendBase(plan), rows = spendRows(plan), mortgage = hasMortgage(plan);
      head("🛒", "What do you spend in a typical month?", "Guesses are fine. Leave out what you save.");
      if (base.existingCount) add(card, ui.h("p", { class: "su-have" }, "Already in your plan: ", ui.h("b", {}, `${money(base.existing)} a month`), ` in ${base.existingCount} bill${base.existingCount === 1 ? "" : "s"}. Add only what's missing.`));
      if (base.loanPayments > 0) add(card, ui.h("p", { class: "su-have" }, "Not counting the ", ui.h("b", {}, `${money(base.loanPayments)} a month`), " of loan and card payments you told us: they're already in."));
      const modeEl = tilesBox("How to answer", "", true);
      const body = ui.h("div", {});
      const totalEl = ui.h("b", {});
      const later = { typed: v.retireTyped, value: v.retireMonthly };
      let laterInput = null;
      const num = (s) => parseMoney(s) ?? 0;
      const rowsSum = (g) => rows.filter((s) => !g || s.group === g).reduce((t, s) => t + num(v.rows[s.key]), 0);
      const sums = {};
      const upd = () => {
        const own = v.mode === "total" ? num(v.total) : rowsSum();
        totalEl.textContent = money(own + base.existing + base.loanPayments);
        for (const g of ["must", "else"]) if (sums[g]) sums[g].textContent = money(rowsSum(g));
        if (laterInput && !later.typed) {
          const core = base.existingCore + (v.mode === "total" ? num(v.total) : rows.filter((s) => s.key !== "childcare").reduce((t, s) => t + num(v.rows[s.key]), 0));
          laterInput.value = core > 0 ? groupDigits(String(Math.round(core / 10) * 10)) : "";
          later.value = laterInput.value;
        }
      };
      const row = (s) => ui.h("label", { class: "su-row" },
        ui.h("span", {}, ui.h("span", { class: "su-label" }, s.key === "housing" && mortgage ? s.labelMortgage : s.label), ui.h("span", { class: "su-sub" }, s.key === "housing" && mortgage ? s.helpMortgage : s.help)),
        moneyIn(v.rows[s.key], (val) => { v.rows[s.key] = val; upd(); }, { label: s.label }));
      const draw = () => {
        swap(modeEl, tile({ icon: "📋", label: "A few groups", line: "Rent, food, car..." }, v.mode !== "total", () => { v.mode = "rows"; draw(); }, { radio: true }), tile({ icon: "🎯", label: "One rough total", line: "If you're not sure" }, v.mode === "total", () => { v.mode = "total"; draw(); }, { radio: true }));
        if (v.mode === "total") swap(body, field(base.existingCount ? "Everything else, in a month" : "All your spending in a month", moneyIn(v.total, (val) => { v.total = val; upd(); }, { label: "All your spending in a month", placeholder: "3,500" }), "Home, food, car, fun: everything. It counts as must-pay, to be safe."));
        else {
          sums.must = ui.h("span", { class: "sum" }); sums.else = ui.h("span", { class: "sum" });
          const must = rows.filter((s) => s.group === "must"), other = rows.filter((s) => s.group === "else");
          swap(body,
            must.length ? ui.h("div", { class: "su-group first" }, ui.h("div", { class: "su-gh" }, "Must-pay bills", sums.must), ...must.map(row)) : null,
            other.length ? ui.h("div", { class: "su-group" }, ui.h("div", { class: "su-gh" }, "Everything else", sums.else), ...other.map(row)) : null,
            rows.length ? null : ui.h("p", { class: "su-sub" }, "Every kind of bill is already in your plan."));
        }
        upd();
      };
      add(card, modeEl, body, ui.h("div", { class: "su-total" }, ui.h("span", {}, "In all, about a month"), totalEl));
      if (!allRetired(plan)) {
        const box = moneyIn(later.value, (val) => { later.value = val; later.typed = true; }, { label: "Spending a month once you stop working", hint: "done" });
        laterInput = box.querySelector("input");
        add(card, group("Once you stop working, about how much a month?", box, ui.h("span", { class: "su-sub" }, "We start from today's spending without loan payments and childcare. Change it if you expect to spend more or less.")));
      }
      draw();
      current = { apply: (d) => applySpend(d, { ...v, retireMonthly: later.value }), words: (p2) => { const r = reflect(p2, "spend"); return r ? `Got it: about ${money(r.monthly)} a month, ${money(r.essential)} of it bills you must pay.` : null; } };
      actions();
    },

    goals() {
      head("🎯", "What are you working toward?", "Pick any. You can add more later.");
      const v = new Set(valuesFor(plan, "goals"));
      const tilesEl = tilesBox("What are you working toward?");
      const draw = () => swap(tilesEl, ...GOALS.map((o) => tile(o, v.has(o.key), () => { if (v.has(o.key)) v.delete(o.key); else v.add(o.key); draw(); }, { have: !o.focus && existingGoal(plan, o.key).length > 0 })));
      draw();
      add(card, tilesEl, haveNote((plan.goals ?? []).filter((g) => !String(g.id).startsWith("setup-")).map((g) => g.name)));
      current = { apply: (d) => applyGoalPicks(d, [...v]) };
      actions();
    },

    "goal-details"() {
      head("🗓️", "How much, and by when?", "A rough target is enough to see what it takes each month.");
      const v = valuesFor(plan, "goal-details", { today });
      for (const g of GOALS.filter((x) => !x.focus && picks(plan, "goals").includes(x.key) && !existingGoal(plan, x.key).length)) {
        const x = v[g.key];
        if (g.key === "cushion") {
          const live = ui.h("div", { "aria-live": "polite" });
          const drawC = () => {
            const c = cushion(plan, x.months, today);
            const share = c.target > 0 ? Math.min(1, c.now / c.target) : 0;
            swap(live, c.essential > 0
              ? ui.h("p", { class: "su-live" }, "That's ", ui.h("b", {}, money(c.target)), `: ${x.months} month${x.months === 1 ? "" : "s"} of the ${money(c.essential)} in must-pay bills.`)
              : ui.h("p", { class: "su-live" }, "Your must-pay bills (question 6) set the amount."),
              c.essential > 0 ? ui.h("p", { class: "su-live" }, `You already have ${money(c.now)} in checking and savings: ${(Math.round((c.covered ?? 0) * 10) / 10).toFixed(1)} of ${x.months} months.`) : null,
              c.essential > 0 ? ui.h("div", { class: "su-meter", role: "img", "aria-label": `${Math.round(share * 100)}% of the cushion` }, ui.h("span", { style: { width: `${Math.round(share * 100)}%` } })) : null);
          };
          drawC();
          add(card, group(`${g.icon} ${g.label}`, fieldset("How many months of must-pay bills?", stepper(x.months, 1, 12, (n) => { x.months = n; drawC(); }, "months of must-pay bills")), live, ui.h("span", { class: "su-sub" }, "Three to six months is the usual advice; more if your pay goes up and down.")));
          continue;
        }
        const dateBox = ui.h("div", {});
        const opts = [...DATE_CHIPS.map((n) => ({ value: String(n), label: `${n} year${n === 1 ? "" : "s"}` })), { value: "date", label: "Pick a date" }];
        let chip = x.years ? String(x.years) : x.date ? "date" : String(g.years);
        const drawDate = () => swap(dateBox, chip === "date" ? ui.h("input", { class: "su-in", type: "date", value: x.date || "", min: today, "aria-label": `${g.label}: by when`, onInput: (e) => { x.date = e.target.value; x.years = null; } }) : "");
        drawDate();
        add(card, group(`${g.icon} ${g.label}`,
          g.key === "other" ? field("What is it?", ui.h("input", { class: "su-in", enterkeyhint: "next", value: x.name, placeholder: "e.g. A new kitchen", onInput: (e) => { x.name = e.target.value; } })) : null,
          field("How much", moneyIn(x.target, (val) => { x.target = val; }, { label: `${g.label}: how much`, placeholder: g.key === "home" ? "60,000" : g.key === "trip" ? "4,000" : "10,000" }), g.key === "home" ? "The down payment and closing costs" : null),
          fieldset("By when", seg(opts, chip, (val) => { chip = val; if (val !== "date") { x.years = Number(val); x.date = ""; } drawDate(); }, `${g.label}: by when`)), dateBox));
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
    const st = standing(plan, { today });
    add(card, ui.h("div", { class: "su-done-head" }, ui.h("div", { class: "su-check", "aria-hidden": "true" }, "✓"),
      ui.h("h1", { class: "su-q", id: "su-q", tabindex: "-1" }, firstName ? `You did it, ${firstName}. Here is your money on one page.` : "You did it. Here is your money on one page."),
      ui.h("p", {}, st.headline)));
    const counters = [];
    const fig = (cls, label, value, sub, status, href) => {
      const s = ui.stat(label, typeof value === "number" ? money(value) : value, sub);
      if (typeof value === "number") counters.push({ el: s.querySelector(".stat-value"), to: value });
      return ui.h(href ? "a" : "div", { class: `su-fig ${cls}`, href: href ?? null }, s, status ? ui.h("div", { class: "st" }, status) : null);
    };
    add(card, ui.h("div", { class: "su-stand" },
      fig(st.netWorth >= 0 ? "ok" : "warn", "What you own, minus what you owe", st.netWorth, st.netWorth >= 0 ? `You own ${money(st.assets)} and owe ${money(st.liabilities)}.` : "Common with a mortgage or student loans. It grows as you pay them down.", st.netWorth >= 0 ? "● A solid base" : "● Grows as the loans shrink"),
      st.spare === null ? fig("open", "Left over each month", "Not yet", "Needs your pay and spending.", "Add them ›", "#/cashflow/income")
        : fig(st.spare >= 0 ? "ok" : "warn", "Left over each month", st.spare, "After federal tax, bills and saving. State tax is not counted yet.", st.spare >= 0 ? "● Money to put to work" : "● More goes out than comes in"),
      st.runway === null ? fig("open", "Safety cushion", "Not yet", "Needs your spending and savings.", "Add them ›", "#/cashflow/expenses")
        : fig(st.runwayStatus === "ok" ? "ok" : "warn", "Safety cushion", `${(Math.round(st.runway * 10) / 10).toFixed(1)} months`, `of must-pay bills in cash. Aim for ${st.runwayTarget ?? 6}.`, st.runwayStatus === "ok" ? "● Covered" : "● Worth building up"),
      !st.retirementKnown || !st.retire ? fig("open", "Retirement", "Not worked out yet", "Needs Social Security and birth dates.", "Add them ›", "#/retirement/social-security")
        : fig(st.retire.verdict === "on track" ? "ok" : "warn", "Retirement", st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : st.retire.shortAge ? `Short at ${st.retire.shortAge}` : "Needs a look", "If nothing changes.", st.retire.verdict === "on track" ? "● The money lasts" : "● Small changes help", "#/retirement/projection")));
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
    const notes = st.later.map((l) => ui.h("li", {}, ui.h("a", { href: l.href }, l.label)));
    if (st.guessed.length) notes.push(ui.h("li", {}, `The interest rate on ${and(st.guessed.map((g) => `${g.name.toLowerCase()} (a typical ${pctOf(g.rate)})`))}: `, ui.h("a", { href: "#/balance/liabilities" }, "type the real one on What you owe")));
    if (notes.length) add(card, ui.h("h2", { class: "su-h2" }, "Not counted yet"), ui.h("ul", { class: "su-later-list" }, notes));
    const a = plan.assumptions ?? {};
    const pc = (x) => `${Math.round(Number(x) * 1000) / 10}%`;
    const looked = !!a.reviewedAt;
    add(card, ui.h("details", { class: "card fold fold-card su-guess" },
      ui.h("summary", {}, ui.h("h2", {}, "How the plan makes its guesses"), ui.h("span", { class: "fold-status" }, looked ? "✓ Looked over" : "Worth a look"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("ul", { class: "su-list" },
        [["🏷️", `Prices rise ${pc(a.inflation ?? 0.03)} a year`, "Inflation, the long-run average"],
          ["📈", `Stocks grow about ${pc(a.returnStocks ?? 0.07)} a year, bonds ${pc(a.returnBonds ?? 0.04)}`, "Before inflation, on average; some years fall"],
          ["🎂", `The plan runs to age ${a.planEndAge ?? 95}`, "So the money is planned to last"],
          ["🛟", `A cushion of ${a.emergencyMonths ?? 6} months of must-pay bills`, "For a lost job or a big repair"]]
          .map(([i, b, m]) => ui.h("li", {}, ui.h("span", { class: "su-li", "aria-hidden": "true" }, i), ui.h("div", {}, ui.h("b", {}, b), ui.h("span", { class: "m" }, m))))),
      ui.h("div", { class: "su-gbtns" }, looked ? null : ui.h("button", { type: "button", onClick: () => { pending = [{ kind: "ok", text: "Saved: the plan's guesses are looked over." }]; store.update((d) => applyGuesses(d, today)); } }, "These sound fine"), ui.h("a", { href: "#/system/assumptions", class: "btn secondary" }, "Change them ›"))));
    add(card, ui.h("div", { class: "su-end" }, ui.h("a", { class: "btn", href: "#/overview/dashboard" }, "Go to my dashboard"), ui.h("button", { type: "button", class: "secondary", onClick: () => go("you") }, "Change an answer")));
    try { card.querySelector("#su-q")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
  }

  (UI[screenId] ?? UI.welcome)();
  add(root, ui.h("p", { class: "su-foot" }, "🔒 Everything stays on your own computer and phone. No bank logins or account numbers, ever."));
  if (screen.q) { try { card.querySelector("#su-q")?.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } }
}
