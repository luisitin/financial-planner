# H-0745  Retired couple · One account of every type
- type: 08-retired   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 08-retired/accounts/H-0745-every-account-type.md`

**Household.** Ruth, 72, retired at 62, plans to 100; Sam, 69, retires at 70 next year; Social Security, a pension, dividends and a rental.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Ruth | Me | 1954-03-10 | 72 | 62 | 100 | yes | 0 | 28 |
| Sam | Partner | 1957-06-20 | 69 | 70 | 90 | no | 1 | 21 |
- filing: married_joint   state: AZ   plan horizon: 28 years

## Accounts (19)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $1,000 | 2026-09-15 | joint |
| Savings | savings | $2,000 | 2026-09-15 | joint |
| Cash | cash | $300 | 2026-09-15 | joint |
| Brokerage | brokerage | $4,000 | 2026-09-15 | joint |
| 401(k) | 401k | $5,000 | 2026-09-15 | joint |
| IRA | ira | $6,000 | 2026-09-15 | joint |
| Roth | roth | $7,000 | 2026-09-15 | joint |
| HSA | hsa | $800 | 2026-09-15 | joint |
| 529 | 529 | $900 | 2026-09-15 | joint |
| Crypto | crypto | $1,100 | 2026-09-15 | joint |
| Property | property | $200,000 | 2026-09-15 | joint |
| Vehicle | vehicle | $12,000 | 2026-09-15 | joint |
| Life cash value | cash_value_life | $3,000 | 2026-09-15 | joint |
| Other asset | other_asset | $1,500 | 2026-09-15 | joint |
| Card | credit | $2,500 | 2026-09-15 | joint |
| Loan | loan | $8,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $150,000 | 2026-09-15 | joint |
| Student loan | student_loan | $20,000 | 2026-09-15 | joint |
| Other liability | other_liability | $700 | 2026-09-15 | joint |

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
| Property tax | taxes | $4,800 | once a year | yes (default) | yes | - | - |
| Groceries | groceries | $150 | every week | yes (default) | yes | - | - |
| Medicare premiums | health | $370 | every month | yes (default) | yes | - | - |
| Utilities | utilities | $210 | every month | yes (default) | yes | - | - |
| Home and car insurance | insurance | $1,200 | every three months | yes (default) | yes | - | - |
| Travel | travel | $6,000 | once a year | no (default) | yes | - | - |
| Eating out | dining | $250 | every month | no (default) | yes | - | - |
| Gifts | giving | $100 | every month | no (default) | no | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Grandkids' trip | $12,000 | 2027-06-01 | 2 | $3,000 | - | $500 | plan default | no |
| New car | $20,000 | 2028-01-01 | 3 | $20,000 | - | $0 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); Ruth is retired; plan must last 28 years
- **Income**: $6,000/mo, $72,000/yr, next year $72,480; by person: Ruth $2,100/mo (35%), Sam $3,500/mo (58%), Household $400/mo (7%)
- **Expenses**: $2,880/mo, $34,560/yr; must-pay $2,030, nice-to-have $850; left over $3,120 (52% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 1.6 months of must-pay (1.1 of all spending); target $12,180 (6 months), gap $8,880, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 1 reached; saved $23,000 of $32,000; needed $1,113/mo vs $500/mo going in
  - Grandkids' trip: behind; $3,000 of $12,000, 8 months left, needs $1,113/mo, putting in $500/mo (rate 2%)
  - New car: done; $20,000 of $20,000, 15 months left, needs $0/mo

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-ruth","name":"Ruth","role":"self","birthDate":"1954-03-10","retirementAge":62,"lifeExpectancy":100},{"id":"p-sam","name":"Sam","role":"partner","birthDate":"1957-06-20","retirementAge":70,"lifeExpectancy":90}],"filingStatus":"married_joint","state":"AZ"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-ss","name":"Ruth's Social Security","type":"social","personId":"p-ruth","amount":2100,"period":"monthly","growth":0,"taxable":true},{"id":"i-pen","name":"Sam's pension","type":"pension","personId":"p-sam","amount":750,"period":"semimonthly","growth":0,"taxable":true},{"id":"i-div","name":"Dividends","type":"investment","personId":"","amount":1200,"period":"quarterly","growth":0,"taxable":true},{"id":"i-rent","name":"Rental duplex","type":"rental","personId":"p-sam","amount":2000,"period":"monthly","growth":0.02,"taxable":true}],"expenses":[{"id":"e-tax","name":"Property tax","category":"taxes","amount":4800,"period":"annual","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":150,"period":"weekly","inflates":true},{"id":"e-med","name":"Medicare premiums","category":"health","amount":370,"period":"monthly","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":210,"period":"monthly","inflates":true},{"id":"e-ins","name":"Home and car insurance","category":"insurance","amount":1200,"period":"quarterly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":6000,"period":"annual","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":250,"period":"monthly","inflates":true},{"id":"e-gift","name":"Gifts","category":"giving","amount":100,"period":"monthly","inflates":false}],"debts":[],"goals":[{"id":"g-trip","name":"Grandkids' trip","icon":"✈️","target":12000,"targetDate":"2027-06-01","priority":2,"saved":3000,"fundedBy":[],"monthly":500,"rate":null,"inflates":false},{"id":"g-car","name":"New car","icon":"🚗","target":20000,"targetDate":"2028-01-01","priority":3,"saved":20000,"fundedBy":[],"monthly":0,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
