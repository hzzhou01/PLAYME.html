#!/usr/bin/env python3
"""bundle.py — turn a PLAYME page and its local files into ONE self-contained HTML file.

Usage
    python3 bundle.py index.html -o PLAYME.html             # inline everything local; three.js from the CDN if used
    python3 bundle.py index.html -o PLAYME.html --offline   # + three.js r160 inlined: opens with no network at all
    options:  --assets DIR      also put every media file under DIR into window.PM_ASSETS (paths built at runtime)
              --three PATH      the three.js ES module to inline (default: kit/vendor/three-0.160.0.module.min.js)
              --force-three     inline three.js with --offline even when the page does not look like it uses 3D
              --root DIR        resolve root-relative paths ("/img/a.png") against DIR; refuse files outside it
              --strict          exit 1 when there are warnings (CI)
              --quiet           only warnings and errors

What is inlined (Python 3 standard library only; the input is never modified)
  <link rel=stylesheet href=local.css>  → <style data-pm-src=…> in the same place (cascade order kept); @import of
                                          local files is inlined recursively; url(…) → data: URI (fonts, images).
  <script src=local.js>                 → <script data-pm-src=…> with "</script" and "<!--" escaped. A `defer`
                                          script moves to the end of <body> (same order), so it still runs after
                                          the document is parsed.
  <img src/srcset>, <source>, <video poster/src>, <audio src>, <image href>, <link rel=icon>, style="url(…)"
                                        → data: URIs (SVG percent-encoded, everything else base64).
  PM.asset('path') string literals in any script  → window.PM_ASSETS = {path: data URI}, injected right after
                                          playme.js (one copy per file, however often it is referenced).
  --offline                             → window.PM_THREE_SRC = "<three.js module source>" as the FIRST script;
                                          the kit imports it from a blob: URL, so 3D works from file:// offline.
Network URLs (https://…) are left alone and reported: the page will need the network for them.
Paths built at runtime (PM.asset(`img/${name}.png`), PM.asset(variable)) are invisible to this scan; they are
reported with file:line. List them as complete literals, or pass --assets DIR. Path literals of existing files
written without PM.asset() are mapped too (kit APIs pass image paths through PM.asset) and listed in a note;
`lint.mjs --offline-file` catches any that the code loads directly.

The output is deterministic (no timestamps; sorted maps); the file is rewritten only when its content changes.
The size report splits the result into markup / css / js / images / fonts / media / three.js.
Exit codes: 0 ok · 1 warnings with --strict · 2 error (missing input, unreadable file).
"""

import argparse
import base64
import gzip
import hashlib
import html
import json
import mimetypes
import os
import re
import sys
import tempfile
import urllib.parse

THREE_FILE = 'three-0.160.0.module.min.js'
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_THREE = os.path.normpath(os.path.join(HERE, '..', 'kit', 'vendor', THREE_FILE))

MIME = {
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
    'avif': 'image/avif', 'svg': 'image/svg+xml', 'ico': 'image/x-icon', 'bmp': 'image/bmp',
    'woff2': 'font/woff2', 'woff': 'font/woff', 'ttf': 'font/ttf', 'otf': 'font/otf',
    'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
    'ogg': 'audio/ogg', 'm4a': 'audio/mp4', 'vtt': 'text/vtt', 'json': 'application/json', 'txt': 'text/plain',
    'pdf': 'application/pdf',
}
ASSET_EXT = ('png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'woff2', 'woff', 'ttf', 'otf',
             'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a', 'vtt')
BIG_ASSET = 2 * 1024 * 1024        # warn above this (suggest webp / a shorter clip)

RE_SCHEME = re.compile(r'^\s*(?:[a-z][a-z0-9+.-]*:|//)', re.I)
RE_CSS_URL = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""", re.I | re.S)
RE_CSS_IMPORT = re.compile(r"""@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);""", re.I)
RE_CSS_COMMENT = re.compile(r'/\*.*?\*/', re.S)
RE_PM_ASSET = re.compile(r"""\bPM\.asset\(\s*(['"`])([^'"`\\\n]*?)\1\s*\)""")
RE_PM_ASSET_DYNAMIC = re.compile(r"""\bPM\.asset\(\s*(?:`[^`]*\$\{|[A-Za-z_$(])""")
RE_PATH_LITERAL = re.compile(r"""(['"`])((?:\.{1,2}/)?[\w@~+-][\w@~+./ -]*\.(?:%s))\1""" % '|'.join(ASSET_EXT), re.I)
RE_FETCH_LOCAL = re.compile(r"""\bfetch\(\s*(['"`])(?!https?:|//|data:|blob:)([^'"`]+)\1""")
RE_RAW_TEXT = ('script', 'style', 'textarea', 'title', 'xmp')
RE_ATTR = re.compile(r'''([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?''')



def in_string(src, pos):
    """True when pos sits inside a quoted string on its line (an odd number of unescaped quotes of one kind before
    it), e.g. a PM.asset(...) call that is part of a code sample the page displays. Good enough for one-line samples;
    template literals spanning lines are not tracked."""
    start = src.rfind('\n', 0, pos) + 1
    head = src[start:pos]
    for q in ("'", '"', '`'):
        n, i = 0, 0
        while i < len(head):
            if head[i] == '\\':
                i += 2
                continue
            if head[i] == q:
                n += 1
            i += 1
        if n % 2 == 1:
            return True
    return False

class BuildError(Exception):
    pass


# ----------------------------------------------------------------------------- small helpers

def human(n):
    if n >= 1024 * 1024:
        return '%.2f MB' % (n / 1024 / 1024)
    if n >= 1024:
        return '%.1f KB' % (n / 1024)
    return '%d B' % n


def read_text(path):
    try:
        with open(path, encoding='utf-8-sig') as fh:
            return fh.read()
    except (OSError, UnicodeDecodeError) as exc:
        raise BuildError('cannot read %s (%s)' % (path, exc))


def write_atomic(path, text):
    """Write text to path atomically; True if the content changed."""
    data = text.encode('utf-8')
    try:
        with open(path, 'rb') as fh:
            if fh.read() == data:
                return False
    except FileNotFoundError:
        pass
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.bundle.', suffix='.tmp', dir=directory)
    try:
        with os.fdopen(fd, 'wb') as fh:
            fh.write(data)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return True


def safe_inline_js(src):
    """JS source made safe inside <script>…</script> without changing its meaning in strings, templates, regexes
    or comments: '</script' -> '<\\/script', '<!--' -> '<\\x21--'."""
    src = re.sub(r'</(script)', r'<\\/\1', src, flags=re.I)
    return src.replace('<!--', '<\\x21--')


def safe_inline_css(src):
    return re.sub(r'</(style)', r'<\\/\1', src, flags=re.I)


def js_string(text):
    """A JS string literal for arbitrary text, safe inside an inline <script> (ASCII only, no '</', no '<!--')."""
    return json.dumps(text, ensure_ascii=True).replace('</', '<\\/').replace('<!--', '<\\u0021--')


def esc_attr(value):
    return value.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')


def category(mime):
    if mime.startswith('image/'):
        return 'images'
    if mime.startswith('font/'):
        return 'fonts'
    if mime.startswith(('video/', 'audio/')):
        return 'media'
    return 'other'


def line_of(text, offset):
    return text.count('\n', 0, offset) + 1


# ----------------------------------------------------------------------------- HTML tokens

class Tag:
    """One start tag. attrs: [[name, raw value or None, quote]] exactly as written (raw = entities not decoded)."""

    def __init__(self, raw, name, attrs, self_closing):
        self.raw, self.name, self.attrs, self.self_closing = raw, name, attrs, self_closing
        self.dirty = False

    def get(self, name):
        for a in self.attrs:
            if a[0].lower() == name:
                return html.unescape(a[1]) if a[1] is not None else ''
        return None

    def has(self, name):
        return any(a[0].lower() == name for a in self.attrs)

    def set(self, name, value):
        self.dirty = True
        for a in self.attrs:
            if a[0].lower() == name:
                a[1], a[2] = esc_attr(value), '"'
                return
        self.attrs.append([name, esc_attr(value), '"'])

    def remove(self, *names):
        before = len(self.attrs)
        self.attrs = [a for a in self.attrs if a[0].lower() not in names]
        self.dirty = self.dirty or len(self.attrs) != before

    def render(self, name=None):
        if not self.dirty and name is None:
            return self.raw
        out = ['<' + (name or self.name)]
        for n, v, q in self.attrs:
            out.append(' %s' % n if v is None else ' %s=%s%s%s' % (n, q or '"', v, q or '"'))
        out.append(' />' if self.self_closing else '>')
        return ''.join(out)


def parse_tag(raw):
    inner = raw[1:-1]
    m = re.match(r'[A-Za-z][^\s/>]*', inner)
    name = m.group(0)
    rest = inner[m.end():]
    self_closing = rest.rstrip().endswith('/')
    if self_closing:
        rest = rest.rstrip()[:-1]
    attrs = []
    for am in RE_ATTR.finditer(rest):
        if am.group(2) is not None:
            attrs.append([am.group(1), am.group(2), '"'])
        elif am.group(3) is not None:
            attrs.append([am.group(1), am.group(3), "'"])
        elif am.group(4) is not None:
            attrs.append([am.group(1), am.group(4), ''])
        else:
            attrs.append([am.group(1), None, ''])
    return Tag(raw, name.lower(), attrs, self_closing)


def tokenize(text):
    """[(kind, …)]: ('text', s) ('comment', s) ('decl', s) ('end', name, s) ('tag', Tag) ('raw', Tag, content, end).
    Comments and the content of script / style / textarea / title are never looked into."""
    out, i, n = [], 0, len(text)
    while i < n:
        j = text.find('<', i)
        if j < 0:
            out.append(('text', text[i:]))
            break
        if j > i:
            out.append(('text', text[i:j]))
        if text.startswith('<!--', j):
            k = text.find('-->', j + 4)
            k = n if k < 0 else k + 3
            out.append(('comment', text[j:k]))
            i = k
            continue
        if text.startswith('<![CDATA[', j):
            k = text.find(']]>', j)
            k = n if k < 0 else k + 3
            out.append(('text', text[j:k]))
            i = k
            continue
        if text.startswith(('<!', '<?'), j):
            k = text.find('>', j)
            k = n if k < 0 else k + 1
            out.append(('decl', text[j:k]))
            i = k
            continue
        m = re.match(r'</([A-Za-z][^\s/>]*)[^>]*>', text[j:j + 256])
        if m:
            out.append(('end', m.group(1).lower(), m.group(0)))
            i = j + m.end()
            continue
        if j + 1 < n and text[j + 1].isalpha():
            k, quote = j + 1, None
            while k < n:
                ch = text[k]
                if quote:
                    if ch == quote:
                        quote = None
                elif ch in '"\'':
                    # a quote opens a value only right after '=' (possibly with spaces)
                    p = k - 1
                    while p > j and text[p] in ' \t\r\n':
                        p -= 1
                    if text[p] == '=':
                        quote = ch
                elif ch == '>':
                    break
                k += 1
            raw = text[j:k + 1]
            tag = parse_tag(raw)
            i = k + 1
            if tag.name in RE_RAW_TEXT and not tag.self_closing:
                em = re.compile(r'</%s[\s/>]' % re.escape(tag.name), re.I).search(text, i)
                if not em:
                    out.append(('raw', tag, text[i:], ''))
                    i = n
                    continue
                close = text.find('>', em.start())
                close = n if close < 0 else close + 1
                out.append(('raw', tag, text[i:em.start()], text[em.start():close]))
                i = close
                continue
            out.append(('tag', tag))
            continue
        out.append(('text', '<'))
        i = j + 1
    return out


# ----------------------------------------------------------------------------- the bundler

class Bundler:
    def __init__(self, page, out, offline=False, assets_dirs=(), three=None, force_three=False, root=None,
                 quiet=False):
        self.page = os.path.abspath(page)
        self.base = os.path.dirname(self.page)
        self.out = os.path.abspath(out)
        self.offline, self.force_three, self.quiet = offline, force_three, quiet
        self.root = os.path.abspath(root) if root else None
        self.three_path = three
        self.assets_dirs = list(assets_dirs)
        self.warnings = []
        self.uri_cache = {}                 # (abs path, for_srcset) -> (uri, raw size, mime)
        self.sizes = {'css': 0, 'js': 0, 'images': 0, 'fonts': 0, 'media': 0, 'other': 0, 'three': 0}
        self.raw = {'images': 0, 'fonts': 0, 'media': 0, 'other': 0}
        self.files = {'css': [], 'js': [], 'assets': {}}   # assets: rel -> raw size
        self.pm_assets = {}                 # key as written in PM.asset(...) -> abs path
        self.digest = hashlib.sha256()
        self.uses_3d = False
        self.deferred = []
        self.bare = []                      # path literals found outside PM.asset(), mapped anyway
        self.inline_scripts = self.inline_styles = 0

    # ---- reporting
    def log(self, msg=''):
        if not self.quiet:
            print(msg, flush=True)

    def warn(self, msg):
        self.warnings.append(msg)
        print('warning: ' + msg, file=sys.stderr, flush=True)

    def rel(self, path):
        try:
            r = os.path.relpath(path, self.base)
        except ValueError:      # another drive on Windows
            return path
        return r.replace(os.sep, '/')

    # ---- files and data URIs
    def resolve(self, url, base_dir):
        """Absolute path of a local reference, or None (network, data:, #fragment, empty)."""
        url = (url or '').strip()
        if not url or url.startswith('#') or RE_SCHEME.match(url):
            return None
        path = urllib.parse.unquote(url.split('#', 1)[0].split('?', 1)[0])
        if not path:
            return None
        if path.startswith('/'):
            full = os.path.join(self.root or self.base, path.lstrip('/'))
        else:
            full = os.path.join(base_dir, path)
        return os.path.normpath(full)

    def allowed(self, full):
        if self.root is None:
            return True
        root = os.path.realpath(self.root)
        real = os.path.realpath(full)
        return real == root or real.startswith(root + os.sep)

    def data_uri(self, full, for_srcset=False):
        key = (full, for_srcset)
        if key in self.uri_cache:
            return self.uri_cache[key]
        ext = full.rsplit('.', 1)[-1].lower() if '.' in os.path.basename(full) else ''
        mime = MIME.get(ext) or mimetypes.guess_type(full)[0] or 'application/octet-stream'
        with open(full, 'rb') as fh:
            raw = fh.read()
        if ext == 'svg' and not for_srcset:
            # percent-encoded SVG is smaller than base64; quotes, '&', '#', '<', '>' and '%' are always encoded, so the
            # URI is safe in url("…") and in HTML attributes alike
            text = re.sub(r'\s+', ' ', raw.decode('utf-8', 'replace')).strip()
            uri = 'data:%s,%s' % (mime, urllib.parse.quote(text, safe=" /:=;,.-_()!*~@+?$[]"))
        else:
            uri = 'data:%s;base64,%s' % (mime, base64.b64encode(raw).decode('ascii'))
        self.digest.update(self.rel(full).encode('utf-8', 'replace') + b'\0' + hashlib.sha256(raw).digest())
        self.uri_cache[key] = (uri, len(raw), mime)
        if len(raw) > BIG_ASSET and not for_srcset:
            self.warn('%s is %s; consider a smaller format (webp, a shorter clip)' % (self.rel(full), human(len(raw))))
        return self.uri_cache[key]

    def embed(self, url, base_dir, where, for_srcset=False):
        """data: URI for a local reference (counted in the report), or None (left unchanged)."""
        full = self.resolve(url, base_dir)
        if full is None:
            if url and re.match(r'^\s*(https?:)?//', url, re.I):
                self.warn('%s refers to the network (%s); the page needs a connection for it' % (where, url.strip()))
            return None
        if not self.allowed(full):
            self.warn('%s: %s is outside --root; left as is' % (where, url))
            return None
        if not os.path.isfile(full):
            self.warn('%s: file not found: %s (left as is)' % (where, url))
            return None
        uri, size, mime = self.data_uri(full, for_srcset)
        cat = category(mime)
        self.sizes[cat] += len(uri)
        self.raw[cat] += size
        self.files['assets'][self.rel(full)] = size
        return uri

    # ---- CSS
    def css(self, text, css_dir, label, depth=0):
        """CSS with local @imports inlined and url(…) turned into data: URIs. Comments are left as they are."""
        if depth > 12:
            self.warn('%s: @import nesting deeper than 12; stopped' % label)
            return text
        comments = [(m.start(), m.end()) for m in RE_CSS_COMMENT.finditer(text)]

        def in_comment(pos):
            return any(a <= pos < b for a, b in comments)

        hoisted = []

        def imp(m):
            if in_comment(m.start()):
                return m.group(0)
            url = m.group(2) or m.group(4)
            media = (m.group(5) or '').strip()
            full = self.resolve(url, css_dir)
            if full is None:
                self.warn('%s: @import %s needs the network; kept' % (label, url))
                hoisted.append(m.group(0))
                return ''
            if not os.path.isfile(full) or not self.allowed(full):
                self.warn('%s: @import %s not found; kept' % (label, url))
                return m.group(0)
            if re.search(r'\b(layer|supports)\s*\(', media):
                self.warn('%s: @import %s uses layer()/supports(); kept as is' % (label, url))
                return m.group(0)
            body = self.css(read_text(full), os.path.dirname(full), self.rel(full), depth + 1)
            body = re.sub(r'@charset\s+[^;]+;', '', body)
            self.files['css'].append(self.rel(full))
            return '@media %s {\n%s\n}' % (media, body) if media else body

        text = RE_CSS_IMPORT.sub(imp, text)
        comments = [(m.start(), m.end()) for m in RE_CSS_COMMENT.finditer(text)]

        def url(m):
            if in_comment(m.start()):
                return m.group(0)
            ref = m.group(2).strip()
            if ref.startswith('data:') or ref.startswith('#'):
                return m.group(0)
            uri = self.embed(ref, css_dir, label)
            return 'url("%s")' % uri if uri else m.group(0)

        text = RE_CSS_URL.sub(url, text)
        return ('\n'.join(hoisted) + '\n' + text) if hoisted else text

    # ---- JS
    def scan_js(self, src, label, line0=0):
        """Collect PM.asset('…') literals; report dynamic paths, bare local paths and fetch() of local files.
        line0: line of the script's first line in its file (inline scripts), so reports point at the right line."""
        if 'PM_THREE_SRC' in src or 'layers3d' in src:
            self.uses_3d = True
        spans = []
        for m in RE_PM_ASSET.finditer(src):
            if in_string(src, m.start()):      # a code sample shown on the page, not a call
                continue
            spans.append((m.start(), m.end()))
            key = m.group(2)
            if m.group(1) == '`' and '${' in key:
                continue
            full = self.resolve(key, self.base)
            if full is None:
                continue
            if not os.path.isfile(full) or not self.allowed(full):
                self.warn('%s:%d: PM.asset(%r): file not found' % (label, line0 + line_of(src, m.start()), key))
                continue
            self.pm_assets.setdefault(key, full)
        kit_file = os.path.basename(label).startswith('playme')
        if not kit_file:      # the kit forwards caller paths through PM.asset(src); only page code is reported
            for m in RE_PM_ASSET_DYNAMIC.finditer(src):
                if in_string(src, m.start()):
                    continue
                self.warn('%s:%d: PM.asset() with a path built at runtime; the bundle cannot see it. Write the full '
                          'path as a literal, or pass --assets DIR' % (label, line0 + line_of(src, m.start())))
        for m in RE_PATH_LITERAL.finditer(src):
            if any(a <= m.start() < b for a, b in spans):
                continue
            key = m.group(2)
            full = self.resolve(key, self.base)
            if full and os.path.isfile(full) and self.allowed(full) and key not in self.pm_assets:
                # kit APIs (layers3d images, device screens) pass such paths through PM.asset(), so map them too;
                # a raw img.src = '…' would still load the file: lint.mjs --offline-file reports that
                self.pm_assets[key] = full
                self.bare.append('%s:%d %s' % (label, line0 + line_of(src, m.start()), key))
        for m in RE_FETCH_LOCAL.finditer(src):
            self.warn('%s:%d: fetch(%r) of a local file fails when the page is opened from file://; put the data in '
                      'a script (window.DATA = …) instead' % (label, line0 + line_of(src, m.start()), m.group(2)))

    def json_data(self, tag):
        """<script type="application/json" data-src="local.json"> → the same tag with the file's JSON inside, so a page
        that fetches its data over http in development reads it inline from file:// (PM.boot does both)."""
        src = tag.get('data-src')
        full = self.resolve(src, self.base)
        if full is None or not os.path.isfile(full) or not self.allowed(full):
            self.warn('<script data-src="%s">: data file not found (tag kept)' % src)
            return None
        data = read_text(full)
        try:
            json.loads(data)
        except ValueError as exc:
            self.warn('%s: not valid JSON (%s); inlined anyway' % (self.rel(full), exc))
        rel = self.rel(full)
        self.digest.update(rel.encode() + b'\0' + data.encode('utf-8') + b'\0')
        self.files['js'].append(rel)
        self.sizes['js'] += len(data.encode('utf-8'))
        tag.remove('data-src')
        tag.set('data-pm-src', rel)
        safe = data.replace('</', '<\\/').replace('<!--', '<\\u0021--')
        return '%s\n%s\n</script>' % (tag.render(), safe.rstrip('\n'))

    def script_file(self, tag, where):
        """(new <script> text, is deferred) for a <script src=local>, or None to keep the tag."""
        src = tag.get('src')
        full = self.resolve(src, self.base)
        if full is None:
            if src and re.match(r'^\s*(https?:)?//', src, re.I):
                self.warn('%s: <script src="%s"> loads from the network; kept' % (where, src))
            return None
        if not os.path.isfile(full) or not self.allowed(full):
            self.warn('%s: script not found: %s (tag kept)' % (where, src))
            return None
        code = read_text(full)
        rel = self.rel(full)
        self.digest.update(rel.encode() + b'\0' + code.encode('utf-8') + b'\0')
        self.files['js'].append(rel)
        self.sizes['js'] += len(code.encode('utf-8'))
        self.scan_js(code, rel)
        is_module = (tag.get('type') or '').strip().lower() == 'module'
        if is_module and re.search(r"""\b(?:from\s*|import\s*\(\s*|import\s+)['"]\.{0,2}/""", code):
            self.warn('%s: module %s imports relative files; an inlined module cannot resolve them' % (where, rel))
        if os.path.basename(full).startswith('playme-3d'):
            self.uses_3d = True
        deferred = tag.has('defer') and not tag.has('async') and not is_module
        tag.remove('src', 'defer', 'async', 'integrity', 'crossorigin', 'charset', 'referrerpolicy')
        tag.set('data-pm-src', rel)
        body = '%s\n%s\n</script>' % (tag.render(), safe_inline_js(code).rstrip('\n'))
        name = os.path.basename(full).lower()
        if name in ('playme.js', 'playme.min.js'):
            body += '\x00PM_ASSETS\x00'      # window.PM_ASSETS goes right after the kit core (see build)
        return body, deferred

    # ---- attributes with media
    def srcset(self, value, where):
        parts = []
        for cand in [c.strip() for c in value.split(',') if c.strip()]:
            bits = cand.split(None, 1)
            uri = self.embed(bits[0], self.base, where, for_srcset=True)
            parts.append(' '.join([uri or bits[0]] + bits[1:]))
        return ', '.join(parts)

    def media_attrs(self, tag):
        where = '<%s>' % tag.name
        name = tag.name
        targets = []
        if name in ('img', 'source', 'video', 'audio', 'track', 'embed') or (name == 'input' and (tag.get('type') or '').lower() == 'image'):
            targets.append('src')
        if name == 'video':
            targets.append('poster')
        if name in ('image', 'feimage'):
            targets += ['href', 'xlink:href']
        for attr in targets:
            v = tag.get(attr)
            if v:
                uri = self.embed(v, self.base, '%s %s' % (where, attr))
                if uri:
                    tag.set(attr, uri)
        if name in ('img', 'source') and tag.get('srcset'):
            tag.set('srcset', self.srcset(tag.get('srcset'), where + ' srcset'))
        if name == 'use':
            v = tag.get('href') or tag.get('xlink:href')
            if v and not v.startswith('#'):
                self.warn('<use href="%s">: external SVG sprites do not work from a single file; inline the symbol' % v)
        if name == 'iframe' and tag.get('src') and self.resolve(tag.get('src'), self.base):
            self.warn('<iframe src="%s"> is not inlined; the single file will not contain it' % tag.get('src'))
        if name == 'a' and tag.get('href'):
            full = self.resolve(tag.get('href'), self.base)
            if full and os.path.isfile(full):
                self.warn('<a href="%s"> links to a local file that is not part of the bundle' % tag.get('href'))
        style = tag.get('style')
        if style and 'url(' in style:
            tag.set('style', self.css(style, self.base, where + ' style'))

    # ---- assembly
    def build(self):
        if not os.path.isfile(self.page):
            raise BuildError('input not found: %s' % self.page)
        if self.out == self.page:
            raise BuildError('the output would overwrite the input; choose another -o')
        text = read_text(self.page)
        self.digest.update(b'page\0' + text.encode('utf-8'))
        tokens = tokenize(text)
        out = []
        first_script = None
        body_end = None
        for tok in tokens:
            kind = tok[0]
            if kind == 'raw':
                tag, content, end = tok[1], tok[2], tok[3]
                if tag.name == 'script':
                    if first_script is None:
                        first_script = len(out)
                    if (tag.get('type') or '').strip().lower() == 'application/json' and tag.get('data-src') \
                            and not content.strip():
                        body = self.json_data(tag)       # e.g. <script type="application/json" id="pm-facts" data-src="facts.json">
                        if body:
                            out.append(body)
                            continue
                    if tag.get('src') is not None:
                        res = self.script_file(tag, '<script>')
                        if res:
                            body, deferred = res
                            (self.deferred if deferred else out).append(body)
                            continue
                    elif content.strip():
                        self.scan_js(content, os.path.basename(self.page), line_of(text, text.find(content)) - 1)
                        self.sizes['js'] += len(content.encode('utf-8'))
                        self.inline_scripts += 1
                    out.append(tag.render() + content + end)
                elif tag.name == 'style':
                    before = self.embedded()
                    css = self.css(content, self.base, 'inline <style>')
                    self.inline_styles += 1
                    self.sizes['css'] += max(0, len(css.encode('utf-8')) - (self.embedded() - before))
                    out.append(tag.render() + safe_inline_css(css) + end)
                else:
                    out.append(tag.render() + content + end)
                continue
            if kind == 'tag':
                tag = tok[1]
                if tag.name == 'link':
                    res = self.link(tag)
                    if res is not None:
                        out.append(res)
                        continue
                else:
                    self.media_attrs(tag)
                if tag.name == 'base':
                    self.warn('<base href> changes how relative paths resolve; check the output by opening it')
                out.append(tag.render())
                continue
            if kind == 'end':
                if tok[1] == 'body':
                    body_end = len(out)
                out.append(tok[2])
                continue
            out.append(tok[1])

        # deferred scripts run after parsing: put them just before </body>, in their original order
        if self.deferred:
            at = body_end if body_end is not None else len(out)
            out[at:at] = ['\n'.join(self.deferred) + '\n']
            if first_script is not None and first_script > at:
                first_script = at

        # extra files for window.PM_ASSETS (--assets DIR)
        for d in self.assets_dirs:
            self.add_assets_dir(d)

        # window.PM_THREE_SRC first (offline 3D)
        three_src = None
        if self.offline and (self.uses_3d or self.force_three):
            three_src = self.load_three()
            tag = '<script data-pm-src="three.js r160">\nwindow.PM_THREE_SRC = %s;\n</script>\n' % js_string(three_src)
            self.sizes['three'] = len(tag)
            at = first_script if first_script is not None else self.head_end(out)
            out.insert(at, tag)
        elif self.offline:
            self.log('three.js: not inlined (the page loads no playme-3d.js and never reads PM_THREE_SRC; '
                     '--force-three overrides)')
        elif self.uses_3d:
            self.log('note: the page uses 3D; three.js will come from the network at runtime. '
                     'Pass --offline to inline it (+%s).' % human(os.path.getsize(self.three_file()) if self.three_file() else 0))

        assets = self.assets_script()
        if assets and not any('\x00PM_ASSETS\x00' in x for x in out):
            self.warn('no playme.js script found; window.PM_ASSETS goes before the first script instead')
            at = first_script if first_script is not None else self.head_end(out)
            if three_src is not None and first_script is not None:
                at += 1                       # PM_THREE_SRC stays the very first script
            out.insert(at, assets + '\n')
        page = ''.join(out)
        page = page.replace('\x00PM_ASSETS\x00', ('\n' + assets) if assets else '', 1).replace('\x00PM_ASSETS\x00', '')
        page = self.header(page, three_src is not None)
        self.check_leftovers(page)
        return page

    def embedded(self):
        return sum(self.sizes[k] for k in ('images', 'fonts', 'media', 'other'))

    @staticmethod
    def head_end(out):
        """Index in out of </head>, else just after the doctype, else 0 (never before the doctype)."""
        for i, s in enumerate(out):
            if s.lower().startswith('</head'):
                return i
        for i, s in enumerate(out):
            if s.lower().startswith('<!doctype'):
                return i + 1
        return 0

    def link(self, tag):
        """New text for a <link>, '' to drop it, or None to keep it as is."""
        rel = (tag.get('rel') or '').lower().split()
        href = tag.get('href')
        if 'stylesheet' in rel:
            full = self.resolve(href, self.base)
            if full is None:
                if href and re.match(r'^\s*(https?:)?//', href, re.I):
                    self.warn('<link rel=stylesheet href="%s"> loads from the network; kept' % href)
                return None
            if not os.path.isfile(full) or not self.allowed(full):
                self.warn('stylesheet not found: %s (tag kept)' % href)
                return None
            label = self.rel(full)
            css_src = read_text(full)
            self.digest.update(label.encode() + b'\0' + css_src.encode('utf-8') + b'\0')
            before = self.embedded()
            css = self.css(css_src, os.path.dirname(full), label)
            self.files['css'].append(label)
            # css bytes = the stylesheet without the data: URIs it now carries (those count as images / fonts)
            self.sizes['css'] += max(0, len(css.encode('utf-8')) - (self.embedded() - before))
            media = tag.get('media')
            attrs = ' data-pm-src="%s"' % esc_attr(label)
            if media and media.strip().lower() != 'all':
                attrs += ' media="%s"' % esc_attr(media)
            return '<style%s>\n%s\n</style>' % (attrs, safe_inline_css(css).rstrip('\n'))
        if set(rel) & {'preload', 'modulepreload', 'prefetch'}:
            if self.resolve(href, self.base):
                return ''          # the file is inlined anyway; a preload of it would only fail offline
            return None
        if set(rel) & {'icon', 'apple-touch-icon', 'mask-icon'} or 'shortcut' in rel:
            uri = self.embed(href, self.base, '<link rel=icon>')
            if uri:
                tag.set('href', uri)
                return tag.render()
            return None
        if href and self.resolve(href, self.base):
            self.warn('<link rel="%s" href="%s"> refers to a local file that is not inlined' % (' '.join(rel), href))
        return None

    def add_assets_dir(self, d):
        cand = [d] if os.path.isabs(d) else [os.path.join(os.getcwd(), d), os.path.join(self.base, d)]
        directory = next((c for c in cand if os.path.isdir(c)), None)
        if not directory:
            self.warn('--assets %s: not a directory' % d)
            return
        for base, dirs, names in os.walk(directory):
            dirs[:] = sorted(x for x in dirs if not x.startswith(('.', '_')))
            for name in sorted(names):
                if name.startswith('.') or name.rsplit('.', 1)[-1].lower() not in ASSET_EXT:
                    continue
                full = os.path.join(base, name)
                self.pm_assets.setdefault(self.rel(full), full)

    def assets_script(self):
        if not self.pm_assets:
            return ''
        names, values, keys = {}, [], []
        for key in sorted(self.pm_assets):
            full = self.pm_assets[key]
            if full not in names:
                uri, size, mime = self.data_uri(full)
                names[full] = 'a%d' % len(values)
                values.append('  var %s = %s;' % (names[full], js_string(uri)))
                cat = category(mime)
                self.sizes[cat] += len(uri)
                self.raw[cat] += size
                self.files['assets'][self.rel(full)] = size
            keys.append('    %s: %s' % (json.dumps(key, ensure_ascii=True), names[full]))
        body = '\n'.join(['window.PM_ASSETS = Object.assign(window.PM_ASSETS || {}, (function () {'] + values
                         + ['  return {', ',\n'.join(keys), '  };', '})());'])
        return '<script data-pm-src="PM_ASSETS">\n%s\n</script>' % body

    def three_file(self):
        cands = [self.three_path] if self.three_path else []
        cands += [os.path.join(os.path.dirname(os.path.join(self.base, p)), 'vendor', THREE_FILE)
                  for p in self.files['js'] if os.path.basename(p).startswith('playme')]
        cands.append(SKILL_THREE)
        return next((c for c in cands if c and os.path.isfile(c)), None)

    def load_three(self):
        path = self.three_file()
        if not path:
            raise BuildError('--offline needs the three.js module (%s); not found next to the kit or at %s. '
                             'Pass --three PATH.' % (THREE_FILE, SKILL_THREE))
        src = read_text(path)
        if not re.search(r'REVISION|const \w="1\d\d"', src[:5000] + src[-5000:]) and 'WebGLRenderer' not in src:
            self.warn('%s does not look like the three.js module' % path)
        self.digest.update(b'three\0' + hashlib.sha256(src.encode('utf-8')).digest())
        return src

    def header(self, page, three):
        note = ('<!-- PLAYME.html · built by PLAYME bundle.py from %s · %d stylesheets · %d scripts · %d assets%s · '
                'source sha256 %s -->\n' % (os.path.basename(self.page), len(self.files['css']), len(self.files['js']),
                                            len(self.files['assets']), ' · three.js r160 inlined' if three else '',
                                            self.digest.hexdigest()[:16]))
        m = re.match(r'\s*<!doctype[^>]*>[ \t]*\r?\n?', page, re.I)
        if m:
            return page[:m.end()] + ('' if page[m.end() - 1:m.end()] == '\n' else '\n') + note + page[m.end():]
        return note + page

    def check_leftovers(self, page):
        """Warn about local references still in the output (they break when the file travels alone)."""
        left = set()
        for tok in tokenize(page):
            if tok[0] in ('tag', 'raw'):
                tag = tok[1]
                for attr in ('src', 'href', 'poster', 'srcset', 'data'):
                    v = tag.get(attr)
                    if not v or v.startswith(('data:', '#', 'blob:')) or RE_SCHEME.match(v):
                        continue
                    if tag.name == 'a' or (tag.name == 'link' and attr == 'href' and
                                           'canonical' in (tag.get('rel') or '').lower()):
                        continue
                    left.add('<%s %s="%s">' % (tag.name, attr, v[:80]))
            if tok[0] == 'raw' and tok[1].name == 'style':
                for m in RE_CSS_URL.finditer(RE_CSS_COMMENT.sub('', tok[2])):
                    v = m.group(2).strip()
                    if v and not v.startswith(('data:', '#')) and not RE_SCHEME.match(v):
                        left.add('url(%s)' % v[:80])
        for item in sorted(left):
            self.warn('the output still refers to a local file: %s' % item)
        self.leftovers = len(left)

    def report(self, page, changed):
        data = page.encode('utf-8')
        total = len(data)
        gz = len(gzip.compress(data, compresslevel=9, mtime=0))
        cats = dict(self.sizes)
        cats['markup'] = max(0, total - sum(cats.values()))
        self.log('')
        self.log('PLAYME bundle  %s → %s  (%s)' % (os.path.relpath(self.page), os.path.relpath(self.out),
                                                 'written' if changed else 'unchanged'))
        self.log('  total     %10s   gzip %s' % (human(total), human(gz)))
        def files(n, inline):
            return '%d file%s%s' % (n, '' if n == 1 else 's', ' + %d inline' % inline if inline else '')

        rows = [('markup', cats['markup'], ''),
                ('css', cats['css'], files(len(self.files['css']), self.inline_styles)),
                ('js', cats['js'], files(len(self.files['js']), self.inline_scripts)),
                ('images', cats['images'], self.raw_note('images')),
                ('fonts', cats['fonts'], self.raw_note('fonts')),
                ('media', cats['media'], self.raw_note('media')),
                ('other', cats['other'], self.raw_note('other')),
                ('three.js', cats['three'], 'r160 module (--offline)' if cats['three'] else '')]
        rows = [r for r in rows if r[1] or r[0] in ('markup', 'css', 'js')]
        for i, (name, size, note) in enumerate(rows):
            self.log('  %s %-9s %10s   %s' % ('└' if i == len(rows) - 1 else '├', name, human(size), note))
        big = sorted(((s, r) for r, s in self.files['assets'].items()), reverse=True)[:5]
        if big:
            self.log('  largest assets: ' + ', '.join('%s %s' % (r, human(s)) for s, r in big))
        if self.pm_assets:
            self.log('  window.PM_ASSETS: %d path%s' % (len(self.pm_assets), '' if len(self.pm_assets) == 1 else 's'))
        if self.bare:
            one = len(self.bare) == 1
            self.log('  note: %d path%s written without PM.asset() %s mapped too; %s resolve%s only where the code '
                     'goes through PM.asset() (kit APIs do). Check with: lint.mjs --offline-file %s'
                     % (len(self.bare), '' if one else 's', 'was' if one else 'were', 'it' if one else 'they',
                        's' if one else '', os.path.basename(self.out)))
            for b in self.bare[:5]:
                self.log('        ' + b)
        self.log('  local references left: %d · warnings: %d' % (self.leftovers, len(self.warnings)))

    def raw_note(self, cat):
        n = sum(1 for r in self.files['assets'] if category(MIME.get(r.rsplit('.', 1)[-1].lower(), '')
                                                            or mimetypes.guess_type(r)[0] or '') == cat)
        return '%d file%s, %s raw' % (n, '' if n == 1 else 's', human(self.raw[cat])) if n else ''



def main(argv=None):
    ap = argparse.ArgumentParser(description='Bundle a PLAYME page and its local files into one HTML file.')
    ap.add_argument('page', help='the page to bundle (e.g. index.html)')
    ap.add_argument('-o', '--out', help='output file (default: PLAYME.html next to the page)')
    ap.add_argument('--offline', action='store_true', help='inline three.js too, so 3D works with no network')
    ap.add_argument('--assets', action='append', default=[], metavar='DIR',
                    help='also put every media file under DIR into window.PM_ASSETS (repeatable)')
    ap.add_argument('--three', metavar='PATH', help='three.js ES module to inline (default: kit/vendor/%s)' % THREE_FILE)
    ap.add_argument('--force-three', action='store_true', help='with --offline, inline three.js even if no 3D is detected')
    ap.add_argument('--root', metavar='DIR', help='site root for "/…" paths; files outside it are refused')
    ap.add_argument('--strict', action='store_true', help='exit 1 when there are warnings')
    ap.add_argument('--quiet', action='store_true', help='print only warnings and errors')
    args = ap.parse_args(argv)
    out = args.out or os.path.join(os.path.dirname(os.path.abspath(args.page)), 'PLAYME.html')
    b = Bundler(args.page, out, offline=args.offline, assets_dirs=args.assets, three=args.three,
                force_three=args.force_three, root=args.root, quiet=args.quiet)
    try:
        page = b.build()
        changed = write_atomic(out, page)
    except BuildError as exc:
        print('error: %s' % exc, file=sys.stderr)
        return 2
    b.report(page, changed)
    return 1 if args.strict and b.warnings else 0


if __name__ == '__main__':
    sys.exit(main())
