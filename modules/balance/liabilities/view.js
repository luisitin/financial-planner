// modules/balance/liabilities/view.js -- DOM only. Totals, a tappable list of debts, and one
// form for the selected debt's rate and payments.
import { compute } from "./compute.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;
// "July 2030" from an ISO date (view-only wording, design log 2026-09-15).
const monthYear = (iso, locale) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(locale, { month: "long", year: "numeric" }); };

const FIELDS = [
  { key: "rate", label: "Interest rate per year", type: "percent", required: true, min: 0, max: 100, help: "on the statement; type 22.9 for 22.9%" },
  { key: "minPayment", label: "Required payment each month", type: "money", required: true, min: 0, help: "the minimum the lender asks for" },
  { key: "extra", label: "Extra you pay each month", type: "money", min: 0, help: "on top of the required payment; blank for none" },
  { key: "termMonths", label: "Loan length in months", type: "number", min: 0, step: "1", help: "for loans with a fixed term, e.g. 360 for a 30-year mortgage; blank for cards" },
  { key: "startDate", label: "Started", type: "date" },
  { key: "securedBy", label: "Secured by", type: "text", placeholder: "e.g. the house, the car; blank if nothing" },
  { key: "creditLimit", label: "Credit limit (cards only)", type: "money", min: 0, help: "the Credit cards page shows how much of it you use" },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  let selected = ctx.route.rest?.[0] ? d.rows.find((r) => r.id === ctx.route.rest[0]) ?? null : null;

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What do you owe?"),
      ui.h("p", { class: "lede" }, "Add each loan, credit card and the mortgage as an account on the Net worth page (pick a loan or card type). Then come back here to enter its interest rate and payment: the plan works out when each one is gone and what the interest costs you."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add a loan or card")),
    ));
    return;
  }

  root.append(ui.card(null, ui.row(
    ui.stat("You owe", fmt.money(d.owed, cur), `${d.count} ${d.count === 1 ? "debt" : "debts"}${d.avgRate !== null ? `, average rate ${fmt.pct(d.avgRate, 1)}` : ""}`),
    ui.stat("Paying each month", fmt.money(d.payments, cur), d.payments > d.minimums ? `${fmt.money(d.minimums, cur)} required plus extra` : "the required payments"),
    d.interestMonthly ? ui.stat("Interest each month", fmt.money(d.interestMonthly, cur), "what borrowing costs you right now") : null,
    d.dti !== null ? ui.stat("Debt payments vs income", fmt.pct(d.dti, 0), d.dti > 0.43 ? "above 43%: lenders see this as stretched" : d.dti > 0.36 ? "above 36%: on the high side" : "under 36%: comfortable") : null,
  )));
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  if (d.withDetail < d.count) root.append(ui.notice("info", `${d.count - d.withDetail} of your debts ${d.count - d.withDetail === 1 ? "has" : "have"} no rate or payment yet. Tap it below to add them.`));

  const formHost = ui.h("div");
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!selected) return;
    const r = selected;
    const values = r.detail ? { ...r.detail } : {};
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, `${r.name}: rate and payments`),
      ui.h("p", { class: "muted small" }, `${fmt.money(r.owed, cur)} owed. The balance itself is edited on the Net worth page.`),
      ui.form(FIELDS, values, (v) => {
        const clean = { accountId: r.id, rate: v.rate ?? 0, minPayment: v.minPayment ?? 0, extra: v.extra ?? 0, termMonths: v.termMonths ?? null, startDate: v.startDate || "", securedBy: (v.securedBy || "").trim(), creditLimit: v.creditLimit ?? null };
        pending = `Saved ${r.name}.`;
        store.update((p) => {
          p.debts = p.debts ?? [];
          const i = p.debts.findIndex((x) => x.accountId === r.id);
          if (i >= 0) p.debts[i] = { ...p.debts[i], ...clean }; else p.debts.push({ id: ui.uid(), ...clean });
        });
        selected = null;
      }, { submitLabel: "Save", onCancel: () => { selected = null; drawForm(); } }),
      r.detail ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Clear these details", () => { if (ui.confirm(`Clear the rate and payments for ${r.name}?`)) { const id = r.id; selected = null; pending = `Cleared ${r.name}.`; store.update((p) => { p.debts = (p.debts ?? []).filter((x) => x.accountId !== id); }); } }, { class: "secondary" })) : null,
    ));
  };

  const sub = (r) => {
    if (!r.detail) return "add the rate and payment";
    const bits = [`${fmt.pct(r.rate, 1)}`, `${fmt.money(r.payment, cur)} a month`];
    if (r.neverPaysOff) bits.push("never pays off at this payment");
    else if (r.months === 0) bits.push("paid off");
    else if (r.payoffDate) bits.push(`paid off by ${monthYear(r.payoffDate, plan.meta.locale)}`);
    if (r.totalInterest) bits.push(`${fmt.money(r.totalInterest, cur)} interest to come`);
    if (r.securedBy) bits.push(`secured by ${r.securedBy}`);
    return bits.join(" · ");
  };
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(ui.card("Your debts",
    ui.h("ul", { class: "page-list" }, d.rows.map((r) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { selected = r; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, r.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.name, " ", r.expensive ? ui.h("span", { class: "pill warn" }, "expensive") : null, !r.detail ? ui.h("span", { class: "pill" }, "needs details") : null), ui.h("div", { class: "d" }, sub(r))),
      ui.h("span", { class: "st" }, ui.h("div", {}, fmt.money(r.owed, cur)), ui.h("div", { class: "muted small", style: { textAlign: "right" } }, "Edit ›")),
    ))),
    ui.h("p", { class: "muted small" }, "Highest interest rate first: that is the order that saves the most if you pay extra. Tap a debt to enter or change its rate and payments."),
    out, formHost,
  ));
  drawForm();
}
