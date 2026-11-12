#!/usr/bin/env python3
# Filter (stdin -> stdout) for the hand-over package's reports: removes the shapes the public repo must not carry
# (long numbers, email addresses, network addresses, phone-like and SSN-like numbers), the same shapes tools/leak-guard.mjs looks for.
# The report keeps its words; a removed id inside a web address means the link must be found again by its title.
import re, sys
t = sys.stdin.read()
def digits(m):
    s = m.group()
    return s if re.fullmatch(r'(\d)\1*', s) or re.fullmatch(r'[1-9]0+', s) else '[number removed]'
def email(m):
    s = m.group()
    return s if re.search(r'@(example\.(com|org|net)|users\.noreply\.github\.com)$', s, re.I) or re.fullmatch(r'git@github\.com|noreply@anthropic\.com', s, re.I) else '[email removed]'
def ip(m):
    s = m.group()
    return s if any(int(o) > 255 for o in s.split('.')) or re.match(r'127\.|0\.0\.0\.0$|255\.', s) else '[address removed]'
t = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', email, t)
t = re.sub(r'(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])', '[number removed]', t)
t = re.sub(r'(?<![\d-])(?:\+?1[-. ])?\(?[2-9]\d{2}\)?[-. ]\d{3}[-. ]\d{4}(?![\d-])', '[number removed]', t)
t = re.sub(r'(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])', ip, t)
t = re.sub(r'(?<![\d.])\d{9,}(?!\d)', digits, t)
sys.stdout.write(t)
