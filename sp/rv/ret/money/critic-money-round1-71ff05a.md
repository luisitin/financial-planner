# Money critic, track "ret" (L2-L6), claude-b's worktree rv/b-ret at 71ff05a (base fa2026e)

Reviewed 2026-11-12 from a detached copy `rv/v-ret-money` at 71ff05a, served on 127.0.0.1:9741 (sandbox, Chromium with an
iPhone user agent). Base snapshot for comparisons: `git archive fa2026e` in `rv/ret/money/base`. My scripts and outputs:
`rv/ret/money/` (`*.mjs`, `out-*.json`); screenshots: `rv/ret/money/shots/`. Only what I confirmed on screen or by running code
is listed. Severity 5 = a wrong figure a person would act on.

## Findings

### M1 (severity 5). "Money left over each month" counts money the plan already puts toward goals; for a household already short it shows a left-over that does not exist
- **What.** `levers.js` reads the left-over as `leftOverOf(spare)` (`levers.js:468`), which is NBA's left-over **with the goal
  saving added back** (`core/math/leftover.js` `leftOverOf`). The card's row, its three effect lines, the hero line ("1 thing is
  not counted yet: the $X left over") and the panel's prefilled amount all use that figure. Saving the answer writes a row of
  that size, so the goal money is spent twice: once on the goals, once invested. The Dashboard's own "Left over each month" is
  the figure after goals.
- **Steps (Priya & Tom, `qa/households` 02-couple-no-kids base; goals take $1,000 a month).**
  1. Dashboard: "You're in good shape. Left over each month ... $4,861" (`shots/goals-couple-390-dash-before.png`).
  2. Will the money last? card: "Money left over each month · Not counted · $5,861 a month. If it's invested: lasts to the end
     (age 95). If it piles up in the bank: lasts to the end (age 95). As it is, counted as spent: runs out at 72."
     (`shots/goals-couple-390-panel.png`).
  3. Answer → Invested for later: the box holds 5,860. Save my answer: "Saved: $5,860 a month into Brokerage. Your retirement
     answer: now lasts to the end, age 95 (was: runs out at 72)."
  4. Dashboard: "More goes out than comes in each month. Left over each month −$999" (`shots/goals-couple-390-overview-dashboard.png`);
     Next best action: "About $999 a month more goes out than comes in, after tax and saving. Trim spending or pause a goal first.";
     Your plan: "In short: about $999 short each month".
- **Same on the main family fixture** (320 px, dark): Dashboard before "Your month works"; card "$4,834 a month" (NBA's
  left-over after goals is $3,884, goals take $950); after saving the prefilled $4,830: Dashboard "More goes out than comes in
  each month", Next best action "About $946 a month more goes out than comes in ... Trim spending or pause a goal first"
  (`shots/goals-family-320-dark-row.png`, `-overview-dashboard.png`, `-overview-next-best-action.png`).
- **A month that is already short (12-high-net-worth base).** Dashboard: "More goes out than comes in each month." Card and hero:
  "2 things are not counted yet: what goes into Victoria's 401(k) and the $5,343 left over each month"; row "Money left over each
  month · Not counted · $5,343 a month · If it's invested: lasts to the end (age 95) ... As it is: runs out at 89"
  (`shots/hnw-390-row.png`). NBA: spare.monthly −$2,657, goals $8,000 → leftOverOf $5,343.
- **Reach (by code, `rv/ret/money/goals.mjs`, `held.mjs`).** 17 of the 63 base plans save to goals: every qa archetype but
  13-in-crisis, the family, demo, card-gap and held fixtures. After investing the prefilled amount, NBA's month is short by the goal
  saving in each (01 −$243, 03 −$342, 07 −$895, 09 −$2,291, 12 −$7,997).
- **Why the tests missed it.** `tests/levers.test.mjs` checks "NBA spare.monthly after = before − amount", which holds; the
  phone-built households have no goals.
- **Fix.** In `levers.js` take the left-over the card asks about as the Dashboard's figure: `leftMonthly = spare ? (spare.full ??
  spare.monthly) : null` (that is `leftOverOf(spare) − spare.goalSaving`), so the row, effects, hero line, `leftoverStanding.total`,
  the panel's prefill and its "more than is left over" cap all use it; no row when it is under $50 (the short household gets none).
  Add tests: (a) 02-couple-no-kids and the family fixture: the row's figure equals NBA `spare.full`; (b) saving the prefilled
  answer leaves NBA `spare.full` ≥ 0 and the Dashboard verdict unchanged; (c) 12-high-net-worth: no left-over row and no "not
  counted yet: the $… left over" in the hero line.

### M2 (severity 4). "Some of each" does not keep the person's total: typing only the pay-the-tax-now part adds new money
- **What.** On "Some of each" the first box keeps the whole amount and the second starts empty (`contributions/view.js`
  `values`/`draw`); `applyTaxChoice` writes both as typed. Nothing keeps or checks the total, though spec risk 3 says "a split keeps
  the person's total own money" and the commit claims it. `tests/tax-split.test.mjs:39` passes only because it feeds 260 + 140 = 400.
- **Steps (Dana & Lee, 390 px).** Contributions → "Dana's plan at work" (amount box 400, match $2,400) → Some of each: "Pay the tax
  later: your own money" = 400, "Pay the tax now: your own money" empty → type 2% in the second box → the form says "Paying it all
  later would lower this year's federal tax by about $190." (`shots/split-390-form.png`) → Save changes.
- **Evidence.** Notice: "Saved: $400 a month paying the tax later with the match, and $130 a month into Dana's Roth 401(k) at work,
  paying the tax now. Your money when retirement starts (2044): 90% pay-the-tax-later, 8% already taxed (Roth), 2% regular savings."
  Rows: $400 + $130 = $530 a month (was $400); hero "$10,560 a year into retirement accounts, $8,160 of your own money" (was $6,600
  of own money). No retirement answer is given (D-C3), so the bigger saving silently improves Will the money last? The "$190" was
  worked out on all-later of $530, not on Dana's $400. In the builder's own walk (4% + 2% of $78,000 = $390, was $400) the same
  change shows "$190" in the form and "about $200 more than before" in the notice: two figures for one change.
- **Fix.** Keep the total: on entering Some of each, show the current total ("Now $400 a month in all") and make the pay-the-tax-now
  box take from it (on its change, set the later box to total − now in the same unit: dollars or % of pay); if the person changes
  the later box too and the sum differs, say so before saving ("That is $530 a month in all, $130 more than now. Save it?"). Work
  the form's tax line on the same total. Add a fake-DOM test that types only the second box and asserts the person's own money a
  year is unchanged.

### M3 (severity 4). "It stays in the bank" turns the bank savings into retirement saving on the Dashboard, Next best action, Benchmarks and Contributions
- **What.** The bank answer writes an ordinary contribution row into a savings account (spec B1). Every page that sums
  `retirement.contributions` calls it money going into retirement, and Next best action takes it out of the money that builds the
  emergency fund, though it is the very money going into the savings account.
- **Steps (Morgan, phone-built renter, 390 px).** Before: Dashboard "Left over each month ... About $6,400 a year builds up in
  checking and savings. $532"; Next best action "A full emergency fund (6 months): Done by about April 2027 at $532 a month."
  Will the money last? → Money left over → Answer → It stays in the bank → Into which account: Savings, $530 → Save my answer
  ("Saved: $530 a month into Savings. Your retirement answer: now runs out at 71 (was 65)", which equals the card's "If it piles
  up in the bank: runs out at 71": said = done holds).
- **Evidence after the save** (`shots/bank-renter-390-*.png`):
  - Dashboard: "Checking and savings stay about level over a year, and $6,400 goes into retirement. $2".
  - Next best action: "Retirement saving − $530 · Left over each month $2"; the emergency-fund step has no date any more
    ("$2,480 more reaches 6 months"), and "Spend less than you bring in: About $2 a month is left".
  - Benchmarks: "Saving for retirement: $6,360 a year goes into retirement accounts, employer money included: 11% of pay"
    (before: nothing went in).
  - Contributions hero: "$6,360 a year into retirement accounts. That is 11% of your pay".
  - Same by code for Jamie (bank $560): Your plan "About $80 a year builds up in checking and savings, and $9,700 more goes into
    retirement"; Benchmarks "15% of pay ... on par" (was 5%, behind); NBA's next step loses "2028-03-12".
  - Invested into a brokerage (Dana & Lee) also reads as "into retirement accounts ... 24% of pay" on Benchmarks (was 7%).
- **Fix.** Count a row into a cash account (projection `BUCKET_OF[type] === "cash"`) as money that stays in checking and savings:
  in NBA's `spare` a `bankSaving` part kept out of `retirementSaving`, in `yearSaving`/`yearSavingWords` added to `cash`, and in
  the emergency-fund step's monthly capacity (claude-f's NBA and `core/math/leftover.js`: post the ask). In this track's own files:
  Contributions' hero and `enoughLine` leave cash-account rows out of "into retirement accounts" and the share of pay (or say "into
  savings and retirement accounts"); ask Benchmarks' owner to leave cash and brokerage rows out of "goes into retirement
  accounts" (or reword it). Test: Morgan's bank answer leaves the Dashboard's year line at about $6,400 into checking and savings,
  NBA's emergency-fund date unchanged, Benchmarks' saving rate unchanged.

### M4 (severity 2). "This year's federal tax" is a whole year's difference, said in November
- **Steps.** Dana & Lee → Contributions → Dana's row → Pay the tax now → Save (today 2026-11-12).
- **Evidence.** Notice: "This year's federal tax: about $580 more than before." (`shots/now-390-saved.png`). By code the Federal
  estimate goes $10,448 → $11,024 (+$576 = $4,800 × 12%), the whole year's rows. With pay every two weeks only about 3 of 26
  paychecks of 2026 are left, so 2026's tax moves by roughly $70. The form's line "would lower this year's federal tax by about
  $190" has the same wording.
- **Fix.** Say it as a yearly figure ("about $580 a year more in federal tax, starting with the next paycheck"), or prorate by
  `taxes/withholding` `paychecksLeft` and say both ("about $70 for the rest of 2026, $580 in a full year").

## Checked and found right (code run or screen)
- **Said = done.** Card effects equal the answer after the matching save on the page each row links to: Jamie Social Security at
  70 on its own page → "runs out at 68" = card; Jamie stop age 65 → 67 on People → "runs out at 78" = card; Morgan bank $530 →
  71 = card (`w3-saiddone.mjs`, `w1-bank.mjs`). The builder's own said = done tests (work row, match, leftover, growth, prices)
  pass.
- **Invariance.** Every module's compute on 63 base plans (qa fixtures, the 4 finished personas, 14 archetype bases, the 5
  phone-built households), fa2026e vs 71ff05a: only additive keys change (`career/benefits` `total.rothYearly: 0`,
  `system/assumptions` `hopeful: false`) and timestamps (`system/audit`, `system/backups` `savedAt`). The same on all 1,449
  plans of the 14 archetypes x every pack variant (`run-all.mjs` both roots, 2,614 s each; `two.mjs` re-ran benefits and
  assumptions with those two keys removed: 0 differences). `tests/leftover-invariance` logic re-read: sound for "spend" and for
  "invest with its row".
- **Golden keys.** `tests/golden/**` untouched by the track; golden-retirement, -paycheck, -career, -federal, -limits: 52,667 pass,
  0 fail. Track tests (levers, tax-split, contributions, assumptions, paycheck, benefits): 113 pass, 0 fail.
- **Nothing counted twice (the arithmetic).** NBA `spare.monthly` falls by exactly the amount saved (Dana & Lee 1,828.40 → 8.40 for
  $1,820; Jamie 566.91 → 6.91 for $560); federal and state tax unchanged by a brokerage or savings row.
- **The match rule (IRC 402(a)/402A).** After Now, the match stays on a $0 pay-the-tax-later row (deferred bucket); after Some of
  each it is only on the later row; an IRA is never split (`taxPairOf` null); the Roth 401(k) row counts against the 401(k) limit
  (`limitKind` "401k"); Next best action and the match check do not ask about the match again after Now.
- **The federal tax difference.** Pre-tax money drops by the Roth part only: Dana all Roth +$576 = $4,800 × 12% (12% bracket);
  split $1,560 Roth → $190 (12.2%). Work benefits: "on $4,800 put in before tax", tax saved unchanged ($767.52) after adding a
  Roth part. Paycheck: Roth 401(k) after tax $184.62 a paycheck = $400 × 12 / 26.
- **The mix at retirement.** Dana's split: 2044 balances deferred $715,410, free $65,261, cash $18,539 → 89.5 / 8.2 / 2.3 → shown
  90 / 8 / 2 (largest remainder, adds to 100).
- **SECURE 2.0 catch-up line.** Age 50 by year end, pay over $150,000 (2026; 2025 table $145,000), "from 2026": matches IRC
  414(v)(7) as verify-web read it (Vanguard *How America Saves 2026*, IR-2025-91).
- **Sources opened.** Vanguard HAS 2026 table in `guesses/data/pay.js` (median match 4% of pay, 6% needed, median deferral 6.6%);
  Vanguard 4.8%-6.8% (as of 2026-09-30) and J.P. Morgan 2026 LTCMA 6.7% (verify-web, confirmed); Brown, Cederburg and O'Doherty,
  "Tax uncertainty and retirement savings diversification", *Journal of Financial Economics* 126(3), 689-712 (2017),
  doi 10.1016/j.jfineco.2017.10.001 (opened via econpapers/RePEc; its finding: most savers should split, except the lowest
  brackets). BLS CPI-U 7.0 / 6.5 / 3.4% for 2021-2023 matches the inflation preset reasons.
- **OFX fields.** Not in this track (L8 belongs to another track); nothing to check here.

## Housekeeping
The server on 9741 is stopped and the review worktree `rv/v-ret-money` is removed (`git worktree remove`); the builder's
worktree `rv/b-ret` was only read. The base snapshot and scripts stay in `rv/ret/money/`.

## Not walked
Safari/WebKit (only Chromium is installed). On a real iPhone: the leftover panel's amount box (16 px, `$` prefix), the Some of each
boxes' `change` firing on blur (the tax line), and the chips' pressed state.
