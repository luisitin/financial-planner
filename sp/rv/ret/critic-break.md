# Break critic, track "ret" (L2-L6), second pass: claude-b's worktree rv/b-ret at 1942862 (base fa2026e)

Second pass, 2026-11-12. The first pass (at 71ff05a, findings B1-B11) is kept as
`$SP/rv/ret/break/critic-break-round1-71ff05a.md`.

**What was reviewed**
- The committed track HEAD **1942862** (L2-L6 plus `fixup! "What this rests on"`), from a detached copy `rv/v-ret-break`,
  served on 127.0.0.1:9761.
- The builder's **uncommitted** work in `rv/b-ret` (5 files and `tests/levers-saves.test.mjs`, last touched 02:54, an
  interrupted fix round), from a second copy `rv/v-ret-break-wip` (1942862 plus that diff, saved as `ret/break2/wip.diff`),
  served on 9762. Findings are stated for HEAD; each says whether the uncommitted work changes it.
- Sandbox only, the kit's Chromium with an iPhone user agent, real touch taps, 390 and 320 px, light and dark.
- Scripts and logs: `$SP/rv/ret/break2/`
  (`n*.mjs` new walks, `b*.mjs` the first pass's walks run again, `sweep2.mjs`, `sweep3.mjs`, `b12.mjs`, `b12b.mjs`, `logs/`).
  Screenshots (99): `$SP/rv/ret/break2/shots/`
  (file names below are in that folder).
- Only what I confirmed on screen or by running code is listed. The other critics' items are not repeated; where one touches
  mine it is named (person P5, P16, P20).

**Severity.** 4 = the plan silently loses, moves or invents money the person put in. 3 = a tap does something the person did
not ask for, or a figure on screen rests on the wrong rule after an ordinary action. 2 = the screen says something untrue
after an ordinary action. 1 = clutter, or a slip a person can work around.

## Where the first pass's findings stand at 1942862

| # | first pass | at 1942862 (run again) | in the uncommitted work |
|---|---|---|---|
| B1 (4) | two jobs: one job's row takes over the Roth 401(k) of the other | **still there** (`b4.mjs`; `sweep3.mjs`, below) | still there (`logs/b4-wip.log`) |
| B2 (4) | a split taken back loses the pay-the-tax-now part (4% + $130) | **still there** (`logs/b5-head.log`: $390 a month becomes $260) | `merge()` not touched |
| B3 (4) | "Still right" keeps more invested than is left over | **still there**, and worse with a bigger bill (below) | not touched |
| B4 (3) | double tap on the hero button opens another page | **fixed**: 10 runs (Dana & Lee, Jamie, Casey at 120, 300, 700 ms; 320 dark) all stay on the page | |
| B4 (3) | double tap on "It matches" closes the form | **still there** at 700 ms (`logs/b13-700-itmatches-head.log`: Cancel under the thumb, form closed) | fixed (the form stays open); person P5 |
| B5 (3) | "Check the match ›" puts the employer's money on the Roth 401(k) | **still there** (`logs/b8-head.log`: match 2040 on the Roth row, "now runs out at 76 (was 71)") | not touched |
| B6 (2) | "Before your change: 70. Now: 70." after a balance update | **fixed** (`logs/b11-head.log`: no line) | |
| B7 (2) | deleting "Investments for later" leaves the $1,820 a month counted | **still there** (`logs/b10-delete-head.log`; the card: "$1,820 a month into an account, invested (you said so)") | not touched |
| B8 (2) | Roth-only pay stub read as pay-the-tax-later | **closed for now**: the card no longer links to the reader. Spec acceptance A-3 ("Read it from a pay stub ›") is open until L7 lands; put the link back with L7 | |
| B9 (1) | changed answers leave empty accounts on Net worth | **still there**; also two accounts both named "Investments for later" (`n4.mjs twice`) | person P20 |
| B10 (1) | a left-over row moved into the 401(k) still says "kept in the bank" | **still there** (`edit.mjs`) | not touched |
| B11 (1) | "Answer" opens and closes on a double tap | **still there** (`logs/b2b-300-head.log`) | not touched |

B1, B2, B3 and B5 are the four that change money. Their fixes are in the first pass's report and are repeated in the
structured findings.

**B1 at scale.** The 14 qa archetype households carry no retirement contribution rows at all (`cnt.mjs`), so the track's
"every qa household" tests try the split on almost nothing (22 rows in 1,446 plans). `sweep3.mjs` gives every base household
rows at work in twelve shapes: 684 plans, 1,005 rows at work, 3,015 splits. For a person with two pay-the-tax-later accounts,
715 of 1,431 splits rewrote or removed a row of the other job. A new chain from the same cause: after "Pay the tax now" on one
job's row, the Roth 401(k) row it makes is paired with the *other* job's 401(k) row, so opening it shows that job's money in
the "pay the tax later" box, and "Pay the tax now" there sets the other job's row to $0.

**B3 with a bigger bill** (`n1.mjs 390 "" 2500`; `n1-head-390-2500-stillright.png`). Dana & Lee answer $1,820 invested, then add a
$2,500 a month bill. The card: "You said in November 2026 that $1,820 a month is invested. Left over each month now: -$672.
Still right?" Tap **Still right**: "Saved: still right. We will ask again in a year, or when the -$672 left over changes by more
than a quarter. Your retirement answer: still runs out at 93." The plan keeps `leftover-1` at $1,820 with `monthly: -671.6`; the
same card says "If it's all invested: runs out at 73", which is the answer without money the household does not have.

## New findings, most severe first

### N1 (3). Work benefits "Use 31.4%" after a split: the plan then holds 33.4% of pay, $1,560 over the year's limit
- **Steps.** Dana (Dana & Lee) with the split the spec's acceptance makes: 4% pay-the-tax-later ($260 a month, the match on it)
  and 2% into "Dana's Roth 401(k) at work" ($130 a month). Work benefits → **Use 31.4%** (the most the limit allows).
- **Evidence** (`n7.mjs`, 390 and 320; `n7-head-390-last-after.png`, `n7-head-390-last-contributions.png`).
  - Before: "6% of pay: what you put in now" (both rows counted, D-C7).
  - Notice: "Your 401(k) is now 31.4% of pay on the Retirement contributions page ..."
  - Plan after: `Dana's plan at work $2,041.67 a month` and `Dana's Roth 401(k) at work $130 a month` = $26,060 a year,
    **33.41%** of $78,000, against the page's own limit of $24,500. Behind the toast the page already says "33.4% of pay: what
    you put in now ... $942 a paycheck". Contributions lists $2,042 and $130.
- **Cause.** `career/benefits/compute.js` now counts the Roth 401(k) rows (D-C7), but `use401k` in `career/benefits/view.js`
  still scales only the rows into `type === "401k"` accounts up to the whole choice (`o.yearly`), and leaves the Roth row.
- **Fix.** In `use401k`, take the person's rows at work with the same test compute uses (401(k), or a Roth account whose
  `limitKind` is `401k`). Keep the Roth dollars as compute's `option()` assumes ("kept in dollars"): pay-the-tax-later rows get
  `max(0, o.yearly - nowRoth)` by share, and the Roth rows are scaled down only when `o.yearly < nowRoth`. Test: after a 4% /
  2% split, "Use N%" leaves the person's own money a year equal to `o.yearly` (within $1) and never above the limit.
- **Uncommitted work:** the same (`logs/n7-wip.log`).

### N2 (3). A Roth 401(k) the app knows only by its match stops being one when the split moves the match
- **Steps.** Jamie's plan at work is a Roth account named "Roth at Acme", $250 a month, the employer adds $1,500 (the app's
  rule before L6: a Roth row "with an employer match or a name that says 401(k)" is a Roth 401(k)). Contributions → the row.
  The tax question says "Most plans add the employer's money as pay-the-tax-later. Saving an answer here puts it there."
  Tap **Some of each**, 100 and 150, Save.
- **Evidence** (`n6.mjs`, 390 and 320 dark; `n6-head-390-limits.png`, `n6-head-390-roth-reopened.png`).
  - Notice: "Saved: $100 a month paying the tax later with the match, and $150 a month into Roth at Acme, paying the tax now."
  - Before: "Jamie: 401(k) / 403(b) $3,000 of $24,500"; Paycheck "Roth 401(k), after tax −$115.38".
  - After: "401(k) / 403(b) $1,200 of $24,500" and a new line "**IRA (traditional and Roth together) $1,800 of $7,500**".
    Paycheck has no Roth 401(k) line (take-home is $69 a paycheck too high). Opening "401(k) at work" shows "Pay the tax later",
    100, no second part; opening "Roth at Acme" shows no tax question at all.
  - By code (`sweep3.mjs`, shape `rothMatch`): in 74 "some" splits and 74 "now" splits the Roth part drops out of the person's
    money at work (own money a year 14,020 → 8,412, and → 0); a larger Roth part would be flagged as over the IRA limit.
- **Cause.** `applyTaxChoice` sets `employerMatch = 0` on the Roth row; `isNowAccount` / `limitKind("roth", name, 0)` then
  reads "Roth at Acme" as a Roth IRA.
- **Fix.** When `applyTaxChoice` takes the match off a Roth row whose account is a Roth 401(k) only by that match
  (`limitKind("roth", acct.name, 0) !== "401k"`), rename the account in the same save so its name carries it, for example
  `"Roth at Acme (Roth 401(k))"`, and say so in the notice. Test: for every Roth row with a match, after "some" and "now" the
  person's own money at work a year is unchanged and `limitKind` of the Roth row is still `401k`.
- **Uncommitted work:** the same (`logs/n6-wip.log`).

### N3 (3). On a row at work, a changed tax answer with an empty or zero box deletes the row and says "Saved: $0 a month"
- **Steps.** Jamie → Contributions → "Jamie's plan at work" ($250 a month) → tap **Pay the tax now** → clear the amount box →
  Save. (Or **Some of each**, 0 and 0, Save.)
- **Evidence** (`n3.mjs blank`, `zero`; 390 and 320 dark; `n3-head-blank-320-dark-saved.png`, `n3-head-zero-390-saved.png`).
  - Notice: "Saved: $0 a month goes into Roth 401(k) at work, paying the tax now. This year's federal tax: about $360 more than
    before. Your money when retirement starts (2047): 100% pay-the-tax-later."
  - Plan: `retirement.contributions` is **empty**. The $250 a month row is gone; the page goes back to "Does Jamie's job add
    money ...?". With the chip left alone the same blank box is refused ("That isn't an amount").
  - A typed 0 on the plain form keeps a $0 row ("nothing (you said so)" on the card); here the row is removed and the card says
    "nothing on file · Not counted".
- **Cause.** With a pair, the amount box is `required: false`, `eachOf("")` is `{ each: 0 }`, and `applyTaxChoice` takes out a
  row with no own money and no match.
- **Fix.** In `saveTax`, refuse `sp.later + sp.now <= 0` unless the person typed a 0 ("Type how much goes in each time, like
  250."); for a typed 0, keep the pay-the-tax-later row at $0 (never `takeOut` the row being edited). The red "Remove this
  contribution" stays the only way to remove a row. Test (fake DOM): chip changed + blank → error, rows unchanged.
- **Uncommitted work:** the same (`logs/n3-blank-wip.log`).

### N4 (3). A double tap on the card's "Change ›" (Spending in retirement) opens another page
- **Steps.** Will the money last? → card → "Spending in retirement" → tap **Change ›** twice at the same spot.
- **Evidence** (`n10.mjs`; 16 runs on this link, 4 ended elsewhere).

  | household | gap | where the person ends up |
  |---|---|---|
  | Dana & Lee, 390 | 200 ms | Goal seek (`n10-head-couple2k-spending-200.png`) |
  | Dana & Lee, 390 | 400 ms | If history repeated |
  | Jamie, 390 | 300 ms | Chance the money lasts (1 run of 2) |
  | Jamie, 390 | 500 ms | Healthcare before 65 |

  The link is `#/retirement/projection?type=spending`: the same page is drawn again from the top and then moved to the
  settings fold, so the hero's and the chart's links pass under the thumb. The other 48 double taps on the card's actions
  (Jamie, Casey, Dana & Lee at 300 and 700 ms: Answer, the match, Social Security, People, Assumptions, the mix) were safe.
- **Cause.** The fixup's tap hold is set only by the hero button.
- **Fix.** In the card, do not follow the same-page link: on its click, `preventDefault()`, `holdTaps()`, open the settings fold,
  scroll to and focus the spending box (what the "mix" button already does). Or call `holdTaps()` from a capture `click`
  listener for every `a[href^="#/retirement/projection"]` and the mix button. Kit test: double tap at 200, 300, 400, 500 ms
  for Jamie and Dana & Lee stays on Will the money last?.
- **Uncommitted work:** not touched.

### N5 (2). After a split, "Into which account" and "Whose" are ignored, and the page says Saved
- **Steps.** Dana after the 4% / 2% split. Contributions → "Dana's plan at work" → change **Into which account** to "Lee's plan
  at work" → Save.
- **Evidence** (`n3.mjs acct`; `n3-head-acct-390-form.png`). Notice: "Saved: $260 a month paying the tax later with the match,
  and $130 a month into Dana's Roth 401(k) at work, paying the tax now." The rows are unchanged: the row still goes into
  "Dana's plan at work". The same happens whenever the chip is changed in the same edit. A row with one answer on file and
  the chip left alone takes the plain path, which does move it.
- **Cause.** `saveTax` reads only the two boxes, the period and the match; `v.accountId` and `v.personId` are dropped.
- **Fix.** In `saveTax`, when `v.accountId` or `v.personId` differ from the edited row's, either apply them to that row after
  `applyTaxChoice` (only to an account of the same kind: a 401(k) for the later row), or refuse with "Change the account
  first, save, then answer the tax question." Test: split row + another 401(k) chosen → the later row's `accountId` is the
  new one, or an error is shown and nothing is saved.
- **Uncommitted work:** the same (`logs/n3-acct-wip.log`).

### N6 (2). "You just changed this: $1,820 a month invested → $1,820 a month." about an answer the person did not touch
- **Steps.** Dana & Lee answer "Invested for later" $1,820. On Expenses add a $700 a month bill. Back.
- **Evidence** (`n1.mjs`, 390 light and 320 dark; `n1-head-390-700-row.png`, `n1-head-390-2500-stillright.png`).
  - Hero and the card's green notice: "... You changed **the money left over each month ($1,820 a month invested → $1,820 a
    month)** and spending in retirement ($4,890 a month → $5,590 a month)."
  - The left-over row: "**You just changed this:** $1,820 a month invested → $1,820 a month."
  - After "Still right": "You just changed this: $1,820 a month → $1,820 a month invested." (person P16 has this last form.)
  - By code (`sweep2.mjs`, 1,446 plans, HEAD and the uncommitted work): 18 more sentences of the shape "($5,980 a month →
    $5,980 a month)".
- **Cause.** The fixup compares `cmp ?? short` across the row's three states (not answered / answered / asked again), whose
  `short` words differ in form while the amount is the same.
- **Fix.** In `leverList`, give the left-over row one `cmp` in every state: `"not counted"` while not answered, else
  `` `${answer}:${Math.round(rowMonthly)}` `` (asked again or not). In `changedKeys`, drop an entry whose `from === to`. Test:
  answered $1,820 → a bill that makes the card ask again → `changedKeys` has no left-over entry; "Still right" adds none.
- **Uncommitted work:** the same (`logs/n1-wip.log`).

### N7 (1). After the hero button, taps on the page are dead for up to 2.3 seconds
- **Steps.** Tap "Check the numbers behind this ↓", then tap "Answer" in the card.
- **Evidence** (`n2.mjs`, `n2b.mjs`, Dana & Lee, 390). With the page at rest: a tap at 0.45 s and 0.8 s does nothing; from 1.1 s
  it works. With the page still gliding (a flick on down the card, scroll events until 1.9 s): taps at 2.0 s and 2.25 s do
  nothing, 2.45 s works. Nothing shows that the tap was let go.
- **Fix.** Let go only the tap that is the double tap: in the capture listener, compare with the first tap's place
  (`Math.hypot(dx, dy) < 40` px) and time (under 800 ms), and drop the stretch on every scroll.

### N8 (3, uncommitted work only). Contributions lets the chip tap and Save go after a row is opened; Save then keeps the old answer
- **Steps** (the copy with the uncommitted diff). Jamie → Contributions → tap the row → tap **Pay the tax now** → Save.
- **Evidence** (`n8.mjs`, WIP=1, 390; the same script at HEAD saves "Pay the tax now" in all four runs).

  | chip tapped at | chip after | Save tapped at | result |
  |---|---|---|---|
  | 0.7 s | still "Pay the tax later" | 1.5 s | nothing, form still open |
  | 1.2 s | still "Pay the tax later" | 1.9 s | nothing, form still open |
  | 1.2 s | still "Pay the tax later" | 2.3 s | "Contribution saved." with $250 still pay-the-tax-later |
  | 1.2 s | still "Pay the tax later" | 3.2 s | the same |

  The first pass's `b5.mjs` on that copy lost a Save the same way (`logs/b5-wip.log`).
- **Cause.** `holdTaps()` on a tap of a list row (1 s, stretched 400 ms by every scroll for 2 s), on the whole page.
- **Fix before it is committed.** Hold only "It matches" (the case it was written for), and only a second tap at the same
  place (as N7). Kit test: row → chip at 0.7 s → Save at 1.5 s saves the chip's answer.

## Checked and found sound (by running code or on screen)
- **Every qa plan through the new pure functions, again** (`sweep2.mjs`, 1,446 plans, HEAD and the uncommitted work, 748 s
  each): `leverRows`, `restsOnWords`, `workLanding`, `matchChecks`, `taxPairOf` + `applyTaxChoice`, `mixAtRetirement`,
  `applyLeftover` + `leftoverStanding`, Assumptions, Paycheck, Work benefits, and the fixup's `valuesOf`, `changedKeys`,
  `changedWords`, `answerChangeWords` (16,292 sentences): 0 throws, 0 non-finite figures, 0 "NaN / undefined / null", no plan
  mutated. Only N6's "X → X".
- **Rows at work in twelve shapes** (`sweep3.mjs`, 684 plans: a 401(k), plus a Roth 401(k), two jobs, IRAs only, a 401(k) and
  IRAs, a household row, 5% of pay every two weeks in a 403(b), a job left, a Roth known by its match, $1e9 a month, a row
  whose account is gone, a $0 row; with and without pay): 0 throws; every figure finite in the card, Paycheck, Work benefits
  and the Federal estimate before and after each split; an IRA is never paired; the mix adds to 100; "all later" never raised
  and "all now" never lowered this year's federal tax; the same answer saved twice is the same on one-job rows. The failures
  are B1 (two jobs) and N2.
- **Browser sweeps at HEAD.** The first pass's (`b12.mjs`): 22 plans × 5 pages × 320 dark and 390 light = 220 page views. A
  new one (`b12b.mjs`): 23 more odd plans (two jobs; a Roth 401(k) only; IRA rows; a plan at work with no account; a household
  row; a row whose account is gone; the 401(k) deleted; retired at 40; retire at 200; live to 30; a left-over answer whose
  account is gone, with a bad date, an unknown answer, two years old, a yearly row for a person who is gone; Assumptions as
  strings, zeros, nulls and 12%; `workPlans: null`; every figure 0; pay $1; only the partner works) × 12 routes (the three
  pages, `?check=1`, `?add=<pid>`, `?add=nobody`, `?match=<row>`, `?match=no-such-row`, `?show=returnStocks`, `?show=bogus`,
  Paycheck, Work benefits) × 2 = 552 page views. No page or console error, no sideways scroll, no "NaN / undefined / null",
  no card left busy, no empty page.
- **The left-over panel** (`n4.mjs`). Amounts: blank, 0, -5, abc and 0.004 are refused in words; "1,000" saves $1,000;
  99999999 is refused ("more than is left over each month ($1,828)"); 1820.999 saves $1,821. The same answer saved twice: one
  row `leftover-1`, one account. Reload, and Back then Forward, with the panel open and an amount typed: nothing saved, the
  page whole. Double taps (120, 300, 700 ms) on "Still right" land on the notice; on "Save my answer" (spent) save once.
- **Assumptions** (`n5.mjs`): "Careful 6%" then Save tapped once and double-tapped at 120, 300, 700 ms: one save, "now runs out
  at 69 (was 70)" stays.
- **The fixup's "Before your change" line** (`n9.mjs`): three answers in a row on Dana & Lee (invested, spent, in the bank): the
  grey bar is filled each time and the two headlines are the right ones.
- **The split saved twice, and with the period changed** (`n3.mjs acct`, `period`): rows unchanged the second time; "every two
  weeks" is kept on both rows. A guessed match left alone stays "our guess"; a match typed in the same save is the person's.
- **The track's tests in my copies:** HEAD 198 pass, 0 fail (levers, levers-before, tax-split, contributions, assumptions,
  paycheck, benefits, projection); the uncommitted work 142 pass, 0 fail (with levers-saves). `npm run check` OK and
  `node tools/leak-guard.mjs --worktree` OK (2,873 files) at 1942862. I did not run the whole `npm test`.

## Not in this track
OFX / QFX / QBO files, account numbers in the saved plan after an import, and the pay stub reader's Roth line belong to L7 and
L8: `fa2026e..1942862` does not touch `transactions/import`, `core/ofx.js` or `ai/reader`. No flow in this track stores an
account number (the accounts it makes are `{ id, name, type, balance: 0, asOf, ownerId, history }`).

## Try on a real iPhone (only Chromium is installed; Safari was not walked)
- N4 and B4: the double taps (iOS may read a quick double tap as zoom unless the page sets `touch-action: manipulation`).
- N7: tap the hero button, flick on down, tap "Answer": does the first tap take?
- N3: the "Go" key on the keyboard with the amount box empty after a chip was changed.
- N1: "Use N%" on Work benefits after a split, then Contributions' limits.
- B2: "4%" typed with the % key, then "Pay the tax later".

## Clean-up
- The two servers (9761, 9762) were started by `rv/ret/break2/srv.mjs` (pids in `srv.pids`) and stopped by pid; both ports
  answer no more.
- `rv/v-ret-break` and `rv/v-ret-break-wip` were removed with `git worktree remove`. Nothing in `$REPO`
  or `rv/b-ret` was edited (its 5 changed files and one new test are as I found them).
