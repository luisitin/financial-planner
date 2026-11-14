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
`tests/debt-pages.test.mjs`, `module.test.mjs` (the two offers: every formula, the worked example, each sentence case and
each line under an offer, the invariance of `compute()` over every invented household, the first view, the part's labels
and its one outlined Save, the hero with saved offers, the working copy saved only by "Save these offers", the green line
said once, a missing rate held at its box, a credit above the costs, S11).

## Two offers side by side (gap list, next 60, item 1; claude-b, 2026-11-14)

Points against a lower rate, a lender credit against a higher one, the costs paid at closing or added to the loan, for two
lenders' quotes at once, against keeping today's loan, over the years the person expects to keep it. `twoOffers()` in
`compute.js`; `compute()` does not call it and reads none of its fields, so a plan without them gets exactly the page it
had (invariance test in `module.test.mjs`; checked against 6ffb433 over every invented household, `build.md`).

### What the person sees
- **First view: unchanged.** Once an offer is compared (or offers are saved), one quiet row under the page's cards,
  **"Compare two offers"** (a part of kind `own`; status "set by you" once saved). Not before: the offer's own four boxes
  are the one way in, so a fresh page never asks the same questions twice (the person critic's P3, 2026-11-15), and offer
  1 then starts from the offer compared. Its title is pinned in `qa/first-view-lib.mjs` `PINNED_TITLES` with its reason:
  two lenders' quotes, a thing a person looks for by name, not our guess overridden, so "Set my own numbers" would be
  untrue. The single offer's closing-costs help lost its unsourced "usually 2 to 5% of the loan" (now "from the lender's
  quote: fees, points, appraisal"): the first view is 56 words, one figure fewer, no part.
- **Offers saved, none compared above** (another device, an older plan): the hero says their answer instead of "Type an
  offer below.": "Your saved offers: over 7 years, offer 1 costs $3,309 less than offer 2; ..." (P2).
- **One tap away**, in this order: one line ("Two lenders' quotes side by side, against keeping your loan."); once an offer
  has a rate, the answer in one sentence (one per case, `twoSentence`), and while no offer's boxes are out, one record per
  offer (the payment and how it compares with now, the cash at closing, a credit above the costs said as not counted,
  when its costs are paid back, the fees and interest over the years kept against keeping the loan, and what is still
  owed then, "Still owed after 7 years: $201,586." or "Paid off within the 20 years.") and one for keeping the loan
  (its interest and what it still owes then; while boxes are out, the sentence alone, changing as they are typed); "How
  long you expect to keep the loan" (chips 5, 7, 10 years, Until paid off, Type my own); one offer's boxes at a time, in
  the words of the offer above: "New term in years" (chips 15, 20, 30 years, Type my own), "Offered rate per year",
  "Points (a fee for a lower rate)" (chips None, 1 point, 2 points, Type my own; "Each point is 1% of the new loan, paid at
  closing for a lower rate: about $2,650 here."), "Other closing costs" (not "Closing costs": points are asked just above
  and must not be counted twice; a labelled example worked from the person's own loan), the costs paid at closing or
  added to the loan (two chips), and the lender credit under the form's line named for it, "Lender credit (optional)"
  (P5); the other offer as one line with Change; **"Save these offers"**, outlined (the page's one filled button is the
  offer's Compare, design log: one filled button; P1); "How these are worked out" in three sentences, with the records.
- **Nothing reaches the plan until "Save these offers".** The chips and boxes act on a working copy (module-level, kept
  across the shell's redraws): a chip redraws the answer at once, a box on its change (never per keystroke), and "Not
  saved yet: tap Save these offers to keep them." shows once something changed. The copy is dropped after the save, and
  when the saved offers change under it (another tab, Undo); a reload starts again from the plan. There is no Cancel: tapping the
  old chip or typing the old figure puts it back, and leaving without saving changes nothing in the plan.
- **Offer 1 starts from the single offer** above (rate, term, closing costs; not saved until the person saves), so offer
  2's boxes are the ones out; Change opens offer 1's. Offer 1 saved alone opens offer 2's boxes after the save.
- **After the save** the part stays open (R17, `pendingTwo.part`), and the green line naming the answer (R7) stands in the
  answer's place at the top of the part, said once: "Saved. Over 7 years, offer 1 costs $3,309 less than offer 2; offer 2
  would cost less if you move or pay it off within 3 years 9 months." The page brings it up under the top bar, so the
  shell's bottom copy is not needed (P6: it was bold above, green under Save and copied at the bottom). The next change
  puts the plain sentence back. A Save with no rate is held at the rate box ("Type the rate, like 5.5."); no box in the
  part is `required` (R9 item 9).
- The single offer's Compare keeps the saved offers (`{ ...refinance, rate, termYears, closingCosts, yearsStaying }`).
- One offer's boxes at a time, and the records only while no boxes out, keep the open part within R15 (1,300 px at 390):
  for the invented family 1,168 px on opening after a compared offer (offer 1 started from it), 1,130 on opening with two
  offers saved, 1,223 after the save with both offers' records (the lines still owed included). At 320: 1,301 and 1,321
  on opening.
- Builder's choices: the years kept are the person's for this comparison, saved with the offers (`keep`), not the single
  offer's `yearsStaying` (which keeps its meaning for the answer above); a tie is within $100; a credit above the fees is
  not counted (and said so); the tax effect of points and interest is left out; the comparison's break-even counts the interest saved (see
  "The same basis as the page").

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

## Simple first: the opt spec's C13 for this page (R8; claude-b, 2026-11-14)
A what-if page asks first, then answers (docs/OPTIONAL.md R8; the opt spec's table: "before an answer, the offer form (4
boxes); after: ... 'The figures' (the offer) once answered"). The gap spec asks a design on a page whose opt commit has not
landed to do that page's conversion (section 3, rule 1); it is a commit of its own, after the two offers, so it can be
taken or left alone.
- **Nothing compared yet** (every invented household of the first-view check): unchanged, the hero "Refinance", "Type an
  offer below." and the card "The offer" with its four boxes and the filled Compare (no parts card: "Compare two offers"
  comes once an offer is compared).
- **An offer compared**: the hero's verdict and today's loan (the lede loses "The offer you compared is under the boxes
  below."), the card "What this offer does" (sentence, four tiles, the note), then one parts card: **"The figures"** (kind
  `figures`, its status the offer, "5.5%, 30 years"; `holds` the four box names, so `?show=rate` lands on it) and "Compare
  two offers". For the invented family with an offer compared: 192 words, 17 figures and 4 boxes before, 149 words, 16
  figures and 0 boxes after (counted as the module test reads a first view; the check's households have no offer, so
  `tests/first-view.known.json` is unchanged).
- **Compare inside "The figures"**: the part stays open (R17), the page brings the answer card up under the top bar with
  its green "Compared: $1,423 a month, $557 less than now." (D5 kept), and "Tap Compare to see the one typed below." says
  where the boxes are while the figures are stale. The first view of an answered page has no filled button: its one
  filled button, Compare, is the form's Save inside "The figures" (R8 folds the inputs, R18 allows a part's own Save).
- Tests: "R8: once an offer is compared the answer leads ..." and the S11 test (Compare opens only "The figures", Save
  these offers only "Compare two offers"). With both parts open the screen still has one filled button, Compare: Save
  these offers is outlined.

## Touch and input stress test (2026-11-11, claude-g)
- The answer is one card right under Compare (D5): the verdict sentence, a green "Compared: $859 a month, $641 less than now." for
  each compare, then the four figures. The hero keeps the verdict word and today's loan. Typing a new offer marks the figures as
  the last offer compared until Compare is tapped again.
- "Add the mortgage" opens Net worth's add form set to Mortgage, with "Back to Refinance" after the save (DP-3).
- Follow-ups (2026-11-11): after Compare the answer card is brought up under the top bar; "Add its rate and payment" opens the
  mortgage's own form (`mortgageId` from compute) with a way back; "ends 13 years 10 months sooner", not "13.8 years".
