# Your credit score  (`debt/credit-score`)

**Status:** usable (phase 4; gap design #18, built 2026-11-13)
**Purpose:** Keep the score you saw and when, what it means on its scale, the one thing that would lift it most, and how to freeze your credit or fix a mistake on your report.

A typed score only. Nothing logs into a bureau, a bank or a score app, and the plan keeps nothing beyond the score, the day,
whose it is and which kind (no report, no account, no number from a bureau).

## Inputs
Plan sections read (`needs`): `credit` (this page's own, optional), `household` (whose score: the adults), `accounts` and
`debts` (through Credit cards' compute, for the one lever).
Written (`writes`): `credit`, only on Save (a score; the fraud alert's day) and on a freeze tick's tap.

`credit?: { scores: [{ id, personId, date, score, model }], freeze: { [personId]: { equifax?, experian?, transunion? } }, alertUntil?: { [personId]: date } }`
- `score`: a whole number from 300 to 850; `date`: "YYYY-MM-DD", the day the person saw it; `model`: `"fico"`,
  `"vantage"` or `"unsure"` (the box "Which kind": FICO / VantageScore / Not sure).
- `freeze`: `true` per bureau the person ticked; an unticked bureau is removed, a person with none ticked is removed.
- `alertUntil`: the last day of a person's fraud alert.
- Every part is optional and read with a default; the section is removed when nothing is left in it (so a plan where
  everything was taken back is byte-identical to one that never had it). No schema version bump.

Parameters of `compute(plan, { today })`: `today` ("YYYY-MM-DD"), for "over a year old", the fraud alert and the lever's dates.

## Outputs
`compute()` returns `{ today, empty, people: [{ id, name, scores (newest first), latest, stale }], shown (each person's
newest, in the household's order), more (every other score, newest first), lever: { kind, amount?, date?, missing? }, cardTotals:
{ balance, limit, share } | null (null too while a card that carries a balance has no limit), freeze: { [personId]: { equifax, experian, transunion } }, frozen, bureaus, alerts:
{ [personId]: { until, active } } }`. Each score is `{ id, personId, date, score, model, band }`.

Pure helpers, each tested: `band`, `longDate`, `adultsOf`, `headlineOf`, `sentenceOf`, `staleSentence`, `emptySentence`,
`savedSentence`, `leverOf`, `leverSentence`, `cardsLine`, `safeStatus`, `trendWords`, and the writers the view calls inside
`store.update`: `saveScore`, `removeScore`, `setFreeze`, `setAlert`.

## Formulas and facts, with sources (all read 2026-11-13)
- **The band of a score** = the band whose range holds it, on the score's own scale; none for "Not sure" or a score off
  300 to 850.
  - FICO: under 580 poor; 580 to 669 fair; 670 to 739 good; 740 to 799 very good; 800 and up exceptional; most scores run
    300 to 850. myFICO, "Credit scores" (myfico.com/credit-education/credit-scores).
  - VantageScore: 300 to 600 subprime; 601 to 660 near prime; 661 to 780 prime; 781 to 850 superprime. VantageScore, "The
    complete guide to your VantageScore" (vantagescore.com, published 2025-06-26). The page says what a tier means in that
    guide's own terms ("Near Prime borrowers may get saddled with higher interest rates than their Prime and Superprime
    counterparts, while Subprime borrowers might be denied outright"): "where a lender might say no", "higher rates than
    prime", "lower rates than near prime", "the top tier".
- **What goes into a FICO score**: payment history 35%, amounts owed 30%, length of credit history 15%, new credit 10%,
  credit mix 10%. myFICO, "What's in my FICO Scores" (myfico.com/credit-education/whats-in-your-credit-score). Hence "paying
  every bill on time ... is about a third of a FICO score".
- **The lever** is Credit cards' own figure (`modules/debt/credit-cards/compute.js` `underLines`): with B the cards'
  balances and L their limits, `less30 = max(0, B - 0.3 L)` and `less10 = max(0, B - 0.1 L)`. Over 30% in use: "Paying
  less30 off your cards would bring the share of your limits in use under 30%"; between 10% and 30%: the 10% line; cards
  with no limit typed: add the limits; no card, or under 10% already: paying on time. The amount is rounded up to the
  dollar. Example (the invented family in `qa/fixtures/family-plan.mjs`): $6,400 owed on a $15,000 limit, 0.3 x 15,000 =
  4,500, so $1,900 (test 3).
  - **A card that carries a balance with no limit typed** (critic g35 #1, 2026-11-13): Credit cards' B counts its
    balance but L leaves it out, so B - 0.3 L would measure it against the other cards' limits (the renter with the Visa
    card's limit taken off: $9,800 owed, $6,500 of limits, "$7,850" where the cards that have a limit need $3,350). The
    lever is then "limits" with that card named ("Add the credit limit of the Visa card on the Debts page: without it, the
    share of your limits in use cannot be worked out."), and "How this is worked out" says the card has no limit on file
    instead of "owed of ... in limits". A card with nothing owed and no limit keeps the figure: its limit could only
    lower the share, so the amount stays enough (renter, Visa at $0: 5,300 - 0.3 x 6,500 = $3,350). Test "a card that
    carries a balance with no limit typed". Credit cards and What lenders see still show B - 0.3 L there (HANDOFF in
    the commit's report: the fix belongs in `modules/debt/credit-cards/compute.js`).
- **A score over a year old** (more than 365 days before today) adds "That was over a year ago: your bank or card app may
  show a newer one." (the builder's line: free scores in bank and card apps refresh monthly).
- **Credit freeze**: free to place and lift since September 21, 2018; it lasts until you lift it. FTC consumer alert "Free
  credit freezes are here" (September 2018) and FTC "What to know about credit freezes and fraud alerts" (August 2025).
- **Fraud alert**: one year, renewable; an extended alert lasts seven years and needs an identity theft report (FTC or
  police); the bureau you contact must tell the other two. Same FTC pages.
- **Free weekly reports** at AnnualCreditReport.com, permanent: Equifax, Experian and TransUnion, joint release of
  2023-09-18 (CDIA), and the FTC consumer alert "You now have permanent access to free weekly credit reports".
- **A dispute with a bureau**: 30 days from receiving it (15 U.S.C. 1681i(a)(1)(A)), up to 15 more when the person sends
  relevant information during those 30 days (1681i(a)(1)(B)), 45 days when the dispute follows the free annual report
  (1681j(a)(3)); written results within 5 business days after it finishes (1681i(a)(6)(A)). law.cornell.edu. The CFPB's
  "How do I dispute an error on my credit report?" (reviewed 2026-09-02) for disputing with the company that reported it.
- Facts only, no code taken from anywhere.

## First view and parts
Simple first (`docs/OPTIONAL.md`), one sentence per case (R5), each with a test:

| case | headline (`h1`) | under it |
|---|---|---|
| no score yet | "Your credit score" | "Type your score and the date you saw it. Your bank or card app often shows it for free." and the form, open: Score, The day you saw it, Whose (only with two adults), Which kind (FICO / VantageScore / Not sure); one filled button, Save |
| FICO | "Ana's score: 712" ("Your score" for the unnamed first adult) | "Seen November 2, 2026: good on FICO's scale (670 to 739)." |
| VantageScore | as above | "Seen November 2, 2026: VantageScore calls 661 to 780 prime, lower rates than near prime." |
| Not sure | as above | "Seen November 2, 2026. Your app names the kind of score (FICO or VantageScore): pick it with your next score to see what it means." (no band words) |
| two people | "Ana's score: 712 · Bo's: 655" | one sentence each, led "Ana's, seen ..." / "Bo's, seen ..." |
| over a year old | as above | the case's sentence, then "That was over a year ago: your bank or card app may show a newer one." |

Then the lever (one of four sentences, above), and "+ Add a newer score" (outlined; it opens the form in place with
Cancel). After Save the green line names the new answer: "Saved. Bo's score: 712, good on FICO's scale." No filled button
once there is a score.

| part | kind and title | holds | status |
|---|---|---|---|
| `scores` | more, "N more scores" | the small line (an inline SVG and its words, "Ana's scores from 662 in February 2026 to 712 in November 2026") for each person with three or more scores; every older score with whose, which kind, its band and Remove | - |
| `safe` | own, "Keep your credit safe" | what a freeze does; one form (the kit's `ui.form`, its own tick under its words, no style of this page's): a tick per adult and bureau ("Frozen at Equifax"; "Bo: frozen at Equifax" for two adults), saved on the tap, and "Fraud alert until (optional)" per adult with "Save the alert day" ("days" for two adults); the green line says what is true now ("Saved: Bo's credit is frozen at TransUnion."); the fraud alert and the free weekly reports; sources. Kind `own`, not `how`: it holds the person's own boxes, so the "Show how answers are worked out" switch never opens it, and its boxes sit in a form (docs/OPTIONAL.md R30, R32) | one adult: "none frozen yet", "frozen at 2 of 3", "frozen at all 3"; two or more, in people frozen at all three bureaus: "1 of 2 people frozen", "both frozen at all 3", "all 3 people frozen", "partly frozen" (never "3 of 6": critic g35 #2) |
| `fix` | how, "Fix a mistake on your report" | four steps with the 30 / 45 days and 5 business days; sources | "4 steps" |
| `how` | how, "How this is worked out" | FICO's bands, VantageScore's tiers, why "Not sure" has no word, what goes into a FICO score, the lever worked out with the person's cards, "this app never asks a bureau", sources | "5 bands" |

"More on this" (once there is a score): "Which card should I pay first?" (Credit cards), "What would a lender see?" (What
lenders see). Both of those pages link back: "What is my credit score?".

**Builder chose** (the design left these open):
1. "Which kind" is a fourth box in the first five, not under "More details (optional)": its hidden default ("Not sure")
   would decide what the score is said to mean (R21's "a box whose hidden default would mislead"). It defaults to the
   kind of the last score typed, else "Not sure"; never to FICO, which would put FICO's words on a VantageScore.
2. VantageScore's tiers are shown with VantageScore's own names and a plain gloss from its guide; the design asked only
   that FICO's words never be put on another scale.
3. The newest score is corrected by typing it again for the same person and day (it replaces); older scores have Remove in
   "N more scores". No Edit button on the first view.
4. A freeze tick saves on the tap; the fraud alert's day waits for "Save the alert day". The safer of the two for a
   once-and-done action (integ2 check, item 4): a freeze is placed once, at the bureau, and a tick that waited for Save
   was lost without a word when the person left the page, so the page would later say "none frozen yet" about a freeze
   that is in place. A tap by mistake is named in the green line ("Saved: Bo's credit is frozen at TransUnion.") and one
   more tap undoes it ("... is no longer marked frozen ..."). The day keeps its Save because a date box changes on every
   digit typed on a computer (AGENTS rule 4: never per keystroke). The lede says "each box is saved when you tap it".
   The ticks are the kit's own `ui.form` checkboxes inside the one form (S15), so the page has no style of its own aimed
   at the kit's `.field` (the reconcile's `.cs-safe .field:has(...)` lines went). "Keep your credit safe" stays open after
   the redraw, with its green line (R17).
5. "More on this" waits for the first score, so the empty page has one way to start.
6. The headline names the person as typed ("Ana's score"); "Your score" for the first adult Get started left unnamed
   (`core/words.js`).
7. The glossary's "Credit score" entry (`modules/ai/glossary/data/terms.js`) gains the names "FICO", "FICO score" and
   "VantageScore" and this page, so the glossary explains the word the page uses (its abbreviation test asks for it).
8. The Score box is not marked `whole` for the form kit: the kit's words for 712.5 would be "Use a whole number, like 12."
   (12 is not a score; critic g35 #3). Save says "Type a whole score from 300 to 850." at the box instead, and the kit
   still says "Use a number from 300 to 850." for a score off the scale.

## Edge cases
- Empty plan or no people: one stand-in adult with no id; no "Whose" box.
- A score whose person was removed: the one adult's when there is one; its own row otherwise.
- Anything in `credit` that is not what the shape says (a score off the scale, a date that is not a date, an unknown kind)
  is skipped or read as "Not sure"; nothing crashes (test "odd values").

## Tests
`module.test.mjs`: the five tests the design names (band edges at 579/580, 669/670, 739/740, 799/800; "Not sure" gives no
band words; the lever equals Credit cards' figure; freeze ticks saved per bureau; the empty state), plus one sentence per
case, the lever per case (a card that carries a balance with no limit among them), "Keep your credit safe"'s status for
one, two and three adults, a score with a part after the point getting this page's words, the history and saving, the page's first view and parts on the fake DOM, Save and its green line,
a tick that saves on the tap and keeps its part open, the day that waits for its Save, a Save with nothing changed, every qa household drawn within the parts budget, the links rows on What
lenders see and Credit cards, and the invariance rule: with `credit` present, What lenders see, Credit cards and the rest of
the debt group give byte-identical output over every qa household and the four fixture plans, and every other page that is
not heavy over the four fixtures (Diagnostics' and Settings' file size and Export's copy of the plan left out).

## Ideas / not yet
- A reminder to check the score every few months (the money calendar's own reminders can do it today).
- The score in "If something happens to us" (the freeze state matters to a family after a death).
