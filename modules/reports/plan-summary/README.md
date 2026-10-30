# Plan summary  (`reports/plan-summary`)

**Status:** usable (phase 9)
**Purpose:** Gives you a printable overview in the style of an advisor's plan: where you stand, goals, protection and next steps.

## Inputs
Through the pages that work each figure out: People, Net worth, Next best action (each month's money), Plan health score, Will the money last?, Chance the money lasts (`SUMMARY_PATHS` = 1,000 paths, seed 1, capped by the PC's `maxPaths`), Stress tests, Goals, Debts with the Pay off debts plan's dates, Life timeline (the next `MILESTONE_YEARS` = 10 years), Social Security, and the assumptions. Writes nothing. `heavy: true`.

## Outputs
`{ ready, missing, today, household, netWorth, cashflow, health, retirement, protection, goals, debts, milestones, nextSteps, assumptions }`: figures only; the view writes the sentences.

## The document
An opening paragraph in plain words (who, when the spending years start, what you own and owe, whether the money lasts and the chance it does, the health score), then: where you stand, each month, retirement, protection (stress tests), goals, debts, the next ten years, next steps (Next best action's next step and the health score's biggest gains), plan health, assumptions, and a dated footnote. `../report-kit.js` draws it as a sheet on screen; "Print or save as PDF" writes the same sheet into a document of its own with a light palette and letter-size page margins, and prints it (the browser's dialog also saves a PDF). No global print styles are needed.

## Edge cases
No people: not ready. No plan basics: the retirement, protection and health sections drop out or say what is missing; the rest still prints. A blocked pop-up: the button says to allow pop-ups.

## Tests
`module.test.mjs`: not ready without people; the family's figures match each page's own; the debt dates agree with the timeline; milestones stop ten years out.

## Ideas / not yet
- The advisor's plan side by side (`scenarios/advisor-plan`), a net-worth chart, a cover page with the household's name; a monthly or yearly copy saved with the date.
