// modules/cashflow/income-statement/view.js -- DOM only. Totals, the plan-vs-real comparison,
// a month-by-month list with bars, and the categories behind the numbers.
import { compute } from "./compute.js";
import { monthsWords, theCard, bringWords } from "../../transactions/ledger/compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { months: 12, today: fmt.today() });
  // what the plan keeps each month is the figure the Dashboard shows (after tax, spending and saving), never pay before tax minus spending
  const nba = d.planned ? ctx.computeOf?.("overview/next-best-action", { today: fmt.today() }) : null;
  // one sentence that adds up: in - tax - spending - saving = left (all Next best action's own figures, the Dashboard's). It names
  // the tax rather than an "after tax" amount, which would sit next to the Income page's take-home (that one also takes out the
  // 401(k) and health cover) and read as a second figure for the same thing. Every line Next best action takes off the month is
  // named (review 2026-11-02: state tax, business costs, the extra on debts and the side income held back were missing, so the
  // words did not add up to the figure, and with "count on" the sign flipped).
  const plannedLine = () => {
    if (!nba?.ready) return `From the Income and Expenses pages: ${fmt.money(d.planned.in, cur)} a month comes in before tax and ${fmt.money(d.planned.out, cur)} goes out.`;
    const s = nba.spare, tax = s.federalTax + s.payrollTax + (s.stateTax ?? 0), saving = s.retirementSaving + s.goalSaving;
    const parts = [(s.businessCosts ?? 0) >= 1 ? [s.businessCosts, "business costs"] : null, tax >= 1 ? [tax, "tax"] : null, [s.spending, "spending"], saving >= 1 ? [saving, "saving"] : null,
      (s.debtExtra ?? 0) >= 1 ? [s.debtExtra, "extra on debts"] : null].filter(Boolean).map(([v, w], i) => `${fmt.money(v, cur)}${i ? "" : " goes"} to ${w}`);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    const held = (s.held ?? 0) >= 1 ? `, and ${fmt.money(s.held, cur)} of side income above what you count on (after its tax) is kept as a bonus to save when it comes` : "";
    return `From the Income and Expenses pages: ${fmt.money(s.gross, cur)} a month comes in before tax; about ${list}${held}, so about ${fmt.money(Math.abs(s.monthly), cur)} a month is ${s.monthly >= 0 ? "left" : "short"}.`;
  };

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Income statement"),
      ui.h("p", { class: "lede" }, "What came in, what went out and what you kept, month by month, from your real transactions. It fills in as soon as a bank file is imported."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file")),
      d.planned ? ui.h("p", { class: "muted small" }, plannedLine()) : null,
    ));
    return;
  }
  const latest = d.rows[0];
  // the months left out of the typical month, and why: "July and August 2026 are left out: Chase checking has no lines from
  // 7/31 to 8/2." (re-check 2026-11-02: "from 2 full months" never said which, or why)
  const withYear = (yms) => { const ys = new Set(yms.map((m) => m.slice(0, 4))); return `${monthsWords(yms)}${ys.size === 1 ? ` ${[...ys][0]}` : ""}`; };
  // with no whole month at all, the same sentences say why there is no typical month yet (re-check 4, 2026-11-02)
  const leftNote = (d.leftOut ?? []).length ? `${d.average ? "" : "There is no typical month yet. "}${(d.leftOut ?? []).slice(0, 2).map((g) => `${withYear(g.yms)} ${g.yms.length > 1 ? "are" : "is"} left out${d.average ? " of the typical month" : ""}: ${g.why}.`).join(" ")}` : null;
  root.append(ui.card(null, ui.row(
    ui.stat("Came in", fmt.money(d.totals.in, cur), `over ${d.rows.length} month${d.rows.length === 1 ? "" : "s"}`),
    ui.stat("Went out", fmt.money(d.totals.out, cur), "transfers not counted"),
    ui.stat(d.totals.net >= 0 ? "Kept" : "Short", fmt.money(Math.abs(d.totals.net), cur), d.totals.rate !== null ? `${fmt.pct(d.totals.rate, 0)} of what came in` : null),
    d.average ? ui.stat("A typical month", fmt.money(d.average.net, cur), `kept, from ${d.average.months} full month${d.average.months === 1 ? "" : "s"}: ${fmt.money(d.average.in, cur)} in, ${fmt.money(d.average.out, cur)} out`) : null,
  ), leftNote ? ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, leftNote) : null));
  if (d.planned && d.average) {
    const diffIn = d.inGap ?? (d.average.in - d.planned.takeHomeIn), diffOut = d.average.out - d.planned.out;
    const inSays = d.planned.takeHome ? `Income page says ${fmt.money(d.planned.in, cur)} a month before tax, about ${fmt.money(d.planned.takeHomeIn, cur)} after tax; the bank shows ${fmt.money(d.average.in, cur)}` : `Income page says ${fmt.money(d.planned.in, cur)} a month; the bank shows ${fmt.money(d.average.in, cur)}`;
    // what went to a card whose own file isn't in is in the bank's figure as its payments: named, and when it is most of the
    // gap, the move is to bring in the card's file, not to look for an expense never listed (re-check 2026-11-02)
    const cardsBy = (d.average.cardsBy ?? []).filter((c) => c.monthly >= 1);
    const cardPart = cardsBy.length ? `, of which ${cardsBy.map((c) => `${fmt.money(c.monthly, cur)} went to ${theCard(c.name)}`).join(" and ")}, whose file isn't in` : "";
    const cardsGap = cardsBy.length && diffOut > 50 && diffOut - (d.average.cards ?? 0) <= 50;
    const outNote = cardsGap ? `Most of the gap in money out is what went to ${cardsBy.length === 1 ? theCard(cardsBy[0].name) : "your cards"}: what it bought isn't in yet. ${bringWords(cardsBy[0].name)} Then compare again before adding anything to Expenses.`
      : "A big gap in money out usually means an expense that was never listed.";
    root.append(ui.card("Plan versus real",
      ui.h("ul", { class: "page-list" },
        ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, "Money in"), ui.h("div", { class: "d" }, inSays)), ui.h("span", { class: `st ${d.inShort ? "bad" : ""}` }, `${diffIn >= 0 ? "+" : "-"}${fmt.money(Math.abs(diffIn), cur)}`)),
        ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, "Money out"), ui.h("div", { class: "d" }, `Expenses page says ${fmt.money(d.planned.out, cur)} a month; the bank shows ${fmt.money(d.average.out, cur)}${cardPart}`)), ui.h("span", { class: `st ${diffOut > 50 && !cardsGap ? "bad" : ""}` }, `${diffOut >= 0 ? "+" : "-"}${fmt.money(Math.abs(diffOut), cur)}`)),
      ),
      ui.h("p", { class: "muted small" }, d.planned.takeHome
        ? `Pay is typed before tax and the bank sees it after tax, so money in is compared after tax (from the Paycheck page). A month with a third paycheck shows more. ${outNote}`
        : cardsGap ? outNote : "A big gap usually means an expense that was never listed, or income the pages do not know about."),
      cardsGap ? ui.row(ui.h("a", { class: "btn secondary", href: `#/transactions/import?accountId=${encodeURIComponent(cardsBy[0].cardId)}` }, bringWords(cardsBy[0].name).replace(/\.$/, ""))) : null,
    ));
  }
  const maxBar = Math.max(1, ...d.rows.map((r) => Math.max(r.in, r.out)));
  root.append(ui.card("Month by month",
    ui.h("ul", { class: "page-list" }, d.rows.map((r) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", alignItems: "flex-start" }, onClick: () => ctx.go("transactions", "ledger", ["month", r.ym]) },
      ui.h("span", { class: "body" },
        ui.h("div", { class: "t" }, r.label, r.complete ? null : ui.h("span", { class: "pill" }, "so far"), r.daysMissing ? ui.h("span", { class: "pill warn" }, "days missing") : null, r.unsure && !r.daysMissing ? ui.h("span", { class: "pill warn" }, "a card's file missing") : null, r.uncategorised ? ui.h("span", { class: "pill warn" }, `${r.uncategorised} unfiled`) : null),
        ui.h("div", { class: "d" }, `in ${fmt.money(r.in, cur)} · out ${fmt.money(r.out, cur)} · ${r.count} transactions`),
        // a month an account's files miss days in says which (the totals leave those days out; re-check 2026-11-02)
        (r.missing ?? []).length ? ui.h("div", { class: "d" }, `${r.missing.slice(0, 2).join("; ")}.`) : null,
        ui.h("div", { class: "progress", style: { margin: "6px 0 2px", background: "var(--ok-soft)" } }, ui.h("span", { style: { width: `${Math.round((r.in / maxBar) * 100)}%`, background: "var(--ok)" } })),
        ui.h("div", { class: "progress", style: { margin: "0", background: "var(--bad-soft)" } }, ui.h("span", { style: { width: `${Math.round((r.out / maxBar) * 100)}%`, background: "var(--bad)" } }))),
      ui.h("span", { class: "st", style: { fontWeight: "600", color: r.net >= 0 ? "var(--ok)" : "var(--bad)" } }, `${r.net >= 0 ? "+" : "-"}${fmt.money(Math.abs(r.net), cur)}`)))),
    ui.h("p", { class: "muted small" }, "Green bar: money in. Red bar: money out. Tap a month to see its transactions."),
  ));
  // a card's stand-in line counts its payments, not transactions, and opens the import of its file (re-check 2026-11-02)
  const catList = (list, side) => ui.h("ul", { class: "page-list" }, list.slice(0, 12).map((c) => ui.h("li", c.unimported ? { role: "button", tabindex: "0", style: { cursor: "pointer" }, onClick: () => ctx.go("transactions", "import", [], { accountId: c.cardId }) } : {},
    ui.h("span", { class: "ic" }, c.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label), ui.h("div", { class: "d" }, c.unimported ? `${c.count === 1 ? "one payment" : `${c.count} payments`} to the card · tap to bring in its file` : `${c.count} transaction${c.count === 1 ? "" : "s"}`)),
    ui.h("span", { class: "st" }, fmt.money(c.total, cur)))));
  root.append(ui.row(
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Where it came from"), catList(d.byCategory.in, "in")),
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Where it went"), catList(d.byCategory.out, "out")),
  ));
}
