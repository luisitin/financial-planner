# H-1145  High net worth, two teens, rental property · One account of every type
- type: 12-high-net-worth   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 12-high-net-worth/accounts/H-1145-every-account-type.md`

**Household.** Victoria, 52, and Henry, 55; Chloe (17) and Ben (15); $1.8M brokerage, a rental, a large mortgage they overpay, crypto and art.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Victoria | Me | 1974-09-09 | 52 | 65 | 95 | no | 13 | 43 |
| Henry | Partner | 1971-01-01 | 55 | 65 | 95 | no | 10 | 40 |
| Chloe | Dependent | 2009-07-21 | 17 | - | 95 | - | - | 78 |
| Ben | Dependent | 2010-10-10 | 15 | - | 95 | - | - | 80 |
- filing: married_joint   state: NJ   plan horizon: 43 years

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

## Income (4)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Victoria's salary | salary | Victoria | $22,000 | every month | 5% | yes | - | - |
| Henry's salary | salary | Henry | $15,000 | twice a month | 3% | yes | - | - |
| Rental condo income | rental | Household | $3,800 | every month | 3% | yes | - | - |
| Dividends | investment | Household | $9,000 | every three months | - | yes | - | - |

## Expenses (14)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $3,900 | every month | yes (default) | no | - | - |
| Property taxes | taxes | $32,000 | once a year | yes (default) | yes | - | - |
| Utilities | utilities | $650 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $400 | every week | yes (default) | yes | - | - |
| Private school | childcare | $58,000 | once a year | yes (default) | yes | - | - |
| Cars and gas | transport | $900 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $4,800 | every three months | yes (default) | yes | - | - |
| Health | health | $700 | every month | yes (default) | yes | - | - |
| Phones | phone | $260 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $190 | every month | no (default) | yes | - | - |
| Dining | dining | $1,800 | every month | no (default) | yes | - | - |
| Travel | travel | $40,000 | once a year | no (default) | yes | - | - |
| Giving | giving | $2,000 | every month | no (default) | yes | - | - |
| Housekeeper | personal | $1,600 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Lake house | $600,000 | 2031-06-01 | 2 | $0 | - | $5,000 | 6% | yes |
| Chloe's college | $320,000 | 2027-08-15 | 1 | $0 | - | $3,000 | 4% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 4 (2 adults, 2 dependents); 13 years until Victoria retires (2039); plan must last 43 years
- **Income**: $58,800/mo, $705,600/yr, next year $730,968; by person: Victoria $22,000/mo (37%), Henry $30,000/mo (51%), Household $6,800/mo (12%)
- **Expenses**: $26,167/mo, $314,000/yr; must-pay $17,243, nice-to-have $8,923; left over $32,633 (55% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.2 months of must-pay (0.1 of all spending); target $103,460 (6 months), gap $100,160, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $0 of $1,017,534; needed $40,083/mo vs $8,000/mo going in
  - Lake house: behind; $0 of $688,745, 56 months left, needs $10,688/mo, putting in $5,000/mo (rate 6%)
  - Chloe's college: behind; $0 of $328,789, 11 months left, needs $29,395/mo, putting in $3,000/mo (rate 4%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-victoria","name":"Victoria","role":"self","birthDate":"1974-09-09"},{"id":"p-henry","name":"Henry","role":"partner","birthDate":"1971-01-01"},{"id":"p-chloe","name":"Chloe","role":"dependent","birthDate":"2009-07-21"},{"id":"p-ben","name":"Ben","role":"dependent","birthDate":"2010-10-10"}],"filingStatus":"married_joint","state":"NJ"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-victoria","name":"Victoria's salary","type":"salary","personId":"p-victoria","amount":22000,"period":"monthly","growth":0.05,"taxable":true},{"id":"i-henry","name":"Henry's salary","type":"salary","personId":"p-henry","amount":15000,"period":"semimonthly","growth":0.03,"taxable":true},{"id":"i-rent","name":"Rental condo income","type":"rental","personId":"","amount":3800,"period":"monthly","growth":0.03,"taxable":true},{"id":"i-div","name":"Dividends","type":"investment","personId":"","amount":9000,"period":"quarterly","growth":0,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":3900,"period":"monthly","inflates":false},{"id":"e-tax","name":"Property taxes","category":"taxes","amount":32000,"period":"annual","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":650,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":400,"period":"weekly","inflates":true},{"id":"e-school","name":"Private school","category":"childcare","amount":58000,"period":"annual","inflates":true},{"id":"e-cars","name":"Cars and gas","category":"transport","amount":900,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":4800,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":700,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":260,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":190,"period":"monthly","inflates":true},{"id":"e-din","name":"Dining","category":"dining","amount":1800,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":40000,"period":"annual","inflates":true},{"id":"e-give","name":"Giving","category":"giving","amount":2000,"period":"monthly","inflates":true},{"id":"e-help","name":"Housekeeper","category":"personal","amount":1600,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-lake","name":"Lake house","icon":"🏖️","target":600000,"targetDate":"2031-06-01","priority":2,"saved":0,"fundedBy":[],"monthly":5000,"rate":0.06,"inflates":true},{"id":"g-chloe","name":"Chloe's college","icon":"🎓","target":320000,"targetDate":"2027-08-15","priority":1,"saved":0,"fundedBy":[],"monthly":3000,"rate":0.04,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
