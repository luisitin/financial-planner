// modules/cashflow/recurring/view.js -- DOM only. What is due soon, what looks missed, every
// payment found in the transactions (dismiss the ones that are not bills), and the items typed
// on the Income and Expenses pages.
import { compute } from "./compute.js";

let pending = null;   // "Netflix taken off this list ...": said on the next render, where the list was
// a payee hidden or put back: asked first, then said; nothing in the plan is removed, only hidden (plan.recurringIgnored)
export function hideRow(ctx, r, say, { what = "bill" } = {}) {
  const name = r.payee ?? r.name;
  if (!ctx.ui.confirm(`Take ${name} off the list? It is hidden on Bills and regular payments and on Subscriptions. Your transactions stay as they are, and you can put it back at the bottom of either page.`)) return;
  say(`${name} taken off this list (and off ${what === "bill" ? "Subscriptions" : "Bills and regular payments"}). Put it back under "Hidden" at the bottom.`);
  ctx.store.update((p) => { p.recurringIgnored = [...new Set([...(p.recurringIgnored ?? []), r.key])]; });
}
export function hiddenCard(ctx, hidden, onSaid) {
  const { ui, store } = ctx;
  if (!hidden.length) return null;
  return ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Hidden"), ui.h("span", { class: "fold-status" }, `${hidden.length} payee${hidden.length === 1 ? "" : "s"}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "muted small" }, "Payees you said are not bills or subscriptions. Put one back and it is counted again on both pages."),
      ui.h("ul", { class: "page-list" }, hidden.map((h) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, h.payee)),
        ui.h("span", { class: "st" }, ui.button("Put back", () => { onSaid(`${h.payee} is back on the list.`); store.update((p) => { p.recurringIgnored = (p.recurringIgnored ?? []).filter((k) => k !== h.key); }); }, { class: "secondary small", "aria-label": `Put ${h.payee} back` })))))));
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // Bank amounts keep their cents; typed amounts are whole numbers like the rest of the app.
  const money = (n, typed = false) => (n < 0 ? "-" : "+") + fmt.money(Math.abs(n), cur, undefined, typed ? 0 : 2);

  const said = pending ? ui.notice("ok", pending) : null; pending = null;
  if (!d.total && !d.planned.length) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Bills and regular payments"),
      ui.h("p", { class: "lede" }, "Once transactions are on file, this page finds the payments that come back every week, month or year, says when the next one is due and warns when one looks missed."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Or type your bills on Expenses"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Bills and regular payments"),
    // no bank file at all: these are the bills typed, and Import is still the way to find the forgotten ones (CF-5)
    !d.total ? ui.h("p", { class: "lede" }, "These are the bills and income you typed. Import a bank file and this page also finds the regular payments you forgot, and says when each is due.") : null,
    !d.total ? ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file")) : null,
    !d.total ? null : ui.h("p", { class: "lede" }, d.detected.length ? `${d.detected.length} regular payment${d.detected.length === 1 ? "" : "s"} found in your transactions: about ${fmt.money(d.monthlyOut, cur)} a month going out${d.monthlyIn ? ` and ${fmt.money(d.monthlyIn, cur)} coming in` : ""}.` : "Nothing regular found in the transactions yet: it takes two or three occurrences of the same payee to be sure. Meanwhile the bills typed on Expenses are listed below."),
  ));
  const row = (r, right, extraPill = null) => ui.h("li", {},
    ui.h("span", { class: "ic" }, r.icon ?? "🔁"),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.payee, " ", extraPill), ui.h("div", { class: "d" }, `${money(r.amount)} ${r.cadenceLabel} · last ${fmt.date(r.last)} · ${r.count}× so far${r.categoryLabel && r.category ? ` · ${r.categoryLabel}` : ""}`)),
    ui.h("span", { class: "st", style: { textAlign: "right" } }, right));
  // asks first, naming the payee, and says what it did (F3: one tap hid it from two pages with no word, and two quick taps hid two)
  const dismiss = (r) => ui.button("Not a bill", () => hideRow(ctx, r, (t) => { pending = t; }, { what: "bill" }), { class: "secondary small", "aria-label": `${r.payee} is not a bill` });
  if (said) root.append(said);

  if (d.missed.length) root.append(ui.card("Looks missed",
    ui.h("p", { class: "muted small" }, "Expected by now and not seen. Paid another way, canceled, or the bank file is not up to date?"),
    ui.h("ul", { class: "page-list" }, d.missed.map((r) => row(r, ui.h("span", {}, ui.h("div", { class: "small" }, `expected ${fmt.date(r.next)}`), dismiss(r)), ui.h("span", { class: "pill warn" }, "missed"))))));
  if (d.dueSoon.length) root.append(ui.card("Due in the next two weeks",
    ui.h("ul", { class: "page-list" }, d.dueSoon.map((r) => row(r, ui.h("span", { class: "small" }, r.days === 0 ? "today" : r.days === 1 ? "tomorrow" : `in ${r.days} days`, ui.h("div", { class: "muted small" }, fmt.date(r.next))))))));
  if (d.detected.length) root.append(ui.card("Found in your transactions",
    ui.h("ul", { class: "page-list" }, d.detected.filter((r) => !r.missed).map((r) => row(r, ui.h("span", {}, ui.h("div", { class: "small" }, `next ${fmt.date(r.next)}`), dismiss(r))))),
    ui.h("p", { class: "muted small" }, `"Not a bill" hides a payee that only looks regular.${d.hidden.length ? ` ${d.hidden.length} hidden so far: see "Hidden" below.` : ""}`)));
  if (d.planned.length) root.append(ui.card("Typed on the Income and Expenses pages",
    // each typed row opens where it is changed: a bill its own form on Expenses (with a way back here), income the Income page
    // (income rows are not tappable: Income has no one-row address; "Change what comes in" below goes there)
    ui.h("ul", { class: "page-list" }, d.planned.filter((x) => x.state === "active").map((x) => ui.h("li", x.kind !== "expense" ? {} : { role: "link", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => ctx.go("cashflow", "expenses", [], { edit: x.id, back: "cashflow/recurring" }),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, x.kind === "income" ? "💵" : "🧾"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, `${money(x.amount, true)} ${x.periodLabel.toLowerCase()}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(x.monthly, cur)), ui.h("div", { class: "muted small" }, "a month"), x.kind === "expense" ? ui.h("div", { class: "muted small" }, "Edit \u203a") : null)))),
    d.planned.some((x) => x.state !== "active") ? ui.h("p", { class: "muted small" }, `Not counted: ${d.planned.filter((x) => x.state !== "active").map((x) => `${x.name} (${x.state === "ended" ? `ended ${fmt.date(x.endDate)}` : `starts ${fmt.date(x.startDate)}`})`).join(", ")}.`) : null,
    ui.h("p", { class: "muted small" }, "These are what you told the plan to expect. The Forecast page uses both lists."),
    // a wrong amount, a bill that ended, one more to add: where that is done, as buttons (CF-5, F2)
    ui.row(d.planned.some((x) => x.kind === "expense") ? ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Change these on Expenses") : null,
      d.planned.some((x) => x.kind === "income") ? ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Change what comes in") : null)));
  const hc = hiddenCard(ctx, d.hidden, (t) => { pending = t; });
  if (hc) root.append(hc);
}
