"""Independent source-history permutations, geometric means and plan summaries.

Uses this worker's independent spending ledger, not production JavaScript or
production data. Sources and simplified assumptions are in the page brief.
"""
from math import exp, log, prod, isclose, isnan
from common import case,write_page,money,rate
from withdrawal_strategy import engine,make_plan,simulate,fixed_second,worst,HISTORY

ROWS=[];AUDITS=0


def sequences(inp,w):
    offset=max(0,inp['retireYear']-inp['startYear'])
    head=w['seq'][:offset];tail=w['seq'][offset:]
    # Sort whole observations, never independently sort the four asset columns.
    ascending=sorted(tail,key=lambda year:(year['stocks'],year['year']))
    descending=sorted(tail,key=lambda year:(-year['stocks'],year['year']))
    return [w['seq'],head+ascending,head+descending],tail


def geometric(tail,key):
    return prod(1+point[key] for point in tail)**(1/len(tail))-1 if tail else float('nan')


def summary(inp,seq=None):
    p=simulate(inp,seq,'fixed-real')
    return {'success':p['success'],'failAge':p['failAge'],'endReal':money(p['endBalanceReal']),
            'lowestReal':money(min(p['realBalances']))}


def answer(inp):
    n=inp['endYear']-inp['startYear']+1
    if n>len(HISTORY):return {'ready':False,'missing':['the plan is longer than the history on file']}
    w=worst(inp);variants,tail=sequences(inp,w)
    return {'ready':True,'startYear':w['startYear'],'years':n,
            'retireYear':inp['retireYear'],'spendingYearly':inp['spending']['yearly'],
            'average':{k:rate(geometric(tail,k)) if tail else float('nan') for k in ('stocks','bonds','inflation')},
            'runs':[{'key':key,**summary(inp,seq)} for key,seq in zip(('actual','worst-first','best-first'),variants)],
            'steady':summary(inp)}


def verify(inp,which):
    n=inp['endYear']-inp['startYear']+1
    if n>len(HISTORY):assert len(HISTORY)==98;return
    w=worst(inp,True);variants,tail=sequences(inp,w)
    split=max(0,inp['retireYear']-inp['startYear'])
    if which in ('tail-sort-paired','geometric-means'):
        for seq in variants:
            assert seq[:split]==w['seq'][:split]
            assert sorted(p['year'] for p in seq)==sorted(p['year'] for p in w['seq'])
            for point in seq:assert point in w['seq']
        for k in ('stocks','bonds','inflation'):
            if tail:
                second=exp(sum(log(1+p[k]) for p in tail)/len(tail))-1
                assert isclose(geometric(tail,k),second,abs_tol=1e-12)
            else:assert isnan(geometric(tail,k))
    for seq in variants+[None]:
        result=simulate(inp,seq,'fixed-real');fail,end,balances=fixed_second(inp,seq)
        assert fail==result['failAge']
        assert isclose(end,result['endBalanceReal'],abs_tol=.002,rel_tol=1e-11)
        assert isclose(min(balances),min(result['realBalances']),abs_tol=.002,rel_tol=1e-11)


def example(i,rule):
    year=2026 if i%2==0 else 2056
    n=1+i%25 if i<60 else [1,2,30,98,99][i%5] if i<90 else [1,2,80,98,120][i%5]
    b=[12000,120000,600000,2400000][i%4] if i<90 else [.01,1,1e6,1e8,1e9][i%5]
    s=[120,1200,12000,24000][i%4];d=i%min(5,n)
    if rule=='geometric-means' and i>=60 and i%4==0:d=n+1
    inp=engine(year,n,b,s,r=[0,.03,-.02,.10][i%4],f=[0,.02,.03,-.01][i%4],
               mix=[0,.5,1][i%3],delay=d)
    if rule=='tail-sort-paired' and i%3==0:
        # A cash reserve large enough to cover the full spending stream makes
        # the cash and stock paths independently checkable by discounted sums.
        inp['balances']['cash']=money(max(1e7,s*n*1000))
    return inp


def build():
    global AUDITS
    for rule in ('tail-sort-paired','geometric-means','run-summaries','steady-assumptions','history-readiness'):
        for i in range(100):
            inp=example(i,rule);p=make_plan(inp,couple=i%2==0);expected=answer(inp)
            if rule=='history-readiness':
                mode=i%10
                if mode==0:
                    p['household']['people']=[]
                    expected={'ready':False,'missing':['a person with a birth date on the People page']}
                elif mode==1:
                    p['accounts']=[]
                    expected={'ready':False,'missing':['your accounts on the Net worth page']}
                elif mode==2:
                    p['retirement']['spendingMonthly']='0.00'
                    expected={'ready':False,'missing':['what you will spend in retirement (a figure here, or your expenses on the Expenses page)']}
                elif mode==3:
                    for person in p['household']['people']:person['role']='dependent'
                    expected={'ready':False,'missing':['a person with a birth date on the People page']}
            note='Source: README tail-only paired-observation sort; NYU Damodaran frozen source; invented plan. '
            note+=f'Rule {rule}; {inp["endYear"]-inp["startYear"]+1} years; retire offset {inp["retireYear"]-inp["startYear"]}. '
            if expected.get('ready') and any(isinstance(x,float) and isnan(x) for x in expected['average'].values()):
                note+='Empty retirement tail: geometric mean is undefined, stored NaN, never zero. '
            if (i+1)%10==0:
                verify(inp,rule);AUDITS+=1
                note+='SECOND CHECK PASSED: source-year permutation and log-mean; each end/low/failure rederived by discounted liabilities independently of balance recurrence.'
            ROWS.append(case('sequence-risk',rule,i,'compute',expected,plan=p,
                             params={'today':f'{inp["startYear"]}-01-01'},note=note))


if __name__=='__main__':
    build();assert len(ROWS)==500 and AUDITS==50
    path=write_page('sequence-risk',ROWS)
    print(f'{path.name}: {len(ROWS)} rows; {AUDITS} second checks; no predeclared disagreements')
