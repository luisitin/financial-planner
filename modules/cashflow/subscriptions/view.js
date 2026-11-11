// modules/cashflow/subscriptions/view.js -- DOM only. The yearly cost of everything that
// renews by itself, biggest first, with "still worth it?" as the question the page asks.
import { compute } from "./compute.js";
import { compute as recurring } from "../recurring/compute.js";
import { hideRow, hiddenCard } from "../recurring/view.js";

let pending = null;   // what a hide or put-back did, said on the next render

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });

  const said = pending ? ui.notice("ok", pending) : null; pending = null;
  const hidden = recurring(plan, { today: fmt.today() }).hidden;
  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Subscriptions"),
      ui.h("p", { class: "lede" }, "Streaming, phone, gym, apps: the charges that renew by themselves. This page adds up what they cost you a year so the ones you no longer use stand out."),
      ui.h("p", { class: "muted small" }, "The page finds them in your transactions (same payee, same amount, every month) and adds any you typed on the Expenses page under Subscriptions."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Type them on Expenses"))));
    if (said) root.append(said);
    const hc = hiddenCard(ctx, hidden, (t) => { pending = t; });
    if (hc) root.append(hc);
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${fmt.money(d.yearly, cur)} a year`),
    ui.h("p", { class: "lede" }, `${d.count} subscription${d.count === 1 ? "" : "s"}, ${fmt.money(d.monthly, cur)} a month. Go down the list and ask of each one: did I use this last month?`),
  ));
  // a typed one opens its own form on Expenses, with a way back here (CF-5, F2)
  const openTyped = (i) => ctx.go("cashflow", "expenses", [], { edit: i.expenseId, back: "cashflow/subscriptions" });
  root.append(ui.card("Biggest first", said,
    ui.h("ul", { class: "page-list" }, d.items.map((i) => ui.h("li", i.source === "typed" ? { role: "link", tabindex: "0", style: { cursor: "pointer" }, onClick: () => openTyped(i),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } } : {},
      ui.h("span", { class: "ic" }, i.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, i.name, i.source === "typed" ? ui.h("span", { class: "pill" }, "typed") : null), ui.h("div", { class: "d" }, `${fmt.money(i.amount, cur, undefined, 2)} ${i.cadenceLabel}${i.next ? ` · next ${fmt.date(i.next)}` : ""}`)),
      ui.h("span", { class: "st", style: { textAlign: "right" } }, ui.h("div", { style: { fontWeight: "600" } }, `${fmt.money(i.yearly, cur)} a year`),
        // asks first, naming it, and says what it did (F3)
        i.source === "found" ? ui.button("Not a subscription", () => hideRow(ctx, { key: i.key, payee: i.name }, (t) => { pending = t; }, { what: "subscription" }), { class: "secondary small", "aria-label": `${i.name} is not a subscription` }) : ui.h("div", { class: "muted small" }, "Edit \u203a"))))),
    ui.h("p", { class: "muted small" }, "You cancel with the company itself, not here; once the charges stop, the item drops off this list on its own."),
    d.items.some((i) => i.source === "typed") ? ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Change these on Expenses")) : null,
  ));
  const hc = hiddenCard(ctx, hidden, (t) => { pending = t; });
  if (hc) root.append(hc);
}
