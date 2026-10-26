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
No provider configured: the send fails with the reason. Long chats are not trimmed yet.

## Tests
`module.test.mjs`: the summary mentions accounts and goals.

## Ideas / not yet
- Tool calling: let the model call a module's compute() and quote the result (structured output).
- Explain-this-page button on every page (sends that page's derived numbers as context).
- Transaction categorisation and statement extraction live in transactions/*, not here.
- Trim history to the model's context window; streaming replies.
