import re,sys
p=sys.argv[1]
t=open(p,encoding='utf-8').read()
def rep(m):
    head, mine = m.group(1), m.group(2)
    return mine + head
t2,n=re.subn(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', rep, t, flags=re.S)
assert n>=1, n
open(p,'w',encoding='utf-8').write(t2)
print("resolved",n)
