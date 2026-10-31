// modules/balance/accounts/view.js -- DOM only. One account at a time: its balance now and over time (a line you can
// touch for each saved point), a balance from another day added or removed, what went in and out from its
// transactions, its latest ones, its last checked statement, and notes. `#/balance/accounts/<id>` opens one account.
// The account itself (name, kind, balance) is edited on Net worth.
import { compute, addPoint, removePoint } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ac-root { --ac-line: #2563eb; }
@media (prefers-color-scheme: dark) { .ac-root { --ac-line: #5b8ff0; } }
.ac-root .ac-chart { position: relative; margin-top: 8px; touch-action: pan-y; }
.ac-root .ac-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.ac-root .ac-chart text { font-size: 12px; fill: var(--muted); }
.ac-root .ac-chart .ac-end { fill: var(--text); font-weight: 600; }
.ac-root .ac-tip { position: absolute; top: 0; pointer-events: none; background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 4px 8px; font-size: var(--fs-sm); box-shadow: var(--shadow); white-space: nowrap; }
.ac-root .ac-meta { color: var(--muted); font-size: var(--fs-sm); margin: 2px 0 0; }
.ac-root textarea { width: 100%; }
.ac-root .card h3 { margin-top: 18px; }
.ac-root .rec-foot { flex-wrap: wrap; }
`;

/** Clean round steps for the axis: about three ticks over [lo, hi]. */
function ticks(lo, hi) {
  if (hi === lo) { hi = lo + 1; lo = lo - 1; }
  const raw = (hi - lo) / 3, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
  if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
  return out;
}

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

  if (!d.account) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your accounts, one at a time"),
      ui.h("p", { class: "lede" }, "Once you add an account (checking, savings, a card, a retirement account), this page shows its balance over time, what goes in and out of it, and your notes on it."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add an account"))));
    return;
  }
  const a = d.account;

  // which account
  const picker = ui.select(d.accounts.map((x) => ({ value: x.id, label: `${x.name} (${x.label})` })), a.id, { "aria-label": "Account" });
  picker.addEventListener("change", () => ctx.go("balance", "accounts", [picker.value]));
  root.append(ui.h("section", { class: "card" }, d.accounts.length > 1 ? ui.field("Account", picker) : null,
    ui.h("h2", {}, a.name),
    ui.h("p", { class: "ac-meta" }, [a.label, a.institution, a.owner ? `${a.owner}'s` : null].filter(Boolean).join(" · ")),
    ui.row(ui.stat(a.liability ? "Owed" : "Balance", a.balance === null ? "Not set" : whole(a.liability ? Math.abs(a.balance) : a.balance), a.asOf ? `on ${fmt.date(a.asOf)}` : "no date on file"),
      d.change ? ui.stat("Change", `${d.change.amount > 0 ? "+" : d.change.amount < 0 ? "−" : ""}${whole(Math.abs(d.change.amount))}`, `since ${fmt.date(d.change.from.date)}${d.change.share !== null ? ` (${d.change.share >= 0 ? "+" : "−"}${Math.abs(d.change.share * 100).toFixed(1)}%)` : ""}`) : null),
    ui.row(ui.h("a", { class: "btn secondary small", href: "#/balance/net-worth" }, "Change it on Net worth"))));

  // the balance over time
  const chartCard = ui.card(a.liability ? "What you owe over time" : "Balance over time");
  root.append(chartCard);
  if (d.points.length < 2) chartCard.append(ui.h("p", { class: "muted" }, d.points.length ? "One balance so far. Add a balance from another day below, or save your totals on Net worth now and then, to see how it moves." : "No balance with a date yet. Add one below."));
  else drawChart(chartCard, d.points);

  // add a balance from another day
  const form = ui.form([
    { key: "date", label: "Day", type: "date", required: true },
    { key: "balance", label: a.liability ? "What you owed that day" : "Balance that day", type: "money", required: true, help: "from a statement or the bank's app" },
  ], { date: today, balance: null }, (v) => {
    if (v.date > today) { form.append(ui.notice("error", "That day is in the future. Pick today or an earlier day.")); return; }
    pending = `Saved ${money(v.balance)} for ${fmt.date(v.date)}.`;
    store.update((q) => { addPoint(q, a.id, v.date, v.balance); });
  }, { submitLabel: "Add this balance" });
  const saved = (plan.accounts.find((x) => x.id === a.id)?.history ?? []).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(String(h?.date ?? ""))).sort((x, y) => y.date.localeCompare(x.date));
  root.append(ui.h("details", { class: "card fold fold-card", open: d.points.length ? null : true },
    ui.h("summary", {}, ui.h("h2", {}, "Balances by day"), ui.h("span", { class: "fold-status" }, `${saved.length} saved`), ui.h("span", { class: "fold-chev" }, "›")),
    saved.length ? ui.h("ul", { class: "records" }, saved.map((h) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, fmt.date(h.date)), ui.h("span", { class: "rec-value" }, money(a.liability ? Math.abs(Number(h.balance)) : Number(h.balance)))),
      ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" }, ui.button("Remove", () => {
        if (!ui.confirm(`Remove the balance saved for ${fmt.date(h.date)}?`)) return;
        pending = `Removed the balance for ${fmt.date(h.date)}.`;
        store.update((q) => { removePoint(q, a.id, h.date); });
      }, { class: "secondary small" })))))) : ui.h("p", { class: "muted small" }, "None saved yet. The balance on file comes from Net worth."),
    ui.h("h3", {}, "Add a balance"), form));

  // money in and out
  if (d.lines && d.flows) {
    const f = d.flows;
    root.append(ui.card("Money in and out",
      f.recent.count
        ? ui.row(ui.stat("In, last 30 days", money(f.recent.in), `${f.recent.count} ${f.recent.count === 1 ? "transaction" : "transactions"}`), ui.stat("Out, last 30 days", money(Math.abs(f.recent.out)), `${f.recent.net >= 0 ? "+" : "−"}${money(Math.abs(f.recent.net))} overall`))
        : ui.h("p", { class: "muted" }, `Nothing in the last 30 days.${d.recent.length ? ` The latest transaction on file is from ${fmt.date(d.recent[0].date)}; import a newer bank file to bring it up to date.` : ""}`),
      ui.h("ul", { class: "records" }, f.months.filter((m) => m.count).map((m) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })), ui.h("span", { class: "rec-value" }, signed(m.net))),
        ui.h("div", { class: "rec-sub" }, `In ${money(m.in)}, out ${money(Math.abs(m.out))}, ${m.count} ${m.count === 1 ? "transaction" : "transactions"}`)))),
      ui.h("h3", {}, "Latest transactions"),
      ui.h("ul", { class: "records" }, d.recent.map((t) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t.payee || "No description"), ui.h("span", { class: "rec-value" }, signed(Number(t.amount) || 0))),
        ui.h("div", { class: "rec-sub" }, fmt.date(t.date))))),
      ui.row(ui.h("a", { class: "btn secondary small", href: "#/transactions/ledger" }, "All transactions"))));
  } else root.append(ui.card("Money in and out", ui.h("p", { class: "muted" }, "No transactions for this account yet. Import its bank file to see what goes in and out."), ui.row(ui.h("a", { class: "btn secondary small", href: "#/transactions/import" }, "Import a bank file"))));

  // the last checked statement
  const s = d.since;
  if (d.lines) root.append(ui.card("Checked against a statement", s
    ? ui.h("div", {},
      ui.h("p", {}, `Last checked: ${fmt.date(s.check.from)} to ${fmt.date(s.check.to)}, ending at ${money(s.check.endBalance)}.`),
      ui.h("p", { class: "muted small" }, `With the ${s.lines} ${s.lines === 1 ? "transaction" : "transactions"} on file since then, your transactions say ${money(s.ledgerBalance)}${s.onFileDate ? ` on ${fmt.date(s.onFileDate)}` : " now"}.${s.gap === null ? "" : s.gap === 0 ? " That is the balance on file." : ` The balance on file then is ${money(s.onFile)}: ${money(Math.abs(s.gap))} apart, so a transaction may be missing or the balance on file is out of date.`}`))
    : ui.h("p", { class: "muted" }, "Not checked yet. Checking a statement shows whether your transactions add up to what the bank says."),
    ui.row(ui.h("a", { class: "btn secondary small", href: "#/transactions/reconcile" }, "Check a statement"))));

  // notes
  const notes = ui.h("textarea", { rows: 4, "aria-label": "Notes on this account", placeholder: "For example: the rate, when a promotion ends, who to call" }, a.notes);
  root.append(ui.card("Notes", notes, ui.row(ui.button("Save notes", () => {
    pending = "Notes saved.";
    store.update((q) => { const x = (q.accounts ?? []).find((y) => y.id === a.id); if (x) x.notes = notes.value.trim(); });
  }, { class: "secondary" })), ui.h("p", { class: "muted small" }, "Never put a password or a full account number here.")));

  // the line: time along the bottom, the balance up the side; touch or point to read a day
  function drawChart(card, pts) {
    const box = ui.h("div", { class: "ac-chart" });
    card.append(box);
    const W = Math.max(280, Math.round(card.clientWidth - 2 * 18) || 320), H = 190, L = 58, R = 14, T = 14, B = 26;
    const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
    const vals = pts.map((p) => p.balance), tk = ticks(Math.min(...vals), Math.max(...vals));
    const lo = tk[0], hi = tk[tk.length - 1];
    const x = (p) => L + (t1 === t0 ? 0 : ((Date.parse(p.date) - t0) / (t1 - t0)) * (W - L - R));
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const NS = "http://www.w3.org/2000/svg";
    const el = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; return e; };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${a.liability ? "Owed" : "Balance"} from ${fmt.date(pts[0].date)} (${whole(pts[0].balance)}) to ${fmt.date(pts[pts.length - 1].date)} (${whole(pts[pts.length - 1].balance)})` });
    for (const v of tk) { svg.append(el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: "var(--line)", "stroke-width": 1 }), el("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, Math.max(Math.abs(hi), Math.abs(lo)) >= 10000 ? `${whole(v / 1000)}K` : whole(v))); }
    svg.append(el("text", { x: L, y: H - 6, "text-anchor": "start" }, fmt.date(pts[0].date)), el("text", { x: W - R, y: H - 6, "text-anchor": "end" }, fmt.date(pts[pts.length - 1].date)));
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(p.balance).toFixed(1)}`).join("");
    svg.append(el("path", { d: `${path}L${x(pts[pts.length - 1]).toFixed(1)},${y(lo).toFixed(1)}L${x(pts[0]).toFixed(1)},${y(lo).toFixed(1)}Z`, fill: "var(--ac-line)", "fill-opacity": 0.1 }));
    svg.append(el("path", { d: path, fill: "none", stroke: "var(--ac-line)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    const end = pts[pts.length - 1];
    svg.append(el("circle", { cx: x(end), cy: y(end.balance), r: 4, fill: "var(--ac-line)", stroke: "var(--panel)", "stroke-width": 2 }));
    svg.append(el("text", { class: "ac-end", x: x(end) - 8, y: y(end.balance) - 10, "text-anchor": "end" }, whole(end.balance)));
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
    svg.addEventListener("pointermove", show); svg.addEventListener("pointerdown", show); svg.addEventListener("pointerleave", hide);
    card.append(ui.h("p", { class: "muted small" }, `${pts.length} balances, from the ones saved by day and the balance on file. Touch the line to read a day.`));
  }
}
