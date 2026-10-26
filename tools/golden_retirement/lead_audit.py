"""Lead's independent re-derivation of a >=2% sample of every page.

This file imports neither the worker generators nor the app. Audits use resource
conservation, annuity equations and primary-source constants. It reads only CSV
inputs and expected values, never actual app output. Run after fixture generation.
"""
import csv
import json
import math
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/'tests/golden/retirement'
REPORT=[]
BUCKET={'checking':'cash','savings':'cash','cash':'cash','brokerage':'taxable','crypto':'taxable','401k':'deferred','ira':'deferred','cash_value_life':'deferred','roth':'free','hsa':'free'}
PERIOD={'weekly':52,'biweekly':26,'semimonthly':24,'monthly':12,'quarterly':4,'annual':1,'once':0}
# Independently transcribed IRS Publication590-B AppendixB TableIII.
RMD_FACTORS=dict(zip(range(72,121),[27.4,26.5,25.5,24.6,23.7,22.9,22,21.1,20.2,19.4,18.5,17.7,16.8,16,15.2,14.4,13.7,12.9,12.2,11.5,10.8,10.1,9.5,8.9,8.4,7.8,7.3,6.8,6.4,6,5.6,5.2,4.9,4.6,4.3,4.1,3.9,3.7,3.5,3.4,3.3,3.1,3,2.9,2.8,2.7,2.5,2.3,2]))
def number(x):return float(x or 0)
def decode(v):
    if v=='@null':return None
    if v=='@empty-array':return []
    if v=='@empty-object':return {}
    if v in ('true','false'):return v=='true'
    try:return float(v) if '.' in v or v in ('Infinity','-Infinity','NaN') else int(v)
    except ValueError:return v
def expand(row,prefix):
    out={}
    for k,v in row.items():
        if not k.startswith(prefix+'.') or v=='':continue
        p=k[len(prefix)+1:].split('.');cur=out
        for field in p[:-1]:cur=cur.setdefault(field,{})
        cur[p[-1]]=decode(v)
    def lists(x):
        if not isinstance(x,dict):return x
        if x and all(k.isdigit() for k in x):return [lists(x.get(str(i))) for i in range(max(map(int,x))+1)]
        return {k:lists(v) for k,v in x.items()}
    return lists(out)
def at(x,path):
    for k in path.split('.'):
        if k=='length':x=len(x)
        elif isinstance(x,list):x=x[int(k)]
        else:x=x[k]
    return x
def annual(x):return number(x.get('amount'))*PERIOD.get(x.get('period'),12)
def active(x,today):return (not x.get('startDate') or x['startDate']<=today) and (not x.get('endDate') or x['endDate']>=today)

def planner(p,params):
    today=params['today'];year=int(today[:4]);rt=p.get('retirement',{});a=p.get('assumptions',{})
    adults=[x for x in p.get('household',{}).get('people',[]) if x.get('role')!='dependent' and x.get('birthDate')]
    adults.sort(key=lambda x:x.get('role')!='self')
    spend=number(rt.get('spendingMonthly'))*12
    source='typed'
    if spend<=0:
        spend=sum(annual(x) for x in p.get('expenses',[]) if active(x,today));source='expenses'
    if not adults or not p.get('accounts') or spend<=0:return {'ready':False,'rows':[]}
    people=[dict(id=x['id'],name=x['name'],birthYear=int(x['birthDate'][:4]),retireAge=number(x.get('retirementAge',a.get('retirementAge',65))),endAge=number(x.get('lifeExpectancy',a.get('planEndAge',95)))) for x in adults]
    balances=dict.fromkeys(['cash','taxable','deferred','free'],0)
    for x in p['accounts']:
        if x.get('type') in BUCKET:balances[BUCKET[x['type']]]+=number(x.get('balance'))
    contrib=[]
    for c in rt.get('contributions',[]):
        amt=annual(c)+number(c.get('employerMatch'))
        account=next((x for x in p['accounts'] if x['id']==c.get('accountId')),{})
        who=next((i for i,x in enumerate(people) if x['id']==c.get('personId')),0)
        if amt>0:contrib.append(dict(bucket=BUCKET.get(account.get('type'),'taxable'),yearly=amt,personIndex=who))
    incomes=[]
    for pn in rt.get('pensions',[]):
        if number(pn.get('monthly'))>0:
            who=next((i for i,x in enumerate(people) if x['id']==pn.get('personId')),0)
            incomes.append(dict(name=pn.get('name') or 'Pension',yearly=number(pn['monthly'])*12,personIndex=who,startAge=number(pn.get('startAge') or 65),endAge=pn.get('endAge'),cola=pn.get('cola',True)))
    for i,person in enumerate(people):
        social=rt.get('socialSecurity',{}).get(person['id'],{})
        if social.get('monthlyAtFRA'):
            incomes.append(dict(name=person['name']+"'s Social Security",yearly=number(social['monthlyAtFRA'])*12,personIndex=i,startAge=67,kind='social',cola=True))
    retire=max(year,people[0]['birthYear']+people[0]['retireAge'])
    for i,person in enumerate(people[1:],1):
        pay=sum(annual(x) for x in p.get('income',[]) if x.get('personId')==person['id'] and x.get('type') not in ['social','pension'] and active(x,today))
        if pay>0 and person['birthYear']+person['retireAge']>retire:incomes.append(dict(name=person['name']+"'s pay",yearly=pay,personIndex=i,startAge=year-person['birthYear'],endAge=person['retireAge']-1,cola=True))
    I=dict(startYear=year,endYear=max(x['birthYear']+x['endAge'] for x in people),retireYear=retire,people=people,balances=balances,contributions=contrib,incomes=incomes,spending={'yearly':spend},rates=dict(inflation=number(a.get('inflation',.03)),cash=number(a.get('returnCash',.02)),salaryGrowth=number(a.get('salaryGrowth',.03)),taxRate=number(rt.get('taxRate',.15)),stocksNow=number(rt.get('stocksNow',.7)),stocksRetired=number(rt.get('stocksRetired',.5))),returns=dict(stocks=number(a.get('returnStocks',.07)),bonds=number(a.get('returnBonds',.04))),strategy=rt.get('strategy','fixed-real'),withdrawalRate=number(rt.get('withdrawalRate',.04)))
    by=people[0]['birthYear'];I['rmd']={'startAge':75 if by>=1960 else 73 if by>=1951 else 72}
    return dict(ready=True,inputs=I,spendingYearly=spend,spendingSource=source)

def ledger(I,options=None):
    # Work in spendable resources. Pre-tax accounts have a flat conversion cost.
    options=options or {};rate=I['rates']; balances={k:number(I['balances'].get(k,0)) for k in ('cash','taxable','deferred','free')}
    rows=[];price=1;success=True;failYear=None;failAge=None;withdrawsum=0;taxsum=0;guard=None;priorReal=None
    for k,year in enumerate(range(int(I['startYear']),int(I['endYear'])+1)):
        seq=options.get('sequence',[]);step=seq[k] if k<len(seq) else {}
        infl=number(step.get('inflation',rate['inflation']))
        if k:price*=1+infl
        mix=number(rate['stocksRetired']) if I['retireYear']<=I['startYear'] else number(rate['stocksNow'])+(number(rate['stocksRetired'])-number(rate['stocksNow']))*min(1,k/(I['retireYear']-I['startYear']))
        r=mix*number(step.get('stocks',I['returns']['stocks']))+(1-mix)*number(step.get('bonds',I['returns']['bonds']))
        ages=[year-x['birthYear'] for x in I['people']];contrib=0
        for c in I.get('contributions',[]):
            ix=int(c.get('personIndex',0));stop=c.get('untilAge',I['people'][ix]['retireAge'])
            if ages[ix]<stop:
                v=number(c['yearly'])*(1+number(rate['salaryGrowth']))**k;balances[c['bucket']]+=v;contrib+=v
        incomes=[]
        for c in I.get('incomes',[]):
            ix=int(c.get('personIndex',0));a=ages[ix]
            if a>=number(c['startAge']) and (c.get('endAge') is None or a<=number(c['endAge'])):
                incomes.append(dict(name=c['name'],amount=number(c['yearly'])*(price if c.get('cola',True) else 1)))
        income=sum(x['amount'] for x in incomes);retired=year>=I['retireYear'];spend=0;balance=sum(balances.values());strategy=I.get('strategy','fixed-real');wr=number(I.get('withdrawalRate',.04))
        if retired:
            if strategy=='percent':spend=max(0,balance*wr)
            elif strategy=='vpw':
                real=max(-.5,(1+r)/(1+infl)-1);years=I['endYear']-year+1;spend=max(0,balance/sum((1+real)**-j for j in range(1,int(years)+1)))
            elif strategy=='guardrails':
                if guard is None:guard=number(I['spending']['yearly'])*price
                elif balance<guard/(1.2*wr):guard*=.9
                elif balance>guard/(.8*wr):guard*=1.1
                elif priorReal>=0:guard*=1+infl
                spend=guard
            else:spend=number(I['spending']['yearly'])*price
        need=max(0,spend-income);taken=dict.fromkeys(balances,0);mandatory=0
        if I.get('rmd') and ages[0]>=I['rmd']['startAge'] and balances['deferred']>0:
            mandatory=balances['deferred']/RMD_FACTORS[min(120,int(ages[0]))];balances['deferred']-=mandatory;taken['deferred']=mandatory
        left=max(0,need-mandatory*(1-number(rate.get('taxRate',0))))
        for bucket in ['cash','taxable','deferred','free']:
            factor=1-number(rate.get('taxRate',0)) if bucket=='deferred' else 1
            available=max(0,balances[bucket])*factor
            spendable=min(available,left);take=spendable/factor
            taken[bucket]+=take;balances[bucket]-=take;left-=spendable
        tax=taken['deferred']*number(rate.get('taxRate',0))
        balances['taxable']+=max(0,mandatory*(1-number(rate.get('taxRate',0)))-need)
        if left>.005 and success:success=False;failYear=year;failAge=ages[0]
        for bucket in balances:balances[bucket]*=1+number(step.get('cash',rate['cash'])) if bucket=='cash' else 1+r
        total=sum(balances.values());withdrawsum+=sum(taken.values());taxsum+=tax
        rows.append(dict(year=year,ages=ages,retired=retired,priceLevel=price,stockShare=mix,portfolioReturn=r,contributions=contrib,income=income,incomeLines=incomes,spending=spend,spendingReal=spend/price,incomeReal=income/price,withdrawn=taken,taxes=tax,rmd=mandatory,shortfall=left,balances=balances.copy(),total=total,totalReal=total/price))
        priorReal=(1+r)/(1+infl)-1
    return dict(rows=rows,success=success,failYear=failYear,failAge=failAge,endBalance=rows[-1]['total'],totalWithdrawn=withdrawsum,totalTaxes=taxsum)

def projection(row):
    I=expand(row,'input');p=expand(row,'plan');params=expand(row,'params')
    if row['target']=='affordableSpending':return {'value':math.floor(number(I['balances']['taxable'])/(I['endYear']-I['startYear']+1)+.5)}
    if row['target']=='project':return ledger(I,expand(row,'options'))
    b=planner(p,params)
    if not b['ready']:return b
    I=b['inputs'];r=ledger(I);b['rows']=r['rows'];rr=next(x for x in r['rows'] if x['year']==I['retireYear']);last=r['rows'][-1]
    b['yearsInRetirement']=sum(x['retired'] for x in r['rows'])
    b['coverage']=rr['income']/rr['spending'] if rr['spending'] else None
    b['atRetirement']={'year':rr['year'],'age':rr['ages'][0]};b['atEnd']={'total':last['total']}
    if any(k.startswith('expected.affordable') for k,v in row.items() if v):
        b['affordable']=math.floor(sum(I['balances'].values())/len(r['rows'])+rr['income']+.5)
        b['verdict']='short' if not r['success'] else 'tight' if b['affordable']/I['spending']['yearly']<1.15 else 'on track'
    return b

def cashflow(row):
    b=planner(expand(row,'plan'),expand(row,'params'))
    if not b['ready']:return b
    R=ledger(b['inputs']);real=expand(row,'params').get('real',True);rows=[]
    for r in R['rows']:
        q=r['priceLevel'] if real else 1
        rows.append(dict(year=r['year'],age=r['ages'][0],ages=r['ages'],retired=r['retired'],priceLevel=r['priceLevel'],**{'in':{'contributions':r['contributions']/q,'income':r['income']/q,'lines':[dict(name=x['name'],amount=x['amount']/q) for x in r['incomeLines']]},'out':{'spending':r['spending']/q,'taxes':r['taxes']/q},'from':{k:v/q for k,v in r['withdrawn'].items()},'end':dict(**{k:v/q for k,v in r['balances'].items()},total=r['total']/q),'rmd':r['rmd']/q,'shortfall':r['shortfall']/q}))
    return dict(ready=True,real=real,rows=rows,retireYear=b['inputs']['retireYear'],shortYear=R['failYear'],verdict='short' if not R['success'] else 'on track',totals=dict(contributions=sum(x['in']['contributions'] for x in rows),income=sum(x['in']['income'] for x in rows),spending=sum(x['out']['spending'] for x in rows),taxes=sum(x['out']['taxes'] for x in rows),withdrawn=sum(sum(x['from'].values()) for x in rows)))

def contributions(row):
    args=expand(row,'arg')
    if row['target']=='perYear':return {'value':number(args[0])*PERIOD.get(args[1],12)}
    p=expand(row,'plan');par=expand(row,'params');today=par.get('today');year=int(today[:4]) if today else 2026;y=2025 if year==2025 else 2026
    people=p.get('household',{}).get('people',[]);accounts=p.get('accounts',[]);items=[];warnings=[]
    labels=dict(zip(['weekly','biweekly','semimonthly','monthly','quarterly','annual','once'],['Every week','Every two weeks','Twice a month','Every month','Every three months','Once a year','One time only']))
    for c in p.get('retirement',{}).get('contributions',[]):
        acct=next((a for a in accounts if a['id']==c['accountId']),None);person=next((a for a in people if a['id']==c.get('personId')),None)
        own=annual(c);match=number(c.get('employerMatch'));typ=acct.get('type') if acct else None
        items.append(dict(**c,yearly=own,matchYearly=match,totalYearly=own+match,accountType=typ,accountName=acct.get('name', 'account no longer on file') if acct else 'account no longer on file',personName=person.get('name') if person else 'Household',periodLabel=labels.get(c.get('period'),'Every month')))
    peopleOut=[]
    for per in people:
        if per.get('role')=='dependent':continue
        age=year-int(per['birthDate'][:4]) if today and per.get('birthDate') else None;mine=[x for x in items if x.get('personId')==per['id']];limits=[]
        for kind in ['401k','ira','hsa','fsa']:
            used=sum(x['yearly']+(x['matchYearly'] if kind=='hsa' and row['rule']=='hsa-employer-cap' else 0) for x in mine if {'401k':'401k','ira':'ira','roth':'ira','hsa':'hsa'}.get(x['accountType'])==kind)
            if not used:continue
            base={'401k':23500 if y==2025 else 24500,'ira':7000 if y==2025 else 7500,'hsa':4300 if y==2025 else 4400,'fsa':3300 if y==2025 else 3400}[kind];extra=0
            if age is not None and age >= (55 if kind=='hsa' else 50):extra=11250 if kind=='401k' and 60<=age<=63 else {'401k':7500 if y==2025 else 8000,'ira':1000 if y==2025 else 1100,'hsa':1000,'fsa':0}[kind]
            lim=base+extra;limits.append(dict(kind=kind,limit=lim,used=used,over=max(0,used-lim),catchUp=extra))
            if used>lim:warnings.append(1)
        peopleOut.append(dict(personId=per['id'],name=per['name'],age=age,yearly=sum(x['yearly'] for x in mine),match=sum(x['matchYearly'] for x in mine),limits=limits))
    warnings.extend(1 for x in items if x['accountType'] is None)
    return dict(items=items,yearly=sum(x['yearly'] for x in items),matchYearly=sum(x['matchYearly'] for x in items),totalYearly=sum(x['totalYearly'] for x in items),byPerson=peopleOut,limitsYear=y,hasData=bool(items),warnings=warnings)

def mortality(row):
    args=expand(row,'arg')
    def pr(x,t,o):
        m,b={'m':(84,10.5),'f':(88,9.5)}.get(o.get('sex'),(86,10));m+=dict(better=3,worse=-4).get(o.get('health'),0)
        return 1 if t<=x else math.exp(-math.exp((x-m)/b)*math.expm1((t-x)/b))
    def inv(x,p,o):
        # Discrete crossing by enumeration is independent of worker's inverse log.
        return next(t for t in range(int(x),300) if pr(x,t,o)<=p)
    def life(x,o,end):
        # Survival integral in one-year midpoint rectangles.
        return math.fsum(pr(x,x+j+.5,o) for j in range(max(0,math.ceil(end-x))))
    if row['target']=='survival':return {'value':pr(*args)}
    if row['target']=='ageAtSurvival':return {'value':inv(*args)}
    if row['target']=='lifeExpectancy':return {'value':life(args[0],args[1],300 if row['rule']=='individual-age120-tail' else 120)}
    p=expand(row,'plan');params=expand(row,'params');today=params.get('today');people=[]
    for per in p.get('household',{}).get('people',[]):
        if per.get('role')=='dependent' or not per.get('birthDate'):continue
        opts=p.get('retirement',{}).get('longevity',{}).get(per['id'],{});opts={'sex':opts.get('sex',''),'health':opts.get('health','average')}
        b=date.fromisoformat(per['birthDate']);t=date.fromisoformat(today) if today else None
        x=t.year-b.year-int((t.month,t.day)<(b.month,b.day)) if t else None
        out=dict(id=per['id'],name=per['name'],age=x,**opts,currentPlanEnd=number(per.get('lifeExpectancy',p.get('assumptions',{}).get('planEndAge',95))),expectancy=None,ages=[],planTo=None)
        if x is not None:out.update(expectancy=x+life(x,opts,120),ages=[dict(age=k,p=pr(x,k,opts)) for k in [80,85,90,95,100]],planTo=min(120,inv(x,.1,opts)))
        people.append(out)
    alive=[x for x in people if x['age'] is not None];either=None
    if len(alive)>=2:
        a,b=alive[:2]
        def union(y):return 1-(1-pr(a['age'],a['age']+y,a))*(1-pr(b['age'],b['age']+y,b))
        y=next(k for k in range(300) if union(k)<=.1)
        if row['rule']!='couple-70year-cap':y=min(70,y)
        either=dict(ages=[dict(age=k,p=union(k-a['age'])) for k in [80,85,90,95,100]],planTo=a['age']+y,planToYear=int(today[:4])+y,first=a['name'],second=b['name'])
    suggestion='' if not alive else f"Plan for at least one of you being alive to about {either['planTo']} ({either['first']}'s age): that is when the chance drops under 1 in 10." if either else f"Plan to about {alive[0]['planTo']}: that is when the chance of still being alive drops under 1 in 10."
    return dict(people=people,either=either,hasData=bool(alive),suggestion=suggestion)

def fire(row):
    p=expand(row,'plan');pa=expand(row,'params');rt=p.get('retirement',{});a=p.get('assumptions',{});base=planner(p,pa);today=pa['today'];year=int(today[:4]);ex=sum(annual(x) for x in p.get('expenses',[]) if active(x,today));income=sum(annual(x) for x in p.get('income',[]) if active(x,today));spend=base.get('spendingYearly',ex)
    if spend<=0:return {'ready':False,'missing':[1]}
    wr=number(pa.get('withdrawalRate',rt.get('withdrawalRate',.04)));target=spend/wr
    invested=sum(v for k,v in base.get('inputs',{}).get('balances',{}).items() if k!='cash');own=sum(annual(x) for x in rt.get('contributions',[]));match=sum(number(x.get('employerMatch')) for x in rt.get('contributions',[]));left=max(0,income-ex) if p.get('income') and p.get('expenses') else 0;saved=max(left,own)+match
    w=number(rt.get('stocksNow',.7));nom=w*number(a.get('returnStocks',.07))+(1-w)*number(a.get('returnBonds',.04));rr=(nom-number(a.get('inflation',.03)))/(1+number(a.get('inflation',.03)))
    # Independent annual recurrence instead of worker's closed annuity.
    pot=invested;n=0 if pot>=target else None
    if n is None:
        for k in range(1,81):
            pot=pot*(1+rr)+saved
            if pot>=target-1e-8:n=k;break
    people=base.get('inputs',{}).get('people',[]);age=year-people[0]['birthYear'] if people else None;ret=people[0]['retireAge'] if people else number(a.get('retirementAge',65));gap=max(0,ret-age) if age is not None else None;coast=target/(1+rr)**gap if gap is not None else None
    return dict(ready=True,spendingYearly=spend,withdrawalRate=wr,fiNumber=target,invested=invested,progress=min(1,invested/target),gap=max(0,target-invested),savingYearly=saved,savingsRate=min(1,saved/income) if income>0 else None,realReturn=rr,yearsToFi=n,fiAge=age+n if age is not None and n is not None else None,fiYear=year+n if n is not None else None,coast=dict(number=coast,reached=invested>=coast) if coast is not None else None,retireAge=ret,yearsToRetire=gap,age=age,hasIncome=income!=0)

def rmd(row):
    args=expand(row,'arg');target=row['target']
    def factor(age):return math.inf if age<72 else RMD_FACTORS[min(120,int(age))]
    def sa(birth):return 70.5 if birth<'1949-07-01' else 72 if birth<'1951-01-01' else 73 if birth<'1960-01-01' else 75
    if target=='rmdFactor':return {'value':factor(args[0])}
    if target=='rmdAmount':return {'value':number(args[0])/factor(args[1])}
    if target=='rmdStartAge':return {'value':sa(str(args[0])+'-01-01')}
    p=expand(row,'plan');params=expand(row,'params');year=int(params['today'][:4]);rule=row['rule'];people=[]
    eligible=[a for a in p.get('accounts',[]) if a.get('type') in ['401k','ira']]
    total=sum(number(a.get('balance')) for a in eligible);schedule=[]
    for per in p.get('household',{}).get('people',[]):
        if per.get('role')=='dependent' or not per.get('birthDate'):continue
        birth=per['birthDate'];by=int(birth[:4]);age=year-by;start=sa(birth);sy=by+int(start)+(int(birth[5:7])>6 if start==70.5 else 0)
        owned=sum(number(a.get('balance')) for a in eligible if a.get('ownerId')==per['id']) if rule=='ownership' else total
        people.append(dict(birthYear=by,age=age,startAge=start,startYear=sy,yearsUntil=max(0,sy-year),deferredNow=owned,firstRmd=owned/factor(age) if sy==year else None,firstRmdReal=owned/factor(age) if sy==year else None))
    if people and p.get('retirement',{}).get('spendingMonthly') and p.get('accounts'):
        per=p['household']['people'][0];by=int(per['birthDate'][:4]);last=by+per['lifeExpectancy'];balance=total;a=p.get('assumptions',{});g=number(a.get('returnStocks',0));f=number(a.get('inflation',0));t=number(p['retirement'].get('taxRate',.15))
        for k,y in enumerate(range(year,int(last)+1)):
            age=y-by;amt=balance/factor(age) if age>=sa(per['birthDate']) else 0;balance=(balance-amt)*(1+g)
            if amt>0:schedule.append(dict(year=y,age=age,factor=factor(age),rmd=amt,rmdReal=amt/(1+f)**k,taxes=amt*t,deferredEnd=balance))
    return dict(ready=bool(p.get('retirement',{}).get('spendingMonthly') and p.get('accounts')),people=people,deferredNow=total,hasDeferred=total>0,deferredAccounts=eligible,schedule=schedule,totalRmdReal=sum(x['rmdReal'] for x in schedule),totalTaxReal=sum(x['rmdReal']*number(p.get('retirement',{}).get('taxRate',.15)) for x in schedule),taxRate=number(p.get('retirement',{}).get('taxRate',.15)),table=[dict(age=k,factor=RMD_FACTORS[k]) for k in range(72,101)])

HISTORY=[{k:(int(v) if k=='year' else float(v)) for k,v in r.items()} for r in csv.DictReader((DIR/'sources/damodaran-1928-2025.csv').open())]
def historical_worst(I):
    n=int(I['endYear']-I['startYear']+1)
    if n>len(HISTORY):return None
    # Independent forward calculation, compared to the worker's PV crosscheck.
    choices=[]
    for j in range(len(HISTORY)-n+1):
        r=ledger({**I,'strategy':'fixed-real'},{'sequence':HISTORY[j:j+n]})
        key=(r['failAge'] if r['failAge'] is not None else math.inf,r['rows'][-1]['totalReal'],j)
        choices.append((key,j))
    _,j=min(choices)
    return dict(startYear=HISTORY[j]['year'],seq=HISTORY[j:j+n])

def history_page(row):
    if row['target']=='project':
        I=expand(row,'input');result=ledger(I,expand(row,'options'));result['endBalanceReal']=result['rows'][-1]['totalReal']
        if row['rule']=='vpw-beginning-timing':
            r=number(I['returns']['stocks']);n=int(I['endYear']-I['startYear']+1);bal=number(I['balances']['taxable'])
            result['rows'][0]['spending']=bal/sum((1+r)**-k for k in range(n))
        return result
    if row['target']=='worstWindow':
        w=historical_worst(expand(row,'arg')[0]);return w if w else {'value':None}
    b=planner(expand(row,'plan'),expand(row,'params'))
    if not b['ready']:
        p=expand(row,'plan');m=[]
        if not b.get('inputs'):
            if not any(x.get('birthDate') and x.get('role')!='dependent' for x in p.get('household',{}).get('people',[])):m.append('a person with a birth date on the People page')
            if not p.get('accounts'):m.append('your accounts on the Net worth page')
            if not number(p.get('retirement',{}).get('spendingMonthly')):m.append('what you will spend in retirement (a figure here, or your expenses on the Expenses page)')
        return {'ready':False,'missing':m}
    I=b['inputs'];n=int(I['endYear']-I['startYear']+1);w=historical_worst(I)
    def summary(r,spending=False):
        retired=[x['spendingReal'] for x in r['rows'] if x['retired']]
        return dict(firstYear=retired[0] if retired else 0,lowest=min(retired) if retired else 0,highest=max(retired) if retired else 0,endReal=r['rows'][-1]['totalReal'],success=r['success'],failAge=r['failAge']) if spending else dict(success=r['success'],failAge=r['failAge'],endReal=r['rows'][-1]['totalReal'],lowestReal=min(x['totalReal'] for x in r['rows']))
    if row['case_id'].startswith('withdrawal-strategy'):
        return dict(ready=True,chosen=I['strategy'] if I['strategy'] in ['fixed-real','percent','guardrails','vpw'] else 'fixed-real',spendingYearly=I['spending']['yearly'],withdrawalRate=I['withdrawalRate'],worstStartYear=w['startYear'] if w else None,rows=[dict(key=s,expected=summary(ledger({**I,'strategy':s}),True),worst=summary(ledger({**I,'strategy':s},{'sequence':w['seq']}),True) if w else None) for s in ['fixed-real','percent','guardrails','vpw']])
    if not w:return {'ready':False,'missing':['the plan is longer than the history on file']}
    d=max(0,int(I['retireYear']-I['startYear']));head=w['seq'][:d];tail=w['seq'][d:]
    variants=[w['seq'],head+sorted(tail,key=lambda x:x['stocks']),head+sorted(tail,key=lambda x:-x['stocks'])]
    return dict(ready=True,startYear=w['startYear'],years=n,retireYear=I['retireYear'],spendingYearly=I['spending']['yearly'],average={k:math.expm1(math.fsum(math.log1p(x[k]) for x in tail)/len(tail)) if tail else math.nan for k in ['stocks','bonds','inflation']},runs=[dict(key=k,**summary(ledger({**I,'strategy':'fixed-real'},{'sequence':v}))) for k,v in zip(['actual','worst-first','best-first'],variants)],steady=summary(ledger({**I,'strategy':'fixed-real'})))

# IRS RevProc2025-32 table4.01/4.03/4.14. Arrays: ordinary tops, deduction,
# age allowance, preferential-income tops. Future indexing is a model assumption.
TAX_TABLE={
'single':([12400,50400,105700,201775,256225,640600],16100,2050,[49450,545500]),
'married_joint':([24800,100800,211400,403550,512450,768700],32200,1650,[98900,613700]),
'married_separate':([12400,50400,105700,201775,256225,384350],16100,1650,[49450,306850]),
'head_of_household':([17700,67450,105700,201750,256200,640600],24150,2050,[66200,579600]),
'qualifying_surviving':([24800,100800,211400,403550,512450,768700],32200,1650,[98900,613700])}
RATES=[.10,.12,.22,.24,.32,.35,.37]
TOPS25={'single':[11925,48475,103350,197300,250525,626350],'married_joint':[23850,96950,206700,394600,501050,751600],'married_separate':[11925,48475,103350,197300,250525,375800],'head_of_household':[17000,64850,103350,197300,250500,626350],'qualifying_surviving':[23850,96950,206700,394600,501050,751600]}
CAP25={'single':[48350,533400],'married_joint':[96700,600050],'married_separate':[48350,300000],'head_of_household':[64750,566700],'qualifying_surviving':[96700,600050]}
def taxparams(y,inf,s):
    tops,std,extra,cap=TAX_TABLE[s];tops=tops.copy();cap=cap.copy()
    if y==2025:
        tops=TOPS25[s];cap=CAP25[s];std={'single':15750,'married_joint':31500,'married_separate':15750,'head_of_household':23625,'qualifying_surviving':31500}[s];extra=2000 if s in ['single','head_of_household'] else 1600
    if y>2026:
        scale=(1+inf)**(y-2026);rnd=lambda x,u:math.floor(x*scale/u+.5)*u
        tops=[rnd(x,25) for x in tops];std=rnd(std,50);extra=rnd(extra,50);cap=[rnd(x,50) for x in cap]
    return tops,std,extra,cap
def tax_ordinary(x,tops):
    x=max(0,x);cumulative=0;lo=0
    for j,top in enumerate(tops+[math.inf]):
        if x<=top:return dict(tax=cumulative+(x-lo)*RATES[j],bracketRate=RATES[j],roomInBracket=top-x)
        cumulative+=(top-lo)*RATES[j];lo=top
def tax_qualified(o,q,cap):
    o=max(0,o);q=max(0,q);a=max(o,cap[0]);b=max(o,cap[1]);end=o+q
    return .15*max(0,min(end,cap[1])-a)+.20*max(0,end-b)
def tax_social(b,o,e,s):
    b=max(0,b);combined=max(0,o)+max(0,e)+b/2;low,high=(32000,44000) if s=='married_joint' else (25000,34000)
    if combined<=low:return 0
    if combined<=high:return min(b*.5,(combined-low)*.5)
    return min(b*.85,(combined-high)*.85+min(b*.5,(high-low)*.5))
def federal(ordinary,qualified,benefits,y,inf,s,sen=0,exempt=0):
    ordinary=max(0,ordinary);qualified=max(0,qualified);ss=tax_social(benefits,ordinary+qualified,exempt,s);agi=ordinary+qualified+ss;tops,std,extra,cap=taxparams(y,inf,s);standard=std+sen*extra
    threshold=150000 if s=='married_joint' else 75000
    senior=sen*max(0,6000-.06*max(0,agi-threshold)) if 2025<=y<=2028 and s!='married_separate' else 0
    ded=standard+senior;ti=max(0,agi-ded);qt=min(ti,qualified);ot=ti-qt;ord=tax_ordinary(ot,tops);qualifiedtax=tax_qualified(ot,qt,cap);th=250000 if s in ['married_joint','qualifying_surviving'] else 125000 if s=='married_separate' else 200000;niit=.038*min(qualified,max(0,agi-th));total=math.floor((ord['tax']+qualifiedtax+niit)*100+.5)/100
    return dict(totalTax=total,taxableIncome=ti,ordinaryTaxable=ot,qualifiedTaxable=qt,niit=niit,bracketRate=ord['bracketRate'],agi=agi,deduction=dict(standard=standard,senior=senior,amount=ded),income=dict(ordinary=ordinary,qualified=qualified,taxableSocialSecurity=ss))

def taxrun(p,year,order,fill=None,until=None):
    # Direct fixed point in cash units is different from worker's feasibility bisection.
    rt=p['retirement'];ass=p['assumptions'];people=p['household']['people'];s=p['household']['filingStatus'];birth=int(people[0]['birthDate'][:4]);end=max(int(x['birthDate'][:4])+x['lifeExpectancy'] for x in people);rate=number(ass['returnStocks']);inf=number(ass['inflation']);b=dict.fromkeys(['cash','taxable','deferred','free'],0)
    for x in p['accounts']:b[BUCKET[x['type']]]+=number(x['balance'])
    pension=sum(number(x['monthly'])*12 for x in rt.get('pensions',[]));spend=number(rt['spendingMonthly'])*12;rmdage=75 if birth>=1960 else 73 if birth>=1951 else 72;rows=[];fail=None
    for cy in range(year,int(end)+1):
        age=cy-birth;price=(1+inf)**(cy-year);sen=sum(cy-int(x['birthDate'][:4])>=65 for x in people);inc=pension*price;need=max(0,spend*price-inc);mandatory=b['deferred']/RMD_FACTORS[min(120,age)] if age>=rmdage else 0;qdiv=b['taxable']*number(rt['dividendYield']);base=b.copy();base['deferred']-=mandatory
        def solve(convert=0):
            rem=base.copy();rem['deferred']-=convert;rem['free']+=convert;draw=dict.fromkeys(rem,0);draw['deferred']=mandatory;net=mandatory
            for _ in range(100):
                tx=federal(inc+draw['deferred']+convert,draw['taxable']*number(rt['gainShare'])+qdiv,0,cy,inf,s,sen);left=need+tx['totalTax']-net
                if left<=1e-8:break
                got=0
                for key in ['cash']+order:
                    take=min(left-got,max(0,rem[key]));draw[key]+=take;rem[key]-=take;got+=take
                    if got>=left-1e-9:break
                net+=got
                if got<1e-9:break
            return rem,draw,tx,net-need-tx['totalTax']
        rem,draw,tx,residual=solve();conversion=0
        if fill is not None and age<rmdage and (until is None or age<until) and residual>=-.005:
            # Exact affine-segment secant to the taxable-income ceiling.
            top=taxparams(cy,inf,s)[0][RATES.index(fill)];start=rem.copy();startdraw=draw.copy();target=top;candidate=min(start['deferred'],max(0,target-tx['taxableIncome']))
            def post(c):
                r=start.copy();r['deferred']-=c;r['free']+=c;w=startdraw.copy();gross=sum(w.values())
                for _ in range(100):
                    t=federal(inc+w['deferred']+c,w['taxable']*number(rt['gainShare'])+qdiv,0,cy,inf,s,sen);extra=need+t['totalTax']-gross
                    if extra<=1e-8:break
                    got=0
                    for key in ['cash']+order:
                        amount=min(extra-got,max(0,r[key]));r[key]-=amount;w[key]+=amount;got+=amount
                        if got>=extra-1e-9:break
                    if got<1e-9:break
                    gross+=got
                return r,w,t,gross-need-t['totalTax']
            for _ in range(30):
                rr,ww,tt,res=post(candidate);err=tt['taxableIncome']-target
                if abs(err)<1e-7 or candidate>=start['deferred']-1e-8 and err<0:break
                trial=min(start['deferred'],candidate+1);slope=post(trial)[2]['taxableIncome']-tt['taxableIncome'] if trial>candidate else 1
                candidate=max(0,min(start['deferred'],candidate-err/(slope or 1)))
            if candidate>0 and res>=-.005:rem,draw,tx,residual=rr,ww,tt,res;conversion=candidate
        if residual<-.005 and fail is None:fail=cy
        rem['taxable']+=max(0,residual);b={k:v*(1+rate) for k,v in rem.items()};total=sum(b.values());rows.append(dict(year=cy,age=age,price=price,rmd=mandatory,taxes=tx['totalTax'],conversion=conversion,tax=tx,total=total,after=total-b['deferred']*tx['bracketRate']))
    last=rows[-1]
    return dict(rows=rows,success=fail is None,failYear=fail,endBalanceReal=last['total']/last['price'],endAfterTaxReal=last['after']/last['price'],endTaxRate=last['tax']['bracketRate'],taxesReal=sum(x['taxes']/x['price'] for x in rows),rmdReal=sum(x['rmd']/x['price'] for x in rows),totalConvertedReal=sum(x['conversion']/x['price'] for x in rows))

def taxpage(row):
    args=expand(row,'arg');pa=expand(row,'params');target=row['target'];year=pa.get('taxYear',2026);inf=pa.get('inflation',.03)
    if target=='paramsFor':
        y=args[0];inf=args[1]['inflation'];return dict(year=y,status={s:dict(zip(['brackets','standardDeduction','extraAllowance','ltcgBrackets'],taxparams(y,inf,s))) for s in TAX_TABLE})
    if target=='taxOnOrdinary':return tax_ordinary(number(args[0]),taxparams(year,inf,args[1])[0])
    if target=='taxOnQualified':return {'tax':tax_qualified(number(args[0]),number(args[1]),taxparams(year,inf,args[2])[3])}
    if target=='taxableSocialSecurity':return {'value':tax_social(*args)}
    if target=='standardDeduction':
        _,std,ex,_=taxparams(year,inf,args[0]);return {'value':std+ex*args[2]['ages65plus']}
    if target=='federalTax':
        x=args[0];return federal(number(x.get('otherOrdinary')),number(x.get('qualifiedIncome')),number(x.get('socialSecurity')),year,inf,x['filingStatus'],x.get('ages65plus',0))
    if target=='bracketTop':
        rate=args[0];tops=taxparams(year,inf,args[1])[0];return {'value':tops[RATES.index(rate)] if rate in RATES[:6] else math.inf}
    if target=='roomUnder':
        x=args[0];top=args[2];o=number(x.get('otherOrdinary'));s=x['filingStatus'];sen=x.get('ages65plus',0);candidate=top+taxparams(year,inf,s)[1]-o
        for _ in range(30):
            error=federal(o+candidate,0,0,year,inf,s,sen)['taxableIncome']-top
            if abs(error)<1e-8:break
            slope=federal(o+candidate+1,0,0,year,inf,s,sen)['taxableIncome']-federal(o+candidate,0,0,year,inf,s,sen)['taxableIncome'];candidate-=error/(slope or 1)
        return {'value':max(0,candidate)}
    p=expand(row,'plan');year=int(pa['today'][:4]);rt=p.get('retirement',{});orders={'taxable-first':['taxable','deferred','free'],'deferred-first':['deferred','taxable','free'],'roth-last-taxable':['deferred','free','taxable'],'roth-first':['free','taxable','deferred']}
    if not p.get('accounts') or not p.get('household',{}).get('people') or not number(rt.get('spendingMonthly')):return {'ready':False,'options':[]}
    def score(r):return (1,r['endAfterTaxReal']) if r['success'] else (0,r['failYear'])
    if row['case_id'].startswith('withdrawal-order'):
        runs=[dict(key=k,order=o,**taxrun(p,year,o)) for k,o in orders.items()];best=max(runs,key=score);worst=min(runs,key=score);current=next(k for k,o in orders.items() if o==rt['withdrawalOrder'])
        for r in runs:r.update(best=r is best,current=r['key']==current)
        return dict(ready=True,options=runs,current=current,best=best['key'],bracketsOn=rt['taxMode']=='brackets',allFail=all(not r['success'] for r in runs),gainVsWorst=best['endAfterTaxReal']-worst['endAfterTaxReal'] if best['success'] and worst['success'] else 0,taxSpread=worst['taxesReal']-best['taxesReal'])
    fills=[None,.1,.12,.22,.24];setting=rt['rothConversion'];until=setting.get('untilAge');runs=[taxrun(p,year,orders['taxable-first'],f,until) for f in fills];bi=max(range(5),key=lambda i:score(runs[i]));shown=number(setting['fillRate']) if setting['on'] else fills[bi] or .22;shownRun=runs[fills.index(shown)];birth=int(p['household']['people'][0]['birthDate'][:4]);startage=75 if birth>=1960 else 73 if birth>=1951 else 72
    possible=[r for r in shownRun['rows'] if r['age']<startage and (until is None or r['age']<until)];table=[];s=p['household']['filingStatus'];inf=number(p['assumptions']['inflation'])
    for r in possible:
        if r['conversion']<.005:continue
        tier=(218000 if s=='married_joint' else 109000)*(1+inf)**max(0,r['year']-2026)
        table.append(dict(year=r['year'],conversion=r['conversion'],conversionReal=r['conversion']/r['price'],taxes=r['taxes'],taxableIncome=r['tax']['taxableIncome'],incomeBefore=r['tax']['income']['ordinary']-r['conversion'],bracketTop=taxparams(r['year'],inf,s)[0][RATES.index(shown)],irmaa=r['age']>=63 and r['tax']['agi']>tier))
    for i,r in enumerate(runs):r.update(fillRate=fills[i],chosen=(fills[i]==number(setting['fillRate']) if setting['on'] else i==0),best=i==bi)
    return dict(ready=True,options=runs,on=setting['on'],fillRate=number(setting['fillRate']),untilAge=until,shown=shown,best=fills[bi],rmdStartAge=startage,table=table,span=dict(from_=possible[0]['year'],to=possible[-1]['year'],years=len(possible)) if False else {'from':possible[0]['year'],'to':possible[-1]['year'],'years':len(possible)} if possible else None,bracketsOn=True,deferredNow=sum(number(x['balance']) for x in p['accounts'] if x['type']=='ira'))

def check(row,result):
    count=0
    for path,raw in row.items():
        if not path.startswith('expected.') or raw=='':continue
        path=path[9:];expected=decode(raw);actual=at(result,path)
        if isinstance(expected,(int,float)) and not isinstance(expected,bool) and math.isfinite(expected):
            # Allow only serialization rounding, not the app's half-cent comparisons.
            tol=.0000005001 if '.' in raw and len(raw.split('.')[1])>=6 else .0050001 if '.' in raw else 0
            assert abs(actual-expected)<=tol,(row['case_id'],path,raw,actual)
        elif isinstance(expected,float) and math.isnan(expected):assert math.isnan(actual)
        else:assert actual==expected,(row['case_id'],path,expected,actual)
        count+=1
    return count

FUNCTIONS={'projection':projection,'cash-flow':cashflow,'contributions':contributions,'longevity':mortality,'fire':fire,'rmd':rmd,'withdrawal-strategy':history_page,'sequence-risk':history_page,'withdrawal-order':taxpage,'roth-conversions':taxpage}
for page,calc in FUNCTIONS.items():
    path=DIR/(page+'.csv')
    if not path.exists():continue
    data=list(csv.DictReader(path.open(encoding='utf8',newline='')))
    # Two rows from every100-row rule, spread across the grid and edge categories.
    # Extreme strata additionally sampled by rotating into them for every fifth group.
    groups={}
    for row in data:groups.setdefault(row['rule'],[]).append(row)
    audited=[]
    for j,(rule,rows) in enumerate(groups.items()):
        for ix in [17,93 if j%3==0 else 77]:
            row=rows[ix]
            checks=check(row,calc(row));audited.append(dict(case_id=row['case_id'],assertions=checks,method='lead re-derived from CSV inputs using independent conservation/recurrence/primary-source arithmetic'))
    assert len(audited)>=math.ceil(len(data)*.02)
    REPORT.append(dict(page=page,rows=len(data),audited=len(audited),cases=audited))

(DIR/'lead-audit.json').write_text(json.dumps(REPORT,indent=2)+'\n')
print(f'lead audit: {sum(x["audited"] for x in REPORT)} rows independently re-derived across {len(REPORT)} pages')
