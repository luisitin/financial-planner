# Plan critic  (`ai/critic`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane; the review's fixes applied)
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
Also exported: `aliases(plan, { today })`, `accountAliases(plan)`, `hideTerms(people, accounts, { keep })`,
`hide(text, terms)`, `restore(text, names)`, `anonymise(plan, { today })` -> `{ plan, names }`, `plainWords(text)`,
`partLine(part)`, `papersLine(docs, adultCount)`, `factSheet(plan, { today })` -> `{ lines, names, related, ready }`,
`allowedPages(pages, related)`, `buildPrompt(lines, pages)` -> `{ system, user }`, `findList(text)`,
`readAnswer(text, pages, names)` -> `[{ title, why, page, level }]` or `null`, `cut(text, max)`, `MAX_POINTS`,
`MAX_TITLE`, `MAX_WHY`, `LEVELS`, `KIND_NOUNS`, `ALWAYS_PAGES`, `SOMEONE`.

## Formulas
No money math: every figure the AI reads was worked out by another page.
- **Hiding names at the source** (`anonymise`): the fact sheet is worked out on a copy of the plan in which
  - each person is their stand-in, by household order, named or not (`aliases`): adults "Adult 1", "Adult 2"...;
    a dependent "Child 1"... when under 18 or with no birth date (`core/math/dates.js` `ageOn`, the rule
    `estate/documents` uses for minors), else "Dependent 1"...; empty entries are skipped;
  - each account is its kind in plain words (`accountAliases`, `KIND_NOUNS`: "the credit card", "the Roth account",
    "the health savings account"; other kinds use their label with a small first letter), numbered in plan order when
    several share a kind ("401(k) 1", "401(k) 2") so the AI can tell them apart;
  - goal, income and expense names, the only typed text the pages write into their sentences, go through `hide()`.
  The pages then write the stand-ins themselves, so the app's own words ("Will", "Cash cushion", "Retirement on
  track", "A starter emergency fund") are never searched and replaced, and no figure changes (a test checks the
  score and every part's points). A probe that marks every name, label, note and title in the plan finds only goal
  names in the sheet.
- **Hiding typed text** (`hideTerms`, `hide`): people's whole names, then their first names (2 or more letters, when
  the first name is not someone's whole name), longest first; then account names (2 or more letters; not one that is
  a person's name, says nothing more than its kind such as "Mortgage", or is also a goal's name such as "Emergency
  fund", so that goal keeps its meaning). Whole words in any alphabet (`(?<![\p{L}\p{N}_])...(?![\p{L}\p{N}_])`
  with the `u` flag, so "Jo" is not found in "Joël"), any letter case, text normalised to NFC. A name or first name
  two people share becomes "someone in the household". People's names are swapped before account names, so an
  account named "Cy" cannot turn "Cy's college" into an account.
- **Putting names back** (`restore`): in the AI's answer, any letter case, the same whole-word guards, one pass, the
  name inserted as it is (a "$" in a name stays a "$"): "Adult 1" becomes the person's name; an account's stand-in
  keeps its words and gets the account's name after it ("the credit card (Visa card)"). Unnamed people, and
  accounts whose name says nothing more than the stand-in, stay as they are. The fold shows the key on screen only
  ("On this page Adult 1 is ...").
- **The fact sheet** (`factSheet`), one line each:
  - the household: each person's stand-in and age today (birthday-aware, `ageOn`), the filing status and the state;
  - the health score (`overview/health-score`): the score and band, then each of its seven parts with its status
    ("fine", "needs attention", "a problem", "not known yet"), what it found and what would fix it ("Could still
    improve" for a part that is fine, "To fix" otherwise; a leading "Still to do:" is dropped) (`partLine`);
  - the next-best-action steps (`overview/next-best-action`) marked "do now" or "check", with their detail;
  - the will and other legal papers (`estate/documents`, `papersLine`): how many of the required ones are done, then
    what is missing for whom ("Missing for each adult: ...", "Missing for Adult 2: Will.", "Missing for the
    household: Guardian for the children."; "HIPAA release" reads "Medical records release (HIPAA)"), then its
    warnings.
  A page that fails is left out; nothing else from the plan is sent.
  `related`: the pages those lines link to (the parts' and the steps' `go`) plus `ALWAYS_PAGES` (the documents
  checklist, the health score, next best action).
- **Plain words, for now** (`plainWords`): a few of the health score's builder phrases are said plainly in the sheet
  ("of gross income" -> "of pay before tax", "earns these points back fastest" -> "first helps most", "The plan can
  carry about $X a month against the $Y it plans" -> "In retirement your savings could pay about $X a month; the plan
  needs $Y", "(Goals)" -> "(see the Goals page)", "things the score leans on" -> "things the score needs", "assumptions
  looked over" -> "the app's guesses for inflation and investment growth looked over", the stress-test sentence ->
  "the Stress tests page shows how short each one is"). The better fix is at the source, in
  `overview/health-score/compute.js` (asked of its owner); a phrase that is no longer there is simply not found.
- **The question** (`buildPrompt`): the facts and the pages the AI may point to: built pages (usable or partly
  built), turned on, not this one, and only the `related` ones (about ten, key, title and purpose; the whole list of
  140 pages was most of a 24,000-character prompt). It asks for a JSON list of at most 8 points
  `{ title, why, page, level: high | medium | low }`, most important first, using only the facts and the stand-ins'
  words, no invented numbers and no named products. Sent with `options: { num_ctx: 8192 }`, which both routes pass to
  Ollama (the server's `/api/ai/chat` and the direct call), so a small default context window does not cut off the
  instructions and the facts.
- **Finding the list** (`findList`): a reasoning model's `<think>...</think>` (or everything up to a lone
  `</think>`) and ``` fences dropped; then the whole reply as JSON (a list, an object holding a list, or one point);
  else the first bracketed list that parses, scanning each "[" (at most 20) to its matching bracket while skipping
  brackets inside quoted text, so "[main]" in prose or "]" inside a title does not break it; `[[...]]` unwrapped.
- **The answer** (`readAnswer`): a plain string counts as a title; points without a title, and repeats (any case, as
  the AI wrote them), are dropped; a title or "why" that is not text becomes no text (a list of strings is joined);
  a page not in the allowed list becomes no page (the point stays, without a button; "#/" and spaces around a key are
  forgiven); a level other than the three (any case; never an inherited name like "toString") becomes "medium";
  text is cut to 200 characters for a title and 600 for why, on whole characters with "…"; at most 8.
  `[]` means the AI found nothing to flag; `null` means there was nothing readable (no list, or no usable entry).
  Levels in words: "Do now" (amber), "Do soon" (accent), "When you can" (grey).
- The answer is labelled as the AI's opinion, not checked by the app; the model's name, when the provider gives it,
  is a small line under the list; when the plan changed after asking, the page says so.

## Behaviour (view)
- One question at a time: the button is disabled from the first tap ("Checking the AI helper…", then "Reading your
  plan… this can take a minute"). A re-render while asking shows the disabled button and redraws when the answer
  comes. A render that is no longer on screen never redraws (`shown` counts renders and leaves; the shell's
  `#content` is shared by every page), so leaving the page while the AI thinks is safe.
- Messages wait in module state (`pending`) and show on the next render (AGENTS.md). "What the AI will read" stays
  open across the redraw when the person opened it.

## Edge cases
- No adult in the household: a hero pointing to People.
- The AI helper off, running with no model, or not answering: a different plain notice for each, with Settings (and,
  when it is off or not answering, the Plan health score and Next best action pages, which check the plan without it).
- The AI did not answer (an error): a plain sentence, Open Settings, and the technical text cut to 200 characters
  behind "Show details" (the owner's choice for errors, design log 2026-09-15); the raw error goes to the console.
- An answer with no readable list: "came back jumbled"; an earlier list stays on screen.
- An empty list: "The AI found nothing to flag", in green, with the reminder that the health score checks the same.
- A point naming a page that does not exist or is turned off: kept, without a button.
- Two people with the same name, an unnamed person, a dependent of 18 or more, an empty entry in People: see above.
- A provider other than the PC (Settings): the same fact sheet goes there; the fold's note says so.

## Not hidden (known)
- Goal names other than the people's and accounts' names in them (a place, a company, someone outside the
  household); the fold says goal names go as typed. Nicknames ("Cy" for "Cyrus") and surnames when the household
  holds full names are not hunted for in goal names either.

## Tests
`module.test.mjs` (20): stand-ins for people (order, unnamed, Child or Dependent, empty entries) and accounts
(kinds, numbering); hiding typed text (Joël, Zoë's, Anaïs, a separate accent mark, lower case, full and first names,
a one-letter name, shared names, an account named like a person, its kind or a goal, "$" in a name); putting names
back ("adult 1", "$&" and "$'" in names, "Adult 12", accounts with brackets); the family's fact sheet (exact household
line with Bo still 37, health parts, "Could still improve", legal papers per person, the warning); no person or
account name (escaped, whole-word) and no id of any record; the marker probe (only goal names go as typed); the same
score on the copy; Will, A, accounts named Cy, Retirement, Cash and Debt; full names and goals naming people and an
account; same-named, unnamed, 78-year-old and empty people; three cards; the papers line; plain words; the related
pages; the question; finding the list (prose brackets, an object of lists, `<think>`, fences, nesting, brackets in
quotes, one object); reading answers (order, pages, levels, names back, repeats, strings, odd values, empty vs
unreadable, at most 8); cutting on whole characters; readiness.
The view's one-at-a-time and leave-the-page behaviour is checked by driving the page (`tools/drive.mjs` with a
stand-in AI that answers late), not by a unit test.

## Ideas / not yet
- Show which fact each point rests on.
- Let the person mark a point as handled, so a later run says what changed.
- Optionally let goals go as "Goal 1 (education)"... for a household that chose an online AI service.
