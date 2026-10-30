// modules/estate/digital/compute.js -- PURE. The online side of an estate: email, the password manager,
// phones, photos, online banking, crypto, social media, domains. For each, how someone you trust could
// get in if something happened to you (never the password itself), and what is missing: the email that
// resets everything else, a password manager without emergency access, crypto with no recovery plan
// (lost for good). Notes that look like a password or a recovery phrase are flagged to be removed.

export const KINDS = {
  email: { label: "Email", icon: "📧", key: true, tip: "Email resets every other password: it is the first account to plan for. Google and Apple let you name someone who can get in (Inactive Account Manager, Legacy Contact)." },
  manager: { label: "Password manager", icon: "🔐", key: true, tip: "Most password managers have an emergency access feature: someone you name can ask for access, and gets it if you do not say no in time." },
  phone: { label: "Phone or computer", icon: "📱", tip: "The passcode, in the letter of instruction or the password manager: two-step codes often arrive on the phone." },
  photos: { label: "Photos and files", icon: "🖼️", tip: "Cloud photo libraries close with the account: name a legacy contact, or share an album now." },
  finance: { label: "Online banking or investing", icon: "🏦", tip: "The accounts themselves pass by beneficiary or by the will; the logins only help the family find them." },
  crypto: { label: "Crypto", icon: "🪙", key: true, tip: "Without the recovery phrase or the exchange login, crypto is lost for good. Keep the phrase on paper in a safe place someone knows about; never online." },
  social: { label: "Social media", icon: "💬", tip: "Most networks let family memorialise or close an account; some let you name a legacy contact." },
  domain: { label: "Website or domain", icon: "🌐", tip: "Domains lapse when nobody renews them." },
  other: { label: "Other", icon: "🗂️", tip: "" },
};
export const ACCESS = {
  manager: "In the password manager, with emergency access",
  legacy: "A legacy contact is named on the account",
  written: "Written down in a safe place someone knows",
  none: "No plan yet",
};
/** A recovery phrase is 12 to 24 short lowercase words; a password note says so. */
const PHRASE = /(^|\s)([a-z]{3,8}\s+){11,23}[a-z]{3,8}(\s|$)/;
const SECRET = /\b(password|passcode|pin|seed|recovery phrase|pw)\s*[:=]/i;
export const looksSecret = (text) => PHRASE.test(String(text ?? "").toLowerCase()) || SECRET.test(String(text ?? ""));

/**
 * compute(plan) -> {
 *   items: [{ ...item, kindLabel, icon, accessLabel, planned, secret }], count, planned, missing (key kinds with no item, or none planned),
 *   cryptoHeld (crypto accounts on Accounts), warnings
 * }
 */
export function compute(plan) {
  const raw = plan.estate?.digital ?? [];
  const items = raw.map((x) => {
    const k = KINDS[x.kind] ?? KINDS.other;
    const access = ACCESS[x.access] ? x.access : "none";
    return { ...x, kind: KINDS[x.kind] ? x.kind : "other", kindLabel: k.label, icon: k.icon, access, accessLabel: ACCESS[access], planned: access !== "none" && (access !== "written" || !!String(x.contact ?? "").trim()), secret: looksSecret(x.notes) || looksSecret(x.name) || looksSecret(x.contact) };
  });
  const cryptoHeld = (plan.accounts ?? []).filter((a) => a.type === "crypto").reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const warnings = [];
  for (const x of items) if (x.secret) warnings.push(`${x.name || x.kindLabel}: the notes look like a password or a recovery phrase. Remove it: this plan is a file on your computer and in backups. Write where the secret is kept, never the secret.`);
  const missing = [];
  for (const kind of ["email", "manager"]) if (!items.some((x) => x.kind === kind && x.planned)) missing.push(kind);
  if (cryptoHeld > 0 && !items.some((x) => x.kind === "crypto" && x.planned)) { missing.push("crypto"); warnings.push("You hold crypto (on Accounts) with no recovery plan here: if no one can find the recovery phrase or the exchange login, it is lost for good."); }
  return { items, count: items.length, planned: items.filter((x) => x.planned).length, missing, cryptoHeld, warnings };
}
