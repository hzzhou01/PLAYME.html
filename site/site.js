/* PLAYME homepage shell: static bilingual text, language toggle, chapter scrubber, copy buttons, the skill's file
   tree, and mounting of the lab parts into their slots. Parts register with PMSite.register(id, mount). */
(function () {
  'use strict';

  // The GitHub repository; links marked data-repo-path are built from it.
  var REPO = 'hzzhou01/PLAYME.html';

  var mounts = {};
  var S = window.PMSite = {
    repo: REPO,
    register: function (id, mount) { mounts[id] = mount; },
    lang: function () { return (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'; },
  };

  // ── Static bilingual text (data-s-en / data-s-zh; data-s-html marks trusted inline HTML) ──
  function applyStatic(root) {
    var zh = S.lang() === 'zh';
    (root || document).querySelectorAll('[data-s-en]').forEach(function (el) {
      var v = el.getAttribute(zh ? 'data-s-zh' : 'data-s-en');
      if (v == null) v = el.getAttribute('data-s-en');
      if (el.hasAttribute('data-s-html')) el.innerHTML = v; else el.textContent = v;
    });
    (root || document).querySelectorAll('[data-s-aria-en]').forEach(function (el) {
      el.setAttribute('aria-label', el.getAttribute(zh ? 'data-s-aria-zh' : 'data-s-aria-en'));
    });
    document.title = 'PLAYME';
  }

  /** Switch language without moving what the reader is looking at: text lengths change in both directions, so
   * remember the element at the top of the window and put it back at the same height afterwards. */
  function setLang(l) {
    var anchor = null, top = 0, probe = 70;
    var cands = document.querySelectorAll('.pm-part, .section-title, .pm-stage, .hero, .why, .figures, .install');
    for (var i = 0; i < cands.length; i++) {
      var r = cands[i].getBoundingClientRect();
      if (r.bottom > probe) { anchor = cands[i]; top = r.top; break; }
    }
    if (window.PM && PM.setLang) PM.setLang(l);
    else document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
    try { localStorage.setItem('pm-lang', l); } catch (e) {}
    if (anchor) requestAnimationFrame(function () { requestAnimationFrame(function () {
      var d = anchor.getBoundingClientRect().top - top;
      if (Math.abs(d) > 1) window.scrollBy(0, d);
    }); });
  }

  // ── Chapter scrubber: equally spaced ticks, playhead interpolated through the current chapter ──
  function chapters() {
    var nav = document.querySelector('.chapters');
    if (!nav) return;
    var secs = [].slice.call(document.querySelectorAll('[data-chapter]'));
    var fill = nav.querySelector('.chapters-fill'), head = nav.querySelector('.chapters-head');
    var ticks = secs.map(function (sec, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chapter';
      b.style.left = (secs.length === 1 ? 0 : (i / (secs.length - 1)) * 100) + '%';
      var s = document.createElement('span');
      s.setAttribute('data-s-en', sec.getAttribute('data-chapter-en'));
      s.setAttribute('data-s-zh', sec.getAttribute('data-chapter-zh'));
      s.textContent = sec.getAttribute('data-chapter-en');
      b.appendChild(s);
      b.addEventListener('click', function () {
        var y = sec.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: Math.max(0, y), behavior: (window.PM && PM.reduced && PM.reduced()) ? 'auto' : 'smooth' });
      });
      nav.appendChild(b);
      return b;
    });
    // Keep the first and last labels inside the track.
    if (ticks.length) { ticks[0].style.transform = 'translateX(-6px)'; ticks[ticks.length - 1].style.transform = 'translateX(calc(-100% + 6px))'; }
    var raf = 0;
    function update() {
      raf = 0;
      var probe = window.innerHeight * 0.38, idx = 0, frac = 0;
      for (var i = 0; i < secs.length; i++) {
        var r = secs[i].getBoundingClientRect();
        if (r.top <= probe) { idx = i; frac = Math.min(1, Math.max(0, (probe - r.top) / Math.max(1, r.height))); }
      }
      var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atEnd) { idx = secs.length - 1; frac = 0; }
      var pos = secs.length === 1 ? 0 : Math.min(1, (idx + (idx < secs.length - 1 ? frac : 0)) / (secs.length - 1));
      fill.style.width = (pos * 100) + '%';
      head.style.left = (pos * 100) + '%';
      var now = document.querySelector('.chapter-now');
      if (now && ticks[idx]) now.textContent = ticks[idx].textContent;
      ticks.forEach(function (t, i) {
        t.classList.toggle('is-current', i === idx);
        t.classList.toggle('is-past', i < idx);
        if (i === idx) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', function () { if (!raf) raf = requestAnimationFrame(update); });
    update();
  }

  // ── Copy buttons; for shell blocks, copy only the commands ──
  function copyButtons() {
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = document.querySelector(btn.getAttribute('data-copy'));
        if (!src) return;
        var text = src.textContent;
        if (btn.hasAttribute('data-copy-lines')) {
          text = text.split('\n').filter(function (l) { return l.trim() && l.trim().charAt(0) !== '#'; })
            .map(function (l) { return l.replace(/^\s*[>$]\s/, ''); }).join('\n');
        }
        var done = function () {
          btn.classList.add('is-done');
          btn.textContent = S.lang() === 'zh' ? '已复制' : 'Copied';
          setTimeout(function () {
            btn.classList.remove('is-done');
            btn.textContent = btn.getAttribute(S.lang() === 'zh' ? 'data-s-zh' : 'data-s-en') || 'Copy';
          }, 1400);
        };
        try {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
        } catch (e) { fallback(text); done(); }
      });
    });
    function fallback(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  }

  // ── The skill's file tree (data/tree.js) ──
  function tree() {
    var host = document.querySelector('#tree .tree-files'), view = document.getElementById('tree-view');
    var files = (window.PMSiteTree || []);
    if (!host || !files.length) return;
    var current = null;
    function show(f, btn) {
      current = f;
      host.querySelectorAll('.tree-file').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      view.textContent = f.head;
    }
    files.forEach(function (f, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tree-file';
      b.setAttribute('aria-pressed', 'false');
      var depth = f.path.split('/').length - 1;
      var name = f.path.split('/').pop();
      var n = document.createElement('span'); n.className = 'n';
      n.innerHTML = '<i>' + '&nbsp;&nbsp;'.repeat(depth) + (f.dir ? '▾ ' : '') + '</i>';
      n.appendChild(document.createTextNode(name + (f.dir ? '/' : '')));
      var d = document.createElement('span'); d.className = 'd';
      d.setAttribute('data-s-en', f.desc.en); d.setAttribute('data-s-zh', f.desc.zh); d.textContent = f.desc.en;
      b.appendChild(n); b.appendChild(d);
      if (f.dir) { b.disabled = true; b.style.cursor = 'default'; }
      else b.addEventListener('click', function () { show(f, b); });
      host.appendChild(b);
      if (!current && !f.dir && f.path.endsWith('SKILL.md')) show(f, b);
    });
  }

  function repoLinks() {
    document.querySelectorAll('[data-repo-path]').forEach(function (a) {
      a.href = 'https://github.com/' + REPO + a.getAttribute('data-repo-path');
    });
    // links to the bundled examples: relative to the repository root (Pages, the root PLAYME.html), or one level up
    // when this page is served from site/ during development
    var dev = /\/site\/(index\.html)?$/.test(location.pathname);
    document.querySelectorAll('[data-local-path]').forEach(function (a) {
      a.href = (dev ? '../' : '') + a.getAttribute('data-local-path');
    });
  }

  function mountParts() {
    document.querySelectorAll('[data-pm-slot]').forEach(function (slot) {
      var id = slot.getAttribute('data-pm-slot'), m = mounts[id];
      if (!m) return;
      try { m(slot); }
      catch (e) {
        console.error('[PMSite] part "' + id + '" failed to mount', e);
        slot.textContent = 'This lab failed to load: ' + (e && e.message);
      }
    });
  }

  S.boot = function () {
    applyStatic();
    var obs = new MutationObserver(function () { applyStatic(); window.dispatchEvent(new Event('scroll')); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    var t = document.getElementById('lang-toggle');
    if (t) t.addEventListener('click', function () { setLang(S.lang() === 'zh' ? 'en' : 'zh'); });
    repoLinks();
    copyButtons();
    tree();
    chapters();
    applyStatic();
    window.dispatchEvent(new Event('scroll'));   // the chapter label now shows the page language
    mountParts();
  };
})();
