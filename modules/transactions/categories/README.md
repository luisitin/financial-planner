# Categories  (`transactions/categories`)

**Status:** usable (phase 3)
**Purpose:** The categories transactions are filed under: rename, hide, or add your own.

## Inputs
Plan sections read (`needs`): `categories`, `transactions`. Writes: `categories`, `transactions` (uncategorised when a category is hidden or removed).
`plan.categories` holds only changes: `{ id, label?, icon?, kind?, essential?, hidden?, parent? }` for built-ins (same id) and full entries for the owner's own. `parent` (gap list next 60 #16): the category it sits inside (see below).

## Outputs
`compute(plan)` -> `{ categories[] (every category incl. hidden, with count and total over transactions, and `inside` (the category it sits inside) when that link counts), byKind, uncategorised, custom, total }`. Each category's count and total are its own lines only: the page lists the ones inside another under it.
Helpers used by every transaction page: `categoriesOf(plan, { all })` (defaults with edits, hidden dropped unless `all`; spending, then income, then transfer; alphabetical, a category inside another right under it), `categoryById`, `categoryLabel` ("" -> "Uncategorised"), `categoryIcon` ("" -> a question mark), `slug(label)`, `KINDS`, `defaultCategories()`.
Combining two (gap list next 60 #16): `mergeRefused(plan, from, to)`, `mergeCategories(draft, { from, to })`, `mergeCount`, `mergeWords`, `KEEPS_ITS_JOB`, `MERGE_LEAD`.
For the pages that add up by category: `parentsOf(plan)` (child id -> parent id, the links that count), `rollUp(plan)` (id -> the one it sits inside, else itself), `rollUpInto(plan, known)` (for a page with its own list), `childrenOf(plan, id)`, `parentChoices(plan, { id, kind })`, `nestRefused`, `nestWords`, `readAs`/`READ_AS`, `holdsOthersWords`, `unnest(draft, id)`.

## Defaults
The Expenses page's `CATEGORIES` (kind expense, with their must-pay flag), the Income page's `INCOME_TYPES` as `income-<id>` (kind income), and `transfer`. So the three pages always agree on names.

## Edge cases
Hiding or removing a category with transactions asks first and sets those transactions to uncategorised. A new category's id is a slug of its name, made unique with a number. Removing a built-in only hides it; it can be shown again.

## Tests
`module.test.mjs`: defaults, rename/hide/add, labels and icons for unknown ids, ordering, usage counts.

## Ideas / not yet
- Subscriptions could count a category inside Subscriptions as one (it reads the id "subscriptions" as a signal, not a sum).
- The selects on Transactions, Categorize and Rules could say "Groceries (in Food)"; today they list a category inside
  another right under it, by its own name.

## Split purchases (gap #24, 2026-11-14)
A purchase split across categories on the Ledger counts in each of its parts' categories, for that part's amount
(`../splits.js` `linesOf`); the totals still add up to the transactions. Removing or hiding a category that a split
purchase uses takes the split off: the whole purchase becomes uncategorized, like any other line in it (ledger
`dropCategory`). The question before it says so ("One of them is a purchase split across categories: it will stop being
split and wait for a category again, whole.") and so does the green line after.

## One category inside another (gap list next 60 #16, 2026-11-16)
**What the person sees.** Nothing new on the first view but the list's order and one grey line: each group shows its first
six categories, the rest one quiet tap away ("13 more categories", opt spec 6.1's conversion of this page, done here), and
a category inside another sits right under it, set in by 28 px, with "Inside Food" (then its use: "Inside Food · 12
transactions, $340"). Tapping a category opens its form as before; its last box, under "More details (optional)", is
**"Inside another category"** (help: "Pages that add up your money by category count it inside that one."): "No, it stands
on its own" or a category of the kind picked in the form that stands on its own (picking another kind lists that kind's,
so a new income category can go inside an income one; a pick that no longer fits goes back to "No, it stands on its
own"). A category that has others inside it has no such box (one level only) and says why under the form: "Eating out
can't go inside another category while Fun and hobbies and Groceries are inside it." A change is asked first ("Put
Groceries inside Food? Pages that add up your money by category will count it in Food; every total stays the same." /
"Take Groceries out of Food? It will count on its own again." / "Move Groceries from Food into Home?") and saved with Undo
("Groceries is now inside Food." / "Undone: Groceries stands on its own again."). Inside a category a page reads by its id
(`READ_AS`, `readAs`), one total does move, so the question says what instead of "every total stays the same": for one of
yours inside Taxes not withheld "..., and the spending guesses will leave it out of your spending, as they do taxes you
pay yourself."; inside Loan and card payments "... will read it as paying off a loan or card, not as spending."; inside
Rent or mortgage "... will read a payment in it that looks like your mortgage as that payment, not as spending."; an
income one inside Dividends and interest (or one whose name says dividend) "..., and the Dividends page will count it as
money your investments paid." (a move: "Move Mine from Groceries into Loan and card payments? Then the spending guesses
..."). One of Expenses' own kinds stays itself on the spending guesses wherever it sits, so it gets the usual question. A
new category inside another needs no question ("Coffee added, inside Eating out."). A refusal is said at the box: "A
category can't be inside itself."; "Cottage is not on your list: pick another, or none."; "Food is spending and this one
is income: pick one of the same kind, or none."; "Groceries is itself inside Food: pick one that stands on its own.";
"Food has categories inside it, so it stays on its own." Hiding or removing a category that holds others asks with "Hide
Eating out? Fun and hobbies and Groceries, which are inside it, will stand on their own. Continue?" and says after "...
stand on their own now."; so does changing its kind (green line only). With lines in it the question says how many, in
the singular for one ("1 transaction uses Groceries. It will become uncategorized.").

**Data.** `categories[].parent?` (optional, no version bump; docs/DATA_MODEL.md). A link counts when the parent is on the
list (known, not hidden), is another category, is of the same kind and does not itself sit inside another (one level; of a
chain a <- b <- c, b is inside a and c stands on its own). Any other `parent` is read as none, so a plan edited by hand
never breaks a page. The links are removed when the parent is hidden or removed, or changes kind.

**Formulas** (the builder's rule; no outside figure is used, so there is nothing to source or date):
- roll up: a line counts under `key(line) = parent(line.category)` when that link counts, else `line.category`. A total by
  category is then Σ over the lines with that key; the grand total Σ over all keys = Σ over all lines, unchanged, because
  every line has exactly one key.
- Budget: `key = own category when it has an envelope, else rollUp(category)` (cashflow/budget `envelopeKey`): an envelope
  on Food holds Groceries' lines unless Groceries has an envelope of its own. Every line still counts once.
- A page with a list of its own (Expenses' kinds: Income statement's bank against the plan, the spending guesses):
  `own if the list knows it, else the parent if the list knows that, else own` (`rollUpInto`).

**Every reader of a line's category** (grep of `.category` over modules/ and core/, 2026-11-16):
- adds up by category, now counts a category inside its parent: Where the money goes (month, twelve months, watched
  category; the parent row says what each inside came to), and through it Monthly review and the Annual review; Budget
  (envelopes, money with no envelope, suggestions, Safe to spend); Income statement (by category; the bank against the
  plan by Expenses' kinds); the spending guesses' bank rows; Dividends (a category inside a dividend category); the
  Transactions filter (a parent shows the lines inside it).
- shows each category itself or files lines, unchanged: this page (each row its own count), Categorize, the AI
  categorizer, Rules, Import and its file formats, Statements, Transfers, Duplicates, Bills and regular payments,
  Subscriptions, Forecast, Small business and Rental analysis (a line's own category's name decides the tax line), the
  export (one row per line with its own category).
- Expenses and every page reading its `byCategory` keep Expenses' own list (an Expenses row is never filed under a
  category of the person's own: Bills maps one to "other"), so nothing changes there.
- Not changed here, another builder's lane: Cash flow statement (`cashflow/statement` compute, its bank months) reads
  `t.category === "debt"` by id, so a category of yours inside Loan and card payments counts in its operating lines, not
  its debt line (its totals are the same). Its owner can read the line through `rollUpInto(plan, (id) => !!CATEGORIES[id])`
  as the spending guesses do; said to the lead in the fix log (critic M6, 2026-11-16).

**Checks.** `module.test.mjs`: the links (each case of one that does not count), the order, the choices, `rollUpInto`;
every sentence above; Where the money goes (month, twelve months, watch, `subs`), Budget (own envelope, the parent's,
none, Safe to spend), Income statement (rows, by category, bank against the plan), the spending guesses, Dividends and the
Transactions filter, each against the same plan with nothing inside another; the grand totals of 33 invented households
with eleven links each (Where the money goes per month and its rows, Budget's spent with and without envelopes, Income
statement per month and by category, Transactions); invariance: with no category inside another, every reader above gives
byte for byte what it gave at ce79d70, for the 33 households with bank lines, splits, tags, own categories, envelopes,
moves and a watch (digests in `invariance.json`, written from ce79d70's code before any reader changed); on the page:
six then "N more categories", the order and "Inside Food", the box under More details, the question, the green line and
Undo on a store that keeps what was saved, a no, a refusal, a new one inside, no box for a parent (and the line saying
why), hiding a parent, a change of kind, S11; the critics' findings of 2026-11-16: every built-in a category of yours could
sit inside on the family's bank lines, where a total read by id moves (the spending guesses, the bank against the plan,
Dividends) the question must say so (M4); the box follows the kind picked and a new income category goes inside an income
one (M5); "Hide Eating out?" first (P3); a row inside another set in (P4); why a parent has no box (P5).

## Combine two categories (gap list next 60 #16, 2026-11-16)
**What the person sees.** One quiet row at the foot of the page, **"Combine two categories"** (an `own` part; its title is
pinned in qa/first-view-lib.mjs `PINNED_TITLES`: two picks and a Save, no figure to type, so "Set my own numbers" would be
untrue). It is offered once something is filed under a category (a bank line, a rule, an envelope, a bill on Expenses or a
category of the person's own); on an empty plan combining would only hide one, so the page stays as short as it was.
Inside: "Everything filed under the first one moves to the second: its transactions, sorting rules, budget and bills. Undo
puts it all back.", two picks ("Move everything from", "Into"; every spending and income category on the list, never the
transfer kind; once the first is picked, "Into" lists only the others of its kind, and a pick there of the other kind goes
back to "Pick one..."), and under them, right above the button, as the picks change and before any save, the count or the
reason it can't be done (nothing while a pick is missing). "Combine them" (the part's own Save) asks first and saves once,
with the green line and Undo in the part, which stays open (R17); after Undo the part says so. While a category's form is
open above, "Combine them" is outlined, so the screen has one filled button (the form's).

**Sentences** (`mergeWords`, `mergeRefused`; one test per case):
- count: "4 transactions, 1 sorting rule, 1 budget and 1 category inside it move from Coffee into Eating out." (one thing:
  "1 transaction moves ..."; bills: "1 bill"); nothing filed: "Nothing is filed under Travel yet; it just leaves your list."
- bills that stay: "The bill filed under Eating out on your Expenses page stays there: that page keeps its own list." (or
  "The 2 bills ... stay")
- the two budgets carry what is left differently (one has "rollover" and the other not): the joined budget keeps the kept
  one's way, and the line and the question say so: "The budget for Coffee carries what is left into the next month and
  the one for Eating out does not, so the joined budget will not." / "The budget for Coffee carries what is left into the
  next month, so the joined budget will carry what is left of both." (critic M2: a $100 Cafes budget that carried $23.81
  into October, combined into a $60 Coffee one that does not carry, lost the $23.81 without a word. It is still not
  carried, the kept budget's way, but it is said before the save; carrying both instead would add what Coffee had left,
  money the person never chose to carry.)
- question: "Move ... from Coffee into Eating out? Coffee is then removed." (a built-in: "is then hidden"), then the two
  sentences above when they apply; nothing filed: "Combine Travel into Fun and hobbies? Nothing is filed under Travel yet.
  Travel is then hidden."
- green: "Done: ... moved from Coffee into Eating out." / "Done: Travel is hidden."; Undo: "Undone: Coffee is back with
  everything that was filed under it." / "Undone: Travel is back."
- refusals: "Pick the category to move from and the one to move into."; "Pick two different categories."; "Coffee is not on
  your list any more."; "Coffee is spending and Pay from a job is income: pick two of the same kind."; "Coffee can't move
  into Beans: Beans is inside Coffee. Move Beans into Coffee instead, or take it out of Coffee first."; "Coffee has
  categories inside it, and Fun and hobbies is inside Shopping and clothes: pick one that stands on its own."; and nine
  built-ins the plan finds things with, which can be kept but never moved into another: "Transfer between my accounts
  can't be moved into another category: it is how the plan tells money you moved apart from money you spent. Move the
  other one into it instead." (Loan and card payments: "the plan matches those payments to your debts with it"; Rent or
  mortgage: "the plan finds your mortgage payment with it"; Taxes not withheld: "the plan keeps taxes you pay yourself
  apart from your bills with it"; Childcare and school: "the plan leaves it out of your spending in retirement with it";
  Subscriptions: "the Subscriptions page finds your subscriptions with it"; Pay from a job: "the plan finds your paychecks
  with it"; Dividends and interest: "the Dividends page finds what your investments paid with it"; Rent you collect: "the
  Rental analysis page finds the rent you collect with it").

**What moves** (`mergeCategories`, one `store.update`; `ui.undoable` diffs the plan and puts back exactly what it changed,
leaving a line changed again since as it is):
- every transaction filed under it, and every part of a split purchase; a split whose parts then all sit in one category
  is one line again (same amount; Undo brings the split back). A split whose parts do not add up to the purchase is not
  used anywhere (`splitsOf`: the purchase counts whole under its own category): its parts follow too, as typed, but its
  own category stays as it is unless it is the one moved, and it is not counted as moving (critic M1: a -$50 Groceries
  purchase with two -$20 Cafes parts became Coffee, October's Groceries $110.81 -> $60.81);
- every rule that files under it;
- its budget envelope: renamed, or, when the kept one has an envelope, its amount added to that one (the kept envelope's
  other settings stay, its rollover too, said as above); the same in each kept budget (`budgetHistory`), and a move
  between envelopes names the kept one (a move from one envelope to itself is dropped);
- its bills on Expenses, only when Expenses' own list has both (a built-in into a built-in). Expenses files a bill only
  under its own list (Bills maps any other to "other"), and Get started, the retirement plan and the debt matching read
  those kinds by name: so a built-in moved into one of the person's own keeps its bills where they are, and says so;
- the categories inside it now sit inside the kept one; a watched category becomes the kept one (once); a bank file's
  remembered choice (`importProfiles[*].categories`) names the kept one;
- the one moved is removed (the person's own) or hidden (a built-in: it can be shown again under Hidden).

**Why nine built-ins are never moved.** Each is read by its id for a job: `transfer` is the kind every page leaves out of
spending; `debt` lets Expenses match a bill to its debt on Debts (moved away, the payment would be counted twice);
`housing` finds the mortgage payment (the same); `taxes` keeps taxes paid by hand apart (Forecast's quarterly payments,
Sharing costs); `childcare` is left out of the spending carried into retirement. The bank lines' other readers by id
(critic M3, grep of `category === "..."` over modules/, 2026-11-16): `subscriptions` (Subscriptions finds a recurring
charge filed there even when its name says nothing), `income-salary` (Forecast's paychecks, the Transactions page's
"a paycheck"), `income-investment` (Dividends: moved into Other income, $41.50 received became nothing) and
`income-rental` (Rental analysis' rent from the bank, property/rental/books.js). Moving another category into any of them
is fine. The other built-ins carry their meaning by their name in the guesses' rows only, which roll up the same way. Not
refused, and noted: Expenses' bills are also read by id on a few pages (Vehicle goal: `transport`; the retirement plan's
health premium: `health`; the home's insurance guess: `insurance`; the federal child care credit leaves `pets` out), which
matters only when one built-in is combined into another built-in, where the bills move with the person's say-so.

**No outside figure** is used (no rate, cost or limit), so there is nothing to source or date.

**Checks.** `module.test.mjs`: the move (transactions, split parts and the split made whole, rules, joined and renamed
envelopes, kept budgets, moves, bills moved and kept, the ones inside, the watch, a bank file's choices, removed or
hidden) and that the count is the move on a copy; Undo exactly back for four combines, and a line changed since left as
it is; Where the money goes and Budget after a combine (the kept one is the two together, every total the same); every
sentence above; on the page: the part shut and offered only once something is filed, two picks and no number box, the
count and a refusal as the picks change, a refusal and a no saving nothing, one save, the part open alone after it with
its green line (S11), Undo on a store that keeps what was saved putting the plan back exactly, and saying so in the part.
The critics' findings of 2026-11-16: a split that does not add up keeps its category (M1); the joined budget's rollover and
its sentence, with Budget's available off by exactly what was carried (M2); every built-in combined into the catch-all of
its kind either refused for its job or leaving Dividends and Subscriptions exactly as they were (M3); "Into" follows the
first pick (P1); "Combine them" outlined while a form is open (P6); and, found on a phone while checking those, view.js
calls no array method on a `querySelectorAll` answer (a NodeList in a browser; the fake DOM gives an array, so the page
tests could not see "This page could not open").
