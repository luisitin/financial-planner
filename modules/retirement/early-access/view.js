// modules/retirement/early-access/view.js -- DOM only. Money before 59½ (gap design #38, 2026-11-14).
// The answer first: what the plan takes out of a 401(k) or IRA before 59½ and what the extra 10% tax on it comes to, one
// sentence per case (compute answerWords). Then three ways around it as three rows, each saying where this household stands.
// One tap away: "Set my own numbers" counts equal yearly payments in the plan (chips; each tap saves and says the new answer),
// and "How this is worked out" has the years, the sums and the sources.
import { part, parts, choice, links } from "../../../core/ui/more.js";
import { needButtons } from "../needs.js";
import { compute, answerWords, at55Words, equalWords, ruleWords, methodWords, yearlyCheckWords, notOfferedWords, tooSoonWords, savedWords, setSepp, clearSepp, RATE_CHIPS, METHOD_CHIPS, SEPP_RATE_MAX } from "./compute.js";
import { NameIn, isYou, nameIn, verbFor } from "../../../core/words.js";

// The shell draws the page again after store.update, so what a save has to say waits here for that drawing.
let pending = null;   // { part, at (the box just tapped: the green line goes right under it), before: { tax } }

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const h = ui.h;
  const cur = plan.meta?.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const money = (n) => fmt.money(Math.round(n), cur);
  const w = answerWords(d, money);
  const said = pending; pending = null;

  // ---- the answer ---------------------------------------------------------------------------------------------------------
  const canSet = d.accounts.length > 0 && d.people.length > 0;
  const hero = h("section", { class: "card accent hero" }, h("h1", {}, w.head), h("p", { class: "lede" }, w.lede),
    w.also.length ? h("p", { class: "small" }, w.also.join(" ")) : null);
  if (d.kind === "unknown") hero.append(needButtons(ui, d.missing) ?? ui.row(h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last? ›")));
  else if (d.kind === "none") hero.append(ui.row(h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Add it on Net worth ›")));
  // the one filled button: the way this page itself can take the 10% away, opened where it is; once equal payments are
  // counted, the way on is the page whose answer they changed
  else if (d.kind === "charged" || d.sepp) hero.append(ui.row(
    d.sepp ? h("a", { class: "btn", href: "#/retirement/projection" }, "See Will the money last? ›") : canSet ? h("a", { class: "btn", href: "#/retirement/early-access?show=equal" }, "Count equal payments") : null,
    d.kind === "charged" ? h("a", { class: "btn secondary", href: "#/household/people" }, "Change when work stops ›") : null));
  root.append(hero);
  if (d.kind === "unknown" || d.kind === "none" || (d.kind === "past" && !d.sepp)) return;

  // ---- three ways around it -----------------------------------------------------------------------------------------------
  const way = (title, sub) => h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, title)), h("div", { class: "rec-sub" }, sub));
  root.append(ui.card(d.kind === "charged" ? "Three ways around it" : "Three ways to take money out early",
    h("ul", { class: "records" },
      way("Leave your job in or after the year you turn 55", at55Words(d, money)),
      way("Move some to a Roth account each year", "You pay income tax on what you move. Five years later that amount comes out with no extra tax. The plan does not count this yet."),
      way("Equal yearly payments from one account", equalWords(d, money)))));

  // ---- Set my own numbers: equal yearly payments, counted in the plan -------------------------------------------------------
  const field = (label, node, help) => h("div", { class: "field", dataset: { noKeep: "" } }, h("span", { class: "field-label" }, label), node, help ? h("small", { class: "help" }, help) : null);
  const save = (at, change) => { pending = { part: "equal", at, before: { tax: d.tax } }; store.update(change); };
  // the green line sits right under the box just tapped, where the eye is (said once: at the top of the part it was above the
  // screen on a small phone, and the shell said it a second time over the chips); with it, the way on
  const savedLine = (at) => (said?.part === "equal" && said.at === at ? ui.notice("ok", [savedWords(said.before, d, money), " ", h("a", { href: "#/retirement/projection" }, "See Will the money last? ›")]) : null);
  // the first year an account can pay them: an IRA this year, a 401(k) once its owner has left the job (compute `firstStart`);
  // the plan's first year is when work stops, never before that and never after the last year before 59½
  const stopYear = Math.max(d.year, d.retireYear);
  const startFor = (a) => Math.min(a.lastStart, Math.max(a.firstStart, d.retireYear));
  const fits = (a, y) => y <= a.lastStart && Math.max(y, d.year) >= a.firstStart;
  const cur0 = d.sepp ? { accountId: d.sepp.accountId, startYear: d.sepp.startYear, method: d.sepp.method, rate: d.sepp.rate, yearly: d.sepp.yearly } : null;
  const acct = d.sepp ? d.accounts.find((a) => a.id === d.sepp.accountId) ?? null : null;
  // the account that pays them stays a chip even when it is no longer offered (a series running past 59½, or a 401(k) whose
  // owner now works until past it), so the chip on is its name, never "Yours: <id>"
  const acctChips = d.sepp && !acct ? [...d.accounts, { id: d.sepp.accountId, name: d.sepp.name, balance: d.sepp.balance }] : d.accounts;
  const yearLabel = (y) => (y === d.year ? `This year, ${y}`
    : acct?.type === "401k" && y === acct.firstStart && y !== stopYear ? `When ${nameIn(acct.ownerName)} ${verbFor(acct.ownerName, "stops", "stop")} work, ${y}`
    : y === stopYear ? `When work stops, ${y}` : `In ${y}, the last year before 59½`);
  const equalBody = () => {
    const out = [d.sepp ? null : h("p", { class: "small" }, "A set amount comes out of one 401(k) or IRA every year. It is taxed as income, with no extra 10%. A 401(k) can pay them only once its owner has left the job it comes with. A tax preparer knows these as 72(t) payments, after the tax code's section.")];
    if (!acctChips.length) { out.push(h("p", { class: "small" }, notOfferedWords(d) ?? "They need a 401(k) or IRA whose owner is under 59½, and none is on file.")); return out; }
    out.push(field("Which account pays them", choice(ctx, { id: "equalAccount", label: "Which account pays them", value: d.sepp?.accountId ?? "none",
      presets: [{ value: "none", label: "Not counted" }, ...acctChips.map((a) => ({ value: a.id, label: `${a.name}, ${money(a.balance)}` }))],
      onPick: (v) => save("equalAccount", (p) => { if (v === "none") clearSepp(p); else { const a = d.accounts.find((x) => x.id === v); setSepp(p, { ...(cur0 ?? { method: "amortization", rate: RATE_CHIPS[2].value }), accountId: v, startYear: cur0 && fits(a, cur0.startYear) ? cur0.startYear : startFor(a), yearly: null }); } }) }),
      d.sepp ? null : "Pick one and the plan counts them. While they run, nothing else may go into or come out of that account."),
      notOfferedWords(d) ? h("p", { class: "small" }, notOfferedWords(d)) : null, savedLine("equalAccount"));
    if (!d.sepp) return out;
    const sp = d.sepp;
    out.push(h("p", {}, sp.first ? `About ${money(sp.first.yearlyReal)} a year in today's dollars, from ${sp.first.year} to ${sp.lastYear}.` : `From ${sp.startYear} to ${sp.lastYear}.`),
      h("p", { class: "small" }, ruleWords(sp)));
    // a 401(k): no year before its owner has left the job (critic P1, 2026-11-14: "This year" was offered, and counted, while
    // the same screen said a 401(k) pays them only after that)
    const firstYears = acct ? [...new Set([d.year, startFor(acct)])].filter((y) => fits(acct, y)) : [d.year];
    out.push(field("The first payment", choice(ctx, { id: "equalYear", label: "The first payment", value: sp.startYear,
      presets: firstYears.map((y) => ({ value: y, label: yearLabel(y) })),
      own: { type: "number", label: "Your own first year", name: "equalYear", min: sp.past ? sp.startYear : acct?.firstStart ?? d.year, max: acct?.lastStart ?? sp.lastYear, whole: true, show: (y) => String(y) },
      onPick: (v) => save("equalYear", (p) => setSepp(p, { ...cur0, startYear: v, yearly: null })) })),
      tooSoonWords(sp) ? ui.notice("warn", tooSoonWords(sp)) : null, savedLine("equalYear"));
    out.push(field("How the amount is set", choice(ctx, { id: "equalMethod", label: "How the amount is set", value: sp.method, presets: METHOD_CHIPS,
      onPick: (v) => save("equalMethod", (p) => setSepp(p, { ...cur0, method: v })) }), methodWords(sp, money)), savedLine("equalMethod"));
    if (sp.method !== "rmd") out.push(field("The interest rate", choice(ctx, { id: "equalRate", label: "The interest rate", value: sp.rate, presets: RATE_CHIPS,
      own: { type: "percent", label: "Your own rate", name: "equalRate", min: 0.1, max: SEPP_RATE_MAX * 100 },
      onPick: (v) => save("equalRate", (p) => setSepp(p, { ...cur0, rate: v })) }),
      sp.over5 ? "Above 5% is allowed only when a rate the IRS publishes each month is at least that high, in one of the two months before the first payment. To check, look up \"120% of the federal mid-term rate\" on the IRS's site." : "A higher rate means a bigger payment. The rule allows up to 5%, and more only in months when a rate the IRS publishes is higher."), savedLine("equalRate"));
    if (sp.past && sp.method !== "rmd") out.push(field("The amount you already take each year", choice(ctx, { id: "equalYearly", label: "The amount you already take each year", value: sp.yearly ?? "", presets: [],
      own: { type: "money", label: "Each year's payment", name: "equalYearly", min: 1, max: Math.floor(sp.balance) },   // more than the account holds is a slip: the box says so
      onPick: (v) => save("equalYearly", (p) => setSepp(p, { ...cur0, yearly: v })) }), "These payments began before this year, so the amount is already fixed: type it and the plan uses it."),
      yearlyCheckWords(sp, money) ? ui.notice("warn", yearlyCheckWords(sp, money)) : null, savedLine("equalYearly"));
    out.push(ui.row(ui.button("Stop counting them", () => save("equalAccount", (p) => clearSepp(p)), { class: "secondary" })));
    return out;
  };

  // ---- How this is worked out ---------------------------------------------------------------------------------------------
  const ages = (r) => d.people.map((p) => r.ages[p.index]).filter((x) => Number.isFinite(x));
  const yearRow = (r) => h("li", {},
    h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, `${r.year}${ages(r).length ? ` · age ${ages(r).join(" and ")}` : ""}`), h("span", { class: "rec-value" }, r.tax > 0.5 ? money(r.tax) : "no extra tax")),
    h("div", { class: "rec-sub" }, [r.charged > 0.5 ? `${money(r.charged)} taken out early, 10% of it extra tax` : null, r.spared > 0.5 ? `${money(r.spared)} from the 401(k) of a job left at 55 or later` : null, r.sepp > 0.5 ? `${money(r.sepp)} as equal payments` : null,
      !(r.charged > 0.5) && !(r.spared > 0.5) && !(r.sepp > 0.5) ? "nothing from a 401(k) or IRA" : null].filter(Boolean).join("; ")));
  const who = d.people.map((p) => `${NameIn(p.name)} ${isYou(p.name) ? "reach" : "reaches"} 59½ in ${p.halfWords ?? p.half.year}`).join("; ");
  const howBody = () => [
    h("p", { class: "small" }, "Money taken out of a 401(k) or traditional IRA before its owner is 59½ is taxed as income and owes an extra 10% on top. The plan adds that 10% to the year's tax, so every page that runs your plan counts it."),
    who ? h("p", { class: "small" }, `${who}. In that year, only the part of the year before it counts.`) : null,
    h("p", { class: "small" }, "The plan spends cash first, then accounts in your chosen order. Of what comes out of 401(k)s and IRAs, each person's share is what they own of them. A required withdrawal and equal payments never owe the 10%."),
    d.years.length ? h("p", { class: "small" }, "Year by year until 59½, in today's dollars:") : null,
    d.years.length ? h("ul", { class: "records" }, d.years.slice(0, 12).map(yearRow)) : null,
    d.years.length > 12 ? h("p", { class: "muted small" }, `...and ${d.years.length - 12} more years.`) : null,
    h("p", { class: "small" }, "Not counted: money taken from a Roth account is treated as tax-free at any age, though growth taken out before 59½ can be taxed and owe the 10%. Every 401(k) is taken to be from the job that stops at the age on People: one from a job left before the year its owner turned 55 still owes the 10%, which the plan does not charge, and one from a job already left could start equal payments sooner. Police, firefighters and some other public-safety workers can leave from 50, or after 25 years of work under the plan, and the plan does not know who they are. A government workers' 457(b) plan owes no 10% (except on money rolled into it from another plan), and a small-business SIMPLE IRA owes 25% in its first two years. Other exceptions (disability, a first home, medical bills and more) are not counted."),
    h("p", { class: "muted small" }, "Rules: the tax code's section 72(t), IRS Notice 2022-6 and the IRS pages on early withdrawals and on equal payments; life tables from IRS Publication 590-B (2025). Read at irs.gov on November 14, 2026."),
  ];
  root.append(h("div", {}, parts(ctx,
    { id: "equal", kind: "own", set: d.sepp ? true : 0, missing: !d.sepp && canSet, fix: (d.sepp?.yearlyHigh ? 1 : 0) + (d.sepp?.tooSoon ? 1 : 0), says: !canSet && !d.sepp ? "no account" : "", holds: ["equalAccount", "equalYear", "equalMethod", "equalRate", "equalYearly"], open: said?.part === "equal", body: equalBody },
    { id: "how", kind: "how", says: d.years.length ? `${d.years.length} ${d.years.length === 1 ? "year" : "years"}` : "", body: howBody })));

  // ---- More on this -------------------------------------------------------------------------------------------------------
  root.append(h("div", {}, links(ctx, [
    { href: "#/retirement/projection", ask: "Will the money last?" },
    { href: "#/retirement/withdrawal-order", ask: "Which account should pay first?" },
    { href: "#/retirement/roth-conversions", ask: "What would moving money to a Roth do?" }])));
}
