import json,glob,os,re
SP=os.environ['SP']+'/ux'
allv=[]; missed=[]; other=[]
def lens(l):
    l=(l or '').lower()
    for k in ['back','next','navig','focus','input','touch','smooth','choreo','underst']:
        if k in l: return {'navig':'navigate','choreo':'smooth','underst':'understand'}.get(k,k)
    return l or '?'
for f in sorted(glob.glob(SP+'/[jp]-*/verify/verified.json')):
    key=f.split('/')[-3]
    d=json.load(open(f))
    for it in d.get('verified',[]):
        it=dict(it); it['gid']=f"{key}/{it.get('id')}"; it['walker']=key; it['lens1']=lens(it.get('lens'))
        (allv if it.get('verdict') in ('confirmed','needs-real-phone') else other).append(it)
    for i,m in enumerate(d.get('missed') or []):
        s=m if isinstance(m,str) else json.dumps(m)
        mm=re.search(r'severity\s*(\d)',s)
        missed.append({'gid':f"{key}/m{i+1}",'walker':key,'text':s,'severity':int(mm.group(1)) if mm else None})
json.dump(allv,open(SP+'/synth/all.json','w'),indent=1)
json.dump(missed,open(SP+'/synth/missed.json','w'),indent=1)
json.dump(other,open(SP+'/synth/other.json','w'),indent=1)
def short(s,n): 
    s=' '.join(str(s or '').split()); return s if len(s)<=n else s[:n-1]+'…'
with open(SP+'/synth/index.tsv','w') as o:
    for it in sorted(allv,key=lambda x:(-int(x.get('severity') or 0),x['lens1'],x['gid'])):
        pg=it.get('pages'); pg=', '.join(pg) if isinstance(pg,list) else str(pg)
        o.write('\t'.join([it['gid'],str(it.get('severity')),it['lens1'],str(it.get('scope')),short(it.get('owner'),40),short(it.get('title'),230),short(pg,90)])+'\n')
with open(SP+'/synth/missed.tsv','w') as o:
    for m in sorted(missed,key=lambda x:(-(x['severity'] or 0),x['gid'])):
        o.write(m['gid']+'\t'+short(m['text'],330)+'\n')
with open(SP+'/synth/other.tsv','w') as o:
    for it in other:
        o.write('\t'.join([it['gid'],str(it.get('verdict')),short(it.get('title'),200),short(it.get('why'),200)])+'\n')
print(len(allv),'confirmed/needs-phone;',len(missed),'missed;',len(other),'other')
