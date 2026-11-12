Contributions: the card's links land on the box, the match check, the answer after a save

What the person sees: on Will the money last?, "Check the match ›" opens
the row on Retirement contributions with "Employer adds, a year" in the
middle of the screen, focused, and right over it "Most employers that
match add about 4% of pay when you put in 6% (Vanguard, How America
Saves 2026): about $2,040 a year for Jamie at what goes in now. Type the
real figure ...". "Type what goes in ›" opens the person's row on the
amount; a $0 row (Casey's "None") comes filled in with the change the
card tried (6.6% of pay, $396 a month, and the usual match, $2,880 a
year), so saving it gives the answer the card showed. A 401(k) with own
money going in, no match and nobody asked gets "No match on file. Is
that right?" [That's right] [It matches] [Not sure]. After any save on
the page the notice adds "Your retirement answer: now runs out at 74
(was 70)." Why: owner's request 2026-11-11 ("didn't input the match
correctly", fixed in one tap from the card).

Formulas and decisions:
- levers.js: workLanding (fill only when nothing of one's own goes in;
  a typed or guessed figure is never typed over, the note names the
  change in the row's own period), matchLanding (usualMatchAt on all
  the person's own money at work, the card's own figure; Work benefits'
  typed tiers when there are some), matchChecks (own money in, match 0
  and not a guess, workPlans[pid].match unset), answerChangeWords.
- Said = done, tested: Casey's filled form saved as it is = the card's
  work row effect (67 -> 88); Jamie's match 2,040 typed = the match row
  effect (70 -> 74).
- One update() for every save on the page keeps the answer before it
  (answerOf, one projection, 3-10 ms); "still runs out at 70" only when
  what goes in changed; nothing when the plan has no answer yet. A
  notice with the answer stays; a plain "saved" still goes after 4 s.
- D-A4: the "common match, 50% ... up to 6%" words now use the guesses'
  matchTerms (Priya: $2,280, was $1,740); the 50%-up-to-6% tiers stay
  only for "Start it at 6%" and in Next best action's own words
  (claude-f's file, not touched).
- Landings once per arrival (route object), after the first paint,
  focus with preventScroll, the box outlined 2 s by a rule scoped to
  the form's card and put in only then; "It matches" focuses in the tap.

view.js touched: modules/retirement/contributions/view.js

Agent: claude-b
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FKTjPFbzEx2ZvP4BhqKEiS
