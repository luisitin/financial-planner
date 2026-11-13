# <Title>  (`<group>/<id>`)

**Status:** planned | stub | usable | complete
**Purpose:** one sentence.

## Inputs
Plan sections read (`needs`): ...
Parameters accepted by `compute(plan, params)`: ...

## Outputs
Shape of the object `compute()` returns, field by field.

## Formulas
Write every formula here in words and symbols, with its source (book, IRS pub, paper,
or the open-source project it was lifted from and its licence).

## First view and parts
Simple first (`docs/OPTIONAL.md`). Say what the first view holds: the answer and its sentence
for each case, the one filled action, what is never folded (alarms, guess marks, a hint worth
money). Then each part, drawn by `core/ui/more.js` (`parts()` after the answer, `links()` at
the foot): its `id`, its kind and title, what it holds and its status, e.g.

| part | kind and title | holds | status |
|---|---|---|---|
| `how` | how, "How this is worked out" | the sum, step by step, with its sources | "1 step" |

"More on this": each row the question it answers, e.g. "What do I own and owe?" (Net worth).
Builder's choices: anything the rules left open, and why.

## Edge cases
Empty plan, zero rates, negative balances, missing dates, ...

## Tests
What `module.test.mjs` covers: one test per case of the headline's sentence; what is read
"outside the parts" and "inside part X".

## Ideas / not yet
Bullet list of what a future editor could add.
