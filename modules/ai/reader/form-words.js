// modules/ai/reader/form-words.js -- PURE. The words the Document reader writes about a W-2, a 1099 or last year's return
// (gap design #23): one written sentence per case (docs/OPTIONAL.md R5), each read by a test in module.test.mjs. A sentence
// is a list of parts: its text, then the pages it sends the person to, as links { href, label } that always come last; the
// page draws each as an outlined button under the words (a whole 44 px tap, never a small link inside a sentence: design
// log 2026-09-16, review P3), so the words say "there" and never name a link in the middle. `w` gives the formatting and
// the names: { money (whole dollars), Whose ("Ana's" / "Your"), whose ("Ana's" / "your"), whoIn ("Ana" / "you"), nameOf
// (a name -> "Bo's") }.

export const LINKS = {
  contributions: { href: "#/retirement/contributions", label: "What you save for retirement ›" },
  netWorth: { href: "#/balance/net-worth", label: "Net worth ›" },
  income: { href: "#/cashflow/income", label: "Income ›" },
  federal: { href: "#/taxes/federal", label: "Federal estimate ›" },
  hsa: { href: "#/taxes/hsa-fsa", label: "HSA and FSA ›" },
  gains: { href: "#/taxes/capital-gains", label: "Capital gains ›" },
  estimated: { href: "#/taxes/estimated", label: "Estimated payments ›" },
  people: { href: "#/household/people", label: "People ›" },
};
const L = LINKS;

/** The Federal estimate's boxes a form can fill: the card's title, what the figure is, and what the page does with none. */
export const FIELD = {
  wages: { title: (y) => `Wages for ${y} on the Federal estimate`, noun: "of wages", none: "worked out from the pay on Income" },
  withheld: { title: (y) => `Federal tax taken out in ${y}`, noun: "of federal tax taken out", none: "none typed" },
  otherOrdinary: { title: (y) => `Interest and dividends in ${y}`, noun: "of interest and dividends taxed at regular rates", none: "none typed" },
  qualifiedIncome: { title: (y) => `Qualified dividends in ${y}`, noun: "of qualified dividends", none: "none typed" },
  taxExemptInterest: { title: (y) => `Tax-exempt interest in ${y}`, noun: "of tax-exempt interest", none: "none typed" },
  iraWithdrawals: { title: (y) => `IRA and 401(k) withdrawals in ${y}`, noun: "of IRA and 401(k) withdrawals that are taxed", none: "the plan's own figure (its required withdrawal and what it takes out to spend)" },
};
const held = (h) => (h === "long" ? "held more than a year" : "held a year or less");

/** What a tax-year card's figure comes from on the form. */
function sourceOf(x, w) {
  const m = w.money;
  if (x.field === "wages") return `box 1 of ${w.whose} W-2`;
  if (x.field === "withheld") return x.from === "w2" ? `box 2 of ${w.whose} W-2` : "box 4 of this 1099";
  if (x.field === "otherOrdinary") {
    const { interest = 0, dividends = 0 } = x.parts ?? {};
    return interest > 0 && dividends > 0 ? `${m(interest)} of interest and ${m(dividends)} of dividends that are not qualified`
      : interest > 0 ? `${m(interest)} of interest` : `${m(dividends)} of dividends that are not qualified`;
  }
  if (x.field === "qualifiedIncome") return "box 1b, taxed at the lower rates for gains";
  if (x.field === "iraWithdrawals") return "box 2a, the part that is taxed";
  return "this 1099";
}

/**
 * cardOf(x, w) -> { title, says, caution?, note?, choices?, was, now, saved, short }: a proposal's card. `says` is the "Now
 * ... Would be ..." sentence, `caution` an amber line (never with the filled button), `note` a quiet line, `choices` the two
 * outlined buttons of a card that would add to a typed figure ({ how: "replace" | "add", label }, the likelier first), `was`
 * / `now` what the card says once used, `saved` the green line after "Use it". The page that shows a tax figure after it is
 * used is the outlined button under the cards ("See the Federal estimate ›"), so a saved line names no page twice.
 */
export function cardOf(x, w) {
  const m = w.money;
  if (x.op === "work") {
    const title = x.side === "now" ? `${w.Whose} Roth 401(k), pay the tax now` : `${w.Whose} 401(k), pay the tax later`;
    const was = x.before?.yearly > 0 ? `${m(x.before.yearly)} a year, our guess` : "nothing goes in";
    const where = x.make === "account" ? `, into a new account, ${x.accountName}, at $0 until you type its balance on Net worth` : x.make === "row" ? `, into ${x.accountName}` : "";
    return {
      title, short: x.side === "now" ? "Roth 401(k)" : "401(k)",
      says: [`Now: ${was}. This W-2 shows ${m(x.amount)} going in for ${x.year}. Would be: ${m(x.amount)} a year${where}.`],
      ...(x.caution === "later" ? { caution: [`The plan also has ${m(x.laterYearly)} a year going in as pay the tax later, and this W-2 shows none. If that is this same money, set it to $0 there.`, L.contributions] } : {}),
      was, now: `${m(x.amount)} a year`,
      saved: [`${title}: saved, ${m(x.amount)} a year.${x.make === "account" ? ` ${x.accountName} starts at $0: type its balance on Net worth.` : ""}`, ...(x.make === "account" ? [L.netWorth] : []), L.contributions],
    };
  }
  if (x.op === "taxYear") {
    const F = FIELD[x.field], title = F.title(x.year), src = sourceOf(x, w), form = x.form ?? "form";
    const was = x.before === null || x.before === 0 ? F.none : x.guess ? `${m(x.before)}, our guess` : `${m(x.before)} typed`;
    // a typed figure: this form's figure in its place, or added to it (review M1); the likelier choice first
    const from = form === "W-2" ? "from another job or a spouse's" : "from other forms or pay";
    const says = !x.adds ? `Now: ${was}. Would be: ${m(x.amount)}, ${src}.`
      : x.near ? `Now: ${m(x.before)} typed. This ${form} shows ${m(x.amount)}. If the ${m(x.before)} was a guess at this same money, replace it; if it is other money, add this to it.`
        : `Now: ${m(x.before)} typed. This ${form} shows ${m(x.amount)}. If the ${m(x.before)} is ${from}, add this to it; if it already holds this ${form}, leave it.`;
    const replace = { how: "replace", label: `Replace it: ${m(x.amount)}` }, add = { how: "add", label: `Add it: ${m(x.after)}` };
    const other = x.others?.[0];
    const note = other && !x.adds ? `The Federal estimate keeps one figure for the household: read ${w.nameOf(other.name)} W-2 next and it adds to this.` : null;
    const caution = x.caution === "income" ? [`The Income page also counts ${m(x.incomeYearly)} a year of dividends and interest. If that is this money, using this counts it twice.`]
      : x.caution === "pension" ? [`The Income page also counts ${m(x.pensionYearly)} a year of pension. If this 1099-R is that pension, using this counts it twice.`] : null;
    return { title, short: { wages: "wages", withheld: "tax taken out", otherOrdinary: "interest", qualifiedIncome: "dividends", taxExemptInterest: "tax-exempt interest", iraWithdrawals: "withdrawals" }[x.field],
      says: [says], ...(x.adds ? { choices: x.near ? [replace, add] : [add, replace] } : {}), ...(caution ? { caution } : {}), ...(note ? { note } : {}), was, now: m(x.after),
      saved: [`Saved: ${m(x.after)} ${F.noun} for ${x.year}. The Federal estimate shows the tax with it.`] };
  }
  if (x.op === "gain") {
    const gain = x.proceeds - x.basis, word = gain >= 0 ? "gain" : "loss";
    if (x.id === "capdist") return { title: `Capital gain distributions in ${x.year}`, short: "capital gain distributions",
      says: [`Would add ${m(x.proceeds)} to the Capital gains page, taxed as a gain on something held more than a year (box 2a).`],
      was: "not on Capital gains", now: `${m(x.proceeds)} added`, saved: [`Saved: ${m(x.proceeds)} of capital gain distributions is on Capital gains.`, L.gains] };
    // a wash sale: the loss not allowed now (box 1g) goes back on, as Form 8949 does (review M5)
    const says = x.wash > 0
      ? `Would add them to the Capital gains page: ${m(x.proceeds)} sold, ${m(x.cost)} paid, ${m(x.wash)} of the loss not allowed now (a wash sale, box 1g), so a ${word} of ${m(Math.abs(gain))}.`
      : `Would add them to the Capital gains page: ${m(x.proceeds)} sold, ${m(x.basis)} paid, a ${word} of ${m(Math.abs(gain))} (boxes 1d and 1e).`;
    return { title: `Sales in ${x.year}, ${held(x.held)}`, short: x.held === "long" ? "long-term sales" : "short-term sales", says: [says],
      ...(x.caution === "discount" ? { caution: [`Box 1f shows ${m(x.discount)} of market discount on bonds: up to that much of this gain is taxed as interest, not as a gain, and this counts it all as a gain.`] } : {}),
      was: "not on Capital gains", now: x.wash > 0 ? `${m(x.proceeds)} sold, a ${word} of ${m(Math.abs(gain))}` : `${m(x.proceeds)} sold, ${m(x.basis)} paid`,
      saved: [`Saved: the ${word} of ${m(Math.abs(gain))} is on Capital gains.`, L.gains] };
  }
  if (x.op === "priorYear") {
    const list = (o) => [o.agi !== null && o.agi !== undefined ? `income before deductions (adjusted gross income) ${m(o.agi)}` : null, o.tax !== null && o.tax !== undefined ? `total tax ${m(o.tax)}` : null].filter(Boolean).join(" and ");
    return { title: `Last year's return, ${x.year}`, short: "last year's return",
      says: [`Now: ${x.before ? list(x.before) : "nothing on file"}. Would be: ${list(x.after)}. Estimated payments works out the safe amount to pay this year from them.`],
      was: x.before ? list(x.before) : "nothing on file", now: list(x.after),
      saved: [x.tax !== null ? `Saved: Estimated payments now works out the safe amount from ${x.year}'s total tax, ${m(x.tax)}.` : `Saved: Estimated payments now has ${x.year}'s adjusted gross income, ${m(x.agi)}.`] };
  }
  return { title: "", says: [], was: "", now: "", saved: [] };
}

/** checkOf(c, w) -> { title, says, short }: what a form says against the plan, with nothing to use. */
export function checkOf(c, w) {
  const m = w.money;
  // (short: the title says whose and which; review P4)
  if (c.kind === "k401" || c.kind === "roth401k") {
    const title = c.side === "now" ? `${w.Whose} Roth 401(k), pay the tax now` : `${w.Whose} 401(k), pay the tax later`;
    return { title, short: c.side === "now" ? "Roth 401(k)" : "401(k)",
      says: [`Already saved as ${m(c.onFile)} a year. This W-2 shows ${m(c.amount)} for ${c.year}, so we left yours.`, L.contributions] };
  }
  if (c.kind === "choose") return { title: `${w.Whose} 401(k), pay the tax later`, short: "401(k)",
    says: [`This W-2 shows ${m(c.amount)} going in for ${c.year}. The plan has several 401(k) accounts with no owner: say which is this job's there.`, L.contributions] };
  if (c.kind === "hsa") {
    const base = `This W-2 shows ${m(c.amount)} put into an HSA through work in ${c.year}: the employer's money and ${w.whose} own, together.`;
    return { title: "HSA money through work", short: "HSA",
      says: !(c.onFile > 0) ? [`${base} The plan has none for this year.`, L.hsa]
        : [`${base} The plan has ${m(c.onFile)} for this year: change it there if that is not what goes in now.`, L.hsa] };
  }
  if (c.kind === "pay") {
    const base = `This W-2 shows about ${m(c.amount)} of pay before tax in ${c.year}.`;
    return { title: `${w.Whose} pay`, short: "pay",
      says: !(c.onFile > 0) ? [`${base} The plan has no pay for ${w.whoIn} yet.`, L.income]
        : [`${base} The plan has ${m(c.onFile)} a year: change it there if this year's pay is different.`, L.income] };
  }
  if (c.kind === "year") return { title: `A 1099 for ${c.year}`, short: "the year",
    says: [`The Federal estimate works out ${c.planYear}, so this 1099 changes nothing there. To fill in your ${c.year} return from it, pick ${c.year} as the tax year there, then read it again.`, L.federal] };
  if (c.kind === "return") return { title: `A return for ${c.year}`, short: "the year",
    says: [`Estimated payments needs ${c.year >= c.planYear ? "the return before it" : "last year's return"}, ${c.planYear - 1}'s, for the safe amount: this one changes nothing.`] };
  if (c.kind === "cost") return { title: `Sales in ${c.year}, ${held(c.held)}`, short: "sales",
    says: [`This 1099-B shows ${m(c.proceeds)} of sales but not what they cost (box 1e), so they are not added: add them with their cost on Capital gains.`, L.gains] };
  if (c.kind === "term") return { title: `Sales in ${c.year}`, short: "sales",
    says: [`This 1099-B shows ${m(c.proceeds)} of sales and does not say how long they were held, so they are not added: add them on Capital gains.`, L.gains] };
  if (c.kind === "untaxed") return { title: `A withdrawal in ${c.year}`, short: "withdrawal",
    says: [`This 1099-R shows ${m(c.amount)} taken out and none of it taxed (box 2a is $0), so nothing changes.`] };
  if (c.kind === "taxedPart") return { title: `A withdrawal in ${c.year}`, short: "withdrawal",
    says: [`This 1099-R shows ${m(c.amount)} taken out but not the part that is taxed (box 2a): ask the payer, or type it on the Federal estimate.`, L.federal] };
  // a figure no form holds (review M7): said, never used
  if (c.kind === "big") return { title: "A figure too big to be right", short: "a figure",
    says: [`This text reads ${m(c.amount)} for ${/^(Roth|HSA|Federal)\b/.test(c.label) ? c.label : c.label[0].toLowerCase() + c.label.slice(1)}${c.more > 0 ? `, and ${c.more} more figure${c.more === 1 ? "" : "s"} as large` : ""}: no form holds that much, so it is not used. Check the text you pasted.`] };
  return { title: "", short: "", says: [] };
}

/**
 * askLine(facts, w) -> the sentence under "Whose W-2 is this?": the W-2 names nobody on People and its pay matches no pay on
 * file, or (`doubt`, review P2) its name is not the one of the adult it would go to; then a way to add the person.
 */
export function askLine(f, w) {
  if (!f.doubt) return ["It does not name either of you, and its pay matches neither pay on file. Nothing is changed until you say."];
  const of = (n) => { const x = w.nameOf(n); return x === "your" ? "yours" : x; };
  const names = (f.ask ?? []).map((p) => of(p.name));
  const not = names.length === 1 ? `is not ${names[0]}` : names.length === 2 ? `is neither ${names[0]} nor ${names[1]}` : "is none of the names on People";
  return [`The name on it ${not}. If it is someone else's W-2, add them on People first; nothing is changed until you say.`, L.people];
}

/** headLine(facts, w) -> the one quiet line above the changes: whose form, which year, and what that year means. */
export function headLine(f, w) {
  const noun = { w2: "W-2", f1099: "1099", f1040: "tax return" }[f.kind];
  const assumed = f.yearWhy === "assumed" ? ` It does not say its year: change it under “The ${noun} you pasted” if it is not ${f.year}.` : "";
  if (f.kind === "w2") {
    const whose = f.personId ? `${w.Whose} W-2` : "A W-2";
    return `${whose} for ${f.year}${f.when === "plan" ? ", the year the Federal estimate works out." : `. It covers ${f.year}, so it fills in only what the plan does not have yet.`}${assumed}`;
  }
  if (f.kind === "f1099") return `A 1099 for ${f.year}${f.when === "plan" ? ", the year the Federal estimate works out." : "."}${assumed}`;
  return `Your tax return for ${f.year}.${assumed}`;
}

/** sameWords(x, w) -> how a change already on file, or a figure the plan agrees with, is named in "Already on file, nothing to change: ...". */
export function sameWords(x, w) {
  const m = w.money;
  if (x.kind === "k401" || x.kind === "roth401k") return `${checkOf(x, w).title.replace(/^Your /, "your ")}, ${m(x.onFile)} a year`;
  if (x.kind === "pay") return `${w.whose} pay, about ${m(x.amount)} a year`;
  if (x.kind === "hsa") return `HSA money through work, ${m(x.amount)}`;
  if (x.op === "taxYear") return `${FIELD[x.field].title(x.year).replace(/^\w/, (c) => c.toLowerCase())}, ${m(x.amount)}`;
  if (x.op === "gain") return cardOf(x, w).title.replace(/^\w/, (c) => c.toLowerCase());
  if (x.op === "priorYear") return `last year's return, ${x.year}`;
  return "";
}
