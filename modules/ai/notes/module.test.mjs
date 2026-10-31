import { test } from "node:test";
import assert from "node:assert/strict";
import { readDate, readAmount, readAccount, defaultAccount, quickRead, finish, buildPrompt, readAnswer, applyEntry, compute, KINDS } from "./compute.js";
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
  assert.equal(d("February 31"), null, "not a real day");
  assert.equal(d("on 2/30/2027"), null);
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
