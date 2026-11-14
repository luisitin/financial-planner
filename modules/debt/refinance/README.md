# Refinance  (`debt/refinance`)

**Status:** usable (phase 4)
**Purpose:** Whether a refinance offer pays: the new payment, when the closing costs are earned back, and the interest either way.

## Inputs
Plan sections read (`needs`): the mortgage (through the Mortgage page compute), `debtPlan.refinance` (`{ rate, termYears, closingCosts, yearsStaying }`, and the optional `offers` and `keep` of "Two offers side by side" below). Writes: `debtPlan.refinance`.
`compute(plan, { today, rate, termYears, closingCosts, yearsStaying })`; `twoOffers(plan, { today, offers, keep })`.

## Outputs
`current`, `offer` (payment, months, totalInterest), `monthlySaving`, `breakEvenMonths`, `yearsStaying`, `interestWhileStaying` (current, offer), `netWhileStaying`, `verdict`, `extraYears`, `needsOffer`, `hasData`.

## Formulas
- New payment: `pmt(rate/12, term months, balance)`; whole-loan interest from `amortization`. When the mortgage page splits tax and
  insurance out of today's payment (`mortgage.escrow`, while the balance or payment is our guess; 2026-11-07), the same amount is
  added to the new payment, so `monthlySaving` = today's principal and interest less the new one, and the interest while staying
  is worked from the loan parts only (`current.toLoan`, `offer.toLoan`). A plan with its own payment and balance: escrow 0, nothing moves.
- Break-even months = closing costs / monthly saving (null when the payment does not fall).
- Interest while staying: month-by-month interest for the years you expect to keep the home, both loans, same start balance; net = current interest - offer interest - closing costs.
- Verdict: worth it when the net beats half the closing costs and 500; close call when positive; not worth it otherwise.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Two offers side by side (gap list, next 60, item 1; claude-b, 2026-11-14)

Points against a lower rate, a lender credit against a higher one, the costs paid at closing or added to the loan, for two
lenders' quotes at once, against keeping today's loan, over the years the person expects to keep it. `twoOffers()` in
`compute.js`; `compute()` does not call it and reads none of its fields, so a plan without them gets exactly the page it
had (invariance test in `module.test.mjs`; checked against 6ffb433 over every invented household, `build.md`).

### Inputs
`debtPlan.refinance.offers?: [offer, offer]`, an offer `{ rate, termYears, points, credit, costs, rollIn }` (each read with
its default: 30 years, 0 points, $0 credit, $0 costs, paid at closing; a rate from 0 to 30% makes it count), and
`debtPlan.refinance.keep?`: whole years (1 to 40) or `"payoff"`; absent, the single offer's `yearsStaying`, else 7. Params
`offers` and `keep` win over the plan's (the page's working copy).

### Formulas
B = today's balance, r0 its rate, P0 its payment for the loan (principal and interest; `toLoan` from the Mortgage page, the
tax and insurance `escrow` E split out and kept on both sides). An offer: rate r, n = 12 x its years, p points, C credit,
K other closing costs.

1. **Points.** Each point is 1% of the new loan. Paid at closing: points = p% x B. Added to the loan, they are on the
   bigger loan: L = B + p% x L + K - C, so **L = (B + K - C) / (1 - p%)** and points = p% x L.
2. **Fees and credit.** Fees = points + K; credit used = min(C, fees) (a credit above the fees is not paid out: in a
   refinance that keeps the loan's size it only pays costs; builder's simplification); net = fees - credit used. The
   part left over, **creditLeft = C - credit used**, is not counted, and the page says so under that offer ("The credit
   is $13,700 more than the costs; that part is not counted."), so a big credit never vanishes silently.
3. **Cash at closing.** Paid: L = B, cash = net. Added: L = B + net (formula 1), cash = $0.
4. **Payment.** P = pmt(r/12, n, L) = **L x i / (1 - (1 + i)^-n)**, i = r/12, to the cent (`core/math/finance.js`, tested in
   `tests/finance.test.mjs`); the whole payment is P + E; the monthly saving is today's whole payment less the new one.
5. **Interest month by month** (`interestRun`, the same loop as `compute()`'s "interest while staying"):
   i_k = b_(k-1) x rate / 12, b_k = max(0, b_(k-1) + i_k - P), stopping when the loan is paid off; I(k) = i_1 + ... + i_k.
6. **Cost over k months.** An offer: **net + I_offer(k)**; keeping today's loan: **I_keep(k)**. Why this is the whole cost:
   the money out over k months is the cash at closing + the payments + what is still owed at month k (paid off when the
   person moves); the payments are interest plus principal, so money out = cash + L + I(k); less today's B, owed either
   way, it is net + I(k). Principal paid is the person's own money and is not a cost. (Test: the identity against an
   `amortization()` schedule.) **Still owed at H** (`owed`, `keeping.owed`) = b_H of the same loop, shown on each
   record ("Still owed after 7 years: $234,224"), so a longer loan's lower payment is read with the bigger balance it
   leaves: for the family, 5.25% over 30 years with no costs owes $234,223.96 after 7 years against $201,999.10 kept
   and $201,586.47 for offer 1, and its cost already counts that (test: owed against the `amortization()` balance, and
   cost = cash + payments + owed - B for both loans).
7. **Break-even** = the first month k (1 to the longest loan) with **I_keep(k) - I_offer(k) >= net**. Written as the brief
   asks, "the running saving in payment (and the higher balance) covers the up-front cost", it is the same month:
   k x (P0 - P) + b_old(k) - b_new(k) >= cash at closing, because each payment is its interest plus its principal (test:
   both ways give months 32 and 21 in the example). `noCosts` when net is $0; `null` (never) when it is not reached.
8. **Which costs less.** diff = cost_1(H) - cost_2(H) over the horizon H; **a tie when |diff| < $100** (builder's line,
   `TIE`). "The other would win": `within` = the last month before H where the other offer costs at least $1 less (it wins
   if the person moves or pays off within it); `from` = the first month after H where it does (it wins if they keep the
   loan that long). When both exist the one nearer H is said (two crossings happen only with very different loans).
9. **Horizon.** H = 12 x the years kept (at most 600 months, as `compute()` caps the stay); "Until paid off": the longest of
   today's loan and the two offers (at most 600 months).
10. **The case.** none (no rate typed), one (one offer has a rate), keep (both cost more than keeping), tie, two.

**Worked example** (the invented family of `qa/fixtures/family-plan.mjs`: $265,000 left at 6.25%, $1,980 a month, no tax
or insurance in it, 230 months to go; kept 7 years, H = 84):
- Offer 1: 5.25%, 20 years, 1 point, $4,000 other costs, paid at closing. Points = 1% x 265,000 = $2,650; net = $6,650 =
  cash at closing. P = 265,000 x 0.004375 / (1 - 1.004375^-240) = $1,785.69, $194.31 less than now. Break-even: month 32
  (2 years 8 months). Cost over 84 months: 6,650 + 86,584.43 interest = $93,234.43.
- Offer 2: 5.625%, 20 years, no points, $1,500 lender credit, $4,000 costs added to the loan. L = (265,000 + 4,000 - 1,500)
  / (1 - 0) = $267,500; net = $2,500; cash $0. P = $1,859.04, $120.96 less than now. Break-even: month 21. Cost over 84
  months: 2,500 + 94,043.06 = $96,543.06.
- Keeping: $103,319.10 of interest over 84 months. Offer 1 is $10,084.67 under it, offer 2 $6,776.04; offer 1 is
  $3,308.63 under offer 2, and offer 2 is the cheaper one through month 45: "Over 7 years, offer 1 costs $3,309 less than
  offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months." (Test: "the README's worked
  example, figure by figure".)

**The same basis as the page.** For a plain offer (no points, no credit, paid at closing) the saving against keeping is
`compute()`'s `netWhileStaying` to the cent, and the payment is `compute()`'s (test). The single offer's "Costs paid back
in N months" divides the closing costs by the drop in the payment (kept as it is); the comparison's break-even counts the
interest saved, so the lower payment of a longer loan is not counted as a saving (that money is still owed). For the
family, 5.5% over 30 years with $6,000 of costs reads "13 months" above and "4 years 5 months" in the comparison; the part
says why in one sentence. (WORKBOARD 2026-11-11 already noted the single offer's two bases as a wording question for the owner.)

### Sources (read 2026-11-14)
- **Points**: IRS Publication 936 (2025), *Home Mortgage Interest Deduction*, dated Oct 28, 2025,
  https://www.irs.gov/pub/irs-pdf/p936.pdf, "Points": "The term 'points' is used to describe certain charges paid, or
  treated as paid, by a borrower to obtain a home mortgage", and test 8, "The points were figured as a percentage of the
  principal amount of the mortgage". One point = 1% of the loan is the usual convention, as the app's glossary says
  (`modules/ai/glossary/data/terms.js`, "Points"). The same section: points paid to refinance are generally deducted over
  the life of the loan, not in the year paid; **the comparison leaves tax out** (no deduction, no tax on either side).
- **Lender credits, closing costs**: definitions only (the glossary's "Closing costs"). No current figure is used: no
  rate, no cost, no limit. www.consumerfinance.gov and www.freddiemac.com were refused by this session's network
  (2026-11-14, the proxy's 403), so the arithmetic is written out above instead of cited.
- **Closing costs box**: no sourced share of the loan could be read, so the box shows an example worked from the person's
  own loan, labelled as one ("For example, 3% of your loan would be $7,950"). The single offer's old help, "usually 2 to 5%
  of the loan", had no source and now reads "from the lender's quote: fees, points, appraisal".
- No money is discounted or raised for prices: dollars as paid ("not adjusted for prices", said in the part).

## Ideas / not yet
- Cash-out refinance (on Renovation already). The tax effect of points (Pub. 936: deducted over the loan's life) and of the
  interest; an adjustable rate; private mortgage insurance on the new loan; a third offer.

## Touch and input stress test (2026-11-11, claude-g)
- The answer is one card right under Compare (D5): the verdict sentence, a green "Compared: $859 a month, $641 less than now." for
  each compare, then the four figures. The hero keeps the verdict word and today's loan. Typing a new offer marks the figures as
  the last offer compared until Compare is tapped again.
- "Add the mortgage" opens Net worth's add form set to Mortgage, with "Back to Refinance" after the save (DP-3).
- Follow-ups (2026-11-11): after Compare the answer card is brought up under the top bar; "Add its rate and payment" opens the
  mortgage's own form (`mortgageId` from compute) with a way back; "ends 13 years 10 months sooner", not "13.8 years".
