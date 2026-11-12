#!/usr/bin/env python3
# Merges the detail agents' results (raw/*.json: lists of { id, summary, points, numbers, kind, shots: [{ file, caption }] })
# into enrich.json, turns each screenshot into a small WebP under img/, rebuilds log.json, and prints the image files to publish.
import json, os, glob, sys, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = '$REPO'
enrich = json.load(open(os.path.join(HERE, 'enrich.json'))) if os.path.exists(os.path.join(HERE, 'enrich.json')) else {}
made = []
def web(src, name, width=600, max_h=2600):
    out = os.path.join(HERE, 'img', name)
    im = Image.open(src).convert('RGB')
    if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    if im.height > max_h: im = im.crop((0, 0, im.width, max_h))
    im.save(out, 'WEBP', quality=72, method=5)
    return f'img/{name}'
for f in sorted(glob.glob(os.path.join(HERE, 'raw', '*.json'))):
    for r in json.load(open(f)):
        rid = r.get('id')
        if not rid: continue
        e = { k: r[k] for k in ('summary', 'points', 'numbers', 'kind') if r.get(k) }
        shots = []
        for k, s in enumerate(r.get('shots') or []):
            p = s.get('file', '')
            if not p.startswith('/'): p = os.path.join(REPO, p)
            if not os.path.exists(p): print('missing', rid, p, file=sys.stderr); continue
            name = f'{rid}-{k + 1}.webp'
            if not os.path.exists(os.path.join(HERE, 'img', name)):   # a picture is frozen once made: the log is history
                web(p, name); made.append(f'img/{name}')
            shots.append({ 'src': f'img/{name}', 'caption': s.get('caption', '') })
        if shots: e['shots'] = shots
        enrich[rid] = { **enrich.get(rid, {}), **e }
json.dump(enrich, open(os.path.join(HERE, 'enrich.json'), 'w'), indent=1)
subprocess.run([sys.executable, os.path.join(HERE, 'gen.py')], check=True)
json.dump(made, open(os.path.join(HERE, 'made.json'), 'w'))
print(len(enrich), 'entries with details;', len(made), 'new images;', sum(os.path.getsize(os.path.join(HERE, m)) for m in made) // 1024, 'KB')
