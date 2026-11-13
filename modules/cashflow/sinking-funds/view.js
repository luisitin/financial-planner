// modules/cashflow/sinking-funds/view.js -- DOM only. The monthly set-aside total, then each irregular cost with its next
// date. A bill that comes yearly or every three months opens a small form under its line: what is already set aside for
// it (gap #12), and its next due date; its line then says whether that is on track or how much short by the due date.
import { compute, nextDueOn, CYCLE } from "./compute.js";
import { parts, rest } from "../../../core/ui/more.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// scoped to this page: the right-hand column, the amber words of a short bill, and a row's form or green line taking the
// whole width of the list (a .page-list row is a flex row)
const STYLE = ".sf-root .st.amount { text-align: right; } .sf-root .sf-short { color: var(--warn); font-weight: 600; } .sf-root .page-list li.rec-form, .sf-root .page-list li.sf-said { display: block; }";
const periodWord = { quarterly: "every three months", annual: "once a year", once: "one time" };
const RIGHT = "Right column: what to put aside each month. One-time costs are spread over the months until their date.";

// The shell draws the page again after store.update: the bill just saved waits here for its green line ({ key, was, list:
// "due" when its form was opened under "Coming up", else "all"), so the line lands under the row that was tapped.
let pending = null;
// The bill whose form is open under its line ({ key, li, close, release }); one at a time.
let opened = null;

/** When a due date falls, in calendar months from today: { in: "in March" | "this month" | "in March 2028", by, month, cm }. */
export function whenWords(due, today) {
  const [y, m] = String(due).split("-").map(Number), [ty, tm] = String(today).split("-").map(Number);
  const cm = (y - ty) * 12 + (m - tm);
  const month = cm >= 12 ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
  return cm <= 0 ? { in: "this month", by: "this month", month, cm } : { in: `in ${month}`, by: `by ${month}`, month, cm };
}

/** A day in words: "November 12", with the year when it is not this year's ("March 1, 2025"). */
export function dayWords(date, today) {
  const [y, m, d] = String(date).split("-").map(Number), ty = Number(String(today).split("-")[0]);
  return `${MONTHS[m - 1]} ${d}${y !== ty ? `, ${y}` : ""}`;
}

/**
 * The line on a followed bill, one written case each (R5): { text, alarm (the amber words inside text, or null), next (the
 * catch-up sentence under it, or null) }. `money` formats an amount.
 */
export function asideLine(f, today, money) {
  const a = f.aside, A = money(f.amount), s = money(a.amount);
  const w = a.due ? whenWords(a.due, today) : null;
  // noted on or before a due date that has passed: it was for that bill, so it says nothing of the next one
  if (a.state === "stale") return { text: `${s} noted for the bill due ${dayWords(a.lastDue, today)} · tap to update`, alarm: null, next: null };
  if (a.state === "ready") {
    if (Math.round(a.extra) >= 1) return { text: w ? `${s} set aside, ${money(a.extra)} more than the bill · due ${w.in}` : `${s} set aside, ${money(a.extra)} more than the bill`, alarm: null, next: null };
    return { text: w ? `All ${A} set aside · due ${w.in}` : `All ${A} set aside`, alarm: null, next: null };
  }
  if (a.state === "no-date") return { text: `${s} of ${A} set aside · no date yet: tap to add one`, alarm: null, next: null };
  if (a.state === "on-track") return { text: `${s} of ${A} set aside · due ${w.in} · on track`, alarm: null, next: null };
  // short
  if (w.cm <= 0) { const alarm = `short ${money(a.short)}, due this month`; return { text: `${s} of ${A} set aside · ${alarm}`, alarm, next: null }; }
  const alarm = `short ${money(a.short)} by ${w.month}`;
  const next = a.months >= 2 ? `Put aside ${money(a.toFinish)} a month to catch up.` : `Put aside ${money(f.amount - a.amount)} before it is due.`;
  return { text: `${s} of ${A} set aside · ${alarm}`, alarm, next };
}

/** The same state as one full sentence, one written case each: the green line after a save and the working use it. */
export function asideSentence(f, today, money) {
  const a = f.aside, A = money(f.amount), s = money(a.amount);
  const w = a.due ? whenWords(a.due, today) : null;
  if (a.state === "stale") return `${s} was noted for the bill due ${dayWords(a.lastDue, today)}. Note what is set aside now for the next one${w ? `, due ${w.in}` : ""}.`;
  if (a.state === "ready") {
    if (Math.round(a.extra) >= 1) return `${s} is set aside, ${money(a.extra)} more than the bill.`;
    return w ? `All ${A} is set aside for the bill due ${w.in}.` : `All ${A} is set aside.`;
  }
  if (a.state === "no-date") return `${s} of ${A} is set aside. Add when it is due to see if you are on track.`;
  if (a.state === "on-track") return `${s} of ${A} is set aside, on track for the bill due ${w.in}.`;
  if (w.cm <= 0) return `${s} of ${A} is set aside, ${money(a.short)} short, and it is due this month.`;
  if (a.months >= 2) return `${s} of ${A} is set aside, ${money(a.short)} short by ${w.month}. Put aside ${money(a.toFinish)} a month to catch up.`;
  return `${s} of ${A} is set aside, ${money(a.short)} short by ${w.month}. Put aside ${money(f.amount - a.amount)} before it is due.`;
}

/** The green line after a bill's form was saved (R7): its new state by name. `f` is the bill as worked out after the save. */
export function savedWords(f, { was = false } = {}, today, money) {
  if (!f) return "Saved.";
  if (f.aside) return `Saved. ${f.name}: ${asideSentence(f, today, money)}`;
  if (was) return `Saved. ${f.name} no longer shows what is set aside.`;
  const due = f.next ? nextDueOn(f.next, CYCLE[f.period] ?? 12, today) : null;
  if (due) return `Saved. ${f.name} is next due ${whenWords(due, today).in}.`;
  return `Saved. Type what is already set aside for ${f.name} to see if it is on track.`;
}

/** The working for one followed bill, with the person's own figures (the "How this is worked out" part). */
function workedFor(f, today, fmt, money) {
  const a = f.aside, A = money(f.amount), s = money(a.amount);
  const noted = a.at ? `You noted ${s} on ${fmt.date(a.at)}` : `You noted ${s}`;
  const head = `${f.name}: ${A} ${periodWord[f.period]}`;
  if (a.state === "stale") return `${head}${a.due ? `, next due ${whenWords(a.due, today).in}` : ""}. ${noted}, for the bill due ${dayWords(a.lastDue, today)}, so it does not count toward the next one: tap the bill to note what is set aside now.`;
  if (a.state === "ready") return `${head}. ${noted}: the whole bill is set aside.`;
  if (a.state === "no-date") return `${head}. ${noted}. With no due date the rest cannot be worked out: tap the bill to add one.`;
  const w = whenWords(a.due, today), gone = Math.min(a.cycle, Math.max(0, a.cycle - a.months));
  // whole months (n) and calendar months (w) part on a date early next month: "due in December, less than a month away"
  const away = w.cm <= 0 ? "" : a.months === 0 ? ", less than a month away" : `, ${a.months} month${a.months === 1 ? "" : "s"} away`;
  const verdict = a.state === "short" ? `${money(a.short)} short` : "on track";
  const left = money(f.amount - a.amount);
  const still = a.months >= 2 ? `Still to put aside: ${A} − ${s} = ${left}, ÷ ${a.months} months = ${money(a.toFinish)} a month.` : `Still to put aside: ${A} − ${s} = ${left}, before it is due.`;
  return `${head}, due ${w.in}${away}. Set aside by now: ${A} × ${gone} ÷ ${a.cycle} = ${money(a.needed)}. ${noted}: ${verdict}. ${still}`;
}

/**
 * The bill's own form, drawn under its line: [form, the way to change the bill itself on Expenses]. "Already set aside"
 * first; "Next due" under "More details (optional)" when Expenses has a date, in sight when there is none (the answer needs
 * it). Save writes `setAside` (dated today) and `nextDue` on the expense; a blank box takes them away.
 */
export function asideForm(ctx, f, expense, { onCancel, list = "all" } = {}) {
  const { ui, fmt, store } = ctx;
  const today = fmt.today();
  const fromExpenses = nextDueOn(expense?.startDate, CYCLE[f.period] ?? 12, today);
  const fields = [
    { key: "setAside", label: "Already set aside", type: "money", min: 0,
      help: f.aside ? `${f.aside.at ? `Last noted ${fmt.date(f.aside.at)}${f.aside.lastDue ? `, for the bill due ${fmt.date(f.aside.lastDue)}` : ""}. ` : ""}Empty the box and save to stop tracking it.` : `What you have put aside for ${f.name} so far. We date it today.` },
    { key: "nextDue", label: "Next due", type: "date", more: !!fromExpenses,
      help: fromExpenses ? `Blank: ${fmt.date(fromExpenses)}, from Expenses.` : "The day the next bill comes." },
  ];
  const values = { setAside: f.aside ? f.aside.amount : "", nextDue: expense?.nextDue ?? "" };
  const form = ui.form(fields, values, (v) => {
    const amount = v.setAside === null || v.setAside === undefined || v.setAside === "" ? null : Number(v.setAside);
    const due = v.nextDue || "";
    pending = { key: f.key, was: !!f.aside, list: list === "due" ? "due" : "all" };
    if (opened) { opened.release?.(); opened = null; }
    store.update((p) => {
      const e = (p.expenses ?? []).find((x) => x.id === f.expenseId);
      if (!e) return;
      if (amount === null) { delete e.setAside; delete e.setAsideAt; } else { e.setAside = amount; e.setAsideAt = today; }
      if (due) e.nextDue = due; else delete e.nextDue;
    });
  }, { submitLabel: "Save", onCancel: () => onCancel?.() });
  const way = ui.h("div", { class: "row", style: { marginTop: "12px" } },
    ui.button("Change the bill on Expenses", () => ctx.go("cashflow", "expenses", [], { edit: f.expenseId, back: "cashflow/sinking-funds" }), { class: "secondary" }));
  return [form, way];
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  const saved = pending; pending = null;
  opened = null;   // a new draw: any form under a line went with the old one
  const wrap = ui.h("div", { class: "sf-root" }, ui.h("style", {}, STYLE));
  root.append(wrap);

  if (!d.hasData) {
    wrap.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Irregular expenses"),
      ui.h("p", { class: "lede" }, "The costs that do not come every month: yearly insurance, quarterly taxes, gifts, the summer trip, a repair with a date. Each becomes a monthly amount to set aside so the money is there when the bill lands."),
      ui.h("p", { class: "muted small" }, "Add them on the Expenses page with \"every three months\", \"once a year\" or \"one time only\" and a date. Yearly payments found in your transactions show up here on their own."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Add an irregular expense"))));
    return;
  }
  const trackable = (f) => f.source === "typed" && !!f.expenseId && !!CYCLE[f.period];
  const expenseOf = (f) => (plan.expenses ?? []).find((x) => x.id === f.expenseId) ?? null;
  // A bill that comes back opens its form under its line; a one-time cost opens its own form on Expenses with a way back
  // here (CF-5, F2). One form at a time, on one history step: a second tap on the same line or the phone's Back shuts it;
  // a tap on another bill moves the form there and keeps that step (letting it go and taking a new one at once would
  // leave the new form without one).
  const hide = (o) => { o.close(); o.li.setAttribute?.("aria-expanded", "false"); };
  const shut = () => {
    if (!opened) return;
    const o = opened; opened = null;
    o.release?.(); hide(o);
  };
  const toggle = (li, f, list) => {
    if (opened?.li === li) { shut(); return; }
    const was = opened; opened = null;
    if (was) hide(was);
    const close = ui.openUnder(li, (holder) => holder.append(...asideForm(ctx, f, expenseOf(f), { onCancel: shut, list })));
    opened = { key: f.key, li, close, release: was?.release ?? null };
    if (!opened.release) opened.release = ctx.layer?.(() => { const o = opened; opened = null; if (o) hide(o); }) ?? null;
    li.setAttribute?.("aria-expanded", "true");
  };
  const keys = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } };
  const tapTo = (f, list) => {
    if (f.source !== "typed" || !f.expenseId) return {};
    if (trackable(f)) return { role: "button", tabindex: "0", "aria-expanded": "false", style: { cursor: "pointer" }, onClick: (e) => toggle(e.currentTarget, f, list), onKeydown: keys };
    return { role: "link", tabindex: "0", style: { cursor: "pointer" }, onClick: () => ctx.go("cashflow", "expenses", [], { edit: f.expenseId, back: "cashflow/sinking-funds" }), onKeydown: keys };
  };

  wrap.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `Set aside ${money(d.monthly)} a month`),
    ui.h("p", { class: "lede" }, `That covers ${d.funds.length} irregular cost${d.funds.length === 1 ? "" : "s"} (${money(d.yearly)} a year plus the one-time ones) without a scramble when they land. A savings account of its own for this works best.`),
  ));
  // the green line after a bill's form was saved: right under the row that was tapped, said once (R7, R9 item 8); under its
  // line in the list when the save took it out of the next three months
  const savedIn = saved ? (saved.list === "due" && d.dueNext.some((f) => f.key === saved.key) ? "due" : "all") : null;
  const said = (f) => ui.h("li", { class: "sf-said" }, ui.notice("ok", savedWords(f, saved, today, money)));
  // under a whole month away: "this month" only in this calendar month, else "next month" (the line says "by December")
  const soon = (f) => (f.monthsToNext === 0 ? (whenWords(f.next, today).cm <= 0 ? "this month" : "next month") : `in ${f.monthsToNext} month${f.monthsToNext === 1 ? "" : "s"}`);
  const dueRow = (f) => {
    const li = ui.h("li", { ...tapTo(f, "due"), dataset: { key: f.key } },
      ui.h("span", { class: "ic" }, f.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, f.name), ui.h("div", { class: "d" }, `${fmt.date(f.next)} · ${soon(f)}`)),
      ui.h("span", { class: "st" }, money(f.amount)));
    return savedIn === "due" && saved.key === f.key ? [li, said(f)] : li;
  };
  if (d.dueNext.length) wrap.append(ui.card("Coming up in the next three months", ui.h("ul", { class: "page-list" }, d.dueNext.map(dueRow))));

  const detailOf = (f) => {
    if (!f.aside) return [ui.h("div", { class: "d" }, `${money(f.amount)} ${periodWord[f.period] ?? f.period}${f.next ? ` · next ${fmt.date(f.next)}` : f.source === "typed" ? " · no date yet: tap to add one" : " · no date yet"}`)];
    const a = asideLine(f, today, money);
    const at = a.alarm ? a.text.indexOf(a.alarm) : -1;
    return [ui.h("div", { class: "d" }, ...(at >= 0 ? [a.text.slice(0, at), ui.h("span", { class: "sf-short" }, a.alarm), a.text.slice(at + a.alarm.length)] : [a.text])),
      a.next ? ui.h("div", { class: "d" }, a.next) : null];
  };
  const costRow = (f) => {
    const li = ui.h("li", { ...tapTo(f, "all"), dataset: { key: f.key } },
      ui.h("span", { class: "ic" }, f.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, f.name, f.source === "found" ? ui.h("span", { class: "pill" }, "found in transactions") : null), ...detailOf(f)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, money(f.monthly)), ui.h("div", { class: "muted small" }, "a month"), f.source === "typed" ? ui.h("div", { class: "muted small" }, trackable(f) ? "Set aside ›" : "Edit ›") : null));
    return savedIn === "all" && saved.key === f.key ? [li, said(f)] : li;
  };
  const followed = d.funds.filter((f) => f.aside);
  const anyTrackable = d.funds.some(trackable);
  wrap.append(ui.card("Every irregular cost",
    ...rest(ctx, { id: "costs", items: d.funds, row: costRow, noun: "irregular costs", one: "irregular cost", list: "page-list",
      keep: (f) => f.aside?.state === "short" || f.aside?.state === "stale" || (savedIn === "all" && f.key === saved.key) }),
    saved && !d.funds.some((f) => f.key === saved.key) ? ui.notice("ok", "Saved.") : null,
    // nothing followed yet: today's line about the right-hand figure, in place; it moves into the working once there is one
    !followed.length ? ui.h("p", { class: "muted small" }, RIGHT) : null,
    anyTrackable && !followed.length ? ui.h("p", { class: "muted small" }, "Tap a bill that comes yearly or every three months to note what is already set aside for it.") : null,
    ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Change these on Expenses")),
  ));

  // How this is worked out, once a bill is followed (before that the page is today's, critic 4): the right-hand figure, each
  // followed bill's sum with the person's own figures, what it leaves out, and where the method comes from (read 2026-11-13)
  if (!followed.length) return;
  wrap.append(ui.h("div", {}, parts(ctx, { id: "how", kind: "how", set: followed.length, body: () => [
    ui.h("p", {}, "Each bill that comes every three months or once a year: what it costs in a year ÷ 12. A one-time cost: its amount ÷ the months until its date. That is the figure on the right of each line; the total at the top adds them up."),
    ui.h("ul", { class: "page-list" }, followed.map((f) => ui.h("li", { class: "sf-said" }, workedFor(f, today, fmt, money)))),
    ui.h("p", {}, "What should be set aside by now: the bill × the months since the last one ÷ the months between bills, which is where a steady amount each month would have got to. It does not know what you add after you note a figure: change it when you put more aside."),
    ui.h("p", { class: "muted small" }, "Where this comes from: the Consumer Financial Protection Bureau's savings plan worksheet (Your Money, Your Goals) asks whether money is set aside for costs that come one to four times a year, such as car or renter's insurance. Read November 13, 2026."),
  ] })));
}
