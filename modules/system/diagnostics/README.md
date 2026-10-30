# Diagnostics  (`system/diagnostics`)

**Status:** usable, phase 10 (built by claude-b from codex's idle lane)
**Purpose:** Checks on one page that your plan holds together, that every page can work out its numbers, and whether
the PC and the AI helper answer.

## Inputs
- The whole plan, read for the check below: `household.people`, `accounts`, `income`, `expenses`, `goals`, `debts`,
  `retirement.contributions`, `transactions`, `holdings`, `rules`, `insurance.policies`, `estate.documents`, `events`,
  `property`, `assumptions`, `schemaVersion`.
- Every loaded page (`ctx.modules`: its `compute`, `status`, `heavy`), the store (`backend()`, `sandbox()`), the PC
  (`ctx.api.ready()`: the server's `/api/health`, its version, whether it holds the plan and asks for a sign-in code), the
  AI helper (`ctx.ai.status()`, `settings()`), the browser (`navigator.onLine`, a test write to its storage).
- Writes only when a Fix is pressed and confirmed: the broken links, ids or rates listed below, in their own sections.

## Outputs
`compute(plan, { today })` -> `{ issues: [{ key, level: "bad"|"warn", page, text, count, names, fix: null|{ label } }],
counts: { people, accounts, transactions, income, expenses, goals, debts, holdings }, size: { chars, share, warn },
schema: { plan, app, newer } }`. `applyFix(draft, key)` -> items changed. `checkPages(pages, plan, today)` ->
`{ ran, skipped, failed: [{ key, title, error }] }`.

## The checks (`compute`)
- **Links that point at nothing** (`LINKS`): income, accounts, retirement savings, insurance policies and estate
  documents whose person is no longer on the People page; retirement savings, loan details, investments and
  transactions whose account is gone (and loan details or investments with none); goals counting an account that is
  gone; sorting rules for an account that is gone; trips and events saving toward a goal that is gone; properties
  pointing at an account that is gone. A link that must be set is a problem; one that may be blank (the household's) a
  thing to check. Fix: blank the link (the item becomes the household's, or works for every account), or take the
  missing accounts off a goal; a link that must be set has no fix here, only its page.
- **The same id twice, or none** (`ID_LISTS`: people, accounts, income, expenses, goals, loan details, retirement
  savings, investments, transactions, policies, properties, trips): pages find, change and remove items by id, so a shared
  one can touch the wrong item. Fix: the first keeps it; the others get it with "-2", "-3"... added until it is free (a
  link to the shared id keeps pointing at the first).
- **"How often"** on income, expenses and retirement savings that is not one of `core/math/periods.js` `PERIODS`: counted
  as every month there, so said. **Amounts** there that are not a number of 0 or more (text that reads as a number is
  fine), and account balances that are not a number: counted as 0.
- **Dates** (birth dates, balance dates, goal dates, starts and ends, transaction dates) that are not real calendar dates
  in the form `YYYY-MM-DD` (30 February no; 29 February in a leap year, every 4th year except centuries not divisible by
  400, yes); birth and balance dates after today; an end before its start (the item never counts).
- **Rates over 100%** where rates are fractions (loan interest, a goal's growth, the assumptions' inflation, returns and
  pay growth): 6 typed for 6% is 600%. Fix: ÷ 100. Exactly 100% is left alone.
- **The people**: exactly one marked as "you" (pages that ask whose plan it is take the first).
- **The plan's version** (`schemaVersion`) above this app's `SCHEMA_VERSION`: saved by a newer app.
- **Size** = the plan's JSON length in characters ÷ 5 MiB (5,242,880), what a browser keeps in local storage for one
  site (MDN, "Storage quotas and eviction criteria", read 2026-10-30: "browsers can store up to 5 MiB of local storage
  ... per origin"). From 80%: a warning, as the store's offline copy stops saving silently when it is full; from 100%:
  a problem.
- Problems come first, then things to check.

## Every page's sums (`checkPages`)
Each page's own `compute` is run on a copy of the plan (so a page that changes what it is given cannot change the
plan), with today's date; a thrown error or a returned `{ error }` is listed with the page's name. Placeholders (no sums
yet) and heavy pages (simulations, which run on the PC when it is connected) are skipped and counted. It runs once per
saved version of the plan, just after the page is shown (about 0.3 s for some 120 pages on the family plan in Node). This is
the owner's stand-in for the test results the catalog row asked for: the tests themselves (`npm test`) run on the PC,
not in the browser, and the page says so in its technical fold.

## Edge cases
- An empty plan: nothing to fix; every page's sums still run (most show their empty state).
- No PC: "Not connected", calm when the plan lives in this browser, red when it should be on the PC. AI off: grey.
- Choices made: the server's own test run is not triggered from here (it would need a new server route, the owner's
  call under AGENTS rule 10's spirit); a fix always asks first and says how many items it changes; the technical details
  (versions, the server's address, the AI provider) are folded last.

## Tests
`module.test.mjs` (9): a whole plan and an empty one clean; a person gone (found, named, fixed, a good link left alone);
a goal's missing account dropped, a required link without a fix, a loan detail with no account; ids shared or missing,
fixed with the first kept; an unknown "how often", amounts and balances that are not numbers, a number typed as text;
not-real dates, leap days, dates after today, an end before a start; rates typed as whole numbers, fixed ÷ 100, 100% left
alone; one "you", a newer plan, the size share; every page's sums with placeholders and heavy pages skipped, a thrown
and a returned error, each page on its own copy.

## Ideas / not yet
- A button on the PC's server to run `npm test` and show the result here; checks of the transactions' categories and the
  envelopes' categories against the category list.
