/* Fabric–GitHub Integration Playbook — site behaviour */
(function () {
  'use strict';

  /* ---------- theme ---------- */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem('pb-theme');
    if (saved) root.setAttribute('data-theme', saved);
  } catch (e) {}
  var tBtn = document.getElementById('themeToggle');
  function paintTheme() {
    var explicit = root.getAttribute('data-theme');
    var dark = explicit ? explicit === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (tBtn) {
      tBtn.textContent = dark ? '☀' : '☾';
      tBtn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    }
  }
  if (tBtn) {
    tBtn.addEventListener('click', function () {
      var explicit = root.getAttribute('data-theme');
      var dark = explicit ? explicit === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('pb-theme', next); } catch (e) {}
      paintTheme();
    });
  }
  paintTheme();

  /* ---------- mobile nav ---------- */
  var nBtn = document.getElementById('navToggle');
  if (nBtn) {
    nBtn.addEventListener('click', function () {
      document.body.classList.toggle('navopen');
    });
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('navopen')) return;
      var sb = document.querySelector('.sidebar');
      if (sb && !sb.contains(e.target) && e.target !== nBtn && !nBtn.contains(e.target)) {
        document.body.classList.remove('navopen');
      }
    });
  }

  /* ---------- copy buttons ---------- */
  document.querySelectorAll('.codewrap .copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var code = b.parentElement.querySelector('code');
      var text = code ? code.innerText : '';
      var done = function () {
        b.textContent = 'Copied'; b.classList.add('done');
        setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('done'); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  /* ---------- figure lightbox ---------- */
  var lb = document.getElementById('lightbox');
  if (lb) {
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('.lbcap');
    var lbOpen = lb.querySelector('.lbopen');
    var lbSrc = '';
    function open(src, cap) {
      lbImg.src = src; lbCap.textContent = cap || '';
      lbSrc = src;
      lb.classList.add('on');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lb.classList.remove('on'); lbImg.src = '';
      document.body.style.overflow = '';
    }
    document.querySelectorAll('.diagram .zoom').forEach(function (z) {
      z.addEventListener('click', function () {
        open(z.getAttribute('data-src'), z.getAttribute('data-cap'));
      });
    });
    if (lbOpen) {
      lbOpen.addEventListener('click', function () {
        if (lbSrc) window.open(lbSrc, '_blank', 'noopener');
      });
    }
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lbclose')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('on')) close();
    });
  }

  /* ---------- right-rail active heading ---------- */
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail a'));
  if (railLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    railLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var seen = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id;
        if (en.isIntersecting) { if (seen.indexOf(id) < 0) seen.push(id); }
        else { seen = seen.filter(function (x) { return x !== id; }); }
      });
      railLinks.forEach(function (a) { a.classList.remove('here'); });
      if (seen.length) {
        var first = railLinks.filter(function (a) {
          return seen.indexOf(a.getAttribute('href').slice(1)) >= 0;
        })[0];
        if (first) first.classList.add('here');
      }
    }, { rootMargin: '-72px 0px -70% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- search ---------- */
  var input = document.getElementById('q');
  var panel = document.getElementById('results');
  if (!input || !panel) return;
  var idx = null, loading = false, sel = -1, rows = [];

  function load() {
    if (idx || loading) return Promise.resolve(idx);
    loading = true;
    return fetch('assets/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (j) { idx = j; loading = false; return j; })
      .catch(function () { loading = false; idx = []; return idx; });
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function snippet(body, terms) {
    var low = body.toLowerCase(), at = -1;
    for (var i = 0; i < terms.length; i++) {
      var p = low.indexOf(terms[i]);
      if (p >= 0 && (at < 0 || p < at)) at = p;
    }
    if (at < 0) at = 0;
    var start = Math.max(0, at - 60);
    var frag = body.slice(start, start + 190);
    if (start > 0) frag = '…' + frag;
    if (start + 190 < body.length) frag += '…';
    var out = esc(frag);
    terms.forEach(function (t) {
      if (!t) return;
      out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
        '<mark>$1</mark>');
    });
    return out;
  }

  function render(items, terms) {
    rows = items;
    if (!items.length) {
      panel.innerHTML = '<div class="empty">No matches.</div>';
      panel.classList.add('on'); return;
    }
    panel.innerHTML = items.map(function (it, i) {
      return '<a href="' + it.url + '" data-i="' + i + '">' +
        '<span class="rk">' + esc(it.label) + '</span>' +
        '<span>' + esc(it.title) + '</span>' +
        '<span class="rs">' + snippet(it.body, terms) + '</span></a>';
    }).join('');
    panel.classList.add('on');
    sel = -1;
  }

  function run() {
    var qv = input.value.trim();
    if (qv.length < 2) { panel.classList.remove('on'); return; }
    load().then(function (data) {
      var terms = qv.toLowerCase().split(/\s+/).filter(Boolean);
      var hits = [];
      data.forEach(function (d) {
        var hay = (d.title + ' ' + d.label + ' ' + d.body).toLowerCase();
        var score = 0, all = true;
        terms.forEach(function (t) {
          if (hay.indexOf(t) < 0) { all = false; return; }
          if (d.title.toLowerCase().indexOf(t) >= 0) score += 12;
          if (d.label.toLowerCase().indexOf(t) >= 0) score += 6;
          var m = hay.split(t).length - 1;
          score += Math.min(m, 8);
        });
        if (all) hits.push({ s: score, d: d });
      });
      hits.sort(function (a, b) { return b.s - a.s; });
      render(hits.slice(0, 24).map(function (h) { return h.d; }), terms);
    });
  }

  var t;
  input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 110); });
  input.addEventListener('focus', function () { if (input.value.trim().length >= 2) run(); });
  input.addEventListener('keydown', function (e) {
    var as = panel.querySelectorAll('a');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!as.length) return;
      e.preventDefault();
      sel += (e.key === 'ArrowDown' ? 1 : -1);
      if (sel < 0) sel = as.length - 1;
      if (sel >= as.length) sel = 0;
      as.forEach(function (a) { a.classList.remove('sel'); });
      as[sel].classList.add('sel');
      as[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (sel >= 0 && as[sel]) { e.preventDefault(); window.location = as[sel].href; }
    } else if (e.key === 'Escape') {
      panel.classList.remove('on'); input.blur();
    }
  });
  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== input) panel.classList.remove('on');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input &&
        !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); input.focus(); input.select();
    }
  });
})();
