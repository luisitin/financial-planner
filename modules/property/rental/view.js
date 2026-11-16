// modules/property/rental/view.js -- DOM only. Each rental from rent to cash in hand: the headline figures,
// the year line by line, the checks a lender makes, the tax with depreciation, the whole return; its details under an
// outlined "Change <name>" (the form opens under the button: five boxes, the rest under "More details (optional)"); then
// one quiet row drawn by core/ui/more.js, "The year's rent and costs" (the bank lines tied to each rental, laid out like
// Schedule E, with a CSV and a printout for a tax preparer: books.js); another rental behind "+ Add another rental".
import { compute, DEFAULTS, DSCR_MIN, RECOVERY_YEARS, addToNetWorth, keepLoanDetails, livedIn, linkedWords } from "./compute.js";
import { books, booksSentence, rentalSentence, rentBridge, depSentence, mortgageSentence, loanSentence, untiedSentence, booksStatus, booksFile, booksCsv, formRows, shownRentals, howLines, BOOKS_TITLE, HOW_STATUS, PASSIVE_LINE, PREPARER_LINE, SCREEN_PREPARER, NOT_IN_PLAN } from "./books.js";
import { parts, links, choice } from "../../../core/ui/more.js";
import { reportFrame, rtable, printSheet } from "../../reports/report-kit.js";

let pending = null;   // the confirmation shown on the next render
let askNo = null;     // the rental whose "No, a different place" waits for "Add a second home" (review 2026-11-06, UX 1)
let bookYear = null;  // the year picked on "The year's rent and costs" (this visit only: never in the plan)
/** The visit a picked year belongs to: the address drawn (a new one on every arrival, Back included; the same one on the
 *  redraw after a save or a pick) and the plan (another household loaded in the same tab). Either changes: the pick goes. */
let visit = { route: null, plan: null };
let booksKeep = false; // a year was just picked with no shell redraw at hand: the part stays open on the redraw that follows (R17)

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
  const planKey = plan?.meta?.createdAt ?? null;
  if (visit.route !== (ctx.route ?? null) || visit.plan !== planKey) { bookYear = null; visit = { route: ctx.route ?? null, plan: planKey }; }
  // a year picked that no longer has a line tied (lines removed meanwhile): back to the year shown by itself
  if (bookYear !== null && books(plan, { today, year: bookYear }).case !== "some") bookYear = null;
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "rn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const redraw = () => { page.innerHTML = ""; render(page, ctx); };
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Rental property"),
      ui.h("p", { class: "lede" }, "What a rental really earns after empty months, its costs, the loan and tax. Its value and the rent are enough to start.")));
    // an empty list keeps its add form open (docs/OPTIONAL.md R20): five boxes, the rest under "More details (optional)"
    root.append(ui.card("Add a rental", editor(null)));
    return;
  }

  // a form that opens under its outlined button (the kit's openUnder; a plain node after it on the test stand-in): the button
  // stays, a second tap or Cancel shuts the form and the focus goes back to the button (the vehicles page's pattern)
  function opensUnder(label, build) {
    let close = null;
    const shut = () => { const c = close; close = null; c?.(); btn.setAttribute?.("aria-expanded", "false"); };
    const btn = ui.button(label, () => {
      if (close) { shut(); return; }
      if (ui.openUnder && row.parentElement) close = ui.openUnder(row, (holder) => holder.append(build(shut)));
      else { const holder = ui.h("div"); row.after(holder); holder.append(build(shut)); close = () => holder.remove(); }
      btn.setAttribute?.("aria-expanded", "true");
    }, { class: "secondary", "aria-expanded": "false" });
    const row = ui.row(btn);
    return row;
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
      const link = (a) => () => { pending = linkedWords(a.name, r.name); askNo = null; store.update((p) => { const x = (p.property ?? []).find((y) => y.id === r.id); if (x) x.accountId = a.id; }); };
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
    ), opensUnder(`Change ${r.name}`, (shut) => editor(src, shut))));
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
      if (r.lossUsable > 0.5) return `${intro} ${money(r.lossUsable)} of it counts this year${saving}${many ? ": its share of what your rentals' profits and the allowance can take, split by the size of each rental's loss" : ""}. ${money(r.lossCarried)} waits for a year with rental profit, or the sale. ${d.lossRoom > 0.5 ? `At your income up to ${money(d.lossRoom)} of rental losses can come off other income this year (${shrink}${d.rates.separate ? " filing separately" : ""}).` : d.separateTogether ? "Filing separately while living with your spouse, none of it can come off other income this year (if you lived apart all year, check that box on the Federal estimate)." : `At your income the allowance that lets rental losses come off other income is gone (it ends at ${money(R.to)}${d.rates.separate ? " filing separately" : ""}).`}`;
      if (d.separateTogether) return `${intro} You file separately and lived with your spouse during the year, so a rental loss cannot lower your other income this year${P.profits > 0.5 ? ` (only your rentals' profit can absorb it)` : ""}: ${money(r.lossCarried)} waits for a year with rental profit, or the sale. If you lived apart all year, check that box on the Federal estimate.`;
      return `${intro} At your income (${money(d.rates.magi)}${d.rates.onReturn ? ` on ${d.rates.onReturn}'s return` : ""}) the allowance that lets rental losses come off other income is gone: ${shrink}${d.rates.separate ? " filing separately" : ""}. ${money(r.lossCarried)} waits for a year with rental profit, or the sale.`;
    };
    root.append(ui.card("Tax", ui.h("p", {}, `Depreciation: the building (${money(r.basis)}, the price less the land) is written off over ${RECOVERY_YEARS} years: ${money(r.depreciation)} this year. It lowers the tax without costing cash.`),
      ui.h("p", {}, r.taxable >= 0 ? `Taxable rent after costs, interest (${money(r.interest)}) and depreciation: ${money(r.taxable)}. ${many ? (r.tax > 0.5 ? `On its own it adds about ${money(r.tax)} to this year's tax${P.losses > 0.5 ? `; your other rentals' losses are counted on their own lines${Math.abs(d.tax.total) < 0.5 ? ", and together they cancel" : ""}` : ""}.` : "It adds no tax this year.") : `Added to your other income it raises this year's tax by about ${money(r.tax)}.${niitText}`}` : lossText()),
      // the depreciation taken so far (round 8 batch 6 review, item 26's next step: the person had to add up seven years)
      ui.h("p", { class: "rn-d" }, `${r.depreciationTaken > 0.5 ? `Depreciation taken so far: about ${money(r.depreciationTaken)}, since ${src.purchaseDate ? new Date(`${String(src.purchaseDate).slice(0, 7)}-15T12:00:00`).toLocaleDateString(plan.meta.locale, { month: "long", year: "numeric" }) : "it was first rented"}. When you sell, that part of the gain is taxed at up to 25%, and any loss still waiting can then be used.` : "When you sell, the depreciation taken is taxed back at up to 25%, and any loss still waiting can then be used."} The federal estimate counts your rentals as they are worked here, after costs, interest and depreciation${d.incomeRent > 0 ? `, in place of the ${money(d.incomeRent)} of rent the Income page lists` : ""}.`)));

    root.append(ui.card("What it adds to your wealth", ui.h("p", {}, `${signed(r.cashFlow)} of cash, ${money(r.principal)} of loan paid down and about ${money(r.growth)} of growth in value (${pct(src.appreciation ?? DEFAULTS.appreciation)} a year): ${money(r.totalReturn)}${r.returnOnEquity !== null ? `, ${pct(r.returnOnEquity)} on your ${money(r.equity)} of equity` : ""}.`)));
  }

  // one quiet row: the year's books from the bank lines tied to each rental (books.js), shut until tapped; once a line is
  // tied, "How this is worked out" beside it says how lines tie and sort (review P5: parts never nest, R11, so it is a row of
  // the same card, not a fold inside the books)
  const b = books(plan, { today, year: bookYear });
  // the printout is drawn here on "Print this list", beside the part and not in it (shown only by the printer): drawn inside,
  // its sheet made the shell lose the part's open state on the next save's redraw (walk, 2026-11-16)
  const sheetHost = ui.h("div");
  root.append(parts(ctx,
    b.case === "some" && { id: "books-how", kind: "how", says: HOW_STATUS, body: () => howLines(b).map((t) => ui.h("p", {}, t)) },
    { id: "books", kind: "item", title: BOOKS_TITLE, says: booksStatus(b), open: booksKeep || undefined, body: () => booksBody(b) }), sheetHost);
  booksKeep = false;
  // another rental: behind an outlined button while the list has one (docs/OPTIONAL.md R20)
  root.append(ui.card(null, opensUnder("+ Add another rental", (shut) => editor(null, shut))));
  root.append(links(ctx, [
    { href: "#/balance/net-worth", ask: "What is everything you own worth?" },
    { href: "#/taxes/federal", ask: "What do your rentals add to this year's tax?" },
  ]));

  // a year picked: the shell's redraw (ctx.redraw) carries the sections the person opened, so the part stays open now and
  // after a later save's redraw (core/place.js); without it (a test's stand-in) the part is opened for the next draw (R17)
  function redrawBooks() { if (typeof ctx.redraw === "function") ctx.redraw(); else { booksKeep = true; redraw(); } }
  // "The year's rent and costs": the case's sentence, each rental's lines of the form, depreciation and interest, the file and
  // the printout for a tax preparer. Nothing in it is saved; a year picked is for this visit.
  function booksBody(b) {
    const h = ui.h, out = [];
    const first = booksSentence(b);
    const toLedger = (one) => h("a", { href: one ? `#/transactions/ledger?q=${encodeURIComponent(`#${one.tag}`)}` : "#/transactions/ledger", class: "small", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, one ? `See ${one.name}'s lines on Transactions ›` : "Open Transactions ›");
    // years: every year with a tied line, and the one shown, low to high
    const years = [...new Set([...b.years, b.year])].sort((x, y) => x - y);
    const yearChips = years.length > 1 ? choice(ctx, { id: "books-year", label: "Which year", presets: years.map((y) => ({ value: y, label: String(y) })), value: b.year, onPick: (y) => { bookYear = y; redrawBooks(); } }) : null;
    if (first) return [h("p", {}, first), yearChips, toLedger(null)];
    out.push(yearChips);
    const many = b.rentals.length > 1;
    for (const r of b.rentals) {
      if (many) out.push(h("h3", {}, r.name));
      out.push(h("p", {}, rentalSentence(r, b.year, money, b.thisYear)));
      if (!r.count) continue;
      // the rent above is a full year at the rent typed; these are the bank lines' (review P2): one sentence between the two
      const bridge = rentBridge(r, d.rentals.find((x) => x.id === r.id)?.rent, b.year, b.thisYear, money, many);
      if (bridge) out.push(h("p", { class: "rn-d" }, bridge));
      // one line each, like "The year, line by line" above, costs indented, no line of the form on the phone (review P3: the
      // file and the printout carry them); Other names the categories in it (the form asks for the list); "estimate" on an
      // interest worked from the loan
      const tag = (x) => (x.key === "other" && x.from.length ? ` · ${x.from.join(", ")}` : x.about ? " · estimate" : "");
      out.push(h("ul", { class: "rn-lines" }, [
        ...r.rows.map((x) => h("li", { class: x.key === "rents" ? null : "rn-sub" }, h("span", {}, x.label, tag(x) ? h("small", { class: "rn-d" }, tag(x)) : null), h("span", {}, x.key === "rents" ? signed(x.amount) : signed(-x.amount)))),
        h("li", { class: "rn-sub" }, h("span", {}, "Costs in all"), h("span", {}, signed(-r.expenses))),
        h("li", { class: "rn-tot" }, h("span", {}, "Profit or loss"), h("span", {}, signed(r.net))),
      ]));
      // a full year's depreciation is the row above and the Tax card's own sentence: said here only when it is partial or missing
      for (const t of [r.dep.state === "counted" ? null : depSentence(r, b.year, money), mortgageSentence(r, b.year, money), loanSentence(r, money)]) if (t) out.push(h("p", { class: "rn-d" }, t));
    }
    // the loss line only for a loss the books call one: not for a year that is over with months missing (review P1)
    if (b.rentals.some((r) => r.count && r.net <= -0.5 && (r.whole || b.year >= b.thisYear))) out.push(h("p", { class: "rn-d" }, PASSIVE_LINE));
    const u = untiedSentence(b, money);
    if (u) out.push(h("p", {}, u));
    const say = h("div", { "aria-live": "polite" });
    out.push(h("p", { class: "muted small" }, SCREEN_PREPARER), say,
      ui.row(ui.button("Save as a spreadsheet (CSV)", () => saveCsv(b, say), { class: "secondary" }), ui.button("Print this list", () => printList(b, sheetHost), { class: "secondary" })),
      toLedger(b.rentals.length === 1 ? b.rentals[0] : null));
    return out;
  }
  // the file for a tax preparer (core/csv.js through books.js; made on this phone, nothing sent anywhere): Tax lots' way
  function saveCsv(b, say) {
    const name = booksFile(b);
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([booksCsv(b)], { type: "text/csv;charset=utf-8" }));
      a.download = name; a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* gone */ } }, 5000);
      say.replaceChildren(ui.notice("ok", `${name} is downloading. Open it with Excel, Numbers or Google Sheets, or send it to your tax preparer.`));
    } catch (e) { say.replaceChildren(ui.notice("error", `The file could not be made: ${e.message}. Reload the page and try again.`)); }
  }
  // the printout: the report kit's sheet, drawn on the tap and shown only by the printer (scoped to this page's own class)
  function printList(b, host) {
    const title = `Rental books for ${b.year}, for your tax preparer`;
    const { wrap, sheet } = reportFrame(ui, { title });
    wrap.className = `${wrap.className} rn-print`;
    wrap.append(ui.h("style", {}, ".rn-print { display: none; } @media print { .rn-print { display: block !important; } }"));
    const rs = shownRentals(b), rows = formRows(b);
    const cell = (x, v) => (x.key === "net" ? signed(v) : x.total ? money(v) : Math.abs(v) < 0.005 ? "" : x.key === "rents" ? signed(v) : signed(-v).replace(/^−/, ""));
    const cols = [{ label: "Line", get: (x) => x.line }, { label: "Schedule E", get: (x) => x.form }, ...rs.map((r, i) => ({ label: r.name, num: true, get: (x) => cell(x, x.amounts[i]) }))];
    const notes = rows.filter((x) => x.notes.length).map((x) => `Line ${x.line}: ${x.notes.join("; ")}.`);
    sheet.append(ui.h("h1", {}, title), ui.h("p", { class: "rp-sub" }, `From the plan on ${fmt.date(today)}: the bank lines tied to ${rs.map((r) => r.name).join(" and ")} on Transactions.`),
      ui.h("p", { class: "rp-lead" }, rs.map((r) => rentalSentence(r, b.year, money, b.thisYear)).join(" ")),
      rtable(ui, cols, rows),
      ...notes.map((t) => ui.h("p", { class: "rp-foot" }, t)),
      ui.h("p", { class: "rp-foot" }, `${PREPARER_LINE} ${NOT_IN_PLAN}`));
    host.replaceChildren(wrap);
    if (typeof window !== "undefined" && typeof window.print === "function") printSheet(title, sheet);
  }

  // add or edit one rental
  // add or change one rental (the form opens under its outlined button, or in the empty page's card): the five boxes most
  // rentals need first (opt spec 6.1, property/rental: "five boxes and More details (optional) · other costs, the loan"), every
  // required box among them; the rest folded under "More details (optional)". The defaults are not typed into the boxes (a
  // typed default opened the fold by itself): an empty box saves nothing and counts what its help line says (running.js).
  function editor(r, onCancel) {
    const mortgages = (plan.accounts ?? []).filter((a) => a.type === "mortgage");
    // the Real estate accounts no other property entry names: "Its value" (round 8 batch 6)
    // never the home you live in (review 2026-11-06, UX 3: picking Home made the home you live in the rental), unless it is
    // already this rental's
    const lived = livedIn(plan);
    const homes = (plan.accounts ?? []).filter((a) => a.type === "property" && !(plan.property ?? []).some((e) => e.accountId === a.id && e.id !== r?.id) && (!lived.has(a.id) || a.id === r?.accountId));
    const pctOf = (v) => (v === null || v === undefined || v === "" ? "" : v);
    const values = r ? { ...r, loanAccountId: r.loanAccountId ?? "", accountId: r.accountId ?? "" } : { loanAccountId: "", accountId: "" };
    const left = (what) => `Left empty, we count ${what}.`;
    const pc = (x) => `${Number((x * 100).toPrecision(12))}%`;   // 0.035 is "3.5%", never "3.5000000000000004%"
    const form = ui.form([
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Duplex on Elm" },
      { key: "value", label: "What it is worth today", type: "money", min: 0, required: !homes.length, help: homes.length ? "used unless you pick the home from Net worth below" : null },
      homes.length ? { key: "accountId", label: "Its value on Net worth", type: "select", options: [{ value: "", label: "Not on Net worth" }, ...homes.map((a) => ({ value: a.id, label: `${a.name} (${money(Math.abs(Number(a.balance) || 0))})` }))], help: "pick it if Net worth already lists this home: it is then counted once, at the value there" } : null,
      // needed: the browser says so at the box (DP-2: the message went 1,200 px above the button); worth is needed only without a home picked
      { key: "rentMonthly", label: "Rent a month", type: "money", min: 1, required: true },
      { key: "propertyTax", label: "Property tax a year", type: "money", min: 0 },
      // the fifth box: insurance, unless "Its value on Net worth" took the place
      { key: "insurance", label: "Insurance a year", type: "money", min: 0, more: homes.length > 0 },
      { key: "purchasePrice", label: "What you paid", type: "money", min: 0, more: true, help: "the yearly tax write-off for wear and tear (depreciation) is worked from it" },
      { key: "purchaseDate", label: "When it was first rented out", type: "date", more: true, help: "the yearly tax write-off for wear and tear (depreciation) starts then" },
      { key: "vacancy", label: "Allowance for empty months", type: "percent", min: 0, max: 50, more: true, help: left(`${pc(DEFAULTS.vacancy)} of the rent`) },
      { key: "hoaMonthly", label: "Association dues a month", type: "money", min: 0, more: true },
      { key: "maintenance", label: "Repairs and upkeep, a year, as a share of the value", type: "percent", min: 0, max: 10, more: true, help: left(`${pc(DEFAULTS.maintenance)} of the value a year`) },
      { key: "management", label: "Property manager, as a share of rent", type: "percent", min: 0, max: 20, more: true, help: "Leave it empty if you manage it yourself." },
      { key: "utilitiesMonthly", label: "Utilities you pay, a month", type: "money", min: 0, more: true },
      { key: "otherMonthly", label: "Other costs a month", type: "money", min: 0, more: true },
      { key: "cashIn", label: "Cash you put in (down payment, closing, repairs)", type: "money", min: 0, more: true },
      { key: "loanAccountId", label: "Its mortgage", type: "select", more: true, options: [{ value: "", label: mortgages.length ? "Not one of my accounts (type it below)" : "Type it below" }, ...mortgages.map((a) => ({ value: a.id, label: a.name }))], help: mortgages.length ? "a mortgage picked here uses its balance from Net worth; its rate and payment come from Debts, or from below when Debts has none yet" : null },
      { key: "loanBalance", label: "Loan owed", type: "money", min: 0, more: true },
      { key: "loanRate", label: "Loan rate", type: "percent", min: 0, max: 20, more: true },
      { key: "loanPayment", label: "Loan payment a month (principal and interest)", type: "money", min: 0, more: true },
      { key: "landShare", label: "Land's share of the price (not depreciated)", type: "percent", min: 0, max: 90, more: true, help: `The county's assessment splits land and building. ${left(pc(DEFAULTS.landShare))}` },
      { key: "appreciation", label: "Value grows each year", type: "percent", min: -10, max: 15, more: true, help: left(`${pc(DEFAULTS.appreciation)} a year`) },
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
    }, { submitLabel: r ? "Save" : "Add rental", onCancel });
    if (!r) return form;
    const remove = ui.row(ui.button("Remove this rental", () => {
      if (!ui.confirm(`Remove ${r.name || "this rental"}?`)) return;
      pending = `${r.name || "Rental"} removed.`;
      store.update((p) => { p.property = (p.property ?? []).filter((x) => x.id !== r.id); });
    }, { class: "secondary" }));
    return ui.h("div", {}, form, remove);
  }
}
