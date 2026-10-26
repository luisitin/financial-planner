// modules/investments/performance/view.js -- DOM only. The true return first, then each
// account with its two returns and the periods between balance points.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  const pc = (x) => x === null || x === undefined || !Number.isFinite(x) ? "-" : `${x < 0 ? "−" : "+"}${fmt.pct(Math.abs(x), 1)}`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How your investments have done"), ui.h("p", { class: "lede" }, "Your true return: what the investments earned once deposits are stripped out (the figure to compare with an index), and what you earned given when your money went in. Both come from the balance points saved on the Net worth page."), ui.h("ul", {}, d.notes.map((n) => ui.h("li", {}, n))), ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Net worth"))));
    return;
  }
  const o = d.overall;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${pc(o.twrAnnual)} a year${o.years >= 0.9 ? "" : " so far"}`),
    ui.h("p", { class: "lede" }, `From ${fmt.date(o.from)} to ${fmt.date(o.to)}: ${money(o.start)} grew to ${money(o.end)} with ${money(o.deposits)} added, so the investments themselves made ${signed(o.gain)}. The plan assumes ${fmt.pct(d.expected, 1)} a year${d.benchmark ? `; a plain ${Math.round(d.stockShare * 100)}/${Math.round((1 - d.stockShare) * 100)} index mix made ${pc(d.benchmark.annual)} a year over ${d.benchmark.from === d.benchmark.to ? d.benchmark.from : `${d.benchmark.from}-${d.benchmark.to}`}` : ""}.`),
    ui.h("p", { class: "muted small" }, "Time-weighted: deposits between two points are treated as arriving mid-period (Modified Dietz) and the periods chain-linked. Money-weighted: the rate that makes every deposit and the end value balance (the IRR, with real dates). Deposits come from the ledger for the account when it has entries, else from the Contributions page."),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Investments earned", pc(o.twrAnnual), "a year, time-weighted"),
    o.mwr !== null ? ui.stat("You earned", pc(o.mwr), "a year, money-weighted") : null,
    ui.stat("Growth", signed(o.gain), `on ${money(o.start)} plus ${money(o.deposits)} added`),
    ui.stat("Plan assumes", fmt.pct(d.expected, 1), "blended stocks and bonds"),
  )));
  for (const a of d.accounts.filter((x) => x.ready)) root.append(ui.card(a.name,
    ui.row(ui.stat("Time-weighted", pc(a.twrAnnual), `a year over ${a.years.toFixed(1)} years`), ui.stat("Money-weighted", pc(a.mwr), "a year, your own"), ui.stat("Added", money(a.deposits), `${fmt.date(a.from)} to ${fmt.date(a.to)}`)),
    ui.h("ul", { class: "records" }, a.periods.map((p) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${fmt.date(p.from)} to ${fmt.date(p.to)}`), ui.h("span", { class: "rec-value" }, pc(p.rate))), ui.h("div", { class: "rec-sub" }, `${money(p.start)} to ${money(p.end)}${Math.abs(p.flow) > 0.5 ? ` with ${signed(p.flow)} added` : ""}`)))),
  ));
  root.append(ui.card("Reading the two numbers",
    ui.h("ul", { class: "records" }, [
      ["Time-weighted is the fund's report card", "It ignores how much you had invested when. Compare it with an index fund's return for the same stretch; if yours is lower every year, the fees or the picks are the reason."],
      ["Money-weighted is your report card", "Big deposits before a good run raise it, before a bad run lower it. Over a long stretch the two converge; over a short one they can differ a lot, and neither is wrong."],
      ["More points, better numbers", "A balance point every month or quarter on the Net worth page turns this into a real record."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}
