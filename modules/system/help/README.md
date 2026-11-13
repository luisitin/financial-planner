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

## Can I see everything at once? (2026-11-13, opt C7)
A question under "Questions people ask", right after "How are the numbers worked out?", in two sentences: tap a row under
an answer and it opens where it is; the two ticks in System > Settings under How much to show make every "How this is
worked out" start open and most forms show all their boxes, and the plan stays the same. "Most" for the same reason as the
card (`modules/system/settings/README.md`). The question adds six words to the first view (the counts file allows 310 on
the empty plan, was 300).

## Can I try it without my numbers? (2026-11-13, gap design #20)
One question under "Questions people ask", in place of "Can I try something without changing my plan?" (which asked the
person to type `?sandbox=1` into the address). `tryAnswer(on)` in `compute.js` gives the words, one set per case:
- the person's own plan is on screen: yes, pick a pretend family below; it is kept apart; "scroll to the top and tap Leave" comes back (the line
  with Leave scrolls away with the page, so "at the top" alone pointed at nothing on screen), and what was changed
  there is then forgotten;
  and the pointer to the What-if scenarios pages for one change on their own numbers;
- a pretend family is on screen (`ctx.store.demo()`): "You are doing that now: this is a pretend couple, not your plan",
  pick another, or scroll to the top and tap Leave; changes are forgotten on leaving.
Under the answer the view draws three plain links (`.chip`, none filled): "A family with children", "A couple near
retirement", "Someone starting out"; the one on screen says "(open now)". Each opens the app again with
`?sandbox=1&demo=<name>` at the Dashboard (`core/demo/names.js` `demoHref`), so this page's plan is never touched. How the
pretend families are kept apart from the plan, their sources and the date formulas: `core/demo/README.md`.
No money formula. The question is one word shorter than the one it replaces, so the first view's count does not rise.
Tests: `module.test.mjs` (both sentence cases, the three choices), `tests/demo.test.mjs` (everything else).

