# Prompts: work for other AI tools

Copy-paste prompts that ask another model (ChatGPT, Gemini, Muse, a second Claude account,
Codex, Grok...) to improve this repo. Each one points at the public repo, names the files to
read (as raw links any model can fetch) and asks for output that can be applied as it comes:
unified diffs, whole files whose first line is their path, or CSV answer keys, plus a short
rationale.

The categories are kinds of agent work, so you know where to send each one. Every prompt
also carries an `effort` line ("who does it and how long").

| folder | kind of work | count |
|---|---|---|
| `quick/` | minutes for one agent or a few small helpers: one fix, one table, one small dataset (all 50 states' tax tables included) | 20 |
| `math/` | heavy math: an hour or more of high-volume, mechanical work for a fleet of 20 to 50 small models under one lead, thousands of rows worked by exact rules (answer keys for every page group, 12,000 federal returns, every state's tax, 20,000 loans, Social Security, 100,000 historical replays) | 15 |
| `reasoning/` | deep reasoning: a strong model making decisions on architecture, data model, flows, visual design, words and continuity, methodology, security | 18 |
| `swarm/` | an orchestrator with workers, for jobs that need volume and judgement together; the split plan is inside | 4 |
| `research/` | current figures and law with primary sources, turned into the repo's tables | 11 |
| `build/` | a coding agent promotes one planned page from `docs/MODULE_CATALOG.md` | 88 |
| `audit/` | fresh eyes on accessibility, licences, privacy, test gaps, performance, dependencies | 6 |

`index.json` has every prompt with its id, title, category, size (S/M/L/XL), effort, rank,
tier, the "what this brings" note, suggested destinations, output format and full text; the
owner's prompt board reads it.

## Ranking
`src/value.json` ranks every prompt in tiers (Start here, Next, Later, When you have time)
and holds the plain-words note on what each one brings to the planner. The order of ids
across the tiers is the rank. The board shows the ranked list first. A new prompt that is
not in `value.json` is ranked last with a warning until someone places it.

## Editing
Hand-written prompts live in `src/<category>.md` (blocks separated by `---`; the header lines
`id`, `title`, `size`, `effort`, `to`, `output`, `read`, `summary`, then the text). The
`build-*` prompts are generated from the catalog, and the `heavy-golden-*` answer-key jobs
from the usable pages. After any change:

```
node tools/gen-prompts.mjs
```

It rebuilds every `<category>/<id>.md` and `index.json`, adds the shared intro, the raw links
and the "How to answer" rules, and refuses a prompt that names a file the repo does not have.

## Answers
Responses come back through the board into `ai-responses/<prompt-id>/` on the owner's PC
(git-ignored). Good changes are applied on a branch, tested (`npm test`, `npm run check`),
passed through the leak guard and pushed.

## Results
Every prompt ends with "How to hand it back": a tool that works in the repo (Codex, Claude
Code, Gemini CLI...) pushes a branch `ai/<id>` and opens a pull request with a `Prompt: <id>`
line (AGENTS.md rule 12 says the same for any commit that carries out a prompt); a chat answers
in its reply, which the owner pastes into the board. In Codex the owner taps "Create PR" on the
finished task. `tools/push-feed.mjs` lists the
last 30 commits on `main`, the open pull requests and any other branch with changes main does
not have yet, each tagged with the prompts it names. The lead's sync loop writes that list
and a short write-up per prompt into the board's database (`repo/pushes`, and
`results/<id>` with a stage: checking, ready, pushed or rejected, plus what it found), and
the board's **Results** tab shows them: what is finished, what is still in the works, and
the recent pushes.
