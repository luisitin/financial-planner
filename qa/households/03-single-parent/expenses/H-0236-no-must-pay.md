# H-0236  Single parent receiving child support · Nothing is marked must-pay
- type: 03-single-parent   pack: expenses   case: no-must-pay
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 03-single-parent/expenses/H-0236-no-must-pay.md`

**Household.** Dana, 41, nurse, kids Leo (12) and Nia (7); $900/mo child support comes in untaxed.

**The twist.** Every expense is nice-to-have.

**Why it matters.** Emergency-fund target becomes 0: warning on Emergency fund.

## People (3: 1 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Dana | Me | 1985-08-30 | 41 | 65 | 95 | no | 24 | 54 |
| Leo | Dependent | 2014-03-12 | 12 | - | 95 | - | - | 83 |
| Nia | Dependent | 2018-11-02 | 7 | - | 95 | - | - | 88 |
- filing: head_of_household   state: GA   plan horizon: 54 years

## Accounts (8)
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

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Dana's pay | salary | Dana | $3,300 | every two weeks | 3% | yes | - | - |
| Child support received | support | Dana | $900 | every month | - | no | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent | housing | $1,750 | every month | no | yes | - | - |
| Utilities | utilities | $190 | every month | no | yes | - | - |
| Groceries | groceries | $210 | every week | no | yes | - | - |
| After-school care | childcare | $650 | every month | no | yes | - | - |
| Car payment | debt | $340 | every month | no | no | - | - |
| Gas | transport | $200 | every month | no | yes | - | - |
| Insurance | insurance | $140 | every month | no | yes | - | - |
| Health | health | $220 | every month | no | yes | - | - |
| Phones | phone | $95 | every month | no | yes | - | - |
| Subscriptions | subscriptions | $45 | every month | no | yes | - | - |
| Eating out | dining | $180 | every month | no | yes | - | - |
| Kids' activities | fun | $150 | every month | no | yes | - | - |

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
- **Expenses**: $4,870/mo, $58,440/yr; must-pay $0, nice-to-have $4,870; left over $3,180 (40% of income); warnings: loan and card payments here (340) differ from Debts (540)
- **Net worth**: $69,300 = own $84,000 - owe $14,700; liquid $6,500; cash $6,500; invested $63,500 ($54,000 pre-tax, $9,500 tax-free, $0 taxable)
- **Emergency fund**: usable today $2,400, within a week $0, locked up $77,500; months: - (no must-pay expenses); target $0 (6 months), gap $0, status unknown
- **Debts**: 2 debts, owed $14,700, paying $540/mo (required $435), interest $123/mo, avg rate 10%, DTI 7%, 0 without details
  - Car loan: owed $11,500, 5.9%, $340/mo, 38 months -> 2029-11-15, $1,108 interest to come
  - Credit card: owed $3,200, 24.9%, $200/mo, 20 months -> 2028-05-15, $730 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $10,100 of $59,645; needed $1,011/mo vs $350/mo going in
  - Emergency fund: behind; $4,100 of $12,000, 14 months left, needs $551/mo, putting in $200/mo (rate 2%)
  - Leo's college: behind; $6,000 of $47,645, 71 months left, needs $460/mo, putting in $150/mo (rate 6%)

## Also check
- [ ] Must pay $0
- [ ] Emergency fund: warning 'none marked as must-pay', target $0, no months figure
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-dana","name":"Dana","role":"self","birthDate":"1985-08-30"},{"id":"p-leo","name":"Leo","role":"dependent","birthDate":"2014-03-12"},{"id":"p-nia","name":"Nia","role":"dependent","birthDate":"2018-11-02"}],"filingStatus":"head_of_household","state":"GA"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":2400,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":4100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Hospital 403(b)","type":"401k","balance":54000,"asOf":"2026-09-15","ownerId":"Dana","institution":"","history":[]},{"id":"a-529l","name":"Leo's 529","type":"529","balance":6000,"asOf":"2026-09-15","ownerId":"Leo","institution":"","history":[]},{"id":"a-529n","name":"Nia's 529","type":"529","balance":3500,"asOf":"2026-09-15","ownerId":"Nia","institution":"","history":[]},{"id":"a-car","name":"Minivan","type":"vehicle","balance":14000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-carloan","name":"Car loan","type":"loan","balance":11500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Credit card","type":"credit","balance":3200,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-pay","name":"Dana's pay","type":"salary","personId":"p-dana","amount":3300,"period":"biweekly","growth":0.03,"taxable":true},{"id":"i-cs","name":"Child support received","type":"support","personId":"p-dana","amount":900,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1750,"period":"monthly","inflates":true,"essential":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":190,"period":"monthly","inflates":true,"essential":false},{"id":"e-groc","name":"Groceries","category":"groceries","amount":210,"period":"weekly","inflates":true,"essential":false},{"id":"e-after","name":"After-school care","category":"childcare","amount":650,"period":"monthly","inflates":true,"essential":false},{"id":"e-car","name":"Car payment","category":"debt","amount":340,"period":"monthly","inflates":false,"essential":false},{"id":"e-gas","name":"Gas","category":"transport","amount":200,"period":"monthly","inflates":true,"essential":false},{"id":"e-ins","name":"Insurance","category":"insurance","amount":140,"period":"monthly","inflates":true,"essential":false},{"id":"e-health","name":"Health","category":"health","amount":220,"period":"monthly","inflates":true,"essential":false},{"id":"e-phone","name":"Phones","category":"phone","amount":95,"period":"monthly","inflates":true,"essential":false},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":45,"period":"monthly","inflates":true,"essential":false},{"id":"e-din","name":"Eating out","category":"dining","amount":180,"period":"monthly","inflates":true,"essential":false},{"id":"e-kids","name":"Kids' activities","category":"fun","amount":150,"period":"monthly","inflates":true,"essential":false}],"debts":[{"id":"d-car","accountId":"a-carloan","rate":0.059,"minPayment":340,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.249,"minPayment":95,"extra":105}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":12000,"targetDate":"2027-12-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":200,"rate":null,"inflates":false},{"id":"g-leo","name":"Leo's college","icon":"🎓","target":40000,"targetDate":"2032-08-15","priority":2,"saved":0,"fundedBy":["a-529l"],"monthly":150,"rate":0.06,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
