# H-1294  Job loss, cards at their limit, negative net worth · Same household on 2027-01-15
- type: 13-in-crisis   pack: special   case: after-unemployment-ends
- status: fail (results/H-1294.json)   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 13-in-crisis/special/H-1294-after-unemployment-ends.md`

**Household.** Derek, 47, laid off in June; Tasha, 45, works; two kids; unemployment ends in December; spending is above income.

**The twist.** unemployment already ended.

**Why it matters.** Run with a later 'today': income 3,600.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Derek | Me | 1979-02-28 | 47 | 65 | 95 | no | 18 | 48 |
| Tasha | Partner | 1981-06-30 | 45 | 65 | 95 | no | 20 | 50 |
| Kai | Dependent | 2013-03-03 | 13 | - | 95 | - | - | 82 |
| Lily | Dependent | 2017-11-11 | 8 | - | 95 | - | - | 87 |
- filing: married_joint   state: MI   plan horizon: 50 years

## Accounts (9)
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

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Derek's old salary | salary | Derek | $5,900 | every month | - | yes | - | 2026-06-15 |
| Unemployment | other | Derek | $1,800 | every month | - | yes | - | 2026-09-01 |
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
- **Income**: $3,600/mo, $43,200/yr, next year $44,064; by person: Tasha $3,600/mo (100%)
- **Expenses**: $6,082/mo, $72,980/yr; must-pay $5,887, nice-to-have $195; left over -$2,482 (-69% of income); warnings: spend 2482 more than comes in
- **Net worth**: -$710 = own $40,990 - owe $41,700; liquid $990; cash $990; invested $31,000 ($31,000 pre-tax, $0 tax-free, $0 taxable)
- **Emergency fund**: usable today $640, within a week $0, locked up $40,000; 0.1 months of must-pay (0.1 of all spending); target $35,320 (6 months), gap $34,680, status bad
- **Debts**: 5 debts, owed $41,700, paying $920/mo (required $920), interest $514/mo, avg rate 14.8%, DTI 26%, 0 without details
  - Car loan: owed $14,500, 8.9%, $410/mo, 42 months -> 2030-03-15, $2,380 interest to come
  - Visa: owed $11,000, 27.9%, $250/mo, never pays off, expensive
  - Mastercard: owed $7,000, 25.9%, $160/mo, 136 months -> 2038-01-15, $14,634 interest to come, expensive
  - Medical bills: owed $4,200, 0%, $100/mo, 42 months -> 2030-03-15, $0 interest to come
  - Loan from Tasha's dad: owed $5,000, 0%, $0/mo, no payoff (no payment)
- **Goals**: 1 goals, 0 reached; saved $350 of $5,000; needed $926/mo vs $0/mo going in
  - One month of bills: behind; $350 of $5,000, 5 months left, needs $926/mo (rate 2%)

## Also check
- [ ] Per month 3,600
- [ ] overspend about 2,000/mo
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-derek","name":"Derek","role":"self","birthDate":"1979-02-28"},{"id":"p-tasha","name":"Tasha","role":"partner","birthDate":"1981-06-30"},{"id":"p-kai","name":"Kai","role":"dependent","birthDate":"2013-03-03"},{"id":"p-lily","name":"Lily","role":"dependent","birthDate":"2017-11-11"}],"filingStatus":"married_joint","state":"MI"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":640,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":350,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Derek's old 401(k)","type":"401k","balance":31000,"asOf":"2026-09-15","ownerId":"Derek","institution":"","history":[]},{"id":"a-car","name":"Car","type":"vehicle","balance":9000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-carloan","name":"Car loan","type":"loan","balance":14500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Visa","type":"credit","balance":11000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mc","name":"Mastercard","type":"credit","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-med","name":"Medical bills","type":"other_liability","balance":4200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-fam","name":"Loan from Tasha's dad","type":"other_liability","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-derek","name":"Derek's old salary","type":"salary","personId":"p-derek","amount":5900,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-06-15"},{"id":"i-ui","name":"Unemployment","type":"other","personId":"p-derek","amount":1800,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-09-01"},{"id":"i-tasha","name":"Tasha's pay","type":"salary","personId":"p-tasha","amount":3600,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1650,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":240,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":230,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":410,"period":"monthly","inflates":false},{"id":"e-cards","name":"Card minimums","category":"debt","amount":560,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":260,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":190,"period":"monthly","inflates":true},{"id":"e-health","name":"COBRA health plan","category":"health","amount":1450,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":130,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":45,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":150,"period":"monthly","inflates":true}],"debts":[{"id":"d-car","accountId":"a-carloan","rate":0.089,"minPayment":410,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.279,"minPayment":250,"extra":0},{"id":"d-mc","accountId":"a-mc","rate":0.259,"minPayment":160,"extra":0},{"id":"d-med","accountId":"a-med","rate":0,"minPayment":100,"extra":0},{"id":"d-fam","accountId":"a-fam","rate":0,"minPayment":0,"extra":0}],"goals":[{"id":"g-ef","name":"One month of bills","icon":"🛟","target":5000,"targetDate":"2027-03-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
