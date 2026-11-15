# Glide path  (`investments/glide-path`)

**Status:** usable (phase 7)
**Purpose:** How much of your money should be in stocks at each age: the plan's path, the rules of thumb, and where you stand today.

## Inputs
The People page (ages, retirement age, plan end), `retirement.stocksNow` / `stocksRetired` (the plan's path), holdings (the stock share held), `investments.glide` (which path to measure against: plan, age, target-date), `whatIfs.riskCheck` (the five answers, only once saved; read by `risk.js` only, never by `compute()`).

## Outputs
`rows[]` by age (`plan`, `age110`, `targetDate` stock shares), `actual`, `suggested`, `gap`, `verdict`, `milestones[]` (every five years plus retirement), `ruleLabel`, `notes`. `compute()` is unchanged by the five questions (its output over every fixture, the empty plan and the 1,400 households is the same as at 461df76).

## Formulas
The plan's path: stocksNow gliding linearly to stocksRetired by the retirement year, flat after (the same path the retirement engine uses). 110 minus age. The target-date shape from `targetDateMix` (90% to 50% at retirement to 30% seven years after, stocks about 60% U.S. and 40% international): Vanguard Target Retirement's path (summary prospectuses, allocations as of 2025-09-30: the 2050 fund about 91% stocks, the Income fund about 30%; read 2026-10-31), applied to every target-date name; other families differ by a few points.

## The first view and the parts (simple first, opt spec 6.1 C17, done in this page's gap commit)
The first view: the headline and one sentence for its case (`heroWords` in `risk.js`, six cases, each tested), the People
note when there is no birth date (a reason to doubt the ages: never folded), the one filled button "Add your holdings ›"
while none are on file, and the chart with a one-line legend. Then one card of quiet rows (`core/ui/more.js`):

| row | kind | holds |
|---|---|---|
| "N more ages" | more | the milestones (records on a phone, the table on a wide screen) |
| "Five questions about how much ups and downs suit you" | own (pinned title) | the five questions, the range, the comparison, Save / Forget |
| "Which path to measure against" | own (pinned title) | three chips (the plan's path, 110 minus age, target-date fund), saved on the tap |
| "How this is worked out" | how | what counts as stocks, the three paths, where the path ends, the five questions' rule |

The headline, per case: no holdings and the path glides: "70% in stocks now; about 50% when you retire, on your plan's
path"; the same share now and later: "70% in stocks now and when you retire, on your plan's path"; already retired: "50%
in stocks, your plan's share in retirement"; each with "Add your holdings to see where you stand against this path.".
With holdings: "You hold 90% in stocks; your plan's path says 70%" (or "110 minus your age says 52%", "a target-date fund
holds 66%") and one of "That is within five points: you are on the path.", "That is 20 points more than the path: a bad
year would hit harder than the plan assumes.", "That is 15 points less than the path: growth would lag what the plan
assumes.". First view at 461df76: 303 words and 50 figures with a plan, 273 and 35 on the empty plan; now 83 and 2, 103
and 2 (the counts file was lowered in the same commit).

Builder's choices: the `<select>` for the path became three chips (a pick from a list, R23; and no box in the parts card,
S15); its green line names the new headline ("Saved. You hold 90% in stocks; 110 minus your age says 52%."), or, with no
holdings, what the choice will do. The legend of the chart lost "Percent of the portfolio in stocks, by age" (the chart's
label says it) and the hero's line on what counts as stocks moved into "How this is worked out".

## The five questions (gap list, next 60, item 14; map G4)
Five questions, each a row of chips; a tap redraws only the part's body (the tapped chip keeps the focus, the page does
not move) and saves nothing. Once all five are answered the part shows its rows side by side: "From your answers" 40%
to 60%, "What you hold now" 90% (only with holdings on file: the hero's figure), "By your age: 110 minus 58" 52% (only
with a birth date) and "Your plan's share" 70% now (`retirement.stocksNow`, the plan's share now; it was "Your plan, on
Will the money last?", review o3 P5: the link under the sentence says where it is set); then one sentence (inside, above
or below the range) and "Not advice: the app's own rule of thumb." (shortened from "Information, not advice: ..., not a
test from a bank or an adviser." to keep the answered part under R15's 1,300 px once the held row was added). With holdings on file the sentence measures what is held, the money's real share
("The 90% you hold in stocks is above the range your answers give: ..."), then names the plan's own share beside it
("Your plan's 70% is above it too." / "Your plan's 50% is inside it."); without holdings it measures the plan's share
("Your plan's 70% in stocks is above the range ..."). Review o3 (P2): measured against the plan's 70% alone, a person
holding 90% saw a gap that looked smaller than it is. "Save my answers" (outlined) keeps them
in `whatIfs.riskCheck`; the green line names the range ("Saved. Your answers give 40% to 60% in stocks."), the part stays
open, and the row's status says "set by you · 40–60%". Saved answers open on their answer, with the answers in one line
("Your answers: Over 20 years · Fairly steady · Wait it out · Worried, but hold on · Some.") and two outlined buttons:
"Change my answers" (the questions again) and "Forget my answers" (removes them, with the kit's one-tap Undo). Open with
all five answered (with holdings: four rows), the part is 1,283 px tall at 390 px (under R15's 1,300) and 1,436 px at
320; the body's gap is 12 px.

**The rule: the app's own rule of thumb.** No published questionnaire was copied or read for it, and none is cited. It is
written here in full, so anyone can check it by hand:

| question | answers (points) |
|---|---|
| 1. When will you need most of this money? ("Taking it out over years? Pick the middle year.") | Within 3 years (at most 0% to 20%) · 3 to 10 years (at most 40% to 60%) · 10 to 20 years (at most 60% to 80%) · Over 20 years (no limit) |
| 2. How steady is your income? ("A pension or Social Security counts as very steady.") | Uncertain 0 · Fairly steady 1 · Very steady 2 |
| 3. If your investments fell 20% in a few months, what would you do? | Sell 0 · Wait it out 1 · Buy more 2 |
| 4. How would you feel about a year when your investments lose a third (about $33,000 of every $100,000)? | Could not stand it 0 · Worried, but hold on 1 · Part of investing 2 |
| 5. How much do you know about investing? | Very little 0 · Some 1 · A lot 2 |

1. Add the points of questions 2 to 5 (0 to 8). 0 to 2 points: 20% to 40% in stocks; 3 to 4: 40% to 60%; 5 to 6: 60% to
   80%; 7 to 8: 80% to 100% (`pointsBand`).
2. Question 1 sets the most (the cap above).
3. The range is the lower of the two (`riskRange`: `band = min(fromPoints, cap)`). When the date lowers it, the part says
   so: "Money you need in 3 to 10 years has little time to wait out a fall, so how soon you need the money counts most:
   40% to 60%. Your other answers alone give 60% to 80%."

Why this shape (the builder's reasoning, no outside figure): money needed soon has no time to wait out a fall, so the
date limits the share whatever else is answered; inside that limit, the share is how much of a fall a person can live
through without selling, which is when a fall becomes a loss (questions 3 and 4), with steady income (2) and knowing what
a fall looks like (5) making it easier. The four bands are 20 points wide, so the answer reads as a range, not a figure.
No points alone give 0% to 20%: only money needed within 3 years does. "A third" is $33,333 of $100,000, said as "about
$33,000". The 20% fall and the year that loses a third are questions, not forecasts: no figure from outside is used.

Where a share sits (`compareShare`): inside when low ≤ share ≤ high (the ends inside), else above or below; only a number
is a share (an empty box or a word is never read as 0%). When the plan's own share is above or below, the part adds one
link, "Change it on Will the money last? ›" (`#/retirement/projection?show=stocksNow`, which opens that
page's settings part at the box).

Builder's choices: **no "Use N% on Will the money last?" button**. The brief asked for one only through a save path this
page already has for the stock share; it has none (it saves only which path to measure against), so the way to act is
the link to the box itself, and nothing on this page writes the stock share. Save appears only when all five are answered
and differ from the saved ones; answers not saved are kept for the visit only (a module variable tied to the address
drawn and the plan's `meta.createdAt`): the redraw after a save elsewhere on the page keeps them; leaving and coming back
(a link, the menu, Back), a reload, or another plan loaded in the same tab starts from the saved answers (review o3, M1:
they used to outlive the visit, "Save my answers" still offered after a trip to Allocation). The part opens itself while
answers differ from the saved ones (a reason now, never remembered).

## Edge cases
Without a birth date the path starts 20 years before the plan's retirement age, and the five questions' result shows no
"By your age" row. "On path" is within five points. A saved answer this page does not know (an older or edited file) is
read as not answered.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`: the points, every band edge, every cap and the lower of the two; partial
and unknown answers; where a share sits at the edges (and that "" or a word is no share); every written sentence
(progress one to four, the date's cap three ways, inside, above, below for the plan's share and for what is held, the
plan's share beside the held one with and without "too", the six headlines and the three paths named in the headline);
the rows with and without holdings; answers not saved kept by a redraw and dropped by a new visit or another plan; the page: the parts in order,
no box in either named part, no "Use N%" button; S11 for the questions (picking saves nothing; Save keeps the answers,
names the range in green, keeps its part open, moves no other part; a reload) and for the path chips; Forget with Undo;
opening every part and picking answers without Save changes nothing; invariance (with `whatIfs.riskCheck` saved, every
non-heavy page's compute is byte-identical over the fixtures and the 14 households, and no other file reads the field).

## Ideas / not yet
- A bond-tent path (lower stocks around the retirement date, rising after); TPAW's utility-based path.
- A fourth path to measure against, "Your answers" (the middle of the range), if the owner wants the questions to steer
  the page's verdict too.
