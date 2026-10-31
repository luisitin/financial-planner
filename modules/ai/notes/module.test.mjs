import { test } from "node:test";
import assert from "node:assert/strict";
import { readDate, readAmount, readAccount, defaultAccount, quickRead, finish, buildPrompt, readAnswer, applyEntry, accountChoices, notePart, withoutSentences, sentencesOf, compute, KINDS, MAX_ENTRIES } from "./compute.js";
import { txKey } from "../../transactions/ledger/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const T = "2026-10-31";   // a Saturday
const plan = () => familyPlan(T);
const short = (list) => list.map((x) => ({ kind: x.kind, amount: x.amount, date: x.date, payee: x.payee, accountId: x.accountId, name: x.name, repeat: x.repeat, text: x.text, ready: x.ready }));

test("days: written out, numbers, relative words; a day with no year is the latest one for the past, the next one for a reminder", () => {
  const d = (s, dir) => readDate(s, T, dir)?.date ?? null;
  assert.equal(d("on 2026-12-01"), "2026-12-01");
  assert.equal(d("on 12/1", "future"), "2026-12-01");
  assert.equal(d("on 12/1"), "2025-12-01", "December 1 already past this year? no: it is ahead, so the past one is last year's");
  assert.equal(d("on 3/4/27"), "2027-03-04");
  assert.equal(d("December 1st", "future"), "2026-12-01");
  assert.equal(d("Oct 3"), "2026-10-03");
  assert.equal(d("the 3rd of March", "future"), "2027-03-03");
  assert.equal(d("yesterday"), "2026-10-30");
  assert.equal(d("the day before yesterday"), "2026-10-29");
  assert.equal(d("tomorrow", "future"), "2026-11-01");
  assert.equal(d("this morning"), T);
  assert.equal(d("3 days ago"), "2026-10-28");
  assert.equal(d("in 10 days", "future"), "2026-11-10");
  assert.equal(d("last friday"), "2026-10-30");
  assert.equal(d("on friday", "future"), "2026-11-06");
  assert.equal(d("next saturday"), "2026-11-07", "next: a week on when it is that day today");
  assert.equal(d("last saturday"), "2026-10-24");
  assert.equal(d("on saturday"), T, "today is that day");
  assert.equal(d("the 15th"), "2026-10-15");
  assert.equal(d("the 15th", "future"), "2026-11-15");
  assert.equal(d("February 31"), "", "not a real day: the words name one, so it is asked for, never guessed");
  assert.equal(d("on 2/30/2027"), "");
  assert.equal(d("the 30th", "future"), "2026-11-30");
  assert.equal(readDate("the 31st", "2026-11-15", "future")?.date, "2026-12-31", "November has no 31st: the next month that does");
  assert.equal(d("no day here"), null);
});

test("amounts: with a $, in dollars or bucks, or after a money word; never a bare number, a time, a percent or a count", () => {
  const a = (s) => readAmount(s)?.amount ?? null;
  assert.equal(a("spent $42.17"), 42.17);
  assert.equal(a("$ 1,200"), 1200);
  assert.equal(a("40 bucks on gas"), 40);
  assert.equal(a("12 dollars"), 12);
  assert.equal(a("savings is at 12,400"), 12400);
  assert.equal(a("paid about 120 for power"), 120);
  assert.equal(a("registration of 85"), 85);
  assert.equal(a("meet at 3 pm"), null);
  assert.equal(a("rate is 5%"), null);
  assert.equal(a("for 2 hours"), null);
  assert.equal(a("on the 15th"), null);
  assert.equal(a("we have 3 kids"), null);
});

test("accounts: by name (whole words), else by a kind word when only one account is that kind; the account new spending goes to", () => {
  const p = plan();
  assert.equal(readAccount("paid with the Visa card", p).id, "a-visa");
  assert.equal(readAccount("my savings is at", p).id, "a-sav");
  assert.equal(readAccount("on the card", p).id, "a-visa");
  assert.equal(readAccount("my 401k", p), null, "two 401(k)s: the note must say which");
  assert.equal(readAccount("nothing here", p), null);
  assert.equal(defaultAccount(p).id, "a-chk", "no transactions yet: the first checking account");
  p.transactions = [{ id: "t", accountId: "a-visa" }, { id: "u", accountId: "a-visa" }, { id: "v", accountId: "a-chk" }];
  assert.equal(defaultAccount(p).id, "a-visa", "the most used");
  assert.equal(defaultAccount(emptyPlan()), null);
});

test("the plain rules: one entry per sentence, money spent, money in, a reminder, a balance, a note", () => {
  const p = plan();
  const r = short(quickRead("Spent $42.17 at Corner Market yesterday. Remind me to pay the car registration of $85 on December 1. My savings is at 12,400. Got paid 1,950 today. Paid 120 for the electric bill with the visa card. Lunch out was nice.", p, T));
  assert.deepEqual(r, [
    { kind: "spend", amount: 42.17, date: "2026-10-30", payee: "Corner Market", accountId: "a-chk", name: "", repeat: "none", text: "", ready: true },
    { kind: "reminder", amount: 85, date: "2026-12-01", payee: "", accountId: "", name: "Pay the car registration", repeat: "none", text: "", ready: true },
    { kind: "balance", amount: 12400, date: T, payee: "", accountId: "a-sav", name: "", repeat: "none", text: "", ready: true },
    { kind: "income", amount: 1950, date: T, payee: "Paycheck", accountId: "a-chk", name: "", repeat: "none", text: "", ready: true },
    { kind: "spend", amount: 120, date: T, payee: "Electric bill", accountId: "a-visa", name: "", repeat: "none", text: "", ready: true },
    { kind: "note", amount: null, date: "", payee: "", accountId: "", name: "", repeat: "none", text: "Lunch out was nice.", ready: true },
  ]);
  const rem = short(quickRead("rent is due on the 1st every month\nRemind me on the 15th to call the bank\nremind me to renew the car insurance every year on March 3", p, T));
  assert.deepEqual(rem.map((x) => [x.name, x.date, x.repeat]), [["Rent is due", "2026-11-01", "monthly"], ["Call the bank", "2026-11-15", "none"], ["Renew the car insurance", "2027-03-03", "yearly"]]);
  const gap = quickRead("spent 40 bucks", p, T)[0];
  assert.deepEqual([gap.ready, gap.problems], [false, ["who it was paid to"]], "nothing says who: asked for");
  assert.deepEqual(quickRead("", p, T), []);
});

test("an entry made safe: kinds, positive amounts, real days, accounts in the plan; what is missing and what to check", () => {
  const p = plan();
  const f = (x, note = "") => finish(x, p, T, note);
  assert.equal(f({ kind: "dance" }).kind, "note");
  assert.equal(f({ kind: "spend", amount: -12.346, date: T, payee: "Shop", accountId: "a-chk" }).amount, 12.35, "a sign or extra digits from the AI do not matter");
  assert.deepEqual(f({ kind: "spend", amount: "x", date: "2026-02-31", payee: "", accountId: "nope" }).problems, ["the amount", "the day", "the account", "who it was paid to"]);
  assert.deepEqual(f({ kind: "income", amount: 5, date: T, accountId: "a-chk" }).problems, ["who it came from"]);
  assert.deepEqual(f({ kind: "reminder" }).problems, ["what to remember", "the day"]);
  assert.deepEqual(f({ kind: "balance", amount: 0, date: T }).problems, ["the account"], "a balance of 0 is a balance");
  assert.deepEqual(f({ kind: "note", text: "  " }).problems, ["the note"]);
  assert.deepEqual(f({ kind: "spend", amount: 50, date: T, payee: "Shop", accountId: "a-chk" }, "spent forty at the shop").warnings, ["This amount is not in your note as written: check it."]);
  assert.deepEqual(f({ kind: "spend", amount: 1200, date: T, payee: "Shop", accountId: "a-chk" }, "paid 1,200").warnings, []);
  assert.deepEqual(f({ kind: "spend", amount: 5, date: "2026-11-05", payee: "Shop", accountId: "a-chk" }).warnings, ["This day is in the future."]);
  assert.deepEqual(f({ kind: "reminder", name: "x", date: "2028-01-01" }).warnings, ["This day is more than a year away from today."]);
  assert.equal(f({ kind: "reminder", name: "x", date: T, repeat: "weekly" }).repeat, "none");
  assert.equal(Object.keys(KINDS).length, 5);
});

test("the question for the AI: people's and accounts' names swapped for stand-ins, accounts listed by them, today's date", () => {
  const p = plan();
  const q = buildPrompt("Ana spent $30 at the market with the Visa card; Bo got paid.", p, T);
  const user = q.messages[1].content;
  assert.ok(!/\b(Ana|Bo|Visa)\b/.test(user), user);
  assert.match(user, /NOTE: Adult 1 spent \$30 at the market with the credit card; Adult 2 got paid\./);
  assert.match(user, /ACCOUNTS: the checking account \(Checking\); the savings account/);
  assert.match(q.messages[0].content, /Today is 2026-10-31/);
  assert.match(q.messages[0].content, /Never guess an amount/);
  assert.ok(q.accounts.some((a) => a.alias === "the credit card" && a.id === "a-visa"));
  assert.match(buildPrompt("x", emptyPlan(), T).messages[1].content, /ACCOUNTS: none yet/);
});

test("the AI's answer read back: accounts from their stand-ins, names put back, each entry checked; no list is null", () => {
  const p = plan();
  const note = "Ana spent $30 at the market with the Visa card. Remind me to call Bo's dentist tomorrow.";
  const q = buildPrompt(note, p, T);
  const answer = `<think>ok</think>\`\`\`json
[{"kind":"spend","amount":30,"date":"2026-10-31","payee":"the market","account":"credit card"},
 {"kind":"reminder","name":"Call Adult 2's dentist","date":"2026-11-01","amount":null,"repeat":"none"},
 {"kind":"income","amount":999,"date":"2026-10-31","payee":"Lottery","account":"the savings account"},
 "not an entry"]
\`\`\``;
  const r = readAnswer(answer, p, T, note, q);
  assert.equal(r.length, 3, "a string is not an entry");
  assert.deepEqual([r[0].kind, r[0].accountId, r[0].payee, r[0].ready], ["spend", "a-visa", "the market", true]);
  assert.equal(r[1].name, "Call Bo's dentist", "the stand-in put back");
  assert.deepEqual(r[2].warnings, ["This amount is not in your note as written: check it."], "an amount the note never said is flagged");
  assert.equal(readAnswer("I could not read that.", p, T, note, q), null);
  assert.deepEqual(readAnswer("[]", p, T, note, q), []);
});

test("adding an entry: through the Ledger's, the Money calendar's and Account detail's own ways; nothing half-filled", () => {
  const p = plan();
  const [spend, rem, bal, inc, , note] = quickRead("Spent $42.17 at Corner Market yesterday. Remind me to pay the car registration of $85 on December 1. My savings is at 12,400. Got paid 1,950 today. x. Lunch out was nice.", p, T);
  let r = applyEntry(p, spend, { id: "n1", today: T });
  assert.deepEqual(r, { ok: true, text: "Spent: Corner Market", go: "transactions/ledger" });
  const t = p.transactions.find((x) => x.id === "n1");
  assert.deepEqual({ ...t, key: undefined }, { id: "n1", date: "2026-10-30", amount: -42.17, payee: "Corner Market", rawPayee: "Corner Market", accountId: "a-chk", category: "", tags: [], note: "from a voice note", key: undefined });
  assert.equal(t.key, txKey(t), "the Ledger's duplicate check");
  applyEntry(p, inc, { id: "n2", today: T });
  assert.equal(p.transactions.find((x) => x.id === "n2").amount, 1950, "money in is positive");
  r = applyEntry(p, rem, { id: "n3", today: T });
  assert.equal(r.go, "household/calendar");
  assert.deepEqual(p.reminders.find((x) => x.id === "n3"), { id: "n3", name: "Pay the car registration", date: "2026-12-01", repeat: "none", note: "from a voice note", amount: 85 });
  r = applyEntry(p, bal, { id: "n4", today: T });
  assert.deepEqual(r, { ok: true, text: "Balance saved and used on Net worth", go: "balance/accounts/a-sav" });
  const sav = p.accounts.find((a) => a.id === "a-sav");
  assert.deepEqual([sav.balance, sav.asOf, sav.history.at(-1)], [12400, T, { date: T, balance: 12400 }]);
  applyEntry(p, note, { today: T });
  applyEntry(p, finish({ kind: "note", text: "Second one" }, p, T), { today: T });
  assert.equal(p.notes, `${T}: Lunch out was nice.\n${T}: Second one`);
  assert.deepEqual(applyEntry(p, quickRead("spent 40 bucks", p, T)[0], { id: "n5", today: T }), { ok: false, text: "Fill in what is missing first." });
  assert.ok(!p.transactions.some((x) => x.id === "n5"));
});

test("compute: the accounts to pick from and the notes kept so far", () => {
  const p = plan();
  p.notes = "2026-10-01: hello";
  const d = compute(p);
  assert.equal(d.accounts.length, 10);
  assert.deepEqual(d.accounts[0], { id: "a-chk", name: "Chase checking", label: "Checking" });
  assert.equal(d.notes, "2026-10-01: hello");
  assert.deepEqual(compute(undefined).accounts, []);
});

test("days: whole month words only; a share, a name or a time that is no one day is not read as one; weeks; the 31st going back", () => {
  const d = (s, dir, t = T) => readDate(s, t, dir)?.date ?? null;
  // words that start like a month are not one ("market 3" is not March 3)
  assert.equal(d("Spent 20 at the market 3 days ago"), "2026-10-28");
  assert.equal(d("Spent 40 at the farmers market 2 days ago"), "2026-10-29");
  assert.equal(d("Paid 30 at decathlon 5 days ago"), "2026-10-26");
  assert.equal(d("paid $45 at Marshalls 3 days ago"), "2026-10-28");
  assert.equal(d("Paid $30 to the janitor 20 days ago."), "2026-10-11");
  assert.equal(d("decided 2 days ago to pay $40"), "2026-10-29");
  assert.equal(d("on Dec. 1", "future"), "2026-12-01");
  assert.equal(d("sept. 4", "future"), "2027-09-04");
  assert.equal(d("1 December", "future"), "2026-12-01");
  // a share and a name
  assert.equal(d("Paid 1/2 of the dinner, 40 dollars"), null, "1/2 of is a share, not January 2");
  assert.equal(d("paid 1/2 of the $1,200 rent"), null);
  assert.equal(d("Spent 30 at Friday's"), null, "Friday's is a name");
  // more relative words
  assert.equal(d("Remind me the day after tomorrow to call the bank", "future"), "2026-11-02");
  assert.equal(readDate("Remind me the day after tomorrow to call the bank", T, "future").match, "the day after tomorrow");
  assert.equal(d("next week", "future"), "2026-11-07");
  assert.equal(d("last week"), "2026-10-24");
  assert.equal(d("tonight"), T);
  assert.equal(d("Spent 40 at the dentist 2 weeks ago"), "2026-10-17");
  assert.equal(d("a week ago"), "2026-10-24");
  assert.equal(d("in 2 weeks", "future"), "2026-11-14");
  assert.equal(d("two days ago"), "2026-10-29");
  // a time that is not one day: asked for (""), never today
  assert.equal(d("Spent 900 at the airline last month"), "");
  assert.equal(d("a few days ago"), "");
  assert.equal(d("in a month", "future"), "");
  // "the 31st" in a month without one: the nearest month that has it, back for the past, ahead for a reminder
  assert.equal(d("Paid 1,800 for rent on the 31st", "past", "2026-05-15"), "2026-03-31");
  assert.equal(d("on the 30th", "past", "2026-03-10"), "2026-01-30", "February has no 30th");
  assert.equal(d("the 30th", "future", "2026-01-31"), "2026-03-30");
});

test("amounts: a number is read whole or not at all; counts, phone numbers and dates are no amount; a minus sign is kept", () => {
  const a = (s) => readAmount(s)?.amount ?? null;
  // the digits of a longer number, a percent, a time, a count or a date are never an amount on their own
  for (const s of ["The Visa card interest rate is 23.9%", "My savings account is 10 years old", "Paid 50 percent of the dinner bill", "for 15 minutes", "at 10 o'clock", "paid 40th",
    "Paid rent for 11/1 with checking", "spent $5.555", "spent 1,2345", "paid the sitter for 15 days", "we met at 12:30", "for 10 hours", "at 10 pm", "at 3 a.m", "rate is 25%",
    "Remind me to call the bank at 555-0134 tomorrow.", "spent 3 nights at the hotel", "paid for 2 tickets"]) assert.equal(a(s), null, s);
  assert.equal(a("Lunch for 4 people, paid 60 at Joe's."), 60, "the count is passed over, the amount after it found");
  assert.equal(a("My checking balance is -$120"), -120);
  assert.equal(a("is at −1,500"), -1500);
  assert.equal(a("spent 30 amazon"), 30, "\"am\" inside a word is no time");
  assert.deepEqual(readAmount("Bought shoes for 80 at Target"), { amount: 80, match: "80", phrase: "for 80" });
  assert.deepEqual(readAmount("the registration of $85"), { amount: 85, match: "$85", phrase: "of $85" });
});

test("accounts: the more exact kind words first, a name two accounts share is neither, a short name after the or my; money goes to an everyday account", () => {
  const p = plan();
  p.accounts.push({ id: "a-hsa", name: "HealthEquity", type: "hsa" }, { id: "a-stu", name: "Nelnet", type: "student_loan" });
  assert.equal(readAccount("My health savings account is at 3,000", p).id, "a-hsa", "not Ally savings");
  assert.equal(readAccount("My student loan is at 22,000", p).id, "a-stu", "not the car loan");
  assert.equal(readAccount("Spent 30 at Target with my debit card", p).id, "a-chk", "a debit card is the checking account");
  assert.equal(readAccount("Bought a $50 gift card at the mall", p), null, "a gift card is no account");
  assert.equal(readAccount("student loan", plan()), null, "no student loan in the plan: not the car loan");
  assert.equal(readAccount("the mortgage", p).id, "a-mort");
  assert.equal(readAccount("the auto loan", p).id, "a-car");
  assert.equal(readAccount("my brokerage", p).id, "a-brk");
  assert.equal(readAccount("the roth", p).id, "a-roth");
  assert.equal(readAccount("my HSA", p).id, "a-hsa");
  assert.equal(readAccount("Charged 200 to the visa for a flight", p).id, "a-visa", "\"the visa\" for Visa card");
  assert.equal(readAccount("Spent 20 on visa stamps", p), null, "a short name only after the, my or our");
  const twins = { accounts: [{ id: "s1", name: "Savings", type: "savings" }, { id: "s2", name: "Savings", type: "savings" }] };
  assert.equal(readAccount("Savings is at 5,000", twins), null, "two accounts of that name: the note does not say which");
  const used = plan();
  used.transactions = [{ id: "t", accountId: "a-visa" }, { id: "u", accountId: "a-visa" }, { id: "v", accountId: "a-chk" }];
  assert.equal(defaultAccount(used, "income").id, "a-chk", "money in never goes to a credit card");
  assert.equal(defaultAccount(used, "spend").id, "a-visa");
  assert.equal(defaultAccount({ accounts: [{ id: "l", type: "loan" }, { id: "h", type: "property" }] }, "spend"), null, "never a loan or a house");
  assert.equal(quickRead("Got paid 1,950 today", used, T)[0].accountId, "a-chk");
});

test("the plain rules: money in or out by what was done, balances only for a balance, who it was paid to without the amount or the account", () => {
  const p = plan();
  const one = (s, q = p, t = T) => { const [x] = quickRead(s, q, t); return [x.kind, x.amount, x.date, x.payee, x.accountId, x.ready]; };
  // a payment, a fee or a rate is no balance
  assert.deepEqual(one("The car loan payment is 410 a month").slice(0, 2), ["spend", 410]);
  assert.equal(quickRead("The car loan payment is 410 a month", p, T)[0].ready, false, "who it was paid to is asked for");
  assert.equal(one("The mortgage payment is 1,980")[0], "spend");
  assert.equal(one("My checking account fee is 12")[0], "note");
  assert.equal(one("The Visa card interest rate is 23.9%")[0], "note");
  assert.deepEqual(one("The balance on my Visa card is 6,400"), ["balance", 6400, T, "", "a-visa", true]);
  assert.deepEqual(one("My savings account is at 12,400"), ["balance", 12400, T, "", "a-sav", true]);
  assert.deepEqual(one("My Roth has 31,500"), ["balance", 31500, T, "", "a-roth", true]);
  assert.deepEqual(one("The mortgage is now 264,000"), ["balance", 264000, T, "", "a-mort", true]);
  assert.deepEqual(one("Brokerage stands at 18,250"), ["balance", 18250, T, "", "a-brk", true]);
  assert.deepEqual(one("My checking balance is -$120"), ["balance", -120, T, "", "a-chk", true], "an overdrawn account keeps its sign");
  // money in or out: what was paid out wins over "made", "deposit", "received"; "get paid" is money in
  assert.deepEqual(one("Made a payment of 200 to the dentist"), ["spend", 200, T, "Dentist", "a-chk", true]);
  assert.deepEqual(one("Paid a deposit of 500 for the apartment"), ["spend", 500, T, "Apartment", "a-chk", true]);
  assert.deepEqual(one("Received the electric bill and paid 120 to the power company"), ["spend", 120, T, "Power company", "a-chk", true]);
  assert.deepEqual(one("I get paid 1,950 on Friday"), ["income", 1950, "2026-10-30", "Paycheck", "a-chk", true]);
  assert.deepEqual(one("Got a refund of 30 from Target"), ["income", 30, T, "Target", "a-chk", true]);
  // who it was paid to: no money word, no account words, no day
  assert.deepEqual(one("Bought shoes at Target for 80"), ["spend", 80, T, "Target", "a-chk", true]);
  assert.deepEqual(one("Bought shoes for 80 at Target"), ["spend", 80, T, "Target", "a-chk", true]);
  assert.deepEqual(one("Paid 300 to the dentist from savings"), ["spend", 300, T, "Dentist", "a-sav", true]);
  assert.deepEqual(one("Spent 60 on my card at Target"), ["spend", 60, T, "Target", "a-visa", true]);
  assert.deepEqual(one("Charged 200 to the visa for a flight"), ["spend", 200, T, "Flight", "a-visa", true]);
  assert.deepEqual(one("Lunch for 4 people, paid 60 at Joe's."), ["spend", 60, T, "Joe's", "a-chk", true]);
  assert.deepEqual(one("Due to the rain, spent 20 on an umbrella"), ["spend", 20, T, "Umbrella", "a-chk", true], "\"due to\" is no reminder");
  assert.deepEqual(one("Paid the water bill, 60 dollars, on the 30th", p, "2026-03-10"), ["spend", 60, "2026-01-30", "Water bill", "a-chk", true]);
  assert.deepEqual(one("Paid 1,800 for rent on the 31st", p, "2026-05-15"), ["spend", 1800, "2026-03-31", "Rent", "a-chk", true]);
  // a month word inside a name, a share, a name with a weekday: no made-up day
  assert.deepEqual(one("Spent 20 at the market 3 days ago"), ["spend", 20, "2026-10-28", "Market", "a-chk", true]);
  assert.deepEqual(one("Paid 30 at decathlon 5 days ago"), ["spend", 30, "2026-10-26", "Decathlon", "a-chk", true]);
  assert.deepEqual(one("Spent 30 at Friday's"), ["spend", 30, T, "Friday's", "a-chk", true]);
  assert.equal(one("Paid 1/2 of the dinner, 40 dollars")[2], T);
  // a day the rules cannot read is asked for, and its words leave the payee
  assert.deepEqual(one("Spent 40 at the dentist 2 weeks ago"), ["spend", 40, "2026-10-17", "Dentist", "a-chk", true]);
  const vague = quickRead("Spent 900 at the airline last month", p, T)[0];
  assert.deepEqual([vague.date, vague.payee, vague.problems], ["", "Airline", ["the day"]]);
  // numbers that are no amount make no entry of money
  assert.equal(one("Paid the sitter for 15 days.")[0], "note");
  assert.equal(one("My savings account is 10 years old")[0], "note");
  assert.equal(one("Paid rent for 11/1 with checking")[0], "note");
  // the account named but fitting none (or two): asked for, never the usual one
  const hsa = quickRead("Spent 30 with my health savings card at the pharmacy", p, T)[0];
  assert.deepEqual([hsa.kind, hsa.accountId, hsa.problems], ["spend", "", ["the account"]]);
});

test("the plain rules: sentences (not at Dr. or Dec.), reminders, the sentence each entry came from, a long note read in parts, no accounts yet", () => {
  const p = plan();
  assert.deepEqual(sentencesOf("Paid $150 to Dr. Lee yesterday. Remind me to pay the phone bill on Dec. 1. I said no. Spent 30"), ["Paid $150 to Dr. Lee yesterday.", "Remind me to pay the phone bill on Dec. 1.", "I said no.", "Spent 30"]);
  const [lee, ...noMore] = quickRead("Paid $150 to Dr. Lee yesterday", p, T);
  assert.deepEqual([lee.kind, lee.amount, lee.date, lee.payee, noMore.length], ["spend", 150, "2026-10-30", "Dr. Lee", 0]);
  const dec = quickRead("Remind me to pay the phone bill on Dec. 1", p, T);
  assert.deepEqual(dec.map((x) => [x.kind, x.name, x.date]), [["reminder", "Pay the phone bill", "2026-12-01"]]);
  const after = quickRead("Remind me the day after tomorrow to call the bank", p, T)[0];
  assert.deepEqual([after.name, after.date], ["Call the bank", "2026-11-02"]);
  const due = quickRead("Due to the rain, spent 20 on an umbrella", p, T)[0];
  assert.equal(due.kind, "spend");
  const plumber = quickRead("Remind me to pay the plumber at 12:30 on Friday.", p, T)[0];
  assert.deepEqual([plumber.amount, plumber.name], [null, "Pay the plumber at 12:30"], "12:30 is a time, not $1");
  // a phone number (the repo's leak guard refuses a full 10-digit one, so a short 555 number stands in)
  const phone = quickRead("Remind me to call the bank at 555-0134 tomorrow.", p, T)[0];
  assert.deepEqual([phone.amount, phone.name], [null, "Call the bank at 555-0134"]);
  // each entry keeps the sentence it came from (a note made from it gets that sentence, not the whole note)
  const r = quickRead("Spent 40 bucks. Spent $42.17 at Corner Market yesterday. My savings is at 12,400.", p, T);
  assert.deepEqual(r.map((x) => x.source), ["Spent 40 bucks.", "Spent $42.17 at Corner Market yesterday.", "My savings is at 12,400."]);
  assert.equal(finish({ ...r[0], kind: "note", text: r[0].source }, p, T).text, "Spent 40 bucks.");
  // a long note: the first MAX_ENTRIES sentences now, the rest left for the next reading
  const long = Array.from({ length: 11 }, (_, i) => `Spent ${i + 1} dollars at Shop ${i + 1}.`).join(" ");
  assert.equal(quickRead(long, p, T).length, MAX_ENTRIES);
  assert.deepEqual(notePart(long).rest, ["Spent 11 dollars at Shop 11."]);
  const wordy = `${"Lunch out was nice. ".repeat(110)}Spent 50 at the end shop.`;
  assert.ok(notePart(wordy).rest.includes("Spent 50 at the end shop."));
  assert.equal(withoutSentences(long, notePart(long).read), "Spent 11 dollars at Shop 11.", "once every entry is handled, only what was not read stays");
  assert.equal(withoutSentences("Spent 1 at A.  Spent 2\n at B.\nSpent 3 at C.", ["Spent 2 at B."]), "Spent 1 at A.\nSpent 3 at C.", "spaces between the words may differ");
  // no accounts yet: a balance is still a balance, and asks for the account
  const none = quickRead("My savings is at 12,400. Spent 42 dollars at Corner Market yesterday", emptyPlan(), T);
  assert.deepEqual(none.map((x) => [x.kind, x.problems]), [["balance", ["the account"]], ["spend", ["the account"]]]);
});

test("an entry made safe: a balance keeps its sign, a padded day is trimmed, inherited names are no kind or repeat, the same one again is flagged", () => {
  const p = plan();
  const neg = finish({ kind: "balance", accountId: "a-chk", amount: -120, date: T }, p, T, "My checking balance is -$120");
  assert.deepEqual([neg.amount, neg.warnings, neg.ready], [-120, [], true], "an overdrawn account; 120 is in the note");
  applyEntry(p, neg, { today: T });
  assert.equal(p.accounts.find((a) => a.id === "a-chk").balance, -120);
  assert.equal(finish({ kind: "spend", amount: -30, date: T, payee: "Shop", accountId: "a-chk" }, p, T).amount, 30, "money spent is still positive");
  assert.equal(finish({ kind: "reminder", name: "Call the bank", date: "2026-11-01 " }, p, T).date, "2026-11-01");
  assert.equal(finish({ kind: "balance", accountId: "a-sav", amount: 12400, date: " 2026-10-31" }, p, T).date, T);
  assert.equal(finish({ kind: "reminder", name: "x", date: "2026-11-01", repeat: "toString" }, p, T).repeat, "none");
  assert.equal(finish({ kind: "reminder", name: "x", date: "2026-11-01", repeat: "__proto__" }, p, T).repeat, "none");
  const ctor = finish({ kind: "constructor" }, p, T);
  assert.deepEqual([ctor.kind, ctor.ready], ["note", false], "a note with nothing in it is not ready");
  // the same entry again (a note read twice): allowed, as on the Ledger, but flagged
  const note = "Spent 42 at Corner Market. Remind me to call the bank tomorrow. Lunch out was nice.";
  const [spend, rem, kept] = quickRead(note, p, T);
  assert.deepEqual([spend.warnings, rem.warnings, kept.warnings], [[], [], []]);
  applyEntry(p, spend, { id: "d1", today: T });
  applyEntry(p, rem, { id: "d2", today: T });
  applyEntry(p, kept, { today: T });
  const [again, remAgain, keptAgain] = quickRead(note, p, T);
  assert.deepEqual(again.warnings, ["This looks like one already in the Ledger. Check before adding."]);
  assert.deepEqual(remAgain.warnings, ["This looks like a reminder already on the Money calendar. Check before adding."]);
  assert.deepEqual(keptAgain.warnings, ["This note is already in the notes you kept."]);
  assert.equal(again.ready, true, "a warning never blocks Add");
});

test("the question for the AI: an account named after a person becomes its own stand-in, each account says whose it is; only the part read is sent", () => {
  const p = plan();
  const user = (note) => buildPrompt(note, p, T).messages[1].content;
  assert.match(user("Ana's 401(k) is at 90,000."), /NOTE: 401\(k\) 1 is at 90,000\./, "not \"Adult 1's 401(k)\"");
  assert.match(user("Bo's old 401(k) is at 45,000."), /NOTE: 401\(k\) 2 is at 45,000\./);
  const accounts = user("x");
  assert.match(accounts, /401\(k\) 1 \(401\(k\) \/ 403\(b\), belongs to Adult 1\)/);
  assert.match(accounts, /401\(k\) 2 \(401\(k\) \/ 403\(b\), belongs to Adult 2\)/);
  assert.match(accounts, /the checking account \(Checking\);/, "a shared account names no one");
  assert.match(user("rent is due on the 1st\nSpent 5 at the cafe"), /NOTE: rent is due on the 1st\. Spent 5 at the cafe\./, "each line read as a sentence");
  assert.ok(!user(`${"Lunch out was nice. ".repeat(110)}Spent 50 at the end shop.`).includes("end shop"), "what is not read now stays in the box (notePart)");
});

test("the AI's answer read back: a numbered stand-in, money with no account to the usual one, padded days, a repeat that is no repeat", () => {
  const p = plan();
  const note = "Ana's 401(k) is at 90,000.";
  const q = buildPrompt(note, p, T);
  assert.equal(readAnswer('[{"kind":"balance","account":"401(k) 1","amount":90000,"date":"2026-10-31"}]', p, T, note, q)[0].accountId, "a-401");
  assert.equal(readAnswer('[{"kind":"balance","account":"401(k) 2","amount":90000,"date":"2026-10-31"}]', p, T, note, q)[0].accountId, "a-bk401");
  assert.equal(readAnswer('[{"kind":"balance","account":"student loan","amount":20000,"date":"2026-10-31"}]', p, T, note, q)[0].accountId, "", "no student loan in the plan: not the car loan");
  const n2 = "Spent 42 at Corner Market yesterday. Remind me to call the bank tomorrow. My savings is at 12,400.";
  const q2 = buildPrompt(n2, p, T);
  const r = readAnswer('[{"kind":"spend","amount":42,"date":"2026-10-30","payee":"Corner Market","account":null},{"kind":"reminder","name":"Call the bank","date":"2026-11-01 "},{"kind":"balance","account":"the savings account","amount":12400,"date":" 2026-10-31"},{"kind":"reminder","name":"x","date":"2026-11-01","repeat":"toString"}]', p, T, n2, q2);
  assert.deepEqual([r[0].accountId, r[0].ready], ["a-chk", true], "the same account the plain rules would pick");
  assert.deepEqual([r[1].date, r[2].date, r[3].repeat], ["2026-11-01", T, "none"]);
  applyEntry(p, r[1], { id: "pad", today: T });
  assert.equal(p.reminders.find((x) => x.id === "pad").date, "2026-11-01", "kept with its day, so it shows on the Money calendar");
  assert.equal(applyEntry(p, r[2], { today: T }).ok, true);
});

test("the accounts to pick from: the kind only when the name does not say it; everyday accounts first for money", () => {
  const p = plan();
  assert.deepEqual(accountChoices(p, "spend").map((x) => x.label), ["Chase checking", "Ally savings", "Visa card (Credit card)", "Ana's 401(k)", "Bo's Roth IRA", "Bo's old 401(k)", "Brokerage", "House (Real estate)", "Mortgage", "Car loan (Personal / auto loan)"]);
  assert.deepEqual(accountChoices(p, "balance").map((x) => x.value), p.accounts.map((a) => a.id), "a balance: plan order");
  assert.deepEqual(accountChoices(emptyPlan(), "spend"), []);
});

test("days: last night, N days back, a part of the day, this past Friday; a time the rules cannot pin to one day is asked for, never today", () => {
  const p = plan();
  const d = (s, dir) => readDate(s, T, dir)?.date ?? null;
  const one = (s) => { const [x] = quickRead(s, p, T); return [x.kind, x.amount, x.date, x.payee, x.accountId, x.ready]; };
  // days the rules can read, and their words leave the payee
  assert.deepEqual(one("Spent 60 at Joe's last night"), ["spend", 60, "2026-10-30", "Joe's", "a-chk", true]);
  assert.deepEqual(one("Spent 20 at Target 10 days back"), ["spend", 20, "2026-10-21", "Target", "a-chk", true]);
  assert.deepEqual(one("Spent 20 at Target two weeks back"), ["spend", 20, "2026-10-17", "Target", "a-chk", true]);
  assert.deepEqual(one("Spent 10 at the cafe yesterday morning"), ["spend", 10, "2026-10-30", "Cafe", "a-chk", true]);
  assert.deepEqual(one("Spent 50 at the bar Friday night"), ["spend", 50, "2026-10-30", "Bar", "a-chk", true]);
  assert.deepEqual(one("Spent 300 at Costco this past Saturday"), ["spend", 300, "2026-10-24", "Costco", "a-chk", true], "today is Saturday: the one before");
  assert.deepEqual(one("Spent 18 at Chipotle earlier today"), ["spend", 18, T, "Chipotle", "a-chk", true]);
  assert.equal(d("3 nights ago"), "2026-10-28");
  assert.equal(d("this afternoon"), T);
  assert.equal(d("3 days from now", "future"), "2026-11-03");
  assert.equal(d("this coming Friday", "future"), "2026-11-06");
  // a time but not one day: the day is asked for and the words leave the payee
  for (const [s, payee] of [["Spent 40 at the dentist in September", "Dentist"], ["Spent 20 at Target this week", "Target"], ["Spent 20 at Target earlier this week", "Target"],
    ["Spent 40 at the store mid-October", "Store"], ["Spent 40 at the store in early October", "Store"], ["Spent 40 at the store September 2026", "Store"],
    ["Spent 80 at Costco over the weekend", "Costco"], ["Spent 40 at the store this past weekend", "Store"], ["Spent 40 at the store over the past few days", "Store"],
    ["Spent 40 at the store a few weeks back", "Store"], ["Spent 20 at the store earlier last week", "Store"], ["Spent 40 at the store at the end of the month", "Store"],
    ["Spent 18 at Chipotle earlier", "Chipotle"], ["Paid 100 for the kids' camp in June", "Kids' camp"]]) {
    const [x] = quickRead(s, p, T);
    assert.deepEqual([x.date, x.payee, x.problems, x.ready], ["", payee, ["the day"], false], s);
  }
  assert.equal(quickRead("My savings has 5,000 this month", p, T)[0].date, "", "a balance too");
  assert.deepEqual(quickRead("Remind me to renew the passport in March", p, T).map((x) => [x.name, x.date]), [["Renew the passport", ""]]);
  // what a payment is for is no day; nor is a month word inside a name, or "may" that is no month
  assert.deepEqual(one("Paid 1,200 for next year's insurance"), ["spend", 1200, T, "Next year's insurance", "a-chk", true]);
  assert.deepEqual(one("Paid 20 for last week's groceries"), ["spend", 20, T, "Last week's groceries", "a-chk", true]);
  assert.deepEqual(one("Spent 20 at May's Bakery"), ["spend", 20, T, "May's Bakery", "a-chk", true]);
  assert.deepEqual(one("Spent 20 at the Weekend Market"), ["spend", 20, T, "Weekend Market", "a-chk", true]);
  assert.equal(d("This may be wrong"), null);
  assert.equal(d("Spent 20 at Target"), null, "no time at all: the plain rules use today");
});

test("sentences end after Inc., Co., St. or Dr. when a new one starts; amounts after a money word first; \"due to\" a payee; kind words inside a name; whole sentences out of the box", () => {
  const p = plan();
  const all = (s) => quickRead(s, p, T).map((x) => [x.kind, x.amount, x.date, x.payee || x.name || x.text, x.ready]);
  // a word after a name ends the sentence when a new one starts (a capital, or a word a sentence starts with)
  assert.deepEqual(sentencesOf("Paid 50 to Acme Inc. Spent 20 at Target."), ["Paid 50 to Acme Inc.", "Spent 20 at Target."]);
  assert.deepEqual(all("Paid 50 to Acme Inc. Spent 20 at Target."), [["spend", 50, T, "Acme Inc.", true], ["spend", 20, T, "Target", true]]);
  assert.deepEqual(all("Paid 30 to Smith & Co. Spent 20 at Target."), [["spend", 30, T, "Smith & Co.", true], ["spend", 20, T, "Target", true]]);
  assert.deepEqual(all("Paid $150 to Lee, Dr. Remind me to call the bank tomorrow."), [["spend", 150, T, "Lee", true], ["reminder", null, "2026-11-01", "Call the bank", true]]);
  assert.deepEqual(all("Spent 25 at the vet on 5 Oak St. Lunch was nice."), [["spend", 25, T, "Vet on 5 Oak St.", true], ["note", null, "", "Lunch was nice.", true]]);
  assert.deepEqual(sentencesOf("paid 50 to acme inc. spent 20 at target."), ["paid 50 to acme inc.", "spent 20 at target."]);
  // ...and goes on when the words go on: a title before a name, Saint, a small letter after Inc.
  assert.deepEqual(sentencesOf("Paid 50 to Acme Inc. for the parts. Paid 20 at St. Mary's. Paid 20 to Mr. Brown"), ["Paid 50 to Acme Inc. for the parts.", "Paid 20 at St. Mary's.", "Paid 20 to Mr. Brown"]);
  // a count after for is passed over when a money word has a number
  assert.deepEqual(all("Dinner for 4, paid 60 at Joe's"), [["spend", 60, T, "Joe's", true]]);
  assert.deepEqual(all("Table for 2, spent 45 at Olive Garden"), [["spend", 45, T, "Olive Garden", true]]);
  assert.equal(readAmount("Dinner for 4, paid 60 at Joe's").amount, 60);
  assert.equal(readAmount("Bought shoes for 80 at Target").amount, 80, "no money word with a number: for 80");
  // "due to" a payee with a day is a reminder; "due to" as "because of" is not
  assert.deepEqual(all("Visa payment due to Chase on the 15th"), [["reminder", null, "2026-11-15", "Visa payment due to Chase", true]]);
  assert.deepEqual(all("The rent is due to the landlord on the 1st"), [["reminder", null, "2026-11-01", "The rent is due to the landlord", true]]);
  assert.equal(all("Due to the rain, spent 20 on an umbrella")[0][0], "spend");
  assert.equal(all("Due to a mistake, the bank charged 30 yesterday")[0][0], "spend");
  assert.equal(all("The game was cancelled due to rain")[0][0], "note");
  // a kind word followed by more of a name is part of the name: no account, and the payee keeps it
  const one = (s) => { const [x] = quickRead(s, p, T); return [x.payee, x.accountId]; };
  assert.deepEqual(one("Spent 30 at the Savings Mart"), ["Savings Mart", "a-chk"]);
  assert.deepEqual(one("Spent 15 at the card shop"), ["Card shop", "a-chk"]);
  assert.deepEqual(one("Spent 9 at the Roth Cafe"), ["Roth Cafe", "a-chk"]);
  assert.deepEqual(one("Spent 50 on a loan shark"), ["Loan shark", "a-chk"]);
  assert.deepEqual(one("Paid 25 for my checking fee"), ["Checking fee", "a-chk"]);
  assert.equal(readAccount("Spent 30 at the Savings Mart", p), null);
  assert.deepEqual(one("Spent 30 at the Savings Mart from savings"), ["Savings Mart", "a-sav"], "only the place that names the account is cut");
  assert.deepEqual(one("Paid my credit card bill, 300 dollars, from checking"), ["Credit card bill", "a-chk"]);
  assert.equal(readAccount("My Roth IRA has 31,500", p).id, "a-roth");
  assert.equal(readAccount("My card's balance is 1,000", p).id, "a-visa");
  // only whole sentences leave the box
  assert.equal(withoutSentences("Spent 20 at Target yesterday. Spent 20 at Target", ["Spent 20 at Target"]), "Spent 20 at Target yesterday.");
  assert.equal(withoutSentences("Spent 5 at Al. Spent 5 at A", ["Spent 5 at A"]), "Spent 5 at Al.");
  assert.equal(withoutSentences("Spent 5 at A. Spent 5 at A.", ["Spent 5 at A."]), "Spent 5 at A.", "one of two the same");
  assert.equal(withoutSentences("Paid 50 to Acme Inc. Spent 20 at Target.", ["Paid 50 to Acme Inc."]), "Spent 20 at Target.");
  assert.equal(withoutSentences("Spent 1 at A.", ["Spent 1 at"]), "Spent 1 at A.", "part of a sentence is not a sentence");
});

test("days: counted from today, the night before last, a fortnight, holidays; other time words are asked for and leave the payee, never today", () => {
  const p = plan();
  const one = (s) => { const [x] = quickRead(s, p, T); return [x.kind, x.date, x.payee || x.name, x.ready]; };
  const d = (s, dir) => readDate(s, T, dir)?.date ?? null;
  // "from today" is read before "today" alone
  assert.deepEqual(one("Remind me to pay rent two weeks from today"), ["reminder", "2026-11-14", "Pay rent", true]);
  assert.deepEqual(one("Remind me to pay rent 3 days from today"), ["reminder", "2026-11-03", "Pay rent", true]);
  assert.deepEqual(one("Remind me to pay rent 10 days from today"), ["reminder", "2026-11-10", "Pay rent", true]);
  assert.deepEqual(one("Remind me to pay rent a week from tomorrow"), ["reminder", "2026-11-08", "Pay rent", true]);
  assert.deepEqual(one("Remind me to pay rent twelve days from today"), ["reminder", "2026-11-12", "Pay rent", true]);
  assert.deepEqual(one("Remind me to cancel the gym 2 months from today"), ["reminder", "", "Cancel the gym", false], "months from today: no one day");
  // days the rules can read
  assert.deepEqual(one("Spent 40 at the dentist the night before last"), ["spend", "2026-10-29", "Dentist", true]);
  assert.deepEqual(one("Spent 40 at the dentist a fortnight ago"), ["spend", "2026-10-17", "Dentist", true]);
  assert.deepEqual(one("Spent 40 at the dentist twelve days ago"), ["spend", "2026-10-19", "Dentist", true]);
  assert.deepEqual(one("Spent 40 at the dentist twenty-one days ago"), ["spend", "2026-10-10", "Dentist", true], "not \"one day ago\"");
  assert.deepEqual(one("Spent 40 at the store the Friday before last"), ["spend", "2026-10-23", "Store", true]);
  assert.deepEqual(one("Spent 40 at the store Tuesday last week"), ["spend", "2026-10-20", "Store", true]);
  assert.deepEqual(one("Spent 40 at the dentist on the 15th of last month"), ["spend", "2026-09-15", "Dentist", true]);
  assert.deepEqual(one("Spent 40 at the bar late last night"), ["spend", "2026-10-30", "Bar", true]);
  assert.deepEqual(one("Spent 20 at Target an hour ago"), ["spend", T, "Target", true]);
  assert.deepEqual(one("Spent 20 at Target just now"), ["spend", T, "Target", true]);
  assert.equal(d("the Friday after next", "future"), "2026-11-13");
  assert.equal(d("Monday next week", "future"), "2026-11-02");
  // a holiday that is one day: the latest one for the past, the next one for a reminder
  assert.deepEqual(one("Spent 40 at the dentist on Christmas"), ["spend", "2025-12-25", "Dentist", true]);
  assert.deepEqual(one("Spent 40 at the dentist on Christmas Eve"), ["spend", "2025-12-24", "Dentist", true]);
  assert.deepEqual(one("Spent 300 at Best Buy on Black Friday"), ["spend", "2025-11-28", "Best Buy", true], "not last Friday");
  assert.deepEqual(one("Spent 40 last Thanksgiving at the store"), ["spend", "2025-11-27", "Store", true]);
  assert.deepEqual(one("Remind me to call mom on Mother's Day"), ["reminder", "2027-05-09", "Call mom", true]);
  assert.deepEqual(one("Remind me to buy the tree by Christmas"), ["reminder", "2026-12-25", "Buy the tree", true]);
  assert.deepEqual([d("on Easter 2024"), d("on Easter 2025"), d("on Easter 2026"), d("on Thanksgiving 2026"), d("on Memorial Day 2026"), d("on Labor Day 2026"), d("on Father's Day 2026"), d("on Good Friday 2026")],
    ["2024-03-31", "2025-04-20", "2026-04-05", "2026-11-26", "2026-05-25", "2026-09-07", "2026-06-21", "2026-04-03"]);
  assert.equal(d("on Halloween"), T, "today is Halloween");
  assert.equal(d("last Halloween"), "2025-10-31");
  // ...but a holiday that says what was bought, or what it was for, is no day
  assert.deepEqual(one("Spent 50 at the Halloween store"), ["spend", T, "Halloween store", true]);
  assert.deepEqual(one("Paid 30 for Halloween"), ["spend", T, "Halloween", true]);
  assert.deepEqual(one("Spent 300 at Best Buy on Black Friday deals"), ["spend", T, "Best Buy on Black Friday deals", true], "no weekday either");
  assert.deepEqual(one("Spent 80 at the Easter Sunday brunch"), ["spend", T, "Easter Sunday brunch", true]);
  assert.deepEqual(one("Spent 30 at the Spring Market"), ["spend", T, "Spring Market", true]);
  // a time the rules cannot pin to one day: asked for, and its words leave the payee
  for (const s of ["the week before last", "last summer", "in the fall", "the week prior", "within the last week", "the previous week", "ages ago", "a day or two ago", "3 days later",
    "the day before", "two days before payday", "2 months from now", "this spring", "the weekend before last", "that morning", "the same day", "on my birthday", "around Christmas",
    "in the fall of 2025", "two Fridays ago", "weeks ago", "the following Monday"]) {
    const [x] = quickRead(`Spent 40 at the dentist ${s}`, p, T);
    assert.deepEqual([x.date, x.payee, x.problems, x.ready], ["", "Dentist", ["the day"], false], s);
  }
  assert.deepEqual(quickRead("Spent 40 over the holidays at the mall", p, T).map((x) => [x.date, x.payee]), [["", "Mall"]]);
  assert.deepEqual(quickRead("Spent 40 earlier in the week at the store", p, T).map((x) => [x.date, x.payee]), [["", "Store"]]);
  assert.equal(readDate("Remind me to pay rent two weeks from today", T, "future").match, "two weeks from today");
});

test("sentences: a title after a name ends one before a new sentence; Prof., Corp. and a street that goes on a name stay in the payee", () => {
  const p = plan();
  const all = (s) => quickRead(s, p, T).map((x) => [x.kind, x.amount, x.date, x.payee || x.name || x.text, x.ready]);
  // "Lee, Dr." follows a name: a new sentence after it, whatever word starts it
  assert.deepEqual(all("Paid $150 to Lee, Dr. Rent is due on the 1st."), [["spend", 150, T, "Lee", true], ["reminder", null, "2026-11-01", "Rent is due", true]]);
  assert.deepEqual(all("Paid $150 to Lee, Dr. Tomorrow remind me to call the bank."), [["spend", 150, T, "Lee", true], ["reminder", null, "2026-11-01", "Call the bank", true]]);
  assert.deepEqual(all("Paid $150 to Lee, Dr. Yesterday I spent 20 at Target."), [["spend", 150, T, "Lee", true], ["spend", 20, "2026-10-30", "Target", true]]);
  assert.deepEqual(all("Paid $150 to Lee, Dr. Today I spent 20 at Target."), [["spend", 150, T, "Lee", true], ["spend", 20, T, "Target", true]]);
  assert.deepEqual(all("Paid $150 to Lee, Dr. Bo spent 20 at Target."), [["spend", 150, T, "Lee", true], ["spend", 20, T, "Target", true]]);
  assert.deepEqual(all("Paid $150 to Lee Dr. Rent is due on the 1st."), [["spend", 150, T, "Lee Dr.", true], ["reminder", null, "2026-11-01", "Rent is due", true]]);
  assert.deepEqual(all("Paid 50 to Lee, Dr. Kim and Bo"), [["spend", 50, T, "Lee", true]], "names that go on: one sentence");
  // a title before a name stays in the payee, Prof. as Dr.
  assert.deepEqual(all("Paid 30 to Prof. Kim. Spent 20 at Target."), [["spend", 30, T, "Prof. Kim", true], ["spend", 20, T, "Target", true]]);
  // a street: capitals that go on its name stay in the sentence, a new sentence does not
  assert.deepEqual(all("Paid 30 at the Main St. Cafe. Spent 20 at Target."), [["spend", 30, T, "Main St. Cafe", true], ["spend", 20, T, "Target", true]]);
  assert.deepEqual(all("Paid 30 at the Main St. Cafe for lunch. Spent 20 at Target."), [["spend", 30, T, "Main St. Cafe", true], ["spend", 20, T, "Target", true]]);
  assert.deepEqual(all("Paid 30 at the vet on Oak St. Target was busy."), [["spend", 30, T, "Vet on Oak St.", true], ["note", null, "", "Target was busy.", true]]);
  // a number after Corp. starts a new sentence, and that sentence stays in the box when the first is added
  const tax = "Paid 100 to Acme Corp. 50 of it was tax.";
  assert.deepEqual(all(tax), [["spend", 100, T, "Acme Corp.", true], ["note", null, "", "50 of it was tax.", true]]);
  assert.equal(withoutSentences(tax, ["Paid 100 to Acme Corp."]), "50 of it was tax.");
  assert.deepEqual(sentencesOf("Paid 20, approx. 30 with tip."), ["Paid 20, approx. 30 with tip."]);
});

test("accounts: an account's name inside another name is no account; a card, checking or savings followed by a small word is still the account", () => {
  const p = plan();
  const one = (s) => { const [x] = quickRead(s, p, T); return [x.payee, x.accountId, x.ready]; };
  // the family's accounts named Mortgage, Brokerage, House and Car loan, inside a payee
  assert.deepEqual(one("Spent 30 at the Mortgage Shop"), ["Mortgage Shop", "a-chk", true]);
  assert.deepEqual(one("Spent 30 at the Brokerage Bar"), ["Brokerage Bar", "a-chk", true]);
  assert.deepEqual(one("Paid 30 to Brokerage Partners for advice"), ["Brokerage Partners", "a-chk", true]);
  assert.deepEqual(one("Spent 30 at House of Pancakes"), ["House of Pancakes", "a-chk", true]);
  assert.deepEqual(one("Spent 20 at the Car loan office"), ["Car loan office", "a-chk", true]);
  assert.deepEqual(one("Paid 30 to the house cleaner"), ["House cleaner", "a-chk", true]);
  assert.deepEqual(one("Paid 1,980 to the mortgage company"), ["Mortgage company", "a-chk", true]);
  assert.equal(readAccount("Spent 30 at the Mortgage Shop", p), null);
  assert.equal(readAccount("Paid 300 to the mortgage", p).id, "a-mort", "the mortgage itself is still the account");
  // two accounts: the one the money came out of
  assert.deepEqual(one("Paid the mortgage from checking, 1,980 dollars"), ["Mortgage", "a-chk", true]);
  // a card, savings or checking followed by a small word, a number or someone: still that account, never the usual one
  for (const s of ["Spent 30 at Target on my card again", "Spent 30 at Target on my card too", "Spent 30 at Target on my card online", "Spent 30 at Target on my card first",
    "Spent 30 at Target on my card while shopping", "Spent 30 at Target with the card ending 1234", "Spent 30 at Target on the credit card I share with Bo",
    "Spent 30 at Target on the card my wife uses", "Spent 20 at Target on my card again"]) assert.deepEqual(one(s).slice(0, 2), ["Target", "a-visa"], s);
  assert.deepEqual(one("Spent 30 at Target from savings just now"), ["Target", "a-sav", true]);
  assert.equal(quickRead("Spent 30 at Target from savings just now", p, T)[0].date, T);
});

test("the plain rules: \"due to\" with a day gone by or something that happened is no reminder; a fee with a deposit is money out; a count before what was done is no payee", () => {
  const p = plan();
  const all = (s) => quickRead(s, p, T).map((x) => [x.kind, x.amount, x.date]);
  assert.deepEqual(all("The game was cancelled due to rain last Friday"), [["note", null, ""]]);
  assert.deepEqual(all("Due to a refund, my balance dropped yesterday"), [["note", null, ""]]);
  assert.deepEqual(all("Late fee of 25 due to the late payment yesterday"), [["spend", 25, "2026-10-30"]]);
  assert.deepEqual(all("Overdraft fee of 35 due to a late deposit yesterday"), [["spend", 35, "2026-10-30"]]);
  assert.deepEqual(all("The game was cancelled due to rain on Friday"), [["note", null, ""]]);
  assert.deepEqual(all("Payment due to Chase last month"), [["note", null, ""]]);
  // still a reminder: a day from today on, nothing done yet (a name such as United is no verb)
  assert.deepEqual(all("Card payment due to United on the 1st"), [["reminder", null, "2026-11-01"]]);
  assert.deepEqual(all("The tax bill is due to the IRS in April"), [["reminder", null, ""]]);
  // dictation without commas: the count before "paid" is the table's, not who was paid
  const pay = (s) => quickRead(s, p, T).map((x) => [x.kind, x.amount, x.payee, x.ready]);
  assert.deepEqual(pay("dinner for 4 paid 60 at Joe's"), [["spend", 60, "Joe's", true]]);
  assert.deepEqual(pay("table for 2 spent 45 at Olive Garden"), [["spend", 45, "Olive Garden", true]]);
  assert.deepEqual(pay("Dinner for 4 cost 60 at Joe's"), [["spend", 60, "Joe's", true]]);
  assert.deepEqual(pay("Lunch for 3: paid 45 at Joe's"), [["spend", 45, "Joe's", true]]);
  assert.deepEqual(pay("Spent 30 at 7 Eleven"), [["spend", 30, "7 Eleven", true]], "a name that starts with a number stays");
  assert.deepEqual(pay("Spent 50 on the 4th of July at the lake"), [["spend", 50, "Lake", true]]);
});
