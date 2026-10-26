# H-0245  Single parent receiving child support · One account of every type
- type: 03-single-parent   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 03-single-parent/accounts/H-0245-every-account-type.md`

**Household.** Dana, 41, nurse, kids Leo (12) and Nia (7); $900/mo child support comes in untaxed.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (3: 1 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Dana | Me | 1985-08-30 | 41 | 65 | 95 | no | 24 | 54 |
| Leo | Dependent | 2014-03-12 | 12 | - | 95 | - | - | 83 |
| Nia | Dependent | 2018-11-02 | 7 | - | 95 | - | - | 88 |
- filing: head_of_household   state: GA   plan horizon: 54 years

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
| Dana's pay | salary | Dana | $3,300 | every two weeks | 3% | yes | - | - |
| Child support received | support | Dana | $900 | every month | - | no | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent | housing | $1,750 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $190 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $210 | every week | yes (default) | yes | - | - |
| After-school care | childcare | $650 | every month | yes (default) | yes | - | - |
| Car payment | debt | $340 | every month | yes (default) | no | - | - |
| Gas | transport | $200 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $140 | every month | yes (default) | yes | - | - |
| Health | health | $220 | every month | yes (default) | yes | - | - |
| Phones | phone | $95 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $45 | every month | no (default) | yes | - | - |
| Eating out | dining | $180 | every month | no (default) | yes | - | - |
| Kids' activities | fun | $150 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $12,000 | 2027-12-01 | 1 | $0 | - | $200 | plan default | no |
| Leo's college | $40,000 | 2032-08-15 | 2 | $0 | - | $150 | 6% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 3 (1 adults, 2 dependents); 24 years until Dana retires (2050); plan must last 54 years
- **Income**: $8,050/mo, $96,600/yr, next year $99,174; by person: Dana $8,050/mo (100%)
- **Expenses**: $4,870/mo, $58,440/yr; must-pay $4,495, nice-to-have $375; left over $3,180 (40% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.7 months of must-pay (0.7 of all spending); target $26,970 (6 months), gap $23,670, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $0 of $59,645; needed $1,409/mo vs $350/mo going in
  - Emergency fund: behind; $0 of $12,000, 14 months left, needs $848/mo, putting in $200/mo (rate 2%)
  - Leo's college: behind; $0 of $47,645, 71 months left, needs $561/mo, putting in $150/mo (rate 6%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-dana","name":"Dana","role":"self","birthDate":"1985-08-30"},{"id":"p-leo","name":"Leo","role":"dependent","birthDate":"2014-03-12"},{"id":"p-nia","name":"Nia","role":"dependent","birthDate":"2018-11-02"}],"filingStatus":"head_of_household","state":"GA"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-pay","name":"Dana's pay","type":"salary","personId":"p-dana","amount":3300,"period":"biweekly","growth":0.03,"taxable":true},{"id":"i-cs","name":"Child support received","type":"support","personId":"p-dana","amount":900,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1750,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":190,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":210,"period":"weekly","inflates":true},{"id":"e-after","name":"After-school care","category":"childcare","amount":650,"period":"monthly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":340,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":200,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":140,"period":"monthly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":220,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":95,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":45,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":180,"period":"monthly","inflates":true},{"id":"e-kids","name":"Kids' activities","category":"fun","amount":150,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":12000,"targetDate":"2027-12-01","priority":1,"saved":0,"fundedBy":[],"monthly":200,"rate":null,"inflates":false},{"id":"g-leo","name":"Leo's college","icon":"🎓","target":40000,"targetDate":"2032-08-15","priority":2,"saved":0,"fundedBy":[],"monthly":150,"rate":0.06,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
