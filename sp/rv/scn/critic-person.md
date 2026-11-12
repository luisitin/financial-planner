# Person critic, track scn (L1, d540ebb on fa2026e)

Reviewer: layperson critic (claude-b's person critic). I walked the two changed pages as Jamie (short, no match), Casey (nothing going
into the 401(k)), Dana & Lee (tight, money left over), plus Robin, Morgan and Sam where L1 changed what they see. Real taps at
coordinates through the kit (`ux/kit.mjs`: touch, iPhone user agent, sandbox), typing key by key, the phone's Back. 390 px light
for every walk, 320 px once (Jamie Goal seek, Casey and Jamie "What changes your answer"), dark once (Jamie and Casey Goal seek, Casey
and Sam "What changes your answer"). The same walks on fa2026e for comparison.

- Head: `rv/v-scn-person` (worktree detached at d540ebb), port 9751. Base: `rv/v-scn-person-base` (detached at fa2026e), port 9752.
  Both servers stopped by the scripts (own child only); both worktrees removed at the end.
- Scripts and raw output: `rv/scn/person/` (walk1-9, saiddone, returnline, claim, usual, titles; `w1_*.txt`, `w4_*.txt`, `w6.txt`).
- Screenshots: `rv/scn/person/shots/` (all paths below are under
  `$SP/`).
- Browser date 2026-11-12. Only Chromium is installed: Safari was not walked (list at the end).

Severity: 5 = a person acts on what the screen says and ends up worse off or misled; 1 = polish. Only what I saw on screen or got by
running code is listed. The sibling money critic (`rv/scn/critic-money.md`) has M1, M2 and M4 from the money side; P2, P3 and P4 below
are the same places seen by a person, confirmed again here, and say so.

## What holds (checked, no finding)

- **The return is no longer offered as a fix.** Goal seek (Jamie, Casey, Morgan, Robin, Dana) shows five cards and no "The return it
  needs" card, no Assumptions button; the grey line sits after the last card, inside the same card, 16 px under it
  (`rv/scn/person/shots/w1_jamie_new_390_s3.png`; base for comparison `w1_jamie_base_390_s2.png` with the 10.4% card and its
  "Assumptions ›" button). At 320 px the line wraps to 8 lines with nothing cut (`w1_jamie_new_320_s6.png`); dark is readable
  (`w1_casey_new_390_dark_s2.png`).
- **No green "room to spare" on a short plan's claim card.** Jamie, Morgan, Robin: grey "helps" (base: green "room to spare").
  P1 is about what "helps" then does.
- **Casey's saving card says whose money and what was said**: "Casey's plan at work holds $48,000, but nothing goes into it now
  (you said so)" (`w1_casey_new_390_s1.png`).
- **Sam gets one answer on all three pages.** "What changes your answer" shows "We don't know yet" and one filled "Add what you own ›"
  at 390 light and dark (`w4_sam_new_390_s0.png`, `w4_sam_new_390_dark_s0.png`); the tap opens Net worth and Back returns to the page.
- **Nothing moves under the thumb.** Every heading, card, button and paragraph on the first screen sampled every 20 ms for 5 s after
  the tap that opens each page: 0 moves on Goal seek and on "What changes your answer", all six people, 390/320/dark. Goal seek's
  layout shift 0.0006, the same as fa2026e.
- **No sideways scroll, no small targets, no second filled button** on either page at 390, 320 or dark (kit census: no control under
  44 px, none off the side; the only "filled" controls are the goal and measure chips, as on fa2026e, and Sam's one filled button).
- **Back keeps the place.** Goal seek -> "Retirement contributions ›" -> Back lands on Goal seek at the same scroll (1,101 px), the
  saving card in view.
- **The not-ready states read right** (blank plan): Goal seek's lede no longer lists "the return it needs"; "What changes your answer"
  keeps one filled "Will the money last?".

## Findings

### P1 (severity 4). The Social Security card says "helps", but doing it makes Jamie's answer worse, and for Robin it is the whole fix shown as the weakest card

What a person sees (Goal seek, 390): Jamie's card "When to claim Social Security · helps · age 69 · Jamie claiming at 69 lets the plan
spend the most if markets do as well as average, about $2,440 a month, $110 more than claiming at 67." Robin's: "helps · age 70 ·
about $3,150 a month, $170 more than claiming at 67." Morgan's: "helps · age 66".

Steps (walk7, sandbox): Goal seek -> "Social Security ›" -> "Claim at age" set to the card's age -> "Save Jamie's Social Security" ->
Will the money last? -> Goal seek.

| person | Will the money last? before | after doing what the card says | Goal seek after |
|---|---|---|---|
| Jamie (claim 69) | Runs out in 2052 (age 70); bad run $25,900 a year ($2,100 a month) | **Runs out in 2050 (age 68)**; bad run **$18,600 a year ($1,500 a month)** | still "What it would take" |
| Robin (claim 70) | Runs out in 2057 (age 94) | **It lasts in most cases, not all** | "Your plan works if markets are average" |
| Morgan (claim 66) | Runs out in 2049 (age 65) | Runs out in 2049 (age 65) | unchanged |

Evidence: `rv/scn/person/walk7.mjs` output (above), `shots/w7_jamie_projection_after_new.png` (the headline 2050, age 68, $18,600),
`shots/w8_robin_claim_new.png` (Robin's grey "helps" under amber "needs a change" cards), `claim.mjs` (same by code: Jamie short at
68 after, Robin `meets=true` after, Morgan short at 65 after). The bad-run figure before was $25,900 on every run (4 runs, head and base, 390/320/dark).

So one grey word covers three different truths: Jamie follows it and both headline numbers get worse (the steady "most it can pay"
rises, but waiting means drawing savings down faster, and the money runs out two years sooner); Robin's card is the one free change
that makes the plan work on its own, yet it is the only card without the amber "needs a change" the other working fixes carry;
Morgan's changes nothing on the headline. On fa2026e all three said green "room to spare", so L1 is better, but not yet true.

Fix (goal-seek compute and view, L1's own lane): decide the claim card the way the other cards are decided, by running the plan at the
best age (one more `project()`; the goal-seek search already builds that input):
- the plan meets the goal at that age -> status `needs` (amber "needs a change", like the other working fixes), sentence "Claiming at
  70 alone makes the money last: about $3,150 a month can be spent, $170 more than claiming at 67.";
- it does not -> status `cannot` ("not on its own", as the retire card), and say the headline's unit too: "Claiming at 69 lets the plan
  pay about $110 a month more, steady. At the $3,220 you plan, though, the money would run out at 68 instead of 70: waiting means
  drawing more from savings until it starts."
Tests: Jamie -> `cannot` with "68 instead of 70"; Robin -> `needs`, and saving that age makes Goal seek's `meets` true; Morgan ->
`cannot`; Dana (meets) keeps "room to spare".

### P2 (severity 5; same place as money critic M1). Casey does exactly what the saving card says and the plan is still short; the card then asks for $120 more

Steps (walk3, 390, sandbox, Casey): Goal seek -> saving card "$670 a month. Save about $670 a month. Casey's plan at work holds
$48,000, but nothing goes into it now (you said so). If some of each paycheck does go in, add it on Retirement contributions." ->
"Retirement contributions ›" -> "Edit ›" on "Casey's plan at work" -> type 6, 7, 0 in "Your own money" -> "Save changes"
("Contribution saved.", the page says "$8,040 of your own money ... At this rate the money runs out at about 90") -> Back.

Evidence: Back lands on Goal seek, whose hero now says "As it stands the money runs out in 2070" and whose saving card says
"$790 a month · About $790 a month, $120 more than the $670 going in now." (`shots/w3_casey_after_new_670.png`); Will the money last?:
"Runs out in 2070 ... (age 90)". By code (`saiddone.mjs`): $670, $700, $750 a month into the 401(k): short (2070, 2071, 2074); $800:
lasts; $670 with no account (taxable): lasts. On fa2026e the figure was the same ($670) but the words did not point at the 401(k);
L1's sentence now sends Casey to exactly the account where $670 is not enough.

Fix: when the card names an idle 401(k) (`idle`), solve the saving lever with the extra going into that account (bucket "deferred",
its owner's person index) instead of `main?.bucket ?? "taxable"`, so the figure is the one to type there ($790 for Casey); if the job
may add a match, say so in the same sentence ("about $790 a month of your own; less if Casey's job adds money: ask HR"). Test (said =
done): typing the shown amount on the named row makes Goal seek's `meets` true for Casey and every plan with `idle`.

### P3 (severity 3; next to money critic M2). Casey cannot act on "What changes your answer"'s new saving row: "6.6% of pay" has no dollars, and its line does not parse

On screen (`shots/w4_casey_new_390_s1.png`, 320: `w4_casey_new_320_s2.png`): "How much you save · now nothing · nothing goes in now; the
high end is what people paid about the same usually put in, plus the match most jobs add" and the bar ends "nothing: $2,340" /
"6.6% of pay: $2,950".

- Casey reads "what people paid about the same usually put in" as broken English (it means "people paid about what Casey is paid").
- "6.6% of pay" is $396 a month of Casey's own money plus a $240 usual match = $636 a month (`usual.mjs`), never shown in dollars,
  while the previous page asked for "$670 a month" and, once done, "$790". Three saving figures on two pages, none in the same terms,
  and the person cannot see that the $2,950 high end is still short of the $3,090 the plan spends.

Fix (sensitivity view and compute words): label the high end in money, "$400 a month + $240 match: $2,950" (or "6.6% of pay, about
$400 a month, + match: $2,950"), and say the line the way the spec words it: "Nothing goes in now. The high end: what people with pay
like Casey's usually put in (6.6%, about $400 a month), plus the match most jobs add (about $240; Casey's job may differ)." When the
high end is still below what the plan spends, add "still short of the $3,090 a month the plan spends".

### P4 (severity 3; next to money critic M4). The grey line reassures Robin and Dana with a mixed figure set against a stocks-only range, and calls our figure "you assume"

On screen: Robin (`shots/w8_robin_claim_new.png`): "For the plan to work as it is, investments would have to grow about 6.0% a year on
your mix of stocks and bonds, against the 5.8% you assume. Forecasts for the next 10 years: U.S. stocks 4.8%-6.8% a year (Vanguard, as
of September 30, 2026)." Dana & Lee (`shots/w1_dana_new_390_s*.png`): "Investments growing about 4.3% a year ... would still do,
against the 5.8% you assume: 1.5 percentage points of room for bad luck. Forecasts ...: U.S. stocks 4.8%-6.8% a year".

By code (`returnline.mjs`): the line's figure is the blend on a 60% stock mix, both returns moved together. Robin's 6.0% needs
**stocks at 7.2%** (bonds 4.2%), above the top of the range the line quotes; Dana's 4.3% needs stocks at 5.5%. A person compares the
two numbers printed side by side: Robin reads 6.0% inside 4.8-6.8% ("close enough, fine"); Dana reads 4.3% below the lowest forecast
("safe even if forecasts are low"). Both readings are wrong in the comforting direction. Also, for every walked household
`plan.assumptions` is the untouched default (returnStocks 0.07, returnBonds 0.04, no review), so "the 5.8% you assume" and "your mix"
attribute our usual figures to the person, the opposite of the owner's "say which figures are yours and which are ours".

Fix (`returnWords`): compare like with like and say whose: "For the plan to work as it is, stocks would have to grow about 7.2% a
year (and bonds 4.2%), against the 7% and 4% we use unless you change them. Most forecasts for U.S. stocks over the next 10 years are
lower: 4.8%-6.8% a year (Vanguard, as of September 30, 2026). That isn't a choice you can make; the cards above are." Switch to "Most
forecasts are lower" on the stock figure (> 6.8%). Room case: "Stocks growing about 5.5% a year (bonds 2.5%) would still do, against
the 7% and 4% we use. Forecasts for U.S. stocks: 4.8%-6.8% a year." Drop "percentage points" and the fold's "shown as the blend on your
mix" (say "both moved by the same amount"). Say "you" only when the figure was typed or reviewed on Assumptions.

### P5 (severity 2). The new title is the one usable title cut in the top bar at 390 px

On screen: "What changes your an…" at 390 (`shots/w4_casey_new_390_s0.png`), "What changes…" at 320 (`w4_casey_new_320_s0.png`), on
every visit, and the page never prints its own name once it has an answer (its heading is "When Casey retires moves your plan the
most"). Measured (`titles.mjs`): at 390 px the title box is 207 px and only 2 of 157 usable titles are cut, "Bills and regular
payments" and this one (227 px); "Sensitivity" fitted. At 320 px 56 of 157 are cut (the shell's, not L1's).

Fix (module.js title, catalog row): "What matters most" (158 px, fits at 390; already an alias) or "What moves your plan" (185 px,
fits; echoes the page's own heading). Keep "What changes your answer" as an alias.

### P6 (severity 3; pre-existing at fa2026e, core/app.js, wave 1's lane). Typing in "Find a page..." enters the letters backwards, so the renamed page cannot be found by typing

Steps (walk5/5b, Jamie, 390, base and head): menu -> tap "Find a page..." -> type s, e, n, s, i one key at a time.
Evidence: after each key the box reads "s", "es", "nes", "snes", "isnes" with the caret at 0; typing "sensitivity" shows "No page
matches “ytivitisnes”", "what matters most" shows "No page matches “tsom srettam tahw”" (`shots/w5_search_sensitivity_new.png`).
Pasting the same words works: "sensitivity", "what matters most", "tornado chart" all list "What changes your answer"
(`shots/w5b_search_fill_new.png`). Cause: `core/app.js:76` rebuilds the whole menu, input included, on every keystroke and focuses the
new box, whose caret starts at 0. The builder's "search still finds 'sensitivity'" holds only for pasting.

Fix (wave 1, core/app.js): keep the input and rebuild only the list under it; or after the rebuild,
`box.setSelectionRange(box.value.length, box.value.length)` before `focus()`. Test: type a word key by key in the kit and read the
box. Try on the iPhone (Safari may place the caret differently, and rebuilding the box may close the keyboard).

### P7 (severity 2). From Goal seek there is no way to "What changes your answer"

Steps: Goal seek (any household) -> read to the end -> the fold "How it is worked out" -> "Continue your plan". No link to the
renamed page; "What changes your answer" links to Goal seek, not back. In the menu it sits inside the folded "What-if scenarios" group
(walk4 had to open the group first). A person on Goal seek who wants to check which numbers matter has no path from where they are.
The builder lists it as L2's ("Go deeper" card on Will the money last?), but the person standing on Goal seek is the one asking.

Fix (goal-seek view, L1's lane): one outlined link after the grey line, "Which of your numbers matter most? ›"
(`#/scenarios/sensitivity`). Not filled: the page keeps no filled button.

### P8 (severity 1). "What changes your answer" still ends with an "Assumptions" button next to a green "8.0%" return bar

On screen (Jamie, `shots/w4_jamie_new_390_s*.png`): row "How much stocks earn · now 7.0% · 6.0%: $2,280 / 8.0%: $2,390" with a green
high end, and the only actions on the page, under "Read it like this", are outlined "Assumptions" and "Goal seek". After L1 removed the
Assumptions button from Goal seek (D-A7), this is the one place on the two pages that still invites changing a return.

Fix: replace "Assumptions" with links to the choices the card names ("Retirement contributions ›", "Change the age ›"), or rename it
"Check the figures we use ›" landing on `#/system/assumptions?show=returnStocks`.

## Not applicable to this track

- The pay stub and .qfx walks belong to the doc track (L7, L8); nothing of theirs is in d540ebb.
- The leftover (Dana & Lee's $1,828) is L4; L1 shows nothing about it.

## Try on a real iPhone (Safari, not available here)

1. Menu "Find a page...": type "sensitivity" key by key (P6). Does the caret stay at the end, and does the keyboard stay up?
2. "What changes your answer" top bar at 390 and 320 (ellipsis, P5), and Goal seek's grey line wrap and contrast in dark mode.
3. Goal seek -> "Retirement contributions ›" -> Back: does Safari land on the saving card (scroll kept) as Chromium does?
4. The bar labels "nothing: $2,340" and "6.6% of pay: $2,950" at 320 px do not touch.
5. Sam's "We don't know yet" hero: one filled button, nothing else.
