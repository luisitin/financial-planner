# H-1021  Freelancer with quarterly taxes, part-time spouse · Main income ended last month
- type: 11-self-employed   pack: income   case: ended-last-month
- status: fail (results/H-1021.json)   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 11-self-employed/income/H-1021-ended-last-month.md`

**Household.** Nadia, 38, freelance designer (monthly draw plus an annual bonus); Omar, 40, part-time; quarterly tax payments are a must-pay expense.

**The twist.** Nadia's freelance draw ended 2026-08-15.

**Why it matters.** Ended items are listed, tagged 'ended', excluded from totals.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Nadia | Me | 1988-05-27 | 38 | 65 | 95 | no | 27 | 57 |
| Omar | Partner | 1986-08-08 | 40 | 65 | 95 | no | 25 | 55 |
- filing: married_joint   state: OR   plan horizon: 57 years

## Accounts (8)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Business checking | checking | $12,000 | 2026-09-15 | joint |
| Tax savings | savings | $9,000 | 2026-09-15 | joint |
| Brokerage | brokerage | $21,000 | 2026-09-15 | joint |
| Nadia's SEP IRA | ira | $48,000 | 2026-09-15 | Nadia |
| Omar's Roth | roth | $15,000 | 2026-09-15 | Omar |
| House | property | $455,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $336,000 | 2026-09-15 | joint |
| Business card | credit | $3,800 | 2026-09-15 | joint |

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Nadia's freelance draw | business | Nadia | $3,500 | every month | - | yes | - | 2026-08-15 |
| Year-end client bonus | bonus | Nadia | $6,000 | once a year | - | yes | - | - |
| Omar's part-time pay | salary | Omar | $1,400 | every two weeks | 3% | yes | - | - |

## Expenses (11)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $2,300 | every month | yes (default) | no | - | - |
| Quarterly estimated taxes | taxes | $4,200 | every three months | yes (default) | no | - | - |
| Utilities | utilities | $230 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $190 | every week | yes (default) | yes | - | - |
| Health insurance (marketplace) | health | $890 | every month | yes (default) | yes | - | - |
| Gas | transport | $180 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $900 | every three months | yes (default) | yes | - | - |
| Phones | phone | $110 | every month | yes (default) | yes | - | - |
| Software subscriptions | subscriptions | $140 | every month | no (default) | yes | - | - |
| Eating out | dining | $280 | every month | no (default) | yes | - | - |
| Fun | fun | $160 | every month | no (default) | yes | - | - |

## Debts (2 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 6.3% | $2,300 | $0 | 360 months from 2023-09-01 |
| Business card | 21.9% | $120 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Six months of bills | $40,000 | 2029-01-01 | 1 | $0 | Tax savings | $600 | plan default | no |
| New workstation | $5,000 | 2027-02-01 | 2 | $1,500 | - | $300 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); 27 years until Nadia retires (2053); plan must last 57 years
- **Income**: $3,533/mo, $42,400/yr, next year $43,492; by person: Nadia $500/mo (14%), Omar $3,033/mo (86%)
- **Expenses**: $9,233/mo, $110,800/yr; must-pay $8,653, nice-to-have $580; left over -$5,700 (-161% of income); warnings: spend 5700 more than comes in
- **Net worth**: $220,200 = own $560,000 - owe $339,800; liquid $42,000; cash $21,000; invested $84,000 ($48,000 pre-tax, $15,000 tax-free, $21,000 taxable)
- **Emergency fund**: usable today $12,000, within a week $21,000, locked up $518,000; 1.4 months of must-pay (1.3 of all spending); target $51,920 (6 months), gap $39,920, status bad
- **Debts**: 2 debts, owed $339,800, paying $2,420/mo (required $2,420), interest $1,819/mo, avg rate 6.4%, DTI 68%, 0 without details
  - Mortgage: owed $336,000, 6.3%, $2,300/mo, 276 months -> 2049-09-15, $297,463 interest to come
  - Business card: owed $3,800, 21.9%, $120/mo, 48 months -> 2030-09-15, $1,923 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $10,500 of $45,000; needed $1,979/mo vs $900/mo going in
  - Six months of bills: behind; $9,000 of $40,000, 27 months left, needs $1,108/mo, putting in $600/mo (rate 2%)
  - New workstation: behind; $1,500 of $5,000, 4 months left, needs $870/mo, putting in $300/mo (rate 2%)

## Also check
- [ ] Per month excludes it
- [ ] row tagged ended
- [ ] Left over / DTI / savings rate recomputed without it
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-nadia","name":"Nadia","role":"self","birthDate":"1988-05-27"},{"id":"p-omar","name":"Omar","role":"partner","birthDate":"1986-08-08"}],"filingStatus":"married_joint","state":"OR"},"accounts":[{"id":"a-chk","name":"Business checking","type":"checking","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Tax savings","type":"savings","balance":9000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage","type":"brokerage","balance":21000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sep","name":"Nadia's SEP IRA","type":"ira","balance":48000,"asOf":"2026-09-15","ownerId":"Nadia","institution":"","history":[]},{"id":"a-roth","name":"Omar's Roth","type":"roth","balance":15000,"asOf":"2026-09-15","ownerId":"Omar","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":455000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":336000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Business card","type":"credit","balance":3800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-nadia","name":"Nadia's freelance draw","type":"business","personId":"p-nadia","amount":3500,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-08-15"},{"id":"i-bonus","name":"Year-end client bonus","type":"bonus","personId":"p-nadia","amount":6000,"period":"annual","growth":0,"taxable":true},{"id":"i-omar","name":"Omar's part-time pay","type":"salary","personId":"p-omar","amount":1400,"period":"biweekly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2300,"period":"monthly","inflates":false},{"id":"e-tax","name":"Quarterly estimated taxes","category":"taxes","amount":4200,"period":"quarterly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":230,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":190,"period":"weekly","inflates":true},{"id":"e-health","name":"Health insurance (marketplace)","category":"health","amount":890,"period":"monthly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":180,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":900,"period":"quarterly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":110,"period":"monthly","inflates":true},{"id":"e-sub","name":"Software subscriptions","category":"subscriptions","amount":140,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":280,"period":"monthly","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":160,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.0625,"minPayment":2300,"extra":0,"termMonths":360,"startDate":"2023-09-01"},{"id":"d-visa","accountId":"a-visa","rate":0.219,"minPayment":120,"extra":0}],"goals":[{"id":"g-ef","name":"Six months of bills","icon":"🛟","target":40000,"targetDate":"2029-01-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":600,"rate":null,"inflates":false},{"id":"g-laptop","name":"New workstation","icon":"💻","target":5000,"targetDate":"2027-02-01","priority":2,"saved":1500,"fundedBy":[],"monthly":300,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
