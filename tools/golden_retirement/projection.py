"""Independent answer key from the projection brief, not from application code.

Expectations use geometric sums, present values and direct cash conservation.
No repository modules or data are imported. All plan figures are invented.
"""
from copy import deepcopy
from decimal import Decimal, getcontext
import json
import math
from common import case, write_page, money, rate, ROOT

getcontext().prec = 50
ROWS = []
CHECKS = []
S = 'README projection model; worked geometric-series / cash-conservation example'

def geo(a, b, n):
    return sum(a ** j * b ** (n - 1 - j) for j in range(n))

def engine(year=2026, n=1, balance=100000, spending=1200):
    return dict(startYear=year, endYear=year+n-1, retireYear=year,
                people=[dict(name='Example A', birthYear=year-60, retireAge=60, endAge=59+n)],
                balances=dict(cash=0, taxable=balance, deferred=0, free=0),
                contributions=[], incomes=[], spending=dict(yearly=spending),
                rates=dict(inflation=0, cash=0, salaryGrowth=0, taxRate=0,
                           stocksNow=0.5, stocksRetired=0.5),
                returns=dict(stocks=0, bonds=0), rmd=None, strategy='fixed-real', withdrawalRate=0.04)

def plan(year=2026, balance=100000, monthly=100):
    return dict(household=dict(people=[dict(id='a', name='Example A', role='self', birthDate=f'{year-60}-12-31', retirementAge=60, lifeExpectancy=62)],filingStatus='single'),
                accounts=[dict(id='x', name='Example fund', type='brokerage', balance=money(balance),ownerId='a')],
                retirement=dict(spendingMonthly=money(monthly),taxRate=0,stocksNow=0.5,stocksRetired=0.5),
                assumptions=dict(inflation=0,returnStocks=0,returnBonds=0,returnCash=0,salaryGrowth=0))

def add(rule, i, expect, *, inputs=None, p=None, params=None, args=None, target='project', note='', second=None, todo=''):
    if (i+1)%10 == 0:
        assert second is not None, (rule, i)
        description, left, right, tolerance = second
        assert abs(left-right) <= tolerance, (rule, i, left, right)
        description += f'; left={left:.12g}; right={right:.12g}; residual={abs(left-right):.3g}'
        CHECKS.append(dict(rule=rule,row=i+1,method=description))
        note += '; second: ' + description
    ROWS.append(case('projection',rule,i,target,expect,inputs=inputs,plan=p,params=params,args=args,note=S+'; '+note,todo=todo))

def values(i):
    # 60 realistic grid; 30 boundary cases; 10 large/small/long cases.
    year = 2026+i%31
    n = 1+i%30 if i<60 else [1,2,3,30,31][i%5] if i<90 else [1,2,40,80,100][i%5]
    b = [20000,100000,500000,2000000,10000,900000][i%6]+i*531.27 if i<60 else [0,0.01,1,1200,12000,100000][i%6] if i<90 else [0.01,1e9,1e10,100,1e8][i%5]
    s = [120,1200,12000,24000,36000,48000][i%6]+12*i if i<60 else [0,0.01,1,1200,12000][i%5] if i<90 else [0.01,1e6,1e7,0,1][i%5]
    return year,n,b,s

for i in range(100):
    year,n,b,s=values(i)
    # Account mapping/sign/exclusions, including a family and unknown account kind.
    p=plan(year,b)
    types=['checking','savings','cash','brokerage','crypto','401k','ira','cash_value_life','roth','hsa','property','vehicle','529','loan','other_asset']
    amounts=[round((j+1)*b/10,2) for j in range(len(types))]
    if i%3==0: amounts[0]=-amounts[0]
    p['accounts']=[dict(id=f'x{j}',name=f'Example {j}',type=t,balance=money(v),ownerId='a') for j,(t,v) in enumerate(zip(types,amounts))]
    sums={k:sum(amounts[j] for j in js) for k,js in [('cash',[0,1,2]),('taxable',[3,4]),('deferred',[5,6,7]),('free',[8,9])]}
    add('account-buckets',i,{'ready':True,'inputs':{'balances':{k:money(v) for k,v in sums.items()}}},p=p,params={'today':f'{year}-01-01'},target='compute',second=('independent all-included sum',sum(sums.values()),sum(amounts[:10]),0.001))

    # Calendar-year horizon and primary selection; no birthday fraction in yearly engine.
    p=plan(year,b)
    p['household']['people']=[dict(id='child',name='Example child',role='dependent',birthDate=f'{year-10}-02-28'),dict(id='b',name='Example B',role='partner',birthDate=f'{year-55}-02-28',retirementAge=63,lifeExpectancy=66),p['household']['people'][0]]
    p['household']['people'][2]['retirementAge']=60+i%4
    p['household']['people'][2]['lifeExpectancy']=65+i%10
    end=max(year-55+66,year-60+65+i%10)
    startret=year+i%4
    add('calendar-horizon',i,{'inputs':{'startYear':year,'endYear':end,'retireYear':startret,'people':{'0':{'id':'a'},'1':{'id':'b'}}},'rows':{'length':end-year+1},'yearsInRetirement':end-startret+1},p=p,params={'today':f'{year}-12-31'},target='compute',second=('inclusive calendar subtraction',end-year+1,len(range(year,end+1)),0))

    # Expenses annualization / explicit override.
    p=plan(year,b,100)
    mult=[52,26,24,12,4,1,0][i%7]; per=['weekly','biweekly','semimonthly','monthly','quarterly','annual','once'][i%7]
    amount=round(max(0.01,s)/12,2); explicit=i%3==0
    p['expenses']=[dict(id='e',name='Example expense',category='other',amount=money(amount),period=per)]
    if not explicit: p['retirement']['spendingMonthly']=0
    annual=1200 if explicit else amount*mult
    expected={'ready':annual>0}
    if annual>0: expected.update(spendingYearly=money(annual),spendingSource='typed' if explicit else 'expenses')
    add('spending-source',i,expected,p=p,params={'today':f'{year}-01-01'},target='compute',second=('period sum / explicit monthly sum',annual,sum([100]*12) if explicit else sum([amount]*mult),0.001))

    # Growth on contributions before each person's retirement. No market return.
    c=max(0.01,round(s/12,2)); g=[0,0.01,0.03,-0.02][i%4]; h=min(n,10); work=i%h+1
    inp=engine(year,h,b,0); inp['retireYear']=year+work; inp['rates']['salaryGrowth']=rate(g)
    inp['people'][0]['retireAge']=60+work
    inp['contributions']=[dict(bucket='taxable',yearly=money(c),personIndex=0)]
    total=c*geo(1+g,1,work); endb=b+total
    add('contribution-growth',i,{'endBalance':money(endb),'totalWithdrawn':'0.00','rows':{str(work-1):{'contributions':money(c*(1+g)**(work-1))}}},inputs=inp,second=('contribution annuity closed form',total,c*work if g==0 else c*((1+g)**work-1)/g,max(0.001,abs(total)*1e-12)))

    # Pension inclusive start/end and COLA. Withdrawals offset income one for one.
    inp=engine(year,3,max(b,10*s+100),s)
    f=[0,0.02,0.05,-0.01][i%4]; inc=round(s/3,2); cola=i%2==0
    inp['rates']['inflation']=rate(f)
    inp['incomes']=[dict(name='Example pension',yearly=money(inc),personIndex=0,startAge=61,endAge=61,cola=cola,taxable=True)]
    amt=inc*(1+f) if cola else inc
    add('income-start-end-cola',i,{'rows':{'0':{'income':'0.00'},'1':{'income':money(amt),'incomeReal':money(amt/(1+f))},'2':{'income':'0.00'}}},inputs=inp,second=('deflation inverse',amt/(1+f)*(1+f),amt,max(0.001,abs(amt)*1e-12)))

    # Price level/real view with no withdrawals, portfolio return equals inflation.
    f=[0,0.01,0.03,-0.02][i%4]; inp=engine(year,n,b,0)
    inp['rates']['inflation']=rate(f); inp['returns']={'stocks':rate(f),'bonds':rate(f)}
    price=(1+f)**(n-1); endb=b*(1+f)**n
    add('price-level',i,{'rows':{str(n-1):{'priceLevel':rate(price),'total':money(endb),'totalReal':money(b*(1+f))}}},inputs=inp,second=('cancel price factors',endb/price,b*(1+f),max(0.001,abs(endb/price)*1e-12)))

    # Glide and expected returns, with unequal starting/ending allocations.
    h=3+i%5; j=i%h; a=[0,0.3,0.7,1][i%4]; z=[1,0.5,0.2,0][i%4]
    rs=[0.07,-0.2,0,0.15][i%4]; rb=[0.02,0.04,-0.1,0][i%4]
    inp=engine(year,h+1,b,0); inp['retireYear']=year+h-1
    inp['rates']['stocksNow']=rate(a);inp['rates']['stocksRetired']=rate(z)
    inp['returns']={'stocks':rate(rs),'bonds':rate(rb)}
    share=(a*(h-1-j)+z*j)/(h-1); ret=share*rs+(1-share)*rb
    add('glide-blend',i,{'rows':{str(j):{'stockShare':rate(share),'portfolioReturn':rate(ret)}}},inputs=inp,second=('bond base plus equity premium',ret,rb+share*(rs-rb),1e-12))

    # Whole-sequence overrides, cash return and year-specific inflation travel together.
    inp=engine(year,2,b,0); inp['balances']={'cash':money(b),'taxable':money(b),'deferred':0,'free':0}
    f=[-0.01,0,0.02,0.2][i%4]; a=0.05+i%4*0.01; c=-0.02+i%3*0.02
    opt={'sequence':[dict(stocks=rate(a),bonds=rate(a),cash=rate(c),inflation=rate(f)),dict(stocks=rate(-a/2),bonds=rate(-a/2),cash=rate(c),inflation=rate(f))]}
    expected=b*(1+c)**2+b*(1+a)*(1-a/2)
    row=case('projection','sequence-overrides',i,'project',{'endBalance':money(expected),'rows':{'1':{'priceLevel':rate(1+f)}}},inputs=inp,options=opt,note=S+'; two independent asset factors')
    if (i+1)%10==0:
        check=b*(1+2*c+c*c)+b*(1+a/2-a*a/2)
        assert abs(expected-check)<=max(0.001,b*1e-12)
        row['note']+=f'; second: polynomial expansion={check:.8f}'
        CHECKS.append({'rule':'sequence-overrides','row':i+1,'method':'polynomial expansion'})
    ROWS.append(row)

    # Closed-form fixed-real cashflow annuity with enough funds for entire horizon.
    h=n; f=[0,0.02,-0.01,0.03][i%4]; r=[0,0.05,0.03,-0.005][i%4]
    spend=max(0.01,min(s,100000)); cost=spend*(1+r)*geo(1+f,1+r,h)
    start=round((cost+max(b,100)) / (1+r)**h+100,2)
    inp=engine(year,h,start,spend);inp['rates']['inflation']=rate(f);inp['returns']={'stocks':rate(r),'bonds':rate(r)}
    endb=start*(1+r)**h-cost
    pv=sum(spend*(1+f)**j/(1+r)**j for j in range(h))
    add('fixed-real',i,{'success':True,'endBalance':money(endb),'rows':{str(h-1):{'spendingReal':money(spend)}}},inputs=inp,second=('present value of start-year withdrawals',endb/(1+r)**h,start-pv,max(0.002,abs(start)*1e-11)))

    # Constant-percent reinvestment has a closed product, including rate zero/one.
    w=[0.02,0.04,0.06,0.10][i%4] if i<60 else [0,0.000001,0.04,0.5,1][i%5]
    r=[0,0.03,-0.1,0.2][i%4]; inp=engine(year,n,b,s);inp['strategy']='percent';inp['withdrawalRate']=rate(w);inp['returns']={'stocks':rate(r),'bonds':rate(r)}
    q=(1-w)*(1+r); endb=b*q**n
    add('percent',i,{'success':True,'endBalance':money(endb),'rows':{'0':{'spending':money(b*w)}}},inputs=inp,second=('log product or zero branch',endb,0 if q==0 else b*math.exp(n*math.log(q)),max(0.002,abs(endb)*1e-10)))

    # Guardrails strict cut/raise boundaries, skip inflation after losing real return.
    spend=1200+12*i if i<60 else 1200 if i<90 else [0.01,120000,1200000,12,1200][i%5]
    w=0.04; threshold=[0.032,0.048,0.031999,0.048001,0.04][i%5]
    r=[0,0.01,-0.01,0.05,0][i%5]; f=[0,0.03,0.02,0.01,0.03][i%5]
    start=round(spend+spend/(threshold*(1+r)),2); total=(start-spend)*(1+r)
    q=spend/total if total>0 else 1
    secondSpend=spend*(0.9 if q>w*1.2 else 1.1 if q<w*0.8 else 1+f if r>=f else 1)
    inp=engine(year,2,start,spend);inp['strategy']='guardrails';inp['rates']['inflation']=rate(f);inp['returns']={'stocks':rate(r),'bonds':rate(r)}
    add('guardrails',i,{'rows':{'1':{'spending':money(secondSpend)}}},inputs=inp,second=('compare portfolio to inverse rate thresholds',secondSpend,spend*(0.9 if total<spend/(w*1.2) else 1.1 if total>spend/(w*0.8) else 1+f if (1+r)/(1+f)>=1 else 1),0.001))

    # VPW PMT via discounted unit payments, not a copy of the PMT implementation.
    real=[0,0.02,-0.05,-0.5][i%4];h=max(1,min(n,80));inp=engine(year,h,b,s);inp['strategy']='vpw';inp['returns']={'stocks':rate(real),'bonds':rate(real)}
    ann=sum((1+real)**(-k) for k in range(1,h+1)); payment=b/ann
    closed=b/h if real==0 else b*real/(1-(1+real)**-h)
    add('vpw',i,{'rows':{'0':{'spending':money(payment)}}},inputs=inp,second=('discounted payments vs finite annuity',payment,closed,max(0.002,abs(payment)*1e-10)))

    # Flat tax withdrawals split across all buckets, derived in spendable units.
    t=[0,0.1,0.2,0.4][i%4]; cash=round(s/10,2);taxable=round(s/5,2);deferred=round(s/2,2);free=max(1000,s)
    inp=engine(year,1,0,s);inp['balances']={k:money(v) for k,v in zip(['cash','taxable','deferred','free'],[cash,taxable,deferred,free])};inp['rates']['taxRate']=rate(t)
    left=s; takes={}
    for k,bal in inp['balances'].items():
        factor=1-t if k=='deferred' else 1
        takes[k]=min(float(bal),left/factor);left=max(0,left-takes[k]*factor)
    tax=t*takes['deferred'];endb=sum(float(x) for x in inp['balances'].values())-sum(takes.values())
    add('withdraw-flat-grossup',i,{'rows':{'0':{'withdrawn':{k:money(v) for k,v in takes.items()},'taxes':money(tax)}},'endBalance':money(endb)},inputs=inp,second=('spending plus tax conservation',sum(takes.values()),s+tax,max(0.003,s*1e-11)))

    # Depletion, inclusive failure year and remaining shortage. No tax or returns.
    spend=max(0.01,s); h=3+i%5; initial=round(spend*(i%h)+spend/2,2); inp=engine(year,h,initial,spend)
    k=min(h-1,int(Decimal(str(initial))//Decimal(str(spend))));fail=year+k if initial<h*spend-0.005 else None
    short=max(0,spend-max(0,initial-k*spend))
    add('failure',i,{'success':fail is None,'failYear':fail,'failAge':60+k if fail is not None else None,'endBalance':'0.00' if fail is not None else money(initial-h*spend)},inputs=inp,second=('resource exhaustion count',min(initial,h*spend)+max(0,h*spend-initial),h*spend,0.002))

    # Cash interest differs from invested blend; returns applied after spending.
    r=[-0.01,0,0.03,0.1][i%4];cash=round(max(b,s+1),2);growth=[0,0.07,-0.2,0.4][i%4]
    inp=engine(year,1,b,s);inp['balances']['cash']=money(cash);inp['rates']['cash']=rate(r);inp['returns']={'stocks':rate(growth),'bonds':rate(growth)}
    endb=(cash-s)*(1+r)+b*(1+growth)
    add('post-flow-growth',i,{'endBalance':money(endb),'rows':{'0':{'balances':{'cash':money((cash-s)*(1+r)),'taxable':money(b*(1+growth))}}}},inputs=inp,second=('interest on remaining balance',endb,cash+b-s+(cash-s)*r+b*growth,max(0.001,abs(endb)*1e-12)))

    # Mathematical affordable spending, including deliberately inadequate search brackets.
    h=max(1,min(n,80));initial=max(1,b);inp=engine(year,h,initial,initial/2 if h>1 else 1)
    affordable=math.floor(initial/h+0.5)
    capped=max(10000,initial*0.5+inp['spending']['yearly']*4)<initial/h-0.5
    issue='Initial search upper bound is below the feasible spending; bisection never expands its bracket.' if capped else 'Thirty bisection steps leave whole-dollar error at very large balances (closed-form equal shares).' if i in [91,92,96,97] else ''
    add('affordable',i,{'value':money(affordable)},inputs=inp,target='affordableSpending',second=('equal shares recombine principal',initial/h*h,initial,max(0.001,initial*1e-12)),todo=issue)

    # Page coverage/verdict and summary on a simple three-year, zero-return model.
    spend=1200;initial=[3000,3600,4000,5000][i%4]+(i//4)*123.45;p=plan(year,initial,100)
    inc=[0,100,300,500][i%4];p['retirement']['pensions']=[dict(name='Example pension',personId='a',monthly=money(inc),startAge=60,cola=True)]
    totalNeed=3*max(0,spend-12*inc);endb=max(0,initial-totalNeed);aff=math.floor(initial/3+12*inc+0.5)
    success=initial>=totalNeed; verdict='short' if not success else 'tight' if aff/spend<1.15 else 'on track'
    add('page-summary',i,{'coverage':rate(12*inc/spend),'affordable':money(aff),'verdict':verdict,'atEnd':{'total':money(endb)},'atRetirement':{'year':year,'age':60},'spendingYearly':money(spend)},p=p,params={'today':f'{year}-01-01'},target='compute',second=('total resources per horizon',initial+3*12*inc,3*(initial/3+12*inc),0.001))

    # Explicit readiness matrix, including empty arrays/dependent-only/missing birthday.
    p=plan(year,b);variant=i%5
    if variant==0:p['household']['people']=[]
    elif variant==1:p['household']['people'][0]['role']='dependent'
    elif variant==2:del p['household']['people'][0]['birthDate']
    elif variant==3:p['accounts']=[]
    else:p['retirement']['spendingMonthly']=0
    add('readiness',i,{'ready':False,'rows':{'length':0}},p=p,params={'today':f'{year}-02-28'},target='compute',second=('one missing prerequisite',1,sum([variant in [0,1,2],variant==3,variant==4]),0))

for i in range(100):
    year=2026+i%31;amount=100+i*17 if i<60 else [0.01,1,100,500,1000,5000][i%6] if i<90 else [0.01,1e6,1e7,1,1e8][i%5]
    p=plan(year,1e10,100);p['household']['people'][0]['lifeExpectancy']=70
    amount=math.ceil(amount*10)/10  # typed benefit adapter cases use whole dimes; SSA rounding belongs to the excluded page
    p['retirement']['socialSecurity']={'a':{'claimAge':67,'monthlyAtFRA':money(amount)}}
    monthly=amount
    expected={'inputs':{'incomes':{'0':{'yearly':money(monthly*12),'startAge':67,'kind':'social','cola':True}}},'rows':{'6':{'income':'0.00'},'7':{'income':money(monthly*12)}}} if monthly>0 else {'inputs':{'incomes':{'length':0}},'rows':{'7':{'income':'0.00'}}}
    add('typed-social-adapter',i,expected,p=p,params={'today':f'{year}-01-01'},target='compute',note='Typed full-retirement-age statement only in whole dimes; born1966+, FRA67, claim67 => factor1; SSA benefit derivation/rounding excluded.',second=('twelve monthly benefit checks',monthly*12,sum([monthly]*12),max(0.001,monthly*1e-12)))

    p=plan(year,1e10,100);p['household']['people'].append(dict(id='b',name='Example B',role='partner',birthDate=f'{year-55}-12-31',retirementAge=57,lifeExpectancy=58))
    p['income']=[dict(id='pay',name='Example pay',type='salary',personId='b',period='monthly',amount=money(amount),startDate=f'{year}-01-01',endDate=f'{year+10}-12-31')]
    add('partner-pay-adapter',i,{'inputs':{'incomes':{'0':{'yearly':money(amount*12),'personIndex':1,'startAge':55,'endAge':56}}},'rows':{'0':{'income':money(amount*12)},'1':{'income':money(amount*12)},'2':{'income':'0.00'}}},p=p,params={'today':f'{year}-01-01'},target='compute',note='Partner salary counts until their retirement; primary starts retirement now.',second=('two working years times annual salary',amount*24,2*sum([amount]*12),max(.001,amount*1e-12)))

    balance=round(amount*246,2);f=24.6;t=[0,.1,.15,.4][i%4];g=[0,.01,-.01,.05][i%4]
    amountRmd=balance/f;spend=round(amountRmd*(1-t)/2,2)
    inp=engine(year,1,0,spend);inp['balances']['deferred']=balance;inp['people'][0]['birthYear']=year-75;inp['rmd']={'startAge':75,'birthYear':year-75};inp['rates']['taxRate']=rate(t);inp['returns']={'stocks':rate(g),'bonds':rate(g)}
    surplus=amountRmd*(1-t)-spend;deferred=(balance-amountRmd)*(1+g);taxable=surplus*(1+g)
    add('rmd-surplus',i,{'rows':{'0':{'rmd':money(amountRmd),'taxes':money(amountRmd*t),'withdrawn':{'deferred':money(amountRmd)},'balances':{'deferred':money(deferred),'taxable':money(taxable)}}},'endBalance':money(deferred+taxable)},inputs=inp,note='IRS Pub590-B TableIII age75 factor24.6; unused net required withdrawal goes to taxable before growth.',second=('resources after required withdrawal',deferred+taxable,(balance-spend-amountRmd*t)*(1+g),max(.002,balance*1e-12)))

write_page('projection',ROWS)
(ROOT/'tests/golden/retirement/projection-second-checks.json').write_text(json.dumps(CHECKS,indent=2)+'\n')
print(f'projection: {len(ROWS)} rows, {len(CHECKS)} independent second checks')
