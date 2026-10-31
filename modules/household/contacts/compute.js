// modules/household/contacts/compute.js -- PURE. The people and firms to call about your money: advisor, accountant,
// attorney, insurers, banks and the person to call in an emergency. Each can be tied to the accounts and policies it
// handles, with only the last four digits of each number. Banks and insurers already named on your accounts and
// policies are suggested, and what is worth a look is listed.
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { KINDS as POLICY_KINDS } from "../../insurance/policies/compute.js";

/** Roles, in the order shown. */
export const ROLES = {
  emergency:  { label: "Someone to call in an emergency" },
  advisor:    { label: "Financial advisor or planner" },
  accountant: { label: "Accountant or tax preparer" },
  attorney:   { label: "Lawyer" },
  executor:   { label: "Executor (carries out the will)" },
  bank:       { label: "Bank, lender or investment firm" },
  insurer:    { label: "Insurance company or agent" },
  employer:   { label: "Work: benefits or HR" },
  doctor:     { label: "Doctor" },
  other:      { label: "Someone else" },
};

/** Kinds of account with no firm behind them (a house, a car, cash, other things): never "not tied to anyone". */
export const NO_FIRM = ["property", "vehicle", "cash", "other_asset"];

const text = (v) => String(v ?? "").trim();
const norm = (s) => text(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Only the last four digits of a number are kept: exactly 4 digits, else "". */
export const lastFour = (v) => { const s = text(v).replace(/[\s-]/g, ""); return /^\d{4}$/.test(s) ? s : ""; };

/**
 * compute(plan) -> {
 *   contacts: [{ ...contact, roleLabel, links: [{ kind: "account"|"policy", id, name, what, last4 }] }],
 *   byRole: [{ role, label, contacts }],
 *   suggestions: [{ key, role, firm, accountIds, policyIds, what }],
 *   checks: [{ id, text }], empty
 * }
 */
export function compute(plan) {
  const accounts = (plan.accounts ?? []).filter((a) => a?.id);
  const policies = (plan.insurance?.policies ?? []).filter((p) => p?.id);
  const stored = (plan.contacts ?? []).filter((c) => c?.id);
  const accountName = (a) => `${a.name || "Account"}`;
  const policyName = (p) => `${p.name || POLICY_KINDS[p.kind]?.label || "Policy"}`;
  const contacts = stored.map((c) => {
    const last4 = c.last4 ?? {};
    const links = [
      ...(c.accountIds ?? []).map((id) => accounts.find((a) => a.id === id)).filter(Boolean).map((a) => ({ kind: "account", id: a.id, name: accountName(a), what: ACCOUNT_TYPES[a.type]?.label ?? "Account", last4: lastFour(last4[a.id]) })),
      ...(c.policyIds ?? []).map((id) => policies.find((p) => p.id === id)).filter(Boolean).map((p) => ({ kind: "policy", id: p.id, name: policyName(p), what: POLICY_KINDS[p.kind]?.label ?? "Policy", last4: lastFour(last4[p.id]) })),
    ];
    return { ...c, name: text(c.name), firm: text(c.firm), phone: text(c.phone), email: text(c.email), notes: text(c.notes), role: ROLES[c.role] ? c.role : "other", roleLabel: (ROLES[c.role] ?? ROLES.other).label, links };
  }).sort((x, y) => Object.keys(ROLES).indexOf(x.role) - Object.keys(ROLES).indexOf(y.role) || (x.name || x.firm).localeCompare(y.name || y.firm));
  const byRole = Object.entries(ROLES).map(([role, r]) => ({ role, label: r.label, contacts: contacts.filter((c) => c.role === role) })).filter((g) => g.contacts.length);

  // suggestions: each bank on your accounts and each insurer on your policies that no contact handles yet
  const handled = new Set(contacts.flatMap((c) => c.links.map((l) => `${l.kind}:${l.id}`)));
  const firms = new Set(contacts.map((c) => norm(c.firm)).filter(Boolean));
  const groups = new Map();
  const add = (role, firm, kind, id, label) => {
    const k = `${role}:${norm(firm)}`;
    if (!groups.has(k)) groups.set(k, { key: k, role, firm: text(firm), accountIds: [], policyIds: [], names: [] });
    const g = groups.get(k);
    (kind === "account" ? g.accountIds : g.policyIds).push(id); g.names.push(label);
  };
  for (const a of accounts) if (norm(a.institution) && !handled.has(`account:${a.id}`)) add("bank", a.institution, "account", a.id, accountName(a));
  for (const p of policies) if (norm(p.insurer) && !handled.has(`policy:${p.id}`)) add("insurer", p.insurer, "policy", p.id, policyName(p));
  const suggestions = [...groups.values()].filter((g) => !firms.has(norm(g.firm))).map(({ names, ...g }) => ({ ...g, what: names.join(", ") }));

  const checks = [];
  if (!contacts.some((c) => c.role === "emergency")) checks.push({ id: "emergency", text: "No one is listed to call in an emergency. Add a person you trust who knows where your papers are." });
  const noWay = contacts.filter((c) => !c.phone && !c.email);
  if (noWay.length) checks.push({ id: "reach", text: `${noWay.length <= 3 ? noWay.map((c) => c.name || c.firm).join(", ") : `${noWay.length} contacts`} ${noWay.length === 1 ? "has" : "have"} no phone or email yet.` });
  const unlinked = [...accounts.filter((a) => !NO_FIRM.includes(a.type) && !handled.has(`account:${a.id}`) && !norm(a.institution)), ...policies.filter((p) => !handled.has(`policy:${p.id}`) && !norm(p.insurer))];
  if (unlinked.length && contacts.length) checks.push({ id: "unlinked", text: `${unlinked.length} ${unlinked.length === 1 ? "account or policy is" : "accounts and policies are"} not tied to anyone to call. Tie each one to its bank or insurer below.` });

  return { contacts, byRole, suggestions, checks, empty: !contacts.length };
}

/** Add or change a contact on the plan draft; changes `draft` in place. -> the stored contact */
export function saveContact(draft, c) {
  const last4 = {};
  for (const [id, v] of Object.entries(c.last4 ?? {})) { const f = lastFour(v); if (f) last4[id] = f; }
  const clean = { id: c.id, role: ROLES[c.role] ? c.role : "other", name: text(c.name), firm: text(c.firm), phone: text(c.phone), email: text(c.email), notes: text(c.notes),
    accountIds: [...new Set(c.accountIds ?? [])], policyIds: [...new Set(c.policyIds ?? [])], last4 };
  draft.contacts = draft.contacts ?? [];
  const i = draft.contacts.findIndex((x) => x.id === clean.id);
  if (i >= 0) draft.contacts[i] = clean; else draft.contacts.push(clean);
  return clean;
}

/** Remove a contact. -> true when one went */
export function removeContact(draft, id) {
  const n = (draft.contacts ?? []).length;
  draft.contacts = (draft.contacts ?? []).filter((x) => x.id !== id);
  return draft.contacts.length < n;
}
