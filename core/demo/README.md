# Look around with a pretend family  (`core/demo/`)

**Added:** 2026-11-13 (gap design #20). **Purpose:** someone who is "just looking" can open a whole, invented plan and
tap around, without typing a number and without any way of touching their own plan.

## What a person sees
- **By default: nothing new.** One answer in Help, "Can I try it without my numbers?", holds three plain links:
  "A family with children", "A couple near retirement", "Someone starting out". On Get started, while the plan is empty, one quiet row at
  the bottom: "Just looking? See a pretend family's plan ›" (it opens the family with children).
- A link opens the app at the Dashboard with `?sandbox=1&demo=<family|couple|starter>` in the address.
- The status pill says "Sandbox", as it always does there. Under the top bar, on every page of the visit, one line:
  "A pretend family. Nothing here touches your plan. Changes here are forgotten when you leave." with an outlined
  "Leave ›". The line is part of the page (it scrolls away; nothing is fixed to the screen).
- Inside one, the Dashboard's filled button reads "Look at: Your month ›" instead of "Continue your plan: Your month ›"
  (`lookNext()`), so nobody is asked to carry on with a plan that is not theirs.
- Everything works as in a real plan: saves confirm themselves, a reload keeps what was changed.
- **Leave** erases the pretend copy on this device and opens the app without the two words in the address: the
  person's own plan, or Get started when they have none yet. The first page then says in a green line "Pretend family
  closed. This is your own plan." (with no plan yet: "... Your own plan starts here."). The phone's Back does the same
  without erasing and without the line.
- **When the family cannot be fetched** (a weak connection, or the copy saved for offline use, which does not hold these
  files): the line turns to the attention colour and says "A pretend family could not be opened. Check your connection
  and open it again. Your plan is not touched.", with "Leave ›". Nothing is kept on the phone, so the next open tries again.

## How it is kept apart (the part that must never break)
| What | Key in this browser | Who writes it |
|---|---|---|
| the person's plan | `planner.plan` (+ `planner.plan.sync`) | the app without `sandbox` in the address |
| a tester's own pretend plan | `planner.plan.sandbox` | `?sandbox=1` |
| a pretend family | `planner.plan.demo.family`, `.couple`, `.starter` | `?sandbox=1&demo=<name>` |

- `core/store.js` picks ONE key when the page loads, from the address, and reads and writes only that key for the whole
  visit. A pretend family is always inside the sandbox, and the sandbox never asks the home computer for the plan and
  never sends one (`store.load`, `save`, `resync` all stop at `SANDBOX`). So neither the phone's copy nor the
  computer's `data/plan.json` can be read, changed or replaced from a pretend family.
- `demo` without `sandbox` in the address is ignored (`demoOf` returns null): the real plan opens as always.
- A name that is not one of the three opens the first family, so the set of keys is closed.
- The family is poured in only when its own key is empty (`store.load`: the same path as the single file's starting
  plan, `startingPlan()`); a copy this browser already holds is shown as it is, so a reload keeps the changes.
- **A failed fetch writes nothing.** When `core/demo/plans.js` cannot be had and there is no copy, `store.demoMissing()`
  is true and the store keeps the visit in memory only (as it does in a browser that stores nothing). Before this an
  empty plan was written under the family's key on that open, and every later open showed that empty plan as "a pretend
  family" until Leave (critic finding F1).
- **The copy is dated.** `planner.plan.demo.<name>.made` holds `{ day, rev }`: the day the copy was made and its stamp
  then. Goal dates, loan starts and "as of" dates are worked out from that day, so on a later day (`demoOld()`):
  an untouched copy (its stamp is still `rev`) is made again for today, and nothing is lost; a changed copy is kept for
  30 days (`DEMO_KEEP_DAYS`) and then started over. If the fetch fails then, the copy held is shown as it is. A copy
  with no such mark is kept. (critic finding F2)
- `core/demo/plans.js` (the three plans, about 18 KB with their files) loads with the app, like every other file: a
  file fetched later could run new next to an open tab's old files after a deploy (`tests/static-host.test.mjs`).
- The other things a phone remembers in the sandbox (which rows were open, the way back, half-typed boxes) use the
  sandbox's own keys (`planner.more.sandbox`, `planner.trail.sandbox`, `planner.typing.sandbox`,
  `planner.place.sandbox`), as for any sandbox visit. They hold page names, never a figure of the real plan.
  **Known and left (critic finding F3):** these four are shared by the three families and a tester's `?sandbox=1`, so
  which rows were open or the way back can carry from one pretend plan to another. Nothing of the real plan is in them
  and nothing reaches it. "Leave" does clear the half-typed boxes (`store.eraseDevice()` sends `planner:erased`).

## Not in the plan
Nothing is added to the plan object. Device keys that exist only while a pretend family is open and until "Leave":
`planner.plan.demo.family`, `planner.plan.demo.couple`, `planner.plan.demo.starter`, each with its `.made` mark
(`{ day, rev }`). And one note in the tab (`sessionStorage["planner.demo.left"]`, the family's id): written by "Leave",
read and removed by the next page so it can say the pretend family is closed.

## Files
| File | What |
|---|---|
| `names.js` | PURE. The three families (`DEMOS`), `demoOf(search)`, `demoKey(id)`, `demoHref(id, where)`, `leaveHref(where)`, `demoLine(id, { missing })`, `leftWords(hasPlan)`, `lookNext(next)`, `demoOld({ made, rev, today })`, and the two date helpers |
| `plans.js` | PURE. `demoPlan(id, today)` -> a fresh whole plan |
| `family.js`, `couple.js`, `starter.js` | PURE. One invented household each, as a function of today's date |
| `bar.js` | DOM. `showDemoBar(store)`: the line under the top bar and "Leave" (called once from `core/app.js` boot); `takeLeft()`: the note "Leave" left for the next page, read once |

## The households (all invented)
| id | Copied from | Changed here |
|---|---|---|
| `family` | `qa/fixtures/family-plan.mjs` + `qa/fixtures/demo-household.mjs` (the single file's sample family) | bank names removed; the daycare line that ended on a fixed date removed; dates from today; the mortgage and car loan start 130 and 22 months ago (the fixture's 53 and 32 did not agree with its balances: see Formulas) |
| `couple` | `qa/households/09-near-retirement/base/H-0801-base.md` | account owners are person ids; "HELOC" and "RV" spelled out, the goal "Retirement cash cushion" renamed "Cash for the first retired year" (US wording test); monthly retirement saving, Social Security statement figures and retirement spending added so the retirement pages have something to show |
| `starter` | `qa/households/10-student-and-starter/base/H-0901-base.md` | the 401(k) owner is a person id; a 401(k) contribution added |

Source licence: this repository's own files, MIT. No figure here is a published limit, price or rule: they are a
pretend household's own numbers, the kind a person types.

## Formulas
- **Birth date for an age** (`bornOn(today, age, month, day)`): birth year = today's year - age, minus one more when this
  year's birthday (month, day) is still to come. So each person is the same age whenever the family is opened. Source:
  the usual definition of age in whole years; nothing published.
- **A date some months away** (`monthsFrom(today, months, day)`): count months from year 0 (`year * 12 + month - 1`), add
  `months`, turn back into year and month; the day is held between 1 and 28 so every month has it. Used for goal dates
  (always ahead of today) and loan start dates (always behind).
- **A loan's dates agree with its balance** (critic finding F4). Months still to pay at the usual payment =
  `-ln(1 - balance * r / payment) / ln(1 + r)` with `r = yearly rate / 12` (the standard loan formula solved for the number
  of payments; the same one `core/math/` uses for a payoff date). Each loan with a term starts `term - that` months ago:
  the family's mortgage 360 - 230 = 130, its car loan 60 - 38 = 22, the couple's mortgage 180 - 44 = 136.
- **Is a kept copy too old** (`demoOld`): days between the day it was made and today, by calendar date. 0 or less: no.
  Otherwise yes when the copy was never changed, or when the days are more than 30. The 30 is this app's own choice
  (about a month: a goal "8 months away" is then at most a month out), not a published figure.
- Cy's college goal is due on 15 August of the year Cy turns 18 (birth year + 18).

## Decisions (the spec was silent or wrong)
- **Its own key, not the sandbox key.** The design said "with an empty sandbox plan, the sandbox starts from a bundled
  plan". The sandbox key is also where testers and `qa/` runs keep their plans, and where a person's own pretend plan
  from an earlier visit may sit: pouring a family into it only when empty would show that older plan under the line
  "A pretend family", and pouring it in always would destroy it. A key per family has neither problem, and lets the
  three families be switched without one overwriting another.
- **Leave erases** the pretend copy, so nothing invented is left on the phone and the next visit starts clean. The
  line says so before the tap ("Changes here are forgotten when you leave") and the next page confirms it.
- **A changed copy older than 30 days is started over without asking.** It is a pretend plan, its dates have drifted,
  and the line has said all along that changes are not kept. An untouched copy is simply made again each day.
- **The Get started row opens the family with children** directly; the other two are one tap away in Help's answer
  (the design's three chips live there). It shows only on a plan with nothing in it and never inside a pretend family.
- **After Leave, the phone's Back steps into the pretend family again** (a fresh copy, with its line). Left as it is:
  the earlier pages of the visit are in the phone's history with the pretend address, and the app does not rewrite history.
- **No plans imported from `qa/`**: `core/` is what the static site runs; the plans are copied, as the design says.
- **Bank and brand names are left out** of the plans (the qa fixtures name real banks; a public demo should not).
- **Unknown family name -> the first family**, not an empty sandbox: a mistyped or old link still shows something.
- The existing Help answer "Can I try something without changing my plan?" told people to type `?sandbox=1` into the
  address. The new answer replaces it (one question, not two that sound alike) and keeps its pointer to the What-if
  scenarios pages.

## Tests
`tests/demo.test.mjs`: every function above; each plan is whole, unchanged by `migrate()`, dated today, with the same
ages on four different days; every page's `compute` runs on every family; nothing real in `core/demo/`; and the store:
enter, change, save, reload, leave with the real plan, its waiting mark and a tester's pretend plan byte-identical and
no request to the home computer; a first-time phone is still a first-time phone afterwards; families do not mix;
without `demo` the store behaves as before (the invariance); the line and "Leave"; a fetch that fails writes nothing
and the next open has the family; a copy from an earlier day (untouched, changed, changed and over 30 days, fetch
failing); every pretend loan's term against its balance; the words after Leave and the note in the tab; the Dashboard's
button inside a pretend family; the row on Get started.
`modules/system/help/module.test.mjs`: the answer's sentences in both cases and the three choices.

## Ideas / not yet
- A fourth household (retired, drawing down) once the three are seen to be used.
