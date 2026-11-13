# Track scn, final skeptic (2026-11-13)

Checked: L1 = **a8e0763** on 707355c (`git log 707355c..a8e0763` lists only it), read from my own detached copy
`rv/v-scn-fin` (removed at the end). Nothing in `rv/b-scn` or the main repository was changed. Own servers on 9701 to 9706, each
stopped by its script (`finally`); `curl` on 9701-9709 answers nothing afterwards. Every phone screen ran in the sandbox:
Chromium with an iPhone user agent, touch, 390 px and 320 px, light and dark.
Scripts, logs and pictures: `$SP/rv/scn/fin/`
(`w1` first views, `w2` Goal seek taps, `w3` What matters most taps, `w4` Legacy goals taps, `w5` Casey's said = done walk,
`w6` the folded idle-401(k) card, `sw`/`swl`/`sw7` the qa sweeps, `c0`/`c2`/`c7` by code, `re-c*.txt` the recheck's money
scripts on this build, `shots/` the pictures).

## Verdict in one paragraph
Every finding fix-2.md calls fixed (N1, N4, N5, N6) is closed on the phone and by code, and every finding it calls still closed
(M1, P2, P1, M2's L1 half, M3, M4, P3, P4, P5, P7, B1 to B5) still is: the recheck's money scripts give byte-equal output to the
builder's, and Casey's said = done walk ends "just right". The owner's rule holds on all three screens: 156 first views (13
households x 3 pages x 4 variants) show at most three cards, rows or changes, never a second filled button, no sideways scroll, no
control under 44 px, no builder word; every fold I opened, closed, switched or chipped left the sandbox plan byte-identical.
The whole `npm test`: 189,430 tests, 0 failures apart from the two named speed tests, which pass alone. I found four small things
(severity 2, 1, 1, 1), listed at the end; none blocks landing.

## (a) Findings fix-2.md says are fixed, by their original steps
| id | verdict | what I did and saw |
|---|---|---|
| N1 | closed | Phone (`w3.txt`): qa 01-single-adult at 320 dark and the saved `plan-savingOnly` at 390: one row ("How much you save") and "7 more numbers / they change nothing here"; inside, "6.0% or 8.0%: no change here." with no bar. The nothing-moves plan (`plan-zeroTop`): "None of these numbers changes the answer", no caption, no measure fold, "6 more numbers / they change nothing here". Sweep of all 1,423 qa plans (`sw-*.log`): 1,364 with rows, 0 dead rows among the first three on the page's measure or on any measure offered, 0 headlines over a row that moves nothing or with "$0", 0 measures offered that move nothing, 0 throws, plan never changed. |
| N4 | closed | Casey's Goal seek at 320 dark, every fold open (`w2.txt`): all five card titles 178 px wide, one line each, pill under the title (`shots/w1/casey_goal-seek_320d_full.png`). First-view walk: no card title under 100 px on any of the 156 screens. |
| N5 | closed | `module.js` purposes and `docs/MODULE_CATALOG.md` rows 207-208: no "the return it needs", no "lever"; What matters most "ranked by how much it moves the answer". |
| N6 | closed | Casey 320 dark and 390, Maya, Morgan: open "More about this", open "Measure it another way", tap "How long it lasts": the row's fold is still open (`about open [true]`), the line reads "showing how long it lasts" and keeps saying so after the measure fold is closed. |
| M1 / P2 | still closed | Phone (`w5.txt`): Goal seek "Put about $790 a month into Casey's plan at work" -> Retirement contributions -> Edit -> 790 -> "Save changes" ("Contribution saved.") -> Back: "Your plan works if markets are average ... lasts and leaves about $2,000"; the saving card "just right" (now under "2 more changes: retiring, saving"); Will the money last? "Lasts in about 4 of 10 pretend futures". Sweep: 754 idle-401(k) saving cards, each typed as said reaches the goal (0 short). |
| P1, M2, M3, M4, P3, P4, B1, B2, B3, B5 | still closed | The recheck's `c1`, `c2`, `c3`, `c4`, `c8` run on this build give output byte-equal to the builder's `fix2/out/c*-after.txt` (`re-c*.txt`). B3 on the phone: Jamie's Legacy list is spending, saving, short today, then "2 more changes: retiring, Social Security"; no return. |
| B4 | still closed | Empty-401(k) Casey and Riley: "We don't know yet. Nothing is saved for retirement yet ..." with one filled "Add what you own ›"; Sam: "You haven't told us ..." (`w1-all.json`). |
| P5, P7 | still closed | Title "What matters most" at 390; "What matters most? ›" opens `#/scenarios/sensitivity` (`w2.txt`). |

Not this lane and not re-claimed: M5's engine half (claude-c; `re-c2`/`re-c8` unchanged: Dana & Lee "age 63: $6,620" against
$5,280, and Goal seek's first view now shows Dana's "room to spare, age 47: the money already lasts if Dana stopped this year",
the same as at 707355c), N2 (claude-f), N3 and P6 (wave 1).

## (b) The owner's rule, screen by screen
- **Goal seek.** First view: the hero, the goal's four chips, "More options / bad luck, your own amount", three cards, "N more
  changes / <names>", the grey line, "What matters most? ›", the folded "How it is worked out". Taps (`w2.txt`, Casey, 320 dark and
  390): "Room for bad luck" -> line "room for bad luck is on" (kept after closing); "150,000" -> "room for bad luck is on; leaving
  $150,000", no chip on; "Just last" -> "room for bad luck is on"; off -> "bad luck, your own amount". "lots" opens the fold with
  "Type an amount in dollars, like 150,000, or 0 to just last." (see finding 2 for what closing does). Jamie's legacy plan:
  "More options / leaving $20,000". Plan byte-identical after every tap.
- **What matters most.** Three rows, then "N more numbers / they move it less | they change nothing here | or not at all",
  "Measure it another way / <the other measures>", one outlined way on, two folded cards. Plan byte-identical after every tap
  (`w3.txt`). See finding 3 for the headline after a switch.
- **Legacy goals.** Three changes in Goal seek's order and "2 more changes / retiring, Social Security"; the add form shows three
  boxes and "Add a note / optional"; changing someone with a note opens it as "The note / has one". Sweep with a $50,000 bequest
  on a third of the qa plans (`swl-0.log`): 360 short plans listed, the first three always equal Goal seek's first view, 0 return
  or "just right" listed. Plan unchanged by every open and close; the note is saved from inside the fold (`w4.txt`).
- **Rule 7 (never fold a hint worth money).** Kept on 4,092 Goal seek first views (three goals x 1,364 plans, `sw7-*.log`): no
  folded Social Security card that gets there, no folded "Less would do if ... adds some". One gap: finding 1.

## (c) As a layperson
- **Casey** (Goal seek, 390): the answer and the three things that would fix it, the 401(k) card first among them with its amount
  and "Less would do if Casey's job adds some", no fold needed. On What matters most the three rows and the match line are in view.
- **Jamie**: spending, saving and short today with their amounts; retiring and Social Security, both "not on its own", are one tap
  away and named in the fold's line. What matters most: three rows, the headline's sentence in dollars.
- **Dana & Lee**: "Your plan works if markets are average", spending (tight), retiring (room) and Social Security (room, with "See
  each age" for the bars). A curious person finds every other card, measure and explanation behind a fold whose line names it.

## (d) Regressions
- `npm test` on a8e0763: 189,430 tests, 188,788 pass, 2 fail, 3 skipped, 637 todo (`fin/npm-test.txt`, 15.5 min at load 24 to
  29). The two failures are the named speed tests ("takes well under 1.5 s", "200 times in under 600 ms"); alone they pass (3 of 3
  and 2 of 3 runs under the same load); neither file is touched by L1. The touched modules plus the health score: 75 of 75.
- `npm run registry`: 161 modules, `modules/registry.js` unchanged; `npm run check`: OK; `node tools/leak-guard.mjs --worktree`:
  OK (2,879 files); `--commits 707355c..HEAD`: OK (15 files). `git diff --stat 707355c HEAD` on tests/golden, registry,
  CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md, core/, index.html, projection/compute.js, overview/**, investments/**: empty.
  Message ends in exactly "Agent: claude-b", "Co-Authored-By: Claude ...", "Claude-Session: ...". `git status` clean.
- Every qa plan through the three pure computes (1,423 plans): 0 throws, plan never changed, no status outside the four, no NaN,
  undefined, null, Infinity or long digit run in any sentence (`sw-*.log`).

## Findings (confirmed)
1. **Severity 2. Goal seek folds the idle 401(k) note when saving alone cannot get there (rule 7).** Steps: qa
   `02-couple-no-kids/expenses/spending-above-income` (saved as `fin/plan-idle-cannot.json`), Goal seek, 390. First view: "What you
   can spend", "When Priya can retire / not on its own / working longer alone does not get there", "What it is short today"; folded
   under "1 more change / saving": "No amount of saving gets there before retirement. Priya's 401(k) holds $92,000, but nothing goes
   into it now. If some of each paycheck does go in, add it on Retirement contributions." (`w6` output, picture
   `shots/w6_idle_cannot_goal-seek_390.png`). 210 of 4,092 first views (Just last, room for bad luck, leave $250,000) fold such a
   card, often behind a "not on its own" card that says nothing to do (`sw7-*.log`); Legacy goals lists the same order.
   `firstLevers` pins the idle card only while it is "needs". Fix: pin the saving card whenever it carries `idle` and is not
   "room"/"same" (or rank it first among "not on its own"), with a test on that plan; Legacy follows through `listedLevers`.
2. **Severity 1. Two folds say nothing of what the person typed once closed (rule 4).** Goal seek: "More options", type "lots",
   "Use this": the fold opens with the red line; close it: the line is "room for bad luck is on" (or "bad luck, your own amount"),
   the unused "lots" stays in the box (`w2.txt`, `shots/w2_320d_typo_closed.png`). Legacy goals: "+ Add someone", "Add a note",
   type "For school costs", close it: "Add a note / optional", and "Add" then saves the note (`w4.txt`,
   `shots/w4_390_note_closed.png`). Fix: while the box holds an error the fold's line says so ("the amount needs fixing"); a typed
   note turns the line into "has one" (an `input` listener on the box, no plan write).
3. **Severity 1. After "Measure it another way", the headline no longer matches the list.** Casey, 320 dark: "Measure it another
   way" -> "How long it lasts": the hero still reads "When Casey retires moves your plan the most ... cuts it by $900 a month"
   while the list's "1" is "How much you save" (nothing: to 67, $400 + $240 match: to 88) and "When Casey retires" is "2"
   (`shots/w3_casey_320d_Howlongitlasts.png`). Fix: when the person's measure differs from `d.measure`, name that measure's widest
   row in the hero ("Measured by how long it lasts: How much you save moves it most") with `runoutLine` for its sentence, or put
   that line above the list.
4. **Severity 1 (in this lane's file, not new). "$0 more" on Goal seek's spending card after doing what the saving card says.**
   Casey after typing $790 (P2's walk): "If markets do as well as average, up to about $3,090 a month on top of health insurance, $0
   more than the $3,090 the plan spends before health insurance." (`w5.txt`; same sentence at 707355c, `c2.mjs`). The room is
   $2.55 a month (`goal-seek/compute.js:169`). Fix: when the room rounds below $10, say "about the $3,090 the plan spends" (or treat
   it as "just right"), as B1 did for What matters most's headline; a test on Casey with $790.

Note, not a finding: `sensitivity/README.md`'s fix-round-1 section still says "Five numbers first ... No fold when it would hide a
single row"; the fix-round-2 section below it gives today's rule (three, and a fold even for one).

## To try on the real iPhone (only Chromium here)
- Goal seek: "More options", "N more changes", "See each age" open without the page jumping and the chevron turns; a typo in "Or
  leave at least" opens the fold with the red line under "Use this" and the keyboard does not cover it.
- What matters most: "Measure it another way" -> "How long it lasts" keeps "More about this" open; the bar labels "to 65" and
  "$400 a month + $240 match: to 88" at 320 px.
- Legacy goals: the note fold inside the form with the keyboard up; "Change Cy" opens "The note / has one".
- The fold lines under their titles below 480 px and beside them in landscape (844 px).
- Back after "What matters most? ›" (N3) and the menu search typed key by key (P6), once wave 1 has fixed them.
