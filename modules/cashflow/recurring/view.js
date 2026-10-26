// modules/cashflow/recurring/view.js -- DOM only. What is due soon, what looks missed, every
// payment found in the transactions (dismiss the ones that are not bills), and the items typed
// on the Income and Expenses pages.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // Bank amounts keep their cents; typed amounts are whole numbers like the rest of the app.
  const money = (n, typed = false) => (n < 0 ? "-" : "+") + fmt.money(Math.abs(n), cur, undefined, typed ? 0 : 2);

  if (!d.total && !d.planned.length) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Bills and regular payments"),
      ui.h("p", { class: "lede" }, "Once transactions are on file, this page finds the payments that come back every week, month or year, says when the next one is due and warns when one looks missed."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Or type your bills on Expenses"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Bills and regular payments"),
    ui.h("p", { class: "lede" }, d.detected.length ? `${d.detected.length} regular payment${d.detected.length === 1 ? "" : "s"} found in your transactions: about ${fmt.money(d.monthlyOut, cur)} a month going out${d.monthlyIn ? ` and ${fmt.money(d.monthlyIn, cur)} coming in` : ""}.` : "Nothing regular found in the transactions yet: it takes two or three occurrences of the same payee to be sure. Meanwhile the bills typed on Expenses are listed below."),
  ));
  const row = (r, right, extraPill = null) => ui.h("li", {},
    ui.h("span", { class: "ic" }, r.icon ?? "🔁"),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.payee, " ", extraPill), ui.h("div", { class: "d" }, `${money(r.amount)} ${r.cadenceLabel} · last ${fmt.date(r.last)} · ${r.count}× so far${r.categoryLabel && r.category ? ` · ${r.categoryLabel}` : ""}`)),
    ui.h("span", { class: "st", style: { textAlign: "right" } }, right));
  const dismiss = (r) => ui.button("Not a bill", () => store.update((p) => { p.recurringIgnored = [...new Set([...(p.recurringIgnored ?? []), r.key])]; }), { class: "secondary small" });

  if (d.missed.length) root.append(ui.card("Looks missed",
    ui.h("p", { class: "muted small" }, "Expected by now and not seen. Paid another way, cancelled, or the bank file is not up to date?"),
    ui.h("ul", { class: "page-list" }, d.missed.map((r) => row(r, ui.h("span", {}, ui.h("div", { class: "small" }, `expected ${fmt.date(r.next)}`), dismiss(r)), ui.h("span", { class: "pill warn" }, "missed"))))));
  if (d.dueSoon.length) root.append(ui.card("Due in the next two weeks",
    ui.h("ul", { class: "page-list" }, d.dueSoon.map((r) => row(r, ui.h("span", { class: "small" }, r.days === 0 ? "today" : r.days === 1 ? "tomorrow" : `in ${r.days} days`, ui.h("div", { class: "muted small" }, fmt.date(r.next))))))));
  if (d.detected.length) root.append(ui.card("Found in your transactions",
    ui.h("ul", { class: "page-list" }, d.detected.filter((r) => !r.missed).map((r) => row(r, ui.h("span", {}, ui.h("div", { class: "small" }, `next ${fmt.date(r.next)}`), dismiss(r))))),
    ui.h("p", { class: "muted small" }, `"Not a bill" hides a payee that only looks regular.${d.dismissed ? ` ${d.dismissed} hidden so far.` : ""}`)));
  if (d.planned.length) root.append(ui.card("Typed on the Income and Expenses pages",
    ui.h("ul", { class: "page-list" }, d.planned.filter((x) => x.state === "active").map((x) => ui.h("li", {},
      ui.h("span", { class: "ic" }, x.kind === "income" ? "💵" : "🧾"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, `${money(x.amount, true)} ${x.periodLabel.toLowerCase()}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(x.monthly, cur)), ui.h("div", { class: "muted small" }, "a month"))))),
    d.planned.some((x) => x.state !== "active") ? ui.h("p", { class: "muted small" }, `Not counted: ${d.planned.filter((x) => x.state !== "active").map((x) => `${x.name} (${x.state === "ended" ? `ended ${fmt.date(x.endDate)}` : `starts ${fmt.date(x.startDate)}`})`).join(", ")}.`) : null,
    ui.h("p", { class: "muted small" }, "These are what you told the plan to expect. The Forecast page uses both lists.")));
}
