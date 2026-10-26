# H-1045  Freelancer with quarterly taxes, part-time spouse · One account of every type
- type: 11-self-employed   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 11-self-employed/accounts/H-1045-every-account-type.md`

**Household.** Nadia, 38, freelance designer (monthly draw plus an annual bonus); Omar, 40, part-time; quarterly tax payments are a must-pay expense.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (2: 2 adults, 0 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Nadia | Me | 1988-05-27 | 38 | 65 | 95 | no | 27 | 57 |
| Omar | Partner | 1986-08-08 | 40 | 65 | 95 | no | 25 | 55 |
- filing: married_joint   state: OR   plan horizon: 57 years

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

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Nadia's freelance draw | business | Nadia | $3,500 | every month | - | yes | - | - |
| Year-end client bonus | bonus | Nadia | $6,000 | once a year | - | yes | - | - |
| Omar's part-time pay | salary | Omar | $1,400 | every two weeks | 3% | yes | - | - |

## Expenses (11)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $2,300 | every month | yes (default) | no | - | - |
| Quarterly estimated taxes | taxes | $4,200 | every three months | yes (default) | no | - | - |
| Utilities | utilities | $230 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $190 | every week | yes (default) | yes | - | - |
| Health insurance (marketplace) | health | $890 | every month | yes (default) | yes | - | - |
| Gas | transport | $180 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $900 | every three months | yes (default) | yes | - | - |
| Phones | phone | $110 | every month | yes (default) | yes | - | - |
| Software subscriptions | subscriptions | $140 | every month | no (default) | yes | - | - |
| Eating out | dining | $280 | every month | no (default) | yes | - | - |
| Fun | fun | $160 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Six months of bills | $40,000 | 2029-01-01 | 1 | $0 | - | $600 | plan default | no |
| New workstation | $5,000 | 2027-02-01 | 2 | $1,500 | - | $300 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (2 adults, 0 dependents); 27 years until Nadia retires (2053); plan must last 57 years
- **Income**: $7,033/mo, $84,400/yr, next year $85,492; by person: Nadia $4,000/mo (57%), Omar $3,033/mo (43%)
- **Expenses**: $6,813/mo, $81,760/yr; must-pay $6,233, nice-to-have $580; left over $220 (3% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.5 months of must-pay (0.5 of all spending); target $37,400 (6 months), gap $34,100, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $1,500 of $45,000; needed $2,320/mo vs $900/mo going in
  - Six months of bills: behind; $0 of $40,000, 27 months left, needs $1,450/mo, putting in $600/mo (rate 2%)
  - New workstation: behind; $1,500 of $5,000, 4 months left, needs $870/mo, putting in $300/mo (rate 2%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-nadia","name":"Nadia","role":"self","birthDate":"1988-05-27"},{"id":"p-omar","name":"Omar","role":"partner","birthDate":"1986-08-08"}],"filingStatus":"married_joint","state":"OR"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-nadia","name":"Nadia's freelance draw","type":"business","personId":"p-nadia","amount":3500,"period":"monthly","growth":0,"taxable":true},{"id":"i-bonus","name":"Year-end client bonus","type":"bonus","personId":"p-nadia","amount":6000,"period":"annual","growth":0,"taxable":true},{"id":"i-omar","name":"Omar's part-time pay","type":"salary","personId":"p-omar","amount":1400,"period":"biweekly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2300,"period":"monthly","inflates":false},{"id":"e-tax","name":"Quarterly estimated taxes","category":"taxes","amount":4200,"period":"quarterly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":230,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":190,"period":"weekly","inflates":true},{"id":"e-health","name":"Health insurance (marketplace)","category":"health","amount":890,"period":"monthly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":180,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":900,"period":"quarterly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":110,"period":"monthly","inflates":true},{"id":"e-sub","name":"Software subscriptions","category":"subscriptions","amount":140,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":280,"period":"monthly","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":160,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Six months of bills","icon":"🛟","target":40000,"targetDate":"2029-01-01","priority":1,"saved":0,"fundedBy":[],"monthly":600,"rate":null,"inflates":false},{"id":"g-laptop","name":"New workstation","icon":"💻","target":5000,"targetDate":"2027-02-01","priority":2,"saved":1500,"fundedBy":[],"monthly":300,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
