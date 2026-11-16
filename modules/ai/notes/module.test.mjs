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
  // a card's rate describes the debt (gap next-60 #59): the debt in the plan is updated, after a tap (a payment a month
  // alone is no debt sentence, fix round 1: the line above reads as before)
  assert.equal(one("The mortgage payment is 1,980")[0], "spend");
  assert.equal(one("My checking account fee is 12")[0], "note");
  { const [x] = quickRead("The Visa card interest rate is 23.9%", p, T); assert.deepEqual([x.kind, x.accountId, x.rate, x.owed, x.payment, x.ready], ["debt", "a-visa", 0.239, null, null, true]); }
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

test("the plain rules keep every entry and its sign: a name runs on only into words with no number; a fee not charged; 'due to' read from the words before it; 'card games' is a thing bought", () => {
  const T = "2026-10-31", p = familyPlan(T);
  const read = (n) => quickRead(n, p, T).map((e) => [e.kind, e.amount ?? null, e.accountId || null]);
  // after "Lee, Dr." or a street, a sentence with an amount or a day of its own is its own entry (no entry lost or re-dated)
  assert.deepEqual(read("Paid 150 to Lee, Dr. Went to Target and spent 20."), [["spend", 150, "a-chk"], ["spend", 20, "a-chk"]]);
  assert.deepEqual(read("Paid 150 to Lee, Dr. Bo and I spent 20 at Target."), [["spend", 150, "a-chk"], ["spend", 20, "a-chk"]]);
  assert.deepEqual(quickRead("Paid 150 to Lee, Dr. Need to pay rent on the 1st.", p, T).map((e) => [e.kind, e.date || null]), [["spend", T], ["note", null]]);
  assert.deepEqual(read("Paid 30 at 12 Main St. Went to Target and spent 20."), [["spend", 30, "a-chk"], ["spend", 20, "a-chk"]]);
  assert.equal(quickRead("Spent 12 at the Main St. Cafe for lunch.", p, T)[0].payee, "Main St. Cafe");   // a name with no number goes on
  // a deposit that says no fee was charged is money in
  assert.deepEqual(read("Deposited my paycheck of 1,950, no fees this time"), [["income", 1950, "a-chk"]]);
  assert.deepEqual(read("Deposit of 500 at the ATM, the fee was waived"), [["income", 500, "a-chk"]]);
  assert.deepEqual(read("Mobile deposit of 200, fee free"), [["income", 200, "a-chk"]]);
  // "due to": only a verb before it says the thing already happened
  for (const n of ["Rent is due to the landlord on the 1st, as discussed", "Visa payment due to Chase on the 15th, it is automated", "The deferred payment is due to the bank on the 1st", "Payment of 300 due to Chase on the 15th, autopay is turned off"]) assert.equal(quickRead(n, p, T)[0].kind, "reminder", n);
  assert.equal(quickRead("Flight cancelled due to rain on Friday", p, T)[0].kind, "note");
  // a card, checking or savings followed by an everyday word is a thing bought, unless my, our, from, with... point at the account
  assert.deepEqual(read("Spent 30 on card games at Target"), [["spend", 30, "a-chk"]]);
  assert.deepEqual(read("Spent 30 on the card table at Ikea"), [["spend", 30, "a-chk"]]);
  assert.deepEqual(read("Spent 20 on savings jars at Target"), [["spend", 20, "a-chk"]]);
  assert.deepEqual(read("Spent 30 at Target on my card again"), [["spend", 30, "a-visa"]]);
  assert.deepEqual(read("Spent 30 at Target from savings just now"), [["spend", 30, "a-sav"]]);
  assert.deepEqual(read("Spent 40 at Target on the credit card"), [["spend", 40, "a-visa"]]);
});

test("a day the note talks about but the rules cannot read is asked for, never taken as today", () => {
  const T = "2026-10-31", p = familyPlan(T);
  for (const n of ["Spent 40 at the dentist 2 weeks before", "Spent 40 at the dentist a month ago today", "Spent 40 at the dentist on the first of the month", "Spent 40 at the dentist on Veterans Day", "Spent 40 at the dentist on St. Patrick's Day", "Spent 40 at the dentist on Juneteenth"]) {
    const [x] = quickRead(n, p, T);
    assert.deepEqual([x.kind, x.date, x.ready], ["spend", "", false], n);
  }
  // a day it reads, or none at all, as before
  assert.equal(quickRead("Spent 40 at the dentist 2 weeks ago", p, T)[0].date, "2026-10-17");
  assert.equal(quickRead("Spent 40 at the store the Friday before last", p, T)[0].date, "2026-10-23");
  assert.equal(quickRead("Spent 40 on Amazon", p, T)[0].date, T);
  assert.equal(quickRead("Paid 1,200 for next year's insurance", p, T)[0].date, T);
});

test("after my, our, from or with, a card, checking or savings is the household's own, whatever word follows", () => {
  const T = "2026-10-31", p = familyPlan(T);
  assert.equal(quickRead("Spent 30 at Target on my card Black Friday", p, T)[0].accountId, "a-visa");
  assert.equal(quickRead("Spent 30 at Target on my card Christmas Eve", p, T)[0].accountId, "a-visa");
  assert.equal(quickRead("Spent 30 at Target with my checking debit", p, T)[0].accountId, "a-chk");
  assert.equal(quickRead("Bought groceries at the Savings Mart for 40", p, T)[0].payee, "Savings Mart");   // a place, not the account
});

test("a reminder's name stops at its day when a remark follows after a comma", () => {
  const T = "2026-10-31", p = familyPlan(T);
  assert.equal(quickRead("Rent is due to the landlord on the 1st, as discussed", p, T)[0].name, "Rent is due to the landlord");
  assert.equal(quickRead("Visa payment due to Chase on the 15th, it is automated", p, T)[0].name, "Visa payment due to Chase");
  assert.equal(quickRead("Remind me to buy milk, eggs and bread tomorrow", p, T)[0].name, "Buy milk eggs and bread");   // a comma before the day stays
});

// ---------------------------------------------------------------- gap next-60 #59 (2026-11-16): invariance
// A note that says nothing about debts reads exactly as before. Over every invented household (qa/fixtures/*-plan.mjs,
// the 14 households, the phone-built ones, the empty plan), the page's compute(), the plain rules (quickRead) on every
// note of the corpus (the notes this file's tests used at dca545e, and since fix round 1 eighteen more with a card or
// loan word and a payment a month, none of them a debt sentence: the test below the digests says so), the AI question
// for each (buildPrompt), fixed AI answers read back (readAnswer) and every ready entry
// added (applyEntry) give the very output they gave at dca545e: a digest per plan written down from that commit's code
// (invariance.json). To write them again after a deliberate change: PRINT=1 node --test modules/ai/notes/module.test.mjs
import * as NOTES from "./compute.js";
const INV_T = "2026-11-16";
async function invariancePlans() {
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath, pathToFileURL } = await import("node:url");
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(INV_T) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out.map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
}
const INV = JSON.parse((await import("node:fs")).readFileSync(new URL("./invariance.json", import.meta.url), "utf8"));
async function invarianceDigests() {
  const crypto = await import("node:crypto");
  const dig = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("base64url").slice(0, 22);
  // fixed answers of the AI helper: money, a reminder, a balance, a note, a kind it does not know, a debt (not asked for)
  const ANSWERS = [
    `[{"kind":"spend","amount":42.17,"date":"${INV_T}","payee":"Corner Market","account":null},{"kind":"reminder","name":"Pay the car registration","date":"2026-12-01","amount":85,"repeat":"yearly"}]`,
    `[{"kind":"balance","account":"the checking account","amount":12400,"date":"${INV_T}"},{"kind":"note","text":"Adult 1 likes the new budget"},{"kind":"debt","name":"Visa","owed":4000,"rate":24,"payment":300}]`,
    "no list here",
  ];
  const out = {};
  for (const { name, plan } of await invariancePlans()) {
    const draft = structuredClone(plan);
    let n = 0;
    const reads = [], prompts = [], applied = [];
    for (const note of INV.corpus) {
      const got = NOTES.quickRead(note, plan, INV_T);
      reads.push(got);
      const q = NOTES.buildPrompt(note, plan, INV_T);
      prompts.push(q.messages.map((m) => m.content).join("\n"));
      for (const p of got) if (p.ready) applied.push(NOTES.applyEntry(draft, p, { id: `v${++n}`, today: INV_T }));
    }
    const q = NOTES.buildPrompt(INV.corpus[0], plan, INV_T);
    const answers = ANSWERS.map((a) => NOTES.readAnswer(a, plan, INV_T, INV.corpus[0], q));
    out[name] = dig({ compute: NOTES.compute(plan), reads, prompts, answers, applied, plan: { transactions: draft.transactions, reminders: draft.reminders, accounts: draft.accounts, notes: draft.notes, debts: draft.debts } });
  }
  return out;
}
test("invariance: a note with no debt in it reads, asks, answers and adds exactly as at dca545e, in every invented household", async () => {
  const now = await invarianceDigests();
  if (process.env.PRINT) {
    (await import("node:fs")).writeFileSync(new URL("./invariance.json", import.meta.url), `${JSON.stringify({ note: INV.note, corpus: INV.corpus, plans: now }, null, 1)}\n`);
    return;
  }
  assert.ok(Object.keys(now).length >= 30, "the invented households are all here");
  assert.deepEqual(Object.keys(now).sort(), Object.keys(INV.plans).sort(), "the same households as at dca545e");
  for (const [k, v] of Object.entries(now)) assert.equal(v, INV.plans[k], `${k}: a note with no debt reads as before`);
});

// ---------------------------------------------------------------- gap next-60 #59 (2026-11-16): a debt plan from a spoken description
import { numberWords, isDebtSentence, readDebts, finishDebt, applyDebts, matchDebt, matchOf, repeats, debtName, debtType, missingWords, unplacedWords, paidWords, doneWords, notAddedWords, twiceWords, leftWords, undoWords, payoffLine, payoffWords, debtSentences, DEBT_TYPES } from "./compute.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { guessedPlan } from "../../../qa/fixtures/guessed-plan.mjs";
import { isGuess } from "../../../core/estimate/index.js";
import { changesOf, takeBack } from "../../../core/ui/undo.js";
import { compute as debtsPage } from "../../balance/liabilities/compute.js";
import { compute as payoffPage } from "../../debt/payoff/compute.js";
const EXAMPLE = "I owe about four thousand on my Visa at 24 percent and twelve thousand on the car at 6, paying 300 and 410 a month";
const D = (x) => ({ kind: x.kind, name: x.name, type: x.type, owed: x.owed, rate: x.rate, payment: x.payment, accountId: x.accountId, missing: x.missing, problems: x.problems, ready: x.ready });
const counter = () => { let n = 0; return () => `t${++n}`; };
// applyDebts' result: every list, empty unless given
const R = (o) => ({ added: [], updated: [], bare: [], guessed: [], dropped: [], later: [], repeated: [], ...o });
// our guesses as the app makes them (core/app.js ctx.guess): the guesses page's estimators and tables, on the plan given
import * as EST from "../../../core/estimate/index.js";
import { estimators as GUESS_EST, TABLES as GUESS_TABLES } from "../../overview/guesses/compute.js";
const guess = (k, { plan: on, ...o } = {}) => EST.estimate(on, k, { estimators: GUESS_EST, tables: GUESS_TABLES, today: T, ...o });

test("the example sentence: two debts to check, each with its name, kind, what is owed, the rate and the payment", () => {
  const got = quickRead(EXAMPLE, emptyPlan(), T);
  assert.deepEqual(got.map(D), [
    { kind: "debt", name: "Visa", type: "credit", owed: 4000, rate: 0.24, payment: 300, accountId: "", missing: [], problems: [], ready: true },
    { kind: "debt", name: "Car loan", type: "loan", owed: 12000, rate: 0.06, payment: 410, accountId: "", missing: [], problems: [], ready: true },
  ]);
  assert.equal(got[0].source, EXAMPLE, "each debt keeps the sentence it came from");
  assert.deepEqual(got[0].warnings, [], "every figure is in the note as said");
  assert.equal(isDebtSentence(EXAMPLE), true);
  assert.deepEqual(debtSentences(EXAMPLE, T), [EXAMPLE]);
  // in a plan that has them, the same note updates the Visa card and the Car loan instead of adding two more
  assert.deepEqual(quickRead(EXAMPLE, renterDebtPlan(), T).map((x) => [x.name, x.accountId, x.owed, x.rate, x.payment]), [["Visa card", "setup-owe-credit", 4000, 0.24, 300], ["Car loan", "setup-owe-car-loan", 12000, 0.06, 410]]);
});

test("numbers said in words: units, tens, hundreds, thousands, halves and points; a lone 'one' or 'a', a day and a plan's name stay", () => {
  const w = (s) => numberWords(s);
  assert.equal(w("four thousand"), "4000");
  assert.equal(w("twenty-four percent"), "24 percent");
  assert.equal(w("three hundred and ten a month"), "310 a month");
  assert.equal(w("twelve hundred"), "1200");
  assert.equal(w("a hundred and fifty"), "150");
  assert.equal(w("two thousand and five hundred"), "2500");
  assert.equal(w("paying three hundred and four hundred ten"), "paying 300 and 410", "two numbers, not 30,410");
  assert.equal(w("six and a half percent"), "6.5 percent");
  assert.equal(w("four and a half thousand"), "4500");
  assert.equal(w("twenty four point nine nine percent"), "24.99 percent");
  assert.equal(w("zero percent for a year"), "0 percent for a year");
  assert.equal(w("one percent"), "1 percent");
  assert.equal(w("twelve grand, 12k, $4.5 thousand, 1.2 million"), "12000, 12000, $4500, 1200000");
  assert.equal(w("the one on the car"), "the one on the car", "a lone 'one' is no number");
  assert.equal(w("300 a month"), "300 a month", "'a month' is no number");
  assert.equal(w("due the twenty fifth"), "due the twenty fifth", "a day said in words is left");
  assert.equal(w("my 401k loan"), "my 401k loan", "a plan's name is no 401,000");
  // a whole note in words
  const [x] = quickRead("We owe two hundred fifty thousand on the house at six and a half percent, paying nineteen hundred a month", emptyPlan(), T);
  assert.deepEqual(D(x), { kind: "debt", name: "Mortgage", type: "mortgage", owed: 250000, rate: 0.065, payment: 1900, accountId: "", missing: [], problems: [], ready: true });
  assert.deepEqual(x.warnings, [], "figures said in words are in the note as written");
});

test("a missing rate or payment: the one said is kept with our guess for the other, said before the tap; with no guess, said as not kept", () => {
  const note = "I owe 4,000 on my Visa, paying 120 a month";
  const [x] = quickRead(note, emptyPlan(), T);
  assert.deepEqual([x.owed, x.rate, x.payment, x.missing, x.canGuess, x.ready], [4000, null, 120, ["rate"], false, true]);
  // no guess at hand (plain rules alone, or a plan outside US dollars): the payment said cannot be kept, and that is said
  assert.equal(missingWords(x), "You did not say the interest rate. Tap Edit to type it: the Debts page needs it with the $120 payment, so without it the $120 payment is not kept.");
  const bare = emptyPlan();
  const r0 = applyDebts(bare, [x], { id: counter(), today: T });
  assert.deepEqual(r0, R({ added: ["Visa"], dropped: [{ name: "Visa", what: "payment", value: 120 }] }));
  assert.deepEqual(bare.accounts, [{ id: "t1", name: "Visa", type: "credit", institution: "", balance: 4000, asOf: T, ownerId: "", history: [], notes: "from a voice note" }]);
  assert.deepEqual(bare.debts, [], "no rate and payment of $0: Debts shows it as needing its details");
  assert.equal(debtsPage(bare, { today: T }).rows[0].detail, null);
  assert.equal(doneWords(r0), "Added Visa to your debts. Visa's $120 payment is not kept: the Debts page needs the interest rate with it.");
  // with our guesses (the app's ctx.guess): the payment is kept and the rate is our guess, marked, as Debts does for a box left blank
  const y = finishDebt(x, emptyPlan(), note, { guess, today: T });
  assert.equal(y.canGuess, true);
  assert.equal(missingWords(y), "You did not say the interest rate. Tap Edit to type it, or add it now: the $120 payment is kept, and the rate is our guess until you type yours.");
  const draft = emptyPlan();
  const r = applyDebts(draft, [y], { id: counter(), today: T, guess });
  const rate = guess("debt.credit.rate", { plan: draft, path: "debts[t2].rate" }).value;
  assert.deepEqual(r, R({ added: ["Visa"], guessed: [{ name: "Visa", what: "rate", value: rate }] }));
  assert.deepEqual([draft.debts[0].rate, draft.debts[0].minPayment], [rate, 120]);
  assert.equal(isGuess(draft, "debts[t2].rate"), true, "the rate is our guess");
  assert.equal(isGuess(draft, "debts[t2].minPayment"), false, "the payment said is the person's");
  assert.deepEqual(debtsPage(draft, { today: T }).rows[0].guessed, ["rate"], "Debts says the rate is our guess");
  assert.equal(doneWords(r), "Added Visa to your debts. Visa's interest rate is our guess for now: type the real one on the Debts page.");
  // the page's own example (fix round 1, person F2): the 24% said is kept, the payment is our guess, 1% of 4,000 + 4,000 x 24% / 12 = $120
  const n2 = "I owe 4,000 on my Visa at 24 percent";
  const v = finishDebt(quickRead(n2, emptyPlan(), T)[0], emptyPlan(), n2, { guess, today: T });
  assert.equal(missingWords(v), "You did not say the monthly payment. Tap Edit to type it, or add it now: the 24% is kept, and the payment is our guess until you type yours.");
  const d2 = emptyPlan(), r2 = applyDebts(d2, [v], { id: counter(), today: T, guess });
  assert.deepEqual([d2.debts[0].rate, d2.debts[0].minPayment, isGuess(d2, "debts[t2].rate"), isGuess(d2, "debts[t2].minPayment")], [0.24, 120, false, true]);
  assert.equal(doneWords(r2), "Added Visa to your debts. Visa's monthly payment is our guess for now: type the real one on the Debts page.");
  // a kind with no guess for the payment worked out from the plan (a student loan): said before the tap, and after
  const n3 = "I owe 18,000 on my student loan at 5.5 percent";
  const s3 = finishDebt(quickRead(n3, emptyPlan(), T)[0], emptyPlan(), n3, { guess, today: T });
  assert.equal(s3.canGuess, false);
  assert.equal(missingWords(s3), "You did not say the monthly payment. Tap Edit to type it: the Debts page needs it with the 5.5%, so without it the 5.5% is not kept.");
  const r3 = applyDebts(emptyPlan(), [s3], { id: counter(), today: T, guess });
  assert.deepEqual(r3.dropped, [{ name: "Student loan", what: "rate", value: 0.055 }]);
  assert.equal(doneWords(r3), "Added Student loan to your debts. Student loan's 5.5% is not kept: the Debts page needs the monthly payment with it.");
  // the other cases of the line
  assert.equal(missingWords({ missing: ["rate", "payment"] }), "You did not say the interest rate or the monthly payment. Tap Edit to type them, or add it now: the Debts page will ask for both.");
  assert.equal(missingWords({ missing: [] }), "");
  assert.equal(doneWords(R({ added: ["A", "B"], bare: ["A", "B"] })), "Added A and B to your debts. A and B have no rate or payment yet: give them on the Debts page.");
  assert.equal(doneWords(R({ added: ["A", "B"], guessed: [{ name: "A", what: "payment" }, { name: "B", what: "payment" }] })), "Added A and B to your debts. The monthly payments of A and B are our guesses for now: type the real ones on the Debts page.");
  // a debt with no name, or nothing owed, is held back and says what it needs
  const [z] = quickRead("I owe 4,000 at 24 percent", emptyPlan(), T);
  assert.deepEqual([z.name, z.problems, z.ready], ["", ["what it is called"], false]);
  assert.deepEqual(applyDebts(emptyPlan(), [z], { id: counter(), today: T }), R({}), "a debt not ready is never added");
  // in a debt already in the plan, a figure not said keeps the plan's own: nothing is missing
  const [w] = quickRead("My Visa is at 26 percent now", renterDebtPlan(), T);
  assert.deepEqual([w.accountId, w.owed, w.rate, w.payment, w.missing, w.ready], ["setup-owe-credit", null, 0.26, null, [], true]);
});

test("updated only when something was written (fix round 1, money F3, F4): a rate with no loan detail, a balance dated later", () => {
  const plan = () => ({ ...emptyPlan(), accounts: [{ id: "a1", name: "Visa", type: "credit", institution: "", balance: 2500, asOf: "2026-11-01", ownerId: "", history: [], notes: "" }, { id: "a2", name: "Car loan", type: "loan", institution: "", balance: 9000, asOf: "2026-12-01", ownerId: "", history: [], notes: "" }], debts: [{ id: "d2", accountId: "a2", rate: 0.05, minPayment: 300, extra: 0 }] });
  const note = "my Visa is at 26 percent now";
  // with our guess for the payment: the 26% goes in, the payment is ours, and it is updated
  const p = plan(), x = finishDebt(quickRead(note, p, T)[0], p, note, { guess, today: T });
  assert.deepEqual([x.accountId, x.rate, x.missing, x.canGuess, x.ready], ["a1", 0.26, ["payment"], true, true]);
  const r = applyDebts(p, [x], { id: counter(), today: T, guess });
  assert.deepEqual([r.updated, r.guessed.map((g) => g.what)], [["Visa"], ["payment"]]);
  assert.deepEqual([p.debts[1].rate, isGuess(p, "debts[t1].minPayment")], [0.26, true]);
  assert.equal(doneWords(r), "Updated Visa. Visa's monthly payment is our guess for now: type the real one on the Debts page.");
  // no guess (outside US dollars, or no estimate): nothing it could keep, so it is held back before the tap
  const q = plan(), held = finishDebt(quickRead(note, q, T)[0], q, note);
  assert.deepEqual([held.problems, held.missing, held.ready], [["its payment a month too"], [], false]);
  // and an entry that reaches the add with no guess writes nothing and is not called updated
  const before = JSON.stringify(q), r2 = applyDebts(q, [{ ...held, problems: [], ready: true }], { id: counter(), today: T });
  assert.equal(JSON.stringify(q), before, "the plan is as it was");
  assert.deepEqual(r2, R({ dropped: [{ name: "Visa", what: "rate", value: 0.26 }] }));
  assert.equal(doneWords(r2), "Visa's 26% is not kept: the Debts page needs the monthly payment with it.");
  // a balance on file dated after today stays: today's point is kept, and that is said, not "Updated"
  const c = plan(), car = quickRead("I owe 12000 on the car", c, T)[0];
  const r3 = applyDebts(c, [car], { id: counter(), today: T });
  assert.deepEqual(r3, R({ later: [{ name: "Car loan", owed: 12000, onFile: 9000, asOf: "2026-12-01" }] }));
  assert.deepEqual([c.accounts[1].balance, c.accounts[1].history], [9000, [{ date: T, balance: 12000 }]]);
  assert.equal(doneWords(r3), "Car loan's $12,000 is kept for today, but the plan goes on using the balance dated 12/1/2026 ($9,000), which is later.");
  // said with a rate too: the rate is written, so it is updated, and the later balance is said
  const r4 = applyDebts(plan(), [quickRead("I owe 12000 on the car at 7 percent", plan(), T)[0]], { id: counter(), today: T });
  assert.equal(doneWords(r4), "Updated Car loan. Car loan's $12,000 is kept for today, but the plan goes on using the balance dated 12/1/2026 ($9,000), which is later.");
});

test("an older plan's guess flags on a loan detail go when the figure is said, even equal to the guess (money F5: not real, pinned)", () => {
  const p = { ...emptyPlan(), accounts: [{ id: "a1", name: "Visa card", type: "credit", institution: "", balance: 2500, asOf: "2026-11-01", ownerId: "", history: [], notes: "" }], debts: [{ id: "d1", accountId: "a1", rate: 0.2, rateGuessed: 0.2, minPayment: 60, paymentGuessed: 60, extra: 0 }] };
  assert.equal(isGuess(p, "debts[d1].rate"), true);
  const [x] = quickRead("My Visa card is at 20 percent, paying 60 a month", p, T);
  applyDebts(p, [x], { id: counter(), today: T });
  assert.deepEqual(p.debts[0], { id: "d1", accountId: "a1", rate: 0.2, minPayment: 60, extra: 0 }, "clearGuess drops rateGuessed and paymentGuessed");
  assert.equal(isGuess(p, "debts[d1].rate"), false);
  assert.equal(isGuess(p, "debts[d1].minPayment"), false);
});

test("one debt, one entry (money F7, F8): a repeat is left out and said; a malformed plan does not stop the add", () => {
  const p = renterDebtPlan();
  const a = finishDebt({ name: "Visa", type: "credit", owed: 100, rate: null, payment: null, accountId: "" }, emptyPlan(), "");
  assert.deepEqual([...repeats([a, a])], [1]);
  const u1 = finishDebt({ owed: 100, accountId: "setup-owe-credit" }, p, ""), u2 = finishDebt({ owed: 200, accountId: "setup-owe-credit" }, p, "");
  assert.deepEqual([...repeats([u1, a, u2])], [2], "the same debt in the plan twice");
  const d = emptyPlan(), r = applyDebts(d, [a, a], { id: counter(), today: T });
  assert.deepEqual([r.added, r.repeated, d.accounts.length], [["Visa"], ["Visa"], 1]);
  assert.equal(doneWords(r), "Added Visa to your debts. Visa has no rate or payment yet: give them on the Debts page. Visa was given twice: only the first is in.");
  const q = renterDebtPlan(), r2 = applyDebts(q, [u1, u2], { id: counter(), today: "2026-12-31" });
  assert.deepEqual([r2.updated, r2.repeated, Math.abs(q.accounts.find((x) => x.id === "setup-owe-credit").balance)], [["Visa card"], ["Visa card"], 100], "the first one wins, never the last");
  assert.equal(twiceWords({ name: "Visa card" }), "Another debt above is also Visa card: skip one of them, or tap Edit and pick another under \"In your plan\".");
  assert.equal(notAddedWords({ name: "Visa card" }, true), "Not added: another entry is also Visa card. Skip this one, or tap Edit and pick another under \"In your plan\".");
  assert.equal(notAddedWords({ name: "", problems: ["what it is called"] }), "Not added yet: type its name below, then tap Add again.");
  assert.equal(notAddedWords({ name: "Car loan", problems: ["how much you owe"] }), "Not added yet: it still needs how much you owe. Type it below, then tap Add again.");
  assert.equal(leftWords(["Car loan"]), "Car loan is not added yet: it says below what to change.");
  assert.equal(leftWords(["", "Car loan"]), "The debt with no name and Car loan are not added yet: each says below what to change.");
  assert.equal(leftWords([]), "");
  assert.equal(leftWords([{ name: "Visa card", twice: true }]), "The other Visa card is not added yet: it says below what to change.");
  // a plan whose lists are not lists (a hand-edited file): the add makes them lists instead of throwing
  for (const bad of [{ accounts: null, debts: "x" }, { accounts: "y" }, {}]) {
    const out = applyDebts(bad, [a], { id: counter(), today: T });
    assert.deepEqual([out.added, Array.isArray(bad.accounts), Array.isArray(bad.debts)], [["Visa"], true, true]);
  }
});

test("which plan debt a sentence is about (person F1, money F6): a name with its own amount, and a cue when found by kind alone", () => {
  const fam = familyPlan(T);
  const note = "I have a student loan of 18000 at 5.5 percent and my mortgage is 250k";
  assert.deepEqual(quickRead(note, fam, T).map((x) => [x.name, x.type, x.accountId, x.owed, x.rate, x.warnings.length]), [["Student loan", "student_loan", "", 18000, 0.055, 0], ["Mortgage", "mortgage", "a-mort", 250000, null, 0]], "the student loan is never the plan's mortgage");
  assert.deepEqual(quickRead("I owe 18000 at 5.5 percent and my mortgage is 250k", fam, T).map((x) => [x.name, x.accountId, x.owed]), [["", "", 18000], ["Mortgage", "a-mort", 250000]], "a name with its own amount names no earlier debt");
  assert.equal(matchDebt({ name: "", type: "other_liability" }, { accounts: [{ id: "o", name: "Loan from Mom", type: "other_liability" }] }), null, "a debt with no name is never matched by kind");
  // found by its kind alone: the plan's one credit card, asked plainly
  const [c] = quickRead("Credit card interest rate 22 percent", fam, T);
  assert.deepEqual([c.accountId, c.heard, c.rate], ["a-visa", "Credit card", 0.22]);
  assert.ok(c.warnings.includes("Is this your Visa card? It is the one credit card in your plan. If not, tap Edit and pick \"A new debt\" under \"In your plan\"."));
  assert.deepEqual(matchOf({ name: "the card", type: "credit" }, fam), { accountId: "a-visa", heard: "the card" });
  assert.deepEqual(matchOf({ name: "my Visa", type: "credit" }, fam), { accountId: "a-visa" }, "found by its name: no cue");
  assert.equal(finishDebt({ ...c, heard: "" }, fam, "").warnings.some((w) => w.startsWith("Is this your")), false, "once looked at (Done), the cue goes");
  // "Other debt", not Net worth's longer words, under "Kind of debt" (person F3)
  assert.equal(DEBT_TYPES.other_liability, "Other debt");
});

test("money spent said beside a debt keeps the entry it was before (money F1); a payment a month alone is no debt (money F2)", () => {
  const p = plan();
  const [spend, debt] = quickRead("Spent 45 at the dentist, owe 20 more", p, T);
  assert.deepEqual([spend.kind, spend.amount, spend.payee, spend.date], ["spend", 45, "Dentist", T], "the $45 spent, as at dca545e");
  assert.deepEqual([debt.kind, debt.name, debt.owed, debt.paid], ["debt", "Dentist", 20, []], "the $20 owed, and no line saying the $45 is not added");
  const [s2, d2] = quickRead("Paid 300 on my Visa, still owe 4,000 at 24%", emptyPlan(), T);
  assert.deepEqual([s2.kind, s2.amount, d2.name, d2.owed, d2.rate, d2.paid], ["spend", 300, "Visa", 4000, 0.24, []]);
  // these read exactly as before: a payment a month (or a card or loan word) without "owe", a rate or "minimum"
  for (const s of ["Netflix 15 a month on my Visa card", "Rent is 1500 a month, car payment 300 a month", "Put 25 a month toward the loan", "The car loan payment is 410 a month"]) assert.equal(isDebtSentence(s), false, s);
  assert.equal(isDebtSentence("The Visa minimum payment is 35"), true, "a minimum payment is a debt's");
  // a verb at the start is no name
  assert.deepEqual(quickRead("Put 25 a month toward the loan, I owe 3,000 on it", emptyPlan(), T).map((x) => [x.kind, x.name, x.owed]), [["debt", "Loan", 3000]]);
});

test("two debts in one note: in one sentence, in two, as lists said in order, and with a name said again", () => {
  const p = emptyPlan();
  const two = quickRead("I owe 4,000 on my Visa at 24% with a 120 minimum. The car loan is 12,000 at 6 percent, 410 a month.", p, T);
  assert.deepEqual(two.map((x) => [x.name, x.owed, x.rate, x.payment]), [["Visa", 4000, 0.24, 120], ["Car loan", 12000, 0.06, 410]]);
  assert.deepEqual(quickRead("I owe 4,000 on the Visa and 12,000 on the car at 24 and 6 percent", p, T).map((x) => [x.name, x.rate]), [["Visa", 0.24], ["Car loan", 0.06]], "rates said as a list go in order");
  assert.deepEqual(quickRead("I owe 4,000 on the Visa and 12,000 on the car, paying 300 a month on the Visa and 410 on the car", p, T).map((x) => [x.name, x.owed, x.payment]), [["Visa", 4000, 300], ["Car loan", 12000, 410]], "a name said again points at its debt");
  assert.deepEqual(quickRead("Visa: 4,000 at 24%, Mastercard 2,000 at 19%", p, T).map((x) => [x.name, x.owed, x.rate]), [["Visa", 4000, 0.24], ["Mastercard", 2000, 0.19]]);
  assert.deepEqual(quickRead("I am about 5k in debt on credit cards", p, T).map((x) => [x.name, x.owed]), [["Credit cards", 5000]], "'in debt' names no debt");
  assert.deepEqual(quickRead("I owe my mom 2,000 and twelve thousand in student loans at five and a half percent", p, T).map((x) => [x.name, x.type, x.owed, x.rate]), [["Mom", "other_liability", 2000, null], ["Student loans", "student_loan", 12000, 0.055]]);
  // figures that fit no debt are never guessed into one, and money said as paid is the Ledger's: both said plainly
  const [a] = quickRead("I owe 4,000 on the Visa, paying 300 and 410 a month", p, T);
  assert.deepEqual([a.payment, a.unplaced], [null, ["300", "410"]]);
  assert.equal(unplacedWords(a.unplaced), "The app could not tell which debt 300 and 410 go with: tap Edit on each debt to type them.");
  assert.equal(unplacedWords(["24%"]), "The app could not tell which debt 24% goes with: tap Edit on the right debt to type it.");
  assert.equal(paidWords(["300"]), "Money paid (300) is not added here: say it in a sentence of its own to add it to the Ledger.");
  assert.equal(paidWords(["300", "45"]), "Money paid (300 and 45) is not added here: say each in a sentence of its own to add it to the Ledger.");
  // what is no debt sentence: a small debt to a friend, money paid, a card's balance alone, insurance a month
  for (const s of ["I owe Bo 20 for lunch", "Paid 300 on the card", "The balance on my Visa card is 6,400", "Car insurance is 120 a month", "Spent 40 at the dentist a month ago today"]) assert.equal(isDebtSentence(s), false, s);
  assert.equal(quickRead("Remind me I owe 4,000 on the Visa on the 15th", p, T)[0].kind, "reminder", "a reminder stays a reminder");
  // names and kinds
  assert.deepEqual(["the car", "house", "credit card debt", "my Amex", "student loans", "Chase Sapphire"].map((n) => [debtName(n), debtType(n)]),
    [["Car loan", "loan"], ["Mortgage", "mortgage"], ["Credit card", "credit"], ["Amex", "credit"], ["Student loans", "student_loan"], ["Chase Sapphire", "other_liability"]]);
});

test("a debt made safe: figures in range, a debt in the plan by its name or its kind, and what to check before adding", () => {
  const p = renterDebtPlan();
  assert.equal(matchDebt({ name: "Visa", type: "credit" }, p)?.id, "setup-owe-credit", "'Visa' is the Visa card");
  assert.equal(matchDebt({ name: "Car loan", type: "loan" }, p)?.id, "setup-owe-car-loan");
  assert.equal(matchDebt({ name: "Credit card", type: "credit" }, p), null, "three cards: which one is asked");
  assert.equal(matchDebt({ name: "Discover", type: "credit" }, p), null, "a card by another name is a new one");
  const f = (x) => finishDebt(x, p, "");
  assert.deepEqual([f({ name: "Discover", type: "credit", owed: -5, rate: 1.5, payment: 0 }).owed, f({ name: "Discover", type: "credit", owed: -5, rate: 1.5, payment: 0 }).rate, f({ name: "Discover", type: "credit", owed: -5, rate: 1.5, payment: 0 }).payment], [null, null, null]);
  const odd = finishDebt({ name: "Discover", type: "credit", owed: 2000, rate: 1.5, payment: 50 }, p, "");
  assert.ok(odd.warnings.includes("The rate read is above 100% a year: type the rate from the statement."));
  assert.ok(odd.warnings.includes("Your plan already has Visa card, Mastercard and Store card. If this is one of them, tap Edit and pick it under \"In your plan\"."));
  assert.ok(finishDebt({ name: "Discover", type: "credit", owed: 4000, rate: 0.24, payment: 50 }, emptyPlan(), "").warnings.includes("At $50 a month this debt never pays off: its interest is about $80 a month. Check the payment."), "4,000 x 24% / 12 = $80 of interest a month");
  assert.ok(finishDebt({ name: "Bo", owed: 200, rate: 0, payment: 300 }, emptyPlan(), "").warnings.includes("The payment is more than what is owed: check both."));
  assert.deepEqual(finishDebt({ name: "Visa", type: "credit", owed: 4000, rate: 0.24, payment: 300 }, emptyPlan(), "I owe 4,000 at 24 percent").warnings, ["A figure here is not in your note as written: check it."], "the 300 is not in the note");
  assert.deepEqual(finishDebt({ accountId: "setup-owe-credit" }, p, "").problems, ["a figure to change"]);
  assert.equal(finishDebt({ name: "x", accountId: "k401", owed: 5 }, p, "").accountId, "", "only a debt of the plan can be updated");
});

test("adding: a new debt as Net worth and Debts keep one; a debt in the plan updated through Account detail, its guess marks cleared", () => {
  const draft = emptyPlan();
  const r = applyDebts(draft, quickRead(EXAMPLE, emptyPlan(), T), { id: counter(), today: T });
  assert.deepEqual(r, R({ added: ["Visa", "Car loan"] }));
  assert.deepEqual(draft.debts, [{ id: "t2", accountId: "t1", rate: 0.24, minPayment: 300, extra: 0 }, { id: "t4", accountId: "t3", rate: 0.06, minPayment: 410, extra: 0 }]);
  const li = debtsPage(draft, { today: T });
  assert.deepEqual(li.rows.map((x) => [x.name, x.owed, x.rate, x.payment]), [["Visa", 4000, 0.24, 300], ["Car loan", 12000, 0.06, 410]], "Debts reads them as its own");
  assert.equal(li.interestMonthly, 4000 * 0.24 / 12 + 12000 * 0.06 / 12, "$80 + $60 of interest a month");
  assert.equal(payoffPage(draft, { today: T }).hasData, true, "Pay off debts has both");
  assert.equal(doneWords(r), "Added Visa and Car loan to your debts.");
  // an update: the card said with its new balance and rate, in the plan that guessed its rate and payment
  const g = guessedPlan(T);
  assert.equal(isGuess(g, "debts[setup-debt-credit].rate"), true, "the card's rate is our guess before");
  const [x] = quickRead("I owe 3,000 on the card at 21 percent", g, T);
  assert.deepEqual([x.name, x.accountId, x.owed, x.rate, x.payment, x.ready], ["Credit cards", "setup-owe-credit", 3000, 0.21, null, true]);
  const u = applyDebts(g, [x], { id: counter(), today: T });
  assert.deepEqual(u, R({ updated: ["Credit cards"] }));
  const acct = g.accounts.find((a) => a.id === "setup-owe-credit"), row = g.debts.find((d) => d.accountId === "setup-owe-credit");
  assert.deepEqual([acct.balance, acct.asOf, acct.typedOn, acct.history.at(-1)], [3000, T, T, { date: T, balance: 3000 }], "a point that day and the balance on file, typed today");
  assert.deepEqual([row.rate, row.minPayment], [0.21, 103], "the rate said; the payment not said is kept");
  assert.equal(isGuess(g, "debts[setup-debt-credit].rate"), false, "a rate said is the person's, no longer our guess");
  assert.equal(isGuess(g, "debts[setup-debt-credit].minPayment"), true, "the payment not said stays our guess");
  assert.equal(doneWords(u), "Updated Credit cards.");
  assert.equal(doneWords({ added: ["Car loan"], updated: ["Visa card"], bare: [] }), "Added Car loan and updated Visa card.");
  assert.equal(doneWords(R({})), "Nothing was added.");
});

test("nothing is saved before the tap: reading a debt note, asking and reading the AI change no plan", () => {
  const deep = (o) => { if (o && typeof o === "object") { Object.freeze(o); for (const v of Object.values(o)) deep(v); } return o; };
  for (const make of [emptyPlan, () => renterDebtPlan(), () => plan()]) {
    const p = deep(make()), before = JSON.stringify(p);
    const read = quickRead(EXAMPLE, p, T);
    readDebts(EXAMPLE, p);
    for (const x of read) finishDebt(x, p, EXAMPLE);
    const q = buildPrompt(EXAMPLE, p, T);
    readAnswer('[{"kind":"debt","name":"Visa","type":"card","owed":4000,"rate":24,"payment":300}]', p, T, EXAMPLE, q);
    payoffLine(p, T);
    assert.equal(JSON.stringify(p), before);
  }
});

test("Undo takes the debts back out: the plan is as it was before the tap", () => {
  for (const make of [emptyPlan, () => renterDebtPlan(), () => guessedPlan(T)]) {
    const before = make();
    const list = quickRead(`${EXAMPLE}. I owe 3,000 on the card at 21 percent.`, before, T);
    const after = structuredClone(before);
    applyDebts(after, list, { id: counter(), today: T });
    const changes = changesOf(before, after);
    assert.ok(changes.length > 0, "the tap changed the plan");
    const back = structuredClone(after);
    const r = takeBack(back, changes);
    assert.equal(r.kept, 0);
    assert.deepEqual(back, before, "Undo puts back exactly the plan before");
  }
  assert.equal(undoWords({ added: ["Visa", "Car loan"], updated: [] }), "Taken back: Visa and Car loan are out of your plan again. They are listed below to change or add.");
  assert.equal(undoWords({ added: ["Visa"], updated: [] }), "Taken back: Visa is out of your plan again. It is listed below to change or add.");
  assert.equal(undoWords({ added: ["Car loan"], updated: ["Visa card"] }), "Taken back: Car loan and Visa card are as they were. They are listed below to change or add.");
});

test("the line to Pay off debts: one sentence for each case, with the plan as it is after the add", () => {
  const p = emptyPlan();
  const acct = (id, name, type, balance) => ({ id, name, type, institution: "", balance, asOf: T, ownerId: "", history: [], notes: "" });
  p.accounts.push(acct("v", "Visa", "credit", 4000));
  assert.deepEqual(payoffLine(p, T), { kind: "notyet", text: "Once your debts have a rate and a payment, Pay off debts compares paying the highest interest rate first with the smallest balance first." });
  p.debts.push({ id: "dv", accountId: "v", rate: 0.24, minPayment: 300, extra: 0 });
  assert.equal(payoffLine(p, T).text, "Pay off debts shows the month your debt is paid off and what paying a little more would change.");
  // the smaller debt has the higher rate: both orders pay it first
  p.accounts.push(acct("c", "Car loan", "loan", 12000));
  p.debts.push({ id: "dc", accountId: "c", rate: 0.06, minPayment: 410, extra: 0 });
  assert.deepEqual(payoffLine(p, T), { kind: "same", text: "Pay off debts compares paying the highest interest rate first with the smallest balance first: with your debts now, both cost about the same in interest." });
  // the renter's three cards and car loan: the highest rate first saves $163
  const r = payoffLine(renterDebtPlan(), T);
  const po = payoffPage(renterDebtPlan(), { today: T });
  assert.equal(r.saves, Math.round(po.plans.snowball.totalInterest - po.plans.avalanche.totalInterest));
  assert.deepEqual(r, { kind: "rate", saves: 163, text: "Pay off debts compares paying the highest interest rate first with the smallest balance first: with your debts now, the highest rate first saves about $163 in interest." });
  // payments under their interest: even with one's payment moved onto the other, they never pay off
  const n = structuredClone(p); n.debts[0].minPayment = 50; n.debts[1].minPayment = 50;
  assert.equal(payoffLine(n, T).text, "Pay off debts compares paying the highest interest rate first with the smallest balance first. One payment does not cover its interest yet: that page shows which.");
  assert.equal(payoffWords("smallest", 40), "Pay off debts compares paying the highest interest rate first with the smallest balance first: with your debts now, the smallest balance first saves about $40 in interest.");
});

test("the AI is asked about debts only for a debt note, and its debts are read back as proposals, every figure checked", () => {
  const p = renterDebtPlan();
  const q = buildPrompt(EXAMPLE, p, T);
  assert.equal(q.debts, true);
  assert.match(q.messages[0].content, /"kind":"debt"/);
  assert.match(q.messages[0].content, /never guess what is owed, a rate or a payment/);
  const plain = buildPrompt("spent 42 dollars at Corner Market yesterday", p, T);
  assert.equal(plain.debts, undefined);
  assert.doesNotMatch(plain.messages[0].content, /debt/, "a note with no debt is asked as before");
  const visa = q.accounts.find((a) => a.id === "setup-owe-credit").alias;
  const got = readAnswer(JSON.stringify([{ kind: "debt", name: visa, type: "card", owed: 4000, rate: 24, payment: 300 }, { kind: "debt", name: "car loan", type: "loan", owed: 12000, rate: 6, payment: 999 }, { kind: "debt", name: "Discover", type: "card", owed: 500, rate: null, payment: null }]), p, T, EXAMPLE, q);
  assert.deepEqual(got.map((x) => [x.kind, x.name, x.accountId, x.owed, x.rate, x.payment]), [["debt", "Visa card", "setup-owe-credit", 4000, 0.24, 300], ["debt", "Car loan", "setup-owe-car-loan", 12000, 0.06, 999], ["debt", "Discover", "", 500, null, null]]);
  assert.deepEqual(got[0].warnings, []);
  assert.ok(got[1].warnings.includes("A figure here is not in your note as written: check it."), "999 is not in the note");
  assert.deepEqual(got[2].missing, ["rate", "payment"], "a figure the AI leaves out stays blank");
  // a debt from the AI when the question did not ask for one is read as before: an unknown kind, a note
  assert.equal(readAnswer('[{"kind":"debt","name":"Visa","owed":4000}]', p, T, "spent 42 dollars", plain)[0].kind, "note");
});

test("the invariance corpus holds no debt sentence (so the digests above cover only notes that say nothing about debts)", () => {
  for (const note of INV.corpus) for (const s of sentencesOf(note)) assert.equal(isDebtSentence(s), false, s);
  assert.ok(INV.corpus.length > 500);
});
