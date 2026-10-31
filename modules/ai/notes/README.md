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
- **The AI is optional.** When the AI helper is off, has no model yet, is not answering, sends back something that
  cannot be read, or finds nothing in a note the plain rules can read, a few plain rules read the note instead
  (`quickRead`), and the page says which.
- **Nothing is saved before a tap.** Every entry is a proposal shown with what it would add; it can be changed (even
  its kind) or skipped. Numbers from the AI reach the plan only after Add (AGENTS.md rule 5), and an amount that is
  not in the note as written is flagged.

## Inputs
Accounts, transactions (to pick the account new spending goes to), the household (names to hide), reminders and the
plan's notes. It writes `transactions`, `reminders`, `accounts` (a balance) and `notes`, always through the helpers
of the pages that own them.

## Outputs
`compute(plan)` -> `{ accounts: [{ id, name, label }], notes, ready }`. Also exported: `readDate`, `readAmount`,
`readAccount`, `defaultAccount`, `sentencesOf`, `notePart`, `withoutSentences`, `quickRead`, `finish`, `buildPrompt`,
`readAnswer`, `applyEntry`, `accountChoices`, `KINDS`, `MAX_NOTE` (2,000 characters), `MAX_ENTRIES` (10), `MAX_TEXT`
(200).

## Rules
- **Days** (`readDate`): 2026-12-01; 12/1 or 12/1/2026 (but "1/2 of the rent" is a share, not January 2); "December
  1", "Dec. 1st, 2026", "sept 4", "1 December", "the 3rd of March" (whole month words only: "market 3" is not March 3,
  "Decathlon" not December); today, this morning, this afternoon, tonight, earlier today, just now, an hour ago, in 2
  hours, yesterday (morning, evening...), last night, late last night, the day before yesterday, the night before
  last, tomorrow, the day after tomorrow; "N days ago" or "N days back" (nights too), "in N days", "N days from now",
  "N days from today" and "a week from tomorrow" (read before "today" and "tomorrow" alone, so "two weeks from today"
  is November 14, not today), and the same with weeks and fortnights ("a fortnight ago" is 14 days back; N a number,
  or a, one... twenty, thirty, "twenty-one"), next week, last week; a weekday ("on Friday", "last Friday", "this past
  Friday", "next Friday", "this coming Friday", "Friday night", "the Friday before last", "the Friday after next",
  "Tuesday last week", "Monday next week"; "Friday's" is a name, not a day, and "Black Friday deals" or "Easter
  Sunday brunch" no weekday); "the 15th", "the 15th of last month". A holiday that is one day: Christmas (and its
  Eve), New Year's Day and Eve, Halloween, Valentine's Day, the Fourth of July, Thanksgiving (the fourth Thursday of
  November), Black Friday and Cyber Monday after it, Memorial Day (the last Monday of May), Labor Day (the first
  Monday of September), Mother's Day (the second Sunday of May), Father's Day (the third Sunday of June), Easter (the
  anonymous Gregorian rule, Meeus, *Astronomical Algorithms* ch. 8) and Good Friday before it; "on Christmas", "last
  Thanksgiving", "by Christmas", "Christmas Eve 2025". Only where it names when: followed by the end, a mark or a word
  that goes on the sentence ("on Christmas at the mall"), never "Christmas gifts", "the Halloween store" or "for
  Halloween" (what it was for). A day without a year, a bare weekday, a holiday or "the 15th" is the latest one up to
  today for something that happened, and the next one from today for a reminder; "last" and "next" say which. Only days that exist: "the 31st" in a month without one is the nearest month that has it, going back for
  something that happened (on May 15, March 31) and forward for a reminder (on November 15, December 31). Words that
  name a time but not one real day give no day (`date: ""`), so the entry asks for it instead of quietly using today,
  and the words leave the payee: February 31; this week or the past week ("earlier this week"); this, last, next or
  past weekend, month or year ("early next month", "over the past year", "this past weekend"); "earlier" or "early"
  before last or next week; the end, start or middle of the month (or of September); over the weekend; the past few days, the last 3
  weeks; a few days, a couple of weeks, several months (ago or back); N months or years ago or back; in a month, in 2
  years; a month without a day ("in September", "early October", "mid-June", "last March", "September 2026"; "may"
  only after in, early, late...: "this may be" is no month); recently, lately, the other day, a while ago; "earlier"
  at the end of a sentence; a span ("within the last week", "the previous week", "the following Monday", "the first
  week of December"); "the week before last", "the weekend after next", "the week prior", "the day before", "that
  morning", "the same day", "3 days later", "two days before payday", "a week from Friday", "2 months from today", "a
  day or two ago", "earlier in the week"; a season ("last summer", "in the fall", "this spring", "summer 2025",
  "spring break"; "the Spring Market" and "summer camp" are names); "over the holidays", "around Christmas",
  "Christmas time", "Labor Day weekend", "on payday", "on my birthday"; and any other "... ago" ("ages ago", "two
  Fridays ago"). What a payment is for is no day ("next year's insurance", "last week's groceries"). For money and a
  balance (`dayOf`), a day the note talks about that none of this reads is asked for too, never taken as today: no
  day read but a word of time in the sentence (ago, before, since, prior, fortnight, weekend, holiday, week, month,
  year; "on the first of the month"; "on Veterans Day", "on St. Patrick's Day", "on ... Eve"; Juneteenth, Hanukkah,
  Kwanzaa, Passover, Diwali, Ramadan, Eid, Rosh Hashanah, Yom Kippur, Lunar New Year), or a day read with a
  looking-back word beside it ("a month ago today"). With none of these words the day is today.
- **Amounts** (`readAmount`): "$42.17", "42 dollars", "40 bucks", or a number right after a money word (spent, paid,
  cost, charged, got, received, earned, is, is at, is now, has, have, shows, balance, stands at), else right after of,
  at, for or to ("registration of 85", "shoes for 80"): in "Dinner for 4, paid 60 at Joe's" the amount is 60.
  A number is read whole or not at all: never the first digits of a percent (23.9%), a time (3 pm, 12:30, 10
  o'clock), a count (15 days, 2 hours, 4 people, 3 nights, 2 tickets, the 40th), a date (11/1), a phone number or a
  longer number ($5.555, 1,2345). A minus sign before it ("-$120") makes it negative (an overdrawn account). The
  match also gives the amount with a "for", "of", "at", "to", "on" or "from" just before it, so a payee loses both.
- **Accounts** (`readAccount`): an account's name (whole words, longest first; when two accounts have that name, the
  note does not say which and the account is asked for); else its name without a last "card" or "account" after the,
  my or our ("the visa" for "Visa card"); else the first kind word that fits, when exactly one account is that kind.
  Kind words, the more exact first: health savings or HSA, student loan, debit card (the checking account), gift card
  (no account), credit card or card, checking, savings, mortgage, car or auto loan or loan, brokerage, 401(k), Roth.
  An account's name or a kind word that is part of another name names no account there, and the payee keeps it:
  right after "at" ("at the Savings Mart", "at House of Pancakes", "at the Car loan office") or "a" ("a loan shark",
  "bought a card"); or followed (after a "card", "account" or "IRA") by a word for a place, a business, a cost or a
  person (shop, store, market, cafe, bar, office, company, partners, fee, bill, payment, cleaner...: "the card shop",
  "my checking fee", "my credit card bill", "the mortgage company"), by "of" and a capital ("House of Pancakes"), or by
  a word in capitals that is not a person in the plan, a day, a month or a small word ("the Mortgage Shop", "the
  Brokerage Bar", "Brokerage Partners"); and, for an account money is not spent from day to day (a house, a loan,
  investments), after "the", by any other word that does not go on the sentence ("the house cleaner"). A card,
  checking or savings after my, our, your, from, with, using, via, into or out of is the household's own account
  whatever follows ("on my card again", "on my card Black Friday", "with my checking debit", "from savings just
  now"), and so it is followed by a word that goes on the sentence ("with the card ending 1234", the "ending 1234"
  leaving the payee too; "on the credit card I share with Bo"; "on the card my wife uses"); followed by any other
  word in small letters it is a thing bought, not the account ("on card games", "the card table", "savings jars"). When a
  sentence names two accounts, the one after from, with, using, via, out of or into is the one the money moved
  through: "Paid the mortgage from checking, 1,980 dollars" is money spent from checking, to "Mortgage".
- **Where new money goes** (`defaultAccount`, both for the plain rules and for an AI entry with no account): only
  everyday accounts, never a loan, a house or a retirement account. Money spent: checking, savings, cash or a credit
  card; money in: checking, savings or cash. Of those, the one with the most transactions, else the first checking
  account, else the first of them; none, and the account is asked for. A note that names an account the plan does not
  have (or two could fit) is asked for too, never swapped for this one.
- **The part read** (`sentencesOf`, `notePart`): a note is split after . ! ? or ; and at line breaks, except: after a
  title that comes before a name (Dr., Mr., Mrs., Ms., Mt., Prof., and St. after the, at, to, from... as in "at St.
  Mary's") unless the next word is one a sentence starts with (I, we, you, he, she, they, it, my, our, the, also,
  then, remind, remember, don't, please, spent, paid, bought, got, received, earned, made, charged...) or a day word
  (today, tomorrow, yesterday, tonight, this, next, last): "Dr. Lee" and "Prof. Kim" go on; after a word that comes
  after a name (Inc., Co., Corp., Ltd., Jr., Sr.) when the next word starts with a small letter and is not one a
  sentence starts with: "Acme Inc. for the parts" goes on, "Acme Inc. Spent 20" and "Acme Corp. 50 of it was tax" are
  two; after a street (St. as a street, Ave., Rd., Blvd.) or a title that follows a name (after a comma, "Lee, Dr.",
  or after a word in capitals that does not start the sentence, "to Kim Lee Dr.") when the next word starts with a
  small letter, or when capitals with no number in them follow that go on a name up to the end of that sentence or to
  a small word such as for, at, on, and: "the Main St. Cafe." and "Main St. Cafe for lunch" go on, "Lee, Dr. Kim and
  Bo" goes on, but a next sentence with an amount or a day of its own is a new entry ("Lee, Dr. Went to Target and
  spent 20", "12 Main St. Need to pay rent on the 1st"), and "5
  Oak St. Lunch was nice", "Oak St. Target was busy", "Lee, Dr. Rent is due", "Lee, Dr. Tomorrow remind me",
  "Lee, Dr. Yesterday I spent 20" and "Lee, Dr. Bo spent 20" are two; after vs. or approx. before a small letter or
  a number ("20 vs. 30"); after Jan. ... Dec. before a day ("on Dec. 1"). "No." is a word, so "I said no. Spent 30"
  is two. One reading
  takes the first 10 sentences that fit in 2,000 characters (both the plain rules and the AI); the rest stays in the
  box, and the page says so.
- **The plain rules** (`quickRead`), one entry per sentence, each keeping the sentence it came from (`source`):
  "remind", "remember to", "don't forget" or "due" make a reminder; so does "due to", but only when a day from today
  on is said (or a time with no one day that does not look back, as "in April" or "next month" do and "last month"
  does not), nothing was spent, paid, bought, charged, received or got, and nothing already happened (was, were,
  had, did, went, came, or, before "due to", a word in -ed in small letters other than scheduled, expected, planned,
  needed, required, owed, agreed, signed, deferred, increased, reduced, revised, updated, estimated, prorated,
  automated, combined, itemized, discounted; words after it, "as discussed", "it is automated", say nothing about
  that): "Visa payment due to Chase on the 15th" and "Card payment due to United on the 1st" are
  reminders; "Due to the rain, spent 20" is money spent; "cancelled due to rain", "The game was cancelled due to rain
  on Friday" (or last Friday) and "Due to a refund, my balance dropped yesterday" are notes; "Late fee of 25 due to
  the late payment yesterday" is money spent that day. A reminder's name is the sentence without
  those words, the day, the amount and "every month/year", which set how it repeats, and without a remark after a
  comma right behind the day ("Rent is due to the landlord on the 1st, as discussed": "Rent is due to the landlord"). An account named with
  "balance", "is", "is at", "has", "is now" or "stands at" and an amount make that account's balance (its day read as
  under Days; when the words fit no account or more than one, the account is asked for), but never a sentence about
  a payment, a fee, a rate, interest, an APR, a minimum, a limit, a due date or a bill. Money in or out: "got paid",
  "get paid", "was paid", "paid me", "got back" and an amount make money in; "received", "earned", "deposit",
  "refund" or "made" make money in only when nothing was paid out ("Made a payment of 200", "Paid a deposit of 500"
  and "Received the bill and paid 120" are money spent); "spent", "paid", "bought", "cost", "charged", "tipped" or
  "payment" and an amount make money spent, and so does a fee said with a deposit and no other word of money in
  (paycheck, salary, payroll and wages are such words) unless the fee was not charged ("no fees", "the fee was
  waived", "fee free", "without a fee"): "Overdraft fee of 35 due to a late deposit yesterday" is money spent,
  "Deposited my paycheck of 1,950, no fees this time" money in ("Paycheck" for money in that names no one). Who it was paid
  to (or came from) is the words after at, from, to, for or on (not "due to", "thanks to"), once the day, the amount
  with its for/of/at, the account's words ("from savings", "on my card", "to the visa", "the card ending 1234"; only
  where they named the account, so "at the Savings Mart from savings" keeps "Savings Mart") and a count ("for 4
  people") are cut, up to the next with, using, by, and, for, while, when, I, we, my... or the end ("Joe's for lunch"
  is Joe's, "Brokerage Partners for advice" Brokerage Partners), with a "for" or "on" left at its end and an "again",
  "too", "also", "online" or "first" dropped; a short word with a period stays ("Dr. Lee", "Prof. Kim", "Acme
  Corp.", "Main St. Cafe"). A number alone is no one, nor is a number and what was done, as dictation without commas
  gives it ("Dinner for 4, paid 60 at Joe's", "dinner for 4 paid 60 at Joe's", "Lunch for 3: paid 45 at Joe's" are
  Joe's; "7 Eleven" is a name), nor words that start with at, on, to ("on the 4th of July at the lake" is Lake), so
  the next of those words is tried; with none of them, what was paid ("paid the water bill" -> "Water bill"). "the
  electric bill" -> "Electric bill".
  Anything else is a note.
- **The AI** (`buildPrompt`, `readAnswer`): the part read, with people's and accounts' names swapped for stand-ins
  (Adult 1, "the credit card"; ai/critic's `hideTerms`/`hide`), tried longest first so "Ana's 401(k)" becomes its
  account's stand-in ("401(k) 1") instead of "Adult 1's 401(k)"; the accounts listed by those stand-ins with whose
  they are ("401(k) 1 (401(k) / 403(b), belongs to Adult 1)"), so the AI can tell two people's accounts apart; today's
  date. It returns a JSON list of entries and is told to use only what the note says and never guess an amount or a
  day. The answer is read with ai/critic's `findList`, each entry's account matched from its stand-in (with or without
  "the", numbered ones such as "401(k) 2" too) or a name (`readAccount`), money with no account (null) sent to
  `defaultAccount` as with the plain rules, names put back. When the AI finds nothing, the plain rules' money,
  reminders and balances are shown (their notes are not); when it is off, has no model yet, does not answer or sends
  back something unreadable, the plain rules read the note, and the page says which.
- **An entry made safe** (`finish`): an unknown kind becomes a note, and so does a name every object has
  ("constructor", "toString"; a repeat like that becomes "none"); amounts to the cent and positive (the kind gives
  the sign), except a balance, which keeps its sign (an overdrawn checking account); a day must exist, spaces around
  it dropped; an account must be in the plan. Missing details are listed and block Add (money: the amount, the day,
  the account, who; a reminder: what and the day; a balance: the account, the balance, the day; a note: its text).
  Warnings, which never block Add: an amount not written in the note (sign aside), a day in the future for money or a
  balance, a day more than a year from today, and the same entry already in the plan (a transaction with the same
  Ledger key, a reminder with the same name and day, the same note line): "This looks like one already in the Ledger.
  Check before adding." Two identical lines are allowed, as on the Ledger (two coffees the same day).
- **Adding** (`applyEntry`): money spent or in becomes a transaction like the Ledger's (money out negative, `rawPayee`
  = payee, `key` from the Ledger's `txKey`, which the import page uses for its duplicate check, no category yet so
  Categorize offers it, note "from a voice note"); a reminder goes through the Money calendar's `saveReminder`; a
  balance through Account detail's `saveBalance` (that day's point, and the balance on Net worth when it is the
  newest); a note is a dated line added to the plan's notes, shown and editable under "Notes you kept". On the page,
  an added entry's sentence leaves the note box (`withoutSentences`), so reading the note again cannot bring it back;
  once every entry is handled, the sentences read go too and only what was not read yet (or typed since) stays. Only
  whole sentences of the box go, split the same way (spaces between words may differ, and one may run over a line
  break): "Spent 20 at Target" never takes a piece out of "Spent 20 at Target yesterday.", and of two the same, one
  goes.
  "Add all" checks each ready entry again, with what was typed into it and against the plan as it is now (an account
  may have been removed on another page): only those still ready are added; the rest stay listed with what they need,
  named in a red message.
- **The account list** (`accountChoices`): each account's name, with its kind after it only when the name does not
  already say it ("Visa card (Credit card)", but "Brokerage", "Mortgage", "Ana's 401(k)"); for money spent or in, the
  everyday accounts (checking, savings, cash, credit cards) first.

## Edge cases
- An empty note: "Type or say a note first."
- No accounts: money and balances ask for the account, and a message says to add accounts on Net worth first (with a
  button) or keep the entry as a note.
- The browser cannot hear (no microphone permission): a message pointing to the keyboard's microphone.
- Listening while the page is drawn again (a reading finishing): the recognition lives outside one drawing, so the
  words go to the box on screen and the "Listening… tap to stop" button stops it.
- Several entries ready: "Add all N that are ready" and "Skip all" share one row; each add confirms itself with a link
  to the page it went to, right above the next entry, and the page scrolls back to it (the shell scrolls to the top
  after every change, as on ai/categorizer). A fresh reading scrolls its entries into view.
- What is typed into an open entry is kept until Add or Skip, through a redraw (another entry added) and "Add all".
- Changing an entry to a Note keeps the sentence it came from (from the AI: its summary), not the whole note.
- A long note: the first 10 sentences are read and the page says how many stay in the box for the next reading.
- Amounts the note typed are shown in whole dollars, with cents only when it gave them (design log pass 2, round 9).
- With the AI helper, the button says "Reading your note…" and a line says it can take a minute or two (as the
  Statement reader does, design log pass 2, round 8).
- One reading at a time; a render that is no longer on screen never redraws.

## Tests
`module.test.mjs` (24): days (every form, past and future, impossible days; month words inside other words, shares,
names with a weekday, the day after tomorrow, weeks, next and last week, tonight, "1 December", "the 31st" and "the
30th" going back and forward, a time that is no one day; last night, N days back, a part of the day, this past
Friday, and every vague time word asked for with its words out of the payee, possessives and month words inside
names that are no day); amounts (a money word's number before a count after for) (and what is not one: multi-digit percents, times,
counts, dates, phone numbers, longer numbers; a minus sign); accounts (every kind word, debit card, gift card,
health savings, student loan, a short name, two accounts of one name) and where new money goes (never a credit card
for money in, never a loan); the plain rules on a five-sentence note and three reminders; money in or out, balance
words (has, is now, stands at) and payments or fees that are not balances, the payee without its amount or account,
counts, "due to", a day that cannot be read; "due to" a payee with a day; kind words inside a name; sentences at
Dr. and Dec., and ending after Inc., Co., St. and Dr. when a new one starts; only whole sentences leaving the box; the sentence each entry came from, a long
note read in parts, no accounts yet; an entry made safe (kinds, signs, missing details, warnings; negative balances,
padded days, inherited names, the same entry twice); the AI question (names hidden, longest first, whose account,
only the part read); the AI's answer read back (stand-ins matched, numbered ones, money with no account, padded
days, names restored, an amount not in the note flagged, no list); adding each kind through its page's helper and
nothing half-filled; the account list; compute; days counted from today or tomorrow, the night before last, a
fortnight, number words, a weekday with last or next week, the 15th of last month, holidays (and holiday words that
are no day), and the time words that name no one day asked for, with their words out of the payee; sentences after
"Lee, Dr." with every kind of new sentence, Prof., Corp. before a number, a street that goes on a name; accounts named
Mortgage, Brokerage, House and Car loan inside a payee, two accounts in a sentence, a card or savings followed by a
small word still the account; "due to" a day gone by or something that happened, a fee with a deposit, a count
before what was done in dictation. The phone-number case uses a short 555 number: the repo's leak guard
refuses a full ten-digit one.

## Ideas / not yet
- Speech to text on the PC (Whisper through the server), so the sound never leaves home.
- Categories for money spent, from the Categorize page's rules.
