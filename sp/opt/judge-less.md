# Layperson judge: which design lets people finish without thinking about settings, modes or folds

Judged 2026-11-12 on the three prototype worktrees (all at tip 737fb6a plus their own uncommitted changes), served one
at a time on ports 9861 (inline), 9862 (dial), 9863 (stages) and 9864 (the tip, as the "today" baseline). Every server
was stopped by the script that started it; nothing answers on 9861 to 9864 now. Sandbox only, real touch taps,
390 x 844 and 320 x 568. Nothing in the repository, the read-only copy or the prototypes was edited (their
`git status` is as I found it).

`$J` = `$SP/opt/judge-less`
(180 screenshots, eight scripts `w1.mjs` to `w8.mjs`, their logs and JSON).

I was three people, one after the other: **Sam**, 24, rents (the kit's `sam`); **Dana**, a busy parent (the
`family` household); **Ruth**, 70, retired (`ruth`, also at 320 px). Two more for the edges: **Jordan**, one parent of
two (`jordan`), and the **retired couple** who owe tax now (`retiredCouple`). No real person was asked: "would stop" and
"would get lost" are my judgment of a screen, backed by a count each time.

## 1. The verdict

| design | score | best thing | worst thing |
|---|---|---|---|
| **stages** (short page, a page behind it) | **8** | The page a person lands on is the answer and nothing else: one screen, 56 to 65 words, 4 things to press, and the way on is on the first screen of a path step (y=784). No tick box, no setting, nothing that changes by itself. | Whatever is not chosen for the short page is a screen change away, and one thing a person needed went with it unnoticed: Jordan's "Paying for child care so you can work? ..." is gone from her page (it sits 1.7 screens into the second page). The second page is 5.6 screens (8.5 at 320) with its only way back at the very top. |
| **inline** (quiet rows, remembered per part) | **7** | Nothing ever leaves the page and nothing navigates: a row opens where it is with a 0 px jump and shuts the same way. The best headlines of the three ("$1,241 of tax is overdue now", "No federal tax to pay for 2026"). | Ten quiet doors under every answer (5 rows and 5 links; 12 things to press, the way on at y=1,300 on a step), and every curious tap is kept for 90 days with nothing on screen saying so: after two taps Ruth's page opens 5.1 screens long on every later visit. |
| **dial** (rows plus "Show everything") | **5** | The best small decisions for a layperson: the box the guide asks for is first in its part (y=622 against about 1,400), the child care hint stays on the first screen (y=412), and a real form was cut from 8 boxes to 4 with Save in sight. | The tick box "Show everything on this page" under every answer. One tap turns Dana's page into 6.3 screens with 19 boxes and four filled buttons, and the box she ticked is then 5.8 screens down (8.9 for Ruth at 320); it is still so the next day. Ruth is also told "looks about right ... within a few hundred dollars of it" about a tax of $0. |

**Winner: stages.** It is the only one where all three people read the answer, see the one action and the way on, and
are finished, with nothing on the screen that asks them what they would like to see. The price is real and it is on
the second page, where laypeople rarely go. It needs five things fixed before a page ships (section 6).

## 2. What I measured: the first view of Federal estimate

Counted by my own in-page counter (`$J/lib.mjs`: visible words, `$` and `%` figures, everything a thumb can press in
the page area; a shut fold counts as its row only). "Way on" is the y of the shell's row or button that continues the
plan. Rows are from `$J/w1-<proto>.json`.

| | screens | words, figures on the first screen | things to press: first screen / page | rows that open | way on at y |
|---|---|---|---|---|---|
| **Sam, 390** today | 2.43 | 147, 13 | 1 / 5 | 3 | 1,941 |
| inline | 1.33 | 102, 2 | 9 / 12 | 5 | 1,019 |
| dial | 1.28 | 90, 2 | 10 / 14 | 6 and a tick box | 978 |
| stages | **1.00** | **63, 2** | **4 / 4** | 1 | **522** |
| **Dana, 390** today | 3.27 | 146, 12 | 1 / 5 | 3 | 2,655 |
| inline | 1.30 | 102, 3 | 9 / 12 | 5 | 993 |
| dial | 1.25 | 91, 3 | 12 / 14 | 6 and a tick box | 952 |
| stages | **1.00** | **64, 3** | **4 / 4** | 1 | **522** |
| **Dana, as step 8 of the path** today | 3.73 | 149, 7 | 2 / 8 | 3 | 2,961 |
| inline | 1.76 | 93, 3 | 7 / 15 | 5 | 1,300 |
| dial | 1.71 | 99, 3 | 8 / 17 | 6 and a tick box | 1,259 |
| stages | **1.15** | 108, 3 | **4 / 6** | 1 | **784 (first screen)** |
| **Ruth, 320** today | 4.85 | 116, 5 | 1 / 5 | 3 | 2,647 |
| inline | 1.97 | 52, 1 | 6 / 12 | 5 | 1,012 |
| dial | 2.06 | 62, 1 | 4 / 14 | 6 and a tick box | 1,062 |
| stages | **1.08** | 56, 0 | **4 / 4** | 1 | **509** |

All three turn the headline into what happens to the person. That rewrite, not any fold, is the biggest gain in each,
and the three designers say so themselves. The difference between them is what stands under the headline.

Pictures: `$J/inline-dana-390-page-full.png`, `$J/dial-dana-390-page-full.png`, `$J/stages-dana-390-page-full.png`;
`$J/inline-ruth-390-page-first.png`, `$J/dial-ruth-390-page-first.png`, `$J/stages-ruth-390-page-first.png`;
`$J/inline-dana-390-step-first.png`, `$J/stages-dana-390-step-full.png`.

## 3. The three people

### Sam, 24: "is my tax all right?"
- **stages**: "About right: nothing to fix for April", one sentence, an outlined "Check your paychecks", one shut row,
  one link, the way on. He is done on one screen. Nothing on it is a word he does not know except the row "Figures the
  plan cannot see", which he can leave.
- **inline**: the same answer, then five rows: "3 more numbers", "Figures the plan cannot see · none typed", "Itemized
  deductions · standard is better", "Year and people · 2026", "How this is worked out · 6 steps", then five links
  ("Your tax rates, band by band" ...). He does not have to tap any of them, and he will not. But he has to read past
  ten of them to find the way on, and two are tax words.
- **dial**: the same plus a sixth row and a tick box. A tick box is a question. It is the only thing on any of the
  three first screens that asks him to decide how the app should look.

### Dana: "do I owe in April, and where do I type what my pay stub says?"
All three say "You would owe about $5,253 in April" with the filled "Fix it in your paychecks". All three keep
"Figures the plan cannot see" one tap away on the page she is on, and after "Save figures" the headline becomes "about
$4,730" (`$J/w2-*.log`).
- The box she needs, "Federal tax withheld so far": **dial** put it first in the part (y=622). In **inline** and
  **stages** it is still the 8th of 9 boxes, under "Qualified dividends" and "Tax-exempt interest" (y=1,408 and 1,374).
  From the tax guide's own step, which opens the part for her: box at y=982 (dial), 1,735 (stages), 1,769 (inline),
  3,631 (today). In none of them is it on the first screen, and in dial Save is then 1,100 px under the box
  (`$J/w5.log`).
- When she comes back the same evening: **stages** and **dial** open short again, the row saying "1 typed" / "1 set
  by you". **inline** opens with the 9-box part still open: 2.8 screens, because her tap to do one job was taken as
  "keep this open".
- Changing the Groceries amount on Expenses (the one real form any prototype cut, `$J/w6.log`): today 8 boxes, Save at
  y=859, under the screen; **dial** 4 boxes and "Optional details · must-pay, prices, dates", Save at y=655
  (`$J/dial-D1-expenses-edit-groceries.png`). Inline and stages describe the same cut and did not build it; both would
  move Category out of sight, and dial's reason for keeping it is right (a hidden default files every bill under one
  heading).
- A curious tap, and the way back (`$J/w3-*.log`):
  - **inline**, "4 more numbers": opens in place, 0 px jump; the first screen is back to 12 figures. With "How this is
    worked out" as well the page is 3.56 screens, and it opens like that after a reload. Each row shuts by tapping it
    again; nothing says the app will remember.
  - **dial**, the tick box (y=641, on her first screen): 6.34 screens, 810 words, 46 figures, 19 boxes, four filled
    buttons. The box she ticked moves from y=641 to y=4,888. It is still ticked after a reload.
    `$J/dial-B1-dana-390-everything-here.png`, `$J/dial-B1-dana-390-everything-bottom.png`.
  - **stages**, "More about this year's tax": a second page, "Federal estimate: the detail", 5.63 screens, the whole
    old page. "‹ Federal estimate" is at y=64 and nowhere else; two screens down the only things to press on screen are
    the menu button and the status pill (`$J/stages-B2-dana-390-deeper-two-screens-down.png`). The phone's Back returns
    her to the short page, unchanged. At the foot there is "Continue your plan", so she is never stuck.
    Ticking "Keep this on the Federal estimate page" by accident is answered in green where her thumb is, the part then
    shows on the short page with the same tick under it, and one tap there puts it back.

### Ruth, 70, at 320 px: "do I owe anything?"
- **stages**: "No federal tax for 2026. Your income is under what gets taxed this year, so there is nothing to pay in
  April." 1.08 screens, four things to press. The best sentence of the three for her.
- **inline**: "No federal tax to pay for 2026. Single, $37,200 of income: the deductions and credits cover it." Then
  the five rows and five links: 1.97 screens. After two curious taps the page is 5.14 screens and opens that way from
  then on (`$J/inline-C1-ruth-320-another-day-first.png`).
- **dial**: "Your 2026 federal tax looks about right. The tax for the year is about $0. You have not entered any tax
  withheld or any estimated payments yet: within a few hundred dollars of it." (`$J/dial-ruth-390-page-first.png`).
  That is a spliced sentence, and it is the same mistake the stages designer caught and wrote a rule against. Her tick
  box is below the first screen (y=751). Ticked: 9.76 screens, and the screen she is left looking at reads "Social
  Security that is taxed · Adjusted gross income · Standard deduction · Senior deduction", with the box that would undo
  it 8.9 screens down (`$J/dial-B1-ruth-320-everything-here.png`).
- In all three she is offered "See the estimated payments" although she owes nothing. Not a difference between them.

### Two edges
- **Jordan, one parent of two, no child care entered.** Today the page says "Paying for child care so you can work? Add
  it on Expenses and the child care credit comes off your tax." at y=1,424. **dial**: on the first screen, y=412, with a
  link (`$J/dial-C2-jordan-first.png`). **inline**: inside the shut "How this is worked out" (the designer names this
  and plans the fix). **stages**: not on her page at all; it is on the second page at y=1,414 under "From income to
  tax", and the design text never mentions it (`$J/stages-C2-jordan-first.png`, `$J/w7.log`). This is the one case I
  found of a layperson missing something worth money.
- **The retired couple who owe now.** inline's headline is the alarm, "$1,241 of tax is overdue now". stages says
  "About $1,839 of this year's tax is still to pay" and puts the overdue amount in the sentence
  (`$J/stages-C5-couple-first.png`). dial does the same as stages with a longer sentence. All three keep the filled
  "Plan the estimated payments". inline's is the one a person cannot misread.

## 4. Each design, as a layperson

### stages: 8
- **Why it wins.** "Less is more" is literally true on the screen: there is one row to more, not a list of doors. The
  way to more is the oldest habit a phone has (tap a row, get a page, go back). Nothing is remembered unless the person
  ticks "Keep this", and that tick is undone exactly where its effect shows. On a path step the page plus the step bar
  is 970 px, so the first evening (20.6 screens for Dana in the walks) gets short where it counts.
- **Where a person gets lost.** On the second page: 5.6 to 8.5 screens, no list of what is on it, one way back at the
  top. If the app is opened from the Home Screen there is no Back button on screen at all, only the edge swipe.
- **What a person misses.** Anything the builder did not lift onto the short page. The rules list alarms, guess marks
  and promised actions (S9 to S11); they do not list "money you could claim", and that is what slipped.
- **What makes a person think about the mechanism.** Three small things, all removable: the line at the foot of the
  second page ("Once your plan is finished, the Federal estimate page lists these one by one under "Go deeper""), the
  Settings tick "List the deeper pages now, before my plan is finished" (`$J/stages-B5-dana-390-settings-card.png`),
  and five "Keep this on the Federal estimate page" ticks down the second page. The grey line under the door, "The
  four numbers and 10 more", says nothing to someone who has not seen four numbers.
- **Found in the prototype.** The word "null" is printed at the foot of "What this estimate leaves out" on the second
  page for every household (`$J/w8.log`, `$J/stages-B1-dana-390-deeper-bottom.png`). On a path step the page is now
  short enough that two filled buttons share one screen ("Fix it in your paychecks" at y=427 and "Still to do: Your
  debts" at y=784); today they are 2,300 px apart.
- **The stage itself.** After the plan is finished the row becomes a card of four questions ("How is this worked
  out?", "Would itemizing save tax?"), which read well and add about a tenth of a screen in my run (1.10 screens; the designer measured 220 px)
  (`$J/stages-C6-dana-390-finished-full.png`).
  But none of the eight invented households ever reaches it, the designer rates that risk "High", and for these three
  people it changes nothing they need.

### inline: 7
- **Why it is second.** No modes and no settings, as promised, and it is the safest of the three: nothing can be lost
  to another screen, a stray tap moves the page by 0 px and is undone by the same tap. Its never-folded list (R7) is
  the most complete and its statuses are the shortest and clearest ("2 set by you", at most 20 characters).
- **Where it is not "less".** The first view is the answer plus up to five rows plus up to five links, on every page.
  For Ruth that is "Itemized deductions · standard is better" and "Your tax rates, band by band" under an answer of
  "nothing to pay". Counted: 12 things to press against 4.
- **What a person would not expect.** Memory across days of every tap. A layperson opens a part to do one thing or to
  look once; the app reads that as a standing wish. Their pages grow back, one curious tap at a time, and the only place
  that says so is a line in Settings that appears afterwards (not built in the prototype). The designer lists this as
  the honest argument against the stance; from a layperson's side I agree with it.
- **Also.** The child care hint is folded in the prototype (named, to be fixed). "More options" is kept as the form
  label although the research's own source rules it out. The bill form would hide Category.

### dial: 5
- **What is good is not the dial.** The short view has the best eye for what a layperson needs in three places (box
  order, the hint, the form), "Optional details" is the right label, and by default it remembers nothing past the
  visit, which is the least surprising behaviour of the three.
- **The dial is the problem.** "Show everything on this page" sits in the same card as the rows, on every page with two
  or more parts, on the first screen for Dana. It is the only control in the three designs whose whole subject is how
  the app should look, which is exactly what the question asks people not to have to think about. Its failure is
  severe and it persists: 6.3 to 9.8 screens, the undo out of sight, the same the next day. The designer already says
  the row goes "if the tester sees it ticked by accident more than once in a pass"; walking it as Ruth, once
  was enough.
- **The Settings card** ("How much detail": "The short view" / "Everything open") is second on Settings, on its first
  screen, and acts at once with no Save. Its words are plain and a person can leave it alone
  (`$J/dial-B4-dana-390-settings-first.png`). It is a mode all the same, placed above "Pages" and "Your data".

## 5. Worth grafting onto stages

From **dial**:
1. The form cut as built: `optional()` on the bill form, 8 boxes to 4, "Optional details" with a status that names
   what is inside, Save in sight; and its rule that a box whose hidden default would mislead (Category) stays out.
2. "Federal tax withheld so far" first in "Figures the plan cannot see". Go one step further than any of the three:
   that one box and Save, then the other eight behind "8 more figures", so the box and its button share a screen.
3. The child care hint on the first view when a credit is there to be had, as its prototype has it.

From **inline**:
4. The alarm as the headline when there is one ("$1,241 of tax is overdue now").
5. The never-folded list R7 with its node test, widened as in 6.1 below, in place of stages' shorter S9 to S11.
6. The status rule for the folds that stay on a short page: title fixed, at most 20 characters, the person's own state
   first ("2 set by you", "1 to fix"), and R14: the part just saved stays open and no save opens another.
7. A long list opens in place ("3 more accounts" under the six shown), not on the second page. On Net worth stages
   sends Dana to another screen to reach her checking account ("All 10 accounts ›"); a list is the page's own job.

From **stages** itself, to keep whatever else changes: rule S3, one written sentence per verdict with a test per
case. Dial's prototype shows what happens without it.

Not worth taking: inline's memory across days, dial's page row, dial's device setting. For the detail lover stages
already has "Keep this", by the person's own tick.

## 6. Blocking in stages (fix before the first page ships)

1. **Money a person could claim, and any hint they can act on, stays on the short page.** Add it to S9 to S11 and test
   it: for every page, each `notice` and each hint with a link that the tip shows outside a fold is either on the short
   page or named in the test with a reason. Evidence: Jordan's child care line, gone from her page.
2. **The second page needs a way back at its foot and a list of what is on it at its top**, and should say which page
   it is (the top bar reads "Federal estimate" on both). Evidence: 5.6 and 8.5 screens, one link at y=64, nothing to
   press two screens down but the menu.
3. **Do not ship the stage as built.** No invented household reaches it, and it brings a Settings tick and a foot line
   that explain the mechanism to people who should not need to know it has one. Either always draw the single row while
   a page is shown as a step of the path and the question card otherwise (no stored stage, no setting, no foot line),
   or drop the stage, which the designer already calls "the likely change".
4. **The prototype's two defects**: "null" printed on the second page for every household; the "no tax" case offering
   "See the estimated payments". Add a check that no page prints "null" or "undefined".
5. **Order of landing.** Back returns to the top of the short page (measured, scrollY 0). That is fine while the short
   page is one screen and wrong on a list page; so list pages wait for wave 1's place memory, as the designer says. And
   decide the two filled buttons that now share a screen on a path step (the page's own action and Next).

## 7. Limits

- One reviewer playing three people; no real person, no real iPhone, no VoiceOver, Chromium only.
- One page was built in each prototype (Federal estimate), plus one form and one Settings card in dial and one Settings
  card in stages. Everything said about Net worth, Expenses, Will the money last?, Assumptions, Contributions and the
  long forms is from the wireframes, read as these people, not walked.
- inline's Settings line ("Parts you opened stay open ...") is not in its prototype; I judged it from the text.
- The dial prototype has no wave 1 place memory, so "short again on return" for a single opened part is the
  prototype's behaviour; with wave 1 it would be kept for the visit.
- My counter is not the census's (words within a unit or two of the designers' own figures; figures and controls
  exact on the screenshots I read: 27 of the 180).

## 8. Files

- This report: `$SP/opt/judge-less.md`
- Evidence folder: `$SP/opt/judge-less`
  - `lib.mjs` the counter; `w1.mjs` first views (`w1-tip.json`, `w1-inline.json`, `w1-dial.json`, `w1-stages.json`);
    `w2.mjs` Dana types her tax held back (`w2-*.log`); `w3.mjs` a curious tap and the way back (`w3-*.log`);
    `w4.mjs` another day, Jordan, first open, the couple, the finished stage (`w4-*.log`); `w5.mjs` the tax guide's
    step (`w5.log`); `w6.mjs` the bill form (`w6.log`); `w7.mjs` and `w8.mjs` the hint and the stray "null".
  - Screenshots are named `<prototype>-<who>-<width>-<page|step>-<first|full>.png` for first views and
    `<prototype>-<A..E><n>-...png` for the walks.
