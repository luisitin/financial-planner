# Statement reader  (`transactions/statements`)

**Status:** usable (phase 3)
**Purpose:** No CSV? Give the plan the statement itself (PDF, PNG, JPG, WEBP); the PC reads the transaction rows for you to check, then they go through the same rules and duplicate check as a CSV import.

## Inputs
Plan sections read (`needs`): `accounts`, `transactions`, `rules`, `imports`. Writes: `transactions`, `imports` (with `method`), `rules` (hit counts).
Server: `POST /api/statement/read` `{ fileName, mime, dataBase64, kind: "card"|"bank", mode: "auto"|"text"|"ai" }` -> `{ method, model, pages, rows, period, closingBalance, warnings, textRows, dropped }` (`server/statements.mjs`). Size cap `statements.maxMb` (25). The file is held in memory for the request only and never written to disk.

## How it reads (cheapest first)
1. **PDF text layer** (`pdfjs-dist`, legacy build, lines rebuilt from glyph positions) -> `parseStatementText()`: no model at all. Used when it finds at least 3 rows.
2. **Text + model**: the PDF has text but the line reader could not follow the layout -> each page's text goes to the text model with `buildTextPrompt()` (JSON answer, temperature 0, `format: json` on Ollama).
3. **Vision**: pictures, and scanned PDFs rendered page by page at 2x with `@napi-rs/canvas` -> a model that can see images with `buildVisionPrompt()`. The model is `ai.visionModel`, else the first Ollama model whose `/api/show` lists the `vision` capability (for example qwen3.5:9b or gemma4:12b), else the page says which command pulls one. With `ai.provider=openai` the configured model must accept `image_url` content.
Answers are checked by `parseModelRows()`: rows with a bad date or amount are dropped and counted; years missing from dates are filled from the statement period.

## The line reader (`parseStatementText`)
- Period from "Statement Period a - b", "Closing Date", or "Month YYYY"; closing balance from "New/Ending/Closing balance".
- A row is `DATE [DATE] DESCRIPTION AMOUNT [BALANCE]`; an amount that wrapped to the next line is joined; a wrapped description line is appended (two at most).
- Sign: card statements treat plain amounts as charges unless the wording says payment/refund/credit; a printed minus on a card is a credit. Bank statements take the sign from the section heading (Deposits / Withdrawals / Checks); sections like "Daily ledger balances" are skipped. Lines whose description has no letters are balances, except a check number under "Checks".
- Confidence: rises with the number of rows, lower when no period was found.

## Edge cases
No accounts: asks for one. AI off: text PDFs still work; scans and pictures explain what to turn on. More than 12 pages: only the first 12 are read (warning). A picture that yields nothing: advice to retake it. Everything already on file: "nothing to do". Undo removes the whole statement's rows by `importId`.

## Tests
`module.test.mjs` with `qa/fixtures/statement-card.txt` and `statement-checking.txt` (fake statements): period/balance/year rollover, card and checking parsing, wrapped lines, sections, model-answer parsing, prompts, the import shape. The live model path is exercised by hand with `qa/flows/statement-live.mjs` (see README of qa/).

## Ideas / not yet
- OFX/QFX files (no reading needed, just parsing).
- Brokerage statements into holdings, paystubs into Income: same endpoint with another `kind` and prompt.
- Cloud document services (Textract, Document AI) as an optional provider for people who accept sending statements out.
