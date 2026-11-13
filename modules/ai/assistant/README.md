# Ask the plan  (`ai/assistant`)

**Status:** stub (works, minimal)
**Purpose:** a chat window over a compact summary of the plan, routed through the configured model (Ollama on the PC by default).

## Inputs
`household`, `accounts`, `goals`, `assumptions` are summarised by `compute()` into `summary`.

## Outputs
`summary` (string sent as context), `chars`.

## Formulas
None. The system prompt (`SYSTEM_PROMPT` in compute.js) forbids the model from inventing numbers
and from doing arithmetic; it is told to point at the page that computes things.

## Edge cases
When the AI helper is off, has no model, lacks the model it is set to use, or does not answer (`aiHealth()` in `modules/ai/health.js` on opening, the same check as Settings and the Dashboard tile), the page says so in one plain line worded for the service in use ("The AI helper on your PC is not answering right now. On the PC, open Ollama and leave it running, then try again."; "The AI service at ... is not answering" for another service; "turned off on the PC that runs the app" when only the PC's settings file can switch it on, with no "AI settings" button then), hides the suggestions and the question box, and offers a filled "See your plan's own answers" (overview/quick) and an outlined "Try again" (or "AI settings" when Settings can switch it on). When the helper is up and only one answer fails, the question goes back into the box with a plain error instead. The technical reason is only under "Show details"; before (2026-11-01), every suggestion tapped answered "The assistant did not answer: Failed to fetch". Long chats are not trimmed yet.

## Our guesses (C5 hand-off H4, 2026-11-13)
A balance or a goal's amount the plan filled in where a box was left empty (`isGuess` on `accounts[<id>].balance` and
`goals[<id>].target`, core/estimate) is followed by " (our guess)" in the summary, and the system prompt says what the mark
means and to say so when the figure is used. The summary sends no pay, so a pay guess has nothing to mark here.

## Tests
`module.test.mjs`: the summary mentions accounts and goals; a guessed balance and goal amount carry "(our guess)", typed ones
do not, and the system prompt explains the mark.

## Ideas / not yet
- Tool calling: let the model call a module's compute() and quote the result (structured output).
- Explain-this-page button on every page (sends that page's derived numbers as context).
- Transaction categorisation and statement extraction live in transactions/*, not here.
- Trim history to the model's context window; streaming replies.
