Will the money last?: say what happens to the money left over, and count it that way

What the person sees: on the card "What this answer rests on", the row
"Money left over each month · Not counted · $1,828 a month" shows both
effects ("If it's invested: ... If it piles up in the bank: ... As it
is, counted as spent: ...") and an "Answer" button that opens the
question under the row, in place: "What happens to the $1,828 left over
each month?" [Invested for later] [It stays in the bank] [It gets spent
/ not sure]. Invested or in the bank asks into which account (one on
file, or a new $0 "Investments for later" / "Savings for later") and how
much a month (filled with the left-over rounded down to $10, the
person's to change); with the emergency fund short, invested first says
"Your emergency fund is $G short. Many people fill that first; count
only what goes into investments." "Save my answer" writes an ordinary
contribution row and the card opens on "Saved: $560 a month into
Savings. Your retirement answer: now runs out at 81 (was 70)." with the
answered row right under it ("Yours", "Change my answer"). The row is
listed, edited and removed on What you save for retirement like any
other; removing it removes the answer and every figure is as before.
After a year, or when the left-over has moved more than 25%: "You said
in November 2026 that $300 a month is invested. Left over each month
now: $567. Still right?" [Still right] [Answer again]. Why: owner's
request 2026-11-11 ("is it invested? let the person say, and count it
the way they say").

Formulas and decisions:
- Spec option B1: the answer becomes an ordinary contribution row, so
  every page that reads rows follows; no engine change, no change to
  projection/compute.js, tests/golden/retirement unchanged.
- New optional retirement.leftover { answer, on, monthly, rowId? }
  (docs/DATA_MODEL.md line, no version bump: absent = not asked). No
  page's compute reads it for a figure (one reader in words only, see
  the merge note below). Rows: { id: "leftover-<n>", period: monthly,
  employerMatch: 0, personId: the lead earner } into a brokerage or
  savings account; a new account is { id, name, type, balance: 0, asOf,
  ownerId, history: [] } (levers.js applyLeftover, leftoverAnswer,
  leftoverStanding, leftoverAccounts).
- The left-over asked about = Next best action's leftOverOf(spare) + the
  answered row a month (NBA already takes every row off, so nothing is
  counted twice; tested: NBA spare after = before - amount).
- Said = done: the card's effects run applyLeftover on a copy exactly as
  the save writes it; tested on Dana & Lee and Jamie, invested and in
  the bank (Jamie 70 -> 89 / 81; walked on the phone: 81).
- The bank row lands in the cash bucket at returnCash; every row stops
  at the lead earner's retirement age and rises with pay (tested).
- Asked again after 365 days or a move over 25% (D-B6, tested).
- D-B1 to D-B7 copied into projection/README.md, contributions/README.md.
  Contributions' account list now includes a checking or savings
  account a row already uses (D-B7); new rows still start on a
  retirement account.
- Builder's choices: an answered row is never hidden by D-A2's
  less-than-a-year rule (it is the one row the card writes), and right
  after a save it stays first under its notice; an "invested" answer
  whose row is gone reads as never answered.
- tests/leftover-invariance.test.mjs: on every qa fixture, the 14
  households and the five phone-built ones, migrate adds no answer and
  every module's compute is identical with a "spend" answer and without
  one, and with an "invested" answer and with its row alone.

Merged with claude-c's left2 on the rebase (2026-11-12):
docs/DATA_MODEL.md keeps one leftover entry for both builders.
retirement/projection's compute (claude-c's B3, not edited here) leaves
out its note "a typed leftover is not added" while leftover.rowId is
set: the one reader of the field, in words only. So an invested or
in-the-bank answer takes that note away, a "spent" answer keeps it, and
no figure moves (projection/README.md; the header of
tests/leftover-invariance.test.mjs).

view.js touched: modules/retirement/projection/view.js,
modules/retirement/contributions/view.js

Agent: claude-b
Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS

