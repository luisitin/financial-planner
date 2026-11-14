# What other apps offer: what touches claude-a's pages (claude-b -> claude-a, 2026-11-13)

The owner asked on 2026-11-13 for "complete optionality" that stays "simple by default", with depth one quiet tap away.
claude-b built the first gap items as optional depth behind a simple default (the helper `core/ui/more.js` and its rule
book `docs/OPTIONAL.md`; the first-view check `tests/first-view/*`). None of your 13 folders was edited. One item needs a
change in your files to agree with the rest of the app; two more follow later, when the pieces they read exist.

## How to work through it

- Each item says what to do to see it, what it should do, and where (file and line as of the landing commit).
- Reproduce before you fix; the fix below is a suggestion, not a decision.
- New parts on your pages can use the helper (`more.part`, `more.parts`, `more.links`; docs/OPTIONAL.md has the vocabulary
  of titles and the counts a first view may show). The first-view check will then count your pages too.

## A1 (now): Net worth ahead and the one-time debt payments

- **To see it.** On Pay off debts, open "One-time payments" and add $2,500 in a month this year. Pay off debts moves the
  debt-free month sooner. Net worth ahead (`balance/projection`) still shows the old debt-free month.
- **Should.** Both pages give the same debt-free month (R4-18: debt payoff dates agree across pages).
- **Where.** `modules/balance/projection/compute.js` line 39: `payoffPlan(pay.debts, { extra: pay.extra, order: pay.order,
  customOrder: pay.customOrder })`. Pass the saved lumps too: `lumps: pay.lumps` (see `core/math/payoff.js` from line 24
  for the shape: `[{ month, amount, debtId? }]`, month 1 = the plan's first month; `debt/payoff/compute.js` builds them
  from `plan.debtPlan.lumps`).

## Later (no change yet)

- **A1 part 2**, when `modules/retirement/happenings.js` lands (gap item 1.1): Net worth ahead can read
  `retirement.happenings` through it, so a home sale, money in or out and goals show in their years.
- **A2**, when `core/math/state-tax.js` lands (gap item 7.3): State income tax (`taxes/state`) can offer a `choice()`
  "Work it out from my state's brackets" beside last year's return and the flat rate.
- **A3:** nothing to change on Giving (`goals/charitable`); a list of gifts and a donor-advised fund are on the list for
  whenever you return.

## A-left-out (2026-11-14): left-out lines on Cash flow statement

`modules/cashflow/statement/compute.js` line 101 reads `plan.transactions` directly. Since gap #32 a person can mark a line "paid back later" or "leave out of the totals" in the Ledger; the Ledger, Where the money goes, Budget, Categories and Export then leave it out, and this page still counts it. Read through `counted(plan)` (`modules/transactions/ledger/compute.js`) or drop lines with `leftOutIn(plan.transactions)` (`modules/transactions/splits.js`). A split purchase is also still filed whole under its main category here (`partsOf(tx)` gives the parts).
