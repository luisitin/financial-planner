// modules/career/equity/view.js -- DOM only. Stock from work: the stake, units vesting this year and next with the tax
// to set aside, each option grant (exercising now; for incentive options the amount that adds no alternative minimum
// tax, shared across grants, and when a sale qualifies), purchase-plan shares sold now or later; the company, the grants
// and the purchased shares edited in folds.
import { compute, DEFAULT_GRANT, ESPP_DISCOUNT, ISO_AFTER_LEAVING, ISO_LIMIT } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let editing = null;   // the grant or lot whose form is open
let openFold = null;  // the fold just saved stays open

const STYLE = `
.eq-root .eq-lines { list-style: none; margin: 0; padding: 0; }
.eq-root .eq-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.eq-root .eq-lines li:last-child { border-bottom: 0; }
.eq-root .eq-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
.eq-root .eq-say { margin: 8px 0; }
.eq-root .eq-past { color: var(--muted); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const price2 = (n) => fmt.money(n, cur, "en-US", 2);
  const pct = (x, dp = 0) => `${(x * 100).toFixed(dp)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const eq = plan.equity ?? {};
  const root = ui.h("div", { class: "eq-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const n0 = (x) => Math.round(x).toLocaleString("en-US");
  const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const saveEq = (msg, fn) => { pending = msg; store.update((p) => { p.equity = p.equity ?? {}; fn(p.equity); }); };
  // an error shown next to its form, replacing any earlier one
  const formError = (form, text) => { form.querySelector(".notice.error")?.remove(); form.prepend(ui.notice("error", text)); form.scrollIntoView({ block: "start" }); };

  if (!d.ready) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Stock from work"),
    ui.h("p", { class: "lede" }, "Units and options from your employer, and shares bought through its purchase plan: when they vest, the tax each brings and how much to set aside, when to exercise options, and when selling costs less tax."),
    ui.h("p", { class: "muted small" }, "Start with the company's share price below, then add each grant from your stock plan's website.")));
  for (const n of d.notes ?? []) root.append(ui.notice("info", n));
  if (d.ready && d.needsPrice) root.append(ui.notice("warn", "Type today's share price under \"The company\" below to see what your grants and shares are worth and the tax they bring."));
  if (d.esppSkipped) root.append(ui.notice("warn", `${d.esppSkipped} purchase${d.esppSkipped === 1 ? " is" : "s are"} missing a price (paid, at the offering's start or on the day bought) and ${d.esppSkipped === 1 ? "is" : "are"} left out: add ${d.esppSkipped === 1 ? "it" : "them"} under "Purchase-plan shares".`));

  if (d.ready && !d.needsPrice) {
    // the stake
    if (d.stake) {
      const ok = d.stake.level === "ok";
      root.append(ui.card(`${d.symbol || "Your company"} at ${price2(d.price)}`, ui.row(
        ui.stat("Yours now", money(d.stake.owned), "shares listed on Holdings and vested options' value"),
        ui.stat("Still to vest", money(d.stake.unvested), "if you stay"),
      ), d.stake.share !== null ? ui.h("p", { class: "eq-say" }, `${pct(d.stake.share)} of everything you have invested rides on the company${d.person ? ` that pays ${d.person.name}` : ""}${ok ? ": within the usual 10% for one company." : "; up to 10% is the usual most for one company."}`) : null,
      d.stake.vestedUnits > 0 ? ui.h("p", { class: "muted small" }, "Units that have vested count here once you add their shares on Holdings (or sell them).") : null,
      ui.row(ui.h("a", { class: ok ? "btn secondary" : "btn", href: "#/investments/employer-stock" }, ok ? "Employer stock" : "How to bring it down"))));
    }

    // units, by the year they vest in
    for (const y of d.rsuYears) if (y.vests.length) {
      const t = y.tax;
      root.append(ui.card(`Units vesting in ${y.year}`, ui.h("ul", { class: "records" }, y.vests.map((v) => ui.h("li", { class: v.past ? "eq-past" : null },
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${shortDate(v.date)}${v.past ? " (vested)" : ""}`), ui.h("span", { class: "rec-value" }, money(v.value))),
        ui.h("div", { class: "rec-sub" }, `${n0(v.shares)} units from "${v.grant}"`)))),
      ui.h("ul", { class: "eq-lines" },
        ui.h("li", {}, ui.h("span", {}, "Taxed as pay"), ui.h("span", {}, money(t.value))),
        ui.h("li", {}, ui.h("span", {}, "Federal tax on it"), ui.h("span", {}, money(t.federal))),
        ui.h("li", {}, ui.h("span", {}, "Held back for federal tax"), ui.h("span", {}, money(t.withheldFederal))),
        ui.h("li", {}, ui.h("span", {}, "Social Security and Medicare"), ui.h("span", {}, money(t.payroll))),
        t.state > 0 ? ui.h("li", {}, ui.h("span", {}, "State tax"), ui.h("span", {}, money(t.state))) : null),
      ui.h("p", { class: "eq-say" }, t.gap > 50 ? `Set aside about ${money(t.gap)} more for the tax return: what is held back falls short of your rate.` : t.gap < -50 ? `What is held back is about ${money(-t.gap)} more than the tax: a refund, or less to set aside elsewhere.` : "What is held back about covers the tax."),
      ui.h("p", { class: "muted small" }, `At today's price; the real value is the price on each vest day. For federal tax the employer holds back 22% of the value (37% above ${money(1000000)} in a year), whatever your own rate.`)));
    }

    // the room before the alternative minimum tax, once for all incentive options
    const isos = d.options.filter((o) => o.iso && o.iso.shares > 0 && o.spreadEach > 0);
    if (isos.length) root.append(ui.card("Incentive options this year", ui.h("p", { class: "eq-say" }, ui.h("b", {}, isos[0].iso.unlimited ? "You can exercise all of them this year without the alternative minimum tax." : `You can exercise options worth up to ${money(d.isoRoom)} over their cost this year without the alternative minimum tax.`)),
      isos.length > 1 ? ui.h("ul", { class: "eq-lines" }, isos.map((o) => ui.h("li", {}, ui.h("span", {}, o.name), ui.h("span", {}, `${n0(o.iso.roomShares)} of ${n0(o.iso.shares)}`)))) : null,
      ui.h("p", { class: "muted small" }, "The room is counted with this year's pay and the units vesting this year, grant by grant from the oldest.")));
    if (d.isoOver.length) root.append(ui.notice("info", `More than ${money(ISO_LIMIT)} of incentive options (counted at the price you pay) ${d.isoOver.every((x) => x.year < d.year) ? "vested" : "vest"} in ${list(d.isoOver.map((x) => String(x.year)))}; the part over ${money(ISO_LIMIT)} in each year is taxed like nonqualified options.`));

    // options
    for (const o of d.options) {
      const card = ui.card(o.name);
      if (o.vested === 0) {
        card.append(ui.h("p", {}, o.next ? `None can be bought yet: the first ${n0(o.next.shares)} vest on ${shortDate(o.next.date)}, at ${price2(o.strike)} each.` : `None can be bought yet.`));
        if (o.expires) card.append(ui.h("p", { class: "muted small" }, `They end on ${shortDate(o.expires)}.`));
        root.append(card); continue;
      }
      card.append(ui.h("ul", { class: "eq-lines" },
        ui.h("li", {}, ui.h("span", {}, `Vested: ${n0(o.vested)} options at ${price2(o.strike)}`), ui.h("span", {}, `${money(o.spread)} over cost`)),
        o.unvested ? ui.h("li", {}, ui.h("span", {}, "Still to vest"), ui.h("span", {}, n0(o.unvested))) : null,
        ui.h("li", {}, ui.h("span", {}, "Buying the vested ones costs"), ui.h("span", {}, money(o.cost)))));
      if (o.spreadEach <= 0) card.append(ui.h("p", { class: "eq-say" }, `The share price is at or under the ${price2(o.strike)} you would pay: nothing to gain by exercising now.`));
      else {
        if (o.iso && o.iso.shares > 0) {
          const s = o.iso;
          card.append(ui.h("p", {}, s.amtAll > 0.5 ? `All ${n0(s.shares)} incentive options would add about ${money(s.amtAll)} of the alternative minimum tax; most of that comes back as a credit in later years.` : `All ${n0(s.shares)} incentive options add none of it this year.`),
            ui.h("p", {}, `If you buy them today, keep the shares past ${shortDate(s.holdUntil)} (more than a year after buying and two after the grant) and the whole gain is taxed at the lower long-term rates. Sold sooner, the ${money(s.spread)} is taxed as pay: about ${money(s.sameYearTax.total)}.`));
        }
        if (o.nso) card.append(ui.h("p", { class: "eq-say" }, `${o.type === "iso" ? `${n0(o.nsoShares)} of them are over the ${money(ISO_LIMIT)}-a-year rule and count as nonqualified: buying` : "Buying all of them"} now makes ${money(o.nso.value)} of pay: about ${money(o.nso.owed)} in tax, ${money(o.nso.withheld)} of it held back.`));
        card.append(ui.h("p", { class: "muted small" }, o.type === "iso"
          ? `Incentive options pay no Social Security or Medicare. They must be bought within ${ISO_AFTER_LEAVING} months of leaving the job to stay incentive options${o.expires ? `, and they end on ${shortDate(o.expires)}` : ""}.`
          : `The gain after buying is taxed when the shares are sold (long-term after more than a year).${o.expires ? ` They end on ${shortDate(o.expires)}.` : ""}`));
      }
      root.append(card);
    }

    // purchase-plan shares
    if (d.espp.length) root.append(ui.card("Shares from the purchase plan", ui.h("ul", { class: "records" }, d.espp.map((e) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${n0(e.shares)} shares bought ${shortDate(e.purchaseDate)}`), ui.h("span", { class: "rec-value" }, money(e.now.proceeds))),
      ui.h("div", { class: "rec-sub" }, `Worth ${money(e.now.proceeds)} today. ${e.now.qualifying ? `A qualifying sale now: about ${money(e.taxNow.total)} in tax.` : `Sold now: about ${money(e.taxNow.total)} in tax. From ${shortDate(e.now.qualifiesOn)}: about ${money(e.taxAtQualifying.total)}${e.wait > 0.5 ? `, ${money(e.wait)} less if the price holds` : ""}.`}`),
      ui.h("div", { class: "rec-foot" }, ui.button("Change", () => { editing = e.id; drawLots(); lotsFold.open = true; lotsFold.scrollIntoView({ block: "start" }); }, { class: "secondary small" }), ui.button("Remove", () => { if (!ui.confirm("Remove these shares?")) return; saveEq("Shares removed.", (q) => { q.espp = (q.espp ?? []).filter((x) => x.id !== e.id); }); }, { class: "secondary small" }))))),
      ui.h("p", { class: "muted small" }, "Waiting for a qualifying sale (more than two years after the offering began, and more than one after buying) taxes less of the gain as pay, but leaves the money on one company for longer.")));
  }

  // the company
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const coFields = [
    { key: "symbol", label: "Company stock symbol", type: "text", placeholder: "e.g. ACME" },
    { key: "price", label: "Price of one share today", type: "money", min: 0 },
    adults.length > 1 ? { key: "personId", label: "Who works there", type: "select", options: [{ value: "", label: "Whoever has a salary" }, ...adults.map((p) => ({ value: p.id, label: p.name || "Someone" }))] } : null,
  ].filter(Boolean);
  root.append(ui.h("details", { class: "card fold fold-card", open: !d.ready || d.needsPrice || openFold === "company" || null }, ui.h("summary", {}, ui.h("h2", {}, "The company"), ui.h("span", { class: "fold-status" }, d.ready && d.price > 0 ? `${d.symbol || "a share"} at ${price2(d.price)}` : "not set yet"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(coFields, { symbol: eq.symbol ?? "", price: eq.price ?? null, personId: eq.personId ?? "" }, (v) => {
      openFold = "company";
      saveEq("Saved.", (q) => { q.symbol = String(v.symbol ?? "").trim().toUpperCase(); if (v.price !== null && v.price !== q.price) q.priceAsOf = today; q.price = v.price; if (v.personId !== undefined) q.personId = v.personId; });
    }, { submitLabel: "Save" })));

  // the grants
  const grants = eq.grants ?? [];
  const kindOf = (g) => (g.kind === "option" ? (g.optionType === "iso" ? "iso" : "nso") : "rsu");
  const KIND = [{ value: "rsu", label: "Restricted stock units" }, { value: "nso", label: "Nonqualified options" }, { value: "iso", label: "Incentive options" }];
  const grantFields = [
    { key: "kind", label: "Kind", type: "select", options: KIND, help: "units are shares given to you as they vest; options are the right to buy at a set price, and the plan's papers say which kind" },
    { key: "name", label: "Name", type: "text", placeholder: "e.g. 2026 new-hire grant" },
    { key: "shares", label: "Units or options granted", type: "number", min: 1, step: "1", required: true },
    { key: "strike", label: "Options: the price you pay per share", type: "money", min: 0 },
    { key: "granted", label: "Grant date", type: "date", required: true, help: "the two years for a qualifying sale run from here" },
    { key: "vestStart", label: "Vesting starts", type: "date", help: "empty: the grant date" },
    { key: "vestMonths", label: "Vests over (months)", type: "number", min: 1, max: 120, step: "1" },
    { key: "cliffMonths", label: "First part vests after (months)", type: "number", min: 0, max: 60, step: "1", help: "the cliff; 0 for none" },
    { key: "every", label: "Then every (months)", type: "number", min: 1, max: 12, step: "1" },
  ];
  const grantForm = (g) => {
    const form = ui.form(grantFields, g ? { ...g, kind: kindOf(g) } : { kind: "rsu", ...DEFAULT_GRANT }, (v) => {
      if (!(v.shares > 0) || !v.granted) return formError(form, "Type how many units or options, and the grant date.");
      if (v.kind !== "rsu" && !(v.strike > 0)) return formError(form, "Type the price you pay per share for these options.");
      const item = { kind: v.kind === "rsu" ? "rsu" : "option", optionType: v.kind === "rsu" ? null : v.kind, name: String(v.name ?? "").trim(), granted: v.granted, vestStart: v.vestStart || v.granted, shares: Math.floor(v.shares), strike: v.kind === "rsu" ? null : v.strike, vestMonths: v.vestMonths ?? DEFAULT_GRANT.vestMonths, cliffMonths: v.cliffMonths ?? DEFAULT_GRANT.cliffMonths, every: v.every ?? DEFAULT_GRANT.every };
      editing = null; openFold = "grants";
      saveEq(g ? "Grant saved." : "Grant added.", (q) => { q.grants = q.grants ?? []; if (g) Object.assign(q.grants.find((x) => x.id === g.id) ?? {}, item); else q.grants.push({ id: ui.uid(), ...item }); });
    }, { submitLabel: g ? "Save the grant" : "Add the grant", onCancel: g ? () => { editing = null; drawGrants(); } : null });
    return form;
  };
  const grantBody = ui.h("div", {});
  const addGrant = () => {
    if (!grants.length) return grantForm(null);
    const box = ui.h("div", {});
    const b = ui.button("+ Add another grant", () => { b.remove(); box.append(grantForm(null)); }, { class: "secondary" });
    box.append(ui.row(b));
    return box;
  };
  const drawGrants = () => grantBody.replaceChildren(...[grants.length ? ui.h("ul", { class: "records" }, grants.map((g) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, g.name || KIND.find((k) => k.value === kindOf(g)).label), ui.h("span", { class: "rec-value" }, n0(g.shares))),
    ui.h("div", { class: "rec-sub" }, `${kindOf(g) === "rsu" ? "Units" : `${kindOf(g) === "iso" ? "Incentive" : "Nonqualified"} options at ${price2(g.strike ?? 0)}`}, vesting from ${g.vestStart ? shortDate(g.vestStart) : "?"} over ${g.vestMonths ?? DEFAULT_GRANT.vestMonths} months`),
    editing === g.id ? grantForm(g) : ui.h("div", { class: "rec-foot" }, ui.button("Change", () => { editing = g.id; drawGrants(); }, { class: "secondary small" }), ui.button("Remove", () => { if (!ui.confirm(`Remove ${g.name || "this grant"}?`)) return; saveEq("Grant removed.", (q) => { q.grants = (q.grants ?? []).filter((x) => x.id !== g.id); }); }, { class: "secondary small" }))))) : null, addGrant()].filter(Boolean));
  drawGrants();
  root.append(ui.h("details", { class: "card fold fold-card", open: !grants.length || openFold === "grants" || null }, ui.h("summary", {}, ui.h("h2", {}, "Grants"), ui.h("span", { class: "fold-status" }, grants.length ? `${grants.length} grant${grants.length === 1 ? "" : "s"}` : "none yet"), ui.h("span", { class: "fold-chev" }, "›")), grantBody));

  // purchase-plan shares
  const lots = eq.espp ?? [];
  const lotFields = [
    { key: "offeringDate", label: "Offering period began", type: "date", required: true },
    { key: "purchaseDate", label: "Bought on", type: "date", required: true },
    { key: "shares", label: "Shares bought", type: "number", min: 0, step: "any", required: true },
    { key: "price", label: "Price paid per share", type: "money", min: 0, required: true },
    { key: "fmvOffering", label: "Share price when the offering began", type: "money", min: 0, required: true },
    { key: "fmvPurchase", label: "Share price on the day you bought", type: "money", min: 0, required: true },
    { key: "discount", label: "The plan's discount", type: "percent", min: 0, max: 15, help: "usually 15" },
  ];
  const lotForm = (l) => {
    const form = ui.form(lotFields, l ?? { discount: ESPP_DISCOUNT }, (v) => {
      if (!(v.shares > 0) || !v.offeringDate || !v.purchaseDate || v.price === null || v.fmvOffering === null || v.fmvPurchase === null) return formError(form, "Type the shares, the dates and the three prices: they are on the plan's statement.");
      editing = null; openFold = "espp";
      saveEq(l ? "Shares saved." : "Shares added.", (q) => { q.espp = q.espp ?? []; if (l) Object.assign(q.espp.find((x) => x.id === l.id) ?? {}, v); else q.espp.push({ id: ui.uid(), ...v }); });
    }, { submitLabel: l ? "Save" : "Add the shares", onCancel: l ? () => { editing = null; drawLots(); } : null });
    return form;
  };
  const lotBody = ui.h("div", {});
  function drawLots() {
    const lotEdit = lots.find((l) => l.id === editing);
    if (lotEdit) return lotBody.replaceChildren(lotForm(lotEdit));
    if (!lots.length) return lotBody.replaceChildren(lotForm(null));
    const b = ui.button("+ Add more shares", () => { b.remove(); lotBody.append(lotForm(null)); }, { class: "secondary" });
    lotBody.replaceChildren(ui.row(b));
  }
  drawLots();
  const lotsFold = ui.h("details", { class: "card fold fold-card", open: openFold === "espp" || null }, ui.h("summary", {}, ui.h("h2", {}, "Purchase-plan shares"), ui.h("span", { class: "fold-status" }, lots.length ? `${lots.length} purchase${lots.length === 1 ? "" : "s"}` : "none"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", { class: "muted small" }, "Each purchase is on the plan's statement (Form 3922 after the year ends)."), lotBody);
  root.append(lotsFold);
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/investments/employer-stock" }, "Employer stock"), ui.h("a", { class: "btn secondary", href: "#/career/benefits" }, "Benefits"), ui.h("a", { class: "btn secondary", href: "#/taxes/capital-gains" }, "Capital gains"))));
}
