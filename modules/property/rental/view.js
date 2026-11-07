// modules/property/rental/view.js -- DOM only. Each rental from rent to cash in hand: the headline figures,
// the year line by line, the checks a lender makes, the tax with depreciation, the whole return; editing in a
// fold; adding another behind an outlined button.
import { compute, DEFAULTS, DSCR_MIN, RECOVERY_YEARS, addToNetWorth, keepLoanDetails, livedIn } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let askNo = null;     // the rental whose "No, a different place" waits for "Add a second home" (review 2026-11-06, UX 1)

const STYLE = `
.rn-root .rn-lines { list-style: none; margin: 0; padding: 0; }
.rn-root .rn-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.rn-root .rn-lines li:last-child { border-bottom: 0; }
.rn-root .rn-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.rn-root .rn-lines .rn-sub span:first-child { padding-left: 14px; color: var(--text-2); }
.rn-root .rn-lines .rn-tot { font-weight: 700; }
.rn-root .rn-ok { color: var(--ok); } .rn-root .rn-warn { color: var(--warn); } .rn-root .rn-bad { color: var(--bad); }
.rn-root .rn-d { color: var(--text-2); font-size: var(--fs-sm); }
.rn-root .rn-nw .row { margin-top: 10px; }
.rn-root .rn-pick { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.rn-root .rn-pick button { width: 100%; min-height: 44px; text-align: left; white-space: normal; }
.rn-root .rn-nw .rn-d { margin-top: 10px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const signed = (n) => (n < -0.5 ? `−${money(-n)}` : money(n));
  const pct = (x, dp = 1) => `${(x * 100).toFixed(dp).replace(/\.0$/, "")}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "rn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const redraw = () => { page.innerHTML = ""; render(page, ctx); };
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Rental property"),
      ui.h("p", { class: "lede" }, "What a rental really earns: rent less empty months and running costs, less the loan, less tax, and what it adds to your wealth as the loan shrinks and the value grows."),
      ui.h("p", { class: "muted small" }, "Add the property below: its value, the rent and the main costs are enough to start.")));
    root.append(editor(null, true));
    return;
  }

  const P = d.passive, many = d.rentals.length > 1;
  const niitLine = d.rates.niitLine;
  const R = d.rule, shrink = `the allowance starts at ${money(R.max)}, shrinks by 50 cents for each dollar over ${money(R.from)} and ends at ${money(R.to)}`;
  const niitText = d.tax.niit > 0.5 ? ` That includes ${money(d.tax.niit)} of the 3.8% extra tax on investment income: rent counts once your income passes ${money(niitLine)}.` : "";
  if (many) root.append(ui.card(null, ui.row(
    ui.stat("Rent a year", money(d.totals.rent), `${d.rentals.length} properties`),
    ui.stat("Cash flow a year", signed(d.totals.cashFlow), `${signed(d.totals.afterTax)} after tax`),
    ui.stat("Equity", money(d.totals.equity), `in ${money(d.totals.value)} of property`),
  ), ui.h("p", {}, `${Math.abs(d.tax.total) < 0.5 ? `Together your rentals do not change this year's tax${P.losses > 0.5 && P.profits > 0.5 ? ": the losses cancel the profits" : ""}` : `Together your rentals ${d.tax.total > 0 ? "add" : "take"} about ${money(Math.abs(d.tax.total))} ${d.tax.total > 0 ? "to" : "off"} this year's tax${P.losses > 0.5 && P.profits > 0.5 ? `, after the profitable ones absorb the others' losses` : ""}`}${P.suspended > 0.5 ? `; ${money(P.suspended)} of loss waits for a later year` : ""}.${niitText}`)));

  for (const r of d.rentals) {
    const src = (plan.property ?? []).find((x) => x.id === r.id) ?? {};
    // entered once (round 8 batch 6, landlord-2): a rental only on this page is not in net worth, and one added again on Net
    // worth was listed twice; one tap puts it there, or links the account Net worth already has for it (review 2026-11-06,
    // UX 1 and 2: asked about by its name or by its value, never asserted; "No" says what it would do first)
    if (!r.onNetWorth) {
      const loanTyped = !r.loanAccountId && r.loan ? r.loan.balance : 0;
      const both = !r.accountId && loanTyped > 0;
      const what = both ? `its value (${money(r.value)}) and its loan (${money(loanTyped)}) are` : !r.accountId ? `its value (${money(r.value)}) is` : `its loan (${money(loanTyped)}) is`;
      // money 12: the payment is said only when there is one; else Debts is where it goes
      const add = () => { pending = `${r.name} added to your net worth${loanTyped > 0 ? (r.loan.payment > 0 ? `, with its loan on Debts at ${pct(r.loan.rate)} and ${money(r.loan.payment)} a month` : `. Its loan is on Net worth: add its rate and payment on Debts`) : ""}.`; askNo = null; store.update((p) => { addToNetWorth(p, r.id, { today, uid: ui.uid }); }); };
      const link = (a) => () => { pending = `Linked: the ${a.name} on Net worth is ${r.name}, counted once.`; askNo = null; store.update((p) => { const x = (p.property ?? []).find((y) => y.id === r.id); if (x) x.accountId = a.id; }); };
      const after = `your net worth would go from ${money(d.netWorth)} to ${money(d.netWorth + r.wouldAdd)}`;
      let card;
      if (r.twin && askNo === r.id) {
        // "No, a different place": what it would do, before it does it (UX 1: one tap added $260,000 that is not there)
        const close = r.value > 0 && Math.abs(r.twin.value - r.value) <= 0.1 * r.value;
        card = ui.h("section", { class: "card rn-nw" }, ui.h("h2", {}, `Add ${r.name} as a second home?`),
          ui.h("p", {}, `Net worth would then list two homes named ${r.name}${close ? `, ${money(r.twin.value + r.value)} in all,` : ""} and ${after}.${close ? ` With the same name and about the same value, they are probably the same place.` : ""}`),
          ui.row(ui.button("Add a second home", add, { class: "secondary" }), ui.button("Cancel", () => { askNo = null; redraw(); })));
      } else if (r.twin) {
        card = ui.h("section", { class: "card rn-nw" }, ui.h("h2", {}, `Is the ${r.twin.name} on your Net worth page this rental?`),
          ui.h("p", {}, `Net worth lists ${r.twin.name} at ${money(r.twin.value)}. If it is this rental, link them: it is then counted once, at the value there.`),
          ui.row(ui.button("Yes, the same place", link(r.twin)), ui.button("No, a different place", () => { askNo = r.id; redraw(); }, { class: "secondary" })));
      } else if (r.candidates?.length) {
        // UX 2: an account named otherwise may be it: one button each, the likeliest first, then "None of these"
        card = ui.h("section", { class: "card rn-nw" }, ui.h("h2", {}, r.candidates.length === 1 ? `Is ${r.candidates[0].name} on Net worth this rental?` : `Is one of these on Net worth this rental?`),
          ui.h("p", {}, `${what.charAt(0).toUpperCase()}${what.slice(1)} here, and may not be in your net worth yet. If Net worth already lists ${r.name} under another name, pick it so it is counted once.`),
          ui.h("div", { class: "rn-pick" }, ...r.candidates.map((a, i) => ui.button(`${a.name}, ${money(a.value)}`, link(a), { class: i === 0 && a.likely ? null : "secondary" })),
            ui.button(`None of these: add ${r.name}`, add, { class: "secondary" })),
          ui.h("p", { class: "rn-d" }, `Adding it: ${after}.`));
      } else {
        card = ui.h("section", { class: "card rn-nw" }, ui.h("h2", {}, `${r.name} is not in your net worth yet`),
          ui.h("p", {}, `${what.charAt(0).toUpperCase()}${what.slice(1)} only on this page, so your net worth leaves ${both ? "them" : "it"} out. Add ${both ? "them" : "it"} once and every page reads ${both ? "them" : "it"} from Net worth: ${after}.`),
          ui.row(ui.button("Add it to net worth", add)));
      }
      root.append(card);
    }
    root.append(ui.card(r.name, ui.row(
      ui.stat("Cash flow a year", signed(r.cashFlow), `${signed(r.cashFlow / 12)} a month, before tax`),
      ui.stat("Cap rate", r.capRate === null ? "—" : pct(r.capRate), "income after costs ÷ value"),
      r.cashOnCash !== null ? ui.stat("Cash-on-cash", pct(r.cashOnCash), `cash flow ÷ ${money(r.cashIn)} put in`) : null,
    )));
    const lines = [
      ["Rent", r.rent], [`Empty months (${pct(src.vacancy ?? DEFAULTS.vacancy, 0)})`, -r.vacancy, true],
      ...r.costs.map((c) => [c.label, -c.amount, true]),
      ["Income after running costs", r.noi, false, true],
      r.debtService ? ["Loan payments", -r.debtService, true] : null,
      ["Cash flow", r.cashFlow, false, true],
      [r.tax >= -0.5 ? "Tax on it" : "Tax it saves", Math.abs(r.tax) < 0.5 ? 0 : -r.tax, true],
      ["After tax", r.afterTax, false, true],
    ].filter(Boolean);
    root.append(ui.card(`The year, line by line`, ui.h("ul", { class: "rn-lines" }, lines.map(([label, amount, sub, tot]) => ui.h("li", { class: tot ? "rn-tot" : sub ? "rn-sub" : null }, ui.h("span", {}, label), ui.h("span", {}, signed(amount)))))));

    const checks = [];
    if (r.dscr !== null) checks.push(ui.h("li", {}, ui.h("span", { class: r.dscr >= DSCR_MIN ? "rn-ok" : r.dscr >= 1 ? "rn-warn" : "rn-bad" }, `Income covers the loan ${r.dscr.toFixed(2)} times. `), `Lenders usually want ${DSCR_MIN.toFixed(2)} or more${r.dscr < 1 ? "; below 1 the rent does not pay the loan" : ""}.`));
    if (r.breakEven !== null) checks.push(ui.h("li", {}, ui.h("span", { class: r.breakEven <= 0.85 ? "rn-ok" : r.breakEven <= 1 ? "rn-warn" : "rn-bad" }, `It breaks even rented ${pct(r.breakEven, 0)} of the year. `), r.breakEven < 1 ? `It can stand about ${((1 - r.breakEven) * 12).toFixed(1)} empty months a year before costing you money.` : "Even full, the rent does not cover costs and the loan."));
    if (r.onePercent !== null) checks.push(ui.h("li", {}, `Monthly rent is ${pct(r.onePercent, 2)} of the price paid. `, ui.h("span", { class: "rn-d" }, "Investors' quick screen asks for about 1%; few homes in costly areas reach it.")));
    root.append(ui.card("The checks a lender makes", ui.h("ul", {}, checks)));

    const lossText = () => {
      const intro = `A tax loss of ${money(-r.taxable)} after costs, interest (${money(r.interest)}) and depreciation.`;
      const saving = -r.tax > 0.5 ? `, saving about ${money(-r.tax)}` : P.profits > 0.5 ? ", against your other rentals' profit" : "";
      if (r.lossUsable > 0.5 && r.lossCarried <= 0.5) return `${intro} All of it counts this year${P.profits > 0.5 && P.againstOther > 0.5 ? `: your other rentals' profit absorbs part of it and the rest lowers your other income` : P.profits > 0.5 ? `: your other rentals' profit absorbs it` : ": it lowers your other income"}${-r.tax > 0.5 ? `, saving about ${money(-r.tax)}` : ""}.`;
      if (r.lossUsable > 0.5) return `${intro} ${money(r.lossUsable)} of it counts this year${saving}${many ? ": its share of what your rentals' profits and the allowance can take, split by the size of each rental's loss" : ""}. ${money(r.lossCarried)} waits for a year with rental profit, or the sale. ${d.lossRoom > 0.5 ? `At your income up to ${money(d.lossRoom)} of rental losses can come off other income this year (${shrink}${d.rates.separate ? " filing separately" : ""}).` : d.separateTogether ? "Filing separately while living with your spouse, none of it can come off other income this year (if you lived apart all year, tick that on the Federal estimate)." : `At your income the allowance that lets rental losses come off other income is gone (it ends at ${money(R.to)}${d.rates.separate ? " filing separately" : ""}).`}`;
      if (d.separateTogether) return `${intro} You file separately and lived with your spouse during the year, so a rental loss cannot lower your other income this year${P.profits > 0.5 ? ` (only your rentals' profit can absorb it)` : ""}: ${money(r.lossCarried)} waits for a year with rental profit, or the sale. If you lived apart all year, tick that on the Federal estimate.`;
      return `${intro} At your income (${money(d.rates.magi)}${d.rates.onReturn ? ` on ${d.rates.onReturn}'s return` : ""}) the allowance that lets rental losses come off other income is gone: ${shrink}${d.rates.separate ? " filing separately" : ""}. ${money(r.lossCarried)} waits for a year with rental profit, or the sale.`;
    };
    root.append(ui.card("Tax", ui.h("p", {}, `Depreciation: the building (${money(r.basis)}, the price less the land) is written off over ${RECOVERY_YEARS} years: ${money(r.depreciation)} this year. It lowers the tax without costing cash.`),
      ui.h("p", {}, r.taxable >= 0 ? `Taxable rent after costs, interest (${money(r.interest)}) and depreciation: ${money(r.taxable)}. ${many ? (r.tax > 0.5 ? `On its own it adds about ${money(r.tax)} to this year's tax${P.losses > 0.5 ? `; your other rentals' losses are counted on their own lines${Math.abs(d.tax.total) < 0.5 ? ", and together they cancel" : ""}` : ""}.` : "It adds no tax this year.") : `Added to your other income it raises this year's tax by about ${money(r.tax)}.${niitText}`}` : lossText()),
      // the depreciation taken so far (round 8 batch 6 review, item 26's next step: the person had to add up seven years)
      ui.h("p", { class: "rn-d" }, `${r.depreciationTaken > 0.5 ? `Depreciation taken so far: about ${money(r.depreciationTaken)}, since ${src.purchaseDate ? new Date(`${String(src.purchaseDate).slice(0, 7)}-15T12:00:00`).toLocaleDateString(plan.meta.locale, { month: "long", year: "numeric" }) : "it was first rented"}. When you sell, that part of the gain is taxed at up to 25%, and any loss still waiting can then be used.` : "When you sell, the depreciation taken is taxed back at up to 25%, and any loss still waiting can then be used."} The federal estimate counts your rentals as they are worked here, after costs, interest and depreciation${d.incomeRent > 0 ? `, in place of the ${money(d.incomeRent)} of rent the Income page lists` : ""}.`)));

    root.append(ui.card("What it adds to your wealth", ui.h("p", {}, `${signed(r.cashFlow)} of cash, ${money(r.principal)} of loan paid down and about ${money(r.growth)} of growth in value (${pct(src.appreciation ?? DEFAULTS.appreciation)} a year): ${money(r.totalReturn)}${r.returnOnEquity !== null ? `, ${pct(r.returnOnEquity)} on your ${money(r.equity)} of equity` : ""}.`)));
    root.append(editor(src, false));
  }
  root.append(editor(null, false));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Net worth"), ui.h("a", { class: "btn secondary", href: "#/taxes/federal" }, "Federal tax"))));

  // add or edit one rental
  function editor(r, open) {
    const mortgages = (plan.accounts ?? []).filter((a) => a.type === "mortgage");
    // the Real estate accounts no other property entry names: "Its value" (round 8 batch 6)
    // never the home you live in (review 2026-11-06, UX 3: picking Home made the home you live in the rental), unless it is
    // already this rental's
    const lived = livedIn(plan);
    const homes = (plan.accounts ?? []).filter((a) => a.type === "property" && !(plan.property ?? []).some((e) => e.accountId === a.id && e.id !== r?.id) && (!lived.has(a.id) || a.id === r?.accountId));
    const pctOf = (v) => (v === null || v === undefined || v === "" ? "" : v);
    const values = r ? { ...r, loanAccountId: r.loanAccountId ?? "", accountId: r.accountId ?? "" } : { vacancy: DEFAULTS.vacancy, maintenance: DEFAULTS.maintenance, landShare: DEFAULTS.landShare, appreciation: DEFAULTS.appreciation, loanAccountId: "", accountId: "" };
    const form = ui.form([
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Duplex on Elm" },
      { key: "value", label: "What it is worth today", type: "money", min: 0, help: homes.length ? "used while it is not picked on Net worth below" : null },
      homes.length ? { key: "accountId", label: "Its value on Net worth", type: "select", options: [{ value: "", label: "Not on Net worth" }, ...homes.map((a) => ({ value: a.id, label: `${a.name} (${money(Math.abs(Number(a.balance) || 0))})` }))], help: "pick it if Net worth already lists this home: it is then counted once, at the value there" } : null,
      { key: "purchasePrice", label: "What you paid", type: "money", min: 0 },
      { key: "purchaseDate", label: "When it was first rented out", type: "date", help: "depreciation starts then" },
      { key: "rentMonthly", label: "Rent a month", type: "money", min: 0 },
      { key: "vacancy", label: "Allowance for empty months", type: "percent", min: 0, max: 50 },
      { key: "propertyTax", label: "Property tax a year", type: "money", min: 0 },
      { key: "insurance", label: "Insurance a year", type: "money", min: 0 },
      { key: "hoaMonthly", label: "Association dues a month", type: "money", min: 0 },
      { key: "maintenance", label: "Repairs and upkeep, a year, as a share of the value", type: "percent", min: 0, max: 10 },
      { key: "management", label: "Property manager, as a share of rent", type: "percent", min: 0, max: 20 },
      { key: "utilitiesMonthly", label: "Utilities you pay, a month", type: "money", min: 0 },
      { key: "otherMonthly", label: "Other costs a month", type: "money", min: 0 },
      { key: "cashIn", label: "Cash you put in (down payment, closing, repairs)", type: "money", min: 0 },
      { key: "loanAccountId", label: "Its mortgage", type: "select", options: [{ value: "", label: mortgages.length ? "Not one of my accounts (type it below)" : "Type it below" }, ...mortgages.map((a) => ({ value: a.id, label: a.name }))], help: mortgages.length ? "a mortgage picked here uses its balance from Net worth; its rate and payment come from Debts, or from below when Debts has none yet" : null },
      { key: "loanBalance", label: "Loan owed", type: "money", min: 0 },
      { key: "loanRate", label: "Loan rate", type: "percent", min: 0, max: 20 },
      { key: "loanPayment", label: "Loan payment a month (principal and interest)", type: "money", min: 0 },
      { key: "landShare", label: "Land's share of the price (not depreciated)", type: "percent", min: 0, max: 90, help: "the county's assessment splits land and building" },
      { key: "appreciation", label: "Value grows each year", type: "percent", min: -10, max: 15 },
    ].filter(Boolean), { ...values, vacancy: pctOf(values.vacancy), maintenance: pctOf(values.maintenance), management: pctOf(values.management) }, (v) => {
      if (!(v.value > 0 || v.accountId) || !(v.rentMonthly > 0)) { form.prepend(ui.notice("error", "Type what it is worth and the monthly rent first.")); return; }
      // an account picked whose name and value are both far from this rental's: asked once before it is linked (UX 3)
      const picked = v.accountId && v.accountId !== r?.accountId ? homes.find((a) => a.id === v.accountId) : null;
      if (picked) {
        const pv = Math.abs(Number(picked.balance) || 0), rv = Number(v.value) || 0, nm = String(v.name ?? "").trim() || "this rental";
        if (String(picked.name ?? "").trim().toLowerCase() !== nm.toLowerCase() && rv > 0 && Math.abs(pv - rv) > 0.1 * rv && !ui.confirm(`${picked.name} is worth ${money(pv)} and ${nm} ${money(rv)}: is ${picked.name} really this rental?`)) return;
      }
      pending = r ? "Saved." : `${v.name || "Rental"} added.`;
      store.update((p) => {
        p.property = p.property ?? [];
        const item = { ...(r ?? { id: ui.uid(), kind: "rental" }), ...v, name: String(v.name ?? "").trim() };
        if (!item.accountId) delete item.accountId;
        p.property = r ? p.property.map((x) => (x.id === r.id ? item : x)) : [...p.property, item];
        // a mortgage picked with no rate or payment on Debts takes the ones typed here, so the loan is not dropped (landlord-2)
        if (keepLoanDetails(p, item, ui.uid)) pending = `${pending.replace(/\.$/, "")}. Its rate and payment are on Debts now too.`;
      });
    }, { submitLabel: r ? "Save" : "Add rental" });
    const remove = r ? ui.row(ui.button("Remove this rental", () => {
      if (!ui.confirm(`Remove ${r.name || "this rental"}?`)) return;
      pending = `${r.name || "Rental"} removed.`;
      store.update((p) => { p.property = (p.property ?? []).filter((x) => x.id !== r.id); });
    }, { class: "secondary" })) : null;
    const title = r ? `Change ${r.name || "this rental"}` : d.ready ? "+ Add another rental" : "Add a rental";
    return ui.h("details", { class: "card fold fold-card", open: open ? true : null }, ui.h("summary", {}, ui.h("h2", {}, title), ui.h("span", { class: "fold-chev" }, "›")), form, remove);
  }
}
