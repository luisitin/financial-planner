"""CSV plumbing only. Independent oracles live beside this file; never import app code.

Blank cells mean omitted, @null means explicit null, @empty-array means [].
Input columns are plan.*, params.*, input.*, options.*, arg.*; expected columns
are expected.<output path>. Rates/probabilities have six places; dollars two.
"""
from pathlib import Path
import csv
import math

MONEY_FIELDS = set('amount balance cash taxable deferred free yearly employerMatch spendingMonthly monthlyAtFRA monthly spending income contributions taxes rmd conversion total totalReal spendingReal incomeReal shortfall totalWithdrawn totalTaxes totalConverted endBalance endBalanceReal endAfterTax endAfterTaxReal firstRmd firstRmdReal deferredNow rmdReal taxesReal totalRmdReal totalTaxReal totalConvertedReal firstYear lowest highest endReal lowestReal fiNumber invested gap savingYearly number standardDeduction extraAllowance tax ordinaryTax qualifiedTax totalTax taxableIncome ordinaryTaxable qualifiedTaxable niit standard senior deduction used limit over catchUp match matchYearly totalYearly roomInBracket incomeBefore bracketTop gainVsWorst taxSpread affordable'.split())
RATE_FIELDS = set('inflation stocksNow stocksRetired returnStocks returnBonds returnCash salaryGrowth taxRate withdrawalRate stocks bonds realReturn progress coverage savingsRate endTaxRate bracketRate effectiveRate factor p returnPct portfolioReturn stockShare gainShare dividendYield fillRate priceLevel'.split())

def formatted(key, value):
    """Serialization precision only; this never derives or changes an oracle formula."""
    if key == 'note': return str(value).rstrip()
    if isinstance(value, bool) or value is None: return cell(value)
    try: number = float(value)
    except (TypeError, ValueError): return value
    if not math.isfinite(number): return cell(number)
    field = key.rsplit('.', 1)[-1]
    if field in RATE_FIELDS or key.endswith('.rates.cash'): return f'{number:.6f}'
    if field in MONEY_FIELDS: return f'{number:.2f}'
    return value

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'retirement'
OUT.mkdir(parents=True, exist_ok=True)

def money(x):
    return f'{x:.2f}'

def rate(x):
    return f'{x:.6f}'

def cell(x):
    if x is None: return '@null'
    if isinstance(x, bool): return 'true' if x else 'false'
    if isinstance(x, float) and not math.isfinite(x):
        return 'Infinity' if x > 0 else '-Infinity' if x < 0 else 'NaN'
    return x

def flatten(value, prefix):
    if isinstance(value, dict):
        return {k: v for name, item in value.items() for k, v in flatten(item, f'{prefix}.{name}').items()}
    if isinstance(value, list):
        if not value: return {prefix: '@empty-array'}
        return {k: v for i, item in enumerate(value) for k, v in flatten(item, f'{prefix}.{i}').items()}
    return {prefix: cell(value)}

def write_page(page, rows):
    # A fixed header per page; case metadata first, inputs next, expected outputs,
    # explicit TODO reason and the provenance/second-check note last.
    keys = set().union(*(r.keys() for r in rows))
    initial = ['case_id', 'rule', 'kind', 'target']
    remaining = keys - set(initial) - {'todo', 'note'}
    columns = initial + sorted(k for k in remaining if not k.startswith('expected.')) + sorted(k for k in remaining if k.startswith('expected.')) + ['todo', 'note']
    path = OUT / f'{page}.csv'
    with path.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=columns, lineterminator='\n')
        w.writeheader()
        for r in rows: w.writerow({k: formatted(k, cell(v)) for k, v in r.items()})
    return path

def case(page, rule, i, target, expected, *, plan=None, params=None, inputs=None, options=None, args=None, note='', todo=''):
    row = {'case_id': f'{page}-{rule}-{i+1:03}', 'rule': rule, 'kind': 'grid' if i < 60 else 'edge' if i < 90 else 'extreme', 'target': target}
    for label, data in [('plan', plan), ('params', params), ('input', inputs), ('options', options), ('arg', args), ('expected', expected)]:
        if data is not None: row.update(flatten(data, label))
    row['note'] = note
    if todo: row['todo'] = todo
    return row
