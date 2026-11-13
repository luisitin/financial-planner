# Track scn, final fix (builder claude-b, 2026-11-13)

Worktree `rv/b-scn`, base 707355c. L1 is one local commit: **5c62458** (was a8e0763 when the final skeptic read it; the fix
was folded in with `git commit --fixup` and `rebase -i --autosquash 707355c`, twice: the code and tests, then one README note).
Trailers at the end of the message: "Agent: claude-b", "Co-Authored-By: Claude <noreply@anthropic.com>",
"Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS". Scripts, logs and pictures:
`$SP/rv/scn/fixf/`.

## scn-final-1 (severity 2): Goal seek folded the idle 401(k) note when saving alone cannot get there. Fixed in L1.

**Reproduced** on a8e0763 by the skeptic's own sweep (`fin/sw7-0.log`, `fin/sw7-1.log`: 99 + 111 = 210 of 4,092 Goal seek
first views fold a card that names a match, an idle 401(k) or a Social Security age that gets there, every one of them the saving
card "No amount of saving gets there before retirement. <Name>'s 401(k) holds $..., but nothing goes into it now. If some of each
paycheck does go in, add it on Retirement contributions.", status "cannot"). Cause: `firstLevers` in
`modules/scenarios/goal-seek/compute.js` pinned the saving card with `idle` only while `status === "needs"`; with "cannot" it
ranked last (LEVER_RANK) behind any "needs" card and the "not on its own" retiring card that came earlier in the page's order.

**Fix** (`modules/scenarios/goal-seek/compute.js`, `firstLevers`, pure): the saving card is pinned whenever it carries `idle` and
its status is "needs" or "cannot". With "room" or "same" ("just right": "Nothing more: it gets there even if retirement saving
stopped today") its sentence names no 401(k), so it ranks as before. At most two cards are pinned (Social Security, saving), so the
first view stays three cards. Legacy goals follows through `listedLevers`, which keeps `firstLevers`' order. No view change, no
engine change, no schema change.

**After, by code** (`fixf/repro.mjs` on rv/b-scn): the skeptic's plan (`fin/plan-idle-cannot.json`, qa
`02-couple-no-kids/expenses/spending-above-income`) with Just last, room for bad luck and leave $250,000: shown "spending:needs,
saving:cannot+idle, lump:needs", folded "retire:cannot"; Legacy goals lists "spending, saving, lump, retire".
Sweep of every qa plan with the three goals (`fixf/sw7f-0.log`, `fixf/sw7f-1.log`, the skeptic's script with a status count):
4,092 first views, **0 folded hints** (210 before), 0 good Social Security cards folded, 0 first views over three cards. The 467
idle saving cards still folded are all "same" ("Nothing more: it gets there even if retirement saving stopped today (now $0 a
month)."), which name no 401(k).

**What moves into the fold instead** (`fixf/tradeoff-lump.mjs`, `fixf/tl-0.log`, `fixf/tl-1.log`): 304 of 4,092 first views
change. "What it is short today" (needs) goes under "1 more change" when spending and retiring both get there on their own (176,
for example 12-high-net-worth base with room for bad luck: shown spending, retiring, saving); a "not on its own" retiring card
(128). Either is named in the fold's line, one tap away. I judged this right under rule 7 (a hint worth money is never folded) and
rule 1 (three cards); it is written in the Goal seek README.

**On the phone** (`fixf/walk.mjs`, rv/b-scn served on 9701, sandbox, iPhone emulation, `fixf/walk.txt`, pictures
`fixf/shots/gs_idle_*`, `fixf/shots/lg_idle_*`): Goal seek at 390 and 320, light and dark: the first view is "What you can spend /
needs a change", "What you need to save / not on its own" with the 401(k) sentence and "Retirement contributions ›", "What it is
short today / needs a change", then "1 more change / retiring" holding "When Priya can retire / not on its own". The same with
"Leave $250,000" and with "Room for bad luck" (the goal fold says "room for bad luck is on"). Opening and closing the fold left the
sandbox plan byte-identical; no sideways scroll, no control under 44 px, no builder word, no page error. Legacy goals (the same plan
leaving $50,000 to Cy) at 390 and 320, light and dark: spending, saving (the 401(k) sentence), short today, "1 more change /
retiring". Casey (the idle card that gets there) unchanged: spending, saving "needs a change", short today; "2 more changes /
retiring, Social Security". I read gs_idle_390_first, gs_idle_390_full (cropped), gs_idle_320d_first, gs_idle_320d_full (cropped),
lg_idle_390 and lg_idle_320d: the card sits second, its pill "not on its own" beside the title at 390 and under it at 320.

**Tests**: Goal seek "final fix (rule 7): the saving card that names an idle 401(k) stays in the first view when saving alone
cannot get there" (made-up lists: pinned with idle and "cannot", still last without idle, not pinned with "room"; the qa plan with
the three goals by code; the page through fake-dom: the card above the fold, the fold's line "1 more change / retiring", nothing
saved). Legacy goals "final fix (rule 7): a 401(k) with nothing going in stays among the first three changes when saving alone
cannot get there" (the same plan leaving $50,000).

**README**: Goal seek's "Three change cards first" bullet and a "Final fix (2026-11-13)" section (the rule, what moves into the
fold, the tests); Legacy goals' list bullet. The firstLevers doc comment says the same. The commit message's "Goal seek's first
cards" line already reads "the idle-401(k) saving card while "needs" or "cannot" are never folded". The CHANGELOG line
(`rv/scn/L1.changelog`, "three change cards first (what is worth money first)") already covers it; unchanged.

## Not touched
The skeptic's findings 2 to 4 (severity 1) and the note on `sensitivity/README.md`'s fix-round-1 section were not in this task's
confirmed list; left as they are.

## Checks on 5c62458
- `npm run registry`: 161 modules, `modules/registry.js` unchanged; `git status` clean.
- Touched modules (Goal seek, What matters most, Legacy goals): 57 of 57.
- The whole `npm test` (`fixf/npm-test-final.txt`, 528 s at load 14 to 21): 189,432 tests, 188,791 pass, 1 fail, 3 skipped, 637
  todo. The one failure is the named speed test "verify 5, C: three years of daily lines ... takes well under 1.5 s" ("37 months
  took 1868 ms", `modules/transactions/ledger`, not touched by L1); alone it passes 3 of 3. (The run on the code-and-tests fixup,
  same code, `fixf/npm-test.txt`: 189,432 tests, 0 failures.)
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (2,879 files); `--commits 707355c..HEAD`: OK (15 files).
- `git diff --stat 707355c HEAD` on tests/golden, modules/registry.js, CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md, core/,
  index.html, modules/retirement/projection/compute.js, modules/overview/**, modules/investments/**: empty.
- `git log 707355c..HEAD`: one commit, 5c62458; its message ends in exactly the three trailer lines.
- The phone walk rerun on 5c62458 (`fixf/walk-final.txt`): the same first views as above at 390 and 320, light and dark, the plan
  unchanged after every tap, every audit clean; the server on 9701 stopped (`curl` gets nothing).

## To try on the real iPhone (only Chromium here)
- Goal seek on the qa couple spending more than comes in: the 401(k) card second in the first view at 390 and 320; "1 more change"
  opens and closes without the page jumping; "Retirement contributions ›" opens that page and Back returns to Goal seek.
- Legacy goals on the same plan with a $50,000 gift: the three changes and "1 more change / retiring" open in place.
