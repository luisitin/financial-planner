// qa/fixtures/sample-plan.mjs -- a small plan with two accounts and two months of
// transactions, shared by the Phase 3 module tests. Amounts are chosen so totals are easy to
// check by hand:
//   checking, September: payroll +1950 and +1950, rent -1500, Kroger -86.40 and -54.12, Netflix -15.49,
//                        transfer to savings -500 (linked), card payment -640.22 (to the Visa account, unlinked)
//   checking, August:    payroll +1950, rent -1500, Shell -48, Kroger -60
//   savings,  September: transfer in +500 (linked)
//   visa,     September: card payment received +640.22, Amazon -42.17, Amazon -42.17 (posted twice, a day apart)
import { emptyPlan } from "../../core/schema/migrate.js";

export function samplePlan() {
  const p = emptyPlan();
  p.accounts.push(
    { id: "chk", name: "Chase checking", type: "checking", balance: 4200, asOf: "2026-09-15" },
    { id: "sav", name: "Ally savings", type: "savings", balance: 11500, asOf: "2026-09-15" },
    { id: "visa", name: "Visa card", type: "credit", balance: 640, asOf: "2026-09-15" },
  );
  const t = (id, accountId, date, amount, payee, category = "", extra = {}) => ({ id, accountId, date, amount, payee, rawPayee: payee.toUpperCase(), category, tags: [], note: "", ...extra });
  p.transactions.push(
    t("t1", "chk", "2026-09-15", 1950, "Acme Corp Payroll", "income-salary"),
    t("t2", "chk", "2026-09-01", 1950, "Acme Corp Payroll", "income-salary"),
    t("t3", "chk", "2026-09-01", -1500, "Oak Street Apartments", "housing"),
    t("t4", "chk", "2026-09-03", -86.40, "Kroger", "groceries"),
    t("t5", "chk", "2026-09-10", -54.12, "Kroger", "groceries"),
    t("t6", "chk", "2026-09-05", -15.49, "Netflix", ""),
    t("t7", "chk", "2026-09-06", -500, "Online Transfer To Sav", "transfer", { transferId: "x1" }),
    t("t8", "sav", "2026-09-06", 500, "Online Transfer From Chk", "transfer", { transferId: "x1" }),
    t("t9", "chk", "2026-09-14", -640.22, "Chase Credit Crd Autopay", ""),
    t("t10", "visa", "2026-09-15", 640.22, "Payment Thank You", ""),
    t("t11", "visa", "2026-09-02", -42.17, "Amazon Mktpl Amzn", "shopping"),
    t("t12", "visa", "2026-09-03", -42.17, "Amazon Mktpl Amzn", ""),
    t("t13", "chk", "2026-08-15", 1950, "Acme Corp Payroll", "income-salary"),
    t("t14", "chk", "2026-08-01", -1500, "Oak Street Apartments", "housing"),
    t("t15", "chk", "2026-08-27", -48, "Shell Oil", "transport"),
    t("t16", "chk", "2026-08-20", -60, "Kroger", "groceries"),
  );
  return p;
}
