# Legacy goals  (`estate/legacy`)

**Status:** usable (phase 8)
**Purpose:** What you want to leave and to whom, in today's dollars; the amount the plan should still have at its end for it; whether it does, and what each lever would have to be if not. One tap away: who would get what today, as one picture.

## Inputs
`estate.legacy`, `accounts` (homes), the retirement plan (`buildInputs`, `project`) and Goal seek. Writes `estate.legacy = { bequests: [{ id, to, kind: "person"|"charity", amount, notes }], includeHome }`. Heavy: Goal seek solves several levers.
"Who gets what" reads (never writes) `household.people`, `accounts`, `insurance.policies`, `estate.beneficiaries`,
`estate.worksheet.rest` and `estate.documents` (the will rows). No new field.

## Outputs
`compute(plan, { today })` -> `{ bequests[], total, people, charity, home, includeHome, target, ready, missing, endReal, success, meets, gap, endYear, levers }`. `legacyTarget(plan)` -> `{ total, home, target }` is shared: it is the goal Goal seek starts from, and the charity total is a deduction on Estate tax.
`whoGetsWhat(plan, { today, dies })` (light, pure; only the view calls it, `compute()` is unchanged) ->
`{ ready, couple, cases: [{ id, label }], dies, dead, total, rows: [{ key, name, amount, share, joint, named, will, others? }],
unnamed: { amount, share, things } | null, kept: { names, amount } | null, debts, any, wishes, signed, gap: { id, amount, ... }, status }`;
its sentences: `ledeWords`, `detailWords`, `unnamedWords`, `gapWords` (+ `GAP_LINKS`), `keptWords`, `debtWords`, `ruleWords`,
`NOT_ADVICE`, `UNNAMED`; `formShares(list)` reads one list of names on a form.

## Formulas
- Total = the sum of the bequests (today's dollars). Home = the property accounts' value when `includeHome` (the home passes as it is, so the savings need not hold it). Target = max(0, total - home).
- The plan leaves `endReal` = the projection's end balance in today's dollars; meets when the plan lasts and endReal >= target; gap = target - endReal.
- Levers: `scenarios/goal-seek` compute with `legacy` = target (the most to spend, the latest retirement, the saving, the return, the lump sum, the claiming age that still leave it).

## Edge cases
- No bequests: nothing to check; Goal seek is not run.
- The plan cannot be built (no birth dates): the bequests are listed, the check waits.
- A home worth more than the bequests: target 0.

## Tests
`module.test.mjs`: the target with and without the home (never below 0), nothing to leave, the family's legacy (shares, kinds, the check, the levers when it is short), not ready.
Who gets what: the parts add up to the total in every case for every invented household; shares on a form; a form beats
the wishes; a joint account goes to the other owner (and its form decides once both are gone); an account with no one
named; a plan with no estate data; one test per gap sentence and per lede, rule, kept and debts line; life policies and
the savings inside them; the page (the row's place, status and words, the chips save nothing, S11, no fold by hand and
the structure checks); invariance against `invariance.json`.

## Ideas / not yet
- A share of what is left instead of amounts; charities through a donor-advised fund or a charitable remainder trust.
- TPAW-style legacy that trades spending against what is left smoothly (the seed in the catalog).

## Stress test 2026-11-11 (touch and input)

- The amount is required (1 to 1,000,000,000): an empty Add was saved as $0 and said "added" (IE-2).
- The home's tick box saves the moment it is ticked, with a green line, instead of its own filled Save beside the add form's Add: one filled button per screen (IE-7).

## Fix round 1 of the owner's request 2026-11-11 (2026-11-12, B3)
"Does the plan leave it?" lists Goal seek's changes through `listedLevers` (compute.js): not `info` levers (the return it needs is
information on Goal seek, never a change: it read "The return it needs ... That isn't a choice you can make." as the fourth of five
changes and pushed the Social Security card out), not "same", at most five. Test: a Jamie-like short household leaving $20,000
lists no return and does list the claiming age.

## Fix round 2 (2026-11-13): simple first (owner, 2026-11-12 and 2026-11-13)
- "Does the plan leave it?" shows the first three changes and folds the rest under "N more changes" (their names in the fold's
  line). `listedLevers` now keeps Goal seek's first-view order (`firstLevers`: what is worth money first, then the changes that get
  there on their own, those with room, "not on its own" last), at most five, still without the return it needs or a "just right".
  The saving change that names a 401(k) with nothing going in is among the first three even when saving alone cannot get there
  (final fix, 2026-11-13; Goal seek's README; test "final fix (rule 7) ...").
- The add form shows three boxes (to whom, who, the amount); the optional note is one quiet tap away under "Add a note". When the
  one being changed has a note, the fold is open and its line says "has one" (nothing of the person's is hidden). The note is read
  from inside the fold when saving; opening it changes nothing. On a phone a fold's line goes under its title.
- Kept: everything else on the page, the outlined "Goal seek" link, the folded "+ Add someone" once someone is listed.
- Test: "simple first (fix round 2) ..." (the order equals `firstLevers`, three first and the rest folded, the note folded and
  closed for a new entry, open with "has one" when changing one with a note, the note saved from inside the fold, nothing saved by
  opening).

## Who gets what, as one picture (gap list, next 60, item 15; 2026-11-16)
Legacy goals said what the person *wants* to leave; nothing said who would get what *today*. One quiet row now does,
just above "More on this": "Who gets what", its line the number of names in the picture ("2 names") or "nobody named
yet" when no one receives anything by a name in the case drawn (nothing written, or every name given 0% or gone). No row while the plan holds nothing to pass on (the empty plan's first view is as
it was). The hero's small line, when the row is there, points to it ("A planning goal, not a will: Who gets what, below,
shows what passes today.") in place of the longer one, so the first view has fewer words than before (family: 109, was
110; empty plan: 88, was 89).

**Open:** for a couple, three chips ("If Ana died", "If Bo died", "If both died"; the first adult's case first). A chip
redraws the picture in place and saves nothing (the choice is kept on this tab: Back and a reload keep it). Then the lede
("If Ana died today, $499,700 would go to:"), one bar per person or cause, largest first (accent; at most six rows, the
rest as "N others"), and "Nobody named yet" last, in amber, its line "by the will or the state's rules: " and the biggest
things in it; each row says how it gets there ("as the other owner", "named on the forms", "by your wishes for the will",
or each with its amount); for one adult or "If both died", the people and causes on this page's own list who get nothing
here ("Cy ($50,000), on your list above, gets nothing here: the list is a goal for the plan, not a will, so write it as a
special gift on Choices to take to a lawyer."); one sentence naming the biggest gap with a link to the page that fixes
it; what the survivor owns alone ("What Bo owns alone ($73,000) stays with Bo."); the debts; the order things pass in and
"Information, not legal advice: ...", said once on the page. No box, no notice.

### Formulas (arithmetic and an order; no figure from a table)
1. Adults: the household's people who are not dependents (none: one unnamed "you"). An account's owner is its `ownerId`
   when that is an adult (by id, else by exact name, for older plans); otherwise the one adult's, or held together for a
   couple.
2. Who died: the chosen adult, or both (all). In the picture: what the dead owned, what is held together, and the life
   policies on the dead (or on the household, `personId` ""). What a surviving adult owns alone stays (`kept`).
3. Values: `countedBalance` (net worth's own), never below 0, and the death benefit of each term or whole life policy not
   ended (Beneficiary audit's own list). A "Life insurance cash value" account is left out when its owner has a whole
   life policy: the death benefit already holds it.
4. Order, for each thing:
   a. held together and an owner survives: all of it to the surviving owner(s), in equal parts;
   b. its form (`estate.beneficiaries`) names someone: the first choices alive take it by their shares; a first choice
      who died passes their share to the living first choices in proportion; when every first choice died, the backups
      take it the same way. Shares: all blank = equal; a blank among typed ones = 0; a sum under 100% leaves the rest to
      (c); over 100% is scaled to 100% (`formShares`). The estate named on a form ("My estate", "The estate", "Estate":
      Beneficiary audit's own `ESTATE`) is no one: its share goes on to (c), through the will and the courts (probate);
   c. the rest goes by the will: the wishes on Choices to take to a lawyer (`estate.worksheet.rest`, read through that
      page's own compute) split it by their shares, leaving out anyone who died (the others scaled up); with no wishes
      (or only people who died in them) it is "Nobody named yet".
5. One row per recipient: the household person (by `personId`, else the same name), else the name typed (case and spaces
   ignored). Row = joint + named + will; share = row / total. Rows plus "Nobody named yet" = total, to the cent (tested over
   every invented household and every case).
6. The biggest gap: "nothing" when something in the picture takes a form, no form in the picture names anyone (or the
   estate), no wishes name anyone alive in this case and no will of someone who died is signed; otherwise the case with
   the most money among a form naming someone no longer in the plan (`personId` not found and the name matches no one),
   an account or policy that takes a form and names no one (or names only at 0%), a form naming the estate (its share),
   every first choice died with no backup, a household child under 18 named directly, a household child under 18 who gets
   money by the wishes while Choices to take to a lawyer has no "Age each child gets their share" (`minorWill`), no wishes
   and no signed will (the will's whole part), wishes but a will not signed for each person who died (ties in that
   order); otherwise "ok" (nothing goes by the will) or "okWill". A will is signed when Estate documents has its row for
   that adult with status "Signed" (or the older `done`).
7. The list on this page (`estate.legacy.bequests`), for one adult or when everyone died (the list is for the end of the
   plan): each person or cause on it, matched as in 5, who gets nothing in the picture, is not someone who died and has no
   special gift written for them on Choices to take to a lawyer (`worksheet.specific`, by `to`), with the amounts on the
   list added (`goals`). Said in one sentence; never added to the picture (the list is a wish, not a form or a will).
8. An empty entry in the plan's lists (a null person, account, policy, form or document row) is skipped before anything
   reads it, also by the two pages' computes read here (a null form row threw inside Beneficiary audit's and blanked the
   page); the view draws the page without the row if the picture still cannot be read.

### Sources (read 2026-11-16)
- IRS, "Retirement topics - Beneficiary" (page last reviewed 2026-08-01): a beneficiary is the person or entity the owner
  designates, under the plan's procedures, to receive the account after they die; some plans require a spouse.
  https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-beneficiary
- IRS Publication 559, Survivors, Executors and Administrators: property held as joint tenants or tenants by the entirety
  goes to the surviving tenant ("Joint interest"). https://www.irs.gov/publications/p559
- IRS Instructions for Form 706 (07/2026), Schedules D and E: life insurance payable to beneficiaries other than the
  estate; joint tenants with right of survivorship and tenants by the entirety. https://www.irs.gov/instructions/i706
- No figure on the row comes from a table, a rate or the AI. What is this page's own model, said in the part as
  "Information, not legal advice: the forms, how each thing is titled and your state's rules decide.": that what has
  no owner in a couple is held with right of survivorship (a title can say otherwise); that a first choice who died
  passes to the other first choices (how most plan forms read; a form can say "per stirpes"); that two people who die
  together each pass their own things; that debts are not taken off (a loan on a home goes with the home; other debts
  are usually paid before anyone gets the rest, by state law). The consumer pages of other agencies were not readable
  from this session and nothing here relies on them.

### Not drawn (and why)
- Special gifts on Choices to take to a lawyer have no amount: they are not in the picture.
- A transfer-on-death deed for a home, a trust holding accounts, community property rules: not in the plan, not drawn.
- Legacy goals' own amounts (what you want to leave at the end) are a goal for later, not who gets what today; the
  picture does not add them. Who on the list gets nothing in the picture is said in one sentence (formula 7), with where
  to write it down: a sum for one person is a special gift on Choices to take to a lawyer.

### Builder's choices
- The picture is a short list with bars (name and amount on one line, the bar, its share and how under it): it reads at
  320 px without a legend, where a stacked bar per person needed one. Drawn with scoped `<div>`s like Buckets and Next
  best action (`retirement/charts.js` draws only lines and bands).
- A couple's first case is the first adult's death (what the "joint goes to the other owner" rule is about); "If both
  died" shows where everything ends up. The chip is a view choice, never in the plan: kept in the view's variable (Back)
  and in `sessionStorage["planner.legacy.whose"]` (`.sandbox` in the sandbox; this tab only, so a reload keeps it), an
  adult's id or "both", never a name or a figure; a case the plan no longer has draws the first.
- Reviewed by two critics (2026-11-16) and changed: the estate on a form was drawn as a person who receives it and the
  gap said all was well (it is no one now, and its own gap); the line said "0 names" when nobody received anything ("nobody
  named yet"); a child under 18 by the will was not said (`minorWill`); a null entry in a list blanked the page; the
  list on this page was left out without a word (formula 7); "not set yet", "Nothing here says who gets what yet: start
  with ...", "What is Bo's alone" and the three-line amber title read badly; a reload put the chip back to the first case.
  Not changed: the row stays open after Back and a reload (core/ui/more.js keeps a person's own tap; the critic's script
  tapped the title again after the reload, which shut it).
- The row's line follows the case drawn: a chip changes it in place ("1 name" for Ana alone, "2 names" with both gone),
  so the line never counts names the open picture does not show. Whether the row is drawn does not depend on the case.

### Opt conversion (opt spec 6.2, class B: this page had no opt commit of its own)
Drawing the new row with `core/ui/more.js` makes the page "adopted", so its two folds by hand go through the helper in
the same change: "N more changes" is the part `changes` (its line names the changes when they fit in 20 characters), and
the note is the add form's own "More details (optional)" (`more: true`; open when the one being changed has a note).
The fix round 2 test reads the new markup. Title "Who gets what" pinned in `qa/first-view-lib.mjs` with its reason.

## Look after it (2026-11-16)
- "Does the plan leave it?", when it does and there is room to spend more, read "While still leaving it, you could spend
  If markets do as well as average, up to about $8,080 a month ..." (Goal seek's sentence now opens "If markets do as
  well as average,"). `roomWords` reads it as one sentence: "While still leaving it, if markets do as well as average, you
  could spend up to about $8,080 a month ...", and the older "Up to ..." as before. Test "Does the plan leave it?: the room
  to spend reads as one sentence".
