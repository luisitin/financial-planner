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
// whole month words only: "market" is not March, "Decathlon" not December
const MONTH_WORDS = "january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec";
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30 };
// a count said in figures or words, "twenty-one" too; never the end of a longer word ("twenty-one" is not "one")
const COUNT = `((?<![\\w-])(?:\\d{1,3}|(?:twenty|thirty)[- ](?:one|two|three|four|five|six|seven|eight|nine)|${Object.keys(NUMBER_WORDS).sort((x, y) => y.length - x.length).join("|")}))`;
const countOf = (w) => w.split(/[- ]/).reduce((sum, x) => sum + (NUMBER_WORDS[x] ?? Number(x)), 0);
// month words for "in September", "last March" ("may" only after in, early, late...: "this may be" is no month)
const MONTH_NO_MAY = MONTH_WORDS.split("|").filter((w) => w !== "may").join("|");
const PART_OF_DAY = "(?:\\s+(?:morning|afternoon|evening|night))?";   // "yesterday morning", "Friday night": still that day
const NOT_OWNED = "(?!['’]s\\b)";   // "next year's insurance" and "last week's bill" say what, not when
const parts = (iso) => iso.split("-").map(Number);
const addDays = (iso, n) => { const [y, m, d] = parts(iso); return isoOf(y, m, d + n); };
const weekday = (iso) => { const [y, m, d] = parts(iso); return new Date(y, m - 1, d).getDay(); };
// days, nights, weeks and fortnights counted in days ("a fortnight ago" is 14 days back)
const UNITS = "days?|nights?|weeks?|fortnights?";
const unitDays = (w) => ({ day: 1, night: 1, week: 7, fortnight: 14 })[w.replace(/s$/, "")];
const SEASONS = "summer|winter|spring|fall|autumn";
/** The n-th weekday `wd` (0 is Sunday) of a month (n = -1: the last one), as YYYY-MM-DD. */
const nthWeekday = (y, m, wd, n) => {
  if (n > 0) return isoOf(y, m, 1 + ((wd - new Date(y, m - 1, 1).getDay() + 7) % 7) + 7 * (n - 1));
  const last = new Date(y, m, 0).getDate();
  return isoOf(y, m, last - ((new Date(y, m - 1, last).getDay() - wd + 7) % 7));
};
/** Easter Sunday of a year, by the anonymous Gregorian rule (Meeus, Astronomical Algorithms, ch. 8). */
const easter = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, n = h + l - 7 * Math.floor((a + 11 * h + 22 * l) / 451) + 114;
  return isoOf(y, Math.floor(n / 31), (n % 31) + 1);
};
/** Holidays that are one day, the more exact names first ("Christmas Eve" before "Christmas"), and that day in a year. */
const HOLIDAYS = [
  ["christmas eve|xmas eve", (y) => isoOf(y, 12, 24)], ["christmas(?: day)?|xmas(?: day)?", (y) => isoOf(y, 12, 25)],
  ["new year['’]?s eve", (y) => isoOf(y, 12, 31)], ["new year['’]?s(?: day)?", (y) => isoOf(y, 1, 1)],
  ["halloween", (y) => isoOf(y, 10, 31)], ["valentine['’]?s(?: day)?", (y) => isoOf(y, 2, 14)],
  ["(?:the )?fourth of july|independence day", (y) => isoOf(y, 7, 4)],
  ["thanksgiving(?: day)?", (y) => nthWeekday(y, 11, 4, 4)], ["black friday", (y) => addDays(nthWeekday(y, 11, 4, 4), 1)],
  ["cyber monday", (y) => addDays(nthWeekday(y, 11, 4, 4), 4)], ["memorial day", (y) => nthWeekday(y, 5, 1, -1)],
  ["labor day", (y) => nthWeekday(y, 9, 1, 1)], ["mother['’]?s day", (y) => nthWeekday(y, 5, 0, 2)],
  ["father['’]?s day", (y) => nthWeekday(y, 6, 0, 3)], ["good friday", (y) => addDays(easter(y), -2)],
  ["easter(?: sunday| day)?", easter],
];
const HOLIDAY_NAMES = HOLIDAYS.map(([w]) => w).join("|");
// what may follow a holiday that names a day: the end, a mark, or a word that goes on the sentence ("on Christmas at
// the mall"); any other word makes it what was bought ("on Christmas gifts", "the Halloween store")
const FOLLOW = `(?=\\s*(?:$|[.,;:!?)–—-])|\\s+(?:and|or|but|so|then|with|using|from|at|for|to|on|in|into|by|via|i|we|my|our|he|she|they|it|was|is|again|too|also|last|this|next|when|while|because|before|after)\\b)`;
// "on Christmas", "last Thanksgiving", "Christmas Eve 2025" (never "for Christmas", what it was for, nor "over
// Christmas", some days around it: see VAGUE)
const HOLIDAY_DAY = new RegExp(`(?<!\\b(?:for|at|over|during|around|before|after|since|until|till|near|through|throughout|from)\\s+(?:the\\s+)?)\\b(?:(last|this past|past|next|this coming|coming|this|on|by)\\s+)?(${HOLIDAY_NAMES})\\b(?:,?\\s+(\\d{4})\\b)?${PART_OF_DAY}${FOLLOW}`);
// a span the rules cannot pin to one day: "within the last week", "the previous week", "the following Monday",
// "the first week of December"
const SPAN = new RegExp(`\\b(?:(?:the\\s+)?(?:first|last|final|second|third|fourth|1st|2nd|3rd|4th)\\s+(?:days?|weeks?|weekends?|${DAYS.join("|")})\\s+of\\s+(?:(?:the|this|last|next)\\s+(?:month|year)|${MONTH_WORDS})\\b|(?:(?:within|in|over|during|for|since|throughout|through)\\s+)?the\\s+(?:last|past|previous|prior|next|coming|following|same)\\s+(?:days?|nights?|mornings?|evenings?|weeks?|weekends?|fortnights?|months?|years?|${DAYS.join("|")})\\b${NOT_OWNED}|(?:previous|prior|following)\\s+(?:days?|nights?|weeks?|weekends?|months?|years?|${DAYS.join("|")})\\b${NOT_OWNED})`);
/** Some minutes or hours from now or ago: still today ("just now", "an hour ago", "in 2 hours"). */
const NOW = new RegExp(`\\b(?:just now|right now|a (?:moment|minute|second) ago|(?:${COUNT}|a few|a couple(?: of)?|several)\\s+(?:hours?|hrs?|minutes?|mins?)\\s+(?:ago|back|from now)|in\\s+(?:${COUNT}|a few|a couple(?: of)?)\\s+(?:hours?|hrs?|minutes?|mins?))\\b`);
/**
 * Words that name a time but not one day the rules can read: the day is asked for (date ""), never today. "this
 * week", "earlier this month", "over the past year", "early next month", "the end of the month", "over the weekend",
 * "the past few days", "a few weeks back", "2 months ago", "in a year", "in September", "last March", "mid-June",
 * "September 2026", "recently", "lately", "the other day", "a while ago", "earlier" at the end of a sentence; "the
 * week before last", "the week prior", "3 days later", "a week after the party", "2 weeks from Friday", "a day or
 * two ago", "that day"; a season ("last summer", "in the fall"); "over the holidays", "around Christmas", "on my
 * birthday"; and any other "... ago" ("ages ago").
 */
const VAGUE = new RegExp(`\\b(?:${[
  `(?:(?:over|during|in|within)\\s+(?:the\\s+)?)?(?:(?:earlier|later|early|late)\\s+(?:in\\s+)?)?(?:this past|this coming|this|last|next|past|previous|coming)\\s+(?:week|weekend|month|year)\\b${NOT_OWNED}`,
  `(?:(?:at|by|around|until)\\s+)?(?:the\\s+)?(?:end|beginning|start|middle)\\s+of\\s+(?:(?:the|this|last|next)\\s+(?:week|month|year)\\b${NOT_OWNED}|${MONTH_WORDS}\\b)`,
  "(?:over|during|on)\\s+the\\s+weekend\\b",
  `(?:(?:over|during|in|within)\\s+)?(?:the\\s+)?(?:past|last|next)\\s+(?:few|couple(?:\\s+of)?|several|${COUNT})\\s+(?:days|nights|weeks|months|years)\\b`,
  "(?:a few|a couple(?: of)?|several|some|many)\\s+(?:days?|nights?|weeks?|months?|years?)(?:\\s+(?:ago|back|later|earlier|before|after|prior|from now|from today))?\\b",
  `${COUNT}\\s+(?:months?|years?)\\s+(?:ago|back)\\b`,
  `in\\s+${COUNT}\\s+(?:months?|years?)\\b`,
  `(?:the\\s+)?(?:day|night|morning|evening|week|weekend|month|year)\\s+(?:before|after|prior|earlier|later)\\b(?:\\s+(?:last|next|the holidays|${HOLIDAY_NAMES})\\b)?`,
  `${COUNT}\\s+(?:${UNITS}|months?|years?)\\s+(?:from|after|before)\\s+(?:(?:this|next|last|the|my|our)\\s+)?[a-z0-9'’]+`,
  `${COUNT}\\s+(?:${UNITS}|months?|years?)\\s+(?:later|earlier|prior)\\b`,
  "(?:a|an|one|1)\\s+(?:day|night|week|month|year)\\s+or\\s+(?:two|so|2)(?:\\s+(?:ago|back))?",
  "that\\s+(?:day|night|morning|afternoon|evening|week|weekend|month|year)\\b",
  `(?:(?:at|over|during|around|before|after|since|until|till|near|through|throughout|on)\\s+)?(?:the\\s+)?(?:${HOLIDAY_NAMES}|${SEASONS})\\s+(?:time|season|week|weekend|break|holidays?|vacation)\\b${FOLLOW}`,
  `(?:in|during|over|through|throughout|since|until|by)\\s+(?:the\\s+)?(?:(?:early|late|mid-)\\s*)?(?:${SEASONS})\\b${NOT_OWNED}(?:\\s+(?:of\\s+)?\\d{4}\\b)?${FOLLOW}`,
  `(?:the\\s+)?(?:this past|this coming|this|last|next|past|coming|early|late|mid-)\\s*(?:${SEASONS})\\b${NOT_OWNED}(?:\\s+(?:of\\s+)?\\d{4}\\b)?${FOLLOW}`,
  `(?:${SEASONS})\\s+(?:of\\s+)?\\d{4}\\b`,
  "(?:over|during|around|before|after|since|until|at|through)\\s+the\\s+holidays\\b",
  `(?:at|over|during|around|before|after|since|until|till|near|through|throughout)\\s+(?:the\\s+)?(?:${HOLIDAY_NAMES})\\b${FOLLOW}`,
  `(?:on|before|after|since|until|by)\\s+(?:the\\s+)?(?:next\\s+|last\\s+)?payday\\b${FOLLOW}`,
  "(?:earlier|later|early|late)\\s+(?:in|on)\\s+the\\s+(?:week|weekend|month|year)\\b",
  "(?:on|before|after|around|since|until|by)\\s+(?:my|our|his|her|their|the|[a-z]+['’]s)\\s+(?:birthday|bday|anniversary)\\b",
  `(?:${MONTH_WORDS})\\s+(?:of\\s+)?(?:\\d{4}|this year|last year|next year)\\b`,
  `(?:(?:in|during|since|back in|early|late|earlier in|later in)\\s+|mid-?\\s*)(?:${MONTH_WORDS})\\b\\.?(?:,?\\s+\\d{4}\\b)?`,
  `(?:last|this|next|this past|past|coming)\\s+(?:${MONTH_NO_MAY})\\b\\.?`,
  "(?:recently|lately|the other (?:day|night|week))\\b",
  "(?:a while|a bit|a little while|some time|a long time|not long)\\s+(?:ago|back)\\b",
  "earlier(?=\\s*(?:[.!?;,]|$))",
  `(?:(?:${COUNT}|a few|a couple of|a couple|several|many|few|some|the)\\s+)?(?:${UNITS}|months?|years?|hours?|minutes?|(?:${DAYS.join("|")})s?)\\s+ago\\b`,
  "(?:(?:a|an|some|the)\\s+)?[a-z'’-]+\\s+ago\\b",
].join("|")})`);
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const upperFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const own = (obj, k) => typeof k === "string" && Object.hasOwn(obj, k);   // "toString" is no kind and no repeat
const PREP = /^(?:on|by|of|for|at|in|to)$/i;

/**
 * The first day a piece of text names, as YYYY-MM-DD, and the words that named it: { date, match }; { date: "", match }
 * when the words name a time but not one real day (February 31, "last month", "a few days ago"); null when it names
 * none. Reads 2026-12-01, 12/1 (or 12/1/2026; not "1/2 of"), "December 1" (or "Dec. 1st, 2026"), "1 December",
 * a holiday that is one day ("on Christmas", "Christmas Eve", "last Thanksgiving", "on Black Friday", "Mother's Day",
 * "Easter 2025"; not "Christmas gifts", "the Halloween store" or "for Halloween"), today, tonight, this afternoon,
 * earlier today, just now, an hour ago, yesterday (morning...), last night, tomorrow, the day before yesterday, the
 * night before last, the day after tomorrow, "N days ago" or "N days back", "in N days", "N days from now", "N days
 * from today" or "from tomorrow" (read before "today" alone), the same with weeks and fortnights (N a number, or a,
 * one... twenty, thirty, "twenty-one"), "next week", "last week", a weekday ("on Friday", "last Friday", "this past
 * Friday", "next Friday", "Friday night", "the Friday before last", "Tuesday last week"; not "Friday's"), "the 15th",
 * "the 15th of last month". A day with no year, a bare weekday, a holiday or "the 15th" is the latest one up to today
 * for something that happened (`dir` "past") and the next one from today for a reminder ("future"). SPAN and the VAGUE
 * words ("this week", "within the last week", "in September", "last summer", "the week before last", "ages ago"...)
 * give { date: "", match }.
 */
export function readDate(text, today, dir = "past") {
  const s = String(text ?? "").toLowerCase();
  const ok = (iso, match) => ({ date: iso && isValidDate(iso) ? iso : "", match });
  // a day that exists in that month (isoOf would roll February 31 over to March 3)
  const day = (y, m, d) => { const iso = isoOf(y, m, d); return d >= 1 && d <= 31 && Number(iso.slice(8)) === d ? iso : null; };
  const year = Number(today.slice(0, 4));
  const pick = (m, d, y) => {   // a month and day with no year: this year's, or the year before or after
    if (!(m >= 1 && m <= 12)) return null;
    if (y) return day(y, m, d);
    const here = day(year, m, d);
    if (dir === "past") return here && here <= today ? here : day(year - 1, m, d);
    return here && here >= today ? here : day(year + 1, m, d);
  };
  let m;
  if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s))) return ok(m[0], m[0]);
  // "1/2 of the rent" is a share, not January 2
  if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b(?!\s+of\b)/.exec(s))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    if (Number(m[1]) <= 12 && Number(m[2]) <= 31) return ok(pick(Number(m[1]), Number(m[2]), y), m[0]);
  }
  const mon = `(${MONTH_WORDS})\\b\\.?`;
  if ((m = new RegExp(`\\b${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`).exec(s))) return ok(pick(MONTHS[m[1].slice(0, 3)], Number(m[2]), m[3] ? Number(m[3]) : null), m[0]);
  if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}(?:,?\\s+(\\d{4}))?\\b`).exec(s))) return ok(pick(MONTHS[m[2].slice(0, 3)], Number(m[1]), m[3] ? Number(m[3]) : null), m[0]);
  // a holiday that is one day ("on Christmas", "last Thanksgiving"): this year's, or the year before or after, as above
  if ((m = HOLIDAY_DAY.exec(s))) {
    const at = HOLIDAYS.find(([w]) => new RegExp(`^(?:${w})$`).test(m[2]))[1];
    if (m[3]) return ok(at(Number(m[3])), m[0]);
    const said = m[1] === "last" || m[1] === "this past" || m[1] === "past" ? "last" : m[1] === "next" || m[1] === "this coming" || m[1] === "coming" ? "next" : "";
    const here = at(year), which = said === "last" ? "past" : said === "next" ? "future" : dir;
    if (which === "past") return ok(here < today || (!said && here === today) ? here : at(year - 1), m[0]);
    return ok(here > today || (!said && here === today) ? here : at(year + 1), m[0]);
  }
  if ((m = /\b(?:the\s+)?(?:day|night) before yesterday\b|\b(?:the\s+)?night before last\b/.exec(s))) return ok(addDays(today, -2), m[0]);
  if ((m = /\b(?:the\s+)?day after tomorrow\b/.exec(s))) return ok(addDays(today, 2), m[0]);
  // counted from today or tomorrow, before "today" and "tomorrow" alone: "two weeks from today", "a week from tomorrow"
  if ((m = new RegExp(`\\b${COUNT}\\s+(${UNITS})\\s+from\\s+(now|today|tonight|tomorrow|yesterday)\\b`).exec(s))) return ok(addDays(today, countOf(m[1]) * unitDays(m[2]) + ({ tomorrow: 1, yesterday: -1 }[m[3]] ?? 0)), m[0]);
  // the same with months or years, or a count the rules cannot read ("2 months from today", "a couple of weeks from now")
  if ((m = new RegExp(`\\b(?:(?:${COUNT}|a few|a couple(?: of)?|several|some|[a-z]+-[a-z]+)\\s+)?(?:${UNITS}|months?|years?)\\s+from\\s+(?:now|today|tonight|tomorrow|yesterday)\\b`).exec(s))) return ok(null, m[0]);
  // "the Friday before last" is a week before last Friday; "the Friday after next" a week after next Friday
  if ((m = new RegExp(`\\b(?:the\\s+)?(${DAYS.join("|")})\\s+(before last|after next)\\b`).exec(s))) {
    const want = DAYS.indexOf(m[1]), now = weekday(today);
    return ok(m[2] === "before last" ? addDays(today, -((now - want + 7) % 7 || 7) - 7) : addDays(today, ((want - now + 7) % 7 || 7) + 7), m[0]);
  }
  if ((m = new RegExp(`\\b(?:(?:late|early)\\s+)?(?:yesterday${PART_OF_DAY}|last (?:night|evening))\\b`).exec(s))) return ok(addDays(today, -1), m[0]);
  if ((m = new RegExp(`\\btomorrow${PART_OF_DAY}\\b`).exec(s))) return ok(addDays(today, 1), m[0]);
  if ((m = NOW.exec(s))) return ok(today, m[0]);
  if ((m = /\b(?:(?:earlier|later|early|late)\s+)?(?:this (?:morning|afternoon|evening)|tonight|today|in the day)\b/.exec(s))) return ok(today, m[0]);
  if ((m = new RegExp(`\\b${COUNT}\\s+(${UNITS})\\s+(?:ago|back)\\b`).exec(s))) return ok(addDays(today, -countOf(m[1]) * unitDays(m[2])), m[0]);
  if ((m = new RegExp(`\\bin\\s+${COUNT}\\s+(${UNITS})\\b`).exec(s))) return ok(addDays(today, countOf(m[1]) * unitDays(m[2])), m[0]);
  if ((m = SPAN.exec(s))) return ok(null, m[0]);
  // "Tuesday last week", "last week on Tuesday": that weekday in the week (Sunday to Saturday) before, this or after
  if ((m = new RegExp(`\\b(?:(?:on\\s+)?(${DAYS.join("|")})\\s+(?:of\\s+)?(last|this|next)\\s+week|(last|this|next)\\s+week(?:\\s+on)?\\s+(${DAYS.join("|")}))\\b${NOT_OWNED}`).exec(s))) {
    const want = DAYS.indexOf(m[1] ?? m[4]), k = { last: -1, this: 0, next: 1 }[m[2] ?? m[3]];
    return ok(addDays(today, want - weekday(today) + 7 * k), m[0]);
  }
  // "earlier last week" is some day that week: asked for
  if ((m = new RegExp(`\\b(?:(earlier|later|early|late)\\s+(?:in\\s+)?)?(next|last) week\\b${NOT_OWNED}`).exec(s))) return m[1] ? ok(null, m[0]) : ok(addDays(today, m[2] === "next" ? 7 : -7), m[0]);
  // "Friday's" is a name (a restaurant), not a day; "this past Friday" is last Friday, "this coming Friday" next
  // Friday; "Black Friday deals" and "Easter Sunday brunch" are no weekday
  if ((m = new RegExp(`(?<!\\b(?:black|good|cyber|easter)\\s+)\\b(?:(last|this past|past|next|this coming|coming|this|on)\\s+)?(${DAYS.join("|")})\\b(?!['’]s\\b)${PART_OF_DAY}\\b`).exec(s))) {
    const want = DAYS.indexOf(m[2]), now = weekday(today);
    const back = (now - want + 7) % 7, ahead = (want - now + 7) % 7;
    const said = m[1] === "this past" || m[1] === "past" ? "last" : m[1] === "this coming" || m[1] === "coming" ? "next" : m[1];
    const which = said === "last" ? "past" : said === "next" ? "future" : dir;
    const n = which === "past" ? -(back || (said === "last" ? 7 : 0)) : (ahead || (said === "next" ? 7 : 0));
    return ok(addDays(today, n), m[0]);
  }
  // "the 15th of last month", "the 1st of next month"
  if ((m = /\b(?:on\s+)?the (\d{1,2})(?:st|nd|rd|th)\s+of\s+(last|this|next)\s+month\b/.exec(s))) {
    const [y, mo] = parts(today);
    return ok(day(y, mo + { last: -1, this: 0, next: 1 }[m[2]], Number(m[1])), m[0]);
  }
  if ((m = /\bthe (\d{1,2})(?:st|nd|rd|th)\b/.exec(s))) {
    // this month's, else the nearest month that has that day, going back (past) or forward (future)
    const [y, mo] = parts(today), d = Number(m[1]);
    for (let k = 0; k <= 12; k++) {
      const iso = day(y, dir === "past" ? mo - k : mo + k, d);
      if (iso && (dir === "past" ? iso <= today : iso >= today)) return ok(iso, m[0]);
    }
    return ok(null, m[0]);
  }
  if ((m = VAGUE.exec(s))) return ok(null, m[0]);
  return null;
}

/** Counts that follow a number and make it no amount ("for 4 people", "3 nights", "2 tickets"). */
const COUNTS = "nights?|people|persons?|kids?|tickets?|times?|items?|pieces?";
/** Words after which a number is money. */
const MONEY_WORDS = "spent|spend|paid|pay|cost|costs|charged|got|received|earned|made|is at|is now|is|was|has|have|shows|balance|stands at";

/**
 * The first money amount in a piece of text: { amount, match (the amount as written), phrase (the same with a "for",
 * "of", "at", "to", "on" or "from" just before it, so a payee can lose both) } or null. "$42.17", "42 dollars", "42
 * bucks", or a number right after a money word ("spent 40", "paid 1,200", "is at 12,400", "has 3,000"), else right
 * after of, at, for or to ("of 85", "for 80"; so "Dinner for 4, paid 60" is 60). A minus sign
 * before it ("-$120") makes it negative (an overdrawn account). Never a bare number on its own, a time (3 pm, 12:30),
 * a percent (23.9%), a count (15 days, 4 people, the 15th), part of a date (11/1) or of a longer number (5.555).
 */
export function readAmount(text) {
  const s = String(text ?? "");
  // the number ends where its digits do, so "23.9%" cannot be read as 23, "11/1" as 11 or "1,2345" as 1,234
  const num = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)(?!\\d|[.,:/-]\\d)";
  const minus = "(?:(?<![\\w.])([-−])\\s?)?";
  const not = `(?!\\s*(?:%|a\\.m\\.?|p\\.m\\.?|(?:percent|am|pm|th|st|nd|rd|days?|weeks?|months?|years?|hours?|minutes?|o'clock|${COUNTS})\\b))`;
  const found = (at, written, digits, sign) => {
    const lead = /\b(?:for|of|at|to|on|from)\s+(?:about\s+|around\s+|roughly\s+)?$/i.exec(s.slice(0, at));
    return { amount: (sign ? -1 : 1) * Number(digits.replace(/,/g, "")), match: written, phrase: lead ? lead[0] + written : written };
  };
  let m;
  if ((m = new RegExp(`${minus}\\$\\s?${minus}${num}`).exec(s))) return found(m.index, m[0], m[3], m[1] || m[2]);
  if ((m = new RegExp(`${minus}\\b${num}\\s*(?:dollars|bucks|usd)\\b`, "i").exec(s))) return found(m.index, m[0], m[2], m[1]);
  // a number after a word of money first ("paid 60"), then one after of, at, for or to ("for 80"): in "Dinner for 4,
  // paid 60" the 4 is people
  for (const words of [MONEY_WORDS, "of|at|for|to"]) {
    if ((m = new RegExp(`\\b(?:${words})\\s+(?:about\\s+|around\\s+|roughly\\s+)?(${minus}${num})${not}`, "i").exec(s))) {
      const at = m.index + m[0].length - m[1].length;
      return found(at, m[1], m[3], m[2]);
    }
  }
  return null;
}

/**
 * Kind words for accounts said in a note, and the account types they mean, the more exact ones first: "health
 * savings" is an HSA before "savings" is savings, "student loan" a student loan before "loan" is a loan, "debit card"
 * the checking account before "card" is a credit card; a gift card is no account.
 */
const KIND_WORDS = [
  [/\bhealth savings\b|\bhsa\b/, ["hsa"]], [/\bstudent loans?\b/, ["student_loan"]], [/\bdebit card\b/, ["checking"]], [/\bgift card\b/, []],
  [/\bcredit card\b|\bcard\b/, ["credit"]], [/\bchecking\b|\bcurrent account\b/, ["checking"]], [/\bsavings?\b/, ["savings"]],
  [/\bmortgage\b/, ["mortgage"]], [/\bcar loan\b|\bauto loan\b|\bloan\b/, ["loan"]], [/\bbrokerage\b/, ["brokerage"]],
  [/\b401\s?\(?k\)?/, ["401k"]], [/\broth\b/, ["roth"]],
];

// Words after which an account's name or kind word is part of another name: a place, a business, a cost or a person
// ("the card shop", "a loan shark", "my checking fee", "my credit card bill", "the Car loan office", "the house cleaner").
const NAME_NOUNS = /^(?:shops?|stores?|mart|market|cafe|café|coffee|bar|grill|restaurant|diner|bakery|deli|pub|bistro|kitchen|pizza|pizzeria|salon|spa|gym|club|center|centre|outlet|depot|warehouse|station|garage|offices?|partners|group|company|associates|services|agency|firm|fees?|bills?|payments?|contributions?|sharks?|counter|desk|booth|kiosk|stand|truck|shack|hut|lounge|tavern|inn|motel|hotel|clinic|pharmacy|people|guy|lady|man|rep|cleaners?|keepers?|sitters?|painters?)$/i;
// Words that go on the sentence, not a name, even with a capital: "on my card Monday", "the credit card I share", "the
// card ending 1234", "from savings just now", "Savings Is At"
const NOT_A_NAME = new RegExp(`^(?:i|i'm|i’m|i've|i’ve|i'd|i’d|we|you|he|she|they|it|is|are|was|were|has|have|had|shows?|showed|stands?|balance|now|at|for|to|on|from|with|using|in|into|by|via|and|or|but|then|so|yesterday|today|tonight|tomorrow|last|this|next|because|when|while|after|before|which|that|who|of|again|too|also|just|only|online|first|instead|as|right|here|there|please|toward|towards|ending|ends|number|my|our|your|his|her|their|the|a|an|earlier|later|already|still|${DAYS.join("|")}|${MONTH_WORDS})$`, "i");

/**
 * Whether the words at [start, end) of `s` (an account's name or a kind word) are part of another name rather than
 * the account: right after "at" (a place: "at the Savings Mart", "at House of Pancakes") or "a"/"an" ("a loan shark",
 * "bought a card"); or followed (after a "card", "account" or "IRA") by one of NAME_NOUNS ("the card shop", "my
 * checking fee"), by "of" and a capital ("House of Pancakes"), by a word with a capital that is not one of NOT_A_NAME,
 * nor a person in the plan ("the Mortgage Shop", "Brokerage Partners"); or, for an account money is not spent from day
 * to day (a house, a loan, investments: `everyday` false), after "the", by any small word not one of NOT_A_NAME ("the
 * house cleaner", "the mortgage company"). Anything else after it (the end, a mark, a number, "'s", one of NOT_A_NAME,
 * or a small word after a card, checking or savings: "on my card again", "from savings just now", "the card ending
 * 1234") leaves it the account.
 */
function partOfName(s, start, end, people, everyday = true) {
  const before = s.slice(0, start);
  if (/(?:\bat\s+(?:the\s+)?|\b(?:a|an)\s+)$/i.test(before)) return true;
  const rest = s.slice(end).replace(/^\s+(?:card|account|ira)s?(?![\p{L}\p{N}])/iu, "");
  const w = /^\s+(of\s+)?(\p{L}[\p{L}\p{N}'’&-]*)/u.exec(rest);
  if (!w) return false;
  if (w[1]) return /^\p{Lu}/u.test(w[2]);
  const word = w[2].toLowerCase().replace(/['’]s$/, "");
  if (NAME_NOUNS.test(word)) return true;
  if (NOT_A_NAME.test(word) || people.has(word)) return false;
  return /^\p{Lu}/u.test(w[2]) || (!everyday && /\bthe\s+$/i.test(before));
}

// words before an account that say the money came out of it or went into it: "Paid the mortgage from checking"
const SOURCE = /\b(?:from|with|using|via|out of|into)\s+(?:the\s+|my\s+|our\s+)?$/i;

/**
 * The account a piece of text names, and the words that named it: { account (or null when the words fit more than
 * one), match, named (true when the text names an account at all), start, end (where the words are in the text; -1
 * when none) }. By its name (whole words, longest first; two accounts of that name: neither); else by its name
 * without a last "card" or "account" after the, my or our ("the visa" for "Visa card"); else by the first kind word
 * that fits, when exactly one account is that kind. A name or kind word that is part of another name (partOfName:
 * "the Mortgage Shop", "the card shop") names no account there. When the text names more than one account, the one
 * after from, with, using, via, out of or into is the one the money moved through ("Paid the mortgage from checking":
 * checking).
 */
function findAccount(text, plan) {
  const s = ` ${String(text ?? "")} `;
  const accounts = (plan?.accounts ?? []).filter((a) => a?.id);
  const people = new Set((plan?.household?.people ?? []).map((p) => clean(p?.name).split(" ")[0].toLowerCase()).filter(Boolean));
  const nameOf = (a) => clean(a.name).toLowerCase();
  const everyday = (types) => types.some((t) => EVERYDAY.spend.includes(t));
  const typesOf = (n, nameFn) => accounts.filter((a) => nameFn(a) === n).map((a) => a.type);
  // the first place the words are said that is not part of another name
  const at = (w, before = "", nameFn = nameOf) => {
    const daily = everyday(typesOf(w, nameFn));
    for (const m of s.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${before}${esc(w)}(?![\\p{L}\\p{N}])`, "giu"))) if (!partOfName(s, m.index + m[0].length - w.length, m.index + m[0].length, people, daily)) return m;
    return null;
  };
  const one = (list, match, m) => ({ account: list.length === 1 ? list[0] : null, match, named: true, start: m.index - 1, end: m.index - 1 + m[0].length });
  const found = [];   // every way the text names an account, the surest first
  const names = [...new Set(accounts.map(nameOf).filter((n) => n.length >= 3 && at(n)))].sort((a, b) => b.length - a.length);
  for (const n of names) found.push(one(accounts.filter((a) => nameOf(a) === n), n, at(n)));
  const shortOf = (a) => nameOf(a).replace(/\s+(?:card|account)$/, "");
  const shorts = [...new Set(accounts.filter((a) => shortOf(a) !== nameOf(a)).map(shortOf).filter((n) => n.length >= 3 && at(n, "(?:the|my|our)\\s+", shortOf)))];
  for (const n of shorts) found.push(one(accounts.filter((a) => shortOf(a) === n), n, at(n, "(?:the|my|our)\\s+", shortOf)));
  let rest = s;
  const blank = (m) => { rest = rest.slice(0, m.index) + " ".repeat(m[0].length) + rest.slice(m.index + m[0].length); };
  for (const [re, types] of KIND_WORDS) {
    const all = [...rest.matchAll(new RegExp(re.source, "gi"))];
    // the "card" of a gift card names no account (blanked, so the places in the text stay the same)
    if (!types.length) { all.forEach(blank); continue; }
    const m = all.find((x) => !partOfName(rest, x.index, x.index + x[0].length, people, everyday(types)));
    // blanked once found, so "debit card" is not read again as a "card"
    if (m) { found.push(one(accounts.filter((a) => types.includes(a.type)), m[0].trim().toLowerCase(), m)); blank(m); }
  }
  return found.find((f) => SOURCE.test(s.slice(0, f.start + 1))) ?? found[0] ?? { account: null, match: "", named: false, start: -1, end: -1 };
}

/** The account a piece of text names (see findAccount), or null. */
export function readAccount(text, plan) {
  return findAccount(text, plan).account;
}

/** Where money is spent from, or comes into, when nothing else says: everyday accounts only, never a loan or a house. */
const EVERYDAY = { spend: ["checking", "savings", "cash", "credit"], income: ["checking", "savings", "cash"] };

/**
 * The account new money goes to when the note names none: of the everyday accounts for that kind (money spent:
 * checking, savings, cash or a credit card; money in: checking, savings or cash), the one with the most transactions,
 * else the first checking account, else the first of them; null when there is none.
 */
export function defaultAccount(plan, kind = "spend") {
  const types = EVERYDAY[kind] ?? EVERYDAY.spend;
  const accounts = (plan?.accounts ?? []).filter((a) => a?.id && types.includes(a.type));
  if (!accounts.length) return null;
  const count = {};
  for (const t of plan.transactions ?? []) if (t?.accountId) count[t.accountId] = (count[t.accountId] ?? 0) + 1;
  const used = accounts.filter((a) => count[a.id]).sort((a, b) => count[b.id] - count[a.id]);
  return used[0] ?? accounts.find((a) => a.type === "checking") ?? accounts[0];
}

/**
 * A sentence without the words that named an account (findAccount's start and end), with the "with my", "from the",
 * "on my"... before them and a "card" or "account" and an "ending 1234" after, so they are not read as who was paid.
 * Only that place is cut: "Spent 30 at the Savings Mart from savings" keeps "Savings Mart".
 */
function withoutAccount(sentence, acct) {
  if (!(acct?.start >= 0)) return sentence;
  const before = /(?:\b(?:with|using|on|from|into|in|to|by|via|out of)\s+)?(?:\b(?:the|my|our)\s+)?$/i.exec(sentence.slice(0, acct.start));
  const after = /^(?:\s+(?:card|account)s?\b)?(?:\s+(?:(?:that\s+)?ends?|ending)(?:\s+(?:in|with))?\s+\d{2,}\b)?/i.exec(sentence.slice(acct.end));
  return `${sentence.slice(0, acct.start - before[0].length)} ${sentence.slice(acct.end + after[0].length)}`;
}

/**
 * Who or what money went to or came from: the words after "at", "from", "to", "for" or "on" (not "due to"), once the
 * day, the amount with its "for"/"of"/"at" and a count ("for 4 people") are cut (the account's words are cut before,
 * see withoutAccount), up to the next account word, "for", "while", "I", "my"... or the end, with an "again", "too" or
 * "online" at its end dropped; a number alone, or a number and what was done ("Dinner for 4, paid 60 at Joe's",
 * "dinner for 4 paid 60 at Joe's") is no one, so the next of those words is tried; else what was paid ("paid the
 * plumber"). A short word with a period stays ("Dr. Lee", "Prof. Kim", "Acme Corp."). "the electric bill" ->
 * "Electric bill".
 */
function readPayee(sentence, cutAt = []) {
  let s = ` ${sentence} `;
  for (const c of cutAt) if (c) s = s.replace(new RegExp(esc(c), "i"), " ");
  s = clean(s.replace(new RegExp(`\\b(?:for\\s+)?\\d+\\s+(?:${COUNTS})\\b`, "gi"), " "));
  const ends = new RegExp(`\\s+(?:with|using|on my|on the|from my|from the|into|in my|by|via|and|then|so|because|which|due to|for|while|whilst|when|i|we|he|she|they|my|our|his|her|their)\\b|[,;!?]|(?<!\\b(?:${NAME_DOTS}))\\.(?!\\w)`, "i");
  const tidy = (rest) => {
    let p = rest.split(ends)[0];
    p = p.replace(/^(?:the|my|a|an|our)\s+/i, "").replace(/(?:\s+(?:today|yesterday|tomorrow|this morning|tonight|card|account|again|too|also|as well|online|first))+$/i, "").replace(/(?:\s+(?:on|by|of|for|at|in|to|from))+$/i, "");
    return upperFirst(clean(p)).slice(0, MAX_TEXT);
  };
  // "4", "4 paid", "3: paid": the people a table was for, then what was done
  const noOne = /^\d[\d,.]*(?:\s*[:;,]?\s*(?:spent|spend|paid|pay|cost|costs|charged|tipped|bought|was|were|came)\b.*)?$/i;
  for (const m of s.matchAll(/\b(?<!\b(?:due|thanks|according)\s)(?:at|from|to|for|on)\s+/gi)) {
    const p = tidy(s.slice(m.index + m[0].length));
    // a payee starts with no "at", "on"...: "on the 4th of July at the lake" is the lake
    if (p && !noOne.test(p) && !/^(?:at|on|to|for|from|in|of|by)\b/i.test(p)) return p;
  }
  const m = /\b(?:paid|tipped)\s+(?:the|my|our)\s+(.+)$/i.exec(s);
  return m ? tidy(m[1]) : "";
}

// Short words with a period that need not end a sentence (and that a payee keeps: "Dr. Lee", "Acme Corp.").
const NAME_DOTS = "dr|mr|mrs|ms|mt|prof|st|inc|co|corp|ltd|jr|sr|ave|rd|blvd|vs|approx";
// A title comes before a name ("Dr. Lee", "Prof. Kim", "St. Mary's"), so after one only a word that starts a new
// sentence, or a day word, ends it ("... Dr. Remind me...", "... Dr. Tomorrow ..."). A word that comes after a
// name ("Acme Inc.", "Smith & Co.", "Bo Jr.") ends the sentence unless what follows goes on in small letters ("Acme
// Inc. for the parts"); a capital or a number starts a new one ("Acme Corp. 50 of it was tax"). A street ("5 Oak St.",
// "Main St.", "5th Ave.") and a title after a name ("Lee, Dr.", "to Kim Lee Dr.") go on in small letters too, and
// also when capitals follow that go on a name: up to the end of the sentence, or up to a small word such as for, at,
// on, and ("the Main St. Cafe.", "Main St. Cafe for lunch", "Lee, Dr. Kim and Bo"), but not into a new sentence ("5
// Oak St. Lunch was nice", "Oak St. Target was busy", "Lee, Dr. Rent is due", "Lee, Dr. Bo spent 20"). "St." is a title after the, at, to... (Saint), else a street. "vs." and
// "approx." go on before a number ("20 vs. 30"). "Dec." before a day is part of the day ("on Dec. 1"). "No." is a word
// ("I said no. Spent 30").
const TITLE_DOT = /(?:^|[^\p{L}\p{N}])(?:dr|mr|mrs|ms|mt|prof)\.$/iu;
const COMMA_TITLE_DOT = /,\s*(?:dr|mr|mrs|ms|mt|prof)\.$/iu;
const SAINT_DOT = /(?:^|(?:^|[^\p{L}\p{N}])(?:the|at|to|from|in|on|for|of|by|near)\s+)st\.$/iu;
const AFTER_NAME_DOT = /(?:^|[^\p{L}\p{N}])(?:inc|co|corp|ltd|jr|sr)\.$/iu;
const STREET_DOT = /(?:^|[^\p{L}\p{N}])(?:st|ave|rd|blvd)\.$/iu;
const NUMBER_DOT = /(?:^|[^\p{L}\p{N}])(?:vs|approx)\.$/iu;
const MONTH_DOT = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${MONTH_WORDS})\\.$`, "iu");
const STARTS_SENTENCE = /^(?:i|i'm|i’m|i've|i’ve|we|we're|we’re|you|he|she|they|it|there|my|our|the|also|then|remind|remember|don'?t|don’t|please|spent|spend|paid|pay|bought|buy|got|get|received|earned|made|charged|tipped|deposited|lunch|dinner|breakfast)(?![\p{L}\p{N}])/iu;
const DAY_START = /^(?:tomorrow|yesterday|today|tonight|this|next|last)(?![\p{L}\p{N}])/iu;
// capitals that go on a street's name: to the end of the sentence, or to a small word that goes on the sentence
const NAME_GOES_ON = /^(?:\p{Lu}[\p{L}\p{N}'’&-]*\s*)+(?:$|[.!?;,]|\s*(?:for|at|on|in|with|to|from|by|and|near|off|downtown)(?![\p{L}\p{N}]))/u;
const goesOn = (head, tail) => {
  if (MONTH_DOT.test(head) && /^\d/.test(tail)) return true;
  const small = /^\p{Ll}/u.test(tail) && !STARTS_SENTENCE.test(tail);
  if (NUMBER_DOT.test(head)) return small || /^\d/.test(tail);
  const nameGoesOn = () => !STARTS_SENTENCE.test(tail) && !DAY_START.test(tail) && NAME_GOES_ON.test(tail.split(/(?<=[.!?;])\s/)[0]);
  if (AFTER_NAME_DOT.test(head)) return small;
  // a title after a name: after a comma ("Lee, Dr."), or after a word in capitals that does not start the sentence
  // ("to Kim Lee Dr."; but "Paid Dr. Lee" and "Then Dr. Lee" are titles)
  const postTitle = COMMA_TITLE_DOT.test(head) || (TITLE_DOT.test(head) && /\s\p{Lu}[\p{L}'’-]*\s+\S+\.$/u.test(head.trim()));
  if (postTitle || STREET_DOT.test(head)) return small || nameGoesOn();
  if (TITLE_DOT.test(head) || SAINT_DOT.test(head)) return !STARTS_SENTENCE.test(tail) && !DAY_START.test(tail);
  return false;
};

/** Where a note's sentences are: [{ start, end }] in the text, split as sentencesOf says. */
function sentenceSpans(text) {
  const s = String(text ?? ""), out = [];
  let start = 0;
  for (const m of s.matchAll(/(?<=[.!?;])\s+|\n+/g)) {
    const cut = m.index, next = m.index + m[0].length;
    if (!m[0].includes("\n") && s[cut - 1] === "." && goesOn(s.slice(start, cut), s.slice(next))) continue;
    out.push({ start, end: cut });
    start = next;
  }
  out.push({ start, end: s.length });
  return out.filter((x) => clean(s.slice(x.start, x.end)));
}

/**
 * A note's sentences: split after . ! ? or ; and at line breaks, but not after a title before a name ("Dr. Lee"), a
 * word after a name that the sentence goes on from ("Acme Inc. for the parts") or "Dec." before a day (see goesOn).
 */
export const sentencesOf = (text) => { const s = String(text ?? ""); return sentenceSpans(s).map((x) => clean(s.slice(x.start, x.end))); };

/**
 * The part of a note read at once and the rest, left in the box for the next reading: the first MAX_ENTRIES
 * sentences that fit in MAX_NOTE characters (the first sentence always). -> { read: [sentence], rest: [sentence] }
 */
export function notePart(text) {
  const all = sentencesOf(text);
  let n = 0, size = 0;
  while (n < all.length && n < MAX_ENTRIES && (n === 0 || size + all[n].length + 1 <= MAX_NOTE)) size += all[n++].length + 1;
  return { read: all.slice(0, n), rest: all.slice(n) };
}

/**
 * The note with these sentences taken out, each line tidied. Only whole sentences of the note go (spaces between their
 * words may differ, and one sentence may run over a line break), the first one that is the same for each: "Spent 20 at
 * Target" never takes a piece out of "Spent 20 at Target yesterday."
 */
export function withoutSentences(text, list = []) {
  const s = String(text ?? "");
  const spans = sentenceSpans(s), said = spans.map((x) => clean(s.slice(x.start, x.end)));
  const gone = new Set();
  for (const x of list) {
    const want = clean(x);
    if (!want) continue;
    // the first run of sentences not taken yet that reads the same
    find: for (let i = 0; i < spans.length; i++) {
      let run = "";
      for (let j = i; j < spans.length && !gone.has(j); j++) {
        run = clean(`${run} ${said[j]}`);
        if (run === want) { for (let k = i; k <= j; k++) gone.add(k); break find; }
        if (!want.startsWith(run)) break;
      }
    }
  }
  let out = "", at = 0;
  spans.forEach((x, i) => { if (gone.has(i)) { out += `${s.slice(at, x.start)} `; at = x.end; } });
  return `${out}${s.slice(at)}`.split("\n").map(clean).filter(Boolean).join("\n");
}

const REMIND = /\b(?:remind|remember to|don'?t forget|do not forget|due(?!\s+to\b))\b/;
// "due to" is "because of" ("Due to the rain, spent 20") unless a day from today on is said and nothing was paid or
// happened yet: "Visa payment due to Chase on the 15th" is a reminder; "cancelled due to rain last Friday", "the game
// was cancelled due to rain on Friday" and "Late fee of 25 due to the late payment yesterday" are not
const DUE_TO = /\bdue\s+to\b/;
const DONE = /\b(?:spent|paid|bought|charged|received|earned|got|tipped|deposited|refunded)\b/;
// what already happened: was, were, had, did... or a word in -ed in small letters ("cancelled", "dropped"; a name
// such as United is no verb), but not one that says what is to come ("scheduled", "expected", "owed")
const HAPPENED = /\b(?:was|were|had|did|went|came|happened)\b/;
const HAPPENED_ED = /\b(?!(?:need|feed|seed|speed|shed|bleed|breed|scheduled|expected|planned|needed|required|owed|agreed|signed)\b)[a-z]{2,}ed\b/;
// the day said is today or later; a time with no one day counts unless it looks back ("last month", "a while ago")
const ahead = (s, today) => {
  const d = readDate(s, today, "future");
  return !!d && (d.date ? d.date >= today : !/\b(?:last|past|previous|prior|ago|back|earlier|recently|lately|other|before|since)\b/.test(d.match));
};
const isReminder = (s, low, today) => REMIND.test(low) || (DUE_TO.test(low) && !DONE.test(low) && !HAPPENED.test(low)
  && !HAPPENED_ED.test(s.charAt(0).toLowerCase() + s.slice(1)) && ahead(s, today));
const BALANCE = /\b(?:balance|is at|has|have|is now|stands at|is|shows)\b/;
// a payment, a fee or a rate said about an account is not its balance
const NOT_BALANCE = /\b(?:spent|paid|bought|charged|received|earned|payments?|fees?|rate|interest|apr|minimum|limit|due|bills?)\b/;
// "I get paid" and "paid me" are money in, so they are taken out before looking for money paid out
const IN_SURE = /\b(?:got|get|gets|getting|was|were|am|i'm|we're)\s+paid\b|\bpaid\s+(?:me|us)\b|\bgot\s+(?:\$?[\d,.]+\s+)?back\b/;
const IN_WORDS = /\b(?:received|earned|deposit(?:ed)?|refund(?:ed)?|made)\b/;
const OUT_WORDS = /\b(?:spent|spend|paid|pay|bought|buy|cost|costs|charged|tipped|payment)\b/;
// a fee said with a deposit and no other word of money in is money out: "Overdraft fee of 35 due to a late deposit"
const FEE_OUT = /\b(?:fees?|penalty)\b/;
const IN_NOT_DEPOSIT = /\b(?:received|earned|refund(?:ed)?|made|back)\b/;
const PAYCHECK = /\b(?:got|get|gets|getting|was|were)\s+paid\b|\bpaycheck\b|\bsalary\b|\bwages\b/;

/**
 * The plain rules, used when the AI helper is off (or as a check): each sentence of the part read (see notePart)
 * becomes one entry, with the sentence kept as its `source`.
 * - "remind", "remember to", "don't forget", "due" -> a reminder (its name: the sentence without those words, the
 *   day and the amount; a future day); "due to" only with a day from today on and nothing paid or done ("due to
 *   Chase on the 15th", not "due to the rain, spent 20", "cancelled due to rain on Friday" or "due to the late payment
 *   yesterday");
 * - an account named with "balance", "is", "is at", "has", "is now", "stands at" and an amount, and no payment, fee,
 *   rate or bill -> that account's balance (asked for when the words fit no account, or more than one);
 * - "got paid", "get paid", "paid me", "got back" and an amount -> money in; so are "received", "earned", "deposit",
 *   "refund", "made" when nothing was paid out ("made a payment", "paid a deposit" are money spent);
 * - "spent", "paid", "bought", "cost", "charged", "payment" and an amount -> money spent (who to: after at/to/for/on);
 *   so is a fee said with a deposit ("Overdraft fee of 35 due to a late deposit");
 * - anything else -> a note.
 * The day is readDate's: "" (asked for) when the words name a time but no one day ("in September", "this week",
 * "last summer"); today only when the sentence has none of readDate's time words.
 * -> [proposal] (see finish)
 */
export function quickRead(text, plan, today) {
  const out = [];
  for (const s of notePart(text).read) {
    const low = s.toLowerCase();
    const money = readAmount(s);
    if (isReminder(s, low, today)) {
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
      out.push({ kind: "reminder", name: upperFirst(name), date: day?.date ?? "", amount: money?.amount ?? null, repeat: /\bevery month|\bmonthly\b/.test(low) ? "monthly" : /\bevery year|\byearly\b|\bannual/.test(low) ? "yearly" : "none", source: s });
      continue;
    }
    const acct = findAccount(s, plan);
    if (acct.named && money && BALANCE.test(low) && !NOT_BALANCE.test(low)) {
      out.push({ kind: "balance", accountId: acct.account?.id ?? "", amount: money.amount, date: readDate(s, today, "past")?.date ?? today, source: s });
      continue;
    }
    const sure = IN_SURE.test(low), paidOut = OUT_WORDS.test(low.replace(new RegExp(IN_SURE.source, "g"), " "));
    const feeOut = !sure && FEE_OUT.test(low) && /\bdeposit/.test(low) && !IN_NOT_DEPOSIT.test(low);
    const kind = !money ? null : sure || (IN_WORDS.test(low) && !paidOut && !feeOut) ? "income" : paidOut || feeOut ? "spend" : null;
    if (kind) {
      const day = readDate(s, today, "past");
      const payee = readPayee(withoutAccount(s, acct), [day?.match, money.phrase]) || (kind === "income" && PAYCHECK.test(low) ? "Paycheck" : "");
      // an account the note names but that fits none (or several) is asked for, never swapped for the usual one
      const into = acct.account ?? (acct.named ? null : defaultAccount(plan, kind));
      out.push({ kind, amount: money.amount, date: day?.date ?? today, payee, accountId: into?.id ?? "", source: s });
      continue;
    }
    out.push({ kind: "note", text: s, source: s });
  }
  return out.map((p) => finish(p, plan, today, text));
}

/** The amounts written in a note (commas dropped), to tell whether an amount the AI gives is really in it. */
const amountsIn = (text) => [...String(text ?? "").matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ""))).filter(Number.isFinite);

/**
 * One entry made safe to show and to add: { kind, amount, date, payee, accountId, name, repeat, text, source,
 * problems, warnings, ready }. Unknown kinds (and names such as "constructor") become a note; amounts are positive
 * (the kind gives the sign), except a balance, which keeps its sign (an overdrawn account); a day must be a real
 * calendar day (spaces around it dropped); an account must be in the plan. problems: what must be filled before Add
 * ("pick a day"); warnings: what to look at (an amount that is not in the note as written, a day far from today, the
 * same entry already in the plan: a note read twice).
 */
export function finish(p, plan, today, note = "") {
  const kind = own(KINDS, p?.kind) ? p.kind : "note";
  const raw = p?.amount === null || p?.amount === undefined || p?.amount === "" || !Number.isFinite(Number(p.amount)) ? null : Number(p.amount);
  const amount = raw === null ? null : Math.round((kind === "balance" ? raw : Math.abs(raw)) * 100) / 100;
  const date = isValidDate(p?.date) ? String(p.date).trim() : "";
  const accountId = (plan?.accounts ?? []).some((a) => a?.id === p?.accountId) ? p.accountId : "";
  const out = { kind, amount, date, payee: cut(clean(p?.payee), MAX_TEXT), accountId, name: cut(clean(p?.name), MAX_TEXT), repeat: own(REPEATS, p?.repeat) ? p.repeat : "none", text: cut(clean(p?.text), MAX_NOTE), source: cut(clean(p?.source), MAX_NOTE), problems: [], warnings: [] };
  const need = (ok, what) => { if (!ok) out.problems.push(what); };
  if (kind === "spend" || kind === "income") { need(amount !== null && amount > 0, "the amount"); need(date, "the day"); need(accountId, "the account"); need(out.payee, kind === "spend" ? "who it was paid to" : "who it came from"); }
  if (kind === "reminder") { need(out.name, "what to remember"); need(date, "the day"); }
  if (kind === "balance") { need(accountId, "the account"); need(amount !== null, "the balance"); need(date, "the day"); }
  if (kind === "note") need(out.text, "the note");
  if (amount !== null && note && !amountsIn(note).some((x) => Math.abs(x - Math.abs(amount)) < 0.005)) out.warnings.push("This amount is not in your note as written: check it.");
  if (date && (kind === "spend" || kind === "income" || kind === "balance") && date > today) out.warnings.push("This day is in the future.");
  if (date && Math.abs((Date.parse(date) - Date.parse(today)) / 86400000) > 366) out.warnings.push("This day is more than a year away from today.");
  // the same one already in the plan (a note read again): allowed, as on the Ledger (two coffees the same day), but flagged
  const key = (kind === "spend" || kind === "income") && amount !== null && date && accountId ? txKey({ accountId, date, amount: kind === "spend" ? -amount : amount, rawPayee: out.payee }) : null;
  if (key && (plan?.transactions ?? []).some((t) => t && txKey(t) === key)) out.warnings.push("This looks like one already in the Ledger. Check before adding.");
  if (kind === "reminder" && out.name && (plan?.reminders ?? []).some((r) => r && clean(r.name).toLowerCase() === out.name.toLowerCase() && (r.date ?? "") === date)) out.warnings.push("This looks like a reminder already on the Money calendar. Check before adding.");
  if (kind === "note" && out.text && String(plan?.notes ?? "").split("\n").some((l) => clean(l.replace(/^\d{4}-\d{2}-\d{2}:/, "")) === out.text)) out.warnings.push("This note is already in the notes you kept.");
  out.ready = out.problems.length === 0;
  return out;
}

/**
 * The question for the AI: the part of the note read at once (see notePart) with people's and accounts' names
 * swapped for stand-ins (Adult 1, "the credit card", longest name first so "Ana's 401(k)" becomes its account's
 * stand-in, not "Adult 1's 401(k)"), the accounts by those stand-ins with whose they are ("belongs to Adult 1"), and
 * today's date. -> { messages, names, accounts: [{ alias, id }] }
 */
export function buildPrompt(text, plan, today) {
  const people = aliases(plan, { today });
  const accts = accountAliases(plan);
  const owners = new Map();
  (plan?.household?.people ?? []).filter(Boolean).forEach((p, i) => { if (p.id && people[i]) owners.set(p.id, people[i].alias); });
  const list = (plan?.accounts ?? []).map((a, i) => (a?.id && accts[i] ? { alias: accts[i].alias, id: a.id, label: ACCOUNT_TYPES[a.type]?.label ?? "Account", owner: owners.get(a.ownerId) ?? "" } : null)).filter(Boolean);
  const terms = hideTerms(people, accts.filter(Boolean)).sort((x, y) => Array.from(y.term).length - Array.from(x.term).length);
  // one line per sentence read, each ending like one ("rent is due on the 1st" from its own line)
  const read = notePart(text).read.map((s) => (/[.!?;:]$/.test(s) ? s : `${s}.`)).join(" ");
  // "with the Visa card" -> "with the the credit card" -> "with the credit card"
  const note = cut(hide(read, terms).replace(/\b(the|my|our|your)\s+the\s+/gi, "$1 "), MAX_NOTE);
  const system = `You turn a short note, spoken or typed, into entries for a household money app. Reply with only a JSON list. Each entry is one of:
{"kind":"spend","amount":42.17,"date":"YYYY-MM-DD","payee":"who it was paid to","account":"one of the accounts listed, or null"}
{"kind":"income","amount":1950,"date":"YYYY-MM-DD","payee":"who it came from","account":"one of the accounts listed, or null"}
{"kind":"reminder","name":"what to remember","date":"YYYY-MM-DD","amount":85 or null,"repeat":"none" or "monthly" or "yearly"}
{"kind":"balance","account":"one of the accounts listed","amount":12400,"date":"YYYY-MM-DD"}
{"kind":"note","text":"anything else worth keeping, in the note's own words"}
Use only what the note says. Never guess an amount or a day the note does not give: use null. Amounts are positive numbers without a currency sign. Today is ${today}; words such as yesterday, last Friday or next month are counted from today. People are called Adult 1, Adult 2, Child 1 and so on; keep those names. At most ${MAX_ENTRIES} entries.`;
  const user = `ACCOUNTS: ${list.length ? list.map((a) => `${a.alias} (${a.label}${a.owner ? `, belongs to ${a.owner}` : ""})`).join("; ") : "none yet"}\nNOTE: ${note}`;
  return { messages: [{ role: "system", content: system }, { role: "user", content: user }], names: [...people.filter((p) => p.name), ...accts.filter((a) => a && a.name)], accounts: list };
}

/**
 * The AI's answer read back: its JSON list (ai/critic's findList: thinking and fences dropped, the first list that
 * parses), each entry's account matched from its stand-in (with or without "the", any case) or from a name; money
 * spent or in with no account (null) goes to defaultAccount, as with the plain rules; names put back in the text,
 * then finish() each, at most MAX_ENTRIES. -> [proposal], or null when there is no list to read.
 */
export function readAnswer(content, plan, today, note, prompt) {
  const arr = findList(content);
  if (!arr) return null;
  const norm = (s) => clean(s).toLowerCase().replace(/^the\s+/, "");
  const accountOf = (v, kind) => {
    if (typeof v !== "string" || !v.trim()) return kind === "spend" || kind === "income" ? defaultAccount(plan, kind)?.id ?? "" : "";
    const hit = (prompt?.accounts ?? []).find((a) => norm(a.alias) === norm(v));
    return hit ? hit.id : readAccount(v, plan)?.id ?? "";
  };
  const back = (v) => restore(typeof v === "string" ? v : "", prompt?.names ?? []);
  return arr.filter(isObj).slice(0, MAX_ENTRIES).map((x) => finish({ ...x, accountId: accountOf(x.account, x.kind), payee: back(x.payee), name: back(x.name), text: back(x.text), source: "" }, plan, today, note));
}

/**
 * Add one entry to the plan draft, through the page that owns it; changes `draft` in place. -> { ok, text, go }
 * - spend / income: a transaction like the Ledger's (`txKey` for the import page's duplicate check), money out
 *   negative, no category yet (Categorize does that), noted "from a voice note";
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

/**
 * The accounts to pick from for an entry, as { value, label }: the name, with its kind after it only when the name
 * does not already say it ("Visa card (Credit card)", but "Brokerage", "Ana's 401(k)"); for money spent or in, the
 * everyday accounts (checking, savings, cash, credit cards) first.
 */
export function accountChoices(plan, kind) {
  const first = new Set(kind === "spend" || kind === "income" ? EVERYDAY.spend : []);
  const rows = (plan?.accounts ?? []).filter((a) => a?.id).map((a) => {
    const name = clean(a.name) || "Account", label = ACCOUNT_TYPES[a.type]?.label ?? "Account";
    const word = label.split(/[\s/]+/)[0].toLowerCase();
    return { value: a.id, label: name.toLowerCase().includes(word) ? name : `${name} (${label})`, first: first.has(a.type) };
  });
  return [...rows.filter((r) => r.first), ...rows.filter((r) => !r.first)].map(({ value, label }) => ({ value, label }));
}

/** compute(plan) -> { accounts: [{ id, name, label }], notes (the plan's notes, as text), ready } */
export function compute(plan) {
  const accounts = (plan?.accounts ?? []).filter((a) => a?.id).map((a) => ({ id: a.id, name: a.name || "Account", label: ACCOUNT_TYPES[a.type]?.label ?? "Account" }));
  return { accounts, notes: String(plan?.notes ?? ""), ready: true };
}
