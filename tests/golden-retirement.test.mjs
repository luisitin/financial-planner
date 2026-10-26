// Expectations are frozen CSV data produced independently from cited rules.
// NEVER regenerate them from the functions imported here: these are subjects, not oracles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../core/csv.js';
import { project, affordableSpending } from '../core/math/retirement.js';
import * as rmd from '../core/math/rmd.js';
import * as finance from '../core/math/finance.js';
import * as periods from '../core/math/periods.js';
import * as tax from '../core/math/tax.js';
import * as longevity from '../modules/retirement/longevity/compute.js';
import { FEDERAL } from '../modules/taxes/federal/data/federal.js';
import { worstWindow } from '../modules/retirement/withdrawal-strategy/compute.js';

const folder = new URL('./golden/retirement/', import.meta.url);
const pages = ['projection', 'contributions', 'cash-flow', 'withdrawal-strategy', 'withdrawal-order', 'roth-conversions', 'rmd', 'sequence-risk', 'longevity', 'fire'];
const helpers = { project, affordableSpending, worstWindow, ...rmd, ...finance, ...periods, ...tax, ...longevity };

function decode(s) {
  if (s === '@null') return null;
  if (s === '@empty-array') return [];
  if (s === '@empty-object') return {};
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'Infinity') return Infinity;
  if (s === '-Infinity') return -Infinity;
  if (s === 'NaN') return NaN;
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return Number(s);
  return s;
}

function setPath(root, path, value) {
  const parts = path.split('.');
  let at = root;
  parts.forEach((key, i) => {
    if (i === parts.length - 1) at[key] = value;
    else at = at[key] ??= /^\d+$/.test(parts[i + 1]) ? [] : {};
  });
}

function getPath(root, path) {
  return path.split('.').reduce((o, key) => o?.[key], root);
}

function prepare(row) {
  const data = { plan: {}, params: {}, input: {}, options: {}, arg: [] };
  for (const [key, value] of Object.entries(row)) {
    if (value !== '' && /^(plan|params|input|options|arg)\./.test(key)) setPath(data, key, decode(value));
  }
  return data;
}

// Probabilities, rates and price-level factors are stored to six decimals.
// Dollar values allow half a cent; integers, booleans, nulls and text compare exactly.
function compare(actual, expected, path, raw) {
  if (typeof expected === 'number' && Number.isFinite(expected)) {
    assert.equal(typeof actual, 'number', `${path}: expected number, received ${String(actual)}`);
    assert.ok(Number.isFinite(actual), `${path}: received ${actual}`);
    const decimalPlaces = raw.includes('.') ? raw.split('.')[1].length : 0;
    const tolerance = decimalPlaces >= 6 ? 0.00000050001 : decimalPlaces === 0 ? 0 : 0.005000001;
    assert.ok(Math.abs(actual - expected) <= tolerance,
      `${path}: expected ${raw}, got ${actual}; difference ${actual - expected}, tolerance ${tolerance}`);
  } else assert.deepEqual(actual, expected, `${path}: expected ${raw}, got ${String(actual)}`);
}

for (const page of pages) {
  const path = new URL(`${page}.csv`, folder);
  // During development use GOLDEN_PAGES; normal npm test always requires all ten files.
  if (process.env.GOLDEN_PAGES && !process.env.GOLDEN_PAGES.split(',').includes(page)) continue;
  const csv = parseCsv(readFileSync(path, 'utf8'));
  const rows = csv.rows.map(values => Object.fromEntries(csv.headers.map((h, i) => [h, values[i]])));
  const compute = (await import(`../modules/retirement/${page}/compute.js`)).compute;

  test(`golden retirement / ${page}: fixture integrity and rule coverage`, () => {
    assert.equal(csv.skipped, 0);
    assert.equal(csv.headers[0], 'case_id');
    assert.equal(csv.headers.at(-1), 'note');
    assert.equal(new Set(csv.headers).size, csv.headers.length);
    assert.equal(new Set(rows.map(r => r.case_id)).size, rows.length, 'case IDs must be unique');
    const counts = new Map();
    for (const row of rows) {
      assert.ok(row.rule && row.note && row.target, `${row.case_id}: missing provenance/target/rule`);
      assert.ok(['grid','edge','extreme'].includes(row.kind));
      assert.ok(Object.keys(row).some(k => k.startsWith('expected.') && row[k] !== ''), `${row.case_id}: no assertions`);
      const c = counts.get(row.rule) ?? { grid: 0, edge: 0, extreme: 0 };
      c[row.kind]++; counts.set(row.rule, c);
    }
    for (const [rule, countsByKind] of counts) for (const [kind, minimum] of Object.entries({ grid: 60, edge: 30, extreme: 10 })) {
      assert.ok(countsByKind[kind] >= minimum, `${page}/${rule}: ${kind} needs ${minimum}, got ${countsByKind[kind]}`);
    }
  });

  for (const row of rows) {
    test(`golden retirement / ${page} / ${row.case_id}`, row.todo ? { todo: row.todo } : {}, () => {
      const data = prepare(row);
      let actual;
      if (row.target === 'compute') actual = compute(data.plan, data.params);
      else if (row.target === 'project') {
        if (data.input.tax?.mode === 'brackets') data.input.tax.paramsFor = year => tax.paramsFor(FEDERAL, year, { inflation: data.params.inflation ?? 0 });
        actual = project(data.input, data.options);
      }
      else if (row.target === 'affordableSpending') actual = { value: affordableSpending(data.input, data.options, data.arg[0]) };
      else {
        const helper = helpers[row.target];
        assert.equal(typeof helper, 'function', `Unknown target ${row.target}`);
        if (row.target === 'paramsFor') {
          actual = tax.paramsFor(FEDERAL, data.arg[0], data.arg[1]);
        } else {
          // Published tax tables are passed only to the implementation under test.
          // Expected tax tables/numbers came from primary sources in the worker scripts.
          const slot = { taxOnOrdinary: 2, taxOnQualified: 3, taxableSocialSecurity: 4, standardDeduction: 1, federalTax: 1, bracketTop: 2, roomUnder: 1 }[row.target];
          if (slot !== undefined && data.params.taxYear !== undefined) data.arg[slot] = tax.paramsFor(FEDERAL, data.params.taxYear, { inflation: data.params.inflation ?? 0 });
          const value = helper(...data.arg);
          actual = value !== null && typeof value === 'object' ? value : { value };
        }
      }
      for (const [key, raw] of Object.entries(row)) {
        if (key.startsWith('expected.') && raw !== '') compare(getPath(actual, key.slice(9)), decode(raw), key.slice(9), raw);
      }
    });
  }
}
