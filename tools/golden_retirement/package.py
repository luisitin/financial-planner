"""Create manifest and requested full-file delivery; no application imports."""
from pathlib import Path
import csv
import hashlib
import json
import re
import zipfile
from common import formatted

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/'tests/golden/retirement'
files=sorted(DIR.glob('*.csv'))
coverage=[]
for path in files:
    with path.open(encoding='utf-8',newline='') as f:
        reader=csv.DictReader(f);header=reader.fieldnames;rows=list(reader)
    # Apply the common money/rate text precision to already derived numbers.
    # This is not a new oracle and reads no application output.
    rows=[{k:formatted(k,v) if v!='' else '' for k,v in row.items()} for row in rows]
    with path.open('w',encoding='utf8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=header,lineterminator='\n');writer.writeheader();writer.writerows(rows)
    rules={}
    for row in rows:
        x=rules.setdefault(row['rule'],dict(grid=0,edge=0,extreme=0,secondChecks=0,todo=0))
        x[row['kind']]+=1;x['todo']+=bool(row['todo'])
        if int(row['case_id'].split('-')[-1])%10==0:
            assert 'second' in row['note'].lower(),row['case_id']
            x['secondChecks']+=1
    for rule,x in rules.items():
        assert [x[k] for k in ['grid','edge','extreme']]==[60,30,10],(path,rule,x)
        assert x['secondChecks']==10
    coverage.append(dict(page=path.stem,rows=len(rows),rules=rules,todo=sum(bool(r['todo']) for r in rows),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    brief=DIR/'briefs'/(path.stem+'.md');text=brief.read_text(encoding='utf8');marker='\n## Replay manifest'
    if marker in text:text=text.split(marker)[0]
    text+=marker+'\n\nExact fixed CSV layout (input columns precede expected columns):\n\n```csv\n'+','.join(header)+'\n```\n\n'
    text+='| Rule | Grid | Edge | Extreme | Second checks | TODO |\n|---|---:|---:|---:|---:|---:|\n'
    for rule,x in rules.items():text+=f'| {rule} | {x["grid"]} | {x["edge"]} | {x["extreme"]} | {x["secondChecks"]} | {x["todo"]} |\n'
    brief.write_text(text,encoding='utf8')
(DIR/'coverage.json').write_text(json.dumps(coverage,indent=2)+'\n',encoding='utf8')
report=DIR/'DISAGREEMENTS.md'
bundle=ROOT/'retirement-answer-keys.md'
parts=['# Retirement answer keys\n\nTen CSV files, the complete replay runner, and the portable test launcher/configuration. Drop the first `# path:` line when saving each block.\n\n']
if report.exists():parts.append(report.read_text(encoding='utf8')+'\n\n')
for path in files+[ROOT/'tests/golden-retirement.test.mjs',ROOT/'tools/run-tests.mjs',ROOT/'package.json']:
    language='csv' if path.suffix=='.csv' else 'json' if path.suffix=='.json' else 'javascript'
    relative=path.relative_to(ROOT).as_posix()
    parts.append(f'```{language}\n# path: {relative}\n'+path.read_text(encoding='utf8').rstrip()+'\n```\n\n')
bundle.write_text(''.join(parts),encoding='utf8')
archive=ROOT/'retirement-answer-keys.zip'
paths=files+[ROOT/'tests/golden-retirement.test.mjs',ROOT/'tools/run-tests.mjs',ROOT/'package.json',ROOT/'CHANGELOG.md',ROOT/'.gitignore',ROOT/'.leakguard-allow']
paths+=list((DIR/'briefs').glob('*.md'))+list((DIR/'sources').glob('*'))+list(DIR.glob('*.json'))+list(DIR.glob('*.md'))+list((ROOT/'tools/golden_retirement').glob('*.py'))+list((ROOT/'tools/golden_retirement').glob('*.md'))
paths+=[ROOT/'modules/retirement'/p.stem/'README.md' for p in files]
manifest=DIR/'FILES.md'
paths.append(manifest)
manifest.write_text('# Files added or changed\n\n'+''.join('- `'+p.relative_to(ROOT).as_posix()+'`\n' for p in sorted(set(paths)))+'\nDownload exports (generated and git-ignored):\n\n- `retirement-answer-keys.md`\n- `retirement-answer-keys.zip`\n',encoding='utf8')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for path in sorted(set(paths)):
        if path.is_file():z.write(path,path.relative_to(ROOT).as_posix())
print(f'{sum(x["rows"] for x in coverage)} rows; {sum(x["todo"] for x in coverage)} explicit TODOs; delivery {bundle.stat().st_size:,} bytes')
