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

## Edge cases
No transactions: points to Import. Nothing uncategorised: "All filed". The AI turned off or unreachable: a plain notice, the page keeps working. Duplicate rule (same text, same category): hits are added instead of a second rule.

## Tests
`module.test.mjs`: grouping and ordering, history and rule suggestions, money-in flag, prompt contents (no amounts, no accounts, no transfer), answer parsing and rejection of unknown ids.

## Ideas / not yet
- Show the AI's reason per row; learn from corrections (`ai/categorizer` page for bulk runs with a review table).
