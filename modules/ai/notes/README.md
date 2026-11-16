# Voice notes  (`ai/notes`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Say or type a note and the app turns it into entries for you to check: money spent or received, a
reminder, an account balance, a debt or a note.

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
Accounts, transactions (to pick the account new spending goes to), the household (names to hide), reminders, debts
and the plan's notes. It writes `transactions`, `reminders`, `accounts` (a balance, or a debt said in a note), `debts`
(a debt's rate and payment) and `notes`, always through the helpers of the pages that own them.

## Outputs
`compute(plan)` -> `{ accounts: [{ id, name, label }], notes, ready }`. Also exported: `readDate`, `readAmount`,
`readAccount`, `defaultAccount`, `sentencesOf`, `notePart`, `withoutSentences`, `quickRead`, `finish`, `buildPrompt`,
`readAnswer`, `applyEntry`, `accountChoices`, `KINDS`, `MAX_NOTE` (2,000 characters), `MAX_ENTRIES` (10), `MAX_TEXT`
(200), `debtSentences`, and from `debts.js` (below): `numberWords`, `isDebtSentence`, `readDebts`, `finishDebt`,
`applyDebts`, `matchDebt`, `debtAccounts`, `debtName`, `debtType`, `debtKey`, `missingWords`, `unplacedWords`,
`paidWords`, `doneWords`, `undoWords`, `payoffLine`, `payoffWords`, `DEBT_TYPES`.

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
`module.test.mjs` (45). The debt case (gap next-60 #59): the example sentence (two debts, every field; the same note
updating the renter's Visa card and Car loan); numbers in words (every form, and a whole note in words); a missing
rate or payment (the one said kept with our guess for the other, marked as ours; with no guess, said as not kept,
before and after the tap; a student loan's payment, which has no guess); updated only when something was written (a
rate with no loan detail, a balance on file dated later); an older plan's guess flags cleared; a repeat left out and a
malformed plan; which plan debt a sentence is about (a name with its own amount, the cue for a debt found by its kind
alone, no match by kind for a debt with no name); money spent beside a debt kept, and a payment a month alone no debt
sentence (fix round 1, 2026-11-16); two debts in one note (two sentences, lists in order, a
name said again, figures that fit nowhere and money paid said plainly, what is no debt sentence, names and kinds); a
debt made safe (matching, ranges, every warning); adding (new and an update through Account detail, guess marks
cleared, Debts and Pay off debts reading them); nothing saved before the tap (frozen plans); Undo (core/ui/undo.js gives
the plan back); the line to Pay off debts in each case; the AI asked about debts only for a debt note and its debts
read back; the invariance corpus holds no debt sentence; and invariance: over 33 invented households, compute, the
plain rules on 574 notes (the 556 of this file's tests at dca545e, and 18 with a card or loan word and a payment a month
that are no debt, such as "Netflix 15 a month on my Visa card"), the AI question for each, fixed answers and every
ready entry added give the digests written with dca545e's code (`invariance.json`; `PRINT=1` writes them again). The earlier 24: days (every form, past and future, impossible days; month words inside other words, shares,
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

## Debts said in a note (gap list, next 60, item 59; claude-b, 2026-11-16)
"I owe about four thousand on my Visa at 24 percent and twelve thousand on the car at 6, paying 300 and 410 a month"
becomes two debts to check: Visa, a credit card, $4,000 owed at 24% a year, $300 a month; Car loan, a car or personal
loan, $12,000 at 6%, $410 a month. Nothing reaches the plan before "Add these debts" (AGENTS.md rule 5). The code is
`debts.js` (pure), re-exported by `compute.js`.

- **Which sentences** (`isDebtSentence`, `debtSentences`): after the reminder check (a reminder stays one), a sentence
  with a number that says owe, owed, owing or "in debt" beside a debt word, a rate or a payment a month ("I owe my mom
  2,000", "I owe 4,000 at 24 percent"); or, without "owe", a word that names a debt (card, credit card, a card's brand,
  loan, mortgage, line of credit, "car payment", "student loan"...) beside a rate ("percent", "%", APR, "interest
  rate") or "minimum": "The Visa card interest rate is 23.9%" (a note before; now it updates that debt, after a tap). A
  payment a month alone makes no debt sentence (fix round 1, 2026-11-16): "Netflix 15 a month on my Visa card", "Rent
  is 1500 a month, car payment 300 a month", "Put 25 a month toward the loan" and "The car loan payment is 410 a month"
  read as before (a note, money spent), so no budget line becomes a debt or a card's minimum payment. Money said as
  spent or paid with no "owe" stays the Ledger's ("Paid 300 on the card"); "car insurance is 120 a month", "I owe Bo 20
  for lunch" and "the balance on my Visa card is 6,400" are no debt sentence and read as before.
- **Numbers said in words** (`numberWords`): units, teens, tens, hundred, thousand, million, "and" inside a number
  ("four hundred and ten" 410; "three hundred and four hundred ten" is 300 and 410: a part joins the one before only
  when it is smaller than that one's last scale), "and a half" (+0.5), "point" (decimals word by word: "twenty four
  point nine nine" 24.99), "grand", "12k", "1.2 million". A lone "one", "a" or "an" stays ("the one on the car", "a
  month"); a run before an ordinal stays (a day); "401k", "403(b)" and "457" are plan names. English cardinal numbers:
  no outside figure.
- **What each number is** (`readDebts`): a rate before "percent", "%", "pct" or "APR", after "rate is" / "interest
  rate of", or after "at" when it is 100 or less and has no dollar sign ("on the car at 6"); a payment before "a
  month", "monthly" or "minimum", or after "paying", "pay", "payment(s) of", "minimum"; money paid after "paid",
  "spent", "bought" (said plainly, not added: `paidWords`); a count before cards, loans, months, years... and a card's
  last digits, a day, a year after in or since: nothing; dollars of interest or a credit limit: placed nowhere, said
  plainly; anything else is what is owed. A number with no mark right before or after one that has one takes its mark
  ("300 and 410 a month", "at 24 and 6 percent", "paying 300 and 410."), except after owe, is, has or balance.
- **Which debt each figure goes with**: what is owed starts a debt; a name (after on, for, to, with, from, at, in, of,
  after "owe", before "is", "has" or a number at the start of a part of the sentence, or a debt word right after a
  number: "a 200,000 mortgage", "4,000 in credit card debt", or a debt word with its own amount after a, my, the:
  "I have a student loan of 18,000") goes with the earliest debt said before it that has no name, else with the next
  amount; a name followed by its own amount ("my mortgage is 250k") always starts its own debt and never names an
  earlier one (fix round 1: "a student loan of 18000 at 5.5 percent and my mortgage is 250k" named the 18,000 "Mortgage"
  and matched the plan's mortgage). A verb at the start of a sentence ("Put", "Pay", "Move", "Send") is no name. One rate or payment goes with the last debt said before it that lacks one (else the
  next); two or more in a row go to the debts lacking them in the order said, only when there are as many; a name said
  again right beside a figure ("410 on the car", "the Visa at 24") points at that debt. A figure that fits nowhere is
  left blank and listed (`unplacedWords`: "The app could not tell which debt 300 and 410 go with: tap Edit on each
  debt to type them."), never guessed.
- **Names and kinds** (`debtName`, `debtType`): "the car" -> Car loan, "house" -> Mortgage, "credit card debt" ->
  Credit card, any other name as said ("Visa", "Chase Sapphire", "Mom", "IRS"). The kind from its words: home equity
  or HELOC a car or personal loan; mortgage, house, home, condo a mortgage; student, college, school, tuition a student
  loan; credit, card, Visa, Mastercard, Amex, American Express, Discover a credit card; car, auto, truck, van,
  motorcycle, boat, RV, loan a car or personal loan; anything else "Other debt" (Net worth's "Something else I owe" read
  oddly under "Kind of debt"). The person changes either.
- **A debt in the plan** (`matchDebt`): the liability account whose name says the same once "my", "the" and a last
  "card", "loan", "account", "debt" or "balance" are dropped ("my Visa" is "Visa card", "the car" is "Car loan"); for a
  name that says only the kind ("the card", "the mortgage"), the plan's one debt of that kind, and the record asks "Is
  this your Visa card? It is the one credit card in your plan. If not, tap Edit and pick "A new debt" under "In your
  plan"." until Done (`matchOf`'s `heard`). A debt with no name is never matched by kind. Two that fit, or none: a new
  debt, and the record says "Your plan already has Visa card, Mastercard and Store card. If this is one of them, tap
  Edit and pick it under "In your plan"." so no debt is counted twice.
- **Made safe** (`finishDebt`): what is owed at least 0 (above 0 for a new debt), to the cent; a rate from 0 to 100% a
  year (a read above 100% is blank and said); a payment above 0. A new debt needs its name and what is owed; one in
  the plan needs one figure. `missing` (said, never blocking): the rate or the payment when the plan has no loan detail
  for it, one sentence per case (`missingWords`): with one of the two said and our guess for the other (`canGuess`,
  worked out by adding the debt to a copy of the plan with the app's guesses), "You did not say the monthly payment. Tap
  Edit to type it, or add it now: the 24% is kept, and the payment is our guess until you type yours."; with no guess,
  "... the Debts page needs it with the 24%, so without it the 24% is not kept."; with neither, "... the Debts page will
  ask for both." A debt in the plan with only a rate or a payment said and no guess for the other is held back ("Still
  needed: its payment a month too"). Warnings: a figure not in the note as written (the AI's; number words read as
  numbers); a payment that does not cover the interest; a payment above what is owed.
- **Adding** (`applyDebts`): a new debt is a liability account as Net worth adds one (`{ id, name, type, institution:
  "", balance, asOf: today, ownerId: "", history: [], notes: "from a voice note" }`) and its loan detail as Debts keeps
  it (`{ id, accountId, rate, minPayment, extra: 0 }`). A detail never holds a silent $0: with one of the rate and the
  payment said, the other is our guess, put in as Debts puts one for a box left blank (the estimate `debt.<kind>.rate`
  or `.payment` of core/estimate with the row as it now is, marked with `markGuess`; fix round 1, 2026-11-16: a rate
  said without a payment was dropped); with no guess for it the figure said is not kept, and that is said (`dropped`);
  with neither said, the account goes in alone and Debts shows it "needs details" (`bare`). A debt in the plan: what is
  owed through Account detail's `saveBalance` (that day's point, the balance on file when it is the newest, then
  `markTyped` as Account detail does; a balance on file dated after today stays, and that is said: `later`), the rate
  and payment said into its loan detail (one made as for a new debt when there is none), and our guess marks on each
  figure said cleared (`clearGuess`, older plans' `rateGuessed` and `paymentGuessed` flags with them), so a figure
  said is the person's. A debt in the plan is called updated only when something the plan counts was written. A second
  entry for the same debt (the same plan debt, or a new name twice: `repeats`) is left out (`repeated`); lists that are
  not lists in a hand-edited plan are made lists. The green line, one sentence per case (`doneWords`): "Added Visa and
  Car loan to your debts." / "Updated Visa card." / "Added Car loan and updated Visa card."; "Visa's monthly payment is
  our guess for now: type the real one on the Debts page."; "Car loan has no rate or payment yet: give them on the Debts
  page."; "Student loan's 5.5% is not kept: the Debts page needs the monthly payment with it."; "Car loan's $12,000 is
  kept for today, but the plan goes on using the balance dated 12/1/2026 ($9,000), which is later."; "Visa was given
  twice: only the first is in."; and, when some were left out, "Car loan is not added yet: it says below what to
  change." (`leftWords`). Undo takes back exactly that change (core/ui `undoable`); its words (`undoWords`): "Taken
  back: Visa and Car loan are out of your plan again. They are listed below to change or add."
- **The AI helper**: asked about debts only when the part read holds a debt sentence (`buildPrompt` adds a `debt`
  entry, `{ name, type: card | loan | mortgage | student | other, owed, rate in percent, payment }`, and "never guess
  what is owed, a rate or a payment the note does not give: use null"; `q.debts`). Its debts are read back only then
  (`readAnswer`), the account from its stand-in or its name, and made safe the same way: every figure is shown for
  checking, and one not in the note is flagged.

### On screen
- **First view**: as before, with two examples of the lede swapped so a debt is one of them ("rent is due on the 1st",
  "I owe 4,000 on my Visa at 24 percent"; "You check each entry, and nothing is saved until you tap Add."): 82 words,
  no figure, one box, one filled button, as at dca545e (`node qa/first-view-node.mjs ai/notes`).
- **After "Read my note"**, a note with debts shows the card "Debts from your note (2)" above the other entries: one
  line on who read it, the figures no debt took and money said as paid (blue lines, once), then each debt as a record
  (its name, "Name this debt" when it has none, and what is owed; under it the kind, or "Updates Visa card in your
  plan", the rate a year and the payment a month), the sentence for a figure not said, what to check (amber), and
  "Edit" / "Skip". Edit opens its boxes in place: "In your plan" (a new debt or one of the plan's, only when the plan has
  debts), "What it is called" and "Kind of debt" (a new one only), "How much you owe", "Interest rate a year", "Payment a
  month"; "Done" (outlined) closes them. A debt that needs its name or what is owed opens with only that box ("What is
  this debt called?", "How much you owe"), Done, "More details" (all the boxes) and Skip, and no amber "Still needed"
  (fix round 1: it opened all five boxes and the warning at once); a need with no box of its own opens them all, with
  the amber line. A second entry for the same debt says so (`twiceWords`). What is typed is kept through redraws. The
  card's one filled button: "Add these 2 debts" ("Add this debt" for one).
- **After the tap**, where the card was: the green line (`doneWords`) with Undo, "Open Debts" when a figure is our
  guess, not kept or not given, and under it the line to Pay off debts (`payoffLine`) with its link. A debt still
  needing something stays listed, with its red line at its top, where the screen comes back to (`notAddedWords`: "Not
  added yet: type its name below, then tap Add again."; fix round 1: one red line sat under the list, out of view). Undo
  puts the plan back, says so (`undoWords`) and lists the debts again. The green line stays while the page is open (a
  new reading or another visit starts without it); its Undo goes at the next tap on another entry (a notice with a
  button brings itself into view on every drawing, which would pull the page up while working lower down).
- No new fold: the page does not import core/ui/more.js yet (opt spec class A). Doing so would make its hand-written
  "Notes you kept" fold an S10 finding, and that fold holds 23 words and one box, so R14 says it should be shown, not
  folded, which raises the first view; that conversion is left for the page's opt pass.

### Formulas, with sources
- A rate said as a percent is kept as a fraction: 24 percent -> 0.24, as `plan.debts[].rate` (docs/DATA_MODEL.md).
- Interest a month = what is owed x the rate / 12, as balance/liabilities' `interestMonthly`: $4,000 x 0.24 / 12 =
  $80. A payment at or under it never pays the debt off ($50 against $80: "At $50 a month this debt never pays off:
  its interest is about $80 a month. Check the payment."), as balance/liabilities' `neverPaysOff` (core/math/finance.js
  `nper`). The consumer bureau's pages on card interest could not be read from this session (its site is refused by the
  network), so the arithmetic is written out here and no outside figure is used.
- The line to Pay off debts (`payoffLine`): debt/payoff `compute()` with the plan as it is after the add, the same
  money each month paid highest interest rate first (`plans.avalanche`) and smallest balance first (`plans.snowball`)
  (core/math/payoff.js); saves = smallest-first interest - highest-rate-first interest, to the dollar. One sentence per
  case (`payoffWords`): under $1 apart "both cost about the same in interest"; one debt "Pay off debts shows the month
  your debt is paid off and what paying a little more would change."; a payment under its interest even with the
  others' rolled onto it "One payment does not cover its interest yet: that page shows which."; no debt with a rate and
  a payment "Once your debts have a rate and a payment, Pay off debts compares ...". For the invented renter (three
  cards and a car loan, $50 extra a month) the highest rate first saves about $163; for the example note alone, both
  orders pay the Visa first (it is both the smaller and the dearer debt), so they cost the same.
- Every figure said is the person's own. The one figure of the world is our guess for a rate or a payment not said,
  read through core/estimate from the guesses page's tables (modules/overview/guesses/data/debts.js, read 2026-11-02),
  exactly as Debts reads it for a box left blank: a card's payment is the CFPB's most common minimum, 1% of the balance
  plus the month's interest, at least $40 and never more than the balance (CFPB, "The Consumer Credit Card Market",
  December 2025, section 4.1.1): $4,000 at 24% is 40 + 80 = $120; a card's rate the Federal Reserve's G.19 average on
  accounts that pay interest (22.36%, release of 2026-10-07); a car or personal loan's rate its 24-month personal loan
  average (11.9%); a mortgage's payment the guesses page's own. A student loan's or a personal loan's payment has no
  guess when both what is owed and the rate are typed (that estimator gives no date for a figure worked out from the
  person's own answers, so core/estimate refuses it; overview/guesses' to change, not this page's), so for those the
  rate said is not kept without a payment, and the page says so before the tap.

### Choices made (no owner notes)
- Debts are entries of their own (`kind: "debt"`), not in `KINDS`, so no other entry's "This is" list changes.
- An update needs only one figure ("My Visa is at 26 percent now"): what is not said keeps the plan's own.
- A debt to a friend with no debt word, rate or payment ("I owe Bo 20 for lunch") stays a note: one tap of "Keep this
  note" keeps it, and a debt account for $20 would crowd Net worth.
- Money spent or paid inside a debt sentence keeps the entry the sentence read as before, beside the debt, when that
  entry's amount is the money said as paid ("Spent 45 at the dentist, owe 20 more": $45 spent at Dentist and $20 owed
  to Dentist; fix round 1, 2026-11-16: the spend was dropped); otherwise the line says to say it on its own. The
  sentence leaves the box only once every entry from it is added.
- After an Add, the shell's typing memory (core/place.js) can put the note back in the box with "Not saved yet. Undo my
  typing", because the Add button is in another card than the box; so it is for every kind of entry since dca545e.
  Left for the lead: the fix is in core/place.js, or `data-no-keep` on the box (which loses a note typed before a
  reload).

## Ideas / not yet
- Speech to text on the PC (Whisper through the server), so the sound never leaves home.
- Categories for money spent, from the Categorize page's rules.
