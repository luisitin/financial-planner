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
{ today })`, `shortNames(entry)` (the abbreviations shown beside a word), `askMessages(word)` (the question sent to the
AI helper), `sourceLabel(name)` (a source's name as shown), `norm`, `PLAN_WORDS`.

`data/terms.js`: `TOPICS` (six: taxes, retirement, investing, borrowing and home, everyday money, insurance and
estate) and `TERMS`, each `{ id, term, aka[], topic, plain, example, pages[], sourceName, sourceUrl }`.

## Formulas
No money math. The rules the page follows:
- **Search** (`search`): the query and every name are lower-cased, accents, apostrophes and punctuation taken off
  ("Today's" and "todays" alike; "401(k)" and "50/30/20" keep their marks). Matching is at the start of words only
  (after a space, "(" or "/"), so "w-2" does not find words that merely contain it. Score 100: the entry's own name
  equals the query; 95: an other name equals it; 85: its own name starts with it; 80: an other name starts with it;
  60: a word in a name starts with it; 40: every word typed starts a word of one name, in any order ("ira roth" finds
  Roth IRA); 20: every word typed starts a word of the definition or example (a one-letter word, such as the "w" of
  "w-2": the whole phrase must; a single letter alone searches names only). The query is tried as typed and with a
  simple plural made singular ("annuities" -> annuity, "taxes" -> tax, "trusts" -> trust; words over three letters).
  Highest first, then A to Z. Nothing typed, or only punctuation ("$", "?"): every word, A to Z.
- **Words for your plan** (`forPlan`, `PLAN_WORDS`): an account of a type adds that type's words (a 401(k) adds
  "401(k)", a mortgage "Escrow" and "Amortization", a credit card "APR" and "Credit utilization"...); business income
  adds "Self-employment tax"; any stock grant adds "Vesting", a share grant (`kind` "rsu", or none) "RSU", a stock
  option "Stock option" and "ISO" or "NSO" by its `optionType` (none counts as NSO), a purchase plan (`equity.espp`)
  "ESPP"; a child "Child tax credit"; an adult 50 or over (age = this year − birth year; a dependent's age does not
  count) "Catch-up contribution"; 60 or over "Medicare", "Full retirement age" and "Required minimum distribution".
  Each word once, in that order.
- **Short names** (`shortNames`): up to two other names that are abbreviations (a capital letter, then capitals or
  digits, 2 to 7 characters; form numbers such as "1099-NEC" are not) and not already in the word's name ("FICA"
  beside "Social Security and Medicare tax").
- **The list**: each word is one line (its name and short names) that opens on a tap; a search with three matches or
  fewer opens them all, and a word typed or tapped exactly is always open. Nothing typed: A to Z under a letter. An open
  word shows its meaning, "For example: ..." in smaller grey text, up to three buttons under "Where you meet it in the
  app:" (only pages that are built and turned on) and "Read more: <source>" with the agency spelled out
  (`sourceLabel`: CFPB -> Consumer Financial Protection Bureau, LII Wex -> Cornell Law School's legal dictionary...).
- **Asking the AI** (only when nothing matches and the AI helper is on; whether it is on is asked once per visit):
  `askMessages(word)` sends the word only (at most 80 characters, nothing from the plan) with an instruction to answer
  in two or three plain sentences with an invented example and no yearly dollar limits; the answer is shown labelled
  "not checked" and is never saved (AGENTS.md rule 5: the AI explains, the app's figures do not come from it). If the
  AI does not answer, the error shows with a "Try again" button.

## Where the words come from
Six writers (one per topic) read every page's `view.js` and `README.md` for the money words a layperson might not know,
and wrote each in plain words; a separate adversarial checker per topic then opened each cited source, fixed wrong
facts, removed yearly dollar figures, rewrote anything that read like a textbook and checked the pages listed
(workflow, 2026-10-30 to 31). The 221 entries were merged to one per word (the same word written twice for two topics
kept the clearer text and both lists of pages; names that two entries claimed were given to one). An independent
review (the code, the merged entries, a fact sample and a layperson read, each finding verified) then corrected 36
entries and added 15 words that pages show (Social Security, Mortgage, Withdrawal order, Modified adjusted gross
income, Treasury bills and bonds, money-market and high-yield savings accounts, HIPAA release, metal levels, PPO,
Equity compensation, donor-advised fund, qualified charitable distribution, backdoor Roth, sole proprietor), each new
source opened and read on 2026-10-31: 219 entries. COBRA continuation coverage was added the same day for the life
events page (20 or more employees, 18 or 36 months, up to 102% of the plan's cost, 60 days to choose: the Department of
Labor's "FAQs on COBRA Continuation Health Coverage for Workers", read 2026-10-31): 220 entries. Every entry cites one public source it was checked against: irs.gov
(with the Taxpayer Advocate), ssa.gov, medicare.gov, healthcare.gov, investor.gov, sec.gov, finra.org,
consumerfinance.gov, studentaid.gov, fdic.gov, bls.gov, dol.gov, treasurydirect.gov, usa.gov or law.cornell.edu (the US
Code, the CFR and Wex). Four entries rest one sentence on a second official page, because an entry holds one source:
Will (the beneficiary sentence: FINRA, "Plan now to smooth the transfer of your brokerage account assets on death"),
Cash value (the savings part of a permanent policy: FINRA, "Insurance"), Vesting (the 401(k) match: IRS, "Retirement
topics - Vesting") and Income-driven repayment (forgiveness may be taxed: the Edfinancial IBR and RAP pages). The
definitions are the app's own words; no text was copied.

Dollar figures stay out of the definitions because most change every year; the three kept are fixed in law and not
indexed: $3,000 of capital loss a year (IRC 1211(b)), the $1,000 estimated-tax line (IRC 6654(e)(1)) and $250,000 /
$500,000 of home-sale profit (IRC 121(b)). Examples use round invented numbers.

## Edge cases
- Nothing matches: says so; with the AI helper on, a button asks it (answer labelled not checked); off, a hint to try
  another spelling and that Settings turns the AI on.
- An empty plan: no "Words for your plan" card; the rest works the same.
- A deep link to an id that does not exist: the page opens as if no word was chosen.
- The search and topic last until the app is reloaded; coming back to the page shows the last search (so Back from a
  page an entry links to returns to it). A new word in the address (`#/ai/glossary/<id>`, or none after one) starts
  fresh.
- A search of punctuation only ("$", "?") counts as nothing typed.
- A page an entry points to that is not built yet, turned off or gone: its button is left out (the test checks every
  page exists; links to pages not built yet stay in the data, so their buttons appear once the pages are built).
- Typing filters the list only; nothing is saved and the plan never changes.

## Tests
`module.test.mjs`: the data's shape (unique kebab-case ids, no name claimed by two entries, plain at most 40 words,
example at most 30, a known topic, a source on a public site, no dollar figure in a definition except the three fixed
in law); every page an entry points to exists; **every money abbreviation in page titles, purposes, view text and
compute labels is explained**: capitals in every page's title and purpose, in every string of its view.js with two
words or more or a lone abbreviation (read by a small tokenizer that skips comments and regexes), and in its
compute.js `label: "..."` strings resolve through `find`, apart from a short list of non-money words (PC, CSV, tickers,
currency codes, the form number DD; DIME is allowed because the life-needs page spells it out). Data tables, fund
names and form numbers are not checked. So a new page with a new abbreviation fails until the glossary has it. Also:
the tokenizer itself; search ranking on fixed lists (each tier, own name before other name, ties A to Z) and the
review's probes ("w-2" one match, "todays dollars", "ira roth", plurals, "magi", "$"); the words for the family plan,
for every account type, for ages 49, 50 and 60 and a dependent, and for each kind of share grant; short names; the
question to the AI; source labels.

## Ideas / not yet
- A small "?" beside a word on other pages that opens its entry here (needs a shell change in `core/`).
- Spanish definitions.
- The AI's answer for a missing word offered as a draft entry for the owner to check and add.
