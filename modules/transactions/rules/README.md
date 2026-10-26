# Rules  (`transactions/rules`)

**Status:** usable (phase 3)
**Purpose:** The rules that file transactions for you: when the description contains this, give it that category (and a readable name).

## Inputs
Plan sections read (`needs`): `rules`, `transactions`, `accounts`, `categories`. Writes: `rules`, `transactions` (when "file now" is pressed).
Rule shape: `{ id, contains, accountId? ("" = any), direction: "any"|"in"|"out", category, payee? (rename), hits, createdAt }`.

## Outputs
`compute(plan)` -> `{ rules[] (with categoryLabel, matches over current transactions), count, uncategorised, wouldFix, total }`.

## Formulas
- `normalizePayee(text)`: lowercase; drop `.com/...` web addresses, dates, `#`/`*` store codes, statement words (pos, debit, credit, purchase, ach, ...), any token with a digit, punctuation; collapse spaces. Both the rule text and the transaction text go through it, so "NetFlix.com" matches "NETFLIX.COM 866-579-7172 CA".
- `prettyPayee(raw)`: the first three words of the normalised text longer than two letters, capitalised.
- `matchRule(rule, tx)`: account (if set), direction (if in/out), then normalised contains over `rawPayee` and `payee`.
- `applyRules(rules, txs, { force })`: first matching rule wins; only uncategorised transactions change unless `force`; returns new objects (inputs untouched), `changed` and per-rule `hits`.
- `ruleFor(rawPayee, category)`: what the Categorise page saves: `contains` = first three normalised words, `payee` = prettyPayee.

## Edge cases
Empty `contains` never matches. Two rules matching the same line: the earlier one wins (order of creation). Removing a rule leaves already-filed transactions as they are.

## Tests
`module.test.mjs`: normalisation cases, matching with direction/account, apply with rename/hits/force/no mutation, ruleFor round trip, compute counts.

## Ideas / not yet
- Amount ranges, regular expressions, tags in the `then` part.
- Reorder rules; show which rule filed a transaction.
