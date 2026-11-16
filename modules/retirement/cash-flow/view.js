// modules/retirement/cash-flow/view.js -- DOM only. The year-by-year ledger: a toggle between
// today's dollars and the dollars of each year, one record per year on a phone, a table on desktop. A tap on a year opens
// "Change this year" under it (gap list, next 60, item 32): spend more or less that year, money in or out once, each saved
// as a thing that will happen on Will the money last? (modules/retirement/happenings.js), with its green line and Undo.
import { needButtons } from "../needs.js";
import { unknownWords } from "../projection/compute.js";
import { needItem } from "../../../core/words.js";
import { compute, yearChanges, yearMarks, yearOffers, yearChange, yearFacts, lessRoom, removeYearChange } from "./compute.js";
import { saveHappening, nextId, check as checkHappening, lineWords, drawSets, AMOUNT_CEILING, MONTHLY_CEILING } from "../happenings.js";
import { answerOf, answerChangeWords } from "../levers.js";
/** The page's own question inside the "we can't say yet" sentence (projection unknownWords). */
export const UNKNOWN_WHAT = "whether the money lasts";
/**
 * shortWords(amount, { unknown, every }) -> what a year the money does not cover says: "$29,040 short this year" in red, or, when
 * the plan's answer is not known yet (nothing saved for retirement and nothing going in; compute's `unknown`), "$29,040 of spending
 * not covered this year" in the page's plain colour, as the hero says we can't say whether the money lasts (fix round of the
 * whole-app sweep x3, critic P2: red "$0 left" and "short every year" under "we can't say"). `every`: the folded run of years.
 */
export function shortWords(amount, { unknown = false, every = false } = {}) {
  if (every) return unknown ? `nothing left; about ${amount} of spending a year not covered` : `nothing left; about ${amount} short every year`;
  return unknown ? `${amount} of spending not covered this year` : `${amount} short this year`;
}

// `open`: the year whose row shows "Change this year"; `kind`: the change whose form is open in it. Both start again on a new
// visit (a new route), never in the plan.
const state = { real: true, from: "retirement", open: null, kind: null, route: null };
// the green line of the last save, remove or undo, drawn once on the next drawing: { year, what, said, before, undo?, putBack? }
let pending = null;

const STYLE = `
.cf-root .cf-row { position: relative; display: block; width: 100%; min-height: 44px; margin: 0; padding: 0 22px 0 0; background: none; border: 0; border-radius: 0; color: inherit; font: inherit; font-weight: inherit; text-align: left; cursor: pointer; }
.cf-root .cf-row:hover { filter: none; }
.cf-root .cf-row::after { content: "›"; position: absolute; right: 0; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 22px; line-height: 1; transition: transform .15s; }
.cf-root .cf-row[aria-expanded="true"]::after { transform: translateY(-50%) rotate(90deg); }
.cf-root .records li.cf-open { margin: 0 -8px; padding: 12px 8px; background: var(--accent-soft); border-radius: var(--radius-sm); }
.cf-root tr.cf-open > td { background: var(--accent-soft); }
.cf-root .cf-panel .chip[aria-expanded="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); }
@media (prefers-reduced-motion: reduce) { .cf-root .cf-row::after { transition: none; } }
.cf-root .cf-row > .rec-sub { display: block; }
.cf-root .cf-year { min-height: 44px; padding: 0 6px 0 0; background: none; border: 0; border-radius: 0; color: var(--accent-ink); font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; justify-content: flex-start; }
.cf-root .cf-year:hover { filter: none; }
.cf-root .cf-panel { display: grid; gap: 10px; margin-top: 10px; padding: 12px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel); }
.cf-root .cf-panel p, .cf-root .cf-panel h3, .cf-root .cf-panel .chips { margin: 0; }
.cf-root .cf-panel > div:empty { display: none; }
.cf-root .cf-changes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.cf-root .cf-changes li { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 0; border: 0; }
.cf-root .cf-mark { margin: 0 6px 0 0; }
.cf-root .cf-panel .cf-close { justify-self: start; }
`;

/** The four chips of "Change this year", and what each form's title says after the year ("In 2040: spend more"). */
export const CHIP = Object.freeze({ more: "Spend more", less: "Spend less", in: "Money coming in once", out: "A big cost once" });
const TITLE = { more: "spend more", less: "spend less", in: "money coming in", out: "a big cost" };
/** Why a row offers only money in or out once (yearOffers): before retirement, or a way of taking money out that sets spending. */
export const BEFORE_WORDS = "Before you retire this plan only follows your savings, so you can add or take out a one-time amount for this year.";
export const WAY_WORDS = "Your way of taking money out sets each year's spending (How much to take out), so only money in or out once can change this year.";
/**
 * doneWords(what, said, answer, { onRow }) -> the green line after a change of one year, one sentence for each case, then the
 * answer now against before (levers.js answerChangeWords, as Will the money last? says it), when there is one:
 *   saved       "Saved: Spending goes up $500 a month in 2060. Your retirement answer: lasts to the end, with about $9,000 less left at 95 (today's dollars)."
 *   removed     "Removed: A new roof in 2060: $40,000 out of savings. Your retirement answer: ..."
 *   undoSave    "Undone: ..." (Undo after a save: the change is taken out again)
 *   undoRemove  "Put back: ..." (Undo after a remove)
 * `onRow`: the line stands right under its year's row, which says the change itself after a save or a put back, so the change is
 * not said twice (critic of item 32, P5): "Saved. Your retirement answer: ..." / "Put back. Your retirement answer: ...".
 */
export function doneWords(what, said, answer = "", { onRow = false } = {}) {
  const lead = { saved: "Saved", removed: "Removed", undoSave: "Undone", undoRemove: "Put back" }[what];
  if (!lead) throw new Error(`doneWords: unknown case "${what}"`);
  const head = onRow && (what === "saved" || what === "undoRemove") ? lead : `${lead}: ${said}`;
  return answer ? `${head}. Your retirement answer: ${answer}.` : `${head}.`;
}
/**
 * markSaid(mark, { money, people }) -> one change of one year (compute.js yearMarks), said as on Will the money last?, then
 * what the plan makes of it, one case each:
 *   counted     "A new roof in 2060: $40,000 out of savings"
 *   floored     "Spending goes down $9,000 a month in 2060 (more than that year's spending, so spending is taken to $0)"
 *   not counted "Spending goes up $500 a month in 2040 (not counted: the plan does not count spending before you retire)"
 */
export function markSaid(m, { money, people = [] } = {}) {
  const t = lineWords(m.h, { money, people });
  if (!m.counted) return `${t} (not counted: ${String(m.why ?? "").replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, "")})`;
  return m.floored ? `${t} (more than that year's spending, so spending is taken to $0)` : t;
}
/** A year's changes (yearMarks) in one line, each markSaid; "(today's dollars)" while the page shows each year's. */
export function marksSaid(list, { money, people = [], real = true } = {}) {
  const t = list.map((m) => markSaid(m, { money, people })).join("; ");
  return real ? t : `${t} (today's dollars)`;
}
/**
 * hiddenSaid(text, { byFilter, many }) -> the line for changes in years with no row of their own (critic of item 32, F5): before
 * retirement while Years shows from retirement on (`byFilter`), or in the folded "nothing left" years:
 *   "Your changes in years not listed here: A new roof in 2040: $40,000 out of savings."
 *   byFilter adds "Choose every year under Years to see it." (one) / "... to see them." (more than one)
 */
export function hiddenSaid(text, { byFilter = false, many = false } = {}) {
  const first = `Your changes in years not listed here: ${text}.`;
  return byFilter ? `${first} Choose every year under Years to see ${many ? "them" : "it"}.` : first;
}
/** "Tap a year to change it.": its own line first in the ledger (critic of item 32, P2), with a chevron on each phone record. */
export const TAP_WORDS = "Tap a year to change it.";

// the plan's own withdrawal order, not a fixed one (stress test 2026-11-11: the key named one order whatever Withdrawal order chose)
// the same names as Which account to draw from first: taxable, pre-tax, Roth (review of the cash-flow key)
const PART = { taxable: "taxable savings", deferred: "pre-tax accounts (taxed as it comes out)", free: "Roth (tax-free)" };
export function orderSaid(order, split = null) {
  // a share from every account (Withdrawal order's fifth, `retirement.withdrawalSplit`; gap list, next 60, item 22)
  if (split === "proportional") return "Money comes out of cash first, then a share from every account, by what each holds.";
  const parts = (order ?? []).map((k) => PART[k]).filter(Boolean);
  return parts.length ? `Money comes out of cash first, then ${parts.join(", then ")}.` : "Money comes out of cash first, then in the order set on Withdrawal order.";
}

/** A year's money moved between accounts (Will the money last?, "Things that will happen"), in the dollars shown. */
export function moveSaid(m, money) {
  if (!(m.amount >= 0.5)) return `Nothing to move from ${m.fromName ?? "an account"}`;
  return `Moved ${money(m.amount)} from ${m.fromName ?? "an account"} to ${m.toName ?? "an account"}${m.capped ? ", all it held" : ""}${m.tax >= 0.5 ? `, ${money(m.tax)} of tax` : ""}`;
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today, real: state.real });
  const money = (n) => fmt.money(n, cur);
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  // a new visit starts with every row shut (the redraw after a save keeps the same route)
  if (ctx.route !== state.route) { state.route = ctx.route; state.open = null; state.kind = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Year by year"), ui.h("p", { class: "lede" }, "Every year of the plan in one table: ages, what comes in, what goes out, what is taken from which account and what is left. It needs the same answers as the Will the money last? page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, needItem(m)))), (needButtons(ui, d.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")))));
    return;
  }
  const page = ui.h("div", { class: "cf-root" }, ui.h("style", {}, STYLE));
  root.append(page);
  page.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Year by year"),
    // nothing saved for retirement and nothing going in: the projection's own "we can't say yet" in place of "The money runs out"
    // (whole-app sweep x3, 2026-11-16); the years stay below, as they are worked out
    ui.h("p", { class: "lede" }, `${d.rows.length} years, from ${d.rows[0].year} to ${d.rows[d.rows.length - 1].year}. ${d.unknown ? unknownWords(d.unknown, UNKNOWN_WHAT) : d.verdict === "short" ? `The money runs out in ${d.shortYear}.` : "The money lasts to the end."} Over the whole plan: ${money(d.totals.income)} of guaranteed income, ${money(d.totals.withdrawn)} taken from savings, ${money(d.totals.taxes)} of tax on withdrawals.`),
    d.unknown ? ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add what you own ›")) : null,
  ));
  const realSel = ui.select([{ value: "real", label: "today's dollars" }, { value: "nominal", label: "each year's dollars" }], state.real ? "real" : "nominal", { "aria-label": "Dollars", onChange: (e) => { state.real = e.target.value === "real"; redraw(); } });
  const fromSel = ui.select([{ value: "retirement", label: "from retirement on" }, { value: "all", label: "every year" }], state.from, { "aria-label": "Years", onChange: (e) => { state.from = e.target.value; redraw(); } });
  page.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Show amounts in", realSel), ui.field("Years", fromSel))));
  const rowsAll = state.from === "all" ? d.rows : d.rows.filter((r) => r.retired);
  const taken = (r) => r.from.cash + r.from.taxable + r.from.deferred + r.from.free;
  // Once the money is gone every later year reads the same: collapse them into one row
  // (design log 2026-09-16, pass 4).
  let firstEmpty = rowsAll.findIndex((r, i) => r.end.total <= 0 && r.shortfall && i > 0 && rowsAll[i - 1].end.total <= 0);
  if (firstEmpty > 0 && !rowsAll.slice(firstEmpty).every((r) => r.end.total <= 0 && r.shortfall)) firstEmpty = -1;
  const rows = firstEmpty > 0 ? rowsAll.slice(0, firstEmpty) : rowsAll;
  const tail = firstEmpty > 0 ? rowsAll.slice(firstEmpty) : [];
  const tailRow = tail.length ? { first: tail[0].year, last: tail[tail.length - 1].year, short: Math.max(...tail.map((r) => r.shortfall)) } : null;

  // ---- a change of one year (gap list, next 60, item 32) ------------------------------------------------------------------
  const people = d.people ?? [];
  const sayOf = (h) => lineWords(h, { money, people });
  // the projection's first and last year, its people, its way of taking money out, the year retirement starts and the spending a
  // change moves: when the plan holds a change of one year (to say whether each is counted) or a row is open
  let facts;
  const factsOf = () => (facts === undefined ? (facts = yearFacts(plan, { today })) : facts);
  const hasMarks = Object.keys(yearChanges(plan)).length > 0;
  const marks = hasMarks ? yearMarks(plan, factsOf()) : {};
  const answerNow = () => { try { return answerOf(plan, { today }); } catch { return null; } };
  // the phone shows the records, a wider screen the table (core/ui/base.css .only-wide, 720 px): one place for what opens
  const wide = (() => { try { return !!globalThis.matchMedia?.("(min-width: 720px)")?.matches; } catch { return false; } })();
  // the green line of the last save, remove or undo (drawn once, in the row of its year)
  let notice = null, noticeYear = null;
  if (pending) {
    const p = pending;
    pending = null;
    const now = answerNow();
    let w = "";
    try { w = answerChangeWords(p.before, now, money); } catch { w = ""; }
    const words = doneWords(p.what, p.said, w, { onRow: rows.some((r) => r.year === p.year) });
    notice = p.putBack ? ui.notice("ok", ui.undoneWords ? ui.undoneWords(p.putBack, words) : words)
      : ui.notice("ok", words, p.undo ? { undo: p.undo, undone: (res) => { pending = { year: p.year, what: p.what === "saved" ? "undoSave" : "undoRemove", said: p.said, before: now, putBack: res }; } } : {});
    noticeYear = p.year;
  }
  let shut = null, openBtn = null;   // shuts the row open now (its panel, its tint, its aria-expanded); that row's button
  /** Close, or Cancel in a form: the year shuts and the finger is back on its row (critic of item 32, P4). */
  const closeYear = () => { const b = openBtn; shut?.(); shut = null; openBtn = null; b?.focus?.(); };
  /** What opens under a year: its own changes with Remove, then "Change this year:" and the chips, a chip's form under them. */
  const panelFor = (r) => {
    const f = factsOf();
    // "Spend less" only while that year's spending can go down (critic of item 32, F2: a cut past it is floored)
    const offers = yearOffers(r, f?.strategy ?? "fixed-real").filter((k) => k !== "less" || !f || lessRoom(f, r.year) >= 1);
    const mine = (marks[r.year] ?? []).map((m) => m.h);
    const panel = ui.h("div", { class: "cf-panel", dataset: { year: String(r.year) } });
    if (mine.length) panel.append(ui.h("ul", { class: "cf-changes" }, mine.map((h) => ui.h("li", { dataset: { key: h.id } },
      ui.h("span", {}, sayOf(h)), ui.button("Remove", () => removeOne(h, r), { class: "secondary small", "aria-label": `Remove: ${sayOf(h)}` })))));
    panel.append(ui.h("p", { class: "small" }, "Change this year:"));
    if (!(r.retired && !drawSets(f?.strategy ?? "fixed-real"))) panel.append(ui.h("p", { class: "muted small" }, r.retired ? WAY_WORDS : BEFORE_WORDS));
    const holder = ui.h("div", {});
    const foot = ui.h("div", {});
    const close = ui.button("Close", closeYear, { class: "secondary small cf-close", "aria-label": `Close ${r.year}` });
    const chips = offers.map((k) => ui.h("button", { type: "button", class: "chip", "aria-expanded": state.kind === k ? "true" : "false", dataset: { change: k }, onClick: () => pick(k) }, CHIP[k]));
    const draw = () => {
      for (const c of chips) c.setAttribute?.("aria-expanded", c.dataset.change === state.kind ? "true" : "false");
      const formOpen = !!state.kind && offers.includes(state.kind);
      holder.replaceChildren?.(...(formOpen ? [ui.h("h3", {}, `In ${r.year}: ${TITLE[state.kind]}`), formFor(state.kind, r, f, closeYear)] : []));
      // one way out at a time: Close while no form is open, the form's own Cancel while one is
      foot.replaceChildren?.(...(formOpen ? [] : [close]));
    };
    const pick = (k) => { state.kind = state.kind === k ? null : k; draw(); };
    panel.append(ui.h("div", { class: "chips", role: "group", "aria-label": "Change this year" }, chips), holder, foot);
    draw();
    return panel;
  };
  /** The form of one change: one or two boxes, Save and Cancel. Save goes through happenings.js as Will the money last? saves. */
  const formFor = (k, r, f, cancel) => {
    const monthHelp = `in today's dollars, for each month of ${r.year}. For example, $500.`;
    const room = k === "less" && f ? lessRoom(f, r.year) : null;
    const FIELDS = {
      more: [{ key: "amount", label: "How much more a month", type: "money", min: 0, max: MONTHLY_CEILING, required: true, help: monthHelp }],
      less: [{ key: "amount", label: "How much less a month", type: "money", min: 0, max: room === null ? MONTHLY_CEILING : Math.min(MONTHLY_CEILING, room), required: true, help: monthHelp }],
      in: [{ key: "name", label: "What it is", type: "text", placeholder: "e.g. An inheritance" },
        { key: "amount", label: "How much", type: "money", min: 0, max: AMOUNT_CEILING, required: true, help: "after any tax, in today's dollars. It goes into savings at the start of the year." }],
      out: [{ key: "name", label: "What it is", type: "text", placeholder: "e.g. A new roof" },
        r.retired ? { key: "amount", label: "How much", type: "money", min: 0, max: AMOUNT_CEILING, required: true, help: "in today's dollars" }
          : { key: "amount", label: "How much comes out of savings", type: "money", min: 0, max: AMOUNT_CEILING, required: true, help: "in today's dollars (your pay is not counted before you retire)" }],
    }[k];
    const form = ui.form(FIELDS, {}, (v) => {
      const rec = yearChange(k, r.year, { id: nextId(plan), amount: v.amount, name: v.name });
      const no = f ? checkHappening(rec, { nowYear: f.nowYear, endYear: f.endYear, people: f.people, accounts: plan.accounts ?? [] }) : { field: "amount", words: "This plan cannot be worked out yet, so nothing was saved." };
      if (no) {
        const box = form.querySelector?.(`[name="${no.field === "monthly" ? "amount" : no.field}"]`);
        if (box) return ui.fieldError(box, no.words);
        form.append(ui.notice("error", no.words));
        return false;
      }
      const p = { year: r.year, what: "saved", said: sayOf(rec), before: answerNow() };
      pending = p;
      state.open = null; state.kind = null;
      // the id is taken from the plan as it is when the change is written, not as this page last drew it: a second tab's new
      // line is never written over (critic of item 32, F3)
      const write = (draft) => { saveHappening(draft, { ...rec, id: nextId(draft) }); };
      if (!ui.undoable) { ctx.store.update(write); return; }
      const undo = ui.undoable(ctx.store, write);
      if (undo) p.undo = undo;
    }, { submitLabel: "Save", onCancel: cancel });
    return form;
  };
  const removeOne = (h, r) => {
    const p = { year: r.year, what: "removed", said: sayOf(h), before: answerNow() };
    pending = p;
    state.open = null; state.kind = null;
    // that one line only, though another has its id (compute.js removeYearChange)
    const write = (draft) => { removeYearChange(draft, h); };
    if (!ui.undoable) { ctx.store.update(write); return; }
    const undo = ui.undoable(ctx.store, write);
    if (undo) p.undo = undo;
  };
  /** A tap on a year: open its panel at `place(panel)` (under the record, or under the table's row), or shut it when open. */
  const toggle = (r, btn, place, item) => {
    const was = state.open;
    shut?.(); shut = null; openBtn = null;
    if (was === r.year) return;
    state.open = r.year; state.kind = null;
    const host = place(panelFor(r));
    btn.setAttribute?.("aria-expanded", "true");
    item?.classList?.add("cf-open");
    openBtn = btn;
    shut = () => { host.remove?.(); btn.setAttribute?.("aria-expanded", "false"); item?.classList?.remove("cf-open"); state.open = null; state.kind = null; };
    ui.reveal?.(host, { block: "nearest" });
  };
  const wideRow = (r, panelOrNode) => ui.h("tr", { class: "rec-form" }, ui.h("td", { colspan: 7 }, panelOrNode));
  // a year's marks: "changed" for those the plan counts, "not counted" (with why) for those it skips (critic of item 32, F1)
  const pillsOf = (list) => [list.some((m) => m.counted) ? ui.h("span", { class: "pill accent cf-mark" }, "changed") : null, list.some((m) => !m.counted) ? ui.h("span", { class: "pill warn cf-mark" }, "not counted") : null].filter(Boolean);

  const yearCell = (r) => {
    const btn = ui.h("button", { type: "button", class: "cf-year", "aria-expanded": wide && state.open === r.year ? "true" : "false", "aria-label": `${r.year}: change this year`,
      onClick: (e) => { const tr = e?.currentTarget?.closest?.("tr") ?? btn.closest?.("tr"); toggle(r, btn, (panel) => { const row = wideRow(r, panel); tr?.after?.(row); return row; }, tr); } }, String(r.year));
    return marks[r.year] ? [btn, ...pillsOf(marks[r.year])] : btn;
  };
  const tableWrap = ui.table([
    { key: "year", label: "Year", render: yearCell }, { key: "age", label: d.people.length > 1 ? "Ages" : "Age", render: (r) => r.ages.join(" / ") },
    { key: "in", label: "In", align: "right", render: (r) => money(r.in.income + r.in.contributions) },
    { key: "spending", label: "Spending", align: "right", render: (r) => money(r.out.spending) },
    { key: "taken", label: "From savings", align: "right", render: (r) => money(taken(r)) },
    { key: "taxes", label: "Tax", align: "right", render: (r) => money(r.out.taxes) },
    { key: "end", label: "Left", align: "right", render: (r) => ui.h("span", { class: r.shortfall && !d.unknown ? "bad" : "" }, money(r.end.total)) },
  ], rows);
  // what is open, and the green line, under the table's row on a wider screen
  if (wide) {
    const trs = tableWrap.querySelector?.("tbody")?.children ?? [];
    const at = (year) => trs[rows.findIndex((r) => r.year === year)] ?? null;
    if (state.open !== null && at(state.open)) {
      const r = rows.find((x) => x.year === state.open), tr = at(state.open), row = wideRow(r, panelFor(r));
      tr.after(row);
      tr.classList?.add("cf-open");
      const btn = tr.querySelector?.(".cf-year");
      openBtn = btn;
      shut = () => { row.remove?.(); btn?.setAttribute?.("aria-expanded", "false"); tr.classList?.remove("cf-open"); state.open = null; state.kind = null; };
    }
    if (notice && at(noticeYear)) { at(noticeYear).after(wideRow(null, notice)); notice = null; }
  }
  const changedRows = rows.filter((r) => marks[r.year]);
  // changes in years with no row of their own: before retirement while Years shows from retirement on, or in the folded
  // "nothing left" years (critic of item 32, F5); counted all the same, so said in one line
  const shown = new Set(rows.map((r) => r.year));
  const hiddenYears = Object.keys(marks).map(Number).filter((y) => !shown.has(y)).sort((a, b) => a - b);
  const byFilter = state.from !== "all" && hiddenYears.some((y) => d.rows.some((r) => r.year === y && !r.retired));
  const hiddenLine = hiddenYears.length ? ui.h("p", { class: "muted small", style: { margin: "0 0 8px" } }, hiddenSaid(hiddenYears.map((y) => marksSaid(marks[y], { money, people, real: state.real })).join("; "), { byFilter, many: hiddenYears.reduce((t, y) => t + marks[y].length, 0) > 1 })) : null;
  const marksLines = (list) => {
    const yes = list.filter((m) => m.counted), no = list.filter((m) => !m.counted);
    return [yes.length ? ui.h("span", { class: "rec-sub" }, ui.h("span", { class: "pill accent cf-mark" }, "changed"), marksSaid(yes, { money, people, real: state.real })) : null,
      ...no.map((m) => ui.h("span", { class: "rec-sub" }, ui.h("span", { class: "pill warn cf-mark" }, "not counted"), `${sayOf(m.h)}. ${m.why}`))];
  };
  const recordOf = (r) => {
    const open = !wide && state.open === r.year;
    const btn = ui.h("button", { type: "button", class: "cf-row", "aria-expanded": open ? "true" : "false", onClick: () => toggle(r, btn, (panel) => { li.append(panel); return panel; }, li) },
      // the bold figure says what it is (stress test 2026-11-11, RB4: "$450,880" with its meaning 3,000 px below)
      ui.h("span", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${d.people.length > 1 ? "ages " + r.ages.join(" and ") : "age " + r.age}`), ui.h("span", { class: `rec-value ${r.shortfall && !d.unknown ? "bad" : ""}` }, `${money(r.end.total)} left`)),
      ui.h("span", { class: "rec-sub" }, r.retired ? `${money(r.out.spending)} spent${r.out.health > 0.5 ? ` (${money(r.out.health)} health insurance)` : ""} · ${money(r.in.income)} guaranteed income${r.in.lines.length ? ` (${r.in.lines.map((l) => l.name).join(", ")})` : ""} · ${money(taken(r))} from savings${r.rmd ? ` (${money(r.rmd)} required)` : ""} · ${money(r.out.taxes)} tax` : `${money(r.in.contributions)} added · growing`),
      r.moves ? ui.h("span", { class: "rec-sub" }, `${r.moves.map((m) => moveSaid(m, money)).join("; ")}.`) : null,
      r.shortfall ? ui.h("span", { class: d.unknown ? "rec-sub" : "rec-sub bad" }, shortWords(money(r.shortfall), { unknown: !!d.unknown })) : null,
      ...(marks[r.year] ? marksLines(marks[r.year]) : []));
    const li = ui.h("li", { class: open ? "cf-open" : "", dataset: { key: `y${r.year}` } }, btn);
    if (notice && noticeYear === r.year) { li.append(notice); notice = null; }
    if (open) { const panel = panelFor(r); li.append(panel); openBtn = btn; shut = () => { panel.remove?.(); btn.setAttribute?.("aria-expanded", "false"); li.classList?.remove("cf-open"); state.open = null; state.kind = null; }; }
    return li;
  };
  const bad = d.unknown ? "" : " bad";   // the red of a year the money does not cover, left out under "we can't say yet" (critic P2)
  const records = ui.h("ul", { class: "records only-narrow" }, rows.map(recordOf),
    // under "we can't say yet" (compute's `unknown`) the years the money does not cover read in the plain colour (critic P2)
    tailRow ? ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: `rec-title${bad}` }, `${tailRow.first} to ${tailRow.last}`), ui.h("span", { class: `rec-value${bad}` }, `${money(0)} left`)), ui.h("div", { class: `rec-sub${bad}` }, shortWords(money(tailRow.short), { unknown: !!d.unknown, every: true }))) : null);
  page.append(ui.card(null,
    // a green line whose year has no row now (the money runs out before it): at the top of the ledger
    notice,
    // how to change a year, first in the ledger (critic of item 32, P2); a chevron on each phone record says it too
    ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, TAP_WORDS),
    hiddenLine,
    ui.h("div", { class: "only-wide" }, tableWrap, tailRow ? ui.h("p", { class: `small${bad}`, style: { margin: "10px 0 0" } }, `${tailRow.first} to ${tailRow.last}: ${shortWords(money(tailRow.short), { unknown: !!d.unknown, every: true })}.`) : null,
      rows.some((r) => r.moves) ? ui.h("p", { class: "muted small", style: { margin: "10px 0 0" } }, rows.filter((r) => r.moves).map((r) => `${r.year}: ${r.moves.map((m) => moveSaid(m, money)).join("; ")}.`).join(" ")) : null,
      changedRows.length ? ui.h("p", { class: "muted small", style: { margin: "10px 0 0" } }, `Your changes: ${changedRows.map((r) => marksSaid(marks[r.year], { money, people, real: state.real })).join("; ")}.`) : null),
    ui.h("p", { class: "muted small", style: { margin: "0 0 8px" } }, `Left: savings at year end. ${orderSaid(d.order, d.split)}`),
    records,
  ));
}
