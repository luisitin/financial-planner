// modules/investments/rebalance/view.js -- DOM only. Whether a rebalance is due, what new money
// alone would fix, then the full list of sells and buys with the tax note on each. Without a mix of your own (or with
// most of the money unclassified) only what to do first. One quiet row, "Try a trade" (gap list, next 60, item 50): a sale
// and a buy tried in place, the new mix beside the target and the gain or loss; nothing is saved.
import { compute } from "./compute.js";
import { parts } from "../../../core/ui/more.js";
import { sellChoices, buyChoices, tryTrade, nothingAsked, sellNote, tradeLead, tooMuchSentence, mixSentence, outsideSentence, gainSentence, gainNotes, shareTexts } from "./trade.js";

let pending = null;
/** "Try a trade": the trade tried ({ sell, amount, all, buy }), what is typed while "Sell" changes, the line after Clear,
 *  and a trade just tried (its answer is brought into view once). Never in the plan: this visit only. */
let trial = null, draft = null, cleared = false, justTried = false;
/** The visit they belong to: the address drawn (a new one on every arrival, Back included; the same one on the redraw
 *  after a save) and the plan (another household loaded in the same tab). Either changes: the trade goes. */
let visit = { route: null, plan: null };

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const planKey = plan?.meta?.createdAt ?? null;
  if (visit.route !== (ctx.route ?? null) || visit.plan !== planKey) { trial = null; draft = null; cleared = false; justTried = false; visit = { route: ctx.route ?? null, plan: planKey }; }
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Rebalance"), ui.h("p", { class: "lede" }, "The trades that bring your mix back to its target, selling where it costs no tax and buying with the cash that frees up. It needs your holdings and a target first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Holdings"), ui.h("a", { class: "btn secondary", href: "#/investments/allocation" }, "Allocation"))));
    return;
  }
  // no mix of your own chosen, or most of the money not classified: nothing to trade yet, and what to do first
  if (d.waiting) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, d.waiting === "pick" ? "Pick your mix first" : "Add what's in your other accounts first"),
      ui.h("p", { class: "lede" }, d.waiting === "pick"
        ? "Rebalancing means trading back to a mix you chose. None is chosen yet, so there is nothing to trade. Allocation shows what you hold and offers a few mixes to pick in one tap."
        : `The funds typed so far cover ${Math.round((d.known ?? 0) * 100)}% of the money in your investment accounts. Trades worked out from part of it could point the wrong way.`),
      ui.row(ui.h("a", { class: "btn", href: d.waiting === "pick" ? "#/investments/allocation" : "#/investments/holdings" }, d.waiting === "pick" ? "Pick a mix on Allocation" : "Open Holdings"))));
    // a trade can still be tried against the mix held (no target to compare yet); not on a guess of the mix
    if (d.waiting === "pick") root.append(ui.h("div", {}, parts(ctx, tradePart(ctx))));
    return;
  }
  const f = d.onlyInFund;
  if (f) {
    // the mix is set inside a fund the page never sells: say the three ways to move it instead of an empty trade list
    const fund = f.funds.length === 1 ? (f.funds[0].symbol || f.funds[0].name || "your target-date fund") : "your balanced or target-date funds";
    const short = f.short.map((x) => x.label.toLowerCase()).join(" and ") || "the classes that are short";
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, `${f.funds.length === 1 ? "The fund sets" : "Your funds set"} this mix`),
      ui.h("p", { class: "lede" }, `${d.flaggedCount === 1 ? "One kind of investment has" : `${d.flaggedCount} kinds of investment have`} drifted too far from the target, but what is over sits inside ${fund}, which keeps its own mix and is not sold here.`),
      ui.h("ul", { class: "records" }, [
        [`Move part of ${fund}`, `${f.funds.length === 1 && f.funds[0].account ? `Inside ${f.funds[0].account}, exchange` : "Exchange"} part of it for a ${short} fund${f.taxFree ? ": no tax inside a 401(k), IRA or Roth" : "; in a taxable account that sale may be taxed"}.`],
        ["Send new money there", `Put new money into a ${short} fund until the mix is back.`],
        ["Or keep the fund's mix", "Pick the fund's own mix on Allocation, and let the fund rebalance itself."],
      ].map(([t, x]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, x)))),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/investments/allocation" }, "Open Allocation"))));
  } else root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.needed ? (d.newMoneyEnough ? "New money alone puts you back on target" : "Time to rebalance") : "No rebalance needed"),
    ui.h("p", { class: "lede" }, d.needed
      ? `${d.flaggedCount === 1 ? "One kind of investment has" : `${d.flaggedCount} kinds of investment have`} drifted too far from the target${d.worst ? `; the biggest gap is ${d.worst.label}, ${d.worst.move > 0 ? "short" : "over"} by ${money(Math.abs(d.worst.move))}` : ""}. ${d.newMoney > 0 ? d.newMoneyEnough ? `Putting the ${money(d.newMoney)} of new money into the kinds of investment that are short is enough: nothing has to be sold.` : `The ${money(d.newMoney)} of new money helps but does not close the gap; the full list below sells ${money(d.sells.reduce((s, t) => s + t.amount, 0))} and buys the same.` : `With no new money, the full rebalance sells ${money(d.sells.reduce((s, t) => s + t.amount, 0))} and buys the same${d.taxableSells > 0 ? `, ${money(d.taxableSells)} of it in taxable accounts` : ", all inside tax-advantaged accounts"}.`}`
      : `Every kind of investment is within ${Math.round(d.band * 100)} points of its target. Check again after a big market move or when new money arrives; the buys below show where new money should go.`),
    ui.h("p", { class: "muted small" }, "Sells come first from 401(k)s, IRAs and Roths, where a sale costs nothing, and in taxable accounts from the holdings with the smallest gain. Buys use the cash freed in the same account, so no money has to move between accounts."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  const nm = ui.form([{ key: "newMoney", label: "New money to invest", type: "money", min: 0, help: "cash you are about to put in; leave blank for none" }], { newMoney: d.newMoney || null }, (v) => { pending = "Saved."; store.update((p) => { p.investments.newMoney = v.newMoney ?? 0; }); }, { submitLabel: "Use this amount" });
  root.append(ui.card("With new money first",
    ui.h("p", { class: "muted small" }, "The cheapest rebalance is to buy what is underweight with money you were going to invest anyway."),
    nm,
    d.newMoneyBuys.length ? ui.h("ul", { class: "records" }, d.newMoneyBuys.map((b) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Buy ${b.label}`), ui.h("span", { class: "rec-value" }, money(b.amount)))))) : d.newMoney > 0 ? ui.h("p", { class: "small" }, "Nothing is underweight; spread it by the target.") : null,
  ));
  // the trades only when a rebalance is due: inside the band, small sells read as advice to trade anyway
  if (d.needed && !f) root.append(ui.card("The full rebalance",
    d.trades.length ? ui.h("ul", { class: "records" }, [...d.sells, ...d.buys].map((t) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t.kind === "sell" ? `Sell ${t.symbol}` : `Buy ${t.label}`, " ", ui.h("span", { class: t.kind === "sell" ? "pill warn" : "pill ok" }, t.kind)), ui.h("span", { class: "rec-value" }, money(t.amount))),
      ui.h("div", { class: "rec-sub" }, `${t.account}${t.kind === "sell" ? ` · ${t.label}` : " · a fund in that class"}${t.taxNote ? ` · ${t.taxNote}` : ""}`)))) : ui.h("p", { class: "small" }, "Nothing to trade."),
    d.leftover.length ? ui.h("p", { class: "small" }, `Still to buy somewhere: ${d.leftover.map((l) => `${money(l.amount)} of ${l.label}`).join(", ")}.`) : null,
  ));
  root.append(ui.h("div", {}, parts(ctx, tradePart(ctx))));
  root.append(ui.card("Rules of thumb",
    ui.h("ul", { class: "records" }, [
      ["Bands, not calendars", "Rebalancing on a schedule trades too often in calm years and too little in a crash. The 5/25 rule (five points, or a quarter of a small target) fires when it matters."],
      ["Sell where it is free", "A sale inside a 401(k), IRA or Roth has no tax. In a taxable account every sale of a winner is a tax bill, so rebalance there with new money and dividends first."],
      ["One fund can do it", "A balanced or target-date fund rebalances itself every day. If this page keeps finding work to do, that is the simpler answer."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

// ---------------------------------------------------------------- "Try a trade"
/** The part: once tried, what the trade does first (the new mix by class beside the target, one sentence on the mix and
 *  one on the gain or loss), brought into view; then the form (sell, how much or all of it, what to buy in the same
 *  account). Nothing here calls store.update. */
function tradePart(ctx) {
  const { ui, fmt, plan } = ctx;
  const h = ui.h, today = fmt.today(), cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const choices = sellChoices(plan, { today });
  if (!choices.length) return null;
  const r = trial ? tryTrade(plan, trial, { today }) : null;
  if (trial && !r) trial = null;   // the holding was sold or moved since: start over
  const wasCleared = cleared; cleared = false;
  const reveal = justTried; justTried = false;
  // the page drawn again in place (the part keeps its open state; nothing is written); a stand-in without it draws the body
  const redraw = () => { if (!ctx.redraw) return false; ctx.redraw(); return true; };
  const body = () => {
    // data-no-keep: the shell never brings this form's typing back as "Not saved yet" on a later visit (nothing here is
    // ever saved, and the trade lasts for the visit only)
    const host = h("div", { style: { display: "grid", gap: "12px" }, dataset: { noKeep: "" } });
    const drawForm = () => {
      host.replaceChildren?.();
      const at = draft ?? trial ?? {};
      const t = trial ? tryTrade(plan, trial, { today }) : null;
      const sellId = choices.some((c) => c.id === at.sell) ? at.sell : choices[0].id;
      const s = choices.find((c) => c.id === sellId);
      const buys = buyChoices(plan, sellId, { today });
      const buyId = buys.some((b) => b.value === at.buy) ? at.buy : buys[0].value;
      const f = ui.form([
        { key: "sell", label: "Sell", type: "select", options: choices.map((c) => ({ value: c.id, label: `${c.label} · ${c.account} · ${money(c.value)}` })), help: sellNote(s) || undefined },
        { key: "amount", label: "How much", type: "money", min: 0, help: `${s.label} is worth ${money(s.value)}. Or tick “Sell all of it”.` },
        { key: "all", label: "Sell all of it", type: "checkbox" },
        { key: "buy", label: "Buy with it", type: "select", options: buys.map((b) => ({ value: b.value, label: b.label })), help: `In ${s.account}: the money from a sale stays in its account.` },
      ], { sell: sellId, amount: at.all ? null : at.amount ?? null, all: !!at.all, buy: buyId }, (v) => {
        const box = f.elements?.amount;
        const ask = { sell: v.sell ?? sellId, amount: v.all ? null : v.amount, all: !!v.all, buy: v.buy ?? buyId };
        if (!ask.all && nothingAsked(ask.amount)) return ui.fieldError(box, "Type how much to sell, or tick “Sell all of it”.");
        const tried = tryTrade(plan, ask, { today });
        if (tried?.tooMuch) return ui.fieldError(box, tooMuchSentence(tried, money));
        if (!tried) return ui.fieldError(f.elements?.buy, "Pick what to buy in the same account.");
        trial = ask; draft = null; justTried = true;
        if (!redraw()) drawForm();
        return false;   // nothing to reset: the form is drawn again with the trade
      }, { submitLabel: "Try this trade" });
      // outlined: the page's one filled button is its own ("Use this amount", or the way on while no mix is picked)
      f.querySelector?.('[type="submit"]')?.classList?.add("secondary");
      // the tick on one line with its words, the box first ("☐ Sell all of it"), scoped to this label
      const tick = f.querySelector?.('[name="all"]'), tickLabel = tick?.closest?.("label");
      if (tickLabel?.style) { Object.assign(tickLabel.style, { flexDirection: "row", alignItems: "center", gap: "10px", minHeight: "44px" }); tick.remove?.(); tickLabel.prepend?.(tick); }
      // another holding to sell: the form is drawn again with that account's choices, keeping what was typed
      f.elements?.sell?.addEventListener?.("change", () => {
        const raw = String(f.elements.amount?.value ?? "").replace(/[$,\s]/g, "");
        draft = { sell: f.elements.sell.value, amount: raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw), all: !!f.elements.all?.checked, buy: null };
        drawForm();
      });
      const answer = t && !draft ? results(t) : null;
      host.append(...[
        wasCleared ? ui.notice("ok", "Cleared. Nothing was saved.") : null,
        h("p", { class: "muted small" }, "See what one sale and one buy would do to your mix before you call the broker. Nothing is saved."),
        answer,
        f,
        trial || draft ? ui.row(ui.button("Clear", () => { trial = null; draft = null; cleared = true; if (!redraw()) drawForm(); }, { class: "secondary" })) : null,
      ].filter(Boolean));
      // a trade just tried: its answer, above the form, is where the eye goes (the button tapped is below it)
      if (answer && reveal) ui.reveal?.(answer, { block: "start" });
    };
    const results = (t) => h("div", { style: { display: "grid", gap: "12px" }, dataset: { tradeResult: "" } },
      h("h3", {}, "What this trade does"),
      h("p", { class: "small", dataset: { tradeLead: "" } }, tradeLead(t, money)),
      h("ul", { class: "records" }, t.rows.map((x) => {
        const [b, a] = shareTexts(x.before, x.after);
        return h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, x.label), h("span", { class: "rec-value" }, `${b} → ${a}`)),
          x.target !== null ? h("div", { class: "rec-sub" }, `target ${Math.round(x.target * 100)}%`) : null);
      })),
      h("p", {}, mixSentence(t)),
      t.outside ? h("p", { class: "small" }, outsideSentence(t, money)) : null,
      h("p", {}, gainSentence(t, money)),
      ...gainNotes(t, money).map((n) => h("p", { class: "muted small" }, n)),
    );
    drawForm();
    return host;
  };
  const says = r ? (r.all ? `all of ${r.sell.label}` : `${money(r.amount)} of ${r.sell.label}`) : "see the new mix";
  return { id: "trade", kind: "own", title: "Try a trade", says: says.length <= 20 ? says : "1 tried", open: trial || draft || wasCleared ? true : undefined, holds: ["sell", "amount", "all", "buy"], body };
}
