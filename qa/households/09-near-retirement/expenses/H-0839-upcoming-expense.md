# H-0839  Empty nesters five years from retiring · A big expense starting in January
- type: 09-near-retirement   pack: expenses   case: upcoming-expense
- status: pass 2026-09-16   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 09-near-retirement/expenses/H-0839-upcoming-expense.md`

**Household.** Gloria, 61, and Frank, 63, retiring at 65 and 66; big 401(k)s, a nearly paid-off house, a HELOC.

**The twist.** 3,000/mo from 2027-01-01.

**Why it matters.** Upcoming expense excluded until its date.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Gloria | Me | 1965-07-14 | 61 | 65 | 95 | no | 4 | 34 |
| Frank | Partner | 1963-03-28 | 63 | 66 | 95 | no | 3 | 32 |
- filing: married_joint   state: NC   plan horizon: 34 years

## Accounts (11)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $9,500 | 2026-09-15 | joint |
| Savings | savings | $38,000 | 2026-09-15 | joint |
| Brokerage | brokerage | $180,000 | 2026-09-15 | joint |
| Gloria's 401(k) | 401k | $410,000 | 2026-09-15 | Gloria |
| Frank's 401(k) | 401k | $520,000 | 2026-09-15 | Frank |
| Rollover IRA | ira | $130,000 | 2026-09-15 | Frank |
| Roth IRA | roth | $60,000 | 2026-09-15 | Gloria |
| House | property | $610,000 | 2026-09-15 | joint |
| Mortgage (almost done) | mortgage | $45,000 | 2026-09-15 | joint |
| HELOC | other_liability | $12,000 | 2026-09-15 | joint |
| Two cars | vehicle | $38,000 | 2026-09-15 | joint |

## Income (2)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Gloria's salary | salary | Gloria | $6,200 | every month | 2% | yes | - | - |
| Frank's salary | salary | Frank | $7,100 | every month | 2% | yes | - | - |

## Expenses (13)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $1,100 | every month | yes (default) | no | - | - |
| Utilities | utilities | $260 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $180 | every week | yes (default) | yes | - | - |
| Gas | transport | $230 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $1,400 | every three months | yes (default) | yes | - | - |
| Health premiums | health | $640 | every month | yes (default) | yes | - | - |
| Phones | phone | $120 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $60 | every month | no (default) | yes | - | - |
| Eating out | dining | $400 | every month | no (default) | yes | - | - |
| Travel | travel | $8,000 | once a year | no (default) | yes | - | - |
| HELOC payment | debt | $150 | every month | yes (default) | no | - | - |
| Giving | giving | $250 | every month | no (default) | yes | - | - |
| College tuition | childcare | $3,000 | every month | yes (default) | yes | 2027-01-01 | - |

## Debts (2 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage (almost done) | 3.3% | $1,100 | $0 | 180 months from 2016-01-01 |
| HELOC | 8.5% | $150 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Retirement cash cushion | $120,000 | 2030-07-14 | 1 | $0 | Savings | $1,500 | plan default | no |
| RV for the first year | $70,000 | 2030-08-01 | 2 | $15,000 | - | $800 | 4% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); 4 years until Gloria retires (2030); plan must last 34 years
- **Income**: $13,300/mo, $159,600/yr, next year $162,792; by person: Gloria $6,200/mo (47%), Frank $7,100/mo (53%)
- **Expenses**: $5,123/mo, $61,480/yr; must-pay $3,747, nice-to-have $1,377; left over $8,177 (61% of income); warnings: loan and card payments here (150) differ from Debts (1250)
- **Net worth**: $1,938,500 = own $1,995,500 - owe $57,000; liquid $227,500; cash $47,500; invested $1,300,000 ($1,060,000 pre-tax, $60,000 tax-free, $180,000 taxable)
- **Emergency fund**: usable today $9,500, within a week $180,000, locked up $1,768,000; 2.5 months of must-pay (1.9 of all spending); target $22,480 (6 months), gap $12,980, status bad
- **Debts**: 2 debts, owed $57,000, paying $1,250/mo (required $1,250), interest $207/mo, avg rate 4.4%, DTI 9%, 0 without details
  - Mortgage (almost done): owed $45,000, 3.3%, $1,100/mo, 44 months -> 2030-05-15, $2,759 interest to come
  - HELOC: owed $12,000, 8.5%, $150/mo, 119 months -> 2036-08-15, $5,772 interest to come
- **Goals**: 2 goals, 0 reached; saved $53,000 of $198,398; needed $2,793/mo vs $2,300/mo going in
  - Retirement cash cushion: behind; $38,000 of $120,000, 45 months left, needs $1,565/mo, putting in $1,500/mo (rate 4%)
  - RV for the first year: behind; $15,000 of $78,398, 46 months left, needs $1,228/mo, putting in $800/mo (rate 4%)

## Also check
- [ ] not in Per month
- [ ] row tagged not yet
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-gloria","name":"Gloria","role":"self","birthDate":"1965-07-14","retirementAge":65},{"id":"p-frank","name":"Frank","role":"partner","birthDate":"1963-03-28","retirementAge":66}],"filingStatus":"married_joint","state":"NC"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":9500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":38000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage","type":"brokerage","balance":180000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401g","name":"Gloria's 401(k)","type":"401k","balance":410000,"asOf":"2026-09-15","ownerId":"Gloria","institution":"","history":[]},{"id":"a-401f","name":"Frank's 401(k)","type":"401k","balance":520000,"asOf":"2026-09-15","ownerId":"Frank","institution":"","history":[]},{"id":"a-ira","name":"Rollover IRA","type":"ira","balance":130000,"asOf":"2026-09-15","ownerId":"Frank","institution":"","history":[]},{"id":"a-roth","name":"Roth IRA","type":"roth","balance":60000,"asOf":"2026-09-15","ownerId":"Gloria","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":610000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage (almost done)","type":"mortgage","balance":45000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-heloc","name":"HELOC","type":"other_liability","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-car","name":"Two cars","type":"vehicle","balance":38000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-gloria","name":"Gloria's salary","type":"salary","personId":"p-gloria","amount":6200,"period":"monthly","growth":0.02,"taxable":true},{"id":"i-frank","name":"Frank's salary","type":"salary","personId":"p-frank","amount":7100,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":1100,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":260,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":180,"period":"weekly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":230,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":1400,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health premiums","category":"health","amount":640,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":120,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":60,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":400,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":8000,"period":"annual","inflates":true},{"id":"e-heloc","name":"HELOC payment","category":"debt","amount":150,"period":"monthly","inflates":false},{"id":"e-give","name":"Giving","category":"giving","amount":250,"period":"monthly","inflates":true},{"id":"e-tuition","name":"College tuition","category":"childcare","amount":3000,"period":"monthly","inflates":true,"startDate":"2027-01-01"}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.0325,"minPayment":1100,"extra":0,"termMonths":180,"startDate":"2016-01-01"},{"id":"d-heloc","accountId":"a-heloc","rate":0.085,"minPayment":150,"extra":0}],"goals":[{"id":"g-retire","name":"Retirement cash cushion","icon":"🛟","target":120000,"targetDate":"2030-07-14","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":1500,"rate":null,"inflates":false},{"id":"g-rv","name":"RV for the first year","icon":"🚐","target":70000,"targetDate":"2030-08-01","priority":2,"saved":15000,"fundedBy":[],"monthly":800,"rate":0.04,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
