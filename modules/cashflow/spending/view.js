// modules/cashflow/spending/view.js -- DOM only. Pick a month; see the total against last
// month, the categories with bars and change, the payees that took the most, the biggest single lines.
// Gap #13 (2026-11-13): a category that went up over the last twelve whole months is one amber line (at most two), a shop or
// category the person watches is one line; the twelve months and the watch list are two quiet parts at the foot (core/ui/more.js).
// Gap #24 (2026-11-14): with a tag on any line, a third quiet part, "Tags", says what each tag came to.
import { compute, tagWords, tagAllWords, tagAllLink, watchChoices, watchesOf, samePayee, MAX_WATCH, JUMP_SHARE, JUMP_MONTHLY } from "./compute.js";
import { bringWords, theCard, payerWords, shortDate, monthLabel } from "../../transactions/ledger/compute.js";
import { part, parts } from "../../../core/ui/more.js";

const state = { month: "", route: null };   // route: the arrival the address's ?month= was last taken from (the Monthly review's link)
let pending = null;   // { part, text }: the green line after a save, drawn on the next draw inside the part saved in (R17)
const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const said = pending;
  pending = null;
  // opened from the Monthly review with ?month=2026-10: that month, until a month is picked here
  const qm = /^\d{4}-\d{2}$/.test(ctx.route?.query?.month ?? "") ? ctx.route.query.month : null;
  // each arrival (a new route; a redraw after a save keeps the same one) takes the address's month; a month picked here stays
  if (qm && ctx.route !== state.route) state.month = qm;
  state.route = ctx.route;
  const d = compute(plan, { month: state.month, today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Where the money goes"),
      ui.h("p", { class: "lede" }, "Spending by category, by payee and against last month, from your real transactions. Import a bank file and this page fills in."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }
  // a month the bank file only partly covers (downloaded mid-month) says so, and is compared with the same days of the month before
  const mon = (label) => label.slice(0, 3);
  const span = (label, a, b) => (a === b ? `${mon(label)} ${a}` : `${mon(label)} ${a} to ${b}`);
  const monthSel = ui.select(d.months.map((m) => ({ value: m.ym, label: m.cardOnly ? `${m.label} (card purchases not all in)` : m.holes ? `${m.label} (some days missing)` : m.full || !m.firstDay ? m.label : `${m.label} (${m.firstDay === 1 ? `to the ${ord(m.lastDay)}` : `from the ${ord(m.firstDay)}`})` })), d.month, { "aria-label": "Month", onChange: (e) => { state.month = e.target.value; root.innerHTML = ""; render(root, ctx); } });
  const today = fmt.today();
  const prevLabel = d.previous?.label ?? "";
  const coverNote = !d.cover ? null
    : !d.cover.full && d.cover.to === today ? `So far this month: ${span(d.label, d.cover.firstDay, d.cover.lastDay)}.${d.sameDays && d.previous ? ` Compared with ${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}.` : ""}`
    : !d.cover.full ? `Your bank file covers ${span(d.label, d.cover.firstDay, d.cover.lastDay)} only (it ${d.cover.firstDay > 1 ? `starts on ${fmt.date(d.cover.from)}` : `stops on ${fmt.date(d.cover.to)}`}).${d.sameDays && d.previous ? ` Compared with ${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}, the same days.` : d.noOverlap ? " Last month's days in the file are not the same days, so there is no change to show." : ""} Import a longer file to see the whole month.`
    : d.sameDays && d.previous ? `Your bank file starts partway through ${prevLabel}, so this month is compared on the same days: ${span(d.label, d.sameDays.lo, d.sameDays.hi)} against ${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}.`
    : null;
  // days an account's files miss in the month (a gap between two files, lines that stop early or start late): the total
  // leaves out whatever happened then (2026-11-02)
  // a payment that went to one of two cards and is counted for neither is its own sentence, not "days" (re-check 4)
  const issues = (d.issues ?? []).filter((x) => x.kind !== "unsure"), unsure = (d.issues ?? []).find((x) => x.kind === "unsure") ?? null;
  const nameOf = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? "that account";
  // a card's payment dated before its file starts counts in place of what it bought then (ledger cardPayments): said, so the
  // total is not read as leaving those days out (re-check 2026-11-02); a card with no lines at all this month says it below
  const before = d.byCategory.filter((c) => c.unimported && c.before);
  const beforeSay = before.filter((c) => !d.cards.some((x) => x.accountId === c.cardId)).map((c) => `What was paid to ${theCard(nameOf(c.cardId))} before its file starts${c.first ? ` on ${shortDate(c.first)}` : ""} (${fmt.money(c.total, cur)}) counts below as one line in place of what it bought then.`).join(" ");
  const holeNote = issues.length ? `${issues.slice(0, 2).map((x) => x.text).join(" ")}${beforeSay ? ` ${beforeSay}` : ""} Until then, ${d.label}'s total leaves out ${beforeSay ? "anything else" : "whatever happened"} on those days.` : null;
  const bring = [...new Set(issues.slice(0, 2).map((x) => x.accountId))];
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Month", monthSel)), coverNote ? ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, coverNote) : null,
    holeNote ? ui.h("p", { class: "small", style: { marginTop: "10px" } }, holeNote) : null,
    holeNote ? ui.row(...bring.map((id) => ui.h("a", { class: "btn secondary", href: `#/transactions/import?accountId=${encodeURIComponent(id)}` }, bringWords(nameOf(id)).replace(/\.$/, "")))) : null,
    unsure ? ui.h("p", { class: "small", style: { marginTop: "10px" } }, `${unsure.text} Until then, ${d.label}'s total leaves it out.`) : null,
    unsure ? ui.row(...(unsure.cardIds ?? []).slice(0, 2).map((id) => ui.h("a", { class: "btn secondary", href: `#/transactions/import?accountId=${encodeURIComponent(id)}` }, bringWords(nameOf(id)).replace(/\.$/, "")))) : null));
  // a card whose own file is missing this month: what went to it counts as one line, until its file is in (2026-11-02)
  const paidCards = d.cards.filter((c) => c.paid > 0);
  if (paidCards.length) root.append(ui.h("section", { class: "card sp-cards" },
    ui.h("h2", {}, paidCards.length === 1 ? `${paidCards[0].name}'s purchases aren't in yet` : "Some cards' purchases aren't in yet"),
    // paid before the card's first line ever: "before its file starts on 8/1" (re-check 4, 2026-11-02)
    ...paidCards.map((c) => ui.h("p", {}, `${fmt.money(c.paid, cur)} went to ${theCard(c.name)} from ${payerWords(plan, c.from)} in ${new Date(Number(d.month.slice(0, 4)), Number(d.month.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "long" })}${c.before && c.first ? `, before its file starts on ${shortDate(c.first)}, so that money counts below as one line instead of what you bought then.` : `. Its own file isn't in, so that money counts below as one line instead of what you bought.`}`)),
    ui.row(...paidCards.slice(0, 2).map((c, i) => ui.h("a", { class: i ? "btn secondary" : "btn", href: `#/transactions/import?accountId=${encodeURIComponent(c.accountId)}` }, bringWords(c.name).replace(/\.$/, ""))))));
  root.append(ui.card(null, ui.row(
    ui.stat(`Spent in ${d.label}`, fmt.money(d.total, cur), `${d.count} transaction${d.count === 1 ? "" : "s"}${d.cover && !d.cover.full ? `, ${span(d.label, d.cover.firstDay, d.cover.lastDay)} only` : ""}`),
    // a month whose files miss some days is not compared (the change would be those days): last month's total, and why
    d.previous && d.cmpGap ? ui.stat(`Spent in ${d.previous.label}`, fmt.money(d.previous.total, cur), `not compared: ${d.cmpGap.ym === d.month ? "this month's" : `${mon(prevLabel)}'s`} ${d.cmpGap.card ? "card purchases aren't all in" : "files miss some days"}`)
    : d.previous ? ui.stat(d.change !== null && d.change > 0 ? "More than last month" : "Less than last month", d.change === null ? "-" : fmt.pct(Math.abs(d.change), 0), d.sameDays ? `${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}: ${fmt.money(d.previous.total, cur)}` : `${d.previous.label}: ${fmt.money(d.previous.total, cur)}`) : null,
    ui.stat("A day on average", fmt.money(d.perDay, cur), d.cover && !d.cover.full ? `over the ${d.cover.days} day${d.cover.days === 1 ? "" : "s"} in your bank file` : "over the whole month"),
  )));
  root.append(...yearAndWatchLines(ctx, d));
  root.append(ui.card("By category",
    ui.h("ul", { class: "page-list" }, d.byCategory.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" }, onClick: () => (c.unimported ? ctx.go("transactions", "import", [], { accountId: c.cardId }) : ctx.go("transactions", "ledger", ["month", d.month], { category: c.category || "none" })) },
      ui.h("span", { class: "ic" }, c.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label, c.unimported ? ui.h("span", { class: "pill warn" }, before.includes(c) ? "before its file" : "file not in") : c.category ? null : ui.h("span", { class: "pill warn" }, "unfiled")),
        ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.round(c.share * 100)}%` } })),
        ui.h("div", { class: "d" }, c.unimported ? `${fmt.pct(c.share, 0)} · ${c.count === 1 ? "one payment" : `${c.count} payments`} to the card${before.includes(c) ? " before its file starts · tap to bring in the days before" : " · tap to bring in its file"}` : `${fmt.pct(c.share, 0)} · ${c.count} transaction${c.count === 1 ? "" : "s"}${c.change !== null ? ` · ${c.change >= 0 ? "up" : "down"} ${fmt.pct(Math.abs(c.change), 0)} ${d.sameDays ? `on the same days of ${mon(prevLabel)}` : `from ${d.previous?.label ?? "last month"}`}` : c.previous === 0 && d.previous && !d.cmpGap ? (d.sameDays ? ` · none on the same days of ${mon(prevLabel)}` : " · new this month") : ""}`)),
      ui.h("span", { class: "st" }, fmt.money(c.total, cur))))),
  ));
  root.append(ui.row(
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Who got the most"),
      ui.h("ul", { class: "page-list" }, d.topPayees.map((p) => ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, p.payee), ui.h("div", { class: "d" }, `${p.count} transaction${p.count === 1 ? "" : "s"}`)), ui.h("span", { class: "st" }, fmt.money(p.total, cur)))))),
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Biggest single lines"),
      ui.h("ul", { class: "page-list" }, d.biggest.map((t) => ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · ${t.categoryLabel}`)), ui.h("span", { class: "st" }, fmt.money(Math.abs(Number(t.amount)), cur, undefined, 2)))))),
  ));
  // gap #13: the twelve months and the watch list, one tap away
  // gap #24: what each tag came to, one tap away (only when a line carries a tag). Listed in the order the screen shows
  // them: parts() puts a part with the person's own choices ("Watch") before a plain list ("Tags").
  root.append(ui.h("div", {}, parts(ctx, yearPart(ctx, d), watchPart(ctx, d, said), tagsPart(ctx, d))));
}

// ---------------------------------------------------------------- gap #13: a category over twelve months; watch one shop or category
const mon3 = (ym) => monthLabel(ym).slice(0, 3);
/** "Aug to Oct": the last 3 of the twelve whole months. */
const latelyWords = (y) => `${mon3(y.lately[y.lately.length - 1])} to ${mon3(y.lately[0])}`;
/** The one amber line for a category that went up (design #13; the figures of "N more categories over 12 months"). */
function jumpLine(y, r, money) {
  return `${r.label}: ${money(r.recent)} a month from ${latelyWords(y)}, ${money(r.average)} a month over the year (up ${Math.round(r.up * 100)}%).`;
}
/** When the page's month is: "in Oct 2026", "in Nov 2026 so far", "in Oct 2026, Oct 1 to 9 only". */
function whenWords(d, today) {
  if (!d.cover || d.cover.full) return `in ${d.label}`;
  if (d.cover.to === today) return `in ${d.label} so far`;
  const m = d.label.slice(0, 3);
  return `in ${d.label}, ${d.cover.firstDay === d.cover.lastDay ? `${m} ${d.cover.firstDay}` : `${m} ${d.cover.firstDay} to ${d.cover.lastDay}`} only`;
}
/** The watched lines with their names: a category's label from the result, a shop's name from the plan (compute leaves it out). */
const watchedOf = (plan, d) => { const list = watchesOf(plan); return (d.watch ?? []).map((w) => ({ ...w, key: list[w.at]?.key, label: w.label ?? list[w.at]?.key ?? "" })); };
/** The amber lines and the watched lines: on the first view, right under the month's figures. */
function yearAndWatchLines(ctx, d) {
  const { ui, fmt, plan } = ctx, cur = plan.meta.currency, money = (x) => fmt.money(x, cur);
  const out = [];
  if (d.year) for (const r of d.year.jumps) out.push(ui.notice("warn", jumpLine(d.year, r, money)));
  const watched = watchedOf(plan, d);
  if (watched.length) {
    const when = whenWords(d, fmt.today());
    out.push(ui.card("What you watch", ui.h("ul", { class: "page-list" }, watched.map((w) => ui.h("li", {},
      ui.h("span", { class: "ic" }, w.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, w.label),
        ui.h("div", { class: "d" }, `${w.count ? `${w.count} time${w.count === 1 ? "" : "s"} ${when}` : `Nothing ${when}`}${w.usual === null ? "" : w.usual > 0.005 ? ` · ${money(w.usual)} a month over the year` : " · nothing over the year"}`)),
      ui.h("span", { class: "st" }, w.count ? money(w.total) : "None"))))));
  }
  return out;
}
/** "N more categories over 12 months": each category's average month and its last 3 months' average, and how a line is marked. */
function yearPart(ctx, d) {
  const y = d.year;
  if (!y || !y.rows.length) return null;
  const { ui, fmt, plan } = ctx, cur = plan.meta.currency, money = (x) => fmt.money(x, cur);
  const late = latelyWords(y);
  const change = (r) => (r.before <= 0.005 && r.recent > 0.005 ? "none before" : Math.abs(r.up ?? 0) < 0.005 ? "no change" : `${r.up > 0 ? "up" : "down"} ${Math.round(Math.abs(r.up) * 100)}%`);
  return { id: "year", kind: "more", n: y.rows.length, noun: "categories over 12 months", one: "category over 12 months",
    says: `${monthLabel(y.from)} to ${monthLabel(y.to)}`, lazy: y.rows.length > 40, body: () => [
      ui.h("p", { class: "muted small" }, `The 12 most recent whole months in your bank files: ${monthLabel(y.from)} to ${monthLabel(y.to)}.${y.left ? ` ${y.left === 1 ? "One month in between is" : `${y.left} months in between are`} left out: some days are missing, or a card's purchases are not in.` : ""}`),
      ui.h("ul", { class: "records" }, y.rows.map((r) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.label), ui.h("span", { class: "rec-value" }, `${money(r.average)} a month`)),
        ui.h("div", { class: "rec-sub" }, `${money(r.recent)} a month from ${late} · ${change(r)}`, r.jump ? " " : null, r.jump ? ui.h("span", { class: "pill warn" }, "going up") : null)))),
      ui.h("p", { class: "muted small" }, `A category is marked when ${late} is at least ${Math.round(JUMP_SHARE * 100)}% and ${money(JUMP_MONTHLY)} a month above the 9 months before.`),
    ] };
}
/** "Tags": what each tag came to in the month shown and in all; a row opens its lines in the Ledger. */
function tagsPart(ctx, d) {
  const tags = d.tags ?? [];
  if (!tags.length) return null;
  const { ui, fmt, plan } = ctx, cur = plan.meta.currency, money = (x) => fmt.money(x, cur);
  return { id: "tags", kind: "item", title: "Tags", says: `${tags.length}`, lazy: tags.length > 40, body: () => [
    ui.h("ul", { class: "page-list" }, tags.map((t) => ui.h("li", {}, ui.h("a", { class: "row-link", href: `#/transactions/ledger/month/${t.count ? d.month : t.last}?q=${encodeURIComponent(`#${t.tag}`)}`, "aria-label": `${tagWords(t, d.label, money)}. See the lines.` },
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, tagWords(t, d.label, money)), ui.h("div", { class: "d" }, tagAllWords(t, d.month, money))),
      ui.h("span", { "aria-hidden": "true", style: { color: "var(--muted)", fontSize: "22px", lineHeight: "1", alignSelf: "center" } }, "›")),
      // the line under says what the tag came to in all: one tap shows those purchases too, in every month
      tagAllLink(t) ? ui.h("a", { style: { display: "flex", alignItems: "center", minHeight: "44px", fontSize: "var(--fs-sm)" }, href: `#/transactions/ledger/all?q=${encodeURIComponent(`#${t.tag}`)}`, "aria-label": `#${t.tag}: ${tagAllLink(t).toLowerCase()}` }, tagAllLink(t)) : null))),
    ui.h("p", { class: "muted small" }, "Money out only, refunds taken off. A purchase with two tags counts under each, so the tags do not add up to the month. To tag a purchase, tap it in the Ledger and open More details."),
  ] };
}
/** "Watch a shop or category": what is watched, each with Stop watching, then one box to pick another (at most MAX_WATCH). */
function watchPart(ctx, d, said) {
  const { ui, fmt, plan, store } = ctx, cur = plan.meta.currency, money = (x) => fmt.money(x, cur);
  const watched = watchedOf(plan, d);
  const when = whenWords(d, fmt.today());
  const same = (w) => (x) => !!x && x.kind === w.kind && (w.kind === "payee" ? samePayee(x.key, w.key) : x.key === w.key);
  const stop = (w) => {
    pending = { part: "watch", text: `Done. You no longer watch ${w.label}.` };
    store.update((p) => { const left = (Array.isArray(p.spendingWatch) ? p.spendingWatch : []).filter((x) => !same(w)(x)); if (left.length) p.spendingWatch = left; else delete p.spendingWatch; });
  };
  const save = (v) => {
    const s = String(v.what ?? ""), i = s.indexOf(":");
    // nothing picked: held at the box with the page's own words (the kit opens the part around it); the box is not
    // `required`, since a required box is never folded (docs/OPTIONAL.md R9 item 9) and this one is asked only here
    if (i < 1) return ui.fieldError(pick?.querySelector?.('[name="what"]'), "Pick a shop or a category first.");
    const w = { kind: s.slice(0, i), key: s.slice(i + 1) };
    // the green line names what the new line says (R7): the month's total there, worked out before the save
    const now = compute({ ...plan, spendingWatch: [w] }, { month: d.month, today: fmt.today() }).watch?.[0];
    const name = now?.label ?? w.key;
    pending = { part: "watch", text: now?.count ? `Saved. You now watch ${name}: ${money(now.total)} ${when}.` : `Saved. You now watch ${name}: nothing ${when}.` };
    store.update((p) => { p.spendingWatch = [...(Array.isArray(p.spendingWatch) ? p.spendingWatch : []), w]; });
  };
  let pick = null;
  if (watched.length < MAX_WATCH) {
    const ch = watchChoices(plan);
    pick = ui.form([{ key: "what", label: "What to watch", type: "select",
      options: [{ value: "", label: "Pick a shop or a category" }, ...ch.payees.map((x) => ({ value: `payee:${x.key}`, label: `Shop: ${x.key}` })), ...ch.categories.map((c) => ({ value: `category:${c.key}`, label: `Category: ${c.label}` }))] }],
    {}, save, { submitLabel: "Watch it" });
  }
  return { id: "watch", kind: "own", title: "Watch a shop or category", set: watched.length, holds: ["what"], open: said?.part === "watch", body: [
    said?.part === "watch" ? ui.notice("ok", said.text) : null,
    ui.h("p", { class: "small" }, "Pick a shop or a category to keep an eye on: its total for the month shows near the top of this page."),
    watched.length ? ui.h("ul", { class: "records" }, watched.map((w) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, w.label), ui.h("span", { class: "rec-value" }, w.count ? money(w.total) : "None")),
      ui.h("div", { class: "rec-sub" }, `${w.kind === "payee" ? "A shop" : "A category"} · ${w.count ? `${w.count} time${w.count === 1 ? "" : "s"}` : "nothing"} ${when}`),
      ui.h("div", { class: "rec-foot" }, ui.button("Stop watching", () => stop(w), { class: "secondary", "aria-label": `Stop watching ${w.label}` }))))) : null,
    pick ?? ui.h("p", { class: "small" }, `You watch ${MAX_WATCH} things, the most this page shows. Stop watching one to pick another.`),
  ] };
}
