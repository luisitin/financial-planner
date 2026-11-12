export const meta = {
  name: 'buildlog-why-verify',
  description: 'Check every build-log "why it matters" line against its entry, rewrite unsupported or jargon lines, and put the score-change reasons in plain words',
  phases: [{ title: 'Check', detail: 'one checker per batch of 20 lines' }, { title: 'Recheck', detail: 'an independent reader confirms each rewrite' }],
}
const DIR = '$SP/buildlog'
const REPO = '$REPO'
const RULES = `The reader is the app's owner, a layperson reading on a phone. A WHY line is ONE plain sentence of at most 25 words saying why this piece of work matters to someone using the planner. Rules:
- Every fact and number in it must be supported by the entry's own summary, points, numbers or note in ${DIR}/impact-verify-input.json (those were already checked against the commits). When in doubt, open the commit: git -C ${REPO} show <id> --stat, and the module README or CHANGELOG line. Do not add facts you cannot point to.
- "X, not Y" comparisons must have both X and Y in the entry, describing the same case. Before/after must be in the right direction.
- No jargon: no commit ids, no finding codes (F-031), no file or function names, no "golden", "engine", "compute", "rubric", "baseline". Spell out abbreviations a layperson would not know (RMD, DTI, IRMAA, AMT, NIIT, MFS, HSA is fine as "health savings account").
- Present tense about what the owner now gets. No hype words ("massively", "huge").
- Do not judge the score itself; only the line.`
const ITEM = { type: 'object', properties: {
  id: { type: 'string' }, ok: { type: 'boolean' }, problem: { type: 'string', description: 'empty when ok; else what is unsupported, wrong or jargon' },
  why: { type: 'string', description: 'the corrected line when not ok (<= 25 words); empty when ok' },
  evidence: { type: 'string', description: 'where in the entry each fact/number comes from' },
  reason_plain: { type: 'string', description: 'ONLY for entries with adjusted_reason: that reason rewritten as 1-2 plain sentences (<= 45 words), no commit ids or codes; name other entries by a short plain name of their page or work instead, e.g. "the Financial statements page". Empty otherwise.' },
}, required: ['id', 'ok', 'problem', 'why', 'evidence', 'reason_plain'] }
const BATCH = { type: 'object', properties: { items: { type: 'array', items: ITEM } }, required: ['items'] }
const VERDICT = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: {
  id: { type: 'string' }, accept: { type: 'boolean' }, why: { type: 'string', description: 'the final line to publish (<= 25 words): the checker\'s rewrite if accepted, your own fix if not' },
  reason_plain: { type: 'string', description: 'final plain reason for adjusted entries, else empty' }, note: { type: 'string' } },
  required: ['id', 'accept', 'why', 'reason_plain', 'note'] } } }, required: ['items'] }
const batches = args
const results = await pipeline(batches,
  (ids, _o, n) => agent(`You check the "why it matters" lines of a build log for a personal financial planner app. Read ${DIR}/impact-verify-input.json and check ONLY these ${ids.length} entries: ${ids.join(', ')}.\n\n${RULES}\n\nReturn one item per id. Mark ok=false for any line with an unsupported or mis-stated fact or number, a wrong direction, jargon, or more than 25 words, and give the corrected line. For entries whose adjusted_reason is non-empty, also give reason_plain.`, { label: `check:${n + 1}`, phase: 'Check', schema: BATCH }),
  (res, ids, n) => {
    const flagged = (res?.items || []).filter((x) => !x.ok || x.reason_plain)
    if (!flagged.length) return { items: [], checked: res?.items || [] }
    return agent(`An earlier checker reviewed "why it matters" lines in a build log for a personal financial planner app and proposed rewrites. Independently confirm each one. Data: ${DIR}/impact-verify-input.json (each entry's summary, points, numbers and note are the facts; open the commit with git -C ${REPO} show <id> if needed).\n\n${RULES}\n\nThe proposals (JSON):\n${JSON.stringify(flagged, null, 1)}\n\nFor each: accept=true if the rewrite (field why; or the original line when the checker only added reason_plain) is fully supported, plain and <= 25 words; otherwise accept=false and write your own correct line. Check reason_plain the same way (plain words, no commit ids or codes, faithful to adjusted_reason, <= 45 words) and return the final version. Return the final why for every id.`, { label: `recheck:${n + 1}`, phase: 'Recheck', schema: VERDICT }).then((v) => ({ items: v?.items || [], checked: res?.items || [] }))
  })
return results.filter(Boolean)