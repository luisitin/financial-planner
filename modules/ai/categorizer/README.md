# Categoriser  (`ai/categorizer`)

**Status:** usable (phase 3; built by claude-b from codex's idle lane)
**Purpose:** Categorises transactions in bulk with the AI, shows how confident it is about each and gives you a list to
review before anything is filed.

Next to `transactions/categorize` (one payee at a time, with rule and history suggestions and an optional AI button for
the first 40), this page asks the AI about every payee in questions of 40, can recheck what is already filed, and
shows the answers as a review list with how sure the AI says it is.

## Inputs
Plan sections read (`needs`): `transactions`, `rules`, `categories`. Writes (`writes`): `transactions` (category, clean
payee name), `rules` (one per filed payee).
Parameters accepted by `compute(plan)`: none.
The AI's answers are kept in the page (module state) until filed or the app is closed; they are never saved in the plan.

## Outputs
`compute(plan)` -> `{ total, transfers, open (not filed, not transfers), scopes: { open, all } (payees), questions: { open, all } }`.
Also exported: `groupsFor(plan, scope)`, `batches(groups)`, `promptFor(plan, batch)`, `readAnswer(plan, text)`,
`review(plan, groups, answers)` -> `{ rows, summary }`, `applyChoices(draft, choices, { uid, today })`, `band`, `keyOf`,
`BATCH`, `BANDS`, `SCOPES`.

## Formulas
No money math. The rules the page follows:
- **Payees** (`groupsFor`): "Not filed yet" = transactions with no category; "Recheck everything" = every transaction.
  Transfers between your own accounts (linked by `transferId`, or filed as "transfer") are left out. One group per
  payee: the bank's text (`rawPayee`, else the payee) with card codes, dates, digits and noise words such as "payment"
  or "pos" taken off (`transactions/rules` `normalizePayee`). Each group: count, total, money in (total ≥ 0), "filed
  as" = the category most of its transactions have, and "mixed" when they are filed more than one way (or some are not
  filed). Most transactions first, then the larger total.
- **Questions** (`batches`, `promptFor`): 40 payees each, in that order, one after another; a stop button ends after
  the question in flight. The question is the Categorise page's (`transactions/categorize` `buildPrompt`): the category
  ids with their names (transfers left out) and the payee texts, "(money in)" on those with money in; never amounts,
  dates or account names. The answer must be a JSON list of { payee, category, confidence }.
- **Answers** (`readAnswer`, the Categorise page's `parseSuggestions`): categories the plan does not know are dropped;
  a missing confidence counts as 0.5; confidence is kept between 0 and 1.
- **How sure** (`band`, `BANDS`): 0.8 or more "sure", 0.5 or more "fairly sure", under 0.5 "unsure". These cut-offs
  are the app's own choice; the confidence is the AI's own guess about itself, and the page says to check the unsure
  ones.
- **Review** (`review`): "the same as now" = filed one way only, and that way is the AI's; "not filed yet" = none of
  the group's transactions has a category; otherwise "filed differently". Order: answers that would change something
  first, surest first, then most transactions; the same-as-now ones last. "Needs a look" shows the answers that are not
  sure and the ones that would change what is filed.
- **Filing** (`applyChoices`): every transaction of the group gets the category; the bank's text is kept in `rawPayee`
  and the payee gets its clean name (`prettyPayee`). A rule (`ruleFor`: the first three words of the clean text, any
  account, any direction) files future imports: one with the same text and category gains hits; one with the same text
  and another category is changed to the new one (the person has just said what the payee is); otherwise a new rule is
  added. Counts returned: transactions whose category changed, payees, rules added and changed.
- **One tap** files only the sure answers for payees not filed yet, after a confirm; changing a category that is
  already filed is done row by row (the row's category can be changed before filing).

## Edge cases
- No transactions: a hero pointing to Import.
- Nothing left to file: says so and offers "Recheck everything".
- The AI helper off or not answering: a notice with Settings and the Categorise page; nothing else changes.
- The AI stops answering partway: the answers so far are kept, with a notice to ask again for the rest.
- An answer naming a category the plan does not have, or a payee it was not asked about: ignored.
- A broader rule earlier in the list (for example "amazon") still wins over a new, narrower one on import, as on the
  Rules page; the Rules page shows and reorders them.

## Tests
`module.test.mjs` (7): the payee groups for both scopes on the sample plan (transfers out, filed-as, mixed, money in,
the order, card codes not splitting a payee) and `compute`'s counts; questions of 40 and their contents (no amounts,
dates or accounts; no transfer category); reading answers (unknown categories, confidence capped, the 0.5 default,
broken answers); the confidence words at their edges; the review's order and summary; filing (categories, clean names,
the rule and the next import filed by it, hits, a rule changed, unknown categories skipped); filing a payee filed two
ways.

## Ideas / not yet
- The AI's reason for each answer (a short "why"), shown under the row.
- Learn from corrections: send the person's last few choices with the question as examples.
- Split a payee whose transactions belong in different categories (a supermarket that also sells fuel).
