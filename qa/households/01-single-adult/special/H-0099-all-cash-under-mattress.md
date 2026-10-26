# H-0099  Single adult, renting · Everything is cash
- type: 01-single-adult   pack: special   case: all-cash-under-mattress
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 01-single-adult/special/H-0099-all-cash-under-mattress.md`

**Household.** Maya, 29, software support, one income, small savings, a car loan and one card.

**The twist.** One 25,000 cash account.

**Why it matters.** cash type counts as usable today and taxable-but-not-invested.

## People (1: 1 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Maya | Me | 1997-05-04 | 29 | 65 | 95 | no | 36 | 66 |
- filing: single   state: CO   plan horizon: 66 years

## Accounts (1)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Cash at home | cash | $25,000 | 2026-09-15 | joint |

## Income (1)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Maya's pay | salary | Maya | $2,450 | every two weeks | 3% | yes | - | - |

## Expenses (10)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Rent | housing | $1,450 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $120 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $90 | every week | yes (default) | yes | - | - |
| Car payment | debt | $310 | every month | yes (default) | no | - | - |
| Gas | transport | $160 | every month | yes (default) | yes | - | - |
| Car insurance | insurance | $95 | every month | yes (default) | yes | - | - |
| Phone | phone | $70 | every month | yes (default) | yes | - | - |
| Streaming | subscriptions | $40 | every month | no (default) | yes | - | - |
| Eating out | dining | $220 | every month | no (default) | yes | - | - |
| Fun | fun | $120 | every month | no (default) | yes | - | - |

## Debts (2 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| (missing account a-carloan) | 6.9% | $310 | $0 | - |
| (missing account a-visa) | 22.9% | $60 | $0 | - |

## Goals (1)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $10,000 | 2027-12-31 | 1 | $0 | - | $250 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 1 (1 adults, 0 dependents); 36 years until Maya retires (2062); plan must last 66 years
- **Income**: $5,308/mo, $63,700/yr, next year $65,611; by person: Maya $5,308/mo (100%)
- **Expenses**: $2,975/mo, $35,700/yr; must-pay $2,595, nice-to-have $380; left over $2,333 (44% of income)
- **Net worth**: $25,000 = own $25,000 - owe $0; liquid $25,000; cash $25,000; invested $0 ($0 pre-tax, $0 tax-free, $0 taxable)
- **Emergency fund**: usable today $25,000, within a week $0, locked up $0; 9.6 months of must-pay (8.4 of all spending); target $15,570 (6 months), gap $0, status ok
- **Debts**: 0 debts, owed $0, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 0 without details
- **Goals**: 1 goals, 0 reached; saved $0 of $10,000; needed $659/mo vs $250/mo going in
  - Emergency fund: behind; $0 of $10,000, 15 months left, needs $659/mo, putting in $250/mo (rate 2%)

## Also check
- [ ] usable today 25,000
- [ ] invested $0
- [ ] net worth 25,000
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-maya","name":"Maya","role":"self","birthDate":"1997-05-04"}],"filingStatus":"single","state":"CO"},"accounts":[{"id":"a-cash","name":"Cash at home","type":"cash","balance":25000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-pay","name":"Maya's pay","type":"salary","personId":"p-maya","amount":2450,"period":"biweekly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-rent","name":"Rent","category":"housing","amount":1450,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":120,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":90,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":310,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":160,"period":"monthly","inflates":true},{"id":"e-ins","name":"Car insurance","category":"insurance","amount":95,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phone","category":"phone","amount":70,"period":"monthly","inflates":true},{"id":"e-sub","name":"Streaming","category":"subscriptions","amount":40,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":220,"period":"monthly","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":120,"period":"monthly","inflates":true}],"debts":[{"id":"d-car","accountId":"a-carloan","rate":0.069,"minPayment":310,"extra":0},{"id":"d-visa","accountId":"a-visa","rate":0.229,"minPayment":60,"extra":0}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":10000,"targetDate":"2027-12-31","priority":1,"saved":0,"fundedBy":[],"monthly":250,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
