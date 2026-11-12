# Critique (person): wave 1, track "taps"

Critic: a layperson with a thumb and no patience, and the owner's design conscience. I walked 12 journeys from the six
theme files against section 1 (Behaviour) and the prototype. The prototype was copied, not edited, to
`scratchpad/w1/taps-person/proto` and served on 127.0.0.1:9325.

- Scripts: `w1/taps-person/j-*.mjs`, on top of `plib.mjs`, which sits on the shared kit.
- Printed results: `w1/taps-person/out/`. Pictures: `w1/taps-person/shots/`.
- Set-up: Chromium, 390 x 844 (320 x 568 where said), real touches, key-by-key typing, sandbox.
- Households: family, empty, patLee.
- `?w1off=all` means "the app as it is today".

The breaker's X1 to X3 and S1 to S8 (`critique-break.md`) are not repeated here. I agree with its S1 (two "‹" on every
Get started question): `shots/setup-q2.png` shows both, 60 px apart, and the bar's spoken name says "Back to Set up my
plan" while the page is Set up my plan.

## Blocking

### P1. The way back is at the top, but the person finishes at the bottom. MR-4 and A3 are not closed.

**Problem.** MR-4's own "why" is: "She fixes one thing and looks for the list she came from; the only link under the
page is 'Continue your plan', which is somewhere else." That is still exactly what the prototype shows:

- The named "‹ Back to Needs attention" sits only at the top. On Emergency fund it is 2,300 px above the person's
  thumb.
- The bar's "‹" shows no words.
- At the bottom, the only way is "Continue your plan: step 2 of 8 ›", which leads to a different journey.

**Evidence.**
- `j-ways2.mjs` (`out/j-ways2.txt`): all 6 Needs attention rows. On each destination the last control is
  "Continue your plan: step 2 of 8 › Your month". The named row is present only at the top. Pictures:
  `shots/ways2-alert0-top.png` and `shots/ways2-alert0-bottom.png`.
- `j-ways.mjs` (`out/j-ways.txt`), A3's walk:
  - Steps: empty plan, Will the money last?, then "People", then add Marcus.
  - The bottom shows "Marcus added." and then only "Continue your plan: step 1 of 4 ›" (`shots/ways-people-bottom.png`).
  - This is A3's "saw", unchanged.

**The decline in section 7 misreads the owner's rule.** Section 7 says A3's bottom way back is "therefore declined".
But the owner's own build already puts a ‹ link at the bottom, next to the one way on:

- base `modules/overview/guide/frame.js:214` (c385e41) draws "‹ Back to your plan" under "Next result" (picture:
  `shots/ways-planrow-bottom.png`);
- frame.js also draws "Back to quick answers" at the bottom of quick-answer pages;
- touch rule T-ONE-WAY says: "Links that lead back (they start with ‹) … do not count".

**Change.** In `frame.js`, whenever a named back is drawn (`named`, and the quick `trail`), also put the same
"‹ Back to <name>" link in the bottom row's `gn-links`, beside the one way on. This is the plan branch's pattern. It is
a quiet link, not a second button. Then:

- correct the decline in section 7;
- mark MR-4 and A3 as closed only after a picture of the bottom shows the named link.

T-ONE-WAY stays green.

### P2. The menu keeps an old search word after the page changes. This is worse than today.

**Problem.** Steps:
1. Type "social" in Find a page and open Social Security.
2. Go on to another page.
3. Open the menu.

The menu still says "social" and lists only those results. "Recent", the Dashboard row and the topics are gone until
the person notices the word and clears it. This happens after every search, on the main way of getting around.

The search findings themselves required the opposite (HC-1's fix: "a page change still clears it").

**Evidence.** `j-search2.mjs` (`out/j-search2.txt`), menu opened on Net worth two pages after the search:
- new: box `"social"`, first rows Social Security, Goal seek, Sensitivity, Life timeline (`shots/search2-new.png`);
- today (`w1off=all`): box `""`, first rows Recent, Dashboard, Net worth, Social Security (`shots/search2-today.png`).

**Cause.**
- On a phone, proto `core/app.js:438` now only marks the list stale. `openDrawer()` then calls `buildNav()` with no
  word, and `buildNav` uses `search.value`.
- On a wide screen, `show()`'s own `buildNav()` keeps the word the same way.

**Change.** A new address clears the box. For example, `show()` without `keepScroll` sets the search value to empty
and marks the list stale. Keep the word only while the menu stays open. Remembering a search across Back is the job of
All pages (B7).

### P3. A thumb that keeps tapping still ends on another page: the guard counts from the first tap

**Problem.** B1 promises the guard for "taps 0.1 to 0.7 s apart". But the 700 ms window runs from the first tap (or the
redraw), and a swallowed tap does not extend it. So in a burst of taps each 0.35 to 0.45 s apart:

- taps 2 and 3 are swallowed;
- tap 4 lands on whatever the redraw put there.

This is the original harm: another page, with the green line of the page the person left.

**Evidence.**
- `j-taps.mjs` (`out/j-taps.txt`), Retirement contributions, "Add contribution" at y 738, taps at 0/400/800/1200 ms:
  `swallowed ["changed","changed"]`, ending on `#/cashflow/expenses?guide=plan&step=month "Expenses"`. The picture
  `shots/taps-contrib-four.png` shows Expenses with "Contribution added." at the bottom.
- Income, taps at 0/350/700/1050 and at 0/450/900/1350: the empty "Add an income" form opens again (`open forms 1`).
- Three taps are fine (`j-taps3.mjs`: 6 of 6 stayed).

**Change.** In `core/taps.js`, a swallowed tap within `NEAR_PX` of the last one restarts the window, so a run of taps
on one spot counts as one gesture until the thumb rests for 700 ms. For example, keep `burstAt = tap.t` on a swallow
and use `max(changedAt, burstAt)`. Then:

- add a 4-tap case to `t1-dbl.mjs`;
- re-run `t2-allowed.mjs`. Its meant taps come after a pause, so they are unaffected.

## Should fix

- **S1. "Saved on your computer" takes three lines in the pill.** The owner's own wording reads "Saved on / your /
  computer" at 390 and at 320 px, filling the 44 px pill to its edges (`j-bar.mjs`; `shots/bar-390-0-0.png`,
  `shots/bar-320-0-0.png`).
  - B13 promises "two short lines", but `m5-bar.mjs` counts only cut titles.
  - Add a check that the pill uses at most 2 lines.
  - Size the pill so "your computer" fits on one line (about 118 px at 390), then re-check the 149 names.
- **S2. Go on "budget" opens Expenses.** `j-search.mjs`: "budget" lists Expenses, then Budget, then Budget
  (50/30/20).
  - With B5, the first row is what Go opens, so the ranking now decides the page. B6 promises that the page named
    for the word comes first.
  - Agree with the breaker's S5: an exact name must beat an exact alias phrase.
  - Separate, for the designer: two pages are both called "Emergency fund" (`balance/liquidity` and
    `goals/emergency-fund`), and T-HEAD forbids that.
- **S3. Going back lands at the top of the list.** "‹ Back to Needs attention" returns to scrollY 0, although the row
  was tapped at 539 (`out/j-ways2.txt`). Back to the Dashboard returns to 0, although the tile was tapped at 400
  (`out/j-menu.txt`).
  - M6 promises "same place on that page". That holds only once the place track restores the scroll.
  - Make step 4 depend on that, or drop the claim. Someone working down 8 rows otherwise scrolls back every time.
- **S4. Wording and confirmation on the switched-off card.**
  - `app.js:382` says "You switched this page off on this phone". That is wrong on a computer, and wrong when the PC
    turned the page off (`features.js`, precedence 2).
  - "Turn it back on" gives no green line, but AGENTS.md says: "Every save, add or remove confirms itself with
    `ui.notice("ok", ...)`".
  - Suggested words: "This page is switched off in Settings › Pages, so it is not in the menu." Then confirm with
    "Emergency fund is on again."
- **S5. One name for a missing page.**
  - The bar says "Page not found" while the card says "That page is not here". Use one phrase for both.
  - "The address may have a typing mistake" assumes an address bar, which a home-screen app does not have. Suggest:
    "This link leads to a page that is not in the app."
- **S6. The "‹" button's spoken name uses a page title the person may not know** (`out/j-setup.txt`,
  `out/j-checkin.txt`):
  - "Back to Set up my plan" while on Set up my plan;
  - "Back to Step by step" after a quick answer's guide;
  - "Back to Monthly review" while the row on the page says "‹ Back to the November 2026 check-in".

  Change: use the page row's words when there is one. When `from` is this same page, say plain "Back".
- **S7. The title jumps sideways each time the menu opens or closes.** It moves 52 px (114 to 62, `out/j-menu.txt`)
  because the "‹" is removed while the menu is open. Hide it with `visibility: hidden` instead, so the bar stays still.
- **S8. Owner checks to add.**
  - (a) On iPhone, Back usually sits in the top-left corner. Here "☰" holds the corner and "‹" is second, 8 px away
    (`j-menu`: menu 10 to 54, back 62 to 106). Does the owner reach for the corner and get the menu? Does a near-miss
    on "☰" go back? In a home-screen app there is no Forward to undo it.
  - (b) Check 4 again with "Saved on your computer" (S1).

## What I tried that held up

- **Double tap on Add (Income), 300 ms apart.**
  - "+ Add another income" was under the thumb and the tap was swallowed (`changed`).
  - One income was added, the form stayed closed, "Tips added." stayed in view and the page stayed put
    (`out/j-taps.txt`).
- **Contributions, two taps or three taps.** Two taps at 300 ms, and three taps at 350, 400 or 450 ms (6 runs), all
  stayed on the page (`out/j-taps3.txt`).
- **Get started, double tap on Continue (350 ms).** Question 2 opened with nothing ticked, the focus on its question
  heading, and the second tap swallowed as `new-page` (`out/j-setup.txt`).
- **Slow pages opened from the menu.** These are frame logs of what is on screen (`out/j-paint-1.txt`,
  `out/j-paint-4.txt`).
  - At 1x the name and "Working it out…" show 43 to 132 ms after the tap; at 4x, 53 to 137 ms. The page's own words
    come next ("Scoring your plan…", "Putting your plan summary together...").
  - The Dashboard's first visit at 4x (1.75 s of work): screencast frames show the drawer sliding away and "Working it
    out…" fading in at 426 ms (`shots/cast/f05_117.png`, `shots/cast/f22_426.png`). So in Chromium the first visit is
    not a blank screen. Safari stays the owner's check 5.
- **Find a page, typed key by key.**
  - 20 words, every one in order with the caret at the end ("who to call" gives Contacts, "car" gives Vehicles,
    "will" gives Estate documents, "card" gives Credit cards).
  - Go on "social" opens Social Security with the menu closed and the focus on the page.
  - Back returns to Income with the menu closed (`out/j-search.txt`).
- **All pages.**
  - Typed "retire" (33 matches), opened the 4th result, pressed Back: the box still says "retire", same order, same
    count.
  - The focus is on the page, so no keyboard pops up.
  - The typing made no extra history: the next Back goes to the Dashboard (`out/j-allpages.txt`).
- **The menu and Back.**
  - Back with the menu open stays on Net worth at 600 px. The next Back goes to the Dashboard.
  - A double tap on "‹" goes back one page.
  - Escape closes the menu and puts the focus on "Menu" (`out/j-menu.txt`).
- **Pages opened from a list carry the named row:**
  - Needs attention gives "‹ Back to Needs attention" (6 of 6);
  - Next best action gives "‹ Back to Next best action";
  - the check-in's Needs attention keeps "‹ Back to the November 2026 check-in" (`out/j-checkin.txt`).
- **Top bar names.** "Bills and regular payments", "Tax documents checklist", "Will the money last?" and "Chance the
  money lasts" are whole on two lines at 390 (17 px) and at 320 (13 px), with the "‹" showing
  (`out/j-bar.txt`, `shots/bar-*.png`).
- **Addresses.** A typo shows its topic's pages under one filled "Find a page" (`w1/taps/shots/addr-new3-typo.png`).
- **Keyboard.** After a page change, the next Tab is the page's first control (`out/j-menu.txt`).

## Touch rules (qa/touch-rules.json)

With P1 to P3 in:

- Green: D-TWICE, D-TIME (b), D-ANSWERS, D-TOP, T-HEAD, T-NAME, T-TARGET.
- D-BACK: green for the address. Its "scroll within 100 px" part waits for the place track (S3).
- T-ONE-WAY stays green with P1's bottom link, since it starts with ‹.
