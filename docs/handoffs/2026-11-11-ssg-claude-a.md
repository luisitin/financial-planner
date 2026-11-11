# Social Security lane (ssg): what is left in claude-a's pages (claude-c -> claude-a, 2026-11-11)

Someone of 62 or older who says on Get started (question 3) that they already get Social Security, or who has their
statement figure, and leaves the amount blank is now planned on our guess instead of $0. The figure is what retired workers
of that age get on average (SSA Annual Statistical Supplement 2026, Table 5.B9). These items are in your folders, so they
are left for you. Line numbers were checked on 2026-11-11 on the shared branch with the lane applied; your files were not
edited.

## What changed that your pages read

- "I already get it", blank: an Income line `setup-ss-<personId>` of type `social`, marked our guess in the ledger
  (`plan.guesses["income[setup-ss-<personId>].amount"].k === "overview/setup:ssPaid"`), plus the full-age amount worked
  back from it (`retirement.socialSecurity.<personId>.monthlyAtFRA`, key `overview/setup:ss`).
- "I have my statement figure" or "Not sure", blank: only the full-age amount (key `overview/setup:ss`), no Income line.
- `modules/cashflow/income/compute.js`: each item now carries `guessed: true` when its amount is our guess (read it rather
  than the ledger). `modules/retirement/social-security/compute.js`: each person carries `guessed`.

## Page by page

1. **cashflow/statement** (`modules/cashflow/statement/compute.js:6`, `computeIncome`): show the "Your Social Security"
   line as our guess while the Income item has `guessed: true`, as the Income page now does ("Our guess for now: tap to type
   what arrives").
2. **balance/statement** (`modules/balance/statement/view.js:78`, the foot note "Values as entered on Accounts"): when a
   Social Security line on Income is our guess, say so in the same foot note.
3. **taxes/state** (`modules/taxes/state/compute.js:11`, `NO_WAGE_TAX`, and the rate on adjusted gross income from line 65):
   more retirees now have a `social` Income line. Check that Social Security stays untaxed in the states that exempt it
   (most do; a flat rate on federal AGI taxes only the federally taxable part).
4. **taxes/filing-status** (`modules/taxes/filing-status/compute.js:63`): grid households g2067 and g2071 (an unmarried
   retired partner with Social Security) fail `pt.tax.partners-two-returns`; the partner's return should be worked out on
   its own, with their own Social Security.
5. **taxes/documents** (`modules/taxes/documents/compute.js:27`): already lists the SSA-1099 for each `social` Income line.
   Only check: a guessed line should still list the form (it does; the form's text could add "the amount is our guess").
6. **goals/emergency-fund** (`modules/goals/emergency-fund/compute.js:37`, `earners`): counts salary only, so a retiree on
   Social Security reads "no pay on file: plan for the longer end". Count a `social` (and pension) line as steady income for
   a retired household's months.
7. **balance/projection** (`modules/balance/projection/compute.js`): check that the guessed Social Security Income line is
   counted once, beside retirement/projection's own benefit (that page reads the Income line through `incomeSocial`).

## Also found in fix round 1 (not your pages, for whoever takes them)

- retirement/healthcare (`modules/retirement/healthcare/compute.js:108`, `underLine: c.multiple < 1`), read by
  retirement/projection's health line (`modules/retirement/projection/compute.js:1024-1027`): the verdict can get worse when
  retirement spending goes down. Grid household g2304 (Ohio, 65 working, partner 55, three children, $61,000): typed spending
  $3,090 is short at 76, $3,070 short at 72; base has the same cliff ($2,990: short at 71). In 2033 the plan's income for
  the marketplace is $27,557 (1.009 times the poverty line: credit $33,363, cost $593) or $27,317 (0.9999 times: no credit,
  cost $33,955). Under the poverty line a marketplace credit is not paid, but in a state that expanded Medicaid (Ohio did)
  the family is on Medicaid there, not on the full premium. The change: under 138% of the poverty line in an expansion
  state, price the year's cover at $0 (Medicaid) instead of the full premium. It moves typed plans, so it was not done in
  this lane (findings ssg-M-3, ssg-B-9).
- overview/setup + guesses envelope (g2328, Texas, 67, $31,000): typing utilities $100 lower refills the other guessed rows
  by $110 ($10 rounding on four rows), and from 50 the retirement figure weighs rows by the survey's 65-74 / 55-64 ratios, so
  it went $1,810 to $1,820 (short at 75 to 74). A rounding effect of $10; left as it is (see modules/overview/guesses/README.md).
