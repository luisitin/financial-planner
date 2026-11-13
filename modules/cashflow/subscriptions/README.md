# Subscriptions  (`cashflow/subscriptions`)

**Status:** usable (phase 4)
**Purpose:** Every charge that renews by itself, what it costs you a year, and the ones to question.

## Inputs
Plan sections read (`needs`): `transactions` (through Bills and regular payments), `expenses` (category subscriptions), `recurringIgnored`. Writes: `recurringIgnored` ("Not a subscription").

## Outputs
`items[]` (`name`, `icon`, `source`, `cadenceLabel`, `amount`, `yearly`, `monthly`, `last`, `next`), `monthly`, `yearly`, `count`, `hasData`.

## Formulas
- A found payment counts when its category is subscriptions or its name matches `SUBSCRIPTION_WORDS` (streaming, phone, gym, apps...). Yearly = amount x occurrences per year.
- Typed subscriptions are added unless a found one has the same amount (within 0.50) and shares a word.

## First view and parts
First view (class A in the simple-first spec: unchanged): "$X a year", one sentence, the list biggest first with "Not a
subscription" on found rows and "Edit ›" on typed ones, "You cancel with the company itself, not here". A found one that
went up says its new price beside the usual one, in Bills and regular payments' words ("$15.49 every month · now $17.99 ·
next 12/5/2026", critic F2, 2026-11-13; the rise is that page's `changes`, kind "up"); its year still counts the usual
charge, as the totals on both pages do, so the two pages say the same of one bill.

One tap away (`parts()`, one card; the page draws no fold by hand):

| part | kind and title | holds | status |
|---|---|---|---|
| `lower` | how, "How to ask for a lower price" (gap #6; the title is pinned by this module's test and in the first-view check's list, qa/first-view-lib.mjs) | six plain steps, "Nobody calls a company for you from here", "Open the Money calendar" | "6 steps" |
| `hidden` | item, "Payees you hid" (from Bills and regular payments' `hiddenPart`) | each hidden payee with "Put back" | "1 payee" |

With no subscription, "How to ask for a lower price" is drawn only when the address asks for it: Bills and regular
payments links to it (`#/cashflow/subscriptions?show=lower`, which opens it) when any bill went up, a phone or insurance
bill too. Otherwise the empty page is as short as it was (critic F5). It is a reading part: once a person opens it by hand
it stays open on that phone (docs/OPTIONAL.md), and "Show how answers are worked out" opens it.

### How to ask for a lower price (gap #6, map line K6 as it fits the promise)
The steps (`LOWER_PRICE_STEPS`): know your price and a rival's; ask for the department that keeps customers (retention,
or cancellations); ask what they can do to lower the bill; be ready to cancel; write down the new price and the day it
ends; put a reminder for that day on the Money calendar. No company is called for you (a bill-negotiation service is K6,
OUT: SERVICE, in the gap spec's section 8). No figure here.
Sources, read 2026-11-13: Equifax, "How to Negotiate with a Cable or Internet Provider" (compare competing providers'
prices, ask for the retention department, be ready to switch, decline a new contract, check the next bill); NerdWallet,
"Bill Negotiation: Get a Better Deal on Cable, Internet and More" (as quoted in search results that day, the article body
did not load: say you are considering canceling and ask for retention or cancellations, ask what else they can do,
check when promotional rates end, write down the date, the person and the terms). Consumer guidance, not law; the
wording on screen is our own.

## Tests
`module.test.mjs`: found by category and by name, typed ones, no double counting, ordering and totals. Gap #6: "How to
ask for a lower price" is a part of kind how, shut on the first view, titled and with its six steps and the calendar
link; `?show=lower` opens it, also with no subscription; no fold drawn by hand; "Payees you hid" puts one back and says so.
The critic of 2026-11-13, failing first: a found one that went up says "now $17.99" (not Gym Co or Verizon); the empty
page draws no parts card unless `?show=lower`. Two `todo` tests wait for the hand-over below (counted once after "Use
$17.99" with the key; typed by hand at the new price; a short name with the key).

## Ideas / not yet
- "Last used" from the owner (a tap per item) and a yearly reminder to review.
- A bill added or updated from Bills and regular payments ("Add to Expenses", "Use $17.99 on Expenses") is a typed
  subscription with a `payeeKey`; the typed and found copies are counted once only when their names share a word of four
  letters or more and the amounts are within 50 cents, so after "Use $17.99" Netflix is counted twice ($402 a year for
  two rows on the critic's walk), and "HBO" or "Max" would be too (critic F1). Hand-over (not in gap #6's files): in
  `compute.js` line 30, also count a typed row as found when `e.payeeKey === i.key`, or when a name word matches and its
  amount is within 50 cents of the found bill's new price (`changes` of kind "up" from Bills and regular payments). The
  two `todo` tests in module.test.mjs pass with it; tried on a copy, 2026-11-13.

## Wording follow-up (2026-11-07)

Each row says "$576 a year", not "$576/yr" (words, not abbreviations).

## Touch and input stress test (2026-11-11, claude-g)
- "Not a subscription" asks first and says what it did; "Payees you hid" at the bottom puts one back (F3; shared with Bills).
- A typed subscription opens its own form on Expenses with a way back; "Change these on Expenses" under the list (CF-5, F2).
  `items[]` of typed ones carry `expenseId`.
