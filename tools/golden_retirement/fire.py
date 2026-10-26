"""Independent FI oracles from the README's accounting and compound-growth identities.

No application code is imported, copied, or executed. Constant growth is evaluated
using a closed-form annuity; the independent check expands individual cash flows.
"""
from decimal import Decimal, localcontext, ROUND_CEILING
from fractions import Fraction
from collections import Counter
from copy import deepcopy
from datetime import date,timedelta
from functools import lru_cache
from common import case, write_page

D = Decimal
ROWS = []


def m(v):
    return f'{D(v):.2f}'


def r(v):
    return f'{D(v):.6f}'


def eq(a,b):
    assert a == b, (a,b)


def adult(year=2026,age=40,retire=65,ident='a',role='self',birthday='12-31'):
    return {'id':ident,'name':'Example '+ident.upper(),'role':role,
            'birthDate':f'{year-age:04}-{birthday}','retirementAge':retire}


def base(monthly=1000, invested=0, year=2026, age=40, retire=65, stocks='0.700000', stock='0.070000', bond='0.040000', inflation='0.030000'):
    return {'household':{'people':[adult(year,age,retire)]},
            'accounts':[{'id':'x','type':'brokerage','balance':m(invested)}],
            'assumptions':{'returnStocks':r(stock),'returnBonds':r(bond),'inflation':r(inflation)},
            'retirement':{'spendingMonthly':m(monthly),'stocksNow':r(stocks),'withdrawalRate':'0.040000'}}


def savings(p,own=0,employer=0,income=None,expenses=None):
    p['retirement']['contributions']=[{'id':'c','accountId':'x','personId':'a','amount':m(own),'period':'annual','employerMatch':m(employer)}]
    if income is not None:p['income']=[{'id':'i','name':'Example pay','type':'salary','personId':'a','amount':m(income),'period':'annual'}]
    if expenses is not None:p['expenses']=[{'id':'e','name':'Example costs','category':'other','amount':m(expenses),'period':'annual'}]
    leftover=max(D(0),D(income)-D(expenses)) if income is not None and expenses is not None else D(0)
    return D(own)+D(employer)+max(D(0),leftover-D(own))


def real(stocks,stock,bond,inflation):
    with localcontext() as ctx:
        ctx.prec=60
        return (1+D(stocks)*D(stock)+(1-D(stocks))*D(bond))/(1+D(inflation))-1


def future(pot,saving,rate,n):
    """Closed annuity identity, never a copy of the application's year loop."""
    with localcontext() as ctx:
        ctx.prec=60
        growth=1+D(rate)
        return D(pot)+D(saving)*n if rate==0 else D(pot)*growth**n+D(saving)*(growth**n-1)/D(rate)


def years(pot,saving,rate,target):
    if pot>=target:return 0
    if saving<=0 and rate<=0:return None
    # Closed-form value at each candidate handles asymptotes and negative returns;
    # it does not simulate balances recursively or import the implementation.
    for n in range(1,81):
        if future(pot,saving,rate,n)>=target:return n
    return None


def check_years(pot,saving,rate,target,n):
    with localcontext() as ctx:
        ctx.prec=60
        g=1+D(rate)
        def expanded(k):
            return D(pot)*g**k+sum((D(saving)*g**j for j in range(k)),D(0))
        if n==0:assert pot>=target
        elif n is None:assert all(expanded(k)<target for k in range(1,81))
        else:
            assert expanded(n)>=target
            assert all(expanded(k)<target for k in range(n))
        return f'individual future cash flows expanded, first crossing={n}; pot={m(pot)}, saving={m(saving)}, target={m(target)}'


def add(rule,i,expected,note,check,**kwargs):
    if (i+1)%10==0:
        evidence=check();assert evidence
        note+=' | SECOND CHECK: '+evidence
    ROWS.append(case('fire',rule,i,kwargs.pop('target','compute'),expected,note=note,**kwargs))


@lru_cache(None)
def varied(i):
    if i<60:value=D((i+1)*73)
    elif i<90:value=D(['0.01','0.02','0.03','0.99','1','1.01','9.99','10','10.01','99.99',
                      '100','100.01','999.99','1000','1000.01','2999.99','3000','3000.01',
                      '24999.99','25000','25000.01','99999.99','100000','100000.01',
                      '299999.99','300000','300000.01','999999.99','1000000','1000000.01'][i-60])
    else:value=D(['0.01','1000000','0.02','1000000000','999999999.99','12345678.90','0.03','10000000','100000000','3.00'][i-90])
    previous={varied(j) for j in range(i)}
    while value in previous:value+=D('.01')
    return value


# Spending divided by the selected withdrawal fraction; all figures are invented.
for i in range(100):
    monthly=varied(i);wr=D(['.01','.02','.025','.03','.04','.05','.08','.1','.2','1'][i%10]);target=monthly*12/wr
    p=base(monthly);p['retirement']['withdrawalRate']=r(wr)
    def check():
        eq(Fraction(target)*Fraction(wr),Fraction(monthly)*12)
        return f'target times withdrawal fraction: {m(target)} x {r(wr)} restores annual spending {m(monthly*12)} before cent rounding'
    add('fi-number',i,{'ready':True,'spendingYearly':m(monthly*12),'withdrawalRate':r(wr),'fiNumber':m(target)},
        f'README FI number=yearly spending/withdrawal rate; {m(monthly)} x12/{r(wr)}={m(target)}. Invented spending; Bengen(1994) supplies historical context, not a guarantee.',check,plan=p,params={'today':'2026-01-01'})


for i in range(100):
    monthly=varied(i);wr=D(['.02','.03','.04','.05','.1'][i%5]);p=base(monthly);p['retirement']['withdrawalRate']='0.080000'
    target=monthly*12/wr
    def check():
        eq(Fraction(monthly)*12/Fraction(wr),Fraction(target))
        return f'rational inversion gives {m(target)}; explicit rate {r(wr)} overrides stored 0.08'
    add('withdrawal-override',i,{'withdrawalRate':r(wr),'fiNumber':m(target)},'Parameter precedence is an application input convention; README FI formula; invented numbers.',check,plan=p,params={'today':'2056-12-31','withdrawalRate':r(wr)})


INCLUDED=['brokerage','crypto','401k','ira','cash_value_life','roth','hsa']
EXCLUDED=['checking','savings','cash','529','property','vehicle','other_asset','credit','loan','mortgage','student_loan','other_liability']
for i in range(100):
    amount=varied(i);sign=-1 if 60<=i<90 and i%5==0 else 1
    p=base(1000)
    p['accounts']=[{'id':f'ac{j}','type':typ,'balance':m(sign*amount*(j+1))} for j,typ in enumerate(INCLUDED+EXCLUDED)]
    invested=sign*amount*28
    def check():
        total=sum(Fraction(a['balance']) for a in p['accounts'])
        excluded=sum(Fraction(a['balance']) for a in p['accounts'][7:])
        eq(total-excluded,Fraction(invested))
        return f'all signed balances minus cash/property/529/liabilities = {m(invested)}; included index sum 1+2+3+4+5+6+7=28'
    add('invested-buckets',i,{'invested':m(invested)},'Projection README bucket map: taxable+deferred+free; cash excluded; insurance cash value is deferred. Signed assets retain their sign; no ownership percentage is assumed.',check,plan=p,params={'today':'2026-01-01'})


for i in range(100):
    own=varied(i);employer=D((i%8)*100);income=D(100000+i*311);cost=D(30000+i*101)
    if i>=60:income,cost=[(D(0),D(1000)),(D(60000),D(60000)),(D(50000),D(20000)),(D(1),D(0)),(D(0),D(0))][i%5]
    p=base();saving=savings(p,own,employer,income,cost);left=max(D(0),income-cost)
    def check():
        alternative=max(own,left)+employer
        eq(alternative,saving)
        return f'case split reduces to max(own={m(own)}, positive surplus={m(left)})+employer {m(employer)}={m(saving)}'
    add('saving-no-double-count',i,{'savingYearly':m(saving)},f'README: own {m(own)}+employer {m(employer)}+max(0,surplus {m(left)}-own)={m(saving)}; invented annual incomes/costs.',check,plan=p,params={'today':'2026-12-31'})


for i in range(100):
    stocks=D(i%11)/10;stock=D(['.07','.1','0','-.2','.001'][i%5]);bond=D(['.04','.01','0','-.05'][i%4]);inflation=D(['.03','0','.1','-.02','.000001'][i%5])
    rr=real(stocks,stock,bond,inflation);nominal=stocks*stock+(1-stocks)*bond
    p=base(stocks=stocks,stock=stock,bond=bond,inflation=inflation)
    def check():
        rational=(Fraction(nominal)-Fraction(inflation))/(1+Fraction(inflation))
        assert abs(float(rational)-float(rr))<1e-15
        return f'alternative excess-over-inflation fraction (nominal-inflation)/(1+inflation)={r(rr)}'
    add('real-return',i,{'realReturn':r(rr)},f'README: nominal={r(stocks)}x{r(stock)}+(1-{r(stocks)})x{r(bond)}={r(nominal)}; purchasing-power ratio (1+nominal)/(1+inflation)-1={r(rr)}.',check,plan=p,params={'today':'2026-01-01'})


for mode in ['positive','zero','negative']:
    for i in range(100):
        pot=D((i%13)*13000);saving=D((i%7)*3000);rr=D('.05') if mode=='positive' else D(0) if mode=='zero' else D('-.02')
        if i>=60:
            pot=[D(0),D(300000),D('299999.99'),D(300001),D(-1000)][i%5]
            saving=[D(0),D(1),D(10000),D(300000),D(4000)][i%5]+D(i-60)/100
        if i>=90:pot=varied(i);saving=D(i-89)*D('0.01')
        year=2026 if i<60 else 2056
        p=base(invested=pot,year=year,stocks=1,stock=rr,bond=rr,inflation=0);savings(p,saving)
        target=D(300000);n=years(pot,saving,rr,target)
        expected={'yearsToFi':n,'fiAge':None if n is None else 40+n,'fiYear':None if n is None else year+n,'savingYearly':m(saving),'realReturn':r(rr)}
        def check():return check_years(pot,saving,rr,target,n)
        add('years-'+mode+'-return',i,expected,f'README end-of-year saving; closed value P(1+r)^n+S((1+r)^n-1)/r, or P+nS when r=0; first crossing within80 is {n}. Invented values.',check,plan=p,params={'today':f'{year}-01-01'})


for i in range(100):
    monthly=D(400+i*100);target=monthly*300;desired=[0,1,79,80,81][i%5]
    saving=target/D(desired) if desired in [1,80] else D(1000)
    saving=saving.quantize(D('.01'))
    pot=target-saving*desired
    if desired==0:pot=target
    n=desired if desired<=80 else None
    p=base(monthly,pot,stock=0,bond=0,inflation=0);savings(p,saving)
    def check():
        needed=max(D(0),(target-pot)/saving)
        eq(needed,D(desired));return f'zero-return inversion ceil((target-pot)/saving)={desired}; cutoff includes80 and excludes81'
    add('eighty-year-boundary',i,{'yearsToFi':n,'fiYear':None if n is None else 2026+n},'README search stops after80 future annual deposits; already at target gives0; invented exact-dollar boundary.',check,plan=p,params={'today':'2026-01-01'})


for i in range(100):
    year=[2026,2056,2100][i%3];age=[25,49,50,64,65,66,90][i%7];retire=[55,65,70][i%3]+i//42
    birthday='02-29' if (year-age)%4==0 and (year-age)%100!=0 else '12-31'
    p=base(invested=300000,year=year,age=age,retire=retire);p['household']['people'][0]['birthDate']=f'{year-age}-{birthday}'
    if i%2:p['household']['people'].insert(0,adult(year,30,60,'b','partner'))
    ytr=max(0,retire-age)
    def check():
        eq(sum(1 for y in range(year-age+1,year+1)),age)
        return f'calendar anniversaries={age}; retirement gap max(0,{retire}-{age})={ytr}; self chosen before listed partner'
    add('age-year-retirement',i,{'age':age,'retireAge':retire,'yearsToRetire':ytr,'yearsToFi':0,'fiAge':age,'fiYear':year},'Calendar-year age convention (not birthday age); self is primary; negative years to retirement clamp to0. Includes leap births, start/end dates, and two adults.',check,plan=p,params={'today':f'{year}-'+('01-01' if i%2 else '12-31')})


for i in range(100):
    n=[0,1,5,20,30,60,100][i%7];rr=D(['.05','0','-.02','.01'][i%4]);pot=varied(i)*100
    p=base(invested=pot,age=30,retire=30+n,stock=rr,bond=rr,inflation=0)
    with localcontext() as ctx:
        ctx.prec=60;coast=D(300000)/(1+rr)**n
    def check():
        grown=Fraction(str(coast))*((1+Fraction(rr))**n)
        assert abs(float(grown)-300000)<1e-8
        return f'coast capital compounded for{n} years restores300000; no contributions are included; growth factor={(1+rr)**n}'
    add('coast',i,{'coast':{'number':m(coast),'reached':pot>=coast},'yearsToRetire':n},f'README coast number=300000/(1+{r(rr)})^{n}={m(coast)}; compare invested {m(pot)}. Invented values.',check,plan=p,params={'today':'2026-01-01'})


for i in range(100):
    target=D(1000+i)*300
    pot=varied(i)*100 if i<60 else [D(-1),D(0),D('.01'),target-D('.01'),target,target+D('.01')][i%6] if i<90 else varied(i)*100
    progress=min(D(1),pot/target);gap=max(D(0),target-pot);p=base(monthly=1000+i,invested=pot)
    def check():
        eq(Fraction(gap),Fraction(target-min(pot,target)))
        assert abs(float(Fraction(progress)-min(Fraction(1),Fraction(pot)/Fraction(target))))<1e-24
        return f'gap=target-min(pot,target)={m(gap)}; progress capped at100%; signed balance permits negative progress'
    add('progress-gap',i,{'progress':r(progress),'gap':m(gap)},'Application display conventions: progress=min(1,invested/FI); gap=max(0,FI-invested). They do not turn negative balances into zero.',check,plan=p,params={'today':'2026-12-31'})


for i in range(100):
    income=D((i+1)*1000) if i<60 else [D(0),D(-1),D(1),D(100),D(10000)][i%5]
    own=D((i%7)*3000);employer=D(i%3)*100;expenses=D(1000)
    p=base();saved=savings(p,own,employer,income,expenses)
    ratio=min(D(1),saved/income) if income>0 else None
    def check():
        if income>0:assert abs(ratio*income-min(income,saved))<D('1e-20')
        else:eq(ratio,None)
        return f'positive income: capped saved dollars / income; saved={m(saved)}, income={m(income)}, result={ratio}; nonpositive income gives null'
    add('savings-rate',i,{'savingYearly':m(saved),'savingsRate':None if ratio is None else r(ratio),'hasIncome':income!=0},'Application savings-rate convention: min(1,saving/income) for positive income; null for zero/negative income; hasIncome is nonzero annual income.',check,plan=p,params={'today':'2026-01-01'})


for i in range(100):
    p=base();p['retirement'].pop('spendingMonthly')
    if i%3==0:p['expenses']=[]
    elif i%3==1:p['expenses']=[{'id':'e','name':'One-off','category':'other','period':'once','amount':m(varied(i))}]
    else:p['expenses']=[{'id':'e','name':'Ended','category':'other','period':'monthly','amount':m(varied(i)),'endDate':'2025-12-31'}]
    def check():return 'no active recurring expense and no positive typed spending: annual spend=0, so FI division is not attempted'
    evaluation=(date(2026,1,1)+timedelta(days=i)).isoformat()
    add('missing-spending',i,{'ready':False,'missing':{'length':1}},'README requires spending; one-off/ended/empty costs supply no current recurring spending. Invented inputs and differing evaluation dates.',check,plan=p,params={'today':evaluation})


for i in range(100):
    monthly=varied(i);p=base(monthly=99999)
    if i%2:p['household']['people']=[]
    else:p['accounts']=[]
    p['expenses']=[{'id':'e','name':'Example living costs','category':'other','amount':m(monthly),'period':'monthly'}]
    annual=monthly*12
    def check():eq(Fraction(annual),sum([Fraction(monthly)]*12));return f'incomplete projection inputs; expense fallback 12 monthly costs={m(annual)}; inaccessible investment buckets contribute0'
    add('incomplete-plan-fallback',i,{'ready':True,'spendingYearly':m(annual),'invested':'0.00','fiNumber':m(annual/D('.04'))},'Application fallback: when projection inputs are incomplete, active Expenses supply spending and invested defaults0, even if retirement spending was typed.',check,plan=p,params={'today':'2056-12-31'})


for i in range(100):
    monthly=varied(i);p=base(monthly=0);annual=monthly*12
    p['expenses']=[{'id':'e','name':'Example costs','category':'other','amount':m(monthly),'period':'monthly'}]
    if i%2:p['household']['people'].append(adult(2026,38,65,'b','partner'))
    def check():eq(Fraction(annual),Fraction(monthly)*4*3);return f'four quarters each of three monthly costs = {m(annual)}; no positive typed override'
    add('expense-spending-source',i,{'ready':True,'spendingYearly':m(annual),'fiNumber':m(annual/D('.04'))},'README spending may come from current expenses when no positive retirement figure exists; invented individual/family living costs.',check,plan=p,params={'today':'2026-12-31'})


for i in range(100):
    monthly=varied(i);invested=varied(99-i)*10;year=2026 if i%2==0 else 2056
    age=30+i%36;p=base(monthly,invested,year=year,age=age)
    if i%2:p['household']['people'].append(adult(year,32+i%29,65,'b','partner'))
    p.pop('assumptions');p['retirement'].pop('stocksNow');p['retirement'].pop('withdrawalRate')
    p['household']['people'][0].pop('retirementAge')
    rr=real('.7','.07','.04','.03');target=monthly*300
    def check():
        alternative=Fraction(31,1030)
        assert abs(float(alternative)-float(rr))<1e-15
        eq(Fraction(target)/25,Fraction(monthly)*12)
        return f'default blend=.061; real=(.061-.03)/1.03=31/1030; target/25={m(target/25)}=monthly {m(monthly)}x12'
    add('default-assumptions',i,{'realReturn':r(rr),'retireAge':65,'withdrawalRate':'0.040000','fiNumber':m(target),'invested':m(invested),'yearsToRetire':max(0,65-age)},
        'Application defaults, not forecasts: stock weight .7, stocks .07, bonds .04, inflation .03, retirement65, withdrawal .04. Varying spending/balances/age/household/year; algebra worked in second checks.',check,plan=p,params={'today':f'{year}-'+('12-31' if i%3 else '01-01')})


PERIOD_COUNTS={'weekly':52,'biweekly':26,'semimonthly':24,'monthly':12,'quarterly':4,'annual':1,'once':0,'unknown':12}
for i in range(100):
    period=list(PERIOD_COUNTS)[i%8];factor=PERIOD_COUNTS[period]
    amount=varied(i);today=date.fromisoformat(['2026-01-01','2028-02-29','2056-12-31'][i%3])
    day_delta=[-1,0,1][i%3]
    # Start and end on either side of the tested date; independently count dates
    # inside the inclusive calendar interval rather than duplicating activeOn.
    start=today+timedelta(days=day_delta);end=today+timedelta(days=2)
    active=today in [start+timedelta(days=n) for n in range((end-start).days+1)]
    inc=amount*factor if active else D(0)
    p=base();p['income']=[{'id':'i','name':'Example pay','type':'salary','amount':m(amount),'period':period,'startDate':start.isoformat(),'endDate':end.isoformat()}]
    p['expenses']=[{'id':'e','name':'Example costs','category':'other','amount':'1000.00','period':'annual'}]
    saved=max(D(0),inc-D(1000))
    def check():
        repeated=sum((Fraction(amount) for _ in range(factor)),Fraction()) if active else Fraction()
        eq(repeated,Fraction(inc))
        return f'inclusive interval contains today={active}; {factor} rational period amounts total {m(inc)}; subtract1000 and floor at0 gives {m(saved)}'
    add('income-period-dates',i,{'savingYearly':m(saved),'hasIncome':inc!=0},
        'Recurring cash-flow convention: 52/26/24/12/4/1 periods, one-off0, unknown monthly. Inclusive start/end dates; leap-day and year boundaries. Invented values.',check,plan=p,params={'today':today.isoformat()})


if __name__=='__main__':
    counts=Counter((row['rule'],row['kind']) for row in ROWS)
    for rule in {row['rule'] for row in ROWS}:
        eq([counts[rule,k] for k in ['grid','edge','extreme']],[60,30,10])
        inputs=[tuple(sorted((k,v) for k,v in row.items() if k.startswith(('plan.','params.','arg.')))) for row in ROWS if row['rule']==rule]
        eq(len(set(inputs)),100)
    eq(sum('SECOND CHECK:' in row['note'] for row in ROWS),len(ROWS)//10)
    print(f'{write_page("fire",ROWS)}: {len(ROWS)} cases, {len(counts)//3} rules, {len(ROWS)//10} enforced independent checks')
