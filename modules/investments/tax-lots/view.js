// modules/investments/tax-lots/view.js -- DOM only. Losses worth harvesting first, the order to
// sell in, then each holding's lots, each card with its own folded "+ Add a lot" for that fund. How short- and long-term
// losses are counted is one quiet tap away ("How this is worked out", drawn by core/ui/more.js so Settings' "Show how
// answers are worked out" opens it; docs/OPTIONAL.md).
import { compute, costAfterLot, shareText } from "./compute.js";
import { part } from "../../../core/ui/more.js";

let pending = null;
let openFor = null;   // the holding whose "+ Add a lot" form is open (kept across a redraw, dropped after the add)
let showLot = null;   // the lot to bring into view on the next render (the one just added)

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  const redraw = () => { root.replaceChildren(); render(root, ctx); };
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax lots and harvesting"), ui.h("p", { class: "lede" }, "Every purchase is a lot with its own cost and date. Selling the right lot turns a taxable sale into a small gain or a useful loss. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    return;
  }
  // the first screen says the one thing in plain words; how short- and long-term losses are counted goes in a fold at the end
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
    ui.h("p", { class: "muted small" }, "The smallest gain per share first (the biggest losses at the top). Tell the brokerage which lot when you sell (\"specific identification\"), or it sells the oldest."),
    ui.h("ul", { class: "records" }, d.sellFirst.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.symbol} · ${shareText(x.lot.shares)} shares`, ui.h("span", { class: "pill" }, x.lot.term)), ui.h("span", { class: "rec-value" }, signed(x.lot.gain))),
      ui.h("div", { class: "rec-sub" }, `${x.account} · ${x.lot.date ? `bought ${fmt.date(x.lot.date)}` : "date unknown"} at ${money(x.lot.costPerShare)} a share${x.lot.term === "short" && x.lot.daysToLong > 0 && x.lot.gain > 0 ? ` · long-term in ${x.lot.daysToLong} ${x.lot.daysToLong === 1 ? "day" : "days"}` : ""}`)))),
  ));
  // lots per holding; each card ends with "+ Add a lot" for that fund (one form at the foot of the page put the second lot
  // on the first fund in its list, 3.6 screens away)
  if (openFor && !d.holdings.some((x) => x.id === openFor)) openFor = null;
  const today = fmt.today();
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
  root.append(part(ctx, { id: "how", kind: "how", card: true, body: [
    detail ? ui.h("p", { class: "muted small" }, `In all: ${detail}`) : null,
    ui.h("p", { class: "muted small" }, `Each purchase is a lot with its own cost and date. A lot held a year or less is short-term, longer is long-term; a loss cancels gains of its own kind first, then the other kind. ${d.payIs === "business" ? `The next dollar your business makes is taxed at ${fmt.pct(d.payRate, 0)} (income and self-employment tax)` : `Your next dollar of pay is taxed at ${fmt.pct(d.payRate, 0)}`}, a short-term gain at ${fmt.pct(d.shortRate, 0)} and a long-term gain at ${fmt.pct(d.gainsRate, 0)}. Lots without a date count as long-term.`)] }));
  if (lotRow) { const r = lotRow.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) lotRow.scrollIntoView({ block: "center" }); }
  showLot = null;
}
