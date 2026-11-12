# All pages  (`overview/pages`)

**Status:** usable
**Purpose:** the searchable directory of every page: grouped by topic, filterable by ready / coming soon / build phase, with each page's one-line purpose and whether the owner has left notes on it.

## Inputs
`plan.pageNotes` (to flag pages with notes); the module list from `ctx.modules`; route
`#/overview/pages/<filter>` where filter is `ready`, `soon` or `phase-<n>`.

## Outputs
`noted`: set of page keys that carry notes.

## Formulas
None.

## Edge cases
Disabled pages (feature toggles) are hidden. Unknown phase counts as 10.

## Tests
`module.test.mjs`: noted set.

## Ideas / not yet
- Sort by "most useful next" once alerts exist.
- Show each page's README inline.

## Search kept (stress test 2026-11-11, x-2)
The search rides in the address (`?q=`), so Back returns to the same word and results; pages named for the word are
listed first under "Best match" (up to four).

Wave 1 (2026-11-11, track "taps"): "Best match" is the pages whose `core/search.js` `matchScore` is under 1 (the page's
name or one of its phrases holds the word as whole words, never inside another word: "car" is not Medicare), closest
first ("budget": Budget, then Expenses). The word is written into the address 400 ms after typing rests, when the box
is left (`change`) and at once when a result is tapped (Safari allows 100 address changes in 30 seconds; one per key
could use them up and break Back with the menu open). Leaving the page clears a word still waiting (the cleanup).
