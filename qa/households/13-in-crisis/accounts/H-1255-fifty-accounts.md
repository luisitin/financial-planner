# H-1255  Job loss, cards at their limit, negative net worth · Fifty small accounts
- type: 13-in-crisis   pack: accounts   case: fifty-accounts
- status: fail (results/H-1255.json)   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 13-in-crisis/accounts/H-1255-fifty-accounts.md`

**Household.** Derek, 47, laid off in June; Tasha, 45, works; two kids; unemployment ends in December; spending is above income.

**The twist.** 50 extra accounts (every 5th a card).

**Why it matters.** Long list performance and layout.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Derek | Me | 1979-02-28 | 47 | 65 | 95 | no | 18 | 48 |
| Tasha | Partner | 1981-06-30 | 45 | 65 | 95 | no | 20 | 50 |
| Kai | Dependent | 2013-03-03 | 13 | - | 95 | - | - | 82 |
| Lily | Dependent | 2017-11-11 | 8 | - | 95 | - | - | 87 |
- filing: married_joint   state: MI   plan horizon: 50 years

## Accounts (59)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $640 | 2026-09-15 | joint |
| Savings | savings | $350 | 2026-09-15 | joint |
| Derek's old 401(k) | 401k | $31,000 | 2026-09-15 | Derek |
| Car | vehicle | $9,000 | 2026-09-15 | joint |
| Car loan | loan | $14,500 | 2026-09-15 | joint |
| Visa | credit | $11,000 | 2026-09-15 | joint |
| Mastercard | credit | $7,000 | 2026-09-15 | joint |
| Medical bills | other_liability | $4,200 | 2026-09-15 | joint |
| Loan from Tasha's dad | other_liability | $5,000 | 2026-09-15 | joint |
| Account 1 | savings | $100 | 2026-09-15 | joint |
| Account 2 | savings | $200 | 2026-09-15 | joint |
| Account 3 | savings | $300 | 2026-09-15 | joint |
| Account 4 | savings | $400 | 2026-09-15 | joint |
| Account 5 | credit | $500 | 2026-09-15 | joint |
| Account 6 | savings | $600 | 2026-09-15 | joint |
| Account 7 | savings | $700 | 2026-09-15 | joint |
| Account 8 | savings | $800 | 2026-09-15 | joint |
| Account 9 | savings | $900 | 2026-09-15 | joint |
| Account 10 | credit | $1,000 | 2026-09-15 | joint |
| Account 11 | savings | $1,100 | 2026-09-15 | joint |
| Account 12 | savings | $1,200 | 2026-09-15 | joint |
| Account 13 | savings | $1,300 | 2026-09-15 | joint |
| Account 14 | savings | $1,400 | 2026-09-15 | joint |
| Account 15 | credit | $1,500 | 2026-09-15 | joint |
| Account 16 | savings | $1,600 | 2026-09-15 | joint |
| Account 17 | savings | $1,700 | 2026-09-15 | joint |
| Account 18 | savings | $1,800 | 2026-09-15 | joint |
| Account 19 | savings | $1,900 | 2026-09-15 | joint |
| Account 20 | credit | $2,000 | 2026-09-15 | joint |
| Account 21 | savings | $2,100 | 2026-09-15 | joint |
| Account 22 | savings | $2,200 | 2026-09-15 | joint |
| Account 23 | savings | $2,300 | 2026-09-15 | joint |
| Account 24 | savings | $2,400 | 2026-09-15 | joint |
| Account 25 | credit | $2,500 | 2026-09-15 | joint |
| Account 26 | savings | $2,600 | 2026-09-15 | joint |
| Account 27 | savings | $2,700 | 2026-09-15 | joint |
| Account 28 | savings | $2,800 | 2026-09-15 | joint |
| Account 29 | savings | $2,900 | 2026-09-15 | joint |
| Account 30 | credit | $3,000 | 2026-09-15 | joint |
| Account 31 | savings | $3,100 | 2026-09-15 | joint |
| Account 32 | savings | $3,200 | 2026-09-15 | joint |
| Account 33 | savings | $3,300 | 2026-09-15 | joint |
| Account 34 | savings | $3,400 | 2026-09-15 | joint |
| Account 35 | credit | $3,500 | 2026-09-15 | joint |
| Account 36 | savings | $3,600 | 2026-09-15 | joint |
| Account 37 | savings | $3,700 | 2026-09-15 | joint |
| Account 38 | savings | $3,800 | 2026-09-15 | joint |
| Account 39 | savings | $3,900 | 2026-09-15 | joint |
| Account 40 | credit | $4,000 | 2026-09-15 | joint |
| Account 41 | savings | $4,100 | 2026-09-15 | joint |
| Account 42 | savings | $4,200 | 2026-09-15 | joint |
| Account 43 | savings | $4,300 | 2026-09-15 | joint |
| Account 44 | savings | $4,400 | 2026-09-15 | joint |
| Account 45 | credit | $4,500 | 2026-09-15 | joint |
| Account 46 | savings | $4,600 | 2026-09-15 | joint |
| Account 47 | savings | $4,700 | 2026-09-15 | joint |
| Account 48 | savings | $4,800 | 2026-09-15 | joint |
| Account 49 | savings | $4,900 | 2026-09-15 | joint |
| Account 50 | credit | $5,000 | 2026-09-15 | joint |

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Derek's old salary | salary | Derek | $5,900 | every month | - | yes | - | 2026-06-15 |
| Unemployment | other | Derek | $1,800 | every month | - | yes | - | 2026-12-15 |
| Tasha's pay | salary | Tasha | $3,600 | every month | 2% | yes | - | - |

## Expenses (11)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent | housing | $1,650 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $240 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $230 | every week | yes (default) | yes | - | - |
| Car payment | debt | $410 | every month | yes (default) | no | - | - |
| Card minimums | debt | $560 | every month | yes (default) | no | - | - |
| Gas | transport | $260 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $190 | every month | yes (default) | yes | - | - |
| COBRA health plan | health | $1,450 | every month | yes (default) | yes | - | - |
| Phones | phone | $130 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $45 | every month | no (default) | yes | - | - |
| Eating out | dining | $150 | every month | no (default) | yes | - | - |

## Debts (5 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Car loan | 8.9% | $410 | $0 | - |
| Visa | 27.9% | $250 | $0 | - |
| Mastercard | 25.9% | $160 | $0 | - |
| Medical bills | 0% | $100 | $0 | - |
| Loan from Tasha's dad | 0% | $0 | $0 | - |

## Goals (1)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| One month of bills | $5,000 | 2027-03-01 | 1 | $0 | Savings | $0 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 4 (2 adults, 2 dependents); 18 years until Derek retires (2044); plan must last 50 years
- **Income**: $5,400/mo, $64,800/yr, next year $65,664; by person: Derek $1,800/mo (33%), Tasha $3,600/mo (67%)
- **Expenses**: $6,082/mo, $72,980/yr; must-pay $5,887, nice-to-have $195; left over -$682 (-13% of income); warnings: spend 682 more than comes in
- **Net worth**: $71,790 = own $140,990 - owe $69,200; liquid $100,990; cash $100,990; invested $31,000 ($31,000 pre-tax, $0 tax-free, $0 taxable)
- **Emergency fund**: usable today $100,640, within a week $0, locked up $40,000; 17.1 months of must-pay (16.5 of all spending); target $35,320 (6 months), gap $0, status ok
- **Debts**: 15 debts, owed $69,200, paying $920/mo (required $920), interest $514/mo, avg rate 14.8%, DTI 17%, 10 without details
  - Car loan: owed $14,500, 8.9%, $410/mo, 42 months -> 2030-03-15, $2,380 interest to come
  - Visa: owed $11,000, 27.9%, $250/mo, never pays off, expensive
  - Mastercard: owed $7,000, 25.9%, $160/mo, 136 months -> 2038-01-15, $14,634 interest to come, expensive
  - Medical bills: owed $4,200, 0%, $100/mo, 42 months -> 2030-03-15, $0 interest to come
  - Loan from Tasha's dad: owed $5,000, 0%, $0/mo, no payoff (no payment)
  - Account 5: owed $500 (needs details)
  - Account 10: owed $1,000 (needs details)
  - Account 15: owed $1,500 (needs details)
  - Account 20: owed $2,000 (needs details)
  - Account 25: owed $2,500 (needs details)
  - Account 30: owed $3,000 (needs details)
  - Account 35: owed $3,500 (needs details)
  - Account 40: owed $4,000 (needs details)
  - Account 45: owed $4,500 (needs details)
  - Account 50: owed $5,000 (needs details)
- **Goals**: 1 goals, 0 reached; saved $350 of $5,000; needed $926/mo vs $0/mo going in
  - One month of bills: behind; $350 of $5,000, 5 months left, needs $926/mo (rate 2%)

## Also check
- [ ] page draws in under a second
- [ ] totals: +savings 40 x ... see expected
- [ ] no overflow
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-derek","name":"Derek","role":"self","birthDate":"1979-02-28"},{"id":"p-tasha","name":"Tasha","role":"partner","birthDate":"1981-06-30"},{"id":"p-kai","name":"Kai","role":"dependent","birthDate":"2013-03-03"},{"id":"p-lily","name":"Lily","role":"dependent","birthDate":"2017-11-11"}],"filingStatus":"married_joint","state":"MI"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":640,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":350,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Derek's old 401(k)","type":"401k","balance":31000,"asOf":"2026-09-15","ownerId":"Derek","institution":"","history":[]},{"id":"a-car","name":"Car","type":"vehicle","balance":9000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-carloan","name":"Car loan","type":"loan","balance":14500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Visa","type":"credit","balance":11000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mc","name":"Mastercard","type":"credit","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-med","name":"Medical bills","type":"other_liability","balance":4200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-fam","name":"Loan from Tasha's dad","type":"other_liability","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-1","name":"Account 1","type":"savings","balance":100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-2","name":"Account 2","type":"savings","balance":200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-3","name":"Account 3","type":"savings","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-4","name":"Account 4","type":"savings","balance":400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-5","name":"Account 5","type":"credit","balance":500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-6","name":"Account 6","type":"savings","balance":600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-7","name":"Account 7","type":"savings","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-8","name":"Account 8","type":"savings","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-9","name":"Account 9","type":"savings","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-10","name":"Account 10","type":"credit","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-11","name":"Account 11","type":"savings","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-12","name":"Account 12","type":"savings","balance":1200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-13","name":"Account 13","type":"savings","balance":1300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-14","name":"Account 14","type":"savings","balance":1400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-15","name":"Account 15","type":"credit","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-16","name":"Account 16","type":"savings","balance":1600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-17","name":"Account 17","type":"savings","balance":1700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-18","name":"Account 18","type":"savings","balance":1800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-19","name":"Account 19","type":"savings","balance":1900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-20","name":"Account 20","type":"credit","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-21","name":"Account 21","type":"savings","balance":2100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-22","name":"Account 22","type":"savings","balance":2200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-23","name":"Account 23","type":"savings","balance":2300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-24","name":"Account 24","type":"savings","balance":2400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-25","name":"Account 25","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-26","name":"Account 26","type":"savings","balance":2600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-27","name":"Account 27","type":"savings","balance":2700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-28","name":"Account 28","type":"savings","balance":2800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-29","name":"Account 29","type":"savings","balance":2900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-30","name":"Account 30","type":"credit","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-31","name":"Account 31","type":"savings","balance":3100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-32","name":"Account 32","type":"savings","balance":3200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-33","name":"Account 33","type":"savings","balance":3300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-34","name":"Account 34","type":"savings","balance":3400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-35","name":"Account 35","type":"credit","balance":3500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-36","name":"Account 36","type":"savings","balance":3600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-37","name":"Account 37","type":"savings","balance":3700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-38","name":"Account 38","type":"savings","balance":3800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-39","name":"Account 39","type":"savings","balance":3900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-40","name":"Account 40","type":"credit","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-41","name":"Account 41","type":"savings","balance":4100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-42","name":"Account 42","type":"savings","balance":4200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-43","name":"Account 43","type":"savings","balance":4300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-44","name":"Account 44","type":"savings","balance":4400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-45","name":"Account 45","type":"credit","balance":4500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-46","name":"Account 46","type":"savings","balance":4600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-47","name":"Account 47","type":"savings","balance":4700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-48","name":"Account 48","type":"savings","balance":4800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-49","name":"Account 49","type":"savings","balance":4900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-50","name":"Account 50","type":"credit","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-derek","name":"Derek's old salary","type":"salary","personId":"p-derek","amount":5900,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-06-15"},{"id":"i-ui","name":"Unemployment","type":"other","personId":"p-derek","amount":1800,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-12-15"},{"id":"i-tasha","name":"Tasha's pay","type":"salary","personId":"p-tasha","amount":3600,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1650,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":240,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":230,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":410,"period":"monthly","inflates":false},{"id":"e-cards","name":"Card minimums","category":"debt","amount":560,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":260,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":190,"period":"monthly","inflates":true},{"id":"e-health","name":"COBRA health plan","category":"health","amount":1450,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":130,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":45,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":150,"period":"monthly","inflates":true}],"debts":[{"id":"d-car","accountId":"a-carloan","rate":0.089,"minPayment":410,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.279,"minPayment":250,"extra":0},{"id":"d-mc","accountId":"a-mc","rate":0.259,"minPayment":160,"extra":0},{"id":"d-med","accountId":"a-med","rate":0,"minPayment":100,"extra":0},{"id":"d-fam","accountId":"a-fam","rate":0,"minPayment":0,"extra":0}],"goals":[{"id":"g-ef","name":"One month of bills","icon":"🛟","target":5000,"targetDate":"2027-03-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
