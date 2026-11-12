# Break critic, track "ret" (L2-L6), claude-b's worktree rv/b-ret at 71ff05a (base fa2026e)

Reviewed 2026-11-12 from a detached copy `rv/v-ret-break` at 71ff05a, served on 127.0.0.1:9761 (sandbox, the kit's Chromium with an
iPhone user agent, real touch taps). Scripts, logs and outputs: `rv/ret/break/` (`b*.mjs` browser walks, `sweep.mjs`, `odd.mjs`,
`rm.mjs`, `rise.mjs`, `stub.mjs`, `acct.mjs`, `key.mjs`, `edit.mjs`); screenshots: `rv/ret/break/shots/`. Only what I confirmed on
screen or by running code is listed. The other two critics' findings (money M1-M4, person F1-F14) are not repeated.

Severity: 4 = the plan silently loses or invents money the person put in; 3 = a tap does something the person did not ask for,
or a figure on screen rests on a rule the spec forbids; 2 = the screen says something untrue or empty after an ordinary action;
1 = clutter or a contradiction a person can work around.

## Findings, most severe first

### B1 (4). Two jobs: editing one job's 401(k) takes over the Roth 401(k) at the other job, and "Pay the tax later" deletes it
- **Steps.** Robin (phone-built `nearRetiree`) plus a second job: accounts "Roth 401(k) at Acme" (Robin's, row $200 a month, no
  match) and "401(k) at Second job" (row $100 a month, match $600 a year). Contributions → tap "401(k) at Second job".
- **Evidence** (`b4.mjs`, 390 light and 320 dark; `shots/b4-twojobs-390-open.png`, `-320-dark-saved.png`).
  - The form opens with "Some of each" already chosen and **200** in "Pay the tax now: your own money": Acme's Roth money, shown
    as this job's. Under it: "Paying it all later would lower this year's federal tax by about $290."
  - Tap "Pay the tax later": the boxes merge to 300. Save: "Saved: $300 a month goes in paying the tax later, with the match.
    This year's federal tax: about $290 less than before."
  - Rows before: `Robin's plan at work $600, Roth 401(k) at Acme $200, 401(k) at Second job $100`. After: `Robin's plan at work
    $600, 401(k) at Second job $300`. The Roth 401(k) at Acme row is gone and its $200 now goes into another employer's plan,
    pre-tax. The person never opened the Acme row.
  - By code (`odd.mjs`): "Some of each" 60/40 on the second job's row rewrites Acme's Roth row from $200 to $40.
- **Cause.** `taxPairOf` (`contributions/compute.js`) pairs the row with the person's biggest Roth 401(k) row anywhere
  (`nows` = every Roth 401(k) row of that person), and `applyTaxChoice` takes out or rewrites that row.
- **Fix.** Pair only rows at the same job. With no employer field, the safe rule is: a Roth row belongs to this pair only when it
  is the one the split made for this row (keep the pairing on the row the split writes, e.g. an optional
  `retirement.contributions[].pairOf: <laterRowId>`, DATA_MODEL line, no bump) or when the person has exactly one pay-the-tax-later
  account at work. Otherwise open the question at "Pay the tax later" with an empty second box, and never take out or rewrite a
  row into another account. Test: a person with two 401(k)s and one Roth 401(k); editing the second 401(k) opens on "later",
  saving any choice leaves the Acme Roth row byte-for-byte unchanged.

### B2 (4). A split taken back loses the pay-the-tax-now part when one box is a share of pay and the other is dollars
- **Steps.** Dana & Lee (`couple2k`). Contributions → "Dana's plan at work" → Some of each → later `4%`, now `130` → Save.
  Open the row again → tap "Pay the tax later" → Save.
- **Evidence** (`b5.mjs`, 390 and 320 dark; `shots/b5-undo-390-later.png`).
  - After the split: `Dana's plan at work $260/month (4%)`, `Dana's Roth 401(k) at work $130/month`, $390 in all.
  - Reopened, the boxes read `4%` and `130`. After "Pay the tax later" the one box reads **`4%`**: the $130 is silently dropped.
  - Save: "Saved: $260 a month goes in paying the tax later, with the match." Rows after: only `$260/month (4%)`. Dana's own
    money went from $390 to $260 a month. The $0 "Dana's Roth 401(k) at work" account stays on Net worth.
- **Cause.** `merge()` in `taxQuestion` (`contributions/view.js`) adds the two boxes only when both are shares or both are dollars;
  a mix falls through to `nowBox.value = ""`.
- **Fix.** In `merge()`, turn both parts into dollars each time with the page's own `eachOf(text, period, pid)` (the person's pay is
  on file whenever a share was accepted) and write the dollar sum; if a part cannot be read, keep the chip on "Some of each" and
  say "Add the two parts yourself: …". Test (fake DOM): 4% + 130 → Later → Save keeps the person's own money a year.

### B3 (4). "Still right" keeps an invested amount bigger than what is left over, and up to a 25% rise the card never asks
- **Steps.** Dana & Lee, 390. Will the money last? → Money left over → Answer → Invested for later → $1,820 → Save my answer. Then
  Expenses → add a $700 a month bill. Back to the card → "Still right".
- **Evidence** (`b6.mjs`; `shots/b6-390-asked.png`, `b6-390-stillright.png`, `b6-390-dashboard.png`).
  - After the bill the Dashboard says "More goes out than comes in each month."
  - The card asks: "You said in November 2026 that $1,820 a month is invested. Left over each month now: $1,128. Still right?"
    with **Still right** and Answer again.
  - "Still right" saves `{ monthly: 1128.4 }` and leaves the row at **$1,820**. Notice: "Saved: still right. We will ask again in a
    year, or when the $1,128 left over changes by more than a quarter. Your retirement answer: still lasts to the end (age 97)."
    The card then reads "$1,820 a month into Investments for later, invested (you said so)" and never asks again; the retirement
    answer keeps counting $692 a month the household does not have.
  - Smaller rises are never asked about (`rise.mjs`): bills of $100, $300, $450 leave Next best action's month at −$92, −$292,
    −$442, and the card still says "$1,820 a month … invested (you said so)" with only "Change my answer". Only at $460 (25.2%)
    does it ask.
- **Fix.** In `leftoverStanding`, set `again = "short"` whenever the answered row is more than the left-over it came from
  (`rowMonthly > total + 0.5`), whatever the 25% rule says. For that case the row says "You said $1,820 a month is invested;
  only $1,128 is left over now." and its actions are "Lower it to $1,120 ›" (floor to $10, applyLeftover with that amount) and
  "Answer again"; no "Still right". `keepLeftover` never keeps a row above `total`. Tests: answered $1,820, a $100 bill →
  asked; "Still right" is not offered while the row is above the left-over.

### B4 (3). A double tap on "Check the numbers behind this ↓" opens another page; a double tap on "It matches" cancels the form
- **Steps.** Tap the hero's filled button twice at the same spot, 120, 300 or 700 ms apart (`b3.mjs`). And on Contributions'
  "No match on file. Is that right?" tap "It matches" twice (`b13.mjs`).
- **Evidence** (390 px).

  | household | gap | what was under the thumb at the second tap | where the person ends up |
  |---|---|---|---|
  | Dana & Lee | 300 ms | the row "What Lee's job adds (the match)" | `#/retirement/contributions?match=…` (Lee's match box, focused) |
  | Dana & Lee | 700 ms | the link "Check the match ›" | the same |
  | Jamie | 120 ms | the card heading, then the match link as the smooth scroll ends | `#/retirement/contributions?match=…` |
  | Casey | 120 ms | the left-over row, then "Read it from a pay stub ›" | `#/ai/reader?kind=paystub` |
  | the other 5 runs (incl. 320 dark) | | a row's text | stayed |

  `shots/b3-couple2k-390-700-before2nd.png` shows "Check the match ›" exactly where the button was. "It matches" at 700 ms: the
  smooth scroll puts the form's **Cancel** under the thumb and the second tap closes the match form it just opened
  (`b13` log: `underFingerAt2ndTap: BUTTON "Cancel"`, `editFormOpen: null`).
- **Cause.** Both buttons scroll the page under the finger (`openLevers` `scrollIntoView({behavior:"smooth", block:"start"})`;
  `focusBox(..., tapped)` smooth to centre) and put links or Cancel where the button was.
- **Fix.** After a tap that scrolls, ignore taps in the card (or the form) for about 800 ms: a capture-phase `click` listener on the
  card that `preventDefault`s and `stopPropagation`s while `performance.now() < until`. Or land the card so a heading or the intro
  paragraph (not a link) sits where the button was. Kit test: double tap at 120, 300 and 700 ms on the hero button for Dana &
  Lee, Jamie and Casey stays on Will the money last? with the card heading focused.

### B5 (3). After "Pay the tax now", the card's match lever and "Check the match ›" put the employer's money on the Roth 401(k)
- **Steps.** Jamie with the "No match" answer taken back (a person who never answered it). Contributions → the row → Pay the tax
  now → Save. Will the money last? → card → "What Jamie's job adds (the match)" → "Check the match ›" → type 2040 → Save.
- **Evidence** (`b7.mjs`, `b8.mjs`; `shots/b8-390-land.png`, `b8-390-saved.png`).
  - After "Now": `Roth 401(k) at work [roth]: $250, match 0` (the 401(k) row is gone, no match, so no $0 later row).
  - The card's match row: "Not counted · No match on file · If Jamie's job matched like most (about $2,040 a year): runs out at 76."
    Its alternative writes the match on the Roth row.
  - The link lands on "Edit: Roth 401(k) at work", match box focused, with no "Most plans add the employer's money as
    pay-the-tax-later." line (D-C2's words show only when a Roth row already carries a match).
  - Saved: `Roth 401(k) at work [roth]: $250, match 2040`. Notice: "now runs out at 76 (was 71)".
  - By code (`b8n.mjs`): the same $2,040 on a $0 pay-the-tax-later row (D-C2) gives **75**. The card and the notice are one year
    rosier, from tax-free growth of money that is taxed when it comes out. The spec: "Until L9, the split never puts a match on a
    Roth row."
- **Fix.** When the person's rows at work are Roth only, the match alternative (`leverList` match row) and the `?match=` landing
  write the match through `applyTaxChoice(draft, rowId, { choice: "now", match })`, which keeps it on a $0 pay-the-tax-later row;
  show `ROTH_MATCH_WORDS` on the landing whenever the row is a Roth 401(k). Test: after "Now", the card's match effect equals the
  answer with the match on a pay-the-tax-later row, and saving the landing leaves `employerMatch: 0` on every Roth row.

### B6 (2). "Before your change: runs out at 70. Now: runs out at 70." after a balance update that changed nothing
- **Steps.** Jamie, 390. Will the money last? → Net worth → Checking → Edit → $3,000 → $3,100 → Save → Back.
- **Evidence** (`b11.mjs`; `shots/b11-390-balance-update.png`): the hero, in bold, under "Runs out in 2052": "Before your change:
  runs out at 70. Now: runs out at 70." Nothing is named. By code (`key.mjs`): a $100 balance change moves the drawing key
  (`d.inputs`) with the same answer; a $20 bill gives the same line plus "You changed the money left over each month ($567 a
  month → $547 a month)". Updating balances is the monthly routine, so this shows every month.
- **Fix.** Draw `beforeLine` only when the answer words differ (`answerWords(before) !== answerWords(now)`, or with both lasting
  the money left differs by $100 or more) or when a lever the person sets was named (`moved` without the left-over row, or
  `taxMoved`). Test: a $100 checking change and a renamed account draw no line.

### B7 (2). Deleting the "Investments for later" account on Net worth leaves the $1,820 a month counted
- **Steps.** Dana & Lee: card → Answer → Invested for later → $1,820 → Save (a new $0 account). Net worth → the account's
  Delete → OK. Back to Will the money last?
- **Evidence** (`b10.mjs delete`; `shots/b10-390-deleted-account.png`): the account is gone but `leftover-1` ($1,820 a month)
  stays. The hero still says "The money lasts" with "Before your change: lasts to the end (age 97), about $1,425,000 left in
  today's dollars. Now: lasts to the end (age 97), about $1,425,000 left in today's dollars." By code (`acct.mjs`) the answer with
  the account deleted is the same as with it (endReal 1,425,494): the row still counts. Only Contributions says "A contribution
  points to an account that is no longer on file." A person who deletes the account the answer made is undoing the answer.
- **Fix.** In `levers.js` `leftoverAnswer`, treat an answer whose row points to a missing account as not answered (the row reads
  "The account this went into is no longer on Net worth. Answer again ›", and saving replaces the row). Ask the owner of Net worth
  to take a deleted account's contribution rows with it, as People's `removePerson` already does. Test: delete the account →
  the card asks again and the answer equals the one before the left-over was answered.

### B8 (2). "Read it from a pay stub ›" with a Roth-only stub writes the Roth money onto the pay-the-tax-later row
- **Steps.** The card links Casey and Jamie to `#/ai/reader?kind=paystub` (L2). At this HEAD the reader is pre-L7. Run three
  invented stubs through its own `readFields` / `proposals` / `applyProposal` for Dana after a 4% / 2% split (`stub.mjs`).
- **Evidence.**
  - "no 401(k) line": no 401(k) proposal (fine).
  - "only ROTH 401K 180.00": `k401: 180` → "401(k) per paycheck: 180" → Use it makes `Dana's plan at work: $180/biweekly`
    (was $260 a month) beside `Dana's Roth 401(k) at work: $130/monthly`: $390 a month of Roth money counted pre-tax, and Dana's
    own money $520 a month instead of $390.
  - "401K 120 + ROTH 401K 60": only the first line is read (the person critic's F12).
- **Fix.** Leave "Read it from a pay stub ›" out of `leverList` until L7 lands; L7's regex must skip a line with "Roth" for the
  pre-tax field and read it into its own field. Test (L7): a ROTH-only stub proposes nothing for the pay-the-tax-later row.

### B9 (1). Changing the left-over answer leaves empty accounts behind on Net worth
- **Steps.** Dana & Lee: Answer → Invested for later ($1,820, new account) → Change my answer → It stays in the bank (A new
  account: Savings for later) → Change my answer → It gets spent / not sure.
- **Evidence** (`b10.mjs change`; `shots/b10-390-networth.png`): after the last answer no row is left, but Net worth lists
  "Investments for later $0" and "Savings for later $0".
- **Fix.** Keep the id of an account the answer made (`retirement.leftover.accountId`, optional, DATA_MODEL line); when a later
  answer moves away from it and it is still $0 with no history and no other row, remove it in the same `store.update`, and say so
  in the notice. Test: invest → bank → spend leaves the accounts as before the first answer.

### B10 (1). The left-over row moved into the 401(k) on Contributions still says "kept in the bank"
- **Steps.** Jamie answers "It stays in the bank" into his Savings ($560). On Contributions (D-B7 lists the row), change "Into
  which account" to the 401(k).
- **Evidence** (`edit.mjs`): the card reads "$560 a month into Jamie's plan at work, kept in the bank (you said so); $90 a month
  more is left over · If it were invested instead: runs out at 89. If the other $80 a month were invested too: runs out at 89."
- **Fix.** Say "kept in the bank" / "invested" from the row's account bucket (`BUCKET_OF[type] === "cash"`), and ask again when
  the row's account no longer matches the answer.

### B11 (1). "Answer" opens and closes on a double tap, with the same label both ways
- **Steps.** Card → Money left over → tap "Answer" twice, 120, 300 or 700 ms apart (`b2b.mjs`, Dana & Lee and Jamie).
- **Evidence.** All six runs end with the panel closed, `aria-expanded="false"`, focus on "Answer". The panel opens below the
  button with a "nearest" scroll, so a person who does not see it at once taps again and loses it.
- **Fix.** Make "Answer" only open (Cancel closes), or change its words to "Close" while open.

## Checked and found sound (by running code or on screen)
- **Every qa plan through the new pure functions** (`sweep.mjs`): 1,446 plans (every `qa/fixtures` plan, the 14 archetypes with
  every common and special pack variant, including no people, dependents only, no birth date, born 1900, $1e9 expense, $1e12
  balance, zero amounts, two "Me", a 101-year-old dependent; the five phone households; the empty plan). `leverRows`,
  `restsOnWords`, `workLanding`, `matchChecks`, `taxPairOf` + `applyTaxChoice` (some / now / later on every row at work),
  `mixAtRetirement` (sums to 100), `applyLeftover` (invest / bank / spend) + `leftoverStanding`, Assumptions, Paycheck and Work
  benefits: **0 throws, 0 non-finite figures, 0 "NaN/undefined/null" in any sentence**, `leverRows` never mutated a plan, the
  split kept the own total and the match on every one-job row, and never put a match on a Roth row. 269 s.
- **Odd plans** (`odd.mjs`): birth date `0198-05-01`, `1098-05-01`, `""`, no people, no accounts → the card is simply not drawn
  (`ready: false`); `2198-05-01`, `19800-05-01`, `1980-13-45`, pay $1e9 ("the $48,249,672 left over each month"), pay 0, a
  $1e9-a-month 401(k), a $1e12 match, stocks 500% with inflation −50% → finite figures. (`"abcd"` throws in
  `projection/compute.js:1089`, claude-c's file; the same throw at fa2026e, so not this track's.)
- **A person removed after a left-over row** (`rm.mjs`, People's own `removePerson`): removed with their things, the row and the
  answer go with the account and the card has no left-over row; kept as the household's, the card asks again ("You said … $1,820
  … Left over each month now: $1,128. Still right?"), which then meets B3.
- **Browser sweep** (`b12.mjs`): Will the money last? (card opened), Contributions, Assumptions, Paycheck and Work benefits for 22
  plans (kit households sam, renterDebt, family, retiredCouple, jordan, patLee, ruth, freelancer, demo; the five phone households;
  the odd plans above; Dana & Lee invested then Dana removed both ways), each at 320 dark and 390 light: 220 page views, no page
  or console error, no sideways scroll, no "NaN/undefined/null" on screen, no card left busy.
- **Double taps that are safe** (120, 300, 700 ms): "Save my answer" on the left-over panel (one account, one `leftover-1`
  row, one notice; `b1.mjs`); Contributions' "Save changes" with Some of each and with Pay the tax now (one Roth account, rows
  right; `b9.mjs`); "That's right" and "Not sure" on the match check (`b13.mjs`); the panel's chips and Cancel.
- **The track's own tests** in my copy: levers, tax-split, contributions, assumptions, paycheck, benefits: 113 pass, 0 fail.

## Not in this track
OFX / QFX / QBO files (two accounts, broken or truncated, a CSV renamed .qfx, a QFX renamed .txt) and account numbers in the saved
plan after an import belong to L8, and the pay-stub reader's Roth line to L7: neither is in fa2026e..71ff05a (no change to
`transactions/import`, `core/ofx.js` or `ai/reader`). The only contact is the card's "Read it from a pay stub ›" link (B8). No
flow in this track stores an account number (the accounts it makes are `{ id, name, type, balance: 0, asOf, ownerId, history }`).

## Try on a real iPhone (only Chromium is installed; Safari was not walked)
- B4 on Safari: double tap "Check the numbers behind this ↓" and "It matches" (iOS may treat a quick double tap as zoom unless the
  page sets `touch-action: manipulation`; a slower second tap is the case above).
- "Answer" on the left-over row: does the panel open in view, or does the person tap again (B11)?
- The tax chips and the merge back to one box (B2) with the iOS text keyboard ("4%" typed with the % key).
- "Still right" (B3) after a bill is added on the same phone.
- Nothing new in the track needs more than Safari 15.4 (`Array.prototype.at`, `replaceChildren`, `Element.before/after`,
  `focus({ preventScroll })`, smooth `scrollIntoView`), all already used elsewhere in the app.

## Clean-up
- The server on 9761 was started by `rv/ret/break/srv.mjs` (pids in `srv.pids`) and stopped by that pid; the port answers no more.
- `rv/v-ret-break` was removed with `git worktree remove`. Nothing in `$REPO` or `rv/b-ret` was edited.
