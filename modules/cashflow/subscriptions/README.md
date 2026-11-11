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

## Wording follow-up (2026-11-07)

Each row says "$576 a year", not "$576/yr" (words, not abbreviations).

## Touch and input stress test (2026-11-11, claude-g)
- "Not a subscription" asks first and says what it did; "Hidden" at the bottom puts one back (F3; shared with Bills).
- A typed subscription opens its own form on Expenses with a way back; "Change these on Expenses" under the list (CF-5, F2).
  `items[]` of typed ones carry `expenseId`.
