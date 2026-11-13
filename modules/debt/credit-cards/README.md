# Credit cards  (`debt/credit-cards`)

**Status:** usable (phase 4)
**Purpose:** How much of your card limits you use, what paying the minimum really costs, and whether a balance transfer helps.

## Inputs
Plan sections read (`needs`): `accounts` (type credit), `debts` (rate, minimum payment, `creditLimit`), `debtPlan.transfer` (`{ months, feePct }`). Writes: `debtPlan.transfer`.
`compute(plan, { today, promoMonths = 15, feePct = 0.03 })`.

## Outputs
`cards[]` (`balance`, `limit`, `utilisation`, `rate`, `minPayment`, `interestMonthly`, `trap`, `transfer`, `dueLater`), `totalBalance`, `totalLimit`, `utilisation`, `interestMonthly`, `count`, `missing[]`, `hasData`.

## Formulas
- Utilisation = balance / limit, per card and combined; 30% is the usual line, 10% the best.
- Minimum-payment trap (`trap`, the answer key's reading; the page leads with `bank`, below): `minimumOnly` (`core/math/payoff.js`) with the card's required payment, or, when none is set, 2% of the balance owed at the start of each month (before that month's interest) with a 25 floor, worked again every month as Regulation Z's sample calculation does (12 CFR 1026 Appendix M1 (b)(1), (b)(3) and Appendix M2): months and interest until zero, or never when a payment is at or below the month's interest (1026.7(b)(12)(ii)). Checked against `tools/golden_debt` (`tests/golden-debt.test.mjs`).
- Balance transfer: interest over the promo months at the card's rate when paying max(required, balance / promo months) each month, against the fee (balance x fee %); `saves` = interest - fee; `payToClear` = (balance x (1 + fee)) / promo months.
- Balance transfer, the card's own line (`transfer.atClear`, 2026-11-07): the same loop, but at the payment the line names, `payToClear`
  (or the card's minimum when that is more): `pay` = max(required, payToClear), `interest` = what the old card charges over the promo
  months paying `pay` (each month: balance x rate / 12 added, `pay` taken off, to zero), `saves` = `interest` - the fee. The line says
  "saves about `atClear.saves` ... pay `atClear.pay` a month", so it is true at the payment it names. The renter's Visa card
  ($4,500 at 29%, 15 months, 3% fee): `payToClear` = 4,500 x 1.03 / 15 = $309.00; the old card charges $1,065.83 of interest over the
  15 months at $309 a month; less the $135 fee, `saves` = $930.83, "about $931" (balance / 15 = $300 gave $1,091.24 and "$956", the
  answer key's `bt_interest` and `bt_saves`, which `transfer.interestNow` and `transfer.saves` still hold). Mastercard $523 (was
  $538), Store card $374 (was $385); checked by an independent loop.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## What you really pay, and how to get under 30% (round 4, 2026-11-02)
- `cards[].paying`: when the Debts page's payment is more than the required amount, each card leads with it: "You pay $400 a month: paid off about July 2028, $1,384 of interest to come" (the Debts page's own months, date and interest); the minimum-payment trap follows as "Paying only the $190 required: ...". Before, the page showed only the trap, never what the family pays.
- `under` = `underLines(cards, totalLimit, today)`: less30 = balances - 30% of the limits, less10 = balances - 10% (floor 0); date30/date10 = the first month the balances, each paid down at its own payment with interest at its rate each month (balance x (1 + rate/12) - payment), come to 30% / 10% of the limits or less (today when already there; null when not within 50 years, e.g. no payment). The hero says "$1,900 less on the cards gets you under 30%: about June 2027 at what you pay now, and under 10% (best for your score) about March 2028" with a link to the payoff plan. 30% and 10% are the usual credit-score lines (the page's own wording, from the Consumer Financial Protection Bureau's and the scoring companies' guidance).
- The balance transfer line names its interest: "against the $1,229 of interest the card would charge over those 15 months".

## What the bank asks, as it shrinks (round 8, 2026-11-06)
The page held the typed $150 level and said "Paying only the $150 required: 4 years 7 months", while a bank's minimum
shrinks with the balance and takes 16 to 19 years on the same card; with no minimum typed it fell back to 2% of the
balance, which at 29% is less than the month's interest, so the page said "it never ends".
- `cards[].bank` = `bankMinimum(balance, rate, minimum)` (`core/math/payoff.js`): each month pay
  max(floor, interest + p x the month's opening balance), never more than is owed, worked again every month until zero
  (`minimumOnly(..., { interestPlus: p, floor })`).
  - p, the bank's share: (typed minimum - balance x rate / 12) / balance, rounded to the nearest quarter point, used when
    it is 0.5% to 2% (`issuerShare`); otherwise see "kind" below. Source: CFPB, *The
    Consumer Credit Card Market* (December 2025), section 4.1.1: "Most issuers set minimum payment at 1 percent of the
    balance"; "Issuers typically add the sum of finance charges, fees, and past due amounts onto this percent of the
    cycle-ending balance" (https://files.consumerfinance.gov/f/documents/cfpb_consumer-credit-card-market-report_2025.pdf,
    read 2026-11-06).
  - The floor is not on any statement, so the figure is a range: `quick` with $40 (the most common floor in the 2025 review
    of agreements) and `slow` with $25 (the most common in 2015: "the most common floor was $40, a $15 increase since
    2015"; floors ran from $15 to $50). Same report, same section, read 2026-11-06.
  - Verify (2026-11-06): a typed minimum under $40 (or $25) is this month's figure, and the bank's minimum is at least its
    floor, so that card's floor is at most the typed amount: each end is min(floor, typed). $900 at 26.9% with $30 typed:
    p = (30 - 20.18) / 900 = 1.09%, so 1%; floors $25 and $30: 69 and 51 months, $843.77 and $610.65 (an independent loop),
    "about 4 to 6 years". It read "about 3 to 6 years": the $40 end, 32 months, sooner than keeping $30 a month level (51
    months), which cannot be. One figure when the typed amount is $25 or less. A balance paid in one month reads "1 month".
  - Check against the CFPB's own worked example (same report, 4.1.3): $2,000 at 29%, "the greater of accrued interest
    plus 1 percent of the balance or $35 each month would pay over $3,000 in interest over an almost 10-year period";
    the formula gives 119 months and $3,134.10 (`tests/payoff.test.mjs`).
  - Shown as "If you pay only the minimum, which drops as you pay down: about 16 to 19 years and $8,900 to $9,700 of interest" ($4,500 at 29%, $150
    typed: p = (150 - 108.75) / 4,500 = 0.92%, so 1%; 186 months and $8,933.23 at $40, 233 months and $9,661.32 at $25).
    Years to the nearest year with a half year rounded up, as the statement's own box rounds (12 CFR 1026.7(b)(12)(i)(B));
    under 2 years in months; interest to the nearest $100 (to $10 under $1,000).
- `trap` is unchanged (the answer key `tests/golden/debt/cards.csv` reads it: a typed minimum held level, else 2% with a $25
  floor). The page shows it only as the second line, for what it is: "Keep paying $150 even when the minimum drops: done in 4
  years 7 months, $3,610 of interest, about $5,300 to $6,100 less" (the saving = `bank.quick.interest - trap.interest` to
  `bank.slow.interest - trap.interest`, rounded as above), and not when the Debts page's payment is already more than the
  minimum, nor when it would not end sooner than the bank's own minimum.
- Under the cards, once: "Most banks ask for the month's interest plus 1% of what you owe (at least $25 to $40), so the time
  is a range; each statement's Minimum Payment Warning box shows your bank's own figure." (The box: 12 CFR 1026.7(b)(12)(i)(A), "Minimum Payment Warning: If you make only the minimum
  payment each period, you will pay more in interest and it will take you longer to pay off your balance",
  https://www.consumerfinance.gov/rules-policy/regulations/1026/7/, read 2026-11-06.)
- Tests: `tests/payoff.test.mjs` (the formula, the CFPB example, the share, the range), `module.test.mjs` ("round 8": the
  figures on an invented renter's cards, and the page's words through `qa/fixtures/fake-dom.mjs`).

## A transfer only if approved; a counselor when the cards are full (round 8, 2026-11-06)
The renter's page promised "saves about $956" with no word that a 0% card has to be granted, and said nothing to someone
using 85% of their limits with $3 a month left over. Credit cards' side of the finding (Consolidation is claude-a's page):
- Each card's transfer line says what the saving covers and that it needs approval: "0% transfer: saves about $956 over 15
  months if you are approved and pay $309 a month." (the saving is the interest the card would charge over the promo months
  at that payment, less the fee). The offer card adds, once: "Each card's saving above uses these months and fee, and needs a
  card company to approve you. A 0% card usually needs good credit, and its limit may not take all $9,800 you owe on cards."
- "If payments are too much" when a card carries a balance (`carried`: something owed and a minimum under the
  whole balance, or none typed) and either card use is over 50% of the limits (`utilisation` > 0.5) or Next best action
  leaves under $100 a month (`spare.monthly`) with less cash in the bank than is owed on the cards (Liquidity's `nowAll`,
  all cash, goal money too); both read through `ctx.computeOf`, and the thresholds are the app's: a nonprofit
  credit counselor and a debt management plan, "you make one payment a month to them, they pay the card companies, often at
  lower interest and fees", "nfcc.org (National Foundation for Credit Counseling) and fcaa.org (Financial Counseling
  Association of America) can point you to one, and most work by phone or online as well as in person", and to check the
  card companies have agreed before paying anything. Source: CFPB, "What is
  credit counseling?" (https://www.consumerfinance.gov/ask-cfpb/what-is-credit-counseling-en-1451/, read 2026-11-06), which
  names both associations with their sites, says "Most credit counselors offer services through in-person meetings at local
  offices, online, or on the telephone" (page last reviewed Oct 28, 2026; read again 2026-11-06), describes the single monthly payment, says such plans typically lower payments and reduce
  interest and fees, and says to confirm the creditors have accepted the plan first.
- The offer is still `debtPlan.transfer` (15 months, 3% by default). Consolidation keeps its own (`whatIfs.consolidation`,
  18 months, 4%): claude-a is asked to read this one so both pages show the same months and fee.
- Test: `module.test.mjs` ("round 8 ... approved").

## Ideas / not yet
- Statement-date awareness for utilisation, rewards and annual fees.

## Round 8 review fixes (2026-11-06)
- **Every kind of typed minimum** (`bankMinimum(...).kind`, `core/math/payoff.js`). A typed minimum outside the 0.5% to 2%
  window used to be dropped, and the page said "no minimum typed for it" under "$35 a month required":
  - `typed`: interest + a share of 0.5% to 2%, as above.
  - `floor`: more than interest + 2% of the balance and at most $50 (`ISSUER_FLOOR_RANGE`: the CFPB's floors "varied from
    $15 to $50", report 4.1.1): it is the card's own floor, so the bank asks max(that amount, interest + 1%) every month,
    which is that amount until the balance is under it. One figure: "If you pay only the minimum ($35 a month until the
    balance is under it): 2 years 10 months and $283 of interest" ($900 at 19.9%: interest $14.93 + 1% = $23.93 < $35; 34
    months, $282.95, checked by hand by the review's own loop). No "keep paying" line: it is the same.
  - `full`: the whole balance (a charge card, or one paid in full each month): "The bank asks for the whole balance each month:
    no interest while you keep paying it in full." No range, no "keep paying" line and no transfer line (a card paid in full
    in its grace period is charged no interest, so there is nothing for a transfer to save).
  - `below-interest`: at or under the month's interest, which no bank asks: most banks' minimum, and "(your $150 minimum is
    less than this month's $200 of interest: check it on your statement)".
  - `unmatched`: any other amount: most banks' minimum, "(your $X minimum does not match a bank's usual formula)".
  - `assumed`: nothing typed: "If you pay only what most banks ask, which drops as you pay down: ...", and the detail line
    says "minimum not entered yet (Debts page)" instead of "$0 a month required".
- **One word for the bank's figure.** The detail line says "minimum this month $150 · limit $5,000" (the rate only when the
  pill does not show it, under 20%), the first line "If you pay only the minimum, which drops as you pay down", the second
  "Keep paying $150 even when the minimum drops: done in ..., about $X to $Y less".
- **Transfer savings when the month cannot carry them.** `transferPlan` sums the cards whose transfer saves (`carried` and
  `transfer.saves` > 0): `payToClear` (balance x (1 + fee) / promo months, each), `paying` (each card's payment now: the Debts
  page's, else the minimum) and `atPay`: per card, the interest the card would charge over the promo months at today's
  payment (the same monthly loop as `interestNow`), less the fee (`saves`), and balance x (1 + fee) - payment x months, at
  least 0 (`owedAfter`, left on the 0% card when the months end). When Next best action's spare money is less than
  `payToClear - paying`, the offer card says "Clearing all three in 15 months takes about $673 a month, $353 more than you pay
  on them now, and your month has about $3 to spare. At what you pay now ($320 a month), the 0% months would save about
  $2,700 of interest and leave about $5,300 to pay when they end." (renter: $3,036.57 of interest less $294 of fees =
  $2,742.57; $9,800 x 1.03 - 15 x $320 = $5,294; checked by an independent loop.)
- **The counselor card** only with a balance carried (not for a card paid in full), and only when the month is short *and* the
  cash in the bank is less than the cards owe (a household with $202,000 in the bank and a card paid in full saw it).
- Tests: `tests/payoff.test.mjs` ("floor, the whole balance, below the interest"), `module.test.mjs` ("review D1", "review
  D2", "review UX" x2), each failing before the fix.

## Round 8 batch 4 follow-ups (2026-11-07)
- Each card's transfer line is worked at the payment it names (`transfer.atClear`, formula above); the answer key's `saves` and
  `interestNow` are untouched. The transfer offer's total (`transferPlan`) counts the cards whose saving at that payment is above $0.
- **Opens short** (the page was about 2,500 px at 390 wide for three cards, now about 1,390): each card's "Keep paying ..." and
  "0% transfer ..." lines fold into one outlined "Other ways to pay it off" row, closed unless the transfer is plainly the move
  (the only carried card whose transfer pays); the counselor card and the transfer offer (months, fee, "Use these numbers") are
  folded cards, closed. Nothing was removed. The card's icon is hidden to give the text the width. Layout tests changed: none
  (the text of every line is still on the page); "F6" is new.

## Review of the follow-ups (2026-11-07)
- A line under the total names the card to put extra money on (highest rate first, as Pay off debts does by default): shown only with two or
  more cards carrying a balance, a clear highest rate of 20% or more, and no saved smallest-first or own payoff order.
- Each card's closed fold is titled for what is inside ("Pay more, or move this balance to a 0% card"); the first review title "Other ways to pay it off" was vague.
- Verify (2026-11-07): the "Put extra money on ..." line gives the rate as the card's pill does, to the tenth when it is not whole
  (29.9% read "(30%)" beside a "29.9%" pill). Test "verify: 'put extra money on'".

## Wording follow-up (2026-11-07, claude-b lane B)
- Which debt gets the extra money: when a debt that is not a card (a loan, not a mortgage) costs more than the dearest card, the page says so and points at Pay off debts, which puts that loan first too (`dearerLoan`). A card name reads right in the sentence (`cardPhrase`: "the Visa card", "Card A", "the Gold card"). A card whose 0% transfer does not pay has a fold titled "Keep paying more" (or "Moving to 0% does not pay" when nothing else is in it). The transfer offer says "The 0% transfer figures under each card" (the lines are in closed folds). Counts of cards are spelled out from three to twelve ("all nine").
- Review round 2: a loan whose name says whose it is ("Pat's car loan") has no "the" before it; the extra-money line says the loan is not one of the cards here; the transfer fold is "Moving a balance to a 0% card" and the buttons say "move this balance to a 0% card"; "combined credit limits".

## Touch and input stress test (2026-11-11, claude-g)
- "Use these numbers" checks the boxes' own limits (1 to 36 months, 0 to 10%) before saving (DP-4, D2): 600 months and a 150% fee
  were kept, and an empty months box became 15 without a word. The fee box takes any decimal (3.25 was refused by a 0.5 step).
  The green line names what is used ("Using 15 months at 0% and a 3% fee.").
- "Add a card" and a new "+ Add another card" under the list open Net worth's add form set to Credit card, with "Back to Credit
  cards" after the save (D1, DP-3, B4). Cards with no rate or payment get "Add them on Debts" as a button.
- Follow-ups (2026-11-11): a card with no rate gets a filled "Add Visa's rate and payment ›" to its own form (with a way back);
  the 0% section stays open after "Use these numbers" so its green line is seen.

## Simple first (2026-11-13, with gap design #18)
`docs/OPTIONAL.md`; the opt spec's row for this page (class B). The view only; `compute()` is unchanged, every sentence
and figure is where it was or in a part.
- Each card's "Pay more, or move this balance to a 0% card" (or "Keep paying more", ...) is a part of kind `item` drawn by
  `core/ui/more.js`, still carrying the page's scoped `.cc-more` outline, open only when the transfer is plainly the move.
- "Moving a balance to a 0% card" (`transfer`, kind own, its two boxes now named `promoMonths` and `feePct` so `?show=`
  lands on them) and "If payments are too much" (`help`, kind how, "free help") are rows of one parts card. The transfer's
  status is at most 20 characters: "tight month" (the sentence inside says why) or "15 months, 3% fee". The two boxes and
  "Use these numbers" are one `ui.form` (its filled button is the form's Save, and no box sits in the parts card outside a
  form: docs/OPTIONAL.md R18, R32); the boxes' limits (1 to 36 whole months, 0 to 10%) and an empty months box are held at
  the box. After "Use these numbers" the part stays open with its green line and no other part opens (R17, test "S11"). Both
  titles are pinned in the first-view check: each names a thing a person must recognize, which "Set my own numbers" or
  "How this is worked out" would hide.
- The card list is cut at six with "N more cards" (`rest()`), never fewer than three hidden. Builder chose: each row keeps
  "If you pay only the minimum ..." in sight (a hint worth money, never folded), so the opt row's "one line per card" is
  left for opt C13.
- "What is my credit score?" (Your credit score, gap design #18) is the page's "More on this" row, drawn by
  `core/ui/more.js` `links()`, for every household, in sight at the foot. Its answer under it is the score once one is kept
  there ("Your score: 655", credit-score's own headline); before that the question alone (the page's name under it answered
  nothing). It sat at the foot of the shut "Moving a balance to a 0% card" part for a household carrying a balance, built by
  hand (integ2 check 1, finding 3: the only way to the page was behind a shut part for exactly those households). A fold of
  its own would be a sixth section for the renter (budget 5); in sight it is 8 words, and the renter's first view is 279
  words, inside the page's count of 280 (271 with the question folded, 278 before the gap commit).
- Tests: `module.test.mjs` "simple first" (two tests; they failed on the view before this change); the F6 test keeps
  pinning `.cc-more` on each card's part.
