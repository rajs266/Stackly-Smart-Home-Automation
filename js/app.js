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
  }

  btn.addEventListener('click', () => toggle(!btn.classList.contains('open')));

  menu.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => toggle(false))
  );

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') toggle(false);
  });
})();


/* ─────────────── HERO VIDEO CONTENT FADE ─────────────── */
(function () {
  const content = document.getElementById('hero-content');
  const video   = document.getElementById('hero-video');
  const hero    = document.getElementById('hero');
  if (!content || !video || !hero) return;

  let timer       = null;
  let lastTime    = 0;

  function show() {
    content.classList.remove('hidden');
    clearTimeout(timer);
    timer = setTimeout(() => content.classList.add('hidden'), 5000);
  }

  show(); // initial reveal

  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    // Detect loop: current time jumped backwards more than 0.5s
    if (t < lastTime - 0.5) show();
    lastTime = t;
  });

  // Re-show content when scrolling back to the top
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) show();
  }, { threshold: 0.1 });
  io.observe(hero);
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

  document.querySelectorAll('.reveal, .zoom-in').forEach(el => io.observe(el));
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

    if (!this.wrapper || !this.canvas) return;

    this.ctx         = this.canvas.getContext('2d');
    this.frames      = new Array(this.frameCount).fill(null);
    this.loading     = new Set();
    this.curIdx      = 0;
    this.lastProg    = -1;
    this.firstLoaded = false;

    this._resize();
    window.addEventListener('resize', () => this._resize(), { passive: true });

    // Preload first batch eagerly
    for (let i = 0; i < Math.min(20, this.frameCount); i++) this._load(i);

    // RAF loop — only runs when wrapper is near viewport
    const io = new IntersectionObserver(([e]) => {
      this._visible = e.isIntersecting;
    }, { rootMargin: '300px' });
    io.observe(this.wrapper);

    this._raf();
  }

  _frameSrc(i) {
    return `${this.path}/${this.framePrefix}${String(i + 1).padStart(3, '0')}${this.frameExt}`;
  }

  _load(i) {
    if (i < 0 || i >= this.frameCount || this.frames[i] || this.loading.has(i)) return;
    this.loading.add(i);
    const img = new Image();
    img.onload = () => {
      this.frames[i] = img;
      this.loading.delete(i);
      if (!this.firstLoaded && i === 0) {
        this.firstLoaded = true;
        if (this.loaderEl) this.loaderEl.style.display = 'none';
        this._draw(0);
      }
    };
    img.onerror = () => this.loading.delete(i);
    img.src = this._frameSrc(i);
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
    if (!img) return;

    // canvas.width / canvas.height are already in physical pixels.
    const cw = this.canvas.width, ch = this.canvas.height;
    const scale = Math.max(cw / img.width, ch / img.height);
    const sw = img.width * scale, sh = img.height * scale;

    // Use the highest-quality downscaling algorithm available.
    this.ctx.imageSmoothingEnabled  = true;
    this.ctx.imageSmoothingQuality  = 'high';

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

    // Preload surrounding frames
    for (let i = idx - 4; i <= idx + 12; i++) this._load(i);

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
    panels: [
      { id: 's2-p1', start: 0.00, end: 0.36 },
      { id: 's2-p2', start: 0.33, end: 0.67 },
      { id: 's2-p3', start: 0.65, end: 1.00 },
    ]
  });

});
