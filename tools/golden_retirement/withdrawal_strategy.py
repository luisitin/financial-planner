"""Independent spending-strategy oracle from the written retirement briefs.

No JavaScript or repository returns are imported. Asset histories come from the
separately downloaded NYU workbook. Single untaxed bucket examples isolate the
spending policies; taxes/bucket rules have their own golden pages.
"""
from copy import deepcopy
from math import prod, isclose
from common import case, write_page, money, rate
from history_source import load, URL

HISTORY=load()
POLICIES=('fixed-real','percent','guardrails','vpw')


def engine(year=2026,n=10,balance=100000,spending=4000,r=.03,f=.02,mix=.5,delay=0):
    return {'startYear':year,'endYear':year+n-1,'retireYear':year+delay,
            'people':[{'name':'Example A','birthYear':year-60,'retireAge':60+delay,'endAge':59+n}],
            'balances':{'cash':0,'taxable':money(balance),'deferred':0,'free':0},
            'contributions':[],'incomes':[],'spending':{'yearly':money(spending)},
            'rates':{'inflation':rate(f),'cash':rate(r),'salaryGrowth':'0.000000','taxRate':'0.000000',
                     'stocksNow':rate(mix),'stocksRetired':rate(mix)},
            'returns':{'stocks':rate(r),'bonds':rate(r)},'rmd':None,
            'strategy':'fixed-real','withdrawalRate':'0.040000'}


def make_plan(inp, chosen='fixed-real', couple=False):
    year=inp['startYear'];n=inp['endYear']-year+1;d=inp['retireYear']-year
    people=[{'id':'a','name':'Example A','birthDate':f'{year-60}-01-01','role':'self',
             'retirementAge':60+d,'lifeExpectancy':59+n}]
    if couple:
        people.append({'id':'b','name':'Example B','birthDate':f'{year-57}-12-31','role':'partner',
                       'retirementAge':57+d,'lifeExpectancy':56+n})
    accounts=[{'id':'x','name':'Example fund','type':'brokerage','balance':inp['balances']['taxable'],'ownerId':'a'}]
    if float(inp['balances']['cash']):
        accounts.append({'id':'c','name':'Example cash','type':'savings','balance':inp['balances']['cash'],'ownerId':'a'})
    return {'household':{'people':people},'accounts':accounts,
            'retirement':{'spendingMonthly':money(float(inp['spending']['yearly'])/12),'strategy':chosen,
                          'withdrawalRate':inp['withdrawalRate'],'taxRate':'0.000000',
                          'stocksNow':inp['rates']['stocksNow'],'stocksRetired':inp['rates']['stocksRetired']},
            'assumptions':{'inflation':inp['rates']['inflation'],'returnStocks':inp['returns']['stocks'],
                           'returnBonds':inp['returns']['bonds'],'returnCash':inp['rates']['cash'],
                           'salaryGrowth':'0.000000'}}


def annuity(balance,r,n,due=False):
    # Price a unit-income stream directly by its discounted payments.
    start=0 if due else 1
    return balance/sum((1+r)**(-k) for k in range(start,start+n))


def simulate(inp,seq=None,strategy=None):
    """Cash conservation for an untaxed invested bucket; no production loops."""
    n=inp['endYear']-inp['startYear']+1;delay=inp['retireYear']-inp['startYear']
    invested=float(inp['balances']['taxable']);cash=float(inp['balances']['cash']);price=1.;base=float(inp['spending']['yearly'])
    wr=float(inp['withdrawalRate']);kind=strategy or inp['strategy'];spends=[];balances=[];short=[]
    guard=None;prior_real=None;fail=None;rows=[]
    for j in range(n):
        step=seq[j] if seq is not None else {'stocks':float(inp['returns']['stocks']),
             'bonds':float(inp['returns']['bonds']),'inflation':float(inp['rates']['inflation'])}
        inflation=step['inflation'];mix=float(inp['rates']['stocksRetired'])
        r=mix*step['stocks']+(1-mix)*step['bonds']
        if j:price*=1+inflation
        spend=0.;b=invested+cash
        if j>=delay:
            if kind=='fixed-real':spend=base*price
            elif kind=='percent':spend=max(0,b*wr)
            elif kind=='vpw':spend=max(0,annuity(b,max(-.5,(1+r)/(1+inflation)-1),n-j,True))
            else:
                if guard is None:guard=base*price
                elif (guard/b if b>0 else 1)>wr*1.2:guard*=.9
                elif (guard/b if b>0 else 1)<wr*.8:guard*=1.1
                elif prior_real is not None and prior_real>=0:guard*=1+inflation
                spend=guard
        need=max(0,spend);cash_take=min(max(0,cash),need)
        invested_take=min(max(0,invested),need-cash_take);taken=cash_take+invested_take;lack=max(0,need-taken)
        if lack>.005 and fail is None:fail=60+j
        cash=(cash-cash_take)*(1+step.get('cash',float(inp['rates']['cash'])))
        invested=(invested-invested_take)*(1+r);b=cash+invested
        rows.append({'spending':money(spend),'spendingReal':money(spend/price),'totalReal':money(b/price),
                     'shortfall':money(lack),'retired':j>=delay})
        spends.append(spend/price);balances.append(b/price);short.append(lack)
        prior_real=(1+r)/(1+inflation)-1
    retired=spends[delay:] if delay<n else []
    return {'rows':rows,'success':fail is None,'failAge':fail,'endBalanceReal':b/price if n else 0,
            'summary':{'firstYear':money(retired[0] if retired else 0),'lowest':money(min(retired) if retired else 0),
                       'highest':money(max(retired) if retired else 0),'endReal':money(b/price if n else 0),
                       'success':fail is None,'failAge':fail},'realBalances':balances}


def fixed_second(inp,seq=None):
    """Discounted-liability calculation; independent of balance recurrence."""
    n=inp['endYear']-inp['startYear']+1;delay=inp['retireYear']-inp['startYear']
    b=float(inp['balances']['taxable']);cash=float(inp['balances']['cash']);spend=float(inp['spending']['yearly']);mix=float(inp['rates']['stocksRetired'])
    growth=price=cash_growth=1.;liability=cash_liability=0.;fail=None;balances=[]
    for j in range(n):
        s=seq[j] if seq is not None else {**{k:float(inp['returns'][k]) for k in ('stocks','bonds')},'inflation':float(inp['rates']['inflation'])}
        if j:price*=1+s['inflation']
        if j>=delay:
            liability+=max(0,spend)*price/growth
            cash_liability+=max(0,spend)*price/cash_growth
        if b-liability < -.005/growth and fail is None:fail=60+j
        growth*=1+mix*s['stocks']+(1-mix)*s['bonds']
        cash_growth*=1+s.get('cash',float(inp['rates']['cash']))
        if cash:
            assert cash>=cash_liability,'second formula assumes cash independently covers spending'
            fail=None
            balances.append((b*growth+(cash-cash_liability)*cash_growth)/price)
        else:balances.append(max(0,b-liability)*growth/price)
    return fail,balances[-1] if balances else 0,balances


def worst(inp,verify=False):
    n=inp['endYear']-inp['startYear']+1
    if n>len(HISTORY):return None
    candidates=[]
    for j in range(len(HISTORY)-n+1):
        seq=HISTORY[j:j+n];result=simulate(inp,seq,'fixed-real')
        # The stated rule is lexicographic: earliest failure, then lowest end,
        # then earliest start for a tie. No magic weighted score is necessary.
        key=(result['failAge'] if result['failAge'] is not None else 10**8,
             result['endBalanceReal'],HISTORY[j]['year'])
        candidates.append((key,j))
    _,at=min(candidates)
    if verify:
        alternative=[]
        for j in range(len(HISTORY)-n+1):
            fail,end,_=fixed_second(inp,HISTORY[j:j+n])
            alternative.append(((fail if fail is not None else 10**8,end,HISTORY[j]['year']),j))
        assert min(alternative)[1]==at,(min(alternative),at)
    return {'startYear':HISTORY[at]['year'],'seq':HISTORY[at:at+n]}


def page_summary(inp):
    w=worst(inp)
    return {'ready':True,'chosen':inp['strategy'] if inp['strategy'] in POLICIES else 'fixed-real',
            'spendingYearly':inp['spending']['yearly'],'withdrawalRate':inp['withdrawalRate'],
            'worstStartYear':w['startYear'] if w else None,
            'rows':[{'key':p,'expected':simulate(inp,strategy=p)['summary'],
                     'worst':simulate(inp,w['seq'],p)['summary'] if w else None} for p in POLICIES]}


ROWS=[];AUDITS=0


def add(rule,i,expected,*,inp=None,plan=None,target='project',options=None,args=None,note='',todo='',check=None):
    global AUDITS
    if (i+1)%10==0:
        assert check is not None;check();AUDITS+=1
        note+=' SECOND CHECK PASSED: discounted liabilities / analytic payment identity / independent threshold inequalities as applicable.'
    ROWS.append(case('withdrawal-strategy',rule,i,target,expected,inputs=inp,plan=plan,
                     params={'today':f"{inp['startYear'] if inp else plan.get('_year',2026)}-01-01"} if target=='compute' else None,
                     options=options,args=args,note='Source: Projection README simplified policy; invented amounts. '+note,todo=todo))


def close(a,b):assert isclose(a,b,abs_tol=.003,rel_tol=1e-11),(a,b)


def build():
    global AUDITS
    for policy in POLICIES:
        for i in range(100):
            year=2026 if i%2==0 else 2056;n=1+i%30 if i<60 else [1,2,3,30,50][i%5] if i<90 else [1,2,60,100,120][i%5]
            b=[10000,100000,500000,2000000][i%4] if i<60 else [0,.01,1,1000,12000][i%5] if i<90 else [.01,1e6,1e9,1e10,100][i%5]
            s=[120,1200,12000,24000][i%4] if i<90 else [.01,1e6,1e7,0,1][i%5]
            r=[0,.03,-.02,.10][i%4];f=[0,.02,.03,-.01][i%4]
            inp=engine(year,n,b,s,r,f);inp['strategy']=policy
            if policy=='percent':inp['withdrawalRate']=rate([0,.000001,.04,.5,1][i%5] if i>=60 else [.02,.04,.06,.10][i%4])
            if policy=='guardrails' and i>=60:
                # Exact32/48 per1000 and immediately adjacent, set next balance
                # by specifying a zero-return first year and a matching balance.
                q=[.032,.048,.031999,.048001,.04][i%5];s=1200.;n=2
                inp=engine(year,n,round(s+s/q,2),s,0,.02);inp['strategy']=policy
            result=simulate(inp)
            expected={k:result[k] for k in ('success','failAge')};expected['endBalanceReal']=money(result['endBalanceReal'])
            expected['rows']={'0':result['rows'][0],str(inp['endYear']-year):result['rows'][-1]}
            def check():
                if policy=='fixed-real':
                    fail,end,_=fixed_second(inp);assert fail==result['failAge'];close(end,result['endBalanceReal'])
                elif policy=='percent':
                    g=(1-float(inp['withdrawalRate']))*(1+r)
                    close(b*g**n/(1+f)**(n-1),result['endBalanceReal'])
                elif policy=='vpw':
                    real=max(-.5,(1+r)/(1+f)-1)
                    payment=b/n if real==0 else b*real/(1-(1+real)**(-n))/(1+real)
                    close(payment,annuity(b,real,n,True))
                    close(payment*sum((1+real)**(-k) for k in range(0,n)),b)
                else:
                    first=float(result['rows'][0]['spending']);assert first==float(inp['spending']['yearly'])
                    # Reconstruct second-year threshold in balance units.
                    if len(result['rows'])>1:
                        bal=(float(inp['balances']['taxable'])-first)*(1+float(inp['returns']['stocks']))
                        predicted=first*(.9 if bal<first/.048 else 1.1 if bal>first/.032 else 1+float(inp['rates']['inflation']) if float(inp['returns']['stocks'])>=float(inp['rates']['inflation']) else 1)
                        close(predicted,float(result['rows'][1]['spending']))
            add(policy,i,expected,inp=inp,check=check,note='Full annual path, first/last nominal and real spending, and depletion; no taxes or external income.')

    for i in range(100):
        # The beginning-year unit-payment PV includes k=0. Since 2026-10-30 (F-030) the app pays VPW at the
        # start of the year, so the vpw group above uses the same timing and these rows carry no TODO.
        n=1+i%30 if i<90 else [1,1,60,100,120][i%5];b=[1000,100000,1000000,.01,1e9][i%5]
        r=[0,.03,-.02,.1,-.5][i%5];inp=engine(2026 if i%2==0 else 2056,n,b,1200,r,0);inp['strategy']='vpw'
        payment=annuity(b,r,n,True);endpay=annuity(b,r,n)
        todo=''
        add('vpw-beginning-timing',i,{'rows':{'0':{'spending':money(payment)}}},inp=inp,todo=todo,
            note=f'Beginning-year PV=sum(k=0..{n-1}) discount; due payment={payment:.8f}; ordinary payment={endpay:.8f}.',
            check=lambda:close(payment*(1+r),endpay))

    for i in range(100):
        n=1+i%30 if i<60 else [1,2,30,98,99][i%5] if i<90 else [1,2,80,98,150][i%5]
        year=2026 if i%2==0 else 2056;b=[10000,100000,500000,2000000][i%4] if i<90 else [0,.01,1e8,1e9,1e10][i%5]
        inp=engine(year,n,b,1200+1200*(i%5),mix=[0,.5,1][i%3]);w=worst(inp)
        expected={'startYear':w['startYear']} if w else {'value':None}
        add('worst-history-selection',i,expected,target='worstWindow',args=[inp],check=lambda:worst(inp,True),
            note=f'Every full {n}-year NYU window; lexicographic failure/end/start tie rule. Source {URL}; six-decimal source contract.')

    for i in range(100):
        year=2026 if i%2==0 else 2056;n=1+i%20 if i<60 else [1,2,30,98,99][i%5] if i<90 else [1,2,80,98,120][i%5]
        inp=engine(year,n,[12000,120000,600000,2400000][i%4],[1200,12000,24000,36000][i%4],
                   [0,.03,-.02,.10][i%4],[0,.02,.03,-.01][i%4],mix=[0,.5,1][i%3],delay=min(i%3,n-1))
        inp['strategy']=POLICIES[i%4];p=make_plan(inp,inp['strategy'],couple=i%2==0);p['_year']=year
        expected=page_summary(inp)
        def check():
            w=worst(inp,True)
            for seq in [None]+([w['seq']] if w else []):
                fail,end,_=fixed_second(inp,seq);result=simulate(inp,seq,'fixed-real');assert fail==result['failAge'];close(end,result['endBalanceReal'])
        add('page-spending-summaries',i,expected,target='compute',inp=inp,plan=p,check=check,
            note=f'Four policies: first/min/max retired spending, end purchasing power, failure; includes {n}-year history availability.')

    for i in range(100):
        year=2026 if i%2==0 else 2056;inp=engine(year,3,120000,1200);choice=['percent','vpw','guardrails','unknown',None][i%5]
        p=make_plan(inp,choice);p['_year']=year;mode=i%10
        if mode==0:p['household']['people']=[]
        if mode==1:p['household']['people'][0]['role']='dependent'
        if mode==2:p['household']['people'][0].pop('birthDate')
        if mode==3:p['accounts']=[]
        if mode==4:p['retirement']['spendingMonthly']='0.00'
        if mode<=4:
            messages=[]
            if mode<=2:messages.append('a person with a birth date on the People page')
            if mode==3:messages.append('your accounts on the Net worth page')
            if mode==4:messages.append('what you will spend in retirement (a figure here, or your expenses on the Expenses page)')
            expected={'ready':False,'missing':messages}
        else:expected={'ready':True,'chosen':choice if choice in POLICIES else 'fixed-real','spendingYearly':'1200.00'}
        add('page-readiness-defaults',i,expected,target='compute',inp=inp,plan=p,
            check=lambda:close(float(p['retirement']['spendingMonthly'])*12,1200 if mode!=4 else 0),
            note='Explicit missing prerequisite and selected/invalid/missing policy, using deterministic today.')


if __name__=='__main__':
    build();assert len(ROWS)==800 and AUDITS==80
    path=write_page('withdrawal-strategy',ROWS)
    print(f'{path.name}: {len(ROWS)} rows; {AUDITS} second checks; {sum(bool(r.get("todo")) for r in ROWS)} TODOs')
