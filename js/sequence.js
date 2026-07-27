/* =========================================================================
   430-frame exploded-view sequence, scrubbed on a canvas.
   Frames live at ../assets/frames/openpulse/openpulse_0001.webp …
   ========================================================================= */
(function () {
  "use strict";
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const stage = document.querySelector("#seqStage");
  const canvas = document.querySelector("#seqCanvas");
  if (!stage || !canvas) return;

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOBILE = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const COMPACT = window.matchMedia("(max-width: 600px), (max-height: 700px)").matches;
  const SAVE_DATA = Boolean(navigator.connection && navigator.connection.saveData);
  const ADAPTIVE = MOBILE || SAVE_DATA;
  const COUNT = 430;
  const BASE = canvas.dataset.frames || "../assets/frames/openpulse/openpulse_";
  const src = (i) => BASE + String(i + 1).padStart(4, "0") + ".webp";

  const ctx = canvas.getContext("2d");
  const imgs = new Array(COUNT);
  const loaded = new Array(COUNT).fill(false);
  const waiters = new Array(COUNT);
  let current = 0;

  function draw(index) {
    let i = index;
    if (!loaded[i]) {
      for (let d = 1; d < COUNT; d++) {
        if (loaded[i - d]) { i -= d; break; }
        if (loaded[i + d]) { i += d; break; }
      }
      if (!loaded[i]) return;
    }
    const img = imgs[i];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth * dpr, H = canvas.clientHeight * dpr;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const scale = Math.min(W / img.width, H / img.height) * 0.82;
    const w = img.width * scale, h = img.height * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  function load(i, cb) {
    if (i < 0 || i >= COUNT) return;
    if (loaded[i]) {
      if (cb) cb(i);
      return;
    }
    if (cb) {
      if (!waiters[i]) waiters[i] = new Set();
      waiters[i].add(cb);
    }
    if (imgs[i]) {
      return;
    }
    const im = new Image();
    im.onload = () => {
      loaded[i] = true;
      if (waiters[i]) waiters[i].forEach((fn) => fn(i));
      waiters[i] = null;
    };
    im.onerror = () => {
      imgs[i] = null;
      waiters[i] = null;
    };
    im.src = src(i);
    imgs[i] = im;
  }

  window.addEventListener("resize", () => draw(current), { passive: true });
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", REDUCED
    ? "Exploded view of the OpenPulse sensor module"
    : "Exploded view of the OpenPulse sensor module, driven by scroll");

  if (REDUCED) {
    current = Math.floor(COUNT / 2);
    load(current, () => draw(current));
    gsap.set("[data-sscene]", { opacity: 0, x: 0, filter: "none" });
    gsap.set('[data-sscene="a"]', { opacity: 1 });
    return;
  }

  /*
   * Phones do not benefit from downloading 430 full-resolution frames. Keep
   * a sparse safety net and request only a small, sampled neighbourhood around
   * the current scroll position. Desktop retains the full eager sequence.
   */
  const SAMPLE_STEP = SAVE_DATA ? 8 : (MOBILE ? 4 : 1);
  let lastRequested = 0;

  function sampled(index) {
    if (index >= COUNT - 1) return COUNT - 1;
    return Math.max(0, Math.min(COUNT - 1, Math.round(index / SAMPLE_STEP) * SAMPLE_STEP));
  }

  function primeNearby(index) {
    const center = sampled(index);
    const direction = index >= lastRequested ? 1 : -1;
    const candidates = [
      center,
      center + direction * SAMPLE_STEP,
      center - direction * SAMPLE_STEP,
      center + direction * SAMPLE_STEP * 2,
    ];
    lastRequested = index;
    [...new Set(candidates)].forEach((i) => {
      if (i < 0 || i >= COUNT) return;
      if (loaded[i]) return;
      load(i, redrawIfNearby);
    });
  }

  function redrawIfNearby(index) {
    if (Math.abs(index - current) <= SAMPLE_STEP * 2) draw(current);
  }

  function sparsePrefetch() {
    if (SAVE_DATA) return;
    const indexes = [];
    const stride = Math.max(16, SAMPLE_STEP * 4);
    for (let i = stride; i < COUNT; i += stride) indexes.push(i);
    if (indexes[indexes.length - 1] !== COUNT - 1) indexes.push(COUNT - 1);
    let cursor = 0;

    const schedule = (fn) => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 700 });
      else setTimeout(fn, 120);
    };
    const pump = () => {
      // Two requests per idle turn keeps image decoding from blocking touch scroll.
      for (let n = 0; n < 2 && cursor < indexes.length; n++, cursor++) load(indexes[cursor]);
      if (cursor < indexes.length) schedule(pump);
    };
    schedule(pump);
  }

  if (ADAPTIVE) {
    primeNearby(0);
    sparsePrefetch();
  } else {
    load(0, () => draw(0));
    // Coarse pass first, then fill the complete sequence for smooth desktop scrubbing.
    for (let i = 6; i < COUNT; i += 6) {
      load(i, (k) => { if (Math.abs(k - current) < 8) draw(current); });
    }
    setTimeout(() => { for (let i = 0; i < COUNT; i++) load(i); }, 900);
  }

  const proxy = { f: 0 };
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: stage, start: "top top",
      end: () => {
        const compact = COMPACT || window.innerWidth <= 600;
        return "+=" + Math.round(Math.max(window.innerHeight, compact ? 520 : 600) * (compact ? 2.1 : 3.4));
      },
      pin: ".seqstage__pin", scrub: 1,
    },
  });

  tl.fromTo(proxy, { f: 0 }, {
    f: COUNT - 1, ease: "none", duration: 1,
    onUpdate: () => {
      const idx = Math.round(proxy.f);
      if (idx !== current) {
        current = idx;
        if (ADAPTIVE) primeNearby(current);
        draw(current);
      }
    },
  }, 0);

  const scenes = [
    { sel: '[data-sscene="a"]', inAt: 0.02, outAt: 0.2 },
    { sel: '[data-sscene="b"]', inAt: 0.28, outAt: 0.44 },
    { sel: '[data-sscene="c"]', inAt: 0.5,  outAt: 0.66 },
    { sel: '[data-sscene="d"]', inAt: 0.8,  outAt: null },
  ];
  scenes.forEach(({ sel, inAt, outAt }, n) => {
    const fromX = (n % 2 === 0 ? 1 : -1) * (ADAPTIVE ? 28 : 60);
    const blurIn = ADAPTIVE ? "none" : "blur(12px)";
    const blurOut = ADAPTIVE ? "none" : "blur(10px)";
    tl.fromTo(sel, { opacity: 0, x: fromX, filter: blurIn },
      { opacity: 1, x: 0, filter: "blur(0px)", ease: "power3.out", duration: 0.1 }, inAt);
    if (outAt !== null) {
      tl.to(sel, { opacity: 0, x: -fromX * 0.6, filter: blurOut, ease: "power2.in", duration: 0.08 }, outAt);
    }
  });
})();
