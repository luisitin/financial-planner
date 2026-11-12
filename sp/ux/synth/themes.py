# theme -> index-v1.tsv line numbers (assigned by claude-b after reading every verified finding)
import json,os,re,sys,collections
SP=os.environ['SP']+'/ux/synth'
T={
'SH-BACK':[9,11,13,14,16,19,25,26,28,29,31,70,72,76,77,85],
'SH-DRAFT':[1,5,6,8,15,17,18,22,23,27,30,36,69,79,80,82,189],
'SH-REDRAW':[10,55,60,109,150,165,166,170,171,173,224],
'SH-TAP':[59,62,63,65,66,169,174,175,176,227],
'SH-SEARCH':[34,40,41,43,46,51,84,103,132],
'SH-MENU':[73,100,129,130,167,220,234],
'SH-TOPBAR':[128,141],
'SH-ADDR':[131],
'SH-WAYBACK':[71,74,75],
'UI-ERR':[39,44,45,64,112,114,119,120,122,123,124,198,199,200,201,202],
'UI-ENTER':[194,196],
'UI-EDIT':[32,78,91,101,106],
'UI-UNDO':[21,24,81,86,88,89,90,190,226],
'UI-LIVE':[102,105,111],
'UI-RESULT':[35,37,104,110,168,192],
'UI-TARGET':[159,208,209,225,228,229],
'FL-SETUP':[2,7,33,47,49,54,97,98,108,113,115,116,117,178,179,180,185,191,233],
'FL-HOME':[53,95,127,134,142,145,148,156,177,204,206,207,210,211,216,217,231],
'FL-CHECKIN':[12,50,94,143,146,147,157,183,184,205,212,221,232,235],
'PG-EMPTY':[52,56,57,136,151,152,153,163,164,182,215,218],
'PG-BALCASH':[92,93,135,137,139,154,197,236,237],
'PG-DEBT':[4,195,219,230,241,242],
'PG-RETIRE':[48,67,68,87,96,140,144,149,158,160,161,162,181,186,187,188,222,223,243],
'PG-TAXINV':[83,107,121,155,193],
'PG-TXN':[3,20,38,42,58,125,126,172,203],
'A-LANE':[61,118,133,138,213,214,238,239,240],
'PHONE':[99],
}
TITLE={
'SH-BACK':"Back, Forward and Reload return to the same spot with the same sections open; on-screen back links behave like Back",
'SH-DRAFT':"What was typed but not saved is not lost: on leaving and coming back, on a reload, on a save elsewhere on the same page; Back with a form open",
'SH-REDRAW':"After a save the page is rebuilt: open sections shut, the screen jumps, the confirmation is off screen, notices that leave move the page",
'SH-TAP':"A second tap lands on whatever the redraw or the new page put under the thumb; no sign of life on slow pages",
'SH-SEARCH':"The menu's Find a page box: letters come out backwards, Enter does nothing, short words rank badly; All pages forgets its search",
'SH-MENU':"The menu drawer and focus: Back and Escape do not close it, focus runs behind it, hidden menu stops, page behind scrolls, reduce motion, nothing announced on a page change or a save",
'SH-TOPBAR':"Page titles are cut off in the top bar by the status pill",
'SH-ADDR':"An address that names no page, or a page that is switched off, silently shows the Dashboard",
'SH-WAYBACK':"Pages opened from a list (Needs attention, Next best action, Quick answers, an answer's missing numbers) have no way back on screen",
'UI-ERR':"A rejected Save or Add: the reason is off screen or is the browser's own bubble; wrong or impossible values are saved without a word; buttons that do nothing",
'UI-ENTER':"Enter in a box saves a half-filled form",
'UI-EDIT':"Tapping a row opens its form far away; Save or Cancel does not return to the row; focus is left nowhere; a stray tap on another row swaps the form",
'UI-UNDO':"One tap removes or overwrites with no question and no way back",
'UI-LIVE':"Boxes that redraw the page the moment they change swallow the next tap and drop the focus",
'UI-RESULT':"After Compare, Work it out or Save the answer is above or below the screen",
'UI-TARGET':"The only way on is a 16 to 36 px link inside a sentence; buttons that do not say where they go",
'FL-SETUP':"Get started (the seven questions and the reveal)",
'FL-HOME':"Dashboard, Your plan, the step-by-step guides, Get started's first screen, Quick answers: one next step, one count, names that match",
'FL-CHECKIN':"Monthly check-in, Needs attention, Next best action, Our guesses for you, Plan health score",
'PG-EMPTY':"First-open dead ends: the one button leads to a page that does not show what it promised; $0 answers with nothing to tap; lists with no way to change a row",
'PG-BALCASH':"Balance, cash flow, goals and household pages (page-specific)",
'PG-DEBT':"Debt and property pages (page-specific)",
'PG-RETIRE':"Retirement and what-if pages (page-specific)",
'PG-TAXINV':"Tax and investment pages (page-specific)",
'PG-TXN':"Transactions and helper pages (page-specific)",
'A-LANE':"claude-a's pages (hand over, do not edit)",
'PHONE':"Needs a real phone",
}
def load():
    lines=[l.rstrip('\n').split('\t') for l in open(SP+'/index-v1.tsv')]
    gid_of={i+1:l[0] for i,l in enumerate(lines)}
    theme={}
    for t,ns in T.items():
        for n in ns:
            g=gid_of[n]
            assert g not in theme,(g,t,theme.get(g))
            theme[g]=t
    missing=[n for n in gid_of if gid_of[n] not in theme]
    assert not missing,missing
    extra={}
    if os.path.exists(SP+'/extra.json'): extra=json.load(open(SP+'/extra.json'))
    theme.update(extra)
    return theme
if __name__=='__main__':
    theme=load()
    allv=json.load(open(SP+'/all.json'))
    by=collections.defaultdict(list); un=[]
    for it in allv:
        t=theme.get(it['gid'])
        (by[t] if t else un).append(it)
    os.makedirs(SP+'/themes',exist_ok=True)
    F=['steps','saw','should','why','cause','fix','evidence']
    for t,items in by.items():
        items.sort(key=lambda x:-int(x.get('severity') or 0))
        with open(f"{SP}/themes/{t}.md",'w') as o:
            o.write(f"# {t}: {TITLE[t]}\n\n{len(items)} verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.\n\n")
            for it in items:
                pg=it.get('pages'); pg=', '.join(pg) if isinstance(pg,list) else str(pg)
                o.write(f"## {it['gid']} (severity {it.get('severity')}, {it.get('lens')}, scope {it.get('scope')}, owner {it.get('owner')}, {it.get('verdict')})\n**{it.get('title')}**\n\n- pages: {pg}\n- reach: {it.get('reach')}\n")
                for f in F:
                    if it.get(f): o.write(f"- {f}: {it[f] if isinstance(it[f],str) else json.dumps(it[f])}\n")
                o.write('\n')
        json.dump(items,open(f"{SP}/themes/{t}.json",'w'),indent=1)
    for t in T: print(f"{t:11s} {len(by.get(t,[])):3d}  sev≥4: {sum(1 for x in by.get(t,[]) if int(x.get('severity') or 0)>=4):2d}  {os.path.getsize(SP+'/themes/'+t+'.md')//1000 if t in by else 0:4d} KB")
    print('unassigned:',[ (u['gid'],u.get('severity'),u.get('title')[:90]) for u in un])
