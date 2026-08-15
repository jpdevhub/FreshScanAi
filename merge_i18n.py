#!/usr/bin/env python3
"""Merge a FreshScanAi PR's rejected i18n "analytics" hunk (added by the PR's
shared base diff) into upstream's existing analytics i18n object.

Usage: merge_i18n.py <patch_file> [en bn hi]
Reads the analytics key block the PR tries to ADD for each locale from the
patch, and appends those keys (minus the wrapping "analytics": { } since
upstream already has that object) into the existing analytics object, right
after the "allTime" key.
"""
import re, json, sys

def extract_analytics_keys(patch, lang):
    sec = re.search(r'diff --git a/src/i18n/locales/%s\.json.*?(?=\ndiff --git|\Z)' % lang, patch, re.S)
    if not sec:
        return None
    body = sec.group()
    lines = body.split('\n')
    cap = False
    added = []
    for l in lines:
        if l.startswith('+') and '"analytics"' in l:
            cap = True
            continue
        if cap:
            if l.startswith('+'):
                content = l[1:].rstrip('\n')
                if content.strip() == '}':
                    break
                added.append(content.strip())
            elif l.startswith('-') or (not l.startswith('+') and not l.startswith(' ') and not l.startswith('@@')):
                break
    return added

def merge_lang(lang, patch):
    f = f'src/i18n/locales/{lang}.json'
    s = open(f).read()
    keys = extract_analytics_keys(patch, lang)
    if not keys:
        print(f'{lang}: no analytics keys in patch'); return
    if keys[-1].endswith(','):
        keys[-1] = keys[-1][:-1]
    pattern = re.compile(r'("allTime"\s*:\s*"[^"]*")(\n  \}\n\})')
    if not pattern.search(s):
        print(f'{lang}: allTime anchor not found'); return
    insertion = ',\n' + '\n'.join('    ' + k for k in keys)
    s2 = pattern.sub(lambda mm: mm.group(1) + insertion + '\n' + mm.group(2), s)
    open(f, 'w').write(s2)
    try:
        json.load(open(f)); print(f'{lang}: merged OK ({len(keys)} keys)')
    except Exception as e:
        print(f'{lang}: INVALID {e}')

patch_file = sys.argv[1]
langs = sys.argv[2:] if len(sys.argv) > 2 else ['en', 'bn', 'hi']
patch = open(patch_file).read()
for lang in langs:
    merge_lang(lang, patch)
