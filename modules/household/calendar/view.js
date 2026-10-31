// modules/household/calendar/view.js -- DOM only. The money dates ahead as a list by month (a calendar grid does not
// fit a phone): how far ahead and which kinds, each date with what it is and a link to its page; your own reminders
// added, changed and removed here; and the list saved as a calendar file for a phone.
import { compute, toIcs, saveReminder, removeReminder, periodDates, KINDS, REPEATS } from "./compute.js";

let pending = null;         // the confirmation shown on the next render
let range = "quarter";      // how far ahead
let only = null;            // the kind chosen in the chips (null = all)
let editing = null;         // the reminder being changed
let adding = false;         // the add form is open

const STYLE = `
.cal-root .cal-day { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); }
.cal-root .cal-day:first-child { border-top: 0; }
.cal-root .cal-date { flex: 0 0 44px; text-align: center; }
.cal-root .cal-date b { display: block; font-size: 20px; line-height: 1.1; }
.cal-root .cal-date span { color: var(--muted); font-size: var(--fs-sm); text-transform: uppercase; }
.cal-root .cal-items { flex: 1; min-width: 0; }
.cal-root .cal-item { padding: 2px 0 6px; }
.cal-root .cal-item + .cal-item { border-top: 1px dashed var(--line); padding-top: 6px; }
.cal-root .cal-head { display: flex; gap: 8px; justify-content: space-between; align-items: baseline; }
.cal-root .cal-title { font-weight: 600; overflow-wrap: anywhere; }
.cal-root .cal-amt { white-space: nowrap; font-variant-numeric: tabular-nums; }
.cal-root .cal-sub { color: var(--muted); font-size: var(--fs-sm); }
.cal-root .cal-item a, .cal-root .cal-item button { min-height: 44px; }
.cal-root .cal-link { display: inline-flex; align-items: center; min-height: 44px; font-size: var(--fs-sm); }
.cal-root .cal-today { color: var(--accent); }
.cal-root .rec-foot { flex-wrap: wrap; gap: 8px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta?.currency;
  const today = fmt.today();
  const all = compute(plan, { today, range });
  if (only && !all.counts[only]) only = null;
  const d = only ? compute(plan, { today, range, kinds: [only] }) : all;
  const root = ui.h("div", { class: "cal-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const rerender = () => { page.replaceChildren(); render(page, ctx); };
  const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmt.money(Math.abs(v), cur, "en-US", 2)}`;

  // how far ahead, and which kinds
  const rangeChips = ui.h("div", { class: "chips", role: "group", "aria-label": "How far ahead" }, [["month", "Next month"], ["quarter", "3 months"], ["year", "A year"]].map(([k, label]) =>
    ui.h("button", { type: "button", class: `chip${range === k ? " on" : ""}`, "aria-pressed": range === k ? "true" : "false", onclick: () => { range = k; rerender(); } }, label)));
  const kinds = Object.entries(KINDS).filter(([k]) => all.counts[k]);
  const kindChips = kinds.length > 1 ? ui.h("div", { class: "chips", role: "group", "aria-label": "Which dates" },
    ui.h("button", { type: "button", class: `chip${!only ? " on" : ""}`, "aria-pressed": !only ? "true" : "false", onclick: () => { only = null; rerender(); } }, `All (${all.events.length})`),
    ...kinds.map(([k, x]) => ui.h("button", { type: "button", class: `chip${only === k ? " on" : ""}`, "aria-pressed": only === k ? "true" : "false", onclick: () => { only = only === k ? null : k; rerender(); } }, `${x.label} (${all.counts[k]})`))) : null;
  root.append(ui.h("section", { class: "card" }, ui.h("p", { class: "muted small" }, "Bills and paydays come from your bank lines that repeat. Tax, Medicare and insurance dates come from the rest of your plan."), rangeChips, kindChips));

  for (const n of all.notes) root.append(ui.notice("warn", n));

  // the list, by month
  if (!d.events.length) {
    root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Nothing dated in this stretch"),
      ui.h("p", { class: "muted" }, "Import your bank files to see your bills and paydays, add your insurance renewals on Policies, or add a reminder of your own below.")));
  }
  for (const m of d.months) {
    const card = ui.card(new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    const days = new Map();
    for (const e of m.events) { if (!days.has(e.date)) days.set(e.date, []); days.get(e.date).push(e); }
    for (const [date, list] of days) {
      const dt = new Date(`${date}T00:00:00`);
      card.append(ui.h("div", { class: "cal-day" },
        ui.h("div", { class: `cal-date${date === today ? " cal-today" : ""}` }, ui.h("b", {}, String(dt.getDate())), ui.h("span", {}, date === today ? "today" : dt.toLocaleDateString("en-US", { weekday: "short" }))),
        ui.h("div", { class: "cal-items" }, list.map((e) => ui.h("div", { class: "cal-item" },
          ui.h("div", { class: "cal-head" }, ui.h("span", { class: "cal-title" }, `${KINDS[e.kind].icon} ${e.title}`), e.amount !== null ? ui.h("span", { class: "cal-amt" }, signed(e.amount)) : null),
          e.detail ? ui.h("div", { class: "cal-sub" }, e.detail) : null,
          e.go && e.kind !== "pay" && e.kind !== "bill" ? ui.h("a", { class: "cal-link", href: `#/${e.go.join("/")}` }, "Open ›") : null)))));
    }
    root.append(card);
  }
  if (d.events.length) root.append(ui.row(ui.button("Save to your phone's calendar", () => {
    const blob = new Blob([toIcs(d.events, { stamp: `${today.replace(/-/g, "")}T000000Z` })], { type: "text/calendar" });
    const a = ui.h("a", { href: URL.createObjectURL(blob), download: `money-calendar-${today}.ics` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, { class: "secondary" })), ui.h("p", { class: "muted small" }, "Saves the dates shown above as a file your phone's calendar can open. It does not update itself: save it again after you change your plan."));

  // your reminders
  const mine = (plan.reminders ?? []).filter((r) => r?.id);
  const rem = ui.card("Your reminders", ui.h("p", { class: "muted small" }, "Anything else with a date: open enrollment at work, property tax, the car registration, checking your credit report."));
  if (mine.length) rem.append(ui.h("ul", { class: "records" }, mine.map((r) => r.id === editing ? ui.h("li", {}, reminderForm(r)) : ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name), ui.h("span", { class: "rec-value" }, r.amount !== null && r.amount !== undefined ? fmt.money(r.amount, cur) : "")),
    ui.h("div", { class: "rec-sub" }, `${REPEATS[r.repeat] ?? REPEATS.none}, ${nextOf(r) ? `${r.repeat === "none" ? "on" : "next on"} ${fmt.date(nextOf(r))}` : r.date ? `was on ${fmt.date(r.date)}` : "no date"}${r.note ? ` · ${r.note}` : ""}`),
    ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" },
      ui.button("Change", () => { editing = r.id; adding = false; rerender(); }, { class: "secondary small" }),
      ui.button("Remove", () => {
        if (!ui.confirm(`Remove the reminder "${r.name}"?`)) return;
        pending = `Removed "${r.name}".`;
        store.update((q) => { removeReminder(q, r.id); });
      }, { class: "secondary small" })))))));
  if (adding || !mine.length) { if (mine.length) rem.append(ui.h("h3", {}, "Add a reminder")); rem.append(reminderForm(null)); }
  else if (!editing) rem.append(ui.row(ui.button("+ Add another reminder", () => { adding = true; rerender(); }, { class: "secondary" })));
  root.append(rem);

  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where the dates come from"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", {}, "Federal tax dates move to the next working day when they fall on a weekend or a holiday. State tax dates are not here: most follow the federal ones, but check your state."),
    ui.h("p", {}, "Required withdrawals from 401(k)s and traditional IRAs: the first is due by April 1 of the year after you reach the starting age, then by December 31 every year."),
    ui.h("p", {}, "Marketplace open enrollment is shown only for years the app has checked, and only if you buy your own health insurance.")));

  function nextOf(r) {
    if (!r.date) return null;
    if (r.repeat === "none") return r.date >= today ? r.date : null;
    return periodDates(r.date, r.repeat === "monthly" ? "monthly" : "annual", today, `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`)[0] ?? null;
  }

  function reminderForm(r) {
    const form = ui.form([
      { key: "name", label: "What", required: true, placeholder: "For example: open enrollment at work" },
      { key: "date", label: "Day", type: "date", required: true },
      { key: "repeat", label: "Repeats", type: "select", options: Object.entries(REPEATS).map(([value, label]) => ({ value, label })) },
      { key: "amount", label: "Amount (optional)", type: "money" },
      { key: "note", label: "Note (optional)" },
    ], r ?? { date: today, repeat: "yearly" }, (v) => {
      pending = r ? `Saved "${String(v.name).trim()}".` : `Added "${String(v.name).trim()}".`;
      editing = null; adding = false;
      store.update((q) => { saveReminder(q, { ...v, id: r?.id ?? ui.uid() }); });
    }, { submitLabel: r ? "Save" : "Add it", onCancel: r || mine.length ? () => { editing = null; adding = false; rerender(); } : null });
    return form;
  }
}
