# H-1247  Job loss, cards at their limit, negative net worth · Only assets, no liabilities
- type: 13-in-crisis   pack: accounts   case: only-assets
- status: fail (results/H-1247.json)   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 13-in-crisis/accounts/H-1247-only-assets.md`

**Household.** Derek, 47, laid off in June; Tasha, 45, works; two kids; unemployment ends in December; spending is above income.

**The twist.** Liabilities removed.

**Why it matters.** You owe $0; Debts page empty state.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Derek | Me | 1979-02-28 | 47 | 65 | 95 | no | 18 | 48 |
| Tasha | Partner | 1981-06-30 | 45 | 65 | 95 | no | 20 | 50 |
| Kai | Dependent | 2013-03-03 | 13 | - | 95 | - | - | 82 |
| Lily | Dependent | 2017-11-11 | 8 | - | 95 | - | - | 87 |
- filing: married_joint   state: MI   plan horizon: 50 years

## Accounts (4)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $640 | 2026-09-15 | joint |
| Savings | savings | $350 | 2026-09-15 | joint |
| Derek's old 401(k) | 401k | $31,000 | 2026-09-15 | Derek |
| Car | vehicle | $9,000 | 2026-09-15 | joint |

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

## Debts (0 with details)
(none)

## Goals (1)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| One month of bills | $5,000 | 2027-03-01 | 1 | $0 | Savings | $0 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 4 (2 adults, 2 dependents); 18 years until Derek retires (2044); plan must last 50 years
- **Income**: $5,400/mo, $64,800/yr, next year $65,664; by person: Derek $1,800/mo (33%), Tasha $3,600/mo (67%)
- **Expenses**: $6,082/mo, $72,980/yr; must-pay $5,887, nice-to-have $195; left over -$682 (-13% of income); warnings: spend 682 more than comes in
- **Net worth**: $40,990 = own $40,990 - owe $0; liquid $990; cash $990; invested $31,000 ($31,000 pre-tax, $0 tax-free, $0 taxable)
- **Emergency fund**: usable today $640, within a week $0, locked up $40,000; 0.1 months of must-pay (0.1 of all spending); target $35,320 (6 months), gap $34,680, status bad
- **Debts**: 0 debts, owed $0, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 0 without details
- **Goals**: 1 goals, 0 reached; saved $350 of $5,000; needed $926/mo vs $0/mo going in
  - One month of bills: behind; $350 of $5,000, 5 months left, needs $926/mo (rate 2%)

## Also check
- [ ] You owe $0
- [ ] Debts: empty state, no DTI, no alerts about debt
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-derek","name":"Derek","role":"self","birthDate":"1979-02-28"},{"id":"p-tasha","name":"Tasha","role":"partner","birthDate":"1981-06-30"},{"id":"p-kai","name":"Kai","role":"dependent","birthDate":"2013-03-03"},{"id":"p-lily","name":"Lily","role":"dependent","birthDate":"2017-11-11"}],"filingStatus":"married_joint","state":"MI"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":640,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":350,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Derek's old 401(k)","type":"401k","balance":31000,"asOf":"2026-09-15","ownerId":"Derek","institution":"","history":[]},{"id":"a-car","name":"Car","type":"vehicle","balance":9000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-derek","name":"Derek's old salary","type":"salary","personId":"p-derek","amount":5900,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-06-15"},{"id":"i-ui","name":"Unemployment","type":"other","personId":"p-derek","amount":1800,"period":"monthly","growth":0,"taxable":true,"endDate":"2026-12-15"},{"id":"i-tasha","name":"Tasha's pay","type":"salary","personId":"p-tasha","amount":3600,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1650,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":240,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":230,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":410,"period":"monthly","inflates":false},{"id":"e-cards","name":"Card minimums","category":"debt","amount":560,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":260,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":190,"period":"monthly","inflates":true},{"id":"e-health","name":"COBRA health plan","category":"health","amount":1450,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":130,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":45,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":150,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"One month of bills","icon":"🛟","target":5000,"targetDate":"2027-03-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
