// modules/household/life-events/view.js -- DOM only. Pick a life event and its day; the page lists what to do, in
// order, with the deadlines that follow from that day. Steps are ticked here; the plan changes a step offers (add a
// partner or child, filing status, state, pay, an inherited account) open a small form and change the plan only when
// the person taps the button.
import { compute, startEvent, setEventDate, removeEvent, setStep, applyChange } from "./compute.js";
import { EVENTS } from "./data/events.js";

let pending = null;    // { kind, text } shown on the next render
let starting = null;   // the kind whose start form is open
let open = null;       // "eventId:change" of the change form that is open
let shown = null;      // the event that is unfolded (null = the newest)

const STYLE = `
.le-root .le-kinds { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.le-root .le-kind { min-height: 56px; display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line-2); background: var(--panel); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
.le-root .le-kind.on { border-color: var(--accent); }
.le-root .le-kind span { font-size: 22px; }
.le-root .le-step { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid var(--line); }
.le-root .le-step:first-child { border-top: 0; }
.le-root .le-step input[type="checkbox"] { width: 24px; height: 24px; margin: 10px; flex: 0 0 auto; }
.le-root .le-step label { display: flex; align-items: flex-start; min-height: 44px; cursor: pointer; }
.le-root .le-body { flex: 1; min-width: 0; padding-top: 10px; }
.le-root .le-done .le-text { color: var(--muted); text-decoration: line-through; }
.le-root .le-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px; }
.le-root .le-meta a { display: inline-flex; align-items: center; min-height: 44px; font-size: var(--fs-sm); }
.le-root .le-form { margin-top: 8px; }
.le-root .le-urgent li { padding: 8px 0; border-top: 1px solid var(--line); }
.le-root .le-urgent li:first-child { border-top: 0; }
.le-root .le-urgent { list-style: none; padding: 0; margin: 0; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "le-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice(pending.kind, pending.text); root.append(n); if (pending.kind === "ok") setTimeout(() => n.remove(), 5000); pending = null; }
  const rerender = () => { page.replaceChildren(); render(page, ctx); };
  const when = (s) => (s.daysLeft === null ? "" : s.daysLeft < 0 ? `was due ${fmt.date(s.deadline)}` : s.daysLeft === 0 ? "due today" : `by ${fmt.date(s.deadline)} (${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"})`);

  // pick an event
  const picker = ui.h("div", { class: "le-kinds" }, d.kinds.map((k) => ui.h("button", { type: "button", class: `le-kind${starting === k.kind ? " on" : ""}`, "aria-pressed": starting === k.kind ? "true" : "false", onclick: () => { starting = starting === k.kind ? null : k.kind; rerender(); } }, ui.h("span", {}, k.icon), k.label)));
  const startBox = ui.h("div", {});
  if (starting) {
    const kind = starting, def = EVENTS[kind];
    const form = ui.form([{ key: "date", label: def.dateLabel, type: "date", required: true, help: "a past day or one coming up; the deadlines count from it" }], { date: today }, (v) => {
      const id = ui.uid();
      pending = { kind: "ok", text: `${def.label}: your steps are below.` };
      starting = null; shown = id;
      store.update((q) => { startEvent(q, { id, kind, date: v.date }, today); });
    }, { submitLabel: "Show my steps", onCancel: () => { starting = null; rerender(); } });
    startBox.append(ui.h("p", { class: "muted" }, def.intro), form);
  }
  if (!d.events.length) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Big changes, step by step"),
    ui.h("p", { class: "lede" }, "Getting married, a baby, a new job, a move, an inheritance or a divorce: pick what is happening and its day. You get the steps in order, with the deadlines that matter, and the changes to your plan are made only when you tap them."),
    picker, startBox));

  // deadlines coming up across events
  if (d.urgent.length) root.append(ui.card("Coming up", ui.h("ul", { class: "le-urgent" }, d.urgent.map((u) => ui.h("li", {},
    ui.h("div", {}, `${u.event.icon} ${u.step.text}`), ui.h("div", { class: "le-meta" }, ui.h("span", { class: `pill ${u.step.state === "late" ? "bad" : "warn"}` }, when(u.step))))))));

  // each event
  const first = shown ?? d.events[0]?.id;
  for (const e of d.events) {
    const det = ui.h("details", { class: "card fold fold-card", open: e.id === first || (open && open.startsWith(`${e.id}:`)) ? true : null },
      ui.h("summary", {}, ui.h("h2", {}, `${e.icon} ${e.label}`), ui.h("span", { class: "fold-status" }, `${e.done} of ${e.total} done`), ui.h("span", { class: "fold-chev" }, "›")));
    det.addEventListener("toggle", () => { if (det.open) shown = e.id; });
    const dateForm = ui.h("input", { type: "date", value: e.date ?? "", "aria-label": e.dateLabel });
    dateForm.addEventListener("change", () => { if (!dateForm.value) return; pending = { kind: "ok", text: `${e.dateLabel} changed to ${fmt.date(dateForm.value)}.` }; shown = e.id; store.update((q) => { setEventDate(q, e.id, dateForm.value); }); });
    det.append(ui.h("p", { class: "muted" }, e.intro), ui.field(e.dateLabel, dateForm),
      ui.h("div", {}, e.steps.map((s) => step(e, s))),
      ui.row(ui.button("Remove this event", () => {
        if (!ui.confirm(`Remove "${e.label}" and its ticks? Changes already made to your plan stay.`)) return;
        pending = { kind: "ok", text: `${e.label} removed. Changes already made to your plan stay.` };
        store.update((q) => { removeEvent(q, e.id); });
      }, { class: "secondary small" })));
    root.append(det);
  }
  if (d.events.length) root.append(ui.card("Something else happening?", picker, startBox));

  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where the deadlines come from"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", {}, "Health cover at work: at least 30 days after a wedding, birth or adoption to add someone. Health insurance you buy yourself: 60 days after a wedding, birth, move or losing job cover. COBRA: at least 60 days to choose; after a divorce, tell the plan within 60 days."),
    ui.h("p", {}, "Taxes: your marital status on December 31 counts for the whole year. An inherited IRA from someone other than a spouse is usually emptied by December 31 of the 10th year after the death."),
    ui.h("p", { class: "muted small" }, "From the U.S. Department of Labor, HealthCare.gov and the IRS. Your plan's own papers can give more time, never less.")));

  function step(e, s) {
    const box = ui.h("input", { type: "checkbox", checked: s.done ? true : null, disabled: s.auto ? true : null, "aria-label": s.text });
    box.addEventListener("change", () => { pending = { kind: "ok", text: box.checked ? "Ticked." : "Unticked." }; shown = e.id; store.update((q) => { setStep(q, e.id, s.key, box.checked, today); }); });
    const key = `${e.id}:${s.change}`;
    return ui.h("div", { class: `le-step${s.done ? " le-done" : ""}` },
      ui.h("label", {}, box),
      ui.h("div", { class: "le-body" },
        ui.h("div", { class: "le-text" }, s.text),
        ui.h("div", { class: "le-meta" },
          s.deadline && !s.done ? ui.h("span", { class: `pill ${s.state === "late" ? "bad" : s.state === "soon" ? "warn" : ""}` }, when(s)) : null,
          s.auto ? ui.h("span", { class: "pill ok" }, "already in your plan") : null,
          s.go ? ui.h("a", { href: `#/${s.go.join("/")}` }, "Open ›") : null,
          s.change && !s.done && open !== key ? ui.button(changeLabel(s.change), () => { open = key; shown = e.id; rerender(); }, { class: "secondary small" }) : null),
        s.change && open === key ? changeForm(e, s) : null));
  }

  function changeLabel(c) {
    return { addPartner: "Add my partner", addChild: "Add the child", fileJointly: "Set: married filing together", fileHeadOfHousehold: "Set: head of household", fileSingle: "Change filing status", setState: "Set the new state", updatePay: "Update pay", addAccount: "Add it" }[c] ?? "Change it";
  }

  function changeForm(e, s) {
    const people = plan.household?.people ?? [];
    const salaries = (plan.income ?? []).filter((x) => x?.type === "salary");
    const fields = {
      addPartner: [{ key: "name", label: "Partner's name", required: true }, { key: "birthDate", label: "Date of birth", type: "date" }],
      addChild: [{ key: "name", label: "Child's name", required: true }, { key: "birthDate", label: "Date of birth", type: "date" }],
      fileJointly: [],
      fileHeadOfHousehold: [],
      fileSingle: [{ key: "status", label: "Filing status", type: "select", options: [{ value: "single", label: "Single" }, { value: "head_of_household", label: "Head of household (a child lives with you)" }] }],
      setState: [{ key: "state", label: "New state", type: "select", options: [{ value: "", label: "Pick a state" }, ...d.states.map((x) => ({ value: x, label: x }))] }],
      updatePay: [
        { key: "incomeId", label: "Which pay", type: "select", options: [...salaries.map((x) => ({ value: x.id, label: x.name || "Pay" })), { value: "", label: "Add it as new pay" }] },
        { key: "amount", label: "New pay", type: "money", required: true },
        { key: "period", label: "How often", type: "select", options: [{ value: "annual", label: "A year" }, { value: "monthly", label: "A month" }, { value: "semimonthly", label: "Twice a month" }, { value: "biweekly", label: "Every two weeks" }, { value: "weekly", label: "A week" }] },
        { key: "startDate", label: "First payday", type: "date" },
        ...(people.filter((p) => p.role !== "dependent").length > 1 ? [{ key: "personId", label: "Whose pay (for new pay)", type: "select", options: people.filter((p) => p.role !== "dependent").map((p) => ({ value: p.id, label: p.name })) }] : []),
      ],
      addAccount: [{ key: "name", label: "What it is", required: true, placeholder: "For example: inherited IRA" }, { key: "type", label: "Kind", type: "select", options: [{ value: "savings", label: "Cash in savings" }, { value: "brokerage", label: "Shares or funds" }, { value: "ira", label: "IRA" }, { value: "roth", label: "Roth IRA" }, { value: "401k", label: "401(k)" }, { value: "property", label: "A house or land" }, { value: "other_asset", label: "Something else" }] }, { key: "balance", label: "What it is worth", type: "money", required: true }],
    }[s.change] ?? [];
    const start = { birthDate: s.change === "addChild" ? e.date : "", startDate: e.date ?? "", period: ["weekly", "biweekly", "semimonthly", "monthly", "annual"].includes(salaries[0]?.period) ? salaries[0].period : "annual", status: "single", incomeId: salaries[0]?.id ?? "", type: "savings", personId: people.find((p) => p.role === "self")?.id ?? "" };
    const form = ui.form(fields, start, (v) => {
      const values = { ...v, id: ui.uid() };
      const check = applyChange(structuredClone(plan), e.id, s.change, values, today);   // a dry run, to refuse a bad entry with its reason
      if (!check.ok) { form.append(ui.notice("error", check.text)); return; }
      pending = { kind: "ok", text: check.text };
      open = null; shown = e.id;
      store.update((q) => { applyChange(q, e.id, s.change, values, today); });
    }, { submitLabel: fields.length ? "Make this change" : changeLabel(s.change), onCancel: () => { open = null; rerender(); } });
    form.classList.add("le-form");
    return form;
  }
}
