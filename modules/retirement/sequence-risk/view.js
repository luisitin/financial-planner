// modules/retirement/sequence-risk/view.js -- DOM only. The same years of returns in three
// orders, on your own plan, next to the steady line you assume.
import { needButtons, unknownHero } from "../needs.js";
import { unknownWords } from "../projection/compute.js";
import { compute } from "./compute.js";

/** The page's own question inside the "we can't say yet" sentence (projection unknownWords). */
export const UNKNOWN_WHAT = "how the order of good and bad years would change your plan";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(Math.max(0, n), cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Why the order of returns matters"), ui.h("p", { class: "lede" }, "Bad years early in retirement, while you are withdrawing, hurt far more than the same bad years later. This page shows it on your own plan; it needs the answers from Will the money last? first."), (needButtons(ui, d.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")))));
    return;
  }
  // nothing saved for retirement and nothing going in: the same "we can't say yet" as Will the money last?, and nothing under it
  // (whole-app sweep x3, 2026-11-16: "runs out at 65" in all four rows beside its "We don't know yet")
  if (d.unknown) { root.append(unknownHero(ui, unknownWords(d.unknown, UNKNOWN_WHAT), { title: "Why the order of returns matters" })); return; }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Why the order of returns matters"),
    ui.h("p", { class: "lede" }, `Take the ${d.years} years of actual returns starting in ${d.startYear} (average ${fmt.pct(d.average.stocks, 1)} a year for stocks, ${fmt.pct(d.average.bonds, 1)} for bonds, ${fmt.pct(d.average.inflation, 1)} inflation). The three runs below use exactly those years, only in a different order after retirement. Same average; very different endings.`),
  ));
  const rows = [...d.runs, { ...d.steady, key: "steady" }];
  root.append(ui.card("Same years, three orders",
    ui.h("ul", { class: "records" }, rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name), ui.h("span", { class: `rec-value ${r.success ? "" : "bad"}` }, r.success ? money(r.endReal) : `runs out at ${r.failAge}`)),
      ui.h("div", { class: "rec-sub" }, `${r.note}${r.success ? `; lowest point ${money(r.lowestReal)}` : ""}`)))),
    ui.h("p", { class: "muted small" }, "Right column: what is left at the end, in today's dollars, at your planned spending. This is sequence-of-returns risk: it is why the first ten years of retirement matter most, and why a cash buffer or a flexible spending rule (How much to take out) helps."),
  ));
}
