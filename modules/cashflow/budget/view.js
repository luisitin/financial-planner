// modules/cashflow/budget/view.js -- DOM only. Envelopes with progress, suggestions from the
// last months, one form to add or edit an envelope.
import { compute, useExpenses } from "./compute.js";
import { categoriesOf } from "../../transactions/categories/compute.js";
import { bringWords, monthsWords, shortDate } from "../../transactions/ledger/compute.js";

const state = { month: "", route: null };   // route: the arrival the address's ?month= was last taken from (the Monthly review's link)

let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  // opened from the Monthly review with ?month=2026-10: that month, until a month is picked here
  const qm = /^\d{4}-\d{2}$/.test(ctx.route?.query?.month ?? "") ? ctx.route.query.month : null;
  // each arrival (a new route; a redraw after a save keeps the same one) takes the address's month; a month picked here stays
  if (qm && ctx.route !== state.route) state.month = qm;
  state.route = ctx.route;
  const d = compute(plan, { today, month: state.month || undefined });
  // a month with days missing in an account's files is left out of the suggestions, and says why; months that share one gap
  // (a hole across July and August) are said once: "July and August 2026 are left out: ..." (2026-11-02)
  const groups = [];
  // (a payment counted for neither card: its reason with no amount or month, so August to October share one; re-check 5)
  for (const s of [...(d.suggestSkipped ?? [])].sort((a, b) => a.ym.localeCompare(b.ym))) {
    const why = s.issues?.[0]?.brief ?? s.issues?.[0]?.why ?? "some days are missing";
    const g = groups.find((x) => x.why === why);
    if (g) g.yms.push(s.ym); else groups.push({ why, yms: [s.ym] });
  }
  const withYear = (yms) => { const ys = new Set(yms.map((m) => m.slice(0, 4))); return `${monthsWords(yms)}${ys.size === 1 ? ` ${[...ys][0]}` : ""}`; };
  const skippedNote = groups.map((g) => ` ${withYear(g.yms)} ${g.yms.length > 1 ? "are" : "is"} left out: ${g.why}.`).join("");
  let editing = null;
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  const cats = categoriesOf(plan).filter((c) => c.kind === "expense");
  const FIELDS = [
    { key: "category", label: "Category", type: "select", options: cats.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` })) },
    { key: "amount", label: "Amount each month", type: "money", required: true, min: 0 },
    { key: "rollover", label: "Unspent money rolls into next month", type: "checkbox" },
  ];

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasBudget ? `Budget for ${d.label}` : "Budget"),
    ui.h("p", { class: "lede" }, d.hasBudget && !d.hasData
      // envelopes but no bank file yet: nothing is spent "so far", so no pace and no "left" (round 4, 2026-11-02)
      ? `${d.envelopes.length} envelope${d.envelopes.length === 1 ? "" : "s"}, ${fmt.money(d.totals.amount, cur)} a month. Spending against them shows once a bank file is in.`
      : d.hasBudget
      ? (d.totals.left >= 0 ? `${fmt.money(d.totals.left, cur)} left in your envelopes with ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} to go.` : `Your envelopes are ${fmt.money(-d.totals.left, cur)} over with ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} to go.`)
      : "Give each kind of spending an envelope: an amount for the month. The page shows what you have spent so far (from your transactions), what is left, and whether you are on pace."),
    // with bank files in but no whole month in them, say why none is suggested from, not "once a bank file is in" (re-check 5)
    d.hasBudget ? null : ui.h("p", { class: "muted small" }, d.fromExpenses.length ? (d.hasData ? `Start from the amounts on your Expenses page below. Your bank files have no whole month to suggest amounts from yet${skippedNote ? `.${skippedNote}` : d.cover ? `; they cover ${fmt.date(d.cover.from)} to ${fmt.date(d.cover.to)}.` : "."}` : "Start from the amounts on your Expenses page below. Spending against each envelope shows once a bank file is in.")
      : !d.hasData ? "Import a bank file first and the page will suggest amounts from what you actually spend."
      : d.suggestFrom.length ? `Suggestions below are the average of your last ${d.suggestFrom.length === 1 ? "whole month" : `${d.suggestFrom.length} whole months`} of real spending.${skippedNote}`
      : `Suggestions need at least one whole month in your bank files; yours cover ${fmt.date(d.cover.from)} to ${fmt.date(d.cover.to)}.${skippedNote || " Most banks let you download 90 days: import that and they appear."}`),
    // a file that stops days ago leaves "spent so far" short: say where it stops
    d.stale ? ui.h("p", { class: "muted small" }, `Spent so far comes from your bank files, which stop on ${fmt.date(d.cover.to)}. Import a newer file to count the rest of the month.`) : null,
    // a payment that went to one of two cards this month: in no envelope, said once (re-check 4, 2026-11-02)
    d.unsure ? ui.h("p", { class: "small" }, `${d.unsure} Until then, spending here leaves it out.`) : null,
    d.hasBudget && !d.hasData ? ui.row(ui.h("a", { class: "btn secondary", href: "#/transactions/import" }, "Import a bank file")) : null,
  ));
  // the confirmation goes at the top, where the eye is after a tap (it sat under the list)
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const months = []; for (let k = 0; k < 6; k++) { const dt = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - k, 1); months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`); }
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Month", ui.select(months.map((m) => ({ value: m, label: compute(plan, { today, month: m }).label })), d.month, { onChange: (e) => { state.month = e.target.value; redraw(); } })))));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.envelopes.length === 0 && !d.fromExpenses.length;   // with Expenses to start from, typing by hand folds away
  const drawForm = (prefill) => {
    formHost.innerHTML = "";
    if (prefill) showForm = true;
    if (!showForm && !editing) { formHost.append(ui.button(d.envelopes.length ? "+ Add another envelope" : "+ Add an envelope by hand", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { rollover: false, ...(prefill ?? {}) };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.label}` : "Add an envelope"),
      ui.form(FIELDS, values, (v) => {
        pending = editing ? "Envelope saved." : "Envelope added.";
        store.update((p) => {
          p.budgets = p.budgets ?? [];
          if (editing) { const i = p.budgets.findIndex((b) => b.id === editing.id); if (i >= 0) p.budgets[i] = { ...p.budgets[i], category: v.category, amount: v.amount ?? 0, rollover: !!v.rollover }; }
          else { const i = p.budgets.findIndex((b) => b.category === v.category); if (i >= 0) p.budgets[i] = { ...p.budgets[i], amount: v.amount ?? 0, rollover: !!v.rollover }; else p.budgets.push({ id: ui.uid(), category: v.category, amount: v.amount ?? 0, period: "monthly", rollover: !!v.rollover }); }
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add envelope", resetAfter: !editing, onCancel: (editing || d.envelopes.length) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove the ${editing.label} envelope`, () => { const id = editing.id; editing = null; pending = "Envelope removed."; store.update((p) => { p.budgets = (p.budgets ?? []).filter((b) => b.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  const out = ui.h("div");
  if (d.envelopes.length) root.append(ui.card("Envelopes",
    ui.h("ul", { class: "page-list" }, d.envelopes.map((e) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.budgets.find((b) => b.id === e.id); editing = { ...editing, label: e.label }; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, e.icon),
      ui.h("span", { class: "body" },
        ui.h("div", { class: "t" }, e.label, " ", !d.hasData ? null : e.pace === "over" ? ui.h("span", { class: "pill warn" }, "over") : e.pace === "ahead" ? ui.h("span", { class: "pill warn" }, "spending fast") : e.pace === "paid" ? ui.h("span", { class: "pill ok" }, "paid") : ui.h("span", { class: "pill ok" }, "on track")),
        d.hasData ? ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.round(e.share * 100)}%`, background: e.pace === "over" ? "var(--bad)" : e.pace === "ahead" ? "var(--warn)" : "var(--ok)" } })) : null,
        ui.h("div", { class: "d" }, d.hasData ? `${fmt.money(e.spent, cur)} of ${fmt.money(e.available, cur)}${e.carried ? ` (${fmt.money(e.carried, cur)} rolled over)` : ""}${e.rollover ? " · rolls over" : ""}` : `a month${e.rollover ? " · rolls over" : ""}`)),
      ui.h("span", { class: "st", style: { fontWeight: "600", color: e.left < 0 ? "var(--bad)" : "inherit" } }, d.hasData ? `${e.left < 0 ? "-" : ""}${fmt.money(Math.abs(e.left), cur)} left` : fmt.money(e.amount, cur))))),
    ui.h("p", { class: "muted small" }, d.hasData ? `Day ${d.dayOfMonth} of ${d.daysInMonth}. "Spending fast" means more than the share of the month that has passed. Tap an envelope to change it.` : "Tap an envelope to change its amount."),
    out, formHost,
  ));
  if (d.unbudgeted.length) root.append(ui.card("Spent this month with no envelope",
    ui.h("ul", { class: "page-list" }, d.unbudgeted.slice(0, 12).map((u) => ui.h("li", {},
      ui.h("span", { class: "ic" }, u.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, u.label)),
      ui.h("span", { class: "st" }, fmt.money(u.spent, cur), " ", u.category ? ui.button("Add envelope", () => { editing = null; drawForm({ category: u.category, amount: Math.round(u.spent) }); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary small" }) : null))))));
  const useIt = (sg) => { pending = `Envelope added for ${sg.label}.`; store.update((p) => { p.budgets = p.budgets ?? []; if (!p.budgets.some((b) => b.category === sg.category)) p.budgets.push({ id: ui.uid(), category: sg.category, amount: sg.average, period: "monthly", rollover: false }); }); };
  const suggestionRow = (sg) => ui.h("li", {},
    ui.h("span", { class: "ic" }, sg.icon),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, sg.label), ui.h("div", { class: "d" }, `average of ${sg.months} whole month${sg.months === 1 ? "" : "s"}`)),
    ui.h("span", { class: "st" }, fmt.money(sg.average, cur), " ", ui.button("Use it", () => useIt(sg), { class: "secondary small" })));
  // a card whose own file is missing in those months: what went to it is in no suggestion, so say what the amounts leave out
  const cardNote = (d.suggestCards ?? []).length ? ui.h("div", { class: "bu-cards", style: { marginBottom: "10px" } },
    // every month averaged: "about $X a month went to it"; only some (its file is in for the others): name them (2026-11-02)
    ...d.suggestCards.map((c) => { const all = (c.inMonths ?? []).length >= d.suggestFrom.length, when = monthsWords(c.inMonths ?? []);
      return ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, all ? `${c.name}'s purchases aren't in these amounts: about ${fmt.money(c.average, cur)} a month went to it, but its own file isn't in, so what it bought isn't sorted into kinds yet. ${bringWords(c.name)}`
        : `${c.name}'s purchases in ${when} aren't in these amounts: ${fmt.money(c.total ?? c.average * c.months, cur)} went to it then, ${c.before && c.first ? `before its file starts on ${shortDate(c.first)}` : `but its ${when} file isn't in`}, so what it bought then isn't sorted into kinds yet. ${bringWords(c.name)}`); }),
    ui.row(...d.suggestCards.slice(0, 2).map((c) => ui.h("a", { class: "btn secondary", href: `#/transactions/import?accountId=${encodeURIComponent(c.cardId)}` }, bringWords(c.name).replace(/\.$/, ""))))) : null;
  if (d.suggestions.length) root.append(ui.card("Suggested from your last months", cardNote, ui.h("ul", { class: "page-list" }, d.suggestions.slice(0, 12).map(suggestionRow))));
  // nothing budgeted and no whole bank month: the amounts already typed on Expenses, in one tap (round 4, 2026-11-02)
  if (d.fromExpenses.length) {
    const nba = ctx.computeOf?.("overview/next-best-action", { today });
    const spare = nba?.ready ? nba.spare.monthly : null;
    // short only in a lean month (Side income's "count on" holds part of uneven pay back): said as the other pages say it,
    // with what a month that brings the Income page's amount leaves, to the nearest $10 (review 2026-11-02, round 5)
    const lean = nba?.ready && nba.spare.held > 0.5 ? nba.spare : null;
    const n = d.fromExpenses.length;
    root.append(ui.card("Start from your expenses",
      ui.h("p", {}, `Your Expenses page has ${n} kind${n === 1 ? "" : "s"} of spending, ${fmt.money(d.fromExpensesTotal, cur)} a month in all. Use them as your envelopes, then change any of them.`),
      spare !== null ? ui.h("p", { class: "muted small" }, spare >= 0 ? `After these, tax and your saving, about ${fmt.money(spare, cur)} is left each month${lean ? ", counting uneven pay at what you can count on" : ""}: the same figure as the Dashboard.`
        : lean ? `In a lean month, these, tax and your saving come to about ${fmt.money(-spare, cur)} more than comes in, counting uneven pay at what you can count on: the same gap as the Dashboard. ${lean.fullKind === "ahead" ? `A month that brings the Income page's amount leaves about ${fmt.money(lean.fullAbout, cur)}.` : lean.fullKind === "even" ? "Even a month that brings the Income page's amount only just about breaks even." : `Even a month that brings the Income page's amount is about ${fmt.money(-lean.fullAbout, cur)} short.`}`
        : `These, tax and your saving come to about ${fmt.money(-spare, cur)} a month more than comes in: the same gap as the Dashboard.`) : null,
      ui.h("div", { class: "row" },
        ui.button("Use these as my budget", () => {
          pending = `${n} envelope${n === 1 ? "" : "s"} added from your expenses. Spending against them shows once a bank file is in; tap one to change it.`;
          store.update((p) => { useExpenses(p, d.fromExpenses, ui.uid); });
        }),
        ui.h("a", { class: "btn secondary", href: "#/transactions/import" }, "Import a bank file instead")),
      ui.h("ul", { class: "page-list" }, d.fromExpenses.map((x) => ui.h("li", {},
        ui.h("span", { class: "ic" }, x.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.label)),
        ui.h("span", { class: "st amount" }, fmt.money(x.amount, cur))))),
    ));
  }
  if (!d.envelopes.length) { formCard.append(out, formHost); root.append(formCard); }
}
