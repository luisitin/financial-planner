# Explain this page  (`ai/explain`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Pick a page and the AI helper explains its numbers in plain words, with people's names hidden before
anything is sent.

The catalog first described a button on every page. That button needs a small change to the shell (`core/app.js`),
which is not this page's to make, so the page comes first: pick a page from the list (or arrive at
`#/ai/explain/<group>/<id>`, which picks it), optionally type a question, and ask. The button is proposed under
Messages in docs/WORKBOARD.md; it only has to link to `#/ai/explain/<group>/<id>`.

## Inputs
- The whole plan (`needs: ["*"]`): the chosen page's own `compute()` runs on it. Nothing is written (`writes: []`);
  the answer is kept in memory while the app is open and never saved.
- The AI helper through `ctx.ai` (`status()`, then `chat()` with a context of 8,192 tokens for a local model).

## Outputs
`compute(plan)` -> `{ ready }` (anything in the plan: people, accounts, income or spending). Also exported:
`digest(derived)`, `sheetFor(plan, run, { today })`, `explainable(pages)`, `buildMessages({ title, purpose, lines,
question, terms })`, `readAnswer(text, names)`, `words(key)`, and the limits `MAX_LINES` (80), `MAX_CHARS` (6,000),
`MAX_ITEMS` (6), `MAX_DEPTH` (4), `MAX_TEXT` (160), `MAX_QUESTION` (300), `MAX_ANSWER` (3,000), `SKIP`,
`NOT_OFFERED`.

## Rules
- **Names hidden at the source** (reused from `ai/critic`: `anonymise`, `hideTerms`, `hide`, `restore`): the page's
  compute runs on a copy of the plan where people are Adult 1, Adult 2, Child 1 (or Dependent 1 when 18 or over) and
  accounts are called by their kind ("the credit card", "401(k) 2"); goal, income and expense names have those names
  swapped too. Every line sent also goes through `hide()`, and so does the question typed. The answer comes back
  with the real names put back ("the credit card (Visa card)"). No number changes, only names.
- **What is sent** (`digest`): the page's compute result as lines, `path › key: value`, keys split into words
  (`sinceLastPct` -> "since last pct"). Each part's own numbers come first, then short lists of values, then inner
  parts, then lists of records, so the headline figures are never the ones cut. Numbers to the cent; yes/no; text cut
  to 160 characters. A list of records: how many, then the first 6, one line each (a field with a `<field>Label` next to
  it gives way to the label); a list already sent is named, not repeated; a list of more than 10 numbers: how many,
  first, last, lowest, highest. At most 80 lines and 6,000 characters, then a line saying the rest was left out.
- **Never sent** (`SKIP`): ids and links (`id`, `accountId`, `go`, `href`...), and free text and contact details
  (`note`, `notes`, `phone`, `email`, `address`, `last4`, `where`, `who`, `copy`), which could say anything about
  anyone. The fold "What the AI will read" shows every line, word for word, before you ask.
- **Pages offered** (`explainable`): built (usable or partly built), with a compute, turned on, not the system or AI
  pages, and not `household/contacts` or `household/documents` (other people's details; where papers are kept).
- **The question** (`buildMessages`): the AI is told to use only the numbers given and never invent any, not to work
  out new totals, rates or projections (and to say so when a question needs one), that fractions are rates, to use the
  stand-in names, plain words, no product recommendations, at most 200 words: what the page shows, what the main
  numbers mean, one or two things worth noticing. With no question typed: "What does this page tell me about my
  money?" A typed question is cut to 300 characters. Money math stays in the pages (AGENTS.md rule 5): the AI only
  explains numbers a page already worked out.
- **The answer** (`readAnswer`): a reasoning model's `<think>` part dropped, blank lines tidied, real names put back,
  cut to 3,000 characters; shown in paragraphs under "The AI on <page>", with "the app has not checked it: the numbers
  on the page itself are the ones to trust", a button to the page, and the model's name. If the plan changes after
  the answer, a notice says so.

## Edge cases
- Empty plan: "Nothing to explain yet" with a button to add the people.
- AI turned off, no model downloaded, not answering, an error (details folded for whoever set it up), an empty
  answer: a plain notice each, with Settings and the page's own button where they help.
- A page with no numbers yet ("Open it and fill it in first") or whose compute fails (the shell's `{ error }` counts
  too): said instead of sending nothing.
- One question at a time; the button says what is happening; a new answer scrolls into view once; a render that is no
  longer on screen never redraws.
- A heavy page (Monte Carlo) is worked out in the browser after "Reading the page…" shows.

## Tests
`module.test.mjs` (9): the digest (order, rounding, yes/no, words, keys left out, lists of records, labels, a
repeated list, long lists of numbers, the line and depth limits); what the AI reads for Net worth, Income and Goals
has no real names and the same figures; a failed or empty page; the pages offered; the question (names hidden,
default question, length); the answer (thinking dropped, names restored, tidy, length); compute.

## Ideas / not yet
- The button on every page (a link from the shell; proposed under Messages).
- Follow-up questions in a short conversation, the earlier answer kept.
