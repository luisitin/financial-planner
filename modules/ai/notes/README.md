# Voice notes  (`ai/notes`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Say or type a note and the app turns it into entries for you to check: money spent or received, a
reminder, an account balance or a note.

## Choices made (no owner notes for this page)
- **Speech to text is the phone's or the browser's, never the app's.** The page asks you to tap the microphone on the
  phone's keyboard (works on any phone, nothing new sent anywhere by the app). Where the browser has its own speech
  recognition (`SpeechRecognition` / `webkitSpeechRecognition`), a "Speak instead" button uses it, with a line saying
  that some browsers (Chrome among them) send the sound to their maker's servers. Speech to text on the PC (Whisper
  through the server) would keep the sound at home; it needs a server route and is left for later.
- **The AI is optional.** When the AI helper is off, not answering, or sends back something that cannot be read, a few
  plain rules read the note instead (`quickRead`), and the page says so.
- **Nothing is saved before a tap.** Every entry is a proposal shown with what it would add; it can be changed (even
  its kind) or skipped. Numbers from the AI reach the plan only after Add (AGENTS.md rule 5), and an amount that is
  not in the note as written is flagged.

## Inputs
Accounts, transactions (to pick the account new spending goes to), the household (names to hide), reminders and the
plan's notes. It writes `transactions`, `reminders`, `accounts` (a balance) and `notes`, always through the helpers
of the pages that own them.

## Outputs
`compute(plan)` -> `{ accounts: [{ id, name, label }], notes, ready }`. Also exported: `readDate`, `readAmount`,
`readAccount`, `defaultAccount`, `quickRead`, `finish`, `buildPrompt`, `readAnswer`, `applyEntry`, `KINDS`,
`MAX_NOTE` (2,000 characters), `MAX_ENTRIES` (10), `MAX_TEXT` (200).

## Rules
- **Days** (`readDate`): 2026-12-01; 12/1 or 12/1/2026; "December 1", "Dec 1st, 2026", "1 December", "the 3rd of
  March"; today, this morning, tonight, yesterday, the day before yesterday, tomorrow; "N days ago", "in N days", next
  week, last week; a weekday ("on Friday", "last Friday", "next Friday"); "the 15th". A day without a year, a bare
  weekday or "the 15th" is the latest one up to today for something that happened, and the next one from today for a
  reminder; "last" and "next" say which. Only days that exist (February 31 is no day; "the 31st" in a month without
  one moves to the next month that has it).
- **Amounts** (`readAmount`): "$42.17", "42 dollars", "40 bucks", or a number right after a money word (spent, paid,
  cost, charged, got, received, earned, is at, is now, balance, of, at, for, to...), never a bare number, a time (3
  pm), a percent, a count of days or hours, or "the 15th".
- **Accounts** (`readAccount`): an account's name (whole words, longest first), else a kind word (card, checking,
  savings, mortgage, loan, brokerage, 401(k), Roth, HSA) when exactly one account is that kind. New spending with no
  account named goes to the account with the most transactions, else the first checking account, else the first
  account (`defaultAccount`).
- **The plain rules** (`quickRead`), one entry per sentence (at most 10): "remind", "remember to", "don't forget" or
  "due" make a reminder (its name is the sentence without those words, the day, the amount and "every month/year",
  which set how it repeats); an account named with "balance", "is", "is at", "has", "is now" or "stands at" and an
  amount make that account's balance (today unless a day is said); "got paid", "received", "earned", "deposit",
  "refund" and an amount make money in ("Paycheck" when it says got paid and names no one); "spent", "paid",
  "bought", "cost", "charged" and an amount make money spent; who it was paid to (or came from) is the words after
  at, from, to, for or on, up to a day, an account or the end ("the electric bill" -> "Electric bill"); anything else
  is a note.
- **The AI** (`buildPrompt`, `readAnswer`): the note with people's and accounts' names swapped for stand-ins (Adult 1,
  "the credit card"; ai/critic's `hideTerms`/`hide`), the accounts listed by those stand-ins and today's date; it
  returns a JSON list of entries and is told to use only what the note says and never guess an amount or a day. The
  answer is read with ai/critic's `findList`, each entry's account matched from its stand-in (with or without "the")
  or a name, names put back.
- **An entry made safe** (`finish`): an unknown kind becomes a note; amounts positive and to the cent (the kind gives
  the sign); a day must exist; an account must be in the plan. Missing details are listed and block Add (money: the
  amount, the day, the account, who; a reminder: what and the day; a balance: the account, the balance, the day; a
  note: its text). Warnings: an amount not written in the note, a day in the future for money or a balance, a day more
  than a year from today.
- **Adding** (`applyEntry`): money spent or in becomes a transaction like the Ledger's (money out negative, `rawPayee`
  = payee, `key` from the Ledger's `txKey` for the duplicate check, no category yet so Categorize offers it, note "from
  a voice note"); a reminder goes through the Money calendar's `saveReminder`; a balance through Account detail's
  `saveBalance` (that day's point, and the balance on Net worth when it is the newest); a note is a dated line added to
  the plan's notes, shown and editable under "Notes you kept".

## Edge cases
- An empty note: "Type or say a note first."
- No accounts: the entry asks for an account (the list is empty, so money and balances cannot be added yet).
- The browser cannot hear (no microphone permission): a message pointing to the keyboard's microphone.
- Several entries ready: "Add all N that are ready"; each add confirms itself with a link to the page it went to.
- One reading at a time; a render that is no longer on screen never redraws.

## Tests
`module.test.mjs` (9): days (every form, past and future, impossible days); amounts (and what is not one); accounts
and the default account; the plain rules on a five-sentence note and three reminders; an entry made safe (kinds,
signs, missing details, warnings); the AI question (names hidden, accounts listed); the AI's answer read back
(stand-ins matched, names restored, an amount not in the note flagged, no list); adding each kind through its page's
helper and nothing half-filled; compute.

## Ideas / not yet
- Speech to text on the PC (Whisper through the server), so the sound never leaves home.
- Categories for money spent, from the Categorize page's rules.
