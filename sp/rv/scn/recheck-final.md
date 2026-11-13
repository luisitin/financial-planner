# Track scn, recheck after the final fix (skeptic, 2026-11-13)

Checked: L1 = **5c62458** on 707355c (`git log 707355c..5c62458` lists only it; it was a8e0763 when scn-final-1 was filed, and
the fix was folded in with `--fixup` and `rebase --autosquash`). I read it from my own detached copy `rv/v-scn-fin2`, which I
removed at the end. I changed nothing in `rv/b-scn` (still 5c62458, `git status` clean) or in the main repository. My servers ran
on 9701 and 9702, each stopped by its script (`finally`). Afterwards `curl` gets no answer on 9701 to 9709. Every phone screen ran
in the sandbox: Chromium with an iPhone user agent and touch, at 390 px and 320 px, light and dark.
Scripts, logs and pictures are in
`$SP/rv/scn/fin2/`:
- `c1` and `c2`: checks by code
- `sw7`: the original sweep, rerun
- `sw8`: a wider sweep (four goals, broader hint words, Legacy goals too)
- `sw9`: what the fix moved into the fold
- `w1`: the phone walk on the reported plan
- `w2`: 168 first views
- `cmp.mjs`: compares those first views with the a8e0763 run
- `npm-test.txt`: the whole test run
- `shots/`: the pictures

## Verdict
**scn-final-1 is closed.** I found no regressions and no new findings. Nothing is still open.

## scn-final-1 (severity 2): the idle 401(k) note was folded when saving alone could not get there. Closed.

**The code.** `firstLevers` in `modules/scenarios/goal-seek/compute.js` used to keep the saving card in the first view only when
it carried `idle` and its status was "needs". It now does so when the status is "needs" or "cannot". Legacy goals'
`listedLevers` still calls `firstLevers`, so it follows. I read the saving lever: `idle` is set only when nothing goes in
(`now < 0.5`). In that case "room" cannot happen, because the search's lower bound is `-now`, which is about 0. "Same" says
"Nothing more: it gets there even if retirement saving stopped today (now $0 a month)." and does not name the 401(k). So every
sentence that names the idle 401(k) now stays in the first view. At most two cards are kept this way (Social Security and
saving), so the first view still shows at most three cards.

**By code** (`c1.txt`): the qa plan `02-couple-no-kids/expenses/spending-above-income` (`fin/plan-idle-cannot.json`), with Just
last, room for bad luck, leave $250,000, and room for bad luck plus $250,000:
- 5c62458 shows "spending:needs, saving:cannot+idle, lump:needs" and folds "retire:cannot".
- With a8e0763's rule, the same levers show "spending, retire, lump" and fold the saving card.
- Legacy goals leaving $50,000 or $250,000 to Cy lists "spending, saving:cannot+idle, lump, retire".
- The plan is byte-identical afterwards.

The other examples in the finding (`c2.txt`), all with the saving card shown:
- 06-blended-family/debts/dti-exactly-36 ("Rob's 401(k) holds $74,000 ...") on all three goals.
- 12-high-net-worth/base with room for bad luck and with $250,000 ("Victoria's 401(k) holds $940,000 ...").
- 06-blended-family/income/period-monthly with room for bad luck. This one uses the plural wording: "Rob's 401(k) and Kim's 401(k)
  hold $112,000 between them, but nothing goes into them now."

**Mutation check.** I put back a8e0763's rule in my copy. Both new tests then fail: Goal seek "final fix (rule 7): the saving card
that names an idle 401(k) stays in the first view ..." and Legacy goals "final fix (rule 7): a 401(k) with nothing going in stays
among the first three ...". With the commit as it is, they pass. My copy was restored with `git checkout` and checked with `cmp`.

**Sweeps over every qa plan** (1,423 plans):
- `sw7`, the original script, rerun on 5c62458. Three goals, 4,092 first views:
  - 0 folded hints (210 on a8e0763).
  - 0 good Social Security cards folded.
  - 0 first views with more than three cards.
  - 467 idle saving cards are still folded, and every one has status "same", with the sentence "Nothing more ...".
  - This is byte-equal to the builder's `fixf/sw7f-*.log`.
- `sw8`, wider: four goals (adding room for bad luck plus $250,000), 5,456 first views. A card counts as a hint if its words
  match `401(k)|403(b)|plan at work|match|adds some|nothing goes into it|credit`.
  - 0 folded in Goal seek.
  - 0 among Legacy goals' folded changes on the short plans.
  - 0 idle cards that name the 401(k) are folded.
  - Idle cards shown first: 2,845 "needs" and 548 "cannot".
  - 0 throws, 0 plans changed, 0 first views over three cards.
- `sw9`, what moved. 304 of 4,092 first views changed:
  - Moved into view: 304 saving:cannot+idle.
  - Moved into the fold: 176 "What it is short today" (needs) and 128 "When ... can retire" (not on its own).
  - These are exactly the figures in the Goal seek README's "Final fix" section.
  - The 304 are more than the 210 the old sweep counted. Its words missed the plural "nothing goes into them".

**On the phone** (`w1.txt`, the reported plan, Goal seek at 390, 390 dark, 320 and 320 dark):
- First view: "What you can spend / needs a change", "What you need to save / not on its own", "What it is short today / needs a
  change". The saving card reads: "No amount of saving gets there before retirement. Priya's 401(k) holds $92,000, but nothing goes
  into it now. If some of each paycheck does go in, add it on Retirement contributions." It ends with an outlined "Retirement
  contributions ›".
- The fold reads "1 more change / retiring" and holds "When Priya can retire / not on its own".
- The same three cards and the same fold appear after "Leave $250,000" and after "Room for bad luck" (the goal fold then says "room
  for bad luck is on").
- "Retirement contributions ›" opens `#/retirement/contributions`, and Back returns to Goal seek with the same three cards.
- Opening and closing the fold, and every goal tap, left the sandbox plan byte-identical.
- Audit on every screen: no sideways scroll, no control under 44 px, nothing off the side, no builder word, no page error.

Legacy goals, with the same plan leaving $50,000 to Cy, at all four variants:
- The list shows spending, the 401(k) sentence, and short today, then "1 more change / retiring". The 401(k) sentence is outside
  the fold.
- The fold opens and closes, and the plan is unchanged.

I read these pictures:
- `gs_idle_390_first`
- `crop_gs_idle_390_full`: the card is second, with its pill beside the title.
- `crop_gs_idle_320d_full`: the title is on one line and the pill is under it.
- `crop_lg_idle_390_full`
- `crop_lg_idle_320d_full`

**README and tests.** The Goal seek README has the "Three change cards first" bullet and a "Final fix (2026-11-13)" section with
the rule, what moves into the fold and the tests. The Legacy goals README has its list bullet. The `firstLevers` doc comment and
the commit message's "Goal seek's first cards" line say the same thing. One test in each module covers it.

## Regressions
**First views on the phone** (`w2`). 14 households x Goal seek, What matters most and Legacy goals x 4 variants = 168 screens.
The households: Casey, Jamie, Dana, Robin, Morgan, the family, the reported plan, 01-single-adult, 10-student-and-starter, Casey
with an empty 401(k), the retired couple, Jamie with a legacy, Sam (kit) and renterDebt (kit).
- I compared `cmp.mjs` against the a8e0763 run (`fin/w1-all.json`). 154 of 156 screens are identical in cards, rows, folds,
  chips, boxes and full text.
- The two that differ are `dana_goal-seek_320` and `family_goal-seek_320`. The earlier run caught them while the page still said
  "Checking your plan against bad years..." and now they show the finished answer "Your plan works if markets are average". The
  cards and folds are the same, and their 390 screens are identical, so this is capture timing, not a code change.
- On all 168 screens:
  - at most three cards, rows or changes
  - no control under 44 px, nothing off the side, no sideways scroll
  - no builder word (build, PC, AI, sync, server, NaN, undefined, null, Infinity)
  - no page error
  - no card title under 100 px wide
  - the plan is unchanged
- The "filled" list from the census tool shows Goal seek's four goal chips, as in the a8e0763 run. Only the chosen chip is solid
  (picture `gs_idle_390_first`). This is not a second filled button.

**The whole `npm test`** (`fin2/npm-test.txt`, 514 s at load 11 to 22): 189,432 tests, 188,792 pass, **0 fail**, 3 skipped, 637
todo, exit 0. The two speed tests passed in this run.

**Touched modules**: Goal seek, What matters most, Legacy goals and the Plan health score: 77 of 77.

**Repository checks**:
- `npm run registry`: 161 modules, `modules/registry.js` unchanged, `git status` clean.
- `npm run check`: OK.
- `node tools/leak-guard.mjs --worktree`: OK (2,879 files). `--commits 707355c..HEAD`: OK (15 files).
- `git diff --stat 707355c HEAD` is empty for these paths:
  - tests/golden, modules/registry.js
  - CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md
  - core/, index.html
  - modules/retirement/projection/compute.js, modules/overview/**, modules/investments/**
- One commit. Its message ends in exactly these lines:
  - "Agent: claude-b"
  - "Co-Authored-By: Claude <noreply@anthropic.com>"
  - "Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS"
- `rv/scn/L1.changelog` already covers "three change cards first (what is worth money first)".

## Observation, not a finding
When the plan already gets there (status "same"), the saving card says "Nothing more ..." and does not mention an idle 401(k), and
that card is folded. In these cases Goal seek has nothing to fix, and this was outside scn-final-1 and the earlier rounds. If the
owner wants an idle 401(k) pointed out even on a plan that works, that belongs to another page (for example the next move), not
Goal seek's change cards.

## To try on the real iPhone (only Chromium here)
- Goal seek on the qa couple whose spending is above what comes in, at 390 and 320:
  - Is the 401(k) card second, with the pill beside its title at 390 and under it at 320?
  - Does "1 more change" open and close without the page jumping?
  - Does "Retirement contributions ›" open that page, and does Back return to Goal seek at the same place?
- Legacy goals on the same plan with a $50,000 gift: do the three changes and "1 more change / retiring" open in place?
