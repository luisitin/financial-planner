# Subscriptions  (`cashflow/subscriptions`)

**Status:** usable (phase 4)
**Purpose:** Every charge that renews by itself, what it costs you a year, and the ones to question.

## Inputs
Plan sections read (`needs`): `transactions` (through Bills and regular payments), `expenses` (category subscriptions), `recurringIgnored`. Writes: `recurringIgnored` ("Not a subscription").

## Outputs
`items[]` (`name`, `icon`, `source`, `cadenceLabel`, `amount`, `yearly`, `monthly`, `last`, `next`), `monthly`, `yearly`, `count`, `hasData`.

## Formulas
- A found payment counts when its category is subscriptions or its name matches `SUBSCRIPTION_WORDS` (streaming, phone, gym, apps...). Yearly = amount x occurrences per year.
- Typed subscriptions are added unless a found one has the same amount (within 0.50) and shares a word.

## Tests
`module.test.mjs`: found by category and by name, typed ones, no double counting, ordering and totals.

## Ideas / not yet
- "Last used" from the owner (a tap per item) and a yearly reminder to review.
