# H-1103  High net worth, two teens, rental property · Main adult's birthday is tomorrow
- type: 12-high-net-worth   pack: ages-and-dates   case: birthday-tomorrow
- status: fail (results/H-1103.json)   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 12-high-net-worth/ages-and-dates/H-1103-birthday-tomorrow.md`

**Household.** Victoria, 52, and Henry, 55; Chloe (17) and Ben (15); $1.8M brokerage, a rental, a large mortgage they overpay, crypto and art.

**The twist.** Victoria was born 1974-09-16: turns 52 tomorrow, so is 51 today.

**Why it matters.** One day short of the birthday must NOT add the year.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Victoria | Me | 1974-09-16 | 51 | 65 | 95 | no | 14 | 44 |
| Henry | Partner | 1971-01-01 | 55 | 65 | 95 | no | 10 | 40 |
| Chloe | Dependent | 2009-07-21 | 17 | - | 95 | - | - | 78 |
| Ben | Dependent | 2010-10-10 | 15 | - | 95 | - | - | 80 |
- filing: married_joint   state: NJ   plan horizon: 44 years

## Accounts (16)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $42,000 | 2026-09-15 | joint |
| Money market | savings | $160,000 | 2026-09-15 | joint |
| Brokerage | brokerage | $1,850,000 | 2026-09-15 | joint |
| Victoria's 401(k) | 401k | $940,000 | 2026-09-15 | Victoria |
| Henry's Roth | roth | $210,000 | 2026-09-15 | Henry |
| Chloe's 529 | 529 | $140,000 | 2026-09-15 | joint |
| Ben's 529 | 529 | $95,000 | 2026-09-15 | joint |
| Crypto | crypto | $65,000 | 2026-09-15 | joint |
| Whole life cash value | cash_value_life | $85,000 | 2026-09-15 | joint |
| House | property | $1,650,000 | 2026-09-15 | joint |
| Rental condo | property | $720,000 | 2026-09-15 | joint |
| Art | other_asset | $120,000 | 2026-09-15 | joint |
| Tesla | vehicle | $90,000 | 2026-09-15 | joint |
| Range Rover | vehicle | $45,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $480,000 | 2026-09-15 | joint |
| Amex | credit | $9,800 | 2026-09-15 | joint |

## Income (4)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Victoria's salary | salary | Victoria | $22,000 | every month | 5% | yes | - | - |
| Henry's salary | salary | Henry | $15,000 | twice a month | 3% | yes | - | - |
| Rental condo income | rental | Household | $3,800 | every month | 3% | yes | - | - |
| Dividends | investment | Household | $9,000 | every three months | - | yes | - | - |

## Expenses (14)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $3,900 | every month | yes (default) | no | - | - |
| Property taxes | taxes | $32,000 | once a year | yes (default) | yes | - | - |
| Utilities | utilities | $650 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $400 | every week | yes (default) | yes | - | - |
| Private school | childcare | $58,000 | once a year | yes (default) | yes | - | - |
| Cars and gas | transport | $900 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $4,800 | every three months | yes (default) | yes | - | - |
| Health | health | $700 | every month | yes (default) | yes | - | - |
| Phones | phone | $260 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $190 | every month | no (default) | yes | - | - |
| Dining | dining | $1,800 | every month | no (default) | yes | - | - |
| Travel | travel | $40,000 | once a year | no (default) | yes | - | - |
| Giving | giving | $2,000 | every month | no (default) | yes | - | - |
| Housekeeper | personal | $1,600 | every month | no (default) | yes | - | - |

## Debts (2 with details)
| account | rate | minimum | extra | note |
|---|---|---|---|---|
| Mortgage | 4.1% | $3,900 | $1,000 | 360 months from 2019-06-01 |
| Amex | 22.9% | $9,800 | $0 | - |

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Lake house | $600,000 | 2031-06-01 | 2 | $0 | Brokerage | $5,000 | 6% | yes |
| Chloe's college | $320,000 | 2027-08-15 | 1 | $0 | Chloe's 529 | $3,000 | 4% | yes |

## Expected (tester's own math, today 2026-09-15)
- **People**: 4 (2 adults, 2 dependents); 14 years until Victoria retires (2039); plan must last 44 years
- **Income**: $58,800/mo, $705,600/yr, next year $730,968; by person: Victoria $22,000/mo (37%), Henry $30,000/mo (51%), Household $6,800/mo (12%)
- **Expenses**: $40,867/mo, $490,400/yr; must-pay $31,943, nice-to-have $8,923; left over $17,933 (30% of income)
- **Net worth**: $5,722,200 = own $6,212,000 - owe $489,800; liquid $2,117,000; cash $202,000; invested $3,300,000 ($940,000 pre-tax, $445,000 tax-free, $1,915,000 taxable)
- **Emergency fund**: usable today $202,000, within a week $1,915,000, locked up $4,095,000; 6.3 months of must-pay (4.9 of all spending); target $191,660 (6 months), gap $0, status ok
- **Debts**: 2 debts, owed $489,800, paying $14,700/mo (required $13,700), interest $1,827/mo, avg rate 4.5%, DTI 25%, 0 without details
  - Mortgage: owed $480,000, 4.1%, $4,900/mo, 120 months -> 2036-09-15, $105,426 interest to come
  - Amex: owed $9,800, 22.9%, $9,800/mo, 2 months -> 2026-11-15, $191 interest to come, expensive
- **Goals**: 2 goals, 0 reached; saved $740,000 of $1,017,534; needed $16,412/mo vs $8,000/mo going in
  - Lake house: on track; $600,000 of $688,745, 56 months left, needs $0/mo, putting in $5,000/mo (rate 6%)
  - Chloe's college: behind; $140,000 of $328,789, 11 months left, needs $16,412/mo, putting in $3,000/mo (rate 4%)

## Also check
- [ ] People shows age 51
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-victoria","name":"Victoria","role":"self","birthDate":"1974-09-16"},{"id":"p-henry","name":"Henry","role":"partner","birthDate":"1971-01-01"},{"id":"p-chloe","name":"Chloe","role":"dependent","birthDate":"2009-07-21"},{"id":"p-ben","name":"Ben","role":"dependent","birthDate":"2010-10-10"}],"filingStatus":"married_joint","state":"NJ"},"accounts":[{"id":"a-chk","name":"Checking","type":"checking","balance":42000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-sav","name":"Money market","type":"savings","balance":160000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-brk","name":"Brokerage","type":"brokerage","balance":1850000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-401v","name":"Victoria's 401(k)","type":"401k","balance":940000,"asOf":"2026-09-15","ownerId":"Victoria","institution":"","history":[]},{"id":"a-roth","name":"Henry's Roth","type":"roth","balance":210000,"asOf":"2026-09-15","ownerId":"Henry","institution":"","history":[]},{"id":"a-529c","name":"Chloe's 529","type":"529","balance":140000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-529b","name":"Ben's 529","type":"529","balance":95000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-crypto","name":"Crypto","type":"crypto","balance":65000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-life","name":"Whole life cash value","type":"cash_value_life","balance":85000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-home","name":"House","type":"property","balance":1650000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-rental","name":"Rental condo","type":"property","balance":720000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-art","name":"Art","type":"other_asset","balance":120000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-car1","name":"Tesla","type":"vehicle","balance":90000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-car2","name":"Range Rover","type":"vehicle","balance":45000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-mort","name":"Mortgage","type":"mortgage","balance":480000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"a-amex","name":"Amex","type":"credit","balance":9800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-victoria","name":"Victoria's salary","type":"salary","personId":"p-victoria","amount":22000,"period":"monthly","growth":0.05,"taxable":true},{"id":"i-henry","name":"Henry's salary","type":"salary","personId":"p-henry","amount":15000,"period":"semimonthly","growth":0.03,"taxable":true},{"id":"i-rent","name":"Rental condo income","type":"rental","personId":"","amount":3800,"period":"monthly","growth":0.03,"taxable":true},{"id":"i-div","name":"Dividends","type":"investment","personId":"","amount":9000,"period":"quarterly","growth":0,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":3900,"period":"monthly","inflates":false},{"id":"e-tax","name":"Property taxes","category":"taxes","amount":32000,"period":"annual","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":650,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":400,"period":"weekly","inflates":true},{"id":"e-school","name":"Private school","category":"childcare","amount":58000,"period":"annual","inflates":true},{"id":"e-cars","name":"Cars and gas","category":"transport","amount":900,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":4800,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":700,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":260,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":190,"period":"monthly","inflates":true},{"id":"e-din","name":"Dining","category":"dining","amount":1800,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":40000,"period":"annual","inflates":true},{"id":"e-give","name":"Giving","category":"giving","amount":2000,"period":"monthly","inflates":true},{"id":"e-help","name":"Housekeeper","category":"personal","amount":1600,"period":"monthly","inflates":true}],"debts":[{"id":"d-mort","accountId":"a-mort","rate":0.041,"minPayment":3900,"extra":1000,"termMonths":360,"startDate":"2019-06-01"},{"id":"d-amex","accountId":"a-amex","rate":0.229,"minPayment":9800,"extra":0}],"goals":[{"id":"g-lake","name":"Lake house","icon":"🏖️","target":600000,"targetDate":"2031-06-01","priority":2,"saved":0,"fundedBy":["a-brk"],"monthly":5000,"rate":0.06,"inflates":true},{"id":"g-chloe","name":"Chloe's college","icon":"🎓","target":320000,"targetDate":"2027-08-15","priority":1,"saved":0,"fundedBy":["a-529c"],"monthly":3000,"rate":0.04,"inflates":true}],"assumptions":{},"netWorthHistory":[]}
```
