import json,glob,os
SP='$SP/ux'
tot=0; ver=0; conf=0; walk=0
rows=[]
for d in sorted(glob.glob(SP+'/[jp]-*')):
    k=os.path.basename(d); f=d+'/findings.json'; v=d+'/verify/verified.json'
    n='-'
    if os.path.exists(f):
        try: n=len(json.load(open(f)).get('findings',[])); tot+=n; walk+=1
        except Exception: n='bad'
    vv='.'
    if os.path.exists(v):
        try:
            vs=json.load(open(v)).get('verified',[]); c=sum(1 for x in vs if x.get('verdict')=='confirmed'); vv=f'{c}/{len(vs)}'; ver+=1; conf+=c
        except Exception: vv='bad'
    rows.append(f'{k}:{n}:{vv}')
print(' '.join(rows))
print(f'walkers with findings {walk}/26, raw findings {tot}; verified walkers {ver}/26, confirmed {conf}')
