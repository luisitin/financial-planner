// modules/investments/crypto/view.js -- DOM only. Your crypto: what it is worth against what you paid and
// how big a slice of net worth it is; what a fall like bitcoin's last two would take; each coin with its
// lots and a quick price update; the tax if sold today, losses to bank and gains to wait on; the rules worth
// knowing; adding a coin in a fold.
import { compute, COINS, FALLS, SHARE } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.cr-root .cr-flag { color: var(--warn); font-weight: 650; }
.cr-root .cr-bad { color: var(--bad); font-weight: 650; }
.cr-root .cr-up { color: var(--ok); }
.cr-root .cr-down { color: var(--bad); }
.cr-root .cr-price { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.cr-root .cr-price input { width: 9em; min-height: 44px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const exact = (n) => fmt.money(n, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "cr-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Crypto"),
      ui.h("p", { class: "lede" }, "Bitcoin, ether and other coins, and the funds that hold them: what they are worth against what you paid, the tax if you sold, and how much they could swing."),
      ui.h("p", { class: "muted small" }, "Add a coin below. A bitcoin or ether fund bought in a brokerage account (IBIT, FBTC, ETHA ...) shows up here once it is on Holdings.")));
    root.append(addForm(true));
    return;
  }

  // the headline
  const levelText = { small: "a small slice", medium: "more than the 5% many planners suggest as a ceiling", large: d.share === null ? "more than everything else you own, net" : "a large bet" }[d.level];
  root.append(ui.card(null, ui.row(
    ui.stat("Crypto", money(d.total), d.cost ? `${d.gain >= 0 ? "+" : "−"}${money(Math.abs(d.gain))} on ${money(d.cost)} paid` : "what you paid is not entered"),
    ui.stat("Of your net worth", d.share === null ? "—" : pct(d.share), levelText),
  ), d.level !== "small" ? ui.h("p", { class: d.level === "large" ? "cr-bad" : "cr-flag" }, d.level === "large" ? "A fall in crypto would change your whole plan. Decide how much you could watch drop by three quarters and still sleep." : `Above ${pct(SHARE.small)} of net worth: fine if chosen on purpose, but it is the most volatile thing you own.`) : null));

  // the swing
  root.append(ui.card("How far it can fall", ui.h("p", {}, `Bitcoin fell about ${FALLS.map((f) => `${pct(f.drop)} from ${f.from} to ${f.to}`).join(", and ")}. Smaller coins usually fell further.`),
    ui.h("p", {}, ui.h("b", {}, `A fall of ${pct(d.stress.drop)} would take ${money(d.stress.loss)}`), d.stress.share !== null ? `, ${pct(d.stress.share)} of your net worth.` : "."),
    d.volatile < d.total ? ui.h("p", { class: "muted small" }, `Stablecoins (${money(d.total - d.volatile)}) are left out: they are meant to stay at a dollar, but they are not bank deposits and no government insures them.`) : null));

  // each holding
  root.append(ui.card("What you hold", ui.h("ul", { class: "records" }, d.items.map((i) => {
    const kindLabel = { coin: "coin", stable: "stablecoin", fund: "fund", account: "account balance" }[i.kind];
    const lots = i.lots.filter((l) => l.assigned);
    const li = ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${i.symbol ? `${i.symbol} · ` : ""}${i.name}`), ui.h("span", { class: "rec-value" }, money(i.value))),
      ui.h("div", { class: "rec-sub" }, [`${kindLabel} in ${i.account}`, i.shares !== null && i.kind !== "account" ? `${+i.shares.toFixed(8)} at ${exact(i.price)}` : null, i.gain !== null && Math.abs(i.gain) >= 1 ? ui.h("span", { class: i.gain >= 0 ? "cr-up" : "cr-down" }, `${i.gain >= 0 ? "+" : "−"}${money(Math.abs(i.gain))}${i.gainPct !== null ? ` (${i.gain >= 0 ? "+" : "−"}${pct(Math.abs(i.gainPct))})` : ""}`) : null].filter(Boolean).flatMap((x, k) => (k ? [" · ", x] : [x]))),
      lots.length ? ui.h("div", { class: "rec-sub" }, lots.map((l) => `${l.date ? shortDate(l.date) : "no date"}: ${money(l.cost)} paid, ${l.gain >= 0 ? "+" : "−"}${money(Math.abs(l.gain))}${l.term === "short" ? ` (held under a year; long-term in ${l.daysToLong} days)` : ""}`).join(" · ")) : null,
      i.stale ? ui.h("div", { class: "rec-sub cr-flag" }, i.priceAsOf ? `Price from ${shortDate(i.priceAsOf)}: crypto moves daily, update it.` : "No price date: update it.") : null);
    if (i.kind === "coin" || i.kind === "fund") {
      const box = ui.h("input", { type: "number", min: "0", step: "any", inputmode: "decimal", value: i.price ?? "", "aria-label": `Price of ${i.symbol}` });
      li.append(ui.h("div", { class: "cr-price" }, box, ui.button("Update price", () => {
        const v = Number(box.value);
        if (!(v > 0)) { li.append(ui.notice("error", "Type today's price for one coin or share first.")); return; }
        pending = `${i.symbol} price updated to ${exact(v)}.`;
        store.update((p) => {
          for (const h of p.holdings ?? []) if (String(h.symbol).toUpperCase() === i.symbol) { h.price = v; h.priceAsOf = today; }
          syncCrypto(p);
        });
      }, { class: "secondary" })));
    }
    return li;
  }))));

  // tax
  const t = d.tax;
  const taxCard = ui.card("If you sold everything today", ui.h("p", {}, t.total > 0.5
    ? `About ${money(t.total)} of federal tax: ${money(Math.max(0, t.longGain))} of gains held over a year at ${pct(t.gainsRate)}, ${money(Math.max(0, t.shortGain))} held under a year at ${pct(t.marginal)} like pay.`
    : t.shortGain + t.longGain < 0 ? `No tax: a net loss of ${money(-(t.shortGain + t.longGain))}, which lowers other tax (up to $3,000 a year against pay, the rest carried forward).` : "No tax: nothing has gained."),
    ui.h("p", { class: "muted small" }, "Funds in a 401(k) or IRA are left out: selling inside them is not taxed."));
  if (d.harvest.length) taxCard.append(ui.h("p", {}, `Banking the loss on ${d.harvest.map((h) => `${h.symbol} (${money(h.loss)})`).join(", ")} would save about ${money(d.harvestSaved)}. ${d.harvest.some((h) => h.kind === "coin") ? "Coins held directly are property, not securities, so as of 2026 the wash-sale rule does not stop you buying the same coin back at once; for a fund it does (wait 31 days)." : "For a fund, the wash-sale rule means waiting 31 days before buying it back."}`));
  for (const w of d.waitLong) taxCard.append(ui.h("p", {}, `${w.symbol} bought ${shortDate(w.date)}: wait until ${shortDate(w.longOn)} to sell and its ${money(w.gain)} gain is taxed at ${pct(t.gainsRate)} instead of ${pct(t.marginal)}, about ${money(w.saved)} less.`));
  root.append(taxCard);

  root.append(ui.card("Worth knowing", ui.h("ul", {},
    ui.h("li", {}, "Every sale, swap of one coin for another, or purchase paid in crypto is a sale for tax. Exchanges send a 1099-DA: gross proceeds for sales from 2025, and what you paid for coins bought from 2026."),
    ui.h("li", {}, "Coins on an exchange are not insured like a bank account; coins in your own wallet are lost with the recovery phrase."),
    ui.h("li", {}, ui.h("span", {}, "Write down where the recovery phrase is kept, so your family can find it: "), ui.h("a", { href: "#/estate/digital" }, "Digital estate"), "."))));

  root.append(addForm(false));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/investments/holdings" }, "Holdings"), ui.h("a", { class: "btn secondary", href: "#/investments/tax-lots" }, "Tax lots"))));

  // adding a coin: a holding in a crypto account (made if there is none), the account's balance kept equal to its coins
  function addForm(open) {
    const wallets = (plan.accounts ?? []).filter((a) => a.type === "crypto");
    const form = ui.form([
      { key: "symbol", label: "Coin", type: "select", options: [...Object.entries(COINS).map(([value, name]) => ({ value, label: `${name} (${value})` })), { value: "", label: "Another coin (type it below)" }] },
      { key: "other", label: "Its symbol, if another", type: "text", placeholder: "e.g. ARB" },
      { key: "shares", label: "How many coins", type: "number", min: 0 },
      { key: "price", label: "Price of one coin today", type: "money", min: 0 },
      { key: "cost", label: "What you paid for them, in all", type: "money", min: 0, help: "with fees; empty if you do not know" },
      { key: "date", label: "When you bought them", type: "date", help: "under a year ago, a sale is taxed like pay" },
      wallets.length > 1 ? { key: "accountId", label: "Held at", type: "select", options: wallets.map((a) => ({ value: a.id, label: a.name })) } : null,
    ].filter(Boolean), { symbol: "BTC", accountId: wallets[0]?.id ?? "" }, (v) => {
      const symbol = String(v.symbol || v.other || "").trim().toUpperCase();
      if (!symbol) { form.prepend(ui.notice("error", "Choose the coin, or type its symbol.")); return; }
      if (!(v.shares > 0) || !(v.price > 0)) { form.prepend(ui.notice("error", "Type how many coins and today's price for one.")); return; }
      pending = `${symbol} added.`;
      store.update((p) => {
        p.accounts = p.accounts ?? [];
        let acct = p.accounts.find((a) => a.id === v.accountId && a.type === "crypto") ?? p.accounts.find((a) => a.type === "crypto");
        if (!acct) { acct = { id: ui.uid(), name: "Crypto wallet", type: "crypto", institution: "", balance: 0, asOf: today, ownerId: "", history: [] }; p.accounts.push(acct); }
        const cost = v.cost ?? v.shares * v.price;
        p.holdings = [...(p.holdings ?? []), { id: ui.uid(), accountId: acct.id, symbol, name: COINS[symbol] ?? "", shares: v.shares, price: v.price, priceAsOf: today, costBasis: cost, assetClass: "other", expenseRatio: null, yield: null, lots: v.date ? [{ id: ui.uid(), date: v.date, shares: v.shares, cost }] : [] }];
        syncCrypto(p);
      });
    }, { submitLabel: "Add coin" });
    return ui.h("details", { class: "card fold fold-card", open: open ? true : null }, ui.h("summary", {}, ui.h("h2", {}, open ? "Add a coin" : "+ Add another coin"), ui.h("span", { class: "fold-chev" }, "›")), form);
  }
  // a crypto account's balance follows its coins (only accounts that have coins listed)
  function syncCrypto(p) {
    for (const a of (p.accounts ?? []).filter((x) => x.type === "crypto")) {
      const mine = (p.holdings ?? []).filter((h) => h.accountId === a.id);
      if (mine.length) { a.balance = Math.round(mine.reduce((s, h) => s + (Number(h.shares) || 0) * (Number(h.price) || 0), 0) * 100) / 100; a.asOf = today; }
    }
  }
}
