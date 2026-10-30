# Document reader  (`ai/reader`)

**Status:** usable (phase 8)
**Purpose:** Paste (or pick) a pay stub, an account statement, a Social Security statement or an advisor's plan: the page finds the figures in it, shows what each would change in the plan (now, and what it would become), and changes nothing until you tap "Use it" on each one.

## Inputs
The document's text: pasted, a `.txt` file read in the browser, or a PDF's text layer read on the PC (`POST /api/document/text` in `server/server.mjs`, pdf.js through `server/statements.mjs` `pdfPages`; scans and photos are refused there and pointed to the Statements page, whose vision model reads pictures). The plan (people, income, contributions, accounts, Social Security, advisor). The text is held in the page's memory only; it is never saved.

Writes (one accepted proposal at a time, `applyProposal` inside `store.update`): `income[]` (the person's salary amount and period, or a new salary line), `taxes.withholding.self|partner`, `retirement.contributions[]` (the person's 401(k) amount and period), an account's `balance`, `asOf` and `history` point, `retirement.socialSecurity[personId].monthlyAtFRA`, `advisor` (changes, fee, quoted chance; compared on scenarios/advisor-plan).

## Outputs
`compute(plan, { text, kind, personId, accountId, today, extra })` -> `{ kind, detected, fields, found: [{ key, label, unit, value }], missing: [labels], proposals: [{ id, op, label, before, after, ...target }] }`.

## How it reads (no model needed)
- `detectKind`: keyword scores (net pay / gross / YTD / pay date; social security / full retirement age; probability of success / assumptions / inflation / advisor; ending balance / statement period).
- `readFields`: for each field of the kind, the first line matching one of its label patterns; the value after the label, else on the next line. Money: the first amount with a `$`, thousands commas or cents (bare whole numbers, such as years and ages, are skipped), brackets or a minus sign for negatives; so on a pay stub the "current" column comes before "YTD". Percent: `6.5%` -> 0.065. Dates: `MM/DD/YYYY`, `YYYY-MM-DD`, `Month D, YYYY`, `D Mon YYYY`; for a statement date or a period end, the last date of a range.
- Pay frequency: the words (weekly, bi-weekly, semi-monthly, monthly), else the period's length (8 days or fewer weekly, 14 biweekly, 16 semimonthly, else monthly).
- An advisor's spending stated per year is divided by 12.

## The AI (optional)
"Ask the AI to find the rest": `buildPrompt` asks for the missing fields as JSON (null when not stated, never account numbers); `parseAnswer` keeps only known keys, checks numbers and dates and turns percents into fractions. AI figures are marked "from the AI: check it" and, like every figure, reach the plan only through "Use it" (docs/PLAN.md AI policy).

## Edge cases
- No account chosen for a statement: no balance proposal.
- Account numbers are not read or kept.
- A pay stub's 401(k) proposal needs an existing 401(k) contribution for that person (Contributions page).

## Tests
`module.test.mjs`: money, percents and dates; the kind from the words; a pay stub (current column, frequency from dates); a statement, a Social Security statement and an advisor's plan; proposals and applying each; the AI answer's parsing and `extra` fields.

## Ideas / not yet
- Photos read by the vision model through the statements route.
- More kinds: a W-2, a 1099, a mortgage statement, an insurance declarations page (fill Policies).
