#!/usr/bin/env python3
# Builds log.json for the build-log artifact from the repo's git history plus enrich.json (details and pictures added later).
import subprocess, re, json, os, sys, datetime
REPO = '$REPO'
HERE = os.path.dirname(os.path.abspath(__file__))
def git(*a): return subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True).stdout
out = git('log', '--reverse', '--format=%x1e%h%x1f%ad%x1f%an%x1f%s%x1f%B', '--date=format:%Y-%m-%d %H:%M')
enrich = json.load(open(os.path.join(HERE, 'enrich.json'))) if os.path.exists(os.path.join(HERE, 'enrich.json')) else {}
# impact.json: { id: { score, tier, why, reach, size, trust } } from the impact-ranking workflow
impact = json.load(open(os.path.join(HERE, 'impact.json'))) if os.path.exists(os.path.join(HERE, 'impact.json')) else {}
def promoted(h):
    d = git('show', h, '--format=', '--', 'modules/*/*/module.js')
    return bool(re.search(r'^-.*placeholder', d, re.M) or re.search(r'^new file mode', d, re.M))
def kind_of(s, h):
    t = s.lower()
    if t.startswith(('workboard', 'merge')): return 'coordination'
    if promoted(h): return 'new-page'
    if t.startswith('workboard') or 'claims' in t and 'workboard' in t: return 'coordination'
    if 'answer key' in t and ('baseline' in t or 'answer key for' in t or t.startswith(('tax lots answer key', 'property answer key', 'contribution limits answer key'))): return 'answer-key'
    if 'answer key' in t or 'golden' in t: return 'answer-key'
    if any(w in t for w in ('fix', 'review', 'agree', 'wrong', 'figures audit', 'now ', 'no longer')): return 'fix'
    if any(w in t for w in ('leak guard', 'smoke', 'screenshot', 'drive tools', 'tool', 'registry')): return 'tooling'
    return 'improvement'
items = []
for r in out.split('\x1e'):
    if not r.strip(): continue
    h, d, a, s, b = r.split('\x1f', 4)
    m = re.search(r'^Agent: (\S+)', b, re.M)
    if m: who = m.group(1)
    elif a == 'Claude': who = 'claude-a'   # the lead session's commits before the board added agent tags
    else: who = 'owner'
    if who == 'owner': continue
    body = b.split('\n', 1)[1] if '\n' in b else ''
    body = re.sub(r'\n(Agent|Co-Authored-By|Claude-Session|Prompt):.*', '', body).strip()
    files = [l.split('\t')[-1] for l in git('show', '--name-status', '--format=', h).strip().split('\n') if l]
    pages = sorted({'/'.join(f.split('/')[1:3]) for f in files if f.startswith('modules/') and f.count('/') >= 3 and not f.startswith('modules/_')})
    it = { 'id': h, 'date': d, 'session': who, 'tagged': bool(m), 'kind': kind_of(s, h), 'title': s, 'message': body, 'files': len(files), 'pages': pages }
    it.update(enrich.get(h, {}))
    if h in impact and it['kind'] != 'coordination': it['impact'] = impact[h]
    items.append(it)
items.reverse()   # newest first
stats = {}
for i in items: stats[i['session']] = stats.get(i['session'], 0) + 1
# the newest full test run's count (the pre-push checks save it in the scratchpad)
tests = None
logs = [f for f in (os.path.join(HERE, '..', n) for n in ('test.log', 'wt-test.log')) if os.path.exists(f)]
for f in sorted(logs, key=os.path.getmtime, reverse=True):
    m2 = re.search(r'^# tests (\d+)', open(f, errors='ignore').read()[-4000:], re.M)
    if m2: tests = int(m2.group(1)); break
detailed = sum(1 for i in items if i.get('summary'))
pictures = sum(len(i.get('shots') or []) for i in items)
scored = sum(1 for i in items if i.get('impact'))
log = { 'tests': tests, 'detailed': detailed, 'pictures': pictures, 'scored': scored, 'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'first': items[-1]['date'], 'last': items[0]['date'], 'stats': stats, 'items': items }
json.dump(log, open(os.path.join(HERE, 'log.json'), 'w'), indent=1)
print(len(items), stats, {k: sum(1 for i in items if i['kind'] == k) for k in ('new-page', 'answer-key', 'fix', 'improvement', 'tooling', 'coordination')})
