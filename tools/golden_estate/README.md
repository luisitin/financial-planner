# Estate and gift answer key: estate tax, gifts, the gift tax return

One independent answer key for the estate and gift pages:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `estate_key.py` | `tests/golden/estate/schedule.csv` | 1,000 | the tentative tax of the federal rate table (26 U.S.C. 2001(c)) on amounts from $0 to $50,000,000, with every bracket line a cent under, exactly and a cent over; and the estate tax on that amount (taxable estate + lifetime taxable gifts) against the exemption of 2024 to 2027, alone, doubled, or with a DSUE added |
| | `tests/golden/estate/estate.csv` | 1,500 | invented households, one person or a couple, deaths in 2024 to 2026: the taxable estate and the tax for one person; for a couple the unused exemption (DSUE) of each, the second-death tax under the page's conservative rule with and without portability, and the law's own figure for each order of death beside it; for one person also the law with gift tax already paid subtracted |
| | `tests/golden/estate/gifts.csv` | 1,000 | invented gift plans of one or two givers, 2024 to 2028: per year, giver and recipient what counts against the yearly allowance; what is over; the 529 five-year elections; lifetime exemption used and left per giver; the years needing a gift tax return (Form 709). Beside them, the law's reading (a split covers every gift of that year, a 529 election only above the allowance) and who files |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the
model as small functions. `tests/golden/estate/RULES.md` gives each rule in plain words with the source text,
and works five examples by hand (section 9). Those examples are rows `sch-edge-090` to `-094`, `est-edge-001`
to `-010` and `gift-edge-001` to `-006` of the CSVs; `gift-edge-007` is the Form 709 instructions' own example.

**Independence.** This key was written from the law (26 U.S.C. 2001, 2010, 2035, 2042, 2053, 2055, 2056, 2502,
2503, 2505, 2513, 2522, 2523, 529, 6018, 6019, 6075 and Pub. L. 119-21), the regulations (26 CFR 20.2010-1 to -3,
25.2503-2 and -6, 25.2505-2, 25.2513-1 and -2, 25.6019-1 and -2, 25.6075-1), the proposed 529 regulation and the
2008 advance notice, the IRS revenue procedures and the Form 706 and 709 instructions, through `rules.py` and
RULES.md. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs
the app. The only things taken from `tools/golden_health/` and `tools/golden_debt/` are their layout and
conventions; no figure or code is shared. The script works every row in two separate ways, both in exact
arithmetic. It refuses to write any CSV if an amount differs by more than a cent, or any other value (bracket,
rate, years, keys, filers) differs at all, between the two. In fact the two agree exactly, before rounding, on
every value of every row: 69,018 amounts and 19,000 other values.

## Run

```
python3 tools/golden_estate/estate_key.py
```

Python 3 standard library only (made with 3.13; about 3 seconds). The run is deterministic
(`random.Random(20261031)`, and the generator draws only integers), so a second run writes byte-identical files.
The script sets `sys.dont_write_bytecode` *before* it imports `rules.py`, so no `__pycache__` lands in the repo.
Importing `rules.py` runs its self-checks. The run then checks derivation 2 against RULES.md's worked examples
(35 assertions), works all three CSVs, and writes them only once all three have passed. It prints every check
count and the coverage.

Options: a folder argument writes the CSVs there instead (`estate_key.py /tmp/x`); `--mutate NAME` puts one
deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script); `--skip-examples` turns off the
RULES.md examples check, so the row guard has to find a mistake alone. That is how the table under "Deliberate
mistakes" was made.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the
`rules.py` docstring gives the sha256 of each copy. No source was read again for this script, and the script
adds no figure of its own: every amount it uses comes from `rules.py`.

| Tag | Source | Used for |
|---|---|---|
| USC2001 | 26 U.S.C. 2001(b), (c), (g), OLRC edition current through Pub. L. 119-136 (Oct 22, 2026) | the rate table; tax = tentative tax on taxable estate + adjusted taxable gifts, less gift tax payable |
| USC2010, PL11921 | 26 U.S.C. 2010(a), (c)(1)-(5), (d); Pub. L. 119-21 s.70106 | the credit, the basic exclusion amount ($15,000,000 for 2026, indexed from 2027), DSUE, portability |
| RP2334, RP2440, RP2532, IR25103, IRSWN | Rev. Procs. 2023-34, 2024-40, 2025-32; IR-2025-103; IRS "What's new - Estate and gift tax" | the 2024-2026 exemption and yearly allowance |
| I706 | Instructions for Form 706 (Rev. July 2026) | Table A and the credit equivalents 2011-2026 (rows `sch-edge-074` to `-089`) |
| CFR20101, CFR20102 | 26 CFR 20.2010-1(c)(2) Example 4; 20.2010-2(c)(1)-(2) | tentative tax on $14,000,000 and $6,800,000; DSUE with gifts reduced by the amount gift tax was paid on |
| USC2055, USC2056, USC2042, USC2053 | 26 U.S.C. 2055(a), 2056(a), 2042, 2053(a) | charity off the estate; nothing at the first death; life cover in the estate; the estate after debts |
| USC2502, USC2505 | 26 U.S.C. 2502(a), 2505(a) | the gift tax payable that the law's contrast subtracts |
| USC2503, CFR25036 | 26 U.S.C. 2503(b), (e); 26 CFR 25.2503-6 | the allowance per giver, recipient and year; tuition and medical not entered |
| USC2513, CFR25131, CFR25132 | 26 U.S.C. 2513(a); 26 CFR 25.2513-1(b)(5), 25.2513-2(a) | gift splitting covers every gift of the year by either spouse; consent signified on a return |
| USC529, FR98, FR08, I709 | 26 U.S.C. 529(c)(2)(B); proposed 26 CFR 1.529-5(b)(2); 73 FR 3445; Instructions for Form 709 (2025) | the five-year election "exceeds" the allowance; cap 5 x the allowance; the Pat example |
| USC6019, CFR60191, CFR60192 | 26 U.S.C. 6019; 26 CFR 25.6019-1, 25.6019-2 | who files a gift tax return, and which spouse in a split year |
| IRSNR10, IRSNR09, IRB, IRSDROP | IRS news releases Sept.-Oct. 2026; Internal Revenue Bulletins to 2026-45; irs-drop rp-26-NN | no 2027 figures published by 2026-10-31 |

## Figures

| Figure | Value | Source |
|---|---|---|
| Rate table | 18% to $10,000 ... 39% to $1,000,000; over $1,000,000: $345,800 + 40% of the excess | USC2001 (c); I706 Table A |
| Exemption (basic exclusion amount) | 2024 $13,610,000; 2025 $13,990,000; 2026 $15,000,000; 2027 not published, the 2026 figure carried forward | RP2334 s.3.41; RP2440 s.3.41; USC2010 (c)(3)(A), RP2532 s.2.14 |
| Credit on the exemption | 2024 $5,389,800; 2025 $5,541,800; 2026 $5,945,800 | I706 table, rebuilt from the rate table |
| Yearly allowance per recipient | 2024 $18,000; 2025 $19,000; 2026 $19,000; later years $19,000 carried forward (not published) | RP2334 s.3.43; RP2440 s.3.43; RP2532 s.4.42 |
| 529 cap | 5 x the allowance of the contribution year ($90,000 in 2024, $95,000 in 2025 and 2026) | FR98; FR08 Rule 2; I709 |

## Who each row is

- **schedule.csv.** One amount, `amount` = `taxable` + `gifts` (the base of 2001(b)(1)), and one exemption:
  the basic exclusion amount of `year` alone (`basic`), doubled (`doubled`: a survivor whose spouse used none
  of it), or plus a DSUE between 0 and one basic exclusion amount (`plus_dsue`). Gift tax paid is not modelled.
- **estate.csv.** A death in `year` (2024, 2025 or 2026). `single`: one person, A. `couple`: two U.S. citizens
  married only to each other. Each person has an estate share (after debts and costs) and life cover on his
  or her own life that the person owns; the estate is their total. `charity` is the household's charitable
  bequest. `gifts_a`, `gifts_b` are each person's lifetime taxable gifts (the parts over the yearly
  allowances). For a couple, everything goes to the survivor at the first death, and the survivor still holds
  it all at the second death, with the same year's exemption (today's dollars).
- **gifts.csv.** One plan: a list of gifts `year:from:to:amount:kind:superfund`. `from` is `A`, `B` or `both`
  (both spouses: the page's gift splitting). `givers` is 1 (one person giving alone: every gift is from A, and
  the B columns are blank) or 2 (a married couple). `kind` is `cash` or `529`; `superfund` (`yes`/`no`) is the
  five-year election, always `no` for cash. Recipients are role words (son, niece, friend, ...). Gifts to a
  spouse, tuition or medical bills paid directly, and gifts that are not present interests are not entered.

## How each row is worked (derivation 1: rules.py)

- **schedule.csv.** `rules.tentative_tax`, `rules.basic_exclusion`, `rules.estate_tax`. The row of the table
  is found by a short loop over `rules.RATE_SCHEDULE` ("over lo but not over hi").
- **estate.csv.** One person: `rules.single_estate_tax`, once as the page (no gift tax) and once with
  `gift_tax_payable` from `rules.gift_tax_by_year`. A couple: `rules.couple_estate_tax(method='page')` with and
  without portability; for each order of death, `rules.dsue` (gifts reduced by the amount gift tax was paid on)
  and `rules.estate_tax` with the survivor's gifts and the survivor's gift tax payable. When no gifts are above
  the exemption, those order figures are checked again against `rules.couple_estate_tax(method='A_first' /
  'B_first')`.
- **gifts.csv.** `rules.gift_ledger(mode='page')` and `(mode='law')`, `rules.annual_exclusion`,
  `rules.exemption_left` (with 2026, today's year). The script checks that `filers` covers exactly the
  years of `form709_years`.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, in integer cents and exact fractions, without calling a `rules.py` function.
It uses `rules.py`'s tables only.

- **Tables.** The exemption and the allowance of a year are the table's newest year not after it (so 2027 gets
  2026's figure), found by scanning the table; `rules.py` uses its `LATEST_PUBLISHED` constant instead.
- **Tentative tax.** The sum, row by row, of the rate times the part of the amount inside the row. The table's
  "tax on over" column ($1,800, $3,800, ... $345,800) is never read. The row is found by bisection on the upper
  lines (`bisect_left`, so an amount on a line stays in the lower row).
- **Estate tax.** Closed form: 40% of (amount - exemption), or 0. This holds because every exemption is above
  $1,000,000, where the 40% row starts, so both tentative taxes sit in that row.
- **Couple and law figures.** Closed forms, in cents. With E the exemption and T the taxable estate:
  - DSUE of each person = max(0, E - that person's gifts);
  - the page with portability = 40% x max(0, T + the larger gifts - E - the smaller DSUE);
  - without portability = 40% x max(0, T + the larger gifts - E);
  - the law, X first = 40% x max(0, T + min(the survivor's gifts, E) - E - X's DSUE), or without X's DSUE when
    there is no portability. The min() is the gift tax: tax paid on the part above E takes that part out again.
- **Gift ledger.** Each giver's pieces (a gift from both, and on the law track every gift of a split year,
  halved) are walked year by year. A queue holds 529 fifths still to land. A 529 contribution is elected when
  flagged, and on the law track only above the allowance. Over is figured per year, giver and recipient, and
  used is summed. The Form 709 years are the years with anything over, a gift from both, or an election
  starting. Who files is written again from the text of 26 CFR 25.6019-2: each spouse's own gifts of the year
  per recipient (a gift from both is half each), plus the fifths of earlier elections landing that year, are
  compared with the allowance.

The guard compares the two on 6,000 + 24,000 + 39,018 amounts and 3,000 + 0 + 16,000 other values. No amount
differs at all before rounding, and the largest gap is 0. Beside the guard, every couple row asserts that the
page's figure is never below either real order. When no gift is above the exemption, it also asserts that
with portability both orders are equal and the page is above them by exactly 40% x the gap between the two
gift totals, and that without portability the page equals the worse order (RULES.md 4.5).

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up. Nothing is rounded on the
  way: not the tentative tax, not the halves of a gift from both, not the 529 fifths (no source rounds them;
  RULES.md 11.1).
- **Ties are left to labelled rows.** A random draw is redrawn when a written amount is exactly on a half
  cent before rounding, so float error in an app cannot flip it: 7 schedule draws (some rows below $1,000,000,
  such as 18% and 37%, give ties on whole cents) and 45 gift plans (half of an odd cent, or a fifth of such a
  half). The ties that remain are labelled:
  `sch-edge-095` (18% of $0.25 = 0.045, written 0.05), `sch-edge-096` (155,800.185, written 155,800.19) and
  `gift-edge-028` (19,000.005 each, written 19,000.01). estate.csv cannot have a tie: 40% of whole cents is a
  multiple of 0.4 cent.
- `gift-edge-028` shows one thing a test must allow for: used 0.005 is written 0.01, and left 14,999,999.995 is
  written 15,000,000.00, so the written used + left is a cent above the exemption.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder: once with the RULES.md examples check, and
once without it (`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | RULES.md examples check | Row guard |
|---|---|---|
| top row at 39% | caught | refused at `sch-edge-001` (credit 5,945,800.00 vs 5,805,800.00) |
| an amount exactly on a line put in the upper row | caught | refused at `sch-edge-004` (row over 0 vs 10,000) |
| 2026 exemption left at $13,990,000 | caught | refused at `sch-edge-001` (exemption) |
| 2027 exemption guessed at $15,480,000 | not caught | refused at `sch-edge-008` (exemption 15,000,000.00 vs 15,480,000.00) |
| couple: the larger DSUE carried | caught | refused at `est-edge-007` (10,610,000.00 vs 12,610,000.00) |
| law: the first to die's gifts added back | caught | refused at `est-edge-007` (6,712,000.00 vs 7,512,000.00) |
| law: gift tax payable not subtracted | caught | refused at `est-edge-006` (2,000,000.00 vs 2,400,000.00) |
| law: only the gift from both split | caught | refused at `gift-edge-006` (law counted keys) |
| 529 election with no cap | caught | refused at `gift-edge-004` (counted 2026 44,000.00 vs 24,000.00) |
| law: a 529 at or under the allowance spread | caught | refused at `gift-edge-008` (law years) |
| the allowance applied to each gift, not to the year total | caught | refused at `gift-edge-004` (over 2027 B 5,000.00 vs 0.00) |
| a gift from both needs no return unless something is over | caught | refused at `gift-edge-001` (Form 709 years) |
| law: both spouses file in every split year | not caught | refused at `gift-edge-027` (filers 2026 A vs A\|B) |

In all twenty-six runs no CSV was written.

## The generator

Edge rows come first, then random rows.

### schedule.csv: 98 edge rows (`sch-edge-001` to `-098`), then 902 random rows (`sch-0001` to `sch-0902`)

| Rows | What they pin down |
|---|---|
| `-001`, `-002` | $0 and one cent (0.0018, written 0.00) |
| `-003` to `-035` | every line ($10,000 ... $1,000,000) a cent under, exactly and a cent over; years and kinds cycle, gifts 0 or a third of the amount |
| `-036`, `-037` | $49,999,999.99 and $50,000,000 |
| `-038` to `-073` | the exemption line: each year 2024-2027 x basic, doubled, plus a $12,000,000 DSUE, a cent under (tax 0), exactly (0) and a cent over (0.004, written 0.00); gifts $3,000,000. 2027 is the 2026 figure carried forward |
| `-074` to `-089` | the Form 706 credit table: the tentative tax on each basic exclusion amount 2011-2026 |
| `-090` to `-094` | RULES.md 9.1 (19.5M: 1,800,000 / 2,204,000 / 2,356,000) and 9.2 (43M: 6,400,000 with a 12M DSUE, 11,200,000 without) |
| `-095`, `-096` | the two labelled half-cent ties |
| `-097`, `-098` | 26 CFR 20.2010-1(c)(2) Example 4: $14,000,000 and $6,800,000 |

Random rows:

- **Amount:**
  - 35%: strictly inside one of the eleven rows below $1,000,000, chosen evenly, in cents;
  - 65%: $1,000,000 to $50,000,000, in cents (50%), whole dollars (30%) or whole thousands (20%).
- **Gifts:** 0 (50%), or from 0 up to the amount (at most $10,000,000), in cents.
- **Year:** 2024 to 2027, evenly. **Kind:** basic 40%, doubled 30%, plus a DSUE 30%.
  - The DSUE is in whole thousands from $1,000 to the exemption less $1,000 (80%), or in cents strictly
    between 0 and the exemption (20%).

### estate.csv: 52 edge rows (`est-edge-001` to `-052`), then 1,448 random rows (`est-0001` to `est-1448`)

| Rows | What they pin down |
|---|---|
| `-001` to `-006` | RULES.md 9.1: estate 17.5M + 0.5M life cover - 1M charity, 2.5M gifts: 1,800,000 (2026), 2,204,000 (2025), 2,356,000 (2024); 12M + 3M gifts = 15M exactly: 0; 9M: 0; 5M with 16M of gifts: page 2,400,000, law 2,000,000 |
| `-007` to `-010` | RULES.md 9.2: estates 22M + 15M, life cover 2M + 1M, gifts 3M / 1M in 2024, 2025, 2026 (2026: DSUE 12M / 14M; page 6,400,000 / 11,200,000; law 5,600,000 either order, 10,400,000 / 11,200,000 without portability); 28M with no gifts: 0 / 5,200,000 |
| `-011` to `-019` | one person at each year's exemption: a cent under, exactly, a cent over |
| `-020` to `-028` | a couple on the page's portability line (taxable + the larger gifts = E + the smaller DSUE), gifts 2M / 0.5M, each year, the same three offsets |
| `-029` to `-037` | the same couple on the line without portability (taxable + the larger gifts = E) |
| `-038` to `-052` | charity above the estate (one person, a couple); a couple where A gave 16M (DSUE 0, not negative; the law with gift tax subtracted); one person with 14M of gifts in 2024 (page 1,356,000, law 1,200,000); a survivor who gave 14.5M in 2025; equal gifts (page = law); nothing at all (one person, a couple); a couple with only life cover; 60M with gifts 0 / 5M; gifts exactly the exemption (one person, a couple); 3 cents over (0.012, written 0.01); cents in every input (one person, a couple) |

Random rows:

- **Year:** 2024 25%, 2025 25%, 2026 50%.
- **Household:** one person 40%, a couple 60%.
- **Each person's estate share:** $0-2M 20%, $2M-8M 30%, $8M-20M 30%, $20M-40M 20%.
  - In whole thousands (50%), whole dollars (35%) or cents (15%).
- **Life cover:** none (55%), or $100,000 to $5,000,000 in steps of $50,000, per person.
- **Lifetime taxable gifts, per person:** none 40%, $10,000-2M 35%, $2M-8M 20%, $8M up to the exemption 5%.
  - In whole thousands (60%), dollars (30%) or cents (10%).
  - Never above the exemption in random rows.
- **Charity:** none (60%, and always when the estate is under $1,000), else $1,000 up to 30% of the estate.
  - In whole thousands (60%) or dollars (40%).

### gifts.csv: 33 edge rows (`gift-edge-001` to `-033`), then 967 random rows (`gift-0001` to `gift-0967`)

| Rows | What they pin down |
|---|---|
| `-001` to `-003` | RULES.md 9.3, entered as gifts from both: 38,000 (19,000 each, nothing over, a return); the same from A alone (19,000 over, left 14,981,000); 40,000 (1,000 over each) |
| `-004`, `-005` | RULES.md 9.4: B's 120,000 to a 529 with the election and 5,000 cash a year later (counted 44,000 / 24,000 / 19,000 x 3, over 25,000 + 5,000); the same 120,000 from both (12,000 a year each) |
| `-006` | RULES.md 9.5: one gift from both beside two others; page used 31,000 / 6,000, law 6,000 / 6,000 |
| `-007` | the Form 709 instructions' Pat: 100,000 to a 529 in 2025 (counted 24,000), 20,000 cash in 2026; returns 2025 and 2026 only |
| `-008` to `-014` | 529: under the allowance (15,000), exactly the allowance, a cent over, exactly the cap (95,000), a cent over the cap, the 2024 cap (90,000) with room left under the 2025 allowance, no election (50,000 counted at once) |
| `-015` to `-018` | the allowance line of 2024, 2025, 2026 and 2027 (exactly and a cent over, in one plan each) |
| `-019` to `-022` | three gifts to one recipient in a year (19,000.01: 0.01 over); each spouse gives the allowance; one giver over three years; only B gives |
| `-023` to `-027` | two elections to one recipient two years apart; two 529 gifts in one year, one elected (the aggregate is elected); a 529 from both beside cash from A; a gift above the exemption (used 15,981,000, left 0); fifths of an earlier election in a later split year |
| `-028` to `-033` | the labelled half-cent tie; a fifth with a fraction of a cent (10,000.006); a 529 from both whose halves are under the allowance; the case where the regulation and the Form 709 instructions part (only A files); a gift from both beside a large gift from B; gifts in 2027 and 2028 only |

Random rows:

- **Givers:** one (25%) or two.
- **Gifts per plan:** 1 to 6, with weights 15/25/25/15/12/8.
  - Recipients: 1 to min(4, gifts) role words, drawn from eight; each gift goes to one of them.
- **Year of each gift:** 2024 15%, 2025 20%, 2026 35%, 2027 20%, 2028 10%.
- **From:** A when one giver; else A 40%, B 30%, both 30%.
- **529:** 22% of gifts, at most one per recipient and year; the election in 70% of them.
  - Amount: from $5,000 to the allowance 25%, the allowance to 5 x 50%, 5 x to $250,000 25%.
  - In whole hundreds (50%), dollars (40%) or cents (10%).
- **Cash:** from $1,000 to the allowance 55%, to 3 x 28%, to $250,000 12%, $250,000-2M 4%, $2M-6M 1%.
  - In whole thousands above $250,000; otherwise dollars (70%), hundreds (20%) or cents (10%).

## Coverage (from the run)

**schedule.csv**

| | Rows |
|---|---|
| total | 1,000 (98 edge, 902 random; 909 random draws) |
| year 2024 / 2025 / 2026 / 2027 (carried forward, unpublished) | 250 / 246 / 270 / 234 |
| basic / doubled / plus a DSUE | 399 / 295 / 306 |
| row 18 / 20 / 22 / 24 / 26 / 28 / 30 / 32 / 34 / 37 / 39 / 40% | 33 / 38 / 29 / 33 / 28 / 38 / 33 / 33 / 29 / 40 / 35 / 631 |
| amount exactly on a line / within a cent of the exemption | 11 / 37 |
| estate tax above 0 / 0 | 363 / 637 |
| gifts above 0 | 506 |
| tentative tax exactly on a half cent (labelled) | 2 |
| largest estate tax | $14,367,878.70 |

**estate.csv**

| | Rows |
|---|---|
| total | 1,500 (52 edge, 1,448 random) |
| year 2024 / 2025 / 2026 | 386 / 380 / 734 |
| one person / couple | 575 / 925 |
| one person: tax above 0 / gifts above 0 / the law (gift tax subtracted) differs | 222 / 358 / 2 |
| couple: gifts above 0 / the two gave different amounts / gifts above the exemption | 776 / 775 / 2 |
| couple: tax with portability above 0 / without portability above 0 / portability saves something | 497 / 743 / 740 |
| couple: page above both orders with portability by more than a cent | 434 |
| couple: page above the worse order without portability by more than a cent | 2 (`est-edge-040`, `-042`) |
| couple: the two orders differ without portability | 637 |
| charity above 0 / above the whole estate | 594 / 2 |
| life cover above 0 (anyone) / some input with cents | 870 / 480 |
| largest tax: one person / couple without portability | $12,959,580.80 / $25,483,412.41 |

**gifts.csv**

| | Plans |
|---|---|
| total | 1,000 (33 edge, 967 random; 1,012 random draws) |
| one giver / two | 263 / 737 |
| 1 / 2 / 3 / 4 / 5 / 6 gifts | 174 / 257 / 263 / 141 / 102 / 63 |
| a gift from both / a 529 gift / a 529 election (page) / a 529 excess over the cap | 449 / 511 / 385 / 79 |
| anything over (page) / a Form 709 year (page) | 734 / 897 |
| a year after 2026 touched (allowance carried forward) | 728 |
| the law differs (written page vs law) | 279 |
| ... a split year with other gifts / a 529 the law does not spread (reasons) | 197 / 123 |
| ... used differs / Form 709 years differ | 175 / 56 |
| law: one spouse alone files in a split year | 20 |
| exemption used up (left 0) | 1 (`gift-edge-026`) |
| written amounts exactly on a half cent (labelled) | 16 values, all in `gift-edge-028` |
| largest used | $15,981,000.00 |

## CSV columns

Money has two decimals. A blank means "does not apply". `label` and `note` are empty on every random row; on an
edge row they say what the row shows.

**schedule.csv**

`case_id, label, amount, bracket_over, bracket_rate, tentative_tax, taxable, gifts, year, exemption_published,
exemption_kind, basic_exclusion, dsue, exemption, credit, estate_tax, note`

- `amount` = `taxable` + `gifts`. `bracket_over` and `bracket_rate` are the row of 2001(c) the amount falls in
  ("over" that line, in dollars, and the percent). An amount exactly on a line is in the lower row.
- `exemption_kind`: `basic`, `doubled` or `plus_dsue`. `dsue` is 0, the basic exclusion amount, or the row's DSUE.
  `exemption` = `basic_exclusion` + `dsue`. `exemption_published` is `no` for 2027.
- `credit` is the tentative tax on `exemption` (before the 2010(d) limit).
  `estate_tax` = max(0, `tentative_tax` - `credit`).

**estate.csv**

`case_id, label, year, exemption, household, estate_a, estate_b, life_cover_a, life_cover_b, charity, gifts_a,
gifts_b, estate_total, taxable_estate, tax, law_tax_less_gift_tax, first_death_tax, dsue_a, dsue_b, dsue_carried,
gifts_added, second_death_tax_portability, second_death_tax_no_portability, law_a_first_portability,
law_b_first_portability, law_a_first_no_portability, law_b_first_no_portability, note`

- `estate_total` = the estate shares + the life cover. `taxable_estate` = max(0, `estate_total` - `charity`).
- One person: `tax` (the page); `law_tax_less_gift_tax` (the law, with gift tax payable subtracted). They differ
  only when `gifts_a` is above the exemption. The couple columns are blank.
- A couple: `first_death_tax` is 0. `dsue_a` = max(0, exemption - `gifts_a`), the unused exemption if A dies
  first; `dsue_b` likewise. `dsue_carried` = the smaller and `gifts_added` = the larger of the two gift totals
  (the page's conservative rule). `second_death_tax_portability` is taxed against exemption + `dsue_carried`;
  `second_death_tax_no_portability` against the exemption alone. `tax` and `law_tax_less_gift_tax` are blank.
- `law_a_first_*`: A dies first and B survives (B's gifts added back, A's DSUE carried with portability, B's gift
  tax subtracted); `law_b_first_*` the other way.

**gifts.csv**

`case_id, label, givers, gifts, years, allowances, unpublished_years, exemption, counted, over_by_year, elections,
used_a, used_b, left_a, left_b, form709_years, law_split_years, law_counted, law_over_by_year, law_elections,
law_used_a, law_used_b, law_left_a, law_left_b, law_form709_years, law_filers, law_differs, law_reason, note`

- Lists: `;` between items, `|` inside an item, `:` between the parts of an item.
- `gifts`: `year:from:to:amount:kind:superfund`, sorted by year, giver (A, B, both) and recipient.
- `years`: every year with something counted on the page (529 fifths reach four years past the gift).
- `allowances`: `year=amount` for every year either track uses. `unpublished_years`: those after 2026.
- `exemption`: $15,000,000, today's (2026) figure, which `left` is taken from.
- `counted`: `year:giver:recipient=amount|recipient=amount;...`, what counts against that year's allowance (the
  gifts, the halves of gifts from both, 529 fifths landing that year and any 529 excess).
- `over_by_year`: `year:giver=amount` for every year in `years` and every giver, zeros included. Over is
  max(0, counted - allowance) per recipient, added up for the giver.
- `elections`: `year:giver:recipient=elected/excess`. A fifth of `elected` lands in each of five years; the
  excess counts in the first.
- `used_*` = the sum of the giver's over; `left_*` = `exemption` - used, never below 0.
- `form709_years`: years with anything over, a gift from both, or an election starting.
- `law_*`: the same for the law's reading. `law_split_years`: years with a gift from both, in which every gift
  either spouse made that year is halved. `law_filers`: `year:A|B`, who files the return.
- `law_differs`: `yes` when any of counted, over, elections, used or the Form 709 years is written differently
  on the two tracks. `law_reason` lists the causes present: `split-all:YEAR` (a split year with other gifts),
  `529-not-above:YEAR:GIVER:RECIPIENT` (the page spreads it, the law does not), and
  `529-share-elected:...` (only the law track elects it).

## Open points (judgement calls a reviewer should know)

1. **The page's model is the main column here, the law is the contrast.** That is the reverse of the health
   key, because the brief makes the page's conservative couple rule and the page's gift splitting the figures to
   test. An app that follows its README matches the main columns. The `law_*` columns show the gap RULES.md
   section 10 records:
   - the couple's figure is above both real orders by 40% x the gap between the two gift totals (434 rows);
   - gift tax paid is not subtracted (4 edge rows);
   - a split covers only the gift from both (197 plans);
   - an elected 529 at or under the allowance is spread (123 plans).
2. **schedule.csv rows carry one base** (`amount` = taxable + gifts) for both the tentative tax and the estate
   tax. A line belongs to the lower row ("not over"). The tax is the same either way, so only `bracket_over`
   and `bracket_rate` pin the choice.
3. **The exemption kinds** are the brief's "doubled or with a DSUE added". `doubled` is a full DSUE. A DSUE
   is never above one basic exclusion amount (2010(c)(4)(A)). `sch-edge-037` uses a DSUE equal to it.
4. **2027.** schedule.csv carries the 2026 figure forward (`exemption_published = no`), as the page does.
   estate.csv has no 2027 rows because no figure is published. The script adds 2027 to estate.csv by itself
   once `rules.BASIC_EXCLUSION` has a 2027 entry and `FIGURES_2027_PUBLISHED` is true. Gift plans run to 2028,
   and fifths land up to 2032, all at the $19,000 carried forward.
5. **The estate** is after debts and costs. It includes life cover the person owns on his or her own life.
   Charity comes off at death (for a couple, at the second death) and never takes the taxable estate below 0.
   The estate is in today's dollars: no growth or spending between the deaths, and one year's exemption for
   both.
6. **The couple** are U.S. citizens, married only to each other. Everything passes outright to the survivor,
   and portability, when shown, is elected on time.
7. **Gift tax in the law's columns.** Lifetime gifts are taken as made under the row year's exemption, at
   today's rates, so the gift tax payable is 40% of the gifts above the exemption (2001(b)(2), (g)). The DSUE
   uses the gifts reduced by the amount gift tax was paid on (20.2010-2(c)(2)). That gives the page's own
   max(0, E - gifts). The 2035(b) add-back for gifts within three years of death is not modelled.
   Random households never give more than the exemption, so this part of the contrast shows only in
   `est-edge-006`, `-040`, `-041` and `-042`.
8. **A gift from both is the only split** the compact list can show. RULES.md 9.3's "from A's own account,
   marked split" is entered as from both, so it splits the same way. On the law track a gift from both makes
   its year a split year: every gift A or B made to others that year is halved (2513(a)(2); RULES.md
   convention 11.5). A from-both gift is never read as joint property, which would need no election (RULES.md
   10.11).
9. **Who files in a split year** follows 26 CFR 25.6019-2, as RULES.md 6.2 does, and the regulation over the
   Form 709 instructions where they part (`gift-edge-031`). "Without regard to section 2513", a gift from both
   is taken as half each spouse's own. When neither spouse would have had to file, both file, because a gift
   from both is signed by both (RULES.md convention 11.8). So `gift-edge-001` reads `A|B`, where RULES.md 9.3,
   with the gift from A's own account, has only A.
10. **One giver** (`givers = 1`) is one person giving alone. Every gift is from A, the B columns are blank, and
    no split is possible.
11. **529 contributions are added up** per giver, year and recipient (the statute's "aggregate amount"), and
    one election flag elects the lot. Only `gift-edge-024` tests this; random plans have at most one 529
    contribution per recipient and year. In a split year each spouse's half carries the gift's election flag
    (each spouse "would then decide individually", I709). Fifths stay with the giver of the contribution
    year, and a later split does not re-split them (RULES.md 11.7).
12. **The 529 cap and later years.** The cap is 5 x the allowance of the contribution year; the excess counts
    in that year. Each fifth is compared with the allowance of the year it lands in. The page spreads any
    elected contribution, the law only one above the allowance (`gift-edge-008`, `-009`, `-030`).
13. **`left` = $15,000,000 - used, never below 0.** The exemption is today's (2026) figure, the same as the
    carried-forward one, whatever years the plan covers. Once used passes it, 0 is left (`gift-edge-026`: used
    15,981,000, left 0): the exemption is a credit that is used up, not a balance that goes negative, and what is
    over it is taxed that year (26 U.S.C. 2502(a), 2505(a)); no column gives that tax. The page floors it the same
    way. Its README writes "left = the exemption - used" without the floor; an earlier version of this key took
    that literally (-981,000), which was the key's mistake, corrected 2026-10-31.
14. **`over_by_year` lists zeros.** Every year in `years` appears for every giver, so a missing entry is never
    ambiguous.
15. **The Form 709 years** are the page's household rule. `law_form709_years` applies the same rule to the
    law's figures. Years 2 to 5 of an election need no return unless something else in them does (I709).
16. **Rounding.** Exact until written, then to the cent, half up. Random draws on a half-cent tie are redrawn,
    and three labelled tie rows are kept (see Rounding).
17. **Not entered, so never in a row:** gifts to a spouse, tuition or medical bills paid directly, gifts to
    charity, and gifts that are not present interests. Every entered gift is taken as a present interest.
18. **Inputs the brief left open:** all the mixes under "The generator". They include the share of couples,
    the estate and gift bands, the share of 529 gifts and elections, the gift years and the recipients.

## What the key leaves out (on purpose)

State estate and inheritance taxes; the generation-skipping transfer tax; the 2035 three-year rules; a
spouse who is not a U.S. citizen (no marital deduction outside a qualified domestic trust, and the larger gift
allowance); terminable interests and QTIP trusts; an earlier marriage, remarriage and the last-deceased-spouse
rule; the anti-clawback rule for an exemption that falls; the 529 inclusion at death within the five years;
the gift tax amount once the exemption is used up (`rules.gift_tax_by_year` has it); the estate tax return's
filing threshold and the late portability relief; community property; Trump accounts (Rev. Proc. 2026-25).

## Checked against the pages (2026-10-31)

The first run of `tests/golden-estate.test.mjs` found the pages and the law apart on five causes (the key itself had one
mistake, the exemption left below zero, fixed before the run). Each was checked against the sources: four were page
bugs (only the gift marked "from both" split, a 529 at or under the allowance spread, the 529 election and cap per gift
rather than per total, the gift tax payable not subtracted) and one a simplification the README stated (the couple's
smaller unused exemption with the larger gifts). All five were fixed on the pages the same day (`modules/estate/gifting`,
`modules/estate/estate-tax`); the test now compares the pages with the `law_*` columns and runs with no to-do rows. The
main columns still describe the pages' model before the fix, as a contrast.

