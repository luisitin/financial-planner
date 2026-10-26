// modules/retirement/sequence-risk/view.js -- DOM only. The same years of returns in three
// orders, on your own plan, next to the steady line you assume.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(Math.max(0, n), cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Why the order of returns matters"), ui.h("p", { class: "lede" }, "Bad years early in retirement, while you are withdrawing, hurt far more than the same bad years later. This page shows it on your own plan; it needs the Projection page's inputs first."), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Set up the projection"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Why the order of returns matters"),
    ui.h("p", { class: "lede" }, `Take the ${d.years} years of real returns starting in ${d.startYear} (average ${fmt.pct(d.average.stocks, 1)} a year for stocks, ${fmt.pct(d.average.bonds, 1)} for bonds, ${fmt.pct(d.average.inflation, 1)} inflation). The three runs below use exactly those years, only in a different order after retirement. Same average; very different endings.`),
  ));
  const rows = [...d.runs, { ...d.steady, key: "steady" }];
  root.append(ui.card("Same years, three orders",
    ui.h("ul", { class: "records" }, rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name), ui.h("span", { class: `rec-value ${r.success ? "" : "bad"}` }, r.success ? money(r.endReal) : `runs out at ${r.failAge}`)),
      ui.h("div", { class: "rec-sub" }, `${r.note}${r.success ? `; lowest point ${money(r.lowestReal)}` : ""}`)))),
    ui.h("p", { class: "muted small" }, "Right column: what is left at the end, in today's dollars, at your planned spending. This is sequence-of-returns risk: it is why the first ten years of retirement matter most, and why a cash buffer or a flexible spending rule (Withdrawal strategy page) helps."),
  ));
}
