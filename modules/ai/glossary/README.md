# Glossary  (`ai/glossary`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Explains every money word used in the app in plain words, with an example and the pages that use it, and
lets you search for any of them.

## Inputs
Plan sections read (`needs`): `accounts` (types), `income` (a business), `equity` (grants), `household` (children,
birth dates), only to pick the words for this household. Writes nothing.
Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD, for ages).
Route: `#/ai/glossary/<id>` opens one word (the search box is filled with its name and it is shown unfolded).

## Outputs
`compute(plan, { today })` -> `{ count, topics: [{ key, label, count }], mine: [entries for this household] }`.
Also exported: `search(query)` (entries, best first), `find(name)` (one entry by name or other name), `forPlan(plan,
{ today })`, `shortNames(entry)` (the abbreviations shown beside a word), `norm`, `PLAN_WORDS`.

`data/terms.js`: `TOPICS` (six: taxes, retirement, investing, borrowing and home, everyday money, insurance and
estate) and `TERMS`, each `{ id, term, aka[], topic, plain, example, pages[], sourceName, sourceUrl }`.

## Formulas
No money math. The rules the page follows:
- **Search** (`search`): the query and every name are lower-cased, accents and punctuation taken off ("401(k)" and
  "50/30/20" keep their marks). Score 100: a name or other name equals the query; 80: a name starts with it; 60: a word
  in a name starts with it; 50: a name contains it; 20: the definition or example contains every word typed. Highest
  first, then A to Z. Nothing typed: every word, A to Z.
- **Words for your plan** (`forPlan`, `PLAN_WORDS`): an account of a type adds that type's words (a 401(k) adds
  "401(k)", a mortgage "Escrow" and "Amortization", a credit card "APR" and "Credit utilization"...); business income
  adds "Self-employment tax"; a stock grant "Vesting" and "RSU"; a child "Child tax credit"; an adult 50 or over (age =
  this year − birth year) "Catch-up contribution"; 60 or over "Medicare", "Full retirement age" and "Required minimum
  distribution". Each word once, in that order.
- **Short names** (`shortNames`): up to two other names that are abbreviations (capitals and digits, 2 to 8
  characters) and not already in the word's name ("FICA" beside "Social Security and Medicare tax").
- **The list**: each word is one line (its name and short names) that opens on a tap; a search with three matches or
  fewer opens them all. Nothing typed: A to Z under a letter.
- **Asking the AI** (only when nothing matches and the AI helper is on): the word goes to the AI with an instruction to
  answer in two or three plain sentences with an invented example and no yearly dollar limits; the answer is shown
  labelled "not checked" and is never saved (AGENTS.md rule 5: the AI explains, the app's figures do not come from it).

## Where the words come from
Six writers (one per topic) read every page's `view.js` and `README.md` for the money words a layperson might not know,
and wrote each in plain words; a separate adversarial checker per topic then opened each cited source, fixed wrong
facts, removed yearly dollar figures, rewrote anything that read like a textbook and checked the pages listed
(workflow, 2026-10-30 to 31). The 221 entries were merged to one per word (the same word written twice for two topics
kept the clearer text and both lists of pages; names that two entries claimed were given to one). Every entry cites
one public source it was checked against: irs.gov (with the Taxpayer Advocate), ssa.gov, medicare.gov, healthcare.gov,
investor.gov, sec.gov, finra.org, consumerfinance.gov, studentaid.gov, fdic.gov, bls.gov or law.cornell.edu (the US
Code and Wex). The definitions are the app's own words; no text was copied.

Dollar figures stay out of the definitions because most change every year; the three kept are fixed in law and not
indexed: $3,000 of capital loss a year (IRC 1211(b)), the $1,000 estimated-tax line (IRC 6654(e)(1)) and $250,000 /
$500,000 of home-sale profit (IRC 121(b)). Examples use round invented numbers.

## Edge cases
- Nothing matches: says so; with the AI helper on, a button asks it (answer labelled not checked); off, a hint to try
  another spelling and that Settings turns the AI on.
- An empty plan: no "Words for your plan" card; the rest works the same.
- A deep link to an id that does not exist: the page opens as if no word was chosen.
- A page an entry points to that is turned off or gone: its button is left out (the test checks every page exists).
- Typing filters the list only; nothing is saved and the plan never changes.

## Tests
`module.test.mjs`: the data's shape (unique kebab-case ids, no name claimed by two entries, plain at most 40 words,
example at most 30, a known topic, a source on a public site, no dollar figure in a definition except the three fixed
in law); every page an entry points to exists; **every money abbreviation on screen is explained** (capitals in every
page's title, purpose and sentences in its view resolve through `find`, apart from a short list of non-money words such
as PC and CSV) so a new page with a new abbreviation fails until the glossary has it; search ranking and A to Z; the
words for the family plan, for someone 60 and for an empty plan; short names.

## Ideas / not yet
- A small "?" beside a word on other pages that opens its entry here (needs a shell change in `core/`).
- Spanish definitions.
- The AI's answer for a missing word offered as a draft entry for the owner to check and add.
