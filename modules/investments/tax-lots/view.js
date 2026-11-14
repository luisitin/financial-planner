// modules/investments/tax-lots/view.js -- DOM only. Losses worth harvesting first, the order to
// sell in, then one quiet card of optional parts (drawn by core/ui/more.js; docs/OPTIONAL.md): "How this is worked out"
// (how short- and long-term losses are counted; Settings' "Show how answers are worked out" opens it), "Compare ways to
// sell part of a fund" (which shares to sell first: two ways, and the purchases you pick once checked; only when a fund has
// two or more purchases) and "Sales for your tax return" (the year's sales, their totals, a CSV and a printout for a tax
// preparer); then each holding's lots, each card with its own folded "+ Add a lot".
import { compute, costAfterLot, shareText } from "./compute.js";
import { sellOrders, sellable, hasChoice, yearSales, salesYear, salesCsv, leastSentence, orderValue, orderLine, washLine, salesSentence, saleLine, ORDER_TITLES } from "./sell.js";
import { part, parts } from "../../../core/ui/more.js";
import { reportFrame, rtable, printSheet } from "../../reports/report-kit.js";

let pending = null;
let openFor = null;   // the holding whose "+ Add a lot" form is open (kept across a redraw, dropped after the add)
let showLot = null;   // the lot to bring into view on the next render (the one just added)
let sellJust = false; // "Compare ways to sell part of a fund" was just worked out: it stays open on the redraw that follows (R17)
let sellSaid = null;  // the green line that names the answer after "Work it out" (R7)
let draft = null;     // { fund, by, amount } typed but not worked out yet, kept while choosing another fund redraws the form

const LEAD = "Selling part of a fund? See what it does to your federal tax two ways: the oldest shares first (what counts as sold unless you tell the broker otherwise) and the shares that cost the most first (usually the least tax). You can also pick the purchases yourself.";
const TELL = "Before you sell, tell the broker which shares: choose the purchases on the sell screen (brokers often call it “specific lots”) and keep the confirmation they send. If you do not, the oldest shares count as sold first.";
const AVERAGE = "A mutual fund may be set to “average cost”, where every share counts as costing the same; then only the split between short- and long-term can change. The broker's cost-basis page says how each fund is set.";
const DATES = "The dates bought and sold are on the broker's Form 1099-B (boxes 1b and 1c): this list does not keep them.";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  const redraw = () => { root.replaceChildren(); render(root, ctx); };
  const today = fmt.today();
  const signed0 = (n) => (n < -0.005 ? `−${money(-n)}` : money(n));   // a total: the tiles, and the printout's line under the title
  // the year's sales (Capital gains' rows): counted here for the row's status; the list is built when the row is opened
  const salesN = (plan.taxes?.gains ?? []).length, salesFor = salesYear(plan, today);
  const salesPart = () => ({ id: "sales", kind: "item", title: "Sales for your tax return", says: salesN ? `${salesN} in ${salesFor}` : `none in ${salesFor}`, lazy: true, body: () => salesBody() });
  const salesBody = () => {
    const s = yearSales(plan, { today });
    if (!s.hasSales) return [ui.h("p", {}, salesSentence(s, money)), ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/capital-gains" }, "Add a sale on Capital gains ›"))];
    const say = ui.h("div", { "aria-live": "polite" }), sheetHost = ui.h("div");
    return [
      ui.row(ui.stat("Short-term", signed0(s.shortTotal), "held a year or less"), ui.stat("Long-term", signed0(s.longTotal), "held more than a year")),
      ui.h("p", {}, salesSentence(s, money)),
      ui.h("ul", { class: "records" }, s.rows.map((r) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name), ui.h("span", { class: "rec-value", style: r.gain < 0 ? { color: "var(--bad)" } : null }, signed(r.gain))),
        ui.h("div", { class: "rec-sub" }, saleLine(r, money))))),
      ui.h("p", { class: "muted small" }, DATES),
      say,
      ui.row(ui.button("Save as a spreadsheet (CSV)", () => saveCsv(s, say), { class: "secondary" }), ui.button("Print this list", () => printList(s, sheetHost), { class: "secondary" })),
      ui.h("a", { href: "#/taxes/capital-gains", class: "small", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, "Add or change a sale on Capital gains ›"),
      sheetHost,
    ];
  };
  // the file for a tax preparer (core/csv.js; made on this phone, nothing sent anywhere); its green line under the buttons' row
  const saveCsv = (s, say) => {
    const name = `sales-${s.year}.csv`;
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([salesCsv(s, plan)], { type: "text/csv;charset=utf-8" }));
      a.download = name; a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* gone */ } }, 5000);
      say.replaceChildren(ui.notice("ok", `${name} is downloading. Open it with Excel, Numbers or Google Sheets, or send it to your tax preparer.`));
    } catch (e) { say.replaceChildren(ui.notice("error", `The file could not be made: ${e.message}. Reload the page and try again.`)); }
  };
  // the printout: the report kit's sheet, drawn on the tap and shown only by the printer (scoped to this page's own class)
  const printList = (s, host) => {
    const title = `Sales in ${s.year}, for your tax preparer`;
    const { wrap, sheet } = reportFrame(ui, { title });
    wrap.className = `${wrap.className} tl-print`;
    wrap.append(ui.h("style", {}, ".tl-print { display: none; } @media print { .tl-print { display: block !important; } }"));
    const cols = [{ label: "What was sold", get: (r) => r.name }, { label: "Held", get: (r) => (r.held === "long" ? "long-term" : "short-term") },
      { label: "Sold for", num: true, get: (r) => money(r.proceeds) }, { label: "Cost", num: true, get: (r) => money(r.basis) }, { label: "Gain or loss", num: true, get: (r) => signed(r.gain) }];   // each sale signed as on the screen (critic P4)
    sheet.append(ui.h("h1", {}, title), ui.h("p", { class: "rp-sub" }, `From the plan on ${fmt.date(today)}: the sales typed on Capital gains.`),
      ui.h("p", { class: "rp-lead" }, `Short-term: ${signed0(s.shortTotal)}. Long-term: ${signed0(s.longTotal)}. ${salesSentence(s, money)}`),
      rtable(ui, cols, s.rows),
      ui.h("p", { class: "rp-foot" }, `${DATES} Short-term sales go on Part I of Form 8949, long-term sales on Part II.`));
    host.replaceChildren(wrap);
    if (typeof window !== "undefined" && typeof window.print === "function") printSheet(title, sheet);
  };
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax lots and harvesting"), ui.h("p", { class: "lede" }, "Every purchase is a lot with its own cost and date. Selling the right lot turns a taxable sale into a small gain or a useful loss. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    // sales typed on Capital gains still make the list for the tax return (no holdings needed)
    if (salesN) root.append(parts(ctx, salesPart()));
    return;
  }
  // the first screen says the one thing in plain words; how short- and long-term losses are counted goes in a fold (the parts card)
  const detail = d.harvest.length ? `${money(d.harvestTotal)} of losses (${money(d.shortLosses)} on purchases held a year or less, ${money(d.longLosses)} on longer ones)${d.disallowedTotal > 0.5 ? `, of which ${money(d.disallowedTotal)} does not count because of a recent purchase (below)` : ""}. Losses first cancel this year's gains, then up to ${money(d.capLimit)} of other income${d.returns > 1 ? ` on each of your returns (${money(d.capLimit * d.returns)} between you; a loss in one spouse's account only uses that spouse's ${money(d.capLimit)})` : d.capLimit === 1500 ? " (married filing separately)" : ""}.${d.carryAdded.total > 0.5 ? ` The other ${money(d.carryAdded.total)} carries to next year, where it can cancel future gains.` : ""}` : "";
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.harvest.length ? (d.taxSavedTotal >= 1 ? `Selling at a loss could cut your tax by about ${money(d.taxSavedTotal)}` : `${money(d.harvestTotal)} of losses you could use`) : d.taxableCount ? "No losses to use right now" : "Tax lots"),
    ui.h("p", { class: "lede" }, d.harvest.length
      ? `${d.harvest.length === 1 ? "One purchase" : `${d.harvest.length} purchases`} in your taxable accounts ${d.harvest.length === 1 ? "is" : "are"} worth less than you paid. Selling ${d.harvest.length === 1 ? "it" : "them"} counts ${money(d.harvestTotal)} of losses${d.carryAdded.total > 0.5 ? `: about ${money(Math.max(0, d.harvestTotal - d.carryAdded.total))} against this year's tax and the other ${money(d.carryAdded.total)} against later years` : " against this year's tax"} (this is called tax-loss harvesting). Buy something similar the same day and your mix stays the same.`
      : d.taxableCount ? "Every purchase in a taxable account is worth more than you paid. Come back after a fall: that is when selling at a loss cuts your tax." : "All your holdings are in retirement accounts, where lots do not matter for tax: sales there are never taxed on their own."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  // the note that asks for lots carries a button to the first taxable fund with shares in no lot, its form open
  const needLots = d.holdings.find((x) => x.bucket === "taxable" && x.unassignedShares > 1e-6);
  for (const n of d.notes) {
    root.append(ui.notice("info", n));
    if (needLots && /not split into lots/.test(n)) root.append(ui.row(ui.button(`Add the lots for ${needLots.symbol}`, () => { openFor = needLots.id; redraw(); const c = root.querySelector(`[data-holding="${needLots.id}"]`); c?.scrollIntoView({ block: "start" }); c?.querySelector("input")?.focus({ preventScroll: true }); })));
  }
  if (d.harvest.length) root.append(ui.card("Worth selling at a loss",
    ui.h("ul", { class: "records" }, d.harvest.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.symbol} · ${shareText(x.lot.shares)} shares`, ui.h("span", { class: x.lot.term === "short" ? "pill warn" : "pill" }, x.lot.term)), ui.h("span", { class: "rec-value" }, `−${money(x.loss)}`)),
      ui.h("div", { class: "rec-sub" }, `${x.account} · ${x.lot.date ? `bought ${fmt.date(x.lot.date)}` : "date unknown"} at ${money(x.lot.costPerShare)} a share`),
      ...x.washedBy.map((m) => ui.h("div", { class: "rec-sub" }, m.bucket === "taxable"
        ? `You bought ${shareText(m.shares)} more ${m.symbol} on ${fmt.date(m.date)} in ${m.account}, within 30 days: ${money(m.disallowed)} of this loss does not count now; it is added to that purchase's cost.`
        : `You bought ${shareText(m.shares)} more ${m.symbol} on ${fmt.date(m.date)} in ${m.account}, a retirement account, within 30 days: ${money(m.disallowed)} of this loss is lost for good.`))))),
  ));
  if (d.sellFirst.length) root.append(ui.card("If you need cash, sell these first",
    ui.h("p", { class: "muted small" }, "The smallest gain per share first. Tell the broker which purchase you sell, or the oldest shares count as sold first."),
    ui.h("ul", { class: "records" }, d.sellFirst.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.symbol} · ${shareText(x.lot.shares)} shares`, ui.h("span", { class: "pill" }, x.lot.term)), ui.h("span", { class: "rec-value" }, signed(x.lot.gain))),
      ui.h("div", { class: "rec-sub" }, `${x.account} · ${x.lot.date ? `bought ${fmt.date(x.lot.date)}` : "date unknown"} at ${money(x.lot.costPerShare)} a share${x.lot.term === "short" && x.lot.daysToLong > 0 && x.lot.gain > 0 ? ` · long-term in ${x.lot.daysToLong} ${x.lot.daysToLong === 1 ? "day" : "days"}` : ""}`)))),
  ));
  // the optional parts, as rows of one card: how the losses are counted, the ways to sell part of a fund, the year's sales
  const howPart = { id: "how", kind: "how", body: [
    detail ? ui.h("p", { class: "muted small" }, `In all: ${detail}`) : null,
    ui.h("p", { class: "muted small" }, `Each purchase is a lot with its own cost and date. A lot held a year or less is short-term, longer is long-term; a loss cancels gains of its own kind first, then the other kind. ${d.payIs === "business" ? `The next dollar your business makes is taxed at ${fmt.pct(d.payRate, 0)} (income and self-employment tax)` : `Your next dollar of pay is taxed at ${fmt.pct(d.payRate, 0)}`}, a short-term gain at ${fmt.pct(d.shortRate, 0)} and a long-term gain at ${fmt.pct(d.gainsRate, 0)}. Lots without a date count as long-term.`)] };
  const funds = sellable(plan, { today }).eligible;
  const savedFund = plan.whatIfs?.taxLots ? funds.find((x) => x.id === plan.whatIfs.taxLots.holdingId) ?? null : null;
  const saved = !!savedFund;
  // the third way is an answer only once purchases are checked: the row counts the ways it will show (P1)
  const savedPicks = Array.isArray(plan.whatIfs?.taxLots?.picked) ? plan.whatIfs.taxLots.picked.map(String) : [];
  const ways = savedFund && hasChoice(savedFund) && savedFund.lots.some((l) => savedPicks.includes(l.key)) ? 3 : 2;
  const sellBody = () => {
    const r = sellOrders(plan, { today });
    const host = ui.h("div", {});
    const out = [ui.h("p", { class: "muted small" }, LEAD), host];
    drawSellForm(host, r);
    // the answer right under "Work it out": just worked out, it is the green line (R7); else a plain sentence
    if (r.ask) out.push(...sellResults(r, sellSaid));
    sellSaid = null;
    out.push(ui.h("p", { class: "muted small" }, TELL), ui.h("p", { class: "muted small" }, AVERAGE));
    return out;
  };
  const lotLabel = (l) => `${shareText(l.shares)} shares${l.assigned ? `, ${l.date ? `bought ${fmt.date(l.date)}` : "no date"}` : " not in a lot"}, ${money(l.costPerShare)} a share`;
  const drawSellForm = (host, r) => {
    host.replaceChildren();
    const fund = r.eligible.find((x) => x.id === (draft?.fund ?? r.ask?.holdingId)) ?? r.holding;
    const mine = r.ask && r.ask.holdingId === fund.id;
    const picked = new Set(mine ? r.ask.picked : []);
    const values = { fund: fund.id, by: draft?.by ?? r.ask?.by ?? "shares", amount: draft ? draft.amount : mine ? r.ask.amount : null, ...Object.fromEntries(fund.lots.map((l) => [`pick-${l.key}`, picked.has(l.key)])) };
    const fields = [
      r.eligible.length > 1 ? { key: "fund", label: "Fund", type: "select", options: r.eligible.map((x) => ({ value: x.id, label: `${x.symbol} · ${x.account}` })) } : null,
      { key: "by", label: "Sell", type: "select", options: [{ value: "shares", label: "a number of shares" }, { value: "dollars", label: "a dollar amount" }] },
      { key: "amount", label: "Amount", type: "number", required: true, min: 0, max: 1e12, step: "any", help: `${fund.symbol} has ${shareText(fund.shares)} shares at ${money(fund.price)} (worth ${money(fund.value)})` },
      ...(fund.lots.length > 1 ? fund.lots.map((l) => ({ key: `pick-${l.key}`, label: lotLabel(l), type: "checkbox", more: true })) : []),
    ].filter(Boolean);
    const f = ui.form(fields, values, (v) => {
      const x = r.eligible.find((y) => y.id === (v.fund ?? fund.id)) ?? fund;
      const amt = Number(v.amount);
      const box = f.elements?.amount;
      if (!(amt > 0)) return ui.fieldError(box, "Type how many shares, or how many dollars, you might sell.");
      const shares = v.by === "dollars" ? amt / x.price : amt;
      if (shares > x.shares + 1e-9) return ui.fieldError(box, v.by === "dollars" ? `${x.symbol} is worth ${money(x.value)}: type at most that.` : `${x.symbol} has ${shareText(x.shares)} shares: type at most that.`);
      const ask = { holdingId: x.id, by: v.by === "dollars" ? "dollars" : "shares", amount: amt, picked: x.lots.filter((l) => v[`pick-${l.key}`]).map((l) => l.key) };
      const r2 = sellOrders(plan, { today, ask });
      sellSaid = `Worked out for ${shareText(r2.shares)} shares of ${x.symbol}. ${leastSentence(r2, money)}`;
      sellJust = true; draft = null;
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.taxLots = ask; });
    }, { submitLabel: "Work it out", moreLabel: "Pick the purchases yourself (optional)" });
    // another fund: the form is drawn again for its purchases, keeping what was typed (nothing is saved until "Work it out")
    f.elements?.fund?.addEventListener?.("change", () => { draft = { fund: f.elements.fund.value, by: f.elements.by?.value ?? "shares", amount: f.elements.amount?.value ?? "" }; drawSellForm(host, r); });
    host.append(f);
  };
  const sellResults = (r, said) => {
    const sym = r.holding.symbol;
    if (r.tooMany) return [ui.notice("warn", leastSentence(r, money))];
    const one = !hasChoice(r.holding);
    return [
      said ? ui.notice("ok", said) : ui.h("p", {}, leastSentence(r, money)),
      ui.h("ul", { class: "records" }, r.orders.filter((o) => o.state !== "none" && !(one && o.key === "picked")).map((o) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, ORDER_TITLES[o.key]), ui.h("span", { class: "rec-value" }, orderValue(o, money))),
        ui.h("div", { class: "rec-sub" }, orderLine(o, money)),
        washLine(o, sym, money) ? ui.h("div", { class: "rec-sub" }, washLine(o, sym, money)) : null))),
      one ? ui.h("p", { class: "muted small" }, `All of ${sym}'s shares are one purchase on this page, so every way is the same. Add its purchases with “+ Add a lot” below to compare them.`) : null,
      ui.h("p", { class: "muted small" }, `Selling ${shareText(r.shares)} shares at the price on file, ${money(r.holding.price)} a share, brings in about ${money(r.proceeds)}. This is ${r.year}'s federal tax only${r.otherYear ? ` (a sale today falls in ${r.year}; the Federal estimate is set to ${r.otherYear})` : ""}; state tax is not counted.`),
    ];
  };
  // only when a fund has two or more purchases: with one, every way sells the same shares (the note above has "Add the lots")
  const sellPart = funds.some(hasChoice) ? { id: "sell", kind: "item", title: "Compare ways to sell part of a fund", says: `${ways} ways`, set: saved ? true : 0, open: sellJust ? true : undefined, lazy: true, holds: ["amount"], body: sellBody } : null;
  const salesOn = salesN > 0 || d.taxableCount > 0;
  root.append(parts(ctx, howPart, sellPart, salesOn && salesPart()));
  sellJust = false;
  // lots per holding; each card ends with "+ Add a lot" for that fund (one form at the foot of the page put the second lot
  // on the first fund in its list, 3.6 screens away)
  if (openFor && !d.holdings.some((x) => x.id === openFor)) openFor = null;
  const lotLine = (l) => `${shareText(l.shares)} shares, ${l.date ? `bought ${fmt.date(l.date)}` : "no date"}`;
  let lotRow = null;
  for (const x of d.holdings) {
    const inLots = x.lots.filter((l) => l.assigned).reduce((t, l) => t + l.shares, 0);
    const room = Math.max(0, x.shares - inLots);
    const host = ui.h("div", { style: { marginTop: "8px" } });
    const drawAdd = () => {
      host.replaceChildren();
      if (openFor !== x.id) { host.append(ui.button("+ Add a lot", () => { openFor = x.id; drawAdd(); host.querySelector("input")?.focus({ preventScroll: true }); }, { class: "secondary" })); return; }
      const f = ui.form([
        { key: "date", label: "Bought on", type: "date" },
        { key: "shares", label: "Shares", type: "number", required: true, min: 0, max: 1e9, step: "any", help: room > 1e-6 ? `up to ${shareText(room)}: the shares of ${x.symbol} not yet in a lot` : null },
        { key: "cost", label: "Total cost", type: "money", required: true, min: 0, max: 1e9, help: "for the whole lot, fees included" },
      ], {}, (v) => {
        if (!lotRules() || !(v.shares > 0)) return false;
        pending = `Lot added to ${x.symbol} (${x.account}): ${shareText(v.shares)} shares${v.date ? `, bought ${fmt.date(v.date)}` : ""}.`;
        const id = ui.uid();
        openFor = null; showLot = id;
        // one cost for the holding: a lot for shares that had none raises "What you paid in all" (review N6)
        const before = (plan.holdings ?? []).find((y) => y.id === x.id);
        const lot = { id, date: v.date || null, shares: v.shares, cost: v.cost ?? 0 };
        const costNow = before ? costAfterLot(before, lot) : null;
        // the lot remembers the total it replaced, so removing it puts that total back
        if (before && costNow !== null && Math.abs(costNow - (Number(before.costBasis) || 0)) > 0.005) { pending += ` What you paid in all for ${x.symbol} is now ${money(costNow)}${before.costBasis !== null && before.costBasis !== undefined ? ` (was ${money(Number(before.costBasis) || 0)})` : ""}.`; lot.costWas = before.costBasis ?? null; lot.costSet = costNow; }
        store.update((p) => { const hh = (p.holdings ?? []).find((y) => y.id === x.id); if (hh) { hh.costBasis = costAfterLot(hh, lot); hh.lots = hh.lots ?? []; hh.lots.push(lot); } });
      }, { submitLabel: `Add lot to ${x.symbol}`, onCancel: () => { openFor = null; drawAdd(); } });
      // impossible values are held at the box in words: a lot bigger than the shares left, a date still to come
      const sharesBox = f.elements.shares, dateBox = f.elements.date;
      const lotRules = () => {
        const n = Number(sharesBox.value);
        sharesBox.setCustomValidity(sharesBox.value !== "" && n <= 0 ? "Type how many shares this lot has." : sharesBox.value !== "" && n > room + 1e-6 ? (room > 1e-6 ? (inLots > 1e-6 ? `${x.symbol} has ${shareText(x.shares)} shares and ${shareText(inLots)} are already in lots, so this lot can be at most ${shareText(room)}.` : `${x.symbol} has ${shareText(x.shares)} shares, so a lot can be at most ${shareText(room)}.`) : `All ${shareText(x.shares)} shares of ${x.symbol} are already in lots. Change the shares on Holdings first if you bought more.`) : "");
        dateBox.setCustomValidity(dateBox.value && dateBox.value > today ? "A purchase date cannot be in the future." : "");
        if (!sharesBox.checkValidity()) { sharesBox.reportValidity(); return false; }
        if (!dateBox.checkValidity()) { dateBox.reportValidity(); return false; }
        return true;
      };
      const quiet = () => { sharesBox.setCustomValidity(""); dateBox.setCustomValidity(""); };
      sharesBox.addEventListener("input", quiet); dateBox.addEventListener("input", quiet);
      sharesBox.addEventListener("change", () => { const n = Number(sharesBox.value); if (sharesBox.value !== "" && (n <= 0 || n > room + 1e-6)) lotRules(); });
      dateBox.addEventListener("change", () => { if (dateBox.value > today) lotRules(); });
      host.append(ui.h("h2", {}, `Add a lot of ${x.symbol}`), f);
    };
    drawAdd();
    const items = x.lots.map((l) => {
      const li = ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, l.assigned ? `${shareText(l.shares)} shares, ${l.date ? fmt.date(l.date) : "no date"}` : `${shareText(l.shares)} shares not in a lot`, ui.h("span", { class: "pill" }, l.term)), ui.h("span", { class: "rec-value", style: l.gain < 0 ? { color: "var(--bad)" } : null }, signed(l.gain))),
        ui.h("div", { class: "rec-sub" }, `cost ${money(l.cost)} (${money(l.costPerShare)} a share) · worth ${money(l.value)}`),
        l.assigned ? ui.h("div", { class: "rec-foot" }, ui.button("Remove this lot", () => {
          if (!ui.confirm(`Remove this lot of ${x.symbol} (${lotLine(l)})? The shares stay on Holdings; only the purchase record goes.`)) return;
          // a lot that changed "What you paid in all" when it was added puts the old total back (if nothing changed it since)
          const raw = ((plan.holdings ?? []).find((y) => y.id === x.id)?.lots ?? []).find((z) => z.id === l.id);
          const hold = (plan.holdings ?? []).find((y) => y.id === x.id);
          const undo = raw && raw.costSet !== undefined && hold && Math.abs((Number(hold.costBasis) || 0) - raw.costSet) < 0.005;
          pending = `Lot of ${x.symbol} removed (${lotLine(l)}).${undo ? ` What you paid in all is back to ${raw.costWas === null ? "not entered" : money(Number(raw.costWas) || 0)}.` : ""}`;
          store.update((p) => { const hh = (p.holdings ?? []).find((y) => y.id === x.id); if (hh) { hh.lots = (hh.lots ?? []).filter((z) => z.id !== l.id); if (undo) hh.costBasis = raw.costWas; } });
        }, { class: "secondary" })) : null);
      if (l.id && l.id === showLot) lotRow = li;
      return li;
    });
    root.append(ui.h("section", { class: "card", "data-holding": x.id }, ui.h("h2", {}, `${x.symbol} · ${x.account}`),
      ui.h("p", { class: "muted small" }, `${x.name ? `${x.name} · ` : ""}${x.priced ? `${money(x.price)} a share` : "no price on file"}${x.bucket !== "taxable" ? " · retirement account: sales here are not taxed, but buying a fund here within 30 days of selling it at a loss elsewhere cancels that loss" : ""}`),
      ui.h("ul", { class: "records" }, items), host));
  }
  if (lotRow) { const r = lotRow.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) lotRow.scrollIntoView({ block: "center" }); }
  showLot = null;
}
