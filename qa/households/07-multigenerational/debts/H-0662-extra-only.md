# H-0662  Three generations under one roof · Minimum 0, extra 300
- type: 07-multigenerational   pack: debts   case: extra-only
- status: pass 2026-09-16   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 07-multigenerational/debts/H-0662-extra-only.md`

**Household.** Linh, 46, and Bao, 48; Bao's mother Hoa (79) lives with them and gets Social Security; Duc (19) is in college, Mai is 15.

**The twist.** Credit card: min 0, extra 300.

**Why it matters.** payment = min + extra; minimums tile shows 0.

## People (5: 2 adults, 3 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Linh | Me | 1980-04-25 | 46 | 65 | 95 | no | 19 | 49 |
| Bao | Partner | 1977-11-11 | 48 | 65 | 95 | no | 17 | 47 |
| Hoa (Bao's mother) | Dependent | 1947-02-02 | 79 | - | 95 | - | - | 16 |
| Duc | Dependent | 2006-09-30 | 19 | - | 95 | - | - | 76 |
| Mai | Dependent | 2011-06-06 | 15 | - | 95 | - | - | 80 |
- filing: married_joint   state: CA   plan horizon: 49 years

## Accounts (9)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $6,100 | 2026-09-15 | joint |
| Savings | savings | $19,000 | 2026-09-15 | joint |
| Brokerage | brokerage | $27,000 | 2026-09-15 | joint |
| Linh's 401(k) | 401k | $143,000 | 2026-09-15 | Linh |
| Bao's SEP IRA | ira | $88,000 | 2026-09-15 | Bao |
| Duc's 529 | 529 | $11,000 | 2026-09-15 | joint |
| House | property | $690,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $412,000 | 2026-09-15 | joint |
| Credit card | credit | $2,700 | 2026-09-15 | joint |

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

## Debts (2 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 5.8% | $2,650 | $0 | 360 months from 2020-10-01 |
| Credit card | 20.9% | $0 | $300 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $30,000 | 2028-01-01 | 1 | $0 | Savings | $400 | plan default | no |
| Mai's college | $50,000 | 2029-08-15 | 2 | $8,000 | - | $500 | 4% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 5 (2 adults, 3 dependents); 19 years until Linh retires (2045); plan must last 49 years
- **Income**: $10,550/mo, $126,600/yr, next year $128,472; by person: Linh $5,200/mo (49%), Bao $4,000/mo (38%), Hoa (Bao's mother) $1,350/mo (13%)
- **Expenses**: $11,113/mo, $133,360/yr; must-pay $10,393, nice-to-have $720; left over -$563 (-5% of income); warnings: spend 563 more than comes in
- **Net worth**: $569,400 = own $984,100 - owe $414,700; liquid $52,100; cash $25,100; invested $269,000 ($231,000 pre-tax, $11,000 tax-free, $27,000 taxable)
- **Emergency fund**: usable today $6,100, within a week $27,000, locked up $932,000; 0.6 months of must-pay (0.5 of all spending); target $62,360 (6 months), gap $56,260, status bad
- **Debts**: 2 debts, owed $414,700, paying $2,950/mo (required $2,650), interest $2,021/mo, avg rate 5.8%, DTI 28%, 0 without details
  - Mortgage: owed $412,000, 5.8%, $2,650/mo, 286 months -> 2050-07-15, $345,471 interest to come
  - Credit card: owed $2,700, 20.9%, $300/mo, 10 months -> 2027-07-15, $262 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $27,000 of $84,502; needed $1,921/mo vs $900/mo going in
  - Emergency fund: behind; $19,000 of $30,000, 15 months left, needs $693/mo, putting in $400/mo (rate 2%)
  - Mai's college: behind; $8,000 of $54,502, 35 months left, needs $1,228/mo, putting in $500/mo (rate 4%)

## Also check
- [ ] Paying each month 300 (required 0 + extra)
- [ ] payoff computed on 300
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-linh","name":"Linh","role":"self","birthDate":"1980-04-25"},{"id":"p-bao","name":"Bao","role":"partner","birthDate":"1977-11-11"},{"id":"p-hoa","name":"Hoa (Bao's mother)","role":"dependent","birthDate":"1947-02-02"},{"id":"p-duc","name":"Duc","role":"dependent","birthDate":"2006-09-30"},{"id":"p-mai","name":"Mai","role":"dependent","birthDate":"2011-06-06"}],"filingStatus":"married_joint","state":"CA"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":6100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Savings","type":"savings","balance":19000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage","type":"brokerage","balance":27000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401l","name":"Linh's 401(k)","type":"401k","balance":143000,"asOf":"2026-09-15","ownerId":"Linh","institution":"","history":[]},{"id":"a-sep","name":"Bao's SEP IRA","type":"ira","balance":88000,"asOf":"2026-09-15","ownerId":"Bao","institution":"","history":[]},{"id":"a-529","name":"Duc's 529","type":"529","balance":11000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":690000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":412000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-visa","name":"Credit card","type":"credit","balance":2700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-linh","name":"Linh's salary","type":"salary","personId":"p-linh","amount":5200,"period":"monthly","growth":0.03,"taxable":true},{"id":"i-bao","name":"Bao's restaurant draw","type":"business","personId":"p-bao","amount":4000,"period":"monthly","growth":0,"taxable":true},{"id":"i-hoa","name":"Hoa's Social Security","type":"social","personId":"p-hoa","amount":1350,"period":"monthly","growth":0,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":2650,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":320,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":300,"period":"weekly","inflates":true},{"id":"e-tuit","name":"Duc's tuition","category":"childcare","amount":12000,"period":"annual","inflates":true},{"id":"e-elder","name":"Hoa's medications and care","category":"health","amount":900,"period":"monthly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":340,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":700,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health premiums","category":"health","amount":520,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":180,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":70,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":350,"period":"monthly","inflates":true},{"id":"e-give","name":"Family remittances","category":"giving","amount":300,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.0575,"minPayment":2650,"extra":0,"termMonths":360,"startDate":"2020-10-01"},{"id":"d-visa","accountId":"a-visa","rate":0.209,"minPayment":0,"extra":300}],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":30000,"targetDate":"2028-01-01","priority":1,"saved":0,"fundedBy":["a-sav"],"monthly":400,"rate":null,"inflates":false},{"id":"g-mai","name":"Mai's college","icon":"🎓","target":50000,"targetDate":"2029-08-15","priority":2,"saved":8000,"fundedBy":[],"monthly":500,"rate":0.04,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
