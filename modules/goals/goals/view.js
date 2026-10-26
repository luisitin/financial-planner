// modules/goals/goals/view.js -- DOM only. Totals, a tappable list of goals with progress
// bars, one form to add or edit.
import { compute, PRIORITIES, GOAL_ICONS } from "./compute.js";

const FIELDS = (accounts) => [
  { key: "name", label: "What are you saving for", type: "text", required: true, placeholder: "e.g. Emergency fund" },
  { key: "icon", label: "Icon", type: "select", options: GOAL_ICONS },
  { key: "target", label: "Amount needed", type: "money", required: true, min: 0, help: "in today's dollars" },
  { key: "targetDate", label: "By when", type: "date", help: "blank if there is no deadline" },
  { key: "priority", label: "How important", type: "select", options: Object.entries(PRIORITIES).map(([value, label]) => ({ value, label })) },
  { key: "saved", label: "Already set aside", type: "money", min: 0, help: "cash you have earmarked, if it is not in an account below" },
  { key: "accountId", label: "Account it is saved in", type: "select", options: [{ value: "", label: "None / not tracked" }, ...accounts.map((x) => ({ value: x.id, label: x.name }))], help: "that account's balance counts toward the goal" },
  { key: "monthly", label: "Putting in each month", type: "money", min: 0, help: "what you add now; the page tells you if it is enough" },
  { key: "rate", label: "Growth per year", type: "percent", min: 0, max: 50, help: "leave blank to use the plan's assumption for the time left" },
  { key: "inflates", label: "Grow the amount with inflation until then", type: "checkbox" },
];

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const accounts = plan.accounts ?? [];
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  // A goal whose account is gone: the warning names the goal as a tap that opens its form.
  const broken = new Set((plan.goals ?? []).filter((g) => (g.fundedBy ?? []).some((id) => !accounts.some((a) => a.id === id))).map((g) => g.id));
  const openGoal = (id) => { editing = plan.goals.find((y) => y.id === id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); };

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What are you saving for?"),
      ui.h("p", { class: "lede" }, "A goal is an amount by a date: an emergency fund, a house down payment, a car, a trip, college. The plan tells you what to put aside each month to get there and whether you are on track."),
      ui.h("p", { class: "muted small" }, "A good first goal is an emergency fund: three to six months of the bills you must pay."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Goals", String(d.count), d.done ? `${d.done} reached` : "none reached yet"),
      ui.stat("Saved so far", fmt.money(d.totalFunded, cur), `of ${fmt.money(d.totalTarget, cur)} in total`),
      ui.stat("Needed each month", fmt.money(d.neededMonthly, cur), d.contributing ? `you are putting in ${fmt.money(d.contributing, cur)}` : "to reach every dated goal on time"),
    )));
  }
  for (const w of d.warnings) {
    const g = w.includes("no longer exists") ? (plan.goals ?? []).find((x) => broken.has(x.id) && w.startsWith(x.name)) : null;
    if (g) root.append(ui.h("div", { class: "notice warn" }, ui.h("a", { href: "#goal", onClick: (e) => { e.preventDefault(); openGoal(g.id); } }, g.name), w.slice(g.name.length), " Tap it to pick another."));
    else root.append(ui.notice("warn", w));
  }

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another goal", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, accountId: editing.fundedBy?.[0] ?? "", inflates: editing.inflates !== false, priority: String(editing.priority ?? 2) } : { icon: "🎯", priority: "2", inflates: true, accountId: "" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add a goal"),
      ui.form(FIELDS(accounts), values, (v) => {
        const clean = { name: v.name.trim(), icon: v.icon || "🎯", target: v.target ?? 0, targetDate: v.targetDate || "", priority: Number(v.priority) || 2, saved: v.saved ?? 0, fundedBy: v.accountId ? [v.accountId] : [], monthly: v.monthly ?? 0, rate: v.rate ?? null, inflates: !!v.inflates };
        if (!clean.name) return;
        pending = editing ? "Changes saved." : `${clean.name} added.`;
        store.update((p) => {
          p.goals = p.goals ?? [];
          if (editing) { const i = p.goals.findIndex((x) => x.id === editing.id); if (i >= 0) p.goals[i] = { ...p.goals[i], ...clean }; }
          else p.goals.push({ id: ui.uid(), ...clean });
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add goal", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove the goal ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.goals = (p.goals ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  if (d.count > 0) {
    const pill = (g) => ({ done: ["ok", "reached"], "on track": ["ok", "on track"], behind: ["warn", "behind"], "past due": ["warn", "date passed"], "no date": ["", "no date"], "no amount": ["warn", "no amount"] })[g.status] ?? ["", g.status];
    const sub = (g) => {
      const bits = [`${fmt.money(g.funded, cur)} of ${fmt.money(g.targetThen, cur)}`];
      if (g.targetDate) bits.push(`by ${fmt.date(g.targetDate)}`);
      if (g.status === "behind" || g.status === "on track") bits.push(`needs ${fmt.money(g.neededMonthly, cur)} a month${g.status === "behind" && g.monthly > 0 ? `; you put in ${fmt.money(g.monthly, cur)}` : ""}`);
      if (g.fundedFrom.length) bits.push(`in ${g.fundedFrom.join(", ")}${g.sharedWith.length ? ` (shared with ${g.sharedWith.join(", ")})` : ""}`);
      return bits.join(" · ");
    };
    const order = { "past due": 0, behind: 1, "on track": 2, "no date": 3, "no amount": 4, done: 5 };
    const rows = [...d.goals].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || order[a.status] - order[b.status]);
    root.append(ui.card("Your goals",
      ui.h("ul", { class: "page-list" }, rows.map((g) => { const [k, t] = pill(g); return ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => openGoal(g.id),
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, g.icon || "🎯"),
        ui.h("span", { class: "body" },
          ui.h("div", { class: "t" }, g.name, " ", ui.h("span", { class: `pill ${k}` }, t), g.priority === 1 ? ui.h("span", { class: "pill" }, "must have") : null, broken.has(g.id) ? ui.h("span", { class: "pill warn" }, "check account") : null),
          ui.h("div", { class: "d" }, sub(g)),
          ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(g.progress * 100)}%` } }))),
        ui.h("span", { class: "st muted" }, "Edit ›"),
      ); })),
      ui.h("p", { class: "muted small" }, "Tap a goal to change it. \"Needs\" is what to put in each month from now on, assuming the money grows at the plan's rate for that time frame."),
      out, formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
}
