# H-0045  Single adult, renting · One account of every type
- type: 01-single-adult   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 01-single-adult/accounts/H-0045-every-account-type.md`

**Household.** Maya, 29, software support, one income, small savings, a car loan and one card.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (1: 1 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Maya | Me | 1997-05-04 | 29 | 65 | 95 | no | 36 | 66 |
- filing: single   state: CO   plan horizon: 66 years

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

## Income (1)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Maya's pay | salary | Maya | $2,450 | every two weeks | 3% | yes | - | - |

## Expenses (10)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent | housing | $1,450 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $120 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $90 | every week | yes (default) | yes | - | - |
| Car payment | debt | $310 | every month | yes (default) | no | - | - |
| Gas | transport | $160 | every month | yes (default) | yes | - | - |
| Car insurance | insurance | $95 | every month | yes (default) | yes | - | - |
| Phone | phone | $70 | every month | yes (default) | yes | - | - |
| Streaming | subscriptions | $40 | every month | no (default) | yes | - | - |
| Eating out | dining | $220 | every month | no (default) | yes | - | - |
| Fun | fun | $120 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (1)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $10,000 | 2027-12-31 | 1 | $0 | - | $250 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 1 (1 adults, 0 dependents); 36 years until Maya retires (2062); plan must last 66 years
- **Income**: $5,308/mo, $63,700/yr, next year $65,611; by person: Maya $5,308/mo (100%)
- **Expenses**: $2,975/mo, $35,700/yr; must-pay $2,595, nice-to-have $380; left over $2,333 (44% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 1.3 months of must-pay (1.1 of all spending); target $15,570 (6 months), gap $12,270, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 1 goals, 0 reached; saved $0 of $10,000; needed $659/mo vs $250/mo going in
  - Emergency fund: behind; $0 of $10,000, 15 months left, needs $659/mo, putting in $250/mo (rate 2%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-maya","name":"Maya","role":"self","birthDate":"1997-05-04"}],"filingStatus":"single","state":"CO"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-pay","name":"Maya's pay","type":"salary","personId":"p-maya","amount":2450,"period":"biweekly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1450,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":120,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":90,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":310,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":160,"period":"monthly","inflates":true},{"id":"e-ins","name":"Car insurance","category":"insurance","amount":95,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phone","category":"phone","amount":70,"period":"monthly","inflates":true},{"id":"e-sub","name":"Streaming","category":"subscriptions","amount":40,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":220,"period":"monthly","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":120,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":10000,"targetDate":"2027-12-31","priority":1,"saved":0,"fundedBy":[],"monthly":250,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
