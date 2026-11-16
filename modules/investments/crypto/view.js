// modules/investments/crypto/view.js -- DOM only. Your crypto: what it is worth against what you paid and
// how big a slice of net worth it is; what a fall like bitcoin's last two would take; each coin with its
// lots and a quick price update; the tax if sold today, losses to bank and gains to wait on; the rules worth
// knowing; adding a coin (open while there are none, else behind "+ Add another coin"); then one quiet card of
// optional parts (core/ui/more.js; docs/OPTIONAL.md): "Which coins count as sold" (a sale of some of a coin worked three
// ways, and the way your exchange counts, saved with Undo); then "More on this".
import { shareText } from "../tax-lots/compute.js";
import { orderValue } from "../tax-lots/sell.js";
import { compute, COINS, FALLS, SHARE } from "./compute.js";
import { coinOrders, coinsOf, hasWays, methodOf, methodSaid, methodUndone, waysSentence, wayLine, washNote, unitsText, coinsText, METHODS, METHOD_TITLES, METHOD_SHORT, METHOD_CHIPS } from "./sales.js";
import { parts, choice, links } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render (a price updated, a coin added)
let said = null;      // { part, kind: "worked" | "method", text, undo? }: the green line inside a part after its own save; that part stays open (R17)
let adding = false;   // "+ Add another coin" was tapped: its form stays drawn across a redraw until it adds or is cancelled
let draft = null;     // { coin, by, amount } typed in "Which coins count as sold" but not worked out yet (another coin redraws the form)

const STYLE = `
.cr-root .cr-flag { color: var(--warn); font-weight: 650; }
.cr-root .cr-bad { color: var(--bad); font-weight: 650; }
.cr-root .cr-up { color: var(--ok); }
.cr-root .cr-down { color: var(--bad); }
.cr-root .cr-price { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.cr-root .cr-price input { width: 9em; min-height: 44px; }
`;

/** What the row says first, in plain words (R5: one sentence). */
export const WAYS_LEAD = "When you sell some of a coin, which purchases count as sold sets the gain and the tax. Unless you name them, the oldest count first (first in, first out).";
/** The one line on what the IRS asks (IRS FAQs on digital asset transactions 82 to 92, read 2026-11-16; README). */
export const WAYS_IRS = "Your exchange reports your sales to the IRS, so set the same way there before you sell (its settings may call it the cost-basis method) and keep the confirmation. A sale only counts the purchases in the wallet or account it is sold from.";

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
    root.append(addCard(true));
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
      lots.length ? ui.h("div", { class: "rec-sub" }, lots.map((l) => `${l.date ? shortDate(l.date) : "no date"}: ${money(l.cost)} paid, ${l.gain >= 0 ? "+" : "−"}${money(Math.abs(l.gain))}${l.term === "short" ? ` (held a year or less${l.longOn ? `; long-term from ${shortDate(l.longOn)}` : ""})` : ""}`).join(" · ")) : null,
      i.stale ? ui.h("div", { class: "rec-sub cr-flag" }, i.priceAsOf ? `Price from ${shortDate(i.priceAsOf)}: crypto moves daily, update it.` : "No price date: update it.") : null);
    // a typo in a coin (0.5 for 0.05) is fixed on Holdings, which opens on that coin's form; adding it again made two coins
    if (i.kind !== "account") li.append(ui.h("div", { class: "rec-foot" }, ui.h("a", { class: "btn secondary small", href: `#/investments/holdings?edit=${encodeURIComponent(i.id)}` }, "Change or remove ›")));
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
  const limitText = t.returns > 1 ? `up to ${money(t.lossLimit)} off other income on each of your returns (${money(t.lossLimit * t.returns)} between you; a loss in one spouse's account only uses that spouse's ${money(t.lossLimit)})` : `up to ${money(t.lossLimit)} off other income${t.lossLimit === 1500 ? " (filing separately)" : ""}`;
  const carryText = (lead) => t.carry > 0.5 ? ` ${lead}${money(t.carry)} carries to next year, where it can cancel future gains.` : "";
  const added = [t.addLong > 0.5 ? `${money(t.addLong)} of gains held over a year` : null, t.addShort > 0.5 ? `${money(t.addShort)} held a year or less, taxed like pay` : null].filter(Boolean);
  const cancelled = [t.addLong < -0.5 ? `${money(-t.addLong)} of this year's other gains held over a year` : null, t.addShort < -0.5 ? `${money(-t.addShort)} of those held a year or less` : null].filter(Boolean);
  const NO_CHANGE = {
    none: "No tax: nothing has gained or lost.",
    even: "No change this year: the gains and losses cancel out.",
    zero: t.net > 0 ? "No tax this year: with your other income, these gains are taxed at 0% (they stay under your deductions or in the 0% band for gains held over a year)." : `No change this year: the net loss of ${money(-t.net)} only cancels this year's other gains that are taxed at 0%.${carryText("")}`,
    carry: "No change this year: the gains use up part of a loss from this year's other sales that would otherwise carry to next year.",
    limit: `No change this year: this year's other sales already take the whole ${money(t.lossLimit)} a net loss can take off other income${t.returns > 1 ? " on each return it would go on" : t.lossLimit === 1500 ? " (filing separately)" : ""}.${carryText("So all ")}`,
    under: `No change this year: a net loss of ${money(-t.net)}, and ${t.returns > 1 ? "on the return it would go on, income is already under the deductions" : "your other income is already under your deductions"}.${carryText("")}`,
  };
  const taxText = t.total > 0.5
    ? `About ${money(t.total)} more federal tax this year.${added.length ? ` After losses cancel gains, this year's other sales included, it adds ${added.join(" and ")}${cancelled.length ? `, and cancels ${cancelled.join(" and ")}` : ""}.` : ""}`
    : t.total < -0.5 ? (t.net < -0.5
      ? `It would lower this year's federal tax by about ${money(-t.total)}: a net loss of ${money(-t.net)} cancels this year's other gains first, then takes ${limitText}.${carryText("The other ")}`
      : `It would lower this year's federal tax by about ${money(-t.total)}, though the lots gain overall: their losses cancel gains taxed at a higher rate than their own gains.`)
    : NO_CHANGE[t.why] ?? "No change this year.";
  const taxCard = ui.card("If you sold everything today", ui.h("p", {}, taxText),
    t.disallowed > 0.5 ? ui.h("p", { class: "small" }, `${money(t.disallowed)} of the fund losses would not count: the same fund was bought within the last 30 days in a retirement account (the wash-sale rule), and that part is lost for good.`) : null,
    t.otherYear ? ui.h("p", { class: "muted small" }, `A sale today falls in ${t.year}, so this is ${t.year}'s tax, without the ${t.otherYear} sales on Capital gains (the Federal estimate is set to ${t.otherYear}).`) : null,
    ui.h("p", { class: "muted small" }, [t.total > 0.5 || d.waitLong.length ? `Gains held over a year are taxed at ${pct(t.gainsRate)} on your next dollar, those held a year or less at ${pct(t.marginal)}, like pay.` : null, "Funds in a 401(k) or IRA are left out: selling inside them is not taxed."].filter(Boolean).join(" ")));
  if (d.harvest.length) {
    const direct = d.harvest.some((h) => h.kind !== "fund"), fund = d.harvest.some((h) => h.kind === "fund");
    const rule = direct && fund ? "Coins held directly are property, not securities, so as of 2026 the wash-sale rule does not stop you buying the same coin back at once; for a fund it does (wait 31 days)."
      : direct ? "Coins held directly are property, not securities, so as of 2026 the wash-sale rule does not stop you buying the same coin back at once."
      : "For a fund, the wash-sale rule means waiting 31 days before buying it back.";
    taxCard.append(ui.h("p", {}, `Banking the loss on ${d.harvest.map((h) => `${h.symbol} (${money(h.loss)})`).join(", ")} would lower this year's federal tax by about ${money(d.harvestSaved)}${d.harvestCarry > 0.5 ? `; the other ${money(d.harvestCarry)} of loss carries to next year, where it can cancel future gains` : ""}. ${rule}`));
    for (const h of d.harvest) for (const m of h.washedBy ?? []) taxCard.append(ui.h("p", { class: "small" }, m.bucket === "taxable"
      ? `You bought ${shareText(m.shares)} more ${m.symbol} on ${shortDate(m.date)} in ${m.account}, within 30 days: ${money(m.disallowed)} of the loss on ${h.symbol} does not count now; it is added to that purchase's cost.`
      : `You bought ${shareText(m.shares)} more ${m.symbol} on ${shortDate(m.date)} in ${m.account}, a retirement account, within 30 days: ${money(m.disallowed)} of the loss on ${h.symbol} is lost for good.`));
  }
  for (const w of d.waitLong) taxCard.append(ui.h("p", {}, `${w.symbol} bought ${shortDate(w.date)}: wait until ${shortDate(w.longOn)} to sell and its ${money(w.gain)} gain is taxed as a long-term gain instead of like pay, about ${money(w.saved)} less.`));
  root.append(taxCard);

  root.append(ui.card("Worth knowing", ui.h("ul", {},
    ui.h("li", {}, "Every sale, swap of one coin for another, or purchase paid in crypto is a sale for tax. Exchanges send a 1099-DA: gross proceeds for sales from 2025, and what you paid for coins bought from 2026."),
    ui.h("li", {}, "Coins on an exchange are not insured like a bank account; coins in your own wallet are lost with the recovery phrase."),
    ui.h("li", {}, "Write down where the recovery phrase is kept, so your family can find it: the Digital assets page below has a place for it."))));

  // adding another coin: one outlined button where the fold was; the form opens in its place (R20)
  const addHost = ui.h("div");
  const drawAdd = () => {
    addHost.replaceChildren?.();
    if (!adding) { addHost.append(ui.row(ui.button("+ Add another coin", () => { adding = true; drawAdd(); addHost.querySelector?.("select, input")?.focus?.({ preventScroll: true }); }, { class: "secondary" }))); return; }
    addHost.append(addCard(false));
  };
  drawAdd();
  root.append(addHost);

  // the optional parts, as rows of one card (docs/OPTIONAL.md R12): which coins count as sold
  const coins = coinsOf(plan, { today });
  const method = methodOf(plan);
  const waysPart = coins.some(hasWays) ? { id: "ways", kind: "item", title: "Which coins count as sold", says: METHOD_SHORT[method.key], set: method.saved ? true : 0,
    open: said?.part === "ways" ? true : undefined, holds: ["amount"], body: () => waysBody() } : null;
  root.append(ui.h("div", {}, parts(ctx, waysPart)));

  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/investments/holdings", ask: "Where is everything I hold?", says: "every account, coins and funds" },
    { href: "#/investments/tax-lots", ask: "Which shares of a fund should I sell?", says: "Tax lots and harvesting" },
    { href: "#/estate/digital", ask: "Could my family find my coins?", says: "Digital assets" },
  ])));
  said = null;

  // ---- "Which coins count as sold": a sale worked three ways, and the way your exchange counts
  function waysBody() {
    const r = coinOrders(plan, { today });
    const host = ui.h("div", {});
    const mine = said?.part === "ways" ? said : null;
    const out = [ui.h("p", {}, WAYS_LEAD), host];
    drawWaysForm(host, r);
    if (r.ask) out.push(...waysResults(r, mine?.kind === "worked" ? mine.text : null));
    // the way your exchange counts: three chips; a tap asks first, saves, says so in green and offers Undo
    out.push(ui.h("p", {}, ui.h("b", {}, "The way your exchange counts")),
      choice(ctx, { id: "cryptoMethod", label: "The way your exchange counts", presets: METHODS.map((k) => ({ value: k, label: METHOD_CHIPS[k] })), value: method.key, onPick: (v) => pickMethod(v) }));
    if (mine?.kind === "method") out.push(ui.notice("ok", mine.text), mine.undo ? ui.row(ui.button("Undo", mine.undo, { class: "secondary" })) : null);
    out.push(ui.h("p", { class: "muted small" }, WAYS_IRS));
    return out;
  }
  // a chip saves at once (no question first: the green line says it, Undo takes it back, and WAYS_IRS sits under the chips)
  function pickMethod(v) {
    const was = plan.investments?.cryptoMethod;
    said = { part: "ways", kind: "method", text: methodSaid(v), undo: () => {
      said = { part: "ways", kind: "method", text: methodUndone(was) };
      store.update((p) => { p.investments = p.investments ?? {}; if (METHODS.includes(was)) p.investments.cryptoMethod = was; else delete p.investments.cryptoMethod; });
    } };
    store.update((p) => { p.investments = p.investments ?? {}; p.investments.cryptoMethod = v; });
  }
  function lotLabel(l) { return `${coinsText(l.shares)}${l.assigned ? `, ${l.date ? `bought ${shortDate(l.date)}` : "no date"}` : " with no purchase typed"}, ${exact(l.costPerShare)} a coin`; }
  function drawWaysForm(host, r) {
    host.replaceChildren?.();
    const coin = r.coins.find((c) => c.id === (draft?.coin ?? r.ask?.holdingId)) ?? r.coin;
    const mineAsk = r.ask && r.ask.holdingId === coin.id;
    const picked = new Set(mineAsk ? r.ask.picked : []);
    const values = { coin: coin.id, by: draft?.by ?? r.ask?.by ?? "coins", amount: draft ? draft.amount : mineAsk ? r.ask.amount : null, ...Object.fromEntries(coin.lots.map((l) => [`pick-${l.key}`, picked.has(l.key)])) };
    const fields = [
      r.coins.length > 1 ? { key: "coin", label: "Coin", type: "select", options: r.coins.map((c) => ({ value: c.id, label: `${c.symbol} · ${c.account}` })) } : null,
      { key: "by", label: "Sell", type: "select", options: [{ value: "coins", label: "a number of coins" }, { value: "dollars", label: "a dollar amount" }] },
      { key: "amount", label: "Amount", type: "number", required: true, min: 0, max: 1e12, step: "any", help: `${coin.symbol} in ${coin.account}: ${coinsText(coin.units)} at ${exact(coin.price)} (worth ${money(coin.value)})` },
      ...(hasWays(coin) ? coin.lots.map((l) => ({ key: `pick-${l.key}`, label: lotLabel(l), type: "checkbox", more: true })) : []),
    ].filter(Boolean);
    const f = ui.form(fields, values, (v) => {
      const c = r.coins.find((y) => y.id === (v.coin ?? coin.id)) ?? coin;
      const amt = Number(v.amount);
      const box = f.elements?.amount;
      if (!(amt > 0)) return ui.fieldError(box, "Type how many coins, or how many dollars, you might sell.");
      const units = v.by === "dollars" ? amt / c.price : amt;
      if (units > c.units + 1e-9) return ui.fieldError(box, v.by === "dollars" ? `${c.symbol} in ${c.account} is worth ${money(c.value)}: type at most that.` : `${c.symbol} in ${c.account} holds ${coinsText(c.units)}: type at most that.`);
      const ask = { holdingId: c.id, by: v.by === "dollars" ? "dollars" : "coins", amount: amt, picked: c.lots.filter((l) => v[`pick-${l.key}`]).map((l) => l.key) };
      const r2 = coinOrders(plan, { today, ask });
      said = { part: "ways", kind: "worked", text: `Worked out for ${unitsText(r2.units)} ${c.symbol}. ${waysSentence(r2, money)}` };
      draft = null;
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.crypto = ask; });
    }, { submitLabel: "Work it out", moreLabel: "Pick the purchases yourself (optional)" });
    // another coin: the form is drawn again for its purchases, keeping what was typed (nothing is saved until "Work it out")
    f.elements?.coin?.addEventListener?.("change", () => { draft = { coin: f.elements.coin.value, by: f.elements.by?.value ?? "coins", amount: f.elements.amount?.value ?? "" }; drawWaysForm(host, r); });
    host.append(f);
  }
  function waysResults(r, green) {
    if (r.tooMany) return [ui.notice("warn", waysSentence(r, money))];
    const one = !hasWays(r.coin);
    const note = washNote(r);
    return [
      green ? ui.notice("ok", green) : ui.h("p", {}, waysSentence(r, money)),
      ui.h("ul", { class: "records" }, r.orders.filter((o) => o.state !== "none" && !(one && o.key === "picked")).map((o) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, METHOD_TITLES[o.key], r.method.saved && r.method.key === o.key ? ui.h("span", { class: "pill accent" }, "yours") : null), ui.h("span", { class: "rec-value" }, orderValue(o, money))),
        ui.h("div", { class: "rec-sub" }, wayLine(o, money))))),
      note ? ui.h("p", { class: "small" }, note) : null,
      one ? ui.h("p", { class: "muted small" }, `All of ${r.coin.symbol}'s coins in ${r.coin.account} are one purchase on this page, so every way is the same.`) : null,
      ui.h("p", { class: "muted small" }, `Selling ${unitsText(r.units)} ${r.coin.symbol} at the price on file, ${exact(r.coin.price)}, brings in about ${money(r.proceeds)}. This is ${r.year}'s federal tax only${r.otherYear ? ` (a sale today falls in ${r.year}; the Federal estimate is set to ${r.otherYear})` : ""}; state tax is not counted.`),
    ];
  }

  // adding a coin: a holding in a crypto account (made if there is none), the account's balance kept equal to its coins
  function addCard(first) {
    const wallets = (plan.accounts ?? []).filter((a) => a.type === "crypto");
    const form = ui.form([
      { key: "symbol", label: "Coin", type: "select", options: [...Object.entries(COINS).map(([value, name]) => ({ value, label: `${name} (${value})` })), { value: "", label: "Another coin (type it below)" }] },
      { key: "other", label: "Its symbol, if another", type: "text", placeholder: "e.g. ARB" },
      { key: "shares", label: "How many coins", type: "number", required: true, min: 0, max: 1e12, step: "any" },
      { key: "price", label: "Price of one coin today", type: "money", required: true, min: 0, max: 1e7 },
      { key: "cost", label: "What you paid for them, in all", type: "money", min: 0, max: 1e10, help: "with fees; leave blank if you do not know" },
      { key: "date", label: "When you bought them", type: "date", help: "under a year ago, a sale is taxed like pay" },
      wallets.length > 1 ? { key: "accountId", label: "Held at", type: "select", options: wallets.map((a) => ({ value: a.id, label: a.name })) } : null,
    ].filter(Boolean), { symbol: "BTC", accountId: wallets[0]?.id ?? "" }, (v) => {
      const symbol = String(v.symbol || v.other || "").trim().toUpperCase();
      if (!symbol) { form.prepend(ui.notice("error", "Choose the coin, or type its symbol.")); return; }
      if (!(v.shares > 0) || !(v.price > 0)) { form.prepend(ui.notice("error", "Type how many coins and today's price for one.")); return; }
      pending = `${symbol} added.`;
      adding = false;
      store.update((p) => {
        p.accounts = p.accounts ?? [];
        let acct = p.accounts.find((a) => a.id === v.accountId && a.type === "crypto") ?? p.accounts.find((a) => a.type === "crypto");
        if (!acct) { acct = { id: ui.uid(), name: "Crypto wallet", type: "crypto", institution: "", balance: 0, asOf: today, ownerId: "", history: [] }; p.accounts.push(acct); }
        const cost = v.cost ?? v.shares * v.price;
        p.holdings = [...(p.holdings ?? []), { id: ui.uid(), accountId: acct.id, symbol, name: COINS[symbol] ?? "", shares: v.shares, price: v.price, priceAsOf: today, costBasis: cost, assetClass: "other", expenseRatio: null, yield: null, lots: v.date ? [{ id: ui.uid(), date: v.date, shares: v.shares, cost }] : [] }];
        syncCrypto(p);
      });
    }, { submitLabel: "Add coin", onCancel: first ? undefined : () => { adding = false; drawAdd(); } });
    // a purchase date still to come was taken ("long-term from Jan 2, 2100")
    const when = form.elements.date;
    const dateRule = () => when.setCustomValidity(when.value && when.value > today ? "A purchase date cannot be in the future." : "");
    when.addEventListener("input", dateRule); when.addEventListener("change", dateRule); dateRule();
    return ui.h("section", { class: "card" }, ui.h("h2", {}, first ? "Add a coin" : "Add another coin"), form);
  }
  // a crypto account's balance follows its coins (only accounts that have coins listed)
  function syncCrypto(p) {
    for (const a of (p.accounts ?? []).filter((x) => x.type === "crypto")) {
      const mine = (p.holdings ?? []).filter((h) => h.accountId === a.id);
      if (mine.length) { a.balance = Math.round(mine.reduce((s, h) => s + (Number(h.shares) || 0) * (Number(h.price) || 0), 0) * 100) / 100; a.asOf = today; }
    }
  }
}
