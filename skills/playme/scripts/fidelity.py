#!/usr/bin/env python3
"""fidelity.py — check that a PLAYME page says what the paper says (rule R13) and leaks nothing (R14).

Usage
    python3 fidelity.py --dump text.json [--paper paper.tex|paper.pdf|paper.txt|paper.md ...]
                        [--facts facts.json] [--words words.json] [--text README.md ...]
                        [--paper-lang en] [--allow REGEX ...] [--json report.json] [--strict] [--no-privacy]

    text.json comes from:  node lint.mjs --url index.html --dump text.json
    (every part's text at rest, the captions of a full play-through, the text after the end and after each option,
    every fold opened, the quotes and the facts, in each language).

Checks
  quotes      Every quote on the page (.pm-quote elements, or [data-quote="original text"]) must appear verbatim in
              the paper after normalisation: Unicode quotes / dashes / ellipsis / ligatures, whitespace, LaTeX markup
              (\\emph{}, ~, \\%, --, ``…'', \\ref{} resolved to its number, \\cite{} dropped). "…" inside a quote
              skips text; the pieces must appear in order. A miss shows the closest passage and a word diff.
              Quotes shown in another language than the paper's (--paper-lang) are skipped unless they carry the
              original in data-quote.
  references  Every "Paper §4.3.1", "§4.3", "Section 4", "Fig. 6", "Figs. 2–3", "Table 2", "Appendix B" (and
              论文第 4.3 节 / 第 4.3 节 / 图 6 / 表 2 / 附录 B) must exist in the paper. From a .tex the numbering is
              computed like LaTeX does (\\section, \\subsection, \\subsubsection, starred ones skipped, \\appendix,
              figure / table environments with \\caption, subfigures not counted, \\input / \\include followed); from
              a .pdf / .txt / .md, from "Figure N:" / "Table N:" captions and numbered headings (heuristic).
              Each reference is listed with the title it resolves to, so you can check it points at the right thing.
  facts       Every [data-fact=key] text must equal its value in facts.json. The skill's template schema:
                {"facts": {"main.gain": {"value": "+12.4", "zh": "+12.4", "aliases": [], "ref": "tab-main", "loc": "…"}},
                 "refs": {"tab-main": {"en": "Table 2", "zh": "表 2", "anchor": "first words of the caption"}},
                 "quotes": {"arch.runtime": {"en": "verbatim sentence …", "zh": "…", "ref": "sec-arch"}}}
              A flat {"key": "41.2K"} file works too. Keys used on the page but missing in facts.json fail. Every
              refs label must exist in the paper (en and zh pointing at the same thing); a real anchor must still match
              the title there (a renumbered paper shows up here). Every quotes.*.en is checked verbatim, and
              data-quote="<quote id>" on the page stands for that quote (its shown text must equal quotes.<id>.<lang>).
  words       (quoted passages are exempt: they are the paper's words)
              words.json: {"ban": ["benchmark habits", "/regex/i", {"pattern": "…", "flags": "i", "use": "…", "why": "…"}],
              "prefer": {"5-layer": "five-layer architecture"}, "terms": [{"en": "step", "zh": "步", "avoid": ["turn"]}],
              "allow": ["team@example\\.org"]}. "ban" and "prefer" may also be {"en": […], "zh": […]}.
              Banned terms fail; "prefer" and terms[].avoid hits are warnings (failures with --strict).
  privacy     IPv4 addresses, e-mail addresses, account paths (/Users/<name>, /home/<name>, C:\\Users\\<name>, /root/…),
              key-like tokens (sk-…, ghp_…, AKIA…, JWTs, private keys, api_key=…), URLs carrying tokens or passwords.
              Long random-looking strings are warnings. "allow" patterns and --allow skip known-public hits.
Images are never scanned: the report reminds you to check screenshots by eye.
Exit codes: 0 pass · 1 a check failed (or a warning with --strict) · 2 usage error. Python 3 stdlib only;
a .pdf paper needs `pdftotext` (poppler-utils).
"""

import argparse
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata

USE_COLOR = sys.stdout.isatty() and not os.environ.get('NO_COLOR')


def paint(code):
    return lambda s: '\x1b[%sm%s\x1b[0m' % (code, s) if USE_COLOR else str(s)


RED, GREEN, YELLOW, DIM, BOLD = paint('31'), paint('32'), paint('33'), paint('2'), paint('1')
CJK = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]')


class UsageError(Exception):
    pass


# ============================================================================ normalisation

ZERO_WIDTH = dict.fromkeys(map(ord, '\u200b\u200c\u200d\u2060\ufeff\u00ad'), None)
QUOTES = {ord(ch): "'" for ch in '\u2018\u2019\u201a\u201b\u2032\u02bc\uff07'}
QUOTES.update({ord(ch): '"' for ch in '\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb\uff02'})
DASHES = {ord(ch): '-' for ch in '\u2010\u2011\u2012\u2013\u2014\u2015\u2212\ufe58\ufe63\uff0d'}


def norm(text):
    """Normalise for verbatim comparison: NFKC, quotes, dashes, ellipsis, zero-width characters, whitespace."""
    text = unicodedata.normalize('NFKC', text or '').translate(ZERO_WIDTH).translate(QUOTES).translate(DASHES)
    text = text.replace('\u2026', '...')
    text = re.sub(r'-{2,}', '-', text)
    text = re.sub(r'\s+', ' ', text).strip()
    # a dash between words reads the same with or without spaces around it ("fast - by far" / "fast-by far")
    text = re.sub(r' ?- ?', '-', text)
    return text


def loose(text):
    """Letters and digits only, lowercased: the 'same words, other case or punctuation' comparison."""
    return re.sub(r'[\W_]+', '', norm(text).lower())


# ============================================================================ LaTeX

TEX_DROP_ARG = ('label', 'cite', 'citep', 'citet', 'citealp', 'citealt', 'citeauthor', 'citeyear', 'nocite', 'vspace',
                'hspace', 'includegraphics', 'bibliography', 'bibliographystyle', 'usepackage', 'documentclass',
                'newcommand', 'renewcommand', 'setlength', 'addtolength', 'pagestyle', 'thispagestyle', 'input',
                'include', 'graphicspath', 'definecolor', 'hypersetup', 'captionsetup', 'linespread', 'fontsize',
                'setcounter', 'addcontentsline', 'phantomsection', 'pdfbookmark', 'footnotemark', 'index')
TEX_SYMBOLS = {'times': '×', 'approx': '≈', 'sim': '~', 'leq': '≤', 'le': '≤', 'geq': '≥', 'ge': '≥', 'pm': '±',
               'cdot': '·', 'cdots': '...', 'ldots': '...', 'dots': '...', 'rightarrow': '→', 'to': '→',
               'leftarrow': '←', 'Rightarrow': '⇒', 'neq': '≠', 'ne': '≠', 'infty': '∞', 'degree': '°',
               'textasciitilde': '~', 'textbackslash': '\\', 'textless': '<', 'textgreater': '>', 'S': '§',
               'textendash': '-', 'textemdash': '-', 'textquoteright': "'", 'textquoteleft': "'", 'LaTeX': 'LaTeX',
               'TeX': 'TeX', 'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε', 'lambda': 'λ',
               'mu': 'μ', 'sigma': 'σ', 'tau': 'τ', 'theta': 'θ', 'pi': 'π', 'checkmark': '✓', 'eg': 'e.g.',
               'ie': 'i.e.', 'etal': 'et al.'}


# escaped special characters (\\&, \\_, \\{, …) become private-use marks while markup is stripped, then come back
KEEP_ESCAPED = {ch: chr(0xE000 + i) for i, ch in enumerate('%&_#${}~^')}


def strip_tex_comments(src):
    return re.sub(r'(?<!\\)%[^\n]*', '', src)


def read_tex(path, seen=None, depth=0):
    """A .tex file with \\input / \\include / \\subfile expanded (relative to the main file), comments removed."""
    seen = seen if seen is not None else set()
    real = os.path.realpath(path)
    if real in seen or depth > 20:
        return ''
    seen.add(real)
    with open(path, encoding='utf-8', errors='replace') as fh:
        src = strip_tex_comments(fh.read())
    base = os.path.dirname(path)
    root = read_tex.root or base

    def inc(m):
        name = m.group(2).strip()
        for cand in (os.path.join(root, name), os.path.join(root, name + '.tex'),
                     os.path.join(base, name), os.path.join(base, name + '.tex')):
            if os.path.isfile(cand):
                read_tex.files.append(cand)
                return '\n' + read_tex(cand, seen, depth + 1) + '\n'
        read_tex.missing.append(name)
        return ''

    return re.sub(r'\\(input|include|subfile)\s*\{([^}]*)\}', inc, src)


read_tex.root = None
read_tex.files = []
read_tex.missing = []


def brace_arg(src, i):
    """(content, end) of the {…} group starting at src[i] (skipping spaces and one [..] optional arg), or (None, i)."""
    n = len(src)
    while i < n and src[i] in ' \t\n':
        i += 1
    if i < n and src[i] == '[':
        depth, j = 0, i
        while j < n:
            if src[j] == '[':
                depth += 1
            elif src[j] == ']':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        i = j + 1
        while i < n and src[i] in ' \t\n':
            i += 1
    if i >= n or src[i] != '{':
        return None, i
    depth, j = 0, i
    while j < n:
        ch = src[j]
        if ch == '\\':
            j += 2
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return src[i + 1:j], j + 1
        j += 1
    return src[i + 1:], n


FLOAT_ENVS = {'figure': 'figure', 'figure*': 'figure', 'wrapfigure': 'figure', 'sidewaysfigure': 'figure',
              'SCfigure': 'figure', 'table': 'table', 'table*': 'table', 'wraptable': 'table', 'sidewaystable': 'table'}
SUB_ENVS = {'subfigure', 'subtable', 'minipage-sub'}


def letters(n):
    s = ''
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


class TexStructure:
    """Section / figure / table numbering of a LaTeX source, computed like LaTeX would (article class)."""

    def __init__(self, src):
        self.sections = {}       # number -> title
        self.figures = {}        # number -> caption
        self.tables = {}
        self.appendix_letters = set()
        self.labels = {}         # label -> (kind, number)
        self._parse(src)

    def _parse(self, src):
        tok = re.compile(r'\\(chapter|section|subsection|subsubsection)(\*?)|\\(appendix)\b|\\begin\{(appendices)\}'
                         r'|\\begin\{([A-Za-z]+\*?)\}|\\end\{([A-Za-z]+\*?)\}|\\(caption|captionof|subcaption)\b'
                         r'|\\label\s*\{([^}]*)\}')
        chap = sec = sub = subsub = 0
        has_chapters = bool(re.search(r'\\chapter\*?\s*[\[{]', src))
        appendix = False
        envs = []
        fig = tab = 0
        last = None
        pos = 0
        while True:
            m = tok.search(src, pos)
            if not m:
                break
            pos = m.end()
            if m.group(1):
                level, star = m.group(1), m.group(2)
                title, end = brace_arg(src, m.end())
                if title is None:
                    continue
                pos = end
                title = tex_to_text(title, {})
                if star:
                    continue
                if level == 'chapter':
                    chap += 1
                    sec = sub = subsub = 0
                    num = letters(chap) if appendix else str(chap)
                elif level == 'section':
                    sec += 1
                    sub = subsub = 0
                    head = (letters(chap) if appendix else str(chap)) if has_chapters else None
                    num = ('%s.%d' % (head, sec)) if head else (letters(sec) if appendix else str(sec))
                elif level == 'subsection':
                    sub += 1
                    subsub = 0
                    num = '%s.%d' % (self._cur(chap, sec, appendix, has_chapters), sub)
                else:
                    subsub += 1
                    num = '%s.%d.%d' % (self._cur(chap, sec, appendix, has_chapters), sub, subsub)
                self.sections[num] = title
                if appendix:
                    self.appendix_letters.add(num.split('.')[0])
                last = ('section', num)
            elif m.group(3) or m.group(4):
                appendix = True
                if has_chapters:
                    chap = 0
                else:
                    sec = 0
            elif m.group(5):
                envs.append(m.group(5))
            elif m.group(6):
                if envs and envs[-1] == m.group(6):
                    envs.pop()
                elif m.group(6) in envs:
                    while envs and envs.pop() != m.group(6):
                        pass
            elif m.group(7):
                kind_cmd = m.group(7)
                if kind_cmd == 'subcaption':
                    continue
                if kind_cmd == 'captionof':
                    which, after = brace_arg(src, m.end())
                    kind = 'figure' if which and which.strip().startswith('fig') else 'table' if which and which.strip().startswith('tab') else None
                    cap, end = brace_arg(src, after)
                else:
                    floats = [e for e in envs if e in FLOAT_ENVS]
                    if not floats or any(e in SUB_ENVS for e in envs[envs.index(floats[-1]):]):
                        continue
                    kind = FLOAT_ENVS[floats[-1]]
                    cap, end = brace_arg(src, m.end())
                if not kind:
                    continue
                pos = max(pos, end)
                text = tex_to_text(cap or '', {})
                if kind == 'figure':
                    fig += 1
                    self.figures[fig] = text
                    last = ('figure', fig)
                else:
                    tab += 1
                    self.tables[tab] = text
                    last = ('table', tab)
            elif m.group(8) is not None:
                if last:
                    self.labels[m.group(8).strip()] = last

    @staticmethod
    def _cur(chap, sec, appendix, has_chapters):
        if has_chapters:
            return '%s.%d' % (letters(chap) if appendix else chap, sec)
        return letters(sec) if appendix else str(sec)


def tex_to_text(src, labels):
    """Readable text from LaTeX: markup dropped, \\ref resolved through labels, special characters decoded."""
    s = src
    s = re.sub(r'\\begin\{(?:verbatim|lstlisting|minted)\}.*?\\end\{(?:verbatim|lstlisting|minted)\}', ' ', s, flags=re.S)
    footnotes = []

    def ref(m):
        cmd, key = m.group(1), m.group(2).strip()
        kind, num = labels.get(key, (None, None))
        if num is None:
            return '??'
        if cmd in ('autoref', 'Cref', 'cref'):
            name = {'figure': 'Figure', 'table': 'Table', 'section': 'Section'}[kind]
            if cmd == 'cref':
                name = {'figure': 'Fig.', 'table': 'Table', 'section': 'Section'}[kind]
            return '%s %s' % (name, num)
        return str(num)

    s = re.sub(r'\\(ref|autoref|cref|Cref|pageref|nameref)\*?\s*\{([^}]*)\}', ref, s)
    s = re.sub(r'\\eqref\s*\{[^}]*\}', '(?)', s)
    # commands whose argument is dropped / kept / replaced
    out = []
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch == '\\':
            m = re.match(r'\\([A-Za-z@]+)\*?|\\(.)', s[i:])
            if not m:
                i += 1
                continue
            if m.group(2) is not None:
                c = m.group(2)
                if c in KEEP_ESCAPED:
                    out.append(KEEP_ESCAPED[c])      # protected from the clean-up below, restored at the end
                else:
                    out.append({',': ' ', ';': ' ', ':': ' ', '!': '', ' ': ' ', '\\': '\n', '-': '', '/': '', "'": '',
                                '`': '', '"': '', '^': '', '.': '', '=': ''}.get(c, c))
                i += m.end()
                continue
            name = m.group(1)
            j = i + m.end()
            if name in ('footnote', 'footnotetext'):
                arg, j2 = brace_arg(s, j)
                if arg is not None:
                    footnotes.append(arg)
                    i = j2
                    continue
            if name in TEX_DROP_ARG:
                arg, j2 = brace_arg(s, j)
                i = j2 if arg is not None else j
                continue
            if name in ('begin', 'end'):
                arg, j2 = brace_arg(s, j)
                i = j2 if arg is not None else j
                if name == 'begin' and arg in ('tabular', 'tabularx', 'tabular*', 'array'):
                    spec, j3 = brace_arg(s, i)       # column spec
                    if arg == 'tabularx' or arg == 'tabular*':
                        spec, j3 = brace_arg(s, j3)
                    i = j3 if spec is not None else i
                out.append(' ')
                continue
            if name in ('href',):
                _, j2 = brace_arg(s, j)
                arg, j3 = brace_arg(s, j2)
                out.append(arg or '')
                i = j3
                continue
            if name in ('textcolor', 'colorbox'):
                _, j2 = brace_arg(s, j)
                i = j2
                continue
            if name in ('enquote', 'textquote'):
                arg, j2 = brace_arg(s, j)
                if arg is not None:
                    out.append('"%s"' % arg)
                    i = j2
                    continue
            if name in TEX_SYMBOLS:
                out.append(TEX_SYMBOLS[name])
                i = j
                continue
            if name in ('em', 'bf', 'it', 'sc', 'tt', 'rm', 'sf', 'small', 'footnotesize', 'scriptsize', 'tiny',
                        'large', 'Large', 'LARGE', 'huge', 'Huge', 'normalsize', 'centering', 'raggedright',
                        'raggedleft', 'noindent', 'par', 'newline', 'linebreak', 'item', 'hline', 'toprule',
                        'midrule', 'bottomrule', 'cmidrule', 'maketitle', 'tableofcontents', 'appendix', 'clearpage',
                        'newpage', 'protect', 'xspace', 'relax', 'displaystyle', 'quad', 'qquad', 'left', 'right',
                        'bigskip', 'medskip', 'smallskip', 'vfill', 'hfill'):
                if name == 'cmidrule':
                    _, j = brace_arg(s, j)
                out.append(' ' if name not in ('protect', 'xspace', 'relax', 'left', 'right') else '')
                i = j
                continue
            # an unknown command: drop its name; its {argument}, if any, stays as text
            i = j
            continue
        if ch == '%':
            k = s.find('\n', i)
            i = n if k < 0 else k
            continue
        if ch == '$':
            i += 1
            continue
        out.append(ch)
        i += 1
    t = ''.join(out)
    t = t.replace('``', '"').replace("''", '"').replace('`', "'")
    t = t.replace('---', '-').replace('--', '-')
    t = re.sub(r'(?<!\\)~', ' ', t)
    t = t.replace('&', ' ').replace('{', '').replace('}', '').replace('^', '')
    t = re.sub(r'(?<=\w)_(?=\{|\w)', '', t)
    for ch, mark in KEEP_ESCAPED.items():
        t = t.replace(mark, ch)
    if footnotes:
        t += '\n' + '\n'.join(tex_to_text(f, labels) for f in footnotes)
    return t


# ============================================================================ paper sources

class Paper:
    def __init__(self, paths):
        self.paths = paths
        self.texts = []          # normalised variants for quote search
        self.raw = ''
        self.structure = None    # TexStructure or TextStructure
        self.kind = None
        self.notes = []
        for i, p in enumerate(paths):
            self._load(p, first=(i == 0))

    def _load(self, path, first):
        if not os.path.isfile(path):
            raise UsageError('paper not found: %s' % path)
        ext = os.path.splitext(path)[1].lower()
        if ext == '.tex':
            read_tex.root = os.path.dirname(os.path.abspath(path))
            read_tex.files, read_tex.missing = [], []
            src = read_tex(path)
            if read_tex.missing:
                self.notes.append('\\input not found: ' + ', '.join(read_tex.missing))
            body = src
            m = re.search(r'\\begin\{document\}(.*?)(?:\\end\{document\}|$)', src, re.S)
            if m:
                body = m.group(1)
            st = TexStructure(body)
            text = tex_to_text(body, st.labels)
            if first:
                self.structure, self.kind = st, 'tex'
                if read_tex.files:
                    self.notes.append('followed %d \\input file%s' % (len(read_tex.files), '' if len(read_tex.files) == 1 else 's'))
            self._add(text, pdf=False)
            return
        if ext == '.pdf':
            exe = shutil.which('pdftotext')
            if not exe:
                raise UsageError('reading a PDF needs pdftotext (apt install poppler-utils / brew install poppler); '
                                 'or pass the .tex or a .txt export')
            proc = subprocess.run([exe, '-enc', 'UTF-8', path, '-'], capture_output=True)
            if proc.returncode != 0:
                raise UsageError('pdftotext failed on %s: %s' % (path, proc.stderr.decode('utf-8', 'replace').strip()))
            text = proc.stdout.decode('utf-8', 'replace')
            pdf = True
        else:
            with open(path, encoding='utf-8', errors='replace') as fh:
                text = fh.read()
            pdf = ext not in ('.md', '.markdown')
        if first:
            self.structure, self.kind = TextStructure(text), 'text'
        self._add(text, pdf=pdf)

    def _add(self, text, pdf):
        self.raw += '\n' + text
        self.texts.append(norm(text))
        if pdf:
            # words split across lines ("inter-\nactive") read whole in the original; try both forms
            self.texts.append(norm(re.sub(r'(\w)-[ \t]*\n[ \t]*(\w)', r'\1\2', text)))

    def describe(self):
        st = self.structure
        names = ', '.join(os.path.basename(p) for p in self.paths)
        if st is None:
            return names
        sec = len(st.sections)
        return '%s (%d sections, %d figures, %d tables%s%s)' % (
            names, sec, len(st.figures), len(st.tables),
            ', appendix ' + '/'.join(sorted(st.appendix_letters)) if st.appendix_letters else '',
            '; ' + '; '.join(self.notes) if self.notes else '')


class TextStructure:
    """Numbering from plain text (pdftotext / markdown): captions and numbered headings. Heuristic."""

    def __init__(self, text):
        self.sections, self.figures, self.tables, self.appendix_letters = {}, {}, {}, set()
        for m in re.finditer(r'(?m)^[ \t]*(?:Figure|Fig\.)[ \t]*(\d+)[ \t]*[:.|][ \t]*(.*)$', text):
            self.figures.setdefault(int(m.group(1)), m.group(2).strip()[:120])
        for m in re.finditer(r'(?m)^[ \t]*(?:Table|TABLE)[ \t]*(\d+)[ \t]*[:.|][ \t]*(.*)$', text):
            self.tables.setdefault(int(m.group(1)), m.group(2).strip()[:120])
        app_at = None
        am = re.search(r'(?m)^[ \t#]*(?:Appendix|APPENDIX|Appendices|APPENDICES)\b', text)
        if am:
            app_at = am.start()
        # numbered headings anywhere (two-column extraction can put a section after the appendix heading)
        for m in re.finditer(r'(?m)^[ \t]*#*[ \t]*(\d{1,2}(?:\.\d{1,2}){0,3})\.?[ \t]+([A-Z][^\n]{2,90})$', text):
            self.sections.setdefault(m.group(1), m.group(2).strip())
        for m in re.finditer(r'(?m)^[ \t]*#*[ \t]*(?:Appendix[ \t]+)?([A-H])((?:\.\d{1,2}){0,2})\.?[ \t]+([A-Z][^\n]{2,90})$', text):
            if app_at is None or m.start() < app_at:
                continue
            num = m.group(1) + m.group(2)
            self.sections.setdefault(num, m.group(3).strip())
            self.appendix_letters.add(m.group(1))
        for m in re.finditer(r'\bAppendix[ \t]+([A-H])\b', text):
            self.appendix_letters.add(m.group(1))


# ============================================================================ dump

class Source:
    """One piece of page text with where it came from."""

    def __init__(self, text, lang, where):
        self.text, self.lang, self.where = text or '', lang, where


def mask_quotes(sources, quotes):
    """Copies of the sources with every quoted passage blanked out: words inside a quotation are the paper's words,
    so the ban and prefer lists do not apply to them (the quote check covers them instead)."""
    texts = {q[0] for q in quotes if q[0]} | {q[4] for q in quotes if len(q) > 4 and q[4]}   # text, or id + shown text
    texts = sorted({t for t in texts if len(t.strip()) > 3}, key=len, reverse=True)
    out = []
    for src in sources:
        t = src.text
        for q in texts:
            if q in t:
                t = t.replace(q, ' ' * len(q))
        out.append(Source(t, src.lang, src.where))
    return out


def load_dump(path):
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError) as exc:
        raise UsageError('cannot read the dump %s (%s)' % (path, exc))
    if not isinstance(data, dict) or 'parts' not in data:
        raise UsageError('%s is not a lint.mjs --dump file' % path)
    return data


def dump_sources(data):
    """(part sources, page sources, quotes, facts)."""
    parts, pages, quotes, facts = [], [], [], []
    for p in data.get('parts', []):
        pid, lang = p.get('id', '?'), p.get('lang', 'en')
        where = '%s (%s)' % (pid, lang)
        for field in ('rest', 'after'):
            parts.append(Source(p.get(field), lang, where))
        parts.append(Source('\n'.join(p.get('captions') or []), lang, where))
        parts.append(Source('\n'.join(m.get('label', '') for m in p.get('marks') or []), lang, where))
        for v in p.get('variants') or []:
            parts.append(Source(v.get('text'), lang, where))
            parts.append(Source('\n'.join(v.get('captions') or []), lang, where))
        for f in p.get('folds') or []:
            parts.append(Source('\n'.join([f.get('title', ''), f.get('teaser', ''), f.get('text', '')]), lang, where))
        parts.append(Source('\n'.join(p.get('attrs') or []), lang, where))
        for q in p.get('quotes') or []:
            quotes.append((q.get('text', ''), bool(q.get('attr')), lang, pid, q.get('shown', '')))
        for f in p.get('facts') or []:
            facts.append((f.get('key', ''), f.get('text', ''), lang, pid))
    for lang, pg in (data.get('pages') or {}).items():
        for field in ('rest', 'final'):
            pages.append(Source(pg.get(field), lang, 'page (%s)' % lang))
    return parts, pages, quotes, facts


# ============================================================================ checks

class Report:
    def __init__(self):
        self.sections = []       # (name, summary, [(status, text, detail lines)])
        self.fails = 0
        self.warns = 0
        self.data = {}

    def section(self, name, summary, rows, data=None):
        self.sections.append((name, summary, rows))
        for st, _, _ in rows:
            if st == 'fail':
                self.fails += 1
            elif st == 'warn':
                self.warns += 1
        self.data[name.lower()] = data if data is not None else [{'status': st, 'text': t, 'detail': d} for st, t, d in rows]


def where_list(items):
    seen = []
    for w in items:
        if w not in seen:
            seen.append(w)
    return ', '.join(seen[:6]) + (' …' if len(seen) > 6 else '')


def check_quotes(quotes, paper, paper_lang, facts=None):
    """Verbatim check of every quote (page quotes and facts.json quotes); fuzzy suggestion for misses.
    quotes: [(text, attr, lang, part, shown)]. A data-quote value that names a facts.json quote id stands for that
    quote's original (quotes.<id>.en); the text shown in each language must then equal quotes.<id>.<lang>."""
    by_text = {}
    skipped = []
    rows, data = [], []
    fq = facts.quotes if facts else {}

    def add(text, where):
        key = norm(text)
        item = by_text.setdefault(key, {'text': text, 'where': []})
        if where not in item['where']:
            item['where'].append(where)

    for text, attr, lang, pid, shown in quotes:
        if not text.strip():
            continue
        where = '%s (%s)' % (pid, lang)
        if attr and text.strip() in fq:
            qid = text.strip()
            entry = fq[qid] if isinstance(fq[qid], dict) else {'en': str(fq[qid])}
            original = entry.get(paper_lang) or entry.get('en') or ''
            add(original, where)
            want = entry.get(lang)
            if want and shown and strip_quote(norm(shown)) != strip_quote(norm(want)):
                rows.append(('fail', 'quotes.%s shown differently in %s' % (qid, lang),
                             ['page: "%s"' % short(shown, 120), 'facts.json: "%s"' % short(want, 120), DIM(where)]))
                data.append({'quote_id': qid, 'lang': lang, 'shown': shown, 'expected': want, 'verbatim': False})
            continue
        if not attr and lang != paper_lang and CJK.search(text) and not CJK.search(paper.raw[:200000]):
            # a translation on the page cannot be found in the paper; data-quote="original" makes it checkable
            skipped.append(where)
            continue
        add(text, where)
    for qid, entry in sorted(fq.items()):
        original = (entry.get(paper_lang) or entry.get('en')) if isinstance(entry, dict) else str(entry)
        if original and not original.startswith('<'):
            add(original, 'facts.json quotes.%s' % qid)
    sentences = None
    for key, item in sorted(by_text.items(), key=lambda kv: kv[1]['where'][0]):
        q = strip_quote(key)
        ok, how = find_quote(q, paper.texts)
        entry = {'quote': item['text'], 'where': item['where'], 'verbatim': ok}
        if ok:
            rows.append(('pass', '"%s"' % short(item['text'], 90), [DIM(where_list(item['where']))]))
        else:
            if sentences is None:
                sentences = candidate_windows(paper.texts[0] if paper.texts else '')
            detail = [DIM(where_list(item['where']))]
            if how == 'loose':
                detail.append('the words match when case and punctuation are ignored; copy the paper\'s exact text')
            best = closest(q, sentences)
            if best:
                ratio, passage = best
                entry['closest'] = passage
                entry['ratio'] = round(ratio, 3)
                detail.append('closest passage (%d%%): %s' % (round(ratio * 100), short(passage, 160)))
                detail.append('diff (page → paper): ' + word_diff(q, strip_quote(passage)))
            else:
                detail.append('no similar passage in the paper')
            rows.append(('fail', '"%s"' % short(item['text'], 90), detail))
        data.append(entry)
    if skipped:
        rows.append(('info', '%d translated quote%s skipped: %s' % (len(skipped), '' if len(skipped) == 1 else 's', where_list(skipped)),
                     ['put the original sentence (or its facts.json quote id) in data-quote="…" to have it checked']))
    checked = [e for e in data if 'quote' in e]
    if not checked and not skipped and not data:
        return 'no quotes on the page (.pm-quote / [data-quote])', rows, data
    n_ok = sum(1 for e in checked if e['verbatim'])
    summary = '%d checked · %d verbatim · %d differ%s' % (len(checked), n_ok, len(checked) - n_ok,
                                                        ' · %d translated (skipped)' % len(skipped) if skipped else '')
    return summary, rows, data


def strip_quote(q):
    q = re.sub(r'^[\s"\'(\[]+', '', q)
    q = re.sub(r'[\s"\')\].,;:!?]+$', '', q)
    return q


def find_quote(q, texts):
    """(True, 'exact') if every …-separated piece of q appears in order in one of the texts; else (False, how)."""
    pieces = [p.strip(' "\'.,;:') for p in re.split(r'\s*(?:\[\s*\.\.\.\s*\]|\.\.\.)\s*', q)]
    pieces = [p for p in pieces if len(p) >= 2]
    if not pieces:
        return True, 'empty'
    for t in texts:
        pos, ok = 0, True
        for p in pieces:
            k = t.find(p, pos)
            if k < 0:
                ok = False
                break
            pos = k + len(p)
        if ok:
            return True, 'exact'
    lq = [loose(p) for p in pieces]
    for t in texts:
        lt = loose(t)
        pos, ok = 0, True
        for p in lq:
            k = lt.find(p, pos)
            if k < 0:
                ok = False
                break
            pos = k + len(p)
        if ok:
            return False, 'loose'
    return False, 'missing'


def candidate_windows(text):
    sents = [s.strip() for s in re.split(r'(?<=[.!?。！？])\s+', text) if s.strip()]
    wins = list(sents)
    wins += [sents[i] + ' ' + sents[i + 1] for i in range(len(sents) - 1)]
    return wins


def closest(q, windows):
    if not windows:
        return None
    ql = q.lower()
    sm = difflib.SequenceMatcher(None, autojunk=False)
    sm.set_seq2(ql)
    scored = []
    for w in windows:
        wl = w.lower()
        if len(wl) > 4 * len(ql) + 200:
            continue
        sm.set_seq1(wl)
        if sm.real_quick_ratio() < 0.3 or sm.quick_ratio() < 0.45:
            continue
        scored.append((sm.quick_ratio(), w))
    scored.sort(key=lambda x: -x[0])
    best = None
    for _, w in scored[:40]:
        span = best_span(q, w)
        r = difflib.SequenceMatcher(None, q.lower(), span.lower(), autojunk=False).ratio()
        if not best or r > best[0]:
            best = (r, span)
    return best if best and best[0] >= 0.55 else None


def best_span(q, w):
    """The part of window w that lines up with q (whole words)."""
    sm = difflib.SequenceMatcher(None, q.lower(), w.lower(), autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size >= 3]
    if not blocks:
        return w
    a, b = blocks[0].b, blocks[-1].b + blocks[-1].size
    a = max(0, a - blocks[0].a)
    b = min(len(w), b + (len(q) - blocks[-1].a - blocks[-1].size))
    while a > 0 and w[a - 1] not in ' ':
        a -= 1
    while b < len(w) and w[b] not in ' ':
        b += 1
    return w[a:b].strip()


def word_diff(a, b):
    wa, wb = a.split(), b.split()
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes():
        if op == 'equal':
            seg = wa[i1:i2]
            out.append(' '.join(seg if len(seg) <= 8 else seg[:3] + ['…'] + seg[-3:]))
        else:
            if i2 > i1:
                out.append(RED('[-%s-]' % ' '.join(wa[i1:i2])))
            if j2 > j1:
                out.append(GREEN('{+%s+}' % ' '.join(wb[j1:j2])))
    return ' '.join(out)


def short(s, n):
    s = re.sub(r'\s+', ' ', s or '').strip()
    return s if len(s) <= n else s[:n - 1] + '…'


# ---------------------------------------------------------------------------- references

NUMLIST = r'(\d+[a-z]?(?:\s*(?:,|and|&|–|—|-|to|和|与|、|至)\s*\d+[a-z]?)*)'
SECNUM = r'((?:\d+|[A-Z])(?:\.\d+)*)'
ZH_PREV = r'(?:(?<=^)|(?<=[\s（(，,、。；;：:见如照文和与及至“"\'【\[]))'
REF_PATTERNS = [
    ('section', re.compile(r'§\s*' + SECNUM)),
    ('section', re.compile(r'\bSec(?:tions?|s?\.)\s*~?\s*' + SECNUM)),
    ('figure', re.compile(r'\bFig(?:ures?|s?\.)\s*~?\s*' + NUMLIST)),
    ('table', re.compile(r'\b(?:Tables?|Tabs?\.)\s*~?\s*' + NUMLIST)),
    ('appendix', re.compile(r'\b(?:Appendix|Appendices|App\.)\s+([A-Z](?:\.\d+)*)(?![\w])')),
    ('section', re.compile(r'第\s*' + SECNUM + r'\s*[节章]')),
    ('figure', re.compile(ZH_PREV + r'图\s*' + NUMLIST)),
    ('table', re.compile(ZH_PREV + r'表\s*' + NUMLIST)),
    ('appendix', re.compile(r'附录\s*([A-Z](?:\.\d+)*)')),
]
REF_NAME = {'section': '§', 'figure': 'Fig. ', 'table': 'Table ', 'appendix': 'Appendix '}


def expand_numbers(s):
    out = []
    for m in re.finditer(r'(\d+)[a-z]?(?:\s*(?:–|—|-|to|至)\s*(\d+)[a-z]?)?', s):
        a = int(m.group(1))
        b = int(m.group(2)) if m.group(2) else a
        if b < a or b - a > 50:
            b = a
        out.extend(range(a, b + 1))
    return out


def find_refs(sources, page_sources=()):
    """{(kind, number): [places]}. Page-level text only adds a place for references no part in that language shows."""
    refs, langs = {}, {}
    for gi, src in [(0, x) for x in sources] + [(1, x) for x in page_sources]:
        text = src.text
        for kind, rx in REF_PATTERNS:
            for m in rx.finditer(text):
                if kind in ('figure', 'table'):
                    nums = [str(n) for n in expand_numbers(m.group(1))]
                else:
                    nums = [m.group(1)]
                for n in nums:
                    if kind == 'section' and n.isalpha() and len(n) == 1:
                        k = ('appendix', n)
                    else:
                        k = (kind, n)
                    if gi == 1 and src.lang in langs.get(k, ()):
                        continue
                    places = refs.setdefault(k, [])
                    if src.where not in places:
                        places.append(src.where)
                    if gi == 0:
                        langs.setdefault(k, set()).add(src.lang)
    return refs


def resolve_ref(kind, num, st):
    """(exists, title or hint)."""
    if kind == 'section':
        if num in st.sections:
            return True, st.sections[num]
        if '.' not in num and num.isdigit() and any(k.split('.')[0] == num for k in st.sections):
            return True, ''
        top = sorted({k for k in st.sections if '.' not in k and k.isdigit()}, key=int)
        return False, 'the paper has sections %s' % (('1–%s' % top[-1]) if top else 'none detected')
    if kind == 'appendix':
        top = num.split('.')[0]
        if num in st.sections:
            return True, st.sections[num]
        if top in st.appendix_letters and '.' not in num:
            return True, st.sections.get(top, '')
        return False, 'the paper has appendix %s' % ('/'.join(sorted(st.appendix_letters)) or 'none detected')
    table = st.figures if kind == 'figure' else st.tables
    n = int(num)
    if n in table:
        return True, table[n]
    have = sorted(table)
    return False, 'the paper has %s %s' % ('figures' if kind == 'figure' else 'tables',
                                           ('1–%d' % have[-1]) if have else 'none detected')


def check_refs(sources, page_sources, paper):
    refs = find_refs(sources, page_sources)
    rows, data = [], []
    st = paper.structure
    order = {'section': 0, 'appendix': 1, 'figure': 2, 'table': 3}

    def sort_key(k):
        kind, num = k
        parts = [int(x) if x.isdigit() else ord(x[0]) - 1000 for x in num.split('.')]
        return (order[kind], parts)

    for kind, num in sorted(refs, key=sort_key):
        label = '%s%s' % (REF_NAME[kind], num)
        ok, info = resolve_ref(kind, num, st)
        title = short(info, 70) if ok and info else ''
        detail = [DIM(where_list(refs[(kind, num)]))]
        if not ok:
            detail.insert(0, info + (' (headings detected from text; pass the .tex for exact numbering)' if paper.kind == 'text' else ''))
        rows.append(('pass' if ok else 'fail', '%-14s %s' % (label, ('→ ' + title) if title else ''), detail))
        data.append({'ref': label, 'kind': kind, 'number': num, 'exists': ok, 'title': info if ok else None,
                     'where': refs[(kind, num)]})
    missing = sum(1 for d in data if not d['exists'])
    return '%d found · %d exist · %d missing' % (len(data), len(data) - missing, missing), rows, data


# ---------------------------------------------------------------------------- facts

class Facts:
    """facts.json: {"facts": {key: entry}, "refs": {id: {en, zh, anchor}}, "quotes": {id: {en, zh, ref}}, …}, or a
    flat {key: entry}. An entry is "41.2K" or {"value": "41.2K", "zh": …, "aliases": […], "ref": id, "loc": …}."""

    SECTIONS = ('paper', 'refs', 'quotes', 'runs', 'facts')

    def __init__(self, raw):
        self.values, self.refs, self.quotes = {}, {}, {}
        if isinstance(raw, list):
            raw = {'facts': raw}
        if not isinstance(raw, dict):
            return
        body = raw.get('facts') if isinstance(raw.get('facts'), (dict, list)) else None
        if body is None:      # flat file: every key that is not a known section
            body = {k: v for k, v in raw.items() if not (k in self.SECTIONS and isinstance(v, dict))}
        if isinstance(body, list):
            body = {str(i['key']): i for i in body if isinstance(i, dict) and 'key' in i}
        self.values = {k: v for k, v in body.items() if not k.startswith(('_', '$'))}
        if isinstance(raw.get('refs'), dict):
            self.refs = {k: v for k, v in raw['refs'].items() if not k.startswith(('_', '$'))}
        if isinstance(raw.get('quotes'), dict):
            self.quotes = {k: v for k, v in raw['quotes'].items() if not k.startswith(('_', '$'))}

    def where(self, key):
        """'Table 2 · row Mean' style location of a fact, for messages."""
        e = self.values.get(key)
        if not isinstance(e, dict):
            return ''
        bits = []
        ref = e.get('ref')
        if ref:
            r = self.refs.get(ref)
            bits.append(r.get('en', ref) if isinstance(r, dict) else str(ref))
        for k in ('source', 'loc'):
            if e.get(k):
                bits.append(str(e[k]))
        return ' · '.join(bits)


def load_facts(path):
    try:
        with open(path, encoding='utf-8') as fh:
            raw = json.load(fh)
    except (OSError, ValueError) as exc:
        raise UsageError('cannot read facts %s (%s)' % (path, exc))
    return Facts(raw)


def fact_values(entry, lang):
    if isinstance(entry, (str, int, float)):
        return [str(entry)]
    if not isinstance(entry, dict):
        return []
    vals = []
    if lang in entry and isinstance(entry[lang], (str, int, float)):
        vals.append(str(entry[lang]))
    if 'value' in entry:
        vals.append(str(entry['value']))
    for a in entry.get('aliases') or []:
        vals.append(str(a))
    if not vals:
        vals += [str(v) for k, v in entry.items() if k in ('en', 'zh') and isinstance(v, (str, int, float))]
    return vals


def fact_norm(s):
    return re.sub(r'\s+', ' ', norm(str(s)).replace('\u2009', ' ').replace('\u202f', ' ')).strip()


def check_facts(facts_on_page, facts):
    rows, data = [], []
    groups = {}      # (key, text, verdict, expected) -> places
    used = set()
    values = facts.values
    for key, text, lang, pid in facts_on_page:
        text = fact_norm(text)
        used.add(key)
        if key not in values:
            verdict, want = 'unknown', ()
        else:
            want = tuple(dict.fromkeys(fact_values(values[key], lang)))
            verdict = 'ok' if any(fact_norm(w) == text for w in want) else 'differs'
        places = groups.setdefault((key, text, verdict, want), [])
        if '%s (%s)' % (pid, lang) not in places:
            places.append('%s (%s)' % (pid, lang))
    for (key, text, verdict, want), places in sorted(groups.items()):
        where = DIM(where_list(places))
        if verdict == 'ok':
            rows.append(('pass', '%s = "%s"' % (key, text), [where]))
        elif verdict == 'unknown':
            rows.append(('fail', '%s = "%s"' % (key, text), ['no such key in facts.json', where]))
        else:
            loc = facts.where(key)
            rows.append(('fail', '%s = "%s"' % (key, text), ['facts.json says "%s"%s' % ('" or "'.join(want), (' (%s)' % loc) if loc else ''), where]))
        data.append({'key': key, 'text': text, 'verdict': verdict, 'expected': list(want), 'where': places})
    unused = sorted(set(values) - used)
    if unused:
        rows.append(('info', 'not shown on the page: %s' % short(', '.join(unused), 200), []))
    bad = sum(1 for d in data if d['verdict'] != 'ok')
    return '%d on the page · %d match · %d differ' % (len(data), len(data) - bad, bad), rows, data


def check_fact_refs(facts, paper):
    """Every facts.json ref label must exist in the paper, in each language, and point at the same thing; when an
    anchor (first words of the heading or caption) is given, the title there must still start that way: a renumbered
    paper shows up here first."""
    rows, data = [], []
    st = paper.structure
    for rid, entry in sorted(facts.refs.items()):
        if not isinstance(entry, dict):
            continue
        targets = {}
        for lang in ('en', 'zh'):
            label = entry.get(lang)
            if isinstance(label, str) and label.strip():
                found = list(find_refs([Source(label, lang, 'facts.json')]))
                if found:
                    targets[lang] = found
        if not targets:
            continue          # "Abstract" and other labels that are not numbered things
        en = targets.get('en') or next(iter(targets.values()))
        problems = []
        if 'en' in targets and 'zh' in targets and sorted(targets['en']) != sorted(targets['zh']):
            problems.append('the zh label "%s" points elsewhere than the en label "%s"' % (entry.get('zh'), entry.get('en')))
        titles = []
        for kind, num in en:
            ok, info = resolve_ref(kind, num, st)
            if not ok:
                problems.append('%s%s: %s' % (REF_NAME[kind], num, info))
            else:
                titles.append(info)
        anchor = entry.get('anchor')
        if isinstance(anchor, str) and anchor.strip() and not re.search(r'first words|<', anchor) and titles:
            if not any(loose(anchor)[:60] in loose(t) or (t and loose(t) in loose(anchor)) for t in titles):
                problems.append('the anchor "%s" does not match "%s" (renumbered?)' % (short(anchor, 60), short(titles[0], 60)))
        label = entry.get('en') or entry.get('zh')
        rows.append(('fail' if problems else 'pass', 'refs.%-14s %s%s' % (rid, label, ('  → ' + short(titles[0], 60)) if titles and titles[0] and not problems else ''), problems))
        data.append({'ref_id': rid, 'label': label, 'ok': not problems, 'problems': problems})
    return rows, data


# ---------------------------------------------------------------------------- words

def load_words(path):
    try:
        with open(path, encoding='utf-8') as fh:
            raw = json.load(fh)
    except (OSError, ValueError) as exc:
        raise UsageError('cannot read words %s (%s)' % (path, exc))
    return raw if isinstance(raw, dict) else {}


def term_regex(term):
    m = re.match(r'^/(.+)/([a-z]*)$', term)
    if m:
        flags = re.I if 'i' in m.group(2) else 0
        return re.compile(m.group(1), flags)
    esc = re.escape(term)
    if re.match(r'^[\x00-\x7f]+$', term):
        return re.compile(r'(?<![A-Za-z0-9])%s(?![A-Za-z0-9])' % esc, re.I)
    return re.compile(esc, re.I)


def by_lang(value, lang):
    if isinstance(value, dict) and set(value) <= {'en', 'zh', 'all', '*'} and value:
        out = []
        for k in ('all', '*', lang):
            v = value.get(k)
            if isinstance(v, list):
                out += v
            elif isinstance(v, dict):
                out += list(v.items())
        return out
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return list(value.items())
    return []


def snippet(text, m, pad=40):
    a, b = max(0, m.start() - pad), min(len(text), m.end() + pad)
    out = ('…' if a else '') + text[a:m.start()] + BOLD(m.group(0)) + text[m.end():b] + ('…' if b < len(text) else '')
    return re.sub(r'\s+', ' ', out)


def scan(part_sources, page_sources, rx_list, hits=None):
    """Hits of the patterns, one per (term, match) with every place it appears: {tid, match, wheres, snippet}.
    The page text repeats every part, so it only adds a place for matches that no part in that language shows."""
    hits = {} if hits is None else hits
    for gi, sources in enumerate((part_sources, page_sources)):
        for src in sources:
            for tid, rx in rx_list:
                for m in rx.finditer(src.text):
                    key = (tid, m.group(0).lower())
                    h = hits.get(key)
                    if gi == 1 and h and src.lang in h['langs']:
                        continue
                    if not h:
                        h = hits[key] = {'tid': tid, 'match': m.group(0), 'wheres': [], 'langs': set(),
                                         'snippet': snippet(src.text, m)}
                    if src.where not in h['wheres']:
                        h['wheres'].append(src.where)
                    if gi == 0:
                        h['langs'].add(src.lang)
    return hits


def word_rules(words, lang):
    """(bans, prefers) for one language. bans: [(label, regex, use, why)]; prefers: [(label, regex, use)]."""
    bans, prefers = [], []
    for item in by_lang(words.get('ban', []), lang):
        if isinstance(item, str):
            bans.append((item, term_regex(item), None, None))
        elif isinstance(item, dict) and item.get('pattern'):
            try:
                rx = re.compile(item['pattern'], re.I if 'i' in str(item.get('flags') or '') else 0)
            except re.error as exc:
                raise UsageError('words.json: bad ban pattern %r (%s)' % (item['pattern'], exc))
            bans.append((item['pattern'], rx, item.get('use'), item.get('why')))
    for item in by_lang(words.get('prefer', {}), lang):
        if isinstance(item, tuple) and len(item) == 2:
            prefers.append((item[0], term_regex(item[0]), item[1]))
        elif isinstance(item, dict) and (item.get('pattern') or item.get('term')):
            prefers.append((item.get('pattern') or item.get('term'), term_regex(item.get('pattern') or item.get('term')), item.get('use')))
    for term in words.get('terms') or []:
        if isinstance(term, dict):
            use = term.get(lang) or term.get('en')
            for avoid in term.get('avoid') or []:
                if isinstance(avoid, str) and avoid.strip():
                    prefers.append((avoid, term_regex(avoid), use))
    return bans, prefers


def check_words(part_sources, page_sources, words, strict):
    rows, data = [], []
    langs = sorted({x.lang for x in part_sources + page_sources})
    ban_hits, prefer_hits, info = {}, {}, {}
    for lang in langs:
        bans, prefers = word_rules(words, lang)
        parts = [x for x in part_sources if x.lang == lang]
        pages = [x for x in page_sources if x.lang == lang]
        # rule ids carry the language, so a suggestion is always given in the language of the text it fixes
        for label, _, use, why in bans:
            info[(label, lang)] = (use, why)
        for label, _, use in prefers:
            info.setdefault((label, lang), (use, None))
        scan(parts, pages, [((label, lang), rx) for label, rx, _, _ in bans], ban_hits)
        scan(parts, pages, [((label, lang), rx) for label, rx, _ in prefers], prefer_hits)
    banned = {h['match'].lower() for h in ban_hits.values()}
    for h in ban_hits.values():
        use, why = info.get(h['tid'], (None, None))
        hint = '; '.join(x for x in ('write "%s"' % use if use else '', why or '') if x)
        rows.append(('fail', 'banned "%s"%s' % (h['match'], ('  (' + hint + ')') if hint else ''), [h['snippet'], DIM(where_list(h['wheres']))]))
        data.append({'kind': 'ban', 'term': h['tid'][0], 'match': h['match'], 'use': use, 'why': why, 'where': h['wheres']})
    n_prefer = 0
    for h in prefer_hits.values():
        if h['match'].lower() in banned:
            continue                      # already a failure above
        n_prefer += 1
        use = info.get(h['tid'], (None, None))[0]
        rows.append(('fail' if strict else 'warn', '"%s" → write "%s"' % (h['match'], use or '?'),
                     [h['snippet'], DIM(where_list(h['wheres']))]))
        data.append({'kind': 'prefer', 'term': h['tid'][0], 'match': h['match'], 'use': use, 'where': h['wheres']})
    return '%d banned · %d to rephrase' % (len(ban_hits), n_prefer), rows, data


# ---------------------------------------------------------------------------- privacy

PLACEHOLDER_NAMES = {'you', 'user', 'username', 'me', 'name', 'example', 'your-name', 'yourname', 'someone', 'shared'}
PRIVACY = [
    ('e-mail', re.compile(r'(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w-])'), 'fail'),
    ('IPv4 address', re.compile(r'(?<![\d.vVrR])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.]\d)'), 'fail'),
    ('account path', re.compile(r'(?:/Users/|/home/|[A-Za-z]:\\Users\\)[A-Za-z0-9._-]+|/root/[A-Za-z0-9._/-]+'), 'fail'),
    ('API key', re.compile(r'\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}'
                           r'|\bAKIA[0-9A-Z]{16}\b|\bxox[abposr]-[A-Za-z0-9-]{10,}|\bAIza[0-9A-Za-z_-]{35}|\bhf_[A-Za-z0-9]{30,}'), 'fail'),
    ('JWT', re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'), 'fail'),
    ('private key', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'), 'fail'),
    ('secret assignment', re.compile(r'(?i)(?<![?&])\b(?:api[_-]?key|secret|token|passw(?:or)?d|access[_-]?key)\b["\']?\s*[:=]\s*["\']?'
                                     r'(?![A-Z_]+\b)(?!.*(?:xxx|your|example|<))[A-Za-z0-9_\-./+=]{12,}'), 'fail'),
    ('URL with a token', re.compile(r'https?://[^\s"\'<>]*[?&](?:token|access_token|api_key|apikey|key|auth|sig|signature|'
                                    r'secret|password|X-Amz-Signature|X-Amz-Credential|code)=[^\s&"\'<>]{6,}', re.I), 'fail'),
    ('URL with a password', re.compile(r'https?://[^\s/@:"\'<>]+:[^\s/@"\'<>]+@'), 'fail'),
    ('random-looking string', re.compile(r'\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{32,}\b'), 'warn'),
]
ALWAYS_OK = [re.compile(p) for p in (r'@example\.(?:com|org|net)$', r'^127\.0\.0\.1$', r'^0\.0\.0\.0$', r'^255\.255\.255\.\d+$',
                                     r'@users\.noreply\.github\.com$')]


def check_privacy(part_sources, page_sources, allow, strict):
    rows, data = [], []
    allow_rx = [re.compile(a) for a in allow] + ALWAYS_OK
    hits = scan(part_sources, page_sources, [(name, rx) for name, rx, _ in PRIVACY])
    severity = {name: sev for name, _, sev in PRIVACY}
    for h in hits.values():
        name, match = h['tid'], h['match']
        if any(a.search(match) for a in allow_rx):
            continue
        if name == 'account path' and not match.startswith('/root/'):
            if re.split(r'[/\\]', match.rstrip('/\\'))[-1].lower() in PLACEHOLDER_NAMES:
                continue
        sev = severity[name]
        rows.append(('fail' if sev == 'fail' or strict else 'warn', '%s: %s' % (name, short(match, 60)),
                     [h['snippet'], DIM(where_list(h['wheres']))]))
        data.append({'kind': name, 'match': match, 'where': h['wheres'], 'severity': sev})
    nf = sum(1 for d in data if d['severity'] == 'fail')
    return '%d to remove · %d to check' % (nf, len(data) - nf), rows, data


# ============================================================================ main

def print_report(rep, header):
    print(BOLD('PLAYME fidelity') + DIM('  ' + header))
    icon = {'pass': GREEN('✓'), 'fail': RED('✗'), 'warn': YELLOW('!'), 'info': DIM('·')}
    for name, summary, rows in rep.sections:
        print('')
        status = 'fail' if any(r[0] == 'fail' for r in rows) else 'warn' if any(r[0] == 'warn' for r in rows) else 'pass'
        if not rows and summary.startswith('not checked'):
            status = 'skip'
        tag = {'pass': GREEN('PASS'), 'fail': RED('FAIL'), 'warn': YELLOW('WARN'), 'skip': DIM('SKIP')}[status]
        print('%s %s  %s' % (tag, BOLD('%-11s' % name), summary))
        for st, text, detail in rows:
            print('  %s %s' % (icon[st], text))
            if st != 'pass' or detail and len(detail) == 1 and name in ('Quotes', 'References', 'Facts'):
                for d in detail:
                    if d:
                        print('      ' + d)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Check that a PLAYME page says what the paper says.',
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dump', help='text dump from: node lint.mjs --url … --dump text.json')
    ap.add_argument('--paper', action='append', default=[], help='paper source: .tex (best), .pdf, .txt or .md (repeatable)')
    ap.add_argument('--facts', help='facts.json: {"facts": {key: {"value": …}}, "refs": {…}, "quotes": {…}} or {"key": "value"}')
    ap.add_argument('--words', help='words.json: {"ban": [term | "/re/i" | {pattern, flags, use, why}], "prefer": {"bad": "good"}, '
                    '"terms": [{en, zh, avoid: […]}], "allow": [regex…]}')
    ap.add_argument('--text', action='append', default=[], help='also check a text file (README, captions) for '
                    'references, words and privacy (repeatable)')
    ap.add_argument('--paper-lang', default='en', help='language of the paper (quotes in other languages need data-quote)')
    ap.add_argument('--allow', action='append', default=[], metavar='REGEX', help='privacy hits matching REGEX are fine')
    ap.add_argument('--json', help='write the full report as JSON')
    ap.add_argument('--strict', action='store_true', help='warnings fail too')
    ap.add_argument('--no-privacy', action='store_true', help='skip the privacy scan')
    args = ap.parse_args(argv)
    if not args.dump and not args.text:
        ap.print_usage(sys.stderr)
        print('error: give --dump text.json (from lint.mjs) and/or --text FILE', file=sys.stderr)
        return 2
    try:
        part_src, page_src, quotes, facts_on_page = [], [], [], []
        header = []
        if args.dump:
            data = load_dump(args.dump)
            part_src, page_src, quotes, facts_on_page = dump_sources(data)
            n_parts = len({p.get('id') for p in data.get('parts', [])})
            header.append('dump %s (%d parts · %s)' % (os.path.basename(args.dump), n_parts, '/'.join(data.get('langs') or [])))
        for t in args.text:
            if not os.path.isfile(t):
                raise UsageError('text file not found: %s' % t)
            with open(t, encoding='utf-8', errors='replace') as fh:
                body = fh.read()
            lang = 'zh' if len(CJK.findall(body)) > 50 else 'en'
            part_src.append(Source(body, lang, os.path.basename(t)))
            header.append(os.path.basename(t))
        paper = Paper(args.paper) if args.paper else None
        if paper:
            header.append('paper ' + paper.describe())
        words = load_words(args.words) if args.words else None
        facts = load_facts(args.facts) if args.facts else None
        if words is not None:
            for lang in ('en', 'zh'):
                word_rules(words, lang)          # bad patterns are a usage error, reported before any check
    except UsageError as exc:
        print('error: %s' % exc, file=sys.stderr)
        return 2

    rep = Report()
    if paper:
        rep.section('Quotes', *check_quotes(quotes, paper, args.paper_lang, facts))
        summary, rows, data = check_refs(part_src, page_src, paper)
        if facts is not None and facts.refs:
            frows, fdata = check_fact_refs(facts, paper)
            rows += frows
            data += fdata
            summary += ' · %d facts.json refs' % len(fdata)
        rep.section('References', summary, rows, data)
    else:
        n_refs = len(find_refs(part_src, page_src))
        rep.section('Quotes', 'not checked (no --paper) · %d on the page' % len({norm(q[0]) for q in quotes}), [])
        rep.section('References', 'not checked (no --paper) · %d on the page' % n_refs, [])
    if facts is not None:
        rep.section('Facts', *check_facts(facts_on_page, facts))
    else:
        rep.section('Facts', 'not checked (no --facts) · %d on the page' % len({f[0] for f in facts_on_page}), [])
    if words is not None:
        rep.section('Words', *check_words(mask_quotes(part_src, quotes), mask_quotes(page_src, quotes), words, args.strict))
    if not args.no_privacy:
        allow = list(args.allow) + [a for a in ((words or {}).get('allow') or []) if isinstance(a, str)]
        rep.section('Privacy', *check_privacy(part_src, page_src, allow, args.strict))

    print_report(rep, ' · '.join(header))
    print('')
    print(DIM('Images are not scanned: check screenshots and figures by eye for IPs, e-mails, QR codes, IDs and account paths.'))
    failed = rep.fails + (rep.warns if args.strict else 0)
    if failed:
        print(RED(BOLD('FAIL')) + ' %d problem%s%s' % (rep.fails, '' if rep.fails == 1 else 's',
                                                        ' · %d warning%s' % (rep.warns, '' if rep.warns == 1 else 's') if rep.warns else ''))
    else:
        print(GREEN(BOLD('PASS')) + (' · %d warning%s' % (rep.warns, '' if rep.warns == 1 else 's') if rep.warns else ''))
    if args.json:
        out = {'tool': 'playme fidelity.py 1.0.0', 'verdict': 'FAIL' if failed else 'PASS', 'fails': rep.fails,
               'warnings': rep.warns, 'checks': rep.data}
        with open(args.json, 'w', encoding='utf-8') as fh:
            json.dump(out, fh, ensure_ascii=False, indent=2, default=str)
            fh.write('\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
