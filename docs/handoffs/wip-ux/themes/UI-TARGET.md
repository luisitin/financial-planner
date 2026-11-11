# UI-TARGET: The only way on is a 16 to 36 px link inside a sentence; buttons that do not say where they go

7 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-retirement-a/R-A9 (severity 3, next, scope several-pages, owner claude-b, confirmed)
**On first open the way on is a 16 to 19 px word inside a sentence, or a link to a page that asks again**

- pages: retirement/social-security, retirement/contributions, retirement/monte-carlo, retirement/historical, retirement/rmd
- reach: Five retirement pages. Done right already on retirement/withdrawal-strategy and retirement/cash-flow (filled 'Open Will the money last?'), retirement/longevity (filled 'Add birth dates on People'), retirement/fire (filled 'Expenses').
- steps: H.empty() (first open), open each page. Scripts: $SP/ux/p-retirement-a/verify/a5.mjs, a9.mjs.
- saw: Social Security: 'People page' is 89x19 px inside an amber note; contributions: 'Net worth page' 95x16; required withdrawals: 'People page' 89x19; no filled button on any of them. Chance the money lasts and If history repeated: the amber note names the People page, the Net worth page and the Expenses page, none of them is a link, and the one link ('Will the money last?', wrapped over two lines) opens a page that lists the same three things again. Each page does end with the 44 px row 'Start your plan: a few easy questions' (the one way on, log 2026-11-06), so nobody is stuck.
- should: One 44 px button under the sentence: 'Add the people' on Social Security and required withdrawals, 'Add your accounts' on contributions; on the two odds pages the People / Accounts / Expenses buttons themselves (or the filled 'Open Will the money last?' the sister pages use).
- why: The sentence tells me what to add and the word to tap is smaller than a fingertip; on the odds pages it costs an extra page to reach the same three buttons. The owner already chose buttons over small inline links (log 2026-09-16, Pass 4 round 2).
- cause: modules/retirement/social-security/view.js:34, modules/retirement/contributions/view.js:109, modules/retirement/monte-carlo/view.js:26, modules/retirement/historical/view.js:20, modules/retirement/rmd/view.js (empty branch): the empty state is a ui.notice with an inline <a>.
- fix: Replace the inline <a> in each of the five empty branches with ui.row(ui.h('a', { class: 'btn', href }, label)) as longevity and withdrawal-strategy do. Keep the 'Start your plan' row.
- evidence: $SP/ux/p-retirement-a/verify/a5-empty-social-security.png, $SP/ux/p-retirement-a/verify/a5-empty-contributions.png, $SP/ux/p-retirement-a/verify/a5-empty-monte-carlo.png

## j-fat-fingers/FF8 (severity 2, touch, scope several-pages, owner claude-b, confirmed)
**Four links inside sentences are 16 to 36 px tall; a thumb 20 px off misses them**

- pages: balance/liabilities, debt/mortgage, debt/ratios, retirement/contributions
- reach: 4 of 157 usable pages (swept all of them with the family household, folds closed): 'Open my payoff plan' on Debts (315x36), Mortgage (148x19) and What lenders see (128x16); 'Will the money last? ›' on Retirement contributions (131x16). The other nine most-used forms have none.
- steps: H.family(), open balance/liabilities, debt/mortgage, debt/ratios, retirement/contributions; run census().
- saw: The four links above; a touch 20 px above or below the middle of each lands on nothing (v8-retirement-contributions.png). The Debts one is also the link the second tap of x-1 lands on.
- should: Each of the four is its own 44 px row or outlined button under the sentence, like 'Update balances on Net worth'.
- why: The app's own rule is 44 px everywhere, and the owner already had an inline link turned into a button for this (design log 2026-09-16, Pass 4 round 2).
- cause: an <a> inside a <p>: modules/balance/liabilities/view.js:117, modules/debt/mortgage/view.js:45, modules/debt/ratios/view.js:29, modules/retirement/contributions/view.js:123.
- fix: Four one-line page changes: take the link out of the sentence and append it as ui.h('a', { class: 'btn secondary', href }) on its own line. No shell change.
- evidence: $SP/ux/j-fat-fingers/verify/v8-retirement-contributions.png ; v8-balance-liabilities.png ; v8b-small-0.json, v8b-small-1.json, v8b-small-2.json (scripts v8.mjs, v8b.mjs)

## p-balance/B8 (severity 2, touch, scope page, owner claude-b, confirmed)
**'Open my payoff plan' on Debts is a text link broken over two lines, each 19.5 px tall**

- pages: balance/liabilities
- reach: this one link; a sweep of 10 other pages with two households found no other target under 44 px
- steps: H.family(), balance/liabilities. Scroll to the end of 'Your debts'.
- saw: The link ends a paragraph: 'Open' (about 33 px wide) at the end of one line and 'my payoff plan' on the next, each 19.5 px tall (box 315x36). A tap on the words opens the payoff plan.
- should: An outlined 44 px button 'Open my payoff plan' under the paragraph, which is what the owner chose for the same case on 2026-09-16 (Emergency fund, 'Update balances on Net worth').
- why: Measured and seen.
- cause: modules/balance/liabilities/view.js:117: a plain <a href="#/debt/payoff"> inside p.small.
- fix: Take the link out of the paragraph: ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Open my payoff plan")).
- evidence: $SP/ux/p-balance/verify/b8-link.png, $SP/ux/p-balance/verify/v-b8.mjs

## p-career-household-system/F8 (severity 2, navigate, scope several-pages, owner claude-b (household/life-events, household/calendar), confirmed)
**Step links all read "Open ›"**

- pages: household/life-events, household/calendar
- reach: two pages
- steps: H.family(), household/life-events, tap A new job, Show my steps. Also household/calendar rows.
- saw: Seven links named "Open ›" (42x44, no aria-label) to five different pages; two of them go to the same page. Calendar: two more. The sentence above each gives the context, but not which page opens.
- should: Name the page: "Job offer compare ›", "Work benefits ›", "Health insurance ›".
- why: Reproduced. Lowered to 2: each link sits right under its own sentence, so a sighted reader can follow; 42 px against 44 is not worth a line of its own.
- cause: modules/household/life-events/view.js:99 and modules/household/calendar/view.js:71 write the constant "Open ›".
- fix: Use the target page's title: `${ctx.modules.get(s.go.slice(0, 2).join("/"))?.title ?? "Open"} ›` in both files, with min-width 44px.
- evidence: $SP/ux/p-career-household-system/verify/f8-steps.png, $SP/ux/p-career-household-system/verify/f9-calendar.png (v8.mjs)

## p-overview-home/OV-5 (severity 2, navigate, scope several-pages, owner claude-b, confirmed)
**Buttons and rows that do not say where they go: 'Open the page' on Next best action, and Health score rows that open pages they do not name**

- pages: overview/next-best-action, overview/health-score
- reach: Next best action hero for every household with a next step (family, renterDebt, patLee); Health score 'All seven parts' rows for every household with a score.
- steps: family household: Next best action, read the filled button, tap it. Then Plan health score, tap 'Saving each month 15 / 15' and 'Retirement on track 25 / 25'. Scripts: verify/v7-nba.mjs, v6-hs.mjs.
- saw: Next best action: the one filled button reads 'Open the page' and opens Emergency fund (family, renterDebt) or Retirement contributions (patLee). Health score: the seven rows under 'All seven parts' are whole-row links with no chevron and no 'Open'; 'Saving each month' opens Next best action, 'Retirement on track' opens a page titled 'Goal seek'. Narrower than the walker wrote: 'Protection' does land where its own blue sentence points ('the stress tests show how much each shock is short'), and every landing page fits the row's subject.
- should: The hero button names its page: 'Open Emergency fund ›'. Each health-score row ends with the name of the page it opens ('Open Stress tests ›') like the rows on Needs attention.
- why: Reproduced; kept at 2 because nobody is lost, only surprised. The app's own rule is plain labels that say what a button does.
- cause: modules/overview/next-best-action/view.js line 62 (fixed label 'Open the page'); modules/overview/health-score/view.js line 46 (row link with no destination name or chevron).
- fix: Line 62: label from the destination's manifest title, `Open ${modules.get(n.go.join('/'))?.title} ›`. Health score line 46: append a muted 'Open <title> ›' built the same way from p.go.
- evidence: $SP/ux/p-overview-home/verify/nba-family-full.png, $SP/ux/p-overview-home/verify/hs-family-full.png

## p-retirement-b/RB3 (severity 2, touch, scope several-pages, owner claude-b, confirmed)
**The only way on is a link inside a sentence, 16 to 19 px tall, on five retirement states**

- pages: retirement/rmd, retirement/roth-conversions
- reach: rmd (4 states), roth-conversions (1 state)
- steps: empty: open retirement/rmd ('People page', 89x19, inside an amber box, no button on the page). sam or renterDebt (no 401(k) or IRA): open retirement/rmd ('Net worth', 70x19) and retirement/roth-conversions ('Net worth page', 110x19). ruth with birth year 1951: retirement/rmd, tap 'I've taken it' ('Estimated payments', 124x16). freelancer: retirement/rmd ('Will the money last?', 19 px).
- saw: census() flags each as 'small target (inline link)'. A tap on the exact middle works (People page opened, Back returned to rmd at scroll 0). No filled or outlined button on the rmd empty state; the instruction sits in an amber box, the colour kept for 'attention'.
- should: Each becomes a 44 px button under the sentence: rmd empty: filled 'Add the people in your home' (and a plain info box, not amber); no account: outlined 'Add it on Net worth'; after taken: outlined 'Estimated payments'.
- why: Reproduced in five states. Lowered from 3 to 2: the links work and the 44 px 'Start your plan' row sits right below on the empty page. Still worth fixing because the owner already ruled on exactly this (design log 2026-09-16 pass 4 round 2: an inline link was 'the last sub-44 px tap target in the app' and became an outlined button), and the Roth page's own code says 'one outlined button, not a link inside the sentence'.
- cause: modules/retirement/rmd/view.js:52 (estLink), :62 (notice with an <a>), :65; modules/retirement/roth-conversions/view.js:90.
- fix: Replace the inline <a> with ui.row(ui.h('a', { class: 'btn secondary', href }, label)) in those four places (filled 'btn' for the rmd empty state).
- evidence: $SP/ux/p-retirement-b/verify/rb2-empty-rmd.png; $SP/ux/p-retirement-b/verify/rmd-ruth75-1.png

## p-retirement-c-scenarios/RC-10 (severity 2, navigate, scope page, owner claude-b, confirmed)
**Goal seek: six buttons all called "Open the page", each going somewhere different**

- pages: scenarios/goal-seek
- reach: Goal seek. The one other "Open the page" (Next best action) is a single button under one named step.
- steps: H.family(), scenarios/goal-seek, look at the foot of each of the six answer cards.
- saw: Six outlined buttons named "Open the page" (118x44). They go to Will the money last?, People, Contributions, Assumptions, Net worth and Social Security. "When Ana can retire" opens People, which nobody would guess.
- should: Each button names its place: "Change it on People", "Open Social Security", and so on.
- why: The label does not say where the tap leads, so the person cannot tell whether it is worth leaving the page.
- cause: modules/scenarios/goal-seek/view.js:106: one fixed label for every lever.
- fix: Build the label from the destination page's title (or add a short label per lever beside its go target in compute.js).
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc3-family-full.png (script rc3.mjs)

