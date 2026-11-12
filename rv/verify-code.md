# Skeptic's check of walk.md, engine.md and pages.md against the code at fe678cb

## Method
- **Code base:** fe678cb, taken read-only with `git archive fe678cb` into `scratchpad/vc/app`. The repo's working tree is now at c6fb730 (pulled 21:36 UTC), so nothing was read from it. Nothing in the repo was edited.
- **Scripts:** in `scratchpad/vc/s/` (`real.mjs`, `levers.mjs`, `casey.mjs`, `gap8.mjs`, `mc.mjs`, `alerts.mjs`, `moves.mjs`, `guide.mjs`, `ask.mjs`, `gs.mjs`, `gu.mjs`, `ss.mjs`, `t.mjs`, `e-*.mjs`). Each re-runs the sibling reports' numbers on the fe678cb copy.
- **Households used:**
  - the walk's five phone-built plans (`rv/walk/out/gs/*.real.plan.json`);
  - the builder variants from `rv/walk/build.mjs`, rebuilt on the copy;
  - the kit households (`ux/kit.mjs households()`);
  - `qa/fixtures/family-plan.mjs`.
- **What was checked:** every file:line claim in the three reports and every "the app does or does not" claim that can be decided from code or a compute run. UI tap counts and pixel positions were not re-walked; they are listed as unverified at the end.

**Bottom line.** The three reports are accurate on the four questions that matter:
1. The leftover is not invested in the projection.
2. The account's type decides Roth or traditional, and the employer match follows the row's account.
3. The defaults live in `migrate.js` and are repeated as fallbacks in `buildInputs`.
4. The lane and claim picture is right for other builders.

Every number re-run reproduced to the dollar or the hundredth. There are **17 corrections** in all. Five are substantive:
- the match guess Get started uses;
- the pages report's "employer match" lever figure;
- "retirement is never the next move";
- "the only place that notices the empty contribution";
- pages' Casey not being a phone-built household.

The other 12 are minor (line drift, small overstatements).

---

## (1) Is the monthly leftover invested in the projection? **No. All three reports are right.**

**Confirmed in code (fe678cb):**
- **Inflows while working:** only typed contribution rows go into the buckets while working (`core/math/retirement.js:129-139`, stop age `:133`, untilYear/skipYears `:135`, raises `:136`, bucket `:137`).
- **Cash:** the cash bucket grows at `retCash` (`:309`; default `returnCash` 0.02 at `core/schema/migrate.js:54`) and is always withdrawn first (`:101`).
- **Spending:** only in retired years (`:158-169`). In fixed-real, `need = max(0, spending + health - income) + one-offs` (`:178`), so income above spending is not added anywhere.
- **Other inflows to buckets:**
  - the required-withdrawal surplus (`:303-304`);
  - negative one-off events (`:176`). In the base plan the only events are health ones, which are positive (`projection/compute.js:778,1027`), so the walk's "only other inflow is the RMD surplus" holds for real plans.
- **What `buildInputs` passes:** `projection/compute.js:1008-1019`; health events at `:1027`. None of it comes from the leftover.
- **Who reads the leftover:** `spare.monthly|leftOverOf|yearSaving(` is read only by liquidity, benefits, budget, expenses, payoff, prioritizer, alerts, health-score, next-best-action, setup and purchase. Nothing in `retirement/` or `scenarios/` reads it. (`retirement/contributions/view.js:104` reads Next best action, but only for the match step and `leftWords` after a start, not the projection.)
- **The leftover formula:** `next-best-action/compute.js:149-164` (`spare.monthly` at :164). It also takes off `careLost`, which engine.md omits (harmless).
- **"Builds up" wording:** `core/math/leftover.js:65`. It is shown on the reveal (`setup/view.js`, pill "● Money to put to work" at `:1781`), on the Dashboard and on Your plan (`st.yearWords`: `setup/compute.js:2449`, `dashboard/view.js:132`, `plan/compute.js:110`).
- **Financial independence:** its 25-times line adds `(income.monthly - expenses.monthly) * 12` before tax (`retirement/fire/compute.js:72-73`). So two retirement pages disagree, as walk.md and engine.md say.
- **Cash balances:** checking, savings and cash go to the cash bucket (`projection/compute.js:37`) and are summed for every account (`:886`, `countedBalance` in `net-worth/compute.js:31`). The emergency fund and goal accounts are not excluded.

**Numbers re-run, all identical to the reports:**

| claim | re-run on fe678cb |
|---|---|
| walk: Dana & Lee tight 1.08, leftover $1,828; half invested 1.27, all 1.46 on track | tight (1.08), $1,828, on track 1.27 / 1.46 |
| walk: Morgan short@65 0.24 → 0.67 / 0.79 | identical |
| walk: Casey (phone) short@67 0.76, $573 → short@77 0.86 / short@90 0.96 | identical |
| walk: Jamie short@70 0.72, $567 → short@79 0.84 / short@90 0.95 | identical |
| walk: Robin short@94 0.99, $439 → tight 1.01 / 1.02 | identical |
| walk: Sam "don't know yet", $746 → 1.17 / 1.64; Riley $3 | identical (`savingsUnknown` true) |
| walk: inflation −0.5 pt or stocks +1 pt moves the ratio 0.01–0.04; retiring 2 years later 0.06–0.37 | 0.01–0.04 and 0.06–0.37 |
| walk: chance of lasting 78% / 0% / 35% (Dana & Lee, Jamie, Robin) | Monte Carlo 0.7835 / 0.0005 / 0.3525 |
| engine: family $3,884 → $8,434 now, $16,145 invested, $12,142 as cash; sam, jordan, patLee rows | all identical |
| engine defect A: partner pay dropped; brackets tax $3,992 (2026) and $4,114 (2027) from savings; $10,658 → $9,571 | identical |
| engine defect A: $72,000 pension dropped, "$4,280 a year" tax from savings | $4,280 is 2026 only; 2027 is $4,151 and 2028 $4,016 (minor) |
| pages: builder Casey runs out 2046 (66); with the $761 leftover saved, 91 | identical |

## (2) How Roth or traditional and the employer match are assigned. **Right, with one wrong figure and one wrong attribution.**

**Confirmed:**
- **No tax field.** The contribution shape has no tax field (`migrate.js:62`, `DATA_MODEL.md:47`) and accounts have no tax field (`taxTreatment` appears nowhere).
- **Bucket.** `bucket = BUCKET_OF[acct?.type] ?? "taxable"` (`projection/compute.js:934`, map at `:37`). Compare's "save more" row has `accountId: ""`, so it lands in taxable (`compare/compute.js:20`).
- **Match.** `yearly = perYear(amount) + employerMatch` goes into the row's own bucket (`:939`), so a match on a `roth` row is tax-free.
- **Federal tax.** Contributions use `perYear(c.amount)` only, so a match is never income (`taxes/federal/compute.js:305-307`). Pre-tax is the `401k` type only, and a Roth 401(k) is a `roth` row with `limitKind` "401k" (`:316`).
- **limitKind.** `retirement/contributions/compute.js:20-21`: a `roth` row is a 401(k) when it has a match or its name says 401(k), 403(b), 457, TSP or thrift; otherwise it is an IRA. The 2026 IRA limit in the data is $7,500.
- **Paycheck.** Pre-tax 401(k) comes from rows of type `401k` (`cashflow/paycheck/compute.js:127,139`). The Roth 401(k) line reads `whatIfs` only (`:187`).
- **Get started:**
  - one retirement box per adult (`setup/compute.js:88` `perAdult`; "Add up every account of that kind." in `setup/view.js:1119`);
  - "Through work" saves type `401k` (`:94`), and a Roth already set on Net worth stays Roth (`:929`);
  - "Which kind of IRA?" only under "On my own" (`IRA_KINDS` `:111`; view `:1047`), with Not sure saved as `ira`;
  - no Roth 401(k) question anywhere in `setup/view.js`;
  - the match is stored only for "Through work" (`:913`);
  - one row per adult holds own money plus match (`:933-939`).
- **Contributions form.** One account per row (`contributions/view.js:94`), whose (`:95`), "Employer adds, a year" (`:99`), and no tax choice (`:93-100`).
- **Net worth.** Net worth's `roth` type is labelled "Roth IRA / 401(k)" (`balance/net-worth/compute.js:15`).
- **Per person.** `personIndex` (`projection/compute.js:928`) sets the stop age and the RMD slice (`retirement.js:132-138`). Buckets are household-wide (`:94`). RMD owners come from `rmdOwners` (`projection/compute.js:302`).
- **Roth bias, engine.md, family fixture.** Re-run identical: $8,434 → $8,919 (flat) and $8,938 (brackets); federal tax $14,112 → $16,890.

**Corrections:**
- **engine.md, defaults table, "employer match" row:** it says the guess is "50% up to 6% of pay (career/benefits/compute.js:24, guess contrib.match)". **Wrong source.**
  - Get started's guess (`contrib.match`) uses Vanguard's median match *value*, 4% of pay, earned in full at 6% put in (`overview/guesses/estimators/saving.js:175-176,418`; table `guesses/data/pay.js:10`: value 4, needed 6). The screen's chip says "Not sure (about 4%)" (`setup/view.js:1110`).
  - The 50%-up-to-6% formula (3% of pay) is used elsewhere: Work benefits' `DEFAULT_TIERS` (`career/benefits/compute.js:24`), Next best action's match step (`next-best-action/compute.js:296`) and the Contributions card's "A common match, 50% of what you put in up to 6% of pay" (`contributions/view.js:172,207`).
  - **The app has two different "usual matches".** Any lever card must pick one.
- **pages.md, Shape A row 2:** "The usual match, 50 cents a dollar up to 6% of pay (about $2,880 a year), would make it last to **81**." Two errors:
  - $2,880 is 4% of $72,000, the Vanguard value. 50 cents up to 6% would be $2,160.
  - The "81" run (`pages-walk/levers.mjs`) also adds Casey putting in 6% of pay ($4,320 a year) when nothing goes in, then the match. So 81 is "6% in plus the match", not the match alone. With nothing going in, a match adds $0.
- **walk.md gap 5:** "A Roth 401(k) without '401(k)' in its name is held to the IRA limit." It is held to the IRA limit only if it also has no match and no 403(b), 457, TSP or thrift in its name (`limitKind` :21). The walk's own bullet above it is closer. Minor.

## (3) Which inputs are defaults, and where they live. **Right, with two refinements.**

**Confirmed:**
- **Stored defaults.** `SCHEMA_VERSION = 1` (`migrate.js:9`). Assumptions are at `:54-56`. Retirement settings are at `:61-62,67-69`. `migrate()` merges assumptions and retirement into every plan (`:92-93`).
- **Fallbacks repeated in `buildInputs`.** Ages at `projection/compute.js:884`; rates, returns and swings at `:1011-1013`; strategy, rate and order at `:1015-1016`; tax settings at `:44-47`.
- **Assumptions page:**
  - ten fields, each with its source (`system/assumptions/compute.js:9-30`);
  - `changed` = differs from default (`:41`); stale after 365 days (`:50`);
  - Save stamps a single `reviewedAt` (`view.js:58-65`); `?show=` works (`:71`).
- **Your plan.** "These sound fine" calls `applyGuesses`, which only stamps `reviewedAt` (`setup/compute.js:2043`; `plan/view.js:153-166`).
- **Guesses ledger coverage.** Market numbers are "fallback", and the projection settings are "later:C9" (`overview/guesses/coverage.js:84-96, 194-200`).
- **Social Security, Medicare, glide:**
  - Claim age = file value, else full retirement age, else 67, or 70 for someone 70 or over (`social-security/compute.js:216`).
  - Medigap Plan G $194 (`medicare/data/medicare.js:29`, used at `medicare/compute.js:108`, flag at `:112`).
  - Glide at `retirement.js:124-126`; `investments.glide` is never read by the engine.
- **Where they can be changed.** Stock shares and the flat tax are written at plan level only by the projection's settings fold (`projection/view.js:329-345`, 7 fields). Compare changes them only in copies.

**Corrections:**
- **engine.md (4) and its "Not tracked at all" list:** "the plan-to age … have no confirmation flag", and "retirement and plan-to ages" are not tracked. Imprecise.
  - The Assumptions-level `retirementAge` and `planEndAge` are two of the ten fields that `assumptions.reviewedAt` covers (`assumptions/compute.js:24-27`, `view.js:62-63`).
  - What is untracked is the per-person `people[].retirementAge` and `lifeExpectancy`, which `buildInputs` uses first (`:884`).
- **walk.md gap 9:** "Nothing says the leftover is assumed to sit in cash at 2%." **Wrong premise.** The future leftover is not assumed to sit anywhere: it is added to no bucket, cash included (`retirement.js:129-139`). Only today's checking and savings balances earn 2%. The walk's own leftover section says this correctly.
- **pages.md 5.2:** "The forecast's 'Retirement money today' counts only the $19,000 of cash on hand". The line also counts the $48,000 401(k): the balances are cash 19,000 and deferred 48,000. What is true is that the cash bucket holds only today's $19,000 and never the $761 a month. Wording, minor.

## (4) Lane and claim ownership. **Right for other builders. TEAM.md still lists claude-b's own old rows.**

**Confirmed at fe678cb:**
- **claude-c:** claimed `overview/setup/compute.js`, `retirement/projection/compute.js` and the guess estimators "until the left2 commit is on the branch" (WORKBOARD 2026-11-11 14:40). The loans lane landed as 658c5b8, an ancestor of fe678cb. No ssg or left2 commit is in `git log fe678cb`, so the hold stands.
- **claude-b wave 1:** `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`, `modules/overview/guide/frame.js` (TEAM row at line 75; WORKBOARD 17:30).
- **claude-f:** `modules/overview/{dashboard,plan,start,next-best-action,monthly-review,alerts,health-score,guesses}/**` and `overview/guide/**` except `frame.js` (TEAM line 78). a64d852 and 5429c09 are ancestors, and the row is still present.
- **claude-e:** released retirement and scenarios (WORKBOARD 23:30 "PG-RETIRE closed; my TEAM claim is released", and 2026-11-12 02:30 "claim row removed"). No claude-e row remains in TEAM.md.
- **claude-d:** released (WORKBOARD 22:15).
- **Designer's lane:** usable pages' `view.js` are the designer's (TEAM line 11), so a builder takes a claim row.
- **claude-a's 13 pages** include `balance/projection` (WORKBOARD Lanes). `balance/projection` reads the retirement projection, so it also ignores the leftover (`balance/projection/compute.js:8,31`).
- **Bank connections:** `transactions/connect` is still `planned`. It sits in **codex's** lane. The SimpleFIN proposal (WORKBOARD 2026-10-31 03:01) waits for the owner's yes and would put a secret in `planner.properties`.

**Correction:**
- **pages.md §7 and §8:** `retirement/projection/view.js` is called "free of builder claims", and `scenarios/sensitivity/{…view…}.js` "free". TEAM.md at fe678cb still names these views in **claude-b's** own rows:
  - `retirement/projection/view.js`: rows 65 (no release condition), 72 and 73;
  - `scenarios/goal-seek/view.js`: rows 65, 66, 72, 73 and 74;
  - `scenarios/sensitivity/view.js`: rows 73 and 74;
  - `retirement/contributions/view.js`: row 73;
  - `ai/reader/view.js`: rows 64, 71 and 73.

  Rows 66 and 71 to 74 say "released when merged" or "claim goes when claude-b's commit lands", and those commits landed on 2026-11-07, so they are stale. Rows 64 and 65 have no release condition. No *other* builder holds these files. A builder taking them should still remove or update claude-b's stale rows in the same change (TEAM.md "delete your line when done"), rather than read them as free.

---

## Other corrections (behavior claims)

1. **pages.md §4, Dashboard row:** "**Retirement is never the next move.**" **Wrong.** The Dashboard's moves at fe678cb (`setup/compute.js` `standing().moves`, `:2389`):
   - phone-built Casey: first move is "Check if Casey's job matches retirement saving";
   - Robin: first move is "A retirement account of your own (an IRA)";
   - every walk household: second move is "Check your retirement step by step".

   What is true: no move comes from the *verdict* being short. Next best action has no "you are short" step (`next-best-action/compute.js:543` is only the on-track note).
2. **pages.md §1.3 and §4:** "The only place that notices the empty contribution is the 'Plan my retirement' guide." **Wrong.**
   - **Contributions:** it shows "Does Casey's job add money when Casey saves for retirement? … job has a retirement plan (you said so in Set up my plan), but nothing goes into it yet" (`contributions/view.js:250-253`).
   - **Next best action:** its match step is open ("check") for both Casey builds.
   - **The guide on a phone-built plan:** for the phone-built Casey, who tapped "None", Get started saves a $0 row (`[0,0]`). The guide's `saving` step is then "done" and the next step is `pension` (`guide/compute.js` `journeyStatus`). So on a real plan, the guide is the one place that does *not* notice it.
3. **pages.md throughout:** the household "Casey" is presented as a phone walk, but it is the **builder variant** from `rv/walk/build.mjs`. That file's header says "built with Get started's own apply functions (no guesses: what was typed)". Its figures differ from what a person who taps through Get started gets (the walk's `real-noContrib`):

   | | pages' Casey (builder) | phone-built Casey (walk) |
   |---|---|---|
   | verdict | runs out 2046 (66) | short at 67 |
   | left over a month | $761 | $573 |
   | spending source | Expenses: box empty | Get started's guessed figure (typed source; box filled) |
   | our guesses | 1 (Social Security) | 5 (Social Security, retirement spending, match, cushion target, cushion accounts) |
   | Goal seek saving | "Save about $850" | about $670 |
   | guide's next step | `saving` | `pension` |

   The following statements hold only for plans whose retirement figure comes from Expenses, not for a household fresh from Get started:
   - "the spending box is empty while the plan spends $4,400";
   - "Casey has 1 guess";
   - "the next step is saving".
4. **walk.md gap 6:** "Small changes help appears on every plan that is not on track." A plan whose verdict rests mostly on our guesses (`retireGuessed`) shows "● Our guesses for now" instead (`setup/view.js:1797`, `dashboard/view.js:143`). Minor.
5. **walk.md table, "Will the money last?" row:** "7 settings inside a fold … (plus the health tick)". The health tick is not in the settings fold. It sits under the "Health insurance" record of "What goes into this" (`projection/view.js:310`). Minor.
6. **walk.md gap 2:** "The guesses are listed only on Your plan." The Dashboard's Retirement row also links to Our guesses in its guess state (`dashboard/view.js:160`), and so does Net worth (`:221`). The projection page indeed has no link to it. Minor.
7. **walk.md gap 4:** "No 'check these numbers' step when the plan is short." Mostly true, with one nuance. Every walk household has a "Look over the assumptions" chore (`alerts` id `assumptions-unreviewed`) in Needs attention's folded "Housekeeping", and Your plan has the "What we're counting on" fold. Neither is tied to the verdict. "Nothing needs your attention right now" for Jamie, Casey and Robin is confirmed (`alerts.allClear` true).
8. **engine.md §3:** "29 non-test files branch on `type === "401k"|"roth"|"ira"`". **Not reproducible.** On fe678cb:
   - 11 files match `type [!=]== "401k|roth|ira"`;
   - 17 match `=== "401k|roth|ira"`;
   - 44 quote one of those literals.

   The count depends on the pattern; treat it as "between 11 and 44".
9. **Line drift (minor):**
   - Sensitivity `fromInputs` and `fromPlan` are at `:36-37` (pages: `:41-42`); the view's "Some you choose" is at `:67` (pages: `:66`).
   - Goal seek's `GO_WORDS` is at `view.js:30` (pages: `:20`).
   - Compare's `LEVERS` is at `:14-29` (pages: `:13-26`; engine: `:14-27`), and the claim-age `?? 67` is at `:16` (engine: `:15`).
   - pages §9 cites "engine report, section 1" for the Roth match; it is section 2.

## Confirmed claims, by group (beyond those above)

- **Gap 8 reproduced:** builder Dana & Lee; typing $5,500 → short at 90, runs out 2069. It is worse than the walk says: re-typing the *same* $6,430 also flips "tight" to short at 77.
  - The cause is as stated: `saveSpendingFigure` sets `retireHeld` only when `retireAuto` (`projection/compute.js:1286-1288`), and `heldLoans` needs `retireHeld` (`:987-989`).
  - The help line "A loan payment in this figure still stops…" shows only while loans exist (`view.js:331`).
- **pages' builder Casey levers reproduced:** 6.6% ($396) → 75; leftover → 91; stop at 67 → 74; stocks 6% / 8% → 66 / 67; inflation 2% / 4% → 68 / 66; affordable $3,445 → $2,336 after a typed figure drops the one loan; Social Security $2,697 a month from 67.
- **Goal seek re-run:**
  - Jamie: $2,330 a month spending, retire "not by 75", save $1,070 (+$820), return 10.4%, $133,940 short, claim at 69 "room";
  - Robin: $5,380 short.

  The claim card's status is "room" whenever the best age differs from the one on file, whatever the verdict (`goal-seek/compute.js:233`; pill `view.js:31`).
- **Sensitivity:** the saving row exists only with contributions (`:69`); Morgan and Casey get 9 rows with no saving row. Sensitivity is linked from no page: only `registry.js` and 4 Glossary lists (positions 21, 6, 13 and 33 of 21, 6, 14 and 33 pages; Glossary shows the first 3, `ai/glossary/view.js:70`). Compare is linked only from Advisor's plan and Healthcare before 65.
- **Projection view:**
  - "What goes into this" at `:205-224`; `linked` at `:72-74`;
  - both hero buttons outlined (`:176-177`);
  - "Chance the money lasts and If history repeated" is plain text (`:193`);
  - the verdict waits until known (`:132-142`);
  - `?type=spending` landing (`:241-245`);
  - no Social Security link unless no estimate is on file (`:72,213`; compute `:1033`);
  - no "guess" word except in escrow loan lines;
  - Goal seek's "Change spending ›" goes to the top of the page with no `?type`.
- **Path and guide:**
  - `PATH_STEPS` at `journeys.js:195-208`; `fix-retire` at `:202`; `savingHelp` at `:133-145`;
  - the retirement guide's steps and "more" list (`:283-306`, no Sensitivity or Compare);
  - Jamie's guide: 5 of 7 done, next `pension`.
- **Your plan:**
  - "It lasts, just" (`plan/compute.js:155`);
  - "What would help" is generic text (`:163-167`);
  - up to 3 guesses (`GUESSES_SHOWN = 3`, `:27`);
  - IRA guess wording (`plan/words.js:77`).
- **Statements and connections:**
  - Statement reader `requires: "pc"`;
  - Document reader is usable without AI;
  - its README says a pay stub's 401(k) proposal needs an existing row;
  - Holdings reads Fidelity, Schwab and Vanguard position files;
  - "No bank logins or account numbers" appears at `start/view.js:96,146` and `setup/view.js:269`.
- **Shared code and design rules:**
  - the heavy-compute path is `core/app.js:176-181`, with no compute Worker (`index.html` registers only the service worker);
  - `careful.js` `whenWorked` / `afterPaint`; `guide/compute.js` `markNone` at `:382`;
  - DESIGN_LOG 2026-11-06 (one path, no new walk, household's view) and 2026-09-15 (Assumptions round 17).
- **Timings, family fixture, this container:** engine run 0.2 ms; `buildInputs` 4.9 ms; Sensitivity 115 ms flat and 501 ms brackets; Goal seek 169 ms. These are within noise of engine.md's 0.13 ms, 4.7 ms, 112 / 569 ms and 208 ms.

## Not verified (no code fact to check, or not re-walked in a browser)

- Tap counts: 4 for spending, 5 for the match, 13 for a Roth split, and so on.
- Page heights (2,682 to 2,984 px), y positions (1,550 and 2,629), and the "you land about 440 px down" after a Contributions save.
- What the screenshots show.
- "Retirement step is 5th of 7" for each household.
- The 11 pages that say the verdict (pages §3.5) and the 11 readers a schema change must follow (engine §3). These are inventories, not checked one by one.
- Phone speed multipliers ("2 to 4 times slower").
- Statements of law (IRC 402(a), 402A; SECURE 2.0 §604 and §325). They are not codebase claims.
