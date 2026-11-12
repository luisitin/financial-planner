import sys, json
# usage: rep.py FILE < json [[old, new], ...]; each old must occur exactly once
f = sys.argv[1]
pairs = json.load(sys.stdin)
s = open(f, encoding="utf8").read()
for old, new in pairs:
    n = s.count(old)
    if n != 1:
        sys.exit(f"{f}: {n} matches for: {old[:120]!r}")
    s = s.replace(old, new)
open(f, "w", encoding="utf8").write(s)
print(f"{f}: {len(pairs)} edits")
