# H-0947  First job, roommates, student loans · Only assets, no liabilities
- type: 10-student-and-starter   pack: accounts   case: only-assets
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 10-student-and-starter/accounts/H-0947-only-assets.md`

**Household.** Jordan, 23, first salary, a side gig, two student loans and a card; rent is a roommate share.

**The twist.** Liabilities removed.

**Why it matters.** You owe $0; Debts page empty state.

## People (1: 1 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Jordan | Me | 2002-10-09 | 23 | 65 | 95 | no | 42 | 72 |
- filing: single   state: IL   plan horizon: 72 years

## Accounts (3)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $900 | 2026-09-15 | joint |
| Savings | savings | $1,200 | 2026-09-15 | joint |
| 401(k) | 401k | $2,100 | 2026-09-15 | Jordan |

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Jordan's pay | salary | Jordan | $1,900 | every two weeks | 5% | yes | - | - |
| Weekend bartending | business | Jordan | $300 | every month | - | yes | - | - |

## Expenses (10)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent (share) | housing | $900 | every month | yes (default) | yes | - | - |
| Utilities (share) | utilities | $60 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $75 | every week | yes (default) | yes | - | - |
| Student loan payments | debt | $440 | every month | yes (default) | no | - | - |
| Transit pass | transport | $90 | every month | yes (default) | yes | - | - |
| Renter's insurance | insurance | $40 | every month | yes (default) | yes | - | - |
| Phone | phone | $55 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $35 | every month | no (default) | yes | - | - |
| Eating out | dining | $260 | every month | no (default) | yes | - | - |
| Going out | fun | $150 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $5,000 | 2027-09-01 | 1 | $0 | Savings | $150 | plan default | no |
| Move out on my own | $3,000 | 2027-03-01 | 2 | $400 | - | $100 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 1 (1 adults, 0 dependents); 42 years until Jordan retires (2067); plan must last 72 years
- **Income**: $4,417/mo, $53,000/yr, next year $55,470; by person: Jordan $4,417/mo (100%)
- **Expenses**: $2,355/mo, $28,260/yr; must-pay $1,910, nice-to-have $445; left over $2,062 (47% of income)
- **Net worth**: $4,200 = own $4,200 - owe $0; liquid $2,100; cash $2,100; invested $2,100 ($2,100 pre-tax, $0 tax-free, $0 taxable)
- **Emergency fund**: usable today $900, within a week $0, locked up $2,100; 0.5 months of must-pay (0.4 of all spending); target $11,460 (6 months), gap $10,560, status bad
- **Debts**: 0 debts, owed $0, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 0 without details
- **Goals**: 2 goals, 0 reached; saved $1,600 of $8,000; needed $858/mo vs $250/mo going in
  - Emergency fund: behind; $1,200 of $5,000, 11 months left, needs $341/mo, putting in $150/mo (rate 2%)
  - Move out on my own: behind; $400 of $3,000, 5 months left, needs $518/mo, putting in $100/mo (rate 2%)

## Also check
- [ ] You owe $0
- [ ] Debts: empty state, no DTI, no alerts about debt
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-jordan","name":"Jordan","role":"self","birthDate":"2002-10-09"}],"filingStatus":"single","state":"IL"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":1200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"401(k)","type":"401k","balance":2100,"asOf":"2026-09-15","ownerId":"Jordan","institution":"","history":[]}],"income":[{"id":"i-pay","name":"Jordan's pay","type":"salary","personId":"p-jordan","amount":1900,"period":"biweekly","growth":0.05,"taxable":true},{"id":"i-gig","name":"Weekend bartending","type":"business","personId":"p-jordan","amount":300,"period":"monthly","growth":0,"taxable":true}],"expenses":[{"id":"e-rent","name":"Rent (share)","category":"housing","amount":900,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities (share)","category":"utilities","amount":60,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":75,"period":"weekly","inflates":true},{"id":"e-loan","name":"Student loan payments","category":"debt","amount":440,"period":"monthly","inflates":false},{"id":"e-transit","name":"Transit pass","category":"transport","amount":90,"period":"monthly","inflates":true},{"id":"e-ins","name":"Renter's insurance","category":"insurance","amount":40,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phone","category":"phone","amount":55,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":35,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":260,"period":"monthly","inflates":true},{"id":"e-fun","name":"Going out","category":"fun","amount":150,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":5000,"targetDate":"2027-09-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":150,"rate":null,"inflates":false},{"id":"g-solo","name":"Move out on my own","icon":"🏠","target":3000,"targetDate":"2027-03-01","priority":2,"saved":400,"fundedBy":[],"monthly":100,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
