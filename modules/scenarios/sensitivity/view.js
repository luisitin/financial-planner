// modules/scenarios/sensitivity/view.js -- DOM only. The tornado: one bar per input, from the result
// with its low setting to the result with its high one, around the plan as it is; the widest first.
import { NUDGE, MOVES, valueOn, swingOn } from "./compute.js";
import { needItem } from "../../../core/words.js";

let metric = null;      // "spend" | "end" | "runout": what the bars measure, once the person picks it; a view choice on this device
let restOpen = false;   // whether "N more numbers" is open: kept while the measure is switched; a view choice, never the plan's
let measureOpen = false;   // whether "Measure it another way" is open (simple first, fix round 2): a view choice, never the plan's
const aboutOpen = new Set();   // the rows whose "More about this" is open, by id: kept while the measure is switched (fix round 2, N6)
/** How many rows show before the rest fold under "N more numbers" (owner, 2026-11-12 and 2026-11-13: simple first, at most three). */
const SHOWN = 3;
/** The measure chips' words, and the same in the fold's line ("showing how long it lasts"). */
const MEASURE_WORDS = { spend: "What you can spend", end: "What is left at the end", runout: "How long it lasts" };
const MEASURE_LOWER = { spend: "what you can spend", end: "what is left at the end", runout: "how long it lasts" };
const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };

const STYLE = `
.sn-root .sn-rows { list-style: none; margin: 0; padding: 0; }
.sn-root .sn-row { padding: 10px 0 8px; border-bottom: 1px solid var(--line); }
.sn-root .sn-row:last-child { border-bottom: 0; }
.sn-root .sn-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.sn-root .sn-label { font-weight: 650; }
.sn-root .sn-now { color: var(--muted); font-size: var(--fs-sm); white-space: nowrap; }
.sn-root .sn-help { color: var(--muted); font-size: var(--fs-xs); }
.sn-root .sn-row svg { display: block; width: 100%; max-width: 640px; height: auto; margin-top: 6px; font: 11px system-ui, sans-serif; }
.sn-root .sn-about .fold-title { font-weight: 500; font-size: var(--fs-sm); color: var(--text-2); }
.sn-root .sn-about .fold-body { padding-top: 0; }
.sn-root .sn-rest { border-top: 1px solid var(--line); }
.sn-root .sn-way { margin-top: 12px; }
.sn-root .sn-still .sn-label { font-weight: 600; }
.sn-root .sn-none { margin: 8px 0; }
.sn-root .sn-rest .fold-status, .sn-root .sn-measure .fold-status { white-space: normal; text-align: right; }
.sn-root .sn-measure { border-top: 1px solid var(--line); }
.sn-root .sn-measure .chips { margin: 4px 0 0; }
/* on a phone a fold's line goes under its title ("More options" was cut in two at 320 px); the chevron stays at the right */
@media (max-width: 480px) {
  .sn-root .sn-rest > summary, .sn-root .sn-measure > summary { display: grid; grid-template-columns: 1fr auto; column-gap: 10px; row-gap: 0; }
  .sn-root .sn-rest > summary .fold-status, .sn-root .sn-measure > summary .fold-status { grid-column: 1; grid-row: 2; white-space: normal; text-align: left; }
  .sn-root .sn-rest > summary .fold-chev, .sn-root .sn-measure > summary .fold-chev { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
}
.sn-root .sn-rank { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-2); border: 1px solid var(--line-2); font-size: var(--fs-xs); font-weight: 700; margin-right: 8px; color: var(--text-2); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const root = ui.h("div", { class: "sn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div", {}, ui.notice("info", "Nudging each of your numbers..."));
  root.append(host);
  ctx.computeRemote("scenarios/sensitivity", { today: fmt.today() }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What matters most"),
        ui.h("p", { class: "lede" }, "Each of your plan's numbers nudged down and up, one at a time, to see which ones matter: returns, inflation, when you retire, how much you save, Social Security. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, needItem(m)))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    // no retirement savings on file and nothing going in (owner's request 2026-11-11, L1): the same "we don't know yet" as Will the
    // money last? and Goal seek, with their one filled button, instead of rows of "$0 / $0"
    // told rather than untold (fix round 1, 2026-11-12, B4): an empty 401(k) on file or "None" in Get started reads "Nothing is saved
    // for retirement yet", with one grey line of what the usual saving would let the plan pay
    if (d.noSavings) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "We don't know yet"),
        ui.h("p", { class: "lede" }, d.nothingSaved ? "Nothing is saved for retirement yet, and nothing goes in, so we can't say which of your numbers change the answer most. That is common; once something is saved or goes in each paycheck, add it and come back." : "You haven't told us about retirement savings, so we can't say which of your numbers change the answer most. Add what you own first; if you have no retirement savings yet, that is common, and you can come back later."),
        d.usualLine ? ui.h("p", { class: "muted small" }, d.usualLine.text) : null,
        ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add what you own ›"))));
      return;
    }
    const top = d.biggest;
    const runsOut = (b) => `${b.failYear ?? "the plan's last years"}${b.runsOutAge !== null && b.runsOutAge !== undefined ? ` (age ${b.runsOutAge})` : ""}`;
    // the headline names a number only when it moves the plan (fix round 2, 2026-11-13, N1: "How much stocks earn moves your plan the
    // most" sat over a $0 bar on 131 qa plans); on a plan that cannot pay for any steady spending the page measures how long it lasts
    // simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): the hero is the answer; how the numbers were nudged is in "How
    // to read this"
    const lede = d.measure === "runout" ? `As it stands the money runs out in ${runsOut(d.base)}; even spending nothing more, it would not last to the end, so each number here is measured by how long the money lasts.`
      // a plan that can pay for no steady spending says when the money runs out, never "about $0 a month of spending" (fix round 2)
      : !d.base.success && d.base.affordableMonthly < 5 ? `As it stands the money runs out in ${runsOut(d.base)}, and the plan can't yet pay for any of the ${fmt.money(Math.round(d.base.spendingMonthly), cur)} a month it plans.`
      : `As it stands the plan can pay for about ${money(round10(d.base.affordableMonthly))} a month of spending, after inflation, against the ${fmt.money(Math.round(d.base.spendingMonthly), cur)} it plans.`;
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, top ? `${top.label} moves your plan the most` : "None of these numbers changes the answer"),
      ui.h("p", { class: "lede" }, top || d.base.success ? lede : `With every setting the money still runs out in ${runsOut(d.base)}, so none of your numbers changes the answer. More saved, or less going out, would: see what it would take, below.`),
      // the sentence is built in compute (heroLine; fix round 1, 2026-11-12, B1: "nothing instead of nothing raises it by $0")
      d.headline ? ui.h("p", {}, d.headline) : null));

    const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Measure" });
    const ms = d.measures ?? ["spend", "end"];   // the measures something moves (fix round 2, N1): no fold, and no chips, for one
    // the other measures, one quiet tap away (simple first, fix round 2): the bars first show the page's own measure; the fold's line
    // says which one is showing once the person picks another, and it stays open while they switch (never the plan's)
    const measureStatus = ui.h("span", { class: "fold-status" });
    const measureFold = ui.h("details", { class: "fold sn-measure", ...(measureOpen ? { open: true } : {}), onToggle: (e) => { measureOpen = !!e.currentTarget.open; } },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Measure it another way"), measureStatus, ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, chips));
    const list = ui.h("ol", { class: "sn-rows" });
    const caption = ui.h("p", { class: "muted small" });
    const none = ui.h("div");
    const draw = () => {
      // the measures something moves (fix round 2, N1); the person's pick when it is one of them, else the page's own; no chips for one
      const m = d.measures?.includes(metric) ? metric : d.measure ?? "spend";
      chips.replaceChildren(...(ms.length > 1 ? ms.map((k) => ui.h("button", { type: "button", class: `chip${m === k ? " on" : ""}`, "aria-pressed": m === k ? "true" : "false", onClick: () => { metric = k; draw(); } }, MEASURE_WORDS[k])) : []));
      measureStatus.textContent = m !== (d.measure ?? "spend") ? `showing ${MEASURE_LOWER[m]}` : ms.filter((k) => k !== m).map((k) => MEASURE_LOWER[k]).join(", ");
      const cap = d.runoutCap ?? 0;
      const val = (side) => valueOn(side, m, cap);
      const baseVal = val(d.base);
      const moves = (r) => (r.moves ? r.moves[m] : Math.max(Math.abs(val(r.low) - baseVal), Math.abs(val(r.high) - baseVal)) >= MOVES[m]);
      const live = d.rows.filter(moves).sort((a, c) => swingOn(c, m, cap) - swingOn(a, m, cap));
      const still = d.rows.filter((r) => !moves(r));
      // how long it lasts: "to 66" under a bar ("age 63: to 66" read "age 63: age 66" before, fix round 2), "lasts" to the end
      const fmtOn = m === "spend" ? (n) => money(round10(n)) : m === "end" ? (n) => short(n, cur, fmt) : (n) => (n >= cap ? "lasts" : `to ${n}`);
      const all = live.flatMap((r) => [val(r.low), val(r.high)]).concat(baseVal);
      const lo = Math.min(...all), hi = Math.max(...all);
      caption.textContent = !live.length ? "" : m === "spend"
        ? `Bars: the steady spending a month (today's dollars) the plan can pay for with each setting. The line is your plan as it is, ${money(round10(baseVal))}.`
        : m === "end" ? `Bars: what is left at the end of the plan (today's dollars) with each setting. The line is your plan as it is, ${money(round1000(baseVal))}.`
        : `Bars: the age the money lasts to with each setting ("lasts": to the end of the plan). The line is your plan as it is: ${baseVal >= cap ? "it lasts" : `to age ${baseVal}`}.`;
      // nothing moves this measure: one line that says why, instead of bars of "$0 / $0" (N1)
      // (not when nothing moves anything at all: the hero already says so)
      none.replaceChildren(...(live.length || !ms.length ? [] : [ui.h("p", { class: "muted small sn-none" }, m === "end" ? "With every setting the money still runs out, so nothing is left at the end either way." : m === "runout" ? `With every setting the money runs out at the same age, ${d.base.runsOutAge ?? "as it does now"}.` : "With every setting the plan still can't pay for steady spending: even spending nothing more, the money runs out.")]));
      const about = (r) => (r.more ? ui.h("details", { class: "fold sn-about", ...(aboutOpen.has(r.id) ? { open: true } : {}), onToggle: (e) => { if (e.currentTarget.open) aboutOpen.add(r.id); else aboutOpen.delete(r.id); } }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "More about this"), ui.h("span", { class: "fold-chev" }, "›")), ui.h("div", { class: "fold-body sn-help" }, r.more)) : null);
      const rowEl = (r, i) => ui.h("li", { class: "sn-row" },
        ui.h("div", { class: "sn-head" }, ui.h("span", { class: "sn-label" }, ui.h("span", { class: "sn-rank" }, String(i + 1)), r.label), ui.h("span", { class: "sn-now" }, `now ${r.baseLabel}`)),
        ui.h("div", { class: "sn-help" }, r.help),
        bar(r, val, baseVal, lo, hi, fmtOn),
        // the detail of a row, one quiet tap away (the saving row when nothing goes in: each share, the match's amount, own money alone)
        about(r));
      // a number that moves nothing on this measure: its name and settings, no bar (N1)
      const stillEl = (r) => ui.h("li", { class: "sn-row sn-still" },
        ui.h("div", { class: "sn-head" }, ui.h("span", { class: "sn-label" }, r.label), ui.h("span", { class: "sn-now" }, `now ${r.baseLabel}`)),
        ui.h("div", { class: "sn-help" }, `${r.low.label} or ${r.high.label}: no change here.`), about(r));
      // the few that move the plan most first (at most three); the rest, and the ones that move nothing, one tap away
      list.replaceChildren(...live.slice(0, SHOWN).map(rowEl));
      const rest = live.slice(SHOWN);
      const n = rest.length + still.length;
      const status = !still.length ? "they move it less" : !rest.length ? "they change nothing here" : "they move it less, or not at all";
      restHost.replaceChildren(...(n ? [ui.h("details", { class: "fold sn-rest", ...(restOpen ? { open: true } : {}), onToggle: (e) => { restOpen = !!e.currentTarget.open; } },
        ui.h("summary", {}, ui.h("span", { class: "fold-title" }, `${n} more number${n === 1 ? "" : "s"}`), ui.h("span", { class: "fold-status" }, status), ui.h("span", { class: "fold-chev" }, "›")),
        ui.h("div", { class: "fold-body" }, ui.h("ol", { class: "sn-rows" }, ...rest.map((r, i) => rowEl(r, SHOWN + i)), ...still.map(stillEl))))] : []));
    };
    const restHost = ui.h("div");
    draw();
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Which numbers matter most"), caption, none, list, restHost, ms.length > 1 ? measureFold : null,
      // the way on, in Goal seek's own words for this plan (outlined; this page has no filled button)
      ui.h("div", { class: "sn-way" }, ui.h("a", { class: "btn secondary small", href: "#/scenarios/goal-seek" }, d.base.success ? "How far each change could go ›" : "What it would take ›"))));
    // how to read the bars: there for whoever wants it (owner, 2026-11-12: simple first). The way to the figures we use is in here
    // and says "check" (fix round 1, P8: an "Assumptions" button sat next to a green "8.0%" bar; spec D-A7: never "raise")
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How to read this"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, "Each of your plan's numbers is nudged down and up, one at a time, with everything else kept the same."),
        ui.h("li", {}, "The longest bars are the numbers worth getting right, or worth acting on: a short bar means the plan barely cares."),
        ui.h("li", {}, "Some you choose (when to retire, how much to save, when to claim Social Security); some you only guess (returns, inflation, how long you live). Plan around the guesses with room to spare; move the choices."),
        ui.h("li", {}, "Inflation weighs heavily because your return assumptions are before inflation: one percentage point more inflation means one percentage point less growth after inflation on everything you hold."),
      ), ui.row(ui.h("a", { class: "btn secondary small", href: "#/system/assumptions?show=returnStocks" }, "Check the figures we use ›")))));
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How it is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, `Returns, inflation and pay raises: ${Math.round(NUDGE.returns * 100)} percentage point either way. Retirement age: ${NUDGE.retireYears} years (never earlier than next year). Plan end: ${NUDGE.endYears} years. Saving: ${Math.round(NUDGE.saving * 100)}% less or more. Stocks in retirement: ${Math.round(NUDGE.mix * 100)} points. Flat tax: ${Math.round(NUDGE.tax * 100)} points.${d.ssMethod ? ` ${d.ssMethod}` : ""}`),
        ui.h("li", {}, "The spending figure is the largest steady, inflation-adjusted spending that still lasts to the end of the plan (the same search as on the Will the money last? page)."),
        ui.h("li", {}, "How long it lasts: the age the money runs out at with each setting, from the same year-by-year run (\"lasts\": it reaches the end of the plan). A number that moves the answer by less than $5 a month, less than $500 at the end, or not by a year is listed as no change."),
      ))));
  });
}

function bar(r, val, baseVal, lo, hi, label) {
  const W = 360, padX = 8, y = 6, h = 14;
  const span = Math.max(1e-9, hi - lo);
  const x = (v) => padX + ((v - lo) / span) * (W - 2 * padX);
  const a = val(r.low), b = val(r.high);
  const s = svg("svg", { viewBox: `0 0 ${W} 44`, role: "img", "aria-label": `${r.label}: ${r.low.label} gives ${label(a)}, ${r.high.label} gives ${label(b)}` });
  s.append(svg("rect", { x: padX, y, width: W - 2 * padX, height: h, rx: 4, fill: "var(--panel-2)" }));
  for (const v of [a, b]) {
    const x0 = Math.min(x(v), x(baseVal)), w = Math.max(1, Math.abs(x(v) - x(baseVal)));
    s.append(svg("rect", { x: x0, y, width: w, height: h, rx: 3, fill: v < baseVal ? "var(--warn)" : "var(--ok)", opacity: 0.85 }));
  }
  s.append(svg("line", { x1: x(baseVal), x2: x(baseVal), y1: 2, y2: y + h + 4, stroke: "var(--text)", "stroke-width": 2 }));
  const left = a <= b ? [a, r.low] : [b, r.high], right = a <= b ? [b, r.high] : [a, r.low];
  s.append(svg("text", { x: padX, y: 40, "text-anchor": "start", fill: "var(--text-2)" }, `${left[1].label}: ${label(left[0])}`));
  s.append(svg("text", { x: W - padX, y: 40, "text-anchor": "end", fill: "var(--text-2)" }, `${right[1].label}: ${label(right[0])}`));
  return s;
}

const round10 = (n) => Math.round(n / 10) * 10;
const round1000 = (n) => Math.round(n / 1000) * 1000;
const short = (n, cur, fmt) => fmt.money(round1000(n), cur);
