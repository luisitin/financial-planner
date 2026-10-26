"""Independent tax equations and withdrawal feasibility solver for golden data.

No application imports. Source: IRS Rev. Proc. 2025-32 sections4.01,4.03,4.14
https://www.irs.gov/irb/2025-45_IRB ; IRS Pub915 Worksheet1; IRC151(d)(5)(C)
and IRS Schedule1-A (senior phaseout per eligible individual); IRS NIIT FAQ.
This intentionally keeps the source-year deduction exact and disallows the
senior deduction for married-separate returns.
"""
from decimal import Decimal, ROUND_HALF_UP, getcontext
from math import prod
getcontext().prec=45
D=lambda x:Decimal(str(x))
ZERO=D(0)
RATES=list(map(D,['.10','.12','.22','.24','.32','.35','.37']))
STATUSES=['single','married_joint','married_separate','head_of_household','qualifying_surviving']
# Each row is ordinary bracket ceilings; standard deduction; age allowance;
# zero and15-percent capital-gains ceilings. Transcribed from IRS2025-32.
PUBLISHED={
 'single':([12400,50400,105700,201775,256225,640600],16100,2050,[49450,545500]),
 'married_joint':([24800,100800,211400,403550,512450,768700],32200,1650,[98900,613700]),
 'married_separate':([12400,50400,105700,201775,256225,384350],16100,1650,[49450,306850]),
 'head_of_household':([17700,67450,105700,201750,256200,640600],24150,2050,[66200,579600]),
 'qualifying_surviving':([24800,100800,211400,403550,512450,768700],32200,1650,[98900,613700])}
# Sources: RevProc2024-40 ordinary tables; amended2025 standard amounts at
# https://www.irs.gov/newsroom/working-families-tax-cuts-individuals-and-workers .
STANDARD_2025={'single':15750,'married_joint':31500,'married_separate':15750,'head_of_household':23625,'qualifying_surviving':31500}
ORDINARY_2025={
 'single':[11925,48475,103350,197300,250525,626350],
 'married_joint':[23850,96950,206700,394600,501050,751600],
 'married_separate':[11925,48475,103350,197300,250525,375800],
 'head_of_household':[17000,64850,103350,197300,250500,626350],
 'qualifying_surviving':[23850,96950,206700,394600,501050,751600]}
CAPITAL_2025={'single':[48350,533400],'married_joint':[96700,600050],'married_separate':[48350,300000],'head_of_household':[64750,566700],'qualifying_surviving':[96700,600050]}

def cents(x):return format(D(x).quantize(D('.01'),rounding=ROUND_HALF_UP),'.2f')
def six(x):return format(D(x).quantize(D('.000001'),rounding=ROUND_HALF_UP),'.6f')
def nonneg(x):return max(ZERO,D(x))
def nearest(x,unit):return (D(x)/unit).quantize(D(1),rounding=ROUND_HALF_UP)*unit

def tax_parameters(year=2026,inflation='0.03',status='single'):
    status=status if status in PUBLISHED else 'single'
    b,std,extra,cap=PUBLISHED[status]
    if year==2025:
        b=ORDINARY_2025[status];std=STANDARD_2025[status];cap=CAPITAL_2025[status]
        extra=2000 if status in ['single','head_of_household'] else 1600
    growth=(1+D(inflation))**max(0,year-2026)
    # Future indexing is the documented hypothetical model, not enacted brackets.
    if year>2026:
        b=[nearest(x*growth,25) for x in b];std=nearest(std*growth,50);extra=nearest(extra*growth,50);cap=[nearest(x*growth,50) for x in cap]
    return {'year':year,'status':status,'tops':list(map(D,b)),'standard':D(std),'extra':D(extra),'capital':list(map(D,cap))}

def ordinary(taxable,p):
    """Integral of the piecewise-constant statutory marginal rate function."""
    x=nonneg(taxable); limits=[ZERO]+p['tops']+[D('Infinity')]
    widths=[max(ZERO,min(x,hi)-lo) for lo,hi in zip(limits,limits[1:])]
    tax=sum((a*r for a,r in zip(widths,RATES)),ZERO)
    k=next((j for j,hi in enumerate(p['tops']) if x<=hi),6)
    return {'tax':tax,'bracketRate':RATES[k],'roomInBracket':limits[k+1]-x,'nextRate':RATES[min(k+1,6)]}

def ordinary_second(x,p):
    # Independent method: top-bracket formula T(base)+rate*(x-base).
    x=nonneg(x); below=ZERO;base=ZERO
    for j,cap in enumerate(p['tops']+[D('Infinity')]):
        if x<=cap:return below+RATES[j]*(x-base)
        below += (cap-base)*RATES[j];base=cap

def qualified(o,q,p):
    o=nonneg(o);q=nonneg(q);first,second=p['capital']
    # Difference of antiderivatives computes the stacked interval's tax.
    primitive=lambda x:D('.15')*max(ZERO,min(x,second)-first)+D('.20')*max(ZERO,x-second)
    return primitive(o+q)-primitive(o)

def social(benefits,other,exempt,status):
    b=nonneg(benefits);combined=nonneg(other)+nonneg(exempt)+b/2
    lower,upper=(D(32000),D(44000)) if status=='married_joint' else (D(25000),D(34000))
    if combined<=lower:return ZERO
    if combined<=upper:return min(b/2,(combined-lower)/2)
    return min(D('.85')*b,D('.85')*(combined-upper)+min(b/2,(upper-lower)/2))

def tax(ordinary_income=0,qualified_income=0,benefits=0,*,year=2026,inflation='0.03',status='single',seniors=0,itemized=0,exempt=0):
    p=tax_parameters(year,inflation,status);status=p['status']
    o=nonneg(ordinary_income);q=nonneg(qualified_income);b=nonneg(benefits)
    ss=social(b,o+q,exempt,status);agi=o+q+ss
    standard=p['standard']+D(seniors)*p['extra']
    senior=ZERO
    if 2025<=year<=2028 and seniors and status!='married_separate':
        threshold=D(150000) if status=='married_joint' else D(75000)
        senior=D(seniors)*max(ZERO,D(6000)-D('.06')*max(ZERO,agi-threshold))
    ded=max(nonneg(itemized),standard)+senior
    taxable=max(ZERO,agi-ded);q_tax=min(q,taxable);o_tax=taxable-q_tax
    ot=ordinary(o_tax,p);qt=qualified(o_tax,q_tax,p)
    niit_threshold=D(250000) if status in ['married_joint','qualifying_surviving'] else D(125000) if status=='married_separate' else D(200000)
    niit=D('.038')*min(q,max(ZERO,agi-niit_threshold))
    total=D(cents(ot['tax']+qt+niit))
    return {'totalTax':total,'taxableIncome':taxable,'ordinaryTaxable':o_tax,'qualifiedTaxable':q_tax,'ordinaryTax':ot['tax'],'qualifiedTax':qt,'niit':niit,'bracketRate':ot['bracketRate'],'agi':agi,
            'deduction':{'standard':standard,'senior':senior,'amount':ded},'income':{'taxableSocialSecurity':ss,'ordinary':o,'qualified':q},'params':p}

ORDERS={'taxable-first':['taxable','deferred','free'],'deferred-first':['deferred','taxable','free'],'roth-last-taxable':['deferred','free','taxable'],'roth-first':['free','taxable','deferred']}
FACTOR_DATA='27.4 26.5 25.5 24.6 23.7 22.9 22.0 21.1 20.2 19.4 18.5 17.7 16.8 16.0 15.2 14.4 13.7 12.9 12.2 11.5 10.8 10.1 9.5 8.9 8.4 7.8 7.3 6.8 6.4 6.0 5.6 5.2 4.9 4.6 4.3 4.1 3.9 3.7 3.5 3.4 3.3 3.1 3.0 2.9 2.8 2.7 2.5 2.3 2.0'
FACTORS={72+i:D(v) for i,v in enumerate(FACTOR_DATA.split())}
def rmd_start(birthyear):return 75 if birthyear>=1960 else 73 if birthyear>=1951 else 72

def make_plan(year=2026,age=64,years=1,balances=None,spending=12000,status='single',inflation='0',growth='0',pension=0,tax_mode='brackets',order=None):
    balances=balances or {'deferred':100000}
    types={'cash':'checking','taxable':'brokerage','deferred':'ira','free':'roth'}
    people=[{'id':'p1','name':'Example Adult','birthDate':f'{year-age}-01-01','role':'self','retirementAge':age,'lifeExpectancy':age+years-1}]
    if status=='married_joint':people.append({'id':'p2','name':'Example Partner','birthDate':f'{year-age}-01-01','role':'partner','retirementAge':age,'lifeExpectancy':age+years-1})
    plan={'household':{'people':people,'filingStatus':status},'accounts':[{'id':k,'name':'Example '+k,'type':types[k],'balance':cents(v),'ownerId':'p1'} for k,v in balances.items()],
          'retirement':{'spendingMonthly':cents(D(spending)/12),'taxMode':tax_mode,'taxRate':'0.150000','stocksNow':'0.000000','stocksRetired':'0.000000','gainShare':'0.500000','dividendYield':'0.000000'},
          'assumptions':{'inflation':six(inflation),'returnStocks':six(growth),'returnBonds':six(growth),'returnCash':six(growth),'salaryGrowth':'0.000000'}}
    if pension:plan['retirement']['pensions']=[{'personId':'p1','monthly':cents(D(pension)/12),'startAge':age,'cola':True}]
    if order is not None:plan['retirement']['withdrawalOrder']=order
    return plan

def run(plan,year,order=None,conversion_rate=None,until=None):
    """Independent constrained cash-flow solution; withdrawal total is bisected.

    For a proposed gross draw, allocate it in order, compute its tax from IRS
    functions, and require net proceeds >= spending. This is a feasibility root,
    not a translation of the production engine's repeated tax top-ups.
    """
    rt=plan['retirement'];ass=plan['assumptions'];status=plan['household']['filingStatus'];adults=plan['household']['people']
    origin=year;birth=int(adults[0]['birthDate'][:4]);last=max(int(p['birthDate'][:4])+p['lifeExpectancy'] for p in adults)
    mapping={'checking':'cash','brokerage':'taxable','ira':'deferred','roth':'free'}
    buckets={k:ZERO for k in ['cash','taxable','deferred','free']}
    for a in plan['accounts']:buckets[mapping[a['type']]]+=D(a['balance'])
    order=['cash']+list(order or rt.get('withdrawalOrder') or ORDERS['taxable-first'])
    order=list(dict.fromkeys(order+['taxable','deferred','free']))
    growth=D(ass['returnStocks']);infl=D(ass['inflation']);spending=D(rt['spendingMonthly'])*12;birthyear=int(adults[0]['birthDate'][:4])
    pension=sum((D(p['monthly'])*12 for p in rt.get('pensions',[])),ZERO)
    result=[];fail=None
    for n,cy in enumerate(range(origin,last+1)):
        price=(1+infl)**n;age=cy-birth;seniors=sum(cy-int(p['birthDate'][:4])>=65 for p in adults)
        inc=pension*price;need=max(ZERO,(spending-pension)*price)
        mandatory=buckets['deferred']/FACTORS[min(120,age)] if age>=rmd_start(birthyear) and buckets['deferred']>0 else ZERO
        opening=dict(buckets);opening['deferred']-=mandatory
        qdiv=buckets['taxable']*D(rt['dividendYield']);gainshare=D(rt['gainShare'])
        def solution(gross,convert=ZERO):
            available=dict(opening);available['deferred']-=convert;available['free']+=convert
            w={k:ZERO for k in buckets};w['deferred']=mandatory;left=gross
            for kind in order:
                take=min(max(ZERO,available[kind]),left);available[kind]-=take;w[kind]+=take;left-=take
            tax_result=tax(inc+w['deferred']+convert,w['taxable']*gainshare+qdiv,year=cy,inflation=infl,status=status,seniors=seniors)
            return sum(w.values())-tax_result['totalTax']-need,available,w,tax_result
        def settle(convert=ZERO):
            maximum=sum(opening.values());lo=ZERO;hi=maximum
            at_zero=solution(0,convert)
            if at_zero[0]>=0:return at_zero
            # Cash is tax-neutral. If it covers the whole deficiency, the
            # linear feasibility segment has its exact root at minus f(0).
            exact_cash_root=-at_zero[0]
            if opening['cash']>=exact_cash_root:return solution(exact_cash_root,convert)
            if solution(hi,convert)[0]<0:return solution(hi,convert)
            for _ in range(95):
                mid=(lo+hi)/2
                if solution(mid,convert)[0]>=0:hi=mid
                else:lo=mid
            return solution(hi,convert)
        free_cash,ending,withdrawals,tx=settle();conversion=ZERO
        if conversion_rate is not None and age<rmd_start(birthyear) and (until is None or age<until) and free_cash>=D('-.005'):
            top=tax_parameters(cy,infl,status)['tops'][RATES.index(D(conversion_rate))]
            # Documented order matters: initial spending withdrawals are settled
            # before a conversion. Hold them fixed and solve only for the extra
            # tax funding caused by the proposed conversion.
            settled_balances=dict(ending);settled_draws=dict(withdrawals)
            base_tax=tx['totalTax'];base_surplus=free_cash
            def conversion_trial(c):
                pool=dict(settled_balances);pool['deferred']-=c;pool['free']+=c
                def extra_trial(gross):
                    avail=dict(pool);draws=dict(settled_draws);left=gross
                    for kind in order:
                        take=min(max(ZERO,avail[kind]),left);avail[kind]-=take;draws[kind]+=take;left-=take
                    info=tax(inc+draws['deferred']+c,draws['taxable']*gainshare+qdiv,year=cy,inflation=infl,status=status,seniors=seniors)
                    gap=gross+base_surplus-(info['totalTax']-base_tax)
                    return gap,avail,draws,info
                baseline=extra_trial(ZERO)
                if baseline[0]>=0:return baseline
                if pool['cash']>=-baseline[0]:return extra_trial(-baseline[0])
                low=ZERO;high=sum(pool.values())
                if extra_trial(high)[0]<0:return extra_trial(high)
                for _ in range(75):
                    middle=(low+high)/2
                    if extra_trial(middle)[0]>=0:high=middle
                    else:low=middle
                return extra_trial(high)
            lo=ZERO;hi=settled_balances['deferred']
            # Maximum feasible conversion under taxable-income target.
            for _ in range(80):
                mid=(lo+hi)/2;trial=conversion_trial(mid)
                if trial[0]>=D('-.000000001') and trial[3]['taxableIncome']<=top:lo=mid
                else:hi=mid
            conversion=lo
            # The independent legal/model rule has no $1 minimum. Eliminate
            # only binary-search dust, and recover an exact exhausted balance.
            if abs(conversion-settled_balances['deferred'])<D('.000000001'):
                conversion=settled_balances['deferred']
            if conversion>D('.000000001'):free_cash,ending,withdrawals,tx=conversion_trial(conversion)
            else:conversion=ZERO
        if free_cash < D('-.005') and fail is None:fail=cy
        ending['taxable']+=max(ZERO,free_cash)
        buckets={k:v*(1+growth) for k,v in ending.items()}
        total=sum(buckets.values());after=total-buckets['deferred']*tx['bracketRate']
        result.append({'year':cy,'age':age,'price':price,'rmd':mandatory,'taxes':tx['totalTax'],'conversion':conversion,'tax':tx,'balances':buckets,'total':total,'after':after,'withdrawals':withdrawals,'residual':free_cash})
    return {'rows':result,'success':fail is None,'failYear':fail,'endBalanceReal':result[-1]['total']/result[-1]['price'],'endAfterTaxReal':result[-1]['after']/result[-1]['price'],'endTaxRate':result[-1]['tax']['bracketRate'],
            'taxesReal':sum((x['taxes']/x['price'] for x in result),ZERO),'rmdReal':sum((x['rmd']/x['price'] for x in result),ZERO),'totalConvertedReal':sum((x['conversion']/x['price'] for x in result),ZERO)}

def check_run(result,plan):
    """Second method: ledger conservation and inverse tax arithmetic per year."""
    initial=sum((D(a['balance']) for a in plan['accounts']),ZERO);g=D(plan['assumptions']['returnStocks']);spend=D(plan['retirement']['spendingMonthly'])*12
    pension=sum((D(p['monthly'])*12 for p in plan['retirement'].get('pensions',[])),ZERO)
    for x in result['rows']:
        t=x['tax'];assert abs(ordinary_second(t['ordinaryTaxable'],t['params'])-t['ordinaryTax'])<D('.00000001')
        if x['residual']>=D('-.005'):
            expected=(initial-max(ZERO,spend-pension)*x['price']-x['taxes'])*(1+g)
            assert abs(expected-x['total'])<D('.00001'),(expected,x['total'])
        initial=x['total']
    return 'SECOND: piecewise base-plus-marginal tax and independent annual conservation opening-minus-net-spending-minus-tax, then growth, agree'
