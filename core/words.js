// core/words.js -- PURE. How a page names a person inside a sentence. Get started names the first adult "Me" when no name
// is typed, and the partner "My spouse" or "My partner"; a sentence then says "you" and "your" with the verb to match
// ("your pay", "you join Medicare", "If you die first"), never "Me's pay", "Me joins" or "If Me dies". Any other name is
// used as typed. A name standing alone as a label (a list of people, a picker) may stay "Me".

const PARTNER = /^My (spouse|partner|husband|wife)$/;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** true for the first adult Get started left unnamed ("Me", or no name at all), and for "You", the fallback some pages give a
 * person with no name (retirement/rmd, taxes/federal), so it never reads "You's" */
export const isYou = (name) => name === undefined || name === null || ["", "me", "you"].includes(String(name).trim().toLowerCase());

/** the name inside a sentence: "you", "your spouse", or the name as typed */
export const nameIn = (name) => (isYou(name) ? "you" : PARTNER.test(String(name).trim()) ? String(name).trim().replace(/^My /, "your ") : String(name));

/** the same at the start of a sentence or as a heading: "You", "Your spouse", "Ana" */
export const NameIn = (name) => cap(nameIn(name));

/** the possessive: "your", "your spouse's", "Ana's" ("Chris's" as typed) */
export const nameOf = (name) => (isYou(name) ? "your" : `${nameIn(name)}'s`);

/** the possessive at the start of a sentence: "Your", "Your spouse's", "Ana's" */
export const NameOf = (name) => cap(nameOf(name));

/** a verb in the person's number: verbFor("Ana", "joins", "join") -> "joins"; verbFor("Me", "joins", "join") -> "join" */
export const verbFor = (name, one, you) => (isYou(name) ? you : one);

/** the object or reflexive form: "you", "yourself" (themself/himself are the page's own words for a named person) */
export const selfOf = (name, other = "themself") => (isYou(name) ? "yourself" : other);

/** several names in a sentence, "you" first: "you and Bo", "you, your spouse and Cy", "Ana and Bo" */
export function namesIn(names) {
  const xs = [...(names ?? [])].sort((a, b) => Number(!isYou(a)) - Number(!isYou(b))).map(nameIn);
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** the same at the start of a sentence: "You and Bo", "Ana and Bo" */
export const NamesIn = (names) => cap(namesIn(names));
