# Household test cases

A library of pretend households, one `.md` file each, so that testing the app never starts
from a blank page again. Pick a folder, open a case, load its plan into the sandbox, compare
the pages with the numbers in the file. Or let `run.mjs` do it.

## Layout

```
qa/households/
  README.md              this file
  INDEX.md               every case, one line, with its last status (generated)
  generate.mjs           writes the cases from lib/catalog.mjs (re-run after editing it)
  run.mjs                loads cases into the sandbox and checks the pages against the math
  lib/catalog.mjs        the 14 household types and the edge-case packs (the brainstorm)
  lib/expect.mjs         the tester's own math for what every page should show
  results/               one JSON per run + SUMMARY.md (created by run.mjs; git-ignored, so on a
                         fresh clone the pass/fail lines in INDEX.md point at a run you have
                         not made yet: run.mjs recreates it)
  01-single-adult/       one folder per household type ...
    base/                the household as built
    ages-and-dates/      birthdays, leap days, turning 65 today, no birth date, 101-year-old ...
    income/              every pay period, ended, not-yet, 30% raise, pay cut, one-off, zero ...
    expenses/            every period, one-off, no must-pay, overspend, ended, upcoming, 1e9 ...
    accounts/            every type, only debts, overdraft, 1e12, stale, no date, 50 accounts ...
    debts/               never pays off, 0%, 99%, extra > balance, orphan detail, DTI 36/43 ...
    goals/               done, behind, on track, no date, past due, negative, shared account ...
    warnings-and-roles/  two "Me", no "Me", filing mismatches, no people, born 1900 ...
    special/             what makes THIS household type special (child support, layoff, ...)
  02-couple-no-kids/ ... 14-unusual-structures/   same packs, different people
```

14 household types x (1 base + 72 common variations + 8 special) = about 1,400 cases.
Types: single adult · couple no kids · single parent (child support in) · two working parents ·
stay-at-home parent · blended family (support paid and received) · multigenerational · retired ·
near retirement · student/starter · self-employed · high net worth · in crisis · unusual
structures (widowed, roommates, military, EUR, separated).

## A case file

- **header**: id, type, pack, `status:` line (the truth for that case), the exact run command
- **Household / The twist / Why it matters**: plain words
- **People, Accounts, Income, Expenses, Debts, Goals**: tables of exactly what is entered
- **Expected**: the numbers every page should show, computed by `lib/expect.mjs` (not by the
  app) for `today = 2026-09-15`
- **Also check**: things to look at by eye (warnings, wording, layout)
- **Plan JSON**: paste-ready; `run.mjs` loads it into `localStorage` under `planner.plan.sandbox`

## Running

```
node qa/households/run.mjs 08-retired/base/H-0701-base.md   one case
node qa/households/run.mjs 04-two-parents/debts               a pack
node qa/households/run.mjs 13-in-crisis --limit 10 --mark     first 10 of a type, write status back
node qa/households/run.mjs --all --mark                       everything (about 8 s per case)
```

The app must be running (`http://127.0.0.1:8787`); everything happens in the sandbox. Each case
prints `PASS` or `FAIL` with the first wrong figure (`expenses.monthly expected 6082 got 6100`).
`results/<id>.json` has every check; `--verbose` also keeps the page text. `--mark` writes
`pass <date>` or `fail (results/<id>.json)` into the case file and INDEX.md.

"not read" means the page did not show that figure (usually an empty state); it is not a fail.

## Iterating

- New edge case: add a `V(...)` to a pack in `lib/catalog.mjs`, run `generate.mjs`.
- New household type: add an archetype (people + money + `who`) and a `special` pack.
- A case that fails: file it in `docs/FEEDBACK.md`, put `fail F-0xx` on the status line.
- The math in `lib/expect.mjs` mirrors the rules in the module READMEs; when a rule changes on
  purpose, change it here too (and say so in the CHANGELOG line).
- Dates are fixed to 2026-09-15 so results stay comparable; `run.mjs` drives the app through
  `tools/drive.mjs`, which uses the real clock, so cases near a date edge (turns 65 today,
  due this month) will drift after that day. Regenerate with a new `TODAY` when that matters.

## Numbers the runner compares

People count / adults / dependents / plan horizon / retirement tile · Income per month, per
year, next year, one-time · Expenses per month, must-pay, nice-to-have, left over (or short) ·
Net worth, you own, you owe, invested · Emergency fund usable today, within a week, months,
target · Debts owed, count, paying, interest, DTI · Goals count, saved, target, needed.
Warnings and wording are in "Also check" for a person to read.

## When the app's rules change

`lib/expect.mjs` encodes the rules the pages follow today (goal sharing by priority then date,
negative goal = no amount, Debts payments counted on Expenses when none are filed, goal-earmarked
money left out of usable cash, one-offs). When a rule changes on purpose, change it there,
regenerate, and rerun `--all --untested --mark`: statuses survive a regenerate (they are read
back from `results/<id>.json`). A sweep that suddenly fails hundreds of cases with one
signature means a rule changed underneath, not hundreds of bugs -- look at the first failure.
