// core/math/shares.js -- whole-number percentages that add up to 100. PURE.
// Rounding each share on its own can total 99 or 101 (FEEDBACK F-009); the largest-remainder
// method rounds everything down, then hands the missing points to the shares that lost the
// most in the rounding. Zero shares stay zero.
export function roundShares(values, total = 100) {
  const sum = values.reduce((s, v) => s + (Number(v) || 0), 0);
  if (!(sum > 0)) return values.map(() => 0);
  const exact = values.map((v) => (Math.max(0, Number(v) || 0) / sum) * total);
  const floors = exact.map((x) => Math.floor(x));
  let left = total - floors.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, frac: x - floors[i] })).filter((o) => exact[o.i] > 0).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) { if (left <= 0) break; floors[o.i] += 1; left--; }
  return floors;
}
