# Step by step  (`overview/guide`)

**Status:** usable
**Purpose:** Short guides that take you through the pages for one goal, in order, and remember where you stopped.

The owner asked (2026-10-31): "Maybe have a way to start picking an option of what you want to do (calculator /
financial plan / etc...) then guide." Get started (`overview/start`) is the picking; this page and its frame are the
guiding. Guides run **on the real pages that already exist**: no form is rebuilt, so a guide can never drift from the
page it sends you to, and someone who learnt a page in a guide finds the same page from the menu later.

## Addresses
- `#/overview/guide`: the seven guides, with where each stands. `?more=1` (from Get started's "More guides") puts
  taxes and protecting your family first.
- `#/overview/guide/<id>`: one guide: what you get, how long, what to have ready, the steps, "Do step N", and once every
  numbered step is done a finish card.
- A step: `#/<page>?guide=<id>&step=<key>`, e.g. `#/balance/liabilities?guide=debt&step=rates`.

## The frame (shell hook)
`frame.js` is drawn by the shell around any page (docs/CONVENTIONS.md "Shell hook: frame"); the page renders into its
own `<div data-page>`, so pages that clear and redraw themselves keep it.
- **Guide mode** (the address names the guide being followed): a bar on top with the guide's name, "Step 2 of 3 · 1
  done", a thin progress line and "On this page: <what to do>", naming the page's own button. Once the step is done,
  the bar says so and holds a filled "Next: <step> ›", because every save scrolls the page to the top. At the bottom, a
  next-step card: the step's state ("Not done yet: it is done once ..."), one way forward ("Skip to: ..." while the step
  is open, "Next: ..." once done), another page that does the same step, a "does not apply" button where it makes
  sense (with Undo), "All steps ›" and help.
- **Compact mode** (the guide is followed but the page was reached from the menu or a page's own link): one line,
  "Following: Pay off what I owe · Step 2 of 3 ›", only while that step is still to do; nothing once the guide is done.
- **Quick mode** (`?from=quick`): "‹ Quick answers" and the question on top, "Another question?" at the bottom; on the next page in the same tab "‹ Back to: <the
  question>" (session storage, wrapped in try/catch).
- Typing that is not saved: tapping Next, Skip or All steps first warns ("tap its Save or Add button first, or tap
  again to leave without it"); a second tap goes. Only inputs inside a `<form>` count, so a page's filters do not.

## Where progress lives
In the plan (`plan.guide`, docs/DATA_MODEL.md), not in the browser, so a guide started on the PC shows on the phone,
it is in the backups, and the sandbox's pretend plan never touches the real one. Almost nothing is stored: whether a
step is done is **worked out from the plan's own data** every time (a debt guide's step 1 is done once a card or
loan is saved as an account), exactly as the dashboard's six setup steps are. Stored are only the facts the plan
cannot show: which guide is followed (`active`, `activeAt`), when it was started and finished, steps that only ask
you to look (ticked by Next), "does not apply" and "skipped for now". Writes happen only on a tap, never when a page
opens, and a tap that would change nothing does not save (`act.js` `change()`), because every save sends the whole
plan to the PC and leaves a backup copy there.

## The rules (the "formulas" of this page), tested
- **Done:** a step is done when its `check(plan)` is true; or it is a look-only step and was ticked; or the person said
  it does not apply (counts as done). "Skipped for now" is still to do. The plan's data always wins over a mark.
- **Numbered and extra steps:** numbered steps are the guide; they never hide, so "Step 2 of 3" never changes under
  the person as data arrives. Extra steps show only when they apply (a credit card, a student loan, a bank file...),
  are drawn after the numbered list under "Extra steps for you" with their reason, and are never needed to finish.
  Counts ("2 of 3 steps done") and "finished" are about numbered steps only.
- **Finished:** every numbered step done or not applying. Tapping the finish card's button stores `finishedAt` and
  stops following the guide (a guide is for the first time through; next time the person goes straight to the page),
  and the guide then stays "Done" if new data reopens a step.
- **Started:** the person started it or marked a step; data alone never makes a guide "in progress". A guide not
  started says "About N minutes. 2 of 5 steps are already in your plan." instead.
- **Next:** the first numbered step still to do, else the first skipped one. On a step page, Next goes to the first
  open step after this one (numbered, then extras), else wraps to an earlier one ("Back to step 2: ...").
- **Which step a page is:** the step named in the address; else the first open step on that page; else one reached by
  its alternative page; else the first step on that page (Buy a home uses Home affordability twice: "See what you
  can afford", then "Set down payment goal").
- **Guide mode only for the followed guide:** after "Stop following this guide", Back to an old step address shows
  nothing; every way into a step (the step rows, "Do step N", Get started) starts the guide first.
- **Goes quiet:** after 30 days with no tap in it, the followed guide's bar stops showing.
- **Needs:** a step whose page needs an earlier one (Social Security needs a person) says "This step needs step 1
  first" with a link, on the page and in the list.

Done checks in words (`journeys.js`):

| Guide | Steps (extras in brackets) | Done when |
|---|---|---|
| Build my whole plan | accounts, people, income, expenses, goals, assumptions | the dashboard's own six checks (`dashboard/compute.js`), so the count is always the dashboard's |
| Pay off what I owe | add, rates, order, [cards, student, one-loan] | a liability account; every loan and card with a balance has its details saved, a 0% one too (Liabilities' own `detail`); a payoff order saved; [looked / saved] |
| Spend less and save more | income, accounts, spending, budget, cushion, [sort] | an income; a checking, savings, cash or card account; an expense or a bank row; an envelope or a 50/30/20 split; a goal named emergency / rainy day / cushion or with the 🛟 icon (Emergency fund's own test); [90% of bank rows sorted, or looked] |
| Buy a home | afford, pay, lenders, goal, [rent-buy, fit] | Home affordability's inputs saved; an income; looked; a goal named "down payment" (what its "Make it a goal" saves) or a 🏠 goal named for the home, never "Home repairs"; [saved or looked; looked] |
| Plan my retirement | people, savings, spend, ss, saving, pension, chance | every adult has a birth date; a savings or retirement account (not a loan); retirement spending saved, or "use what I spend now"; a Social Security amount or record, or "won't get it"; a contribution, or "not saving now"; a pension, or "don't have one"; looked |
| Sort out my taxes | people, income, estimate, paychecks, state, [room] | a person; an income or typed wages; tax withheld typed, or looked; one paycheck's tax, or "none taken"; a state; [looked] |
| Protect my family | people, policies, life, papers, contacts, [who-gets] | a person; a policy, or "none"; looked; any paper noted (even "not made yet"), or "none of these yet"; a contact; [a beneficiary saved] |

The minutes are rough judgements of the time to fill each guide's pages, not measured.

## Choices made (no owner input; noted per the builder instructions)
The spec (2026-10-31) was checked by three critics before building (an engineer against the code, a first-time user of
60 on a phone, a UX reviewer). Their fixes are in; the main ones:
- Only `plan.guide.active` turns a guide on (the address alone brought the bar back after leaving).
- Numbered steps never hide; anything that can hide is an extra (step numbers no longer shift mid-guide).
- "On this page:" plus the page's own button name, in 15 px body text, instead of the step title repeated in small grey.
- One way forward in the card ("Skip to" / "Next"), no separate Back and Skip buttons; Undo for "does not apply".
- "Stop following this guide" and "Look over the steps again" instead of "Leave the guide" and "Go through it again",
  which sounded like losing work.
- Budget's emergency-fund step opens Goals (Emergency fund cannot create a goal), with Emergency fund as "See how big
  it should be"; Protect's papers step counts any paper noted, since someone with no will notes "none".
- Help: "Ask the app a question" only while the AI answers; otherwise "Questions? See the help".

## Sources
GOV.UK Design System: "Complete multiple tasks" (task list: statuses in words, not colour) and "Question pages" (one
thing per page, a way back); NN/g "Wizards: Definition and Design Recommendations" (verbs on buttons, "Next: what",
progress as a caption) and "Onboarding tutorials vs contextual help"; Boldin's retirement planner ("I don't have any"
counts as complete); WCAG 2.2 (2.4.11 nothing sticky over fields, 2.5.8 targets, 3.2.6 help in the same place). The
research notes are in the build session, not the repo.

## Tests
`module.test.mjs`: definitions (7 guides, 3 to 7 numbered steps, every door a usable page, shorts of 21 characters
starting with a verb, one-sentence asks, the button an ask names exists on that page); the whole plan equals the
dashboard; done checks (a 0% loan, "Home repairs", the emergency fund); visible steps; step states; statuses on an
empty plan and on the family fixture (worked by hand); finishing; which step a page is; neighbours; the bar's modes,
the 30-day quiet, after leaving; the summary and step addresses; every change reports whether it changed anything and
touches only `plan.guide`; compute returns plain data; the manifest's frame hook.

## Ideas / not yet
- Pages could read the step from the address and open their add form, or scroll to the field the step asks for.
- The dashboard's "Continue: <guide>" tile and "Start something new" link (designer's lane; asked on the WORKBOARD).
- The server could skip its backup copy when a save changes only `plan.guide`.
