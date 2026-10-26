"""Independent RMD answer key. Does not import or run Financial Planner.

Facts: IRS Publication 590-B (2025), Appendix B, Table III, downloaded/read
2026-10-26 at https://www.irs.gov/publications/p590b . Table values below are
transcribed from that primary source, not core/math/rmd.js.
Model recurrence: projection README's annual withdrawals before growth;
real amounts divide nominal amounts by cumulative inflation. No intermediate
cent rounding. The test fixture's huge cash reserve pays its invented $12/year
spending, isolating required withdrawals from discretionary withdrawals.
"""
from datetime import date
from decimal import Decimal, getcontext, ROUND_HALF_UP
from fractions import Fraction
from functools import reduce
from math import prod
import csv
from common import case, write_page, ROOT

getcontext().prec = 60
D = lambda x: Decimal(str(x))
# Source: https://www.irs.gov/publications/p590b Appendix B, Table III.
TABLE_TEXT = '''72 27.4  73 26.5  74 25.5  75 24.6  76 23.7  77 22.9
78 22.0  79 21.1  80 20.2  81 19.4  82 18.5  83 17.7  84 16.8
85 16.0  86 15.2  87 14.4  88 13.7  89 12.9  90 12.2  91 11.5
92 10.8  93 10.1  94 9.5  95 8.9  96 8.4  97 7.8  98 7.3
99 6.8  100 6.4  101 6.0  102 5.6  103 5.2  104 4.9  105 4.6
106 4.3  107 4.1  108 3.9  109 3.7  110 3.5  111 3.4  112 3.3
113 3.1  114 3.0  115 2.9  116 2.8  117 2.7  118 2.5  119 2.3  120 2.0'''
words = TABLE_TEXT.split()
FACTORS = {int(words[i]): D(words[i+1]) for i in range(0, len(words), 2)}
SOURCE = 'IRS Pub.590-B (2025) Table III https://www.irs.gov/publications/p590b'
COHORT_SOURCE = 'IRS Pub.590-B IRA Owners; SECURE2.0 sec.107 (75 from birth1960); date-sensitive pre-July1949 cohort'
INSURANCE_SOURCE = 'IRS retirement-plan-investments-faqs; IRC408(a)(3); ordinary life-insurance cash value is not an IRA'

def cents(x):
    return format(D(x).quantize(D('.01'), rounding=ROUND_HALF_UP), '.2f')

def six(x):
    return format(D(x).quantize(D('.000001'), rounding=ROUND_HALF_UP), '.6f')

def factor(age):
    return D('Infinity') if age < 72 else FACTORS[min(120, int(age))]

def start_age(birth):
    if birth >= '1960-01-01': return D(75)
    if birth >= '1951-01-01': return D(73)
    if birth >= '1949-07-01': return D(72)
    return D('70.5')

def start_year(birth):
    y, m, day = [int(v) for v in birth.split('-')]
    a = start_age(birth)
    return y + int(a) + (1 if a == D('70.5') and m > 6 else 0)

def second(note, i, proof):
    return note + ('; SECOND independent derivation: ' + proof if (i+1) % 10 == 0 else '')

def base_plan(year, birth, end_age, balance='100000', growth='0', inflation='0', tax='0.15'):
    return {'household': {'people': [{'id':'p1','name':'Example Adult','birthDate':birth,'role':'self','retirementAge':65,'lifeExpectancy':end_age}]},
            'accounts':[{'id':'ret','name':'Example IRA','type':'ira','ownerId':'p1','balance':cents(balance)},
                        {'id':'cash','name':'Example Cash','type':'checking','ownerId':'p1','balance':'1000000000000000.00'}],
            'assumptions': {'inflation':six(inflation),'returnStocks':six(growth),'returnBonds':six(growth),'returnCash':'0.000000','salaryGrowth':'0.000000'},
            'retirement': {'spendingMonthly':'1.00','stocksNow':'0.000000','stocksRetired':'0.000000','taxRate':six(tax),'taxMode':'flat'}}

def schedule_oracle(year, birth, years, balance, growth, inflation, tax):
    """Decimal withdrawal ledger from IRS division and documented annual timing."""
    bal=D(balance); out=[]; y0=int(birth[:4]); threshold=start_age(birth)
    for n in range(years):
        age=year+n-y0; initial=bal
        amount = bal/factor(age) if age >= threshold and bal > 0 else D(0)
        bal=(bal-amount)*(1+D(growth))
        if amount > 0:
            price=(1+D(inflation))**n
            out.append({'year':year+n,'age':age,'factor':six(factor(age)),'rmd':cents(amount),
                        'rmdReal':cents(amount/price),'taxes':cents(amount*D(tax)),
                        'deferredEnd':cents(bal),'_amount':amount,'_price':price,'_end':bal})
    return out

def closed_form_check(year, birth, years, balance, growth, inflation, tax, rows):
    """A second method: product of retained fractions, using exact rationals."""
    b0=Fraction(str(balance)); g=1+Fraction(str(growth)); infl=1+Fraction(str(inflation)); t=Fraction(str(tax))
    survival=[]; got=[]; y0=int(birth[:4])
    for n in range(years):
        age=year+n-y0
        f=Fraction(str(factor(age))) if age >= start_age(birth) else None
        opening=b0*g**n*prod(survival)
        amt=opening/f if f is not None else Fraction(0)
        survival.append(1-1/f if f is not None else Fraction(1))
        if amt > 0:
            got.append((amt,amt/infl**n,amt*t,b0*g**(n+1)*prod(survival)))
    assert len(got)==len(rows)
    for (a,r,t,e), row in zip(got,rows):
        assert cents(D(a.numerator)/a.denominator)==row['rmd']
        assert cents(D(r.numerator)/r.denominator)==row['rmdReal']
        assert cents(D(t.numerator)/t.denominator)==row['taxes']
        assert cents(D(e.numerator)/e.denominator)==row['deferredEnd']
    return 'exact Fraction product B0*(1+g)^n*product(1-1/f_j), with real=nominal/(1+i)^n and tax=t*nominal, agrees to cents'

rows=[]
# Full table including every published entry, below-table convention and 120+.
factor_ages=list(range(72,121))+[73,75,80,85,90,95,100,105,110,115,120]
factor_ages += [0,1,18,65,70,71,71.999999,72,72.000001,72.5,73,73.999999,74,74.5,75,75.999999,99,99.999999,100,100.5,118,118.999999,119,119.999999,120,120.000001,120.5,121,122,130]
factor_ages += [-100,-1,0.000001,71.999999,72.000001,119.999999,120,121,500,10000]
assert len(factor_ages)==100
for i,a in enumerate(factor_ages):
    f=factor(a); value='Infinity' if not f.is_finite() else six(f)
    proof=f'age {a} selects the printed TableIII age {min(120,int(a))}; direct source lookup={value}' if a>=72 else f'age {a}<72: table has no entry; documented helper sentinel Infinity'
    rows.append(case('rmd','factor',i,'rmdFactor',{'value':value},args={'0':a},note=second(SOURCE+'; fractional ages use completed age; below72=Infinity is the documented helper convention',i,proof)))

# Each cohort's legal age; 1949 requires a birthday and belongs in calendar tests.
birth_years=[1950+i%46 for i in range(60)]+[1948,1950,1951,1958,1959,1960,1961,1940,1930,1947]*3+[1900,1901,1910,1920,1948,1950,1951,1960,2056,2200]
for i,y in enumerate(birth_years):
    a=start_age(f'{y}-01-01')
    todo='Birth years before 1949 began at age70.5 under Pub.590-B; helper incorrectly returns72.' if y<1949 else ''
    rows.append(case('rmd','cohort',i,'rmdStartAge',{'value':six(a)},args={'0':y},todo=todo,note=second(COHORT_SOURCE+'; January1 assumed for year-only primitive; no ambiguous1949 primitive',i,f'chronological test: year{y} lies in '+('pre1949 =>70.5' if y<1949 else '1949-1950 =>72' if y<1951 else '1951-1959 =>73' if y<1960 else '1960+ =>75'))))

balances=['1000','10000','100000','500000','1000000','2500000']
amount_cases=[(balances[i//10],72+(i%10)*3) for i in range(60)]
amount_cases += [(b,a) for b,a in [('0',73),('0.01',73),('-0.01',75),('-1000',80),('26.50',73),('24.60',75),('100',71),('100',72),('100',120),('100',121)]]*3
amount_cases += [('1000000000000',a) for a in [72,73,75,100,120]]+[('0.01',a) for a in [71,72,73,120,10000]]
for i,(b,a) in enumerate(amount_cases):
    f=factor(a); amt=D(0) if not f.is_finite() else D(b)/f
    if (i+1)%10==0 and f.is_finite():
        # Independently invert the percentage: f is a tenth, amount=10B/integer.
        alt=Fraction(b)*10/int(f*10)
        assert cents(amt)==cents(D(alt.numerator)/alt.denominator)
    proof=f'{b}*10/{int(f*10)}={cents(amt)} (integer-tenths division)' if f.is_finite() else 'no applicable denominator below72 =>0'
    rows.append(case('rmd','amount',i,'rmdAmount',{'value':cents(amt)},args={'0':cents(b) if D(b).as_tuple().exponent>=-2 else b,'1':a},note=second(SOURCE+'; balance/factor; negative primitive amounts are algebraic robustness cases, not valid IRA balances',i,proof)))

dates=[f'{1950+i%51}-{["01-01","06-30","07-01","12-31"][i%4]}' for i in range(60)]
dates += ['1948-12-31','1949-01-01','1949-06-30','1949-07-01','1949-12-31','1950-12-31','1951-01-01','1959-12-31','1960-01-01','1960-02-29']*3
dates += ['1900-01-01','1900-12-31','1920-02-29','1948-02-29','1949-06-30','1949-07-01','1960-02-29','2000-02-29','2056-02-29','2200-12-31']
for i,birth in enumerate(dates):
    year=2026 if i%2==0 else 2056; sy=start_year(birth); sa=start_age(birth)
    people=[{'id':'p1','name':'Example Adult','birthDate':birth,'role':'self'}]
    if i%3==0: people.append({'id':'child','name':'Example Child','birthDate':'2020-02-29','role':'dependent'})
    expected={'people':{'length':1,'0':{'birthYear':int(birth[:4]),'age':year-int(birth[:4]),'startAge':six(sa),'startYear':sy,'yearsUntil':max(0,sy-year),'deferredNow':'0.00','firstRmd':None,'firstRmdReal':None}},'ready':False}
    todo='Birthday-sensitive older RMD cohort: page uses72 for all pre1951 births instead of70.5 before July1,1949.' if birth<'1949-07-01' else ''
    proof=f'birthday {birth} plus legal age{sa} falls in {sy}; remaining=max(0,{sy}-{year})={max(0,sy-year)}'
    rows.append(case('rmd','calendar',i,'compute',expected,plan={'household':{'people':people},'accounts':[]},params={'today':f'{year}-'+['01-01','12-31','02-28','03-01'][i%4]},todo=todo,note=second(COHORT_SOURCE+'; age display is calendar-year age; dependent excluded; no projection inputs so first amount null',i,proof)))

# Four separate formula groups, each with its own60/30/10 inputs and every10th audit.
for rule in ['schedule','real','tax','totals']:
    for i in range(100):
        year=2026 if i%2==0 else 2056
        age=([73,75,80,85,90,95][i%6] if year==2026 else [75,76,80,85,90,95][i%6])
        balance=balances[(i//3)%len(balances)]; years=1+i%5
        growth=['0','0.03','0.06','-0.02'][i%4]; inflation=['0','0.02','0.03','-0.01'][i%4]; tax=['0','0.1','0.15','0.22','0.4'][i%5]
        if 60<=i<90:
            age=[72,73,74,75,119,120][i%6] if year==2026 else [74,75,76,119,120,121][i%6]
            balance=['0','0.01','24.60','26.50','100000','1000000'][i%6]; years=[1,2,3][i%3]
            growth=['0','-0.5','0.5'][i%3]; inflation=['0','-0.05','0.1'][i%3]
        if i>=90:
            balance=['1000000000000','0.01'][i%2]; years=[1,10,30,60,100][i%5]; age=75
            growth=['0','0.01'][i%2]; inflation=['0','0.02'][i%2]; tax=['0','0.4'][i%2]
        birth=f'{year-age}-01-01'; plan=base_plan(year,birth,age+years-1,balance,growth,inflation,tax)
        schedule=schedule_oracle(year,birth,years,balance,growth,inflation,tax)
        expected={'ready':True,'schedule':{'length':len(schedule)}}
        if rule=='schedule':
            if schedule:
                for n in sorted(set([0,len(schedule)-1])):
                    expected['schedule'][str(n)]={k:v for k,v in schedule[n].items() if k in ['year','age','factor','rmd','deferredEnd']}
        elif rule=='real':
            if schedule:
                for n in sorted(set([0,len(schedule)-1])): expected['schedule'][str(n)]={'rmdReal':schedule[n]['rmdReal']}
        elif rule=='tax':
            expected['taxRate']=six(tax)
            if schedule:
                for n in sorted(set([0,len(schedule)-1])): expected['schedule'][str(n)]={'taxes':schedule[n]['taxes']}
        elif rule=='totals':
            expected.update({'totalRmdReal':cents(sum((r['_amount']/r['_price'] for r in schedule),D(0))),
                             'totalTaxReal':cents(sum((r['_amount']*D(tax)/r['_price'] for r in schedule),D(0)))})
        proof=closed_form_check(year,birth,years,balance,growth,inflation,tax,schedule) if (i+1)%10==0 else ''
        note=SOURCE+'; projection README: withdraw before annual growth; independent Decimal ledger; annual cash-covered spending12; no contributions; '+f'B0={balance}; growth={growth}; inflation={inflation}; tax={tax}; years={years}'
        rows.append(case('rmd',rule,i,'compute',expected,plan=plan,params={'today':f'{year}-01-01'},note=second(note,i,proof)))

for i in range(100):
    year=2026 if i%2==0 else 2056; age=73 if year==2026 else 75; birth=f'{year-age}-01-01'
    b1=D(balances[i%6]); b2=D(balances[(i+3)%6]);
    if i>=60: b1,b2=[(D(0),D(0)),(D(0),D('26.5')),(D('26.5'),D(0)),(D('0.01'),D('0.01')),(D('1000000000000'),D('0.01'))][i%5]
    plan=base_plan(year,birth,age,b1)
    plan['household']['people'].append({'id':'p2','name':'Example Partner','birthDate':birth,'role':'partner','retirementAge':65,'lifeExpectancy':age})
    plan['accounts'].append({'id':'ret2','name':'Partner IRA','type':'ira','ownerId':'p2','balance':cents(b2)})
    f=factor(age)
    expected={'people':{'length':2,'0':{'deferredNow':cents(b1),'firstRmd':cents(b1/f),'firstRmdReal':cents(b1/f)},'1':{'deferredNow':cents(b2),'firstRmd':cents(b2/f),'firstRmdReal':cents(b2/f)}},'deferredNow':cents(b1+b2),'hasDeferred':b1+b2>0}
    todo='Ownership is lost: page repeats household pre-tax balance and household RMD for each adult; Pub.590-B requires each owner/account calculation.' if b1+b2>0 else ''
    proof=f'individual shares {cents(b1)}/{f}={cents(b1/f)} and {cents(b2)}/{f}={cents(b2/f)}; additivity gives household{cents((b1+b2)/f)}'
    rows.append(case('rmd','ownership',i,'compute',expected,plan=plan,params={'today':f'{year}-01-01'},todo=todo,note=second(SOURCE+'; each IRA belongs to an individual; plan ownerId from docs/DATA_MODEL.md; both adults start in this year',i,proof)))

excluded=['roth','hsa','brokerage','checking','savings','home','vehicle','529','cash_value_life','crypto']
for i in range(100):
    year=2026 if i%2==0 else 2056; age=73 if year==2026 else 75; birth=f'{year-age}-01-01'
    kind=excluded[i%len(excluded)]; amount=D(balances[(i//10)%6])
    if i>=60: amount=[D(0),D('0.01'),D('1000000')][i%3]
    if i>=90: amount=[D('1000000000000'),D('0.01')][i%2]
    plan=base_plan(year,birth,age,'0')
    plan['accounts']=[{'id':'excluded','name':'Example '+kind,'type':kind,'ownerId':'p1','balance':cents(amount)}]
    if i in [60,61,62]: plan['accounts']=[]
    expected={'deferredNow':'0.00','hasDeferred':False,'deferredAccounts':{'length':0},'schedule':{'length':0},'totalRmdReal':'0.00','totalTaxReal':'0.00'}
    todo='Ordinary cash-value life insurance is not an IRA; account type alone incorrectly imposes IRA required withdrawals (IRC408(a)(3)).' if kind=='cash_value_life' else ''
    note=INSURANCE_SOURCE+'; Roth has no lifetime RMD; other listed accounts are outside traditional retirement accounts; no inherited account or beneficiary assumption'
    rows.append(case('rmd','exclusions',i,'compute',expected,plan=plan,params={'today':f'{year}-01-01'},todo=todo,note=second(note,i,f'{kind} balance{cents(amount)} contributes zero to eligible IRA/401k set; empty sum=0; zero/factor=0')))

for i in range(100):
    # Rendering subset is a page output rule independent of plan readiness.
    expected={'table':{'length':29,'0':{'age':72,'factor':'27.400000'},'28':{'age':100,'factor':'6.400000'}}}
    for j in range(29): expected['table'][str(j)]={'age':72+j,'factor':six(FACTORS[72+j])}
    plan={'household':{'people':[]},'accounts':[]}
    if i%2: plan['household']['people']=[{'id':'p1','name':'Example Adult','role':'self','birthDate':f'{1950+i%50}-12-31'}]
    if i%3: plan['accounts']=[{'id':'ret','name':'Example IRA','type':'ira','balance':cents(balances[i%6])}]
    rows.append(case('rmd','page_table',i,'compute',expected,plan=plan,params={'today':f'{2026 if i%2==0 else 2056}-12-31'},note=second(SOURCE+'; page output displays ages72..100 inclusive; factor data remain available when projection is not ready',i,'inclusive count100-72+1=29; each displayed factor separately looked up in IRS TableIII')))

path=write_page('rmd',rows)
with path.open(newline='',encoding='utf8') as f: header=next(csv.reader(f))
brief=ROOT/'tests/golden/retirement/briefs/rmd.md'
text=brief.read_text(encoding='utf8')
marker='\n## Completed independent oracle'
if marker in text: text=text.split(marker)[0]
text += marker+'''\n\nThe generator `tools/golden_retirement/rmd.py` uses Python Decimal for the primary\nwithdrawal ledger and exact Fraction retained-balance products for every tenth\nschedule/real/tax/totals row. It never imports or executes application code.\nAll eleven separately named rules have100 cases:60 grid,30 edge,10 extreme (1100 total).\n\nAdditional rules from source where the README is incomplete:\n- IRS Pub590-B IRA Owners distinguishes70.5 before July1,1949,72 through1950,\n  and73 beginning1951. SECURE2.0 sec107 supplies75 for1960+. Older first distribution\n  years depend on birth month. Current-year age remains the page's calendar-year age.\n- The page's29-row display is72..100 inclusive; the IRS table continues through120+.\n  Fractional helper ages use completed age; under72=Infinity is the helper convention,\n  not a claim that historical IRA owners had no required distributions before72.\n- Each person owns their own accounts. Pub590-B requires owner/account calculation;\n  summing amounts is allowed for an owner's IRAs, not pooling spouses' ownership.\n- Ordinary cash-value life insurance is not an IRA. IRS retirement-plan-investments-faqs\n  and IRC408(a)(3) support the explicit insurance-exclusion disagreement.\n- No beneficiary data exists in these inputs: TableII's spouse>10years younger and sole\n  beneficiary exception is not silently inferred. Inherited IRA rules are out of scope.\n\nSchedule fixture: invented $12 annual spending is paid by a large cash balance; no\ncontributions or income. RMD B/f is removed before return g: Bnext=(B-B/f)(1+g).\nPrice level=(1+inflation)^elapsedYears; rmdReal=rmd/price; taxes=rmd*flatRate;\ntotalRmdReal=sum(real RMD), totalTaxReal=sum(taxes/price). RMD schedule filters\nstrictly positive amounts. FirstRmd isnull when its first calendar year is absent\nfrom the projection. Monetary outputs round half-up only at final serialization\nto cents; factors, rates, and startAge use six decimals.\n\nKnown disagreements are explicit CSV TODOs: older70.5 cohorts; repeated household\nbalances/withdrawals on each adult; ordinary life insurance included as deferred.\n\nExact CSV header:\n\n```csv\n'''+','.join(header)+'\n```\n'
brief.write_text(text,encoding='utf8')
print(f'{len(rows)} cases -> {path}; {sum(bool(r.get("todo")) for r in rows)} explicit TODOs')
