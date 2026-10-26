# H-0255  Single parent receiving child support · Fifty small accounts
- type: 03-single-parent   pack: accounts   case: fifty-accounts
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 03-single-parent/accounts/H-0255-fifty-accounts.md`

**Household.** Dana, 41, nurse, kids Leo (12) and Nia (7); $900/mo child support comes in untaxed.

**The twist.** 50 extra accounts (every 5th a card).

**Why it matters.** Long list performance and layout.

## People (3: 1 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Dana | Me | 1985-08-30 | 41 | 65 | 95 | no | 24 | 54 |
| Leo | Dependent | 2014-03-12 | 12 | - | 95 | - | - | 83 |
| Nia | Dependent | 2018-11-02 | 7 | - | 95 | - | - | 88 |
- filing: head_of_household   state: GA   plan horizon: 54 years

## Accounts (58)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $2,400 | 2026-09-15 | joint |
| Savings | savings | $4,100 | 2026-09-15 | joint |
| Hospital 403(b) | 401k | $54,000 | 2026-09-15 | Dana |
| Leo's 529 | 529 | $6,000 | 2026-09-15 | Leo |
| Nia's 529 | 529 | $3,500 | 2026-09-15 | Nia |
| Minivan | vehicle | $14,000 | 2026-09-15 | joint |
| Car loan | loan | $11,500 | 2026-09-15 | joint |
| Credit card | credit | $3,200 | 2026-09-15 | joint |
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

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Dana's pay | salary | Dana | $3,300 | every two weeks | 3% | yes | - | - |
| Child support received | support | Dana | $900 | every month | - | no | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent | housing | $1,750 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $190 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $210 | every week | yes (default) | yes | - | - |
| After-school care | childcare | $650 | every month | yes (default) | yes | - | - |
| Car payment | debt | $340 | every month | yes (default) | no | - | - |
| Gas | transport | $200 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $140 | every month | yes (default) | yes | - | - |
| Health | health | $220 | every month | yes (default) | yes | - | - |
| Phones | phone | $95 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $45 | every month | no (default) | yes | - | - |
| Eating out | dining | $180 | every month | no (default) | yes | - | - |
| Kids' activities | fun | $150 | every month | no (default) | yes | - | - |

## Debts (2 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Car loan | 5.9% | $340 | $0 | - |
| Credit card | 24.9% | $95 | $105 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $12,000 | 2027-12-01 | 1 | $0 | Savings | $200 | plan default | no |
| Leo's college | $40,000 | 2032-08-15 | 2 | $0 | Leo's 529 | $150 | 6% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 3 (1 adults, 2 dependents); 24 years until Dana retires (2050); plan must last 54 years
- **Income**: $8,050/mo, $96,600/yr, next year $99,174; by person: Dana $8,050/mo (100%)
- **Expenses**: $4,870/mo, $58,440/yr; must-pay $4,495, nice-to-have $375; left over $3,180 (40% of income); warnings: loan and card payments here (340) differ from Debts (540)
- **Net worth**: $141,800 = own $184,000 - owe $42,200; liquid $106,500; cash $106,500; invested $63,500 ($54,000 pre-tax, $9,500 tax-free, $0 taxable)
- **Emergency fund**: usable today $102,400, within a week $0, locked up $77,500; 22.8 months of must-pay (21 of all spending); target $26,970 (6 months), gap $0, status ok
- **Debts**: 12 debts, owed $42,200, paying $540/mo (required $435), interest $123/mo, avg rate 10%, DTI 7%, 10 without details
  - Car loan: owed $11,500, 5.9%, $340/mo, 38 months -> 2029-11-15, $1,108 interest to come
  - Credit card: owed $3,200, 24.9%, $200/mo, 20 months -> 2028-05-15, $730 interest to come, expensive
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
- **Goals**: 2 goals, 0 reached; saved $10,100 of $59,645; needed $1,011/mo vs $350/mo going in
  - Emergency fund: behind; $4,100 of $12,000, 14 months left, needs $551/mo, putting in $200/mo (rate 2%)
  - Leo's college: behind; $6,000 of $47,645, 71 months left, needs $460/mo, putting in $150/mo (rate 6%)

## Also check
- [ ] page draws in under a second
- [ ] totals: +savings 40 x ... see expected
- [ ] no overflow
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-dana","name":"Dana","role":"self","birthDate":"1985-08-30"},{"id":"p-leo","name":"Leo","role":"dependent","birthDate":"2014-03-12"},{"id":"p-nia","name":"Nia","role":"dependent","birthDate":"2018-11-02"}],"filingStatus":"head_of_household","state":"GA"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":2400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":4100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Hospital 403(b)","type":"401k","balance":54000,"asOf":"2026-09-15","ownerId":"Dana","institution":"","history":[]},{"id":"a-529l","name":"Leo's 529","type":"529","balance":6000,"asOf":"2026-09-15","ownerId":"Leo","institution":"","history":[]},{"id":"a-529n","name":"Nia's 529","type":"529","balance":3500,"asOf":"2026-09-15","ownerId":"Nia","institution":"","history":[]},{"id":"a-car","name":"Minivan","type":"vehicle","balance":14000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-carloan","name":"Car loan","type":"loan","balance":11500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Credit card","type":"credit","balance":3200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-1","name":"Account 1","type":"savings","balance":100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-2","name":"Account 2","type":"savings","balance":200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-3","name":"Account 3","type":"savings","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-4","name":"Account 4","type":"savings","balance":400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-5","name":"Account 5","type":"credit","balance":500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-6","name":"Account 6","type":"savings","balance":600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-7","name":"Account 7","type":"savings","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-8","name":"Account 8","type":"savings","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-9","name":"Account 9","type":"savings","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-10","name":"Account 10","type":"credit","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-11","name":"Account 11","type":"savings","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-12","name":"Account 12","type":"savings","balance":1200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-13","name":"Account 13","type":"savings","balance":1300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-14","name":"Account 14","type":"savings","balance":1400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-15","name":"Account 15","type":"credit","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-16","name":"Account 16","type":"savings","balance":1600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-17","name":"Account 17","type":"savings","balance":1700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-18","name":"Account 18","type":"savings","balance":1800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-19","name":"Account 19","type":"savings","balance":1900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-20","name":"Account 20","type":"credit","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-21","name":"Account 21","type":"savings","balance":2100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-22","name":"Account 22","type":"savings","balance":2200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-23","name":"Account 23","type":"savings","balance":2300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-24","name":"Account 24","type":"savings","balance":2400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-25","name":"Account 25","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-26","name":"Account 26","type":"savings","balance":2600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-27","name":"Account 27","type":"savings","balance":2700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-28","name":"Account 28","type":"savings","balance":2800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-29","name":"Account 29","type":"savings","balance":2900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-30","name":"Account 30","type":"credit","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-31","name":"Account 31","type":"savings","balance":3100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-32","name":"Account 32","type":"savings","balance":3200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-33","name":"Account 33","type":"savings","balance":3300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-34","name":"Account 34","type":"savings","balance":3400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-35","name":"Account 35","type":"credit","balance":3500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-36","name":"Account 36","type":"savings","balance":3600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-37","name":"Account 37","type":"savings","balance":3700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-38","name":"Account 38","type":"savings","balance":3800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-39","name":"Account 39","type":"savings","balance":3900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-40","name":"Account 40","type":"credit","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-41","name":"Account 41","type":"savings","balance":4100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-42","name":"Account 42","type":"savings","balance":4200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-43","name":"Account 43","type":"savings","balance":4300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-44","name":"Account 44","type":"savings","balance":4400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-45","name":"Account 45","type":"credit","balance":4500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-46","name":"Account 46","type":"savings","balance":4600,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-47","name":"Account 47","type":"savings","balance":4700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-48","name":"Account 48","type":"savings","balance":4800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-49","name":"Account 49","type":"savings","balance":4900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-many-50","name":"Account 50","type":"credit","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-pay","name":"Dana's pay","type":"salary","personId":"p-dana","amount":3300,"period":"biweekly","growth":0.03,"taxable":true},{"id":"i-cs","name":"Child support received","type":"support","personId":"p-dana","amount":900,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1750,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":190,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":210,"period":"weekly","inflates":true},{"id":"e-after","name":"After-school care","category":"childcare","amount":650,"period":"monthly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":340,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":200,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":140,"period":"monthly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":220,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":95,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":45,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":180,"period":"monthly","inflates":true},{"id":"e-kids","name":"Kids' activities","category":"fun","amount":150,"period":"monthly","inflates":true}],"debts":[{"id":"d-car","accountId":"a-carloan","rate":0.059,"minPayment":340,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.249,"minPayment":95,"extra":105}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":12000,"targetDate":"2027-12-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":200,"rate":null,"inflates":false},{"id":"g-leo","name":"Leo's college","icon":"🎓","target":40000,"targetDate":"2032-08-15","priority":2,"saved":0,"fundedBy":["a-529l"],"monthly":150,"rate":0.06,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
