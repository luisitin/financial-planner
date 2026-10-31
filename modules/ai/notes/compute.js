// modules/ai/notes/compute.js -- PURE. A note said or typed ("spent 42 dollars at Corner Market yesterday", "remind me
// to pay the car registration on December 1") turned into entries to check: money spent, money in, a reminder, an
// account's balance, or a plain note. The AI helper reads the note when it is on (names hidden first, as on
// ai/critic); otherwise a few plain rules do. Either way every entry is a proposal: it reaches the plan only when the
// person taps Add (AGENTS.md rule 5), through the same helpers the Ledger, Money calendar and Account detail use.
import { isValidDate, isoOf } from "../../../core/math/dates.js";
import { txKey } from "../../transactions/ledger/compute.js";
import { saveReminder, REPEATS } from "../../household/calendar/compute.js";
import { saveBalance } from "../../balance/accounts/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { aliases, accountAliases, hideTerms, hide, restore, findList, cut } from "../critic/compute.js";

/** What a note can become, in plain words. */
export const KINDS = { spend: "Money spent", income: "Money in", reminder: "Reminder", balance: "Account balance", note: "Note" };
export const MAX_NOTE = 2000, MAX_ENTRIES = 10, MAX_TEXT = 200;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const parts = (iso) => iso.split("-").map(Number);
const addDays = (iso, n) => { const [y, m, d] = parts(iso); return isoOf(y, m, d + n); };
const weekday = (iso) => { const [y, m, d] = parts(iso); return new Date(y, m - 1, d).getDay(); };
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const upperFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PREP = /^(?:on|by|of|for|at|in|to)$/i;

/**
 * The first day a piece of text names, as YYYY-MM-DD, and the words that named it: { date, match } or null.
 * Reads 2026-12-01, 12/1 (or 12/1/2026), "December 1" (or "Dec 1st, 2026"), "1 December", today, yesterday,
 * tomorrow, "N days ago", "in N days", "next week", "last week", a weekday ("on Friday", "last Friday", "next
 * Friday"), "the 15th". A day with no year, a bare weekday or "the 15th" is the latest one up to today for something
 * that happened (`dir` "past") and the next one from today for a reminder ("future").
 */
export function readDate(text, today, dir = "past") {
  const s = String(text ?? "").toLowerCase();
  const ok = (iso, match) => (iso && isValidDate(iso) ? { date: iso, match } : null);
  // a day that exists in that month (isoOf would roll February 31 over to March 3)
  const day = (y, m, d) => { const iso = isoOf(y, m, d); return d >= 1 && d <= 31 && Number(iso.slice(8)) === d ? iso : null; };
  const year = Number(today.slice(0, 4));
  const pick = (m, d, y) => {   // a month and day with no year: this year's, or the year before or after
    if (m < 1 || m > 12) return null;
    if (y) return day(y, m, d);
    const here = day(year, m, d);
    if (dir === "past") return here && here <= today ? here : day(year - 1, m, d);
    return here && here >= today ? here : day(year + 1, m, d);
  };
  let m;
  if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s))) return ok(m[0], m[0]);
  if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/.exec(s))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    if (Number(m[1]) <= 12 && Number(m[2]) <= 31) return ok(pick(Number(m[1]), Number(m[2]), y), m[0]);
  }
  const mon = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  if ((m = new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`).exec(s))) return ok(pick(MONTHS[m[1]], Number(m[2]), m[3] ? Number(m[3]) : null), m[0]);
  if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}(?:,?\\s+(\\d{4}))?\\b`).exec(s))) return ok(pick(MONTHS[m[2]], Number(m[1]), m[3] ? Number(m[3]) : null), m[0]);
  if ((m = /\bday before yesterday\b/.exec(s))) return ok(addDays(today, -2), m[0]);
  if ((m = /\byesterday\b/.exec(s))) return ok(addDays(today, -1), m[0]);
  if ((m = /\btomorrow\b/.exec(s))) return ok(addDays(today, 1), m[0]);
  if ((m = /\b(?:this morning|tonight|this evening|today)\b/.exec(s))) return ok(today, m[0]);
  if ((m = /\b(\d{1,3}) days? ago\b/.exec(s))) return ok(addDays(today, -Number(m[1])), m[0]);
  if ((m = /\bin (\d{1,3}) days?\b/.exec(s))) return ok(addDays(today, Number(m[1])), m[0]);
  if ((m = /\bnext week\b/.exec(s))) return ok(addDays(today, 7), m[0]);
  if ((m = /\blast week\b/.exec(s))) return ok(addDays(today, -7), m[0]);
  if ((m = new RegExp(`\\b(?:(last|next|this|on)\\s+)?(${DAYS.join("|")})\\b`).exec(s))) {
    const want = DAYS.indexOf(m[2]), now = weekday(today);
    const back = (now - want + 7) % 7, ahead = (want - now + 7) % 7;
    const which = m[1] === "last" ? "past" : m[1] === "next" ? "future" : dir;
    const n = which === "past" ? -(back || (m[1] === "last" ? 7 : 0)) : (ahead || (m[1] === "next" ? 7 : 0));
    return ok(addDays(today, n), m[0]);
  }
  if ((m = /\bthe (\d{1,2})(?:st|nd|rd|th)\b/.exec(s))) {
    const [y, mo] = parts(today), d = Number(m[1]);
    const here = day(y, mo, d);
    return ok(dir === "past" ? (here && here <= today ? here : day(y, mo - 1, d)) : (here && here >= today ? here : day(y, mo + 1, d)), m[0]);
  }
  return null;
}

/**
 * The first money amount in a piece of text and the words that gave it: { amount, match } or null. "$42.17", "42
 * dollars", "42 bucks", or a number right after a money word ("spent 40", "paid 1,200", "is at 12,400", "of 85").
 * Never a bare number on its own (a time, a count, the 15th).
 */
export function readAmount(text) {
  const s = String(text ?? "");
  const n = (x) => Number(x.replace(/,/g, ""));
  const num = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
  let m;
  if ((m = new RegExp(`\\$\\s?${num}`).exec(s))) return { amount: n(m[1]), match: m[0] };
  if ((m = new RegExp(`\\b${num}\\s*(?:dollars|bucks|usd)\\b`, "i").exec(s))) return { amount: n(m[1]), match: m[0] };
  if ((m = new RegExp(`\\b(?:spent|spend|paid|pay|cost|costs|charged|got|received|earned|made|is at|is now|is|was|of|balance|stands at|at|for|to)\\s+(?:about\\s+|around\\s+|roughly\\s+)?${num}(?!\\s*(?:%|percent|am|pm|th|st|nd|rd|days?|weeks?|months?|years?|hours?|minutes?|o'clock|:))`, "i").exec(s))) return { amount: n(m[1]), match: m[0].replace(/^\D+?(?=\d)/, "") };
  return null;
}

/** Kind words for accounts said in a note, and the account types they mean. */
const KIND_WORDS = [
  [/\bcredit card\b|\bcard\b/, ["credit"]], [/\bchecking\b|\bcurrent account\b/, ["checking"]], [/\bsavings?\b/, ["savings"]],
  [/\bmortgage\b/, ["mortgage"]], [/\bcar loan\b|\bauto loan\b|\bloan\b/, ["loan"]], [/\bbrokerage\b/, ["brokerage"]],
  [/\b401\s?\(?k\)?/, ["401k"]], [/\broth\b/, ["roth"]], [/\bhsa\b|\bhealth savings\b/, ["hsa"]],
];

/** The account a piece of text names: by its name (whole words), else by a kind word when exactly one account is that kind. -> account or null */
export function readAccount(text, plan) {
  const s = ` ${String(text ?? "").toLowerCase()} `;
  const accounts = (plan?.accounts ?? []).filter((a) => a?.id);
  const byName = accounts.filter((a) => a.name && clean(a.name).length >= 3).sort((a, b) => b.name.length - a.name.length)
    .find((a) => new RegExp(`(?<![\\p{L}\\p{N}])${clean(a.name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(s));
  if (byName) return byName;
  for (const [re, types] of KIND_WORDS) {
    if (!re.test(s)) continue;
    const of = accounts.filter((a) => types.includes(a.type));
    if (of.length === 1) return of[0];
  }
  return null;
}

/** The account a new transaction goes to when the note names none: the one with the most transactions, else the first checking, else the first account; null when there are none. */
export function defaultAccount(plan) {
  const accounts = (plan?.accounts ?? []).filter((a) => a?.id);
  if (!accounts.length) return null;
  const count = {};
  for (const t of plan.transactions ?? []) if (t?.accountId) count[t.accountId] = (count[t.accountId] ?? 0) + 1;
  const used = accounts.filter((a) => count[a.id]).sort((a, b) => count[b.id] - count[a.id]);
  return used[0] ?? accounts.find((a) => a.type === "checking") ?? accounts[0];
}

/** Who or what money went to or came from: the words after "at", "from", "to" or "for", up to a day, an account or the end. "the electric bill" -> "Electric bill". */
function readPayee(sentence, cutAt = []) {
  let s = ` ${sentence} `;
  for (const c of cutAt) if (c) s = s.replace(c, " ");
  const m = /\b(?:at|from|to|for|on)\s+(.+)$/i.exec(clean(s));
  if (!m) return "";
  let p = m[1].split(/\s+(?:with|using|on my|on the|from my|from the|into|in my|by|via|and|then|so|because|which)\b|[,.;!?]/i)[0];
  p = p.replace(/^(?:the|my|a|an|our)\s+/i, "").replace(/\s+(?:today|yesterday|tomorrow|this morning|tonight|card|account)$/i, "");
  return upperFirst(clean(p)).slice(0, MAX_TEXT);
}

/**
 * The plain rules, used when the AI helper is off (or as a check): each sentence becomes one entry.
 * - "remind", "remember to", "don't forget", "due" -> a reminder (its name: the sentence without those words, the day
 *   and the amount; a future day);
 * - an account named with "balance", "is at", "has", "is now", "stands at" and an amount -> that account's balance;
 * - "spent", "paid", "bought", "cost", "charged" and an amount -> money spent (who to: after at/to/for/on);
 * - "got paid", "received", "earned", "deposit", "refund", "paid me" and an amount -> money in;
 * - anything else -> a note.
 * -> [proposal] (see finish)
 */
export function quickRead(text, plan, today) {
  const out = [];
  const sentences = String(text ?? "").split(/(?<=[.!?;])\s+|\n+/).map(clean).filter(Boolean);
  for (const s of sentences.slice(0, MAX_ENTRIES)) {
    const low = s.toLowerCase();
    const money = readAmount(s);
    if (/\b(?:remind|remember to|don'?t forget|do not forget|due)\b/.test(low)) {
      const day = readDate(s, today, "future");
      let name = s;
      for (const c of [day?.match, money?.match]) if (c) name = name.replace(new RegExp(esc(c), "i"), " ");
      name = clean(name.replace(/\b(?:please\s+)?(?:remind me to|remind me about|remind me|remember to|don'?t forget to|don'?t forget|do not forget to|do not forget)\b/gi, " ").replace(/\b(?:every month|monthly|every year|yearly|annually|each month|each year)\b/gi, " ").replace(/[.!?;,]+/g, " "));
      // the words left around the day and the amount ("pay the registration of on") go
      let w = name.split(" ").filter(Boolean);
      while (w.length && PREP.test(w[0])) w.shift();
      while (w.length && PREP.test(w[w.length - 1])) w.pop();
      w = w.filter((x, i) => !(PREP.test(x) && PREP.test(w[i + 1] ?? "")));
      name = w.join(" ");
      out.push({ kind: "reminder", name: upperFirst(name), date: day?.date ?? "", amount: money?.amount ?? null, repeat: /\bevery month|\bmonthly\b/.test(low) ? "monthly" : /\bevery year|\byearly\b|\bannual/.test(low) ? "yearly" : "none" });
      continue;
    }
    const acct = readAccount(s, plan);
    if (acct && money && /\b(?:balance|is at|has|have|is now|stands at|is|shows)\b/.test(low) && !/\b(?:spent|paid|bought|charged|received|earned)\b/.test(low)) {
      out.push({ kind: "balance", accountId: acct.id, amount: money.amount, date: readDate(s, today, "past")?.date ?? today });
      continue;
    }
    if (money && /\b(?:got paid|was paid|paid me|received|earned|deposit(?:ed)?|refund(?:ed)?|got back|made)\b/.test(low)) {
      const day = readDate(s, today, "past");
      const payee = readPayee(s, [day?.match && new RegExp(esc(day.match), "i"), money.match]) || (/\b(?:got paid|was paid|paycheck|salary|wages)\b/.test(low) ? "Paycheck" : "");
      out.push({ kind: "income", amount: money.amount, date: day?.date ?? today, payee, accountId: (acct ?? defaultAccount(plan))?.id ?? "" });
      continue;
    }
    if (money && /\b(?:spent|spend|paid|pay|bought|buy|cost|costs|charged|tipped)\b/.test(low)) {
      const day = readDate(s, today, "past");
      out.push({ kind: "spend", amount: money.amount, date: day?.date ?? today, payee: readPayee(s, [day?.match && new RegExp(esc(day.match), "i"), money.match]), accountId: (acct ?? defaultAccount(plan))?.id ?? "" });
      continue;
    }
    out.push({ kind: "note", text: s });
  }
  return out.map((p) => finish(p, plan, today, text));
}

/** The amounts written in a note (commas dropped), to tell whether an amount the AI gives is really in it. */
const amountsIn = (text) => [...String(text ?? "").matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ""))).filter(Number.isFinite);

/**
 * One entry made safe to show and to add: { id?, kind, amount, date, payee, accountId, name, repeat, text, problems,
 * warnings, ready }. Unknown kinds become a note; amounts are positive numbers (the kind gives the sign); a day must be
 * a real calendar day; an account must be in the plan. problems: what must be filled before Add ("pick a day");
 * warnings: what to look at (an amount that is not in the note as written, a day far from today).
 */
export function finish(p, plan, today, note = "") {
  const kind = KINDS[p?.kind] ? p.kind : "note";
  const amount = p?.amount === null || p?.amount === undefined || p?.amount === "" || !Number.isFinite(Number(p.amount)) ? null : Math.round(Math.abs(Number(p.amount)) * 100) / 100;
  const date = isValidDate(p?.date) ? p.date : "";
  const accountId = (plan?.accounts ?? []).some((a) => a?.id === p?.accountId) ? p.accountId : "";
  const out = { kind, amount, date, payee: cut(clean(p?.payee), MAX_TEXT), accountId, name: cut(clean(p?.name), MAX_TEXT), repeat: REPEATS[p?.repeat] ? p.repeat : "none", text: cut(clean(p?.text), MAX_NOTE), problems: [], warnings: [] };
  const need = (ok, what) => { if (!ok) out.problems.push(what); };
  if (kind === "spend" || kind === "income") { need(amount !== null && amount > 0, "the amount"); need(date, "the day"); need(accountId, "the account"); need(out.payee, kind === "spend" ? "who it was paid to" : "who it came from"); }
  if (kind === "reminder") { need(out.name, "what to remember"); need(date, "the day"); }
  if (kind === "balance") { need(accountId, "the account"); need(amount !== null, "the balance"); need(date, "the day"); }
  if (kind === "note") need(out.text, "the note");
  if (amount !== null && note && !amountsIn(note).some((x) => Math.abs(x - amount) < 0.005)) out.warnings.push("This amount is not in your note as written: check it.");
  if (date && (kind === "spend" || kind === "income" || kind === "balance") && date > today) out.warnings.push("This day is in the future.");
  if (date && Math.abs((Date.parse(date) - Date.parse(today)) / 86400000) > 366) out.warnings.push("This day is more than a year away from today.");
  out.ready = out.problems.length === 0;
  return out;
}

/**
 * The question for the AI: the note with people's and accounts' names swapped for stand-ins (Adult 1, "the credit
 * card"), the accounts by those stand-ins, and today's date. -> { messages, names, accounts: [{ alias, id }] }
 */
export function buildPrompt(text, plan, today) {
  const people = aliases(plan, { today });
  const accts = accountAliases(plan);
  const list = (plan?.accounts ?? []).map((a, i) => (a?.id && accts[i] ? { alias: accts[i].alias, id: a.id, label: ACCOUNT_TYPES[a.type]?.label ?? "Account" } : null)).filter(Boolean);
  const terms = hideTerms(people, accts.filter(Boolean));
  // "with the Visa card" -> "with the the credit card" -> "with the credit card"
  const note = cut(hide(clean(text), terms).replace(/\b(the|my|our|your)\s+the\s+/gi, "$1 "), MAX_NOTE);
  const system = `You turn a short note, spoken or typed, into entries for a household money app. Reply with only a JSON list. Each entry is one of:
{"kind":"spend","amount":42.17,"date":"YYYY-MM-DD","payee":"who it was paid to","account":"one of the accounts listed, or null"}
{"kind":"income","amount":1950,"date":"YYYY-MM-DD","payee":"who it came from","account":"one of the accounts listed, or null"}
{"kind":"reminder","name":"what to remember","date":"YYYY-MM-DD","amount":85 or null,"repeat":"none" or "monthly" or "yearly"}
{"kind":"balance","account":"one of the accounts listed","amount":12400,"date":"YYYY-MM-DD"}
{"kind":"note","text":"anything else worth keeping, in the note's own words"}
Use only what the note says. Never guess an amount or a day the note does not give: use null. Amounts are positive numbers without a currency sign. Today is ${today}; words such as yesterday, last Friday or next month are counted from today. People are called Adult 1, Adult 2, Child 1 and so on; keep those names. At most ${MAX_ENTRIES} entries.`;
  const user = `ACCOUNTS: ${list.length ? list.map((a) => `${a.alias} (${a.label})`).join("; ") : "none yet"}\nNOTE: ${note}`;
  return { messages: [{ role: "system", content: system }, { role: "user", content: user }], names: [...people.filter((p) => p.name), ...accts.filter((a) => a && a.name)], accounts: list };
}

/**
 * The AI's answer read back: its JSON list (ai/critic's findList: thinking and fences dropped, the first list that
 * parses), each entry's account matched from its stand-in (with or without "the", any case) or from a name, names put
 * back in the text, then finish() each, at most MAX_ENTRIES. -> [proposal], or null when there is no list to read.
 */
export function readAnswer(content, plan, today, note, prompt) {
  const arr = findList(content);
  if (!arr) return null;
  const norm = (s) => clean(s).toLowerCase().replace(/^the\s+/, "");
  const accountOf = (v) => {
    if (typeof v !== "string" || !v.trim()) return "";
    const hit = (prompt?.accounts ?? []).find((a) => norm(a.alias) === norm(v));
    return hit ? hit.id : readAccount(v, plan)?.id ?? "";
  };
  const back = (v) => restore(typeof v === "string" ? v : "", prompt?.names ?? []);
  return arr.filter(isObj).slice(0, MAX_ENTRIES).map((x) => finish({ ...x, accountId: accountOf(x.account), payee: back(x.payee), name: back(x.name), text: back(x.text) }, plan, today, note));
}

/**
 * Add one entry to the plan draft, through the page that owns it; changes `draft` in place. -> { ok, text, go }
 * - spend / income: a transaction like the Ledger's (`txKey` for the duplicate check), money out negative, no
 *   category yet (Categorize does that), noted "from a voice note";
 * - reminder: household/calendar's saveReminder;
 * - balance: balance/accounts' saveBalance (a point that day, and the balance on Net worth when it is the newest);
 * - note: a dated line added to the plan's notes.
 */
export function applyEntry(draft, p, { id, today } = {}) {
  if (!p?.ready) return { ok: false, text: "Fill in what is missing first." };
  if (p.kind === "spend" || p.kind === "income") {
    const t = { id, date: p.date, amount: p.kind === "spend" ? -p.amount : p.amount, payee: p.payee, rawPayee: p.payee, accountId: p.accountId, category: "", tags: [], note: "from a voice note" };
    t.key = txKey(t);
    draft.transactions = draft.transactions ?? [];
    draft.transactions.push(t);
    return { ok: true, text: `${p.kind === "spend" ? "Spent" : "Money in"}: ${p.payee}`, go: "transactions/ledger" };
  }
  if (p.kind === "reminder") { saveReminder(draft, { id, name: p.name, date: p.date, repeat: p.repeat, amount: p.amount, note: "from a voice note" }); return { ok: true, text: `Reminder: ${p.name}`, go: "household/calendar" }; }
  if (p.kind === "balance") {
    const r = saveBalance(draft, p.accountId, p.date, p.amount);
    return r.saved ? { ok: true, text: `Balance saved${r.onFile ? " and used on Net worth" : ""}`, go: `balance/accounts/${p.accountId}` } : { ok: false, text: "That balance could not be saved." };
  }
  draft.notes = [String(draft.notes ?? "").trim(), `${today ?? ""}: ${p.text}`.trim()].filter(Boolean).join("\n");
  return { ok: true, text: "Note kept", go: "ai/notes" };
}

/** compute(plan) -> { accounts: [{ id, name, label }], notes (the plan's notes, as text), ready } */
export function compute(plan) {
  const accounts = (plan?.accounts ?? []).filter((a) => a?.id).map((a) => ({ id: a.id, name: a.name || "Account", label: ACCOUNT_TYPES[a.type]?.label ?? "Account" }));
  return { accounts, notes: String(plan?.notes ?? ""), ready: true };
}
