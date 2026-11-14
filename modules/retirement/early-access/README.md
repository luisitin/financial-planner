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
failYear, roth, years[], accounts[], sepp, suggest, without, missing[] }` (field by field in `compute.js`). Amounts are in
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
payments must go on), `methodWords`, `yearlyCheckWords` (a typed amount above a fifth of the account), `savedWords` (the
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

**How long** (`seppLastYear`): the payments run to the later of five years from the first one and the day the owner reaches
59½. With one payment a year from `startYear`: `max(startYear + 4, the last calendar year with days before 59½)`. Changed or
stopped sooner, the 10% comes back on every earlier payment, with interest (`ruleWords` says so; the plan does not model a
broken series).

**In the engine** the equal payment comes out of the pre-tax bucket whether the year needs it or not, like a required
withdrawal: it is taxed as income, owes no 10%, and what the year does not need lands in taxable savings. The account's own
balance is followed apart (it grows with the plan's return and falls by its payments).

### Sources and read dates
- 10% additional tax, the 59½ line, the age-55 separation rule (workplace plans, not IRAs), the equal-payments exception and
  its "later of five years and 59½" rule with recapture and interest: Internal Revenue Code section 72(t)(1), (2)(A)(i),
  (iv), (v), (3) and (4). The 10% and the age-55 rule are the ones the Federal estimate already uses (its README: IRS,
  "Retirement topics: exceptions to tax on early distributions", read 2026-11-06).
- The two methods, the Single Life Table as an allowed table and the rate cap: IRS Notice 2022-6 (sections 3.01 and 3.02)
  and the IRS page "Substantially equal periodic payments". The design's author read both on 2026-11-13 (the page said
  updated 2026-07-23). **The builder could not open irs.gov on 2026-11-14** (the build session's network does not allow
  the host); a web search that day confirmed the cap's wording ("the greater of 5% or 120% of the federal mid-term rate")
  from summaries of the notice, not from the notice itself. For that reason the rate is an input with a labelled example,
  never a figure the app asserts, and nothing here depends on a number that changes from year to year.
- The Single Life Table: `core/math/rmd.js` `SINGLE_LIFE` (26 CFR 1.401(a)(9)-9(b); IRS Publication 590-B Appendix B Table I;
  checked there on 2026-11-13).
- The five-year wait on each Roth conversion (the "ladder" row): IRC section 408A(d)(3)(F). Said as a rule on the page; the
  plan does not count it.

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
- An old 401(k) from an earlier job counts like the last job's for the age-55 rule; public-safety workers' age 50 is not known.
- The other exceptions (disability, death, medical bills, a first home, education, birth or adoption, and the newer ones).
- A broken series of equal payments (the 10% coming back with interest), the one allowed change of method, and the third
  (annuity-factor) method.
- State penalties (a few states add their own).

## Tests
`module.test.mjs`: the 10% only on pre-tax draws under 59½ (flat tax and brackets; cash, taxable, Roth and a partner's
required withdrawal owe none); the age-55 rule in the engine and the plan's flag, with the grid against the Federal
estimate's functions; $500,000 at 5% by hand; the recalculated way year by year; five years against 59½; a payment bigger
than the year needs; a series already begun (words and amount agree; a first year before 25 is not read); a typed amount
above the account or above a fifth of it; the half-birthday of someone born on the 29th to 31st; `seppOf`, `setSepp`,
`clearSepp`; one test per case of the headline's sentence;
the three rows; the continuation rule's words; each case of the green line; the first view (and no jargon on it), "S11"
(one green line, under the box tapped, with its link; the filled button once payments are counted), and what "How this is
worked out" holds. `modules/taxes/federal/module.test.mjs` ("gap #38 fix F1"): the Federal estimate charges the same 10% as
the run when equal payments start this year. `tests/early-invariance.test.mjs`: over every invented plan, the run with the new input is the run
without it, byte for byte, whenever no year reaches into pre-tax money before 59½ (today: every plan but the round 8 early retiree, 50 and living on an IRA, who is named in the test), and an empty
`retirement.early` is the field absent on every page that reaches the projection.

## Ideas / not yet
- Model the Roth conversion ladder (each year's conversion free of the 10% five years on).
- Take the older partner's account first when one of a couple is past 59½.
- A federal mid-term rate box, so the cap above 5% is checked rather than said.
