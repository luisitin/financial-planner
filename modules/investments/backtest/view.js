// modules/investments/backtest/view.js -- DOM only. Two mixes through history: the verdict,
// the growth lines and the choices (mixes, start year, real or nominal) as chips; then one card of quiet rows:
// "9 more numbers" (the figures side by side, opt spec 6.1) and "Add or take out money each year" (gap list, next 60,
// item 52): an amount put in or taken out at the start of every year, run over every stretch of history; nothing saved.
import { compute, flowChoices, FLOW_YEARS, FLOW_YEARS_FIRST } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";
import { parts, choice } from "../../../core/ui/more.js";

// a mix's name inside a sentence: first letter small (a page name keeps its capitals), one stop at the end
const asPart = (label) => { const t = label.charAt(0).toLowerCase() + label.slice(1); return /[.?!]$/.test(t) ? t : `${t}.`; };
const inSentence = (label) => asPart(label).slice(0, -1);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const state = { mixA: null, mixB: "60-40", from: 1928, real: false };   // mixA null: compute's default (your target, else what you hold)

/** "Add or take out money each year": the direction ("in" | "out" | null), the amount ("plan": the plan's own figure
 *  for that direction, or a typed number), the start ("invested", 0 or a typed number; null: what you have invested,
 *  else nothing), the stretch in years; `cleared` lives for one draw. Kept like the mix chips above, until the app is
 *  closed; never in the plan and never stored. Another plan loaded in the same tab starts it over. While a way is
 *  picked the row is drawn open (a tap anywhere on the page draws it again: the answer stays in sight); a person who
 *  shuts it keeps it shut (the shell puts back a row shut by hand where the page drew it as before). */
const FLOW_EMPTY = () => ({ dir: null, amount: null, start: null, years: FLOW_YEARS_FIRST });
let flow = FLOW_EMPTY(), cleared = false, flowPlan = null;
/** A pick inside the row: the group tapped ("way", "amount", "start", "years"); its answer is brought into sight on the
 *  next draw when the answer and that group fit on the screen together (critic P2), as Rebalance does its trade's. */
let revealNext = null;
/** For tests: start over, as on a new plan. */
export const resetFlow = () => { flow = FLOW_EMPTY(); cleared = false; flowPlan = null; revealNext = null; };
/** Whether the answer and the group just tapped fit on one screen under the top bar (80 px for the bar and the edges):
 *  then the answer is scrolled into sight; otherwise the page stays, so the thumb's chips never leave the screen. */
export function bothInSight(answerRect, tappedRect, screenHeight) {
  if (!answerRect || !tappedRect || !(screenHeight > 0)) return false;
  return Math.max(answerRect.bottom, tappedRect.bottom) - Math.min(answerRect.top, tappedRect.top) <= screenHeight - 80;
}

/** The figure a choice shows for the picks (critic P1: the box under "Type my own" opened on the word "plan"): the
 *  plan's own amount for the way picked, the amount invested, else what was typed. */
export function flowShown(f, c) {
  const planFigure = f.dir === "in" ? c.saving : f.dir === "out" ? c.spending : null;
  return {
    amount: f.amount === "plan" ? planFigure : typeof f.amount === "number" ? f.amount : null,
    start: f.start === null || f.start === "invested" ? (c.invested ?? 0) : Number(f.start) || 0,
  };
}
/** A figure picked or typed back into the picks: the plan's own figure is kept as "plan" / "invested" (so a typed
 *  amount and the plan's are told apart when the way changes). */
export const flowPicked = {
  amount: (v, f, c) => { const planFigure = f.dir === "in" ? c.saving : f.dir === "out" ? c.spending : null; return planFigure !== null && v === planFigure ? "plan" : v; },
  start: (v, c) => (c.invested && v === c.invested ? "invested" : v),
};
/** The ask the compute runs, from the picks and the plan's figures, or null while something is missing. */
export function flowAsk(f, c) {
  if (!f.dir) return null;
  const { amount: yearly, start } = flowShown(f, c);
  if (!(yearly > 0)) return null;
  return { dir: f.dir, yearly, start, years: f.years };
}

const years = (n) => `${n} year${n === 1 ? "" : "s"}`;
/** What is left at the end, in words: an end under half a dollar (the last year's amount paid out exactly) is "nothing
 *  left", never "$0" after "lasted" (critic M2). */
const left = (end, money, unit = "") => (end < 0.5 ? "nothing left" : `${money(end)}${unit}`);
const allOf = (n) => (n === 1 ? "the one stretch" : `all ${n} stretches`);
/**
 * flowSentence(f, { money, label }) -> the one sentence that answers, for each case (R5): no stretch fits the history;
 * nothing at the start to take out of; a start smaller than one year's amount; every stretch ran out; some did; none
 * did; money put in. `f` is withFlows' result for the first mix, `label` that mix's name.
 */
export function flowSentence(f, { money, label }) {
  const L = inSentence(label);
  if (!f.n) return `From ${f.from} there are ${f.history} years of history, fewer than ${f.years}: pick a shorter stretch, or an earlier start above.`;
  if (f.dir === "out") {
    if (!(f.start > 0)) return "There is nothing at the start to take money out of: pick how much there is at the start.";
    if (f.start < f.yearly) return `${money(f.start)} at the start is less than one year's ${money(f.yearly)}, so the money runs out in the first year: pick a larger start or a smaller amount.`;
    const lead = `Taking out ${money(f.yearly)} a year from ${money(f.start)}, ${L}`;
    if (f.ranOut === f.n) return `${lead} ran out in ${allOf(f.n)} of ${f.years} years since ${f.from}: it lasted ${f.minLasted === f.maxLasted ? `${years(f.minLasted)} each time` : `${f.minLasted} to ${f.maxLasted} years`}.`;
    if (f.ranOut > 0) return `${lead} ran out in ${f.ranOut} of the ${f.n} stretches of ${f.years} years since ${f.from}. The worst start was ${f.worst.start}: the money ran out in ${f.worst.ranOut}.`;
    return `${lead} lasted the full ${f.years} years in ${allOf(f.n)} since ${f.from}. The worst start, ${f.worst.start}, ended with ${left(f.worst.end, money, " in today's dollars")}; the middle one with ${left(f.middle, money)}.`;
  }
  return `Putting in ${money(f.yearly)} a year ${f.start > 0 ? `on top of ${money(f.start)}` : "from nothing"}, after ${f.years} years ${L} ended with between ${money(f.worst.end)} (the ${f.worst.start} start) and ${money(f.best.end)} (the ${f.best.start} start) in today's dollars; the middle start with ${money(f.middle)}.`;
}
/** otherSentence(f, { money, label }) -> the second mix in one sentence, or null where the first mix's sentence says
 *  there is nothing to run (no stretch fits, nothing or too little at the start). */
export function otherSentence(f, { money, label }) {
  if (!f.n || (f.dir === "out" && !(f.start >= f.yearly && f.start > 0))) return null;
  const L = cap(label);
  if (f.dir === "out") {
    if (f.ranOut === f.n) return `${L} ran out in ${f.n === 1 ? "it too" : `all ${f.n}`}.`;
    if (f.ranOut > 0) return `${L} ran out in ${f.ranOut} of the ${f.n}.`;
    return `${L} lasted in ${f.n === 1 ? "it" : `all ${f.n}`}; its worst start ended with ${left(f.worst.end, money)}.`;
  }
  return `${L} ended with between ${money(f.worst.end)} and ${money(f.best.end)}; the middle start with ${money(f.middle)}.`;
}
/** flowCaveat(f, { planSpending, healthOnTop }) -> the line under the answer when money comes out (critic P3: the verdict
 *  read alone was scary; critic M1: the plan's spending figure leaves out the health insurance the plan adds on top of it),
 *  or null when no stretch was run. */
export function flowCaveat(f, { planSpending = false, healthOnTop = false } = {}) {
  if (!f || !f.n || f.dir !== "out" || !(f.start > 0 && f.start >= f.yearly)) return null;
  return `This leaves out Social Security, pensions${planSpending && healthOnTop ? ", pay and the health insurance your plan adds on top" : " and pay"}: all of it comes from this money and rises with prices.`;
}
/** The line while something is still to pick. */
export const flowPrompt = (f) => (!f.dir ? "Pick whether money goes in or comes out each year." : "Pick or type how much each year.");
/** The row's title (pinned in qa/first-view-lib.mjs) and its status: the amount and its way, while one is picked. */
export const FLOW_TITLE = "Add or take out money each year";
export function flowSays(ask, money) {
  if (!ask) return "";
  const s = `${money(ask.yearly)} ${ask.dir} a year`;
  return s.length <= 20 ? s : `money ${ask.dir} a year`;
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const planKey = plan?.meta?.createdAt ?? null;
  if (flowPlan !== planKey) { flow = FLOW_EMPTY(); cleared = false; flowPlan = planKey; }
  const c = flowChoices(plan, { today: fmt.today() });
  const ask = flowAsk(flow, c);
  const d = compute(plan, { today: fmt.today(), ...state, ...(ask ? { flow: ask } : {}) });
  const money = (n) => fmt.money(n, cur);
  // the shell draws the page again in place (open rows, the scroll and the tapped chip stay); a stand-in without it
  // draws this root again
  const redraw = () => { if (ctx.redraw) ctx.redraw(); else { root.innerHTML = ""; render(root, ctx); } };
  const mixText = (m) => `${Math.round(m.stocks * 100)}% stocks, ${Math.round(m.bonds * 100)}% bonds${m.bills > 0.005 ? `, ${Math.round(m.bills * 100)}% cash` : ""}`;
  const A = d.a, B = d.b;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${money(10000)} in ${A.from} became ${money(A.end)} by ${A.to}`),
    ui.h("p", { class: "lede" }, `${d.mixA.label} (${mixText(d.mixA)}): ${fmt.pct(A.cagr, 1)} a year${d.real ? " above inflation" : ""}, the worst year ${fmt.pct(A.stats.worst, 0)} (${A.worstYear}), the deepest fall ${fmt.pct(A.drawdown.depth, 0)} from ${A.drawdown.peakYear}${A.drawdown.recoveryYear ? `, back to its old level by ${A.drawdown.recoveryYear}` : ", not yet back to its old level"}. ${d.mixB.label} (${mixText(d.mixB)}) ended at ${money(B.end)}: ${fmt.pct(B.cagr, 1)} a year, worst year ${fmt.pct(B.stats.worst, 0)}, deepest fall ${fmt.pct(B.drawdown.depth, 0)}.`),
    ui.h("p", { class: "muted small" }, `${A.years} years of history, ${d.real ? "in today's dollars" : "in each year's dollars"}. The past is a range of what markets do, not a forecast.`),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  const chip = (label, on, fn) => ui.h("button", { type: "button", class: `chip${on ? " on" : ""}`, onClick: fn }, label);
  const mixChips = (which) => ui.h("div", { class: "chips" }, [
    chip(d.ownSource === "own" ? "Your target" : "Your plan's mix", (state[which] ?? d.defaultA) === "own", () => { state[which] = "own"; redraw(); }),
    d.held ? chip("What you hold", (state[which] ?? d.defaultA) === "held", () => { state[which] = "held"; redraw(); }) : null,
    ...d.presets.map((p) => chip(p.label, state[which] === p.key, () => { state[which] = p.key; redraw(); })),
  ]);
  root.append(ui.card("Which mixes",
    ui.h("div", { class: "muted small" }, "First mix"), mixChips("mixA"),
    ui.h("div", { class: "muted small", style: { marginTop: "6px" } }, "Compared with"), mixChips("mixB"),
    ui.h("div", { class: "muted small", style: { marginTop: "6px" } }, "Starting in"), ui.h("div", { class: "chips" }, d.startYears.map((y) => chip(String(y), state.from === y, () => { state.from = y; redraw(); }))),
    ui.h("div", { class: "chips" }, chip("Dollars of each year", !state.real, () => { state.real = false; redraw(); }), chip("Today's dollars", state.real, () => { state.real = true; redraw(); })),
    // the answer to each tap, under the chips: the headline is a screen above them (stress test INV-7)
    ui.h("p", { class: "small", "aria-live": "polite", style: { marginTop: "10px", fontWeight: "600" } }, `${money(10000)} from ${A.from}: ${asPart(d.mixA.label).slice(0, -1)} became ${money(A.end)}${d.real ? " in today's dollars" : ""}; ${asPart(d.mixB.label).slice(0, -1)} became ${money(B.end)}.`),
  ));
  root.append(ui.card(`Growth of ${money(10000)}`,
    lineChart({ years: A.labels, series: [{ values: A.values, width: 2.5 }, { values: B.values, color: "var(--muted)", dash: "4 3" }], marks: A.drawdown.troughYear ? [{ year: A.drawdown.troughYear, label: "low" }] : [], label: "growth of 10,000, log scale", log: true }),
    ui.h("p", { class: "muted small" }, `Solid: ${asPart(d.mixA.label)} Dashed: ${asPart(d.mixB.label)} Log scale, so equal slopes are equal growth rates.`),
  ));
  root.append(ui.h("div", {}, parts(ctx, numbersPart(ctx, d, money), flowPart(ctx, d, c, ask, money, redraw))));
}

// ---------------------------------------------------------------- "N more numbers": the two mixes side by side (moved, opt spec 6.1)
function numbersPart(ctx, d, money) {
  const { ui, fmt } = ctx;
  const A = d.a, B = d.b;
  const row = (label, fa, fb) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, label), ui.h("span", { class: "rec-value" }, fa)), ui.h("div", { class: "rec-sub" }, `${d.mixB.label}: ${fb}`));
  const rows = [
    row("Ended at", money(A.end), money(B.end)),
    row("Average growth a year", fmt.pct(A.cagr, 1), fmt.pct(B.cagr, 1)),
    row("Ups and downs (standard deviation)", fmt.pct(A.stats.stdev, 0), fmt.pct(B.stats.stdev, 0)),
    row("Worst year", `${fmt.pct(A.stats.worst, 0)} in ${A.worstYear}`, `${fmt.pct(B.stats.worst, 0)} in ${B.worstYear}`),
    row("Best year", `${fmt.pct(A.stats.best, 0)} in ${A.bestYear}`, `${fmt.pct(B.stats.best, 0)} in ${B.bestYear}`),
    row("Years with a loss", `${A.stats.lossYears} of ${A.years}`, `${B.stats.lossYears} of ${B.years}`),
    row("Deepest fall", `${fmt.pct(A.drawdown.depth, 0)}, ${A.drawdown.peakYear} to ${A.drawdown.troughYear ?? "-"}${A.drawdown.recoveryYear ? `, back by ${A.drawdown.recoveryYear}` : ""}`, `${fmt.pct(B.drawdown.depth, 0)}, ${B.drawdown.peakYear} to ${B.drawdown.troughYear ?? "-"}${B.drawdown.recoveryYear ? `, back by ${B.drawdown.recoveryYear}` : ""}`),
    A.worstTen ? row("Worst ten years", `${fmt.pct(A.worstTen.rate, 1)} a year, ${A.worstTen.from}-${A.worstTen.to}`, B.worstTen ? `${fmt.pct(B.worstTen.rate, 1)} a year, ${B.worstTen.from}-${B.worstTen.to}` : "-") : null,
    A.bestTen ? row("Best ten years", `${fmt.pct(A.bestTen.rate, 1)} a year, ${A.bestTen.from}-${A.bestTen.to}`, B.bestTen ? `${fmt.pct(B.bestTen.rate, 1)} a year, ${B.bestTen.from}-${B.bestTen.to}` : "-") : null,
  ].filter(Boolean);
  return { id: "numbers", kind: "more", n: rows.length, noun: "numbers", body: () => [
    ui.h("ul", { class: "records" }, rows),
    ui.h("p", { class: "muted small" }, "Sources: Robert Shiller's monthly data (1871-1927) and Aswath Damodaran's yearly returns (1928 on): the S&P 500 with dividends, 10-year Treasuries, 3-month bills, CPI."),
  ] };
}

// ---------------------------------------------------------------- "Add or take out money each year" (gap list, next 60, item 52)
/** The row: the way the money goes, then the answer under it (the first mix in one sentence, what it leaves out when
 *  money comes out, the second mix in one line), then how much, what there is at the start and for how long (chips
 *  first; "Type my own" opens one box on the figure shown) and what is left after each start year as a picture.
 *  Nothing here calls store.update. */
function flowPart(ctx, d, c, ask, money, redraw) {
  const { ui } = ctx;
  const h = ui.h;
  const wasCleared = cleared;
  cleared = false;
  const set = (change, group) => { Object.assign(flow, change); revealNext = group; redraw(); };
  const chip = (label, on, fn) => h("button", { type: "button", class: `chip${on ? " on" : ""}`, "aria-pressed": on ? "true" : "false", onClick: () => { if (!on) fn(); } }, label);
  // a label sits on its chips, one block in the row's grid (the page's own "Which mixes" card has them that close)
  const labelled = (t, chips) => h("div", {}, h("div", { class: "muted small", style: { marginBottom: "4px" } }, t), chips);
  const planFigure = flow.dir === "in" ? c.saving : flow.dir === "out" ? c.spending : null;
  // a direction tapped takes the plan's own figure for it (one tap to an answer); a typed amount stays
  const way = (dir) => set({ dir, amount: typeof flow.amount === "number" ? flow.amount : (dir === "in" ? c.saving : c.spending) ? "plan" : null }, "way");
  const body = () => {
    const f = d.flow?.a ?? null, fb = d.flow?.b ?? null;
    const shown = flowShown(flow, c);
    const caveat = flowCaveat(f, { planSpending: flow.amount === "plan", healthOnTop: c.healthOnTop });
    const other = f ? otherSentence(fb, { money, label: d.mixB.label }) : null;
    // the answer sits right under the way it answers (critic P2: under the four rows of choices it was a screen below the
    // tap); the amount, the start and the stretch follow it, and change it in place above the thumb
    const answer = f ? h("div", { style: { display: "grid", gap: "8px" }, "aria-live": "polite", dataset: { flowAnswer: "" } },
      h("p", { style: { fontWeight: "600" } }, flowSentence(f, { money, label: d.mixA.label })),
      caveat ? h("p", { class: "small" }, caveat) : null,
      other ? h("p", { class: "small" }, other) : null,
    ) : h("p", { class: "small", dataset: { flowAnswer: "" } }, flowPrompt(flow));
    const groups = {
      way: labelled("Each year", h("div", { class: "chips", role: "group", "aria-label": "Each year" }, chip("Put money in", flow.dir === "in", () => way("in")), chip("Take money out", flow.dir === "out", () => way("out")))),
      amount: flow.dir ? labelled("How much a year", choice(ctx, { id: "flowAmount", label: "How much a year",
        presets: planFigure ? [{ value: planFigure, label: flow.dir === "in" ? `Your yearly saving: ${money(planFigure)}` : `Your retirement spending: ${money(planFigure)}` }] : [],
        value: shown.amount, own: { type: "money", label: "How much a year, in today's dollars", min: 1, name: "flowAmount" }, onPick: (v) => set({ amount: flowPicked.amount(v, flow, c) }, "amount") })) : null,
      start: flow.dir ? labelled("Starting with", choice(ctx, { id: "flowStart", label: "Starting with",
        presets: [c.invested ? { value: c.invested, label: `What you have invested: ${money(c.invested)}` } : null, { value: 0, label: "Nothing" }].filter(Boolean),
        value: shown.start, own: { type: "money", label: "How much at the start, in today's dollars", min: 0, name: "flowStart" }, onPick: (v) => set({ start: flowPicked.start(v, c) }, "start") })) : null,
      years: flow.dir ? labelled("For how long", h("div", { class: "chips", role: "group", "aria-label": "For how long" }, FLOW_YEARS.map((y) => chip(`${y} years`, flow.years === y, () => set({ years: y }, "years"))))) : null,
    };
    // a pick inside the row (a way, an amount, a start, a stretch): the answer it changed is scrolled into sight, the least
    // distance ("nearest"), when it and the chips just tapped fit on the screen together (the shell keeps the tapped chip
    // under the thumb); a chip above the row, Clear or a redraw of the shell's own does not move the page
    const tapped = groups[revealNext];
    revealNext = null;
    if (tapped) setTimeout(() => { if (bothInSight(answer.getBoundingClientRect?.(), tapped.getBoundingClientRect?.(), globalThis.innerHeight)) ui.reveal?.(answer, { block: "nearest" }); }, 0);
    // what is left after each start year, as a picture: only when there is a line to draw (a run that left something)
    const drawn = f && f.n > 1 && f.starts.some((x) => x.end > 0) ? [
      lineChart({ years: f.starts.map((x) => x.start), series: [{ values: f.starts.map((x) => x.end), width: 2.5 }, { values: fb.starts.map((x) => x.end), color: "var(--muted)", dash: "4 3" }], label: `what is left after ${f.years} years, by start year, today's dollars` }),
      h("p", { class: "muted small" }, `What is left after ${f.years} years, by the year it started, in today's dollars. Solid: ${asPart(d.mixA.label)} Dashed: ${asPart(d.mixB.label)}`),
    ] : [];
    return [
      wasCleared ? ui.notice("ok", "Cleared. Nothing was saved.") : null,
      h("p", { class: "muted small" }, `Money going in or coming out at the start of every year, over every stretch of history since ${d.from} (the start chosen above), in today's dollars. Nothing is saved: a reload starts it over.`),
      groups.way,
      answer,
      // a link a thumb can hit (critic P7: it was 16 px high inside a line of small print)
      caveat ? h("a", { href: "#/retirement/historical", class: "small", style: { display: "inline-flex", alignItems: "center", minHeight: "44px", justifySelf: "start" } }, "If history repeated runs your whole plan ›") : null,
      groups.amount,
      groups.start,
      groups.years,
      ...drawn,
      f && f.dir === "in" ? h("p", { class: "muted small" }, "The amount rises with prices each year. No fees, no taxes, one rebalance a year.") : null,
      flow.dir ? ui.row(ui.button("Clear", () => { flow = FLOW_EMPTY(); cleared = true; redraw(); }, { class: "secondary" })) : null,
    ].filter(Boolean);
  };
  return { id: "flow", kind: "own", title: FLOW_TITLE, says: flowSays(ask, money), open: flow.dir || wasCleared ? true : undefined, holds: ["flowAmount", "flowStart"], body };
}
