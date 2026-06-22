/* ============================================================
   STACKLY – app.js
   Handles: Navbar, Hamburger, Hero video loop, Scroll Reveal,
            Frame Scroll Animations, Counter Animation
   ============================================================ */

'use strict';

/* ─────────────── NAVBAR SCROLL STATE ─────────────── */
(function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const heroEl   = document.getElementById('hero');
  const s1El     = document.getElementById('s1-wrapper');
  const s2El     = document.getElementById('s2-wrapper');
  const statsEl  = document.getElementById('stats');
  const ctaEl    = document.getElementById('cta');

  function sectionTop(el)    { return el ? el.getBoundingClientRect().top + window.scrollY : Infinity; }
  function sectionBottom(el) { return el ? sectionTop(el) + el.offsetHeight : 0; }

  function inRange(scrollY, el) {
    if (!el) return false;
    const t = sectionTop(el);
    const b = sectionBottom(el);
    return scrollY >= t - 50 && scrollY < b - 50;
  }

  function updateNav() {
    const sy = window.scrollY;
    const heroH = heroEl ? heroEl.offsetHeight : 600;

    if (sy < heroH - 80) {
      navbar.className = 'navbar nav-transparent';
      return;
    }
    if (inRange(sy, s1El) || inRange(sy, s2El) || inRange(sy, statsEl) || inRange(sy, ctaEl)) {
      navbar.className = 'navbar nav-dark';
    } else {
      navbar.className = 'navbar nav-light';
    }
  }

  updateNav();
  let navTick = false;
  window.addEventListener('scroll', () => {
    if (!navTick) {
      requestAnimationFrame(() => { updateNav(); navTick = false; });
      navTick = true;
    }
  }, { passive: true });
})();


/* ─────────────── HAMBURGER / MOBILE MENU ─────────────── */
(function () {
  const btn  = document.getElementById('ham-btn');
  const menu = document.getElementById('mob-menu');
  if (!btn || !menu) return;

  function toggle(open) {
    btn.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    document.documentElement.style.overflow = open ? 'hidden' : '';
    
    const backToTop = document.querySelector('.back-to-top');
    if (backToTop) {
      backToTop.style.display = open ? 'none' : '';
    }
  }

  btn.addEventListener('click', () => toggle(!btn.classList.contains('open')));

  menu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => toggle(false))
  );

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggle(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && btn.classList.contains('open')) {
      toggle(false);
    }
  });
})();


/* ─────────────── HERO VIDEO CONTENT FADE ─────────────── */
(function () {
  const content = document.getElementById('hero-content');
  const video   = document.getElementById('hero-video');
  if (!content || !video) return;

  video.load();

  video.addEventListener('timeupdate', () => {
    if (video.currentTime <= 7) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
})();


/* ─────────────── SCROLL REVEAL (IntersectionObserver) ─────────────── */
(function () {
  const opts = { threshold: 0.12, rootMargin: '0px 0px -55px 0px' };
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, opts);

  document.querySelectorAll('.reveal, .zoom-in, .slide-left, .slide-right, .fade-up')
    .forEach(el => io.observe(el));
})();


/* ─────────────── COUNTER ANIMATION ─────────────── */
(function () {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el     = en.target;
      const target = +el.dataset.target;
      const suffix = el.dataset.suffix ?? '+';
      const dur    = 2000;
      const start  = performance.now();

      function tick(now) {
        const elapsed = Math.min(now - start, dur);
        const progress = elapsed / dur;
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        const val  = Math.round(ease * target);
        el.textContent = (target >= 1000 ? val.toLocaleString() : val) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-num[data-target]').forEach(el => io.observe(el));
})();


/* ─────────────── SHARED FRAME LOADER (global pool) ─────────────── */
const FrameLoader = (function () {
  const cache   = window.__stacklyFrameCache || (window.__stacklyFrameCache = new Map());
  const pending = new Map();
  const queue   = [];
  const MAX     = 24; // total parallel downloads across both sections
  let active    = 0;

  const missingUrls = [
    'assets/section 1/frame_213.webp',
    'assets/section 1/frame_232.webp',
    'assets/section 1/frame_239.webp',
    'assets/section 2/frame_263.webp',
    'assets/section 2/frame_268.webp',
    'assets/section 2/frame_271.webp'
  ];

  function pump() {
    while (active < MAX && queue.length) {
      const job = queue.shift();
      active++;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        cache.set(job.url, img);
        pending.delete(job.url);
        active--;
        job.resolve(img);
        pump();
      };
      img.onerror = () => {
        const errObj = { error: true };
        cache.set(job.url, errObj);
        pending.delete(job.url);
        active--;
        job.resolve(errObj); // Resolve with dummy to avoid infinite 404 loops
        pump();
      };
      img.src = job.url;
    }
  }

  function load(url) {
    // Skip known missing frames to prevent 404 console errors
    if (missingUrls.includes(url)) {
      const errObj = { error: true };
      cache.set(url, errObj);
      return Promise.resolve(errObj);
    }

    const hit = cache.get(url);
    if (hit && (hit.error || (hit.complete && hit.naturalWidth))) return Promise.resolve(hit);

    if (pending.has(url)) return pending.get(url);

    const p = new Promise((resolve, reject) => {
      queue.push({ url, resolve, reject });
      pump();
    });
    pending.set(url, p);
    return p;
  }

  return { load, cache };
})();


/* ─────────────── FRAME SCROLL ANIMATION ─────────────── */
class FrameScrollAnim {
  constructor(cfg) {
    this.wrapper     = document.getElementById(cfg.wrapperId);
    this.canvas      = document.getElementById(cfg.canvasId);
    this.progressEl  = document.getElementById(cfg.progressId);
    this.loaderEl    = document.getElementById(cfg.loaderId);
    this.frameCount  = cfg.frameCount;
    this.path        = cfg.path;
    this.framePrefix = cfg.framePrefix || 'ezgif-frame-';
    this.frameExt    = cfg.frameExt || '.jpg';
    this.panels      = cfg.panels  || [];
    this.bgStops     = cfg.bgStops || ['#030814'];
    this.preloadDelay = cfg.preloadDelay || 0;

    if (!this.wrapper || !this.canvas) return;

    this.ctx         = this.canvas.getContext('2d');
    this.frames      = new Array(this.frameCount).fill(null);
    this._loadedCount = 0;
    this.curIdx      = 0;
    this.lastProg    = -1;
    this.firstLoaded = false;

    this._resize();
    window.addEventListener('resize', () => this._resize(), { passive: true });

    // Show first frame ASAP (uses cache if head warm-up already fetched it)
    this._load(0);

    const io = new IntersectionObserver(([e]) => {
      this._visible = e.isIntersecting;
      if (e.isIntersecting) this._preloadAll();
    }, { rootMargin: '800px' });
    io.observe(this.wrapper);

    if (this.preloadDelay) {
      setTimeout(() => this._preloadAll(), this.preloadDelay);
    } else {
      this._preloadAll();
    }

    this._raf();
  }

  _frameSrc(i) {
    const num = String(i + 1).padStart(3, '0');
    return `${this.path}/${this.framePrefix}${num}${this.frameExt}`;
  }

  _onFrameReady(i, img) {
    this.frames[i] = img;
    this._loadedCount++;

    if (i === 0 && !this.firstLoaded) {
      this.firstLoaded = true;
      if (this.loaderEl) this.loaderEl.style.display = 'none';
      this._draw(0);
    }

    if (this.loaderEl && this.loaderEl.style.display !== 'none') {
      const pct = Math.min(99, Math.round((this._loadedCount / this.frameCount) * 100));
      const p = this.loaderEl.querySelector('p');
      if (p) p.textContent = 'Loading… ' + pct + '%';
    }
  }

  _load(i) {
    if (i < 0 || i >= this.frameCount || this.frames[i]) return;

    const url = this._frameSrc(i);
    const cached = FrameLoader.cache.get(url);
    if (cached && cached.complete && cached.naturalWidth) {
      this._onFrameReady(i, cached);
      return;
    }

    FrameLoader.load(url)
      .then((img) => this._onFrameReady(i, img))
      .catch(() => {});
  }

  /* Queue every frame in order — global pool keeps 24 downloads active */
  _preloadAll() {
    if (this._preloading) return;
    this._preloading = true;

    for (let i = 0; i < this.frameCount; i++) {
      if (this.frames[i]) continue;
      const idx = i;
      FrameLoader.load(this._frameSrc(i))
        .then((img) => {
          if (!this.frames[idx]) this._onFrameReady(idx, img);
        })
        .catch(() => {});
    }
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w   = this.wrapper.offsetWidth || window.innerWidth;
    const h   = window.innerHeight;

    // Set the canvas drawing buffer to physical pixels so it renders
    // at native resolution on high-DPI / Retina / UHD displays.
    this.canvas.width  = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    // Keep the CSS display size at the CSS-pixel viewport dimensions
    // so layout is unaffected.
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';

    if (this.frames[this.curIdx]) this._draw(this.curIdx);
  }

  _draw(i) {
    const img = this.frames[i];
    if (!img || img.error) return;

    const imgW = img.naturalWidth  || img.width;
    const imgH = img.naturalHeight || img.height;

    // Ensure canvas buffer is at least the image's native resolution.
    // This guarantees the image is always drawn 1:1 inside the canvas with
    // zero in-canvas downscaling. The browser's compositor (GPU Lanczos/bicubic)
    // then handles the final CSS display scale — it produces sharper results
    // than canvas drawImage downscaling for large ratios.
    if (this.canvas.width < imgW || this.canvas.height < imgH) {
      this.canvas.width  = imgW;
      this.canvas.height = imgH;
    }

    const cw = this.canvas.width, ch = this.canvas.height;
    const scale = Math.max(cw / imgW, ch / imgH);
    const sw = imgW * scale, sh = imgH * scale;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
  }

  _progress() {
    const rect = this.wrapper.getBoundingClientRect();
    const h    = this.wrapper.offsetHeight - window.innerHeight;
    return h > 0 ? Math.max(0, Math.min(1, -rect.top / h)) : 0;
  }

  _lerp(a, b, t) {
    const p = (c) => parseInt(c, 16);
    const hex = (n) => String(n.toString(16)).padStart(2, '0');
    const c1 = a.replace('#', ''), c2 = b.replace('#', '');
    const r = Math.round(p(c1.slice(0,2)) + (p(c2.slice(0,2)) - p(c1.slice(0,2))) * t);
    const g = Math.round(p(c1.slice(2,4)) + (p(c2.slice(2,4)) - p(c1.slice(2,4))) * t);
    const bl= Math.round(p(c1.slice(4,6)) + (p(c2.slice(4,6)) - p(c1.slice(4,6))) * t);
    return `#${hex(r)}${hex(g)}${hex(bl)}`;
  }

  _updateBg(prog) {
    const n = this.bgStops.length;
    if (n < 2) return;
    const pos = prog * (n - 1);
    const i   = Math.min(Math.floor(pos), n - 2);
    this.wrapper.style.background = this._lerp(this.bgStops[i], this.bgStops[i + 1], pos - i);
  }

  _updatePanels(prog) {
    this.panels.forEach(p => {
      const el = document.getElementById(p.id);
      if (!el) return;
      if (prog >= p.start && prog < p.end) {
        const local = (prog - p.start) / (p.end - p.start);
        const opacity = local < 0.12 ? local / 0.12
                      : local > 0.88 ? (1 - local) / 0.12
                      : 1;
        const ty = (0.5 - local) * 34;
        el.style.opacity   = opacity;
        el.style.transform = `translateY(${ty}px)`;
      } else {
        el.style.opacity = 0;
      }
    });
  }

  update() {
    const prog = this._progress();
    if (Math.abs(prog - this.lastProg) < 0.0005) return;
    this.lastProg = prog;

    const idx = Math.min(this.frameCount - 1, Math.floor(prog * this.frameCount));

    if (idx !== this.curIdx) {
      this.curIdx = idx;
      this._draw(idx);
    }

    // Preload surrounding frames (wide window for smooth scroll)
    for (let i = idx - 12; i <= idx + 30; i++) this._load(i);

    if (this.progressEl) this.progressEl.style.width = (prog * 100) + '%';
    this._updateBg(prog);
    this._updatePanels(prog);
  }

  _raf() {
    const loop = () => {
      if (this._visible) this.update();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}


/* ─────────────── INIT FRAME SECTIONS ─────────────── */
document.addEventListener('DOMContentLoaded', () => {

  new FrameScrollAnim({
    wrapperId : 's1-wrapper',
    canvasId  : 's1-canvas',
    progressId: 's1-prog',
    loaderId  : 's1-loader',
    frameCount: 248,
    path      : 'assets/section 1',
    framePrefix: 'frame_',
    frameExt  : '.webp',
    bgStops   : ['#030814','#051229','#081538','#06103a','#030814'],
    panels: [
      { id: 's1-p1', start: 0.00, end: 0.26 },
      { id: 's1-p2', start: 0.25, end: 0.51 },
      { id: 's1-p3', start: 0.50, end: 0.76 },
      { id: 's1-p4', start: 0.75, end: 1.00 },
    ]
  });

  new FrameScrollAnim({
    wrapperId : 's2-wrapper',
    canvasId  : 's2-canvas',
    progressId: 's2-prog',
    loaderId  : 's2-loader',
    frameCount: 273,
    path      : 'assets/section 2',
    framePrefix: 'frame_',
    frameExt  : '.webp',
    bgStops   : ['#021220','#031a2e','#052035','#031420'],
    preloadDelay: 400,
    panels: [
      { id: 's2-p1', start: 0.00, end: 0.36 },
      { id: 's2-p2', start: 0.33, end: 0.67 },
      { id: 's2-p3', start: 0.65, end: 1.00 },
    ]
  });

});


/* ─────────────── CUSTOM CURSOR ─────────────── */
(function () {
  if (window.matchMedia('(pointer:coarse)').matches) return; // skip touch

  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.className  = 'cur-dot';
  ring.className = 'cur-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mx = -200, my = -200, rx = -200, ry = -200;

  document.addEventListener('mousemove', e => { 
    mx = e.clientX; 
    my = e.clientY; 
    if (dot.style.opacity === '0' || dot.style.opacity === '') {
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    }
  });

  (function raf() {
    rx += (mx - rx) * 0.14;
    ry += (my - ry) * 0.14;
    dot.style.transform  = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(raf);
  })();

  const hoverSel = 'a, button, .feat-card, .svc-card, .testi-card, ' +
                   '.hiw-card, .val-card, .team-card, .flip-card, ' +
                   '.price-card, .plan-btn, input, textarea, label';

  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverSel)) {
      ring.classList.add('cur-expand');
    }
  });

  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverSel)) {
      ring.classList.remove('cur-expand');
    }
  });

  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  });

  window.addEventListener('focus', () => {
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  });

  document.addEventListener('mousedown', () => {
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  });
})();


/* ─────────────── 3D CARD TILT ─────────────── */
(function () {
  const TILT_SEL = '.hiw-card, .val-card, .team-card, .stat-card';

  document.querySelectorAll(TILT_SEL).forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  - 0.5) * 12;
      const y = ((e.clientY - r.top)  / r.height - 0.5) * 12;
      card.style.transform =
        `perspective(700px) rotateX(${-y}deg) rotateY(${x}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();


/* ─────────────── CLICK RIPPLE ─────────────── */
(function () {
  document.addEventListener('click', e => {
    const r = document.createElement('div');
    r.className = 'click-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top  = e.clientY + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);
  });
})();


/* ─────────────── PLAN BUTTON SELECT ─────────────── */
function selectPlan(el) {
  document.querySelectorAll('.plan-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}


/* ─────────────── LINK & FORM ROUTING ─────────────── */
(function () {
  const NOT_FOUND = '404.html';

  /* Catch any remaining empty / hash-only links */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = (a.getAttribute('href') || '').trim();
    if (!href || href === '#' || href.startsWith('javascript:')) {
      e.preventDefault();
      window.location.href = NOT_FOUND;
    }
  });

  /* Forms have no backend — route to 404 */
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      window.location.href = NOT_FOUND;
    });
  });

  /* Standalone action buttons without a real destination */
  document.querySelectorAll('.btn-google').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = NOT_FOUND;
    });
  });
})();


/* ─────────────── BACK TO TOP ─────────────── */
(function () {
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
  document.body.appendChild(btn);

  let visible = false;
  const SHOW_AT = 400;

  function toggle(show) {
    if (show === visible) return;
    visible = show;
    btn.classList.toggle('show', show);
  }

  window.addEventListener('scroll', () => {
    toggle(window.scrollY > SHOW_AT);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  toggle(window.scrollY > SHOW_AT);
})();

/* ─────────────── DYNAMIC ACTIVE NAV LINK ─────────────── */
(function() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu > a');
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });
})();
