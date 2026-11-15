// modules/investments/dividends/view.js -- DOM only. The yearly income first, what it covers,
// then each holding's share and the accounts it lands in. One quiet row, "Month by month" (gap next-60 #8), opens to
// this month and the next eleven as a small calendar (each month's amount written, a bar for its size), what came in by
// your transactions, and the yield on what you paid beside today's value.
import { compute } from "./compute.js";
import { withA } from "../../../core/words.js";
import { parts } from "../../../core/ui/more.js";

/** The row's title (pinned in qa/first-view-lib.mjs PINNED_TITLES, with its reason). */
export const MONTHS_TITLE = "Month by month";
const QUARTER_WORDS = "March, June, September and December";
const monthName = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "long" });
const monthYear = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const shortMonth = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "short" });
/** A calendar cell's name: "Nov 2026" on the first month and on each January, else "Dec" (where the year turns is seen). */
export const cellName = (ym, first = false) => (first || String(ym).slice(5, 7) === "01" ? `${shortMonth(ym)} ${String(ym).slice(0, 4)}` : shortMonth(ym));
/** The heading over the months ahead: they start with this month (a payment this month may have come in already). */
export const AHEAD_TITLE = "This month and the next 11";
/** What "yield" means, said once where the two yields are. */
export const YIELD_WORDS = "The yield is what the holdings pay in a year, as a share of the money in them.";

/**
 * monthsFor(cal, money) -> { key, sentence }: the one sentence over the twelve months ahead, written out for each
 * shape compute's shapeOf gives (R5): even, quarters (with or without something in the other months), other (with or
 * without a month of nothing). null for "none" (no row then, unless something came in).
 */
export function monthsFor(cal, money) {
  if (!cal || cal.shape === "none") return null;
  if (cal.shape === "even") return { key: "even", sentence: `About ${money(cal.every)} comes in every month.` };
  if (cal.shape === "quarters") return Math.round(cal.other * 100) > 0
    ? { key: "quarters", sentence: `About ${money(cal.quarter)} comes in each of ${QUARTER_WORDS}, and about ${money(cal.other)} in each of the other months.` }
    : { key: "quartersOnly", sentence: `About ${money(cal.quarter)} comes in each of ${QUARTER_WORDS}, and nothing in the other months.` };
  return cal.zeroAt
    ? { key: "otherGaps", sentence: `The most comes in ${monthName(cal.peak.ym)}, about ${money(cal.peak.amount)}, and nothing in some months, such as ${monthName(cal.zeroAt)}.` }
    : { key: "other", sentence: `The most comes in ${monthName(cal.peak.ym)}, about ${money(cal.peak.amount)}, and the least in ${monthName(cal.low.ym)}, about ${money(cal.low.amount)}.` };
}
/** receivedFor(rec, money) -> { key, sentence }: what the ledger shows came in, for a full year of transactions or fewer months. */
export function receivedFor(rec, money) {
  if (!rec) return null;
  const most = `the most, ${money(rec.peak.amount)}, came in ${monthName(rec.peak.ym)}.`;
  return rec.since
    ? { key: "since", sentence: `Your transactions show ${money(rec.total)} of dividends and interest since ${monthYear(rec.since)}; ${most}` }
    : { key: "year", sentence: `Your transactions show ${money(rec.total)} of dividends and interest in the last 12 months; ${most}` };
}
/** yieldsFor(y, pct) -> { key, sentence }: what the two yields side by side say, one whole sentence per case, with both figures. */
export function yieldsFor(y, pct = (x) => `${(Number(x) * 100).toFixed(2)}%`) {
  if (!y) return null;
  if (y.case === "noCost") return { key: "noCost", sentence: "Type what you paid for each holding on Holdings to see the yield on what you paid." };
  const paid = pct(y.onCost), today = pct(y.onValue);
  return {
    same: { key: "same", sentence: `You get about ${today} a year both on what you paid and on what the holdings are worth today, because they are worth about what you paid.` },
    grown: { key: "grown", sentence: `You get ${paid} a year on what you paid, but only ${today} on what the holdings are worth today, because they have grown since you bought them.` },
    fallen: { key: "fallen", sentence: `You get ${paid} a year on what you paid, and ${today} on what the holdings are worth today, because they are worth less now than you paid.` },
  }[y.case] ?? null;
}
/** priceFirst(symbols) -> the one next step when the holdings are worth $0 (no price and no cost typed): nothing to work out yet. */
export function priceFirst(symbols) {
  const s = (symbols ?? []).map((x) => String(x || "").trim() || "a holding");
  if (s.length === 1) return `Add the price of ${s[0]} (or what you paid for it) on Holdings, and this page works out what it pays each year.`;
  if (s.length === 2) return `Add the prices of ${s[0]} and ${s[1]} (or what you paid for them) on Holdings, and this page works out what they pay each year.`;
  return `Add the prices of your ${s.length} holdings (or what you paid for them) on Holdings, and this page works out what they pay each year.`;
}
/** statusFor(cal, money) -> the row's status (at most 20 characters): the month the most comes in, or what came in. */
export function statusFor(cal, money) {
  if (!cal) return "";
  if (cal.shape === "even") return "the same each month";
  if (cal.shape !== "none") return `most in ${monthName(cal.peak.ym)}`;
  return cal.received ? `${money(cal.received.total)} came in` : "";
}
/** The assumption the spread rests on, said under the months. */
export const SPREAD_WORDS = "Each holding's yearly amount is spread over the months it usually pays: every month for bond funds and cash, every three months for the rest, in March, June, September and December. A fund's own months may differ: set how often one pays on Holdings, under More details (optional).";

// twelve months as a small calendar, three to a row (so March, June, September and December fall in one column): each
// cell writes its month and its amount, and a bar under them shows its size beside the biggest month. No hover and no
// tap needed to read a figure (design log 2026-09-16: no unlabeled bars). No chart library; colours from the page's
// variables, so dark mode works; inline styles on the page's own elements (no new global CSS).
function monthGrid(ui, months, money, label) {
  const top = Math.max(0, ...months.map((m) => m.amount));
  return ui.h("ul", { "aria-label": label, dataset: { months: "" }, style: { listStyle: "none", padding: "0", margin: "2px 0 0", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px 14px" } },
    months.map((m, i) => {
      const some = m.amount > 0.005 && top > 0;
      return ui.h("li", { style: { margin: "0", padding: "0", minWidth: "0", lineHeight: "1.3" } },
        ui.h("div", { class: "muted small" }, cellName(m.ym, i === 0)),
        ui.h("div", { style: { fontWeight: some ? "600" : "400", color: some ? "var(--text)" : "var(--muted)", overflowWrap: "anywhere" } }, some ? money(m.amount) : "nothing"),
        ui.h("div", { "aria-hidden": "true", style: { height: "5px", marginTop: "3px", borderRadius: "3px", background: "var(--line)", overflow: "hidden" } },
          some ? ui.h("div", { style: { height: "100%", width: `${Math.max(4, (m.amount / top) * 100)}%`, background: "var(--accent)", borderRadius: "3px" } }) : null));
    }));
}

/** The "Month by month" row: null when there is nothing to spread and nothing came in. */
export function monthsPart(ctx, d, money) {
  const { ui, fmt } = ctx;
  const cal = d.calendar;
  if (!cal) return null;
  const ahead = monthsFor(cal, money), came = receivedFor(cal.received, money);
  if (!ahead && !came) return null;
  const y = d.ready && ahead ? cal.yields : null;
  const said = yieldsFor(y, (x) => fmt.pct(x, 2));
  const row = (title, value, sub) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, title), ui.h("span", { class: "rec-value" }, value)), sub ? ui.h("div", { class: "rec-sub" }, sub) : null);
  return { id: "months", kind: "more", title: MONTHS_TITLE, says: statusFor(cal, money), body: () => [
    ahead ? ui.h("h3", {}, AHEAD_TITLE) : null,
    ahead ? ui.h("p", {}, ahead.sentence) : null,
    ahead ? monthGrid(ui, cal.months, money, "Dividends and interest expected each month") : null,
    ahead ? ui.h("p", { class: "muted small" }, SPREAD_WORDS) : null,
    came ? ui.h("h3", {}, "What came in") : null,
    came ? ui.h("p", {}, came.sentence) : null,
    // (with fewer than twelve months of transactions, only the months since the first: before it, "nothing" would mislead)
    came ? monthGrid(ui, cal.received.since ? cal.received.months.filter((m) => m.ym >= cal.received.since) : cal.received.months, money, "Dividends and interest that came in each month") : null,
    y ? ui.h("h3", {}, "Yield") : null,
    y ? ui.h("p", { class: "muted small" }, YIELD_WORDS) : null,
    y ? ui.h("ul", { class: "records" },
      row("On what you paid", y.onCost === null ? "not known yet" : fmt.pct(y.onCost, 2), y.onCost === null ? "type what you paid on Holdings" : `${money(y.income)} a year on ${money(y.cost)} paid`),
      row("On today's value", fmt.pct(y.onValue, 2), `${money(y.income)} a year on ${money(y.value)} today`)) : null,
    said ? ui.h("p", {}, said.sentence) : null,
    y && y.counted > 0 && y.counted < y.all ? ui.h("p", { class: "muted small" }, `Counted: the ${y.counted} of ${y.all} holdings with what you paid on file.`) : null,
  ] };
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), calendar: true });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Dividends and interest"), ui.h("p", { class: "lede" }, "What your holdings pay out each year, by fund and by account, and how much of your spending it covers. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    // no holdings yet, but transactions filed as dividends: what came in, one tap away
    const later = parts(ctx, monthsPart(ctx, d, money));
    if (later) root.append(later);
    return;
  }
  // holdings, but worth $0 (no price and no cost typed): the one next step instead of a page of zeros
  if (!(d.portfolio > 0)) {
    const unpriced = d.items.filter((x) => !(x.value > 0));
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Dividends and interest"), ui.h("p", { class: "lede" }, priceFirst((unpriced.length ? unpriced : d.items).map((x) => x.symbol))), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Open Holdings"))));
    const later = parts(ctx, monthsPart(ctx, d, money));
    if (later) root.append(later);
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `About ${money(d.total)} a year in dividends and interest`),
    ui.h("p", { class: "lede" }, `${money(d.monthly)} a month, ${withA(fmt.pct(d.yieldOverall, 2))} yield on ${money(d.portfolio)}.${d.coversShare !== null ? ` That covers ${fmt.pct(d.coversShare, 0)} of your monthly spending.` : ""}${d.sheltered > 0 ? ` ${money(d.sheltered)} of it grows untaxed inside retirement accounts.` : ""}`),
    ui.h("p", { class: "muted small" }, "Yields are typical figures for each fund's class unless you typed the fund's own; distributions vary quarter to quarter. Income you reinvest still counts as income, and is still taxed in a taxable account."),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("A year", money(d.total), `${fmt.pct(d.yieldOverall, 2)} yield`),
    ui.stat("A month", money(d.monthly), d.coversShare !== null ? `${fmt.pct(d.coversShare, 0)} of spending` : ""),
    ui.stat("In taxable accounts", money(d.taxable), "taxed each year"),
    ui.stat("Sheltered", money(d.sheltered), "401(k), IRA, Roth, HSA"),
  )));
  const months = parts(ctx, monthsPart(ctx, d, money));
  if (months) root.append(months);
  root.append(ui.card("By holding",
    ui.h("ul", { class: "records" }, d.items.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.symbol), ui.h("span", { class: "rec-value" }, x.known ? `${money(x.income)} a year` : "yield unknown")),
      ui.h("div", { class: "rec-sub" }, `${x.name ? `${x.name} · ` : ""}${x.account} · ${money(x.value)}${x.known ? ` at ${fmt.pct(x.yield, 2)}` : ""}`)))),
  ));
  if (d.byAccount.length > 1) root.append(ui.card("By account",
    ui.h("ul", { class: "records" }, d.byAccount.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.name), ui.h("span", { class: "rec-value" }, `${money(a.income)} a year`))))),
  ));
}
