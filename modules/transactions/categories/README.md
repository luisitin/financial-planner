# Categories  (`transactions/categories`)

**Status:** usable (phase 3)
**Purpose:** The categories transactions are filed under: rename, hide, or add your own.

## Inputs
Plan sections read (`needs`): `categories`, `transactions`. Writes: `categories`, `transactions` (uncategorised when a category is hidden or removed).
`plan.categories` holds only changes: `{ id, label?, icon?, kind?, essential?, hidden?, parent? }` for built-ins (same id) and full entries for the owner's own. `parent` (gap list next 60 #16): the category it sits inside (see below).

## Outputs
`compute(plan)` -> `{ categories[] (every category incl. hidden, with count and total over transactions, and `inside` (the category it sits inside) when that link counts), byKind, uncategorised, custom, total }`. Each category's count and total are its own lines only: the page lists the ones inside another under it.
Helpers used by every transaction page: `categoriesOf(plan, { all })` (defaults with edits, hidden dropped unless `all`; spending, then income, then transfer; alphabetical, a category inside another right under it), `categoryById`, `categoryLabel` ("" -> "Uncategorised"), `categoryIcon` ("" -> a question mark), `slug(label)`, `KINDS`, `defaultCategories()`.
For the pages that add up by category: `parentsOf(plan)` (child id -> parent id, the links that count), `rollUp(plan)` (id -> the one it sits inside, else itself), `rollUpInto(plan, known)` (for a page with its own list), `childrenOf(plan, id)`, `parentChoices(plan, { id, kind })`, `nestRefused`, `nestWords`, `unnest(draft, id)`.

## Defaults
The Expenses page's `CATEGORIES` (kind expense, with their must-pay flag), the Income page's `INCOME_TYPES` as `income-<id>` (kind income), and `transfer`. So the three pages always agree on names.

## Edge cases
Hiding or removing a category with transactions asks first and sets those transactions to uncategorised. A new category's id is a slug of its name, made unique with a number. Removing a built-in only hides it; it can be shown again.

## Tests
`module.test.mjs`: defaults, rename/hide/add, labels and icons for unknown ids, ordering, usage counts.

## Ideas / not yet
- Merging two categories into one (gap list next 60 #16, part b).
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
