# Irregular expenses  (`cashflow/sinking-funds`)

**Status:** usable (phase 4)
**Purpose:** Yearly and one-time costs turned into a monthly amount to set aside so the money is there when the bill lands.

## Inputs
Plan sections read (`needs`): `expenses` (quarterly, yearly, one-time with a date), `transactions` (yearly/quarterly payments found by Bills and regular payments), `recurringIgnored`.
`compute(plan, { today })`.

## Outputs
`funds[]` (`name`, `icon`, `source` typed/found, `amount`, `period`, `yearly`, `monthly`, `next`, `monthsToNext`), `monthly`, `yearly`, `dueNext[]` (within 3 months), `hasData`.

## Formulas
- Quarterly and yearly typed items: monthly = yearly / 12. One-time items with a future date: monthly = amount / months until the date (at least 1). Past one-time items are dropped.
- Found yearly/quarterly payments are added unless a typed item has the same amount (within 1).
- Sorted by soonest next date, then by monthly amount.

## Tests
`module.test.mjs`: typed quarterly/yearly/one-time, a past one-time dropped, a found yearly payment, totals and the due-next list.

## Ideas / not yet
- Track how much is already set aside per fund (a linked savings account or a typed amount).
