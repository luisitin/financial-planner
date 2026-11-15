# Rules  (`transactions/rules`)

**Status:** usable (phase 3)
**Purpose:** The rules that file transactions for you: when the description contains this, give it that category (and a readable name).

## Inputs
Plan sections read (`needs`): `rules`, `transactions`, `accounts`, `categories`. Writes: `rules`, `transactions` (when "file now" is pressed).
Rule shape: `{ id, contains, wholeWords?, accountId? ("" = any), direction: "any"|"in"|"out", category?, payee? (rename), tag?, tags?, match?, amount?, anyOf?, hits, createdAt }` (the fields from `tags` on: gap #42 below).

## Outputs
`compute(plan)` -> `{ rules[] (with categoryLabel, matches over current transactions), count, uncategorised, wouldFix, total }` (unchanged by gap #42: `matches` counts the lines a rule fits, `wouldFix` what the filing rules would file).

## Formulas
- `normalizePayee(text)`: lowercase; drop `.com/...` web addresses, dates, `#`/`*` store codes, statement words (pos, debit, credit, purchase, ach, ...), any token with a digit, punctuation; collapse spaces. Both the rule text and the transaction text go through it, so "NetFlix.com" matches "NETFLIX.COM 866-579-7172 CA".
- `prettyPayee(raw)`: the first three words of the normalised text longer than two letters, capitalised.
- `matchRule(rule, tx)`: account (if set), direction (if in/out), then normalised contains over `rawPayee` and `payee`. Since gap #42 it is `ruleFiles(rule) && fitsRule(rule, tx)` ("would this rule file this line?"), the same for every rule with a category.
- `applyRules(rules, txs, { force })`: first matching rule wins; only uncategorised transactions change unless `force`; returns new objects (inputs untouched), `changed` and per-rule `hits`. Gap #42: the walk below.
- `ruleFor(rawPayee, category)`: what the Categorise page saves: `contains` = first three normalised words, `payee` = prettyPayee.

### What a saved rule keeps (2026-11-01)
`ruleText(raw)`: the shop's own name, without what changes from one branch or card to the next. A star separates a payment
service from the shop (`payeeWords`: "PAYPAL *NETFLIX" -> "paypal netflix"; normalizePayee alone gives "paypal", which put every
PayPal shop under one rule). The line is cut at its first word with a digit or # (store numbers and codes); a trailing
two-letter state code is dropped; a line cut at a code keeps the words before it, two at most ("shell oil", "southwest airlines",
"kroger": a single word would also file Southwest Gas under travel); a line with a city and state but no code keeps a web address
alone ("netflix"), or one long word that is not a common first word (`COMMON_FIRST`: american, united, first, national...), else
two words; otherwise up to three words, as before. A first word that only says what kind of line it
is (transfer, zelle, payroll, paypal, sq...) keeps the first three words of the whole line.
Rules made this way carry `wholeWords: true` and match whole words only ("shell" never files "ZELLE TO SHELLEY"); a rule typed on
the Rules page still matches any part of the line, as before. The rule renames the payee to the words it matches on (`ruleName`:
"Kroger" for every branch, not "Kroger Dayton"; "Blue Bottle" for "SQ *BLUE BOTTLE", "Netflix" for "PAYPAL *NETFLIX"), and to the
old three-word name for a kind-of-line rule ("Transfer Sav").
Fewer than four letters left: the old rule (the first three words of the normalised line). "KROGER #0388 DAYTON OH" -> "kroger"
(it was "kroger dayton oh", which missed the card's "KROGER #0421" and another branch); "SHELL OIL 57442" -> "shell";
"NETFLIX.COM LOS GATOS CA" -> "netflix". `ruleFor` uses it, so the Categorise page and the AI categoriser save the same text.

## Edge cases
Empty `contains` never matches. Two rules matching the same line: the earlier one wins (the order on the page; Move up and Move down change it since gap #42). Removing a rule leaves already-filed transactions as they are. A rule whose category was later hidden on the Categories page still opens on it, marked "(hidden)", so it can be edited; new rules offer only shown categories.

## Tests
`module.test.mjs`: normalisation cases, matching with direction/account, apply with rename/hits/force/no mutation, ruleFor round trip, compute counts.

## Ideas / not yet
- Regular expressions (a person cannot read one; "starts with" and "is exactly" cover what people ask for); a rule that
  tags lines already filed; show which rule filed a transaction; drag to reorder (Move up / Move down is one tap each).

## "And add the tag" (gap #24, 2026-11-14, claude-b)
A rule may carry `tag` (one, kept lower case without "#"). The rule adds it to each line it files (on import, and with
"File N uncategorized transactions now"), never twice; a line already filed is left alone, as before. The box is optional
and waits under the form's "More details (optional)"; the green line says what it does ("Rule added. It adds #trip to each
line it files from now on."). A rule without a tag does exactly what it did (tested). Where the money goes adds each tag up.
A purchase split across categories keeps its parts and its category when rules are run over everything (`force`): the
pages that total by category read the parts, so a new category on the whole would change nothing. The rule may still
rename or tag it, and counts it as changed, and as a hit, only when it did.

## Amounts and patterns, several actions, an order (gap next-60 #42, 2026-11-15, claude-b)
**What a person sees first.** Nothing new until they have rules: the add form now opens with three boxes ("When the bank
description contains", "Give it the category", "And show the payee as"); "Money" and "Only in this account" moved
under "More details (optional)" with the new choices (their defaults are the broadest, so nothing hidden misleads). With
two rules or more, "Your rules" starts with one plain line, "Rules are tried from the top. The first one that fits a line
files it.", the rows are numbered, and after six the rest wait behind "N more rules" (`rest()` from `core/ui/more.js`).
**One tap away.** Under "More details (optional)": "How the words must match" (Contains them (usual) / Starts with them /
Is exactly them; "Capitals, store numbers and dates never count."), "And the amount is" (Any amount / Exactly / At least /
At most / Between) with "Amount" once a kind is picked and "And up to" for Between only (no empty box under "Any
amount"; a box its choice hides is not read, so nothing out of sight is saved), the two narrowing choices ("Money": In or
out / Only going out / Only coming in; "Only in this account"), and "And add tags" (several, with commas between). The
category is no longer required: a rule needs one thing to do (a category, a name, a tag). Tapping a rule opens its form
with "Move up" and "Move down" (outlined, 44 px, each only where it can move) in one quiet row over the form, and "Remove
this rule" under it as before; the form stays open after a move so a rule can climb several places, with what was typed
in it and its More details as they were (a move saves the order only; "Save changes" saves the rest), and the green line
says where it is now.

**The fields** (all optional, read with a default, no version bump; `docs/DATA_MODEL.md` `rules` row):
`match` ("starts" | "exact"; absent: contains), `amount` (`{ is: "exactly" | "atLeast" | "atMost" | "between", value,
to? }`), `anyOf` (more texts, matched the same way), `tags` (more tags after `tag`), and `category` absent for a rule that
only renames or tags. A rule saved before has none of them and does exactly what it did (the invariance test).

**Formulas** (the app's own definitions; nothing here is a figure from outside the app, so there is no outside source):
- Contains (unchanged): the line's text `normalizePayee(raw) + " " + normalizePayee(payee) + " | " + payeeWords(raw)`
  includes `normalizePayee(text)`; a rule made from a bank line (`wholeWords`) compares whole words.
- Starts with / is exactly: the line's two texts `payeeWords(rawPayee ?? payee)` and `payeeWords(payee)` against
  `w = payeeWords(text)` (lower case, card codes, store numbers, dates and punctuation dropped); an empty `w` never fits.
  Starts: `c.startsWith(w)` for a typed rule (any start, as contains takes any part), whole words (`c === w` or
  `c.startsWith(w + " ")`) for a rule made from a bank line. Exactly: `c === w`. "SQ *COFFEE 0000" is exactly "SQ *COFFEE
  1234" (the store number does not count); "Coffee" is exactly the name "Coffee" but not "COFFEE HOUSE ANNEX".
- `anyOf`: the rule fits when `contains` or any of these fits, by the same kind.
- Amount, in cents of the size of the line (money in or out alike; "Money" says which): `c = round(|amount| x 100)`,
  `v = round(|value| x 100)`, `t = round(|to| x 100)`. Exactly `c = v`; at least `c >= v`; at most `c <= v`; between
  `min(v, t) <= c <= max(v, t)` (either way round). Cents, so 0.1 + 0.2 is 30 cents. Absent or null: any amount. A
  condition this version cannot read (an unknown kind, a value that is not a number, between with one figure) fits no
  line: a rule never files by a condition it cannot read; its row says "an amount to fix".
- `ruleFiles(rule)` = `rule.category !== undefined`. `matchRule` = `ruleFiles && fitsRule` ("would this rule file this
  line?"): Categorize's "a rule matches" and the AI categorizer read it, so a rule that only renames is never suggested
  as a category, with no change on their side. A `category` of "" (only by editing the file) still files, as before.
- The walk (`applyRules`), first match wins for each thing: the rules from the top. A rule that fits and files sets the
  category and ends the walk. A rule that fits and files nothing gives its name if no rule above gave one, adds its tags,
  and the walk goes on. A filing rule's name is used only when no rule above gave one; tags add up, never twice. A line
  already filed (and not `force`) skips every filing rule, so only rename-only rules reach it. With no rename-only rule
  this is the old `find()` exactly. Hits: the filing rule as before; a rename-only rule when its name or a tag changed the
  line. `wouldFix` (the "File N now" count) runs the filing rules only, so a rename is never counted as filing.
- "File N uncategorized transactions now" (`fileOpen`): the lines with no category that the filing rules alone change (the
  `wouldFix` lines) go through the whole walk, rename-only rules included; every other line, filed or not, is left exactly
  as it is. So the button never renames a line that was already filed, a name typed by hand among them (critic F2,
  2026-11-15: run over every line, a merge's rule renamed filed lines without a word). With no rename-only rule it is
  `applyRules` over every line, what the button ran before, byte for byte.
- `moveRule(rules, id, by)`: swaps with the neighbor above (by -1) or below (+1); a new array; the same array at an end.
- `ruleTags(rule)` = the first piece of `tag` (as before), then `tags`, cleaned, once each.

**Words, one per case** (`savedWords`, `REFUSED`, `movedWords`, `orderWords`, `amountWords`, `whenWords`, each tested):
"Rule added." / "Rule saved." (a filing rule, as before); "... It adds #trip and #work to each line it files from now
on."; "... It shows each line it fits as Coffee; your other rules still pick the category."; "... It adds #trip to each
line it fits; your other rules still pick the category."; "... It shows each line it fits as Coffee and adds #trip; your
other rules still pick the category.". Refused at the box: "Pick a category, a name to show or a tag: a rule needs
something to do."; "Type the amount, or pick “Any amount”."; "Type the second amount for “Between”." (an amount under
"Any amount" needs no line: its box is hidden then). Moved: "Moved up. It is now the first rule, tried before
all the others." / "Moved up. It is now rule 2 of 5." / "Moved down. It is now the last rule, tried after all the
others." / "Moved down. It is now rule 3 of 5.". Rows: `"kroger" → Groceries` (as before), `starts with "amzn" →
Shopping`, `exactly "sq coffee" or "coffee" → shown as Coffee`; details "exactly $15.49", "$100 or more", "$20 or less", "$10 to
$20", "adds #trip, #work".

**Builder's choices.** Amounts compare the size, not the sign: "at least $100" means a $100 purchase or a $100 deposit,
and "Money" narrows it; a signed amount would make "at most -$20" a riddle. No regular expressions: a person cannot read one, and
starts with and is exactly cover what the gap list asks for in plain words (no code from another app is used). A rename-only rule does not end the walk, so a merge never stops a line being filed;
a filing rule still does, so every rule saved before works byte for byte. Move up / Move down live in a rule's own form
(one tap away), not on every row, so the list stays a list; they sit over the form, apart from Save, so the form's end
has one filled button and Remove (critics F1 and F4, 2026-11-15: a move used to drop what was typed, and three buttons
stood in a second row under Save).

**Tests** (`module.test.mjs`, "gap #42"): each match kind, each amount kind, each action and the walk, moveRule, every
sentence, the page (three boxes, the fold, a rename-only save, an amount save, each refusal, an old rule saved unchanged,
the order line, Move up with its form kept open, S11), and the critics' findings: a move keeps what was typed and the
fold, the amount boxes follow their choice, "File N now" leaves filed lines' names alone, the AI categorizer never gives a
rename-only rule a category. **Invariance**: over every `qa/fixtures/*-plan.mjs` plan, the 14
households, the phone households and the empty plan, each given `qa/fixtures/bank-lines.mjs` lines, every bank CSV in
`qa/fixtures` and thirteen rules of every old shape, a digest of this page's compute(), applyRules (and forced), the
fits matrix, every CSV imported through the rules, Categorize's compute() and the AI categorizer's filing equals the one
written from 461df76 (`invariance.json`; `PRINT=1 node --test modules/transactions/rules/module.test.mjs` writes it
again after a deliberate change); and the new fields at their defaults change nothing.

## Merging payee names (gap next-60 #42, 2026-11-15, claude-b)
**What a person sees.** When the lines show two spellings of one shop, a card "Payee names that look alike" follows the
rules: "The same shop can come spelled more than one way. Merge them to see one name; amounts and dates stay as they
are.", then one record per shop ("Coffee and SQ *COFFEE 1234 · 8 lines") with two outlined 44 px buttons, "Merge as
“Coffee”" and "Choose the name". The first three shops show, the rest wait behind "N more shops" (`rest()`). Nothing is
saved until a tap. "Choose the name" opens, under its record, "Show them all as" (the suggested name) and a check box per
spelling, all on, with "Merge" (refused with "Check a name that is not already Coffee." when nothing would change). A merge
says "Merged: 3 lines now show as Coffee. A rule keeps new ones that way." with an Undo ("Undone: the lines have their old
names again and your rules are as they were."; `ui.undoneWords` adds the line for a change made since). The card shows only
while there is something to merge; on the invented households (no bank lines) the page is as before.

**Which names look alike** (`shopKey`, `lookAlike`; the app's own definitions, no outside figure):
- `shopKey(text)`: stars to spaces; a web address first stands alone ("NETFLIX.COM LOS GATOS CA" -> "netflix"); else cut
  at the first word with a digit or # (store numbers, codes); `normalizePayee`'s noise words dropped; a card service's
  first word (sq, tst, sp, square, paypal) dropped; a trailing state code dropped, then a company ending (inc,
  incorporated, llc, ltd, corp, corporation, company, plc, llp: "NETFLIX INC" is Netflix); an apostrophe joins its word
  ("TRADER JOE'S" and "Trader Joes #123" are one shop: critic F3, 2026-11-15, where the card listed two Netflix spellings
  of three and Merge left NETFLIX INC behind); a first word that only says what kind
  of line it is (transfer, zelle, payroll, check, ...: `GENERIC_FIRST`) gives no key, so lines to and from people and
  accounts are never offered; under 3 letters, none.
- Two names are one shop when their keys are equal, or when a line under one comes from a bank text whose key is the
  other's and the name is the app's own for that text (the bank's text, `prettyPayee`, or Categorize's `ruleName`):
  "Kroger Dayton", the tidy form of "KROGER #0421 DAYTON OH", is Kroger. A name the person typed is joined by its own
  words only ("Weekly food shop" over a Kroger line stays theirs). Transfers (linked, filed as "transfer", or a transfer
  kind of category) are left out.
- A name that only starts like another ("Coffee" and "Coffee House Annex", "Delta Air" and "Delta Dental") is another
  shop: never suggested. The builder's choice: a suggestion should be right; Amazon's product lines ("Amazon Mktpl",
  "Amazon Prime") are therefore not offered; a rule typed on this page ("starts with amazon", shown as Amazon, no
  category) names the new ones that way.
- The name suggested (`into`): among the tidy names (small letters, no digit, #, * or @), the one with the fewest words in
  its key, then the most lines, then the shorter, then A to Z; with none, `ruleName` of the most used spelling, its
  apostrophes dropped ("SQ *BLUE BOTTLE 1234" -> "Blue Bottle", "TRADER JOE'S" -> "Trader Joes").

**What a merge does** (`mergePayees(draft, { names, into, id, today })`): every line (transfers left out) whose name is
one of the checked spellings and not already `into` gets `payee = into`; `rawPayee` keeps the bank's text; amount, date,
category, tags and account are never touched (tested field by field). Then one rule that only renames goes to the top of
the rules: `{ contains, anyOf?, match: "exact", payee: into, direction: "any", hits, createdAt }` with no category, whose
texts are `payeeWords` of each renamed spelling and of those lines' bank texts, so it fits them whatever name a later
import gives. A rename-only exact rule that already gives `into` (and has no account, direction or amount) gains the new
texts instead of a second rule. With no letters to match on, the lines are renamed and no rule is made ("Merged: 3 lines
now show as Coffee."). At the top and filing nothing, it names next month's "SQ *COFFEE 5678" "Coffee", and the rule
under it still files the line (the walk above). Undo is the kit's `ui.undoable`: it puts back exactly what the merge
changed (the rule or its texts, each line's name) and leaves anything changed since.

**Elsewhere.** Categorize keeps a merged name when it files the payee (`renamedTo(rules, tx)`, the name the first fitting
rename-only rule gives: a two-line change in `modules/transactions/categorize/view.js`), so filing never undoes a merge.
The AI categorizer does the same: a line it files shows the merged name (`renamedTo` first, on its review row and on the
line), and a rule that only renames is never its "same-text rule", so it never gives a merge's rule a category (critic F1,
2026-11-15: it did, which turned the merge into a filing rule for the exact texts only); it adds its own filing rule,
which the walk reaches under the merge.

**Not yet.** "These are two shops" to hide a wrong suggestion for good (it needs a place in the plan; today the card
simply keeps offering it, and nothing is saved without a tap); merging two shops whose names share no key.

**Tests**: shopKey cases; lookAlike (equal keys, the bank text's key, a typed name kept apart, a name that only starts like
another, transfers and people left out, the suggested name with and without a tidy one); mergePayees (only names change,
the rule at the top, next month's line named and still filed, a second merge into the same name, several spellings into a
new name, nothing to merge); Undo with `core/ui/undo.js` (exactly as before, and a later change kept); every sentence;
the page (the card, Merge saved only on the tap, its green line with Undo, Undo through a live store, Choose the name and
its refusal); Categorize keeping the merged name; the critics' cases (three Netflix spellings and Trader Joe's in one
record each; the AI categorizer keeping a merged name and leaving the merge's rule rename-only).
