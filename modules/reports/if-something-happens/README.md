# If something happens to us  (`reports/if-something-happens`)

**Status:** usable (phase 10; gap design #11, built by claude-b on 2026-11-13)
**Purpose:** One packet your family can use if something happens to you: who to call, where the papers are, the
accounts and who gets them, online accounts, bills that pay themselves, final wishes and the first steps.

It gathers what other pages already keep into one printable packet (a letter of instruction, in effect). Only Final
wishes is typed here. Never in it: passwords, recovery phrases, full account numbers or Social Security numbers.

## Inputs
Plan sections read (`needs`), each through its own page's compute, and only the fields named here (a whitelist):
- `contacts` (household/contacts): name, firm, role, phone, email, notes, and the accounts and policies each one
  handles with `last4` (exactly four digits, `lastFour`; anything else is never shown, not even cut down).
- `papers` and `estate.documents` (household/documents, which also reads the signed estate papers' places): each
  paper's label, whose, where, copy, who else knows.
- `accounts` (name, type, institution, owner), `debts` (minPayment + extra, for a debt's payment),
  `insurance.policies` (name, kind, insurer, benefit, whose, through work), `estate.beneficiaries` (through
  estate/beneficiaries: who is named, and the backups). No balances.
- `estate.digital` (estate/digital): name, kind, how someone could get in, who, notes. Never a password.
- `transactions` and `recurringIgnored` (cashflow/recurring): the payments out it finds coming back.
- `household.people` (names, for "whose").
Writes (`writes`): `estate` (only `estate.wishes`).

`estate.wishes?: { funeral, written, pets, tell, letterWhere, updatedAt }` (text; optional; no version bump). All five
boxes empty removes it (`saveWishes`). Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD).

## Outputs
`compute(plan, { today })` -> `{ parts: [{ key, title, filled, count, says, note, rows: [{ title, value, lines }],
missing: [text], go: [{ href, label }] }] (the seven sections), groups: [{ key, title, sections, filled, says }] (the five
parts the page and the sheet show), filled, total (5), empty, wishes, wishesSet, secrets: [{ part, what, why }], today }`
(`why`: "secret" or "number"; `part` names the section). Also exported: `saveWishes`, `headlineOf`, `ledeOf`, `leftOutOf`
(the amber lines), `longNumber`, `heldOut`, `PARTS`, `GROUPS`, `INTROS`, `WISHES`, `STEPS`, `SSA_PHONE`, `SSA_LUMP_SUM`,
`COPIES`.

## Formulas and rules
Counts only; nothing here is money math (a debt's payment and a bill's amount are shown as their pages keep them).
- **Seven sections, five parts** (`GROUPS`, integ2-fix3, 2026-11-13): the design's seven sections are shown and printed as
  five parts, since a phone's first view opens at most five rows (docs/OPTIONAL.md R1, a report's budget; a new page meets
  its budget): "Who to call, and the first steps" (the first steps sit with the people to call: step 2 is a call to Social
  Security, step 4 names the executor from Contacts), "Where the papers are", "Accounts, policies and bills" (the bills that
  pay themselves are paid from those accounts, and the accounts part already shows a debt's payment so the family keeps it
  paid), "Online accounts", "Final wishes". Each section keeps its own title as a heading inside its part and on the sheet.
- **A section filled in**: a list with at least one row (Who to call, Accounts and policies, Online accounts, Bills that
  pay themselves; Where the papers are once one place is written), or wishes with any text. First steps is always
  written (a fixed list of six). **A part filled in**: one of its sections the person fills in is (First steps alone
  fills none, so the count no longer starts at one). `filled` of `total` (5) is the headline. A part's status is its first
  filled section's ("6 have no one named", "1 bill"), else "no one listed yet" (who to call) or "none yet" (accounts and
  bills): two never fit in 20 characters.
- **Statuses** (at most 20 characters, opt R25): "3 people", "12 of 18 found" (placed of the papers that count, as
  household/documents counts them), "6 have no one named" (the accounts and policies that take a beneficiary but have no one
  named; "1 has no one named"; "10, all named" when each has one), "1 has no way in" (the online accounts with no way
  in; "2 accounts" when each has one; plain words, not "10 · 6", critic F1 of 2026-11-13), the bills found ("1 bill",
  "3 bills"; "none found yet"), "2 of 5 written" (the boxes the packet prints: a box left out as a secret or a long
  number is not counted; "not set yet"), "6 steps". Never a bare number.
- **A secret or a long number is never printed** (critic F1, 2026-11-13). Every text the packet prints that a person
  typed goes through one check: a contact's name, firm, phone, email and notes; an account's or policy's name and firm;
  who is named on it; whose it is; each paper's name, place, copy and who knows; an online account's name, who and
  notes; a bill's payee; the will's and the letter's places; each wish. Left out (`heldOut`):
  - a password or a recovery phrase (`looksSecret` from estate/digital), why "secret";
  - a long number (`longNumber`), why "number": nine digits or more in a run, together or joined by single spaces or
    dashes. Nine is a Social Security number's length and card numbers are longer (13 to 19); the repo's leak guard
    refuses the same runs (Builder chose the rule, not a figure from a source). Not a long number: a phone number
    written the usual way (3, 3 and 4 digits with a space or a dash, a leading 1 allowed), a ZIP+4 code (5-4), a date
    written with dashes (2026-03-02, 03-02-2026, even with a figure after it), money with commas; in a phone box, ten
    digits typed together or a number written from abroad (+).
  What is left out is named once in `secrets`; the page says so in an amber line per kind, one written sentence each
  (`leftOutOf`, never folded): "Left out of the packet because they look like a password or a recovery phrase: ... Write
  where a secret is kept, never the secret itself." and "Left out of the packet because they hold a long number, like a
  full account or Social Security number: ... Write only the last four digits of a number." The row keeps what it can:
  an account by its kind ("Checking") wherever it is named, "A payment", "Goes to: someone named on the form", "Kept:
  left out of this packet", "Where the will is kept is left out of this packet." The wishes form refuses either at its
  box ("This holds a long number, like a full account or Social Security number. Write only the last four digits.").
  Checked on the 1,400 qa household plans: nothing is left out of any of them.
- **Bills that pay themselves** = cashflow/recurring's `detected` with a negative amount (payments out found in the bank
  files; transfers left out there). "About $X a month in all" sums their `monthly`. Bills typed on Expenses are not
  listed: they do not pay themselves (Builder chose).
- **The letter's place** falls back on Estate documents' letter of instruction when it is signed with a place and the
  wishes box is empty. Step 4 names the will's place (Estate documents, a signed will with a place) and the executor
  (Contacts, role executor, with the phone) when the plan knows them.

### First steps for your family (fixed words; sources read 2026-11-13)
1. "Ask the funeral home for 10 to 12 certified copies of the death certificate." Consumer Financial Protection Bureau,
   *Taking control of your finances: help for surviving spouses* (5/2022),
   https://files.consumerfinance.gov/f/documents/cfpb_surviving-spouse_booklet.pdf ("Request 10-12 certified copies of the
   death certificate from the funeral home").
2. "Tell Social Security. The funeral home usually does; call (SSA_PHONE) to check. Ask about survivor benefits and the
   one-time $255 payment." USA.gov, *Agencies to notify when someone dies* (https://www.usa.gov/report-a-death, updated
   2026-08-31: "The funeral director should report the death to the Social Security Administration (SSA) for you");
   the national number is in the CFPB booklet above and on ssa.gov's survivor pages (ssa.gov refused a direct read on
   2026-11-13; its pages were read through the search index the same day). The $255 lump-sum death payment, to a
   surviving spouse living in the household, else a spouse or child entitled on the record: SSA POMS RS 00210.001
   "Requirements for the Lump-Sum Death Payment (LSDP)" (effective 2023-09-15; POMS online at secure.ssa.gov, read by its
   section number): "may receive a one-time lump-sum death payment (LSDP) of $255.00".
3. "Ask one credit bureau (Equifax, Experian or TransUnion) to mark the credit report as deceased; it tells the other
   two." Equifax, *After a relative's death, do I need to contact each nationwide credit bureau?*
   (https://www.equifax.com/personal/help/article-list/-/h/a/relative-death-contact-credit-bureaus/: when one bureau
   adds a deceased notice "it will notify the other two"); Experian, *How to report a relative's death to credit
   bureaus* (2026-10-19, https://www.experian.com/blogs/ask-experian/reporting-death-of-relative/: "Once you notify one
   credit bureau of a loved one's death, it'll notify the other two").
4. to 6. Find the will and the executor; tell the employer, the insurers and the banks; keep paying the bills that
   matter: USA.gov, *Agencies to notify when someone dies* (above): "Report the person's death to banks, credit card
   companies, credit bureaus, and other financial organizations."

`SSA_PHONE` is Social Security's public national number; its line in compute.js carries the leak guard's
`leak-guard: ok` mark (it is shaped like a phone number, and it is not a person's).

## First view and parts
Report kind (opt section 2.2). Simple first (`docs/OPTIONAL.md`):
- **Empty plan** (no part filled in): "One packet your family can use if something happens to you."
  + "Start with who to call: the people your family would phone first." + one filled link "Start with who to call ›"
  (Contacts). The five rows show what the packet will hold. No "More on this" (one way to start).
- **Otherwise**: "Ready to print: 3 of 5 parts filled in" (or "Ready to print: all 5 parts filled in"), one sentence
  per case, and the one filled button "Print the packet". An amber line when something was left out as a secret.
- **The five rows** (`part()`, kind `item`, one card "What the packet holds"), each a count and what is missing; a part of
  two sections names each inside (a small heading):

| part | title | sections, and what they hold when opened |
|---|---|---|
| `contacts` | Who to call, and the first steps | Who to call: each contact: role, phone, email, what they handle (ending 1234), notes; "No one is listed to call in an emergency." First steps for your family: the six steps; step 4 with the will's place and the executor |
| `papers` | Where the papers are | each paper with a place: kept, copy, who knows; the ones not written down yet |
| `accounts` | Accounts, policies and bills | Accounts and policies: each account and policy: firm, ending 1234, whose, a debt's payment, who is named. Bills that pay themselves: each: amount and how often, from which account, next date; the month's total |
| `online` | Online accounts | each: how someone could get in and who; the key ones with no plan |
| `wishes` | Final wishes | the five boxes and Save (the green line names the new count) |

Each list row ends with an outlined link to the page where it is kept. "More on this": "Are the will and the other
papers signed?" (Estate documents), "Would your family have enough to live on?" (Life insurance needs).
- **The printed sheet** (report-kit.js) holds every part, drawn hidden on screen and shown only by the printer (a
  scoped `@media print` rule); the kit's own print button is removed so the hero's is the one filled button.

**Builder chose:**
1. Five `item` rows in one card, from the design's seven sections: a report opens at most five rows (docs/OPTIONAL.md R1),
   and a new page meets its budget, with no entry in the counts file (integ2 check of round 1, finding 2; it was born with
   seven rows and an entry). The two pairs merged are the ones a family reads together (the first steps and who to call;
   the accounts and the bills paid from them); the printed sheet follows the same five parts.
2. Final wishes is an `item` row with its own form, not an `own` part: with a single `own` part the title would have to
   be "Set my own numbers", which does not fit text boxes.
3. "10 to 12" certified copies (the CFPB's figure) instead of the design's "several".
4. Bills come only from the bank files; with none, the row says how to bring one in (Import).
5. The green line sits inside Final wishes, above its form (the part just saved stays open), not at the top of the page.

## Edge cases
- No people, accounts, contacts or bank files: every list row says what to add and where.
- A full number typed as the last four (8 digits): nothing shown, never cut down.
- A secret or a long number in any typed text: left out of the packet and named; the wishes form refuses it at its box.
- A phone number, a ZIP+4 code or "ending 1234": kept.
- All five wishes emptied and saved: `estate.wishes` is removed; "Cleared your final wishes."

## Tests
`module.test.mjs` (17): the empty plan's sentence and its one way to start (and at most 100 words); the counts per
part and the line for each case (some, all, wishes only); the first steps and step 4's details; the whitelist (every
password, number, recovery phrase and Social Security field planted in the plan stays out of compute and of the drawn
page and sheet; notes that look like a password left out with the amber line outside any fold); "ending 1234" and a
full number refused; the five parts (every section in one part, once; each status; the first steps alone fill none); the
cover and the five shut rows, one filled button, a two-section part's headings inside, every row worth a tap (two
figures, three rows or forty words) in five households; S11: final wishes saved through `store.update`, the green line
naming the new count, the part staying open and no other opening, a secret held, all empty clearing; `saveWishes`; the
printed sheet's five parts and seven section headings, hidden on screen, with the letter's fallback; no nine-digit run or Social Security shape in any packet
of the qa households; invariance: with `estate.wishes` absent or present, every other page that reads `estate` gives
byte-identical output (the four fixture plans and the 14 household types; Diagnostics' file size left out). Critic F1
and F2 (2026-11-13): a Social Security, card and account number typed into every kind of box (contact notes and firm,
account name and firm, a paper's place, a beneficiary, who can get in, a bill's payee, the will's place, a wish) stays out
of the packet, the first view and the printed sheet, each named once as a number; a phone number, a ZIP+4 code and
"ending 1234" stay in; the amber line per kind, one sentence each (one, many, both kinds); the wishes form refuses a long
number at its box and takes a phone number; "1 of 5 written" counts only the boxes the packet prints; `longNumber`
case by case (a Social Security number with dashes, spaces or none, a card in three spellings, an account number; not a
phone, a ZIP+4 code, money, "ending 1234", a dash date with a figure after it; the phone box).

## Ideas / not yet
- A second copy for a named person (the executor), with only the parts they need.
- Guardianship wishes for the children, read from Estate documents' guardian.
- Pets' papers and vet as their own rows when the plan knows about pets.
