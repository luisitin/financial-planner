# Track "doc" (L7, L8): the final skeptic's four findings, fixed

Worktree `$SP/rv/b-doc` (detached, nothing pushed).
Base 707355c. The two commits now are:

| L | commit | was |
|---|---|---|
| L7 Document reader | d7be064 | 449a4d5 |
| L8 Import | 257e754 | 9d34f08 |

Each L is still one commit. The fixes were folded in with `git commit --fixup=amend:<sha>` (content, plus one "Final
review fixes (2026-11-13)" paragraph in the message), then a plain `--fixup`, then `GIT_SEQUENCE_EDITOR=: git rebase -i
--autosquash 707355c`. The trailers are unchanged: L7 ends with Agent / Co-Authored-By / Claude-Session, and L8 has
"Prompt: quick-ofx-import" just above "Agent:".

Everything this round wrote outside the worktree is under
`$SP/rv/doc/fixf/` (called fixf/ below):
- `rp.mjs`: the four findings by their own steps. `TAG=before` ran on the untouched tip and `TAG=after` on the fix; the
  logs are `shots/rp-before.json`, `shots/rp-after.json` and `shots/rp-after-390dark-320.json`, with pictures in `shots/`.
- `f1pure.mjs`: F1 on the five phone-built plans.
- `sweep3.mjs` (output `sweep3.out`, `sweep3-reader.out`): the final skeptic's sweep plus a check of "Set it to $0".
- `csvsweep.mjs` (output `csvsweep.out`): F4's pure side.
- `walk/`: the skeptic's own walks i1, i2, i3, r1, r2 and w320, pointed at this worktree. Their output is in `reg/`.
- `npmtest.txt`, `npmtest2.txt`: the whole `npm test`.

Every walk ran in the sandbox on ports 9731-9739. Each server was stopped by the kit's `stop()`, and all nine ports answer
nothing now. No process was killed by pattern. One walk (i3) hit its own time limit after a step failed; its server had
already stopped, and I checked that no browser of mine was left without a parent.

## F1 (L7): a 401(k) line printed as $0.00 this paycheck got no word

**Reproduced** (`rp-before.json`, `shots/F1-*-before-*.png`):
- Jamie (noMatch, $250 a month on file) with `casey-ytd-only.txt` showed only two cards: the pay and the tax taken out.
- Casey (noContrib) showed only the tax card.
- The pure cause is as the skeptic said. `readPlanLines` reads "401(k) 0.00 1,200.00" as `k401 = 0`. `hasOwn` needs more
  than 0. `noPlanLine` needs no plan line on the stub. So neither card applied.

**Fix** (`modules/ai/reader/compute.js`, `view.js`):
- `readPlanLines` now also returns `ytd: { k401, roth401k }`, the year so far. It is the line's second figure, and only
  when two things hold: the gross pay line prints two figures, and every line of that kind has two. The `parts` objects are
  unchanged.
- `stubFacts` covers this case: an own line (pay the tax later, or Roth) reads 0.00 on the stub's own words, no own line
  is above $0, and none is left unread. A 0 from the AI for a line the stub does not have does not count. In this case
  `noPlanLine` becomes `{ onFile, zeroLine: true, sides, ytd, set }`. `set` holds ready `op: "work"` changes (amount 0,
  the row's own period, `make: null`). They cover only the rows on file, for those lines, that hold money.
- The view puts the card first, where the 401(k) cards go:
  - **$0 on file** (Casey): "This pay stub shows $0.00 going into the 401(k) this paycheck ($1,200.00 so far this year).
    That matches what is on file ($0)." It has the outlined "See what putting some in would do ›".
  - **Money on file** (Jamie): in amber, "... ($1,200.00 so far this year); the plan says $3,000 a year. If you stopped,
    change it on What you save for retirement ›, or set it to $0 here." It has an outlined "Set it to $0". That is never
    the filled button; the filled button stays on "Jamie's pay". The card is marked as one that must be seen, so it is
    never folded.
  - **After "Set it to $0"**: "Was: $250.00 every month ($3,000 a year). Now: $0.", with "Jamie's 401(k): set to $0.
    What you save for retirement › shows it." When the row has a match, the note adds that the match on file stays.
    "See if the money lasts ›" follows.
- The match is left alone on purpose. The stub says nothing about it, and the person is told where to change it.
  `workPlans` is untouched, because `x.amount > 0` is false.
- Tests (`modules/ai/reader/module.test.mjs`, three new):
  - the year so far, and when it is not read;
  - both plans the finding names, with Set it to $0 setting only that row (period and match kept, `workPlans`, accounts
    and income untouched), and nothing left to set when read again;
  - a $0.00 Roth line, both lines at $0.00, a $0.00 line beside a Roth line above $0 (no card), a one-figure line under
    "Current YTD" (still the unread case), and a 0 from the AI (no card).
- The README has a section on this case, and its test list names the three tests.

**After** (`rp-after*.json`; 390, 390-dark, 320 and 320-dark; pictures `F1-noMatch-after-*.png`,
`F1-noMatch-set0-after-*.png`, `F1-noContrib-after-*.png`, all Read):
- Jamie gets the amber card with "Set it to $0". Tapping it leaves the plan holding "Jamie's plan at work 0 monthly" and
  shows the Was / Now card.
- Casey gets the "matches what is on file ($0)" card.
- The filled "Use it" is on the pay card in every view. The layout is 320 wide at 320, and opening or closing any fold
  changed nothing in the plan.
- The skeptic's own `r2.mjs` (`reg/r2-*.json`, zeroLine-*) now finds the "Jamie's 401(k)" and "Casey's 401(k)" cards.

**Sweep** (`sweep3.out`; 1,451 plans, 23 stubs, 38 files, 214,009 runs; 0 problems):
- The skeptic counted 3,940 "said nowhere" for each of the two zero stubs. For `casey-ytd-only` they now split as:
  - said and matching $0: 3,364;
  - said against money on file: 29;
  - whose stub is asked first (chips, before any card): 515;
  - no adult on the plan (the page says to add yourself first): 32.
- `zeroThisPaycheck` splits the same way: 3,177, 26, 705 and 32 (`sweep3-reader.out` names each reason).
- "Set it to $0" was used and checked 55 times. Each time only its rows went to $0, with period and match kept. Nothing
  else in the plan changed. Read again, nothing was left to set.
- The import half of the sweep is unchanged: "balance set and put back" 41,827, 0 problems.

## F2 (L8): "See the lines" ran off a 320 px screen

**Reproduced** (`rp-before.json`, `shots/F2-Prairie_mix-before-320.png`):
- At 320 px the status spanned 75 to 348 px on a card ending at 306. The chevron was at 358 to 366, and innerWidth and
  scrollWidth were 367.
- At 390 px the title was 34 px wide ("See / the / lines").
- `Prairie_oddlines.qfx` did the same.

**Fix** (`modules/transactions/import/view.js`; `core/ui/base.css` is wave 1's and untouched):
- The page's fold helper adds the class `im-st` to any summary with a status that is not an h2.
- The page's own STYLE then keeps the title whole (`flex: 0 1 auto`) and lets the status take the rest and wrap at the
  right (`flex: 1 1 0; white-space: normal; text-align: right`).
- This also covers the CSV's "See the lines" and the new columns status (F4).

**After** (`shots/F2-*-after-*.png`, Read at 320-dark and 390):
- At 320 px the title is 31 to 124 on one line, the status 134 to 271 on three short lines, and the chevron 281 to 289
  inside the card (14 to 306). innerWidth, scrollWidth and the visual viewport are all 320, closed and with every fold
  open.
- At 390 px the title is one line and the status two.
- The width check for this state is in `rp.mjs` (`width()`, which lists any element past the visual viewport). The
  skeptic's `w320.mjs` (`reg/w320.out`) gives 320/320/320 for all nine screens, closed and all-open, including "import
  mix" and "odd lines only".

## F3 (L7): "Ask the AI to find the rest" closed its fold and hid the answer

**Reproduced** (`rp-before.json` F3; `shots/F3-before-*.png`): after the tap, every details was closed and the summary
still read "5 of 9". The error was in textContent but not in innerText.

**Fix** (`modules/ai/reader/view.js`):
- `foundCard()` is now built with the page's `fold("found", ...)` (`card fold fold-card rd-found-fold`, h2), so it is
  remembered in `opened`.
- The AI's handler also adds "found" before it redraws, so the fold opens on the answer or the error.
- The error is now a red notice ("The AI is not available: ... Settings has the AI connection.") and the success note
  stays blue. Both sit under the button that was tapped.
- The summary says what the fold holds, so a fold the person closes still tells: "5 of 9, the AI did not answer" or
  "7 of 9, 2 from the AI".
- At 320 px the status may wrap under its heading, at no more than 45% of the width (the page's own STYLE).
- `aiErr` is cleared wherever `aiNote` is.

**After** (`rp-after*.json` F3 and F3ok, all four views):
- With no AI: the fold is open, the notice shows in innerText, and the summary reads "5 of 9, the AI did not answer".
  Closed by hand, the summary still says so.
- With a stand-in answer routed to the AI's address: "The AI found 2 more. Check them against the document." shows, the
  summary reads "7 of 9, 2 from the AI", and both rows read "from the AI: check it".
- The plan was unchanged and the width stayed 320 at 320. Pictures: `F3-note-after-320-dark.png`, `F3ok-after-390.png`.

## F4 (L8): a CSV column changed by hand folded away under "Columns worked out for you"

**Reproduced** (`rp-before.json` F4; `shots/F4-dmy-before-*.png`): after "day/month/year", the columns fold was closed
with its old summary. "See the lines 4 new · 6 could not be read" was open, and the filled "Import 4 transactions" sat
between them.

**Fix:**
- In `modules/transactions/import/compute.js` (pure), `prepareImport` now also returns `auto: { mapping, flipSign, bad }`.
  It holds what the file, or a layout saved from an earlier import, works out with nothing changed by hand, and how many
  rows those choices leave unread. The extra parse runs only when something differs.
- It also returns `flipByHand`.
- The new `columnChanges(prep)` lists `{ key, to }` for each change: date, date order, description, amount (the money
  columns as one change), the debit/credit column, or the sign. The sign counts only when the box was set by hand. My
  CSV sweep caught that otherwise, changing the amount column on a card file showed "2 changes" for one act.
- In `view.js`, the columns fold is `fold("cols", ...)`, so it stays open while the person works in it.
  - With a change, its summary reads "Columns: changed by you", with the change as its status: "dates day/month/year",
    "amounts turned around", "description column: none", or "N changes".
  - When a change leaves more rows unreadable than the app's own choices, the fold opens with an amber notice: "With this
    change, 6 rows could not be read; the app's own choices read every row." It has an outlined "Put back what the app
    worked out", and the Import button turns outlined, so the screen has no filled button while in doubt.
  - "Some columns could not be found: pick them" (open) still comes first when a column is missing.
- Also on the page:
  - "More options", "Not this account? Change it" and the opt-in for another kind of account are now remembered folds
    too, so the README's "a fold opened on this visit stays open" holds for every fold on the page.
  - A new file or new pasted text closes the preview's folds again. It also clears `flipSign`, a tick for the file before
    that used to carry over.
- Tests (`modules/transactions/import/module.test.mjs`, one new test of 9 checks): no change; the date order with
  `bad` 3 against `auto.bad` 0; the sign ticked and a card file's own tick taken off; the money columns as one change,
  also on a card file whose sign follows them; a column set to none; and a saved layout counted as the app's own.
- The README has the "Columns changed by hand" and "A summary with a status" bullets, and its fold list and test line are
  updated.

**After** (`rp-after*.json` F4, all four views; pictures `F4-dmy-after-*`, `F4-dmy-notice-after-*`,
`F4-dmy-closed-after-*`, `F4-flip-after-*`, Read):
- After "day/month/year": "Columns: changed by you · dates day/month/year" is open, the notice is in it, and there is no
  filled button.
- Closed by hand, the summary still says it.
- "Put back what the app worked out" goes back to "Columns worked out for you", 10 new, and the filled "Import 10
  transactions".
- Ticking "Amounts look backwards" shows "Columns: changed by you · amounts turned around". Every row still reads, so the
  fold is not forced open and Import stays filled.
- The plan was unchanged throughout, opening and closing changed nothing, and the width is 320 at 320.
- `csvsweep.out`: 5 plans × 14 CSV files × every account, 2,072 runs, 0 problems. Each single change by hand is named
  exactly once, `auto.bad` equals the app's own bad count, and no import record carries `auto`. A change left more rows
  unread (fold opens, Import outlined) 532 times: date 168, amount 196, date order 168.

## In passing: F5 (severity 1, L8)
The opt-in under "Visa card is not a checking account" is now worded as the person's choice: "It is my Visa card file
after all". The outlined "Bring it in to Visa card anyway" inside it is unchanged. Walked in `reg/i2-visaAsked-*` and
`reg/i3` N1anyway: 10 lines on Visa, and Visa's 6,400 untouched.

## Owner's rule, as applied here (also in the READMEs)
1. Each new card shows the answer and at most one outlined action: "Set it to $0" or "See what putting some in would do".
2. Nothing new is behind a second filled button. In doubt (F1's amber card, F4's unreadable rows) there is no filled
   button at all.
3. A fold that holds a changed figure or an error says so in its summary: "Columns: changed by you · ...", "..., the AI
   did not answer", "..., 2 from the AI". The error opens it.
4. Opening or closing never changes the plan. This was checked on every walked screen (`foldsKeepPlan`, all
   `planSame*: true`).
5. Nothing was removed. Every choice is where it was, and "Put back what the app worked out" is new.
6. The match and the 401(k)'s $0.00 line, both worth money to the person, are never folded.

## Checks
- `npm run registry`: 161 modules, `modules/registry.js` unchanged.
- Touched modules' tests on the final commits: reader 31 of 31, import 15 of 15, `tests/ofx.test.mjs` 27 of 27.
- Whole `npm test` (`npmtest.txt`) on the fix before the last change: 189,460 tests, 188,819 pass, 1 fail, 3 skipped,
  637 todo. The one failure is the known speed test "200 times in under 600 ms" (`tests/estimate-perf.test.mjs`). Run
  alone it passes, 1 of 1.
- The whole run again on the final commits (`npmtest2.txt`): 189,460 tests, 188,818 pass, 2 fail, 3 skipped, 637 todo.
  Both failures are the two named speed tests ("takes well under 1.5 s" in `modules/transactions/ledger/module.test.mjs`
  and "200 times in under 600 ms"). It ran beside other agents' walks; run alone, each passes 1 of 1. Nothing else fails.
- `npm run check`: OK.
- `node tools/leak-guard.mjs --worktree`: OK, 2,881 files. The staged runs at each commit were OK too.
- `git diff 707355c HEAD -- tests/golden`: empty.
- CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md and `modules/registry.js` are untouched.
- `rv/doc/L7.changelog` gains "says when the 401(k) line reads $0.00 this paycheck (with an outlined "Set it to $0" when
  the plan says money goes in)".
- `rv/doc/L8.changelog` gains "a CSV column changed by hand is said on its fold (one that leaves rows unreadable opens it,
  with "Put back what the app worked out")".

**Regression walks**: the skeptic's own scripts, on this worktree, 390 and 320 light and dark.
- `i1`: Dana's file end to end with Undo; no sideways scroll, no errors.
- `i2`: nine import screens, every fold opened and closed with the plan unchanged, no overflow, no page errors.
  "visaAsked" now taps "after all".
- `i3`: P5 Undo puts 6,000 back as of 11/11. M11 sets 0 owed. N5 shows XXXX. N1 puts 10 lines on Visa and leaves 6,400.
- `r1`: nine reader screens.
- `r2`: Lee Yes/No as before, B7, N8, own number 110.77, the "1 more change" fold, the zero line, no adult, statement.
- `w320`: all 320.
- No page errors anywhere.
- The only console error is the refused connection to the AI's address in F3 (no AI here), which is expected.

## To try on the real iPhone (only Chromium here)
- **F2:** the three-part "See the lines" summary at 320 px and with Dynamic Type larger. It should wrap at the right with
  no sideways scroll, and the chevron should stay visible.
- **F3:** with the AI on, "Ask the AI to find the rest" inside "What the app read on it" keeps the fold open with its note.
  The summary's "2 from the AI" should wrap neatly under the heading at 320 px.
- **F4:** the "Date order" wheel inside the columns fold. After choosing, the fold stays open, the amber note and "Put
  back what the app worked out" are reachable above the keyboard and the wheel, and Import is outlined.
- **F1:** a real stub copied from a PDF in Safari with a 0.00 current 401(k) line and a year-to-date figure. It should
  arrive as two figures on one line, so the "so far this year" figure shows; if Safari breaks the columns apart, the
  figure is left out, never guessed.
- From before: the Files picker (.qfx/.qbo/.ofx not greyed out), windows-1252 text, the balance tick box's label tap, the
  selects' wheels, the page scrolling itself to the changes and to the preview, the keyboard over the paste box at 320 px,
  and a double tap on "Use it", "Set it to $0" and "Import".
