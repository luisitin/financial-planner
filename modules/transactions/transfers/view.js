// modules/transactions/transfers/view.js -- DOM only. Suggested pairs with a "Link" button
// (and "Link all"), then the transfers already linked with "Unlink".
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Transfers"),
    ui.h("p", { class: "lede" }, "When you move money between your own accounts it appears twice: out of one, into the other. Linking the two sides keeps the transfer out of income and spending."),
    d.total ? ui.h("p", { class: "muted small" }, `${d.count} transfer${d.count === 1 ? "" : "s"} linked, ${d.suggested} likely pair${d.suggested === 1 ? "" : "s"} waiting.`) : ui.h("p", { class: "muted small" }, "Nothing to link until transactions from two accounts are on file."),
  ));

  const link = (pairs) => store.update((p) => {
    for (const pr of pairs) {
      const id = ui.uid();
      for (const t of p.transactions ?? []) if (t.id === pr.out.id || t.id === pr.in.id) { t.transferId = id; t.category = "transfer"; }
    }
  });
  const row = (pr, action) => ui.h("li", { style: { alignItems: "flex-start" } },
    ui.h("span", { class: "ic" }, "🔁"),
    ui.h("span", { class: "body" },
      ui.h("div", { class: "t" }, `${fmt.money(Math.abs(Number(pr.out.amount)), cur, undefined, 2)} from ${pr.out.accountName} to ${pr.in.accountName}`),
      ui.h("div", { class: "d" }, `${fmt.date(pr.out.date)}${pr.gap ? ` and ${fmt.date(pr.in.date)}` : ""} · out: ${pr.out.payee} · in: ${pr.in.payee}`)),
    ui.h("span", { class: "st" }, action));

  if (d.pairs.length) root.append(ui.card("Likely transfers",
    ui.h("p", { class: "muted small" }, "Same amount, opposite direction, different accounts, within a few days. Link the ones that are really you moving money."),
    ui.h("ul", { class: "page-list" }, d.pairs.map((pr) => row(pr, ui.button("Link", () => link([pr]), { class: "small" })))),
    d.pairs.length > 1 ? ui.row(ui.button(`Link all ${d.pairs.length}`, () => { if (ui.confirm(`Link all ${d.pairs.length} pairs as transfers?`)) link(d.pairs); }, { class: "secondary" })) : null,
  ));
  if (d.linked.length) root.append(ui.card("Linked transfers",
    ui.h("ul", { class: "page-list" }, d.linked.map((pr) => row(pr, ui.button("Unlink", () => store.update((p) => { for (const t of p.transactions ?? []) if (t.transferId === pr.transferId) { delete t.transferId; if (t.category === "transfer") t.category = ""; } }), { class: "secondary small" })))),
  ));
  if (d.total && !d.pairs.length && !d.linked.length) root.append(ui.card(null, ui.muted("No transfers found. If one is missing, open the transaction in the Ledger and set its category to \"Transfer between my accounts\".")));
}
