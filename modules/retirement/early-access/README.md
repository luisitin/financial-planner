# Money before 59½  (`retirement/early-access`)

**Status:** usable (gap design #38, 2026-11-14)
**Purpose:** What taking money out of a 401(k) or IRA early costs in your plan, and three ways around the extra tax.

The extra 10% itself is charged by the year-by-year engine (`core/math/retirement.js`, input `early`), so Will the money
last? and every page that runs the plan count it. This page reads those years and says them, and lets a person count equal
yearly payments (the tax code's 72(t) payments) in the plan.

## Inputs
Plan sections read (`needs`): `household` (birth dates, each adult's own `retirementAge`), `accounts` (401(k)s and IRAs with
their owners), `retirement`, `assumptions`. Written: `retirement.early.sepp` only.

`retirement.early?: { sepp?: { accountId, startYear, method: "amortization" | "rmd", rate, yearly? } }` (optional; absent
means nothing is set). `yearly` is the fixed payment of a series that began before this year (typed by the person; never
more than the account holds: a larger figure is not written, and a stored one is not read).
`compute(plan, { today })`.

## Outputs
`compute()` returns `{ kind, year, retireYear, lastHalf, people[], kinds, tax, charged, spared, seppPaid, firstCharged,
failYear, roth, years[], accounts[], notOffered[], sepp, suggest, without, missing[] }` (field by field in `compute.js`). Amounts are in
today's dollars. `kind` is the case the answer is written for:

| kind | when |
|---|---|
| `unknown` | the plan cannot run yet (`missing` says what it needs) |
| `none` | no 401(k) or traditional IRA on file |
| `past` | every owner of one is past 59½ |
| `after` | work stops after 59½ and nothing comes out before |
| `bridge` | work stops before 59½; cash and taxable savings carry the years and nothing pre-tax comes out |
| `free` | pre-tax money comes out before 59½ and none of it owes the 10% (the age-55 rule, equal payments) |
| `charged` | pre-tax money comes out before 59½ and owes the 10% |

Words: `answerWords` (one sentence per kind), `at55Words`, `equalWords` (the three rows), `ruleWords` (the rule that the
payments must go on and the account be left alone, to the date it lets go, by case: 59½ later, the five years later, both in
one year; and, for a 401(k), that the job must have ended), `methodWords`, `yearlyCheckWords` (a typed amount above a fifth of the account),
`notOfferedWords` (a 401(k) left off the chips), `tooSoonWords` (a 401(k) series saved to start while its owner works), `savedWords` (the
green line after a save). Writers: `setSepp`, `clearSepp`.

## Formulas

**The extra 10%** (engine, `core/math/retirement.js`; helpers in `core/math/early.js`). In each year:

    D        = what comes out of the pre-tax bucket - the required withdrawal - the equal payment
    owes     = sum over adults who own a 401(k) or IRA of
                 before(adult, year) x that adult's share of the pre-tax money x (1 - at55Part once they have left)
    earlyTax = 10% x D x owes          (added to the year's tax, so it is paid out of savings like the rest of it)

- `before(adult, year)`: 1 in a year wholly before the day they reach 59½, the share of the year's days before that day in
  the year it falls in, 0 after (`shareBefore59Half`, `halfYear`). 59½ is the birth date plus 59 years and 6 months; when
  that month is too short for the day (born August 29 to 31, or on the 31st of March, May, October or December), its last
  day: born August 31, 1967 reaches 59½ on February 28, 2027 (58 of that year's 365 days before it). The Federal estimate's
  copy has the same line.
- An adult's share of the pre-tax money: their own 401(k)s and IRAs, followed in dollars year by year (the same slices the
  engine keeps for required withdrawals: contributions in, required withdrawals out). Life-insurance cash value sits in the
  same bucket and owes none.
- `at55Part`: the part of that adult's pre-tax money in a 401(k), counted from the year they leave work, only when the plan
  holds their own retirement age and it is 55 or more (`leftAt55Year`). This is the Federal estimate's `leftWorkAt55` rule
  (`modules/taxes/federal/known.js`), written again in `core/math/early.js` because that file imports the projection (a
  cycle) and `core/` imports no module; the module test holds both pairs of functions to the same answer over a grid.
- Because the 10% is tax, more has to come out to pay it, and that is charged too: with no income tax, spending S needs
  W = S / (1 - 0.1 x owes) from pre-tax money (test: $40,000 needs $44,444.44, of which $4,444.44 is the 10%).
- A Roth conversion is not a withdrawal and owes none. Money from the Roth bucket is taken as tax-free at any age (as the
  engine always has; see "Not counted").

**Equal payments, the same each year** (`seppAmortized`; the fixed amortization method):

    P = B x r / (1 - (1 + r)^-n)        n = the Single Life Table's figure at the age reached in the first year

B is the account's balance going into the first year (as the plan projects it), r the chosen interest rate. Worked once and
kept. A series that began in an earlier year with no amount typed has no first-year balance on file, so the plan works its
own figure from today's balance at the age reached this year, and `methodWords` says exactly that ("the amount fixed then
is not on file ... the plan uses its own figure from what the account holds today"), with this year's age and table figure,
never those of the year it began. By hand: $500,000 at 5% from age 52, n = 34.3: 1.05^34.3 = 5.33080, so P = 25,000 / (1 - 1/5.33080) = $30,772.60.

**Equal payments, recalculated each year** (`seppRecalculated`; the required minimum distribution method):

    P(t) = B(t) / n(t)                  B(t) the account's balance going into year t, n(t) the table's figure at that age

**The rate** (`seppRateCap`): at most the greater of 5% and 120% of the federal mid-term rate for either of the two months
before the first payment. The app does not hold the monthly federal rate: the chips are 3%, 4% and 5%, and "Type my own"
takes up to 10% with a line that says a rate above 5% is allowed only when a rate the IRS publishes each month is at
least that high (the page names it once, as what to look up).

**A typed yearly amount** (a series already running): at most what the account holds today (`setSepp`, `seppOf` and the
box's own limit; a figure above it is a slip, and the engine would otherwise pay the whole account out in one year). Above
a fifth of the account (`SEPP_YEARLY_CHECK`, our own line: at 10% interest a new series at 59 is under 11% of the account)
it is counted as typed, the part opens saying "1 to fix", and an amber line says how soon the account would be empty.

**How long** (`seppLastYear`, `seppEnd`): the payments run to the later of five years from the first one and the day the owner
reaches 59½. The plan counts one payment a year from `startYear` to `max(startYear + 4, the last calendar year with days
before 59½)`. The rule holds the account to the later of the first payment's fifth anniversary, which falls in
`startYear + 5`, and the 59½ day (`seppEnd` -> `{ year, by: "five" | "half" | "either" }`): until then nothing else may come
out of it or go into it. The IRS's own example (Q&A 13): born August 15, 1968, first paid December 1, 2024, "may not take a
distribution that is not part of the SoSEPP or modify the annual amount until December 1, 2029" (five payments, 2024 to
2028); the same person first paid in 2020 is held until February 15, 2028. Changed, stopped or added to sooner, the 10% is
owed on everything taken out that year and comes back on every earlier payment, with interest (Q&A 9: "the 10% additional
tax under Section 72(t)(1) on the total distributions in the calendar year" and "a recapture tax ... for the prior years of
the SoSEPP ..., plus interest for the deferral period"; `ruleWords` says both; the plan does not model a broken series).
Corrected 2026-11-14: `ruleWords` said "through" the last counted year, which, when the five years end last, is a year
before the anniversary; it now says the anniversary falls "the year after the last yearly payment" (critic P2: "a day in
2032" under payments "2027 to 2031" read as a slip). It said only that the 10% "comes back on every payment already made"
(critic M1: that year's own withdrawals owe it too). The help under "Which account pays them" said "Best an account you
add nothing to and take nothing else from", where the rule says nothing may (Notice 2022-6 section 3.02(e); Q&A 2).

**From a 401(k)** the first payment must come after leaving the job of the employer that keeps the plan (Q&A 2: "the
taxpayer must be separated from service with the employer maintaining the plan before the payments begin"; IRS Topic 558).
The plan takes every 401(k) to be the job's that stops at the age on People, as for the age-55 rule, and decides who is at
work in a year by the projection's one work rule (`workRule`: People's ages, Get started's answers, pay on Income). So a
401(k)'s `firstStart` is the first year from this one its owner is not at work: the chips and the "Type my own" box offer
no earlier year, and a 401(k) whose owner is at work until past the last year before 59½ is not offered at all (one line
says why, `notOfferedWords`). A partner with no pay and no answer is not at work by that rule, so their 401(k) can start
this year. A series saved earlier that the plan pays while its owner is still at work (People moved the stop, or it was
saved before this rule) is counted as saved, and the part opens saying "1 to fix" with an amber line naming the first year
that is allowed (`tooSoon`, `tooSoonWords`). The suggestion in the third row starts a 401(k) at the later of its
`firstStart` and the household's retirement. (Critic P1, 2026-11-14: "This year, 2026" was offered for, and counted on, the
401(k) of someone at work until 2031, beside the sentence that a 401(k) pays them only after its job ends, and a partner's
401(k) started in the household's year whatever that partner's own stop.)

**In the engine** the equal payment comes out of the pre-tax bucket whether the year needs it or not, like a required
withdrawal: it is taxed as income, owes no 10%, and what the year does not need lands in taxable savings. The account's own
balance is followed apart (it grows with the plan's return and falls by its payments).

### Sources and read dates
Every rule below was re-read at its official source on 2026-11-14, with the words quoted; "How this is worked out" names the
sources with that date.
- The 10% on the taxable part, which accounts owe it, and the exceptions the page uses: IRS, "Retirement topics - Exceptions
  to tax on early distributions" (www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions,
  page dated 2026-11-13, marked "historical"), IRS Topic no. 558 (www.irs.gov/taxtopics/tc558, 2026-11-09), Topic no. 557
  (www.irs.gov/taxtopics/tc557), Publication 575 (www.irs.gov/publications/p575) and the Form 5329 instructions
  (www.irs.gov/instructions/i5329). Quoted: "Individuals must pay an additional 10% early withdrawal tax unless an exception
  applies"; "10% of the portion of the distribution that's includible in gross income"; age-55: "the employee separates from
  service during or after the year the employee reaches age 55 (age 50 for public safety employees ...)", qualified plans
  "yes", IRAs "no". That page is marked "historical", and Topic 558 says only "after attainment of age 55", so the "in or
  after the year" reading rests on two current IRS texts, both for 2025 and updated 2026-04-30: Publication 575, "From a
  qualified retirement plan after your separation from service in or after the year you reached age 55" and "you must have
  separated from service in or after the year in which you reach age 55", and the Form 5329 instructions, exception 01,
  "after separation from service when the separation from service occurs in or after the year you reach age 55 (age 50 for
  qualified public safety employees and private sector firefighters) or 25 years of service under the plan, whichever is
  earlier" (critic M4, 2026-11-14). Publication 575's George, who left at 49 and drew at 55, does not qualify (so "No help as
  planned" for a stop before the year of 55 is right). The plan's own copy of these rules is the Federal estimate's (`modules/taxes/federal/known.js`).
- Equal payments, the two methods, the tables allowed, the account balance, the rate cap, what counts as a change and how
  long: IRS Notice 2022-6 (www.irs.gov/pub/irs-drop/n-22-06.pdf), sections 2.04, 3.01(a) and (b), 3.02(a), (c), (d), (e), 3.03;
  and the IRS page "Substantially equal periodic payments" (www.irs.gov/retirement-plans/substantially-equal-periodic-payments,
  updated 2026-07-23), Q&A 1, 2, 4, 5, 7, 9, 10, 11 and 13. Quoted: the rate is "not more than the greater of (i) 5% or (ii)
  120% of the federal mid-term rate ... for either of the two months immediately preceding the month in which the
  distribution begins" (3.02(c)), which is why the rate is an input with 5% as the labelled most and no monthly rate is held;
  the years are "the entry from the table for the employee's age on the employee's birthday in the first distribution year"
  (3.02(a)). The IRS's worked figures are tests: Bob, 50, $400,000 at 4% over 36.2 years, $21,102; the RMD method $11,050 and
  then $408,304 / 35.3 = $11,567; Sam's $810,250 / 31.6 = $25,641.
- The Single Life Table: `core/math/rmd.js` `SINGLE_LIFE`, all 121 ages compared by script on 2026-11-14 with IRS Publication
  590-B (2025), Appendix B, Table I (www.irs.gov/pub/irs-pdf/p590b.pdf) and with 26 CFR 1.401(a)(9)-9(b) as printed in T.D.
  9930 (Internal Revenue Bulletin 2020-49, www.irs.gov/irb/2020-49_IRB). T.D. 10001 (2024) renamed the tables and left the
  figures. All agree.
- The five-year wait on each Roth conversion (the "ladder" row): Publication 590-B (2025), chapter 2, "Distributions of
  conversion and certain rollover contributions within 5-year period": "A separate 5-year period applies to each conversion",
  counted from "the first day of your tax year in which you convert". The row's "Five years later" rounds that up (a
  conversion made late in a year is free a little sooner). Said as a rule on the page; the plan does not count it.
- Not read at the source: the Internal Revenue Code's own text (its official hosts are not among those the build machine may
  reach); the sections are cited as the IRS pages and Notice 2022-6 quote them.

## First view and parts
Kind: answer. First view: the headline and one sentence for the case (`answerWords`), then, when anyone under 59½ owns a
401(k) or IRA, a card of three rows (the ways around it, each with where this household stands), then two shut rows, then
"More on this". One filled button at most: "Count equal payments" (when the 10% is charged and no payments are set; it
lands on the part by `?show=equal`), or, once payments are counted, "See Will the money last? ›" (the page whose answer
they changed). The households with nothing to take out early (`unknown`, `none`, `past`) see the
sentence and nothing else.

| part | kind and title | holds | status |
|---|---|---|---|
| `equal` | own, "Set my own numbers" | equal yearly payments: which account (chips; "Not counted" first), then the first year, how the amount is set ("Same each year" / "Recalculated each year"), the interest rate (3%, 4%, 5%, "Type my own"), the amount already taken for a series that began before this year, and "Stop counting them" | "not set yet", "set by you", "no account" |
| `how` | how, "How this is worked out" | the rule, when each person reaches 59½, the years with what came out and the 10% on it, what is not counted, the sources | "8 years" |

Every chip saves at once and says the new answer in a green line right under the box just tapped, with a link on to Will
the money last? ("Saved. The plan now takes about $19,536
a year from your IRA, 2028 to 2035. The extra 10% tax before 59½ falls from about $41,131 to about $21,596."); the part
stays open and no other opens (test "S11"). Opening or shutting writes nothing. (The line was first drawn at the top of
the part: on a 320 px phone that was above the screen, so the shell said it a second time in its floating note, over the
chips. Review fix, 2026-11-14.)

"More on this": "Will the money last?", "Which account should pay first?" (Withdrawal order), "What would moving money to a
Roth do?" (Roth conversions).

On Will the money last?: when the run charges the 10%, one line under the answer says so with its link ("This plan takes
money out of a 401(k) or IRA before 59½, which costs about $41,131 of extra tax. Ways around it ›"): a hint worth money, so
never folded. When retirement starts before 59½ but nothing is charged, the page is one more outlined link among the deeper
pages inside "N more numbers". Otherwise that page is unchanged, and it keeps its five rows that open.

Builder's choices (the design was silent, or the code had moved):
- **Each person's share of an early withdrawal is what they own of the pre-tax money**, as the Federal estimate splits this
  year's draw. The plan does not take the older partner's account first; Withdrawal order is by kind of account.
- **The spec's sentence "enough for 7 years" became "and they last"** with the year 59½ is reached: 52 to 59½ is seven and a
  half years and eight calendar years, and either count read wrong beside the other.
- **Chips that save, no form**: four small choices, each a real reference point; a Save button would have added a second
  filled button on the screen whenever the part is open.
- **The equal payments' part keeps the vocabulary title "Set my own numbers"** (docs/OPTIONAL.md R24: one `own` part on the
  page), and the third row says in plain words what it holds.
- **An IRA is suggested before a 401(k)** for equal payments: a 401(k) can pay them only once that job has ended.
- **An old 401(k) from a job already left** cannot be told apart from the job's that stops at the age on People, so it
  starts no sooner than that stop (the safe side: no 10% is spared that the rule might not spare). Most people roll such an
  account into an IRA; entered on Net worth as an IRA it can start this year.
- **The age-55 row never promises what the rule does not give.** Stopping before the year of the 55th birthday, it reads
  "No help as planned: you stop work at 52, before 2031, the year you turn 55. Stopping in 2031 or later would spare your
  401(k)". (It first read "From 55, your 401(k) would owe none", as if waiting were enough. Review fix.)
- **Plain words first.** The rows say "Move some to a Roth account each year" and "Equal yearly payments"; "72(t)" appears
  once, inside the part, as the name a tax preparer uses; the federal mid-term rate is "a rate the IRS publishes each
  month"; the sum is "the yearly amount that would use the account up over 34.3 years if it earned 5% a year".
- **`yearly`** was added to the design's four fields, so a series that began in an earlier year keeps its fixed amount
  instead of being worked out again from a later balance.
- **The link from Will the money last?** is not a "More on this" row there: that page has no such card and is at its five
  rows that open.

## Edge cases
- No birth date for an owner: no `early` input for them (nothing charged).
- An account with no owner belongs to the first adult, as for required withdrawals.
- Someone with no pre-tax balance yet who adds to a 401(k): their later share is followed from their contributions.
- Equal payments whose account is gone, empties, is not a 401(k) or IRA, starts after the owner's 59½, starts before the
  year the owner turns 25 (`SEPP_MIN_AGE`, our own line: a stored 1900 is a slip) or is already over:
  read as not set (`seppOf` returns null); the stored field is left for the person to change or remove.
- A what-if page that changes a retirement age inside the engine's inputs (not through the plan) keeps the plan's age-55
  flag; pages that change the plan and build the inputs again get the new one.

## Not counted
- Roth money is treated as tax-free at any age; growth taken out before 59½ can be taxed and owe the 10%.
- A Roth conversion ladder is described, not modelled.
- Every 401(k) is taken to be the job's that stops at the age on People (critic M2, 2026-11-14: a known simplification,
  said on screen). For the age-55 rule that can spare too much: the IRS rule reaches only the plan of the employer left in
  or after the year of 55 (Publication 575's George), so a 401(k) from a job left before that year still owes the 10%, and
  the plan does not charge it. For equal payments it errs the other way (see "From a 401(k)" above). Telling them apart
  would need a "from an earlier job" answer on each 401(k) on Net worth, which the design does not have.
- Public-safety workers (police, firefighters, emergency medical workers, corrections officers and some federal workers, and
  private-sector firefighters) may leave from the year they reach 50, or after 25 years of service under the plan if sooner
  (IRC 72(t)(10); Topic 558; Publication 575). Not built: the plan has no way to know someone's job, and the task that
  re-read it was not to widen the page. "How this is worked out" says it in one sentence; see "Ideas".
- A governmental 457(b) owes no 10%, except on money rolled into it from another kind of plan; a SIMPLE IRA in its first two
  years of taking part owes 25% instead of 10% (the IRS exceptions page). The plan has neither kind of account and charges 10%
  on every "401(k) / 403(b)" and IRA; "How this is worked out" says so, in words: "a government workers' 457(b) plan", "a
  small-business SIMPLE IRA" (critic P3, 2026-11-14: the bare names were jargon).
- The other exceptions (disability, death, medical bills, a first home, education, birth or adoption, and the newer ones).
- A broken series of equal payments (the 10% coming back with interest), the one allowed change of method, and the third
  (annuity-factor) method.
- State penalties (a few states add their own).

## Tests
`module.test.mjs`: the IRS's own worked examples (Q&A 7, 10 and 13: $21,102, $11,050, $11,567, $25,641, 59½ on February 15,
2028, the account held to 2029 or to February 2028); the rule's words in each case and for a 401(k); the 10% only on pre-tax draws under 59½ (flat tax and brackets; cash, taxable, Roth and a partner's
required withdrawal owe none); the age-55 rule in the engine and the plan's flag, with the grid against the Federal
estimate's functions; $500,000 at 5% by hand; the recalculated way year by year; five years against 59½; a payment bigger
than the year needs; a series already begun (words and amount agree; a first year before 25 is not read); a typed amount
above the account or above a fifth of it; the half-birthday of someone born on the 29th to 31st; `seppOf`, `setSepp`,
`clearSepp`; one test per case of the headline's sentence;
the three rows; the continuation rule's words (the 10% on that year's withdrawals too, and "the year after the last yearly
payment"); a 401(k)'s first year only once its owner has left the job, the 401(k) not offered when that is past 59½, and a
saved series that starts too soon (critic P1); each case of the green line; the first view (and no jargon on it), "S11"
(one green line, under the box tapped, with its link; the filled button once payments are counted), and what "How this is
worked out" holds. `modules/taxes/federal/module.test.mjs` ("gap #38 fix F1"): the Federal estimate charges the same 10% as
the run when equal payments start this year. `tests/early-invariance.test.mjs`: over every invented plan, the run with the new input is the run
without it, byte for byte, whenever no year reaches into pre-tax money before 59½ (today: every plan but the round 8 early retiree, 50 and living on an IRA, who is named in the test), and an empty
`retirement.early` is the field absent on every page that reaches the projection.

## Ideas / not yet
- Model the Roth conversion ladder (each year's conversion free of the 10% five years on).
- Take the older partner's account first when one of a couple is past 59½.
- A federal mid-term rate box, so the cap above 5% is checked rather than said.
- A "public-safety job" yes/no on People (or on this page), so the age-55 row and the engine use 50 (or 25 years in the plan)
  for that person's government plan.
