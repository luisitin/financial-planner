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
