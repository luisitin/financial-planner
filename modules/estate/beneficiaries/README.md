# Beneficiary audit  (`estate/beneficiaries`)

**Status:** usable (phase 8)
**Purpose:** Every account and policy that passes by a beneficiary form rather than the will, who is named on it, and what to fix.

## Inputs
`accounts` (types in `NAMED`: 401(k), IRA, Roth, HSA, 529 (successor owner), brokerage (TOD), checking and savings (POD), life cash value), `insurance.policies` (term and whole life, not ended), `household` (the spouse, children's ages, filing status), `estate.beneficiaries`. Writes `estate.beneficiaries[]`: `{ key ("account:<id>" | "policy:<id>"), accountId | policyId, primary: [{ name, share (fraction), personId }], contingent: [...], reviewedAt }`. Older rows with a plain-name `primary` and only `accountId` are still read.

## Outputs
`compute(plan, { today })` -> `{ items[], count, named, missingValue, married, warnings[] }`; each item `{ key, source, id, name, ownerId, typeLabel, form, value, primary, contingent, reviewedAt, flags[], minors[], ok }`; `minors`: `[{ name, personId, level: "primary"|"contingent", text }]`, each household child under 18 named on it with its flag's words (`minorWords`).

## Flags
| flag | rule |
|---|---|
| no one named | no primary; for retirement accounts, an estate as beneficiary usually means a faster payout (the five-year rule when the owner dies before required withdrawals start) |
| shares | primary or contingent shares not adding to 100% (a single name counts as 100%) |
| no backup | primary named, no contingent |
| a child named directly | a household dependent under 18 today, matched by the entry's `personId` when it has one (the person picked), else by the name typed; minors cannot take the money: a court appoints a custodian. Its own line on the row (2026-11-02): "Child 1 is under 18 and can't receive this directly: name a custodian under your state's Uniform Transfers to Minors Act (UTMA), or a trust." Life insurance needs' "How to get it" links here ("Beneficiary audit") |
| the estate named | probate, and the retirement payout rule above |
| spouse left off a 401(k) | married (filing status, or two adults) and the other adult not a primary on a 401(k): ERISA gives a married participant's 401(k) to the spouse unless the spouse waived it in writing (29 U.S.C. 1055) |
| old | checked `REVIEW_YEARS` (5) or more years ago, or before someone in the household was born |

## First view and parts (simple first, 2026-11-13)
`docs/OPTIONAL.md`; opt spec row: class C. The two tiles become one sentence per case (`headlineOf`, `ledeOf`, a test each):
- "6 accounts and policies have no one named" / "4 of 6 ... have no one named" / "1 of 6 ... has no one named" / "Your
  one account or policy has no one named", each with "$X could go through the courts before anyone gets it." ("could":
  the sum counts every account with no one named, and a joint account may still pass straight to the other owner; critic
  F4, 2026-11-13), or, when those hold nothing yet, "Name someone on it now, so it goes straight to the people you
  choose." ("on each now, so they go ..." for more than one);
- "Everyone has someone named; 2 need a look" with "Tap the ones marked ⚠️ to see what to fix.";
- "Every account and policy has someone named, and a backup" with "Check them again every few years, and after a birth,
  a death, a marriage or a divorce."
One filled button: the next one to do ("Name someone on Chase checking", or "See what to fix: ..."), which opens that
row's form; none while a form is open (its Save is the filled button) and none when all is well. Opening or shutting a
row draws the page again so the filled button follows. The list shows six rows, then "N more accounts and policies"
(`rest()`); a row with something to fix or an open form is never hidden. After a save the green line names the new
answer ("Chase checking saved. 3 of 6 accounts and policies have no one named."). "More on this" as questions: "Are the
will and the other papers signed?" (Estate documents), "Who should get what you leave?" (Legacy goals), and "What would
your family need if something happened to you?" (If something happens to us).
No busier than the two tiles it replaced (critic F3, 2026-11-13): "Copy each name from this account's own beneficiary
form, on the provider's site under beneficiaries." is the first line of the form, where it is used, not a paragraph on
the first view; the family with nothing named reads 109 words in Node (97 before, 141 with the long lede and the hint).

## Edge cases
- Accounts with no owner: the spouse rule is skipped.
- Ex-spouses cannot be detected; the page asks to copy names from the provider's own form.

## Tests
`module.test.mjs`: `listOf`, an empty plan, the family with nothing on file (which accounts count, the money with no one named), every flag, a clean row, a child under 18 matched by the person picked or else by name (and not once 18); the headline per case, the one filled
button and More on this, the six-row cut, and S11 (the green line names the new answer; no fold opens or shuts).

## Ideas / not yet
- Per-stirpes versus per-capita; a trust named as beneficiary of a retirement account (see-through rules).
- Done 2026-11-13: the list prints in Reports > If something happens to us (who is named on each account and policy).

Review 2026-11-06 (round 7): the 401(k) spouse flag ("you are not the main beneficiary ... unless you signed a waiver", "your spouse is not ...") and the born-after flag ("you were born after it was last checked") say you/your for the unnamed first adult ("Me") and "your spouse" for the setup's "My spouse", with the verb to match; typed names read as before, and the quick-pick chips keep the names as labels (core/words.js). Words only. Test: "the first adult left unnamed ("Me") and the setup's "My spouse": the flags say you and your spouse".
