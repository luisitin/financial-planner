"""1,400 independent cases, no application imports. See tax_oracle.py sources."""
from common import case, write_page, ROOT
from tax_oracle import *
import csv

PAGE='withdrawal-order'
SOURCE='IRS RevProc2025-32 sections4.01/4.03/4.14 https://www.irs.gov/irb/2025-45_IRB; future indexing is hypothetical application assumption'
rows=[]

def note(i,s,proof):return s+('; SECOND: '+proof if (i+1)%10==0 else '')
def testparam(year=2026,infl='0.03'):return {'taxYear':year,'inflation':six(infl)}

for i in range(100):
    status=STATUSES[i%5];year=2026 if i%2==0 else 2056;p=tax_parameters(year,'0.025',status)
    income=D([0,10000,30000,60000,120000,300000,1000000][i%7])
    if 60<=i<90:income=p['tops'][(i-60)//5%6]+D(['-.01','0','.01'][i%3])
    if i>=90:income=D([0,.01,1000000000][i%3])
    o=ordinary(income,p);assert abs(o['tax']-ordinary_second(income,p))<D('.000001')
    rows.append(case(PAGE,'ordinary',i,'taxOnOrdinary',{'tax':cents(o['tax']),'bracketRate':six(o['bracketRate']),'roomInBracket':'Infinity' if o['roomInBracket'].is_infinite() else cents(o['roomInBracket'])},args={'0':cents(income),'1':status},params=testparam(year,'0.025'),note=note(i,SOURCE,f'base-plus-marginal formula yields {cents(o["tax"])} independently of bracket-width integration')))

for i in range(100):
    status=STATUSES[i%5];year=2026 if i%2==0 else 2056;p=tax_parameters(year,'0.03',status)
    o=D([0,10000,40000,100000,250000,600000][i%6]);q=D([1000,10000,50000,100000][i%4])
    if 60<=i<90:o=p['capital'][i%2]+D(['-.01','0','.01'][i%3]);q=D([0,.01,100][i%3])
    if i>=90:o=D([0,.01,1000000000][i%3]);q=D([.01,1000000000][i%2])
    answer=qualified(o,q,p)
    spans=[max(ZERO,min(o+q,p['capital'][0])-o),max(ZERO,min(o+q,p['capital'][1])-max(o,p['capital'][0])),max(ZERO,o+q-max(o,p['capital'][1]))]
    assert abs(answer-sum((v*r for v,r in zip(spans,[D(0),D('.15'),D('.2')])),ZERO))<D('.000001')
    rows.append(case(PAGE,'qualified',i,'taxOnQualified',{'tax':cents(answer)},args={'0':cents(o),'1':cents(q),'2':status},params=testparam(year),note=note(i,SOURCE+'; qualified interval stacked above ordinary taxable income',f'separate 0/15/20-percent overlap widths={list(map(str,spans))}, tax={cents(answer)}')))

for i in range(100):
    status=STATUSES[i%5];benefit=D([0,12000,24000,36000,60000][i%5]);other=D([0,10000,30000,60000,100000,300000][i%6]);exempt=D([0,1000,10000][i%3])
    base=D(32000 if status=='married_joint' else 25000);extra=D(12000 if status=='married_joint' else 9000)
    if 60<=i<90:benefit=D(12000);exempt=ZERO;other=base-benefit/2+extra*(i%2)+D(['-.01','0','.01'][i%3])
    if i>=90:benefit=D([0,.01,10000000][i%3]);other=D([0,1000000000][i%2]);exempt=ZERO
    answer=social(benefit,other,exempt,status);combined=other+exempt+benefit/2
    line10=max(ZERO,combined-base);line12=max(ZERO,line10-extra);line15=min(benefit/2,min(line10,extra)/2);line17=line15+D('.85')*line12
    assert abs(answer-min(line17,D('.85')*benefit))<D('.000001')
    rows.append(case(PAGE,'social',i,'taxableSocialSecurity',{'value':cents(answer)},args={'0':cents(benefit),'1':cents(other),'2':cents(exempt),'3':status},params=testparam(),note=note(i,'IRS Pub915 Worksheet1 https://www.irs.gov/publications/p915; married_separate assumes lived apart all year; benefits only, not SSA benefit calculation',f'worksheet lines10={line10},12={line12},15={line15},17={line17}; capped answer={cents(answer)}')))

for i in range(100):
    status=STATUSES[i%5];year=2026 if i%2==0 else 2056;seniors=i%3;p=tax_parameters(year,'0.02',status)
    expected=p['standard']+seniors*p['extra']
    rows.append(case(PAGE,'standard',i,'standardDeduction',{'value':cents(expected)},args={'0':status,'2':{'ages65plus':seniors}},params=testparam(year,'0.02'),note=note(i,SOURCE+'; standard plus age65 allowance per eligible person',f'{p["standard"]}+{seniors}*{p["extra"]}={expected}')))

for i in range(100):
    status=STATUSES[i%5];year=[2025,2026,2028,2029,2056][(i//5)%5];count=[0,1,2][i%3]
    if status!='married_joint':count=min(count,1)
    threshold=D(150000 if status=='married_joint' else 75000)
    income=threshold+D([0,10000,50000,100000,150000,200000][i%6])
    if 60<=i<90:income=threshold+D(['-.01','0','.01','99999.99','100000','100000.01'][i%6])
    if i>=90:income=D([0,.01,1000000000][i%3])
    ans=tax(income,year=year,status=status,seniors=count)
    # At one cent over the threshold, the missing second reduction is only
    # $0.0006: all asserted money fields agree within the $0.005 tolerance.
    # Keep that row as an ordinary passing boundary case rather than a TODO.
    todo='Senior phaseout must reduce each eligible $6000 amount; code reduces a combined couple amount only once.' if status=='married_joint' and count==2 and D('.005')<(income-threshold)*D('.06') and income-threshold<D(200000) and year<=2028 else ''
    if status=='married_separate' and count>0 and year<=2028 and income<D(175000):todo='IRS Schedule1-A excludes married-filing-separately from the senior deduction; code grants it.'
    # Source-year2025 HOH standard23625 must stay exact, not round to23650.
    if year==2025 and status=='head_of_household':todo='Published2025 head-of-household standard deduction23625 is rounded incorrectly to23650 by paramsFor.'
    rows.append(case(PAGE,'senior',i,'federalTax',{'deduction':{'standard':cents(ans['deduction']['standard']),'senior':cents(ans['deduction']['senior']),'amount':cents(ans['deduction']['amount'])},'totalTax':cents(ans['totalTax'])},args={'0':{'filingStatus':status,'otherOrdinary':cents(income),'ages65plus':count}},params=testparam(year),todo=todo,note=note(i,'IRC151(d)(5)(C); IRS Schedule1-A https://www.irs.gov/instructions/i1040gi; ages65+ eligible2025..2028; assumptions valid SSN and no foreign exclusion',f'each-person deduction=max(0,6000-.06*max(0,{income}-{threshold})); eligible count={count}; statutory filing restriction applied')))

for i in range(100):
    year=2025 if i%10<5 else 2026+(i%31);status=STATUSES[i%5];infl=['0','0.01','0.025','0.03','-0.01'][i%5]
    if i>=90:year=[2026,2056,2106,2126][i%4];infl=['0','0.01'][i%2]
    p=tax_parameters(year,infl,status)
    expected={'year':year,'status':{status:{'brackets':{str(j):cents(v) for j,v in enumerate(p['tops'])},'standardDeduction':cents(p['standard']),'extraAllowance':cents(p['extra']),'ltcgBrackets':{str(j):cents(v) for j,v in enumerate(p['capital'])}}}}
    todo='Published2025 head-of-household standard deduction23625 must remain exact; base-year rounding changes it by25.' if year==2025 and status=='head_of_household' else ''
    rows.append(case(PAGE,'indexing',i,'paramsFor',expected,args={'0':year,'1':{'inflation':six(infl)}},todo=todo,note=note(i,SOURCE+'; source-year values exact; future brackets nearest25 and deductions/gains nearest50; no CPI law prediction',f'growth=(1+{infl})^max(0,{year}-2026); independently scale each published threshold then integer-quotient nearest-unit rounding')))

for i in range(100):
    status=STATUSES[i%5];threshold=D(250000 if status in ['married_joint','qualifying_surviving'] else 125000 if status=='married_separate' else 200000)
    q=D([1000,10000,50000,100000][i%4]);o=threshold+D([0,10000,50000][i%3])-q
    if 60<=i<90:o=threshold-q+D(['-.01','0','.01'][i%3])
    if i>=90:q=D([.01,1000000000][i%2]);o=threshold+D([0,1000000000][i%2])
    ans=tax(o,q,status=status)
    rows.append(case(PAGE,'niit',i,'federalTax',{'niit':cents(ans['niit']),'totalTax':cents(ans['totalTax'])},args={'0':{'filingStatus':status,'otherOrdinary':cents(o),'qualifiedIncome':cents(q)}},params=testparam(),note=note(i,'IRS NIIT FAQs https://www.irs.gov/newsroom/questions-and-answers-on-the-net-investment-income-tax; 3.8% smaller of net investment income and MAGI over fixed threshold',f'.038*min({q},max(0,{o}+{q}-{threshold}))={cents(ans["niit"])}; total includes independently integrated ordinary and qualified tax')))

for rule in ['normalization','grossup','rmd','totals','estate','ranking','selection']:
    for i in range(100):
        year=2026 if i%2==0 else 2056;status='single' if i%3 else 'married_joint';age=64
        balances={'cash':D([0,10000,50000][i%3]),'taxable':D([5000,30000,100000][i%3]),'deferred':D([20000,100000,500000][i%3]),'free':D([1000,20000,50000][i%3])}
        spend=D([12000,24000,48000][i%3]);years=1+(i%3 if rule in ['totals','ranking'] else 0);infl='0.02' if rule=='totals' else '0'
        if rule=='rmd':age=75;balances['cash']=D(1000000)
        if rule in ['normalization','selection']:balances={'cash':D(1000000),'deferred':D(10000),'free':D(10000),'taxable':D(10000)}
        if 60<=i<90:
            spend=D([.12,12,1200000][i%3]);balances={k:D([0,.01,1000][i%3]) for k in balances}
        if i>=90:
            spend=D([.12,1200,120000000][i%3]);balances={k:D([.01,1000000000][i%2]) for k in balances};years=1
        selected=list(ORDERS.values())[i%4]
        mode='flat' if i%2 else 'brackets'
        plan=make_plan(year,age,years,balances,spend,status,inflation=infl,tax_mode=mode,order=selected)
        if rule=='selection' and i in [60,61,62]:
            plan={};expected={'ready':False,'options':{'length':0}}
            rows.append(case(PAGE,rule,i,'compute',expected,plan=plan,params={'today':f'{year}-01-01'},note=note(i,'Projection README readiness: adult, accounts, spending all required','missing inputs imply empty comparison options')));continue
        results={k:run(plan,year,order=v) for k,v in ORDERS.items()}
        score=lambda k:results[k]['endAfterTaxReal'] if results[k]['success'] else D(-10**12)+results[k]['failYear']
        best=max(ORDERS,key=score);worst=min(ORDERS,key=score)
        expected={'ready':True,'options':{'length':4}}
        if rule in ['normalization','selection']:
            expected.update({'current':list(ORDERS)[i%4],'bracketsOn':mode=='brackets'})
            for j,(key,order) in enumerate(ORDERS.items()):expected['options'][str(j)]={'key':key,'order':order,'current':j==i%4}
        elif rule=='ranking':
            expected.update({'best':best,'allFail':all(not r['success'] for r in results.values()),'gainVsWorst':cents(results[best]['endAfterTaxReal']-results[worst]['endAfterTaxReal'] if results[best]['success'] and results[worst]['success'] else ZERO),'taxSpread':cents(results[worst]['taxesReal']-results[best]['taxesReal'])})
            for j,key in enumerate(ORDERS):expected['options'][str(j)]={'best':key==best,'success':results[key]['success'],'failYear':results[key]['failYear']}
        else:
            selected_fields={'grossup':['taxesReal','endBalanceReal'],'rmd':['rmdReal'],'totals':['taxesReal','rmdReal'],'estate':['endBalanceReal','endAfterTaxReal','endTaxRate']}[rule]
            for j,key in enumerate(ORDERS):expected['options'][str(j)]={k:(six(results[key][k]) if k=='endTaxRate' else cents(results[key][k])) for k in selected_fields}
        proof=''
        if (i+1)%10==0:
            proof='; '.join(check_run(r,plan) for r in results.values())
        rows.append(case(PAGE,rule,i,'compute',expected,plan=plan,params={'today':f'{year}-01-01'},note=note(i,'Withdrawal-order README cash first; four orders; tax=IRS source; independent minimal-gross-withdrawal bisection; annual money conservation; no contributions',proof)))

path=write_page(PAGE,rows)
with path.open(newline='',encoding='utf8') as f:header=next(csv.reader(f))
brief=ROOT/'tests/golden/retirement/briefs/withdrawal-order.md';text=brief.read_text(encoding='utf8');marker='\n## Completed independent oracle'
if marker in text:text=text.split(marker)[0]
text+=marker+'\n\n14 rules ×100 cases =1,400. Each has60 grid/30 edge/10 extreme cases. Sources and\nindependent methods are `tax_oracle.py` and the row notes. Primitive parameters are\ninjected by the replay runner using `params.taxYear` and `params.inflation`. Source-year\nfigures are exact; only hypothetical later years receive rounding. Money uses final\nhalf-up cents; rates six places. SSA married-separate assumes lived apart all year.\nEvery tenth primitive uses alternate bracket/intersection/worksheet arithmetic; every\ntenth page uses conservation plus alternate tax integration.\n\nKnown disagreements: married-separate senior eligibility, phaseout applied to each\neligible senior separately, and unmodified2025 HOH deduction23625.\n\nExact header:\n```csv\n'+','.join(header)+'\n```\n'
text += f'\nExplicit source-disagreement TODO rows: {sum(bool(r.get("todo")) for r in rows)}. The $0.01-above-senior-phaseout boundary remains a passing case: its missing second reduction is $0.0006, within the $0.005 comparison tolerance.\n'
brief.write_text(text,encoding='utf8')
print(f'{len(rows)} rows, {sum(bool(r.get("todo")) for r in rows)} source-based TODOs: {path}')
