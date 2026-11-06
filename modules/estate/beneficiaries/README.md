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

## Edge cases
- Accounts with no owner: the spouse rule is skipped.
- Ex-spouses cannot be detected; the page asks to copy names from the provider's own form.

## Tests
`module.test.mjs`: `listOf`, an empty plan, the family with nothing on file (which accounts count, the money with no one named), every flag, a clean row, a child under 18 matched by the person picked or else by name (and not once 18).

## Ideas / not yet
- Per-stirpes versus per-capita; a trust named as beneficiary of a retirement account (see-through rules).
- Print the list for the executor (Reports).

Review 2026-11-06 (round 7): the 401(k) spouse flag ("you are not the main beneficiary ... unless you signed a waiver", "your spouse is not ...") and the born-after flag ("you were born after it was last checked") say you/your for the unnamed first adult ("Me") and "your spouse" for the setup's "My spouse", with the verb to match; typed names read as before, and the quick-pick chips keep the names as labels (core/words.js). Words only. Test: "the first adult left unnamed ("Me") and the setup's "My spouse": the flags say you and your spouse".
