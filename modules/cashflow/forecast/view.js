// modules/cashflow/forecast/view.js -- DOM only. The lowest day ahead, a simple bar strip of
// the daily balance (inline, no library), and the dated list of what is expected.
import { compute } from "./compute.js";

const state = { days: 90, accountId: "" };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), days: state.days, accountId: state.accountId });
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Cash-flow forecast"),
      ui.h("p", { class: "lede" }, "Where your everyday cash is heading over the next three months, day by day, from the payments the plan knows about. It needs a checking, savings or cash account with a balance, and either imported transactions or bills typed on Expenses."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add an account"), ui.h("a", { class: "btn secondary", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }
  const money = (n, typed = false) => (n < 0 ? "-" : "+") + fmt.money(Math.abs(n), cur, undefined, typed ? 0 : 2);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.shortfallDate ? `Short on ${fmt.date(d.shortfallDate)}` : "Cash-flow forecast"),
    ui.h("p", { class: "lede" }, d.shortfallDate ? `At this pace the everyday accounts go below zero on ${fmt.date(d.shortfallDate)}. Move money in before then, or push a bill.` : `The lowest point in the next ${state.days} days is ${fmt.money(d.lowest.balance, cur)} on ${fmt.date(d.lowest.date)}. No shortfall expected.`),
  ));
  const acctSel = ui.select([{ value: "", label: "All everyday accounts" }, ...d.accounts.map((a) => ({ value: a.id, label: a.name }))], state.accountId, { "aria-label": "Account", onChange: (e) => { state.accountId = e.target.value; redraw(); } });
  const daysSel = ui.select([{ value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }], String(state.days), { "aria-label": "How far ahead", onChange: (e) => { state.days = Number(e.target.value); redraw(); } });
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Account", acctSel), ui.field("How far ahead", daysSel))));
  root.append(ui.card(null, ui.row(
    ui.stat("Today", fmt.money(d.start, cur), d.accounts.map((a) => a.name).join(", ")),
    ui.stat("Lowest point", fmt.money(d.lowest.balance, cur), `on ${fmt.date(d.lowest.date)}`),
    ui.stat(`In ${state.days} days`, fmt.money(d.end, cur), `${fmt.money(d.income, cur)} in, ${fmt.money(d.spending, cur)} out`),
  )));
  // Day by day: one balance line with the lowest day marked and month labels; a red band
  // only where the line dips below zero (design log 2026-09-16, pass 2).
  root.append(ui.card("Day by day", balanceChart([{ date: d.days[0]?.date ?? fmt.today(), balance: d.start, events: [], start: true }, ...d.days], d.lowest, fmt, cur),
    ui.h("p", { class: "muted small" }, `${d.sources.found} regular payment${d.sources.found === 1 ? "" : "s"} found in the transactions, ${d.sources.planned} from the Expenses and Income pages. Touch the line for a day's balance.`)));
  // What is expected: grouped by month, the first month open, the rest folded.
  const withEvents = d.days.filter((x) => x.events.length);
  const months = [];
  for (const x of withEvents) {
    const ym = String(x.date).slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.ym !== ym) { m = { ym, label: monthName(x.date), days: [] }; months.push(m); }
    m.days.push(x);
  }
  const dayRows = (days) => ui.h("ul", { class: "page-list" }, days.map((x) => ui.h("li", { style: { alignItems: "flex-start" } },
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, fmt.date(x.date)), ...x.events.map((e) => ui.h("div", { class: "d" }, `${money(e.amount, e.source === "planned")} ${e.name}${e.source === "planned" ? "" : " \u00b7 from your bank"}`))),
    ui.h("span", { class: "st", style: { fontWeight: "600", color: x.balance < 0 ? "var(--bad)" : "inherit" } }, fmt.money(x.balance, cur)))));
  root.append(ui.card("What is expected",
    months.map((m, k) => ui.h("details", { class: "fold", open: k === 0 ? true : null },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, m.label), ui.h("span", { class: "fold-status" }, `ends at ${fmt.money(m.days[m.days.length - 1].balance, cur)}`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")),
      ui.h("div", { class: "fold-body" }, dayRows(m.days)))),
    ui.h("p", { class: "muted small" }, "Right column: the balance after that day. Typed items land on the 1st (bills) or the 15th (pay) unless they have a start date."),
  ));
}

function monthName(iso) { const dt = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }

// Inline SVG: balance over the days. 2 px accent line, soft fill to the baseline, red band
// below zero, an 8 px marker on the lowest day, month labels, and a touch/hover readout.
function balanceChart(days, lowest, fmt, cur) {
  const W = 360, H = 150, L = 8, R = 8, T = 14, B = 26;
  const n = days.length; if (!n) return document.createElement("div");
  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, text) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: String(H), role: "img", "aria-label": `Balance over ${n} days, lowest ${fmt.money(lowest.balance, cur)} on ${fmt.date(lowest.date)}`, style: "display:block; touch-action: pan-y" });
  const vals = days.map((x) => x.balance);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(1, (hi - lo) * 0.12);
  // The vertical range hugs the data (so a 10 % dip is visible); zero is only in view when the
  // balance actually crosses it.
  const yMin = lo < 0 ? lo - pad : Math.max(0, lo - pad), yMax = hi + pad;
  const y = (v) => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));
  const x = (k) => L + (W - L - R) * (n === 1 ? 0.5 : k / (n - 1));
  const pts = vals.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`);
  const y0 = lo < 0 ? y(0) : H - B;
  // two faint gridlines with the range, in muted text
  for (const [v, anchor] of [[yMax - pad, "top"], [yMin + (lo < 0 ? pad : Math.min(pad, lo))]]) {
    const yy = y(v);
    svg.append(el("line", { x1: L, x2: W - R, y1: yy.toFixed(1), y2: yy.toFixed(1), stroke: "var(--line)", "stroke-width": "1", "stroke-dasharray": "2 3" }));
    svg.append(el("text", { x: W - R, y: (yy - 3).toFixed(1), "font-size": "10", fill: "var(--muted)", "text-anchor": "end" }, fmt.money(v, cur)));
    void anchor;
  }
  // below-zero band
  if (lo < 0) svg.append(el("rect", { x: L, y: y0, width: W - L - R, height: Math.max(0, y(lo) - y0 + 4), fill: "var(--bad-soft)" }));
  // baseline
  if (lo < 0) svg.append(el("line", { x1: L, x2: W - R, y1: y0.toFixed(1), y2: y0.toFixed(1), stroke: "var(--bad)", "stroke-width": "1" }));
  // area + line
  svg.append(el("path", { d: `M${pts[0]} L${pts.join(" L")} L${x(n - 1).toFixed(1)},${y0.toFixed(1)} L${x(0).toFixed(1)},${y0.toFixed(1)} Z`, fill: "var(--accent-soft)", opacity: "0.7" }));
  svg.append(el("path", { d: `M${pts.join(" L")}`, fill: "none", stroke: "var(--accent)", "stroke-width": "2", "stroke-linejoin": "round" }));
  // month labels at the first day of each month
  let last = "";
  days.forEach((dd, k) => { const ym = String(dd.date).slice(0, 7); if (ym !== last) { last = ym; if (k <= 1 || x(k) < W - 40) svg.append(el("text", { x: x(k).toFixed(1), y: H - 8, "font-size": "11", fill: "var(--muted)", "text-anchor": k === 0 ? "start" : "middle" }, new Date(`${dd.date}T12:00:00`).toLocaleDateString(undefined, { month: "short" }))); } });
  // lowest day marker + label
  let lk = 0; vals.forEach((v, k) => { if (v < vals[lk]) lk = k; });
  svg.append(el("circle", { cx: x(lk).toFixed(1), cy: y(vals[lk]).toFixed(1), r: "5", fill: vals[lk] < 0 ? "var(--bad)" : "var(--accent)", stroke: "var(--panel)", "stroke-width": "2" }));
  const anchor = x(lk) > W * 0.6 ? "end" : "start";
  svg.append(el("text", { x: (x(lk) + (anchor === "end" ? -8 : 8)).toFixed(1), y: Math.max(T + 10, y(vals[lk]) - 8).toFixed(1), "font-size": "11", "font-weight": "600", fill: "var(--text-2)", "text-anchor": anchor }, `lowest: ${fmt.money(vals[lk], cur)} on ${fmt.date(lowest.date)}`));
  // hover / touch readout
  const cross = el("line", { y1: T, y2: H - B, stroke: "var(--line-2)", "stroke-width": "1", visibility: "hidden" });
  const dot = el("circle", { r: "4", fill: "var(--accent)", stroke: "var(--panel)", "stroke-width": "2", visibility: "hidden" });
  const tip = document.createElement("div"); tip.className = "muted small"; tip.style.minHeight = "20px"; tip.textContent = "";
  svg.append(cross, dot);
  const readout = (ev) => {
    const r = svg.getBoundingClientRect(); const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
    const k = Math.max(0, Math.min(n - 1, Math.round((px - L) / (W - L - R) * (n - 1))));
    cross.setAttribute("x1", x(k).toFixed(1)); cross.setAttribute("x2", x(k).toFixed(1)); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(k).toFixed(1)); dot.setAttribute("cy", y(vals[k]).toFixed(1)); dot.setAttribute("visibility", "visible");
    tip.textContent = `${fmt.date(days[k].date)}: ${fmt.money(vals[k], cur)}${days[k].events.length ? ` \u00b7 ${days[k].events.length} payment${days[k].events.length === 1 ? "" : "s"}` : ""}`;
  };
  const clear = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.textContent = ""; };
  svg.addEventListener("mousemove", readout); svg.addEventListener("mouseleave", clear);
  svg.addEventListener("touchstart", readout, { passive: true }); svg.addEventListener("touchmove", readout, { passive: true });
  const wrap = document.createElement("div"); wrap.append(svg, tip);
  return wrap;
}
