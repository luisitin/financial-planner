# H-1367  Widowed, one adult child at home, small business sold · Debt payments above 43% of income
- type: 14-unusual-structures   pack: debts   case: dti-above-43
- status: fail (results/H-1367.json)   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 14-unusual-structures/debts/H-1367-dti-above-43.md`

**Household.** Grace, 58, widowed last year (qualifying surviving spouse); son Eli (24) lives at home and pays board; life-insurance payout invested; a pension from her late husband.

**The twist.** Credit card minimum 4,000/mo.

**Why it matters.** DTI alert threshold.

## People (2: 1 adults, 1 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Grace | Me | 1967-12-12 | 58 | 64 | 95 | no | 6 | 37 |
| Eli (adult son at home) | Dependent | 2002-05-15 | 24 | - | 95 | - | - | 71 |
- filing: qualifying_surviving   state: MN   plan horizon: 37 years

## Accounts (8)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $11,000 | 2026-09-15 | joint |
| Savings | savings | $64,000 | 2026-09-15 | joint |
| Brokerage (insurance payout) | brokerage | $410,000 | 2026-09-15 | joint |
| Grace's 401(k) | 401k | $260,000 | 2026-09-15 | Grace |
| Inherited IRA | ira | $175,000 | 2026-09-15 | Grace |
| House | property | $390,000 | 2026-09-15 | joint |
| Car | vehicle | $16,000 | 2026-09-15 | joint |
| Credit card | credit | $50,000 | 2026-09-15 | joint |

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Grace's salary | salary | Grace | $5,600 | every month | 2% | yes | - | - |
| Survivor pension | pension | Grace | $1,900 | every month | - | yes | - | - |
| Eli's board | support | Eli (adult son at home) | $500 | every month | - | no | - | - |

## Expenses (11)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Property tax | taxes | $5,400 | once a year | yes (default) | yes | - | - |
| Utilities | utilities | $230 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $170 | every week | yes (default) | yes | - | - |
| Gas | transport | $190 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $1,100 | every three months | yes (default) | yes | - | - |
| Health | health | $480 | every month | yes (default) | yes | - | - |
| Phones | phone | $110 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $50 | every month | no (default) | yes | - | - |
| Eating out | dining | $240 | every month | no (default) | yes | - | - |
| Travel | travel | $4,000 | once a year | no (default) | yes | - | - |
| Giving | giving | $300 | every month | no (default) | yes | - | - |

## Debts (1 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Credit card | 22% | $4,000 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Retire at 64: bridge fund | $150,000 | 2032-12-12 | 1 | $0 | Savings | $1,200 | 4% | no |
| Help Eli with a down payment | $30,000 | 2029-06-01 | 2 | $5,000 | - | $400 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (1 adults, 1 dependents); 6 years until Grace retires (2031); plan must last 37 years
- **Income**: $8,000/mo, $96,000/yr, next year $97,344; by person: Grace $7,500/mo (94%), Eli (adult son at home) $500/mo (6%)
- **Expenses**: $7,487/mo, $89,840/yr; must-pay $6,563, nice-to-have $923; left over $513 (6% of income)
- **Net worth**: $1,276,000 = own $1,326,000 - owe $50,000; liquid $485,000; cash $75,000; invested $845,000 ($435,000 pre-tax, $0 tax-free, $410,000 taxable)
- **Emergency fund**: usable today $11,000, within a week $410,000, locked up $841,000; 1.7 months of must-pay (1.5 of all spending); target $39,380 (6 months), gap $28,380, status bad
- **Debts**: 1 debts, owed $50,000, paying $4,000/mo (required $4,000), interest $917/mo, avg rate 22%, DTI 50%, 0 without details
  - Credit card: owed $50,000, 22%, $4,000/mo, 15 months -> 2027-12-15, $7,316 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $69,000 of $180,000; needed $1,566/mo vs $1,600/mo going in
  - Retire at 64: bridge fund: on track; $64,000 of $150,000, 74 months left, needs $813/mo, putting in $1,200/mo (rate 4%)
  - Help Eli with a down payment: behind; $5,000 of $30,000, 32 months left, needs $753/mo, putting in $400/mo (rate 2%)

## Also check
- [ ] Debt payments vs income above 43%
- [ ] Needs attention 'Debt payments take a big share of income'
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-grace","name":"Grace","role":"self","birthDate":"1967-12-12","retirementAge":64},{"id":"p-eli","name":"Eli (adult son at home)","role":"dependent","birthDate":"2002-05-15"}],"filingStatus":"qualifying_surviving","state":"MN"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":11000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":64000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage (insurance payout)","type":"brokerage","balance":410000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Grace's 401(k)","type":"401k","balance":260000,"asOf":"2026-09-15","ownerId":"Grace","institution":"","history":[]},{"id":"a-ira","name":"Inherited IRA","type":"ira","balance":175000,"asOf":"2026-09-15","ownerId":"Grace","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":390000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-car","name":"Car","type":"vehicle","balance":16000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-added-card","name":"Credit card","type":"credit","balance":50000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-grace","name":"Grace's salary","type":"salary","personId":"p-grace","amount":5600,"period":"monthly","growth":0.02,"taxable":true},{"id":"i-surv","name":"Survivor pension","type":"pension","personId":"p-grace","amount":1900,"period":"monthly","growth":0,"taxable":true},{"id":"i-board","name":"Eli's board","type":"support","personId":"p-eli","amount":500,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-tax","name":"Property tax","category":"taxes","amount":5400,"period":"annual","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":230,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":170,"period":"weekly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":190,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":1100,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":480,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":110,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":50,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":240,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":4000,"period":"annual","inflates":true},{"id":"e-give","name":"Giving","category":"giving","amount":300,"period":"monthly","inflates":true}],"debts":[{"id":"d-added-card","accountId":"a-added-card","rate":0.22,"minPayment":4000,"extra":0}],"goals":[{"id":"g-retire","name":"Retire at 64: bridge fund","icon":"🛟","target":150000,"targetDate":"2032-12-12","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":1200,"rate":0.04,"inflates":false},{"id":"g-eli","name":"Help Eli with a down payment","icon":"🏠","target":30000,"targetDate":"2029-06-01","priority":2,"saved":5000,"fundedBy":[],"monthly":400,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
