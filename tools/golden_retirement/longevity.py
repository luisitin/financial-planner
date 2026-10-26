"""Independent longevity oracle: README's mortality law, no application imports.

Sources: modules/retirement/longevity/README.md (model constants and formula);
SSA https://www.ssa.gov/oact/STATS/table4c6.html (meaning of remaining life).
The fitted constants are app assumptions, not numbers copied from SSA tables.
All example dates, identities, ages and plan ends below are invented grid inputs.
"""
from datetime import date
from math import ceil, exp, expm1, fsum, isclose, log
from pathlib import Path
from collections import Counter
from common import case, write_page, rate

ROOT = Path(__file__).resolve().parents[2]
MODEL = {'m': (84, 10.5), 'f': (88, 9.5), '': (86, 10)}
SHIFT = {'better': 3, 'average': 0, 'worse': -4}
MARKS = (80, 85, 90, 95, 100)


def parameters(opts):
    m, b = MODEL.get(opts.get('sex', ''), MODEL[''])
    return m + SHIFT.get(opts.get('health', 'average'), 0), b


def chance(x, t, opts):
    """Survival is exp[-(cumulative hazard at t - cumulative hazard at x)]."""
    if t <= x:
        return 1.0
    m, b = parameters(opts)
    return exp(exp((x-m)/b) - exp((t-m)/b))


def chance_second(x, t, opts):
    """Independent rearrangement using initial hazard and expm1 elapsed time."""
    if t <= x:
        return 1.0
    m, b = parameters(opts)
    return exp(-exp((x-m)/b)*expm1((t-x)/b))


def quantile(x, p, opts):
    if p >= 1:
        return x
    m, b = parameters(opts)
    # Solve log(p) = exp((x-m)/b) - exp((t-m)/b), then round UP.
    t = m + b*log(exp((x-m)/b)-log(p))
    answer = max(x, ceil(t))
    # Floating point near an exact boundary is resolved against the inequality.
    while answer > x and chance(x, answer-1, opts) <= p:
        answer -= 1
    while chance(x, answer, opts) > p:
        answer += 1
    return answer


def remaining(x, opts, end=120):
    # Integral approximated by unit-width midpoint rectangles, as the brief fixes.
    n = max(0, ceil(end-x))
    return fsum(chance(x, x+j+0.5, opts) for j in range(n))


def remaining_second(x, opts, end=120):
    # Summation by parts: expected duration = weighted deaths + surviving tail.
    n = max(0, ceil(end-x))
    if not n:
        return 0.0
    survival = [chance_second(x, x+j+0.5, opts) for j in range(n)]
    return fsum((j+1)*(survival[j]-survival[j+1]) for j in range(n-1)) + n*survival[-1]


def age_on(birth, today):
    if not today:
        return None
    b, t = date.fromisoformat(birth), date.fromisoformat(today)
    return t.year-b.year-int((t.month, t.day) < (b.month, b.day))


def age_second(birth, today):
    b, t = date.fromisoformat(birth), date.fromisoformat(today)
    years = t.year-b.year
    # The ordinal encoding MMDD independently checks whether the birthday passed.
    return years-int(100*t.month+t.day < 100*b.month+b.day)


def union(x, y, years, a, b):
    sa, sb = chance(x, x+years, a), chance(y, y+years, b)
    return sa+sb-sa*sb


def union_quantile(x, y, a, b):
    # Binary search integer calendar years against the joint survival inequality.
    lo, hi = 0, 256
    while hi-lo > 1:
        mid = (lo+hi)//2
        if union(x, y, mid, a, b) > .1:
            lo = mid
        else:
            hi = mid
    return x+hi


def page_expected(plan, today, *, capped_couple=True):
    people = []
    for p in plan.get('household', {}).get('people', []):
        if p.get('role') == 'dependent' or not p.get('birthDate'):
            continue
        opts = plan.get('retirement', {}).get('longevity', {}).get(p['id'], {})
        opts = {'sex': opts.get('sex', ''), 'health': opts.get('health', 'average')}
        age = age_on(p['birthDate'], today)
        end = p.get('lifeExpectancy', plan.get('assumptions', {}).get('planEndAge', 95))
        result = {'id': p['id'], 'name': p['name'], 'age': age, **opts,
                  'currentPlanEnd': float(end), 'expectancy': None,
                  'ages': [], 'planTo': None}
        if age is not None:
            result.update(expectancy=f'{age+remaining(age, opts):.6f}',
                          ages=[{'age': mark, 'p': rate(chance(age, mark, opts))} for mark in MARKS],
                          planTo=min(120, quantile(age, .1, opts)) if age < 120 else age)
        people.append(result)
    alive = [p for p in people if p['age'] is not None]
    either = None
    if len(alive) >= 2:
        a, b = alive[:2]
        target = union_quantile(a['age'], b['age'], a, b)
        if capped_couple:
            target = min(target, a['age']+70)
        either = {'ages': [{'age': mark, 'p': rate(union(a['age'], b['age'], mark-a['age'], a, b))}
                          for mark in MARKS], 'planTo': target,
                  'planToYear': int(today[:4])+target-a['age'], 'first': a['name'], 'second': b['name']}
    suggestion = ''
    if either:
        suggestion = f"Plan for at least one of you being alive to about {either['planTo']} ({either['first']}'s age): that is when the chance drops under 1 in 10."
    elif alive:
        suggestion = f"Plan to about {alive[0]['planTo']}: that is when the chance of still being alive drops under 1 in 10."
    return {'people': people, 'either': either, 'suggestion': suggestion, 'hasData': bool(alive)}


def verify_page(plan, today, expected, *, uncapped=False):
    # Verify calendar ages by a second encoding; probability by expm1; duration by
    # weighted deaths; inverse result by inequalities, without rerunning the oracle.
    for out in expected['people']:
        source = next(p for p in plan['household']['people'] if p['id'] == out['id'])
        if out['age'] is None:
            assert today is None
            continue
        x = age_second(source['birthDate'], today)
        assert out['age'] == x
        assert isclose(float(out['expectancy']), x+remaining_second(x, out), abs_tol=0.00000051)
        for mark in out['ages']:
            assert isclose(float(mark['p']), chance_second(x, mark['age'], out), abs_tol=0.00000051)
        if out['planTo'] < 120:
            assert chance_second(x, out['planTo'], out) <= .1
            assert chance_second(x, out['planTo']-1, out) > .1
    if expected['either']:
        a, b = expected['people'][:2]
        for point in expected['either']['ages']:
            dt = point['age']-a['age']
            second = 1-(1-chance_second(a['age'], a['age']+dt, a))*(1-chance_second(b['age'], b['age']+dt, b))
            assert isclose(float(point['p']), second, abs_tol=0.00000051)
        if uncapped or expected['either']['planTo'] < a['age']+70:
            dt = expected['either']['planTo']-a['age']
            assert union(a['age'], b['age'], dt, a, b) <= .1
            assert union(a['age'], b['age'], dt-1, a, b) > .1


def person(x, today, pid='a', **extra):
    # January 1 birthday; date tests replace this with calendar-boundary fixtures.
    return {'id': pid, 'name': 'Example A' if pid == 'a' else 'Example B',
            'birthDate': f'{int(today[:4])-x:04d}-01-01',
            'role': 'self' if pid == 'a' else 'partner', **extra}


rows = []
audit_count = 0


def add(rule, i, target, expected, *, args=None, plan=None, today=None, note='', todo='', check=None):
    global audit_count
    note = 'Source: README Gompertz model; invented grid inputs. ' + note
    if (i+1) % 10 == 0:
        assert check is not None
        check()
        audit_count += 1
        note += ' SECOND CHECK PASSED: ' + ('calendar ordinal age; expm1 survival; summation by parts duration; inverse inequalities' if target == 'compute' else check.description) + '.'
    rows.append(case('longevity', rule, i, target, expected, args=args, plan=plan,
                     params=({'today': today} if today else None), note=note, todo=todo))


def checker(fn, description):
    fn.description = description
    return fn


def equal(a, b, tolerance=1e-11):
    assert isclose(a, b, abs_tol=tolerance, rel_tol=1e-11), (a, b)


def build():
    for i in range(100):
        opts = {'sex': ('m', 'f', '', 'unknown')[i % 4], 'health': ('better', 'average', 'worse', 'unknown')[(i//4) % 4]}
        x = 25+(i*7)%65 if i < 60 else ([0, 1, 79, 80, 84, 85, 89, 90, 94, 95, 99, 100, 119, 120, 121][(i-60)%15] if i < 90 else [0, 1, 5, 110, 119, 120, 121, 130, 140, 150][i-90])
        t = x+((i*11)%45) if i < 60 else (x+(-1, 0, 1, .000001, 80-x, 100-x)[i%6] if i < 90 else x+(0, 1, 20, 50, 100)[i%5])
        value = chance(x, t, opts)
        add('survival', i, 'survival', {'value': rate(value)}, args=[x, t, opts],
            note=f'Hazard-difference exponential at age {x} to {t}; reached ages have probability one.',
            check=checker(lambda: equal(value, chance_second(x, t, opts)), 'initial hazard times expm1(elapsed/b)'))

    for i in range(100):
        x = 25+i%65 if i < 60 else [0, 79, 80, 99, 100, 119, 120, 121, 130, 150][i%10]
        opts = {'sex': ('m', 'f', '')[i%3], 'health': ('better', 'average', 'worse')[(i//3)%3]}
        p = (.1, .25, .5, .75, 1)[i%5] if i < 90 else (.000001, .000010, .000100, .001000, .999999)[i%5]
        value = quantile(x, p, opts)
        todo = 'The age-120 stop returns before survival reaches the requested probability.' if value > 120 and x < value and p < 1 else ''
        def check():
            assert chance_second(x, value, opts) <= p*(1+1e-10)
            assert value == x or chance_second(x, value-1, opts) > p
        add('inverse-survival', i, 'ageAtSurvival', {'value': value}, args=[x, rate(p), opts],
            note=f'Closed form ceil(m+b*ln(exp((x-m)/b)-ln(p))); p={p}.', todo=todo,
            check=checker(check, 'survival at answer and previous integer bracket the target'))

    for i in range(100):
        x = 20+i if i < 60 else [0, 1, 79, 80, 94, 95, 99, 100, 119, 120][i%10] if i < 90 else [0, 1, 5, 110, 115, 118, 119, 120, 125, 150][i-90]
        opts = {'sex': ('m', 'f', '')[i%3], 'health': ('better', 'average', 'worse')[(i//3)%3]}
        value = remaining(x, opts)
        add('life-expectancy-sum', i, 'lifeExpectancy', {'value': f'{value:.6f}'}, args=[x, opts],
            note='Unit midpoint rectangles to age120; this numerical approximation is an explicit brief contract.',
            check=checker(lambda: equal(value, remaining_second(x, opts)), 'weighted survival decrements plus residual tail (summation by parts)'))

    for i in range(100):
        year = 2026 if i%2 == 0 else 2056
        if i < 60:
            birth = f'{year-(25+i%65):04d}-{1+i%12:02d}-{1+i%27:02d}'
            today = f'{year}-10-{1+i%28:02d}'
        elif i < 90:
            birth, suffix = [('1960-02-29','02-28'), ('1960-02-29','03-01'), ('1960-01-01','01-01'), ('1960-12-31','12-30'), ('1960-12-31','12-31'), ('1960-06-15','06-14'), ('1960-06-15','06-15'), ('1960-06-15','06-16'), ('2000-02-29','02-28'), ('2000-02-29','02-29')][i%10]
            if suffix == '02-29': year = 2056
            today = f'{year}-{suffix}'
        else:
            today = f'{year}-01-01'
            birth = f'{year-[0,1,110,115,119,120,125,130,140,150][i-90]:04d}-01-01'
        people = [{'id':'a','name':'Example A','birthDate':birth,'role':'self'}]
        if i%3 == 0:
            people.append(person(35+i%40, today, 'b'))
        plan = {'household': {'people':people}}
        expected = page_expected(plan, today)
        add('birthday-aware-page', i, 'compute', expected, plan=plan, today=today,
            note='Whole years, birthday reached inclusive. Leap-day birthday advances March1 in a nonleap year.',
            check=checker(lambda: verify_page(plan, today, expected), 'page cross-check'))

    for i in range(100):
        today = ('2026-12-31', '2056-01-01')[i%2]
        x, y = (40+i%45, 40+(i*3)%45) if i < 60 else ([18,25,30,50,80,85,90,95,100,110][i%10], [18,25,30,40,50,65,80,95,110,119][i%10]) if i < 90 else (0+i%5, 1+i%4)
        a = {'sex': ('m', 'f', '')[i%3], 'health': ('average','better','worse')[i%3]}
        b = {'sex': ('f', 'm', '')[i%3], 'health': ('better','worse','average')[i%3]}
        plan = {'household': {'people':[person(x,today),person(y,today,'b')]},'retirement':{'longevity':{'a':a,'b':b}}}
        expected = page_expected(plan, today)
        add('couple-probability-clock', i, 'compute', expected, plan=plan, today=today,
            note='Union S_a+S_b-S_a*S_b; marks share calendar time measured from the first adult; existing cap retained in this contract group.',
            check=checker(lambda: verify_page(plan, today, expected), 'page cross-check'))

    for i in range(100):
        today = ('2026-01-01','2056-12-31')[i%2] if i%10 else None
        people = [person(40+i%40, today or '2026-01-01')]
        mode = (i*7)%11
        plan = {'household':{'people':people}}
        if mode == 1: people.clear()
        if mode == 2: people[0]['role'] = 'dependent'
        if mode == 3: people[0].pop('birthDate')
        if mode == 4: people[0]['lifeExpectancy'] = (90, 95, 100)[i%3]
        if mode == 5: plan['assumptions'] = {'planEndAge': (85, 95, 105)[i%3]}
        if mode == 6:
            people.append(person(55, today or '2026-01-01', 'b')); people.append({'id':'child','name':'Example child','birthDate':'2020-01-01','role':'dependent'})
        if mode == 7: plan['retirement'] = {'longevity':{'a':{'sex':'unknown','health':'unknown'}}}
        if mode == 8: people[0]['role'] = 'partner'
        if mode == 9: plan = {}  # complete omissions, including empty birthday and adult lists
        expected = page_expected(plan, today)
        add('page-defaults-omissions', i, 'compute', expected, plan=plan, today=today,
            note='Adults with birth dates only; no today means null ages and no suggestion. End priority person then plan then invented app default95.',
            check=checker(lambda: verify_page(plan, today, expected), 'page cross-check'))

    for i in range(100):
        # This separate policy rule compares the README's unbounded sum to the
        # stop at age120. The midpoint integration itself is not changed.
        x = 20+i if i < 60 else 110+(i-60)%11 if i < 90 else 120+i-90
        opts = {'sex': ('m','f','')[i%3], 'health': ('average','better','worse')[i%3]}
        value, cut = remaining(x, opts, 200), remaining(x, opts)
        todo = 'The undocumented age-120 cutoff omits a positive survival tail visible at six-decimal precision.' if abs(float(f'{value:.6f}')-cut) > .00000050001 else ''
        add('individual-age120-tail', i, 'lifeExpectancy', {'value':f'{value:.6f}'}, args=[x, opts],
            note=f'Unbounded midpoint sum evaluated to age200 (tail underflows below six decimals); capped sum={cut:.9f}; omitted years={value-cut:.9f}.', todo=todo,
            check=checker(lambda: equal(value, remaining_second(x, opts, 200)), 'uncapped sum by weighted survival decrements with vanishing terminal mass'))

    for i in range(100):
        today = ('2026-01-01','2056-12-31')[i%2]
        x = 18+(i%30) if i < 60 else [29,30,31,32,33,34,35,36,37,38][i%10] if i < 90 else i%10
        y = x+(-5,0,5)[i%3]
        a = {'sex':('m','f','')[i%3], 'health':('better','average','worse')[i%3]}
        b = {'sex':('f','m','')[i%3], 'health':('average','better','worse')[i%3]}
        plan = {'household':{'people':[person(x,today), person(y,today,'b')]},'retirement':{'longevity':{'a':a,'b':b}}}
        expected = page_expected(plan, today, capped_couple=False)
        dt = expected['either']['planTo']-x
        todo = 'The undocumented 70-year couple search cap stops while joint survival remains above10%.' if dt > 70 else ''
        add('couple-70year-cap', i, 'compute', expected, plan=plan, today=today,
            note=f'Uncapped joint crossing at first adult age{x+dt}; S_either(70)={union(x,y,70,a,b):.9f}; crossing years={dt}.', todo=todo,
            check=checker(lambda: verify_page(plan, today, expected, uncapped=True), 'page cross-check'))


if __name__ == '__main__':
    build()
    assert len(rows) == 800
    assert audit_count == 80
    counts = Counter((r['rule'],r['kind']) for r in rows)
    for rule in {r['rule'] for r in rows}:
        assert [counts[rule,k] for k in ('grid','edge','extreme')] == [60,30,10]
    path = write_page('longevity', rows)
    print(f'{path.name}: {len(rows)} rows; {audit_count} distinct second checks; {sum(bool(r.get("todo")) for r in rows)} explicit TODO rows')
