# H-0645  Three generations under one roof · One account of every type
- type: 07-multigenerational   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 07-multigenerational/accounts/H-0645-every-account-type.md`

**Household.** Linh, 46, and Bao, 48; Bao's mother Hoa (79) lives with them and gets Social Security; Duc (19) is in college, Mai is 15.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (5: 2 adults, 3 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Linh | Me | 1980-04-25 | 46 | 65 | 95 | no | 19 | 49 |
| Bao | Partner | 1977-11-11 | 48 | 65 | 95 | no | 17 | 47 |
| Hoa (Bao's mother) | Dependent | 1947-02-02 | 79 | - | 95 | - | - | 16 |
| Duc | Dependent | 2006-09-30 | 19 | - | 95 | - | - | 76 |
| Mai | Dependent | 2011-06-06 | 15 | - | 95 | - | - | 80 |
- filing: married_joint   state: CA   plan horizon: 49 years

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
| Linh's salary | salary | Linh | $5,200 | every month | 3% | yes | - | - |
| Bao's restaurant draw | business | Bao | $4,000 | every month | - | yes | - | - |
| Hoa's Social Security | social | Hoa (Bao's mother) | $1,350 | every month | - | yes | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $2,650 | every month | yes (default) | no | - | - |
| Utilities | utilities | $320 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $300 | every week | yes (default) | yes | - | - |
| Duc's tuition | childcare | $12,000 | once a year | yes (default) | yes | - | - |
| Hoa's medications and care | health | $900 | every month | yes (default) | yes | - | - |
| Gas | transport | $340 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $700 | every three months | yes (default) | yes | - | - |
| Health premiums | health | $520 | every month | yes (default) | yes | - | - |
| Phones | phone | $180 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $70 | every month | no (default) | yes | - | - |
| Eating out | dining | $350 | every month | no (default) | yes | - | - |
| Family remittances | giving | $300 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $30,000 | 2028-01-01 | 1 | $0 | - | $400 | plan default | no |
| Mai's college | $50,000 | 2029-08-15 | 2 | $8,000 | - | $500 | 4% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 5 (2 adults, 3 dependents); 19 years until Linh retires (2045); plan must last 49 years
- **Income**: $10,550/mo, $126,600/yr, next year $128,472; by person: Linh $5,200/mo (49%), Bao $4,000/mo (38%), Hoa (Bao's mother) $1,350/mo (13%)
- **Expenses**: $8,163/mo, $97,960/yr; must-pay $7,443, nice-to-have $720; left over $2,387 (23% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.4 months of must-pay (0.4 of all spending); target $44,660 (6 months), gap $41,360, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $8,000 of $84,502; needed $3,205/mo vs $900/mo going in
  - Emergency fund: behind; $0 of $30,000, 15 months left, needs $1,977/mo, putting in $400/mo (rate 2%)
  - Mai's college: behind; $8,000 of $54,502, 35 months left, needs $1,228/mo, putting in $500/mo (rate 4%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-linh","name":"Linh","role":"self","birthDate":"1980-04-25"},{"id":"p-bao","name":"Bao","role":"partner","birthDate":"1977-11-11"},{"id":"p-hoa","name":"Hoa (Bao's mother)","role":"dependent","birthDate":"1947-02-02"},{"id":"p-duc","name":"Duc","role":"dependent","birthDate":"2006-09-30"},{"id":"p-mai","name":"Mai","role":"dependent","birthDate":"2011-06-06"}],"filingStatus":"married_joint","state":"CA"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-linh","name":"Linh's salary","type":"salary","personId":"p-linh","amount":5200,"period":"monthly","growth":0.03,"taxable":true},{"id":"i-bao","name":"Bao's restaurant draw","type":"business","personId":"p-bao","amount":4000,"period":"monthly","growth":0,"taxable":true},{"id":"i-hoa","name":"Hoa's Social Security","type":"social","personId":"p-hoa","amount":1350,"period":"monthly","growth":0,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2650,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":320,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":300,"period":"weekly","inflates":true},{"id":"e-tuit","name":"Duc's tuition","category":"childcare","amount":12000,"period":"annual","inflates":true},{"id":"e-elder","name":"Hoa's medications and care","category":"health","amount":900,"period":"monthly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":340,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":700,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health premiums","category":"health","amount":520,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":180,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":70,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":350,"period":"monthly","inflates":true},{"id":"e-give","name":"Family remittances","category":"giving","amount":300,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":30000,"targetDate":"2028-01-01","priority":1,"saved":0,"fundedBy":[],"monthly":400,"rate":null,"inflates":false},{"id":"g-mai","name":"Mai's college","icon":"🎓","target":50000,"targetDate":"2029-08-15","priority":2,"saved":8000,"fundedBy":[],"monthly":500,"rate":0.04,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
