# H-0572  Blended family: support paid and received · A goal without a date
- type: 06-blended-family   pack: goals   case: no-date
- status: pass 2026-09-16   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 06-blended-family/goals/H-0572-no-date.md`

**Household.** Rob, 44, pays $800/mo support for Ava (14, lives with her mom); Kim, 42, receives $650/mo for Zoe (9); baby Max (1) is theirs.

**The twist.** 50,000, no date.

**Why it matters.** status 'no date'; no needed figure.

## People (5: 2 adults, 3 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Rob | Me | 1982-06-18 | 44 | 65 | 95 | no | 21 | 51 |
| Kim | Partner | 1983-12-02 | 42 | 65 | 95 | no | 23 | 53 |
| Zoe | Dependent | 2017-08-09 | 9 | - | 95 | - | - | 86 |
| Max | Dependent | 2025-04-20 | 1 | - | 95 | - | - | 94 |
| Ava (with her mom) | Dependent | 2012-01-15 | 14 | - | 95 | - | - | 81 |
- filing: married_joint   state: FL   plan horizon: 53 years

## Accounts (8)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Joint checking | checking | $3,900 | 2026-09-15 | joint |
| Savings | savings | $8,200 | 2026-09-15 | joint |
| Rob's 401(k) | 401k | $74,000 | 2026-09-15 | Rob |
| Kim's 401(k) | 401k | $38,000 | 2026-09-15 | Kim |
| House | property | $340,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $262,000 | 2026-09-15 | joint |
| Kim's student loan | student_loan | $28,000 | 2026-09-15 | Kim |
| Visa | credit | $5,100 | 2026-09-15 | joint |

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Rob's salary | salary | Rob | $5,400 | twice a month | 2% | yes | - | - |
| Kim's salary | salary | Kim | $3,100 | every two weeks | 3% | yes | - | - |
| Child support for Zoe | support | Kim | $650 | every month | - | no | - | - |

## Expenses (13)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Child support for Ava | other | $800 | every month | yes | no | - | - |
| Mortgage payment | housing | $1,900 | every month | yes (default) | no | - | - |
| Utilities | utilities | $260 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $240 | every week | yes (default) | yes | - | - |
| Daycare (Max) | childcare | $1,100 | every month | yes (default) | yes | - | - |
| Student loan payment | debt | $310 | every month | yes (default) | no | - | - |
| Gas | transport | $280 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $620 | every three months | yes (default) | yes | - | - |
| Health | health | $350 | every month | yes (default) | yes | - | - |
| Phones | phone | $140 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $60 | every month | no (default) | yes | - | - |
| Eating out | dining | $300 | every month | no (default) | yes | - | - |
| Fun | fun | $150 | every month | no (default) | yes | - | - |

## Debts (3 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 6.4% | $1,900 | $0 | 360 months from 2024-02-01 |
| Kim's student loan | 6.8% | $310 | $0 | - |
| Visa | 23.9% | $130 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $18,000 | 2028-03-01 | 1 | $0 | Savings | $250 | plan default | no |
| Someday boat | $50,000 | no date | 2 | $0 | - | $0 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 5 (2 adults, 3 dependents); 21 years until Rob retires (2047); plan must last 53 years
- **Income**: $18,167/mo, $218,000/yr, next year $223,010; by person: Rob $10,800/mo (59%), Kim $7,367/mo (41%)
- **Expenses**: $6,897/mo, $82,760/yr; must-pay $6,387, nice-to-have $510; left over $11,270 (62% of income); warnings: loan and card payments here (310) differ from Debts (2340)
- **Net worth**: $169,000 = own $464,100 - owe $295,100; liquid $12,100; cash $12,100; invested $112,000 ($112,000 pre-tax, $0 tax-free, $0 taxable)
- **Emergency fund**: usable today $3,900, within a week $0, locked up $452,000; 0.6 months of must-pay (0.6 of all spending); target $38,320 (6 months), gap $34,420, status bad
- **Debts**: 3 debts, owed $295,100, paying $2,340/mo (required $2,340), interest $1,658/mo, avg rate 6.7%, DTI 13%, 0 without details
  - Mortgage: owed $262,000, 6.4%, $1,900/mo, 250 months -> 2047-07-15, $212,961 interest to come
  - Kim's student loan: owed $28,000, 6.8%, $310/mo, 127 months -> 2037-04-15, $11,340 interest to come
  - Visa: owed $5,100, 23.9%, $130/mo, 78 months -> 2033-03-15, $4,922 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $8,200 of $68,000; needed $555/mo vs $250/mo going in
  - Emergency fund: behind; $8,200 of $18,000, 17 months left, needs $555/mo, putting in $250/mo (rate 2%)
  - Someday boat: no date; $0 of $50,000

## Also check
- [ ] 'no date'
- [ ] excluded from Needed each month
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-rob","name":"Rob","role":"self","birthDate":"1982-06-18"},{"id":"p-kim","name":"Kim","role":"partner","birthDate":"1983-12-02"},{"id":"p-zoe","name":"Zoe","role":"dependent","birthDate":"2017-08-09"},{"id":"p-max","name":"Max","role":"dependent","birthDate":"2025-04-20"},{"id":"p-ava","name":"Ava (with her mom)","role":"dependent","birthDate":"2012-01-15"}],"filingStatus":"married_joint","state":"FL"},"accounts":[{"id":"a-chk","name":"Joint checking","type":"checking","balance":3900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":8200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401r","name":"Rob's 401(k)","type":"401k","balance":74000,"asOf":"2026-09-15","ownerId":"Rob","institution":"","history":[]},{"id":"a-401kk","name":"Kim's 401(k)","type":"401k","balance":38000,"asOf":"2026-09-15","ownerId":"Kim","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":340000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":262000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-stu","name":"Kim's student loan","type":"student_loan","balance":28000,"asOf":"2026-09-15","ownerId":"Kim","institution":"","history":[]},{"id":"a-visa","name":"Visa","type":"credit","balance":5100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-rob","name":"Rob's salary","type":"salary","personId":"p-rob","amount":5400,"period":"semimonthly","growth":0.02,"taxable":true},{"id":"i-kim","name":"Kim's salary","type":"salary","personId":"p-kim","amount":3100,"period":"biweekly","growth":0.03,"taxable":true},{"id":"i-cs","name":"Child support for Zoe","type":"support","personId":"p-kim","amount":650,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-cs","name":"Child support for Ava","category":"other","amount":800,"period":"monthly","inflates":false,"essential":true},{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":1900,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":260,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":240,"period":"weekly","inflates":true},{"id":"e-day","name":"Daycare (Max)","category":"childcare","amount":1100,"period":"monthly","inflates":true},{"id":"e-stu","name":"Student loan payment","category":"debt","amount":310,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":280,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":620,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":350,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":140,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":60,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":300,"period":"monthly","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":150,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.064,"minPayment":1900,"extra":0,"termMonths":360,"startDate":"2024-02-01"},{"id":"d-stu","accountId":"a-stu","rate":0.068,"minPayment":310,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.239,"minPayment":130,"extra":0}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":18000,"targetDate":"2028-03-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":250,"rate":null,"inflates":false},{"id":"g-nodate","name":"Someday boat","icon":"⛵","target":50000,"targetDate":"","priority":2,"saved":0,"fundedBy":[],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
