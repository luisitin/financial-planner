# Withholding check  (`taxes/withholding`)

**Status:** usable (phase 6)
**Purpose:** Whether your paychecks are taking out enough federal tax: the refund or bill in April, and the W-4 change that fixes it.

## Inputs
`taxes.withholding` (`{ self: { perPaycheck, period }, partner: { perPaycheck, period } }`), `taxes.thisYear.withheld` (so far this year, typed on the Federal estimate page; `withheldTyped` true when it was saved with a figure, so a typed 0 counts as typed), `taxes.estimated.paid`, `taxes.priorYear`, everything the Federal estimate reads.

## Outputs
`withholding` (`projectedWithholding`: so far + per paycheck x paychecks left; the whole year at the per-paycheck rate when "so far" is blank; per person), `totalTax`, `balance` (+ owe, - refund), `verdict` (about right / owe / refund / unknown), `harbour` (`safeHarbour`), `penaltyRisk`, `suggestion` (add X per paycheck on W-4 Step 4(c); or the Step 3 / 4(b) amount that ends a big refund). With an amount so far but no paycheck figure and a bill ahead, it says the paycheck figure is missing ("No paycheck figure is typed yet...") and points to the paycheck form or, for pay with no tax taken, Estimated payments; until 2026-10-31 it said "Nothing is withheld from a paycheck", which the person never said (found by the step-by-step guides' third review).

## Formulas
Paychecks left = floor(days left in the year / 365.25 x paychecks a year); a whole year before the year starts, none once it is over (paychecks in the January after count for the next year: IRC 31(a)(2)). Safe harbor: no penalty when withholding plus instalments reach 90% of this year's tax or 100% of last year's (110% when last year's income was over 150,000; 75,000 filing separately), or when this year's tax less withholding (not estimated payments) is under 1,000 (IRC 6654(e)(1); Form 2210 line 6). `penaltyRisk` = withholding figures typed, tax less withholding 1,000 or more, and withholding plus estimated payments under the safe amount (year totals; the Estimated payments page also checks each due date). `tests/golden-estimated.test.mjs` checks this page and Estimated payments against 3,000 households worked from IRC 6654 and 7503 (`tools/golden_estimated`).

## One answer to "refund or owe" (2026-11-02)
`withholdingEstimate(plan, { today })` is the one figure for what the paychecks take out this year: the figures typed here
and the year so far when there are any (`projectedWithholding`, unchanged); else the Paycheck page's federal withholding,
worked out from pay the way payroll does (IRS Pub. 15-T percentage method), for the whole year; else none. `taxAnswer`
puts it against the year's tax and the estimated payments made: Estimated payments, the Federal estimate, Quick answers
and Needs attention (an alert when $1,000 or more is left to pay in April after withholding and what is already paid) all read it,
so the family plan says "about $5,602 in April" on every page (before, $15,072 on Quick answers, "owe $7,072" on the
Federal estimate with only the year so far counted, nothing here until a stub was typed, and $9,470 withheld on Estimated
payments). `compute()`'s `balance` and `verdict` still count the typed figures only (the estimated-payments answer key
checks them); the page leads with `estimate` (that plus `balance`, `verdict`) and says when it is estimated, never
"$0 withheld". Earner by earner (review, 2026-11-02): a typed per-paycheck figure for whoever has one, the estimate from
pay for the others (`from: "mixed"`), and with only the year so far typed, the estimated earners' paychecks left added to
it; other payments typed on the Federal estimate (`taxes.thisYear.paid`) count as paid. The W-4 change on the estimate is
per paycheck, on the main earner's paychecks left (`estimate.suggestion`). Each "paid how often" box starts on that person's salary period on Income (it was always every two weeks,
so a monthly earner's stub figure was counted 26 times).

## Self-employment tax in the year's tax (2026-11-02)
`yearTax(plan, fed, { today })` -> `{ total, income, se }`. `income` is the Federal estimate's total, which counts business
income as ordinary income and leaves out the self-employment tax. With business income on the Income page, `total` is the
Self-employment page's figure (`taxWith`): the same income tax less what half the self-employment tax (IRC 164(f)) and the
20% business deduction (IRC 199A) save, plus the 15.3% self-employment tax (IRC 1401, on 92.35% of profit) and any
Additional Medicare Tax. `se` is the difference ($611 for the sample family's $7,200 of photography profit: $1,017 of
self-employment tax less about $406 of income tax the deductions save). This page, Estimated payments, the Federal
estimate's answer, Quick answers and Needs attention all use `total`: the safe-harbor amount and Form 2210 count
self-employment tax as part of the year's tax (the Form 1040-ES estimated tax worksheet adds it to income tax; Schedule 2 carries it to the 1040's total tax). Before, the April bill left it out
($5,602 instead of $6,213 for the family). A plan with no business income is unchanged (the answer key has none).

## The walk that ends at the whole tax (2026-11-02)
`fullSteps(plan, fed, params)` returns the Federal estimate's walk with the business rows inserted before "Federal tax"
when there is self-employment income: the change in income tax from counting the business at its profit with half the
self-employment tax and the 20% deduction off income (taxes/self-employment `taxWith − seTotal − addlMedicare` against
the engine's `totalTax`), then the self-employment tax; "Federal tax" becomes `yearTax`'s total. The Federal estimate and
the Tax report both show it.

## A refund counts the credits past the tax (review of 2026-11-02)
`yearTax` and `fullSteps` no longer stop the year's tax at 0: when refundable credits (the refundable child tax credit,
up to 1,700 a child) are more than the tax, the total is below zero, as the walk's last line has it, and the refund is
what was withheld plus that (`yearTax` -> `{ total, income, se, owed (at least 0), back (the credits past the tax) }`;
`compute` -> `totalTax` = `owed`, `creditsBack`, and the balances on the signed total). Jo at 30,000 (head of household,
one child, 10,800 of daycare): income tax 585, the care credit takes all of it, 1,700 of the child credit comes back: the
walk ends at -1,700, the paychecks withhold about 585, so the refund is about 2,285 (the page said 585; the Federal
estimate's headline said "About $0", its walk -1,700 and Next best action +140 a month). The headline, the walk, this
page, Estimated payments, the Tax report and Next best action now say the same; the words say "no federal tax, and about
$1,700 of credits come back" instead of a tax below zero. The rate in the walk goes through the Federal estimate's
`ratePct`, one rounding for the same figure.

## The year's tax is what the plan knows (round 8)
`yearTax(plan, fed, params, k?)` -> `{ total, income, se, seOwn, owed, back, known }` now takes the year's tax from the
Federal estimate's figures (`taxes/federal/known.js` `known()`): the answer keys' return with this year's IRA and 401(k)
withdrawals, stock pay vesting this year, a business at its profit (half its self-employment tax and its 20% deduction
off, the deduction after AGI as Form 1040 line 13 takes it), rentals after costs, the IRA deduction as IRC 219(g) allows
it and student loan interest put in (taxes/federal README "What the plan already knows"). `total` = `known().total`;
`se` = `total - known().totalAtGross` (the business's whole effect); `seOwn` = its self-employment tax with the 0.9%
Additional Medicare tax. Without any of those it is the Federal estimate's `totalTax` itself. The 20% deduction now
comes after AGI (it was taken off AGI, `adjustments`), so on the sample family (7,200 of photography profit, joint AGI in
the child care credit's phase-down) the total is 14,722.61, 30 more than before (14,692.61): the child care credit is one
step lower at the right AGI.
`fullSteps(plan, fed, params, k?)` returns `known().steps` (half the self-employment tax named under Adjustments, a
"Business deduction (20%)" line before Taxable income, "Self-employment tax" before "Federal tax"; the "Tax saved by
business deductions" line is gone), `total`, `rate`, `returns` and `se` (`tax`, `half`, `qbi`, `expenses`,
`nextDollar` from the Self-employment page's keep-per-100).
`withholdingEstimate(plan, params, k?)` adds what the employer holds back from stock vesting this year (`known().stock`:
22% supplemental, IRC 3402 and Treas. Reg. 31.3402(g)-1, Pub. 15 section 7; plus the 0.9% Medicare on wages past $200,000,
IRC 3102(f)) to what the paychecks take out (`stock`); with the year so far typed from pay stubs only the vests still to
come are added. Mo and Lin (equity household): paychecks 23,260 + stock 24,045 = 47,305 by December, against 53,643 of
tax: about 6,338 at filing. (The ranked figure was 6,248: the 90 between them is the 0.9% Medicare on Mo's own pay past
200,000, which the paycheck estimate leaves out for every earner; not changed here.) `taxAnswer` carries `stock` when
there is some.

## Edge cases
"About right" is within 500 either way. Without a paycheck figure the verdict is unknown. The paychecks-left count is by calendar days, not the employer's actual pay dates.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Read the withholding line from an imported paystub; state withholding.

## Care fourth pass (2026-11-02)
- **Could take home more per paycheck** (`takeHomeMore(over, person)`): only what the paychecks and payments take out beyond
  the year's tax (`over` = withheld + paid - the tax at 0 or more: refundable credits come back whatever the W-4 says), spread
  over the paychecks left, and never more than each paycheck withholds (a W-4 can only take it to nothing); Step 3 is that
  cut over a year's paychecks. Jo at 30,000: 22 a paycheck, all each withholds (it said 571, counting 1,700 of credit); two
  children and a 5,000 account: 138 (was 1,187); Jo with no account: 161 (was 812, 3,250 over 4 paychecks). The words say
  when it is all of what each paycheck takes out, and that the credits come back anyway.
- **Separate returns** (`separateBusiness(plan, fed, params)`): the Self-employment page works one household return, so on
  separate returns this page works each owner's business on their own return (federal `businessOn`): the profit, half its
  self-employment tax off that return's income, its 20% deduction after that return's AGI (199A(i)'s floor), the 0.9% on that
  return's own Medicare wages and earnings against 125,000. `yearTax`, `fullSteps` (and so Estimated payments, the Federal
  estimate and the Tax report) take it; `fullSteps.returns` gives each return's own total, so the Federal estimate's two
  returns add up. The family with 3,750 each: 14,282.30 (the Self-employment page's 14,157.45); no accounts: 15,682.61
  (15,742.45 with 59.84 of 0.9%). Filing jointly the Self-employment page's figures stay (its 30 gap is that page's: the
  20% deduction in `adjustments` instead of `qbiDeduction`).
- **Rates** go through the Federal estimate's `ratePct`: "Tax for the year ... 4.9% of income" for 4,268 of 88,000 (it said
  4.8% with `fmt.pct`).

## Review 2026-11-06
- **The W-4 figure for next year too.** A W-4 stays in force until it is changed. The Step 3 amount sized for the
  paychecks left this year (`takeHomeMore` `step3` = the cut a paycheck x the paychecks a year) would take next year's
  withholding far below the tax: Jo, 161 a paycheck typed, 4 paychecks left, was told 4,186, which leaves next year 938
  short. `takeHomeMore(over, person, full)` now also gives `january` = floor(min(over, full, perPaycheck x paychecks a
  year)), never below 0, where `full` is what a whole year of paychecks at today's rates takes out beyond the year's tax
  (estimated payments left out: next year's are not known; next year's tax taken as this year's, so "about").
  `one` is true when January's figure, kept for the paychecks left, already leaves under 500 of refund this year
  (over - min(perPaycheck, january / paychecks a year) x paychecks left < 500, the page's "about right"): then the page gives
  that one figure "this year and next". Otherwise `step3Words` says both: "For the 4 paychecks left this year, about 4,186 in
  Step 3 ... In January 2027, change Step 3 to about 3,248, or next year's paychecks would take out too little (a W-4 stays
  until you change it)." The estimate from pay now gives the figures too (it said "an amount in Step 3").
- **More withheld, the same root.** Asking for more on the paychecks left (Step 4(c)) comes with January's extra:
  `addJanuary(short, person, perPaycheck)` = ceil(short / paychecks a year), short = the year's tax less a whole year of
  paychecks at today's rates (0 when they cover it: "take the extra off again"); none said when within 500 a year of the
  rest-of-year figure. The answer key's `suggestion.perPaycheck` is unchanged.
- **Separate returns settle on their own.** `byReturn(plan, fed, est, { paid, priorTax, priorAgi })` works each return's
  balance: its own tax (`fullSteps` returns: a business on its owner's return), its own filer's withholding (IRC 31(a): the
  credit is on the return of the person it was withheld from; the household's typed "so far" shared by each earner's
  paycheck rate: about), and the payments divided as the couple may agree (IRS Pub. 505, "Separate returns": "One of you can
  claim all of the estimated tax paid and the other none, or you can divide it in any other way you agree on"): to the
  returns that owe, by what each owes, any beyond that by each return's tax. Each return's safe amount is its own
  (`safeHarbour` on its tax; last year's tax shared by this year's, Pub. 505's share of a joint return's tax with this year's
  returns standing in), with the $1,000 test on its own withholding, and a W-4 change on its own earner. The family filing
  separately with 3,750 each: Ana 7,764.60 of tax, 9,964.60 withheld, 2,200 back; Bo 6,517.70, 4,858 withheld, owes
  1,659.70 and is under 90% of his own tax (5,866): his own penalty test. The page said "You would likely get about $540
  back"; it now leads with "Bo would likely owe about $1,660 in April; Ana would likely get about $2,200 back" and an
  "Each return" card. The household's `balance`, `verdict`, `suggestion` and `estimate.balance` stay as they were: the
  answer key keeps withholding and estimates the household's (tests/golden/estimated RULES.md section 1).
- **The self-employment tax said is the tax itself.** `yearTax` adds `seOwn` (`separateBusiness` seTotal + Additional
  Medicare on it, the Federal estimate walk's figure): 1,017 for the family, joint or separate. `seTax` stays the business's
  whole effect on the tax, its deductions taken off (581 joint, 796 separate), which alerts and the answer keys read.
- Tests: "the W-4 Step 3 figure for the paychecks left, and the whole year's figure for January", "more withheld ... the
  figure for January too", "filing separately, each return settles on its own", "Estimated payments, filing separately",
  "the self-employment tax itself", "credits more than the tax" (Estimated payments' words).

Review 2026-11-06 (round 7): the estimate line ("you about $244 a paycheck, your spouse about $261"), "on your W-4: Step 4(c)", the separate returns ("Your spouse would likely owe ...; you would likely get ...", "Your spouse's return", "withheld from your spouse's pay", "your spouse's W-4") and the form labels ("Your federal tax taken per paycheck", "How often you are paid") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before ("Bo: paid how often"; core/words.js; view only). Short stat labels that just name who ("Me: refund", "Me: $100 x 3 left") stay.

## The rate and "income on file" are the Federal estimate's (round 8 review, 2026-11-06)
- **The rate:** `effectiveRate` is `known().rate`, the year's tax over income as the Federal estimate says it. It used to
  be the keys' return. Quick answers reads it through `taxAnswer`.
- **The wages:** `wages` is `known().result.income.wages`, stock pay included.
- **Income on file:** `hasIncome` is `known().hasIncome`, so a retiree living on IRA withdrawals has income here.
- **Why.** The review found the widow's "1.1% of income" beside the Federal estimate's 6.0%, and a retiree with no Income
  lines told "No income on file" beside 6,953 of tax.

## Stress test 2026-11-11 (touch and input)

- With nothing earned on file: a plain line and a filled "Add your income"; no $0 tiles (T3, A8).
- With nothing earned on file the form below is folded, so "Add your income" is the one filled button.

## First screen's action (stress test MR-7, 2026-11-11, claude-f)
Needs attention's "Check the tax taken from your pay" opened this page with no button on the first screen (the only filled one,
Save, was 1.6 screens down). `firstMove()` in compute.js now picks the one filled button in the hero:
- a W-4 change that clears a bill or frees a refund (an "add", or a "cut" of at least $1 a paycheck): "Get a new W-4 form",
  which opens the IRS page for Form W-4 (`W4_URL`, https://www.irs.gov/forms-pubs/about-form-w-4) in a new tab; with
  withholding estimated from pay, "Type your pay stub figure" sits beside it, outlined;
- no paycheck left, or nothing taken from pay: "Work out the payments" (Estimated payments);
- nothing to change on an estimate, or no paycheck figure typed: "Type your pay stub figure", which opens "What a paycheck
  withholds" in place, scrolls it into view and puts the cursor in its first box;
- about right on typed figures: no button (nothing to do).
Filing separately, the first return that owes (else the first with a refund) gives the change. Decided without the owner: the
external link is the real next step (the W-4 is handed to payroll, not filed in the app); the glossary and Our guesses
already link out the same way.
Review 2026-11-11: with no pay to take tax from (`noPay`, nothing withheld or estimated from pay) and tax to pay, or a bill
with no paycheck left this year, the button is "Work out the payments" (it asked a freelancer for a pay stub, and gave late
December no button). Filing separately, the note says the amount is under Each return.

## Simple first, and what to write on the W-4 or W-4P (gap #30 with opt C12, 2026-11-13)

**What a person sees by default** (`docs/OPTIONAL.md`; opt spec section 6, `taxes/withholding`, class B): the headline
("You would likely owe about $5,253 in April"), its one sentence with the W-4 change, the "estimated from pay" line and
any penalty line (never folded: R9), and one filled button (`firstMove`), with **"Print what to write"** outlined beside it
whenever the page gives a W-4 change. Filing separately, the "Each return" card stays in sight: it holds each return's
amount to write (the page's action, R9 item 2). Then one parts card and "More on this".

**One tap away** (`core/ui/more.js` `parts()`): "4 more numbers" (`more`: the tiles that were on the first view: the
year's tax, withheld by December, still to pay or refund, add per paycheck or could take home); "What a paycheck withholds"
(`own`, the title a guide step pins; shut unless the step, the person, "Type your pay stub figure" or its own Save opens
it; its status is "not set yet" or "N set by you"); "How this is worked out" (`how`: the three points that were the "How
the W-4 works now" card, plus one line on the W-4P). "More on this": the Paycheck page (only when someone has a salary) and
Estimated payments. The first view went from 390 words, 14 figures, 4 boxes and 2 filled buttons (family plan) to 186
words, 8 figures, no box and 1 filled button; the empty plan from 159 words to 44.

**After a save** the paycheck part stays open (R17) and the green line names the new answer when the headline changed
(R7, `nowHead`): "Paycheck figures saved. You would now likely get about $11,805 back."

**"Print what to write"** draws a sheet (the report kit's `reportFrame`, its print button outlined so the page keeps one
filled button) under the answer and prints it in place. It stays on the page through the redraw after a save on the same
visit (`sheetFor`, the route object) and not on a new visit. Nothing is written to the plan.

### The sheet (`w4Sheet(plan, d, { today })`, `w4Changes(d)`, `formFor`, `sheetRows`, `sheetNode`)
One form per earner whose W-4 the page changes (`w4Changes`: the same choice as the page, the typed figures' suggestion on
the first typed earner, else the estimate's on its main earner, filing separately each return's own), one W-4P per
pension; earners whose form does not change get one line ("Bo's W-4: no change needed."). Line by line:
- **Step 1(a)**: "Your name and address. Fill these in yourself." There is no line for Step 1(b): the plan keeps no
  Social Security number and the sheet never asks for one.
- **Step 1(c)**: the box for the filing status, as the form prints it (`W4_BOXES`).
- **Step 2** (W-4): the box in 2(c) is ticked only when the W-4 the page's figure is worked on has it ticked and there are
  exactly two jobs between you (and a joint spouse). With two jobs and the box empty, the line says checking it on both W-4s
  is the other way and that Step 4(c) then needs less; with three or more jobs, the IRS estimator (Step 2(a)).
  **Step 2(b)** (W-4P): (i) the yearly taxable pay from jobs, yours and a joint spouse's; (ii) the pensions that pay less than
  this one; (iii) the two added.
- **Step 3**: the plan's figure, children under 17 × the child amount of the year's tax tables (2,200 for 2026) plus other
  dependents × 500, and nothing when the year's income is over the child credit's line (200,000; 400,000 jointly). A cut
  (refund) adds `takeHomeMore`'s Step 3 figure, with January's whole-year figure.
- **Step 4(a)**, **4(b)**: as the W-4 the figure is worked on. 4(b) says that the page's figure already counts what the
  plan itemizes above the standard deduction and the deduction at 65 or older (so they stay out of 4(b): counted twice the
  paychecks would take out too little), and that tips, overtime pay and car-loan interest, which the page does not count
  yet, go through the form's page-4 worksheet.
- **Step 4(c)**: the page's own extra (`step4c.more` = the hero's "Ask for $X more"), and January's whole-year figure
  (`addJanuary`).
- **No withholding** (W-4P): "Leave it empty", or "Check it" when a whole year's withholding from the pension is not needed
  (a cut that takes all of it: `takeHomeMore`'s `all`, and January's figure at least a year of what it withholds).
- **Step 5**: sign and date, then give it to payroll (or send it to whoever pays the pension).

**Why Steps 1 to 4(b) are "the W-4 the figure is worked on"** (Builder chose). Step 4(c)'s extra is on top of what the
paychecks take out now; a new W-4 replaces the old one, so the rest of the form must stay as it is now or the extra would
be wrong (claiming 2,200 in Step 3 on a W-4 the estimate worked with Step 3 blank takes 85 less from each of 26
paychecks). So: for an earner whose withholding is estimated from pay, the W-4 the Paycheck page works it out with (its
status, two-jobs box, Step 3, 4(a), 4(b) and any extra, as typed there, else blank); for an earner whose figure was typed
from a pay stub, and every pension, "As on your W-4 now" with the plan's own figure beside it, and the form's lead line
says to copy Steps 1 to 4(b) from the form they have now (payroll or the payer can give a copy). Where the plan's Step 3
differs from the W-4 worked on, the line says what claiming it does: "could go here. That takes about $85 less from each
paycheck, so add $85 to Step 4(c) as well if you claim it" (the difference ÷ paychecks a year, IRS Pub. 15-T Worksheet
1A divides Step 3 by the pay periods).

**A pension's words** (P3): when the earner the change is on has a pension on the Income page and no pay (`formFor`), the
hero says "W-4P" and "payment", the button is "Get a new W-4P form" (`W4P_URL`), `step3Words(..., { pension })` and
`addJanuaryWords(..., pension)` say "payment", "pension payments" and "a W-4P stays until you change it". A job's words are
unchanged.

### Sources (read 2026-11-13, the forms themselves)
- **2026 Form W-4** (IRS, https://www.irs.gov/pub/irs-pdf/fw4.pdf, "Created 12/8/25"): Step 1(c) has three boxes ("Single or
  Married filing separately", "Married filing jointly or Qualifying surviving spouse", "Head of household"). Step 2(c): "If
  there are only two jobs total, you may check this box. Do the same on Form W-4 for the other job." "Complete Steps 3-4(b)
  on Form W-4 for only ONE of these jobs." Step 3: "If your total income will be $200,000 or less ($400,000 or less if
  married filing jointly): (a) Multiply the number of qualifying children under age 17 by $2,200; (b) Multiply the number of
  other dependents by $500". Step 4(b): "If you skip this line, your withholding will be based on the standard deduction."
  The Step 4(b) Deductions Worksheet has 15 lines: 1a qualified tips (up to $25,000, income under $150,000 / $300,000
  jointly), 1b qualified overtime (up to $12,500 / $25,000), 1c passenger vehicle loan interest (up to $10,000, income under
  $100,000 / $200,000), 3a and 3b $6,000 for each of you 65 or older (income under $75,000 / $150,000), 5 adjustments, 6a-6e
  itemized, 8-10 the limit on itemized deductions, 11 the standard deduction ($32,200 / $24,150 / $16,100), 12 cash gifts
  up to $1,000 ($2,000 jointly), 15 the total for Step 4(b).
- **2026 Form W-4P** (IRS, https://www.irs.gov/pub/irs-pdf/fw4p.pdf, "Created 12/4/25"; page https://www.irs.gov/forms-pubs/about-form-w-4p):
  the same Step 1(c) and Step 3 ($2,200 a child under 17, $500 another dependent, 3(c) other credits); Step 2(b)(i) the pay
  from all jobs, (ii) "other pensions/annuities that pay less annually than this pension/annuity", (iii) the total;
  "Complete Steps 3-4(b) on this form only if (b)(i) is blank and this pension/annuity pays the most annually"; "Submit a
  separate Form W-4P for each pension"; the **"No withholding"** box: "I request that no withholding be withheld from my
  payments"; the Deductions Worksheet has 17 lines (the W-4's, plus line 12 the extra standard deduction at 65: $2,050
  single or head of household, $1,650 married, $3,300 jointly when both are 65).
- The child amount the sheet uses is the tax tables' `childTaxCredit` for the year (`modules/taxes/federal/data/federal.js`:
  2,200 for 2025 and 2026), so it moves with the tables; the 500 is `OTHER_DEPENDENT` as both 2026 forms print it.

### Tests (`module.test.mjs`, "gap #30")
The sheet's Step 4(c) is the page's figure (estimated from pay, typed, each return filing separately); Step 2 ticked only
for two jobs (ticked, empty with two jobs, three jobs, one job); Step 3's figure, its "could go here" line and the income
line; the W-4P (its button, words, one form per pension with Step 2(b)(ii), No withholding left empty and ticked); the
W-4P sentences one per case (more per payment, the one payment left, a cut, January); no Social Security number line and
nothing written to the plan; invariance (compute's keys and answer unchanged, the sheet only reads; and, outside the suite,
`compute`, `taxAnswer`, `withholdingEstimate`, `projectedWithholding`, `firstMove`, `step3Words` and `addJanuaryWords`
byte-identical to bd8595f over 1,408 qa household plans and the fixtures on three days: 25,610 comparisons, 0
differences); the first view on the fake DOM (one filled button, Print what to write outlined, three parts shut, the sheet
after the tap); S11 and R7 after the paycheck Save.
