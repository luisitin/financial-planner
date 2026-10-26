# H-0731  Retired couple · Main must-pay expense typed semimonthly
- type: 08-retired   pack: expenses   case: period-semimonthly
- status: pass 2026-09-16   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 08-retired/expenses/H-0731-period-semimonthly.md`

**Household.** Ruth, 72, retired at 62, plans to 100; Sam, 69, retires at 70 next year; Social Security, a pension, dividends and a rental.

**The twist.** Property tax: 200 semimonthly.

**Why it matters.** Same yearly total on another period: monthly and must-pay unchanged.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Ruth | Me | 1954-03-10 | 72 | 62 | 100 | yes | 0 | 28 |
| Sam | Partner | 1957-06-20 | 69 | 70 | 90 | no | 1 | 21 |
- filing: married_joint   state: AZ   plan horizon: 28 years

## Accounts (8)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Joint checking | checking | $8,000 | 2026-09-15 | joint |
| Joint savings | savings | $45,000 | 2026-09-15 | joint |
| Brokerage | brokerage | $120,000 | 2026-09-15 | joint |
| Ruth's IRA | ira | $310,000 | 2026-09-15 | Ruth |
| Sam's Roth | roth | $60,000 | 2026-09-15 | Sam |
| House | property | $520,000 | 2026-09-15 | joint |
| Car | vehicle | $12,000 | 2026-09-15 | joint |
| Visa | credit | $2,300 | 2026-09-15 | joint |

## Income (4)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Ruth's Social Security | social | Ruth | $2,100 | every month | - | yes | - | - |
| Sam's pension | pension | Sam | $750 | twice a month | - | yes | - | - |
| Dividends | investment | Household | $1,200 | every three months | - | yes | - | - |
| Rental duplex | rental | Sam | $2,000 | every month | 2% | yes | - | - |

## Expenses (8)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Property tax | taxes | $200 | twice a month | yes (default) | yes | - | - |
| Groceries | groceries | $150 | every week | yes (default) | yes | - | - |
| Medicare premiums | health | $370 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $210 | every month | yes (default) | yes | - | - |
| Home and car insurance | insurance | $1,200 | every three months | yes (default) | yes | - | - |
| Travel | travel | $6,000 | once a year | no (default) | yes | - | - |
| Eating out | dining | $250 | every month | no (default) | yes | - | - |
| Gifts | giving | $100 | every month | no (default) | no | - | - |

## Debts (1 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Visa | 21.9% | $75 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Grandkids' trip | $12,000 | 2027-06-01 | 2 | $3,000 | - | $500 | plan default | no |
| New car | $20,000 | 2028-01-01 | 3 | $20,000 | - | $0 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); Ruth is retired; plan must last 28 years
- **Income**: $6,000/mo, $72,000/yr, next year $72,480; by person: Ruth $2,100/mo (35%), Sam $3,500/mo (58%), Household $400/mo (7%)
- **Expenses**: $2,955/mo, $35,460/yr; must-pay $2,105, nice-to-have $850; left over $3,045 (51% of income)
- **Net worth**: $1,072,700 = own $1,075,000 - owe $2,300; liquid $173,000; cash $53,000; invested $490,000 ($310,000 pre-tax, $60,000 tax-free, $120,000 taxable)
- **Emergency fund**: usable today $53,000, within a week $120,000, locked up $902,000; 25.2 months of must-pay (17.9 of all spending); target $12,630 (6 months), gap $0, status ok
- **Debts**: 1 debts, owed $2,300, paying $75/mo (required $75), interest $42/mo, avg rate 21.9%, DTI 1%, 0 without details
  - Visa: owed $2,300, 21.9%, $75/mo, 46 months -> 2030-07-15, $1,102 interest to come, expensive
- **Goals**: 2 goals, 1 reached; saved $23,000 of $32,000; needed $1,113/mo vs $500/mo going in
  - Grandkids' trip: behind; $3,000 of $12,000, 8 months left, needs $1,113/mo, putting in $500/mo (rate 2%)
  - New car: done; $20,000 of $20,000, 15 months left, needs $0/mo

## Also check
- [ ] Expenses per month unchanged
- [ ] must-pay unchanged
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-ruth","name":"Ruth","role":"self","birthDate":"1954-03-10","retirementAge":62,"lifeExpectancy":100},{"id":"p-sam","name":"Sam","role":"partner","birthDate":"1957-06-20","retirementAge":70,"lifeExpectancy":90}],"filingStatus":"married_joint","state":"AZ"},"accounts":[{"id":"a-chk","name":"Joint checking","type":"checking","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Joint savings","type":"savings","balance":45000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage","type":"brokerage","balance":120000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-ira","name":"Ruth's IRA","type":"ira","balance":310000,"asOf":"2026-09-15","ownerId":"Ruth","institution":"","history":[]},{"id":"a-roth","name":"Sam's Roth","type":"roth","balance":60000,"asOf":"2026-09-15","ownerId":"Sam","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":520000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-car","name":"Car","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Visa","type":"credit","balance":2300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-ss","name":"Ruth's Social Security","type":"social","personId":"p-ruth","amount":2100,"period":"monthly","growth":0,"taxable":true},{"id":"i-pen","name":"Sam's pension","type":"pension","personId":"p-sam","amount":750,"period":"semimonthly","growth":0,"taxable":true},{"id":"i-div","name":"Dividends","type":"investment","personId":"","amount":1200,"period":"quarterly","growth":0,"taxable":true},{"id":"i-rent","name":"Rental duplex","type":"rental","personId":"p-sam","amount":2000,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-tax","name":"Property tax","category":"taxes","amount":200,"period":"semimonthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":150,"period":"weekly","inflates":true},{"id":"e-med","name":"Medicare premiums","category":"health","amount":370,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":210,"period":"monthly","inflates":true},{"id":"e-ins","name":"Home and car insurance","category":"insurance","amount":1200,"period":"quarterly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":6000,"period":"annual","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":250,"period":"monthly","inflates":true},{"id":"e-gift","name":"Gifts","category":"giving","amount":100,"period":"monthly","inflates":false}],"debts":[{"id":"d-visa","accountId":"a-visa","rate":0.219,"minPayment":75,"extra":0}],"goals":[{"id":"g-trip","name":"Grandkids' trip","icon":"✈️","target":12000,"targetDate":"2027-06-01","priority":2,"saved":3000,"fundedBy":[],"monthly":500,"rate":null,"inflates":false},{"id":"g-car","name":"New car","icon":"🚗","target":20000,"targetDate":"2028-01-01","priority":3,"saved":20000,"fundedBy":[],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
