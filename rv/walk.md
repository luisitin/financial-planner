# Walk: what a person sees today when retirement falls short (tip fe678cb, 390 px phone, sandbox)

Short version: when the money runs short, the app shows the shortfall clearly and Goal seek works out what it would take to fix it. Three things are missing:
- No page names which inputs drive the result *and* which of them are our guesses.
- You can't change a lever and see the verdict move on the same screen.
- The money left over each month is never counted as invested.

On the households below, the leftover alone is worth more than every assumption lever put together. Splitting saving between Roth and traditional is possible, but only through a 13-tap workaround that nothing points to.

## How this was walked
All relative paths below (`out/...`, `*.mjs`) are under `$SP/rv/walk/`.

- **Code and server:** a detached worktree at fe678cb, served by the app's own server on 127.0.0.1:9611. Every page was opened on a 390x844 touch phone, always in the sandbox.
- **Screenshots:** `.../scratchpad/rv/walk/out/` (306 PNGs; `<household>__<route>__top.png` and `__full.png`) and Get started screens in `.../out/gs/`.
- **Raw page text and controls:** `out/walk-real-*.json` and `out/walk-renter-...-family.json`.
- **Scripts:** `.../rv/walk/{build,gs-run,walk,levers-ui,roth,real,leftover}.mjs`.
- **How the main households were built:** I tapped through Get started (setup, questions 1 to 7) on the phone for each one, so each plan is exactly what the screens save, our guesses included. The two kit households came from `households(root)` (`sam`, `renterDebt`). A builder variant of the couple, made with setup's apply functions but without guesses, is used only for gap 8.

| household (all invented) | made by | verdict on "Will the money last?" | left over / month |
|---|---|---|---|
| **Dana & Lee**: married, NC, 47 and 45, $78k + $52k. Two 401(k)s ($85k and $30k). Dana puts in $400/mo with a $200/mo match; Lee puts in $150/mo and tapped **"No match"**. Mortgage $240k. | Get started on the phone (`real-couple2k`) | **Tight**: "It lasts in most cases, not all", 78% chance (ratio 1.08) | $1,828 |
| **Morgan**: single renter, IL, born 1984, $56k. No plan at work. IRA $12k, kind "Not sure", nothing typed going in. | phone (`real-renter`) | **Short at 65** (0.24) | $532 |
| **Casey**: single, PA, born 1980, $72k, plan at work. 401(k) $48k; tapped **"None"** for what goes in. Mortgage. | phone (`real-noContrib`) | **Short at 67** (0.76) | $573 |
| **Jamie**: single, OH, born 1982, $64k. 401(k) $30k, puts in $250/mo, tapped **"No match"**. Car loan. | phone (`real-noMatch`) | **Short at 70** (0.72), 0% chance | $567 |
| **Robin**: near-retiree, MI, 63, stops at 67, $70k. 401(k) $185k, puts in $600/mo; the match was left at our guess ($230/mo). Home paid off. | phone (`real-nearRetiree`) | **Short at 94** (0.99), 35% chance: borderline | $439 |
| Sam (TX, 24) / Riley (renterDebt) | kit | "We don't know yet" (no retirement savings on file) | $746 / $3 |

## Table: page by page (main example Jamie, short at 70; others where they differ)

Taps are counted from the Dashboard. Typing is not counted; Save is.

| page | what it says when short | levers shown | levers changeable here | taps to each lever | guesses flagged? |
|---|---|---|---|---|---|
| **Get started's reveal** `overview/setup/done` | "Short at 70 · Retirement · If nothing changes. ● Small changes help." Right beside it: "$567 Left over each month … About $6,800 a year builds up in checking and savings … ● Money to put to work". Morgan (short at 65) also gets "Small changes help". | none | none ("Change an answer" reopens the questions) | retirement card → Will the money last? in 1 tap | Only in general words ("Anything you don't know, we fill in with our guesses"). The verdict is not marked as resting on the guessed retirement spending. |
| **Dashboard** | Row "Retirement · Small changes help · Short at 70". **Needs attention: "Nothing needs your attention right now"** for Jamie, Casey and Robin. | none; "Check the assumptions" sits in a folded checklist | none | Retirement row (1); assumptions via fold (1) + item (2) | no |
| **Your plan** `overview/plan` | "In short: the money runs out at 70 … Some of this rests on our guesses." "Your retirement: … runs out at age 70, even if markets do as well as average." "What would help: A few changes would make it last, like working a little longer or spending a little less." | "Make it fit you better" shows 1 or 2 guesses plus "All 5 of our guesses ›". The folded "What we're counting on" shows inflation 3%, stocks 7% / safer 4%, plan to 95, emergency months. | none (only the "These sound fine" button; "Change them ›" goes to Assumptions) | guesses: 2 taps to the list, 4 to save one | **Yes, best of all pages.** The retirement-spending and match guesses sit behind "All N". Missing: retirement age, stock share, Social Security claim age, retirement spending, the leftover. |
| **Will the money last?** `retirement/projection` (h 2,682 to 2,984 px) | Headline "Runs out in 2052", then "Short. If markets do as well as average, $38,640 a year … runs out in 2052 (age 70)…". "What goes into this" lists: ages, money today by tax type, added each year, income (Social Security from 67), spending ("the figure from Set up my plan"), health, growth and prices, tax. | Most inputs are *listed*. Not listed: the leftover, the match on its own line, Social Security claim age as a choice. | 7 settings inside a fold at about 2,700 px: spending, stocks now, stocks retired, tax mode, flat rate, withdrawal method, starting rate (plus the health tick). Retirement age, Assumptions and contributions are links away. **No link to Social Security.** | spending: 4 (row, fold, box, Save), then scroll back about 2,900 px to see the verdict | **No: the word "guess" appears 0 times.** The guessed spending reads "the figure from Set up my plan"; the Social Security estimate and the guessed match are unmarked. |
| **Chance the money lasts** `retirement/monte-carlo` | "0% … Weak: it ran out in many pretend futures. Look at spending, the retirement age and Social Security timing." For Sam and Riley it says "0% / ran out at 65" while Will the money last? says "We don't know yet". | three, in words only | none (only the number of pretend futures) | none; no links | no |
| **Goal seek** `scenarios/goal-seek` | "What it would take. As it stands the money runs out in 2052." Six cards: spend $2,330/mo; retire "not on its own (not by 75)"; save $1,070/mo ($820 more); return 10.4%; $133,940 short today; claim Social Security at 69 with a green **"room to spare"** pill. | 6 levers. No match, no leftover, no stock share, no Roth/traditional mix. | only the goal ("Just last" / "Leave $X" / "Room for bad luck"). Every card links away; nothing can be tried in place, and two levers can't be combined. | +1 to +3 from each card | no |
| **Sensitivity** `scenarios/sensitivity` | "Social Security paid in full moves your plan the most …" Bars for 9 to 11 settings, each nudged down and up. **"How much you save" is missing when nothing goes in** (Morgan, Casey), which is exactly when it matters most. | 9 to 11 | none (read-only; links to Assumptions and Goal seek) | n/a | One generic sentence only ("some you only guess (returns, inflation, how long you live)"). |
| **Assumptions** `system/assumptions` | Says nothing about the verdict. "Ten numbers drive every projection…", "0 Changed from defaults", "You have not looked these over yet." | 10: inflation, stocks, bonds, cash, two swings, raises, retirement age, plan-to age, emergency months | all 10. After Save the only message is "Saved and marked as reviewed."; **no effect is shown**, so the person has to go back to Will the money last? | 4 (Retirement row, "Assumptions" link, box, Save) + 1 to see the effect | Defaults yes ("Default: 3.0%"). Missing here: stock share, retirement spending, Social Security claim age, tax rate, contributions, the leftover. |
| **Contributions** `retirement/contributions` | "$3,000 a year into retirement accounts … At this rate the money runs out at about 70: saving more is the surest fix." Then a plain card: "No match at Jamie's job · Edit". For Casey ($0 going in): "Does Casey's job add money …? Yes, it matches / No match" (a good prompt). | own money, match, account, whose | yes: amount, how often, employer match, account, whose. The top sentence updates after Save; you land about 440 px down. | 5 (Retirement row, "What you save for retirement", row, box, Save) | yes: "employer adds $2,760 a year (our guess)" for Robin |
| **Net worth / Account detail** `balance/net-worth`, `balance/accounts` | no retirement words; "Invested for later $30,000 in retirement accounts (pre-tax)" | balances, type, whose | balances and types (Edit / + Add another account); no route back to the verdict | +1 from the Dashboard tile | balances only |

**Taps to each lever, from the Dashboard:**

| lever | taps |
|---|---|
| retirement spending | 4, plus two long scrolls |
| inflation, stock return, bond return, plan-to age | 4, plus 1 to see the effect |
| stock share now or retired | 4 |
| one person's retirement age | Retirement row → "Change the age ›" → person → box → Save: 5 |
| Social Security claim age | 5 (Retirement row → "Could you stop sooner?" → "Social Security ›" → select → Save; +1 for the partner's fold) |
| what you put in | 5 |
| employer match | 5 |
| **leftover invested** | **no lever anywhere** |
| Roth/traditional split | 13 (tested; see below) |

**Interactive check:** I changed one lever on each page in the browser (`levers-ui.mjs`).

| page | after Save |
|---|---|
| Will the money last? | You stay at about 2,880 px with only a "Retirement settings saved." toast; the new headline ("The money lasts") is off screen above (`out/real-couple2k__lever_projection_saved.png`). |
| Assumptions | No effect shown. |
| Contributions | Sentence updated, scrolled 438 px. |
| Goal seek's "Change spending ›" | Lands at the top of Will the money last? with the settings fold closed and no focus. |

## The leftover: counted as invested nowhere in the retirement answer

- **What the engine adds while you work:** only `retirement.contributions` rows go into the savings buckets (`core/math/retirement.js:129-139`). Cash just earns `returnCash` (`:309`). The only other inflow is a required withdrawal you don't need (`:304`).
- **What the projection passes in:** today's balances (`modules/retirement/projection/compute.js:885`) and contribution rows only (`:932-940`). Next best action's `spare` (`modules/overview/next-best-action/compute.js:164`) never reaches it.
- **What the app says about the leftover anyway:**
  - "About $X a year builds up in checking and savings" (`core/math/leftover.js:65`).
  - Labelled "● Money to put to work" (`modules/overview/setup/view.js:1781`), right next to "Short at 70".
  - Next best action's "The order" sends the spare money to debt and then an IRA, with dates. The projection assumes none of it.
- **Inconsistent with another page:** Financial independence *does* count the leftover as saving (`modules/retirement/fire/compute.js:72-73`, pay minus expenses before tax), so two retirement pages disagree.

What it is worth (same plan, the leftover added as monthly saving into a taxable account; `real.mjs`, `leftover.mjs`):

| household | as it stands | half the leftover invested | all of it invested |
|---|---|---|---|
| Dana & Lee | tight, 1.08 | on track, 1.27 | **on track, 1.46** |
| Sam (kit) | "We don't know yet" / 0% | on track, 1.17 | **on track, 1.64** |
| Robin | short at 94, 0.99 | tight, 1.01 | tight (lasts), 1.02 |
| Jamie | short at 70, 0.72 | short at 79, 0.84 | short at 90, 0.95 |
| Casey | short at 67, 0.76 | short at 77, 0.86 | short at 90, 0.96 |
| Morgan | short at 65, 0.24 | short at 69, 0.67 | short at 77, 0.79 |

For comparison, on the same households:
- Inflation 3% → 2.5%, or stocks 7% → 8%, moves the ratio by only 0.01 to 0.04.
- Retiring 2 years later moves it by 0.06 to 0.37.
- Adding a typical 4% match moves Jamie only from short at 70 to short at 75 (0.80).

## Roth or traditional: per person and per account

- **Get started, question 4b.** Each adult gets one retirement box: "Add up every account of that kind" (`modules/overview/setup/compute.js:85-91` HAVE, `perAdult`).
  - "Through work" always saves a 401(k), which is traditional (`compute.js:94` RETIRE_KINDS, `type: "401k"`). There is no Roth 401(k) question.
  - Only "On my own" asks "Which kind of IRA? Traditional / Roth / Not sure", and Not sure is counted as traditional (`compute.js:111` IRA_KINDS).
  - What goes in and the match **are** asked per person: share-of-pay chips or "A dollar amount a month", plus "What your employer adds: Not sure (about 4%) / No match / I know it". They sit behind a fold, "What goes in, and the match · our guess ›". Leave it closed and our guess is saved (Dana 6.8% of pay = $440/mo, match about $260/mo); screenshot `out/gs/c4bprobe_q4b-open.png`.
- **Contributions page.** One row puts money into one account (`modules/retirement/contributions/view.js:94` "Into which account", `:95` "Whose", `:99` "Employer adds, a year"). So a split takes a second account of type "Roth IRA / 401(k)" (`modules/balance/net-worth/compute.js:15`) and a second row.
- **Tested on the phone for Dana** (`roth.mjs`):
  - Net worth "+ Add another account": name, type, balance, owner, Add = 6 taps.
  - One tap to reach Contributions.
  - "+ Add another contribution": account, whose, amount, how often, Add = 6 taps.
  - **13 taps in all, with no guidance.** Dana's $400 traditional row was not reduced for the $200 now going to Roth. Will the money last? then shows only "Added each year $11,400", not split by tax type.
- **How the engine treats the split.**
  - The match is added to the row's own account and tax bucket (`projection/compute.js:934-939`, yearly = amount + employerMatch). A match on a Roth row is therefore counted tax-free, but most plans pay the match in pre-tax.
  - A "roth" account counts against the 401(k) limit only when it has a match or "401(k)" in its name; otherwise it is held to the $7,500 IRA limit (`contributions/compute.js:20-21`).
  - Per person works (rows have `personId`, accounts have `ownerId`), and so does per account (rows).
- **Leftover for an IRA.** Morgan's "Your plan" lists one IRA-related guess: "Your retirement: counted as a regular IRA. Tell us if it is the tax-free kind ›".

## Top 10 gaps against the owner's ask

1. **The monthly leftover vanishes from the retirement answer.** The reveal calls it "Money to put to work" beside "Short" or "Tight", and nothing offers "count it as invested". It is the biggest single lever for most households here.
   - Evidence: Dana & Lee go from tight to on track if it is invested.
   - Screenshots: `out/real-couple2k__overview_setup_done__top.png`, `out/real-noMatch__overview_setup_done__full.png`; route `overview/setup/done`.
   - Code: `core/math/retirement.js:129-139`, `projection/compute.js:932`.
2. **When short, no page lists "what drives this, and which of these are our guesses".**
   - Will the money last? lists the inputs but marks none as a guess (0 mentions). Jamie's $3,220 spending is our guess, his Social Security is an estimate, and Robin's match is our guess.
   - The guesses are listed only on Your plan, behind "All 5 of our guesses ›" (`overview/guesses`). That page is 2 taps away, and Will the money last? has no link to it.
   - Screenshots: `out/real-noMatch__retirement_projection__full.png`, `out/real-noMatch__overview_guesses__full.png`.
3. **The levers are spread over 6 pages, and none shows its effect where you change it.**
   - Will the money last?'s settings are 2,700 px down; after Save the verdict is off screen and only a toast shows.
   - Assumptions saves with "Saved and marked as reviewed" and no effect.
   - Goal seek and Sensitivity are read-only and link away.
   - Each lever is 4 to 5 taps plus a trip back.
   - Screenshots: `out/real-couple2k__lever_projection_saved.png`, `out/real-couple2k__lever_assumptions_saved.png`, `out/real-renter__scenarios_goal-seek__full.png`.
4. **No "check these numbers" step when the plan is short.**
   - Jamie's "No match" just shows as "No match at Jamie's job · Edit"; a 4% match would take him from short at 70 to short at 75.
   - The retirement guide `overview/guide/retire` marks 5 of 7 steps "Done" even though the spending is our guess. Its next step is "Add a pension"; it never asks you to check the 401(k), the match, inflation or returns.
   - **Needs attention says "Nothing needs your attention right now" for Jamie (short at 70), Casey (short at 67) and Robin (short at 94).**
   - Screenshots: `out/real-noMatch__retirement_contributions__full.png`, `out/real-noMatch__overview_guide_retire__full.png`; route `overview/alerts`.
5. **No Roth/traditional split at setup, and a clumsy one afterwards.**
   - "Through work" is always traditional, with one box per adult.
   - A split takes 13 unguided taps over 2 pages.
   - A match on a Roth row is counted tax-free.
   - A Roth 401(k) without "401(k)" in its name is held to the IRA limit.
   - Screenshot: `out/real-couple2k__roth_split_contributions.png`.
6. **The verdict words disagree or mislead.**
   - "Small changes help" appears on every plan that is not on track (`dashboard/view.js:144`, `setup/view.js:1798`), including Morgan (short at 65, ratio 0.24), where Goal seek says retiring later is "not on its own" and saving must be $1,000/mo.
   - Sam and Riley read "We don't know yet" on Will the money last? but "0% · Weak · ran out at 65" on Chance the money lasts (`out/sam__retirement_monte-carlo__top.png`).
   - Dana & Lee get three verdicts for the same plan: "Tight" on the reveal and Dashboard, "It lasts, just" on Your plan, "It lasts in most cases, not all" on Will the money last?. The last also says "about 7 of 10 (78 of 100)".
   - Robin's headline is "Runs out in 2057" for a gap of $5,380 today (0.2 points of return).
7. **Goal seek, the "what would change it" page, misses the levers the owner named.** It has no match, no leftover invested, no stock share and no Roth/traditional mix, and you can't try two levers together. Its Social Security card shows a green "room to spare" pill on failing plans (Morgan, Jamie).
   - Sensitivity drops "How much you save" when nothing goes in (Morgan, Casey).
   - Screenshots: `out/real-renter__scenarios_goal-seek__full.png`, `out/real-noMatch__scenarios_sensitivity__top.png`.
8. **A bad sequence of inputs can make the verdict worse.**
   - On a plan whose retirement spending comes from Expenses (the box left blank, as its help invites), typing a *lower* figure made the Dana & Lee builder variant go from "It lasts in most cases" to **"Runs out in 2069"** ($5,500 typed against $6,430 today).
   - The cause: loans are then spent for life, because `retireHeld` is set only on a plan whose figure was Get started's own (`projection/compute.js:987-989`, `:1282-1291`).
   - The box's help says "A loan payment in this figure still stops when the loan is paid off, whatever you type" (`projection/view.js:331`), which is not true here.
   - Screenshot: `out/couple2k__lever_projection_saved_top.png` (households built without guesses, `build.mjs`).
9. **Several key assumptions are never asked, hard to find, or not shown together.**
   - Social Security claim age is never asked in Get started (the estimate is "from age 67"), and Will the money last? has no link to the Social Security page.
   - Stock share (70% now, 50% retired) and the 15% flat tax live only in Will the money last?'s fold.
   - Assumptions holds 10 other numbers, and Your plan's "What we're counting on" shows 4 of them.
   - Nothing says the leftover is assumed to sit in cash at 2%.
   - Screenshots: `out/real-noMatch__system_assumptions__top.png`, `out/real-couple2k__retirement_social-security__full.png`.
10. **The step from the big picture to the details is thin.**
    - The reveal's retirement card says only "If nothing changes", with no why.
    - The retirement step comes 5th of 7, after month, debts, emergency fund and life insurance.
    - Your plan's "What would help" is one generic sentence ("working a little longer or spending a little less").
    - Nothing ranks *this* household's real levers with amounts, e.g. "invest your $567 leftover: lasts to 90; add a match: +5 years; retire at 67: +8 years". The numbers exist (Goal seek, Sensitivity, `real.mjs`) but are never put together for the person.
    - Screenshots: `out/real-noMatch__overview_plan__top.png`, `out/real-noMatch__overview_setup_done__full.png`.

**Out of scope (noted only):** the reveal footer promises "No bank logins or account numbers, ever". The Dashboard offers "Import a bank file". I did not walk account connection or statement upload.

**Cleanup:** the worktree `.../rv/wt-walk` was removed and the 9611 server stopped. Nothing in the repo was edited. A stray `real.mjs` was briefly written to the repo root by a shell slip and deleted at once; `git status` was clean afterwards.
