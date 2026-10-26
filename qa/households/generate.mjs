// qa/households/generate.mjs -- write one .md case per (household type x pack x variation),
// plus a base case per type, INDEX.md and a count. Re-run after editing lib/catalog.mjs.
//   node qa/households/generate.mjs            (writes into qa/households/<type>/<pack>/)
// Every case carries: the people, the money, the twist, what to check, the tester's own
// expected numbers (lib/expect.mjs, no app code) and the plan JSON to load in the sandbox.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS, TODAY } from "./lib/catalog.mjs";
import { expectAll, CATEGORY_ESSENTIAL } from "./lib/expect.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const money = (n) => n === null || n === undefined || Number.isNaN(n) ? "-" : (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
const num1 = (n) => n === null || n === undefined ? "-" : (Math.round(n * 10) / 10).toString();
const pct = (x) => x === null || x === undefined ? "-" : Math.round(x * 100) + "%";
const rate = (x) => x === null || x === undefined ? "-" : (Math.round(x * 1000) / 10) + "%";
const PER = { weekly: "every week", biweekly: "every two weeks", semimonthly: "twice a month", monthly: "every month", quarterly: "every three months", annual: "once a year", once: "one time only" };
const ROLE = { self: "Me", partner: "Partner", dependent: "Dependent" };

// Keep what the last run said: results/<id>.json survives a regenerate, the .md does not.
function lastStatus(id) {
  const f = path.join(HERE, "results", id + ".json");
  if (!fs.existsSync(f)) return "untested";
  try { const r = JSON.parse(fs.readFileSync(f, "utf8")); const day = fs.statSync(f).mtime.toISOString().slice(0, 10); return r.status === "pass" ? `pass ${day}` : `fail (results/${id}.json)`; } catch { return "untested"; }
}
function renderCase({ id, archetype, pack, variation, plan, twist, check, expected: e }) {
  const nameOf = (pid) => plan.household.people.find((p) => p.id === pid)?.name ?? (pid ? "Someone" : "Household");
  const L = [];
  L.push(`# ${id}  ${archetype.title} · ${variation.title}`);
  L.push(`- type: ${archetype.id}   pack: ${pack}   case: ${variation.slug}`);
  L.push(`- status: ${lastStatus(id)}   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)`);
  L.push(`- today: ${TODAY}   run: \`node qa/households/run.mjs ${path.posix.join(archetype.id, pack, id + "-" + variation.slug + ".md")}\``);
  L.push(``);
  L.push(`**Household.** ${archetype.who}`);
  L.push(``);
  L.push(`**The twist.** ${twist}`);
  L.push(``);
  L.push(`**Why it matters.** ${variation.why}`);
  L.push(``);
  L.push(`## People (${e.people.count}: ${e.people.adults} adults, ${e.people.dependents} dependents)`);
  L.push(`| name | role | born | age | retires at | plan to | retired | years to retire | years left |`);
  L.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const p of e.people.people) L.push(`| ${p.name} | ${ROLE[p.role] ?? p.role} | ${plan.household.people.find((x) => x.name === p.name)?.birthDate || "-"} | ${p.age ?? "-"} | ${p.retirementAge ?? "-"} | ${p.planEndAge} | ${p.retired === null ? "-" : p.retired ? "yes" : "no"} | ${p.yearsToRetirement ?? "-"} | ${p.yearsLeft ?? "-"} |`);
  L.push(`- filing: ${plan.household.filingStatus}   state: ${plan.household.state || "-"}   plan horizon: ${e.people.horizonYears === null ? "none (no dated adult)" : e.people.horizonYears + " years"}`);
  if (e.people.warnings.length) L.push(`- expected People warnings: ${e.people.warnings.join("; ")}`);
  L.push(``);
  L.push(`## Accounts (${plan.accounts.length})`);
  if (plan.accounts.length) { L.push(`| name | type | balance | as of | owner |`); L.push(`|---|---|---|---|---|`); for (const a of plan.accounts) L.push(`| ${a.name} | ${a.type} | ${money(a.balance)} | ${a.asOf || "(none)"} | ${a.ownerId || "joint"} |`); } else L.push(`(none)`);
  L.push(``);
  L.push(`## Income (${plan.income.length})`);
  if (plan.income.length) { L.push(`| name | type | who | amount | how often | raise | taxed | starts | ends |`); L.push(`|---|---|---|---|---|---|---|---|---|`); for (const x of plan.income) L.push(`| ${x.name} | ${x.type} | ${nameOf(x.personId)} | ${money(x.amount)} | ${PER[x.period] ?? x.period} | ${x.growth ? pct(x.growth) : "-"} | ${x.taxable === false ? "no" : "yes"} | ${x.startDate || "-"} | ${x.endDate || "-"} |`); } else L.push(`(none)`);
  L.push(``);
  L.push(`## Expenses (${plan.expenses.length})`);
  if (plan.expenses.length) { L.push(`| name | category | amount | how often | must-pay | inflates | starts | ends |`); L.push(`|---|---|---|---|---|---|---|---|`); for (const x of plan.expenses) L.push(`| ${x.name} | ${x.category} | ${money(x.amount)} | ${PER[x.period] ?? x.period} | ${x.essential === undefined ? ((CATEGORY_ESSENTIAL[x.category] ?? false) ? "yes (default)" : "no (default)") : x.essential ? "yes" : "no"} | ${x.inflates === false ? "no" : "yes"} | ${x.startDate || "-"} | ${x.endDate || "-"} |`); } else L.push(`(none)`);
  L.push(``);
  L.push(`## Debts (${plan.debts.length} with details)`);
  if (plan.debts.length) { L.push(`| account | rate | minimum | extra | note |`); L.push(`|---|---|---|---|---|`); for (const d of plan.debts) L.push(`| ${plan.accounts.find((a) => a.id === d.accountId)?.name ?? "(missing account " + d.accountId + ")"} | ${rate(d.rate)} | ${money(d.minPayment)} | ${money(d.extra)} | ${d.termMonths ? `${d.termMonths} months from ${d.startDate}` : "-"} |`); } else L.push(`(none)`);
  L.push(``);
  L.push(`## Goals (${plan.goals.length})`);
  if (plan.goals.length) { L.push(`| name | amount | by | priority | set aside | saved in | per month | rate | inflates |`); L.push(`|---|---|---|---|---|---|---|---|---|`); for (const g of plan.goals) L.push(`| ${g.name} | ${money(g.target)} | ${g.targetDate || "no date"} | ${g.priority} | ${money(g.saved)} | ${(g.fundedBy ?? []).map((id) => plan.accounts.find((a) => a.id === id)?.name ?? "(missing " + id + ")").join(", ") || "-"} | ${money(g.monthly)} | ${g.rate === null || g.rate === undefined ? "plan default" : rate(g.rate)} | ${g.inflates ? "yes" : "no"} |`); } else L.push(`(none)`);
  if (Object.keys(plan.assumptions ?? {}).length) L.push(`\n- assumptions overridden: ${JSON.stringify(plan.assumptions)}`);
  L.push(``);
  L.push(`## Expected (tester's own math, today ${TODAY})`);
  const me = e.people.me;
  L.push(`- **People**: ${e.people.count} (${e.people.adults} adults, ${e.people.dependents} dependents)${me && me.yearsToRetirement !== null ? `; ${me.retired ? `${me.name} is retired` : `${me.yearsToRetirement} years until ${me.name} retires (${me.retirementYear})`}` : ""}${e.people.horizonYears !== null ? `; plan must last ${e.people.horizonYears} years` : ""}`);
  L.push(`- **Income**: ${money(e.income.monthly)}/mo, ${money(e.income.yearly)}/yr, next year ${money(e.income.nextYear)}${e.income.oneTime ? `, one-time ${money(e.income.oneTime)}` : ""}; by person: ${Object.entries(e.income.byPerson).map(([k, v]) => `${nameOf(k === "Household" ? "" : k)} ${money(v)}/mo (${e.income.monthly ? Math.round(100 * v / e.income.monthly) : 0}%)`).join(", ") || "-"}${e.income.warnings.length ? `; warnings: ${e.income.warnings.join("; ")}` : ""}`);
  L.push(`- **Expenses**: ${money(e.expenses.monthly)}/mo, ${money(e.expenses.yearly)}/yr; must-pay ${money(e.expenses.essentialMonthly)}, nice-to-have ${money(e.expenses.optionalMonthly)}${e.expenses.oneTime ? `, one-time ${money(e.expenses.oneTime)}` : ""}; left over ${e.expenses.leftOver === null ? "- (no income entered)" : `${money(e.expenses.leftOver)} (${e.expenses.savingsRatePct ?? "-"}% of income)`}${e.expenses.warnings.length ? `; warnings: ${e.expenses.warnings.join("; ")}` : ""}`);
  L.push(`- **Net worth**: ${money(e.netWorth.netWorth)} = own ${money(e.netWorth.assets)} - owe ${money(e.netWorth.liabilities)}; liquid ${money(e.netWorth.liquid)}; cash ${money(e.netWorth.cash)}; invested ${money(e.netWorth.investable)} (${money(e.netWorth.buckets.deferred)} pre-tax, ${money(e.netWorth.buckets.free)} tax-free, ${money(e.netWorth.buckets.taxable)} taxable)`);
  L.push(`- **Emergency fund**: usable today ${money(e.liquidity.now)}, within a week ${money(e.liquidity.week)}, locked up ${money(e.liquidity.later)}; ${e.liquidity.runwayMonths === null ? "months: - (no must-pay expenses)" : `${num1(e.liquidity.runwayMonths)} months of must-pay (${num1(e.liquidity.fullRunwayMonths)} of all spending)`}; target ${money(e.liquidity.target)} (${e.liquidity.targetMonths} months), gap ${money(e.liquidity.gap)}, status ${e.liquidity.status}`);
  L.push(`- **Debts**: ${e.debts.count} debts, owed ${money(e.debts.owed)}, paying ${money(e.debts.payments)}/mo (required ${money(e.debts.minimums)}), interest ${money(e.debts.interestMonthly)}/mo, avg rate ${e.debts.avgRate === null ? "-" : (Math.round(e.debts.avgRate * 1000) / 10) + "%"}, DTI ${e.debts.dti === null ? "-" : Math.round(e.debts.dti * 100) + "%"}, ${e.debts.count - e.debts.withDetail} without details`);
  for (const r of e.debts.rows) L.push(`  - ${r.name}: owed ${money(r.owed)}${r.rate === null ? " (needs details)" : `, ${Math.round(r.rate * 1000) / 10}%, ${money(r.payment)}/mo, ${r.neverPaysOff ? "never pays off" : r.months === null ? "no payoff (no payment)" : `${r.months} months -> ${r.payoffDate}, ${money(r.totalInterest)} interest to come`}${r.expensive ? ", expensive" : ""}`}`);
  L.push(`- **Goals**: ${e.goals.count} goals, ${e.goals.done} reached; saved ${money(e.goals.totalFunded)} of ${money(e.goals.totalTarget)}; needed ${money(e.goals.neededMonthly)}/mo vs ${money(e.goals.contributing)}/mo going in${e.goals.warnings.length ? `; warnings: ${e.goals.warnings.join("; ")}` : ""}`);
  for (const g of e.goals.goals) L.push(`  - ${g.name}: ${g.status}; ${money(g.funded)} of ${money(g.targetThen)}${g.monthsLeft !== null ? `, ${g.monthsLeft} months left` : ""}${g.neededMonthly !== null ? `, needs ${money(g.neededMonthly)}/mo` : ""}${g.monthly ? `, putting in ${money(g.monthly)}/mo` : ""}${g.status !== "done" && g.status !== "no amount" && g.monthsLeft !== null ? ` (rate ${Math.round(g.rate * 1000) / 10}%)` : ""}`);
  if (e.staleBalances.length) L.push(`- **Stale balances (>90 days or no date)**: ${e.staleBalances.join(", ")}`);
  L.push(``);
  L.push(`## Also check`);
  for (const c of check) L.push(`- [ ] ${c}`);
  L.push(`- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above`);
  L.push(``);
  L.push(`## Plan JSON`);
  L.push("```json");
  L.push(JSON.stringify(plan));
  L.push("```");
  L.push(``);
  return L.join("\n");
}

function main() {
  let n = 0;
  const index = [];
  const rmDirs = fs.readdirSync(HERE).filter((d) => /^\d\d-/.test(d));
  for (const d of rmDirs) fs.rmSync(path.join(HERE, d), { recursive: true, force: true });
  for (const archetype of ARCHETYPES) {
    const packs = { base: [{ slug: "base", title: "the household as built (no twist)", why: "The starting point every other case in this folder is a variation of.", apply: () => ({ twist: "None: the base household.", check: ["every figure in Expected matches the pages"] }) }], ...COMMON_PACKS, special: SPECIAL_PACKS[archetype.id] ?? [] };
    for (const [pack, variations] of Object.entries(packs)) {
      const dir = path.join(HERE, archetype.id, pack);
      fs.mkdirSync(dir, { recursive: true });
      for (const variation of variations) {
        n++;
        const id = `H-${String(n).padStart(4, "0")}`;
        const plan = structuredClone(archetype.build());
        let out;
        try { out = variation.apply(plan); } catch (err) { throw new Error(`${archetype.id}/${pack}/${variation.slug}: ${err.message}`); }
        const expected = expectAll(plan, TODAY);
        const file = `${id}-${variation.slug}.md`;
        fs.writeFileSync(path.join(dir, file), renderCase({ id, archetype, pack, variation, plan, twist: out.twist, check: out.check ?? [], expected }), "utf8");
        index.push(`| ${id} | ${archetype.id} | ${pack} | [${variation.title}](${path.posix.join(archetype.id, pack, file)}) | ${lastStatus(id)} |`);
      }
    }
  }
  const idx = [`# Household test cases: index (${n} cases, generated ${new Date().toISOString().slice(0, 10)})`, ``, `Generated by \`node qa/households/generate.mjs\` from \`lib/catalog.mjs\`. Status here is a snapshot; the line in each case file is the truth (run.mjs --mark updates both).`, ``, `| id | household type | pack | case | status |`, `|---|---|---|---|---|`, ...index, ``];
  fs.writeFileSync(path.join(HERE, "INDEX.md"), idx.join("\n"), "utf8");
  console.log(`${n} cases written under qa/households/ (${ARCHETYPES.length} household types)`);
}
main();
