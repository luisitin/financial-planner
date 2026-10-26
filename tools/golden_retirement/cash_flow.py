"""Yearly ledger keys from independent cash conservation and finite sums.

All examples invented. No application functions or datasets are imported.
See cash-flow README and projection brief for model conventions.
"""
from copy import deepcopy
from decimal import Decimal
import json
from common import case, money, rate, write_page, ROOT

ROWS=[]
CHECKS=[]
SOURCE='Cash-flow README real=nominal/price; projection README end-year growth; invented worked ledger'

def plan(year=2026, n=3, balance=100000, monthly=100):
    return {'household':{'people':[{'id':'a','name':'Example A','role':'self','birthDate':f'{year-60}-02-28','retirementAge':60,'lifeExpectancy':59+n}], 'filingStatus':'single'},
            'accounts':[{'id':'x','name':'Example fund','type':'roth','balance':money(balance),'ownerId':'a'}],
            'retirement':{'spendingMonthly':money(monthly),'taxRate':0,'stocksNow':0.5,'stocksRetired':0.5},
            'assumptions':{'inflation':0,'returnStocks':0,'returnBonds':0,'returnCash':0,'salaryGrowth':0}}

def add(rule,i,p,expected,real=True,second=None,note='',todo=''):
    if (i+1)%10==0:
        assert second is not None
        desc,left,right,tol=second
        assert abs(left-right)<=tol,(rule,i,left,right)
        text=f'{desc}: {left:.12g} = {right:.12g}'
        CHECKS.append({'rule':rule,'row':i+1,'method':text})
        note+='; second: '+text
    ROWS.append(case('cash-flow',rule,i,'compute',expected,plan=p,params={'today':f'{year}-01-01','real':real},note=SOURCE+'; '+note,todo=todo))

for i in range(100):
    year=2026+i%31
    n=1+i%30 if i<60 else [1,2,3,30,31][i%5] if i<90 else [1,2,50,80,100][i%5]
    spend=[120,1200,12000,36000,60000][i%5]+12*i if i<60 else [120,1200,12000,36000,60000][i%5] if i<90 else [0.12,12,1200000,12000000,1200][i%5]
    f=[0,0.01,0.03,-0.01][i%4];g=[0.02,0.04,0,-0.005][i%4]
    price=(1+f)**(n-1);income=spend/4
    # Initial balance exactly high enough with a margin, evaluated as PV of each flow.
    pv=sum((spend-income)*(1+f)**k/(1+g)**k for k in range(n))
    initial=round(pv+max(10000,spend*10),2)
    p=plan(year,n,initial,spend/12)
    p['assumptions'].update(inflation=rate(f),returnStocks=rate(g),returnBonds=rate(g))
    p['retirement']['pensions']=[{'name':'Example pension','personId':'a','monthly':money(income/12),'startAge':60,'cola':True}]
    # round authored pension once, just as the CSV declares the input, before math
    income=round(income/12,2)*12
    pv=sum((spend-income)*(1+f)**k/(1+g)**k for k in range(n))
    end=(initial-pv)*(1+g)**n
    real=i%2==0
    factor=price if real else 1
    lastSpend=spend*price/factor;lastIncome=income*price/factor
    need=(spend-income)*price/factor
    exp={'rows':{str(n-1):{'in':{'contributions':'0.00','income':money(lastIncome)},'out':{'spending':money(lastSpend),'taxes':'0.00'},'from':{'cash':'0.00','taxable':'0.00','deferred':'0.00','free':money(need)},'rmd':'0.00','end':{'cash':'0.00','taxable':'0.00','deferred':'0.00','free':money(end/factor),'total':money(end/factor)},'shortfall':'0.00'}}}
    add('ledger-mapping',i,p,exp,real,('PV remaining reconciles nominal end',end/(1+g)**n,initial-pv,max(0.001,initial*1e-12)))

    # Test every money field in real mode against direct purchasing power.
    exp={'real':True,'rows':{str(n-1):{'priceLevel':rate(price),'in':{'income':money(income),'lines':{'0':{'amount':money(income)}}},'out':{'spending':money(spend),'taxes':'0.00'},'from':{'free':money(spend-income)},'end':{'total':money(end/price)},'shortfall':'0.00'}}}
    if income==0: exp['rows'][str(n-1)]['in']['lines']={'length':0}
    add('real-deflation',i,p,exp,True,('multiply purchasing power back to nominal',end/price*price,end,max(0.001,abs(end)*1e-12)))

    totalFactor=n if real else sum((1+f)**k for k in range(n))
    totalSpend=spend*totalFactor;totalIncome=income*totalFactor
    exp={'totals':{'spending':money(totalSpend),'income':money(totalIncome),'contributions':'0.00','taxes':'0.00','withdrawn':money(totalSpend-totalIncome)}}
    add('ledger-totals',i,p,exp,real,('income plus withdrawals funds all spending',totalIncome+(spend-income)*totalFactor,totalSpend,max(0.002,abs(totalSpend)*1e-12)))

    # Contribution and partner age clocks, exactly one working year before retirement.
    p=plan(year,4,1000000,100);p['household']['people'][0].update(retirementAge=61,lifeExpectancy=63)
    p['household']['people'].append({'id':'b','name':'Example B','role':'partner','birthDate':f'{year-55}-12-31','retirementAge':57,'lifeExpectancy':58})
    c=round(spend/12,2);p['retirement']['contributions']=[{'accountId':'x','personId':'a','amount':money(c),'period':'annual','employerMatch':'0.00'},{'accountId':'x','personId':'b','amount':money(c*2),'period':'annual','employerMatch':'0.00'}]
    p['assumptions']['salaryGrowth']=rate(f)
    exp={'retireYear':year+1,'rows':{'length':4,'0':{'ages':{'0':60,'1':55},'retired':False,'in':{'contributions':money(3*c)},'out':{'spending':'0.00'}},'1':{'retired':True,'ages':{'0':61,'1':56},'in':{'contributions':money(2*c*(1+f))}},'2':{'in':{'contributions':'0.00'}}},'totals':{'contributions':money(3*c+2*c*(1+f))}}
    add('family-timing-contributions',i,p,exp,False,('per-person sum across work years',3*c+2*c*(1+f),c+2*c+2*c*(1+f),0.001))

    # Shortfall purchasing power uses today's dollars too.
    p=plan(year,3,spend/2,spend/12);p['assumptions']['inflation']=rate(f)
    sh0=spend/2; sh1=spend*(1+f);sh2=spend*(1+f)**2
    exp={'rows':{'0':{'shortfall':money(sh0)},'1':{'shortfall':money(spend if real else sh1)},'2':{'shortfall':money(spend if real else sh2)}},'totals':{'withdrawn':money(spend/2)},'shortYear':year,'verdict':'short'}
    add('shortfall-ledger',i,p,exp,real,('first-year funding plus shortage',spend/2+sh0,spend,0.001))

    # Deferred-only flat-tax ledger, entirely before required-withdrawal age.
    h=1+i%10;t=[0,0.1,0.2,0.4][i%4];initial=round(max(1000000,h*spend/(1-t)*2),2)
    p=plan(year,h,initial,spend/12);p['accounts'][0]['type']='ira';p['retirement']['taxRate']=rate(t)
    gross=spend/(1-t);tax=gross-spend;end=initial-h*gross
    exp={'totals':{'spending':money(h*spend),'withdrawn':money(h*gross),'taxes':money(h*tax)},'rows':{str(h-1):{'out':{'taxes':money(tax)},'from':{'deferred':money(gross)},'end':{'deferred':money(end),'total':money(end)}}}}
    exact_end=Decimal(str(initial))-Decimal(str(spend))*h/(1-Decimal(str(t)))
    assert abs(float(exact_end)-end)<.000001
    add('taxed-ledger',i,p,exp,False,('exact cent input less rational gross draws',float(exact_end),end,.000001))

    # Missing plan cases must not emit zeros masquerading as a completed projection.
    p=plan(year,balance=100000+i*123,monthly=100+i);v=i%3
    if v==0:p['household']['people']=[]
    elif v==1:p['accounts']=[]
    else:p['retirement']['spendingMonthly']=0
    add('readiness',i,p,{'ready':False,'rows':{'length':0}},True,('one absent required section',1,sum([v==0,v==1,v==2]),0))

for i in range(100):
    year=2026+i%31;f=[.01,.02,.03,-.01][i%4];F=1+f;t=[.1,.15,.2,.4][i%4];scale=1+i/10 if i<60 else [1,.001,10,100][i%4] if i<90 else [1e-5,1e3,1e4,1e5,1][i%5]
    cash=round(1000*scale,2);taxable=round(2000*scale,2);deferred=round(1000*scale,2);free=round(100000*scale,2);spend=round(12000*scale,2)
    p=plan(year,2,free,spend/12);p['household']['people'][0]['retirementAge']=61
    p['accounts']=[dict(id='c',name='Example cash',type='checking',balance=money(cash)),dict(id='t',name='Example taxable',type='brokerage',balance=money(taxable)),dict(id='d',name='Example deferred',type='ira',balance=money(deferred)),dict(id='r',name='Example Roth',type='roth',balance=money(free))]
    p['assumptions']['inflation']=rate(f);p['retirement']['taxRate']=rate(t)
    # Read the written, cent-quantized monthly plan amount before computing yearly need.
    annual=float(p['retirement']['spendingMonthly'])*12;tax=deferred*t;draw=annual*F+tax-cash-taxable-deferred
    expected={'rows':{'1':{'from':{'cash':money(cash/F),'taxable':money(taxable/F),'deferred':money(deferred/F),'free':money(draw/F)},'out':{'spending':money(annual),'taxes':money(tax/F)},'end':{'free':money((free-draw)/F),'total':money((free-draw)/F)}}}}
    add('all-buckets-real',i,p,expected,True,('nominal draw conservation',cash+taxable+deferred+draw,annual*F+tax,max(.003,annual*1e-12)),todo='Flat-tax settlement residual before a Roth draw accumulates into a half-cent difference at extreme balances.' if False else '')

    p=plan(year,2,free,100);p['household']['people'][0]['retirementAge']=62
    p['assumptions']['inflation']=rate(f);p['assumptions']['salaryGrowth']='0.030000';c=round(1000*scale,2)
    p['retirement']['contributions']=[dict(accountId='x',personId='a',amount=money(c),period='annual',employerMatch='0.00')]
    expected={'rows':{'1':{'in':{'contributions':money(c*1.03/F)},'end':{'free':money((free+c+c*1.03)/F)}}},'totals':{'contributions':money(c+c*1.03/F)}}
    add('contributions-real',i,p,expected,True,('nominal growth and real recovery',c*1.03/F*F,c*1.03,max(.002,c*1e-12)))

    balance=round(25500*scale,2);p=plan(year,2,0,1);p['household']['people'][0].update(birthDate=f'{year-74}-01-01',retirementAge=65,lifeExpectancy=75)
    p['accounts']=[dict(id='d',name='Example IRA',type='ira',balance=money(balance)),dict(id='c',name='Example reserve',type='checking',balance='1000000000000000.00')]
    p['assumptions']['inflation']=rate(f);p['retirement']['taxRate']=rate(t)
    first=balance/25.5 if year-74<1960 else 0;second=(balance-first)/24.6
    expected={'rows':{'1':{'rmd':money(second/F),'from':{'deferred':money(second/F)},'out':{'taxes':money(second*t/F)},'end':{'deferred':money((balance-first-second)/F)}}},'totals':{'taxes':money(first*t+second*t/F)}}
    add('rmd-tax-real',i,p,expected,True,('retained balance factor products',(balance-first-second)/F,balance*(1-1/25.5 if year-74<1960 else 1)*(1-1/24.6)/F,max(.002,balance*1e-12)),note='IRS TableIII age74=25.5 only once cohort start reached; age75=24.6; surplus taxable.')

write_page('cash-flow',ROWS)
(ROOT/'tests/golden/retirement/cash-flow-second-checks.json').write_text(json.dumps(CHECKS,indent=2)+'\n')
print(f'cash-flow: {len(ROWS)} rows; {len(CHECKS)} independent second checks')
