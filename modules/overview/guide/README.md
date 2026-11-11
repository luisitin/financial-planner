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
- A step of the Monthly review: `#/<page>?from=review&review=YYYY-MM`: the frame draws one line, "‹ Back to the
  October 2026 check-in" (mode "review", 2026-11-02), when no guide applies.

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
- **Review mode** (opened from a Monthly review step, `?from=review&review=YYYY-MM`): one line, "‹ Back to the October
  2026 check-in". It wins over compact mode (the way back to the check-in matters more than the guide reminder there), not
  over guide mode (2026-11-02).
- **Quick mode** (`?from=quick`): "‹ Quick answers" and the question on top, "Another question?" at the bottom; on the next page in the same tab "‹ Back to: <the
  question>" (session storage, wrapped in try/catch).
- Typing that is not saved: tapping Next, Skip or All steps first warns ("Tap the page's own button (Save, Add,
  Compare...) first, or tap again to leave without it"); a second tap goes. A box counts when it is typed into, still on
  the page, and its value differs from the one it had when first focused (`act.js` `isDirty`), inside a `<form>` or
  not (Payoff, Social Security and Beneficiaries build theirs without one). A box that saves on change makes the shell
  redraw the page, which replaces it; a cancelled form is gone too. Choice lists and tick boxes never count (pages use
  them as filters, like Import's account picker, and one changed by mistake costs nothing to redo), nor do search
  boxes, file pickers or anything marked `data-nodirty`. The compact line's link is guarded the same way.
- **A fold the ask names:** a step (or its other page) may give `opens`, the title of a fold on that page ("What a
  paycheck withholds", "Figures the plan cannot see", "The split to aim for"). While the step is to do or skipped, the
  frame opens that fold each time the page draws it (`openFold`, a MutationObserver on the page's own div, so pages
  that redraw themselves are covered); one the person shuts stays shut until the next draw. Pages fold these once data
  exists, so an ask naming a field inside could not be followed (the guide sweep below).
- When a step page's own link or button moves on to a page that is not a step (Import goes to Categorize after a bank
  file), that next page shows "‹ Back to the guide: <name>" for one page, back to the step, which then says it is done.

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
- **Next:** the first numbered step still to do that can be done now, else the first skipped one that can, else
  the first to do or skipped at all ("Do step N" never points at a step waiting on a skipped one while another is
  free). On a step page, Next goes to the first open step that can be done now, after this one, else before it ("Back
  to step 3: ..."); a step that needs an earlier one only when nothing else is left.
- **Which step a page is:** the step named in the address; else the first open step on that page; else one reached by
  its alternative page; else the first step on that page (Buy a home uses Home affordability twice: "See what you
  can afford", then "Set down payment goal").
- **Guide mode only for the followed guide:** after "Stop following this guide", Back to an old step address shows
  nothing; every way into a step (the step rows, "Do step N", Get started) starts the guide first.
- **Goes quiet:** after 30 days with no tap in it, the followed guide's bar stops showing. Any tap in it (Next, Skip,
  All steps, a step row, "Do step N", "Continue my plan") remembers the day, at most one save a day, and brings a
  quiet guide back.
- **Skip:** "Skip to" goes to the next step that can be done now; a step that needs the skipped one only when nothing
  else is left. It marks the step "Skipped for now" and says so at the top of the next page.
- **Look-only steps** are ticked by Next (and All steps), never while they still need an earlier step: a page that
  cannot answer yet must not count as looked at.
- **Needs:** a step whose page needs an earlier one (Social Security needs a person) says "This step needs step 1
  first" with a link, on the page and in the list.

Done checks in words (`journeys.js`):

| Guide | Steps (extras in brackets) | Done when |
|---|---|---|
| Build my plan (`plan`, "Your plan") | the questions, month, debts, cushion, cover, retirement, what would help, where to take money from, the yearly amount the law requires, home, college, tax: only those that apply to the household | `variant`/`partsFor` leave out the steps that do not apply; see "The path" |
| Pay off what I owe | add, rates, order, [cards, student, one-loan] | a liability account; every loan and card with a balance has its details saved, a 0% one too (Liabilities' own `detail`); a payoff order saved; [looked, once rates are in; saved or looked; saved or looked, once rates are in, and shown only when Consolidation has two cards or loans it can roll together (not a mortgage or student loan) with one at 10% or more: its own pick] |
| Spend less and save more | income, accounts, spending, budget, cushion, [sort] | an income; a checking, savings, cash or card account; an expense or a bank row; an envelope or a 50/30/20 split; a goal named emergency / rainy day / cushion or with the 🛟 icon (Emergency fund's own test); [90% of bank rows sorted, or looked] |
| Buy a home | pay, afford, goal, [lenders, rent-buy, fit] | an income (first, so Home affordability can show a price range at once); its inputs saved; the house goal by Home affordability's own test (`goals/house` `isHouseGoal`: a down payment, the 🏠 icon or a home to buy, never repairs, paying it off or a trip home); [looked, shown only with loans or cards (Debt ratios works from today's debts, not the home just priced); saved or looked; looked] |
| Plan my retirement | people, savings, spend, ss, saving, pension, chance | every adult has a birth date; a savings or retirement account (not a loan); retirement spending saved, or bills on Expenses (its other page); a Social Security amount or record, or "won't get it"; a contribution, or "not saving now"; a pension (on Pensions, or one already paid on Income), or "don't have one"; looked, once people, savings and spending are in (the chance page cannot answer before) |
| Sort out my taxes | people, income, estimate, paychecks, state, [room] | a person; an income or typed wages; tax withheld typed, or looked; one paycheck's tax for either earner, or "none taken"; a state; [looked] |
| Protect my family | people, policies, savings, spend, life, papers, contacts, [who-gets] | an adult with a birth date; a policy, or "none"; an account; an expense (Life insurance needs works from the retirement projection's inputs: accounts, spending, adults' birth dates, so the guide gathers them); looked, once those are in; any paper noted (even "not made yet"), or "none of these yet"; a contact; [a beneficiary saved] |

The minutes are rough judgements of the time to fill each guide's pages, not measured.

**A guide for this plan (`variant`, `forPlan`; round 4, 2026-11-02).** A journey may carry `variant(plan, { today })`, which returns other words for the guide (line, have-ready, More, finish) and, per step key, fields that replace the step's own or `null` to leave the step out; `journeyStatus(journey, plan, { off, today })` applies it, so the guide page, the bar, Get started and the counts agree. Without `today` nothing changes (the shell always passes it). The one use: **Plan my retirement for a household already retired** (Will the money last?'s own `householdRetired`: setup said retired, or no pay and past the retirement age). Then "Say what you spend" asks what you spend a month now; "Add what you save now" is left out (nothing goes in from pay any more), so the guide has six steps; the Social Security step offers Income for a benefit already paid; More lists How much to take out, How much more could I spend?, This year's required withdrawal, Medicare, Roth conversions, How long, Stress tests and the summary, and drops "When could I stop working?", "Could I stop work early?" and, once every adult is 65 or over, "health care before 65". Before, the guide asked a retired couple of 76 and 69 what they save from each paycheck, and its next step stayed on that.

**Review fixes 2026-11-02 (retiree guide).** Checks receive `{ today }` (`stepState(step, plan, progress, today)`), so a pension on Income that has ended no longer counts. More names the required withdrawal as "This year's required withdrawal" only when one is due (retirement/rmd `thisYear`), "When must I start taking money out?" before that, and leaves it out with no 401(k) or IRA. The finish line names Social Security and pensions only when the plan has them. The Social Security step's Income instruction works on an empty Income page.

## Review after the build (2026-10-31)
Four reviewers (code, hands-on flows, a first-time user, visual design) and two skeptics who tried to refute each
finding: 24 of 39 findings held and are fixed. Among them: a guide could never come back after 30 quiet days; typing on
pages without a `<form>` was not protected; the retirement and protect guides could "finish" with their answer pages
still saying they needed more; Skip could land on a step needing the skipped one; a blocked look-only step could be
ticked; a finished step's bar kept its instruction; plus wording (each "does not apply" says what was said; Quick
answers' rows; "a baby or a move" first in More guides). A second round (regressions, flows, copy; then
skeptics) confirmed 16 more, all fixed: "Do step N" could point at a step waiting on a skipped one; Skip could prefer
a blocked step after to a free one before; the compact link was not guarded; Import's account picker set off the
typing warning; the finished guide repeated its link four times; five asks named buttons that were folded away or did
not exist (Federal estimate, Consolidation, Student loans, State, People's filing choice that saves at once); Buy a
home asked for the price before the pay; the house page could overwrite a "Home repairs" goal (fixed there, shared
test).

A third, narrow round on that commit (two lenses, two skeptics each) confirmed four: the house-goal test lost
"Townhouse fund" and still took "Pay off the house" (now ranked, in `goals/house`); the taxes paycheck ask named a
folded form; Withholding said "Nothing is withheld from a paycheck" when only the figure was missing. Then a **sweep of
every step** (45 steps, each on an empty plan, the family plan and right after the step before, on a phone; a skeptic
per finding) confirmed 20, none refuted, all fixed here: asks now name "+ Add another ..." where a list folds its form,
the fold to open (or the frame opens it, above), the Status and row to tap on Papers and Beneficiaries, the state
choice inside Your figures, the untick on Expenses' "I must pay this" (it starts ticked, which made the emergency fund
too big), that Rent vs buy starts from its own example and Debt ratios leaves out the home just priced; look-only
steps say "the button below" (it is not always labelled Next); the paycheck step counts either earner; Check your cards
and See if one loan helps wait for rates; one loan shows only when Consolidation has something to compare; the next
extra step prefers one that can be done now. A test now checks every fold and "+ Add another" an ask names against that
page's code.

## Choices made (no owner input; noted per the builder instructions)
The spec (2026-10-31) was checked by three critics before building (an engineer against the code, a first-time user of
60 on a phone, a UX reviewer). Their fixes are in; the main ones:
- Only `plan.guide.active` turns a guide on (the address alone brought the bar back after leaving).
- Numbered steps never hide; anything that can hide is an extra (step numbers no longer shift mid-guide).
- "On this page:" plus the page's own button name, in 15 px body text, instead of the step title repeated in small grey.
  **Changed 2026-11-01** (the owner: "not INSANELY user friendly"): the step title in bold, the instruction under it in
  normal body text, and **Show me where** under that. `targetsOf(ask, { target, opens })` reads the labels the
  instruction names ("+ Add another ...", the buttons after "tap", the folds after "open"/"under", the step's `opens`,
  or a step's own `target`); the button is drawn only once the page shows one of them, and tapping it opens any fold
  around it, scrolls to it (a form's Add button: the form's card, from its top), focuses it (the form's first box) and
  rings it for two seconds (no animation with reduced motion). A test checks that every step that says "tap ..." names
  a label its page's code really has.
- One way forward in the card ("Skip to" / "Next"), no separate Back and Skip buttons; Undo for "does not apply".
- "Stop following this guide" instead of "Leave the guide", which sounded like losing work. A finished guide offers
  "Show all the steps" (it opens the folded list), not a restart that would clear the person's "does not apply" answers.
- Budget's emergency-fund step opens Goals (Emergency fund cannot create a goal), with Emergency fund as "See how big
  it should be"; Protect's papers step counts any paper noted, since someone with no will notes "none".
- Help: "Ask the app a question" only while the AI answers; otherwise "Questions? See the help".
- Buy a home has three numbered steps (pay, price range, down payment goal); "See what lenders see" became an extra
  shown with loans or cards, because Home affordability already shows the lenders' 28% / 36% limits with the other
  debts counted, and Debt ratios, built for today's debts, rated housing "comfortable" right after the price page said
  the home was over the limit (sweep, 2026-10-31).
- The guide opens a fold the ask names instead of editing other people's pages to open it; the pages' owners were told
  on the WORKBOARD.

- "I won't get Social Security" on the retirement guide's Social Security step (`markNone(..., "ss")`) is also saved as the
  setup's own `guide.setup.ss[id] = "none"` for each adult with no figure, as the retirement pages' notice does, so the
  Dashboard, Retirement contributions and the retirement check stop asking (review fix, 2026-11-02).

## Sources
GOV.UK Design System: "Complete multiple tasks" (task list: statuses in words, not colour) and "Question pages" (one
thing per page, a way back); NN/g "Wizards: Definition and Design Recommendations" (verbs on buttons, "Next: what",
progress as a caption) and "Onboarding tutorials vs contextual help"; Boldin's retirement planner ("I don't have any"
counts as complete); WCAG 2.2 (2.4.11 nothing sticky over fields, 2.5.8 targets, 3.2.6 help in the same place). The
research notes are in the build session, not the repo.

## Tests
`module.test.mjs`: definitions (7 guides, 3 to 7 numbered steps, every door a usable page, shorts of 21 characters
starting with a verb, one-sentence asks, the button an ask names exists on that page, every fold and "+ Add another" an ask names is in that page's code); the whole plan equals the
dashboard; done checks (a 0% loan, "Home repairs", "Pay off the house", the emergency fund, either earner's paycheck, one loan only with something to compare, steps that wait for rates); visible steps; step states; statuses on an
empty plan and on the family fixture (worked by hand); finishing; which step a page is; neighbours; the bar's modes,
the 30-day quiet, after leaving; the summary and step addresses; every change reports whether it changed anything and
touches only `plan.guide`; compute returns plain data; the manifest's frame hook.

## Review 2026-11-02 (round 5): an ended Social Security line
`socialSecurity(p, { today })` (the retirement guide's Social Security step and its finish words) skips a Social
Security line on Income whose end date has passed, as `pension()` does and as the projection (`incomeSocial`,
`ssOnIncome`) does: an ended survivor benefit marked the step done and said "Social Security ... in your plan" when no
page counted it. A line that starts later still counts: the projection counts it from its start date and Will the money
last? takes Social Security as known with it.

## Ideas / not yet
- Pages could read the step from the address and open their add form, or scroll to the field the step asks for.
- The dashboard's "Continue: <guide>" tile and "Start something new" link (designer's lane; asked on the WORKBOARD).
- The server could skip its backup copy when a save changes only `plan.guide`.


## The path (2026-11-06)
The owner asked for one easy way from point A (Get started) to point B (the finished plan, with every result page). The path
is the `plan` journey (never `whole-plan`: a stored `journeys["whole-plan"].finishedAt` must not read as finished). It is the
one guide whose steps come and go with the household (`pathVariant` in journeys.js, cached by `partsFor` in compute.js).
- **Steps** (12 defined, 4 to 9 apply): answer the questions, your month, your debts (any card or loan but the mortgage), your
  cash cushion, cover for your family (children or a second adult, pay on file, not retired), your retirement, what would help
  (the projection is tight or short), where to take money from (retired), the yearly amount the law requires (an adult is within
  a year of the start age), the home you can afford (picked in the questions, or a home goal), college costs (children and a
  college goal), this year's tax (pay or business income). Every step is look-only and passable: Next ticks it.
- **done / passed / complete**: done = a passing check, a Next tick or "does not apply"; passed = the person tapped Next on it (or
  the questions are done); complete = every step that applies now is done (never `finishedAt`: new data can add a step).
- **Next** (frame, path mode) = `nextAfter`: the first step after this one that is not passed; else the first not done anywhere
  ("Still to do"); else the end ("Finish: see your plan"). `pathSummary().next` is where to resume (Get started, the Dashboard,
  the continue row, Your plan).
- **Every other page** ends with the continue row (frame.js); a result page opened from Your plan ends with "Next result".
- **Cost**: the frame runs this on every page, so `pathSummary` never runs standing(), protectionGaps() or answerFor(); only
  `fix-retire` runs a projection, behind the `partsFor` cache (a `WeakMap` on the plan, then one entry keyed on the plan without
  guide.journeys/active/activeAt/chosen/meta).
- **Words**: no banned word (Monte Carlo, assumptions, net worth, RMD, inflation, ...) in the path's text; the test lists them.
- **Not blocked**: no `needs`. A step whose page cannot answer yet (`waits`) says what it needs and still lets Next through.

## The step card keeps clear of the page's last button (path part 3)
`.gn-root.card { margin-top: 20px }` in the frame's own STYLE.

## Follow-up, 2026-11-07 (workflow wfu1; tests `tests/followups-*.test.mjs`)
- The cushion step is "Emergency fund" (name, title "See your emergency fund", short "See emergency fund"), as the page and the menu call it.

## Stress test 2026-11-11 (claude-f)
The guide page's one filled "Do step N" sits in the head card under the progress bar (OP-7, A2: below the list it was off the
first screen on five guides). The path's "Your month" step `waits` for the pay when the plan has none (F5); drawing a step's
waiting sentence in place of its `ask` on the step card is frame.js (wave 1). "What would help" (fix-retire) is left out while
the projection cannot say whether the money lasts for want of retirement savings (`savingsUnknown`, j-first-renter/F4).
