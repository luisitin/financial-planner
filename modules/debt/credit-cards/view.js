// modules/debt/credit-cards/view.js -- DOM only. Cards with their limit use, the cost of
// minimum payments, and whether a balance transfer pays.
import { compute } from "./compute.js";
import { ISSUER_FLOORS, ISSUER_SHARE } from "../../../core/math/payoff.js";

let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const monthYear = (iso) => { const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(t.getTime()) ? String(iso) : t.toLocaleDateString(plan.meta.locale, { month: "long", year: "numeric" }); };
  const monthsText = (m) => !Number.isFinite(m) ? "never" : m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${Math.floor(m / 12)} year${Math.floor(m / 12) === 1 ? "" : "s"}${m % 12 ? ` ${m % 12} month${m % 12 === 1 ? "" : "s"}` : ""}`;
  const money = (n) => fmt.money(Math.round(n), cur);
  // what the bank asks, as a range (the floor under it is not known): years to the nearest year, a half year up, as the
  // statement's own box rounds (12 CFR 1026.7(b)(12)(i)(B)); under 2 years in months; interest to $100 (to $10 under $1,000)
  const yrs = (m) => Math.floor(m / 12 + 0.5);
  const mo = (n) => `${n} month${n === 1 ? "" : "s"}`;   // "1 month", never "1 months" (verify, 2026-11-06)
  const spanText = (q, s) => s < 24 ? (q === s ? mo(q) : `${q} to ${s} months`) : q < 24 ? `${mo(q)} to ${yrs(s)} years` : yrs(q) === yrs(s) ? `${yrs(q)} year${yrs(q) === 1 ? "" : "s"}` : `${yrs(q)} to ${yrs(s)} years`;
  const roughMoney = (n) => fmt.money(n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10, cur);
  const range = (a, z) => (a === z ? a : `${a} to ${z}`);
  // round 8 review (2026-11-06): one word for the bank's figure ("the minimum"), the reason it takes so long in the line itself,
  // and the card's own kind of minimum (core/math/payoff.js bankMinimum): its floor gives one figure, the whole balance no interest
  const bankLine = (c) => {
    const b = c.bank;
    if (b.kind === "full") return "The bank asks for the whole balance each month: no interest while you keep paying it in full.";
    const none = b.quick.interest < 0.5 && b.slow.interest < 0.5;
    if (b.kind === "floor") return `If you pay only the minimum (${money(b.first)} a month until the balance is under it): ${monthsText(b.quick.months)} and ${none ? "no interest" : `${money(b.quick.interest)} of interest`}.`;
    const lead = b.kind === "typed" ? "If you pay only the minimum, which drops as you pay down" : "If you pay only what most banks ask, which drops as you pay down";
    const why = b.kind === "below-interest" ? ` (your ${money(c.minPayment)} minimum is less than this month's ${money(c.interestMonthly ?? 0)} of interest: check it on your statement)`
      : b.kind === "unmatched" ? ` (your ${money(c.minPayment)} minimum does not match a bank's usual formula)` : "";
    return `${lead}: about ${spanText(b.quick.months, b.slow.months)} and ${none ? "no interest while the rate is 0%" : `${range(roughMoney(b.quick.interest), roughMoney(b.slow.interest))} of interest`}${why}.`;
  };
  // keeping today's minimum level as the bank's drops: what it saves (the typed minimum held level, the answer key's reading)
  const keepLine = (c) => {
    const b = c.bank;
    if (!b || !c.trap || !(c.minPayment > 0) || c.paying || ["full", "floor", "below-interest"].includes(b.kind) || !Number.isFinite(c.trap.months) || !(c.trap.months < b.quick.months)) return null;
    return `Keep paying ${money(c.minPayment)} even when the minimum drops: done in ${monthsText(c.trap.months)}, ${money(c.trap.interest)} of interest, about ${range(roughMoney(b.quick.interest - c.trap.interest), roughMoney(b.slow.interest - c.trap.interest))} less.`;
  };
  // the rate is in the pill from 20%: not again here; a minimum not typed is said, never "$0 a month required"
  const detailLine = (c) => !c.hasDetail ? "add the rate and payment on the Debts page" : [c.rate !== null && c.rate >= 0.2 ? null : fmt.pct(c.rate, 1),
    c.minPayment > 0 ? `minimum this month ${money(c.minPayment)}` : "minimum not entered yet (Debts page)", c.limit ? `limit ${money(c.limit)}` : null].filter(Boolean).join(" · ");
  const transferLine = (c) => !c.transfer || c.bank?.kind === "full" || !(c.transfer.interestNow >= 0.5) ? null : c.transfer.saves > 0
    ? `0% transfer: saves about ${money(c.transfer.saves)} over ${c.transfer.promoMonths} months if you are approved and pay ${money(c.transfer.payToClear)} a month.`
    : `0% transfer: does not pay; the fee is more than the ${money(c.transfer.interestNow)} of interest.`;

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Credit cards"),
      ui.h("p", { class: "lede" }, "Add your cards as accounts (type Credit card) on the Net worth page with what you owe, then their rate, minimum payment and credit limit on the Debts page. This page then shows how much of your limits you use, what paying the minimum would cost, and whether a balance transfer helps."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add a card"))));
    return;
  }
  const carriedInterest = d.cards.filter((c) => c.carried).reduce((t, c) => t + (c.interestMonthly ?? 0), 0);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${fmt.money(d.totalBalance, cur)} on ${d.count} card${d.count === 1 ? "" : "s"}`),
    // interest only on balances carried: a card paid in full each month is charged none (round 8 review, 2026-11-06)
    ui.h("p", { class: "lede" }, `${carriedInterest >= 0.5 ? `About ${fmt.money(carriedInterest, cur)} a month goes to interest. ` : ""}${d.utilisation !== null ? `You use ${fmt.pct(d.utilisation, 0)} of your combined limits; under 30% is what lenders like to see.` : "Add each card's credit limit on the Debts page to see how much of it you use."}`),
    // how much less, and about when at what you pay now (round 4, 2026-11-02)
    d.under && d.under.less30 > 0.5 ? ui.h("p", {}, `${fmt.money(d.under.less30, cur)} less on the cards gets you under 30%${d.under.date30 ? `: about ${monthYear(d.under.date30)} at what you pay now` : ""}${d.under.date10 && d.under.less10 > 0.5 ? `, and under 10% (best for your score) about ${monthYear(d.under.date10)}` : ""}.`) : d.under && d.under.less10 > 0.5 ? ui.h("p", {}, `Under 30% already. ${fmt.money(d.under.less10, cur)} less gets you under 10%, best for your score${d.under.date10 ? `: about ${monthYear(d.under.date10)} at what you pay now` : ""}.`) : null,
    d.under && d.under.less30 > 0.5 ? ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Open my payoff plan")) : null,
    d.missing.length ? ui.h("p", { class: "muted small" }, `No rate or payment yet: ${d.missing.join(", ")}.`) : null,
  ));
  root.append(ui.card("Each card",
    ui.h("ul", { class: "page-list" }, d.cards.map((c) => ui.h("li", { style: { alignItems: "flex-start" } },
      ui.h("span", { class: "ic" }, "💳"),
      ui.h("span", { class: "body" },
        ui.h("div", { class: "t" }, c.name, " ", c.utilisation !== null ? ui.h("span", { class: `pill ${c.utilisation > 0.3 ? "warn" : "ok"}` }, `${fmt.pct(c.utilisation, 0)} of limit`) : null, c.rate !== null && c.rate >= 0.2 ? ui.h("span", { class: "pill warn" }, `${fmt.pct(c.rate, 1)}`) : null),
        c.utilisation !== null ? ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(c.utilisation * 100))}%`, background: c.utilisation > 0.3 ? "var(--warn)" : "var(--ok)" } })) : null,
        ui.h("div", { class: "d" }, detailLine(c)),
        // what you really pay first (the Debts page's payment), then the minimum-payment trap beside it
        c.paying ? ui.h("div", { class: "d", style: { color: "var(--text)" } }, `You pay ${fmt.money(c.paying.payment, cur)} a month: ${c.paying.never ? "it never ends at that payment" : `paid off ${c.paying.endDate ? `about ${monthYear(c.paying.endDate)}` : `in ${monthsText(c.paying.months)}`}${c.paying.interest ? `, ${fmt.money(c.paying.interest, cur)} of interest to come` : ""}`}.`) : null,
        // what the bank asks shrinks with the balance (round 8, 2026-11-06): that first, as a range; then today's minimum kept up
        c.bank ? ui.h("div", { class: "d", style: { color: "var(--text)", marginTop: "6px" } }, bankLine(c)) : null,
        keepLine(c) ? ui.h("div", { class: "d", style: { color: "var(--text)", marginTop: "4px" } }, keepLine(c)) : null,
        transferLine(c) ? ui.h("div", { class: "d", style: { marginTop: "6px" } }, transferLine(c)) : null),
      ui.h("span", { class: "st", style: { fontWeight: "600" } }, fmt.money(c.balance, cur))))),
    d.cards.some((c) => c.bank && !["full", "floor"].includes(c.bank.kind)) ? ui.h("p", { class: "muted small" }, `Most banks ask for the month's interest plus ${fmt.pct(ISSUER_SHARE, 0)} of what you owe (at least ${money(ISSUER_FLOORS.low)} to ${money(ISSUER_FLOORS.high)}), so the time is a range; each statement's Minimum Payment Warning box shows your bank's own figure.`) : null,
  ));
  // a balance carried and either the cards over half full, or little left each month (under $100 after bills, saving and the debt
  // plan, Next best action) with less cash in the bank than is owed on the cards (all of it, goal money too: Liquidity's nowAll):
  // a nonprofit counselor's debt management plan is worth a call (round 8, 2026-11-06; review: not for a household that pays its
  // card in full, or one with the cash to clear it; CFPB, "What is credit counseling?")
  let spare = null, cash = null;
  try { const nb = ctx.computeOf?.("overview/next-best-action", { today: fmt.today() }); spare = nb?.ready ? nb.spare?.monthly ?? null : null; } catch { spare = null; }
  try { const lq = ctx.computeOf?.("balance/liquidity", { today: fmt.today() }); cash = Number.isFinite(lq?.nowAll) ? lq.nowAll : Number.isFinite(lq?.now) ? lq.now : null; } catch { cash = null; }
  const overHalf = d.utilisation !== null && d.utilisation > 0.5, tight = spare !== null && spare < 100 && cash !== null && cash < d.totalBalance;
  if (d.carried && (overHalf || tight)) root.append(ui.card("If the payments are hard to keep up",
    ui.h("p", {}, "A nonprofit credit counselor can go through your budget with you and may offer a debt management plan: you make one payment a month to them, they pay the card companies, often at lower interest and fees. nfcc.org (National Foundation for Credit Counseling) and fcaa.org (Financial Counseling Association of America) can point you to one, and most work by phone or online as well as in person. Before you pay anything, check that your card companies have agreed to the plan.")));
  const monthsIn = ui.input({ type: "number", value: d.promoMonths, min: 1, max: 36, step: "1", "aria-label": "Promo months" });
  const feeIn = ui.input({ type: "number", value: Math.round(d.feePct * 100 * 10) / 10, min: 0, max: 10, step: "0.5", "aria-label": "Transfer fee percent" });
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  // round 8 (2026-11-06): a saving that holds only if a 0% card is granted, and the limit it gives may be smaller than the debt;
  // review: when the month cannot carry what clearing the cards in time takes, say so, and what the 0% months do at today's payments
  const tp = d.transferPlan;
  const short = tp && spare !== null && spare < tp.payToClear - tp.paying - 0.5;
  const them = !tp ? "" : tp.count === 1 ? "it" : tp.count === 2 ? "both" : `all ${["three", "four", "five", "six"][tp.count - 3] ?? tp.count}`;
  // nothing carried (every card paid in full): no interest for a transfer to save, so no offer to compare
  if (d.carried) root.append(ui.card("Balance transfer offer to compare",
    ui.h("p", { class: "muted small" }, `Each card's saving above uses these months and fee, and needs a card company to approve you. A 0% card usually needs good credit, and its limit may not take all ${fmt.money(d.totalBalance, cur)} you owe on cards.`),
    short ? ui.h("p", {}, `Clearing ${them} in ${d.promoMonths} months takes about ${money(tp.payToClear)} a month, ${money(tp.payToClear - tp.paying)} more than you pay on ${tp.count === 1 ? "it" : "them"} now, and your month ${spare >= 0 ? `has about ${money(spare)} to spare` : `is already about ${money(-spare)} short`}.${tp.atPay.saves > 0.5 ? ` At what you pay now (${money(tp.paying)} a month), the 0% months would save about ${roughMoney(tp.atPay.saves)} of interest and leave about ${roughMoney(tp.atPay.owedAfter)} to pay when they end.` : ""}`) : null,
    ui.h("div", { class: "form" }, ui.field("Promotional 0% months", monthsIn, "typical offers: 12 to 21"), ui.field("Transfer fee, percent", feeIn, "typical: 3 to 5")),
    ui.row(ui.button("Use these numbers", () => { pending = "Using these numbers."; store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), transfer: { months: Math.max(1, Number(monthsIn.value) || 15), feePct: Math.max(0, Number(feeIn.value) || 0) / 100 } }; }); })), out));
}
