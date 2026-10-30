// modules/overview/monthly-review/view.js -- DOM only. The month's review: which month, nine steps
// checked against the plan (each opens its page), then "mark reviewed" with a note, and the months
// reviewed before. The note and the date are the only thing this page writes (plan.reviews).
import { compute, markReviewed, monthLabel } from "./compute.js";

let month = null;      // the month picked on this device (null = the default for today)
let pending = null;    // the confirmation shown on the next render

const STYLE = `
.mr-root .mr-steps { list-style: none; margin: 0; padding: 0; }
.mr-root .mr-step > a { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; min-height: 44px; }
.mr-root .mr-step:last-child > a { border-bottom: 0; }
.mr-root .mr-num { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: var(--fs-sm); font-weight: 700; background: var(--panel-2); color: var(--muted); border: 1px solid var(--line-2); }
.mr-root .done .mr-num { background: var(--ok-soft); color: var(--ok); border-color: var(--ok); }
.mr-root .todo .mr-num { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.mr-root .skip .mr-t, .mr-root .skip .mr-d { color: var(--muted); }
.mr-root .mr-body { flex: 1; min-width: 0; }
.mr-root .mr-t { font-weight: 650; }
.mr-root .mr-d { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.mr-root .mr-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; align-self: center; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today, month });
  const long = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const root = ui.h("div", { class: "mr-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const left = d.todo - d.done;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${d.label} review`),
    ui.h("p", { class: "lede" }, d.reviewed ? `Reviewed on ${long(d.reviewed.at)}.${d.streak > 1 ? ` ${d.streak} months in a row.` : ""}` : left > 0 ? `${d.done} of ${d.todo} steps done: ${left} to go. Ten minutes, once a month, keeps every page in the app true.` : "Every step is done. Mark the month reviewed below."),
    d.todo ? ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round((d.done / d.todo) * 100)}%` } })) : null,
    ui.h("div", { class: "chips", role: "group", "aria-label": "Month", style: { marginTop: "10px", marginBottom: "0" } }, d.choices.map((ym) => ui.h("button", { type: "button", class: `chip${ym === d.month ? " on" : ""}`, "aria-pressed": ym === d.month ? "true" : "false", onClick: () => { month = ym; store.update(() => {}); } }, monthLabel(ym))))));
  if (pending) { root.append(ui.notice(...pending)); pending = null; }
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The steps"),
    ui.h("ol", { class: "mr-steps" }, d.steps.map((s, i) => ui.h("li", { class: `mr-step ${s.status}` }, ui.h("a", { href: `#/${s.go[0]}/${s.go[1]}` },
      ui.h("span", { class: "mr-num", "aria-hidden": "true" }, s.status === "done" ? "✓" : String(i + 1)),
      ui.h("span", { class: "mr-body" }, ui.h("div", { class: "mr-t" }, s.title, s.status === "skip" ? ui.h("span", { class: "pill" }, "optional") : null), ui.h("div", { class: "mr-d" }, s.detail)),
      ui.h("span", { class: "mr-chev", "aria-hidden": "true" }, "›")))))));
  const note = ui.h("textarea", { rows: 3, placeholder: "What happened this month, what to change next month (optional)", "aria-label": "Note" }, d.reviewed?.note ?? "");
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, d.reviewed ? `${d.label} is reviewed` : `Done with ${d.label}?`),
    ui.field("A note for the month", note),
    ui.row(ui.button(d.reviewed ? "Save the note" : `Mark ${d.label} reviewed`, () => {
      try { store.update((draft) => markReviewed(draft, d.month, today, note.value)); pending = ["ok", d.reviewed ? "Note saved." : `${d.label} marked reviewed.`]; }
      catch (e) { pending = ["error", `Could not save: ${e.message}. Try again; if it keeps failing, check the connection in Settings.`]; store.update(() => {}); }
    }, { class: d.reviewed ? "secondary" : null }))));
  if (d.history.length) root.append(ui.card("Months reviewed",
    ui.h("ul", { class: "records" }, d.history.map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, monthLabel(r.month)), ui.h("span", { class: "rec-value" }, long(r.at))), r.note ? ui.h("div", { class: "rec-sub" }, r.note) : null)))));
}
