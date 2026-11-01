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

### What a saved rule keeps (2026-11-01)
`ruleText(raw)`: the shop's own name, without what changes from one branch or card to the next. A star separates a payment
service from the shop (`payeeWords`: "PAYPAL *NETFLIX" -> "paypal netflix"; normalizePayee alone gives "paypal", which put every
PayPal shop under one rule). The line is cut at its first word with a digit or # (store numbers and codes); a trailing
two-letter state code is dropped; a line cut at a code keeps the words before it, two at most ("shell oil", "southwest airlines",
"kroger": a single word would also file Southwest Gas under travel); a line with a city and state but no code keeps a web address
alone ("netflix"), or one long word that is not a common first word (`COMMON_FIRST`: american, united, first, national...), else
two words; otherwise up to three words, as before. A first word that only says what kind of line it
is (transfer, zelle, payroll, paypal, sq...) keeps the first three words of the whole line.
Rules made this way carry `wholeWords: true` and match whole words only ("shell" never files "ZELLE TO SHELLEY"); a rule typed on
the Rules page still matches any part of the line, as before. The rule renames the payee to the words it matches on (`ruleName`:
"Kroger" for every branch, not "Kroger Dayton"; "Blue Bottle" for "SQ *BLUE BOTTLE", "Netflix" for "PAYPAL *NETFLIX"), and to the
old three-word name for a kind-of-line rule ("Transfer Sav").
Fewer than four letters left: the old rule (the first three words of the normalised line). "KROGER #0388 DAYTON OH" -> "kroger"
(it was "kroger dayton oh", which missed the card's "KROGER #0421" and another branch); "SHELL OIL 57442" -> "shell";
"NETFLIX.COM LOS GATOS CA" -> "netflix". `ruleFor` uses it, so the Categorise page and the AI categoriser save the same text.

## Edge cases
Empty `contains` never matches. Two rules matching the same line: the earlier one wins (order of creation). Removing a rule leaves already-filed transactions as they are.

## Tests
`module.test.mjs`: normalisation cases, matching with direction/account, apply with rename/hits/force/no mutation, ruleFor round trip, compute counts.

## Ideas / not yet
- Amount ranges, regular expressions, tags in the `then` part.
- Reorder rules; show which rule filed a transaction.
