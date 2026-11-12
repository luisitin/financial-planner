#!/usr/bin/env python3
# Builds impact.json for gen.py from the ranking workflow (impact-raw.json) and the line checks (impact-verified.json, optional).
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
raw = json.load(open(os.path.join(HERE, 'impact-raw.json')))
ver = json.load(open(os.path.join(HERE, 'impact-verified.json'))) if os.path.exists(os.path.join(HERE, 'impact-verified.json')) else {}
out = {}
for e in raw['entries']:
    parts = e['reach'] + e['size'] + e['trust']
    v = ver.get(e['id'], {})
    it = { 'score': e['score'], 'reach': e['reach'], 'size': e['size'], 'trust': e['trust'], 'why': v.get('why') or e['why'] }
    if parts != e['score']:
        it['before'] = parts
        it['change'] = v.get('reason_plain') or ''
    out[e['id']] = it
json.dump(out, open(os.path.join(HERE, 'impact.json'), 'w'), indent=1)
print(len(out), 'scored;', sum(1 for x in out.values() if 'before' in x), 'moved by the second check;', sum(1 for k in out if ver.get(k, {}).get('why')), 'lines rewritten')
