# Plan critic  (`ai/critic`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Asks the AI to list the gaps and risks it sees in your plan, each linked to the page where you can fix it.

## Inputs
Plan sections read (`needs`): those the pages it summarises read (household, accounts, income, expenses, goals,
retirement, insurance, estate, assumptions). Writes nothing.
`compute(plan)` takes no parameters; `factSheet(plan, { today })` needs today's date (ages, the health score).
The AI's answer is kept on the page (module state, with the plan's `meta.updatedAt` when asked) until the app closes;
it is never saved.

## Outputs
`compute(plan)` -> `{ ready (an adult in the household), people, adults }`. The fact sheet is built only when the fold
opens or the person asks, because it runs the health score (about a tenth of a second on the family plan).
Also exported: `aliases(plan)`, `hide(text, plan)`, `restore(text, names)`, `factSheet(plan, { today })` ->
`{ lines, names, ready }`, `allowedPages(pages)`, `buildPrompt(lines, pages)` -> `{ system, user }`,
`readAnswer(text, pages, names)` -> `[{ title, why, page, level }]`, `MAX_POINTS`, `LEVELS`.

## Formulas
No money math: every figure the AI reads was worked out by another page.
- **The fact sheet** (`factSheet`), one line each:
  - the household: each person's stand-in and age (this year − birth year), the filing status and the state;
  - the health score (`overview/health-score`): the score and band, then each of its seven parts with its status
    ("fine", "needs attention", "a problem", "not known yet"), what it found and what would fix it;
  - the next-best-action steps (`overview/next-best-action`) marked "do now" or "check", with their detail;
  - the estate papers (`estate/documents`): how many of the required ones are done, the missing kinds, its warnings
    (a guardian for children, for example).
  A page that fails is left out; nothing else from the plan is sent.
- **Privacy** (`aliases`, `hide`, `restore`): adults become "Adult 1", "Adult 2" and children "Child 1"... in household
  order; each account's name becomes its kind ("the credit card"), longest names first, whole words only (so "Ana"
  does not touch "Anagram"). In the answer, "Adult 1" and the rest become the names again. The page shows the exact
  lines before asking ("What the AI will read").
- **The question** (`buildPrompt`): the facts and the pages the AI may point to (`allowedPages`: built pages,
  usable or partly built, not this one; key, title and purpose). It asks for a JSON list of at most 8 points
  `{ title, why, page, level: high | medium | low }`, most important first, using only the facts, no invented numbers
  and no named products.
- **The answer** (`readAnswer`): the first JSON list in the reply; points without a title, and repeats (any case, as the
  AI wrote them), are dropped; a page not in the allowed list becomes no page (the point stays, without a button); a
  level other than the three becomes "medium"; text is trimmed (200 characters for a title, 600 for why); at most 8.
  Levels in words: "Fix first", "Worth doing", "When you can".
- The answer is labelled as the AI's reading, not checked by the app, with the model's name when the provider gives
  it; when the plan changed after asking, the page says so.

## Edge cases
- No adult in the household: a hero pointing to People.
- The AI helper off or not answering: a notice with Settings and the Plan health score page (which checks the plan
  without the AI).
- An answer that is not a JSON list: a notice to ask again (a larger model may do better).
- A point naming a page that does not exist: kept, without a button.
- A provider other than the PC (Settings): the same fact sheet goes there; the fold's note says where the AI runs.

## Tests
`module.test.mjs` (6): stand-ins (order, whole words, possessives, account names, putting names back); the family's
fact sheet (household line, health score, parts, next steps, estate papers and warning; no person or account name, no
ids); allowed pages; the question's contents; reading answers (order, unknown pages, levels, names back, repeats,
untitled points, at most 8, broken answers); readiness.

## Ideas / not yet
- Show which fact each point rests on.
- Let the person mark a point as handled, so a later run says what changed.
