// opt/fx.mjs -- which qa fixture plans hold the things the six census households lack (bank lines, holdings, policies...)
import fs from "node:fs"; import path from "node:path";
const ROOT = "$SP/opt/app";
for (const f of fs.readdirSync(path.join(ROOT, "qa/fixtures")).filter((x) => x.endsWith(".mjs") && !/fake-dom|setup-personas|retiree-cases|retype/.test(x))) {
  let m; try { m = await import(path.join(ROOT, "qa/fixtures", f)); } catch (e) { console.log(f, "import failed", e.message); continue; }
  for (const [name, fn] of Object.entries(m)) {
    if (typeof fn !== "function") continue;
    let p; try { p = fn("2026-11-12"); } catch { continue; }
    if (!p || typeof p !== "object" || !p.household) continue;
    const n = (x) => (Array.isArray(x) ? x.length : 0);
    console.log(`${f} ${name}`.padEnd(52), `tx ${n(p.transactions)} holdings ${n(p.investments?.holdings)} policies ${n(p.insurance?.policies)} pensions ${n(p.retirement?.pensions)} accounts ${n(p.accounts)} debts ${n(p.debts)} goals ${n(p.goals)} rentals ${n(p.property?.rentals ?? p.rentals)} grants ${n(p.career?.equity?.grants ?? p.equity?.grants)} lots ${n(p.investments?.lots)}`);
  }
}
