// modules/retirement/charts.js -- small inline-SVG charts for the retirement pages (no library).
// lineChart: one or more series over years; bandChart: a shaded band (10th to 90th percentile)
// with the median line. Colours come from the page's CSS variables so dark mode works.
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...children) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v); for (const c of children) e.append(c); return e; };
const fmtShort = (v) => { const a = Math.abs(v); return a >= 1e6 ? `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)); };
// Drawn at phone width so the 11 px labels stay 11 px on a 390 px screen; on desktop the svg
// stops growing at 560 px (design log 2026-09-16, pass 4).
const W = 360, padL = 40, padR = 8, padT = 12, padB = 24;

function scales(years, values, height) {
  const all = values.filter((v) => Number.isFinite(v));
  let lo = Math.min(0, ...all), hi = Math.max(1, ...all);
  if (hi === lo) hi = lo + 1;
  return { lo, hi, x: (i) => padL + (i / Math.max(1, years.length - 1)) * (W - padL - padR), y: (v) => padT + (1 - (v - lo) / (hi - lo)) * (height - padT - padB) };
}
function frame(years, sc, height, marks, label) {
  const svg = el("svg", { viewBox: `0 0 ${W} ${height}`, width: "100%", role: "img", "aria-label": label || "chart", style: "display:block; width:100%; max-width:560px; height:auto; margin:0 auto; font: 11px system-ui, sans-serif" });
  const seen = new Set();
  for (let k = 0; k <= 4; k++) { const v = sc.lo + (sc.hi - sc.lo) * (k / 4); const t = fmtShort(v); svg.append(el("line", { x1: padL, x2: W - padR, y1: sc.y(v), y2: sc.y(v), stroke: "var(--line)", "stroke-width": 1 })); if (!seen.has(t)) { seen.add(t); svg.append(el("text", { x: padL - 6, y: sc.y(v) + 4, "text-anchor": "end", fill: "var(--muted)" }, t)); } }
  if (sc.lo < 0) svg.append(el("line", { x1: padL, x2: W - padR, y1: sc.y(0), y2: sc.y(0), stroke: "var(--bad)", "stroke-width": 1, "stroke-dasharray": "4 3" }));
  const step = Math.max(1, Math.round(years.length / 5));
  const last = years.length - 1;
  years.forEach((yr, i) => { if ((i % step === 0 && sc.x(i) < W - padR - 24) || i === last) svg.append(el("text", { x: sc.x(i), y: height - 8, "text-anchor": i === last ? "end" : i === 0 ? "start" : "middle", fill: "var(--muted)" }, String(yr))); });
  for (const m of marks) { const i = years.indexOf(m.year); if (i < 0) continue; svg.append(el("line", { x1: sc.x(i), x2: sc.x(i), y1: padT, y2: height - padB, stroke: "var(--accent)", "stroke-width": 1, "stroke-dasharray": "3 3" })); svg.append(el("text", { x: sc.x(i) + 4, y: padT + 10, fill: "var(--accent)" }, m.label)); }
  return svg;
}
const line = (sc, values, s) => el("polyline", { points: values.map((v, i) => Number.isFinite(v) ? `${sc.x(i).toFixed(1)},${sc.y(v).toFixed(1)}` : null).filter(Boolean).join(" "), fill: "none", stroke: s.color ?? "var(--accent)", "stroke-width": s.width ?? 2, "stroke-linejoin": "round", "stroke-dasharray": s.dash ?? null });

/** lineChart({ years, series: [{ values, color?, width?, dash? }], marks?: [{ year, label }], height = 220, label, log = false }) -> <svg>; log draws a log scale (values must be positive), ticks still labelled in plain money */
export function lineChart({ years, series, marks = [], height = 220, label = "", log = false }) {
  if (!log) {
    const sc = scales(years, series.flatMap((s) => s.values), height);
    const svg = frame(years, sc, height, marks, label);
    for (const s of series) svg.append(line(sc, s.values, s));
    return svg;
  }
  const tf = (v) => Number.isFinite(v) && v > 0 ? Math.log10(v) : NaN;
  const logSeries = series.map((s) => ({ ...s, values: s.values.map(tf) }));
  const all = logSeries.flatMap((s) => s.values).filter(Number.isFinite);
  const lo = Math.floor(Math.min(...all)), hi = Math.ceil(Math.max(...all));
  const sc = { lo, hi, x: (i) => padL + (i / Math.max(1, years.length - 1)) * (W - padL - padR), y: (v) => padT + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * (height - padT - padB) };
  const svg = el("svg", { viewBox: `0 0 ${W} ${height}`, width: "100%", role: "img", "aria-label": label || "chart", style: "display:block; width:100%; max-width:560px; height:auto; margin:0 auto; font: 11px system-ui, sans-serif" });
  for (let k = lo; k <= hi; k++) { svg.append(el("line", { x1: padL, x2: W - padR, y1: sc.y(k), y2: sc.y(k), stroke: "var(--line)", "stroke-width": 1 })); svg.append(el("text", { x: padL - 6, y: sc.y(k) + 4, "text-anchor": "end", fill: "var(--muted)" }, fmtShort(Math.pow(10, k)))); }
  const step = Math.max(1, Math.round(years.length / 5));
  const last = years.length - 1;
  years.forEach((yr, i) => { if ((i % step === 0 && sc.x(i) < W - padR - 24) || i === last) svg.append(el("text", { x: sc.x(i), y: height - 8, "text-anchor": i === last ? "end" : i === 0 ? "start" : "middle", fill: "var(--muted)" }, String(yr))); });
  for (const m of marks) { const i = years.indexOf(m.year); if (i < 0) continue; svg.append(el("line", { x1: sc.x(i), x2: sc.x(i), y1: padT, y2: height - padB, stroke: "var(--accent)", "stroke-width": 1, "stroke-dasharray": "3 3" })); svg.append(el("text", { x: sc.x(i) + 4, y: padT + 10, fill: "var(--accent)" }, m.label)); }
  for (const s of logSeries) svg.append(line(sc, s.values, s));
  return svg;
}
/** bandChart({ years, low, high, mid, marks?, height, label }) -> <svg>: the band between low and high, the mid line on top. */
export function bandChart({ years, low, high, mid, marks = [], height = 220, label = "" }) {
  const sc = scales(years, [...low, ...high, ...mid], height);
  const svg = frame(years, sc, height, marks, label);
  const up = high.map((v, i) => `${sc.x(i).toFixed(1)},${sc.y(v).toFixed(1)}`), down = low.map((v, i) => `${sc.x(i).toFixed(1)},${sc.y(v).toFixed(1)}`).reverse();
  svg.append(el("polygon", { points: [...up, ...down].join(" "), fill: "var(--accent)", opacity: 0.15 }));
  svg.append(line(sc, mid, { width: 2 }));
  return svg;
}
