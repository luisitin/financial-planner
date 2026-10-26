# H-0356  Two working parents, three kids · A card balance typed as a negative number
- type: 04-two-parents   pack: accounts   case: liability-typed-negative
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 04-two-parents/accounts/H-0356-liability-typed-negative.md`

**Household.** Carlos, 39, and Jen, 38; Sofia (10), Mateo (6), Ana (3); daycare, a mortgage, three 529s.

**The twist.** Visa typed as -4400.

**Why it matters.** Debts count as what is owed whatever the sign.

## People (5: 2 adults, 3 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Carlos | Me | 1987-01-20 | 39 | 65 | 95 | no | 26 | 56 |
| Jen | Partner | 1988-07-07 | 38 | 65 | 95 | no | 27 | 57 |
| Sofia | Dependent | 2016-04-01 | 10 | - | 95 | - | - | 85 |
| Mateo | Dependent | 2019-12-24 | 6 | - | 95 | - | - | 89 |
| Ana | Dependent | 2023-05-05 | 3 | - | 95 | - | - | 92 |
- filing: married_joint   state: TX   plan horizon: 57 years

## Accounts (12)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Joint checking | checking | $5,200 | 2026-09-15 | joint |
| Emergency savings | savings | $14,000 | 2026-09-15 | joint |
| Carlos's 401(k) | 401k | $128,000 | 2026-09-15 | Carlos |
| Jen's 401(k) | 401k | $61,000 | 2026-09-15 | Jen |
| Roth IRA | roth | $22,000 | 2026-09-15 | Jen |
| Sofia's 529 | 529 | $9,000 | 2026-09-15 | joint |
| Mateo's 529 | 529 | $5,000 | 2026-09-15 | joint |
| Ana's 529 | 529 | $1,500 | 2026-09-15 | joint |
| House | property | $385,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $271,000 | 2026-09-15 | joint |
| Car loan | loan | $16,800 | 2026-09-15 | joint |
| Visa | credit | -$4,400 | 2026-09-15 | joint |

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Carlos's pay | salary | Carlos | $4,600 | every two weeks | 3% | yes | - | - |
| Jen's pay | salary | Jen | $3,900 | every month | 3% | yes | - | - |

## Expenses (13)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $2,020 | every month | yes (default) | no | - | - |
| Utilities | utilities | $280 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $260 | every week | yes (default) | yes | - | - |
| Daycare (Ana) | childcare | $1,300 | every month | yes (default) | yes | - | - |
| Gas and tolls | transport | $220 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $560 | every three months | yes (default) | yes | - | - |
| Health | health | $310 | every month | yes (default) | yes | - | - |
| Phones and internet | phone | $165 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $55 | every month | no (default) | yes | - | - |
| Eating out | dining | $320 | every month | no (default) | yes | - | - |
| Family fun | fun | $180 | every month | no (default) | yes | - | - |
| Summer trip | travel | $3,500 | once a year | no (default) | yes | - | - |
| Church | giving | $150 | every month | no (default) | yes | - | - |

## Debts (3 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 6.1% | $2,020 | $0 | 360 months from 2021-08-01 |
| Car loan | 4.9% | $395 | $0 | - |
| Visa | 21.9% | $110 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $25,000 | 2028-01-01 | 1 | $0 | Emergency savings | $300 | plan default | no |
| Sofia's college | $60,000 | 2034-08-15 | 2 | $0 | Sofia's 529 | $200 | 6% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 5 (2 adults, 3 dependents); 26 years until Carlos retires (2052); plan must last 57 years
- **Income**: $13,867/mo, $166,400/yr, next year $171,392; by person: Carlos $9,967/mo (72%), Jen $3,900/mo (28%)
- **Expenses**: $9,130/mo, $109,560/yr; must-pay $8,133, nice-to-have $997; left over $4,737 (34% of income)
- **Net worth**: $338,500 = own $630,700 - owe $292,200; liquid $19,200; cash $19,200; invested $226,500 ($189,000 pre-tax, $37,500 tax-free, $0 taxable)
- **Emergency fund**: usable today $5,200, within a week $0, locked up $611,500; 0.6 months of must-pay (0.6 of all spending); target $48,800 (6 months), gap $43,600, status bad
- **Debts**: 3 debts, owed $292,200, paying $2,525/mo (required $2,525), interest $1,526/mo, avg rate 6.3%, DTI 18%, 0 without details
  - Mortgage: owed $271,000, 6.1%, $2,020/mo, 226 months -> 2045-07-15, $185,398 interest to come
  - Car loan: owed $16,800, 4.9%, $395/mo, 47 months -> 2030-08-15, $1,691 interest to come
  - Visa: owed $4,400, 21.9%, $110/mo, 73 months -> 2032-10-15, $3,564 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $23,000 of $100,819; needed $1,208/mo vs $500/mo going in
  - Emergency fund: behind; $14,000 of $25,000, 15 months left, needs $701/mo, putting in $300/mo (rate 2%)
  - Sofia's college: behind; $9,000 of $75,819, 95 months left, needs $506/mo, putting in $200/mo (rate 6%)

## Also check
- [ ] You owe uses the absolute amount
- [ ] Debts page owed positive
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-carlos","name":"Carlos","role":"self","birthDate":"1987-01-20"},{"id":"p-jen","name":"Jen","role":"partner","birthDate":"1988-07-07"},{"id":"p-sofia","name":"Sofia","role":"dependent","birthDate":"2016-04-01"},{"id":"p-mateo","name":"Mateo","role":"dependent","birthDate":"2019-12-24"},{"id":"p-ana","name":"Ana","role":"dependent","birthDate":"2023-05-05"}],"filingStatus":"married_joint","state":"TX"},"accounts":[{"id":"a-chk","name":"Joint checking","type":"checking","balance":5200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Emergency savings","type":"savings","balance":14000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401c","name":"Carlos's 401(k)","type":"401k","balance":128000,"asOf":"2026-09-15","ownerId":"Carlos","institution":"","history":[]},{"id":"a-401j","name":"Jen's 401(k)","type":"401k","balance":61000,"asOf":"2026-09-15","ownerId":"Jen","institution":"","history":[]},{"id":"a-roth","name":"Roth IRA","type":"roth","balance":22000,"asOf":"2026-09-15","ownerId":"Jen","institution":"","history":[]},{"id":"a-529s","name":"Sofia's 529","type":"529","balance":9000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-529m","name":"Mateo's 529","type":"529","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-529a","name":"Ana's 529","type":"529","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":385000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":271000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-carloan","name":"Car loan","type":"loan","balance":16800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Visa","type":"credit","balance":-4400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-carlos","name":"Carlos's pay","type":"salary","personId":"p-carlos","amount":4600,"period":"biweekly","growth":0.03,"taxable":true},{"id":"i-jen","name":"Jen's pay","type":"salary","personId":"p-jen","amount":3900,"period":"monthly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2020,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":280,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":260,"period":"weekly","inflates":true},{"id":"e-day","name":"Daycare (Ana)","category":"childcare","amount":1300,"period":"monthly","inflates":true},{"id":"e-gas","name":"Gas and tolls","category":"transport","amount":220,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":560,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":310,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones and internet","category":"phone","amount":165,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":55,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":320,"period":"monthly","inflates":true},{"id":"e-fun","name":"Family fun","category":"fun","amount":180,"period":"monthly","inflates":true},{"id":"e-trav","name":"Summer trip","category":"travel","amount":3500,"period":"annual","inflates":true},{"id":"e-give","name":"Church","category":"giving","amount":150,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.061,"minPayment":2020,"extra":0,"termMonths":360,"startDate":"2021-08-01"},{"id":"d-car","accountId":"a-carloan","rate":0.049,"minPayment":395,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.219,"minPayment":110,"extra":0}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":25000,"targetDate":"2028-01-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":300,"rate":null,"inflates":false},{"id":"g-sofia","name":"Sofia's college","icon":"🎓","target":60000,"targetDate":"2034-08-15","priority":2,"saved":0,"fundedBy":["a-529s"],"monthly":200,"rate":0.06,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
