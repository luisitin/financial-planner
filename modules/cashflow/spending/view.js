// modules/cashflow/spending/view.js -- DOM only. Pick a month; see the total against last
// month, the categories with bars and change, the payees that took the most, the biggest single lines.
import { compute } from "./compute.js";
import { bringWords, theCard, payerWords, shortDate } from "../../transactions/ledger/compute.js";

const state = { month: "", route: null };   // route: the arrival the address's ?month= was last taken from (the Monthly review's link)
const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
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
}
