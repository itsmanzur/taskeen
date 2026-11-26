#!/usr/bin/env python3
"""
Parses each entry's `primary_source` into structured references and runs an ADVISORY
text-match against public hadith / Quran datasets (fawazahmed0/hadith-api, fawazahmed0/quran-api).

It never edits entries.json. It writes src/data/references.json, which the app shows next to the
alim review panel. The result is a cross-check aid, NOT a verification: the reviewer decides.

Usage:  python scripts/check_references.py [--cache DIR]
"""
import json, re, os, sys, urllib.request
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else os.path.join(ROOT, '.ref-cache')
BASE_H = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/'
BASE_Q = 'https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/'

BOOKS = {  # Bengali name -> (key, dataset file, english title)
    'সহীহ বুখারী': ('bukhari', 'ara-bukhari', 'Sahih al-Bukhari'),
    'সহীহ মুসলিম': ('muslim', 'ara-muslim', 'Sahih Muslim'),
    'সুনানে আবু দাউদ': ('abudawud', 'ara-abudawud', 'Sunan Abi Dawud'),
    'জামে তিরমিযী': ('tirmidhi', 'ara-tirmidhi', "Jami' at-Tirmidhi"),
    'সুনানে নাসায়ী': ('nasai', 'ara-nasai', "Sunan an-Nasa'i"),
    'সুনানে ইবনে মাজাহ': ('ibnmajah', 'ara-ibnmajah', 'Sunan Ibn Majah'),
    'মুয়াত্তা ইমাম মালেক': ('malik', 'ara-malik', "Muwatta Malik"),
}
OTHER_BOOKS = {  # recognised but no dataset to compare against
    'মুসনাদে আহমাদ': 'Musnad Ahmad', 'আল-আদাবুল মুফরাদ': 'Al-Adab al-Mufrad', 'আল-মুসতাদরাক': 'Al-Mustadrak (Hakim)',
    'ইবনে হিব্বান': 'Sahih Ibn Hibban', 'সহীহ ইবনে হিব্বান': 'Sahih Ibn Hibban', 'নাসায়ী কুবরা': 'Sunan al-Kubra (Nasai)',
    'সুনানে নাসায়ী কুবরা': 'Sunan al-Kubra (Nasai)', 'সুনানে দারেমী': 'Sunan ad-Darimi', 'আল-আযকার (নববী)': 'Al-Adhkar (Nawawi)',
}
SURAH = {
    'আত-তাওবা': 9, 'আত-তাহরীম': 66, 'আন-নামল': 27, 'আয-যুখরুফ': 43, "আল-আ'রাফ": 7, 'আল-আ’রাফ': 7, 'আল-আনফাল': 8,
    'আল-আম্বিয়া': 21, 'আল-আহকাফ': 46, 'আল-আহযাব': 33, 'আহযাব': 33, 'আল-কাসাস': 28, 'আল-কাহাফ': 18, 'আল-ফাতিহা': 1,
    'আল-ফুরকান': 25, 'আল-বাকারা': 2, 'আল-মুমতাহিনা': 60, 'আল-মুমিনূন': 23, 'আল-হাজ্জ': 22, 'আল-হাশর': 59,
    'আলে ইমরান': 3, 'আশ-শুআরা': 26, 'ইউসুফ': 12, 'ইবরাহীম': 14, 'ত্বাহা': 20, 'নূহ': 71, 'বনী ইসরাঈল': 17, 'সাদ': 38,
}
BN = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')

def fetch(url, path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print('downloading', url, file=sys.stderr)
        urllib.request.urlretrieve(url, path)
    return json.load(open(path, encoding='utf-8'))

_DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ‌‍‎‏]')
def norm_word(w):
    w = _DIAC.sub('', w)
    w = re.sub('[أإآٱ]', 'ا', w).replace('ى', 'ي').replace('ی', 'ي').replace('ک', 'ك').replace('ة', 'ه')
    w = w.replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub('[^ء-ي]', '', w)

def tokens(text):
    """-> (original tokens, normalized tokens) aligned 1:1, empties dropped."""
    orig, nrm = [], []
    for t in text.split():
        n = norm_word(t)
        if n:
            orig.append(t); nrm.append(n)
    return orig, nrm

def match(entry_n, hadith_n):
    sm = SequenceMatcher(None, entry_n, hadith_n, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size]
    matched = sum(b.size for b in blocks)
    cov = matched / max(1, len(entry_n))
    span = (blocks[0].b, blocks[-1].b + blocks[-1].size) if blocks else (0, 0)
    return cov, span

def excerpt(orig, span, pad=5, limit=60):
    a = max(0, span[0] - pad); b = min(len(orig), span[1] + pad)
    if b - a > limit: b = a + limit
    s = ' '.join(orig[a:b])
    return ('… ' if a > 0 else '') + s + (' …' if b < len(orig) else '')

def status_of(cov):
    return 'match' if cov >= 0.90 else 'partial' if cov >= 0.60 else 'mismatch'

def parse_source(src):
    refs, last = [], None
    pat = re.compile(r'([^:,]+?)\s*:\s*([০-৯0-9]+(?:\s*(?:,|ও|-|–)\s*[০-৯0-9]+)*)')
    pos = 0
    for m in pat.finditer(src):
        gap = src[pos:m.start()].strip(' ,')
        if gap and not gap.startswith('('):  # unparsed leftover chunk
            refs.append({'kind': 'other', 'raw': gap})
        name = m.group(1).strip(' ,'); nums = m.group(2)
        pos = m.end()
        # parenthetical note right after a number stays attached to the raw text only
        if name.startswith('সূরা'):
            sname = name.replace('সূরা', '', 1).strip()
            sno = SURAH.get(sname)
            parts = [int(x) for x in re.findall(r'\d+', nums.translate(BN))]
            is_range = bool(re.search(r'[-–]', nums))
            refs.append({'kind': 'quran', 'raw': f'{name}: {nums}', 'surah': sno, 'surah_name_bn': sname,
                         'ayah_from': parts[0], 'ayah_to': parts[-1] if is_range else parts[0]})
        else:
            for n in [int(x) for x in re.findall(r'\d+', nums.translate(BN))]:
                if name in BOOKS:
                    k, _, en = BOOKS[name]
                    refs.append({'kind': 'hadith', 'raw': f'{name}: {n}', 'book_key': k, 'book_bn': name, 'book_en': en, 'number': n})
                else:
                    refs.append({'kind': 'other', 'raw': f'{name}: {n}', 'book_bn': name, 'book_en': OTHER_BOOKS.get(name, ''), 'number': n})
    tail = src[pos:].strip(' ,')
    # bare numbers that follow a book name (e.g. "সহীহ বুখারী: ১, ২") are consumed by `pat`; leftovers are notes/other books
    if tail and not re.fullmatch(r'\(.*\)', tail):
        refs.append({'kind': 'other', 'raw': tail, 'book_en': OTHER_BOOKS.get(tail, '')})
    return refs

def main():
    canonical = os.path.join(ROOT, 'data/tahqeeq/entries.json')  # source of truth; src/data/entries.json is a synced copy
    entries = json.load(open(canonical if os.path.exists(canonical) else os.path.join(ROOT, 'src/data/entries.json'), encoding='utf-8'))
    ds = {}
    for k, f, _ in BOOKS.values():
        data = fetch(BASE_H + f + '.json', os.path.join(CACHE, f + '.json'))
        by_no, toks = {}, {}
        for h in data['hadiths']:
            # Sahih Muslim is cited by Abdul-Baqi numbers ("2723"); the dataset's `hadithnumber` is a running
            # counter, while `arabicnumber` ("2723.01") carries the Abdul-Baqi number.
            key = h['hadithnumber']
            if k == 'muslim' and h.get('arabicnumber') not in (None, ''):
                key = int(float(str(h['arabicnumber'])))
            by_no.setdefault(key, []).append(h)
        ds[k] = by_no
    q = fetch(BASE_Q + 'ara-quranuthmanienc.json', os.path.join(CACHE, 'ara-quranuthmanienc.json'))['quran']
    quran = {(v['chapter'], v['verse']): v['text'] for v in q}

    norm_cache = {}
    def hnorm(book, h):
        key = (book, id(h))
        if key not in norm_cache: norm_cache[key] = tokens(h['text'])
        return norm_cache[key]

    def suggest(book, entry_n, exclude):
        eset = set(entry_n)
        scored = []
        for no, hs in ds[book].items():
            for h in hs:
                o, n = hnorm(book, h)
                ov = len(eset & set(n)) / max(1, len(eset))
                if ov > 0.6: scored.append((ov, no, h))
        scored.sort(key=lambda x: -x[0])
        best = None
        for _, no, h in scored[:12]:
            if no == exclude: continue
            cov, _ = match(entry_n, hnorm(book, h)[1])
            if cov >= 0.85 and (best is None or cov > best[1]): best = (no, cov)
        return best

    out, summary = {}, {'match': 0, 'partial': 0, 'mismatch': 0, 'unchecked': 0}
    for e in entries:
        _, en = tokens(e['arabic_uthmani'])
        refs = parse_source(e['primary_source'])
        weak = len(en) < 5  # very short phrases match almost any hadith, so a match proves little
        for r in refs:
            if r['kind'] == 'hadith':
                hs = ds[r['book_key']].get(r['number'])
                if not hs:
                    r['check'] = {'status': 'mismatch', 'score': 0, 'reason': 'এই নম্বরে ডেটাসেটে হাদীস নেই (নম্বরিং পদ্ধতি ভিন্ন হতে পারে)'}
                else:
                    best = None
                    for h in hs:
                        o, n = hnorm(r['book_key'], h)
                        cov, span = match(en, n)
                        if best is None or cov > best[0]: best = (cov, span, o, h)
                    cov, span, o, h = best
                    chk = {'status': status_of(cov), 'score': round(cov, 2), 'excerpt': excerpt(o, span)}
                    if h.get('grades'): chk['grades'] = h['grades']
                    if chk['status'] != 'match':
                        s = suggest(r['book_key'], en, r['number'])
                        if s: chk['suggested'] = {'number': s[0], 'score': round(s[1], 2)}
                    r['check'] = chk
            elif r['kind'] == 'quran':
                if not r.get('surah'):
                    r['check'] = {'status': 'unchecked', 'score': 0, 'reason': 'সূরার নাম শনাক্ত হয়নি'}
                else:
                    verses = [quran.get((r['surah'], a)) for a in range(r['ayah_from'], r['ayah_to'] + 1)]
                    if any(v is None for v in verses):
                        r['check'] = {'status': 'mismatch', 'score': 0, 'reason': 'এই আয়াত-নম্বর ডেটাসেটে নেই'}
                    else:
                        o, n = tokens(' '.join(verses))
                        cov, span = match(en, n)
                        r['check'] = {'status': status_of(cov), 'score': round(cov, 2), 'excerpt': excerpt(o, span)}
            else:
                r['check'] = {'status': 'unchecked', 'score': 0, 'reason': 'এই কিতাবের জন্য স্বয়ংক্রিয় তুলনার ডেটাসেট নেই — সরাসরি মূল কিতাবে দেখুন'}
        if weak:
            for r in refs:
                if r['check']['status'] != 'unchecked': r['check']['weak'] = True
        # entry-level: judged on refs that CAN be compared; 'unchecked' only if nothing could be compared
        checked = [r['check']['status'] for r in refs if r['check']['status'] != 'unchecked']
        if not checked: overall = 'unchecked'
        elif 'match' in checked: overall = 'match'
        elif 'partial' in checked: overall = 'partial'
        else: overall = 'mismatch'
        summary[overall] += 1
        out[e['id']] = {'refs': refs, 'overall': overall}

    payload = {
        'generated_by': 'scripts/check_references.py',
        'datasets': ['fawazahmed0/hadith-api (sunnah.com-derived Arabic text, numbering and grades)', 'fawazahmed0/quran-api (Uthmani text)'],
        'disclaimer': 'স্বয়ংক্রিয় মিল-পরীক্ষা শুধু সহায়ক। এটি আলেমের তাহকীক নয়; চূড়ান্ত সিদ্ধান্ত রিভিউয়ারের।',
        'entries': out,
    }
    dest = os.path.join(ROOT, 'src/data/references.json')
    json.dump(payload, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('summary', summary, 'entries', len(out))

if __name__ == '__main__':
    main()
