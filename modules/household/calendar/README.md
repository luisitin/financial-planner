# Money calendar  (`household/calendar`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Puts your bills, paydays, tax deadlines, open enrolment, required minimum distribution dates and policy
renewals on one calendar.

A list by month rather than a grid: a month grid does not fit a 390 px phone with words in it. Next month, three months
or a year ahead; chips to show one kind; and the dates shown saved as a calendar file (`.ics`) the phone's calendar
opens (it does not update itself; the page says so).

## Inputs
Plan sections read (`needs`): `transactions` and `recurringIgnored` (bills and paydays through `cashflow/recurring`
`detectRecurring`), `income` (paydays when the bank lines show none; salary means W-2 forms), `accounts` (an IRA, Roth
or HSA; 401(k)s and IRAs for required withdrawals), `taxes.estimated.paid`, `household.people` (ages), `insurance.policies`
(`renewalDate`, `endDate`, health cover not through work), `retirement.aca`, `goals` (`targetDate`), `reminders`.
Writes (`writes`): `reminders` (`[{ id, name, date, repeat: none|monthly|yearly, amount, note }]`).
Parameters accepted by `compute(plan, params)`: `today`, `range` (`month` 31 days, `quarter` 92, `year` 366), `kinds`.

## Outputs
`compute(plan, { today, range, kinds })` -> `{ events: [{ date, kind, title, detail, amount, go, source }], months:
[{ month, events }], counts: { [kind]: n }, from, to, notes }`.
Also exported: `dueDay`, `taxHolidays`, `periodDates`, `toIcs`, `saveReminder`, `removeReminder`, `KINDS`, `RANGES`,
`REPEATS`; `data/dates.js` holds `MARKETPLACE` and `MEDICARE_OPEN`.

## Rules and sources
- **Bills and paydays**: each repeating series the Recurring page finds (and has not been dismissed), from its next date
  on, every step of its cadence (`nextAfter`); money in is a payday, money out a bill.
- **Paydays from Income** only when no repeating money in is found: salary, pension and Social Security entries with a
  start day, on their period from it (weekly 7 days, every two weeks 14, monthly the same day with short months
  clamped, quarterly, yearly); twice a month is shown on the 15th and the last day (a guess the page states). A salary
  with no start day gets a notice to add one.
- **Federal tax dates**, moved to the next business day when they fall on a Saturday, Sunday or legal holiday (IRC
  7503; IRS Publication 509, *Tax Calendars*):
  - W-2 forms from employers by January 31 (IRS, *General Instructions for Forms W-2 and W-3*), when there is a salary;
  - the return by April 15 (IRC 6072(a)), and October 15 with an extension (Form 4868 gives six months);
  - IRA and health savings account contributions for the year before by the return's due date without extensions (IRS
    Publication 590-A; Publication 969), when the plan has an IRA, Roth or HSA;
  - estimated payments on April 15, June 15, September 15 and January 15 (IRS Publication 505; the same days as
    `taxes/estimated` QUARTERS), only when payments were made this year or there is business or rental income.
  The holidays that can land on those days: Martin Luther King Jr. Day (third Monday of January, 5 U.S.C. 6103) and
  District of Columbia Emancipation Day (April 16; on a Saturday it is kept the Friday before, on a Sunday the Monday
  after; D.C. Code 1-612.02; IRS Notice 2011-17), and for a household in Maine or Massachusetts Patriots' Day (the
  third Monday of April; IRS Publication 509 for 2024: "April 15 (April 17 in Maine or Massachusetts)"). State tax dates
  are not shown (the page says to check the state). `tests/golden-tax-dates.test.mjs` checks the rule against due days
  the IRS published (2018, 2023, 2024, with Maine and Massachusetts).
- **Medicare open enrollment**: October 15 to December 7 every year (42 CFR 422.62(a)(2); Medicare.gov, *Open
  Enrollment*, https://www.medicare.gov/health-drug-plans/open-enrollment, read 2026-10-31), for anyone 65 or older by
  December 7.
- **Marketplace open enrollment**: only the plan years checked (`MARKETPLACE`): for 2027, November 1, 2026 to January
  15, 2027, with December 15 the last day for cover from January 1 (CMS, *Plan Year 2027 Marketplace Plans and Prices
  Fact Sheet*; HealthCare.gov, *When can you get health insurance?*; read 2026-10-31). Shown when a health policy is not
  through work or the Health care page has a benchmark premium. Add each new year from CMS's fact sheet.
- **Required withdrawals** (`core/math/rmd.js` `rmdStartYear`): the first by April 1 of the year after the starting
  age is reached, then by December 31 of each year after that (IRS, *Retirement plan and IRA required minimum
  distributions FAQs*), for each person who owns a 401(k) or traditional IRA with money in it (an account with no
  owner counts for a household of one adult).
- **Insurance**: a renewal day comes round each year from the one on file; an end date once.
- **Goals**: their target dates. **Your reminders**: once, every month or every year from their day.
- **The calendar file** (`toIcs`): iCalendar (RFC 5545): one all-day event a date (DTSTART as a date, DTEND the day
  after), commas, semicolons, backslashes and line breaks escaped, lines folded at 75 characters with a leading space.

## Edge cases
- Nothing dated in the stretch: a card saying how to get dates (import bank files, add renewals, add a reminder).
- The reminders form is open while there are none; with reminders it folds behind "+ Add another reminder".
- A one-off reminder in the past says when it was; a repeating one shows its next day.
- Every chip and link is 44 px tall; the list has no table, so nothing passes the right edge.

## Tests
`module.test.mjs` (6): due days (weekend, Emancipation Day observed on both sides, MLK Day, January 31 on a Sunday);
period dates (every two weeks, month-end clamping, twice a month, before the start, bad input); bills from the sample's
repeating rent and the tax dates for a salary and an IRA (with and without business or rental income); estimated
payments, Medicare and Marketplace windows, required withdrawals (ongoing and the first April 1), renewals coming round,
end dates, goals, the kind filter; paydays from Income, the missing-start notice and reminders; the calendar file.

## Ideas / not yet
- A subscribable calendar served by the PC server, so the phone stays up to date.
- State tax dates for the household's state.
- Debt payment due days once loans carry a due day.
