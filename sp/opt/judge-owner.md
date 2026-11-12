# The owner's advocate: which design is the owner's sentence, and which adds to it

Judged 2026-11-12 on tip 737fb6a. I held each design against the owner's own words and against every binding decision
in `constraints.md`. I served my own copies of the three prototypes and of the tip (`$SP/opt/judge-owner-work/{inline,dial,stages,tip}`)
one at a time on ports 9881 to 9884; every server was stopped by the script that started it and nothing answers there
now. Sandbox only, real touch taps, 390 x 844. Nothing in `$REPO`, the read-only copy `opt/app`
or the three prototype worktrees was edited (their `git status` is as I found it).

`$J` = `$SP/opt/judge-owner`
(61 screenshots). Scripts and raw numbers: `$SP/opt/judge-owner-work/w1.mjs` to `w4.mjs`, `w1.json` to `w4.json`, `lib.mjs`.

The owner's words I judged by, and nothing else as the owner's:
- 2026-11-12: "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality of complexity. Default to
  less is more and allow more complexity or toggles. We want subtle optional complexity".
- 2026-11-11: "After we finish the initial setup of, okay, we're going to do a big picture. Once we're in the big
  picture, you can delve deeper and get better analytics and your results" and "user experience is key, and it should
  also provide valuable insights ... It's got to be valuable".
- 2026-11-11, same request: "here's the variables that can change ... can you check these numbers? ... let them change
  it and how things could change".

Everything after "Rule:" in the design log entry is the builder's reading; the workboard's "one device setting for
people who always want the detail" is the builder's announcement. Neither is the owner speaking (constraints 0.1, 4).

## 1. Verdict

| design | score | best thing, in the owner's terms | worst thing, in the owner's terms |
|---|---|---|---|
| **inline** (quiet rows, kept per part) | **8** | It is the sentence and little else: every piece of complexity is its own quiet toggle, in place, beside the answer, and a toggle stays where the person put it. No mode, no second screen, no control that asks a question. | It gives the owner's word "toggles" nothing a person would call a toggle (Settings has nothing; the one line is specified, not built), and it refuses the device-wide choice on its own authority. Its memory is invisible: typing one figure made the page open 2.8 screens long on the next visit. |
| **dial** (rows + "Show everything on this page" + a device setting) | **6** | The only one where the owner would find literal toggles and a choice a person makes once for themselves. Also the best eye for "valuable": the money hint stays on the first screen and the box the guide asks for comes first. | "Show everything" is the opposite of "subtle": one tap turns 1.25 screens into 6.34 with 19 boxes and four filled buttons, and the tick is then 5.8 screens down. It is the only thing the dial keeps, so the choice is short or everything, never "a little more". |
| **stages** (a short page and a page behind it; the offer follows the path) | **5** | The truest "less is more" screen: 1.0 screen, 64 words, and the way on is on the first screen of a path step. Its "Go deeper" rows are questions that already carry an answer ("Would itemizing save tax? the standard $32,200 is better"). | It reads the most into the owner's words: a gate at the end of the path (no invented household ever reaches it), a second screen in place of "more complexity or toggles", and "Keep this" housekeeping. Behind the door the old wall is back whole (5.63 screens), and a money hint left the answer page. |

**Winner: inline**, with the dial's device choice grafted on in a narrower form and three things from stages
(section 6). Four things have to be settled before its helper ships (section 7).

**Which reads something in that the owner did not say: stages**, by a distance (section 4). The dial reads in one
thing ("everything"); inline reads in one thing (ninety days of memory) and reads one thing out (a switch).

**Which would the owner notice on first open and like:** the new headline, in all three; it is the same rewrite and
it is the biggest gain in each. After that the stages screen is the one the eye notices and likes at once, because it
is nearly empty; the liking ends at the second tap. The dial's tick box is the thing the owner would *recognise* as
what was asked for. Inline is the one where the owner notices nothing new at all, which is what "subtle" asks for.
The grafts are there so the winner earns the first-open reaction too.

## 2. What I saw: Federal estimate, the family, 390 x 844

My own counter (`lib.mjs`: words, `$` and `%` figures and boxes outside shut folds; filled buttons by their look).

| | today | inline | dial | stages (plan not finished) | stages (plan finished) |
|---|---|---|---|---|---|
| headline | About $14,723 of federal tax for 2026 | You would owe about $5,253 in April | You'd owe about $5,253 in April | You would owe about $5,253 in April | the same |
| screens as it opens | 3.27 | 1.30 | 1.25 | 1.00 | 1.26 |
| words / figures as it opens | 485 / 45 | 128 / 3 | 104 / 3 | 64 / 3 | 97 / 5 |
| filled buttons on the first screen | 1 | 1 | 1 | 1 | 1 |
| rows that open, tick boxes, links under the answer | 3, 0, 1 | 5, 0, 6 | 6, 1, 1 (and 4 link buttons) | 1, 0, 2 | 1, 0, 6 |
| anything pinned to the screen | no | no | no | no | no |
| the plan's bytes after every open, shut, tick and keep | - | identical | identical | identical | identical |

Pictures: `$J/tip-family-federal-first.png`, `$J/inline-family-federal-full.png`, `$J/dial-family-federal-full.png`,
`$J/stages-family-federal-full.png`, `$J/stages-familyDone-federal-full.png`.

**The first tap toward more, and the next day**

| | inline | dial | stages |
|---|---|---|---|
| the first tap | "4 more numbers": opens in place, 1.76 screens, 12 figures, the answer still on screen (`inline-tap1-numbers-full.png`) | "3 more numbers": the same, 1.58 screens | "More about this year's tax": a new screen, "Federal estimate: the detail", 5.63 screens, 696 words, 50 figures, 10 boxes, five "Keep this" tick boxes (`stages-deeper-page-first.png`, `-full.png`) |
| after a reload | still open; `planner.opened.sandbox` holds that one part | shut again: a single part is not kept | the short page again |
| the "everything" tap | none; five taps give 6.41 screens, 846 words, 19 boxes, 4 filled buttons (`inline-all-open-full.png`) | the tick: 6.34 screens, 814 words, 19 boxes, 4 filled buttons, the tick itself at y=4,888; still so after a reload (`dial-ticked-first.png`, `-full.png`) | none; the second screen is everything |
| in Settings | nothing (`inline-settings-first.png`) | "How much detail", the second card, two radio rows; choosing "Everything open" confirms in green and opens Federal at 6.29 screens; a page not yet adopted (Net worth) does not change (`dial-settings-first.png`) | "Going deeper", after "Pages": one tick, the list of kept parts, "Put them all back" (`stages-settings-ticked-first.png`) |

**The owner's "check these numbers ... let them change it and how things could change"**: the family types $12,000
into "Federal tax withheld so far" and saves.

| | today | inline | dial | stages |
|---|---|---|---|---|
| the box is this far down once its part is open | 3,245 px | 1,384 px | 597 px (first in its part) | 1,350 px |
| the headline after Save | unchanged words | "You would owe about $1,730 in April" | "You'd owe about $1,730 in April" | "You would owe about $1,730 in April" |
| is that headline on screen after Save | no | no | no | no |
| what the green line says | "Federal tax for 2026 is now about $14,723" | the same sentence | the same sentence | the same sentence |
| the page on the next visit | 3.35 screens | **2.80 screens**: the part I typed in is open again, "1 set by you" | 1.28 screens, the part shut, "1 set by you" | 1.00 screen, the fold shut, "1 typed" |

In all three the person changed the answer from $5,253 to $1,730 and was told about a figure that did not change.
That is today's sentence under a new headline; it is a defect of the page, not of a design, and it stands between
every one of them and "how things could change" (`inline-withheld-after-save.png`).

**"It's got to be valuable": what left the first view**

| | today | inline | dial | stages |
|---|---|---|---|---|
| the single parent's "Paying for child care so you can work? Add it on Expenses and the child care credit comes off your tax." | shown, 1.69 screens down | **inside a shut part** | **shown on the first screen**, y=412 (`dial-jordan-federal-first.png`) | **not on the page**; it is on the second screen (`stages-jordan-federal-first.png`) |
| her headline | No federal tax for 2026: about $692 of credits come back | **About $4,400 would come back in April** (`inline-jordan-federal-first.png`) | as today | as today |
| the retired couple's overdue tax | on the first screen | the headline: "$1,241 of tax is overdue now" | on the first screen | on the first screen |

**As step 8 of the path** (`?guide=plan`; `$J/*-as-step-full.png`)

| | today | inline | dial | stages |
|---|---|---|---|---|
| screens | 3.73 | 1.76 | 1.71 | 1.15 |
| the way on ("Still to do: Your debts ›") at | y=2,961 | y=1,300 | y=1,259 | **y=784, the first screen** |
| things to open or follow between the answer and the way on | 5 | 12 | 9 | 4 |
| filled buttons on the first screen | 1 | 1 | 1 | 2 (the page's and the shell's, now on one screen) |

## 3. Each of the owner's words, against each design

**"be aggressive with OPTIONALITY"** asks for a lot of things made optional, everywhere, soon. Inline and the dial
turn the page's own pieces into parts with one helper and a count that may only go down (100 of 151 pages over
budget by inline's count, 83 of 141 by the dial's). Stages cuts deepest on screen but is the least aggressive about
*optionality*: before the path is finished a page offers exactly one option, "More about this year's tax", and its
own plan says a page a commit, "weeks, not days".

**"Allow a user to have optionality of complexity"** asks that a person can choose how much. Inline: part by part,
and it stays. Dial: part by part for the visit, then all of a page, then all of the phone. Stages: two amounts per
topic (64 words or 696), plus moving sections between the two screens by tick. On range, inline is the finest and
stages the coarsest; the dial has the most places to choose but only two amounts that last.

**"Default to less is more"**: all three pass on arrival, stages by the most. Two erode it. Inline's default wears
away without the person deciding: opening a form to type one number is kept like a wish to see that form for good
(2.80 screens on the next visit, measured). The dial's tick is one slip from 6.34 screens and stays so on the next
visit, with the way back 5.8 screens down.

**"or toggles"**: the owner's own noun. The dial has two a layperson would call toggles. Stages has ticks, but they
mean "move this section to the other screen", which is housekeeping, not complexity on or off. Inline has rows that
behave as toggles and nothing that looks like one; its designer names this as a decision that is "not mine"
(its section 8) and then takes it.

**"subtle optional complexity"**: subtle is about the control and about what the control does. Inline is subtle on
both. Stages has the quietest control (one row) and the least subtle effect (the answer is replaced by another
screen). The dial has a square tick box under every answer with two or more parts, and its effect is the least
subtle thing in any of the three. The rule the builder recorded ends "never a second filled button and never a wall
of boxes"; the dial draws exactly that state on purpose, one tap away, and keeps it.

**"big picture ... delve deeper"**: section 4.

**"valuable"**: the dial's prototype made the best calls on what may not leave the first screen; inline wrote the
best headlines; stages wrote the best rows. None of the three shows the changed answer after a save.

## 4. What each design reads in

**Stages reads in four things.**
1. *A gate.* The owner said "Once we're in the big picture, you can delve deeper". That is permission, in an order.
   Stages turns it into a state of the app: until the path's last Next was tapped, the offer is one row; after, a
   card of questions. The owner did not ask for anything to be held back, and "in the big picture" is where a person
   is once setup is done, not after the last step of the path. The design's own finding: none of the eight invented
   households has a finished path, and "a real household that skips the path stays in the first stage for good"
   (its 5.10 item 4, risk 1). Its designer ranks dropping the stage as "the likely change".
2. *A second screen in place of a fold or toggle.* "Folds are no longer the tool for depth" sets aside the rule as
   it stands in the log and in `AGENTS.md` ("behind a quiet fold or toggle") and the workboard's "use plain
   `<details class="fold">`". The owner's 2026-11-11 request wants the figures an answer rests on next to the answer
   with the effect shown (constraints section 3, "deeper", item 4); here the itemized boxes are 2.9 screens down a
   second screen.
3. *Curation.* "Keep this on the Federal estimate page", five times on one screen, is a job the owner never asked
   anyone to do.
4. *A new name by default.* It heads the merged card "Go deeper" on adopted pages while 37 others say "More on
   this", and does not wait for the owner (its O1 default). One name for one thing (P7) is broken for weeks.

**The dial reads in one thing: "everything".** The owner said "more complexity", not all of it, and asked for it to
be subtle. "For people who always want the detail" is the builder's sentence on the workboard. The dial is honest
about this (it would drop the row, then the setting, on the owner's word) and it stays inside the letter of every
constraint I checked. It is the per-page row I would not ship unasked: the research looked at a per-page control
and did not recommend it, and the layperson judge measured the slip.

**Inline reads in one thing and reads one out.** In: that an opened part should stay open across days (ninety of
them). A toggle does hold its state, so this is the mildest reading-in of the three, but it has to be visible and
it must not apply to a form someone opened once to type. Out: the device-wide choice. Its argument is good on
grain and on honesty (a switch cannot open what it promises), but "allow ... toggles" and "a user ... optionality
of complexity" are the owner's words, and a design that answers them with "every row is one" has decided for the
owner.

## 5. The binding decisions

Checked on the prototypes where a check is possible; otherwise against the design files.

| decision | inline | dial | stages |
|---|---|---|---|
| N1 one filled button per view | 1 on arrival; 4 on the page only after five taps of the person's own | 1 on arrival; **4 after one tap, kept** | 1 on the short page; **2 on the first screen of a path step**; 2 on the second screen |
| N3 nothing new pinned | pass | pass | pass |
| N4 no second menu, no level that travels across pages | pass | pass by the letter (a row inside a card, not a bar or tabs); it is a two-state choice on every adopted page | pass |
| N5 / O1 the links card's name | keeps "More on this", asks | keeps "More on this", asks | renames to "Go deeper" before asking |
| R2 one tap away, behind a fold or toggle | pass | pass | one tap and up to five screens of scrolling before the plan is finished |
| R3 the way to more is quiet | pass | the tick box is the loudest of the three | pass |
| R5 a shut part says what of the person's it holds | "1 set by you" | "1 set by you" | "1 typed" (pinned words), pill on the door |
| R6 opening or closing never changes the plan | pass, measured | pass, measured | pass, measured |
| R7 deeper pages not on the main path | five links stand before the way on of a step | four | none before the plan is finished |
| V1, V6 the answer first, every confirmation | pass | pass | pass |
| "less is not empty" (constraints section 3): a hint worth money stays in sight | the hint is folded | pass | the hint is on another screen |
| V9 the action a link promised | `?open=` and the step's `opens:` | `?show=`; the box is first | the fold stays on the short page |
| T2 everyday Settings stays short | unchanged (2.28 screens) | 2.53 screens, a card in second place | 2.52 screens |
| H1, H3, H6 the household's view, the build switch, no builder details | pass | pass; "How much detail" and "Show what is still being built" stay apart | pass |
| F7 / O2 what Save writes does not depend on what is open | boxes with a grey guess stay outside the part | a box in a part never writes a guess | no folded box has a guess |
| 4.3 item 10 never asked, never on by default | pass | pass | pass |
| claude-a's 13 pages, claude-f's 11, the 11 in flight | not touched; hand-overs written into the plan | the same | the same |

No design undoes a logged choice. All three keep Edit and Delete on Net worth rows, Plan basics first in Settings and
the Assumptions review notice (the skeptic's W13).

## 6. Worth grafting onto inline

**From the dial**
1. **One device choice in Settings, default off, narrowed.** The owner said "toggles"; give one that is plainly a
   toggle and is still subtle. It opens the reading parts only ("N more numbers", "How this is worked out", the rest
   of a list) on every page of this phone, never a form, so it can never draw a wall of boxes or a second filled
   button. One row, the dial's plain words ("On this phone only. Your plan and your numbers stay the same."), not a
   mode with two names. It is one line where `part()` decides open or shut, as inline's own 2.12 says.
2. **Not the per-page tick box**, unless the owner asks for it on seeing `$J/dial-family-federal-full.png`.
3. **A form part shuts again on the next visit and says "1 set by you"** (measured: 1.28 screens against inline's
   2.80).
4. **The dial's page calls**: the money hint stays on the first screen; the box a guide step asks for is first in
   its part (597 px against 1,384); "Optional details" with its contents named, since the label "More options" is
   ruled out by its own source (verify-web 1.2).
5. **The same-markup test**: draw a page with every `open` removed and compare. It is what keeps any state from
   holding words or figures the other lacks.

**From stages**
6. **Rows worded as the question they answer, with the answer as the status**: "Would itemizing save tax?" and "the
   standard $32,200 is better". This is "valuable insights" in the row itself, for parts and for the links card.
7. **One written sentence per case, with a test per case** (its S3). Its spliced sentence told a household with no
   tax it was "within a few hundred dollars of the $0"; the layperson judge found the same fault in the dial's
   prototype. Inline's headlines are the best of the three and should be held there by a test.
8. **Big picture first on a path step, by the address and not by a gate.** While the step bar is on the page, the
   links card waits below the way on (or is one row), so Next is near the first screen (784 against 1,300). That is
   the owner's order, and the rule's "Deeper pages ... not placed on the main path", with nothing held back from
   anyone and no state that changes the app.
9. **Landing on one part from a link** with the focus on it; inline's `?open=<id>` should behave as stages'
   `?deeper=<part>` does.

## 7. Blocking in the winner

1. **The owner's word "toggles" has no answer on screen, and the choice is the owner's.** Inline replaces the
   announced device setting with per-part memory and says itself that this is not its decision. Ship graft 1 with
   the helper, or put the one question to the owner first with the three pictures. Shipping the helper with nothing
   in Settings is the one way to fail the sentence as written.
2. **The memory erodes the default without saying so.** Measured: one tap to type one figure, and the page opens
   2.80 screens long on later visits; nothing on the page or in Settings says why, and the "Shut them all" line is
   not built. Before any page ships: forms (`figures`, `own`, `options`) are kept for the visit only; reading parts
   may be kept; the Settings line exists; the ninety days are a number the owner can see and change.
3. **A hint that is worth money may not be folded.** The single parent's child care credit line is inside a shut
   part. Add "an action that would change the answer" to the never-folded list (inline's R7) and to the node test.
4. **After a save the person must see how the answer moved.** The headline is off screen and the green line quotes
   the year's tax, which did not change ($5,253 became $1,730 unseen). The confirmation has to carry the new
   headline, for example "Saved. You would now owe about $1,730 in April." This holds for whichever design is built,
   and Federal estimate should not ship without it.

Not blocking, to settle on the way: "More on this" or "Go deeper" is the owner's to pick (inline keeps the settled
words meanwhile, which is right); five rows and five links are ten doors under one answer, so the cap of five parts
should be a cap on parts and links together on a path step; the meeting of per-part memory with wave 1's place
memory is argued from code and not yet run; nothing here was tried on a real iPhone, with VoiceOver, or by a person.

## 8. What I did not verify

Only Federal estimate exists in all three prototypes, so every comparison is on one page; the other seven "worked
examples" in each design are drawings. I did not rerun the designs' node tests. I did not check any tax figure: the
headline for the single parent differs between inline ("About $4,400 would come back in April") and the other two
("about $692 of credits come back", with $4,400 in the sentence under it), and I took both as the same sum said two
ways. The two other judges' reports (`judge-less.md`, `judge-more.md`) were read after my own walks; where I quote
them it is named.
