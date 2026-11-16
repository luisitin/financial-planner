# Small business  (`career/business`)

**Status:** usable, phase 10
**Purpose:** Tracks your small business's profit and loss, what you pay yourself and your self-employed retirement plans.

## Inputs
- The business on the Income page (`income[]` with `type: "business"`; the one chosen, else the largest): its yearly
  amount (what customers pay, unless typed here) and its holder. Review 2026-11-02, round 5: the one chosen is found by
  its chain too (cashflow/income `chainId`): once a raise from a later date saved on Income has started, the chosen line
  has ended and the new pay `continues` it, so the page stays on that business (it went to the largest other one), also
  after the ended half is removed. Test: `module.test.mjs`.
- `whatIfs.business = { name, incomeId, revenue, expenses: [{ id, name, category, amount, period }], drawMonthly,
  healthPremiums, homeOfficeSqft, miles, salary, scorpCosts }`. With no expenses typed here, the one figure typed on the
  Self-employment page (`whatIfs.selfEmployment.expenses`) stands in for them, so the two pages show the same profit.
- The household's federal tax (`taxes/federal` `taxInputs`, whose `year` sets the tax year of every figure here), the
  state's rate (`taxes/state`), the wage base, the Self-employment page's 401(k) room, the 401(k) limits.
- Writes `whatIfs.business`. "Use this profit on Income" (shown once revenue or expenses are typed here, with one
  business and a profit) sets the business's Income amount to the profit a month, keeps the revenue here, moves the
  Self-employment page's expenses figure into this page's expenses and sets it there to 0, so the federal estimate, the
  Self-employment page, the budget and the retirement projection all count the same profit.

- The kinds of expense (`CATEGORIES`): supplies, software, phone, marketing, travel, meals (half counts), equipment,
  insurance, contractors, fees, professional ("Accountant, lawyer, tax help") and education ("Courses for your work"),
  other. The last two before "other" came with the checklist below (2026-11-16): an expense saved under them was not
  possible before, so no plan changes meaning; both count in full.

## Outputs
`compute(plan, { today })` -> `{ ready, year, incomeId, name, person, revenue, revenueFrom, incomeYearly, expenses, typedTotal, notDeducted, homeOffice, miles, expensesTotal, profit, loss, margin, breakEvenMonthly, tax, keepMonthly, drawMonthly, draw, scorp, plans, best, earned, simpleComp, simpleLate, simpleLimit, job401k, qbiLimited, qbiLine, stateRate, notes, seExpenses, typedHere, singleBusiness }`.
Not ready (no business, no revenue): `{ ready: false, year, expenses, typedTotal }`, so expenses typed first still show.

## Formulas
- **Profit** = what customers pay − the typed expenses (each at its period a year; business meals count half, IRC
  274(n)(1); a negative amount counts as 0) − business miles × the year's IRS rate − the home office, simplified: $5 a
  square foot, at most 300 square feet, never more than the profit (Rev. Proc. 2013-13). The year's mileage rate weighs
  each rate by the days it was in force, the miles taken as spread evenly: 2026 = (181 × 72.5¢ + 184 × 76¢) ÷ 365 ≈
  74.26¢ (Notice 2026-10; Announcement 2026-11 from July 1, `side-income/data/rules.js`); 2025 = 70¢. Margin = profit ÷
  revenue; costs a month = (expenses counted + the half of meals not counted) ÷ 12.
- **The child and dependent care credit** (2026-11-02): its cap is the lower earner's earned income on a joint return (IRC
  21(d)(1)(B)), so the household without the business, the sole proprietor and the S corporation each work it again with
  the owner's earnings as worked here (`careAt`, federal `careInputsWith`): without the business only the owner's pay and
  other business income at its yearly amount; as a sole proprietor plus the profit less half the self-employment tax;
  through an S corporation plus the salary (and the health insurance in it), what passes through not being earned income.
  A business that is a spouse's only work then counts the credit it unlocks (Bo with no salary and 30,000 of profit).
  The same earnings decide how much of the other adult's child care account stays out of income (the account's one rule,
  `careAccountRule`): `careInputsWith` gives `wagesChange`, which each of the three adds to the wages it works (Bo with
  no salary and Ana's 5,000 account: without the business none of it stays out, 5,000 more wages; with 30,000 of profit
  all of it does; review of 2026-11-02).
- **As a sole proprietor** (`soleTax`): self-employment tax = 92.35% of profit × (12.4% to the wage base after the
  owner's wages + 2.9%), none under $400 (`taxes/self-employment` `seTax`). Half of it, the self-employed health
  insurance (up to the profit less half the tax and the retirement contribution, IRC 162(l)) and any retirement
  contribution come off income. The 20% business deduction = 20% × (profit − those) (IRC 199A; Treas. Reg.
  1.199A-3(b)(1)(vi)), taken after AGI by the federal engine (`qbiDeduction`), at most 20% × (taxable income before it −
  net capital gain, which counts qualified dividends; 199A(a), 1(h)(11)), and from 2026 at least $400 when that
  profit is $1,000 or more (199A(i), P.L. 119-21 section 70105; the business taken as one you work in). Income tax = the
  household's `federalTax` with the profit, less without the business (the Income page's business amount taken out of
  other income and of self-employment earnings). The refundable child tax credit counts profit − half the
  self-employment tax as earned income (IRC 24(d), 32(c)(2)). The 0.9% extra Medicare tax on Medicare wages + 92.35% of
  profit above the filing status's line. The state's rate on profit less half the self-employment tax and the health
  insurance. Keep a month = (profit + the home office − the half of meals not counted − all the tax) ÷ 12; what the owner
  takes out is compared with it. The home office comes back in (2026-11-16): it is a deduction for part of a home the
  household pays for anyway, not money out of the business, so typing it raises what is left by the tax it saves (the
  family's $7,200 of photography from Income with 150 square feet: $412 a month without it, about $434 with it, the tax
  $259 less; it said $371). Costs a month to break even = (the costs counted − the home office + the half of meals not
  counted) ÷ 12: the money paid out, not the office, which is capped at the profit and so never needs covering ($1,000
  coming in and 300 square feet: the profit is $0, $83 a month stays with the person untaxed, and nothing needs to come
  in to break even; it said $83 a month). **A deliberate exception to the invariance rule** (gap spec section 3 item 5;
  money critic F1, kept, the lead's call): these two figures, and the draw check that reads the first, move from
  a491122 for a plan with a home office typed, and only for one; with none, both are the old sums to the bit (test "the
  one deliberate change from a491122"). Kept because the checklist's Add on the home office would otherwise have told the
  person that typing it lowers what the business leaves.
- **A loss** as a sole proprietor comes off the household's other income (no self-employment tax, no 20% deduction)
  and off the earned income the refundable child tax credit is figured on (Schedule 8812's Earned Income Worksheet,
  IRC 32(c)(2)(A)): the tax figures turn negative, what the loss saves. Loss limits (basis, at-risk, excess business loss) and carrying a
  loss to another year are not modelled.
- **As an S corporation** (`scorpTax`): the owner's salary (typed; else 60% of profit, an example, said so) at most the
  profit; the corporation pays the employer's 7.65% on it (6.2% to the wage base + 1.45%), the running costs (typed;
  else $2,000 a year, an example) and the owner's health insurance (in the owner's pay for income tax but not for Social
  Security and Medicare, then taken off as self-employed health insurance up to the salary, the owner's Medicare wages
  from the corporation: Notice 2008-1, IRC 162(l)(2)(A)); the owner pays the employee's
  share (Social Security to the base after other wages, Medicare, the 0.9%). What is left passes through without
  self-employment tax, with the 20% deduction on it less the owner's health insurance deduction, which the IRS counts
  against the business's income again (Treas. Reg. 1.199A-3(b)(1)(vi); IRS section 199A FAQ 39: "QBI being reduced at
  both the entity and the shareholder level"); a loss passed through comes off other income. State tax = the
  state's rate × (salary + the premiums − the health insurance taken off + what passes through). Saving = the sole proprietor's taxes − (the S corporation's taxes + its
  running costs). The IRS requires reasonable pay for the owner's work before the rest is taken ("S corporation
  compensation and medical insurance issues", irs.gov).
- **Retirement plans** (IRS Publication 560): earnings = profit − half the self-employment tax. SEP-IRA = 20% of
  earnings, at most the 415(c) limit ($72,000 in 2026, $70,000 in 2025; Notice 2025-67). Solo 401(k) = 20% of earnings
  (the business's part) + the employee's deferral (the 402(g) room left after any 401(k) at a job, at most the
  earnings), together at most the 415(c) limit and at most 100% of pay, which for the self-employed is earnings less the
  business's part: deferral + business part ≤ (earnings + deferral) ÷ 2 (Publication 560's Deduction Worksheet steps
  9-15; IRC 415(c)(1), (c)(3)(B), 401(c)(2)), + the catch-up on top of that
  limit (from age 50: $8,000; 60 to 63: $11,250 in 2026), also out of the earnings left. A new one can be set up for a
  year until the tax-filing deadline; the owner's own part in its first year by the April deadline (IRC 401(b)(2),
  SECURE 2.0 section 317). SIMPLE IRA: pay = 92.35% of profit before any
  contribution (Schedule SE line 4); deferral = min(pay, the limit + the catch-up, the 402(g) room left + the
  catch-up), with the higher limits of a business with no more than 25 employees paid $5,000 or more the year before
  (2026: $18,100 and $3,850 from 50; 2025: $17,600 and $3,850; $5,250 from 60 to 63; IRC 408(p)(2)(E)(i)(I), Notice
  2025-67). The catch-up there is 110% of 2024's $3,500 (IRC 414(v)(2)(B)(iii)), the indexed $2,500 otherwise
  ((B)(ii)); from 60 to 63 the greater of $5,000 or 150% of 2025's ((E)(ii)). The match = the deferral, at most 3% of
  pay (IRC 408(p)(2)(A)(iii), (C)(ii)(I)); an employer may choose as little as 1% in at most 2 years out of 5
  ((C)(ii)(II)), which the page does not model. The higher limits need no 401(k) or other qualified plan for the same people in the three years before
  the SIMPLE IRA's first year (408(p)(2)(E)(iv)) and a plan document that allows them, and the 60-to-63 catch-up
  replaces the higher-tier one, never both (Treas. Reg. 1.414(v)-1, TD 10033). Catch-ups go by the age reached by
  December 31. A new SIMPLE IRA must be set up by October 1 for the year, for a business that never had one (one
  that had one before can start a new one only on January 1, and a business that begins after October 1 sets one up
  as soon as it can; IRS, "SIMPLE IRA plan", reviewed 2 Apr 2026, read 2026-10-31): after October 1 the row says it is
  for next year and counts no saving. The tax each saves = the sole proprietor's taxes
  again with the contribution off income, off the health-insurance limit and off the 20% deduction's base, less with.
  "Most room" is named only when one plan has strictly more than the others.
- **The 20% deduction's line**: above $403,500 joint / $201,750 others / $201,775 separate of taxable income before it
  (2026, Rev. Proc. 2025-32 section 4.26; 2025: $394,600 joint / $197,300 others, Rev. Proc. 2024-40 section 2.27) its wage and
  property limits can apply: a note.

## Edge cases
- No business on Income and no revenue typed: an empty state; expenses typed meanwhile are listed and can be removed.
- No expenses: a note that the profit is all revenue. Expenses only on the Self-employment page: one line for them.
- Several businesses: the one chosen (or the largest); the Income button only with one.
- A loss: "Loss" and what it saves; the retirement card says nothing can go in from the business.
- Choices made: the owner is taken to work in the business (the $400 minimum and no passive-loss limits), the higher
  SIMPLE limits apply (a one-person business has fewer than 26 employees; read from 408(p)(2)(E)(i)(I) and Notice 2024-2
  Q&A E-3, since no IRS text speaks of a business with no employees), catch-ups at a job's plan are not counted
  against the solo 401(k)'s.

## Tests
`module.test.mjs` (33; the 9 below the line came with the checklist): every headline and line case and the green line
after a save (`words.js`); the headline from the page's own figures; the checklist's rows and the two new kinds; every
state of every row with its sentence; the checklist from the page's figures (and that it writes nothing); the page drawn
on the stand-in DOM (the first view: the answer, the plans, four shut rows, no fold by hand, no box, one filled button;
moved, never deleted); the empty plan (one filled way to start, Save with nothing held back, the green line); a
checklist button opening The business with the box or the expense form and its kind, the amount held back, the green
line; S11 (a save keeps its row open, no other moves; the S corporation's Compare; Remove). Before:
`module.test.mjs` (20): the home office; the year's mileage rate; the profit and loss and a negative amount; meals at
half; the sole proprietor's tax by hand; the state's rate (Pennsylvania) for both forms, with health insurance; the tax
year from the Federal tax page (2025 figures); the wage base and the 0.9%; self-employed health insurance and its limit;
the 20% deduction's limit and its $400 minimum; the refundable child tax credit; a loss; an S corporation by hand and
its examples; a loss passed through and a bigger profit; the retirement plans and the October 1 deadline; plans never
above the earnings, the solo 401(k) within 100% of pay (Publication 560's worksheet), the SIMPLE match never above the deferral, a tie for most room; catch-ups at 55 and 62; a 401(k) at
a job; not ready with expenses kept, the Income page's amount, the Self-employment page's expenses.

## Answer key
`tests/golden-business.test.mjs` checks `soleTax`, `scorpTax` and `planRooms` against 4,000 rows worked independently
from the IRS forms and Publication 560 for 2025 and 2026 (`tools/golden_business`, `tests/golden/business/RULES.md`).
It found three errors, fixed above: the S corporation's 20% deduction did not take off the owner's health insurance
deduction; a loss did not lower the child tax credit's earned income; the solo 401(k) passed 100% of pay.

## On screen, simple first (opt spec 6.1, class C; done with gap list, next 60, item 6, 2026-11-16, claude-b)
The page adopted `core/ui/more.js` (docs/OPTIONAL.md); it draws no `<details>` by hand.
- **First view.** The hero says what happens to the person, one written sentence per case (`words.js` `answerFor`, a test
  each): "After tax, the business leaves you about $412 a month" (keep, and evenOffice: no profit for tax because the
  home office takes it, "The home office takes the profit for tax down to nothing, so there is no tax on it; the room is
  paid for anyway."), "... costs you about $40 a month" (shortMeals, shortTax, and evenMeals: "There is no profit for
  tax, but the half of business meals that does not count comes out of your own pocket."), "The business loses about
  $6,000 a year" (lossSaves, loss), "The business breaks even" (even: no profit and nothing left or short after it; it
  was said beside $83 a month left, money critic F2), "Your small business" (no business yet). Under it one line: "It makes $7,200 a year after costs, and about $2,255 of that goes to
  tax." (keep), "... and it brings no tax." (keepNoTax), "... and it lowers the household's tax by about $600."
  (keepLowers, the earned income credit), "... but the tax and the half of business meals that does not count come to
  more." (shortMeals), "... but what it adds to the household's tax comes to more." (shortTax), "The loss comes off the
  household's other income and lowers the tax by about $1,320; after that it costs you about $390 a month." (lossSaves),
  "There is no other income for the loss to come off this year, so it costs you about $500 a month." (loss), "What
  customers pay covers the costs with nothing left over, so there is no tax on it." (even). With what the owner takes out
  typed and within: "You take out $2,500 a month; that leaves $450 a month in the business." (`drawLine`). Then "Use this
  profit on Income" (the one filled button, when it is offered) with its line; the notices (the amber one when the owner
  takes out more than the business leaves); "As an S corporation you might keep about $1,234 more a year, after its
  running costs." only when it would save (`scorpWorth`, a hint worth money, never folded); "Retirement plans for the
  business": each plan's room ("up to $6,691", "too late now") and "Putting in the most saves about $1,238 in tax this
  year." (hints worth money, never folded); one card of quiet rows; "More on this" (four questions: the
  self-employment tax, paying during the year, where retirement savings go in, side income).
- **The rows** (shut on the first view): "Costs people often forget to count" (kind `more`, pinned title; status "4 not
  counted yet" / "nothing missing"), "The business" (own; the business's figures and, under them, its expenses; status "6
  set by you", "from Income", "not set yet"), "As an S corporation" (own, with a profit; the comparison and its two
  boxes; status "would save $1,234" / "would cost $1,479" / "about the same"), "How this is worked out" (how, "profit and
  tax": the year's profit line by line with its share of what comes in and the costs a month, the tax as a sole
  proprietor with what comes off income, each retirement plan's rules and deadlines, the earnings they count). Nothing
  was deleted: every sentence and figure that left the first view is in one of these rows.
- **The business's form** asks first for five boxes (what customers pay, the home office, the miles, the health
  insurance, what you take out; with several businesses on Income, which one, and what you take out folds; the home
  office and the miles carry a labelled example in their help line, "For example, a 10 by 12 foot room is 120.", "For
  example, 50 miles a week is 2,600 a year.", never grey text, which means a counted guess, person critic P4) and folds
  the name under "More details (optional)". Its expenses follow it in the same row: the list, then "+ Add another
  expense" (outlined), or the add form while there are none. The amount is held back at Save with "Type the amount
  first." rather than marked required (a required box may not sit in a shut row, S5).
- **After a save** the row saved in stays open with its green line naming the new answer (R7, `savedLine`): "Saved.
  After tax the business now leaves you about $434 a month.", "Photo course added. ...", "Equipment removed. ...", "Saved.
  As an S corporation you would now keep about $1,800 more a year."; no other row opens or shuts (S11 test).
- First view (`node qa/first-view-node.mjs career/business`, worst of the plan households, family): before 555 words, 32
  figures, 6 boxes, 4 tiles, 2 filled buttons; after 146 words, 8 figures, 0 boxes, 0 tiles, 1 filled button. Empty
  plan: before 143 words, 6 boxes, 2 filled; after 86 words, 0 boxes, 1 filled ("Add it on Income"). Inside the answer
  budget, so the page left `tests/first-view.known.json`.
- Builder's choices: the headline is what the business leaves the person after tax, not the S corporation's verdict the
  opt spec row suggested (R3: what happens to the person); the S corporation's saving is a worth line under it. The
  share of what comes in moved to "How this is worked out" so the first view keeps to eight figures. The business's
  status names the person's own state, not the revenue the hero already says. Five rows is the most a page may have
  (R12): the opt spec's four (The business, Expenses, S corporation figures, How) plus the brief's two would be six, so
  the expenses sit inside "The business".

## Costs people often forget to count (gap list, next 60, item 6; map P10; 2026-11-16, claude-b)
One quiet row (`costs.js` `checklist(d, s)`): an intro ("Costs the tax law lets a self-employed person count that are easy
to leave out. Nothing here is counted by itself: tap one that applies to put it where it goes."), nine rows, each with
what counts in one line and its state, and one line on where the rules come from. A row the page already counts says so
with the figure; a row not counted yet has one outlined button that opens "The business" where it is with the focus in
its box (the home office, the miles, the health insurance) or its expense form open with the kind picked (phone,
supplies, professional, education); nothing is saved until the person saves there, and nothing on this row writes the
plan. Status: "N not counted yet" (the rows with a button), else "nothing missing".

| row | what counts (on screen) | counted when / the sentence | where it goes |
|---|---|---|---|
| Home office | A space used only and regularly for the business: $5 a square foot, up to 300 square feet. | `homeOffice` > 0: "Counted: $750 for 150 square feet."; cut by the profit: "Counted: $600 of the $1,500 for 300 square feet: it counts only up to the profit." (money critic F5); typed but no profit for it: "It counts only up to the profit, so none this year." | box `homeOfficeSqft` |
| Business miles | Driving for the work at the IRS rate a mile, not the drive from home to a regular workplace; parking and tolls count on top. | `miles.amount` > 0: "Counted: $2,228 for 3,000 miles." | box `miles` |
| Health insurance you pay | Medical, dental and long-term care insurance for you and your family, for months no employer's plan could cover you. | `tax.health`: "Counted: $6,000 comes off income."; less than typed: "Counted: $4,647 of the $6,000: it counts only up to the profit."; none: "It counts only up to the profit, so none this year." | box `healthPremiums` |
| Retirement savings | What you put into a SEP-IRA, a solo 401(k) or a SIMPLE IRA for yourself comes off income. | earnings: "Not part of the profit: it comes off income. The plans and the tax each saves are above."; none: "No earnings from the business this year, so nothing can go in from it." | Retirement contributions |
| Half the self-employment tax | Half of the Social Security and Medicare tax on the profit comes off income; there is nothing to do. | `tax.se` > 0: "Counted by itself: $3,533 comes off income."; else "No self-employment tax this year, so nothing to take off." | (by itself) |
| Phone and internet | The business share of your phone and internet bills; never the base rate of a home's first landline. | kind phone typed: "Counted: $720 a year." | expense, kind phone |
| Supplies and software | Supplies, materials and postage used up in the year, and the software or subscriptions that run the business. | kinds supplies + software | expense, kind supplies |
| Accountant and lawyer | Fees for an accountant, a lawyer or tax advice for the business, and preparing the business part of your tax return. | kind professional | expense, kind professional |
| Courses for your work | Courses, books and seminars that keep up or improve a skill for the work you do now; not training for a new line of work. | kind education | expense, kind education |

Every row not counted says "Not counted yet." No figure here is new: $5 and 300 square feet are the page's
`HOME_OFFICE` (Rev. Proc. 2013-13, above), the mileage rate its `mileageYear`, the rest the page's own compute.

**Sources, read at irs.gov on 2026-11-16** (the rules, in the IRS's words):
- Publication 535 is discontinued: "We have discontinued Publication 535, Business Expenses; the last revision was for
  2022. Below is a mapping to the major resources for each topic. ... Worksheet 6A that was in chapter 6 is now new 2023
  Form 7206, Self-Employed Health Insurance Deduction." (irs.gov "Guide to business expense resources",
  https://www.irs.gov/forms-pubs/guide-to-business-expense-resources, page reviewed 27-Jun-2026; the old PDF address
  https://www.irs.gov/pub/irs-pdf/p535.pdf redirects there.) So the current source is Publication 334.
- Publication 334 (2025), Tax Guide for Small Business, https://www.irs.gov/pub/irs-pdf/p334.pdf: Business Use of Your
  Home ("Exclusive use. To qualify under the exclusive use test, you must use a specific area of your home only for your
  trade or business"; "Regular use ... on a continuing basis"); car expenses ("If you choose to use the standard mileage
  rate for a year, you can't deduct your actual expenses for that year except for business-related parking fees and
  tolls"; "Parking fees and tolls. In addition to using the standard mileage rate, you can deduct any business-related
  parking fees and tolls"; commuting between home and the main or regular workplace is personal); "Self-employed health
  insurance deduction. You may be able to deduct the amount you paid for medical and dental insurance and qualified
  long-term care insurance for you and your family"; Pension Plans ("If you are a sole proprietor, you can deduct
  contributions you make to the plan for yourself on line 16 of Schedule 1 (Form 1040)"); "SE tax. You can deduct
  one-half of your SE tax on line 15 of Schedule 1 (Form 1040)"; Legal and Professional Fees ("fees charged by
  accountants ... are deductible"; "Tax preparation fees. You can deduct on Schedule C (Form 1040) the cost of preparing
  that part of your tax return relating to your business"); Other Expenses You Can Deduct ("Education expenses",
  "Supplies and materials").
- Instructions for Schedule C (2025), https://www.irs.gov/pub/irs-pdf/i1040sc.pdf: line 17 ("fees charged by accountants
  and attorneys ... Include fees for tax advice related to your business and for preparation of the tax forms related to
  your business"), line 18 ("office supplies and postage"), line 22 (materials and supplies used in the year), line 25
  ("If you used your home phone for business, do not deduct the base rate (including taxes) of the first phone line
  into your residence"), "Technology and software tools. You can deduct technology and software tools that are ordinary
  and necessary expenses ... Generally, this will include tax preparation software and subscription services paid to
  manage your business. ... Most computer software expenses must be capitalized" (said on screen as "the software or
  subscriptions that run the business"; software bought outright is equipment).
- Publication 587 (2025), Business Use of Your Home, https://www.irs.gov/pub/irs-pdf/p587.pdf: the simplified method,
  "multiplying $5, the prescribed rate, by the area of your home used for a qualified business use. The area you use to
  figure your deduction is limited to 300 square feet."
- Publication 463 (2025), Travel, Gift, and Car Expenses, https://www.irs.gov/pub/irs-pdf/p463.pdf: parking fees and
  tolls on top of the standard mileage rate.
- Instructions for Form 7206 (2025), https://www.irs.gov/pub/irs-pdf/i7206.pdf: "You were self-employed and had a net
  profit for the year"; not for "any month you were eligible to participate in a health plan subsidized by your
  employer or your spouse's employer".
- Publication 970 (2025), Tax Benefits for Education, chapter 11, https://www.irs.gov/pub/irs-pdf/p970.pdf: "If you are
  self-employed, you deduct your expenses for qualifying work-related education directly from your self-employment
  income"; qualifying when "The education maintains or improves skills needed in your present work", but not when it
  "Is needed to meet the minimum educational requirements of your present trade or business, or Is part of a program of
  study that will qualify you for a new trade or business."
- Publication 560 (2025), Retirement Plans for Small Business, https://www.irs.gov/pub/irs-pdf/p560.pdf (the plans'
  rules above; contributions for yourself on line 16 of Schedule 1).
On screen the sources are one plain line: "From the IRS's tax guide for small business (Publication 334, 2025, which
replaced Publication 535) and its guides to the home office, cars, education and health insurance."

## Ideas / not yet
- A quarter-by-quarter profit and loss.
- The 20% deduction's wage and property limits above the line; the business's own retirement plan deadlines in the calendar.

## Separate returns, fourth pass (2026-11-02)
Filing separately the business is on its owner's own return (IRS Pub. 501; IRC 164(f), 199A): every change the page works
(the Income page's amount out, the profit, half the self-employment tax, the 20% deduction, an S corporation's salary) lands
on that return (the engine's `separateTo` = the owner), and the 0.9% is worked on that return's own Medicare wages against
125,000. The family filing separately with 3,750 each, Bo's photography: income tax +642.37, no 0.9%, 1,659.70 in all with
the 1,017.33 of self-employment tax (it said -406.32, 60 and 670.85: the business taken off Ana's return, where it was clamped).
Filing jointly nothing changed (2,255.01).
