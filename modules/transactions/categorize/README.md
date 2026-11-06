# Categorise  (`transactions/categorize`)

**Status:** usable (phase 3)
**Purpose:** File the transactions that have no category yet, one payee at a time, with suggestions (rules, history, optionally the AI).

## Inputs
Plan sections read (`needs`): `transactions`, `rules`, `categories`. Writes: `transactions` (category, payee), `rules` (one per confirmed payee).

## Outputs
`compute(plan)` -> `{ groups[] ({ key, payee, rawPayee, count, total, ids, first, last, in, suggestion }), uncategorised, total, done, share }`.
`buildPrompt(plan, groups)` -> `{ system, user, max }`; `parseSuggestions(plan, text)` -> `{ [normalised payee]: { category, confidence } }`.

## How suggestions are made
1. A rule that matches the group's first transaction ("a rule matches").
2. Else the category the same normalised payee received before, most frequent wins ("N earlier were filed there").
3. Else, on request, the AI on the PC: the prompt lists category ids with meanings and the raw payee texts only (never amounts, dates or account names). The answer must be JSON; ids not in the category list are dropped. Confidence is shown; nothing is filed until the person picks or presses OK / "File all suggested".

Picking a category on a row files every transaction of that payee, renames the payee to its pretty form, and saves a rule (`ruleFor`) so next month's import files itself.

### Guesses from the line itself (2026-11-01, round 2 of the owner's experience list)
A first bank file had nothing to go on: every payee showed "Pick a category...". When no rule and no earlier filing says,
two guesses fill in, each marked `guess: true` and shown as "suggested" with its reason, confirmed with OK or the bulk button:
- `transferGuess`: money out to your own savings ("transfer ... sav", "to sav" or "to savings" as a whole word, so "ZELLE TO
  SAVANNAH" is not) when the plan has a savings account, or a card's payment ("crd" or "card" ... "autopay"/"pmt", "payment thank
  you"; never a line that says loan, mortgage or credit union, which are loan payments and count as spending) when it has a credit card: "Transfer between my accounts", so it is not counted as
  spending (the repo's sample file counted $500 moved to savings and a $640 card payment as August spending).
  Since 2026-11-02 also money in on a card account (every line of the group on a card, Ledger `isCardAccount`) with a
  payment's words (payment, pymt, pmt, autopay, epay) and no refund, return, reversal, cash back, reward or interest in it:
  the card's own line for the payment from checking ("AUTOMATIC PAYMENT - THANK"), "it looks like a payment to the card from
  your other accounts". Unfiled, it counted as $8,041 of income once the sample family's Visa file was in.
- `shopGuess`: a short list of well-known shops and billers (`SHOPS`: grocers, fuel and rides, streaming, coffee and fast food,
  phone and internet, power, insurers, pharmacies), matched on whole words of the normalised line ("shell" is not "Shelley"),
  longest name first across the kinds ("uber eats" is eating out before "uber trip" is a ride), and only names that are one kind of
  business ("frontier comm", not "frontier", an airline too; "spectrum internet", not "spectrum", a health system too).
- Payees are grouped by `payeeWords`, so "PAYPAL *NETFLIX" and "PAYPAL *EBAY" are two rows and two rules. The "Filed N
  transactions" confirmation shows on the next render whatever it is, "All filed" included, and only once.
  Shops that sell everything (Target, Amazon, Walmart) are left out on purpose. The list is my own, from common US brands.
The bulk "File all N suggested" confirms in green with the count. The AI button shows only while the AI helper answers.

## Edge cases
No transactions: points to Import. Nothing uncategorised: "All filed". The AI turned off or unreachable: a plain notice, the page keeps working. Duplicate rule (same text, same category): hits are added instead of a second rule.

## Tests
`module.test.mjs`: grouping and ordering, history and rule suggestions, money-in flag, prompt contents (no amounts, no accounts, no transfer), answer parsing and rejection of unknown ids.

## Ideas / not yet
- Show the AI's reason per row; learn from corrections (`ai/categorizer` page for bulk runs with a review table).
