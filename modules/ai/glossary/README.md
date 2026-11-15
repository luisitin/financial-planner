# Glossary  (`ai/glossary`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane; two-minute lessons and Velocity banking
2026-11-15, gap list items 13 and 59)
**Purpose:** Explains every money word used in the app in plain words, with an example and the pages that use it, and
lets you search for any of them. Behind the 20 words met on the most pages, and behind Velocity banking, one quiet row
more: "A two-minute lesson".

## Inputs
Plan sections read (`needs`): `accounts` (types), `income` (a business), `equity` (grants), `household` (children,
birth dates), only to pick the words for this household. Writes nothing.
Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD, for ages).
Route: `#/ai/glossary/<id>` opens one word (the search box is filled with its name and it is shown unfolded);
`#/ai/glossary/<id>?show=lesson-<id>` also opens its lesson (the helper's landing, once per arrival).

## Outputs
`compute(plan, { today })` -> `{ count, topics: [{ key, label, count }], mine: [entries for this household] }`.
Also exported: `search(query)` (entries, best first), `find(name)` (one entry by name or other name), `forPlan(plan,
{ today })`, `shortNames(entry)` (the abbreviations shown beside a word), `askMessages(word)` (the question sent to the
AI helper), `sourceLabel(name)` (a source's name as shown), `norm`, `PLAN_WORDS`; for the lessons `lessonOf(entry or
id)` (the lesson or null), `lessonWords(lesson)` (its length), `metOn(entry, isBuilt)` (pages it is met on, the count
below) and `LESSON` (the words around a lesson: "A two-minute lesson", "What it is", "Why it matters to you", "An
example", "Try it with your own numbers:", "Sources:"). `compute()` is unchanged.

`data/terms.js`: `TOPICS` (six: taxes, retirement, investing, borrowing and home, everyday money, insurance and
estate) and `TERMS`, each `{ id, term, aka[], topic, plain, example, pages[], sourceName, sourceUrl }`.
`data/lessons.js`: `LESSONS`, each `{ id (the word's), page ("group/id", the one page linked), what[], why[], example[]
(paragraphs), sources: [{ name, url }] }`. No plan field: the lessons are reading only (docs/DATA_MODEL.md unchanged).

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
Labor's "FAQs on COBRA Continuation Health Coverage for Workers", read 2026-10-31): 220 entries. Velocity banking was
added 2026-11-15 (see "Velocity banking" below): 222 entries. Every entry cites one public source it was checked against: irs.gov
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

## Lessons (gap list item 13, 2026-11-15)
**What a person sees.** The first view is as before. A word's row opens on its meaning and "For example: ..." as
before; for 20 words a quiet row "A two-minute lesson" sits under the example, shut. Opened, it reads in three parts
with a small heading each, "What it is", "Why it matters to you" and "An example" (an invented household's round
figures with the sum written out), then "Try it with your own numbers:" and one outlined button to the page where the
word is used (left out when that page is off or not built), then "Sources:" with a link per public source of its rules.
Then, as before, "Where you meet it in the app:" and "Read more". 250 to 350 words each (259 to 274 today). Nothing is
saved and nothing asks for a figure.

**The markup.** Each word's row and each lesson are parts of `core/ui/more.js`, kind `item` (a list row that opens:
only a tap opens it, never remembered across visits, never opened by Settings' switches, not counted among a page's
five parts; docs/OPTIONAL.md R11 allows "a list whose rows open (... the glossary)"). Importing the helper makes the
page an adopted one for the first-view check, which refuses hand-written `<details>` (S10), so the word rows were
changed from hand-written `<details>` to `part()` with the same title, status (`shortNames`) and words; `id="gl-<id>"`
is kept for the search's scroll and focus. The lesson's body is built with the page (not lazy), so find-in-page and
printing reach it.

**Which words, and how they were counted.** Other pages do not link to single words (only `system/methods` links to
the glossary as a whole), so the links counted are the glossary's own between a word and the pages that use it: the
built pages (status not "planned") in its "Where you meet it in the app" list (`metOn`). A scan of every page's view.js
for each name was tried as the count and was too noisy to rank by ("SAVE" matched 122 pages, "will" 73); it serves only
to break ties at the cut: how many built pages' view.js show one of the word's names, whole word, any case. Counted
2026-11-15 at 3c0b8a1, 221 words:

| word | pages | | word | pages |
|---|---|---|---|---|
| Today's dollars | 33 | | Inflation and the CPI | 14 |
| Federal income tax | 33 | | Emergency fund | 14 |
| Tax bracket | 21 | | Taxable income | 14 |
| Health savings account (HSA) | 20 | | Net worth | 13 |
| Deduction | 19 | | Tax credit | 13 |
| Stock | 18 | | Adjusted gross income | 13 |
| Taxable account | 17 | | Gross and net | 12 (shown on 68 pages) |
| Filing status | 16 | | 401(k) | 12 (32) |
| Social Security and Medicare tax | 16 | | IRA | 12 (27) |
| Bond | 15 | | *Capital gain, Marginal tax rate* | *12 (8, 4): no lesson* |
| Interest rate | 14 | | | |

The test keeps this true: every word met on more pages than the cut (12) has a lesson, and at the cut the words with a
lesson are shown on at least as many pages as those without; a word that passes a lesson word later fails it, so it
gets a lesson too. The other 201 words keep their one-line meaning, unchanged.

**The one page each lesson links to.** Today's dollars: Will the money last?; Federal income tax, Deduction, Taxable
income, Tax credit, Adjusted gross income: Federal estimate; Tax bracket: Bracket explorer; HSA: HSA and FSA; Stock,
Bond: Allocation; Taxable account: Asset location; Filing status: Filing status compare; Social Security and Medicare
tax, Gross and net: Paycheck; Interest rate: Pay off debts; Inflation and the CPI: Assumptions; Emergency fund:
Emergency fund; Net worth: Net worth; 401(k), IRA: Retirement contributions.

**Where a lesson starts.** The word's meaning and "For example: ..." sit just above the lesson, so "What it is" starts
where they stop: it never opens by saying the meaning again (found on a phone, 2026-11-15: the openings repeated it,
some word for word). The test holds every lesson to it: under half of the first sentence's three-word runs may appear
in the meaning and example, and no run of ten words of them may appear anywhere in the lesson.

**Where each rule and figure comes from.** A lesson states a rule or a figure only from a source below, or says it as
an example ("say the deduction is $15,000 (a round figure; the Federal estimate uses this year's)"). No yearly dollar
limit appears in a lesson (they change every year and live on the pages that use them, as for the definitions); the
only dollar figures in what a lesson explains are the lines of the extra 0.9% Medicare tax, fixed in law and never
indexed (IRC 3101(b)(2), 3102(f)): your employer withholds it on one job's pay past $200,000 in a year, whatever your
filing status, and what you owe starts above $250,000 of a couple's combined pay filing jointly, $125,000 each filing
separately and $200,000 for anyone else, settled on the return (IRS Topic 560, updated 2026-11-09, read 2026-11-15; a
couple paid $115,000 each owes none of it). The test holds the lesson to all three lines. irs.gov pages read 2026-11-15
(each also listed under its lesson on screen):
- Taxable income (most income counts unless the law exempts it; the kinds), Definition of adjusted gross income (gross
  income minus the adjustments of Schedule 1; before the standard or itemized deduction; the adjustments listed:
  educator expenses, deductible HSA and IRA money, deductible self-employment tax, student loan interest; needed to
  confirm identity when you e-file and for credits; Form 1040 line 11; tax software works it out; last year's return).
  The 2025 Form 1040 puts it on line 11a ("This is your adjusted gross income"), repeated as 11b on page 2
  (irs.gov/pub/irs-pdf/f1040.pdf, read 2026-11-16); returns up to 2024 have it on line 11. So the lesson says "line 11a
  on the 2025 form (line 11 on earlier years' forms)", since last year's return is the 2025 one, and the test holds any
  form line a lesson names to the year of its form.
- Credits and deductions for individuals (a credit comes off the tax, some are refundable; the credits listed; a
  deduction comes off income; most take the standard deduction; itemize when it is larger; answer questions in tax
  software or attach a form), Topic 501 (the standard deduction by filing status, more at 65 or older or blind,
  adjusted for inflation each year; what itemized deductions include, with limits).
- Federal income tax rates and brackets (layers; only the part in a higher band pays its rate; 10%, 12%, 22%, 24%,
  32%, 35%, 37%; the 2025 single bands, 10% to $11,925 and 12% to $48,475, which the examples' round $12,000 and $48,000
  stand near; inflation adjustments each year).
- 401(k) plans (deferrals left out of taxable income except Roth; employer money; withdrawals taxed except qualified
  Roth), Topic 558 (10% extra tax before 59½; rollovers are not taxed), Traditional IRAs (may be deductible by filing
  status and income; not taxed until taken out), Roth IRAs (not deductible; qualified withdrawals tax-free; as long as
  you live; one combined limit; limited by modified AGI).
- Topic 409 (more than a year is long-term; lower rates, most no higher than 15%), Publication 550 (reinvested
  dividends are still income), Publication 969 (a high-deductible plan, which pays no benefits before its deductible
  is met, preventive care aside; no other health coverage, not enrolled in Medicare; deductible, earnings tax free,
  medical withdrawals not taxed; carried over; portable; 20% extra tax off medical, none after 65, disability or
  death), Publication 501 (five statuses; married or not on the last day of the
  year; status sets the standard deduction and the tax; pick the lowest tax; head of household's tests, lower rates and
  a larger standard deduction; the box near the top of Form 1040), Topic 751 (6.2% and 1.45% each side; the wage base;
  no cap on Medicare; the extra 0.9% withheld past $200,000 whatever the filing status, with no employer match; the
  Federal Insurance Contributions Act; old-age, survivors and disability, hospital insurance), Topic 560 (the extra
  tax's lines by filing status: $250,000 married filing jointly, $125,000 married filing separately, $200,000 for all
  others; the employer's withholding past $200,000).
- From each word's own source, read by the glossary's writers on 2026-10-30 and 31 and not re-read this session
  (consumerfinance.gov, bls.gov, investor.gov and finra.org are refused by this session's network): constant dollars
  and the CPI (BLS), stocks and bonds (Investor.gov), the brokerage account (FINRA Buying and Selling), net worth (FINRA),
  the interest rate against the APR, the emergency fund and gross and net (CFPB).
- The app's own READMEs: 3% inflation, 7% stocks, 4% bonds, 15% yearly swings, the chips 2.5% and 4% (system/assumptions,
  "The ten assumptions and their sources"); today's dollars = amount ÷ (1 + inflation)^years (core/math/finance.js
  `deflate`); interest a month = balance × rate ÷ 12 and the highest-rate-first order (debt/payoff, core/math/payoff.js);
  the card's months and interest at $150 and $250 a month (core/math/finance.js `amortization`); the emergency fund's 3 or
  6 months, 3 more for pay that goes up and down, at most 12, from must-pay bills (goals/emergency-fund); a 401(k) is
  still pay for Social Security and Medicare, IRC 3121(v)(1)(A) (cashflow/paycheck); a lender's debt-to-income ratio over
  gross monthly pay (debt/ratios).

**The examples' households** are the invented ones of `qa/fixtures`: Ana and Bo (family-plan: Ana paid $3,900 every two
weeks, Bo $5,200 a month, $18,000 in a brokerage account, the balances behind the net worth example), Riley
(renter-debt-plan: $39,000 a year, the Visa card's $4,500 at 29% with a $150 minimum, about $2,400 of must-pay bills a
month, 6 months) and Ruth and Sam (retired-couple-plan); Jordan, the teacher of the adjusted gross income example, is
invented for it. The test reads those fixtures, so a lesson's "real" figures follow them.

## Velocity banking (gap list item 59, 2026-11-15)
**The word.** `velocity-banking` (topic borrowing; other names "chunking", "mortgage chunking", "HELOC payoff method"):
"A method sold as a way to pay off a mortgage years sooner: your pay goes into a line of credit, your bills are paid
from it, and large sums from the line go onto the mortgage." For example: "With $1,000 left over each month, sending
that $1,000 straight to the mortgage as an extra payment pays it off about as soon, with no second loan." `pages` is
empty: no page of the app uses the word (the lesson's one link is the Mortgage page, whose "Extra each month" box is the
extra payment; the Mortgage page has no part for it to land on, so the link opens the page). Its source is the CFPB's
HELOC page, already the source of the glossary's HELOC entry (read by the glossary's writers 2026-10-30/31; not re-read
this session: consumerfinance.gov is refused by this session's network). The word states only what the HELOC entry
already states (a home-equity line's rate usually changes; not repaying it can cost you the home); everything else is
the app's own arithmetic below. It is never one of the "Words for your plan" (a mortgage does not suggest it). The
lesson says "This is information, not advice."

**The arithmetic** (`velocity(x = VELOCITY)` in compute.js; invented round inputs: a $200,000 mortgage over 30 years at
6%, a line of credit at 9%, $5,000 of everyday spending a month on top of the mortgage payment, $1,000 left over, a
$10,000 chunk; the low case with the mortgage at 4%):
- The extra payment (`core/math/finance.js` `amortization`, interest = balance × rate ÷ 12): the payment is $1,199.10;
  with $1,000 more each month the loan ends in 122 months (about 10 years) instead of 360 and pays $164,268.14 less
  interest ("about $164,000"). Either way the money left over lowers what is owed by $1,000 a month: that is where the
  years come from, with or without the line.
- The chunk on the line: its balance runs 10,000, 9,000 ... 1,000 (`months` = 10), averaging (10,000 + 1,000) ÷ 2 =
  $5,500 (`onLine`); at 9% instead of 6% that costs 5,500 × 3% × 10 ÷ 12 = $137.50 ("about $138").
- Pay sitting on the line until it is spent: the everyday spending leaves evenly through the month, so half of it,
  $2,500 (`sitting`), sits on the line on average; on a line charging interest on each day's balance that saves
  2,500 × 9% × 10 ÷ 12 = $187.50 ("about $188").
- Net: $187.50 − $137.50 = $50 in 10 months, $5 a month, before any fee for the line; with the mortgage at 4%,
  5,500 × 5% × 10 ÷ 12 = $229.17 against the same $187.50: $41.67 behind ("about $42").
- Checked day by day (in the test: 30-day months, pay on the line on day 0, spending a 30th a day, the line's interest on
  the average daily balance): $52.31 ahead and $44.03 behind, within $5 of the simple sums; counting the leftover as
  sitting on the line from payday too (the plain way leaving it idle in checking until the month's end) gives $129.89
  and $33.55 ahead. Every variant stays under $15 a month, which is what the lesson's first line, "In short, the line
  itself changes the result by a few dollars a month", and its last, "Either way, it is tiny next to the $164,000", say.

**The lesson's words** (after a look on a phone, 2026-11-15, and a second, 2026-11-16). "What it is" starts with how
the loop runs, not with the meaning again; the home-equity line is "a line of credit, often one borrowed against your
home"; the chunk is "a large amount from the line at once, often called a chunk", the one place the word appears (no
"lump sum"); the rates are said as rates ("at 9% instead of the mortgage's 6%", not "3 points more"); the money sitting
on the line is "Your pay also sits on the line until you spend it, so you owe about $2,500 less on average". "An
example" gives the answer first ("In short, the line itself changes the result by a few dollars a month."), and the
result says than what: "about $50 better off than sending the $1,000 straight to the mortgage", "about $42 worse off"
at 4% (not "ahead" or "behind" of nothing named). The day-by-day sentence was dropped for the first line, which says
the same for every variant. The test quotes each.

**A correction to the brief.** The brief said the same extra payment on the mortgage "does at least as well when the
line of credit's rate is higher". The arithmetic says otherwise in one respect: pay sitting on a daily-interest line can
beat a small rate gap by a few dollars a month (the $50 above). The lesson says what the sums say: the big savings come
from the money left over, which an extra payment gets on its own; the line's own effect is a few dollars a month, ahead
or behind with the rates, the timing and its fees; and it adds a changing rate and a debt the home stands behind.

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
- A lesson's page turned off or not built: its "Try it with your own numbers" button is left out; the lesson stays.
- A word without a lesson: its row reads exactly as before (no lesson row).

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
Lessons: one behind each of the 20 words met on the most pages (the cut, the tie-break, the counting); every lesson's
word exists and its page is a real, usable page; 250 to 350 words in three parts; no sentence over 32 words, nothing
abbreviated with "e.g." and the like, the wording rules ("today's dollars", nothing straight after "Will the money
last?"), every abbreviation in a lesson a glossary word (the same scan as the pages'); every source on a public site; no
yearly dollar limit in what a lesson explains; **every sum in every example** (each figure written, against its
arithmetic and the fixtures' own numbers); the page: no lesson words on the first view, each lesson a shut `item` row
inside its word's row, the three parts in order, the outlined link and the sources, the link left out when the page is
off, `?show=lesson-<id>` opening it, and S11 (drawing and opening every row writes nothing). **Invariance**
(`invariance.json`, digests written from the code at 3c0b8a1 before the change): `compute()` over the fixtures, the 14
households, the phone-built plans and the empty plan; every entry byte for byte; every search of every old name; the
page's words for four households and a typed search, with the lesson rows taken out.
Velocity banking: the word (no page claims it, the HELOC entry's source, found by "chunking" and "velocity", HELOC still
first for "heloc", never a word for a household's plan); every step of `velocity()` (the payment, 122 months, the
interest saved, the chunk's months and average, the rate gap's cost, the money sitting on the line, the net, the 4% case,
a chunk the leftover does not divide, nothing left over); the day-by-day check (within $5 of the sums, every variant
under $15 a month); the lesson quoting `velocity()`'s figures as rounded in its words.

## Ideas / not yet
- A small "?" beside a word on other pages that opens its entry here (needs a shell change in `core/`).
- Spanish definitions.
- The AI's answer for a missing word offered as a draft entry for the owner to check and add.
