# Categories  (`transactions/categories`)

**Status:** usable (phase 3)
**Purpose:** The categories transactions are filed under: rename, hide, or add your own.

## Inputs
Plan sections read (`needs`): `categories`, `transactions`. Writes: `categories`, `transactions` (uncategorised when a category is hidden or removed).
`plan.categories` holds only changes: `{ id, label?, icon?, kind?, essential?, hidden? }` for built-ins (same id) and full entries for the owner's own.

## Outputs
`compute(plan)` -> `{ categories[] (every category incl. hidden, with count and total over transactions), byKind, uncategorised, custom, total }`.
Helpers used by every transaction page: `categoriesOf(plan, { all })` (defaults with edits, hidden dropped unless `all`; spending, then income, then transfer; alphabetical), `categoryById`, `categoryLabel` ("" -> "Uncategorised"), `categoryIcon` ("" -> a question mark), `slug(label)`, `KINDS`, `defaultCategories()`.

## Defaults
The Expenses page's `CATEGORIES` (kind expense, with their must-pay flag), the Income page's `INCOME_TYPES` as `income-<id>` (kind income), and `transfer`. So the three pages always agree on names.

## Edge cases
Hiding or removing a category with transactions asks first and sets those transactions to uncategorised. A new category's id is a slug of its name, made unique with a number. Removing a built-in only hides it; it can be shown again.

## Tests
`module.test.mjs`: defaults, rename/hide/add, labels and icons for unknown ids, ordering, usage counts.

## Ideas / not yet
- Sub-categories (a `parent` id) and merging two categories into one.
- Budgets per category (phase 4 `cashflow/budget`).
