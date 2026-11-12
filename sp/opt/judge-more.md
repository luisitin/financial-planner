# Judge: the detail lover (the engineer who tracks every dollar, the spouse who does the taxes)

Written 2026-11-12 on tip 737fb6a. Nothing in `$REPO`, the read-only copy `opt/app` or the three
prototype worktrees was edited or served by me: I copied each prototype's served files into a folder of my own and served
the copies on ports 9871 to 9874. Every server I started is stopped (9871 to 9879 answer nothing).

`$O` = `$SP/opt`

## Verdict

| design | score | best thing | worst thing |
|---|---|---|---|
| **DIAL** (inline parts + "Show everything on this page" + a device setting) | **8** | One tick puts all 32 figures and all 19 boxes of the page on screen, and it is still so after a reload, Back, a new visit and a new tab. Two taps set every adopted page on the phone, forms included (the bill form went from 4 of 8 boxes to 8 of 8). | It only knows all or nothing. One part opened by hand is forgotten on reload, on Back and after a save; two of the three forms shut themselves after their own Save; a part I shut under "everything" comes back open. |
| **INLINE** (parts only, remembered per part on the device) | **7** | What I open stays open, part by part. It passed every keep test I ran (reload, Back, new visit, new tab, each form's own Save), and all three forms have one habit. | There is no way to say "everything". Five taps on this page, then again on every other page, then again whenever the phone forgets. Nothing about it in Settings (the count line is specified, not built). |
| **STAGES** (a short page and a deeper page; the offer follows the path) | **4** | Rows worded as questions that carry a real figure ("Would itemizing save tax? itemizing: $37,406, 4 yours"), and a link that lands on one part, 68 px under the top bar, with the focus on it. | Everything is never in one place, and the list of what exists is held back until the path is finished. Before that: one row, "The four numbers and 10 more"; the itemized form is 2.9 screens down a 5.6-screen page with no list of its sections; the tax links are 5 screens down. |

**Winner: DIAL**, with INLINE's per-part memory grafted in. The dial is the only design that answers "fewest taps to
everything"; inline is the only one that answers "keep what I open, open". Together they are what Kai and Lee asked for
in the walks. They fit in one place: the dial already decides open or shut in one function.

**The one that feels like the app is hiding things: STAGES**, in its first stage. See section 4.

## 1. What I did

One page exists in all three prototypes, Federal estimate (`taxes/federal`), so every comparison is on it: the invented
family, 390 x 844, touch, the sandbox. The dial prototype also has the bill form on Expenses and a Settings card; the
stages prototype has a Settings card. I ran the same jobs on each:

- **A. Everything.** From arrival, tap until every figure and box the page can show is readable.
- **B. Keep it.** Reload; Dashboard and Back; a new visit by the menu; a new tab on the same device.
- **C. Find one thing** without hunting: is it readable, is it in the page at all (so find-in-page can reach it), how far.
- **D. Lee's job.** Type four itemized deductions, save, see the answer move, come back later.
- **E. Say it once.** Is there anything in Settings for me, and what does it do on other pages.
- **G. Kai's job.** "I only ever want the working open." One part, kept, nothing else.

The yardstick for "everything" is the page at the tip with its three folds opened by hand: **32 distinct money and
percent figures and 19 boxes**, 6.14 screens. A prototype's state is scored as "n of 32 figures, n of 19 boxes readable".

## 2. The numbers

### As the page opens (nothing tapped)

| | tip | inline | dial | stages, path not finished | stages, path finished |
|---|---|---|---|---|---|
| screens | 3.27 | 1.30 | 1.25 | 1.00 | 1.26 |
| words readable | 485 | 128 | 104 | 64 | 97 |
| figures readable (of the 32) | 29 | 3 | 3 | 3 | 5 |
| of the 32, in the page at all (find-in-page can reach them) | 32 | 32 | 32 | **3** | **5** |
| rows that name what else there is | 3 folds | 5 parts + 5 links | 6 parts + 4 links | **1 row** | 4 rows + "All 11" |

All three open equally short. The difference a detail lover feels is the last two rows: on inline and dial the detail
is in the page behind named rows; on stages it is not in the page, and before the path is finished it is not even named.

### A. Everything on screen

| | taps | figures | boxes | screens | notes |
|---|---|---|---|---|---|
| inline | **5** (one per part) | 32 of 32 | 19 of 19 | 6.41 | no row moved under the finger; plan byte-identical |
| dial | **1** (the tick) | 32 of 32 | 19 of 19 | 6.34 | 0.5 s; no scroll jump; plan byte-identical; the row itself ends up 6 screens down (y=5099) |
| dial, device set to "Everything open" | **0** | 32 of 32 | 19 of 19 | 6.5 | 2 taps once, for every adopted page |
| stages | **1**, onto a second address | 32 of 32 | **10 of 19** | 5.63 | the 9 "Figures the plan cannot see" boxes exist only on the short page, behind a fold; not in the deeper page at all |

On stages there is no state in which the whole page is in front of me. The working is at `?deeper=1`; nine of the
inputs that feed it are one Back and one tap away.

### B. Keep it

| after "everything" | inline | dial (page ticked) | stages (on the deeper page) |
|---|---|---|---|
| reload | 32 / 19 | 32 / 19 | 32 / 10 (the address) |
| Dashboard, then Back | 32 / 19 | 32 / 19 | 32 / 10 |
| a new visit by the menu | 32 / 19 | 32 / 19 | **3 / 0: the short page again** |
| a new tab on this device | 32 / 19 | 32 / 19 | 3 / 0 |

On stages every later visit costs one tap and a scroll, unless I tick "Keep this" under each part. That is 7 taps for
this page (the row, five ticks, the way back) and it still leaves out the nine boxes (their fold shut again after
going deeper and pressing Back), the small print with the sources (cannot be kept) and, before the path is finished,
every link to another tax page. Kept parts also cannot be shut: the short page is then 4.9 screens for good.

### G. Only the working, kept

| | taps, once | still there after reload | after Dashboard and Back | after another form's Save |
|---|---|---|---|---|
| inline | 1 | yes | yes | yes |
| dial | not possible | **no** (0 parts open) | **no** | **no** |
| stages | 3 (row, tick, back) | yes | yes | yes |

This is the dial's hole. Measured on its prototype with the dial off, "How this is worked out" and one form opened by
hand, then that form saved:

| form saved | open afterwards |
|---|---|
| Itemized deductions | nothing: the working shut, **and the part just saved shut** |
| Year and people | nothing |
| Figures the plan cannot see | that part only |

The same three saves on inline left every opened part open, the saved one included. The dial design's own rule 16
("the part just saved stays open") is met by one form of three in its prototype; the design leaves single parts to wave
1's place memory, which keeps them for one tab's history and not for a new visit. And with the page ticked, a part I
shut by hand (the 1,281 px form I never use) was open again after a reload.

### C. Finding one thing, from arrival

| I want | inline | dial | stages, path not finished | stages, path finished |
|---|---|---|---|---|
| taxable income | 1 tap, row on the first screen | 1 tap | 1 tap, top of the deeper page | 1 tap |
| the itemized boxes | 1 tap, opens in place | 1 tap | 1 tap, then **2,423 px of scrolling**, no list of sections | 1 tap, lands 68 px from the top, focus on it |
| tax withheld so far (a box) | 1 tap | 1 tap | 1 tap (fold on the short page); **not on the deeper page** | the same |
| what it leaves out, the sources | 1 tap (inside the working) | 1 tap (inside the working) | 1 tap, then 3,847 px | "All 11", then 3,907 px |
| Bracket explorer and the other tax pages | **on the first view**, 5 links, each with a line | **on the first view**, 4 chips | 1 tap, then 4,251 px (5 screens) | "All 11", then 4,311 px |
| any of it by find-in-page from the first view | in the page | in the page | not in the page | not in the page |

### D. Lee types four deductions and saves

All three: the green line appears where the thumb is ("Deductions saved. Federal tax for 2026 is now about $13,577"),
the headline becomes "owe about $4,108", nothing else is written. What differs is what the shut row says afterwards:

| | the row, shut |
|---|---|
| inline | "Itemized deductions · 4 set by you" (the verdict "standard is better" is gone: the 20-character cap) |
| dial | "Itemized deductions · 4 set by you · itemizing $37,406" (both; the title wraps to two lines) |
| stages, finished | "Would itemizing save tax? · itemizing: $37,406 · 4 yours" (the best of the three) |
| stages, not finished | "More about this year's tax · The four numbers and 10 more · 4 yours" (which four? where?) |

### E. Say it once

| | Settings | what it does |
|---|---|---|
| inline | nothing built | - |
| dial | "How much detail": The short view / Everything open, second card (y=435), confirms in green | Federal estimate then opens with 32 / 19 and the row ticked. One page can be unticked on a device set to everything, and that survives a reload. With the device on everything, pages that have not adopted the helper do nothing: Will the money last? 1 fold still shut, Assumptions 1 shut, Expenses' bill list shut. |
| stages | "Going deeper": "List the deeper pages now, before my plan is finished", fourth card (y=1376) | shows the card of four questions in place of the one row. It opens nothing. |

## 3. Why the dial wins for this person, and why not alone

- Kai's list was: the working under every answer, keep what I open, every box in every form, the deeper pages listed.
  The dial delivers the first and the third in two taps for the whole phone, and the fourth is on the first view. Inline
  delivers the second. Stages delivers the fourth only after the path is finished, or after finding a tick in Settings.
- Across the app the gap grows. Inline's own figure is up to 70 taps for the 14 walked pages; there are about 150 pages,
  and Safari can empty a site's storage after seven days away, after which inline costs the taps again and the dial
  costs two.
- The dial does not take anything from the person who wants less: with nothing stored the two prototypes open the same
  page (1.25 and 1.30 screens, 3 figures).
- But a dial with no memory of single parts tells the engineer "all of it or none of it, every time". That is the
  other half of what he asked for, and inline has it working today, without wave 1.

## 4. Which one feels like the app is hiding things

**Stages, before the path is finished**, which is where all eight invented households are (the stages designer's own
finding) and where a real household stays if it skips a step.

- The first view names nothing. One row: "More about this year's tax · The four numbers and 10 more". Inline and dial
  name five and six parts with a status each.
- The app decides when I may see the list. The card of questions appears after the last Next of the path, or after I
  find "Going deeper" in Settings. A detail lover reads that as "you are not ready yet".
- The detail is on another screen, away from the answer, and the inputs are split between the two screens.
- Find-in-page on the short page can reach 3 of the 32 figures (5 once the path is finished); on inline and dial all
  32 are in the page. On the owner's iPhone that is the only search a page has.
- Arriving at the top of a 5.6-screen page with no list of its sections is hunting. The finished stage fixes this
  with links that land on a part; the first stage does not have them.

Dial and inline do not feel like hiding: everything is in the page, behind a row that says what it is, and one tap
opens it where I am. Inline feels like a small toll on every page; the dial removes the toll.

## 5. Grafts onto the dial

From **inline**:
1. **Per-part memory on the device** (`planner.opened`: only the person's own tap, open and shut both, forgotten after
   90 days unseen). Order inside `part()`: a reason (error, just saved, a landing), then the person's remembered tap for
   this part, then the dial (the page's choice, else the device's), then shut. This makes "only the working, kept" one
   tap, and makes a part shut by hand under "everything" stay shut.
2. **One habit after a save**: the saved part stays open and no other part moves. Inline has it by construction.
3. **The Settings line** "Parts you opened stay open on this device: N now · Shut them all", inside the dial's card.
4. **The links card as rows with one line each**, and the fifth link (Tax on what you sell). The dial's four chips say
   less and drop one page.

From **stages**:
5. **A status that carries the part's figure**: "9.3% of your income overall", "the standard $32,200 is better",
   "itemizing: $37,406 · 4 yours". The detail lover then gets something from the row without opening it. It needs more
   room than inline's 20 characters; let the status take a second line under the title as stages does.
6. **A link that lands on one part** with the focus on it. With everything open the page is 6.3 screens; the parts card
   has gone, so nothing lists the sections. Rows that jump (or the tick row repeated above the first part while it is
   ticked, which the dial designer already suggests) fix that.
7. **"What this estimate leaves out" and the sources as a part of their own**, so the working stays under a screen and
   a half and "Which of my figures does it use?" stays on this page (inline moves it to the Tax report).
8. **The finished-plan moment, used to offer and never to hold back**: when the path is finished, Your plan says once
   "Want every page to open with everything? Settings › How much detail". That is the owner's "once we're in the big
   picture, you can delve deeper" without a gate.

## 6. Blocking in the dial

1. **Parts opened by hand are not kept, and two forms shut after their own Save** (measured, section 2 G). Do not adopt
   pages on this helper until graft 1 is in, or until every form part passes `open: "saved"` and the six rows of the
   design's table 2.5 pass as a touch test on the wave 1 tree. The design says that test has not been run.
2. **A part shut by hand under "everything" reopens** on reload (measured). Same fix.
3. **The Settings card promises "every page opens with all of it showing" and most pages will not** on the day it ships:
   153 hand-written folds on pages that have not adopted the helper stay shut (measured on three of them), and
   claude-a's 13 pages may never adopt it. The person this card is for will take that as broken. Either the card ships
   after the path pages are adopted and says "pages that have a short view", or the helper also opens the old folds of
   the six kinds.

Not blocking, to fix on the way: with everything open nothing at the top says so and the tick is 6 screens down;
`?detail=all` in an address writes the device's choice (after my 320 px run the store held `{"all":true}`), so a
shared link would switch someone else's phone, and it should count for the visit only; "Everything open" does not open
technical parts, per-item folds or add forms, so the card should say "numbers, working and optional boxes".

## 7. Not checked

A real iPhone, VoiceOver, Safari's find-in-page and print; wave 1's place memory (none of the prototypes stands on
it); the pages the designs only drew; any household but the family for the walks (first views of the others are in
the designers' reports). The first-view figures are from my own counter and differ from the designers' by a few words.

## 8. Files

| what | where |
|---|---|
| this report | `$O/judge-more.md` |
| screenshots (40) | `$O/judge-more/` |
| first views | `01-inline-first-screen.png`, `01-dial-first-screen.png`, `01-stages-first-first-screen.png`, `01-stages-done-first-screen.png` (and `-full`) |
| everything open | `02-inline-everything-open-full.png`, `02-dial-everything-open-full.png`, `02-stages-deeper-page-full.png`, `00-tip-all-folds-open-full.png` |
| after Lee's save, and the shut rows | `03-*`, `04-inline-shut-rows-after-typing.png`, `04-dial-shut-rows-after-typing.png`, `05-stages-*-short-after-typing.png` |
| only the working kept | `05-inline-only-working-kept-open.png`, `06-stages-first-short-with-working-kept.png` |
| the settings | `06-dial-settings-everything-open.png`, `08-stages-settings-card.png`, `07-dial-federal-device-everything-first-screen.png` |
| the bill form, short and with the device on everything | `09-dial-expenses-bill-form-short.png`, `09-dial-expenses-bill-form-everything.png` |
| stages: arriving for the itemized form in each stage | `03-stages-first-arrive-for-itemized.png`, `03-stages-done-arrive-for-itemized.png` |
| scripts and logs | `$O/judge-more-work/`: `lib.mjs`, `ref.mjs` + `ref.json` (the yardstick), `w1.mjs` + `w1.log` (first views), `w2-inline.mjs`, `w2-dial.mjs`, `w2-stages.mjs` + their `.log`, `w3.mjs` + `w3.log` (hand-opened parts, forms, landings, Back), `w4.mjs` + `w4.log` (readable and in the page, per first view) |
| my served copies of the prototypes and the tip (120 MB, safe to delete) | `$O/judge-more-work/inline`, `dial`, `stages`, `tip` |
