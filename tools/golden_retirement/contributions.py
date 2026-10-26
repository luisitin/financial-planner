"""Independent contribution answer key: Decimal arithmetic, statutory tables, no app imports.

Sources and model assumptions are enumerated in the page brief.  Every tenth case
is independently checked with rational arithmetic, a cap lookup, or a conservation
identity; the check is enforced before writing the CSV.
"""
from decimal import Decimal
from fractions import Fraction
from collections import Counter
from pathlib import Path
from datetime import date, timedelta
from functools import lru_cache
from common import case, write_page

D = Decimal
PAGE = 'contributions'
ROWS = []
PERIODS = {'weekly': 52, 'biweekly': 26, 'semimonthly': 24, 'monthly': 12,
           'quarterly': 4, 'annual': 1, 'once': 0, 'unknown': 12}
LABELS = {'weekly': 'Every week', 'biweekly': 'Every two weeks',
          'semimonthly': 'Twice a month', 'monthly': 'Every month',
          'quarterly': 'Every three months', 'annual': 'Once a year',
          'once': 'One time only', 'unknown': 'Every month'}
# IRS Notice 2024-80 (2025) and Notice 2025-67 (2026), elective/IRA limits.
# IRS Rev. Proc. 2024-25 / 2025-19: self-only HSA caps. Pub.969: age-55 $1,000.
BASE = {2025: {'401k': 23500, 'ira': 7000, 'hsa': 4300},
        2026: {'401k': 24500, 'ira': 7500, 'hsa': 4400}}
CATCH = {2025: {'401k': 7500, 'ira': 1000, 'hsa': 1000},
         2026: {'401k': 8000, 'ira': 1100, 'hsa': 1000}}
SOURCE = {'401k': 'IRS Notices 2024-80/2025-67, sections 402(g),414(v)',
          'ira': 'IRS Notices 2024-80/2025-67, section 219; traditional+Roth combined',
          'hsa': 'IRS Rev.Procs.2024-25/2025-19 and Publication969, self-only + age55 catch-up'}


def m(x):
    return f'{D(x):.2f}'


def cap(kind, year, age):
    """Statutory base plus appropriate additional contribution."""
    y = 2025 if year == 2025 else 2026
    base = D(BASE[y][kind])
    extra = D(0)
    if age is not None and age >= (55 if kind == 'hsa' else 50):
        extra = D(11250) if kind == '401k' and 60 <= age <= 63 else D(CATCH[y][kind])
    return base + extra, extra


def second_cap(kind, year, age):
    """Independent direct total-cap lookup, rather than base+catch-up arithmetic."""
    y = 2025 if year == 2025 else 2026
    if kind == '401k':
        totals = (23500, 31000, 34750) if y == 2025 else (24500, 32500, 35750)
        return totals[0 if age is None or age < 50 else 2 if age in (60, 61, 62, 63) else 1]
    if kind == 'ira':
        return (7000 if y == 2025 else 7500) if age is None or age < 50 else (8000 if y == 2025 else 8600)
    return (4300 if y == 2025 else 4400) if age is None or age < 55 else (5300 if y == 2025 else 5400)


def person(age, year, ident='a', role='self', birthday='12-31'):
    return {'id': ident, 'name': 'Example ' + ident.upper(), 'role': role,
            'birthDate': f'{year-age:04}-{birthday}'}


def plan(people, entries, accounts=None):
    return {'household': {'people': people},
            'accounts': accounts if accounts is not None else [{'id': 'x', 'type': '401k', 'name': 'Example retirement account'}],
            'retirement': {'contributions': entries}}


def entry(amount, period='annual', employer='0', who='a', account='x'):
    return {'id': 'entry-' + account + who, 'accountId': account, 'personId': who,
            'amount': m(amount), 'period': period, 'employerMatch': m(employer)}


@lru_cache(None)
def amount_at(i):
    if i < 60:
        value = D((i + 1) * (37 if i % 2 else 271)) / D(10)
    elif i < 90:
        value = D(['0', '0.01', '-0.01', '-10', '1', '100', '4300', '4400',
                   '7000', '7500', '23500', '24500', '32500', '35750', '999.99',
                   '4299.99','4300.01','4399.99','4400.01','6999.99','7000.01',
                   '7499.99','7500.01','23499.99','23500.01','24499.99','24500.01',
                   '32499.99','32500.01','35750.01'][i-60])
    else:
        value = D(['0.01', '-0.01', '1000000', '1000000000', '-1000000', '9999999999.99',
                   '0.02', '123456789.01', '-123456789.01', '987654321.98'][i-90])
    previous = {amount_at(j) for j in range(i)}
    while value in previous:
        value += D('.01') if value>=0 else D('-.01')
    return value


def add(rule, i, expected, note, *, check, **kwargs):
    if (i + 1) % 10 == 0:
        evidence = check()
        assert isinstance(evidence, str) and evidence, (rule, i)
        note += ' | SECOND CHECK: ' + evidence
    ROWS.append(case(PAGE, rule, i, kwargs.pop('target', 'compute'), expected, note=note, **kwargs))


def eq(actual, expected):
    assert actual == expected, (actual, expected)


# Each supported annualization convention gets its own 100-row grid.
for period, multiplier in PERIODS.items():
    for i in range(100):
        a = amount_at(i)
        value = a * multiplier
        def check(a=a, multiplier=multiplier, value=value):
            rational_sum = sum((Fraction(str(a)) for _ in range(multiplier)), Fraction())
            eq(rational_sum, Fraction(value))
            return f'repeated rational addition of {m(a)} for {multiplier} occurrences = {m(value)}'
        add('period-' + period, i, {'value': m(value)},
            f'Invented amount; README annualization convention: {m(a)} x {multiplier} = {m(value)}; unknown defaults monthly; once is excluded from annual recurring totals.',
            target='perYear', args={'0': m(a), '1': period}, check=check)


# Own money, employer money, total; matches are already annual and are never annualized.
for i in range(100):
    a = amount_at(i)
    b = D(i+1) / 100
    period = list(PERIODS)[i % 8]
    factor = PERIODS[period]
    employer = D((i % 7) * 53)
    own = a * factor + b * 12
    matches = employer + 17
    total = own + matches
    expected = {'yearly': m(own), 'matchYearly': m(matches), 'totalYearly': m(total),
                'items': [{'yearly': m(a*factor), 'matchYearly': m(employer),
                           'totalYearly': m(a*factor+employer), 'periodLabel': LABELS[period]},
                          {'yearly': m(b*12), 'matchYearly': '17.00', 'totalYearly': m(b*12+17)}]}
    p = plan([person(40, 2026)], [entry(a,period,employer),entry(b,'monthly',17,account='y')],
             [{'id':'x','type':'401k'},{'id':'y','type':'roth'}])
    def check():
        combined = sum([Fraction(a)*factor + Fraction(employer), Fraction(b)*12 + 17])
        eq(combined, Fraction(total)); eq(Fraction(total)-Fraction(matches),Fraction(own))
        return f'account totals summed as rational numbers = {m(total)}; less employer {m(matches)} = own {m(own)}'
    add('own-match-total',i,expected,f'README: recurring own sum {m(own)} + annual employer {m(matches)} = {m(total)}; invented amounts.',
        plan=p,params={'today':'2026-01-01'},check=check)


# Per-person grouping is tested independently of the household's combined amount.
for i in range(100):
    a = amount_at(i); b = D((i+1)*13); c=D((i%5)*17)
    p=plan([person(40,2026),person(55,2026,'b','partner')],
           [entry(a,'monthly',11),entry(b,'quarterly',7,'b','y'),entry(c,'annual',3,'','z')],
           [{'id':'x','type':'401k'},{'id':'y','type':'ira'},{'id':'z','type':'brokerage'}])
    own=a*12+b*4+c
    expected={'yearly':m(own),'matchYearly':'21.00','totalYearly':m(own+21),
              'byPerson':[{'personId':'a','yearly':m(a*12),'match':'11.00'},
                          {'personId':'b','yearly':m(b*4),'match':'7.00'}]}
    def check():
        eq(Fraction(own)-Fraction(a)*12-Fraction(b)*4,Fraction(c))
        return f'household own {m(own)} minus A {m(a*12)} minus B {m(b*4)} = unassigned {m(c)}; employer 11+7+3=21'
    add('person-aggregation',i,expected,'Invented two-adult household; unassigned contribution remains in household totals, not assigned to either person.',plan=p,params={'today':'2026-12-31'},check=check)


def make_limit_cases(rule, kind, ages):
    for i in range(100):
        year = 2025 if i % 3 == 0 else 2026 if i % 3 == 1 else 2056
        age = ages[i % len(ages)]
        limit, extra = cap(kind,year,age)
        if i < 60:
            used = D(i+1)*limit/100
        elif i < 90:
            used = [D(0),D('-0.01'),limit-D('.01'),limit,limit+D('.01'),limit+1][i%6]
        else:
            used = amount_at(i)
        # IRA uses two accounts so no individual-account cap can accidentally pass.
        first = (used / 2).quantize(D('.01')) if kind == 'ira' else used
        second = used-first
        entries=[entry(first)]
        accounts=[{'id':'x','type':kind}]
        if kind=='ira':
            entries.append(entry(second,account='y'));accounts.append({'id':'y','type':'roth'})
        expected={'yearly':m(used),'byPerson':[{'age':age,'limits': [] if used==0 else [{'kind':kind,'limit':m(limit),'used':m(used),'over':m(max(D(0),used-limit)),'catchUp':m(extra)}]}],
                  'warnings':{'length':int(used>limit)},'limitsYear':2025 if year==2025 else 2026}
        household=[person(age,year)]
        if i%2:
            household.append(person(35,year,'b','partner'))
            expected['byPerson'].append({'personId':'b','yearly':'0.00','limits':[]})
        def check():
            direct = second_cap(kind,year,age); eq(D(direct),limit)
            eq(Fraction(first)+Fraction(second),Fraction(used))
            excess = used-D(direct) if used>D(direct) else D(0)
            eq(excess,max(D(0),used-limit))
            return f'direct total-cap table gives {direct}; account sum {m(first)}+{m(second)}={m(used)}; excess {m(excess)}'
        add(rule,i,expected,f'{SOURCE[kind]}; age reached={age}; statutory cap {m(limit-extra)}+{m(extra)}={m(limit)}; invented own {m(used)}. Future year freezes latest known 2026 table (model assumption).',
            plan=plan(household,entries,accounts),params={'today':(date(year,1,1)+timedelta(days=i)).isoformat()},check=check)


make_limit_cases('ira-combined-limit','ira',[25,49,50,51,59,60,63,64,75,90])
make_limit_cases('401k-base','401k',[18,25,30,40,48,49])
make_limit_cases('401k-catchup','401k',[50,51,55,59,64,65,75,90])
make_limit_cases('401k-super-catchup','401k',[59,60,61,62,63,64])
make_limit_cases('hsa-self-catchup','hsa',[30,49,50,54,55,56,60,75])


# Statutory disagreement: employee and employer HSA dollars share one cap.
for i in range(100):
    year=2025 if i%2 else 2026
    age=[40,54,55,60][i%4]
    limit,extra=cap('hsa',year,age)
    employer=D((i+1)*10) if i<60 else D(['0.01','100','1000','10000','1','500'][i%6])+D((i-60)//6)/100 if i<90 else amount_at(i).copy_abs()
    own=limit if i%3==0 else limit-employer if i%3==1 else limit-D('.01')
    combined=own+employer
    expected={'yearly':m(own),'matchYearly':m(employer),'totalYearly':m(combined),
              'byPerson':[{'limits':[{'kind':'hsa','limit':m(limit),'used':m(combined),'over':m(max(D(0),combined-limit)),'catchUp':m(extra)}]}],
              'warnings':{'length':int(combined>limit)}}
    def check():
        remaining=limit-employer; excess=max(D(0),own-remaining)
        eq(excess,max(D(0),combined-limit))
        return f'allowed employee amount {m(limit)}-{m(employer)}={m(remaining)}; employee excess max(0,{m(own)}-{m(remaining)})={m(excess)}'
    add('hsa-employer-cap',i,expected,
        f'IRS Pub969 Employer contributions: employer dollars reduce what the individual can contribute; {m(own)}+{m(employer)}={m(combined)} against {m(limit)}. Model assumes full-year self-only eligibility.',
        plan=plan([person(age,year)],[entry(own,employer=employer)],[{'id':'x','type':'hsa'}]),params={'today':(date(year,1,1)+timedelta(days=i)).isoformat()},check=check,
        todo='HSA cap omits employer money: IRS Publication 969 requires employee plus employer contributions to share the annual limit; README blanket exclusion is incorrect for HSA.')


# Age is attained by December 31, independent of the execution month or leap-day birth.
for i in range(100):
    year=[2025,2026,2056][i%3]
    age=[49,50,54,55,59,60,63,64][i%8]
    birthday='02-29' if (year-age)%4==0 else '12-31'
    today=f'{year}-'+['01-01','02-28','03-01','12-31'][i%4]
    limit,extra=cap('401k',year,age)
    expected={'byPerson':[{'age':age,'limits':[{'limit':m(limit),'catchUp':m(extra),'used':m(i+1),'over':'0.00'}]}]}
    def check():
        birth_year=year-age; counted=sum(1 for _ in range(birth_year+1,year+1))
        eq(counted,age);eq(D(second_cap('401k',year,age)),limit)
        return f'count annual anniversaries from {birth_year+1} through {year} = {counted}; birthday within current year does not alter tax-year age; direct cap {m(limit)}'
    add('age-reached',i,expected,'IRS Notices catch-up eligibility uses age attained in taxable year; README age reached rule; calendar includes year start/end and leap-day births.',
        plan=plan([person(age,year,birthday=birthday)],[entry(i+1)]),params={'today':today},check=check)


# The latest published table is frozen; no speculative indexation of future dollar caps.
for i in range(100):
    year=2025 if i<30 else 2026 if i<60 else [2027,2030,2056,2100,2400][i%5]
    expected_year=2025 if year==2025 else 2026
    limit,extra=cap('ira',year,50)
    expected={'limitsYear':expected_year,'byPerson':[{'limits':[{'limit':m(limit),'catchUp':m(extra)}]}]}
    def check():
        chosen=2025 if year in {2025} else 2026
        eq(chosen,expected_year); eq(D(second_cap('ira',year,50)),limit)
        return f'published-year set is {{2025,2026}}; year {year} selects {chosen}; direct age50 IRA total cap {m(limit)}'
    add('table-year',i,expected,'Model assumption: known year uses its IRS table; future years use latest published 2026 table. No inflation is invented.',
        plan=plan([person(50,year)],[entry(i+1)],[{'id':'x','type':'ira'}]),params={'today':f'{year}-12-31'},check=check)


for i in range(100):
    people=[] if i%3==0 else [person(40,2026)] if i%3==1 else [person(40,2026),person(45,2026,'b','partner')]
    p=plan(people,[]) if i%2 else {'household':{'people':people}}
    expected={'hasData':False,'items':[],'yearly':'0.00','matchYearly':'0.00','totalYearly':'0.00','warnings':[],
              'byPerson':{'length':len(people)}}
    def check():
        eq(sum([],0),0)
        return f'empty set has zero entries and sum zero; adult identifiers count {len(set(p["id"] for p in people))}'
    add('empty-input',i,expected,'README input lists may be missing/empty; empty recurring ledger has no money, no data and no warnings. Varied evaluation dates preserve empty-list behavior across the calendar.',plan=p,params={'today':(date(2026,1,1)+timedelta(days=i)).isoformat()},check=check)


for i in range(100):
    a=amount_at(i);dep=D(i+1)
    people=[person(40,2026),person(12,2026,'c','dependent')]
    expected={'yearly':m(a+dep),'byPerson':{'length':1,'0':{'personId':'a','yearly':m(a)}},'hasData':True}
    def check():
        eq(Fraction(a+dep)-Fraction(dep),Fraction(a))
        return f'household sum {m(a+dep)} less child own {m(dep)} = adult own {m(a)}; only one nondependent identifier'
    add('dependent-exclusion',i,expected,'Model convention: contributions stay in household total; byPerson summaries exclude role=dependent. This is not a statutory IRA eligibility rule.',
        plan=plan(people,[entry(a),entry(dep,who='c',account='y')],[{'id':'x','type':'401k'},{'id':'y','type':'roth'}]),params={'today':'2026-12-31'},check=check)


for i in range(100):
    a=amount_at(i);who='missing-person' if i%2 else 'a'
    entries=[entry(a,'annual',11,who)]
    expected={'yearly':m(a),'matchYearly':'11.00','totalYearly':m(a+11),'warnings':{'length':1},
              'items':[{'accountName':'account no longer on file','accountType':None,
                        'personName':'Household' if who=='missing-person' else 'Example A'}],
              'byPerson':[{'limits':[],'yearly':m(a if who=='a' else 0)}]}
    def check():
        eq(Fraction(a+11)-11,Fraction(a))
        return f'lookup set of account IDs is empty, so one dangling reference gives one warning; total {m(a+11)}-11={m(a)}'
    add('missing-account-person',i,expected,'Model input handling: a missing account retains entered money and warns; a missing person is labelled Household and does not gain a person limit.',
        plan=plan([person(40,2026)],entries,[]),params={'today':'2026-01-01'},check=check)


# Strict comparison at cents and zero/net-negative usage behavior.
for i in range(100):
    limit=D(24500)
    used=limit+D(i-30)*100 if i<60 else [D(0),D(-1),limit-D('.01'),limit,limit+D('.01'),limit+1][i%6] if i<90 else amount_at(i)
    over=max(D(0),used-limit)
    expected={'warnings':{'length':int(used>limit)},'byPerson':[{'limits':[] if used==0 else [{'used':m(used),'limit':m(limit),'over':m(over)}]}]}
    def check():
        room=limit-used
        eq(-min(D(0),room),over)
        return f'room={m(limit)}-{m(used)}={m(room)}; warning iff room<0; excess=-min(0,room)={m(over)}'
    add('warning-threshold',i,expected,'README over-limit rule; exactly equal is permitted, one cent above warns. Negative corrections reduce used; net zero suppresses the empty limit row.',
        plan=plan([person(40,2026)],[entry(used)]),params={'today':(date(2026,1,1)+timedelta(days=i)).isoformat()},check=check)


if __name__ == '__main__':
    counts=Counter((r['rule'],r['kind']) for r in ROWS)
    for rule in {r['rule'] for r in ROWS}:
        assert [counts[rule,k] for k in ['grid','edge','extreme']]==[60,30,10]
        # Audit actual inputs, excluding case labels, outputs and prose evidence.
        inputs=[tuple(sorted((k,v) for k,v in row.items() if k.startswith(('plan.','params.','arg.')))) for row in ROWS if row['rule']==rule]
        assert len(set(inputs))==100, f'duplicate {rule} input case'
    assert sum('SECOND CHECK:' in r['note'] for r in ROWS)==len(ROWS)//10
    path=write_page(PAGE,ROWS)
    print(f'{path}: {len(ROWS)} rows, {len(counts)//3} rules, {len(ROWS)//10} second checks, {sum(bool(r.get("todo")) for r in ROWS)} sourced TODO rows')
