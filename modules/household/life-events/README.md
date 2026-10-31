# Life events  (`household/life-events`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Guides you through marriage, a baby, a job change, a move, an inheritance or divorce and proposes the plan
changes each brings.

Pick what is happening and its day; the page lists the steps in order, with the deadlines that follow from that day,
links to the page for each, and ticks. The plan changes a step offers are made only when the person fills the small
form and taps the button (AGENTS.md rule 5: nothing reaches the plan without a tap); a removed event keeps the changes
already made.

## Inputs
Plan sections read (`needs`): `household` (people, filing status, state), `income` (salaries, for "update pay"),
`accounts`, `lifeEvents`. Writes (`writes`): `lifeEvents`; on a tap, `household.people` (a partner or child),
`household.filingStatus`, `household.state`, `income` (pay), `accounts` (an inherited account).
A stored event: `{ id, kind (marriage|baby|job|move|inheritance|divorce), date, done: { [stepKey]: "YYYY-MM-DD" },
startedAt }`.
Parameters accepted by `compute(plan, params)`: `today`.

## Outputs
`compute(plan, { today })` -> `{ kinds: [{ kind, label, icon, intro, started }], events: [eventView] (newest day first),
urgent: [{ event, step }] (late or within 14 days, soonest first), states, filingStatuses }`.
`eventView(plan, event, today)` -> `{ id, kind, label, icon, date, dateLabel, intro, steps: [{ key, text, go, change,
deadline, daysLeft, done, doneOn, auto, state }], done, total, next }`.
Also exported: `startEvent`, `setEventDate`, `removeEvent`, `setStep`, `applyChange`, `SOON_DAYS`; `data/events.js`
holds `EVENTS` (the steps).

## Rules and sources
- **Deadline** = the event's day + the step's days (`days`), or December 31 of the event's year + 10 (`year10`, the
  inherited IRA); **days left** = deadline − today (`daysBetween`); **state**: done (ticked, or the plan already has
  it), late (days left < 0), soon (0 to 14, `SOON_DAYS`, the builder's choice), open.
- **Already in the plan** (`auto`): a partner on People; a married filing status; a dependent born within 60 days of
  a baby event's day; head of household; single or head of household after a divorce. These show ticked and cannot be
  unticked here.
- The deadlines and rules each step states, all read 2026-10-31 (the sources are listed again in `data/events.js`):
  - Health cover at work: at least 30 days after a marriage, birth or adoption to add someone (HIPAA special
    enrollment; U.S. Department of Labor, *Protections for Newborns, Adopted Children, and New Parents*,
    https://www.dol.gov/node/63379).
  - Health insurance bought on the Marketplace: 60 days after a marriage, birth or adoption, a move, or losing job
    cover (HealthCare.gov, *Getting health coverage outside Open Enrollment*,
    https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/).
  - COBRA: at least 60 days to choose; after a divorce, tell the plan within 60 days, up to 36 months of cover (U.S.
    Department of Labor, *A Worker's Guide to Health Benefits Under COBRA* and its COBRA FAQs for workers).
  - Filing status: your marital status on December 31 counts for the whole year (IRS Publication 501).
  - Rollovers: 60 days to put money paid to you into the new account; a direct rollover avoids the 20% withholding
    (IRS, *Rollovers of retirement plan and IRA distributions*).
  - Inherited IRA: most beneficiaries other than a spouse empty it by December 31 of the year containing the 10th
    anniversary of the death (IRS Publication 590-B, whose example is a 2025 death emptied by December 31, 2035).
  - Inherited property's tax cost is generally its value on the day of death (IRS, *Gifts & inheritances* FAQ;
    Publication 551).
  - Splitting a workplace plan in a divorce needs a qualified domestic relations order (U.S. Department of Labor,
    *QDROs*); an IRA moved under the divorce decree is not taxed (IRC 408(d)(6); IRS Publication 590-A).
  - A baby's Social Security number can be applied for at the hospital (SSA); a change of address goes to the IRS on
    Form 8822.
- **Plan changes** (`applyChange`, each ticks its step): add a partner (name, birth date) or a child (dependent);
  filing status married filing jointly, head of household, or single / head of household after a divorce; the state
  (a two-letter state from `household/people` `US_STATES`); pay (an existing salary changed in place: amount, how
  often, first payday; or a new salary); an inherited account (name, kind, value; dated today, noted "Inherited").
  Each is refused with a reason when what it needs is missing; the view runs it on a copy first to show that reason.

## Edge cases
- No events: a hero with the six events to pick from; afterwards they sit under "Something else happening?".
- The single-parent filing step shows only for a single (or unset) filing status.
- An event with no valid day has no deadlines; its day can be set or changed at the top of the event.
- Removing an event removes its ticks only; the people, pay and accounts it added stay (the confirm says so).
- Several events at once: "Coming up" lists every late or soon step across them.

## Tests
`module.test.mjs` (5): every step well formed (links to built pages, known changes, unique keys); deadlines (30 and 60
days, the 10th-year December 31 with the IRS example, late, soon, open, the urgent list, newest first); ticks, steps
already in the plan, the next step, the single-parent step, a child born near the day; every plan change and its tick;
starting, re-dating, removing, unknown kinds, the empty plan.

## Ideas / not yet
- More events: retiring, losing a partner (survivor benefits, qualifying surviving spouse status), a child leaving
  home, a disability.
- Put an event's deadlines on the Money calendar.
