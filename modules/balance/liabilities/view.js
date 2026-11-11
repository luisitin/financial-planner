// modules/balance/liabilities/view.js -- DOM only. Totals, a tappable list of debts, and one
// form for the selected debt's rate and payments.
import { compute, HIGH_RATE, DTI_LINES, rentsHome, shownShare, renterLevel } from "./compute.js";
import { isGuess, clearGuess } from "../../../core/estimate/index.js";
import { twoDates, compute as computePayoff } from "../../debt/payoff/compute.js";
import { escrowBefore, escrowKept, answerEscrow, escrowSaid } from "../../overview/guesses/estimators/home.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;
// "July 2030" from an ISO date (view-only wording, design log 2026-09-15).
const monthYear = (iso, locale) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(locale, { month: "long", year: "numeric" }); };

// the address #/balance/liabilities/<id> opens that debt's form once; the redraw after a save has the same route object
let landedOn = null;
let pendingBack = null;   // { href, label }: "Back to Mortgage ›" on the green line after a save
// a card has no loan length, start or security; a loan has no credit limit (j-debt-fixer D3: seven boxes for every debt,
// with Save below the screen)
const CARD_ONLY = new Set(["creditLimit"]), LOAN_ONLY = new Set(["termMonths", "startDate", "securedBy"]);
const fieldsFor = (type) => FIELDS.filter((f) => type === "credit" ? !LOAN_ONLY.has(f.key) : !CARD_ONLY.has(f.key))
  .map((f) => f.key === "creditLimit" ? { ...f, label: "Credit limit" } : f.key === "termMonths" ? { ...f, help: "for loans with a fixed term, e.g. 360 for a 30-year mortgage" } : f);
const FIELDS = [
  { key: "rate", label: "Interest rate per year", type: "percent", required: true, min: 0, max: 100, help: "on the statement; type 22.9 for 22.9%" },
  { key: "minPayment", label: "Required payment each month", type: "money", required: true, min: 0, help: "the minimum the lender asks for" },
  { key: "extra", label: "Extra you pay each month", type: "money", min: 0, help: "on top of the required payment; leave blank for none" },
  { key: "termMonths", label: "Loan length in months", type: "number", min: 0, step: "1", help: "for loans with a fixed term, e.g. 360 for a 30-year mortgage; leave blank for cards" },
  { key: "startDate", label: "Started", type: "date" },
  { key: "securedBy", label: "What it is borrowed against", type: "text", placeholder: "e.g. the house or the car", help: "leave blank if nothing" },
  { key: "creditLimit", label: "Credit limit (cards only)", type: "money", min: 0, help: "the Credit cards page shows how much of it you use" },
];
// a mortgage on the home you live in: is the tax and insurance in the payment? (2026-11-07: a payment typed from a statement
// usually holds them, and only what is left pays the loan off)
const ESCROW_FIELDS = (guess) => [
  { key: "escrowSaid", label: "Does this payment include property tax and home insurance?", type: "select", options: [{ value: "", label: "Choose one" }, { value: "yes", label: "Yes" }, { value: "no", label: "No, I pay them myself" }, { value: "unsure", label: "Not sure" }], help: "Most mortgage payments do: the lender keeps an escrow account and pays the two bills for you. Not sure? We count the usual amount in it, as our guess." },
  // (shown only under Yes: fix round 1, 2026-11-11; it sat under "No" with help that contradicted it, and a figure typed there was dropped)
  { key: "escrowMonthly", label: "Of that, tax and insurance a month (if you know it)", type: "money", min: 0, placeholder: guess ? `about ${Math.round(guess)}` : "", help: "On the statement as escrow. Blank: our guess of the usual amount." },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const renterTile = (d) => {
    const R = DTI_LINES.renter, level = renterLevel(d.dtiRequired), req = d.payments > d.minimums + 0.5 ? "required payments: " : "";
    return ui.stat("Debt payments vs income", fmt.pct(shownShare(d.dtiRequired), 0), level === "stretched" ? `${req}above ${fmt.pct(R.high, 0)}: stretched, even before rent`
      : level === "over" ? `${req}over the ${fmt.pct(R.good, 0)} guideline for renters (rent not counted)` : `${req}within the ${fmt.pct(R.good, 0)} guideline for renters`);
  };
  const d = compute(plan, { today: fmt.today() });
  const fresh = ctx.route !== landedOn; landedOn = ctx.route;
  let selected = fresh && ctx.route.rest?.[0] ? d.rows.find((r) => r.id === ctx.route.rest[0]) ?? null : null;
  const landedOnForm = !!selected;
  const backKey = /^[a-z0-9-]+\/[a-z0-9-]+$/.test(ctx.route.query?.back ?? "") ? ctx.route.query.back : null;
  const backMod = backKey ? ctx.modules?.get?.(backKey) : null;
  const backLink = backMod ? { href: `#/${backKey}`, label: `Back to ${backMod.title} ›` } : null;

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What do you owe?"),
      ui.h("p", { class: "lede" }, "Add each loan, credit card and the mortgage as an account on the Net worth page (pick a loan or card type). Then come back here to enter its interest rate and payment: the plan works out when each one is gone and what the interest costs you."),
      // Net worth's add form set to a loan or card, and back here to its rate and payment after the save (B4, DP-3)
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth?add=debt&back=balance/liabilities" }, "Add a loan or card")),
    ));
    return;
  }

  root.append(ui.card(null, ui.row(
    ui.stat("You owe", fmt.money(d.owed, cur), `${d.count} ${d.count === 1 ? "debt" : "debts"}${d.avgRate !== null ? `, average rate ${fmt.pct(d.avgRate, 1)}` : ""}`),
    ui.stat("Paying each month", fmt.money(d.payments, cur), d.payments > d.minimums ? `${fmt.money(d.minimums, cur)} required plus extra` : "the required payments"),
    d.interestMonthly ? ui.stat("Interest each month", fmt.money(d.interestMonthly, cur), "what borrowing costs you right now") : null,
    // a renter's required payments against the renters' line (CFPB: 15 to 20% or less, rent not counted); a homeowner's against
    // 36% (round 8, 2026-11-06: a renter's 21% read "under 36%: comfortable"; review: a renter's share is of the required
    // payments, as a lender counts them, and every share is graded at the percent shown)
    d.dti !== null ? (rentsHome(plan, d.rows) ? renterTile(d) : ui.stat("Debt payments vs income", fmt.pct(shownShare(d.dti), 0), shownShare(d.dti) > 0.43 ? "above 43%: lenders see this as stretched" : shownShare(d.dti) > 0.36 ? "above 36%: on the high side" : "under 36%: comfortable")) : null,
  )));
  // two or more costly debts: one notice with what they cost together, the order, and the one filled way on (D7); one costly
  // debt keeps its own sentence
  for (const w of d.stuck) root.append(ui.notice("warn", w));
  if (d.costly.count >= 2) {
    const lead = d.costly.before.length ? `the ${d.costly.before.join(" and the ")} first, then ` : "";
    const named = d.costly.order.map((c, i) => i === 0 && !lead ? `${c.name} first (${Math.round(c.rate * 1000) / 10}%)` : c.name);
    const list = named.length === 2 ? `${named[0]}, then ${named[1]}` : `${named.slice(0, -1).join(", then ")}, then ${named[named.length - 1]}`;
    root.append(ui.h("div", { class: "notice warn" }, `${d.costly.count} debts cost about ${fmt.money(Math.round(d.costly.interestMonthly), cur)} a month in interest. ${d.order === "avalanche" ? "Pay them down in this order" : "Your payoff plan pays them in this order"}: ${lead}${list}.`,
      ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn", href: "#/debt/payoff" }, "See my payoff plan"))));
  } else for (const w of d.warnings.filter((x) => !d.stuck.includes(x))) {
    // one costly debt: its sentence with the same one filled way on (Needs attention sends people here; MR-7's other half)
    const n = ui.notice("warn", w);
    if (d.costly.count === 1) n.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn", href: "#/debt/payoff" }, "See my payoff plan")));
    root.append(n);
  }
  if (d.withDetail < d.count) root.append(ui.notice("info", `${d.count - d.withDetail} of your debts ${d.count - d.withDetail === 1 ? "has" : "have"} no rate or payment yet. Tap it below to add them.`));

  const formHost = ui.h("div");
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!selected) return;
    const r = selected;
    const values = r.detail ? { ...r.detail } : {};
    const title = ui.h("h2", { tabindex: "-1", style: { marginTop: "20px" } }, `${r.name}: rate and payments`);
    // the escrow question: for a mortgage that is not a rental's loan (a rental's tax and insurance are its running costs)
    const homeLoan = r.type === "mortgage" && !(plan.property ?? []).some((e) => e?.kind === "rental" && e.loanAccountId === r.id);
    const ourEsc = r.detail && typeof r.detail.id === "string" && isGuess(plan, `debts[${r.detail.id}].escrowMonthly`);
    if (homeLoan) { values.escrowSaid = r.detail ? escrowSaid(plan, r.detail) ?? "" : ""; values.escrowMonthly = r.detail && !ourEsc && Number(r.detail.escrowMonthly) > 0 ? r.detail.escrowMonthly : null; }
    const shown = fieldsFor(r.type);
    const fields = homeLoan ? [...shown.slice(0, 2), ...ESCROW_FIELDS(r.escrow > 0 ? r.escrow : null), ...shown.slice(2)] : shown;
    const theForm = ui.form(fields, values, (v) => {
        // a box the form does not show for this kind keeps what is on file
        const keep = (k, x) => (k in v ? x : values[k] ?? (k === "startDate" || k === "securedBy" ? "" : null));
        const clean = { accountId: r.id, rate: v.rate ?? 0, minPayment: v.minPayment ?? 0, extra: v.extra ?? 0, termMonths: keep("termMonths", v.termMonths ?? null), startDate: keep("startDate", v.startDate || ""), securedBy: keep("securedBy", (v.securedBy || "").trim()), creditLimit: keep("creditLimit", v.creditLimit ?? null) };
        pending = `Saved ${r.name}.`; pendingBack = backLink;
        // the tax and insurance a guessed payment held (kept when the same payment is saved, so the payoff does not jump)
        const held = escrowBefore(plan, fmt.today());
        store.update((p) => {
          p.debts = p.debts ?? [];
          const i = p.debts.findIndex((x) => x.accountId === r.id);
          if (i >= 0) p.debts[i] = { ...p.debts[i], ...clean }; else p.debts.push({ id: ui.uid(), ...clean });
          // saved from the form, the rate and payment are the person's (even unchanged): no longer our guesses (spec S2)
          if (i >= 0 && typeof p.debts[i].id === "string") for (const f of ["rate", "minPayment"]) clearGuess(p, `debts[${p.debts[i].id}].${f}`);
          const row = p.debts[i >= 0 ? i : p.debts.length - 1];
          if (homeLoan && v.escrowSaid) {
            // what the answer wrote, said with the save (fix round 1, 2026-11-11: a figure cut or not used went by without a word)
            const typedAmount = v.escrowSaid === "yes" && Number(v.escrowMonthly) > 0 ? Number(v.escrowMonthly) : null;
            const did = answerEscrow(p, row.id, v.escrowSaid, typedAmount, fmt.today());
            const now = Number(row.escrowMonthly) || 0;
            if (did === "typed" && typedAmount > now + 0.005) pending = `Saved ${r.name}. Tax and insurance cannot be more than the payment, so we used ${fmt.money(now, cur)}.`;
            else if (did === "ours" && now > 0.5) pending = `Saved ${r.name}. We count about ${fmt.money(Math.round(now), cur)} of the payment as property tax and home insurance: our guess of the usual amount.`;
            else if (did === "ours") pending = `Saved ${r.name}. This payment leaves no room for property tax and home insurance, so we count none in it. If your statement shows an amount, choose Yes and type it.`;
            else if (did === "ask") pending = `Saved ${r.name}. We could not work out the usual property tax and home insurance for this loan: choose Yes and type the amount from your statement.`;
          } else escrowKept(p, held, fmt.today());
        });
        selected = null;
      }, { submitLabel: "Save", onCancel: () => { selected = null; drawForm(); } });
    // the amount box shows only under "Yes" (as on Get started)
    const saidBox = theForm.querySelector("[name=escrowSaid]"), amountBox = theForm.querySelector("[name=escrowMonthly]")?.closest("label");
    if (saidBox && amountBox) { const show = () => { const on = saidBox.value === "yes"; amountBox.hidden = !on; amountBox.style.display = on ? "" : "none"; }; saidBox.addEventListener("change", show); show(); }   // (display too: the form's own label style shows a [hidden] label)
    formHost.append(ui.h("div", {},
      title,
      ui.h("p", { class: "muted small" }, `${fmt.money(r.owed, cur)} owed. The balance itself is edited on the Net worth page.`),
      theForm,
      r.detail ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Clear these details", () => { if (ui.confirm(`Clear the rate and payments for ${r.name}?`)) { const id = r.id; selected = null; pending = `Cleared ${r.name}.`; store.update((p) => { p.debts = (p.debts ?? []).filter((x) => x.accountId !== id); }); } }, { class: "secondary" })) : null,
    ));
  };

  let two = {};
  try { two = twoDates(plan, { today: fmt.today() }); } catch { two = {}; }
  // the saved order costs more interest than highest rate first? (verify 2026-11-07: an own order that is highest rate first read
  // "Paying the highest interest rate first would save more"; Pay off debts works both, so the note says it only when it is so)
  let dearer = false;
  if (d.order !== "avalanche") try { const po = computePayoff(plan, { today: fmt.today() }); dearer = po?.plans?.[po.order]?.totalInterest - po?.plans?.avalanche?.totalInterest >= 0.5; } catch { dearer = false; }
  const sub = (r) => {
    if (!r.detail) return "add the rate and payment";
    // paid off: nothing is due any more, so no payment is said (it counts as $0 a month)
    // a date holds only while the same payment is kept up (round 8, 2026-11-06: a card's bank minimum shrinks with the
    // balance, so "on its own payment" read as "paying the minimum"); the payment is said once, in the date
    const dated = !r.paidOff && !r.neverPaysOff && r.months !== 0 && !!r.payoffDate;
    const bits = r.paidOff || dated ? [`${fmt.pct(r.rate, 1)}`] : [`${fmt.pct(r.rate, 1)}`, `${fmt.money(r.payment, cur)} a month`];
    const keep = `if you keep paying ${fmt.money(r.payment, cur)} a month`;
    if (r.neverPaysOff) bits.push("never pays off at this payment");
    else if (r.months === 0) bits.push("paid off");
    // the payoff plan finishes it sooner (finished debts' payments move onto it): both dates, so no page seems to disagree
    else if (r.payoffDate && two[r.id]) bits.push(`paid off by ${monthYear(r.payoffDate, plan.meta.locale)} ${keep}, ${monthYear(two[r.id].plan, plan.meta.locale)} on your payoff plan`);
    else if (r.payoffDate) bits.push(`paid off by ${monthYear(r.payoffDate, plan.meta.locale)} ${keep}`);
    // a mortgage payment that holds tax and insurance: say the split where the payoff is printed (fix round 1, 2026-11-11: the whole
    // payment stood beside a payoff worked from the rest of it, and nothing said so)
    if (!r.paidOff && r.escrow > 0.5) bits.push(`${fmt.money(r.escrow, cur)} of the payment is property tax and home insurance${r.escrowOurs ? " (our guess)" : ""}; the other ${fmt.money(r.payment - r.escrow, cur)} pays the loan`);
    if (r.totalInterest) bits.push(`${fmt.money(r.totalInterest, cur)} interest to come`);
    if (r.securedBy) bits.push(`secured by ${r.securedBy}`);
    return bits.join(" · ");
  };
  // one muted line on a debt whose figures are our guesses (spec 9.4), and, when its balance and rate are both ours, its
  // interest said calmly instead of the amber "expensive" (spec P7: a guess never turns a figure amber by itself)
  const ours = (r) => [isGuess(plan, `accounts[${r.id}].balance`) ? "what's owed" : null, r.detail && isGuess(plan, `debts[${r.detail.id}].rate`) ? "the rate" : null, r.detail && isGuess(plan, `debts[${r.detail.id}].minPayment`) ? "the payment" : null].filter(Boolean);
  const oursLine = (r) => { const o = ours(r); if (!o.length) return null; const w = o.length === 1 ? o[0] : `${o.slice(0, -1).join(", ")} and ${o[o.length - 1]}`; return ui.h("div", { class: "d muted" }, `${w[0].toUpperCase()}${w.slice(1)} ${o.length === 1 ? "is our guess" : "are our guesses"} for now: tap to type the real ${o.length === 1 ? "one" : "ones"}.${r.byGuesses && r.rate >= HIGH_RATE && r.interestMonthly ? ` By our guesses it costs about ${fmt.money(r.interestMonthly, cur)} a month in interest.` : ""}`); };
  const out = ui.h("div");
  // opened from another page to give a debt its rate (Mortgage, Refinance, Credit cards, Pay off debts): the green line after the
  // save carries the way back there, and stays (walk 2026-11-11: you were left on Debts with no word of what comes next)
  if (pending) {
    const n = ui.notice("ok", pending); out.append(n);
    if (pendingBack) n.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.h("a", { class: "btn", href: pendingBack.href }, pendingBack.label)));
    else setTimeout(() => n.remove(), 4000);
    pending = null; pendingBack = null;
  }
  root.append(ui.card("Your debts",
    ui.h("ul", { class: "page-list" }, d.rows.map((r) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { selected = r; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); formHost.querySelector("h2")?.focus({ preventScroll: true }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, r.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.name, " ", r.expensive ? ui.h("span", { class: "pill warn" }, "expensive") : null, !r.detail ? ui.h("span", { class: "pill" }, "needs details") : null), ui.h("div", { class: "d" }, sub(r)), oursLine(r)),
      ui.h("span", { class: "st" }, ui.h("div", {}, fmt.money(r.owed, cur)), ui.h("div", { class: "muted small", style: { textAlign: "right" } }, "Edit ›")),
    ))),
    ui.h("p", { class: "muted small" }, d.order === "snowball" ? `Your payoff plan pays the smallest balance first.${dearer ? " Paying the highest interest rate first would save more in interest." : ""}` : d.order === "custom" ? `Your payoff plan pays in the order you chose.${dearer ? " Paying the highest interest rate first would save more in interest." : ""}` : "Highest interest rate first: that is the order that saves the most if you pay extra.", " Tap a debt to enter or change its rate and payments."),
    Object.keys(two).length ? ui.h("p", { class: "small" }, "On your payoff plan, each debt's payment moves onto the next one once it is paid off, so the later ones end sooner without paying more each month.") : null,
    // its own 44 px button (B8, FF8: a link broken over two lines, 19 px each); not twice when the costly notice has it
    Object.keys(two).length && d.costly.count < 1 ? ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Open my payoff plan")) : null,
    // a loan or card not on the list: this page had no way to add one (D1)
    ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth?add=debt&back=balance/liabilities" }, "+ Add a loan or card")),
    out, formHost,
  ));
  drawForm();
  // opened at one debt (#/balance/liabilities/<id>, from Pay off debts, Mortgage or Net worth): its form in view
  if (landedOnForm) { formHost.scrollIntoView({ block: "start" }); formHost.querySelector("h2")?.focus({ preventScroll: true }); }
}
