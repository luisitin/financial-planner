# Tax documents checklist  (`taxes/documents`)

**Status:** usable, phase 6
**Purpose:** The forms to gather for your tax return, worked out from your plan, when each arrives, and a tick as each comes.

## Inputs
- `income[]` (active on today): salary and bonus lines give a W-2 per person; business a 1099-NEC or 1099-K;
  Social Security an SSA-1099; a pension a 1099-R; rent a line for your own records (Schedule E).
- `accounts[]` with a balance: savings a 1099-INT; brokerage the composite 1099 (DIV, INT, B); crypto a
  1099-DA; mortgage a 1098; student loan a 1098-E; HSA a 5498-SA and a 1099-SA; IRA and Roth a 5498.
  Checking and 401(k)s add nothing (the 401(k) is on the W-2).
- `insurance.health.plans` or `retirement.aca`: the marketplace's 1095-A.
- `household.people[]`: a dependent aged 17 or more by the year gives a 1098-T.
- `taxes.itemized.charitable` or `whatIfs.charitable`: receipts for gifts of $250 or more.
- Always: last year's return, the property tax bill.
- `taxes.extraDocuments[]`: documents you added, `{ id, form, from }`.
- `taxes.documents[year][key] = true`: the ones ticked as received.

## Outputs
`{ year, items: [{ key, form, what, from, due, why, received, own }], received, total, deadline }`.

## Formulas
- Tax year: last calendar year until April 15, then this year; the deadline is April 15 of the year after.
- Due dates (IRS instructions for each form): W-2, 1099-NEC, 1099-INT, 1098, 1098-E, 1098-T, SSA-1099,
  1099-R, 1099-SA, 1095-A by January 31; brokers' composite 1099 (with 1099-B) and 1099-DA by February 15;
  5498 and 5498-SA by May 31 (after the deadline, it only confirms the contribution).
- One form per key: two salary lines for one person give one W-2 (two jobs at two employers give two W-2s
  in life; add the second by hand).

## Edge cases
- An account at zero sends nothing. Interest under $10 sends no 1099-INT but is still income.
- Ticks are kept per year, so next year starts unticked.
- An added document with no name is ignored.

## Tests
`module.test.mjs`: the empty plan, the family's forms and due dates, one W-2 per person, the April 15 switch,
ticks per year, every other form's trigger, documents you add.

## Ideas / not yet
- Read a W-2 or 1099 with the AI reader and tick it, or fill the federal estimate from it.
- K-1s from partnerships and trusts when the plan has them.
