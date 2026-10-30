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
- **Links that point at nothing** (`LINKS`): income, retirement savings, pensions, annuities, the employer's shares
  setting, insurance policies and estate papers whose person is no longer on the People page; retirement savings, loan
  details, investments, transactions, sorting rules, policies (the home or car they insure), properties (their account
  and their loan), beneficiary lists (their account or policy) and the Debts page's mortgage choice and payoff order whose
  account is gone; goals counting an account that is gone; trips and events saving toward a goal that is gone; Social
  Security details kept for someone no longer on the People page. A link that must be set is a problem; one that may be
  blank (the household's, or no link) a thing to check.
  Fixes, each confirmed with the number of items it changes: blank the link (the item becomes the household's, works for
  every account, or loses the missing goal, account or loan); take the missing accounts off a goal or the payoff order;
  remove a leftover that no page can show or change any more (a loan detail or investments whose account was deleted on
  Net worth, a beneficiary list, an estate paper for one adult who is gone, Social Security details), offered without an
  "Open" button since no page shows it. No fix here: a retirement saving or transaction without its account, and a
  pension or annuity whose person is gone (their pages count it as the person marked "you" until the owner chooses
  whose it is: blanking it would only hide that). A household estate paper (the guardian, a trust, the letter) whose
  person is gone is blanked, as the Estate papers page lists those once for the household.
  Net worth's "whose account" (`accounts[].ownerId`) is typed text on that page's form ("a name, or leave blank"), while
  other pages read it as a person's id; so only a value that looks like a label the app made (`looksLikeId`: a UUID from
  `crypto.randomUUID`, its 12+ character base-36 fallback, or the sample plans' "p-ana" form) and matches nobody is
  checked; a typed name is left alone. Reported to its owner on the workboard.
- **Two items with the same hidden label** (the id pages find, change and remove items by; `ID_LISTS`: people,
  accounts, income, expenses, goals, loan details, retirement savings, investments, transactions, policies, properties,
  trips), or none. Fix: the first keeps its own; the others get it with "-2", "-3"... added until it is free (a link to
  the shared label keeps pointing at the first). The problem counts every item involved; its confirm says how many the
  fix changes (`changes`: the copies after the first, and those with none). On screen it is "a hidden label", never "id".
- **"How often"** on income, expenses and retirement savings that is missing or not one of `core/math/periods.js`
  `PERIODS` (own keys only): every page counts it as every month (`times()` falls back to monthly), so said.
  **Amounts** there that are not a number count as 0 (text that reads as a number is fine); amounts **below 0** are
  taken off the totals instead of added (`perYear` keeps the sign), so they are said apart. Account balances that are
  not a number count as 0.
- **Dates** (birth dates, balance dates, goal dates, starts and ends, transaction dates) that are not real calendar dates
  in the form `YYYY-MM-DD` (30 February no; 29 February in a leap year, every 4th year except centuries not divisible by
  400, yes); birth and balance dates after today; an end before its start (the item never counts).
- **Rates over 100%** where rates are fractions (loan interest, a goal's growth, the assumptions' inflation, stock, bond
  and cash returns and pay growth, named in plain words): 6 typed for 6% is 600%. The example is rounded up to one
  decimal, so a rate over 100% never reads as 100% (1.0004 shows 100.1%). Fix: ÷ 100. Exactly 100% is left alone.
- **The people**: exactly one marked as "you" (pages that ask whose plan it is take the first).
- **The plan's version** (`schemaVersion`) above this app's `SCHEMA_VERSION`: saved by a newer app.
- **Size** = the plan's JSON length in characters ÷ 5 MiB (5,242,880), what a browser keeps in local storage for one
  site (MDN, "Storage quotas and eviction criteria", read 2026-10-30: "browsers can store up to 5 MiB of local storage
  ... per origin"). From 80%: a warning, as the store's offline copy stops saving silently when it is full; from 100%:
  a problem.
- **Names** under a problem are plain words, up to three with "; " between them: the item's name, payee or symbol, a
  rule's text ("the rule for \"COFFEE\""), an estate paper's kind in the Estate papers page's own words (`KINDS`), its
  account's name, a beneficiary list's people ("the list naming Bo"), else its amount and how often ("a saving of $470
  every two weeks"), its rate ("a loan at 5.9%"), its shares or its date; never its id. Items with none of these are
  counted, not named; a single setting (the Debts page's choices, the employer's shares) shows no name.
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
- An empty plan: the first card says so and offers "Add the people"; the plan's row reads "Empty", not "No problems".
- No PC: "Not connected", calm when the plan lives in this browser, red when it should be on the PC. AI off: grey.
- On screen outside the folded "Versions and connection": no version numbers, addresses, sizes or commands; the size
  is in the fold (and a problem from 80% of the browser's room).
- Choices made: the server's own test run is not triggered from here (it would need a new server route, the owner's
  call under AGENTS rule 10's spirit); a fix always asks first and says how many items it changes; the technical details
  (versions, the server's address, the AI provider) are folded last.

## Tests
`module.test.mjs` (11): a whole plan and an empty one clean; a person gone (found, named, fixed, a good link left alone,
a typed owner name not a link, a pension); a goal's missing account dropped, a required link without a fix, a loan
detail, investments and a beneficiary list left from deleted accounts removed, the Debts page's choices, leftover Social
Security details; names in plain words (a rule's text, a will, an amount), never an id; labels shared or missing, told
apart with the first kept, no "id" on screen; an unknown or missing "how often", amounts that are not numbers, amounts
below 0, a number typed as text, prototype keys; not-real dates, leap days, dates after today, an end before a start;
rates typed as whole numbers, fixed ÷ 100, 100% left alone, 100.4% shown as such, the articles, the assumptions' plain
names; one "you", a newer plan, the size share; every page's sums with placeholders and heavy pages skipped, a thrown and
a returned error, each page on its own copy; every fix changes as many items as its confirm says (15+ fixable problems
in one plan).

## Ideas / not yet
- A button on the PC's server to run `npm test` and show the result here; checks of the transactions' categories and the
  envelopes' categories against the category list.
