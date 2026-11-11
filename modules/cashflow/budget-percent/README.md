# Budget (50/30/20)  (`cashflow/budget-percent`)

**Status:** usable, phase 4 (built by claude-b from codex's idle lane)
**Purpose:** Splits what you take home after tax into needs, wants and savings, against the 50/30/20 rule or your own
split.

## Inputs
- `income[]` (cashflow/income: the active items a year), `expenses[]` (cashflow/expenses: each item's `essential`,
  "I must pay this", its amount a month, and `debtFromDebts`, the Debts page's minimum payments when Expenses lists no
  loan payments), `retirement.contributions[]` (retirement/contributions: your own money a year, not the employer's
  match), `goals[]` (goals/goals: `monthly` of goals not done).
- The Federal estimate's household (`taxes/federal` `taxInputs`: filing status, people, deductions, contributions; its
  income is replaced by the Income page's), the State page (`taxes/state`: `tax`, `agi`, `rate`, `method`), the Paycheck
  page (`cashflow/paycheck`: each earner's pay before and after the pre-tax benefits Social Security skips), the wage base
  (`retirement/social-security` `maximumEarnings`), `taxes/self-employment` `seTax` and the business expenses typed
  there (`whatIfs.selfEmployment.expenses`), the 20% deduction's 2026 minimum (`career/business` `QBI_MINIMUM`).
- `whatIfs.budgetPercent = { preset: "50-30-20"|"60-20-20"|"70-20-10"|"own", needs, wants, savings }` (fractions).
- Writes `whatIfs.budgetPercent`, and `expenses[].essential` ("Count as a need" / "Count as a want").

## Outputs
`compute(plan, { today })` -> `{ ready, missing, year, month: { gross, federal, payroll, state, stateKnown, afterTax (the
careful month), bizExpenses, held, heldGross }, targets: { needs, wants, savings, from, scaled }, buckets: [{ key, label, monthly, share, target,
targetMonthly, gap, status }], needs: [{ id, name, category, monthly }], wants, saving: { retirement, goals, leftover,
short, unlisted }, taxesListed, notes }`. `yearTaxes(plan, { today })` -> the year's `{ gross, federal, ss, medicare, se,
extraMedicare, payroll, state, stateKnown, afterTax, business: { gross, expenses, profit }, agi, otherIncomeOnFederal }`.
`heldAfterTax(plan, { today, inc, T })` -> `{ gross, tax, held }` a month (the careful month's part held back; below).

## Formulas
- **The rule**: needs 50%, wants 30%, savings 20% of income after tax (Elizabeth Warren and Amelia Warren Tyagi, "All
  Your Worth: The Ultimate Lifetime Money Plan", Free Press, 2005: the "balanced money formula"; a fact, no text taken).
  One departure from the book: it counts paying down debt beyond the minimum as saving; this page counts minimum loan
  payments as needs and leaves extra payments out of savings (see Choices made). The presets 60/20/20 and 70/20/10
  are the app's own example splits for high costs or getting by, not the book's; own shares, once all three are
  typed, are scaled to add up to 100%.
- **Income** = the Income page's items a year − the business expenses typed on the Self-employment page.
- **Social Security and Medicare** = for each earner, 6.2% of their pay (salary and bonus, less the pre-tax benefits the
  Paycheck page takes out before these taxes: HSA, health, FSA, commuter; IRC 3121(a)(5)(G), 125) up to the wage base
  ($184,500 in 2026) + 1.45% of it. Pay linked to no one counts as its own earner (its employer withholds to the base).
- **Self-employment tax** on each owner's profit (business income less their share of the expenses, by gross) after
  their pay (`seTax`: 92.35%, 12.4% to the base after wages, 2.9%; IRC 1401, 1402); business with no one is the first
  adult's, as on the Self-employment page.
- **The 0.9% extra Medicare tax** = 0.9% × (pay for Medicare + self-employment earnings − the filing status's line,
  $250,000 joint, $125,000 separate, $200,000 others), never below 0 (Form 8959 Parts I and II; IRC 3101(b)(2), 1401(b)(2)).
- **Federal income tax** (`core/math/tax.js` `federalTax`) on the Income page's income only: the Federal estimate's own
  wages from the Income page (`taxInputs` `wagesPlan`: pay less pre-tax 401(k) contributions, the health FSA and the child
  care account by its one rule, `careAccountRule`; never rebuilt here, review of 2026-11-02: with a 5,000 account Jo's
  Budget said 1,988 a year, the account back in wages and the credit gone, where the Federal estimate said 1,388), rent, pensions, dividends and interest (as ordinary), other income and the profit; Social Security
  benefits; half the self-employment tax off income (IRC 164(f)); the 20% business deduction = 20% × (profit − half the
  tax), at least $400 from 2026 when that is $1,000 or more (IRC 199A(a), (i)); the minimum is for a business you
  materially participate in (an "active" one, IRC 199A(i) and 469(h)), which the page assumes for a side business you
  run yourself; at most 20% of taxable income; after
  credits, so the refundable child tax credit can make it negative (a credit). Sales of investments and amounts typed on
  the Federal tax page are left out with a note: that money is not part of the month. The 0.9% is counted above.
- **The state** = the State page's tax ÷ its income × this income's AGI (as the Paycheck page does); 0 where the state
  has no income tax; not counted, with a note, when the State page cannot work it out.
- **Income after tax a month** = (income − federal − Social Security, Medicare and self-employment tax − state) ÷ 12.
- **Needs** = the expenses marked "I must pay this" (loan payments included, from the Debts page when Expenses lists
  none), a month. **Wants** = the other expenses. Taxes listed on Expenses are left out (they come off income already),
  with a note. **Savings** = your own retirement contributions + the monthly amounts going to goals not done + what is
  left over (after tax − needs − wants − those). Spending above income after tax leaves nothing over; the shortfall is
  said first, in amber, and the page never says "within your split" then.
- **Share** = the group ÷ income after tax; the target amount = the target share × income after tax; gap = the group −
  the target amount. Needs and wants are "over" above their share + 2 points; savings "under" below theirs − 2 points.
  With nothing left after tax there are no shares: the amounts only.
- **Left over above 10% of income after tax** is still counted as saved, with a note that unlisted spending usually
  explains it.

Debts kept only on the Debts page (2026-11-02): each is a need line by name ("Visa card payment (from Debts)") at its
required payment; the extra set on Debts pays the debt down faster, so it is saving ("extra on debts" under Savings),
as the 50/30/20 rule counts extra debt payments. `saving.debts`; left over = after tax - needs - wants - retirement -
goals - extra on debts. **The saved debt plan's extra** (Pay off debts' `debtPlan.extra`, review 2026-11-02, round 5) is
extra on debts too: `saving.debtPlan` = Pay off debts' `savedPlan(plan, { today })?.extra` (0 without one, or once the
debts it was aimed at are paid off), added to `saving.debts`. It is the one reading Next best action's left-over figure
takes (`spare.debtExtra`), not a copy: with the invented freelancer and a $150 extra this page said "about $1,200" and
"$770 short" while every other page said "about $1,050" and "$920 short"; now all say the latter.

**One definition, said on the page (owner's decision, 2026-11-07).** 50/30/20 keeps its own convention: money paid on a debt above
its required payment counts as **saving** here, as the rule counts it, and as spending on every other page (a $210 a month extra
moves a household's saving by $210 here against the app's year figure). The page says it in one plain line under the card:
"On this page, money you pay on a debt above its required payment counts as saving ... On the other pages the same money counts as
spending". No yearly figure is stated here, so no number on this page contradicts another page.

`yearTaxes` is also Next best action's tax for the month (2026-11-02), and `heldAfterTax` its careful month (review
2026-11-02), and the saved debt plan's extra the same `savedPlan` (round 5), so the left over here (left over − short) and
the app's left-over figure are the same number **unless** (review 2026-11-02, round 5, narrowed to what is true)
Expenses lists a tax (category "taxes", such as a property tax): this page leaves it out of needs, as it takes taxes off
income itself, while Next best action counts it as spending (Ruth and Sam: $400 a month, $2,528 here against $2,128).
**The full month**: `saving.full` = left over − short + `month.held`, what a month that brings the Income page's amount
leaves, and `saving.fullAbout` = `aboutTen(full)`, to the nearest $10, the one rounding every page uses for it (`aboutTen`
lives here beside `heldAfterTax`; Next best action imports it). The short-month notice says "about $X" with it.
**Just about breaks even** (round 5): `fullKind(full)` -> "ahead" ($5 or more left), "even" (within `EVEN_WITHIN` = $5 of $0,
my choice) or "short"; `saving.fullKind` here, `spare.fullKind` on Next best action, and every page that words the full
month reads it. "even" says "only just about breaks even" instead of "leaves about $0" or "about $0 short", and counts with
"short" (red where that is red), as good months then do not make up for lean ones.

**The careful month** (review 2026-11-02): side income above what you count on (Side income's "Count on $X a month",
`income[].countOn`) is not planned with. `heldAfterTax(plan, { today, inc, T })` -> `{ gross, tax, held }` a month: gross =
income's `heldMonthly`; tax = (federal + Social Security and Medicare + state, from `yearTaxes`, − the same with each
counted-on line typed as its careful figure a month) ÷ 12, never below 0; held = gross − tax. **Income after tax a month**
is then (income − the year's taxes) ÷ 12 − held, so needs, wants and savings are shares of the month you can count on,
while the tax lines stay the whole year's, as every tax page says them. The card names the held part ("Side income above
what you count on, after its tax ... is left out"); a short month says it counts uneven pay at what you can count on, and
what a month that brings the Income page's amount leaves. Before, this page split the full amount: a freelancer counting
on $4,400 of $7,100 read "Savings 22%, $1,197 left over" while the Dashboard said she was $770 short. Next best action
calls the same helper (it lives here, beside `yearTaxes`, because Next best action imports this module).

## Edge cases
- No income, or no regular spending (one-off and ended expenses, and taxes, do not count): an empty state naming what
  is missing, with buttons to the pages.
- No expense marked as a must-pay: everything counts as a want, with a note. Taxes taking all of the income: a note.
- Choices made: savings count your own money only (the employer's match is extra); extra debt payments above the
  minimum are not counted as saving (put them on Expenses or as a goal); self-employed health insurance and retirement
  plans are not taken off the business's tax here (the Small business page does that); the state's share is an average
  rate, not its brackets.

## Tests
`module.test.mjs` (13): the careful month (review 2026-11-02: the part held back after its tax by hand, at $300 and $0
counted on, the same left over as Next best action, shares on the careful month, no taxes to work again from); the rule, the presets, own shares scaled (and the rule until all three are typed), the plan's
preset; income after tax by hand (each person's Social Security and Medicare, self-employment tax, federal tax equal to
the Self-employment page's, no state in Texas); the wage base, pay linked to no one, the Paycheck page's pre-tax
benefits; business expenses, the 0.9% on self-employment earnings, a refundable child tax credit; one-off income on the
Federal page left out; needs, wants and savings with the shares, targets and gaps, a goal reached; taxes on Expenses
left out, the Debts page's payments as needs; over and under, and the 2-point slack at 51% and 53%; spending above
income; a state with income tax and no must-pay expenses; a state that cannot be worked out; not ready, one-offs only.

## Ideas / not yet
- The month's actual spending from the ledger instead of the Expenses page; extra debt payments counted as saving.
- Keep a property tax filed under taxes on Expenses among the needs (only income tax is taken off here), so the left over
  is always the app's left-over figure (review 2026-11-02, round 5; tested as a known gap in `module.test.mjs`). The saved
  debt plan's extra, the other gap, is counted since the second review of round 5.

## Child care account and separate returns, fourth pass (2026-11-02)
- **Money the account would lose** (`yearTaxes` `careLost`, `month.careLost`): the election beyond the care it can pay back
  (Form 2441 line 14: "You forfeited an amount if you didn't receive it because you didn't incur the expense") leaves the pay
  and never comes back, so it comes off the month after tax like a tax (the care it does pay back is on Expenses already).
  Jo (head of household in Ohio, 62,000) with a 5,000 account for 2026 and no care on Expenses: the tax falls 1,120, the
  5,000 is lost, so the month has 3,880 / 12 = 323.33 less (it showed 6 more). The page says "The child care account would
  lose $417 a month ..., so that is taken off too". Next best action takes the same.
- **Separate returns**: two returns, each with its own Income-page money (the Federal estimate's part `fromIncome`) and its
  owner's business at its profit, half its self-employment tax off that return's income (IRC 164(f)) and its 20% deduction
  (IRC 199A, 199A(i)'s floor), not the household's on the return of the adult marked "Me"; the 0.9% Additional Medicare tax
  on each return's own pay and self-employment earnings against 125,000 (Form 8959). The family with 3,750 each: 7,764.60 +
  5,500.37 + 1,017.33 = 14,282.30, no 0.9% (it said 14,439.15 with 341.54 of 0.9%); no accounts: 15,682.61. Pay or a
  business linked to no one is on Me's return. Filing jointly nothing changed.

## The month's tax counts what the Federal estimate knows about the same money (round 8 review, 2026-11-06)
- **What `yearTaxes` runs:** after building its Income-page return, it runs the Federal estimate's `rentalStep`, `iraStep`,
  `loanStep` and `qbiStep` (`taxes/federal/known.js`) on it:
  - the Income page's rent for a property on Rental analysis is counted after its costs, loan interest and depreciation,
    through the passive-loss allowance (IRC 469);
  - the traditional IRA deduction is limited as IRC 219(g) allows;
  - student loan interest comes off (IRC 221);
  - the 20% business deduction is cut by its income limits (IRC 199A(b)(3)).
- **What stays out:** this year's IRA withdrawals and stock pay. They are not in the month's money: the tax on a withdrawal
  is held back from it, and the tax on stock is held back in shares.
- **Examples** (`qa/fixtures/round8-households.mjs`):
  - the landlord's federal tax is 14,108 a year, 1,176 a month (it read 19,652, 1,640 a month);
  - the couple with student loans: 9,980 (it read 10,280);
  - the widow's stays on her pension and Social Security.
