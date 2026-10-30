# Student loans  (`debt/student-loans`)

**Status:** usable (phase 4)
**Purpose:** Federal student loans under each way to repay them, month by month on the household's own income: the standard 10-year plan, income-based repayment, the Repayment Assistance Plan and, for public-service workers, Public Service Loan Forgiveness; what each costs in all and in today's money.

## Inputs
`accounts` of type `student_loan` and their `debts` rate (through `balance/liabilities`), the household's adjusted gross income (`taxes/federal` `taxInputs` + `federalTax`) unless entered, `household` (size, children), `assumptions.salaryGrowth` and `inflation`, the plan's return (`planReturn`, the discount rate), `whatIfs.studentLoans`. Writes `whatIfs.studentLoans = { pslf, agi }`.

## Rules (as of 2026; check studentaid.gov)
- Standard: the level payment over 120 months.
- IBR (new borrowers since July 2014): 10% of (income - 150% of the poverty line for the household) / 12, never above the standard payment; unpaid interest accrues (not capitalised here); the rest forgiven after 20 years, taxable from 2026.
- RAP (One Big Beautiful Bill Act, 2025; new loans from July 1, 2026): income x `rapRate` (0% under $10,000, then 1% more per $10,000, at most 10%) / 12 - $50 a month per dependent, at least $10; interest the payment does not cover is waived and the principal falls by at least the lesser of $50 and the payment; the rest forgiven after 30 years, taxable.
- PSLF: income-driven payments (RAP or IBR, whichever costs less) for 120 months, the rest forgiven tax-free.
- Poverty line: `retirement/healthcare` `povertyLine` (2025 guidelines), rising with inflation. Income grows with pay.
- Tax on forgiveness = forgiven x the household's top federal rate now.
- Cost in today's money = each payment discounted at the plan's own return a month, plus the tax on forgiveness discounted the same; the cheapest is the lowest of these.

## Edge cases
- Private loans and refinancing are explained, not modelled; Parent PLUS and consolidation rules are not modelled.
- Married borrowers: the joint income is used (as on a joint return); filing separately can lower it (Filing status page).

## Tests
`module.test.mjs`: RAP's bands, the standard plan, IBR's payment, cap and forgiveness, RAP's payment, minimum and waived interest, PSLF, the family with and without a loan (taxes on forgiveness, today's money).
