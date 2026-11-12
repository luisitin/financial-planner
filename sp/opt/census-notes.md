# OPTIONALITY census: what every page shows before a tap

Tip 737fb6a (the read-only copy in `$SP/opt/app`), a 390x844 phone, the sandbox, plan date 2026-11-12.
6 invented households x 159 usable pages = 954 rows. 150 of the pages are offered in the household's menu (900 rows, the ones ranked); the other 9 are builder pages or need the AI helper or the PC.
Nothing in the app or the repo was edited. Measurement only: no design proposals here.

The owner's rule this measures against (2026-11-12): "Default to less is more and allow more complexity or toggles." The builder's reading: the first view shows the answer, a few rows and one action; everything else is one quiet tap away.

## The short version

1. **The first screen is heavy with words and figures, not with boxes.** For the family, half of the 150 pages open with 113 or more words and 4 or more money or percent figures on the first screen; one page in ten opens with 161 words and 15 figures. 44 pages show 10 or more figures before any scroll, 61 show 10 or more lines of small print. Only 38 pages have a box on the first screen. (Table 2, shots 01 to 40.)
2. **Half the app has nothing optional.** 73 of 150 pages have no shut fold, no chip row, no switch and no opener for any household with a plan. Of everything the pages can show, 46% sits behind a fold, but that is 17% once the four pages that are lists of folds (Glossary, Help, Settings, Our guesses) are left out. Of the family's 75 pages longer than two screens, 40 have no shut fold and 33 have no optional part of any kind. (Tables 1, 3, 13.)
3. **The longest pages are lists shown in full.** All pages (19.8 screens), Life timeline (8.3), Tax year by year (5.6), Year by year (5.3, 31 year rows of about 7 figures each), Plan summary (5.3), Retirement report (4.3): optional share 0%. Not one "show more" or "show all" control was met in 900 rows, and not one "go deeper" link. (Tables 3, 8c.)
4. **143 folds open open, on 27 pages.** Most are an input card drawn as a fold that starts open: "The figures" (open 23 times out of 24), "Add a rental" (20 boxes), "Add a car" (10), "Your target mix" (7), "The home's details" (10), each person's Social Security card. They hide nothing by default. (Table 6.)
5. **Forms ask for everything at once.** 59 different forms are open on pages for a household with a plan: 365 boxes, of which 53 are must-fill and 93 already hold a value. The 33 forms with five or more boxes hold 296 boxes and 40 must-fill ones; 11 of them have no must-fill box at all (Rent vs buy 17 boxes with 16 prefilled, Advisor's plan 16, House down payment 12, Assumptions 10). (Tables 5a to 5d.)
6. **The opt-in controls that exist are few and uneven.** Folds: 498 outside the three list pages, on 71 pages (355 shut); 109 of the shut ones have no status line. Chips: 17 pages, mostly filters and what-if sizes. On/off switches: Settings only. "Type my own amount": one button in the whole app. (Tables 7, 8.)
7. **An answer and one filled action on the first screen: 18 of 150 pages for the family.** 57 pages lead with an answer drawn from the plan; 96 have no filled button on the first screen and 63 have none on the whole page; 43 pages have numbers but lead with their title. (Tables 9, 9a.)
8. **The empty plan is mostly light** (96 of 150 pages fit one screen, half score 24 or less), but 33 pages open with boxes on the first screen, 22 with six or more boxes, and 15 show five or more figures before anything is typed. (Table 10.)
9. **Opening and closing never changed the plan.** Every fold was opened (1,985 shut ones) and 50 openers were tapped: the saved plan and the browser's storage were identical afterwards in all 954 rows.
10. **A blind spot, measured separately.** 33 pages look the same as the empty plan for all five households, because none of the six has bank lines, holdings or insurance policies. Two more plans show what those pages become: the Ledger goes from 1 screen to 7.9, the Money calendar from 2.3 to 9, Bills and regular payments from 2.3 to 4.9. (Table 16.)

## Files

All in `$SP/opt/`:

| file | what it is |
|---|---|
| `census.mjs` | the kit script: serves the app copy on port 9801, runs the census, takes the shots, builds the tables |
| `census.json` | 954 rows, one per household x page (4.3 MB); the fields are listed under "What a row holds" |
| `census-report.mjs` | turns census.json into the tables (`node census.mjs report`) |
| `census-tables.md` | the generated tables alone (they are also the second half of this file) |
| `census.md` | this report = `census-notes.md` (the hand-written half) + `census-tables.md` |
| `shots/` | 40 PNGs of the heaviest first views, `NN-group-id--household.png`, and `index.json` |
| `census-extra.json` | 318 rows for two more plans (bank lines, policies): the blind spot, table 16 |
| `census-run5.json`, `census-fresh.json` | the repeat run and the fresh-load run used for the checks below |
| `look.mjs` | one page for one household as a PNG (`--full` whole page, `--open` every fold open) into `look/` |
| `late.mjs` | proves the census measures finished pages (each page again 2.5 s later) |
| `cmp.mjs`, `diff1.mjs`, `hh.mjs`, `fx.mjs` | compare two census files; one page reached two ways; what each household holds; which fixtures hold what |

## How to rerun, and how long it takes

```
cd $SP/opt
node census.mjs                    # the full run: census.json, then shots/ (40 PNGs)
node census.mjs report             # census-tables.md from census.json (1 second, no browser)
cat census-notes.md census-tables.md > census.md      # this report again, with the new tables
node census.mjs shots              # only retake the 40 shots from census.json
node census.mjs --root /path/to/another/worktree --port 9802 --out after.json --no-shots    # census another copy of the app (always with --out, or census.json is replaced)
node census.mjs --only family --pages debt/credit-cards,taxes/federal --out x.json          # part of it (never overwrites census.json)
node census.mjs --extra --no-shots --out census-extra.json                                 # the two extra plans
node census.mjs --fresh --only family,retired --no-shots --out census-fresh.json           # reload the app for every page
node cmp.mjs census.json after.json                                                        # which rows moved
node look.mjs family debt/credit-cards --full
```

A full run takes **3 minutes 10 seconds** on this 4-core machine: 2 min 33 s for the 954 rows (four browsers at once, about 0.5 s a page) and 36 s for the 40 shots. Four full runs took 177 to 206 s. `--fresh` is three times slower (5 min for two households). The extra plans take 1 min 53 s. `late.mjs` for four households takes 9 minutes.
The script stops the server it starts; the kit refuses port 9801 if something already answers there (`--port` picks another). It writes nothing into the app copy except the kit's git-ignored `planner.properties` (git status of the copy is clean).
To measure a fix, run it with `--root` on the fixed worktree and `cmp.mjs` the two files: the retirement pages (the owner's L1 to L8) and the shell and form kit (stress test wave 1) are being changed elsewhere right now, so their rows here are the "before".

## The six households

| name in the tables | the kit's plan | who |
|---|---|---|
| empty | `empty` | no plan yet: the first open |
| family | `family` | two earners and a child, a home and a mortgage, 10 accounts, 3 debts, 4 goals, 13 expenses |
| renter | `renterDebt` | a single renter of 24 on $39,000 with three cards and a car loan, a saved debt plan |
| retired | `retiredCouple` | a retired couple: pensions and Social Security, 6 accounts, no debts |
| freelancer | `freelancer` | one self-employed person, 2 accounts, nothing else entered |
| midsetup | `jordanMidSetup` | one parent of two, stopped at the debts question of Get started: income and people only |

## What is counted

Everything is counted inside the page area (`#content`: the page, the step bar and the Next card the shell draws around it), never the top bar or the menu. An element counts when a person can see it without a tap: not inside a shut fold, not hidden, not read-out-only text.

- **First screen**: what lies above 844 px with the page scrolled to the top (the top bar takes the first 56 px). A control or figure counts when its middle is above the line; a card when at least 24 px of it is.
- **Whole page**: the page as it opens, every scroll, no tap. **All open**: after every fold was opened.
- **Screens**: page height / 844.
- **Boxes**: text and number boxes, text areas, and pickers (drop-downs, date pickers) a person could type into at once. Tick boxes, sliders and file pickers are counted apart. `must-fill` = the box is required; `already filled` = it holds a value when the page opens.
- **Buttons**: filled (the accent colour), outlined, drawn as plain words, red. A link styled as a button counts as a button. A chip is not a button. A whole row that acts as a button is a tappable row.
- **Figures**: money amounts and percentages in the text ("$1,200", "23.9%"); not the values inside boxes, not years or ages.
- **Words**: every visible word, labels and buttons included; not the options inside a drop-down, not the words inside a chart.
- **Small-print line**: a rendered line that is mostly helper text (the kit's help, muted and small classes, tile sub-lines, list descriptions) or type under 14.5 px; not buttons, chips, pills, table cells or box labels.
- **Charts**: drawings of 120x50 px or more. **Tables**: real tables (at 390 px only five report pages and the Cash-flow statement show one; none scrolls sideways) and the record lists that stand in for them, with their rows.
- **Fold**: every `<details>`: its summary words, its status line, whether it opens open or shut, and what it holds once open (boxes, must-fill, already filled, tick boxes, buttons, chips, figures, words, tables, height).
- **Chip row**: the kit's chips, tabs, or several pressable buttons side by side; what it is for, the choices, which one is on, whether it sits in a fold.
- **Switches and ticks**: on/off rows, tick boxes, done / not done buttons, with their labels.
- **Openers**: "+ Add ..." buttons, rows that open in place, "show more / all", "my own", "go deeper / see all". The ones that are plain buttons outside a form were tapped once on a fresh draw of the page, and what the tap added was measured (px, boxes, words, figures).
- **Leads with**: the page's first accent card (the hero) and its big line; `answer from the plan` = that line is a figure, or it differs from the line the empty plan gets on the same page (which is the title or the start-here line).

### What a row holds (census.json)

`household, page, title, group, inMenu, builderOnly, requires, heavy, shown, px, screens, pxOpen, screensOpen`; `first`, `whole`, `open`: the same counts for the first screen, the whole page and all open (`boxes, pickers, selects, boxesReq, boxesFilled, boxesLoose, forms, checks, sliders, files, filled, outlined, quiet, danger, linkBtns, chips, links, tiles, figMoney, figPct, nums, cards, stats, notices, pills, headings, words, wordsSmall, wordsCtl, smallLines, charts, bars, tables, tableRows, records, recordRows, listItems, folds, foldsOpen`); `hidden` (what the folds add); `loadFirst, loadWhole, loadOpen`; `hero, heroKind, heroText, big, bigFirst, filledFirst, filledWhole, oneFilledFirst`; `folds[]` (`sum, status, kind, depth, open0, first0, top0, h, boxes, pickers, req, prefilled, checks, btns, chips, links, figs, words, charts, tables, smallLines, nested`); `chipRows[], toggles[], more[], probes[], buttons[], links[], forms[], formsOpen[], charts[], tables[], blocks[]`; `storageChanged, planChanged, pageErrors, consoleErrors, errorNotice, firstWords, ms`.

## The load score

One number for "how much a person has to take in before they can act". It adds up what is on the screen, each thing weighted by roughly the seconds of attention it asks for:

| on the screen | points | why |
|---|---|---|
| a word | 0.25 | plain text is read at about four words a second |
| a money or percent figure | +1 | it has to be matched to its label and judged |
| a box or picker | +4 | decide whether it applies, then find the number |
| a tick box or switch | +2 | |
| a slider or file picker | +3 | |
| a chip | +0.5 | |
| a button | +1 outlined or red, +0.5 drawn as plain words | |
| a filled button | +1 for the first, +3 for each one after it | two filled buttons compete for "the one action" |
| a chart | +4 | |
| a table or record list | +3 | its rows' words and figures are counted as words and figures |
| a card | +1 | a new subject |
| a small-print line | +0.5 on top of its words | |

It is computed three times a row: `loadFirst` (the first screen), `loadWhole` (the page as it opens), `loadOpen` (every fold open). `behind folds` = loadOpen - loadWhole, and the `optional share` of a page = behind folds / loadOpen.

How to read it: a first view built to the owner's rule (a big answer, two lines of words, a couple of figures, three short rows, one filled button, one quiet link, two cards) scores about 20 to 30. The Expenses page for the renter scores 23, Stress tests for the retired couple 33. The first screen cannot hold much more than 80 (it is a fixed 390x844), so for first views the score is a density: the heaviest (Consolidation for the renter, 80) is 167 words, 26 figures and 19 lines of small print. Whole pages run from 5 (an empty Duplicates page) to 1,199 (All pages).

It is a model, not a measurement of people: the weights are judgment. Table 12 shows the ranking barely depends on them (rank agreement 0.83 to 0.96 for first views and 0.95 to 0.99 for whole pages against five other ways of scoring, among them "every item counts 1" and "words only"). It does not see meaning: jargon, a wrong order, or a figure nobody needs score the same as good ones.

## How the numbers were checked against what a person sees

- **Screenshots read: 21.** Of the 40 shots: 01 Consolidation, 02 Budget (50/30/20), 03 Work benefits, 05 Disability, 07 Year by year, 09 Contribution limits, 10 Quick answers, 12 Needs attention, 16 Estimated payments, 18 Debts, 20 Goal prioritizer, 33 Next best action, 37 Income, 38 Backtest (ten of them were read from the first run's folder: the same pages and households, renumbered since). Through `look.mjs`: Dashboard, Credit cards, Rental analysis, Stress tests, Financial independence, Expenses and Will the money last?. Counted by eye against the row: Consolidation 26 figures (26 on the screen), Credit cards 14 money and 9 percent figures, 2 outlined buttons, Year by year 2 pickers, Backtest 10 chips, Debts 4 tiles and 1 filled button, Rental analysis 5 boxes on the first screen of a 21-box form. Three things the first pass got wrong were found this way and fixed: the Needs attention rows were counted as outlined buttons (they are tappable rows), "Edit ›" was counted as an outlined button (it is drawn as plain words), and the estate checklist's done / not done buttons were counted as chips.
- **The same twice.** Two full runs of the final script gave identical rows: 954 of 954 (`cmp.mjs census.json census-run5.json`).
- **Reached by the menu or opened directly.** Reloading the app for every page instead of moving from page to page gave identical rows for 316 of 318 (family and retired). The two that differ are Scenario compare (scenarios/compare): its "More on this" card has a fourth link, "Chance the money lasts ›", only when the app is opened directly on that page.
- **Finished pages.** Some retirement and scenario pages (Will the money last?, Financial independence, How much to take out, Required withdrawals, Goal seek, the stress tests) draw first and fill their answer in afterwards. The census waits for their own markers (aria-busy, the grey slot, "Working out ..."); `late.mjs` then looked at every page again 2.5 s after the census would have measured it: 0 of 636 page visits had changed. Before that wait was added, How much to take out was measured before its answer arrived.
- **Looking changes nothing.** After each page the browser's storage was compared with the start: no row changed the plan or anything else, with every fold opened and 50 openers tapped. No page error, no error notice, no page sent elsewhere, in 954 + 318 rows.

## Limits

- The households are invented and small: none of the six has bank lines, holdings, policies, coins or lots, so the 33 pages of table 16 are measured empty; the two extra plans cover bank lines and policies, not holdings.
- The sandbox has no AI helper and (in the household's view) no PC pages: the 9 pages that need them are in census.json but not ranked.
- Phone only, light mode, 390x844. A 320 px phone wraps more and would score higher on lines, the same on counts.
- "Show more" controls exist in the code for three lists (they need longer lists than these households have), so "0 met" means these six households never see one, not that the app has none. The extra plan with 91 bank lines did not meet one either: its Ledger opens 7.9 screens long (712 words, 95 figures), with one shut fold, "Showing" (the filters).
- A fold's status line is recorded, but the census cannot tell whether it truly says "you changed something here": that needs a per-page look.
- claude-a's 13 pages are marked † in every table and gathered in table 14: they need a hand-over, not an edit.

