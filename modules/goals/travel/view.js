// modules/goals/travel/view.js -- DOM only. Each trip or big day priced from its parts, what to set aside a
// month to pay for it in cash, and a button that makes it (or keeps it) a goal; one form to add or change
// an event, its fields depending on the kind.
import { compute, KINDS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let kindChoice = "trip";   // the kind picked in the add form

const STYLE = `
.tv-root .tv-parts { list-style: none; margin: 6px 0 0; padding: 0; }
.tv-root .tv-parts li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.tv-root .tv-parts li:last-child { border-bottom: 0; font-weight: 650; }
.tv-root .tv-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

const FIELD = {
  people: { label: "People", type: "number", min: 1, step: "1" },
  nights: { label: "Nights", type: "number", min: 0, step: "1" },
  flightPerPerson: { label: "Flights per person (return)", type: "money", min: 0 },
  lodgingPerNight: { label: "Lodging a night", type: "money", min: 0 },
  foodPerPersonDay: { label: "Food per person a day", type: "money", min: 0 },
  activities: { label: "Activities and tickets", type: "money", min: 0 },
  guests: { label: "Guests", type: "number", min: 0, step: "1" },
  perGuest: { label: "Food and drink per guest", type: "money", min: 0 },
  venue: { label: "Venue", type: "money", min: 0 },
  attire: { label: "Clothes", type: "money", min: 0 },
  photos: { label: "Photos", type: "money", min: 0 },
  rings: { label: "Rings", type: "money", min: 0 },
  other: { label: "Other costs", type: "money", min: 0 },
};

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "tv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.events.length) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Trips and big days"),
    ui.h("p", { class: "lede" }, "A holiday, a wedding, a big birthday: price it from its parts, see what to put aside each month, and pay for it in cash instead of on a card.")));
  else root.append(ui.card(null, ui.row(
    ui.stat("Set aside a month", money(d.neededMonthly), `for ${d.upcoming} coming event${d.upcoming === 1 ? "" : "s"}`),
    d.next ? ui.stat("Next", d.next.name, `${d.next.date}: ${money(d.next.total)}`) : ui.stat("Next", "-", "no dates yet"),
  )));

  for (const e of d.events) {
    const card = ui.card(`${e.icon} ${e.name}`);
    card.append(ui.h("p", { class: "tv-d" }, `${e.kindLabel}${e.date ? `, ${e.date}` : ""}${e.past ? " (past)" : ""}`),
      ui.h("ul", { class: "tv-parts" }, ...e.parts.map((x) => ui.h("li", {}, ui.h("span", {}, x.label), ui.h("span", {}, money(x.amount)))), ui.h("li", {}, ui.h("span", {}, "In all"), ui.h("span", {}, money(e.total)))));
    if (!e.past) card.append(ui.h("p", { class: "tv-d", style: { marginTop: "8px" } }, e.neededMonthly !== null ? `${money(e.saved)} set aside${e.goal ? ` ("${e.goal.name}")` : ""}: put aside ${money(e.neededMonthly)} a month to pay for it in cash${e.goal ? `; the goal has ${money(e.goal.monthly)} a month now` : ""}.` : "Add a date to see what to put aside each month."));
    card.append(ui.row(
      !e.past ? ui.button(e.goal ? "Update its goal" : "Make it a goal", () => {
        pending = e.goal ? "Goal updated." : "Goal added on the Goals page.";
        store.update((p) => {
          p.goals = p.goals ?? [];
          const ev = (p.events ?? []).find((y) => y.id === e.id);
          const g = e.goal ? p.goals.find((y) => y.id === e.goal.id) : null;
          const fields = { name: e.name, icon: e.icon, target: Math.round(e.total), targetDate: e.date || "", monthly: Math.round(e.neededMonthly ?? 0) };
          if (g) Object.assign(g, fields);
          else { const id = ui.uid(); p.goals.push({ id, ...fields, priority: 3, saved: Math.round(e.saved), fundedBy: [], rate: null, inflates: false }); if (ev) ev.goalId = id; }
        });
      }, { class: "secondary" }) : null,
      ui.button("Change", () => { editing = (plan.events ?? []).find((y) => y.id === e.id); kindChoice = editing.kind; drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary" })));
    root.append(card);
  }

  const formHost = ui.h("div");
  const drawForm = (open = !d.events.length) => {
    formHost.innerHTML = "";
    if (!open && !editing) { formHost.append(ui.button("+ Plan another", () => drawForm(true), { class: "secondary" })); return; }
    const kind = editing ? editing.kind : kindChoice;
    const picker = ui.h("div", { class: "chips", role: "group", "aria-label": "Kind of event" }, Object.entries(KINDS).map(([k, x]) => ui.h("button", { type: "button", class: `chip${k === kind ? " on" : ""}`, "aria-pressed": k === kind ? "true" : "false", onClick: () => { kindChoice = k; if (editing) editing = { ...editing, kind: k }; drawForm(true); } }, `${x.icon} ${x.label.split(" (")[0]}`)));
    const fields = [{ key: "name", label: "What", type: "text", required: true, placeholder: kind === "trip" ? "e.g. Japan in spring" : kind === "wedding" ? "e.g. Our wedding" : "e.g. Mum's 70th" }, { key: "date", label: "When", type: "date" }, ...KINDS[kind].fields.map((k) => ({ key: k, ...FIELD[k], label: kind === "other" && k === "other" ? "Budget" : FIELD[k].label }))];
    const values = editing ? { ...editing } : { people: 2, nights: 7 };
    formHost.append(ui.h("h2", {}, editing ? `Change ${editing.name}` : "Plan a trip or a big day"), picker, ui.form(fields, values, (v) => {
      const clean = { name: v.name.trim(), kind, date: v.date || "", ...Object.fromEntries(KINDS[kind].fields.map((k) => [k, v[k] ?? null])) };
      if (!clean.name) return;
      pending = editing ? "Changes saved." : `${clean.name} added.`;
      const id = editing?.id;
      store.update((p) => {
        p.events = p.events ?? [];
        if (id) { const i = p.events.findIndex((y) => y.id === id); if (i >= 0) p.events[i] = { ...p.events[i], ...clean }; }
        else p.events.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add", resetAfter: !editing, onCancel: (editing || d.events.length) ? () => { editing = null; drawForm(false); } : null }),
    editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
      if (!ui.confirm(`Remove ${editing.name}? Its goal on Goals stays.`)) return;
      const id = editing.id, name = editing.name; editing = null;
      pending = `${name} removed.`;
      store.update((p) => { p.events = (p.events ?? []).filter((y) => y.id !== id); });
    }, { class: "danger" })) : null);
  };
  drawForm();
  root.append(ui.card(null, out, formHost));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals"), ui.h("a", { class: "btn secondary", href: "#/cashflow/sinking-funds" }, "Sinking funds"))));
}
