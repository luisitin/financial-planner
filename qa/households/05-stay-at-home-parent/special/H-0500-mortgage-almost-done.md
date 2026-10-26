# H-0500  One earner, stay-at-home parent, twins · Mortgage balance 3,000
- type: 05-stay-at-home-parent   pack: special   case: mortgage-almost-done
- status: pass 2026-09-16   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 05-stay-at-home-parent/special/H-0500-mortgage-almost-done.md`

**Household.** Marcus, 37, earns; Elena, 35, at home with twins Ivy and Ike (4). Spousal Roth for Elena.

**The twist.** mortgage 3,000 at 1,700/mo.

**Why it matters.** Payoff in 2 months.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Marcus | Me | 1989-03-03 | 37 | 65 | 95 | no | 28 | 58 |
| Elena | Partner | 1991-09-01 | 35 | 65 | 95 | no | 30 | 60 |
| Ivy | Dependent | 2022-02-14 | 4 | - | 95 | - | - | 91 |
| Ike | Dependent | 2022-02-14 | 4 | - | 95 | - | - | 91 |
- filing: married_joint   state: OH   plan horizon: 60 years

## Accounts (9)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $4,800 | 2026-09-15 | joint |
| Savings | savings | $11,000 | 2026-09-15 | joint |
| Marcus's 401(k) | 401k | $96,000 | 2026-09-15 | Marcus |
| Elena's spousal Roth | roth | $9,000 | 2026-09-15 | Elena |
| House | property | $310,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $3,000 | 2026-09-15 | joint |
| SUV | vehicle | $18,000 | 2026-09-15 | joint |
| Car loan | loan | $12,000 | 2026-09-15 | joint |
| Credit card | credit | $900 | 2026-09-15 | joint |

## Income (1)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Marcus's salary | salary | Marcus | $6,800 | every month | 3% | yes | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $1,700 | every month | yes (default) | no | - | - |
| Utilities | utilities | $240 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $230 | every week | yes (default) | yes | - | - |
| Car payment | debt | $360 | every month | yes (default) | no | - | - |
| Gas | transport | $260 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $480 | every three months | yes (default) | yes | - | - |
| Health | health | $420 | every month | yes (default) | yes | - | - |
| Phones | phone | $120 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $50 | every month | no (default) | yes | - | - |
| Eating out | dining | $200 | every month | no (default) | yes | - | - |
| Kids' stuff | fun | $150 | every month | no (default) | yes | - | - |
| Giving | giving | $200 | every month | no (default) | yes | - | - |

## Debts (3 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 5.9% | $1,700 | $0 | 360 months from 2022-05-01 |
| Car loan | 5.4% | $360 | $0 | - |
| Credit card | 19.9% | $35 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $20,000 | 2027-12-31 | 1 | $0 | Savings | $350 | plan default | no |
| Elena's certification | $4,000 | 2027-06-01 | 2 | $1,000 | - | $150 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 4 (2 adults, 2 dependents); 28 years until Marcus retires (2054); plan must last 60 years
- **Income**: $6,800/mo, $81,600/yr, next year $84,048; by person: Marcus $6,800/mo (100%)
- **Expenses**: $4,857/mo, $58,280/yr; must-pay $4,257, nice-to-have $600; left over $1,943 (29% of income); warnings: loan and card payments here (360) differ from Debts (2095)
- **Net worth**: $432,900 = own $448,800 - owe $15,900; liquid $15,800; cash $15,800; invested $105,000 ($96,000 pre-tax, $9,000 tax-free, $0 taxable)
- **Emergency fund**: usable today $4,800, within a week $0, locked up $433,000; 1.1 months of must-pay (1 of all spending); target $25,540 (6 months), gap $20,740, status bad
- **Debts**: 3 debts, owed $15,900, paying $2,095/mo (required $2,095), interest $84/mo, avg rate 6.3%, DTI 31%, 0 without details
  - Mortgage: owed $3,000, 5.9%, $1,700/mo, 2 months -> 2026-11-15, $21 interest to come
  - Car loan: owed $12,000, 5.4%, $360/mo, 37 months -> 2029-10-15, $1,031 interest to come
  - Credit card: owed $900, 19.9%, $35/mo, 34 months -> 2029-07-15, $283 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $12,000 of $24,000; needed $946/mo vs $500/mo going in
  - Emergency fund: behind; $11,000 of $20,000, 15 months left, needs $575/mo, putting in $350/mo (rate 2%)
  - Elena's certification: behind; $1,000 of $4,000, 8 months left, needs $371/mo, putting in $150/mo (rate 2%)

## Also check
- [ ] 2 months
- [ ] interest to come about $22
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-marcus","name":"Marcus","role":"self","birthDate":"1989-03-03"},{"id":"p-elena","name":"Elena","role":"partner","birthDate":"1991-09-01"},{"id":"p-ivy","name":"Ivy","role":"dependent","birthDate":"2022-02-14"},{"id":"p-ike","name":"Ike","role":"dependent","birthDate":"2022-02-14"}],"filingStatus":"married_joint","state":"OH"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":4800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":11000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Marcus's 401(k)","type":"401k","balance":96000,"asOf":"2026-09-15","ownerId":"Marcus","institution":"","history":[]},{"id":"a-roth","name":"Elena's spousal Roth","type":"roth","balance":9000,"asOf":"2026-09-15","ownerId":"Elena","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":310000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-car","name":"SUV","type":"vehicle","balance":18000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-carloan","name":"Car loan","type":"loan","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Credit card","type":"credit","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-marcus","name":"Marcus's salary","type":"salary","personId":"p-marcus","amount":6800,"period":"monthly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":1700,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":240,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":230,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":360,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":260,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":480,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":420,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":120,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":50,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":200,"period":"monthly","inflates":true},{"id":"e-fun","name":"Kids' stuff","category":"fun","amount":150,"period":"monthly","inflates":true},{"id":"e-give","name":"Giving","category":"giving","amount":200,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.059,"minPayment":1700,"extra":0,"termMonths":360,"startDate":"2022-05-01"},{"id":"d-car","accountId":"a-carloan","rate":0.054,"minPayment":360,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.199,"minPayment":35,"extra":0}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":20000,"targetDate":"2027-12-31","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":350,"rate":null,"inflates":false},{"id":"g-cert","name":"Elena's certification","icon":"💼","target":4000,"targetDate":"2027-06-01","priority":2,"saved":1000,"fundedBy":[],"monthly":150,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
