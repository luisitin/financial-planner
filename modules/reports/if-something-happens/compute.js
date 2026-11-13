// modules/reports/if-something-happens/compute.js -- PURE. "If something happens to us": one packet the family can use,
// in seven sections: who to call, where the papers are, the accounts and policies (and who is named on each), online
// accounts, bills that pay themselves, final wishes, and the first steps; shown and printed as five parts (GROUPS: the
// first steps with who to call, the bills with the accounts they are paid from). Counts only: nothing here is money math. It
// reads what other pages keep, through their own compute, and picks each field by name (a whitelist): never a password,
// a recovery phrase, a full account number or a Social Security number, whatever else a record happens to hold. Every
// typed text that looks like a password, or holds a long number (`longNumber`), is left out and named in `secrets`, so
// the page can say so.
import { compute as contactsOf, lastFour } from "../../household/contacts/compute.js";
import { compute as papersOf } from "../../household/documents/compute.js";
import { compute as beneficiariesOf } from "../../estate/beneficiaries/compute.js";
import { compute as digitalOf, looksSecret } from "../../estate/digital/compute.js";
import { compute as documentsOf } from "../../estate/documents/compute.js";
import { compute as recurringOf } from "../../cashflow/recurring/compute.js";
import { ACCOUNT_TYPES, isLiability } from "../../balance/net-worth/compute.js";
import { KINDS as POLICY_KINDS } from "../../insurance/policies/compute.js";
import { money } from "../../../core/format.js";
import { isYou } from "../../../core/words.js";

/** The seven sections, in the packet's order. `go`: the page where each one is kept (Final wishes is kept here). */
export const PARTS = [
  { key: "contacts", title: "Who to call", go: [{ href: "#/household/contacts", label: "Change these on Contacts" }] },
  { key: "papers", title: "Where the papers are", go: [{ href: "#/household/documents", label: "Change these on Document vault index" }] },
  { key: "accounts", title: "Accounts and policies", go: [{ href: "#/estate/beneficiaries", label: "Who is named: Beneficiary audit" }, { href: "#/balance/net-worth", label: "Accounts: Net worth" }, { href: "#/insurance/policies", label: "Policies" }] },
  { key: "online", title: "Online accounts", go: [{ href: "#/estate/digital", label: "Change these on Digital assets" }] },
  { key: "bills", title: "Bills that pay themselves", go: [{ href: "#/cashflow/recurring", label: "See them on Bills and regular payments" }] },
  { key: "wishes", title: "Final wishes", go: [] },
  { key: "steps", title: "First steps for your family", go: [] },
];
/**
 * The packet's five parts, as the page and the printed sheet show them, each one or two of the sections above, which keep
 * their own titles inside. A phone's first view opens at most five rows (docs/OPTIONAL.md R1; the design had seven, integ2
 * check: a new page meets its budget): the first steps sit with who to call (step 2 is a call, step 4 names the executor),
 * the bills that pay themselves with the accounts they are paid from. `none`: the status while nothing in it is filled in.
 */
export const GROUPS = [
  { key: "contacts", title: "Who to call, and the first steps", sections: ["contacts", "steps"], none: "no one listed yet" },
  { key: "papers", title: "Where the papers are", sections: ["papers"] },
  { key: "accounts", title: "Accounts, policies and bills", sections: ["accounts", "bills"], none: "none yet" },
  { key: "online", title: "Online accounts", sections: ["online"] },
  { key: "wishes", title: "Final wishes", sections: ["wishes"] },
];

/** What each part holds, said once when it is opened (and on the printed sheet's empty parts). */
export const INTROS = {
  contacts: "The people and firms your family would phone first: someone to call in an emergency, the executor, your advisor, accountant and lawyer, your banks and insurers. Only the last four digits of a number are kept.",
  papers: "Where each important paper is kept: birth certificates, Social Security cards, the deed, insurance policies, tax returns and the will. Only the place goes here, never the paper or the numbers on it.",
  accounts: "Every account and policy, the firm that holds it, whose it is and who is named to receive it. A debt's payment shows, so your family can keep it paid. No balances and no full numbers.",
  online: "Email, the password manager, phones, photos, online banking, crypto and social media: how someone you trust could get into each. Never a password: only where it is kept and who can get to it.",
  bills: "Payments that leave your accounts by themselves, found in your bank files. Your family can keep paying the ones that matter and stop the rest.",
  wishes: "What you want, in your own words. This is not a legal paper: your will and a written health care directive are what count. It tells your family what you hope for and where things are.",
  steps: "What to do in the first days, in order. Most of it can wait a week or two; the funeral home helps with the first two.",
};

/** Final wishes (`estate.wishes`): the five boxes, in the form's order, with the words the packet prints. */
export const WISHES = [
  { key: "funeral", label: "Funeral or burial wishes" },
  { key: "written", label: "Where your wishes are written down" },
  { key: "pets", label: "Pets, and who takes them" },
  { key: "tell", label: "Who to tell first" },
  { key: "letterWhere", label: "Where a letter to your family is kept" },
];

/** Social Security's national number (CFPB surviving-spouse booklet, 5/2022; ssa.gov; read 2026-11-13). */
export const SSA_PHONE = "1-800-772-1213"; // leak-guard: ok -- Social Security's public national number, not a person's
/** The one-time payment to a surviving spouse living in the household, else an eligible child (SSA POMS RS 00210.001). */
export const SSA_LUMP_SUM = 255;
/** Certified copies of the death certificate to ask the funeral home for (CFPB surviving-spouse booklet, 5/2022). */
export const COPIES = "10 to 12";

/** The first steps, written out once (sources in the README, read 2026-11-13). `detail` lines are added from the plan. */
export const STEPS = [
  `Ask the funeral home for ${COPIES} certified copies of the death certificate. Banks, insurers and Social Security each want one.`,
  `Tell Social Security. The funeral home usually does; call ${SSA_PHONE} to check. Ask about survivor benefits and the one-time $${SSA_LUMP_SUM} payment.`,
  "Ask one credit bureau (Equifax, Experian or TransUnion) to mark the credit report as deceased; it tells the other two.",
  "Find the will and the executor.",
  "Tell the employer, the insurers and the banks on this list.",
  "Keep paying the bills on this list that matter.",
];

const text = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Digits run together or joined by single spaces or dashes. */
const RUN = /\d+(?:[ -]\d+)*/g;
/** A phone number written the usual way (three, three and four digits with a space or a dash between, a leading 1 allowed),
 * and a ZIP+4 code (five and four with a dash): long, but not a full account or Social Security number. */
const SPACED_PHONE = /^(?:1[ -])?\d{3}[ -]\d{3}[ -]\d{4}$/;
const ZIP4 = /^\d{5}-\d{4}$/;
/** A date written with dashes (2026-03-02, 03-02-2026): never part of a long number, even with a figure after it. */
const DASH_DATE = /(?<!\d)(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\d{1,2}-\d{2,4})(?![\d-])/g;
/** A whole phone box: ten digits (with a leading 1, brackets, dots, spaces or dashes), or a number written from abroad (+). */
const PHONE_BOX = /^(?:\+|(?:1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,6})?$)/i;
/**
 * True when a typed text holds a long number: nine digits or more in a run, together or joined by single spaces or
 * dashes. That is a Social Security number's length (nine) and shorter than any card number (13 to 19); the repo's leak
 * guard refuses the same runs. Not one: a phone number written the usual way, a ZIP+4 code, a date written with dashes,
 * a sum of money with commas.
 * `phone`: the text is a whole phone box, where ten digits typed together are a phone number.
 */
export function longNumber(v, { phone = false } = {}) {
  const t = text(v);
  if (phone && PHONE_BOX.test(t)) return false;
  for (const [m] of t.replace(DASH_DATE, " / ").matchAll(RUN)) if (m.replace(/\D/g, "").length >= 9 && !SPACED_PHONE.test(m) && !ZIP4.test(m)) return true;
  return false;
}
/** Why a typed text is kept out of the packet (and refused at the wishes boxes): "secret", "number" or "" (kept). */
export const heldOut = (v, opts) => (looksSecret(text(v)) ? "secret" : longNumber(v, opts) ? "number" : "");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const listOf = (names, max = 5) => (names.length > max ? `${names.slice(0, max).join(", ")} and ${names.length - max} more` : names.join(", "));
const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
};

/**
 * compute(plan, { today }) -> {
 *   parts: [{ key, title, filled, count, says, note, rows: [{ title, value, lines: [text] }], missing: [text], go: [{ href, label }] }]
 *   (the seven sections; First steps is always filled),
 *   groups: [{ key, title, sections: [a part above], filled, says }] (the five parts the page and the sheet show; filled when
 *   a section the person fills in is: First steps alone fills none), filled (groups filled in), total (5), empty (none),
 *   wishes: { funeral, written, pets, tell, letterWhere, updatedAt } (as stored, trimmed; "" when not set), wishesSet (boxes the
 *   packet prints: a box left out below is not counted),
 *   secrets: [{ part, what, why }] (texts left out, each named once: why "secret", a password or a recovery phrase; why
 *   "number", a long number), today
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const cur = plan.meta?.currency ?? "USD";
  const $ = (n) => money(Math.round(Number(n) || 0), cur);
  const secrets = [];
  /** a text the person typed, or "" when it looks like a password or holds a long number (then named once in `secrets`) */
  const safe = (part, what, v, opts) => {
    const t = text(v), why = t ? heldOut(t, opts) : "";
    if (!why) return t;
    if (!secrets.some((x) => x.part === part && x.what === what)) secrets.push({ part, what, why });
    return "";
  };
  const people = (plan.household?.people ?? []).filter((p) => p?.id);
  const whose = (id, part) => { const p = people.find((x) => x.id === id); return p ? (isYou(p.name) ? "you" : safe(part, "a person's name", p.name)) : ""; };
  // each account's and policy's title, said once wherever the packet names it: its own name, else its kind
  const accounts = (plan.accounts ?? []).filter((a) => a?.id);
  const policies = (plan.insurance?.policies ?? []).filter((p) => p?.id);
  const typeOf = (a) => ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset, kindOf = (p) => POLICY_KINDS[p.kind] ?? POLICY_KINDS.other;
  const titleOf = new Map([
    ...accounts.map((a) => [`account:${a.id}`, safe("accounts", `an account's name (${typeOf(a).label})`, a.name) || typeOf(a).label]),
    ...policies.map((p) => [`policy:${p.id}`, safe("accounts", `a policy's name (${kindOf(p).label})`, p.name) || `${kindOf(p).label} insurance`]),
  ]);

  // who to call (household/contacts): name, firm, phone, email, what they handle with the last four digits only
  const c = contactsOf(plan);
  const last4 = new Map();   // account or policy id -> "1234", from any contact that keeps it
  for (const k of c.contacts) for (const l of k.links) if (lastFour(l.last4) && !last4.has(l.id)) last4.set(l.id, lastFour(l.last4));
  const linkName = (l) => titleOf.get(`${l.kind}:${l.id}`) ?? (l.kind === "policy" ? "A policy" : "An account");
  const contactRows = c.contacts.map((k) => {
    const name = safe("contacts", "a contact's name", k.name), firm = safe("contacts", "a contact's firm", k.firm);
    const phone = safe("contacts", "a contact's phone", k.phone, { phone: true }), email = safe("contacts", "a contact's email", k.email);
    return { title: name || firm || "Someone", value: k.roleLabel, lines: [
      name && firm ? firm : "",
      phone ? `Phone ${phone}` : "",
      email ? `Email ${email}` : "",
      k.links.length ? `Handles: ${k.links.map((l) => `${linkName(l)}${lastFour(l.last4) ? ` (ending ${lastFour(l.last4)})` : ""}`).join(", ")}` : "",
      safe("contacts", `the notes for ${name || firm || "a contact"}`, k.notes),
    ].filter(Boolean) };
  });
  const contactsMissing = [];
  if (!c.contacts.some((k) => k.role === "emergency")) contactsMissing.push("No one is listed to call in an emergency.");
  if (c.contacts.length && !c.contacts.some((k) => k.role === "executor")) contactsMissing.push("No executor (the person who carries out the will) is listed.");

  // where the papers are (household/documents, which also reads the signed estate papers' places)
  const pp = papersOf(plan, { today });
  const allPapers = pp.groups.flatMap((g) => g.rows);
  const named = (r) => {
    const who = r.personName ? (isYou(r.personName) ? "you" : safe("papers", "a person's name", r.personName)) : "";
    return `${safe("papers", "a paper's name", r.label) || "A paper"}${who ? ` (${who})` : ""}`;
  };
  const paperRows = allPapers.filter((r) => r.placed).map((r) => {
    const n = named(r), where = safe("papers", `the place for ${n}`, r.where);
    const copy = safe("papers", `the copy of ${n}`, r.copy), who = safe("papers", `who else knows about ${n}`, r.who);
    return { title: n, value: "", lines: [where ? `Kept: ${where}` : "Kept: left out of this packet", copy ? `Copy: ${copy}` : "", who ? `Also knows: ${who}` : ""].filter(Boolean) };
  });
  const paperMissing = allPapers.filter((r) => !r.done && !r.optional);
  const papersMissing = paperMissing.length ? [`Not written down yet: ${listOf(paperMissing.map(named))}.`] : [];

  // accounts and policies: the account's own name, firm, kind and whose; a debt's payment; who is named to receive it
  const bene = beneficiariesOf(plan, { today });
  const beneOf = new Map(bene.items.map((x) => [x.key, x]));
  const debtOf = new Map((plan.debts ?? []).filter((x) => x?.accountId).map((x) => [x.accountId, x]));
  const goesTo = (x) => {
    if (!x) return "";
    if (!x.primary.length) return "No one named to receive it";
    const names = (l) => l.map((b) => safe("accounts", "a beneficiary's name", b.name)).filter(Boolean).join(", ") || "someone named on the form";
    return `Goes to: ${names(x.primary)}${x.contingent.length ? `; then ${names(x.contingent)}` : ""}`;
  };
  const accountRows = [
    ...accounts.map((a) => {
      const t = typeOf(a), debt = isLiability(a.type) ? debtOf.get(a.id) : null;
      const pay = (Number(debt?.minPayment) || 0) + (Number(debt?.extra) || 0);
      const firm = safe("accounts", `an account's firm (${t.label})`, a.institution), who = whose(a.ownerId, "accounts");
      return { title: titleOf.get(`account:${a.id}`), value: t.label, lines: [
        firm ? `At ${firm}` : "",
        last4.has(a.id) ? `Number ending ${last4.get(a.id)}` : "",
        who ? `Whose: ${who}` : "",
        pay > 0 ? `Payment about ${$(pay)} a month` : "",
        goesTo(beneOf.get(`account:${a.id}`)),
      ].filter(Boolean) };
    }),
    ...policies.map((p) => {
      const k = kindOf(p);
      const insurer = safe("accounts", `a policy's insurer (${k.label})`, p.insurer), who = whose(p.personId, "accounts");
      return { title: titleOf.get(`policy:${p.id}`), value: k.label, lines: [
        insurer ? `With ${insurer}` : "",
        last4.has(p.id) ? `Policy number ending ${last4.get(p.id)}` : "",
        who ? `Covers: ${who}` : "",
        Number(p.benefit) > 0 ? `${k.benefit}: ${$(p.benefit)}` : "",
        p.throughWork ? "Through work: ask the employer's benefits office" : "",
        goesTo(beneOf.get(`policy:${p.id}`)),
      ].filter(Boolean) };
    }),
  ];
  const unnamed = bene.items.filter((x) => !x.primary.length);
  const accountsMissing = !accounts.length && !policies.length ? ["No accounts or policies yet: add them on Net worth and Policies."] : unnamed.length ? [`${unnamed.length === 1 ? "One has" : `${unnamed.length} have`} no one named to receive ${unnamed.length === 1 ? "it" : "them"}: ${listOf(unnamed.map((x) => titleOf.get(x.key) ?? x.typeLabel))}.`] : [];

  // online accounts (estate/digital): what it is and how someone could get in, never the password
  const dg = digitalOf(plan);
  const onlineRows = dg.items.map((x) => {
    const who = safe("online", "who can get in", x.contact);
    return { title: safe("online", "an online account's name", x.name) || x.kindLabel, value: x.kindLabel,
      lines: [`${x.accessLabel}${who ? `: ${who}` : ""}`, safe("online", `the notes for ${x.kindLabel.toLowerCase()}`, x.notes)].filter(Boolean) };
  });
  const noWay = dg.items.filter((x) => !x.planned);
  const onlineMissing = [
    noWay.length ? `${noWay.length === 1 ? "One has" : `${noWay.length} have`} no way in for your family yet.` : "",
    dg.missing.length ? `No plan yet for: ${dg.missing.map((k) => (k === "manager" ? "the password manager" : k === "email" ? "your email" : "your crypto")).join(", ")}.` : "",
  ].filter(Boolean);

  // bills that pay themselves: the payments out that cashflow/recurring finds coming back in the bank files
  const rc = recurringOf(plan, { today });
  const fromName = (id) => titleOf.get(`account:${id}`) ?? "";
  const bills = rc.detected.filter((r) => r.amount < 0);
  const billRows = bills.map((r) => ({
    title: safe("bills", "a bill's name", r.payee) || "A payment", value: $(Math.abs(r.amount)),
    lines: [`${$(Math.abs(r.amount))} ${r.cadenceLabel}`, fromName(r.accountId) ? `From ${fromName(r.accountId)}` : "", r.next ? `Next about ${shortDate(r.next)}` : ""].filter(Boolean),
  }));
  const billsMonthly = bills.reduce((s, r) => s + (Number(r.monthly) || 0), 0);
  const billsMissing = bills.length ? [] : [(plan.transactions ?? []).length ? "None found in your bank files yet: a payment shows here once it has come back a few times." : "These come from your bank files: bring one in on Import and the payments that come back each month show here."];

  // final wishes (estate.wishes, kept on this page); the letter's place falls back on Estate documents' letter of instruction
  const w = plan.estate?.wishes ?? {};
  const wishes = Object.fromEntries(WISHES.map((f) => [f.key, text(w[f.key])]));
  wishes.updatedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(w.updatedAt ?? "")) ? w.updatedAt : "";
  // a box counts as written only when the packet prints it (a password or a long number is left out, and not counted)
  const printed = Object.fromEntries(WISHES.map((f) => [f.key, safe("wishes", f.label.toLowerCase(), wishes[f.key])]));
  const wishesSet = WISHES.filter((f) => printed[f.key]).length;
  const docs = documentsOf(plan, { today });
  const letter = docs.items.find((x) => x.kind === "letter" && x.status === "done" && text(x.where));
  const letterWhere = letter ? safe("wishes", "where the letter of instruction is kept", letter.where) : "";
  const wishRows = WISHES.map((f) => {
    const t = printed[f.key] || (f.key === "letterWhere" && letterWhere ? `${letterWhere} (from Estate documents)` : "");
    return t ? { title: f.label, value: "", lines: [t] } : null;
  }).filter(Boolean);

  // the first steps, with what the plan knows about the will and the executor
  const will = docs.items.find((x) => x.kind === "will" && x.status === "done" && text(x.where)) ?? null;
  const willWhere = will ? safe("steps", "where the will is kept", will.where) : "";
  const executor = c.contacts.find((k) => k.role === "executor");
  const exName = executor ? safe("contacts", "a contact's name", executor.name) || safe("contacts", "a contact's firm", executor.firm) || "listed on Contacts" : "";
  const exPhone = executor ? safe("contacts", "a contact's phone", executor.phone, { phone: true }) : "";
  const stepRows = STEPS.map((s, i) => ({ title: s, value: "", lines: i === 3 ? [
    willWhere ? `The will is kept: ${willWhere}.` : will ? "Where the will is kept is left out of this packet." : "Where the will is kept is not written down yet (Estate documents).",
    executor ? `The executor: ${exName}${exPhone ? `, ${exPhone}` : ""}.` : "No executor is listed yet (Contacts).",
  ] : [] }));

  const parts = PARTS.map((p) => ({ ...p, rows: [], missing: [], note: "", filled: false, count: 0, says: "" }));
  const P = Object.fromEntries(parts.map((p) => [p.key, p]));
  Object.assign(P.contacts, { rows: contactRows, missing: contactsMissing, count: contactRows.length, filled: contactRows.length > 0,
    says: contactRows.length ? plural(contactRows.length, "person", "people") : "none yet" });
  Object.assign(P.papers, { rows: paperRows, missing: papersMissing, count: pp.placed, filled: pp.placed > 0,
    says: pp.total ? `${pp.placed} of ${pp.total} found` : "none to find" });
  const nAcc = accountRows.length;
  Object.assign(P.accounts, { rows: accountRows, missing: accountsMissing, count: nAcc, filled: nAcc > 0,
    says: !nAcc ? "none yet" : unnamed.length ? (unnamed.length === 1 ? "1 has no one named" : `${unnamed.length} have no one named`) : `${nAcc}, all named` });
  Object.assign(P.online, { rows: onlineRows, missing: onlineMissing, count: onlineRows.length, filled: onlineRows.length > 0,
    says: !onlineRows.length ? "none yet" : noWay.length ? (noWay.length === 1 ? "1 has no way in" : `${noWay.length} have no way in`) : plural(onlineRows.length, "account", "accounts") });
  Object.assign(P.bills, { rows: billRows, missing: billsMissing, count: billRows.length, filled: billRows.length > 0,
    note: billRows.length ? `About ${$(billsMonthly)} a month in all.` : "", says: billRows.length ? plural(billRows.length, "bill", "bills") : "none found yet" });
  Object.assign(P.wishes, { rows: wishRows, missing: [], count: wishesSet, filled: wishesSet > 0, says: wishesSet ? `${wishesSet} of ${WISHES.length} written` : "not set yet" });
  Object.assign(P.steps, { rows: stepRows, count: STEPS.length, filled: true, says: `${STEPS.length} steps` });

  const groups = GROUPS.map((g) => {
    const sections = g.sections.map((k) => P[k]);
    // the status is the first filled section's own (two never fit in 20 characters: "1, all named · 1 bill" is 21)
    const mine = sections.filter((p) => p.key !== "steps" && p.filled);
    return { key: g.key, title: g.title, sections, filled: mine.length > 0, says: mine.length ? mine[0].says : g.none ?? sections[0].says };
  });
  const filled = groups.filter((g) => g.filled).length;
  return { parts, groups, filled, total: groups.length, empty: filled === 0, wishes, wishesSet, secrets, today };
}

/** Save the final wishes on the plan draft (changes `draft` in place): every box trimmed; all empty removes them. */
export function saveWishes(draft, values, today) {
  const clean = Object.fromEntries(WISHES.map((f) => [f.key, text(values?.[f.key])]));
  draft.estate = draft.estate ?? { documents: [], beneficiaries: [] };
  if (!WISHES.some((f) => clean[f.key])) { delete draft.estate.wishes; return null; }
  draft.estate.wishes = { ...clean, updatedAt: today ?? "" };
  return draft.estate.wishes;
}

/** The amber lines for what was left out, one written sentence per case: passwords and recovery phrases, then long numbers. */
export function leftOutOf(d) {
  const of = (why) => [...new Set(d.secrets.filter((s) => (s.why ?? "secret") === why).map((s) => s.what))];
  const secret = of("secret"), number = of("number");
  return [
    secret.length ? `Left out of the packet because ${secret.length === 1 ? "it looks" : "they look"} like a password or a recovery phrase: ${secret.join("; ")}. Write where a secret is kept, never the secret itself.` : "",
    number.length ? `Left out of the packet because ${number.length === 1 ? "it holds" : "they hold"} a long number, like a full account or Social Security number: ${number.join("; ")}. Write only the last four digits of a number.` : "",
  ].filter(Boolean);
}

/** The headline, one written sentence per case: nothing yet, some parts, every part. */
export function headlineOf(d) {
  if (d.empty) return "One packet your family can use if something happens to you.";
  if (d.filled === d.total) return `Ready to print: all ${d.total} parts filled in`;
  return `Ready to print: ${d.filled} of ${d.total} parts filled in`;
}
/** The line under it, one per case. */
export function ledeOf(d) {
  if (d.empty) return "Start with who to call: the people your family would phone first.";
  if (d.filled === d.total) return "One packet your family can use if something happens to you. Print it and keep it with your will.";
  return "One packet your family can use if something happens to you. Each part below says what is still missing.";
}
