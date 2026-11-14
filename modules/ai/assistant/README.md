# Ask the plan  (`ai/assistant`)

**Status:** usable
**Purpose:** a chat window over a compact summary of the plan, routed through the configured model (Ollama on the PC by default).
Offered only while the AI helper answers (`requires: "ai"`).

## Inputs
`household`, `accounts`, `goals`, `assumptions` are summarised by `compute()` into `summary`. A change card (below) reads the
plan through Scenario compare's and the projection's own functions; it adds no field to the plan.

## Outputs
`summary` (string sent as context), `chars`. The change card's functions are separate exports (`readReply`, `propose`,
`applyProposal`, `changesContext`), not part of `compute()`'s output, so the page's derived data is what it was.

## Formulas
None of its own. The system prompt (`SYSTEM_PROMPT` in compute.js) forbids the model from inventing numbers
and from doing arithmetic; it is told to point at the page that computes things.

## A change you can apply (gap design #39, 2026-11-14)
**What the person sees.** By default nothing new: the page, the chat and every reply look as before. When a reply names one
change ("What if we spend $6,000 a month?"), one card follows it:

> **Change: spend $6,000 a month in retirement instead of $7,000, in today's dollars.**
> With this change, the money still lasts to the end, with about $585,000 more left at 95, in today's dollars.
> Worked out by the app from your plan, assuming markets do about average. The helper only suggested the change.
> [Apply] [No thanks]

(The family fixture, `qa/fixtures/family-plan.mjs`, on 2026-11-14.) Both buttons are outlined: the page's one filled button
stays Send. Apply makes the change in one `store.update` (`ui.undoable`), and the card becomes the change line and a green line
naming the new answer, "Done. If markets do about average, the money now lasts to the end (age 95), with about $1,456,000
left in today's dollars.", with Undo, and under it "Undo stays here until you leave this page. After that, change it here:
Will the money last? ›" (the page that keeps that figure, `WHERE`). Undo puts back exactly what Apply wrote ("Undone. Your plan
is as it was before this change."). No thanks closes the card and writes nothing. A change the app will not try says why in one
quiet line with the next step and no buttons ("That number is outside what the plan can test ($1 to $100,000 a month). Ask
again with another number."), with a link when the step is on another page; a lever it does not know, or a CHANGE line it
cannot read, says "The app could not turn this into one change it can test, so nothing was tried." On a plan that cannot be
run yet the card names the change, says "What it does cannot be worked out yet. Fill in the basics on Will the money last?
first, then ask again." with a link there, and has no Apply: nothing could be checked.

**How the model names a change (AGENTS.md rule 5).** The system message gains a CHANGES part (`changesContext`): the list of
levers, the adults' first names (already in the summary) and the one line to write, `CHANGE: {"lever": ..., "value": ...}`,
with `who`, `year` and `until` where a lever needs them. It carries no figure of the plan. The model is told not to work out
what the change does. `readReply` takes every CHANGE line out of the reply before it is shown (a reply with none is shown
byte for byte as it came) and reads the object of the one line; two or more lines, or one that is not a JSON object, come back
as `{}`, which names no lever, so the card says in one line that nothing was tried. The model's own figures are never read: only `lever`, `value`, `who`, `year`, `until`.

**The levers (`ASK`), and the range the app tries.** Only these; any other name is refused in one quiet line.

| lever | value | range | from |
|---|---|---|---|
| `spendingMonthly` | dollars a month | more than $0, up to $100,000 | the box on Will the money last? (`SPEND_MONTHLY_CEILING`) |
| `retireAge` (who) | whole age | 40 to 85 | Scenario compare `LEVERS`; refused for someone already older than the age the plan stops their work (the plan counts them as retired; `ageOn` of their birth date on `today`) |
| `claimAge` (who) | whole age | 62 to 70 | Scenario compare `LEVERS` (the Social Security claiming ages); refused for someone already paid it |
| `stocksNow`, `stocksRetired` | share | 0% to 100% | a share |
| `returnStocks` / `returnBonds` / `inflation` | a year | -10% to 30% / -10% to 20% / 0% to 20% | Assumptions' own boxes (`ASSUMPTIONS` min, max) |
| `spendingEase` | a year | 0% to 5% | `EASE_MAX` (core/math/retirement.js) |
| `strategy` | a word | one of the ways of taking money out | `STRATEGIES` and `DESCRIPTIONS` |
| `in`, `out` (year) | dollars | more than $0, up to $100,000,000 | happenings.js `AMOUNT_CEILING`; no year: this year |
| `spend` (year, until) | dollars a month, + or - | not 0, up to $1,000,000 either way | happenings.js `MONTHLY_CEILING`; no until: for good |
| `after` (who, year, until) | pay a month | more than $0, up to $1,000,000 | happenings.js `MONTHLY_CEILING`; no until: one year |
| `less` (who, year, until) | share of the usual pay kept | 0% to 100% | happenings.js `check`; no until: one year |
| `home` (year) | price of the next home | more than $0, up to $100,000,000 | happenings.js `AMOUNT_CEILING`; $0 (to rent) is refused: the rent is needed |

The first ten are Scenario compare's `LEVERS` that its "Make this my plan" writes into the plan (its extra saving and fees are
what-ifs only there, so they are not here); the last six are the kinds of "Things that will happen" (gap design #1).
`valueOf` reads the value: money to whole dollars; a share or a rate written with "%", or above 1 and at most 100 in size, is
a percentage (5 and "5%" both read 0.05; 0.05 stays 0.05); an age must be whole. `who` is an adult's id or first name; "me",
"I", "you" or nothing is the first adult. A year must be from this year to the plan's end, and the rest of a "Things that
will happen" line is checked by happenings.js `check` with that page's own words.

**What it does (the effect).** Worked out by the app, never taken from the model:
- `before = answerOf(plan)` (levers.js: `buildInputs`, then one `project()` at average markets).
- A plan lever, and money in or out once, selling the home and working less: Scenario compare's `changes` (`{ key or
  key:personId: value }`; `lumpSum` ± and `lumpYear`; `homeYear`, `homeBuyFor`; `lessWho`, `lessFrom`, `lessUntil`,
  `lessShare`), then `with = outcomeOf(applyChanges(plan, changes).inputs)`: exactly the figures that version shows on Compare
  what-ifs (test 3).
- Work after retiring and spending that changes for some years have no Compare key: the line is put into a copy of the plan
  (`saveHappening`) and `with = answerOf(copy)`.
- Apply writes the same thing: Scenario compare's `carry(...).write(draft)` (the writing of "Make this my plan"), or one line
  of `retirement.happenings`. So the plan then gives the card's answer (tested for every lever).
- The words compare `with` against `before`: the age the money runs out, or with both lasting, the money left at the end in
  today's dollars rounded as levers.js rounds an effect ($100s under $10,000, else $1,000s; under $100 is "about the same").
- With no `before` or no `with` (a plan that cannot be run yet), there is no effect and no Apply (`basics`).
- "Now", for the "instead of" and for "the plan has it already": the plan's own value through Compare's `LEVERS[].get`, except
  retirement spending (the figure the box on Will the money last? shows, `figureMonthly`) and Social Security's start age, which
  is the age social-security compute's `people[].claimAge` counts (the projection's own): with no age saved, the full retirement
  age for the birth year (66 and 8 months for someone born in 1958, said "66 and 8 months" through that page's `ageWords`), not
  Compare's 67. Someone already paid it (`claimed`) has no start age left to choose: refused with words.
The card is worked out again at every drawing, against the plan as it is then, so a card left open after another change
says what it does now.

**Written sentences (R5, one per case; each read by a test).**
- The change: one per lever (and per case of the plan's own value: a typed spending figure or today's expenses; "you" or a
  name; easing on or off; a home sale already in the plan, which the new one replaces; money in or out once on top of a line
  of the same kind already in the plan that year: "Change: $50,000 more comes into savings in 2030, in today's dollars, on top
  of the $50,000 already in your plan that year.", since such a line adds and never replaces).
- What it does ("With this change, ..."): no answer yet; you would run out of money later or sooner ("you would run out of
  money at 62 instead of 65", about the money, never read as the age work stops); still runs out at the same age; now lasts;
  now runs out; still lasts with more, less or about the same left.
- A change of spending under a way of taking money out that sets its own spending: "Your way of taking money out sets
  spending from what is saved, so a change of spending does little here (How much to take out)."
- A change of spending while the figure is Get started's own (`guide.setup.retireAuto`), where Apply writes three fields:
  "Today this figure follows your bills (Get started set it). With this change it stays where you put it, and the plan still
  adds health insurance on top." (or "..., health insurance included, as you said." with `healthIncluded`).
- Not tried, each with its next step: the range, one per lever ("Ask again with another number."); no one on People (link to
  People); someone not in the plan (link to People); someone already paid Social Security (link to Social Security); someone who already stopped work (link to People); no year;
  a year outside the plan (and the rest of `check`'s words); a plan that cannot be run yet (link to Will the money last?);
  selling to rent (link); a lever the app does not know or a line it cannot read.
- The plan has it already: "Your plan already has this, so there is nothing to change." (no buttons).
- After Apply: four cases (lasts with money left, lasts with about nothing left, runs out, no answer yet), then
  `LATER_WORDS` with the link to the lever's page. After Undo: `UNDONE_WORDS`, through `ui.undoneWords`.
- The line "Worked out by the app from your plan, assuming markets do about average. The helper only suggested the change."
  under every card that has an Apply ("assuming markets do about average" is Will the money last?'s own phrase for one run at
  average returns; "typical ups and downs" would describe the pretend futures, which this is not).

**Builder's choices (the spec was silent).**
- One change per reply: a reply with two CHANGE lines shows no card (half of a question is not what was asked).
- "from X to Y" is said "Y instead of X" in plain words; the spec's arrow is not used.
- Retirement spending's "now" is the figure the box on Will the money last? shows (`figureMonthly`); with no figure typed the
  card says "instead of what you spend today".
- With Get started's own spending figure (`guide.setup.retireAuto`), Apply also marks the figure as typed, exactly as Compare's
  lever does (`retireAuto` off, `retireHeld` on): the one case where Apply writes more than one field, so the card says so
  first (`AUTO_WORDS`), and Undo takes all three back. Asking for exactly the figure the box shows is "already": the box on Will
  the money last? keeps that figure Get started's when it is saved again (`saveSpendingFigure`), so nothing changes there either.
- Undo is the app's usual one (`ui.undoable`): it lives while the page is open. The chat is not stored, so after a reload or a
  visit elsewhere the card and its Undo are gone; the line under the green one says so, and links to the page that keeps the
  figure (`WHERE`: Will the money last?, People, Social Security, Assumptions or How much to take out), where it can be changed
  back by hand. Keeping the chat or the Undo on the phone would add a stored thing the design does not have.
- A plan that cannot be run yet gets no Apply (a change nobody could check), only the next step.
- A share or a rate the model wrote loosely is read as `valueOf` says (50 is 50%, 1 is 100%, 1.5 is 1.5%); the card prints the
  value as read, so a wrong reading is seen before any tap, and inflation of 1 (100%) is refused by its range.
- The chat itself is kept in memory for the visit, not just for one drawing: Apply and Undo change the plan, and the shell
  draws the page again after every change, which used to wipe the conversation (a save from another device did too). It
  starts afresh on a new arrival at the page, as before, and is never stored.
- Sources: no current figure (tax limit, price, rule) is introduced here; every range is read from the page that owns it,
  with that page's own sources.

## Simple first (opt spec C19 for this page)
The first view is unchanged: the hero, four suggestions, the question box and the one filled Send. One tap away, drawn by
`core/ui/more.js` (no hand-written `<details>`): after the first question the suggestions fold behind "Suggestions" (kind
`item`; the owner's choice, design log 2026-09-15 round 7, though it holds fewer than R14's forty words: the check's one
finding on this page, pinned in the S7 line of the card test), and, when the helper is down, "Show details" (kind `tech`):
what it said, which helper, which model and where it is set, four rows.

## Edge cases
A plan whose stored data the card cannot read (a malformed list of things that will happen) draws the chat without the card, never a broken page.
When the AI helper is off, has no model, lacks the model it is set to use, or does not answer (`aiHealth()` in `modules/ai/health.js` on opening, the same check as Settings and the Dashboard tile), the page says so in one plain line worded for the service in use ("The AI helper on your PC is not answering right now. On the PC, open Ollama and leave it running, then try again."; "The AI service at ... is not answering" for another service; "turned off on the PC that runs the app" when only the PC's settings file can switch it on, with no "AI settings" button then), hides the suggestions and the question box, and offers a filled "See your plan's own answers" (overview/quick) and an outlined "Try again" (or "AI settings" when Settings can switch it on). When the helper is up and only one answer fails, the question goes back into the box with a plain error instead. The technical reason is only under "Show details"; before (2026-11-01), every suggestion tapped answered "The assistant did not answer: Failed to fetch". Long chats are not trimmed yet. With the helper off no question is sent, so no change card can appear.

## Our guesses (C5 hand-off H4, 2026-11-13)
A balance or a goal's amount the plan filled in where a box was left empty (`isGuess` on `accounts[<id>].balance` and
`goals[<id>].target`, core/estimate) is followed by " (our guess)" in the summary, and the system prompt says what the mark
means and to say so when the figure is used. The summary sends no pay, so a pay guess has nothing to mark here.

## Tests
`module.test.mjs`: the summary mentions accounts and goals; a guessed balance and goal amount carry "(our guess)", typed ones
do not, and the system prompt explains the mark. Gap #39, all with a pretend model reply (never a network call): reading the
CHANGE line (a reply without one comes back byte for byte); test 1, an unknown lever is refused with no card; test 2, an
out-of-range value is refused, with every sentence and its next step; test 3, the effect equals Scenario compare's for every lever it knows,
and the answer after Apply equals the card's for all sixteen; test 4, Apply writes one field (or one line) and Undo puts the
plan back byte for byte; test 5, with the helper off there is no card and nothing is sent; the page (card words, outlined
buttons, one store.update, the green line with Undo and where to change it later, the chat kept across the redraw, No thanks, a
refusal's one line and its link, no Apply on a plan that cannot be run, an unknown lever's one line); Social Security's "now"
is the plan's own claim age and someone already paid is refused; Get started's own spending figure (three fields, said first,
undone); unreadable stored data draws no card; money in on top of a line already there; the page each lever's figure is kept
on exists with that title; S11
(after Apply only that card changes); every sentence case; invariance over every fixture plan, the 14 households, the
phone-built plans and the empty plan (trying every change never touches the plan; the summary and the answer are the same).

## Ideas / not yet
- Tool calling: let the model call a module's compute() and quote the result (structured output).
- Explain-this-page button on every page (sends that page's derived numbers as context).
- Transaction categorisation and statement extraction live in transactions/*, not here.
- Trim history to the model's context window; streaming replies.
- Two changes in one card ("retire at 60 and spend $5,000"): Compare what-ifs already holds versions with several changes.
