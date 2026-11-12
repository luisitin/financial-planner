Goal seek and Sensitivity stop treating a higher return as a fix

What the person sees (owner's request 2026-11-11: when the plan falls short, show what drives
the answer and let the person check it; "it's got to be valuable"), with the critics' fix round 1
(2026-11-12) folded in, shown simple first (owner, 2026-11-12: "default to less is more and allow
more complexity or toggles"):
- Goal seek: "The return it needs" is no longer a card with an Assumptions button. It is one short
  grey line under the changes, set against the forecasts for the plan's own mix and saying whose
  figure it is: "For the plan to work as it is, investments would have to grow about 10.4% a
  year, against the 5.8% a year we use. Most forecasts for a mix like the plan's are lower: about
  4.9%-6.5% a year (Vanguard). That isn't a choice you can make; the cards above are." (Jamie).
  What the 5.8% is made of (7% for stocks and 4% for bonds, our usual figures unless you change
  them), the two ranges and their date are one tap away in "How it is worked out". A plan that
  does not need growth gets no figure: "Your plan does not depend on how investments grow: it
  gets there even if they lost money every year." (a retired couple read "-9.2% ... 15.0
  percentage points"). Under it, one outlined "What matters most? ›".
- Goal seek: the saving card names a 401(k) that holds money with nothing going in, and its amount
  is now what typed into that 401(k) gets there: "Put about $790 a month into Casey's plan at
  work. Less would do if Casey's job adds some. It holds $48,000, but nothing goes into it now
  (you said so)." (it said $670, solved into savings: $670 typed into the 401(k) still ran out).
  When the person has not said so, it ends "If some of each paycheck does go in, add it on
  Retirement contributions." At the year's limit: "Put about $2,040 a month into the Hospital
  403(b), the most allowed in 2026, and $1,290 more into other savings, such as a brokerage
  account." Typed, the card reads "just right".
- Goal seek: the Social Security card on a short plan says what that age does to the headline:
  Robin "claiming at 70 alone makes the money last" ("needs a change"); Jamie "lets the plan pay
  about $110 a month more, steady ... At the $3,220 a month the plan spends, though, the money
  would run out in 2050 (age 68) instead of 2052 (age 70)" ("not on its own"). "Room to spare"
  only while the plan reaches the goal.
- Goal seek: the retirement card is never "room to spare" while the plan falls short, and "as
  early as" holds for every later age (Casey read "as early as 61" under "runs out in 2070").
- Sensitivity is now called "What matters most" (the first new name, "What changes your answer",
  was cut in the top bar at 390 px; both old names still find it). With nothing saved it says "We
  don't know yet" with one filled "Add what you own ›"; when the person told us (an empty 401(k),
  or "None"): "Nothing is saved for retirement yet, and nothing goes in ..." and "If Casey put in
  6.6% of pay (about $400 a month) plus the usual match, the plan could pay about $2,690 a month
  of the $3,090 it plans." When nothing goes in, "How much you save" is listed with its high end
  in money ("$400 a month + $240 match: $2,950") and one line: "Nothing goes in now. The high
  end: what people with pay like Casey's usually put in, plus the match most jobs add (Casey's
  job may differ). Still short of the $3,090 a month the plan spends."; the shares, the match's
  amount and the own money alone ($2,720) are behind the row's quiet "More about this". The
  headline says what to do ("If Maya put in 6.0% of pay (about $320 a month) plus the usual
  match, ... about $1,390 a month more"), never "nothing instead of nothing raises it by $0".
- What matters most shows the five numbers that move the plan most; the rest are one tap away
  under "5 more numbers" ("they move it less"), how to read the bars is a folded card, and the
  one way to the figures we use is inside it and says "Check the figures we use ›" (an outlined
  "Assumptions" button sat under a green "8.0%" bar). One outlined way on: "What it would take ›".
- Legacy goals no longer lists "The return it needs" among its changes.

Formulas and decisions:
- The return search is unchanged (stocks and bonds moved together, from 15 points below to 20
  above, shown as the blend on the plan's mix). The lever stays in `levers` with `info: true`
  (the Plan health score's test and Legacy goals read the list), with `line` and `more` (the
  line's detail for the fold). Forecast range on the mix m: m x stocks + (1 - m) x bonds at each
  end, Vanguard VCMM 10-year, U.S. equities 4.8%-6.8%, U.S. aggregate bonds 5.1%-6.1%, as of
  2026-09-30 (read 2026-11-11 and 2026-11-12). "Most forecasts ... are lower" only when the need
  shown is above the top as shown. "Your own figures" only when a return differs from the default
  or Assumptions was reviewed within 365 days (spec D-A3), else "we use". No figure when the need
  is at or below 0. Spec D-A7: returns are not a fix.
- Idle 401(k): type 401k, balance > 0, not formerJob and not named old/former/previous/prior/
  rollover, owner has pay today, no row putting money or a match in. Its saving answer: monthly
  rows on a copy of the plan into each idle 401(k) (lead adult first), no match, each at most
  deferralLimit(age in the year, year) (IRS Notice 2025-67), shown rounded down when it binds,
  the rest in a row with no account; run through buildInputs; a need rounds up to $10 and is
  checked as typed. `savingInto` "taxable" (the default for a caller asking `only` some levers,
  the health score's hint, whose words name no account) keeps the plain search.
- Claim card on a short plan: one more project() at the best age with the plan's spending:
  reaches the goal -> "needs", else "cannot" with the run-out year and age against now's.
- Retire card: while short, the search starts at the planned age (earliestRetireAge `from`); the
  year-by-year scan checks every age from the one found to the planned age (a gap: the first age
  after it that lasts). The engine's dependence of spending on the stop year is claude-c's.
- Gate: the projection's own savingsUnknown; "Nothing is saved" when a 401(k), IRA or Roth is on
  file or Get started's answer is "None" (nothingSaved).
- Saving row with nothing going in (usualSaving): own money = usualShare x job pay (Vanguard How
  America Saves 2026); at a plan at work at most the 401(k) limit, plus, unless the person said
  there is none, the usual match 0.04 x min(1, share / 0.06) x pay (matchTerms; typed Work
  benefits tiers when there are some); outside one, into the IRA (or a Roth IRA under the top of
  its income range, rothPhaseOut, a share of the limit inside it) up to the IRA limit for the age
  ($7,500 + $1,100 from 50), the rest in a row with no account; people aged 16 to their
  retirement age only. Run as contribution rows on a copy of the plan (said = done). Spec D-A4,
  D-A5. The headline (heroLine) leaves out an end that is the plan as it is or moves it by under
  $5 a month.
- Simple first: five rows before the fold (no fold for a single row); a row's detail (`more`)
  and the reading help are folds; opening or closing changes no figure and never the plan.
- No engine change, no schema change; golden keys untouched.

view.js touched: modules/scenarios/goal-seek/view.js, modules/scenarios/sensitivity/view.js,
modules/estate/legacy/view.js

Agent: claude-b
Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS
