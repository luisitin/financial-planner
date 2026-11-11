# Get started  (`overview/start`)

**Status:** usable
**Purpose:** Pick what you came to do: a quick answer, one goal or the whole plan, then follow it step by step.

**2026-11-01, redesigned.** The owner: "It does not look INSANELY user friendly and experience focused." The page is now
one big card, **Set up my plan** (`overview/setup`: seven questions, one per screen, then your money on one page), and
"Or jump straight to" as a grid of eight tiles. The card has three states (`setupCard`): new ("Let's go", three ticks:
rough numbers are fine, stop any time, no bank logins); started ("Question 4 of 7", the bar, "Next: what you owe", "Pick
up where you left off"); done (what you own minus what you owe, what's left each month, "Your next move: ..." from the
setup's own where-you-stand, and "See everything on one page"). A plan built on its own pages first (the Dashboard's first five
steps all done) counts as done. The heading greets the person by the name the plan has ("Hi Ana. What would you
like to do?"; no "Hi there"). The tiles: Quick answer, Pay off debt, Spend less save more, Buy a home, Plan retirement,
Sort out taxes, Protect my family, Big life change (Life events); a started guide's tile shows "2 of 3" and a finished
one "✓ Done". Footer: "Just exploring? Go to the dashboard ›" and the privacy line. The old whole-plan guide is gone (the path replaced it);
the sections below keep the earlier rules that still hold.

The owner asked (2026-10-31): "Focus on making it user friendly and easy to use. Maybe have a way to start picking an
option of what you want to do (calculator / financial plan / etc...) then guide." This page is that start: "What would
you like to do?", with the whole plan featured, a quick answer (`overview/quick`) and four goals as a quiet list, and a
link to the other guides (`overview/guide`).

## When it opens
| Situation | What opens |
|---|---|
| The app is opened with no page in the address (`#`, `#/` or nothing), and either the plan is empty and "look around" was never chosen, or Set up my plan is started and not finished (and "look around" was not chosen), or a guide is still being followed and no account exists yet (`opensHere`) | **Get started**: `core/app.js` swaps the address with `history.replaceState` before the router starts, so Back does not loop and `?sandbox=1` is kept |
| No page in the address, any other case | the Dashboard, as before |
| Any address that names a page (deep links, `tools/drive.mjs`, `qa/smoke-all.mjs`, the menu) | that page, always |
| Menu: Overview > Get started, or searching "get started", "where do I start", "what can I do" | Get started |

"Empty" = no accounts, people, income, expenses, goals or transactions (`isEmptyPlan`). Only "Skip this, I will look
around" stops the first-visit opening: a quick answer or a guide chosen on an empty plan leaves it empty, and the
person should land back here (with "Pick up where you left off") rather than on a dashboard that does not mention
their choice. The page never hides topics and never stores a "type of person".

## Inputs
`needs`: accounts, household, income, expenses, goals, transactions, assumptions (through the dashboard's six steps),
guide. `compute(plan, { today, off })`.

## Outputs
`{ empty, firstRun, opensHere, setup: { state: new|started|done, href, q?, total?, share?, next?, netWorth?, spare?, move? },
tiles: [{ id, icon, title, line, href, page, status: null | "2 of 3" | "Done" }], featured: { state: new|started|done,
label, line, href, doneCount, total } (the path, "Build my plan", built on `pathSummary`), rows (the earlier list, kept for
compatibility), more: { label, href }, resume: activeSummary | null, hasAccounts }`.

## Rules (tested)
- **Featured panel** = the path (the `plan` journey: questions, then a look at each step, ending on Your plan), so the count is
  the path's: none done and the path never started "Start my plan" (it goes straight to the next step, not to another list; the
  "Not sure? Start here." line shows only then), some done or some skipped
  "Continue my plan" ("5 of 6 steps are done. Next: check the assumptions."), all done "Look over my plan" (the guide
  page). The number of steps comes from the data, never typed as "six".
- **Rows**: a quick answer, then Pay off what I owe, Spend less and save more, Buy a home, Plan my retirement. A row's
  line never changes; a guide the person started adds "In progress: 2 of 3 steps done" or "Done" under it.
- **Resume card**: while a guide other than the whole plan is followed and not finished, "Pick up where you left off"
  with "Do step N: ..." (then the page's only filled button; the featured button turns outlined).
- **Choosing** writes `plan.guide.chosen = { id, at }` (DATA_MODEL `guide`), at most once a day per choice (every save
  sends the whole plan to the PC and leaves a backup copy there). The featured button also starts the path.
- **Not connected**: when the plan is kept on this device only (not the PC, not the sandbox), a notice says so before
  anyone types for half an hour, with a link to Settings.

## Choices made (no owner input; noted per the builder instructions)
From the spec's three critics (an engineer, a first-time user of 60 on a phone, a UX reviewer):
- Five rows plus "More guides: taxes, protecting your family, a baby or a move ›" instead of six rows and a "Something
  else" row that repeated the guides list; no "Just ask a question" button (it led to "The AI is unreachable" whenever
  the PC's AI was off; the dashboard keeps its own).
- "Skip this, I will look around" (it is not a tour), reading "Go to my dashboard" once the plan has data.
- The lede tells where to find this page again (the menu, under Overview) and no longer promises "nothing you type is
  lost", which was untrue for typing not yet saved.
- The quick row's examples are questions Quick answers really has (paying cash for a car or borrowing, which health plan
  costs least), not "what home you can afford", which "Buy a home" two rows down promises.
- "Everything stays on your own computer and phone. Nothing goes to the cloud." (one wording everywhere).
- Order 3 in Overview: Get started, Quick answers and Step by step sort before Alerts in the menu, so before anything
  has been opened the drawer's "Ready now" list shows them instead of Health score, Timeline and Monthly review.
  Findability is the point; the designer may revisit it.

## Sources
GOV.UK "Start using a service" pages and Material's self-select pattern (let people say what they came for); NN/g on
onboarding (skippable, never a tour, easy to find again), list over grid for comparing choices; Apple's onboarding
guidance (a skipped onboarding is not shown again but stays easy to find). Research notes are in the build session.

## Tests
`module.test.mjs`: the empty-plan test; first visit and what stops it; opening while a guide is followed; `setChosen`
writes only `guide.chosen` and not twice a day; the featured panel's three states against the dashboard's count; the
rows and their targets; the resume card; the Set up my plan card's three states; opening while the setup is unfinished
(not after "look around", not once finished); the eight tiles, each a real page, short enough for a phone tile, with a
started guide's progress.

## Review fixes 2026-11-02
`setupCard` keeps the stored question's number when that screen is now hidden (a goal added on the Goals page hides "how much, and by when"): "question 7 of 7", not "question 1".

## Ideas / not yet
- The dashboard's "Choose what to do first" tile on an empty plan, "Continue: <guide>" and "Start something new"
  (designer's lane; asked on the WORKBOARD).
- "Look around with a pretend family" (a demo household), if the owner wants to show the app to others.


## 2026-11-06, the path
The big card is now **Build my plan** and follows the path (`overview/guide`'s `plan` journey, `compute().path` = `pathSummary`):
new ("Let's go", one button; the eight tiles are folded behind "Just want one answer?"), the questions started ("Question 3 of
7", the bar), the path under way ("Step 4 of 7", "Your plan", "Continue: <step> ›", "See your plan so far ›"), complete
("Here's where you stand", "See your plan ›"). `featured()` keeps its old shape, built on `pathSummary`. `CHOICE_IDS` keeps
`whole-plan` (a stored choice) and adds `plan`. `setupCard` counts a plan built page by page as done when the Dashboard's first five
steps are done.

## Tiles say how long (stress test 2026-11-11, A2)
Each guide tile carries `steps` ("3 steps, about 10 minutes"), drawn as a second line; the eight tiles and their fold stay.
