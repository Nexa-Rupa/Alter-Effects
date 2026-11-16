/* Alter Effects runtime — turns a SceneDoc (window.__DOC) into a frame-seekable GSAP timeline.
   Deterministic: the same doc + seed renders the same frames. Loaded by page.html. */
(function () {
  'use strict';
  const DOC = window.__DOC;
  const FRAMES = window.__FRAMES || {};
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  const OVERLAY = !!DOC.base;
  const W = DOC.canvas.w, H = DOC.canvas.h, FPS = DOC.canvas.fps, DUR = DOC.duration;
  const U = Math.min(W, H) / 1080, PORTRAIT = H > W;
  const MOTION = DOC.theme.motion || 1;
  const stage = document.getElementById('stage');
  const root = document.documentElement.style;

  /* ---------- theme ---------- */
  const C = DOC.theme.colors;
  root.setProperty('--primary', C.primary); root.setProperty('--accent', C.accent);
  root.setProperty('--ink', C.ink); root.setProperty('--paper', C.paper); root.setProperty('--muted', C.muted); root.setProperty('--sub', 'color-mix(in srgb, var(--ink) 62%, var(--paper))');
  root.setProperty('--display', `'${DOC.theme.fonts.display}', 'Plus Jakarta Sans', sans-serif`);
  root.setProperty('--body', `'${DOC.theme.fonts.body}', 'Plus Jakarta Sans', sans-serif`);
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  stage.style.background = OVERLAY ? 'transparent' : C.paper;
  if (!RENDER) {
    const fit = () => { const k = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `translate(${(innerWidth - W * k) / 2}px,${(innerHeight - H * k) / 2}px) scale(${k})`; };
    addEventListener('resize', fit); fit();
  }
  const tok = c => c == null ? 'var(--ink)' : c === 'ghost' ? 'color-mix(in srgb, var(--ink) 8%, var(--paper))' : c === 'sub' ? 'var(--sub)' : c === 'white' ? '#ffffff' : c === 'black' ? '#000000' : c.startsWith('#') || c.startsWith('rgb') ? c : `var(--${c})`;
  const hexOf = c => c === 'ghost' ? C.paper : c === 'sub' ? C.ink : c === 'white' ? '#ffffff' : c === 'black' ? '#000000' : c && c.startsWith('#') ? c : (C[c] || '#000000');

  /* ---------- deterministic rng ---------- */
  let seedState = (DOC.seed >>> 0) || 1;
  const rnd = () => { seedState ^= seedState << 13; seedState ^= seedState >>> 17; seedState ^= seedState << 5; return ((seedState >>> 0) % 100000) / 100000; };

  /* ---------- dom helpers ---------- */
  function el(tag, css, parent, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) e.style.cssText = css;
    (parent || stage).appendChild(e);
    return e;
  }
  const px = v => (v * U) + 'px';
  function svg(parent, z) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.setAttribute('class', 'ov');
    if (z != null) s.style.zIndex = z;
    parent.appendChild(s); return s;
  }
  function pathEl(s, d, o = {}) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d); p.setAttribute('class', 'jl');
    if (o.color) p.style.stroke = tok(o.color);
    if (o.width) p.style.strokeWidth = o.width * U;
    s.appendChild(p); return p;
  }

  /* ---------- text ---------- */
  // o: { key, text, x, y (fractions), size (U units), weight, color, font, anchor, ls, lh, maxW (fraction), bleed, bg, split }
  function text(parent, sceneId, o) {
    const id = `${sceneId}.${o.key || 't' + Math.round(rnd() * 1e6)}`;
    const fix = (DOC.fixes && DOC.fixes[id]) || {};
    const size = (o.size || 60) * (fix.scale || 1);
    const anchor = o.anchor || 'left';
    const r = el('div', '', parent, 'tx');
    r.dataset.gate = o.bleed ? 'bleed' : 'text';
    r.dataset.id = id;
    if (o.bg) r.dataset.bg = hexOf(o.bg);
    if (o.onMedia) r.dataset.onmedia = '1';
    r.dataset.fg = hexOf(o.color || 'ink');
    const fam = o.font === 'mono' ? "'JetBrains Mono', monospace" : o.font === 'body' ? 'var(--body)' : 'var(--display)';
    r.style.cssText = `left:${(o.x ?? 0.5) * W}px;top:${(o.y ?? 0.5) * H + (fix.dy || 0) * H}px;font-family:${fam};font-size:${size * U}px;font-weight:${o.weight || 800};color:${tok(o.color)};letter-spacing:${o.ls ?? (size > 150 ? -0.035 : -0.015)}em;line-height:${o.lh ?? (size > 150 ? 0.86 : 1.08)};text-align:${anchor}`;
    if (o.maxW) { r.style.whiteSpace = 'normal'; r.style.width = (o.maxW * W) + 'px'; }
    if (anchor === 'center') r.style.transform = 'translateX(-50%)';
    if (anchor === 'right') r.style.transform = 'translateX(-100%)';
    if (o.shadow) r.style.textShadow = '0 2px 24px rgba(0,0,0,.35)';
    const ins = [];
    const lines = String(o.text ?? '').split('\n');
    lines.forEach((ln, li) => {
      const line = el('div', '', r);
      const words = o.split === 'none' ? [ln] : ln.split(' ');
      words.forEach((w, wi) => {
        const mk = el('span', '', line, 'mk'); const inn = el('span', '', mk, 'in'); inn.textContent = w;
        ins.push(inn);
        if (wi < words.length - 1) line.appendChild(document.createTextNode(' '));
      });
    });
    return { el: r, ins, id };
  }

  /* ---------- motion vocabulary ---------- */
  function reveal(tl, t, T, style = 'rise', d = 0.6, st = 0.06) {
    d = d / Math.max(0.7, MOTION); st = st / MOTION;
    const ins = T.ins || [];
    const e = T.el || T;
    if (style === 'rise') tl.fromTo(ins, { yPercent: 115 }, { yPercent: 0, duration: d, ease: 'expo.out', stagger: st, immediateRender: false }, t);
    else if (style === 'drop') tl.fromTo(ins, { yPercent: -115 }, { yPercent: 0, duration: d, ease: 'expo.out', stagger: st, immediateRender: false }, t);
    else if (style === 'left') tl.fromTo(e, { x: -W * 0.6, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: d, ease: 'expo.out', immediateRender: false }, t);
    else if (style === 'right') tl.fromTo(e, { x: W * 0.6, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: d, ease: 'expo.out', immediateRender: false }, t);
    else if (style === 'scale') tl.fromTo(e, { scale: 0.18, autoAlpha: 0, letterSpacing: '0.4em' }, { scale: 1, autoAlpha: 1, letterSpacing: e.style.letterSpacing, duration: d * 1.2, ease: 'expo.out', immediateRender: false }, t);
    else if (style === 'slam') tl.fromTo(e, { scale: 1.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: d * 0.8, ease: 'expo.out', immediateRender: false }, t);
    else if (style === 'track') { tl.fromTo(ins, { yPercent: 115 }, { yPercent: 0, duration: d, ease: 'expo.out', stagger: st, immediateRender: false }, t); tl.fromTo(e, { letterSpacing: '0.3em' }, { letterSpacing: e.style.letterSpacing, duration: d * 1.4, ease: 'expo.out', immediateRender: false }, t); }
    else if (style === 'fade') tl.fromTo(e, { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'power2.out', immediateRender: false }, t);
    if (style !== 'rise' && style !== 'drop' && style !== 'track') tl.set(ins, { yPercent: 0 }, t);
  }
  function hide(tl, t, T, style = 'up', d = 0.3) {
    const ins = T.ins || [];
    const e = T.el || T;
    if (style === 'up') tl.to(ins, { yPercent: -115, duration: d, ease: 'power3.in', stagger: 0.03 }, t);
    else if (style === 'down') tl.to(ins, { yPercent: 115, duration: d, ease: 'power3.in', stagger: 0.03 }, t);
    else if (style === 'left') tl.to(e, { x: -W, duration: d, ease: 'power3.in' }, t);
    else if (style === 'fade') tl.to(e, { autoAlpha: 0, duration: d }, t);
    else if (style === 'grey') tl.to(e, { color: tok('muted'), duration: d }, t);
  }
  const hidden = T => gsap.set(T.ins, { yPercent: 115 });

  /* ---------- footage sequencer ---------- */
  const SCH = new Map();
  function mediaImg(parent, css) {
    const im = el('img', css || 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover', parent);
    im.alt = ''; return im;
  }
  function play(img, m, t0, t1, o = {}) {
    if (!m) return;
    if (!SCH.has(img)) SCH.set(img, []);
    SCH.get(img).push({ t0, t1, m, speed: o.speed ?? m.speed ?? 1, off: o.off || 0, pos: o.pos || m.pos || '50% 50%' });
    if (m.faces && m.faces.length) img.dataset.faces = JSON.stringify(m.faces);
  }
  /* ---------- live preview (window.__LIVE): media straight from source files, no extracted frames ----------
     The headless renderer never sets __LIVE, so rendered frames keep using the pre-extracted sequences. */
  const LIVE = window.__LIVE || null;
  const LV = new Map(); // media key → { v: <video>, c: <canvas>, urls: [], busy, want }
  let livePlaying = false;
  const liveUrl = key => (LIVE && LIVE.media && LIVE.media[key]) || '';
  function lvFor(m) {
    let s = LV.get(m.key);
    if (!s) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = liveUrl(m.key);
      s = { v, c: document.createElement('canvas'), urls: [], busy: null, want: 0 };
      LV.set(m.key, s);
    }
    return s;
  }
  const once = (el, ev, ms) => new Promise(r => { const done = () => { el.removeEventListener(ev, done); clearTimeout(to); r(); }; const to = setTimeout(done, ms); el.addEventListener(ev, done); });
  async function lvSeek(v, at) {
    if (v.readyState < 1) await once(v, 'loadedmetadata', 8000);
    if (v.duration) at = Math.min(at, v.duration - 0.05);
    if (Math.abs(v.currentTime - at) > 0.5 / FPS || v.readyState < 2) { v.currentTime = Math.max(0, at); await once(v, 'seeked', 4000); }
  }
  function lvDraw(s) {
    const v = s.v; if (v.readyState < 2 || !v.videoWidth) return null;
    const k = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
    s.c.width = Math.round(v.videoWidth * k); s.c.height = Math.round(v.videoHeight * k);
    s.c.getContext('2d').drawImage(v, 0, 0, s.c.width, s.c.height);
    return new Promise(r => s.c.toBlob(b => {
      if (!b) return r(null);
      const u = URL.createObjectURL(b); s.urls.push(u);
      while (s.urls.length > 3) URL.revokeObjectURL(s.urls.shift());
      r(u);
    }, 'image/jpeg', 0.82));
  }
  /** Frame of a clip at film time t: seeks a hidden <video> when scrubbing, follows it while playing. */
  function liveFrame(e, t) {
    const s = lvFor(e.m);
    // Same picture as the renderer: frame file i = 1 + floor(x·FPS) of a sequence extracted from m.in holds the
    // source picture at m.in + (i)/FPS; a quarter frame in lands safely inside it after the seek.
    const x = e.off + (t - e.t0) * e.speed;
    const at = (e.m.in || 0) + (Math.floor(x * FPS + 1e-6) + 1.25) / FPS;
    s.used = true;
    if (livePlaying) {
      const v = s.v; v.playbackRate = Math.max(0.25, Math.min(4, e.speed || 1));
      if (v.paused) { v.currentTime = at; v.play().catch(() => {}); }
      else if (Math.abs(v.currentTime - at) > 0.35) v.currentTime = at;
      if (s.busy) return s.busy;
      const drawn = lvDraw(s); // null until the hidden video has a decoded frame
      if (!drawn) return Promise.resolve(null);
      s.busy = drawn.finally(() => { s.busy = null; });
      return s.busy;
    }
    s.want = at;
    if (s.busy) return s.busy;
    s.busy = (async () => {
      let done = -1, url = null;
      while (done !== s.want) { done = s.want; s.v.pause(); await lvSeek(s.v, done); url = await lvDraw(s); }
      s.busy = null; return url;
    })();
    return s.busy;
  }
  function srcAt(e, t) {
    if (LIVE) return e.m.kind === 'image' ? liveUrl(e.m.key) : null;
    if (e.m.kind === 'image') return `media/${e.m.key}.jpg`;
    const n = FRAMES[e.m.key] || 1;
    const i = Math.max(1, Math.min(n, 1 + Math.floor((e.off + (t - e.t0) * e.speed) * FPS + 1e-6)));
    return `media/${e.m.key}/${String(i).padStart(4, '0')}.jpg`;
  }
  function renderClips(t) {
    const ps = [];
    SCH.forEach((list, img) => {
      let e = null; for (const s of list) if (t >= s.t0 && t < s.t1) e = s;
      if (!e) return;
      if (LIVE && e.m.kind !== 'image') {
        ps.push(liveFrame(e, t).then(u => { if (u && img._src !== u) { img._src = u; img.src = u; img.style.objectPosition = e.pos; return img.decode().catch(() => {}); } }));
        return;
      }
      const src = srcAt(e, t);
      if (img._src !== src) { img._src = src; img.src = src; img.style.objectPosition = e.pos; ps.push(img.decode().catch(() => {})); }
    });
    return Promise.all(ps);
  }

  /* ---------- cues (sound design) ---------- */
  const CUES = [];

  /* ---------- lines (never drawn over media) ---------- */
  function draw(tl, p, t, d, ease = 'power2.inOut', dot) {
    const L = p.getTotalLength();
    gsap.set(p, { strokeDasharray: L, strokeDashoffset: L });
    tl.to(p, {
      strokeDashoffset: 0, duration: d, ease, onUpdate: dot ? () => {
        const off = +gsap.getProperty(p, 'strokeDashoffset'); const q = p.getPointAtLength(Math.max(0, L - off));
        dot.setAttribute('cx', q.x); dot.setAttribute('cy', q.y);
      } : undefined
    }, t);
  }
  function dotEl(s) { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 7 * U); c.setAttribute('class', 'dot'); s.appendChild(c); return c; }

  /* ===================================================================
     SCENE COMPONENTS — each gets ctx { sec, tl, dur, id, cue } and props
     =================================================================== */
  const COMP = {};

  // Oversized kinetic words on a flat background (manifesto, teaser, offer)
  COMP.words = (x, p) => {
    x.sec.style.background = tok(p.bg || 'paper');
    if (p.symbols) {
      p.symbols.forEach((s, i) => {
        const e = el('div', `position:absolute;left:${(0.08 + rnd() * 0.75) * W}px;top:${(0.1 + rnd() * 0.7) * H}px;font-family:'JetBrains Mono',monospace;font-weight:300;font-size:${(90 + rnd() * 90) * U}px;color:${tok('muted')};opacity:.35`, x.sec);
        e.textContent = s;
        const t = 0.05 + i * 0.13, d = i % 2 ? -1 : 1;
        x.tl.fromTo(e, { x: d * 160 * U, autoAlpha: 0 }, { x: 0, autoAlpha: 0.35, duration: 0.28, ease: 'expo.out', immediateRender: false }, t);
        x.tl.to(e, { x: -d * 90 * U, duration: 1.1, ease: 'none' }, t + 0.28);
        x.cue(t, 'tick', 0.4);
      });
      gsap.set(x.sec.querySelectorAll('div'), { autoAlpha: 0 });
      x.tl.set([...x.sec.children], { autoAlpha: 0 }, p.symbolsUntil ?? 1.2);
    }
    (p.items || []).forEach((it, i) => {
      const T = text(x.sec, x.id, { key: it.key || 'w' + i, ...it, bg: p.bg || 'paper' });
      if (it.enter === 'rise' || it.enter === 'track' || it.enter === 'drop' || !it.enter) hidden(T); else gsap.set(T.el, { autoAlpha: 0 });
      reveal(x.tl, it.at ?? 0.1, T, it.enter || 'rise', it.d || 0.6);
      x.cue(it.at ?? 0.1, it.size > 200 ? 'impact' : 'whoosh', it.size > 200 ? 0.6 : 0.35);
      if (it.until != null) hide(x.tl, it.until, T, it.exit || 'up');
      if (it.grey != null) hide(x.tl, it.grey, T, 'grey', 0.4);
      if (it.push) x.tl.to(T.el, { scale: it.push, duration: Math.max(0.3, (it.until ?? x.dur) - (it.at ?? 0) - 0.6), ease: 'none' }, (it.at ?? 0) + 0.6);
    });
    if (p.line) { const s = svg(x.sec, 0); const pa = pathEl(s, p.line.d); draw(x.tl, pa, p.line.at ?? 0.2, p.line.dur ?? x.dur * 0.8, 'power1.inOut'); }
  };

  // Rapid real-footage flashes, freeze on the last one, then a statement on top (hook)
  COMP.flashes = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1)');
    const dim = el('div', `position:absolute;inset:0;background:#060C1E;opacity:0`, x.sec);
    const each = p.each || 0.34, list = p.media || [];
    list.forEach((m, i) => {
      const t0 = 0.25 + i * each, last = i === list.length - 1;
      play(img, m, t0, last ? (p.freezeAt ?? t0 + each) : t0 + each, { off: 0 });
      x.tl.fromTo(img, { scale: 1.07 }, { scale: 1, duration: each, ease: 'power2.out', immediateRender: false }, t0);
      x.cue(t0, 'tick', 0.35 + (i % 3) * 0.1);
    });
    const fz = p.freezeAt ?? (0.25 + list.length * each);
    if (list.length) play(img, list[list.length - 1], fz, x.dur + 0.05, { speed: 0, off: each });
    x.tl.to(img, { scale: 1.05, filter: 'saturate(.35)', duration: x.dur - fz, ease: 'none' }, fz);
    x.tl.to(dim, { opacity: 0.66, duration: 0.18 }, fz);
    x.cue(fz, 'freeze', 0.5);
    const T1 = text(x.sec, x.id, { key: 'line', text: p.line || '', x: 0.5, y: PORTRAIT ? 0.36 : 0.38, size: PORTRAIT ? 64 : 84, weight: 800, color: 'white', anchor: 'center', maxW: PORTRAIT ? 0.86 : undefined, onMedia: true, bg: 'black' });
    const T2 = text(x.sec, x.id, { key: 'word', text: p.word || '', x: 0.5, y: PORTRAIT ? 0.47 : 0.56, size: PORTRAIT ? 170 : 250, weight: 800, color: p.wordColor || '#4A74FF', anchor: 'center', onMedia: true, bg: 'black' });
    hidden(T1); hidden(T2);
    reveal(x.tl, fz + 0.08, T1, 'rise', 0.6);
    reveal(x.tl, fz + 0.6, T2, 'track', 0.75);
    x.cue(fz + 0.6, 'soft', 0.6);
  };

  // Full-bleed footage with an optional big word (LEARN. BUILD. SOLVE.)
  COMP.media = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec);
    const shots = p.shots || [{ media: p.media, word: p.word }];
    const each = x.dur / shots.length;
    const shade = el('div', 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,12,30,0) 40%,rgba(6,12,30,.62) 100%)', x.sec);
    if (!shots.some(s => s.word)) shade.style.display = 'none';
    shots.forEach((s, i) => {
      const t0 = i * each;
      play(img, s.media, t0, t0 + each + 0.05, { speed: s.speed ?? 1 });
      x.tl.fromTo(img, { scale: i === 0 ? 1.12 : 1.06 }, { scale: 1, duration: Math.min(1.2, each), ease: 'expo.out', immediateRender: false }, t0);
      if (i) x.cue(t0, 'tick', 0.35);
      if (s.word) {
        const T = text(x.sec, x.id, { key: 'w' + i, text: s.word, x: PORTRAIT ? 0.07 : 0.0625, y: PORTRAIT ? 0.66 : 0.64, size: PORTRAIT ? 170 : 230, weight: 800, color: 'white', onMedia: true, bg: 'black', shadow: true });
        hidden(T); reveal(x.tl, t0 + 0.04, T, 'rise', 0.45);
        if (i < shots.length - 1) x.tl.set(T.ins, { yPercent: 115 }, t0 + each - 0.02);
        x.cue(t0, 'hit', 0.5);
      }
    });
  };

  // Founder / person portrait on white with swapping text groups
  COMP.portrait = (x, p) => {
    x.sec.style.background = tok('paper');
    const ph = el('div', 'position:absolute;inset:0;overflow:hidden', x.sec);
    const img = mediaImg(ph, `position:absolute;${PORTRAIT ? 'left:0;top:34%;width:100%;height:66%' : 'inset:0;width:100%;height:100%'};object-fit:cover;transform-origin:72% 40%`);
    play(img, p.photo, 0, x.dur + 0.1, { speed: 0.5, pos: p.photo && p.photo.pos || '75% 30%' });
    el('div', PORTRAIT ? `position:absolute;left:0;top:30%;width:100%;height:22%;background:linear-gradient(180deg,${C.paper} 0%,rgba(255,255,255,0) 100%)` : `position:absolute;left:0;top:0;width:65%;height:100%;background:linear-gradient(90deg,${C.paper} 0%,${C.paper} 55%,rgba(255,255,255,0) 100%)`, x.sec);
    x.tl.fromTo(ph, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, ease: 'expo.inOut' }, 0);
    x.tl.fromTo(img, { scale: 1.14 }, { scale: 1, duration: x.dur, ease: 'power1.out' }, 0);
    x.cue(0, 'whoosh', 0.45);
    (p.groups || []).forEach((g, gi) => {
      let y = PORTRAIT ? 0.08 : 0.32;
      const Ts = (g.lines || []).map((l, li) => {
        const size = (l.size || 60) * (PORTRAIT ? 0.8 : 1);
        const T = text(x.sec, x.id, { key: `g${gi}l${li}`, text: l.text, x: PORTRAIT ? 0.07 : 0.0625, y, size, weight: l.weight || 800, color: l.color || 'ink', font: l.mono ? 'mono' : 'display', ls: l.mono ? 0.2 : undefined, bg: 'paper', maxW: PORTRAIT ? 0.86 : 0.55 });
        if (l.mono) T.el.style.fontSize = (18 * U) + 'px';
        y += (l.mono ? 40 : size * 1.18 * Math.max(1, String(l.text).split('\n').length)) * U / H + (l.gap || 0);
        hidden(T); return T;
      });
      Ts.forEach((T, i) => reveal(x.tl, (g.at ?? 0.5) + i * 0.18, T, 'rise', 0.7));
      x.cue(g.at ?? 0.5, 'click', 0.45);
      if (g.until != null) Ts.forEach(T => hide(x.tl, g.until, T, 'up'));
    });
    if (p.line !== false) {
      const s = svg(x.sec, 1);
      const yL = PORTRAIT ? 0.3 * H : 0.66 * H;
      const pa = pathEl(s, `M -30 ${yL} C ${0.14 * W} ${yL}, ${0.33 * W} ${yL - 26 * U}, ${0.52 * W} ${yL}`);
      draw(x.tl, pa, 0.6, 1.4);
    }
    x.tl.to(x.sec, { x: -0.14 * W, autoAlpha: 0, duration: 0.35, ease: 'power3.in' }, x.dur - 0.35);
  };

  // Screenshot inside a browser frame, camera pushes into a focus point
  function browserFrame(parent, shot, url, css, dark) {
    const b = el('div', `position:absolute;border-radius:${16 * U}px;overflow:hidden;background:${dark ? '#111' : '#fff'};box-shadow:0 40px 90px -25px rgba(10,22,51,.45),0 0 0 1px rgba(10,22,51,.06);${css}`, parent);
    const bar = el('div', `height:${44 * U}px;background:${dark ? '#1d1d1f' : '#EEF1F5'};display:flex;align-items:center;gap:${9 * U}px;padding:0 ${18 * U}px;position:relative`, b);
    for (let i = 0; i < 3; i++) el('i', `width:${12 * U}px;height:${12 * U}px;border-radius:50%;background:${dark ? '#48484c' : '#CDD3DD'};display:block`, bar);
    const u = el('div', `position:absolute;left:50%;transform:translateX(-50%);height:${26 * U}px;min-width:${300 * U}px;padding:0 ${16 * U}px;border-radius:${8 * U}px;background:${dark ? '#2c2c2e' : '#fff'};font:500 ${14 * U}px var(--body);color:#6B7385;display:flex;align-items:center;justify-content:center`, bar);
    u.textContent = url || '';
    const scr = el('div', `position:absolute;left:0;top:${44 * U}px;right:0;bottom:0;overflow:hidden`, b);
    const img = mediaImg(scr, 'width:100%;height:100%;object-fit:cover;object-position:0 0;display:block');
    return { b, img };
  }
  COMP.browser = (x, p) => {
    x.sec.style.background = '#F3F5F8';
    const bw = PORTRAIT ? 0.9 * W : 0.73 * W, bh = bw * 0.625 + 44 * U;
    const f = browserFrame(x.sec, p.shot, p.url, `left:${(W - bw) / 2}px;top:${(H - bh) / 2}px;width:${bw}px;height:${bh}px`, p.dark);
    play(f.img, p.shot, 0, x.dur + 0.1, { pos: '0 0' });
    x.tl.fromTo(f.b, { y: 90 * U, scale: 0.94, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.7, ease: 'expo.out' }, 0);
    const fx = (p.focus && p.focus.x) ?? 0.5, fy = (p.focus && p.focus.y) ?? 0.5;
    x.tl.to(f.b, { scale: p.zoom || 2.6, transformOrigin: `${fx * bw}px ${44 * U + fy * (bh - 44 * U)}px`, duration: Math.max(0.6, x.dur - 1.2), ease: 'power3.in' }, 0.9);
    x.tl.to(f.b, { autoAlpha: 0, duration: 0.2 }, x.dur - 0.2);
    x.cue(0, 'whoosh', 0.35); x.cue(0.3, 'ui', 0.5); x.cue(0.9, 'riser', 0.3);
    if (p.caption) {
      const T = text(x.sec, x.id, { key: 'cap', text: p.caption, x: 0.5, y: PORTRAIT ? 0.1 : 0.05, size: 18, font: 'mono', color: 'sub', anchor: 'center', ls: 0.24, bg: 'paper' });
      hidden(T); reveal(x.tl, 0.2, T);
    }
  };

  // Stack of screenshot cards with a changing label (course pages, press, products)
  COMP.cards = (x, p) => {
    x.sec.style.background = '#F3F5F8';
    const cards = p.cards || [];
    const n = cards.length || 1;
    const s = svg(x.sec, 1);
    const pa = pathEl(s, PORTRAIT ? `M -30 ${0.93 * H} C ${0.3 * W} ${0.96 * H}, ${0.6 * W} ${0.9 * H}, ${W + 30} ${0.94 * H}` : `M -30 ${0.92 * H} C ${0.22 * W} ${0.93 * H}, ${0.47 * W} ${0.87 * H}, ${0.69 * W} ${0.9 * H} S ${0.94 * W} ${0.93 * H}, ${W + 30} ${0.89 * H}`);
    const dot = dotEl(s); draw(x.tl, pa, 0.2, x.dur - 0.8, 'power1.inOut', dot);
    const cw = PORTRAIT ? 0.84 * W : 0.47 * W, ch = cw * (p.ratio || 0.66);
    const cx = PORTRAIT ? W / 2 : 0.7 * W, cy = PORTRAIT ? 0.62 * H : 0.5 * H;
    const box = el('div', 'position:absolute;inset:0;z-index:3', x.sec);
    const slot = x.dur / (n + 0.6);
    const els = cards.map((c, i) => {
      const f = browserFrame(box, c.shot, c.url, `left:${cx - cw / 2}px;top:${cy - ch / 2}px;width:${cw}px;height:${ch + 44 * U}px`, false);
      play(f.img, c.shot, 0, x.dur + 0.1, { pos: '0 0' });
      gsap.set(f.b, { autoAlpha: 0, filter: 'brightness(1)', zIndex: i + 1 });
      return f.b;
    });
    const labX = PORTRAIT ? 0.07 : 0.0625, labY = PORTRAIT ? 0.16 : 0.4;
    const tag = text(x.sec, x.id, { key: 'tag', text: p.tag || '', x: labX, y: labY - 0.05, size: 18, font: 'mono', color: 'sub', ls: 0.24, bg: 'paper' });
    hidden(tag); reveal(x.tl, 0.1, tag);
    cards.forEach((c, i) => {
      const t = 0.3 + i * slot;
      const dir = [[900, 0, 4], [0, 900, -4], [-1400, 120, 0], [0, -700, 3]][i % 4];
      x.tl.fromTo(els[i], { autoAlpha: 1, x: dir[0] * U, y: dir[1] * U, rotation: dir[2] }, { x: (i % 2 ? 1 : -1) * 20 * U * (i > 0), y: (i % 3) * 14 * U, rotation: (i % 2 ? 1.5 : -1.5) * (i > 0), duration: 0.65, ease: 'expo.out', immediateRender: false }, t);
      if (i > 0) x.tl.to(els.slice(0, i), { scale: '-=0.05', x: '-=' + 60 * U, y: '-=' + 30 * U, filter: 'brightness(.92)', duration: 0.6, ease: 'expo.out' }, t);
      x.cue(t, 'whoosh', 0.4); x.cue(t + 0.3, 'ui', 0.45);
      if (c.label) {
        const L = text(x.sec, x.id, { key: 'lab' + i, text: c.label, x: labX, y: labY, size: PORTRAIT ? 96 : (c.label.length > 12 ? 84 : 120), weight: 800, color: i % 2 ? 'primary' : 'ink', maxW: PORTRAIT ? 0.86 : 0.36, bg: 'paper' });
        hidden(L); reveal(x.tl, t + 0.05, L, 'rise', 0.5);
        if (i < n - 1) hide(x.tl, t + slot - 0.1, L, 'up', 0.25); else hide(x.tl, x.dur - 0.5, L, 'up', 0.25);
      }
    });
    x.tl.to(els, { x: 0, y: 0, rotation: 0, scale: 0.12, autoAlpha: 0, duration: 0.45, ease: 'power4.in', stagger: 0.02 }, x.dur - 0.55);
    x.tl.to([pa, dot], { autoAlpha: 0, duration: 0.3 }, x.dur - 0.5);
    x.cue(x.dur - 0.3, 'collapse', 0.6);
  };

  // Freeze-frame on a person with callouts + big word (EXPERTS.)
  COMP.callouts = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1)');
    const dim = el('div', 'position:absolute;inset:0;background:#060C1E;opacity:0', x.sec);
    const shots = p.lead || [];
    const leadDur = shots.length ? Math.min(x.dur * 0.45, shots.length * 1.2) : 0;
    shots.forEach((m, i) => { const t0 = i * (leadDur / shots.length); play(img, m, t0, t0 + leadDur / shots.length, { speed: 0.8 }); if (i) x.cue(t0, 'tick', 0.3); });
    const fz = leadDur + 0.3;
    play(img, p.media, leadDur, fz, { speed: 1 });
    play(img, p.media, fz, x.dur - 0.6, { speed: 0, off: 0.3 });
    play(img, p.media, x.dur - 0.6, x.dur + 0.1, { speed: 0.6, off: 0.3 });
    x.tl.fromTo(img, { scale: 1 }, { scale: 1.06, duration: x.dur, ease: 'none' }, 0);
    x.tl.to(dim, { opacity: 0.5, duration: 0.25 }, fz);
    x.tl.to(img, { filter: 'saturate(.6)', duration: 0.25 }, fz);
    x.cue(fz, 'freeze', 0.3);
    const pos = PORTRAIT ? [[0.07, 0.12, 'left'], [0.93, 0.2, 'right'], [0.07, 0.3, 'left']] : [[0.047, 0.16, 'left'], [0.77, 0.39, 'left'], [0.047, 0.48, 'left']];
    (p.callouts || []).slice(0, 3).forEach((c, i) => {
      const T = text(x.sec, x.id, { key: 'c' + i, text: c, x: pos[i][0], y: pos[i][1], size: PORTRAIT ? 44 : 50, weight: i === 1 ? 400 : 700, color: 'white', anchor: pos[i][2], maxW: i === 1 && !PORTRAIT ? 0.2 : undefined, onMedia: true, bg: 'black', shadow: true });
      hidden(T); reveal(x.tl, fz + 0.2 + i * 0.45, T); x.cue(fz + 0.2 + i * 0.45, 'click', 0.4);
      hide(x.tl, x.dur - 0.6, T, 'fade');
    });
    const B = text(x.sec, x.id, { key: 'big', text: p.big || '', x: 0.5, y: PORTRAIT ? 0.72 : 0.74, size: PORTRAIT ? 180 : 260, weight: 800, color: '#4A74FF', anchor: 'center', onMedia: true, bg: 'black', shadow: true });
    hidden(B); reveal(x.tl, fz + 1.6, B, 'track', 0.7); x.cue(fz + 1.6, 'hit', 0.7);
    x.tl.to(B.el, { y: 40 * U, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, x.dur - 0.4);
    x.tl.to(dim, { opacity: 0.12, duration: 0.3 }, x.dur - 0.6);
  };

  // Photo collage with parallax + stacked rows (LEARN / BUILD / GROW TOGETHER.)
  COMP.collage = (x, p) => {
    x.sec.style.background = '#F3F5F8';
    const items = p.items || [];
    const col = el('div', 'position:absolute;left:0;top:0;width:100%;height:100%', x.sec);
    const layers = {};
    const spots = PORTRAIT
      ? [[0.08, 0.42, 0.56, 0.18, -3, 1], [0.5, 0.52, 0.46, 0.16, 4, 1.25], [0.12, 0.66, 0.42, 0.14, -5, 0.8], [0.62, 0.7, 0.5, 0.16, 3, 1.1], [0.3, 0.8, 0.46, 0.15, -4, 1.3], [0.85, 0.46, 0.4, 0.14, 5, 0.85], [0.9, 0.8, 0.5, 0.17, -3, 1.15], [1.2, 0.58, 0.44, 0.15, 4, 0.9]]
      : [[0.56, 0.1, 0.375, 0.375, -3, 1], [0.77, 0.5, 0.29, 0.29, 4, 1.25], [0.615, 0.73, 0.23, 0.23, -5, 0.8], [0.99, 0.11, 0.31, 0.31, 3, 1.1], [1.12, 0.52, 0.25, 0.25, -4, 1.3], [1.02, 0.76, 0.22, 0.22, 5, 0.85], [1.28, 0.19, 0.29, 0.29, -3, 1.15], [1.33, 0.63, 0.23, 0.23, 4, 0.9], [1.46, 0.37, 0.31, 0.31, -2, 1.2], [1.43, 0.74, 0.24, 0.24, 3, 0.85]];
    items.slice(0, spots.length).forEach((m, i) => {
      const [sx, sy, sw, shFrac, r, dp] = spots[i];
      if (!layers[dp]) layers[dp] = el('div', 'position:absolute;left:0;top:0;width:100%;height:100%', col);
      const w = sw * W, h = PORTRAIT ? shFrac * H : w * 0.5625;
      const d = el('div', `position:absolute;left:${sx * W}px;top:${sy * H}px;width:${w}px;height:${h}px;background:#fff;padding:${10 * U}px;box-shadow:0 24px 50px -18px rgba(10,22,51,.42)`, layers[dp]);
      const inner = el('div', 'position:relative;width:100%;height:100%;overflow:hidden;background:#ccd', d);
      const img = mediaImg(inner);
      play(img, m, 0, x.dur + 0.1, { speed: 0.6 });
      const t = 0.05 + i * (x.dur * 0.55 / items.length);
      gsap.set(d, { autoAlpha: 0 });
      x.tl.fromTo(d, { autoAlpha: 1, y: (r > 0 ? 1 : -1) * 520 * U, rotation: r * 3.2, scale: 1.12 }, { y: 0, rotation: r, scale: 1, duration: 0.9, ease: 'expo.out', immediateRender: false }, t);
      x.cue(t + 0.05, 'card', 0.35);
    });
    Object.entries(layers).forEach(([dp, L]) => x.tl.fromTo(L, { x: 0 }, { x: -(PORTRAIT ? 0.55 : 0.57) * W * dp, duration: x.dur, ease: 'power1.inOut' }, 0));
    el('div', PORTRAIT ? `position:absolute;left:0;top:0;width:100%;height:40%;background:linear-gradient(180deg,#F3F5F8 0%,#F3F5F8 70%,rgba(243,245,248,0) 100%);z-index:5` : `position:absolute;left:0;top:0;width:57%;height:100%;background:linear-gradient(90deg,#F3F5F8 0%,#F3F5F8 62%,rgba(243,245,248,0) 100%);z-index:5`, x.sec);
    const rows = p.rows || [];
    const Ts = rows.map((r, i) => {
      const T = text(x.sec, x.id, { key: 'r' + i, text: r, x: PORTRAIT ? 0.07 : 0.057, y: (PORTRAIT ? 0.08 : 0.3) + i * (PORTRAIT ? 0.075 : 0.092), size: PORTRAIT ? 80 : 92, weight: 800, color: 'primary', bg: '#F3F5F8' });
      T.el.style.zIndex = 6; hidden(T);
      const lastWord = T.ins[T.ins.length - 1]; if (lastWord && T.ins.length > 1) lastWord.style.fontWeight = 300;
      return T;
    });
    Ts.forEach((T, i) => {
      const t = 0.4 + i * (x.dur * 0.3);
      reveal(x.tl, t, T, 'rise', 0.7, 0.1); x.cue(t, 'whoosh', 0.45);
      if (i > 0) x.tl.to(Ts[i - 1].ins, { color: tok('muted'), duration: 0.4 }, t);
    });
    x.tl.to(x.sec, { autoAlpha: 0, duration: 0.25 }, x.dur - 0.25);
  };

  // Stations joined by the journey line: card + word per station (STUDENT → SKILL → …)
  COMP.track = (x, p) => {
    x.sec.style.background = tok('paper');
    const st = p.stations || [];
    const GAP = PORTRAIT ? W * 1.0 : W * 0.6;
    const trk = el('div', 'position:absolute;left:0;top:0;width:100%;height:100%', x.sec);
    const wy = xx => (PORTRAIT ? 0.8 : 0.84) * H + 34 * U * Math.sin((xx - W / 2) / GAP * Math.PI * 2);
    const s = svg(trk, 0); s.style.overflow = 'visible';
    let d = `M ${-0.3 * W} ${wy(-0.3 * W)}`; for (let xx = -0.3 * W; xx <= W / 2 + GAP * st.length + W; xx += 20) d += ` L ${xx} ${wy(xx).toFixed(1)}`;
    const pa = pathEl(s, d); const L = pa.getTotalLength(); gsap.set(pa, { strokeDasharray: L, strokeDashoffset: L });
    const lenAt = xx => (xx + 0.3 * W) / (W / 2 + GAP * st.length + 1.3 * W) * L;
    const cw = PORTRAIT ? 0.84 * W : 0.42 * W, chh = cw * 0.5625;
    const slot = x.dur / Math.max(1, st.length);
    const Ts = [];
    st.forEach((sto, i) => {
      const cx = W / 2 + i * GAP;
      const c = el('div', `position:absolute;left:${cx - cw / 2}px;top:${(PORTRAIT ? 0.2 : 0.14) * H}px;width:${cw}px;height:${chh}px;border-radius:${18 * U}px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(10,22,51,.35);background:#dde2ea`, trk);
      const img = mediaImg(c); play(img, sto.media, 0, x.dur + 0.1, { speed: 0.5 });
      const T = text(trk, x.id, { key: 's' + i, text: sto.word, x: cx / W, y: (PORTRAIT ? 0.56 : 0.61), size: PORTRAIT ? 110 : (String(sto.word).length > 9 ? 120 : 150), weight: 800, color: 'primary', anchor: 'center', bg: 'paper' });
      hidden(T);
      const dt = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dt.setAttribute('class', 'dot'); dt.setAttribute('r', 0); dt.setAttribute('cx', cx); dt.setAttribute('cy', wy(cx)); s.appendChild(dt);
      const t = i * slot + 0.15;
      if (i > 0) x.tl.to(trk, { x: -GAP * i, duration: 0.55, ease: 'expo.inOut' }, t - 0.35);
      x.tl.fromTo(c, { clipPath: 'inset(50% 0% 50% 0% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 0.6, ease: 'expo.inOut' }, t - 0.2);
      reveal(x.tl, t + 0.05, T, 'rise', 0.55);
      if (i > 0) x.tl.to(Ts[i - 1].ins, { color: tok('muted'), duration: 0.4 }, t);
      x.tl.to(pa, { strokeDashoffset: L - lenAt(cx + 0.27 * W), duration: 0.9, ease: 'power2.inOut' }, t - 0.4);
      x.tl.fromTo(dt, { attr: { r: 0 } }, { attr: { r: 9 * U }, duration: 0.4, ease: 'back.out(2)' }, t - 0.05);
      x.cue(t - 0.35, 'whoosh', 0.35); x.cue(t + 0.1, 'click', 0.55);
      Ts.push(T);
    });
    x.tl.to(trk, { x: '-=' + 40 * U, duration: slot, ease: 'none' }, x.dur - slot);
  };

  // Fastest montage: a cut every ~0.3 s
  COMP.montage = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec);
    const items = p.items || [];
    const each = p.each || Math.max(0.25, x.dur / Math.max(1, items.length));
    items.forEach((m, i) => {
      const t0 = i * each; if (t0 >= x.dur) return;
      play(img, m, t0, Math.min(x.dur + 0.05, t0 + each + 0.01), { speed: 1 });
      x.tl.fromTo(img, { scale: 1.1 }, { scale: 1, duration: each, ease: 'power2.out', immediateRender: false }, t0);
      x.cue(t0, 'mcut', 0.5 + (i % 4 === 0 ? 0.35 : 0));
    });
    if (p.stop) x.cue(x.dur, 'stop', 1);
  };

  // White statement screen: lines move up, the last one lands biggest
  COMP.statement = (x, p) => {
    x.sec.style.background = tok(p.bg || 'paper');
    const lines = p.lines || [];
    const n = lines.length;
    const step = (x.dur - 1.6) / Math.max(1, n);
    const Ts = lines.map((l, i) => {
      const last = i === n - 1 && p.bigLast !== false;
      const T = text(x.sec, x.id, { key: 'l' + i, text: l, x: 0.5, y: last ? (PORTRAIT ? 0.46 : 0.56) : 0.435, size: last ? (PORTRAIT ? 150 : 238) : (PORTRAIT ? 90 : 118), weight: last || i % 2 ? 800 : 300, color: last ? 'primary' : 'ink', anchor: 'center', maxW: PORTRAIT ? 0.9 : undefined, bg: p.bg || 'paper' });
      hidden(T); return T;
    });
    Ts.forEach((T, i) => {
      const t = 0.4 + i * step;
      reveal(x.tl, t, T, 'rise', i === n - 1 ? 0.7 : 0.9, 0.12);
      x.cue(t, i === n - 1 ? 'career' : 'soft', 0.5);
      for (let j = 0; j < i; j++) x.tl.to(Ts[j].el, { y: -(i - j) * 130 * U * (PORTRAIT ? 0.8 : 1), fontSize: (i === n - 1 ? 64 : 118) * U * (PORTRAIT ? 0.8 : 1), color: tok('muted'), duration: 0.8, ease: 'expo.inOut' }, t - 0.15);
    });
    if (p.line !== false) {
      const s = svg(x.sec, 0); const y = (PORTRAIT ? 0.62 : 0.815) * H;
      const pa = pathEl(s, `M -40 ${y} C ${0.26 * W} ${y - 10 * U}, ${0.73 * W} ${y + 20 * U}, ${W + 40} ${y - 10 * U}`);
      draw(x.tl, pa, x.dur - 1.3, 1.0);
    }
  };

  // Wall of real portraits → statement panel → ticker → featured row
  COMP.wall = (x, p) => {
    x.sec.style.background = tok('paper');
    const tiles = p.tiles || [];
    const wall = el('div', `position:absolute;left:${W / 2}px;top:${H / 2}px;width:0;height:0`, x.sec);
    const TW = 180 * U, TH = 320 * U, GX = 14 * U, GY = 16 * U;
    const cols = [], all = [];
    let k = 0;
    const nc = PORTRAIT ? 6 : 8, nr = PORTRAIT ? 5 : 3;
    for (let c = -nc; c <= nc; c++) {
      const colEl = el('div', `position:absolute;left:${c * (TW + GX) - TW / 2}px;top:0`, wall); cols.push(colEl);
      for (let r = -nr; r <= nr; r++) {
        if (!tiles.length) break;
        const m = tiles[(k * 37) % tiles.length]; k++;
        const d = el('div', `position:absolute;left:0;top:${r * (TH + GY) - TH / 2}px;width:${TW}px;height:${TH}px;border-radius:${12 * U}px;overflow:hidden;background:#dde2ea`, colEl);
        const img = mediaImg(d); play(img, m, 0, x.dur + 0.1, { speed: 0 });
        all.push(d);
      }
    }
    gsap.set(all, { autoAlpha: 0 });
    const order = all.map((t, i) => [t, Math.sin(i * 91.7) * 0.5 + 0.5]).sort((a, b) => a[1] - b[1]).map(z => z[0]);
    const A = x.dur * 0.28, B = x.dur * 0.62;
    order.forEach((t, i) => { const at = 0.05 + i * Math.min(0.019, 2.2 / order.length); x.tl.fromTo(t, { autoAlpha: 0, scale: 0.55 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out', immediateRender: false }, at); if (i % 9 === 0) x.cue(at, 'tick', 0.18); });
    cols.forEach((c, i) => x.tl.fromTo(c, { y: (i % 2 ? -1 : 1) * 90 * U }, { y: (i % 2 ? 1 : -1) * 90 * U, duration: B, ease: 'none' }, 0));
    x.tl.fromTo(wall, { scale: 1.3 }, { scale: 1, duration: A + 0.5, ease: 'power2.out' }, 0);
    x.tl.to(wall, { scale: 0.58, duration: B - A - 0.5, ease: 'power2.inOut' }, A);
    const pw = PORTRAIT ? 0.88 * W : 0.615 * W, phh = 420 * U * (PORTRAIT ? 0.9 : 1);
    const panel = el('div', `position:absolute;left:${(W - pw) / 2}px;top:${(H - phh) / 2}px;width:${pw}px;height:${phh}px;background:#fff;border-radius:${26 * U}px;box-shadow:0 40px 90px -30px rgba(10,22,51,.45);z-index:5`, x.sec);
    gsap.set(panel, { autoAlpha: 0 });
    const rowSets = [p.rowsA || [], p.rowsB || []];
    const setT = rowSets.map((rows, si) => rows.map((r, i) => {
      const T = text(panel, x.id, { key: `p${si}${i}`, text: r, x: 70 * U / W, y: (48 + i * 112) * U / H * (PORTRAIT ? 0.9 : 1), size: PORTRAIT ? 78 : 96, weight: 800, color: 'ink', bg: 'white' });
      T.el.style.left = 70 * U + 'px'; T.el.style.top = ((48 + i * 112) * U * (PORTRAIT ? 0.9 : 1)) + 'px'; hidden(T); return T;
    }));
    x.tl.fromTo(panel, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'expo.out', immediateRender: false }, 0.4);
    const times = [[0.65, 0.65 + A * 0.28, 0.65 + A * 0.56], [A + 1.6, A + 1.6 + (B - A - 1.6) * 0.25, A + 1.6 + (B - A - 1.6) * 0.5]];
    setT.forEach((Ts, si) => Ts.forEach((T, i) => {
      const t = times[si][i];
      reveal(x.tl, t, T, 'rise', 0.55);
      if (i > 0) x.tl.to(Ts[i - 1].ins, { color: tok('muted'), duration: 0.35 }, t);
      if (i === Ts.length - 1) x.tl.to(T.ins, { color: tok('primary'), duration: 0.3 }, t + 0.1);
      x.cue(t, i === Ts.length - 1 ? 'hit' : 'click', 0.5);
    }));
    if (setT[0].length) { hide(x.tl, A + 0.6, { ins: setT[0].flatMap(T => T.ins) }, 'up'); x.tl.to(panel, { scale: 0.9, autoAlpha: 0, duration: 0.35, ease: 'power3.in' }, A + 0.6); x.tl.to(panel, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'expo.out' }, A + 1.4); }
    if (setT[1].length) hide(x.tl, B - 0.2, { ins: setT[1].flatMap(T => T.ins) }, 'up');
    x.tl.to(panel, { autoAlpha: 0, scale: 0.9, duration: 0.35, ease: 'power3.in' }, B - 0.1);
    // ticker
    const tick = el('div', `position:absolute;left:50%;top:${(PORTRAIT ? 0.84 : 0.833) * H}px;transform:translateX(-50%);z-index:6;background:var(--ink);color:#fff;border-radius:999px;padding:${18 * U}px ${36 * U}px;font:600 ${28 * U}px var(--body);display:flex;gap:${18 * U}px;align-items:center;white-space:nowrap`, x.sec);
    const tl1 = el('span', `font-weight:800;letter-spacing:.14em;color:#4A74FF;font-size:${22 * U}px`, tick); tl1.textContent = p.tickerLabel || 'PLACED';
    const tn = el('span', '', tick), tr = el('span', 'font-weight:300;opacity:.8', tick);
    gsap.set(tick, { autoAlpha: 0 });
    const tk = p.ticker || [];
    if (tk.length) {
      x.tl.fromTo(tick, { autoAlpha: 0, y: 40 * U }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', immediateRender: false }, A);
      for (let i = 0, t = A; t < B - 0.2; i++, t += 0.29) { const q = tk[(i * 7) % tk.length]; x.tl.set(tn, { textContent: q.name }, t); x.tl.set(tr, { textContent: q.role || '' }, t); if (i % 2 === 0) x.cue(t, 'tick', 0.15); }
      x.tl.to(tick, { autoAlpha: 0, y: 40 * U, duration: 0.3 }, B - 0.2);
    }
    x.tl.to(wall, { y: 1300 * U, autoAlpha: 0, duration: 0.7, ease: 'power3.in' }, B - 0.1);
    x.cue(B - 0.1, 'whoosh', 0.5);
    // featured
    const feat = (p.featured || []).slice(0, PORTRAIT ? 3 : 5);
    const fw = (PORTRAIT ? 300 : 280) * U, fh = fw * 1.78;
    feat.forEach((f, i) => {
      const cx = W / 2 + (i - (feat.length - 1) / 2) * (fw + 50 * U);
      const d = el('div', `position:absolute;left:${cx - fw / 2}px;top:${(PORTRAIT ? 0.34 : 0.305) * H}px;width:${fw}px;z-index:7`, x.sec);
      const card = el('div', `position:relative;width:${fw}px;height:${fh}px;border-radius:${16 * U}px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(10,22,51,.35)`, d);
      const img = mediaImg(card); play(img, f.media, 0, x.dur + 0.1, { speed: 0 });
      const n1 = el('div', `margin-top:${18 * U}px;font:700 ${26 * U}px var(--display);color:var(--ink);white-space:nowrap`, d); n1.textContent = f.name || '';
      const n2 = el('div', `margin-top:${4 * U}px;font:400 ${18 * U}px var(--body);color:#6B7385;white-space:nowrap`, d); n2.textContent = f.role || '';
      gsap.set(d, { autoAlpha: 0 });
      const t = B + 0.35 + i * 0.12;
      x.tl.fromTo(d, { autoAlpha: 0, y: 260 * U }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', immediateRender: false }, t);
      x.cue(t, 'card', 0.35);
      x.tl.to(d, { y: -40 * U, autoAlpha: 0, duration: 0.4, ease: 'power3.in' }, x.dur - 1.0 + i * 0.04);
    });
    const hs = text(x.sec, x.id, { key: 'hs', text: p.headSmall || '', x: 0.5, y: PORTRAIT ? 0.12 : 0.088, size: 54, weight: 300, anchor: 'center', bg: 'paper' });
    const hb = text(x.sec, x.id, { key: 'hb', text: p.headBig || '', x: 0.5, y: PORTRAIT ? 0.16 : 0.15, size: PORTRAIT ? 88 : 104, weight: 800, color: 'primary', anchor: 'center', maxW: PORTRAIT ? 0.9 : undefined, bg: 'paper' });
    [hs, hb].forEach(T => { T.el.style.zIndex = 7; hidden(T); });
    reveal(x.tl, B + 1.3, hs, 'rise', 0.75); reveal(x.tl, B + 1.5, hb, 'rise', 0.75); x.cue(B + 1.3, 'soft', 0.45);
    hide(x.tl, x.dur - 0.9, hs, 'up'); hide(x.tl, x.dur - 0.85, hb, 'up');
  };

  // Logo wall (customers, partners, recruiters)
  COMP.logos = (x, p) => {
    x.sec.style.background = tok('paper');
    const logos = p.logos || [];
    const cols = PORTRAIT ? 3 : 6;
    const cw = (PORTRAIT ? 0.86 : 0.8) * W / cols, chh = cw * 0.55;
    const gx = (W - cw * cols) / 2, gy = (PORTRAIT ? 0.34 : 0.4) * H;
    logos.slice(0, cols * (PORTRAIT ? 5 : 3)).forEach((m, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const d = el('div', `position:absolute;left:${gx + c * cw + 8 * U}px;top:${gy + r * (chh + 16 * U)}px;width:${cw - 16 * U}px;height:${chh}px;border-radius:${14 * U}px;background:#fff;box-shadow:0 10px 30px -12px rgba(10,22,51,.25);display:flex;align-items:center;justify-content:center;overflow:hidden`, x.sec);
      const img = mediaImg(d, `max-width:78%;max-height:64%;object-fit:contain`); play(img, m, 0, x.dur + 0.1, { speed: 0 });
      gsap.set(d, { autoAlpha: 0 });
      const t = 0.9 + i * 0.07;
      x.tl.fromTo(d, { autoAlpha: 0, y: 40 * U, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out', immediateRender: false }, t);
      if (i % 3 === 0) x.cue(t, 'tick', 0.25);
    });
    const hs = text(x.sec, x.id, { key: 'hs', text: p.small || '', x: 0.5, y: PORTRAIT ? 0.12 : 0.12, size: 54, weight: 300, anchor: 'center', bg: 'paper' });
    const hb = text(x.sec, x.id, { key: 'hb', text: p.big || '', x: 0.5, y: PORTRAIT ? 0.17 : 0.19, size: PORTRAIT ? 96 : 120, weight: 800, color: 'primary', anchor: 'center', maxW: PORTRAIT ? 0.9 : undefined, bg: 'paper' });
    hidden(hs); hidden(hb); reveal(x.tl, 0.2, hs); reveal(x.tl, 0.4, hb, 'track'); x.cue(0.4, 'hit', 0.5);
    (p.lines || []).forEach((l, i) => {
      const T = text(x.sec, x.id, { key: 'l' + i, text: l, x: 0.5, y: (PORTRAIT ? 0.8 : 0.82) + i * 0.045, size: 40, weight: 500, color: 'ink', anchor: 'center', bg: 'paper', maxW: 0.9 });
      hidden(T); reveal(x.tl, x.dur * 0.55 + i * 0.5, T); x.cue(x.dur * 0.55 + i * 0.5, 'click', 0.4);
    });
  };

  // Brand end frame: journey line floods the frame, logo card, tagline, url
  COMP.end = (x, p) => {
    x.sec.style.background = 'transparent';
    const bg = el('div', `position:absolute;inset:0;background:var(--primary)`, x.sec);
    const s0 = svg(x.sec, 0); const y = (PORTRAIT ? 0.62 : 0.815) * H;
    if (p.flood !== false) {
      const fl = pathEl(s0, `M ${-200 * U} ${y} C ${0.26 * W} ${y - 10 * U}, ${0.73 * W} ${y + 20 * U}, ${W + 200 * U} ${y - 10 * U}`);
      gsap.set(bg, { autoAlpha: 0 });
      draw(x.tl, fl, 0, 0.7);
      x.tl.fromTo(fl, { strokeWidth: 3.2 * U }, { strokeWidth: 2600 * U, duration: 0.85, ease: 'power3.in', immediateRender: false }, 0.75);
      x.tl.set(bg, { autoAlpha: 1 }, 1.6); x.tl.set(fl, { autoAlpha: 0 }, 1.62);
      x.cue(0.2, 'riser', 0.6); x.cue(1.6, 'hitDeep', 0.8);
    } else x.cue(0, 'hitDeep', 0.7);
    const b = p.flood !== false ? 1.6 : 0; const f = Math.min(1, (x.dur - b) / 5.4);
    const s = svg(x.sec, 1);
    const wl = pathEl(s, `M -40 ${0.83 * H} C ${0.16 * W} ${0.8 * H}, ${0.2 * W} ${0.39 * H}, ${0.27 * W} ${0.33 * H}`, { color: 'white', width: 2.4 });
    draw(x.tl, wl, b + 0.05, 0.75 * f); x.tl.to(wl, { autoAlpha: 0, duration: 0.3 }, b + 0.9 * f);
    const card = el('div', `position:absolute;left:50%;top:${(PORTRAIT ? 0.3 : 0.21) * H}px;transform:translateX(-50%);background:#fff;border-radius:${22 * U}px;padding:${36 * U}px ${62 * U}px`, x.sec);
    if (DOC.logo) { const lg = el('img', `display:block;width:${(PORTRAIT ? 560 : 680) * U}px;max-height:${260 * U}px;object-fit:contain;height:auto`, card); lg.src = DOC.logo; }
    else { const nm = el('div', `font:800 ${90 * U}px var(--display);color:var(--primary)`, card); nm.textContent = p.brandName || ''; }
    x.tl.fromTo(card, { clipPath: `inset(0% 100% 0% 0% round ${22 * U}px)` }, { clipPath: `inset(0% 0% 0% 0% round ${22 * U}px)`, duration: 0.8, ease: 'expo.inOut' }, b + 0.55 * f);
    x.cue(b + 0.6 * f, 'resolve', 1);
    const mk = (key, t, y0, size, weight, o = {}) => { const T = text(x.sec, x.id, { key, text: t || '', x: 0.5, y: y0, size, weight, color: 'white', anchor: 'center', maxW: PORTRAIT ? 0.9 : undefined, bg: 'primary', ...o }); hidden(T); return T; };
    const T1 = mk('tag', p.tagline, PORTRAIT ? 0.52 : 0.5, PORTRAIT ? 66 : 78, 800);
    const T2 = mk('l1', p.line1, PORTRAIT ? 0.6 : 0.62, 44, 400);
    const T3 = mk('l2', p.line2, PORTRAIT ? 0.64 : 0.665, 44, 700);
    const T4 = mk('url', p.url, PORTRAIT ? 0.74 : 0.815, 30, 500, { ls: 0.12 });
    reveal(x.tl, b + 1.5 * f, T1, 'rise', 0.6, 0.16);
    reveal(x.tl, b + 2.3 * f, T2, 'rise', 0.7); reveal(x.tl, b + 2.6 * f, T3, 'rise', 0.7);
    reveal(x.tl, b + 3.2 * f, T4, 'rise', 0.6);
    x.cue(b + 1.5 * f, 'tick', 0.3); x.cue(b + 3.2 * f, 'tick', 0.3);
  };

  // Per-word captions over the base video (transparent overlay; captions family).
  // Styles mirror the free subtitle tool: bold, clean, karaoke + 2026 short-form looks.
  const SERIF = "'Playfair Display', Georgia, serif";
  const CAPTION_STYLES = {
    bold:      { w: 900, size: [86, 72], upper: true, anim: 'rise', emph: true },
    clean:     { w: 700, size: [64, 56], anim: 'rise' },
    karaoke:   { w: 900, size: [86, 72], upper: true, anim: 'karaoke', emph: true },
    hustle:    { w: 900, size: [96, 80], upper: true, anim: 'pop', per: 3, accent: '#22C55E', outline: true },
    hype:      { w: 900, size: [112, 100], upper: true, anim: 'bounce', per: 2, accent: '#FDE047', tilt: -3, outline: true },
    sticker:   { w: 800, size: [66, 56], anim: 'rise', per: 4, word: '#FFFFFF', color: '#111111', accent: '#FDE047', tilt: -2 },
    serif:     { font: SERIF, w: 500, italic: true, size: [68, 58], anim: 'fade', color: '#FFF7ED' },
    underline: { w: 700, size: [62, 54], anim: 'underline' },
    spotlight: { w: 800, size: [72, 60], anim: 'spotlight' },
    neon:      { w: 800, size: [92, 78], upper: true, anim: 'color', color: '#F0ABFC', accent: '#FFFFFF', glow: '#D946EF' },
    boxed:     { w: 800, size: [74, 62], anim: 'box' },
    minimal:   { w: 600, size: [52, 44], anim: 'none' },
  };
  const outlineShadow = (c, n) => [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 2], [2, 0], [0, -2], [-2, 0]].map(([a, b]) => `${a * n}px ${b * n}px 0 ${c}`).join(',');
  COMP.captions = (x, p) => {
    x.sec.style.background = 'transparent';
    const words = p.words || []; // [{w,start,end}] seconds relative to scene start
    const S = CAPTION_STYLES[p.style] || CAPTION_STYLES.bold;
    const accent = S.accent || (C.accent && C.accent.toLowerCase() !== '#ffffff' ? C.accent : '#FFD400');
    const color = S.color || '#ffffff';
    const maxChars = PORTRAIT ? 18 : 32;
    const per = p.wordsPerPage || S.per || 0;
    const groups = []; let g = [];
    words.forEach(w => {
      const len = g.reduce((a, b) => a + b.w.length + 1, 0) + w.w.length;
      const gapBreak = g.length && w.start - g[g.length - 1].end > 0.6;
      if (g.length && ((per && g.length >= per) || len > maxChars || gapBreak || /[.!?]$/.test(g[g.length - 1].w))) { groups.push(g); g = []; }
      g.push(w);
    });
    if (g.length) groups.push(g);
    const yy = p.position === 'center' ? 0.5 : p.position === 'top' ? (PORTRAIT ? 0.24 : 0.2) : (PORTRAIT ? 0.62 : 0.78);
    const size = (PORTRAIT ? S.size[0] : S.size[1]) * U;
    const shadow = S.glow ? `0 0 ${18 * U}px ${S.glow}, 0 0 ${42 * U}px ${S.glow}` : S.outline ? `${outlineShadow('#000', 5 * U)}, 0 ${6 * U}px ${18 * U}px rgba(0,0,0,.5)` : S.word ? 'none' : '0 4px 18px rgba(0,0,0,.55)';
    groups.forEach((grp, gi) => {
      const box = el('div', `position:absolute;left:50%;top:${yy * H}px;transform:translate(-50%,-50%) rotate(${S.tilt || 0}deg);width:${(PORTRAIT ? 0.84 : 0.8) * W}px;text-align:center;font-family:${S.font || 'var(--display)'};font-style:${S.italic ? 'italic' : 'normal'};font-weight:${S.w};font-size:${size}px;line-height:1.12;letter-spacing:-.01em;text-transform:${S.upper ? 'uppercase' : 'none'};color:${color};text-shadow:${shadow}`, x.sec, 'tx');
      box.style.whiteSpace = 'normal';
      box.dataset.gate = 'text'; box.dataset.id = `${x.id}.g${gi}`; box.dataset.onmedia = '1';
      if (S.word) { box.dataset.bg = S.word; box.dataset.fg = color; delete box.dataset.onmedia; }
      const fx = (DOC.fixes && DOC.fixes[box.dataset.id]) || {}; if (fx.scale) box.style.fontSize = (parseFloat(box.style.fontSize) * fx.scale) + 'px';
      const spans = grp.map(w => {
        const s = el('span', `display:inline-block;position:relative;margin:${S.word ? '.08em .14em' : S.anim === 'pop' || S.anim === 'bounce' ? '0 .2em' : '0 .12em'}${S.word ? `;background:${S.word};padding:.02em .22em;border-radius:${10 * U}px` : ''}`, box);
        s.textContent = w.w; return s;
      });
      gsap.set(box, { autoAlpha: 0 });
      const t0 = grp[0].start, t1 = (groups[gi + 1] ? Math.min(groups[gi + 1][0].start, grp[grp.length - 1].end + 0.8) : grp[grp.length - 1].end + 0.5);
      x.tl.set(box, { autoAlpha: 1 }, t0); x.tl.set(box, { autoAlpha: 0 }, t1);
      grp.forEach((w, wi) => {
        const s = spans[wi], next = grp[wi + 1] ? grp[wi + 1].start : t1;
        const on = (to, from, d = 0.05) => x.tl.fromTo(s, from, { ...to, duration: d, immediateRender: false }, w.start);
        const off = (to) => x.tl.to(s, { ...to, duration: 0.08 }, Math.max(w.start + 0.06, next));
        if (S.anim === 'karaoke') on({ color: accent }, { color });
        else if (S.anim === 'rise') { x.tl.fromTo(s, { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.18, ease: 'back.out(2)', immediateRender: false }, w.start); }
        else if (S.anim === 'fade') { x.tl.fromTo(s, { y: 18 * U, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, w.start); }
        else if (S.anim === 'pop') { x.tl.fromTo(s, { scale: 0.8, color }, { scale: 1.12, color: accent, duration: 0.12, ease: 'back.out(3)', immediateRender: false }, w.start); off({ scale: 1, color }); }
        else if (S.anim === 'bounce') { x.tl.fromTo(s, { y: 0, color }, { y: -0.22 * size, color: accent, duration: 0.14, ease: 'power2.out', immediateRender: false }, w.start); x.tl.to(s, { y: 0, duration: 0.16, ease: 'bounce.out' }, w.start + 0.14); off({ color }); }
        else if (S.anim === 'color') { on({ color: accent }, { color }); off({ color }); }
        else if (S.anim === 'spotlight') { gsap.set(s, { opacity: 0.38 }); on({ opacity: 1 }, { opacity: 0.38 }); off({ opacity: 0.6 }); }
        else if (S.anim === 'box') { s.style.borderRadius = `${10 * U}px`; s.style.padding = '0 .14em'; on({ backgroundColor: accent }, { backgroundColor: 'rgba(0,0,0,0)' }); off({ backgroundColor: 'rgba(0,0,0,0)' }); }
        else if (S.anim === 'underline') {
          const bar = el('span', `position:absolute;left:0;right:0;bottom:-.06em;height:.1em;background:${accent};border-radius:.05em;transform-origin:0 50%`, s);
          gsap.set(bar, { scaleX: 0 });
          x.tl.to(bar, { scaleX: 1, duration: 0.15, ease: 'power2.out' }, w.start); x.tl.to(bar, { scaleX: 0, duration: 0.08 }, Math.max(w.start + 0.16, next));
        }
        if (S.word && wi === grp.length - 1) { /* sticker: brand accent on the last word of each page */ s.style.background = accent; }
      });
      if (S.emph) {
        const longest = grp.reduce((a, b, i) => b.w.length > grp[a].w.length ? i : a, 0);
        if (S.anim !== 'karaoke') spans[longest].style.color = accent;
      }
    });
    if (p.title) {
      const bar = el('div', `position:absolute;left:50%;top:${(PORTRAIT ? 0.12 : 0.06) * H}px;transform:translateX(-50%);background:var(--primary);color:#fff;border-radius:${14 * U}px;padding:${14 * U}px ${28 * U}px;font:800 ${(PORTRAIT ? 44 : 38) * U}px var(--display);max-width:${0.86 * W}px;text-align:center;white-space:normal`, x.sec, 'tx');
      bar.textContent = p.title; bar.dataset.gate = 'text'; bar.dataset.id = x.id + '.title'; bar.dataset.bg = hexOf('primary'); bar.dataset.fg = '#ffffff';
      x.tl.fromTo(bar, { y: -40 * U, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out' }, 0.2);
    }
  };

  // Small helper: a text block with a solid background pill (always readable over footage)
  function pill(parent, id, o) {
    const d = el('div', `position:absolute;left:${o.x * W}px;top:${o.y * H}px;transform:translate(${o.center ? '-50%' : '0'},-50%) rotate(${o.tilt || 0}deg);background:${o.bg};color:${o.fg};font-family:${o.font || 'var(--display)'};font-weight:${o.weight || 800};font-size:${o.size * U}px;line-height:1.15;padding:${o.pad ?? 14 * U}px ${(o.pad ?? 14 * U) * 1.6}px;border-radius:${(o.radius ?? 14) * U}px;max-width:${(o.maxW || 0.86) * W}px;text-align:${o.center ? 'center' : 'left'};white-space:normal`, parent, 'tx');
    d.textContent = o.text; d.dataset.gate = 'text'; d.dataset.id = id; d.dataset.bg = o.bg.startsWith('#') ? o.bg : hexOf(o.bgTok || 'primary'); d.dataset.fg = o.fg.startsWith('#') ? o.fg : '#ffffff';
    return d;
  }

  // POV: full-bleed clips with a persistent top caption (TikTok/Reels "POV: …" format)
  COMP.pov = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec);
    const shots = p.shots || [];
    const each = x.dur / Math.max(1, shots.length);
    shots.forEach((s, i) => {
      const t0 = i * each;
      play(img, s.media, t0, t0 + each + 0.05, { speed: 1 });
      x.tl.fromTo(img, { scale: 1.08 }, { scale: 1, duration: each, ease: 'power1.out', immediateRender: false }, t0);
      if (i) x.cue(t0, 'tick', 0.3);
      if (s.caption) {
        const c = pill(x.sec, `${x.id}.c${i}`, { text: s.caption, x: 0.5, y: PORTRAIT ? 0.7 : 0.78, size: PORTRAIT ? 50 : 44, bg: '#ffffff', fg: '#111111', center: true, weight: 700 });
        gsap.set(c, { autoAlpha: 0 });
        x.tl.fromTo(c, { autoAlpha: 0, y: 20 * U }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'expo.out', immediateRender: false }, t0 + 0.1);
        x.tl.set(c, { autoAlpha: 0 }, t0 + each - 0.02);
      }
    });
    const top = pill(x.sec, `${x.id}.pov`, { text: p.pov || '', x: 0.5, y: PORTRAIT ? 0.17 : 0.12, size: PORTRAIT ? 54 : 46, bg: '#ffffff', fg: '#111111', center: true, weight: 800 });
    x.tl.fromTo(top, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 0.15);
    x.cue(0.15, 'whoosh', 0.4);
  };

  // Listicle item: footage behind, big number + title on a colour block ("3 ways to …")
  COMP.list = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec);
    if (p.media) { play(img, p.media, 0, x.dur + 0.05, { speed: 1 }); x.tl.fromTo(img, { scale: 1.1 }, { scale: 1, duration: x.dur, ease: 'none', immediateRender: false }, 0); }
    else img.style.display = 'none';
    el('div', 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15) 30%,rgba(0,0,0,.7) 100%)', x.sec);
    const num = el('div', `position:absolute;left:${(PORTRAIT ? 0.08 : 0.06) * W}px;top:${(PORTRAIT ? 0.5 : 0.36) * H}px;transform:translateY(-50%);font:900 ${(PORTRAIT ? 300 : 340) * U}px var(--display);line-height:.8;color:var(--accent);text-shadow:0 ${8 * U}px ${30 * U}px rgba(0,0,0,.45)`, x.sec, 'tx');
    num.textContent = String(p.n ?? 1); num.dataset.gate = 'text'; num.dataset.id = x.id + '.n'; num.dataset.onmedia = '1';
    x.tl.fromTo(num, { autoAlpha: 0, scale: 1.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'expo.out' }, 0.05);
    x.cue(0.05, 'impact', 0.5);
    const t = pill(x.sec, x.id + '.t', { text: p.title || '', x: PORTRAIT ? 0.08 : 0.06, y: PORTRAIT ? 0.66 : 0.66, size: PORTRAIT ? 66 : 64, bg: hexOf('primary'), fg: '#ffffff', maxW: PORTRAIT ? 0.82 : 0.6 });
    x.tl.fromTo(t, { autoAlpha: 0, x: -60 * U }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'expo.out' }, 0.3);
    if (p.detail) {
      const d = pill(x.sec, x.id + '.d', { text: p.detail, x: PORTRAIT ? 0.08 : 0.06, y: PORTRAIT ? 0.76 : 0.79, size: PORTRAIT ? 40 : 36, bg: '#ffffff', fg: '#111111', weight: 600, maxW: PORTRAIT ? 0.82 : 0.6 });
      x.tl.fromTo(d, { autoAlpha: 0, y: 20 * U }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'expo.out' }, 0.6);
    }
  };

  // Pinterest board: masonry of photos drifting upward behind a soft serif title card
  COMP.pins = (x, p) => {
    const paper = p.paper || '#F5EFE6';
    x.sec.style.background = paper;
    const items = (p.items || []).slice(0, 12);
    const cols = PORTRAIT ? 3 : 4, gap = 18 * U, cw = (W - gap * (cols + 1)) / cols;
    const colH = Array(cols).fill(gap);
    const wall = el('div', 'position:absolute;left:0;top:0;width:100%', x.sec);
    const ratios = [1.4, 1.0, 1.25, 0.8, 1.5, 1.1];
    items.concat(items).forEach((m, i) => {
      const c = colH.indexOf(Math.min(...colH));
      const h = cw * ratios[i % ratios.length];
      const card = el('div', `position:absolute;left:${gap + c * (cw + gap)}px;top:${colH[c]}px;width:${cw}px;height:${h}px;border-radius:${22 * U}px;overflow:hidden;background:#ddd`, wall);
      play(mediaImg(card), m, 0, x.dur + 0.1, { speed: 0.5 });
      colH[c] += h + gap;
      gsap.set(card, { autoAlpha: 0 });
      x.tl.fromTo(card, { autoAlpha: 0, y: 40 * U }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out', immediateRender: false }, 0.05 + (i % 8) * 0.08);
    });
    const travel = Math.max(0, Math.min(...colH) - H);
    x.tl.fromTo(wall, { y: 0 }, { y: -Math.min(travel, H * 0.6), duration: x.dur, ease: 'none' }, 0);
    el('div', `position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%, ${paper}EE 0%, ${paper}99 38%, ${paper}00 70%)`, x.sec);
    const card = el('div', `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:${paper};padding:${40 * U}px ${56 * U}px;border-radius:${28 * U}px;box-shadow:0 30px 80px -30px rgba(60,40,20,.35);text-align:center;max-width:${(PORTRAIT ? 0.82 : 0.6) * W}px`, x.sec);
    const T = text(card, x.id, { key: 'h', text: p.headline || '', x: 0, y: 0, size: PORTRAIT ? 92 : 96, weight: 500, color: '#3B2F2A', bg: paper, anchor: 'left', lh: 1.05 });
    T.el.style.position = 'relative'; T.el.style.left = '0'; T.el.style.top = '0'; T.el.style.whiteSpace = 'normal'; T.el.style.fontFamily = SERIF; T.el.style.fontStyle = 'italic'; T.el.style.textAlign = 'center';
    if (p.sub) {
      const S2 = text(card, x.id, { key: 's', text: p.sub, x: 0, y: 0, size: PORTRAIT ? 34 : 32, weight: 500, color: '#7A6A60', bg: paper, font: 'body', ls: 0.18 });
      S2.el.style.position = 'relative'; S2.el.style.left = '0'; S2.el.style.top = '0'; S2.el.style.marginTop = `${18 * U}px`; S2.el.style.textTransform = 'uppercase'; S2.el.style.textAlign = 'center'; S2.el.style.whiteSpace = 'normal';
      hidden(S2); reveal(x.tl, 1.0, S2, 'rise', 0.7, 0.05);
    }
    gsap.set(card, { autoAlpha: 0 });
    x.tl.fromTo(card, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 1.0, ease: 'power2.out', immediateRender: false }, 0.5);
    hidden(T); reveal(x.tl, 0.6, T, 'rise', 0.9, 0.08);
    x.cue(0.5, 'soft', 0.4);
  };

  // Slow aesthetic shot: one photo/clip with a gentle Ken Burns pan and a soft serif line
  COMP.drift = (x, p) => {
    x.sec.style.background = '#111';
    const img = mediaImg(x.sec);
    play(img, p.media, 0, x.dur + 0.05, { speed: 0.6 });
    const dir = p.dir ?? 1;
    x.tl.fromTo(img, { scale: 1.14, xPercent: -2 * dir }, { scale: 1.02, xPercent: 2 * dir, duration: x.dur, ease: 'none', immediateRender: false }, 0);
    gsap.set(img, { filter: 'saturate(.85) contrast(.96) brightness(1.02)' });
    el('div', 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(20,12,8,.55) 100%)', x.sec);
    if (p.line) {
      const T = text(x.sec, x.id, { key: 'l', text: p.line, x: 0.5, y: PORTRAIT ? 0.74 : 0.8, size: PORTRAIT ? 64 : 60, weight: 500, color: '#FFF7ED', anchor: 'center', onMedia: true, bg: 'black', shadow: true, maxW: PORTRAIT ? 0.84 : 0.7 });
      T.el.style.fontFamily = SERIF; T.el.style.fontStyle = 'italic'; T.el.style.whiteSpace = 'normal'; T.el.style.textAlign = 'center';
      gsap.set(T.el, { autoAlpha: 0 });
      x.tl.fromTo(T.el, { autoAlpha: 0, y: 16 * U }, { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power2.out', immediateRender: false }, 0.4);
      x.tl.to(T.el, { autoAlpha: 0, duration: 0.4 }, x.dur - 0.45);
    }
    x.tl.fromTo(x.sec, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, immediateRender: false }, 0);
  };

  // Quote card: serif quote revealed word by word, author below; optional dimmed photo behind
  COMP.quote = (x, p) => {
    const paper = p.dark ? '#14110F' : '#F5EFE6', ink = p.dark ? '#F5EFE6' : '#2A211C';
    x.sec.style.background = paper;
    if (p.media) {
      const img = mediaImg(x.sec, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(2px) saturate(.7)');
      play(img, p.media, 0, x.dur + 0.05, { speed: 0.4 });
      x.tl.fromTo(img, { scale: 1.12 }, { scale: 1.02, duration: x.dur, ease: 'none', immediateRender: false }, 0);
      el('div', `position:absolute;inset:0;background:${paper};opacity:.82`, x.sec);
    }
    const mark = el('div', `position:absolute;left:${(PORTRAIT ? 0.08 : 0.12) * W}px;top:${(PORTRAIT ? 0.2 : 0.12) * H}px;font:400 ${320 * U}px ${SERIF};line-height:1;color:var(--accent);opacity:.9`, x.sec);
    mark.textContent = '“';
    x.tl.fromTo(mark, { autoAlpha: 0, y: -30 * U }, { autoAlpha: 0.9, y: 0, duration: 0.8, ease: 'power2.out' }, 0.1);
    const q = text(x.sec, x.id, { key: 'q', text: p.quote || '', x: PORTRAIT ? 0.1 : 0.14, y: PORTRAIT ? 0.34 : 0.32, size: PORTRAIT ? 74 : 72, weight: 500, color: ink, bg: paper, maxW: PORTRAIT ? 0.8 : 0.72, lh: 1.18 });
    q.el.style.fontFamily = SERIF; q.el.style.fontStyle = 'italic';
    gsap.set(q.ins, { autoAlpha: 0 });
    const span = Math.max(1, x.dur * 0.55), st = span / Math.max(1, q.ins.length);
    x.tl.fromTo(q.ins, { autoAlpha: 0, y: 12 * U }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: st, immediateRender: false }, 0.5);
    if (p.author) {
      const a = text(x.sec, x.id, { key: 'a', text: '— ' + p.author, x: PORTRAIT ? 0.1 : 0.14, y: PORTRAIT ? 0.78 : 0.8, size: PORTRAIT ? 38 : 34, weight: 600, color: ink, bg: paper, font: 'body', ls: 0.12 });
      a.el.style.textTransform = 'uppercase';
      hidden(a); reveal(x.tl, 0.6 + span, a, 'rise', 0.6);
    }
    x.cue(0.1, 'soft', 0.4);
  };

  // Before / after: a divider wipes across to reveal the "after" shot, with labels
  COMP.compare = (x, p) => {
    x.sec.style.background = '#000';
    const before = mediaImg(x.sec);
    const wrap = el('div', 'position:absolute;inset:0;overflow:hidden', x.sec);
    const after = mediaImg(wrap);
    play(before, p.before, 0, x.dur + 0.05, { speed: 0.6 });
    play(after, p.after, 0, x.dur + 0.05, { speed: 0.6 });
    const t0 = x.dur * 0.3, t1 = x.dur * 0.62;
    gsap.set(wrap, { clipPath: 'inset(0 0 0 100%)' });
    x.tl.to(wrap, { clipPath: 'inset(0 0 0 0%)', duration: t1 - t0, ease: 'power2.inOut' }, t0);
    const line = el('div', `position:absolute;top:0;bottom:0;width:${6 * U}px;background:#fff;box-shadow:0 0 ${20 * U}px rgba(0,0,0,.4)`, x.sec);
    x.tl.fromTo(line, { left: W }, { left: 0, duration: t1 - t0, ease: 'power2.inOut', immediateRender: false }, t0);
    x.tl.set(line, { autoAlpha: 0 }, t1 + 0.02);
    const lb = pill(x.sec, x.id + '.b', { text: p.beforeLabel || 'BEFORE', x: PORTRAIT ? 0.08 : 0.05, y: PORTRAIT ? 0.16 : 0.1, size: 40, bg: '#111111', fg: '#ffffff' });
    const la = pill(x.sec, x.id + '.a', { text: p.afterLabel || 'AFTER', x: PORTRAIT ? 0.08 : 0.05, y: PORTRAIT ? 0.16 : 0.1, size: 40, bg: hexOf('primary'), fg: '#ffffff' });
    gsap.set(la, { autoAlpha: 0 });
    x.tl.fromTo(lb, { autoAlpha: 0, x: -40 * U }, { autoAlpha: 1, x: 0, duration: 0.4, ease: 'expo.out' }, 0.15);
    x.tl.set(lb, { autoAlpha: 0 }, t1); x.tl.fromTo(la, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2)', immediateRender: false }, t1);
    x.cue(t0, 'whoosh', 0.5); x.cue(t1, 'hit', 0.5);
    if (p.caption) {
      const c = pill(x.sec, x.id + '.c', { text: p.caption, x: 0.5, y: PORTRAIT ? 0.76 : 0.82, size: PORTRAIT ? 52 : 46, bg: '#ffffff', fg: '#111111', center: true });
      gsap.set(c, { autoAlpha: 0 });
      x.tl.fromTo(c, { autoAlpha: 0, y: 20 * U }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'expo.out', immediateRender: false }, t1 + 0.2);
    }
  };

  // Kinetic beats over footage (event recap): big words sit on a colour block, never raw on busy footage
  COMP.beats = (x, p) => {
    x.sec.style.background = '#000';
    const img = mediaImg(x.sec);
    const items = p.items || [];
    const each = x.dur / Math.max(1, items.length);
    items.forEach((it, i) => {
      const t0 = i * each;
      play(img, it.media, t0, t0 + each + 0.02, { speed: 1 });
      x.tl.fromTo(img, { scale: 1.08 }, { scale: 1, duration: each, ease: 'power2.out', immediateRender: false }, t0);
      x.cue(t0, 'tick', 0.4);
      if (it.word) {
        const blk = el('div', `position:absolute;left:${(PORTRAIT ? 0.07 : 0.05) * W}px;top:${(PORTRAIT ? 0.7 : 0.72) * H}px;background:var(--primary);padding:${10 * U}px ${22 * U}px;border-radius:${10 * U}px`, x.sec);
        const T = text(blk, x.id, { key: 'b' + i, text: it.word, x: 0, y: 0, size: PORTRAIT ? 84 : 96, weight: 800, color: 'white', bg: 'primary' });
        T.el.style.position = 'relative'; T.el.style.left = '0'; T.el.style.top = '0';
        gsap.set(blk, { autoAlpha: 0 });
        x.tl.fromTo(blk, { autoAlpha: 0, scaleX: 0.2, transformOrigin: '0% 50%' }, { autoAlpha: 1, scaleX: 1, duration: 0.3, ease: 'expo.out', immediateRender: false }, t0 + 0.05);
        x.tl.set(blk, { autoAlpha: 0 }, t0 + each - 0.02);
        x.cue(t0 + 0.05, 'hit', 0.45);
      }
    });
  };

  /* ===================================================================
     BUILD
     =================================================================== */
  let master;
  function build() {
    master = gsap.timeline({ paused: true });
    DOC.scenes.forEach((sc, i) => {
      const sec = el('section', `z-index:${i + 1}`, stage, 'scene');
      sec.dataset.scene = sc.id;
      gsap.set(sec, { autoAlpha: 0 });
      master.set(sec, { autoAlpha: 1 }, sc.start);
      if (i < DOC.scenes.length - 1 || sc.end < DUR) master.set(sec, { autoAlpha: 0 }, sc.end);
      const tl = gsap.timeline();
      const ctx = { sec, tl, dur: sc.end - sc.start, id: sc.id, cue: (t, type, v) => CUES.push({ t: sc.start + t, type, v }) };
      const fn = COMP[sc.type];
      if (!fn) throw new Error('Unknown scene type: ' + sc.type);
      // clip scheduling uses absolute time
      const origPlay = play;
      ctx.play = (img, m, t0, t1, o) => origPlay(img, m, sc.start + t0, sc.start + t1, o);
      withShift(sc.start, () => fn(ctx, sc.props || {}));
      master.add(tl, sc.start);
    });
    if (DOC.watermark) { const wm = el('div', `position:absolute;right:${24 * U}px;bottom:${20 * U}px;z-index:99;font:700 ${22 * U}px var(--body);color:rgba(255,255,255,.85);background:rgba(10,22,51,.55);padding:${6 * U}px ${12 * U}px;border-radius:${8 * U}px`, stage); wm.textContent = 'Made with Alter Effects'; }
    master.to({}, { duration: 0.001 }, DUR - 0.001);
    CUES.sort((a, b) => a.t - b.t);
  }
  // play() inside components is called with scene-local times; shift them while a scene builds
  let SHIFT = 0;
  function withShift(s, fn) { SHIFT = s; try { fn(); } finally { SHIFT = 0; } }
  const rawPlay = play;
  play = function (img, m, t0, t1, o) { return rawPlay(img, m, t0 + SHIFT, t1 + SHIFT, o); };

  /* ===================================================================
     GATES — measured in the page (safe zones, faces, contrast)
     =================================================================== */
  function lum(hex) {
    const h = hex.replace('#', ''); const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const contrast = (a, b) => { const x1 = lum(a), x2 = lum(b); return (Math.max(x1, x2) + 0.05) / (Math.min(x1, x2) + 0.05); };
  function visible(e) {
    for (let n = e; n && n !== stage; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.2) return false; }
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const s = stage.getBoundingClientRect(); if (r.right <= s.left || r.left >= s.right || r.bottom <= s.top || r.top >= s.bottom) return false;
    // inside masks: at least one word must be revealed
    const ins = e.querySelectorAll('.in'); if (!ins.length) return true;
    return [...ins].some(i => { const ir = i.getBoundingClientRect(), mr = i.parentElement.getBoundingClientRect(); return ir.bottom > mr.top + 2 && ir.top < mr.bottom - 2; });
  }
  function faceRects() {
    const out = [];
    stage.querySelectorAll('img[data-faces]').forEach(img => {
      if (!visible(img)) return;
      const r = img.getBoundingClientRect(); const nw = img.naturalWidth || 16, nh = img.naturalHeight || 9;
      const k = Math.max(r.width / nw, r.height / nh); const dw = nw * k, dh = nh * k;
      const [px0, py0] = (img.style.objectPosition || '50% 50%').split(' ').map(v => parseFloat(v) / 100);
      const ox = r.left + (r.width - dw) * (isNaN(px0) ? 0.5 : px0), oy = r.top + (r.height - dh) * (isNaN(py0) ? 0.5 : py0);
      JSON.parse(img.dataset.faces).forEach(f => out.push({ left: ox + f.x * dw, top: oy + f.y * dh, right: ox + (f.x + f.w) * dw, bottom: oy + (f.y + f.h) * dh }));
    });
    return out;
  }
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  // Live mode measures text only: stepping the timeline is enough, no clip frames need decoding.
  const gateSeek = t => LIVE ? (master.time(Math.min(t, DUR - 0.001)), Promise.resolve()) : window.seek(t);
  async function gates() {
    const sr = stage.getBoundingClientRect(); const k = sr.width / W;
    const safe = PORTRAIT ? { l: 0.06, r: 0.11, t: 0.11, b: 0.17 } : { l: 0.025, r: 0.025, t: 0.03, b: 0.03 };
    const fails = new Map();
    const times = [];
    DOC.scenes.forEach(sc => { const d = sc.end - sc.start; [0.35, 0.6, 0.85].forEach(f => times.push(sc.start + d * f)); });
    for (const t of times) {
      await gateSeek(t);
      const faces = faceRects();
      stage.querySelectorAll('[data-gate="text"]').forEach(e => {
        if (!visible(e)) return;
        const id = e.dataset.id; if (fails.has(id)) return;
        if (!e.textContent.trim()) return;
        const parts = e.querySelectorAll(".mk, span"); let r;
        if (parts.length) { const rs = [...parts].map(p => p.getBoundingClientRect()).filter(q => q.width > 0); r = { left: Math.min(...rs.map(q => q.left)), right: Math.max(...rs.map(q => q.right)), top: Math.min(...rs.map(q => q.top)), bottom: Math.max(...rs.map(q => q.bottom)) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
        else { const rg = document.createRange(); rg.selectNodeContents(e); r = rg.getBoundingClientRect(); } // ink bounds, not the box
        const rel = { l: (r.left - sr.left) / (W * k), r: (r.right - sr.left) / (W * k), t: (r.top - sr.top) / (H * k), b: (r.bottom - sr.top) / (H * k) };
        if (rel.l < safe.l - 0.005 || rel.r > 1 - safe.r + 0.005 || rel.t < safe.t - 0.005 || rel.b > 1 - safe.b + 0.005) { fails.set(id, { id, t: +t.toFixed(2), rule: 'safe-zone', detail: rel }); return; }
        const area = r.width * r.height;
        for (const f of faces) if (inter(r, f) > area * 0.12) { fails.set(id, { id, t: +t.toFixed(2), rule: 'face', detail: 'text covers a face' }); return; }
        if (e.dataset.bg && e.dataset.fg && !e.dataset.onmedia) { const c = contrast(e.dataset.fg, e.dataset.bg); if (c < 3) fails.set(id, { id, t: +t.toFixed(2), rule: 'contrast', detail: +c.toFixed(2) }); }
      });
    }
    await gateSeek(0);
    return [...fails.values()];
  }

  /* ===================================================================
     SCORE — generated in WebAudio (no licensing), mood + energy driven
     =================================================================== */
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const MOODS = {
    manifesto: { bpm: 120, prog: ['Am', 'F', 'C', 'G'] },
    documentary: { bpm: 120, prog: ['Am', 'F', 'C', 'G'] },
    upbeat: { bpm: 124, prog: ['C', 'G', 'Am', 'F'] },
    calm: { bpm: 96, prog: ['F', 'C', 'Am', 'G'] },
  };
  const CH = {
    Am: { b: 45, p: [57, 60, 64, 67, 71], arp: [69, 72, 76, 79, 83, 79, 76, 72] },
    F: { b: 41, p: [53, 57, 60, 64, 67], arp: [65, 69, 72, 76, 79, 76, 72, 69] },
    C: { b: 48, p: [55, 59, 60, 64, 67], arp: [67, 71, 72, 76, 79, 76, 72, 71] },
    G: { b: 43, p: [55, 59, 62, 64, 69], arp: [67, 71, 74, 76, 81, 76, 74, 71] },
  };
  function buildAudio(ctx, dest, T0) {
    const A = t => T0 + t;
    const out = ctx.createGain(); out.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -15; comp.ratio.value = 3.2; comp.attack.value = 0.004; comp.release.value = 0.2;
    out.connect(comp); comp.connect(dest);
    const music = ctx.createGain(); music.connect(out);
    const sfx = ctx.createGain(); sfx.connect(out);
    (DOC.audio.vo || []).forEach(v => { music.gain.setTargetAtTime(0.6, A(Math.max(0, v.start - 0.12)), 0.06); music.gain.setTargetAtTime(1, A(v.end + 0.1), 0.25); });
    out.gain.setValueAtTime(0.9, A(Math.max(0, DUR - 1.2))); out.gain.linearRampToValueAtTime(0.0001, A(DUR));
    const nb = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; } return b; })();
    const rev = ctx.createConvolver();
    rev.buffer = (() => { const len = ctx.sampleRate * 3, b = ctx.createBuffer(2, len, ctx.sampleRate); let s = 777; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff - 1) * Math.pow(1 - i / len, 2.5); } } return b; })();
    const revOut = ctx.createGain(); revOut.gain.value = 0.4; rev.connect(revOut); revOut.connect(out);
    const dly = ctx.createDelay(1); dly.delayTime.value = 0.375; const fb = ctx.createGain(); fb.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600; const dOut = ctx.createGain(); dOut.gain.value = 0.4;
    dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(dOut); dOut.connect(music);
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const bq = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    let off = 0; const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; return s; };
    const nOff = () => { off = (off + 0.37) % 1.9; return off; };
    const send = (node, amt) => { const s = g(amt); node.connect(s); s.connect(rev); };
    const perc = (gn, t, v, dec, att = 0.002) => { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + att); gn.gain.exponentialRampToValueAtTime(0.0001, t + dec); };
    function kick(t, v) { t = A(t); const o = osc('sine', 150), e = g(0); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13); perc(e, t, v, 0.42); o.connect(e); e.connect(music); o.start(t); o.stop(t + 0.5); }
    function hat(t, v, dec = 0.04) { t = A(t); const n = noise(), f = bq('highpass', 8500), e = g(0); perc(e, t, v, dec, 0.001); n.connect(f); f.connect(e); e.connect(music); n.start(t, nOff()); n.stop(t + dec + 0.02); }
    function snare(t, v) { t = A(t); const n = noise(), f = bq('bandpass', 1900, 0.8), e = g(0); perc(e, t, v, 0.18, 0.001); n.connect(f); f.connect(e); e.connect(music); send(e, 0.3); n.start(t, nOff()); n.stop(t + 0.22); }
    function tick(t, v, f = 3200) { t = A(t); const n = noise(), b = bq('bandpass', f, 3), e = g(0); perc(e, t, v * 0.6, 0.02, 0.0008); n.connect(b); b.connect(e); e.connect(sfx); n.start(t, nOff()); n.stop(t + 0.04); }
    function click(t, v) { t = A(t); const o = osc('square', 1850), f = bq('bandpass', 2400, 2), e = g(0); perc(e, t, v * 0.2, 0.018, 0.0008); o.connect(f); f.connect(e); e.connect(sfx); o.start(t); o.stop(t + 0.03); }
    function ui(t, v, f = 1500) { t = A(t); [0, 0.06].forEach((o2, i) => { const s = osc('sine', f * (i ? 1.5 : 1)), e = g(0); perc(e, t + o2, v * 0.12, 0.12, 0.002); s.connect(e); e.connect(sfx); e.connect(dly); s.start(t + o2); s.stop(t + o2 + 0.15); }); }
    function whoosh(t, d, v, pan = 0) { t = A(t); const n = noise(), b = bq('bandpass', 350, 1.1), e = g(0), p = ctx.createStereoPanner(); b.frequency.setValueAtTime(320, t); b.frequency.exponentialRampToValueAtTime(3000, t + d * 0.62); b.frequency.exponentialRampToValueAtTime(700, t + d); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(v * 0.5, t + d * 0.62); e.gain.exponentialRampToValueAtTime(0.0001, t + d); p.pan.setValueAtTime(pan * 0.7, t); p.pan.linearRampToValueAtTime(-pan * 0.7, t + d); n.connect(b); b.connect(e); e.connect(p); p.connect(sfx); send(e, 0.2); n.start(t, nOff()); n.stop(t + d + 0.05); }
    function riser(t, d, v) { t = A(t); const n = noise(), b = bq('bandpass', 200, 2.5), e = g(0); b.frequency.setValueAtTime(200, t); b.frequency.exponentialRampToValueAtTime(6500, t + d); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(v * 0.45, t + d * 0.97); e.gain.linearRampToValueAtTime(0.0001, t + d + 0.01); n.connect(b); b.connect(e); e.connect(sfx); send(e, 0.25); n.start(t); n.stop(t + d + 0.05); }
    function impact(t, v, deep) { t = A(t); const f0 = deep ? 80 : 110, f1 = deep ? 28 : 38, dd = deep ? 2 : 0.8; const o = osc('sine', f0), e = g(0); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dd * 0.5); perc(e, t, v, dd, 0.003); o.connect(e); e.connect(sfx); send(e, 0.25); o.start(t); o.stop(t + dd + 0.1); const n = noise(), lp = bq('lowpass', deep ? 900 : 1500), e2 = g(0); perc(e2, t, v * 0.5, deep ? 0.55 : 0.25, 0.001); n.connect(lp); lp.connect(e2); e2.connect(sfx); send(e2, deep ? 0.8 : 0.45); n.start(t, nOff()); n.stop(t + 0.7); }
    function pad(t, notes, d, v, cut = 1300) { t = A(t); const bus = g(0), lp = bq('lowpass', cut, 0.5); bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(v, t + Math.min(0.5, d * 0.3)); bus.gain.setValueAtTime(v, t + d - 0.25); bus.gain.linearRampToValueAtTime(0.0001, t + d + 0.35); lp.connect(bus); bus.connect(music); send(bus, 0.55); notes.forEach(m => [-7, 7].forEach(c => { const o = osc('sawtooth', mtof(m)); o.detune.value = c; const gg = g(0.11); o.connect(gg); gg.connect(lp); o.start(t); o.stop(t + d + 0.4); })); }
    function bass(t, m, d, v) { t = A(t); const o = osc('sawtooth', mtof(m)), s = osc('sine', mtof(m - 12)), lp = bq('lowpass', 900, 4), e = g(0); lp.frequency.setValueAtTime(1000, t); lp.frequency.exponentialRampToValueAtTime(170, t + d * 0.9); perc(e, t, v, d, 0.004); o.connect(lp); lp.connect(e); const es = g(0.7); s.connect(es); es.connect(e); e.connect(music); o.start(t); s.start(t); o.stop(t + d + 0.05); s.stop(t + d + 0.05); }
    function pluck(t, m, v) { t = A(t); const o = osc('triangle', mtof(m)), e = g(0), lp = bq('lowpass', 3000); perc(e, t, v, 0.28, 0.002); o.connect(lp); lp.connect(e); e.connect(music); e.connect(dly); o.start(t); o.stop(t + 0.32); }
    function bell(t, m, v, d = 2.6) { t = A(t); const f = mtof(m), c = osc('sine', f), mod = osc('sine', f * 3.5), mg = g(0), e = g(0); mg.gain.setValueAtTime(f * 1.5, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + d * 0.6); mod.connect(mg); mg.connect(c.frequency); perc(e, t, v, d, 0.003); c.connect(e); e.connect(music); send(e, 0.8); c.start(t); mod.start(t); c.stop(t + d + 0.1); mod.stop(t + d + 0.1); }

    const mood = MOODS[DOC.audio.mood] || MOODS.documentary;
    const beat = 60 / (DOC.audio.bpm || mood.bpm), bar = beat * 4, s16 = beat / 4;
    const energyAt = t => { for (const sc of DOC.scenes) if (t >= sc.start && t < sc.end) return sc.energy ?? 1; return 1; };
    const stops = CUES.filter(c => c.type === 'stop' || c.type === 'freeze').map(c => c.t);
    const silentAt = t => stops.some(s => t >= s && t < s + (CUES.find(c => c.t === s).type === 'stop' ? 0.8 : 0.35)) || t >= DUR - 0.3;
    const endStart = (DOC.scenes.find(s => s.type === 'end') || {}).start ?? DUR;
    if (DOC.audio.music !== false) {
      const nBars = Math.ceil(DUR / bar);
      for (let b = 0; b < nBars; b++) {
        const t0 = b * bar; if (t0 >= endStart) break;
        const c = CH[mood.prog[b % 4]]; const e0 = energyAt(t0 + 0.01);
        if (t0 > 0.5 || !DOC.scenes[0] || DOC.scenes[0].type !== 'flashes') pad(t0, c.p, bar, [0.045, 0.06, 0.08, 0.09][e0], 1100 + e0 * 200);
        for (let k = 0; k < 16; k++) {
          const t = t0 + k * s16; if (t >= endStart || silentAt(t)) continue;
          const e = energyAt(t), bt = k % 4 === 0, offb = k % 4 === 2, bi = Math.round(t / beat);
          if (e >= 1 && k % 2 === 0) bass(t, c.b + (e >= 2 && k % 8 === 6 ? 12 : 0), 0.24, [0, 0.12, 0.22, 0.28][e]);
          if (e >= 1 && offb) hat(t, [0, 0.04, 0.06, 0.06][e], 0.05);
          if (e >= 2 && !offb) hat(t, 0.02);
          if (e >= 2 && bt) kick(t, e >= 3 ? 0.85 : 0.6);
          if (e >= 3 && bt && bi % 2 === 1) snare(t, 0.24);
          if (e >= 1) pluck(t, c.arp[k % 8] + (e >= 3 ? 12 : 0), [0, 0.03, 0.045, 0.05][e]);
        }
      }
      if (endStart < DUR) { pad(endStart, [48, 55, 59, 62, 64, 67], DUR - endStart, 0.1, 1600); bass(endStart, 36, Math.min(4, DUR - endStart), 0.28); }
    }
    CUES.forEach(c => {
      const v = c.v ?? 0.5;
      switch (c.type) {
        case 'tick': tick(c.t, v, 2600 + (c.t * 997 % 1800)); break;
        case 'click': click(c.t, v); break;
        case 'ui': ui(c.t, v); break;
        case 'whoosh': whoosh(c.t, 0.4, v, (c.t * 7 % 2) - 1); break;
        case 'riser': riser(c.t, 0.8, v); break;
        case 'impact': impact(c.t, v, false); break;
        case 'hit': impact(c.t, v, false); tick(c.t, 0.3, 3800); break;
        case 'hitDeep': impact(c.t, v, true); break;
        case 'soft': impact(c.t, v * 0.5, false); bell(c.t, 76, 0.05, 2); break;
        case 'career': impact(c.t, 0.95, true); bell(c.t, 72, 0.08, 2.4); break;
        case 'freeze': impact(c.t, v * 0.7, true); break;
        case 'card': whoosh(c.t, 0.3, v * 0.6, 1); tick(c.t + 0.18, 0.25, 2200); break;
        case 'collapse': whoosh(c.t - 0.35, 0.4, 0.6, 0); impact(c.t + 0.08, 0.55); break;
        case 'mcut': impact(c.t, v * 0.55); tick(c.t, 0.35); break;
        case 'resolve': [72, 76, 79, 83, 86].forEach((m, i) => bell(c.t + i * 0.09, m, 0.15 - i * 0.015, 2.8)); bell(c.t, 60, 0.12, 3.2); break;
      }
    });
  }
  function wavBase64(buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    const dv = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, len * ch * 2, true);
    const data = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    const bytes = new Uint8Array(dv.buffer); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  /* ---------- public API used by the renderer ---------- */
  window.__ready = (async () => {
    await document.fonts.ready;
    build();
    await Promise.all([...document.images].filter(i => i.src).map(i => i.decode().catch(() => {})));
    master.time(0); await renderClips(0);
    return { duration: DUR, cues: CUES.length };
  })();
  window.seek = async t => { master.time(t); await renderClips(t); };
  window.runGates = gates;
  window.renderAudio = async () => { const sr = 48000; const ctx = new OfflineAudioContext(2, Math.ceil(sr * DUR), sr); buildAudio(ctx, ctx.destination, 0); return wavBase64(await ctx.startRendering()); };
  if (LIVE) {
    /* Live player API for the review studio (same-origin parent): seek, play from any time, pause.
       The score is bounced once offline, then played from an offset so it always matches the picture. */
    let actx = null, src = null, scoreBuf = null, scoreJob = null, T0 = 0, cur = 0, raf = 0, drawing = false;
    let playId = 0, starting = false; // a play() still preparing counts as playing, so a second press pauses it
    const levels = { music: 1, source: 1 };
    let musicGain = null;
    const emit = (type, detail) => dispatchEvent(new CustomEvent(type, { detail }));
    let base = null;
    if (OVERLAY && liveUrl(DOC.base.media.key)) {
      base = document.createElement('video');
      base.playsInline = true; base.preload = 'auto'; base.muted = !DOC.audio.sourceAudio; base.src = liveUrl(DOC.base.media.key);
      base.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0';
      stage.insertBefore(base, stage.firstChild);
      document.body.style.background = '#000';
    }
    const baseAt = t => (DOC.base ? DOC.base.trimIn || 0 : 0) + t;
    function score() {
      if (scoreBuf) return Promise.resolve(scoreBuf);
      scoreJob ??= (async () => {
        const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(sr * DUR), sr);
        buildAudio(ctx, ctx.destination, 0);
        return (scoreBuf = await ctx.startRendering());
      })();
      return scoreJob;
    }
    function stopAll() {
      livePlaying = false; starting = false; playId++; cancelAnimationFrame(raf);
      if (src) { try { src.stop(); } catch {} src = null; }
      LV.forEach(s => s.v.pause());
      if (base) base.pause();
    }
    async function show(t) {
      cur = Math.max(0, Math.min(DUR, t));
      master.time(Math.min(cur, DUR - 0.001));
      if (base) { base.pause(); if (Math.abs(base.currentTime - baseAt(cur)) > 0.5 / FPS) { base.currentTime = baseAt(cur); await once(base, 'seeked', 4000); } }
      await renderClips(cur);
      emit('livetime', cur);
    }
    window.live = {
      duration: DUR, fps: FPS, width: W, height: H,
      scenes: DOC.scenes.map(s => ({ id: s.id, type: s.type, start: s.start, end: s.end })),
      vo: DOC.audio.vo || [],
      ready: window.__ready,
      time: () => cur,
      playing: () => livePlaying || starting,
      seek: async t => { stopAll(); await show(t); emit('livestate', false); },
      /** Same layout checks as the renderer (safe zone, faces, contrast); the page then reloads with the fixes. */
      gates: async () => { stopAll(); const f = await gates(); await show(cur); return f; },
      fixes: DOC.fixes || {},
      pause: () => { stopAll(); emit('livestate', false); emit('livetime', cur); },
      setLevels: l => { Object.assign(levels, l); if (musicGain) musicGain.gain.value = levels.music; if (base) base.volume = Math.max(0, Math.min(1, levels.source)); },
      play: async from => {
        stopAll();
        const id = playId; starting = true; emit('livestate', true);
        const t0 = from == null ? (cur >= DUR - 0.05 ? 0 : cur) : from;
        await show(t0);
        actx ??= new AudioContext();
        await actx.resume();
        const buf = await score();
        if (id !== playId) return; // paused or restarted while preparing
        starting = false;
        musicGain = actx.createGain(); musicGain.gain.value = levels.music; musicGain.connect(actx.destination);
        src = actx.createBufferSource(); src.buffer = buf; src.connect(musicGain);
        const at = actx.currentTime + 0.05; src.start(at, t0); T0 = at - t0;
        livePlaying = true; emit('livestate', true);
        if (base) { base.currentTime = baseAt(t0); base.play().catch(() => {}); }
        const loop = () => {
          if (!livePlaying) return;
          const t = Math.max(0, actx.currentTime - T0);
          if (t >= DUR) { cur = DUR; master.time(DUR - 0.001); stopAll(); emit('livetime', DUR); emit('livestate', false); return; }
          cur = t; master.time(t);
          if (base && Math.abs(base.currentTime - baseAt(t)) > 0.3) base.currentTime = baseAt(t);
          if (!drawing) {
            // liveFrame marks the clips this frame uses synchronously; any other hidden <video> can stop decoding.
            drawing = true; LV.forEach(s => { s.used = false; });
            const p = renderClips(t);
            LV.forEach(s => { if (!s.used) s.v.pause(); });
            p.finally(() => { drawing = false; });
          }
          emit('livetime', t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      },
    };
    // Bounce the score in the background once the picture is ready, so the first Play starts at once.
    window.__ready.then(() => setTimeout(() => score().catch(() => {}), 300));
    window.__ready.then(() => emit('liveready', window.live)).catch(e => emit('liveerror', String(e && e.message || e)));
  } else if (!RENDER) {
    let actx = null;
    window.__ready.then(() => { if (Q.has('t')) window.seek(+Q.get('t')); });
    window.playPreview = () => { if (actx) actx.close(); actx = new AudioContext(); const T0 = actx.currentTime + 0.15; buildAudio(actx, actx.destination, T0); const loop = () => { const t = Math.max(0, actx.currentTime - T0); master.time(Math.min(t, DUR)); renderClips(t); if (t < DUR) requestAnimationFrame(loop); }; loop(); };
  }
})();
