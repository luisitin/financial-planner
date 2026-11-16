// modules/investments/crypto/view.js -- DOM only. Your crypto: what it is worth against what you paid and
// how big a slice of net worth it is; what a fall like bitcoin's last two would take; each coin with its
// lots and a quick price update; the tax if sold today, losses to bank and gains to wait on; the rules worth
// knowing; adding a coin (open while there are none, else behind "+ Add another coin"); then one quiet card of
// optional parts (core/ui/more.js; docs/OPTIONAL.md): "Which coins count as sold" (a sale of some of a coin worked three
// ways, and the way your exchange counts, saved with Undo) and "Sales for your tax return" (record a coin sale, the year's
// coin sales as Form 8949 lines, a CSV and a printout for a tax preparer, and a file for tax software, TXF) and "Rewards from
// staking" (coins staking paid, income in the year received, each a purchase at its worth that day; staking.js); then "More
// on this".
import { shareText } from "../tax-lots/compute.js";
import { orderValue } from "../tax-lots/sell.js";
import { compute, COINS, FALLS, SHARE } from "./compute.js";
import { coinOrders, coinsOf, hasWays, methodOf, methodSaid, methodUndone, waysSentence, wayLine, washNote, unitsText, coinsText, METHODS, METHOD_TITLES, METHOD_SHORT, METHOD_CHIPS,
  recordable, planSale, applySale, removeSale, coinSales, coinSalesSentence, elsewhereSentence, recordedSentence, moneyNote, costNote, costMissing, lineText, recordWay, removeAsk, removedSaid, UNDONE_SALE, form8949Csv, dayText, FORM_NOTE, FORM_SCREEN } from "./sales.js";
import { stakingIn, planReward, applyReward, removeReward, stakingStatus, stakingSentence, othersSentence, TWICE, RULE, rewardLine, rewardTitle, earlierLine,
  recordedSentence as rewardSaid, removeAsk as rewardAsk, removedSaid as rewardRemoved, UNDONE_RECORD, UNDONE_REMOVE, SHOWN, estimateWorth, estimateText, ESTIMATE_CHIP, ESTIMATE_NEEDS } from "./staking.js";
import { salesYear } from "../tax-lots/sell.js";
import { txfFile, txfOffer, txfStats, txfName, txfSaid, txfFailed, TXF_FORM_SCREEN, TXF_SCREEN, TXF_SEPARATE } from "./txf.js";
import { parts, choice, links } from "../../../core/ui/more.js";
import { reportFrame, rtable, printSheet } from "../../reports/report-kit.js";

let pending = null;   // the confirmation shown on the next render (a price updated, a coin added)
let said = null;      // { part, kind: "worked" | "method", text, undo? }: the green line inside a part after its own save; that part stays open (R17)
let adding = false;   // "+ Add another coin" was tapped: its form stays drawn across a redraw until it adds or is cancelled
let draft = null;     // { coin, by, amount } typed in "Which coins count as sold" but not worked out yet (another coin redraws the form)
let recording = false; // "+ Record another sale" was tapped: the form stays drawn across a redraw until it records or is cancelled
let recDraft = null;  // { coin, units, sold, proceeds } typed in "Record a sale" when another coin redraws the form
let rewarding = false; // "+ Record another reward" was tapped: the form stays drawn across a redraw until it records or is cancelled
let rewDraft = null;  // { coin, staked, received, worth } typed in "Record a reward" when another coin redraws the form

const STYLE = `
.cr-root .cr-flag { color: var(--warn); font-weight: 650; }
.cr-root .cr-bad { color: var(--bad); font-weight: 650; }
.cr-root .cr-up { color: var(--ok); }
.cr-root .cr-down { color: var(--bad); }
.cr-root .cr-price { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.cr-root .cr-price input { width: 9em; min-height: 44px; }
.cr-root .cr-add { margin-top: 12px; }
.cr-root .cr-add.open { border-top: 1px solid var(--line); padding-top: 12px; }
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
    // every coin sold this year: the list for the tax return is still there
    const left = coinSales(plan, { today });
    const st0 = stakingIn(plan, salesYear(plan, today));
    if (left.count || left.elsewhere || st0.any) root.append(ui.h("div", {}, parts(ctx, left.count || left.elsewhere ? salesPartOf(left, []) : null, st0.any ? stakingPartOf(st0, []) : null)));
    said = null;
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

  // each holding; "+ Add another coin" at the foot of the list (R20)
  const holdCard = ui.card("What you hold", ui.h("ul", { class: "records" }, d.items.map((i) => {
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
  })));
  root.append(holdCard);

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

  // adding another coin: one outlined button at the foot of the list; the form opens in its place (R20)
  const addHost = ui.h("div", { class: "cr-add" });
  const drawAdd = () => {
    addHost.replaceChildren?.();
    addHost.className = adding ? "cr-add open" : "cr-add";
    if (!adding) { addHost.append(ui.row(ui.button("+ Add another coin", () => { adding = true; drawAdd(); addHost.querySelector?.("select, input")?.focus?.({ preventScroll: true }); }, { class: "secondary" }))); return; }
    addHost.append(addCard(false));
  };
  drawAdd();
  holdCard.append(addHost);

  // the optional parts, as rows of one card (docs/OPTIONAL.md R12): which coins count as sold
  const coins = coinsOf(plan, { today });
  const method = methodOf(plan);
  const waysPart = coins.some(hasWays) ? { id: "ways", kind: "item", title: "Which coins count as sold", says: METHOD_SHORT[method.key], set: method.saved ? true : 0,
    open: said?.part === "ways" ? true : undefined, holds: ["amount"], body: () => waysBody() } : null;
  const cs = coinSales(plan, { today }), rec = recordable(plan, today);
  // "Rewards from staking": with a coin to record it for, or a reward on file
  const st = stakingIn(plan, cs.year);
  root.append(ui.h("div", {}, parts(ctx, waysPart, rec.length || cs.count || cs.elsewhere ? salesPartOf(cs, rec) : null, rec.length || st.any ? stakingPartOf(st, rec) : null)));

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
      costMissing(r.coin) ? ui.h("p", { class: "small cr-flag" }, costMissing(r.coin)) : null,
      one ? ui.h("p", { class: "muted small" }, `All of ${r.coin.symbol}'s coins in ${r.coin.account} are one purchase on this page, so every way is the same.`) : null,
      ui.h("p", { class: "muted small" }, `Selling ${unitsText(r.units)} ${r.coin.symbol} at the price on file, ${exact(r.coin.price)}, brings in about ${money(r.proceeds)}. This is ${r.year}'s federal tax only${r.otherYear ? ` (a sale today falls in ${r.year}; the Federal estimate is set to ${r.otherYear})` : ""}; state tax is not counted.`),
    ];
  }

  // ---- "Sales for your tax return": record a coin sale; the year's coin sales as Form 8949 lines, a CSV and a printout
  function salesPartOf(cs, rec) {
    return { id: "sales", kind: "item", title: "Sales for your tax return", says: cs.count ? `${cs.count} in ${cs.year}` : `none in ${cs.year}`,
      open: said?.part === "sales" ? true : undefined, holds: ["units", "sold", "proceeds"], body: () => salesBody(cs, rec) };
  }
  function salesBody(cs, rec) {
    const mine = said?.part === "sales" ? said : null;
    const out = [];
    if (mine) {
      // the list above the tapped button changes after a save: the green line is brought under the top bar (ui.reveal)
      const n = ui.notice("ok", mine.text);
      out.push(n, mine.note ? ui.h("p", { class: "muted small" }, mine.note) : null, mine.cost ? ui.h("p", { class: "small cr-flag" }, mine.cost) : null, mine.undo ? ui.row(ui.button("Undo", mine.undo, { class: "secondary" })) : null);
      ui.reveal?.(n, { block: "start" });
    }
    out.push(ui.h("p", {}, coinSalesSentence(cs, money)));
    const other = elsewhereSentence(cs);
    if (other) out.push(ui.h("p", { class: "small cr-flag" }, other));
    if (cs.count) {
      const signedM = (n) => (n < 0 ? `−${money(-n)}` : `+${money(n)}`);
      out.push(ui.h("ul", { class: "records" }, cs.sales.map((s) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${unitsText(s.units)} ${s.symbol} · ${dayText(s.sold)}`), ui.h("span", { class: `rec-value${s.gain < 0 ? " cr-down" : ""}` }, signedM(s.gain))),
        ui.h("div", { class: "rec-sub" }, `sold for ${money(s.proceeds)}, cost ${s.lines.every((l) => l.noCost) ? "not on file" : `${money(s.cost)}${s.lines.some((l) => l.noCost) ? " (part not on file)" : ""}`}`),
        ...s.lines.map((l) => ui.h("div", { class: "rec-sub" }, lineText(l, money))),
        ui.h("div", { class: "rec-foot" }, ui.button("Remove this sale", () => {
          if (!ui.confirm(removeAsk(s))) return;
          said = { part: "sales", text: removedSaid(s) };
          store.update((p) => { removeSale(p, s.id, today); });
        }, { class: "secondary small" }))))));
      const say = ui.h("div", { "aria-live": "polite" }), sheetHost = ui.h("div");
      // the file for tax software beside the spreadsheet (txf.js): the sentence above names all three ways, the one thing to
      // know first is under them; filing separately with sales of both of you (or in neither name), the list's own sentence
      // and the one that says why there is no file. The green line after a tap lands right under the buttons, so they do not
      // move under the thumb.
      const offer = txfOffer(cs);
      out.push(ui.h("p", { class: "muted small" }, offer.ok ? TXF_FORM_SCREEN : FORM_SCREEN),
        ui.row(ui.button("Save as a spreadsheet (CSV)", () => saveCsv(cs, say), { class: "secondary" }), ui.button("Print this list", () => printList(cs, sheetHost), { class: "secondary" }),
          offer.ok ? ui.button("Save for tax software", () => saveTxf(cs, say), { class: "secondary" }) : null),
        say, ui.h("p", { class: "muted small" }, offer.ok ? TXF_SCREEN : TXF_SEPARATE),
        sheetHost);
    }
    // the form: open while no sale is recorded, else behind "+ Record another sale" (R20)
    if (rec.length) { const host = ui.h("div"); drawRecord(host, rec, cs, cs.count > 0 && !recording); out.push(host); }
    return out;
  }
  function drawRecord(host, rec, cs, folded) {
    host.replaceChildren?.();
    if (folded) { host.append(ui.row(ui.button("+ Record another sale", () => { recording = true; drawRecord(host, rec, cs, false); host.querySelector?.("input, select")?.focus?.({ preventScroll: true }); }, { class: "secondary" }))); return; }
    const coin = rec.find((c) => c.id === recDraft?.coin) ?? rec[0];
    const m = methodOf(plan);
    const last = today && today < `${cs.year}-12-31` ? today : `${cs.year}-12-31`;
    const fields = [
      rec.length > 1 ? { key: "coin", label: "Coin", type: "select", options: rec.map((c) => ({ value: c.id, label: `${c.symbol} · ${c.account}` })) } : null,
      { key: "units", label: "How many coins you sold", type: "number", required: true, min: 0, max: 1e12, step: "any", help: `${coin.symbol} in ${coin.account}: ${coinsText(coin.units)} on your list` },
      { key: "sold", label: "Sold on", type: "date", required: true, min: `${cs.year}-01-01`, max: last },
      { key: "proceeds", label: "What you got for them", type: "money", required: true, min: 0, max: 1e10, help: "in dollars, after the exchange's fee" },
      ...(hasWays(coin) ? coin.lots.map((l) => ({ key: `pick-${l.key}`, label: lotLabel(l), type: "checkbox", more: true })) : []),
    ].filter(Boolean);
    // "Sold on" starts on today when today is in the year (a thumb only confirms it); the green line names the day
    const values = { coin: coin.id, units: recDraft?.units ?? null, sold: recDraft?.sold ?? (today && today >= `${cs.year}-01-01` && today <= last ? today : ""), proceeds: recDraft?.proceeds ?? null };
    const f = ui.form(fields, values, (v) => {
      const c = rec.find((y) => y.id === (v.coin ?? coin.id)) ?? coin;
      const picked = c.lots.filter((l) => v[`pick-${l.key}`]).map((l) => l.key);
      const sale = planSale(plan, { holdingId: c.id, units: v.units, proceeds: v.proceeds, sold: v.sold, picked }, { today });
      if (!sale.ok) {
        const box = sale.field === "picked" ? f.querySelector?.('input[type="checkbox"]') : f.elements?.[sale.field === "coin" ? "coin" : sale.field];
        if (box) return ui.fieldError(box, sale.error);
        f.prepend(ui.notice("error", sale.error));
        return false;
      }
      const id = ui.uid();
      said = { part: "sales", text: recordedSentence(sale, money), note: moneyNote(sale, money), cost: costNote(sale, money), undo: () => { said = { part: "sales", text: UNDONE_SALE }; store.update((p) => { removeSale(p, id, today); }); } };
      recording = false; recDraft = null;
      store.update((p) => { applySale(p, sale, id, today); });
    }, { submitLabel: "Record the sale", moreLabel: "Pick the purchases yourself (optional)", moreOpen: m.key === "picked" && hasWays(coin) ? true : undefined, onCancel: cs.count ? () => { recording = false; recDraft = null; drawRecord(host, rec, cs, true); host.querySelector?.("button")?.focus?.(); } : undefined });
    // another coin: its purchases are drawn, keeping what was typed (nothing is saved until "Record the sale")
    f.elements?.coin?.addEventListener?.("change", () => { recDraft = { coin: f.elements.coin.value, units: f.elements.units?.value ?? null, sold: f.elements.sold?.value ?? "", proceeds: f.elements.proceeds?.value ?? null }; drawRecord(host, rec, cs, false); });
    host.append(...[ui.h("h3", {}, "Record a sale"), ui.h("p", { class: "muted small" }, recordWay(m)), costMissing(coin) ? ui.h("p", { class: "small cr-flag" }, costMissing(coin)) : null, f].filter(Boolean));
  }
  // ---- "Rewards from staking": coins staking paid are income in the year received, at their worth that day, and a purchase
  // on the list at that cost (staking.js; the Federal estimate counts the year's through known.js stakingStep)
  function stakingPartOf(st, rec) {
    return { id: "staking", kind: "item", title: "Rewards from staking", says: stakingStatus(st, money),
      open: said?.part === "staking" ? true : undefined, holds: ["staked", "received", "worth"], body: () => stakingBody(st, rec) };
  }
  function stakingBody(st, rec) {
    const mine = said?.part === "staking" ? said : null;
    const out = [];
    if (mine) {
      // the list above the tapped button changes after a save: the green line is brought under the top bar (ui.reveal)
      const n = mine.error ? ui.notice("error", mine.text) : ui.notice("ok", mine.text);
      out.push(n, mine.undo ? ui.row(ui.button("Undo", mine.undo, { class: "secondary" })) : null);
      ui.reveal?.(n, { block: "start" });
    }
    out.push(ui.h("p", {}, stakingSentence(st, money)));
    const others = othersSentence(st);
    if (others) out.push(ui.h("p", { class: "small" }, others));
    if (st.count) {
      out.push(ui.h("p", { class: "muted small" }, TWICE));
      const shown = [...st.rewards].reverse().slice(0, SHOWN);
      out.push(ui.h("ul", { class: "records" }, shown.map((r) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, rewardTitle(r)), ui.h("span", { class: "rec-value" }, money(r.value))),
        ui.h("div", { class: "rec-sub" }, rewardLine(r, money)),
        ui.h("div", { class: "rec-foot" }, ui.button("Remove this reward", () => takeBack(r), { class: "secondary small" }))))));
      if (st.count > SHOWN) out.push(ui.h("p", { class: "muted small" }, earlierLine(st.count - SHOWN)));
    }
    // the form: open while the year has no reward, else behind "+ Record another reward" (R20)
    if (rec.length) { const host = ui.h("div"); drawReward(host, rec, st, st.count > 0 && !rewarding); out.push(host); }
    out.push(ui.h("p", { class: "muted small" }, RULE));
    return out;
  }
  // a reward taken back asks first, says so, and offers Undo; refused (and said in red) when some of its coins were sold since
  function takeBack(r) {
    if (!ui.confirm(rewardAsk(r, money))) return;
    const can = removeReward(structuredClone(plan), r.id);   // tried on a copy first: a refusal changes nothing
    if (!can.ok) { said = { part: "staking", text: can.error, error: true }; ctx.redraw?.(); return; }
    let undo = null;
    said = { part: "staking", text: rewardRemoved(r), undo: () => { said = { part: "staking", text: UNDONE_REMOVE }; undo?.(); } };
    undo = ui.undoable(store, (p) => { removeReward(p, r.id, today); });   // the wallet's balance comes down by its coins (staking.js walletFollows)
  }
  function drawReward(host, rec, st, folded) {
    host.replaceChildren?.();
    if (folded) { host.append(ui.row(ui.button("+ Record another reward", () => { rewarding = true; drawReward(host, rec, st, false); host.querySelector?.("input, select")?.focus?.({ preventScroll: true }); }, { class: "secondary" }))); return; }
    const coin = rec.find((c) => c.id === rewDraft?.coin) ?? rec[0];
    const fields = [
      rec.length > 1 ? { key: "coin", label: "Coin", type: "select", options: rec.map((c) => ({ value: c.id, label: `${c.symbol} · ${c.account}` })) } : null,
      { key: "staked", label: "How many coins you received", type: "number", required: true, min: 0, max: 1e12, step: "any", help: `${coin.symbol} in ${coin.account}` },
      { key: "received", label: "Received on", type: "date", required: true, max: today },
      { key: "worth", label: "What they were worth that day", type: "money", required: true, min: 0, max: 1e10, help: "in dollars, on the day you got them; your exchange's statement shows it. A month's rewards can go on one line, on the month's last day." },
    ].filter(Boolean);
    const values = { coin: coin.id, staked: rewDraft?.staked ?? null, received: rewDraft?.received ?? today, worth: rewDraft?.worth ?? null };
    const f = ui.form(fields, values, (v) => {
      const c = rec.find((y) => y.id === (v.coin ?? coin.id)) ?? coin;
      const r = planReward(plan, { holdingId: c.id, units: v.staked, day: v.received, value: v.worth }, { today });
      if (!r.ok) {
        const box = f.elements?.[{ coin: "coin", units: "staked", day: "received", value: "worth" }[r.field]];
        if (box) return ui.fieldError(box, r.error);
        f.prepend(ui.notice("error", r.error));
        return false;
      }
      const id = ui.uid();
      // the green line is set before the change (the page is drawn again by it): its new total from the change tried on a copy
      const dry = structuredClone(plan);
      applyReward(dry, r.reward, id);
      let undo = null;
      said = { part: "staking", text: rewardSaid(r.reward, stakingIn(dry, st.year), money), undo: () => { said = { part: "staking", text: UNDONE_RECORD }; undo?.(); } };
      rewarding = false; rewDraft = null;
      undo = ui.undoable(store, (p) => { applyReward(p, r.reward, id, today); });   // the wallet's balance goes up by its coins, the rest of it kept
    }, { submitLabel: "Record the reward", onCancel: st.count ? () => { rewarding = false; rewDraft = null; drawReward(host, rec, st, true); host.querySelector?.("button")?.focus?.(); } : undefined });
    // another coin: its line under the box follows, keeping what was typed (nothing is saved until "Record the reward")
    f.elements?.coin?.addEventListener?.("change", () => { rewDraft = { coin: f.elements.coin.value, staked: f.elements.staked?.value ?? null, received: f.elements.received?.value ?? "", worth: f.elements.worth?.value ?? null }; drawReward(host, rec, st, false); });
    // no statement at hand: one quiet chip under the worth fills in an estimate, the coins typed at the price on the list
    // (staking.js estimateWorth); the box stays the person's to change, and nothing is saved until "Record the reward"
    const price0 = Number((plan.holdings ?? []).find((x) => x && x.id === coin.id)?.price);
    const wBox = f.elements?.worth, sBox = f.elements?.staked;
    if (price0 > 0 && wBox) {
      const chip = ui.h("button", { type: "button", class: "chip", onClick: () => {
        const est = estimateWorth(sBox?.value, price0);
        if (est === null) { if (sBox) ui.fieldError(sBox, ESTIMATE_NEEDS); return; }
        wBox.value = estimateText(est);
        if (typeof wBox.dispatchEvent === "function" && typeof Event === "function") wBox.dispatchEvent(new Event("input", { bubbles: true })); else wBox.dispatch?.("input");
      } }, ESTIMATE_CHIP);
      wBox.closest?.(".field")?.after?.(ui.h("div", { class: "chips" }, chip));
    }
    host.append(ui.h("h3", {}, "Record a reward"), f);
  }

  // the file for a tax preparer (core/csv.js; made on this phone, nothing sent anywhere); its green line under the buttons
  function saveCsv(cs, say) {
    const name = `coin-sales-${cs.year}.csv`;
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([form8949Csv(cs, plan)], { type: "text/csv;charset=utf-8" }));
      a.download = name; a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* gone */ } }, 5000);
      say.replaceChildren?.(ui.notice("ok", `${name} is downloading. Open it with Excel, Numbers or Google Sheets, or send it to your tax preparer.`));
    } catch (e) { say.replaceChildren?.(ui.notice("error", `The file could not be made: ${e.message}. Reload the page and try again.`)); }
  }
  // the file for tax software (txf.js; made on this phone, nothing sent anywhere; nothing saved): its green line says what is
  // left to type in the program
  function saveTxf(cs, say) {
    const name = txfName(cs);
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([txfFile(cs, { today })], { type: "application/octet-stream" }));
      a.download = name; a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch { /* gone */ } }, 5000);
      say.replaceChildren?.(ui.notice("ok", txfSaid(name, txfStats(cs))));
    } catch (e) { say.replaceChildren?.(ui.notice("error", txfFailed(e.message))); }
  }
  // the printout: the report kit's sheet, drawn on the tap and shown only by the printer (scoped to this page's own class)
  function printList(cs, host) {
    const title = `Coin sales in ${cs.year}, for your tax preparer`;
    const { wrap, sheet } = reportFrame(ui, { title });
    wrap.className = `${wrap.className} cr-print`;
    wrap.append(ui.h("style", {}, ".cr-print { display: none; } @media print { .cr-print { display: block !important; } }"));
    const sign = (n) => (n < 0 ? `−${money(-n)}` : `+${money(n)}`);
    const cols = [{ label: "What was sold", get: (l) => l.description }, { label: "Bought", get: (l) => (l.acquired ? dayText(l.acquired) : "not on file") }, { label: "Sold", get: (l) => dayText(l.sold) },
      { label: "Sold for", num: true, get: (l) => money(l.proceeds) }, { label: "Cost", num: true, get: (l) => (l.noCost ? "not on file ($0)" : money(l.cost)) }, { label: "Gain or loss", num: true, get: (l) => sign(l.gain) }, { label: "Held", get: (l) => (l.term === "long" ? "long-term" : "short-term") }];
    sheet.append(ui.h("h1", {}, title), ui.h("p", { class: "rp-sub" }, `From the plan on ${dayText(today)}: the coin sales recorded on Crypto, one line per purchase sold.`),
      ui.h("p", { class: "rp-lead" }, coinSalesSentence(cs, money)), rtable(ui, cols, cs.lines), ui.h("p", { class: "rp-foot" }, FORM_NOTE));
    host.replaceChildren?.(wrap);
    if (typeof window !== "undefined" && typeof window.print === "function") printSheet(title, sheet);
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
    }, { submitLabel: "Add coin", onCancel: first ? undefined : () => { adding = false; drawAdd(); addHost.querySelector?.("button")?.focus?.(); } });   // back on the button (in view: the form above it is gone)
    // a purchase date still to come was taken ("long-term from Jan 2, 2100")
    const when = form.elements.date;
    const dateRule = () => when.setCustomValidity(when.value && when.value > today ? "A purchase date cannot be in the future." : "");
    when.addEventListener("input", dateRule); when.addEventListener("change", dateRule); dateRule();
    return first ? ui.h("section", { class: "card" }, ui.h("h2", {}, "Add a coin"), form) : ui.h("div", {}, ui.h("h3", {}, "Add another coin"), form);
  }
  // a crypto account's balance follows its coins (only accounts that have coins listed)
  function syncCrypto(p) {
    for (const a of (p.accounts ?? []).filter((x) => x.type === "crypto")) {
      const mine = (p.holdings ?? []).filter((h) => h.accountId === a.id);
      if (mine.length) { a.balance = Math.round(mine.reduce((s, h) => s + (Number(h.shares) || 0) * (Number(h.price) || 0), 0) * 100) / 100; a.asOf = today; }
    }
  }
}
