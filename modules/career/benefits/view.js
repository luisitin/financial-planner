// modules/career/benefits/view.js -- DOM only. Open enrollment for one earner: the 401(k) choices (now, the whole
// match, the limit) with what each costs a paycheck and a button that sets it on the plan; the health savings
// account's room; the flexible spending accounts and commuting; the stock purchase plan; life cover through work; the
// paycheck in sum; the employer's rules and the choices in folds at the end.
import { compute, DEFAULT_TIERS } from "./compute.js";
import { perYear } from "../../../core/math/periods.js";

let pending = null;   // the confirmation shown on the next render
let openFold = null;  // the settings fold just saved stays open

const STYLE = `
.bn-root .bn-lines { list-style: none; margin: 0; padding: 0; }
.bn-root .bn-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.bn-root .bn-lines li:last-child { border-bottom: 0; }
.bn-root .bn-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
.bn-root .bn-say { margin: 6px 0 10px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x, dp = 1) => `${Number((x * 100).toFixed(dp))}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "bn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Open enrollment"),
      ui.h("p", { class: "lede" }, "What to choose when your employer asks: how much to put in the 401(k), the health savings account, the flexible spending accounts, the stock purchase plan, and what each one costs a paycheck after the tax it saves."),
      d.why === "no-person"
        ? [ui.h("p", { class: "muted small" }, "Your pay is on the Income page but not linked to anyone: add yourself on People, then choose whose pay it is on Income."), ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"), ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Income"))]
        : [ui.h("p", { class: "muted small" }, "First add your pay on the Income page as \"Pay from a job\"."), ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your pay on Income"))]));
    return;
  }
  const pid = d.person.id;
  const mineSaved = plan.whatIfs?.benefits?.[pid];
  const save = (msg, fn) => { pending = msg; store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.benefits = p.whatIfs.benefits ?? {}; p.whatIfs.benefits[pid] = p.whatIfs.benefits[pid] ?? {}; fn(p.whatIfs.benefits[pid], p); }); };
  const capped = (typed, used, what) => (typed > used + 0.5 ? ui.notice("warn", `You typed ${money(typed)} for ${what}; the most you can put in is ${money(used)}, so the page uses that.`) : null);

  if (!mineSaved) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Open enrollment"),
    ui.h("p", { class: "lede" }, `${d.person.name}'s workplace benefits for ${d.planYear}: how much to put in the 401(k), the health savings account, the flexible spending accounts and the stock plan, and what each costs a paycheck after the tax it saves.`),
    ui.h("p", { class: "muted small" }, "Put in your employer's match and your choices under \"Your employer's match\" and the folds after it, near the end.")));
  for (const n of d.notes) root.append(ui.notice("info", n));

  // the 401(k)
  const k = d.k401;
  const k401 = ui.card(`Your 401(k) for ${d.planYear}`);
  if (k.tiersAssumed) k401.append(ui.h("p", { class: "bn-say" }, k.leftBehind > 0.5
    ? `If your employer matches 50 cents a dollar on the first 6% of pay (a common match), you leave about ${money(k.leftBehind)} a year of its money behind. Put in your employer's real match under "Your employer's match".`
    : `This assumes a common match: 50 cents a dollar on the first 6% of pay. Put in your employer's real match under "Your employer's match".`));
  else if (k.fullMatch <= 0) k401.append(ui.h("p", { class: "bn-say" }, "Your employer does not match: the 401(k) is worth it for the tax it saves."));
  else if (k.leftBehind > 0.5) k401.append(ui.notice("warn", `You put in ${pct(k.nowPct)} of pay; the match runs to ${pct(k.fullPct)}. You leave ${money(k.leftBehind)} a year of your employer's money behind.`));
  else k401.append(ui.h("p", { class: "bn-say" }, `You get the whole match: ${money(k.fullMatch)} a year from your employer.`));
  if (k.nowMatchPlan > 0 && Math.abs(k.nowMatchPlan - k.nowMatch) > 1) k401.append(ui.h("p", { class: "muted small" }, `The Contributions page says your employer adds ${money(k.nowMatchPlan)} a year now.`));
  if (k.nowYearly <= 0) k401.append(ui.h("p", {}, "Nothing goes into a 401(k) now."));
  const label = { now: "what you put in now", match: "the whole match", max: `the ${d.limitsYear} limit` };
  const primaryKey = k.leftBehind > 0.5 && !k.tiersAssumed ? "match" : k.options.find((o) => o.key !== "now")?.key;
  k401.append(ui.h("ul", { class: "records" }, k.options.map((o) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${pct(o.pct)} of pay: ${label[o.key]}`), ui.h("span", { class: "rec-value" }, money(o.perCheck))),
    ui.h("div", { class: "rec-sub" }, `Puts ${money(o.perCheck)} a paycheck into the 401(k) and takes ${money(o.costPerCheck)} from take-home pay, after the tax it saves; your employer adds ${money(o.match)} a year.${o.roth > 0 ? ` ${money(o.roth)} of it goes in after tax (Roth).` : ""}`),
    o.key !== "now" && k.hasAccount ? ui.h("div", { class: "rec-foot" }, ui.button(`Use ${pct(o.pct)}`, () => use401k(o), { class: o.key === primaryKey ? null : "secondary" })) : null))));
  k401.append(ui.h("p", { class: "muted small" }, [
    `The ${d.limitsYear} limit for you is ${money(k.limit)}${k.catchUp ? `, with ${money(k.catchUp)} of catch-up for your age` : ""}. Pre-tax money skips income tax now but not Social Security or Medicare; it is taxed when you take it out.`,
    k.stateTaxed ? " Your state taxes 401(k) money anyway, so only federal tax is saved." : "",
    k.overCompLimit ? ` The match counts pay only up to ${money(k.compLimit)}.` : "",
  ].join("")));
  if (k.rothCatchUp) k401.append(ui.notice("info", `Your pay is over ${money(k.rothCatchUpWages)}, so from 2026 the catch-up part has to go in as Roth (after tax); the final IRS rules apply in full from 2027.`));
  if (!k.hasAccount) k401.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "Add the 401(k) on Contributions")));
  root.append(k401);

  // the health savings account
  if (d.hsa) {
    const h = d.hsa;
    root.append(ui.card("Health savings account", capped(h.typed, h.elect, "the health savings account"), ui.row(
      ui.stat("You can put in", money(h.room), `a year: the ${h.coverage === "family" ? "family" : "self-only"} limit ${money(h.limit)} less ${money(h.employer)} from your employer`),
      h.elect > 0 ? ui.stat("Tax saved", money(h.saved), `on the ${money(h.elect)} you chose; ${money(h.maxSaved)} if you fill it`) : ui.stat("Tax saved if you fill it", money(h.maxSaved), "a year"),
    ), ui.h("p", { class: "muted small" }, `Through the paycheck it skips income tax and Social Security and Medicare${h.stateTaxed ? "; your state still taxes it" : ""}. Unused money stays yours and can be invested.`),
    ui.row(ui.button("Use these on the HSA page", () => { pending = "Saved on the HSA and FSA page."; store.update((p) => { p.taxes = p.taxes ?? {}; p.taxes.hsa = { ...(p.taxes.hsa ?? {}), coverage: h.coverage, contribution: h.elect, employer: h.employer, fsa: d.fsa.elect }; }); })),
    d.planYear > d.year ? ui.h("p", { class: "muted small" }, `The HSA and FSA page shows ${d.year}, so until January it checks these against ${d.year}'s limits.`) : null));
  }

  // FSAs and commuting
  const f = d.fsa, dc = d.dependentCare, c = d.commuter;
  const commuteYear = (c.transit + c.parking) * 12;
  root.append(ui.card("Spending accounts and commuting",
    capped(f.typed, f.elect, "the health flexible spending account"), capped(dc.typed, dc.elect, "the child care account"),
    capped((c.typed.transit + c.typed.parking) * 12, commuteYear, "transit and parking a year"),
    ui.h("ul", { class: "bn-lines" },
      ui.h("li", {}, ui.h("span", {}, f.elect ? `Health flexible spending account (FSA): ${money(f.elect)}` : `Health flexible spending account (FSA), up to ${money(f.limit)}`), ui.h("span", {}, f.elect ? `saves ${money(f.saved)}` : "none chosen")),
      dc.kids.length || dc.elect ? ui.h("li", {}, ui.h("span", {}, dc.elect ? `Child care FSA: ${money(dc.elect)}` : `Child care FSA, up to ${money(dc.limit)}`), ui.h("span", {}, dc.elect ? `saves ${money(dc.saved)}` : "none chosen")) : null,
      ui.h("li", {}, ui.h("span", {}, commuteYear ? `Transit and parking: ${money(commuteYear)} a year` : "Transit and parking"), ui.h("span", {}, commuteYear ? `saves ${money(c.saved)}` : "none chosen"))),
    ui.h("p", { class: "muted small" }, [
      `A health FSA is use-it-or-lose-it: set aside only what you are sure to spend (some plans let ${money(f.carryover)} carry over).`,
      f.withHsa ? " With a health savings account, it has to be the limited-purpose kind (dental and vision only)." : "",
      dc.kids.length ? ` The child care account pays day care, after-school care and summer day camp for ${dc.kids.join(" and ")} while under 13; ${money(dc.limit)} a year is the whole household's limit${dc.others ? ` (${money(dc.others)} already chosen by others in the household)` : ""}, and your employer must offer it.` : "",
      ` Transit passes and parking at work can each be paid before tax, up to ${money(c.limit)} a month.`,
    ].join(""))));

  // the stock purchase plan
  if (d.espp) {
    const e = d.espp;
    root.append(ui.card("Employee stock purchase plan", ui.row(
      ui.stat("Put in a year", money(e.yearly), `${pct(e.pct)} of pay, ${money(e.perCheck)} a paycheck${e.capped ? "; capped: the law lets you buy at most $25,000 of stock a year" : ""}`),
      ui.stat("Gain if sold at once", money(e.afterTax), `after tax: ${pct(e.discount, 0)} off is ${pct(1 / (1 - e.discount) - 1)} on the money`),
    ), ui.h("p", { class: "muted small" }, `${e.lookback ? "With a look-back, the price is the discount off the lower of the start and end prices, so the gain can be larger. " : ""}Selling the shares as soon as they are bought keeps the discount without betting on your employer, whose stock already rides with your pay. The discount is taxed as pay.`),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/career/equity" }, "Equity compensation"), ui.h("a", { class: "btn secondary", href: "#/investments/employer-stock" }, "Employer stock"))));
  }

  // life cover through work
  if (d.life) root.append(ui.card("Life insurance through work", ui.h("p", {}, `Cover above ${money(50000)} counts as pay: ${money(d.life.imputed)} a year on ${money(d.life.cover)} of cover at ${d.life.ageKnown ? "your age" : "age 40 (add a birth date on People)"}, about ${money(d.life.tax)} in tax.`),
    ui.h("p", { class: "muted small" }, "Usually still cheap cover, but it ends when the job does. How much the family needs is on Life insurance needs."),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/life-needs" }, "Life insurance needs"))));

  // the paycheck in sum
  root.append(d.total.any ? ui.card("Each paycheck", ui.row(
    ui.stat("Taken from each paycheck", money(d.total.perCheck), `after the tax the choices save; ${d.paychecks} paychecks a year`),
    ui.stat("Tax saved a year", money(d.total.savedYearly), `on ${money(d.total.pretaxYearly)} put in before tax`),
  ), ui.h("p", { class: "muted small" }, `Your 401(k) as it is now, plus the health, child care${d.espp ? ", commuting and stock plan" : " and commuting"} choices set below.`))
    : ui.card("Each paycheck", ui.h("p", {}, "Nothing comes out of your pay before tax yet: choose a 401(k) percentage above, and set the health and commuting choices below.")));

  // the employer's plan and the choices, in folds
  const s = d.settings;
  const tiers = k.tiers.length ? k.tiers : [];
  const statusMatch = k.tiersAssumed ? "assumed: 50% up to 6%" : !tiers.length ? "no match" : `${pct(tiers[0].rate, 0)} up to ${pct(tiers[0].upTo)}${tiers[1] ? ", then more" : ""}`;
  root.append(fold("match", "Your employer's match", statusMatch, [
    { key: "rate1", label: "For each dollar you put in, they add", type: "percent", min: 0, max: 300, help: "50 means 50 cents a dollar; 0 if there is no match" },
    { key: "upTo1", label: "On what you put in up to", type: "percent", min: 0, max: 100, help: "a share of pay; 6 means the first 6%" },
    { key: "rate2", label: "Then they add (a second step, if any)", type: "percent", min: 0, max: 300 },
    { key: "upTo2", label: "On what you put in up to", type: "percent", min: 0, max: 100, help: "the share of pay where the second step stops" },
    { key: "paychecks", label: "Paychecks a year", type: "number", min: 1, max: 52, step: "1" },
    { key: "planYear", label: "Choosing for the year", type: "select", options: [d.year, d.year + 1].map((y) => ({ value: String(y), label: String(y) })) },
  ], { rate1: k.tiersAssumed ? DEFAULT_TIERS[0].rate : tiers[0]?.rate ?? 0, upTo1: k.tiersAssumed ? DEFAULT_TIERS[0].upTo : tiers[0]?.upTo ?? 0, rate2: tiers[1]?.rate ?? null, upTo2: tiers[1]?.upTo ?? null, paychecks: d.paychecks, planYear: String(d.planYear) }, (v, w) => {
    w.matchTiers = [{ rate: v.rate1 ?? 0, upTo: v.upTo1 ?? 0 }, ...(v.upTo2 ? [{ rate: v.rate2 ?? 0, upTo: v.upTo2 }] : [])];
    w.paychecks = v.paychecks; w.planYear = Number(v.planYear) || null;
  }));
  root.append(fold("health", "Health accounts", d.hsa ? `HSA ${money(d.hsa.elect)} a year` : "no HSA", [
    { key: "hsaEligible", label: "My health plan comes with a health savings account (HSA)", type: "checkbox", help: "a high-deductible plan; from 2026 also bronze and catastrophic marketplace plans" },
    { key: "hsaCoverage", label: "HSA coverage", type: "select", options: [{ value: "self", label: "Just me" }, { value: "family", label: "Me and family" }] },
    { key: "hsaEmployer", label: "Employer puts in a year", type: "money", min: 0 },
    { key: "hsaElect", label: "I put in a year", type: "money", min: 0 },
    { key: "fsaElect", label: "Health FSA a year", type: "money", min: 0 },
    { key: "dcfsaElect", label: "Child care FSA a year", type: "money", min: 0 },
  ], { hsaEligible: !!d.hsa, hsaCoverage: d.hsa?.coverage ?? "self", hsaEmployer: d.hsa?.employer ?? null, hsaElect: d.hsa ? d.hsa.typed : null, fsaElect: f.typed || null, dcfsaElect: dc.typed || null }, (v, w) => Object.assign(w, v)));
  root.append(fold("commute", "Commuting", commuteYear ? `${money(commuteYear)} a year` : "none", [
    { key: "transitMonthly", label: "Transit pass a month", type: "money", min: 0 },
    { key: "parkingMonthly", label: "Parking at work a month", type: "money", min: 0 },
  ], { transitMonthly: c.typed.transit || null, parkingMonthly: c.typed.parking || null }, (v, w) => Object.assign(w, v)));
  root.append(fold("espp", "Stock purchase plan", d.espp ? `${pct(d.espp.pct)} of pay` : "not offered", [
    { key: "esppOffered", label: "My employer offers a stock purchase plan", type: "checkbox" },
    { key: "esppPct", label: "Share of pay I put in", type: "percent", min: 0, max: 50 },
    { key: "esppDiscount", label: "Discount", type: "percent", min: 0, max: 15, help: "usually 15; the law allows at most 15" },
    { key: "esppLookback", label: "The price looks back to the start of the period", type: "checkbox" },
  ], { esppOffered: !!d.espp, esppPct: d.espp?.pct ?? null, esppDiscount: d.espp?.discount ?? 0.15, esppLookback: d.espp?.lookback ?? true }, (v, w) => Object.assign(w, v)));
  root.append(fold("life", "Life cover through work", d.life ? money(d.life.cover) : "none above $50,000", [
    { key: "lifeCover", label: "Life cover through work", type: "money", min: 0, help: "often one or two times pay" },
    { key: "lifePaid", label: "What you pay for it a year", type: "money", min: 0 },
  ], { lifeCover: s.lifeCover ?? null, lifePaid: s.lifePaid ?? null }, (v, w) => Object.assign(w, v)));
  if (d.people.length > 1) root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Whose benefits"), ui.h("span", { class: "fold-status" }, d.person.name), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([{ key: "personId", label: "Whose benefits", type: "select", options: d.people.map((p) => ({ value: p.id, label: p.name || "Someone" })) }], { personId: pid }, (v) => { pending = "Saved."; store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.benefits = { ...(p.whatIfs.benefits ?? {}), personId: v.personId }; }); }, { submitLabel: "Show" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/health" }, "Pick a health plan"), ui.h("a", { class: "btn secondary", href: "#/insurance/disability" }, "Disability cover"), ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "Contributions"))));

  function fold(key, title, status, fields, values, apply) {
    return ui.h("details", { class: "card fold fold-card", open: openFold === key || null }, ui.h("summary", {}, ui.h("h2", {}, title), ui.h("span", { class: "fold-status" }, status), ui.h("span", { class: "fold-chev" }, "›")),
      ui.form(fields, values, (v) => { openFold = key; save("Saved.", (w) => apply(v, w)); }, { submitLabel: "Save" }));
  }
  function use401k(o) {
    pending = `Your 401(k) is now ${pct(o.pct)} of pay on the Contributions page${k.tiersAssumed ? "; the employer match there is left as it was" : ""}.`;
    store.update((p) => {
      const accounts = p.accounts ?? [];
      const list = (p.retirement?.contributions ?? []).filter((x) => x.personId === pid && accounts.find((a) => a.id === x.accountId)?.type === "401k");
      if (!list.length) return;
      // each contribution keeps its share of the total (all of it on the first when nothing goes in yet); the match only when it is the employer's own
      const now = list.reduce((t, x) => t + perYear(x.amount, x.period), 0);
      list.forEach((x, i) => {
        const share = now > 0 ? perYear(x.amount, x.period) / now : i === 0 ? 1 : 0;
        x.amount = Math.round(o.yearly * share / (perYear(1, x.period) || d.paychecks) * 100) / 100;
        if (!k.tiersAssumed) x.employerMatch = Math.round(o.match * share);
      });
    });
  }
}
