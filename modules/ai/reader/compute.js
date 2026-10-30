// modules/ai/reader/compute.js -- PURE. Reads the text of a pay stub, an account statement, a Social
// Security statement or an advisor's plan, finds the figures that matter (by their labels, no model
// needed), and turns them into proposed changes to the plan, each with what it is now and what it would
// become. Nothing changes until the user accepts one (the view applies it with applyProposal). A
// language model can fill the figures the labels missed (buildPrompt / parseAnswer); it never writes
// to the plan itself. Account numbers are never kept.
import { perYear } from "../../../core/math/periods.js";

export const KINDS = {
  paystub: { label: "A pay stub", hint: "gross pay, net pay, tax withheld, 401(k)" },
  statement: { label: "An account statement", hint: "the ending balance and the date" },
  ssa: { label: "A Social Security statement", hint: "the benefit at full retirement age" },
  advisor: { label: "An advisor's plan", hint: "assumed returns, inflation, fees, chance of success" },
};

/** The fields each kind looks for: label patterns (first match wins), the unit, and how to read the value. */
export const FIELDS = {
  paystub: [
    { key: "gross", label: "Gross pay this period", unit: "money", labels: [/gross\s*(pay|earnings|wages)/i, /total\s*gross/i, /^\s*gross\b/i] },
    { key: "net", label: "Net (take-home) pay", unit: "money", labels: [/net\s*(pay|amount|check)/i, /take[\s-]*home/i] },
    { key: "federal", label: "Federal income tax withheld", unit: "money", labels: [/fed(eral)?\.?\s*(income\s*)?(tax|withholding|w\/h)/i, /\bfit\b/i] },
    { key: "k401", label: "401(k) contribution", unit: "money", labels: [/40[13]\s*\(?[kb]\)?/i] },
    { key: "payDate", label: "Pay date", unit: "date", labels: [/(pay|check|advice)\s*date/i] },
    { key: "periodStart", label: "Period start", unit: "date", labels: [/period\s*(begin|beginning|start)/i, /pay\s*period/i] },
    { key: "periodEnd", label: "Period end", unit: "date", last: true, labels: [/period\s*(end|ending)/i, /pay\s*period/i] },
  ],
  statement: [
    { key: "balance", label: "Ending balance", unit: "money", labels: [/(ending|closing|new|current)\s*balance/i, /total\s*(account\s*)?value/i, /ending\s*value/i, /balance\s*(as\s*of|on)/i] },
    { key: "date", label: "Statement date", unit: "date", last: true, labels: [/statement\s*(date|closing\s*date|period)/i, /(period|cycle)\s*end(ing)?/i, /closing\s*date/i, /as\s*of/i, /through/i] },
  ],
  ssa: [
    { key: "monthlyAtFRA", label: "Monthly benefit at full retirement age", unit: "money", labels: [/full\s*retirement\s*age/i, /at\s*(age\s*)?67\b/i] },
    { key: "at70", label: "Monthly benefit at 70", unit: "money", labels: [/at\s*(age\s*)?70\b/i] },
    { key: "at62", label: "Monthly benefit at 62", unit: "money", labels: [/at\s*(age\s*)?62\b/i] },
  ],
  advisor: [
    { key: "returnStocks", label: "Stock return assumed", unit: "percent", labels: [/(equit(y|ies)|stocks?)[^%\n]{0,40}return/i, /return[^%\n]{0,30}(equit|stock)/i] },
    { key: "returnBonds", label: "Bond return assumed", unit: "percent", labels: [/(bonds?|fixed\s*income)[^%\n]{0,40}return/i, /return[^%\n]{0,30}(bond|fixed)/i] },
    { key: "inflation", label: "Inflation assumed", unit: "percent", labels: [/inflation/i] },
    { key: "fee", label: "Advisory fee a year", unit: "percent", labels: [/(advisory|management|advisor|wrap)\s*fee/i] },
    { key: "quotedChance", label: "Chance of success quoted", unit: "percent", labels: [/(probability|chance|likelihood)\s*of\s*success/i, /confidence\s*(level|score)/i, /success\s*rate/i] },
    { key: "retireAge", label: "Retirement age", unit: "age", labels: [/retire(ment)?\s*(at\s*)?age/i, /retir\w*\s*at\s*(\d\d)/i] },
    { key: "spendingMonthly", label: "Spending in retirement, a month", unit: "money", labels: [/(retirement\s*)?(spending|living\s*expenses|income\s*(need|goal))/i] },
  ],
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

/** The first money amount in a piece of text: $1,234.56, 1,234.56, (123.45) as negative; a bare number only with cents or a $ (so years and ages are skipped). */
export function firstMoney(s) {
  const re = /(\(?)(-?)(\$\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d+)(\)?)/g;
  for (const m of String(s).matchAll(re)) {
    const digits = m[4];
    if (!m[3] && !/[,.]/.test(digits)) continue;   // a bare whole number (a year, an age) is not money
    const v = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    return (m[1] === "(" && m[5] === ")") || m[2] === "-" ? -v : v;
  }
  return null;
}
/** The first percentage: 6.5% -> 0.065. */
export function firstPercent(s) { const m = String(s).match(/(-?\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) / 100 : null; }
/** The first date as YYYY-MM-DD: 03/15/2026, 2026-03-15, March 15, 2026, 15 Mar 2026. */
export function firstDate(s) {
  const t = String(s);
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/); if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${pad(m[1])}-${pad(m[2])}`; }
  const month = (w) => MONTHS[w.slice(0, 4).toLowerCase()] ?? MONTHS[w.slice(0, 3).toLowerCase()] ?? null;
  m = t.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/); if (m && month(m[1])) return `${m[3]}-${pad(month(m[1]))}-${pad(m[2])}`;
  m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/); if (m && month(m[2])) return `${m[3]}-${pad(month(m[2]))}-${pad(m[1])}`;
  return null;
}
/** The last date in a piece of text (the end of "09/01/2026 to 09/30/2026"). */
export function lastDate(s) {
  const parts = String(s).split(/\s+(?:to|through|thru|-|–)\s+/i);
  for (let i = parts.length - 1; i >= 0; i--) { const d = firstDate(parts[i]); if (d) return d; }
  return null;
}
const firstAge = (s) => { const m = String(s).match(/\b([4-8]\d)\b/); return m ? Number(m[1]) : null; };

/** Guess what kind of paper it is from its words. */
export function detectKind(text) {
  const t = String(text).toLowerCase();
  const score = {
    paystub: (/net pay/.test(t) ? 2 : 0) + (/gross/.test(t) ? 1 : 0) + (/ytd|year to date/.test(t) ? 1 : 0) + (/pay (date|period)/.test(t) ? 1 : 0),
    ssa: (/social security/.test(t) ? 2 : 0) + (/full retirement age/.test(t) ? 2 : 0) + (/earnings record/.test(t) ? 1 : 0),
    advisor: (/(probability|chance) of success|monte carlo/.test(t) ? 2 : 0) + (/assum/.test(t) ? 1 : 0) + (/inflation/.test(t) ? 1 : 0) + (/advis/.test(t) ? 1 : 0),
    statement: (/(ending|closing|new) balance/.test(t) ? 2 : 0) + (/statement (period|date)/.test(t) ? 1 : 0) + (/account (summary|number)/.test(t) ? 1 : 0),
  };
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

/** Read the fields of a kind from text: for each field, the first line matching a label, the value after the label (or on the next line). */
export function readFields(kind, text) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = {};
  for (const f of FIELDS[kind] ?? []) {
    for (const re of f.labels) {
      const i = lines.findIndex((l) => re.test(l));
      if (i < 0) continue;
      const m = lines[i].match(re);
      const after = lines[i].slice((m.index ?? 0) + m[0].length);
      const read = (s) => (f.unit === "money" ? firstMoney(s) : f.unit === "percent" ? firstPercent(s) : f.unit === "date" ? (f.last ? lastDate(s) : firstDate(s)) : firstAge(m[0].match(/\d\d/) ? m[0] : s));
      let v = read(after);
      if (v === null && lines[i + 1]) v = read(lines[i + 1]);
      if (v !== null) { out[f.key] = v; break; }
    }
  }
  // the advisor's spending: a yearly figure becomes a month
  if (kind === "advisor" && out.spendingMonthly !== undefined) { const line = lines.find((l) => FIELDS.advisor.at(-1).labels[0].test(l)) ?? ""; if (/year|annual|\/yr|per\s*yr/i.test(line) && !/month|\/mo/i.test(line)) out.spendingMonthly = out.spendingMonthly / 12; }
  // the paycheck's frequency: the words on the stub, else the length of the period
  if (kind === "paystub") {
    const t = String(text).toLowerCase();
    out.period = /bi-?weekly|every (two|2) weeks/.test(t) ? "biweekly" : /semi-?monthly|twice a month/.test(t) ? "semimonthly" : /\bweekly\b/.test(t) ? "weekly" : /\bmonthly\b/.test(t) ? "monthly" : null;
    if (!out.period && out.periodStart && out.periodEnd) {
      const days = Math.round((Date.parse(out.periodEnd) - Date.parse(out.periodStart)) / 864e5) + 1;
      out.period = days <= 8 ? "weekly" : days <= 14 ? "biweekly" : days <= 16 ? "semimonthly" : "monthly";
    }
  }
  return out;
}

/** The prompt that asks a model for the same fields as JSON (numbers only, null when not there). */
export function buildPrompt(kind, text) {
  const keys = (FIELDS[kind] ?? []).map((f) => `"${f.key}": ${f.label} (${f.unit === "percent" ? "a fraction, 0.065 for 6.5%" : f.unit === "date" ? "YYYY-MM-DD" : f.unit === "money" ? "a number, no $ or commas" : "a number"})`).join("\n");
  return [
    { role: "system", content: "You read financial documents and return only JSON. Never invent a figure: use null when the paper does not state it. Never include account numbers." },
    { role: "user", content: `${KINDS[kind]?.label ?? "A financial paper"}. Return a JSON object with these keys:\n${keys}\n\nThe text:\n"""\n${String(text).slice(0, 12000)}\n"""` },
  ];
}
/** The model's answer as fields: the JSON object in it, only the known keys, numbers and dates checked. */
export function parseAnswer(kind, content) {
  const m = String(content ?? "").match(/\{[\s\S]*\}/);
  if (!m) return {};
  let j; try { j = JSON.parse(m[0]); } catch { return {}; }
  const out = {};
  for (const f of FIELDS[kind] ?? []) {
    const v = j[f.key];
    if (v === null || v === undefined || v === "") continue;
    if (f.unit === "date") { const d = firstDate(String(v)); if (d) out[f.key] = d; }
    else { const n = Number(String(v).replace(/[$,%\s]/g, "")); if (Number.isFinite(n)) out[f.key] = f.unit === "percent" && n > 1 ? n / 100 : n; }
  }
  return out;
}

/**
 * The changes the fields suggest, against the plan as it is. Each: { id, op, label, before, after, ...target } -- applied only by the user.
 * ctx: { personId, accountId, today }
 */
export function proposals(plan, kind, fields, ctx = {}) {
  const out = [];
  const people = plan.household?.people ?? [];
  const person = people.find((p) => p.id === ctx.personId) ?? people.find((p) => p.role === "self") ?? people[0];
  const who = person?.name ?? "You";
  if (kind === "paystub" && fields.gross > 0) {
    const period = fields.period ?? "biweekly";
    const inc = (plan.income ?? []).find((x) => x.personId === person?.id && x.type === "salary");
    out.push({ id: "pay", op: "income", personId: person?.id ?? "", incomeId: inc?.id ?? null, amount: fields.gross, period, label: `${who}'s pay: ${fields.gross} ${period}`, before: inc ? { amount: inc.amount, period: inc.period, yearly: perYear(inc.amount, inc.period) } : null, after: { amount: fields.gross, period, yearly: perYear(fields.gross, period) } });
    if (fields.federal > 0) {
      const slot = person?.role === "partner" ? "partner" : "self";
      const w = plan.taxes?.withholding?.[slot] ?? null;
      out.push({ id: "withholding", op: "withholding", slot, perPaycheck: fields.federal, period, label: `Federal tax withheld per paycheck: ${fields.federal}`, before: w ? { perPaycheck: w.perPaycheck, period: w.period } : null, after: { perPaycheck: fields.federal, period } });
    }
    if (fields.k401 > 0) {
      const c = (plan.retirement?.contributions ?? []).find((x) => x.personId === person?.id && ["401k"].includes((plan.accounts ?? []).find((a) => a.id === x.accountId)?.type));
      if (c) out.push({ id: "k401", op: "contribution", contributionId: c.id, amount: fields.k401, period, label: `401(k) per paycheck: ${fields.k401}`, before: { amount: c.amount, period: c.period }, after: { amount: fields.k401, period } });
    }
  }
  if (kind === "statement" && fields.balance !== undefined && ctx.accountId) {
    const a = (plan.accounts ?? []).find((x) => x.id === ctx.accountId);
    if (a) out.push({ id: "balance", op: "balance", accountId: a.id, balance: Math.abs(fields.balance), date: fields.date ?? ctx.today ?? "", label: `${a.name}: balance ${Math.abs(fields.balance)}`, before: { balance: a.balance, asOf: a.asOf }, after: { balance: Math.abs(fields.balance), asOf: fields.date ?? ctx.today ?? "" } });
  }
  if (kind === "ssa" && fields.monthlyAtFRA > 0 && person) {
    const s = plan.retirement?.socialSecurity?.[person.id] ?? {};
    out.push({ id: "ssa", op: "ssa", personId: person.id, monthlyAtFRA: fields.monthlyAtFRA, label: `${who}'s Social Security at full retirement age: ${fields.monthlyAtFRA} a month`, before: s.monthlyAtFRA ? { monthlyAtFRA: s.monthlyAtFRA } : null, after: { monthlyAtFRA: fields.monthlyAtFRA } });
  }
  if (kind === "advisor") {
    const changes = {};
    for (const k of ["returnStocks", "returnBonds", "inflation", "spendingMonthly"]) if (fields[k] !== undefined) changes[k] = fields[k];
    if (fields.retireAge && person) changes[`retireAge:${person.id}`] = fields.retireAge;
    if (Object.keys(changes).length || fields.fee !== undefined || fields.quotedChance !== undefined) out.push({ id: "advisor", op: "advisor", changes, fee: fields.fee ?? null, quotedChance: fields.quotedChance ?? null, label: "The advisor's assumptions, to compare on Advisor's plan", before: plan.advisor ? { firm: plan.advisor.firm } : null, after: { ...changes, fee: fields.fee ?? null, quotedChance: fields.quotedChance ?? null } });
  }
  return out;
}

/** Apply one accepted proposal to a draft of the plan (inside store.update). */
export function applyProposal(p, x, ids = { newId: () => `r${Math.random().toString(36).slice(2, 9)}` }) {
  switch (x.op) {
    case "income": {
      p.income = p.income ?? [];
      const i = p.income.findIndex((y) => y.id === x.incomeId);
      if (i >= 0) Object.assign(p.income[i], { amount: x.amount, period: x.period });
      else p.income.push({ id: ids.newId(), name: `${(p.household?.people ?? []).find((q) => q.id === x.personId)?.name ?? "My"}'s pay`, type: "salary", personId: x.personId, amount: x.amount, period: x.period, growth: 0.03, taxable: true });
      break;
    }
    case "withholding": p.taxes = p.taxes ?? {}; p.taxes.withholding = p.taxes.withholding ?? {}; p.taxes.withholding[x.slot] = { perPaycheck: x.perPaycheck, period: x.period }; break;
    case "contribution": { const c = (p.retirement?.contributions ?? []).find((y) => y.id === x.contributionId); if (c) Object.assign(c, { amount: x.amount, period: x.period }); break; }
    case "balance": {
      const a = (p.accounts ?? []).find((y) => y.id === x.accountId);
      if (a) { a.balance = x.balance; if (x.date) { a.asOf = x.date; a.history = (a.history ?? []).filter((h) => h.date !== x.date); a.history.push({ date: x.date, balance: x.balance }); a.history.sort((m, n) => String(m.date).localeCompare(String(n.date))); } }
      break;
    }
    case "ssa": p.retirement = p.retirement ?? {}; p.retirement.socialSecurity = p.retirement.socialSecurity ?? {}; p.retirement.socialSecurity[x.personId] = { ...(p.retirement.socialSecurity[x.personId] ?? {}), monthlyAtFRA: x.monthlyAtFRA }; break;
    case "advisor": p.advisor = { ...(p.advisor ?? {}), changes: { ...(p.advisor?.changes ?? {}), ...x.changes }, ...(x.fee !== null ? { fee: x.fee } : {}), ...(x.quotedChance !== null ? { quotedChance: x.quotedChance } : {}) }; break;
    default: break;
  }
  return p;
}

/** compute(plan, { text, kind, personId, accountId, today }) -> { kind, detected, fields, found: [{ key, label, unit, value }], missing: [labels], proposals } */
export function compute(plan, params = {}) {
  const text = String(params.text ?? "");
  const detected = text ? detectKind(text) : null;
  const kind = KINDS[params.kind] ? params.kind : detected;
  if (!kind) return { kind: null, detected, fields: {}, found: [], missing: [], proposals: [] };
  const fields = { ...readFields(kind, text), ...(params.extra ?? {}) };
  const found = (FIELDS[kind] ?? []).filter((f) => fields[f.key] !== undefined).map((f) => ({ key: f.key, label: f.label, unit: f.unit, value: fields[f.key] }));
  const missing = (FIELDS[kind] ?? []).filter((f) => fields[f.key] === undefined).map((f) => f.label);
  return { kind, detected, fields, found, missing, proposals: proposals(plan, kind, fields, params) };
}
