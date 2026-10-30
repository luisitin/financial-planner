// modules/career/offer-compare/view.js -- DOM only. The job you have against up to three offers: which comes out
// ahead over the years compared after tax and commuting, each one's year in lines, the hourly figure, what happens if
// the stock halves; your job now and each offer in folds, "+ Add an offer" folded once there is one.
import { compute, MAX_OFFERS, DEFAULTS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let openId = null;    // the job whose form was just saved stays open

const STYLE = `
.oc-root .oc-lines { list-style: none; margin: 0; padding: 0; }
.oc-root .oc-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.oc-root .oc-lines li:last-child { border-bottom: 0; }
.oc-root .oc-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.oc-root .oc-lines .oc-tot { font-weight: 700; }
.oc-root .oc-verdict { font-weight: 650; margin: 8px 0 4px; }
.oc-root .oc-add { margin: 4px 0 16px; }
.oc-root .oc-remove { margin-top: 10px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const big = (n) => fmt.money(Math.round(n / 100) * 100, cur);
  const signed = (n) => `${n >= 0 ? "+" : "−"}\u2060${big(Math.abs(n))}`;   // the word joiner keeps the sign with its number
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "oc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const s = plan.whatIfs?.offers ?? {};
  const offers = s.offers ?? [];
  const save = (msg, fn) => { pending = msg; store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.offers = p.whatIfs.offers ?? {}; fn(p.whatIfs.offers); }); };

  if (!offers.length) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Compare a job offer"),
    ui.h("p", { class: "lede" }, "Put your job now next to up to three offers. The page adds up everything each one pays (salary, bonus, stock, the retirement match, health costs), takes off tax and the commute, and shows what you keep over the years you would stay and for each hour of your time."),
    ui.h("p", { class: "muted small" }, d.ready ? "Your job now comes from the Income page and your retirement saving. Add the first offer below." : "Add your pay on the Income page first, or type your job now below.")));
  for (const n of d.notes ?? []) root.append(ui.notice("info", n));
  if (d.forfeit > 0.5) root.append(ui.notice("info", `Leaving gives up stock still to vest at your employer: about ${big(d.forfeit)} at today's price. The comparison counts only the part that would vest in the ${d.years} years.`));

  // the verdict
  if (d.ready && d.options.length > 1) {
    const best = d.options.find((o) => o.id === d.best), second = d.options.find((o) => o.id === d.runnerUp);
    const now = d.options[0];
    const against = d.hasJob ? "your job now" : "having no job";
    root.append(ui.card(`Over ${d.years} years, after tax and commuting`, ui.row(
      best.current ? ui.stat("Your job now comes out ahead by", big(best.overYears.net - second.overYears.net), `against ${second.name}; ${big(best.overYears.net)} kept in all`)
        : ui.stat(`${best.name} comes out ahead by`, big(best.vsCurrent), `against ${against}; ${big(best.overYears.net)} kept in all`),
      best.perHour !== null ? ui.stat(`An hour of your time ${best.current ? "in your job now" : `at ${best.name}`}`, fmt.money(best.perHour, cur), now.perHour !== null && !best.current ? `${fmt.money(now.perHour, cur)} in your job now, with the commute counted` : "after tax, with the commute counted") : null,
    ), ui.h("ul", { class: "records" }, [...d.options].sort((a, b) => a.rank - b.rank).map((o) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.name, o.id === d.best ? " " : null, o.id === d.best ? ui.h("span", { class: "pill ok" }, "best") : null), ui.h("span", { class: "rec-value" }, big(o.overYears.net))),
      ui.h("div", { class: "rec-sub" }, [`${money(o.yearly.total)} a year in pay and benefits`, o.perHour !== null ? `${fmt.money(o.perHour, cur)} an hour` : null, o.current ? null : `${signed(o.vsCurrent)} against ${d.hasJob ? "now" : "no job"}`].filter(Boolean).join("; ")),
      o.stockYears > 0 ? ui.h("div", { class: "rec-sub" }, `${Math.round(o.stockShare * 100)}% of it is stock; if the stock halved: ${big(o.ifStockHalves)}`) : null))),
    ui.h("p", { class: "muted small" }, "Kept means pay and benefits, less tax, the health premiums you pay, moving and the commute. The retirement match and health-account money count as yours now, though you may have to stay a while to keep the match. Stock counts at today's value. Later years use that year's tax brackets and Social Security limit.")));
  }

  // each option's year
  if (d.ready) for (const o of d.options) root.append(yearCard(o));

  // your job now
  const c = s.current ?? {};
  const nowFields = [
    { key: "salary", label: "Salary a year", type: "money", min: 0, help: "empty: your pay on the Income page" },
    { key: "bonus", label: "Bonus a year (what you expect)", type: "money", min: 0, help: "empty: your bonuses on the Income page" },
    { key: "stockYearly", label: "Stock a year", type: "money", min: 0, help: "empty: your grants as they vest (Employer stock page)" },
    { key: "matchYearly", label: "Employer's retirement money a year", type: "money", min: 0, help: "empty: the match on the Contributions page" },
    ...shared(),
  ];
  const nowValues = { ...Object.fromEntries(nowFields.map((f) => [f.key, c[f.key] ?? null])) };
  root.append(ui.h("details", { class: "card fold fold-card", open: openId === "current" || null }, ui.h("summary", {}, ui.h("h2", {}, "Your job now: the figures"), ui.h("span", { class: "fold-status" }, d.ready ? "change" : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", { class: "muted small" }, "Leave a box empty to use what the plan already knows."),
    ui.form(nowFields, nowValues, (v) => { openId = "current"; save("Your job now is saved.", (w) => { w.current = clean(v); }); }, { submitLabel: "Save" })));

  // the offers
  offers.forEach((o, i) => {
    const fields = offerFields();
    root.append(ui.h("details", { class: "card fold fold-card", open: openId === o.id || null }, ui.h("summary", {}, ui.h("h2", {}, `${o.name || `Offer ${i + 1}`}: the figures`), ui.h("span", { class: "fold-status" }, "change"), ui.h("span", { class: "fold-chev" }, "›")),
      matchHints(ui.form(fields, Object.fromEntries(fields.map((f) => [f.key, o[f.key] ?? null])), (v) => { openId = o.id; save(`${v.name || `Offer ${i + 1}`} is saved.`, (w) => { const x = w.offers.find((y) => y.id === o.id); if (x) Object.assign(x, clean(v)); }); }, { submitLabel: "Save" })),
      ui.h("div", { class: "row oc-remove" }, ui.button("Remove this offer", () => { if (!ui.confirm(`Remove ${o.name || "this offer"}?`)) return; openId = null; save(`${o.name || `Offer ${i + 1}`} is removed.`, (w) => { w.offers = w.offers.filter((y) => y.id !== o.id); }); }, { class: "secondary" }))));
  });
  if (offers.length < MAX_OFFERS) {
    const fields = offerFields();
    const form = matchHints(ui.form(fields, { name: "" }, (v) => { const id = ui.uid(); openId = null; save(`${v.name || `Offer ${offers.length + 1}`} is added.`, (w) => { w.offers = w.offers ?? []; w.offers.push({ id, ...clean(v) }); }); }, { submitLabel: "Add the offer" }));
    if (!offers.length) root.append(ui.card("An offer", form));
    else {
      const holder = ui.h("div", { class: "oc-add" });
      const btn = ui.button("+ Add another offer", () => { btn.remove(); holder.append(ui.card("Another offer", form)); }, { class: "secondary" });
      holder.append(ui.row(btn));
      root.append(holder);
    }
  }

  // the comparison's settings
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const setFields = [
    adults.length > 1 ? { key: "personId", label: "Whose job", type: "select", options: adults.map((p) => ({ value: p.id, label: p.name || "Someone" })) } : null,
    { key: "years", label: "Years to compare", type: "number", min: 1, max: 10, step: "1", help: "how long you would stay; stock grants often vest over 4" },
  ].filter(Boolean);
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "How it compares"), ui.h("span", { class: "fold-status" }, `${d.years} years${d.person ? `, ${d.person.name}` : ""}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(setFields, { personId: d.person?.id ?? "", years: d.years }, (v) => save("Saved.", (w) => { if (v.personId !== undefined) w.personId = v.personId; w.years = v.years ?? DEFAULTS.years; }), { submitLabel: "Save" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/career/salary" }, "Salary and raises"), ui.h("a", { class: "btn secondary", href: "#/career/benefits" }, "Benefits"), ui.h("a", { class: "btn secondary", href: "#/investments/employer-stock" }, "Employer stock"))));

  function yearCard(o) {
    const y = o.yearly, t = o.tax;
    const line = (label, amount, minus = false) => (amount > 0.5 ? ui.h("li", {}, ui.h("span", {}, label), ui.h("span", {}, `${minus ? "−" : ""}${money(amount)}`)) : null);
    const kept = o.afterTax - o.time.commuteCost;
    return ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, `${o.name}: the first year`), ui.h("span", { class: "fold-status" }, `${money(kept)} kept`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "oc-lines" }, [
        line("Salary", y.salary), line("Bonus", y.bonus), line("Sign-on bonus", o.signOn), line("Stock", y.stock), line("Retirement match", y.match), line("Health account money", y.hsa), line("Other benefits", y.other),
        line("Health premiums you pay", y.premium, true), line("Federal income tax", t.federal, true), line("Social Security and Medicare", t.payroll, true), line("State tax", t.state, true), line("Moving", o.moving, true), line("Commute", o.time.commuteCost, true),
        ui.h("li", { class: "oc-tot" }, ui.h("span", {}, "Kept the first year"), ui.h("span", {}, money(kept))),
      ]),
      o.time.work > 0 ? ui.h("p", { class: "muted small" }, [
        `${Math.round(o.time.work).toLocaleString("en-US")} hours of work a year (${o.inputs.hoursWeek} a week, ${o.inputs.ptoDays} days off)`,
        o.time.commuteHours > 0 ? `${Math.round(o.time.commuteHours).toLocaleString("en-US")} hours on the commute` : "no commute",
      ].join("; ") + ".") : null,
      o.perHour !== null ? ui.h("p", {}, `An ordinary year keeps about ${fmt.money(o.perHour, cur)} for every hour of work and travel.`) : null);
  }
  function shared(forOffer = false) {
    const now = d.options?.[0]?.inputs;
    const same = (v, fallback) => (forOffer && now && d.hasJob ? `empty: the same as your job now (${v})` : fallback);
    return [
      { key: "hsaEmployer", label: "Employer's health account money a year", type: "money", min: 0 },
      { key: "premium", label: "Health insurance you pay a year", type: "money", min: 0, help: "your share of the premiums" },
      { key: "otherYearly", label: "Other benefits worth a year", type: "money", min: 0, help: "a pension, tuition help, meals, a phone" },
      { key: "ptoDays", label: "Paid days off a year, holidays too", type: "number", min: 0, max: 100, step: "1", help: same(now?.ptoDays, `empty: ${DEFAULTS.ptoDays}, an example`) },
      { key: "hoursWeek", label: "Hours worked a week", type: "number", min: 0, max: 100, step: "1", help: same(now?.hoursWeek, `empty: ${DEFAULTS.hoursWeek}`) },
      { key: "officeDays", label: "Days a week at the workplace", type: "number", min: 0, max: 7, step: "1", help: `empty: ${DEFAULTS.officeDays}; 0 if fully remote` },
      { key: "commuteMinutes", label: "Commute each way, minutes", type: "number", min: 0, max: 300, step: "1" },
      { key: "commuteCost", label: "Commute cost a day, both ways", type: "money", min: 0, help: "fuel, parking, tolls, transit" },
      { key: "raise", label: "Raise every year", type: "percent", min: 0, max: 30, help: forOffer ? same(now ? `${Number((now.raise * 100).toFixed(1))}%` : "", "empty: the raise on the Income page") : "empty: the raise on the Income page" },
      { key: "stateRate", label: "State income tax rate", type: "percent", min: 0, max: 15, help: "empty: your state now (the State tax page)" },
    ];
  }
  function offerFields() {
    return [
      { key: "name", label: "Who is offering", type: "text", placeholder: "e.g. the company's name" },
      { key: "salary", label: "Salary a year", type: "money", min: 0, required: true },
      { key: "bonus", label: "Bonus a year (what you expect)", type: "money", min: 0 },
      { key: "signOn", label: "Sign-on bonus (once)", type: "money", min: 0 },
      { key: "stockYearly", label: "Stock a year", type: "money", min: 0, help: "the grant's value divided by the years it vests over" },
      { key: "matchRate", label: "Retirement match: for each dollar you put in, they add", type: "percent", min: 0, max: 300, help: "50 means 50 cents a dollar" },
      { key: "matchUpTo", label: "On what you put in up to", type: "percent", min: 0, max: 100, help: "a share of your pay; 6 means the first 6%" },
      ...shared(true),
      { key: "movingCost", label: "Moving costs (once)", type: "money", min: 0 },
    ];
  }
  function matchHints(form) {
    const set = (name, text) => { const el = form.querySelector(`[name=${name}]`); if (el) el.placeholder = text; };
    set("matchRate", "e.g. 50"); set("matchUpTo", "e.g. 6");
    return form;
  }
  function clean(v) { const out = {}; for (const [k, x] of Object.entries(v)) out[k] = typeof x === "string" ? x.trim() : x ?? null; return out; }
}
