// modules/ai/notes/debts.js -- PURE. The debt case of Voice notes (gap list, next 60, item 59): a note such as "I owe
// about four thousand on my Visa at 24 percent and twelve thousand on the car at 6, paying 300 and 410 a month" read
// into debts to check (name, kind, what is owed, the rate a year, the payment a month). Plain rules read it (numbers
// said in words or digits, "percent", "a month"); the AI helper, when it is on, only proposes the same entries. Nothing
// reaches the plan before "Add these debts" (AGENTS.md rule 5), and then only through the pages' own ways: a liability
// account as Net worth adds one, its loan detail as Debts keeps it (only with both a rate and a payment, so no debt
// shows a silent "$0 a month"), a balance through Account detail's saveBalance. compute.js re-exports this file.
import { ACCOUNT_TYPES, isLiability } from "../../balance/net-worth/compute.js";
import { saveBalance } from "../../balance/accounts/compute.js";
import { markTyped } from "../../balance/update/compute.js";
import { clearGuess, markGuess, debtKind, applies } from "../../../core/estimate/index.js";
import { compute as payoff } from "../../debt/payoff/compute.js";
import { money, date as dateWords } from "../../../core/format.js";

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const upperFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const own = (obj, k) => typeof k === "string" && Object.hasOwn(obj, k);
/** The kinds of debt, in the words Net worth uses for them; "Other debt" for its "Something else I owe" (fix round 1, 2026-11-16:
 * under "Kind of debt" and on a record the longer words read oddly). */
export const DEBT_TYPES = Object.fromEntries(["credit", "loan", "mortgage", "student_loan", "other_liability"].map((t) => [t, t === "other_liability" ? "Other debt" : ACCOUNT_TYPES[t].plain ?? ACCOUNT_TYPES[t].label]));
/** The longest name kept for a debt said in a note. */
export const MAX_NAME = 60;

// ---------------------------------------------------------------- numbers said in words
const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { hundred: 100, thousand: 1000, grand: 1000, million: 1e6 };
const isNumWord = (w) => own(UNITS, w) || own(TENS, w) || own(SCALE, w);
// an ordinal after a run ("the twenty fifth") makes the run a day, not a number
const ORDINAL = /^(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\w+teenth|\w+tieth)$/;
const lastScale = (ws) => { for (let i = ws.length - 1; i >= 0; i--) if (own(SCALE, ws[i])) return SCALE[ws[i]]; return 0; };
const maxScale = (ws) => ws.reduce((m, w) => Math.max(m, own(SCALE, w) ? SCALE[w] : 0), 0);
/** The value of number words with no "and" between them ("four hundred ten", "a thousand", "six +half"), or null. */
function valueOf(ws) {
  let total = 0, cur = 0, seen = false;
  for (const w of ws) {
    if (own(UNITS, w)) { cur += UNITS[w]; seen = true; }
    else if (own(TENS, w)) { cur += TENS[w]; seen = true; }
    else if (w === "hundred") { cur = (cur || 1) * 100; seen = true; }
    else if (w === "thousand" || w === "grand" || w === "million") { total += (cur || 1) * SCALE[w]; cur = 0; seen = true; }
    else if (w === "+half") cur += 0.5;
    else if (w === "+quarter") cur += 0.25;
    else if (w !== "a" && w !== "an") return null;
  }
  return seen ? total + cur : null;
}
/** One run of number words as one or more numbers: "three hundred and four hundred ten" is 300 and 410. */
function runValues(words) {
  const ws = [];
  for (let i = 0; i < words.length; i++) {
    // "six and a half", "four and a quarter thousand"
    if (words[i] === "and" && (words[i + 1] === "a" || words[i + 1] === "one") && (words[i + 2] === "half" || words[i + 2] === "quarter")) { ws.push(`+${words[i + 2]}`); i += 2; continue; }
    ws.push(words[i]);
  }
  // "point": decimals word by word ("twenty four point nine nine")
  const at = ws.indexOf("point");
  if (at >= 0) {
    const whole = at === 0 ? 0 : valueOf(ws.slice(0, at)), digits = ws.slice(at + 1);
    if (whole === null || !digits.length || !digits.every((w) => own(UNITS, w) && UNITS[w] <= 9)) return null;
    return [Number(`${whole}.${digits.map((w) => UNITS[w]).join("")}`)];
  }
  // split at "and", then join a part to the one before it when it is smaller than that one's last scale ("four hundred
  // and ten" is 410, "two thousand and five hundred" 2,500; "three hundred and four hundred" are two numbers)
  const partsOf = [];
  let part = [];
  for (const w of ws) { if (w === "and") { if (part.length) partsOf.push(part); part = []; } else part.push(w); }
  if (part.length) partsOf.push(part);
  const groups = [];
  for (const p of partsOf) {
    const prev = groups[groups.length - 1];
    if (prev && lastScale(prev) > 0 && maxScale(p) < lastScale(prev) && !p.some((w) => w.startsWith("+"))) prev.push(...p);
    else if (prev && p.every((w) => w.startsWith("+"))) prev.push(...p);
    else groups.push([...p]);
  }
  const out = groups.map(valueOf);
  return out.every((v) => v !== null) ? out : null;
}
const show = (v) => String(Math.round(v * 100) / 100);
/**
 * numberWords(text) -> the text with numbers said in words or with a scale written as digits: "four thousand" 4000,
 * "twenty-four" 24, "three hundred and ten" 310, "twelve hundred" 1200, "six and a half" 6.5, "one point five" 1.5,
 * "twelve grand" 12000, "12k" 12000, "1.2 million" 1200000, "300 and 410" left as they are. A lone "one", "a" or "an"
 * is left ("the one on the car", "a month"), unless "percent" follows ("one percent"); a run before an ordinal ("the
 * twenty fifth") is a day and is left; "401k", "403(b)" and "457" are plan names, never thousands.
 */
export function numberWords(text) {
  const s = String(text ?? "");
  const toks = [...s.matchAll(/[A-Za-z]+|[^A-Za-z]+/g)].map((m) => ({ t: m[0], at: m.index, word: /^[A-Za-z]/.test(m[0]) }));
  let out = "", i = 0;
  while (i < toks.length) {
    const tk = toks[i];
    const low = tk.word ? tk.t.toLowerCase() : "";
    // a run starts at a number word, or at "a"/"an" before a scale ("a thousand", "a hundred and fifty")
    const startsRun = tk.word && (isNumWord(low) && !own(SCALE, low) || ((low === "a" || low === "an") && toks[i + 2]?.word && own(SCALE, toks[i + 2].t.toLowerCase()) && /^[\s-]+$/.test(toks[i + 1]?.t ?? "")));
    if (!startsRun) { out += tk.t; i++; continue; }
    // gather words joined by spaces or hyphens: number words, "and" before more of them, "point", "a half"
    const words = [low];
    let j = i + 1;
    while (j + 1 < toks.length && /^[\s-]+$/.test(toks[j].t) && !/\n/.test(toks[j].t) && toks[j + 1].word) {
      const w = toks[j + 1].t.toLowerCase(), next = toks[j + 3]?.word ? toks[j + 3].t.toLowerCase() : "";
      const ok = isNumWord(w) || (w === "point" && own(UNITS, next)) || (w === "and" && (isNumWord(next) || next === "a" || next === "one"))
        || ((w === "a" || w === "one") && words[words.length - 1] === "and" && (next === "half" || next === "quarter"))
        || ((w === "half" || w === "quarter") && (words[words.length - 1] === "a" || words[words.length - 1] === "one"))
        || (w === "a" && own(SCALE, next)) || (own(UNITS, w) && words.includes("point"));
      if (!ok) break;
      words.push(w);
      j += 2;
    }
    // a dangling "and" (or "and a") at the end goes back to the text
    while (words.length && (words[words.length - 1] === "and" || words[words.length - 1] === "a")) { words.pop(); j -= 2; }
    const after = toks[j + 1]?.word ? toks[j + 1].t.toLowerCase() : "";
    const lone = words.length === 1 && (words[0] === "one" || words[0] === "a" || words[0] === "an") && !/^(?:percent|point)$/.test(after);
    const vals = !lone && !ORDINAL.test(after) ? runValues(words) : null;
    if (!vals) { out += toks.slice(i, j).map((x) => x.t).join(""); i = j; continue; }
    out += vals.map(show).join(" and ");
    i = j;
  }
  // digits with a scale: "12k", "$4.5 thousand", "1.2 million", "4 grand" (not 401k, 403b, 457)
  return out.replace(/(\d+(?:\.\d+)?)\s?(k|K|thousand|grand|million|mil)\b(?!\s?\))/g, (m, n, k) => {
    if (/^(?:401|403|457)$/.test(n) && /^k$/i.test(k)) return m;
    return show(Number(n) * (/^k$|thousand|grand/i.test(k) ? 1000 : 1e6));
  });
}

// ---------------------------------------------------------------- which sentences are about debts
// Words that name a debt on their own ("card", "loan", "mortgage", a card's brand, "car payment"), and words that do
// only beside "owe" ("I owe 2,000 on the car", "I owe my mom 500"): "car insurance is 120 a month" is no debt.
const STRONG = /\b(?:credit cards?|store cards?|cards?|visa|mastercard|master card|amex|american express|discover|loans?|mortgages?|heloc|line of credit|apr|(?:car|auto|truck|house|home|student loan|card) payments?)\b/i;
const WEAK = /\b(?:car|auto|truck|van|motorcycle|boat|rv|house|home|condo|medical|hospital|doctor|dentist|irs|taxes|tax bill|mom|mother|dad|father|parents?|brother|sister|family|friend|bills?|debts?|college|school|tuition|payday)\b/i;
const OWE = /\b(?:owe|owes|owed|owing|in debt)\b/i;
const RATE_SAID = /\d\s*(?:%|percent\b|per\s?cent\b|pct\b)|\bapr\b|\binterest rate\b|\brate (?:is|of|at)\b/i;
const MONTHLY = /\b(?:a|per|each|every)\s+(?:month|mo)\b|\/\s?mo(?:nth)?\b|\bmonthly\b|\bminimum\b/i;
const MINIMUM = /\bminimum\b/i;
const PAST_MONEY = /\b(?:spent|paid|bought|charged|tipped|received|earned|deposited|refunded)\b/i;
/**
 * isDebtSentence(s) -> true when a sentence describes debts: with a number, it says "owe" ("owed", "owing", "in debt")
 * beside a debt word, a rate or a payment a month; or, without "owe", a word that names a debt (card, Visa, loan,
 * mortgage, "car payment"...) beside a rate (percent, %, APR, "interest rate") or "minimum". A payment a month alone is
 * no debt ("Netflix 15 a month on my Visa card", "Rent is 1500 a month, car payment 300 a month", "Put 25 a month
 * toward the loan" read as before: fix round 1, 2026-11-16). Money said as spent or paid with no "owe" is the Ledger's
 * ("Paid 300 on the card"), never a debt.
 */
export function isDebtSentence(s) {
  const t = numberWords(s);
  if (!/\d/.test(t)) return false;
  const owe = OWE.test(t);
  if (PAST_MONEY.test(t) && !owe) return false;
  const rate = RATE_SAID.test(t), pay = MONTHLY.test(t);
  if (owe) return STRONG.test(t) || WEAK.test(t) || rate || pay;
  return STRONG.test(t) && (rate || MINIMUM.test(t));
}

// ---------------------------------------------------------------- reading one sentence
const STOP = new Set(("at and with paying pay pays which that for of i we is are was were has have had by but so plus then total each interest rate apr "
  + "percent pct minimum min month monthly payment payments it its about around roughly a an the also too now still left owe owes owed owing right currently "
  + "balance due ending every per in on to from my our your his her their this these those or if when while because since until after before as just only "
  + "over under nearly almost dollars bucks i'm i’m i've we're both all one ones other another respectively each limit off").split(" "));
const MONTHS_DAYS = /^(?:january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday)$/i;
const NAME_WORD = /^(?:[A-Za-z][A-Za-z'’&.-]*|40[13]\(?[kb]\)?|457)$/i;
/** The words of a name starting at index i of t (at most four, up to a word of STOP, a number or a mark), or null. */
function phraseAt(t, i) {
  const words = [];
  let at = i, end = i;
  const re = /\s*([^\s,;:!?()]+(?:\([kb]\))?)/gy;
  re.lastIndex = i;
  let m;
  while (words.length < 4 && (m = re.exec(t))) {
    const w = m[1].replace(/[.]+$/, "");
    if (!NAME_WORD.test(w) || STOP.has(w.toLowerCase()) || /^\d/.test(w)) break;
    if (!words.length) at = m.index + m[0].length - m[1].length;
    words.push(w);
    end = m.index + m[0].length - (m[1].length - w.length);
  }
  return words.length ? { text: words.join(" "), start: at, end } : null;
}
/** A name worth reading: a debt word, or a word in capitals that is no day or month ("Chase", "Sallie Mae"). */
// words a sentence starts with in capitals that name no one ("Paid 300 on my Visa", "Still owe 4,000")
// (fix round 1, 2026-11-16: verbs too, "Put 25 a month toward the loan" named a debt "Put")
const NOT_NAME = /^(?:i|i'm|i’m|we|my|the|and|also|plus|then|total|so|but|paid|spent|bought|got|owe|owed|owing|still|about|around|roughly|nearly|almost|just|only|have|has|had|need|want|after|before|now|currently|right|put|puts|putting|pay|pays|paying|move|moved|moving|send|sent|sending|transfer|transferred|add|added|give|gave|set|keep|kept|make|made|take|took|get|getting|charge|charged|use|used|split)$/i;
const nameOk = (p) => !!p && !/^(?:debts?|bills?|in debt)$/i.test(p.text) && (STRONG.test(p.text) || WEAK.test(p.text) || (/^[A-Z]/.test(p.text) && !MONTHS_DAYS.test(p.text.split(" ")[0]) && !NOT_NAME.test(p.text.split(" ")[0])));
/** The words a debt is known by, to tell two sayings of one debt apart: "my Visa" and "Visa card" are both "visa". */
export const debtKey = (name) => clean(name).toLowerCase().replace(/^(?:my|the|our|a|an)\s+/, "").replace(/['’]s\b/g, "")
  .replace(/\s+(?:card|loan|account|debt|balance|bill|payment)s?$/, "").replace(/(?<=\w{3})s$/, "");
/** The kind of debt a name says: a card, a car or personal loan, a mortgage, a student loan, else something else owed. */
export function debtType(name) {
  const t = clean(name).toLowerCase();
  if (/\b(?:home equity|heloc)\b/.test(t)) return "loan";
  if (/\b(?:mortgage|house|home loan|home|condo)\b/.test(t)) return "mortgage";
  if (/\b(?:student|college|school|tuition|sallie mae|navient)\b/.test(t)) return "student_loan";
  if (/\b(?:credit|cards?|visa|mastercard|master card|amex|american express|discover)\b/.test(t)) return "credit";
  if (/\b(?:car|auto|truck|van|motorcycle|boat|rv|loans?)\b/.test(t)) return "loan";
  return "other_liability";
}
/** How a debt said in a note is named: "the car" -> "Car loan", "house" -> "Mortgage", "credit card debt" -> "Credit card". */
export function debtName(phrase) {
  let p = clean(phrase).replace(/^(?:my|the|our|a|an|his|her|their)\s+/i, "").replace(/\s+(?:debt|balance)$/i, "");
  const low = p.toLowerCase();
  if (/^(?:car|auto|truck|van|motorcycle|boat|rv)$/.test(low)) return `${upperFirst(low)} loan`;
  if (/^(?:house|home|condo)$/.test(low)) return "Mortgage";
  if (/^(?:card|credit card)$/.test(low)) return "Credit card";
  if (/^(?:cards|credit cards)$/.test(low)) return "Credit cards";
  return upperFirst(p).slice(0, MAX_NAME);
}

/** Every number of a sentence with what it is said to be: owed, rate, payment, paid (money spent), or skipped. */
function numbersOf(t) {
  const out = [];
  for (const m of t.matchAll(/(\$\s?)?(?<![\d.,])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\d,]*\d)/g)) {
    const start = m.index, end = m.index + m[0].length, before = t.slice(0, start).toLowerCase(), after = t.slice(end).toLowerCase();
    const value = Number(m[2].replace(/,/g, "")), dollar = !!m[1];
    // a day, a time or a date ("the 15th", "3:30", "12/1"), a plan's name (401k), a card's last digits, a year
    if (/^(?:st|nd|rd|th)\b/.test(after) || /^[:/]\d/.test(after) || /\d[/:]$/.test(before)) continue;
    if (/^\s?\(?[kb]\)?/.test(after) && /^(?:401|403)$/.test(m[2])) continue;
    if (/(?:ending|ends)\s+(?:in\s+|with\s+)?$|last\s+(?:four|4)\s+(?:digits\s+)?(?:are\s+)?$/.test(before)) continue;
    if (!dollar && /^(?:19|20)\d\d$/.test(m[2]) && /\b(?:in|since|until|by|from|of|year|back in)\s+$/.test(before)) continue;
    // a count ("2 cards", "60 months", "0% for 12 months"): no figure of a debt
    if (!dollar && /^\s*(?:cards?|loans?|debts?|kids?|children|people|times|years?|yrs?|months?|mos?|weeks?|days?|payments?\s+left|more\s+payments?|of\s+them|accounts?)\b/.test(after)) continue;
    let role = "owed";
    if (/\b(?:spent|paid|bought|charged|tipped)\s+(?:about\s+|around\s+|roughly\s+)?\$?\s?$/.test(before)) role = "paid";
    else if (/^\s*(?:dollars\s+|bucks\s+)?(?:in\s+)?interest\b/.test(after) && !/^\s*(?:%|percent)/.test(after)) role = "skip";
    else if (/^\s*(?:dollars\s+|bucks\s+)?(?:(?:a|per|each|every)\s+(?:month|mo|mth)\b|\/\s?mo(?:nth)?\b|monthly\b|(?:minimum|min)\b)/.test(after)) role = "payment";
    else if (/^\s*(?:%|percent\b|per\s?cent\b|pct\b|apr\b)/.test(after)) role = "rate";
    else if (/\b(?:rate|apr|interest)(?:\s+rate)?(?:\s+(?:is|of|at|was|now|still|are))*\s*:?\s*(?:about\s+|around\s+|roughly\s+|like\s+)?$/.test(before) && !dollar) role = "rate";
    else if (/\b(?:limit|credit line)(?:\s+(?:is|of))?\s*:?\s*\$?\s?$/.test(before) || /^\s*(?:dollars\s+)?(?:credit\s+)?limit\b/.test(after)) role = "skip";
    else if (/\b(?:paying|pay|pays|payments?|minimum(?:\s+payment)?|min(?:imum)?\s+payment)(?:\s+(?:is|are|of|at|about|around|roughly|like|just|only|now|still))*\s*:?\s*(?:about\s+|around\s+|roughly\s+|like\s+|just\s+|only\s+)?\$?\s?$/.test(before)) role = "payment";
    else if (/\bat\s+(?:about\s+|around\s+|roughly\s+)?$/.test(before) && !dollar && value <= 100 && !/^\s*(?:dollars|bucks|grand)\b/.test(after)) role = "rate";
    // a rate is at most 100 a year
    if (role === "rate" && value > 100) role = "skip";
    out.push({ kind: "num", role, value, start, end, said: m[0].trim(), strong: role === "owed" && /\b(?:owe|owes|owed|owing|balance(?:\s+(?:is|of))?|is|are|has|have|was|still)\s+(?:about\s+|around\s+|roughly\s+|nearly\s+|almost\s+|over\s+|under\s+|just\s+)?\$?\s?$/.test(before) });
  }
  return out;
}
/** The names a sentence gives debts, with where they are: after on/for/to/with/from/at, before is/has/a number, or after a number. */
function namesOf(t) {
  const found = [];
  const add = (p, lead) => { if (nameOk(p)) found.push({ kind: "name", text: p.text, start: p.start, end: p.end, lead }); };
  for (const m of t.matchAll(/\b(?:on|for|to|with|from|towards?|at|in|of)\s+(?:my|the|our|a|an|his|her|their|that|this)?\s*/gi)) add(phraseAt(t, m.index + m[0].length), m.index);
  // "my Visa is 4,000", "the car loan has 12,000", "Visa: 4,000", "car 12,000" (at the start of a part of the sentence)
  for (const m of t.matchAll(/(?:^|[,;:]\s*|\b(?:and|then|plus|also)\s+)(?:(?:my|the|our)\s+)?/gi)) {
    const p = phraseAt(t, m.index + m[0].length);
    if (p && /^\s*(?:(?:payments?|minimum(?:\s+payment)?|interest\s+rate|rate|apr|balance)\s+)?(?:is|are|has|have|was|balance|sits|stands|comes|of|:|-|,)?\s*(?:at\s+|about\s+|around\s+)?\$?\s?\d/i.test(t.slice(p.end))) add(p, m.index + m[0].length);
  }
  // a debt word with its own amount inside a part of the sentence: "I have a student loan of 18,000", "and the car loan is
  // 12,000" (fix round 1, 2026-11-16: the student loan went unnamed and took the name said after it, the plan's Mortgage)
  for (const m of t.matchAll(/\b(?:a|an|my|the|our)\s+/gi)) {
    const p = phraseAt(t, m.index + m[0].length);
    if (p && (STRONG.test(p.text) || WEAK.test(p.text)) && /^\s*(?:of|is|was|are|:|-)\s*(?:at\s+|about\s+|around\s+|roughly\s+)?\$?\s?\d/i.test(t.slice(p.end))) add(p, m.index + m[0].length);
  }
  // who is owed: "I owe my mom 2,000", "we owe the IRS 3,000", "owe Chase 4,000"
  for (const m of t.matchAll(/\bow(?:e|es|ed|ing)\s+(?:my|the|our|his|her|their)?\s*/gi)) add(phraseAt(t, m.index + m[0].length), m.index + m[0].length);
  // "a 200,000 mortgage", "12,000 car loan", "4,000 in credit card debt" (a debt word only)
  for (const m of t.matchAll(/\d(?:\s*(?:dollars|bucks))?\s+(?:in\s+|of\s+)?/g)) {
    const p = phraseAt(t, m.index + m[0].length);
    if (p && (STRONG.test(p.text) || WEAK.test(p.text))) add(p, m.index + 1);
  }
  // one per place: the first found of two that share words
  const out = [];
  for (const n of found.sort((a, b) => a.start - b.start || b.end - a.end)) if (!out.some((o) => n.start < o.end && o.start < n.end)) out.push(n);
  return out;
}
// what may stand between a number and a name that belongs to it ("4,000 on my Visa", "300 a month on the Visa")
const JOIN = /^\s*(?:dollars|bucks)?\s*(?:(?:a|per|each|every)\s+month\s*)?(?:on|for|to|with|from|at|in|of)?\s*(?:my|the|our|that|this)?\s*$/i;
const BETWEEN_LIST = /^\s*(?:%|percent|per\s?cent)?\s*(?:,\s*)?(?:and|&|or|,)\s*\$?\s?$/i;

/**
 * readDebts(sentence, plan) -> { debts: [{ name, type, owed, rate (a fraction), payment, accountId }], unplaced: [said],
 * paid: [said] }. The numbers are read with numberWords; each is what is owed, a rate (before "percent" or "%", after
 * "rate is" or "at" when it is 100 or less), a payment (before "a month" or "monthly", after "paying" or "minimum"),
 * money paid (after "paid" or "spent": the Ledger's, said plainly) or a count ("2 cards"). What is owed starts a debt;
 * a name (after on, for, to... or before "is" or a number) goes with the debt said just before it that has none, else
 * the next one. A rate or a payment goes with the last debt said before it that lacks one (else the next); two or more
 * in a row ("at 24 and 6 percent", "paying 300 and 410 a month") go to the debts in the order they were said, when
 * there are as many; a name said again ("410 on the car") points at its debt. A figure that fits nowhere is left out and
 * listed in `unplaced`, never guessed. A name said with no amount (an update: "my Visa is at 26 percent now") is a debt
 * with nothing owed said. accountId: the liability account in the plan the debt is (matchDebt), "" for a new one;
 * heard: the name as the note said it, only when it found that account by its kind alone ("my credit card" for the plan's
 * one card, the Visa card), so the record can ask "Is this your Visa card?".
 */
export function readDebts(sentence, plan) {
  const t = numberWords(sentence);
  const nums = numbersOf(t), names = namesOf(t);
  const nm = (n) => ({ ...n, key: debtKey(debtName(n.text)) });
  const mentions = [...nums, ...names.map(nm)].sort((a, b) => a.start - b.start);
  const debts = [], unplaced = [], paid = nums.filter((n) => n.role === "paid").map((n) => n.said);
  for (const n of nums) if (n.role === "skip") unplaced.push(n);
  const between = (a, b) => t.slice(a.end, b.start ?? b.lead);
  const nextOf = (i) => mentions[i + 1] ?? null, prevOf = (i) => mentions[i - 1] ?? null;
  // forward and backward in a list: "paying 300 and 410." and "300 and 410 a month", "24 and 6 percent"
  const fits = (role, n) => role === "payment" || (role === "rate" && n.value <= 100);
  for (let i = mentions.length - 1; i >= 0; i--) {
    const m = mentions[i], nx = nextOf(i);
    if (m.kind === "num" && m.role === "owed" && !m.strong && nx?.kind === "num" && (nx.role === "rate" || nx.role === "payment") && fits(nx.role, m) && BETWEEN_LIST.test(between(m, nx))) m.role = nx.role;
  }
  mentions.forEach((m, i) => {
    const pv = prevOf(i), nx = nextOf(i);
    if (m.kind === "num" && m.role === "owed" && !m.strong && pv?.kind === "num" && (pv.role === "rate" || pv.role === "payment") && fits(pv.role, m) && BETWEEN_LIST.test(between(pv, m)) && !(nx?.kind === "name" && JOIN.test(between(m, nx)))) m.role = pv.role;
  });
  const byKey = (k) => (k ? debts.find((d) => d.key === k) : null);
  let pending = null, lastRole = null;
  const open = (name, at) => { const d = { name: name?.text ?? "", key: name?.key ?? "", at, owed: null, rate: null, payment: null }; debts.push(d); return d; };
  // a name followed by its own amount ("my mortgage is 250k", "a student loan of 18,000")
  const ownAmount = (name, nx) => nx?.kind === "num" && nx.role === "owed" && /^\s*(?:is|are|has|have|was|of|balance|:|-|,)?\s*(?:at\s+|about\s+|around\s+)?\$?\s?$/i.test(between(name, nx));
  mentions.forEach((m, i) => {
    const pv = prevOf(i), nx = nextOf(i);
    if (m.kind === "name") {
      if (byKey(m.key)) { m.ref = byKey(m.key); return; }
      // a name with an amount of its own starts its own debt; it never names an earlier one (fix round 1, 2026-11-16:
      // "a student loan of 18000 at 5.5 percent and my mortgage is 250k" named the 18,000 "Mortgage", the plan's)
      const unnamed = ownAmount(m, nx) ? null : debts.find((d) => !d.name && d.at < m.start);
      if (unnamed) { unnamed.name = m.text; unnamed.key = m.key; return; }
      if (pending) open(pending, pending.start);
      pending = m;
      return;
    }
    if (m.role === "rate" || m.role === "payment") lastRole = m.role;
    if (m.role !== "owed") return;
    // a number beside a name said before ("410 on the car" once the car is a debt): what that debt lacks, in the list's way
    const nameAfter = nx?.kind === "name" && JOIN.test(between(m, nx)) ? nx : null;
    const nameBefore = pv?.kind === "name" && /^\s*(?:is|are|has|have|was|of|balance|:|-|,)?\s*(?:at\s+|about\s+|around\s+)?\$?\s?$/i.test(between(pv, m)) ? pv : null;
    const ref = byKey(nameAfter?.key) ?? (nameBefore?.ref ? nameBefore.ref : null);
    if (ref) {
      if (ref.owed === null && !(lastRole && ref[lastRole] === null && !m.strong)) { ref.owed = m.value; return; }
      const role = lastRole && ref[lastRole] === null && fits(lastRole, m) ? lastRole : null;
      if (role) ref[role] = m.value; else unplaced.push(m);
      return;
    }
    const d = open(pending, pending ? pending.start : m.start);
    d.owed = m.value;
    pending = null;
  });
  if (pending) open(pending, pending.start);
  // rates and payments: one alone goes to the debt said before it (else after); a list to the debts in order
  const roles = mentions.filter((m) => m.kind === "num" && (m.role === "rate" || m.role === "payment"));
  const lists = [];
  for (const m of roles) {
    const last = lists[lists.length - 1], prev = last?.[last.length - 1];
    if (prev && prev.role === m.role && mentions.indexOf(m) === mentions.indexOf(prev) + 1) last.push(m); else lists.push([m]);
  }
  for (const list of lists) {
    const role = list[0].role;
    // a name said again right beside it ("the Visa at 24", "300 on the Visa") says which debt
    const aimed = list.length === 1 ? (() => {
      const i = mentions.indexOf(list[0]), pv = prevOf(i), nx = nextOf(i);
      if (nx?.kind === "name" && JOIN.test(between(list[0], nx))) return byKey(nx.key);
      if (pv?.kind === "name" && pv.ref && /^\s*(?:is|are|has|was|:|,)?\s*(?:at\s+)?(?:about\s+|around\s+)?\$?\s?$/i.test(between(pv, list[0]))) return pv.ref;
      return null;
    })() : null;
    if (aimed) { if (aimed[role] === null) aimed[role] = list[0].value; else unplaced.push(list[0]); continue; }
    if (list.length === 1) {
      const m = list[0];
      const d = [...debts].reverse().find((x) => x.at < m.start && x[role] === null) ?? debts.find((x) => x.at > m.start && x[role] === null);
      if (d) d[role] = m.value; else unplaced.push(m);
      continue;
    }
    const lacking = debts.filter((x) => x[role] === null);
    if (lacking.length === list.length) list.forEach((m, k) => { lacking[k][role] = m.value; });
    else unplaced.push(...list);
  }
  const said = (n) => (n.role === "rate" ? `${n.value}%` : n.value.toLocaleString("en-US"));
  return {
    debts: debts.filter((d) => d.name || d.owed !== null).map((d) => {
      const name = d.name ? debtName(d.name) : "";
      const p = { name, type: debtType(d.name || ""), owed: d.owed, rate: d.rate === null ? null : Number((d.rate / 100).toPrecision(12)), payment: d.payment };
      return { ...p, ...matchOf(p, plan) };
    }),
    unplaced: [...new Set(unplaced.sort((a, b) => a.start - b.start))].map(said),
    paid,
  };
}

/** The plan's debts (liability accounts), in its order. */
export const debtAccounts = (plan) => (plan?.accounts ?? []).filter((a) => a?.id && isLiability(a.type));
// names that say only the kind of debt: such a name is matched by kind when the plan has exactly one debt of that kind
const GENERIC = new Set(["credit", "card", "loan", "car", "auto", "truck", "mortgage", "house", "home", "student", "personal", "car loan", "student loan"]);
/**
 * matchDebt({ name, type }, plan) -> the liability account in the plan this debt is, or null: the one whose name says
 * the same (debtKey: "my Visa" is "Visa card", "the car" is "Car loan"); else, for a name that says only the kind ("the
 * card", "the mortgage"), the one debt of that kind. Two that fit, or none: null (a new debt; the page warns when the
 * plan has others of that kind).
 */
export function matchDebt(p, plan) {
  const list = debtAccounts(plan), key = debtKey(p?.name);
  if (key) {
    const same = list.filter((a) => debtKey(a.name) === key);
    if (same.length === 1) return same[0];
    if (same.length > 1) return null;
  }
  // a debt with no name says no kind either: it is never matched by kind (fix round 1, 2026-11-16)
  if (key && GENERIC.has(key)) {
    const kind = list.filter((a) => a.type === p?.type);
    if (kind.length === 1) return kind[0];
  }
  return null;
}
/** matchDebt's account as { accountId, heard? }: heard is the name said when the account was found by its kind alone. */
export function matchOf(p, plan) {
  const a = matchDebt(p, plan);
  if (!a) return { accountId: "" };
  return debtKey(a.name) === debtKey(p?.name) ? { accountId: a.id } : { accountId: a.id, heard: clean(p?.name) };
}

// ---------------------------------------------------------------- one debt made safe to show and add
const numOr = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** The amounts written in a note, words read as numbers, to tell whether a figure the AI gives is really in it. */
const amountsIn = (text) => [...numberWords(text).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ""))).filter(Number.isFinite);
const listWords = (names) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
/**
 * finishDebt(p, plan, note, { guess, today }) -> { kind: "debt", name, type, owed, rate, payment, accountId, source,
 * unplaced, paid, problems, missing, canGuess, warnings, ready, heard? }. An account must be a debt in the plan (else the debt is new);
 * for one in the plan its name and kind are the account's. Figures: what is owed at least 0 (more than 0 for a new
 * debt), to the cent; a rate from 0 to 1 (100% a year); a payment above 0; else blank (null). problems (they block the
 * add): a new debt's name and what is owed; for one in the plan, at least one figure. missing (said plainly, never
 * blocking): the rate or the payment the note did not give, when the plan has no loan detail to keep. canGuess: with
 * one of the two said, our guess for the other goes in with it when it is added, as Debts does with a box left blank
 * (fix round 1, 2026-11-16: the rate said was dropped); worked out by adding the debt to a copy of the plan with `guess`
 * (ctx.guess: core/estimate), so the words before the tap say what the tap will do (false with no `guess`, outside US
 * dollars, or for a kind with no guess). Without it, a debt in the plan with only a rate or only a payment said has
 * nothing it can keep, and asks for the other.
 * warnings: a figure not in the note as written (the AI's), a payment that does not cover the interest (owed x rate /
 * 12), a payment above what is owed, other debts of that kind in the plan when this one is new, and "Is this your Visa
 * card?" when the debt in the plan was found by its kind alone (heard).
 */
export function finishDebt(p, plan, note = "", { guess = null, today = null } = {}) {
  const acct = debtAccounts(plan).find((a) => a.id === p?.accountId) ?? null;
  const row = acct ? (plan?.debts ?? []).find((d) => d?.accountId === acct.id) ?? null : null;
  const owedRaw = numOr(p?.owed), rateRaw = numOr(p?.rate), payRaw = numOr(p?.payment);
  const out = {
    kind: "debt",
    name: acct ? clean(acct.name) || "Debt" : clean(p?.name).slice(0, MAX_NAME),
    type: acct ? acct.type : own(DEBT_TYPES, p?.type) ? p.type : "other_liability",
    owed: owedRaw === null || owedRaw < 0 ? null : Math.round(owedRaw * 100) / 100,
    rate: rateRaw === null || rateRaw < 0 || rateRaw > 1 ? null : rateRaw,
    payment: payRaw === null || payRaw <= 0 ? null : Math.round(payRaw * 100) / 100,
    accountId: acct ? acct.id : "",
    source: clean(p?.source).slice(0, 2000),
    unplaced: Array.isArray(p?.unplaced) ? p.unplaced.map(String) : [],
    paid: Array.isArray(p?.paid) ? p.paid.map(String) : [],
    problems: [], missing: [], canGuess: false, warnings: [],
  };
  const heard = acct && typeof p?.heard === "string" ? clean(p.heard) : "";
  if (heard) out.heard = heard;
  if (!acct) {
    if (!out.name) out.problems.push("what it is called");
    if (!(out.owed > 0)) out.problems.push("how much you owe");
  } else if (out.owed === null && out.rate === null && out.payment === null) out.problems.push("a figure to change");
  if (!row && (out.rate === null || out.payment === null)) out.missing = [out.rate === null ? "rate" : null, out.payment === null ? "payment" : null].filter(Boolean);
  // our guess for the one not said: tried on a copy of the plan, exactly as the tap would add it
  if (out.missing.length === 1 && typeof guess === "function" && applies(plan ?? {})) {
    try { out.canGuess = applyDebts(structuredClone(plan), [{ ...out, ready: true }], { guess, today }).guessed.length === 1; } catch { out.canGuess = false; }
  }
  // a debt in the plan with no loan detail, only a rate or only a payment said and no guess for the other: nothing to keep
  if (acct && !row && out.owed === null && out.missing.length === 1 && !out.canGuess) { out.problems.push(out.rate === null ? "its interest rate too" : "its payment a month too"); out.missing = []; }
  if (rateRaw !== null && out.rate === null) out.warnings.push("The rate read is above 100% a year: type the rate from the statement.");
  if (note) {
    const said = amountsIn(note), inNote = (x) => said.some((y) => Math.abs(y - x) < 0.005);
    if ((out.owed !== null && !inNote(out.owed)) || (out.payment !== null && !inNote(out.payment)) || (out.rate !== null && !inNote(Number((out.rate * 100).toPrecision(12))))) out.warnings.push("A figure here is not in your note as written: check it.");
  }
  const owed = out.owed ?? (acct ? Math.abs(Number(acct.balance) || 0) : null), rate = out.rate ?? (row ? Number(row.rate) : null), pay = out.payment ?? (row ? Number(row.minPayment) : null);
  if (owed > 0 && rate > 0 && pay > 0 && pay <= owed * rate / 12 + 1e-9) out.warnings.push(`At ${money(pay)} a month this debt never pays off: its interest is about ${money(owed * rate / 12)} a month. Check the payment.`);
  else if (owed > 0 && pay > owed) out.warnings.push("The payment is more than what is owed: check both.");
  if (!acct) {
    const others = debtAccounts(plan).filter((a) => a.type === out.type).map((a) => clean(a.name) || "Debt");
    if (others.length) out.warnings.push(`Your plan already has ${listWords(others)}. If this is ${others.length === 1 ? "it" : "one of them"}, tap Edit and pick it under "In your plan".`);
  }
  if (heard) out.warnings.push(`Is this your ${out.name}? It is the one ${(DEBT_TYPES[out.type] ?? "debt").toLowerCase()} in your plan. If not, tap Edit and pick "A new debt" under "In your plan".`);
  out.ready = out.problems.length === 0;
  return out;
}

// ---------------------------------------------------------------- adding them
/**
 * The entries of a list that aim at a debt an earlier entry already aims at: the same debt in the plan, or a new debt of
 * the same name (debtKey). -> Set of their indexes. Such an entry is not added (fix round 1, 2026-11-16: the last one
 * won, or a second account of the same name went in).
 */
export function repeats(list) {
  const seen = new Set(), out = new Set();
  (list ?? []).forEach((p, i) => {
    const k = p?.accountId ? `plan:${p.accountId}` : debtKey(p?.name) ? `new:${debtKey(p.name)}` : "";
    if (!k) return;
    if (seen.has(k)) out.add(i); else seen.add(k);
  });
  return out;
}
/**
 * Our guess for the figure not said, put on a loan detail row as Debts puts one when its box is left blank: the estimate
 * for this kind of debt (core/estimate, `debt.<kind>.rate` or `.payment`, read with the row as it now is, so a payment
 * is worked out from the rate said), marked as ours (markGuess). -> true when it went in.
 */
function guessInto(draft, acct, row, field, guess, today) {
  if (typeof guess !== "function" || !applies(draft)) return false;
  const kind = /^setup-owe-(.+)$/.exec(acct.id)?.[1] ?? debtKind(draft, row);
  let est = null;
  try { est = guess(`debt.${kind}.${field === "rate" ? "rate" : "payment"}`, { plan: draft, path: `debts[${row.id}].${field}` }); } catch { est = null; }
  if (!est || typeof est.value !== "number" || !Number.isFinite(est.value) || (field === "minPayment" ? est.value <= 0 : est.value < 0)) return false;
  return markGuess(draft, `debts[${row.id}].${field}`, est, today) || row[field] === est.value;
}
/**
 * applyDebts(draft, list, { id, today, guess }) -> { added, updated, bare, guessed, dropped, later, repeated }. Changes
 * `draft` in place, for each ready debt:
 * - new: a liability account as Net worth adds one ({ id, name, type, institution: "", balance: what is owed, asOf:
 *   today, ownerId: "", history: [], notes: "from a voice note" }) and its loan detail as Debts keeps it ({ id, accountId,
 *   rate, minPayment, extra: 0 }) when the rate or the payment is known: the one not said is our guess (guess: ctx.guess,
 *   `guessed`), as Debts does with a box left blank, so no debt shows "$0 a month"; with no guess for it, the figure
 *   said is not kept (`dropped`) and the account goes in alone; with neither said, it goes in alone (`bare`: Debts asks
 *   for both, as for a loan added on Net worth);
 * - one in the plan: what is owed through Account detail's saveBalance (that day's point, and the balance on file when
 *   it is the newest, then markTyped; a balance on file dated after today stays: `later`), the rate and the payment
 *   said into its loan detail (one made as for a new debt when there is none); our guess marks on what was said are
 *   cleared (core/estimate clearGuess, older plans' rateGuessed and paymentGuessed too), so a figure said is the
 *   person's. It is `updated` only when something the plan counts was written (fix round 1, 2026-11-16).
 * A debt not ready, one whose account has gone since, and a repeat (repeats) are left out.
 * Names: added, updated, bare, repeated; guessed and dropped: [{ name, what: "rate" | "payment", value }];
 * later: [{ name, owed, onFile, asOf }].
 */
export function applyDebts(draft, list, { id, today, guess } = {}) {
  const out = { added: [], updated: [], bare: [], guessed: [], dropped: [], later: [], repeated: [] };
  if (!Array.isArray(draft.accounts)) draft.accounts = [];
  if (!Array.isArray(draft.debts)) draft.debts = [];
  const uid = typeof id === "function" ? id : (() => { let n = 0; return () => `voice-debt-${++n}`; })();
  const twice = repeats(list);
  // a loan detail with the figure said and our guess for the other; none when there is no guess
  const detail = (acct, name, rate, payment) => {
    const row = { id: uid(), accountId: acct.id, rate, minPayment: payment, extra: 0 };
    draft.debts.push(row);
    const field = rate === null ? "rate" : "minPayment";
    if (guessInto(draft, acct, row, field, guess, today)) { out.guessed.push({ name, what: field === "rate" ? "rate" : "payment", value: row[field] }); return true; }
    draft.debts.splice(draft.debts.indexOf(row), 1);
    out.dropped.push({ name, what: rate === null ? "payment" : "rate", value: rate === null ? payment : rate });
    return false;
  };
  (list ?? []).forEach((p, i) => {
    if (!p?.ready) return;
    if (twice.has(i)) { out.repeated.push(clean(p.name) || "Debt"); return; }
    if (!p.accountId) {
      const acct = { id: uid(), name: p.name, type: own(DEBT_TYPES, p.type) ? p.type : "other_liability", institution: "", balance: p.owed, asOf: today ?? "", ownerId: "", history: [], notes: "from a voice note" };
      draft.accounts.push(acct);
      if (p.rate !== null && p.payment !== null) draft.debts.push({ id: uid(), accountId: acct.id, rate: p.rate, minPayment: p.payment, extra: 0 });
      else if (p.rate !== null || p.payment !== null) detail(acct, p.name, p.rate, p.payment);
      else out.bare.push(p.name);
      out.added.push(p.name);
      return;
    }
    const acct = draft.accounts.find((a) => a?.id === p.accountId && isLiability(a.type));
    if (!acct) return;
    const name = clean(acct.name) || "Debt";
    let wrote = false;
    if (p.owed !== null) {
      const r = saveBalance(draft, acct.id, today, p.owed);
      if (r.onFile) { markTyped(draft, acct.id, today); clearGuess(draft, `accounts[${acct.id}].balance`); wrote = true; }
      else if (r.saved) out.later.push({ name, owed: p.owed, onFile: Math.abs(Number(acct.balance) || 0), asOf: acct.asOf });
    }
    const row = draft.debts.find((d) => d?.accountId === acct.id);
    if (row) {
      if (p.rate !== null) { row.rate = p.rate; if (typeof row.id === "string") clearGuess(draft, `debts[${row.id}].rate`); wrote = true; }
      if (p.payment !== null) { row.minPayment = p.payment; if (typeof row.id === "string") clearGuess(draft, `debts[${row.id}].minPayment`); wrote = true; }
    } else if (p.rate !== null && p.payment !== null) {
      draft.debts.push({ id: uid(), accountId: acct.id, rate: p.rate, minPayment: p.payment, extra: 0 });
      wrote = true;
    } else if (p.rate !== null || p.payment !== null) {
      if (detail(acct, name, p.rate, p.payment)) wrote = true;
    } else if (wrote) out.bare.push(name);
    if (wrote) out.updated.push(name);
  });
  return out;
}

// ---------------------------------------------------------------- the written sentences (one per case)
const pctWords = (rate) => `${Number((rate * 100).toPrecision(10))}%`;
/**
 * The line under a debt for a figure the note did not give (none when nothing is missing), one sentence per case. With
 * one of the two said and our guess for the other (canGuess), the one said is kept and the other is our guess until
 * typed (fix round 1, 2026-11-16: a 24% said was dropped for want of a payment, without a word); with no guess for it,
 * the figure said is not kept, and that is said before the tap.
 */
export function missingWords(p, currency = "USD") {
  const m = p?.missing ?? [];
  if (m.includes("rate") && m.includes("payment")) return "You did not say the interest rate or the monthly payment. Tap Edit to type them, or add it now: the Debts page will ask for both.";
  const rate = typeof p?.rate === "number" ? `the ${pctWords(p.rate)}` : "the rate", pay = typeof p?.payment === "number" ? `the ${money(p.payment, currency)} payment` : "the payment";
  if (m.includes("rate")) return p?.canGuess ? `You did not say the interest rate. Tap Edit to type it, or add it now: ${pay} is kept, and the rate is our guess until you type yours.` : `You did not say the interest rate. Tap Edit to type it: the Debts page needs it with ${pay}, so without it ${pay} is not kept.`;
  if (m.includes("payment")) return p?.canGuess ? `You did not say the monthly payment. Tap Edit to type it, or add it now: ${rate} is kept, and the payment is our guess until you type yours.` : `You did not say the monthly payment. Tap Edit to type it: the Debts page needs it with ${rate}, so without it ${rate} is not kept.`;
  return "";
}
/** Figures of the note no debt could take ("300", "24%"), said once. */
export function unplacedWords(list) {
  const l = [...new Set(list ?? [])];
  if (!l.length) return "";
  return l.length === 1 ? `The app could not tell which debt ${l[0]} goes with: tap Edit on the right debt to type it.` : `The app could not tell which debt ${listWords(l)} go with: tap Edit on each debt to type them.`;
}
/** Money said as paid inside a debt sentence: the Ledger's, not added here. */
export function paidWords(list) {
  const l = [...new Set(list ?? [])];
  if (!l.length) return "";
  return l.length === 1 ? `Money paid (${l[0]}) is not added here: say it in a sentence of its own to add it to the Ledger.` : `Money paid (${listWords(l)}) is not added here: say each in a sentence of its own to add it to the Ledger.`;
}
const owner = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
/**
 * The green line after "Add these debts" (applyDebts' result), one sentence per case: what was added or updated; a rate
 * or a payment that is our guess for now; a debt with neither; a figure said that could not be kept; a balance that
 * stays because the one on file is dated later; a debt given twice.
 */
export function doneWords(r, currency = "USD") {
  const a = r?.added ?? [], u = r?.updated ?? [], b = r?.bare ?? [];
  const out = [];
  if (a.length && u.length) out.push(`Added ${listWords(a)} and updated ${listWords(u)}.`);
  else if (a.length) out.push(`Added ${listWords(a)} to your debts.`);
  else if (u.length) out.push(`Updated ${listWords(u)}.`);
  for (const what of ["payment", "rate"]) {
    const g = (r?.guessed ?? []).filter((x) => x.what === what).map((x) => x.name);
    const words = what === "rate" ? "interest rate" : "monthly payment";
    if (g.length === 1) out.push(`${owner(g[0])} ${words} is our guess for now: type the real one on the Debts page.`);
    else if (g.length > 1) out.push(`The ${words}s of ${listWords(g)} are our guesses for now: type the real ones on the Debts page.`);
  }
  if (b.length) out.push(`${listWords(b)} ${b.length === 1 ? "has" : "have"} no rate or payment yet: give them on the Debts page.`);
  for (const d of r?.dropped ?? []) out.push(d.what === "rate" ? `${owner(d.name)} ${pctWords(d.value)} is not kept: the Debts page needs the monthly payment with it.` : `${owner(d.name)} ${money(d.value, currency)} payment is not kept: the Debts page needs the interest rate with it.`);
  for (const l of r?.later ?? []) out.push(`${owner(l.name)} ${money(l.owed, currency)} is kept for today, but the plan goes on using the balance dated ${dateWords(l.asOf)} (${money(l.onFile, currency)}), which is later.`);
  const rep = r?.repeated ?? [];
  if (rep.length) out.push(`${listWords(rep)} ${rep.length === 1 ? "was" : "were"} given twice: only the first is in.`);
  return out.length ? out.join(" ") : "Nothing was added.";
}
/** The amber line on a debt that another one above already is (repeats), before the tap. */
export function twiceWords(p) {
  return `Another debt above is also ${p?.name || "this one"}: skip one of them, or tap Edit and pick another under "In your plan".`;
}
/**
 * After "Add these debts" left some out: the green line points at them (each says on its own red line what it needs).
 * list: names, or { name, twice } for one left out as a second entry for the same debt ("the other Visa card").
 */
export function leftWords(list) {
  const l = (list ?? []).map((x) => (typeof x === "object" && x ? (x.twice ? `the other ${x.name || "debt"}` : x.name) : x) || "the debt with no name");
  if (!l.length) return "";
  return upperFirst(`${listWords(l)} ${l.length === 1 ? "is" : "are"} not added yet: ${l.length === 1 ? "it says" : "each says"} below what to change.`);
}
/** The red line on a debt left out at "Add these debts": what it still needs, or that another one above is the same debt. */
export function notAddedWords(p, repeated = false) {
  if (repeated) return `Not added: another entry is also ${p?.name || "this debt"}. Skip this one, or tap Edit and pick another under "In your plan".`;
  const need = p?.problems ?? [];
  if (need.includes("what it is called")) return `Not added yet: type its name below, then tap Add again.`;
  return `Not added yet: it still needs ${listWords(need)}. Type ${need.length === 1 ? "it" : "them"} below, then tap Add again.`;
}
/** The words after Undo, before ui.undoneWords adds its line when something was changed since. */
export function undoWords(r) {
  const names = [...(r?.added ?? []), ...(r?.updated ?? [])];
  return `Taken back: ${names.length ? listWords(names) : "those debts"} ${(r?.added ?? []).length && !(r?.updated ?? []).length ? `${names.length === 1 ? "is" : "are"} out of your plan again` : "are as they were"}. ${names.length === 1 ? "It is" : "They are"} listed below to change or add.`;
}
const COMPARE = "Pay off debts compares paying the highest interest rate first with the smallest balance first";
/** The words of payoffLine for each case (kind), with what the cheaper order saves, in dollars. */
export function payoffWords(kind, saves = 0, currency = "USD") {
  if (kind === "notyet") return `Once your debts have a rate and a payment, ${COMPARE}.`;
  if (kind === "one") return "Pay off debts shows the month your debt is paid off and what paying a little more would change.";
  if (kind === "never") return `${COMPARE}. One payment does not cover its interest yet: that page shows which.`;
  if (kind === "same") return `${COMPARE}: with your debts now, both cost about the same in interest.`;
  if (kind === "rate") return `${COMPARE}: with your debts now, the highest rate first saves about ${money(saves, currency)} in interest.`;
  return `${COMPARE}: with your debts now, the smallest balance first saves about ${money(saves, currency)} in interest.`;
}
/**
 * payoffLine(plan, today) -> { kind, text, saves? }: the one line pointing to Pay off debts after the add, with the
 * plan as it is now (debt/payoff compute: the same money each month paid highest interest rate first, `avalanche`, and
 * smallest balance first, `snowball`). kind: "notyet" (no debt with a rate and a payment), "one" (one debt: no order to
 * choose), "never" (a payment does not cover its interest), "same" (under $1 apart), "rate" or "smallest" (that order
 * pays less interest; saves = the difference, to the dollar).
 */
export function payoffLine(plan, today = null) {
  let r = null;
  try { r = payoff(plan, { today }); } catch { r = null; }
  const cur = plan?.meta?.currency ?? "USD";
  const line = (kind, saves) => ({ kind, ...(saves ? { saves } : {}), text: payoffWords(kind, saves, cur) });
  if (!r?.hasData) return line("notyet");
  if (r.debts.length === 1) return line("one");
  const a = r.plans.avalanche, s = r.plans.snowball;
  if (!Number.isFinite(a?.months) || !Number.isFinite(s?.months) || a.neverPaysOff?.length || s.neverPaysOff?.length) return line("never");
  const diff = Math.round(s.totalInterest - a.totalInterest);
  if (Math.abs(diff) < 1) return line("same");
  return diff > 0 ? line("rate", diff) : line("smallest", -diff);
}
