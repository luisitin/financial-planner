// modules/career/business/words.js -- PURE. The page's answer in words, one written sentence per case (docs/OPTIONAL.md
// R3 to R5, R7): what the business leaves the person after tax (or costs them), the line under it, what the owner takes
// out, the green line after a save, and the S corporation's worth line. Reads compute()'s result; writes nothing.

/**
 * answerFor(d, money) -> { case, title, line }: the hero's headline and the one sentence under it.
 * cases: "notReady" (no business yet), "even" (no profit, no loss, and nothing left or short after it), "evenOffice" (no
 * profit for tax because the home office takes it, which is not money out: what came in stays with the person, untaxed),
 * "evenMeals" (no profit for tax, but the half of business meals that does not count is paid from the person's pocket),
 * "lossSaves" / "loss" (a loss that lowers the
 * household's tax, or that has nothing to come off), "keep" / "keepNoTax" / "keepLowers" (a profit that leaves the
 * person money after tax: some tax, none, or a lower household tax, as the earned income credit can do), "shortMeals" /
 * "shortTax" (a profit that costs the person money after tax: the half of business meals that does not count, or the
 * tax alone, comes to more).
 */
export function answerFor(d, money) {
  if (!d?.ready) return { case: "notReady", title: "Your small business", line: "What the business earns after costs and tax, and what you can safely pay yourself." };
  const P = d.profit, keep = d.keepMonthly, t = d.tax?.total ?? 0;
  // no profit for tax: said from what is left, since the home office (not money out) or the half of meals that does not
  // count (money out) can leave the person more or less than nothing (money critic F2, 2026-11-16)
  if (Math.abs(P) < 0.5) {
    if (keep >= 0.5) return { case: "evenOffice", title: `After tax, the business leaves you about ${money(keep)} a month`, line: "The home office takes the profit for tax down to nothing, so there is no tax on it; the room is paid for anyway." };
    if (keep <= -0.5) return { case: "evenMeals", title: `After tax, the business costs you about ${money(-keep)} a month`, line: "There is no profit for tax, but the half of business meals that does not count comes out of your own pocket." };
    return { case: "even", title: "The business breaks even", line: "What customers pay covers the costs with nothing left over, so there is no tax on it." };
  }
  if (P < 0) {
    const title = `The business loses about ${money(-P)} a year`;
    return t < -0.5
      ? { case: "lossSaves", title, line: `The loss comes off the household's other income and lowers the tax by about ${money(-t)}; after that it costs you about ${money(-keep)} a month.` }
      : { case: "loss", title, line: `There is no other income for the loss to come off this year, so it costs you about ${money(-keep)} a month.` };
  }
  const makes = `It makes ${money(P)} a year after costs`;   // the share of what comes in is under "How this is worked out"
  if (keep < 0) {
    const title = `After tax, the business costs you about ${money(-keep)} a month`;
    return d.notDeducted > 0.5
      ? { case: "shortMeals", title, line: `${makes}, but the tax and the half of business meals that does not count come to more.` }
      : { case: "shortTax", title, line: `${makes}, but what it adds to the household's tax comes to more.` };
  }
  const title = `After tax, the business leaves you about ${money(keep)} a month`;
  if (t > 0.5) return { case: "keep", title, line: `${makes}, and about ${money(t)} of that goes to tax.` };
  if (t < -0.5) return { case: "keepLowers", title, line: `${makes}, and it lowers the household's tax by about ${money(-t)}.` };
  return { case: "keepNoTax", title, line: `${makes}, and it brings no tax.` };
}

/** What the owner takes out, when it fits in what the business leaves (the amber notice says the other case). */
export function drawLine(d, money) {
  if (!d?.ready || d.draw !== "ok" || !(d.drawMonthly > 0)) return null;
  return `You take out ${money(d.drawMonthly)} a month; that leaves ${money(d.keepMonthly - d.drawMonthly)} a month in the business.`;
}

/** The green line after a save names the new answer (R7): `lead` ("Saved.", "Supplies added.") and the answer worked on the plan as saved. */
export function savedLine(d, money, lead = "Saved.") {
  const a = answerFor(d, money);
  const now = {
    notReady: "",
    even: "The business now breaks even.",
    loss: `The business now loses about ${money(-d.profit)} a year.`,
    lossSaves: `The business now loses about ${money(-d.profit)} a year.`,
    evenOffice: `After tax the business now leaves you about ${money(d.keepMonthly)} a month.`,
    evenMeals: `After tax the business now costs you about ${money(-d.keepMonthly)} a month.`,
    shortMeals: `After tax the business now costs you about ${money(-d.keepMonthly)} a month.`,
    shortTax: `After tax the business now costs you about ${money(-d.keepMonthly)} a month.`,
    keep: `After tax the business now leaves you about ${money(d.keepMonthly)} a month.`,
    keepNoTax: `After tax the business now leaves you about ${money(d.keepMonthly)} a month.`,
    keepLowers: `After tax the business now leaves you about ${money(d.keepMonthly)} a month.`,
  }[a.case];
  return now ? `${lead} ${now}` : lead;
}

/** A hint worth money (R9 #6): what an S corporation might keep, when it would save. */
export function scorpWorth(d, money) {
  const s = d?.scorp?.saving;
  return s > 0.5 ? `As an S corporation you might keep about ${money(s)} more a year, after its running costs.` : null;
}

/** The S corporation row's status: at most 20 characters. */
export function scorpStatus(d, money) {
  const s = d?.scorp?.saving ?? 0;
  return s > 0.5 ? `would save ${money(s)}` : s < -0.5 ? `would cost ${money(-s)}` : "about the same";
}
