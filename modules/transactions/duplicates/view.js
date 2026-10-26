// modules/transactions/duplicates/view.js -- DOM only. Each likely duplicate pair with
// "Remove the copy" and "Keep both".
import { compute } from "./compute.js";

const dismissed = new Set();   // pairs the person said are not duplicates (this session)

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);
  const pairs = d.pairs.filter((p) => !dismissed.has(p.keep.id + "|" + p.drop.id));

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, pairs.length ? `${pairs.length} likely duplicate${pairs.length === 1 ? "" : "s"}` : "No duplicates"),
    ui.h("p", { class: "lede" }, pairs.length ? "Same account, same amount, same description, within a day. Usually a pending line that posted again. Remove the copy or keep both." : d.total ? "Exact repeats are already refused when you import; nothing near-identical was found either." : "Nothing on file yet. Import a bank file first."),
  ));
  if (!pairs.length) return;
  const line = (t) => `${fmt.date(t.date)} · ${t.payee}${t.rawPayee && t.rawPayee !== t.payee ? ` (bank wrote: ${t.rawPayee})` : ""}${t.category ? ` · ${t.category}` : ""}`;
  root.append(ui.card(null, ui.h("ul", { class: "page-list" }, pairs.map((p) => ui.h("li", { style: { alignItems: "flex-start", flexWrap: "wrap" } },
    ui.h("span", { class: "ic" }, "👯"),
    ui.h("span", { class: "body", style: { flex: "1 1 200px" } },
      ui.h("div", { class: "t" }, `${(Number(p.keep.amount) > 0 ? "+" : "-") + fmt.money(Math.abs(Number(p.keep.amount)), cur, undefined, 2)} · ${p.accountName}`),
      ui.h("div", { class: "d" }, `keep: ${line(p.keep)}`),
      ui.h("div", { class: "d" }, `copy: ${line(p.drop)}`),
      ui.h("div", { class: "muted small" }, p.why)),
    ui.h("span", { class: "st", style: { display: "flex", gap: "8px", flex: "1 1 100%", marginTop: "6px" } },
      ui.button("Remove the copy", () => store.update((pl) => { pl.transactions = (pl.transactions ?? []).filter((t) => t.id !== p.drop.id); }), { class: "small" }),
      ui.button("Keep both", () => { dismissed.add(p.keep.id + "|" + p.drop.id); root.innerHTML = ""; render(root, ctx); }, { class: "secondary small" })),
  )))));
  if (pairs.length > 1) root.append(ui.card(null, ui.row(ui.button(`Remove all ${pairs.length} copies`, () => { if (ui.confirm(`Remove ${pairs.length} duplicate transactions?`)) { const ids = new Set(pairs.map((p) => p.drop.id)); store.update((pl) => { pl.transactions = (pl.transactions ?? []).filter((t) => !ids.has(t.id)); }); } }, { class: "danger" }))));
}
