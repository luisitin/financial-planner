// modules/investments/limits/view.js -- DOM only. The room left this year first, then each
// person's limits with a bar, the Roth income check, and the deadlines.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const room = d.totals.limit - d.totals.used;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasContributions ? (room > 0 ? `${money(room)} of tax-advantaged room left this year` : "Every account is filled to its limit") : `${d.limitsYear} contribution limits`),
    ui.h("p", { class: "lede" }, d.hasContributions
      ? `${money(d.totals.used)} a year is going into 401(k)s, IRAs and HSAs against ${money(d.totals.limit)} of limits for the accounts you have. ${room > 0 ? "Room in a tax-advantaged account is the cheapest place for the next dollar you save." : "Anything more goes to a taxable brokerage account."}`
      : `Each person may put ${money(d.people[0]?.rows[0].limit ?? 23500)} into a 401(k), ${money(d.people[0]?.rows[1].limit ?? 7000)} into IRAs (traditional and Roth together) and ${money(d.people[0]?.rows[2].limit ?? 4300)} into an HSA this year, more from 50 (and 55 for the HSA). Enter what goes in on the Contributions page to see the room left.`),
    ui.h("p", { class: "muted small" }, `IRS limits for ${d.limitsYear}; employer matches do not count against the 401(k) limit. Health FSA ${money(d.fsa.limit)}; 529 plans have no yearly limit but gifts over ${money(d.gift.exclusion)} a year per child per giver use the gift-tax exclusion (up to ${money(d.gift.superfund)} at once, spread over five years).`),
  ));
  for (const n of d.notes) root.append(ui.notice(n.includes("over the Roth") ? "warn" : "info", n));
  for (const p of d.people) root.append(ui.card(`${p.name}${p.age !== null ? `, ${p.age}` : ""}`,
    ui.h("ul", { class: "records" }, p.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.label, r.over > 0 ? ui.h("span", { class: "pill warn" }, "over") : null), ui.h("span", { class: "rec-value" }, `${money(r.used)} of ${money(r.limit)}`)),
      ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(r.used / r.limit * 100))}%`, background: r.over ? "var(--bad)" : "var(--ok)" } })),
      ui.h("div", { class: "rec-sub" }, r.over > 0 ? `${money(r.over)} over the limit` : `${money(r.room)} of room${r.catchUp ? ` (includes the ${money(r.catchUp)} catch-up from ${r.kind === "401k" && p.age >= 60 && p.age <= 63 ? "60 to 63" : r.catchUpAge})` : p.age !== null && r.catchUpAge && p.age < r.catchUpAge ? ` · catch-up from ${r.catchUpAge}` : ""}${r.accounts.length ? ` · ${r.accounts.join(", ")}` : r.hasAccount ? "" : " · no such account on file"}`)))),
  ));
  if (d.roth) root.append(ui.card("Roth IRA income limit",
    ui.h("p", { class: "small" }, `Filing ${d.roth.filingStatus.replace(/_/g, " ")}, direct Roth IRA contributions phase out between ${money(d.roth.phaseOut[0])} and ${money(d.roth.phaseOut[1])} of income; the plan puts yours at about ${money(d.roth.magi)}: ${d.roth.status === "ok" ? "the full amount is allowed." : d.roth.status === "partial" ? "only part is allowed directly." : "not allowed directly; the backdoor route still works."}`),
  ));
  root.append(ui.card("Deadlines",
    ui.h("ul", { class: "records" }, d.deadlines.map((x) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label), ui.h("span", { class: "rec-value" }, fmt.date(x.date))), ui.h("div", { class: "rec-sub" }, x.note)))),
    ui.h("p", { class: "muted small" }, ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "Edit contributions")),
  ));
}
