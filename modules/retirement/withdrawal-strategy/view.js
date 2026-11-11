// modules/retirement/withdrawal-strategy/view.js -- DOM only. The answer first (how much to take out this year, or in the first
// year of retirement, and what it pays for), then each way of deciding as one line with what it lets you spend and one button,
// and everything technical folded under "How this is worked out" (round 8, Batch 5b: the owner, 2026-11-06, "Just make sure a
// layman can easily understand and use the page").
import { compute, firstYear, DESCRIPTIONS } from "./compute.js";
import { ssNotice } from "../ss-notice.js";
import { whenCareful, monthlyOf, accountName as acct, chanceWords, BAD_RUN, BAD_RUN_NOTE } from "../careful.js";
// a figure typed for the plan is saved the way Retirement settings saves it (Get started's own figure stops being ours)
import { saveSpendingFigure } from "../projection/compute.js";

let pending = null;

/** "a", "a and b", "a, b and c" */
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** "One. Two." -> ["One.", "Two."] */
const sentences = (t) => String(t).split(/(?<=\.) (?=[A-Z])/);

// "a bad stretch like the 1970s", not a single year (money review UX 9: 1973 read as a date to look up)
const decade = (yr) => `the ${Math.floor(Number(yr) / 10) * 10}s`;
export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  { const ss = ssNotice(ctx); if (ss) root.append(ss); }   // no Social Security in the plan: say so first (ss-notice.js)
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How much to take out each year"), ui.h("p", { class: "lede" }, "How much to take from savings each year in retirement, and what that lets you spend. It needs the answers from Will the money last? first."), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?"))));
    return;
  }
  // the plan's end age, for wording only: a run that fails in the last year has lasted to the end
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const endAge = Math.max(...adults.map((p) => Number(p.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95)), 0) || Number(plan.assumptions?.planEndAge ?? 95);
  const lasts = (x) => (x.success || x.failAge >= endAge ? `lasts to ${endAge}` : `runs out at ${x.failAge}`);
  const thisYear = Number(String(today).slice(0, 4));
  const yearOf = (r) => (r.first?.year === thisYear ? "this year" : `in ${r.first?.year}`);
  // the answer is worked on the plan's own way; a way the safety net holds is answered on the same spending every year
  const fy = firstYear(d.chosenHeld ? { ...plan, retirement: { ...(plan.retirement ?? {}), strategy: "fixed-real" } } : plan, { today });
  const KIND = { cash: "your cash savings", taxable: "your investment account", deferred: "your 401(k) or IRA", free: "your Roth" };
  const from = (b) => (b.accounts.length ? list(b.accounts.map(acct)) : KIND[b.bucket]);
  const onTop = fy?.healthAdded ? " on top of health insurance" : "";

  // ---- the answer: one or two plain sentences with the real figures ----------------------------------------------------------
  const answer = (() => {
    if (!fy) return null;
    const when = fy.thisYear ? "This year" : `In ${fy.year}, your first year of retirement`;
    const dollars = fy.thisYear ? "" : " Amounts are in today's dollars.";
    const src = list(fy.sources.map((x) => (x === "other income" ? "other income" : x)));
    const yourIncome = `your ${money(fy.income)} of ${src}`;
    const spendParts = (withTax) => list([`the ${money(fy.spending)} you ${fy.thisYear ? "spend" : "plan to spend"}`, ...(fy.health >= 0.5 ? [`${money(fy.health)} of health insurance`] : []), ...(fy.other >= 0.5 ? [`${money(fy.other)} of one-time costs`] : []), ...(withTax && fy.taxes >= 0.5 ? [`about ${money(fy.taxes)} of tax`] : [])]);
    const out = [];
    if (fy.need < 0.5 && fy.fromSavings < 0.5) {
      out.push(`${when}, nothing needs to come out of savings.`);
      out.push(`${cap(yourIncome)} pays for ${spendParts(true)}.`);
    } else if (fy.need < 0.5) {
      // only the law's minimum comes out: say which account, and that income already pays for the year
      const dfr = fy.buckets.find((b) => b.bucket === "deferred");
      out.push(`${when}, take about ${money(fy.required)} from ${dfr ? from(dfr) : KIND.deferred}: the law requires it.`);
      out.push(`${cap(yourIncome)} already pays for ${spendParts(false)}.`);
      const back = (plan.accounts ?? []).filter((a) => a.type === "brokerage" && (Number(a.balance) || 0) > 0).map((a) => a.name);
      const into = back.length ? list(back) : "a savings or investment account";
      out.push({ small: fy.requiredTax >= 0.5 ? `About ${money(fy.required - fy.requiredTax)} of it is left after tax: it can go into ${into}.` : `You do not need it to live on: it can go into ${into}.` });
    } else if (fy.short >= 0.5) {
      // savings run out that year: how much of the year's need they cover (round 8 review UX 1)
      const [a, b2] = fy.buckets;
      out.push(a ? `${when}, savings have only about ${money(fy.fromSavings)} left to take, from ${from(a)}${b2 ? ` and ${from(b2)}` : ""}.` : `${when}, savings are already used up.`);
      out.push(`${fy.income >= 0.5 ? `With ${yourIncome}, that` : "That"} covers about ${money(fy.fromSavings + fy.income)} of the ${money(fy.spending + fy.health + fy.other + fy.taxes)} the year needs: ${spendParts(true)}.`);
      if (dollars) out.push({ small: dollars.trim() });
    } else {
      // the amount first, in a short sentence; where it comes from on a small line under what it pays for
      const [a, b2, c3] = fy.buckets;
      out.push(a ? `${when}, take about ${money(fy.fromSavings)} from savings.` : `${when}, about ${money(fy.fromSavings)} would have to come from savings, and there is none left to take it from.`);
      out.push(`${fy.income >= 0.5 ? `With ${yourIncome}, that` : "That"} pays for ${spendParts(true)}.`);
      // a required withdrawal comes out of the pre-tax account first, by law: say so, and where the rest comes from (verify R2:
      // the widow on "A share of what is left" read "Take it from Checking first", which would leave her $16,078 short of the law)
      const dfr = fy.required >= 0.5 ? fy.buckets.find((b) => b.bucket === "deferred") : null;
      // the rest in the engine's order (the required amount first, then cash, investments, more pre-tax money, the Roth)
      const rest = dfr ? fy.buckets.filter((b) => b.bucket !== "deferred" || b.amount > fy.required + 0.5) : [];
      const restWords = rest.length === 1 && rest[0] === dfr ? " The rest comes from there too." : rest.length ? ` The rest from ${rest.map((b, i) => (b === dfr && i > 0 ? `more from ${from(b)}` : from(b))).join(", then ")}.` : "";
      if (dfr) out.push({ small: `About ${money(fy.required)} of it must come from ${from(dfr)}: the law requires it.${restWords}${dollars}` });
      else if (a) out.push({ small: `Take it from ${from(a)} first${b2 ? `, then ${from(b2)}` : ""}${c3 ? `, then ${from(c3)}` : ""}.${dollars}` });
    }
    return out;
  })();

  // the spending that lasts even in a bad run of years (Monte Carlo's careful figure), filled in after the first paint; the average-market
  // figure until then, and when it cannot be worked out (not with a held way: it is worked on the plan's own way)
  const averageWords = fy ? `You could spend up to about ${money(Math.round(fy.affordable / 100) * 100)} a year${onTop} if markets do as well as average.` : "";
  const carefulWords = (mo) => [`You could spend up to about `, mo, ` a month${onTop} and the money lasts ${BAD_RUN} ${BAD_RUN_NOTE}.${d.spendingYearly > 0 ? ` You plan ${money(d.spendingYearly / 12)} a month.` : ""}`];   // the plan's own figure beside it, so "yours" below is not a surprise (money review UX 9)
  // under what the plan spends: say so, with how often the plan's own figure lasts, in the words Will the money last? uses (UX 7)
  // two short lines, not one of four on a phone: the figure that lasts, then how often the plan's own figure does
  const underWords = (mo) => [`To last ${BAD_RUN}, spend up to about `, mo, ` a month${onTop}.`];
  const underChance = (share) => `At your ${money(d.spendingYearly / 12)}, the money lasts ${chanceWords(share)}.`;
  const careLine2 = ui.h("p");
  const slot = (like) => ui.h("span", { "aria-hidden": "true", style: { display: "inline-block", width: `${String(like).length * 0.55}em`, height: "0.8em", borderRadius: "4px", background: "var(--line-2)", verticalAlign: "-0.05em" } });
  const chosenRow = d.rows.find((r) => r.key === d.chosen);
  const endAt = (x) => (x && !(x.success || x.failAge >= endAge) ? x.failAge : null);
  // the plan's own way, when it moves with markets: what it spends this year and how low it goes in a bad stretch (UX 5: the page
  // said "the same every year" and "lasts in 9 of 10" about a way that is neither)
  const movingWords = (r) => {
    const f = r.first, w = r.worst, e = r.expected;
    if (!f) return null;
    const now = `This way spends about ${money(f.spend / 12)} a month ${yearOf(r)}`;
    if (endAt(e)) return `${now}, and runs out at ${endAt(e)} even if markets do as well as average.`;
    if (w && endAt(w)) return `${now}; in a bad stretch like ${decade(d.worstStartYear)} it runs out at ${endAt(w)}.`;
    if (w && w.lowest < e.lowest) return `${now}; in a bad stretch like ${decade(d.worstStartYear)} it falls to about ${money(w.lowest / 12)}.`;
    return `${now}; at the lowest, about ${money(e.lowest / 12)} if markets do as well as average.`;
  };
  // the advice has its button (UX 6): "Plan on $4,600 a month" writes Retirement settings' spending figure
  const planOn = ui.h("div");
  let careLine = null;
  if (fy) {
    if (fy.verdict === "short") careLine = ui.h("p", {}, `At this spending the money runs out${fy.shortAge ? ` at ${fy.shortAge}` : ""}. Will the money last? shows what would fix it.`);
    else if (d.chosenHeld) careLine = ui.h("p", {}, averageWords);
    else if (d.chosen !== "fixed-real" && chosenRow) careLine = ui.h("p", {}, movingWords(chosenRow));
    else {
      careLine = ui.h("p", { style: { color: "var(--muted)" } }, ...carefulWords(slot(money((fy.affordable * 0.8) / 12))));
      whenCareful(ctx, careLine, (c) => {
        careLine.style.color = "";
        if (!c || !(c.yearly > 0)) { careLine.replaceChildren(averageWords); return; }
        const monthly = Math.round(monthlyOf(c.yearly) / 10) * 10, mo = money(monthly);
        const under = c.yearly < d.spendingYearly - 0.5 && Number.isFinite(c.planned);
        // held at the placeholder's height only when nothing comes below it: under the plan a line and a button follow, the hero
        // grows anyway, and the held height left a blank line on the first screen (the couple, Kim: 27 px at 390 px)
        if (!under) careLine.style.minHeight = `${careLine.offsetHeight}px`;
        careLine.replaceChildren(...(under ? underWords(mo) : carefulWords(mo)));
        if (under) careLine2.replaceChildren(underChance(c.planned));
        if (Number.isFinite(c.planned)) which.replaceChildren(c.planned >= 0.9 ? `Yours already lasts ${BAD_RUN}. The others move what you spend up and down with the stock market.` : `To make yours safer, spend a little less${under && monthly >= 100 ? " (the button above)" : ""}, or let spending trim after bad years.`);
        if (under && monthly >= 100) planOn.replaceChildren(ui.row(ui.button(`Plan on ${mo} a month`, () => {
          pending = `Your plan now spends ${mo} a month${onTop} (it was ${money(d.spendingYearly / 12)}). It lasts ${BAD_RUN}.`;
          store.update((p) => saveSpendingFigure(p, monthly, d.figureMonthly));
        }, { class: "secondary" })));
      });
    }
  }
  if (fy?.verdict === "short") planOn.replaceChildren(ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?")));
  // the line before the ways that answers "which one?" (UX 6): filled with the careful figure on the same spending every year
  const which = ui.h("p", { class: "small" }, d.chosen !== "fixed-real" && !d.chosenHeld ? `Yours moves with markets; "${DESCRIPTIONS["fixed-real"].name}" keeps it steady.` : "");

  // ---- the safety net: a way the guard holds, already chosen ------------------------------------------------------------------
  if (d.chosenHeld && chosenRow) root.append(ui.notice("warn", `Your plan uses "${chosenRow.name}", which on your plan would leave some of your income unspent in ${chosenRow.under?.year ?? "some years"}. The answer below is for the ${money(d.spendingYearly)} you plan to spend; to plan on it, choose "${DESCRIPTIONS["fixed-real"].name}".`));

  const [s1, ...rest] = answer ?? [];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How much to take out each year"),
    s1 ? ui.h("p", { class: "lede" }, s1) : ui.h("p", { class: "lede" }, "How much to take from savings each year in retirement, and what that lets you spend."),
    // small lines in the normal text colour: grey on the hero's tint was under 4.5:1 (UX 17)
    ...rest.map((t) => (typeof t === "string" ? ui.h("p", {}, t) : ui.h("p", { class: "small" }, t.small))),
    careLine,
    careLine2,
    planOn,
    answer && fy.required >= 0.5 ? ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/rmd" }, "This year's required withdrawal")) : null,
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);

  // ---- the ways: one line each, what it lets you spend a month in the first year, one button --------------------------------
  const perMonth = (r) => `about ${money(r.first ? r.first.spend / 12 : r.expected.firstYear / 12)} a month`;
  const planned = d.spendingYearly;
  // each way's risk on the worse of the two runs, the bad stretch of history named (UX 1: "Lasts to 95" sat under "lasts in about 4
  // of 10", from average markets only)
  const lineOf = (r) => {
    const f = r.first;
    // guardrails spend all of an income that pays for more than the plan (nothing is drawn, nothing is cut); with no income there
    // is nothing for a way to come "on top of"
    let short = r.key === "guardrails" && f && f.spend > planned + 0.5 && f.need < 0.5 ? "all your income after tax, which is more than you plan to spend; it is cut back only if savings have to help" : r.short;
    if (f && f.income < 0.5) short = short.replace(", on top of your income", "").replace(" on top of your income", "");
    const w = r.worst, e = r.expected, y = d.worstStartYear;
    let risk;
    if (endAt(e)) risk = `Runs out at ${endAt(e)} even if markets do as well as average.`;
    else if (w && endAt(w)) risk = `In a bad stretch like ${decade(y)} it runs out at ${endAt(w)}.`;
    else if (r.key !== "fixed-real" && f && Math.min(e.lowest, w?.lowest ?? Infinity) < f.spend * 0.9) risk = w && w.lowest <= e.lowest ? `In a bad stretch like ${decade(y)} it falls to about ${money(w.lowest / 12)} a month.` : `It can fall to about ${money(e.lowest / 12)} a month.`;
    else risk = w ? `Lasts to ${endAge}, even in a bad stretch like ${decade(y)}.` : `${cap(lasts(e))}.`;
    return `${cap(short)}. ${risk}`;
  };
  // the confirmation says what the plan now spends, and how it moves (UX 5: "Your plan now uses ..." hid that spending doubled)
  const wasMo = chosenRow?.first ? money(chosenRow.first.spend / 12) : null;
  const useWords = (r) => {
    const f = r.first, mo = money((f ? f.spend : r.expected.firstYear) / 12), when = f ? yearOf(r) : "in the first year";
    // "(it was $3,300)" only when the figure moved: a way that starts at the same figure says so
    const was = !wasMo ? "" : wasMo === mo ? ", as before" : ` (it was ${wasMo})`;
    if (r.key === "fixed-real") return `Your plan now spends the same every year: about ${mo} a month ${when}, raised with prices.`;
    if (r.key === "guardrails") return `Your plan now trims spending by a tenth after bad years: about ${mo} a month ${when}${was}, about ${money(r.expected.lowest / 12)} at the lowest if markets do as well as average.`;
    const base = `Your plan now spends ${r.key === "vpw" ? "what the years left can afford" : "a share of what is left"}: about ${mo} a month ${when}${was}, rising and falling with markets.`;
    return r.key === "vpw" && r.expected.success && r.expected.endReal < 1 ? `${base} Savings are spent down to $0 by ${d.endYear} on purpose.` : base;
  };
  const shown = d.rows.filter((r) => !r.held || r.key === d.chosen);
  root.append(ui.card("How much you could spend: four ways",
    ui.h("p", { class: "muted small" }, `What each way lets you spend a month ${shown[0]?.first ? yearOf(shown[0]) : "in the first year"}${(shown[0]?.first?.income ?? 0) >= 0.5 ? ", with your income" : ""}${onTop}${shown[0]?.first?.year === thisYear ? "" : ", in today's dollars"}.`),
    which,
    ui.h("ul", { class: "records" }, shown.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name, r.key === d.chosen ? ui.h("span", { class: "pill accent" }, "yours") : null), ui.h("span", { class: "rec-value" }, perMonth(r))),
      ui.h("div", { class: "rec-sub" }, lineOf(r)),
      !r.offer ? null : ui.h("div", { class: "rec-foot" }, ui.button("Use this one", () => { pending = useWords(r); store.update((p) => { p.retirement = { ...(p.retirement ?? {}), strategy: r.key }; }); }, { class: "secondary" })))),
    ),
  ));

  // ---- How this is worked out: the rules, each way's first year in full, the ranges and the worst stretch of history -------
  const firstWords = (r) => {
    const f = r.first;
    if (!f) return null;
    const G = f.income >= 0.5;
    const lead = f.year === thisYear ? "This year" : `In ${f.year}`;
    const parts = (withTax) => list([`the ${money(f.spend)} you spend`, ...(f.health >= 0.5 ? [`${money(f.health)} of health insurance`] : []), ...(f.other >= 0.5 ? [`${money(f.other)} of one-time costs`] : []), ...(withTax && f.tax >= 0.5 ? [`about ${money(f.tax)} of tax`] : [])]);
    if (f.short >= 0.5) return `${lead}: savings have only about ${money(f.take)} left; ${G ? `with your ${money(f.income)} of income ` : ""}that covers about ${money(f.take + f.income)} of the ${money(f.spend + f.health + f.other + f.tax)} the year needs.`;
    if (f.take < 0.5) return G ? `${lead}: nothing from savings; your ${money(f.income)} of income pays for ${parts(true)}.` : `${lead}: nothing comes out of savings.`;
    const with_ = G ? `with your ${money(f.income)} of income, ` : "";
    const law = f.required >= 0.5 && f.take <= f.required + 0.5 ? " (the least the law allows)" : "";
    if (f.back >= 0.5 && f.need < 0.5 && G) return r.key === "fixed-real"
      ? `${lead}: take about ${money(f.take)} from savings${law}; your ${money(f.income)} of income already pays for ${parts(false)}, so the withdrawal, less its tax, goes back into savings.`
      : `${lead}: take about ${money(f.take)} from savings${law}; your ${money(f.income)} of income pays for ${parts(true)}, so all of the withdrawal goes back into savings.`;
    if (f.back >= 0.5) return `${lead}: take about ${money(f.take)} from savings${law}; ${with_}that pays for ${parts(true)}, and what is left of it goes back into savings.`;
    return `${lead}: take about ${money(f.take)} from savings; ${with_}that pays for ${parts(true)}.`;
  };
  const range = (x) => (Math.abs(x.highest - x.lowest) < 1 ? `spending stays at ${money(x.lowest)} a year` : `spending between ${money(x.lowest)} and ${money(x.highest)} a year`);
  const end = (x) => (x.success ? `${money(Math.max(0, x.endReal))} left at the end` : lasts(x));
  // the ways are worked on the plan's own tax setting; on the quick flat rate its tax on a required withdrawal is not the real one,
  // so it is named as such beside the real figure the hero gives (UX 9: $3,429 above, $2,412 here, with no word why)
  const flatRate = Number(plan.retirement?.taxRate ?? 0.15);
  const flatTax = (plan.retirement?.taxMode ?? "flat") !== "brackets" && fy?.requiredTax >= 0.5 && Math.abs(fy.requiredTax - fy.taxes) >= 1
    ? [`The tax in each way is the plan's flat ${fmt.pct(flatRate, 0)} on money from pre-tax accounts (Retirement settings).`, `This year's required withdrawal really adds about ${money(fy.requiredTax)}: Required withdrawals works it out.`] : null;
  const heldWords = (r) => (r.held ? `Not offered: on your plan it would leave some of your ${money(r.under?.income ?? 0)} of income unspent in ${r.under?.year}.` : null);
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How this is worked out"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "small" }, `Each way runs on your plan with the returns you assume, and through the worst stretch of history for a plan like yours. Yearly amounts, in today's dollars.`),
      ui.h("ul", { class: "records" }, d.rows.map((r) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name)),
        // one short line per sentence or clause: no block over three lines on a phone
        ...sentences(r.how).map((t) => ui.h("div", { class: "rec-sub" }, t)),
        ...(firstWords(r) ? firstWords(r).split("; ").map((t, i, a) => ui.h("div", { class: "rec-sub" }, `${cap(t)}${i < a.length - 1 ? "." : ""}`)) : []),
        ui.h("div", { class: "rec-sub" }, `With your assumptions: ${range(r.expected)}; ${end(r.expected)}.`),
        r.worst ? ui.h("div", { class: "rec-sub" }, `From ${d.worstStartYear}, the worst stretch: ${range(r.worst)}; ${end(r.worst)}.`) : null,
        heldWords(r) ? ui.h("div", { class: "rec-sub" }, heldWords(r)) : null,
        ui.h("div", { class: "rec-sub muted" }, `Where it comes from: ${r.from}`)))),
      ...(flatTax ?? []).map((t) => ui.h("p", { class: "small" }, t)),
      ui.h("p", { class: "small" }, `"${DESCRIPTIONS.percent.name}" and "${DESCRIPTIONS.guardrails.name}" start from ${fmt.pct(d.withdrawalRate, 1)} of savings (set on the Will the money last? page, under Retirement settings).`),
    )));
}
