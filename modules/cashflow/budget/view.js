// modules/cashflow/budget/view.js -- DOM only. Simple first (docs/OPTIONAL.md): the page opens with what happens to you,
// "About $310 is free to spend until Sunday." when this month's bank lines are in (gap #5), else what your envelopes say;
// then the envelopes (those over first, six, then "N more envelopes"), one form to add or edit an envelope, the
// suggestions, and "How this is worked out" one tap away. Budget your way (gap #37): once there is an envelope, one quiet
// row, "Set my own numbers", holds how you budget (Envelopes unless changed), what overspending does, moving money between
// envelopes and, with every dollar given a job, holding money for next month (never more than is left). An envelope that
// is over stays under the headline whichever way leads. Left alone, the page is what it was.
import { compute, useExpenses, safeToSpend, envelopeWords, wayOf, setWay, jobOf, threeOf, moveProblem, moneyNote, dropOrphanMoves } from "./compute.js";
import { categoriesOf } from "../../transactions/categories/compute.js";
import { bringWords, monthsWords, shortDate, monthLabel } from "../../transactions/ledger/compute.js";
import { parts, rest, choice, links } from "../../../core/ui/more.js";

const state = { month: "", route: null };   // route: the arrival the address's ?month= was last taken from (the Monthly review's link)

let pending = null;   // { text, before (the answer the page said before the save), part? (the part it was saved in: it stays open, R17) }: the confirmation kept across the shell re-render

const WAY_LABELS = { envelopes: "Envelopes", zero: "Every dollar a job", three: "Three numbers" };
const WAY_WORDS = {
  envelopes: "An amount for each kind of spending, and what is left of it.",
  zero: "Every dollar that comes in is given a job: an envelope, saving, or held for next month.",
  three: "Three totals to watch instead of each envelope: must-pay bills, flexible spending and once-a-year costs.",
};

const SPAN_LABELS = { today: "Today", week: "This week", payday: "Until payday" };
/** What an envelope is: in the hero before there is anything to measure; else in the first card that offers one. */
const ENVELOPE_INTRO = "Give each kind of spending an envelope: an amount for the month. The page shows what you have spent so far (from your transactions), what is left, and whether you are on pace.";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const h = ui.h;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const today = fmt.today();
  // opened from the Monthly review with ?month=2026-10: that month, until a month is picked here
  const qm = /^\d{4}-\d{2}$/.test(ctx.route?.query?.month ?? "") ? ctx.route.query.month : null;
  // each arrival (a new route; a redraw after a save keeps the same one) takes the address's month; a month picked here stays
  if (qm && ctx.route !== state.route) state.month = qm;
  state.route = ctx.route;
  const d = compute(plan, { today, month: state.month || undefined });
  // the month's after-tax money (Next best action's spare: the Dashboard's figure), worked out once and only when needed
  let nba;
  const nbaOf = () => (nba === undefined ? (nba = ctx.computeOf?.("overview/next-best-action", { today }) ?? null) : nba);
  // Safe to spend (gap #5): only for today's month, only when this month's bank lines are in
  const s = d.month === today.slice(0, 7) ? safeToSpend(plan, { today, budget: d, spare: () => (nbaOf()?.ready ? nbaOf().spare : null) }) : { drawn: false };
  const env = d.hasBudget && d.hasData ? envelopeWords(d, { today, currency: cur }) : null;
  // Budget your way (gap #37): "Envelopes" unless the person chose another way; then that way's sentence leads
  const way = wayOf(plan);
  const savedInWay = pending?.part === "way";
  const job = way.method === "zero" && d.month === today.slice(0, 7) ? jobOf(d, { spare: () => (nbaOf()?.ready ? nbaOf().spare : null), currency: cur, plan, today }) : null;
  const three = way.method === "three" ? threeOf(plan, { today, month: d.month, budget: d, currency: cur }) : null;
  const lead = job?.drawn ? job.words : three ? three.words : null;
  // an envelope that is over is an alarm: it stays under the headline whichever way leads (R9; critic P3)
  const overLine = lead && env && d.envelopes.some((e) => e.left < -0.005) ? env.more : null;
  // the answer the page says now: what the green line names after a save when it changed (R7)
  const answer = lead ? lead.head : s.drawn ? s.words.headline : env ? env.head : d.hasBudget ? holdWords(d, money) : null;

  // a month with days missing in an account's files is left out of the suggestions, and says why; months that share one gap
  // (a hole across July and August) are said once: "July and August 2026 are left out: ..." (2026-11-02)
  const groups = [];
  // (a payment counted for neither card: its reason with no amount or month, so August to October share one; re-check 5)
  for (const x of [...(d.suggestSkipped ?? [])].sort((a, b) => a.ym.localeCompare(b.ym))) {
    const why = x.issues?.[0]?.brief ?? x.issues?.[0]?.why ?? "some days are missing";
    const g = groups.find((y) => y.why === why);
    if (g) g.yms.push(x.ym); else groups.push({ why, yms: [x.ym] });
  }
  const withYear = (yms) => { const ys = new Set(yms.map((m) => m.slice(0, 4))); return `${monthsWords(yms)}${ys.size === 1 ? ` ${[...ys][0]}` : ""}`; };
  const skippedNote = groups.map((g) => ` ${withYear(g.yms)} ${g.yms.length > 1 ? "are" : "is"} left out: ${g.why}.`).join("");
  let editing = null;
  const redraw = () => { if (ctx.redraw) ctx.redraw(); else { root.innerHTML = ""; render(root, ctx); } };
  const cats = categoriesOf(plan).filter((c) => c.kind === "expense");
  const FIELDS = [
    { key: "category", label: "Category", type: "select", options: cats.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` })) },
    { key: "amount", label: "Amount each month", type: "money", required: true, min: 0 },
    { key: "rollover", label: "Unspent money rolls into next month", type: "checkbox" },
  ];
  const importBtn = (label = "Import a bank file") => h("a", { class: "btn secondary", href: "#/transactions/import" }, label);
  // with Safe to spend as the headline and no envelope yet, what an envelope is moves (never deleted, docs/OPTIONAL.md 3.16
  // step 3) to the first card that offers one: spending with no envelope, the suggestions, Start from your expenses or the form
  let intro = s.drawn && !d.hasBudget;
  const introOnce = () => { if (!intro) return null; intro = false; return h("p", { class: "muted small" }, ENVELOPE_INTRO); };

  // why the suggestions are what they are (no envelopes yet): in the hero, or, when Safe to spend is the headline, in the
  // card it explains (it said "below" from the hero)
  const reason = d.hasBudget ? null
    : d.fromExpenses.length ? (d.hasData ? `Your bank files have no whole month to suggest amounts from yet${skippedNote ? `.${skippedNote}` : d.cover ? `; they cover ${fmt.date(d.cover.from)} to ${fmt.date(d.cover.to)}.` : "."}` : null)
    : !d.hasData ? null
    : d.suggestFrom.length ? `${s.drawn ? "These are" : "Suggestions below are"} the average of your last ${d.suggestFrom.length === 1 ? "whole month" : `${d.suggestFrom.length} whole months`} of real spending.${skippedNote}`
    : `Suggestions need at least one whole month in your bank files; yours cover ${fmt.date(d.cover.from)} to ${fmt.date(d.cover.to)}.${skippedNote || " Most banks let you download 90 days: import that and they appear."}`;

  // ---------------------------------------------------------------- the headline
  const hero = h("section", { class: "card accent hero" });
  if (lead) {
    // the way the person chose leads; Safe to spend, when it is drawn, is the line under it (its alarm stays in amber, R9)
    hero.append(h("h1", {}, lead.head), h("p", { class: "lede" }, lead.more));
    if (three && !three.hasData && three.source) hero.append(ui.row(importBtn()));
    if (overLine) hero.append(ui.notice("warn", overLine));
    if (s.drawn) hero.append(h("p", {}, s.words.headline));
    if (s.drawn && s.kind !== "ok") hero.append(ui.notice("warn", s.words.second));
  } else if (s.drawn) {
    hero.append(h("h1", {}, s.words.headline));
    // at or past zero it is an alarm, never folded (R9): the second sentence in amber
    hero.append(s.kind === "ok" ? h("p", { class: "lede" }, s.words.second) : ui.notice("warn", s.words.second));
  } else if (d.hasBudget && !d.hasData) {
    // envelopes but no bank file yet: nothing is spent "so far", so no pace and no "left" (round 4, 2026-11-02)
    hero.append(h("h1", {}, holdWords(d, money)), h("p", { class: "lede" }, "Spending against them shows once a bank file is in."), ui.row(importBtn()));
  } else if (env) {
    hero.append(h("h1", {}, env.head), h("p", { class: "lede" }, env.more));
  } else {
    hero.append(h("h1", {}, "Budget"),
      h("p", { class: "lede" }, ENVELOPE_INTRO),
      // with bank files in but no whole month in them, say why none is suggested from, not "once a bank file is in" (re-check 5)
      d.fromExpenses.length ? h("p", { class: "muted small" }, reason ? `Start from the amounts on your Expenses page below. ${reason}` : "Start from the amounts on your Expenses page below. Spending against each envelope shows once a bank file is in.")
        // the way on is a button, not a sentence (CF-1)
        : !d.hasData ? h("p", { class: "muted small" }, "Import a bank file first and the page will suggest amounts from what you actually spend.", h("span", { class: "row", style: { marginTop: "8px" } }, importBtn()))
        : h("p", { class: "muted small" }, reason));
  }
  if (s.drawn) {
    // the chips only when they offer a choice: two spans with the same days are one (critic 5)
    if (s.kind === "ok" && s.spans.length > 1) hero.append(choice(ctx, { id: "safeSpan", label: "How far ahead", presets: s.spans.map((v) => ({ value: v, label: SPAN_LABELS[v] })), value: s.span,
      onPick: (v) => { pending = { text: "Saved.", before: answer }; store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.safeSpend = { span: v }; }); } }));
    // every reason to doubt the figure stays in sight (R9 item 5)
    for (const x of s.words.doubt) hero.append(h("p", { class: "small" }, x));
  }
  // every dollar a job, and nothing to say yet: what it waits for
  if (job && !job.drawn) hero.append(h("p", { class: "small" }, job.words.wait, job.why === "plan" ? [" ", h("a", { href: "#/cashflow/income" }, "Add your pay")] : null));
  // a file that stops days ago leaves "spent so far" short: say where it stops
  // (with every dollar given a job the headline counts no spending, so the line sits with the envelopes it is about: critic P7)
  const staleLine = () => h("p", { class: "muted small" }, `Spent so far comes from your bank files, which stop on ${fmt.date(d.cover.to)}. Import a newer file to count the rest of the month.`);
  const staleBelow = d.stale && !!job?.drawn && d.envelopes.length > 0;
  if (d.stale && !staleBelow) hero.append(staleLine());
  // a payment that went to one of two cards this month: in no envelope, said once (re-check 4, 2026-11-02)
  if (d.unsure) hero.append(h("p", { class: "small" }, `${d.unsure} Until then, spending here leaves it out.`));
  root.append(hero);
  // the confirmation goes at the top, where the eye is after a tap; it names the new answer when the save changed it (R7)
  if (pending) {
    const said = pending; pending = null;
    const n = ui.notice("ok", said.before && answer && answer !== said.before ? `${said.text} ${answer}` : said.text);
    root.append(n); setTimeout(() => n.remove(), 5000);
  }
  // the month: only once there is something to look back on
  if (d.hasBudget || d.hasData) {
    const months = []; for (let k = 0; k < 6; k++) { const dt = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - k, 1); months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`); }
    root.append(ui.card(null, h("div", { class: "form" }, ui.field("Month", ui.select(months.map((m) => ({ value: m, label: monthLabel(m) })), d.month, { onChange: (e) => { state.month = e.target.value; redraw(); } })))));
  }

  // ---------------------------------------------------------------- the way chosen: its own card (never drawn for "Envelopes")
  if (job?.drawn) {
    const line = lineOf(h, money);
    root.append(ui.card("This month's money", h("ul", { class: "page-list" }, [
      line("Money in after tax", job.takeHome, "#/cashflow/income", "The same month the Dashboard uses."),
      job.heldIn >= 0.5 ? line("Held from last month", job.heldIn) : null,
      line("In your envelopes", -job.envelopes, null, `${d.envelopes.length} envelope${d.envelopes.length === 1 ? "" : "s"}, at their monthly amounts`),
      // a bill typed on the Expenses page already has a job, envelope or not (critic M2)
      job.outside >= 0.5 ? line("Bills on your Expenses page with no envelope", -job.outside, "#/cashflow/expenses", job.outsideKinds.length > 3 ? `${job.outsideKinds.slice(0, 3).join(", ")} and ${job.outsideKinds.length - 3} more` : job.outsideKinds.join(", ")) : null,
      job.saving >= 0.5 ? line("Saving and extra debt payments from your plan", -job.saving, "#/goals/goals") : null,
      job.heldOut >= 0.5 ? line("Held for next month", -job.heldOut) : null,
      line(job.toGive > -0.5 ? "Still to give a job" : "Given out past what you have", Math.abs(job.toGive) < 0.5 ? 0 : job.toGive, null, null, true),
    ])));
  }
  if (three?.source) {
    root.append(ui.card("Three numbers", h("div", { class: "grid" }, three.tiles.map((t) => (!three.hasData ? ui.stat(t.label, money(t.plan), "a month")
      // a yearly bill lands whole in one month, so its tile says what is set aside and what was paid, never "over"
      : t.key === "yearly" ? ui.stat(t.label, `${money(t.plan)} a month`, `set aside; ${money(t.spent)} paid ${d.month === today.slice(0, 7) ? "this month" : "that month"}`)
        : ui.stat(t.label, t.left > -0.5 ? `${money(Math.max(0, t.left))} left` : `${money(-t.left)} over`, `${money(t.spent)} spent of ${money(t.plan)}`)))),
      // where each plan comes from, and what "must-pay" covers (critics P2 and P4)
      h("p", { class: "muted small" }, three.source === "expenses" ? "The plans come from your Expenses page."
        : three.source === "both" ? "Each plan is your envelopes, plus what your Expenses page holds for kinds of spending with no envelope."
          : ["The plans come from your envelopes only: nothing is on your Expenses page yet. ", h("a", { href: "#/cashflow/expenses" }, "Add your bills"), "."],
      three.hasData ? " What was spent comes from your bank files." : null,
      " Must-pay means rent, groceries, the car, insurance and the like.")));
  }

  const formCard = ui.card(null);
  const formHost = h("div");
  let showForm = d.envelopes.length === 0 && !d.fromExpenses.length;   // with Expenses to start from, typing by hand folds away
  const drawForm = (prefill) => {
    formHost.innerHTML = "";
    if (prefill) showForm = true;
    if (!showForm && !editing) { formHost.append(ui.button(d.envelopes.length ? "+ Add another envelope" : "+ Add an envelope by hand", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { rollover: false, ...(prefill ?? {}) };
    formHost.append(h("div", {},
      h("h2", {}, editing ? `Edit ${editing.label}` : "Add an envelope"),
      ui.form(FIELDS, values, (v) => {
        store.update((p) => {
          p.budgets = p.budgets ?? [];
          if (editing) { const i = p.budgets.findIndex((b) => b.id === editing.id); if (i >= 0) p.budgets[i] = { ...p.budgets[i], category: v.category, amount: v.amount ?? 0, rollover: !!v.rollover }; }
          else { const i = p.budgets.findIndex((b) => b.category === v.category); if (i >= 0) p.budgets[i] = { ...p.budgets[i], amount: v.amount ?? 0, rollover: !!v.rollover }; else p.budgets.push({ id: ui.uid(), category: v.category, amount: v.amount ?? 0, period: "monthly", rollover: !!v.rollover }); }
          const undone = dropOrphanMoves(p);   // the envelope now holds another kind of spending: money moved to or from the old one goes back
          pending = { text: `${editing ? "Envelope saved." : "Envelope added."}${movesUndone(undone)}`, before: answer };
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add envelope", resetAfter: !editing, onCancel: (editing || d.envelopes.length) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? h("p", { style: { marginTop: "12px" } }, ui.button(`Remove the ${editing.label} envelope`, () => { const id = editing.id; editing = null; store.update((p) => { p.budgets = (p.budgets ?? []).filter((b) => b.id !== id); pending = { text: `Envelope removed.${movesUndone(dropOrphanMoves(p))}`, before: answer }; }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  // ---------------------------------------------------------------- the envelopes: those over first, six, then "N more envelopes"
  const out = h("div");
  if (d.envelopes.length) {
    const over = d.envelopes.filter((e) => e.left < -0.005).sort((a, b) => a.left - b.left);
    const items = [...over, ...d.envelopes.filter((e) => !over.includes(e))];
    const envRow = (e) => h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.budgets.find((b) => b.id === e.id); editing = { ...editing, label: e.label }; showForm = true; drawForm(); formHost.scrollIntoView?.({ behavior: "smooth", block: "start" }); },
      onKeydown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } } },
      h("span", { class: "ic" }, e.icon),
      h("span", { class: "body" },
        h("div", { class: "t" }, e.label, " ", !d.hasData ? null : e.pace === "over" ? h("span", { class: "pill warn" }, "over") : e.pace === "ahead" ? h("span", { class: "pill warn" }, "spending fast") : e.pace === "paid" ? h("span", { class: "pill ok" }, "paid") : h("span", { class: "pill ok" }, "on track")),
        d.hasData ? h("div", { class: "progress", style: { margin: "6px 0 2px" } }, h("span", { style: { width: `${Math.round(e.share * 100)}%`, background: e.pace === "over" ? "var(--bad)" : e.pace === "ahead" ? "var(--warn)" : "var(--ok)" } })) : null,
        h("div", { class: "d" }, d.hasData ? `${money(e.spent)} of ${money(e.available)}${moneyNote(e, money)}${e.rollover ? " · rolls over" : ""}` : `a month${e.rollover ? " · rolls over" : ""}`)),
      // "Edit" under the amount, as on Income and Expenses (CF-8: these rows looked like the ones on Bills that cannot be tapped)
      h("span", { class: "st", style: { textAlign: "right" } }, h("div", { style: { fontWeight: "600", color: e.left < 0 ? "var(--bad)" : "inherit" } }, d.hasData ? `${e.left < 0 ? "-" : ""}${money(Math.abs(e.left))} left` : money(e.amount)), h("div", { class: "muted small" }, "Edit ›")));
    root.append(ui.card("Envelopes",
      // with Safe to spend as the headline, which envelopes are over leads their card; no total "left" beside the headline's
      // (it counts the envelopes for bills, which Safe to spend leaves out: critic 1)
      s.drawn && env && !overLine ? h("p", {}, env.more) : null,
      staleBelow ? staleLine() : null,
      // an envelope over or spending fast is never behind "N more envelopes" (R19)
      ...rest(ctx, { id: "envelopes", items, row: envRow, noun: "envelopes", one: "envelope", list: "page-list", keep: (e) => d.hasData && (e.pace === "over" || e.pace === "ahead") }),
      h("p", { class: "muted small" }, d.hasData ? `Day ${d.dayOfMonth} of ${d.daysInMonth}. "Spending fast" means more than the share of the month that has passed. Tap an envelope to change it.` : "Tap an envelope to change its amount."),
      out, formHost,
    ));
  }
  if (d.unbudgeted.length) root.append(ui.card("Spent this month with no envelope", introOnce(),
    ...rest(ctx, { id: "unbudgeted", items: d.unbudgeted, noun: "kinds of spending", one: "kind of spending", list: "page-list", row: (u) => h("li", {},
      // the amount under the name, so a 320 px row keeps the name on one or two lines beside its button
      h("span", { class: "ic" }, u.icon), h("span", { class: "body" }, h("div", { class: "t" }, u.label), h("div", { class: "d" }, h("strong", {}, money(u.spent)), " so far")),
      u.category ? h("span", { class: "st" }, ui.button("Add envelope", () => { editing = null; drawForm({ category: u.category, amount: Math.round(u.spent) }); formHost.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, { class: "secondary small" })) : null) })));
  const useIt = (sg) => { pending = { text: `Envelope added for ${sg.label}.`, before: answer }; store.update((p) => { p.budgets = p.budgets ?? []; if (!p.budgets.some((b) => b.category === sg.category)) p.budgets.push({ id: ui.uid(), category: sg.category, amount: sg.average, period: "monthly", rollover: false }); }); };
  const suggestionRow = (sg) => h("li", {},
    h("span", { class: "ic" }, sg.icon),
    h("span", { class: "body" }, h("div", { class: "t" }, sg.label), h("div", { class: "d" }, h("strong", {}, money(sg.average)), ` a month, the average of ${sg.months} whole month${sg.months === 1 ? "" : "s"}`)),
    h("span", { class: "st" }, ui.button("Use it", () => useIt(sg), { class: "secondary small" })));
  // a card whose own file is missing in those months: what went to it is in no suggestion, so say what the amounts leave out
  const cardNote = (d.suggestCards ?? []).length ? h("div", { class: "bu-cards", style: { marginBottom: "10px" } },
    // every month averaged: "about $X a month went to it"; only some (its file is in for the others): name them (2026-11-02)
    ...d.suggestCards.map((c) => { const all = (c.inMonths ?? []).length >= d.suggestFrom.length, when = monthsWords(c.inMonths ?? []);
      return h("p", { class: "small", style: { margin: "0 0 8px" } }, all ? `${c.name}'s purchases aren't in these amounts: about ${money(c.average)} a month went to it, but its own file isn't in, so what it bought isn't sorted into kinds yet. ${bringWords(c.name)}`
        : `${c.name}'s purchases in ${when} aren't in these amounts: ${money(c.total ?? c.average * c.months)} went to it then, ${c.before && c.first ? `before its file starts on ${shortDate(c.first)}` : `but its ${when} file isn't in`}, so what it bought then isn't sorted into kinds yet. ${bringWords(c.name)}`); }),
    ui.row(...d.suggestCards.slice(0, 2).map((c) => h("a", { class: "btn secondary", href: `#/transactions/import?accountId=${encodeURIComponent(c.cardId)}` }, bringWords(c.name).replace(/\.$/, ""))))) : null;
  if (d.suggestions.length) root.append(ui.card("Suggested from your last months", introOnce(),
    s.drawn && reason ? h("p", { class: "muted small" }, reason) : null, cardNote,
    ...rest(ctx, { id: "suggestions", items: d.suggestions, row: suggestionRow, noun: "suggestions", one: "suggestion", list: "page-list" })));
  // nothing budgeted and no whole bank month: the amounts already typed on Expenses, in one tap (round 4, 2026-11-02)
  if (d.fromExpenses.length) {
    const nb = nbaOf();
    const spare = nb?.ready ? nb.spare.monthly : null;
    // short only in a lean month (Side income's "count on" holds part of uneven pay back): said as the other pages say it,
    // with what a month that brings the Income page's amount leaves, to the nearest $10 (review 2026-11-02, round 5)
    const lean = nb?.ready && nb.spare.held > 0.5 ? nb.spare : null;
    const n = d.fromExpenses.length;
    root.append(ui.card("Start from your expenses", introOnce(),
      s.drawn && reason ? h("p", { class: "muted small" }, reason) : null,
      h("p", {}, `Your Expenses page has ${n} kind${n === 1 ? "" : "s"} of spending, ${money(d.fromExpensesTotal)} a month in all. Use them as your envelopes, then change any of them.`),
      spare !== null ? h("p", { class: "muted small" }, spare >= 0 ? `After these, tax and your saving, about ${money(spare)} is left each month${lean ? ", counting uneven pay at what you can count on" : ""}: the same figure as the Dashboard.`
        : lean ? `In a lean month, these, tax and your saving come to about ${money(-spare)} more than comes in, counting uneven pay at what you can count on: the same gap as the Dashboard. ${lean.fullKind === "ahead" ? `A month that brings the Income page's amount leaves about ${money(lean.fullAbout)}.` : lean.fullKind === "even" ? "Even a month that brings the Income page's amount only just about breaks even." : `Even a month that brings the Income page's amount is about ${money(-lean.fullAbout)} short.`}`
        : `These, tax and your saving come to about ${money(-spare)} a month more than comes in: the same gap as the Dashboard.`) : null,
      h("div", { class: "row" },
        ui.button("Use these as my budget", () => {
          pending = { text: `${n} envelope${n === 1 ? "" : "s"} added from your expenses. Spending against them shows once a bank file is in; tap one to change it.`, before: answer };
          store.update((p) => { useExpenses(p, d.fromExpenses, ui.uid); });
        }),
        importBtn("Import a bank file instead")),
      ...rest(ctx, { id: "fromExpenses", items: d.fromExpenses, noun: "kinds of spending", one: "kind of spending", list: "page-list", row: (x) => h("li", {},
        h("span", { class: "ic" }, x.icon), h("span", { class: "body" }, h("div", { class: "t" }, x.label)),
        h("span", { class: "st amount" }, money(x.amount))) }),
    ));
  }
  if (!d.envelopes.length) {
    // with Safe to spend as the headline and nothing else to explain it, why no amount is suggested sits by the form
    const said = introOnce();
    if (said) formCard.append(said);
    if (s.drawn && reason && !d.suggestions.length && !d.fromExpenses.length) formCard.append(h("p", { class: "muted small" }, reason));
    formCard.append(out, formHost); root.append(formCard);
  }

  // ---------------------------------------------------------------- one tap away
  // "Set my own numbers": how you budget, once there is an envelope to budget with (or a way was already chosen)
  const optionsSet = (way.carryOver ? 1 : 0) + ((d.way?.moves.length ?? 0) > 0 ? 1 : 0) + (way.method === "zero" && (d.way?.heldOut ?? 0) > 0 ? 1 : 0);   // (money held counts only where it is offered: with every dollar given a job)
  const optional = parts(ctx,
    (d.hasBudget || plan.budgetPlan) && { id: "way", kind: "own", says: WAY_LABELS[way.method], set: optionsSet, open: savedInWay, holds: ["budgetWay", "carryOver", "hold"],
      body: () => wayBody(ctx, { d, way, job, money, answer: () => answer, say: (text) => { pending = { text, before: answer, part: "way" }; } }) },
    s.drawn && { id: "how", kind: "how", says: s.mode === "plan" ? "from your plan" : "from envelopes", body: () => howBody(ctx, s, money) });
  if (optional) root.append(optional);   // (nothing to offer is null: never handed to append, a browser would write "null")
  if (d.hasBudget || d.hasData || d.fromExpenses.length) root.append(links(ctx, [
    { href: "#/cashflow/spending", ask: "Where did my money go this month?" },
    { href: "#/cashflow/sinking-funds", ask: "What do my yearly bills need each month?" },
    { href: "#/cashflow/budget-percent", ask: "Prefer one simple rule? Needs, wants and savings" },
  ]));
}

/** " The $40 moved to or from it is undone." after an envelope is removed: said, never silent (critic M4). */
const movesUndone = (n) => (n === 1 ? " The money moved to or from it is back where it was." : n > 1 ? ` The ${n} moves of money to or from it are undone.` : "");

/** "Your 7 envelopes hold $4,200 a month." (one envelope: "Your envelope holds ...") */
function holdWords(d, money) {
  const n = d.envelopes.length;
  return n === 1 ? `Your envelope holds ${money(d.totals.amount)} a month.` : `Your ${n} envelopes hold ${money(d.totals.amount)} a month.`;
}

/** One line of a sum: a figure that comes from another page is a link to it (li > a.row-link, as "More on this" draws it); a total is not. */
const lineOf = (h, money) => (label, amount, href, detail, total = false) => {
  const kids = [h("span", { class: "body" }, h("div", { class: "t", style: total ? { color: "var(--text)" } : null }, label), detail ? h("div", { class: "d" }, detail) : null),
    h("span", { class: "st", style: { fontWeight: total ? "700" : "600", whiteSpace: "nowrap" } }, `${amount < -0.005 ? "- " : ""}${money(Math.abs(Math.round(amount)))}`)];
  return h("li", {}, href ? h("a", { href, class: "row-link" }, ...kids) : kids);
};

/**
 * "Set my own numbers" (gap #37): how you budget, as chips; then, for the ways that use envelopes, what overspending does
 * and "Move money between envelopes"; with every dollar given a job, "Hold for next month". Each tap saves at once and says so.
 */
function wayBody(ctx, { d, way, job, money, say }) {
  const { ui, store } = ctx, h = ui.h;
  const field = (label, node, help) => h("div", { class: "field", dataset: { noKeep: "" } }, h("span", { class: "field-label" }, label), node, help ? h("small", { class: "help" }, help) : null);
  const save = (text, patch) => { say(text); store.update((p) => { setWay(p, patch); }); };
  const out = [field("How you budget", choice(ctx, { id: "budgetWay", label: "How you budget", presets: Object.entries(WAY_LABELS).map(([value, label]) => ({ value, label })), value: way.method,
    onPick: (v) => save(`Saved: ${WAY_LABELS[v]}.`, { method: v }) }), WAY_WORDS[way.method])];
  if (!d.envelopes.length) return out;
  out.push(field("When an envelope goes over", choice(ctx, { id: "carryOver", label: "When an envelope goes over", presets: [{ value: "no", label: "It ends with the month" }, { value: "yes", label: "It comes out of next month" }], value: way.carryOver ? "yes" : "no",
    onPick: (v) => save(v === "yes" ? "Saved. Overspending now comes out of next month." : "Saved. Overspending now ends with its month.", { carryOver: v === "yes" }) }),
  way.carryOver ? "What an envelope went over by last month comes off what it has this month." : null));
  if (job?.drawn) {
    // never more than is left to give (rounded down to the dollar, so holding it all never tips the month over: critics P1, M3)
    const all = job.canHold;
    out.push(field("Hold for next month", choice(ctx, { id: "hold", label: "Hold for next month", presets: [{ value: 0, label: "Nothing" }, all >= 1 && all !== job.heldOut ? { value: all, label: `All ${money(all)}` } : null].filter(Boolean), value: job.heldOut,
      own: all >= 1 ? { type: "money", label: "Amount to hold", min: 0, max: all } : null,
      onPick: (v) => { if (Number(v) > all && Number(v) > job.heldOut) return; save(Number(v) > 0 ? `Saved. ${money(v)} is held for next month.` : "Saved. Nothing is held for next month.", { hold: { month: d.month, amount: v } }); } }),
    all >= 1 ? `Money held is left out of this month and added to next month's. You can hold up to ${money(all)}.` : "Money held is left out of this month and added to next month's. Nothing is left to hold this month."));
  }
  if (d.envelopes.length >= 2) {
    const moves = d.way?.moves ?? [];
    if (moves.length) out.push(h("ul", { class: "records" }, moves.map((m) => h("li", {},
      h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, `From ${m.fromLabel} to ${m.toLabel}`), h("span", { class: "rec-value" }, money(m.amount))),
      h("div", { class: "rec-foot" }, h("span", {}, `Moved in ${monthLabel(m.month)}`), ui.button("Undo", () => save(`Move undone: ${money(m.amount)} is back in ${m.fromLabel}.`, { removeMove: m.id }), { class: "secondary small" }))))));
    const host = h("div", {});
    const closed = () => { host.innerHTML = ""; host.append(ui.button(moves.length ? "+ Move more money" : "Move money between envelopes", open, { class: "secondary" })); };
    const open = () => {
      host.innerHTML = "";
      // from the envelope with the most left, to the one furthest over (the usual reason to move money)
      // (a bill already paid in full is not short of money: it is the last choice for "To")
      const byLeft = [...d.envelopes].sort((a, b) => (a.pace === "paid") - (b.pace === "paid") || b.left - a.left);
      const options = d.envelopes.map((e) => ({ value: e.category, label: `${e.icon} ${e.label} (${e.left < 0 ? "-" : ""}${money(Math.abs(e.left))} left)` }));
      const err = h("div", {});
      host.append(h("div", {}, h("h3", {}, `Move money in ${monthLabel(d.month)}`), err, ui.form([
        { key: "from", label: "From", type: "select", options },
        { key: "to", label: "To", type: "select", options },
        { key: "amount", label: "Amount", type: "money", required: true, min: 0 },
      ], { from: byLeft[0].category, to: (byLeft.slice(1).filter((e) => e.pace !== "paid").pop() ?? byLeft[byLeft.length - 1]).category }, (v) => {
        const problem = moveProblem(d, v, money);
        if (problem) { err.innerHTML = ""; err.append(ui.notice("error", problem)); return false; }
        const a = d.envelopes.find((e) => e.category === v.from), b = d.envelopes.find((e) => e.category === v.to);
        save(`Moved ${money(v.amount)} from ${a.label} to ${b.label}.`, { addMove: { id: ui.uid(), month: d.month, from: v.from, to: v.to, amount: v.amount } });
      }, { submitLabel: "Move money", onCancel: closed })));
    };
    closed();
    out.push(host);
  }
  return out;
}

/** "How this is worked out": the month's sum, each figure linked to the page it comes from, then the span. */
function howBody(ctx, s, money) {
  const h = ctx.ui.h;
  const line = lineOf(h, money);
  const rows = [];
  if (s.mode === "plan") {
    const p = s.plan;
    const kinds = p.mustPayKinds.length > 3 ? `${p.mustPayKinds.slice(0, 3).join(", ")} and ${p.mustPayKinds.length - 3} more` : p.mustPayKinds.join(", ");
    rows.push(line("Money in after tax", p.takeHome, "#/cashflow/income", "The same month the Dashboard uses."));
    rows.push(line("Must-pay bills", -p.mustPay, "#/cashflow/expenses", kinds || null));
    if (p.setAside > 0.5) rows.push(line("Set aside for yearly and one-time costs", -p.setAside, "#/cashflow/sinking-funds"));
    if (p.retirement + p.goals > 0.5) rows.push(line("Saving for retirement and goals", -(p.retirement + p.goals), "#/goals/goals", p.retirement > 0.5 && p.goals > 0.5 ? `${money(Math.round(p.retirement))} for retirement, ${money(Math.round(p.goals))} for goals` : null));
    if (p.debtExtra > 0.5) rows.push(line("Extra on debts", -p.debtExtra, "#/debt/payoff"));
    rows.push(line(`Free for ${s.monthName}`, s.planned, null, null, true));
  } else {
    const names = s.envelopes.map((e) => e.label);
    rows.push(line("In your envelopes that are not bills", s.planned, null, names.length > 4 ? `${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : names.join(", ")));
  }
  // in envelope mode, how much of it had no envelope (it comes off the envelopes' money too: critic 3)
  rows.push(line("Spent so far on everything else", -s.spent, `#/transactions/ledger?month=${s.month}`, `${s.monthName} 1 to today, from your bank files${s.noEnvelope >= 0.5 ? `; ${money(Math.round(s.noEnvelope))} of it with no envelope` : ""}`));
  rows.push(line(`Left for ${s.monthName}`, s.left, null, null, true));
  const spanWords = s.days === 1 ? "today" : s.cut ? `the ${s.days} days to the end of the month` : s.span === "payday" ? `the ${s.days} days until payday` : `the ${s.days} days through Sunday`;
  return [
    h("ul", { class: "page-list" }, rows),
    s.kind === "ok" ? h("p", {}, `Of the ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left in ${s.monthName} (today included), ${spanWords}: ${money(Math.round(s.left))} × ${s.days} ÷ ${s.daysLeft} = ${money(Math.round(s.safe))}, about ${money(s.about)}.`) : null,
    h("p", { class: "muted small" }, s.mode === "plan"
      ? "Spending on must-pay kinds (rent, groceries, the car, insurance and the like) is not counted as spent here: it is set aside above. A yearly or one-time cost paid this month comes from what was set aside for it. Money out that is not sorted into a kind yet counts as spent, so the figure errs low."
      : "Spending on must-pay kinds (rent, groceries, the car, insurance and the like) is left out: their envelopes keep their own amounts. Money out that is not sorted into a kind yet counts as spent, so the figure errs low."),
  ];
}
