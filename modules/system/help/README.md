# Help  (`system/help`)

**Status:** usable, phase 10
**Purpose:** How the app works, the first steps and which are done, every page with what it is for, and the questions people ask.

## Inputs
- The plan, for the first steps: `household.people` (an adult with a birth date), `accounts`, `income`,
  `expenses` or `transactions`, `debts` (a rate and a payment for every debt account), `goals`,
  `retirement.contributions`.
- From `ctx` in the view: `modules` (every page's manifest: title, purpose, status, order, aliases), `GROUPS`, and
  `features.enabled` (switched-off pages are left out).

## Outputs
`compute(plan)` -> `{ steps: [{ id, title, why, done, go }], done, total, faq }`;
`directory(manifests, groups, query)` -> `{ query, results: [page], sections: [{ id, title, icon, pages, ready }] }`.

## Formulas
None with money. Search ranks with `core/search.js` `matchRank` (the drawer's search): page name or alias, then
section name, then purpose, then every word somewhere.

## Edge cases
- No debts: the debt step counts as done. A planned page shows "coming soon" and still links (its notes box).
- The page's text is the owner-facing explanation; builder details stay in the READMEs and AGENTS.md.

## Tests
`module.test.mjs`: steps on an empty plan and the family, a debt without detail, every step's page exists,
the directory's order and counts, search, the questions' plain words.

## Ideas / not yet
- A short "how to read this page" line per page, kept in each manifest as `help`.
