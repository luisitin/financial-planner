#!/usr/bin/env python3
# Swaps a details workflow's checked batches in for the unchecked ones (raw/<prefix>-<k>.json), drops their old pictures so
# they are remade from the checked shots, rebuilds, and prints the files to publish (log.json + the images remade).
import json, os, sys, glob, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
journal, wave = sys.argv[1], sys.argv[2]
labels, det, chk = {}, {}, {}
for l in open(journal):
    j = json.loads(l)
    if j.get('type') == 'started': labels[j['key']] = j['label']
    elif j.get('type') == 'result':
        kind, k = labels.get(j['key'], '?:?').split(':')
        (det if kind == 'details' else chk)[k] = j['result']['entries']
swapped = []
for k, ents in chk.items():
    un = os.path.join(HERE, 'raw', f'a-unchecked-{wave}-{k}.json')
    legacy = os.path.join(HERE, 'raw', f'a-unchecked2-{k}.json') if wave == 'wave2' else None
    target = os.path.join(HERE, 'raw', f'{wave}-{k}.json')
    if os.path.exists(target) and json.load(open(target)) == ents: continue
    for f in (un, legacy):
        if f and os.path.exists(f): os.remove(f)
    for e in ents:
        for f in glob.glob(os.path.join(HERE, 'img', f"{e['id']}-*.webp")): os.remove(f)
    json.dump(ents, open(target, 'w'), indent=1); swapped.append(k)
for k, ents in det.items():
    if k not in chk: json.dump(ents, open(os.path.join(HERE, 'raw', f'a-unchecked-{wave}-{k}.json'), 'w'), indent=1)
subprocess.run([sys.executable, os.path.join(HERE, 'build.py')], check=True, stdout=subprocess.DEVNULL)
made = json.load(open(os.path.join(HERE, 'made.json')))
print('swapped', swapped, file=sys.stderr)
print(json.dumps([{'path': 'log.json'}] + [{'path': m} for m in made]))
