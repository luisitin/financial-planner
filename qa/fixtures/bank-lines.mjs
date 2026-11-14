// qa/fixtures/bank-lines.mjs -- invented bank lines for any invented household (gap #24, 2026-11-14): most of the
// households in qa/ have no transactions, and the pages that read them need some to be tested on. Same plan and seed, same
// lines, every time. Nothing here is real: the shops are made up and the amounts come from a counter.
//   withBankLines(plan, seed)  -> a copy with six months (May to October 2026) of lines on a checking account and a card
//   splitSome(plan, how)       -> a copy with every third purchase split in two ("same": both parts in its own category;
//                                 "other": the smaller part in another spending category, so its own stays the biggest)
//   tagSome(plan)              -> a copy with every fourth purchase tagged "trip", every sixth also "kids"
import { categoriesOf } from "../../modules/transactions/categories/compute.js";

const SHOPS = ["Corner Market", "Blue Kettle Cafe", "Maple Hardware", "City Transit", "Northside Pharmacy", "Lakeview Books", "Green Cart Grocery", "Pine Street Diner"];
export function withBankLines(plan, seed = 1) {
  const p = structuredClone(plan);
  const M = 2 ** 31 - 1;   // the counter's modulus (a small fixed generator: same seed, same lines)
  let s = (seed * 40503 + 12345) % M || 7;
  const rnd = () => (s = (s * 48271) % M) / M;
  p.accounts = Array.isArray(p.accounts) ? p.accounts : [];
  const find = (type, id, name) => p.accounts.find((a) => a?.type === type) ?? (p.accounts.push({ id, name, type, balance: type === "credit" ? 400 : 2500, asOf: "2026-10-31", ownerId: "", institution: "", history: [] }), p.accounts[p.accounts.length - 1]);
  const chk = find("checking", "bl-chk", "Test checking"), card = find("credit", "bl-card", "Test card");
  const cats = categoriesOf(p), spend = cats.filter((c) => c.kind === "expense").map((c) => c.id), pay = cats.find((c) => c.kind === "income")?.id ?? "";
  const out = Array.isArray(p.transactions) ? p.transactions : (p.transactions = []);
  let n = 0;
  const add = (date, amount, payee, accountId, category, extra = {}) => out.push({ id: `bl-${seed}-${++n}`, date, amount: Math.round(amount * 100) / 100, payee, rawPayee: payee.toUpperCase(), accountId, category, tags: [], note: "", ...extra });
  for (let m = 5; m <= 10; m++) {
    const ym = `2026-${String(m).padStart(2, "0")}`, day = (d) => `${ym}-${String(d).padStart(2, "0")}`;
    add(day(1), 2100 + Math.floor(rnd() * 400), "Payroll Deposit", chk.id, pay);
    add(day(15), 2100 + Math.floor(rnd() * 400), "Payroll Deposit", chk.id, pay);
    add(day(2), -(900 + (seed % 5) * 110), "Oak Street Rentals", chk.id, spend[0] ?? "");
    for (let i = 0; i < 16; i++) {
      const d = 1 + Math.floor(rnd() * 28), shop = SHOPS[Math.floor(rnd() * SHOPS.length)];
      // one line in eight is not filed yet; the others go round the spending categories
      add(day(d), -(3 + rnd() * 140), shop, i % 2 ? card.id : chk.id, i % 8 === 7 ? "" : spend[(i + m + seed) % Math.max(1, spend.length)] ?? "");
    }
    add(day(20), 18 + Math.floor(rnd() * 30), "Oak Street Rentals", chk.id, spend[0] ?? "");   // a refund, in the rent's category (never more than it)
    // the card paid from checking: a linked pair, never income or spending
    const paid = 300 + Math.floor(rnd() * 200);
    add(day(25), -paid, "Card Payment", chk.id, "transfer", { transferId: `bl-x-${seed}-${m}` });
    add(day(25), paid, "Payment Thank You", card.id, "transfer", { transferId: `bl-x-${seed}-${m}` });
  }
  return p;
}
const purchase = (p, t) => Number(t.amount) < -0.05 && !!t.category && !t.transferId && t.category !== "transfer" && categoriesOf(p, { all: true }).find((c) => c.id === t.category)?.kind === "expense";
export function splitSome(plan, how = "other") {
  const p = structuredClone(plan);
  const spend = categoriesOf(p).filter((c) => c.kind === "expense").map((c) => c.id);
  let i = 0;
  for (const t of p.transactions ?? []) {
    if (!purchase(p, t) || t.category === "taxes" || t.category === "debt" || i++ % 3) continue;
    const cents = Math.round(Number(t.amount) * 100), part = -Math.max(1, Math.floor(Math.abs(cents) / 3));
    // (never from or to "taxes" or "debt": the Income statement's bank-against-plan figure leaves those out on purpose)
    const other = how === "same" ? t.category : spend.find((c) => c !== t.category && c !== "taxes" && c !== "debt") ?? t.category;
    t.splits = [{ category: other, amount: part / 100 }, { category: t.category, amount: (cents - part) / 100 }];
  }
  return p;
}
export function tagSome(plan) {
  const p = structuredClone(plan);
  let i = 0;
  for (const t of p.transactions ?? []) { if (!purchase(p, t)) continue; i++; if (i % 4 === 0) t.tags = i % 6 === 0 ? ["trip", "kids"] : ["trip"]; }
  return p;
}
