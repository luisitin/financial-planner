# Money critic, track scn (L1, d540ebb on fa2026e)

Reviewer: money critic. Worktree served read-only from a copy: `rv/v-scn-money` (detached at d540ebb), base copy `rv/v-scn-money-base`
(git archive of fa2026e, used only for base-vs-head runs); both removed at the end. Port 9741 (stopped at the end). Scripts and outputs: `rv/scn/money/`
(all paths below are under `$SP/`).
Screenshots: `rv/scn/money/shots/` (Chromium, iPhone user agent, sandbox; 390 px light, 320 px dark). Today in the browser: 2026-11-12;
node runs use 2026-11-11 (the builder's date) unless said.

Only what I confirmed by running code or on screen is listed. Severity 5 = a wrong figure a person would act on.

## What holds (checked, no finding)

- **The return search is unchanged and right.** Jamie: lever value 0.10342 on the blend; by hand, both returns moved so the blend is
  10.3% fails (end $0) and 10.4% lasts (end $29,856 real); blend = 0.6 x 7% + 0.4 x 4% = 5.8% (mix = (70% + 50%) / 2). The line
  shows 10.4% and 5.8% (`shots/` Jamie text in `look.txt`).
- **The source is real and quoted right.** Vanguard's return-forecast page (opened 2026-11-12): "as of September 30, 2026", U.S.
  equities "4.8%-6.8%", "in nominal terms", page dated October 21, 2026. The app's returns are before inflation too, so the fold's
  "a year before inflation" is right.
- **Base vs head, Goal seek and Sensitivity on all 1,423 plans** (every qa fixture builder, every qa/households variation, the five
  phone-built households, the setup personas, the empty plan; `money/gsdiff.mjs`, `gsdiff.txt`): the only differences are the
  intended ones: the return lever's sentence, `info` and `line` (1,384 plans); `idle` on the saving lever (973) and its sentence
  (788 where it shows); the claim status room -> helps on 7 short plans; 20 plans newly gated in Sensitivity; the "nothing goes in"
  saving row added (1,159). No other lever value, status, sentence, Sensitivity row, base figure or method note moved.
  No claim card says "helps" or "room" where the best common age spends less than the ages on file (0 of 1,423).
- **Sensitivity's new high end is said = done by construction.** Casey: the usual row is `{amount 396 monthly, employerMatch 2,880}`
  into "Casey's plan at work"; typing exactly that row gives $2,945 a month, the bar's figure.
- **The 401(k) cap and the match formula follow D-A4/D-A5.** `deferralLimit` 2026: $24,500, +$8,000 from 50, $11,250 at 60-63
  (IRS Notice 2025-67, as in `contributions/data/limits.js`); `compLimit` $360,000; usual match = 4% x min(1, share / 6%) x pay
  (Vanguard HAS 2026 headline rows "median value of promised employer match" 4, "median employee deferral needed" 6). The match is
  not counted against the 402(g) deferral limit (right: employer money counts only toward 415(c)). No usual-saving row puts a match
  on a Roth, an IRA or a taxable row (0 of 1,733 rows).
- **Golden keys unchanged.** `git diff fa2026e d540ebb -- tests/ qa/ core/` is empty; `node --test tests/golden-retirement.test.mjs`:
  12,810 pass, 0 fail. The two touched modules' tests: 35 pass, 0 fail.
- **Invariance, every module.** See the last section (all 161 computes, base vs head, every plan).

## Findings

### M1 (severity 5). Goal seek's saving card names the idle 401(k), but its amount is worked out for taxable savings: doing what it says leaves the plan short, and in 260 plans the amount is above the 401(k) limit

L1 added the 401(k) to the sentence; the figure still comes from `withSaving`, which, with nothing going in, pushes the extra into
`main?.bucket ?? "taxable"` (`goal-seek/compute.js`, the saving lever). The engine taxes 401(k) money on the way out and does not
credit the tax it saves at work, so the same dollars into the 401(k) do less. The README even says "The figure is unchanged: the
extra still goes into savings (taxable)".

Steps (phone, sandbox, Casey = `walk/out/gs/noContrib.real.plan.json`):
1. Goal seek. The card reads "$670 a month. Save about $670 a month. Casey's plan at work holds $48,000, but nothing goes into it now
   (you said so). If some of each paycheck does go in, add it on Retirement contributions." (`shots/casey_gs_saving_390.png`).
2. Tap "Retirement contributions ›", tap the row "Casey's plan at work" (the form's account box is that 401(k)), type 670 in "Your own
   money each time it goes in", Save: "Contribution saved."; stored row `{amount 670, period monthly, employerMatch 0}`.
3. Back on Goal seek: "As it stands the money runs out in 2070", and the saving card now says "About $790 a month, $120 more than the
   $670 going in now." (`shots/casey_gs_saving_after670_390.png`, `casey_gs_after670_top_390.png`). Will the money last?: "Runs out in
   2070 Short ... (age 90)".

By code (`money/said.mjs`, `idle.mjs`, `idlelimit.mjs`):
- Casey: $670 into the 401(k): short (fail 2070); $670 into taxable: lasts. The smallest monthly into the 401(k) that lasts: $787.35.
- All 758 plans whose card names an idle 401(k) and asks for more: the shown amount typed into that 401(k) is still short in
  **758 of 758**; the card then asks 15-20% more (01-single-adult/base $1,060 -> $1,250; 04-two-parents/base $2,560 -> $3,020;
  12-high-net-worth/base $4,010 -> $4,770).
- 260 of them ask for more a year than the owner may put in a 401(k) in 2026: 03-single-parent/base "$3,030 a month" ($36,360) into
  "Hospital 403(b)" vs $24,500; 07-multigenerational/base $3,300 a month into "Linh's 401(k)" vs $24,500; 12-high-net-worth/base
  $4,010 a month into "Victoria's 401(k)" vs $32,500 (52, catch-up included); 01-single-adult/expenses/spending-above-income $3,710 a
  month into "401(k)" vs $24,500.
- Also: `idleWorkPlans` skips only `formerJob`; 13-in-crisis/income/starts-next-month reads "Derek's old 401(k) holds $31,000, but
  nothing goes into it now. If some of each paycheck does go in ..." (and $4,250 a month). Contributions' own rule skips names with
  old/former/previous/prior/rollover (`contributions/view.js`, `cur401`).

Fix:
- When `idle` is set, solve the saving lever with the extra as a contribution row on a copy of the plan into the named 401(k), run
  through `buildInputs` (bucket deferred, the owner's `personIndex`, the owner's last pay year), exactly what the Contributions form
  writes; cap that row at `deferralLimit(ageInYear(owner), year)` and put any rest into a row with no account (taxable), and say so:
  "About $790 a month into Casey's plan at work" / "About $2,040 a month into the Hospital 403(b) (the most allowed in 2026) and
  $X more into other savings". Casey's card would read $790 and typing $790 lasts.
- Use the Contributions name rule (old/former/previous/prior/rollover) in `idleWorkPlans`.
- Tests: for every qa household with an idle card, the shown amount typed as that row reaches the goal (said = done); the 401(k) part
  is never above `deferralLimit`.

### M2 (severity 3). Sensitivity's "6.6% of pay: $2,950" includes a $2,880 match nobody confirmed, and Contributions calls a different match "common"

On screen (`shots/casey_sens_saving_390.png`, `casey_sens_saving_320_dark.png`): "How much you save, now nothing ... plus the match
most jobs add", bar ends "nothing: $2,340" and "6.6% of pay: $2,950". The high end is 6.6% of $72,000 ($396 a month) **plus** a match
of 4% of pay ($2,880 a year) that Casey was never asked about (`workPlans.match` unset).

By code (`money/said3.mjs`, today 2026-11-11):
| what the person does | a month |
|---|---|
| nothing (the bar's low end) | $2,336 |
| types 6.6% on Contributions (what the bar label says) | $2,715 (still short) |
| taps Contributions' own "Yes, it matches" then "Start it at 6%" (writes 6%, match left at $0) | $2,681 |
| 6.6% + Contributions' "common match, 50% of what you put in up to 6% of pay" ($2,160) | $2,888 |
| 6.6% + the usual match 4% of pay ($2,880), the bar's high end | $2,945 |

So the figure next to "6.6% of pay" is reached only by also typing a $2,880 match by hand, and the next page calls a $2,160 match
"common". Spec D-A5 words the row "6% of pay plus the usual match".

Fix: label the end "6.6% of pay + usual match" (or "6.6% + match"), and put the match in the line under it: "plus about $2,880 a year
from Casey's job, the usual match (Vanguard); your HR can say the real one." When the match is in the high end, add the own-money-only
figure ($2,720) to the line. L3 should switch Contributions' "common match" words to `matchTerms` (D-A4), so both pages name one match.

### M3 (severity 2). Sensitivity's usual saving puts no limit on an IRA or Roth: $33,120 a year into "Henry's Roth" at $360,000 of pay

`usualSaving` caps only at a plan at work (`cap = atWork ? deferralLimit(...) : null`). For qa household 12-high-net-worth (all 88
of its variants), Henry (born 1971, pay $360,000, married filing jointly) gets `own 33,120` into account type `roth` "Henry's Roth".
2026: the IRA limit is $7,500 + $1,100 from 50 = $8,600, and a Roth IRA takes nothing at joint income over $252,000 (phase-out
$242,000-$252,000, Notice 2025-67, both already in `contributions/data/limits.js`); read as a Roth 401(k) it is still over $32,500.
On screen (`shots/hnw_sens_saving_390.png`): "How much you save, now nothing ... the usual share: $36,210".
The figure moves little: high end $36,205; the same money into taxable $36,473; $8,600 into the Roth and the rest taxable $36,929
(`money/hnw.mjs`). It is the law that is off, not much the number.

Fix: outside a plan at work, cap the row at the IRA limit for the age (`LIMITS[year].kinds.ira`, catch-up from 50), skip a Roth IRA
above `rothPhaseOut[filing][1]`, and put the rest in a row with no account (taxable). Test: the high-earner household's rows are
within the limits.

### M4 (severity 2). The grey line sets a return needed "on your mix of stocks and bonds" against a stocks-only range

The line: "would have to grow about 6.0% a year on your mix of stocks and bonds ... Forecasts for the next 10 years: U.S. stocks
4.8%-6.8% a year (Vanguard, as of September 30, 2026)" (Robin, `shots/robin_gs_line_390.png`). The same Vanguard page gives U.S.
aggregate bonds 5.1%-6.1%; on the plan's mix (60% stocks on average) the forecast range is about 4.9%-6.5% (0.6 x 4.8 + 0.4 x 5.1 to
0.6 x 6.8 + 0.4 x 6.1). Robin's 6.0% reads as mid-range against 4.8-6.8, but sits in the top third of the range for the mix, and the
"Most forecasts ... are lower" switch uses 6.8% (stocks) where the mix's top is 6.5%: a need between 6.5% and 6.8% on a 60/40 mix gets
the neutral words. Nothing printed is false; the comparison is uneven.

Fix: add bonds to `RETURN_FORECAST` (5.1%-6.1%, same page, same date) and compare with the blend on the plan's mix (the same `mix`
the lever uses): "Forecasts for a mix like yours: about 4.9%-6.5% a year (Vanguard, as of September 30, 2026)"; switch to "Most
forecasts are lower" above the blended top. Or keep the stock range but say "U.S. stocks alone". Test the threshold at the blended top.

### M5 (severity 4, pre-existing at fa2026e, not L1; for claude-c). Following the saving card leads to "room to spare: retire as early as 61" on a plan that runs out at 65

Reached by doing what L1's card says (M1, step 3): Goal seek then shows "When Casey can retire: room to spare (green), age 61. If
markets do as well as average, as early as 61, 4 years before the plan's 65", while its hero says "As it stands the money runs out in
2070". By code (`money/retire61.mjs`, `retire61b.mjs`; same result at fa2026e): Casey with $670 a month into the 401(k): retire at 60
fails (2046), **61 lasts** (end $63,800), 62, 63, 64, 65 fail (2048, 2055, 2062, 2070), 66 lasts. At 61 the yearly spending in today's
dollars falls to $23,772 from 2043; at 62-65 it stays $37,080. The retirement spending figure changes with the stop year
(`setupLoanParts` / `workStopYear`: the $1,109 a month mortgage part leaves the spending at its payoff only when the payoff falls
after the year work stops). A person would read "as early as 61" as a choice.

Fix (claude-c's file): the figure must not depend on the stop year that way (the mortgage inside today's spending leaves at its
payoff whatever the retirement age), and a monotonicity test (same spending: if retiring at A lasts, retiring at A+1 lasts). In Goal
seek, "room" on the retire card while the plan as it stands falls short is the same contradiction L1 removed from the claim card.

## Not checked or not applicable to L1

- No leftover row, no Roth/traditional split, no federal tax difference, no OFX in this commit (L4, L6, L8): nothing to check.
- The catch-up Roth rule (SECURE 2.0 §603): the one usual-saving row above $24,500 for someone 50+ over $150,000 is a job that starts
  next month (no prior-year wages from it), so the rule does not apply there.
- Safari not walked (Chromium only).

## Invariance, every module (161 computes), base vs head

`money/inv.mjs` ran every module's `compute(plan, { today: "2026-11-11" })` on all 1,423 plans (every qa fixture builder, every
qa/households variation, the five phone-built households, the setup personas, the empty plan) at fa2026e and at d540ebb, four
shards, 229,103 cells each side, 0 throws on either side (`money/invcmp.mjs`, `invcmp.txt`):
- `scenarios/goal-seek` differs on 1,384 plans and `scenarios/sensitivity` on 1,179: the intended changes, classified one by one in
  `gsdiff.txt` (above).
- `system/audit`, `system/backups`, `system/settings` differ on 1,418: clock noise, not the commit. Their output carries the plan's
  own save stamp (`savedAt` / `updatedAt` from migrate), which differs by milliseconds between any two runs; on the same instant
  base and head are equal apart from it (`money/sysdiff.mjs`).
- Every other module (155 computes, Legacy goals, Plan health score, Financial independence, Next best action, Dashboard, Your plan,
  the reports and all the rest included) gives identical output on every plan. L1 adds no plan field, so there is no "without the
  new field" case beyond this.
