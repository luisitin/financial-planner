# H-0145  Couple, no kids, own a condo · One account of every type
- type: 02-couple-no-kids   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 02-couple-no-kids/accounts/H-0145-every-account-type.md`

**Household.** Priya, 34, and Tom, 36, two salaries, a mortgage, saving for a remodel and a baby.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Priya | Me | 1992-02-11 | 34 | 65 | 95 | no | 31 | 61 |
| Tom | Partner | 1989-10-03 | 36 | 65 | 95 | no | 29 | 59 |
- filing: married_joint   state: WA   plan horizon: 61 years

## Accounts (19)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $1,000 | 2026-09-15 | joint |
| Savings | savings | $2,000 | 2026-09-15 | joint |
| Cash | cash | $300 | 2026-09-15 | joint |
| Brokerage | brokerage | $4,000 | 2026-09-15 | joint |
| 401(k) | 401k | $5,000 | 2026-09-15 | joint |
| IRA | ira | $6,000 | 2026-09-15 | joint |
| Roth | roth | $7,000 | 2026-09-15 | joint |
| HSA | hsa | $800 | 2026-09-15 | joint |
| 529 | 529 | $900 | 2026-09-15 | joint |
| Crypto | crypto | $1,100 | 2026-09-15 | joint |
| Property | property | $200,000 | 2026-09-15 | joint |
| Vehicle | vehicle | $12,000 | 2026-09-15 | joint |
| Life cash value | cash_value_life | $3,000 | 2026-09-15 | joint |
| Other asset | other_asset | $1,500 | 2026-09-15 | joint |
| Card | credit | $2,500 | 2026-09-15 | joint |
| Loan | loan | $8,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $150,000 | 2026-09-15 | joint |
| Student loan | student_loan | $20,000 | 2026-09-15 | joint |
| Other liability | other_liability | $700 | 2026-09-15 | joint |

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Priya's salary | salary | Priya | $4,100 | twice a month | 4% | yes | - | - |
| Tom's salary | salary | Tom | $5,900 | every month | 2% | yes | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $2,150 | every month | yes (default) | no | - | - |
| HOA dues | housing | $380 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $210 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $175 | every week | yes (default) | yes | - | - |
| Gas and parking | transport | $240 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $1,050 | every three months | yes (default) | yes | - | - |
| Health | health | $180 | every month | yes (default) | yes | - | - |
| Phones | phone | $130 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $65 | every month | no (default) | yes | - | - |
| Eating out | dining | $450 | every month | no (default) | yes | - | - |
| Travel | travel | $5,000 | once a year | no (default) | yes | - | - |
| Fun | fun | $200 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Kitchen remodel | $25,000 | 2028-06-01 | 2 | $6,000 | - | $600 | plan default | no |
| Baby fund | $15,000 | 2027-09-01 | 1 | $2,000 | - | $400 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); 31 years until Priya retires (2057); plan must last 61 years
- **Income**: $14,100/mo, $169,200/yr, next year $174,552; by person: Priya $8,200/mo (58%), Tom $5,900/mo (42%)
- **Expenses**: $5,530/mo, $66,360/yr; must-pay $4,398, nice-to-have $1,132; left over $8,570 (61% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.8 months of must-pay (0.6 of all spending); target $26,390 (6 months), gap $23,090, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $8,000 of $40,000; needed $2,094/mo vs $1,000/mo going in
  - Kitchen remodel: behind; $6,000 of $25,000, 20 months left, needs $925/mo, putting in $600/mo (rate 2%)
  - Baby fund: behind; $2,000 of $15,000, 11 months left, needs $1,169/mo, putting in $400/mo (rate 2%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-priya","name":"Priya","role":"self","birthDate":"1992-02-11"},{"id":"p-tom","name":"Tom","role":"partner","birthDate":"1989-10-03"}],"filingStatus":"married_joint","state":"WA"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-priya","name":"Priya's salary","type":"salary","personId":"p-priya","amount":4100,"period":"semimonthly","growth":0.04,"taxable":true},{"id":"i-tom","name":"Tom's salary","type":"salary","personId":"p-tom","amount":5900,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2150,"period":"monthly","inflates":false},{"id":"e-hoa","name":"HOA dues","category":"housing","amount":380,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":210,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":175,"period":"weekly","inflates":true},{"id":"e-car","name":"Gas and parking","category":"transport","amount":240,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":1050,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":180,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":130,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":65,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":450,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":5000,"period":"annual","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":200,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-kitchen","name":"Kitchen remodel","icon":"🛋️","target":25000,"targetDate":"2028-06-01","priority":2,"saved":6000,"fundedBy":[],"monthly":600,"rate":null,"inflates":false},{"id":"g-baby","name":"Baby fund","icon":"👶","target":15000,"targetDate":"2027-09-01","priority":1,"saved":2000,"fundedBy":[],"monthly":400,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
