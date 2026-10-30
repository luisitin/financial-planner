// modules/scenarios/sensitivity/view.js -- DOM only. The tornado: one bar per input, from the result
// with its low setting to the result with its high one, around the plan as it is; the widest first.
import { NUDGE, SS_PAYABLE_IF_DEPLETED } from "./compute.js";

let metric = "spend";   // "spend" | "end": what the bars measure; a view choice on this device
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
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What moves your plan most"),
        ui.h("p", { class: "lede" }, "Each of your plan's numbers nudged down and up, one at a time, to see which ones matter: returns, inflation, when you retire, how much you save, Social Security. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const top = d.biggest;
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, top ? `${top.label} moves your plan the most` : "What moves your plan most"),
      ui.h("p", { class: "lede" }, `Each of your plan's numbers nudged down and up, one at a time, everything else held. As it stands the plan can carry about ${money(round10(d.base.affordableMonthly))} a month of spending, after inflation, against the ${money(round10(d.base.spendingMonthly))} it plans.`),
      top ? ui.h("p", {}, `${top.label}: ${top.low.label} instead of ${top.baseLabel} ${verb(top.low.affordableMonthly - d.base.affordableMonthly)} ${money(round10(Math.abs(top.low.affordableMonthly - d.base.affordableMonthly)))} a month; ${top.high.label} ${verb(top.high.affordableMonthly - d.base.affordableMonthly)} ${money(round10(Math.abs(top.high.affordableMonthly - d.base.affordableMonthly)))}.`) : null));

    const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Measure" });
    const list = ui.h("ol", { class: "sn-rows" });
    const caption = ui.h("p", { class: "muted small" });
    const draw = () => {
      chips.replaceChildren(...[["spend", "What you can spend"], ["end", "What is left at the end"]].map(([k, label]) => ui.h("button", { type: "button", class: `chip${metric === k ? " on" : ""}`, "aria-pressed": metric === k ? "true" : "false", onClick: () => { metric = k; draw(); } }, label)));
      const val = (side) => (metric === "spend" ? side.affordableMonthly : side.endReal);
      const baseVal = metric === "spend" ? d.base.affordableMonthly : d.base.endReal;
      const rows = [...d.rows].sort((a, c) => Math.abs(val(c.high) - val(c.low)) - Math.abs(val(a.high) - val(a.low)));
      const all = rows.flatMap((r) => [val(r.low), val(r.high)]).concat(baseVal);
      const lo = Math.min(...all), hi = Math.max(...all);
      caption.textContent = metric === "spend"
        ? `Bars: the steady spending a month (today's dollars) the plan can carry with each setting. The line is your plan as it is, ${money(round10(baseVal))}.`
        : `Bars: what is left at the end of the plan (today's dollars) with each setting. The line is your plan as it is, ${money(round1000(baseVal))}.`;
      list.replaceChildren(...rows.map((r, i) => ui.h("li", { class: "sn-row" },
        ui.h("div", { class: "sn-head" }, ui.h("span", { class: "sn-label" }, ui.h("span", { class: "sn-rank" }, String(i + 1)), r.label), ui.h("span", { class: "sn-now" }, `now ${r.baseLabel}`)),
        ui.h("div", { class: "sn-help" }, r.help),
        bar(r, val, baseVal, lo, hi, metric === "spend" ? (n) => money(round10(n)) : (n) => short(n, cur, fmt)))));
    };
    draw();
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The tornado"), chips, caption, list));
    host.append(ui.card("Read it like this",
      ui.h("ul", {},
        ui.h("li", {}, "The longest bars are the numbers worth getting right, or worth acting on: a short bar means the plan barely cares."),
        ui.h("li", {}, "Some you choose (when to retire, how much to save, when to claim Social Security); some you only guess (returns, inflation, how long you live). Plan around the guesses with room to spare; move the choices."),
        ui.h("li", {}, "Inflation weighs heavily because your return assumptions are before inflation: a point more inflation is a point less real growth on everything you hold."),
      ), ui.row(ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Assumptions"), ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "Goal seek"))));
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How it is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, `Returns, inflation and pay rises: ${Math.round(NUDGE.returns * 100)} percentage point either way. Retirement age: ${NUDGE.retireYears} years (never earlier than next year). Plan end: ${NUDGE.endYears} years. Saving: ${Math.round(NUDGE.saving * 100)}% less or more. Stocks in retirement: ${Math.round(NUDGE.mix * 100)} points. Flat tax: ${Math.round(NUDGE.tax * 100)} points. Social Security: everyone claiming at 62 or 70, and the ${Math.round(SS_PAYABLE_IF_DEPLETED * 100)}% that would be payable if the retirement trust fund runs dry in 2033 (2025 Trustees Report).`),
        ui.h("li", {}, "The spending figure is the largest steady, inflation-adjusted spending that still lasts to the end of the plan (the same search as Will the money last?)."),
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
const verb = (diff) => (diff < 0 ? "cuts it by" : "raises it by");
const short = (n, cur, fmt) => fmt.money(round1000(n), cur);
