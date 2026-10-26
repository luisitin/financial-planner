# H-0177  Couple, no kids, own a condo · Two goals share one account
- type: 02-couple-no-kids   pack: goals   case: two-goals-one-account
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 02-couple-no-kids/goals/H-0177-two-goals-one-account.md`

**Household.** Priya, 34, and Tom, 36, two salaries, a mortgage, saving for a remodel and a baby.

**The twist.** both fundedBy Joint savings.

**Why it matters.** F-013: balance counted in full for both.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Priya | Me | 1992-02-11 | 34 | 65 | 95 | no | 31 | 61 |
| Tom | Partner | 1989-10-03 | 36 | 65 | 95 | no | 29 | 59 |
- filing: married_joint   state: WA   plan horizon: 61 years

## Accounts (8)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Joint checking | checking | $7,000 | 2026-09-15 | joint |
| Joint savings | savings | $22,000 | 2026-09-15 | joint |
| Brokerage | brokerage | $35,000 | 2026-09-15 | joint |
| Priya's 401(k) | 401k | $92,000 | 2026-09-15 | Priya |
| Tom's Roth | roth | $41,000 | 2026-09-15 | Tom |
| HSA | hsa | $5,200 | 2026-09-15 | Priya |
| Condo | property | $420,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $298,000 | 2026-09-15 | joint |

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Priya's salary | salary | Priya | $4,100 | twice a month | 4% | yes | - | - |
| Tom's salary | salary | Tom | $5,900 | every month | 2% | yes | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $2,150 | every month | yes (default) | no | - | - |
| HOA dues | housing | $380 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $210 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $175 | every week | yes (default) | yes | - | - |
| Gas and parking | transport | $240 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $1,050 | every three months | yes (default) | yes | - | - |
| Health | health | $180 | every month | yes (default) | yes | - | - |
| Phones | phone | $130 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $65 | every month | no (default) | yes | - | - |
| Eating out | dining | $450 | every month | no (default) | yes | - | - |
| Travel | travel | $5,000 | once a year | no (default) | yes | - | - |
| Fun | fun | $200 | every month | no (default) | yes | - | - |

## Debts (1 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 5.5% | $2,150 | $0 | 360 months from 2023-03-01 |

## Goals (4)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Kitchen remodel | $25,000 | 2028-06-01 | 2 | $6,000 | - | $600 | plan default | no |
| Baby fund | $15,000 | 2027-09-01 | 1 | $2,000 | - | $400 | plan default | no |
| Share A | $30,000 | 2028-01-01 | 2 | $0 | Joint savings | $0 | plan default | no |
| Share B | $30,000 | 2028-01-01 | 2 | $0 | Joint savings | $0 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); 31 years until Priya retires (2057); plan must last 61 years
- **Income**: $14,100/mo, $169,200/yr, next year $174,552; by person: Priya $8,200/mo (58%), Tom $5,900/mo (42%)
- **Expenses**: $7,680/mo, $92,160/yr; must-pay $6,548, nice-to-have $1,132; left over $6,420 (46% of income)
- **Net worth**: $324,200 = own $622,200 - owe $298,000; liquid $64,000; cash $29,000; invested $173,200 ($92,000 pre-tax, $46,200 tax-free, $35,000 taxable)
- **Emergency fund**: usable today $7,000, within a week $35,000, locked up $558,200; 1.1 months of must-pay (0.9 of all spending); target $39,290 (6 months), gap $32,290, status bad
- **Debts**: 1 debts, owed $298,000, paying $2,150/mo (required $2,150), interest $1,366/mo, avg rate 5.5%, DTI 15%, 0 without details
  - Mortgage: owed $298,000, 5.5%, $2,150/mo, 221 months -> 2045-02-15, $176,210 interest to come
- **Goals**: 4 goals, 0 reached; saved $30,000 of $100,000; needed $4,561/mo vs $1,000/mo going in
  - Kitchen remodel: behind; $6,000 of $25,000, 20 months left, needs $925/mo, putting in $600/mo (rate 2%)
  - Baby fund: behind; $2,000 of $15,000, 11 months left, needs $1,169/mo, putting in $400/mo (rate 2%)
  - Share A: behind; $22,000 of $30,000, 15 months left, needs $490/mo (rate 2%)
  - Share B: behind; $0 of $30,000, 15 months left, needs $1,977/mo (rate 2%)

## Also check
- [ ] F-013: both rows show the full balance
- [ ] Saved so far exceeds the real money
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-priya","name":"Priya","role":"self","birthDate":"1992-02-11"},{"id":"p-tom","name":"Tom","role":"partner","birthDate":"1989-10-03"}],"filingStatus":"married_joint","state":"WA"},"accounts":[{"id":"a-chk","name":"Joint checking","type":"checking","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Joint savings","type":"savings","balance":22000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage","type":"brokerage","balance":35000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401k","name":"Priya's 401(k)","type":"401k","balance":92000,"asOf":"2026-09-15","ownerId":"Priya","institution":"","history":[]},{"id":"a-roth","name":"Tom's Roth","type":"roth","balance":41000,"asOf":"2026-09-15","ownerId":"Tom","institution":"","history":[]},{"id":"a-hsa","name":"HSA","type":"hsa","balance":5200,"asOf":"2026-09-15","ownerId":"Priya","institution":"","history":[]},{"id":"a-condo","name":"Condo","type":"property","balance":420000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":298000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-priya","name":"Priya's salary","type":"salary","personId":"p-priya","amount":4100,"period":"semimonthly","growth":0.04,"taxable":true},{"id":"i-tom","name":"Tom's salary","type":"salary","personId":"p-tom","amount":5900,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2150,"period":"monthly","inflates":false},{"id":"e-hoa","name":"HOA dues","category":"housing","amount":380,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":210,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":175,"period":"weekly","inflates":true},{"id":"e-car","name":"Gas and parking","category":"transport","amount":240,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":1050,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":180,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":130,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":65,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":450,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":5000,"period":"annual","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":200,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.055,"minPayment":2150,"extra":0,"termMonths":360,"startDate":"2023-03-01"}],"goals":[{"id":"g-kitchen","name":"Kitchen remodel","icon":"🛋️","target":25000,"targetDate":"2028-06-01","priority":2,"saved":6000,"fundedBy":[],"monthly":600,"rate":null,"inflates":false},{"id":"g-baby","name":"Baby fund","icon":"👶","target":15000,"targetDate":"2027-09-01","priority":1,"saved":2000,"fundedBy":[],"monthly":400,"rate":null,"inflates":false},{"id":"g-share1","name":"Share A","icon":"🎯","target":30000,"targetDate":"2028-01-01","priority":2,"saved":0,"fundedBy":["a-sav"],"monthly":0,"rate":null,"inflates":false},{"id":"g-share2","name":"Share B","icon":"🎯","target":30000,"targetDate":"2028-01-01","priority":2,"saved":0,"fundedBy":["a-sav"],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
