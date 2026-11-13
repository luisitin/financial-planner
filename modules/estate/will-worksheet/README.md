# Choices to take to a lawyer  (`estate/will-worksheet`)

**Status:** usable
**Purpose:** Write down, in plain words, the choices a will and its sister papers ask for (who would raise the
children, who carries out your wishes, who gets what), and print one sheet to take to a lawyer. Gap design #14.

**It gives no legal advice.** The page states no rule of law, no age and no limit: it only names the questions and
keeps the answers. The one general sentence on screen, "This is not a will. State laws differ; a lawyer makes it
valid.", is why the page exists and is never folded. What an executor and the two powers of attorney are is said in
the same words `estate/documents` already uses (its `KINDS`). The age a child gets their share is a box with a
labelled example ("For example: 25"), never a figure of ours.

## Inputs
Plan sections read (`needs`): `household` (children under 18, for the children's row), `estate`, `contacts` (a lawyer
on Who to call, by name).
Parameters accepted by `compute(plan, params)`: `today` (ISO date; ages of the children).

Where each thing is kept (one place for each):

| on the page | stored in | also shown on |
|---|---|---|
| who would raise the children (first choice) | `estate.documents`, the guardian row's `who` | Estate documents |
| pets and who takes them | `estate.wishes.pets` | If something happens to us (Final wishes) |
| everything else | `estate.worksheet` (optional; see `docs/DATA_MODEL.md`) | here only |

## Outputs
`compute()` returns `{ values, children, showChildren, rows, written, total, any, done, sheet, lawyer, today }`:
- `values`: the cleaned choices (`who`, `guardianBackup`, `childrenAge`, `executor`, `executorBackup`, `poaMoney`,
  `poaHealth`, `rest: [{ name, share }]`, `specific: [{ what, to }]`, `pets`, `notes`, `updatedAt`). A stored text
  that looks like a password or holds a run of nine or more digits reads as empty.
- `rows`: the rows drawn, `{ key, title, main, filled, says }`; `says` is the status, at most 20 characters.
- `written` of `total`: the main choices (the children when drawn, who acts for you, who gets what) with something
  written; `any`: anything at all; `done`: every main one.
- `sheet`: the printed sheet's sections `{ key, title, lines }`, every one present, "Not decided yet." where empty.
- `lawyer`: the name (or firm) of the first contact whose role is Lawyer, or "".

Also exported: `sharesCheck`, `giftsCheck`, `restWords`, `headlineOf`, `ledeOf`, `NOT_A_WILL`, `lawyerLinkWords`, `refusal`,
`saveWorksheet(draft, patch, today, newId)`.

## Formulas
One, and it is arithmetic, not law (`sharesCheck`):

1. A row with neither a name nor a share is dropped. No rows left: nothing decided yet, accepted.
2. A share with no name is refused: "Write who gets the 50% share."
3. Every share empty: each of the `n` names gets `1 / n` (equal shares).
4. Some shares empty and some not: refused, "Give every name a share, or leave every share empty to split it equally."
5. A share must be above 0 and at most 100%.
6. `| sum of shares - 1 | <= 0.0005` (`SHARE_TOLERANCE`: 33.3% + 33.3% + 33.4% is 100%; 33% three times is not).
   Otherwise refused in words: "The shares add up to 90%. They must add up to 100%: 10% is still to give." or
   "... take off 10%."

Shares are stored as fractions, like `estate.beneficiaries`. Source: the spec's own rule ("the rest's shares must add
to 100%; the form refuses otherwise, in words"); the equal split and the tolerance are the builder's.

`giftsCheck`: a special gift needs both what it is and who gets it; half a gift is held at its empty box.

No figure on this page comes from a table, a law or the AI.

## First view and parts
Simple first (`docs/OPTIONAL.md`); the page's kind is **list**.

The first view: the headline and its sentence (one written pair per case), one filled button, the rows, the line
that is never folded.

| case | headline | sentence | filled button |
|---|---|---|---|
| nothing written | "Nothing written down yet" | "Write down your choices first; a lawyer turns them into a will." | "Start with the first choice ›" (opens the first row; goes quiet while that row is open, so its Save is the one filled button) |
| some main choices open | "1 of 3 choices written down" | "Write down the rest when you are ready, or print what you have. A lawyer turns your choices into a will." | "Print my choices" |
| every main choice written | "Your choices are written down" | "Print the sheet and take it to a lawyer, who turns your choices into a will." | "Print my choices" |

Never folded: "This is not a will. State laws differ; a lawyer makes it valid." with the link to Who to call (and the
lawyer's name when one is listed there); every confirmation; every refusal.

The rows, drawn by `part()` (kind `item`) inside one card "Your choices":

| part | title | holds | status |
|---|---|---|---|
| `children` | "For the children" | who would raise them, a second choice, the age each child gets their share | "2 of 3 filled in" / "not set yet" |
| `people` | "Who acts for you" | who carries out the will, a second choice, who handles your money if you cannot, who makes medical decisions if you cannot | "3 of 4 filled in" / "not set yet" |
| `rest` | "Who gets what" | two names with their shares; two more under "More people (optional)" | "2 names" / "not set yet" |
| `gifts` | "Special gifts" | two gifts (what, to whom); two more under "More gifts (optional)" | "1 gift" / "optional" |
| `other` | "Pets and notes" | pets and who takes them; anything else for the lawyer | "1 of 2 filled in" / "optional" |

After a save the green line sits in the saved row under its Save, and the row stays open (R17); it names the new headline when it
changed ("Saved. 2 of 3 choices written down."), else "Saved.". It goes away when the next Save is refused and when a
box is typed in again, so it never stands beside a refusal. A Save on a row that was empty and still is writes nothing
and says so in the same place (`nothingWords`: "Nothing to save yet. Write a name in the first box."). When the person
opens another row, the row just saved shuts (unless they typed in it again) and the tapped row stays under the thumb;
rows opened by hand stay as they were left.

"More on this" (once something is written; an empty page keeps to its one way to start): "Are the will and the other
papers signed?" (Estate documents), "Who is named on each account and policy?" (Beneficiary audit), "What would your
family need if something happened to you?" (If something happens to us).

The printed sheet (`drawSheet`, `modules/reports/report-kit.js`; hidden on screen, shown by the printer) has the
spec's seven sections in the order a first meeting usually takes them, then the notes: who would raise the children,
who carries out our will, who gets what, special gifts, money for the children, pets, the two powers of attorney,
other notes and questions.

### Builder's choices
- **Five rows on screen, seven sections on paper.** The design lists seven rows; a list page may show at most five
  parts (`docs/OPTIONAL.md` R1, R12), and a count may not be raised. The guardian and the children's money share
  one row ("For the children"); the executor and the two powers of attorney share one ("Who acts for you"); pets
  and the notes share one. The printed sheet keeps all seven apart.
- **Pets are not stored twice.** The design put `pets` in `estate.worksheet`; Final wishes (gap #11, landed since)
  already keeps `estate.wishes.pets`. This page reads and writes that one line.
- **Two fields the design did not list**: `poaMoney` and `poaHealth`. The design's row "your two powers of attorney"
  had nothing to write in; the choice a lawyer asks for is the person named in each.
- **The children's row is hidden** only when people are listed, none is a child under 18, and nothing is written in
  it. On an empty plan it is drawn (we cannot know yet).
- **Main and optional.** The headline counts the three rows a will cannot do without (two when there are no
  children); special gifts and pets say "optional", so a person with neither can still reach "Your choices are
  written down". On screen the headline says "choices" and a row counts its boxes ("1 of 4 filled in"), so the two
  counts cannot be read as the same thing.
- **"Who acts for you" keeps its title.** The row holds three jobs (carrying out the will and the two powers of
  attorney), so it is not named after the first one; the box, its help line and the printed section all say "who
  carries out your (our) will".
- **The printed sheet leaves out both children's sections** whenever the children's row is not drawn (people are
  listed, none is under 18, nothing is written for children).
- **Leave the shares empty for equal shares** (a simple choice before an exact figure). Equal shares come back as
  empty share boxes.
- **Four names and four gifts** in the forms (`SLOTS`); a longer stored list is drawn in full and kept.
- **The first filled button on the empty page starts** instead of printing: an empty sheet has nothing to take along.
- **One household sheet**, not one per adult: the boxes are free text ("each other, then Dee"). A couple whose
  choices differ write both in the box or in the notes.
- **A password or a full number is refused at its box** (`refusal`, the same check as Final wishes:
  `heldOut` in `modules/reports/if-something-happens/compute.js`).
- **Legacy goals links here** with one more outlined button in its existing "More on this" row. That page does not
  use `core/ui/more.js` yet; importing `links()` there would be its whole simple-first conversion, which is not this
  design's.

## Edge cases
- No `estate` section, no `estate.worksheet`: everything reads as empty; nothing is written until a Save.
- A row emptied and saved: its fields are cleared; a worksheet with nothing left is removed from the plan.
- The guardian's name emptied here: the documents row keeps its status and notes, `who` becomes "".
- Children with no birth date count as under 18 (as on Estate documents).
- Something that is not a list where `estate.documents`, `contacts` or `household.people` should be (a damaged file):
  read as empty; a guardian saved here then starts a fresh documents list.
- A stored share list that no longer adds up (edited by hand): printed as stored; the form refuses it at the next Save.

## Tests
`module.test.mjs`: the shares check and every sentence it refuses with (the spec's test 1); "who gets what" in words,
one case each; the guardian read from and saved to Estate documents (test 2); pets shared with Final wishes, and
no other wish read; when the
children's row is drawn; the statuses; the headline and its sentence per case; the never-folded line's two cases; the
password and long-number refusal; `saveWorksheet`; a damaged plan read as empty; the empty state on the page (test 4: the words, one filled button,
five shut rows, at most 100 words, Start opens the first row and saves nothing); the full page; S11 (a save goes
through `store.update`, the green line names the new answer, the saved row stays open, no other opens); the shares
form refusing in words; half a gift; a Save on an empty row writing nothing and saying so; the green line going at a
refusal or a keystroke; the saved row shutting when another is opened; the printed sheet holding every section (test 3); and the invariance rule: with
`estate.worksheet` absent or present, every other page that reads the estate gives byte-identical output over the
fixture plans and `qa/households`.

## Ideas / not yet
- One sheet per adult when a couple's choices differ.
- A row for who would look after money left to a child (a trustee), once a lawyer-reviewed wording exists.
- The packet (If something happens to us) could say that this sheet exists and where the signed will is.
