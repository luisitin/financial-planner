// modules/balance/accounts/view.js -- DOM only. One account at a time: its balance now and over time (a line you can
// touch for each saved point), a balance from another day added or removed, what went in and out from its
// transactions, its latest ones, its last checked statement, and notes. `#/balance/accounts/<id>` opens one account.
// The account itself (name, kind) is edited on Net worth; a balance added here for its latest day moves the balance
// Net worth uses too.
import { compute, saveBalance, removePoint, ticks, axisUnit, isDate } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ac-root { --ac-line: #2563eb; }
@media (prefers-color-scheme: dark) { .ac-root { --ac-line: #5b8ff0; } }
.ac-root .ac-chart { position: relative; margin-top: 8px; padding-top: 30px; touch-action: pan-y; }
.ac-root .ac-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.ac-root .ac-chart text { font-size: 12px; fill: var(--muted); }
.ac-root .ac-chart .ac-end { fill: var(--text); font-weight: 600; }
.ac-root .ac-tip { position: absolute; top: 0; pointer-events: none; background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 4px 8px; font-size: var(--fs-sm); box-shadow: var(--shadow); white-space: nowrap; }
.ac-root .ac-meta { color: var(--muted); font-size: var(--fs-sm); margin: 2px 0 0; }
.ac-root textarea { width: 100%; }
.ac-root .card h3 { margin-top: 18px; }
.ac-root .card > .field + h2 { margin-top: 16px; }
.ac-root .rec-foot { flex-wrap: wrap; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store, route } = ctx;
  const cur = plan.meta?.currency;
  const today = fmt.today();
  const d = compute(plan, { today, accountId: route?.rest?.[0] });
  const root = ui.h("div", { class: "ac-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const money = (v) => fmt.money(v, cur, "en-US", 2);
  const whole = (v) => fmt.money(v, cur);
  const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;
  const count = (n) => `${n} ${n === 1 ? "transaction" : "transactions"}`;

  if (!d.account) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your accounts, one at a time"),
      ui.h("p", { class: "lede" }, "Once you add an account (checking, savings, a card, a retirement account), this page shows its balance over time, what goes in and out of it, and your notes on it."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add an account"))));
    return;
  }
  const a = d.account;
  const shown = (b) => (a.liability ? Math.abs(Number(b)) : Number(b));   // a debt as what is owed

  // which account
  const picker = ui.select(d.accounts.map((x) => ({ value: x.id, label: `${x.name} (${x.label})` })), a.id, { "aria-label": "Account" });
  picker.addEventListener("change", () => ctx.go("balance", "accounts", [picker.value]));
  const ch = d.change;
  const changeStat = ch ? ui.stat(
    ch.amount === 0 ? "No change" : a.liability ? (ch.amount < 0 ? "You owe less" : "You owe more") : (ch.amount > 0 ? "Up" : "Down"),
    Math.abs(ch.amount) < 10 ? money(Math.abs(ch.amount)) : whole(Math.abs(ch.amount)),
    `${ch.to.date === a.asOf ? `since ${fmt.date(ch.from.date)}` : `${fmt.date(ch.from.date)} to ${fmt.date(ch.to.date)}`}${ch.share !== null ? ` (${Math.abs(ch.share * 100).toFixed(1)}%)` : ""}`) : null;
  root.append(ui.h("section", { class: "card" }, d.accounts.length > 1 ? ui.field("Account", picker) : null,
    ui.h("h2", {}, a.name),
    ui.h("p", { class: "ac-meta" }, [a.label, a.institution, a.owner ? `${a.owner}'s` : null].filter(Boolean).join(" · ")),
    ui.row(ui.stat(a.liability ? "Owed" : "Balance", a.balance === null ? "Not set" : whole(shown(a.balance)), a.asOf ? `on ${fmt.date(a.asOf)}` : "no date on file"), changeStat),
    ui.row(ui.h("a", { class: "btn secondary small", href: "#/balance/net-worth" }, "Update this balance on Net worth"))));

  // the balance over time
  const chartCard = ui.card(a.liability ? "What you owe over time" : "Balance over time");
  root.append(chartCard);
  let cleanup;
  if (d.points.length < 2) chartCard.append(ui.h("p", { class: "muted" }, d.points.length ? "One balance so far. Add a balance from another day below, or save your totals on Net worth now and then, to see how it moves." : "No balance with a date yet. Add one below."));
  else {
    const box = ui.h("div", { class: "ac-chart" });
    chartCard.append(box, ui.h("p", { class: "muted small" }, `${d.points.length} balances, from the ones saved by day and the balance on file. Touch the line to read a day.`));
    drawChart(box, d.points);
    // drawn to the card's width: draw again when it changes (a phone turned, a window resized)
    if (typeof ResizeObserver === "function") {
      let lastW = chartCard.clientWidth;
      const ro = new ResizeObserver(() => { const w = chartCard.clientWidth; if (Math.abs(w - lastW) > 8) { lastW = w; drawChart(box, d.points); } });
      ro.observe(chartCard);
      cleanup = () => ro.disconnect();
    }
  }

  // add a balance from another day
  const form = ui.form([
    { key: "date", label: "Day", type: "date", required: true },
    { key: "balance", label: a.liability ? "What you owed that day" : "Balance that day", type: "money", required: true, help: "from a statement or the bank's app" },
  ], { date: today, balance: null }, (v) => {
    form.querySelector(".notice")?.remove();
    if (v.date > today) { form.append(ui.notice("error", "That day is in the future. Pick today or an earlier day.")); return; }
    store.update((q) => {
      const r = saveBalance(q, a.id, v.date, v.balance);
      pending = `Saved ${money(shown(v.balance))} for ${fmt.date(v.date)}.${r.onFile ? " Net worth now uses this balance too." : ""}`;
    });
  }, { submitLabel: "Add this balance" });
  const saved = ((plan.accounts ?? []).find((x) => x.id === a.id)?.history ?? []).filter((h) => isDate(h?.date)).sort((x, y) => y.date.localeCompare(x.date));
  root.append(ui.h("details", { class: "card fold fold-card", open: d.points.length < 2 ? true : null },
    ui.h("summary", {}, ui.h("h2", {}, "Balances by day"), ui.h("span", { class: "fold-status" }, `${saved.length} saved`), ui.h("span", { class: "fold-chev" }, "›")),
    saved.length ? ui.h("ul", { class: "records" }, saved.map((h) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, fmt.date(h.date)), ui.h("span", { class: "rec-value" }, money(shown(h.balance)))),
      // the balance on file wins its own day: say so when the two differ
      h.date === a.asOf && a.balance !== null && Math.round(shown(h.balance) * 100) !== Math.round(shown(a.balance) * 100)
        ? ui.h("div", { class: "rec-sub" }, `Net worth has ${money(shown(a.balance))} for this day; the chart uses that.`) : null,
      ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" }, ui.button("Remove", () => {
        if (!ui.confirm(`Remove the balance saved for ${fmt.date(h.date)}?`)) return;
        pending = `Removed the balance for ${fmt.date(h.date)}.`;
        store.update((q) => { removePoint(q, a.id, h.date); });
      }, { class: "secondary small" })))))) : ui.h("p", { class: "muted small" }, "None saved yet. The balance on file comes from Net worth."),
    ui.h("h3", {}, "Add a balance"), form));

  // money in and out (for a card or loan: payments and new charges)
  if (d.lines && d.flows) {
    const f = d.flows;
    const net = f.recent.net;
    const tiles = a.liability
      ? ui.row(ui.stat("Payments, last 30 days", whole(f.recent.in), `${count(f.recent.count)} in all`), ui.stat("New charges, last 30 days", whole(Math.abs(f.recent.out)), net === 0 ? "You owe the same" : `You owe ${whole(Math.abs(net))} ${net > 0 ? "less" : "more"}`))
      : ui.row(ui.stat("Money in, last 30 days", whole(f.recent.in), `${count(f.recent.count)} in all`), ui.stat("Money out, last 30 days", whole(Math.abs(f.recent.out)), `${net >= 0 ? "Kept" : "Short"} ${whole(Math.abs(net))}`));
    const monthValue = (m) => (!a.liability ? signed(m.net) : m.net === 0 ? "No change" : `${m.net > 0 ? "Owe less" : "Owe more"} ${money(Math.abs(m.net))}`);
    const monthSub = (m) => `${a.liability ? `Paid ${money(m.in)}, charged` : `In ${money(m.in)}, out`} ${money(Math.abs(m.out))}, ${count(m.count)}`;
    root.append(ui.card("Money in and out",
      f.recent.count ? tiles
        : ui.h("p", { class: "muted" }, `Nothing in the last 30 days.${d.recent.length ? ` The latest transaction on file is from ${fmt.date(d.recent[0].date)}; import a newer bank file to bring it up to date.` : ""}`),
      ui.h("ul", { class: "records" }, f.months.filter((m) => m.count).map((m) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })), ui.h("span", { class: "rec-value" }, monthValue(m))),
        ui.h("div", { class: "rec-sub" }, monthSub(m))))),
      a.liability ? ui.h("p", { class: "muted small" }, "For a card or loan, a payment lowers what you owe and a purchase raises it.") : null,
      ui.h("h3", {}, "Latest transactions"),
      ui.h("ul", { class: "records" }, d.recent.map((t) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t.payee || "No description"), ui.h("span", { class: "rec-value" }, signed(Number(t.amount) || 0))),
        ui.h("div", { class: "rec-sub" }, fmt.date(t.date))))),
      ui.row(ui.h("a", { class: "btn secondary small", href: `#/transactions/ledger/account/${a.id}` }, "All transactions for this account"))));
  } else root.append(ui.card("Money in and out", ui.h("p", { class: "muted" }, "No transactions for this account yet. Import its bank file to see what goes in and out."), ui.row(ui.h("a", { class: "btn secondary small", href: "#/transactions/import" }, "Import a bank file"))));

  // the last checked statement: what it ended at, and whether the transactions since then reach the balance on Net worth
  const s = d.since;
  if (d.lines) {
    const owed = a.liability ? " owed" : "";
    const body = [];
    if (s) {
      const since = s.lines ? `Adding the ${count(s.lines)} since then gives ${money(s.ledgerBalance)}${owed}` : `With no transactions since then, that is still ${money(s.ledgerBalance)}${owed}`;
      body.push(ui.h("p", {}, `You checked the statement for ${fmt.date(s.check.from)} to ${fmt.date(s.check.to)}. It ended at ${money(s.check.endBalance)}${owed}.`));
      if (s.gap === null) body.push(ui.h("p", { class: "muted small" }, `${since}${s.lines && d.recent[0] ? ` after the latest one (${fmt.date(d.recent[0].date)})` : ""}.`));
      else if (s.gap === 0) body.push(ui.notice("ok", `${since} on ${fmt.date(s.onFileDate)}, the same as the balance on Net worth. Everything adds up.`));
      else body.push(ui.notice("warn", `${since} on ${fmt.date(s.onFileDate)}, but Net worth has ${money(s.onFile)} for that day: ${money(Math.abs(s.gap))} apart. A transaction may be missing here, or the balance on Net worth needs updating.`));
    } else body.push(ui.h("p", { class: "muted" }, "Not checked yet. Checking a statement shows whether your transactions add up to what the bank says."));
    root.append(ui.card("Checked against a statement", ...body,
      ui.row(ui.h("a", { class: "btn secondary small", href: "#/transactions/reconcile" }, s ? "Check a newer statement" : "Check a statement"))));
  }

  // notes
  const notes = ui.h("textarea", { rows: 4, "aria-label": "Notes on this account", placeholder: "For example: the rate, when a promotion ends, who to call" }, a.notes);
  root.append(ui.card("Notes", notes, ui.row(ui.button("Save notes", () => {
    pending = "Notes saved.";
    store.update((q) => { const x = (q.accounts ?? []).find((y) => y.id === a.id); if (x) x.notes = notes.value.trim(); });
  }, { class: "secondary" })), ui.h("p", { class: "muted small" }, "Never put a password or a full account number here.")));

  return cleanup;

  // the line: time along the bottom, the balance up the side; touch or point to read a day. Drawn into `box`, again on a resize.
  function drawChart(box, pts) {
    box.replaceChildren();
    const inner = box.parentElement.clientWidth - 32;   // the card's 16 px padding on each side
    const W = Math.max(280, inner > 0 ? Math.round(inner) : 320), H = 190, L = 58, R = 14, T = 14, B = 26;
    const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
    const vals = pts.map((p) => p.balance), tk = ticks(Math.min(...vals), Math.max(...vals));
    const lo = tk[0], hi = tk[tk.length - 1];
    const unit = axisUnit(tk);
    const axisLabel = (v) => (unit.big ? `${fmt.money(v / 1000, cur, "en-US", unit.digits)}K` : whole(v));
    const x = (p) => L + (t1 === t0 ? 0 : ((Date.parse(p.date) - t0) / (t1 - t0)) * (W - L - R));
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const NS = "http://www.w3.org/2000/svg";
    const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${a.liability ? "Owed" : "Balance"} from ${fmt.date(pts[0].date)} (${whole(pts[0].balance)}) to ${fmt.date(pts[pts.length - 1].date)} (${whole(pts[pts.length - 1].balance)})` });
    for (const v of tk) svg.append(el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: "var(--line)", "stroke-width": 1 }), el("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, axisLabel(v)));
    svg.append(el("text", { x: L, y: H - 6, "text-anchor": "start" }, fmt.date(pts[0].date)), el("text", { x: W - R, y: H - 6, "text-anchor": "end" }, fmt.date(pts[pts.length - 1].date)));
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p.balance).toFixed(1)}`).join("");
    svg.append(el("path", { d: `${path}L${x(pts[pts.length - 1]).toFixed(1)},${y(lo).toFixed(1)}L${x(pts[0]).toFixed(1)},${y(lo).toFixed(1)}Z`, fill: "var(--ac-line)", "fill-opacity": 0.1 }));
    svg.append(el("path", { d: path, fill: "none", stroke: "var(--ac-line)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    svg.append(el("circle", { cx: x(end), cy: y(end.balance), r: 4, fill: "var(--ac-line)", stroke: "var(--panel)", "stroke-width": 2 }));
    // the latest value sits up and to the left of the dot: only where the line does not come down into it (the tile above shows it anyway)
    if (prev.balance <= end.balance) svg.append(el("text", { class: "ac-end", x: x(end) - 8, y: y(end.balance) - 10, "text-anchor": "end" }, whole(end.balance)));
    // the hover layer: a hairline that snaps to the nearest day, its dot and a tip
    const hair = el("line", { y1: T, y2: H - B, stroke: "var(--line-2)", "stroke-width": 1, visibility: "hidden" });
    const dot = el("circle", { r: 5, fill: "var(--ac-line)", stroke: "var(--panel)", "stroke-width": 2, visibility: "hidden" });
    svg.append(hair, dot);
    const tip = ui.h("div", { class: "ac-tip", hidden: true });
    box.append(svg, tip);
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const p = pts.reduce((best, q) => (Math.abs(x(q) - px) < Math.abs(x(best) - px) ? q : best), pts[0]);
      hair.setAttribute("x1", x(p)); hair.setAttribute("x2", x(p)); dot.setAttribute("cx", x(p)); dot.setAttribute("cy", y(p.balance));
      hair.setAttribute("visibility", "visible"); dot.setAttribute("visibility", "visible");
      tip.textContent = `${fmt.date(p.date)}: ${money(p.balance)}`; tip.hidden = false;
      const left = (x(p) / W) * r.width;
      tip.style.left = `${Math.min(Math.max(0, left - tip.offsetWidth / 2), r.width - tip.offsetWidth)}px`;
    };
    const hide = () => { hair.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hidden = true; };
    // a finger lifting fires pointerleave: on touch the tip stays until the next tap moves it
    svg.addEventListener("pointermove", show); svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
    svg.addEventListener("pointercancel", hide);
  }
}
