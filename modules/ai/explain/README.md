# Explain a page  (`ai/explain`)

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
`digest(derived, { ids, swap, own, keepDays })`, `copyFor(plan, { today })` -> `{ copy, names, terms, swap }`,
`scrub(copy, { people, others, terms })` -> names to put back, `outsiderAliases(plan, { today })` -> `[{ name, alias }]`,
`payeeAliases(plan)` -> `[{ name, alias, kind }]`, `payeeSwap(plan, payees)` -> `Map` (text -> stand-in),
`payeeFree(copy, swap)` -> a copy with no payee in it, `movedBirths(copy, today)` -> a copy with the birth dates
moved (or `null`, or `true`), `dayless(text)`, `sheetFor(plan, run, { today })` -> `{ lines, names, terms, ok, why, cut }`,
`explainable(pages)`, `buildMessages({ title, purpose, lines, question, terms })`, `readAnswer(text, names)`,
`words(key)`, `roomLetters(i)`, and the limits `MAX_LINES` (80), `MAX_CHARS` (6,000),
`MAX_ITEMS` (6), `MAX_DEPTH` (4), `MAX_TEXT` (160), `MAX_QUESTION` (300), `MAX_ANSWER` (3,000), `SKIP`,
`NOT_OFFERED`.

## Rules
- **Names hidden at the source** (`copyFor`; reused from `ai/critic`: `anonymise`, `hideTerms`, `hide`, `restore`):
  the page's compute runs on a copy of the plan where people are Adult 1, Adult 2, Child 1 (or Dependent 1 when 18
  or over) and accounts are their kind and a number ("credit card 1", "401(k) 2"; numbered even when alone, so the
  AI's "the loan on your house" is never taken for the car loan); goal, income, expense and custom category names
  have the household's names (whole, first, middle and surnames, with or without accents) and the outsiders' names
  hidden (`hideTerms` with `surnames`). Every other name typed into the plan is a stand-in (`scrub`), one per name
  as typed, so the page groups and adds up exactly as it does for you:
  - payees "Payee 1", "Payee 2"... (`payeeAliases`, one per payee as typed: "Netflix" and "NETFLIX" stay two, as on
    Spending; transactions first, then the rules' new payee names). The payees are **not** changed in the copy:
    the pages read them (Subscriptions finds "Netflix" in a payee renamed from "NFLX DIGITAL", Transfers counts "to"
    or "transfer" in a payee, a rule looks for its words in the payee, Repeat payments and Categorise group by the
    bank's own text), so a stand-in there would change their figures. The digest says them instead (`payeeSwap`): a text
    that is a payee as typed, or a bank's text, is sent as its payee's stand-in, and a payee of two or more words
    inside a longer text too (as typed, whole words; one word alone, such as "Rent" or "Target", could be the app's
    own word). **The page's own words stay** (`payeeFree`, `own`): when a page says a payee's text, it is worked out
    once more on a copy where every payee, bank text and rule's payee name is a made-up word ("Zqa"); a text the
    page says there too is its own (an account's kind "Mortgage" or "Checking", the budget's Needs, Wants and
    Savings, an expense "Mortgage payment", the alert "Emergency fund is thin") and goes as it is, whatever a payee
    is called; only the rest is swapped. So a payee typed "Savings" is "Payee 2" on Spending and the budget's
    Savings stays "Savings". On a page that says the same words of its own, such a payee goes as those words
    ("payee Checking" on Accounts, which also shows the kind Checking): nothing more than the page already says. A
    payee typed as one of the app's category names or ids ("Groceries", "Pension") is the app's word and goes as
    it is. The bank's text (`rawPayee`) and an account's bank (Home and car insurance spots a car loan by it) stay
    in the copy and are never sent;
  - people outside the household the plan names (`outsiderAliases`: gift and bequest recipients, beneficiaries,
    givers, digital-legacy contacts, contacts): "Person 1", "Charity 1", "Giver 1", "Contact 1", the same name the
    same stand-in on every page; a household member named there is their own stand-in; "the estate" stays;
  - "home 1", "rental 1", "vehicle 1" (a loan secured by one names it; other "secured by" text is dropped);
    belongings by kind ("jewelry 1", or "belonging 1", not "item 1", which the AI may write about a line), rooms
    "room A"... (`roomLetters`: no "I", letters that sort as they are handed out, because the inventory sorts by
    room) in the same order, no details, the proof only as "noted";
    a holding by its symbol ("holding 1" without one), with "target 2050" or "cash" kept when the page reads that
    from the name; grants, pensions, annuities, policies by kind ("term life policy 1"), health plans, trips and big
    days, reminders (their notes dropped), sales, the payers of tax forms, scenarios, job offers, the business and
    its costs, a planned purchase, a renovation project, digital accounts ("login 1"), tags ("tag 1");
  - dropped: the plan's own name, insurers, the advisor's and contacts' firms, import file names; page notes and the
    plan's notes only as "noted".
  A test runs every page offered on the copy and on a copy with only people and accounts renamed: every figure,
  yes/no and count is the same; and the pages that read payees (Spending, Repeat payments, Subscriptions, Rules,
  Categorise, Transfers, Duplicates, Money calendar) give the same figures on the copy as on the real plan. No
  search-and-replace for people's or accounts' names runs over the app's own words, so a person named Will, Max, Ira
  or Al never turns "Will", "max price", "Roth IRA" or the state "AL" into a stand-in. The answer comes back with the
  real names put back ("credit card 1 (Visa card)", "Payee 1" -> the payee; a lettered stand-in such as "room A" only
  with its letter in capitals, so the AI's "room a bit lower" stays its words; a symbol is not put back, it can be an
  everyday word). No number changes, only names.
- **What is sent** (`digest`): the page's compute result as lines, `path › key: value`, keys split into words
  (`sinceLastPct` -> "since last pct"). Breadth first: the top part's own numbers and short lists of values, then
  those of every inner part one level down, and so on, then the lists of records in the order found, so a big inner
  part (the federal page's tax tables) never crowds out a later part's figures (its `result`). Numbers to the cent;
  numbers under 1 (rates, shares) to 4 significant digits, so a 6.25% mortgage is 0.0625, not 0.06; yes/no; text cut
  to 160 characters. An id used as a key or a value is said as the stand-in of what it names ("balances credit card 1:
  6127.47", "survivor monthly › Adult 1", "retire age Adult 1: 65"), or left out when that has no name; anything else
  that looks like an app-made id (a UUID) is left out. Payees as their stand-ins (`payeeSwap`, above). **Birth
  dates** (`movedBirths`, `dayless`): when a page has dates and someone in the household a birth date, the page is
  worked out once more with each birth date moved a few days within its month (a week on, or back when a week on
  would change their age today or their month; else a day or two), so ages, months and years of birth stay. If any
  date on the page moves, the page shows a date worked out from a birth date (the day someone retires at 65, turns
  59 and a half, a child turns 17), and **every** date on that page goes without its day ("2055-05-20" ->
  "2055-05", "May 20, 2055" -> "May 2055", "20 May" -> "May", "5/20/2055" -> "5/2055"); if none moves, every date
  keeps its day. Whether the days go depends only on what the page shows, never on which day someone was born, so
  a missing day never points at a birthday: a tax payment due on the 15th keeps its day on the tax page and the
  calendar whoever was born on the 15th, and month ends keep theirs for someone born on the 31st. On the people,
  timeline, plan summary and annual review pages (when they show such a date) the AI gets the month and year
  someone turns 65, not the day. A birth date that cannot be read as a date takes every day off every page. The AI
  is told that a year and a month alone has its day left out on purpose. A list of records: how many, then the
  first 6, one line
  each (a field with a `<field>Label` next to it gives way to the label); a list already sent is named, not
  repeated; a list of more than 10 numbers: how many, first, last, lowest, highest. At most 80 lines and 6,000 characters, then a line saying the rest was left out.
- **Never sent** (`SKIP`): ids and links (`id`, `accountId`, `go`, `href`..., and any key ending in `Id` or `Ids`:
  `ownerId`, `giverId`, `entryId`), free text and contact details (`note`, `notes`, `phone`, `email`, `address`,
  `last4`, `where`, `who`, `copy`), which could say anything about anyone, the bank's own text and what a rule looks
  for in it (`rawPayee`, `contains`), the names of banks, insurers and firms (`institution`, `insurer`, `firm`,
  `contact`), file names (`fileName`), where a receipt is kept (`proof`), birth dates (`birthDate`; the age is
  sent) and tax tables (`params`). Not `room`, `details`, `to` or `from`: those hold figures or dates on other pages
  (a gift's room left, a home's details, a statement's dates). The fold "What the AI will read" shows every line,
  word for word, before you ask.
- **Pages offered** (`explainable`): built (usable or partly built), with a compute, turned on, not the system or AI
  pages, and not `household/contacts` or `household/documents` (other people's details; where papers are kept) or
  `overview/pages` (the list of all pages has no numbers of its own, so it could only ever say "fill it in first").
- **Not ready** (`sheetFor`): a page whose compute says `ready: false` (Fees, Dividends, Allocation... before any
  holdings) is "no numbers to explain yet", like a page with no numbers, instead of sending its zeros.
- **The question** (`buildMessages`): the AI is told to use only the numbers given and never invent any, not to work
  out new totals, rates or projections (and to say so when a question needs one), that fractions are rates, to use the
  stand-in names exactly as written, number included ("Payee 1", "Person 1", "home 1"), that a date given as a year
  and a month only has its day left out on purpose, plain words, no product recommendations, at most 200 words:
  what the page shows, what the main numbers mean, one or two things worth noticing. With no question typed: "What
  does this page tell me about my money?" A typed question has the same names hidden (`terms`: the household's
  names and their parts, the outsiders, account names, and every stand-in's name of two or more words, such as an
  address, a payee or a pension: "Will Zelda Quorn get 14 Larkmoor Lane?" goes as "Will Person 3 get home 1?"), then
  is cut to 300 characters. Money math stays in the pages (AGENTS.md rule 5): the AI only explains numbers a page
  already worked out.
- **The answer** (`readAnswer`): a reasoning model's `<think>` part dropped, blank lines tidied, real names put back,
  cut to 3,000 characters. How it is shown: "The page" below.

## The page (view.js)
- **Title:** "Explain a page" in the menu, the top bar and the heading. It said "Explain this page" until 2026-10-31,
  but opened from the menu it picks Net worth, not the page you were on; the wording can come back with the
  per-page button.
- **Picking the page:** a list by topic, in the menu's order. Every arrival at `#/ai/explain/<group>/<id>` picks that
  page (also Back, or the same link again: each arrival is a new route object); a redraw of this page keeps the pick.
  Picking another page puts it in the address (`history.replaceState`, no new history entry), so Back and reload
  come back to it.
- **Asking:** the button says `Explain "<page>"`. While waiting it says "Checking the AI helper…", then "Reading the
  page…" with "This can take a minute or two." under it (design log: time hints for slow AI waits). The button and
  the page list are locked until the answer comes, and the question is always about the page picked when it was
  tapped: the fold and the question use the page of the render they were built in.
- **"What the AI will read"** (a fold): every line sent, word for word, with what else goes (the page's name and short
  description, the question, the app's rules for the AI), a note on the shorthand (dollars without the $ sign, 0.12
  means 12%), the stand-ins (Adult 1, Adult 2, Child 1; accounts by their kind and a number, "credit card 1",
  "mortgage 1"), what is never sent (notes, phone numbers, where papers are kept), the one gap (a name the app does
  not know, such as a friend's first name or an employer in a goal, income, expense or category name, goes as typed:
  rename it on its page first; see Edge cases) and who is who ("In the lines below, Adult 1 is Ana... These real
  names are not sent."). The lines of a list of records sit under the line that names the list, without a bullet.
- **The answer** (never saved): under "What the AI says about <page>", first "Written by the AI and not checked by
  the app. The numbers on the page itself are the ones to trust." (an answer can be several phone screens), then the
  text as paragraphs and lists, the way Ask the plan shows one (design log 2026-09-15): a line starting "-", "*",
  "•", "1." or "1)" is a list item; a numbered list starts at the number written on its first item and counts up
  from there, as markdown does (so "1. 1. 1." and "1. 2. 3." both show 1, 2, 3, and a list picked up again after a
  paragraph with "3." starts at 3); a blank line between items keeps the list going; an item indented two spaces or
  more under another is a list inside that item, and an indented line that is not an item belongs to the item above
  it; a blank line ends a paragraph; `**bold**` and `*italic*` are shown as such; a `#` heading reads as a line of
  its own; built from text nodes, never HTML. Then a button to the page, and the AI model's name folded under "For
  whoever set up the AI". If the plan changes after the answer, a notice says so.
- **The notices** (each says what to do next): turned off on the PC itself (the PC's settings win over this device's,
  so Settings here cannot turn it on: whoever set up the PC can) or on this device (Settings, then "AI assistant");
  no AI model yet (whoever set up the PC downloads one; "Show available models" checks); not responding (the PC on
  and awake, Ollama open on it); a problem while answering (try again in a minute, a shorter question can help, the
  reason folded under "Show details" for whoever set up the AI); an empty answer (tap Explain again; the model may
  be too small for the page).

## Edge cases
- Empty plan: "Nothing to explain yet" with a button to add the people.
- AI turned off (on the PC itself or on this device), no model downloaded, not answering, a problem while answering
  (details folded for whoever set it up), an empty answer: a plain notice each, with Settings and the page's own
  button where they help.
- A page with no numbers yet, or one that says it is not ready ("Open it and fill it in first"), or whose compute
  fails (the shell's `{ error }` counts too): said instead of sending nothing, or zeros.
- Not hidden (known): a name typed into a goal, income, expense or category name that the plan does not list
  anywhere else (an outsider's first name alone, an employer), as the fold says; a one-word payee that a page writes
  inside a longer sentence of its own (no page does today: the payee pages give the payee as a value of its own,
  which is swapped); a payee typed as one of the app's category names ("Groceries"), or as words the same page says
  of its own (above). Figures a page works out from a birth date (a lifetime pay total, a fraction of a year to
  retirement such as Life insurance's "income years 11.34") are sent as figures, and a close reader could work the
  day back from them; only dates lose their day.
- The second looks (payees, birth dates) run the page's compute once or twice more, only when they can matter: a
  heavy page such as the plan summary takes about twice as long to read. One that fails counts against sending
  (payees as stand-ins, dates without their day).
- One question at a time, about the page picked when it was asked (the page list is locked until it answers); the
  button says what is happening; a new answer scrolls into view once; a render that is no longer on screen never
  redraws.
- A heavy page (Monte Carlo) is worked out in the browser after "Reading the page…" shows.

## Tests
`module.test.mjs` (19): the digest (order, rounding, rates to 4 significant digits, yes/no, words, keys and id keys
left out, lists of records, labels, a repeated list, long lists of numbers, the line, character, text and depth
limits, breadth first with the federal page's total tax sent); ids (as keys, values and "lever:<id>", app-made ids on
Debt payoff, Social Security, Compare scenarios, Gifting and three more); what the AI reads for Net worth, Income
and Goals has no real names and the same figures; a failed, empty or not-ready page; the pages offered; the question
(names, surnames, Jose for José, outsiders, an address hidden; default question, length); the answer (thinking
dropped, names restored, "the loan on your house" left alone, payees and homes put back, the AI's own "tag a",
"payee a" and "room a" left alone, tidy, length); everyday-word names (Will, Max, Ira, Al and AL, an account named
House); a goal named like its account, a name past the cut; no surname, plan name or birth date; dates (dayless on
every date, the digest only when told, movedBirths a week on or back with ages and months kept, nobody born, a
birth date that cannot be read; someone born 15 January 1962: the tax page and the calendar keep "2027-01-15", the
people page and the timeline send no day; born on the 31st: Accounts, Debt payoff, Goals and Tax papers keep their
month ends; at four ages, every page at one of them, each birth date then moved 3 days: the same dates with their
day on both, no birth date sent); the payee pages (Subscriptions with a renamed payee, a rule containing "pay" on
Rules and Categorise, "Move to savings" on Transfers: the same figures as the real plan; a payee typed as a category
name kept; payees inside a text; the page's own words kept as a text and as a key); payees typed like the app's
own words (Mortgage, Savings, Checking, Cash, Needs, Wants, Credit card, Mortgage payment, Emergency fund, Japan
trip): no stand-in on Liabilities, Statement, Statements, the 50/30/20 budget, Beneficiaries, Expenses, Alerts,
Timeline, Goals or Debt payoff, the kinds, buckets, expense and alert said as the page says them, Spending's top
payees still stand-ins, Accounts with "Checking" as its own word; the copy with no payee left (made-up words, no
marker, Spending's top payees the same); every
page offered on a plan holding every name and note the data model has (invented): none of it in the lines or the
messages, every figure the same with and without the stand-ins, the pages that read payees with the same figures as
the real plan, the names put back; the stand-ins themselves (room letters, outsiders, gifts and beneficiaries,
payees and the bank's text kept in the copy, a target-date fund, rooms in order, "belonging 1", what is dropped);
compute.

## Ideas / not yet
- The button on every page (a link from the shell; proposed under Messages).
- Follow-up questions in a short conversation, the earlier answer kept.
