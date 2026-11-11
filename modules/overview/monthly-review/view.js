// modules/overview/monthly-review/view.js -- DOM only. The month's review: which month, nine steps
// checked against the plan (each opens its page), then "mark reviewed" with a note, and the months
// reviewed before. The note and the date are the only thing this page writes (plan.reviews).
import { compute, markReviewed, unmarkReviewed, monthLabel } from "./compute.js";
import { markQuiet, shortDate } from "../../transactions/ledger/compute.js";

let month = null;      // the month picked on this device (null = the default for today)
let arrival = null;    // the route ?month= was last taken from: each new arrival (a step's "Back to the check-in") takes it
let pending = null;    // the confirmation shown on the next render

const STYLE = `
.mr-root .mr-steps { list-style: none; margin: 0; padding: 0; }
.mr-root .mr-step > a { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; min-height: 44px; }
.mr-root .mr-step:last-child > a { border-bottom: 0; }
.mr-root .mr-num { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: var(--fs-sm); font-weight: 700; background: var(--panel-2); color: var(--muted); border: 1px solid var(--line-2); }
.mr-root .done .mr-num { background: var(--ok-soft); color: var(--ok); border-color: var(--ok); }
.mr-root .todo .mr-num { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.mr-root .skip .mr-t, .mr-root .skip .mr-d { color: var(--muted); }
.mr-root .look-todo .mr-num { background: var(--warn-soft); color: var(--warn); border-color: var(--warn); }
.mr-root .mr-body { flex: 1; min-width: 0; }
.mr-root .mr-t { font-weight: 650; }
.mr-root .mr-d { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.mr-root .mr-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; align-self: center; }
.mr-root .mr-quiet { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 0 12px 42px; border-bottom: 1px solid var(--line); }
.mr-root .mr-step:has(.mr-quiet) > a { border-bottom: 0; }
.mr-root .mr-quiet .btn, .mr-root .mr-quiet button { min-height: 44px; }
.mr-root .mr-quiet:not(:last-child) { border-bottom: 0; padding-bottom: 8px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const qm = /^\d{4}-\d{2}$/.test(ctx.route?.query?.month ?? "") ? ctx.route.query.month : null;
  if (qm && ctx.route !== arrival) month = qm;
  arrival = ctx.route;
  const d = compute(plan, { today, month });
  const long = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const root = ui.h("div", { class: "mr-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const left = d.todo - d.done;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // what is counted is said (stress test 2026-11-11, MR-3 and OV-3): the things to do (the chores) and the things worth a look
  // (amber look steps); the bar counts both, so it is never full while a look step is amber
  const things = (n) => (n === 1 ? "One thing" : `${n} things`);
  const looks = d.lookLeft ? ` Then ${d.lookLeft === 1 ? "one thing is" : `${d.lookLeft} things are`} worth a look.` : "";
  const heroLine = left > 0 ? `${things(left)} left to do${d.firstTodo ? `: ${d.firstTodo.title.charAt(0).toLowerCase()}${d.firstTodo.title.slice(1)}` : ""}.${looks} About ten minutes, once a month; it keeps every page in the app up to date.`
    : d.lookLeft ? `Everything to do is done.${looks}${d.ended ? " Then finish the check-in below." : ""}`
    : d.ended ? "Everything is done. Finish the check-in below." : `Everything so far is done. ${d.label} is still going: finish it in early ${d.finishIn}.`;
  const hrefOf = (s) => `#/${s.go[0]}/${s.go[1]}?${new URLSearchParams({ ...(s.query ?? {}), from: "review", review: d.month })}`;
  const barDone = d.done + (d.lookTotal - d.lookLeft), barAll = d.todo + d.lookTotal;
  const firstStep = d.firstTodo ? d.steps.find((s) => s.id === d.firstTodo.id) : null;
  // reviewed: the month summed up in a line, and when the next check-in is; the steps fold away below
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.reviewed ? `${d.label} is done ✓` : `The ${d.label} check-in`),
    d.reviewed ? ui.h("p", { class: "lede" }, d.summary.length ? `${cap(d.summary.join(" · "))}.` : `Checked in on ${long(d.reviewed.at)}.`) : null,
    ui.h("p", { class: d.reviewed ? "muted small" : "lede" }, d.reviewed ? `${d.summary.length ? `Checked in on ${long(d.reviewed.at)}. ` : ""}${d.streak > 1 ? `${d.streak} months in a row. ` : ""}Next check-in: early ${d.nextCheck.when}, for ${monthLabel(d.nextCheck.month)}.` : heroLine),
    barAll && !d.reviewed ? ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round((barDone / barAll) * 100)}%` } })) : null,
    // the month still running has nothing to finish yet: its one filled button is the first thing left to do (OV-3)
    !d.reviewed && !d.ended && firstStep ? ui.h("a", { class: "btn", href: hrefOf(firstStep), style: { marginTop: "12px" } }, `Next: ${d.firstTodo.title} \u203a`) : null,
    ui.h("div", { class: "chips", role: "group", "aria-label": "Month", style: { marginTop: "10px", marginBottom: "0" } }, d.choices.map((ym) => ui.h("button", { type: "button", class: `chip${ym === d.month ? " on" : ""}`, "aria-pressed": ym === d.month ? "true" : "false", onClick: () => { month = ym; store.update(() => {}); } }, monthLabel(ym))))));
  // just finished: the page is much shorter, so it starts from the top with "October 2026 is done ✓" and the notice in view
  // (MR-8, OV-3: the redraw kept the old scroll position and cut the heading under the top bar; a page that scrolls itself wins)
  const finished = pending?.[2] === "finished";
  // finishing is undone from its own notice, and a finished month can be opened again from its card (attack2, 2026-11-11)
  const reopen = (m, words) => { try { pending = ["ok", words]; month = m; store.update((draft) => unmarkReviewed(draft, m)); } catch (e) { pending = ["error", `Could not save: ${e.message}. Try again; if it keeps failing, check the connection in Settings.`]; store.update(() => {}); } };
  if (pending) {
    const n = ui.notice(pending[0], pending[1]);
    if (finished && pending[3]) { const m = pending[3]; n.append(" ", ui.button("Undo", () => reopen(m, `Undone: ${monthLabel(m)} is open again.`), { class: "secondary small" })); }
    root.append(n); pending = null;
  }
  if (finished) { try { window.scrollTo(0, 0); } catch { /* a nicety */ } }
  // each step's page shows "‹ Back to the October check-in" (guide/frame.js, from=review), and Budget and Where the money
  // went open on the month under review
  // days a gap names that had nothing on them (a quiet card, a new account): one tap marks them checked, so the step can be
  // finished without a file that does not exist (ledger markQuiet: an import entry with no lines; Import > Past imports undoes it)
  const quietRow = (s) => (s.status !== "todo" || !(s.quiet ?? []).length ? null : ui.h("div", { class: "mr-quiet" },
    ...s.quiet.map((q) => ui.button(`${q.name}: nothing happened ${q.from === q.to ? `on ${shortDate(q.from)}` : `${shortDate(q.from)} to ${shortDate(q.to)}`}`, () => {
      try { store.update((draft) => markQuiet(draft, { ...q, at: new Date().toISOString(), id: `quiet-${Date.now().toString(36)}` })); pending = ["ok", `${q.name}: ${q.from === q.to ? shortDate(q.from) : `${shortDate(q.from)} to ${shortDate(q.to)}`} marked as checked, nothing on ${q.from === q.to ? "that day" : "those days"}. Undo it on Import, under Past imports.`]; }
      catch (e) { pending = ["error", `Could not save: ${e.message}. Try again; if it keeps failing, check the connection in Settings.`]; store.update(() => {}); }
    }, { class: "secondary small" }))));
  // a files step that names more than one fix (the Visa's file and Chase's missing days): one way to each, the step itself
  // opening the first (re-check 2026-11-02)
  const linkHref = (l) => `#/${l.go[0]}/${l.go[1]}${(l.rest ?? []).map((x) => `/${encodeURIComponent(x)}`).join("")}?${new URLSearchParams({ ...(l.query ?? {}), from: "review", review: d.month })}`;
  const linksRow = (s) => (s.status !== "todo" || !(s.links ?? []).length ? null : ui.h("div", { class: "mr-quiet" }, ...s.links.map((l) => ui.h("a", { class: "btn secondary small", href: linkHref(l) }, l.label))));
  const list = ui.h("ol", { class: "mr-steps" }, d.steps.map((s, i) => ui.h("li", { class: `mr-step ${s.status}${s.state === "todo" ? " look-todo" : ""}` }, ui.h("a", { href: hrefOf(s) },
    ui.h("span", { class: "mr-num", "aria-hidden": "true" }, s.status === "done" ? "✓" : String(i + 1)),
    ui.h("span", { class: "mr-body" }, ui.h("div", { class: "mr-t" }, s.title, s.status === "skip" && !/^Waits/.test(s.detail) ? ui.h("span", { class: "pill" }, "optional") : null), ui.h("div", { class: "mr-d" }, s.detail)),
    ui.h("span", { class: "mr-chev", "aria-hidden": "true" }, "›")), linksRow(s), quietRow(s))));
  root.append(d.reviewed
    ? ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, `Everything in this check-in (${d.steps.length})`), list)
    : ui.h("section", { class: "card" }, ui.h("h2", {}, "The steps"), list));
  const note = ui.h("textarea", { rows: 3, placeholder: "What happened this month, what to change next month (optional)", "aria-label": "Note" }, d.reviewed?.note ?? "");
  // the month still running: its steps can be done now, the marking waits until it is over
  if (!d.reviewed && !d.ended) root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, `${d.label} is still going`),
    ui.h("p", {}, `Any step can be done now. Finish it in early ${d.finishIn}, once the whole month's bank files are in; the Dashboard reminds you.`),
    d.choices[1] && d.choices[1] !== d.month ? ui.row(ui.button((plan.reviews ?? []).some((r) => r.month === d.choices[1]) ? `Open ${monthLabel(d.choices[1])}` : `Do the ${monthLabel(d.choices[1])} check-in instead`, () => { month = d.choices[1]; store.update(() => {}); }, { class: "secondary" })) : null));
  else root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, d.reviewed ? `${d.label}: checked in` : `Done with ${d.label}?`),
    ui.field("A note for the month", note),
    ui.row(ui.button(d.reviewed ? "Save the note" : `Finish the ${d.label} check-in`, () => {
      try { pending = d.reviewed ? ["ok", "Note saved."] : ["ok", `${d.label} check-in finished.`, "finished", d.month]; month = d.month; store.update((draft) => markReviewed(draft, d.month, today, note.value)); }
      catch (e) { pending = ["error", `Could not save: ${e.message}. Try again; if it keeps failing, check the connection in Settings.`]; store.update(() => {}); }
    }, { class: d.reviewed ? "secondary" : null }),
    d.reviewed ? ui.button("Open this month again", () => reopen(d.month, `${d.label} is open again. Finish it when you are ready.`), { class: "secondary" }) : null)));
  if (d.history.length) root.append(ui.card("Months checked in",
    ui.h("ul", { class: "records" }, d.history.map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, monthLabel(r.month)), ui.h("span", { class: "rec-value" }, long(r.at))), r.note ? ui.h("div", { class: "rec-sub" }, r.note) : null)))));
}
