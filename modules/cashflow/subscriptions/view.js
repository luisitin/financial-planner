// modules/cashflow/subscriptions/view.js -- DOM only. The yearly cost of everything that
// renews by itself, biggest first, with "still worth it?" as the question the page asks.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Subscriptions"),
      ui.h("p", { class: "lede" }, "Streaming, phone, gym, apps: the charges that renew by themselves. This page adds up what they cost you a year so the ones you no longer use stand out."),
      ui.h("p", { class: "muted small" }, "They are found in your transactions (same payee, same amount, every month) or typed on the Expenses page under Subscriptions."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Type them on Expenses"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${fmt.money(d.yearly, cur)} a year`),
    ui.h("p", { class: "lede" }, `${d.count} subscription${d.count === 1 ? "" : "s"}, ${fmt.money(d.monthly, cur)} a month. Go down the list and ask of each one: did I use this last month?`),
  ));
  root.append(ui.card("Biggest first",
    ui.h("ul", { class: "page-list" }, d.items.map((i) => ui.h("li", {},
      ui.h("span", { class: "ic" }, i.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, i.name, i.source === "typed" ? ui.h("span", { class: "pill" }, "typed") : null), ui.h("div", { class: "d" }, `${fmt.money(i.amount, cur, undefined, 2)} ${i.cadenceLabel}${i.next ? ` · next ${fmt.date(i.next)}` : ""}`)),
      ui.h("span", { class: "st", style: { textAlign: "right" } }, ui.h("div", { style: { fontWeight: "600" } }, `${fmt.money(i.yearly, cur)}/yr`),
        i.source === "found" ? ui.button("Not a subscription", () => store.update((p) => { p.recurringIgnored = [...new Set([...(p.recurringIgnored ?? []), i.key])]; }), { class: "secondary small" }) : null)))),
    ui.h("p", { class: "muted small" }, "Cancelling is done with the company, not here; once the charges stop, the item drops off this list by itself."),
  ));
}
